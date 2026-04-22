import { useEffect, useState } from 'react'

function isEditableElement(target) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  const tagName = target.tagName.toLowerCase()

  return tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

function useMobileKeyboardVisible() {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return undefined
    }

    const mobileQuery = window.matchMedia('(max-width: 640px)')

    const updateKeyboardVisibility = () => {
      if (!mobileQuery.matches) {
        setIsKeyboardVisible(false)
        return
      }

      setIsKeyboardVisible(isEditableElement(document.activeElement))
    }

    const handleFocusIn = (event) => {
      if (mobileQuery.matches && isEditableElement(event.target)) {
        setIsKeyboardVisible(true)
      }
    }

    const handleFocusOut = () => {
      window.requestAnimationFrame(updateKeyboardVisibility)
    }

    const handleViewportChange = () => {
      window.requestAnimationFrame(updateKeyboardVisibility)
    }

    updateKeyboardVisibility()

    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    window.addEventListener('resize', handleViewportChange)
    mobileQuery.addEventListener('change', handleViewportChange)
    window.visualViewport?.addEventListener('resize', handleViewportChange)
    window.visualViewport?.addEventListener('scroll', handleViewportChange)

    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      window.removeEventListener('resize', handleViewportChange)
      mobileQuery.removeEventListener('change', handleViewportChange)
      window.visualViewport?.removeEventListener('resize', handleViewportChange)
      window.visualViewport?.removeEventListener('scroll', handleViewportChange)
    }
  }, [])

  return isKeyboardVisible
}

export default useMobileKeyboardVisible
