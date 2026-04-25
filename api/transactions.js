import { Buffer } from 'node:buffer'
import { createClient } from '@supabase/supabase-js'
import {
  buildLoanTermsSnapshot,
  buildLoanLateChargeSummary,
  normalizeLoanInterestType,
  normalizeLoanLateInterestBasis,
  normalizeLoanLatePenaltyType,
} from '../src/lib/loan-business.js'
import {
  getTransactionLedgerVisibilityOptions,
  matchesTransactionLedgerFilter,
} from '../src/lib/transaction-presentation.js'
import { nowMs } from '../src/lib/timing.js'

function getEnv(name, fallback = '') {
  return String(globalThis.process?.env?.[name] ?? fallback).trim()
}

function createHttpError(status, message) {
  const error = new Error(message)

  error.statusCode = status

  return error
}

function getBearerToken(req) {
  const authorizationHeader = String(req.headers?.authorization ?? '').trim()
  const bearerToken = authorizationHeader.toLowerCase().startsWith('bearer ')
    ? authorizationHeader.slice(7).trim()
    : null

  if (!bearerToken) {
    throw createHttpError(401, 'Authorization token tidak ditemukan.')
  }

  return bearerToken
}

async function parseRequestBody(req) {
  if (typeof req.body === 'string' && req.body.trim().length > 0) {
    return JSON.parse(req.body)
  }

  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  const chunks = []

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString())
  }

  const rawBody = chunks.join('').trim()

  return rawBody ? JSON.parse(rawBody) : {}
}

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : NaN
}

function normalizeVersion(value) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : null
}

function assertOptimisticConcurrency(expectedVersion, currentVersion, label) {
  const normalizedExpected = normalizeVersion(expectedVersion)

  if (!normalizedExpected) {
    return
  }

  const normalizedCurrent = normalizeVersion(currentVersion)

  if (normalizedCurrent && normalizedCurrent !== normalizedExpected) {
    throw createHttpError(
      409,
      `${label} sudah berubah oleh pengguna lain. Muat ulang data terbaru sebelum menyimpan lagi.`
    )
  }
}

const loanSelectColumns =
  'id, telegram_user_id, created_by_user_id, team_id, creditor_id, transaction_date, disbursed_date, principal_amount, repayment_amount, interest_type, interest_rate, tenor_months, late_interest_rate, late_interest_basis, late_penalty_type, late_penalty_amount, loan_terms_snapshot, amount, description, notes, creditor_name_snapshot, status, paid_amount, created_at, updated_at, deleted_at'
const workspaceTransactionViewSelectColumns =
  'id, team_id, source_type, type, sort_at, transaction_date, income_date, expense_date, due_date, created_at, updated_at, amount, description, project_name_snapshot, supplier_name_snapshot, creditor_name_snapshot, worker_name_snapshot, expense_type, document_type, bill_id, bill_type, bill_status, bill_amount, bill_paid_amount, bill_remaining_amount, bill_due_date, bill_paid_at, bill_description, bill_project_name_snapshot, bill_supplier_name_snapshot, bill_worker_name_snapshot, search_text'
const historyTransactionViewSelectColumns = workspaceTransactionViewSelectColumns
const recycleBinViewSelectColumns =
  'id, team_id, source_type, type, deleted_at, transaction_date, income_date, expense_date, due_date, payment_date, attendance_date, disbursed_date, created_at, updated_at, amount, total_amount, total_pay, description, notes, project_name_snapshot, supplier_name_snapshot, creditor_name_snapshot, worker_name_snapshot, expense_type, document_type, bill_id, bill_type, bill_status, bill_amount, bill_paid_amount, bill_remaining_amount, bill_due_date, bill_paid_at, bill_description, bill_project_name_snapshot, bill_supplier_name_snapshot, bill_worker_name_snapshot, record_kind, expense_id, project_income_id, project_id, loan_id, worker_id, attendance_status, billing_status, salary_bill_id, principal_amount, repayment_amount, interest_type, interest_rate, tenor_months, late_interest_rate, late_interest_basis, late_penalty_type, late_penalty_amount, loan_terms_snapshot, status, paid_amount, original_name, file_name, search_text'

function normalizeExpenseRow(row) {
  return {
    ...row,
    amount: toNumber(row?.amount),
    total_amount: toNumber(row?.total_amount),
  }
}

function createDatabaseClient(url, apiKey, bearerToken) {
  return createClient(url, apiKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: bearerToken
      ? {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        }
      : undefined,
  })
}

function buildSummary(cashMutations = []) {
  const summary = cashMutations.reduce(
    (summary, mutation) => {
      const amount = Number(mutation.amount) || 0

      if (mutation.type === 'expense') {
        summary.totalExpense += amount
        summary.endingBalance -= amount
      } else {
        summary.totalIncome += amount
        summary.endingBalance += amount
      }

      return summary
    },
    {
      totalIncome: 0,
      totalExpense: 0,
      endingBalance: 0,
    }
  )

  return {
    total_income: summary.totalIncome,
    total_expense: summary.totalExpense,
    ending_balance: summary.endingBalance,
  }
}

function sortCashMutations(rows = []) {
  return [...rows].sort((left, right) => {
    const rightTimestamp = new Date(
      String(right.transaction_date ?? right.created_at ?? '')
    ).getTime()
    const leftTimestamp = new Date(
      String(left.transaction_date ?? left.created_at ?? '')
    ).getTime()

    return rightTimestamp - leftTimestamp
  })
}

function getRecycleBinSortTimestamp(row) {
  return new Date(
    String(
      row?.deleted_at ??
        row?.updated_at ??
        row?.created_at ??
        row?.transaction_date ??
        row?.expense_date ??
        row?.payment_date ??
        ''
    )
  ).getTime()
}

