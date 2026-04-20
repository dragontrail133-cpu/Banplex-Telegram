import { normalizeRole } from './rbac.js'

const ATTACHMENT_ROLE_MATRIX = Object.freeze({
  Owner: Object.freeze({
    view: true,
    upload: true,
    editMetadata: true,
    delete: true,
    restore: true,
    permanentDelete: true,
  }),
  Admin: Object.freeze({
    view: true,
    upload: true,
    editMetadata: true,
    delete: true,
    restore: true,
    permanentDelete: true,
  }),
  Logistik: Object.freeze({
    view: true,
    upload: true,
    editMetadata: true,
    delete: true,
    restore: true,
    permanentDelete: false,
  }),
  Payroll: Object.freeze({
    view: true,
    upload: false,
    editMetadata: false,
    delete: false,
    restore: false,
    permanentDelete: false,
  }),
  Administrasi: Object.freeze({
    view: true,
    upload: true,
    editMetadata: true,
    delete: true,
    restore: true,
    permanentDelete: false,
  }),
  Viewer: Object.freeze({
    view: true,
    upload: false,
    editMetadata: false,
    delete: false,
    restore: false,
    permanentDelete: false,
  }),
})

const ATTACHMENT_ACTIONS = Object.freeze([
  'view',
  'upload',
  'editMetadata',
  'delete',
  'restore',
  'permanentDelete',
])

function getAttachmentPermissions(role) {
  const normalizedRole = normalizeRole(role)
  const fallbackPermissions = ATTACHMENT_ROLE_MATRIX.Viewer
  const rolePermissions =
    normalizedRole && Object.hasOwn(ATTACHMENT_ROLE_MATRIX, normalizedRole)
      ? ATTACHMENT_ROLE_MATRIX[normalizedRole]
      : fallbackPermissions

  return {
    role: normalizedRole,
    ...rolePermissions,
  }
}

function canPerformAttachmentAction(role, action) {
  if (!ATTACHMENT_ACTIONS.includes(action)) {
    return false
  }

  return Boolean(getAttachmentPermissions(role)[action])
}

function assertAttachmentAction(role, action, fallbackMessage = 'Aksi attachment tidak diizinkan untuk role ini.') {
  if (!canPerformAttachmentAction(role, action)) {
    throw new Error(fallbackMessage)
  }

  return true
}

export {
  ATTACHMENT_ACTIONS,
  ATTACHMENT_ROLE_MATRIX,
  assertAttachmentAction,
  canPerformAttachmentAction,
  getAttachmentPermissions,
}
