import { toAppDateKey } from './date-time.js'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toNumber(value, fallback = NaN) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function roundAmount(value) {
  return Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100
}

function parseDateKeyParts(value) {
  const normalizedValue = normalizeText(value)

  if (!normalizedValue) {
    return null
  }

  const dateKeyMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (dateKeyMatch) {
    return {
      year: Number(dateKeyMatch[1]),
      month: Number(dateKeyMatch[2]),
      day: Number(dateKeyMatch[3]),
    }
  }

  const parsedDate = new Date(normalizedValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return null
  }

  return {
    year: parsedDate.getUTCFullYear(),
    month: parsedDate.getUTCMonth() + 1,
    day: parsedDate.getUTCDate(),
  }
}

function formatDateKeyParts(year, month, day) {
  const normalizedYear = String(year).padStart(4, '0')
  const normalizedMonth = String(month).padStart(2, '0')
  const normalizedDay = String(day).padStart(2, '0')

  return `${normalizedYear}-${normalizedMonth}-${normalizedDay}`
}

function addMonthsToDateKey(dateKey, offsetMonths) {
  const parsedDate = parseDateKeyParts(dateKey)

  if (!parsedDate) {
    return ''
  }

  const normalizedOffsetMonths = Math.trunc(toNumber(offsetMonths, 0))
  const targetMonthStart = new Date(
    Date.UTC(parsedDate.year, parsedDate.month - 1 + normalizedOffsetMonths, 1)
  )
  const targetYear = targetMonthStart.getUTCFullYear()
  const targetMonth = targetMonthStart.getUTCMonth() + 1
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth, 0)
  ).getUTCDate()

  return formatDateKeyParts(
    targetYear,
    targetMonth,
    Math.min(parsedDate.day, lastDayOfTargetMonth)
  )
}

export function normalizeLoanInterestType(value) {
  const normalizedValue = normalizeText(value, 'none').toLowerCase()

  if (normalizedValue === 'no_interest') {
    return 'none'
  }

  return ['none', 'interest'].includes(normalizedValue) ? normalizedValue : 'none'
}

export function normalizeLoanLateInterestBasis(value) {
  const normalizedValue = normalizeText(value, 'remaining').toLowerCase()

  return ['principal', 'remaining'].includes(normalizedValue)
    ? normalizedValue
    : 'remaining'
}

export function normalizeLoanLatePenaltyType(value) {
  const normalizedValue = normalizeText(value, 'none').toLowerCase()

  return ['none', 'flat'].includes(normalizedValue) ? normalizedValue : 'none'
}

export function calculateLoanBaseRepayment({
  principalAmount = 0,
  interestType = 'none',
  interestRate = 0,
  tenorMonths = 0,
} = {}) {
  const normalizedPrincipalAmount = roundAmount(principalAmount)
  const normalizedInterestType = normalizeLoanInterestType(interestType)
  const normalizedInterestRate = Math.max(toNumber(interestRate, 0), 0)
  const normalizedTenorMonths = Math.max(Math.trunc(toNumber(tenorMonths, 0)), 0)

  if (
    normalizedInterestType !== 'interest' ||
    normalizedInterestRate <= 0 ||
    normalizedTenorMonths <= 0
  ) {
    return normalizedPrincipalAmount
  }

  const interestAmount = roundAmount(
    normalizedPrincipalAmount * (normalizedInterestRate / 100) * normalizedTenorMonths
  )

  return roundAmount(normalizedPrincipalAmount + interestAmount)
}

export function calculateLoanDueDate(transactionDate, tenorMonths = 0) {
  const normalizedTransactionDate = normalizeText(transactionDate)

  if (!normalizedTransactionDate) {
    return null
  }

  const normalizedTenorMonths = Math.max(Math.trunc(toNumber(tenorMonths, 0)), 0)

  if (normalizedTenorMonths <= 0) {
    return normalizedTransactionDate
  }

  return addMonthsToDateKey(normalizedTransactionDate, normalizedTenorMonths)
}

