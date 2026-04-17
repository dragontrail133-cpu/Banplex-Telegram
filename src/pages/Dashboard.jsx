import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  AlertCircle,
  ArrowDownLeft,
  ArrowDownRight, 
  ArrowUpRight,
  CalendarCheck2,
  ChevronRight,
  Landmark,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  RefreshCw, 
  Trash2,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react'
import ActionCard from '../components/ui/ActionCard'
import SmartList from '../components/ui/SmartList'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useBillStore from '../store/useBillStore'
import useDashboardStore from '../store/useDashboardStore'
import useIncomeStore from '../store/useIncomeStore'
import useReportStore from '../store/useReportStore'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const listDateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const quickFilters = [
  { value: 'all', label: 'Semua' },
  { value: 'today', label: 'Hari Ini' },
  { value: 'project', label: 'Proyek' },
]

const dashboardActions = [
  {
    label: 'Pemasukan',
    description: 'Catat termin proyek',
    to: '/edit/project-income/new',
    icon: ArrowUpRight,
    iconClassName: 'bg-[var(--app-tone-success-bg)] text-[var(--app-tone-success-text)]',
  },
  {
    label: 'Pengeluaran',
    description: 'Catat biaya harian',
    to: '/edit/expense/new',
    icon: ArrowDownRight,
    iconClassName: 'bg-[var(--app-tone-warning-bg)] text-[var(--app-tone-warning-text)]',
  },
  {
    label: 'Gaji & Absen',
    description: 'Input absensi harian',
    to: '/attendance/new',
    icon: CalendarCheck2,
    iconClassName: 'bg-[var(--app-tone-info-bg)] text-[var(--app-tone-info-text)]',
  },
  {
    label: 'Pinjaman',
    description: 'Tambah dana masuk',
    to: '/edit/loan/new',
    icon: Wallet,
    iconClassName: 'bg-[var(--app-tone-neutral-bg)] text-[var(--app-tone-neutral-text)]',
  },
  {
    label: 'Master',
    description: 'Kelola data inti',
    to: '/master',
    icon: LayoutGrid,
    iconClassName: 'bg-[var(--app-brand-accent-muted)] text-[var(--app-brand-accent)]',
  },
  {
    label: 'Tim & Tools',
    description: 'Invite, HRD, payroll',
    to: '/more',
    icon: MoreHorizontal,
    iconClassName: 'bg-[var(--app-surface-low-color)] text-[var(--app-text-color)]',
  },
]

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0)
}

function formatCurrencyCompact(value) {
  const amount = Number(value)

  if (!Number.isFinite(amount)) {
    return 'Rp 0'
  }

  const absoluteAmount = Math.abs(amount)

  if (absoluteAmount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`
  }

  if (absoluteAmount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`
  }

  if (absoluteAmount >= 1_000) {
    return `Rp ${(amount / 1_000).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`
  }

  return formatCurrency(amount)
}

function formatDateLabel(value) {
  const parsedDate = new Date(String(value ?? ''))
  if (Number.isNaN(parsedDate.getTime())) return ''
  return dateFormatter.format(parsedDate)
}

function formatListDate(value) {
  const parsedDate = new Date(String(value ?? ''))
  if (Number.isNaN(parsedDate.getTime())) return ''
  return listDateFormatter.format(parsedDate)
}

function formatSyncLabel(value) {
  const parsedDate = new Date(String(value ?? ''))

  if (Number.isNaN(parsedDate.getTime())) {
    return 'belum sinkron'
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedDate)
}

function parseTimestamp(...values) {
  for (const value of values) {
    const parsedDate = new Date(String(value ?? ''))
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate.getTime()
  }
  return 0
}

