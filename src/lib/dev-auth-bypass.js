const DEV_AUTH_BYPASS_QUERY_KEYS = ['devAuthBypass', 'tgDevBypass', 'mockTelegram']
const DEV_AUTH_BYPASS_STORAGE_KEY = 'banplex.dev-auth-bypass'
const DEV_AUTH_USER_ID = '20002'
const DEV_AUTH_TEAM_ID = 'dev-team'
const DEV_AUTH_TEAM_NAME = 'Local Dev Team'
const DEV_AUTH_TEAM_SLUG = 'local-dev'
const DEV_AUTH_ACCESS_TOKEN = 'dev-local-access-token'
const DEV_AUTH_REFRESH_TOKEN = 'dev-local-refresh-token'
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off'])

function normalizeBooleanFlag(value) {
  const normalizedValue = String(value ?? '').trim().toLowerCase()

  if (!normalizedValue) {
    return null
  }

  if (TRUE_VALUES.has(normalizedValue)) {
    return true
  }

  if (FALSE_VALUES.has(normalizedValue)) {
    return false
  }

  return null
}

function isBrowserEnvironment() {
  return typeof window !== 'undefined'
}

function readQueryPreference() {
  if (!isBrowserEnvironment()) {
    return null
  }

  const searchParams = new URLSearchParams(window.location.search)

  for (const key of DEV_AUTH_BYPASS_QUERY_KEYS) {
    const normalizedPreference = normalizeBooleanFlag(searchParams.get(key))

    if (normalizedPreference !== null) {
      return normalizedPreference
    }
  }

  return null
}

function readStoredPreference() {
  if (!isBrowserEnvironment()) {
    return null
  }

  try {
    return normalizeBooleanFlag(
      window.sessionStorage.getItem(DEV_AUTH_BYPASS_STORAGE_KEY)
    )
  } catch {
    return null
  }
}

function persistPreference(enabled) {
  if (!isBrowserEnvironment()) {
    return
  }

  try {
    if (enabled) {
      window.sessionStorage.setItem(DEV_AUTH_BYPASS_STORAGE_KEY, '1')
      return
    }

    window.sessionStorage.removeItem(DEV_AUTH_BYPASS_STORAGE_KEY)
  } catch {
    return
  }
}

function isDevAuthBypassEnabled() {
  if (!import.meta.env.DEV || !isBrowserEnvironment()) {
    return false
  }

  const queryPreference = readQueryPreference()

  if (queryPreference !== null) {
    persistPreference(queryPreference)
    return queryPreference
  }

  const storedPreference = readStoredPreference()

  if (storedPreference !== null) {
    return storedPreference
  }

  return true
}

function createLocalDevAuthBootstrap() {
  return {
    user: {
      id: 'dev-profile',
      telegram_user_id: DEV_AUTH_USER_ID,
      name: 'Local Dev',
    },
    memberships: [
      {
        id: 'dev-membership',
        team_id: DEV_AUTH_TEAM_ID,
        telegram_user_id: DEV_AUTH_USER_ID,
        role: 'Owner',
        is_default: true,
        status: 'active',
        approved_at: null,
        team_name: DEV_AUTH_TEAM_NAME,
        team_slug: DEV_AUTH_TEAM_SLUG,
        team_is_active: true,
      },
    ],
    currentTeamId: DEV_AUTH_TEAM_ID,
    role: 'Owner',
    isRegistered: true,
  }
}

function createLocalDevSupabaseSession() {
  return {
    access_token: DEV_AUTH_ACCESS_TOKEN,
    refresh_token: DEV_AUTH_REFRESH_TOKEN,
    expires_at: null,
    expires_in: null,
    token_type: 'bearer',
    user: {
      id: 'dev-auth-user',
      email: 'telegram-20002@banplex.local',
      role: 'authenticated',
    },
  }
}

export {
  createLocalDevAuthBootstrap,
  createLocalDevSupabaseSession,
  isDevAuthBypassEnabled,
}
