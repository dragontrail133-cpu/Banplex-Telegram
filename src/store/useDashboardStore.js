import { create } from 'zustand'
import { resolveTeamId } from '../lib/auth-context'
import {
  fetchCashMutationsFromApi,
  fetchTransactionSummaryFromApi,
  fetchWorkspaceTransactionsFromApi,
} from '../lib/transactions-api'

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

async function loadCashMutations(teamId) {
  return fetchCashMutationsFromApi(teamId)
}

async function loadWorkspaceTransactions(teamId) {
  return fetchWorkspaceTransactionsFromApi(teamId)
}

async function loadTransactionSummary(teamId) {
  return fetchTransactionSummaryFromApi(teamId)
}

const useDashboardStore = create((set) => ({
  summary: createEmptySummary(),
  cashMutations: [],
  workspaceTransactions: [],
  isLoading: false,
  isRefreshing: false,
  isWorkspaceLoading: false,
  error: null,
  workspaceError: null,
  lastUpdatedAt: null,
  workspaceLastUpdatedAt: null,
  clearError: () => set({ error: null }),
  clearWorkspaceError: () => set({ workspaceError: null }),
  fetchSummary: async (teamId) => {
    const normalizedTeamId = normalizeTeamId(resolveTeamId(teamId))
    const summaryRow = await loadTransactionSummary(normalizedTeamId)
    const summary = summaryRow
      ? {
          totalIncome: Number(summaryRow.total_income) || 0,
          totalExpense: Number(summaryRow.total_expense) || 0,
          endingBalance: Number(summaryRow.ending_balance) || 0,
        }
      : summarizeCashMutations(await loadCashMutations(normalizedTeamId))

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
  fetchWorkspaceTransactions: async (teamId, { silent = false } = {}) => {
    const normalizedTeamId = normalizeTeamId(resolveTeamId(teamId))

    if (!normalizedTeamId) {
      set({
        workspaceTransactions: [],
        isWorkspaceLoading: false,
        workspaceError: null,
        workspaceLastUpdatedAt: null,
      })

      return []
    }

    set({
      isWorkspaceLoading: !silent,
      workspaceError: null,
    })

    try {
      const workspaceTransactions = await loadWorkspaceTransactions(normalizedTeamId)

      set({
        workspaceTransactions,
        isWorkspaceLoading: false,
        workspaceError: null,
        workspaceLastUpdatedAt: new Date().toISOString(),
      })

      return workspaceTransactions
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat workspace transaksi.')

      set({
        workspaceTransactions: [],
        isWorkspaceLoading: false,
        workspaceError: normalizedError.message,
      })

      throw normalizedError
    }
  },
  refreshDashboard: async (teamId, { silent = false } = {}) => {
    const normalizedTeamId = normalizeTeamId(resolveTeamId(teamId))

    if (!normalizedTeamId) {
      const emptySummary = createEmptySummary()

      set({
        summary: emptySummary,
        cashMutations: [],
        workspaceTransactions: [],
        isLoading: false,
        isRefreshing: false,
        isWorkspaceLoading: false,
        error: null,
        workspaceError: null,
        lastUpdatedAt: null,
        workspaceLastUpdatedAt: null,
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
      const [cashMutations, summaryRow] = await Promise.all([
        loadCashMutations(normalizedTeamId),
        loadTransactionSummary(normalizedTeamId),
      ])
      const summary = summaryRow
        ? {
            totalIncome: Number(summaryRow.total_income) || 0,
            totalExpense: Number(summaryRow.total_expense) || 0,
            endingBalance: Number(summaryRow.ending_balance) || 0,
          }
        : summarizeCashMutations(cashMutations)

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
