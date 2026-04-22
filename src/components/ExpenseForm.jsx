import { useEffect, useMemo, useState } from 'react'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useMasterStore from '../store/useMasterStore'
import useTransactionStore from '../store/useTransactionStore'
import { getAppTodayKey } from '../lib/date-time'
import ExpenseAttachmentSection from './ExpenseAttachmentSection'
import FormLayout from './layouts/FormLayout'
import { supplierTypeGroups } from './master/masterTabs'
import MasterPickerField from './ui/MasterPickerField'
import {
  AppCard,
  AppErrorState,
  AppNominalInput,
  AppToggleGroup,
  FormSection,
} from './ui/AppPrimitives'

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : NaN
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

function createInitialFormData(initialData = null) {
  return {
    projectId: normalizeText(initialData?.project_id, ''),
    categoryId: normalizeText(initialData?.category_id, ''),
    supplierId: normalizeText(initialData?.supplier_id, ''),
    paymentStatus: normalizeText(initialData?.status, 'unpaid'),
    amount: normalizeText(
      initialData?.amount ?? initialData?.total_amount,
      ''
    ),
    date: normalizeText(initialData?.expense_date, getAppTodayKey()),
    description: normalizeText(initialData?.description, ''),
    notes: normalizeText(initialData?.notes, ''),
  }
}

function resolveExpenseType(category) {
  const normalizedGroup = String(category?.category_group ?? '').trim().toLowerCase()

  if (['operational', 'operasional'].includes(normalizedGroup)) {
    return 'operasional'
  }

  return 'lainnya'
}

function hasExpensePaymentHistory(expense = null) {
  const paidAmount = toNumber(expense?.bill?.paid_amount ?? expense?.bill?.paidAmount)
  const normalizedBillStatus = String(expense?.bill?.status ?? '').trim().toLowerCase()

  return Boolean(
    expense?.bill?.id &&
      ((Number.isFinite(paidAmount) && paidAmount > 0) ||
        ['partial', 'paid'].includes(normalizedBillStatus))
  )
}

