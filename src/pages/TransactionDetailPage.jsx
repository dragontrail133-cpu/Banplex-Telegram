import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Check, Download, Eye, PencilLine, Trash2, X } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AppButton,
  AppCard,
  AppCardDashed,
  AppCardStrong,
  AppInput,
  PageShell,
  PageHeader,
  AppTechnicalGrid,
} from '../components/ui/AppPrimitives'
import MaterialInvoiceDetailPanel from '../components/MaterialInvoiceDetailPanel'
import TransactionDeleteDialog from '../components/TransactionDeleteDialog'
import { formatAppDateLabel } from '../lib/date-time'
import { savePaymentReceiptPdf } from '../lib/report-pdf'
import {
  canEditTransaction,
  formatCurrency,
  hasMeaningfulText,
  formatPayrollSettlementLabel,
  formatTransactionTimestamp,
  getTransactionEditRoute,
  getTransactionPaymentLabel,
  getTransactionPaymentRoute,
  getTransactionSourceLabel,
  getTransactionTitle,
  shouldHideTransactionAmount,
} from '../lib/transaction-presentation'
import {
  canShowTransactionDelete,
  getTransactionDeleteHistoryRoute,
} from '../lib/transaction-delete'
import { canPerformAttachmentAction } from '../lib/attachment-permissions'
import {
  fetchHistoryTransactionByIdFromApi,
  fetchWorkspaceTransactionByIdFromApi,
} from '../lib/transactions-api'
import { fetchMaterialInvoiceByIdFromApi } from '../lib/records-api'
import useAuthStore from '../store/useAuthStore'
import useBillStore from '../store/useBillStore'
import useDashboardStore from '../store/useDashboardStore'
import useIncomeStore from '../store/useIncomeStore'
import useAttendanceStore from '../store/useAttendanceStore'
import useFileStore from '../store/useFileStore'
import usePaymentStore from '../store/usePaymentStore'
import useTransactionStore from '../store/useTransactionStore'
import useMutationToast from '../hooks/useMutationToast'

function isMaterialExpense(transaction) {
  const expenseType = String(transaction?.expense_type ?? '').trim().toLowerCase()
  const documentType = String(transaction?.document_type ?? '').trim().toLowerCase()

  return expenseType === 'material' || expenseType === 'material_invoice' || documentType === 'surat_jalan'
}

function formatValue(value) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : '-'
}

function formatFileSize(sizeBytes) {
  const amount = Number(sizeBytes)

  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  if (amount >= 1024 * 1024) {
    return `${(amount / (1024 * 1024)).toFixed(1)} MB`
  }

  if (amount >= 1024) {
    return `${(amount / 1024).toFixed(1)} KB`
  }

  return `${amount} B`
}

function getAttachmentFileAsset(attachment) {
  return attachment?.file_assets ?? attachment?.file_asset ?? null
}

function getAttachmentFileName(attachment) {
  const fileAsset = getAttachmentFileAsset(attachment)

  return formatValue(fileAsset?.file_name ?? fileAsset?.original_name ?? 'Lampiran')
}

