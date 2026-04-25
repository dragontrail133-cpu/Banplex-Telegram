import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  Copy,
  Search,
  Settings2,
  UserRound,
  Users,
} from 'lucide-react'
import { useLocation } from 'react-router-dom'
import SmartList from './ui/SmartList'
import useTelegram from '../hooks/useTelegram'
import useAttendanceStore from '../store/useAttendanceStore'
import useAuthStore from '../store/useAuthStore'
import useMasterStore from '../store/useMasterStore'
import { getAppTodayKey, toAppDateKey } from '../lib/date-time'
import useMutationToast from '../hooks/useMutationToast'
import { fetchAttendanceHistoryFromApi } from '../lib/records-api'
import MasterPickerField from './ui/MasterPickerField'
import {
  AppBadge,
  AppButton,
  AppNominalInput,
  AppSheet,
} from './ui/AppPrimitives'
import {
  calculateAttendanceTotalPay,
  deriveAttendanceOvertimeFee,
  getAllowedAttendanceStatusValues,
  getAttendanceDayWeight,
} from '../lib/attendance-payroll'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0)
}

function getTodayDateString() {
  return getAppTodayKey()
}

function getInitialAttendanceSelection(location) {
  const searchParams = new URLSearchParams(location.search)
  const locationState = location.state ?? {}
  const candidateDate =
    searchParams.get('date') ??
    locationState.date ??
    locationState.attendanceDate ??
    locationState.attendance_date ??
    locationState.item?.attendance_date ??
    locationState.record?.attendance_date ??
    locationState.transaction?.attendance_date ??
    ''
  const candidateProjectId =
    searchParams.get('projectId') ??
    locationState.projectId ??
    locationState.project_id ??
    locationState.item?.project_id ??
    locationState.record?.project_id ??
    locationState.transaction?.project_id ??
    ''

  return {
    selectedDate: toAppDateKey(candidateDate) || getTodayDateString(),
    selectedProjectId: normalizeText(candidateProjectId, ''),
  }
}

