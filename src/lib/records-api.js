import { getSupabaseAccessToken } from './auth-session'

async function requestRecordsApi(method, { resource, query = {}, body = null } = {}) {
  const accessToken = await getSupabaseAccessToken()

  const url = new URL('/api/records', window.location.origin)
  url.searchParams.set('resource', resource)

  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') {
      continue
    }

    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Gagal memuat data dari server.')
  }

  return result
}

export async function fetchExpenseAttachmentsFromApi(expenseId, { includeDeleted = true } = {}) {
  const result = await requestRecordsApi('GET', {
    resource: 'expense-attachments',
    query: {
      expenseId,
      includeDeleted: includeDeleted ? 'true' : 'false',
    },
  })

  return result.attachments ?? []
}

export async function fetchStockOverviewFromApi(teamId, { limit = 8 } = {}) {
  const result = await requestRecordsApi('GET', {
    resource: 'stock-overview',
    query: {
      teamId,
      limit,
    },
  })

  return {
    materials: result.materials ?? [],
    stockTransactions: result.stockTransactions ?? [],
  }
}

export async function fetchStockProjectOptionsFromApi(teamId) {
  const result = await requestRecordsApi('GET', {
    resource: 'stock-project-options',
    query: {
      teamId,
    },
  })

  return result.projects ?? []
}

export async function createManualStockOutFromApi(payload) {
  const result = await requestRecordsApi('POST', {
    resource: 'stock-manual-outs',
    body: payload,
  })

  return {
    stockTransaction: result.stockTransaction ?? null,
    material: result.material ?? null,
  }
}

export async function fetchDeletedExpenseAttachmentsFromApi(teamId) {
  const result = await requestRecordsApi('GET', {
    resource: 'expense-attachments',
    query: {
      teamId,
      view: 'recycle-bin',
    },
  })

  return result.attachments ?? []
}

export async function attachExpenseAttachmentFromApi(expenseId, fileAssetId, payload = {}) {
  const result = await requestRecordsApi('POST', {
    resource: 'expense-attachments',
    body: {
      expenseId,
      fileAssetId,
      ...payload,
    },
  })

  return result.attachment ?? null
}

export async function restoreExpenseAttachmentFromApi(attachmentId, teamId) {
  const result = await requestRecordsApi('PATCH', {
    resource: 'expense-attachments',
    body: {
      action: 'restore',
      attachmentId,
      teamId,
    },
  })

  return result.attachment ?? null
}

export async function softDeleteExpenseAttachmentFromApi(attachmentId, teamId) {
  const result = await requestRecordsApi('DELETE', {
    resource: 'expense-attachments',
    body: {
      attachmentId,
      teamId,
    },
  })

  return result.attachment ?? null
}

export async function permanentDeleteExpenseAttachmentFromApi(attachmentId, teamId) {
  const result = await requestRecordsApi('DELETE', {
    resource: 'expense-attachments',
    body: {
      action: 'permanent-delete',
      attachmentId,
      teamId,
    },
  })

  return result.attachment ?? null
}

export async function fetchBillByIdFromApi(billId) {
  const result = await requestRecordsApi('GET', {
    resource: 'bills',
    query: {
      billId,
    },
  })

  return result.bill ?? null
}

export async function fetchUnpaidBillsFromApi(teamId) {
  const result = await requestRecordsApi('GET', {
    resource: 'bills',
    query: {
      teamId,
    },
  })

  return result.bills ?? []
}

export async function softDeleteBillFromApi(billId, teamId, expectedUpdatedAt = null) {
  await requestRecordsApi('DELETE', {
    resource: 'bills',
    body: {
      billId,
      teamId,
      expectedUpdatedAt,
    },
  })

  return true
}

export async function updateBillPaymentFromApi(paymentId, payload) {
  const result = await requestRecordsApi('PATCH', {
    resource: 'bill-payments',
    body: {
      paymentId,
      ...payload,
    },
  })

  return {
    payment: result.payment ?? null,
    bill: result.bill ?? null,
  }
}

