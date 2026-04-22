const ASSISTANT_START_PARAM_PREFIX = 'nav_'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function encodeBase64Url(value) {
  const normalizedValue = normalizeText(value, '')

  if (!normalizedValue) {
    return ''
  }

  if (typeof globalThis.Buffer !== 'undefined') {
    return globalThis.Buffer.from(normalizedValue, 'utf8').toString('base64url')
  }

  const bytes = new TextEncoder().encode(normalizedValue)
  let binaryValue = ''

  for (const byte of bytes) {
    binaryValue += String.fromCharCode(byte)
  }

  return btoa(binaryValue)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function decodeBase64Url(value) {
  const normalizedValue = normalizeText(value, '')

  if (!normalizedValue) {
    return ''
  }

  if (typeof globalThis.Buffer !== 'undefined') {
    return globalThis.Buffer.from(normalizedValue, 'base64url').toString('utf8')
  }

  const normalizedBase64 = normalizedValue
    .replaceAll('-', '+')
    .replaceAll('_', '/')

  const paddedBase64 = normalizedBase64.padEnd(
    normalizedBase64.length + ((4 - (normalizedBase64.length % 4)) % 4),
    '='
  )
  const binaryValue = atob(paddedBase64)
  const bytes = Uint8Array.from(binaryValue, (character) => character.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

function normalizeAssistantRoutePath(path) {
  const normalizedPath = normalizeText(path, '')

  if (!normalizedPath.startsWith('/')) {
    return null
  }

  let parsedUrl = null

  try {
    parsedUrl = new URL(normalizedPath, 'https://assistant.local')
  } catch {
    return null
  }

  const pathname = parsedUrl.pathname
  const search = parsedUrl.search

  if (pathname === '/' && !search) {
    return '/'
  }

  if (pathname === '/transactions') {
    if (!search) {
      return '/transactions'
    }

    const tab = parsedUrl.searchParams.get('tab')

    if (
      parsedUrl.searchParams.size === 1 &&
      ['aktif', 'history', 'tagihan'].includes(tab)
    ) {
      return `/transactions?tab=${tab}`
    }

    return null
  }

  if (pathname === '/pembayaran' && !search) {
    return '/pembayaran'
  }

  if (/^\/transactions\/[A-Za-z0-9-]+$/.test(pathname) && !search) {
    return pathname
  }

  if (/^\/payment\/[A-Za-z0-9-]+$/.test(pathname) && !search) {
    return pathname
  }

  if (/^\/loan-payment\/[A-Za-z0-9-]+$/.test(pathname) && !search) {
    return pathname
  }

  return null
}

function buildTelegramAssistantStartParam(path) {
  const normalizedPath = normalizeAssistantRoutePath(path)

  if (!normalizedPath) {
    return null
  }

  const encodedPath = encodeBase64Url(normalizedPath)

  return encodedPath ? `${ASSISTANT_START_PARAM_PREFIX}${encodedPath}` : null
}

function parseTelegramAssistantStartParam(startParam) {
  const normalizedStartParam = normalizeText(startParam, '')

  if (!normalizedStartParam.startsWith(ASSISTANT_START_PARAM_PREFIX)) {
    return null
  }

  const encodedPath = normalizedStartParam.slice(ASSISTANT_START_PARAM_PREFIX.length)

  if (!encodedPath) {
    return null
  }

  const decodedPath = decodeBase64Url(encodedPath)

  return normalizeAssistantRoutePath(decodedPath)
}

function buildTelegramAssistantLink(botUsername, path) {
  const normalizedBotUsername = normalizeText(botUsername, '')
  const startParam = buildTelegramAssistantStartParam(path)

  if (!normalizedBotUsername || !startParam) {
    return null
  }

  return `https://t.me/${normalizedBotUsername}/app?startapp=${encodeURIComponent(startParam)}`
}

export {
  ASSISTANT_START_PARAM_PREFIX,
  buildTelegramAssistantLink,
  buildTelegramAssistantStartParam,
  normalizeAssistantRoutePath,
  parseTelegramAssistantStartParam,
}
