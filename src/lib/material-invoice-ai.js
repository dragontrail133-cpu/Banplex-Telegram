const MATERIAL_REVIEW_STATUS = {
  MATCHED: 'matched',
  NEEDS_CONFIRM: 'needs_confirm',
  NEW_MATERIAL: 'new_material',
  INVALID: 'invalid',
}

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function normalizeMaterialName(value) {
  return normalizeText(value, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeUnitLabel(value) {
  return normalizeText(value, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function toNumberOrEmpty(value) {
  if (value === '' || value == null) {
    return ''
  }

  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : ''
}

function toMoneyNumberOrEmpty(value) {
  if (value === '' || value == null) {
    return ''
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : ''
  }

  const normalizedValue = String(value).trim().replace(/[^\d-]/g, '')

  if (!normalizedValue) {
    return ''
  }

  const parsedValue = Number(normalizedValue)

  return Number.isFinite(parsedValue) ? parsedValue : ''
}

function buildReviewTempId(item, index) {
  const normalizedName = normalizeMaterialName(item?.name ?? item?.materialName)

  return [
    'ai-material',
    index + 1,
    normalizedName ? normalizedName.replace(/\s+/g, '-') : 'unknown',
  ].join('-')
}

function normalizeAiInvoiceItem(item = {}, index = 0) {
  const name = normalizeText(
    item.name ?? item.materialName ?? item.material_name ?? item.item_name,
    ''
  )
  const unit = normalizeText(item.unit ?? item.satuan, '')
  const qty = toNumberOrEmpty(item.qty ?? item.quantity ?? item.jumlah)
  const unitPrice = toMoneyNumberOrEmpty(item.unitPrice ?? item.unit_price ?? item.harga_satuan)
  const rawLineTotal = toMoneyNumberOrEmpty(item.lineTotal ?? item.line_total ?? item.subtotal)
  const lineTotal =
    rawLineTotal === '' && qty !== '' && unitPrice !== '' ? qty * unitPrice : rawLineTotal

  return {
    tempId: normalizeText(item.tempId ?? item.temp_id, buildReviewTempId(item, index)),
    name,
    unit,
    qty,
    unitPrice,
    lineTotal,
    confidence: toNumberOrEmpty(item.confidence),
    sourceText: normalizeText(item.sourceText ?? item.source_text, ''),
  }
}

function normalizeMaterialOption(material = {}) {
  const name = normalizeText(material.name ?? material.material_name, '')

  return {
    id: normalizeText(material.id, ''),
    name,
    material_name: normalizeText(material.material_name ?? material.name, name),
    unit: normalizeText(material.unit, ''),
    current_stock: material.current_stock ?? null,
    normalizedName: normalizeMaterialName(name),
    normalizedUnit: normalizeUnitLabel(material.unit),
  }
}

function scoreMaterialCandidate(normalizedItemName, material) {
  if (!normalizedItemName || !material.normalizedName) {
    return 0
  }

  if (
    normalizedItemName.includes(material.normalizedName) ||
    material.normalizedName.includes(normalizedItemName)
  ) {
    return 0.9
  }

  const itemTokens = new Set(normalizedItemName.split(' ').filter(Boolean))
  const materialTokens = new Set(material.normalizedName.split(' ').filter(Boolean))

  if (itemTokens.size === 0 || materialTokens.size === 0) {
    return 0
  }

  let overlap = 0

  for (const token of itemTokens) {
    if (materialTokens.has(token)) {
      overlap += 1
    }
  }

  return overlap / Math.max(itemTokens.size, materialTokens.size)
}

function findMaterialCandidates(item, materialOptions) {
  const normalizedItemName = normalizeMaterialName(item.name)

  return materialOptions
    .map((material) => ({
      ...material,
      score: scoreMaterialCandidate(normalizedItemName, material),
    }))
    .filter((material) => material.score >= 0.5)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, 'id'))
    .slice(0, 3)
}

function buildMaterialInvoiceAiReview({ aiItems = [], materials = [] } = {}) {
  const materialOptions = materials.map(normalizeMaterialOption).filter((material) => material.id)
  const exactMaterialByName = new Map()

  for (const material of materialOptions) {
    if (material.normalizedName && !exactMaterialByName.has(material.normalizedName)) {
      exactMaterialByName.set(material.normalizedName, material)
    }
  }

  return aiItems.map((rawItem, index) => {
    const item = normalizeAiInvoiceItem(rawItem, index)
    const normalizedItemName = normalizeMaterialName(item.name)
    const exactMaterial = exactMaterialByName.get(normalizedItemName) ?? null
    const candidates = exactMaterial ? [] : findMaterialCandidates(item, materialOptions)
    const missingUnit = !normalizeUnitLabel(item.unit)
    const baseRow = {
      ...item,
      normalizedName: normalizedItemName,
      missingUnit,
      selectedMaterialId: exactMaterial?.id ?? '',
      selectedMaterialName: exactMaterial?.name ?? '',
      selectedMaterialUnit: exactMaterial?.unit ?? '',
      materialDraftName: exactMaterial ? '' : item.name,
      materialDraftUnit: exactMaterial ? '' : item.unit,
      candidates,
    }

    if (!normalizedItemName || item.qty === '' || item.qty <= 0) {
      return {
        ...baseRow,
        status: MATERIAL_REVIEW_STATUS.INVALID,
        reason: !normalizedItemName ? 'Nama belum terbaca.' : 'Qty belum valid.',
      }
    }

    if (exactMaterial) {
      return {
        ...baseRow,
        status: MATERIAL_REVIEW_STATUS.MATCHED,
        reason: 'Cocok dengan master.',
      }
    }

    if (candidates.length > 0) {
      return {
        ...baseRow,
        status: MATERIAL_REVIEW_STATUS.NEEDS_CONFIRM,
        reason: 'Ada master yang mirip.',
      }
    }

    return {
      ...baseRow,
      status: MATERIAL_REVIEW_STATUS.NEW_MATERIAL,
      reason: missingUnit
        ? 'Isi satuan untuk master baru.'
        : 'Bisa dibuat sebagai master baru.',
    }
  })
}

function getReviewRowMaterialLabel(row = {}) {
  if (row.selectedMaterialName) {
    return [row.selectedMaterialName, row.selectedMaterialUnit].filter(Boolean).join(' / ')
  }

  return [row.materialDraftName ?? row.name, row.materialDraftUnit ?? row.unit]
    .filter(Boolean)
    .join(' / ')
}

export {
  MATERIAL_REVIEW_STATUS,
  buildMaterialInvoiceAiReview,
  getReviewRowMaterialLabel,
  normalizeAiInvoiceItem,
  normalizeMaterialName,
  normalizeUnitLabel,
}
