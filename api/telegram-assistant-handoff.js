import crypto from 'node:crypto'

import { normalizeAssistantPendingPayload } from '../src/lib/telegram-assistant-session.js'

const TELEGRAM_ASSISTANT_HANDOFF_TOKEN_PREFIX = 'dh_'
const TELEGRAM_ASSISTANT_HANDOFF_LANGUAGES = new Set(['id', 'su'])
const TELEGRAM_ASSISTANT_HANDOFF_SELECT_COLUMNS =
  'id, token_hash, source_chat_id, source_message_id, telegram_user_id, team_id, session_payload, original_text, language, expires_at, consumed_at, consumed_chat_id, created_at, updated_at'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function normalizeTelegramId(value) {
  return normalizeText(value, null)
}

function normalizeTelegramAssistantLanguage(language) {
  const normalizedLanguage = normalizeText(language, '').toLowerCase()

  return TELEGRAM_ASSISTANT_HANDOFF_LANGUAGES.has(normalizedLanguage)
    ? normalizedLanguage
    : 'id'
}

function createTelegramAssistantHandoffToken() {
  return `${TELEGRAM_ASSISTANT_HANDOFF_TOKEN_PREFIX}${crypto.randomBytes(16).toString('base64url')}`
}

function normalizeTelegramAssistantHandoffToken(token) {
  const normalizedToken = normalizeText(token, '').split(/\s+/)[0]

  if (!normalizedToken.startsWith(TELEGRAM_ASSISTANT_HANDOFF_TOKEN_PREFIX)) {
    return null
  }

  if (!/^dh_[A-Za-z0-9_-]{16,}$/.test(normalizedToken)) {
    return null
  }

  return normalizedToken
}

function hashTelegramAssistantHandoffToken(token) {
  const normalizedToken = normalizeTelegramAssistantHandoffToken(token)

  if (!normalizedToken) {
    return null
  }

  return crypto.createHash('sha256').update(normalizedToken).digest('hex')
}

function normalizeTelegramAssistantHandoffRow(row) {
  return {
    id: normalizeText(row?.id, null),
    token_hash: normalizeText(row?.token_hash, null),
    source_chat_id: normalizeText(row?.source_chat_id, null),
    source_message_id: normalizeText(row?.source_message_id, null),
    telegram_user_id: normalizeText(row?.telegram_user_id, null),
    team_id: normalizeText(row?.team_id, null),
    session_payload: normalizeAssistantPendingPayload(row?.session_payload),
    original_text: normalizeText(row?.original_text, ''),
    language: normalizeTelegramAssistantLanguage(row?.language),
    expires_at: normalizeText(row?.expires_at, null),
    consumed_at: normalizeText(row?.consumed_at, null),
    consumed_chat_id: normalizeText(row?.consumed_chat_id, null),
    created_at: normalizeText(row?.created_at, null),
    updated_at: normalizeText(row?.updated_at, null),
  }
}

async function saveTelegramAssistantHandoff(
  adminClient,
  {
    token,
    sourceChatId,
    sourceMessageId = null,
    telegramUserId,
    teamId = null,
    sessionPayload = {},
    originalText = '',
    language = 'id',
    expiresAt = null,
  } = {}
) {
  const normalizedToken = normalizeTelegramAssistantHandoffToken(token)
  const tokenHash = hashTelegramAssistantHandoffToken(normalizedToken)
  const normalizedSourceChatId = normalizeTelegramId(sourceChatId)
  const normalizedTelegramUserId = normalizeTelegramId(telegramUserId)
  const normalizedTeamId = normalizeTelegramId(teamId)
  const normalizedSessionPayload = normalizeAssistantPendingPayload(sessionPayload)
  const normalizedOriginalText = normalizeText(originalText, '')
  const normalizedLanguage = normalizeTelegramAssistantLanguage(language)
  const normalizedExpiresAt = normalizeText(
    expiresAt,
    new Date(Date.now() + 30 * 60 * 1000).toISOString()
  )

  if (!normalizedToken || !tokenHash || !normalizedSourceChatId || !normalizedTelegramUserId) {
    throw new Error('Telegram assistant handoff tidak lengkap.')
  }

  const { data, error } = await adminClient
    .from('telegram_assistant_handoffs')
    .insert({
      token_hash: tokenHash,
      source_chat_id: normalizedSourceChatId,
      source_message_id: normalizeTelegramId(sourceMessageId),
      telegram_user_id: normalizedTelegramUserId,
      team_id: normalizedTeamId || null,
      session_payload: normalizedSessionPayload,
      original_text: normalizedOriginalText,
      language: normalizedLanguage,
      expires_at: normalizedExpiresAt,
    })
    .select(TELEGRAM_ASSISTANT_HANDOFF_SELECT_COLUMNS)
    .single()

  if (error) {
    throw error
  }

  return normalizeTelegramAssistantHandoffRow(data)
}

async function redeemTelegramAssistantHandoff(
  adminClient,
  {
    token,
    telegramUserId,
    consumedChatId = null,
  } = {}
) {
  const normalizedToken = normalizeTelegramAssistantHandoffToken(token)

  if (!normalizedToken) {
    return null
  }

  const tokenHash = hashTelegramAssistantHandoffToken(normalizedToken)
  const normalizedTelegramUserId = normalizeTelegramId(telegramUserId)
  const normalizedConsumedChatId = normalizeTelegramId(consumedChatId)
  const nowIso = new Date().toISOString()

  const { data, error } = await adminClient
    .from('telegram_assistant_handoffs')
    .update({
      consumed_at: nowIso,
      consumed_chat_id: normalizedConsumedChatId,
      updated_at: nowIso,
    })
    .eq('token_hash', tokenHash)
    .eq('telegram_user_id', normalizedTelegramUserId)
    .is('consumed_at', null)
    .gt('expires_at', nowIso)
    .select(TELEGRAM_ASSISTANT_HANDOFF_SELECT_COLUMNS)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? normalizeTelegramAssistantHandoffRow(data) : null
}

export {
  TELEGRAM_ASSISTANT_HANDOFF_TOKEN_PREFIX,
  createTelegramAssistantHandoffToken,
  hashTelegramAssistantHandoffToken,
  normalizeTelegramAssistantHandoffToken,
  redeemTelegramAssistantHandoff,
  saveTelegramAssistantHandoff,
}
