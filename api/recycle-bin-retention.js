import { createClient } from '@supabase/supabase-js'
import { purgeRecycleBinRecords } from './transactions.js'

function getEnv(name, fallback = '') {
  return String(globalThis.process?.env?.[name] ?? fallback).trim()
}

function createDatabaseClient(url, apiKey) {
  return createClient(url, apiKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

function readPositiveInteger(value, fallback) {
  const parsedValue = Number(value)

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : fallback
}

function readQueryFlag(value) {
  return ['1', 'true', 'yes'].includes(String(value ?? '').trim().toLowerCase())
}

export default async function handler(req, res) {
  const method = String(req.method ?? 'GET').toUpperCase()

  if (!['GET', 'POST'].includes(method)) {
    return res.status(405).json({
      success: false,
      error: 'Method tidak didukung.',
    })
  }

  const cronSecret = getEnv('CRON_SECRET')
  const authorizationHeader = String(req.headers?.authorization ?? '').trim()

  if (!cronSecret || authorizationHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized.',
    })
  }

  const supabaseUrl = getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL'))
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      success: false,
      error: 'Environment recycle bin retention belum lengkap.',
    })
  }

  try {
    const retentionDays = readPositiveInteger(
      req.query?.retentionDays ?? getEnv('RECYCLE_BIN_RETENTION_DAYS'),
      30
    )
    const batchLimit = readPositiveInteger(
      req.query?.batchLimit ?? getEnv('RECYCLE_BIN_RETENTION_BATCH_LIMIT'),
      100
    )
    const cutoffDate = new Date(
      Date.now() - retentionDays * 24 * 60 * 60 * 1000
    ).toISOString()
    const serviceClient = createDatabaseClient(supabaseUrl, serviceRoleKey)
    const result = await purgeRecycleBinRecords({
      readClient: serviceClient,
      writeClient: serviceClient,
      deletedBefore: cutoffDate,
      dryRun: readQueryFlag(req.query?.dryRun),
      batchLimit,
    })

    return res.status(200).json({
      success: true,
      retentionDays,
      cutoffDate,
      ...result,
    })
  } catch (error) {
    return res.status(error?.statusCode ?? 500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Auto delete recycle bin gagal dijalankan.',
    })
  }
}
