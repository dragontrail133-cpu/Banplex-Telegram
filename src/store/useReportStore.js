import { create } from 'zustand'
import {
  fetchProjectDetailFromApi,
  fetchProjectSummariesFromApi,
} from '../lib/reports-api'

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

function createPortfolioSummary(rows = []) {
  return {
    total_income: rows.total_income ?? 0,
    total_material_expense: rows.total_material_expense ?? 0,
    total_operating_expense: rows.total_operating_expense ?? 0,
    total_salary_expense: rows.total_salary_expense ?? 0,
    total_expense: rows.total_expense ?? 0,
    total_project_profit: rows.total_project_profit ?? 0,
    total_company_overhead: rows.total_company_overhead ?? 0,
    net_consolidated_profit: rows.net_consolidated_profit ?? 0,
  }
}

const useReportStore = create((set, get) => ({
  projectSummaries: [],
  portfolioSummary: createPortfolioSummary(),
  selectedProjectDetail: null,
  isLoading: false,
  isDetailLoading: false,
  error: null,
  detailError: null,
  lastUpdatedAt: null,
  clearError: () => set({ error: null, detailError: null }),
  fetchProjectSummaries: async ({ force = false } = {}) => {
    const { projectSummaries, isLoading } = get()

    if (!force && !isLoading && projectSummaries.length > 0) {
      return projectSummaries
    }

    set({ isLoading: true, error: null })

    try {
      const { projectSummaries: nextSummaries, portfolioSummary } =
        await fetchProjectSummariesFromApi()

      set({
        projectSummaries: nextSummaries,
        portfolioSummary,
        isLoading: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return nextSummaries
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat laporan proyek.')

      set({
        projectSummaries: [],
        portfolioSummary: createPortfolioSummary(),
        isLoading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  fetchProjectDetail: async (projectId) => {
    set({ isDetailLoading: true, detailError: null })

    try {
      const detail = await fetchProjectDetailFromApi(projectId)

      set({
        selectedProjectDetail: detail,
        isDetailLoading: false,
        detailError: null,
      })

      return detail
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat detail proyek.')

      set({
        selectedProjectDetail: null,
        isDetailLoading: false,
        detailError: normalizedError.message,
      })

      throw normalizedError
    }
  },
}))

export default useReportStore
export { useReportStore }
