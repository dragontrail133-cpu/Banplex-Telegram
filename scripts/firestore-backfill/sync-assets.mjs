import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const DEFAULT_INPUT_DIR = 'firestore-legacy-export'
const DEFAULT_BUCKET_NAME = 'hrd_documents'
const DEFAULT_BATCH_SIZE = 200

function parseArgs(argv) {
  const options = {
    inputDir: DEFAULT_INPUT_DIR,
    envFile: null,
    reportFile: null,
    batchSize: DEFAULT_BATCH_SIZE,
    dryRun: false,
    confirmLive: false,
    strict: false,
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

    throw new Error(`Argumen tidak dikenal: ${token}`)
  }

  if (!options.inputDir) {
    throw new Error('Nilai --input tidak boleh kosong.')
  }

  return options
}

function printUsage() {
  console.log(`Firestore asset sync for Supabase

Usage:
  node scripts/firestore-backfill/sync-assets.mjs --input ./firestore-legacy-export --env-file ./.env.backfill.local

Options:
  --input <dir>         Export directory to inspect (default: firestore-legacy-export)
  --env-file <path>     Optional env file containing SUPABASE_URL or VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (required for live sync)
  --report-file <path>  Output JSON report (default: <input>/meta/asset-sync-report.json)
  --batch-size <n>      Query batch size for file_assets (default: 200)
  --dry-run             Inspect planned sync without uploading binaries or updating rows
  --confirm-live        Gate eksplisit sebelum live sync boleh berjalan
  --strict              Exit non-zero when sync issues are found
  -h, --help            Show this help

What it does:
  - reads canonical file_assets rows from the backfill artifact
  - compares them to the loaded Supabase rows by id
  - downloads legacy binaries from public_url when needed
  - uploads binaries to the target storage bucket and patches public_url to the new Supabase URL
`)
}

export function assertLiveSyncReady(options) {
  if (options.dryRun) {
    return
  }

  if (!options.confirmLive) {
    throw new Error('Live asset sync membutuhkan --confirm-live sebagai gate eksplisit.')
  }
}

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()
  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
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

function createSyncReportSkeleton(options, manifest, artifact) {
  return {
    generated_at: new Date().toISOString(),
    input_dir: path.resolve(options.inputDir),
    env_file: options.envFile ? path.resolve(options.envFile) : null,
    dry_run: options.dryRun,
    manifest: {
      project_id: manifest.project_id ?? null,
      global_team_path: manifest.global_team_path ?? null,
      root_collections: Array.isArray(manifest.root_collections) ? manifest.root_collections : [],
    },
    artifact: {
      file_path: artifact.filePath ?? null,
      row_count: artifact.rows.length,
    },
    summary: {
      total_rows: artifact.rows.length,
      existing_rows: 0,
      planned_uploads: 0,
      uploaded: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    },
    warnings: [],
    issues: [],
    assets: [],
  }
}

async function loadArtifacts(inputDir, manifest) {
  const canonicalEntries = Array.isArray(manifest.canonical) ? manifest.canonical : []
  const fileAssetEntry = canonicalEntries.find((entry) => (entry.table ?? null) === 'file_assets')

  if (!fileAssetEntry) {
    throw new Error('Manifest canonical tidak memuat file_assets.')
  }

  const filePath = path.resolve(inputDir, fileAssetEntry.output_file)
  const artifact = await readJson(filePath)

  return {
    filePath,
    rows: Array.isArray(artifact.rows) ? artifact.rows : [],
  }
}

async function fetchExistingRows(client, ids, batchSize) {
  const result = new Map()
  const uniqueIds = unique(ids)

  for (const chunk of chunkArray(uniqueIds, batchSize)) {
    const { data, error } = await client
      .from('file_assets')
      .select(
        'id, team_id, storage_bucket, bucket_name, storage_path, public_url, original_name, file_name, mime_type, size_bytes, file_size, deleted_at'
      )
      .in('id', chunk)

    if (error) {
      throw new Error(`Gagal membaca file_assets: ${error.message}`)
    }

    for (const row of data ?? []) {
      if (row?.id) {
        result.set(row.id, row)
      }
    }
  }

  return result
}

