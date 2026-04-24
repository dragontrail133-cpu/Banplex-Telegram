import assert from 'node:assert/strict'
import test from 'node:test'

import {
  loadPartyStatementWorkerRows,
  normalizePartyStatementPartyType,
  summarizePartyStatementRows,
} from '../../api/records.js'

function createThenableQuery({ data = null, error = null, onSelect = null } = {}) {
  const query = {
    select(columns) {
      if (onSelect) {
        onSelect(columns)
      }

      return query
    },
    eq() {
      return query
    },
    is() {
      return query
    },
    order() {
      return query
    },
    in() {
      return query
    },
    gte() {
      return query
    },
    lte() {
      return query
    },
    maybeSingle() {
      return Promise.resolve({ data, error })
    },
    then(resolve, reject) {
      return Promise.resolve({ data, error }).then(resolve, reject)
    },
  }

  return query
}

function createPartyStatementReadClient({
  worker = null,
  attendanceRows = [],
  bills = [],
  onAttendanceSelect = null,
} = {}) {
  return {
    from(tableName) {
      if (tableName === 'workers') {
        return createThenableQuery({ data: worker })
      }

      if (tableName === 'attendance_records') {
        return createThenableQuery({ data: attendanceRows, onSelect: onAttendanceSelect })
      }

      if (tableName === 'bills') {
        return createThenableQuery({ data: bills })
      }

      throw new Error(`Unexpected table ${tableName}`)
    },
  }
}

test('party statement normalizes supported party types', () => {
  assert.equal(normalizePartyStatementPartyType(' creditor '), 'creditor')
  assert.equal(normalizePartyStatementPartyType('supplier'), 'supplier')
  assert.equal(normalizePartyStatementPartyType('worker'), 'worker')
  assert.equal(normalizePartyStatementPartyType('unknown'), null)
})

test('worker party statement query skips overtime_fee when loading attendance rows', async () => {
  const selectCalls = []
  const readClient = createPartyStatementReadClient({
    worker: {
      id: 'worker-1',
      team_id: 'team-1',
      name: 'Budi',
      worker_name: 'Budi',
      notes: null,
      status: 'active',
      is_active: true,
      deleted_at: null,
    },
    attendanceRows: [
      {
        id: 'attendance-1',
        team_id: 'team-1',
        worker_id: 'worker-1',
        project_id: 'project-1',
        attendance_date: '2026-04-10',
        attendance_status: 'full_day',
        total_pay: 75000,
        billing_status: 'unbilled',
        salary_bill_id: null,
        notes: 'Shift pagi',
        created_at: '2026-04-10T08:00:00.000Z',
        workers: {
          id: 'worker-1',
          name: 'Budi',
        },
        projects: {
          id: 'project-1',
          name: 'Proyek A',
        },
      },
    ],
    bills: [],
    onAttendanceSelect: (columns) => {
      selectCalls.push(columns)
    },
  })

  const rows = await loadPartyStatementWorkerRows(readClient, 'worker-1')

  assert.equal(selectCalls.length, 1)
  assert.equal(selectCalls[0].includes('overtime_fee'), false)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].sourceType, 'attendance')
  assert.equal(rows[0].amount, 75000)
  assert.equal(rows[0].metadata.attendanceStatus, 'full_day')
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
