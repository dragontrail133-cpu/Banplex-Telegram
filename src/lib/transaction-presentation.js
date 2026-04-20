import {
  formatAppDateTime,
  formatAppSyncLabel,
  getAppSectionLabel,
  getAppTodayKey,
  toAppDateKey,
} from './date-time'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function formatCompactIdentifier(value) {
  const normalizedValue = normalizeText(value)

  if (!normalizedValue) {
    return ''
  }

  if (normalizedValue.length <= 12) {
    return normalizedValue
  }

  return `${normalizedValue.slice(0, 8)}…${normalizedValue.slice(-4)}`
}

function formatBillStatusLabel(status) {
  const normalizedStatus = normalizeText(status).toLowerCase()

  if (normalizedStatus === 'paid') {
    return 'Lunas'
  }

  if (normalizedStatus === 'partial') {
    return 'Sebagian'
  }

  if (normalizedStatus === 'overdue') {
    return 'Terlambat'
  }

  if (normalizedStatus === 'delivery_order') {
    return 'Surat jalan'
  }

  return 'Belum lunas'
}

function normalizeBillStatus(transaction) {
  return normalizeText(
    transaction?.status ??
      transaction?.bill?.status ??
      transaction?.salaryBill?.status ??
      transaction?.bill_status,
    ''
  ).toLowerCase()
}

function getBillType(transaction) {
  return normalizeText(
    transaction?.billType ??
      transaction?.bill?.billType ??
      transaction?.bill_type ??
      transaction?.salaryBill?.billType ??
      transaction?.salaryBill?.bill_type,
    ''
  ).toLowerCase()
}

function isPayrollBill(transaction) {
  return getBillType(transaction) === 'gaji'
}

function formatLoanSettlementLabel(status) {
  const normalizedStatus = normalizeText(status).toLowerCase()

  if (normalizedStatus === 'paid') {
    return 'Lunas'
  }

  if (normalizedStatus === 'partial') {
    return 'Sebagian lunas'
  }

  if (normalizedStatus === 'unpaid') {
    return 'Belum lunas'
  }

  return 'Belum lunas'
}

export function formatPayrollSettlementLabel(status) {
  const normalizedStatus = normalizeText(status).toLowerCase()

  if (normalizedStatus === 'paid') {
    return 'Lunas'
  }

  if (normalizedStatus === 'partial') {
    return 'Sebagian lunas'
  }

  return 'Belum lunas'
}

export function formatCurrency(value) {
  return currencyFormatter.format(toNumber(value))
}

export function formatSyncLabel(value) {
  return formatAppSyncLabel(value)
}

export function formatTransactionDateTime(value) {
  return formatAppDateTime(value)
}

export function getTodayKey() {
  return getAppTodayKey()
}

export function toDateKey(value) {
  return toAppDateKey(value)
}

export function getSectionLabel(dateKey, referenceTodayKey) {
  return getAppSectionLabel(dateKey, referenceTodayKey)
}

export function getTransactionTypeLabel(transaction) {
  if (transaction?.sourceType === 'project-income') {
    return 'Termin Proyek'
  }

  if (transaction?.sourceType === 'loan-disbursement') {
    return 'Dana Masuk / Pinjaman'
  }

  if (transaction?.sourceType === 'expense') {
    const documentType = normalizeText(transaction?.document_type).toLowerCase()
    const expenseType = normalizeText(transaction?.expense_type).toLowerCase()

    if (documentType === 'surat_jalan') {
      return 'Surat Jalan'
    }

    if (expenseType === 'material' || expenseType === 'material_invoice') {
      return 'Faktur Material'
    }

    return 'Pengeluaran'
  }

  if (transaction?.sourceType === 'loan') {
    return 'Dana Masuk / Pinjaman'
  }

  if (transaction?.sourceType === 'bill') {
    return isPayrollBill(transaction) ? 'Tagihan Upah' : 'Tagihan'
  }

  if (transaction?.sourceType === 'attendance-record') {
    return 'Catatan Absensi'
  }

  if (transaction?.sourceType === 'loan-payment') {
    return 'Bayar Pinjaman'
  }

  return 'Bayar Tagihan'
}

