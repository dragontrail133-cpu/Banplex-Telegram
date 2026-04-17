import { createElement, isValidElement, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion as Motion } from 'framer-motion'

function joinClasses(...values) {
  return values.flat().filter(Boolean).join(' ')
}

const cardClassNameMap = {
  default: 'app-card',
  strong: 'app-card-strong',
  dashed: 'app-card-dashed',
}

const buttonClassNameMap = {
  primary: 'app-button-primary',
  secondary: 'app-button-secondary',
  danger: 'app-button-danger',
  ghost: 'app-button-ghost',
}

const badgeClassNameMap = {
  neutral: 'app-tone-neutral',
  info: 'app-tone-info',
  success: 'app-tone-success',
  warning: 'app-tone-warning',
  danger: 'app-tone-danger',
}

function AppCard({
  as,
  tone = 'default',
  padded = true,
  className = '',
  children,
  ...props
}) {
  const Component = as ?? 'section'

  return (
    <Component
      className={joinClasses(cardClassNameMap[tone] ?? cardClassNameMap.default, padded && 'p-4', className)}
      {...props}
    >
      {children}
    </Component>
  )
}

function AppCardStrong(props) {
  return <AppCard tone="strong" {...props} />
}

function AppCardDashed(props) {
  return <AppCard tone="dashed" {...props} />
}

function AppButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  iconOnly = false,
  leadingIcon = null,
  trailingIcon = null,
  className = '',
  children,
  type = 'button',
  ...props
}) {
  const sizeClassName = {
    sm: 'px-3.5 py-2.5 text-xs',
    md: 'px-4 py-3 text-sm',
    lg: 'px-5 py-4 text-base',
  }

  return (
    <button
      className={joinClasses(
        'inline-flex items-center justify-center gap-2 rounded-[24px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
        buttonClassNameMap[variant] ?? buttonClassNameMap.primary,
        sizeClassName[size] ?? sizeClassName.md,
        fullWidth && 'w-full',
        iconOnly && 'h-11 w-11 px-0 py-0',
        className
      )}
      type={type}
      {...props}
    >
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      <span className="min-w-0">{children}</span>
      {trailingIcon ? <span className="shrink-0">{trailingIcon}</span> : null}
    </button>
  )
}

function AppInput({ className = '', ...props }) {
  return (
    <input
      className={joinClasses('app-input w-full rounded-[20px] px-4 py-3 text-base', className)}
      {...props}
    />
  )
}

function AppTextarea({ className = '', ...props }) {
  return (
    <textarea
      className={joinClasses('app-input min-h-28 w-full resize-none rounded-[20px] px-4 py-3 text-base', className)}
      {...props}
    />
  )
}

function AppSelect({ className = '', ...props }) {
  return (
    <select
      className={joinClasses('app-input w-full rounded-[20px] px-4 py-3 text-base', className)}
      {...props}
    />
  )
}

function AppBadge({
  tone = 'neutral',
  icon = null,
  className = '',
  iconClassName = '',
  children,
  ...props
}) {
  const renderedIcon =
    !icon
      ? null
      : isValidElement(icon)
        ? icon
        : createElement(icon, { className: 'h-3.5 w-3.5', strokeWidth: 2.25 })

  return (
    <span
      className={joinClasses(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]',
        badgeClassNameMap[tone] ?? badgeClassNameMap.neutral,
        className
      )}
      {...props}
    >
      {renderedIcon ? (
        <span className={joinClasses('shrink-0', iconClassName)}>
          {renderedIcon}
        </span>
      ) : null}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}

