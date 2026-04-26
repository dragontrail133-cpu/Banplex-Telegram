import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock3,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import ActionCard, { ActionCardSheet } from '../components/ui/ActionCard'
import TransactionDeleteDialog from '../components/TransactionDeleteDialog'
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
  canEditTransaction,
  canOpenTransactionPayment,
  formatCurrency,
  formatTransactionTimestamp,
  isPayrollBillTransaction,
  getTransactionLedgerVisibilityOptions,
  getTransactionContextLabel,
  getTransactionEditRoute,
  getTransactionLedgerFilterOptions,
  getTransactionPaymentLabel,
  getTransactionPaymentRoute,
  getTransactionSettlementBadgeLabel,
  getTransactionTitle,
  getTransactionCreatorLabel,
  matchesTransactionLedgerFilter,
  shouldHideTransactionAmount,
} from '../lib/transaction-presentation'
import {
  canShowTransactionDelete,
  getTransactionDeleteHistoryRoute,
  hasTransactionPaymentHistory,
} from '../lib/transaction-delete'
import { logPerf, nowMs, roundMs } from '../lib/timing'
import useMutationToast from '../hooks/useMutationToast'
import { fetchWorkspaceTransactionPageFromApi } from '../lib/transactions-api'
import BillsPage from './BillsPage'
import { HistoryWorkspace } from './HistoryPage'
import useAuthStore from '../store/useAuthStore'
import useDashboardStore from '../store/useDashboardStore'
import useAttendanceStore from '../store/useAttendanceStore'
import useIncomeStore from '../store/useIncomeStore'
import useTransactionStore from '../store/useTransactionStore'

const filters = getTransactionLedgerFilterOptions({ includePayrollBills: false })
const workspaceLedgerVisibilityOptions = getTransactionLedgerVisibilityOptions('workspace')
const filterValueSet = new Set(filters.map((item) => item.value))
const ledgerPageSize = 20
const ledgerListStateStorageKey = 'banplex:transactions-list-state'
const ledgerPerfEnabled = import.meta.env.DEV

function isActiveLedgerVisibleTransaction(transaction) {
  return getTransactionSettlementBadgeLabel(transaction) !== 'Lunas'
}

function createDefaultPageInfo() {
  return {
    hasMore: false,
    nextCursor: null,
    totalCount: 0,
  }
}

function createWarmSeedPageInfo(transactions = []) {
  return {
    hasMore: false,
    nextCursor: null,
    totalCount: transactions.length,
  }
}

function readLedgerListState(teamId) {
  if (!teamId || typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.sessionStorage.getItem(ledgerListStateStorageKey)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (parsedValue?.teamId !== teamId) {
      return null
    }

    return parsedValue
  } catch (error) {
    console.error('Gagal membaca state Jurnal:', error)
    return null
  }
}

function saveLedgerListState(teamId, state) {
  if (!teamId || typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(
      ledgerListStateStorageKey,
      JSON.stringify({
        teamId,
        ...state,
      })
    )
  } catch (error) {
    console.error('Gagal menyimpan state Jurnal:', error)
  }
}

