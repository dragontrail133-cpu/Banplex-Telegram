import { useEffect, useMemo, useState } from 'react'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useMasterStore from '../store/useMasterStore'
import useTransactionStore from '../store/useTransactionStore'

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

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

function createInitialFormData() {
  return {
    projectId: '',
    categoryId: '',
    supplierId: '',
    paymentStatus: 'unpaid',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    notes: '',
  }
}

function resolveExpenseType(category) {
  const normalizedGroup = String(category?.category_group ?? '').trim().toLowerCase()

  if (['operational', 'operasional'].includes(normalizedGroup)) {
    return 'operasional'
  }

  return 'lainnya'
}

function ExpenseForm({ onSuccess }) {
  const [formData, setFormData] = useState(createInitialFormData)
  const [successMessage, setSuccessMessage] = useState(null)
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const projects = useMasterStore((state) => state.projects)
  const categories = useMasterStore((state) => state.categories)
  const suppliers = useMasterStore((state) => state.suppliers)
  const isMasterLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const submitExpense = useTransactionStore((state) => state.submitExpense)
  const isSubmitting = useTransactionStore((state) => state.isSubmitting)
  const error = useTransactionStore((state) => state.error)
  const clearError = useTransactionStore((state) => state.clearError)
  const telegramUserId = getTelegramUserId(user, authUser)
  const userName = getUserDisplayName(user, authUser)

  useEffect(() => {
    fetchMasters().catch((fetchError) => {
      console.error('Gagal memuat master data pengeluaran:', fetchError)
    })
  }, [fetchMasters])

  useEffect(() => () => clearError(), [clearError])

  const selectableCategories = useMemo(() => {
    const nonMaterialCategories = categories.filter((category) => {
      const normalizedGroup = String(category?.category_group ?? '')
        .trim()
        .toLowerCase()

      return !['material', 'material_invoice'].includes(normalizedGroup)
    })

    return nonMaterialCategories.length > 0 ? nonMaterialCategories : categories
  }, [categories])

  const selectedProject = projects.find((project) => project.id === formData.projectId)
  const selectedCategory = selectableCategories.find(
    (category) => category.id === formData.categoryId
  )
  const selectedSupplier = suppliers.find((supplier) => supplier.id === formData.supplierId)
  const isMasterDataReady =
    !isMasterLoading && projects.length > 0 && selectableCategories.length > 0

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
      await submitExpense({
        telegram_user_id: telegramUserId,
        userName,
        project_id: formData.projectId,
        project_name: selectedProject?.name ?? null,
        category_id: formData.categoryId,
        category_name: selectedCategory?.name ?? null,
        expense_type: resolveExpenseType(selectedCategory),
        supplier_id: normalizeText(formData.supplierId, null),
        supplier_name: selectedSupplier?.name ?? null,
        expense_date: formData.date,
        amount: formData.amount,
        status: formData.paymentStatus,
        description: formData.description,
        notes: normalizeText(formData.notes, null),
      })

      try {
        await onSuccess?.()
      } catch (refreshError) {
        console.error('Gagal memperbarui ringkasan setelah pengeluaran:', refreshError)
      }

      setFormData(createInitialFormData())
      setSuccessMessage('Pengeluaran berhasil disimpan ke jalur relasional final.')
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan pengeluaran.'

      console.error(message)
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <fieldset className="space-y-6" disabled={isSubmitting}>
        <section className="space-y-4 rounded-[26px] border border-slate-200 bg-white/75 p-4 sm:p-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--app-accent-color)]">
              Pengeluaran Operasional
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Proyek
            </span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              disabled={isSubmitting || isMasterLoading || projects.length === 0}
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

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Kategori
            </span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              disabled={
                isSubmitting ||
                isMasterLoading ||
                selectableCategories.length === 0
              }
              name="categoryId"
              onChange={handleChange}
              required
              value={formData.categoryId}
            >
              {isMasterLoading ? (
                <option value="">Memuat kategori...</option>
              ) : selectableCategories.length > 0 ? (
                <>
                  <option value="">Pilih kategori</option>
                  {selectableCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </>
              ) : (
                <option value="">Data kategori belum tersedia</option>
              )}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Supplier
            </span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              disabled={isSubmitting || isMasterLoading}
              name="supplierId"
              onChange={handleChange}
              value={formData.supplierId}
            >
              <option value="">Tanpa supplier spesifik</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
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
                Nominal
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
              Status Pembayaran
            </span>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              name="paymentStatus"
              onChange={handleChange}
              required
              value={formData.paymentStatus}
            >
              <option value="unpaid">Belum dibayar</option>
              <option value="paid">Sudah dibayar</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Deskripsi
            </span>
            <textarea
              className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              name="description"
              onChange={handleChange}
              placeholder="Contoh: Pembelian alat kerja lapangan."
              required
              value={formData.description}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-[var(--app-text-color)]">
              Catatan
            </span>
            <textarea
              className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              name="notes"
              onChange={handleChange}
              placeholder="Catatan tambahan opsional."
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
          {isSubmitting ? 'Menyimpan...' : 'Simpan Pengeluaran'}
        </button>
      </fieldset>
    </form>
  )
}

export default ExpenseForm
