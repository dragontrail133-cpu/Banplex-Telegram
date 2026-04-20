import useAuthStore from '../store/useAuthStore'
import { supabase } from './supabase'

const DEFAULT_AUTH_TIMEOUT_MS = 10000

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

async function readCurrentSession() {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw error
  }

  return data?.session ?? null
}

function waitForAuthStoreReady({ timeoutMs = DEFAULT_AUTH_TIMEOUT_MS } = {}) {
  const currentState = useAuthStore.getState()

  if (!currentState.isLoading) {
    return Promise.resolve(currentState)
  }

  return new Promise((resolve, reject) => {
    let settled = false
    let unsubscribe = () => {}

    const finish = (handler, value) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeoutHandle)
      unsubscribe()
      handler(value)
    }

    unsubscribe = useAuthStore.subscribe((state) => {
      if (!state.isLoading) {
        finish(resolve, state)
      }
    })

    const timeoutHandle = setTimeout(() => {
      finish(reject, new Error('Inisialisasi auth Supabase melebihi batas waktu.'))
    }, timeoutMs)
  })
}

function waitForSupabaseSession({ timeoutMs = DEFAULT_AUTH_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    if (!supabase) {
      reject(new Error('Client Supabase belum dikonfigurasi.'))
      return
    }

    let settled = false
    let unsubscribeStore = () => {}

    const finish = (handler, value) => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timeoutHandle)
      unsubscribeStore()
      authSubscription.data.subscription.unsubscribe()
      handler(value)
    }

    const resolveFromSession = async () => {
      try {
        const session = await readCurrentSession()

        if (session?.access_token) {
          finish(resolve, session)
          return
        }

        if (!useAuthStore.getState().isLoading) {
          finish(reject, new Error('Sesi Supabase belum aktif.'))
        }
      } catch (error) {
        finish(reject, toError(error, 'Gagal membaca sesi Supabase.'))
      }
    }

    const authSubscription = supabase.auth.onAuthStateChange(() => {
      void resolveFromSession()
    })

    unsubscribeStore = useAuthStore.subscribe((state) => {
      if (!state.isLoading) {
        void resolveFromSession()
      }
    })

    const timeoutHandle = setTimeout(() => {
      finish(reject, new Error('Sesi Supabase belum aktif.'))
    }, timeoutMs)

    void resolveFromSession()
  })
}

async function getSupabaseAccessToken(options = {}) {
  const session = await waitForSupabaseSession(options)
  const accessToken = session?.access_token ?? null

  if (!accessToken) {
    throw new Error('Sesi Supabase belum aktif.')
  }

  return accessToken
}

export { getSupabaseAccessToken, waitForAuthStoreReady, waitForSupabaseSession }
