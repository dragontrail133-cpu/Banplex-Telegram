import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizePartyStatementPartyType,
  summarizePartyStatementRows,
} from '../../api/records.js'

test('party statement normalizes supported party types', () => {
  assert.equal(normalizePartyStatementPartyType(' creditor '), 'creditor')
  assert.equal(normalizePartyStatementPartyType('supplier'), 'supplier')
  assert.equal(normalizePartyStatementPartyType('worker'), 'worker')
  assert.equal(normalizePartyStatementPartyType('unknown'), null)
})

test('party statement ledger computes opening and running balances', () => {
  const { rows, summary } = summarizePartyStatementRows(
    [
      {
        id: 'loan-1',
        sourceType: 'loan',
        entryType: 'debit',
        transactionDate: '2026-04-01',
        sortAt: '2026-04-01T00:00:00.000Z',
        amount: 1000000,
      },
      {
        id: 'payment-1',
        sourceType: 'bill_payment',
        entryType: 'credit',
        transactionDate: '2026-04-05',
        sortAt: '2026-04-05T10:00:00.000Z',
        amount: 250000,
      },
      {
        id: 'bill-1',
        sourceType: 'supplier_bill',
        entryType: 'debit',
        transactionDate: '2026-04-05',
        sortAt: '2026-04-05T08:00:00.000Z',
        amount: 500000,
      },
    ],
    {
      dateFrom: '2026-04-05',
      dateTo: '2026-04-10',
    }
  )

  assert.equal(summary.opening_balance, 1000000)
  assert.equal(summary.total_debit, 500000)
  assert.equal(summary.total_credit, 250000)
  assert.equal(summary.closing_balance, 1250000)
  assert.equal(summary.outstanding_amount, 1250000)
  assert.equal(summary.row_count, 2)
  assert.deepEqual(
    rows.map((row) => [row.id, row.entryType, row.balance]),
    [
      ['bill-1', 'debit', 1500000],
      ['payment-1', 'credit', 1250000],
    ]
  )
})
