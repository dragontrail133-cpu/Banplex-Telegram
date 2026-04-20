import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AppButton,
  AppCard,
  AppCardDashed,
  AppCardStrong,
  PageShell,
  PageHeader,
} from '../components/ui/AppPrimitives'
import {
  canDeleteTransaction,
  canEditTransaction,
  formatCurrency,
  formatPayrollSettlementLabel,
  formatTransactionDateTime,
  getTransactionEditRoute,
  getTransactionPaymentLabel,
  getTransactionPaymentRoute,
  getTransactionSourceLabel,
  getTransactionTitle,
  getTransactionTypeLabel,
} from '../lib/transaction-presentation'
import useAuthStore from '../store/useAuthStore'
import useBillStore from '../store/useBillStore'
import useDashboardStore from '../store/useDashboardStore'
import useIncomeStore from '../store/useIncomeStore'
import useAttendanceStore from '../store/useAttendanceStore'
import useTransactionStore from '../store/useTransactionStore'
import ExpenseAttachmentSection from '../components/ExpenseAttachmentSection'

function findTransactionById(cashMutations, transactionId) {
  return (
    cashMutations.find(
      (transaction) => String(transaction?.id ?? '').trim() === String(transactionId ?? '').trim()
    ) ?? null
  )
}

function isMaterialExpense(transaction) {
  const expenseType = String(transaction?.expense_type ?? '').trim().toLowerCase()
  const documentType = String(transaction?.document_type ?? '').trim().toLowerCase()

  return expenseType === 'material' || expenseType === 'material_invoice' || documentType === 'surat_jalan'
}

function formatValue(value) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : '-'
}

function formatAttendanceStatusLabel(status) {
  const normalizedStatus = String(status ?? '').trim().toLowerCase()

  if (normalizedStatus === 'full_day') {
    return 'Full Day'
  }

  if (normalizedStatus === 'half_day') {
    return 'Half Day'
  }

  if (normalizedStatus === 'overtime') {
    return 'Lembur'
  }

  return '-'
}

function getTransactionPresentation(transaction) {
  if (transaction?.type === 'expense') {
    return {
      Icon: ArrowUpRight,
      amountClassName: 'text-[var(--app-destructive-color)]',
      amountPrefix: '-',
    }
  }

  return {
    Icon: ArrowDownLeft,
    amountClassName: 'text-[var(--app-success-color)]',
    amountPrefix: '+',
  }
}

function formatLoanSettlementLabel(status) {
  const normalizedStatus = String(status ?? '').trim().toLowerCase()

  if (normalizedStatus === 'paid') {
    return 'Lunas'
  }

  if (normalizedStatus === 'partial') {
    return 'Sebagian lunas'
  }

  return 'Belum lunas'
}

function getDetailSurface(location) {
  const stateSurface = String(
    location.state?.detailSurface ?? location.state?.surface ?? ''
  ).trim().toLowerCase()

  if (stateSurface) {
    return stateSurface
  }

  const searchSurface = new URLSearchParams(location.search).get('surface')

  return String(searchSurface ?? '').trim().toLowerCase()
}

function TransactionDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { transactionId } = useParams()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const cashMutations = useDashboardStore((state) => state.cashMutations)
  const workspaceTransactions = useDashboardStore((state) => state.workspaceTransactions)
  const refreshDashboard = useDashboardStore((state) => state.refreshDashboard)
  const refreshWorkspaceTransactions = useDashboardStore(
    (state) => state.fetchWorkspaceTransactions
  )
  const fetchBillById = useBillStore((state) => state.fetchBillById)
  const softDeleteProjectIncome = useIncomeStore((state) => state.softDeleteProjectIncome)
  const softDeleteLoan = useIncomeStore((state) => state.softDeleteLoan)
  const fetchLoanById = useIncomeStore((state) => state.fetchLoanById)
  const softDeleteExpense = useTransactionStore((state) => state.softDeleteExpense)
  const softDeleteMaterialInvoice = useTransactionStore(
    (state) => state.softDeleteMaterialInvoice
  )
  const softDeleteAttendanceRecord = useAttendanceStore(
    (state) => state.softDeleteAttendanceRecord
  )
  const fetchMaterialInvoiceById = useTransactionStore(
    (state) => state.fetchMaterialInvoiceById
  )
  const initialTransaction = location.state?.transaction ?? null
  const [transaction, setTransaction] = useState(initialTransaction)
  const [billDetail, setBillDetail] = useState(null)
  const [loanDetail, setLoanDetail] = useState(null)
  const [materialInvoiceDetail, setMaterialInvoiceDetail] = useState(null)
  const [isLoadingRecord, setIsLoadingRecord] = useState(false)
  const [recordError, setRecordError] = useState(null)
  const combinedTransactions = useMemo(
    () => [...workspaceTransactions, ...cashMutations],
    [cashMutations, workspaceTransactions]
  )
  const detailSurface = useMemo(() => getDetailSurface(location), [location])
  const isHistorySurface = detailSurface === 'riwayat' || detailSurface === 'history'
  const isPaymentSurface = detailSurface === 'pembayaran' || detailSurface === 'payment'
  const backRoute = isHistorySurface
    ? '/transactions/history'
    : isPaymentSurface
      ? '/pembayaran'
      : '/transactions'

  useEffect(() => {
    let isActive = true

    async function hydrateChildCollections(nextTransaction) {
      setBillDetail(null)
      setLoanDetail(null)

      const nextBillId =
        nextTransaction?.bill?.id ?? nextTransaction?.salaryBill?.id ?? null

      if (nextBillId) {
        try {
          const nextBill = await fetchBillById(nextBillId)

          if (isActive) {
            setBillDetail(nextBill)
          }
        } catch (billDetailError) {
          if (isActive) {
            setBillDetail(null)
            console.error('Gagal memuat detail bill:', billDetailError)
          }
        }
      }

      if (nextTransaction?.sourceType === 'loan-disbursement') {
        try {
          const nextLoan = await fetchLoanById(nextTransaction.id)

          if (isActive) {
            setLoanDetail(nextLoan)
          }
        } catch (loanDetailError) {
          if (isActive) {
            setLoanDetail(null)
            console.error('Gagal memuat detail pinjaman:', loanDetailError)
          }
        }
      }
    }

    const cachedTransaction =
      initialTransaction?.id === transactionId
        ? initialTransaction
        : findTransactionById(combinedTransactions, transactionId)

    if (cachedTransaction) {
      setTransaction(cachedTransaction)
      setMaterialInvoiceDetail(null)
      setRecordError(null)
      setIsLoadingRecord(false)
      void hydrateChildCollections(cachedTransaction)

      return () => {
        isActive = false
      }
    }

    if (!currentTeamId) {
      setTransaction(null)
      setMaterialInvoiceDetail(null)
      setRecordError('Workspace aktif belum tersedia.')
      setIsLoadingRecord(false)

      return () => {
        isActive = false
      }
    }

    async function loadTransaction() {
      setIsLoadingRecord(true)
      setRecordError(null)
      setBillDetail(null)
      setLoanDetail(null)

      try {
        const [nextWorkspaceTransactions, result] = await Promise.all([
          refreshWorkspaceTransactions(currentTeamId, { silent: true }),
          refreshDashboard(currentTeamId, { silent: true }),
        ])
        const nextTransaction =
          findTransactionById(nextWorkspaceTransactions ?? [], transactionId) ??
          findTransactionById(result?.cashMutations ?? [], transactionId)

        if (!isActive) {
          return
        }

        if (!nextTransaction) {
          setTransaction(null)
          setMaterialInvoiceDetail(null)
          setRecordError('Transaksi tidak ditemukan.')
          return
        }

        setTransaction(nextTransaction)
        await hydrateChildCollections(nextTransaction)

        if (isMaterialExpense(nextTransaction)) {
          try {
            const nextMaterialInvoice = await fetchMaterialInvoiceById(nextTransaction.id, {
              includeDeleted: true,
            })

            if (isActive) {
              setMaterialInvoiceDetail(nextMaterialInvoice)
            }
          } catch (materialInvoiceError) {
            if (isActive) {
              setMaterialInvoiceDetail(null)
              console.error('Gagal memuat detail faktur material:', materialInvoiceError)
            }
          }
        } else if (isActive) {
          setMaterialInvoiceDetail(null)
        }
      } catch (error) {
        if (!isActive) {
          return
        }

        setTransaction(null)
        setMaterialInvoiceDetail(null)
        setRecordError(
          error instanceof Error ? error.message : 'Gagal memuat detail transaksi.'
        )
      } finally {
        if (isActive) {
          setIsLoadingRecord(false)
        }
      }
    }

    void loadTransaction()

    return () => {
      isActive = false
    }
  }, [
    cashMutations,
    combinedTransactions,
    currentTeamId,
    initialTransaction,
    refreshDashboard,
    refreshWorkspaceTransactions,
    transactionId,
    fetchMaterialInvoiceById,
    fetchBillById,
    fetchLoanById,
  ])

  const handleEdit = () => {
    if (!transaction || isHistorySurface) {
      return
    }

    const editRoute = getTransactionEditRoute(transaction)

    if (!editRoute) {
      return
    }

    navigate(editRoute, { state: { item: transaction } })
  }

  const handleOpenPayment = () => {
    if (!transaction || isHistorySurface) {
      return
    }

    const paymentRoute = getTransactionPaymentRoute(transaction)

    if (!paymentRoute) {
      return
    }

    navigate(paymentRoute, {
      state: {
        transaction,
        returnTo: '/transactions',
      },
    })
  }

  const handleDelete = async () => {
    if (!transaction || isHistorySurface || !canDeleteTransaction(transaction)) {
      return
    }

    const shouldDelete = window.confirm(`Hapus ${getTransactionTitle(transaction)}?`)

    if (!shouldDelete) {
      return
    }

    try {
      setRecordError(null)

      if (transaction.sourceType === 'project-income') {
        await softDeleteProjectIncome(transaction.id, transaction.updated_at ?? transaction.updatedAt ?? null)
      } else if (transaction.sourceType === 'loan-disbursement') {
        await softDeleteLoan(transaction.id, transaction.updated_at ?? transaction.updatedAt ?? null)
      } else if (transaction.sourceType === 'expense') {
        if (isMaterialExpense(transaction)) {
          await softDeleteMaterialInvoice(transaction.id, transaction.updated_at ?? transaction.updatedAt ?? null)
        } else {
          await softDeleteExpense(transaction.id, transaction.updated_at ?? transaction.updatedAt ?? null)
        }
      } else if (transaction.sourceType === 'attendance-record') {
        await softDeleteAttendanceRecord({
          attendanceId: transaction.id,
          teamId: transaction.team_id ?? currentTeamId,
        })
      }

      if (currentTeamId) {
        await Promise.all([
          refreshDashboard(currentTeamId, { silent: true }),
          refreshWorkspaceTransactions(currentTeamId, { silent: true }),
        ])
      }

      navigate('/transactions/recycle-bin', { replace: true })
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'Gagal menghapus transaksi.')
    }
  }

  if (!transaction && isLoadingRecord) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={isHistorySurface ? 'Riwayat' : isPaymentSurface ? 'Pembayaran' : 'Jurnal'}
          title={
            isHistorySurface
              ? 'Detail Riwayat'
              : isPaymentSurface
                ? 'Detail Pembayaran'
                : 'Detail Jurnal'
          }
          action={
            <AppButton
              onClick={() => navigate(backRoute)}
              size="sm"
              type="button"
              variant="secondary"
              leadingIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Kembali
            </AppButton>
          }
        />
        <AppCardDashed className="px-4 py-5 text-sm text-[var(--app-hint-color)]">
          Memuat detail transaksi...
        </AppCardDashed>
      </PageShell>
    )
  }

  if (!transaction) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={isHistorySurface ? 'Riwayat' : isPaymentSurface ? 'Pembayaran' : 'Jurnal'}
          title={
            isHistorySurface
              ? 'Detail Riwayat'
              : isPaymentSurface
                ? 'Detail Pembayaran'
                : 'Detail Jurnal'
          }
          action={
            <AppButton
              onClick={() => navigate(backRoute)}
              size="sm"
              type="button"
              variant="secondary"
              leadingIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Kembali
            </AppButton>
          }
        />
        <AppCardDashed className="px-4 py-5">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Data transaksi belum tersedia.
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
            {recordError ??
              `Buka ulang dari halaman ${
                isHistorySurface ? 'riwayat' : isPaymentSurface ? 'pembayaran' : 'transaksi'
              } untuk memuat data terbaru.`}
          </p>
        </AppCardDashed>
      </PageShell>
    )
  }

  const presentation = getTransactionPresentation(transaction)
  const { Icon } = presentation
  const editButtonLabel =
    transaction.document_type === 'surat_jalan' ? 'Konversi Surat Jalan' : 'Edit'
  const showAttachmentSection = transaction.sourceType === 'expense'
  const attachmentTitle = isMaterialExpense(transaction)
    ? 'Lampiran Faktur Material'
    : 'Lampiran Pengeluaran'
  const billPayments = Array.isArray(billDetail?.payments) ? billDetail.payments : []
  const loanPayments = Array.isArray(loanDetail?.payments) ? loanDetail.payments : []
  const isLoanDisbursement = transaction.sourceType === 'loan-disbursement'
  const isAttendanceRecord = transaction.sourceType === 'attendance-record'
  const isPayrollBill =
    String(
      transaction?.bill?.billType ??
        transaction?.bill?.bill_type ??
        transaction?.salaryBill?.billType ??
        transaction?.salaryBill?.bill_type ??
        ''
    ).trim().toLowerCase() === 'gaji'
  const loanSnapshot = isLoanDisbursement ? loanDetail ?? transaction : null
  const loanSettlementLabel = formatLoanSettlementLabel(loanSnapshot?.status ?? transaction.status)
  const loanOutstandingAmount = Number(
    loanSnapshot?.remaining_amount ?? loanSnapshot?.remainingAmount ?? 0
  )
  const loanLateChargeAmount = Number(
    loanSnapshot?.late_charge_summary?.totalLateChargeAmount ??
      loanSnapshot?.late_charge_summary?.total_late_charge_amount ??
      loanSnapshot?.lateChargeSummary?.totalLateChargeAmount ??
      loanSnapshot?.lateChargeSummary?.total_late_charge_amount ??
      0
  )
  const payrollSettlementLabel = formatPayrollSettlementLabel(
    transaction?.salaryBill?.status ?? transaction?.bill?.status ?? transaction?.status
  )
  const detailTitle = isLoanDisbursement
    ? 'Dana Masuk / Pinjaman'
    : isAttendanceRecord
      ? 'Catatan Absensi'
      : isPaymentSurface
        ? 'Detail Pembayaran'
        : 'Detail Jurnal'
  const detailEyebrow = isHistorySurface
    ? 'Riwayat'
    : isPaymentSurface
      ? 'Pembayaran'
      : 'Jurnal'
  const detailHeaderTitle = isHistorySurface
    ? 'Detail Riwayat'
    : isPaymentSurface
      ? 'Detail Pembayaran'
      : detailTitle
  const attendanceDateTime = formatTransactionDateTime(
    transaction.attendance_date ?? transaction.transaction_date ?? transaction.created_at
  )
  const attendanceWorkerName = formatValue(
    transaction.worker_name_snapshot ?? transaction.workerName ?? transaction.party_label
  )
  const attendanceProjectName = formatValue(
    transaction.project_name_snapshot ?? transaction.project_name ?? transaction.party_label
  )
  const attendanceStatusLabel = formatAttendanceStatusLabel(transaction.attendance_status)
  const attendancePayrollLabel = payrollSettlementLabel
  const attendancePayrollAmount = Number(
    transaction.salaryBill?.amount ?? transaction.salaryBill?.repayment_amount ?? transaction.total_pay ?? 0
  )
  const attendancePayrollRemaining = Number(
    transaction.salaryBill?.remainingAmount ??
      transaction.salaryBill?.remaining_amount ??
      0
  )
  const canEdit = !isHistorySurface && !isPaymentSurface && canEditTransaction(transaction)
  const canDelete = !isHistorySurface && !isPaymentSurface && canDeleteTransaction(transaction)
  const paymentRoute = isHistorySurface || isPaymentSurface ? null : getTransactionPaymentRoute(transaction)

  return (
    <PageShell>
      <PageHeader
        eyebrow={detailEyebrow}
        title={detailHeaderTitle}
        action={
          <AppButton
            onClick={() => navigate(backRoute)}
            size="sm"
            type="button"
            variant="secondary"
            leadingIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Kembali
          </AppButton>
        }
      />

      {recordError ? (
        <AppCardDashed>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
            Aksi Transaksi Gagal
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">{recordError}</p>
        </AppCardDashed>
      ) : null}

      <AppCardStrong className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)]">
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
              {getTransactionTitle(transaction)}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--app-hint-color)]">
              {getTransactionSourceLabel(transaction)}
            </p>
          </div>
        </div>

        {isAttendanceRecord ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <AppCard className="space-y-2 bg-[var(--app-surface-low-color)] px-4 py-3" padded={false}>
              <p className="app-meta">Pekerja</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {attendanceWorkerName}
              </p>
            </AppCard>
            <AppCard className="space-y-2 bg-[var(--app-surface-low-color)] px-4 py-3" padded={false}>
              <p className="app-meta">Proyek</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {attendanceProjectName}
              </p>
            </AppCard>
            <AppCard className="space-y-2 bg-[var(--app-surface-low-color)] px-4 py-3" padded={false}>
              <p className="app-meta">Tanggal Absensi</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {attendanceDateTime}
              </p>
            </AppCard>
            <AppCard className="space-y-2 bg-[var(--app-surface-low-color)] px-4 py-3" padded={false}>
              <p className="app-meta">Status Kehadiran</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {attendanceStatusLabel}
              </p>
            </AppCard>
            <AppCard className="space-y-2 bg-[var(--app-surface-low-color)] px-4 py-3 sm:col-span-2" padded={false}>
              <p className="app-meta">Total Upah</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {formatCurrency(Number(transaction.total_pay ?? 0))}
              </p>
            </AppCard>
          </div>
        ) : null}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
            Nominal
          </p>
          <p
            className={`mt-2 text-2xl font-bold tracking-[-0.04em] ${presentation.amountClassName}`}
          >
            {presentation.amountPrefix}
            {formatCurrency(Math.abs(Number(transaction.amount ?? 0)))}
          </p>
        </div>
      </AppCardStrong>

      {transaction.bill ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
            <p className="app-meta">{isPayrollBill ? 'Status Tagihan Upah' : 'Status Tagihan'}</p>
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              {isPayrollBill
                ? payrollSettlementLabel
                : transaction.bill.status ?? '-'}
            </p>
          </AppCard>
          <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
            <p className="app-meta">{isPayrollBill ? 'Nominal Tagihan Upah' : 'Nominal Tagihan'}</p>
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              {formatCurrency(transaction.bill.amount ?? 0)}
            </p>
          </AppCard>
          <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
            <p className="app-meta">{isPayrollBill ? 'Sisa Tagihan Upah' : 'Sisa Tagihan'}</p>
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              {formatCurrency(transaction.bill.remainingAmount ?? 0)}
            </p>
          </AppCard>
        </div>
      ) : null}

      {transaction.salaryBill ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
            <p className="app-meta">Status Tagihan Upah</p>
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              {attendancePayrollLabel}
            </p>
          </AppCard>
          <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
            <p className="app-meta">Nominal Tagihan Upah</p>
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              {formatCurrency(attendancePayrollAmount)}
            </p>
          </AppCard>
          <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
            <p className="app-meta">Sisa Tagihan Upah</p>
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              {formatCurrency(attendancePayrollRemaining)}
            </p>
          </AppCard>
        </div>
      ) : null}

      {paymentRoute ? (
        <AppButton onClick={handleOpenPayment} type="button" variant="secondary">
          {getTransactionPaymentLabel(transaction)}
        </AppButton>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
          <p className="app-meta">Tanggal</p>
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            {formatTransactionDateTime(
              transaction.attendance_date ??
                transaction.transaction_date ??
                transaction.created_at
            )}
          </p>
        </AppCard>
        <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
          <p className="app-meta">Jenis</p>
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            {getTransactionTypeLabel(transaction)}
          </p>
        </AppCard>
        <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
          <p className="app-meta">Sumber</p>
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            {getTransactionSourceLabel(transaction)}
          </p>
        </AppCard>
        {transaction.document_type ? (
          <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
            <p className="app-meta">Dokumen</p>
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              {formatValue(transaction.document_type)}
            </p>
          </AppCard>
        ) : null}
        <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
          <p className="app-meta">ID</p>
          <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
            {transaction.id}
          </p>
        </AppCard>
      </div>

      <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
        <p className="app-meta">Keterangan</p>
        <p className="text-sm leading-6 text-[var(--app-text-color)]">
          {getTransactionTitle(transaction)}
        </p>
      </AppCard>

      {loanSnapshot ? (
        <AppCard className="space-y-3 bg-[var(--app-surface-strong-color)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-meta">Dana Masuk / Pinjaman</p>
              <h3 className="app-section-title">Ringkasan Pinjaman</h3>
            </div>
            <span className="app-chip">{loanSettlementLabel}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <AppCard className="space-y-2 bg-[var(--app-surface-low-color)] px-4 py-3" padded={false}>
              <p className="app-meta">Kreditur</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {loanSnapshot.creditor_name_snapshot ?? transaction.party_label ?? '-'}
              </p>
            </AppCard>
            <AppCard className="space-y-2 bg-[var(--app-surface-low-color)] px-4 py-3" padded={false}>
              <p className="app-meta">Pokok</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {formatCurrency(loanSnapshot.principal_amount ?? loanSnapshot.amount ?? 0)}
              </p>
            </AppCard>
            <AppCard className="space-y-2 bg-[var(--app-surface-low-color)] px-4 py-3" padded={false}>
              <p className="app-meta">Total Pengembalian</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {formatCurrency(
                  loanSnapshot.repayment_amount ?? loanSnapshot.base_repayment_amount ?? 0
                )}
              </p>
            </AppCard>
            <AppCard className="space-y-2 bg-[var(--app-surface-low-color)] px-4 py-3" padded={false}>
              <p className="app-meta">Tenor</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {loanSnapshot.tenor_months ? `${loanSnapshot.tenor_months} bulan` : '-'}
              </p>
            </AppCard>
            <AppCard className="space-y-2 bg-[var(--app-surface-low-color)] px-4 py-3" padded={false}>
              <p className="app-meta">Jatuh Tempo</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {formatTransactionDateTime(loanSnapshot.due_date ?? loanSnapshot.dueDate)}
              </p>
            </AppCard>
            <AppCard className="space-y-2 bg-[var(--app-surface-low-color)] px-4 py-3" padded={false}>
              <p className="app-meta">Sisa Kewajiban</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {formatCurrency(loanOutstandingAmount)}
              </p>
            </AppCard>
            {loanLateChargeAmount > 0 ? (
              <AppCard className="space-y-2 bg-[var(--app-surface-low-color)] px-4 py-3" padded={false}>
                <p className="app-meta">Penalti Snapshot</p>
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  {formatCurrency(loanLateChargeAmount)}
                </p>
              </AppCard>
            ) : null}
          </div>
        </AppCard>
      ) : null}

      {materialInvoiceDetail?.items?.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <p className="app-kicker">Rincian Item</p>
              <h3 className="app-section-title">Faktur Material</h3>
            </div>
            <span className="app-chip">{materialInvoiceDetail.items.length} item</span>
          </div>

          <div className="space-y-3">
            {materialInvoiceDetail.items.map((item) => (
              <AppCard key={item.id ?? `${item.sort_order}-${item.item_name}`} className="space-y-2 bg-[var(--app-surface-strong-color)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--app-text-color)]">
                      {item.item_name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--app-hint-color)]">
                      Qty {item.qty} • Urutan {item.sort_order}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-[var(--app-text-color)]">
                    {formatCurrency(item.line_total ?? 0)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-[var(--app-hint-color)]">
                  <span className="app-chip">Harga {formatCurrency(item.unit_price ?? 0)}</span>
                  <span className="app-chip">Subtotal {formatCurrency(item.line_total ?? 0)}</span>
                </div>
              </AppCard>
            ))}
          </div>
        </div>
      ) : null}

      {showAttachmentSection ? (
        <ExpenseAttachmentSection
          expenseId={transaction.id}
          readOnly={isHistorySurface}
          title={attachmentTitle}
        />
      ) : null}

      {billDetail?.id ? (
        <AppCard className="space-y-3 bg-[var(--app-surface-strong-color)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-meta">Histori Pembayaran</p>
              <h3 className="app-section-title">Riwayat Tagihan</h3>
            </div>
            <span className="app-chip">{billPayments.length} item</span>
          </div>

          {billPayments.length > 0 ? (
            <div className="space-y-2">
              {billPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-[20px] border border-[var(--app-border-color)] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--app-text-color)]">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                        {formatTransactionDateTime(payment.paymentDate ?? payment.createdAt)}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-[var(--app-hint-color)]">
                      {formatValue(payment.notes)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="app-card-dashed px-4 py-5 text-sm text-[var(--app-hint-color)]">
              Belum ada pembayaran untuk bill ini.
            </div>
          )}
        </AppCard>
      ) : null}

      {loanDetail?.id ? (
        <AppCard className="space-y-3 bg-[var(--app-surface-strong-color)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-meta">Histori Pembayaran</p>
              <h3 className="app-section-title">Riwayat Dana Masuk / Pinjaman</h3>
            </div>
            <span className="app-chip">{loanPayments.length} item</span>
          </div>

          {loanPayments.length > 0 ? (
            <div className="space-y-2">
              {loanPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-[20px] border border-[var(--app-border-color)] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--app-text-color)]">
                        {formatCurrency(payment.amount)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                        {formatTransactionDateTime(payment.paymentDate ?? payment.createdAt)}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-[var(--app-hint-color)]">
                      {formatValue(payment.notes)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="app-card-dashed px-4 py-5 text-sm text-[var(--app-hint-color)]">
              Belum ada pembayaran untuk pinjaman ini.
            </div>
          )}
        </AppCard>
      ) : null}

      {canEdit || canDelete ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {canEdit ? (
            <AppButton onClick={handleEdit} type="button" variant="secondary">
              {editButtonLabel}
            </AppButton>
          ) : null}
          {canDelete ? (
            <AppButton onClick={handleDelete} type="button" variant="danger">
              Hapus
            </AppButton>
          ) : null}
        </div>
      ) : null}
    </PageShell>
  )
}

export default TransactionDetailPage
