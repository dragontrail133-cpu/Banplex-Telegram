import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import FormLayout from '../components/layouts/FormLayout'
import { AppButton, AppNominalInput } from '../components/ui/AppPrimitives'
import { buildLoanLateChargeSummary } from '../lib/loan-business'
import useAuthStore from '../store/useAuthStore'
import useBillStore from '../store/useBillStore'
import useIncomeStore from '../store/useIncomeStore'
import usePaymentStore from '../store/usePaymentStore'
import {
  formatAppPaymentDateLabel,
  getAppTodayKey,
} from '../lib/date-time'
import { formatPayrollSettlementLabel } from '../lib/transaction-presentation'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function getUserDisplayName(user, authUser) {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()

  if (fullName) {
    return fullName
  }

  if (user?.username) {
    return `@${user.username}`
  }

  if (authUser?.name) {
    return authUser.name
  }

  if (authUser?.telegram_user_id) {
    return authUser.telegram_user_id
  }

  return 'Pengguna Telegram'
}

function formatCurrency(value) {
  const amount = Number(value)

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function formatPaymentDate(value) {
  return formatAppPaymentDateLabel(value)
}

function getRemainingAmount(record) {
  const amount = Number(record?.remainingAmount ?? record?.remaining_amount)

  return Number.isFinite(amount) ? amount : 0
}

function createInitialForm(record) {
  return {
    amount: getRemainingAmount(record) > 0 ? String(getRemainingAmount(record)) : '',
    paymentDate: getAppTodayKey(),
    notes: '',
  }
}

function getContextLabel(record, isLoanPayment) {
  if (!record) {
    return isLoanPayment ? 'Pinjaman' : 'Tagihan'
  }

  if (isLoanPayment) {
    return record.creditor_name_snapshot || 'Kreditur'
  }

  if (isPayrollBillRecord(record)) {
    return record.worker_name_snapshot || record.description || 'Tagihan Upah'
  }

  return record.supplierName || 'Tagihan'
}

function isPayrollBillRecord(record) {
  return (
    String(record?.billType ?? record?.bill_type ?? '')
      .trim()
      .toLowerCase() === 'gaji'
  )
}

function PaymentPage({ paymentType = 'bill' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const fetchBillById = useBillStore((state) => state.fetchBillById)
  const softDeleteBill = useBillStore((state) => state.softDeleteBill)
  const fetchLoanById = useIncomeStore((state) => state.fetchLoanById)
  const [record, setRecord] = useState(null)
  const [detailError, setDetailError] = useState(null)
  const [isLoadingRecord, setIsLoadingRecord] = useState(true)
  const [formData, setFormData] = useState(() => createInitialForm(null))
  const [editingPaymentId, setEditingPaymentId] = useState(null)
  const submitBillPayment = usePaymentStore((state) => state.submitBillPayment)
  const updateBillPayment = usePaymentStore((state) => state.updateBillPayment)
  const deleteBillPayment = usePaymentStore((state) => state.deleteBillPayment)
  const submitLoanPayment = usePaymentStore((state) => state.submitLoanPayment)
  const updateLoanPayment = usePaymentStore((state) => state.updateLoanPayment)
  const deleteLoanPayment = usePaymentStore((state) => state.deleteLoanPayment)
  const isSubmitting = usePaymentStore((state) => state.isSubmitting)
  const error = usePaymentStore((state) => state.error)
  const clearError = usePaymentStore((state) => state.clearError)
  const isLoanPayment = paymentType === 'loan'
  const paymentSurface = useMemo(() => {
    const locationState = location.state ?? {}
    const stateSurface = String(
      locationState.surface ?? locationState.detailSurface ?? ''
    ).trim().toLowerCase()

    if (stateSurface) {
      return stateSurface
    }

    const pathname = String(location.pathname ?? '').toLowerCase()

    if (pathname.startsWith('/tagihan')) {
      return 'tagihan'
    }

    if (pathname.startsWith('/pembayaran')) {
      return 'pembayaran'
    }

    return ''
  }, [location.pathname, location.state])
  const returnTo = useMemo(() => {
    const locationState = location.state ?? {}
    const normalizedReturnTo = String(locationState.returnTo ?? '').trim()

    return normalizedReturnTo.length > 0 ? normalizedReturnTo : null
  }, [location.state])
  const isTagihanSurface = paymentSurface === 'tagihan'
  const isPayrollBill = !isLoanPayment && isPayrollBillRecord(record)
  const pageTitle = isLoanPayment
    ? 'Pembayaran Pinjaman'
    : isTagihanSurface
      ? isPayrollBill
        ? 'Tagihan Upah'
        : 'Tagihan'
      : isPayrollBill
      ? 'Pembayaran Tagihan Upah'
      : 'Pembayaran Tagihan'
  const entityLabel = isLoanPayment ? 'pinjaman' : isPayrollBill ? 'tagihan upah' : 'tagihan'
  const formId = 'payment-form'
  const userName = getUserDisplayName(null, authUser)
  const backRoute =
    returnTo ??
    (paymentSurface === 'tagihan'
      ? '/tagihan'
      : paymentSurface === 'pembayaran'
        ? '/pembayaran'
        : null)
  const billPayments = useMemo(() => {
    if (!record || isLoanPayment) {
      return []
    }

    return [...(Array.isArray(record.payments) ? record.payments : [])].sort((left, right) => {
      const rightTimestamp = new Date(String(right.paymentDate ?? right.createdAt ?? '')).getTime()
      const leftTimestamp = new Date(String(left.paymentDate ?? left.createdAt ?? '')).getTime()

    return rightTimestamp - leftTimestamp
    })
  }, [isLoanPayment, record])
  const loanPayments = useMemo(() => {
    if (!record || !isLoanPayment) {
      return []
    }

    return [...(Array.isArray(record.payments) ? record.payments : [])].sort((left, right) => {
      const rightTimestamp = new Date(String(right.paymentDate ?? right.createdAt ?? '')).getTime()
      const leftTimestamp = new Date(String(left.paymentDate ?? left.createdAt ?? '')).getTime()

      return rightTimestamp - leftTimestamp
    })
  }, [isLoanPayment, record])
  const loanLateChargeSummary = useMemo(() => {
    if (!record || !isLoanPayment) {
      return null
    }

    return (
      record.late_charge_summary ??
      record.lateChargeSummary ??
      buildLoanLateChargeSummary(record)
    )
  }, [isLoanPayment, record])
  const remainingAmount = getRemainingAmount(record)
  const totalAmount = Number(
    isLoanPayment ? record?.repayment_amount : record?.amount
  ) || 0
  const paidAmount = Number(
    isLoanPayment ? record?.paid_amount : record?.paidAmount
  ) || 0
  const contextLabel = useMemo(
    () => getContextLabel(record, isLoanPayment),
    [record, isLoanPayment]
  )
  const editingPayment = useMemo(() => {
    if (isLoanPayment || !editingPaymentId) {
      return null
    }

    return billPayments.find((payment) => String(payment.id ?? '') === String(editingPaymentId)) ?? null
  }, [billPayments, editingPaymentId, isLoanPayment])
  const editingLoanPayment = useMemo(() => {
    if (!isLoanPayment || !editingPaymentId) {
      return null
    }

    return loanPayments.find((payment) => String(payment.id ?? '') === String(editingPaymentId)) ?? null
  }, [editingPaymentId, isLoanPayment, loanPayments])
  const combinedError = error ?? detailError
  const canDeleteBill = !isLoanPayment && Boolean(record)
  const statusLabel = isLoanPayment ? record?.status ?? 'unpaid' : record?.status ?? 'unpaid'
  const displayStatusLabel =
    isPayrollBill && !isLoanPayment
      ? formatPayrollSettlementLabel(statusLabel)
      : String(statusLabel ?? 'unpaid').toUpperCase()
  const activeEditingPayment = editingPayment ?? editingLoanPayment
  const statusToneClassName =
    String(statusLabel).toLowerCase() === 'paid'
      ? 'bg-[var(--app-tone-success-bg)] text-[var(--app-tone-success-text)]'
      : String(statusLabel).toLowerCase() === 'partial'
        ? 'bg-[var(--app-tone-warning-bg)] text-[var(--app-tone-warning-text)]'
        : 'bg-[var(--app-tone-neutral-bg)] text-[var(--app-tone-neutral-text)]'

  const reloadRecord = useCallback(async () => {
    setIsLoadingRecord(true)
    setDetailError(null)

    try {
      const nextRecord = isLoanPayment
        ? await fetchLoanById(id)
        : await fetchBillById(id)

      setRecord(nextRecord)
      setFormData(createInitialForm(nextRecord))
      setEditingPaymentId(null)
      return nextRecord
    } catch (loadError) {
      console.error(`Gagal memuat detail ${entityLabel}:`, loadError)
      setRecord(null)
      setDetailError(
        loadError instanceof Error ? loadError.message : `Gagal memuat detail ${entityLabel}.`
      )
      return null
    } finally {
      setIsLoadingRecord(false)
    }
  }, [entityLabel, fetchBillById, fetchLoanById, id, isLoanPayment])

  useEffect(() => {
    void reloadRecord()
  }, [reloadRecord])

  useEffect(() => () => clearError(), [clearError])

  const handleBack = () => {
    if (backRoute) {
      navigate(backRoute)
      return
    }

    navigate(-1)
  }

  const handleDeleteBill = async () => {
    if (isLoanPayment || !record || !canDeleteBill) {
      return
    }

    const hasPaymentHistory = billPayments.length > 0 || paidAmount > 0
    const confirmationMessage = hasPaymentHistory
      ? `Arsipkan tagihan ${contextLabel}? Riwayat pembayaran ikut masuk Halaman Sampah.`
      : `Arsipkan tagihan ${contextLabel}?`

    const shouldDelete = window.confirm(confirmationMessage)

    if (!shouldDelete) {
      return
    }

    try {
      setDetailError(null)
      await softDeleteBill(record.id, record.updated_at ?? record.updatedAt ?? null)
      navigate('/transactions/recycle-bin', { replace: true })
    } catch (deleteError) {
      setDetailError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Gagal mengarsipkan tagihan.'
      )
    }
  }

  const handleStartEditPayment = (payment) => {
    if (isLoanPayment || !payment) {
      return
    }

    clearError()
    setDetailError(null)
    setEditingPaymentId(payment.id)
    setFormData({
      amount: String(payment.amount ?? ''),
      paymentDate: payment.paymentDate ?? getAppTodayKey(),
      notes: payment.notes ?? '',
    })
  }

  const handleCancelEditPayment = () => {
    clearError()
    setDetailError(null)
    setEditingPaymentId(null)
    setFormData(createInitialForm(record))
  }

  const handleStartEditLoanPayment = (payment) => {
    if (!isLoanPayment || !payment) {
      return
    }

    clearError()
    setDetailError(null)
    setEditingPaymentId(payment.id)
    setFormData({
      amount: String(payment.amount ?? ''),
      paymentDate: payment.paymentDate ?? getAppTodayKey(),
      notes: payment.notes ?? '',
    })
  }

  const handleCancelEditLoanPayment = () => {
    clearError()
    setDetailError(null)
    setEditingPaymentId(null)
    setFormData(createInitialForm(record))
  }

  const handleDeletePayment = async (payment) => {
    if (isLoanPayment || !payment) {
      return
    }

    const shouldDelete = window.confirm(
      `Arsipkan pembayaran ${formatCurrency(payment.amount)}?`
    )

    if (!shouldDelete) {
      return
    }

    try {
      setDetailError(null)
      await deleteBillPayment({
        paymentId: payment.id,
        teamId: currentTeamId ?? record?.teamId,
        expectedUpdatedAt: payment.updatedAt ?? payment.updated_at ?? null,
      })
      setEditingPaymentId(null)
      await reloadRecord()
    } catch (deleteError) {
      setDetailError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Gagal mengarsipkan pembayaran tagihan.'
      )
    }
  }

  const handleDeleteLoanPayment = async (payment) => {
    if (!isLoanPayment || !payment) {
      return
    }

    const shouldDelete = window.confirm(
      `Arsipkan pembayaran ${formatCurrency(payment.amount)}?`
    )

    if (!shouldDelete) {
      return
    }

    try {
      setDetailError(null)
      await deleteLoanPayment({
        paymentId: payment.id,
        teamId: currentTeamId ?? record?.team_id,
        expectedUpdatedAt: payment.updatedAt ?? payment.updated_at ?? null,
      })
      setEditingPaymentId(null)
      await reloadRecord()
    } catch (deleteError) {
      setDetailError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Gagal mengarsipkan pembayaran pinjaman.'
      )
    }
  }

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))

    if (combinedError) {
      clearError()
      setDetailError(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!record || isSubmitting) {
      return
    }

    try {
      if (isLoanPayment) {
        if (editingLoanPayment) {
          await updateLoanPayment({
            paymentId: editingLoanPayment.id,
            loan_id: record.id,
            team_id: currentTeamId ?? record.team_id,
            amount: formData.amount,
            payment_date: formData.paymentDate,
            notes: formData.notes,
            expectedUpdatedAt:
              editingLoanPayment.updatedAt ?? editingLoanPayment.updated_at ?? null,
          })
          setEditingPaymentId(null)
        } else {
          await submitLoanPayment({
            loan_id: record.id,
            telegram_user_id: authUser?.telegram_user_id ?? null,
            userName,
            team_id: currentTeamId ?? record.team_id,
            amount: formData.amount,
            maxAmount: remainingAmount,
            payment_date: formData.paymentDate,
            notes: formData.notes,
            creditorName: record.creditor_name_snapshot,
            remainingAmount: Math.max(
              remainingAmount - Number(formData.amount ?? 0),
              0
            ),
          })
        }
      } else {
        if (editingPayment) {
          await updateBillPayment({
            paymentId: editingPayment.id,
            bill_id: record.id,
            team_id: currentTeamId ?? record.teamId,
            amount: formData.amount,
            payment_date: formData.paymentDate,
            notes: formData.notes,
            expectedUpdatedAt: editingPayment.updatedAt ?? editingPayment.updated_at ?? null,
          })
          setEditingPaymentId(null)
        } else {
          await submitBillPayment({
            bill_id: record.id,
            telegram_user_id: authUser?.telegram_user_id ?? null,
            userName,
            team_id: currentTeamId ?? record.teamId,
            amount: formData.amount,
            maxAmount: remainingAmount,
            payment_date: formData.paymentDate,
            notes: formData.notes,
            supplierName: record.supplierName,
            projectName: record.projectName,
            remainingAmount: Math.max(
              remainingAmount - Number(formData.amount ?? 0),
              0
            ),
          })
        }
      }

      await reloadRecord()
    } catch (submitError) {
      console.error('Gagal menyimpan pembayaran:', submitError)
    }
  }

  return (
    <FormLayout
      actionLabel={activeEditingPayment ? 'Simpan Perubahan' : 'Simpan Pembayaran'}
      formId={record ? formId : null}
      isSubmitting={isSubmitting}
      onBack={handleBack}
      submitDisabled={!record || isLoadingRecord}
      title={pageTitle}
    >
      {isLoadingRecord ? (
        <div className="space-y-4 px-4 py-6">
          <div className="h-6 w-3/4 animate-pulse rounded-full bg-[var(--app-border-color)]" />
          <div className="h-4 w-1/2 animate-pulse rounded-full bg-[var(--app-border-color)]" />
          
          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-[var(--app-border-color)]" />
            ))}
          </div>
        </div>
      ) : record ? (
        <div className="space-y-4">
          <section className="app-card px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="app-kicker">
                  {isLoanPayment
                    ? 'Pinjaman Aktif'
                    : isPayrollBill
                      ? 'Tagihan Upah'
                      : record.billType || 'Tagihan'}
                </p>
                <h2 className="app-title">{contextLabel}</h2>
                <p className="app-copy">
                  {isLoanPayment
                    ? `Status ${record.status ?? 'unpaid'}`
                    : record.projectName || 'Tanpa proyek terkait'}
                </p>
              </div>
              <div className="rounded-full bg-[var(--app-tone-neutral-bg)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-tone-neutral-text)]">
                #{String(id ?? '').slice(0, 8)}
              </div>
            </div>

            {isLoanPayment ? (
              <div className="mt-4 rounded-[22px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="app-kicker">Tunggakan</p>
                    <h3 className="app-section-title">Denda berjalan</h3>
                  </div>
                  <span className="app-chip">Otomatis</span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="app-card rounded-[22px] px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                      Jatuh Tempo
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                      {formatPaymentDate(loanLateChargeSummary?.dueDate ?? record?.due_date)}
                    </p>
                  </div>
                  <div className="app-card rounded-[22px] px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                      Overdue
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                      {loanLateChargeSummary?.overdueMonths > 0
                        ? `${loanLateChargeSummary.overdueMonths} bulan`
                        : 'Belum lewat tempo'}
                    </p>
                  </div>
                  <div className="app-card rounded-[22px] px-3 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                      Estimasi Denda
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                      {formatCurrency(loanLateChargeSummary?.totalLateChargeAmount ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {isLoanPayment ? null : (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusToneClassName}`}>
                  {displayStatusLabel}
                </span>
                <span className="app-chip">Jatuh tempo {formatPaymentDate(record?.dueDate)}</span>
                <span className="app-chip">{billPayments.length} pembayaran</span>
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="app-card rounded-[22px] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                  Total
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                  {formatCurrency(totalAmount)}
                </p>
              </div>

              <div className="app-card rounded-[22px] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                  Terbayar
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                  {formatCurrency(paidAmount)}
                </p>
              </div>

              <div className="app-tone-warning rounded-[22px] px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-current">
                  Sisa
                </p>
                <p className="mt-2 text-sm font-semibold text-current">
                  {formatCurrency(remainingAmount)}
                </p>
              </div>
            </div>

            {isLoanPayment ? null : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="app-card rounded-[22px] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    {isPayrollBill ? 'Pekerja' : 'Supplier'}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                    {isPayrollBill
                      ? record?.worker_name_snapshot || record?.supplierName || 'Tagihan Upah'
                      : record?.supplierName || 'Supplier belum terhubung'}
                  </p>
                </div>
                <div className="app-card rounded-[22px] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    Proyek
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                    {record?.projectName || 'Proyek belum terhubung'}
                  </p>
                </div>
                <div className="app-card rounded-[22px] px-3 py-3 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    {isPayrollBill ? 'Deskripsi Tagihan Upah' : 'Deskripsi'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--app-text-color)]">
                    {record?.description || 'Tanpa deskripsi'}
                  </p>
                </div>
              </div>
            )}
          </section>

          {isLoanPayment ? (
            <section className="app-card px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="app-kicker">Histori Pembayaran</p>
                  <h3 className="app-section-title">Riwayat pinjaman</h3>
                </div>
                <span className="app-chip">{loanPayments.length} item</span>
              </div>

              {loanPayments.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {loanPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className={`rounded-[20px] border px-4 py-3 ${
                        editingLoanPayment?.id === payment.id
                          ? 'border-[var(--app-brand-accent)] bg-[var(--app-brand-accent-muted)]'
                          : 'border-[var(--app-border-color)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--app-text-color)]">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                            {formatPaymentDate(payment.paymentDate)} · {payment.notes || 'Tanpa catatan'}
                          </p>
                        </div>
                        <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-hint-color)]">
                          {formatPaymentDate(payment.createdAt)}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <AppButton
                          onClick={() => handleStartEditLoanPayment(payment)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Edit
                        </AppButton>
                        <AppButton
                          onClick={() => void handleDeleteLoanPayment(payment)}
                          size="sm"
                          type="button"
                          variant="danger"
                        >
                          Arsipkan
                        </AppButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="app-card-dashed mt-4 px-4 py-5 text-sm text-[var(--app-hint-color)]">
                  Belum ada pembayaran untuk pinjaman ini.
                </div>
              )}
            </section>
          ) : null}

          {!isLoanPayment ? (
            <section className="app-card px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="app-kicker">Histori Pembayaran</p>
                  <h3 className="app-section-title">
                    {isPayrollBill ? 'Riwayat Tagihan Upah' : 'Riwayat bill'}
                  </h3>
                </div>
                <span className="app-chip">{billPayments.length} item</span>
              </div>

              {billPayments.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {billPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className={`rounded-[20px] border px-4 py-3 ${
                        editingPayment?.id === payment.id
                          ? 'border-[var(--app-brand-accent)] bg-[var(--app-brand-accent-muted)]'
                          : 'border-[var(--app-border-color)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--app-text-color)]">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                            {formatPaymentDate(payment.paymentDate)} · {payment.notes || 'Tanpa catatan'}
                          </p>
                        </div>
                        <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--app-hint-color)]">
                          {formatPaymentDate(payment.createdAt)}
                        </p>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <AppButton
                          onClick={() => handleStartEditPayment(payment)}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Edit
                        </AppButton>
                        <AppButton
                          onClick={() => void handleDeletePayment(payment)}
                          size="sm"
                          type="button"
                          variant="danger"
                        >
                          Arsipkan
                        </AppButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="app-card-dashed mt-4 px-4 py-5 text-sm text-[var(--app-hint-color)]">
                  {isPayrollBill
                    ? 'Belum ada pembayaran untuk tagihan upah ini.'
                    : 'Belum ada pembayaran untuk tagihan ini.'}
                </div>
              )}
            </section>
          ) : null}

          {isLoanPayment ? (
            editingLoanPayment ? (
              <div className="app-card rounded-[20px] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                      Mode Edit Pembayaran
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[var(--app-text-color)]">
                      {formatCurrency(editingLoanPayment.amount)} · {formatPaymentDate(editingLoanPayment.paymentDate)}
                    </p>
                  </div>
                  <AppButton
                    onClick={handleCancelEditLoanPayment}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Batal
                  </AppButton>
                </div>
              </div>
            ) : null
          ) : editingPayment ? (
            <div className="app-card rounded-[20px] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    Mode Edit Pembayaran
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--app-text-color)]">
                    {formatCurrency(editingPayment.amount)} · {formatPaymentDate(editingPayment.paymentDate)}
                  </p>
                </div>
                <AppButton
                  onClick={handleCancelEditPayment}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  Batal
                </AppButton>
              </div>
            </div>
          ) : null}

          {!isLoanPayment ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <AppButton
                disabled={!canDeleteBill}
                onClick={handleDeleteBill}
                type="button"
                variant="danger"
              >
                {isPayrollBill ? 'Arsipkan Tagihan Upah' : 'Arsipkan Tagihan'}
              </AppButton>
              <AppButton onClick={handleBack} type="button" variant="secondary">
                Kembali
              </AppButton>
            </div>
          ) : null}

          <form id={formId} className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                Nominal Pembayaran
              </span>
              <AppNominalInput
                className="app-input w-full rounded-[20px] px-4 py-4 text-xl font-bold"
                max={remainingAmount}
                name="amount"
                onValueChange={(nextValue) =>
                  handleChange({
                    target: {
                      name: 'amount',
                      value: nextValue,
                    },
                  })
                }
                required
                value={formData.amount}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                  Tanggal Pembayaran
                </span>
                <input
                  className="app-input w-full rounded-[20px] px-4 py-3.5 text-base"
                  name="paymentDate"
                  onChange={handleChange}
                  required
                  type="date"
                  value={formData.paymentDate}
                />
              </label>

              <div className="app-card rounded-[20px] px-4 py-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                  Ringkasan
                </p>
                <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                  {isLoanPayment
                    ? 'Pembayaran cicilan pinjaman'
                    : isPayrollBill
                      ? 'Pembayaran tagihan upah'
                      : 'Pembayaran tagihan operasional'}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                  Pembayaran parsial didukung. Nominal tersisa dihitung ulang otomatis.
                </p>
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                Catatan
              </span>
              <textarea
                className="app-input min-h-28 w-full resize-none rounded-[20px] px-4 py-3 text-base"
                name="notes"
                onChange={handleChange}
                placeholder="Tambahkan catatan pembayaran jika perlu"
                value={formData.notes}
              />
            </label>
          </form>

          {combinedError ? (
            <div className="app-tone-danger rounded-[20px] px-4 py-3 text-sm">
              {combinedError}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="app-card-dashed px-4 py-5 text-sm text-[var(--app-hint-color)]">
          {isLoanPayment ? 'Pinjaman tidak ditemukan.' : 'Tagihan tidak ditemukan.'}
        </div>
      )}
    </FormLayout>
  )
}

export default PaymentPage