function getPreviousDateString(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return ''
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  parsedDate.setDate(parsedDate.getDate() - 1)

  return parsedDate.toISOString().slice(0, 10)
}

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function getTelegramDisplayName(telegramUser, authUser) {
  const authUserName = normalizeText(authUser?.name, '')
  const telegramFullName = [telegramUser?.first_name, telegramUser?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()
  const telegramUsername = normalizeText(telegramUser?.username, '')

  return normalizeText(authUserName || telegramFullName || telegramUsername, 'Pengguna Telegram')
}

function buildAttendanceNotificationPayload({
  projectName,
  attendanceDate,
  recordCount,
  totalPay,
  userName,
  routePath = '/payroll?tab=daily',
} = {}) {
  return {
    notificationType: 'attendance',
    projectName: normalizeText(projectName, 'Workspace'),
    attendanceDate: normalizeText(attendanceDate, new Date().toISOString()),
    recordCount: Number(recordCount ?? 0),
    totalPay: Number(totalPay ?? 0),
    userName: normalizeText(userName, 'Pengguna Telegram'),
    routePath: normalizeText(routePath, '/payroll?tab=daily'),
  }
}

async function notifyTelegram(payload) {
  const response = await fetch('/api/notify', {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Gagal mengirim notifikasi Telegram.')
  }

  return result
}

const ATTENDANCE_STATUS_META = {
  full_day: { label: 'Penuh', tone: 'success' },
  half_day: { label: '½ Hari', tone: 'warning' },
  overtime: { label: 'Lembur', tone: 'info' },
  absent: { label: 'Absen', tone: 'danger' },
  '': { label: 'Belum', tone: 'neutral' },
}

function getAttendanceStatusMeta(status) {
  return ATTENDANCE_STATUS_META[status] ?? ATTENDANCE_STATUS_META['']
}

function getWorkerProjectRateOptions(workerId, projectId, workerWageRates = []) {
  return [...workerWageRates]
    .filter(
      (rate) =>
        rate.worker_id === workerId &&
        rate.project_id === projectId &&
        !rate.deleted_at
    )
    .sort((left, right) => {
      const defaultComparison = Number(Boolean(right.is_default)) - Number(Boolean(left.is_default))

      if (defaultComparison !== 0) {
        return defaultComparison
      }

      const roleComparison = normalizeText(left.role_name, '').localeCompare(
        normalizeText(right.role_name, ''),
        'id',
        { sensitivity: 'base' }
      )

      if (roleComparison !== 0) {
        return roleComparison
      }

      return Number(left.wage_amount ?? 0) - Number(right.wage_amount ?? 0)
    })
}

function resolveWorkerProjectRate({
  draftRateId = null,
  rateOptions = [],
  fallbackRate = null,
}) {
  const normalizedDraftRateId = normalizeText(draftRateId, null)

  if (normalizedDraftRateId) {
    const matchedDraftRate = rateOptions.find((rate) => rate.id === normalizedDraftRateId)

    if (matchedDraftRate) {
      return matchedDraftRate
    }
  }

  const defaultRate = rateOptions.find((rate) => Boolean(rate.is_default))

  if (defaultRate) {
    return defaultRate
  }

  if (rateOptions.length > 0) {
    return rateOptions[0]
  }

  return fallbackRate
}

function resolveAttendanceRowOvertimeFee({
  attendanceStatus,
  baseWage,
  draftOvertimeFee,
  existingAttendanceStatus,
  existingOvertimeFee,
  existingTotalPay,
}) {
  if (
    draftOvertimeFee !== null &&
    draftOvertimeFee !== undefined &&
    draftOvertimeFee !== ''
  ) {
    return draftOvertimeFee
  }

  if (attendanceStatus === 'overtime') {
    if (normalizeText(existingAttendanceStatus, '') === 'overtime') {
      return deriveAttendanceOvertimeFee({
        attendanceStatus,
        baseWage,
        totalPay: existingTotalPay,
        overtimeFee: existingOvertimeFee,
      })
    }

    return ''
  }

  return existingOvertimeFee ?? ''
}

function getWorkerRate(workerId, projectId, workerWageRates = []) {
  const exactRate =
    workerWageRates.find(
      (rate) => rate.worker_id === workerId && rate.project_id === projectId
    ) ?? null

  if (exactRate) {
    return exactRate
  }

  const defaultRate =
    workerWageRates.find(
      (rate) => rate.worker_id === workerId && Boolean(rate.is_default)
    ) ?? null

  if (defaultRate) {
    return defaultRate
  }

  return workerWageRates.find((rate) => rate.worker_id === workerId) ?? null
}

function buildRowSummary(rows = []) {
  return rows.reduce(
    (summary, row) => {
      if (row.attendanceStatus) {
        summary.counts[row.attendanceStatus] =
          (summary.counts[row.attendanceStatus] ?? 0) + 1
      }

      summary.totalWage += Number(row.totalPay ?? 0)
      summary.filledCount += row.attendanceStatus ? 1 : 0
      return summary
    },
    {
      counts: {
        full_day: 0,
        half_day: 0,
        overtime: 0,
        absent: 0,
      },
      totalWage: 0,
      filledCount: 0,
    }
  )
}

function AttendanceRowCard({ row, onOpen }) {
  const isLocked = Boolean(row.readOnly)
  const statusMeta = getAttendanceStatusMeta(row.attendanceStatus)

  return (
    <button
      aria-disabled={isLocked}
      aria-haspopup="dialog"
      className={`flex w-full items-start gap-3 rounded-[22px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-3 py-3 text-left transition active:bg-[var(--app-surface-high-color)] ${
        isLocked ? 'opacity-95' : ''
      }`}
      onClick={onOpen}
      type="button"
    >
      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-low-color)] text-[var(--app-text-color)]">
        <UserRound className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
          {row.workerName}
        </p>
        <p className="mt-0.5 truncate text-xs leading-5 text-[var(--app-hint-color)]">
          {row.roleName || 'Pekerja'}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <p className="text-sm font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
          {formatCurrency(row.totalPay)}
        </p>
        <AppBadge tone={statusMeta.tone}>{statusMeta.label}</AppBadge>
        {isLocked ? <AppBadge tone="warning">Terkunci</AppBadge> : null}
      </div>
    </button>
  )
}

