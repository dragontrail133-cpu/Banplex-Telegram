import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  isUuid,
  remapRowTeamId,
  resolveBackfillAttendanceTotalPay,
  resolveBackfillExpenseTotalAmount,
  resolveLoanNominalAmounts,
  shouldBackfillAttendanceRecord,
} from './helpers.mjs'

const DEFAULT_INPUT_DIR = 'firestore-legacy-export'
const DEFAULT_BATCH_SIZE = 200

const LOAD_SEQUENCE = [
  'teams',
  'projects',
  'suppliers',
  'expense_categories',
  'funding_creditors',
  'professions',
  'staff',
  'materials',
  'workers',
  'worker_wage_rates',
  'file_assets',
  'beneficiaries',
  'hrd_applicants',
  'hrd_applicant_documents',
  'project_incomes',
  'expenses',
  'expense_line_items',
  'expense_attachments',
  'loans',
  'bills',
  'loan_payments',
  'bill_payments',
  'attendance_records',
  'stock_transactions',
  'pdf_settings',
]

const CANONICAL_TABLES = new Set(LOAD_SEQUENCE)

const TABLE_CONFLICT_TARGET = {
  pdf_settings: 'team_id',
}

const DUPLICATE_REFERENCE_FIELDS_BY_TABLE = {
  attendance_records: {
    worker_id: 'workers',
  },
  bills: {
    worker_id: 'workers',
  },
  expense_line_items: {
    material_id: 'materials',
  },
  expenses: {
    supplier_id: 'suppliers',
    category_id: 'expense_categories',
  },
  hrd_applicants: {
    source_beneficiary_id: 'beneficiaries',
  },
  loans: {
    creditor_id: 'funding_creditors',
  },
  stock_transactions: {
    material_id: 'materials',
  },
  worker_wage_rates: {
    worker_id: 'workers',
  },
}

