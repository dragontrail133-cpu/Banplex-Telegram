import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarCheck2,
  ChevronRight,
  Clock3,
  FileText,
  FolderKanban,
  RefreshCw,
  Trash2,
  TrendingUp,
  User,
  UsersRound,
  Wallet,
} from 'lucide-react'
import ActionCard from '../components/ui/ActionCard'
import BrandLoader from '../components/ui/BrandLoader'
import SmartList from '../components/ui/SmartList'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useBillStore from '../store/useBillStore'
import useDashboardStore from '../store/useDashboardStore'
import useIncomeStore from '../store/useIncomeStore'
import useReportStore from '../store/useReportStore'
import {
  formatAppCalendarLabel,
  formatAppSyncLabel,
  getAppTodayKey,
  toAppDateKey,
} from '../lib/date-time'
import { logPerf, nowMs, roundMs } from '../lib/timing'
import {
  formatTransactionTimestamp,
  getTransactionCreatorLabel,
  shouldHideTransactionAmount,
} from '../lib/transaction-presentation'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})
const compactCurrencyFormatter = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
})

const quickFilters = [
  { value: 'all', label: 'Semua' },
  { value: 'today', label: 'Hari Ini' },
  { value: 'project', label: 'Proyek' },
]
const dashboardPerfEnabled = import.meta.env.DEV

const dashboardActions = [
  {
    label: 'Jurnal',
    to: '/transactions',
    icon: FileText,
    iconClassName: 'bg-[var(--app-tone-success-bg)] text-[var(--app-tone-success-text)]',
  },
  {
    label: 'Riwayat',
    to: '/transactions/history',
    icon: Clock3,
    iconClassName: 'bg-[var(--app-tone-warning-bg)] text-[var(--app-tone-warning-text)]',
  },
  {
    label: 'Halaman Sampah',
    to: '/transactions/recycle-bin',
    icon: Trash2,
    iconClassName: 'bg-[var(--app-tone-info-bg)] text-[var(--app-tone-info-text)]',
  },
  {
    label: 'Catatan Absensi',
    to: '/payroll',
    icon: CalendarCheck2,
    iconClassName: 'bg-[var(--app-tone-neutral-bg)] text-[var(--app-tone-neutral-text)]',
  },
  {
    label: 'Unit Kerja',
    to: '/reports',
    icon: FolderKanban,
    iconClassName: 'bg-[var(--app-brand-accent-muted)] text-[var(--app-brand-accent)]',
  },
  {
    label: 'Tim',
    to: '/more/team-invite',
    icon: UsersRound,
    iconClassName: 'bg-[var(--app-surface-low-color)] text-[var(--app-text-color)]',
  },
]

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0)
}

function formatCompactCurrency(value) {
  const numericValue = Number(value)
  const normalizedValue = Number.isFinite(numericValue) ? numericValue : 0
  const formattedValue = compactCurrencyFormatter.format(Math.abs(normalizedValue))

  return `${normalizedValue < 0 ? '-' : ''}Rp ${formattedValue}`
}

function parseTimestamp(...values) {
  for (const value of values) {
    const parsedDate = new Date(String(value ?? ''))
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate.getTime()
  }
  return 0
}

