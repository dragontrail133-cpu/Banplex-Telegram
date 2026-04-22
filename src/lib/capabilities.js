import { hasRequiredRole } from './rbac.js'

const capabilityContracts = Object.freeze({
  manual_stock_out: Object.freeze({
    key: 'manual_stock_out',
    label: 'Stok Barang',
    allowedRoles: Object.freeze(['Owner', 'Admin', 'Logistik']),
    accessDeniedMessage: 'Role Anda tidak diizinkan untuk stock-out manual.',
  }),
  master_data_admin: Object.freeze({
    key: 'master_data_admin',
    label: 'Master',
    allowedRoles: Object.freeze(['Owner', 'Admin']),
    accessDeniedMessage: 'Master hanya tersedia untuk Owner dan Admin.',
    runtimeBoundary: 'transitional',
    runtimeExceptionNote:
      'Direct write Master masih transitional lewat useMasterStore; perlakukan sebagai exception runtime, bukan pola inti release.',
  }),
  team_invite: Object.freeze({
    key: 'team_invite',
    label: 'Tim',
    allowedRoles: Object.freeze(['Owner']),
    accessDeniedMessage: 'Tim hanya tersedia untuk Owner.',
    runtimeBoundary: 'transitional',
    runtimeExceptionNote:
      'Direct write Tim masih transitional lewat useTeamStore; perlakukan sebagai exception runtime, bukan pola inti release.',
  }),
  payroll_access: Object.freeze({
    key: 'payroll_access',
    label: 'Payroll',
    allowedRoles: Object.freeze(['Owner', 'Admin', 'Payroll']),
    accessDeniedMessage: 'Payroll hanya tersedia untuk Owner, Admin, dan Payroll.',
  }),
})

const capabilityRoleMap = Object.freeze(
  Object.fromEntries(
    Object.entries(capabilityContracts).map(([key, contract]) => [key, contract.allowedRoles])
  )
)

const capabilityLabels = Object.freeze(
  Object.fromEntries(
    Object.entries(capabilityContracts).map(([key, contract]) => [key, contract.label])
  )
)

function getCapabilityContract(capability) {
  const normalizedCapability = String(capability ?? '').trim()

  return capabilityContracts[normalizedCapability] ?? null
}

function getCapabilityAllowedRoles(capability) {
  return getCapabilityContract(capability)?.allowedRoles ?? []
}

function canUseCapability(role, capability) {
  return hasRequiredRole(role, getCapabilityAllowedRoles(capability))
}

function assertCapabilityAccess(role, capability, fallbackMessage = null, statusCode = null) {
  const contract = getCapabilityContract(capability)

  if (!contract) {
    const error = new Error(
      `Capability tidak dikenal: ${String(capability ?? '').trim() || 'unknown'}`
    )

    if (Number.isInteger(statusCode)) {
      error.statusCode = statusCode
    }

    throw error
  }

  if (canUseCapability(role, contract.key)) {
    return contract
  }

  const error = new Error(fallbackMessage ?? contract.accessDeniedMessage ?? 'Akses ditolak.')

  if (Number.isInteger(statusCode)) {
    error.statusCode = statusCode
  }

  throw error
}

export {
  assertCapabilityAccess,
  capabilityContracts,
  capabilityLabels,
  capabilityRoleMap,
  canUseCapability,
  getCapabilityAllowedRoles,
  getCapabilityContract,
}
