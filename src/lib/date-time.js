export const APP_TIME_ZONE = 'Asia/Jakarta'

const dateKeyFormatter = new Intl.DateTimeFormat('sv-SE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: APP_TIME_ZONE,
})

const syncLabelFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: APP_TIME_ZONE,
})

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: APP_TIME_ZONE,
})

const calendarLabelFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: APP_TIME_ZONE,
})

const dateLabelFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: APP_TIME_ZONE,
})

const paymentDateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: APP_TIME_ZONE,
})

function parseDate(value) {
  const parsedDate = new Date(String(value ?? ''))

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function shiftDateKey(dateKey, offsetDays) {
  const parsedDate = new Date(`${String(dateKey ?? '').trim()}T00:00:00Z`)

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  parsedDate.setUTCDate(parsedDate.getUTCDate() + offsetDays)

  return dateKeyFormatter.format(parsedDate)
}

export function getAppTodayKey(referenceDate = new Date()) {
  return dateKeyFormatter.format(referenceDate)
}

export function toAppDateKey(value) {
  const parsedDate = parseDate(value)

  return parsedDate ? dateKeyFormatter.format(parsedDate) : ''
}

export function formatAppSyncLabel(value) {
  const parsedDate = parseDate(value)

  return parsedDate ? syncLabelFormatter.format(parsedDate) : 'belum ada'
}

export function formatAppDateTime(value) {
  const parsedDate = parseDate(value)

  return parsedDate ? dateTimeFormatter.format(parsedDate) : 'tanggal belum tersedia'
}

export function formatAppCalendarLabel(value) {
  const parsedDate = parseDate(value)

  return parsedDate ? calendarLabelFormatter.format(parsedDate) : ''
}

export function formatAppDateLabel(value) {
  const parsedDate = parseDate(value)

  return parsedDate ? dateLabelFormatter.format(parsedDate) : '-'
}

export function formatAppPaymentDateLabel(value) {
  const parsedDate = parseDate(value)

  return parsedDate ? paymentDateFormatter.format(parsedDate) : 'Tanggal belum tersedia'
}

export function getAppSectionLabel(dateKey, referenceTodayKey = getAppTodayKey()) {
  const normalizedDateKey = String(dateKey ?? '').trim()

  if (!normalizedDateKey) {
    return 'Tanpa Tanggal'
  }

  if (normalizedDateKey === referenceTodayKey) {
    return 'Hari Ini'
  }

  if (normalizedDateKey === shiftDateKey(referenceTodayKey, -1)) {
    return 'Kemarin'
  }

  const parsedDate = new Date(`${normalizedDateKey}T00:00:00Z`)

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedDateKey
  }

  return dateKeyFormatter.format(parsedDate)
}

export function shiftAppDateKey(dateKey, offsetDays) {
  return shiftDateKey(dateKey, offsetDays)
}
