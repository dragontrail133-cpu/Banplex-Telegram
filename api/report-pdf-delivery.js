import { createClient } from '@supabase/supabase-js'
import { createBusinessReportPdf } from '../src/lib/report-pdf.js'

function getEnv(name, fallback = '') {
  return String(globalThis.process?.env?.[name] ?? fallback).trim()
}

export function resolveReportDeliveryEnv() {
  return {
    supabaseUrl: getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL')),
    publishableKey: getEnv(
      'SUPABASE_PUBLISHABLE_KEY',
      getEnv('VITE_SUPABASE_PUBLISHABLE_KEY', getEnv('VITE_SUPABASE_ANON_KEY'))
    ),
    telegramBotToken: getEnv('TELEGRAM_BOT_TOKEN'),
  }
}

function createHttpError(status, message) {
  const error = new Error(message)

  error.statusCode = status

  return error
}

function createTelegramError(message, status = null, data = null) {
  const error = new Error(message)

  error.telegramStatus = status
  error.telegramResponse = data

  return error
}

async function parseRequestBody(req) {
  if (typeof req.body === 'string' && req.body.trim().length > 0) {
    return JSON.parse(req.body)
  }

  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  const chunks = []

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString())
  }

  const rawBody = chunks.join('').trim()

  return rawBody ? JSON.parse(rawBody) : {}
}

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function getBearerToken(req) {
  const authorizationHeader = String(req.headers?.authorization ?? '').trim()
  const bearerToken = authorizationHeader.toLowerCase().startsWith('bearer ')
    ? authorizationHeader.slice(7).trim()
    : null

  if (!bearerToken) {
    throw createHttpError(401, 'Authorization token tidak ditemukan.')
  }

  return bearerToken
}

function createDatabaseClient(url, apiKey, bearerToken) {
  return createClient(url, apiKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: bearerToken
      ? {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        }
      : undefined,
  })
}

async function getAuthenticatedUser({
  supabaseUrl,
  publishableKey,
  bearerToken,
}) {
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      apikey: publishableKey,
    },
  })

  if (!authResponse.ok) {
    throw createHttpError(401, 'Sesi Supabase tidak valid.')
  }

  const authUser = await authResponse.json()

  if (!authUser?.id) {
    throw createHttpError(401, 'User Supabase tidak ditemukan.')
  }

  return authUser
}

async function resolveTelegramUserId(adminClient, authUser) {
  const profileResult = await adminClient
    .from('profiles')
    .select('telegram_user_id')
    .eq('id', authUser.id)
    .maybeSingle()

  if (!profileResult.error) {
    const profileTelegramUserId = normalizeText(profileResult.data?.telegram_user_id, null)

    if (profileTelegramUserId) {
      return profileTelegramUserId
    }
  }

  return (
    normalizeText(authUser?.user_metadata?.telegram_user_id, null) ??
    normalizeText(authUser?.app_metadata?.telegram_user_id, null)
  )
}

async function sendTelegramTextNotification({
  telegramBotToken,
  telegramChatId,
  message,
}) {
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Vercel-Serverless-Function',
    },
    body: JSON.stringify({
      chat_id: telegramChatId,
      text: message,
    }),
  })
  const rawBody = (await response.text()).trim()
  let data = {}

  try {
    data = rawBody ? JSON.parse(rawBody) : {}
  } catch (error) {
    throw createTelegramError(
      error instanceof Error
        ? `Gagal parse respons Telegram: ${error.message}`
        : 'Gagal parse respons Telegram.',
      response.status,
      rawBody
    )
  }

  if (response.ok && data?.ok) {
    return {
      telegramStatus: response.status,
      telegramResponse: data,
      deliveryMode: 'message',
    }
  }

  throw createTelegramError(
    data?.description || 'Gagal mengirim pesan Telegram.',
    response.status,
    data
  )
}

