import { normalizeRole } from './rbac.js'

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function getInviteLifecycleStatus(invite, referenceTime = Date.now()) {
  if (invite?.is_used) {
    return 'used'
  }

  const expiresAt = invite?.expires_at ? new Date(invite.expires_at) : null

  if (expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < referenceTime) {
    return 'expired'
  }

  return 'active'
}

function getInviteLifecycleLabel(invite, referenceTime = Date.now()) {
  const lifecycleStatus = getInviteLifecycleStatus(invite, referenceTime)

  if (lifecycleStatus === 'used') {
    return 'Dipakai'
  }

  if (lifecycleStatus === 'expired') {
    return 'Kedaluwarsa'
  }

  return 'Aktif'
}

function buildInviteLink(token, botUsername) {
  const normalizedToken = normalizeText(token, null)
  const normalizedBotUsername = normalizeText(botUsername, null)

  if (!normalizedToken || !normalizedBotUsername) {
    return null
  }

  return `https://t.me/${normalizedBotUsername}?startapp=${encodeURIComponent(normalizedToken)}`
}

function mapInviteToken(invite, botUsername = null, referenceTime = Date.now()) {
  const token = normalizeText(invite?.token, null)

  return {
    id: invite?.id ?? null,
    team_id: normalizeText(invite?.team_id, null),
    token,
    role: normalizeRole(invite?.role),
    expires_at: normalizeText(invite?.expires_at, null),
    is_used: Boolean(invite?.is_used),
    created_at: normalizeText(invite?.created_at, null),
    invite_link: token ? buildInviteLink(token, botUsername) : null,
    lifecycle_status: getInviteLifecycleStatus(invite, referenceTime),
    lifecycle_status_label: getInviteLifecycleLabel(invite, referenceTime),
  }
}

export {
  buildInviteLink,
  getInviteLifecycleLabel,
  getInviteLifecycleStatus,
  mapInviteToken,
}
