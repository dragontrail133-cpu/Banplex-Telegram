import { create } from 'zustand'
import { resolveTeamId, resolveTelegramUserId } from '../lib/auth-context'
import {
  fetchAttendanceRecordFromApi,
  fetchAttendanceSheetFromApi,
  fetchUnbilledAttendancesFromApi,
  restoreAttendanceFromApi,
  softDeleteAttendanceFromApi,
  saveAttendanceSheetFromApi,
} from '../lib/records-api'

const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'full_day', label: 'Full Day', multiplier: 1 },
  { value: 'half_day', label: 'Half Day', multiplier: 0.5 },
  { value: 'overtime', label: 'Lembur', multiplier: 1.5 },
]

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

function getAttendanceMultiplier(status) {
  return (
    ATTENDANCE_STATUS_OPTIONS.find((option) => option.value === status)?.multiplier ?? 0
  )
}

function getAttendanceStatusLabel(status) {
  return (
    ATTENDANCE_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? 'Belum Diisi'
  )
}

const useAttendanceStore = create((set, get) => ({
  unbilledAttendances: [],
  sheetAttendances: [],
  isLoading: false,
  isSubmitting: false,
  isSheetLoading: false,
  isSheetSaving: false,
  error: null,
  lastUpdatedAt: null,
  attendanceStatusOptions: ATTENDANCE_STATUS_OPTIONS,
  clearError: () => set({ error: null }),
  fetchAttendanceById: async (attendanceId, { includeDeleted = true } = {}) => {
    if (!attendanceId) {
      throw new Error('Attendance ID wajib diisi.')
    }

    try {
      const attendance = await fetchAttendanceRecordFromApi(attendanceId, {
        includeDeleted,
      })

      return attendance
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat detail absensi.')
      throw normalizedError
    }
  },
  fetchUnbilledAttendances: async ({ teamId = null, force = false } = {}) => {
    const currentState = get()

    if (!force && !currentState.isLoading && currentState.unbilledAttendances.length > 0) {
      return currentState.unbilledAttendances
    }

    set({
      isLoading: true,
      error: null,
    })

    try {
      const nextAttendances = await fetchUnbilledAttendancesFromApi(resolveTeamId(teamId))

      set({
        unbilledAttendances: nextAttendances,
        isLoading: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return nextAttendances
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat absensi yang belum ditagihkan.')

      set({
        unbilledAttendances: [],
        isLoading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  fetchAttendanceSheet: async ({
    teamId,
    date,
    projectId,
    persist = true,
  } = {}) => {
    if (persist) {
      set({
        isSheetLoading: true,
        error: null,
      })
    }

    try {
      const rows = await fetchAttendanceSheetFromApi({
        teamId: resolveTeamId(teamId),
        date,
        projectId,
      })

      if (persist) {
        set({
          sheetAttendances: rows,
          isSheetLoading: false,
          error: null,
          lastUpdatedAt: new Date().toISOString(),
        })
      }

      return rows
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat absensi harian.')

      if (persist) {
        set({
          sheetAttendances: [],
          isSheetLoading: false,
          error: normalizedError.message,
        })
      }

      throw normalizedError
    }
  },
  saveAttendanceSheet: async ({
    teamId,
    telegramUserId,
    attendanceDate,
    projectId,
    rows,
  } = {}) => {
    set({
      isSheetSaving: true,
      error: null,
    })

    try {
      const nextRows = await saveAttendanceSheetFromApi({
        teamId: resolveTeamId(teamId),
        telegramUserId: resolveTelegramUserId(telegramUserId),
        attendanceDate,
        projectId,
        rows,
      })

      set({
        sheetAttendances: nextRows,
        isSheetSaving: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return nextRows
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menyimpan absensi harian.')

      set({
        isSheetSaving: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  softDeleteAttendanceRecord: async ({ attendanceId, teamId } = {}) => {
    if (!attendanceId) {
      throw new Error('Attendance ID wajib diisi.')
    }

    set({
      isSubmitting: true,
      error: null,
    })

    try {
      await softDeleteAttendanceFromApi(attendanceId, resolveTeamId(teamId))

      set({
        isSubmitting: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return true
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menghapus absensi.')

      set({
        isSubmitting: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  restoreAttendanceRecord: async ({ attendanceId, teamId } = {}) => {
    if (!attendanceId) {
      throw new Error('Attendance ID wajib diisi.')
    }

    set({
      isSubmitting: true,
      error: null,
    })

    try {
      const attendance = await restoreAttendanceFromApi(attendanceId, resolveTeamId(teamId))

      set({
        isSubmitting: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return attendance
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memulihkan absensi.')

      set({
        isSubmitting: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  submitAttendance: async (data = {}) => {
    set({
      isSubmitting: true,
      error: null,
    })

    try {
      const nextRows = await saveAttendanceSheetFromApi({
        teamId: resolveTeamId(data.team_id),
        telegramUserId: resolveTelegramUserId(data.telegram_user_id),
        attendanceDate: data.attendance_date ?? data.date ?? data.attendanceDate,
        projectId: data.project_id,
        rows: [
          {
            worker_id: data.worker_id,
            worker_name: data.worker_name,
            project_name: data.project_name,
            attendance_status: data.attendance_status ?? data.attendanceStatus,
            total_pay: data.total_pay ?? data.totalPay,
            notes: data.notes,
          },
        ],
      })

      set({
        isSubmitting: false,
        sheetAttendances: nextRows,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return nextRows[0] ?? null
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menyimpan absensi.')

      set({
        isSubmitting: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  attendanceStatusLabel: getAttendanceStatusLabel,
  attendanceStatusMultiplier: getAttendanceMultiplier,
}))

export default useAttendanceStore
export { ATTENDANCE_STATUS_OPTIONS, useAttendanceStore }
