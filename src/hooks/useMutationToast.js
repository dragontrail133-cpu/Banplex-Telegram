import { useCallback, useRef } from 'react'
import {
  clearToast,
  showErrorToast,
  showLoadingToast,
  showSuccessToast,
} from '../lib/mutation-toast'

function useMutationToast() {
  const toastIdRef = useRef(null)

  const clear = useCallback(() => {
    if (!toastIdRef.current) {
      return
    }

    clearToast(toastIdRef.current)
    toastIdRef.current = null
  }, [])

  const begin = useCallback((input = {}) => {
    clear()
    toastIdRef.current = showLoadingToast(input)
    return toastIdRef.current
  }, [clear])

  const succeed = useCallback((input = {}) => {
    clear()
    return showSuccessToast(input)
  }, [clear])

  const fail = useCallback((input = {}) => {
    clear()
    return showErrorToast(input)
  }, [clear])

  return {
    begin,
    clear,
    fail,
    succeed,
  }
}

export default useMutationToast
