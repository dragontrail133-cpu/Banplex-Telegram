export function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export function remapRowTeamId(row, targetTeamId) {
  if (!targetTeamId || row == null || typeof row !== 'object') {
    return {
      row,
      remapped: false,
      legacyTeamId: null,
    }
  }

  if (!Object.prototype.hasOwnProperty.call(row, 'team_id') || row.team_id == null || row.team_id === targetTeamId) {
    return {
      row,
      remapped: false,
      legacyTeamId: null,
    }
  }

  return {
    row: {
      ...row,
      team_id: targetTeamId,
    },
    remapped: true,
    legacyTeamId: row.team_id,
  }
}

function normalizeOptionalText(value) {
  if (value == null) {
    return null
  }

  const normalizedValue = String(value).trim()
  return normalizedValue.length > 0 ? normalizedValue : null
}

function normalizePositiveNumber(value) {
  if (value == null || value === '') {
    return null
  }

  const numericValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null
  }

  return numericValue
}

function normalizeLoanInterestTypeForRepair(value) {
  const normalizedValue = normalizeOptionalText(value)?.toLowerCase() ?? 'none'

  if (['interest', 'bunga'].includes(normalizedValue)) {
    return 'interest'
  }

  return 'none'
}

export function resolveLoanNominalAmounts({
  principalAmount,
  amount,
  totalAmount,
  repaymentAmount,
  totalRepaymentAmount,
  interestType,
} = {}) {
  const normalizedPrincipalAmount = normalizePositiveNumber(principalAmount)
  const normalizedAmount = normalizePositiveNumber(amount)
  const normalizedTotalAmount = normalizePositiveNumber(totalAmount)
  const normalizedRepaymentAmount =
    normalizePositiveNumber(totalRepaymentAmount) ?? normalizePositiveNumber(repaymentAmount)
  const normalizedInterestType = normalizeLoanInterestTypeForRepair(interestType)

  const resolvedPrincipalAmount =
    normalizedPrincipalAmount ??
    normalizedAmount ??
    normalizedTotalAmount ??
    (normalizedInterestType === 'none' ? normalizedRepaymentAmount : null) ??
    0
  const resolvedAmount = normalizedAmount ?? normalizedTotalAmount ?? resolvedPrincipalAmount
  const resolvedRepaymentAmount = normalizedRepaymentAmount ?? 0

  return {
    principal_amount: resolvedPrincipalAmount,
    amount: resolvedAmount,
    repayment_amount: resolvedRepaymentAmount,
  }
}

export function shouldBackfillAttendanceRecord({ projectId } = {}) {
  return normalizeOptionalText(projectId) !== null
}
