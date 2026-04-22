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