export async function createBillPaymentFromApi(payload) {
  const result = await requestRecordsApi('POST', {
    resource: 'bill-payments',
    body: payload,
  })

  return {
    payment: result.payment ?? null,
    bill: result.bill ?? null,
  }
}

export async function deleteBillPaymentFromApi(paymentId, teamId) {
  const result = await requestRecordsApi('DELETE', {
    resource: 'bill-payments',
    body: {
      paymentId,
      teamId,
    },
  })

  return {
    bill: result.bill ?? null,
  }
}

export async function permanentDeleteBillPaymentFromApi(paymentId, teamId) {
  const result = await requestRecordsApi('DELETE', {
    resource: 'bill-payments',
    body: {
      action: 'permanent-delete',
      paymentId,
      teamId,
    },
  })

  return {
    bill: result.bill ?? null,
  }
}

export async function fetchDeletedBillPaymentsFromApi(teamId) {
  const result = await requestRecordsApi('GET', {
    resource: 'bill-payments',
    query: {
      teamId,
      view: 'recycle-bin',
    },
  })

  return result.payments ?? []
}

export async function restoreBillPaymentFromApi(paymentId, teamId, expectedUpdatedAt = null) {
  const result = await requestRecordsApi('PATCH', {
    resource: 'bill-payments',
    body: {
      action: 'restore',
      paymentId,
      teamId,
      expectedUpdatedAt,
    },
  })

  return {
    payment: result.payment ?? null,
    bill: result.bill ?? null,
  }
}

export async function createExpenseFromApi(payload) {
  const result = await requestRecordsApi('POST', {
    resource: 'expenses',
    body: payload,
  })

  return result.expense ?? null
}

export async function fetchExpenseByIdFromApi(expenseId, { includeDeleted = false } = {}) {
  const result = await requestRecordsApi('GET', {
    resource: 'expenses',
    query: {
      expenseId,
      includeDeleted: includeDeleted ? 'true' : 'false',
    },
  })

  return result.expense ?? null
}

export async function fetchDeletedExpensesFromApi(teamId) {
  const result = await requestRecordsApi('GET', {
    resource: 'expenses',
    query: {
      teamId,
      view: 'recycle-bin',
    },
  })

  return result.expenses ?? []
}

export async function updateExpenseFromApi(expenseId, payload) {
  const result = await requestRecordsApi('PATCH', {
    resource: 'expenses',
    body: {
      ...payload,
      id: expenseId,
    },
  })

  return result.expense ?? null
}

export async function softDeleteExpenseFromApi(expenseId, teamId, expectedUpdatedAt = null) {
  const result = await requestRecordsApi('DELETE', {
    resource: 'expenses',
    body: {
      expenseId,
      teamId,
      expectedUpdatedAt,
    },
  })

  return result.expense ?? null
}

export async function restoreExpenseFromApi(expenseId, teamId, expectedUpdatedAt = null) {
  const result = await requestRecordsApi('PATCH', {
    resource: 'expenses',
    body: {
      action: 'restore',
      expenseId,
      teamId,
      expectedUpdatedAt,
    },
  })

  return result.expense ?? null
}

export async function createMaterialInvoiceFromApi(headerData, itemsData) {
  const result = await requestRecordsApi('POST', {
    resource: 'material-invoices',
    body: {
      headerData,
      itemsData,
    },
  })

  return {
    expense: result.expense ?? null,
    items: result.items ?? [],
  }
}

export async function fetchMaterialInvoiceByIdFromApi(expenseId, { includeDeleted = false } = {}) {
  const result = await requestRecordsApi('GET', {
    resource: 'material-invoices',
    query: {
      expenseId,
      includeDeleted: includeDeleted ? 'true' : 'false',
    },
  })

  return result.expense ?? null
}

export async function fetchDeletedMaterialInvoicesFromApi(teamId) {
  const result = await requestRecordsApi('GET', {
    resource: 'material-invoices',
    query: {
      teamId,
      view: 'recycle-bin',
    },
  })

  return result.expenses ?? []
}

