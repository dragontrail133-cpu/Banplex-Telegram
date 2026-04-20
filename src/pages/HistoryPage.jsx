import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, ArrowLeft, Clock3, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  AppButton,
  AppCardDashed,
  AppCardStrong,
  AppEmptyState,
  AppInput,
  PageShell,
  PageHeader,
} from '../components/ui/AppPrimitives'
import {
  formatCurrency,
  formatTransactionDateTime,
  getTransactionCreatorLabel,
  getTransactionLedgerFilterOptions,
  getTransactionLedgerSummary,
  getTransactionTitle,
} from '../lib/transaction-presentation'
import { logPerf, nowMs, roundMs } from '../lib/timing'
import { fetchHistoryTransactionPageFromApi } from '../lib/transactions-api'
import useAuthStore from '../store/useAuthStore'

const filters = getTransactionLedgerFilterOptions()
const historyPageSize = 20
const historyListStateStorageKey = 'banplex:history-list-state'
const historyPerfEnabled = import.meta.env.DEV

function readHistoryListState(teamId) {
  if (!teamId || typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.sessionStorage.getItem(historyListStateStorageKey)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (parsedValue?.teamId !== teamId) {
      return null
    }

    return parsedValue
  } catch (error) {
    console.error('Gagal membaca state Riwayat:', error)
    return null
  }
}

function saveHistoryListState(teamId, state) {
  if (!teamId || typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(
      historyListStateStorageKey,
      JSON.stringify({
        teamId,
        ...state,
      })
    )
  } catch (error) {
    console.error('Gagal menyimpan state Riwayat:', error)
  }
}

function getTransactionPresentation(transaction) {
  if (transaction?.type === 'expense') {
    return {
      Icon: ArrowUpRight,
      iconClassName: 'app-tone-warning',
      amountClassName: 'text-[var(--app-destructive-color)]',
    }
  }

  return {
    Icon: ArrowDownLeft,
    iconClassName: 'app-tone-success',
    amountClassName: 'text-[var(--app-success-color)]',
  }
}