function encodeRecycleBinCursor(row) {
  const payload = {
    timestamp: getRecycleBinSortTimestamp(row),
    id: String(row?.id ?? ''),
  }

  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeRecycleBinCursor(cursor) {
  const normalizedCursor = normalizeText(cursor, '')

  if (!normalizedCursor) {
    return null
  }

  try {
    const decoded = JSON.parse(Buffer.from(normalizedCursor, 'base64url').toString('utf8'))

    if (!decoded || !Number.isFinite(Number(decoded.timestamp)) || !normalizeText(decoded.id, '')) {
      return null
    }

    return {
      timestamp: Number(decoded.timestamp),
      id: String(decoded.id),
    }
  } catch {
    return null
  }
}

function buildRecycleBinSearchText(...values) {
  return String(
    values
      .map((value) => normalizeText(value, ''))
      .filter(Boolean)
      .join(' ')
  ).toLowerCase()
}

function mapRecycleBinTransactionRecord(row) {
  return {
    ...row,
    group: 'transaction',
    detailRoute: `/transactions/recycle-bin/${row.id}?surface=recycle-bin`,
    canPermanentDelete: true,
    canRestore: true,
    search_text: buildRecycleBinSearchText(
      row.description,
      row.party_label,
      row.project_name,
      row.sourceType,
      row.billDescription,
      row.type
    ),
  }
}

function isMaterialInvoiceExpense(expense) {
  const expenseType = normalizeText(expense?.expense_type, '').toLowerCase()
  const documentType = normalizeText(expense?.document_type, '').toLowerCase()

  return (
    expenseType === 'material' ||
    expenseType === 'material_invoice' ||
    documentType === 'material' ||
    documentType === 'material_invoice'
  )
}

function mapRecycleBinDocumentRecord(expense) {
  const amount = Number(expense?.amount ?? expense?.total_amount ?? 0)

  return {
    ...expense,
    amount: Number.isFinite(amount) ? amount : 0,
    group: 'document',
    recordKind: isMaterialInvoiceExpense(expense) ? 'material-invoice' : 'expense',
    type: 'expense',
    sourceType: 'expense',
    transaction_date: expense?.deleted_at ?? expense?.expense_date ?? expense?.created_at ?? null,
    canPermanentDelete: false,
    canRestore: true,
    search_text: buildRecycleBinSearchText(
      expense?.description,
      expense?.notes,
      expense?.project_name_snapshot,
      expense?.supplier_name_snapshot,
      expense?.expense_type,
      expense?.document_type
    ),
  }
}

function mapRecycleBinBillPaymentRecord(payment) {
  const amount = Number(payment?.amount ?? 0)

  return {
    ...payment,
    amount: Number.isFinite(amount) ? amount : 0,
    group: 'payment',
    type: 'expense',
    sourceType: 'bill-payment',
    transaction_date: payment?.deleted_at ?? payment?.payment_date ?? payment?.created_at ?? null,
    description: payment?.notes ?? 'Pembayaran tagihan',
    party_label: payment?.bill_id ?? 'Tagihan',
    canPermanentDelete: true,
    canRestore: true,
    search_text: buildRecycleBinSearchText(
      payment?.notes,
      payment?.supplier_name_snapshot,
      payment?.worker_name_snapshot,
      payment?.project_name_snapshot,
      payment?.bill_id
    ),
  }
}

function mapRecycleBinLoanPaymentRecord(payment) {
  const amount = Number(payment?.amount ?? 0)

  return {
    ...payment,
    amount: Number.isFinite(amount) ? amount : 0,
    group: 'payment',
    type: 'expense',
    sourceType: 'loan-payment',
    transaction_date: payment?.deleted_at ?? payment?.payment_date ?? payment?.created_at ?? null,
    description: payment?.notes ?? 'Pembayaran pinjaman',
    party_label: payment?.creditor_name_snapshot ?? 'Pinjaman',
    canPermanentDelete: true,
    canRestore: true,
    search_text: buildRecycleBinSearchText(
      payment?.notes,
      payment?.creditor_name_snapshot,
      payment?.amount
    ),
  }
}

function mapRecycleBinAttachmentRecord(attachment) {
  const fileName =
    attachment?.original_name ??
    attachment?.file_name ??
    attachment?.file_assets?.original_name ??
    attachment?.file_assets?.file_name ??
    `Lampiran ${String(attachment?.id ?? '').slice(0, 8)}`

  return {
    ...attachment,
    amount: 0,
    group: 'attachment',
    type: 'document',
    sourceType: 'expense-attachment',
    description: fileName,
    party_label: attachment?.expense_id ?? 'Lampiran',
    project_name: null,
    transaction_date: attachment?.deleted_at ?? attachment?.updated_at ?? attachment?.created_at ?? null,
    showAmount: false,
    canPermanentDelete: true,
    canRestore: true,
    search_text: buildRecycleBinSearchText(
      fileName,
      attachment?.expense_id
    ),
  }
}

function mapRecycleBinViewRow(row) {
  const sourceType = normalizeText(row?.source_type, '')

  if (sourceType === 'project-income') {
    return mapRecycleBinTransactionRecord(mapProjectIncomeRow(row))
  }

  if (sourceType === 'loan-disbursement') {
    return mapRecycleBinTransactionRecord(mapLoanRow(row))
  }

  if (sourceType === 'bill') {
    return mapRecycleBinTransactionRecord(mapBillRecycleRow(row))
  }

  if (sourceType === 'attendance-record') {
    return mapAttendanceRecycleRow(row)
  }

  if (sourceType === 'expense') {
    return mapRecycleBinDocumentRecord(row)
  }

  if (sourceType === 'bill-payment') {
    return mapRecycleBinBillPaymentRecord(row)
  }

  if (sourceType === 'loan-payment') {
    return mapRecycleBinLoanPaymentRecord(row)
  }

  if (sourceType === 'expense-attachment') {
    return mapRecycleBinAttachmentRecord(row)
  }

  return null
}

function applyRecycleBinViewFilter(query, filterValue) {
  const normalizedFilter = normalizeText(filterValue, 'all')

  if (normalizedFilter === 'all') {
    return query
  }

  if (normalizedFilter === 'transaction') {
    return query.in('source_type', [
      'project-income',
      'loan-disbursement',
      'bill',
      'attendance-record',
    ])
  }

  if (normalizedFilter === 'document') {
    return query.eq('source_type', 'expense')
  }

  if (normalizedFilter === 'payment') {
    return query.in('source_type', ['bill-payment', 'loan-payment'])
  }

  if (normalizedFilter === 'attachment') {
    return query.eq('source_type', 'expense-attachment')
  }

  return query
}

function decodeRecycleBinViewCursor(cursor) {
  const decodedCursor = decodeRecycleBinCursor(cursor)

  if (!decodedCursor) {
    return null
  }

  return {
    timestamp: new Date(decodedCursor.timestamp).toISOString(),
    id: decodedCursor.id,
  }
}

function applyRecycleBinViewCursor(query, cursor) {
  const decodedCursor = decodeRecycleBinViewCursor(cursor)

  if (!decodedCursor) {
    return query
  }

  return query.or(
    `deleted_at.lt.${decodedCursor.timestamp},and(deleted_at.eq.${decodedCursor.timestamp},id.lt.${decodedCursor.id})`
  )
}

function buildRecycleBinViewQuery(
  adminClient,
  teamId,
  { cursor = null, limit = 20, search = '', filter = 'all', fetchAll = false } = {}
) {
  const normalizedLimit = Number.isFinite(Number(limit))
    ? Math.min(Math.max(Number(limit), 1), 100)
    : 20
  const normalizedSearch = normalizeText(search, '').toLowerCase()

  let query = adminClient
    .from('vw_recycle_bin_records')
    .select(recycleBinViewSelectColumns)
    .eq('team_id', teamId)

  query = applyRecycleBinViewFilter(query, filter)

  if (normalizedSearch) {
    query = query.ilike('search_text', `%${normalizedSearch}%`)
  }

  if (cursor) {
    query = applyRecycleBinViewCursor(query, cursor)
  }

  query = query.order('deleted_at', { ascending: false }).order('id', { ascending: false })

  if (!fetchAll) {
    query = query.limit(normalizedLimit + 1)
  }

  return {
    normalizedLimit,
    query,
  }
}

async function loadRecycleBinViewRows(
  adminClient,
  teamId,
  {
    cursor = null,
    limit = 20,
    search = '',
    filter = 'all',
    fetchAll = false,
    includeCreatorMetadata = true,
    debugTiming = false,
  } = {}
) {
  const startedAt = nowMs()
  const { normalizedLimit, query } = buildRecycleBinViewQuery(
    adminClient,
    teamId,
    {
      cursor,
      limit,
      search,
      filter,
      fetchAll,
    }
  )
  const queryStartedAt = nowMs()
  const { data, error } = await query
  const queryMs = nowMs() - queryStartedAt

  if (error) {
    throw error
  }

  let creatorMetadata = new Map()
  let creatorMetadataMs = 0

  if (includeCreatorMetadata) {
    const creatorMetadataStartedAt = nowMs()
    creatorMetadata = await loadRecycleBinCreatorMetadata(adminClient, teamId, data ?? [])
    creatorMetadataMs = nowMs() - creatorMetadataStartedAt
  }

  const mapStartedAt = nowMs()
  const mappedRows = (data ?? [])
    .map((row) => {
      const mappedRow = mapRecycleBinViewRow(row)

      if (!mappedRow) {
        return null
      }

      const creatorKey = buildWorkspaceTransactionCreatorKey(row?.source_type, row?.id)
      const creatorInfo = creatorMetadata.get(creatorKey) ?? null

      return creatorInfo ? { ...mappedRow, ...creatorInfo } : mappedRow
    })
    .filter(Boolean)
  const mapMs = nowMs() - mapStartedAt
  const totalMs = nowMs() - startedAt
  const timing = debugTiming
    ? {
        queryMs,
        creatorMetadataMs,
        mapMs,
        totalMs,
      }
    : null

  if (fetchAll) {
    return {
      rows: mappedRows,
      pageInfo: {
        hasMore: false,
        nextCursor: null,
        totalCount: mappedRows.length,
      },
      timing,
    }
  }

  const hasMore = mappedRows.length > normalizedLimit
  const pageRows = hasMore ? mappedRows.slice(0, normalizedLimit) : mappedRows
  const nextCursorRow = hasMore ? data?.[normalizedLimit - 1] ?? null : null

  return {
    rows: pageRows,
    pageInfo: {
      hasMore,
      nextCursor: hasMore ? encodeRecycleBinCursor(nextCursorRow) : null,
      totalCount: pageRows.length + (hasMore ? 1 : 0),
    },
    timing,
  }
}

async function loadRecycleBinRecords(
  adminClient,
  teamId,
  {
    cursor = null,
    limit = 20,
    search = '',
    filter = 'all',
    fetchAll = false,
    debugTiming = false,
  } = {}
) {
  return loadRecycleBinViewRows(adminClient, teamId, {
    cursor,
    limit,
    search,
    filter,
    fetchAll,
    debugTiming,
  })
}

function decodeWorkspaceCursor(cursor) {
  const normalizedCursor = normalizeText(cursor, '')

  if (!normalizedCursor) {
    return null
  }

  try {
    const decoded = JSON.parse(Buffer.from(normalizedCursor, 'base64url').toString('utf8'))

    if (!decoded || !Number.isFinite(Number(decoded.timestamp)) || !normalizeText(decoded.id, '')) {
      return null
    }

    return {
      timestamp: Number(decoded.timestamp),
      id: String(decoded.id),
    }
  } catch {
    return null
  }
}

function shouldPaginateWorkspaceTransactions(query = {}) {
  return (
    Object.prototype.hasOwnProperty.call(query, 'limit') ||
    Object.prototype.hasOwnProperty.call(query, 'cursor') ||
    normalizeText(query?.search, '').length > 0 ||
    normalizeText(query?.filter, 'all') !== 'all'
  )
}

function shouldPaginateRecycleBinTransactions(query = {}) {
  return (
    Object.prototype.hasOwnProperty.call(query, 'limit') ||
    Object.prototype.hasOwnProperty.call(query, 'cursor') ||
    normalizeText(query?.search, '').length > 0 ||
    normalizeText(query?.filter, 'all') !== 'all'
  )
}

async function loadOperationalSummary(adminClient, teamId, { debugTiming = false } = {}) {
  const startedAt = nowMs()
  const cashMutations = await loadCashMutations(adminClient, teamId)
  const timing = debugTiming
    ? {
        summaryMs: nowMs() - startedAt,
        cashMutationCount: cashMutations.length,
      }
    : null

  return {
    summary: buildSummary(cashMutations),
    timing,
  }
}

function mapCashMutationRow(mutation) {
  return {
    ...mutation,
    amount: Number(mutation?.amount) || 0,
    canRestore: Boolean(mutation?.deleted_at),
    canPermanentDelete: Boolean(mutation?.deleted_at),
  }
}

function mapProjectIncomeRow(row) {
  return mapCashMutationRow({
    id: row.id,
    sourceType: 'project-income',
    type: 'income',
    amount: row.amount,
    transaction_date: row.transaction_date ?? row.income_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    description: row.description,
    project_name: row.project_name_snapshot,
    party_label: null,
    related_id: row.project_id ?? null,
    deleted_at: row.deleted_at ?? null,
  })
}

function mapLoanRow(row) {
  const loanTermsSnapshot = buildLoanTermsSnapshot(row)
  const repaymentAmount = toNumber(
    row?.repayment_amount ?? loanTermsSnapshot.repayment_amount,
    0
  )
  const paidAmount = toNumber(row?.paid_amount, 0)
  const lateChargeSummary = buildLoanLateChargeSummary(row)
  return mapCashMutationRow({
    id: row.id,
    sourceType: 'loan-disbursement',
    type: 'income',
    amount: loanTermsSnapshot.principal_amount ?? row.principal_amount ?? row.amount,
    transaction_date: row.transaction_date ?? row.disbursed_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    description: row.description,
    project_name: null,
    party_label: row.creditor_name_snapshot,
    related_id: null,
    deleted_at: row.deleted_at ?? null,
    paid_amount: paidAmount,
    remaining_amount: Math.max(repaymentAmount - paidAmount, 0),
    remainingAmount: Math.max(repaymentAmount - paidAmount, 0),
    repayment_amount: repaymentAmount,
    base_repayment_amount: loanTermsSnapshot.base_repayment_amount,
    due_date: loanTermsSnapshot.due_date,
    loan_terms_snapshot: row.loan_terms_snapshot ?? loanTermsSnapshot,
    late_charge_summary: lateChargeSummary,
    lateChargeSummary,
  })
}

function mapBillPaymentRow(row) {
  return mapCashMutationRow({
    id: row.id,
    sourceType: 'bill-payment',
    type: 'expense',
    amount: row.amount,
    transaction_date: row.payment_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    description: row.notes,
    project_name: row.project_name_snapshot,
    party_label: row.supplier_name_snapshot ?? row.worker_name_snapshot ?? null,
    related_id: row.bill_id ?? null,
    deleted_at: row.deleted_at ?? null,
  })
}

function mapLoanPaymentRow(row) {
  return mapCashMutationRow({
    id: row.id,
    sourceType: 'loan-payment',
    type: 'expense',
    amount: row.amount,
    transaction_date: row.payment_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    description: row.notes,
    project_name: null,
    party_label: row.creditor_name_snapshot,
    related_id: row.loan_id ?? null,
    deleted_at: row.deleted_at ?? null,
  })
}

function normalizeLoanPaymentRow(row) {
  return {
    ...row,
    amount: Number(row?.amount) || 0,
    deleted_at: row?.deleted_at ?? null,
  }
}

function mapBillRecycleRow(row) {
  const isPayrollBill = normalizeText(row?.bill_type, '').toLowerCase() === 'gaji'

  return mapCashMutationRow({
    id: row.id,
    sourceType: 'bill',
    type: 'expense',
    amount: row.amount,
    transaction_date: row.due_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    description: isPayrollBill ? 'Tagihan Upah' : row.description,
    billDescription: row.description,
    project_name: row.project_name_snapshot ?? null,
    party_label: isPayrollBill
      ? row.worker_name_snapshot ?? row.supplier_name_snapshot ?? null
      : row.supplier_name_snapshot ?? row.worker_name_snapshot ?? null,
    related_id: row.expense_id ?? row.project_income_id ?? null,
    deleted_at: row.deleted_at ?? null,
  })
}

function normalizeBillSummaryRow(row) {
  if (!row?.id) {
    return null
  }

  const amount = toNumber(row?.amount)
  const paidAmount = toNumber(row?.paid_amount)

  return {
    id: row.id ?? null,
    expenseId: row.expense_id ?? null,
    projectIncomeId: row.project_income_id ?? null,
    billType: row.bill_type ?? null,
    description: row.description ?? null,
    amount,
    paidAmount,
    remainingAmount: Math.max(amount - paidAmount, 0),
    dueDate: row.due_date ?? null,
    status: normalizeText(row?.status, 'unpaid'),
    paidAt: row.paid_at ?? null,
    deletedAt: row.deleted_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    supplierName:
      row?.supplier_name_snapshot ?? row?.worker_name_snapshot ?? 'Tagihan belum terhubung',
    projectName: row?.project_name_snapshot ?? 'Proyek belum terhubung',
  }
}

function mapWorkspaceProjectIncomeRow(row) {
  const feeBillPaidAmount = toNumber(row?.fee_bill_paid_amount)

  return {
    ...mapProjectIncomeRow(row),
    sort_at: row?.sort_at ?? row?.updated_at ?? row?.created_at ?? null,
    bill_paid_at: null,
    bill: null,
    bill_count: 0,
    ledger_summary: null,
    sourceType: 'project-income',
    canView: true,
    canEdit: feeBillPaidAmount <= 0,
    canDelete: feeBillPaidAmount <= 0,
    detailRoute: `/transactions/${row.id}`,
    editRoute: `/edit/project-income/${row.id}`,
  }
}

function mapWorkspaceLoanRow(row) {
  const paymentAmount = toNumber(row?.paid_amount)
  const loanAmount = toNumber(
    row?.loan_terms_snapshot?.repayment_amount ??
      row?.loan_terms_snapshot?.base_repayment_amount ??
      row?.repayment_amount ??
      row?.principal_amount ??
      row?.amount
  )
  const remainingAmount = Math.max(loanAmount - paymentAmount, 0)

  return {
    ...mapLoanRow(row),
    sort_at: row?.sort_at ?? row?.updated_at ?? row?.created_at ?? null,
    sourceType: 'loan-disbursement',
    canView: true,
    canEdit: paymentAmount <= 0,
    canDelete: paymentAmount <= 0,
    paid_amount: paymentAmount,
    remainingAmount,
    detailRoute: `/transactions/${row.id}`,
    editRoute: `/edit/loan/${row.id}`,
  }
}

function mapWorkspaceExpenseRow(row) {
  const hasPaidBill = toNumber(row?.bill_paid_amount) > 0
  const detailRoute = `/transactions/${row.id}`

  return {
    ...normalizeExpenseRow(row),
    sort_at: row?.sort_at ?? row?.bill_paid_at ?? row?.updated_at ?? row?.created_at ?? null,
    amount: toNumber(row?.amount ?? row?.total_amount),
    transaction_date: row?.expense_date ?? row?.created_at ?? null,
    type: 'expense',
    sourceType: 'expense',
    canView: true,
    canEdit: true,
    canDelete: !hasPaidBill,
    detailRoute,
    editRoute: `/edit/expense/${row.id}`,
  }
}

function mapWorkspaceSalaryBillRow(row) {
  const bill = normalizeBillSummaryRow(row)

  if (!bill || bill.billType !== 'gaji') {
    return null
  }

  return {
    ...bill,
    sort_at: row?.sort_at ?? bill?.paidAt ?? bill?.updatedAt ?? bill?.createdAt ?? null,
    bill_paid_at: row?.bill_paid_at ?? bill?.paidAt ?? null,
    amount: toNumber(bill.amount),
    transaction_date: bill.dueDate ?? bill.createdAt ?? bill.paidAt ?? null,
    type: 'expense',
    sourceType: 'bill',
    canView: true,
    canEdit: false,
    canDelete: false,
    canPay: bill.status !== 'paid',
    billType: bill.billType,
    description: 'Tagihan Upah',
    billDescription: bill.description ?? null,
    project_name: bill.projectName ?? null,
    party_label: bill.supplierName ?? null,
    detailRoute: `/transactions/${bill.id}`,
    editRoute: null,
  }
}

function mapWorkspaceTransactionViewRow(row) {
  const sourceType = normalizeText(row?.source_type, '')

  if (!sourceType) {
    return null
  }

  if (sourceType === 'project-income') {
    return mapWorkspaceProjectIncomeRow(
      {
        id: row.id,
        team_id: row.team_id,
        project_id: null,
        sort_at: row.sort_at ?? null,
        transaction_date: row.transaction_date ?? row.sort_at ?? null,
        income_date: row.income_date ?? null,
        amount: row.amount,
        description: row.description,
        created_at: row.created_at,
        updated_at: row.updated_at,
        project_name_snapshot: row.project_name_snapshot,
        bill_paid_amount: row.bill_paid_amount,
        bill_paid_at: row.bill_paid_at,
        deleted_at: null,
      },
    )
  }

  if (sourceType === 'expense') {
    return mapWorkspaceExpenseRow(
      {
        id: row.id,
        team_id: row.team_id,
        sort_at: row.sort_at ?? null,
        expense_date: row.expense_date ?? row.sort_at ?? null,
        amount: row.amount,
        total_amount: row.amount,
        description: row.description,
        created_at: row.created_at,
        updated_at: row.updated_at,
        project_name_snapshot: row.project_name_snapshot,
        supplier_name_snapshot: row.supplier_name_snapshot,
        expense_type: row.expense_type,
        document_type: row.document_type,
        bill_id: row.bill_id,
        bill_type: row.bill_type,
        bill_status: row.bill_status,
        bill_amount: row.bill_amount,
        bill_paid_amount: row.bill_paid_amount,
        bill_remaining_amount: row.bill_remaining_amount,
        bill_due_date: row.bill_due_date,
        bill_paid_at: row.bill_paid_at,
        bill_description: row.bill_description,
        bill_project_name_snapshot: row.bill_project_name_snapshot,
        bill_supplier_name_snapshot: row.bill_supplier_name_snapshot,
        bill_worker_name_snapshot: row.bill_worker_name_snapshot,
        deleted_at: null,
      },
    )
  }

  if (sourceType === 'loan-disbursement') {
    return mapWorkspaceLoanRow({
      id: row.id,
      team_id: row.team_id,
      sort_at: row.sort_at ?? null,
      transaction_date: row.transaction_date ?? row.sort_at ?? null,
      disbursed_date: row.transaction_date ?? row.sort_at ?? null,
      amount: row.amount,
      principal_amount: row.amount,
      repayment_amount: row.bill_amount,
      status: row.bill_status,
      paid_amount: row.bill_paid_amount,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at,
      creditor_name_snapshot: row.creditor_name_snapshot,
      loan_terms_snapshot: null,
      deleted_at: null,
    })
  }

  if (sourceType === 'bill') {
    return mapWorkspaceSalaryBillRow({
      id: row.bill_id ?? row.id,
      expense_id: null,
      project_income_id: null,
      sort_at: row.sort_at ?? null,
      bill_type: row.bill_type ?? 'gaji',
      description: row.bill_description ?? row.description,
      amount: row.bill_amount ?? row.amount,
      paid_amount: row.bill_paid_amount ?? 0,
      due_date: row.bill_due_date ?? null,
      status: row.bill_status ?? null,
      paid_at: row.bill_paid_at ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      supplier_name_snapshot: row.bill_supplier_name_snapshot ?? row.supplier_name_snapshot,
      project_name_snapshot: row.bill_project_name_snapshot ?? row.project_name_snapshot,
      worker_name_snapshot: row.bill_worker_name_snapshot ?? row.worker_name_snapshot,
      deleted_at: null,
    })
  }

  return null
}

function buildWorkspaceTransactionCreatorKey(sourceType, id) {
  return `${normalizeText(sourceType, '')}:${String(id ?? '')}`
}

function getAuthUserMetadata(authUser) {
  return authUser?.user_metadata ?? authUser?.raw_user_meta_data ?? authUser?.metadata ?? null
}

function formatCompactIdentifier(value) {
  const normalizedValue = normalizeText(value, '')

  if (!normalizedValue) {
    return ''
  }

  if (normalizedValue.length <= 12) {
    return normalizedValue
  }

  return `${normalizedValue.slice(0, 8)}…${normalizedValue.slice(-4)}`
}

function buildCreatorDisplayName(metadata = null, fallbackTelegramUserId = null) {
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

async function loadAuthUsersByIds(adminClient, authUserIds = []) {
  const uniqueAuthUserIds = [
    ...new Set(authUserIds.map((value) => normalizeText(value, null)).filter(Boolean)),
  ]

  if (uniqueAuthUserIds.length === 0 || !adminClient?.auth?.admin?.getUserById) {
    return new Map()
  }

  const results = await Promise.all(
    uniqueAuthUserIds.map(async (authUserId) => {
      const { data, error } = await adminClient.auth.admin.getUserById(authUserId)

      if (error) {
        const normalizedMessage = String(error.message ?? '').toLowerCase()

        if (!normalizedMessage.includes('not found')) {
          throw error
        }
      }

      return [authUserId, data?.user ?? null]
    })
  )

  return new Map(results)
}

async function loadProfileIdsByTelegramUserIds(adminClient, telegramUserIds = []) {
  const uniqueTelegramUserIds = [
    ...new Set(telegramUserIds.map((value) => normalizeText(value, null)).filter(Boolean)),
  ]

  if (uniqueTelegramUserIds.length === 0) {
    return new Map()
  }

  const { data, error } = await adminClient
    .from('profiles')
    .select('id, telegram_user_id')
    .in('telegram_user_id', uniqueTelegramUserIds)

  if (error) {
    throw error
  }

  return new Map(
    (data ?? []).map((row) => [
      normalizeText(row?.telegram_user_id, null),
      normalizeText(row?.id, null),
    ])
  )
}

async function loadCreatorMetadataFromRows(adminClient, sourceRows = []) {
  const uniqueAuthUserIds = new Set()
  const uniqueTelegramUserIds = new Set()
  const rowIndex = new Map()

  for (const row of sourceRows) {
    const sourceType = normalizeText(row?.sourceType, '')
    const id = String(row?.id ?? '')

    if (!sourceType || !id) {
      continue
    }

    const creatorKey = buildWorkspaceTransactionCreatorKey(sourceType, id)
    const createdByUserId = normalizeText(
      row?.created_by_user_id ?? row?.createdByUserId ?? row?.uploaded_by_user_id ?? null,
      null
    )
    const telegramUserId = normalizeText(
      row?.telegram_user_id ?? row?.telegramUserId ?? row?.uploaded_by ?? null,
      null
    )

    if (createdByUserId) {
      uniqueAuthUserIds.add(createdByUserId)
    }

    if (telegramUserId) {
      uniqueTelegramUserIds.add(telegramUserId)
    }

    rowIndex.set(creatorKey, {
      sourceType,
      id,
      createdByUserId,
      telegramUserId,
    })
  }

  const profileIdByTelegramUserId = await loadProfileIdsByTelegramUserIds(
    adminClient,
    [...uniqueTelegramUserIds]
  )

  for (const profileId of profileIdByTelegramUserId.values()) {
    if (profileId) {
      uniqueAuthUserIds.add(profileId)
    }
  }

  const authUserById = await loadAuthUsersByIds(adminClient, [...uniqueAuthUserIds])
  const creatorMetadata = new Map()

  for (const [creatorKey, creatorReference] of rowIndex.entries()) {
    const resolvedAuthUserId =
      creatorReference.createdByUserId ??
      profileIdByTelegramUserId.get(creatorReference.telegramUserId ?? '') ??
      null
    const authUser = resolvedAuthUserId ? authUserById.get(resolvedAuthUserId) ?? null : null
    const metadata = getAuthUserMetadata(authUser)

    creatorMetadata.set(creatorKey, {
      telegram_user_id: creatorReference.telegramUserId ?? null,
      created_by_user_id: creatorReference.createdByUserId ?? null,
      creator_display_name: buildCreatorDisplayName(metadata, creatorReference.telegramUserId),
    })
  }

  return creatorMetadata
}

async function loadWorkspaceTransactionCreatorMetadata(adminClient, teamId, rows = []) {
  const projectIncomeIds = []
  const expenseIds = []
  const loanIds = []
  const billIds = []

  for (const row of rows) {
    const sourceType = normalizeText(row?.source_type, '')
    const id = String(row?.id ?? '')

    if (!id) {
      continue
    }

    if (sourceType === 'project-income') {
      projectIncomeIds.push(id)
      continue
    }

    if (sourceType === 'expense') {
      expenseIds.push(id)
      continue
    }

    if (sourceType === 'loan-disbursement') {
      loanIds.push(id)
      continue
    }

    if (sourceType === 'bill') {
      billIds.push(id)
    }
  }

  const queryTasks = []

  if (projectIncomeIds.length > 0) {
    queryTasks.push({
      sourceType: 'project-income',
      promise: adminClient
        .from('project_incomes')
        .select('id, telegram_user_id, created_by_user_id, team_id')
        .eq('team_id', teamId)
        .in('id', projectIncomeIds),
    })
  }

  if (expenseIds.length > 0) {
    queryTasks.push({
      sourceType: 'expense',
      promise: adminClient
        .from('expenses')
        .select('id, telegram_user_id, created_by_user_id, team_id')
        .eq('team_id', teamId)
        .in('id', expenseIds),
    })
  }

  if (loanIds.length > 0) {
    queryTasks.push({
      sourceType: 'loan-disbursement',
      promise: adminClient
        .from('loans')
        .select('id, telegram_user_id, created_by_user_id, team_id')
        .eq('team_id', teamId)
        .in('id', loanIds),
    })
  }

  if (billIds.length > 0) {
    queryTasks.push({
      sourceType: 'bill',
      promise: adminClient
        .from('bills')
        .select('id, telegram_user_id, team_id')
        .eq('team_id', teamId)
        .in('id', billIds),
    })
  }

  if (queryTasks.length === 0) {
    return new Map()
  }

  const results = await Promise.all(queryTasks.map((task) => task.promise))

  for (const result of results) {
    if (result.error) {
      throw result.error
    }
  }

  const sourceRows = []

  results.forEach((result, index) => {
    const sourceType = queryTasks[index]?.sourceType ?? null

    if (!sourceType) {
      return
    }

    for (const row of result?.data ?? []) {
      sourceRows.push({
        sourceType,
        id: row.id,
        telegram_user_id: row.telegram_user_id ?? null,
        created_by_user_id:
          sourceType === 'bill' ? null : row.created_by_user_id ?? null,
      })
    }
  })

  return loadCreatorMetadataFromRows(adminClient, sourceRows)
}

async function loadRecycleBinCreatorMetadata(adminClient, teamId, rows = []) {
  const projectIncomeIds = []
  const expenseIds = []
  const loanIds = []
  const billIds = []
  const billPaymentIds = []
  const loanPaymentIds = []
  const attachmentIds = []

  for (const row of rows) {
    const sourceType = normalizeText(row?.sourceType, '')
    const id = String(row?.id ?? '')

    if (!sourceType || !id) {
      continue
    }

    if (sourceType === 'project-income') {
      projectIncomeIds.push(id)
      continue
    }

    if (sourceType === 'expense') {
      expenseIds.push(id)
      continue
    }

    if (sourceType === 'loan-disbursement') {
      loanIds.push(id)
      continue
    }

    if (sourceType === 'bill') {
      billIds.push(id)
      continue
    }

    if (sourceType === 'bill-payment') {
      billPaymentIds.push(id)
      continue
    }

    if (sourceType === 'loan-payment') {
      loanPaymentIds.push(id)
      continue
    }

    if (sourceType === 'expense-attachment') {
      attachmentIds.push(id)
    }
  }

  const queryTasks = []

  if (projectIncomeIds.length > 0) {
    queryTasks.push({
      sourceType: 'project-income',
      promise: adminClient
        .from('project_incomes')
        .select('id, telegram_user_id, created_by_user_id, team_id')
        .eq('team_id', teamId)
        .in('id', projectIncomeIds),
    })
  }

  if (expenseIds.length > 0) {
    queryTasks.push({
      sourceType: 'expense',
      promise: adminClient
        .from('expenses')
        .select('id, telegram_user_id, created_by_user_id, team_id')
        .eq('team_id', teamId)
        .in('id', expenseIds),
    })
  }

  if (loanIds.length > 0) {
    queryTasks.push({
      sourceType: 'loan-disbursement',
      promise: adminClient
        .from('loans')
        .select('id, telegram_user_id, created_by_user_id, team_id')
        .eq('team_id', teamId)
        .in('id', loanIds),
    })
  }

  if (billIds.length > 0) {
    queryTasks.push({
      sourceType: 'bill',
      promise: adminClient
        .from('bills')
        .select('id, telegram_user_id, team_id')
        .eq('team_id', teamId)
        .in('id', billIds),
    })
  }

  if (billPaymentIds.length > 0) {
    queryTasks.push({
      sourceType: 'bill-payment',
      promise: adminClient
        .from('bill_payments')
        .select('id, telegram_user_id, team_id')
        .eq('team_id', teamId)
        .in('id', billPaymentIds),
    })
  }

  if (loanPaymentIds.length > 0) {
    queryTasks.push({
      sourceType: 'loan-payment',
      promise: adminClient
        .from('loan_payments')
        .select('id, telegram_user_id, team_id')
        .eq('team_id', teamId)
        .in('id', loanPaymentIds),
    })
  }

  if (attachmentIds.length > 0) {
    queryTasks.push({
      sourceType: 'expense-attachment',
      promise: adminClient
        .from('expense_attachments')
        .select(
          'id, team_id, file_asset_id, file_assets:file_asset_id ( uploaded_by_user_id, uploaded_by )'
        )
        .eq('team_id', teamId)
        .in('id', attachmentIds),
    })
  }

  if (queryTasks.length === 0) {
    return new Map()
  }

  const results = await Promise.all(queryTasks.map((task) => task.promise))

  for (const result of results) {
    if (result.error) {
      throw result.error
    }
  }

  const sourceRows = []

  results.forEach((result, index) => {
    const sourceType = queryTasks[index]?.sourceType ?? null

    if (!sourceType) {
      return
    }

    for (const row of result?.data ?? []) {
      const fileAsset = sourceType === 'expense-attachment' ? row?.file_assets ?? null : null

      sourceRows.push({
        sourceType,
        id: row.id,
        telegram_user_id: row.telegram_user_id ?? fileAsset?.uploaded_by ?? null,
        created_by_user_id: row.created_by_user_id ?? fileAsset?.uploaded_by_user_id ?? null,
      })
    }
  })

  return loadCreatorMetadataFromRows(adminClient, sourceRows)
}

function mapAttendanceRecycleRow(row) {
  const workerName = normalizeText(row.worker_name_snapshot, 'Pekerja')

  return mapCashMutationRow({
    id: row.id,
    sourceType: 'attendance-record',
    type: 'expense',
    amount: row.total_pay,
    transaction_date: row.attendance_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    description: `Absensi ${workerName}`,
    project_name: row.project_name_snapshot ?? null,
    party_label: workerName,
    related_id: row.project_id ?? row.worker_id ?? null,
    deleted_at: row.deleted_at ?? null,
  })
}

async function getAuthorizedContext(req, supabaseUrl, publishableKey) {
  const bearerToken = getBearerToken(req)

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      apikey: publishableKey,
    },
  })

  if (!authResponse.ok) {
    throw createHttpError(401, 'Sesi Supabase tidak valid.')
  }

  const authUser = await authResponse.json()

  if (!authUser?.id) {
    throw createHttpError(401, 'User Supabase tidak ditemukan.')
  }

  return {
    authUser,
    bearerToken,
  }
}