async function sendTelegramDocumentNotification({
  telegramBotToken,
  telegramChatId,
  pdfBytes,
  fileName,
  caption,
  fallbackMessage,
}) {
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendDocument`

  try {
    const formData = new FormData()
    formData.append('chat_id', telegramChatId)
    formData.append('document', new Blob([pdfBytes], { type: 'application/pdf' }), fileName)
    formData.append('caption', caption)

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Vercel-Serverless-Function',
      },
    })
    const rawBody = (await response.text()).trim()
    let data = {}

    try {
      data = rawBody ? JSON.parse(rawBody) : {}
    } catch (error) {
      throw createTelegramError(
        error instanceof Error
          ? `Gagal parse respons Telegram: ${error.message}`
          : 'Gagal parse respons Telegram.',
        response.status,
        rawBody
      )
    }

    if (response.ok && data?.ok) {
      return {
        telegramStatus: response.status,
        telegramResponse: data,
        deliveryMode: 'document',
        pdfError: null,
      }
    }

    throw createTelegramError(
      data?.description || 'Gagal mengirim dokumen Telegram.',
      response.status,
      data
    )
  } catch (error) {
    const normalizedError =
      error instanceof Error
        ? error
        : new Error('Terjadi kesalahan saat menghubungi Telegram API.')

    if (typeof normalizedError.telegramStatus !== 'number') {
      normalizedError.telegramStatus = null
    }

    if (normalizedError.telegramResponse === undefined) {
      normalizedError.telegramResponse = null
    }

    const fallbackResult = await sendTelegramTextNotification({
      telegramBotToken,
      telegramChatId,
      message: fallbackMessage,
    })

    return {
      ...fallbackResult,
      pdfError: normalizedError.message,
    }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')

    return res.status(405).json({
      success: false,
      error: 'Method not allowed.',
    })
  }

  const { supabaseUrl, publishableKey, telegramBotToken } = resolveReportDeliveryEnv()

  if (!supabaseUrl || !publishableKey || !telegramBotToken) {
    return res.status(500).json({
      success: false,
      error: 'Environment variable untuk pengiriman laporan Telegram belum lengkap.',
    })
  }

  try {
    const bearerToken = getBearerToken(req)
    const authUser = await getAuthenticatedUser({
      supabaseUrl,
      publishableKey,
      bearerToken,
    })
    const authenticatedClient = createDatabaseClient(
      supabaseUrl,
      publishableKey,
      bearerToken
    )
    const body = await parseRequestBody(req)
    const reportData = body?.reportData ?? null
    const pdfSettings = body?.pdfSettings ?? {}

    if (!reportData || typeof reportData !== 'object') {
      throw createHttpError(400, 'reportData wajib dikirim untuk fallback DM.')
    }

    const telegramUserId = await resolveTelegramUserId(authenticatedClient, authUser)

    if (!telegramUserId) {
      throw createHttpError(400, 'Telegram user belum terverifikasi untuk delivery DM.')
    }

    const { doc, fileName } = await createBusinessReportPdf({
      reportData,
      pdfSettings,
    })
    const pdfBytes = new Uint8Array(doc.output('arraybuffer'))
    const reportTitle = normalizeText(reportData?.title, 'Laporan bisnis')

    const telegramResult = await sendTelegramDocumentNotification({
      telegramBotToken,
      telegramChatId: telegramUserId,
      pdfBytes,
      fileName,
      caption: `Laporan ${reportTitle} berhasil dikirim ke DM.`,
      fallbackMessage: `Laporan ${reportTitle} siap, tetapi pengiriman file ke Telegram gagal. Buka laporan di browser untuk unduh langsung.`,
    })

    return res.status(200).json({
      success: true,
      deliveryMode: telegramResult.deliveryMode,
      telegramStatus: telegramResult.telegramStatus,
      telegramResponse: telegramResult.telegramResponse,
      fileName,
      pdfError: telegramResult.pdfError ?? null,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Terjadi kesalahan saat mengirim laporan ke DM Telegram.'

    return res.status(error?.statusCode ?? 500).json({
      success: false,
      error: message,
      telegramStatus:
        typeof error?.telegramStatus === 'number' ? error.telegramStatus : null,
      telegramResponse: error?.telegramResponse ?? null,
    })
  }
}
