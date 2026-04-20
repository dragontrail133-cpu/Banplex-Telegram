const nominalFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
})

export function normalizeNominalInputValue(value) {
  const digitsOnly = String(value ?? '').replace(/\D/g, '')

  if (!digitsOnly) {
    return ''
  }

  return digitsOnly.replace(/^0+(?!$)/, '')
}

export function formatNominalInputValue(value) {
  const normalizedTextValue = String(value ?? '').trim()

  if (!normalizedTextValue) {
    return ''
  }

  const numericValue = Number(normalizedTextValue)

  if (!Number.isFinite(numericValue)) {
    return ''
  }

  return nominalFormatter.format(Math.round(numericValue))
}