async function assertSessionTeamAccess(sessionClient, teamId) {
  const normalizedTeamId = normalizeText(teamId)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Team ID wajib diisi.')
  }

  const { data: team, error } = await sessionClient
    .from('teams')
    .select('id')
    .eq('id', normalizedTeamId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!team?.id) {
    throw createHttpError(403, 'Akses workspace tidak ditemukan.')
  }

  return normalizedTeamId
}

async function assertTeamAccess(adminClient, telegramUserId, teamId) {
  const normalizedTeamId = normalizeText(teamId)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Team ID wajib diisi.')
  }

  const { data: membership, error } = await adminClient
    .from('team_members')
    .select('id')
    .eq('telegram_user_id', telegramUserId)
    .eq('team_id', normalizedTeamId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!membership?.id) {
    throw createHttpError(403, 'Akses workspace tidak ditemukan.')
  }

  return normalizedTeamId
}

async function loadCashMutations(adminClient, teamId) {
  const [
    projectIncomesResult,
    loansResult,
    billPaymentsResult,
    loanPaymentsResult,
  ] = await Promise.all([
    adminClient
      .from('project_incomes')
      .select(
        'id, team_id, project_id, transaction_date, income_date, amount, description, created_at, updated_at, project_name_snapshot, deleted_at'
      )
      .eq('team_id', teamId)
      .is('deleted_at', null),
    adminClient
      .from('loans')
      .select(loanSelectColumns)
      .eq('team_id', teamId)
      .is('deleted_at', null),
    adminClient
      .from('bill_payments')
      .select(
        'id, bill_id, team_id, amount, payment_date, notes, created_at, updated_at, worker_name_snapshot, supplier_name_snapshot, project_name_snapshot, deleted_at'
      )
      .eq('team_id', teamId)
      .is('deleted_at', null),
    adminClient
      .from('loan_payments')
      .select(
        'id, loan_id, team_id, amount, payment_date, notes, created_at, updated_at, creditor_name_snapshot, deleted_at'
      )
      .eq('team_id', teamId)
      .is('deleted_at', null),
  ])

  const results = [
    projectIncomesResult,
    loansResult,
    billPaymentsResult,
    loanPaymentsResult,
  ]

  for (const result of results) {
    if (result.error) {
      throw result.error
    }
  }

  return sortCashMutations([
    ...(projectIncomesResult.data ?? []).map(mapProjectIncomeRow),
    ...(loansResult.data ?? []).map(mapLoanRow),
    ...(billPaymentsResult.data ?? []).map(mapBillPaymentRow),
    ...(loanPaymentsResult.data ?? []).map(mapLoanPaymentRow),
  ])
}

