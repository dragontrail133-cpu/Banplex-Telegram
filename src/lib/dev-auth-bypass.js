const DEV_AUTH_BYPASS_QUERY_KEYS = ['devAuthBypass', 'tgDevBypass', 'mockTelegram']
const DEV_AUTH_BYPASS_STORAGE_KEY = 'banplex.dev-auth-bypass'
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

  return readStoredPreference() === true
}

export { isDevAuthBypassEnabled }
