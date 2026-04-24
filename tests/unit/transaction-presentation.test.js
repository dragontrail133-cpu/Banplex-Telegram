import assert from 'node:assert/strict'
import test from 'node:test'

import {
  hasMeaningfulText,
  getTransactionSettlementBadgeLabel,
  shouldHideTransactionAmount,
} from '../../src/lib/transaction-presentation.js'

test('transaction text helper detects meaningful note content', () => {
  assert.equal(hasMeaningfulText(''), false)
  assert.equal(hasMeaningfulText('   '), false)
  assert.equal(hasMeaningfulText('Catatan tambahan'), true)
})

test('transaction settlement badge labels normalize payment status', () => {
  assert.equal(
    getTransactionSettlementBadgeLabel({
      sourceType: 'expense',
      bill: {
        status: 'paid',
      },
    }),
    'Lunas'
  )

  assert.equal(
    getTransactionSettlementBadgeLabel({
      sourceType: 'bill',
      bill_status: 'partial',
    }),
    'Dicicil'
  )

  assert.equal(
    getTransactionSettlementBadgeLabel({
      sourceType: 'expense',
      ledger_summary: {
        status: 'partial',
      },
    }),
    'Dicicil'
  )

  assert.equal(
    getTransactionSettlementBadgeLabel({
      sourceType: 'loan',
      status: 'unpaid',
    }),
    'Belum'
  )

  assert.equal(
    getTransactionSettlementBadgeLabel({
      sourceType: 'attendance-record',
      billing_status: 'billed',
    }),
    null
  )

  assert.equal(
    getTransactionSettlementBadgeLabel({
      sourceType: 'loan-disbursement',
      repayment_amount: 1500000,
      paid_amount: 500000,
      remaining_amount: 1000000,
    }),
    'Dicicil'
  )

  assert.equal(
    getTransactionSettlementBadgeLabel({
      sourceType: 'loan-disbursement',
      repayment_amount: 1500000,
      paid_amount: 1500000,
      remaining_amount: 0,
    }),
    'Lunas'
  )
})

test('transaction amount hides for surat jalan documents', () => {
  assert.equal(
    shouldHideTransactionAmount({
      sourceType: 'expense',
      document_type: 'surat_jalan',
    }),
    true
  )

  assert.equal(
    shouldHideTransactionAmount({
      sourceType: 'expense',
      document_type: 'faktur',
    }),
    false
  )
})
