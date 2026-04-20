import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  FileText,
  MoreVertical,
  Paperclip,
  RotateCcw,
  Trash2,
  Wallet,
} from 'lucide-react'
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
  formatCurrency,
  formatSyncLabel,
  formatTransactionDateTime,
  getTransactionSourceLabel,
  getTransactionTitle,
} from '../lib/transaction-presentation'
import { logPerf, nowMs, roundMs } from '../lib/timing'
import {
  readRecycleBinListState,
  saveRecycleBinListState,
} from '../lib/recycle-bin-state'
import {
  fetchRecycleBinPageFromApi,
  permanentDeleteLoanPaymentFromApi,
  permanentDeleteTransactionFromApi,
  restoreLoanPaymentFromApi,
  restoreTransactionFromApi,
} from '../lib/transactions-api'
import {
  permanentDeleteBillPaymentFromApi,
  permanentDeleteExpenseAttachmentFromApi,
  restoreBillPaymentFromApi,
  restoreExpenseAttachmentFromApi,
  restoreExpenseFromApi,
  restoreMaterialInvoiceFromApi,
} from '../lib/records-api'
import useAuthStore from '../store/useAuthStore'
import useDashboardStore from '../store/useDashboardStore'

const filters = [
  { value: 'all', label: 'Semua' },
  { value: 'transaction', label: 'Mutasi' },
  { value: 'document', label: 'Dokumen' },
  { value: 'payment', label: 'Pembayaran' },
  { value: 'attachment', label: 'Lampiran' },
]
const recycleBinPerfEnabled = import.meta.env.DEV

function getTransactionPresentation(transaction) {
  if (transaction?.group === 'attachment') {
    return {
      Icon: Paperclip,
      iconClassName: 'app-tone-neutral',
      amountClassName: 'text-[var(--app-hint-color)]',
      amountPrefix: '',
      showAmount: false,
    }
  }

  if (transaction?.group === 'payment') {
    return {
      Icon: Wallet,
      iconClassName: 'app-tone-neutral',
      amountClassName: 'text-[var(--app-destructive-color)]',
      amountPrefix: '-',
      showAmount: true,
    }
  }

  if (transaction?.group === 'document') {
    return {
      Icon: FileText,
      iconClassName: 'app-tone-warning',
      amountClassName: 'text-[var(--app-destructive-color)]',
      amountPrefix: '-',
      showAmount: true,
    }
  }

  if (transaction?.type === 'expense') {
    return {
      Icon: ArrowUpRight,
      iconClassName: 'app-tone-warning',
      amountClassName: 'text-[var(--app-destructive-color)]',
      amountPrefix: '-',
      showAmount: true,
    }
  }

  return {
    Icon: ArrowDownLeft,
    iconClassName: 'app-tone-success',
    amountClassName: 'text-[var(--app-success-color)]',
    amountPrefix: '+',
    showAmount: true,
  }
}

function getRecordSourceLabel(record) {
  if (record?.sourceType === 'expense-attachment') {
    return String(record?.party_label ?? 'Lampiran').trim()
  }

  if (record?.sourceType === 'bill-payment') {
    return String(record?.party_label ?? 'Tagihan').trim()
  }

  return getTransactionSourceLabel(record)
}

function getRecordTitle(record) {
  return getTransactionTitle(record)
}

