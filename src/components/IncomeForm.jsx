import { useEffect, useState } from 'react'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useIncomeStore from '../store/useIncomeStore'
import useMasterStore from '../store/useMasterStore'

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

function getTelegramUserId(user, authUser) {
  const resolvedValue = user?.id ?? authUser?.telegram_user_id ?? null
  const normalizedValue = String(resolvedValue ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : null
}

function createInitialFormData(initialData = null) {
  return {
    projectId: initialData?.project_id ?? initialData?.projectId ?? '',
    date:
      initialData?.transaction_date ??
      initialData?.transactionDate ??
      initialData?.date ??
      new Date().toISOString().slice(0, 10),
    amount:
      initialData?.amount === 0 || initialData?.amount
        ? String(initialData.amount)
        : '',
    description: initialData?.description ?? '',
  }
}

function formatCurrency(value) {
  const amount = Number(value)

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function buildStaffFeePreview(staffMembers = [], terminAmount = 0) {
  return staffMembers.map((staffMember) => {
    const paymentType = String(staffMember?.payment_type ?? 'monthly').trim()
    const feePercentage = Number(staffMember?.fee_percentage) || 0
    const feeAmount = Number(staffMember?.fee_amount) || 0
    const salary = Number(staffMember?.salary) || 0

    if (paymentType === 'per_termin') {
      const estimatedFee =
        feePercentage > 0 ? (terminAmount * feePercentage) / 100 : feeAmount

      return {
        id: staffMember.id,
        name: staffMember.name,
        paymentType,
        estimatedFee,
        description:
          feePercentage > 0
            ? `${feePercentage}% dari nilai termin`
            : 'Nominal fee per termin',
      }
    }

    if (paymentType === 'fixed_per_termin') {
      return {
        id: staffMember.id,
        name: staffMember.name,
        paymentType,
        estimatedFee: feeAmount,
        description: 'Nominal tetap per termin',
      }
    }

    return {
      id: staffMember.id,
      name: staffMember.name,
      paymentType,
      estimatedFee: 0,
      description: salary > 0 ? 'Gaji bulanan, tidak dipotong dari termin ini' : 'Gaji bulanan',
    }
  })
}

function IncomeForm({ onSuccess, initialData = null, recordId = null }) {
  const [formData, setFormData] = useState(() => createInitialFormData(initialData))
  const [successMessage, setSuccessMessage] = useState(null)
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const projects = useMasterStore((state) => state.projects)
  const staffMembers = useMasterStore((state) => state.staffMembers)
  const isMasterLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const addProjectIncome = useIncomeStore((state) => state.addProjectIncome)
  const updateProjectIncome = useIncomeStore((state) => state.updateProjectIncome)
  const isSubmitting = useIncomeStore((state) => state.isSubmitting)
  const error = useIncomeStore((state) => state.error)
  const clearError = useIncomeStore((state) => state.clearError)
  const isEditMode = Boolean(recordId)
  const telegramUserId = getTelegramUserId(user, authUser)
  const userName = getUserDisplayName(user, authUser)
  const selectedProject = projects.find((project) => project.id === formData.projectId)
  const terminAmount = Number(formData.amount) || 0
  const staffFeePreview = buildStaffFeePreview(staffMembers, terminAmount)
  const estimatedStaffFeeTotal = staffFeePreview.reduce(
    (sum, item) => sum + item.estimatedFee,
    0
  )
  const isProjectDisabled = isSubmitting || isMasterLoading || projects.length === 0
  const isMasterDataReady = !isMasterLoading && projects.length > 0

  useEffect(() => {
    fetchMasters().catch((fetchError) => {
      console.error('Gagal memuat master data pemasukan:', fetchError)
    })
  }, [fetchMasters])

  useEffect(() => () => clearError(), [clearError])

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))

    if (error) {
      clearError()
    }

    if (successMessage) {
      setSuccessMessage(null)
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
        project_id: formData.projectId,
        project_name: selectedProject?.name ?? null,
        transaction_date: formData.date,
        amount: formData.amount,
        description: formData.description,
      }

      if (isEditMode) {
        await updateProjectIncome(recordId, payload)
      } else {
        await addProjectIncome(payload)
      }

      try {
        await onSuccess?.()
      } catch (refreshError) {
        console.error('Gagal memperbarui ringkasan setelah termin proyek:', refreshError)
      }

      if (!isEditMode) {
        setFormData(createInitialFormData())
      }

      setSuccessMessage(
        isEditMode
          ? 'Pemasukan proyek berhasil diperbarui.'
          : 'Termin proyek berhasil disimpan.'
      )
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan termin proyek.'

      console.error(message)
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <fieldset className="space-y-6" disabled={isSubmitting}>
        <section className="space-y-4 rounded-[26px] border border-slate-200 bg-white/75 p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--app-accent-color)]">
              Pemasukan Proyek
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Proyek
            </span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              disabled={isProjectDisabled}
              name="projectId"
              onChange={handleChange}
              required
              value={formData.projectId}
            >
              {isMasterLoading ? (
                <option value="">Memuat proyek...</option>
              ) : projects.length > 0 ? (
                <>
                  <option value="">Pilih proyek</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">Data proyek belum tersedia</option>
              )}
            </select>
          </label>

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
                Nominal Termin
              </span>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                inputMode="decimal"
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
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Deskripsi
            </span>
            <textarea
              className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              name="description"
              onChange={handleChange}
              placeholder="Contoh: Termin 1 pekerjaan struktur."
              required
              value={formData.description}
            />
          </label>

          <div className="rounded-[24px] border border-sky-200 bg-sky-50/80 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                Preview Fee Staf
              </p>
              <p className="text-sm leading-6 text-sky-900">
                Estimasi ini dibaca dari master data staf dan belum membuat bill fee.
              </p>
            </div>

            {staffFeePreview.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-sky-800">
                Belum ada data staf. Tambahkan staf jika fee termin perlu dihitung.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {staffFeePreview.map((staffPreview) => (
                  <div
                    key={staffPreview.id}
                    className="rounded-2xl border border-sky-100 bg-white/90 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {staffPreview.name}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {staffPreview.description}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-sky-700">
                        {formatCurrency(staffPreview.estimatedFee)}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="rounded-2xl bg-sky-900 px-4 py-3 text-white">
                  <p className="text-xs uppercase tracking-[0.18em] text-sky-100">
                    Total Estimasi Fee
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {formatCurrency(estimatedStaffFeeTotal)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-sky-100">
                    Estimasi dana bersih setelah fee:
                    {' '}
                    {formatCurrency(Math.max(terminAmount - estimatedStaffFeeTotal, 0))}
                  </p>
                </div>
              </div>
            )}
          </div>
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
              ? 'Perbarui Pemasukan Proyek'
              : 'Simpan Termin Proyek'}
        </button>
      </fieldset>
    </form>
  )
}

export default IncomeForm
