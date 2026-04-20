import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Clock3, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  AppButton,
  AppCardDashed,
  AppCardStrong,
  AppEmptyState,
  AppInput,
  AppSheet,
  PageShell,
  PageHeader,
} from '../components/ui/AppPrimitives'
import {
  canDeleteTransaction,
  canEditTransaction,
  canOpenTransactionPayment,
  formatCurrency,
  formatTransactionDateTime,
  getTransactionEditRoute,
  getTransactionCreatorLabel,
  getTransactionLedgerFilterOptions,
  getTransactionLedgerSummary,
  getTransactionPaymentLabel,
  getTransactionPaymentRoute,
  getTransactionTitle,
} from '../lib/transaction-presentation'
import { logPerf, nowMs, roundMs } from '../lib/timing'
import { fetchWorkspaceTransactionPageFromApi } from '../lib/transactions-api'
import useAuthStore from '../store/useAuthStore'
import useDashboardStore from '../store/useDashboardStore'
import useAttendanceStore from '../store/useAttendanceStore'
import useIncomeStore from '../store/useIncomeStore'
import useTransactionStore from '../store/useTransactionStore'

const filters = getTransactionLedgerFilterOptions()
const ledgerPageSize = 20
const ledgerListStateStorageKey = 'banplex:transactions-list-state'
const ledgerPerfEnabled = import.meta.env.DEV

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
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const restoredLedgerState = useMemo(
    () => readLedgerListState(currentTeamId),
    [currentTeamId]
  )
  const shouldSkipInitialLoadRef = useRef(Boolean(restoredLedgerState?.hasLoaded))
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
  const [filter, setFilter] = useState(restoredLedgerState?.filter ?? 'all')
  const [searchTerm, setSearchTerm] = useState(restoredLedgerState?.searchTerm ?? '')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(
    restoredLedgerState?.debouncedSearchTerm ?? restoredLedgerState?.searchTerm ?? ''
  )
  const [transactions, setTransactions] = useState(restoredLedgerState?.transactions ?? [])
  const [pageInfo, setPageInfo] = useState(
    restoredLedgerState?.pageInfo ?? {
      hasMore: false,
      nextCursor: null,
      totalCount: 0,
    }
  )
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [ledgerError, setLedgerError] = useState(null)
  const [selectedActionTransaction, setSelectedActionTransaction] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [hasLoadedLedger, setHasLoadedLedger] = useState(
    Boolean(restoredLedgerState?.hasLoaded)
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
          setHasLoadedLedger(false)
        }

        setLedgerError(null)
        return
      }

      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoadingTransactions(true)
        setHasLoadedLedger(false)
      }

      try {
        const result = await fetchWorkspaceTransactionPageFromApi(currentTeamId, {
          cursor,
          limit: ledgerPageSize,
          search: debouncedSearchTerm,
          filter,
        })

        if (requestId !== requestSequenceRef.current) {
          return
        }

        const nextTransactions = result.workspaceTransactions ?? []

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
        setHasLoadedLedger(true)
        setLedgerError(null)

        if (ledgerPerfEnabled && !append) {
          logPerf(
            'Jurnal first-page fetch',
            {
              fetchMs: roundMs(nowMs() - requestStartedAt),
              serverTiming: result.timing ?? null,
              itemCount: nextTransactions.length,
              hasMore: result.pageInfo?.hasMore ?? false,
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

    setSelectedActionTransaction(null)
    setActionError(null)
    setLedgerError(null)
    setTransactions([])
    setPageInfo({
      hasMore: false,
      nextCursor: null,
      totalCount: 0,
    })
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

  const handleEditTransaction = (transaction) => {
    const editRoute = transaction.editRoute ?? getTransactionEditRoute(transaction)

    if (!editRoute) {
      return
    }

    setSelectedActionTransaction(null)
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
    setSelectedActionTransaction(null)
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

  const handleDeleteTransaction = async (transaction) => {
    if (!(transaction.canDelete ?? canDeleteTransaction(transaction))) {
      return
    }

    const shouldDelete = window.confirm(`Hapus ${getTransactionTitle(transaction)}?`)

    if (!shouldDelete) {
      return
    }

    try {
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

      setSelectedActionTransaction(null)
      await loadLedgerPage({ cursor: null, append: false })

      if (currentTeamId) {
        void refreshWorkspaceTransactions(currentTeamId, { silent: true }).catch((error) => {
          console.error('Gagal menyinkronkan transaksi workspace:', error)
        })
      }
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Gagal menghapus mutasi.'

      setActionError(message)
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

  return (
    <PageShell>
      <PageHeader
        title="Jurnal"
        action={
          <div className="flex items-center gap-2">
            <AppButton
              onClick={() => navigate('/transactions/history')}
              size="sm"
              type="button"
              variant="secondary"
              iconOnly
              aria-label="Buka riwayat transaksi"
              leadingIcon={<Clock3 className="h-4 w-4" />}
            >
              <span className="sr-only">Riwayat</span>
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
          aria-label="Cari ledger transaksi"
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

      {actionError ? (
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
            const amount = Math.abs(Number(transaction.amount ?? 0))
            const canEdit = Boolean(transaction.canEdit ?? canEditTransaction(transaction))
            const canDelete = Boolean(transaction.canDelete ?? canDeleteTransaction(transaction))
            const canPay = Boolean(transaction.canPay ?? canOpenTransactionPayment(transaction))
            const ledgerSummary = getTransactionLedgerSummary(transaction)
            const hasCreatorIdentity = Boolean(
              transaction?.created_by_user_id ??
                transaction?.createdByUserId ??
                transaction?.telegram_user_id ??
                transaction?.telegramUserId
            )
            const creatorLabel = hasCreatorIdentity ? getTransactionCreatorLabel(transaction) : null

            return (
              <AppCardStrong key={`${transaction.sourceType ?? 'transaction'}-${transaction.id}`}>
                <div className="flex items-center gap-3">
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
                          transaction.transaction_date || transaction.created_at
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
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`text-sm font-semibold ${presentation.amountClassName}`}>
                      {Number(transaction.amount ?? 0) < 0 || transaction.type === 'expense'
                        ? '-'
                        : '+'}
                      {formatCurrency(amount)}
                    </span>
                    {canEdit || canDelete || canPay ? (
                      <button
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)]"
                        onClick={() => {
                          setActionError(null)
                          setSelectedActionTransaction(transaction)
                        }}
                        type="button"
                        aria-label={`Buka menu aksi untuk ${getTransactionTitle(transaction)}`}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
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

      <AppSheet
        open={Boolean(selectedActionTransaction)}
        onClose={() => setSelectedActionTransaction(null)}
        title="Aksi Transaksi"
        description={
          selectedActionTransaction ? getTransactionTitle(selectedActionTransaction) : null
        }
      >
        {selectedActionTransaction ? (
          <div className="space-y-3">
            {(selectedActionTransaction.canPay ??
              canOpenTransactionPayment(selectedActionTransaction)) ? (
              <AppButton
                onClick={() => handleOpenPayment(selectedActionTransaction)}
                type="button"
                variant="secondary"
                leadingIcon={<ArrowUpRight className="h-4 w-4" />}
              >
                {getTransactionPaymentLabel(selectedActionTransaction)}
              </AppButton>
            ) : null}
            {(selectedActionTransaction.canEdit ??
              canEditTransaction(selectedActionTransaction)) ? (
              <AppButton
                onClick={() => handleEditTransaction(selectedActionTransaction)}
                type="button"
                variant="secondary"
                leadingIcon={<Pencil className="h-4 w-4" />}
              >
                Edit
              </AppButton>
            ) : null}
            {(selectedActionTransaction.canDelete ??
              canDeleteTransaction(selectedActionTransaction)) ? (
              <AppButton
                onClick={() => handleDeleteTransaction(selectedActionTransaction)}
                type="button"
                variant="danger"
                leadingIcon={<Trash2 className="h-4 w-4" />}
              >
                Hapus
              </AppButton>
            ) : null}
          </div>
        ) : null}
      </AppSheet>
    </PageShell>
  )
}

export default TransactionsPage
