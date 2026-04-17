// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion'
import FormHeader from './FormHeader'
import { AppButton } from '../ui/AppPrimitives'

function FormLayout({
  title,
  onBack,
  actionLabel = 'Selanjutnya',
  formId = null,
  isSubmitting = false,
  submitDisabled = false,
  children,
}) {
  return (
    <motion.div
      initial={{ y: '100%', opacity: 0.8 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: '100%', opacity: 0.8 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="fixed inset-0 z-[100] flex flex-col bg-[var(--app-surface-strong-color)] sm:justify-end"
    >
      <div className="flex h-full w-full flex-col sm:mx-auto sm:h-[95vh] sm:max-w-md sm:rounded-t-[32px] sm:border sm:border-[var(--app-outline-soft)] sm:shadow-telegram">
        <FormHeader onBack={onBack} title={title} />

        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {formId ? (
          <footer className="shrink-0 bg-[color-mix(in_srgb,var(--app-surface-strong-color)_88%,transparent)] p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-1px_0_var(--app-outline-soft)] backdrop-blur-xl">
            <AppButton
              fullWidth
              size="lg"
              disabled={submitDisabled || isSubmitting}
              form={formId}
              type="submit"
              variant="primary"
            >
              {isSubmitting ? 'Menyimpan...' : actionLabel}
            </AppButton>
          </footer>
        ) : null}
      </div>
    </motion.div>
  )
}

export default FormLayout
