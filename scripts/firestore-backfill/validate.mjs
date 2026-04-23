import { promises as fs } from 'node:fs'
import path from 'node:path'

const DEFAULT_INPUT_DIR = 'firestore-legacy-export'
const CANONICAL_LOAD_SEQUENCE = [
  { section: 'workspace', tables: ['teams'] },
  {
    section: 'reference',
    tables: ['projects', 'suppliers', 'expense_categories', 'funding_creditors', 'professions', 'staff', 'materials', 'worker_wage_rates'],
  },
  { section: 'storage', tables: ['file_assets'] },
  { section: 'hrd', tables: ['beneficiaries', 'hrd_applicants', 'hrd_applicant_documents'] },
  {
    section: 'finance',
    tables: ['project_incomes', 'expenses', 'expense_line_items', 'expense_attachments', 'bills', 'bill_payments', 'loans', 'loan_payments'],
  },
  { section: 'payroll', tables: ['attendance_records'] },
  { section: 'stock', tables: ['stock_transactions'] },
  { section: 'config', tables: ['pdf_settings'] },
]

const SIDECAR_BRIDGE_SEQUENCE = [{ section: 'identity', tables: ['users', 'team_members', 'profiles'] }]

function parseArgs(argv) {
  const options = {
    inputDir: DEFAULT_INPUT_DIR,
    planFile: null,
    strict: false,
    help: false,
  }
  let planFileProvided = false

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '-h' || token === '--help') {
      options.help = true
      continue
    }

    if (token === '--strict') {
      options.strict = true
      continue
    }

    if (token === '--input') {
      options.inputDir = argv[++index]
      continue
    }

    if (token === '--plan-file') {
      options.planFile = argv[++index]
      planFileProvided = true
      continue
    }

    throw new Error(`Argumen tidak dikenal: ${token}`)
  }

  if (!options.inputDir) {
    throw new Error('Nilai --input tidak boleh kosong.')
  }

  if (!planFileProvided) {
    options.planFile = path.join(options.inputDir, 'meta', 'backfill-plan.json')
  }

  return options
}

function printUsage() {
  console.log(`Firestore export validator and backfill planner

Usage:
  node scripts/firestore-backfill/validate.mjs --input ./firestore-legacy-export

Options:
  --input <dir>         Export directory to inspect (default: firestore-legacy-export)
  --plan-file <path>    Output backfill plan JSON file (default: firestore-legacy-export/meta/backfill-plan.json)
  --strict              Exit with non-zero code when any blocking issue is found
  -h, --help            Show this help

What it checks:
  - manifest and artifact file presence
  - row/document count consistency
  - validation-report summary from the extractor
  - import ordering for canonical tables
  - sidecar identity bridge ordering
`)
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath)
    return stat.isFile()
  } catch {
    return false
  }
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function readJsonIfExists(filePath) {
  if (!(await fileExists(filePath))) {
    return null
  }

  return readJson(filePath)
}

function countArtifactItems(artifact) {
  if (Array.isArray(artifact?.documents)) {
    return artifact.documents.length
  }

  if (Array.isArray(artifact?.rows)) {
    return artifact.rows.length
  }

  return null
}

function groupByKind(manifest) {
  return {
    raw: Array.isArray(manifest?.raw) ? manifest.raw : [],
    canonical: Array.isArray(manifest?.canonical) ? manifest.canonical : [],
    sidecar: Array.isArray(manifest?.sidecar) ? manifest.sidecar : [],
  }
}

function createLoadOrderIndex(entries, tableSequence, kind) {
  const byTable = new Map(entries.map((entry) => [entry.table ?? entry.collection_path ?? entry.output_file, entry]))
  const ordered = []

  for (const group of tableSequence) {
    for (const tableName of group.tables) {
      const entry = byTable.get(tableName)
      if (!entry) {
        continue
      }

      ordered.push({
        section: group.section,
        kind,
        table: tableName,
        output_file: entry.output_file,
        file_path: entry.file_path,
        expected_count: entry.expected_count,
        actual_count: entry.actual_count,
        status: entry.status,
      })
    }
  }

  for (const entry of entries) {
    const tableName = entry.table ?? entry.collection_path ?? entry.output_file
    if (ordered.some((item) => item.output_file === entry.output_file)) {
      continue
    }

    ordered.push({
      section: 'other',
      kind,
      table: tableName,
      output_file: entry.output_file,
      file_path: entry.file_path,
      expected_count: entry.expected_count,
      actual_count: entry.actual_count,
      status: entry.status,
    })
  }

  return ordered
}

