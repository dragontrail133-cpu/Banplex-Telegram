import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  Coins,
  CreditCard,
  FileDown,
  FileText,
  RefreshCcw,
  Receipt,
  SlidersHorizontal,
  Send,
  WalletCards,
} from 'lucide-react'
import useAuthStore from '../store/useAuthStore'
import useReportStore from '../store/useReportStore'
import useTelegram from '../hooks/useTelegram'
import {
  REPORT_KIND_OPTIONS,
  formatDateInputValue,
  formatReportPeriodLabel,
  getReportKindOption,
  getBusinessSourceLabel,
} from '../lib/business-report'
import { formatAppDateLabel } from '../lib/date-time'
import {
  AppButton,
  AppCard,
  AppCardStrong,
  AppEmptyState,
  AppErrorState,
  AppInput,
  AppListCard,
  AppListRow,
  AppSelect,
  AppSheet,
  AppToggleGroup,
  PageShell,
  SectionHeader,
} from './ui/AppPrimitives'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0)
}

function MetricCard({ label, value, icon }) {
  const IconComponent = icon

  return (
    <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="app-meta">{label}</p>
          <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">{value}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[var(--app-accent-color)]/10 text-[var(--app-accent-color)]">
          <IconComponent className="h-4 w-4" />
        </span>
      </div>
    </AppCard>
  )
}

function getSummaryCards(reportKind, summary = {}) {
  if (reportKind === 'project_pl') {
    return [
      { label: 'Pendapatan', value: formatCurrency(summary.total_income), icon: WalletCards },
      { label: 'Biaya Material', value: formatCurrency(summary.material_expense), icon: Receipt },
      { label: 'Biaya Gaji', value: formatCurrency(summary.salary_expense), icon: CreditCard },
      { label: 'Net Profit', value: formatCurrency(summary.net_profit ?? summary.net_profit_project), icon: Coins },
    ]
  }

  if (reportKind === 'cash_flow') {
    return [
      { label: 'Cash In', value: formatCurrency(summary.total_inflow), icon: WalletCards },
      { label: 'Cash Out', value: formatCurrency(summary.total_outflow), icon: CreditCard },
      { label: 'Net Cash Flow', value: formatCurrency(summary.total_net_cash_flow), icon: Coins },
      { label: 'Mutasi', value: String(summary.total_mutation ?? 0), icon: FileText },
    ]
  }

  return [
    { label: 'Laba Bersih', value: formatCurrency(summary.net_consolidated_profit), icon: Coins },
    { label: 'Pendapatan', value: formatCurrency(summary.total_income), icon: WalletCards },
    { label: 'Pengeluaran', value: formatCurrency(summary.total_expense), icon: CreditCard },
    { label: 'Outstanding', value: formatCurrency(summary.total_outstanding_bill), icon: Receipt },
  ]
}

function getProjectLabel(summary) {
  return summary?.project_name ?? summary?.name ?? 'Proyek tanpa nama'
}

