import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getAllowedAttendanceStatusValues,
  getAttendanceQuotaState,
  isAttendanceStatusAllowed,
} from '../../src/lib/attendance-payroll.js'

test('attendance quota allows all statuses when worker-day has no allocation', () => {
  assert.deepEqual(
    getAllowedAttendanceStatusValues({
      usedDayWeight: 0,
    }),
    ['full_day', 'half_day', 'overtime', 'absent']
  )
})

test('attendance quota restricts second project after half day to half day and overtime only', () => {
  assert.deepEqual(
    getAllowedAttendanceStatusValues({
      usedDayWeight: 0.5,
    }),
    ['half_day', 'overtime']
  )
  assert.equal(
    isAttendanceStatusAllowed({
      usedDayWeight: 0.5,
      nextAttendanceStatus: 'full_day',
    }),
    false
  )
  assert.equal(
    isAttendanceStatusAllowed({
      usedDayWeight: 0.5,
      nextAttendanceStatus: 'absent',
    }),
    false
  )
})

test('attendance quota fully locks new project when worker-day is already full', () => {
  assert.deepEqual(
    getAllowedAttendanceStatusValues({
      usedDayWeight: 1,
    }),
    []
  )
  assert.equal(
    isAttendanceStatusAllowed({
      usedDayWeight: 1,
      nextAttendanceStatus: 'overtime',
    }),
    false
  )
})

test('attendance quota preserves current unbilled status during edit even when day is full elsewhere', () => {
  assert.deepEqual(
    getAllowedAttendanceStatusValues({
      usedDayWeight: 1,
      currentAttendanceStatus: 'absent',
    }),
    ['absent']
  )
  assert.equal(
    isAttendanceStatusAllowed({
      usedDayWeight: 1,
      currentAttendanceStatus: 'absent',
      nextAttendanceStatus: 'absent',
    }),
    true
  )
  assert.equal(
    isAttendanceStatusAllowed({
      usedDayWeight: 1,
      currentAttendanceStatus: 'absent',
      nextAttendanceStatus: 'half_day',
    }),
    false
  )
})

test('attendance quota state reports fully allocated worker-day after half plus half', () => {
  assert.deepEqual(
    getAttendanceQuotaState({
      usedDayWeight: 1,
      currentRowWeight: 0,
    }),
    {
      totalOtherWeight: 1,
      remainingQuota: 0,
      isFullyAllocated: true,
      hasHalfQuotaOnly: false,
    }
  )
})