function getWorkspaceViewCursorTimestamp(row) {
  return new Date(
    String(row?.sort_at ?? row?.transaction_date ?? row?.expense_date ?? row?.disbursed_date ?? row?.created_at ?? '')
  ).getTime()
}

function encodeWorkspaceViewCursor(row) {
  const payload = {
    timestamp: getWorkspaceViewCursorTimestamp(row),
    id: String(row?.id ?? ''),
  }

  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function applyPaidBillVisibilityFilter(query, { includePaidBills = false } = {}) {
  if (includePaidBills) {
    return query
  }

  return query.or('source_type.neq.bill,and(source_type.eq.bill,bill_status.neq.paid)')
}

function applyWorkspaceTransactionViewFilter(
  query,
  filterValue,
  { includePaidBills = false } = {}
) {
  const normalizedFilter = normalizeText(filterValue, 'all')

  if (normalizedFilter === 'all') {
    return applyPaidBillVisibilityFilter(query, { includePaidBills })
  }

  if (normalizedFilter === 'expense') {
    return applyPaidBillVisibilityFilter(
      query
        .eq('source_type', 'expense')
        .not('expense_type', 'in', '(material,material_invoice)')
        .or('document_type.is.null,document_type.neq.surat_jalan'),
      { includePaidBills }
    )
  }

  if (normalizedFilter === 'material-invoice') {
    return applyPaidBillVisibilityFilter(
      query.eq('source_type', 'expense').in('expense_type', ['material', 'material_invoice']),
      { includePaidBills }
    )
  }

  if (normalizedFilter === 'surat-jalan') {
    return applyPaidBillVisibilityFilter(
      query.eq('source_type', 'expense').eq('document_type', 'surat_jalan'),
      { includePaidBills }
    )
  }

  return applyPaidBillVisibilityFilter(query.eq('source_type', normalizedFilter), {
    includePaidBills,
  })
}

function applyHistoryTransactionViewFilter(query, filterValue) {
  return applyWorkspaceTransactionViewFilter(query, filterValue, {
    includePaidBills: true,
  }).or('document_type.is.null,document_type.neq.surat_jalan')
}

function applyWorkspaceTransactionViewCursor(query, cursor) {
  const decodedCursor = decodeWorkspaceCursor(cursor)

  if (!decodedCursor) {
    return query
  }

  const cursorTimestamp = new Date(decodedCursor.timestamp).toISOString()

  return query.or(
    `sort_at.lt.${cursorTimestamp},and(sort_at.eq.${cursorTimestamp},id.lt.${decodedCursor.id})`
  )
}

function getWorkspaceViewSortValue(row) {
  return new Date(
    String(
      row?.sort_at ??
        row?.transaction_date ??
        row?.income_date ??
        row?.expense_date ??
        row?.due_date ??
        row?.created_at ??
        ''
    )
  ).getTime()
}

function compareWorkspaceViewRows(left, right) {
  const timestampDifference = getWorkspaceViewSortValue(right) - getWorkspaceViewSortValue(left)

  if (timestampDifference !== 0) {
    return timestampDifference
  }

  return String(right?.id ?? '').localeCompare(String(left?.id ?? ''))
}

export function aggregateProjectIncomeViewRows(rows = []) {
  const aggregatedRows = []
  const projectIncomeGroups = new Map()

  for (const row of rows) {
    if (normalizeText(row?.source_type, '') !== 'project-income') {
      aggregatedRows.push(row)
      continue
    }

    const groupKey = String(row?.id ?? '')

    if (!groupKey) {
      aggregatedRows.push(row)
      continue
    }

    const existingGroup = projectIncomeGroups.get(groupKey)
    const billAmount = toNumber(row?.bill_amount)
    const billPaidAmount = toNumber(row?.bill_paid_amount)
    const hasBill = normalizeText(row?.bill_id, null) !== null

    if (!existingGroup) {
      projectIncomeGroups.set(groupKey, {
        ...row,
        sort_at: row?.sort_at ?? null,
        bill_id: null,
        bill_type: null,
        bill_status: null,
        bill_amount: null,
        bill_paid_amount: null,
        bill_remaining_amount: null,
        bill_due_date: null,
        bill_paid_at: null,
        bill_description: null,
        bill_project_name_snapshot: null,
        bill_supplier_name_snapshot: null,
        bill_worker_name_snapshot: null,
        bill_ids: [],
        bill_count: 0,
        fee_bill_ids: hasBill ? [row.bill_id] : [],
        fee_bill_count: hasBill ? 1 : 0,
        fee_bill_amount: hasBill ? billAmount : 0,
        fee_bill_paid_amount: hasBill ? billPaidAmount : 0,
        search_text: normalizeText(row?.search_text, ''),
      })
      continue
    }

    const nextSearchParts = new Set(
      [existingGroup.search_text, normalizeText(row?.search_text, '')].filter(Boolean)
    )
    const nextSortAt =
      getWorkspaceViewSortValue(row) > getWorkspaceViewSortValue(existingGroup)
        ? row?.sort_at ?? existingGroup.sort_at ?? null
        : existingGroup.sort_at ?? row?.sort_at ?? null
    const nextFeeBillCount = existingGroup.fee_bill_count + (hasBill ? 1 : 0)
    const nextFeeBillAmount = existingGroup.fee_bill_amount + (hasBill ? billAmount : 0)
    const nextFeeBillPaidAmount =
      existingGroup.fee_bill_paid_amount + (hasBill ? billPaidAmount : 0)

    projectIncomeGroups.set(groupKey, {
      ...existingGroup,
      sort_at: nextSortAt,
      fee_bill_ids: hasBill
        ? [...existingGroup.fee_bill_ids, row.bill_id]
        : existingGroup.fee_bill_ids,
      fee_bill_count: nextFeeBillCount,
      fee_bill_amount: nextFeeBillAmount,
      fee_bill_paid_amount: nextFeeBillPaidAmount,
      search_text: [...nextSearchParts].join(' '),
    })
  }

  return [...aggregatedRows, ...projectIncomeGroups.values()].sort(compareWorkspaceViewRows)
}

function applyWorkspaceCursorToRows(rows = [], cursor = null) {
  const decodedCursor = decodeWorkspaceCursor(cursor)

  if (!decodedCursor) {
    return rows
  }

  const cursorTimestamp = Number(decodedCursor.timestamp)
  const cursorId = String(decodedCursor.id)

  return rows.filter((row) => {
    const rowTimestamp = getWorkspaceViewSortValue(row)
    const rowId = String(row?.id ?? '')

    if (rowTimestamp < cursorTimestamp) {
      return true
    }

    if (rowTimestamp > cursorTimestamp) {
      return false
    }

    return rowId.localeCompare(cursorId) < 0
  })
}

function buildTransactionViewQuery(
  adminClient,
  viewName,
  teamId,
  {
    cursor = null,
    limit = 20,
    search = '',
    filter = 'all',
    fetchAll = false,
    transactionId = null,
    ignoreLedgerVisibility = false,
  } = {}
) {
  const normalizedLimit = Number.isFinite(Number(limit))
    ? Math.min(Math.max(Number(limit), 1), 100)
    : 20
  const normalizedSearch = normalizeText(search, '').toLowerCase()

  const selectColumns =
    viewName === 'vw_history_transactions'
      ? historyTransactionViewSelectColumns
      : workspaceTransactionViewSelectColumns

  let query = adminClient.from(viewName).select(selectColumns).eq('team_id', teamId)

  if (!ignoreLedgerVisibility) {
    query =
      viewName === 'vw_history_transactions'
        ? applyHistoryTransactionViewFilter(query, filter)
        : applyWorkspaceTransactionViewFilter(query, filter)
  }

  if (transactionId) {
    query = query.eq('id', normalizeText(transactionId))
  }

  if (normalizedSearch) {
    query = query.ilike('search_text', `%${normalizedSearch}%`)
  }

  if (cursor) {
    query = applyWorkspaceTransactionViewCursor(query, cursor)
  }

  query = query.order('sort_at', { ascending: false }).order('id', { ascending: false })

  if (!fetchAll) {
    query = query.limit(normalizedLimit + 1)
  }

  return {
    normalizedLimit,
    query,
  }
}

async function loadTransactionViewRows(
  adminClient,
  viewName,
  teamId,
  {
    cursor = null,
    limit = 20,
    search = '',
    filter = 'all',
    fetchAll = false,
    includeCreatorMetadata = false,
    debugTiming = false,
    transactionId = null,
  } = {}
) {
  const startedAt = nowMs()
  const shouldAggregateProjectIncome = [
    'vw_workspace_transactions',
    'vw_history_transactions',
  ].includes(viewName)
  const { normalizedLimit, query } = buildTransactionViewQuery(
    adminClient,
    viewName,
    teamId,
    {
      cursor: shouldAggregateProjectIncome ? null : cursor,
      limit,
      search,
      filter,
      fetchAll: shouldAggregateProjectIncome ? true : fetchAll,
      transactionId,
      ignoreLedgerVisibility: Boolean(transactionId),
    }
  )
  const queryStartedAt = nowMs()
  const { data, error } = await query
  const queryMs = nowMs() - queryStartedAt

  if (error) {
    throw error
  }

  const normalizedRows = shouldAggregateProjectIncome
    ? aggregateProjectIncomeViewRows(data ?? [])
    : data ?? []
  const visibilityOptions = getTransactionLedgerVisibilityOptions(
    viewName === 'vw_history_transactions' ? 'history' : 'workspace'
  )
  const visibleRows =
    transactionId != null
      ? normalizedRows
      : normalizedRows.filter((row) =>
          matchesTransactionLedgerFilter(row, filter, visibilityOptions)
        )

  let creatorMetadata = new Map()
  let creatorMetadataMs = 0

  if (includeCreatorMetadata) {
    const creatorMetadataStartedAt = nowMs()
    creatorMetadata = await loadWorkspaceTransactionCreatorMetadata(adminClient, teamId, visibleRows)
    creatorMetadataMs = nowMs() - creatorMetadataStartedAt
  }

  const mapStartedAt = nowMs()
  const mappedRows = visibleRows
    .map((row) => {
      const mappedRow = mapWorkspaceTransactionViewRow(row)

      if (!mappedRow) {
        return null
      }

      const creatorKey = buildWorkspaceTransactionCreatorKey(row?.source_type, row?.id)
      const creatorInfo = creatorMetadata.get(creatorKey) ?? null

      return creatorInfo ? { ...mappedRow, ...creatorInfo } : mappedRow
    })
    .filter(Boolean)
  const mapMs = nowMs() - mapStartedAt
  const totalMs = nowMs() - startedAt
  const timing = debugTiming
    ? {
        queryMs,
        creatorMetadataMs,
        mapMs,
        totalMs,
      }
    : null

  if (fetchAll) {
    return {
      rows: mappedRows,
      pageInfo: {
        hasMore: false,
        nextCursor: null,
        totalCount: mappedRows.length,
      },
      timing,
    }
  }

  const cursorFilteredRows = applyWorkspaceCursorToRows(mappedRows, cursor)
  const hasMore = cursorFilteredRows.length > normalizedLimit
  const pageRows = hasMore ? cursorFilteredRows.slice(0, normalizedLimit) : cursorFilteredRows
  const nextCursorRow = hasMore ? cursorFilteredRows[normalizedLimit - 1] ?? null : null

  return {
    rows: pageRows,
    pageInfo: {
      hasMore,
      nextCursor: hasMore ? encodeWorkspaceViewCursor(nextCursorRow) : null,
      totalCount: cursorFilteredRows.length,
    },
    timing,
  }
}

async function loadWorkspaceTransactionViewRows(
  adminClient,
  teamId,
  {
    cursor = null,
    limit = 20,
    search = '',
    filter = 'all',
    fetchAll = false,
    includeCreatorMetadata = false,
    debugTiming = false,
    transactionId = null,
  } = {}
) {
  return loadTransactionViewRows(adminClient, 'vw_workspace_transactions', teamId, {
    cursor,
    limit,
    search,
    filter,
    fetchAll,
    includeCreatorMetadata,
    debugTiming,
    transactionId,
  })
}

async function loadWorkspaceTransactionViewRecord(
  adminClient,
  teamId,
  transactionId,
  { includeCreatorMetadata = true, debugTiming = false } = {}
) {
  const { rows, timing } = await loadWorkspaceTransactionViewRows(adminClient, teamId, {
    fetchAll: true,
    transactionId,
    includeCreatorMetadata,
    debugTiming,
  })

  return {
    record: rows[0] ?? null,
    timing,
  }
}

async function loadHistoryTransactionViewRecord(
  adminClient,
  teamId,
  transactionId,
  { includeCreatorMetadata = true, debugTiming = false } = {}
) {
  const { rows, timing } = await loadTransactionViewRows(adminClient, 'vw_history_transactions', teamId, {
    fetchAll: true,
    transactionId,
    includeCreatorMetadata,
    debugTiming,
  })

  return {
    record: rows[0] ?? null,
    timing,
  }
}

async function loadWorkspaceTransactions(adminClient, teamId, { debugTiming = false } = {}) {
  const { rows, timing } = await loadWorkspaceTransactionViewRows(adminClient, teamId, {
    fetchAll: true,
    includeCreatorMetadata: true,
    debugTiming,
  })

  return {
    rows,
    timing,
  }
}

async function loadHistoryTransactions(adminClient, teamId, { debugTiming = false } = {}) {
  const { rows, timing } = await loadTransactionViewRows(adminClient, 'vw_history_transactions', teamId, {
    fetchAll: true,
    includeCreatorMetadata: true,
    debugTiming,
  })

  return {
    rows,
    timing,
  }
}

async function loadLoanPaymentById(adminClient, paymentId, { includeDeleted = true } = {}) {
  const normalizedPaymentId = normalizeText(paymentId)

  if (!normalizedPaymentId) {
    throw createHttpError(400, 'Loan payment ID tidak valid.')
  }

  let query = adminClient
    .from('loan_payments')
    .select(
      'id, loan_id, team_id, telegram_user_id, amount, payment_date, notes, created_at, updated_at, deleted_at, creditor_name_snapshot'
    )
    .eq('id', normalizedPaymentId)

  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw error
  }

  return data ? normalizeLoanPaymentRow(data) : null
}

