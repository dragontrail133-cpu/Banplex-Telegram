import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Plus, Sparkles, Trash2, Upload } from 'lucide-react'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useMasterStore from '../store/useMasterStore'
import useTransactionStore from '../store/useTransactionStore'
import { compressImageFile } from '../lib/attachment-upload'
import { getAppTodayKey } from '../lib/date-time'
import {
  MATERIAL_REVIEW_STATUS,
} from '../lib/material-invoice-ai'
import { extractMaterialInvoiceAiDraftFromApi } from '../lib/records-api'
import useMutationToast from '../hooks/useMutationToast'
import ExpenseAttachmentSection from './ExpenseAttachmentSection'
import FormLayout from './layouts/FormLayout'
import { supplierTypeGroups } from './master/masterTabs'
import MasterPickerField from './ui/MasterPickerField'
import {
  AppCard,
  AppButton,
  AppErrorState,
  AppNominalInput,
  AppSheet,
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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'))
    reader.readAsDataURL(file)
  })
}

function stripDataUrlPrefix(value) {
  const rawValue = String(value ?? '')

  return rawValue.includes(',') ? rawValue.slice(rawValue.indexOf(',') + 1) : rawValue
}

function normalizeAiInputValue(value) {
  if (value === '' || value == null) {
    return ''
  }

  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) && parsedValue > 0 ? String(parsedValue) : ''
}

