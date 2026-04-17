function useTelegram() {
  const tg =
    typeof window !== 'undefined' ? window.Telegram?.WebApp ?? null : null

  return {
    tg,
    user: tg?.initDataUnsafe?.user ?? null,
    startParam: tg?.initDataUnsafe?.start_param ?? null,
    ready: () => tg?.ready?.(),
    expand: () => tg?.expand?.(),
    MainButton: tg?.MainButton ?? null,
    haptic: tg?.HapticFeedback ?? null,
  }
}

export default useTelegram
export { useTelegram }
