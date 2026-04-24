function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : NaN
}

export function formatMaterialInvoiceDocumentLabel(documentType = '') {
  const normalizedDocumentType = normalizeText(documentType, '').toLowerCase()

  return normalizedDocumentType === 'surat_jalan' ? 'Surat Jalan' : 'Faktur'
}

export function formatMaterialInvoiceBillStatusLabel(status = '') {
  const normalizedStatus = normalizeText(status, '').toLowerCase()

  if (normalizedStatus === 'paid') {
    return 'Lunas'
  }

  if (normalizedStatus === 'partial') {
    return 'Sebagian lunas'
  }

  if (normalizedStatus === 'delivery_order') {
    return 'Delivery Order'
  }

  return 'Belum lunas'
}

export function isMaterialInvoiceExpense(expense = null) {
  const expenseType = normalizeText(expense?.expense_type, '').toLowerCase()
  const documentType = normalizeText(expense?.document_type, '').toLowerCase()

  return (
    expenseType === 'material' ||
    expenseType === 'material_invoice' ||
    documentType === 'surat_jalan'
  )
}

export function getMaterialInvoiceDeleteBlockReason(invoice = null) {
  if (!invoice?.id || invoice?.deleted_at) {
    return null
  }

  const normalizedDocumentType = normalizeText(invoice?.document_type, 'faktur').toLowerCase()
  const items = Array.isArray(invoice?.items) ? invoice.items : []

  for (const item of items) {
    const rollbackQuantity =
      normalizedDocumentType === 'surat_jalan' ? toNumber(item?.qty) : -toNumber(item?.qty)
    const currentStock = toNumber(
      item?.materials?.current_stock ?? item?.material_current_stock ?? item?.current_stock
    )
    const nextStock = (Number.isFinite(currentStock) ? currentStock : 0) + rollbackQuantity

    if (nextStock < 0) {
      const materialName =
        String(
          item?.materials?.name ??
            item?.material_name ??
            item?.item_name ??
            item?.material_id ??
            'material'
        ).trim() || 'material'

      return `Dokumen barang ini tidak bisa dihapus karena stok material ${materialName} sudah terpakai di mutasi lain. Koreksi mutasi stok turunannya lebih dulu.`
    }
  }

  return null
}