function getTodayKey() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function toDateKey(value) {
  const parsedDate = new Date(String(value ?? ''))
  if (Number.isNaN(parsedDate.getTime())) return ''
  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`
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
  
  let badge = isExpense ? 'Mutasi Keluar' : 'Mutasi Masuk'
  let badgeColorClass = isExpense ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
  let Icon = isExpense ? ArrowUpRight : ArrowDownLeft
  let iconColorClass = isExpense ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
  let amountColorClass = isExpense ? 'text-[var(--app-text-color)]' : 'text-emerald-700'

  if (transaction.sourceType === 'loan-disbursement') {
    badge = 'Pinjaman'
    badgeColorClass = 'bg-slate-200 text-slate-700'
    Icon = User
    iconColorClass = 'bg-slate-100 text-slate-700'
    amountColorClass = 'text-on-surface'
  } else if (transaction.sourceType === 'loan-payment' || transaction.sourceType === 'bill-payment') {
    badge = 'Pending'
    badgeColorClass = 'bg-amber-100 text-amber-800'
    Icon = ArrowUpRight
    iconColorClass = 'bg-amber-50 text-amber-700'
    amountColorClass = 'text-on-surface'
  }

  return {
    id: transaction.id,
    kind,
    sourceType: transaction.sourceType,
    title: pickText(transaction.description, badge),
    subtitle: pickText(transaction.project_name, transaction.party_label, formatListDate(transaction.transaction_date)),
    amount: Number(transaction.amount) || 0,
    amountColorClass,
    badge,
    badgeColorClass,
    Icon,
    iconColorClass,
    timestamp,
    dateKey: toDateKey(transaction.transaction_date || transaction.created_at),
    editType: transaction.sourceType === 'project-income' ? 'project-income' : transaction.sourceType === 'loan-disbursement' ? 'loan' : transaction.sourceType,
    raw: transaction,
    projectLabel: transaction.project_name || '',
    payable: false,
    editable: ['project-income', 'loan-disbursement'].includes(transaction.sourceType),
    deletable: ['project-income', 'loan-disbursement'].includes(transaction.sourceType),
  }
}

function buildBillItem(bill) {
  const timestamp = parseTimestamp(bill.dueDate, bill.created_at, bill.updated_at)
  const isPayable = String(bill.status ?? 'unpaid').toLowerCase() !== 'paid'
  const statusLabel = bill.status === 'paid' ? 'Lunas' : 'Pending'
  
  return {
    id: bill.id,
    kind: 'bill',
    sourceType: 'bill',
    title: pickText(bill.supplierName, bill.description, 'Tagihan'),
    subtitle: pickText(bill.projectName, formatListDate(bill.dueDate)),
    amount: -Math.abs(Number(bill.remainingAmount ?? bill.amount ?? 0)),
    amountColorClass: 'text-[var(--app-text-color)]',
    badge: statusLabel,
    badgeColorClass: bill.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
    Icon: ArrowUpRight,
    iconColorClass: 'bg-amber-50 text-amber-700',
    timestamp,
    dateKey: toDateKey(bill.dueDate || bill.created_at),
    editType: 'bill',
    raw: bill,
    projectLabel: bill.projectName || '',
    payable: isPayable,
    editable: false,
    deletable: true,
  }
}

function buildLoanItem(loan) {
  const timestamp = parseTimestamp(loan.transaction_date, loan.disbursed_date, loan.created_at, loan.updated_at)
  const remainingAmount = Math.max(Number(loan.remaining_amount ?? 0), 0)
  
  return {
    id: loan.id,
    kind: 'loan',
    sourceType: 'loan',
    title: pickText(loan.creditor_name_snapshot, loan.description, 'Pinjaman'),
    subtitle: pickText(loan.interest_type ? `Bunga ${loan.interest_type}` : '', formatListDate(loan.transaction_date)),
    amount: -remainingAmount,
    amountColorClass: 'text-[var(--app-text-color)]',
    badge: 'Pinjaman',
    badgeColorClass: 'bg-slate-200 text-slate-700',
    Icon: User,
    iconColorClass: 'bg-slate-100 text-slate-700',
    timestamp,
    dateKey: toDateKey(loan.transaction_date || loan.created_at),
    editType: 'loan',
    raw: loan,
    projectLabel: '',
    payable: remainingAmount > 0,
    editable: true,
    deletable: true,
  }
}

function Dashboard() {
  const navigate = useNavigate()
  const { user: telegramUser } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const summary = useDashboardStore((state) => state.summary)
  const cashMutations = useDashboardStore((state) => state.cashMutations)
  const dashboardError = useDashboardStore((state) => state.error)
  const dashboardLoading = useDashboardStore((state) => state.isLoading)
  const isRefreshing = useDashboardStore((state) => state.isRefreshing)
  const refreshDashboard = useDashboardStore((state) => state.refreshDashboard)
  const lastUpdatedAt = useDashboardStore((state) => state.lastUpdatedAt)
  const bills = useBillStore((state) => state.bills)
  const billsError = useBillStore((state) => state.error)
  const billsLoading = useBillStore((state) => state.isLoading)
  const fetchUnpaidBills = useBillStore((state) => state.fetchUnpaidBills)
  const softDeleteBill = useBillStore((state) => state.softDeleteBill)
  const loans = useIncomeStore((state) => state.loans)
  const loansError = useIncomeStore((state) => state.error)
  const isLoansLoading = useIncomeStore((state) => state.isLoadingLoans)
  const fetchLoans = useIncomeStore((state) => state.fetchLoans)
  const softDeleteProjectIncome = useIncomeStore((state) => state.softDeleteProjectIncome)
  const softDeleteLoan = useIncomeStore((state) => state.softDeleteLoan)
  const portfolioSummary = useReportStore((state) => state.portfolioSummary)
  const reportError = useReportStore((state) => state.error)
  const reportLoading = useReportStore((state) => state.isLoading)
  const fetchProjectSummaries = useReportStore((state) => state.fetchProjectSummaries)
  
  const [activeFilter, setActiveFilter] = useState('all')

  const userDisplayName = getUserDisplayName(telegramUser, authUser)
  const userInitials = useMemo(() => getUserInitials(userDisplayName), [userDisplayName])
  const todayKey = useMemo(() => getTodayKey(), [])
  const todayLabel = useMemo(() => formatDateLabel(new Date().toISOString()), [])

  const refreshAllData = useCallback(async () => {
    if (!currentTeamId) return
    await Promise.all([
      refreshDashboard(currentTeamId),
      fetchUnpaidBills({ teamId: currentTeamId }),
      fetchLoans({ teamId: currentTeamId }),
      fetchProjectSummaries({ force: true }),
    ])
  }, [currentTeamId, fetchLoans, fetchProjectSummaries, fetchUnpaidBills, refreshDashboard])

  useEffect(() => {
    void refreshAllData()
  }, [refreshAllData])

  const unifiedItems = useMemo(() => {
    const transactionItems = cashMutations.map(buildTransactionItem)
    const billItems = bills.map(buildBillItem)
    const loanItems = loans.filter((loan) => Number(loan.remaining_amount ?? 0) > 0).map(buildLoanItem)
    return [...transactionItems, ...billItems, ...loanItems].sort((left, right) => right.timestamp - left.timestamp)
  }, [bills, cashMutations, loans])

  const filteredItems = useMemo(() => {
    if (activeFilter === 'today') return unifiedItems.filter((item) => item.dateKey === todayKey)
    if (activeFilter === 'project') return unifiedItems.filter((item) => Boolean(item.projectLabel))
    return unifiedItems
  }, [activeFilter, todayKey, unifiedItems])

  const combinedError = useMemo(() => {
    return [dashboardError, billsError, loansError, reportError].filter((message, index, list) => Boolean(message) && list.indexOf(message) === index).join(' | ')
  }, [billsError, dashboardError, loansError, reportError])

  const pendingBillAmount = useMemo(() => {
    return bills.reduce((total, bill) => total + Number(bill.remainingAmount ?? 0), 0)
  }, [bills])

  const activeLoans = useMemo(() => {
    return loans.filter((loan) => Number(loan.remaining_amount ?? 0) > 0)
  }, [loans])

  const activeLoanAmount = useMemo(() => {
    return activeLoans.reduce((total, loan) => total + Number(loan.remaining_amount ?? 0), 0)
  }, [activeLoans])

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Hapus ${item.title}?`)) return
    try {
      if (item.sourceType === 'project-income') await softDeleteProjectIncome(item.id)
      else if (['loan', 'loan-disbursement'].includes(item.sourceType)) await softDeleteLoan(item.id)
      else if (item.sourceType === 'bill') await softDeleteBill(item.id)
      await refreshAllData()
    } catch (err) {
      console.error(err)
    }
  }

  const isLoading = Boolean(currentTeamId) && (dashboardLoading || billsLoading || isLoansLoading || reportLoading || isRefreshing)
  const currentProfit = portfolioSummary?.net_consolidated_profit ?? 0
  const cashBalance = summary?.endingBalance ?? 0
  const firstName = userDisplayName.split(' ')[0] || userDisplayName
  const profitLabel = currentProfit >= 0 ? 'Stabil' : 'Perlu perhatian'
  const profitToneClassName =
    currentProfit >= 0
      ? 'bg-[var(--app-tone-success-bg)] text-[var(--app-tone-success-text)]'
      : 'bg-[var(--app-tone-danger-bg)] text-[var(--app-tone-danger-text)]'
  const showDashboardSkeleton = isLoading && filteredItems.length === 0 && !combinedError
  const hasWorkspace = Boolean(currentTeamId)

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
          <span className="app-chip">Sinkron {formatSyncLabel(lastUpdatedAt)}</span>
          <span className="app-chip">{filteredItems.length} mutasi</span>
        </div>

        <div className="mt-4 space-y-3">
          <article
            className="relative overflow-hidden rounded-[28px] px-4 py-4 text-[var(--app-brand-accent-contrast)] shadow-[var(--app-card-shadow-strong)]"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--app-brand-accent) 84%, #002116), var(--app-brand-accent))',
            }}
          >
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
              Saldo Kas
            </p>
            <p className="mt-3 text-[1.85rem] font-bold leading-none tracking-[-0.05em]">
              {formatCurrencyCompact(cashBalance)}
            </p>
            <div className="mt-4 inline-flex items-center gap-1 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold text-white/80">
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
                {formatCurrencyCompact(currentProfit)}
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
                {activeLoanAmount > 0 ? formatCurrencyCompact(activeLoanAmount) : 'Rp 0'}
              </p>
              <p className="mt-4 text-xs text-[var(--app-hint-color)]">
                {activeLoans.length} pinjaman aktif
              </p>
            </article>
          </div>

          <article className="app-card px-4 py-3">
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
                  {pendingBillAmount > 0 ? formatCurrency(pendingBillAmount) : 'Rp 0'}
                </p>
              </div>
            </div>
          </article>
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
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-white/60 px-3 py-2 text-xs font-semibold text-[var(--app-tone-danger-text)] transition active:scale-[0.98]"
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
                className="app-card flex min-h-[106px] items-start gap-3 px-4 py-4 text-left transition active:scale-[0.985]"
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
                  <span className="mt-1 block text-xs leading-5 text-[var(--app-hint-color)]">
                    {action.description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="app-page-surface px-3 py-3">
        <div className="flex items-start justify-between gap-3 px-1">
          <div>
            <p className="app-kicker">Mutasi Terpadu</p>
            <h2 className="app-section-title">Aktivitas kas</h2>
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
        ) : showDashboardSkeleton ? (
          <div className="space-y-3 px-1 pt-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="app-card overflow-hidden px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 animate-pulse rounded-[18px] bg-[var(--app-surface-low-color)]" />
                  <div className="min-w-0 flex-1">
                    <div className="h-4 w-2/3 animate-pulse rounded-full bg-[var(--app-surface-low-color)]" />
                    <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-[var(--app-surface-low-color)]" />
                    <div className="mt-3 h-8 w-full animate-pulse rounded-[16px] bg-[var(--app-surface-low-color)]" />
                  </div>
                  <div className="h-4 w-20 animate-pulse rounded-full bg-[var(--app-surface-low-color)]" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <SmartList
            key={`${activeFilter}-${filteredItems.length}`}
            data={filteredItems}
            initialCount={12}
            loadMoreStep={12}
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
                subtitle={item.subtitle || 'Mutasi tercatat di workspace aktif'}
                amount={`${item.amount < 0 ? '-' : '+'}${formatCurrency(Math.abs(item.amount))}`}
                amountClassName={item.amountColorClass}
                badge={item.badge}
                badges={item.projectLabel ? [item.projectLabel] : []}
                details={[
                  item.kind === 'bill' ? 'Tagihan' : item.kind === 'loan' ? 'Pinjaman' : 'Mutasi',
                  item.sourceType,
                ]}
                leadingIcon={
                  <div className={`flex h-11 w-11 items-center justify-center rounded-[18px] ${item.iconColorClass}`}>
                    <item.Icon className="h-5 w-5" />
                  </div>
                }
                actions={[
                  {
                    id: 'detail',
                    label: 'Detail',
                    icon: <ChevronRight className="h-3.5 w-3.5" />,
                    onClick: () => navigate('/transactions'),
                  },
                  ...(item.editable
                    ? [
                        {
                          id: 'edit',
                          label: 'Edit',
                          icon: <Pencil className="h-3.5 w-3.5" />,
                          onClick: () => navigate(`/edit/${item.editType}/${item.id}`, { state: { item: item.raw } }),
                        },
                      ]
                    : []),
                  ...(item.payable
                    ? [
                        {
                          id: 'pay',
                          label: 'Bayar',
                          icon: <Landmark className="h-3.5 w-3.5" />,
                          onClick: () => navigate(item.sourceType === 'loan' ? `/loan-payment/${item.id}` : `/payment/${item.id}`, { state: { item: item.raw } }),
                        },
                      ]
                    : []),
                  ...(item.deletable
                    ? [
                        {
                          id: 'delete',
                          label: 'Hapus',
                          icon: <Trash2 className="h-3.5 w-3.5" />,
                          destructive: true,
                          onClick: () => handleDeleteItem(item),
                        },
                      ]
                    : []),
                ]}
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
