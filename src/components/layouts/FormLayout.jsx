import { Children, useMemo, useState } from 'react'
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import FormHeader from './FormHeader'
import {
  AppButton,
  AppViewportSafeArea,
  FormActionBar,
  PageShell,
} from '../ui/AppPrimitives'

function clampSectionIndex(value, sectionCount) {
  if (sectionCount <= 0) {
    return 0
  }

  const parsedValue = Number(value)

  if (!Number.isFinite(parsedValue)) {
    return 0
  }

  return Math.min(Math.max(Math.trunc(parsedValue), 0), sectionCount - 1)
}

function FormLayout({
  title,
  onBack,
  sections = [],
  initialSectionIndex = 0,
  embedded = false,
  formId = null,
  actionLabel = null,
  isSubmitting = false,
  submitDisabled = false,
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
  const hasSectionShell = normalizedSections.length > 1 && sectionChildren.length > 1
  const [activeSectionIndex, setActiveSectionIndex] = useState(() =>
    clampSectionIndex(initialSectionIndex, normalizedSections.length)
  )

  const effectiveActiveSectionIndex = clampSectionIndex(
    activeSectionIndex,
    normalizedSections.length
  )
  const activeSectionChild = hasSectionShell
    ? sectionChildren[effectiveActiveSectionIndex] ?? null
    : children
  const isFirstSection = effectiveActiveSectionIndex <= 0
  const isLastSection = effectiveActiveSectionIndex >= normalizedSections.length - 1
  const goToPreviousSection = () => {
    setActiveSectionIndex((currentValue) =>
      clampSectionIndex(currentValue - 1, normalizedSections.length)
    )
  }
  const goToNextSection = () => {
    setActiveSectionIndex((currentValue) =>
      clampSectionIndex(currentValue + 1, normalizedSections.length)
    )
  }

  const shellContent = (
    <>
      {embedded && hasSectionShell ? (
        <div className="space-y-3 py-2">
          <div className="space-y-2">{activeSectionChild}</div>

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-hint-color)]">
              Langkah {effectiveActiveSectionIndex + 1} dari {normalizedSections.length}
            </p>

            <div className="flex items-center justify-between gap-3">
              <AppButton
                disabled={isFirstSection}
                onClick={goToPreviousSection}
                size="sm"
                type="button"
                variant="secondary"
              >
                Kembali
              </AppButton>

              <div className="flex items-center gap-2">
                {!isLastSection ? (
                  <AppButton
                    disabled={isLastSection}
                    onClick={goToNextSection}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    Lanjut
                  </AppButton>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={embedded ? 'space-y-4' : 'space-y-4'}>
          {activeSectionChild}
        </div>
      )}

      {!embedded ? (
        <div className="pt-2">
          <FormActionBar
            actionLabel={actionLabel}
            formId={formId}
            isSubmitting={isSubmitting}
            submitDisabled={submitDisabled}
          />
        </div>
      ) : null}

    </>
  )

  if (embedded) {
    return <div>{shellContent}</div>
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
        <PageShell className="min-h-full">
          <FormHeader onBack={onBack} title={title} />
          {shellContent}
        </PageShell>
      </AppViewportSafeArea>
    </motion.div>
  )
}

export default FormLayout
