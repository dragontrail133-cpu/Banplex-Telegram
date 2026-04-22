import { create } from 'zustand'

const TOAST_DEFAULT_DURATION_MS = {
  success: 2600,
  info: 3000,
  warning: null,
  error: null,
  loading: null,
}

let toastTimeoutId = null

function clearToastTimeout() {
  if (toastTimeoutId === null) {
    return
  }

  clearTimeout(toastTimeoutId)
  toastTimeoutId = null
}

function createToastId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeToastInput(input = {}) {
  const tone = ['success', 'info', 'warning', 'error', 'loading'].includes(input.tone)
    ? input.tone
    : 'info'
  const message = input.message ?? input.description ?? null
  const durationMs =
    typeof input.durationMs === 'number'
      ? input.durationMs
      : TOAST_DEFAULT_DURATION_MS[tone]

  return {
    id: createToastId(),
    tone,
    title: input.title ?? null,
    message,
    durationMs,
    dismissible: input.dismissible ?? true,
  }
}

function scheduleToastDismiss(setToastState, toastId, durationMs) {
  clearToastTimeout()

  if (durationMs === null || durationMs <= 0) {
    return
  }

  toastTimeoutId = setTimeout(() => {
    setToastState((state) =>
      state.toast?.id === toastId
        ? { toast: null }
        : state
    )
    toastTimeoutId = null
  }, durationMs)
}

const useToastStore = create((set) => ({
  toast: null,
  showToast: (input) => {
    const toast = normalizeToastInput(input)

    set({ toast })
    scheduleToastDismiss(set, toast.id, toast.durationMs)

    return toast.id
  },
  hideToast: (toastId = null) => {
    set((state) => {
      if (toastId && state.toast?.id !== toastId) {
        return state
      }

      clearToastTimeout()

      return { toast: null }
    })
  },
}))

export default useToastStore
export { useToastStore }