function normalizeSupplierName(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
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
  const [pendingMaterialDrafts, setPendingMaterialDrafts] = useState(() =>
    Array.isArray(draftSnapshot?.materialDrafts) ? draftSnapshot.materialDrafts : []
  )
  const [savedExpenseId, setSavedExpenseId] = useState(
    recordId ?? initialData?.id ?? null
  )
  const [attachmentResetRequestId, setAttachmentResetRequestId] = useState(null)
  const [activeItemIndex, setActiveItemIndex] = useState(0)
  const [isAiSheetOpen, setIsAiSheetOpen] = useState(false)
  const [aiFile, setAiFile] = useState(null)
  const [aiFilePreviewUrl, setAiFilePreviewUrl] = useState('')
  const [aiDraft, setAiDraft] = useState(null)
  const [aiReviewRows, setAiReviewRows] = useState([])
  const [activeAiReviewIndex, setActiveAiReviewIndex] = useState(0)
  const [aiError, setAiError] = useState('')
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const skipNextDraftWriteRef = useRef(false)
  const aiFileInputRef = useRef(null)
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
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
  const { begin, clear, fail, succeed } = useMutationToast()
  const totalAmount = items.reduce((sum, item) => sum + getLineTotal(item), 0)
  const isDeliveryOrder = header.documentType === 'surat_jalan'
  const isEditMode = Boolean(recordId ?? initialData?.id)
  const isCreateMode = !isEditMode
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
  const hasPendingMaterialDraftRows = items.some((item) => item.materialDraftId)
  const isMasterDataReady =
    !isMasterLoading &&
    projects.length > 0 &&
    (materials.length > 0 || hasPendingMaterialDraftRows) &&
    availableMaterialSuppliers.length > 0
  const activeItem = items[activeItemIndex] ?? items[0] ?? null
  const activeItemMaterial = activeItem
    ? materials.find((material) => material.id === activeItem.materialId) ?? null
    : null
  const activeAiReviewRow = aiReviewRows[activeAiReviewIndex] ?? aiReviewRows[0] ?? null

  const handleAttachmentResetSettled = useCallback(
    async (requestId) => {
      if (!isCreateMode || !requestId || requestId !== attachmentResetRequestId) {
        return
      }

      setAttachmentResetRequestId(null)
      clearMaterialInvoiceDraft(draftKey)
      skipNextDraftWriteRef.current = true
      setHeader(createInitialHeader(initialData))
      setItems(createInitialItems(initialData))
      setPendingMaterialDrafts([])
      setActiveItemIndex(0)
      setAiFile(null)
      setAiDraft(null)
      setAiReviewRows([])
      setActiveAiReviewIndex(0)
      setAiError('')
      setSavedExpenseId(null)

      try {
        if (typeof onSuccess === 'function') {
          await onSuccess()
        }
      } catch (refreshError) {
        console.error('Gagal memproses hasil simpan form:', refreshError)
      }

      if (typeof onClose === 'function') {
        await onClose()
      }

      succeed({
        title: 'Faktur material tersimpan',
        message: 'Faktur material berhasil dicatat.',
      })
    },
    [attachmentResetRequestId, draftKey, initialData, isCreateMode, onClose, onSuccess, succeed]
  )

  useEffect(() => {
    fetchMasters().catch((fetchError) => {
      console.error('Gagal memuat master data faktur material:', fetchError)
    })
  }, [fetchMasters])

  useEffect(() => {
    if (isEditMode) {
      return
    }

    if (skipNextDraftWriteRef.current) {
      skipNextDraftWriteRef.current = false
      return
    }

    const nextDraft = {
      header,
      items,
      materialDrafts: pendingMaterialDrafts,
    }

    writeMaterialInvoiceDraft(draftKey, nextDraft)
  }, [draftKey, header, items, isEditMode, pendingMaterialDrafts])

  useEffect(() => () => clearError(), [clearError])
  useEffect(() => () => clear(), [clear])
  useEffect(() => {
    if (!aiFile) {
      setAiFilePreviewUrl('')
      return undefined
    }

    const previewUrl = URL.createObjectURL(aiFile)
    setAiFilePreviewUrl(previewUrl)

    return () => URL.revokeObjectURL(previewUrl)
  }, [aiFile])
  useEffect(() => {
    setActiveItemIndex((currentIndex) => {
      if (items.length === 0) {
        return 0
      }

      return Math.min(currentIndex, items.length - 1)
    })
  }, [items.length])
  useEffect(() => {
    setActiveAiReviewIndex((currentIndex) => {
      if (aiReviewRows.length === 0) {
        return 0
      }

      return Math.min(currentIndex, aiReviewRows.length - 1)
    })
  }, [aiReviewRows.length])

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

  const handleItemMaterialChange = (itemId, nextValue) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              materialId: nextValue,
              materialDraftId: '',
              materialDraftName: '',
              materialDraftUnit: '',
            }
          : item
      )
    )

    if (error) {
      clearError()
    }
  }

  const handleAiFileChange = (event) => {
    const file = event.target.files?.[0] ?? null

    setAiFile(file)
    setAiDraft(null)
    setAiReviewRows([])
    setActiveAiReviewIndex(0)
    setAiError('')
    event.target.value = ''
  }

  const handleAiFileReset = () => {
    setAiFile(null)
    setAiDraft(null)
    setAiReviewRows([])
    setActiveAiReviewIndex(0)
    setAiError('')

    if (aiFileInputRef.current) {
      aiFileInputRef.current.value = ''
    }
  }

  const handleAiExtract = async () => {
    if (!aiFile) {
      setAiError('Pilih foto atau screenshot faktur terlebih dahulu.')
      return
    }

    if (!currentTeamId) {
      setAiError('Akses workspace tidak ditemukan.')
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(aiFile.type)) {
      setAiError('File harus berupa gambar JPEG, PNG, atau WEBP.')
      return
    }

    setIsAiProcessing(true)
    setAiError('')

    try {
      const { file: compressedFile } = await compressImageFile(aiFile, {
        thresholdBytes: 1024 * 1024,
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.82,
      })
      const dataUrl = await readFileAsDataUrl(compressedFile)
      const result = await extractMaterialInvoiceAiDraftFromApi({
        teamId: currentTeamId,
        imageDataBase64: stripDataUrlPrefix(dataUrl),
        mimeType: compressedFile.type || aiFile.type,
        fileName: aiFile.name,
      })

      setAiDraft(result.draft)
      setAiReviewRows(Array.isArray(result.review) ? result.review : [])
      setActiveAiReviewIndex(0)
    } catch (extractError) {
      setAiError(
        extractError instanceof Error
          ? extractError.message
          : 'AI gagal membaca faktur.'
      )
    } finally {
      setIsAiProcessing(false)
    }
  }

  const handleAiRowChange = (tempId, patch) => {
    setAiReviewRows((current) =>
      current.map((row) =>
        row.tempId === tempId
          ? {
              ...row,
              ...patch,
            }
          : row
      )
    )
  }

  const handleAiRowMaterialChange = (row, materialId) => {
    const selectedMaterial = materials.find((material) => material.id === materialId)

    handleAiRowChange(row.tempId, {
      status: selectedMaterial
        ? MATERIAL_REVIEW_STATUS.MATCHED
        : MATERIAL_REVIEW_STATUS.NEW_MATERIAL,
      selectedMaterialId: selectedMaterial?.id ?? '',
      selectedMaterialName: selectedMaterial?.name ?? '',
      selectedMaterialUnit: selectedMaterial?.unit ?? '',
      materialDraftName: selectedMaterial ? '' : row.name,
      materialDraftUnit: selectedMaterial ? '' : row.unit,
      missingUnit: selectedMaterial ? false : !normalizeText(row.unit, ''),
    })
  }

  const validateAiReviewRows = () => {
    if (aiReviewRows.length === 0) {
      return 'Belum ada hasil AI untuk diterapkan.'
    }

    const invalidIndex = aiReviewRows.findIndex((row) => row.status === MATERIAL_REVIEW_STATUS.INVALID)

    if (invalidIndex >= 0) {
      return `Item AI ${invalidIndex + 1} belum valid.`
    }

    const missingMaterialIndex = aiReviewRows.findIndex((row) => {
      if (row.selectedMaterialId) {
        return false
      }

      return !normalizeText(row.materialDraftName, '') || !normalizeText(row.materialDraftUnit, '')
    })

    if (missingMaterialIndex >= 0) {
      return `Nama dan satuan master baru pada item ${missingMaterialIndex + 1} wajib diisi.`
    }

    return null
  }

  const handleApplyAiDraft = () => {
    const validationError = validateAiReviewRows()

    if (validationError) {
      setAiError(validationError)
      return
    }

    const nextMaterialDrafts = []
    const nextItems = aiReviewRows.map((row, index) => {
      const selectedMaterialId = normalizeText(row.selectedMaterialId, '')
      const materialDraftName = normalizeText(row.materialDraftName ?? row.name, '')
      const materialDraftUnit = normalizeText(row.materialDraftUnit ?? row.unit, '')
      const draftId = row.tempId || `ai-draft-${Date.now()}-${index}`

      if (!selectedMaterialId) {
        nextMaterialDrafts.push({
          tempId: draftId,
          name: materialDraftName,
          unit: materialDraftUnit,
        })
      }

      return {
        id: `ai-item-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
        materialId: selectedMaterialId,
        materialDraftId: selectedMaterialId ? '' : draftId,
        materialDraftName: selectedMaterialId ? '' : materialDraftName,
        materialDraftUnit: selectedMaterialId ? '' : materialDraftUnit,
        qty: normalizeAiInputValue(row.qty),
        unitPrice: normalizeAiInputValue(row.unitPrice),
      }
    })
    const normalizedSupplier = normalizeSupplierName(aiDraft?.supplierName)
    const matchedSupplier = normalizedSupplier
      ? availableMaterialSuppliers.find(
          (supplier) => normalizeSupplierName(supplier.name) === normalizedSupplier
        )
      : null

    setPendingMaterialDrafts(nextMaterialDrafts)
    setItems(nextItems.length > 0 ? nextItems : [createLineItem()])
    setActiveItemIndex(0)
    setHeader((current) => ({
      ...current,
      supplierId: current.supplierId || matchedSupplier?.id || current.supplierId,
      date: aiDraft?.documentDate || current.date,
      description:
        current.description ||
        (aiDraft?.invoiceNumber ? `Faktur ${aiDraft.invoiceNumber}` : current.description),
    }))
    setIsAiSheetOpen(false)
    setAiError('')
  }

  const handleAddItem = (event) => {
    event?.preventDefault()
    event?.stopPropagation()
    setItems((current) => [...current, createLineItem()])
    setActiveItemIndex(items.length)
  }

  const handleRemoveItem = (event) => {
    event?.preventDefault()
    event?.stopPropagation()

    setItems((current) =>
      current.length > 1
        ? current.filter((_, index) => index !== activeItemIndex)
        : current
    )
    setActiveItemIndex((currentIndex) => Math.max(0, currentIndex - 1))
  }

  const handleNavigateItem = (delta) => {
    setActiveItemIndex((currentIndex) =>
      Math.max(0, Math.min(items.length - 1, currentIndex + delta))
    )
  }

  const handleNavigateAiReview = (delta) => {
    setActiveAiReviewIndex((currentIndex) =>
      Math.max(0, Math.min(aiReviewRows.length - 1, currentIndex + delta))
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (isSubmitting || !isMasterDataReady || isLocked || (isCreateMode && attachmentResetRequestId)) {
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

      const materialDraftById = new Map(
        pendingMaterialDrafts.map((draft) => [draft.tempId, draft])
      )
      const mappedItems = items.map((item, index) => {
        const selectedMaterial = materials.find(
          (material) => material.id === item.materialId
        )
        const materialDraft = item.materialDraftId
          ? materialDraftById.get(item.materialDraftId)
          : null

        if (!selectedMaterial && !materialDraft) {
          throw new Error(`Material pada baris ${index + 1} wajib dipilih.`)
        }

        if (
          materialDraft &&
          (!normalizeText(materialDraft.name, '') || !normalizeText(materialDraft.unit, ''))
        ) {
          throw new Error(`Master barang baru pada baris ${index + 1} belum lengkap.`)
        }

        const lineTotal = isDeliveryOrder ? 0 : getLineTotal(item)

        return {
          id: item.id,
          material_id: item.materialId,
          material_draft_id: materialDraft?.tempId ?? null,
          item_name: selectedMaterial?.name ?? materialDraft?.name ?? '',
          qty: item.qty,
          unit_price: isDeliveryOrder ? 0 : item.unitPrice,
          line_total: lineTotal,
          sort_order: index + 1,
        }
      })
      const usedMaterialDraftIds = new Set(
        mappedItems.map((item) => item.material_draft_id).filter(Boolean)
      )
      const materialDraftsForSubmit = pendingMaterialDrafts.filter((draft) =>
        usedMaterialDraftIds.has(draft.tempId)
      )

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

      begin({
        title: isEditMode ? 'Memperbarui faktur material' : 'Menyimpan faktur material',
        message: 'Mohon tunggu sampai proses selesai.',
      })

      const nextExpenseId = isEditMode
        ? await updateMaterialInvoice(recordId ?? initialData?.id, {
          headerData: headerPayload,
          itemsData: mappedItems,
        })
        : await submitMaterialInvoice(headerPayload, mappedItems, {
            materialDrafts: materialDraftsForSubmit,
          })

      setSavedExpenseId(nextExpenseId?.id ?? recordId ?? initialData?.id ?? null)

      if (!isEditMode && nextExpenseId?.id) {
        setAttachmentResetRequestId(nextExpenseId.id)
        return
      }

      setHeader(createInitialHeader(initialData))
      setItems(createInitialItems(initialData))
      setPendingMaterialDrafts([])
      if (typeof onSuccess === 'function') {
        await onSuccess()
      }

      if (typeof onClose === 'function') {
        await onClose()
      }

      succeed({
        title: isEditMode ? 'Faktur material diperbarui' : 'Faktur material tersimpan',
        message: isEditMode
          ? 'Perubahan faktur material berhasil disimpan.'
          : 'Faktur material berhasil dicatat.',
      })
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan faktur material.'

      fail({
        title: isEditMode ? 'Faktur material gagal diperbarui' : 'Faktur material gagal disimpan',
        message,
      })
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
          submitDisabled={
            !isMasterDataReady || isLocked || (isCreateMode && Boolean(attachmentResetRequestId))
          }
        >
          {hasBillPaymentHistory ? (
            <AppErrorState
              description="Faktur terkunci karena ada pembayaran. Gunakan detail bill untuk histori."
              title="Faktur terkunci"
            />
          ) : null}

          <FormSection
            eyebrow="Header"
            title={isDeliveryOrder ? 'Header Surat Jalan' : 'Header Faktur'}
            description="Isi konteks dasar faktur."
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
                description="Faktur atau surat jalan."
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
                    ? 'Surat jalan selalu dikunci.'
                    : 'Lunas atau hutang.'
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
            description="Tambahkan material per baris."
          >
            {isCreateMode ? (
              <AppCard className="app-tone-info">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="app-meta text-[var(--app-tone-info-text)]">
                      Input dari foto
                    </p>
                    <p className="text-sm leading-6">
                      Scan faktur untuk isi item.
                    </p>
                  </div>
                  <AppButton
                    leadingIcon={<Sparkles className="h-4 w-4" />}
                    onClick={() => setIsAiSheetOpen(true)}
                    type="button"
                    variant="secondary"
                  >
                    Scan AI
                  </AppButton>
                </div>
              </AppCard>
            ) : null}

            <div className="space-y-3">
              {activeItem ? (
                <AppCard
                  key={activeItem.id}
                  className="space-y-4 rounded-[24px] border border-slate-200 bg-white"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-[var(--app-text-color)]">
                        Item {activeItemIndex + 1}
                      </p>
                      <p className="text-xs text-[var(--app-hint-color)]">
                        Baris {activeItemIndex + 1} dari {items.length}
                      </p>
                      <p className="text-xs text-[var(--app-hint-color)]">
                        {activeItem.materialDraftId
                          ? `Barang baru: ${[activeItem.materialDraftName, activeItem.materialDraftUnit]
                              .filter(Boolean)
                              .join(' / ')}`
                          : activeItemMaterial?.unit
                            ? `Satuan: ${activeItemMaterial.unit}`
                            : isDeliveryOrder
                              ? 'Pilih material dan qty barang yang diterima.'
                              : 'Pilih material, qty, dan harga satuan.'}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <AppButton
                        aria-label={`Hapus item ${activeItemIndex + 1}`}
                        className="shrink-0"
                        disabled={items.length === 1}
                        iconOnly
                        leadingIcon={<Trash2 className="h-4 w-4" />}
                        onClick={handleRemoveItem}
                        type="button"
                        variant="danger"
                      />
                      <AppButton
                        className="shrink-0"
                        leadingIcon={<Plus className="h-4 w-4" />}
                        onClick={handleAddItem}
                        size="sm"
                        type="button"
                        variant="secondary"
                      >
                        Tambah
                      </AppButton>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {activeItem.materialDraftId ? (
                      <AppCard className="app-tone-warning px-3 py-3" padded={false}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--app-tone-warning-text)]">
                              Master baru saat simpan
                            </p>
                            <p className="text-sm font-semibold text-[var(--app-text-color)]">
                              {[activeItem.materialDraftName, activeItem.materialDraftUnit]
                                .filter(Boolean)
                                .join(' / ')}
                            </p>
                          </div>
                          <AppButton
                            onClick={() => handleItemChange(activeItem.id, 'materialDraftId', '')}
                            size="sm"
                            type="button"
                            variant="secondary"
                          >
                            Batal
                          </AppButton>
                        </div>
                      </AppCard>
                    ) : null}

                    <MasterPickerField
                      disabled={isSubmitting || isMasterLoading || materials.length === 0}
                      emptyMessage="Data material belum tersedia."
                      label="Material"
                      onChange={(nextValue) => handleItemMaterialChange(activeItem.id, nextValue)}
                      options={materialPickerOptions}
                      placeholder={activeItem.materialDraftId ? 'Ganti ke master existing' : 'Pilih material'}
                      required={!activeItem.materialDraftId}
                      searchPlaceholder="Cari material..."
                      title={`Pilih Material ${activeItemIndex + 1}`}
                      value={activeItem.materialId}
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
                            handleItemChange(activeItem.id, 'qty', event.target.value)
                          }
                          placeholder="0"
                          required
                          step="0.01"
                          type="number"
                          value={activeItem.qty}
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
                              handleItemChange(activeItem.id, 'unitPrice', nextValue)
                            }
                            placeholder="Rp 0"
                            required
                            value={activeItem.unitPrice}
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
                        {formatCurrency(getLineTotal(activeItem))}
                      </p>
                    </div>
                  )}
                </AppCard>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <AppButton
                  disabled={items.length <= 1 || activeItemIndex === 0}
                  onClick={() => handleNavigateItem(-1)}
                  type="button"
                  variant="secondary"
                >
                  Kembali
                </AppButton>
                <AppButton
                  disabled={items.length <= 1 || activeItemIndex >= items.length - 1}
                  onClick={() => handleNavigateItem(1)}
                  type="button"
                  variant="secondary"
                >
                  Lanjut
                </AppButton>
              </div>
            </div>
          </FormSection>

          <FormSection
            eyebrow="Lampiran"
            title="Ringkasan dan Lampiran"
            description="Periksa total, lampiran, lalu simpan."
          >
            {isDeliveryOrder ? (
              <AppCard className="app-tone-info">
                <div className="space-y-2">
                  <p className="app-meta text-[var(--app-tone-info-text)]">
                    Ringkasan Surat Jalan
                  </p>
                  <p className="text-sm leading-6">
                    {items.length} item dicatat sebagai barang masuk.
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

            {materials.length === 0 && !isMasterLoading && !hasPendingMaterialDraftRows ? (
              <AppErrorState
                description="Master material masih kosong. Scan faktur untuk menyiapkan master baru."
                title="Material belum tersedia"
              />
            ) : null}

            <ExpenseAttachmentSection
              attachmentResetRequestId={isCreateMode ? attachmentResetRequestId : null}
              deferUploadUntilParentSaved
              expenseId={activeExpenseId}
              onAttachmentResetSettled={isCreateMode ? handleAttachmentResetSettled : null}
              title="Lampiran Bukti"
            />
          </FormSection>
        </FormLayout>
      </fieldset>

      <AppSheet
        description="Review hasil AI sebelum diterapkan."
        footer={
          <div className="grid grid-cols-2 gap-2">
            <AppButton
              disabled={isAiProcessing}
              onClick={() => setIsAiSheetOpen(false)}
              type="button"
              variant="secondary"
            >
              Tutup
            </AppButton>
            <AppButton
              disabled={isAiProcessing || aiReviewRows.length === 0}
              onClick={handleApplyAiDraft}
              type="button"
            >
              Terapkan
            </AppButton>
          </div>
        }
        maxWidth="lg"
        onClose={() => setIsAiSheetOpen(false)}
        open={isAiSheetOpen}
        title="Scan Faktur Barang"
      >
        <div className="space-y-4">
          <AppCard className="space-y-3 bg-white">
            <input
              ref={aiFileInputRef}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAiFileChange}
              type="file"
            />

            <div className="flex items-center gap-3">
              <div className="group relative h-20 w-20 shrink-0">
                <button
                  aria-label={aiFile ? `Ganti file ${aiFile.name}` : 'Pilih file gambar untuk scan AI'}
                  className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--app-outline-soft)] bg-[var(--app-surface-low-color)] transition active:scale-[0.99] hover:border-sky-400 hover:bg-sky-50 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  onClick={() => aiFileInputRef.current?.click()}
                  type="button"
                >
                  {aiFilePreviewUrl ? (
                    <img
                      alt={aiFile?.name ?? 'Pratinjau file scan'}
                      className="h-full w-full object-cover"
                      src={aiFilePreviewUrl}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[var(--app-hint-color)]">
                      <Upload className="h-5 w-5" />
                      <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                        Pilih
                      </span>
                    </div>
                  )}
                </button>

                {aiFile ? (
                  <button
                    aria-label={`Hapus file ${aiFile.name}`}
                    className="absolute right-1 top-1 rounded-full border border-[var(--app-border-color)] bg-white/95 px-2 py-1 text-[11px] font-semibold text-[var(--app-text-color)] shadow-sm transition hover:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    disabled={isAiProcessing}
                    onClick={handleAiFileReset}
                    type="button"
                  >
                    Hapus
                  </button>
                ) : null}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                  {aiFile?.name ?? 'Ketuk untuk pilih gambar'}
                </p>
                <p className="text-xs leading-5 text-[var(--app-hint-color)]">
                  {aiFile ? 'Ketuk thumbnail untuk ganti file.' : 'JPEG, PNG, atau WEBP.'}
                </p>
              </div>
            </div>

            <AppButton
              disabled={!aiFile || isAiProcessing}
              leadingIcon={<Sparkles className="h-4 w-4" />}
              onClick={handleAiExtract}
              type="button"
              fullWidth
            >
              {isAiProcessing ? 'Proses...' : 'Proses AI'}
            </AppButton>
          </AppCard>

          {aiError ? <AppErrorState description={aiError} title="Review AI belum valid" /> : null}

          {aiReviewRows.length > 0 ? (
            <div className="space-y-3">
              {activeAiReviewRow ? (
                <AppCard
                  key={activeAiReviewRow.tempId}
                  className="space-y-4 rounded-[24px] border border-slate-200 bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-[var(--app-text-color)]">
                        Item {activeAiReviewIndex + 1} dari {aiReviewRows.length}
                      </p>
                      <p className="text-xs leading-5 text-[var(--app-hint-color)]">
                        {activeAiReviewRow.reason}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--app-outline-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--app-text-color)]">
                      {activeAiReviewRow.status === MATERIAL_REVIEW_STATUS.INVALID ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : activeAiReviewRow.status === MATERIAL_REVIEW_STATUS.MATCHED ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {activeAiReviewRow.status === MATERIAL_REVIEW_STATUS.MATCHED
                        ? 'Cocok'
                        : activeAiReviewRow.status === MATERIAL_REVIEW_STATUS.INVALID
                          ? 'Salah'
                          : 'Cek'}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block space-y-2 sm:col-span-2">
                      <span className="text-sm font-medium text-[var(--app-text-color)]">
                        Nama
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                        onChange={(event) =>
                          handleAiRowChange(activeAiReviewRow.tempId, {
                            name: event.target.value,
                            materialDraftName: !activeAiReviewRow.selectedMaterialId
                              ? event.target.value
                              : activeAiReviewRow.materialDraftName,
                          })
                        }
                        value={activeAiReviewRow.name}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-[var(--app-text-color)]">
                        Qty
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                        inputMode="decimal"
                        min="0.01"
                        onChange={(event) =>
                          handleAiRowChange(activeAiReviewRow.tempId, {
                            qty: event.target.value,
                          })
                        }
                        step="0.01"
                        type="number"
                        value={activeAiReviewRow.qty}
                      />
                    </label>
                  </div>

                  {activeAiReviewRow.status !== MATERIAL_REVIEW_STATUS.INVALID ? (
                    <div className="space-y-3">
                      {Array.isArray(activeAiReviewRow.candidates) &&
                      activeAiReviewRow.candidates.length > 0 ? (
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-[var(--app-hint-color)]">
                            Saran cepat
                          </p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {activeAiReviewRow.candidates.map((candidate) => (
                              <button
                                key={candidate.id}
                                className="min-h-8 px-0 py-1 text-left text-sm font-medium text-[var(--app-link-color)] underline decoration-dotted underline-offset-4"
                                onClick={() =>
                                  handleAiRowMaterialChange(activeAiReviewRow, candidate.id)
                                }
                                type="button"
                              >
                                {candidate.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <MasterPickerField
                        disabled={materials.length === 0}
                        emptyMessage="Master belum ada."
                        label="Pilih master"
                        onChange={(nextValue) => handleAiRowMaterialChange(activeAiReviewRow, nextValue)}
                        options={materialPickerOptions}
                        placeholder="Pilih jika cocok"
                        searchPlaceholder="Cari master..."
                        title={`Pilih Master ${activeAiReviewIndex + 1}`}
                        value={activeAiReviewRow.selectedMaterialId}
                      />
                      {activeAiReviewRow.selectedMaterialId ? (
                        <AppButton
                          onClick={() => handleAiRowMaterialChange(activeAiReviewRow, '')}
                          size="sm"
                          type="button"
                          variant="secondary"
                        >
                          Barang baru
                        </AppButton>
                      ) : null}
                    </div>
                  ) : null}

                  {activeAiReviewRow.status !== MATERIAL_REVIEW_STATUS.INVALID &&
                  !activeAiReviewRow.selectedMaterialId ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-[var(--app-text-color)]">
                          Nama baru
                        </span>
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                          onChange={(event) =>
                            handleAiRowChange(activeAiReviewRow.tempId, {
                              materialDraftName: event.target.value,
                            })
                          }
                          value={activeAiReviewRow.materialDraftName ?? activeAiReviewRow.name}
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-[var(--app-text-color)]">
                          Satuan baru
                        </span>
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                          onChange={(event) =>
                            handleAiRowChange(activeAiReviewRow.tempId, {
                              materialDraftUnit: event.target.value,
                              missingUnit: !normalizeText(event.target.value, ''),
                            })
                          }
                          placeholder="sak, kg, m3"
                          value={activeAiReviewRow.materialDraftUnit ?? activeAiReviewRow.unit}
                        />
                      </label>
                    </div>
                  ) : null}

                  {isDeliveryOrder ? null : (
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-[var(--app-text-color)]">
                        Harga
                      </span>
                      <AppNominalInput
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                        onValueChange={(nextValue) =>
                          handleAiRowChange(activeAiReviewRow.tempId, {
                            unitPrice: nextValue,
                          })
                        }
                        placeholder="Rp 0"
                        value={activeAiReviewRow.unitPrice}
                      />
                    </label>
                  )}
                </AppCard>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <AppButton
                  disabled={aiReviewRows.length <= 1 || activeAiReviewIndex === 0}
                  onClick={() => handleNavigateAiReview(-1)}
                  type="button"
                  variant="secondary"
                >
                  Kembali
                </AppButton>
                <AppButton
                  disabled={
                    aiReviewRows.length <= 1 || activeAiReviewIndex >= aiReviewRows.length - 1
                  }
                  onClick={() => handleNavigateAiReview(1)}
                  type="button"
                  variant="secondary"
                >
                  Lanjut
                </AppButton>
              </div>
            </div>
          ) : null}
        </div>
      </AppSheet>
    </form>
  )
}

export default MaterialInvoiceForm
