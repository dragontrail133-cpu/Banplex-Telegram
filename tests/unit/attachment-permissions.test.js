import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ATTACHMENT_ROLE_MATRIX,
  assertAttachmentAction,
  canPerformAttachmentAction,
  getAttachmentPermissions,
} from '../../src/lib/attachment-permissions.js'

test('attachment permissions keep owner and admin fully privileged', () => {
  const ownerPermissions = getAttachmentPermissions('Owner')
  const adminPermissions = getAttachmentPermissions('Admin')

  assert.equal(ownerPermissions.view, true)
  assert.equal(ownerPermissions.upload, true)
  assert.equal(ownerPermissions.editMetadata, true)
  assert.equal(ownerPermissions.delete, true)
  assert.equal(ownerPermissions.restore, true)
  assert.equal(ownerPermissions.permanentDelete, true)

  assert.equal(adminPermissions.permanentDelete, true)
  assert.equal(canPerformAttachmentAction('Admin', 'permanentDelete'), true)
})

test('attachment permissions restrict recovery and hard delete by role', () => {
  assert.equal(getAttachmentPermissions('Logistik').permanentDelete, false)
  assert.equal(getAttachmentPermissions('Administrasi').permanentDelete, false)
  assert.equal(getAttachmentPermissions('Payroll').restore, false)
  assert.equal(getAttachmentPermissions('Viewer').upload, false)
  assert.equal(getAttachmentPermissions('Unknown role').permanentDelete, false)

  assert.equal(canPerformAttachmentAction('Logistik', 'restore'), true)
  assert.equal(canPerformAttachmentAction('Payroll', 'delete'), false)
  assert.equal(canPerformAttachmentAction('Viewer', 'permanentDelete'), false)
})

test('attachment action assertion rejects unsupported actions', () => {
  assert.throws(() => assertAttachmentAction('Viewer', 'delete'), {
    message: 'Aksi attachment tidak diizinkan untuk role ini.',
  })

  assert.deepEqual(Object.keys(ATTACHMENT_ROLE_MATRIX), [
    'Owner',
    'Admin',
    'Logistik',
    'Payroll',
    'Administrasi',
    'Viewer',
  ])
})
