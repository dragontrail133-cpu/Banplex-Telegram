import { createElement, isValidElement, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft } from 'lucide-react'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import {
  formatNominalInputValue,
  normalizeNominalInputValue,
} from '../../lib/nominal'
import useMobileKeyboardVisible from '../../hooks/useMobileKeyboardVisible'

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

function AppSafeZone({
  as,
  className = '',
  children,
  ...props
}) {
  const Component = as ?? 'div'

  return (
    <Component className={joinClasses('px-1 py-2', className)} {...props}>
      {children}
    </Component>
  )
}

function AppViewportSafeArea({
  as,
  className = '',
  children,
  ...props
}) {
  const Component = as ?? 'div'

  return (
    <Component
      className={joinClasses(
        'pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

function PageShell({
  as,
  className = '',
  children,
  ...props
}) {
  return (
    <AppSafeZone as={as ?? 'section'} className={joinClasses('space-y-4', className)} {...props}>
      {children}
    </AppSafeZone>
  )
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

function AppNominalInput({
  className = '',
  onValueChange,
  value = '',
  ...props
}) {
  return (
    <AppInput
      className={className}
      {...props}
      inputMode="numeric"
      onChange={(event) => {
        onValueChange?.(normalizeNominalInputValue(event.target.value))
      }}
      type="text"
      value={formatNominalInputValue(value)}
    />
  )
}

function AppTextarea({ className = '', ...props }) {
  return (
    <textarea
      className={joinClasses('app-input h-12 w-full resize-none rounded-[20px] px-4 py-3 text-base', className)}
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

function AppToggleGroup({
  label = null,
  description = null,
  options = [],
  value = null,
  onChange,
  disabled = false,
  className = '',
  buttonSize = 'md',
  compact = false,
  stacked = false,
}) {
  return (
    <div className={joinClasses('space-y-2', className)} role="group">
      {label || description ? (
        <div className="space-y-1">
          {label ? <p className="text-sm font-semibold text-[var(--app-text-color)]">{label}</p> : null}
          {description ? (
            <p className="text-xs leading-5 text-[var(--app-hint-color)]">{description}</p>
          ) : null}
        </div>
      ) : null}

      <div className={stacked ? '' : 'overflow-x-auto pb-1'}>
        <div
          className={joinClasses(
            'grid rounded-[24px] border border-[var(--app-border-color)] bg-[var(--app-surface-low-color)] p-1',
            stacked ? 'gap-2' : compact ? 'gap-1.5 min-w-full' : 'gap-2'
          )}
          style={
            stacked
              ? {
                  gridTemplateColumns: '1fr',
                }
              : {
                  gridTemplateColumns: `repeat(${Math.max(options.length, 1)}, minmax(${compact ? '6rem' : '7.5rem'}, 1fr))`,
                }
          }
        >
          {options.map((option) => {
            const isActive = value === option.value
            const isOptionDisabled = disabled || Boolean(option.disabled)

            return (
              <AppButton
                key={option.value}
                aria-pressed={isActive}
                className={joinClasses('w-full rounded-[20px]', stacked && 'justify-start text-left')}
                disabled={isOptionDisabled}
                onClick={() => onChange?.(option.value)}
                size={buttonSize}
                type="button"
                variant={isActive ? 'primary' : 'secondary'}
              >
                {option.label}
              </AppButton>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function AppWrapToggleGroup({
  label = null,
  description = null,
  options = [],
  value = null,
  onChange,
  disabled = false,
  className = '',
  buttonSize = 'md',
}) {
  return (
    <div className={joinClasses('space-y-2', className)} role="group">
      {label || description ? (
        <div className="space-y-1">
          {label ? <p className="text-sm font-semibold text-[var(--app-text-color)]">{label}</p> : null}
          {description ? (
            <p className="text-xs leading-5 text-[var(--app-hint-color)]">{description}</p>
          ) : null}
        </div>
      ) : null}

      <div
        className="grid gap-2 rounded-[24px] border border-[var(--app-border-color)] bg-[var(--app-surface-low-color)] p-1"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))',
        }}
      >
        {options.map((option) => {
          const isActive = value === option.value

          return (
            <AppButton
              key={option.value}
              aria-pressed={isActive}
              className="w-full rounded-[20px] whitespace-normal text-center leading-5"
              disabled={disabled}
              onClick={() => onChange?.(option.value)}
              size={buttonSize}
              type="button"
              variant={isActive ? 'primary' : 'secondary'}
            >
              {option.label}
            </AppButton>
          )
        })}
      </div>
    </div>
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

function renderHeaderControl({ backAction, backLabel, action }) {
  if (backAction && action) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <AppButton
          className="shrink-0 rounded-full"
          leadingIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={backAction}
          size="sm"
          type="button"
          variant="secondary"
        >
          {backLabel ?? 'Kembali'}
        </AppButton>
      </div>
    )
  }

  if (backAction) {
    return (
      <AppButton
        className="shrink-0 rounded-full"
        leadingIcon={<ArrowLeft className="h-4 w-4" />}
        onClick={backAction}
        size="sm"
        type="button"
        variant="secondary"
      >
        {backLabel ?? 'Kembali'}
      </AppButton>
    )
  }

  if (action) {
    return <div className="shrink-0">{action}</div>
  }

  return <div className="h-11 w-11 shrink-0" aria-hidden="true" />
}

function PageHeader({
  eyebrow = null,
  title,
  description = null,
  action = null,
  backAction = null,
  backLabel = 'Kembali',
  chips = null,
  compact = false,
  className = '',
}) {
  return (
    <section className={joinClasses('space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? <p className="app-kicker">{eyebrow}</p> : null}
          <h1 className={compact ? 'app-form-page-title' : 'app-page-title'}>{title}</h1>
          {description ? <p className={compact ? 'app-form-page-lead' : 'app-page-lead'}>{description}</p> : null}
        </div>
        {renderHeaderControl({ backAction, backLabel, action })}
      </div>
      {chips ? <div className="flex flex-wrap gap-2">{chips}</div> : null}
    </section>
  )
}

function SectionHeader({
  eyebrow = null,
  title,
  description = null,
  action = null,
  backAction = null,
  backLabel = 'Kembali',
  className = '',
}) {
  return (
    <div className={joinClasses('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? <p className="app-kicker">{eyebrow}</p> : null}
        <h2 className="app-section-title">{title}</h2>
        {description ? <p className="app-section-lead">{description}</p> : null}
      </div>
      {renderHeaderControl({ backAction, backLabel, action })}
    </div>
  )
}

function PageSection({
  eyebrow = null,
  title,
  description = null,
  action = null,
  className = '',
  children,
}) {
  return (
    <section className={joinClasses('space-y-4', className)}>
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={action}
      />
      {children}
    </section>
  )
}

function FormSection({
  eyebrow = null,
  title,
  description = null,
  action = null,
  className = '',
  children,
}) {
  return (
    <AppCardStrong className={joinClasses('space-y-4', className)}>
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={action}
      />
      {children}
    </AppCardStrong>
  )
}

function FormActionBar({
  formId,
  actionLabel,
  isSubmitting = false,
  submitDisabled = false,
  secondaryAction = null,
  className = '',
}) {
  if (!formId || !actionLabel) {
    return null
  }

  return (
    <div className={joinClasses('flex flex-col-reverse gap-3 sm:flex-row sm:justify-end', className)}>
      {secondaryAction}
      <AppButton
        className="w-full sm:w-auto"
        disabled={Boolean(isSubmitting || submitDisabled)}
        form={formId}
        type="submit"
      >
        {isSubmitting ? 'Menyimpan...' : actionLabel}
      </AppButton>
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
        'flex items-start justify-between gap-3 border-b border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-2 py-2 last:border-b-0',
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

function AppTechnicalCard({
  label,
  value,
  className = '',
}) {
  return (
    <AppCard className={joinClasses('space-y-2 bg-[var(--app-surface-low-color)] px-3 py-3', className)} padded={false}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
        {label}
      </p>
      <p className="text-sm font-semibold text-[var(--app-text-color)]">{value}</p>
    </AppCard>
  )
}

function AppTechnicalGrid({
  items = [],
  className = '',
}) {
  return (
    <div className={joinClasses('grid gap-2 sm:grid-cols-2', className)}>
      {items.map((item) => (
        <AppTechnicalCard
          key={item.key ?? item.label}
          className={item.className ?? ''}
          label={item.label}
          value={item.value}
        />
      ))}
    </div>
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
  const isKeyboardVisible = useMobileKeyboardVisible()

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
  const hasFooter = Boolean(footer)

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div
          className={joinClasses(
            'fixed inset-0 z-[140] flex justify-center px-2 py-2',
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
              'app-card-strong relative flex w-full max-h-[calc(100dvh-1rem)] flex-col overflow-hidden',
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

            <div
              className={joinClasses(
                'min-h-0 flex-1 overflow-y-auto px-4 py-4',
                hasFooter ? 'pb-[calc(max(5.25rem,env(safe-area-inset-bottom))+0.5rem)]' : ''
              )}
            >
              {children}
            </div>

            {footer ? (
              <div
                className={joinClasses(
                  'pointer-events-auto border-t border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 transition-[transform,opacity] duration-200 ease-out',
                  isKeyboardVisible ? 'pointer-events-none translate-y-[calc(100%+1rem)] opacity-0' : 'opacity-100'
                )}
              >
                {footer}
              </div>
            ) : null}
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
  AppTechnicalCard,
  AppTechnicalGrid,
  AppNominalInput,
  AppListCard,
  AppListRow,
  FormActionBar,
  FormSection,
  AppSafeZone,
  AppSelect,
  AppToggleGroup,
  AppWrapToggleGroup,
  AppSheet,
  AppTextarea,
  AppViewportSafeArea,
  PageShell,
  PageHeader,
  PageSection,
  SectionHeader,
}