async function loadLoanPaymentsByLoanId(adminClient, loanId, { includeDeleted = false } = {}) {
  const normalizedLoanId = normalizeText(loanId)

  if (!normalizedLoanId) {
    throw createHttpError(400, 'Loan ID tidak valid.')
  }

  let query = adminClient
    .from('loan_payments')
    .select(
      'id, loan_id, team_id, telegram_user_id, amount, payment_date, notes, created_at, updated_at, deleted_at, creditor_name_snapshot'
    )
    .eq('loan_id', normalizedLoanId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []).map(normalizeLoanPaymentRow)
}

async function loadDeletedLoanPayments(adminClient, teamId) {
  const normalizedTeamId = normalizeText(teamId)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Team ID wajib diisi.')
  }

  const { data, error } = await adminClient
    .from('loan_payments')
    .select(
      'id, loan_id, team_id, telegram_user_id, amount, payment_date, notes, created_at, updated_at, deleted_at, creditor_name_snapshot'
    )
    .eq('team_id', normalizedTeamId)
    .not('deleted_at', 'is', null)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const loanIds = [...new Set((data ?? []).map((row) => normalizeText(row?.loan_id, null)).filter(Boolean))]

  if (loanIds.length === 0) {
    return []
  }

  const { data: loans, error: loansError } = await adminClient
    .from('loans')
    .select('id, deleted_at')
    .in('id', loanIds)

  if (loansError) {
    throw loansError
  }

  const activeLoanIds = new Set(
    (loans ?? [])
      .filter((loan) => !loan?.deleted_at)
      .map((loan) => String(loan.id))
  )

  return (data ?? [])
    .filter((row) => activeLoanIds.has(String(row.loan_id ?? '')))
    .map(normalizeLoanPaymentRow)
}

