import assert from 'node:assert/strict'
import test from 'node:test'

import {
  hasMeaningfulText,
  getTransactionSettlementBadgeLabel,
  getTransactionLedgerFilterOptions,
  matchesTransactionLedgerFilter,
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

test('transaction ledger visibility excludes payroll bills and surat jalan in the right surfaces', () => {
  assert.equal(
    matchesTransactionLedgerFilter(
      {
        source_type: 'bill',
        bill_type: 'gaji',
        bill_status: 'unpaid',
      },
      'all',
      {
        includePaidBills: false,
        includePayrollBills: false,
        includeSuratJalan: true,
      }
    ),
    false
  )

  assert.equal(
    matchesTransactionLedgerFilter(
      {
        source_type: 'bill',
        bill_type: 'operasional',
        bill_status: 'paid',
      },
      'all',
      {
        includePaidBills: false,
        includePayrollBills: true,
        includeSuratJalan: true,
      }
    ),
    false
  )

  assert.equal(
    matchesTransactionLedgerFilter(
      {
        source_type: 'expense',
        expense_type: 'material',
        document_type: 'faktur',
      },
      'material-invoice',
      {
        includePaidBills: false,
        includePayrollBills: false,
        includeSuratJalan: true,
      }
    ),
    true
  )

  assert.equal(
    matchesTransactionLedgerFilter(
      {
        source_type: 'expense',
        expense_type: 'material',
        document_type: 'surat_jalan',
      },
      'material-invoice',
      {
        includePaidBills: false,
        includePayrollBills: false,
        includeSuratJalan: true,
      }
    ),
    false
  )

  assert.equal(
    matchesTransactionLedgerFilter(
      {
        source_type: 'expense',
        expense_type: 'material',
        document_type: 'surat_jalan',
      },
      'surat-jalan',
      {
        includePaidBills: false,
        includePayrollBills: false,
        includeSuratJalan: false,
      }
    ),
    false
  )
})

test('ledger filter options can hide payroll and delivery-order filters', () => {
  const options = getTransactionLedgerFilterOptions({
    includePayrollBills: false,
    includeSuratJalan: false,
  })

  assert.equal(options.some((item) => item.value === 'bill'), false)
  assert.equal(options.some((item) => item.value === 'surat-jalan'), false)
})
