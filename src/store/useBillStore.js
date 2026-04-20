import { create } from 'zustand'
import { resolveTeamId } from '../lib/auth-context'
import {
  fetchBillByIdFromApi,
  fetchUnpaidBillsFromApi,
  softDeleteBillFromApi,
} from '../lib/records-api'

function normalizeTeamId(teamId) {
  const normalizedValue = String(teamId ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : null
}

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

const useBillStore = create((set) => ({
  bills: [],
  isLoading: false,
  error: null,
  lastUpdatedAt: null,
  clearError: () => set({ error: null }),
  fetchBillById: async (billId) => {
    try {
      return await fetchBillByIdFromApi(billId)
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat tagihan.')

      set({
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  softDeleteBill: async (billId, expectedUpdatedAt = null) => {
    try {
      await softDeleteBillFromApi(billId, resolveTeamId(), expectedUpdatedAt)
      return true
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menghapus tagihan.')

      set({
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  fetchUnpaidBills: async ({ teamId, silent = false } = {}) => {
    const normalizedTeamId = normalizeTeamId(resolveTeamId(teamId))

    if (!normalizedTeamId) {
      set({
        bills: [],
        isLoading: false,
        error: null,
        lastUpdatedAt: null,
      })

      return []
    }

    set({
      isLoading: !silent,
      error: null,
    })

    try {
      const nextBills = await fetchUnpaidBillsFromApi(normalizedTeamId)

      set({
        bills: nextBills,
        isLoading: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return nextBills
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat tagihan.')

      set({
        bills: [],
        isLoading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
}))

export default useBillStore
export { useBillStore }
