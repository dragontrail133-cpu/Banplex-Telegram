import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  FileText,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  AppButton,
  AppCardDashed,
  AppCardStrong,
  PageHeader,
  PageShell,
} from '../components/ui/AppPrimitives'
import {
  formatCurrency,
  getBillGroupPaymentTarget,
  getBillSummaryAmount,
  getBillSummarySubtitle,
  getBillSummaryTitle,
  getTransactionPaymentRoute,
  groupBillsForBillList,
} from '../lib/transaction-presentation'
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

function BillRowButton({ bill, onOpenBill }) {
  const amount = getBillSummaryAmount(bill)

  return (
    <button
      className="flex w-full items-center gap-3 rounded-2xl bg-[var(--app-surface-low-color)] px-3 py-3 text-left transition active:bg-[color-mix(in_srgb,var(--app-surface-low-color)_85%,var(--app-bg-color))]"
      onClick={() => onOpenBill(bill)}
      type="button"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--app-tone-warning-bg)] text-[var(--app-tone-warning-text)]">
        <FileText className="h-[18px] w-[18px]" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
          {getBillSummaryTitle(bill)}
        </p>
        <p className="mt-0.5 text-xs text-[var(--app-hint-color)]">
          {getBillSummarySubtitle(bill)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold text-[var(--app-text-color)]">
          {formatCurrency(amount)}
        </span>
        <ChevronRight className="h-4 w-4 text-[var(--app-hint-color)]" />
      </div>
    </button>
  )
}

function BillGroupCard({ group, onOpenGroup }) {
  return (
    <AppCardStrong className="px-4 py-4">
      <button
        className="flex w-full items-center gap-3 text-left"
        onClick={() => onOpenGroup(group)}
        type="button"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-low-color)] text-[var(--app-text-color)]">
          <FileText className="h-[18px] w-[18px]" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
            {group.workerName}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold text-[var(--app-text-color)]">
            {formatCurrency(group.amount)}
          </span>
          <ChevronRight className="h-4 w-4 text-[var(--app-hint-color)]" />
        </div>
      </button>
    </AppCardStrong>
  )
}

function BillsPage({ embedded = false } = {}) {
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
      const rightTimestamp = new Date(
        String(right.dueDate ?? right.created_at ?? right.updated_at ?? '')
      ).getTime()
      const leftTimestamp = new Date(
        String(left.dueDate ?? left.created_at ?? left.updated_at ?? '')
      ).getTime()

      if (leftTimestamp !== rightTimestamp) {
        return leftTimestamp - rightTimestamp
      }

      const rightCreatedAt = new Date(String(right.created_at ?? right.updated_at ?? '')).getTime()
      const leftCreatedAt = new Date(String(left.created_at ?? left.updated_at ?? '')).getTime()

      if (leftCreatedAt !== rightCreatedAt) {
        return leftCreatedAt - rightCreatedAt
      }

      return String(left.id ?? '').localeCompare(String(right.id ?? ''))
    })
  }, [bills])

  const displayBills = useMemo(() => {
    return groupBillsForBillList(sortedBills)
  }, [sortedBills])

  const handleOpenBillGroup = useCallback(
    (group) => {
      if (!group?.groupKey) {
        return
      }

      persistTagihanListState()

      if (group.kind === 'staff-group') {
        const paymentTarget = getBillGroupPaymentTarget(group)
        const paymentRoute = getTransactionPaymentRoute(paymentTarget)

        if (!paymentRoute) {
          return
        }

        navigate(paymentRoute, {
          state: {
            transaction: paymentTarget,
            returnTo: embedded ? '/transactions?tab=tagihan' : '/pembayaran',
            returnToOnSuccess: true,
          },
        })
        return
      }

      navigate(`/pembayaran?group=${encodeURIComponent(group.groupKey)}`, {
        state: {
          returnTo: embedded ? '/transactions?tab=tagihan' : '/pembayaran',
        },
      })
    },
    [embedded, navigate, persistTagihanListState]
  )

  const handleOpenBill = useCallback(
    (bill) => {
      const paymentRoute = getTransactionPaymentRoute(bill)

      if (!paymentRoute) {
        return
      }

      persistTagihanListState()

      navigate(paymentRoute, {
        state: {
          transaction: bill,
          returnTo: embedded ? '/transactions?tab=tagihan' : '/pembayaran',
        },
      })
    },
    [embedded, navigate, persistTagihanListState]
  )

  const Shell = embedded ? 'div' : PageShell

  return (
    <Shell className={embedded ? 'space-y-4' : undefined}>
      {embedded ? null : (
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
      )}

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
      ) : displayBills.length === 0 ? (
        <AppCardDashed className="px-4 py-5">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Belum Ada Tagihan
          </p>
        </AppCardDashed>
      ) : (
        <div className="space-y-3">
          {displayBills.map((item) => {
            if (item.kind === 'worker-group' || item.kind === 'staff-group') {
              return (
                <BillGroupCard
                  key={item.groupKey}
                  group={item}
                  onOpenGroup={handleOpenBillGroup}
                />
              )
            }

            return (
              <AppCardStrong key={item.bill.id} className="px-4 py-4">
                <BillRowButton bill={item.bill} onOpenBill={handleOpenBill} />
              </AppCardStrong>
            )
          })}
        </div>
      )}
    </Shell>
  )
}

export default BillsPage
