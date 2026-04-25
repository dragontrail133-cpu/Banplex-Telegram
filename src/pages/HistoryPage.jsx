import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeft,
  Clock3,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import ActionCard, { ActionCardSheet } from '../components/ui/ActionCard'
import {
  AppButton,
  AppCardDashed,
  AppCardStrong,
  AppEmptyState,
  AppInput,
  AppSheet,
  AppToggleGroup,
  PageShell,
  PageHeader,
} from '../components/ui/AppPrimitives'
import {
  formatCurrency,
  formatTransactionTimestamp,
  getTransactionContextLabel,
  getTransactionLedgerFilterOptions,
  getTransactionLedgerVisibilityOptions,
  getTransactionTitle,
  getTransactionCreatorLabel,
  matchesTransactionLedgerFilter,
  shouldHideTransactionAmount,
} from '../lib/transaction-presentation'
import { logPerf, nowMs, roundMs } from '../lib/timing'
import { fetchHistoryTransactionPageFromApi } from '../lib/transactions-api'
import useAuthStore from '../store/useAuthStore'

const filters = getTransactionLedgerFilterOptions({
  includeSuratJalan: false,
  includePayrollBills: false,
})
const historyLedgerVisibilityOptions = getTransactionLedgerVisibilityOptions('history')
const filterValueSet = new Set(filters.map((item) => item.value))
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