function TransactionsRecycleBinPage() {
  const navigate = useNavigate()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const refreshDashboard = useDashboardStore((state) => state.refreshDashboard)
  const pageLimit = 20
  const restoredRecycleBinState = useMemo(
    () => readRecycleBinListState(currentTeamId),
    [currentTeamId]
  )
  const shouldSkipInitialLoadRef = useRef(
    Boolean(restoredRecycleBinState) && !restoredRecycleBinState?.needsRefresh
  )
  const savedScrollPositionRef = useRef(Number(restoredRecycleBinState?.scrollY ?? 0))
  const [deletedRecords, setDeletedRecords] = useState(
    restoredRecycleBinState?.deletedRecords ?? []
  )
  const [pageInfo, setPageInfo] = useState(
    restoredRecycleBinState?.pageInfo ?? {
      hasMore: false,
      nextCursor: null,
      totalCount: 0,
    }
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState(
    restoredRecycleBinState?.lastUpdatedAt ?? null
  )
  const [filter, setFilter] = useState(restoredRecycleBinState?.filter ?? 'all')
  const [searchTerm, setSearchTerm] = useState(restoredRecycleBinState?.searchTerm ?? '')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm)
  const [pageCursor, setPageCursor] = useState(restoredRecycleBinState?.pageCursor ?? null)
  const [cursorHistory, setCursorHistory] = useState(
    restoredRecycleBinState?.cursorHistory ?? []
  )
  const recycleBinMountedAtRef = useRef(nowMs())
  const recycleBinFirstUsableLoggedRef = useRef(false)

  const loadDeletedRecords = useCallback(
    async (teamId, query = {}) => {
      if (!teamId) {
        setDeletedRecords([])
        setPageInfo({
          hasMore: false,
          nextCursor: null,
          totalCount: 0,
        })
        setIsLoading(false)
        setError(null)
        setLastUpdatedAt(null)
        return []
      }

      setIsLoading(true)
      setError(null)
      const requestStartedAt = nowMs()

      try {
        const { recycleBinRecords, pageInfo: nextPageInfo, timing } =
          await fetchRecycleBinPageFromApi(
          teamId,
          {
            cursor: query.cursor ?? null,
            limit: query.limit ?? pageLimit,
            search: query.search ?? '',
            filter: query.filter ?? 'all',
          }
        )

        setDeletedRecords(recycleBinRecords)
        setPageInfo(nextPageInfo)
        setIsLoading(false)
        setError(null)
        setLastUpdatedAt(new Date().toISOString())

        if (recycleBinPerfEnabled && !query.cursor) {
          logPerf(
            'Halaman Sampah first-page fetch',
            {
              fetchMs: roundMs(nowMs() - requestStartedAt),
              serverTiming: timing ?? null,
              itemCount: recycleBinRecords.length,
              hasMore: nextPageInfo?.hasMore ?? false,
            },
            recycleBinPerfEnabled
          )
        }

        return recycleBinRecords
      } catch (loadError) {
        setDeletedRecords([])
        setPageInfo({
          hasMore: false,
          nextCursor: null,
          totalCount: 0,
        })
        setIsLoading(false)
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Gagal memuat Halaman Sampah.'
        )

        throw loadError
      }
    },
    [pageLimit]
  )

  useEffect(() => {
    recycleBinMountedAtRef.current = nowMs()
    recycleBinFirstUsableLoggedRef.current = false
  }, [currentTeamId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [searchTerm])

  useEffect(() => {
    if (!recycleBinPerfEnabled || recycleBinFirstUsableLoggedRef.current) {
      return
    }

    if (!currentTeamId || isLoading || error || deletedRecords.length === 0) {
      return
    }

    recycleBinFirstUsableLoggedRef.current = true
    logPerf(
      'Halaman Sampah first usable list',
      {
        mountMs: roundMs(nowMs() - recycleBinMountedAtRef.current),
        itemCount: deletedRecords.length,
        hasMore: pageInfo.hasMore,
      },
      recycleBinPerfEnabled
    )
  }, [currentTeamId, deletedRecords.length, error, isLoading, pageInfo.hasMore])

  useEffect(() => {
    if (shouldSkipInitialLoadRef.current) {
      shouldSkipInitialLoadRef.current = false
      return
    }

    const timeoutId = window.setTimeout(() => {
      void loadDeletedRecords(currentTeamId, {
        filter,
        search: debouncedSearchTerm,
        cursor: pageCursor,
        limit: pageLimit,
      }).catch((loadError) => {
        console.error('Gagal memuat Halaman Sampah:', loadError)
      })
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [
    currentTeamId,
    debouncedSearchTerm,
    filter,
    loadDeletedRecords,
    pageCursor,
    pageLimit,
  ])

  useEffect(() => {
    if (!currentTeamId) {
      return
    }

    saveRecycleBinListState(currentTeamId, {
      deletedRecords,
      filter,
      searchTerm,
      pageInfo,
      pageCursor,
      cursorHistory,
      lastUpdatedAt,
      scrollY: savedScrollPositionRef.current,
    })
  }, [
    currentTeamId,
    cursorHistory,
    deletedRecords,
    filter,
    lastUpdatedAt,
    pageCursor,
    pageInfo,
    searchTerm,
  ])

  useEffect(() => {
    if (!restoredRecycleBinState || typeof window === 'undefined') {
      return
    }

    const scrollY = Number(restoredRecycleBinState.scrollY ?? 0)

    if (!Number.isFinite(scrollY) || scrollY <= 0) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'auto' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [restoredRecycleBinState])

  const handleSearchChange = useCallback((event) => {
    const nextSearch = event.target.value

    setCursorHistory([])
    setPageCursor(null)
    setSearchTerm(nextSearch)
  }, [])

  const handleFilterChange = useCallback((nextFilter) => {
    setCursorHistory([])
    setPageCursor(null)
    setFilter(nextFilter)
  }, [])

  const handleNextPage = useCallback(() => {
    if (!pageInfo?.hasMore || !pageInfo?.nextCursor) {
      return
    }

    setCursorHistory((history) => {
      return [...history, pageCursor]
    })
    setPageCursor(pageInfo.nextCursor)
  }, [pageCursor, pageInfo])

  const handlePreviousPage = useCallback(() => {
    setCursorHistory((history) => {
      if (history.length === 0) {
        return history
      }

      const nextHistory = [...history]
      const previousCursor = nextHistory.pop() ?? null

      setPageCursor(previousCursor)

      return nextHistory
    })
  }, [])

  const handleRestore = useCallback(
    async (record) => {
      if (!currentTeamId || !record?.id || !record?.sourceType) {
        return
      }

      try {
        setActionError(null)

        if (record.sourceType === 'expense-attachment') {
          await restoreExpenseAttachmentFromApi(record.id, currentTeamId)
        } else if (record.sourceType === 'bill-payment') {
          await restoreBillPaymentFromApi(
            record.id,
            currentTeamId,
            record.updated_at ?? record.updatedAt ?? null
          )
        } else if (record.sourceType === 'loan-payment') {
          await restoreLoanPaymentFromApi(
            record.id,
            currentTeamId,
            record.updated_at ?? record.updatedAt ?? null
          )
        } else if (record.sourceType === 'expense') {
          if (record.recordKind === 'material-invoice') {
            await restoreMaterialInvoiceFromApi(
              record.id,
              currentTeamId,
              record.updated_at ?? record.updatedAt ?? null
            )
          } else {
            await restoreExpenseFromApi(
              record.id,
              currentTeamId,
              record.updated_at ?? record.updatedAt ?? null
            )
          }
        } else {
          await restoreTransactionFromApi(
            record.sourceType === 'loan-disbursement' ? 'loan' : record.sourceType,
            record.id,
            currentTeamId,
            record.updated_at ?? record.updatedAt ?? null
          )
        }

        setSelectedRecord(null)
        await Promise.all([
          loadDeletedRecords(currentTeamId, {
            filter,
            search: debouncedSearchTerm,
            cursor: pageCursor,
            limit: pageLimit,
          }),
          refreshDashboard(currentTeamId, { silent: true }),
        ])
      } catch (restoreError) {
        setActionError(
          restoreError instanceof Error
            ? restoreError.message
            : 'Gagal memulihkan data.'
        )
      }
    },
    [
      currentTeamId,
      debouncedSearchTerm,
      filter,
      loadDeletedRecords,
      pageCursor,
      pageLimit,
      refreshDashboard,
    ]
  )

  const handlePermanentDelete = useCallback(
    async (record) => {
      if (!currentTeamId || !record?.id || !record?.sourceType) {
        return
      }

      const shouldDelete = window.confirm(
        `Hapus permanen ${getRecordTitle(record)}? Aksi ini tidak bisa dibatalkan.`
      )

      if (!shouldDelete) {
        return
      }

      try {
        setActionError(null)

        if (record.sourceType === 'expense-attachment') {
          await permanentDeleteExpenseAttachmentFromApi(record.id, currentTeamId)
        } else if (record.sourceType === 'bill-payment') {
          await permanentDeleteBillPaymentFromApi(record.id, currentTeamId)
        } else if (record.sourceType === 'loan-payment') {
          await permanentDeleteLoanPaymentFromApi(record.id, currentTeamId)
        } else {
          await permanentDeleteTransactionFromApi(
            record.sourceType === 'loan-disbursement' ? 'loan' : record.sourceType,
            record.id,
            currentTeamId
          )
        }

        setSelectedRecord(null)
        await Promise.all([
          loadDeletedRecords(currentTeamId, {
            filter,
            search: debouncedSearchTerm,
            cursor: pageCursor,
            limit: pageLimit,
          }),
          refreshDashboard(currentTeamId, { silent: true }),
        ])
      } catch (permanentDeleteError) {
        setActionError(
          permanentDeleteError instanceof Error
            ? permanentDeleteError.message
            : 'Gagal menghapus permanen data.'
        )
      }
    },
    [
      currentTeamId,
      debouncedSearchTerm,
      filter,
      loadDeletedRecords,
      pageCursor,
      pageLimit,
      refreshDashboard,
    ]
  )

  const showSkeleton = Boolean(currentTeamId) && isLoading && deletedRecords.length === 0 && !error
  const emptyStateDescription =
    filter === 'all'
      ? 'Data yang dihapus akan ditampilkan di halaman ini.'
      : `Belum ada data ${filters.find((item) => item.value === filter)?.label.toLowerCase()} yang terhapus.`

  const handleOpenRecord = useCallback(
    (record) => {
      if (!record) {
        return
      }

      savedScrollPositionRef.current = window.scrollY
      saveRecycleBinListState(currentTeamId, {
        deletedRecords,
        filter,
        searchTerm,
        pageInfo,
        pageCursor,
        cursorHistory,
        lastUpdatedAt,
        scrollY: savedScrollPositionRef.current,
      })

      if (record.detailRoute) {
        navigate(record.detailRoute, {
          state: {
            record,
            detailSurface: 'recycle-bin',
          },
        })
        return
      }

      setSelectedRecord(record)
    },
    [
      currentTeamId,
      cursorHistory,
      deletedRecords,
      filter,
      lastUpdatedAt,
      navigate,
      pageCursor,
      pageInfo,
      searchTerm,
    ]
  )

  return (
    <PageShell>
      <PageHeader
        title="Halaman Sampah"
        action={
          <AppButton
            onClick={() => navigate(-1)}
            size="sm"
            type="button"
            variant="secondary"
            leadingIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Kembali
          </AppButton>
        }
      />

      {lastUpdatedAt ? (
        <p className="px-1 text-xs text-[var(--app-hint-color)]">
          Sinkron {formatSyncLabel(lastUpdatedAt)}
        </p>
      ) : null}

      <AppInput
        aria-label="Cari"
        onChange={handleSearchChange}
        placeholder="Cari"
        value={searchTerm}
      />

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <AppButton
            key={item.value}
            className="rounded-full"
            onClick={() => handleFilterChange(item.value)}
            size="sm"
            type="button"
            variant={filter === item.value ? 'primary' : 'secondary'}
          >
            {item.label}
          </AppButton>
        ))}
      </div>

      {!currentTeamId ? (
        <AppCardDashed className="px-4 py-5">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Team aktif belum tersedia.
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">
            Login ulang atau pilih workspace yang benar agar Halaman Sampah bisa dimuat.
          </p>
        </AppCardDashed>
      ) : null}

      {error ? (
        <AppCardDashed>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
            Gagal Memuat Halaman Sampah
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">{error}</p>
        </AppCardDashed>
      ) : null}

      {actionError ? (
        <AppCardDashed>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
            Restore Gagal
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">{actionError}</p>
        </AppCardDashed>
      ) : null}

      {showSkeleton ? (
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
      ) : null}

      {!isLoading && currentTeamId && !error && deletedRecords.length === 0 ? (
        <AppEmptyState
          className="px-4 py-6"
          title="Belum Ada Data Terhapus"
          description={emptyStateDescription}
          icon={<Trash2 className="h-5 w-5" />}
        />
      ) : null}

      {deletedRecords.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-xs text-[var(--app-hint-color)]">{deletedRecords.length} item</p>
            <div className="flex items-center gap-2">
              <AppButton
                disabled={cursorHistory.length === 0 || isLoading}
                onClick={handlePreviousPage}
                size="sm"
                type="button"
                variant="secondary"
              >
                Sebelumnya
              </AppButton>
              <AppButton
                disabled={!pageInfo?.hasMore || isLoading}
                onClick={handleNextPage}
                size="sm"
                type="button"
                variant="secondary"
              >
                Berikutnya
              </AppButton>
            </div>
          </div>

          {deletedRecords.map((record) => {
            const presentation = getTransactionPresentation(record)
            const Icon = presentation.Icon
            const amount = Math.abs(Number(record.amount ?? 0))

            return (
              <AppCardStrong
                key={`${record.sourceType ?? 'record'}:${record.id}`}
                className="px-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <button
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => handleOpenRecord(record)}
                    type="button"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${presentation.iconClassName}`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                        {getRecordTitle(record)}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--app-hint-color)]">
                        {formatTransactionDateTime(
                          record.deleted_at ||
                            record.transaction_date ||
                            record.created_at ||
                            record.updated_at
                        )}
                      </p>
                      <p className="mt-1 text-xs text-[var(--app-hint-color)]">
                        {getRecordSourceLabel(record)}
                      </p>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    {presentation.showAmount ? (
                      <span className={`text-sm font-semibold ${presentation.amountClassName}`}>
                        {presentation.amountPrefix ?? (record.type === 'expense' ? '-' : '+')}
                        {formatCurrency(amount)}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[var(--app-surface-low-color)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                        Lampiran
                      </span>
                    )}
                    <button
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)]"
                      onClick={() => {
                        setActionError(null)
                        setSelectedRecord(record)
                      }}
                      type="button"
                      aria-label={`Buka menu aksi untuk ${getRecordTitle(record)}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </AppCardStrong>
            )
          })}
        </div>
      ) : null}

      <AppSheet
        open={Boolean(selectedRecord)}
        onClose={() => setSelectedRecord(null)}
        title="Aksi Halaman Sampah"
        description={selectedRecord ? getRecordTitle(selectedRecord) : null}
      >
        {selectedRecord ? (
          <div className="space-y-3">
            <AppButton
              onClick={() => handleRestore(selectedRecord)}
              type="button"
              variant="secondary"
              leadingIcon={<RotateCcw className="h-4 w-4" />}
            >
              Restore
            </AppButton>
            {selectedRecord.detailRoute ? (
              <AppButton
                onClick={() => handleOpenRecord(selectedRecord)}
                type="button"
                variant="primary"
              >
                Buka Detail
              </AppButton>
            ) : null}
            {selectedRecord.canPermanentDelete ? (
              <AppButton
                onClick={() => handlePermanentDelete(selectedRecord)}
                type="button"
                variant="danger"
              >
                Hapus Permanen
              </AppButton>
            ) : null}
          </div>
        ) : null}
      </AppSheet>
    </PageShell>
  )
}

export default TransactionsRecycleBinPage
