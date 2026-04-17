import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Copy, RefreshCcw, Search, Users } from 'lucide-react'
import SmartList from './ui/SmartList'
import useTelegram from '../hooks/useTelegram'
import useAttendanceStore from '../store/useAttendanceStore'
import useAuthStore from '../store/useAuthStore'
import useMasterStore from '../store/useMasterStore'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0)
}

function getTodayDateString() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
  }).format(new Date())
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
      },
      totalWage: 0,
      filledCount: 0,
    }
  )
}

function AttendanceSummaryChip({ label, value, toneClassName = '' }) {
  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClassName}`}>
      <p className="text-[11px] uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-1 text-base font-semibold tracking-[-0.03em]">{value}</p>
    </div>
  )
}

function AttendanceRowCard({ row, statusOptions, onStatusChange, onNotesChange }) {
  return (
    <article className="app-section-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
            {row.workerName}
          </p>
          <p className="mt-1 text-xs text-[var(--app-hint-color)]">
            {row.roleName || 'Pekerja'} • {row.projectName}
          </p>
          {row.hasRate ? (
            <p className="mt-1 text-[11px] text-[var(--app-hint-color)]">
              Upah dasar {formatCurrency(row.baseWage)}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-amber-700">
              Rate upah belum diatur untuk worker ini.
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--app-hint-color)]">
            Upah
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--app-text-color)]">
            {formatCurrency(row.totalPay)}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)]">
        <select
          className="w-full rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-3 py-3 text-sm text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          onChange={(event) => onStatusChange(row.workerId, event.target.value)}
          value={row.attendanceStatus}
        >
          <option value="">Belum diisi</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          className="w-full rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-3 py-3 text-sm text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          onChange={(event) => onNotesChange(row.workerId, event.target.value)}
          placeholder="Catatan singkat, opsional"
          value={row.notes}
        />
      </div>
    </article>
  )
}

function AttendanceForm({ onSuccess, formId = null, hideActions = false }) {
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const workers = useMasterStore((state) => state.workers)
  const projects = useMasterStore((state) => state.projects)
  const workerWageRates = useMasterStore((state) => state.workerWageRates)
  const isMasterLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const attendanceStatusOptions = useAttendanceStore(
    (state) => state.attendanceStatusOptions
  )
  const attendanceStatusMultiplier = useAttendanceStore(
    (state) => state.attendanceStatusMultiplier
  )
  const sheetAttendances = useAttendanceStore((state) => state.sheetAttendances)
  const isSheetLoading = useAttendanceStore((state) => state.isSheetLoading)
  const isSheetSaving = useAttendanceStore((state) => state.isSheetSaving)
  const error = useAttendanceStore((state) => state.error)
  const clearError = useAttendanceStore((state) => state.clearError)
  const fetchAttendanceSheet = useAttendanceStore((state) => state.fetchAttendanceSheet)
  const saveAttendanceSheet = useAttendanceStore((state) => state.saveAttendanceSheet)
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateString())
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [rowDraftState, setRowDraftState] = useState({
    key: '',
    values: {},
  })
  const [successMessage, setSuccessMessage] = useState(null)
  const deferredSearchTerm = useDeferredValue(searchTerm)
  const telegramUserId = user?.id ?? authUser?.telegram_user_id ?? null

  const activeProjects = useMemo(() => {
    const allProjects = projects.filter(
      (project) => !project.deleted_at && project.is_active !== false
    )
    const wageProjects = allProjects.filter((project) => project.is_wage_assignable)

      return wageProjects.length > 0 ? wageProjects : allProjects
  }, [projects])

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

  const rowDrafts = useMemo(() => {
    return rowDraftState.key === currentSheetKey ? rowDraftState.values : {}
  }, [currentSheetKey, rowDraftState.key, rowDraftState.values])

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
      const matchedRate = getWorkerRate(worker.id, effectiveSelectedProjectId, workerWageRates)
      const baseWage = Number(matchedRate?.wage_amount ?? 0)
      const attendanceStatus =
        draft?.attendanceStatus ?? existingRecord?.attendance_status ?? ''
      const multiplier = attendanceStatusMultiplier(attendanceStatus)

      return {
        sourceId: existingRecord?.id ?? null,
        workerId: worker.id,
        workerName: normalizeText(worker.name, existingRecord?.worker_name ?? 'Pekerja'),
        projectId: effectiveSelectedProjectId,
        projectName: normalizeText(
          selectedProject?.name,
          existingRecord?.project_name ?? 'Proyek'
        ),
        roleName: normalizeText(worker.default_role_name, ''),
        baseWage,
        attendanceStatus,
        notes: draft?.notes ?? existingRecord?.notes ?? '',
        totalPay:
          draft?.attendanceStatus != null || draft?.notes != null
            ? Math.round(baseWage * multiplier)
            : existingRecord?.id != null
              ? Number(existingRecord.total_pay ?? 0)
              : Math.round(baseWage * multiplier),
        hasRate: baseWage > 0,
      }
    })
  }, [
    attendanceStatusMultiplier,
    candidateWorkers,
    effectiveSelectedProjectId,
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

  const handleRowStatusChange = (workerId, nextStatus) => {
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

  const handleRowNotesChange = (workerId, nextNotes) => {
    setRowDraftState((currentState) => ({
      key: currentSheetKey,
      values: {
        ...(currentState.key === currentSheetKey ? currentState.values : {}),
        [workerId]: {
          ...((currentState.key === currentSheetKey ? currentState.values : {})[workerId] ??
            {}),
          notes: nextNotes,
        },
      },
    }))

    if (error) {
      clearError()
    }
  }

  const applyStatusToAll = (nextStatus) => {
    const nextValues = rows.reduce((accumulator, row) => {
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
        const previousRow = previousByWorkerId.get(row.workerId)

        if (!previousRow) {
          accumulator[row.workerId] = rowDrafts[row.workerId] ?? {}
          return accumulator
        }

        accumulator[row.workerId] = {
          ...(rowDrafts[row.workerId] ?? {}),
          attendanceStatus: previousRow.attendance_status,
          notes: previousRow.notes ?? '',
        }
        return accumulator
      }, {})

      setRowDraftState({
        key: currentSheetKey,
        values: nextValues,
      })
      setSuccessMessage('Status absensi hari sebelumnya berhasil disalin ke sheet ini.')
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
      setSuccessMessage(null)

      const nextSavedRows = await saveAttendanceSheet({
        teamId: currentTeamId,
        telegramUserId,
        attendanceDate: selectedDate,
        projectId: effectiveSelectedProjectId,
        rows: rows.map((row) => ({
          sourceId: row.sourceId,
          worker_id: row.workerId,
          worker_name: row.workerName,
          project_name: row.projectName,
          attendance_status: row.attendanceStatus,
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
          notes: savedRow.notes ?? '',
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

      if (typeof onSuccess === 'function') {
        await onSuccess(nextSavedRows)
      }
    } catch (submitError) {
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
        <section className="app-page-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="app-kicker">Sheet Harian</p>
            </div>

            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)] transition hover:bg-white"
              onClick={() => {
                if (!currentTeamId || !effectiveSelectedProjectId) {
                  return
                }

                void fetchAttendanceSheet({
                  teamId: currentTeamId,
                  date: selectedDate,
                  projectId: effectiveSelectedProjectId,
                }).catch((fetchError) => {
                  console.error('Gagal refresh sheet absensi:', fetchError)
                })
              }}
              type="button"
              aria-label="Refresh absensi"
            >
              <RefreshCcw className={`h-4 w-4 ${isSheetLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span>Tanggal</span>
              <input
                className="w-full rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 py-3 text-sm text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                name="date"
                onChange={(event) => setSelectedDate(event.target.value)}
                type="date"
                value={selectedDate}
              />
            </label>

            <label className="block space-y-2">
              <span>Proyek</span>
              <select
                className="w-full rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 py-3 text-sm text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                name="projectId"
                onChange={(event) => setSelectedProjectId(event.target.value)}
                value={effectiveSelectedProjectId}
              >
                <option value="">Pilih proyek</option>
                {activeProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block">
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
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 py-3 text-sm font-semibold text-[var(--app-text-color)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!effectiveSelectedProjectId || isSheetLoading}
              onClick={handleCopyPreviousDay}
              type="button"
            >
              <Copy className="h-4 w-4" />
              Salin Kemarin
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <AttendanceSummaryChip
            label="Worker Terisi"
            toneClassName="border-emerald-200 bg-emerald-50 text-emerald-800"
            value={`${summary.filledCount}/${rows.length}`}
          />
          <AttendanceSummaryChip
            label="Full Day"
            toneClassName="border-sky-200 bg-sky-50 text-sky-800"
            value={String(summary.counts.full_day)}
          />
          <AttendanceSummaryChip
            label="Half Day"
            toneClassName="border-amber-200 bg-amber-50 text-amber-800"
            value={String(summary.counts.half_day)}
          />
          <AttendanceSummaryChip
            label="Total Upah"
            toneClassName="border-slate-200 bg-slate-50 text-slate-900"
            value={formatCurrency(summary.totalWage)}
          />
        </section>

        <section className="app-page-surface p-3">
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
              onClick={() => applyStatusToAll('full_day')}
              type="button"
            >
              Full Day Semua
            </button>
            <button
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
              onClick={() => applyStatusToAll('half_day')}
              type="button"
            >
              Half Day Semua
            </button>
            <button
              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
              onClick={() => applyStatusToAll('overtime')}
              type="button"
            >
              Lembur Semua
            </button>
            <button
              className="rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-3 py-2 text-xs font-semibold text-[var(--app-hint-color)] transition hover:bg-white"
              onClick={() =>
                setRowDraftState({
                  key: currentSheetKey,
                  values: rows.reduce((accumulator, row) => {
                    accumulator[row.workerId] = {
                      ...(rowDrafts[row.workerId] ?? {}),
                      attendanceStatus: '',
                      notes: '',
                    }
                    return accumulator
                  }, {}),
                })
              }
              type="button"
            >
              Reset Sheet
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
            {error}
          </div>
        ) : null}

        {masterError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            {masterError}
          </div>
        ) : null}

        {successMessage ? (
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
            <AttendanceRowCard
              row={row}
              statusOptions={attendanceStatusOptions}
              onNotesChange={handleRowNotesChange}
              onStatusChange={handleRowStatusChange}
            />
          )}
        />

        {hideActions ? null : (
          <button
            className="flex w-full items-center justify-center rounded-[22px] bg-[var(--app-button-color)] px-5 py-4 text-base font-semibold text-[var(--app-button-text-color)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSheetSaving || !effectiveSelectedProjectId}
            type="submit"
          >
            {isSheetSaving ? 'Menyimpan Sheet...' : 'Simpan Sheet Absensi'}
          </button>
        )}
      </fieldset>
    </form>
  )
}

export default AttendanceForm
