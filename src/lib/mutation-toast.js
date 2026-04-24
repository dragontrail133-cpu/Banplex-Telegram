import useToastStore from '../store/useToastStore'

function getToastStore() {
  return useToastStore.getState()
}

export function showLoadingToast(input = {}) {
  return getToastStore().showToast({
    tone: 'loading',
    dismissible: false,
    durationMs: null,
    ...input,
  })
}

export function showSuccessToast(input = {}) {
  return getToastStore().showToast({
    tone: 'success',
    ...input,
  })
}

export function showErrorToast(input = {}) {
  return getToastStore().showToast({
    tone: 'error',
    durationMs: null,
    ...input,
  })
}

export function clearToast(toastId = null) {
  getToastStore().hideToast(toastId)
}
