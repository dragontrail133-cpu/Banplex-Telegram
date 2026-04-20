import { createElement, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays,
  CalendarRange,
  FilePenLine,
  Info,
  Loader2,
  MoreVertical,
  UserRound,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatAppCalendarLabel, formatAppDateLabel, getAppTodayKey } from '../lib/date-time'
import { fetchAttendanceHistoryFromApi } from '../lib/records-api'
import useAuthStore from '../store/useAuthStore'
import {
  AppButton,
  AppCardDashed,
  AppCardStrong,
  AppListCard,
  AppListRow,
  AppSheet,
} from './ui/AppPrimitives'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  const amount = Number(value)

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function formatMonthValue(value) {
  const normalizedValue = String(value ?? '').trim()

  if (normalizedValue) {
    return normalizedValue
  }

  return getAppTodayKey().slice(0, 7)
}

function getStatusLabel(status) {
  const normalizedStatus = String(status ?? '').trim().toLowerCase()

  if (normalizedStatus === 'half_day') {
    return 'Half Day'
  }

  if (normalizedStatus === 'overtime') {
    return 'Lembur'
  }

  return 'Full Day'
}

function getBillingLabel(status) {
  return String(status ?? '').trim().toLowerCase() === 'billed' ? 'Billed' : 'Unbilled'
}

function getWorkerName(record) {
  return (
    String(record?.worker_name ?? record?.worker_name_snapshot ?? record?.workers?.name ?? '')
      .trim() || 'Pekerja'
  )
}

function getProjectName(record) {
  return (
    String(record?.project_name ?? record?.project_name_snapshot ?? record?.projects?.name ?? '')
      .trim() || 'Proyek'
  )
}

function compareDateDesc(left, right) {
  return String(right ?? '').localeCompare(String(left ?? ''))
}

function compareText(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), 'id', {
    sensitivity: 'base',
  })
}

function getUniqueWorkerIds(records = []) {
  const workerIds = new Set()

  for (const record of records) {
    const workerId = String(record?.worker_id ?? '').trim()

    if (workerId) {
      workerIds.add(workerId)
    }
  }

  return [...workerIds]
}

function getEligibleRecapRecords(records = []) {
  return records.filter(
    (record) => String(record?.billing_status ?? '').trim().toLowerCase() === 'unbilled'
  )
}

function buildRecapContext(kind, group) {
  const eligibleRecords = getEligibleRecapRecords(group?.records ?? [])

  if (kind === 'daily') {
    return {
      tab: 'daily',
      dateKey: group?.dateKey ?? null,
      workerIds: getUniqueWorkerIds(eligibleRecords),
      recapRecordCount: eligibleRecords.length,
      group,
    }
  }

  return {
    tab: 'worker',
    workerId: group?.workerId ?? null,
    dateRange: {
      from: group?.firstDate ?? null,
      to: group?.lastDate ?? null,
    },
    recapRecordCount: eligibleRecords.length,
    group,
  }
}

function getRecapableRecordCount(kind, group) {
  return buildRecapContext(kind, group)?.recapRecordCount ?? 0
}

function buildDailyGroups(attendances = []) {
  const groups = new Map()

  for (const attendance of attendances) {
    const dateKey = String(attendance?.attendance_date ?? '').trim()

    if (!dateKey) {
      continue
    }

    const nextGroup =
      groups.get(dateKey) ?? {
        dateKey,
        records: [],
        billedCount: 0,
        unbilledCount: 0,
      }

    nextGroup.records.push(attendance)

    if (String(attendance?.billing_status ?? '').trim().toLowerCase() === 'billed') {
      nextGroup.billedCount += 1
    } else {
      nextGroup.unbilledCount += 1
    }

    groups.set(dateKey, nextGroup)
  }

  return [...groups.values()]
    .map((group) => {
      const records = [...group.records].sort((left, right) => {
        const workerCompare = compareText(getWorkerName(left), getWorkerName(right))

        if (workerCompare !== 0) {
          return workerCompare
        }

        return compareDateDesc(left?.created_at ?? '', right?.created_at ?? '')
      })

      return {
        ...group,
        records,
        workerIds: getUniqueWorkerIds(records),
        title: formatAppCalendarLabel(group.dateKey) || group.dateKey,
        description: `${records.length} terabsen`,
      }
    })
    .sort((left, right) => compareDateDesc(left.dateKey, right.dateKey))
}

