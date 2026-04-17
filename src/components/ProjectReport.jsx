import { useEffect, useMemo, useState } from 'react'
import { BarChart3, FileText, RefreshCcw, Sparkles, WalletCards } from 'lucide-react'
import useReportStore from '../store/useReportStore'
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCardDashed,
  AppCardStrong,
  AppEmptyState,
  AppErrorState,
  SectionHeader,
} from './ui/AppPrimitives'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  const amount = Number(value)

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function formatDate(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return '-'
  }

  const parsedDate = new Date(normalizedValue)

  if (!Number.isNaN(parsedDate.getTime())) {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(parsedDate)
  }

  return normalizedValue
}

function getProfitStyles(value) {
  if (value >= 0) {
    return {
      cardClassName: 'app-tone-success',
      amountClassName: 'text-[var(--app-tone-success-text)]',
      badgeTone: 'success',
      label: 'Untung',
    }
  }

  return {
    cardClassName: 'app-tone-danger',
    amountClassName: 'text-[var(--app-tone-danger-text)]',
    badgeTone: 'danger',
    label: 'Rugi',
  }
}

function buildCompactSummary(projectSummaries) {
  return projectSummaries.reduce(
    (accumulator, summary) => {
      accumulator.totalIncome += Number(summary.total_income ?? 0)
      accumulator.materialExpense += Number(summary.material_expense ?? 0)
      accumulator.operatingExpense += Number(summary.operating_expense ?? 0)
      accumulator.salaryExpense += Number(summary.salary_expense ?? 0)
      accumulator.grossProfit += Number(summary.gross_profit ?? 0)
      accumulator.netProfit += Number(summary.net_profit ?? 0)

      return accumulator
    },
    {
      totalIncome: 0,
      materialExpense: 0,
      operatingExpense: 0,
      salaryExpense: 0,
      grossProfit: 0,
      netProfit: 0,
    }
  )
}

function getProjectName(summary) {
  return summary.project_name ?? 'Proyek tanpa nama'
}

