import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyDuplicateReferenceRemaps,
  buildDuplicateAliasMaps,
  buildIdMapLookups,
  resolveParentCanonicalId,
  resolveParentLegacyPath,
  shouldSkipDuplicateRow,
} from '../../scripts/firestore-backfill/load.mjs'
import { resolveExpenseLineItemAmounts } from '../../scripts/firestore-backfill/extract.mjs'
import {
  isUuid,
  remapRowTeamId,
  resolveBackfillAttendanceTotalPay,
  resolveBackfillExpenseTotalAmount,
  resolveLoanNominalAmounts,
  shouldBackfillAttendanceRecord,
} from '../../scripts/firestore-backfill/helpers.mjs'
import { buildLoanTermsSnapshot } from '../../src/lib/loan-business.js'

test('firestore backfill helper validates uuid strings', () => {
  assert.equal(isUuid('7d9f5c7d-9b4f-4e0d-ae8f-89a7f3f6d3e1'), true)
  assert.equal(isUuid('not-a-uuid'), false)
  assert.equal(isUuid(null), false)
})

test('firestore backfill helper remaps team scoped rows without mutation', () => {
  const sourceRow = {
    id: 'row-1',
    team_id: 'legacy-team',
    name: 'Legacy Row',
  }

  const result = remapRowTeamId(sourceRow, 'target-team')

  assert.equal(result.remapped, true)
  assert.equal(result.legacyTeamId, 'legacy-team')
  assert.deepEqual(result.row, {
    id: 'row-1',
    team_id: 'target-team',
    name: 'Legacy Row',
  })
  assert.equal(sourceRow.team_id, 'legacy-team')
})

test('firestore backfill helper leaves non-team rows untouched', () => {
  const sourceRow = {
    id: 'row-2',
    name: 'No Team Row',
  }

  const result = remapRowTeamId(sourceRow, 'target-team')

  assert.equal(result.remapped, false)
  assert.equal(result.legacyTeamId, null)
  assert.equal(result.row, sourceRow)
})

test('firestore backfill helper normalizes loan nominal from legacy total amount', () => {
  assert.deepEqual(
    resolveLoanNominalAmounts({
      totalAmount: 125000,
      repaymentAmount: 125000,
      interestType: 'none',
    }),
    {
      principal_amount: 125000,
      amount: 125000,
      repayment_amount: 125000,
    }
  )
})

test('firestore backfill helper only falls back to repayment amount for non-interest loan', () => {
  assert.deepEqual(
    resolveLoanNominalAmounts({
      principalAmount: 0,
      amount: 0,
      repaymentAmount: 500000,
      interestType: 'none',
    }),
    {
      principal_amount: 500000,
      amount: 500000,
      repayment_amount: 500000,
    }
  )

  assert.deepEqual(
    resolveLoanNominalAmounts({
      principalAmount: 0,
      amount: 0,
      repaymentAmount: 620000,
      interestType: 'interest',
    }),
    {
      principal_amount: 0,
      amount: 0,
      repayment_amount: 620000,
    }
  )
})

test('firestore backfill helper falls back expense total amount to amount', () => {
  assert.equal(
    resolveBackfillExpenseTotalAmount({
      amount: 325000,
      totalAmount: 0,
      total_amount: 0,
    }),
    325000
  )

  assert.equal(
    resolveBackfillExpenseTotalAmount({
      amount: 325000,
      totalAmount: 450000,
      total_amount: 0,
    }),
    450000
  )
})

test('firestore backfill extractor maps legacy item price and total fields', () => {
  assert.deepEqual(
    resolveExpenseLineItemAmounts({
      qty: 2,
      price: 1300000,
      total: 2600000,
    }),
    {
      unitPrice: 1300000,
      lineTotal: 2600000,
    }
  )

  assert.deepEqual(
    resolveExpenseLineItemAmounts({
      qty: 3,
      price: 5000,
    }),
    {
      unitPrice: 5000,
      lineTotal: 15000,
    }
  )

  assert.deepEqual(
    resolveExpenseLineItemAmounts({
      qty: 4,
      unitPrice: 25000,
      lineTotal: 100000,
    }),
    {
      unitPrice: 25000,
      lineTotal: 100000,
    }
  )
})

test('firestore backfill helper derives attendance pay from wage rates when legacy total pay is empty', () => {
  assert.equal(
    resolveBackfillAttendanceTotalPay({
      attendanceStatus: 'half_day',
      totalPay: 0,
      baseWage: 100000,
    }),
    50000
  )

  assert.equal(
    resolveBackfillAttendanceTotalPay({
      attendanceStatus: 'full_day',
      totalPay: 150000,
      baseWage: 200000,
    }),
    150000
  )

  assert.equal(
    resolveBackfillAttendanceTotalPay({
      attendanceStatus: 'absent',
      totalPay: 0,
      baseWage: 100000,
    }),
    0
  )
})

test('loan business snapshot preserves explicit repayment amount while keeping computed base repayment', () => {
  assert.deepEqual(
    buildLoanTermsSnapshot({
      amount: 30000000,
      repayment_amount: 37200000,
      interest_type: 'interest',
      interest_rate: 8,
      tenor_months: 3,
      transaction_date: '2025-08-25',
    }),
    {
      principal_amount: 30000000,
      amount: 30000000,
      repayment_amount: 37200000,
      interest_type: 'interest',
      interest_rate: 8,
      tenor_months: 3,
      transaction_date: '2025-08-25',
      disbursed_date: '2025-08-25',
      due_date: '2025-11-25',
      base_repayment_amount: 37200000,
      late_interest_rate: 0,
      late_interest_basis: 'remaining',
      late_penalty_type: 'none',
      late_penalty_amount: 0,
      creditor_name_snapshot: '-',
    }
  )
})

