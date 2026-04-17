import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import {
  resolveProfileId,
  resolveTeamId,
  resolveTelegramUserId,
} from '../lib/auth-context'

const validTransactionTypes = new Set(['income', 'expense'])

function notifyTelegram(payload) {
  console.log('Insert sukses, memicu notifikasi ke /api/notify...')

  void fetch('/api/notify', {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      console.log('Respon dari API Notif:', res.status)

      return res
    })
    .then(async (response) => {
      if (response.ok) {
        return
      }

      let message = 'Gagal memicu notifikasi Telegram.'

      try {
        const result = await response.json()
        message = result?.error || message
      } catch {
        // Abaikan kegagalan parsing body error dari endpoint notifikasi.
      }

      console.error(message)
    })
    .catch((error) => {
      console.error('Gagal memanggil endpoint notifikasi Telegram:', error)
    })
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

function buildTransactionPayload(data = {}) {
  const telegramUserId = resolveTelegramUserId(data.telegram_user_id)
  const type = normalizeText(data.type)
  const teamId = resolveTeamId(data.team_id)
  const projectId = normalizeText(data.project_id)
  const expenseCategoryId = normalizeText(data.expense_category_id)
  const categoryName = normalizeText(data.category_name)
  const transactionDate = normalizeText(data.transaction_date)
  const description = normalizeText(data.description)
  const notes = normalizeText(data.notes)
  const amount = Number(data.amount)
  const projectNameSnapshot = normalizeText(data.project_name)

  if (!telegramUserId) {
    throw new Error('ID pengguna Telegram tidak ditemukan.')
  }

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  if (!type || !validTransactionTypes.has(type)) {
    throw new Error('Tipe transaksi tidak valid.')
  }

  if (!projectId) {
    throw new Error('Proyek wajib dipilih.')
  }

  if (!expenseCategoryId || !categoryName) {
    throw new Error('Kategori transaksi wajib dipilih.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal transaksi harus lebih dari 0.')
  }

  if (!transactionDate) {
    throw new Error('Tanggal transaksi wajib diisi.')
  }

  return {
    telegram_user_id: telegramUserId,
    team_id: teamId,
    type,
    project_id: projectId,
    expense_category_id: expenseCategoryId,
    category: categoryName,
    amount,
    transaction_date: transactionDate,
    description,
    notes,
    project_name_snapshot: projectNameSnapshot,
  }
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
  const supplierNameSnapshot = normalizeText(data.supplier_name)

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
    supplier_name_snapshot: supplierNameSnapshot,
  }
}

function buildMaterialInvoicePayload(headerData = {}, itemsData = []) {
  const telegramUserId = resolveTelegramUserId(headerData.telegram_user_id)
  const createdByUserId = resolveProfileId(headerData.created_by_user_id)
  const teamId = resolveTeamId(headerData.team_id)
  const projectId = normalizeText(headerData.project_id)
  const supplierName = normalizeText(headerData.supplier_name)
  const expenseDate = normalizeText(headerData.expense_date)
  const documentType = normalizeText(headerData.document_type, 'faktur')
  const status =
    documentType === 'surat_jalan'
      ? 'delivery_order'
      : normalizeText(headerData.status, 'paid')
  const expenseType = normalizeText(headerData.expense_type, 'material')
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
  return {
    notificationType: 'material_invoice',
    expenseId,
    invoiceDate: normalizeText(headerData.expense_date),
    userName: normalizeText(headerData.userName, 'Pengguna Telegram'),
    supplierName: normalizeText(headerData.supplier_name, '-'),
    projectName: normalizeText(headerData.project_name, '-'),
    totalAmount,
    description: normalizeText(headerData.description, 'Faktur material baru dicatat.'),
    items: lineItemsPayload.map((item) => ({
      itemName: item.item_name,
      qty: item.qty,
      unitPrice: item.unit_price,
      lineTotal: item.line_total,
    })),
  }
}