function buildWorkerGroups(attendances = []) {
  const groups = new Map()

  for (const attendance of attendances) {
    const workerId = String(attendance?.worker_id ?? '').trim()
    const workerName = getWorkerName(attendance)
    const groupKey = workerId || workerName

    const nextGroup =
      groups.get(groupKey) ?? {
        workerId: workerId || null,
        workerName,
        records: [],
        billedCount: 0,
        unbilledCount: 0,
      }

    nextGroup.records.push(attendance)

    if (String(attendance?.billing_status ?? '').trim().toLowerCase() === 'billed') {
      nextGroup.billedCount += 1
    } else {
      nextGroup.unbilledCount += 1
    }

    groups.set(groupKey, nextGroup)
  }

  return [...groups.values()]
    .map((group) => {
      const records = [...group.records].sort((left, right) => {
        const dateCompare = compareDateDesc(left?.attendance_date ?? '', right?.attendance_date ?? '')

        if (dateCompare !== 0) {
          return dateCompare
        }

        return compareText(getProjectName(left), getProjectName(right))
      })

      const firstDate = records.at(-1)?.attendance_date ?? null
      const lastDate = records[0]?.attendance_date ?? null

      return {
        ...group,
        records,
        firstDate,
        lastDate,
        title: group.workerName,
        description: `${records.length} record`,
      }
    })
    .sort((left, right) => compareText(left.workerName, right.workerName))
}

function getActionConfig(tab, group) {
  const recapableRecordCount = getRecapableRecordCount(tab, group)

  if (tab === 'daily') {
    return [
      ...(recapableRecordCount > 0
        ? [
            {
              id: 'recap',
              label: 'Rekap',
              icon: CalendarRange,
            },
          ]
        : []),
      {
        id: 'edit',
        label: 'Edit Absensi',
        icon: FilePenLine,
      },
      {
        id: 'detail',
        label: 'Detail',
        icon: Info,
      },
    ]
  }

  return [
    ...(recapableRecordCount > 0
      ? [
          {
            id: 'recap',
            label: 'Rekap',
            icon: CalendarRange,
          },
        ]
      : []),
    {
      id: 'detail',
      label: 'Detail',
      icon: Info,
    },
  ]
}

