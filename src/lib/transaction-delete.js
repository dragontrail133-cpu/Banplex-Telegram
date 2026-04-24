function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function isExpenseLikeTransaction(transaction = null) {
  const sourceType = normalizeText(transaction?.sourceType).toLowerCase()
  const expenseType = normalizeText(transaction?.expense_type, '').toLowerCase()
  const documentType = normalizeText(transaction?.document_type, '').toLowerCase()

  return sourceType === 'expense' || Boolean(expenseType) || Boolean(documentType)
}

export function hasTransactionPaymentHistory(transaction = null) {
  const sourceType = normalizeText(transaction?.sourceType).toLowerCase()
  const isExpenseLike = isExpenseLikeTransaction(transaction)

  if (sourceType === 'expense' || isExpenseLike) {
    const billPaidAmount = Number(
      transaction?.bill_paid_amount ??
        transaction?.bill?.paid_amount ??
        transaction?.bill?.paidAmount ??
        transaction?.billPaidAmount ??
        0
    )
    const billStatus = normalizeText(
      transaction?.bill?.status ?? transaction?.bill_status ?? transaction?.status,
      ''
    ).toLowerCase()

    return billPaidAmount > 0 || ['partial', 'paid'].includes(billStatus)
  }

  if (sourceType === 'loan-disbursement' || sourceType === 'loan') {
    const paidAmount = Number(
      transaction?.paid_amount ?? transaction?.loan?.paid_amount ?? transaction?.loan?.paidAmount ?? 0
    )
    const loanStatus = normalizeText(
      transaction?.loan?.status ?? transaction?.status,
      ''
    ).toLowerCase()

    return paidAmount > 0 || ['partial', 'paid'].includes(loanStatus)
  }

  if (sourceType === 'bill') {
    const paidAmount = Number(
      transaction?.paid_amount ?? transaction?.bill?.paid_amount ?? transaction?.bill?.paidAmount ?? 0
    )
    const billStatus = normalizeText(transaction?.bill?.status ?? transaction?.status, '').toLowerCase()

    return paidAmount > 0 || ['partial', 'paid'].includes(billStatus)
  }

  return false
}

export function canShowTransactionDelete(transaction = null) {
  if (transaction?.canDelete === true) {
    return true
  }

  const sourceType = normalizeText(transaction?.sourceType).toLowerCase()
  const isExpenseLike = isExpenseLikeTransaction(transaction)

  if (sourceType === 'expense' || isExpenseLike) {
    return true
  }

  if (sourceType === 'attendance-record') {
    return (
      normalizeText(transaction?.billing_status, 'unbilled') !== 'billed' &&
      !transaction?.salary_bill_id
    )
  }

  return ['project-income', 'loan-disbursement', 'loan'].includes(sourceType)
}

export function getTransactionDeleteHistoryRoute(transaction = null) {
  const transactionId = normalizeText(transaction?.id, '')

  if (!transactionId) {
    return null
  }

  return `/transactions/${transactionId}?surface=riwayat`
}