async function syncLoanStatusFromPayments(adminClient, loanId) {
  const normalizedLoanId = normalizeText(loanId)

  if (!normalizedLoanId) {
    throw createHttpError(400, 'Loan ID tidak valid.')
  }

  const [loanResult, paymentResult] = await Promise.all([
    adminClient
      .from('loans')
      .select(
        'id, amount, principal_amount, repayment_amount, status, paid_amount, team_id, deleted_at, loan_terms_snapshot, late_interest_rate, late_interest_basis, late_penalty_type, late_penalty_amount, transaction_date, disbursed_date, interest_type, interest_rate, tenor_months, creditor_name_snapshot'
      )
      .eq('id', normalizedLoanId)
      .maybeSingle(),
    adminClient
      .from('loan_payments')
      .select('amount')
      .eq('loan_id', normalizedLoanId)
      .is('deleted_at', null),
  ])

  if (loanResult.error) {
    throw loanResult.error
  }

  if (paymentResult.error) {
    throw paymentResult.error
  }

  if (!loanResult.data) {
    throw createHttpError(404, 'Pinjaman tidak ditemukan.')
  }

  const totalPaid = (paymentResult.data ?? []).reduce(
    (sum, row) => sum + Number(row?.amount ?? 0),
    0
  )
  const targetAmount = getLoanPaymentTargetAmount(loanResult.data)

  const { data: updatedLoan, error } = await adminClient
    .from('loans')
    .update({
      paid_amount: totalPaid,
      status:
        targetAmount > 0 && totalPaid >= targetAmount
          ? 'paid'
          : totalPaid > 0
            ? 'partial'
            : 'unpaid',
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedLoanId)
    .select(
      'id, amount, principal_amount, repayment_amount, status, paid_amount, team_id, deleted_at, loan_terms_snapshot, late_interest_rate, late_interest_basis, late_penalty_type, late_penalty_amount, transaction_date, disbursed_date, interest_type, interest_rate, tenor_months, creditor_name_snapshot'
    )
    .single()

  if (error) {
    throw error
  }

  return updatedLoan
}

function getLoanPaymentTargetAmount(loan) {
  return Number(
    loan?.loan_terms_snapshot?.repayment_amount ??
      loan?.loan_terms_snapshot?.base_repayment_amount ??
      loan?.repayment_amount ??
      loan?.principal_amount ??
      loan?.amount ??
      0
  )
}

function assertPaymentDoesNotOverpayParent(nextPaidAmount, targetAmount, message) {
  if (targetAmount > 0 && nextPaidAmount > targetAmount) {
    throw createHttpError(400, message)
  }
}

async function createLoanPayment(adminClient, body, telegramUserId) {
  const normalizedLoanId = normalizeText(body.loanId ?? body.loan_id ?? body.id, null)
  const teamId = normalizeText(body.teamId ?? body.team_id, null)
  const amount = Number(body.amount)
  const paymentDate = normalizeText(body.paymentDate ?? body.payment_date, null)
  const notes = normalizeText(body.notes, null)

  if (!normalizedLoanId) {
    throw createHttpError(400, 'Loan ID tidak valid.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createHttpError(400, 'Nominal pembayaran pinjaman harus lebih dari 0.')
  }

  if (!paymentDate) {
    throw createHttpError(400, 'Tanggal pembayaran wajib diisi.')
  }

  const { data: loan, error: loanError } = await adminClient
    .from('loans')
    .select(
      'id, team_id, amount, principal_amount, repayment_amount, status, paid_amount, deleted_at, loan_terms_snapshot, creditor_name_snapshot'
    )
    .eq('id', normalizedLoanId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loanError) {
    throw loanError
  }

  if (!loan?.id) {
    throw createHttpError(404, 'Pinjaman tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, teamId ?? loan.team_id)

  const { data: siblingPayments, error: siblingError } = await adminClient
    .from('loan_payments')
    .select('amount')
    .eq('loan_id', loan.id)
    .is('deleted_at', null)

  if (siblingError) {
    throw siblingError
  }

  const totalPaidBeforePayment = (siblingPayments ?? []).reduce(
    (sum, row) => sum + Number(row?.amount ?? 0),
    0
  )
  const targetAmount = getLoanPaymentTargetAmount(loan)
  const nextPaidAmount = totalPaidBeforePayment + amount

  if (targetAmount > 0 && nextPaidAmount > targetAmount) {
    throw createHttpError(400, 'Nominal pembayaran melebihi sisa pinjaman.')
  }

  const timestamp = new Date().toISOString()
  const { data: insertedPayment, error: insertError } = await adminClient
    .from('loan_payments')
    .insert({
      loan_id: loan.id,
      team_id: loan.team_id ?? teamId,
      telegram_user_id: telegramUserId,
      amount,
      payment_date: paymentDate,
      notes,
      creditor_name_snapshot: normalizeText(body.creditorName ?? loan.creditor_name_snapshot, null),
      updated_at: timestamp,
    })
    .select(
      'id, loan_id, team_id, telegram_user_id, amount, payment_date, notes, created_at, updated_at, deleted_at, creditor_name_snapshot'
    )
    .single()

  if (insertError) {
    throw insertError
  }

  const loanState = await syncLoanStatusFromPayments(adminClient, insertedPayment.loan_id)

  return {
    payment: normalizeLoanPaymentRow(insertedPayment),
    loan: loanState,
  }
}

async function restoreLoanPayment(adminClient, body, telegramUserId) {
  const normalizedPaymentId = normalizeText(body.paymentId ?? body.payment_id ?? body.id, null)
  const expectedUpdatedAt = normalizeText(
    body.expectedUpdatedAt ?? body.expected_updated_at,
    null
  )
  const teamId = normalizeText(body.teamId ?? body.team_id, null)

  if (!normalizedPaymentId) {
    throw createHttpError(400, 'Loan payment ID tidak valid.')
  }

  const existingPayment = await loadLoanPaymentById(adminClient, normalizedPaymentId, {
    includeDeleted: true,
  })

  if (!existingPayment) {
    throw createHttpError(404, 'Pembayaran pinjaman tidak ditemukan.')
  }

  assertOptimisticConcurrency(expectedUpdatedAt, existingPayment.updated_at, 'Pembayaran pinjaman')

  await assertTeamAccess(adminClient, telegramUserId, teamId ?? existingPayment.team_id)

  const { data: parentLoan, error: loanError } = await adminClient
    .from('loans')
    .select('id, amount, principal_amount, repayment_amount, loan_terms_snapshot, deleted_at')
    .eq('id', existingPayment.loan_id)
    .maybeSingle()

  if (loanError) {
    throw loanError
  }

  if (!parentLoan?.id) {
    throw createHttpError(404, 'Pinjaman parent tidak ditemukan.')
  }

  if (parentLoan.deleted_at) {
    throw createHttpError(400, 'Pinjaman parent masih ada di recycle bin. Pulihkan pinjaman lebih dulu.')
  }

  if (!existingPayment.deleted_at) {
    return {
      payment: existingPayment,
      loan: await syncLoanStatusFromPayments(adminClient, existingPayment.loan_id),
    }
  }

  const { data: siblingPayments, error: siblingError } = await adminClient
    .from('loan_payments')
    .select('id, amount')
    .eq('loan_id', existingPayment.loan_id)
    .is('deleted_at', null)

  if (siblingError) {
    throw siblingError
  }

  const nextPaidAmount =
    (siblingPayments ?? []).reduce((sum, row) => sum + Number(row?.amount ?? 0), 0) +
    Number(existingPayment.amount ?? 0)

  assertPaymentDoesNotOverpayParent(
    nextPaidAmount,
    getLoanPaymentTargetAmount(parentLoan),
    'Nominal pembayaran melebihi sisa pinjaman.'
  )

  const timestamp = new Date().toISOString()
  const { data: restoredPayment, error } = await adminClient
    .from('loan_payments')
    .update({
      deleted_at: null,
      updated_at: timestamp,
    })
    .eq('id', normalizedPaymentId)
    .not('deleted_at', 'is', null)
    .select(
      'id, loan_id, team_id, telegram_user_id, amount, payment_date, notes, created_at, updated_at, deleted_at, creditor_name_snapshot'
    )
    .single()

  if (error) {
    throw error
  }

  const loan = await syncLoanStatusFromPayments(adminClient, restoredPayment.loan_id)

  return {
    payment: normalizeLoanPaymentRow(restoredPayment),
    loan,
  }
}

async function updateLoanPayment(adminClient, body, telegramUserId) {
  const normalizedPaymentId = normalizeText(body.paymentId ?? body.payment_id ?? body.id, null)
  const teamId = normalizeText(body.teamId ?? body.team_id, null)
  const amount = Number(body.amount)
  const paymentDate = normalizeText(body.paymentDate ?? body.payment_date, null)
  const notes = normalizeText(body.notes, null)
  const expectedUpdatedAt = normalizeText(
    body.expectedUpdatedAt ?? body.expected_updated_at,
    null
  )

  if (!normalizedPaymentId) {
    throw createHttpError(400, 'Loan payment ID tidak valid.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createHttpError(400, 'Nominal pembayaran pinjaman harus lebih dari 0.')
  }

  if (!paymentDate) {
    throw createHttpError(400, 'Tanggal pembayaran wajib diisi.')
  }

  const existingPayment = await loadLoanPaymentById(adminClient, normalizedPaymentId, {
    includeDeleted: true,
  })

  if (!existingPayment) {
    throw createHttpError(404, 'Pembayaran pinjaman tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, teamId ?? existingPayment.team_id)

  assertOptimisticConcurrency(expectedUpdatedAt, existingPayment.updated_at, 'Pembayaran pinjaman')

  if (existingPayment.deleted_at) {
    throw createHttpError(400, 'Pembayaran pinjaman yang dihapus tidak bisa diedit.')
  }

  const { data: siblingPayments, error: siblingError } = await adminClient
    .from('loan_payments')
    .select('id, amount')
    .eq('loan_id', existingPayment.loan_id)
    .is('deleted_at', null)

  if (siblingError) {
    throw siblingError
  }

  const { data: parentLoan, error: loanError } = await adminClient
    .from('loans')
    .select('id, amount, principal_amount, repayment_amount, loan_terms_snapshot')
    .eq('id', existingPayment.loan_id)
    .maybeSingle()

  if (loanError) {
    throw loanError
  }

  if (!parentLoan?.id) {
    throw createHttpError(404, 'Pinjaman parent tidak ditemukan.')
  }

  const nextPaidAmount = (siblingPayments ?? []).reduce((sum, row) => {
    if (String(row.id ?? '') === String(existingPayment.id ?? '')) {
      return sum
    }

    return sum + Number(row?.amount ?? 0)
  }, 0) + amount

  assertPaymentDoesNotOverpayParent(
    nextPaidAmount,
    getLoanPaymentTargetAmount(parentLoan),
    'Nominal pembayaran melebihi sisa pinjaman.'
  )

  const timestamp = new Date().toISOString()
  const { data: updatedPayment, error } = await adminClient
    .from('loan_payments')
    .update({
      amount,
      payment_date: paymentDate,
      notes,
      updated_at: timestamp,
    })
    .eq('id', normalizedPaymentId)
    .is('deleted_at', null)
    .select(
      'id, loan_id, team_id, telegram_user_id, amount, payment_date, notes, created_at, updated_at, deleted_at, creditor_name_snapshot'
    )
    .single()

  if (error) {
    throw error
  }

  const loan = await syncLoanStatusFromPayments(adminClient, updatedPayment.loan_id)

  return {
    payment: normalizeLoanPaymentRow(updatedPayment),
    loan,
  }
}

async function deleteLoanPayment(adminClient, body, telegramUserId) {
  const normalizedPaymentId = normalizeText(body.paymentId ?? body.payment_id ?? body.id, null)
  const teamId = normalizeText(body.teamId ?? body.team_id, null)
  const expectedUpdatedAt = normalizeText(
    body.expectedUpdatedAt ?? body.expected_updated_at,
    null
  )

  if (!normalizedPaymentId) {
    throw createHttpError(400, 'Loan payment ID tidak valid.')
  }

  const existingPayment = await loadLoanPaymentById(adminClient, normalizedPaymentId, {
    includeDeleted: true,
  })

  if (!existingPayment) {
    throw createHttpError(404, 'Pembayaran pinjaman tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, teamId ?? existingPayment.team_id)

  assertOptimisticConcurrency(expectedUpdatedAt, existingPayment.updated_at, 'Pembayaran pinjaman')

  if (existingPayment.deleted_at) {
    return {
      payment: existingPayment,
      loan: await syncLoanStatusFromPayments(adminClient, existingPayment.loan_id),
    }
  }

  const timestamp = new Date().toISOString()
  const { data: deletedPayment, error } = await adminClient
    .from('loan_payments')
    .update({
      deleted_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', normalizedPaymentId)
    .is('deleted_at', null)
    .select(
      'id, loan_id, team_id, telegram_user_id, amount, payment_date, notes, created_at, updated_at, deleted_at, creditor_name_snapshot'
    )
    .single()

  if (error) {
    throw error
  }

  const loan = await syncLoanStatusFromPayments(adminClient, deletedPayment.loan_id)

  return {
    payment: normalizeLoanPaymentRow(deletedPayment),
    loan,
  }
}

async function hardDeleteLoanPayment(adminClient, serviceClient, body, telegramUserId) {
  const normalizedPaymentId = normalizeText(body.paymentId ?? body.payment_id ?? body.id, null)
  const teamId = normalizeText(body.teamId ?? body.team_id, null)
  const expectedUpdatedAt = normalizeText(
    body.expectedUpdatedAt ?? body.expected_updated_at,
    null
  )

  if (!normalizedPaymentId) {
    throw createHttpError(400, 'Loan payment ID tidak valid.')
  }

  const existingPayment = await loadLoanPaymentById(adminClient, normalizedPaymentId, {
    includeDeleted: true,
  })

  if (!existingPayment) {
    throw createHttpError(404, 'Pembayaran pinjaman tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, teamId ?? existingPayment.team_id)

  assertOptimisticConcurrency(expectedUpdatedAt, existingPayment.updated_at, 'Pembayaran pinjaman')

  if (!existingPayment.deleted_at) {
    throw createHttpError(
      400,
      'Pembayaran pinjaman harus ada di recycle bin sebelum dihapus permanen.'
    )
  }

  const { data: deletedRows, error: deleteError } = await serviceClient
    .from('loan_payments')
    .delete()
    .eq('id', normalizedPaymentId)
    .select('id')

  if (deleteError) {
    throw deleteError
  }

  if (!Array.isArray(deletedRows) || deletedRows.length === 0) {
    throw createHttpError(409, 'Pembayaran pinjaman tidak terhapus permanen. Muat ulang data lalu coba lagi.')
  }

  const loan = existingPayment.loan_id
    ? await syncLoanStatusFromPayments(adminClient, existingPayment.loan_id)
    : null

  return {
    payment: existingPayment,
    loan,
  }
}

async function loadDeletedTransactionById(adminClient, teamId, transactionId) {
  const normalizedId = normalizeText(transactionId)

  if (!normalizedId) {
    throw createHttpError(400, 'ID transaksi tidak valid.')
  }

  const [projectIncomeResult, loanResult, billResult, attendanceResult] = await Promise.all([
    adminClient
      .from('project_incomes')
      .select(
        'id, team_id, project_id, transaction_date, income_date, amount, description, created_at, updated_at, project_name_snapshot, deleted_at'
      )
      .eq('team_id', teamId)
      .eq('id', normalizedId)
      .not('deleted_at', 'is', null)
      .maybeSingle(),
    adminClient
      .from('loans')
      .select(loanSelectColumns)
      .eq('team_id', teamId)
      .eq('id', normalizedId)
      .not('deleted_at', 'is', null)
      .maybeSingle(),
    adminClient
      .from('bills')
      .select(
        'id, expense_id, project_income_id, team_id, bill_type, description, amount, paid_amount, due_date, status, paid_at, worker_name_snapshot, supplier_name_snapshot, project_name_snapshot, created_at, updated_at, deleted_at'
      )
      .eq('team_id', teamId)
      .eq('id', normalizedId)
      .not('deleted_at', 'is', null)
      .maybeSingle(),
    adminClient
      .from('attendance_records')
      .select(
        'id, team_id, worker_id, project_id, attendance_date, attendance_status, total_pay, billing_status, salary_bill_id, notes, worker_name_snapshot, project_name_snapshot, created_at, updated_at, deleted_at'
      )
      .eq('team_id', teamId)
      .eq('id', normalizedId)
      .eq('billing_status', 'unbilled')
      .is('salary_bill_id', null)
      .not('deleted_at', 'is', null)
      .maybeSingle(),
  ])

  if (projectIncomeResult.error) {
    throw projectIncomeResult.error
  }

  if (loanResult.error) {
    throw loanResult.error
  }

  if (billResult.error) {
    throw billResult.error
  }

  if (attendanceResult.error) {
    throw attendanceResult.error
  }

  if (projectIncomeResult.data) {
    return mapProjectIncomeRow(projectIncomeResult.data)
  }

  if (loanResult.data) {
    return mapLoanRow(loanResult.data)
  }

  if (billResult.data) {
    return mapBillRecycleRow(billResult.data)
  }

  if (attendanceResult.data) {
    return mapAttendanceRecycleRow(attendanceResult.data)
  }

  return null
}

async function softDeleteProjectIncome(adminClient, id, expectedUpdatedAt = null) {
  const normalizedId = normalizeText(id)

  if (!normalizedId) {
    throw createHttpError(400, 'ID pemasukan proyek tidak valid.')
  }

  const { data: paidFeeBills, error: paidFeeBillsError } = await adminClient
    .from('bills')
    .select('id')
    .eq('project_income_id', normalizedId)
    .is('deleted_at', null)
    .gt('paid_amount', 0)
    .limit(1)

  if (paidFeeBillsError) {
    throw paidFeeBillsError
  }

  if ((paidFeeBills ?? []).length > 0) {
    throw createHttpError(
      400,
      'Pemasukan proyek yang sudah memiliki pembayaran fee tidak bisa dihapus.'
    )
  }

  if (normalizeVersion(expectedUpdatedAt)) {
    const { data: currentIncome, error: currentIncomeError } = await adminClient
      .from('project_incomes')
      .select('updated_at')
      .eq('id', normalizedId)
      .is('deleted_at', null)
      .maybeSingle()

    if (currentIncomeError) {
      throw currentIncomeError
    }

    assertOptimisticConcurrency(expectedUpdatedAt, currentIncome?.updated_at, 'Pemasukan proyek')
  }

  const timestamp = new Date().toISOString()

  const { error: incomeError } = await adminClient
    .from('project_incomes')
    .update({
      deleted_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', normalizedId)
    .is('deleted_at', null)

  if (incomeError) {
    throw incomeError
  }

  const { error: billError } = await adminClient
    .from('bills')
    .update({
      deleted_at: timestamp,
      updated_at: timestamp,
      status: 'cancelled',
    })
    .eq('project_income_id', normalizedId)
    .is('deleted_at', null)

  if (billError) {
    throw billError
  }

  return true
}

async function softDeleteLoan(adminClient, id, expectedUpdatedAt = null) {
  const normalizedId = normalizeText(id)

  if (!normalizedId) {
    throw createHttpError(400, 'Loan ID tidak valid.')
  }

  const { data: payments, error: paymentsError } = await adminClient
    .from('loan_payments')
    .select('id')
    .eq('loan_id', normalizedId)
    .is('deleted_at', null)
    .limit(1)

  if (paymentsError) {
    throw paymentsError
  }

  if ((payments ?? []).length > 0) {
    throw createHttpError(
      400,
      'Pinjaman yang sudah memiliki pembayaran tidak bisa dihapus.'
    )
  }

  if (normalizeVersion(expectedUpdatedAt)) {
    const { data: currentLoan, error: currentLoanError } = await adminClient
      .from('loans')
      .select('updated_at')
      .eq('id', normalizedId)
      .is('deleted_at', null)
      .maybeSingle()

    if (currentLoanError) {
      throw currentLoanError
    }

    assertOptimisticConcurrency(expectedUpdatedAt, currentLoan?.updated_at, 'Pinjaman')
  }

  const { error } = await adminClient
    .from('loans')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedId)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return true
}

async function restoreProjectIncome(adminClient, id, expectedUpdatedAt = null) {
  const normalizedId = normalizeText(id)

  if (!normalizedId) {
    throw createHttpError(400, 'ID pemasukan proyek tidak valid.')
  }

  if (normalizeVersion(expectedUpdatedAt)) {
    const { data: currentIncome, error: currentIncomeError } = await adminClient
      .from('project_incomes')
      .select('updated_at')
      .eq('id', normalizedId)
      .not('deleted_at', 'is', null)
      .maybeSingle()

    if (currentIncomeError) {
      throw currentIncomeError
    }

    assertOptimisticConcurrency(expectedUpdatedAt, currentIncome?.updated_at, 'Pemasukan proyek')
  }

  const timestamp = new Date().toISOString()

  const { data: restoredIncome, error: incomeError } = await adminClient
    .from('project_incomes')
    .update({
      deleted_at: null,
      updated_at: timestamp,
    })
    .eq('id', normalizedId)
    .not('deleted_at', 'is', null)
    .select(
      'id, telegram_user_id, created_by_user_id, team_id, project_id, transaction_date, income_date, amount, description, notes, project_name_snapshot, created_at, updated_at, deleted_at'
    )
    .single()

  if (incomeError) {
    throw incomeError
  }

  const { error: billError } = await adminClient
    .from('bills')
    .update({
      deleted_at: null,
      updated_at: timestamp,
      status: 'unpaid',
      paid_at: null,
    })
    .eq('project_income_id', normalizedId)
    .not('deleted_at', 'is', null)

  if (billError) {
    throw billError
  }

  return mapProjectIncomeRow(restoredIncome)
}

async function restoreLoan(adminClient, id, expectedUpdatedAt = null) {
  const normalizedId = normalizeText(id)

  if (!normalizedId) {
    throw createHttpError(400, 'Loan ID tidak valid.')
  }

  if (normalizeVersion(expectedUpdatedAt)) {
    const { data: currentLoan, error: currentLoanError } = await adminClient
      .from('loans')
      .select('updated_at')
      .eq('id', normalizedId)
      .not('deleted_at', 'is', null)
      .maybeSingle()

    if (currentLoanError) {
      throw currentLoanError
    }

    assertOptimisticConcurrency(expectedUpdatedAt, currentLoan?.updated_at, 'Pinjaman')
  }

  const { data: restoredLoan, error } = await adminClient
    .from('loans')
    .update({
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedId)
    .not('deleted_at', 'is', null)
    .select(loanSelectColumns)
    .single()

  if (error) {
    throw error
  }

  return mapLoanRow(restoredLoan)
}

function getBillPaymentStatus(totalAmount, paidAmount, existingPaidAt = null) {
  if (totalAmount > 0 && paidAmount >= totalAmount) {
    return {
      status: 'paid',
      paidAt: existingPaidAt ?? new Date().toISOString(),
    }
  }

  if (paidAmount > 0) {
    return {
      status: 'partial',
      paidAt: null,
    }
  }

  return {
    status: 'unpaid',
    paidAt: null,
  }
}

async function restoreBill(adminClient, id, telegramUserId = null, teamId = null) {
  const normalizedId = normalizeText(id)
  const normalizedTeamId = normalizeText(teamId, null)

  if (!normalizedId) {
    throw createHttpError(400, 'Bill ID tidak valid.')
  }

  let billLookupQuery = adminClient
    .from('bills')
    .select('id, expense_id, project_income_id, team_id, amount, paid_at, status, paid_amount')
    .eq('id', normalizedId)
    .not('deleted_at', 'is', null)

  if (normalizedTeamId) {
    billLookupQuery = billLookupQuery.eq('team_id', normalizedTeamId)
  }

  const { data: bill, error: billLookupError } = await billLookupQuery.maybeSingle()

  if (billLookupError) {
    throw billLookupError
  }

  if (!bill?.id) {
    throw createHttpError(404, 'Tagihan terhapus tidak ditemukan.')
  }

  const billTeamId = normalizeText(bill.team_id, normalizedTeamId)

  if (!billTeamId) {
    throw createHttpError(400, 'Tagihan tanpa team tidak bisa dipulihkan.')
  }

  if (telegramUserId) {
    await assertTeamAccess(adminClient, telegramUserId, billTeamId)
  }

  if (!bill.expense_id && !bill.project_income_id) {
    throw createHttpError(
      400,
      'Tagihan ini tidak memiliki parent expense atau pemasukan proyek untuk dipulihkan dari path ini.'
    )
  }

  if (bill.project_income_id) {
    const { data: projectIncome, error: incomeError } = await adminClient
      .from('project_incomes')
      .select('id, team_id, deleted_at')
      .eq('id', bill.project_income_id)
      .eq('team_id', billTeamId)
      .maybeSingle()

    if (incomeError) {
      throw incomeError
    }

    if (!projectIncome?.id) {
      throw createHttpError(404, 'Parent termin proyek tidak ditemukan.')
    }

    if (projectIncome?.deleted_at) {
      throw createHttpError(
        400,
        'Tagihan fee dari termin proyek tidak bisa dipulihkan sendiri. Pulihkan termin proyek lebih dulu.'
      )
    }
  }

  if (bill.expense_id) {
    const { data: expense, error: expenseError } = await adminClient
      .from('expenses')
      .select('id, team_id, deleted_at')
      .eq('id', bill.expense_id)
      .eq('team_id', billTeamId)
      .maybeSingle()

    if (expenseError) {
      throw expenseError
    }

    if (!expense?.id) {
      throw createHttpError(404, 'Parent pengeluaran tidak ditemukan.')
    }

    if (expense?.deleted_at) {
      throw createHttpError(
        400,
        'Tagihan child dari pengeluaran tidak bisa dipulihkan sendiri. Pulihkan pengeluaran lebih dulu.'
      )
    }
  }

  const timestamp = new Date().toISOString()

  const { data: restoredBill, error } = await adminClient
    .from('bills')
    .update({
      deleted_at: null,
      updated_at: timestamp,
    })
    .eq('id', normalizedId)
    .eq('team_id', billTeamId)
    .not('deleted_at', 'is', null)
    .select(
      'id, expense_id, project_income_id, team_id, bill_type, description, amount, paid_amount, due_date, status, paid_at, worker_name_snapshot, supplier_name_snapshot, project_name_snapshot, created_at, updated_at, deleted_at'
    )
    .single()

  if (error) {
    throw error
  }

  const { data: billPayments, error: billPaymentsError } = await adminClient
    .from('bill_payments')
    .select('id, amount, payment_date, deleted_at')
    .eq('bill_id', normalizedId)

  if (billPaymentsError) {
    throw billPaymentsError
  }

  const restoredPaymentIds = (billPayments ?? [])
    .filter((payment) => payment?.deleted_at)
    .map((payment) => payment.id)
    .filter(Boolean)
  const paidAmount = (billPayments ?? []).reduce(
    (sum, payment) => sum + Number(payment?.amount ?? 0),
    0
  )
  const latestPaymentDate = (billPayments ?? []).reduce((latest, payment) => {
    const paymentDate = normalizeText(payment?.payment_date, null)

    if (!paymentDate) {
      return latest
    }

    if (!latest) {
      return paymentDate
    }

    return new Date(paymentDate).getTime() > new Date(latest).getTime() ? paymentDate : latest
  }, null)
  const totalAmount = Number(restoredBill?.amount ?? 0)

  assertPaymentDoesNotOverpayParent(
    paidAmount,
    totalAmount,
    'Nominal pembayaran tagihan melebihi total tagihan.'
  )

  const nextBillState = getBillPaymentStatus(
    totalAmount,
    paidAmount,
    restoredBill.paid_at ?? latestPaymentDate
  )

  if (restoredPaymentIds.length > 0) {
    const { error: restorePaymentsError } = await adminClient
      .from('bill_payments')
      .update({
        deleted_at: null,
        updated_at: timestamp,
      })
      .in('id', restoredPaymentIds)
      .not('deleted_at', 'is', null)

    if (restorePaymentsError) {
      throw restorePaymentsError
    }
  }

  const { data: syncedBill, error: syncError } = await adminClient
    .from('bills')
    .update({
      paid_amount: paidAmount,
      status: nextBillState.status,
      paid_at: nextBillState.paidAt,
      updated_at: timestamp,
    })
    .eq('id', normalizedId)
    .select(
      'id, expense_id, project_income_id, team_id, bill_type, description, amount, paid_amount, due_date, status, paid_at, worker_name_snapshot, supplier_name_snapshot, project_name_snapshot, created_at, updated_at, deleted_at'
    )
    .single()

  if (syncError) {
    throw syncError
  }

  return mapBillRecycleRow(syncedBill)
}

async function restoreAttendanceRecord(adminClient, id) {
  const normalizedId = normalizeText(id)

  if (!normalizedId) {
    throw createHttpError(400, 'Attendance ID tidak valid.')
  }

  const { data: restoredAttendance, error } = await adminClient
    .from('attendance_records')
    .select(
      'id, team_id, worker_id, project_id, attendance_date, attendance_status, total_pay, billing_status, salary_bill_id, notes, worker_name_snapshot, project_name_snapshot, created_at, updated_at, deleted_at'
    )
    .eq('id', normalizedId)
    .not('deleted_at', 'is', null)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!restoredAttendance?.id) {
    throw createHttpError(404, 'Absensi terhapus tidak ditemukan.')
  }

  if (normalizeText(restoredAttendance.billing_status, 'unbilled') !== 'unbilled' || restoredAttendance.salary_bill_id) {
    throw createHttpError(
      400,
      'Absensi billed tidak bisa dipulihkan dari recycle bin ini.'
    )
  }

  const timestamp = new Date().toISOString()
  const { data: nextAttendance, error: restoreError } = await adminClient
    .from('attendance_records')
    .update({
      deleted_at: null,
      updated_at: timestamp,
    })
    .eq('id', normalizedId)
    .not('deleted_at', 'is', null)
    .select(
      'id, team_id, worker_id, project_id, attendance_date, attendance_status, total_pay, billing_status, notes, worker_name_snapshot, project_name_snapshot, created_at, updated_at, deleted_at'
    )
    .single()

  if (restoreError) {
    throw restoreError
  }

  return mapAttendanceRecycleRow(nextAttendance)
}

async function hardDeleteProjectIncome(adminClient, id) {
  const normalizedId = normalizeText(id)

  if (!normalizedId) {
    throw createHttpError(400, 'ID pemasukan proyek tidak valid.')
  }

  const { data: income, error } = await adminClient
    .from('project_incomes')
    .select('id, deleted_at')
    .eq('id', normalizedId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!income?.id || !income.deleted_at) {
    throw createHttpError(400, 'Pemasukan proyek harus ada di recycle bin sebelum dihapus permanen.')
  }

  const { data: bills, error: billsError } = await adminClient
    .from('bills')
    .select('id')
    .eq('project_income_id', normalizedId)

  if (billsError) {
    throw billsError
  }

  const billIds = (bills ?? []).map((bill) => bill.id).filter(Boolean)

  if (billIds.length > 0) {
    const { error: paymentError } = await adminClient
      .from('bill_payments')
      .delete()
      .in('bill_id', billIds)

    if (paymentError) {
      throw paymentError
    }

    const { error: billDeleteError } = await adminClient
      .from('bills')
      .delete()
      .eq('project_income_id', normalizedId)

    if (billDeleteError) {
      throw billDeleteError
    }
  }

  const { error: incomeDeleteError } = await adminClient
    .from('project_incomes')
    .delete()
    .eq('id', normalizedId)

  if (incomeDeleteError) {
    throw incomeDeleteError
  }

  return true
}

async function hardDeleteLoan(adminClient, id) {
  const normalizedId = normalizeText(id)

  if (!normalizedId) {
    throw createHttpError(400, 'ID pinjaman tidak valid.')
  }

  const { data: loan, error } = await adminClient
    .from('loans')
    .select('id, deleted_at')
    .eq('id', normalizedId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!loan?.id || !loan.deleted_at) {
    throw createHttpError(400, 'Pinjaman harus ada di recycle bin sebelum dihapus permanen.')
  }

  const { error: paymentError } = await adminClient
    .from('loan_payments')
    .delete()
    .eq('loan_id', normalizedId)

  if (paymentError) {
    throw paymentError
  }

  const { error: deleteError } = await adminClient.from('loans').delete().eq('id', normalizedId)

  if (deleteError) {
    throw deleteError
  }

  return true
}

async function hardDeleteBill(adminClient, id) {
  const normalizedId = normalizeText(id)

  if (!normalizedId) {
    throw createHttpError(400, 'ID tagihan tidak valid.')
  }

  const { data: bill, error } = await adminClient
    .from('bills')
    .select('id, expense_id, project_income_id, deleted_at')
    .eq('id', normalizedId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!bill?.id || !bill.deleted_at) {
    throw createHttpError(400, 'Tagihan harus ada di recycle bin sebelum dihapus permanen.')
  }

  const { error: paymentError } = await adminClient
    .from('bill_payments')
    .delete()
    .eq('bill_id', normalizedId)

  if (paymentError) {
    throw paymentError
  }

  if (bill.expense_id) {
    const { error: lineItemError } = await adminClient
      .from('expense_line_items')
      .delete()
      .eq('expense_id', bill.expense_id)

    if (lineItemError) {
      throw lineItemError
    }

    const { error: expenseError } = await adminClient
      .from('expenses')
      .delete()
      .eq('id', bill.expense_id)

    if (expenseError) {
      throw expenseError
    }
  }

  const { error: billDeleteError } = await adminClient.from('bills').delete().eq('id', normalizedId)

  if (billDeleteError) {
    throw billDeleteError
  }

  return true
}

async function hardDeleteAttendance(adminClient, id) {
  const normalizedId = normalizeText(id)

  if (!normalizedId) {
    throw createHttpError(400, 'ID absensi tidak valid.')
  }

  const { data: attendance, error } = await adminClient
    .from('attendance_records')
    .select('id, salary_bill_id, deleted_at')
    .eq('id', normalizedId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!attendance?.id || !attendance.deleted_at) {
    throw createHttpError(400, 'Absensi harus ada di recycle bin sebelum dihapus permanen.')
  }

  if (attendance.salary_bill_id) {
    const { error: paymentError } = await adminClient
      .from('bill_payments')
      .delete()
      .eq('bill_id', attendance.salary_bill_id)

    if (paymentError) {
      throw paymentError
    }

    const { error: billError } = await adminClient
      .from('bills')
      .delete()
      .eq('id', attendance.salary_bill_id)

    if (billError) {
      throw billError
    }
  }

  const { error: deleteError } = await adminClient
    .from('attendance_records')
    .delete()
    .eq('id', normalizedId)

  if (deleteError) {
    throw deleteError
  }

  return true
}

async function upsertProjectIncome(adminClient, body, telegramUserId, teamId) {
  const normalizedId = normalizeText(body.id, null)
  const projectId = normalizeText(body.project_id ?? body.projectId)
  const projectName = normalizeText(
    body.project_name_snapshot ?? body.project_name ?? body.projectName,
    '-'
  )
  const transactionDate = normalizeText(
    body.transaction_date ?? body.transactionDate
  )
  const amount = toNumber(body.amount)
  const description = normalizeText(body.description)
  const notes = normalizeText(body.notes, null)
  const createdByUserId = normalizeText(
    body.created_by_user_id ?? body.createdByUserId,
    null
  )
  const expectedUpdatedAt = normalizeText(
    body.expectedUpdatedAt ?? body.expected_updated_at,
    null
  )

  if (!projectId) {
    throw createHttpError(400, 'Proyek wajib dipilih.')
  }

  if (!transactionDate) {
    throw createHttpError(400, 'Tanggal pemasukan wajib diisi.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createHttpError(400, 'Nominal termin harus lebih dari 0.')
  }

  if (!description) {
    throw createHttpError(400, 'Deskripsi termin wajib diisi.')
  }

  const payload = {
    project_id: projectId,
    transaction_date: transactionDate,
    income_date: transactionDate,
    amount,
    description,
    notes,
    project_name_snapshot: projectName,
    updated_at: new Date().toISOString(),
  }

  if (normalizedId) {
    const { data: currentIncome, error: currentIncomeError } = await adminClient
      .from('project_incomes')
      .select('updated_at')
      .eq('id', normalizedId)
      .is('deleted_at', null)
      .maybeSingle()

    if (currentIncomeError) {
      throw currentIncomeError
    }

    assertOptimisticConcurrency(expectedUpdatedAt, currentIncome?.updated_at, 'Pemasukan proyek')

    const { data: paidFeeBills, error: paidFeeBillsError } = await adminClient
      .from('bills')
      .select('id')
      .eq('project_income_id', normalizedId)
      .is('deleted_at', null)
      .gt('paid_amount', 0)
      .limit(1)

    if (paidFeeBillsError) {
      throw paidFeeBillsError
    }

    if ((paidFeeBills ?? []).length > 0) {
      throw createHttpError(
        400,
        'Pemasukan proyek yang sudah memiliki pembayaran fee tidak bisa diubah.'
      )
    }

    const { data: updatedIncome, error } = await adminClient
      .from('project_incomes')
      .update(payload)
      .eq('id', normalizedId)
      .is('deleted_at', null)
      .select(
        'id, telegram_user_id, created_by_user_id, team_id, project_id, transaction_date, income_date, amount, description, notes, project_name_snapshot, created_at, updated_at, deleted_at'
      )
      .single()

    if (error) {
      throw error
    }

    return mapProjectIncomeRow(updatedIncome)
  }

  const insertPayload = {
    telegram_user_id: telegramUserId,
    created_by_user_id: createdByUserId,
    team_id: teamId,
    ...payload,
  }

  const { data: insertedIncome, error } = await adminClient
    .from('project_incomes')
    .insert(insertPayload)
    .select(
      'id, telegram_user_id, created_by_user_id, team_id, project_id, transaction_date, income_date, amount, description, notes, project_name_snapshot, created_at, updated_at, deleted_at'
    )
    .single()

  if (error) {
    throw error
  }

  return mapProjectIncomeRow(insertedIncome)
}

async function upsertLoan(adminClient, body, telegramUserId, teamId) {
  const normalizedId = normalizeText(body.id, null)
  const creditorId = normalizeText(body.creditor_id ?? body.creditorId)
  const creditorName = normalizeText(
    body.creditor_name_snapshot ?? body.creditor_name ?? body.creditorName,
    '-'
  )
  const transactionDate = normalizeText(
    body.transaction_date ?? body.transactionDate
  )
  const principalAmount = toNumber(body.principal_amount ?? body.principalAmount)
  const interestType = normalizeLoanInterestType(body.interest_type ?? body.interestType)
  const interestRate = toNumber(body.interest_rate ?? body.interestRate, 0)
  const tenorMonths = Math.trunc(toNumber(body.tenor_months ?? body.tenorMonths, 0))
  const lateInterestRate = toNumber(body.late_interest_rate ?? body.lateInterestRate, 0)
  const lateInterestBasis = normalizeLoanLateInterestBasis(
    body.late_interest_basis ?? body.lateInterestBasis
  )
  const latePenaltyType = normalizeLoanLatePenaltyType(
    body.late_penalty_type ?? body.latePenaltyType
  )
  const latePenaltyAmount = toNumber(body.late_penalty_amount ?? body.latePenaltyAmount, 0)
  const description = normalizeText(body.description)
  const notes = normalizeText(body.notes, description)
  const createdByUserId = normalizeText(
    body.created_by_user_id ?? body.createdByUserId,
    null
  )
  const expectedUpdatedAt = normalizeText(
    body.expectedUpdatedAt ?? body.expected_updated_at,
    null
  )

  if (!creditorId) {
    throw createHttpError(400, 'Kreditur wajib dipilih.')
  }

  if (!transactionDate) {
    throw createHttpError(400, 'Tanggal pinjaman wajib diisi.')
  }

  if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
    throw createHttpError(400, 'Pokok pinjaman harus lebih dari 0.')
  }

  if (interestType === 'interest' && interestRate < 0) {
    throw createHttpError(400, 'Suku bunga tidak valid.')
  }

  if (tenorMonths < 0) {
    throw createHttpError(400, 'Tenor pinjaman tidak valid.')
  }

  if (lateInterestRate < 0) {
    throw createHttpError(400, 'Bunga keterlambatan tidak valid.')
  }

  if (latePenaltyAmount < 0) {
    throw createHttpError(400, 'Penalti keterlambatan tidak valid.')
  }

  const loanTermsSnapshot = buildLoanTermsSnapshot({
    principal_amount: principalAmount,
    interest_type: interestType,
    interest_rate: interestRate,
    tenor_months: tenorMonths,
    transaction_date: transactionDate,
    disbursed_date: transactionDate,
    late_interest_rate: lateInterestRate,
    late_interest_basis: lateInterestBasis,
    late_penalty_type: latePenaltyType,
    late_penalty_amount: latePenaltyAmount,
    creditor_name_snapshot: creditorName,
    amount: principalAmount,
  })
  const repaymentAmount = loanTermsSnapshot.repayment_amount

  const payload = {
    creditor_id: creditorId,
    transaction_date: transactionDate,
    disbursed_date: transactionDate,
    principal_amount: principalAmount,
    repayment_amount: repaymentAmount,
    interest_type: interestType,
    interest_rate: interestType === 'interest' ? interestRate : null,
    tenor_months: tenorMonths > 0 ? tenorMonths : null,
    late_interest_rate: lateInterestRate > 0 ? lateInterestRate : 0,
    late_interest_basis: lateInterestBasis,
    late_penalty_type: latePenaltyType,
    late_penalty_amount: latePenaltyType === 'flat' ? latePenaltyAmount : 0,
    loan_terms_snapshot: loanTermsSnapshot,
    amount: principalAmount,
    description,
    notes,
    creditor_name_snapshot: creditorName,
    updated_at: new Date().toISOString(),
  }

  if (normalizedId) {
    const { data: currentLoan, error: currentLoanError } = await adminClient
      .from('loans')
      .select('paid_amount, updated_at')
      .eq('id', normalizedId)
      .is('deleted_at', null)
      .maybeSingle()

    if (currentLoanError) {
      throw currentLoanError
    }

    assertOptimisticConcurrency(expectedUpdatedAt, currentLoan?.updated_at, 'Pinjaman')

    const currentPaidAmount = toNumber(currentLoan?.paid_amount, 0)

    if (repaymentAmount < currentPaidAmount) {
      throw createHttpError(
        400,
        'Total pengembalian tidak boleh lebih kecil dari nominal yang sudah dibayar.'
      )
    }

    const { data: updatedLoan, error } = await adminClient
      .from('loans')
      .update(payload)
      .eq('id', normalizedId)
      .is('deleted_at', null)
      .select(
        loanSelectColumns
      )
      .single()

    if (error) {
      throw error
    }

    return mapLoanRow(updatedLoan)
  }

  const insertPayload = {
    telegram_user_id: telegramUserId,
    created_by_user_id: createdByUserId,
    team_id: teamId,
    ...payload,
    status: 'unpaid',
    paid_amount: 0,
  }

  const { data: insertedLoan, error } = await adminClient
    .from('loans')
    .insert(insertPayload)
    .select(
      loanSelectColumns
    )
    .single()

  if (error) {
    throw error
  }

  return mapLoanRow(insertedLoan)
}

export default async function handler(req, res) {
  const supabaseUrl = getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL'))
  const publishableKey = getEnv(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    getEnv('VITE_SUPABASE_ANON_KEY')
  )
  const databaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', publishableKey)

  if (!supabaseUrl || !publishableKey) {
    return res.status(500).json({
      success: false,
      error: 'Environment transaksi belum lengkap.',
    })
  }

  try {
    const method = String(req.method ?? 'GET').toUpperCase()

    if (method === 'GET') {
      const teamId = normalizeText(req.query?.teamId, null)
      const view = normalizeText(req.query?.view, 'active')
      const transactionId = normalizeText(req.query?.transactionId, null)
      const bearerToken = getBearerToken(req)
      const accessClient = createDatabaseClient(
        supabaseUrl,
        publishableKey,
        bearerToken
      )
      const readClient = createDatabaseClient(supabaseUrl, databaseKey)
      const effectiveTeamId = await assertSessionTeamAccess(accessClient, teamId)
      const debugTimingEnabled = normalizeText(req.query?.debugTiming, '') === '1'

      if (view === 'recycle-bin') {
        if (transactionId) {
          const record = await loadDeletedTransactionById(
            readClient,
            effectiveTeamId,
            transactionId
          )

          return res.status(200).json({
            success: true,
            record,
          })
        }

        const query = req.query ?? {}

        if (!shouldPaginateRecycleBinTransactions(query)) {
          const { rows, timing } = await loadRecycleBinViewRows(readClient, effectiveTeamId, {
            fetchAll: true,
            debugTiming: debugTimingEnabled,
          })

          const cashMutations = rows.filter((row) =>
            ['project-income', 'loan-disbursement', 'bill', 'attendance-record'].includes(
              row?.sourceType ?? row?.source_type ?? ''
            )
          )

          return res.status(200).json({
            success: true,
            cashMutations,
            recycleBinRecords: rows,
            ...(debugTimingEnabled ? { timing } : {}),
          })
        }

        const { rows, pageInfo, timing } = await loadRecycleBinRecords(
          readClient,
          effectiveTeamId,
          {
            cursor: query.cursor ?? null,
            limit: query.limit ?? 20,
            search: query.search ?? '',
            filter: query.filter ?? 'all',
            debugTiming: debugTimingEnabled,
          }
        )

        return res.status(200).json({
          success: true,
          recycleBinRecords: rows,
          pageInfo,
          ...(debugTimingEnabled ? { timing } : {}),
        })
      }

      if (view === 'history') {
        const query = req.query ?? {}

        if (transactionId) {
          const { record, timing } = await loadHistoryTransactionViewRecord(
            readClient,
            effectiveTeamId,
            transactionId,
            {
              includeCreatorMetadata: true,
              debugTiming: debugTimingEnabled,
            }
          )

          return res.status(200).json({
            success: true,
            record,
            ...(debugTimingEnabled ? { timing } : {}),
          })
        }

        if (!shouldPaginateWorkspaceTransactions(query)) {
          const { rows: historyTransactions, timing } = await loadHistoryTransactions(
            readClient,
            effectiveTeamId,
            {
              debugTiming: debugTimingEnabled,
            }
          )

          return res.status(200).json({
            success: true,
            historyTransactions,
            ...(debugTimingEnabled ? { timing } : {}),
          })
        }
        const { rows, pageInfo, timing } = await loadTransactionViewRows(
          readClient,
          'vw_history_transactions',
          effectiveTeamId,
          {
            cursor: query.cursor ?? null,
            limit: query.limit ?? 20,
            search: query.search ?? '',
            filter: query.filter ?? 'all',
            includeCreatorMetadata: true,
            debugTiming: debugTimingEnabled,
          }
        )

        return res.status(200).json({
          success: true,
          historyTransactions: rows,
          pageInfo,
          ...(debugTimingEnabled ? { timing } : {}),
        })
      }

      if (view === 'workspace') {
        const query = req.query ?? {}

        if (transactionId) {
          const { record, timing } = await loadWorkspaceTransactionViewRecord(
            readClient,
            effectiveTeamId,
            transactionId,
            {
              includeCreatorMetadata: true,
              debugTiming: debugTimingEnabled,
            }
          )

          return res.status(200).json({
            success: true,
            record,
            ...(debugTimingEnabled ? { timing } : {}),
          })
        }

        if (!shouldPaginateWorkspaceTransactions(query)) {
          const { rows: workspaceTransactions, timing } = await loadWorkspaceTransactions(
            readClient,
            effectiveTeamId,
            {
              debugTiming: debugTimingEnabled,
            }
          )

          return res.status(200).json({
            success: true,
            workspaceTransactions,
            ...(debugTimingEnabled ? { timing } : {}),
          })
        }
        const { rows, pageInfo, timing } = await loadWorkspaceTransactionViewRows(
          readClient,
          effectiveTeamId,
          {
            cursor: query.cursor ?? null,
            limit: query.limit ?? 20,
            search: query.search ?? '',
            filter: query.filter ?? 'all',
            includeCreatorMetadata: true,
            debugTiming: debugTimingEnabled,
          }
        )

        return res.status(200).json({
          success: true,
          workspaceTransactions: rows,
          pageInfo,
          ...(debugTimingEnabled ? { timing } : {}),
        })
      }

      if (view === 'summary') {
        const { summary, timing } = await loadOperationalSummary(
          readClient,
          effectiveTeamId,
          {
            debugTiming: debugTimingEnabled,
          }
        )

        return res.status(200).json({
          success: true,
          summary,
          ...(debugTimingEnabled ? { timing } : {}),
        })
      }

      const cashMutations = await loadCashMutations(readClient, effectiveTeamId)

      return res.status(200).json({
        success: true,
        cashMutations,
        summary: buildSummary(cashMutations),
      })
    }

    const body = await parseRequestBody(req)
    const recordType = normalizeText(body.recordType ?? body.sourceType)
    const resource = normalizeText(req.query?.resource ?? body.resource)
    const teamId = normalizeText(body.teamId ?? body.team_id, null)
    const context = await getAuthorizedContext(req, supabaseUrl, publishableKey)
    const adminClient = createDatabaseClient(
      supabaseUrl,
      databaseKey,
      context.bearerToken
    )
    const serviceClient = createDatabaseClient(supabaseUrl, databaseKey)
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, telegram_user_id')
      .eq('id', context.authUser.id)
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    const telegramUserId = normalizeText(
      profile?.telegram_user_id ?? context.authUser?.user_metadata?.telegram_user_id,
      null
    )

    if (!telegramUserId) {
      throw createHttpError(403, 'Profile Telegram tidak ditemukan.')
    }

    const effectiveTeamId = await assertTeamAccess(
      adminClient,
      telegramUserId,
      teamId
    )

    if (method === 'DELETE') {
      if (resource === 'loan-payments') {
        if (normalizeText(body.action, '') === 'permanent-delete') {
          const result = await hardDeleteLoanPayment(
            adminClient,
            serviceClient,
            body,
            telegramUserId
          )

          return res.status(200).json({
            success: true,
            payment: result.payment,
            loan: result.loan,
          })
        }

        const result = await deleteLoanPayment(adminClient, body, telegramUserId)

        return res.status(200).json({
          success: true,
          payment: result.payment,
          loan: result.loan,
        })
      }

      if (normalizeText(body.action, '') === 'permanent-delete') {
        const teamId = normalizeText(body.teamId ?? body.team_id, null)

        if (recordType === 'project-income') {
          const record = await loadDeletedTransactionById(adminClient, effectiveTeamId, body.id)

          if (!record) {
            throw createHttpError(404, 'Pemasukan proyek terhapus tidak ditemukan.')
          }

          await assertTeamAccess(adminClient, telegramUserId, teamId ?? effectiveTeamId)
          await hardDeleteProjectIncome(adminClient, body.id)

          return res.status(200).json({
            success: true,
          })
        }

        if (recordType === 'loan' || recordType === 'loan-disbursement') {
          const record = await loadDeletedTransactionById(adminClient, effectiveTeamId, body.id)

          if (!record) {
            throw createHttpError(404, 'Pinjaman terhapus tidak ditemukan.')
          }

          await assertTeamAccess(adminClient, telegramUserId, teamId ?? effectiveTeamId)
          await hardDeleteLoan(adminClient, body.id)

          return res.status(200).json({
            success: true,
          })
        }

        if (recordType === 'bill') {
          const record = await loadDeletedTransactionById(adminClient, effectiveTeamId, body.id)

          if (!record) {
            throw createHttpError(404, 'Tagihan terhapus tidak ditemukan.')
          }

          await assertTeamAccess(adminClient, telegramUserId, teamId ?? effectiveTeamId)
          await hardDeleteBill(adminClient, body.id)

          return res.status(200).json({
            success: true,
          })
        }

        if (recordType === 'attendance-record') {
          const record = await loadDeletedTransactionById(adminClient, effectiveTeamId, body.id)

          if (!record) {
            throw createHttpError(404, 'Absensi terhapus tidak ditemukan.')
          }

          await assertTeamAccess(adminClient, telegramUserId, teamId ?? effectiveTeamId)
          await hardDeleteAttendance(adminClient, body.id)

          return res.status(200).json({
            success: true,
          })
        }

        throw createHttpError(400, 'Tipe mutasi tidak valid untuk dihapus permanen.')
      }

      if (recordType === 'project-income') {
        await softDeleteProjectIncome(
          adminClient,
          body.id,
          body.expectedUpdatedAt ?? body.expected_updated_at ?? null
        )
      } else if (recordType === 'loan' || recordType === 'loan-disbursement') {
        await softDeleteLoan(
          adminClient,
          body.id,
          body.expectedUpdatedAt ?? body.expected_updated_at ?? null
        )
      } else {
        throw createHttpError(400, 'Tipe mutasi tidak valid untuk dihapus.')
      }

      return res.status(200).json({
        success: true,
      })
    }

    if (resource === 'loan-payments' && method === 'GET') {
      const paymentId = normalizeText(req.query?.paymentId, null)
      const loanId = normalizeText(req.query?.loanId, null)
      const teamId = normalizeText(req.query?.teamId, null)
      const view = normalizeText(req.query?.view, null)
      const includeDeleted = normalizeText(req.query?.includeDeleted, '') === 'true'

      if (paymentId) {
        const payment = await loadLoanPaymentById(adminClient, paymentId, {
          includeDeleted,
        })

        return res.status(200).json({
          success: true,
          payment,
        })
      }

      if (loanId) {
        const payments = await loadLoanPaymentsByLoanId(adminClient, loanId, {
          includeDeleted,
        })

        return res.status(200).json({
          success: true,
          payments,
        })
      }

      if (view === 'recycle-bin') {
        const effectiveTeamId = await assertTeamAccess(adminClient, telegramUserId, teamId)
        const payments = await loadDeletedLoanPayments(adminClient, effectiveTeamId)

        return res.status(200).json({
          success: true,
          payments,
        })
      }

      throw createHttpError(400, 'Loan ID atau Payment ID wajib diisi.')
    }

    if (method === 'POST' || method === 'PATCH') {
      if (resource === 'loan-payments') {
        const body = await parseRequestBody(req)

        if (method === 'POST') {
          const result = await createLoanPayment(adminClient, body, telegramUserId)

          return res.status(200).json({
            success: true,
            payment: result.payment,
            loan: result.loan,
          })
        }

        if (method === 'PATCH' && normalizeText(body.action, '') === 'restore') {
          const result = await restoreLoanPayment(adminClient, body, telegramUserId)

          return res.status(200).json({
            success: true,
            payment: result.payment,
            loan: result.loan,
          })
        }

        const result = await updateLoanPayment(adminClient, body, telegramUserId)

        return res.status(200).json({
          success: true,
          payment: result.payment,
          loan: result.loan,
        })
      }

      if (method === 'PATCH' && body.action === 'restore') {
        if (recordType === 'project-income') {
          const record = await restoreProjectIncome(
            adminClient,
            body.id,
            body.expectedUpdatedAt ?? body.expected_updated_at ?? null
          )

          return res.status(200).json({
            success: true,
            record,
          })
        }

        if (recordType === 'loan' || recordType === 'loan-disbursement') {
          const record = await restoreLoan(
            adminClient,
            body.id,
            body.expectedUpdatedAt ?? body.expected_updated_at ?? null
          )

          return res.status(200).json({
            success: true,
            record,
          })
        }

        if (recordType === 'bill') {
          const record = await restoreBill(adminClient, body.id, telegramUserId, effectiveTeamId)

          return res.status(200).json({
            success: true,
            record,
          })
        }

        if (recordType === 'attendance-record') {
          const record = await restoreAttendanceRecord(adminClient, body.id)

          return res.status(200).json({
            success: true,
            record,
          })
        }

        throw createHttpError(400, 'Tipe mutasi tidak valid untuk dipulihkan.')
      }

      if (recordType === 'project-income') {
        const record = await upsertProjectIncome(
          adminClient,
          body,
          telegramUserId,
          effectiveTeamId
        )

        return res.status(200).json({
          success: true,
          record,
        })
      }

      if (recordType === 'loan') {
        const record = await upsertLoan(
          adminClient,
          body,
          telegramUserId,
          effectiveTeamId
        )

        return res.status(200).json({
          success: true,
          record,
        })
      }

      throw createHttpError(400, 'Tipe mutasi tidak valid untuk disimpan.')
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed.',
    })
  } catch (error) {
    const statusCode =
      typeof error?.statusCode === 'number' ? error.statusCode : 500

    return res.status(statusCode).json({
      success: false,
      error:
        error instanceof Error ? error.message : 'Terjadi kesalahan di server transaksi.',
    })
  }
}
