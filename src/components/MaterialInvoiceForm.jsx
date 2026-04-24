import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
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
  AppButton,
  AppErrorState,
  AppNominalInput,
  AppToggleGroup,
  FormSection,
} from './ui/AppPrimitives'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function createLineItem() {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    materialId: '',
    qty: '',
    unitPrice: '',
  }
}

function createInitialHeader(initialData = null) {
  return {
    projectId: normalizeText(initialData?.project_id ?? initialData?.projectId, ''),
    supplierId: normalizeText(initialData?.supplier_id ?? initialData?.supplierId, ''),
    date: normalizeText(
      initialData?.expense_date ?? initialData?.expenseDate,
      getAppTodayKey()
    ),
    description: normalizeText(initialData?.description, ''),
    documentType:
      normalizeText(initialData?.document_type ?? initialData?.documentType, '') ===
      'surat_jalan'
        ? 'surat_jalan'
        : 'faktur',
    paymentStatus:
      normalizeText(initialData?.status, '') === 'delivery_order'
        ? 'paid'
        : normalizeText(initialData?.status, 'paid'),
  }
}

function createInitialItems(initialData = null) {
  const items = Array.isArray(initialData?.items) ? initialData.items : []

  if (items.length === 0) {
    return [createLineItem()]
  }

  return items.map((item) => ({
    id: normalizeText(item?.id, `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    materialId: normalizeText(item?.material_id ?? item?.materialId, ''),
    qty: normalizeText(item?.qty, ''),
    unitPrice: normalizeText(item?.unit_price ?? item?.unitPrice, ''),
  }))
}

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function getMaterialInvoiceDraftKey(isEditMode) {
  return isEditMode ? null : 'material-invoice:draft:new'
}

function readMaterialInvoiceDraft(draftKey) {
  if (!draftKey || typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.sessionStorage.getItem(draftKey)

    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)

    if (!parsedValue || typeof parsedValue !== 'object') {
      return null
    }

    return parsedValue
  } catch {
    return null
  }
}

function writeMaterialInvoiceDraft(draftKey, draft) {
  if (!draftKey || typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.setItem(draftKey, JSON.stringify(draft))
  } catch {
    // Abaikan kegagalan penyimpanan draft agar form tetap bisa dipakai.
  }
}

function clearMaterialInvoiceDraft(draftKey) {
  if (!draftKey || typeof window === 'undefined') {
    return
  }

  try {
    window.sessionStorage.removeItem(draftKey)
  } catch {
    // Abaikan kegagalan pembersihan draft.
  }
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

function formatCurrency(value) {
  const amount = Number(value)

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function getLineTotal(item) {
  const qty = Number(item.qty)
  const unitPrice = Number(item.unitPrice)

  if (!Number.isFinite(qty) || !Number.isFinite(unitPrice)) {
    return 0
  }

  return qty * unitPrice
}

function MaterialInvoiceForm({
  onSuccess,
  onClose = null,
  formId = null,
  hideActions = false,
  initialData = null,
  recordId = null,
}) {
  const draftKey = getMaterialInvoiceDraftKey(Boolean(recordId ?? initialData?.id))
  const draftSnapshot = readMaterialInvoiceDraft(draftKey)
  const [header, setHeader] = useState(() =>
    draftSnapshot?.header && typeof draftSnapshot.header === 'object'
      ? draftSnapshot.header
      : createInitialHeader(initialData)
  )
  const [items, setItems] = useState(() =>
    Array.isArray(draftSnapshot?.items) && draftSnapshot.items.length > 0
      ? draftSnapshot.items
      : createInitialItems(initialData)
  )
  const [savedExpenseId, setSavedExpenseId] = useState(
    recordId ?? initialData?.id ?? null
  )
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const projects = useMasterStore((state) => state.projects)
  const suppliers = useMasterStore((state) => state.suppliers)
  const materials = useMasterStore((state) => state.materials)
  const getSuppliersByTypes = useMasterStore((state) => state.getSuppliersByTypes)
  const isMasterLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const submitMaterialInvoice = useTransactionStore(
    (state) => state.submitMaterialInvoice
  )
  const updateMaterialInvoice = useTransactionStore(
    (state) => state.updateMaterialInvoice
  )
  const isSubmitting = useTransactionStore((state) => state.isSubmitting)
  const error = useTransactionStore((state) => state.error)
  const clearError = useTransactionStore((state) => state.clearError)
  const totalAmount = items.reduce((sum, item) => sum + getLineTotal(item), 0)
  const isDeliveryOrder = header.documentType === 'surat_jalan'
  const isEditMode = Boolean(recordId ?? initialData?.id)
  const hasBillPaymentHistory = Number(initialData?.bill?.paidAmount ?? initialData?.bill?.paid_amount ?? 0) > 0
  const isLocked = Boolean(initialData?.deleted_at) || hasBillPaymentHistory
  const activeExpenseId = savedExpenseId ?? recordId ?? initialData?.id ?? null
  const materialSuppliers = getSuppliersByTypes(supplierTypeGroups.material)
  const resolvedFormId = formId ?? 'material-invoice-form'
  const submitLabel = isEditMode
    ? 'Perbarui Faktur Material'
    : isDeliveryOrder
      ? 'Simpan Surat Jalan'
      : 'Simpan Faktur Material'
  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === header.supplierId
  )
  const availableMaterialSuppliers = useMemo(
    () =>
      selectedSupplier
        ? [
            selectedSupplier,
            ...materialSuppliers.filter((supplier) => supplier.id !== selectedSupplier.id),
          ]
        : materialSuppliers,
    [materialSuppliers, selectedSupplier]
  )
  const projectPickerOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.name,
        description: project.project_type
          ? `Tipe: ${project.project_type}`
          : 'Master proyek aktif',
        searchText: [project.name, project.project_type, project.status].join(' '),
      })),
    [projects]
  )
  const supplierPickerOptions = useMemo(
    () =>
      availableMaterialSuppliers.map((supplier) => ({
        value: supplier.id,
        label: supplier.name,
        description: supplier.supplier_type
          ? `Tipe: ${supplier.supplier_type}`
          : 'Master supplier material',
        searchText: [supplier.name, supplier.supplier_type].join(' '),
      })),
    [availableMaterialSuppliers]
  )
  const materialPickerOptions = useMemo(
    () =>
      materials.map((material) => ({
        value: material.id,
        label: material.name,
        description: [material.unit, material.current_stock !== null ? `Stok: ${material.current_stock}` : null]
          .filter(Boolean)
          .join(' · '),
        searchText: [material.name, material.unit, material.category_name].join(' '),
      })),
    [materials]
  )
  const isMasterDataReady =
    !isMasterLoading &&
    projects.length > 0 &&
    materials.length > 0 &&
    availableMaterialSuppliers.length > 0

  useEffect(() => {
    fetchMasters().catch((fetchError) => {
      console.error('Gagal memuat master data faktur material:', fetchError)
    })
  }, [fetchMasters])

  useEffect(() => {
    if (isEditMode) {
      return
    }

    const nextDraft = {
      header,
      items,
    }

    writeMaterialInvoiceDraft(draftKey, nextDraft)
  }, [draftKey, header, items, isEditMode])

  useEffect(() => () => clearError(), [clearError])

  const setHeaderField = (field, value) => {
    setHeader((current) => ({
      ...current,
      [field]: value,
      ...(field === 'documentType' && value === 'surat_jalan'
        ? { paymentStatus: 'paid' }
        : {}),
    }))

    if (error) {
      clearError()
    }
  }

  const handleHeaderChange = (event) => {
    const { name, value } = event.target

    setHeaderField(name, value)
  }

  const handleItemChange = (itemId, field, value) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    )

    if (error) {
      clearError()
    }
  }

  const handleAddItem = (event) => {
    event?.preventDefault()
    event?.stopPropagation()
    setItems((current) => [...current, createLineItem()])
  }

  const handleRemoveItem = (event, itemId) => {
    event?.preventDefault()
    event?.stopPropagation()

    setItems((current) =>
      current.length > 1
        ? current.filter((item) => item.id !== itemId)
        : current
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (isSubmitting || !isMasterDataReady || isLocked) {
      return
    }

    try {
      const selectedProject = projects.find((project) => project.id === header.projectId)
      const selectedSupplier = availableMaterialSuppliers.find(
        (supplier) => supplier.id === header.supplierId
      )

      if (!selectedProject) {
        throw new Error('Proyek wajib dipilih.')
      }

      if (!selectedSupplier) {
        throw new Error('Supplier material wajib dipilih.')
      }

      const mappedItems = items.map((item, index) => {
        const selectedMaterial = materials.find(
          (material) => material.id === item.materialId
        )

        if (!selectedMaterial) {
          throw new Error(`Material pada baris ${index + 1} wajib dipilih.`)
        }

        const lineTotal = isDeliveryOrder ? 0 : getLineTotal(item)

        return {
          id: item.id,
          material_id: item.materialId,
          item_name: selectedMaterial?.name ?? '',
          qty: item.qty,
          unit_price: isDeliveryOrder ? 0 : item.unitPrice,
          line_total: lineTotal,
          sort_order: index + 1,
        }
      })

      const headerPayload = {
        telegram_user_id: user?.id ?? authUser?.telegram_user_id ?? null,
        userName: getUserDisplayName(user, authUser),
        expectedUpdatedAt: initialData?.updated_at ?? initialData?.updatedAt ?? null,
        project_id: header.projectId,
        project_name: selectedProject?.name ?? null,
        supplier_id: header.supplierId,
        supplier_name: selectedSupplier?.name ?? null,
        document_type: header.documentType,
        status: header.paymentStatus,
        expense_date: header.date,
        description: normalizeText(
          header.description,
          isDeliveryOrder ? 'Surat jalan material baru' : 'Faktur material baru'
        ),
      }

      const nextExpenseId = isEditMode
        ? await updateMaterialInvoice(recordId ?? initialData?.id, {
          headerData: headerPayload,
          itemsData: mappedItems,
        })
        : await submitMaterialInvoice(headerPayload, mappedItems)

      setSavedExpenseId(nextExpenseId?.id ?? recordId ?? initialData?.id ?? null)

      if (!isEditMode) {
        clearMaterialInvoiceDraft(draftKey)
      }

      setHeader(createInitialHeader(initialData))
      setItems(createInitialItems(initialData))
      if (typeof onSuccess === 'function') {
        await onSuccess()
      }

      if (typeof onClose === 'function') {
        await onClose()
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan faktur material.'

      console.error(message)
    }
  }

  return (
    <form id={resolvedFormId} className="space-y-6" onSubmit={handleSubmit}>
      <fieldset className="space-y-6" disabled={isSubmitting || isLocked}>
        <FormLayout
          embedded
          actionLabel={hideActions ? null : submitLabel}
          formId={hideActions ? null : resolvedFormId}
          isSubmitting={isSubmitting}
          sections={[
            {
              id: 'invoice-header',
              title: 'Header Faktur',
              description: 'Tentukan proyek, supplier, dan tipe dokumen.',
            },
            {
              id: 'invoice-items',
              title: 'Line Items',
              description: 'Tambahkan material dan kuantitas per baris.',
            },
            {
              id: 'invoice-attachment',
              title: 'Lampiran dan Simpan',
              description: 'Ringkasan, lampiran aktif, dan aksi simpan final.',
            },
          ]}
          submitDisabled={!isMasterDataReady || isLocked}
        >
          {hasBillPaymentHistory ? (
            <AppErrorState
              description="Faktur material yang sudah memiliki pembayaran tidak bisa diedit dari form ini. Gunakan detail bill untuk melihat histori pembayaran."
              title="Faktur terkunci"
            />
          ) : null}

          <FormSection
            eyebrow="Header"
            title={isDeliveryOrder ? 'Header Surat Jalan' : 'Header Faktur'}
            description="Tentukan proyek, supplier, tipe dokumen, lalu lengkapi tanggal dan konteks singkat."
          >
            <MasterPickerField
              disabled={isSubmitting || isMasterLoading || projects.length === 0}
              emptyMessage="Data proyek belum tersedia."
              label="Proyek"
              name="projectId"
              onChange={(nextValue) => setHeaderField('projectId', nextValue)}
              options={projectPickerOptions}
              placeholder="Pilih proyek"
              required
              searchPlaceholder="Cari proyek..."
              title="Pilih Proyek"
              value={header.projectId}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <MasterPickerField
                disabled={
                  isSubmitting ||
                  isMasterLoading ||
                  availableMaterialSuppliers.length === 0
                }
                emptyMessage="Data supplier material belum tersedia."
                label="Supplier"
                name="supplierId"
                onChange={(nextValue) => setHeaderField('supplierId', nextValue)}
                options={supplierPickerOptions}
                placeholder="Pilih supplier material"
                required
                searchPlaceholder="Cari supplier..."
                title="Pilih Supplier Material"
                value={header.supplierId}
              />

              <AppToggleGroup
                description="Jenis dokumen hanya punya dua mode dan tidak mengambil master data."
                label="Jenis Dokumen"
                onChange={(nextValue) => setHeaderField('documentType', nextValue)}
                options={[
                  { value: 'faktur', label: 'Faktur' },
                  { value: 'surat_jalan', label: 'Surat Jalan' },
                ]}
                value={header.documentType}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Tanggal
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name="date"
                  onChange={handleHeaderChange}
                  required
                  type="date"
                  value={header.date}
                />
              </label>

              <AppToggleGroup
                description={
                  isDeliveryOrder
                    ? 'Status pembayaran dikunci saat jenis dokumen surat jalan.'
                    : 'Status pembayaran hanya punya dua opsi dan tidak mengambil master data.'
                }
                disabled={isDeliveryOrder}
                label="Status Pembayaran"
                onChange={(nextValue) => setHeaderField('paymentStatus', nextValue)}
                options={[
                  { value: 'paid', label: 'Lunas' },
                  { value: 'unpaid', label: 'Hutang' },
                ]}
                value={header.paymentStatus}
              />
            </div>

            <details className="group rounded-[22px] border border-dashed border-[var(--app-outline-soft)] bg-[var(--app-surface-low-color)] px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--app-text-color)]">
                <span>Catatan opsional</span>
                <span className="text-xs font-medium text-[var(--app-hint-color)] group-open:hidden">
                  Tampilkan
                </span>
                <span className="hidden text-xs font-medium text-[var(--app-hint-color)] group-open:inline">
                  Sembunyikan
                </span>
              </summary>
              <div className="pt-4">
                <textarea
                  className="h-12 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name="description"
                  onChange={handleHeaderChange}
                  placeholder="Tambahkan konteks singkat untuk invoice material ini."
                  value={header.description}
                />
              </div>
            </details>
          </FormSection>

          <FormSection
            eyebrow="Item"
            title="Baris Material"
            description="Tambahkan material per baris. Qty dan harga satuan tetap mengikuti dokumen yang dicatat."
          >
            <div className="space-y-3">
              {items.map((item, index) => {
                const selectedMaterial = materials.find(
                  (material) => material.id === item.materialId
                )
                const lineTotal = getLineTotal(item)

                return (
                  <AppCard
                    key={item.id}
                    className="space-y-4 rounded-[24px] border border-slate-200 bg-white"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--app-text-color)]">
                          Item {index + 1}
                        </p>
                        <p className="text-xs text-[var(--app-hint-color)]">
                          {selectedMaterial?.unit
                            ? `Satuan: ${selectedMaterial.unit}`
                            : isDeliveryOrder
                              ? 'Pilih material dan qty barang yang diterima.'
                              : 'Pilih material, qty, dan harga satuan.'}
                        </p>
                      </div>

                      <AppButton
                        aria-label={`Hapus item ${index + 1}`}
                        className="shrink-0"
                        disabled={items.length === 1}
                        iconOnly
                        leadingIcon={<Trash2 className="h-4 w-4" />}
                        onClick={(event) => handleRemoveItem(event, item.id)}
                        type="button"
                        variant="danger"
                      />
                    </div>

                    <div className="grid gap-3">
                      <MasterPickerField
                        disabled={isSubmitting || isMasterLoading || materials.length === 0}
                        emptyMessage="Data material belum tersedia."
                        label="Material"
                        onChange={(nextValue) =>
                          handleItemChange(item.id, 'materialId', nextValue)
                        }
                        options={materialPickerOptions}
                        placeholder="Pilih material"
                        required
                        searchPlaceholder="Cari material..."
                        title={`Pilih Material ${index + 1}`}
                        value={item.materialId}
                      />

                      <div className={`grid gap-3 ${isDeliveryOrder ? '' : 'sm:grid-cols-2'}`}>
                        <label className="block space-y-2">
                          <span className="text-sm font-medium text-[var(--app-text-color)]">
                            Qty
                          </span>
                          <input
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                            inputMode="decimal"
                            min="0.01"
                            onChange={(event) =>
                              handleItemChange(item.id, 'qty', event.target.value)
                            }
                            placeholder="0"
                            required
                            step="0.01"
                            type="number"
                            value={item.qty}
                          />
                        </label>

                        {isDeliveryOrder ? null : (
                          <label className="block space-y-2">
                            <span className="text-sm font-medium text-[var(--app-text-color)]">
                              Harga Satuan
                            </span>
                            <AppNominalInput
                              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                              onValueChange={(nextValue) =>
                                handleItemChange(item.id, 'unitPrice', nextValue)
                              }
                              placeholder="Rp 0"
                              required
                              value={item.unitPrice}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {isDeliveryOrder ? null : (
                      <div className="mt-4 rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-low-color)] px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--app-hint-color)]">
                          Subtotal
                        </p>
                        <p className="mt-2 text-lg font-semibold text-[var(--app-text-color)]">
                          {formatCurrency(lineTotal)}
                        </p>
                      </div>
                    )}
                  </AppCard>
                )
              })}
            </div>

            <AppButton
              className="w-full"
              leadingIcon={<Plus className="h-4 w-4" />}
              onClick={handleAddItem}
              type="button"
              variant="secondary"
            >
              Tambah Item
            </AppButton>
          </FormSection>

          <FormSection
            eyebrow="Lampiran"
            title="Ringkasan dan Lampiran"
            description="Periksa total akhir, lampiran aktif, dan simpan dari footer halaman."
          >
            {isDeliveryOrder ? (
              <AppCard className="app-tone-info">
                <div className="space-y-2">
                  <p className="app-meta text-[var(--app-tone-info-text)]">
                    Ringkasan Surat Jalan
                  </p>
                  <p className="text-sm leading-6">
                    {items.length} item material akan dicatat sebagai barang masuk tanpa nilai faktur.
                  </p>
                </div>
              </AppCard>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <AppCard className="space-y-2 bg-white">
                  <p className="app-meta">Total</p>
                  <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                    {formatCurrency(totalAmount)}
                  </p>
                </AppCard>
                <AppCard className="space-y-2 bg-white">
                  <p className="app-meta">Jumlah Item</p>
                  <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
                    {items.length}
                  </p>
                </AppCard>
              </div>
            )}

            {error ? <AppErrorState description={error} title="Form belum valid" /> : null}

            {masterError ? (
              <AppErrorState description={masterError} title="Master data belum siap" />
            ) : null}

            {materials.length === 0 && !isMasterLoading ? (
              <AppErrorState
                description="Data material masih kosong. Tambahkan master material di database agar faktur bisa disimpan."
                title="Material belum tersedia"
              />
            ) : null}

            <ExpenseAttachmentSection
              deferUploadUntilParentSaved
              expenseId={activeExpenseId}
              title="Lampiran Bukti"
            />
          </FormSection>
        </FormLayout>
      </fieldset>
    </form>
  )
}

export default MaterialInvoiceForm