export function calculateLoanOverdueMonths({
  dueDate,
  referenceDate = new Date(),
} = {}) {
  const parsedDueDate = parseDateKeyParts(dueDate)

  if (!parsedDueDate) {
    return 0
  }

  const parsedReferenceDate =
    parseDateKeyParts(referenceDate) ?? parseDateKeyParts(toAppDateKey(referenceDate))

  if (!parsedReferenceDate) {
    return 0
  }

  let monthDifference =
    (parsedReferenceDate.year - parsedDueDate.year) * 12 +
    (parsedReferenceDate.month - parsedDueDate.month)

  if (parsedReferenceDate.day < parsedDueDate.day) {
    monthDifference -= 1
  }

  return Math.max(monthDifference, 0)
}

export function calculateLoanLateCharge({
  principalAmount = 0,
  remainingAmount = 0,
  dueDate = null,
  referenceDate = new Date(),
  lateInterestRate = 0,
  lateInterestBasis = 'remaining',
  latePenaltyType = 'none',
  latePenaltyAmount = 0,
} = {}) {
  const overdueMonths = calculateLoanOverdueMonths({ dueDate, referenceDate })
  const normalizedLateInterestRate = Math.max(toNumber(lateInterestRate, 0), 0)
  const normalizedLateInterestBasis = normalizeLoanLateInterestBasis(lateInterestBasis)
  const normalizedPrincipalAmount = roundAmount(principalAmount)
  const normalizedRemainingAmount = roundAmount(remainingAmount)
  const normalizedLatePenaltyType = normalizeLoanLatePenaltyType(latePenaltyType)
  const normalizedLatePenaltyAmount =
    normalizedLatePenaltyType === 'flat' ? roundAmount(latePenaltyAmount) : 0

  if (overdueMonths <= 0) {
    return {
      overdueMonths: 0,
      lateInterestAmount: 0,
      latePenaltyAmount: 0,
      totalLateChargeAmount: 0,
      lateInterestBasis: normalizedLateInterestBasis,
      latePenaltyType: normalizedLatePenaltyType,
    }
  }

  const interestBasisAmount =
    normalizedLateInterestBasis === 'principal'
      ? normalizedPrincipalAmount
      : normalizedRemainingAmount > 0
        ? normalizedRemainingAmount
        : normalizedPrincipalAmount

  const lateInterestAmount = roundAmount(
    interestBasisAmount * (normalizedLateInterestRate / 100) * overdueMonths
  )

  return {
    overdueMonths,
    lateInterestAmount,
    latePenaltyAmount: normalizedLatePenaltyAmount,
    totalLateChargeAmount: roundAmount(lateInterestAmount + normalizedLatePenaltyAmount),
    lateInterestBasis: normalizedLateInterestBasis,
    latePenaltyType: normalizedLatePenaltyType,
  }
}

