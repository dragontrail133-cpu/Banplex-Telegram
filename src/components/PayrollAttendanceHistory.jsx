import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import {
  CircleDollarSign,
  CalendarDays,
  CalendarRange,
  FilePenLine,
  Info,
  Loader2,
  UserRound,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatAppCalendarLabel, formatAppDateLabel, getAppTodayKey } from '../lib/date-time'
import {
  fetchAttendanceHistoryFromApi,
  fetchAttendanceHistorySummaryFromApi,
} from '../lib/records-api'
import useAuthStore from '../store/useAuthStore'
import useToastStore from '../store/useToastStore'
import {
  AppButton,
  AppCardDashed,
  AppCardStrong,
  AppListCard,
  AppListRow,
  AppSheet,
} from './ui/AppPrimitives'
import ActionCard, { ActionCardSheet } from './ui/ActionCard'

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

  if (normalizedStatus === 'absent') {
    return 'Tidak Hadir'
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
    (record) =>
      String(record?.billing_status ?? '').trim().toLowerCase() === 'unbilled' &&
      Number(record?.total_pay ?? 0) > 0 &&
      !record?.salary_bill_id
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
  const summaryCount = Number(group?.recapableCount ?? 0)

  if (!Array.isArray(group?.records) || group.records.length === 0) {
    return summaryCount
  }

  return buildRecapContext(kind, group)?.recapRecordCount ?? summaryCount
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

function getActionConfig(tab, group, paymentTarget = null) {
  const recapableRecordCount = getRecapableRecordCount(tab, group)

  if (tab === 'daily') {
    return [
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
    ...(paymentTarget
      ? [
          {
            id: 'pay',
            label: 'Bayar',
            icon: CircleDollarSign,
          },
        ]
      : []),
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

function AttendanceSummaryRow({ icon, title, description, actions, onOpenActions }) {
  const leadingIcon = icon ? createElement(icon, { className: 'h-4 w-4' }) : null

  return (
    <ActionCard
      title={title}
      subtitle={description}
      actions={actions}
      menuMode="shared"
      onOpenMenu={onOpenActions}
      leadingIcon={leadingIcon}
      className="app-card px-3 py-3"
    />
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

  const records = Array.isArray(group.records) ? group.records : []

  return (
    <AppListCard padded={false} className="overflow-hidden rounded-[24px]">
      {records.map((record) => {
        const showEditAction =
          mode === 'daily-edit' &&
          String(record?.billing_status ?? '').trim().toLowerCase() !== 'billed' &&
          !record?.salary_bill_id

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

function PayrollAttendanceHistory({
  onRequestPay = null,
  onRequestRecap = null,
  refreshToken = 0,
  resolveWorkerPaymentTarget = null,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const requestedTab = useMemo(() => {
    const nextTab = new URLSearchParams(location.search).get('tab')

    return nextTab === 'worker' ? 'worker' : 'daily'
  }, [location.search])
  const [activeTab, setActiveTab] = useState(requestedTab)
  const [selectedMonth] = useState(() => formatMonthValue(''))
  const [dailyGroups, setDailyGroups] = useState([])
  const [workerGroups, setWorkerGroups] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sheetState, setSheetState] = useState({
    kind: null,
    mode: null,
    group: null,
  })
  const [activeActionCard, setActiveActionCard] = useState(null)
  const [isRecapSubmitting, setIsRecapSubmitting] = useState(false)
  const loadRequestIdRef = useRef(0)
  const showToast = useToastStore((state) => state.showToast)

  useEffect(() => {
    setActiveTab(requestedTab)
  }, [requestedTab])

  useEffect(() => {
    if (!currentTeamId) {
      setDailyGroups([])
      setWorkerGroups([])
      setError(null)
      setSheetState({
        kind: null,
        mode: null,
        group: null,
      })
      setActiveActionCard(null)
      return
    }

    let isActive = true
    loadRequestIdRef.current += 1
    setIsRecapSubmitting(false)
    setActiveActionCard(null)
    setSheetState({
      kind: null,
      mode: null,
      group: null,
    })

    async function loadAttendanceHistory() {
      setIsLoading(true)
      setError(null)

      try {
        const nextSummary = await fetchAttendanceHistorySummaryFromApi({
          teamId: currentTeamId,
          month: selectedMonth,
        })

        if (isActive) {
          setDailyGroups(
            (nextSummary.dailyGroups ?? []).map((group) => ({
              ...group,
              title: formatAppCalendarLabel(group.dateKey) || group.title || group.dateKey,
              description: group.description ?? `${group.recordCount ?? 0} terabsen`,
            }))
          )
          setWorkerGroups(
            (nextSummary.workerGroups ?? []).map((group) => ({
              ...group,
              title: group.title || group.workerName,
              description: group.description ?? `${group.recordCount ?? 0} record`,
            }))
          )
        }
      } catch (loadError) {
        if (isActive) {
          setDailyGroups([])
          setWorkerGroups([])
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

  const activeGroups = activeTab === 'daily' ? dailyGroups : workerGroups
  const activeRecapGroup = sheetState.mode === 'recap-confirm' ? sheetState.group : null
  const activeDetailGroup =
    sheetState.mode === 'detail' || sheetState.mode === 'daily-edit' ? sheetState.group : null
  const activeDetailRecords = Array.isArray(activeDetailGroup?.records)
    ? activeDetailGroup.records
    : []
  const selectedRecapContext = useMemo(() => {
    if (!activeRecapGroup) {
      return null
    }

    return buildRecapContext(sheetState.kind, activeRecapGroup)
  }, [activeRecapGroup, sheetState.kind])
  const activeSheetTitle =
    sheetState.mode === 'recap-confirm'
      ? sheetState.kind === 'daily'
        ? 'Konfirmasi Rekap Harian'
        : 'Konfirmasi Rekap Pekerja'
      : sheetState.mode === 'daily-edit'
        ? 'Edit Absensi'
        : sheetState.kind === 'daily'
          ? 'Detail Harian'
          : sheetState.kind === 'worker'
            ? 'Detail Pekerja'
            : 'Detail'

  const closeSheet = () => {
    loadRequestIdRef.current += 1
    setIsRecapSubmitting(false)
    setActiveActionCard(null)
    setSheetState({
      kind: null,
      mode: null,
      group: null,
    })
  }

  const handleOpenActionMenu = (menuState) => {
    setActiveActionCard(menuState)
  }

  const handleCloseActionMenu = () => {
    setActiveActionCard(null)
  }

  const handleTabChange = (nextTab) => {
    setActiveTab(nextTab)
    handleCloseActionMenu()

    navigate(
      {
        pathname: location.pathname,
        search: nextTab === 'worker' ? '?tab=worker' : '',
      },
      { replace: true }
    )
  }

  const hydrateAttendanceGroup = (kind, group, records = []) => {
    const normalizedRecords = Array.isArray(records) ? records : []
    const summaryGroup =
      kind === 'daily'
        ? buildDailyGroups(normalizedRecords).find((item) => item.dateKey === group?.dateKey) ??
          null
        : buildWorkerGroups(normalizedRecords).find(
            (item) =>
              item.workerId === group?.workerId || item.workerName === group?.workerName
          ) ?? null
    const fallbackRecords = Array.isArray(group?.records) ? group.records : []
    const fallbackRecordCount = Number(group?.recordCount ?? fallbackRecords.length ?? 0)
    const fallbackBilledCount = Number(group?.billedCount ?? 0)
    const fallbackUnbilledCount = Number(group?.unbilledCount ?? 0)
    const fallbackRecapableCount = Number(group?.recapableCount ?? 0)

    return {
      ...group,
      ...(summaryGroup ?? {}),
      records:
        summaryGroup?.records ??
        (normalizedRecords.length > 0 ? normalizedRecords : fallbackRecords),
      recordCount:
        summaryGroup?.records?.length ??
        (normalizedRecords.length > 0 ? normalizedRecords.length : fallbackRecordCount),
      billedCount:
        summaryGroup?.billedCount ??
        (normalizedRecords.length > 0
          ? normalizedRecords.filter(
              (record) => String(record?.billing_status ?? '').trim().toLowerCase() === 'billed'
            ).length
          : fallbackBilledCount),
      unbilledCount:
        summaryGroup?.unbilledCount ??
        (normalizedRecords.length > 0
          ? normalizedRecords.filter(
              (record) => String(record?.billing_status ?? '').trim().toLowerCase() !== 'billed'
            ).length
          : fallbackUnbilledCount),
      recapableCount:
        summaryGroup?.recapableCount ??
        (normalizedRecords.length > 0
          ? normalizedRecords.filter(
              (record) =>
                String(record?.billing_status ?? '').trim().toLowerCase() === 'unbilled' &&
                Number(record?.total_pay ?? 0) > 0 &&
                !record?.salary_bill_id
            ).length
          : fallbackRecapableCount),
    }
  }

  const loadGroupDetail = async (kind, group, mode) => {
    if (!currentTeamId || !group) {
      return
    }

    const requestId = ++loadRequestIdRef.current
    const detailMode = mode ?? 'detail'

    setSheetState({
      kind,
      mode: 'loading',
      group: null,
    })

    try {
      const nextGroup = await fetchAttendanceHistoryFromApi({
        teamId: currentTeamId,
        month: selectedMonth,
        workerId: kind === 'worker' ? group.workerId ?? '' : '',
        workerName: kind === 'worker' ? group.workerName ?? '' : '',
        date: kind === 'daily' ? group.dateKey ?? '' : '',
      })

      if (requestId !== loadRequestIdRef.current) {
        return
      }

      setSheetState({
        kind,
        mode: detailMode,
        group: hydrateAttendanceGroup(kind, group, nextGroup),
      })
    } catch (loadError) {
      if (requestId !== loadRequestIdRef.current) {
        return
      }

      closeSheet()
      showToast({
        tone: 'error',
        title: 'Gagal memuat detail',
        message: loadError instanceof Error ? loadError.message : 'Gagal memuat detail.',
      })
    }
  }

  const handleConfirmRecap = async () => {
    if (!sheetState.group) {
      return
    }

    const nextContext = buildRecapContext(sheetState.kind, sheetState.group)

    setIsRecapSubmitting(true)

    try {
      await onRequestRecap?.(nextContext)
      closeSheet()
    } catch (confirmError) {
      showToast({
        tone: 'error',
        title: 'Rekap gagal',
        message: confirmError instanceof Error ? confirmError.message : 'Rekap gagal.',
      })
    } finally {
      setIsRecapSubmitting(false)
    }
  }

  const handleEditRecord = (record) => {
    if (
      !record?.id ||
      String(record?.billing_status ?? '').trim().toLowerCase() === 'billed' ||
      Boolean(record?.salary_bill_id)
    ) {
      return
    }

    closeSheet()
    navigate(`/edit/attendance/${record.id}`, {
      state: {
        item: record,
        returnTo: '/payroll?tab=worker',
      },
    })
  }

  const handleSelectAction = (kind, group, actionId) => {
    if (!group) {
      return
    }

    if (actionId === 'pay') {
      try {
        onRequestPay?.(group)
      } catch (payError) {
        showToast({
          tone: 'error',
          title: 'Tagihan pekerja tidak tersedia',
          message: payError instanceof Error ? payError.message : 'Gagal membuka pembayaran.',
        })
      }
      return
    }

    if (actionId === 'recap') {
      void loadGroupDetail(kind, group, 'recap-confirm')
      return
    }

    if (actionId === 'edit') {
      void loadGroupDetail('daily', group, 'daily-edit')
      return
    }

    if (actionId === 'detail') {
      if (kind === 'worker') {
        const workerKey = encodeURIComponent(group.workerId ?? group.workerName ?? '')

        navigate(`/payroll/worker/${workerKey}?month=${selectedMonth}&workerName=${encodeURIComponent(group.workerName ?? '')}`, {
          state: {
            workerId: group.workerId ?? null,
            workerName: group.workerName ?? null,
            month: selectedMonth,
            returnTo: '/payroll?tab=worker',
          },
        })

        return
      }

      void loadGroupDetail(kind, group, 'detail')
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-[24px] bg-[var(--app-surface-low-color)] p-1">
        <AppButton
          fullWidth
          onClick={() => handleTabChange('daily')}
          size="sm"
          type="button"
          variant={activeTab === 'daily' ? 'primary' : 'secondary'}
        >
          Harian
        </AppButton>
        <AppButton
          fullWidth
          onClick={() => handleTabChange('worker')}
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
          {activeGroups.map((group) => {
            const paymentTarget =
              activeTab === 'worker' && typeof resolveWorkerPaymentTarget === 'function'
                ? resolveWorkerPaymentTarget(group)
                : null

            return (
              <AttendanceSummaryRow
                key={group.dateKey ?? group.workerId ?? group.workerName}
                icon={activeTab === 'daily' ? CalendarDays : UserRound}
                title={group.title}
                description={group.description}
                actions={getActionConfig(activeTab, group, paymentTarget).map((action) => ({
                  id: action.id,
                  label: action.label,
                  icon: createElement(action.icon, { className: 'h-4 w-4' }),
                  onClick: () => handleSelectAction(activeTab, group, action.id),
                }))}
                onOpenActions={handleOpenActionMenu}
              />
            )
          })}
        </div>
      ) : (
        <AppCardDashed className="px-4 py-5 text-sm text-[var(--app-hint-color)]">
          Tidak ada data.
        </AppCardDashed>
      )}

      <ActionCardSheet
        open={Boolean(activeActionCard)}
        onClose={handleCloseActionMenu}
        title={activeActionCard?.title ?? (activeTab === 'daily' ? 'Aksi Harian' : 'Aksi Pekerja')}
        description={activeActionCard?.description ?? null}
        actions={activeActionCard?.actions ?? []}
      />

      <AppSheet
        open={sheetState.mode === 'loading'}
        onClose={closeSheet}
        title={sheetState.kind === 'daily' ? 'Memuat Detail Harian' : 'Memuat Detail Pekerja'}
      >
        <div className="flex items-center gap-3 text-sm text-[var(--app-hint-color)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Memuat detail ringkasan...</span>
        </div>
      </AppSheet>

      <AppSheet
        open={sheetState.mode === 'recap-confirm'}
        onClose={closeSheet}
        title={sheetState.kind === 'daily' ? 'Konfirmasi Rekap Harian' : 'Konfirmasi Rekap Pekerja'}
      >
        {activeRecapGroup ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {sheetState.kind === 'daily' ? (
                <>
                  <DetailSummaryCard label="Hari" value={activeRecapGroup.title} />
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
                    value={String(activeRecapGroup.billedCount ?? 0)}
                  />
                </>
              ) : (
                <>
                  <DetailSummaryCard label="Pekerja" value={activeRecapGroup.workerName} />
                  <DetailSummaryCard label="Dari" value={formatAppDateLabel(activeRecapGroup.firstDate)} />
                  <DetailSummaryCard label="Sampai" value={formatAppDateLabel(activeRecapGroup.lastDate)} />
                  <DetailSummaryCard
                    label="Record"
                    value={String(selectedRecapContext?.recapRecordCount ?? 0)}
                  />
                </>
              )}
            </div>

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
        {activeDetailGroup ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {sheetState.kind === 'daily' ? (
                <>
                  <DetailSummaryCard label="Hari" value={activeDetailGroup.title} />
                  <DetailSummaryCard label="Record" value={String(activeDetailRecords.length)} />
                  <DetailSummaryCard
                    label="Billed"
                    value={String(activeDetailGroup.billedCount ?? 0)}
                  />
                  <DetailSummaryCard
                    label="Unbilled"
                    value={String(activeDetailGroup.unbilledCount ?? 0)}
                  />
                </>
              ) : (
                <>
                  <DetailSummaryCard label="Pekerja" value={activeDetailGroup.workerName} />
                  <DetailSummaryCard label="Record" value={String(activeDetailRecords.length)} />
                  <DetailSummaryCard
                    label="Billed"
                    value={String(activeDetailGroup.billedCount ?? 0)}
                  />
                  <DetailSummaryCard
                    label="Unbilled"
                    value={String(activeDetailGroup.unbilledCount ?? 0)}
                  />
                </>
              )}
            </div>

            {sheetState.kind === 'worker' && activeDetailGroup.firstDate && activeDetailGroup.lastDate ? (
              <div className="grid grid-cols-2 gap-2">
                <DetailSummaryCard label="Dari" value={formatAppDateLabel(activeDetailGroup.firstDate)} />
                <DetailSummaryCard label="Sampai" value={formatAppDateLabel(activeDetailGroup.lastDate)} />
              </div>
            ) : null}

            <AttendanceDetailList
              group={activeDetailGroup}
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
