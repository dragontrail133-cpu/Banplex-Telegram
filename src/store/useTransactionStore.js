import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { resolveProfileId, resolveTeamId, resolveTelegramUserId } from '../lib/auth-context'
import {
  createExpenseFromApi,
  attachExpenseAttachmentFromApi,
  createMaterialInvoiceFromApi,
  fetchExpenseByIdFromApi,
  fetchExpenseAttachmentsFromApi,
  fetchMaterialInvoiceByIdFromApi,
  permanentDeleteExpenseAttachmentFromApi,
  restoreExpenseFromApi,
  restoreExpenseAttachmentFromApi,
  restoreMaterialInvoiceFromApi,
  softDeleteExpenseFromApi,
  softDeleteExpenseAttachmentFromApi,
  softDeleteMaterialInvoiceFromApi,
  updateExpenseFromApi,
  updateMaterialInvoiceFromApi,
} from '../lib/records-api'
import useToastStore from './useToastStore'

async function notifyTelegram(payload) {
  const response = await fetch('/api/notify', {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Gagal mengirim notifikasi Telegram.')
  }

  return result
}

function showToast(toast) {
  useToastStore.getState().showToast(toast)
}

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toError(error) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : 'Gagal menyimpan transaksi. Silakan coba lagi.'

  return error instanceof Error ? error : new Error(message)
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : NaN
}

function buildNotificationPayload(data = {}, transactionId, amount) {
  return {
    transactionId,
    transactionDate: normalizeText(data.transaction_date),
    userName: normalizeText(data.userName, 'Pengguna Telegram'),
    type: normalizeText(data.type, 'income'),
    amount,
    category: normalizeText(data.category_name, normalizeText(data.category, '-')),
    description: normalizeText(data.description, '-'),
  }
}

function buildExpensePayload(data = {}) {
  const telegramUserId = resolveTelegramUserId(data.telegram_user_id)
  const createdByUserId = resolveProfileId(data.created_by_user_id)
  const teamId = resolveTeamId(data.team_id)
  const projectId = normalizeText(data.project_id)
  const categoryId = normalizeText(data.category_id ?? data.expense_category_id)
  const supplierId = normalizeText(data.supplier_id)
  const expenseType = normalizeText(data.expense_type, 'operasional')
  const expenseDate = normalizeText(data.expense_date ?? data.transaction_date)
  const status = normalizeText(data.status, 'unpaid')
  const description = normalizeText(data.description)
  const notes = normalizeText(data.notes)
  const amount = Number(data.amount)
  const projectNameSnapshot = normalizeText(data.project_name)
  const supplierName =
    normalizeText(data.supplier_name, null) ??
    normalizeText(data.supplierName, null) ??
    normalizeText(data.supplier_name_snapshot, null)
  const supplierNameSnapshot = supplierName

  if (!telegramUserId) {
    throw new Error('ID pengguna Telegram tidak ditemukan.')
  }

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  if (!projectId) {
    throw new Error('Proyek wajib dipilih.')
  }

  if (!categoryId) {
    throw new Error('Kategori pengeluaran wajib dipilih.')
  }

  if (!['operasional', 'lainnya'].includes(expenseType)) {
    throw new Error('Tipe pengeluaran tidak valid.')
  }

  if (!expenseDate) {
    throw new Error('Tanggal pengeluaran wajib diisi.')
  }

  if (!['unpaid', 'paid'].includes(status)) {
    throw new Error('Status pembayaran pengeluaran tidak valid.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal pengeluaran harus lebih dari 0.')
  }

  if (!description) {
    throw new Error('Deskripsi pengeluaran wajib diisi.')
  }

  if (!supplierName) {
    throw new Error('Supplier wajib dipilih.')
  }

  return {
    telegram_user_id: telegramUserId,
    created_by_user_id: createdByUserId,
    team_id: teamId,
    project_id: projectId,
    category_id: categoryId,
    supplier_id: supplierId,
    expense_type: expenseType,
    document_type: 'faktur',
    status,
    expense_date: expenseDate,
    amount,
    total_amount: amount,
    description,
    notes,
    project_name_snapshot: projectNameSnapshot,
    supplier_name: supplierName,
    supplier_name_snapshot: supplierNameSnapshot,
  }
}