const ALLOWED_COLUMNS_BY_TABLE = {
  teams: ['id', 'name', 'slug', 'is_active', 'created_at', 'updated_at', 'deleted_at', 'legacy_firebase_id'],
  projects: [
    'id',
    'team_id',
    'name',
    'project_type',
    'budget',
    'is_wage_assignable',
    'status',
    'notes',
    'is_active',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  suppliers: [
    'id',
    'team_id',
    'name',
    'supplier_type',
    'notes',
    'is_active',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  expense_categories: [
    'id',
    'team_id',
    'name',
    'category_group',
    'notes',
    'is_active',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  funding_creditors: [
    'id',
    'team_id',
    'name',
    'notes',
    'is_active',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  professions: ['id', 'team_id', 'profession_name', 'notes', 'created_at', 'updated_at', 'deleted_at', 'legacy_firebase_id'],
  staff: [
    'id',
    'team_id',
    'staff_name',
    'payment_type',
    'salary',
    'fee_percentage',
    'fee_amount',
    'notes',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  materials: [
    'id',
    'team_id',
    'name',
    'unit',
    'is_active',
    'current_stock',
    'category_id',
    'usage_count',
    'reorder_point',
    'notes',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  workers: [
    'id',
    'team_id',
    'name',
    'telegram_user_id',
    'is_active',
    'profession_id',
    'status',
    'default_project_id',
    'default_role_name',
    'notes',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  worker_wage_rates: [
    'id',
    'team_id',
    'worker_id',
    'project_id',
    'role_name',
    'wage_amount',
    'is_default',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  file_assets: [
    'id',
    'team_id',
    'storage_bucket',
    'bucket_name',
    'storage_path',
    'public_url',
    'mime_type',
    'original_name',
    'file_name',
    'size_bytes',
    'file_size',
    'uploaded_by_user_id',
    'uploaded_by',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  beneficiaries: [
    'id',
    'team_id',
    'legacy_firebase_id',
    'name',
    'nama_penerima',
    'institution',
    'nik',
    'jenis_kelamin',
    'jenjang',
    'nama_instansi',
    'npsn_nspp',
    'jarak_meter',
    'status',
    'data_status',
    'tempat_lahir',
    'tanggal_lahir',
    'district',
    'sub_district',
    'village',
    'hamlet',
    'rt',
    'rw',
    'alamat_lengkap',
    'notes',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  hrd_applicants: [
    'id',
    'team_id',
    'legacy_firebase_id',
    'source_beneficiary_id',
    'nama_lengkap',
    'email',
    'no_telepon',
    'jenis_kelamin',
    'nik',
    'no_kk',
    'tempat_lahir',
    'tanggal_lahir',
    'pendidikan_terakhir',
    'nama_institusi_pendidikan',
    'jurusan',
    'posisi_dilamar',
    'sumber_lowongan',
    'status_aplikasi',
    'pengalaman_kerja',
    'skills',
    'district',
    'sub_district',
    'village',
    'hamlet',
    'rt',
    'rw',
    'alamat_lengkap',
    'alamat_domisili',
    'catatan_hrd',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  hrd_applicant_documents: [
    'id',
    'team_id',
    'legacy_firebase_id',
    'applicant_id',
    'document_type',
    'file_asset_id',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  project_incomes: [
    'id',
    'team_id',
    'project_id',
    'transaction_date',
    'income_date',
    'amount',
    'description',
    'notes',
    'telegram_user_id',
    'created_by_user_id',
    'project_name_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  expenses: [
    'id',
    'team_id',
    'project_id',
    'supplier_id',
    'supplier_name',
    'category_id',
    'expense_type',
    'document_type',
    'status',
    'expense_date',
    'description',
    'notes',
    'amount',
    'total_amount',
    'telegram_user_id',
    'created_by_user_id',
    'project_name_snapshot',
    'supplier_name_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  expense_line_items: [
    'id',
    'team_id',
    'expense_id',
    'material_id',
    'item_name',
    'qty',
    'unit_price',
    'line_total',
    'sort_order',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  expense_attachments: [
    'id',
    'expense_id',
    'team_id',
    'file_asset_id',
    'sort_order',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  bills: [
    'id',
    'expense_id',
    'project_income_id',
    'telegram_user_id',
    'team_id',
    'project_id',
    'supplier_id',
    'worker_id',
    'staff_id',
    'bill_type',
    'description',
    'amount',
    'due_date',
    'status',
    'paid_amount',
    'paid_at',
    'period_start',
    'period_end',
    'supplier_name_snapshot',
    'worker_name_snapshot',
    'project_name_snapshot',
    'creditor_name_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  bill_payments: [
    'id',
    'bill_id',
    'telegram_user_id',
    'team_id',
    'amount',
    'payment_date',
    'notes',
    'worker_name_snapshot',
    'supplier_name_snapshot',
    'project_name_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  loans: [
    'id',
    'team_id',
    'telegram_user_id',
    'creditor_id',
    'transaction_date',
    'disbursed_date',
    'principal_amount',
    'amount',
    'repayment_amount',
    'interest_type',
    'status',
    'paid_amount',
    'interest_rate',
    'tenor_months',
    'notes',
    'description',
    'created_by_user_id',
    'creditor_name_snapshot',
    'late_interest_rate',
    'late_interest_basis',
    'late_penalty_type',
    'late_penalty_amount',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  loan_payments: [
    'id',
    'loan_id',
    'telegram_user_id',
    'team_id',
    'amount',
    'payment_date',
    'notes',
    'creditor_name_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  attendance_records: [
    'id',
    'telegram_user_id',
    'team_id',
    'worker_id',
    'project_id',
    'attendance_date',
    'attendance_status',
    'total_pay',
    'overtime_fee',
    'entry_mode',
    'billing_status',
    'salary_bill_id',
    'notes',
    'worker_name_snapshot',
    'project_name_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  stock_transactions: [
    'id',
    'team_id',
    'material_id',
    'project_id',
    'expense_id',
    'expense_line_item_id',
    'quantity',
    'direction',
    'source_type',
    'transaction_date',
    'price_per_unit',
    'notes',
    'created_by_user_id',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  pdf_settings: [
    'team_id',
    'header_color',
    'header_logo_file_id',
    'footer_logo_file_id',
    'company_name',
    'address',
    'phone',
    'extra',
    'updated_by_user_id',
    'updated_at',
  ],
}

const PROFILE_REFERENCE_FIELDS = new Set(['created_by_user_id', 'updated_by_user_id', 'uploaded_by_user_id'])

function parseArgs(argv) {
  const options = {
    inputDir: DEFAULT_INPUT_DIR,
    envFile: null,
    reportFile: null,
    batchSize: DEFAULT_BATCH_SIZE,
    targetTeamId: null,
    dryRun: false,
    confirmLive: false,
    strict: false,
    force: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '-h' || token === '--help') {
      options.help = true
      continue
    }

    if (token === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (token === '--strict') {
      options.strict = true
      continue
    }

    if (token === '--force') {
      options.force = true
      continue
    }

    if (token === '--confirm-live') {
      options.confirmLive = true
      continue
    }

    if (token === '--input') {
      options.inputDir = argv[++index]
      continue
    }

    if (token === '--env-file') {
      options.envFile = argv[++index]
      continue
    }

    if (token === '--report-file') {
      options.reportFile = argv[++index]
      continue
    }

    if (token === '--batch-size') {
      const batchSize = Number(argv[++index])
      if (!Number.isFinite(batchSize) || batchSize <= 0) {
        throw new Error('--batch-size harus berupa angka positif.')
      }
      options.batchSize = Math.max(1, Math.floor(batchSize))
      continue
    }

    if (token === '--target-team-id') {
      options.targetTeamId = argv[++index]
      continue
    }

    throw new Error(`Argumen tidak dikenal: ${token}`)
  }

  if (!options.inputDir) {
    throw new Error('Nilai --input tidak boleh kosong.')
  }

  if (options.targetTeamId && !isUuid(options.targetTeamId)) {
    throw new Error('--target-team-id harus berupa UUID yang valid.')
  }

  return options
}

function printUsage() {
  console.log(`Firestore canonical loader for Supabase

Usage:
  node scripts/firestore-backfill/load.mjs --input ./firestore-legacy-export --env-file ./.env.backfill

Options:
  --input <dir>         Export directory to load (default: firestore-legacy-export)
  --env-file <path>     Optional env file containing SUPABASE_URL or VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
  --report-file <path>  Output JSON report (default: <input>/meta/load-report.json)
  --batch-size <n>      Upsert batch size (default: 200)
  --target-team-id <id> Remap semua row bertanda team_id ke team existing ini dan lewati seed teams legacy
  --dry-run             Inspect artifacts and build a load report without writing to Supabase
  --confirm-live        Gate eksplisit sebelum live write boleh berjalan
  --strict              Exit non-zero when plan status is blocked or any load issue occurs
  --force               Continue even when backfill-plan status is blocked
  -h, --help            Show this help

Required env for live load:
  SUPABASE_URL or VITE_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

What it does:
  - reads canonical artifacts from extract/validate output
  - loads data into Supabase in FK-safe order
  - reconciles rows auto-generated by active triggers
  - writes meta/load-report.json with counts and remaps
`)
}

export function assertLiveWriteReady(options) {
  if (options.dryRun) {
    return
  }

  if (!options.confirmLive) {
    throw new Error('Live load membutuhkan --confirm-live sebagai gate eksplisit.')
  }
}

function chunkArray(values, size) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null))]
}

function buildArtifactWorkerWageRateLookup(artifacts) {
  const wageRateRows = artifacts.get('worker_wage_rates')?.rows ?? []
  const lookup = new Map()

  for (const row of wageRateRows) {
    const workerId = String(row?.worker_id ?? '').trim()

    if (!workerId || row?.deleted_at) {
      continue
    }

    const nextRows = lookup.get(workerId) ?? []
    nextRows.push(row)
    lookup.set(workerId, nextRows)
  }

  return lookup
}

function resolveAttendanceArtifactBaseWage(row, wageRateLookup) {
  const workerId = String(row?.worker_id ?? '').trim()
  const projectId = String(row?.project_id ?? '').trim()
  const rateRows = workerId ? wageRateLookup.get(workerId) ?? [] : []

  if (rateRows.length === 0) {
    return 0
  }

  const sortedRateRows = [...rateRows].sort((left, right) => {
    const leftProjectMatch = String(left?.project_id ?? '').trim() === projectId ? 1 : 0
    const rightProjectMatch = String(right?.project_id ?? '').trim() === projectId ? 1 : 0

    if (leftProjectMatch !== rightProjectMatch) {
      return rightProjectMatch - leftProjectMatch
    }

    const leftDefault = Number(Boolean(left?.is_default))
    const rightDefault = Number(Boolean(right?.is_default))

    if (leftDefault !== rightDefault) {
      return rightDefault - leftDefault
    }

    const createdAtComparison = String(left?.created_at ?? '').localeCompare(String(right?.created_at ?? ''))

    if (createdAtComparison !== 0) {
      return createdAtComparison
    }

    return String(left?.id ?? '').localeCompare(String(right?.id ?? ''))
  })

  for (const wageRate of sortedRateRows) {
    const wageAmount = Number(wageRate?.wage_amount ?? 0)

    if (Number.isFinite(wageAmount) && wageAmount > 0) {
      return wageAmount
    }
  }

  return 0
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
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function parseEnvText(raw) {
  const entries = {}

  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex < 0) {
      continue
    }

    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    value = value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')

    entries[key] = value
  }

  return entries
}

async function loadEnvFile(filePath) {
  if (!filePath) {
    return {}
  }

  const resolvedPath = path.resolve(filePath)
  if (!(await fileExists(resolvedPath))) {
    throw new Error(`Env file tidak ditemukan: ${resolvedPath}`)
  }

  return parseEnvText(await fs.readFile(resolvedPath, 'utf8'))
}

function mergeEnv(fileEnv) {
  return {
    ...fileEnv,
    ...process.env,
  }
}

function createEmptyTableReport(table, artifactPath, rowCount) {
  return {
    table,
    artifact_path: artifactPath,
    row_count: rowCount,
    attempted: 0,
    loaded: 0,
    remapped: 0,
    skipped: 0,
    dry_run: false,
    status: rowCount > 0 ? 'pending' : 'skipped',
    notes: [],
    errors: [],
  }
}

function createLoadReportSkeleton(options, manifest, plan, artifacts) {
  const report = {
    generated_at: new Date().toISOString(),
    input_dir: path.resolve(options.inputDir),
    env_file: options.envFile ? path.resolve(options.envFile) : null,
    dry_run: options.dryRun,
    force: options.force,
    manifest: {
      project_id: manifest.project_id ?? null,
      global_team_path: manifest.global_team_path ?? null,
      root_collections: Array.isArray(manifest.root_collections) ? manifest.root_collections : [],
      target_team_id: options.targetTeamId ?? null,
    },
    plan: plan
      ? {
          status: plan.status ?? null,
          file: plan.plan_file ?? null,
          issues: Array.isArray(plan.issues) ? plan.issues.length : 0,
          warnings: Array.isArray(plan.warnings) ? plan.warnings.length : 0,
        }
      : null,
    summary: {
      total_tables: LOAD_SEQUENCE.length,
      total_rows: 0,
      total_loaded: 0,
      total_remapped: 0,
      total_skipped: 0,
      blocking_issues: 0,
      warnings: 0,
    },
    remaps: {
      team_rows: 0,
      bills: [],
      bill_payments: [],
      stock_transactions: [],
    },
    team_remap: {
      enabled: Boolean(options.targetTeamId),
      source_team_id: null,
      target_team_id: options.targetTeamId ?? null,
      row_count: 0,
    },
    tables: {},
    warnings: [],
    issues: [],
  }

  for (const table of LOAD_SEQUENCE) {
    const artifact = artifacts.get(table)
    const rowCount = artifact?.rows.length ?? 0
    report.tables[table] = createEmptyTableReport(table, artifact?.filePath ?? null, rowCount)
    report.summary.total_rows += rowCount
  }

  return report
}

async function loadArtifacts(inputDir, manifest) {
  const artifacts = new Map()
  const canonicalEntries = Array.isArray(manifest.canonical) ? manifest.canonical : []

  for (const entry of canonicalEntries) {
    const table = entry.table ?? null
    if (!table || !CANONICAL_TABLES.has(table)) {
      continue
    }

    const filePath = path.resolve(inputDir, entry.output_file)
    const artifact = await readJson(filePath)
    artifacts.set(table, {
      table,
      filePath,
      outputFile: entry.output_file,
      domain: artifact.domain ?? entry.group ?? null,
      rows: Array.isArray(artifact.rows) ? artifact.rows : [],
      rowCount: artifact.row_count ?? null,
    })
  }

  return artifacts
}

function sanitizeRow(table, row, overrides = {}) {
  const allowedColumns = ALLOWED_COLUMNS_BY_TABLE[table]
  if (!allowedColumns) {
    throw new Error(`Tidak ada whitelist kolom untuk tabel ${table}`)
  }

  const source = { ...row, ...overrides }

  if (table === 'beneficiaries') {
    if (!Object.prototype.hasOwnProperty.call(source, 'name') && source.nama_penerima != null) {
      source.name = source.nama_penerima
    }

    if (!Object.prototype.hasOwnProperty.call(source, 'institution') && source.nama_instansi != null) {
      source.institution = source.nama_instansi
    }
  }

  if (table === 'expenses') {
    if (!Object.prototype.hasOwnProperty.call(source, 'supplier_name') && source.supplier_name_snapshot != null) {
      source.supplier_name = source.supplier_name_snapshot
    }
  }

  const sanitized = {}

  for (const columnName of allowedColumns) {
    if (!(columnName in source)) {
      continue
    }

    let value = source[columnName]

    if (PROFILE_REFERENCE_FIELDS.has(columnName) && !isUuid(value)) {
      value = null
    }

    if (columnName === 'extra' && value != null && typeof value !== 'object') {
      value = null
    }

    if (value !== undefined) {
      sanitized[columnName] = value
    }
  }

  return sanitized
}

function applyTargetTeamRemap(row, options, report, { countRemap = true } = {}) {
  if (!report.team_remap.enabled) {
    return row
  }

  const { row: remappedRow, remapped, legacyTeamId } = remapRowTeamId(row, options.targetTeamId)

  if (remapped && countRemap) {
    report.team_remap.row_count += 1
    report.remaps.team_rows += 1
    if (report.team_remap.source_team_id == null) {
      report.team_remap.source_team_id = legacyTeamId ?? null
    }
  }

  return remappedRow
}

export function buildDuplicateAliasMaps(validationReport) {
  const aliasMaps = new Map()
  const duplicateKeys = Array.isArray(validationReport?.duplicateKeys) ? validationReport.duplicateKeys : []

  for (const entry of duplicateKeys) {
    const tableName = entry?.table ?? null
    const canonicalId = entry?.first ?? null
    const duplicateId = entry?.duplicate ?? null

    if (!tableName || !canonicalId || !duplicateId || canonicalId === duplicateId) {
      continue
    }

    if (!aliasMaps.has(tableName)) {
      aliasMaps.set(tableName, new Map())
    }

    aliasMaps.get(tableName).set(duplicateId, canonicalId)
  }

  return aliasMaps
}

export function resolveAliasId(aliasMap, value) {
  if (!(aliasMap instanceof Map) || value == null) {
    return value
  }

  let resolvedValue = value
  const visitedValues = new Set()

  while (aliasMap.has(resolvedValue) && !visitedValues.has(resolvedValue)) {
    visitedValues.add(resolvedValue)
    resolvedValue = aliasMap.get(resolvedValue)
  }

  return resolvedValue
}

export function shouldSkipDuplicateRow(table, row, duplicateAliasMaps) {
  if (!row || typeof row !== 'object' || row.id == null) {
    return false
  }

  const tableAliasMaps = duplicateAliasMaps instanceof Map ? duplicateAliasMaps : new Map()
  const tableAliasMap = tableAliasMaps.get(table)
  return Boolean(tableAliasMap && tableAliasMap.has(row.id))
}

export function applyDuplicateReferenceRemaps(table, row, duplicateAliasMaps) {
  if (!row || typeof row !== 'object') {
    return {
      row,
      remapped: false,
      remaps: [],
    }
  }

  const fieldAliases = DUPLICATE_REFERENCE_FIELDS_BY_TABLE[table]
  if (!fieldAliases) {
    return {
      row,
      remapped: false,
      remaps: [],
    }
  }

  const tableAliasMaps = duplicateAliasMaps instanceof Map ? duplicateAliasMaps : new Map()
  let remappedRow = row
  const remaps = []

  for (const [fieldName, sourceTable] of Object.entries(fieldAliases)) {
    const sourceAliasMap = tableAliasMaps.get(sourceTable)
    if (!(fieldName in remappedRow) || !(sourceAliasMap instanceof Map)) {
      continue
    }

    const sourceValue = remappedRow[fieldName]
    const resolvedValue = resolveAliasId(sourceAliasMap, sourceValue)

    if (resolvedValue === sourceValue) {
      continue
    }

    if (remappedRow === row) {
      remappedRow = { ...row }
    }

    remappedRow[fieldName] = resolvedValue
    remaps.push({
      field: fieldName,
      source_table: sourceTable,
      legacy_id: sourceValue,
      actual_id: resolvedValue,
    })
  }

  return {
    row: remappedRow,
    remapped: remaps.length > 0,
    remaps,
  }
}

export function buildIdMapLookups(idMap) {
  const canonicalEntryById = new Map()
  const canonicalIdByLegacyPath = new Map()
  const parentCanonicalIdByChildCanonicalId = new Map()
  const parentLegacyPathByChildCanonicalId = new Map()
  const entries = Array.isArray(idMap) ? idMap : []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const canonicalId = entry.canonical_id ?? null
    const legacyPath = entry.legacy_firebase_path ?? null

    if (!canonicalId) {
      continue
    }

    canonicalEntryById.set(canonicalId, entry)

    if (legacyPath) {
      canonicalIdByLegacyPath.set(legacyPath, canonicalId)
    }
  }

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue
    }

    const childCanonicalId = entry.canonical_id ?? null
    const parentLegacyPath = entry.parent_legacy_path ?? getLegacyParentDocumentPath(entry.legacy_firebase_path)

    if (!childCanonicalId || !parentLegacyPath) {
      continue
    }

    const parentCanonicalId = canonicalIdByLegacyPath.get(parentLegacyPath) ?? null
    if (!parentCanonicalId) {
      continue
    }

    parentCanonicalIdByChildCanonicalId.set(childCanonicalId, parentCanonicalId)
    parentLegacyPathByChildCanonicalId.set(childCanonicalId, parentLegacyPath)
  }

  return {
    canonicalEntryById,
    canonicalIdByLegacyPath,
    parentCanonicalIdByChildCanonicalId,
    parentLegacyPathByChildCanonicalId,
  }
}

function getLegacyParentDocumentPath(legacyPath) {
  if (typeof legacyPath !== 'string') {
    return null
  }

  const segments = legacyPath
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length < 4) {
    return null
  }

  return segments.slice(0, -2).join('/')
}

export function resolveParentCanonicalId(idMapLookups, childCanonicalId) {
  if (!idMapLookups || childCanonicalId == null) {
    return null
  }

  return idMapLookups.parentCanonicalIdByChildCanonicalId?.get(childCanonicalId) ?? null
}

export function resolveParentLegacyPath(idMapLookups, childCanonicalId) {
  if (!idMapLookups || childCanonicalId == null) {
    return null
  }

  return idMapLookups.parentLegacyPathByChildCanonicalId?.get(childCanonicalId) ?? null
}

function prepareRowForLoad(table, row, options, report, duplicateAliasMaps, { countTeamRemap = true } = {}) {
  if (shouldSkipDuplicateRow(table, row, duplicateAliasMaps)) {
    return {
      row: null,
      remapped: false,
      duplicateSkipped: true,
      duplicateRemaps: [],
    }
  }

  const teamRemappedRow = applyTargetTeamRemap(row, options, report, { countRemap: countTeamRemap })
  const { row: aliasRemappedRow, remapped, remaps } = applyDuplicateReferenceRemaps(
    table,
    teamRemappedRow,
    duplicateAliasMaps
  )

  return {
    row: aliasRemappedRow,
    remapped,
    duplicateSkipped: false,
    duplicateRemaps: remaps,
  }
}

function resolveBillDueDate(row) {
  if (!row || typeof row !== 'object') {
    return null
  }

  if (row.due_date != null) {
    return row.due_date
  }

  if (typeof row.created_at === 'string' && row.created_at.length >= 10) {
    return row.created_at.slice(0, 10)
  }

  return null
}

function isMissingAttendanceOvertimeFeeError(error) {
  const message = error instanceof Error ? error.message : String(error)
  const normalizedMessage = message.toLowerCase()

  return normalizedMessage.includes('attendance_records') && normalizedMessage.includes('overtime_fee')
}

function stripAttendanceOvertimeFee(row) {
  if (!row || typeof row !== 'object' || !Object.prototype.hasOwnProperty.call(row, 'overtime_fee')) {
    return row
  }

  const nextRow = { ...row }
  delete nextRow.overtime_fee
  return nextRow
}

function isAttendanceStatusConstraintError(error) {
  const message = error instanceof Error ? error.message : String(error)
  const normalizedMessage = message.toLowerCase()

  return normalizedMessage.includes('attendance_records_attendance_status_check')
}

function buildAbsentAttendanceStatusError() {
  return new Error(
    'attendance_records.attendance_status masih menolak "absent". Terapkan migration supabase/migrations/20260421120000_allow_absent_attendance_status.sql lalu jalankan ulang load.'
  )
}

async function upsertRows(client, table, rows, options) {
  const {
    batchSize,
    dryRun,
    reportEntry,
  } = options

  if (rows.length === 0) {
    reportEntry.status = 'skipped'
    reportEntry.dry_run = dryRun
    return
  }

  reportEntry.attempted = rows.length
  reportEntry.dry_run = dryRun

  if (dryRun) {
    reportEntry.loaded = rows.length
    reportEntry.status = 'dry-run'
    return
  }

  const conflictTarget = TABLE_CONFLICT_TARGET[table] ?? 'id'
  let loaded = 0

  for (const batch of chunkArray(rows, batchSize)) {
    const { error } = await client
      .from(table)
      .upsert(batch, { onConflict: conflictTarget, ignoreDuplicates: false })

    if (error) {
      throw new Error(`${table}: ${error.message}`)
    }

    loaded += batch.length
  }

  reportEntry.loaded = loaded
  reportEntry.status = 'loaded'
}

async function fetchExistingBillsByExpense(client, expenseIds) {
  const result = new Map()
  const ids = unique(expenseIds)
  if (ids.length === 0) {
    return result
  }

  for (const chunk of chunkArray(ids, 200)) {
    const { data, error } = await client
      .from('bills')
      .select('id, expense_id, project_income_id, staff_id')
      .in('expense_id', chunk)

    if (error) {
      throw new Error(`Gagal membaca bill by expense_id: ${error.message}`)
    }

    for (const row of data ?? []) {
      if (row?.expense_id) {
        result.set(row.expense_id, row)
      }
    }
  }

  return result
}

async function fetchExistingBillsByProjectIncome(client, projectIncomeIds) {
  const result = new Map()
  const ids = unique(projectIncomeIds)
  if (ids.length === 0) {
    return result
  }

  for (const chunk of chunkArray(ids, 200)) {
    const { data, error } = await client
      .from('bills')
      .select('id, project_income_id, staff_id, expense_id')
      .in('project_income_id', chunk)

    if (error) {
      throw new Error(`Gagal membaca bill by project_income_id: ${error.message}`)
    }

    for (const row of data ?? []) {
      if (row?.project_income_id && row?.staff_id) {
        result.set(`${row.project_income_id}::${row.staff_id}`, row)
      }
    }
  }

  return result
}

async function fetchExistingBillPayments(client, billIds) {
  const byBillId = new Map()
  const ids = unique(billIds)
  if (ids.length === 0) {
    return byBillId
  }

  for (const chunk of chunkArray(ids, 200)) {
    const { data, error } = await client
      .from('bill_payments')
      .select('id, bill_id, amount, payment_date, notes')
      .in('bill_id', chunk)

    if (error) {
      throw new Error(`Gagal membaca bill_payments: ${error.message}`)
    }

    for (const row of data ?? []) {
      if (!row?.bill_id) {
        continue
      }

      if (!byBillId.has(row.bill_id)) {
        byBillId.set(row.bill_id, [])
      }

      byBillId.get(row.bill_id).push(row)
    }
  }

  return byBillId
}

async function fetchExistingStockTransactions(client, expenseLineItemIds) {
  const result = new Map()
  const ids = unique(expenseLineItemIds)
  if (ids.length === 0) {
    return result
  }

  for (const chunk of chunkArray(ids, 200)) {
    const { data, error } = await client
      .from('stock_transactions')
      .select('id, expense_line_item_id')
      .in('expense_line_item_id', chunk)

    if (error) {
      throw new Error(`Gagal membaca stock_transactions: ${error.message}`)
    }

    for (const row of data ?? []) {
      if (row?.expense_line_item_id) {
        result.set(row.expense_line_item_id, row)
      }
    }
  }

  return result
}

async function resolveDefaultTelegramUserId(client, teamId) {
  if (!client || !teamId) {
    return null
  }

  const { data, error } = await client
    .from('team_members')
    .select('telegram_user_id, is_default')
    .eq('team_id', teamId)
    .order('is_default', { ascending: false })
    .order('telegram_user_id', { ascending: true })
    .limit(1)

  if (error) {
    throw new Error(`Gagal membaca default telegram_user_id workspace: ${error.message}`)
  }

  const fallbackTelegramUserId = data?.[0]?.telegram_user_id ?? null
  if (!fallbackTelegramUserId) {
    throw new Error(`Tidak menemukan telegram_user_id default untuk team ${teamId}.`)
  }

  return fallbackTelegramUserId
}

function findMatchingExistingBillPayment(existingRows, canonicalRow, claimedIds) {
  const available = existingRows.filter((row) => !claimedIds.has(row.id))
  if (available.length === 0) {
    return null
  }

  const normalizedNotes = canonicalRow.notes ?? canonicalRow.description ?? null
  const exact = available.find(
    (row) =>
      row.amount === canonicalRow.amount &&
      row.payment_date === canonicalRow.payment_date &&
      (row.notes ?? null) === normalizedNotes
  )
  if (exact) {
    return exact
  }

  const byAmountAndDate = available.find(
    (row) => row.amount === canonicalRow.amount && row.payment_date === canonicalRow.payment_date
  )
  if (byAmountAndDate) {
    return byAmountAndDate
  }

  const byAmountOnly = available.find((row) => row.amount === canonicalRow.amount)
  return byAmountOnly ?? null
}

function findMatchingLoanForPayment(loans, paymentRow) {
  const creditorName = paymentRow?.creditor_name_snapshot ?? null
  const paymentAmount = paymentRow?.amount ?? null

  const candidates = loans.filter((row) => row.creditor_name_snapshot != null && row.creditor_name_snapshot === creditorName)
  if (candidates.length === 0) {
    return null
  }

  if (candidates.length === 1) {
    return candidates[0]
  }

  const amountMatch = candidates.find(
    (row) =>
      row.paid_amount === paymentAmount ||
      row.repayment_amount === paymentAmount ||
      row.amount === paymentAmount
  )

  return amountMatch ?? candidates[0]
}

async function loadSimpleTable(client, artifacts, report, options, duplicateAliasMaps, table) {
  const artifact = artifacts.get(table)
  const entry = report.tables[table]
  if (!artifact) {
    entry.status = 'skipped'
    entry.notes.push('Artifact canonical tidak ditemukan.')
    return
  }

  if (table === 'teams' && options.targetTeamId) {
    entry.status = 'skipped'
    entry.skipped = artifact.rows.length
    entry.notes.push('Seed teams legacy dilewati karena --target-team-id aktif.')
    return
  }

  const rows = []
  let remappedRows = 0
  let skippedRows = 0
  let loanNominalRepairRows = 0
  let loanNominalUnresolvedRows = 0

  for (const row of artifact.rows) {
    const prepared = prepareRowForLoad(table, row, options, report, duplicateAliasMaps)
    if (prepared.duplicateSkipped) {
      skippedRows += 1
      continue
    }

    if (prepared.remapped) {
      remappedRows += 1
    }

    const overrides = {}
    if (
      table === 'expenses' &&
      prepared.row.telegram_user_id == null &&
      options.telegramUserIdFallback
    ) {
      overrides.telegram_user_id = options.telegramUserIdFallback
    }

    if (table === 'expenses') {
      overrides.total_amount = resolveBackfillExpenseTotalAmount({
        amount: prepared.row.amount,
        totalAmount: prepared.row.totalAmount,
        total_amount: prepared.row.total_amount,
      })
    }

    if (table === 'loans') {
      const loanNominal = resolveLoanNominalAmounts({
        principalAmount: prepared.row.principal_amount,
        amount: prepared.row.amount,
        repaymentAmount: prepared.row.repayment_amount,
        interestType: prepared.row.interest_type,
      })

      if (
        loanNominal.principal_amount !== prepared.row.principal_amount ||
        loanNominal.amount !== prepared.row.amount ||
        loanNominal.repayment_amount !== prepared.row.repayment_amount
      ) {
        loanNominalRepairRows += 1
      }

      if (
        loanNominal.principal_amount <= 0 ||
        loanNominal.amount <= 0
      ) {
        loanNominalUnresolvedRows += 1
      }

      overrides.principal_amount = loanNominal.principal_amount
      overrides.amount = loanNominal.amount
      overrides.repayment_amount = loanNominal.repayment_amount
    }

    rows.push(sanitizeRow(table, prepared.row, overrides))
  }

  entry.remapped = remappedRows
  entry.skipped = skippedRows
  if (skippedRows > 0) {
    entry.notes.push(`${skippedRows} duplicate row dilewati berdasarkan validation-report alias.`)
  }
  if (remappedRows > 0) {
    entry.notes.push(`${remappedRows} row memiliki foreign key yang diremap ke canonical alias.`)
  }
  if (table === 'loans' && loanNominalRepairRows > 0) {
    entry.notes.push(
      `${loanNominalRepairRows} loan nominal diselaraskan dari totalAmount legacy atau repayment_amount untuk loan non-interest.`
    )
  }
  if (table === 'loans' && loanNominalUnresolvedRows > 0) {
    report.issues.push({
      scope: 'loans',
      message:
        `${loanNominalUnresolvedRows} loan masih tanpa nominal pokok valid. Regenerasi artifact dari raw snapshot agar totalAmount legacy ikut termap.`,
    })
  }

  await upsertRows(client, table, rows, {
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    reportEntry: entry,
  })
}

async function loadBills(client, artifacts, report, options, duplicateAliasMaps, state) {
  const artifact = artifacts.get('bills')
  const entry = report.tables.bills

  if (!artifact) {
    entry.status = 'skipped'
    entry.notes.push('Artifact canonical tidak ditemukan.')
    return
  }

  const canonicalRows = artifact.rows
  const expenseBillMap = options.dryRun
    ? new Map()
    : await fetchExistingBillsByExpense(
        client,
        canonicalRows.map((row) => row.expense_id).filter(Boolean)
      )
  const feeBillMap = options.dryRun
    ? new Map()
    : await fetchExistingBillsByProjectIncome(
        client,
        canonicalRows.map((row) => row.project_income_id).filter(Boolean)
      )

  let remapped = 0
  const loadRows = []

  for (const row of canonicalRows) {
    let targetId = row.id
    let rowChanged = false
    const dueDate = resolveBillDueDate(row)

    if (row.expense_id && expenseBillMap.has(row.expense_id)) {
      targetId = expenseBillMap.get(row.expense_id).id
    } else if (row.project_income_id && row.staff_id) {
      const key = `${row.project_income_id}::${row.staff_id}`
      if (feeBillMap.has(key)) {
        targetId = feeBillMap.get(key).id
      }
    }

    if (targetId !== row.id) {
      rowChanged = true
      state.billIdMap.set(row.id, targetId)
      report.remaps.bills.push({
        legacy_id: row.id,
        actual_id: targetId,
        expense_id: row.expense_id ?? null,
        project_income_id: row.project_income_id ?? null,
        staff_id: row.staff_id ?? null,
      })
    } else {
      state.billIdMap.set(row.id, row.id)
    }

    if (dueDate !== row.due_date) {
      rowChanged = true
    }

    const prepared = prepareRowForLoad('bills', row, options, report, duplicateAliasMaps)
    if (prepared.duplicateSkipped) {
      entry.skipped += 1
      continue
    }

    if (prepared.remapped) {
      rowChanged = true
    }

    if (rowChanged) {
      remapped += 1
    }

    loadRows.push(sanitizeRow('bills', prepared.row, { id: targetId, due_date: dueDate }))
  }

  entry.remapped = remapped
  if (remapped > 0) {
    entry.notes.push(`${remapped} canonical bill diarahkan ke row hasil trigger yang sudah ada.`)
  }

  await upsertRows(client, 'bills', loadRows, {
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    reportEntry: entry,
  })

  state.billCanonicalRows = canonicalRows
}

async function loadLoanPayments(client, artifacts, report, options, duplicateAliasMaps, state) {
  const artifact = artifacts.get('loan_payments')
  const entry = report.tables.loan_payments

  if (!artifact) {
    entry.status = 'skipped'
    entry.notes.push('Artifact canonical tidak ditemukan.')
    return
  }

  const canonicalRows = artifact.rows
  const loadRows = []
  let remapped = 0

  for (const row of canonicalRows) {
    const prepared = prepareRowForLoad('loan_payments', row, options, report, duplicateAliasMaps)
    if (prepared.duplicateSkipped) {
      entry.skipped += 1
      continue
    }

    const parentCanonicalId = resolveParentCanonicalId(state.idMapLookups, row.id)
    const targetLoanId =
      state.loanIdMap?.get(parentCanonicalId ?? row.loan_id ?? null) ??
      parentCanonicalId ??
      row.loan_id ??
      findMatchingLoanForPayment(state.loanCanonicalRows ?? [], row)?.id ??
      null

    if (!targetLoanId) {
      throw new Error(
        `loan_payments: tidak menemukan loan_id untuk pembayaran ${row.id} (${row.creditor_name_snapshot ?? 'tanpa creditor snapshot'})`
      )
    }

    if (targetLoanId !== row.loan_id || prepared.remapped) {
      remapped += 1
    }

    loadRows.push(
      sanitizeRow('loan_payments', prepared.row, {
        loan_id: targetLoanId,
        notes: row.notes ?? row.description ?? null,
      })
    )
  }

  entry.remapped = remapped
  if (remapped > 0) {
    entry.notes.push(`${remapped} loan payment diarahkan ke loan canonical yang sesuai.`)
  }

  await upsertRows(client, 'loan_payments', loadRows, {
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    reportEntry: entry,
  })
}

async function finalizeBills(client, report, options, duplicateAliasMaps, state) {
  const canonicalRows = state.billCanonicalRows ?? []
  if (canonicalRows.length === 0) {
    return
  }

  const exactRows = canonicalRows.map((row) => {
    const prepared = prepareRowForLoad('bills', row, options, report, duplicateAliasMaps, {
      countTeamRemap: false,
    })

    if (prepared.duplicateSkipped) {
      return null
    }

    return sanitizeRow('bills', prepared.row, {
      id: state.billIdMap.get(row.id) ?? row.id,
      due_date: resolveBillDueDate(row),
    })
  }).filter(Boolean)

  if (options.dryRun) {
    report.tables.bills.notes.push('Dry run: final bill reapply dilewati.')
    return
  }

  const conflictTarget = TABLE_CONFLICT_TARGET.bills ?? 'id'
  for (const batch of chunkArray(exactRows, options.batchSize)) {
    const { error } = await client.from('bills').upsert(batch, {
      onConflict: conflictTarget,
      ignoreDuplicates: false,
    })

    if (error) {
      throw new Error(`finalize bills: ${error.message}`)
    }
  }

  report.tables.bills.notes.push('Canonical bill values di-apply ulang setelah bill_payments untuk menjaga histori exact.')
}

async function loadBillPayments(client, artifacts, report, options, duplicateAliasMaps, state) {
  const artifact = artifacts.get('bill_payments')
  const entry = report.tables.bill_payments

  if (!artifact) {
    entry.status = 'skipped'
    entry.notes.push('Artifact canonical tidak ditemukan.')
    return
  }

  const canonicalRows = artifact.rows
  const billIds = canonicalRows
    .map((row) => {
      const parentCanonicalId = resolveParentCanonicalId(state.idMapLookups, row.id)
      const canonicalBillId = parentCanonicalId ?? row.bill_id ?? null
      return state.billIdMap.get(canonicalBillId) ?? canonicalBillId
    })
    .filter(Boolean)
  const existingByBillId = options.dryRun ? new Map() : await fetchExistingBillPayments(client, billIds)
  const claimedExistingIds = new Set()
  const loadRows = []
  let remapped = 0

  for (const row of canonicalRows) {
    const parentCanonicalId = resolveParentCanonicalId(state.idMapLookups, row.id)
    const canonicalBillId = parentCanonicalId ?? row.bill_id ?? null
    const remappedBillId = state.billIdMap.get(canonicalBillId) ?? canonicalBillId

    if (!remappedBillId) {
      throw new Error(
        `bill_payments: tidak menemukan bill_id untuk pembayaran ${row.id} (${row.description ?? row.notes ?? 'tanpa deskripsi'})`
      )
    }

    const existingRows = existingByBillId.get(remappedBillId) ?? []
    const existingMatch = findMatchingExistingBillPayment(existingRows, row, claimedExistingIds)
    const targetId = existingMatch?.id ?? row.id
    const prepared = prepareRowForLoad('bill_payments', row, options, report, duplicateAliasMaps)
    let rowChanged = false

    if (existingMatch) {
      claimedExistingIds.add(existingMatch.id)
    }

    if (targetId !== row.id) {
      rowChanged = true
      report.remaps.bill_payments.push({
        legacy_id: row.id,
        actual_id: targetId,
        legacy_bill_id: canonicalBillId ?? null,
        actual_bill_id: remappedBillId ?? null,
      })
    }

    if (prepared.duplicateSkipped) {
      entry.skipped += 1
      continue
    }

    if (prepared.remapped) {
      rowChanged = true
    }

    if (rowChanged) {
      remapped += 1
    }

    const sanitized = sanitizeRow('bill_payments', prepared.row, {
      id: targetId,
      bill_id: remappedBillId,
      notes: row.notes ?? row.description ?? null,
    })

    loadRows.push(sanitized)
  }

  entry.remapped = remapped
  if (remapped > 0) {
    entry.notes.push(`${remapped} canonical bill payment diarahkan ke row hasil trigger yang sudah ada.`)
  }

  await upsertRows(client, 'bill_payments', loadRows, {
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    reportEntry: entry,
  })
}

async function finalizeLoans(client, artifacts, report, options, duplicateAliasMaps) {
  const artifact = artifacts.get('loans')
  if (!artifact || artifact.rows.length === 0) {
    return
  }

  if (options.dryRun) {
    report.tables.loans.notes.push('Dry run: final loan reapply dilewati.')
    return
  }

  const exactRows = artifact.rows
    .map((row) => {
      const prepared = prepareRowForLoad('loans', row, options, report, duplicateAliasMaps, {
        countTeamRemap: false,
      })

      if (prepared.duplicateSkipped) {
        return null
      }

      const loanNominal = resolveLoanNominalAmounts({
        principalAmount: prepared.row.principal_amount,
        amount: prepared.row.amount,
        repaymentAmount: prepared.row.repayment_amount,
        interestType: prepared.row.interest_type,
      })

      return sanitizeRow('loans', prepared.row, loanNominal)
    })
    .filter(Boolean)
  const conflictTarget = TABLE_CONFLICT_TARGET.loans ?? 'id'

  for (const batch of chunkArray(exactRows, options.batchSize)) {
    const { error } = await client.from('loans').upsert(batch, {
      onConflict: conflictTarget,
      ignoreDuplicates: false,
    })

    if (error) {
      throw new Error(`finalize loans: ${error.message}`)
    }
  }

  report.tables.loans.notes.push('Canonical loan values di-apply ulang setelah loan_payments untuk menjaga histori exact.')
}

async function loadAttendanceRecords(client, artifacts, report, options, duplicateAliasMaps, state) {
  const artifact = artifacts.get('attendance_records')
  const entry = report.tables.attendance_records

  if (!artifact) {
    entry.status = 'skipped'
    entry.notes.push('Artifact canonical tidak ditemukan.')
    return
  }

  const rows = []
  const wageRateLookup = buildArtifactWorkerWageRateLookup(artifacts)
  let remappedRows = 0
  let skippedRows = 0
  let skippedMissingProjectRows = 0
  let repairedCompensationRows = 0

  for (const row of artifact.rows) {
    const prepared = prepareRowForLoad('attendance_records', row, options, report, duplicateAliasMaps)
    if (prepared.duplicateSkipped) {
      skippedRows += 1
      continue
    }

    if (prepared.remapped) {
      remappedRows += 1
    }

    const canonicalBillId = prepared.row.salary_bill_id ?? row.salary_bill_id ?? null
    const remappedBillId = canonicalBillId ? state.billIdMap.get(canonicalBillId) ?? canonicalBillId : null
    if (!shouldBackfillAttendanceRecord({ projectId: prepared.row.project_id })) {
      skippedMissingProjectRows += 1
      continue
    }

    const resolvedTotalPay = resolveBackfillAttendanceTotalPay({
      attendanceStatus: prepared.row.attendance_status,
      totalPay: prepared.row.total_pay,
      baseWage: resolveAttendanceArtifactBaseWage(prepared.row, wageRateLookup),
      overtimeFee: prepared.row.overtime_fee,
    })
    const currentTotalPay = Number(prepared.row.total_pay ?? 0)
    const shouldRepairCompensation =
      resolvedTotalPay > 0 && (!Number.isFinite(currentTotalPay) || currentTotalPay <= 0)

    if (shouldRepairCompensation) {
      repairedCompensationRows += 1
    }

    rows.push(
      sanitizeRow('attendance_records', prepared.row, {
        salary_bill_id: remappedBillId,
        ...(shouldRepairCompensation ? { total_pay: resolvedTotalPay } : {}),
      })
    )
  }

  entry.remapped = remappedRows
  entry.skipped = skippedRows
  if (remappedRows > 0) {
    entry.notes.push(`${remappedRows} attendance record memiliki foreign key yang diremap ke canonical alias.`)
  }
  if (skippedRows > 0) {
    entry.notes.push(`${skippedRows} duplicate attendance record dilewati berdasarkan validation-report alias.`)
  }
  if (skippedMissingProjectRows > 0) {
    entry.notes.push(
      `${skippedMissingProjectRows} attendance record tanpa project_id legacy dilewati agar backfill hanya memuat kehadiran per proyek.`
    )
  }
  if (repairedCompensationRows > 0) {
    entry.notes.push(
      `${repairedCompensationRows} attendance record mewarisi nominal upah dari worker_wage_rates karena total_pay legacy kosong atau nol.`
    )
  }

  try {
    await upsertRows(client, 'attendance_records', rows, {
      batchSize: options.batchSize,
      dryRun: options.dryRun,
      reportEntry: entry,
    })
    await softDeleteStaleLegacyAttendanceRows(client, rows, entry, options)
  } catch (error) {
    if (options.dryRun) {
      throw error
    }

    if (isMissingAttendanceOvertimeFeeError(error)) {
      const fallbackRows = rows.map((row) => stripAttendanceOvertimeFee(row))
      try {
        await upsertRows(client, 'attendance_records', fallbackRows, {
          batchSize: options.batchSize,
          dryRun: options.dryRun,
          reportEntry: entry,
        })
        await softDeleteStaleLegacyAttendanceRows(client, fallbackRows, entry, options)
      } catch (retryError) {
        if (isAttendanceStatusConstraintError(retryError)) {
          throw buildAbsentAttendanceStatusError()
        }

        throw retryError
      }

      report.tables.attendance_records.notes.push(
        'Live schema cache belum memuat overtime_fee; field di-drop saat backfill attendance_records.'
      )
      return
    }

    if (isAttendanceStatusConstraintError(error)) {
      throw buildAbsentAttendanceStatusError()
    }

    throw error
  }
}

async function softDeleteStaleLegacyAttendanceRows(client, rows, entry, options) {
  if (options.dryRun || !options.targetTeamId) {
    return
  }

  const canonicalIds = new Set(rows.map((row) => String(row?.id ?? '').trim()).filter(Boolean))

  if (canonicalIds.size === 0) {
    return
  }

  const activeLegacyRows = []
  const pageSize = 1000

  for (let fromIndex = 0; ; fromIndex += pageSize) {
    const toIndex = fromIndex + pageSize - 1
    const { data, error } = await client
      .from('attendance_records')
      .select('id')
      .eq('team_id', options.targetTeamId)
      .not('legacy_firebase_id', 'is', null)
      .is('deleted_at', null)
      .order('id', { ascending: true })
      .range(fromIndex, toIndex)

    if (error) {
      throw new Error(`cleanup attendance_records stale rows: ${error.message}`)
    }

    const pageRows = data ?? []

    if (pageRows.length === 0) {
      break
    }

    activeLegacyRows.push(...pageRows)

    if (pageRows.length < pageSize) {
      break
    }
  }

  const staleIds = activeLegacyRows
    .map((row) => String(row?.id ?? '').trim())
    .filter((id) => id && !canonicalIds.has(id))

  if (staleIds.length === 0) {
    return
  }

  const deletedAt = new Date().toISOString()

  for (const batch of chunkArray(staleIds, options.batchSize)) {
    const { error: updateError } = await client
      .from('attendance_records')
      .update({
        deleted_at: deletedAt,
        updated_at: deletedAt,
      })
      .in('id', batch)

    if (updateError) {
      throw new Error(`cleanup attendance_records stale rows: ${updateError.message}`)
    }
  }

  entry.notes.push(
    `${staleIds.length} attendance record legacy lama di-soft-delete karena tidak lagi ada di artifact canonical.`
  )
}

async function loadStockTransactions(client, artifacts, report, options, duplicateAliasMaps) {
  const artifact = artifacts.get('stock_transactions')
  const entry = report.tables.stock_transactions

  if (!artifact) {
    entry.status = 'skipped'
    entry.notes.push('Artifact canonical tidak ditemukan.')
    return
  }

  const canonicalRows = artifact.rows
  const existingMap = options.dryRun
    ? new Map()
    : await fetchExistingStockTransactions(
        client,
        canonicalRows.map((row) => row.expense_line_item_id).filter(Boolean)
      )
  const loadRows = []
  let remapped = 0

  for (const row of canonicalRows) {
    const targetId =
      row.expense_line_item_id && existingMap.has(row.expense_line_item_id)
        ? existingMap.get(row.expense_line_item_id).id
        : row.id
    const prepared = prepareRowForLoad('stock_transactions', row, options, report, duplicateAliasMaps)
    let rowChanged = false

    if (targetId !== row.id) {
      rowChanged = true
      report.remaps.stock_transactions.push({
        legacy_id: row.id,
        actual_id: targetId,
        expense_line_item_id: row.expense_line_item_id ?? null,
      })
    }

    if (prepared.duplicateSkipped) {
      entry.skipped += 1
      continue
    }

    if (prepared.remapped) {
      rowChanged = true
    }

    if (rowChanged) {
      remapped += 1
    }

    loadRows.push(
      sanitizeRow('stock_transactions', prepared.row, {
        id: targetId,
      })
    )
  }

  entry.remapped = remapped
  if (remapped > 0) {
    entry.notes.push(`${remapped} stock transaction diarahkan ke row hasil trigger yang sudah ada.`)
  }

  await upsertRows(client, 'stock_transactions', loadRows, {
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    reportEntry: entry,
  })
}

function summarizeReport(report) {
  for (const table of LOAD_SEQUENCE) {
    const entry = report.tables[table]
    report.summary.total_loaded += entry.loaded
    report.summary.total_remapped += entry.remapped
    report.summary.total_skipped += entry.skipped
    report.summary.blocking_issues = report.issues.length
    report.summary.warnings = report.warnings.length
  }

  report.summary.total_remapped += report.team_remap.row_count
}

function assertPlanIsLoadable(plan, options) {
  if (!plan) {
    return
  }

  if (plan.status === 'blocked' && !options.force) {
    throw new Error(
      `Backfill plan masih blocked (${plan.plan_file ?? 'tanpa path'}). Jalankan validate dan periksa issues, atau pakai --force jika memang ingin lanjut.`
    )
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  assertLiveWriteReady(options)

  const inputDir = path.resolve(options.inputDir)
  const manifestPath = path.join(inputDir, 'meta', 'manifest.json')
  const idMapPath = path.join(inputDir, 'meta', 'id-map.json')
  const validationReportPath = path.join(inputDir, 'meta', 'validation-report.json')
  const planPath = path.join(inputDir, 'meta', 'backfill-plan.json')
  const reportFile = path.resolve(options.reportFile ?? path.join(inputDir, 'meta', 'load-report.json'))

  if (!(await fileExists(manifestPath))) {
    throw new Error(`manifest.json tidak ditemukan: ${manifestPath}`)
  }

  const manifest = await readJson(manifestPath)
  const idMap = (await fileExists(idMapPath)) ? await readJson(idMapPath) : null
  const validationReport = (await fileExists(validationReportPath)) ? await readJson(validationReportPath) : null
  const plan = (await fileExists(planPath)) ? await readJson(planPath) : null
  assertPlanIsLoadable(plan, options)

  const artifacts = await loadArtifacts(inputDir, manifest)
  const report = createLoadReportSkeleton(options, manifest, plan, artifacts)
  const duplicateAliasMaps = buildDuplicateAliasMaps(validationReport)
  const idMapLookups = buildIdMapLookups(idMap)

  if (!plan) {
    report.warnings.push({
      scope: 'meta',
      message: 'backfill-plan.json tidak ditemukan. Loader tetap jalan, tetapi tanpa gate dari validator.',
    })
  }

  if (!validationReport) {
    report.warnings.push({
      scope: 'meta',
      message: 'validation-report.json tidak ditemukan; dedupe alias dan FK remap duplikat tidak aktif.',
    })
  }

  if (!idMap) {
    report.warnings.push({
      scope: 'meta',
      message: 'id-map.json tidak ditemukan; relasi bill/loan payment ke parent canonical akan memakai fallback heuristik.',
    })
  }

  const fileEnv = await loadEnvFile(options.envFile)
  const env = mergeEnv(fileEnv)
  const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? null
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? null

  let client = null
  if (!options.dryRun) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL atau VITE_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi untuk live load.')
    }

    const { createClient } = await import('@supabase/supabase-js')
    client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  if (!options.dryRun) {
    options.telegramUserIdFallback = await resolveDefaultTelegramUserId(client, options.targetTeamId)
  } else {
    options.telegramUserIdFallback = null
  }

  const state = {
    billIdMap: new Map(),
    billCanonicalRows: [],
    loanCanonicalRows: [],
    loanIdMap: new Map(),
    idMapLookups,
  }

  try {
    for (const table of ['teams', 'projects', 'suppliers', 'expense_categories', 'funding_creditors', 'professions', 'staff', 'materials', 'workers', 'worker_wage_rates', 'file_assets', 'beneficiaries', 'hrd_applicants', 'hrd_applicant_documents', 'project_incomes', 'expenses', 'expense_line_items', 'expense_attachments', 'loans']) {
      await loadSimpleTable(client, artifacts, report, options, duplicateAliasMaps, table)
    }

    state.loanCanonicalRows = artifacts.get('loans')?.rows ?? []
    state.loanIdMap = new Map(state.loanCanonicalRows.map((row) => [row.id, row.id]))
    await loadBills(client, artifacts, report, options, duplicateAliasMaps, state)
    await loadLoanPayments(client, artifacts, report, options, duplicateAliasMaps, state)
    await loadBillPayments(client, artifacts, report, options, duplicateAliasMaps, state)
    await finalizeLoans(client, artifacts, report, options, duplicateAliasMaps)
    await finalizeBills(client, report, options, duplicateAliasMaps, state)
    await loadAttendanceRecords(client, artifacts, report, options, duplicateAliasMaps, state)
    await loadStockTransactions(client, artifacts, report, options, duplicateAliasMaps)
    await loadSimpleTable(client, artifacts, report, options, duplicateAliasMaps, 'pdf_settings')
  } catch (error) {
    report.issues.push({
      scope: 'load',
      message: error instanceof Error ? error.message : String(error),
    })
  }

  summarizeReport(report)
  await writeJson(reportFile, report)

  console.log('Firestore canonical load complete')
  console.log(`input: ${inputDir}`)
  console.log(`report: ${reportFile}`)
  console.log(`dry_run: ${options.dryRun}`)
  console.log(`loaded_rows: ${report.summary.total_loaded}`)
  console.log(`remapped_rows: ${report.summary.total_remapped}`)
  if (report.team_remap.enabled) {
    console.log(`target_team_id: ${report.team_remap.target_team_id}`)
    console.log(`team_remapped_rows: ${report.team_remap.row_count}`)
  }
  console.log(`issues: ${report.issues.length}`)
  console.log(`warnings: ${report.warnings.length}`)

  if ((options.strict || !options.dryRun) && report.issues.length > 0) {
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  })
}
