import useAuthStore from '../store/useAuthStore'
import { hasRequiredRole } from '../lib/rbac'
import { canUseCapability } from '../lib/capabilities'

function ProtectedRoute({
  allowedRoles = [],
  requiredCapability = null,
  title = 'Akses Ditolak',
  description = 'Anda tidak memiliki akses ke halaman ini.',
  children,
}) {
  const role = useAuthStore((state) => state.role)
  const isRegistered = useAuthStore((state) => state.isRegistered)
  const hasAccess = requiredCapability
    ? canUseCapability(role, requiredCapability)
    : hasRequiredRole(role, allowedRoles)

  if (!isRegistered || !hasAccess) {
    return (
      <section className="rounded-[26px] border border-rose-200 bg-rose-50/85 px-5 py-5 text-rose-900">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-700">
          {title}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
          Anda tidak memiliki akses ke halaman ini.
        </h2>
        <p className="mt-3 text-sm leading-6 text-rose-800/80">
          {description}
        </p>
      </section>
    )
  }

  return children
}

export default ProtectedRoute
