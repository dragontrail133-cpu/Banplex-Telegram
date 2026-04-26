import assert from 'node:assert/strict'
import test from 'node:test'

import {
  hasMeaningfulText,
  getBillGroupDeleteTarget,
  getBillGroupEditRoute,
  getTransactionLedgerSummary,
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

test('project income ledger summary stays independent from legacy fee bills', () => {
  assert.equal(
    getTransactionLedgerSummary({
      sourceType: 'project-income',
      bill: {
        status: 'partial',
        remainingAmount: 250000,
      },
    }),
    ''
  )
})

test('bill group delete target resolves the oldest unpaid child bill and blocks paid groups', () => {
  assert.equal(
    getBillGroupDeleteTarget({
      bills: [
        {
          id: 'bill-fee-newer',
          projectIncomeId: 'income-fee-newer',
          amount: 120000,
          paidAmount: 0,
          remainingAmount: 120000,
          dueDate: '2026-04-22',
          created_at: '2026-04-19T09:00:00.000Z',
        },
        {
          id: 'bill-fee-oldest',
          projectIncomeId: 'income-fee-oldest',
          amount: 100000,
          paidAmount: 0,
          remainingAmount: 100000,
          dueDate: '2026-04-20',
          created_at: '2026-04-18T09:00:00.000Z',
        },
      ],
    })?.id,
    'bill-fee-oldest'
  )

  assert.equal(
    getBillGroupDeleteTarget({
      bills: [
        {
          id: 'bill-fee-paid',
          projectIncomeId: 'income-fee-paid',
          amount: 100000,
          paidAmount: 25000,
          remainingAmount: 75000,
          dueDate: '2026-04-20',
          created_at: '2026-04-18T09:00:00.000Z',
        },
      ],
    }),
    null
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

test('bill group edit route resolves the oldest unpaid child bill and blocks paid groups', () => {
  assert.equal(
    getBillGroupEditRoute({
      bills: [
        {
          id: 'bill-fee-newer',
          projectIncomeId: 'income-fee-newer',
          amount: 120000,
          paidAmount: 0,
          remainingAmount: 120000,
          dueDate: '2026-04-22',
          created_at: '2026-04-19T09:00:00.000Z',
        },
        {
          id: 'bill-fee-oldest',
          projectIncomeId: 'income-fee-oldest',
          amount: 100000,
          paidAmount: 0,
          remainingAmount: 100000,
          dueDate: '2026-04-20',
          created_at: '2026-04-18T09:00:00.000Z',
        },
      ],
    }),
    '/edit/project-income/income-fee-oldest'
  )

  assert.equal(
    getBillGroupEditRoute({
      bills: [
        {
          id: 'bill-fee-paid',
          projectIncomeId: 'income-fee-paid',
          amount: 100000,
          paidAmount: 25000,
          remainingAmount: 75000,
          dueDate: '2026-04-20',
          created_at: '2026-04-18T09:00:00.000Z',
        },
      ],
    }),
    null
  )
})
