import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { isDevAuthBypassEnabled } from '../lib/dev-auth-bypass'
import { allRoles, normalizeRole } from '../lib/rbac'

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

function getMembershipPriority(membership) {
  if (membership?.is_default) {
    return 0
  }

  const role = normalizeRole(membership?.role)
  const rolePriority = allRoles.indexOf(role)

  return rolePriority >= 0 ? rolePriority + 1 : allRoles.length + 1
}

function getMembershipStatusLabel(status) {
  const normalizedStatus = normalizeText(status, 'active')

  if (normalizedStatus === 'active') {
    return 'Aktif'
  }

  if (normalizedStatus === 'suspended') {
    return 'Ditangguhkan'
  }

  return normalizedStatus
}

function sortMemberships(memberships = []) {
  return [...memberships].sort((left, right) => {
    return getMembershipPriority(left) - getMembershipPriority(right)
  })
}

function mapMembership(member) {
  const team = Array.isArray(member?.teams)
    ? member.teams[0] ?? null
    : member?.teams ?? null

  return {
    id: member?.id ?? null,
    team_id: member?.team_id ?? null,
    telegram_user_id: normalizeText(member?.telegram_user_id, null),
    role: normalizeRole(member?.role),
    is_default: Boolean(member?.is_default),
    status: normalizeText(member?.status, 'active'),
    status_label: getMembershipStatusLabel(member?.status),
    approved_at: normalizeText(member?.approved_at, null),
    team_name: normalizeText(team?.name, null),
    team_slug: normalizeText(team?.slug, null),
    team_is_active: team?.is_active !== false,
  }
}

function normalizeServerMemberships(memberships = []) {
  return sortMemberships(
    (memberships ?? [])
      .map(mapMembership)
      .filter((membership) => membership.team_is_active !== false)
  )
}

