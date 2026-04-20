import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ArrowLeft, ChevronRight, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  AppButton,
  AppCardDashed,
  AppCardStrong,
  PageHeader,
  PageShell,
} from '../components/ui/AppPrimitives'
import { formatCurrency, formatTransactionDateTime } from '../lib/transaction-presentation'
import useAuthStore from '../store/useAuthStore'
import useBillStore from '../store/useBillStore'

const tagihanListStateStorageKey = 'banplex:tagihan-list-state'

function readTagihanListState(teamId) {
  if (!teamId || typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.sessionStorage.getItem(tagihanListStateStorageKey)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (parsedValue?.teamId !== teamId) {
      return null
    }

    return parsedValue
  } catch (error) {
    console.error('Gagal membaca state Tagihan:', error)
    return null
  }
}

function saveTagihanListState(teamId, state) {
  if (!teamId || typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(
      tagihanListStateStorageKey,
      JSON.stringify({
        teamId,
        ...state,
      })
    )
  } catch (error) {
    console.error('Gagal menyimpan state Tagihan:', error)
  }
}

function BillsPage() {
  const navigate = useNavigate()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const restoredTagihanState = useMemo(
    () => readTagihanListState(currentTeamId),
    [currentTeamId]
  )
  const savedScrollPositionRef = useRef(Number(restoredTagihanState?.scrollY ?? 0))
  const bills = useBillStore((state) => state.bills)
  const isLoading = useBillStore((state) => state.isLoading)
  const error = useBillStore((state) => state.error)
  const fetchUnpaidBills = useBillStore((state) => state.fetchUnpaidBills)

  const persistTagihanListState = useCallback(() => {
    if (!currentTeamId || typeof window === 'undefined') {
      return
    }

    savedScrollPositionRef.current = window.scrollY

    saveTagihanListState(currentTeamId, {
      scrollY: savedScrollPositionRef.current,
    })
  }, [currentTeamId])

  useEffect(() => {
    if (!currentTeamId) {
      return
    }

    void fetchUnpaidBills({ teamId: currentTeamId })
  }, [currentTeamId, fetchUnpaidBills])

  useEffect(() => {
    if (!restoredTagihanState || typeof window === 'undefined') {
      return
    }

    const scrollY = Number(restoredTagihanState.scrollY ?? 0)

    if (!Number.isFinite(scrollY) || scrollY <= 0) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'auto' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [restoredTagihanState])

  useEffect(() => {
    return () => {
      persistTagihanListState()
    }
  }, [persistTagihanListState])

  const sortedBills = useMemo(() => {
    return [...bills].sort((left, right) => {
      const rightTimestamp = new Date(String(right.dueDate ?? right.created_at ?? '')).getTime()
      const leftTimestamp = new Date(String(left.dueDate ?? left.created_at ?? '')).getTime()

      return leftTimestamp - rightTimestamp
    })
  }, [bills])

  const handleOpenBill = (bill) => {
    persistTagihanListState()

    navigate(`/tagihan/${bill.id}`, {
      state: {
        surface: 'tagihan',
        detailSurface: 'tagihan',
      },
    })
  }

  return (
    <PageShell>
      <PageHeader
        title="Tagihan"
        action={
          <AppButton
            onClick={() => {
              persistTagihanListState()
              navigate('/transactions')
            }}
            size="sm"
            type="button"
            variant="secondary"
            leadingIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Jurnal
          </AppButton>
        }
      />

      {error ? (
        <AppCardDashed>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
            Gagal Memuat Tagihan
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">{error}</p>
        </AppCardDashed>
      ) : null}

      {!currentTeamId ? (
        <AppCardDashed className="px-4 py-5">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Team aktif belum tersedia.
          </p>
        </AppCardDashed>
      ) : isLoading && sortedBills.length === 0 ? (
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
      ) : sortedBills.length === 0 ? (
        <AppCardDashed className="px-4 py-5">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Belum Ada Tagihan
          </p>
        </AppCardDashed>
      ) : (
        <div className="space-y-3">
          {sortedBills.map((bill) => {
            const amount = Number(bill.remainingAmount ?? bill.amount ?? 0)
            const label = bill.supplierName || bill.description || 'Tagihan'

            return (
              <AppCardStrong key={bill.id} className="px-4 py-4">
                <button
                  className="flex w-full items-center gap-3 text-left"
                  onClick={() => handleOpenBill(bill)}
                  type="button"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-tone-warning-bg)] text-[var(--app-tone-warning-text)]">
                    <FileText className="h-[18px] w-[18px]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                      {label}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--app-hint-color)]">
                      {bill.projectName || formatTransactionDateTime(bill.dueDate ?? bill.created_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--app-text-color)]">
                      {formatCurrency(amount)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-[var(--app-hint-color)]" />
                  </div>
                </button>
              </AppCardStrong>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}

export default BillsPage
