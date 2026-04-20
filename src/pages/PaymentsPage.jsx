import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ArrowDownLeft, ArrowUpRight, ArrowLeft, ChevronRight } from 'lucide-react'
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
  formatTransactionDateTime,
  getTransactionSourceLabel,
  getTransactionTitle,
} from '../lib/transaction-presentation'
import useAuthStore from '../store/useAuthStore'
import useBillStore from '../store/useBillStore'
import useDashboardStore from '../store/useDashboardStore'
import useIncomeStore from '../store/useIncomeStore'

const pembayaranListStateStorageKey = 'banplex:pembayaran-list-state'

function readPembayaranListState(teamId) {
  if (!teamId || typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.sessionStorage.getItem(pembayaranListStateStorageKey)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (parsedValue?.teamId !== teamId) {
      return null
    }

    return parsedValue
  } catch (error) {
    console.error('Gagal membaca state Pembayaran:', error)
    return null
  }
}

function savePembayaranListState(teamId, state) {
  if (!teamId || typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(
      pembayaranListStateStorageKey,
      JSON.stringify({
        teamId,
        ...state,
      })
    )
  } catch (error) {
    console.error('Gagal menyimpan state Pembayaran:', error)
  }
}

function PaymentsPage() {
  const navigate = useNavigate()
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const restoredPembayaranState = useMemo(
    () => readPembayaranListState(currentTeamId),
    [currentTeamId]
  )
  const savedScrollPositionRef = useRef(Number(restoredPembayaranState?.scrollY ?? 0))
  const workspaceTransactions = useDashboardStore((state) => state.workspaceTransactions)
  const fetchWorkspaceTransactions = useDashboardStore(
    (state) => state.fetchWorkspaceTransactions
  )
  const bills = useBillStore((state) => state.bills)
  const isBillsLoading = useBillStore((state) => state.isLoading)
  const billsError = useBillStore((state) => state.error)
  const fetchUnpaidBills = useBillStore((state) => state.fetchUnpaidBills)
  const loans = useIncomeStore((state) => state.loans)
  const isLoansLoading = useIncomeStore((state) => state.isLoadingLoans)
  const loansError = useIncomeStore((state) => state.error)
  const fetchLoans = useIncomeStore((state) => state.fetchLoans)
  const workspaceError = useDashboardStore((state) => state.workspaceError)
  const isWorkspaceLoading = useDashboardStore((state) => state.isWorkspaceLoading)

  const refreshPayments = useCallback(async () => {
    if (!currentTeamId) {
      return
    }

    await Promise.all([
      fetchWorkspaceTransactions(currentTeamId, { silent: true }),
      fetchUnpaidBills({ teamId: currentTeamId, silent: true }),
      fetchLoans({ teamId: currentTeamId }),
    ])
  }, [currentTeamId, fetchLoans, fetchUnpaidBills, fetchWorkspaceTransactions])

  useEffect(() => {
    void refreshPayments()
  }, [refreshPayments])

  const paymentHistoryRows = useMemo(() => {
    return workspaceTransactions
      .filter((transaction) =>
        ['bill-payment', 'loan-payment'].includes(String(transaction?.sourceType ?? ''))
      )
      .slice()
      .sort((left, right) => {
        const rightTimestamp = new Date(
          String(right.transaction_date ?? right.created_at ?? '')
        ).getTime()
        const leftTimestamp = new Date(
          String(left.transaction_date ?? left.created_at ?? '')
        ).getTime()

        return rightTimestamp - leftTimestamp
      })
      .slice(0, 10)
  }, [workspaceTransactions])

  const activeLoans = useMemo(() => {
    return loans.filter((loan) => Number(loan.remaining_amount ?? 0) > 0)
  }, [loans])

  const isLoading =
    Boolean(currentTeamId) && (isWorkspaceLoading || isBillsLoading || isLoansLoading)
  const combinedError = [workspaceError, billsError, loansError]
    .filter((message, index, list) => Boolean(message) && list.indexOf(message) === index)
    .join(' | ')
  const showSkeleton =
    isLoading && paymentHistoryRows.length === 0 && bills.length === 0 && activeLoans.length === 0

  const persistPembayaranListState = useCallback(() => {
    if (!currentTeamId || typeof window === 'undefined') {
      return
    }

    savedScrollPositionRef.current = window.scrollY

    savePembayaranListState(currentTeamId, {
      scrollY: savedScrollPositionRef.current,
    })
  }, [currentTeamId])

  useEffect(() => {
    if (!restoredPembayaranState || typeof window === 'undefined') {
      return
    }

    const scrollY = Number(restoredPembayaranState.scrollY ?? 0)

    if (!Number.isFinite(scrollY) || scrollY <= 0) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: 'auto' })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [restoredPembayaranState])

  useEffect(() => {
    return () => {
      persistPembayaranListState()
    }
  }, [persistPembayaranListState])

  const handleOpenBillPayment = (billId) => {
    persistPembayaranListState()

    navigate(`/pembayaran/tagihan/${billId}`, {
      state: {
        surface: 'pembayaran',
      },
    })
  }

  const handleOpenLoanPayment = (loanId) => {
    persistPembayaranListState()

    navigate(`/pembayaran/pinjaman/${loanId}`, {
      state: {
        surface: 'pembayaran',
      },
    })
  }

  return (
    <PageShell>
      <PageHeader
        title="Pembayaran"
        action={
          <AppButton
            onClick={() => {
              persistPembayaranListState()
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

      {combinedError ? (
        <AppCardDashed>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-destructive-color)]">
            Gagal Memuat Pembayaran
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--app-hint-color)]">{combinedError}</p>
        </AppCardDashed>
      ) : null}

      {!currentTeamId ? (
        <AppCardDashed className="px-4 py-5">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">
            Team aktif belum tersedia.
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
      ) : (
        <div className="space-y-4">
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3 px-1">
              <div>
                <p className="app-kicker">Histori</p>
                <h2 className="app-section-title">Aktivitas settlement</h2>
              </div>
            </div>

            {paymentHistoryRows.length === 0 ? (
              <AppCardDashed className="px-4 py-5">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  Belum Ada Riwayat
                </p>
              </AppCardDashed>
            ) : (
              <div className="space-y-3">
                {paymentHistoryRows.map((transaction) => {
                  const isLoanPayment = transaction.sourceType === 'loan-payment'
                  const Icon = isLoanPayment ? ArrowDownLeft : ArrowUpRight

                  return (
                    <AppCardStrong key={transaction.id} className="px-4 py-4">
                      <button
                        className="flex w-full items-center gap-3 text-left"
                        onClick={() => {
                          persistPembayaranListState()
                          navigate(`/transactions/${transaction.id}?surface=pembayaran`, {
                            state: { transaction, detailSurface: 'pembayaran' },
                          })
                        }}
                        type="button"
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-low-color)] text-[var(--app-text-color)]">
                          <Icon className="h-[18px] w-[18px]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                            {getTransactionTitle(transaction)}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--app-hint-color)]">
                            {getTransactionSourceLabel(transaction)}
                          </p>
                          <p className="mt-1 text-xs text-[var(--app-hint-color)]">
                            {formatTransactionDateTime(
                              transaction.transaction_date || transaction.created_at
                            )}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--app-text-color)]">
                            {formatCurrency(Math.abs(Number(transaction.amount ?? 0)))}
                          </span>
                          <ChevronRight className="h-4 w-4 text-[var(--app-hint-color)]" />
                        </div>
                      </button>
                    </AppCardStrong>
                  )
                })}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3 px-1">
              <div>
                <p className="app-kicker">Aksi Settlement</p>
                <h2 className="app-section-title">Tagihan</h2>
              </div>
            </div>

            {bills.length === 0 ? (
              <AppCardDashed className="px-4 py-5">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  Belum Ada Tagihan
                </p>
              </AppCardDashed>
            ) : (
              <div className="space-y-3">
                {bills.map((bill) => (
                  <AppCardStrong key={bill.id} className="px-4 py-4">
                    <button
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => handleOpenBillPayment(bill.id)}
                      type="button"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-tone-warning-bg)] text-[var(--app-tone-warning-text)]">
                        <ArrowUpRight className="h-[18px] w-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                          {bill.supplierName || bill.description || 'Tagihan'}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--app-hint-color)]">
                          {bill.projectName || formatTransactionDateTime(bill.dueDate ?? bill.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--app-text-color)]">
                          {formatCurrency(Number(bill.remainingAmount ?? bill.amount ?? 0))}
                        </span>
                        <ChevronRight className="h-4 w-4 text-[var(--app-hint-color)]" />
                      </div>
                    </button>
                  </AppCardStrong>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3 px-1">
              <div>
                <p className="app-kicker">Aksi Settlement</p>
                <h2 className="app-section-title">Pinjaman</h2>
              </div>
            </div>

            {activeLoans.length === 0 ? (
              <AppCardDashed className="px-4 py-5">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  Belum Ada Pinjaman Aktif
                </p>
              </AppCardDashed>
            ) : (
              <div className="space-y-3">
                {activeLoans.map((loan) => (
                  <AppCardStrong key={loan.id} className="px-4 py-4">
                    <button
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => handleOpenLoanPayment(loan.id)}
                      type="button"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--app-tone-info-bg)] text-[var(--app-tone-info-text)]">
                        <ArrowDownLeft className="h-[18px] w-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                          {loan.creditor_name_snapshot || loan.description || 'Pinjaman'}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--app-hint-color)]">
                          {formatTransactionDateTime(loan.dueDate ?? loan.transaction_date ?? loan.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-semibold text-[var(--app-text-color)]">
                          {formatCurrency(Number(loan.remaining_amount ?? 0))}
                        </span>
                        <ChevronRight className="h-4 w-4 text-[var(--app-hint-color)]" />
                      </div>
                    </button>
                  </AppCardStrong>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PageShell>
  )
}

export default PaymentsPage