export function buildLoanTermsSnapshot(loan = {}) {
  const principalAmount = roundAmount(
    loan?.principal_amount ??
      loan?.principalAmount ??
      loan?.amount ??
      loan?.total_amount ??
      loan?.totalAmount
  )
  const amount = roundAmount(
    loan?.amount ??
      loan?.total_amount ??
      loan?.totalAmount ??
      loan?.principal_amount ??
      loan?.principalAmount ??
      principalAmount
  )
  const interestType = normalizeLoanInterestType(loan?.interest_type ?? loan?.interestType)
  const interestRate = Math.max(toNumber(loan?.interest_rate ?? loan?.interestRate, 0), 0)
  const tenorMonths = Math.max(
    Math.trunc(toNumber(loan?.tenor_months ?? loan?.tenorMonths, 0)),
    0
  )
  const transactionDate = normalizeText(
    loan?.transaction_date ?? loan?.transactionDate ?? loan?.disbursed_date ?? loan?.disbursedDate,
    ''
  )
  const disbursedDate = normalizeText(
    loan?.disbursed_date ?? loan?.disbursedDate ?? transactionDate,
    transactionDate
  )
  const lateInterestRate = Math.max(
    toNumber(loan?.late_interest_rate ?? loan?.lateInterestRate, 0),
    0
  )
  const lateInterestBasis = normalizeLoanLateInterestBasis(
    loan?.late_interest_basis ?? loan?.lateInterestBasis
  )
  const latePenaltyType = normalizeLoanLatePenaltyType(
    loan?.late_penalty_type ?? loan?.latePenaltyType
  )
  const latePenaltyAmount =
    latePenaltyType === 'flat'
      ? Math.max(toNumber(loan?.late_penalty_amount ?? loan?.latePenaltyAmount, 0), 0)
      : 0
  const baseRepaymentAmount = calculateLoanBaseRepayment({
    principalAmount,
    interestType,
    interestRate,
    tenorMonths,
  })
  const explicitRepaymentAmount = toNumber(
    loan?.repayment_amount ??
      loan?.repaymentAmount ??
      loan?.total_repayment_amount ??
      loan?.totalRepaymentAmount,
    NaN
  )
  const dueDate = calculateLoanDueDate(transactionDate || disbursedDate, tenorMonths)
  const repaymentAmount = roundAmount(
    Number.isFinite(explicitRepaymentAmount) && explicitRepaymentAmount >= 0
      ? explicitRepaymentAmount
      : baseRepaymentAmount
  )

  return {
    principal_amount: principalAmount,
    amount,
    repayment_amount: repaymentAmount,
    interest_type: interestType,
    interest_rate: interestType === 'interest' ? interestRate : null,
    tenor_months: tenorMonths > 0 ? tenorMonths : null,
    transaction_date: transactionDate || null,
    disbursed_date: disbursedDate || null,
    due_date: dueDate || null,
    base_repayment_amount: baseRepaymentAmount,
    late_interest_rate: lateInterestRate,
    late_interest_basis: lateInterestBasis,
    late_penalty_type: latePenaltyType,
    late_penalty_amount: latePenaltyAmount,
    creditor_name_snapshot: normalizeText(loan?.creditor_name_snapshot ?? loan?.creditorName, '-'),
  }
}

export function buildLoanLateChargeSummary(loan = {}, referenceDate = new Date()) {
  const loanTermsSnapshot = buildLoanTermsSnapshot(loan)
  const repaymentAmount = roundAmount(
    loan?.repayment_amount ?? loan?.repaymentAmount ?? loanTermsSnapshot.repayment_amount
  )
  const paidAmount = Math.max(
    toNumber(loan?.paid_amount ?? loan?.paidAmount, 0),
    0
  )
  const remainingAmount = Math.max(repaymentAmount - paidAmount, 0)
  const lateCharge = calculateLoanLateCharge({
    principalAmount: loanTermsSnapshot.principal_amount,
    remainingAmount,
    dueDate: loanTermsSnapshot.due_date,
    referenceDate,
    lateInterestRate: loanTermsSnapshot.late_interest_rate,
    lateInterestBasis: loanTermsSnapshot.late_interest_basis,
    latePenaltyType: loanTermsSnapshot.late_penalty_type,
    latePenaltyAmount: loanTermsSnapshot.late_penalty_amount,
  })

  return {
    principalAmount: loanTermsSnapshot.principal_amount,
    repaymentAmount,
    paidAmount,
    remainingAmount,
    dueDate: loanTermsSnapshot.due_date,
    overdueMonths: lateCharge.overdueMonths,
    lateInterestAmount: lateCharge.lateInterestAmount,
    latePenaltyAmount: lateCharge.latePenaltyAmount,
    totalLateChargeAmount: lateCharge.totalLateChargeAmount,
    lateInterestBasis: lateCharge.lateInterestBasis,
    latePenaltyType: lateCharge.latePenaltyType,
  }
}