function isAttachmentImage(attachment) {
  const fileAsset = getAttachmentFileAsset(attachment)

  return String(fileAsset?.mime_type ?? '').startsWith('image/') && Boolean(fileAsset?.public_url)
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

  if (normalizedStatus === 'absent') {
    return 'Tidak Hadir'
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

function TransactionDetailPage({ technicalView = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { transactionId } = useParams()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const currentRole = useAuthStore((state) => state.role)
  const refreshDashboard = useDashboardStore((state) => state.refreshDashboard)
  const refreshWorkspaceTransactions = useDashboardStore(
    (state) => state.fetchWorkspaceTransactions
  )
  const fetchBillById = useBillStore((state) => state.fetchBillById)
  const softDeleteProjectIncome = useIncomeStore((state) => state.softDeleteProjectIncome)
  const softDeleteLoan = useIncomeStore((state) => state.softDeleteLoan)
  const fetchLoanById = useIncomeStore((state) => state.fetchLoanById)
  const softDeleteExpense = useTransactionStore((state) => state.softDeleteExpense)
  const fetchExpenseAttachments = useTransactionStore(
    (state) => state.fetchExpenseAttachments
  )
  const softDeleteExpenseAttachment = useTransactionStore(
    (state) => state.softDeleteExpenseAttachment
  )
  const updateFileAssetMetadata = useFileStore(
    (state) => state.updateFileAssetMetadata
  )
  const deleteBillPayment = usePaymentStore((state) => state.deleteBillPayment)
  const deleteLoanPayment = usePaymentStore((state) => state.deleteLoanPayment)
  const softDeleteAttendanceRecord = useAttendanceStore(
    (state) => state.softDeleteAttendanceRecord
  )
  const { begin, fail, succeed } = useMutationToast()
  const initialTransaction = location.state?.transaction ?? null
  const isOwner = currentRole === 'Owner'
  const [transaction, setTransaction] = useState(initialTransaction)
  const [billDetail, setBillDetail] = useState(null)
  const [materialInvoiceDetail, setMaterialInvoiceDetail] = useState(null)
  const [materialInvoiceError, setMaterialInvoiceError] = useState(null)
  const [loanDetail, setLoanDetail] = useState(null)
  const [expenseAttachments, setExpenseAttachments] = useState(
    Array.isArray(initialTransaction?.attachments) ? initialTransaction.attachments : []
  )
  const [activeDetailTab, setActiveDetailTab] = useState(() => {
    const initialSurface = getDetailSurface(location)

    return initialSurface === 'riwayat' || initialSurface === 'history' ? 'history' : 'info'
  })
  const [editingAttachmentId, setEditingAttachmentId] = useState(null)
  const [editingAttachmentName, setEditingAttachmentName] = useState('')
  const [detailRefreshKey, setDetailRefreshKey] = useState(0)
  const [isLoadingRecord, setIsLoadingRecord] = useState(false)
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false)
  const [recordError, setRecordError] = useState(null)
  const [attachmentError, setAttachmentError] = useState(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteDialogHistoryRoute, setDeleteDialogHistoryRoute] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const detailSurface = useMemo(() => getDetailSurface(location), [location])
  const isHistorySurface = detailSurface === 'riwayat' || detailSurface === 'history'
  const isPaymentSurface = detailSurface === 'pembayaran' || detailSurface === 'payment'
  const isExpenseRecord = transaction?.sourceType === 'expense'
  const backRoute = isHistorySurface
    ? '/transactions/history'
    : isPaymentSurface
      ? '/pembayaran'
      : '/transactions'

  useEffect(() => {
    setActiveDetailTab(isHistorySurface ? 'history' : 'info')
  }, [isHistorySurface, transactionId])

  useEffect(() => {
    let isActive = true

    async function hydrateChildCollections(nextTransaction) {
      setBillDetail(null)
      setMaterialInvoiceDetail(null)
      setMaterialInvoiceError(null)
      setLoanDetail(null)

      const nextBillId =
        nextTransaction?.bill?.id ??
        nextTransaction?.salaryBill?.id ??
        nextTransaction?.bill_id ??
        nextTransaction?.salary_bill_id ??
        null

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

      if (isMaterialExpense(nextTransaction)) {
        try {
          const nextMaterialInvoice = await fetchMaterialInvoiceByIdFromApi(nextTransaction.id, {
            includeDeleted: true,
          })

          if (isActive) {
            setMaterialInvoiceDetail(nextMaterialInvoice)
            setMaterialInvoiceError(
              nextMaterialInvoice ? null : 'Faktur material tidak ditemukan.'
            )
          }
        } catch (invoiceError) {
          if (isActive) {
            setMaterialInvoiceDetail(null)
            setMaterialInvoiceError(
              invoiceError instanceof Error
                ? invoiceError.message
                : 'Gagal memuat rincian faktur material.'
            )
            console.error('Gagal memuat detail faktur material:', invoiceError)
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

    if (!currentTeamId) {
      setTransaction(null)
      setMaterialInvoiceDetail(null)
      setMaterialInvoiceError(null)
      setRecordError('Workspace aktif belum tersedia.')
      setIsLoadingRecord(false)

      return () => {
        isActive = false
      }
    }

    const cachedTransaction = initialTransaction?.id === transactionId ? initialTransaction : null

    if (cachedTransaction) {
      setTransaction(cachedTransaction)
      setRecordError(null)
      setIsLoadingRecord(false)
    }

    async function loadTransaction() {
      setIsLoadingRecord(true)
      setRecordError(null)
      setBillDetail(null)
      setMaterialInvoiceDetail(null)
      setMaterialInvoiceError(null)
      setLoanDetail(null)

      try {
        const nextTransaction = isHistorySurface
          ? await fetchHistoryTransactionByIdFromApi(currentTeamId, transactionId)
          : await fetchWorkspaceTransactionByIdFromApi(currentTeamId, transactionId)

        if (!isActive) {
          return
        }

        if (!nextTransaction) {
          if (!cachedTransaction) {
            setTransaction(null)
            setRecordError('Transaksi tidak ditemukan.')
          }
          return
        }

        setTransaction(nextTransaction)
        await hydrateChildCollections(nextTransaction)
      } catch (error) {
        if (!isActive) {
          return
        }

        if (!cachedTransaction) {
          setTransaction(null)
          setRecordError(
            error instanceof Error ? error.message : 'Gagal memuat detail transaksi.'
          )
        }
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
    currentTeamId,
    initialTransaction,
    isHistorySurface,
    fetchBillById,
    fetchLoanById,
    transactionId,
    detailRefreshKey,
  ])

  useEffect(() => {
    let isActive = true

    if (!currentTeamId || !isExpenseRecord || !transaction?.id) {
      setExpenseAttachments([])
      setAttachmentError(null)
      setIsLoadingAttachments(false)

      return () => {
        isActive = false
      }
    }

    async function loadAttachments() {
      setIsLoadingAttachments(true)
      setAttachmentError(null)

      try {
        const nextAttachments = await fetchExpenseAttachments(transaction.id, {
          includeDeleted: false,
        })

        if (!isActive) {
          return
        }

        setExpenseAttachments(Array.isArray(nextAttachments) ? nextAttachments : [])
      } catch (error) {
        if (!isActive) {
          return
        }

        setExpenseAttachments([])
        setAttachmentError(error instanceof Error ? error.message : 'Gagal memuat lampiran.')
      } finally {
        if (isActive) {
          setIsLoadingAttachments(false)
        }
      }
    }

    void loadAttachments()

    return () => {
      isActive = false
    }
  }, [currentTeamId, fetchExpenseAttachments, isExpenseRecord, transaction?.id])

  const handleEdit = () => {
    if (!transaction || isHistorySurface) {
      return
    }

    const editRoute = getTransactionEditRoute(transaction)

    if (!editRoute) {
      return
    }

    navigate(editRoute, {
      state: {
        item: transaction,
        returnTo: backRoute,
      },
    })
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
        returnTo: backRoute,
        returnToOnSuccess: true,
      },
    })
  }

  const handleDelete = () => {
    if (!transaction || isHistorySurface || !canShowTransactionDelete(transaction)) {
      return
    }

    setRecordError(null)
    setDeleteDialogHistoryRoute(hasPaymentHistory ? getTransactionDeleteHistoryRoute(transaction) : null)
    setIsDeleteDialogOpen(true)
  }

  const performDelete = async () => {
    if (!transaction || isHistorySurface || !canShowTransactionDelete(transaction) || hasPaymentHistory) {
      return
    }

    try {
      begin({
        title: 'Menghapus transaksi',
        message: 'Mohon tunggu sampai transaksi berpindah ke recycle bin.',
      })

      setIsDeleting(true)
      setRecordError(null)

      if (transaction.sourceType === 'project-income') {
        await softDeleteProjectIncome(
          transaction.id,
          transaction.updated_at ?? transaction.updatedAt ?? null
        )
      } else if (transaction.sourceType === 'loan-disbursement') {
        await softDeleteLoan(transaction.id, transaction.updated_at ?? transaction.updatedAt ?? null)
      } else if (transaction.sourceType === 'expense') {
        await softDeleteExpense(transaction.id, transaction.updated_at ?? transaction.updatedAt ?? null)
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

      succeed({
        title: 'Transaksi dihapus',
        message: 'Transaksi berhasil dipindahkan ke recycle bin.',
      })
      navigate('/transactions/recycle-bin', { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menghapus transaksi.'

      fail({
        title: 'Transaksi gagal dihapus',
        message,
      })
    } finally {
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
      setDeleteDialogHistoryRoute(null)
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
  const hideTransactionAmount = shouldHideTransactionAmount(transaction)
  const editButtonLabel =
    transaction.document_type === 'surat_jalan' ? 'Konversi Surat Jalan' : 'Edit'
  const attachmentTitle = isMaterialExpense(transaction)
    ? 'Lampiran Faktur Material'
    : 'Lampiran Pengeluaran'
  const billSnapshot = billDetail ?? transaction.bill ?? (transaction.sourceType === 'bill' ? transaction : null)
  const billPayments = Array.isArray(billSnapshot?.payments) ? billSnapshot.payments : []
  const loanPayments = Array.isArray(loanDetail?.payments) ? loanDetail.payments : []
  const isLoanDisbursement = transaction.sourceType === 'loan-disbursement'
  const isAttendanceRecord = transaction.sourceType === 'attendance-record'
  const isPayrollBill =
    String(
      billSnapshot?.billType ??
        billSnapshot?.bill_type ??
        transaction?.billType ??
        transaction?.bill_type ??
        ''
    ).trim().toLowerCase() === 'gaji'
  const loanSnapshot = isLoanDisbursement ? loanDetail ?? transaction : null
  const loanSettlementLabel = formatLoanSettlementLabel(
    loanSnapshot?.status ??
      loanSnapshot?.bill_status ??
      loanSnapshot?.bill?.status ??
      transaction.status ??
      transaction.bill_status ??
      transaction.bill?.status
  )
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
    billSnapshot?.status ?? transaction?.status
  )
  const detailTitle = isLoanDisbursement
    ? 'Pinjaman'
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
  const attendanceDateTime = formatAppDateLabel(
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
    billSnapshot?.amount ??
      billSnapshot?.repayment_amount ??
      transaction.total_pay ??
      0
  )
  const attendancePayrollRemaining = Number(
    billSnapshot?.remainingAmount ??
      billSnapshot?.remaining_amount ??
      0
  )
  const canEdit = !isHistorySurface && !isPaymentSurface && canEditTransaction(transaction)
  const canDelete = !isHistorySurface && !isPaymentSurface && canShowTransactionDelete(transaction)
  const paymentRoute = isHistorySurface || isPaymentSurface ? null : getTransactionPaymentRoute(transaction)
  const billPaymentHistory = billPayments
  const loanPaymentHistory = loanPayments
  const activePaymentHistory = isLoanDisbursement ? loanPaymentHistory : billPaymentHistory
  const hasPaymentHistory = activePaymentHistory.length > 0
  const hasAttachmentHistory = expenseAttachments.length > 0
  const hasMaterialInvoiceDetail = isMaterialExpense(transaction)
  const materialInvoiceTabLabel =
    String(transaction?.document_type ?? '').trim().toLowerCase() === 'surat_jalan'
      ? 'Surat Jalan'
      : 'Faktur'
  const availableDetailTabs = [{ value: 'info', label: 'Info' }]

  if (hasMaterialInvoiceDetail) {
    availableDetailTabs.push({ value: 'invoice', label: `Rincian ${materialInvoiceTabLabel}` })
  }

  if (hasPaymentHistory) {
    availableDetailTabs.push({ value: 'history', label: 'Riwayat' })
  }

  if (hasAttachmentHistory) {
    availableDetailTabs.push({ value: 'attachments', label: 'Lampiran' })
  }

  const showDetailTabs = availableDetailTabs.length > 1
  const resolvedDetailTab = availableDetailTabs.some((tab) => tab.value === activeDetailTab)
    ? activeDetailTab
    : 'info'
  const technicalRoute = `/transactions/${transactionId}/technical${
    detailSurface ? `?surface=${detailSurface}` : ''
  }`
  const technicalDetailStatus = isLoadingRecord
    ? 'Memuat...'
    : transaction
      ? formatValue(transaction.status ?? billSnapshot?.status ?? transaction.bill?.status)
      : 'Belum ditemukan'
  const technicalRows = [
    {
      key: 'surface',
      label: 'Surface',
      value: formatValue(detailSurface || 'default'),
    },
    {
      key: 'source-type',
      label: 'Source Type',
      value: formatValue(transaction?.sourceType),
    },
    {
      key: 'status',
      label: 'Status Mentah',
      value: formatValue(technicalDetailStatus),
    },
    {
      key: 'id',
      label: 'ID',
      value: formatValue(transaction?.id),
    },
    {
      key: 'edit-route',
      label: 'Edit Route',
      value: formatValue(getTransactionEditRoute(transaction) ?? '-'),
    },
    {
      key: 'payment-route',
      label: 'Payment Route',
      value: formatValue(paymentRoute ?? '-'),
    },
  ]

  const handleDownloadPaymentReceipt = (payment) => {
    if (!payment) {
      return
    }

    try {
      savePaymentReceiptPdf({
        paymentType: isLoanDisbursement ? 'loan' : 'bill',
        payment: {
          ...payment,
          referenceId: payment.billId ?? payment.loanId ?? payment.id,
        },
        parentRecord: isLoanDisbursement ? (loanDetail ?? loanSnapshot ?? transaction) : (billDetail ?? billSnapshot ?? transaction),
        generatedAt: new Date(),
      })
    } catch (error) {
      setRecordError(error instanceof Error ? error.message : 'Gagal membuat kwitansi pembayaran.')
    }
  }

  const handleDeleteBillPayment = async (payment) => {
    if (!payment || currentRole === 'Viewer' || currentRole === 'Payroll') {
      return
    }

    try {
      begin({
        title: 'Menghapus pembayaran tagihan',
        message: 'Mohon tunggu sampai pembayaran hilang dari daftar.',
      })

      setRecordError(null)
      await deleteBillPayment({
        paymentId: payment.id,
        teamId: currentTeamId ?? billDetail?.team_id ?? transaction?.team_id,
        expectedUpdatedAt: payment.updatedAt ?? payment.updated_at ?? null,
      })
      setDetailRefreshKey((currentValue) => currentValue + 1)
      succeed({
        title: 'Pembayaran tagihan dihapus',
        message: 'Pembayaran berhasil dihapus.',
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal menghapus pembayaran tagihan.'

      fail({
        title: 'Pembayaran tagihan gagal dihapus',
        message,
      })
    }
  }

  const handleDeleteLoanPayment = async (payment) => {
    if (!payment || currentRole === 'Viewer' || currentRole === 'Payroll') {
      return
    }

    try {
      begin({
        title: 'Menghapus pembayaran pinjaman',
        message: 'Mohon tunggu sampai pembayaran hilang dari daftar.',
      })

      setRecordError(null)
      await deleteLoanPayment({
        paymentId: payment.id,
        teamId: currentTeamId ?? loanDetail?.team_id ?? transaction?.team_id,
        expectedUpdatedAt: payment.updatedAt ?? payment.updated_at ?? null,
      })
      setDetailRefreshKey((currentValue) => currentValue + 1)
      succeed({
        title: 'Pembayaran pinjaman dihapus',
        message: 'Pembayaran berhasil dihapus.',
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gagal menghapus pembayaran pinjaman.'

      fail({
        title: 'Pembayaran pinjaman gagal dihapus',
        message,
      })
    }
  }

  const handleStartAttachmentEdit = (attachment) => {
    const fileAsset = getAttachmentFileAsset(attachment)

    if (!attachment?.id || !fileAsset?.id) {
      return
    }

    setEditingAttachmentId(attachment.id)
    setEditingAttachmentName(fileAsset.file_name ?? fileAsset.original_name ?? '')
    setAttachmentError(null)
  }

  const handleCancelAttachmentEdit = () => {
    setEditingAttachmentId(null)
    setEditingAttachmentName('')
  }

  const handleSaveAttachmentEdit = async (attachment) => {
    const fileAsset = getAttachmentFileAsset(attachment)

    if (!attachment?.id || !fileAsset?.id || !editingAttachmentName.trim()) {
      return
    }

    try {
      begin({
        title: 'Menyimpan metadata lampiran',
        message: 'Mohon tunggu sampai nama file tersimpan.',
      })

      setAttachmentError(null)
      await updateFileAssetMetadata(fileAsset.id, {
        file_name: editingAttachmentName.trim(),
        original_name: editingAttachmentName.trim(),
      })
      setEditingAttachmentId(null)
      setEditingAttachmentName('')
      setDetailRefreshKey((currentValue) => currentValue + 1)
      succeed({
        title: 'Metadata lampiran tersimpan',
        message: 'Nama file lampiran berhasil diperbarui.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memperbarui lampiran.'

      fail({
        title: 'Metadata lampiran gagal diperbarui',
        message,
      })
    }
  }

  const handleDeleteAttachment = async (attachment) => {
    if (!attachment?.id || currentRole === 'Viewer' || currentRole === 'Payroll') {
      return
    }

    try {
      begin({
        title: 'Menghapus lampiran',
        message: 'Mohon tunggu sampai lampiran hilang dari daftar.',
      })

      setAttachmentError(null)
      await softDeleteExpenseAttachment(attachment.id, currentTeamId ?? transaction?.team_id)
      setDetailRefreshKey((currentValue) => currentValue + 1)
      succeed({
        title: 'Lampiran dihapus',
        message: 'Lampiran berhasil dihapus.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal menghapus lampiran.'

      fail({
        title: 'Lampiran gagal dihapus',
        message,
      })
    }
  }

  const handleOpenAttachment = (attachment) => {
    const fileAsset = getAttachmentFileAsset(attachment)

    if (!fileAsset?.public_url) {
      return
    }

    window.open(fileAsset.public_url, '_blank', 'noopener,noreferrer')
  }

  if (technicalView) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Owner"
          title={`Detail Teknis ${detailTitle}`}
          backAction={() => navigate(backRoute)}
        />

        {recordError ? (
          <AppCardDashed className="text-sm leading-6 text-[var(--app-hint-color)]">
            {recordError}
          </AppCardDashed>
        ) : null}

        <AppCardStrong className="space-y-4">
          <AppTechnicalGrid items={technicalRows} />
        </AppCardStrong>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={technicalView ? 'Owner' : detailEyebrow}
        title={technicalView ? `Detail Teknis ${detailTitle}` : detailHeaderTitle}
        backAction={() => navigate(backRoute)}
        action={
          !technicalView && isOwner ? (
            <AppButton
              onClick={() => navigate(technicalRoute)}
              size="sm"
              type="button"
              variant="secondary"
            >
              Detail Teknis
            </AppButton>
          ) : null
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

      {showDetailTabs ? (
        <AppCardStrong className="p-1">
          <div
            className="grid gap-2 rounded-[24px] border border-[var(--app-border-color)] bg-[var(--app-surface-low-color)] p-1"
            style={{
              gridTemplateColumns: `repeat(${availableDetailTabs.length}, minmax(0, 1fr))`,
            }}
          >
            {availableDetailTabs.map((tab) => {
              const isActive = resolvedDetailTab === tab.value

              return (
                <AppButton
                  key={tab.value}
                  aria-pressed={isActive}
                  className="w-full rounded-[20px]"
                  onClick={() => setActiveDetailTab(tab.value)}
                  size="sm"
                  type="button"
                  variant={isActive ? 'primary' : 'secondary'}
                >
                  {tab.label}
                </AppButton>
              )
            })}
          </div>
        </AppCardStrong>
      ) : null}

      {resolvedDetailTab === 'info' ? (
        <>
      <AppCardStrong className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)]">
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                {getTransactionTitle(transaction)}
              </p>
              <p className="mt-1 text-sm leading-6 text-[var(--app-hint-color)]">
                {getTransactionSourceLabel(transaction)}
              </p>
            </div>
            {!isAttendanceRecord ? <span className="app-chip shrink-0">{attendanceDateTime}</span> : null}
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

        {!hideTransactionAmount ? (
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
        ) : null}
      </AppCardStrong>

      {billSnapshot && !isAttendanceRecord ? (
        hideTransactionAmount ? (
          <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
            <p className="app-meta">{isPayrollBill ? 'Status Tagihan Upah' : 'Status Tagihan'}</p>
            <p className="text-sm font-semibold text-[var(--app-text-color)]">
              {isPayrollBill ? payrollSettlementLabel : billSnapshot.status ?? '-'}
            </p>
          </AppCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
              <p className="app-meta">{isPayrollBill ? 'Status Tagihan Upah' : 'Status Tagihan'}</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {isPayrollBill
                  ? payrollSettlementLabel
                  : billSnapshot.status ?? '-'}
              </p>
            </AppCard>
            <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
              <p className="app-meta">{isPayrollBill ? 'Nominal Tagihan Upah' : 'Nominal Tagihan'}</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {formatCurrency(billSnapshot.amount ?? 0)}
              </p>
            </AppCard>
            <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
              <p className="app-meta">{isPayrollBill ? 'Sisa Tagihan Upah' : 'Sisa Tagihan'}</p>
              <p className="text-sm font-semibold text-[var(--app-text-color)]">
                {formatCurrency(billSnapshot.remainingAmount ?? billSnapshot.remaining_amount ?? 0)}
              </p>
            </AppCard>
          </div>
        )
      ) : null}

      {billSnapshot && isAttendanceRecord ? (
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
              <p className="app-meta">Pinjaman</p>
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
            {formatAppDateLabel(loanSnapshot.due_date ?? loanSnapshot.dueDate)}
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

        </>
      ) : null}

      {resolvedDetailTab === 'invoice' ? (
        <MaterialInvoiceDetailPanel
          billDetail={billDetail}
          error={materialInvoiceError}
          invoice={materialInvoiceDetail}
          isLoading={isLoadingRecord && !materialInvoiceDetail}
        />
      ) : null}

      {resolvedDetailTab === 'history' ? (
        <AppCard className="space-y-3 bg-[var(--app-surface-strong-color)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-meta">Histori Pembayaran</p>
              <h3 className="app-section-title">
                {isLoanDisbursement ? 'Riwayat Dana Masuk / Pinjaman' : 'Riwayat Tagihan'}
              </h3>
            </div>
            <span className="app-chip">{activePaymentHistory.length} item</span>
          </div>

          {isLoadingRecord ? (
            <div className="app-card-dashed px-4 py-5 text-sm text-[var(--app-hint-color)]">
              Memuat riwayat pembayaran...
            </div>
          ) : activePaymentHistory.length > 0 ? (
            <div className="space-y-2">
              {activePaymentHistory.map((payment) => {
                const isLoanHistory = isLoanDisbursement
                const paymentDateLabel = formatTransactionTimestamp(payment, [
                  'createdAt',
                  'paymentDate',
                  'created_at',
                  'payment_date',
                ])
                const canManagePaymentHistory = currentRole !== 'Viewer' && currentRole !== 'Payroll'

                return (
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
                          {paymentDateLabel}
                        </p>
                        {hasMeaningfulText(payment.notes) ? (
                          <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                            {formatValue(payment.notes)}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <AppButton
                          aria-label="Unduh kwitansi"
                          iconOnly
                          onClick={() => handleDownloadPaymentReceipt(payment)}
                          size="sm"
                          type="button"
                          variant="secondary"
                          leadingIcon={<Download className="h-4 w-4" />}
                        />
                        {canManagePaymentHistory ? (
                          <AppButton
                            aria-label={isLoanHistory ? 'Hapus pembayaran pinjaman' : 'Hapus pembayaran tagihan'}
                            iconOnly
                            onClick={() =>
                              isLoanHistory
                                ? void handleDeleteLoanPayment(payment)
                                : void handleDeleteBillPayment(payment)
                            }
                            size="sm"
                            type="button"
                            variant="danger"
                            leadingIcon={<Trash2 className="h-4 w-4" />}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="app-card-dashed px-4 py-5 text-sm text-[var(--app-hint-color)]">
              Belum ada pembayaran untuk transaksi ini.
            </div>
          )}
        </AppCard>
      ) : null}

      {resolvedDetailTab === 'attachments' ? (
        <AppCard className="space-y-3 bg-[var(--app-surface-strong-color)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="app-meta">Lampiran</p>
              <h3 className="app-section-title">{attachmentTitle}</h3>
            </div>
            <span className="app-chip">{expenseAttachments.length} item</span>
          </div>

          {attachmentError ? (
            <AppCardDashed className="px-4 py-5 text-sm text-[var(--app-hint-color)]">
              {attachmentError}
            </AppCardDashed>
          ) : null}

          {isLoadingAttachments ? (
            <div className="app-card-dashed px-4 py-5 text-sm text-[var(--app-hint-color)]">
              Memuat lampiran...
            </div>
          ) : expenseAttachments.length > 0 ? (
            <div className="space-y-3">
              {expenseAttachments.map((attachment) => {
                const fileAsset = getAttachmentFileAsset(attachment)
                const isEditingAttachment = editingAttachmentId === attachment.id
                const canEditAttachment = currentRole !== 'Viewer' && currentRole !== 'Payroll' && canPerformAttachmentAction(currentRole, 'editMetadata')
                const canDeleteAttachment = currentRole !== 'Viewer' && currentRole !== 'Payroll' && canPerformAttachmentAction(currentRole, 'delete')

                return (
                  <AppCard
                    key={attachment.id}
                    className="space-y-3 bg-[var(--app-surface-low-color)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {isEditingAttachment ? (
                          <label className="block space-y-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                              Nama File
                            </span>
                            <AppInput
                              className="w-full rounded-[20px] px-4 py-3 text-base"
                              onChange={(event) => setEditingAttachmentName(event.target.value)}
                              value={editingAttachmentName}
                            />
                          </label>
                        ) : (
                          <>
                            <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                              {getAttachmentFileName(attachment)}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                              {[
                                fileAsset?.mime_type,
                                formatFileSize(fileAsset?.size_bytes ?? fileAsset?.file_size),
                              ]
                                .filter(Boolean)
                                .join(' • ')}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <AppButton
                          aria-label="Buka lampiran"
                          iconOnly
                          onClick={() => handleOpenAttachment(attachment)}
                          size="sm"
                          type="button"
                          variant="secondary"
                          leadingIcon={<Eye className="h-4 w-4" />}
                          disabled={!fileAsset?.public_url}
                        />
                        {isEditingAttachment ? (
                          <>
                            <AppButton
                              aria-label="Simpan perubahan lampiran"
                              iconOnly
                              onClick={() => void handleSaveAttachmentEdit(attachment)}
                              size="sm"
                              type="button"
                              variant="primary"
                              leadingIcon={<Check className="h-4 w-4" />}
                            />
                            <AppButton
                              aria-label="Batal ubah lampiran"
                              iconOnly
                              onClick={handleCancelAttachmentEdit}
                              size="sm"
                              type="button"
                              variant="secondary"
                              leadingIcon={<X className="h-4 w-4" />}
                            />
                          </>
                        ) : null}
                        {!isEditingAttachment && canEditAttachment ? (
                          <AppButton
                            aria-label="Ganti lampiran"
                            iconOnly
                            onClick={() => handleStartAttachmentEdit(attachment)}
                            size="sm"
                            type="button"
                            variant="secondary"
                            leadingIcon={<PencilLine className="h-4 w-4" />}
                          />
                        ) : null}
                        {!isEditingAttachment && canDeleteAttachment ? (
                          <AppButton
                            aria-label="Hapus lampiran"
                            iconOnly
                            onClick={() => void handleDeleteAttachment(attachment)}
                            size="sm"
                            type="button"
                            variant="danger"
                            leadingIcon={<Trash2 className="h-4 w-4" />}
                          />
                        ) : null}
                      </div>
                    </div>

                    {isAttachmentImage(attachment) ? (
                      <button
                        className="block w-full overflow-hidden rounded-[20px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)]"
                        onClick={() => handleOpenAttachment(attachment)}
                        type="button"
                      >
                        <img
                          alt={getAttachmentFileName(attachment)}
                          className="h-44 w-full object-cover"
                          src={fileAsset.public_url}
                        />
                      </button>
                    ) : fileAsset?.public_url ? (
                      <div className="rounded-[20px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 py-5 text-sm text-[var(--app-hint-color)]">
                        Pratinjau file tersedia melalui tombol buka.
                      </div>
                    ) : null}
                  </AppCard>
                )
              })}
            </div>
          ) : (
            <div className="app-card-dashed px-4 py-5 text-sm text-[var(--app-hint-color)]">
              Belum ada lampiran untuk transaksi ini.
            </div>
          )}
        </AppCard>
      ) : null}

      {resolvedDetailTab === 'info' && (canEdit || canDelete) ? (
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
      <TransactionDeleteDialog
        confirmLabel="Hapus Transaksi"
        description={getTransactionSourceLabel(transaction)}
        historyRoute={hasPaymentHistory ? deleteDialogHistoryRoute : null}
        isConfirming={isDeleting}
        open={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false)
          setDeleteDialogHistoryRoute(null)
        }}
        onConfirm={performDelete}
        onOpenHistory={(route) => {
          setIsDeleteDialogOpen(false)
          setDeleteDialogHistoryRoute(null)

          if (!route) {
            return
          }

          navigate(route, {
            state: {
              transaction,
              detailSurface: 'riwayat',
            },
          })
        }}
        title={
          hasPaymentHistory
            ? 'Transaksi sudah memiliki pembayaran'
            : `Konfirmasi Hapus ${getTransactionTitle(transaction)}`
        }
        warning={
          hasPaymentHistory
            ? 'Transaksi ini sudah memiliki pembayaran. Buka riwayat tagihan untuk meninjau pembayaran sebelum memutuskan langkah berikutnya.'
            : 'Transaksi akan dipindahkan ke arsip dan dapat dipulihkan dari halaman recycle bin.'
        }
      />
    </PageShell>
  )
}

export default TransactionDetailPage