async function inspectSection(entries, kind, inputDir, issues) {
  const inspectedEntries = []
  let anyFileExists = false

  for (const entry of entries) {
    const filePath = path.resolve(inputDir, entry.output_file)
    const exists = await fileExists(filePath)
    const expectedCount = entry.document_count ?? entry.row_count ?? null
    const record = {
      ...entry,
      kind,
      file_path: filePath,
      exists,
      expected_count: expectedCount,
      actual_count: null,
      status: exists ? 'present' : 'missing',
    }

    if (exists) {
      anyFileExists = true

      try {
        const artifact = await readJson(filePath)
        const actualCount = countArtifactItems(artifact)
        record.actual_count = actualCount
        record.artifact_count = artifact?.document_count ?? artifact?.row_count ?? null
        record.generated_at = artifact?.generated_at ?? null

        if (expectedCount !== null && actualCount !== null && expectedCount !== actualCount) {
          issues.push({
            severity: 'error',
            section: kind,
            file_path: filePath,
            message: `Jumlah item tidak cocok: expected ${expectedCount}, actual ${actualCount}.`,
          })
          record.status = 'count-mismatch'
        }

        if (record.artifact_count !== null && actualCount !== null && record.artifact_count !== actualCount) {
          issues.push({
            severity: 'error',
            section: kind,
            file_path: filePath,
            message: `Metadata count tidak cocok dengan isi file: artifact ${record.artifact_count}, actual ${actualCount}.`,
          })
          record.status = 'count-mismatch'
        }
      } catch (error) {
        issues.push({
          severity: 'error',
          section: kind,
          file_path: filePath,
          message: `Gagal membaca JSON artifact: ${error instanceof Error ? error.message : String(error)}`,
        })
        record.status = 'invalid-json'
      }
    }

    inspectedEntries.push(record)
  }

  if (!anyFileExists && entries.length > 0) {
    return {
      section: kind,
      status: 'skipped',
      entries: inspectedEntries,
      present: false,
      present_count: 0,
      missing_count: inspectedEntries.length,
      total_expected: entries.reduce((total, entry) => total + (entry.document_count ?? entry.row_count ?? 0), 0),
      total_actual: 0,
    }
  }

  const totalExpected = inspectedEntries.reduce((total, entry) => total + (entry.expected_count ?? 0), 0)
  const totalActual = inspectedEntries.reduce((total, entry) => total + (entry.actual_count ?? 0), 0)
  const presentCount = inspectedEntries.filter((entry) => entry.exists).length

  for (const entry of inspectedEntries) {
    if (!entry.exists && anyFileExists) {
      issues.push({
        severity: 'error',
        section: kind,
        file_path: entry.file_path,
        message: 'Sebagian artifact section ada, tetapi file ini hilang.',
      })
    }
  }

  return {
    section: kind,
    status: anyFileExists ? 'present' : 'skipped',
    entries: inspectedEntries,
    present: anyFileExists,
    present_count: presentCount,
    missing_count: inspectedEntries.length - presentCount,
    total_expected: totalExpected,
    total_actual: totalActual,
  }
}

