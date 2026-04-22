import { createClient } from '@supabase/supabase-js'
import { APP_TIME_ZONE, getAppTodayKey, shiftAppDateKey, toAppDateKey } from '../src/lib/date-time.js'
import { normalizeRole } from '../src/lib/rbac.js'
import {
  buildTelegramAssistantLink,
  normalizeAssistantRoutePath,
} from '../src/lib/telegram-assistant-links.js'

const assistantSelectColumns =
  'team_id, source_type, type, id, sort_at, transaction_date, income_date, expense_date, due_date, created_at, updated_at, amount, description, project_name_snapshot, supplier_name_snapshot, creditor_name_snapshot, worker_name_snapshot, expense_type, document_type, bill_id, bill_type, bill_status, bill_amount, bill_paid_amount, bill_remaining_amount, bill_due_date, bill_paid_at, bill_description, bill_project_name_snapshot, bill_supplier_name_snapshot, bill_worker_name_snapshot, search_text'
const sessionStates = new Set([
  'idle',
  'awaiting_workspace_choice',
  'awaiting_clarification',
])
const allowedIntents = new Set(['status', 'search', 'navigate', 'clarify', 'refuse'])
const allowedStatuses = new Set(['any', 'paid', 'partial', 'unpaid'])
const allowedKinds = new Set(['all', 'transaction', 'bill', 'loan'])
const financeCoreScopes = new Set(['project-income', 'expense', 'loan-disbursement'])
const payrollScopeKeywords = [
  'gaji',
  'upah',
  'payroll',
  'absensi',
  'attendance',
  'hrd',
  'beneficiary',
  'penerima manfaat',
]
const mutationKeywords = [
  'buat',
  'tambah',
  'hapus',
  'delete',
  'edit',
  'ubah',
  'update',
  'perbarui',
  'approve',
  'setujui',
  'restore',
  'kembalikan',
  'submit',
  'posting',
  'bayarkan',
]
const routeKeywordMap = [
  { pattern: /\b(riwayat|history)\b/, path: '/transactions?tab=history', label: 'Riwayat' },
  { pattern: /\b(tagihan|invoice)\b/, path: '/transactions?tab=tagihan', label: 'Tagihan' },
  { pattern: /\b(pembayaran|payment)\b/, path: '/pembayaran', label: 'Pembayaran' },
  { pattern: /\b(jurnal|transaksi|ledger)\b/, path: '/transactions', label: 'Jurnal' },
  { pattern: /\b(pinjaman|loan)\b/, path: '/transactions', label: 'Jurnal Pinjaman' },
]
const stopWordPatterns = [
  /\b(tolong|mohon|bantu|buat|tambah|hapus|delete|edit|ubah|update|perbarui|lihat|buka|cek|status|cari|temukan|search|tampilkan|pindah|masuk|ke)\b/g,
  /\b(hari ini|kemarin|minggu ini|minggu lalu|bulan ini|bulan lalu|lalu|sekarang)\b/g,
  /\b(unpaid|paid|partial|lunas|belum lunas|terbayar|sudah dibayar)\b/g,
  /\b(tagihan|pembayaran|payment|jurnal|transaksi|riwayat|history|pinjaman|loan)\b/g,
  /\b(rp\.?|rupiah)\b/g,
]

function getEnv(name, fallback = '') {
  return String(globalThis.process?.env?.[name] ?? fallback).trim()
}

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function normalizeNullableText(value) {
  const normalizedValue = normalizeText(value, '')

  if (!normalizedValue) {
    return null
  }

  if (normalizedValue.toLowerCase() === 'null') {
    return null
  }

  return normalizedValue
}

function createHttpError(status, message) {
  const error = new Error(message)

  error.statusCode = status

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

function createAdminClient(url, serviceRoleKey) {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

function buildTelegramApiUrl(botToken, method) {
  return `https://api.telegram.org/bot${botToken}/${method}`
}

async function postTelegram(url, body) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    const headers = {
      Accept: 'application/json',
      'User-Agent': 'Vercel-Serverless-Function',
    }

    if (typeof body === 'string') {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      method: 'POST',
      body,
      signal: controller.signal,
      headers,
    })
    const rawBody = (await response.text()).trim()

    try {
      return {
        status: response.status,
        data: rawBody ? JSON.parse(rawBody) : {},
      }
    } catch (error) {
      throw createHttpError(
        response.status,
        error instanceof Error
          ? `Gagal parse respons Telegram: ${error.message}`
          : 'Gagal parse respons Telegram.'
      )
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createHttpError(504, 'Request ke Telegram timeout.')
    }

    throw error instanceof Error
      ? error
      : createHttpError(500, 'Terjadi kesalahan saat menghubungi Telegram API.')
  } finally {
    clearTimeout(timeoutId)
  }
}

function assertTelegramSuccess(response, fallbackMessage) {
  if (response.status >= 200 && response.status < 300 && response.data?.ok) {
    return
  }

  throw createHttpError(
    response.status,
    response.data?.description || fallbackMessage || 'Telegram request gagal.'
  )
}

async function sendTelegramMessage({
  botToken,
  chatId,
  text,
  replyMarkup = null,
  replyToMessageId = null,
}) {
  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  }

  if (replyMarkup) {
    payload.reply_markup = replyMarkup
  }

  if (replyToMessageId) {
    payload.reply_to_message_id = replyToMessageId
  }

  const response = await postTelegram(
    buildTelegramApiUrl(botToken, 'sendMessage'),
    JSON.stringify(payload)
  )

  assertTelegramSuccess(response, 'Gagal mengirim pesan Telegram.')

  return response.data
}

async function answerTelegramCallback({
  botToken,
  callbackQueryId,
  text = null,
  showAlert = false,
}) {
  const payload = {
    callback_query_id: callbackQueryId,
    show_alert: Boolean(showAlert),
  }

  if (text) {
    payload.text = text
  }

  const response = await postTelegram(
    buildTelegramApiUrl(botToken, 'answerCallbackQuery'),
    JSON.stringify(payload)
  )

  assertTelegramSuccess(response, 'Gagal menjawab callback Telegram.')

  return response.data
}

function normalizeTelegramId(value) {
  return normalizeText(value, '')
}

function getTelegramBotUsername() {
  return normalizeText(
    getEnv('TELEGRAM_BOT_USERNAME', getEnv('VITE_TELEGRAM_BOT_USERNAME')),
    ''
  )
}

function isWebhookSecretEnabled() {
  return Boolean(
    getEnv('TELEGRAM_ASSISTANT_WEBHOOK_SECRET', getEnv('TELEGRAM_WEBHOOK_SECRET'))
  )
}

function assertWebhookSecret(req) {
  const expectedSecret = getEnv(
    'TELEGRAM_ASSISTANT_WEBHOOK_SECRET',
    getEnv('TELEGRAM_WEBHOOK_SECRET')
  )

  if (!expectedSecret) {
    return
  }

  const receivedSecret = normalizeText(
    req?.headers?.['x-telegram-bot-api-secret-token'],
    ''
  )

  if (receivedSecret !== expectedSecret) {
    throw createHttpError(403, 'Secret token webhook Telegram tidak cocok.')
  }
}