function ExpenseForm({ initialData = null, onSuccess, formId = 'expense-form' }) {
  const [formData, setFormData] = useState(() => createInitialFormData(initialData))
  const [successMessage, setSuccessMessage] = useState(null)
  const [savedExpenseId, setSavedExpenseId] = useState(initialData?.id ?? null)
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const projects = useMasterStore((state) => state.projects)
  const categories = useMasterStore((state) => state.categories)
  const suppliers = useMasterStore((state) => state.suppliers)
  const getSuppliersByTypes = useMasterStore((state) => state.getSuppliersByTypes)
  const isMasterLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const submitExpense = useTransactionStore((state) => state.submitExpense)
  const updateExpense = useTransactionStore((state) => state.updateExpense)
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
  const contextualSuppliers = getSuppliersByTypes(supplierTypeGroups.operationalExpense)
  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === formData.supplierId
  )
  const resolvedSupplierName = normalizeText(
    selectedSupplier?.name,
    normalizeText(initialData?.supplier_name, normalizeText(initialData?.supplier_name_snapshot, null))
  )
  const availableSuppliers = useMemo(
    () =>
      selectedSupplier
        ? [
            selectedSupplier,
            ...contextualSuppliers.filter(
              (supplier) => supplier.id !== selectedSupplier.id
            ),
          ]
        : contextualSuppliers,
    [contextualSuppliers, selectedSupplier]
  )
  const isMasterDataReady =
    !isMasterLoading && projects.length > 0 && selectableCategories.length > 0
  const isPaymentLocked = hasExpensePaymentHistory(initialData)
  const isLocked = Boolean(initialData?.deleted_at) || isPaymentLocked
  const activeExpenseId = savedExpenseId ?? initialData?.id ?? null
  const submitLabel = initialData?.id ? 'Perbarui Pengeluaran' : 'Simpan Pengeluaran'
  const projectPickerOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.name,
        description:
          project.project_type || project.status
            ? [project.project_type, project.status].filter(Boolean).join(' • ')
            : 'Master proyek aktif',
        searchText: [project.name, project.project_type, project.status].join(' '),
      })),
    [projects]
  )
  const categoryPickerOptions = useMemo(
    () =>
      selectableCategories.map((category) => ({
        value: category.id,
        label: category.name,
        description: category.category_group
          ? `Kelompok: ${category.category_group}`
          : 'Master kategori biaya',
        searchText: [category.name, category.category_group].join(' '),
      })),
    [selectableCategories]
  )
  const supplierPickerOptions = useMemo(
    () =>
      availableSuppliers.map((supplier) => ({
        value: supplier.id,
        label: supplier.name,
        description: supplier.supplier_type
          ? `Tipe: ${supplier.supplier_type}`
          : 'Master supplier kontekstual',
        searchText: [supplier.name, supplier.supplier_type].join(' '),
      })),
    [availableSuppliers]
  )

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

    if (isSubmitting || !isMasterDataReady || isLocked) {
      return
    }

    if (isPaymentLocked) {
      console.error('Pengeluaran yang sudah memiliki pembayaran tidak bisa diubah atau dihapus.')
      return
    }

    try {
      if (!selectedProject) {
        throw new Error('Proyek wajib dipilih.')
      }

      if (!selectedCategory) {
        throw new Error('Kategori wajib dipilih.')
      }

      const payload = {
        telegram_user_id: telegramUserId,
        userName,
        expectedUpdatedAt: initialData?.updated_at ?? initialData?.updatedAt ?? null,
        project_id: formData.projectId,
        project_name: selectedProject?.name ?? null,
        category_id: formData.categoryId,
        category_name: selectedCategory?.name ?? null,
        expense_type: resolveExpenseType(selectedCategory),
        supplier_id: normalizeText(formData.supplierId, null),
        supplier_name: resolvedSupplierName,
        expense_date: formData.date,
        amount: formData.amount,
        status: formData.paymentStatus,
        description: formData.description,
        notes: normalizeText(formData.notes, null),
      }

      const nextExpense = initialData?.id
        ? await updateExpense(initialData.id, payload)
        : await submitExpense(payload)

      if (nextExpense?.id) {
        setSavedExpenseId(nextExpense.id)
      } else {
        setSavedExpenseId(initialData?.id ?? null)
      }

      try {
        await onSuccess?.()
      } catch (refreshError) {
        console.error('Gagal memperbarui ringkasan setelah pengeluaran:', refreshError)
      }

      setFormData(createInitialFormData(initialData))
      setSuccessMessage(
        initialData?.id
          ? 'Pengeluaran berhasil diperbarui ke jalur relasional final.'
          : 'Pengeluaran berhasil disimpan ke jalur relasional final.'
      )
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan pengeluaran.'

      console.error(message)
    }
  }

  return (
    <form id={formId} className="space-y-6" onSubmit={handleSubmit}>
      <fieldset className="space-y-6" disabled={isSubmitting || isLocked}>
        <FormLayout
          embedded
          actionLabel={submitLabel}
          formId={formId}
          isSubmitting={isSubmitting}
          sections={[
            {
              id: 'expense-identity',
              title: 'Relasi Transaksi',
              description: 'Pilih master relasional yang mengikat transaksi ini.',
            },
            {
              id: 'expense-details',
              title: 'Nilai dan Status',
              description: 'Isi nominal, status pembayaran, dan deskripsi transaksi.',
            },
            {
              id: 'expense-notes',
              title: 'Catatan dan Aksi',
              description: 'Tambahkan catatan tambahan dan simpan perubahan.',
            },
          ]}
          submitDisabled={!isMasterDataReady || isLocked}
        >
          <FormSection
            eyebrow="Relasi"
            title="Relasi Transaksi"
            description="Pilih master proyek, kategori, dan supplier yang dipakai oleh pengeluaran ini."
          >
            <MasterPickerField
              disabled={isSubmitting || isMasterLoading || projects.length === 0}
              emptyMessage="Data proyek belum tersedia."
              label="Proyek"
              name="projectId"
              onChange={(nextValue) =>
                handleChange({
                  target: {
                    name: 'projectId',
                    value: nextValue,
                  },
                })
              }
              options={projectPickerOptions}
              placeholder="Pilih proyek"
              required
              searchPlaceholder="Cari proyek..."
              title="Pilih Proyek"
              value={formData.projectId}
            />

            <MasterPickerField
              disabled={
                isSubmitting ||
                isMasterLoading ||
                selectableCategories.length === 0
              }
              emptyMessage="Data kategori belum tersedia."
              label="Kategori"
              name="categoryId"
              onChange={(nextValue) =>
                handleChange({
                  target: {
                    name: 'categoryId',
                    value: nextValue,
                  },
                })
              }
              options={categoryPickerOptions}
              placeholder="Pilih kategori"
              required
              searchPlaceholder="Cari kategori..."
              title="Pilih Kategori"
              value={formData.categoryId}
            />

            <MasterPickerField
              disabled={
                isSubmitting || isMasterLoading || availableSuppliers.length === 0
              }
              emptyMessage="Data supplier belum tersedia."
              label="Supplier"
              name="supplierId"
              onChange={(nextValue) =>
                handleChange({
                  target: {
                    name: 'supplierId',
                    value: nextValue,
                  },
                })
              }
              options={supplierPickerOptions}
              placeholder="Pilih supplier"
              required={!initialData?.id || !resolvedSupplierName}
              searchPlaceholder="Cari supplier..."
              title="Pilih Supplier"
              value={formData.supplierId}
            />
          </FormSection>

          <FormSection
            eyebrow="Nilai"
            title="Nilai dan Status"
            description="Isi tanggal transaksi, nominal, status pembayaran, dan deskripsi singkat."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Tanggal
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
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
                <AppNominalInput
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name="amount"
                  onValueChange={(nextValue) =>
                    handleChange({
                      target: {
                        name: 'amount',
                        value: nextValue,
                      },
                    })
                  }
                  placeholder="Rp 0"
                  required
                  value={formData.amount}
                />
              </label>
            </div>

            <AppToggleGroup
              buttonSize="sm"
              description="Status pembayaran hanya punya dua opsi dan tidak mengambil master data."
              label="Status Pembayaran"
              onChange={(nextValue) =>
                handleChange({
                  target: {
                    name: 'paymentStatus',
                    value: nextValue,
                  },
                })
              }
              options={[
                { value: 'unpaid', label: 'Belum dibayar' },
                { value: 'paid', label: 'Sudah dibayar' },
              ]}
              value={formData.paymentStatus}
            />

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Deskripsi
              </span>
              <textarea
                className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                name="description"
                onChange={handleChange}
                placeholder="Contoh: Pembelian alat kerja lapangan."
                required
                value={formData.description}
              />
            </label>
          </FormSection>

          <FormSection
            eyebrow="Catatan"
            title="Catatan dan Lampiran"
            description="Tambahkan catatan tambahan, lampiran, lalu simpan dari footer halaman."
          >
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Catatan
              </span>
              <textarea
                className="min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                name="notes"
                onChange={handleChange}
                placeholder="Catatan tambahan opsional."
                value={formData.notes}
              />
            </label>

            <ExpenseAttachmentSection
              deferUploadUntilParentSaved
              expenseId={activeExpenseId}
              title="Lampiran Bukti"
            />

            {error ? (
              <AppErrorState
                description={error}
                title="Pengeluaran belum tersimpan"
              />
            ) : null}

            {masterError ? (
              <AppCard className="app-tone-warning">
                <div className="space-y-2">
                  <p className="app-meta text-[var(--app-tone-warning-text)]">
                    Master data belum siap
                  </p>
                  <p className="text-sm leading-6">{masterError}</p>
                </div>
              </AppCard>
            ) : null}

            {isPaymentLocked ? (
              <AppCard className="app-tone-warning">
                <div className="space-y-2">
                  <p className="app-meta text-[var(--app-tone-warning-text)]">
                    Pengeluaran terkunci
                  </p>
                  <p className="text-sm leading-6">
                    Pengeluaran yang sudah memiliki pembayaran tidak bisa diubah atau dihapus.
                  </p>
                </div>
              </AppCard>
            ) : null}

            {successMessage ? (
              <AppCard className="app-tone-success">
                <div className="space-y-2">
                  <p className="app-meta text-[var(--app-tone-success-text)]">
                    Pengeluaran tersimpan
                  </p>
                  <p className="text-sm leading-6">{successMessage}</p>
                </div>
              </AppCard>
            ) : null}
          </FormSection>
        </FormLayout>
      </fieldset>
    </form>
  )
}

export default ExpenseForm
