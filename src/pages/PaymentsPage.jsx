import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  ReceiptText,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import BrandLoader from '../components/ui/BrandLoader'
import {
  AppButton,
  AppCardDashed,
  AppCardStrong,
  AppToggleGroup,
  PageHeader,
  PageShell,
} from '../components/ui/AppPrimitives'
import { formatAppDateLabel } from '../lib/date-time'
import {
  formatCurrency,
  getBillSummaryAmount,
  getBillSummarySubtitle,
  getBillSummaryTitle,
  formatPayrollSettlementLabel,
  getPayrollBillGroupHistoryRows,
  getPayrollBillGroupSummary,
  groupBillsByWorker,
  formatTransactionTimestamp,
  getTransactionSourceLabel,
  getTransactionTitle,
} from '../lib/transaction-presentation'
import {
  fetchDeletedBillPaymentsFromApi,
  permanentDeleteBillPaymentFromApi,
  restoreBillPaymentFromApi,
} from '../lib/records-api'
import { savePaymentReceiptPdf } from '../lib/report-pdf'
import useAuthStore from '../store/useAuthStore'
import useBillStore from '../store/useBillStore'
import useDashboardStore from '../store/useDashboardStore'
import useIncomeStore from '../store/useIncomeStore'
import usePaymentStore from '../store/usePaymentStore'
import useToastStore from '../store/useToastStore'

const pembayaranListStateStorageKey = 'banplex:pembayaran-list-state'

function readPembayaranListState(teamId) {
  if (!teamId || typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.sessionStorage.getItem(pembayaranListStateStorageKey)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (parsedValue?.teamId !== teamId) {
      return null
    }

    return parsedValue
  } catch (error) {
    console.error('Gagal membaca state Pembayaran:', error)
    return null
  }
}

function savePembayaranListState(teamId, state) {
  if (!teamId || typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(
      pembayaranListStateStorageKey,
      JSON.stringify({
        teamId,
        ...state,
      })
    )
  } catch (error) {
    console.error('Gagal menyimpan state Pembayaran:', error)
  }
}

function BillRowButton({ bill, onOpenBill }) {
  const amount = getBillSummaryAmount(bill)

  return (
    <button
      className="flex w-full items-center gap-3 rounded-2xl bg-[var(--app-surface-low-color)] px-3 py-3 text-left transition active:bg-[color-mix(in_srgb,var(--app-surface-low-color)_85%,var(--app-bg-color))]"
      onClick={() => onOpenBill(bill.id)}
      type="button"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--app-tone-warning-bg)] text-[var(--app-tone-warning-text)]">
        <FileText className="h-[18px] w-[18px]" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
          {getBillSummaryTitle(bill)}
        </p>
        <p className="mt-0.5 text-xs text-[var(--app-hint-color)]">
          {getBillSummarySubtitle(bill)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold text-[var(--app-text-color)]">
          {formatCurrency(amount)}
        </span>
        <ChevronRight className="h-4 w-4 text-[var(--app-hint-color)]" />
      </div>
    </button>
  )
}

function PayrollMetric({ label, value }) {
  return (
    <div className="rounded-[20px] border border-[var(--app-border-color)] bg-[var(--app-surface-low-color)] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">{value}</p>
    </div>
  )
}

function PayrollBillGroupCard({ group, onOpenDetail }) {
  return (
    <AppCardStrong className="px-4 py-4">
      <button
        className="flex w-full items-center gap-3 text-left"
        onClick={() => onOpenDetail(group.groupKey)}
        type="button"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-low-color)] text-[var(--app-text-color)]">
          <FileText className="h-[18px] w-[18px]" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
            {group.workerName}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            {formatCurrency(group.amount)}
          </span>
          <ChevronRight className="h-4 w-4 text-[var(--app-hint-color)]" />
        </div>
      </button>
    </AppCardStrong>
  )
}

