import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getPartyStatementSourceLabel,
  getReportKindOption,
  normalizeReportKind,
} from '../../src/lib/business-report.js'

test('business report recognizes creditor statement kind', () => {
  assert.equal(normalizeReportKind('creditor_statement'), 'creditor_statement')
  assert.equal(getReportKindOption('creditor_statement').label, 'Kreditur')
})

test('business report recognizes supplier statement kind', () => {
  assert.equal(normalizeReportKind('supplier_statement'), 'supplier_statement')
  assert.equal(getReportKindOption('supplier_statement').label, 'Supplier')
  assert.equal(getReportKindOption('supplier_statement').description, 'Statement hutang supplier.')
})

test('business report recognizes worker statement kind', () => {
  assert.equal(normalizeReportKind('worker_statement'), 'worker_statement')
  assert.equal(getReportKindOption('worker_statement').label, 'Pekerja')
  assert.equal(getReportKindOption('worker_statement').description, 'Statement gaji pekerja.')
})

test('party statement source labels stay readable', () => {
  assert.equal(getPartyStatementSourceLabel('loan_payment'), 'Pembayaran Pinjaman')
  assert.equal(getPartyStatementSourceLabel('supplier_expense'), 'Biaya Supplier')
  assert.equal(getPartyStatementSourceLabel('supplier_bill'), 'Tagihan Supplier')
  assert.equal(getPartyStatementSourceLabel('attendance'), 'Absensi')
  assert.equal(getPartyStatementSourceLabel('salary_bill'), 'Tagihan Gaji')
})
