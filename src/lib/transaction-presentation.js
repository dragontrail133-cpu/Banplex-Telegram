import {
  formatAppDateLabel,
  formatAppDateTime,
  formatAppSyncLabel,
  getAppSectionLabel,
  getAppTodayKey,
  toAppDateKey,
} from './date-time.js'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function getTransactionSourceType(transaction) {
  return normalizeText(transaction?.sourceType ?? transaction?.source_type, '').toLowerCase()
}

function getTransactionDocumentType(transaction) {
  return normalizeText(transaction?.document_type ?? transaction?.documentType, '').toLowerCase()
}

function getTransactionExpenseType(transaction) {
  return normalizeText(transaction?.expense_type ?? transaction?.expenseType, '').toLowerCase()
}

export function hasMeaningfulText(value) {
  return normalizeText(value, '').length > 0
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function readTimestampField(transaction, fieldName) {
  if (!transaction || !fieldName) {
    return null
  }

  const camelField = fieldName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

  return transaction?.[fieldName] ?? transaction?.[camelField] ?? null
}

export function getTransactionTimestamp(transaction, preferredFields = []) {
  const fallbackFields = [
    'deleted_at',
    'created_at',
    'updated_at',
    'payment_date',
    'expense_date',
    'income_date',
    'transaction_date',
  ]
  const candidateFields = [...preferredFields, ...fallbackFields]
  const seenFields = new Set()

  for (const fieldName of candidateFields) {
    if (seenFields.has(fieldName)) {
      continue
    }

    seenFields.add(fieldName)

    const value = readTimestampField(transaction, fieldName)
    const normalizedValue = normalizeText(value, '')

    if (normalizedValue) {
      return normalizedValue
    }
  }

  return ''
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

function formatCreatorDisplayNameFromMetadata(metadata = null, fallbackTelegramUserId = null) {
  const firstName = normalizeText(metadata?.first_name ?? metadata?.firstName, '')
  const lastName = normalizeText(metadata?.last_name ?? metadata?.lastName, '')
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim()

  if (fullName) {
    return fullName
  }

  const explicitName = normalizeText(
    metadata?.full_name ??
      metadata?.fullName ??
      metadata?.display_name ??
      metadata?.displayName ??
      metadata?.name ??
      '',
    ''
  )

  if (explicitName) {
    return explicitName
  }

  const username = normalizeText(metadata?.username ?? metadata?.user_name ?? '', '')

  if (username) {
    return username.startsWith('@') ? username : `@${username}`
  }

  const normalizedFallbackTelegramUserId = normalizeText(fallbackTelegramUserId, '')

  if (normalizedFallbackTelegramUserId) {
    return `User ${formatCompactIdentifier(normalizedFallbackTelegramUserId)}`
  }

  return 'Sistem'
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
  const childBillStatus =
    transaction?.bill?.status ??
    transaction?.salaryBill?.status ??
    transaction?.bill_status ??
    transaction?.salary_bill?.status ??
    null

  return normalizeText(childBillStatus ?? transaction?.status, '').toLowerCase()
}

export function isDeliveryOrderTransaction(transaction) {
  const documentType = getTransactionDocumentType(transaction)

  return documentType === 'surat_jalan'
}

export function shouldHideTransactionAmount(transaction) {
  return isDeliveryOrderTransaction(transaction)
}

function inferLoanSettlementStatus(transaction) {
  const remainingAmount = toNumber(
    transaction?.remainingAmount ??
      transaction?.remaining_amount ??
      transaction?.bill_remaining_amount ??
      transaction?.loan?.remainingAmount ??
      transaction?.loan?.remaining_amount
  )
  const paidAmount = toNumber(
    transaction?.paid_amount ??
      transaction?.bill_paid_amount ??
      transaction?.loan?.paid_amount ??
      transaction?.loan?.paidAmount ??
      0
  )
  const targetAmount = toNumber(
    transaction?.repayment_amount ??
      transaction?.base_repayment_amount ??
      transaction?.bill_amount ??
      transaction?.loan?.repayment_amount ??
      transaction?.loan?.base_repayment_amount ??
      transaction?.amount
  )

  if (targetAmount <= 0) {
    return null
  }

  if (remainingAmount <= 0 && paidAmount >= targetAmount) {
    return 'paid'
  }

  if (paidAmount > 0 && remainingAmount > 0) {
    return 'partial'
  }

  return 'unpaid'
}

function normalizeTransactionSettlementStatus(transaction) {
  const sourceType = normalizeText(transaction?.sourceType).toLowerCase()
  const candidateStatuses = [
    transaction?.ledger_summary?.status,
    transaction?.ledgerSummary?.status,
    transaction?.bill?.status,
    transaction?.bill_status,
    transaction?.salaryBill?.status,
    transaction?.salary_bill?.status,
    transaction?.loan?.status,
    transaction?.loan_status,
  ]

  if (
    ['expense', 'project-income', 'bill', 'loan-disbursement', 'loan', 'attendance-record'].includes(
      sourceType
    )
  ) {
    candidateStatuses.push(transaction?.status)
  }

  for (const status of candidateStatuses) {
    const normalizedStatus = normalizeText(status, '').toLowerCase()

    if (['paid', 'partial', 'unpaid', 'overdue'].includes(normalizedStatus)) {
      return normalizedStatus
    }
  }

  if (['loan-disbursement', 'loan'].includes(sourceType)) {
    return inferLoanSettlementStatus(transaction)
  }

  return null
}

export function getTransactionSettlementBadgeLabel(transaction) {
  const status = normalizeTransactionSettlementStatus(transaction)

  if (status === 'paid') {
    return 'Lunas'
  }

  if (status === 'partial') {
    return 'Dicicil'
  }

  if (status === 'unpaid' || status === 'overdue') {
    return 'Belum'
  }

  return null
}

export function isPaidBillTransaction(transaction) {
  const sourceType = getTransactionSourceType(transaction)

  if (sourceType !== 'bill') {
    return false
  }

  return normalizeBillStatus(transaction) === 'paid'
}

function getBillType(transaction) {
  return normalizeText(
    transaction?.billType ??
      transaction?.bill?.billType ??
      transaction?.bill_type ??
      transaction?.salaryBill?.billType ??
      transaction?.salaryBill?.bill_type ??
      transaction?.bill_type ??
      transaction?.salary_bill?.bill_type,
    ''
  ).toLowerCase()
}

function isPayrollBill(transaction) {
  return getBillType(transaction) === 'gaji'
}

export function isPayrollBillTransaction(transaction) {
  return getTransactionSourceType(transaction) === 'bill' && isPayrollBill(transaction)
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

export function formatTransactionTimestamp(transaction, preferredFields = []) {
  const timestamp = getTransactionTimestamp(transaction, preferredFields)

  return timestamp ? formatAppDateTime(timestamp) : 'tanggal belum tersedia'
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
    return 'Pinjaman'
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
    return 'Pinjaman'
  }

  if (transaction?.sourceType === 'bill') {
    return isPayrollBill(transaction) ? 'Gaji/Upah' : 'Tagihan'
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
      isPayrollBill(transaction) ? 'Gaji/Upah' : 'Tagihan'
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

export function getTransactionContextLabel(transaction) {
  if (!transaction) {
    return ''
  }

  const sourceType = normalizeText(transaction?.sourceType)

  if (sourceType === 'project-income') {
    return normalizeText(transaction?.project_name ?? transaction?.project_name_snapshot, 'Proyek')
  }

  if (sourceType === 'loan-disbursement' || sourceType === 'loan-payment') {
    return normalizeText(
      transaction?.party_label ??
        transaction?.party_name ??
        transaction?.creditor_name ??
        transaction?.creditor_name_snapshot,
      'Kreditor'
    )
  }

  if (sourceType === 'expense') {
    return normalizeText(
      transaction?.supplier_name ??
        transaction?.supplier_name_snapshot ??
        transaction?.project_name ??
        transaction?.project_name_snapshot,
      'Supplier'
    )
  }

  if (sourceType === 'bill' || sourceType === 'attendance-record') {
    return normalizeText(
      transaction?.worker_name ??
        transaction?.worker_name_snapshot ??
        transaction?.party_label ??
        transaction?.project_name ??
        transaction?.project_name_snapshot,
      'Pekerja'
    )
  }

  return normalizeText(
    transaction?.worker_name ??
      transaction?.worker_name_snapshot ??
      transaction?.supplier_name ??
      transaction?.supplier_name_snapshot ??
      transaction?.party_label ??
      transaction?.party_name ??
      transaction?.project_name ??
      transaction?.project_name_snapshot,
    ''
  )
}

function getBillSummaryType(bill) {
  return normalizeText(bill?.billType ?? bill?.bill_type, '').toLowerCase()
}

function getBillSummaryWorkerName(bill) {
  return normalizeText(
    bill?.workerName ??
      bill?.worker_name ??
      bill?.worker_name_snapshot ??
      bill?.supplierName ??
      bill?.description ??
      '',
    'Pekerja'
  )
}

function getBillSummaryGroupKey(bill) {
  return normalizeText(
    bill?.workerId ??
      bill?.worker_id ??
      bill?.workerName ??
      bill?.worker_name ??
      bill?.worker_name_snapshot ??
      bill?.supplierName ??
      '',
    ''
  ).toLowerCase()
}

export function isPayrollBillSummary(bill) {
  return getBillSummaryType(bill) === 'gaji'
}

function isFeeBillSummary(bill) {
  return getBillSummaryType(bill) === 'fee'
}

function getFeeBillSummaryGroupKey(bill) {
  return normalizeText(
    bill?.staffId ??
      bill?.staff_id ??
      bill?.workerId ??
      bill?.worker_id ??
      bill?.workerName ??
      bill?.worker_name ??
      bill?.worker_name_snapshot ??
      '',
    ''
  ).toLowerCase()
}

export function getBillSummaryTitle(bill) {
  return normalizeText(
    bill?.description ?? bill?.billTitle ?? bill?.title ?? bill?.worker_name_snapshot ?? '',
    'Tagihan'
  )
}

export function getBillSummarySubtitle(bill) {
  const label = normalizeText(
    bill?.projectName ??
      bill?.project_name ??
      bill?.project_name_snapshot ??
      '',
    ''
  )

  if (label) {
    return label
  }

  const dateLabel = formatAppDateLabel(bill?.dueDate ?? bill?.due_date ?? bill?.created_at ?? '')

  return dateLabel || 'Tanggal belum tersedia'
}

export function getBillSummaryAmount(bill) {
  return toNumber(bill?.remainingAmount ?? bill?.remaining_amount ?? bill?.amount ?? 0)
}

export function getBillSummaryWorkerLabel(bill) {
  return getBillSummaryWorkerName(bill)
}

function getBillTotalAmount(bill) {
  return toNumber(bill?.amount ?? bill?.total_amount ?? bill?.totalAmount ?? 0)
}

function getBillPaymentRows(bill) {
  return Array.isArray(bill?.payments) ? bill.payments : []
}

function getBillPaidAmount(bill) {
  const explicitPaidAmount = toNumber(bill?.paidAmount ?? bill?.paid_amount ?? bill?.paid)

  if (explicitPaidAmount > 0) {
    return explicitPaidAmount
  }

  const paymentRows = getBillPaymentRows(bill)

  if (paymentRows.length > 0) {
    return paymentRows.reduce((sum, payment) => sum + toNumber(payment?.amount), 0)
  }

  return Math.max(getBillTotalAmount(bill) - getBillSummaryAmount(bill), 0)
}

function getPayrollGroupUnbilledAmount(group) {
  return toNumber(
    group?.unbilledAmount ??
      group?.unbilled_amount ??
      group?.unbilledTotal ??
      group?.unbilled_total ??
      group?.unbilledPay ??
      group?.unbilled_pay ??
      0
  )
}

function getBillPriorityTimestamp(value) {
  const parsedValue = new Date(String(value ?? '')).getTime()

  return Number.isFinite(parsedValue) ? parsedValue : Number.POSITIVE_INFINITY
}

function getPayrollBillTargetPriority(bill) {
  const normalizedStatus = normalizeBillStatus(bill)

  if (normalizedStatus === 'partial') {
    return 0
  }

  if (normalizedStatus === 'unpaid') {
    return 1
  }

  return 2
}

function hasOutstandingPayrollBill(bill) {
  const normalizedStatus = normalizeBillStatus(bill)
  const remainingAmount = getBillSummaryAmount(bill)

  return normalizedStatus === 'partial' || normalizedStatus === 'unpaid' || remainingAmount > 0
}

function hasOutstandingBill(bill) {
  return getBillSummaryAmount(bill) > 0
}

function compareBillPaymentTarget(left, right) {
  const dueDateDiff =
    getBillPriorityTimestamp(left?.dueDate ?? left?.due_date) -
    getBillPriorityTimestamp(right?.dueDate ?? right?.due_date)

  if (dueDateDiff !== 0) {
    return dueDateDiff
  }

  const createdAtDiff =
    getBillPriorityTimestamp(left?.created_at ?? left?.createdAt) -
    getBillPriorityTimestamp(right?.created_at ?? right?.createdAt)

  if (createdAtDiff !== 0) {
    return createdAtDiff
  }

  return String(left?.id ?? '').localeCompare(String(right?.id ?? ''))
}

export function getPayrollBillGroupPaymentTarget(group) {
  const bills = Array.isArray(group?.bills) ? group.bills.filter(Boolean) : []
  const candidateBills = bills.filter(hasOutstandingPayrollBill)

  if (candidateBills.length === 0) {
    return null
  }

  return candidateBills.slice().sort((left, right) => {
    const priorityDiff =
      getPayrollBillTargetPriority(left) - getPayrollBillTargetPriority(right)

    if (priorityDiff !== 0) {
      return priorityDiff
    }

    const dueDateDiff =
      getBillPriorityTimestamp(left?.dueDate ?? left?.due_date) -
      getBillPriorityTimestamp(right?.dueDate ?? right?.due_date)

    if (dueDateDiff !== 0) {
      return dueDateDiff
    }

    const createdAtDiff =
      getBillPriorityTimestamp(left?.created_at ?? left?.createdAt) -
      getBillPriorityTimestamp(right?.created_at ?? right?.createdAt)

    if (createdAtDiff !== 0) {
      return createdAtDiff
    }

    return String(left?.id ?? '').localeCompare(String(right?.id ?? ''))
  })[0]
}

export function getBillGroupPaymentTarget(group) {
  const bills = Array.isArray(group?.bills) ? group.bills.filter(Boolean) : []
  const candidateBills = bills.filter(hasOutstandingBill)

  if (candidateBills.length === 0) {
    return null
  }

  return candidateBills.slice().sort(compareBillPaymentTarget)[0]
}

export function getPayrollBillGroupSummary(group) {
  const bills = Array.isArray(group?.bills) ? group.bills : []
  const workerName = normalizeText(group?.workerName ?? getBillSummaryWorkerLabel(bills[0] ?? group), 'Pekerja')
  const billedAmount = bills.reduce((sum, bill) => sum + getBillTotalAmount(bill), 0)
  const unbilledAmount = getPayrollGroupUnbilledAmount(group)
  const remainingAmount = bills.reduce((sum, bill) => sum + getBillSummaryAmount(bill), 0)
  const paidAmount = bills.reduce((sum, bill) => sum + getBillPaidAmount(bill), 0)
  const paymentTarget = getPayrollBillGroupPaymentTarget(group)

  return {
    workerName,
    recapCount: bills.length,
    totalAmount: billedAmount + unbilledAmount,
    billedAmount,
    unbilledAmount,
    remainingAmount,
    paidAmount,
    hasOutstandingPayment: Boolean(paymentTarget),
    paymentTargetBillId: paymentTarget?.id ?? null,
    paymentTargetBillStatus: paymentTarget ? normalizeBillStatus(paymentTarget) : null,
  }
}

export function groupBillsForBillList(bills = []) {
  const groupedBills = []
  const workerGroups = new Map()
  const staffGroups = new Map()

  for (const bill of bills) {
    if (isPayrollBillSummary(bill)) {
      const groupKey = getBillSummaryGroupKey(bill) || String(bill?.id ?? '')
      const nextGroup =
        workerGroups.get(groupKey) ?? {
          kind: 'worker-group',
          groupKey,
          workerName: getBillSummaryWorkerLabel(bill),
          bills: [],
          amount: 0,
          totalAmount: 0,
          remainingAmount: 0,
        }

      nextGroup.bills.push(bill)
      nextGroup.amount += getBillSummaryAmount(bill)
      nextGroup.totalAmount += getBillTotalAmount(bill)
      nextGroup.remainingAmount += getBillSummaryAmount(bill)

      if (!workerGroups.has(groupKey)) {
        workerGroups.set(groupKey, nextGroup)
        groupedBills.push(nextGroup)
      }

      continue
    }

    if (isFeeBillSummary(bill)) {
      const groupKey = getFeeBillSummaryGroupKey(bill) || String(bill?.id ?? '')
      const nextGroup =
        staffGroups.get(groupKey) ?? {
          kind: 'staff-group',
          groupKey,
          workerName: getBillSummaryWorkerLabel(bill),
          staffName: getBillSummaryWorkerLabel(bill),
          bills: [],
          amount: 0,
          totalAmount: 0,
          remainingAmount: 0,
        }

      nextGroup.bills.push(bill)
      nextGroup.amount += getBillSummaryAmount(bill)
      nextGroup.totalAmount += getBillTotalAmount(bill)
      nextGroup.remainingAmount += getBillSummaryAmount(bill)

      if (!staffGroups.has(groupKey)) {
        staffGroups.set(groupKey, nextGroup)
        groupedBills.push(nextGroup)
      }

      continue
    }

    groupedBills.push({
      kind: 'bill',
      bill,
    })
  }

  return groupedBills
}

export function getPayrollBillGroupHistoryRows(bills = [], deletedPayments = []) {
  const normalizedBills = Array.isArray(bills) ? bills.filter(Boolean) : []
  const billById = new Map(
    normalizedBills.map((bill) => [String(bill?.id ?? ''), bill]).filter(([billId]) => Boolean(billId))
  )
  const historyRows = []
  const rowIndexByPaymentId = new Map()

  function upsertHistoryRow(row, paymentId, shouldReplaceExisting = false) {
    if (paymentId) {
      if (rowIndexByPaymentId.has(paymentId)) {
        if (shouldReplaceExisting) {
          historyRows[rowIndexByPaymentId.get(paymentId)] = row
        }

        return
      }

      rowIndexByPaymentId.set(paymentId, historyRows.length)
    }

    historyRows.push(row)
  }

  for (const bill of normalizedBills) {
    const billLabel = getBillSummaryTitle(bill)
    const workerLabel = getBillSummaryWorkerLabel(bill)

    for (const payment of getBillPaymentRows(bill)) {
      const paymentId = String(payment?.id ?? '')

      upsertHistoryRow({
        kind: 'active',
        id: `${bill?.id ?? 'bill'}:${payment?.id ?? payment?.createdAt ?? historyRows.length}`,
        billId: bill?.id ?? null,
        bill,
        billLabel,
        workerLabel,
        payment,
        amount: toNumber(payment?.amount),
        paymentDate: payment?.paymentDate ?? payment?.createdAt ?? payment?.updatedAt ?? null,
        notes: normalizeText(payment?.notes, ''),
        isDeleted: false,
        canRestore: false,
        canPermanentDelete: false,
        sortKey: payment?.paymentDate ?? payment?.createdAt ?? payment?.updatedAt ?? bill?.dueDate ?? bill?.created_at ?? '',
      }, paymentId)
    }
  }

  for (const payment of Array.isArray(deletedPayments) ? deletedPayments.filter(Boolean) : []) {
    const billId = String(payment?.billId ?? payment?.bill_id ?? '')
    const bill = billById.get(billId) ?? null
    const billLabel = getBillSummaryTitle(bill ?? payment)
    const workerLabel = getBillSummaryWorkerLabel(bill ?? payment)
    const paymentId = String(payment?.id ?? '')

    upsertHistoryRow({
      kind: 'deleted',
      id: `${billId || 'deleted'}:${payment?.id ?? payment?.createdAt ?? historyRows.length}`,
      billId: billId || null,
      bill,
      billLabel,
      workerLabel,
      payment,
      amount: toNumber(payment?.amount),
      paymentDate: payment?.paymentDate ?? payment?.createdAt ?? payment?.updatedAt ?? null,
      notes: normalizeText(payment?.notes, ''),
      isDeleted: true,
      canRestore: Boolean(payment?.canRestore ?? payment?.deleted_at ?? payment?.deletedAt),
      canPermanentDelete: Boolean(payment?.canPermanentDelete ?? payment?.deleted_at ?? payment?.deletedAt),
      deletedAt: payment?.deleted_at ?? payment?.deletedAt ?? null,
      sortKey: payment?.paymentDate ?? payment?.createdAt ?? payment?.updatedAt ?? '',
    }, paymentId, true)
  }

  return historyRows.sort((left, right) => {
    const rightTime = new Date(String(right.sortKey ?? '')).getTime()
    const leftTime = new Date(String(left.sortKey ?? '')).getTime()

    return rightTime - leftTime
  })
}

export function groupBillsByWorker(bills = []) {
  const groupedBills = []
  const workerGroups = new Map()

  for (const bill of bills) {
    if (!isPayrollBillSummary(bill)) {
      groupedBills.push({
        kind: 'bill',
        bill,
      })
      continue
    }

    const groupKey = getBillSummaryGroupKey(bill) || String(bill?.id ?? '')
    const nextGroup =
      workerGroups.get(groupKey) ?? {
        kind: 'worker-group',
        groupKey,
        workerName: getBillSummaryWorkerLabel(bill),
        bills: [],
        amount: 0,
        totalAmount: 0,
        remainingAmount: 0,
      }

    nextGroup.bills.push(bill)
    nextGroup.amount += getBillSummaryAmount(bill)
    nextGroup.totalAmount += getBillTotalAmount(bill)
    nextGroup.remainingAmount += getBillSummaryAmount(bill)

    if (!workerGroups.has(groupKey)) {
      workerGroups.set(groupKey, nextGroup)
      groupedBills.push(nextGroup)
    }
  }

  return groupedBills
}

export function getTransactionCreatorLabel(transaction) {
  const displayName = normalizeText(
    transaction?.creator_display_name ?? 
      transaction?.creatorDisplayName ??
      transaction?.creator_name ??
      transaction?.creatorName ??
      '',
    ''
  )

  if (displayName) {
    return displayName
  }

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

  return formatCreatorDisplayNameFromMetadata(transaction, creatorId)
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
    return `/loan-payment/${transaction.id}`
  }

  const isDirectBillRecord =
    normalizeText(transaction?.sourceType) === 'bill' ||
    Boolean(transaction?.billType ?? transaction?.bill_type)

  const billId =
    transaction?.bill?.id ??
    transaction?.salaryBill?.id ??
    transaction?.bill_id ??
    transaction?.salary_bill_id ??
    (isDirectBillRecord ? transaction.id : null)

  if (!billId) {
    return null
  }

  if (normalizeBillStatus(transaction) === 'paid') {
    return null
  }

  return `/payment/${billId}`
}

export function canOpenTransactionPayment(transaction) {
  return Boolean(getTransactionPaymentRoute(transaction))
}

export function getTransactionPaymentLabel(transaction) {
  if (transaction?.sourceType === 'loan-disbursement') {
    return 'Bayar Pinjaman'
  }

  if (
    transaction?.salaryBill?.id ||
    transaction?.salary_bill_id ||
    transaction?.sourceType === 'attendance-record'
  ) {
    return 'Bayar Gaji/Upah'
  }

  if (transaction?.sourceType === 'bill' && isPayrollBill(transaction)) {
    return 'Bayar Gaji/Upah'
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
    const normalizedBillingStatus = normalizeText(transaction?.billing_status, 'unbilled')

    if (normalizedBillingStatus === 'billed' || Boolean(transaction?.salary_bill_id)) {
      return null
    }

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
    return (
      normalizeText(transaction?.billing_status, 'unbilled') !== 'billed' &&
      !transaction?.salary_bill_id
    )
  }

  if (sourceType === 'expense') {
    const billPaidAmount = Number(
      transaction?.bill?.paidAmount ??
        transaction?.bill?.paid_amount ??
        transaction?.bill_paid_amount ??
        0
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

const transactionLedgerFilterOptions = [
  { value: 'all', label: 'Semua Catatan' },
  { value: 'project-income', label: 'Termin Proyek' },
  { value: 'loan-disbursement', label: 'Pinjaman' },
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'bill', label: 'Gaji/Upah' },
  { value: 'material-invoice', label: 'Faktur' },
  { value: 'surat-jalan', label: 'Surat Jalan' },
]

export function getTransactionLedgerFilterOptions({
  includeSuratJalan = true,
  includePayrollBills = true,
} = {}) {
  return transactionLedgerFilterOptions.filter((item) => {
    if (!includeSuratJalan && item.value === 'surat-jalan') {
      return false
    }

    if (!includePayrollBills && item.value === 'bill') {
      return false
    }

    return true
  })
}

export function getTransactionLedgerVisibilityOptions(viewName = 'workspace') {
  if (viewName === 'history') {
    return {
      includePaidBills: true,
      includePayrollBills: false,
      includeSuratJalan: false,
    }
  }

  return {
    includePaidBills: false,
    includePayrollBills: false,
    includeSuratJalan: true,
  }
}

export function matchesTransactionLedgerFilter(
  transaction,
  filterValue,
  {
    includePaidBills = true,
    includePayrollBills = true,
    includeSuratJalan = true,
  } = {}
) {
  const normalizedFilter = normalizeText(filterValue, 'all')
  const sourceType = getTransactionSourceType(transaction)
  const documentType = getTransactionDocumentType(transaction)
  const expenseType = getTransactionExpenseType(transaction)

  if (!includePaidBills && isPaidBillTransaction(transaction)) {
    return false
  }

  if (!includePayrollBills && isPayrollBillTransaction(transaction)) {
    return false
  }

  if (!includeSuratJalan && isDeliveryOrderTransaction(transaction)) {
    return false
  }

  if (normalizedFilter === 'all') {
    return true
  }

  if (normalizedFilter === 'expense') {
    return sourceType === 'expense' && expenseType !== 'material' && expenseType !== 'material_invoice' && documentType !== 'surat_jalan'
  }

  if (normalizedFilter === 'bill') {
    return sourceType === 'bill' && !isPaidBillTransaction(transaction)
  }

  if (normalizedFilter === 'material-invoice') {
    return (
      sourceType === 'expense' &&
      (expenseType === 'material' || expenseType === 'material_invoice') &&
      documentType !== 'surat_jalan'
    )
  }

  if (normalizedFilter === 'surat-jalan') {
    return sourceType === 'expense' && documentType === 'surat_jalan'
  }

  return sourceType === normalizedFilter
}