function AttendanceSummaryRow({ icon, title, description, onOpenActions }) {
  const leadingIcon = icon ? createElement(icon, { className: 'h-4 w-4' }) : null

  return (
    <AppCardStrong padded={false}>
      <div className="flex items-center gap-3 px-3 py-3">
        <button
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={onOpenActions}
          type="button"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-low-color)] text-[var(--app-text-color)]">
            {leadingIcon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">{title}</p>
            {description ? (
              <p className="mt-0.5 text-xs text-[var(--app-hint-color)]">{description}</p>
            ) : null}
          </div>
        </button>

        <button
          aria-label={`Aksi ${title}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)]"
          onClick={onOpenActions}
          type="button"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </AppCardStrong>
  )
}

function DetailSummaryCard({ label, value }) {
  return (
    <AppCardDashed className="space-y-1 p-3" padded={false}>
      <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--app-hint-color)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--app-text-color)]">{value}</p>
    </AppCardDashed>
  )
}

function AttendanceDetailList({ group, mode, onEditRecord }) {
  if (!group) {
    return null
  }

  return (
    <AppListCard padded={false} className="overflow-hidden rounded-[24px]">
      {group.records.map((record) => {
        const showEditAction = mode === 'daily-edit'

        return (
          <AppListRow
            key={record.id}
            leading={
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--app-surface-low-color)] text-[var(--app-text-color)]">
                {mode === 'worker' ? (
                  <CalendarDays className="h-4 w-4" />
                ) : (
                  <UserRound className="h-4 w-4" />
                )}
              </div>
            }
            title={
              mode === 'worker' ? formatAppDateLabel(record.attendance_date) : getWorkerName(record)
            }
            description={`${getProjectName(record)} · ${getStatusLabel(record.attendance_status)} · ${getBillingLabel(record.billing_status)}`}
            trailing={
              <div className="flex flex-col items-end gap-2">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  {formatCurrency(record.total_pay)}
                </p>
                {showEditAction ? (
                  <AppButton
                    onClick={() => onEditRecord?.(record)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Edit
                  </AppButton>
                ) : null}
              </div>
            }
          />
        )
      })}
    </AppListCard>
  )
}

function PayrollAttendanceHistory({ onRequestRecap = null, refreshToken = 0 }) {
  const navigate = useNavigate()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const [activeTab, setActiveTab] = useState('daily')
  const [selectedMonth] = useState(() => formatMonthValue(''))
  const [attendances, setAttendances] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sheetState, setSheetState] = useState({
    kind: null,
    mode: null,
    group: null,
  })
  const [recapError, setRecapError] = useState(null)
  const [isRecapSubmitting, setIsRecapSubmitting] = useState(false)

  useEffect(() => {
    if (!currentTeamId) {
      setAttendances([])
      setError(null)
      return
    }

    let isActive = true

    async function loadAttendanceHistory() {
      setIsLoading(true)
      setError(null)

      try {
        const nextAttendances = await fetchAttendanceHistoryFromApi({
          teamId: currentTeamId,
          month: selectedMonth,
        })

        if (isActive) {
          setAttendances(nextAttendances)
        }
      } catch (loadError) {
        if (isActive) {
          setAttendances([])
          setError(loadError instanceof Error ? loadError.message : 'Gagal memuat data.')
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadAttendanceHistory()

    return () => {
      isActive = false
    }
  }, [currentTeamId, refreshToken, selectedMonth])

  const dailyGroups = useMemo(() => buildDailyGroups(attendances), [attendances])
  const workerGroups = useMemo(() => buildWorkerGroups(attendances), [attendances])
  const activeGroups = activeTab === 'daily' ? dailyGroups : workerGroups
  const selectedRecapContext = useMemo(() => {
    if (!sheetState.group || sheetState.mode !== 'recap-confirm') {
      return null
    }

    return buildRecapContext(sheetState.kind, sheetState.group)
  }, [sheetState.group, sheetState.kind, sheetState.mode])
  const activeSheetTitle =
    sheetState.kind === 'daily'
      ? sheetState.mode === 'daily-edit'
        ? 'Edit Absensi'
        : 'Detail Harian'
      : sheetState.kind === 'worker'
        ? 'Detail Pekerja'
        : 'Detail'

  const openActionSheet = (kind, group) => {
    setRecapError(null)
    setSheetState({
      kind,
      mode: 'actions',
      group,
    })
  }

  const closeSheet = () => {
    setRecapError(null)
    setIsRecapSubmitting(false)
    setSheetState({
      kind: null,
      mode: null,
      group: null,
    })
  }

  const openDetailSheet = (kind, group, mode = 'detail') => {
    setRecapError(null)
    setSheetState({
      kind,
      mode,
      group,
    })
  }

  const openRecapConfirmSheet = () => {
    setRecapError(null)
    setSheetState({
      kind: sheetState.kind,
      mode: 'recap-confirm',
      group: sheetState.group,
    })
  }

  const handleConfirmRecap = async () => {
    if (!sheetState.group) {
      return
    }

    const nextContext = buildRecapContext(sheetState.kind, sheetState.group)

    setIsRecapSubmitting(true)
    setRecapError(null)

    try {
      await onRequestRecap?.(nextContext)
      closeSheet()
    } catch (confirmError) {
      setRecapError(
        confirmError instanceof Error ? confirmError.message : 'Rekap gagal.'
      )
    } finally {
      setIsRecapSubmitting(false)
    }
  }

  const handleEditRecord = (record) => {
    if (!record?.id) {
      return
    }

    closeSheet()
    navigate(`/edit/attendance/${record.id}`, {
      state: {
        item: record,
      },
    })
  }

  const handleSelectAction = (actionId) => {
    if (!sheetState.group) {
      return
    }

    if (actionId === 'recap') {
      openRecapConfirmSheet()
      return
    }

    if (actionId === 'edit') {
      openDetailSheet('daily', sheetState.group, 'daily-edit')
      return
    }

    if (actionId === 'detail') {
      openDetailSheet(sheetState.kind, sheetState.group, 'detail')
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-[24px] bg-[var(--app-surface-low-color)] p-1">
        <AppButton
          fullWidth
          onClick={() => setActiveTab('daily')}
          size="sm"
          type="button"
          variant={activeTab === 'daily' ? 'primary' : 'secondary'}
        >
          Harian
        </AppButton>
        <AppButton
          fullWidth
          onClick={() => setActiveTab('worker')}
          size="sm"
          type="button"
          variant={activeTab === 'worker' ? 'primary' : 'secondary'}
        >
          Pekerja
        </AppButton>
      </div>

      {error ? (
        <AppCardDashed className="app-tone-danger text-sm leading-6 text-rose-700">
          {error}
        </AppCardDashed>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <AppCardStrong key={item}>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--app-surface-low-color)]" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-2/3 animate-pulse rounded-full bg-[var(--app-surface-low-color)]" />
                  <div className="mt-2 h-3 w-1/3 animate-pulse rounded-full bg-[var(--app-surface-low-color)]" />
                </div>
              </div>
            </AppCardStrong>
          ))}
        </div>
      ) : activeGroups.length > 0 ? (
        <div className="space-y-3">
          {activeGroups.map((group) => (
            <AttendanceSummaryRow
              key={group.dateKey ?? group.workerId ?? group.workerName}
              icon={activeTab === 'daily' ? CalendarDays : UserRound}
              title={group.title}
              description={group.description}
              onOpenActions={() => openActionSheet(activeTab, group)}
            />
          ))}
        </div>
      ) : (
        <AppCardDashed className="px-4 py-5 text-sm text-[var(--app-hint-color)]">
          Tidak ada data.
        </AppCardDashed>
      )}

      <AppSheet
        open={sheetState.mode === 'actions'}
        onClose={closeSheet}
        title={sheetState.kind === 'daily' ? 'Aksi Harian' : 'Aksi Pekerja'}
      >
        <div className="space-y-2">
          {getActionConfig(sheetState.kind, sheetState.group).map((action) => (
            <AppButton
              key={action.id}
              fullWidth
              leadingIcon={<action.icon className="h-4 w-4" />}
              onClick={() => handleSelectAction(action.id)}
              type="button"
              variant="secondary"
            >
              {action.label}
            </AppButton>
          ))}
        </div>
      </AppSheet>

      <AppSheet
        open={sheetState.mode === 'recap-confirm'}
        onClose={closeSheet}
        title={sheetState.kind === 'daily' ? 'Konfirmasi Rekap Harian' : 'Konfirmasi Rekap Pekerja'}
      >
        {sheetState.group ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {sheetState.kind === 'daily' ? (
                <>
                  <DetailSummaryCard label="Hari" value={sheetState.group.title} />
                  <DetailSummaryCard
                    label="Pekerja"
                    value={String(selectedRecapContext?.workerIds?.length ?? 0)}
                  />
                  <DetailSummaryCard
                    label="Record"
                    value={String(selectedRecapContext?.recapRecordCount ?? 0)}
                  />
                  <DetailSummaryCard
                    label="Billed"
                    value={String(sheetState.group.billedCount ?? 0)}
                  />
                </>
              ) : (
                <>
                  <DetailSummaryCard label="Pekerja" value={sheetState.group.workerName} />
                  <DetailSummaryCard label="Dari" value={formatAppDateLabel(sheetState.group.firstDate)} />
                  <DetailSummaryCard label="Sampai" value={formatAppDateLabel(sheetState.group.lastDate)} />
                  <DetailSummaryCard
                    label="Record"
                    value={String(selectedRecapContext?.recapRecordCount ?? 0)}
                  />
                </>
              )}
            </div>

            {recapError ? (
              <AppCardDashed className="app-tone-danger text-sm leading-6 text-rose-700">
                {recapError}
              </AppCardDashed>
            ) : null}

            <div className="flex gap-2">
              <AppButton fullWidth onClick={closeSheet} type="button" variant="secondary">
                Batal
              </AppButton>
              <AppButton
                fullWidth
                disabled={isRecapSubmitting || (selectedRecapContext?.recapRecordCount ?? 0) === 0}
                leadingIcon={isRecapSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                onClick={handleConfirmRecap}
                type="button"
              >
                {isRecapSubmitting ? 'Memproses...' : 'Rekap'}
              </AppButton>
            </div>
          </div>
        ) : null}
      </AppSheet>

      <AppSheet
        open={sheetState.mode === 'detail' || sheetState.mode === 'daily-edit'}
        onClose={closeSheet}
        title={activeSheetTitle}
      >
        {sheetState.group ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {sheetState.kind === 'daily' ? (
                <>
                  <DetailSummaryCard label="Hari" value={sheetState.group.title} />
                  <DetailSummaryCard
                    label="Record"
                    value={String(sheetState.group.records.length)}
                  />
                  <DetailSummaryCard
                    label="Billed"
                    value={String(sheetState.group.billedCount ?? 0)}
                  />
                  <DetailSummaryCard
                    label="Unbilled"
                    value={String(sheetState.group.unbilledCount ?? 0)}
                  />
                </>
              ) : (
                <>
                  <DetailSummaryCard label="Pekerja" value={sheetState.group.workerName} />
                  <DetailSummaryCard
                    label="Record"
                    value={String(sheetState.group.records.length)}
                  />
                  <DetailSummaryCard
                    label="Billed"
                    value={String(sheetState.group.billedCount ?? 0)}
                  />
                  <DetailSummaryCard
                    label="Unbilled"
                    value={String(sheetState.group.unbilledCount ?? 0)}
                  />
                </>
              )}
            </div>

            {sheetState.kind === 'worker' && sheetState.group.firstDate && sheetState.group.lastDate ? (
              <div className="grid grid-cols-2 gap-2">
                <DetailSummaryCard label="Dari" value={formatAppDateLabel(sheetState.group.firstDate)} />
                <DetailSummaryCard label="Sampai" value={formatAppDateLabel(sheetState.group.lastDate)} />
              </div>
            ) : null}

            <AttendanceDetailList
              group={sheetState.group}
              mode={sheetState.kind === 'daily' && sheetState.mode === 'daily-edit' ? 'daily-edit' : sheetState.kind}
              onEditRecord={handleEditRecord}
            />
          </div>
        ) : null}
      </AppSheet>
    </div>
  )
}

export default PayrollAttendanceHistory