function PageHeader({ eyebrow = null, title, description = null, action = null, chips = null, className = '' }) {
  return (
    <section className={joinClasses('space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? <p className="app-kicker">{eyebrow}</p> : null}
          <h1 className="app-page-title">{title}</h1>
          {description ? <p className="app-page-lead">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {chips ? <div className="flex flex-wrap gap-2">{chips}</div> : null}
    </section>
  )
}

function SectionHeader({ eyebrow = null, title, description = null, action = null, className = '' }) {
  return (
    <div className={joinClasses('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? <p className="app-kicker">{eyebrow}</p> : null}
        <h2 className="app-section-title">{title}</h2>
        {description ? <p className="app-section-lead">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

function AppListCard(props) {
  return <AppCard tone="strong" {...props} />
}

function AppListRow({
  leading = null,
  title,
  description = null,
  trailing = null,
  actions = null,
  className = '',
  ...props
}) {
  return (
    <div
      className={joinClasses(
        'flex items-start justify-between gap-3 border-b border-[var(--app-border-color)] px-2 py-2 last:border-b-0',
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {leading ? (
          <div className="mt-0.5 shrink-0">
            {leading}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-[var(--app-text-color)]">
            {title}
          </h3>
          {description ? <p className="mt-0.5 truncate text-xs text-[var(--app-hint-color)]">{description}</p> : null}
        </div>
      </div>

      <div className="flex shrink-0 items-start gap-2">
        {trailing ? <div>{trailing}</div> : null}
        {actions ? <div>{actions}</div> : null}
      </div>
    </div>
  )
}

function AppEmptyState({
  title,
  description = null,
  action = null,
  icon = null,
  className = '',
}) {
  return (
    <AppCardDashed className={joinClasses('text-center', className)}>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-2">
        {icon ? <div className="text-[var(--app-hint-color)]">{icon}</div> : null}
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--app-text-color)]">{title}</p>
          {description ? <p className="text-sm leading-6 text-[var(--app-hint-color)]">{description}</p> : null}
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </AppCardDashed>
  )
}

function AppErrorState({
  title = 'Terjadi Masalah',
  description,
  action = null,
  className = '',
}) {
  return (
    <AppCard className={joinClasses('app-tone-danger', className)}>
      <div className="space-y-2">
        <p className="app-meta text-[var(--app-tone-danger-text)]">{title}</p>
        {description ? <p className="text-sm leading-6">{description}</p> : null}
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </AppCard>
  )
}

function OverlayPanel({
  open,
  onClose,
  title,
  description = null,
  children,
  footer = null,
  placement = 'bottom',
  maxWidth = 'md',
  className = '',
}) {
  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  const widthClassName = useMemo(() => {
    return {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
    }[maxWidth] ?? 'max-w-md'
  }, [maxWidth])

  if (typeof document === 'undefined' || !open) {
    return null
  }

  const isBottomPlacement = placement === 'bottom'

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className={joinClasses(
            'fixed inset-0 z-[80] flex justify-center px-2 py-2',
            isBottomPlacement ? 'items-end sm:items-center' : 'items-center'
          )}
        >
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="app-backdrop absolute inset-0"
            onClick={onClose}
            role="presentation"
          />

          <Motion.div
            initial={isBottomPlacement ? { y: '100%', opacity: 0.9 } : { scale: 0.96, opacity: 0 }}
            animate={isBottomPlacement ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={isBottomPlacement ? { y: '100%', opacity: 0.9 } : { scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            drag={isBottomPlacement ? 'y' : false}
            dragConstraints={isBottomPlacement ? { top: 0, bottom: 0 } : undefined}
            dragElastic={isBottomPlacement ? 0.2 : undefined}
            onDragEnd={
              isBottomPlacement
                ? (event, info) => {
                    if (info.offset.y > 60) {
                      onClose?.()
                    }
                  }
                : undefined
            }
            className={joinClasses(
              'app-card-strong relative w-full overflow-hidden',
              widthClassName,
              isBottomPlacement ? 'sm:rounded-[28px]' : 'rounded-[28px]',
              className
            )}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <div className="flex w-full justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-[var(--app-border-color)]" />
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-[var(--app-border-color)] px-4 pb-3">
              <div className="min-w-0">
                <p className="app-section-title">{title}</p>
                {description ? <p className="app-section-lead">{description}</p> : null}
              </div>
              {onClose ? (
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] text-[var(--app-text-color)]"
                  onClick={onClose}
                  type="button"
                  aria-label="Tutup"
                >
                  ×
                </button>
              ) : null}
            </div>

            <div className="px-4 py-4">{children}</div>

            {footer ? <div className="border-t border-[var(--app-border-color)] px-4 py-4">{footer}</div> : null}
          </Motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}

function AppSheet(props) {
  return <OverlayPanel placement="bottom" maxWidth="md" {...props} />
}

function AppDialog(props) {
  return <OverlayPanel placement="center" maxWidth="lg" {...props} />
}

export {
  AppBadge,
  AppButton,
  AppCard,
  AppCardDashed,
  AppCardStrong,
  AppDialog,
  AppEmptyState,
  AppErrorState,
  AppInput,
  AppListCard,
  AppListRow,
  AppSelect,
  AppSheet,
  AppTextarea,
  PageHeader,
  SectionHeader,
}