async function rollbackExpense(expenseId) {
  if (!supabase || !expenseId) {
    return null
  }

  const { error } = await supabase
    .from('expenses')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', expenseId)
    .is('deleted_at', null)

  return error ?? null
}

async function upsertSupplier(supplierName, explicitTeamId = null) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedSupplierName = normalizeText(supplierName)
  const teamId = resolveTeamId(explicitTeamId)

  if (!normalizedSupplierName) {
    throw new Error('Nama supplier wajib diisi.')
  }

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  const { data: existingSupplier, error: existingSupplierError } = await supabase
    .from('suppliers')
    .select('id, name, supplier_name, supplier_type, team_id')
    .eq('team_id', teamId)
    .is('deleted_at', null)
    .eq('supplier_type', 'Material')
    .ilike('name', normalizedSupplierName)
    .maybeSingle()

  if (existingSupplierError) {
    throw existingSupplierError
  }

  if (existingSupplier?.id) {
    return existingSupplier
  }

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      name: normalizedSupplierName,
      supplier_type: 'Material',
      team_id: teamId,
      is_active: true,
    })
    .select('id, name, supplier_name, supplier_type, team_id')
    .single()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error('Supplier gagal dipersiapkan.')
  }

  return data
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
      const { data: insertedExpense, error } = await supabase
        .from('expenses')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      notifyTelegram(
        buildNotificationPayload(
          {
            ...data,
            type: 'expense',
            transaction_date: payload.expense_date,
          },
          insertedExpense?.id ?? null,
          payload.amount
        )
      )

      set({ error: null })

      return {
        ...payload,
        id: insertedExpense?.id ?? null,
      }
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
  submitTransaction: async (data) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const payload = buildTransactionPayload(data)
      console.log('Memulai pengiriman data ke Supabase...')
      const { data: insertedTransaction, error } = await supabase
        .from('transactions')
        .insert(payload)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      notifyTelegram(
        buildNotificationPayload(data, insertedTransaction?.id ?? null, payload.amount)
      )

      set({ error: null })

      return {
        ...payload,
        id: insertedTransaction?.id ?? null,
      }
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
  submitMaterialInvoice: async (headerData, itemsData) => {
    set({ isSubmitting: true, error: null })

    let insertedExpenseId = null

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const { headerPayload, lineItemsPayload, totalAmount } =
        buildMaterialInvoicePayload(headerData, itemsData)
      const supplier = await upsertSupplier(
        headerPayload.supplier_name,
        headerPayload.team_id
      )

      const expenseInsertPayload = {
        ...headerPayload,
        supplier_id: supplier.id,
      }

      const { data: insertedExpense, error: expenseError } = await supabase
        .from('expenses')
        .insert(expenseInsertPayload)
        .select('id')
        .single()

      if (expenseError) {
        throw expenseError
      }

      insertedExpenseId = insertedExpense?.id ?? null

      if (!insertedExpenseId) {
        throw new Error('ID faktur material gagal dibuat.')
      }

      const relationalLineItems = lineItemsPayload.map((item) => ({
        ...item,
        expense_id: insertedExpenseId,
      }))

      const { error: lineItemsError } = await supabase
        .from('expense_line_items')
        .insert(relationalLineItems)

      if (lineItemsError) {
        const rollbackError = await rollbackExpense(insertedExpenseId)

        if (rollbackError) {
          throw new Error(
            `Gagal menyimpan item faktur. Rollback header juga gagal: ${rollbackError.message}`
          )
        }

        throw lineItemsError
      }

      notifyTelegram(
        buildMaterialInvoiceNotificationPayload(
          {
            ...headerData,
            supplier_name: supplier.name,
          },
          insertedExpenseId,
          totalAmount,
          relationalLineItems
        )
      )

      set({ error: null })

      return {
        ...expenseInsertPayload,
        id: insertedExpenseId,
        items: relationalLineItems,
      }
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
}))

export default useTransactionStore
export { useTransactionStore }
