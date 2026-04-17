import { useEffect, useState } from 'react'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useIncomeStore from '../store/useIncomeStore'
import useMasterStore from '../store/useMasterStore'

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

function getTelegramUserId(user, authUser) {
  const resolvedValue = user?.id ?? authUser?.telegram_user_id ?? null
  const normalizedValue = String(resolvedValue ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : null
}

function createInitialFormData(initialData = null) {
  return {
    creditorId: initialData?.creditor_id ?? initialData?.creditorId ?? '',
    date:
      initialData?.transaction_date ??
      initialData?.transactionDate ??
      initialData?.date ??
      new Date().toISOString().slice(0, 10),
    principalAmount:
      initialData?.principal_amount === 0 || initialData?.principal_amount
        ? String(initialData.principal_amount)
        : initialData?.principalAmount === 0 || initialData?.principalAmount
          ? String(initialData.principalAmount)
          : '',
    repaymentAmount:
      initialData?.repayment_amount === 0 || initialData?.repayment_amount
        ? String(initialData.repayment_amount)
        : initialData?.repaymentAmount === 0 || initialData?.repaymentAmount
          ? String(initialData.repaymentAmount)
          : '',
    interestType:
      initialData?.interest_type ?? initialData?.interestType ?? 'none',
    interestRate:
      initialData?.interest_rate === 0 || initialData?.interest_rate
        ? String(initialData.interest_rate)
        : initialData?.interestRate === 0 || initialData?.interestRate
          ? String(initialData.interestRate)
          : '',
    tenorMonths:
      initialData?.tenor_months === 0 || initialData?.tenor_months
        ? String(initialData.tenor_months)
        : initialData?.tenorMonths === 0 || initialData?.tenorMonths
          ? String(initialData.tenorMonths)
          : '',
    notes: initialData?.notes ?? initialData?.description ?? '',
  }
}

function LoanForm({ onSuccess, initialData = null, recordId = null }) {
  const [formData, setFormData] = useState(() => createInitialFormData(initialData))
  const [creditorNameDraft, setCreditorNameDraft] = useState('')
  const [successMessage, setSuccessMessage] = useState(null)
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const fundingCreditors = useMasterStore((state) => state.fundingCreditors)
  const isMasterLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const addFundingCreditor = useMasterStore((state) => state.addFundingCreditor)
  const addLoan = useIncomeStore((state) => state.addLoan)
  const updateLoan = useIncomeStore((state) => state.updateLoan)
  const isSubmitting = useIncomeStore((state) => state.isSubmitting)
  const error = useIncomeStore((state) => state.error)
  const clearError = useIncomeStore((state) => state.clearError)
  const isEditMode = Boolean(recordId)
  const telegramUserId = getTelegramUserId(user, authUser)
  const userName = getUserDisplayName(user, authUser)
  const selectedCreditor = fundingCreditors.find(
    (creditor) => creditor.id === formData.creditorId
  )
  const isCreditorDisabled =
    isSubmitting || isMasterLoading || fundingCreditors.length === 0
  const isMasterDataReady = !isMasterLoading && fundingCreditors.length > 0

  useEffect(() => {
    fetchMasters().catch((fetchError) => {
      console.error('Gagal memuat master data pinjaman:', fetchError)
    })
  }, [fetchMasters])

  useEffect(() => () => clearError(), [clearError])

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
      ...(name === 'interestType' && value !== 'interest' ? { interestRate: '' } : {}),
    }))

    if (error) {
      clearError()
    }

    if (successMessage) {
      setSuccessMessage(null)
    }
  }

  const handleCreateCreditor = async () => {
    const normalizedName = String(creditorNameDraft ?? '').trim()

    if (!normalizedName) {
      return
    }

    try {
      const createdCreditor = await addFundingCreditor({
        creditor_name: normalizedName,
      })

      setCreditorNameDraft('')
      setFormData((current) => ({
        ...current,
        creditorId: createdCreditor.id,
      }))
    } catch (createError) {
      console.error(
        createError instanceof Error
          ? createError.message
          : 'Gagal menambah kreditur pendanaan.'
      )
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (isSubmitting || !isMasterDataReady) {
      return
    }

    try {
      const payload = {
        telegram_user_id: telegramUserId,
        userName,
        creditor_id: formData.creditorId,
        creditor_name: selectedCreditor?.name ?? null,
        transaction_date: formData.date,
        principal_amount: formData.principalAmount,
        repayment_amount: formData.repaymentAmount,
        interest_type: formData.interestType,
        interest_rate: formData.interestRate,
        tenor_months: formData.tenorMonths,
        description: formData.notes,
        notes: formData.notes,
      }

      if (isEditMode) {
        await updateLoan(recordId, payload)
      } else {
        await addLoan(payload)
      }

      try {
        await onSuccess?.()
      } catch (refreshError) {
        console.error('Gagal memperbarui ringkasan setelah pinjaman:', refreshError)
      }

      if (!isEditMode) {
        setFormData(createInitialFormData())
      }

      setSuccessMessage(
        isEditMode ? 'Pinjaman berhasil diperbarui.' : 'Pinjaman berhasil disimpan.'
      )
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan pinjaman.'

      console.error(message)
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <fieldset className="space-y-6" disabled={isSubmitting}>
        <section className="space-y-4 rounded-[26px] border border-slate-200 bg-white/75 p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--app-accent-color)]">
              Pinjaman / Modal
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Kreditur / Sumber Dana
            </span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              disabled={isCreditorDisabled}
              name="creditorId"
              onChange={handleChange}
              required
              value={formData.creditorId}
            >
              {isMasterLoading ? (
                <option value="">Memuat kreditur...</option>
              ) : fundingCreditors.length > 0 ? (
                <>
                  <option value="">Pilih kreditur</option>
                  {fundingCreditors.map((creditor) => (
                    <option key={creditor.id} value={creditor.id}>
                      {creditor.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">Data kreditur belum tersedia</option>
              )}
            </select>
          </label>

          {fundingCreditors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/80 p-4">
              <p className="text-sm font-medium text-sky-800">
                Belum ada kreditur tersimpan.
              </p>
              <p className="mt-1 text-sm leading-6 text-sky-700">
                Tambahkan kreditur pertama agar pinjaman bisa dicatat.
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input
                  className="flex-1 rounded-2xl border border-sky-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  onChange={(event) => setCreditorNameDraft(event.target.value)}
                  placeholder="Nama kreditur, misal: Bank Mandiri"
                  type="text"
                  value={creditorNameDraft}
                />
                <button
                  className="inline-flex items-center justify-center rounded-[22px] bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!String(creditorNameDraft ?? '').trim()}
                  onClick={handleCreateCreditor}
                  type="button"
                >
                  Tambah Kreditur
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Tanggal
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                name="date"
                onChange={handleChange}
                required
                type="date"
                value={formData.date}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Tipe Bunga
              </span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                name="interestType"
                onChange={handleChange}
                value={formData.interestType}
              >
                <option value="none">Tanpa Bunga</option>
                <option value="interest">Berbunga</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Pokok Pinjaman
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                inputMode="decimal"
                min="0.01"
                name="principalAmount"
                onChange={handleChange}
                placeholder="Rp 0"
                required
                step="0.01"
                type="number"
                value={formData.principalAmount}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Total Pengembalian
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                inputMode="decimal"
                min="0.01"
                name="repaymentAmount"
                onChange={handleChange}
                placeholder="Rp 0"
                required
                step="0.01"
                type="number"
                value={formData.repaymentAmount}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Suku Bunga (%)
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                disabled={formData.interestType !== 'interest'}
                inputMode="decimal"
                min="0"
                name="interestRate"
                onChange={handleChange}
                placeholder="0"
                step="0.01"
                type="number"
                value={formData.interestRate}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Tenor (Bulan)
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                inputMode="numeric"
                min="0"
                name="tenorMonths"
                onChange={handleChange}
                placeholder="0"
                step="1"
                type="number"
                value={formData.tenorMonths}
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Catatan
            </span>
            <textarea
              className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              name="notes"
              onChange={handleChange}
              placeholder="Contoh: Dana talangan untuk pembelian material."
              value={formData.notes}
            />
          </label>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
            {error}
          </div>
        ) : null}

        {masterError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            {masterError}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        <button
          className="flex w-full items-center justify-center rounded-[22px] bg-slate-950 px-5 py-4 text-base font-semibold text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting || !isMasterDataReady}
          type="submit"
        >
          {isSubmitting
            ? 'Menyimpan...'
            : isEditMode
              ? 'Perbarui Pinjaman'
              : 'Simpan Pinjaman'}
        </button>
      </fieldset>
    </form>
  )
}

export default LoanForm
