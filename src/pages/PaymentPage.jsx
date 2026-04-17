import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import FormLayout from '../components/layouts/FormLayout'
import useAuthStore from '../store/useAuthStore'
import useBillStore from '../store/useBillStore'
import useIncomeStore from '../store/useIncomeStore'
import usePaymentStore from '../store/usePaymentStore'

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

function getRemainingAmount(record) {
  const amount = Number(record?.remainingAmount ?? record?.remaining_amount)

  return Number.isFinite(amount) ? amount : 0
}

function createInitialForm(record) {
  return {
    amount: getRemainingAmount(record) > 0 ? String(getRemainingAmount(record)) : '',
    paymentDate: new Date().toISOString().slice(0, 10),
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

  return record.supplierName || 'Tagihan'
}

function PaymentPage({ paymentType = 'bill' }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const fetchBillById = useBillStore((state) => state.fetchBillById)
  const fetchLoanById = useIncomeStore((state) => state.fetchLoanById)
  const [record, setRecord] = useState(null)
  const [isLoadingRecord, setIsLoadingRecord] = useState(true)
  const [formData, setFormData] = useState(() => createInitialForm(null))
  const submitBillPayment = usePaymentStore((state) => state.submitBillPayment)
  const submitLoanPayment = usePaymentStore((state) => state.submitLoanPayment)
  const isSubmitting = usePaymentStore((state) => state.isSubmitting)
  const error = usePaymentStore((state) => state.error)
  const clearError = usePaymentStore((state) => state.clearError)
  const isLoanPayment = paymentType === 'loan'
  const pageTitle = isLoanPayment ? 'Pembayaran Pinjaman' : 'Pembayaran Tagihan'
  const entityLabel = isLoanPayment ? 'pinjaman' : 'tagihan'
  const formId = 'payment-form'
  const userName = getUserDisplayName(null, authUser)
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

  useEffect(() => {
    let isActive = true

    async function loadRecord() {
      setIsLoadingRecord(true)

      try {
        const nextRecord = isLoanPayment
          ? await fetchLoanById(id)
          : await fetchBillById(id)

        if (!isActive) {
          return
        }

        setRecord(nextRecord)
        setFormData(createInitialForm(nextRecord))
      } catch (loadError) {
        console.error(`Gagal memuat detail ${entityLabel}:`, loadError)

        if (!isActive) {
          return
        }

        setRecord(null)
      } finally {
        if (isActive) {
          setIsLoadingRecord(false)
        }
      }
    }

    void loadRecord()

    return () => {
      isActive = false
    }
  }, [entityLabel, fetchBillById, fetchLoanById, id, isLoanPayment])

  useEffect(() => () => clearError(), [clearError])

  const handleBack = () => {
    navigate(-1)
  }

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))

    if (error) {
      clearError()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!record || isSubmitting) {
      return
    }

    try {
      if (isLoanPayment) {
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

      navigate(-1)
    } catch (submitError) {
      console.error('Gagal menyimpan pembayaran:', submitError)
    }
  }

  return (
    <FormLayout
      actionLabel="Simpan Pembayaran"
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
                  {isLoanPayment ? 'Pinjaman Aktif' : record.billType || 'Tagihan'}
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
          </section>

          <form id={formId} className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                Nominal Pembayaran
              </span>
              <input
                className="app-input w-full rounded-[20px] px-4 py-4 text-xl font-bold"
                inputMode="decimal"
                max={remainingAmount}
                min="0.01"
                name="amount"
                onChange={handleChange}
                required
                step="0.01"
                type="number"
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
                  {isLoanPayment ? 'Pembayaran cicilan pinjaman' : 'Pembayaran tagihan operasional'}
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                  Setelah tersimpan, nominal tersisa akan dihitung ulang otomatis.
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

          {error ? (
            <div className="app-tone-danger rounded-[20px] px-4 py-3 text-sm">
              {error}
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