function ProjectReport() {
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const { tg } = useTelegram()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const reportKind = useReportStore((state) => state.reportKind)
  const reportPeriod = useReportStore((state) => state.reportPeriod)
  const selectedProjectId = useReportStore((state) => state.selectedProjectId)
  const projectSummaries = useReportStore((state) => state.projectSummaries)
  const reportData = useReportStore((state) => state.reportData)
  const isLoading = useReportStore((state) => state.isLoading)
  const isReportLoading = useReportStore((state) => state.isReportLoading)
  const isPdfGenerating = useReportStore((state) => state.isPdfGenerating)
  const isPdfDelivering = useReportStore((state) => state.isPdfDelivering)
  const error = useReportStore((state) => state.error)
  const reportError = useReportStore((state) => state.reportError)
  const pdfSettingsError = useReportStore((state) => state.pdfSettingsError)
  const pdfError = useReportStore((state) => state.pdfError)
  const pdfDeliveryError = useReportStore((state) => state.pdfDeliveryError)
  const fetchProjectSummaries = useReportStore((state) => state.fetchProjectSummaries)
  const fetchPdfSettings = useReportStore((state) => state.fetchPdfSettings)
  const fetchBusinessReportData = useReportStore((state) => state.fetchBusinessReportData)
  const downloadBusinessReportPdf = useReportStore((state) => state.downloadBusinessReportPdf)
  const sendBusinessReportToTelegramDm = useReportStore(
    (state) => state.sendBusinessReportToTelegramDm
  )
  const setReportKind = useReportStore((state) => state.setReportKind)
  const setReportPeriod = useReportStore((state) => state.setReportPeriod)
  const setSelectedProjectId = useReportStore((state) => state.setSelectedProjectId)

  useEffect(() => {
    void fetchProjectSummaries({ force: true }).catch((fetchError) => {
      console.error('Gagal memuat ringkasan Unit Kerja:', fetchError)
    })
  }, [fetchProjectSummaries])

  useEffect(() => {
    if (!currentTeamId) {
      return
    }

    void fetchPdfSettings(currentTeamId).catch((fetchError) => {
      console.error('Gagal memuat pengaturan PDF:', fetchError)
    })
  }, [currentTeamId, fetchPdfSettings])

  useEffect(() => {
    void fetchBusinessReportData().catch((fetchError) => {
      console.error('Gagal memuat data laporan:', fetchError)
    })
  }, [fetchBusinessReportData, reportKind, reportPeriod.dateFrom, reportPeriod.dateTo, selectedProjectId])

  const selectedKindOption = getReportKindOption(reportKind)
  const periodLabel = formatReportPeriodLabel(reportPeriod.dateFrom, reportPeriod.dateTo)
  const summaryCards = getSummaryCards(reportKind, reportData?.summary ?? {})
  const selectedProjectSummary = useMemo(
    () => projectSummaries.find((summary) => String(summary.project_id ?? '').trim() === String(selectedProjectId ?? '').trim()) ?? null,
    [projectSummaries, selectedProjectId]
  )
  const isTelegramMiniWeb = tg != null
  const canDownloadPdf =
    !isPdfGenerating && !isReportLoading && (reportKind !== 'project_pl' || Boolean(selectedProjectId))
  const canSendPdfToDm =
    isTelegramMiniWeb &&
    !isPdfDelivering &&
    !isReportLoading &&
    (reportKind !== 'project_pl' || Boolean(selectedProjectId))
  const reportTabOptions = useMemo(
    () => REPORT_KIND_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    []
  )

  const handleRefresh = () => {
    void fetchBusinessReportData({ force: true }).catch((fetchError) => {
      console.error('Gagal menyegarkan laporan bisnis:', fetchError)
    })
  }

  const handleDownloadPdf = () => {
    void downloadBusinessReportPdf().catch((downloadError) => {
      console.error('Gagal mengunduh PDF bisnis:', downloadError)
    })
  }

  const handleSendPdfToDm = () => {
    void sendBusinessReportToTelegramDm().catch((deliveryError) => {
      console.error('Gagal mengirim PDF bisnis ke DM:', deliveryError)
    })
  }

  return (
    <PageShell className="space-y-4">
      <AppCardStrong className="space-y-4 p-4 sm:p-5">
        <AppToggleGroup
          buttonSize="sm"
          className="space-y-2"
          compact
          options={reportTabOptions}
          onChange={setReportKind}
          value={reportKind}
        />

        <div className="space-y-3 rounded-[24px] border border-[var(--app-border-color)] bg-[var(--app-surface-low-color)] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="app-meta">Rentang tanggal</p>
              <p className="text-sm font-medium leading-6 text-[var(--app-text-color)]">{periodLabel}</p>
            </div>
            <AppButton
              aria-label="Sinkronkan"
              iconOnly
              variant="secondary"
              disabled={isLoading || isReportLoading}
              leadingIcon={<RefreshCcw className={`h-4 w-4 ${isReportLoading ? 'animate-spin' : ''}`} />}
              onClick={handleRefresh}
              type="button"
            />
          </div>
          <div className="min-w-0 space-y-1 sm:border-t sm:border-[var(--app-border-color)] sm:pt-3">
            <p className="app-meta">{reportKind === 'project_pl' ? 'Unit Kerja' : 'Cakupan'}</p>
            <p className="text-sm font-medium leading-6 text-[var(--app-text-color)]">
              {reportKind === 'project_pl'
                ? selectedProjectSummary
                  ? getProjectLabel(selectedProjectSummary)
                  : 'Belum dipilih'
                : 'Seluruh Unit Kerja'}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--app-hint-color)]">{selectedKindOption.description}</p>
          <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-[320px]">
            <AppButton
              variant="secondary"
              fullWidth
              leadingIcon={<SlidersHorizontal className="h-4 w-4" />}
              onClick={() => setIsFilterSheetOpen(true)}
              type="button"
            >
              Filter
            </AppButton>
            <AppButton
              fullWidth
              disabled={!canDownloadPdf}
              leadingIcon={<FileDown className={`h-4 w-4 ${isPdfGenerating ? 'animate-bounce' : ''}`} />}
              onClick={handleDownloadPdf}
              type="button"
            >
              {isPdfGenerating ? 'Membuat PDF...' : 'Unduh PDF'}
            </AppButton>
          </div>
        </div>
        {isTelegramMiniWeb ? (
          <AppButton
            variant="secondary"
            fullWidth
            disabled={!canSendPdfToDm}
            leadingIcon={<Send className={`h-4 w-4 ${isPdfDelivering ? 'animate-pulse' : ''}`} />}
            onClick={handleSendPdfToDm}
            type="button"
          >
            {isPdfDelivering ? 'Mengirim ke DM...' : 'Kirim ke DM'}
          </AppButton>
        ) : null}
      </AppCardStrong>

      <AppSheet
        description="Atur periode dan Unit Kerja yang ingin ditampilkan."
        onClose={() => setIsFilterSheetOpen(false)}
        open={isFilterSheetOpen}
        title="Filter Laporan"
      >
        <div className="space-y-4">
          <label className="space-y-2">
            <span className="app-meta">Dari tanggal</span>
            <AppInput
              disabled={isReportLoading}
              onChange={(event) => setReportPeriod({ dateFrom: event.target.value })}
              type="date"
              value={formatDateInputValue(reportPeriod.dateFrom)}
            />
          </label>

          <label className="space-y-2">
            <span className="app-meta">Sampai tanggal</span>
            <AppInput
              disabled={isReportLoading}
              onChange={(event) => setReportPeriod({ dateTo: event.target.value })}
              type="date"
              value={formatDateInputValue(reportPeriod.dateTo)}
            />
          </label>

          {reportKind === 'project_pl' ? (
            <label className="space-y-2">
              <span className="app-meta">Pilih Unit Kerja</span>
              <AppSelect
                disabled={isReportLoading || projectSummaries.length === 0}
                onChange={(event) => setSelectedProjectId(event.target.value)}
                value={selectedProjectId}
              >
                <option value="">Pilih Unit Kerja</option>
                {projectSummaries.map((summary) => (
                  <option key={summary.project_id} value={summary.project_id}>
                    {getProjectLabel(summary)}
                  </option>
                ))}
              </AppSelect>
            </label>
          ) : null}
        </div>
      </AppSheet>

      {pdfSettingsError || pdfError ? (
        <AppErrorState title="Pengaturan PDF gagal diproses" description={pdfSettingsError ?? pdfError} />
      ) : null}

      {pdfDeliveryError ? (
        <AppErrorState title="Laporan PDF gagal dikirim ke DM" description={pdfDeliveryError} />
      ) : null}

      {error || reportError ? (
        <AppErrorState title="Laporan gagal dimuat" description={error ?? reportError} />
      ) : null}

      <AppCardStrong className="space-y-4 p-4 sm:p-5">
        <SectionHeader eyebrow="Ringkasan" title={selectedKindOption.label} description={periodLabel} />
        {isReportLoading && !reportData ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="h-24 animate-pulse rounded-[24px] bg-[var(--app-surface-low-color)]" />
            <div className="h-24 animate-pulse rounded-[24px] bg-[var(--app-surface-low-color)]" />
            <div className="h-24 animate-pulse rounded-[24px] bg-[var(--app-surface-low-color)]" />
            <div className="h-24 animate-pulse rounded-[24px] bg-[var(--app-surface-low-color)]" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card) => (
              <MetricCard key={card.label} label={card.label} value={card.value} icon={card.icon} />
            ))}
          </div>
        )}
      </AppCardStrong>

      {reportKind === 'executive_finance' ? (
        <div className="space-y-4">
          <AppCardStrong className="space-y-4 p-4 sm:p-5">
            <SectionHeader eyebrow="Portofolio" title="Unit Kerja Aktif" />
            {projectSummaries.length > 0 ? (
              <div className="space-y-2">
                {projectSummaries.map((summary) => (
                  <AppListCard key={summary.project_id} className="bg-[var(--app-surface-strong-color)]">
                    <AppListRow
                      title={getProjectLabel(summary)}
                      description={summary.project_status ?? 'Status belum diisi'}
                      trailing={
                        <div className="text-right">
                          <p className="text-xs font-medium text-[var(--app-hint-color)]">Net Profit</p>
                          <p className="text-sm font-semibold text-[var(--app-text-color)]">
                            {formatCurrency(summary.net_profit_project ?? summary.net_profit)}
                          </p>
                        </div>
                      }
                    />
                  </AppListCard>
                ))}
              </div>
            ) : (
              <AppEmptyState
                icon={<BarChart3 className="h-5 w-5" />}
                title="Belum ada Unit Kerja aktif"
                description="Tambahkan pemasukan atau pengeluaran untuk memunculkan ringkasan lintas proyek."
              />
            )}
          </AppCardStrong>

          <AppCardStrong className="space-y-4 p-4 sm:p-5">
            <SectionHeader eyebrow="Mutasi Kas" title="Arus Kas Masuk dan Keluar" />
            {Array.isArray(reportData?.cashMutations) && reportData.cashMutations.length > 0 ? (
              <div className="space-y-2">
                {reportData.cashMutations.slice(0, 8).map((mutation, index) => (
                  <AppListCard key={`${mutation.transaction_date}-${mutation.description}-${index}`} className="bg-[var(--app-surface-strong-color)]">
                    <AppListRow
                      title={formatAppDateLabel(mutation.transaction_date)}
                      description={`${String(mutation.type ?? '-').toUpperCase()} • ${getBusinessSourceLabel(mutation.source_table)}`}
                      trailing={
                        <div className="text-right">
                          <p className="text-sm font-semibold text-[var(--app-text-color)]">{formatCurrency(mutation.amount)}</p>
                          <p className="text-xs text-[var(--app-hint-color)]">{mutation.description ?? '-'}</p>
                        </div>
                      }
                    />
                  </AppListCard>
                ))}
              </div>
            ) : (
              <AppEmptyState
                icon={<FileText className="h-5 w-5" />}
                title="Belum ada mutasi kas"
                description="Mutasi kas akan muncul ketika transaksi masuk atau keluar sudah tersimpan pada periode ini."
              />
            )}
          </AppCardStrong>
        </div>
      ) : null}

      {reportKind === 'cash_flow' ? (
        <AppCardStrong className="space-y-4 p-4 sm:p-5">
          <SectionHeader eyebrow="Mutasi" title="Rincian Arus Kas" />
          {Array.isArray(reportData?.cashMutations) && reportData.cashMutations.length > 0 ? (
            <div className="space-y-2">
              {reportData.cashMutations.map((mutation, index) => (
                <AppListCard key={`${mutation.transaction_date}-${mutation.description}-${index}`} className="bg-[var(--app-surface-strong-color)]">
                <AppListRow
                  title={formatAppDateLabel(mutation.transaction_date)}
                  description={`${String(mutation.type ?? '-').toUpperCase()} • ${getBusinessSourceLabel(mutation.source_table)}`}
                  trailing={
                    <div className="text-right">
                        <p className="text-sm font-semibold text-[var(--app-text-color)]">{formatCurrency(mutation.amount)}</p>
                        <p className="text-xs text-[var(--app-hint-color)]">{mutation.description ?? '-'}</p>
                      </div>
                    }
                  />
                </AppListCard>
              ))}
            </div>
          ) : (
            <AppEmptyState
              icon={<FileText className="h-5 w-5" />}
              title="Belum ada mutasi kas"
              description="Mutasi kas akan ditampilkan sesuai rentang tanggal yang dipilih."
            />
          )}
        </AppCardStrong>
      ) : null}

      {reportKind === 'project_pl' ? (
        <div className="space-y-4">
          <AppCardStrong className="space-y-4 p-4 sm:p-5">
            <SectionHeader eyebrow="Unit Kerja" title={selectedProjectSummary ? getProjectLabel(selectedProjectSummary) : 'Pilih Unit Kerja'} />
            {selectedProjectSummary ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Pendapatan" value={formatCurrency(selectedProjectSummary.total_income)} icon={WalletCards} />
                <MetricCard label="Biaya Material" value={formatCurrency(selectedProjectSummary.material_expense)} icon={Receipt} />
                <MetricCard label="Biaya Gaji" value={formatCurrency(selectedProjectSummary.salary_expense)} icon={CreditCard} />
                <MetricCard label="Net Profit" value={formatCurrency(selectedProjectSummary.net_profit_project ?? selectedProjectSummary.net_profit)} icon={Coins} />
              </div>
            ) : (
              <AppEmptyState
                icon={<BarChart3 className="h-5 w-5" />}
                title="Pilih Unit Kerja"
                description="Laporan laba rugi proyek membutuhkan satu Unit Kerja terpilih terlebih dahulu."
              />
            )}
          </AppCardStrong>

          <AppCardStrong className="space-y-4 p-4 sm:p-5">
            <SectionHeader eyebrow="Rincian" title="Transaksi Proyek" />
            {reportData?.projectDetail?.summary ? (
              <div className="grid gap-3 lg:grid-cols-3">
                <AppCard className="bg-[var(--app-surface-strong-color)]">
                  <p className="app-meta">Pemasukan</p>
                  <div className="mt-3 space-y-2">
                    {reportData.projectDetail.incomes?.length > 0 ? (
                      reportData.projectDetail.incomes.map((income) => (
                        <AppListCard key={income.id} className="bg-white">
                          <AppListRow
                            title={formatAppDateLabel(income.transaction_date)}
                            description={income.description ?? '-'}
                            trailing={<span className="text-sm font-semibold text-[var(--app-text-color)]">{formatCurrency(income.amount)}</span>}
                          />
                        </AppListCard>
                      ))
                    ) : (
                      <AppEmptyState title="Tidak ada pemasukan" />
                    )}
                  </div>
                </AppCard>

                <AppCard className="bg-[var(--app-surface-strong-color)]">
                  <p className="app-meta">Biaya Material</p>
                  <div className="mt-3 space-y-2">
                    {reportData.projectDetail.expenses?.length > 0 ? (
                      reportData.projectDetail.expenses.map((expense) => (
                        <AppListCard key={expense.id} className="bg-white">
                          <AppListRow
                            title={formatAppDateLabel(expense.expense_date)}
                            description={`${expense.expense_type ?? '-'} • ${expense.description ?? '-'}`}
                            trailing={<span className="text-sm font-semibold text-[var(--app-text-color)]">{formatCurrency(expense.total_amount)}</span>}
                          />
                        </AppListCard>
                      ))
                    ) : (
                      <AppEmptyState title="Tidak ada biaya material" />
                    )}
                  </div>
                </AppCard>

                <AppCard className="bg-[var(--app-surface-strong-color)]">
                  <p className="app-meta">Biaya Gaji</p>
                  <div className="mt-3 space-y-2">
                    {reportData.projectDetail.salaries?.length > 0 ? (
                      reportData.projectDetail.salaries.map((salary) => (
                        <AppListCard key={salary.id} className="bg-white">
                          <AppListRow
                            title={formatAppDateLabel(salary.attendance_date)}
                            description={`${salary.workers?.name ?? salary.worker_name_snapshot ?? 'Pekerja'} • ${salary.attendance_status ?? '-'}`}
                            trailing={<span className="text-sm font-semibold text-[var(--app-text-color)]">{formatCurrency(salary.total_pay)}</span>}
                          />
                        </AppListCard>
                      ))
                    ) : (
                      <AppEmptyState title="Tidak ada biaya gaji" />
                    )}
                  </div>
                </AppCard>
              </div>
            ) : (
              <AppEmptyState
                icon={<BarChart3 className="h-5 w-5" />}
                title="Detail proyek belum tersedia"
                description="Pilih Unit Kerja lalu tunggu data dimuat untuk melihat rincian transaksi."
              />
            )}
          </AppCardStrong>
        </div>
      ) : null}
    </PageShell>
  )
}

export default ProjectReport