function getTransactionPresentation(transaction) {
  if (transaction.type === 'expense') {
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

function isMaterialExpense(transaction) {
  const expenseType = String(transaction?.expense_type ?? '').trim().toLowerCase()
  const documentType = String(transaction?.document_type ?? '').trim().toLowerCase()

  return expenseType === 'material' || expenseType === 'material_invoice' || documentType === 'surat_jalan'
}

function TransactionsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const workspaceTransactions = useDashboardStore((state) => state.workspaceTransactions)
  const workspaceLastUpdatedAt = useDashboardStore((state) => state.workspaceLastUpdatedAt)
  const restoredLedgerState = useMemo(
    () => readLedgerListState(currentTeamId),
    [currentTeamId]
  )
  const restoredLedgerFilter = filterValueSet.has(restoredLedgerState?.filter)
    ? restoredLedgerState.filter
    : 'all'
  const restoredLedgerTransactions = useMemo(() => {
    return Array.isArray(restoredLedgerState?.transactions)
      ? restoredLedgerState.transactions.filter((transaction) =>
          matchesTransactionLedgerFilter(
            transaction,
            restoredLedgerFilter,
            workspaceLedgerVisibilityOptions
          ) && isActiveLedgerVisibleTransaction(transaction)
        )
      : []
  }, [restoredLedgerFilter, restoredLedgerState?.transactions])
  const initialLedgerBootstrapRef = useRef(false)
  const skipInitialReloadRef = useRef(true)
  const savedScrollPositionRef = useRef(Number(restoredLedgerState?.scrollY ?? 0))
  const ledgerMountedAtRef = useRef(nowMs())
  const ledgerFirstUsableLoggedRef = useRef(false)
  const refreshWorkspaceTransactions = useDashboardStore(
    (state) => state.fetchWorkspaceTransactions
  )
  const softDeleteProjectIncome = useIncomeStore((state) => state.softDeleteProjectIncome)
  const softDeleteLoan = useIncomeStore((state) => state.softDeleteLoan)
  const softDeleteExpense = useTransactionStore((state) => state.softDeleteExpense)
  const softDeleteMaterialInvoice = useTransactionStore(
    (state) => state.softDeleteMaterialInvoice
  )
  const softDeleteAttendanceRecord = useAttendanceStore(
    (state) => state.softDeleteAttendanceRecord
  )
  const clearIncomeError = useIncomeStore((state) => state.clearError)
  const [filter, setFilter] = useState(
    restoredLedgerFilter
  )
  const [searchTerm, setSearchTerm] = useState(restoredLedgerState?.searchTerm ?? '')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(
    restoredLedgerState?.debouncedSearchTerm ?? restoredLedgerState?.searchTerm ?? ''
  )
  const [isSearchExpanded, setIsSearchExpanded] = useState(
    Boolean((restoredLedgerState?.searchTerm ?? restoredLedgerState?.debouncedSearchTerm ?? '').trim())
  )
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const [historyHeaderActionsTarget, setHistoryHeaderActionsTarget] = useState(null)
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState(null)
  const [pendingDeleteHistoryRoute, setPendingDeleteHistoryRoute] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const showInlineMutationFeedback = false
  const { begin, clear, fail, succeed } = useMutationToast()
  const ledgerTab = useMemo(() => {
    const tab = new URLSearchParams(location.search).get('tab')

    if (tab === 'history' || tab === 'tagihan') {
      return tab
    }

    return 'active'
  }, [location.search])
  const ledgerHeaderAction = useMemo(() => {
    if (ledgerTab === 'history') {
      return <div ref={setHistoryHeaderActionsTarget} className="flex items-center gap-2" />
    }

    if (ledgerTab === 'tagihan') {
      return null
    }

    return (
      <div className="flex items-center gap-2">
        <AppButton
          aria-label="Buka pencarian Jurnal"
          iconOnly
          leadingIcon={<Search className="h-4 w-4" />}
          onClick={() => setIsSearchExpanded((currentValue) => !currentValue)}
          size="sm"
          type="button"
          variant={isSearchExpanded || searchTerm.trim() ? 'primary' : 'secondary'}
        />
        <AppButton
          aria-label="Buka filter Jurnal"
          iconOnly
          leadingIcon={<SlidersHorizontal className="h-4 w-4" />}
          onClick={() => setIsFilterSheetOpen(true)}
          size="sm"
          type="button"
          variant={filter === 'all' ? 'secondary' : 'primary'}
        />
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
    )
  }, [filter, isSearchExpanded, ledgerTab, navigate, searchTerm])
  useEffect(() => () => clear(), [clear])
  const warmWorkspaceSeed = useMemo(() => {
    const hasRestoredLedger = Boolean(restoredLedgerState?.hasLoaded)
    const shouldUseWarmSeed =
      Boolean(currentTeamId) &&
      !hasRestoredLedger &&
      filter === 'all' &&
      searchTerm.trim().length === 0 &&
      workspaceTransactions.length > 0 &&
      workspaceLastUpdatedAt

    return shouldUseWarmSeed
      ? workspaceTransactions
          .filter((transaction) =>
            matchesTransactionLedgerFilter(
              transaction,
              filter,
              workspaceLedgerVisibilityOptions
            ) && isActiveLedgerVisibleTransaction(transaction)
          )
          .slice(0, ledgerPageSize)
      : []
  }, [
    currentTeamId,
    filter,
    restoredLedgerState?.hasLoaded,
    searchTerm,
    workspaceLastUpdatedAt,
    workspaceTransactions,
  ])
  const [transactions, setTransactions] = useState(
    restoredLedgerTransactions.length > 0 ? restoredLedgerTransactions : warmWorkspaceSeed
  )
  const [pageInfo, setPageInfo] = useState(
    restoredLedgerState?.pageInfo ?? createWarmSeedPageInfo(warmWorkspaceSeed)
  )
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [ledgerError, setLedgerError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [activeActionCard, setActiveActionCard] = useState(null)
  const [hasLoadedLedger, setHasLoadedLedger] = useState(
    Boolean(restoredLedgerState?.hasLoaded || warmWorkspaceSeed.length > 0)
  )
  const requestSequenceRef = useRef(0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim())
    }, 250)

    return () => window.clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    return () => {
      clearIncomeError()
    }
  }, [clearIncomeError])

  useEffect(() => {
    ledgerMountedAtRef.current = nowMs()
    ledgerFirstUsableLoggedRef.current = false
    initialLedgerBootstrapRef.current = false
    skipInitialReloadRef.current = true
  }, [currentTeamId])

  useEffect(() => {
    if (!ledgerPerfEnabled || ledgerFirstUsableLoggedRef.current) {
      return
    }

    if (!currentTeamId || isLoadingTransactions || ledgerError || transactions.length === 0) {
      return
    }

    ledgerFirstUsableLoggedRef.current = true
    logPerf(
      'Jurnal first usable list',
      {
        mountMs: roundMs(nowMs() - ledgerMountedAtRef.current),
        itemCount: transactions.length,
        hasMore: pageInfo.hasMore,
      },
      ledgerPerfEnabled
    )
  }, [
    currentTeamId,
    isLoadingTransactions,
    ledgerError,
    pageInfo.hasMore,
    transactions.length,
  ])

  const loadLedgerPage = useCallback(
    async ({ cursor = null, append = false, background = false } = {}) => {
      const requestId = ++requestSequenceRef.current
      const requestStartedAt = nowMs()

      if (!currentTeamId) {
        if (!append) {
          setTransactions([])
          setPageInfo(createDefaultPageInfo())
          setHasLoadedLedger(false)
        }

        setLedgerError(null)
        return
      }

      if (append) {
        setIsLoadingMore(true)
      } else if (!background) {
        setIsLoadingTransactions(true)
        setHasLoadedLedger(false)
      }

      try {
        let nextCursor = cursor
        let result = null
        let nextTransactions = []
        let pageInfo = createDefaultPageInfo()

        do {
          result = await fetchWorkspaceTransactionPageFromApi(currentTeamId, {
            cursor: nextCursor,
            limit: ledgerPageSize,
            search: debouncedSearchTerm,
            filter,
          })

          if (requestId !== requestSequenceRef.current) {
            return
          }

          nextTransactions = (result.workspaceTransactions ?? []).filter(
            (transaction) =>
              matchesTransactionLedgerFilter(
                transaction,
                filter,
                workspaceLedgerVisibilityOptions
              ) && isActiveLedgerVisibleTransaction(transaction)
          )
          pageInfo = result.pageInfo ?? createDefaultPageInfo()
          nextCursor = pageInfo.nextCursor
        } while (
          !append &&
          nextTransactions.length === 0 &&
          pageInfo.hasMore &&
          Boolean(nextCursor)
        )

        setTransactions((currentTransactions) =>
          append ? [...currentTransactions, ...nextTransactions] : nextTransactions
        )
        setPageInfo(pageInfo)
        setHasLoadedLedger(true)
        setLedgerError(null)

        if (ledgerPerfEnabled && !append) {
          logPerf(
            'Jurnal first-page fetch',
            {
              fetchMs: roundMs(nowMs() - requestStartedAt),
              serverTiming: result?.timing ?? null,
              itemCount: nextTransactions.length,
              hasMore: pageInfo.hasMore,
            },
            ledgerPerfEnabled
          )
        }
      } catch (error) {
        if (requestId !== requestSequenceRef.current) {
          return
        }

        const message =
          error instanceof Error ? error.message : 'Gagal memuat ledger transaksi.'

        setLedgerError(message)

        if (!append && !background) {
          setTransactions([])
          setPageInfo(createDefaultPageInfo())
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
    if (!currentTeamId || initialLedgerBootstrapRef.current) {
      return
    }

    initialLedgerBootstrapRef.current = true

    if (restoredLedgerState?.hasLoaded) {
      void loadLedgerPage({ cursor: null, append: false, background: true })
      return
    }

    if (warmWorkspaceSeed.length > 0) {
      setActionError(null)
      setLedgerError(null)
      setTransactions(warmWorkspaceSeed)
      setPageInfo(createWarmSeedPageInfo(warmWorkspaceSeed))
      setHasLoadedLedger(true)
      void loadLedgerPage({ cursor: null, append: false, background: true })
      return
    }

    setActionError(null)
    setLedgerError(null)
    setTransactions([])
    setPageInfo(createDefaultPageInfo())
    setHasLoadedLedger(false)
    void loadLedgerPage({ cursor: null, append: false })
  }, [
    currentTeamId,
    loadLedgerPage,
    restoredLedgerState?.hasLoaded,
    warmWorkspaceSeed,
  ])

  useEffect(() => {
    if (!currentTeamId || restoredLedgerState?.hasLoaded) {
      return
    }

    if (warmWorkspaceSeed.length === 0 || transactions.length > 0) {
      return
    }

    setActionError(null)
    setLedgerError(null)
    setTransactions(warmWorkspaceSeed)
    setPageInfo(createWarmSeedPageInfo(warmWorkspaceSeed))
    setHasLoadedLedger(true)
    void loadLedgerPage({ cursor: null, append: false, background: true })
  }, [
    currentTeamId,
    loadLedgerPage,
    restoredLedgerState?.hasLoaded,
    transactions.length,
    warmWorkspaceSeed,
  ])

  useEffect(() => {
    if (skipInitialReloadRef.current) {
      skipInitialReloadRef.current = false
      return
    }

    setActionError(null)
    setLedgerError(null)
    setTransactions([])
    setPageInfo(createDefaultPageInfo())
    void loadLedgerPage({ cursor: null, append: false })
  }, [filter, loadLedgerPage])

  useEffect(() => {
    if (!currentTeamId) {
      return
    }

    saveLedgerListState(currentTeamId, {
      filter,
      searchTerm,
      debouncedSearchTerm,
      transactions,
      pageInfo,
      hasLoaded: hasLoadedLedger,
      scrollY: savedScrollPositionRef.current,
    })
  }, [
    currentTeamId,
    debouncedSearchTerm,
    filter,
    hasLoadedLedger,
    pageInfo,
    searchTerm,
    transactions,
  ])

  useEffect(() => {
    if (
      !restoredLedgerState?.hasLoaded ||
      typeof window === 'undefined'
    ) {
      return
    }

    const scrollY = Number(restoredLedgerState.scrollY ?? 0)

    if (!Number.isFinite(scrollY) || scrollY <= 0) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'auto' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [restoredLedgerState])

  const showSkeleton =
    Boolean(currentTeamId) &&
    isLoadingTransactions &&
    transactions.length === 0 &&
    !ledgerError

  const handleOpenDetail = (transaction) => {
    setActionError(null)
    if (typeof window !== 'undefined') {
      savedScrollPositionRef.current = window.scrollY
      saveLedgerListState(currentTeamId, {
        filter,
        searchTerm,
        debouncedSearchTerm,
        transactions,
        pageInfo,
        hasLoaded: hasLoadedLedger,
        scrollY: savedScrollPositionRef.current,
      })
    }
    const isPaymentLeaf =
      transaction.sourceType === 'bill-payment' || transaction.sourceType === 'loan-payment'

    navigate(transaction.detailRoute ?? `/transactions/${transaction.id}`, {
      state: isPaymentLeaf
        ? {
            transaction,
            detailSurface: 'pembayaran',
          }
        : {
            transaction,
          },
    })
  }

  const handleOpenActionMenu = (menuState) => {
    setActiveActionCard(menuState)
  }

  const handleCloseActionMenu = () => {
    setActiveActionCard(null)
  }

  const handleEditTransaction = (transaction) => {
    const editRoute = transaction.editRoute ?? getTransactionEditRoute(transaction)

    if (!editRoute) {
      return
    }

    if (typeof window !== 'undefined') {
      savedScrollPositionRef.current = window.scrollY
      saveLedgerListState(currentTeamId, {
        filter,
        searchTerm,
        debouncedSearchTerm,
        transactions,
        pageInfo,
        hasLoaded: hasLoadedLedger,
        scrollY: savedScrollPositionRef.current,
      })
    }
    navigate(editRoute, { state: { item: transaction } })
  }

  const handleOpenPayment = (transaction) => {
    const paymentRoute = getTransactionPaymentRoute(transaction)

    if (!paymentRoute) {
      return
    }

    setActionError(null)
    if (typeof window !== 'undefined') {
      savedScrollPositionRef.current = window.scrollY
      saveLedgerListState(currentTeamId, {
        filter,
        searchTerm,
        debouncedSearchTerm,
        transactions,
        pageInfo,
        hasLoaded: hasLoadedLedger,
        scrollY: savedScrollPositionRef.current,
      })
    }
    navigate(paymentRoute, {
      state: {
        transaction,
        returnTo: '/transactions',
      },
    })
  }

  const openDeleteTransactionDialog = (transaction) => {
    if (!canShowTransactionDelete(transaction)) {
      return
    }

    setActiveActionCard(null)
    setActionError(null)
    setPendingDeleteTransaction(transaction)
    setPendingDeleteHistoryRoute(
      hasTransactionPaymentHistory(transaction)
        ? getTransactionDeleteHistoryRoute(transaction)
        : null
    )
  }

  const performDeleteTransaction = async () => {
    const transaction = pendingDeleteTransaction

    if (!transaction || pendingDeleteHistoryRoute) {
      return
    }

    try {
      begin({
        title: 'Menghapus transaksi',
        message: 'Mohon tunggu sampai daftar jurnal diperbarui.',
      })

      setIsDeleting(true)
      setActionError(null)

      if (transaction.sourceType === 'project-income') {
        await softDeleteProjectIncome(
          transaction.id,
          transaction.updated_at ?? transaction.updatedAt ?? null
        )
      } else if (transaction.sourceType === 'loan-disbursement') {
        await softDeleteLoan(
          transaction.id,
          transaction.updated_at ?? transaction.updatedAt ?? null
        )
      } else if (transaction.sourceType === 'expense') {
        if (isMaterialExpense(transaction)) {
          await softDeleteMaterialInvoice(
            transaction.id,
            transaction.updated_at ?? transaction.updatedAt ?? null
          )
        } else {
          await softDeleteExpense(
            transaction.id,
            transaction.updated_at ?? transaction.updatedAt ?? null
          )
        }
      } else if (transaction.sourceType === 'attendance-record') {
        await softDeleteAttendanceRecord({
          attendanceId: transaction.id,
          teamId: transaction.team_id ?? currentTeamId,
        })
      }

      await loadLedgerPage({ cursor: null, append: false })

      if (currentTeamId) {
        void refreshWorkspaceTransactions(currentTeamId, { silent: true }).catch((error) => {
          console.error('Gagal menyinkronkan transaksi workspace:', error)
        })
      }

      succeed({
        title: 'Transaksi dihapus',
        message: 'Transaksi berhasil dipindahkan ke arsip.',
      })
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Gagal menghapus mutasi.'

      fail({
        title: 'Transaksi gagal dihapus',
        message,
      })
      setActionError(message)
    } finally {
      setIsDeleting(false)
      setPendingDeleteTransaction(null)
      setPendingDeleteHistoryRoute(null)
    }
  }

  const handleLoadMore = () => {
    if (!pageInfo.hasMore || !pageInfo.nextCursor) {
      return
    }

    void loadLedgerPage({
      cursor: pageInfo.nextCursor,
      append: true,
    })
  }

  const handleChangeLedgerTab = useCallback(
    (nextTab) => {
      const nextPath =
        nextTab === 'history'
          ? '/transactions?tab=history'
          : nextTab === 'tagihan'
            ? '/transactions?tab=tagihan'
            : '/transactions'
      navigate(nextPath, { replace: true })
    },
    [navigate]
  )

  return (
    <PageShell>
      <PageHeader
        title="Jurnal"
        action={ledgerHeaderAction}
      />

      <div className="space-y-3">
        <AppToggleGroup
          buttonSize="sm"
          compact
          onChange={handleChangeLedgerTab}
          options={[
            { value: 'active', label: 'Aktif' },
            { value: 'tagihan', label: 'Tagihan' },
            { value: 'history', label: 'Riwayat' },
          ]}
          value={ledgerTab}
        />

        {ledgerTab === 'active' && isSearchExpanded ? (
          <AppInput
            aria-label="Cari ledger transaksi"
            className="w-full"
            onChange={(event) => setSearchTerm(event.target.value)}
            type="search"
            value={searchTerm}
          />
        ) : null}
      </div>

      {ledgerTab === 'active' ? (
        <>
          {ledgerError ? (
            <AppCardDashed>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
                Gagal Memuat Ledger
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">{ledgerError}</p>
              <div className="mt-4">
                <AppButton onClick={() => void loadLedgerPage({ cursor: null, append: false })} type="button" variant="secondary">
                  Coba Lagi
                </AppButton>
              </div>
            </AppCardDashed>
          ) : null}

          {showInlineMutationFeedback && actionError ? (
            <AppCardDashed>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
                Aksi Transaksi Gagal
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
            <AppEmptyState
              className="px-4 py-5"
              title="Belum Ada Catatan"
              description="Catatan kas akan muncul di sini setelah transaksi pertama tersimpan untuk workspace ini."
            />
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => {
                const presentation = getTransactionPresentation(transaction)
                const Icon = presentation.Icon
                const settlementBadgeLabel = getTransactionSettlementBadgeLabel(transaction)
                const visibleSettlementBadgeLabel =
                  ledgerTab === 'active' && settlementBadgeLabel === 'Lunas'
                    ? null
                    : settlementBadgeLabel
                const hideAmount = shouldHideTransactionAmount(transaction)
                const amount = hideAmount ? null : Math.abs(Number(transaction.amount ?? 0))
                const canEdit = Boolean(transaction.canEdit ?? canEditTransaction(transaction))
                const canDelete = canShowTransactionDelete(transaction)
                const canPay = !isPayrollBillTransaction(transaction) && Boolean(
                  transaction.canPay ?? canOpenTransactionPayment(transaction)
                )
                const actions = [
                  {
                    id: 'detail',
                    label: 'Detail',
                    icon: <Clock3 className="h-4 w-4" />,
                    onClick: () => handleOpenDetail(transaction),
                  },
                  ...(canPay
                    ? [
                        {
                          id: 'pay',
                          label: getTransactionPaymentLabel(transaction),
                          icon: <ArrowUpRight className="h-4 w-4" />,
                          onClick: () => handleOpenPayment(transaction),
                        },
                      ]
                    : []),
                  ...(canEdit
                    ? [
                        {
                          id: 'edit',
                          label: 'Edit',
                          icon: <Pencil className="h-4 w-4" />,
                          onClick: () => handleEditTransaction(transaction),
                        },
                      ]
                    : []),
                  ...(canDelete
                    ? [
                        {
                          id: 'delete',
                          label: 'Hapus',
                          destructive: true,
                          icon: <Trash2 className="h-4 w-4" />,
                          onClick: () => openDeleteTransactionDialog(transaction),
                        },
                      ]
                    : []),
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
                    badges={visibleSettlementBadgeLabel ? [visibleSettlementBadgeLabel] : []}
                    maxVisibleBadges={visibleSettlementBadgeLabel ? 2 : 1}
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
        </>
      ) : ledgerTab === 'tagihan' ? (
        <BillsPage embedded />
      ) : (
        <HistoryWorkspace embedded headerActionsTarget={historyHeaderActionsTarget} />
      )}

      <ActionCardSheet
        open={Boolean(activeActionCard)}
        title="Detail dan Aksi"
        description={activeActionCard?.description ?? null}
        actions={activeActionCard?.actions ?? []}
        onClose={handleCloseActionMenu}
      />
      <TransactionDeleteDialog
        confirmLabel="Hapus Transaksi"
        description={getTransactionTitle(pendingDeleteTransaction)}
        historyRoute={pendingDeleteHistoryRoute}
        isConfirming={isDeleting}
        open={Boolean(pendingDeleteTransaction)}
        onClose={() => {
          setPendingDeleteTransaction(null)
          setPendingDeleteHistoryRoute(null)
        }}
        onConfirm={performDeleteTransaction}
        onOpenHistory={(route) => {
          const nextTransaction = pendingDeleteTransaction

          setPendingDeleteTransaction(null)
          setPendingDeleteHistoryRoute(null)

          if (!route) {
            return
          }

          navigate(route, {
            state: nextTransaction
              ? {
                  transaction: nextTransaction,
                  detailSurface: 'riwayat',
                }
              : undefined,
          })
        }}
        title={
          pendingDeleteHistoryRoute
            ? 'Transaksi sudah memiliki pembayaran'
            : `Konfirmasi Hapus ${getTransactionTitle(pendingDeleteTransaction)}`
        }
        warning={
          pendingDeleteHistoryRoute
            ? 'Transaksi ini sudah memiliki pembayaran. Buka riwayat tagihan untuk meninjau pembayaran sebelum memutuskan langkah berikutnya.'
            : 'Transaksi akan dipindahkan ke arsip dan dapat dipulihkan dari halaman recycle bin.'
        }
      />
      <AppSheet onClose={() => setIsFilterSheetOpen(false)} open={isFilterSheetOpen} title="Filter">
        <AppToggleGroup
          buttonSize="sm"
          compact
          onChange={(nextFilter) => {
            setFilter(nextFilter)
            setIsFilterSheetOpen(false)
          }}
          options={filters}
          stacked
          value={filter}
        />
      </AppSheet>

    </PageShell>
  )
}

export default TransactionsPage
