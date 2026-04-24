import assert from 'node:assert/strict'
import test from 'node:test'

import { aggregateProjectIncomeViewRows } from '../../api/transactions.js'

test('aggregateProjectIncomeViewRows collapses duplicate income fee-bill rows', () => {
  const rows = [
    {
      id: 'income-1',
      team_id: 'team-1',
      source_type: 'project-income',
      type: 'income',
      sort_at: '2026-04-24T10:00:00.000Z',
      transaction_date: '2026-04-24',
      income_date: '2026-04-24',
      created_at: '2026-04-24T09:00:00.000Z',
      updated_at: '2026-04-24T09:00:00.000Z',
      amount: 10000000,
      description: 'Termin 1',
      project_name_snapshot: 'Dapur Sppg',
      bill_id: 'bill-1',
      bill_type: 'fee',
      bill_status: 'unpaid',
      bill_amount: 500000,
      bill_paid_amount: 0,
      bill_remaining_amount: 500000,
      bill_due_date: '2026-04-25',
      bill_paid_at: null,
      bill_description: 'Fee termin staff A',
      bill_project_name_snapshot: 'Dapur Sppg',
      bill_supplier_name_snapshot: null,
      bill_worker_name_snapshot: 'Staff A',
      search_text: 'termin 1 dapur sppg fee unpaid',
    },
    {
      id: 'income-1',
      team_id: 'team-1',
      source_type: 'project-income',
      type: 'income',
      sort_at: '2026-04-24T12:00:00.000Z',
      transaction_date: '2026-04-24',
      income_date: '2026-04-24',
      created_at: '2026-04-24T09:00:00.000Z',
      updated_at: '2026-04-24T09:00:00.000Z',
      amount: 10000000,
      description: 'Termin 1',
      project_name_snapshot: 'Dapur Sppg',
      bill_id: 'bill-2',
      bill_type: 'fee',
      bill_status: 'partial',
      bill_amount: 250000,
      bill_paid_amount: 100000,
      bill_remaining_amount: 150000,
      bill_due_date: '2026-04-26',
      bill_paid_at: '2026-04-24T12:00:00.000Z',
      bill_description: 'Fee termin staff B',
      bill_project_name_snapshot: 'Dapur Sppg',
      bill_supplier_name_snapshot: null,
      bill_worker_name_snapshot: 'Staff B',
      search_text: 'termin 1 dapur sppg fee partial',
    },
    {
      id: 'expense-1',
      team_id: 'team-1',
      source_type: 'expense',
      type: 'expense',
      sort_at: '2026-04-23T08:00:00.000Z',
      created_at: '2026-04-23T08:00:00.000Z',
      updated_at: '2026-04-23T08:00:00.000Z',
      amount: 50000,
      description: 'Bensin',
      search_text: 'bensin',
    },
  ]

  const aggregated = aggregateProjectIncomeViewRows(rows)

  assert.equal(aggregated.length, 2)

  const incomeRow = aggregated.find((row) => row.id === 'income-1')
  assert.ok(incomeRow)
  assert.equal(incomeRow.bill_count, 2)
  assert.deepEqual(incomeRow.bill_ids, ['bill-1', 'bill-2'])
  assert.equal(incomeRow.bill_amount, 750000)
  assert.equal(incomeRow.bill_paid_amount, 100000)
  assert.equal(incomeRow.bill_remaining_amount, 650000)
  assert.equal(incomeRow.bill_status, 'partial')
  assert.equal(incomeRow.bill_paid_at, '2026-04-24T12:00:00.000Z')
  assert.equal(incomeRow.bill_due_date, '2026-04-25')
  assert.equal(incomeRow.bill_description, 'Fee termin (2 tagihan)')
  assert.equal(incomeRow.bill_worker_name_snapshot, '2 fee staff')
  assert.equal(aggregated[0].id, 'income-1')
})