export async function updateMaterialInvoiceFromApi(expenseId, headerData, itemsData) {
  const result = await requestRecordsApi('PATCH', {
    resource: 'material-invoices',
    body: {
      expenseId,
      headerData,
      itemsData,
    },
  })

  return {
    expense: result.expense ?? null,
    items: result.items ?? [],
  }
}

export async function softDeleteMaterialInvoiceFromApi(
  expenseId,
  teamId,
  expectedUpdatedAt = null
) {
  const result = await requestRecordsApi('DELETE', {
    resource: 'material-invoices',
    body: {
      expenseId,
      teamId,
      expectedUpdatedAt,
    },
  })

  return result.expense ?? null
}

export async function restoreMaterialInvoiceFromApi(
  expenseId,
  teamId,
  expectedUpdatedAt = null
) {
  const result = await requestRecordsApi('PATCH', {
    resource: 'material-invoices',
    body: {
      action: 'restore',
      expenseId,
      teamId,
      expectedUpdatedAt,
    },
  })

  return result.expense ?? null
}

export async function fetchAttendanceSheetFromApi({ teamId, date, projectId }) {
  const result = await requestRecordsApi('GET', {
    resource: 'attendance',
    query: {
      teamId,
      date,
      projectId,
    },
  })

  return result.attendances ?? []
}

export async function fetchAttendanceHistoryFromApi({
  teamId,
  month = '',
  workerId = '',
  workerName = '',
  date = '',
} = {}) {
  const result = await requestRecordsApi('GET', {
    resource: 'attendance-history',
    query: {
      teamId,
      month,
      workerId: workerId === 'all' ? '' : workerId,
      workerName,
      date,
    },
  })

  return result.attendances ?? []
}

export async function fetchAttendanceHistorySummaryFromApi({
  teamId,
  month = '',
} = {}) {
  const result = await requestRecordsApi('GET', {
    resource: 'attendance-history',
    query: {
      teamId,
      month,
      view: 'summary',
    },
  })

  return result.summary ?? {
    month: month || null,
    attendanceCount: 0,
    dailyGroups: [],
    workerGroups: [],
  }
}

export async function fetchAttendanceRecordFromApi(attendanceId, { includeDeleted = true } = {}) {
  const result = await requestRecordsApi('GET', {
    resource: 'attendance',
    query: {
      attendanceId,
      includeDeleted: includeDeleted ? 'true' : 'false',
    },
  })

  return result.attendance ?? null
}

export async function updateAttendanceRecordFromApi(attendanceId, payload) {
  const result = await requestRecordsApi('PATCH', {
    resource: 'attendance',
    body: {
      attendanceId,
      ...payload,
    },
  })

  return result.attendance ?? null
}

export async function fetchUnbilledAttendancesFromApi(teamId) {
  const result = await requestRecordsApi('GET', {
    resource: 'attendance-unbilled',
    query: {
      teamId,
    },
  })

  return result.attendances ?? []
}

export async function createAttendanceRecapFromApi(payload) {
  const result = await requestRecordsApi('POST', {
    resource: 'attendance-recap',
    body: payload,
  })

  return {
    billId: result.billId ?? null,
    attendanceCount: Number(result.attendanceCount ?? 0),
    totalAmount: Number(result.totalAmount ?? 0),
  }
}

export async function saveAttendanceSheetFromApi(payload) {
  const result = await requestRecordsApi('POST', {
    resource: 'attendance',
    body: payload,
  })

  return result.attendances ?? []
}

export async function softDeleteAttendanceFromApi(attendanceId, teamId) {
  await requestRecordsApi('DELETE', {
    resource: 'attendance',
    body: {
      attendanceId,
      teamId,
    },
  })

  return true
}

export async function restoreAttendanceFromApi(attendanceId, teamId) {
  const result = await requestRecordsApi('PATCH', {
    resource: 'attendance',
    body: {
      action: 'restore',
      attendanceId,
      teamId,
    },
  })

  return result.attendance ?? null
}
