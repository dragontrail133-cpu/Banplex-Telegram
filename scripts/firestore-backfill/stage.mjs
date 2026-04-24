import { promises as fs } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { isUuid } from './helpers.mjs'

const DEFAULT_INPUT_DIR = 'firestore-legacy-export'
const DEFAULT_BATCH_SIZE = 200

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const EXTRACT_SCRIPT = path.join(SCRIPT_DIR, 'extract.mjs')
const VALIDATE_SCRIPT = path.join(SCRIPT_DIR, 'validate.mjs')
const LOAD_SCRIPT = path.join(SCRIPT_DIR, 'load.mjs')
const SYNC_ASSETS_SCRIPT = path.join(SCRIPT_DIR, 'sync-assets.mjs')

function parseArgs(argv) {
  const options = {
    inputDir: DEFAULT_INPUT_DIR,
    artifactOutputDir: null,
    envFile: null,
    targetTeamId: null,
    batchSize: DEFAULT_BATCH_SIZE,
    live: false,
    confirmLive: false,
    skipValidate: false,
    skipLoad: false,
    skipAssets: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '-h' || token === '--help') {
      options.help = true
      continue
    }

    if (token === '--skip-validate') {
      options.skipValidate = true
      continue
    }

    if (token === '--skip-load') {
      options.skipLoad = true
      continue
    }

    if (token === '--skip-assets') {
      options.skipAssets = true
      continue
    }

    if (token === '--input') {
      options.inputDir = argv[++index]
      continue
    }

    if (token === '--artifact-output') {
      options.artifactOutputDir = argv[++index]
      continue
    }

    if (token === '--env-file') {
      options.envFile = argv[++index]
      continue
    }

    if (token === '--live') {
      options.live = true
      continue
    }

    if (token === '--confirm-live') {
      options.confirmLive = true
      continue
    }

    if (token === '--target-team-id') {
      options.targetTeamId = argv[++index]
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

  if (options.targetTeamId && !isUuid(options.targetTeamId)) {
    throw new Error('--target-team-id harus berupa UUID yang valid.')
  }

  return options
}

function printUsage() {
  console.log(`Firestore staging runner for legacy backfill

Usage:
  node scripts/firestore-backfill/stage.mjs --input ./firestore-legacy-export --target-team-id <uuid>

Options:
  --input <dir>         Artifact hasil extract, snapshot root, atau container snapshot (default: firestore-legacy-export)
  --artifact-output <dir> Output artifact saat input masih snapshot mentah
  --env-file <path>     Optional env file forwarded to load and asset sync steps
  --target-team-id <id> Remap canonical team-scoped rows into this existing workspace
  --batch-size <n>      Batch size forwarded to load and asset sync steps (default: 200)
  --live                Run live load + live asset sync instead of dry-run
  --confirm-live        Required gate before any live write is allowed
  --skip-validate       Skip validate.mjs step
  --skip-load           Skip load.mjs dry-run step
  --skip-assets         Skip sync-assets.mjs dry-run step
  -h, --help            Show this help

What it runs:
  - extract.mjs --snapshot-input ... --output ... (only when input is still raw snapshot)
  - validate.mjs
  - load.mjs --dry-run --strict
  - sync-assets.mjs --dry-run
  - load.mjs / sync-assets.mjs live when --live is set and confirmed
`)
}

function formatArgs(args) {
  return args.map((value) => (value.includes(' ') ? JSON.stringify(value) : value)).join(' ')
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath)
    return stat.isFile()
  } catch {
    return false
  }
}