function normalizeMembership(member) {
  const team = Array.isArray(member?.teams)
    ? member.teams[0] ?? null
    : member?.teams ?? null

  return {
    id: normalizeText(member?.id, null),
    team_id: normalizeText(member?.team_id, null),
    telegram_user_id: normalizeText(member?.telegram_user_id, null),
    role: normalizeRole(member?.role),
    is_default: Boolean(member?.is_default),
    status: normalizeText(member?.status, 'active'),
    approved_at: normalizeText(member?.approved_at, null),
    created_at: normalizeText(member?.created_at, null),
    team_name: normalizeText(team?.name, null),
    team_slug: normalizeText(team?.slug, null),
    team_is_active: team?.is_active !== false,
  }
}

async function loadActiveMemberships(adminClient, telegramUserId) {
  const normalizedTelegramUserId = normalizeTelegramId(telegramUserId)

  if (!normalizedTelegramUserId) {
    return []
  }

  const { data, error } = await adminClient
    .from('team_members')
    .select(
      'id, team_id, telegram_user_id, role, is_default, status, approved_at, created_at, teams:team_id ( id, name, slug, is_active )'
    )
    .eq('telegram_user_id', normalizedTelegramUserId)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .order('approved_at', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map(normalizeMembership).filter((membership) => membership.team_is_active)
}

function isSessionState(value) {
  return sessionStates.has(normalizeText(value, ''))
}

function normalizeSessionRow(row) {
  const state = isSessionState(row?.state) ? normalizeText(row?.state, 'idle') : 'idle'

  return {
    chat_id: normalizeText(row?.chat_id, null),
    telegram_user_id: normalizeText(row?.telegram_user_id, null),
    team_id: normalizeText(row?.team_id, null),
    state,
    pending_intent: normalizeText(row?.pending_intent, null),
    pending_payload: row?.pending_payload && typeof row.pending_payload === 'object'
      ? row.pending_payload
      : {},
    expires_at: normalizeText(row?.expires_at, null),
    created_at: normalizeText(row?.created_at, null),
    updated_at: normalizeText(row?.updated_at, null),
  }
}

async function loadAssistantSession(adminClient, chatId) {
  const normalizedChatId = normalizeTelegramId(chatId)

  if (!normalizedChatId) {
    return null
  }

  const { data, error } = await adminClient
    .from('telegram_assistant_sessions')
    .select(
      'chat_id, telegram_user_id, team_id, state, pending_intent, pending_payload, expires_at, created_at, updated_at'
    )
    .eq('chat_id', normalizedChatId)
    .maybeSingle()

  if (error) {
    throw error
  }

  const session = data ? normalizeSessionRow(data) : null

  if (!session?.expires_at) {
    return session
  }

  const expiresAtMs = new Date(session.expires_at).getTime()

  if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
    await clearAssistantSession(adminClient, normalizedChatId)

    return null
  }

  return session
}

async function saveAssistantSession(
  adminClient,
  {
    chatId,
    telegramUserId,
    teamId = null,
    state = 'idle',
    pendingIntent = null,
    pendingPayload = {},
    expiresAt = null,
  } = {}
) {
  const normalizedChatId = normalizeTelegramId(chatId)
  const normalizedTelegramUserId = normalizeTelegramId(telegramUserId)
  const normalizedTeamId = normalizeTelegramId(teamId)
  const normalizedState = isSessionState(state) ? normalizeText(state, 'idle') : 'idle'
  const normalizedPendingIntent = normalizeText(pendingIntent, null)
  const normalizedPayload =
    pendingPayload && typeof pendingPayload === 'object' ? pendingPayload : {}
  const normalizedExpiresAt = normalizeText(
    expiresAt,
    new Date(Date.now() + 30 * 60 * 1000).toISOString()
  )

  if (!normalizedChatId || !normalizedTelegramUserId) {
    throw createHttpError(400, 'Session Telegram assistant tidak lengkap.')
  }

  const payload = {
    chat_id: normalizedChatId,
    telegram_user_id: normalizedTelegramUserId,
    team_id: normalizedTeamId || null,
    state: normalizedState,
    pending_intent: normalizedPendingIntent,
    pending_payload: normalizedPayload,
    expires_at: normalizedExpiresAt,
    updated_at: new Date().toISOString(),
  }

  const { error } = await adminClient
    .from('telegram_assistant_sessions')
    .upsert(payload, { onConflict: 'chat_id' })

  if (error) {
    throw error
  }

  return payload
}

async function clearAssistantSession(adminClient, chatId) {
  const normalizedChatId = normalizeTelegramId(chatId)

  if (!normalizedChatId) {
    return
  }

  const { error } = await adminClient
    .from('telegram_assistant_sessions')
    .delete()
    .eq('chat_id', normalizedChatId)

  if (error) {
    throw error
  }
}

function buildWorkspaceChoiceMessage(memberships) {
  const lines = ['Saya menemukan beberapa workspace aktif. Pilih workspace yang dipakai:']

  memberships.forEach((membership, index) => {
    const roleLabel = membership.role ? ` - ${membership.role}` : ''
    const defaultLabel = membership.is_default ? ' (default)' : ''

    lines.push(`${index + 1}. ${membership.team_name ?? 'Workspace'}${roleLabel}${defaultLabel}`)
  })

  lines.push('Kirim angka, nama workspace, atau tekan tombol pilihan di bawah.')

  return lines.join('\n')
}

function buildWorkspaceChoiceMarkup(memberships) {
  const rows = memberships.map((membership) => [
    {
      text: membership.team_name ?? 'Workspace',
      callback_data: `ws:${membership.team_id}`,
    },
  ])

  return rows.length > 0 ? { inline_keyboard: rows } : null
}

function getAllowedBotProviderConfig() {
  const configuredProvider = normalizeText(
    getEnv('TELEGRAM_ASSISTANT_LLM_PROVIDER', getEnv('ASSISTANT_LLM_PROVIDER')),
    ''
  ).toLowerCase()

  const providerCandidates =
    configuredProvider === 'gemini'
      ? ['gemini']
      : configuredProvider === 'xai'
        ? ['xai']
        : ['xai', 'gemini']

  for (const provider of providerCandidates) {
    if (provider === 'xai') {
      const apiKey = normalizeText(
        getEnv('TELEGRAM_ASSISTANT_XAI_API_KEY', getEnv('XAI_API_KEY')),
        ''
      )
      const model = normalizeText(
        getEnv('TELEGRAM_ASSISTANT_XAI_MODEL', getEnv('XAI_MODEL')),
        ''
      )

      if (apiKey && model) {
        return { provider, apiKey, model }
      }
    }

    if (provider === 'gemini') {
      const apiKey = normalizeText(
        getEnv('TELEGRAM_ASSISTANT_GEMINI_API_KEY', getEnv('GEMINI_API_KEY')),
        ''
      )
      const model = normalizeText(
        getEnv('TELEGRAM_ASSISTANT_GEMINI_MODEL', getEnv('GEMINI_MODEL')),
        ''
      )

      if (apiKey && model) {
        return { provider, apiKey, model }
      }
    }
  }

  return null
}