export function getTransactionSourceLabel(transaction) {
  if (transaction?.sourceType === 'project-income') {
    return normalizeText(transaction?.project_name, 'Proyek')
  }

  if (transaction?.sourceType === 'loan-disbursement') {
    return normalizeText(transaction?.party_label, 'Kreditor')
  }

  if (transaction?.sourceType === 'expense') {
    return normalizeText(
      transaction?.supplier_name ??
        transaction?.supplier_name_snapshot ??
        transaction?.project_name ??
        transaction?.project_name_snapshot,
      'Pengeluaran'
    )
  }

  if (transaction?.sourceType === 'bill') {
    return normalizeText(
      isPayrollBill(transaction)
        ? transaction?.party_label ?? transaction?.worker_name_snapshot ?? transaction?.project_name
        : transaction?.project_name ?? transaction?.party_label,
      isPayrollBill(transaction) ? 'Tagihan Upah' : 'Tagihan'
    )
  }

  if (transaction?.sourceType === 'attendance-record') {
    return normalizeText(
      transaction?.project_name ?? transaction?.party_label,
      'Workspace Absensi'
    )
  }

  if (transaction?.sourceType === 'loan-payment') {
    return normalizeText(transaction?.party_label, 'Pembayaran pinjaman')
  }

  return normalizeText(transaction?.party_label ?? transaction?.project_name, 'Pembayaran')
}

export function getTransactionCreatorLabel(transaction) {
  const creatorId = normalizeText(
    transaction?.created_by_user_id ??
      transaction?.createdByUserId ??
      transaction?.telegram_user_id ??
      transaction?.telegramUserId ??
      transaction?.created_by ??
      null,
    ''
  )

  if (!creatorId) {
    return 'Sistem'
  }

  return `Oleh ${formatCompactIdentifier(creatorId)}`
}

export function getTransactionTitle(transaction) {
  return normalizeText(transaction?.description, getTransactionTypeLabel(transaction))
}

