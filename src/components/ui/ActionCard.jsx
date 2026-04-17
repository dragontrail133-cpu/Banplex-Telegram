import { useMemo, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import useAuthStore from '../../store/useAuthStore'
import { hasRequiredRole, normalizeRole } from '../../lib/rbac'
import { AppBadge, AppButton, AppCard, AppCardDashed, AppSheet } from './AppPrimitives'

function isActionVisible(action, userRole) {
  if (!action || action.hidden) {
    return false
  }

  const requiredRole = action.requireRole ?? action.allowedRole ?? null

  if (!requiredRole) {
    return true
  }

  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  const currentRole = normalizeRole(userRole)

  if (allowedRoles.length === 1 && allowedRoles[0] === 'Owner') {
    return currentRole === 'Owner'
  }

  return hasRequiredRole(currentRole, allowedRoles)
}

function ActionButton({ action, onClick }) {
  const isDanger = action.variant === 'danger' || action.destructive

  return (
    <AppButton
      fullWidth
      leadingIcon={action.icon ? <span className="shrink-0">{action.icon}</span> : null}
      disabled={action.disabled}
      onClick={() => onClick(action)}
      size="lg"
      type="button"
      variant={isDanger ? 'danger' : 'secondary'}
    >
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="truncate font-medium">{action.label}</span>
        {action.meta ? <span className="shrink-0 text-xs opacity-80">{action.meta}</span> : null}
      </span>
    </AppButton>
  )
}

function ActionCard({
  title,
  subtitle,
  amount = null,
  amountClassName = '',
  badge = null,
  badgeClassName = '',
  badges = [],
  actions = [],
  className = '',
  leadingIcon = null,
  titleClassName = '',
}) {
  const role = useAuthStore((state) => state.role)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const visibleActions = useMemo(() => {
    return actions.filter((action) => isActionVisible(action, role))
  }, [actions, role])

  const visibleBadges = useMemo(() => {
    const compactBadges = [badge, ...badges].filter(Boolean)

    return compactBadges.slice(0, 1)
  }, [badge, badges])

  const hiddenBadgeCount = Math.max([badge, ...badges].filter(Boolean).length - visibleBadges.length, 0)

  const handleActionClick = (action) => {
    setIsMenuOpen(false)

    if (typeof action.onClick === 'function') {
      action.onClick(action)
    }
  }

  return (
    <>
      <article
        className={`flex items-start justify-between gap-2 border-b border-[var(--app-border-color)] bg-transparent p-2 ${className}`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {leadingIcon ? (
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)]">
              {leadingIcon}
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <h3
              className={`truncate text-sm font-semibold text-[var(--app-text-color)] ${titleClassName}`}
            >
              {title}
            </h3>
            <p className="mt-0.5 truncate text-xs text-[var(--app-hint-color)]">{subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          <div className="flex min-w-0 flex-col items-end gap-1">
            {amount ? (
              <span
                className={`truncate text-sm font-semibold text-[var(--app-text-color)] ${amountClassName}`}
              >
                {amount}
              </span>
            ) : null}
            {visibleBadges.length > 0 ? (
              <span
                className={`inline-flex items-center rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-2 py-0.5 text-[11px] font-medium text-[var(--app-text-color)] ${badgeClassName}`}
              >
                {visibleBadges[0]}
              </span>
            ) : null}
            {hiddenBadgeCount > 0 ? (
              <span className="inline-flex items-center rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-2 py-0.5 text-[11px] font-medium text-[var(--app-hint-color)]">
                +{hiddenBadgeCount}
              </span>
            ) : null}
          </div>

          {visibleActions.length > 0 ? (
            <button
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)] transition hover:bg-[color-mix(in_srgb,var(--app-surface-strong-color)_86%,var(--app-bg-color))] disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setIsMenuOpen(true)}
              type="button"
              aria-label={`Buka menu aksi untuk ${title}`}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </article>

      <AppSheet
        open={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title="Detail dan Aksi"
        description={title}
      >
        <div className="space-y-3">

          {visibleActions.length > 0 ? (
            visibleActions.map((action) => (
              <ActionButton
                key={action.id ?? action.label}
                action={action}
                onClick={handleActionClick}
              />
            ))
          ) : (
            <AppCardDashed className="px-3 py-4 text-sm text-[var(--app-hint-color)]">
              Tidak ada aksi yang tersedia untuk role Anda.
            </AppCardDashed>
          )}
        </div>
      </AppSheet>
    </>
  )
}

export default ActionCard