async function postAssistantClassifierPrompt(providerConfig, promptText) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

  try {
    if (providerConfig.provider === 'xai') {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          model: providerConfig.model,
          temperature: 0,
          max_tokens: 512,
          messages: [
            {
              role: 'system',
              content: 'Kamu adalah classifier JSON untuk Telegram assistant finance core yang read-only.',
            },
            {
              role: 'user',
              content: promptText,
            },
          ],
        }),
      })

      const responseText = (await response.text()).trim()

      if (!response.ok) {
        throw createHttpError(response.status, responseText || 'xAI classifier gagal.')
      }

      const responseJson = responseText ? JSON.parse(responseText) : {}
      return normalizeText(responseJson?.choices?.[0]?.message?.content, '')
    }

    if (providerConfig.provider === 'gemini') {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(providerConfig.model)}:generateContent`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-goog-api-key': providerConfig.apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: promptText }],
              },
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 512,
            },
          }),
        }
      )

      const responseText = (await response.text()).trim()

      if (!response.ok) {
        throw createHttpError(response.status, responseText || 'Gemini classifier gagal.')
      }

      const responseJson = responseText ? JSON.parse(responseText) : {}
      const candidate = responseJson?.candidates?.[0]?.content?.parts ?? []

      return normalizeText(
        candidate
          .map((part) => normalizeText(part?.text, ''))
          .filter(Boolean)
          .join('\n'),
        ''
      )
    }

    return ''
  } finally {
    clearTimeout(timeoutId)
  }
}

function extractJsonObject(text) {
  const normalizedText = normalizeText(text, '')

  if (!normalizedText) {
    return null
  }

  const cleanedText = normalizedText.replace(/```json|```/gi, '').trim()
  const firstBrace = cleanedText.indexOf('{')
  const lastBrace = cleanedText.lastIndexOf('}')

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    return null
  }

  const candidateText = cleanedText.slice(firstBrace, lastBrace + 1)

  try {
    return JSON.parse(candidateText)
  } catch {
    return null
  }
}

function normalizeMoneyText(value) {
  const normalizedValue = normalizeText(value, '')

  if (!normalizedValue) {
    return ''
  }

  return normalizedValue
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
}

function parseFlexibleAmount(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  const jutaMatch = normalizedText.match(/(\d+(?:[.,]\d+)?)\s*(jt|juta)\b/)

  if (jutaMatch) {
    const amount = Number(normalizeMoneyText(jutaMatch[1]))

    return Number.isFinite(amount) ? amount * 1000000 : null
  }

  const ribuMatch = normalizedText.match(/(\d+(?:[.,]\d+)?)\s*(rb|ribu)\b/)

  if (ribuMatch) {
    const amount = Number(normalizeMoneyText(ribuMatch[1]))

    return Number.isFinite(amount) ? amount * 1000 : null
  }

  const rupiahMatch = normalizedText.match(/(?:rp|rupiah)\s*([\d.,]+)/)

  if (rupiahMatch) {
    const amount = Number(normalizeMoneyText(rupiahMatch[1]))

    return Number.isFinite(amount) ? amount : null
  }

  const bareNumberMatch = normalizedText.match(/\b(\d[\d.,]{2,})\b/)

  if (bareNumberMatch) {
    const amount = Number(normalizeMoneyText(bareNumberMatch[1]))

    return Number.isFinite(amount) ? amount : null
  }

  return null
}

function extractExactDateRange(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()
  const dateMatches = [...normalizedText.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map(
    (match) => match[1]
  )

  if (dateMatches.length >= 2) {
    return {
      dateFrom: dateMatches[0],
      dateTo: dateMatches[1],
    }
  }

  if (dateMatches.length === 1) {
    return {
      dateFrom: dateMatches[0],
      dateTo: dateMatches[0],
    }
  }

  return null
}

function getMonthRange(dateKey, offsetMonths = 0) {
  const parsedDate = new Date(`${dateKey}T12:00:00Z`)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  const startDate = new Date(
    Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth() + offsetMonths,
      1,
      12,
      0,
      0
    )
  )
  const endDate = new Date(
    Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth() + offsetMonths + 1,
      0,
      12,
      0,
      0
    )
  )

  return {
    dateFrom: getAppTodayKey(startDate),
    dateTo: getAppTodayKey(endDate),
  }
}

function extractRelativeDateRange(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()
  const todayKey = getAppTodayKey()

  if (normalizedText.includes('hari ini')) {
    return {
      dateFrom: todayKey,
      dateTo: todayKey,
    }
  }

  if (normalizedText.includes('kemarin')) {
    const yesterdayKey = shiftAppDateKey(todayKey, -1)

    return {
      dateFrom: yesterdayKey,
      dateTo: yesterdayKey,
    }
  }

  if (normalizedText.includes('minggu ini')) {
    return {
      dateFrom: shiftAppDateKey(todayKey, -6),
      dateTo: todayKey,
    }
  }

  if (normalizedText.includes('minggu lalu')) {
    return {
      dateFrom: shiftAppDateKey(todayKey, -13),
      dateTo: shiftAppDateKey(todayKey, -7),
    }
  }

  if (normalizedText.includes('bulan ini')) {
    return getMonthRange(todayKey, 0)
  }

  if (normalizedText.includes('bulan lalu')) {
    return getMonthRange(todayKey, -1)
  }

  return null
}

function extractStatusFilter(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  if (/\b(belum lunas|unpaid|outstanding|sisa|tersisa)\b/.test(normalizedText)) {
    return 'unpaid'
  }

  if (/\b(partial|sebagian|cicil|bertahap)\b/.test(normalizedText)) {
    return 'partial'
  }

  if (/\b(lunas|paid|terbayar|selesai|tuntas)\b/.test(normalizedText)) {
    return 'paid'
  }

  return 'any'
}

function extractKindFilter(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  if (/\b(pinjaman|loan)\b/.test(normalizedText)) {
    return 'loan'
  }

  if (/\b(tagihan|invoice)\b/.test(normalizedText)) {
    return 'bill'
  }

  if (/\b(pembayaran|payment)\b/.test(normalizedText)) {
    return 'transaction'
  }

  return 'all'
}

function extractRouteKeyword(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  for (const routeDefinition of routeKeywordMap) {
    if (routeDefinition.pattern.test(normalizedText)) {
      return routeDefinition
    }
  }

  return null
}

function buildSearchQueryText(text) {
  let normalizedText = normalizeText(text, '').toLowerCase()

  for (const pattern of stopWordPatterns) {
    normalizedText = normalizedText.replace(pattern, ' ')
  }

  normalizedText = normalizedText.replace(/\s+/g, ' ').trim()

  return normalizedText
}

function extractUuid(text) {
  const normalizedText = normalizeText(text, '')
  const match = normalizedText.match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
  )

  return match ? match[0].toLowerCase() : null
}

function determineIntentFromText(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()
  const hasMutation = mutationKeywords.some((keyword) => normalizedText.includes(keyword))
  const hasPayrollKeyword = payrollScopeKeywords.some((keyword) =>
    normalizedText.includes(keyword)
  )
  const routeKeyword = extractRouteKeyword(normalizedText)
  const exactId = extractUuid(normalizedText)
  const hasSearchSignal = Boolean(
    exactId ||
      /\b(cari|search|temukan|nominal|tanggal|id|kode|nama|berapa|sisa|lunas|partial)\b/.test(
        normalizedText
      )
  )
  const hasStatusSignal = Boolean(
    /\b(status|cek|belum lunas|unpaid|paid|partial|outstanding|tersisa)\b/.test(
      normalizedText
    ) || /\b(tagihan|pembayaran|pinjaman)\b/.test(normalizedText)
  )
  const hasNavigateSignal = Boolean(
    /\b(buka|lihat|menu|masuk|ke)\b/.test(normalizedText) && routeKeyword
  )

  if (hasMutation || (hasPayrollKeyword && !/\b(pembayaran|jurnal|tagihan|pinjaman)\b/.test(normalizedText))) {
    return 'refuse'
  }

  if (hasNavigateSignal) {
    return 'navigate'
  }

  if (hasSearchSignal) {
    return 'search'
  }

  if (hasStatusSignal) {
    return 'status'
  }

  if (routeKeyword) {
    return 'navigate'
  }

  return 'clarify'
}

function buildDeterministicPlan(text) {
  const normalizedText = normalizeText(text, '')
  const lowerText = normalizedText.toLowerCase()
  const routeKeyword = extractRouteKeyword(lowerText)
  const exactId = extractUuid(lowerText)
  const searchQuery = buildSearchQueryText(normalizedText)
  const relativeDateRange = extractRelativeDateRange(lowerText)
  const exactDateRange = extractExactDateRange(lowerText)
  const dateRange = exactDateRange ?? relativeDateRange
  const status = extractStatusFilter(lowerText)
  const kind = extractKindFilter(lowerText)
  const amount = parseFlexibleAmount(lowerText)
  const intent = determineIntentFromText(lowerText)

  let targetPath = null

  if (routeKeyword) {
    targetPath = routeKeyword.path
  }

  if (exactId) {
    if (kind === 'loan' || /\b(pinjaman|loan)\b/.test(lowerText)) {
      targetPath = `/loan-payment/${exactId}`
    } else if (
      kind === 'bill' ||
      /\b(tagihan|invoice|bayar|pembayaran|lunas|partial|sisa)\b/.test(lowerText)
    ) {
      targetPath = `/payment/${exactId}`
    } else {
      targetPath = `/transactions/${exactId}`
    }
  }

  const search = {
    query: searchQuery,
    exactId,
    status,
    kind,
    amount,
    dateFrom: normalizeNullableText(dateRange?.dateFrom),
    dateTo: normalizeNullableText(dateRange?.dateTo),
  }

  if (intent === 'clarify' && !search.query && !search.exactId) {
    return {
      intent: 'clarify',
      targetPath: null,
      search,
      question:
        'Saya butuh filter yang lebih spesifik: ID, nama proyek/supplier, nominal, tanggal, atau status.',
      reason: null,
    }
  }

  return {
    intent,
    targetPath: normalizeAssistantRoutePath(targetPath),
    search,
    question: null,
    reason: null,
  }
}

function normalizePlannerObject(rawObject, fallbackText) {
  if (!rawObject || typeof rawObject !== 'object') {
    return buildDeterministicPlan(fallbackText)
  }

  const normalizedIntent = normalizeText(rawObject.intent, '').toLowerCase()
  const intent = allowedIntents.has(normalizedIntent)
    ? normalizedIntent
    : buildDeterministicPlan(fallbackText).intent
  const targetPath = normalizeAssistantRoutePath(rawObject.targetPath)
  const rawSearch = rawObject.search && typeof rawObject.search === 'object' ? rawObject.search : {}
  const exactId = extractUuid(rawSearch.exactId ?? rawSearch.id ?? rawObject.exactId ?? '')
  const status = allowedStatuses.has(
    normalizeText(rawSearch.status ?? rawObject.status, 'any').toLowerCase()
  )
    ? normalizeText(rawSearch.status ?? rawObject.status, 'any').toLowerCase()
    : 'any'
  const kind = allowedKinds.has(
    normalizeText(rawSearch.kind ?? rawObject.kind, 'all').toLowerCase()
  )
    ? normalizeText(rawSearch.kind ?? rawObject.kind, 'all').toLowerCase()
    : 'all'
  const amount = parseFlexibleAmount(
    normalizeText(rawSearch.amount ?? rawObject.amount, '')
  )
  const dateFrom = normalizeNullableText(
    rawSearch.dateFrom ?? rawObject.dateFrom ?? rawSearch.from ?? rawObject.from
  )
  const dateTo = normalizeNullableText(
    rawSearch.dateTo ?? rawObject.dateTo ?? rawSearch.to ?? rawObject.to
  )
  const question = normalizeNullableText(rawObject.question ?? rawObject.clarificationQuestion)
  const reason = normalizeNullableText(rawObject.reason ?? rawObject.refusalReason)
  const query = buildSearchQueryText(
    normalizeText(
      rawSearch.query ?? rawSearch.text ?? rawObject.query ?? rawObject.text ?? fallbackText,
      fallbackText
    )
  )

  return {
    intent,
    targetPath,
    search: {
      query,
      exactId,
      status,
      kind,
      amount,
      dateFrom,
      dateTo,
    },
    question,
    reason,
  }
}

function buildClassificationPrompt({ text, workspaceName, role, membershipsCount }) {
  return [
    'Kamu adalah classifier JSON untuk Telegram assistant read-only finance core.',
    'Aturan:',
    '- Intent hanya status, search, navigate, clarify, refuse.',
    '- Finance core only: jurnal, tagihan, pembayaran, pinjaman.',
    '- Jangan pernah menyarankan create/edit/delete/pay/approve/restore.',
    '- Jika user meminta payroll/gaji/upah/absensi/hrd/master/stok/tim, intent harus refuse.',
    '- Jika pesan ambigu, intent clarify dan berikan pertanyaan singkat.',
    '- Output harus JSON valid tanpa markdown atau penjelasan tambahan.',
    'Skema JSON:',
    '{',
    '  "intent": "status|search|navigate|clarify|refuse",',
    '  "targetPath": "/transactions|/transactions?tab=tagihan|/transactions/:id|/payment/:id|/loan-payment/:id|/pembayaran|null",',
    '  "search": {',
    '    "query": "string",',
    '    "exactId": "uuid or null",',
    '    "status": "any|paid|partial|unpaid",',
    '    "kind": "all|transaction|bill|loan",',
    '    "amount": 0,',
    '    "dateFrom": "YYYY-MM-DD or null",',
    '    "dateTo": "YYYY-MM-DD or null"',
    '  },',
    '  "question": "string or null",',
    '  "reason": "string or null"',
    '}',
    `Workspace aktif: ${workspaceName ?? '-'} | Role: ${role ?? '-'} | Membership aktif: ${membershipsCount ?? 0}`,
    `Pesan user: ${text}`,
  ].join('\n')
}

async function classifyAssistantMessage({
  text,
  workspaceName = null,
  role = null,
  membershipsCount = 0,
}) {
  const fallbackPlan = buildDeterministicPlan(text)
  const providerConfig = getAllowedBotProviderConfig()

  if (!providerConfig) {
    return fallbackPlan
  }

  try {
    const responseText = await postAssistantClassifierPrompt(
      providerConfig,
      buildClassificationPrompt({
        text,
        workspaceName,
        role,
        membershipsCount,
      })
    )
    const parsedResponse = extractJsonObject(responseText)

    return normalizePlannerObject(parsedResponse, text)
  } catch (error) {
    console.error('[api/telegram-assistant] classifier failed', {
      message: error instanceof Error ? error.message : String(error),
      provider: providerConfig.provider,
    })

    return fallbackPlan
  }
}

function normalizeRecordDateValue(row) {
  const values = [
    row?.sort_at,
    row?.transaction_date,
    row?.expense_date,
    row?.due_date,
    row?.created_at,
    row?.updated_at,
  ]

  for (const value of values) {
    const dateKey = toAppDateKey(value)

    if (dateKey) {
      return dateKey
    }
  }

  return ''
}

function normalizeAmountValue(value) {
  const amount = Number(value)

  return Number.isFinite(amount) ? amount : 0
}

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(normalizeAmountValue(value))
}

function formatDateLabel(value) {
  const parsedDate = new Date(String(value ?? ''))

  if (Number.isNaN(parsedDate.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeZone: APP_TIME_ZONE,
  }).format(parsedDate)
}

function formatStatusLabel(status, remainingAmount = 0) {
  const normalizedStatus = normalizeText(status, 'any').toLowerCase()
  const normalizedRemainingAmount = normalizeAmountValue(remainingAmount)

  if (normalizedRemainingAmount <= 0 || normalizedStatus === 'paid') {
    return 'Lunas'
  }

  if (normalizedStatus === 'partial') {
    return `Partial • Sisa ${formatCurrency(normalizedRemainingAmount)}`
  }

  if (normalizedStatus === 'unpaid') {
    return `Belum lunas • Sisa ${formatCurrency(normalizedRemainingAmount)}`
  }

  return `Sisa ${formatCurrency(normalizedRemainingAmount)}`
}

function getRowSourceLabel(row) {
  const sourceType = normalizeText(row?.source_type, '').toLowerCase()

  if (sourceType === 'project-income') {
    return 'Pemasukan Proyek'
  }

  if (sourceType === 'expense') {
    return 'Pengeluaran'
  }

  if (sourceType === 'loan-disbursement') {
    return 'Pinjaman'
  }

  return 'Transaksi'
}

function getRowPrimaryLabel(row) {
  const sourceType = normalizeText(row?.source_type, '').toLowerCase()

  if (sourceType === 'project-income') {
    return (
      normalizeText(row?.project_name_snapshot, null) ??
      normalizeText(row?.description, null) ??
      'Pemasukan proyek'
    )
  }

  if (sourceType === 'expense') {
    return (
      normalizeText(row?.supplier_name_snapshot, null) ??
      normalizeText(row?.description, null) ??
      'Pengeluaran'
    )
  }

  if (sourceType === 'loan-disbursement') {
    return (
      normalizeText(row?.creditor_name_snapshot, null) ??
      normalizeText(row?.description, null) ??
      'Pinjaman'
    )
  }

  return normalizeText(row?.description, null) ?? 'Transaksi'
}

function getRowSecondaryLabel(row) {
  const sourceType = normalizeText(row?.source_type, '').toLowerCase()

  if (sourceType === 'project-income') {
    return normalizeText(row?.description, null) ?? normalizeText(row?.bill_description, null)
  }

  if (sourceType === 'expense') {
    return normalizeText(row?.description, null) ?? normalizeText(row?.bill_description, null)
  }

  if (sourceType === 'loan-disbursement') {
    return normalizeText(row?.description, null)
  }

  return normalizeText(row?.description, null)
}

function isPayrollRow(row) {
  return normalizeText(row?.bill_type, '').toLowerCase() === 'gaji'
}

function isFinanceCoreRow(row) {
  const sourceType = normalizeText(row?.source_type, '').toLowerCase()

  return financeCoreScopes.has(sourceType)
}

function filterRowsByPlan(rows, plan) {
  const normalizedPlan = plan ?? {}
  const exactId = normalizeText(normalizedPlan.search?.exactId, null)
  const searchQuery = normalizeText(normalizedPlan.search?.query, '').toLowerCase()
  const status = normalizeText(normalizedPlan.search?.status, 'any').toLowerCase()
  const kind = normalizeText(normalizedPlan.search?.kind, 'all').toLowerCase()
  const amount = normalizeAmountValue(normalizedPlan.search?.amount)
  const dateFrom = normalizeText(normalizedPlan.search?.dateFrom, null)
  const dateTo = normalizeText(normalizedPlan.search?.dateTo, null)

  let filteredRows = [...(rows ?? [])]
    .filter((row) => row && isFinanceCoreRow(row) && !isPayrollRow(row))

  if (kind === 'loan') {
    filteredRows = filteredRows.filter(
      (row) => normalizeText(row?.source_type, '').toLowerCase() === 'loan-disbursement'
    )
  } else if (kind === 'bill') {
    filteredRows = filteredRows.filter((row) => normalizeText(row?.bill_id, null))
  } else if (kind === 'transaction') {
    filteredRows = filteredRows.filter((row) =>
      ['project-income', 'expense', 'loan-disbursement'].includes(
        normalizeText(row?.source_type, '').toLowerCase()
      )
    )
  }

  if (status !== 'any') {
    filteredRows = filteredRows.filter(
      (row) => normalizeText(row?.bill_status, 'any').toLowerCase() === status
    )
  }

  if (amount > 0) {
    filteredRows = filteredRows.filter((row) => {
      const candidates = [
        normalizeAmountValue(row?.amount),
        normalizeAmountValue(row?.bill_amount),
        normalizeAmountValue(row?.bill_remaining_amount),
      ]

      return candidates.some((candidate) => Math.abs(candidate - amount) < 0.01)
    })
  }

  if (dateFrom || dateTo) {
    filteredRows = filteredRows.filter((row) => {
      const dateKey = normalizeRecordDateValue(row)

      if (!dateKey) {
        return false
      }

      if (dateFrom && dateKey < dateFrom) {
        return false
      }

      if (dateTo && dateKey > dateTo) {
        return false
      }

      return true
    })
  }

  if (exactId) {
    filteredRows = filteredRows.filter((row) => {
      const rowId = normalizeText(row?.id, '').toLowerCase()
      const billId = normalizeText(row?.bill_id, '').toLowerCase()

      return rowId === exactId || billId === exactId
    })
  }

  if (searchQuery) {
    const queryTerms = searchQuery
      .split(/\s+/)
      .map((term) => normalizeText(term, '').toLowerCase())
      .filter(Boolean)

    filteredRows = filteredRows.filter((row) => {
      const haystack = normalizeText(row?.search_text, '').toLowerCase()

      return queryTerms.every((term) => haystack.includes(term))
    })
  }

  return filteredRows
}

async function loadWorkspaceRows(adminClient, teamId, plan, { limit = 12, outstandingOnly = false } = {}) {
  const normalizedTeamId = normalizeTelegramId(teamId)
  const searchQuery = normalizeText(plan?.search?.query, '').toLowerCase()
  const exactId = normalizeText(plan?.search?.exactId, null)
  const normalizedLimit = Number.isFinite(Number(limit))
    ? Math.min(Math.max(Number(limit), 1), 50)
    : 12

  let query = adminClient
    .from('vw_workspace_transactions')
    .select(assistantSelectColumns)
    .eq('team_id', normalizedTeamId)

  if (outstandingOnly) {
    query = query.gt('bill_remaining_amount', 0)
  }

  if (exactId) {
    query = query.or(`id.eq.${exactId},bill_id.eq.${exactId}`)
  } else if (searchQuery) {
    query = query.ilike('search_text', `%${searchQuery}%`)
  }

  query = query.order('sort_at', { ascending: false }).limit(normalizedLimit)

  const { data, error } = await query

  if (error) {
    throw error
  }

  return filterRowsByPlan(data ?? [], plan)
}

function buildRouteForRow(row, plan = {}) {
  const explicitTarget = normalizeAssistantRoutePath(plan?.targetPath)

  if (explicitTarget) {
    return explicitTarget
  }

  const sourceType = normalizeText(row?.source_type, '').toLowerCase()
  const queryText = normalizeText(plan?.search?.query, '').toLowerCase()
  const wantsPaymentSurface = /\b(tagihan|pembayaran|payment|bayar|lunas|partial|sisa)\b/.test(
    queryText
  )

  if (sourceType === 'loan-disbursement') {
    return `/loan-payment/${row.id}`
  }

  if (normalizeText(row?.bill_id, null) && normalizeAmountValue(row?.bill_remaining_amount) > 0) {
    if (wantsPaymentSurface || normalizeText(plan?.intent, '') === 'status') {
      return `/payment/${row.bill_id}`
    }
  }

  return `/transactions/${row.id}`
}

function buildRowSummary(row) {
  const sourceLabel = getRowSourceLabel(row)
  const primaryLabel = getRowPrimaryLabel(row)
  const secondaryLabel = getRowSecondaryLabel(row)
  const amountLabel = formatCurrency(row?.amount ?? row?.bill_amount ?? 0)
  const remainingLabel = formatStatusLabel(row?.bill_status, row?.bill_remaining_amount)
  const dateLabel = formatDateLabel(row?.sort_at ?? row?.transaction_date ?? row?.expense_date ?? row?.due_date ?? row?.created_at)

  const lines = [
    `${sourceLabel} — ${primaryLabel}`,
    secondaryLabel ? `• ${secondaryLabel}` : null,
    `• ${amountLabel}`,
    `• ${remainingLabel}`,
    `• ${dateLabel}`,
  ].filter(Boolean)

  return lines.join('\n')
}

function buildSearchReply(rows, plan) {
  const routeButtons = []
  const lines = []
  const queryLabel = normalizeText(plan?.search?.query, '')

  if (rows.length === 0) {
    return {
      text:
        queryLabel.length > 0
          ? `Belum ketemu data yang cocok untuk "${queryLabel}".\nTambah ID, nama proyek/supplier, nominal, tanggal, atau status yang lebih spesifik.`
          : 'Belum ketemu data yang cocok.\nTambah ID, nama proyek/supplier, nominal, tanggal, atau status yang lebih spesifik.',
      buttons: [],
      needsClarification: true,
    }
  }

  lines.push(
    queryLabel.length > 0
      ? `Saya menemukan ${rows.length} data paling relevan untuk "${queryLabel}":`
      : `Saya menemukan ${rows.length} data paling relevan:`
  )

  rows.slice(0, 3).forEach((row, index) => {
    const path = buildRouteForRow(row, plan)
    const buttonLabel =
      path.startsWith('/payment') || path.startsWith('/loan-payment')
        ? 'Buka pembayaran'
        : 'Buka detail'

    routeButtons.push({
      text: buttonLabel,
      path,
    })

    lines.push(`${index + 1}. ${buildRowSummary(row).replaceAll('\n', ' ')}`)
  })

  if (rows.length > 3) {
    lines.push(`Dan ${rows.length - 3} hasil lain yang serupa.`)
  }

  return {
    text: lines.join('\n'),
    buttons: routeButtons,
    needsClarification: false,
  }
}

function groupOutstandingRows(rows) {
  return rows.reduce(
    (groups, row) => {
      const sourceType = normalizeText(row?.source_type, '').toLowerCase()

      if (sourceType === 'loan-disbursement') {
        groups.loans.push(row)
      } else {
        groups.bills.push(row)
      }

      return groups
    },
    {
      bills: [],
      loans: [],
    }
  )
}

function buildStatusReply(rows, plan) {
  const queryLabel = normalizeText(plan?.search?.query, '')
  const groupedRows = groupOutstandingRows(rows)
  const totalBillRemaining = groupedRows.bills.reduce(
    (sum, row) => sum + normalizeAmountValue(row?.bill_remaining_amount),
    0
  )
  const totalLoanRemaining = groupedRows.loans.reduce(
    (sum, row) => sum + normalizeAmountValue(row?.bill_remaining_amount),
    0
  )
  const lines = []
  const buttons = []

  if (groupedRows.bills.length === 0 && groupedRows.loans.length === 0) {
    return {
      text:
        queryLabel.length > 0
          ? `Tidak ada tagihan atau pinjaman outstanding yang cocok untuk "${queryLabel}".\nBuka Jurnal untuk melihat riwayat lengkap.`
          : 'Tidak ada tagihan atau pinjaman outstanding yang cocok.\nBuka Jurnal untuk melihat riwayat lengkap.',
      buttons: [
        {
          text: 'Buka Jurnal',
          path: '/transactions',
        },
      ],
      needsClarification: false,
    }
  }

  lines.push(
    queryLabel.length > 0
      ? `Status untuk "${queryLabel}":`
      : 'Status finance core workspace ini:'
  )

  if (groupedRows.bills.length > 0) {
    lines.push(
      `• Tagihan aktif: ${groupedRows.bills.length} item, sisa ${formatCurrency(totalBillRemaining)}`
    )
  }

  if (groupedRows.loans.length > 0) {
    lines.push(
      `• Pinjaman aktif: ${groupedRows.loans.length} item, sisa ${formatCurrency(totalLoanRemaining)}`
    )
  }

  rows.slice(0, 3).forEach((row) => {
    buttons.push({
      text:
        buildRouteForRow(row, plan).startsWith('/payment') ||
        buildRouteForRow(row, plan).startsWith('/loan-payment')
          ? 'Buka pembayaran'
          : 'Buka detail',
      path: buildRouteForRow(row, plan),
    })
  })

  if (buttons.length === 0) {
    buttons.push({
      text: 'Buka Jurnal',
      path: '/transactions',
    })
  }

  return {
    text: lines.join('\n'),
    buttons,
    needsClarification: false,
  }
}

function buildNavigateReply(plan) {
  const path = normalizeAssistantRoutePath(plan?.targetPath) ?? '/transactions'
  const routeLabelMap = new Map([
    ['/transactions', 'Jurnal'],
    ['/transactions?tab=history', 'Riwayat'],
    ['/transactions?tab=tagihan', 'Tagihan'],
    ['/pembayaran', 'Pembayaran'],
  ])
  const routeLabel = routeLabelMap.get(path) ?? 'halaman tujuan'

  return {
    text: `Membuka ${routeLabel}.`,
    buttons: [
      {
        text: `Buka ${routeLabel}`,
        path,
      },
    ],
    needsClarification: false,
  }
}

function buildRefusalReply(reason) {
  return {
    text:
      reason ||
      'Saya hanya melayani finance core read-only: jurnal, tagihan, pembayaran, dan pinjaman. Permintaan ini berada di luar scope v1 atau bersifat mutasi.',
    buttons: [],
    needsClarification: false,
  }
}

function buildClarifyReply(question, fallbackText = null) {
  return {
    text:
      normalizeText(question, null) ||
      normalizeText(fallbackText, null) ||
      'Saya butuh filter yang lebih spesifik: ID, nama proyek/supplier, nominal, tanggal, atau status.',
    buttons: [],
    needsClarification: true,
  }
}

function buildReplyMarkup(botUsername, buttons = []) {
  const rows = buttons
    .map((button) => {
      const link = buildTelegramAssistantLink(botUsername, button.path)

      return link
        ? [
            {
              text: normalizeText(button.text, 'Buka detail'),
              url: link,
            },
          ]
        : null
    })
    .filter(Boolean)

  return rows.length > 0 ? { inline_keyboard: rows } : null
}

function buildRouteChoiceFromText(text, memberships) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  if (/^\d+$/.test(normalizedText)) {
    const index = Number(normalizedText) - 1

    return memberships[index] ?? null
  }

  return (
    memberships.find((membership) => {
      const values = [
        membership.team_name,
        membership.team_slug,
        membership.role,
      ]
        .map((value) => normalizeText(value, '').toLowerCase())
        .filter(Boolean)

      return values.some((value) => normalizedText.includes(value))
    }) ?? null
  )
}

function isCancelText(text) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  return ['batal', 'cancel', 'keluar', 'stop'].some((keyword) =>
    normalizedText.includes(keyword)
  )
}

function buildPendingSessionPayload(text, plan) {
  return {
    original_text: normalizeText(text, ''),
    original_plan: plan,
  }
}

async function handleWorkspaceChoice({
  adminClient,
  botToken,
  chatId,
  replyToMessageId,
  session,
  memberships,
  incomingText,
  callbackQueryId = null,
}) {
  if (callbackQueryId) {
    await answerTelegramCallback({
      botToken,
      callbackQueryId,
      text: 'Workspace dipilih.',
    })
  }

  if (isCancelText(incomingText)) {
    await clearAssistantSession(adminClient, chatId)

    await sendTelegramMessage({
      botToken,
      chatId,
      text: 'Pilihan workspace dibatalkan.',
      replyToMessageId,
    })

    return { processed: true }
  }

  const selectedMembership = buildRouteChoiceFromText(incomingText, memberships)

  if (!selectedMembership) {
    const choiceMessage = buildWorkspaceChoiceMessage(memberships)
    const choiceMarkup = buildWorkspaceChoiceMarkup(memberships)

    await sendTelegramMessage({
      botToken,
      chatId,
      text: choiceMessage,
      replyMarkup: choiceMarkup,
      replyToMessageId,
    })

    return { processed: true }
  }

  const pendingPayload = session?.pending_payload ?? {}
  const originalText = normalizeText(pendingPayload.original_text, '')
  const originalPlan = pendingPayload.original_plan ?? null

  await saveAssistantSession(adminClient, {
    chatId,
    telegramUserId: session.telegram_user_id,
    teamId: selectedMembership.team_id,
    state: 'idle',
    pendingIntent: null,
    pendingPayload: {},
  })

  return {
    processed: false,
    forcedMembership: selectedMembership,
    originalText,
    originalPlan,
  }
}

async function processTelegramMessage({
  adminClient,
  botToken,
  chatId,
  replyToMessageId,
  telegramUserId,
  messageText,
  session,
  memberships,
  forcedMembership = null,
  forcedOriginalText = null,
  forcedOriginalPlan = null,
}) {
  const effectiveText = normalizeText(forcedOriginalText ?? messageText, '')

  if (!effectiveText) {
    return {
      processed: true,
    }
  }

  if (session?.state === 'awaiting_clarification' && !forcedMembership) {
    const pendingPayload = session.pending_payload ?? {}
    const combinedText = [
      normalizeText(pendingPayload.original_text, ''),
      effectiveText,
    ]
      .filter(Boolean)
      .join(' ')
      .trim()

    await saveAssistantSession(adminClient, {
      chatId,
      telegramUserId,
      teamId: session.team_id ?? null,
      state: 'idle',
      pendingIntent: null,
      pendingPayload: {},
    })

    return processTelegramMessage({
      adminClient,
      botToken,
      chatId,
      replyToMessageId,
      telegramUserId,
      messageText: combinedText,
      session: null,
      memberships,
      forcedMembership: memberships.find((membership) => membership.team_id === session.team_id) ?? null,
      forcedOriginalText: combinedText,
      forcedOriginalPlan: pendingPayload.original_plan ?? null,
    })
  }

  const workspaceMembership =
    forcedMembership ??
    memberships.find((membership) => membership.team_id === session?.team_id) ??
    memberships[0] ??
    null

  if (!workspaceMembership) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text:
        'Saya tidak menemukan workspace aktif untuk akun ini. Hubungi admin untuk membership yang aktif.',
      replyToMessageId,
    })

    return { processed: true }
  }

  const activeMemberships = memberships.filter((membership) => membership.team_is_active)
  const multipleMemberships = activeMemberships.length > 1
  const selectedMembership =
    workspaceMembership ??
    activeMemberships.find((membership) => membership.is_default) ??
    activeMemberships[0] ??
    null

  if (!selectedMembership) {
    await sendTelegramMessage({
      botToken,
      chatId,
      text:
        'Saya tidak menemukan membership aktif yang bisa dipakai untuk workspace ini.',
      replyToMessageId,
    })

    return { processed: true }
  }

  if (
    !forcedMembership &&
    multipleMemberships &&
    !session?.team_id &&
    !selectedMembership.is_default &&
    session?.state !== 'awaiting_workspace_choice'
  ) {
    await saveAssistantSession(adminClient, {
      chatId,
      telegramUserId,
      teamId: null,
      state: 'awaiting_workspace_choice',
      pendingIntent: null,
      pendingPayload: buildPendingSessionPayload(effectiveText, null),
    })

    const choiceMarkup = buildWorkspaceChoiceMarkup(activeMemberships)

    await sendTelegramMessage({
      botToken,
      chatId,
      text: buildWorkspaceChoiceMessage(activeMemberships),
      replyMarkup: choiceMarkup,
      replyToMessageId,
    })

    return { processed: true }
  }

  const plan =
    forcedOriginalPlan ??
    (session?.state === 'awaiting_workspace_choice'
      ? session.pending_payload?.original_plan ?? null
      : null)

  const normalizedPlan =
    plan && typeof plan === 'object'
      ? normalizePlannerObject(plan, effectiveText)
      : await classifyAssistantMessage({
          text: effectiveText,
          workspaceName: selectedMembership.team_name,
          role: selectedMembership.role,
          membershipsCount: activeMemberships.length,
        })

  if (normalizedPlan.intent === 'refuse') {
    await clearAssistantSession(adminClient, chatId)

    const refusalReply = buildRefusalReply(normalizedPlan.reason)

    await sendTelegramMessage({
      botToken,
      chatId,
      text: refusalReply.text,
      replyToMessageId,
    })

    return { processed: true }
  }

  if (normalizedPlan.intent === 'navigate') {
    await clearAssistantSession(adminClient, chatId)

    const navigateReply = buildNavigateReply(normalizedPlan)

    await sendTelegramMessage({
      botToken,
      chatId,
      text: navigateReply.text,
      replyMarkup: buildReplyMarkup(getTelegramBotUsername(), navigateReply.buttons),
      replyToMessageId,
    })

    return { processed: true }
  }

  if (normalizedPlan.intent === 'clarify') {
    await saveAssistantSession(adminClient, {
      chatId,
      telegramUserId,
      teamId: selectedMembership.team_id,
      state: 'awaiting_clarification',
      pendingIntent: normalizedPlan.intent,
      pendingPayload: buildPendingSessionPayload(effectiveText, normalizedPlan),
    })

    const clarifyReply = buildClarifyReply(normalizedPlan.question)

    await sendTelegramMessage({
      botToken,
      chatId,
      text: clarifyReply.text,
      replyToMessageId,
    })

    return { processed: true }
  }

  const outstandingOnly =
    normalizedPlan.intent === 'status' &&
    !normalizeText(normalizedPlan.search?.exactId, null)
  const rows = await loadWorkspaceRows(adminClient, selectedMembership.team_id, normalizedPlan, {
    limit: 12,
    outstandingOnly,
  })

  const reply =
    normalizedPlan.intent === 'status'
      ? buildStatusReply(rows, normalizedPlan)
      : buildSearchReply(rows, normalizedPlan)

  if (reply.needsClarification) {
    await saveAssistantSession(adminClient, {
      chatId,
      telegramUserId,
      teamId: selectedMembership.team_id,
      state: 'awaiting_clarification',
      pendingIntent: normalizedPlan.intent,
      pendingPayload: buildPendingSessionPayload(effectiveText, normalizedPlan),
    })
  } else {
    await clearAssistantSession(adminClient, chatId)
  }

  await sendTelegramMessage({
    botToken,
    chatId,
    text: reply.text,
    replyMarkup: buildReplyMarkup(getTelegramBotUsername(), reply.buttons),
    replyToMessageId,
  })

  return { processed: true }
}

async function handleCallbackQuery({
  adminClient,
  botToken,
  callbackQuery,
}) {
  const callbackData = normalizeText(callbackQuery?.data, '')

  if (!callbackData.startsWith('ws:')) {
    return { processed: false }
  }

  const chatId = normalizeTelegramId(callbackQuery?.message?.chat?.id)
  const telegramUserId = normalizeTelegramId(callbackQuery?.from?.id)
  const session = await loadAssistantSession(adminClient, chatId)

  if (!session) {
    await answerTelegramCallback({
      botToken,
      callbackQueryId: callbackQuery.id,
      text: 'Sesi sudah kedaluwarsa. Kirim ulang pesan.',
      showAlert: true,
    })

    return { processed: true }
  }

  const memberships = await loadActiveMemberships(adminClient, telegramUserId)
  const selectedTeamId = callbackData.slice(3)
  const selectedMembership =
    memberships.find((membership) => membership.team_id === selectedTeamId) ?? null

  if (!selectedMembership) {
    await answerTelegramCallback({
      botToken,
      callbackQueryId: callbackQuery.id,
      text: 'Workspace tidak ditemukan.',
      showAlert: true,
    })

    return { processed: true }
  }

  const pendingPayload = session.pending_payload ?? {}
  const originalText = normalizeText(pendingPayload.original_text, '')
  const originalPlan = pendingPayload.original_plan ?? null

  await saveAssistantSession(adminClient, {
    chatId,
    telegramUserId,
    teamId: selectedMembership.team_id,
    state: 'idle',
    pendingIntent: null,
    pendingPayload: {},
  })

  await answerTelegramCallback({
    botToken,
    callbackQueryId: callbackQuery.id,
    text: `${selectedMembership.team_name ?? 'Workspace'} dipilih.`,
  })

  if (!originalText) {
    return { processed: true }
  }

  return processTelegramMessage({
    adminClient,
    botToken,
    chatId,
    replyToMessageId: callbackQuery?.message?.message_id ?? null,
    telegramUserId,
    messageText: originalText,
    session: null,
    memberships,
    forcedMembership: selectedMembership,
    forcedOriginalText: originalText,
    forcedOriginalPlan: originalPlan,
  })
}

async function processTelegramUpdate(adminClient, botToken, update) {
  if (update?.callback_query) {
    return handleCallbackQuery({
      adminClient,
      botToken,
      callbackQuery: update.callback_query,
    })
  }

  const message = update?.message ?? update?.edited_message ?? null

  if (!message) {
    return { processed: false }
  }

  const chatId = normalizeTelegramId(message?.chat?.id)
  const telegramUserId = normalizeTelegramId(message?.from?.id)
  const messageText = normalizeText(message?.text ?? message?.caption, '')

  if (!chatId || !telegramUserId) {
    return { processed: false }
  }

  const session = await loadAssistantSession(adminClient, chatId)
  const memberships = await loadActiveMemberships(adminClient, telegramUserId)
  const activeMemberships = memberships.filter((membership) => membership.team_is_active)

  if (activeMemberships.length === 0) {
    await clearAssistantSession(adminClient, chatId)

    await sendTelegramMessage({
      botToken,
      chatId,
      text:
        'Akun ini belum punya membership workspace aktif. Hubungi admin untuk akses workspace yang valid.',
      replyToMessageId: message?.message_id ?? null,
    })

    return { processed: true }
  }

  if (session?.state === 'awaiting_workspace_choice') {
    return handleWorkspaceChoice({
      adminClient,
      botToken,
      chatId,
      replyToMessageId: message?.message_id ?? null,
      session,
      memberships: activeMemberships,
      incomingText: messageText,
    })
  }

  return processTelegramMessage({
    adminClient,
    botToken,
    chatId,
    replyToMessageId: message?.message_id ?? null,
    telegramUserId,
    messageText,
    session,
    memberships: activeMemberships,
  })
}

function getSupabaseConfig() {
  const supabaseUrl = getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL'))
  const publishableKey = getEnv(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    getEnv('VITE_SUPABASE_ANON_KEY')
  )
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', publishableKey)

  return {
    supabaseUrl,
    serviceRoleKey,
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        ok: false,
        error: 'Method tidak diizinkan.',
      })
    }

    assertWebhookSecret(req)

    const botToken = getEnv('TELEGRAM_BOT_TOKEN')

    if (!botToken) {
      throw createHttpError(500, 'TELEGRAM_BOT_TOKEN belum dikonfigurasi.')
    }

    const { supabaseUrl, serviceRoleKey } = getSupabaseConfig()

    if (!supabaseUrl || !serviceRoleKey) {
      throw createHttpError(500, 'Konfigurasi Supabase assistant belum lengkap.')
    }

    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)
    const update = await parseRequestBody(req)
    const result = await processTelegramUpdate(adminClient, botToken, update)

    return res.status(200).json({
      ok: true,
      processed: Boolean(result?.processed),
    })
  } catch (error) {
    console.error('[api/telegram-assistant] failed', {
      message: error instanceof Error ? error.message : String(error),
      statusCode: typeof error?.statusCode === 'number' ? error.statusCode : 500,
      webhookSecretConfigured: isWebhookSecretEnabled(),
    })

    return res.status(200).json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat memproses assistant Telegram.',
    })
  }
}
