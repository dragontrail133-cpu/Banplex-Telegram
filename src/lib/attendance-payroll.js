const LEGACY_OVERTIME_MULTIPLIER = 1.5

export function normalizeAttendanceStatus(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function calculateAttendanceTotalPay({
  attendanceStatus,
  baseWage = 0,
  overtimeFee = 0,
} = {}) {
  const normalizedStatus = normalizeAttendanceStatus(attendanceStatus)
  const numericBaseWage = Number(baseWage)
  const safeBaseWage = Number.isFinite(numericBaseWage) && numericBaseWage > 0 ? numericBaseWage : 0
  const numericOvertimeFee = Number(overtimeFee)
  const safeOvertimeFee =
    Number.isFinite(numericOvertimeFee) && numericOvertimeFee > 0 ? numericOvertimeFee : 0

  if (normalizedStatus === 'full_day') {
    return Math.round(safeBaseWage)
  }

  if (normalizedStatus === 'half_day') {
    return Math.round(safeBaseWage * 0.5)
  }

  if (normalizedStatus === 'overtime') {
    return Math.round(safeBaseWage + safeOvertimeFee)
  }

  return 0
}

export function resolveAttendanceEffectiveTotalPay({
  attendanceStatus,
  totalPay = 0,
  baseWage = 0,
  overtimeFee = 0,
} = {}) {
  const normalizedStatus = normalizeAttendanceStatus(attendanceStatus)
  const numericTotalPay = Number(totalPay)
  const safeStoredTotalPay =
    Number.isFinite(numericTotalPay) && numericTotalPay > 0 ? Math.round(numericTotalPay) : 0

  if (!normalizedStatus || normalizedStatus === 'absent' || safeStoredTotalPay > 0) {
    return safeStoredTotalPay
  }

  return calculateAttendanceTotalPay({
    attendanceStatus: normalizedStatus,
    baseWage,
    overtimeFee,
  })
}

export function getAttendanceDayWeight(attendanceStatus) {
  const normalizedStatus = normalizeAttendanceStatus(attendanceStatus)

  if (normalizedStatus === 'full_day') {
    return 1
  }

  if (normalizedStatus === 'half_day') {
    return 0.5
  }

  return 0
}

export function getAttendanceQuotaState({
  usedDayWeight = 0,
  currentRowWeight = 0,
} = {}) {
  const numericUsedDayWeight = Number(usedDayWeight)
  const numericCurrentRowWeight = Number(currentRowWeight)
  const safeUsedDayWeight =
    Number.isFinite(numericUsedDayWeight) && numericUsedDayWeight > 0 ? numericUsedDayWeight : 0
  const safeCurrentRowWeight =
    Number.isFinite(numericCurrentRowWeight) && numericCurrentRowWeight > 0
      ? numericCurrentRowWeight
      : 0
  const totalOtherWeight = Math.max(safeUsedDayWeight - safeCurrentRowWeight, 0)
  const remainingQuota = Math.max(1 - totalOtherWeight, 0)

  return {
    totalOtherWeight,
    remainingQuota,
    isFullyAllocated: totalOtherWeight >= 1,
    hasHalfQuotaOnly: totalOtherWeight >= 0.5 && totalOtherWeight < 1,
  }
}

export function getAllowedAttendanceStatusValues({
  usedDayWeight = 0,
  currentAttendanceStatus = '',
  currentRowWeight = null,
} = {}) {
  const normalizedCurrentStatus = normalizeAttendanceStatus(currentAttendanceStatus)
  const resolvedCurrentRowWeight =
    currentRowWeight === null || currentRowWeight === undefined
      ? getAttendanceDayWeight(normalizedCurrentStatus)
      : currentRowWeight
  const quotaState = getAttendanceQuotaState({
    usedDayWeight,
    currentRowWeight: resolvedCurrentRowWeight,
  })

  let allowedStatuses = []

  if (quotaState.isFullyAllocated) {
    allowedStatuses = []
  } else if (quotaState.hasHalfQuotaOnly) {
    allowedStatuses = ['half_day', 'overtime']
  } else {
    allowedStatuses = ['full_day', 'half_day', 'overtime', 'absent']
  }

  if (normalizedCurrentStatus) {
    allowedStatuses = [...allowedStatuses, normalizedCurrentStatus]
  }

  return [...new Set(allowedStatuses.filter(Boolean))]
}

export function isAttendanceStatusAllowed({
  usedDayWeight = 0,
  nextAttendanceStatus = '',
  currentAttendanceStatus = '',
  currentRowWeight = null,
} = {}) {
  const normalizedNextStatus = normalizeAttendanceStatus(nextAttendanceStatus)

  if (!normalizedNextStatus) {
    return true
  }

  return getAllowedAttendanceStatusValues({
    usedDayWeight,
    currentAttendanceStatus,
    currentRowWeight,
  }).includes(normalizedNextStatus)
}

export function deriveAttendanceOvertimeFee({
  attendanceStatus,
  baseWage = 0,
  totalPay = 0,
  overtimeFee = null,
} = {}) {
  if (normalizeAttendanceStatus(attendanceStatus) !== 'overtime') {
    return 0
  }

  const numericOvertimeFee = Number(overtimeFee)
  if (
    overtimeFee !== null &&
    overtimeFee !== undefined &&
    Number.isFinite(numericOvertimeFee) &&
    numericOvertimeFee >= 0
  ) {
    return Math.round(numericOvertimeFee)
  }

  const numericBaseWage = Number(baseWage)
  const safeBaseWage = Number.isFinite(numericBaseWage) && numericBaseWage > 0 ? numericBaseWage : 0
  const numericTotalPay = Number(totalPay)
  const safeTotalPay = Number.isFinite(numericTotalPay) && numericTotalPay > 0 ? numericTotalPay : 0

  if (safeTotalPay <= 0) {
    return 0
  }

  if (safeBaseWage > 0 && safeTotalPay >= safeBaseWage) {
    return Math.max(Math.round(safeTotalPay - safeBaseWage), 0)
  }

  return Math.max(Math.round(safeTotalPay - safeTotalPay / LEGACY_OVERTIME_MULTIPLIER), 0)
}

export function deriveAttendanceBaseWage({
  attendanceStatus,
  totalPay = 0,
  overtimeFee = null,
} = {}) {
  const normalizedStatus = normalizeAttendanceStatus(attendanceStatus)
  const numericTotalPay = Number(totalPay)
  const safeTotalPay = Number.isFinite(numericTotalPay) && numericTotalPay > 0 ? numericTotalPay : 0

  if (normalizedStatus === 'overtime') {
    const numericOvertimeFee = Number(overtimeFee)
    if (
      overtimeFee !== null &&
      overtimeFee !== undefined &&
      Number.isFinite(numericOvertimeFee) &&
      numericOvertimeFee >= 0
    ) {
      const derivedBaseWage = safeTotalPay - Math.round(numericOvertimeFee)

      if (safeTotalPay > 0 && derivedBaseWage >= 0) {
        return Math.round(derivedBaseWage)
      }
    }

    return safeTotalPay > 0 ? Math.round(safeTotalPay / LEGACY_OVERTIME_MULTIPLIER) : 0
  }

  if (normalizedStatus === 'half_day') {
    return safeTotalPay > 0 ? Math.round(safeTotalPay / 0.5) : 0
  }

  if (normalizedStatus === 'full_day') {
    return Math.round(safeTotalPay)
  }

  return 0
}