async function directoryExists(filePath) {
  try {
    const stat = await fs.stat(filePath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

function runStep(stepName, scriptPath, args) {
  console.log(`\n== ${stepName} ==`)
  console.log(`${path.relative(process.cwd(), scriptPath)} ${formatArgs(args)}`)

  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error) {
    throw new Error(`${stepName} gagal: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const exitCode = result.status ?? 'unknown'
    throw new Error(`${stepName} gagal dengan exit code ${exitCode}.`)
  }
}

async function discoverSnapshotSource(inputDir) {
  const manifestPath = path.join(inputDir, 'meta', 'manifest.json')
  if (await fileExists(manifestPath)) {
    return {
      kind: 'artifact',
      sourceDir: inputDir,
      manifestPath,
    }
  }

  if (!(await directoryExists(inputDir))) {
    throw new Error(`Input dir tidak ditemukan: ${inputDir}`)
  }

  const topLevelManifestPath = path.join(inputDir, 'manifest.json')
  if (await fileExists(topLevelManifestPath)) {
    return {
      kind: 'snapshot',
      sourceDir: inputDir,
      manifestPath: topLevelManifestPath,
    }
  }

  const entries = await fs.readdir(inputDir, { withFileTypes: true })
  const candidates = []

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }

    const candidateDir = path.join(inputDir, entry.name)
    const candidateManifestPath = path.join(candidateDir, 'manifest.json')
    if (!(await fileExists(candidateManifestPath))) {
      continue
    }

    const manifest = await readJson(candidateManifestPath)
    const exportedAtValue = Date.parse(manifest.exportedAt ?? manifest.generated_at ?? manifest.generatedAt ?? '')
    const stat = await fs.stat(candidateManifestPath)

    candidates.push({
      sourceDir: candidateDir,
      manifestPath: candidateManifestPath,
      exportedAt: Number.isFinite(exportedAtValue) ? exportedAtValue : stat.mtimeMs,
    })
  }

  if (candidates.length > 0) {
    candidates.sort((left, right) => right.exportedAt - left.exportedAt)
    return {
      kind: 'snapshot',
      sourceDir: candidates[0].sourceDir,
      manifestPath: candidates[0].manifestPath,
      candidates,
    }
  }

  throw new Error(
    `Input dir ${inputDir} belum berisi artifact hasil extract atau snapshot Firestore yang dapat dinormalisasi.`
  )
}

function createValidateArgs(inputDir) {
  const args = ['--input', inputDir, '--strict']
  return args
}

export function createLoadArgs(options, inputDir) {
  const args = ['--input', inputDir, '--strict', '--batch-size', String(options.batchSize)]

  if (options.envFile) {
    args.push('--env-file', options.envFile)
  }

  if (options.targetTeamId) {
    args.push('--target-team-id', options.targetTeamId)
  }

  if (options.live) {
    args.push('--confirm-live')
  }

  if (!options.live) {
    args.push('--dry-run')
  }

  return args
}

export function createStepName(baseName, options) {
  return options.live ? baseName.replace('dry-run', 'live') : baseName
}

export function createAssetSyncArgs(options, inputDir) {
  const args = ['--input', inputDir, '--batch-size', String(options.batchSize)]

  if (options.envFile) {
    args.push('--env-file', options.envFile)
  }

  if (options.live) {
    args.push('--confirm-live')
  }

  if (!options.live) {
    args.push('--dry-run')
  } else {
    args.push('--strict')
  }

  return args
}

function assertLiveModeReady(options) {
  if (!options.live) {
    return
  }

  if (!options.confirmLive) {
    throw new Error('Live mode membutuhkan --confirm-live sebagai gate eksplisit.')
  }

  if (!options.targetTeamId) {
    throw new Error('--target-team-id wajib diisi saat menjalankan --live.')
  }

  const hasEnvCredentials = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
  if (!options.envFile && !hasEnvCredentials) {
    throw new Error('Live mode membutuhkan SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY via env atau --env-file.')
  }
}

async function autoExtractSnapshotIfNeeded(options) {
  const source = await discoverSnapshotSource(path.resolve(options.inputDir))

  if (source.kind === 'artifact') {
    return {
      inputDir: source.sourceDir,
      extracted: false,
      snapshotSourceDir: null,
    }
  }

  const artifactOutputDir = path.resolve(
    options.artifactOutputDir ?? path.join(source.sourceDir, 'normalized-artifact')
  )

  runStep('extract snapshot', EXTRACT_SCRIPT, [
    '--snapshot-input',
    source.sourceDir,
    '--output',
    artifactOutputDir,
  ])

  return {
    inputDir: artifactOutputDir,
    extracted: true,
    snapshotSourceDir: source.sourceDir,
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  assertLiveModeReady(options)
  const working = await autoExtractSnapshotIfNeeded(options)

  if (!options.skipValidate) {
    runStep('validate', VALIDATE_SCRIPT, createValidateArgs(working.inputDir))
  }

  if (!options.skipLoad) {
    runStep(createStepName('load dry-run', options), LOAD_SCRIPT, createLoadArgs(options, working.inputDir))
  }

  if (!options.skipAssets) {
    runStep(
      createStepName('asset sync dry-run', options),
      SYNC_ASSETS_SCRIPT,
      createAssetSyncArgs(options, working.inputDir)
    )
  }

  console.log(`\nStaging ${options.live ? 'live' : 'dry-run'} selesai.`)
  console.log(`input: ${path.resolve(options.inputDir)}`)
  console.log(`working_artifact: ${path.resolve(working.inputDir)}`)
  if (working.extracted) {
    console.log(`snapshot_source: ${working.snapshotSourceDir}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  })
}
