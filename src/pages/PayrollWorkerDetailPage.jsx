import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, History, Info, Loader2, ReceiptText } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import BrandLoader from '../components/ui/BrandLoader'
import {
  AppCardDashed,
  AppCardStrong,
  AppToggleGroup,
  PageHeader,
  PageShell,
} from '../components/ui/AppPrimitives'
import { formatAppDateLabel, getAppTodayKey } from '../lib/date-time'
import {
  fetchAttendanceHistoryFromApi,
  fetchBillByIdFromApi,
  fetchDeletedBillPaymentsFromApi,
} from '../lib/records-api'
import {
  formatCurrency,
  formatPayrollSettlementLabel,
  getPayrollBillGroupHistoryRows,
  getPayrollBillGroupSummary,
} from '../lib/transaction-presentation'
import useAuthStore from '../store/useAuthStore'
import useMasterStore from '../store/useMasterStore'
import useToastStore from '../store/useToastStore'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function safeDecodeURIComponent(value) {
  const normalizedValue = normalizeText(value, '')

  if (!normalizedValue) {
    return ''
  }

  try {
    return decodeURIComponent(normalizedValue)
  } catch {
    return normalizedValue
  }
}

function formatMonthLabel(monthKey) {
  const normalizedMonthKey = normalizeText(monthKey, '')

  if (!normalizedMonthKey) {
    return 'Periode belum tersedia'
  }

  const parsedDate = new Date(`${normalizedMonthKey}-01T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedMonthKey
  }

  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(parsedDate)
}

const compactCurrencyFormatter = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
})

function formatCompactCurrency(value) {
  const numericValue = Number(value)
  const normalizedValue = Number.isFinite(numericValue) ? numericValue : 0
  const formattedValue = compactCurrencyFormatter.format(Math.abs(normalizedValue))

  return `${normalizedValue < 0 ? '-' : ''}Rp ${formattedValue}`
}

function formatProjectStatusLabel(project) {
  if (!project) {
    return '-'
  }

  if (typeof project.is_active === 'boolean') {
    return project.is_active ? 'Aktif' : 'Nonaktif'
  }

  return normalizeText(project.status, 'Aktif')
}

function formatAttendanceStatusLabel(status) {
  const normalizedStatus = normalizeText(status, '').toLowerCase()

  if (normalizedStatus === 'full_day') {
    return 'Full Day'
  }

  if (normalizedStatus === 'half_day') {
    return 'Half Day'
  }

  if (normalizedStatus === 'overtime') {
    return 'Lembur'
  }

  if (normalizedStatus === 'absent') {
    return 'Tidak Hadir'
  }

  return '-'
}

function formatBillingStatusLabel(status) {
  const normalizedStatus = normalizeText(status, '').toLowerCase()

  if (normalizedStatus === 'billed') {
    return 'Billed'
  }

  return 'Unbilled'
}

function getWorkerProjectRate(workerId, projectId, workerWageRates = []) {
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

function DetailMetric({ label, value }) {
  return (
    <div className="rounded-[20px] border border-[var(--app-border-color)] bg-[var(--app-surface-low-color)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">{value}</p>
    </div>
  )
}

function PayrollWorkerDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { workerId: routeWorkerKey = '' } = useParams()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const projects = useMasterStore((state) => state.projects)
  const workers = useMasterStore((state) => state.workers)
  const workerWageRates = useMasterStore((state) => state.workerWageRates)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const showToast = useToastStore((state) => state.showToast)
  const [activeTab, setActiveTab] = useState('info')
  const [attendanceRows, setAttendanceRows] = useState([])
  const [billDetailsById, setBillDetailsById] = useState({})
  const [deletedBillPayments, setDeletedBillPayments] = useState([])
  const [isLoadingRows, setIsLoadingRows] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const selectedMonth = normalizeText(
    searchParams.get('month') ?? location.state?.month ?? '',
    getAppTodayKey().slice(0, 7)
  )
  const routeWorkerKeyDecoded = safeDecodeURIComponent(routeWorkerKey)
  const fallbackWorkerName = normalizeText(
    searchParams.get('workerName') ?? location.state?.workerName ?? routeWorkerKeyDecoded,
    ''
  )
  const returnTo = normalizeText(location.state?.returnTo, '/payroll?tab=worker')

  useEffect(() => {
    void fetchMasters({ force: true }).catch((error) => {
      console.error('Gagal memuat master detail pekerja payroll:', error)
    })
  }, [fetchMasters])

  useEffect(() => {
    if (!currentTeamId) {
      setAttendanceRows([])
      setBillDetailsById({})
      setDeletedBillPayments([])
      setIsLoadingRows(false)
      setIsLoadingHistory(false)
      setLoadError(null)
      return
    }

    let isActive = true
    setIsLoadingRows(true)
    setLoadError(null)
    setAttendanceRows([])
    setBillDetailsById({})
    setDeletedBillPayments([])

    async function loadWorkerDetail() {
      try {
        let nextRows = await fetchAttendanceHistoryFromApi({
          teamId: currentTeamId,
          month: selectedMonth,
          workerId: routeWorkerKeyDecoded,
        })

        if (nextRows.length === 0 && fallbackWorkerName) {
          nextRows = await fetchAttendanceHistoryFromApi({
            teamId: currentTeamId,
            month: selectedMonth,
            workerName: fallbackWorkerName,
          })
        }

        if (!isActive) {
          return
        }

        setAttendanceRows(Array.isArray(nextRows) ? nextRows : [])
      } catch (error) {
        if (!isActive) {
          return
        }

        setAttendanceRows([])
        setLoadError(error instanceof Error ? error.message : 'Gagal memuat detail pekerja.')
      } finally {
        if (isActive) {
          setIsLoadingRows(false)
        }
      }
    }

    void loadWorkerDetail()

    return () => {
      isActive = false
    }
  }, [currentTeamId, fallbackWorkerName, routeWorkerKeyDecoded, selectedMonth])

  const orderedAttendanceRows = useMemo(() => {
    return [...attendanceRows].sort((left, right) =>
      String(right?.attendance_date ?? '').localeCompare(String(left?.attendance_date ?? ''))
    )
  }, [attendanceRows])

  const selectedWorkerRecord = useMemo(() => {
    const routeKeyLower = routeWorkerKeyDecoded.toLowerCase()
    const fallbackNameLower = fallbackWorkerName.toLowerCase()

    return (
      workers.find((worker) => normalizeText(worker.id, '').toLowerCase() === routeKeyLower) ??
      workers.find((worker) => normalizeText(worker.name, '').toLowerCase() === fallbackNameLower) ??
      null
    )
  }, [fallbackWorkerName, routeWorkerKeyDecoded, workers])

  const workerIdForRate = useMemo(() => {
    return (
      orderedAttendanceRows.find((row) => normalizeText(row.worker_id, ''))?.worker_id ??
      selectedWorkerRecord?.id ??
      routeWorkerKeyDecoded ??
      ''
    )
  }, [orderedAttendanceRows, routeWorkerKeyDecoded, selectedWorkerRecord?.id])

  const workerNameLabel = useMemo(() => {
    return (
      normalizeText(orderedAttendanceRows[0]?.worker_name_snapshot, '') ||
      normalizeText(orderedAttendanceRows[0]?.worker_name, '') ||
      normalizeText(selectedWorkerRecord?.name, '') ||
      fallbackWorkerName ||
      routeWorkerKeyDecoded ||
      'Pekerja'
    )
  }, [
    fallbackWorkerName,
    orderedAttendanceRows,
    routeWorkerKeyDecoded,
    selectedWorkerRecord?.name,
  ])

  const primaryProjectId = orderedAttendanceRows[0]?.project_id ?? null
  const primaryProject =
    projects.find((project) => project.id === primaryProjectId) ?? null
  const workerRate = useMemo(
    () => getWorkerProjectRate(workerIdForRate, primaryProjectId, workerWageRates),
    [primaryProjectId, workerIdForRate, workerWageRates]
  )

  const selectedBillIds = useMemo(() => {
    return [
      ...new Set(
        orderedAttendanceRows
          .map((row) => normalizeText(row.salary_bill_id ?? row.salary_bill?.id, null))
          .filter(Boolean)
      ),
    ]
  }, [orderedAttendanceRows])

  useEffect(() => {
    if (!currentTeamId || orderedAttendanceRows.length === 0 || selectedBillIds.length === 0) {
      setBillDetailsById({})
      setDeletedBillPayments([])
      setIsLoadingHistory(false)
      return
    }

    let isActive = true
    setIsLoadingHistory(true)

    async function loadHistory() {
      try {
        const billEntries = await Promise.all(
          selectedBillIds.map(async (billId) => {
            try {
              const bill = await fetchBillByIdFromApi(billId)

              return bill ? [billId, bill] : null
            } catch (error) {
              console.error('Gagal memuat detail bill gaji pekerja:', error)
              return null
            }
          })
        )

        const nextBillDetailsById = billEntries.reduce((accumulator, entry) => {
          if (entry?.[0] && entry?.[1]) {
            accumulator[entry[0]] = entry[1]
          }

          return accumulator
        }, {})

        const nextDeletedBillPayments = await fetchDeletedBillPaymentsFromApi(currentTeamId)

        if (!isActive) {
          return
        }

        setBillDetailsById(nextBillDetailsById)
        setDeletedBillPayments(Array.isArray(nextDeletedBillPayments) ? nextDeletedBillPayments : [])
      } catch (error) {
        if (!isActive) {
          return
        }

        console.error('Gagal memuat history pembayaran pekerja:', error)
        setDeletedBillPayments([])
        showToast({
          tone: 'error',
          title: 'History pembayaran gagal dimuat',
          message: error instanceof Error ? error.message : 'Gagal memuat history pembayaran.',
        })
      } finally {
        if (isActive) {
          setIsLoadingHistory(false)
        }
      }
    }

    void loadHistory()

    return () => {
      isActive = false
    }
  }, [currentTeamId, orderedAttendanceRows, selectedBillIds, showToast])

  const selectedBills = useMemo(() => {
    return selectedBillIds
      .map((billId) => {
        const fallbackRow =
          orderedAttendanceRows.find(
            (row) => normalizeText(row.salary_bill_id ?? row.salary_bill?.id, null) === billId
          ) ?? null
        const fallbackBill =
          fallbackRow?.salary_bill ??
          (fallbackRow
            ? {
                id: billId,
                billType: 'gaji',
                status: normalizeText(fallbackRow.billing_status, 'unpaid'),
                description: normalizeText(
                  fallbackRow.salary_bill?.description ?? fallbackRow.worker_name_snapshot,
                  workerNameLabel
                ),
                worker_name_snapshot: fallbackRow.worker_name_snapshot ?? workerNameLabel,
                workerId: fallbackRow.worker_id ?? workerIdForRate,
                payments: [],
              }
            : null)

        return billDetailsById[billId] ?? fallbackBill
      })
      .filter(Boolean)
  }, [billDetailsById, orderedAttendanceRows, selectedBillIds, workerIdForRate, workerNameLabel])

  const historyRows = useMemo(() => {
    return getPayrollBillGroupHistoryRows(selectedBills, deletedBillPayments)
  }, [deletedBillPayments, selectedBills])

  useEffect(() => {
    if (activeTab === 'history' && historyRows.length === 0) {
      setActiveTab('info')
    }
  }, [activeTab, historyRows.length])

  useEffect(() => {
    setActiveTab('info')
  }, [routeWorkerKeyDecoded, selectedMonth])

  const attendanceSummary = useMemo(() => {
    const billedAmount = orderedAttendanceRows.reduce((total, row) => {
      if (normalizeText(row.billing_status, '').toLowerCase() !== 'billed') {
        return total
      }

      return total + Number(row.total_pay ?? 0)
    }, 0)
    const totalPay = orderedAttendanceRows.reduce(
      (total, row) => total + Number(row.total_pay ?? 0),
      0
    )
    const unbilledAmount = Math.max(totalPay - billedAmount, 0)
    const billedCount = orderedAttendanceRows.filter(
      (row) => normalizeText(row.billing_status, '').toLowerCase() === 'billed'
    ).length
    const unbilledCount = orderedAttendanceRows.length - billedCount
    const recapableCount = orderedAttendanceRows.filter(
      (row) =>
        normalizeText(row.billing_status, '').toLowerCase() === 'unbilled' &&
        Number(row.total_pay ?? 0) > 0 &&
        !row.salary_bill_id
    ).length
    const projectCount = new Set(
      orderedAttendanceRows.map((row) => normalizeText(row.project_id, null)).filter(Boolean)
    ).size
    const firstDate = orderedAttendanceRows.at(-1)?.attendance_date ?? null
    const lastDate = orderedAttendanceRows[0]?.attendance_date ?? null

    return {
      billedAmount,
      billedCount,
      unbilledAmount,
      unbilledCount,
      recapableCount,
      totalPay,
      projectCount,
      firstDate,
      lastDate,
      recordCount: orderedAttendanceRows.length,
      historyCount: historyRows.length,
      linkedBillCount: selectedBillIds.length,
    }
  }, [historyRows.length, orderedAttendanceRows, selectedBillIds.length])

  const billSummary = useMemo(() => {
    return getPayrollBillGroupSummary({
      bills: selectedBills,
      unbilledAmount: attendanceSummary.unbilledAmount,
    })
  }, [attendanceSummary.unbilledAmount, selectedBills])

  const summary = attendanceSummary

  const tabOptions = useMemo(
    () =>
      [
        { value: 'info', label: 'Info', icon: Info },
        { value: 'rekap', label: 'Rekap', icon: CalendarRange },
        historyRows.length > 0 ? { value: 'history', label: 'Riwayat', icon: History } : null,
      ].filter(Boolean),
    [historyRows.length]
  )

  const currentProjectStatusLabel = formatProjectStatusLabel(primaryProject)
  const currentRoleLabel = normalizeText(
    workerRate?.role_name ?? selectedWorkerRecord?.default_role_name ?? '',
    'Pekerja'
  )
  const currentRateAmount = Number(workerRate?.wage_amount ?? 0)
  const pageDescription = `${formatMonthLabel(selectedMonth)} · ${summary.recordCount} record`

  const handleBack = () => {
    navigate(returnTo)
  }

  const renderInfoTab = () => (
    <div className="space-y-3">
      <AppCardStrong className="space-y-3 border-[var(--app-tone-info-border)] bg-[var(--app-tone-info-bg)] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-tone-info-text)]">
              Tercatat
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--app-hint-color)]">
              Nominal total estimasi upah
            </p>
          </div>
          <p className="shrink-0 text-right text-lg font-semibold text-[var(--app-tone-info-text)]">
            {formatCurrency(summary.totalPay)}
          </p>
        </div>
      </AppCardStrong>

      <div className="grid grid-cols-2 gap-2">
        <DetailMetric label="Billed" value={formatCompactCurrency(summary.billedAmount)} />
        <DetailMetric label="Unbilled" value={formatCompactCurrency(summary.unbilledAmount)} />
      </div>

      <AppCardStrong className="flex items-start justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
            Tagihan
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--app-hint-color)]">
            Tagihan belum terbayar
          </p>
        </div>
        <p className="shrink-0 text-right text-sm font-semibold text-[var(--app-text-color)]">
          {formatCurrency(billSummary.remainingAmount)}
        </p>
      </AppCardStrong>

      <AppCardStrong className="flex items-start justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
            Sisa
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--app-hint-color)]">
            Sisa record belum billed
          </p>
        </div>
        <p className="shrink-0 text-right text-sm font-semibold text-[var(--app-text-color)]">
          {formatCompactCurrency(summary.unbilledAmount)}
        </p>
      </AppCardStrong>

      <div className="grid grid-cols-2 gap-2">
        <DetailMetric label="Peran" value={currentRoleLabel} />
        <DetailMetric label="Periode" value={formatMonthLabel(selectedMonth)} />
        <DetailMetric label="Upah" value={formatCurrency(currentRateAmount)} />
        <DetailMetric label="Rekap" value={`${summary.recapableCount} item`} />
        <DetailMetric label="Riwayat" value={`${summary.historyCount} item`} />
        <DetailMetric label="Bill" value={`${summary.linkedBillCount} item`} />
        <DetailMetric label="Proyek" value={normalizeText(primaryProject?.name, '-')} />
        <DetailMetric label="Status" value={currentProjectStatusLabel} />
        <DetailMetric label="Dari" value={formatAppDateLabel(summary.firstDate)} />
        <DetailMetric label="Sampai" value={formatAppDateLabel(summary.lastDate)} />
        <DetailMetric label="Route" value={routeWorkerKeyDecoded || '-'} />
      </div>
    </div>
  )

  const renderRekapTab = () => {
    if (orderedAttendanceRows.length === 0) {
      return (
        <AppCardDashed className="px-4 py-5 text-sm text-[var(--app-hint-color)]">
          Belum ada baris rekap untuk pekerja ini.
        </AppCardDashed>
      )
    }

    return (
      <div className="space-y-2">
        {orderedAttendanceRows.map((row) => {
          const project = projects.find((item) => item.id === row.project_id) ?? null
          const projectStatusLabel = formatProjectStatusLabel(project)
          const rowWorkerId = normalizeText(row.worker_id, workerIdForRate)
          const rowRate = getWorkerProjectRate(rowWorkerId, row.project_id, workerWageRates)
          const rowRoleLabel = normalizeText(
            rowRate?.role_name ?? row.salary_bill?.description ?? currentRoleLabel,
            'Pekerja'
          )
          const salaryBillLabel = normalizeText(row.salary_bill?.description, row.salary_bill_id ?? '-')

          return (
            <details
              key={row.id}
              className="group rounded-[20px] border border-[var(--app-border-color)] bg-[var(--app-surface-low-color)]"
            >
              <summary className="flex list-none items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                    {formatAppDateLabel(row.attendance_date)}
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-[var(--app-hint-color)]">
                    {normalizeText(project?.name, row.project_name_snapshot ?? 'Proyek')} ·{' '}
                    {projectStatusLabel} · {rowRoleLabel}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  <p className="text-sm font-semibold text-[var(--app-text-color)]">
                    {formatCurrency(row.total_pay)}
                  </p>
                  <p className="text-xs text-[var(--app-hint-color)]">
                    {formatBillingStatusLabel(row.billing_status)}
                  </p>
                </div>
              </summary>

              <div className="space-y-2 px-4 pb-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <DetailMetric
                    label="Status Absensi"
                    value={formatAttendanceStatusLabel(row.attendance_status)}
                  />
                  <DetailMetric label="Status Proyek" value={projectStatusLabel} />
                  <DetailMetric label="Wage Role" value={rowRoleLabel} />
                  <DetailMetric label="Billing" value={formatBillingStatusLabel(row.billing_status)} />
                  <DetailMetric label="Tagihan Upah" value={salaryBillLabel} />
                  <DetailMetric label="Nominal" value={formatCurrency(row.total_pay)} />
                </div>

                <AppCardStrong className="space-y-1 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    Catatan
                  </p>
                  <p className="text-sm leading-6 text-[var(--app-text-color)]">
                    {normalizeText(row.notes, 'Tidak ada catatan.')}
                  </p>
                </AppCardStrong>
              </div>
            </details>
          )
        })}
      </div>
    )
  }

  const renderHistoryTab = () => {
    if (isLoadingHistory) {
      return (
        <AppCardDashed className="flex items-center gap-3 px-4 py-5 text-sm text-[var(--app-hint-color)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Memuat riwayat pembayaran.</span>
        </AppCardDashed>
      )
    }

    if (historyRows.length === 0) {
      return (
        <AppCardDashed className="px-4 py-5 text-sm text-[var(--app-hint-color)]">
          Belum ada riwayat pembayaran untuk pekerja ini.
        </AppCardDashed>
      )
    }

    return (
      <div className="space-y-2">
        {historyRows.map((entry) => (
          <AppCardStrong
            key={entry.id}
            className={`px-4 py-4 ${entry.isDeleted ? 'border-[var(--app-destructive-color)]/40' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  entry.isDeleted
                    ? 'bg-[var(--app-tone-danger-bg)] text-[var(--app-tone-danger-text)]'
                    : 'bg-[var(--app-tone-neutral-bg)] text-[var(--app-tone-neutral-text)]'
                }`}
              >
                <ReceiptText className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  {formatCurrency(entry.amount)}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                  {formatAppDateLabel(entry.paymentDate)}
                  {' · '}
                  {entry.billLabel}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                  {entry.workerLabel}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                  {normalizeText(entry.notes, 'Tanpa catatan')}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <p className="text-xs font-semibold text-[var(--app-hint-color)]">
                  {entry.isDeleted ? 'Terhapus' : formatPayrollSettlementLabel(entry.bill?.status)}
                </p>
                {entry.bill?.dueDate ? (
                  <p className="text-xs text-[var(--app-hint-color)]">
                    Jatuh tempo {formatAppDateLabel(entry.bill.dueDate)}
                  </p>
                ) : null}
              </div>
            </div>
          </AppCardStrong>
        ))}
      </div>
    )
  }

  if (isLoadingRows && !loadError) {
    return (
      <PageShell className="space-y-4">
        <PageHeader
          backAction={handleBack}
          description={pageDescription}
          eyebrow="Detail Pekerja"
          title={workerNameLabel}
        />

        <section className="grid min-h-[calc(100dvh-16rem)] place-items-center px-4 text-center">
          <div className="flex flex-col items-center gap-5">
            <BrandLoader context="server" size="hero" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--app-text-color)]">
                Memuat detail pekerja
              </h2>
              <p className="max-w-[20rem] text-sm leading-6 text-[var(--app-hint-color)]">
                Menyiapkan absensi dan riwayat pembayaran.
              </p>
            </div>
          </div>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        backAction={handleBack}
        description={pageDescription}
        eyebrow="Detail Pekerja"
        title={workerNameLabel}
      />

      <AppToggleGroup
        buttonSize="sm"
        onChange={setActiveTab}
        options={tabOptions}
        value={activeTab}
      />

      {loadError ? (
        <AppCardDashed className="app-tone-danger text-sm leading-6 text-rose-700">
          {loadError}
        </AppCardDashed>
      ) : null}

      {!isLoadingRows && !loadError ? (
        <>
          {activeTab === 'info' ? renderInfoTab() : null}
          {activeTab === 'rekap' ? renderRekapTab() : null}
          {activeTab === 'history' ? renderHistoryTab() : null}
        </>
      ) : null}
    </PageShell>
  )
}

export default PayrollWorkerDetailPage
