import { hasRequiredRole } from './rbac.js'

const capabilityRoleMap = Object.freeze({
  manual_stock_out: ['Owner', 'Admin', 'Logistik'],
  master_data_admin: ['Owner', 'Admin'],
  team_invite: ['Owner'],
  payroll_access: ['Owner', 'Admin', 'Payroll'],
})

const capabilityLabels = Object.freeze({
  manual_stock_out: 'manual_stock_out',
  master_data_admin: 'master_data_admin',
  team_invite: 'team_invite',
  payroll_access: 'payroll_access',
})

function getCapabilityAllowedRoles(capability) {
  const normalizedCapability = String(capability ?? '').trim()

  return capabilityRoleMap[normalizedCapability] ?? []
}

function canUseCapability(role, capability) {
  return hasRequiredRole(role, getCapabilityAllowedRoles(capability))
}

export { capabilityLabels, capabilityRoleMap, canUseCapability, getCapabilityAllowedRoles }
