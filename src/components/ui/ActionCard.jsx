import { useMemo, useState } from 'react'
import useAuthStore from '../../store/useAuthStore'
import { allRoles, hasRequiredRole, normalizeRole } from '../../lib/rbac'
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

  if (allowedRoles.length === 1 && allowedRoles[0] === allRoles[0]) {
    return currentRole === allRoles[0]
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
  details = [],
  amount = null,
  amountClassName = '',
  badge = null,
  badgeClassName = '',
  badges = [],
  badgePlacement = 'afterAmount',
  maxVisibleBadges = 1,
  actions = [],
  className = '',
  leadingIcon = null,
  titleClassName = '',
  menuMode = 'inline',
  onOpenMenu = null,
}) {
  const role = useAuthStore((state) => state.role)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const visibleActions = useMemo(() => {
    return actions.filter((action) => isActionVisible(action, role))
  }, [actions, role])

  const visibleBadges = useMemo(() => {
    const compactBadges = [badge, ...badges].filter(Boolean)
    const badgeLimit = Math.max(Number(maxVisibleBadges ?? 1) || 0, 0)

    return compactBadges.slice(0, badgeLimit)
  }, [badge, badges, maxVisibleBadges])

  const hiddenBadgeCount = Math.max([badge, ...badges].filter(Boolean).length - visibleBadges.length, 0)
  const amountNode = amount ? (
    <span className={`truncate text-sm font-semibold text-[var(--app-text-color)] ${amountClassName}`}>
      {amount}
    </span>
  ) : null
  const badgeStack =
    visibleBadges.length > 0 || hiddenBadgeCount > 0 ? (
      <div className="flex min-w-0 flex-col items-end gap-1">
        {visibleBadges.map((visibleBadge, index) => (
          <span
            key={`${title}-${index}-${visibleBadge}`}
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              index === 0
                ? `border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)] ${badgeClassName}`
                : 'border-[var(--app-border-color)] bg-[var(--app-surface-low-color)] text-[var(--app-hint-color)]'
            }`}
          >
            {visibleBadge}
          </span>
        ))}
        {hiddenBadgeCount > 0 ? (
          <span className="inline-flex items-center rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-low-color)] px-2 py-0.5 text-[11px] font-medium text-[var(--app-hint-color)]">
            +{hiddenBadgeCount}
          </span>
        ) : null}
      </div>
    ) : null

  const handleActionClick = (action) => {
    setIsMenuOpen(false)

    if (typeof action.onClick === 'function') {
      action.onClick(action)
    }
  }

  const handleCardClick = () => {
    if (menuMode === 'shared') {
      if (typeof onOpenMenu === 'function') {
        onOpenMenu({
          title,
          description: subtitle,
          actions: visibleActions,
        })
      }

      return
    }

    setIsMenuOpen(true)
  }

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-expanded={isMenuOpen}
        className={`flex w-full items-start justify-between gap-2 rounded-[22px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] p-2 text-left transition active:bg-[var(--app-surface-high-color)] ${className}`}
        onClick={handleCardClick}
        type="button"
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
            {details.length > 0 ? (
              <div className="mt-1 space-y-0.5">
                {details.slice(0, 3).map((detail, index) => (
                  <p
                    key={`${title}-${index}-${detail}`}
                    className="truncate text-[11px] leading-4 text-[var(--app-hint-color)]"
                  >
                    {detail}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          <div className="flex min-w-0 flex-col items-end gap-1">
            {badgePlacement === 'beforeAmount' ? (
              <>
                {badgeStack}
                {amountNode}
              </>
            ) : (
              <>
                {amountNode}
                {badgeStack}
              </>
            )}
          </div>
        </div>
      </button>

      {menuMode !== 'shared' ? (
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
      ) : null}
    </>
  )
}

function ActionCardSheet({ open, title = 'Detail dan Aksi', description = null, actions = [], onClose }) {
  const handleActionClick = (action) => {
    if (typeof onClose === 'function') {
      onClose()
    }

    if (typeof action.onClick === 'function') {
      action.onClick(action)
    }
  }

  return (
    <AppSheet open={open} onClose={onClose} title={title} description={description}>
      <div className="space-y-3">
        {actions.length > 0 ? (
          actions.map((action) => (
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
  )
}

export default ActionCard
export { ActionCardSheet }
