import { useCallback, useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, RotateCcw } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AppButton,
  AppCard,
  AppCardDashed,
  AppCardStrong,
  PageShell,
  PageHeader,
} from '../components/ui/AppPrimitives'
import BrandLoader from '../components/ui/BrandLoader'
import { formatAppDateLabel } from '../lib/date-time'
import {
  formatCurrency,
  formatTransactionDateTime,
  getTransactionSourceLabel,
  getTransactionTitle,
  getTransactionTypeLabel,
} from '../lib/transaction-presentation'
import { markRecycleBinListStateNeedsRefresh } from '../lib/recycle-bin-state'
import {
  fetchDeletedCashMutationByIdFromApi,
  permanentDeleteTransactionFromApi,
  restoreTransactionFromApi,
} from '../lib/transactions-api'
import useAuthStore from '../store/useAuthStore'
import useDashboardStore from '../store/useDashboardStore'

function getTransactionPresentation(transaction) {
  if (transaction?.type === 'expense') {
    return {
      Icon: ArrowUpRight,
      amountClassName: 'text-[var(--app-destructive-color)]',
      amountPrefix: '-',
    }
  }

  return {
    Icon: ArrowDownLeft,
    amountClassName: 'text-[var(--app-success-color)]',
    amountPrefix: '+',
  }
}

function canPermanentlyDeleteTransaction(transaction) {
  return transaction?.canPermanentDelete === true
}

function DeletedTransactionDetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { transactionId } = useParams()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const refreshDashboard = useDashboardStore((state) => state.refreshDashboard)
  const initialTransaction = location.state?.transaction ?? null
  const [transaction, setTransaction] = useState(initialTransaction)
  const [isLoadingRecord, setIsLoadingRecord] = useState(false)
  const [recordError, setRecordError] = useState(null)
  const backRoute = '/transactions/recycle-bin'

  const loadDeletedTransaction = useCallback(async (teamId, id) => {
    if (!teamId) {
      setTransaction(null)
      setRecordError('Workspace aktif belum tersedia.')
      setIsLoadingRecord(false)
      return null
    }

    setIsLoadingRecord(true)
    setRecordError(null)

    try {
      const nextTransaction = await fetchDeletedCashMutationByIdFromApi(teamId, id)

      if (!nextTransaction) {
        setTransaction(null)
        setRecordError('Transaksi terhapus tidak ditemukan.')
        setIsLoadingRecord(false)
        return null
      }

      setTransaction(nextTransaction)
      setIsLoadingRecord(false)
      return nextTransaction
    } catch (error) {
      setTransaction(null)
      setRecordError(
        error instanceof Error ? error.message : 'Gagal memuat detail Halaman Sampah.'
      )
      setIsLoadingRecord(false)
      throw error
    }
  }, [])

  useEffect(() => {
    const cachedTransaction =
      initialTransaction?.id === transactionId ? initialTransaction : null

    const timeoutId = window.setTimeout(() => {
      if (cachedTransaction) {
        setTransaction(cachedTransaction)
        setRecordError(null)
        setIsLoadingRecord(false)
        return
      }

      void loadDeletedTransaction(currentTeamId, transactionId).catch((loadError) => {
        console.error('Gagal memuat detail Halaman Sampah transaksi:', loadError)
      })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [currentTeamId, initialTransaction, loadDeletedTransaction, transactionId])

  const handleRestore = async () => {
    if (!currentTeamId || !transaction?.id || !transaction?.sourceType) {
      return
    }

    try {
      setRecordError(null)

      await restoreTransactionFromApi(
        transaction.sourceType === 'loan-disbursement' ? 'loan' : transaction.sourceType,
        transaction.id,
        currentTeamId,
        transaction.updated_at ?? transaction.updatedAt ?? null
      )

      await refreshDashboard(currentTeamId, { silent: true })
      markRecycleBinListStateNeedsRefresh(currentTeamId)
      navigate('/transactions/recycle-bin', { replace: true })
    } catch (error) {
      setRecordError(
        error instanceof Error ? error.message : 'Gagal memulihkan transaksi.'
      )
    }
  }

  const handlePermanentDelete = async () => {
    if (!currentTeamId || !transaction?.id || !transaction?.sourceType || !canPermanentDelete) {
      return
    }

    const shouldDelete = window.confirm(
      `Hapus permanen ${getTransactionTitle(transaction)}? Aksi ini tidak bisa dibatalkan.`
    )

    if (!shouldDelete) {
      return
    }

    try {
      setRecordError(null)

      await permanentDeleteTransactionFromApi(
        transaction.sourceType === 'loan-disbursement'
          ? 'loan'
          : transaction.sourceType,
        transaction.id,
        currentTeamId
      )

      await refreshDashboard(currentTeamId, { silent: true })
      markRecycleBinListStateNeedsRefresh(currentTeamId)
      navigate('/transactions/recycle-bin', { replace: true })
    } catch (error) {
      setRecordError(
        error instanceof Error ? error.message : 'Gagal menghapus permanen transaksi.'
      )
    }
  }

  if (!transaction && isLoadingRecord) {
    return (
      <PageShell className="space-y-4">
        <PageHeader
          eyebrow="Halaman Sampah"
          title="Detail Halaman Sampah"
          action={
            <AppButton
              onClick={() => navigate(backRoute)}
              size="sm"
              type="button"
              variant="secondary"
              leadingIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Kembali
            </AppButton>
          }
        />
        <section className="grid min-h-[calc(100dvh-16rem)] place-items-center px-4 text-center">
          <div className="flex flex-col items-center gap-5">
            <BrandLoader context="server" size="hero" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--app-text-color)]">
                Memuat detail transaksi terhapus
              </h2>
              <p className="max-w-[20rem] text-sm leading-6 text-[var(--app-hint-color)]">
                Menyiapkan data arsip yang dipilih.
              </p>
            </div>
          </div>
        </section>
      </PageShell>
    )
  }

  if (!transaction) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="Halaman Sampah"
          title="Detail Halaman Sampah"
          action={
            <AppButton
              onClick={() => navigate(backRoute)}
              size="sm"
              type="button"
              variant="secondary"
              leadingIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Kembali
            </AppButton>
          }
        />
        <AppCardDashed className="px-4 py-5">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Data transaksi terhapus belum tersedia.
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
            {recordError ?? 'Buka ulang dari Halaman Sampah untuk memuat data terbaru.'}
          </p>
        </AppCardDashed>
      </PageShell>
    )
  }

  const presentation = getTransactionPresentation(transaction)
  const { Icon } = presentation
  const canPermanentDelete = canPermanentlyDeleteTransaction(transaction)

  return (
    <PageShell>
      <PageHeader
        eyebrow="Halaman Sampah"
        title="Detail Halaman Sampah"
        action={
          <AppButton
            onClick={() => navigate(backRoute)}
            size="sm"
            type="button"
            variant="secondary"
            leadingIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Kembali
          </AppButton>
        }
      />

      {recordError ? (
        <AppCardDashed>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
            Restore Gagal
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">{recordError}</p>
        </AppCardDashed>
      ) : null}

      <AppCardStrong className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)]">
            <Icon className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
              {getTransactionTitle(transaction)}
            </p>
            <p className="mt-1 text-sm leading-6 text-[var(--app-hint-color)]">
              {getTransactionSourceLabel(transaction)}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
            Nominal
          </p>
          <p
            className={`mt-2 text-2xl font-bold tracking-[-0.04em] ${presentation.amountClassName}`}
          >
            {presentation.amountPrefix}
            {formatCurrency(Math.abs(Number(transaction.amount ?? 0)))}
          </p>
        </div>
      </AppCardStrong>

      <div className="grid gap-3 sm:grid-cols-2">
        <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
          <p className="app-meta">Dihapus Pada</p>
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            {formatTransactionDateTime(transaction.deleted_at || transaction.updated_at)}
          </p>
        </AppCard>
        <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
          <p className="app-meta">Tanggal Transaksi</p>
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            {formatAppDateLabel(transaction.transaction_date ?? transaction.created_at)}
          </p>
        </AppCard>
        <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
          <p className="app-meta">Jenis</p>
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            {getTransactionTypeLabel(transaction)}
          </p>
        </AppCard>
        <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
          <p className="app-meta">Sumber</p>
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            {getTransactionSourceLabel(transaction)}
          </p>
        </AppCard>
        <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)] sm:col-span-2">
          <p className="app-meta">ID</p>
          <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
            {transaction.id}
          </p>
        </AppCard>
      </div>

      <AppCard className="space-y-2 bg-[var(--app-surface-strong-color)]">
        <p className="app-meta">Keterangan</p>
        <p className="text-sm leading-6 text-[var(--app-text-color)]">
          {getTransactionTitle(transaction)}
        </p>
      </AppCard>

      <AppButton
        onClick={handleRestore}
        type="button"
        variant="secondary"
        leadingIcon={<RotateCcw className="h-4 w-4" />}
      >
        Restore
      </AppButton>

      {canPermanentDelete ? (
        <AppButton onClick={handlePermanentDelete} type="button" variant="danger">
          Hapus Permanen
        </AppButton>
      ) : null}
    </PageShell>
  )
}

export default DeletedTransactionDetailPage