function PayrollGroupDetail({
  activeTab,
  bills,
  group,
  historyRows,
  isLoading,
  isReadOnly,
  onArchivePayment,
  onChangeTab,
  onDownloadReceipt,
  onOpenBill,
  onPermanentDeletePayment,
  onRestorePayment,
  tabOptions: tabOptionsProp = null,
}) {
  const summary = getPayrollBillGroupSummary(group)
  const tabOptions = useMemo(
    () =>
      Array.isArray(tabOptionsProp) && tabOptionsProp.length > 0
        ? tabOptionsProp
        : [
            { value: 'summary', label: 'Summary' },
            { value: 'rekap', label: 'Rekap' },
            { value: 'history', label: 'Riwayat' },
          ],
    [tabOptionsProp]
  )

  useEffect(() => {
    if (!tabOptions.some((option) => option.value === activeTab)) {
      onChangeTab('summary')
    }
  }, [activeTab, onChangeTab, tabOptions])

  return (
    <div className="space-y-3">
      <AppToggleGroup
        buttonSize="sm"
        className="pt-1"
        onChange={onChangeTab}
        options={tabOptions}
        value={activeTab}
      />

      {activeTab === 'summary' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <PayrollMetric label="Nama Worker" value={summary.workerName} />
          <PayrollMetric label="Total Beban" value={formatCurrency(summary.totalAmount)} />
          <PayrollMetric label="Nominal Billed" value={formatCurrency(summary.billedAmount)} />
          <PayrollMetric label="Nominal Unbilled" value={formatCurrency(summary.unbilledAmount)} />
          <PayrollMetric label="Sisa Tagihan" value={formatCurrency(summary.remainingAmount)} />
          <PayrollMetric label="Total Terbayar" value={formatCurrency(summary.paidAmount)} />
          <PayrollMetric label="Jumlah Rekap" value={`${summary.recapCount} item`} />
        </div>
      ) : null}

      {activeTab === 'rekap' ? (
        <div className="space-y-2">
          {bills.map((bill) => (
            <details
              key={bill.id}
              className="group rounded-[20px] border border-[var(--app-border-color)] bg-[var(--app-surface-low-color)]"
            >
              <summary className="flex list-none items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                    {getBillSummaryTitle(bill)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--app-hint-color)]">
                    {getBillSummarySubtitle(bill)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--app-text-color)]">
                    {formatCurrency(getBillSummaryAmount(bill))}
                  </span>
                  <ChevronDown className="h-4 w-4 text-[var(--app-hint-color)] transition group-open:rotate-180" />
                </div>
              </summary>

              <div className="space-y-3 px-4 pb-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <PayrollMetric label="Total Bill" value={formatCurrency(Number(bill.amount ?? 0))} />
                  <PayrollMetric label="Sisa" value={formatCurrency(getBillSummaryAmount(bill))} />
                  <PayrollMetric label="Status" value={formatPayrollSettlementLabel(bill.status)} />
                  <PayrollMetric
                    label="Pembayaran"
                    value={`${Array.isArray(bill.payments) ? bill.payments.length : 0} item`}
                  />
                </div>

                <div className="flex justify-end">
                  <AppButton
                    aria-label="Buka tagihan"
                    className="shrink-0"
                    iconOnly
                    leadingIcon={<ChevronRight className="h-4 w-4" />}
                    onClick={() => onOpenBill(bill.id)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  />
                </div>
              </div>
            </details>
          ))}
        </div>
      ) : null}

      {activeTab === 'history' ? (
        isLoading ? (
          <AppCardDashed className="px-4 py-5">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              Memuat riwayat pembayaran.
            </p>
          </AppCardDashed>
        ) : historyRows.length > 0 ? (
          <div className="space-y-2">
            {historyRows.map((entry) => {
              const isDeleted = entry.isDeleted

              return (
                <AppCardStrong
                  key={entry.id}
                  className={`px-4 py-4 ${isDeleted ? 'border-[var(--app-destructive-color)]/40' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                        isDeleted
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
                        {entry.notes || 'Tanpa catatan'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                        {entry.billLabel}
                      </p>
                    </div>

                    {isReadOnly ? null : (
                      <div className="flex shrink-0 items-center gap-1">
                        <AppButton
                          aria-label="Unduh kwitansi"
                          iconOnly
                          leadingIcon={<ReceiptText className="h-4 w-4" />}
                          onClick={() => onDownloadReceipt(entry)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        />
                        {isDeleted ? (
                          <>
                            <AppButton
                              aria-label="Pulihkan pembayaran"
                              iconOnly
                              leadingIcon={<RotateCcw className="h-4 w-4" />}
                              onClick={() => onRestorePayment(entry)}
                              size="sm"
                              type="button"
                              variant="secondary"
                            />
                            <AppButton
                              aria-label="Hapus permanen pembayaran"
                              iconOnly
                              leadingIcon={<Trash2 className="h-4 w-4" />}
                              onClick={() => onPermanentDeletePayment(entry)}
                              size="sm"
                              type="button"
                              variant="danger"
                            />
                          </>
                        ) : (
                          <AppButton
                            aria-label="Arsipkan pembayaran"
                            iconOnly
                            leadingIcon={<Trash2 className="h-4 w-4" />}
                            onClick={() => onArchivePayment(entry)}
                            size="sm"
                            type="button"
                            variant="danger"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </AppCardStrong>
              )
            })}
          </div>
        ) : (
          <AppCardDashed className="px-4 py-5">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  Belum ada riwayat pembayaran aktif.
            </p>
          </AppCardDashed>
        )
      ) : null}
    </div>
  )
}

function PaymentsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const restoredPembayaranState = useMemo(
    () => readPembayaranListState(currentTeamId),
    [currentTeamId]
  )
  const savedScrollPositionRef = useRef(Number(restoredPembayaranState?.scrollY ?? 0))
  const workspaceTransactions = useDashboardStore((state) => state.workspaceTransactions)
  const fetchWorkspaceTransactions = useDashboardStore(
    (state) => state.fetchWorkspaceTransactions
  )
  const bills = useBillStore((state) => state.bills)
  const isBillsLoading = useBillStore((state) => state.isLoading)
  const billsError = useBillStore((state) => state.error)
  const fetchUnpaidBills = useBillStore((state) => state.fetchUnpaidBills)
  const loans = useIncomeStore((state) => state.loans)
  const isLoansLoading = useIncomeStore((state) => state.isLoadingLoans)
  const loansError = useIncomeStore((state) => state.error)
  const fetchLoans = useIncomeStore((state) => state.fetchLoans)
  const workspaceError = useDashboardStore((state) => state.workspaceError)
  const isWorkspaceLoading = useDashboardStore((state) => state.isWorkspaceLoading)
  const fetchBillById = useBillStore((state) => state.fetchBillById)
  const deleteBillPayment = usePaymentStore((state) => state.deleteBillPayment)
  const showToast = useToastStore((state) => state.showToast)
  const currentRole = useAuthStore((state) => state.role)
  const isReadOnly = currentRole === 'Viewer' || currentRole === 'Payroll'
  const [activeGroupTab, setActiveGroupTab] = useState('summary')
  const [billDetailById, setBillDetailById] = useState({})
  const [deletedBillPayments, setDeletedBillPayments] = useState([])
  const [deletedBillPaymentsTeamId, setDeletedBillPaymentsTeamId] = useState(null)
  const [isGroupLoading, setIsGroupLoading] = useState(false)
  const didInitTeamRef = useRef(false)
  const [groupRevision, setGroupRevision] = useState(0)
  const selectedGroupKey = useMemo(() => {
    return new URLSearchParams(location.search).get('group')?.trim() ?? ''
  }, [location.search])
  const isWorkerDetailMode = Boolean(selectedGroupKey)
  const detailReturnTo = useMemo(() => {
    const returnTo = location.state?.returnTo

    return typeof returnTo === 'string' && returnTo.trim() ? returnTo.trim() : '/pembayaran'
  }, [location.state])

  const refreshPayments = useCallback(async () => {
    if (!currentTeamId) {
      return
    }

    await Promise.all([
      fetchWorkspaceTransactions(currentTeamId, { silent: true }),
      fetchUnpaidBills({ teamId: currentTeamId, silent: true }),
      fetchLoans({ teamId: currentTeamId }),
    ])
  }, [currentTeamId, fetchLoans, fetchUnpaidBills, fetchWorkspaceTransactions])

  useEffect(() => {
    void refreshPayments()
  }, [refreshPayments])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (!didInitTeamRef.current) {
      didInitTeamRef.current = true
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      setActiveGroupTab('summary')
      setBillDetailById({})
      setDeletedBillPayments([])
      setDeletedBillPaymentsTeamId(null)
      setIsGroupLoading(false)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [currentTeamId])

  const paymentHistoryRows = useMemo(() => {
    return workspaceTransactions
      .filter((transaction) =>
        ['bill-payment', 'loan-payment'].includes(String(transaction?.sourceType ?? ''))
      )
      .slice()
      .sort((left, right) => {
        const rightTimestamp = new Date(
          String(right.transaction_date ?? right.created_at ?? '')
        ).getTime()
        const leftTimestamp = new Date(
          String(left.transaction_date ?? left.created_at ?? '')
        ).getTime()

        return rightTimestamp - leftTimestamp
      })
      .slice(0, 10)
  }, [workspaceTransactions])

  const sortedBills = useMemo(() => {
    return [...bills].sort((left, right) => {
      const rightTimestamp = new Date(String(right.dueDate ?? right.created_at ?? '')).getTime()
      const leftTimestamp = new Date(String(left.dueDate ?? left.created_at ?? '')).getTime()

      return leftTimestamp - rightTimestamp
    })
  }, [bills])

  const displayBills = useMemo(() => {
    return groupBillsByWorker(sortedBills)
  }, [sortedBills])

  const selectedGroup = useMemo(() => {
    return displayBills.find(
      (item) => item.kind === 'worker-group' && item.groupKey === selectedGroupKey
    ) ?? null
  }, [displayBills, selectedGroupKey])

  const selectedGroupBills = useMemo(() => {
    if (!selectedGroup) {
      return []
    }

    return selectedGroup.bills.map((bill) => billDetailById[String(bill.id ?? '')] ?? bill)
  }, [billDetailById, selectedGroup])

  const selectedGroupHistoryRows = useMemo(() => {
    if (!selectedGroup) {
      return []
    }

    return getPayrollBillGroupHistoryRows(selectedGroupBills, deletedBillPayments)
  }, [deletedBillPayments, selectedGroup, selectedGroupBills])

  const selectedGroupTabOptions = useMemo(() => {
    if (!selectedGroup) {
      return []
    }

    const options = [
      { value: 'summary', label: 'Summary' },
      { value: 'rekap', label: 'Rekap' },
      { value: 'history', label: 'Riwayat' },
    ]

    return options
  }, [selectedGroup])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setActiveGroupTab('summary')
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [selectedGroupKey])

  useEffect(() => {
    if (!currentTeamId || !selectedGroup) {
      return
    }

    let cancelled = false

    const loadGroupDetail = async () => {
      setIsGroupLoading(true)

      const billIds = selectedGroup.bills
        .map((bill) => String(bill.id ?? '').trim())
        .filter(Boolean)
      const missingBillIds = billIds.filter((billId) => !billDetailById[billId])

      if (missingBillIds.length > 0) {
        const nextDetails = await Promise.all(
          missingBillIds.map(async (billId) => {
            try {
              return await fetchBillById(billId)
            } catch (error) {
              console.error('Gagal memuat detail tagihan upah:', error)
              return null
            }
          })
        )

        if (cancelled) {
          return
        }

        setBillDetailById((currentValue) => {
          const nextValue = { ...currentValue }

          nextDetails.forEach((billDetail) => {
            if (billDetail?.id) {
              nextValue[String(billDetail.id)] = billDetail
            }
          })

          return nextValue
        })
      }

      if (deletedBillPaymentsTeamId !== currentTeamId) {
        try {
          const nextDeletedPayments = await fetchDeletedBillPaymentsFromApi(currentTeamId)

          if (!cancelled) {
            setDeletedBillPayments(nextDeletedPayments)
            setDeletedBillPaymentsTeamId(currentTeamId)
          }
        } catch (error) {
          console.error('Gagal memuat history pembayaran terhapus:', error)
          if (!cancelled) {
            setDeletedBillPayments([])
            setDeletedBillPaymentsTeamId(currentTeamId)
          }
        }
      }

      if (!cancelled) {
        setIsGroupLoading(false)
      }
    }

    void loadGroupDetail()

    return () => {
      cancelled = true
    }
  }, [billDetailById, currentTeamId, deletedBillPaymentsTeamId, fetchBillById, groupRevision, selectedGroup])

  const handleChangeGroupTab = useCallback((nextTab) => {
    setActiveGroupTab(nextTab)
  }, [])

  const activeLoans = useMemo(() => {
    return loans.filter((loan) => Number(loan.remaining_amount ?? 0) > 0)
  }, [loans])

  const isLoading =
    Boolean(currentTeamId) && (isWorkspaceLoading || isBillsLoading || isLoansLoading)
  const combinedError = [workspaceError, billsError, loansError]
    .filter((message, index, list) => Boolean(message) && list.indexOf(message) === index)
    .join(' | ')
  const showSkeleton =
    isLoading && paymentHistoryRows.length === 0 && bills.length === 0 && activeLoans.length === 0

  const persistPembayaranListState = useCallback(() => {
    if (!currentTeamId || typeof window === 'undefined') {
      return
    }

    savedScrollPositionRef.current = window.scrollY

    savePembayaranListState(currentTeamId, {
      scrollY: savedScrollPositionRef.current,
    })
  }, [currentTeamId])

  const handleOpenGroupDetail = useCallback(
    (groupKey) => {
      if (!groupKey) {
        return
      }

      persistPembayaranListState()
      navigate(`/pembayaran?group=${encodeURIComponent(groupKey)}`, {
        state: {
          returnTo: '/pembayaran',
        },
      })
    },
    [navigate, persistPembayaranListState]
  )

  const handleCloseGroupDetail = useCallback(() => {
    persistPembayaranListState()
    navigate(detailReturnTo)
  }, [detailReturnTo, navigate, persistPembayaranListState])

  useEffect(() => {
    if (!restoredPembayaranState || typeof window === 'undefined') {
      return
    }

    const scrollY = Number(restoredPembayaranState.scrollY ?? 0)

    if (!Number.isFinite(scrollY) || scrollY <= 0) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'auto' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [restoredPembayaranState])

  useEffect(() => {
    return () => {
      persistPembayaranListState()
    }
  }, [persistPembayaranListState])

  const handleOpenBillPayment = (billId) => {
    persistPembayaranListState()

    const bill = bills.find((item) => String(item.id ?? '') === String(billId)) ?? null
    const returnTo = isWorkerDetailMode
      ? `/pembayaran?group=${encodeURIComponent(selectedGroupKey)}`
      : '/pembayaran'

    navigate(`/payment/${billId}`, {
      state: {
        bill,
        record: bill,
        returnTo,
      },
    })
  }

  const handleDownloadReceipt = useCallback((entry) => {
    if (!entry?.payment) {
      return
    }

    savePaymentReceiptPdf({
      paymentType: 'bill',
      payment: entry.payment,
      parentRecord: entry.bill ?? {},
    })
  }, [])

  const handleArchivePayment = useCallback(
    async (entry) => {
      if (isReadOnly || !currentTeamId || !entry?.payment?.id) {
        return
      }

      try {
        await deleteBillPayment({
          payment_id: entry.payment.id,
          team_id: currentTeamId,
        })
        setBillDetailById({})
        setDeletedBillPaymentsTeamId(null)
        setGroupRevision((value) => value + 1)
      } catch (error) {
        showToast({
          tone: 'error',
          title: 'Pembayaran tagihan gagal diarsipkan',
          message: error instanceof Error ? error.message : 'Gagal mengarsipkan pembayaran.',
        })
      }
    },
    [currentTeamId, deleteBillPayment, isReadOnly, showToast]
  )

  const handleRestorePayment = useCallback(
    async (entry) => {
      if (isReadOnly || !currentTeamId || !entry?.payment?.id) {
        return
      }

      try {
        await restoreBillPaymentFromApi(
          entry.payment.id,
          currentTeamId,
          entry.payment.updatedAt ?? entry.payment.updated_at ?? null
        )
        await fetchUnpaidBills({ teamId: currentTeamId, silent: true })
        setBillDetailById({})
        setDeletedBillPaymentsTeamId(null)
        setGroupRevision((value) => value + 1)
        showToast({
          tone: 'success',
          title: 'Pembayaran tagihan dipulihkan',
          message: 'Riwayat pembayaran berhasil dipulihkan.',
        })
      } catch (error) {
        showToast({
          tone: 'error',
          title: 'Pembayaran tagihan gagal dipulihkan',
          message: error instanceof Error ? error.message : 'Gagal memulihkan pembayaran.',
        })
      }
    },
    [currentTeamId, fetchUnpaidBills, isReadOnly, showToast]
  )

  const handlePermanentDeletePayment = useCallback(
    async (entry) => {
      if (isReadOnly || !currentTeamId || !entry?.payment?.id) {
        return
      }

      try {
        await permanentDeleteBillPaymentFromApi(entry.payment.id, currentTeamId)
        await fetchUnpaidBills({ teamId: currentTeamId, silent: true })
        setBillDetailById({})
        setDeletedBillPaymentsTeamId(null)
        setGroupRevision((value) => value + 1)
        showToast({
          tone: 'success',
          title: 'Pembayaran tagihan dihapus permanen',
          message: 'Riwayat pembayaran berhasil dihapus permanen.',
        })
      } catch (error) {
        showToast({
          tone: 'error',
          title: 'Pembayaran tagihan gagal dihapus permanen',
          message: error instanceof Error ? error.message : 'Gagal menghapus permanen pembayaran.',
        })
      }
    },
    [currentTeamId, fetchUnpaidBills, isReadOnly, showToast]
  )

  const handleOpenLoanPayment = (loanId) => {
    persistPembayaranListState()

    const loan = loans.find((item) => String(item.id ?? '') === String(loanId)) ?? null

    navigate(`/loan-payment/${loanId}`, {
      state: {
        transaction: loan,
        record: loan,
        returnTo: '/pembayaran',
      },
    })
  }

  if (isWorkerDetailMode) {
    return (
      <PageShell>
        {combinedError ? (
          <AppCardDashed>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
              Gagal Memuat Pembayaran
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">{combinedError}</p>
          </AppCardDashed>
        ) : null}

        <PageHeader
          title={selectedGroup?.workerName ?? 'Detail Tagihan'}
          backAction={handleCloseGroupDetail}
          backLabel="Kembali"
        />

        {!currentTeamId ? (
          <AppCardDashed className="px-4 py-5">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              Team aktif belum tersedia.
            </p>
          </AppCardDashed>
        ) : selectedGroup ? (
          <PayrollGroupDetail
            activeTab={activeGroupTab}
            bills={selectedGroupBills}
            group={selectedGroup}
            historyRows={selectedGroupHistoryRows}
            isLoading={isGroupLoading}
            isReadOnly={isReadOnly}
            onArchivePayment={handleArchivePayment}
            onChangeTab={handleChangeGroupTab}
          onDownloadReceipt={handleDownloadReceipt}
          onOpenBill={handleOpenBillPayment}
          onPermanentDeletePayment={handlePermanentDeletePayment}
          onRestorePayment={handleRestorePayment}
          tabOptions={selectedGroupTabOptions}
        />
        ) : isBillsLoading || isGroupLoading ? (
          <section className="grid min-h-[calc(100dvh-18rem)] place-items-center px-4 text-center">
            <div className="flex flex-col items-center gap-5">
              <BrandLoader context="server" size="hero" />
              <div className="space-y-2">
                <h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--app-text-color)]">
                  Memuat detail tagihan
                </h2>
                <p className="max-w-[20rem] text-sm leading-6 text-[var(--app-hint-color)]">
                  Menyiapkan data worker dan pembayaran.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <AppCardDashed className="px-4 py-5">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              Tagihan worker tidak ditemukan.
            </p>
          </AppCardDashed>
        )}
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        title="Pembayaran"
        action={
          <AppButton
            onClick={() => {
              persistPembayaranListState()
              navigate('/transactions')
            }}
            size="sm"
            type="button"
            variant="secondary"
            leadingIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Jurnal
          </AppButton>
        }
      />

      {combinedError ? (
        <AppCardDashed>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
            Gagal Memuat Pembayaran
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">{combinedError}</p>
        </AppCardDashed>
      ) : null}

      {!currentTeamId ? (
        <AppCardDashed className="px-4 py-5">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Team aktif belum tersedia.
          </p>
        </AppCardDashed>
      ) : showSkeleton ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <AppCardStrong key={item}>
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--app-surface-low-color)]" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-2/3 animate-pulse rounded-full bg-[var(--app-surface-low-color)]" />
                  <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-[var(--app-surface-low-color)]" />
                </div>
              </div>
            </AppCardStrong>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3 px-1">
              <div>
                <p className="app-kicker">Histori</p>
                <h2 className="app-section-title">Aktivitas settlement</h2>
              </div>
            </div>

            {paymentHistoryRows.length === 0 ? (
              <AppCardDashed className="px-4 py-5">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  Belum Ada Riwayat
                </p>
              </AppCardDashed>
            ) : (
              <div className="space-y-3">
                {paymentHistoryRows.map((transaction) => {
                  const isLoanPayment = transaction.sourceType === 'loan-payment'
                  const Icon = isLoanPayment ? ArrowDownLeft : ArrowUpRight

                  return (
                    <AppCardStrong key={transaction.id} className="px-4 py-4">
                      <button
                        className="flex w-full items-center gap-3 text-left"
                        onClick={() => {
                          persistPembayaranListState()
                          navigate(`/transactions/${transaction.id}?surface=pembayaran`, {
                            state: { transaction, detailSurface: 'pembayaran' },
                          })
                        }}
                        type="button"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-low-color)] text-[var(--app-text-color)]">
                          <Icon className="h-[18px] w-[18px]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                            {getTransactionTitle(transaction)}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--app-hint-color)]">
                            {getTransactionSourceLabel(transaction)}
                          </p>
                          <p className="mt-1 text-xs text-[var(--app-hint-color)]">
                            {formatTransactionTimestamp(transaction, ['created_at', 'updated_at', 'transaction_date'])}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--app-text-color)]">
                            {formatCurrency(Math.abs(Number(transaction.amount ?? 0)))}
                          </span>
                          <ChevronRight className="h-4 w-4 text-[var(--app-hint-color)]" />
                        </div>
                      </button>
                    </AppCardStrong>
                  )
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3 px-1">
              <div>
                <p className="app-kicker">Aksi Settlement</p>
                <h2 className="app-section-title">Tagihan</h2>
              </div>
            </div>

            {displayBills.length === 0 ? (
              <AppCardDashed className="px-4 py-5">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  Belum Ada Tagihan
                </p>
              </AppCardDashed>
            ) : (
              <div className="space-y-3">
                {displayBills.map((item) => {
                  if (item.kind === 'worker-group') {
                    return (
                      <PayrollBillGroupCard
                        key={item.groupKey}
                        group={item}
                        onOpenDetail={handleOpenGroupDetail}
                      />
                    )
                  }

                  return (
                    <AppCardStrong key={item.bill.id} className="px-4 py-4">
                      <BillRowButton bill={item.bill} onOpenBill={handleOpenBillPayment} />
                    </AppCardStrong>
                  )
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3 px-1">
              <div>
                <p className="app-kicker">Aksi Settlement</p>
                <h2 className="app-section-title">Pinjaman</h2>
              </div>
            </div>

            {activeLoans.length === 0 ? (
              <AppCardDashed className="px-4 py-5">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  Belum Ada Pinjaman Aktif
                </p>
              </AppCardDashed>
            ) : (
              <div className="space-y-3">
                {activeLoans.map((loan) => (
                  <AppCardStrong key={loan.id} className="px-4 py-4">
                    <button
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => handleOpenLoanPayment(loan.id)}
                      type="button"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-tone-info-bg)] text-[var(--app-tone-info-text)]">
                        <ArrowDownLeft className="h-[18px] w-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                          {loan.creditor_name_snapshot || loan.description || 'Pinjaman'}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--app-hint-color)]">
                          {formatAppDateLabel(loan.dueDate ?? loan.transaction_date ?? loan.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--app-text-color)]">
                          {formatCurrency(Number(loan.remaining_amount ?? 0))}
                        </span>
                        <ChevronRight className="h-4 w-4 text-[var(--app-hint-color)]" />
                      </div>
                    </button>
                  </AppCardStrong>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PageShell>
  )
}

export default PaymentsPage
