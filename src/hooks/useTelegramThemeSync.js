import { useEffect } from 'react'

function normalizeColorScheme(value) {
  return value === 'dark' ? 'dark' : 'light'
}

function setRootVar(name, value) {
  if (!value) {
    return
  }

  const normalizedValue = String(value).trim()

  if (!normalizedValue) {
    return
  }

  document.documentElement.style.setProperty(name, normalizedValue)
}

function applyTelegramTheme(tg) {
  const resolvedScheme = normalizeColorScheme(tg?.colorScheme)
  document.documentElement.dataset.colorScheme = resolvedScheme

  const themeParams = tg?.themeParams ?? {}

  setRootVar('--tg-theme-bg-color', themeParams.bg_color)
  setRootVar('--tg-theme-secondary-bg-color', themeParams.secondary_bg_color)
  setRootVar('--tg-theme-section-bg-color', themeParams.section_bg_color)
  setRootVar('--tg-theme-text-color', themeParams.text_color)
  setRootVar('--tg-theme-hint-color', themeParams.hint_color)
  setRootVar('--tg-theme-link-color', themeParams.link_color)
  setRootVar('--tg-theme-button-color', themeParams.button_color)
  setRootVar('--tg-theme-button-text-color', themeParams.button_text_color)
  setRootVar('--tg-theme-accent-text-color', themeParams.accent_text_color)
  setRootVar('--tg-theme-destructive-text-color', themeParams.destructive_text_color)
}

function applySystemTheme() {
  const isDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)')?.matches

  document.documentElement.dataset.colorScheme = isDark ? 'dark' : 'light'
}

function useTelegramThemeSync(tg) {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    if (!tg) {
      applySystemTheme()

      const mediaQuery =
        typeof window !== 'undefined'
          ? window.matchMedia?.('(prefers-color-scheme: dark)') ?? null
          : null

      const handleMediaChange = () => applySystemTheme()
      mediaQuery?.addEventListener?.('change', handleMediaChange)

      return () => {
        mediaQuery?.removeEventListener?.('change', handleMediaChange)
      }
    }

    const apply = () => applyTelegramTheme(tg)

    apply()
    tg.onEvent?.('themeChanged', apply)

    return () => {
      tg.offEvent?.('themeChanged', apply)
    }
  }, [tg])
}

export default useTelegramThemeSync
export { useTelegramThemeSync }

