import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { resolveTeamId } from '../lib/auth-context'

function createEmptySummary() {
  return {
    totalIncome: 0,
    totalExpense: 0,
    endingBalance: 0,
  }
}

function normalizeTeamId(teamId) {
  const normalizedValue = String(teamId ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : null
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

function mapCashMutationRow(mutation) {
  return {
    ...mutation,
    amount: toNumber(mutation?.amount),
  }
}

function summarizeCashMutations(cashMutations = []) {
  return cashMutations.reduce(
    (summary, mutation) => {
      const amount = toNumber(mutation.amount)

      if (mutation.type === 'expense') {
        return {
          totalIncome: summary.totalIncome,
          totalExpense: summary.totalExpense + amount,
          endingBalance: summary.endingBalance - amount,
        }
      }

      return {
        totalIncome: summary.totalIncome + amount,
        totalExpense: summary.totalExpense,
        endingBalance: summary.endingBalance + amount,
      }
    },
    createEmptySummary()
  )
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

async function loadCashMutations(teamId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedTeamId = resolveTeamId(teamId)

  if (!normalizedTeamId) {
    return []
  }

  const [
    projectIncomesResult,
    loansResult,
    billPaymentsResult,
    loanPaymentsResult,
  ] = await Promise.all([
    supabase
      .from('project_incomes')
      .select(
        'id, team_id, project_id, transaction_date, income_date, amount, description, created_at, updated_at, project_name_snapshot, deleted_at'
      )
      .eq('team_id', normalizedTeamId)
      .is('deleted_at', null),
    supabase
      .from('loans')
      .select(
        'id, team_id, transaction_date, disbursed_date, amount, principal_amount, description, created_at, updated_at, creditor_name_snapshot, deleted_at'
      )
      .eq('team_id', normalizedTeamId)
      .is('deleted_at', null),
    supabase
      .from('bill_payments')
      .select(
        'id, bill_id, team_id, amount, payment_date, notes, created_at, updated_at, worker_name_snapshot, supplier_name_snapshot, project_name_snapshot, deleted_at'
      )
      .eq('team_id', normalizedTeamId)
      .is('deleted_at', null),
    supabase
      .from('loan_payments')
      .select(
        'id, loan_id, team_id, amount, payment_date, notes, created_at, updated_at, creditor_name_snapshot, deleted_at'
      )
      .eq('team_id', normalizedTeamId)
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

  const projectIncomeRows = (projectIncomesResult.data ?? []).map((row) =>
    mapCashMutationRow({
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
    })
  )

  const loanRows = (loansResult.data ?? []).map((row) =>
    mapCashMutationRow({
      id: row.id,
      sourceType: 'loan-disbursement',
      type: 'income',
      amount: row.principal_amount ?? row.amount,
      transaction_date: row.transaction_date ?? row.disbursed_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      description: row.description,
      project_name: null,
      party_label: row.creditor_name_snapshot,
      related_id: null,
    })
  )

  const billPaymentRows = (billPaymentsResult.data ?? []).map((row) =>
    mapCashMutationRow({
      id: row.id,
      sourceType: 'bill-payment',
      type: 'expense',
      amount: row.amount,
      transaction_date: row.payment_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      description: row.notes,
      project_name: row.project_name_snapshot,
      party_label:
        row.supplier_name_snapshot ?? row.worker_name_snapshot ?? null,
      related_id: row.bill_id ?? null,
    })
  )

  const loanPaymentRows = (loanPaymentsResult.data ?? []).map((row) =>
    mapCashMutationRow({
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
    })
  )

  return sortCashMutations([
    ...projectIncomeRows,
    ...loanRows,
    ...billPaymentRows,
    ...loanPaymentRows,
  ])
}

const useDashboardStore = create((set) => ({
  summary: createEmptySummary(),
  cashMutations: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  lastUpdatedAt: null,
  clearError: () => set({ error: null }),
  fetchSummary: async (teamId) => {
    const normalizedTeamId = normalizeTeamId(resolveTeamId(teamId))
    const cashMutations = await loadCashMutations(normalizedTeamId)
    const summary = summarizeCashMutations(cashMutations)

    set({
      summary,
      error: null,
    })

    return summary
  },
  fetchCashMutations: async (teamId) => {
    const normalizedTeamId = normalizeTeamId(resolveTeamId(teamId))
    const cashMutations = await loadCashMutations(normalizedTeamId)

    set({
      cashMutations,
      error: null,
    })

    return cashMutations
  },
  refreshDashboard: async (teamId, { silent = false } = {}) => {
    const normalizedTeamId = normalizeTeamId(resolveTeamId(teamId))

    if (!normalizedTeamId) {
      const emptySummary = createEmptySummary()

      set({
        summary: emptySummary,
        cashMutations: [],
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdatedAt: null,
      })

      return {
        summary: emptySummary,
        cashMutations: [],
      }
    }

    set({
      isLoading: silent ? false : true,
      isRefreshing: silent,
      error: null,
    })

    try {
      const cashMutations = await loadCashMutations(normalizedTeamId)
      const summary = summarizeCashMutations(cashMutations)

      set({
        summary,
        cashMutations,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return {
        summary,
        cashMutations,
      }
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat dashboard.')

      set({
        isLoading: false,
        isRefreshing: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
}))

export default useDashboardStore
export { useDashboardStore }
