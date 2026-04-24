import { create } from 'zustand'
import {
  fetchBusinessReportFromApi,
  fetchPartyStatementFromApi,
  fetchProjectDetailFromApi,
  fetchPdfSettingsFromApi,
  fetchProjectSummariesFromApi,
  savePdfSettingsFromApi,
} from '../lib/reports-api'
import { saveBusinessReportPdf } from '../lib/report-pdf'
import { sendBusinessReportPdfToTelegramDm } from '../lib/report-delivery-api'
import {
  formatDateInputValue,
  getDefaultBusinessReportPeriod,
  normalizeReportKind,
} from '../lib/business-report'

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

function createReportQueryKey({ reportKind, dateFrom, dateTo, projectId, partyId }) {
  return [
    normalizeReportKind(reportKind),
    formatDateInputValue(dateFrom),
    formatDateInputValue(dateTo),
    String(projectId ?? '').trim(),
    String(partyId ?? '').trim(),
  ].join('|')
}

const useReportStore = create((set, get) => ({
  projectSummaries: [],
  portfolioSummary: createPortfolioSummary(),
  selectedProjectDetail: null,
  reportKind: 'executive_finance',
  reportPeriod: getDefaultBusinessReportPeriod(),
  selectedProjectId: '',
  selectedPartyId: '',
  reportData: null,
  reportDataKey: null,
  isReportLoading: false,
  reportError: null,
  pdfSettings: null,
  pdfSettingsTeamId: null,
  isLoading: false,
  isDetailLoading: false,
  isPdfSettingsLoading: false,
  isPdfSettingsSaving: false,
  isPdfGenerating: false,
  error: null,
  detailError: null,
  pdfSettingsError: null,
  pdfError: null,
  pdfDeliveryError: null,
  isPdfDelivering: false,
  lastUpdatedAt: null,
  clearError: () =>
    set({
      error: null,
      detailError: null,
      reportError: null,
      pdfSettingsError: null,
      pdfError: null,
      pdfDeliveryError: null,
    }),
  setReportKind: (reportKind) =>
    set({
      reportKind: normalizeReportKind(reportKind),
      reportError: null,
      reportDataKey: null,
      reportData: null,
      selectedPartyId: '',
    }),
  setReportPeriod: (patch = {}) =>
    set((state) => ({
      reportPeriod: {
        dateFrom:
          formatDateInputValue(patch?.dateFrom) || state.reportPeriod.dateFrom,
        dateTo: formatDateInputValue(patch?.dateTo) || state.reportPeriod.dateTo,
      },
      reportError: null,
      reportDataKey: null,
      reportData: null,
    })),
  setSelectedProjectId: (projectId) =>
    set({
      selectedProjectId: String(projectId ?? '').trim(),
      reportError: null,
      reportDataKey: null,
      reportData: null,
    }),
  setSelectedPartyId: (partyId) =>
    set({
      selectedPartyId: String(partyId ?? '').trim(),
      reportError: null,
      reportDataKey: null,
      reportData: null,
    }),
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
  fetchBusinessReportData: async ({ force = false } = {}) => {
    const {
      reportKind,
      reportPeriod,
      selectedProjectId,
      selectedPartyId,
      isReportLoading,
      reportDataKey,
      reportData,
    } = get()
    const normalizedReportKind = normalizeReportKind(reportKind)
    const normalizedProjectId = String(selectedProjectId ?? '').trim()
    const normalizedPartyId = String(selectedPartyId ?? '').trim()
    const dateFrom = formatDateInputValue(reportPeriod?.dateFrom)
    const dateTo = formatDateInputValue(reportPeriod?.dateTo)
    const queryKey = createReportQueryKey({
      reportKind: normalizedReportKind,
      dateFrom,
      dateTo,
      projectId: normalizedProjectId,
      partyId: normalizedPartyId,
    })

    if (normalizedReportKind === 'project_pl' && !normalizedProjectId) {
      set({
        reportData: null,
        reportDataKey: queryKey,
        isReportLoading: false,
        reportError: null,
      })

      return null
    }

    if (
      (normalizedReportKind === 'creditor_statement' ||
        normalizedReportKind === 'supplier_statement' ||
        normalizedReportKind === 'worker_statement') &&
      !normalizedPartyId
    ) {
      set({
        reportData: null,
        reportDataKey: queryKey,
        isReportLoading: false,
        reportError: null,
      })

      return null
    }

    if (!force && !isReportLoading && reportDataKey === queryKey && reportData) {
      return reportData
    }

    set({
      isReportLoading: true,
      reportError: null,
      reportDataKey: queryKey,
    })

    try {
      const nextReportData =
        normalizedReportKind === 'creditor_statement' ||
        normalizedReportKind === 'supplier_statement' ||
        normalizedReportKind === 'worker_statement'
          ? await fetchPartyStatementFromApi({
              partyType:
                normalizedReportKind === 'supplier_statement'
                  ? 'supplier'
                  : normalizedReportKind === 'worker_statement'
                    ? 'worker'
                    : 'creditor',
              partyId: normalizedPartyId,
              dateFrom,
              dateTo,
            })
          : await fetchBusinessReportFromApi({
              reportKind: normalizedReportKind,
              dateFrom,
              dateTo,
              projectId: normalizedReportKind === 'project_pl' ? normalizedProjectId : null,
            })

      set({
        reportData: nextReportData,
        isReportLoading: false,
        reportError: null,
        reportDataKey: queryKey,
      })

      return nextReportData
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat data laporan.')

      set({
        reportData: null,
        isReportLoading: false,
        reportError: normalizedError.message,
      })

      throw normalizedError
    }
  },
  fetchPdfSettings: async (teamId, { force = false } = {}) => {
    const { pdfSettingsTeamId, isPdfSettingsLoading, pdfSettings } = get()

    if (!teamId) {
      set({
        pdfSettings: null,
        pdfSettingsTeamId: null,
        isPdfSettingsLoading: false,
        pdfSettingsError: null,
      })

      return null
    }

    if (!force && !isPdfSettingsLoading && pdfSettingsTeamId === teamId) {
      return pdfSettings
    }

    set({
      isPdfSettingsLoading: true,
      pdfSettingsError: null,
      pdfSettings: pdfSettingsTeamId === teamId ? pdfSettings : null,
      pdfSettingsTeamId: teamId,
    })

    try {
      const nextPdfSettings = await fetchPdfSettingsFromApi(teamId)

      set({
        pdfSettings: nextPdfSettings,
        pdfSettingsTeamId: teamId,
        isPdfSettingsLoading: false,
        pdfSettingsError: null,
      })

      return nextPdfSettings
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat pengaturan PDF.')

      set({
        pdfSettings: null,
        pdfSettingsTeamId: teamId,
        isPdfSettingsLoading: false,
        pdfSettingsError: normalizedError.message,
      })

      throw normalizedError
    }
  },
  savePdfSettings: async (payload = {}) => {
    const teamId = payload?.teamId ?? payload?.team_id

    if (!teamId) {
      throw new Error('Team ID wajib diisi untuk menyimpan pengaturan PDF.')
    }

    set({ isPdfSettingsSaving: true, pdfSettingsError: null })

    try {
      const nextPdfSettings = await savePdfSettingsFromApi(payload)

      set({
        pdfSettings: nextPdfSettings,
        pdfSettingsTeamId: nextPdfSettings?.team_id ?? teamId,
        isPdfSettingsSaving: false,
        pdfSettingsError: null,
      })

      return nextPdfSettings
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menyimpan pengaturan PDF.')

      set({
        isPdfSettingsSaving: false,
        pdfSettingsError: normalizedError.message,
      })

      throw normalizedError
    }
  },
  downloadBusinessReportPdf: async () => {
    const {
      fetchBusinessReportData,
      pdfSettings,
      reportData,
      isPdfGenerating,
    } = get()

    if (isPdfGenerating) {
      return null
    }

    set({ isPdfGenerating: true, pdfError: null, pdfDeliveryError: null })

    try {
      const nextReportData = reportData ?? (await fetchBusinessReportData({ force: true }))

      if (!nextReportData) {
        set({ isPdfGenerating: false, pdfError: 'Data laporan belum tersedia.' })
        return null
      }

      const fileName = await saveBusinessReportPdf({
        reportData: nextReportData,
        pdfSettings,
      })

      set({ isPdfGenerating: false, pdfError: null })

      return fileName
    } catch (error) {
      const normalizedError = toError(error, 'Gagal membuat PDF bisnis.')

      set({
        isPdfGenerating: false,
        pdfError: normalizedError.message,
      })

      throw normalizedError
    }
  },
  sendBusinessReportToTelegramDm: async () => {
    const {
      fetchBusinessReportData,
      pdfSettings,
      reportData,
      isPdfDelivering,
    } = get()

    if (isPdfDelivering) {
      return null
    }

    set({ isPdfDelivering: true, pdfDeliveryError: null, pdfError: null })

    try {
      const nextReportData =
        reportData ?? (await fetchBusinessReportData({ force: true }))

      if (!nextReportData) {
        set({
          isPdfDelivering: false,
          pdfDeliveryError: 'Data laporan belum tersedia.',
        })

        return null
      }

      const result = await sendBusinessReportPdfToTelegramDm({
        reportData: nextReportData,
        pdfSettings,
      })

      set({
        isPdfDelivering: false,
        pdfDeliveryError: result.pdfError ?? null,
      })

      return result
    } catch (error) {
      const normalizedError = toError(error, 'Gagal mengirim laporan PDF ke DM.')

      set({
        isPdfDelivering: false,
        pdfDeliveryError: normalizedError.message,
      })

      throw normalizedError
    }
  },
}))

export default useReportStore
export { useReportStore }
