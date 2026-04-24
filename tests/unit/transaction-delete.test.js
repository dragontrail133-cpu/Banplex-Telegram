import assert from 'node:assert/strict'
import test from 'node:test'

import {
  canShowTransactionDelete,
  getTransactionDeleteHistoryRoute,
  hasTransactionPaymentHistory,
} from '../../src/lib/transaction-delete.js'
import { getMaterialInvoiceDeleteBlockReason } from '../../src/lib/material-invoice.js'

test('transaction delete helpers expose paid expense deletes and history routes', () => {
  const transaction = {
    id: 'expense-1',
    sourceType: 'expense',
    bill_paid_amount: 50000,
    bill_status: 'partial',
  }

  assert.equal(hasTransactionPaymentHistory(transaction), true)
  assert.equal(canShowTransactionDelete(transaction), true)
  assert.equal(
    getTransactionDeleteHistoryRoute(transaction),
    '/transactions/expense-1?surface=riwayat'
  )
})

test('transaction delete helpers keep billed attendance hidden', () => {
  assert.equal(
    canShowTransactionDelete({
      sourceType: 'attendance-record',
      billing_status: 'billed',
      salary_bill_id: 'bill-1',
    }),
    false
  )
})

test('material invoice helpers support raw invoice records', () => {
  const invoice = {
    id: 'expense-raw-1',
    expense_type: 'material',
    document_type: 'faktur',
    bill_paid_amount: 50000,
    bill_status: 'partial',
    items: [
      {
        qty: 10,
        materials: {
          current_stock: 100,
        },
      },
    ],
  }

  assert.equal(hasTransactionPaymentHistory(invoice), true)
  assert.equal(canShowTransactionDelete(invoice), true)
  assert.equal(getMaterialInvoiceDeleteBlockReason(invoice), null)
})