async function syncOneAsset(client, report, row, existingRow, options) {
  const bucketName = normalizeText(row.storage_bucket ?? row.bucket_name, DEFAULT_BUCKET_NAME)
  const storagePath = normalizeText(row.storage_path)
  const sourceUrl = normalizeText(existingRow?.public_url ?? row.public_url, null)

  if (!storagePath) {
    throw new Error(`Row file_assets ${row.id} tidak memiliki storage_path.`)
  }

  const targetPublicUrl = client.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl
  const currentPublicUrl = normalizeText(existingRow?.public_url, null)

  const reportRow = {
    id: row.id,
    team_id: row.team_id ?? null,
    bucket_name: bucketName,
    storage_path: storagePath,
    source_url: sourceUrl,
    target_public_url: targetPublicUrl,
    status: 'pending',
  }

  if (!options.dryRun && !existingRow) {
    throw new Error(`Row file_assets ${row.id} tidak ditemukan di database.`)
  }

  if (currentPublicUrl && currentPublicUrl === targetPublicUrl) {
    reportRow.status = 'skipped-already-synced'
    report.summary.skipped += 1
    report.assets.push(reportRow)
    return
  }

  if (!isHttpUrl(sourceUrl)) {
    reportRow.status = 'skipped-no-http-source'
    reportRow.message = sourceUrl ? 'Source URL bukan http(s).' : 'Source URL kosong.'
    report.summary.skipped += 1
    report.warnings.push({
      scope: 'asset',
      file_asset_id: row.id,
      message: `Asset dilewati: ${reportRow.message}`,
    })
    report.assets.push(reportRow)
    return
  }

  if (options.dryRun) {
    reportRow.status = 'would-upload'
    report.summary.planned_uploads += 1
    report.assets.push(reportRow)
    return
  }

  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`Gagal download asset ${row.id}: ${response.status} ${response.statusText}`)
  }

  const body = Buffer.from(await response.arrayBuffer())
  const contentType = normalizeText(response.headers.get('content-type') ?? row.mime_type, 'application/octet-stream')

  const { error: uploadError } = await client.storage.from(bucketName).upload(storagePath, body, {
    contentType,
    upsert: true,
  })

  if (uploadError) {
    throw new Error(`Gagal upload asset ${row.id}: ${uploadError.message}`)
  }

  const { error: updateError } = await client
    .from('file_assets')
    .update({
      storage_bucket: bucketName,
      bucket_name: bucketName,
      public_url: targetPublicUrl,
      mime_type: contentType,
      size_bytes: body.length,
      file_size: body.length,
    })
    .eq('id', row.id)

  if (updateError) {
    throw new Error(`Gagal update file_assets ${row.id}: ${updateError.message}`)
  }

  reportRow.status = 'uploaded'
  reportRow.mime_type = contentType
  reportRow.byte_length = body.length
  report.summary.uploaded += 1
  report.summary.updated += 1
  report.assets.push(reportRow)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  assertLiveSyncReady(options)

  const inputDir = path.resolve(options.inputDir)
  const manifestPath = path.join(inputDir, 'meta', 'manifest.json')
  const reportFile = path.resolve(options.reportFile ?? path.join(inputDir, 'meta', 'asset-sync-report.json'))

  if (!(await fileExists(manifestPath))) {
    throw new Error(`manifest.json tidak ditemukan: ${manifestPath}`)
  }

  const manifest = await readJson(manifestPath)
  const artifact = await loadArtifacts(inputDir, manifest)
  const report = createSyncReportSkeleton(options, manifest, artifact)

  const fileEnv = await loadEnvFile(options.envFile)
  const env = mergeEnv(fileEnv)
  const supabaseUrl = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? null
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? null

  let client = null
  const hasSupabaseCredentials = Boolean(supabaseUrl && serviceRoleKey)

  if (!options.dryRun || hasSupabaseCredentials) {
    if (!supabaseUrl || !serviceRoleKey) {
      if (!options.dryRun) {
        throw new Error('SUPABASE_URL atau VITE_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi untuk asset sync.')
      }
    } else {
      const { createClient } = await import('@supabase/supabase-js')
      client = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    }
  }

  try {
    const existingById = client
      ? await fetchExistingRows(client, artifact.rows.map((row) => row.id), options.batchSize)
      : new Map()
    report.summary.existing_rows = existingById.size

    if (options.dryRun && !client) {
      report.warnings.push({
        scope: 'asset-sync',
        message: 'Dry run tanpa kredensial Supabase; perbandingan dengan row existing dilewati.',
      })
    }

    for (const row of artifact.rows) {
      const existingRow = existingById.get(row.id) ?? null
      try {
        const runtimeClient =
          client ??
          {
            storage: {
              from() {
                return {
                  getPublicUrl(storagePath) {
                    return { data: { publicUrl: `dry-run://${storagePath}` } }
                  },
                }
              },
            },
          }

        await syncOneAsset(
          runtimeClient,
          report,
          row,
          existingRow,
          options
        )
      } catch (error) {
        report.summary.failed += 1
        report.issues.push({
          scope: 'asset',
          file_asset_id: row.id,
          message: error instanceof Error ? error.message : String(error),
        })
        report.assets.push({
          id: row.id,
          team_id: row.team_id ?? null,
          bucket_name: normalizeText(row.storage_bucket ?? row.bucket_name, DEFAULT_BUCKET_NAME),
          storage_path: normalizeText(row.storage_path),
          source_url: normalizeText(existingRow?.public_url ?? row.public_url, null),
          target_public_url: client
            ? client.storage
                .from(normalizeText(row.storage_bucket ?? row.bucket_name, DEFAULT_BUCKET_NAME))
                .getPublicUrl(normalizeText(row.storage_path)).data.publicUrl
            : null,
          status: 'failed',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  } catch (error) {
    report.issues.push({
      scope: 'asset-sync',
      message: error instanceof Error ? error.message : String(error),
    })
  }

  await writeJson(reportFile, report)

  console.log('Firestore asset sync complete')
  console.log(`input: ${inputDir}`)
  console.log(`report: ${reportFile}`)
  console.log(`dry_run: ${options.dryRun}`)
  console.log(`planned_uploads: ${report.summary.planned_uploads}`)
  console.log(`uploaded: ${report.summary.uploaded}`)
  console.log(`skipped: ${report.summary.skipped}`)
  console.log(`issues: ${report.issues.length}`)
  console.log(`warnings: ${report.warnings.length}`)

  if (report.issues.length > 0 || (options.strict && report.warnings.length > 0)) {
    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  })
}
