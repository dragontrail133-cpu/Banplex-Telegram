import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MATERIAL_REVIEW_STATUS,
  buildMaterialInvoiceAiReview,
  normalizeAiInvoiceItem,
  normalizeMaterialName,
  normalizeUnitLabel,
} from '../../src/lib/material-invoice-ai.js'

const materials = [
  {
    id: 'mat-semen',
    name: 'Semen Tiga Roda 50 kg',
    unit: 'Sak',
    current_stock: 12,
  },
  {
    id: 'mat-pasir',
    name: 'Pasir Urug',
    unit: 'M3',
    current_stock: 4,
  },
]

test('material invoice AI normalizes material names and units conservatively', () => {
  assert.equal(normalizeMaterialName('  Semen Tiga-Roda 50 KG!! '), 'semen tiga roda 50 kg')
  assert.equal(normalizeUnitLabel(' M³ '), 'm3')
})

test('material invoice AI auto-binds exact master name only', () => {
  const [row] = buildMaterialInvoiceAiReview({
    aiItems: [
      {
        name: 'semen tiga roda 50 kg',
        unit: 'sak',
        qty: 10,
        unitPrice: 65000,
      },
    ],
    materials,
  })

  assert.equal(row.status, MATERIAL_REVIEW_STATUS.MATCHED)
  assert.equal(row.selectedMaterialId, 'mat-semen')
  assert.equal(row.materialDraftName, '')
})

test('material invoice AI marks similar master as confirmation, not automatic match', () => {
  const [row] = buildMaterialInvoiceAiReview({
    aiItems: [
      {
        name: 'Pasir urug halus',
        unit: 'm3',
        qty: 3,
      },
    ],
    materials,
  })

  assert.equal(row.status, MATERIAL_REVIEW_STATUS.NEEDS_CONFIRM)
  assert.equal(row.selectedMaterialId, '')
  assert.equal(row.candidates[0].id, 'mat-pasir')
})

test('material invoice AI keeps unknown item as new material and requires unit', () => {
  const [row] = buildMaterialInvoiceAiReview({
    aiItems: [
      {
        name: 'Besi Hollow 4x4',
        qty: 8,
      },
    ],
    materials,
  })

  assert.equal(row.status, MATERIAL_REVIEW_STATUS.NEW_MATERIAL)
  assert.equal(row.missingUnit, true)
  assert.equal(row.materialDraftName, 'Besi Hollow 4x4')
})

test('material invoice AI normalizes formatted money values', () => {
  const item = normalizeAiInvoiceItem(
    {
      name: 'Semen Tiga Roda 50 kg',
      unit: 'sak',
      qty: 2,
      unitPrice: '65.000',
      lineTotal: '130.000',
    },
    0
  )

  assert.equal(item.unitPrice, 65000)
  assert.equal(item.lineTotal, 130000)
})
