import { getSupabaseAccessToken } from './auth-session'

async function parseApiResponse(response) {
  const result = await response.json().catch(() => ({}))

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Gagal memuat data transaksi dari server.')
  }

  return result
}

async function requestTransactionsApi(method, { query = {}, body = null } = {}) {
  const accessToken = await getSupabaseAccessToken()

  const url = new URL('/api/transactions', window.location.origin)
  const shouldIncludeDebugTiming = method === 'GET' && import.meta.env.DEV

  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') {
      continue
    }

    url.searchParams.set(key, String(value))
  }

  if (shouldIncludeDebugTiming) {
    url.searchParams.set('debugTiming', '1')
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  return parseApiResponse(response)
}

export async function fetchCashMutationsFromApi(teamId) {
  const result = await requestTransactionsApi('GET', {
    query: {
      teamId,
    },
  })

  return result.cashMutations ?? []
}

export async function fetchWorkspaceTransactionsFromApi(teamId) {
  const result = await requestTransactionsApi('GET', {
    query: {
      teamId,
      view: 'workspace',
    },
  })

  return result.workspaceTransactions ?? []
}

export async function fetchWorkspaceTransactionPageFromApi(
  teamId,
  { cursor = null, limit = 20, search = '', filter = 'all' } = {}
) {
  const result = await requestTransactionsApi('GET', {
    query: {
      teamId,
      view: 'workspace',
      cursor,
      limit,
      search,
      filter,
    },
  })

  return {
    workspaceTransactions: result.workspaceTransactions ?? [],
    pageInfo: result.pageInfo ?? {
      hasMore: false,
      nextCursor: null,
      totalCount: 0,
    },
    timing: result.timing ?? null,
  }
}

export async function fetchWorkspaceTransactionByIdFromApi(
  teamId,
  transactionId
) {
  const result = await requestTransactionsApi('GET', {
    query: {
      teamId,
      view: 'workspace',
      transactionId,
    },
  })

  return result.record ?? null
}

export async function fetchHistoryTransactionPageFromApi(
  teamId,
  { cursor = null, limit = 20, search = '', filter = 'all' } = {}
) {
  const result = await requestTransactionsApi('GET', {
    query: {
      teamId,
      view: 'history',
      cursor,
      limit,
      search,
      filter,
    },
  })

  return {
    historyTransactions: result.historyTransactions ?? [],
    pageInfo: result.pageInfo ?? {
      hasMore: false,
      nextCursor: null,
      totalCount: 0,
    },
    timing: result.timing ?? null,
  }
}

export async function fetchHistoryTransactionByIdFromApi(teamId, transactionId) {
  const result = await requestTransactionsApi('GET', {
    query: {
      teamId,
      view: 'history',
      transactionId,
    },
  })

  return result.record ?? null
}

export async function fetchTransactionSummaryFromApi(teamId) {
  const result = await requestTransactionsApi('GET', {
    query: {
      teamId,
      view: 'summary',
    },
  })

  return result.summary ?? {
    total_income: 0,
    total_expense: 0,
    ending_balance: 0,
  }
}

export async function fetchDeletedCashMutationsFromApi(teamId) {
  const result = await requestTransactionsApi('GET', {
    query: {
      teamId,
      view: 'recycle-bin',
    },
  })

  return result.cashMutations ?? []
}

export async function fetchRecycleBinPageFromApi(
  teamId,
  { cursor = null, limit = 20, search = '', filter = 'all' } = {}
) {
  const result = await requestTransactionsApi('GET', {
    query: {
      teamId,
      view: 'recycle-bin',
      cursor,
      limit,
      search,
      filter,
    },
  })

  return {
    recycleBinRecords: result.recycleBinRecords ?? result.cashMutations ?? [],
    pageInfo: result.pageInfo ?? {
      hasMore: false,
      nextCursor: null,
      totalCount: 0,
    },
    timing: result.timing ?? null,
  }
}

export async function fetchDeletedCashMutationByIdFromApi(teamId, transactionId) {
  const result = await requestTransactionsApi('GET', {
    query: {
      teamId,
      view: 'recycle-bin',
      transactionId,
    },
  })

  return result.record ?? null
}

export async function softDeleteTransactionFromApi(
  recordType,
  id,
  teamId,
  expectedUpdatedAt = null
) {
  await requestTransactionsApi('DELETE', {
    body: {
      recordType,
      id,
      teamId,
      expectedUpdatedAt,
    },
  })

  return true
}

export async function saveTransactionRecordFromApi(method, payload) {
  const result = await requestTransactionsApi(method, {
    body: payload,
  })

  return result.record ?? null
}

export async function restoreTransactionFromApi(
  recordType,
  id,
  teamId,
  expectedUpdatedAt = null
) {
  const result = await requestTransactionsApi('PATCH', {
    body: {
      action: 'restore',
      recordType,
      id,
      teamId,
      expectedUpdatedAt,
    },
  })

  return result.record ?? null
}

export async function permanentDeleteTransactionFromApi(recordType, id, teamId) {
  await requestTransactionsApi('DELETE', {
    body: {
      action: 'permanent-delete',
      recordType,
      id,
      teamId,
    },
  })

  return true
}

export async function updateLoanPaymentFromApi(paymentId, payload) {
  const result = await requestTransactionsApi('PATCH', {
    query: {
      resource: 'loan-payments',
    },
    body: {
      paymentId,
      ...payload,
    },
  })

  return {
    payment: result.payment ?? null,
    loan: result.loan ?? null,
  }
}

export async function createLoanPaymentFromApi(payload) {
  const result = await requestTransactionsApi('POST', {
    query: {
      resource: 'loan-payments',
    },
    body: payload,
  })

  return {
    payment: result.payment ?? null,
    loan: result.loan ?? null,
  }
}

export async function deleteLoanPaymentFromApi(paymentId, teamId) {
  const result = await requestTransactionsApi('DELETE', {
    query: {
      resource: 'loan-payments',
    },
    body: {
      paymentId,
      teamId,
    },
  })

  return {
    payment: result.payment ?? null,
    loan: result.loan ?? null,
  }
}

export async function permanentDeleteLoanPaymentFromApi(paymentId, teamId) {
  const result = await requestTransactionsApi('DELETE', {
    query: {
      resource: 'loan-payments',
    },
    body: {
      action: 'permanent-delete',
      paymentId,
      teamId,
    },
  })

  return {
    payment: result.payment ?? null,
    loan: result.loan ?? null,
  }
}

export async function fetchDeletedLoanPaymentsFromApi(teamId) {
  const result = await requestTransactionsApi('GET', {
    query: {
      resource: 'loan-payments',
      teamId,
      view: 'recycle-bin',
    },
  })

  return result.payments ?? []
}

export async function restoreLoanPaymentFromApi(
  paymentId,
  teamId,
  expectedUpdatedAt = null
) {
  const result = await requestTransactionsApi('PATCH', {
    query: {
      resource: 'loan-payments',
    },
    body: {
      action: 'restore',
      paymentId,
      teamId,
      expectedUpdatedAt,
    },
  })

  return {
    payment: result.payment ?? null,
    loan: result.loan ?? null,
  }
}
