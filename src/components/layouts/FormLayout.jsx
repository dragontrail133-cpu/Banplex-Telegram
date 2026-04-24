import { Children, useMemo } from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import FormHeader from './FormHeader'
import {
  AppButton,
  AppViewportSafeArea,
  FormActionBar,
  PageShell,
} from '../ui/AppPrimitives'
import useMobileKeyboardVisible from '../../hooks/useMobileKeyboardVisible'

function FormLayout({
  title,
  description = null,
  eyebrow = 'Form',
  onBack,
  headerAction = null,
  sections = [],
  embedded = false,
  embeddedFooterMode = 'sticky',
  hideFooterOnKeyboardVisible = true,
  formId = null,
  actionLabel = null,
  isSubmitting = false,
  submitDisabled = false,
  secondaryAction = null,
  contentClassName = '',
  children,
}) {
  const normalizedSections = useMemo(() => {
    if (!Array.isArray(sections)) {
      return []
    }

    return sections
      .filter(Boolean)
      .map((section, index) => ({
        id: String(section.id ?? index),
        title: String(section.title ?? `Bagian ${index + 1}`),
        description:
          typeof section.description === 'string' && section.description.trim().length > 0
            ? section.description.trim()
            : null,
      }))
  }, [sections])
  const sectionChildren = useMemo(() => Children.toArray(children), [children])
  const hasSectionShell = normalizedSections.length > 0 && sectionChildren.length > 0
  const hasFooterAction = Boolean(formId && actionLabel)
  const isKeyboardVisible = useMobileKeyboardVisible()

  const shellContent = (
    <>
      {embedded && hasSectionShell ? (
        <div className="space-y-4 py-2">
          {sectionChildren}
        </div>
      ) : (
        <div className="space-y-4">
          {hasSectionShell && embedded ? sectionChildren : children}
        </div>
      )}

      {hasFooterAction ? (
        <div
          className={[
            embedded
              ? embeddedFooterMode === 'fixed'
                ? 'pointer-events-none fixed inset-x-0 bottom-0 z-[110] mx-auto w-full max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2'
                : 'sticky bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-20 pt-3'
              : 'pointer-events-none fixed inset-x-0 bottom-0 z-[110] mx-auto w-full max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2',
            hideFooterOnKeyboardVisible && isKeyboardVisible
              ? 'pointer-events-none translate-y-[calc(100%+1.25rem)] opacity-0'
              : 'opacity-100',
            'transition-[transform,opacity] duration-200 ease-out',
          ]
            .filter(Boolean)
            .join(' ')}
        >
        <div
          className={[
            embedded
              ? 'pointer-events-auto app-card-strong p-3'
              : 'pointer-events-auto rounded-[28px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] p-3 shadow-[var(--app-card-shadow-strong)]',
          ].join(' ')}
          >
          <FormActionBar
            actionLabel={actionLabel}
            formId={formId}
            isSubmitting={isSubmitting}
            submitDisabled={submitDisabled}
            secondaryAction={secondaryAction}
          />
          </div>
        </div>
      ) : null}
    </>
  )

  if (embedded) {
    return (
      <div
        className={[
          'space-y-4',
          hasFooterAction ? 'pb-[calc(max(6.5rem,env(safe-area-inset-bottom))+0.75rem)]' : '',
          contentClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {shellContent}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ y: '100%', opacity: 0.8 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0.8 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--app-surface-strong-color)]"
    >
      <AppViewportSafeArea className="min-h-full sm:mx-auto sm:max-w-md">
        <PageShell
          className={[
            'min-h-full',
            hasFooterAction ? 'pb-[calc(max(6.5rem,env(safe-area-inset-bottom))+0.75rem)]' : '',
            contentClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <FormHeader
            action={headerAction}
            description={description}
            eyebrow={eyebrow}
            onBack={onBack}
            title={title}
          />
          {shellContent}
        </PageShell>
      </AppViewportSafeArea>
    </motion.div>
  )
}

export default FormLayout