export function HistoryWorkspace({ embedded = false, headerActionsTarget = null } = {}) {
  const navigate = useNavigate()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const restoredHistoryState = useMemo(
    () => readHistoryListState(currentTeamId),
    [currentTeamId]
  )
  const restoredFilter = filterValueSet.has(restoredHistoryState?.filter)
    ? restoredHistoryState.filter
    : 'all'
  const shouldSkipInitialLoadRef = useRef(
    Boolean(restoredHistoryState?.hasLoaded ?? restoredHistoryState?.transactions?.length > 0)
  )
  const savedScrollPositionRef = useRef(Number(restoredHistoryState?.scrollY ?? 0))
  const historyMountedAtRef = useRef(nowMs())
  const historyFirstUsableLoggedRef = useRef(false)
  const [filter, setFilter] = useState(
    restoredFilter
  )
  const [searchTerm, setSearchTerm] = useState(restoredHistoryState?.searchTerm ?? '')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(
    restoredHistoryState?.debouncedSearchTerm ?? restoredHistoryState?.searchTerm ?? ''
  )
  const [isSearchExpanded, setIsSearchExpanded] = useState(
    Boolean(
      (restoredHistoryState?.searchTerm ?? restoredHistoryState?.debouncedSearchTerm ?? '').trim()
    )
  )
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [transactions, setTransactions] = useState(
    Array.isArray(restoredHistoryState?.transactions)
      ? restoredHistoryState.transactions.filter((transaction) =>
          matchesTransactionLedgerFilter(
            transaction,
            restoredFilter,
            historyLedgerVisibilityOptions
          )
        )
      : []
  )
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
  const [activeActionCard, setActiveActionCard] = useState(null)
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

        const nextTransactions = (result.historyTransactions ?? []).filter((transaction) =>
          matchesTransactionLedgerFilter(
            transaction,
            filter,
            historyLedgerVisibilityOptions
          )
        )

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

  const handleOpenActionMenu = (menuState) => {
    setActiveActionCard(menuState)
  }

  const handleCloseActionMenu = () => {
    setActiveActionCard(null)
  }

  const Shell = embedded ? 'div' : PageShell
  const compactToolbar = (
    <div className="flex items-center justify-end gap-2">
      <AppButton
        aria-label="Buka pencarian Riwayat"
        iconOnly
        leadingIcon={<Search className="h-4 w-4" />}
        onClick={() => setIsSearchExpanded((currentValue) => !currentValue)}
        size="sm"
        type="button"
        variant={isSearchExpanded || searchTerm.trim() ? 'primary' : 'secondary'}
      />
      <AppButton
        aria-label="Buka filter Riwayat"
        iconOnly
        leadingIcon={<SlidersHorizontal className="h-4 w-4" />}
        onClick={() => setIsFilterSheetOpen(true)}
        size="sm"
        type="button"
        variant={filter === 'all' ? 'secondary' : 'primary'}
      />
    </div>
  )
  const headerActionsPortal =
    embedded && headerActionsTarget ? createPortal(compactToolbar, headerActionsTarget) : null

  return (
    <Shell className={embedded ? 'space-y-4' : undefined}>
      {headerActionsPortal}

      {embedded ? null : (
        <PageHeader
          title="Riwayat"
          action={
            <div className="flex items-center gap-2">
              <AppButton
                aria-label="Buka pencarian Riwayat"
                iconOnly
                leadingIcon={<Search className="h-4 w-4" />}
                onClick={() => setIsSearchExpanded((currentValue) => !currentValue)}
                size="sm"
                type="button"
                variant={isSearchExpanded || searchTerm.trim() ? 'primary' : 'secondary'}
              />
              <AppButton
                aria-label="Buka filter Riwayat"
                iconOnly
                leadingIcon={<SlidersHorizontal className="h-4 w-4" />}
                onClick={() => setIsFilterSheetOpen(true)}
                size="sm"
                type="button"
                variant={filter === 'all' ? 'secondary' : 'primary'}
              />
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
                aria-label="Buka Arsip"
                leadingIcon={<Trash2 className="h-4 w-4" />}
              >
                <span className="sr-only">Arsip</span>
              </AppButton>
            </div>
          }
        />
      )}

      <div className="space-y-3">
        {isSearchExpanded ? (
          <AppInput
            aria-label="Cari riwayat transaksi"
            className="w-full"
            onChange={(event) => setSearchTerm(event.target.value)}
            type="search"
            value={searchTerm}
          />
        ) : null}
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
            const hideAmount = shouldHideTransactionAmount(transaction)
            const amount = hideAmount ? null : Math.abs(Number(transaction.amount ?? 0))
            const actions = [
              {
                id: 'detail',
                label: 'Detail',
                icon: <Clock3 className="h-4 w-4" />,
                onClick: () => handleOpenDetail(transaction),
              },
            ]

            return (
              <ActionCard
                key={`${transaction.sourceType ?? 'transaction'}-${transaction.id}`}
                title={getTransactionTitle(transaction)}
                subtitle={formatTransactionTimestamp(transaction, [
                  'sort_at',
                  'bill_paid_at',
                  'updated_at',
                  'created_at',
                  'transaction_date',
                  'expense_date',
                ])}
                details={[getTransactionContextLabel(transaction)].filter(Boolean)}
                amount={
                  amount == null
                    ? null
                    : `${Number(transaction.amount ?? 0) < 0 || transaction.type === 'expense'
                      ? '-'
                      : '+'}${formatCurrency(amount)}`
                }
                amountClassName={presentation.amountClassName}
                badge={getTransactionCreatorLabel(transaction)}
                actions={actions}
                menuMode="shared"
                onOpenMenu={handleOpenActionMenu}
                leadingIcon={
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-[18px] ${presentation.iconClassName}`}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                }
                className="app-card px-4 py-4"
              />
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

      <ActionCardSheet
        open={Boolean(activeActionCard)}
        title="Detail dan Aksi"
        description={activeActionCard?.description ?? null}
        actions={activeActionCard?.actions ?? []}
        onClose={handleCloseActionMenu}
      />
      <AppSheet onClose={() => setIsFilterSheetOpen(false)} open={isFilterSheetOpen} title="Filter">
        <AppToggleGroup
          buttonSize="sm"
          compact
          stacked
          onChange={(nextFilter) => {
            setFilter(nextFilter)
            setIsFilterSheetOpen(false)
          }}
          options={filters}
          value={filter}
        />
      </AppSheet>
    </Shell>
  )
}

export default HistoryPage

function HistoryPage() {
  return <HistoryWorkspace />
}
