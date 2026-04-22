import { createElement, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion as Motion } from 'framer-motion'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react'
import BrandLoader from './BrandLoader'
import { AppButton, AppCardStrong } from './AppPrimitives'
import useToastStore from '../../store/useToastStore'

function joinClasses(...values) {
  return values.flat().filter(Boolean).join(' ')
}

const toastToneConfig = {
  success: {
    defaultTitle: 'Berhasil',
    icon: CheckCircle2,
    role: 'status',
    ariaLive: 'polite',
    bubbleTone: 'success',
  },
  info: {
    defaultTitle: 'Info',
    icon: Info,
    role: 'status',
    ariaLive: 'polite',
    bubbleTone: 'info',
  },
  warning: {
    defaultTitle: 'Perhatian',
    icon: AlertTriangle,
    role: 'status',
    ariaLive: 'polite',
    bubbleTone: 'warning',
  },
  error: {
    defaultTitle: 'Terjadi masalah',
    icon: AlertCircle,
    role: 'alert',
    ariaLive: 'assertive',
    bubbleTone: 'danger',
  },
  loading: {
    defaultTitle: 'Memproses...',
    role: 'status',
    ariaLive: 'polite',
    bubbleTone: 'info',
  },
}

const bubbleToneClassNameMap = {
  success: 'app-tone-success',
  info: 'app-tone-info',
  warning: 'app-tone-warning',
  danger: 'app-tone-danger',
  neutral: 'app-tone-neutral',
}

function GlobalToast() {
  const toast = useToastStore((state) => state.toast)
  const hideToast = useToastStore((state) => state.hideToast)

  const toastConfig = useMemo(() => {
    if (!toast) {
      return toastToneConfig.info
    }

    return toastToneConfig[toast.tone] ?? toastToneConfig.info
  }, [toast])

  if (typeof document === 'undefined' || !toast) {
    return null
  }

  const title = toast.title ?? toastConfig.defaultTitle
  const isLoading = toast.tone === 'loading'
  const iconClassName =
    bubbleToneClassNameMap[toastConfig.bubbleTone ?? 'neutral'] ?? bubbleToneClassNameMap.neutral
  const dialogTitleId = `toast-${toast.id}-title`
  const dialogDescriptionId = `toast-${toast.id}-description`

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center px-4 py-[max(1rem,env(safe-area-inset-top))]">
      <Motion.div
        aria-hidden="true"
        className="app-backdrop absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      />

      <div className="relative w-full max-w-sm">
        <AnimatePresence mode="wait" initial={false}>
          <Motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-auto w-full"
          >
            <AppCardStrong
              padded={false}
              className="overflow-hidden"
              role={toastConfig.role}
              aria-live={toastConfig.ariaLive}
              aria-atomic="true"
              aria-labelledby={dialogTitleId}
              aria-describedby={toast.message ? dialogDescriptionId : undefined}
            >
              <div className="flex flex-col items-center gap-4 px-5 pt-5 pb-4 text-center">
                <div className="flex items-center justify-center">
                  {isLoading ? (
                    <BrandLoader
                      className="rounded-[22px] border border-[var(--app-outline-soft)] bg-[var(--app-surface-low-color)] shadow-[var(--app-card-shadow)]"
                      context="global"
                      size="compact"
                    />
                  ) : (
                    <div
                      className={joinClasses(
                        'flex h-12 w-12 items-center justify-center rounded-[20px] border border-[var(--app-outline-soft)] shadow-[var(--app-card-shadow)]',
                        iconClassName
                      )}
                    >
                      {createElement(toastConfig.icon, {
                        className: 'h-5 w-5',
                        strokeWidth: 2.25,
                        'aria-hidden': true,
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <p
                    id={dialogTitleId}
                    className="text-base font-semibold leading-6 text-[var(--app-text-color)]"
                  >
                    {title}
                  </p>
                  {toast.message ? (
                    <p
                      id={dialogDescriptionId}
                      className="text-sm leading-6 text-[var(--app-hint-color)]"
                    >
                      {toast.message}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-[var(--app-border-color)] px-5 py-4">
                <AppButton
                  fullWidth
                  className="rounded-[18px]"
                  onClick={() => hideToast(toast.id)}
                  size="md"
                  type="button"
                  variant="secondary"
                >
                  Tutup
                </AppButton>
              </div>
            </AppCardStrong>
          </Motion.div>
        </AnimatePresence>
      </div>
    </div>,
    document.body
  )
}

export default GlobalToast