export function getTransactionLedgerSummary(transaction) {
  const ledgerSummary = transaction?.ledger_summary ?? transaction?.ledgerSummary ?? null

  if (ledgerSummary) {
    const summaryLabel = normalizeText(ledgerSummary.label)
    const statusLabel = normalizeText(formatBillStatusLabel(ledgerSummary.status))
    const remainingAmount = toNumber(ledgerSummary.remainingAmount ?? ledgerSummary.remaining_amount)

    return [
      summaryLabel,
      statusLabel,
      remainingAmount > 0 ? `Sisa ${formatCurrency(remainingAmount)}` : null,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  if (transaction?.sourceType === 'project-income' && transaction?.bill) {
    return [
      'Fee bill',
      isPayrollBill(transaction)
        ? formatPayrollSettlementLabel(transaction.bill.status)
        : formatBillStatusLabel(transaction.bill.status),
      `Sisa ${formatCurrency(transaction.bill.remainingAmount ?? transaction.bill.remaining_amount)}`,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  if (transaction?.sourceType === 'expense' && transaction?.bill) {
    const billStatus = normalizeBillStatus(transaction)
    const isOpenBill = billStatus === 'unpaid' || billStatus === 'partial'
    const baseLabel = getTransactionTypeLabel(transaction)

    return [
      isOpenBill ? `Tagihan ${baseLabel}` : baseLabel,
      formatBillStatusLabel(transaction.bill.status),
      `Sisa ${formatCurrency(transaction.bill.remainingAmount ?? transaction.bill.remaining_amount)}`,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  if (transaction?.sourceType === 'bill' && transaction?.bill) {
    return [
      isPayrollBill(transaction) ? 'Tagihan Upah' : 'Tagihan',
      formatBillStatusLabel(transaction.bill.status),
      `Sisa ${formatCurrency(transaction.bill.remainingAmount ?? transaction.bill.remaining_amount)}`,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  if (transaction?.sourceType === 'attendance-record' && transaction?.salaryBill) {
    return [
      'Tagihan Upah',
      formatPayrollSettlementLabel(transaction.salaryBill.status),
      `Sisa ${formatCurrency(
        transaction.salaryBill.remainingAmount ?? transaction.salaryBill.remaining_amount
      )}`,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  if (transaction?.sourceType === 'loan-disbursement') {
    const remainingAmount = toNumber(
      transaction?.remainingAmount ?? transaction?.remaining_amount ?? transaction?.paid_amount
    )
    const settlementLabel = formatLoanSettlementLabel(transaction?.status ?? transaction?.loan_status)
    const lateChargeSummary =
      transaction?.late_charge_summary ?? transaction?.lateChargeSummary ?? null
    const lateChargeAmount = toNumber(
      lateChargeSummary?.totalLateChargeAmount ??
        lateChargeSummary?.total_late_charge_amount ??
        transaction?.ledger_summary?.lateChargeAmount ??
        transaction?.ledger_summary?.late_charge_amount
    )
    const parts = []

    if (remainingAmount > 0) {
      parts.push(`Sisa pengembalian ${formatCurrency(remainingAmount)}`)
    }

    parts.unshift(settlementLabel)

    if (lateChargeAmount > 0) {
      parts.push(`Denda ${formatCurrency(lateChargeAmount)}`)
    }

    if (parts.length > 0) {
      return parts.join(' · ')
    }
  }

  return ''
}

export function getTransactionPaymentRoute(transaction) {
  if (!transaction) {
    return null
  }

  if (transaction?.sourceType === 'loan-disbursement') {
    return `/pembayaran/pinjaman/${transaction.id}`
  }

  const billId =
    transaction?.bill?.id ??
    transaction?.salaryBill?.id ??
    (transaction?.sourceType === 'bill' ? transaction.id : null)

  if (!billId) {
    return null
  }

  if (normalizeBillStatus(transaction) === 'paid') {
    return null
  }

  return `/pembayaran/tagihan/${billId}`
}

export function canOpenTransactionPayment(transaction) {
  return Boolean(getTransactionPaymentRoute(transaction))
}

export function getTransactionPaymentLabel(transaction) {
  if (transaction?.sourceType === 'loan-disbursement') {
    return 'Bayar Pinjaman'
  }

  if (transaction?.salaryBill?.id || transaction?.sourceType === 'attendance-record') {
    return 'Bayar Tagihan Upah'
  }

  if (transaction?.sourceType === 'bill' && isPayrollBill(transaction)) {
    return 'Bayar Tagihan Upah'
  }

  return 'Bayar Tagihan'
}

export function getTransactionEditRoute(transaction) {
  if (transaction?.sourceType === 'project-income') {
    return `/edit/project-income/${transaction.id}`
  }

  if (transaction?.sourceType === 'loan-disbursement') {
    return `/edit/loan/${transaction.id}`
  }

  if (transaction?.sourceType === 'expense') {
    return `/edit/expense/${transaction.id}`
  }

  if (transaction?.sourceType === 'attendance-record') {
    return `/edit/attendance/${transaction.id}`
  }

  return null
}

export function canDeleteTransaction(transaction) {
  if (typeof transaction?.canDelete === 'boolean') {
    return transaction.canDelete
  }

  const sourceType = normalizeText(transaction?.sourceType)

  if (sourceType === 'attendance-record') {
    return normalizeText(transaction?.billing_status, 'unbilled') !== 'billed'
  }

  if (sourceType === 'expense') {
    const billPaidAmount = Number(
      transaction?.bill?.paidAmount ?? transaction?.bill?.paid_amount ?? 0
    )

    return billPaidAmount <= 0
  }

  return ['project-income', 'loan-disbursement', 'loan'].includes(sourceType)
}

export function canEditTransaction(transaction) {
  if (typeof transaction?.canEdit === 'boolean') {
    return transaction.canEdit
  }

  return Boolean(getTransactionEditRoute(transaction))
}

export function getTransactionLedgerFilterOptions() {
  return [
    { value: 'all', label: 'Semua Catatan' },
    { value: 'project-income', label: 'Termin Proyek' },
    { value: 'loan-disbursement', label: 'Dana Masuk / Pinjaman' },
    { value: 'expense', label: 'Pengeluaran' },
    { value: 'bill', label: 'Tagihan' },
    { value: 'material-invoice', label: 'Faktur Material' },
    { value: 'surat-jalan', label: 'Surat Jalan' },
  ]
}

export function matchesTransactionLedgerFilter(transaction, filterValue) {
  const normalizedFilter = normalizeText(filterValue, 'all')
  const sourceType = normalizeText(transaction?.sourceType)
  const documentType = normalizeText(transaction?.document_type).toLowerCase()
  const expenseType = normalizeText(transaction?.expense_type).toLowerCase()

  if (normalizedFilter === 'all') {
    return true
  }

  if (normalizedFilter === 'expense') {
    return sourceType === 'expense' && expenseType !== 'material' && expenseType !== 'material_invoice' && documentType !== 'surat_jalan'
  }

  if (normalizedFilter === 'bill') {
    return sourceType === 'bill'
  }

  if (normalizedFilter === 'material-invoice') {
    return sourceType === 'expense' && (expenseType === 'material' || expenseType === 'material_invoice')
  }

  if (normalizedFilter === 'surat-jalan') {
    return sourceType === 'expense' && documentType === 'surat_jalan'
  }

  return sourceType === normalizedFilter
}