function ProjectReport() {
  const [expandedProjectId, setExpandedProjectId] = useState(null)
  const projectSummaries = useReportStore((state) => state.projectSummaries)
  const selectedProjectDetail = useReportStore((state) => state.selectedProjectDetail)
  const isLoading = useReportStore((state) => state.isLoading)
  const isDetailLoading = useReportStore((state) => state.isDetailLoading)
  const error = useReportStore((state) => state.error)
  const detailError = useReportStore((state) => state.detailError)
  const fetchProjectSummaries = useReportStore((state) => state.fetchProjectSummaries)
  const fetchProjectDetail = useReportStore((state) => state.fetchProjectDetail)

  const compactSummary = useMemo(
    () => buildCompactSummary(projectSummaries),
    [projectSummaries]
  )

  useEffect(() => {
    fetchProjectSummaries({ force: true }).catch((fetchError) => {
      console.error('Gagal memuat laporan proyek:', fetchError)
    })
  }, [fetchProjectSummaries])

  const handleToggleDetail = async (projectId) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null)
      return
    }

    setExpandedProjectId(projectId)
    await fetchProjectDetail(projectId)
  }

  return (
    <section className="space-y-4">
      <AppCardStrong className="space-y-4 p-4 sm:p-5">
        <SectionHeader
          eyebrow="Laporan Proyek"
          action={
            <AppButton
              variant="secondary"
              disabled={isLoading}
              leadingIcon={<RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={() => {
                void fetchProjectSummaries({ force: true }).catch((fetchError) => {
                  console.error('Gagal memuat ulang laporan proyek:', fetchError)
                })
              }}
              type="button"
            >
              Sinkronkan
            </AppButton>
          }
        />

        <AppCard className="space-y-4 bg-[var(--app-accent-color)]/8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <AppBadge tone="info" icon={Sparkles}>
                Portfolio Overview
              </AppBadge>
              <div>
                <p className="text-sm font-medium text-[var(--app-hint-color)]">
                  Laba bersih seluruh proyek
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--app-text-color)]">
                  {formatCurrency(compactSummary.netProfit)}
                </p>
              </div>
            </div>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-white/85 text-[var(--app-accent-color)] shadow-sm">
              <WalletCards className="h-5 w-5" />
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
              <p className="app-meta">Total Pemasukan</p>
              <p className="text-lg font-semibold text-[var(--app-text-color)]">
                {formatCurrency(compactSummary.totalIncome)}
              </p>
            </AppCard>
            <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
              <p className="app-meta">Total Biaya</p>
              <p className="text-lg font-semibold text-[var(--app-text-color)]">
                {formatCurrency(
                  compactSummary.materialExpense +
                    compactSummary.operatingExpense +
                    compactSummary.salaryExpense
                )}
              </p>
            </AppCard>
          </div>
        </AppCard>
      </AppCardStrong>

      {error ? (
        <AppErrorState
          title="Laporan proyek gagal dimuat"
          description={error}
        />
      ) : null}

      {projectSummaries.length > 0 ? (
        <div className="space-y-4">
          {projectSummaries.map((summary) => {
            const profitStyles = getProfitStyles(summary.net_profit)
            const isActive = expandedProjectId === summary.project_id
            const summaryProjectName = getProjectName(summary)

            return (
              <AppCardStrong
                className="space-y-4 overflow-hidden p-4 sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[var(--app-accent-color)]/10 text-[var(--app-accent-color)]">
                        <BarChart3 className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--app-hint-color)]">
                          {summary.project_status || 'Status belum diisi'}
                        </p>
                        <p className="truncate text-lg font-semibold tracking-[-0.02em] text-[var(--app-text-color)]">
                          {summaryProjectName}
                        </p>
                      </div>
                    </div>

                  </div>

                  <AppCard className={`${profitStyles.cardClassName} min-w-0 space-y-2 px-4 py-3 lg:min-w-[220px]`}>
                    <p className="app-meta">Laba / Rugi Bersih</p>
                    <p className={`text-2xl font-semibold tracking-[-0.03em] ${profitStyles.amountClassName}`}>
                      {formatCurrency(summary.net_profit)}
                    </p>
                    <p className="text-sm leading-6 opacity-80">
                      Gross profit {formatCurrency(summary.gross_profit)}
                    </p>
                  </AppCard>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
                    <p className="app-meta">Pemasukan</p>
                    <p className="text-base font-semibold text-[var(--app-text-color)]">
                      {formatCurrency(summary.total_income)}
                    </p>
                  </AppCard>
                  <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
                    <p className="app-meta">Biaya Material</p>
                    <p className="text-base font-semibold text-[var(--app-text-color)]">
                      {formatCurrency(summary.material_expense)}
                    </p>
                  </AppCard>
                  <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
                    <p className="app-meta">Biaya Gaji</p>
                    <p className="text-base font-semibold text-[var(--app-text-color)]">
                      {formatCurrency(summary.salary_expense)}
                    </p>
                  </AppCard>
                  <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
                    <p className="app-meta">Biaya Ops</p>
                    <p className="text-base font-semibold text-[var(--app-text-color)]">
                      {formatCurrency(summary.operating_expense)}
                    </p>
                  </AppCard>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <AppButton
                    variant="secondary"
                    leadingIcon={<FileText className="h-4 w-4" />}
                    onClick={() => void handleToggleDetail(summary.project_id)}
                    type="button"
                  >
                    {isActive ? 'Tutup Breakdown' : 'Lihat Breakdown'}
                  </AppButton>
                </div>

                {isActive ? (
                  <AppCard className="space-y-4 bg-[var(--app-surface-strong-color)]">
                    {isDetailLoading ? (
                      <AppCardDashed className="space-y-4 p-4">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="h-20 animate-pulse rounded-[20px] bg-[var(--app-border-color)]" />
                          <div className="h-20 animate-pulse rounded-[20px] bg-[var(--app-border-color)]" />
                          <div className="h-20 animate-pulse rounded-[20px] bg-[var(--app-border-color)]" />
                        </div>
                        <div className="h-36 animate-pulse rounded-[20px] bg-[var(--app-border-color)]" />
                      </AppCardDashed>
                    ) : detailError ? (
                      <AppErrorState
                        title="Breakdown proyek gagal dimuat"
                        description={detailError}
                      />
                    ) : selectedProjectDetail?.summary ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <AppCard className="space-y-2 bg-white">
                            <p className="app-meta">Pemasukan Total</p>
                            <p className="text-base font-semibold text-[var(--app-text-color)]">
                              {formatCurrency(selectedProjectDetail.summary.total_income)}
                            </p>
                          </AppCard>
                          <AppCard className="space-y-2 bg-white">
                            <p className="app-meta">Gross Profit</p>
                            <p className="text-base font-semibold text-[var(--app-text-color)]">
                              {formatCurrency(selectedProjectDetail.summary.gross_profit)}
                            </p>
                          </AppCard>
                          <AppCard className="space-y-2 bg-white">
                            <p className="app-meta">Net Profit</p>
                            <p className="text-base font-semibold text-[var(--app-text-color)]">
                              {formatCurrency(selectedProjectDetail.summary.net_profit)}
                            </p>
                          </AppCard>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-3">
                          <div className="space-y-2">
                            <p className="app-meta">Pemasukan</p>
                            <div className="space-y-2">
                              {selectedProjectDetail.incomes.length > 0 ? (
                                selectedProjectDetail.incomes.map((income) => (
                                  <AppCard
                                    key={income.id}
                                    className="space-y-1 bg-white px-4 py-3 text-sm"
                                  >
                                    <p className="font-medium text-[var(--app-text-color)]">
                                      {formatDate(income.transaction_date)}
                                    </p>
                                    <p className="text-[var(--app-hint-color)]">
                                      {income.description ?? '-'}
                                    </p>
                                    <p className="font-semibold text-emerald-700">
                                      {formatCurrency(income.amount)}
                                    </p>
                                  </AppCard>
                                ))
                              ) : (
                                <AppCardDashed className="px-4 py-3 text-sm text-[var(--app-hint-color)]">
                                  Tidak ada pemasukan proyek.
                                </AppCardDashed>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="app-meta">Biaya Material</p>
                            <div className="space-y-2">
                              {selectedProjectDetail.expenses.length > 0 ? (
                                selectedProjectDetail.expenses.map((expense) => (
                                  <AppCard
                                    key={expense.id}
                                    className="space-y-1 bg-white px-4 py-3 text-sm"
                                  >
                                    <p className="font-medium text-[var(--app-text-color)]">
                                      {formatDate(expense.expense_date)}
                                    </p>
                                    <p className="text-[var(--app-hint-color)]">
                                      {expense.expense_type ?? '-'} - {expense.description ?? '-'}
                                    </p>
                                    <p className="font-semibold text-rose-700">
                                      {formatCurrency(expense.total_amount)}
                                    </p>
                                  </AppCard>
                                ))
                              ) : (
                                <AppCardDashed className="px-4 py-3 text-sm text-[var(--app-hint-color)]">
                                  Tidak ada pengeluaran proyek.
                                </AppCardDashed>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="app-meta">Biaya Gaji</p>
                            <div className="space-y-2">
                              {selectedProjectDetail.salaries.length > 0 ? (
                                selectedProjectDetail.salaries.map((salary) => (
                                  <AppCard
                                    key={salary.id}
                                    className="space-y-1 bg-white px-4 py-3 text-sm"
                                  >
                                    <p className="font-medium text-[var(--app-text-color)]">
                                      {formatDate(salary.attendance_date)}
                                    </p>
                                    <p className="text-[var(--app-hint-color)]">
                                      {salary.workers?.name ?? 'Pekerja'} - {salary.attendance_status ?? '-'}
                                    </p>
                                    <p className="font-semibold text-amber-700">
                                      {formatCurrency(salary.total_pay)}
                                    </p>
                                  </AppCard>
                                ))
                              ) : (
                                <AppCardDashed className="px-4 py-3 text-sm text-[var(--app-hint-color)]">
                                  Tidak ada biaya gaji yang sudah dibundel.
                                </AppCardDashed>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : null}
                  </AppCard>
                ) : null}
              </AppCardStrong>
            )
          })}
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          <div className="h-32 w-full animate-pulse rounded-[28px] border border-[var(--app-border-color)] bg-[var(--app-surface-color)]/70" />
          <div className="h-32 w-full animate-pulse rounded-[28px] border border-[var(--app-border-color)] bg-[var(--app-surface-color)]/70" />
        </div>
      ) : (
        <AppEmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title="Belum ada laporan proyek"
          description="Tambahkan pemasukan, pengeluaran, atau absensi gaji untuk memunculkan ringkasan."
        />
      )}
    </section>
  )
}

export default ProjectReport
