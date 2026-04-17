import { useEffect, useState } from 'react'
import useAuthStore from '../store/useAuthStore'
import usePaymentStore from '../store/usePaymentStore'
import { AppButton, AppCardStrong, AppDialog, AppInput, AppTextarea } from './ui/AppPrimitives'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function formatCurrency(value) {
  const amount = Number(value)

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function createInitialForm(bill) {
  return {
    amount: bill?.remainingAmount ? String(bill.remainingAmount) : '',
    paymentDate: new Date().toISOString().slice(0, 10),
    notes: '',
  }
}

function PaymentModal({ bill, onClose, userName = 'Pengguna Telegram' }) {
  const [formData, setFormData] = useState(() => createInitialForm(bill))
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const submitBillPayment = usePaymentStore((state) => state.submitBillPayment)
  const isSubmitting = usePaymentStore((state) => state.isSubmitting)
  const error = usePaymentStore((state) => state.error)
  const clearError = usePaymentStore((state) => state.clearError)

  useEffect(() => {
    setFormData(createInitialForm(bill))
  }, [bill])

  useEffect(() => () => clearError(), [clearError])

  if (!bill) {
    return null
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

    try {
      await submitBillPayment({
        bill_id: bill.id,
        telegram_user_id: authUser?.telegram_user_id ?? null,
        team_id: currentTeamId ?? bill.teamId,
        amount: formData.amount,
        maxAmount: bill.remainingAmount,
        payment_date: formData.paymentDate,
        notes: formData.notes,
        userName,
        supplierName: bill.supplierName,
        projectName: bill.projectName,
        remainingAmount: Math.max(
          Number(bill.remainingAmount ?? 0) - Number(formData.amount ?? 0),
          0
        ),
      })

      onClose()
    } catch (submitError) {
      console.error('Gagal menyimpan pembayaran:', submitError)
    }
  }

  return (
    <AppDialog
      open
      onClose={onClose}
      title="Pembayaran Tagihan"
      description={bill.supplierName}
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-[var(--app-hint-color)]">
          {bill.projectName}
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <AppCardStrong className="space-y-1.5 px-4 py-4">
            <p className="app-meta">Total Bill</p>
            <p className="text-base font-semibold text-[var(--app-text-color)]">
              {formatCurrency(bill.amount)}
            </p>
          </AppCardStrong>

          <AppCardStrong className="space-y-1.5 px-4 py-4">
            <p className="app-meta">Sudah Dibayar</p>
            <p className="text-base font-semibold text-[var(--app-text-color)]">
              {formatCurrency(bill.paidAmount)}
            </p>
          </AppCardStrong>

          <AppCardStrong className="space-y-1.5 px-4 py-4 app-tone-warning">
            <p className="app-meta">Sisa Tagihan</p>
            <p className="text-base font-semibold">
              {formatCurrency(bill.remainingAmount)}
            </p>
          </AppCardStrong>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Nominal Pembayaran
            </span>
            <AppInput
              inputMode="decimal"
              max={bill.remainingAmount}
              min="0.01"
              name="amount"
              onChange={handleChange}
              placeholder="Rp 0"
              required
              step="0.01"
              type="number"
              value={formData.amount}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Tanggal Pembayaran
            </span>
            <AppInput
              name="paymentDate"
              onChange={handleChange}
              required
              type="date"
              value={formData.paymentDate}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Catatan
            </span>
            <AppTextarea
              name="notes"
              onChange={handleChange}
              placeholder="Contoh: Transfer tahap pertama."
              value={formData.notes}
            />
          </label>

          {error ? (
            <div className="app-card-dashed border-[var(--app-tone-danger-border)] px-4 py-3 text-sm leading-6 text-[var(--app-tone-danger-text)]">
              {error}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <AppButton onClick={onClose} type="button" variant="secondary">
              Batal
            </AppButton>

            <AppButton disabled={isSubmitting} type="submit" variant="primary">
              {isSubmitting ? 'Menyimpan...' : 'Simpan Pembayaran'}
            </AppButton>
          </div>
        </form>
      </div>
    </AppDialog>
  )
}

export default PaymentModal
