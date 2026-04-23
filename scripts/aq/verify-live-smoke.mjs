import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'test-results',
  'live-smoke-created-records.json'
)
const DEFAULT_OUTPUT_PATH = path.resolve(
  process.cwd(),
  'test-results',
  'live-smoke-verification.json'
)

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function getEnv(name, fallback = null) {
  return normalizeText(process.env[name], fallback)
}

function parseArgs(argv) {
  const options = {
    artifactPath: DEFAULT_ARTIFACT_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '-h' || token === '--help') {
      options.help = true
      continue
    }

    if (token === '--artifact') {
      options.artifactPath = path.resolve(argv[++index])
      continue
    }

    if (token === '--output') {
      options.outputPath = path.resolve(argv[++index])
      continue
    }

    throw new Error(`Argumen tidak dikenal: ${token}`)
  }

  return options
}

function printUsage() {
  console.log(`Verify live smoke artifacts against Supabase

Usage:
  node scripts/aq/verify-live-smoke.mjs --artifact ./test-results/live-smoke-created-records.json

Options:
  --artifact <path>   Artifact file from tests/live/release-smoke.spec.js
  --output <path>     Output verification report JSON
  -h, --help          Show this help

Environment:
  E2E_VERIFY_SUPABASE_URL or VITE_SUPABASE_URL
  E2E_VERIFY_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY
`)
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function createVerifierClient() {
  const supabaseUrl = getEnv('E2E_VERIFY_SUPABASE_URL', getEnv('VITE_SUPABASE_URL'))
  const serviceRoleKey = getEnv(
    'E2E_VERIFY_SUPABASE_SERVICE_ROLE_KEY',
    getEnv('SUPABASE_SERVICE_ROLE_KEY')
  )

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Env verifier belum lengkap. Set E2E_VERIFY_SUPABASE_URL dan E2E_VERIFY_SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function createCheckResult(name, ok, detail = {}) {
  return {
    name,
    ok,
    ...detail,
  }
}

async function verifyFundingCreditor(client, artifact, smokePrefix) {
  const record = artifact.records?.funding_creditor

  if (!record?.id) {
    return createCheckResult('funding_creditor', false, {
      reason: 'Artifact funding_creditor.id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('funding_creditors')
    .select('id, team_id, name, notes, deleted_at, created_at')
    .eq('id', record.id)
    .maybeSingle()

  if (error) {
    return createCheckResult('funding_creditor', false, {
      reason: error.message,
      record_id: record.id,
    })
  }

  if (!data) {
    return createCheckResult('funding_creditor', false, {
      reason: 'Row funding_creditors tidak ditemukan.',
      record_id: record.id,
    })
  }

  const nameMatches = normalizeText(data.name, '') === normalizeText(record.name, '')
  const prefixMatches = [data.name, data.notes].some((value) =>
    normalizeText(value, '').includes(smokePrefix)
  )

  return createCheckResult(
    'funding_creditor',
    Boolean(nameMatches && prefixMatches && !data.deleted_at),
    {
      record_id: data.id,
      team_id: data.team_id,
      deleted_at: data.deleted_at,
      expected_name: record.name,
      actual_name: data.name,
      prefix_matches: prefixMatches,
    }
  )
}

async function verifyLoan(client, artifact) {
  const record = artifact.records?.loan

  if (!record?.id) {
    return createCheckResult('loan', false, {
      reason: 'Artifact loan.id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('loans')
    .select(
      'id, team_id, creditor_id, principal_amount, repayment_amount, status, notes, deleted_at, created_at'
    )
    .eq('id', record.id)
    .maybeSingle()

  if (error) {
    return createCheckResult('loan', false, {
      reason: error.message,
      record_id: record.id,
    })
  }

  if (!data) {
    return createCheckResult('loan', false, {
      reason: 'Row loans tidak ditemukan.',
      record_id: record.id,
    })
  }

  const principalMatches = Number(data.principal_amount) === Number(record.principal_amount)
  const creditorMatches = normalizeText(data.creditor_id, '') === normalizeText(record.creditor_id, '')
  const noteMatches = normalizeText(data.notes, '') === normalizeText(record.notes, '')

  return createCheckResult(
    'loan',
    Boolean(
      principalMatches &&
        creditorMatches &&
        noteMatches &&
        normalizeText(data.status, '') === 'unpaid' &&
        !data.deleted_at
    ),
    {
      record_id: data.id,
      team_id: data.team_id,
      creditor_id: data.creditor_id,
      deleted_at: data.deleted_at,
      actual_status: data.status,
      actual_principal_amount: data.principal_amount,
      actual_notes: data.notes,
    }
  )
}

async function verifyInviteToken(client, artifact) {
  const record = artifact.records?.invite_token

  if (!record?.id) {
    return createCheckResult('invite_token', false, {
      reason: 'Artifact invite_token.id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('invite_tokens')
    .select('id, team_id, token, role, is_used, expires_at, created_at')
    .eq('id', record.id)
    .maybeSingle()

  if (error) {
    return createCheckResult('invite_token', false, {
      reason: error.message,
      record_id: record.id,
    })
  }

  if (!data) {
    return createCheckResult('invite_token', false, {
      reason: 'Row invite_tokens tidak ditemukan.',
      record_id: record.id,
    })
  }

  const tokenMatches = normalizeText(data.token, '') === normalizeText(record.token, '')
  const roleMatches = normalizeText(data.role, '') === normalizeText(record.role, '')

  return createCheckResult(
    'invite_token',
    Boolean(tokenMatches && roleMatches && data.is_used === false),
    {
      record_id: data.id,
      team_id: data.team_id,
      token: data.token,
      role: data.role,
      is_used: data.is_used,
      expires_at: data.expires_at,
    }
  )
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  const artifact = await readJson(options.artifactPath)
  const client = createVerifierClient()
  const smokePrefix = normalizeText(artifact.smoke_prefix, '')
  const checks = [
    await verifyFundingCreditor(client, artifact, smokePrefix),
    await verifyLoan(client, artifact),
    await verifyInviteToken(client, artifact),
  ]
  const status = checks.every((check) => check.ok) ? 'verified' : 'failed'
  const report = {
    generated_at: new Date().toISOString(),
    status,
    artifact_file: options.artifactPath,
    smoke_prefix: smokePrefix,
    checks,
  }

  await writeJson(options.outputPath, report)

  console.log(`live smoke verification: ${status}`)
  console.log(`artifact: ${options.artifactPath}`)
  console.log(`report: ${options.outputPath}`)

  if (status !== 'verified') {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
