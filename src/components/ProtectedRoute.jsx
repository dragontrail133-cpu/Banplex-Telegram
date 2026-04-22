import useAuthStore from '../store/useAuthStore'
import { hasRequiredRole } from '../lib/rbac'
import { canUseCapability, getCapabilityContract } from '../lib/capabilities'

function ProtectedRoute({
  allowedRoles = [],
  requiredCapability = null,
  title = 'Akses Ditolak',
  description = null,
  children,
}) {
  const role = useAuthStore((state) => state.role)
  const isRegistered = useAuthStore((state) => state.isRegistered)
  const capabilityContract = requiredCapability
    ? getCapabilityContract(requiredCapability)
    : null
  const hasAccess = requiredCapability
    ? canUseCapability(role, capabilityContract?.key ?? requiredCapability)
    : hasRequiredRole(role, allowedRoles)
  const resolvedDescription =
    description ??
    capabilityContract?.accessDeniedMessage ??
    'Anda tidak memiliki akses ke halaman ini.'

  if (!isRegistered || !hasAccess) {
    return (
      <section className="rounded-[26px] border border-rose-200 bg-rose-50 px-5 py-5 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-700">
          {title}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          Anda tidak memiliki akses ke halaman ini.
        </h2>
        <p className="mt-3 text-sm leading-6 text-rose-800/80">
          {resolvedDescription}
        </p>
      </section>
    )
  }

  return children
}

export default ProtectedRoute