function HistoryPage() {
  const navigate = useNavigate()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const restoredHistoryState = useMemo(
    () => readHistoryListState(currentTeamId),
    [currentTeamId]
  )
  const shouldSkipInitialLoadRef = useRef(
    Boolean(restoredHistoryState?.hasLoaded ?? restoredHistoryState?.transactions?.length > 0)
  )
  const savedScrollPositionRef = useRef(Number(restoredHistoryState?.scrollY ?? 0))
  const historyMountedAtRef = useRef(nowMs())
  const historyFirstUsableLoggedRef = useRef(false)
  const [filter, setFilter] = useState(restoredHistoryState?.filter ?? 'all')
  const [searchTerm, setSearchTerm] = useState(restoredHistoryState?.searchTerm ?? '')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(
    restoredHistoryState?.debouncedSearchTerm ?? restoredHistoryState?.searchTerm ?? ''
  )
  const [transactions, setTransactions] = useState(restoredHistoryState?.transactions ?? [])
  const [pageInfo, setPageInfo] = useState(
    restoredHistoryState?.pageInfo ?? {
      hasMore: false,
      nextCursor: null,
      totalCount: 0,
    }
  )
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [hasLoadedHistory, setHasLoadedHistory] = useState(
    Boolean(restoredHistoryState?.hasLoaded)
  )
  const requestSequenceRef = useRef(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    historyMountedAtRef.current = nowMs()
    historyFirstUsableLoggedRef.current = false
  }, [currentTeamId])

  useEffect(() => {
    if (!historyPerfEnabled || historyFirstUsableLoggedRef.current) {
      return
    }

    if (!currentTeamId || isLoadingTransactions || historyError || transactions.length === 0) {
      return
    }

    historyFirstUsableLoggedRef.current = true
    logPerf(
      'Riwayat first usable list',
      {
        mountMs: roundMs(nowMs() - historyMountedAtRef.current),
        itemCount: transactions.length,
        hasMore: pageInfo.hasMore,
      },
      historyPerfEnabled
    )
  }, [
    currentTeamId,
    historyError,
    isLoadingTransactions,
    pageInfo.hasMore,
    transactions.length,
  ])

  const loadHistoryPage = useCallback(
    async ({ cursor = null, append = false } = {}) => {
      const requestId = ++requestSequenceRef.current
      const requestStartedAt = nowMs()

      if (!currentTeamId) {
        if (!append) {
          setTransactions([])
          setPageInfo({
            hasMore: false,
            nextCursor: null,
            totalCount: 0,
          })
          setHasLoadedHistory(false)
        }

        setHistoryError(null)
        return
      }

      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoadingTransactions(true)
        setHasLoadedHistory(false)
      }

      try {
        const result = await fetchHistoryTransactionPageFromApi(currentTeamId, {
          cursor,
          limit: historyPageSize,
          search: debouncedSearchTerm,
          filter,
        })

        if (requestId !== requestSequenceRef.current) {
          return
        }

        const nextTransactions = result.historyTransactions ?? []

        setTransactions((currentTransactions) =>
          append ? [...currentTransactions, ...nextTransactions] : nextTransactions
        )
        setPageInfo(
          result.pageInfo ?? {
            hasMore: false,
            nextCursor: null,
            totalCount: 0,
          }
        )
        setHasLoadedHistory(true)
        setHistoryError(null)

        if (historyPerfEnabled && !append) {
          logPerf(
            'Riwayat first-page fetch',
            {
              fetchMs: roundMs(nowMs() - requestStartedAt),
              serverTiming: result.timing ?? null,
              itemCount: nextTransactions.length,
              hasMore: result.pageInfo?.hasMore ?? false,
            },
            historyPerfEnabled
          )
        }
      } catch (error) {
        if (requestId !== requestSequenceRef.current) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Gagal memuat riwayat transaksi.'

        setHistoryError(message)

        if (!append) {
          setTransactions([])
          setPageInfo({
            hasMore: false,
            nextCursor: null,
            totalCount: 0,
          })
        }
      } finally {
        if (requestId === requestSequenceRef.current) {
          setIsLoadingTransactions(false)
          setIsLoadingMore(false)
        }
      }
    },
    [currentTeamId, debouncedSearchTerm, filter]
  )

  useEffect(() => {
    if (shouldSkipInitialLoadRef.current) {
      shouldSkipInitialLoadRef.current = false
      return
    }

    setHistoryError(null)
    setTransactions([])
    setPageInfo({
      hasMore: false,
      nextCursor: null,
      totalCount: 0,
    })
    void loadHistoryPage({ cursor: null, append: false })
  }, [filter, loadHistoryPage])

  useEffect(() => {
    if (!currentTeamId) {
      return
    }

    saveHistoryListState(currentTeamId, {
      filter,
      searchTerm,
      debouncedSearchTerm,
      transactions,
      pageInfo,
      hasLoaded: hasLoadedHistory,
      scrollY: savedScrollPositionRef.current,
    })
  }, [
    currentTeamId,
    debouncedSearchTerm,
    filter,
    hasLoadedHistory,
    pageInfo,
    searchTerm,
    transactions,
  ])

  useEffect(() => {
    if (
      !(
        restoredHistoryState?.hasLoaded ??
        restoredHistoryState?.transactions?.length > 0
      ) ||
      typeof window === 'undefined'
    ) {
      return
    }

    const scrollY = Number(restoredHistoryState.scrollY ?? 0)

    if (!Number.isFinite(scrollY) || scrollY <= 0) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'auto' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [restoredHistoryState])

  const showSkeleton =
    Boolean(currentTeamId) &&
    isLoadingTransactions &&
    transactions.length === 0 &&
    !historyError

  const handleOpenDetail = (transaction) => {
    savedScrollPositionRef.current = window.scrollY
    saveHistoryListState(currentTeamId, {
      filter,
      searchTerm,
      debouncedSearchTerm,
      transactions,
      pageInfo,
      hasLoaded: hasLoadedHistory,
      scrollY: savedScrollPositionRef.current,
    })

    navigate(`/transactions/${transaction.id}?surface=riwayat`, {
      state: {
        transaction,
        detailSurface: 'riwayat',
      },
    })
  }

  const handleLoadMore = () => {
    if (!pageInfo.hasMore || !pageInfo.nextCursor) {
      return
    }

    void loadHistoryPage({
      cursor: pageInfo.nextCursor,
      append: true,
    })
  }

  return (
    <PageShell>
      <PageHeader
        title="Riwayat"
        action={
          <div className="flex items-center gap-2">
            <AppButton
              onClick={() => navigate('/transactions')}
              size="sm"
              type="button"
              variant="secondary"
              iconOnly
              aria-label="Buka Jurnal"
              leadingIcon={<ArrowLeft className="h-4 w-4" />}
            >
              <span className="sr-only">Jurnal</span>
            </AppButton>
            <AppButton
              onClick={() => navigate('/transactions/recycle-bin')}
              size="sm"
              type="button"
              variant="secondary"
              iconOnly
              aria-label="Buka Halaman Sampah"
              leadingIcon={<Trash2 className="h-4 w-4" />}
            >
              <span className="sr-only">Halaman Sampah</span>
            </AppButton>
          </div>
        }
      />

      <div className="space-y-3">
        <AppInput
          aria-label="Cari riwayat transaksi"
          className="w-full"
          onChange={(event) => setSearchTerm(event.target.value)}
          type="search"
          value={searchTerm}
        />
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
      </div>

      {historyError ? (
        <AppCardDashed>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
            Gagal Memuat Riwayat
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">{historyError}</p>
          <div className="mt-4">
            <AppButton
              onClick={() => void loadHistoryPage({ cursor: null, append: false })}
              type="button"
              variant="secondary"
            >
              Coba Lagi
            </AppButton>
          </div>
        </AppCardDashed>
      ) : null}

      {!currentTeamId ? (
        <AppCardDashed className="px-4 py-5">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Team aktif belum tersedia.
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
            Login ulang atau pilih workspace yang benar agar riwayat bisa dimuat.
          </p>
        </AppCardDashed>
      ) : showSkeleton ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <AppCardStrong key={item}>
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
      ) : transactions.length === 0 ? (
        <AppEmptyState className="px-4 py-5" title="Belum Ada Riwayat" icon={<Clock3 className="h-5 w-5" />} />
      ) : (
        <div className="space-y-3">
          <p className="px-1 text-xs text-[var(--app-hint-color)]">{transactions.length} item</p>

          {transactions.map((transaction) => {
            const presentation = getTransactionPresentation(transaction)
            const Icon = presentation.Icon
            const amount = Math.abs(Number(transaction.amount ?? 0))
            const hasCreatorIdentity = Boolean(
              transaction?.created_by_user_id ??
                transaction?.createdByUserId ??
                transaction?.telegram_user_id ??
                transaction?.telegramUserId
            )
            const creatorLabel = hasCreatorIdentity ? getTransactionCreatorLabel(transaction) : null
            const ledgerSummary = getTransactionLedgerSummary(transaction)

            return (
              <AppCardStrong key={`${transaction.sourceType ?? 'transaction'}-${transaction.id}`}>
                <button
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => handleOpenDetail(transaction)}
                  type="button"
                >
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${presentation.iconClassName}`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                      {getTransactionTitle(transaction)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--app-hint-color)]">
                      {formatTransactionDateTime(
                        transaction.transaction_date ||
                          transaction.expense_date ||
                          transaction.created_at
                      )}
                    </p>
                    {ledgerSummary ? (
                      <p className="mt-1 truncate text-[11px] font-medium text-[var(--app-hint-color)]">
                        {ledgerSummary}
                      </p>
                    ) : null}
                    {creatorLabel ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-2.5 py-1 text-[11px] font-medium text-[var(--app-hint-color)]">
                          {creatorLabel}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${presentation.amountClassName}`}>
                    {Number(transaction.amount ?? 0) < 0 || transaction.type === 'expense'
                      ? '-'
                      : '+'}
                    {formatCurrency(amount)}
                  </span>
                </button>
              </AppCardStrong>
            )
          })}

          {pageInfo.hasMore ? (
            <div className="flex justify-center pt-1">
              <AppButton
                onClick={handleLoadMore}
                type="button"
                variant="secondary"
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Memuat...' : 'Muat Berikutnya'}
              </AppButton>
            </div>
          ) : null}
        </div>
      )}
    </PageShell>
  )
}

export default HistoryPage