function AttendanceSheetStatCard({ label, value, className = '' }) {
  return (
    <div
      className={`rounded-[20px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-3 py-3 ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-hint-color)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
        {value}
      </p>
    </div>
  )
}

function AttendanceWorkerSheet({
  row,
  onClose,
  onRateChange,
  onOvertimeFeeChange,
  onStatusChange,
  sheetDate,
  selectedProjectName,
}) {
  if (!row) {
    return null
  }

  const activeRate =
    row.rateOptions.find((rate) => rate.id === row.selectedRateId) ?? row.rateOptions[0] ?? null
  const hasRateOptions = row.rateOptions.length > 1
  const statusMeta = getAttendanceStatusMeta(row.attendanceStatus)
  const statusOptions = [
    { value: 'full_day', label: 'Penuh', tone: 'success' },
    { value: 'half_day', label: '½ Hari', tone: 'warning' },
    { value: 'overtime', label: 'Lembur', tone: 'info' },
    { value: 'absent', label: 'Absen', tone: 'danger' },
  ]

  return (
    <AppSheet
      description={[sheetDate, selectedProjectName].filter(Boolean).join(' · ') || null}
      onClose={onClose}
      open={Boolean(row)}
      title={row.workerName}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <AttendanceSheetStatCard label="Status" value={statusMeta.label} />
          <AttendanceSheetStatCard
            label="Peran"
            value={normalizeText(activeRate?.role_name ?? row.roleName, 'Pekerja')}
          />
          <AttendanceSheetStatCard
            label="Nominal"
            value={formatCurrency(activeRate?.wage_amount ?? row.baseWage)}
          />
          <AttendanceSheetStatCard
            label="Total Upah"
            value={formatCurrency(row.totalPay)}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              Status Kehadiran
            </p>

            <AppButton
              className="shrink-0"
              disabled={row.readOnly}
              onClick={() => onStatusChange(row.workerId, '')}
              size="sm"
              type="button"
              variant="ghost"
            >
              Kosongkan
            </AppButton>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {statusOptions.map((statusOption) => {
              const isActive = row.attendanceStatus === statusOption.value
              const isAllowed =
                row.allowedStatusValues.includes(statusOption.value) || isActive

              return (
                <AppButton
                  key={statusOption.value}
                  disabled={row.readOnly || !isAllowed}
                  fullWidth
                  onClick={() => onStatusChange(row.workerId, statusOption.value)}
                  size="md"
                  type="button"
                  variant={isActive ? 'primary' : 'secondary'}
                >
                  {statusOption.label}
                </AppButton>
              )
            })}
          </div>
        </div>

        {row.attendanceStatus === 'overtime' ? (
          <div className="space-y-2 rounded-[22px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 py-4">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">Fee Lembur</p>
            <AppNominalInput
              className="rounded-[18px]"
              disabled={row.readOnly}
              onValueChange={(nextValue) => onOvertimeFeeChange(row.workerId, nextValue)}
              placeholder="0"
              value={row.overtimeFee}
            />
          </div>
        ) : null}

        {hasRateOptions ? (
          <details className="group rounded-[22px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)]">
            <summary className="flex list-none items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                  Ubah Peran
                </p>
              </div>

              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--app-hint-color)] transition duration-200 group-open:rotate-180" />
            </summary>

            <div className="space-y-2 px-4 pb-4">
              {row.rateOptions.map((rateOption) => {
                const isActive = rateOption.id === row.selectedRateId

                return (
                  <button
                    key={rateOption.id}
                    className={`flex w-full items-start justify-between gap-3 rounded-[20px] border px-3 py-3 text-left transition ${
                      isActive
                        ? 'border-[var(--app-accent-color)] bg-[color-mix(in_srgb,var(--app-accent-color)_12%,white)]'
                        : 'border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)]'
                    }`}
                    onClick={() => onRateChange(row.workerId, rateOption.id)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                        {normalizeText(rateOption.role_name, 'Peran')}
                      </p>
                      {rateOption.is_default ? (
                        <p className="mt-0.5 text-xs leading-5 text-[var(--app-hint-color)]">
                          Default
                        </p>
                      ) : null}
                    </div>

                    <p className="shrink-0 text-sm font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                      {formatCurrency(rateOption.wage_amount)}
                    </p>
                  </button>
                )
              })}
            </div>
          </details>
        ) : null}
      </div>
    </AppSheet>
  )
}

function AttendanceKpiSheet({
  open,
  onClose,
  summary,
  rowCount,
  sheetDate,
  selectedProjectName,
}) {
  return (
    <AppSheet
      description={[sheetDate, selectedProjectName].filter(Boolean).join(' · ') || null}
      onClose={onClose}
      open={open}
      title="KPI Absensi"
    >
      <div className="grid grid-cols-2 gap-2">
        <AttendanceSheetStatCard
          className="col-span-2 px-4 py-4"
          label="Total Upah"
          value={formatCurrency(summary.totalWage)}
        />
        <AttendanceSheetStatCard label="Terisi" value={`${summary.filledCount}/${rowCount}`} />
        <AttendanceSheetStatCard label="Penuh" value={String(summary.counts.full_day)} />
        <AttendanceSheetStatCard label="½ Hari" value={String(summary.counts.half_day)} />
        <AttendanceSheetStatCard label="Absen" value={String(summary.counts.absent)} />
      </div>
    </AppSheet>
  )
}

function AttendanceSettingsSheet({
  open,
  onClose,
  onFullDayAll,
  onHalfDayAll,
  onOvertimeAll,
  onAbsentAll,
  onResetAll,
  sheetDate,
  selectedProjectName,
}) {
  return (
    <AppSheet
      description={[sheetDate, selectedProjectName].filter(Boolean).join(' · ') || null}
      onClose={onClose}
      open={open}
      title="Pengaturan Semua"
    >
      <div className="grid grid-cols-2 gap-2">
        <button
          className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
          onClick={onFullDayAll}
          type="button"
        >
          Full Day Semua
        </button>
        <button
          className="rounded-[20px] border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
          onClick={onHalfDayAll}
          type="button"
        >
          Half Day Semua
        </button>
        <button
          className="rounded-[20px] border border-sky-200 bg-sky-50 px-3 py-3 text-sm font-semibold text-sky-800 transition hover:bg-sky-100"
          onClick={onOvertimeAll}
          type="button"
        >
          Lembur Semua
        </button>
        <button
          className="rounded-[20px] border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-800 transition hover:bg-rose-100"
          onClick={onAbsentAll}
          type="button"
        >
          Tidak Hadir Semua
        </button>
        <button
          className="col-span-2 rounded-[20px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-3 py-3 text-sm font-semibold text-[var(--app-hint-color)] transition hover:bg-[var(--app-surface-high-color)]"
          onClick={onResetAll}
          type="button"
        >
          Reset Semua
        </button>
      </div>
    </AppSheet>
  )
}

function AttendanceForm({ onSuccess, formId = null, hideActions = false }) {
  const { user } = useTelegram()
  const location = useLocation()
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const workers = useMasterStore((state) => state.workers)
  const projects = useMasterStore((state) => state.projects)
  const workerWageRates = useMasterStore((state) => state.workerWageRates)
  const isMasterLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const sheetAttendances = useAttendanceStore((state) => state.sheetAttendances)
  const isSheetLoading = useAttendanceStore((state) => state.isSheetLoading)
  const isSheetSaving = useAttendanceStore((state) => state.isSheetSaving)
  const error = useAttendanceStore((state) => state.error)
  const clearError = useAttendanceStore((state) => state.clearError)
  const fetchAttendanceSheet = useAttendanceStore((state) => state.fetchAttendanceSheet)
  const saveAttendanceSheet = useAttendanceStore((state) => state.saveAttendanceSheet)
  const { begin, clear, fail, succeed } = useMutationToast()
  const [dateAttendances, setDateAttendances] = useState([])
  const initialAttendanceSelection = getInitialAttendanceSelection(location)
  const [selectedDate, setSelectedDate] = useState(
    () => initialAttendanceSelection.selectedDate
  )
  const [selectedProjectId, setSelectedProjectId] = useState(
    () => initialAttendanceSelection.selectedProjectId
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [rowDraftState, setRowDraftState] = useState({
    key: '',
    values: {},
  })
  const [successMessage, setSuccessMessage] = useState(null)
  const [activeWorkerSheetWorkerId, setActiveWorkerSheetWorkerId] = useState(null)
  const [isKpiSheetOpen, setIsKpiSheetOpen] = useState(false)
  const [isSettingsSheetOpen, setIsSettingsSheetOpen] = useState(false)
  const showInlineMutationFeedback = false
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const telegramUserId = user?.id ?? authUser?.telegram_user_id ?? null
  const telegramUserName = getTelegramDisplayName(user, authUser)

  const activeProjects = useMemo(() => {
    const allProjects = projects.filter(
      (project) => !project.deleted_at && project.is_active !== false
    )
    const wageProjects = allProjects.filter((project) => project.is_wage_assignable)

      return wageProjects.length > 0 ? wageProjects : allProjects
  }, [projects])
  const projectPickerOptions = useMemo(
    () =>
      activeProjects.map((project) => ({
        value: project.id,
        label: project.name,
        description: '',
        searchText: [project.name, project.project_type, project.status].join(' '),
      })),
    [activeProjects]
  )

  const effectiveSelectedProjectId = selectedProjectId || activeProjects[0]?.id || ''
  const currentSheetKey = `${selectedDate}:${effectiveSelectedProjectId}`

  const activeWorkers = useMemo(() => {
    return workers.filter((worker) => !worker.deleted_at && worker.is_active !== false)
  }, [workers])

  useEffect(() => {
    fetchMasters({ force: true }).catch((fetchError) => {
      console.error('Gagal memuat master absensi:', fetchError)
    })
  }, [fetchMasters])

  useEffect(() => () => clearError(), [clearError])
  useEffect(() => () => clear(), [clear])

  const selectedProject = useMemo(() => {
    return (
      activeProjects.find((project) => project.id === effectiveSelectedProjectId) ?? null
    )
  }, [activeProjects, effectiveSelectedProjectId])

  const candidateWorkers = useMemo(() => {
    if (!effectiveSelectedProjectId) {
      return activeWorkers
    }

    const workersForProject = activeWorkers.filter((worker) => {
      if (worker.default_project_id === effectiveSelectedProjectId) {
        return true
      }

      return workerWageRates.some(
        (rate) =>
          rate.worker_id === worker.id &&
          rate.project_id === effectiveSelectedProjectId &&
          !rate.deleted_at
      )
    })

    const sourceWorkers = workersForProject.length > 0 ? workersForProject : activeWorkers

    return [...sourceWorkers].sort((left, right) =>
      normalizeText(left.name).localeCompare(normalizeText(right.name), 'id', {
        sensitivity: 'base',
      })
    )
  }, [activeWorkers, effectiveSelectedProjectId, workerWageRates])

  useEffect(() => {
    if (!currentTeamId || !selectedDate || !effectiveSelectedProjectId) {
      return
    }

    fetchAttendanceSheet({
      teamId: currentTeamId,
      date: selectedDate,
      projectId: effectiveSelectedProjectId,
    }).catch((fetchError) => {
      console.error('Gagal memuat sheet absensi:', fetchError)
    })
  }, [currentTeamId, effectiveSelectedProjectId, fetchAttendanceSheet, selectedDate])

  useEffect(() => {
    if (!currentTeamId || !selectedDate) {
      return
    }

    let isActive = true

    fetchAttendanceHistoryFromApi({
      teamId: currentTeamId,
      date: selectedDate,
    })
      .then((records) => {
        if (!isActive) {
          return
        }

        setDateAttendances(records)
      })
      .catch((fetchError) => {
        if (!isActive) {
          return
        }

        console.error('Gagal memuat histori absensi harian:', fetchError)
        setDateAttendances([])
      })

    return () => {
      isActive = false
    }
  }, [currentTeamId, selectedDate])

  const rowDrafts = useMemo(() => {
    return rowDraftState.key === currentSheetKey ? rowDraftState.values : {}
  }, [currentSheetKey, rowDraftState.key, rowDraftState.values])

  const dayUsageByWorkerId = useMemo(() => {
    return dateAttendances.reduce((usageMap, record) => {
      const workerId = normalizeText(record?.worker_id, null)

      if (!workerId || record?.deleted_at) {
        return usageMap
      }

      usageMap.set(
        workerId,
        (usageMap.get(workerId) ?? 0) + getAttendanceDayWeight(record?.attendance_status)
      )

      return usageMap
    }, new Map())
  }, [dateAttendances])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setActiveWorkerSheetWorkerId(null)
      setIsKpiSheetOpen(false)
      setIsSettingsSheetOpen(false)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [currentSheetKey])

  const rows = useMemo(() => {
    const existingByWorkerId = new Map(
      sheetAttendances.map((record) => [record.worker_id, record])
    )
    const recordOnlyWorkers = sheetAttendances
      .filter((record) => !candidateWorkers.some((worker) => worker.id === record.worker_id))
      .map((record) => ({
        id: record.worker_id,
        name: record.worker_name,
        default_role_name: '',
      }))
    const mergedWorkers = [...candidateWorkers, ...recordOnlyWorkers]

    return mergedWorkers.map((worker) => {
      const existingRecord = existingByWorkerId.get(worker.id) ?? null
      const draft = rowDrafts[worker.id] ?? null
      const rateOptions = getWorkerProjectRateOptions(
        worker.id,
        effectiveSelectedProjectId,
        workerWageRates
      )
      const matchedRate = getWorkerRate(worker.id, effectiveSelectedProjectId, workerWageRates)
      const selectedRate = resolveWorkerProjectRate({
        draftRateId: draft?.selectedRateId ?? null,
        rateOptions,
        fallbackRate: matchedRate,
      })
      const selectedRateId = selectedRate?.id ?? null
      const baseWage = Number(selectedRate?.wage_amount ?? matchedRate?.wage_amount ?? 0)
      const attendanceStatus =
        draft?.attendanceStatus ?? existingRecord?.attendance_status ?? ''
      const draftOvertimeFee = draft?.overtimeFee ?? null
      const existingAttendanceStatus = normalizeText(existingRecord?.attendance_status, '')
      const existingOvertimeFee = existingRecord?.overtime_fee ?? null
      const dayUsage = dayUsageByWorkerId.get(worker.id) ?? 0
      const currentRecordWeight = getAttendanceDayWeight(existingRecord?.attendance_status)
      const allowedStatusValues = getAllowedAttendanceStatusValues({
        usedDayWeight: dayUsage,
        currentAttendanceStatus: existingRecord?.attendance_status ?? '',
        currentRowWeight: currentRecordWeight,
      })
      const overtimeFee = resolveAttendanceRowOvertimeFee({
        attendanceStatus,
        baseWage,
        draftOvertimeFee,
        existingAttendanceStatus,
        existingOvertimeFee,
        existingTotalPay: existingRecord?.total_pay ?? 0,
      })
      const hasDraftChanges =
        draft?.attendanceStatus != null ||
        draft?.overtimeFee != null ||
        draft?.selectedRateId != null

      return {
        sourceId: existingRecord?.id ?? null,
        workerId: worker.id,
        workerName: normalizeText(worker.name, existingRecord?.worker_name ?? 'Pekerja'),
        projectId: effectiveSelectedProjectId,
        projectName: normalizeText(
          selectedProject?.name,
          existingRecord?.project_name ?? 'Proyek'
        ),
        roleName: normalizeText(selectedRate?.role_name ?? worker.default_role_name, 'Pekerja'),
        baseWage,
        selectedRateId,
        selectedRateName: normalizeText(selectedRate?.role_name, ''),
        selectedRateWage: baseWage,
        rateOptions,
        attendanceStatus,
        overtimeFee,
        notes: existingRecord?.notes ?? '',
        allowedStatusValues,
        totalPay: hasDraftChanges
          ? calculateAttendanceTotalPay({
              attendanceStatus,
              baseWage,
              overtimeFee,
            })
          : existingRecord?.id != null
            ? Number(existingRecord.total_pay ?? 0)
            : calculateAttendanceTotalPay({
                attendanceStatus,
                baseWage,
                overtimeFee,
              }),
        hasRate: baseWage > 0,
        billingStatus: normalizeText(existingRecord?.billing_status, 'unbilled'),
        salaryBillId: existingRecord?.salary_bill_id ?? null,
        readOnly:
          normalizeText(existingRecord?.billing_status, 'unbilled') === 'billed' ||
          Boolean(existingRecord?.salary_bill_id),
      }
    })
  }, [
    candidateWorkers,
    effectiveSelectedProjectId,
    dayUsageByWorkerId,
    rowDrafts,
    selectedProject,
    sheetAttendances,
    workerWageRates,
  ])

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeText(deferredSearchTerm).toLowerCase()

    if (!normalizedSearch) {
      return rows
    }

    return rows.filter((row) => {
      return (
        row.workerName.toLowerCase().includes(normalizedSearch) ||
        row.roleName.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [deferredSearchTerm, rows])

  const summary = useMemo(() => buildRowSummary(rows), [rows])

  const activeWorkerSheetRow = useMemo(
    () => rows.find((row) => row.workerId === activeWorkerSheetWorkerId) ?? null,
    [activeWorkerSheetWorkerId, rows]
  )

  const handleOpenWorkerSheet = (workerId) => {
    setIsKpiSheetOpen(false)
    setIsSettingsSheetOpen(false)
    setActiveWorkerSheetWorkerId(workerId)
  }

  const handleOpenKpiSheet = () => {
    setActiveWorkerSheetWorkerId(null)
    setIsSettingsSheetOpen(false)
    setIsKpiSheetOpen(true)
  }

  const handleOpenSettingsSheet = () => {
    setActiveWorkerSheetWorkerId(null)
    setIsKpiSheetOpen(false)
    setIsSettingsSheetOpen(true)
  }

  const handleRowStatusChange = (workerId, nextStatus) => {
    const targetRow = rows.find((row) => row.workerId === workerId)

    if (
      targetRow?.readOnly ||
      (nextStatus && !targetRow?.allowedStatusValues?.includes(nextStatus) && targetRow?.attendanceStatus !== nextStatus)
    ) {
      return
    }

    setRowDraftState((currentState) => ({
      key: currentSheetKey,
      values: {
        ...(currentState.key === currentSheetKey ? currentState.values : {}),
        [workerId]: {
          ...((currentState.key === currentSheetKey ? currentState.values : {})[workerId] ??
            {}),
          attendanceStatus: nextStatus,
        },
      },
    }))

    if (error) {
      clearError()
    }

    if (successMessage) {
      setSuccessMessage(null)
    }
  }

  const handleRowRateChange = (workerId, nextRateId) => {
    const targetRow = rows.find((row) => row.workerId === workerId)

    if (targetRow?.readOnly) {
      return
    }

    setRowDraftState((currentState) => ({
      key: currentSheetKey,
      values: {
        ...(currentState.key === currentSheetKey ? currentState.values : {}),
        [workerId]: {
          ...((currentState.key === currentSheetKey ? currentState.values : {})[workerId] ??
            {}),
          selectedRateId: normalizeText(nextRateId, null),
        },
      },
    }))

    if (error) {
      clearError()
    }

    if (successMessage) {
      setSuccessMessage(null)
    }
  }

  const handleRowOvertimeFeeChange = (workerId, nextOvertimeFee) => {
    const targetRow = rows.find((row) => row.workerId === workerId)

    if (targetRow?.readOnly) {
      return
    }

    setRowDraftState((currentState) => ({
      key: currentSheetKey,
      values: {
        ...(currentState.key === currentSheetKey ? currentState.values : {}),
        [workerId]: {
          ...((currentState.key === currentSheetKey ? currentState.values : {})[workerId] ??
            {}),
          overtimeFee: nextOvertimeFee,
        },
      },
    }))

    if (error) {
      clearError()
    }

    if (successMessage) {
      setSuccessMessage(null)
    }
  }

  const applyStatusToAll = (nextStatus) => {
    const nextValues = rows.reduce((accumulator, row) => {
      if (row.readOnly) {
        accumulator[row.workerId] = rowDrafts[row.workerId] ?? {}
        return accumulator
      }

      if (
        nextStatus &&
        !row.allowedStatusValues.includes(nextStatus) &&
        row.attendanceStatus !== nextStatus
      ) {
        accumulator[row.workerId] = rowDrafts[row.workerId] ?? {}
        return accumulator
      }

      accumulator[row.workerId] = {
        ...(rowDrafts[row.workerId] ?? {}),
        attendanceStatus: nextStatus,
      }
      return accumulator
    }, {})

    setRowDraftState({
      key: currentSheetKey,
      values: nextValues,
    })

    if (error) {
      clearError()
    }

    if (successMessage) {
      setSuccessMessage(null)
    }
  }

  const handleResetSheet = () => {
    const nextValues = rows.reduce((accumulator, row) => {
      if (row.readOnly) {
        accumulator[row.workerId] = rowDrafts[row.workerId] ?? {}
        return accumulator
      }

      accumulator[row.workerId] = {}
      return accumulator
    }, {})

    setRowDraftState({
      key: currentSheetKey,
      values: nextValues,
    })

    if (error) {
      clearError()
    }

    if (successMessage) {
      setSuccessMessage(null)
    }
  }

  const handleCopyPreviousDay = async () => {
    if (!currentTeamId || !selectedDate || !effectiveSelectedProjectId) {
      return
    }

    const previousDate = getPreviousDateString(selectedDate)

    if (!previousDate) {
      return
    }

    try {
      const previousRows = await fetchAttendanceSheet({
        teamId: currentTeamId,
        date: previousDate,
        projectId: effectiveSelectedProjectId,
        persist: false,
      })
      const previousByWorkerId = new Map(
        previousRows.map((record) => [record.worker_id, record])
      )

      const nextValues = rows.reduce((accumulator, row) => {
        if (row.readOnly) {
          accumulator[row.workerId] = rowDrafts[row.workerId] ?? {}
          return accumulator
        }

        const previousRow = previousByWorkerId.get(row.workerId)

        if (!previousRow) {
          accumulator[row.workerId] = rowDrafts[row.workerId] ?? {}
          return accumulator
        }

        const previousOvertimeFee =
          normalizeText(previousRow.attendance_status, '') === 'overtime'
            ? String(
                deriveAttendanceOvertimeFee({
                  attendanceStatus: previousRow.attendance_status,
                  baseWage: row.baseWage,
                  totalPay: previousRow.total_pay ?? 0,
                  overtimeFee: previousRow.overtime_fee ?? null,
                })
              )
            : ''

        const previousStatus =
          row.allowedStatusValues.includes(previousRow.attendance_status) ||
          row.attendanceStatus === previousRow.attendance_status
            ? previousRow.attendance_status
            : row.attendanceStatus

        accumulator[row.workerId] = {
          ...(rowDrafts[row.workerId] ?? {}),
          attendanceStatus: previousStatus,
          overtimeFee: previousOvertimeFee,
        }
        return accumulator
      }, {})

      setRowDraftState({
        key: currentSheetKey,
        values: nextValues,
      })
      setSuccessMessage('Status absensi hari sebelumnya berhasil disalin ke sheet ini.')
      succeed({
        title: 'Absensi tersalin',
        message: 'Status absensi hari sebelumnya berhasil disalin.',
      })
    } catch (copyError) {
      console.error('Gagal menyalin absensi hari sebelumnya:', copyError)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (isSheetSaving) {
      return
    }

    if (!effectiveSelectedProjectId) {
      return
    }

    try {
      begin({
        title: 'Menyimpan absensi',
        message: 'Mohon tunggu sampai sheet selesai disimpan.',
      })

      setSuccessMessage(null)

      const nextSavedRows = await saveAttendanceSheet({
        teamId: currentTeamId,
        telegramUserId,
        attendanceDate: selectedDate,
        projectId: effectiveSelectedProjectId,
        rows: rows
          .filter((row) => !row.readOnly)
          .map((row) => ({
            sourceId: row.sourceId,
            worker_id: row.workerId,
            worker_name: row.workerName,
            project_name: row.projectName,
            attendance_status: row.attendanceStatus,
            overtime_fee: row.attendanceStatus === 'overtime' ? Number(row.overtimeFee ?? 0) : null,
            total_pay: row.totalPay,
            notes: row.notes,
          })),
      })

      const nextSavedByWorkerId = new Map(
        nextSavedRows.map((record) => [record.worker_id, record])
      )
      const persistedDrafts = rows.reduce((accumulator, row) => {
        const savedRow = nextSavedByWorkerId.get(row.workerId)

        if (!savedRow) {
          return accumulator
        }

        accumulator[row.workerId] = {
          attendanceStatus: savedRow.attendance_status,
          overtimeFee: savedRow.overtime_fee ?? null,
          selectedRateId: rowDrafts[row.workerId]?.selectedRateId ?? null,
        }
        return accumulator
      }, {})

      setRowDraftState({
        key: currentSheetKey,
        values: persistedDrafts,
      })

      setSuccessMessage(
        'Sheet absensi tersimpan. Record ini akan muncul di payroll dan bisa ditagihkan per worker.'
      )

      void notifyTelegram(
        buildAttendanceNotificationPayload({
          projectName: selectedProject?.name ?? 'Proyek',
          attendanceDate: selectedDate,
          recordCount: nextSavedRows.length,
          totalPay: nextSavedRows.reduce(
            (sum, record) => sum + Number(record?.total_pay ?? 0),
            0
          ),
          userName: telegramUserName,
        })
      ).catch((notifyError) => {
        console.error('Notifikasi absensi gagal dikirim:', notifyError)
      })

      if (typeof onSuccess === 'function') {
        await onSuccess(nextSavedRows)
      }

      succeed({
        title: 'Absensi tersimpan',
        message: 'Sheet absensi berhasil disimpan.',
      })
    } catch (submitError) {
      fail({
        title: 'Absensi gagal disimpan',
        message:
          submitError instanceof Error
            ? submitError.message
            : 'Gagal menyimpan sheet absensi.',
      })
      console.error(
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan sheet absensi.'
      )
    }
  }

  return (
    <form id={formId ?? undefined} className="space-y-4" onSubmit={handleSubmit}>
      <fieldset className="space-y-4" disabled={isSheetSaving}>
        <section className="app-page-surface p-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0">
              <p className="app-kicker">Sheet Harian</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="block min-w-0 space-y-2">
              <span>Tanggal</span>
              <input
                className="w-full rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 py-3 text-sm text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                name="date"
                onChange={(event) => setSelectedDate(event.target.value)}
                type="date"
                value={selectedDate}
              />
            </label>

            <MasterPickerField
              disabled={isMasterLoading || activeProjects.length === 0}
              emptyMessage="Data proyek belum tersedia."
              compact
              label="Proyek"
              name="projectId"
              onChange={(nextValue) => setSelectedProjectId(nextValue)}
              placeholder="Pilih proyek"
              searchPlaceholder="Cari proyek..."
              title="Pilih Proyek"
              value={effectiveSelectedProjectId}
              options={projectPickerOptions}
            />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="relative block min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-hint-color)]" />
              <input
                className="w-full rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] py-3 pl-10 pr-4 text-sm text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                onChange={(event) => {
                  const nextValue = event.target.value

                  startTransition(() => {
                    setSearchTerm(nextValue)
                  })
                }}
                placeholder="Cari nama worker atau role"
                value={searchTerm}
              />
            </label>

            <button
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-3 py-2.5 text-xs font-semibold text-[var(--app-text-color)] transition hover:bg-[var(--app-surface-high-color)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!effectiveSelectedProjectId || isSheetLoading}
              onClick={handleCopyPreviousDay}
              type="button"
            >
              <Copy className="h-4 w-4" />
              Salin Kemarin
            </button>
          </div>
        </section>

        <section className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)] gap-2">
          <button
            className="flex min-w-0 items-center justify-between gap-3 rounded-[24px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 py-3 text-left transition hover:bg-[var(--app-surface-high-color)]"
            onClick={handleOpenKpiSheet}
            type="button"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-hint-color)]">
                Total Upah
              </p>
              <p className="mt-1 truncate text-lg font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                {formatCurrency(summary.totalWage)}
              </p>
            </div>
          </button>

          <AppButton
            aria-label="Buka pengaturan massal"
            className="h-full w-full rounded-[24px]"
            iconOnly
            onClick={handleOpenSettingsSheet}
            variant="secondary"
          >
            <Settings2 className="h-4 w-4" />
          </AppButton>
        </section>

        <AttendanceWorkerSheet
          row={activeWorkerSheetRow}
          onClose={() => setActiveWorkerSheetWorkerId(null)}
          onOvertimeFeeChange={handleRowOvertimeFeeChange}
          onRateChange={handleRowRateChange}
          onStatusChange={handleRowStatusChange}
          selectedProjectName={selectedProject?.name ?? ''}
          sheetDate={selectedDate}
        />

        <AttendanceKpiSheet
          open={isKpiSheetOpen}
          onClose={() => setIsKpiSheetOpen(false)}
          rowCount={rows.length}
          selectedProjectName={selectedProject?.name ?? ''}
          sheetDate={selectedDate}
          summary={summary}
        />

        <AttendanceSettingsSheet
          open={isSettingsSheetOpen}
          onAbsentAll={() => applyStatusToAll('absent')}
          onClose={() => setIsSettingsSheetOpen(false)}
          onFullDayAll={() => applyStatusToAll('full_day')}
          onHalfDayAll={() => applyStatusToAll('half_day')}
          onOvertimeAll={() => applyStatusToAll('overtime')}
          onResetAll={handleResetSheet}
          selectedProjectName={selectedProject?.name ?? ''}
          sheetDate={selectedDate}
        />

        {showInlineMutationFeedback && error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
            {error}
          </div>
        ) : null}

        {masterError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            {masterError}
          </div>
        ) : null}

        {showInlineMutationFeedback && successMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        <SmartList
          as="div"
          className="space-y-2"
          data={filteredRows}
          emptyState={
            <div className="app-section-surface px-4 py-5 text-sm text-[var(--app-hint-color)]">
              {isMasterLoading || isSheetLoading ? (
                'Memuat worker dan absensi...'
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Belum ada worker untuk filter proyek ini.
                </span>
              )}
            </div>
          }
          initialCount={16}
          loadMoreStep={16}
          loadMoreClassName="border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)]"
          renderItem={(row) => (
            <AttendanceRowCard row={row} onOpen={() => handleOpenWorkerSheet(row.workerId)} />
          )}
        />

        {hideActions ? null : (
          <button
            className="flex w-full items-center justify-center rounded-[22px] bg-[var(--app-button-color)] px-5 py-4 text-base font-semibold text-[var(--app-button-text-color)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSheetSaving || !effectiveSelectedProjectId}
            type="submit"
          >
            Simpan Absensi
          </button>
        )}
      </fieldset>
    </form>
  )
}

export default AttendanceForm