test('firestore backfill helper only keeps attendance rows with explicit legacy project id', () => {
  assert.equal(
    shouldBackfillAttendanceRecord({
      projectId: 'project-explicit',
    }),
    true
  )

  assert.equal(
    shouldBackfillAttendanceRecord({
      projectId: null,
    }),
    false
  )

  assert.equal(
    shouldBackfillAttendanceRecord({
      projectId: '   ',
    }),
    false
  )
})

test('firestore backfill loader resolves duplicate aliases from validation report', () => {
  const duplicateAliasMaps = buildDuplicateAliasMaps({
    duplicateKeys: [
      {
        table: 'materials',
        first: 'canon-material',
        duplicate: 'duplicate-material',
      },
      {
        table: 'workers',
        first: 'canon-worker',
        duplicate: 'duplicate-worker',
      },
    ],
  })

  assert.equal(shouldSkipDuplicateRow('materials', { id: 'duplicate-material' }, duplicateAliasMaps), true)
  assert.equal(shouldSkipDuplicateRow('materials', { id: 'canon-material' }, duplicateAliasMaps), false)

  const expenseLineItem = applyDuplicateReferenceRemaps(
    'expense_line_items',
    {
      id: 'line-1',
      material_id: 'duplicate-material',
    },
    duplicateAliasMaps
  )

  const workerRate = applyDuplicateReferenceRemaps(
    'worker_wage_rates',
    {
      id: 'rate-1',
      worker_id: 'duplicate-worker',
      project_id: 'project-1',
      role_name: 'Lepasan',
    },
    duplicateAliasMaps
  )

  assert.equal(expenseLineItem.remapped, true)
  assert.deepEqual(expenseLineItem.row, {
    id: 'line-1',
    material_id: 'canon-material',
  })
  assert.equal(workerRate.remapped, true)
  assert.deepEqual(workerRate.row, {
    id: 'rate-1',
    worker_id: 'canon-worker',
    project_id: 'project-1',
    role_name: 'Lepasan',
  })
})

test('firestore backfill loader resolves payment parents from id-map metadata', () => {
  const idMapLookups = buildIdMapLookups([
    {
      legacy_firebase_path: 'teams/main/bills/102267e4-d9b2-43e4-a03b-c194b24a04c3',
      canonical_id: '506dd688-454d-589a-91e5-f7875b27d673',
      canonical_table: 'bills',
      kind: 'canonical',
      team_path: 'teams/main',
      parent_legacy_path: null,
    },
    {
      legacy_firebase_path: 'teams/main/bills/102267e4-d9b2-43e4-a03b-c194b24a04c3/payments/j0Q7FsINfeOIybcFelGM',
      canonical_id: '2e82ce4b-b18c-587f-b490-8c47b91797b3',
      canonical_table: 'bill_payments',
      kind: 'canonical',
      team_path: 'teams/main',
      parent_legacy_path: null,
    },
    {
      legacy_firebase_path: 'teams/main/funding_sources/0e387cf0-fd62-4a58-8aae-0d9f79d03022',
      canonical_id: '7b2d2ca1-7cc7-52a4-8bdc-b3b4ff2bd56b',
      canonical_table: 'loans',
      kind: 'canonical',
      team_path: 'teams/main',
      parent_legacy_path: null,
    },
    {
      legacy_firebase_path: 'teams/main/funding_sources/0e387cf0-fd62-4a58-8aae-0d9f79d03022/payments/573978bb-da9f-4bb1-b2bd-7a5fa7074149',
      canonical_id: '9b1adfc7-cc52-5c75-988d-038f6b1d3984',
      canonical_table: 'loan_payments',
      kind: 'canonical',
      team_path: 'teams/main',
      parent_legacy_path: null,
    },
  ])

  assert.equal(
    resolveParentCanonicalId(idMapLookups, '2e82ce4b-b18c-587f-b490-8c47b91797b3'),
    '506dd688-454d-589a-91e5-f7875b27d673'
  )
  assert.equal(
    resolveParentLegacyPath(idMapLookups, '2e82ce4b-b18c-587f-b490-8c47b91797b3'),
    'teams/main/bills/102267e4-d9b2-43e4-a03b-c194b24a04c3'
  )
  assert.equal(
    resolveParentCanonicalId(idMapLookups, '9b1adfc7-cc52-5c75-988d-038f6b1d3984'),
    '7b2d2ca1-7cc7-52a4-8bdc-b3b4ff2bd56b'
  )
  assert.equal(
    resolveParentLegacyPath(idMapLookups, '9b1adfc7-cc52-5c75-988d-038f6b1d3984'),
    'teams/main/funding_sources/0e387cf0-fd62-4a58-8aae-0d9f79d03022'
  )
  assert.equal(resolveParentCanonicalId(idMapLookups, 'missing-payment-id'), null)
  assert.equal(resolveParentLegacyPath(idMapLookups, 'missing-payment-id'), null)
})
