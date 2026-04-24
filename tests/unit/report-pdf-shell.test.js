import assert from 'node:assert/strict'
import test from 'node:test'

import {
  addPaymentReceiptFooter,
  renderPaymentReceiptShell,
} from '../../src/lib/report-pdf.js'

function createMockDoc({ width = 148, height = 105, pages = 2 } = {}) {
  const calls = []

  return {
    calls,
    internal: {
      pageSize: {
        getWidth: () => width,
        getHeight: () => height,
      },
      getNumberOfPages: () => pages,
    },
    setFillColor: (...args) => calls.push(['setFillColor', ...args]),
    rect: (...args) => calls.push(['rect', ...args]),
    setFont: (...args) => calls.push(['setFont', ...args]),
    setFontSize: (...args) => calls.push(['setFontSize', ...args]),
    setTextColor: (...args) => calls.push(['setTextColor', ...args]),
    text: (...args) => calls.push(['text', ...args]),
    setPage: (...args) => calls.push(['setPage', ...args]),
    setDrawColor: (...args) => calls.push(['setDrawColor', ...args]),
    setLineWidth: (...args) => calls.push(['setLineWidth', ...args]),
    line: (...args) => calls.push(['line', ...args]),
    getTextWidth: (value) => String(value ?? '').length * 2,
  }
}

test('receipt shell renders the shared brand frame', () => {
  const doc = createMockDoc()

  renderPaymentReceiptShell(doc, {
    companyName: 'BANPLEX GREENFIELD',
    documentTitle: 'KWITANSI DIGITAL',
    secondaryText: 'Ringkasan transaksi',
    referenceLabel: 'SUPPLIER',
    referenceValue: 'Supplier Utama',
  })

  assert.deepEqual(doc.calls[0], ['setFillColor', 6, 95, 70])
  assert.deepEqual(doc.calls[1], ['rect', 0, 0, 148, 1.5, 'F'])
  assert.ok(doc.calls.some((call) => call[0] === 'text' && call[1] === 'BG'))
  assert.ok(
    doc.calls.some((call) => call[0] === 'text' && call[1] === 'BANPLEX GREENFIELD')
  )
  assert.ok(doc.calls.some((call) => call[0] === 'text' && call[1] === 'KWITANSI DIGITAL'))
  assert.ok(doc.calls.some((call) => call[0] === 'text' && call[1] === 'Ringkasan transaksi'))
  assert.ok(doc.calls.some((call) => call[0] === 'text' && call[1] === 'SUPPLIER'))
  assert.ok(doc.calls.some((call) => call[0] === 'text' && call[1] === 'Supplier Utama'))
})

test('receipt footer renders page markers', () => {
  const doc = createMockDoc()

  addPaymentReceiptFooter(doc, 'LEDGER BANPLEX', new Date('2026-04-24T10:00:00Z'))

  assert.ok(doc.calls.some((call) => call[0] === 'setPage' && call[1] === 1))
  assert.ok(doc.calls.some((call) => call[0] === 'setPage' && call[1] === 2))
  assert.ok(doc.calls.some((call) => call[0] === 'text' && call[1].includes('LEDGER BANPLEX')))
  assert.ok(doc.calls.some((call) => call[0] === 'text' && call[1] === 'HALAMAN 1 / 2'))
})
