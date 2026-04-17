import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionCard from '../components/ui/ActionCard'
import SmartList from '../components/ui/SmartList'
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCardDashed,
  AppCardStrong,
  AppEmptyState,
  AppSheet,
  PageHeader,
} from '../components/ui/AppPrimitives'
import useAuthStore from '../store/useAuthStore'
import useDashboardStore from '../store/useDashboardStore'
import useIncomeStore from '../store/useIncomeStore'

const filters = [
  { value: 'all', label: 'Semua' },
  { value: 'income', label: 'Uang Masuk' },
  { value: 'expense', label: 'Uang Keluar' },
]

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

const syncFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
})

function formatCurrency(value) {
  return currencyFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0)
}

function formatSyncLabel(value) {
  const parsedDate = new Date(String(value ?? ''))

  if (Number.isNaN(parsedDate.getTime())) {
    return 'belum ada'
  }

  return syncFormatter.format(parsedDate)
}

function formatTimeLabel(value) {
  const parsedDate = new Date(String(value ?? ''))

  if (Number.isNaN(parsedDate.getTime())) {
    return 'waktu belum tersedia'
  }

  return timeFormatter.format(parsedDate)
}

function getTodayKey() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function toDateKey(value) {
  const parsedDate = new Date(String(value ?? ''))

  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`
}

function getSectionLabel(dateKey, referenceTodayKey) {
  if (!dateKey) {
    return 'Tanpa Tanggal'
  }

  if (dateKey === referenceTodayKey) {
    return 'Hari Ini'
  }

  const today = new Date(referenceTodayKey)

  if (!Number.isNaN(today.getTime())) {
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

    if (dateKey === yesterdayKey) {
      return 'Kemarin'
    }
  }

  const parsedDate = new Date(dateKey)

  if (Number.isNaN(parsedDate.getTime())) {
    return dateKey
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate)
}

function getBadgeLabel(transaction) {
  if (transaction.sourceType === 'project-income') {
    return 'Termin Proyek'
  }

  if (transaction.sourceType === 'loan-disbursement') {
    return 'Pinjaman Masuk'
  }

  if (transaction.sourceType === 'loan-payment') {
    return 'Bayar Pinjaman'
  }

  return 'Bayar Tagihan'
}

function getSourceLabel(transaction) {
  if (transaction.sourceType === 'project-income') {
    return transaction.project_name || 'Proyek'
  }

  if (transaction.sourceType === 'loan-disbursement') {
    return transaction.party_label || 'Kreditor'
  }

  if (transaction.sourceType === 'loan-payment') {
    return transaction.party_label || 'Pembayaran pinjaman'
  }

  return transaction.party_label || transaction.project_name || 'Pembayaran'
}

function getTransactionPresentation(transaction) {
  if (transaction.type === 'expense') {
    return {
      Icon: ArrowUpRight,
      tone: 'warning',
      iconClassName: 'app-tone-warning',
      amountClassName: 'text-[var(--app-destructive-color)]',
    }
  }

  return {
    Icon: ArrowDownLeft,
    tone: 'success',
    iconClassName: 'app-tone-success',
    amountClassName: 'text-[var(--app-success-color)]',
  }
}

function getTransactionEditRoute(transaction) {
  if (transaction.sourceType === 'project-income') {
    return `/edit/project-income/${transaction.id}`
  }

  if (transaction.sourceType === 'loan-disbursement') {
    return `/edit/loan/${transaction.id}`
  }

  return null
}

function canDeleteTransaction(transaction) {
  return ['project-income', 'loan-disbursement'].includes(transaction.sourceType)
}

function canEditTransaction(transaction) {
  return Boolean(getTransactionEditRoute(transaction))
}

function TransactionsPage() {
  const navigate = useNavigate()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const summary = useDashboardStore((state) => state.summary)
  const cashMutations = useDashboardStore((state) => state.cashMutations)
  const error = useDashboardStore((state) => state.error)
  const isLoading = useDashboardStore((state) => state.isLoading)
  const isRefreshing = useDashboardStore((state) => state.isRefreshing)
  const lastUpdatedAt = useDashboardStore((state) => state.lastUpdatedAt)
  const refreshDashboard = useDashboardStore((state) => state.refreshDashboard)
  const softDeleteProjectIncome = useIncomeStore((state) => state.softDeleteProjectIncome)
  const softDeleteLoan = useIncomeStore((state) => state.softDeleteLoan)
  const clearIncomeError = useIncomeStore((state) => state.clearError)
  const [filter, setFilter] = useState('all')
  const [selectedTransaction, setSelectedTransaction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const todayKey = useMemo(() => getTodayKey(), [])

  useEffect(() => {
    if (!currentTeamId) {
      return
    }

    void refreshDashboard(currentTeamId, { silent: true }).catch((dashboardError) => {
      console.error('Gagal memuat transaksi:', dashboardError)
    })
  }, [currentTeamId, refreshDashboard])

  useEffect(() => () => clearIncomeError(), [clearIncomeError])

  const filteredTransactions = useMemo(() => {
    if (filter === 'income') {
      return cashMutations.filter((transaction) => transaction.type !== 'expense')
    }

    if (filter === 'expense') {
      return cashMutations.filter((transaction) => transaction.type === 'expense')
    }

    return cashMutations
  }, [cashMutations, filter])

  const groupedTransactions = useMemo(() => {
    return filteredTransactions.reduce((groups, transaction) => {
      const dateKey = toDateKey(transaction.transaction_date || transaction.created_at)
      const sectionKey = dateKey || 'unknown'
      const existingGroup = groups.find((group) => group.key === sectionKey)

      if (existingGroup) {
        existingGroup.items.push(transaction)
        return groups
      }

      groups.push({
        key: sectionKey,
        label: getSectionLabel(dateKey, todayKey),
        items: [transaction],
      })

      return groups
    }, [])
  }, [filteredTransactions, todayKey])

  const transactionSummary = useMemo(() => {
    return filteredTransactions.reduce(
      (accumulator, transaction) => {
        const amount = Number(transaction.amount ?? 0)

        if (transaction.type === 'expense') {
          accumulator.expense += amount
        } else {
          accumulator.income += amount
        }

        return accumulator
      },
      { income: 0, expense: 0 }
    )
  }, [filteredTransactions])

  const showSkeleton = Boolean(currentTeamId) && isLoading && filteredTransactions.length === 0 && !error

  const handleOpenDetail = (transaction) => {
    setActionError(null)
    setSelectedTransaction(transaction)
  }

  const handleEditTransaction = (transaction) => {
    const editRoute = getTransactionEditRoute(transaction)

    if (!editRoute) {
      return
    }

    setSelectedTransaction(null)
    navigate(editRoute, { state: { item: transaction } })
  }

  const handleDeleteTransaction = async (transaction) => {
    if (!canDeleteTransaction(transaction)) {
      return
    }

    const shouldDelete = window.confirm(
      `Hapus ${transaction.description || getBadgeLabel(transaction)}?`
    )

    if (!shouldDelete) {
      return
    }

    try {
      setActionError(null)

      if (transaction.sourceType === 'project-income') {
        await softDeleteProjectIncome(transaction.id)
      } else if (transaction.sourceType === 'loan-disbursement') {
        await softDeleteLoan(transaction.id)
      }

      setSelectedTransaction(null)

      if (currentTeamId) {
        await refreshDashboard(currentTeamId, { silent: true })
      }
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Gagal menghapus mutasi.'

      setActionError(message)
    }
  }

  return (
    <section className="space-y-4 px-2 py-2">
      <PageHeader
        eyebrow="Riwayat"
        title="Transaksi"
      />

      <section className="space-y-3">
        <AppCardStrong className="px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
            Total Balance
          </p>
          <p className="mt-3 text-[1.75rem] font-bold tracking-[-0.045em] text-[var(--app-brand-accent)]">
            {formatCurrency(summary?.endingBalance ?? 0)}
          </p>
          <p className="mt-2 text-xs text-[var(--app-hint-color)]">
            Sinkron {formatSyncLabel(lastUpdatedAt)}{isRefreshing ? ' • memperbarui' : ''}
          </p>
        </AppCardStrong>

        <AppCardStrong className="px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
            Uang Masuk
          </p>
          <p className="mt-3 text-lg font-bold tracking-[-0.03em] text-[var(--app-success-color)]">
            {formatCurrency(transactionSummary.income)}
          </p>
        </AppCardStrong>

        <AppCardStrong className="px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
            Uang Keluar
          </p>
          <p className="mt-3 text-lg font-bold tracking-[-0.03em] text-[var(--app-destructive-color)]">
            {formatCurrency(transactionSummary.expense)}
          </p>
        </AppCardStrong>
      </section>

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <AppButton
            key={item.value}
            className="rounded-full"
            onClick={() => setFilter(item.value)}
            size="sm"
            type="button"
            variant={filter === item.value ? 'primary' : 'secondary'}
          >
            {item.label}
          </AppButton>
        ))}
      </div>

      {error ? (
        <AppCardDashed className="px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
            Gagal Memuat Transaksi
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">{error}</p>
        </AppCardDashed>
      ) : null}

      {actionError ? (
        <AppCardDashed className="px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
            Aksi Mutasi Gagal
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">{actionError}</p>
        </AppCardDashed>
      ) : null}

      {!currentTeamId ? (
        <AppCardDashed className="px-4 py-5">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Team aktif belum tersedia.
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
            Login ulang atau pilih workspace yang benar agar mutasi bisa dimuat.
          </p>
        </AppCardDashed>
      ) : showSkeleton ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <AppCardStrong key={item} className="px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--app-surface-low-color)]" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-2/3 animate-pulse rounded-full bg-[var(--app-surface-low-color)]" />
                  <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-[var(--app-surface-low-color)]" />
                </div>
              </div>
            </AppCardStrong>
          ))}
        </div>
      ) : (
        <SmartList
          key={`${filter}-${groupedTransactions.length}`}
          data={groupedTransactions}
          as="div"
          className="space-y-5"
          initialCount={10}
          loadMoreStep={5}
          loadMoreLabel="Muat Hari Berikutnya"
          renderItem={(group) => (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                  {group.label}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                  {group.items.length} item
                </p>
              </div>

              <div className="space-y-3">
                {group.items.map((transaction) => {
                  const presentation = getTransactionPresentation(transaction)
                  const Icon = presentation.Icon
                  const amount = Math.abs(Number(transaction.amount ?? 0))

                  return (
                    <AppCardStrong key={transaction.id} className="px-4 py-4">
                      <ActionCard
                        title={transaction.description || 'Mutasi kas tanpa deskripsi'}
                        subtitle={`${getSourceLabel(transaction)} · ${formatTimeLabel(transaction.transaction_date || transaction.created_at)}`}
                        amount={`${transaction.type === 'expense' ? '-' : '+'}${formatCurrency(amount)}`}
                        amountClassName={presentation.amountClassName}
                        badge={getBadgeLabel(transaction)}
                        badges={[getSourceLabel(transaction)]}
                        details={[
                          transaction.type === 'expense' ? 'Pengeluaran' : 'Pemasukan',
                          transaction.project_name || transaction.party_label || 'Sumber mutasi kas',
                        ]}
                        className="border-b-0 p-0"
                        leadingIcon={
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-full ${presentation.iconClassName}`}
                          >
                            <Icon className="h-[18px] w-[18px]" />
                          </div>
                        }
                        actions={[
                          {
                            id: 'detail',
                            label: 'Detail',
                            icon: <Eye className="h-3.5 w-3.5" />,
                            onClick: () => handleOpenDetail(transaction),
                          },
                          ...(canEditTransaction(transaction)
                            ? [
                                {
                                  id: 'edit',
                                  label: 'Edit',
                                  icon: <Pencil className="h-3.5 w-3.5" />,
                                  onClick: () => handleEditTransaction(transaction),
                                },
                              ]
                            : []),
                          ...(canDeleteTransaction(transaction)
                            ? [
                                {
                                  id: 'delete',
                                  label: 'Hapus',
                                  icon: <Trash2 className="h-3.5 w-3.5" />,
                                  destructive: true,
                                  onClick: () => handleDeleteTransaction(transaction),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </AppCardStrong>
                  )
                })}
              </div>
            </section>
          )}
          emptyState={
            <AppEmptyState
              className="px-4 py-5"
              title="Belum Ada Catatan"
              description="Catatan kas akan muncul di sini setelah transaksi pertama tersimpan untuk workspace ini."
            />
          }
        />
      )}

      <AppSheet
        open={Boolean(selectedTransaction)}
        onClose={() => setSelectedTransaction(null)}
        title="Detail Mutasi"
        description={selectedTransaction ? getBadgeLabel(selectedTransaction) : null}
        footer={
          selectedTransaction && canDeleteTransaction(selectedTransaction) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {canEditTransaction(selectedTransaction) ? (
                <AppButton
                  onClick={() => handleEditTransaction(selectedTransaction)}
                  type="button"
                  variant="secondary"
                >
                  Edit
                </AppButton>
              ) : null}
              <AppButton
                onClick={() => handleDeleteTransaction(selectedTransaction)}
                type="button"
                variant="danger"
              >
                Hapus
              </AppButton>
            </div>
          ) : null
        }
      >
        {selectedTransaction ? (
          <div className="space-y-4">
            <AppCardStrong className="space-y-3 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <AppBadge tone={selectedTransaction.type === 'expense' ? 'warning' : 'success'}>
                    {selectedTransaction.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                  </AppBadge>
                  <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                    {selectedTransaction.description || getBadgeLabel(selectedTransaction)}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--app-hint-color)]">
                    {getSourceLabel(selectedTransaction)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    Nominal
                  </p>
                  <p
                    className={`mt-2 text-xl font-bold tracking-[-0.04em] ${
                      selectedTransaction.type === 'expense'
                        ? 'text-[var(--app-destructive-color)]'
                        : 'text-[var(--app-success-color)]'
                    }`}
                  >
                    {selectedTransaction.type === 'expense' ? '-' : '+'}
                    {formatCurrency(Math.abs(Number(selectedTransaction.amount ?? 0)))}
                  </p>
                </div>
              </div>
            </AppCardStrong>

            <div className="grid gap-3 sm:grid-cols-2">
              <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
                <p className="app-meta">Tanggal</p>
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  {selectedTransaction.transaction_date || '-'}
                </p>
              </AppCard>
              <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
                <p className="app-meta">Sumber</p>
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  {getSourceLabel(selectedTransaction)}
                </p>
              </AppCard>
              <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
                <p className="app-meta">Mutasi</p>
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  {getBadgeLabel(selectedTransaction)}
                </p>
              </AppCard>
              <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
                <p className="app-meta">ID</p>
                <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                  {selectedTransaction.id}
                </p>
              </AppCard>
            </div>

            <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
              <p className="app-meta">Keterangan</p>
              <p className="text-sm leading-6 text-[var(--app-text-color)]">
                {selectedTransaction.project_name ||
                  selectedTransaction.party_label ||
                  selectedTransaction.description ||
                  '-'}
              </p>
            </AppCard>
          </div>
        ) : null}
      </AppSheet>
    </section>
  )
}

export default TransactionsPage