function buildMaterialInvoicePayload(headerData = {}, itemsData = []) {
  const telegramUserId = resolveTelegramUserId(headerData.telegram_user_id)
  const createdByUserId = resolveProfileId(headerData.created_by_user_id)
  const teamId = resolveTeamId(headerData.team_id)
  const projectId = normalizeText(headerData.project_id)
  const supplierId = normalizeText(headerData.supplier_id ?? headerData.supplierId)
  const supplierName = normalizeText(headerData.supplier_name)
  const expenseDate = normalizeText(headerData.expense_date)
  const documentType = normalizeText(headerData.document_type, 'faktur')
  const status =
    documentType === 'surat_jalan'
      ? 'delivery_order'
      : normalizeText(headerData.status, 'paid')
  const expenseType = 'material'
  const description = normalizeText(headerData.description)
  const notes = normalizeText(headerData.notes)
  const projectNameSnapshot = normalizeText(headerData.project_name)
  const supplierNameSnapshot = supplierName

  if (!telegramUserId) {
    throw new Error('ID pengguna Telegram tidak ditemukan.')
  }

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  if (!projectId) {
    throw new Error('Proyek faktur material wajib dipilih.')
  }

  if (!supplierName) {
    throw new Error('Nama supplier wajib diisi.')
  }

  if (!expenseDate) {
    throw new Error('Tanggal faktur wajib diisi.')
  }

  if (!['faktur', 'surat_jalan'].includes(documentType)) {
    throw new Error('Jenis dokumen material tidak valid.')
  }

  if (!['paid', 'unpaid', 'delivery_order'].includes(status)) {
    throw new Error('Status pembayaran faktur tidak valid.')
  }

  if (!Array.isArray(itemsData) || itemsData.length === 0) {
    throw new Error('Minimal satu item material harus diisi.')
  }

  const isDeliveryOrder = documentType === 'surat_jalan'

  const normalizedItems = itemsData.map((item, index) => {
    const materialId = normalizeText(item.material_id ?? item.materialId)
    const itemName = normalizeText(item.item_name ?? item.itemName ?? item.material_name)
    const qty = toNumber(item.qty)
    const unitPrice = isDeliveryOrder
      ? 0
      : toNumber(item.unit_price ?? item.unitPrice)
    const computedLineTotal = qty * unitPrice

    if (!materialId) {
      throw new Error(`Material pada baris ${index + 1} wajib dipilih.`)
    }

    if (!itemName) {
      throw new Error(`Nama item pada baris ${index + 1} tidak valid.`)
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`Qty pada baris ${index + 1} harus lebih dari 0.`)
    }

    if (!isDeliveryOrder && (!Number.isFinite(unitPrice) || unitPrice <= 0)) {
      throw new Error(
        `Harga satuan pada baris ${index + 1} harus lebih dari 0.`
      )
    }

    if (
      !isDeliveryOrder &&
      (!Number.isFinite(computedLineTotal) || computedLineTotal <= 0)
    ) {
      throw new Error(`Subtotal pada baris ${index + 1} tidak valid.`)
    }

    return {
      material_id: materialId,
      item_name: itemName,
      qty,
      unit_price: unitPrice,
      line_total: isDeliveryOrder ? 0 : computedLineTotal,
      sort_order: index + 1,
    }
  })

  const totalAmount = normalizedItems.reduce(
    (sum, item) => sum + item.line_total,
    0
  )

  return {
    headerPayload: {
      telegram_user_id: telegramUserId,
      created_by_user_id: createdByUserId,
      team_id: teamId,
      project_id: projectId,
      supplier_id: supplierId,
      supplier_name: supplierName,
      supplier_name_snapshot: supplierNameSnapshot,
      project_name_snapshot: projectNameSnapshot,
      expense_type: expenseType,
      document_type: documentType,
      status,
      expense_date: expenseDate,
      amount: totalAmount,
      total_amount: totalAmount,
      description,
      notes,
    },
    lineItemsPayload: normalizedItems,
    totalAmount,
  }
}