async function fetchTeamMemberships() {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const { data, error } = await supabase
    .from('team_members')
    .select(
      'id, team_id, telegram_user_id, role, is_default, status, approved_at, teams:team_id ( id, name, slug, is_active )'
    )
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .order('approved_at', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return normalizeServerMemberships(data ?? [])
}

function normalizeStartParam(value) {
  const normalizedValue = normalizeText(value, null)

  if (!normalizedValue?.startsWith('inv_')) {
    return null
  }

  return normalizedValue
}

async function redeemInviteToken(startParam, telegramUserId) {
  const token = normalizeStartParam(startParam)

  if (!token) {
    return null
  }

  const numericTelegramUserId = Number(telegramUserId)

  if (!Number.isSafeInteger(numericTelegramUserId)) {
    throw new Error('Telegram ID tidak valid untuk redeem token undangan.')
  }

  const { data, error } = await supabase.rpc('fn_redeem_invite_token', {
    p_token: token,
    p_telegram_user_id: numericTelegramUserId,
  })

  if (error) {
    throw error
  }

  return data ?? null
}

const defaultState = {
  user: null,
  memberships: [],
  currentTeamId: null,
  role: null,
  isRegistered: false,
  isLoading: true,
  error: null,
}

let activeTelegramAuthPromise = null
let activeTelegramAuthKey = null

const useAuthStore = create((set, get) => ({
  ...defaultState,
  clearError: () => set({ error: null }),
  initializeTelegramAuth: async (authPayload) => {
    const normalizedInitData =
      typeof authPayload === 'string'
        ? normalizeText(authPayload)
        : normalizeText(authPayload?.initData)
    const startParam =
      typeof authPayload === 'string'
        ? null
        : normalizeStartParam(authPayload?.startParam)
    const shouldUseDevBypass =
      !normalizedInitData && isDevAuthBypassEnabled()
    const authKey = `${normalizedInitData ?? ''}::${startParam ?? ''}::${
      shouldUseDevBypass ? 'dev-bypass' : 'telegram'
    }`

    if (activeTelegramAuthPromise && activeTelegramAuthKey === authKey) {
      return activeTelegramAuthPromise
    }

    set({
      isLoading: true,
      error: null,
    })

    activeTelegramAuthKey = authKey
    activeTelegramAuthPromise = (async () => {
      try {
        if (!supabase) {
          throw new Error('Client Supabase belum dikonfigurasi.')
        }

        if (!normalizedInitData && !shouldUseDevBypass) {
          throw new Error('Aplikasi ini hanya bisa diakses dari Telegram Mini App.')
        }

        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            initData: normalizedInitData,
            devBypass: shouldUseDevBypass,
          }),
        })

        const result = await response.json().catch(() => ({}))

        if (!response.ok || !result?.success) {
          throw new Error(
            normalizeText(result?.error, 'Gagal memverifikasi sesi Telegram.')
          )
        }

        const accessToken = normalizeText(result?.session?.access_token)
        const refreshToken = normalizeText(result?.session?.refresh_token)

        if (!accessToken || !refreshToken) {
          throw new Error('Session Supabase dari Telegram auth tidak lengkap.')
        }

        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (setSessionError) {
          throw setSessionError
        }

        const telegramUserId = normalizeText(
          result?.profile?.telegram_user_id ?? result?.telegramUser?.id,
          null
        )

        const ownerBypassMemberships = result?.isOwnerBypass
          ? normalizeServerMemberships(result?.memberships)
          : []
        let memberships =
          ownerBypassMemberships.length > 0
            ? ownerBypassMemberships
            : await fetchTeamMemberships()
        let currentMembership = memberships[0] ?? null
        let role =
          result?.isOwnerBypass
            ? 'Owner'
            : normalizeRole(currentMembership?.role) ??
              normalizeRole(result?.role) ??
              normalizeRole(result?.profile?.role)

        if (startParam && !result?.isOwnerBypass && role !== 'Owner') {
          try {
            await redeemInviteToken(startParam, telegramUserId)
            memberships = await fetchTeamMemberships()
            currentMembership = memberships[0] ?? null
            role = normalizeRole(currentMembership?.role)
          } catch (redeemError) {
            if (memberships.length === 0) {
              throw redeemError
            }

            console.warn('Redeem invite token dilewati:', redeemError)
          }
        }

        const fullName = [
          result?.telegramUser?.first_name,
          result?.telegramUser?.last_name,
        ]
          .filter(Boolean)
          .join(' ')
          .trim()
        const name =
          normalizeText(fullName, null) ??
          normalizeText(result?.telegramUser?.username, null) ??
          telegramUserId

        set({
          user: {
            id: result?.profile?.id ?? null,
            telegram_user_id: telegramUserId,
            name,
          },
          memberships,
          currentTeamId: normalizeText(currentMembership?.team_id, null),
          role,
          isRegistered: memberships.length > 0,
          isLoading: false,
          error:
            memberships.length > 0
              ? null
              : 'Akun Telegram Anda belum memiliki akses ke workspace mana pun.',
        })

        return {
          memberships,
          role,
        }
      } catch (error) {
        const normalizedError = toError(
          error,
          'Gagal memverifikasi Telegram auth.'
        )

        await supabase?.auth.signOut().catch(() => {})

        set({
          ...defaultState,
          isLoading: false,
          error: normalizedError.message,
        })

        throw normalizedError
      } finally {
        activeTelegramAuthPromise = null
        activeTelegramAuthKey = null
      }
    })()

    return activeTelegramAuthPromise
  },
  refreshMemberships: async () => {
    try {
      const memberships = await fetchTeamMemberships()
      const currentState = get()
      const nextCurrentTeamId =
        normalizeText(currentState.currentTeamId, null) ??
        normalizeText(memberships[0]?.team_id, null)
      const currentMembership =
        memberships.find((member) => member.team_id === nextCurrentTeamId) ??
        memberships[0] ??
        null

      set({
        memberships,
        currentTeamId: normalizeText(currentMembership?.team_id, null),
        role: normalizeRole(currentMembership?.role),
        isRegistered: memberships.length > 0,
        error:
          memberships.length > 0
            ? null
            : 'Akun Telegram Anda belum memiliki akses ke workspace mana pun.',
      })

      return memberships
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat role workspace.')

      set({
        memberships: [],
        currentTeamId: null,
        role: null,
        isRegistered: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  selectTeam: (teamId) => {
    const memberships = get().memberships
    const selectedMembership =
      memberships.find((member) => member.team_id === teamId) ?? null

    if (!selectedMembership) {
      return false
    }

    set({
      currentTeamId: selectedMembership.team_id,
      role: normalizeRole(selectedMembership.role),
      error: null,
    })

    return true
  },
  logout: async () => {
    await supabase?.auth.signOut().catch(() => {})

    set({
      ...defaultState,
      isLoading: false,
    })
  },
}))

export default useAuthStore
export { useAuthStore }