function getUserDisplayName(telegramUser, authUser) {
  const telegramFullName = [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(' ').trim()
  const resolvedValue = authUser?.name || telegramFullName || telegramUser?.username || null
  const normalizedValue = String(resolvedValue ?? '').trim()
  return normalizedValue.length > 0 ? normalizedValue : 'Pengguna Telegram'
}

function getUserInitials(name) {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function pickText(...values) {
  for (const value of values) {
    const normalizedValue = String(value ?? '').trim()
    if (normalizedValue.length > 0) return normalizedValue
  }
  return ''
}

function buildTransactionItem(transaction) {
  const kind = transaction.type === 'expense' ? 'expense' : 'income'
  const isExpense = kind === 'expense'
  const timestamp = parseTimestamp(transaction.transaction_date, transaction.created_at, transaction.updated_at)
  const creatorBadge = getTransactionCreatorLabel(transaction)
  const fallbackTitle =
    transaction.sourceType === 'loan-disbursement'
      ? 'Dana Masuk / Pinjaman'
      : transaction.sourceType === 'loan-payment'
        ? 'Bayar Pinjaman'
        : transaction.sourceType === 'bill-payment'
          ? 'Bayar Tagihan'
          : isExpense
            ? 'Mutasi Keluar'
            : 'Mutasi Masuk'
  
  let badge = creatorBadge
  let badgeColorClass = 'bg-[var(--app-surface-low-color)] text-[var(--app-text-color)]'
  let Icon = isExpense ? ArrowUpRight : ArrowDownLeft
  let iconColorClass = isExpense ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
  let amountColorClass = isExpense ? 'text-[var(--app-text-color)]' : 'text-emerald-700'

  if (transaction.sourceType === 'loan-disbursement') {
    Icon = User
    iconColorClass = 'bg-slate-100 text-slate-700'
    amountColorClass = 'text-on-surface'
  } else if (transaction.sourceType === 'loan-payment' || transaction.sourceType === 'bill-payment') {
    Icon = ArrowUpRight
    iconColorClass = 'bg-amber-50 text-amber-700'
    amountColorClass = 'text-on-surface'
  }

  return {
    id: transaction.id,
    kind,
    sourceType: transaction.sourceType,
    title: pickText(transaction.description, fallbackTitle),
    subtitle: formatTransactionTimestamp(transaction, ['created_at', 'updated_at', 'transaction_date']),
    details: [pickText(transaction.project_name, transaction.party_label)].filter(Boolean),
    amount: Number(transaction.amount) || 0,
    amountColorClass,
    badge,
    badgeColorClass,
    Icon,
    iconColorClass,
    timestamp,
    dateKey: toAppDateKey(transaction.transaction_date || transaction.created_at),
    editType: transaction.sourceType === 'project-income' ? 'project-income' : transaction.sourceType === 'loan-disbursement' ? 'loan' : transaction.sourceType,
    raw: transaction,
    projectLabel: transaction.project_name || '',
    payable: false,
    editable: ['project-income', 'loan-disbursement'].includes(transaction.sourceType),
    deletable: ['project-income', 'loan-disbursement'].includes(transaction.sourceType),
  }
}

function Dashboard() {
  const navigate = useNavigate()
  const { user: telegramUser } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const summary = useDashboardStore((state) => state.summary)
  const workspaceTransactions = useDashboardStore((state) => state.workspaceTransactions)
  const dashboardError = useDashboardStore((state) => state.error)
  const workspaceError = useDashboardStore((state) => state.workspaceError)
  const dashboardLoading = useDashboardStore((state) => state.isLoading)
  const isWorkspaceLoading = useDashboardStore((state) => state.isWorkspaceLoading)
  const isRefreshing = useDashboardStore((state) => state.isRefreshing)
  const refreshDashboard = useDashboardStore((state) => state.refreshDashboard)
  const fetchWorkspaceTransactions = useDashboardStore(
    (state) => state.fetchWorkspaceTransactions
  )
  const lastUpdatedAt = useDashboardStore((state) => state.lastUpdatedAt)
  const bills = useBillStore((state) => state.bills)
  const billsError = useBillStore((state) => state.error)
  const billsLoading = useBillStore((state) => state.isLoading)
  const fetchUnpaidBills = useBillStore((state) => state.fetchUnpaidBills)
  const loans = useIncomeStore((state) => state.loans)
  const loansError = useIncomeStore((state) => state.error)
  const isLoansLoading = useIncomeStore((state) => state.isLoadingLoans)
  const fetchLoans = useIncomeStore((state) => state.fetchLoans)
  const portfolioSummary = useReportStore((state) => state.portfolioSummary)
  const reportError = useReportStore((state) => state.error)
  const reportLoading = useReportStore((state) => state.isLoading)
  const fetchProjectSummaries = useReportStore((state) => state.fetchProjectSummaries)

  const dashboardMountedAtRef = useRef(nowMs())
  const dashboardFirstUsableLoggedRef = useRef(false)
  const [activeFilter, setActiveFilter] = useState('all')

  const userDisplayName = getUserDisplayName(telegramUser, authUser)
  const userInitials = useMemo(() => getUserInitials(userDisplayName), [userDisplayName])
  const todayKey = getAppTodayKey()
  const todayLabel = formatAppCalendarLabel(new Date())

  const refreshAllData = useCallback(async () => {
    if (!currentTeamId) return
    const measureBranch = async (label, run) => {
      const branchStartedAt = nowMs()
      try {
        return await run()
      } finally {
        logPerf(
          `Dashboard ${label}`,
          {
            durationMs: roundMs(nowMs() - branchStartedAt),
          },
          dashboardPerfEnabled
        )
      }
    }

    const fastBranches = Promise.all([
      measureBranch('summary refresh', () => refreshDashboard(currentTeamId)),
      measureBranch('unpaid bills', () => fetchUnpaidBills({ teamId: currentTeamId })),
      measureBranch('loan list', () => fetchLoans({ teamId: currentTeamId })),
      measureBranch('project summaries', () => fetchProjectSummaries({ force: true })),
    ])

    if (typeof window !== 'undefined') {
      const scheduleWorkspaceTransactions = () => {
        void measureBranch('workspace transactions', () =>
          fetchWorkspaceTransactions(currentTeamId, { silent: true })
        )
      }

      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(scheduleWorkspaceTransactions)
      } else {
        window.setTimeout(scheduleWorkspaceTransactions, 0)
      }
    } else {
      void measureBranch('workspace transactions', () =>
        fetchWorkspaceTransactions(currentTeamId, { silent: true })
      )
    }

    return fastBranches
  }, [
    currentTeamId,
    fetchLoans,
    fetchProjectSummaries,
    fetchUnpaidBills,
    fetchWorkspaceTransactions,
    refreshDashboard,
  ])

  useEffect(() => {
    void refreshAllData()
  }, [refreshAllData])

  useEffect(() => {
    dashboardMountedAtRef.current = nowMs()
    dashboardFirstUsableLoggedRef.current = false
  }, [currentTeamId])

  const unifiedItems = useMemo(() => {
    return [...workspaceTransactions.map(buildTransactionItem)].sort(
      (left, right) => right.timestamp - left.timestamp
    )
  }, [workspaceTransactions])

  const filteredItems = useMemo(() => {
    if (activeFilter === 'today') return unifiedItems.filter((item) => item.dateKey === todayKey)
    if (activeFilter === 'project') return unifiedItems.filter((item) => Boolean(item.projectLabel))
    return unifiedItems
  }, [activeFilter, todayKey, unifiedItems])

  const recentItems = useMemo(() => {
    return filteredItems.slice(0, 5)
  }, [filteredItems])

  const combinedError = useMemo(() => {
    return [dashboardError, workspaceError, billsError, loansError, reportError]
      .filter((message, index, list) => Boolean(message) && list.indexOf(message) === index)
      .join(' | ')
  }, [billsError, dashboardError, loansError, reportError, workspaceError])

  const pendingBillAmount = useMemo(() => {
    return bills.reduce((total, bill) => total + Number(bill.remainingAmount ?? 0), 0)
  }, [bills])

  const activeLoans = useMemo(() => {
    return loans.filter((loan) => Number(loan.remaining_amount ?? 0) > 0)
  }, [loans])

  const activeLoanAmount = useMemo(() => {
    return activeLoans.reduce((total, loan) => total + Number(loan.remaining_amount ?? 0), 0)
  }, [activeLoans])
  const handleOpenBillsPage = useCallback(() => {
    navigate('/tagihan')
  }, [navigate])

  const isLoading = Boolean(currentTeamId) && (dashboardLoading || isWorkspaceLoading || billsLoading || isLoansLoading || reportLoading || isRefreshing)
  const currentProfit = portfolioSummary?.net_consolidated_profit ?? 0
  const cashBalance = summary?.endingBalance ?? 0
  const firstName = userDisplayName.split(' ')[0] || userDisplayName
  const profitLabel = currentProfit >= 0 ? 'Stabil' : 'Perlu perhatian'
  const profitToneClassName =
    currentProfit >= 0
      ? 'bg-[var(--app-tone-success-bg)] text-[var(--app-tone-success-text)]'
      : 'bg-[var(--app-tone-danger-bg)] text-[var(--app-tone-danger-text)]'
  const showDashboardSkeleton = isLoading && recentItems.length === 0 && !combinedError
  const hasWorkspace = Boolean(currentTeamId)

  useEffect(() => {
    if (!dashboardPerfEnabled || dashboardFirstUsableLoggedRef.current) {
      return
    }

    if (!currentTeamId || isLoading || combinedError || recentItems.length === 0) {
      return
    }

    dashboardFirstUsableLoggedRef.current = true
    logPerf(
      'Dashboard first usable state',
      {
        mountMs: roundMs(nowMs() - dashboardMountedAtRef.current),
        recentCount: recentItems.length,
        activeLoans: activeLoans.length,
      },
      dashboardPerfEnabled
    )
  }, [
    activeLoans.length,
    combinedError,
    currentTeamId,
    isLoading,
    recentItems.length,
  ])

  if (hasWorkspace && showDashboardSkeleton) {
    return (
      <section
        className="grid min-h-[calc(100dvh-8.5rem)] place-items-center px-4 text-center"
        style={{
          marginTop: 'calc(-1 * max(0.75rem, env(safe-area-inset-top)))',
        }}
      >
        <div className="flex flex-col items-center gap-5">
          <BrandLoader context="server" size="hero" />
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--app-text-color)]">
              Memuat dashboard
            </h2>
            <p className="max-w-[20rem] text-sm leading-6 text-[var(--app-hint-color)]">
              Menyiapkan data terbaru.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4 pb-4">
      <section className="app-page-surface px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--app-surface-low-color)] text-sm font-semibold text-[var(--app-brand-accent)]">
              {telegramUser?.photo_url ? (
                <img
                  alt={userDisplayName}
                  className="h-full w-full object-cover"
                  src={telegramUser.photo_url}
                />
              ) : (
                userInitials
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[1.75rem] font-bold tracking-[-0.045em] text-[var(--app-text-color)]">
                Halo, {firstName}
              </h1>
              <p className="mt-1 text-sm text-[var(--app-hint-color)]">{todayLabel}</p>
            </div>
          </div>
          <button
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[20px] bg-[var(--app-surface-low-color)] text-[var(--app-brand-accent)] transition active:scale-[0.98] disabled:opacity-60"
            disabled={!hasWorkspace || isLoading}
            onClick={() => void refreshAllData()}
            type="button"
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="app-chip">Team {currentTeamId || '-'}</span>
          <span className="app-chip">Sinkron {formatAppSyncLabel(lastUpdatedAt)}</span>
          <span className="app-chip">{recentItems.length} mutasi terbaru</span>
        </div>

        <div className="mt-4 space-y-3">
          <article
            className="relative overflow-hidden rounded-[28px] px-4 py-4 text-[var(--app-brand-accent-contrast)] shadow-[var(--app-card-shadow-strong)]"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--app-brand-accent) 84%, #002116), var(--app-brand-accent))',
            }}
          >
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[var(--app-brand-accent-soft)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
              Saldo Kas
            </p>
            <p className="mt-3 text-[1.85rem] font-bold leading-none tracking-[-0.05em]">
              {formatCurrency(cashBalance)}
            </p>
            <div className="mt-4 inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--app-brand-accent-contrast)_24%,transparent)] bg-[var(--app-surface-strong-color)] px-3 py-1 text-[11px] font-semibold text-[var(--app-text-color)]">
              <Wallet className="h-3.5 w-3.5" />
              Posisi kas aktif
            </div>
          </article>

          <div className="grid grid-cols-2 gap-3">
            <article className="app-card px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                Laba Bersih
              </p>
              <p className="mt-3 text-[1.5rem] font-bold leading-tight tracking-[-0.045em] text-[var(--app-text-color)]">
                {formatCompactCurrency(currentProfit)}
              </p>
              <div className={`mt-4 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ${profitToneClassName}`}>
                <TrendingUp className="h-3.5 w-3.5" />
                {profitLabel}
              </div>
            </article>

            <article className="app-card px-4 py-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                Pinjaman Aktif
              </p>
              <p className="mt-3 text-[1.5rem] font-bold leading-tight tracking-[-0.045em] text-[var(--app-text-color)]">
                {formatCompactCurrency(activeLoanAmount)}
              </p>
              <p className="mt-4 text-xs text-[var(--app-hint-color)]">
                {activeLoans.length} pinjaman aktif
              </p>
            </article>
          </div>

          <button
            className="app-card group flex w-full items-center px-4 py-3 text-left transition active:scale-[0.985]"
            onClick={handleOpenBillsPage}
            type="button"
            aria-label="Buka halaman Tagihan"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] bg-[var(--app-tone-warning-bg)] text-[var(--app-tone-warning-text)]">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  Tagihan Pending
                </p>
                <p className="mt-0.5 text-xs leading-5 text-[var(--app-hint-color)]">
                  {bills.length} tagihan perlu dibayar
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tracking-[-0.03em] text-[var(--app-text-color)]">
                  {formatCurrency(pendingBillAmount)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--app-hint-color)] transition group-active:translate-x-0.5" />
            </div>
          </button>
        </div>
      </section>

      {combinedError ? (
        <section className="app-card px-4 py-4 app-tone-danger">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="app-meta text-[var(--app-tone-danger-text)]">Gagal Sinkron</p>
              <p className="mt-2 text-sm leading-6 text-[var(--app-tone-danger-text)]">
                {combinedError}
              </p>
            </div>
            <button
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--app-tone-danger-text)] transition active:scale-[0.98]"
              onClick={() => void refreshAllData()}
              type="button"
            >
              Coba Lagi
            </button>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="px-1">
          <p className="app-kicker">Aksi Utama</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {dashboardActions.map((action) => {
            const Icon = action.icon

            return (
              <button
                key={action.to}
                className="app-card flex min-h-[88px] items-center gap-3 px-4 py-4 text-left transition active:scale-[0.985]"
                onClick={() => navigate(action.to)}
                type="button"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] ${action.iconClassName}`}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--app-text-color)]">
                    {action.label}
                  </span>
                  {action.description ? (
                    <span className="mt-1 block text-xs leading-5 text-[var(--app-hint-color)]">
                      {action.description}
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="app-page-surface px-3 py-3">
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <p className="app-kicker">Jurnal</p>
            <h2 className="app-section-title">Aktivitas terbaru</h2>
          </div>
          <button
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--app-brand-accent-muted)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-brand-accent)] transition active:scale-[0.98]"
            onClick={() => navigate('/transactions')}
            type="button"
          >
            Lihat Semua
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {quickFilters.map((filter) => (
            <button
              key={filter.value}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition active:scale-[0.98] ${
                activeFilter === filter.value
                  ? 'bg-[var(--app-brand-accent)] text-[var(--app-brand-accent-contrast)]'
                  : 'bg-[var(--app-surface-low-color)] text-[var(--app-hint-color)]'
              }`}
              onClick={() => setActiveFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        {!hasWorkspace ? (
          <div className="px-1 py-6">
            <div className="app-card app-tone-warning px-4 py-4">
              <p className="app-meta text-[var(--app-tone-warning-text)]">Workspace</p>
              <p className="mt-2 text-sm leading-6 text-[var(--app-tone-warning-text)]">
                Team aktif belum tersedia. Login ulang atau pilih workspace yang benar.
              </p>
            </div>
          </div>
        ) : (
          <SmartList
            key={`${activeFilter}-${recentItems.length}`}
            data={recentItems}
            initialCount={recentItems.length}
            className="flex flex-col gap-3 px-1 pt-3"
            emptyState={
              <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--app-surface-low-color)]">
                  <Wallet className="h-8 w-8 text-[var(--app-hint-color)]" />
                </div>
                <h3 className="mt-4 text-lg font-bold tracking-[-0.03em] text-[var(--app-text-color)]">
                  Belum ada mutasi
                </h3>
                <p className="mt-2 max-w-[260px] text-sm leading-6 text-[var(--app-hint-color)]">
                  Coba ganti filter atau tambahkan transaksi baru dari aksi utama di atas.
                </p>
              </div>
            }
            renderItem={(item) => (
                <ActionCard
                  key={item.id}
                  title={item.title}
                  subtitle={item.subtitle}
                  details={item.details}
                  amount={
                    shouldHideTransactionAmount(item.raw)
                      ? null
                      : `${item.amount < 0 ? '-' : '+'}${formatCurrency(Math.abs(item.amount))}`
                  }
                amountClassName={item.amountColorClass}
                badge={item.badge}
                actions={[
                  {
                    id: 'open-detail',
                    label: 'Detail',
                    icon: <ChevronRight className="h-4 w-4" />,
                    onClick: () =>
                      navigate(
                        item.sourceType === 'bill-payment' || item.sourceType === 'loan-payment'
                          ? `/transactions/${item.id}?surface=pembayaran`
                          : `/transactions/${item.id}`,
                        {
                          state:
                            item.sourceType === 'bill-payment' || item.sourceType === 'loan-payment'
                              ? {
                                  transaction: item.raw,
                                  detailSurface: 'pembayaran',
                                }
                              : {
                                  transaction: item.raw,
                                },
                        }
                      ),
                  },
                ]}
                leadingIcon={
                  <div className={`flex h-11 w-11 items-center justify-center rounded-[18px] ${item.iconColorClass}`}>
                    <item.Icon className="h-5 w-5" />
                  </div>
                }
                className="app-card px-4 py-4"
              />
            )}
          />
        )}

        {hasWorkspace && filteredItems.length > 0 ? (
          <div className="px-1 pt-3">
            <button
              className="flex w-full items-center justify-between rounded-[24px] bg-[var(--app-surface-low-color)] px-4 py-3 text-sm font-semibold text-[var(--app-text-color)] transition active:scale-[0.98]"
              onClick={() => navigate('/transactions')}
              type="button"
            >
              <span>Lihat semua mutasi</span>
              <ChevronRight className="h-4 w-4 text-[var(--app-hint-color)]" />
            </button>
          </div>
        ) : null}
      </section>
    </section>
  )
}

export default Dashboard