function buildMaterialInvoiceNotificationPayload(
  headerData = {},
  expenseId,
  totalAmount,
  lineItemsPayload = []
) {
  const isDeliveryOrder =
    normalizeText(headerData.document_type ?? headerData.documentType, '') === 'surat_jalan'

  return {
    notificationType: 'material_invoice',
    expenseId,
    invoiceDate: normalizeText(headerData.expense_date),
    userName: normalizeText(headerData.userName, 'Pengguna Telegram'),
    supplierName: normalizeText(headerData.supplier_name, '-'),
    projectName: normalizeText(headerData.project_name, '-'),
    totalAmount,
    description: normalizeText(
      headerData.description,
      isDeliveryOrder
        ? 'Surat Jalan Barang baru dicatat.'
        : 'Faktur Barang baru dicatat.'
    ),
    items: lineItemsPayload.map((item) => ({
      itemName: item.item_name,
      qty: item.qty,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
    })),
  }
}

const useTransactionStore = create((set) => ({
  isSubmitting: false,
  error: null,
  clearError: () => set({ error: null }),
  submitExpense: async (data = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const payload = buildExpensePayload(data)
      const apiExpense = await createExpenseFromApi(payload)

      if (!apiExpense) {
        throw new Error('Server tidak mengembalikan data expense.')
      }

      notifyTelegram(
        buildNotificationPayload(
          {
            ...data,
            type: 'expense',
            transaction_date: payload.expense_date,
          },
          apiExpense.id ?? null,
          payload.amount
        )
      ).catch((notifyError) => {
        console.error('Gagal memanggil endpoint notifikasi Telegram:', notifyError)
        showToast({
          tone: 'warning',
          title: 'Notifikasi transaksi',
          message: 'Pengeluaran tersimpan, tetapi notifikasi Telegram gagal dikirim.',
        })
      })

      set({ error: null })
      showToast({
        tone: 'success',
        title: 'Pengeluaran tersimpan',
        message: 'Pengeluaran berhasil dicatat.',
      })

      return apiExpense
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })
      showToast({
        tone: 'error',
        title: 'Pengeluaran gagal disimpan',
        message: normalizedError.message,
      })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
  fetchExpenseById: async (expenseId, options = {}) => {
    try {
      return await fetchExpenseByIdFromApi(expenseId, options)
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    }
  },
  fetchMaterialInvoiceById: async (expenseId, options = {}) => {
    try {
      return await fetchMaterialInvoiceByIdFromApi(expenseId, options)
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    }
  },
  fetchExpenseAttachments: async (expenseId, options = {}) => {
    try {
      return await fetchExpenseAttachmentsFromApi(expenseId, options)
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    }
  },
  attachExpenseAttachment: async (expenseId, fileAssetId, payload = {}) => {
    try {
      return await attachExpenseAttachmentFromApi(expenseId, fileAssetId, payload)
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    }
  },
  softDeleteExpenseAttachment: async (attachmentId, teamId) => {
    try {
      return await softDeleteExpenseAttachmentFromApi(attachmentId, teamId)
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    }
  },
  restoreExpenseAttachment: async (attachmentId, teamId) => {
    try {
      return await restoreExpenseAttachmentFromApi(attachmentId, teamId)
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    }
  },
  permanentDeleteExpenseAttachment: async (attachmentId, teamId) => {
    try {
      return await permanentDeleteExpenseAttachmentFromApi(attachmentId, teamId)
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    }
  },
  updateExpense: async (expenseId, data = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const payload = buildExpensePayload(data)
      const apiExpense = await updateExpenseFromApi(expenseId, {
        ...payload,
        teamId: payload.team_id,
        expectedUpdatedAt: normalizeText(
          data.expectedUpdatedAt ?? data.expected_updated_at ?? data.updated_at ?? data.updatedAt,
          null
        ),
      })

      if (!apiExpense) {
        throw new Error('Server tidak mengembalikan data expense.')
      }

      set({ error: null })
      showToast({
        tone: 'success',
        title: 'Pengeluaran diperbarui',
        message: 'Perubahan pengeluaran berhasil disimpan.',
      })

      return apiExpense
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })
      showToast({
        tone: 'error',
        title: 'Pengeluaran gagal diperbarui',
        message: normalizedError.message,
      })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
  updateMaterialInvoice: async (expenseId, data = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const { headerPayload, lineItemsPayload } = buildMaterialInvoicePayload(
        data.headerData ?? data,
        data.itemsData ?? data.items ?? []
      )
      const editableItems = lineItemsPayload.map((item, index) => ({
        ...item,
        id: normalizeText(data.itemsData?.[index]?.id, null),
      }))
      const result = await updateMaterialInvoiceFromApi(
        expenseId,
        {
          ...headerPayload,
          expectedUpdatedAt: normalizeText(
            data.expectedUpdatedAt ??
              data.expected_updated_at ??
              data.headerData?.updated_at ??
              data.headerData?.updatedAt ??
              data.updated_at ??
              data.updatedAt,
            null
          ),
        },
        editableItems
      )

      if (!result?.expense?.id) {
        throw new Error('Server tidak mengembalikan data faktur material.')
      }

      set({ error: null })
      showToast({
        tone: 'success',
        title: 'Faktur material diperbarui',
        message: 'Perubahan faktur material berhasil disimpan.',
      })

      return {
        ...result.expense,
        items: result.items,
      }
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })
      showToast({
        tone: 'error',
        title: 'Faktur material gagal diperbarui',
        message: normalizedError.message,
      })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
  softDeleteExpense: async (expenseId, expectedUpdatedAt = null) => {
    try {
      await softDeleteExpenseFromApi(expenseId, resolveTeamId(), expectedUpdatedAt)
      return true
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    }
  },
  softDeleteMaterialInvoice: async (expenseId, expectedUpdatedAt = null) => {
    try {
      await softDeleteMaterialInvoiceFromApi(expenseId, resolveTeamId(), expectedUpdatedAt)
      return true
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    }
  },
  restoreExpense: async (expenseId, expectedUpdatedAt = null) => {
    try {
      await restoreExpenseFromApi(expenseId, resolveTeamId(), expectedUpdatedAt)
      return true
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    }
  },
  restoreMaterialInvoice: async (expenseId, expectedUpdatedAt = null) => {
    try {
      await restoreMaterialInvoiceFromApi(expenseId, resolveTeamId(), expectedUpdatedAt)
      return true
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    }
  },
  submitMaterialInvoice: async (headerData, itemsData) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const { headerPayload, lineItemsPayload, totalAmount } =
        buildMaterialInvoicePayload(headerData, itemsData)
      const result = await createMaterialInvoiceFromApi(
        headerPayload,
        lineItemsPayload
      )

      if (!result?.expense?.id) {
        throw new Error('Server tidak mengembalikan data faktur material.')
      }

      notifyTelegram(
        buildMaterialInvoiceNotificationPayload(
          {
            ...headerData,
            supplier_name: headerPayload.supplier_name,
          },
          result.expense.id,
          totalAmount,
          result.items
        )
      ).catch((notifyError) => {
        console.error('Gagal memanggil endpoint notifikasi Telegram:', notifyError)
        showToast({
          tone: 'warning',
          title: 'Notifikasi faktur material',
          message: 'Faktur material tersimpan, tetapi notifikasi Telegram gagal dikirim.',
        })
      })

      set({ error: null })
      showToast({
        tone: 'success',
        title: 'Faktur material tersimpan',
        message: 'Faktur material berhasil dicatat.',
      })

      return {
        ...result.expense,
        items: result.items,
      }
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })
      showToast({
        tone: 'error',
        title: 'Faktur material gagal disimpan',
        message: normalizedError.message,
      })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
}))

export default useTransactionStore
export { useTransactionStore }