function summarizeValidationReport(validationReport) {
  if (!validationReport) {
    return null
  }

  return {
    warnings: Array.isArray(validationReport.warnings) ? validationReport.warnings.length : 0,
    errors: Array.isArray(validationReport.errors) ? validationReport.errors.length : 0,
    missing_relations: Array.isArray(validationReport.missingRelations) ? validationReport.missingRelations.length : 0,
    duplicate_keys: Array.isArray(validationReport.duplicateKeys) ? validationReport.duplicateKeys.length : 0,
    skipped_documents: Array.isArray(validationReport.skippedDocuments) ? validationReport.skippedDocuments.length : 0,
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  const inputDir = path.resolve(options.inputDir)
  const manifestPath = path.join(inputDir, 'meta', 'manifest.json')
  const idMapPath = path.join(inputDir, 'meta', 'id-map.json')
  const validationReportPath = path.join(inputDir, 'meta', 'validation-report.json')

  if (!(await fileExists(manifestPath))) {
    throw new Error(`manifest.json tidak ditemukan: ${manifestPath}`)
  }

  const manifest = await readJson(manifestPath)
  const idMap = await readJsonIfExists(idMapPath)
  const validationReport = await readJsonIfExists(validationReportPath)
  const issues = []
  const warnings = []

  const sections = groupByKind(manifest)
  const rawSection = await inspectSection(sections.raw, 'raw', inputDir, issues)
  const canonicalSection = await inspectSection(sections.canonical, 'canonical', inputDir, issues)
  const sidecarSection = await inspectSection(sections.sidecar, 'sidecar', inputDir, issues)

  if (validationReport) {
    const validationSummary = summarizeValidationReport(validationReport)

    if (validationSummary.errors > 0) {
      issues.push({
        severity: 'error',
        section: 'meta',
        file_path: validationReportPath,
        message: `Extractor validation report masih punya ${validationSummary.errors} error.`,
      })
    }

    if (validationSummary.warnings > 0) {
      warnings.push({
        section: 'meta',
        file_path: validationReportPath,
        message: `Extractor validation report punya ${validationSummary.warnings} warning.`,
      })
    }

    if (validationSummary.missing_relations > 0) {
      warnings.push({
        section: 'meta',
        file_path: validationReportPath,
        message: `Ada ${validationSummary.missing_relations} missing relation yang perlu direview sebelum backfill.`,
      })
    }

    if (validationSummary.duplicate_keys > 0) {
      warnings.push({
        section: 'meta',
        file_path: validationReportPath,
        message: `Ada ${validationSummary.duplicate_keys} duplicate key yang perlu diaudit sebelum backfill.`,
      })
    }

    if (validationSummary.skipped_documents > 0) {
      warnings.push({
        section: 'meta',
        file_path: validationReportPath,
        message: `Ada ${validationSummary.skipped_documents} dokumen legacy yang tidak ter-transform.`,
      })
    }
  } else {
    warnings.push({
      section: 'meta',
      file_path: validationReportPath,
      message: 'validation-report.json tidak ditemukan; hanya integrity artifact yang bisa divalidasi.',
    })
  }

  if (!idMap) {
    warnings.push({
      section: 'meta',
      file_path: idMapPath,
      message: 'id-map.json tidak ditemukan; bridge identity tetap bisa dipakai, tetapi traceability akan berkurang.',
    })
  }

  const canonicalLoadOrder = createLoadOrderIndex(canonicalSection.entries, CANONICAL_LOAD_SEQUENCE, 'canonical')
  const identityBridgeOrder = createLoadOrderIndex(sidecarSection.entries, SIDECAR_BRIDGE_SEQUENCE, 'sidecar')

  const hasBlockingIssue = issues.length > 0
  const status = hasBlockingIssue ? 'blocked' : canonicalSection.present ? 'ready' : 'partial'

  const totalCanonicalRows = canonicalSection.entries.reduce((total, entry) => total + (entry.actual_count ?? 0), 0)
  const totalSidecarRows = sidecarSection.entries.reduce((total, entry) => total + (entry.actual_count ?? 0), 0)
  const totalRawDocs = rawSection.entries.reduce((total, entry) => total + (entry.actual_count ?? 0), 0)

  const plan = {
    generated_at: new Date().toISOString(),
    input_dir: inputDir,
    manifest_file: manifestPath,
    plan_file: path.resolve(options.planFile),
    status,
    summary: {
      raw_files: rawSection.present_count,
      canonical_files: canonicalSection.present_count,
      sidecar_files: sidecarSection.present_count,
      raw_documents: totalRawDocs,
      canonical_rows: totalCanonicalRows,
      sidecar_rows: totalSidecarRows,
      id_map_entries: Array.isArray(idMap) ? idMap.length : 0,
    },
    manifest: {
      project_id: manifest.project_id ?? null,
      root_collections: Array.isArray(manifest.root_collections) ? manifest.root_collections : [],
      global_team_path: manifest.global_team_path ?? null,
      output_dir: manifest.output_dir ?? null,
    },
    sections: {
      raw: rawSection,
      canonical: canonicalSection,
      sidecar: sidecarSection,
    },
    load_order: canonicalLoadOrder,
    identity_bridge: identityBridgeOrder,
    warnings,
    issues,
  }

  await writeJson(plan.plan_file, plan)

  console.log('Firestore export validation complete')
  console.log(`status: ${plan.status}`)
  console.log(`input: ${plan.input_dir}`)
  console.log(`plan: ${plan.plan_file}`)
  console.log(`canonical tables: ${plan.summary.canonical_files}`)
  console.log(`sidecar tables: ${plan.summary.sidecar_files}`)
  console.log(`raw collections: ${plan.summary.raw_files}`)
  console.log(`issues: ${issues.length}`)
  console.log(`warnings: ${warnings.length}`)

  if (issues.length > 0) {
    for (const issue of issues) {
      console.log(`- [${issue.severity}] ${issue.section}: ${issue.message}`)
    }
  }

  if (options.strict && issues.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
