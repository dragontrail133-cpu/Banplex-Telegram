import crypto from 'node:crypto'
import { Buffer } from 'node:buffer'
import { createClient } from '@supabase/supabase-js'
import { allRoles, normalizeRole } from '../src/lib/rbac.js'

const MAX_INIT_DATA_AGE_SECONDS = 60 * 60 * 24
const validRoles = new Set(allRoles)
let profilesRoleColumnState = 'unknown'

function getEnv(name, fallback = '') {
  return String(globalThis.process?.env?.[name] ?? fallback).trim()
}

function createHttpError(status, message) {
  const error = new Error(message)

  error.statusCode = status

  return error
}

async function parseRequestBody(req) {
  if (typeof req.body === 'string' && req.body.trim().length > 0) {
    return JSON.parse(req.body)
  }

  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  const chunks = []

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString())
  }

  const rawBody = chunks.join('').trim()

  return rawBody ? JSON.parse(rawBody) : {}
}

function buildTelegramSecretKey(botToken) {
  return crypto.createHmac('sha256', 'WebAppData').update(botToken).digest()
}

function normalizeTelegramIdentifier(value) {
  return String(value ?? '').trim()
}

function normalizeTelegramIdentifierList(value) {
  return String(value ?? '')
    .split(/[,\n;]/)
    .map((identifier) => normalizeTelegramIdentifier(identifier))
    .filter(Boolean)
}

function getOwnerTelegramIdentifiers() {
  return [
    ...normalizeTelegramIdentifierList(getEnv('OWNER_TELEGRAM_ID')),
    ...normalizeTelegramIdentifierList(getEnv('OWNER_TELEGRAM_IDS')),
    ...normalizeTelegramIdentifierList(getEnv('TELEGRAM_OWNER_ID')),
    ...normalizeTelegramIdentifierList(getEnv('VITE_OWNER_TELEGRAM_ID')),
  ]
}

function normalizeOptionalText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function normalizeInviteStartParam(value) {
  const normalizedValue = normalizeOptionalText(value, null)

  if (!normalizedValue?.startsWith('inv_')) {
    return null
  }

  return normalizedValue
}

function isTruthyBoolean(value) {
  return ['1', 'true', 'yes', 'on'].includes(
    String(value ?? '').trim().toLowerCase()
  )
}

function isLocalDevelopmentRequest(req) {
  const hostHeader = normalizeOptionalText(
    req?.headers?.['x-forwarded-host'] ?? req?.headers?.host,
    ''
  )
  const normalizedHost = hostHeader
    .split(',')[0]
    .trim()
    .split(':')[0]
    .toLowerCase()
  const normalizedEnv = normalizeOptionalText(
    getEnv('VERCEL_ENV', getEnv('NODE_ENV')),
    'development'
  ).toLowerCase()

  return (
    normalizedEnv !== 'production' &&
    ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(normalizedHost)
  )
}

function buildDevBypassTelegramUser(ownerTelegramIds = []) {
  const fallbackTelegramUserId = normalizeTelegramIdentifier(
    getEnv('DEV_BYPASS_TELEGRAM_ID')
  )
  const telegramUserId = ownerTelegramIds[0] ?? fallbackTelegramUserId

  if (!telegramUserId) {
    throw createHttpError(
      500,
      'Dev auth bypass membutuhkan OWNER_TELEGRAM_ID atau DEV_BYPASS_TELEGRAM_ID.'
    )
  }

  return {
    id: telegramUserId,
    first_name: normalizeOptionalText(
      getEnv('DEV_BYPASS_TELEGRAM_FIRST_NAME'),
      'Local'
    ),
    last_name: normalizeOptionalText(
      getEnv('DEV_BYPASS_TELEGRAM_LAST_NAME'),
      'Smoke'
    ),
    username: normalizeOptionalText(
      getEnv('DEV_BYPASS_TELEGRAM_USERNAME'),
      `dev-${telegramUserId}`
    ),
  }
}

function verifyInitData(initData, botToken) {
  const normalizedInitData = String(initData ?? '').trim()

  if (!normalizedInitData) {
    throw createHttpError(400, 'initData Telegram wajib dikirim.')
  }

  const params = new URLSearchParams(normalizedInitData)
  const receivedHash = params.get('hash')

  if (!receivedHash) {
    throw createHttpError(401, 'Hash Telegram tidak ditemukan.')
  }

  params.delete('hash')

  const dataCheckString = [...params.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const calculatedHash = crypto
    .createHmac('sha256', buildTelegramSecretKey(botToken))
    .update(dataCheckString)
    .digest('hex')

  const calculatedHashBuffer = Buffer.from(calculatedHash, 'hex')
  const receivedHashBuffer = Buffer.from(receivedHash, 'hex')

  if (
    calculatedHashBuffer.length !== receivedHashBuffer.length ||
    !crypto.timingSafeEqual(calculatedHashBuffer, receivedHashBuffer)
  ) {
    throw createHttpError(401, 'initData Telegram tidak valid.')
  }

  const authDate = Number(params.get('auth_date'))

  if (!Number.isFinite(authDate)) {
    throw createHttpError(401, 'auth_date Telegram tidak valid.')
  }

  const ageInSeconds = Math.floor(Date.now() / 1000) - authDate

  if (ageInSeconds > MAX_INIT_DATA_AGE_SECONDS) {
    throw createHttpError(401, 'initData Telegram sudah kedaluwarsa.')
  }

  const rawUser = params.get('user')

  if (!rawUser) {
    throw createHttpError(401, 'Data user Telegram tidak ditemukan.')
  }

  let telegramUser

  try {
    telegramUser = JSON.parse(rawUser)
  } catch {
    throw createHttpError(401, 'Payload user Telegram tidak valid.')
  }

  const telegramUserId = normalizeTelegramIdentifier(telegramUser?.id)

  if (!telegramUserId) {
    throw createHttpError(401, 'telegram_user_id tidak ditemukan.')
  }

  return {
    telegramUserId,
    telegramUser,
  }
}

function getTelegramLoginEmail(telegramUserId) {
  return `telegram-${telegramUserId}@banplex.local`
}

function isMissingProfilesRoleColumnError(error) {
  const normalizedMessage = String(error?.message ?? '').toLowerCase()

  return (
    normalizedMessage.includes('column "role" does not exist') ||
    normalizedMessage.includes('column profiles.role does not exist')
  )
}

function getProfilesSelectColumns() {
  return profilesRoleColumnState === 'missing'
    ? 'id, telegram_user_id, created_at'
    : 'id, telegram_user_id, role, created_at'
}

function buildTelegramPassword(telegramUserId, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`banplex-telegram-auth:${telegramUserId}`)
    .digest('hex')
}

function createAdminClient(url, serviceRoleKey) {
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function createPublicClient(url, publishableKey) {
  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

async function signInOrCreateTelegramUser({
  adminClient,
  publicClient,
  email,
  password,
  telegramUser,
}) {
  const firstSignIn = await publicClient.auth.signInWithPassword({
    email,
    password,
  })

  if (firstSignIn.data?.session && firstSignIn.data?.user) {
    return firstSignIn
  }

  const createResult = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: telegramUser?.first_name ?? null,
      last_name: telegramUser?.last_name ?? null,
      username: telegramUser?.username ?? null,
      telegram_user_id: String(telegramUser?.id ?? ''),
    },
    app_metadata: {
      provider: 'telegram',
      providers: ['telegram'],
    },
  })

  if (
    createResult.error &&
    !String(createResult.error.message ?? '')
      .toLowerCase()
      .includes('already')
  ) {
    throw createResult.error
  }

  const secondSignIn = await publicClient.auth.signInWithPassword({
    email,
    password,
  })

  if (!secondSignIn.data?.session || !secondSignIn.data?.user) {
    throw secondSignIn.error ?? createHttpError(500, 'Gagal membuat session Supabase.')
  }

  return secondSignIn
}

async function ensureProfile(adminClient, authUserId, telegramUserId) {
  let existingProfilesResult = await adminClient
    .from('profiles')
    .select(getProfilesSelectColumns())
    .eq('telegram_user_id', telegramUserId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (existingProfilesResult.error && isMissingProfilesRoleColumnError(existingProfilesResult.error)) {
    profilesRoleColumnState = 'missing'
    existingProfilesResult = await adminClient
      .from('profiles')
      .select(getProfilesSelectColumns())
      .eq('telegram_user_id', telegramUserId)
      .order('created_at', { ascending: true })
      .limit(1)
  }

  if (existingProfilesResult.error) {
    throw existingProfilesResult.error
  }

  if (profilesRoleColumnState === 'unknown') {
    profilesRoleColumnState = 'present'
  }

  const existingProfile = existingProfilesResult.data?.[0] ?? null
  const profileRole = validRoles.has(String(existingProfile?.role ?? '').trim())
    ? String(existingProfile.role).trim()
    : 'Viewer'

  if (!existingProfile) {
    let insertResult = await adminClient
      .from('profiles')
      .insert(
        profilesRoleColumnState === 'missing'
          ? {
              id: authUserId,
              telegram_user_id: telegramUserId,
            }
          : {
              id: authUserId,
              telegram_user_id: telegramUserId,
              role: 'Viewer',
            }
      )
      .select(getProfilesSelectColumns())
      .single()

    if (insertResult.error && isMissingProfilesRoleColumnError(insertResult.error)) {
      profilesRoleColumnState = 'missing'
      insertResult = await adminClient
        .from('profiles')
        .insert({
          id: authUserId,
          telegram_user_id: telegramUserId,
        })
        .select(getProfilesSelectColumns())
        .single()
    }

    if (insertResult.error) {
      throw insertResult.error
    }

    if (profilesRoleColumnState === 'unknown') {
      profilesRoleColumnState = 'present'
    }

    return {
      profile: {
        ...insertResult.data,
        role: profilesRoleColumnState === 'missing' ? null : 'Viewer',
      },
      hadExistingProfile: false,
    }
  }

  if (existingProfile.id !== authUserId) {
    let updateResult = await adminClient
      .from('profiles')
      .update(
        profilesRoleColumnState === 'missing'
          ? {
              id: authUserId,
              telegram_user_id: telegramUserId,
            }
          : {
              id: authUserId,
              telegram_user_id: telegramUserId,
              role: profileRole,
            }
      )
      .eq('id', existingProfile.id)
      .select(getProfilesSelectColumns())
      .single()

    if (updateResult.error && isMissingProfilesRoleColumnError(updateResult.error)) {
      profilesRoleColumnState = 'missing'
      updateResult = await adminClient
        .from('profiles')
        .update({
          id: authUserId,
          telegram_user_id: telegramUserId,
        })
        .eq('id', existingProfile.id)
        .select(getProfilesSelectColumns())
        .single()
    }

    if (updateResult.error) {
      throw updateResult.error
    }

    return {
      profile: {
        ...updateResult.data,
        role: profilesRoleColumnState === 'missing' ? null : profileRole,
      },
      hadExistingProfile: true,
    }
  }

  return {
    profile: {
      ...existingProfile,
      role: profileRole,
    },
    hadExistingProfile: true,
  }
}

async function ensureProfileRole(
  adminClient,
  authUserId,
  telegramUserId,
  enforcedRole = null
) {
  const { profile } = await ensureProfile(adminClient, authUserId, telegramUserId)
  const normalizedEnforcedRole = validRoles.has(String(enforcedRole ?? '').trim())
    ? String(enforcedRole).trim()
    : null

  if (!normalizedEnforcedRole || profile?.role === normalizedEnforcedRole) {
    return {
      ...profile,
      role: profile?.role ?? normalizedEnforcedRole ?? null,
    }
  }

  if (profilesRoleColumnState === 'missing') {
    return {
      ...profile,
      role: normalizedEnforcedRole,
    }
  }

  const updateResult = await adminClient
    .from('profiles')
    .update({
      role: normalizedEnforcedRole,
    })
    .eq('id', authUserId)
    .select('id, telegram_user_id, role, created_at')
    .single()

  if (updateResult.error) {
    if (isMissingProfilesRoleColumnError(updateResult.error)) {
      profilesRoleColumnState = 'missing'

      return {
        ...profile,
        role: normalizedEnforcedRole,
      }
    }

    throw updateResult.error
  }

  return updateResult.data
}

async function fetchMemberships(adminClient, telegramUserId, { includeInactive = false } = {}) {
  let query = adminClient
    .from('team_members')
    .select(
      'id, team_id, telegram_user_id, role, is_default, status, approved_at, teams:team_id ( id, name, slug, is_active )'
    )
    .eq('telegram_user_id', telegramUserId)

  if (!includeInactive) {
    query = query.eq('status', 'active')
  }

  const { data: memberships, error: membershipsError } = await query
    .order('is_default', { ascending: false })
    .order('approved_at', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(5)

  if (membershipsError) {
    throw membershipsError
  }

  return memberships ?? []
}

async function redeemInviteTokenForAuth(adminClient, telegramUserId, startParam) {
  const token = normalizeInviteStartParam(startParam)

  if (!token) {
    return null
  }

  const normalizedTelegramUserId = normalizeTelegramIdentifier(telegramUserId)

  if (!normalizedTelegramUserId) {
    throw createHttpError(400, 'telegram_user_id tidak valid untuk redeem token undangan.')
  }

  const inviteResult = await adminClient
    .from('invite_tokens')
    .select('id, team_id, token, role, expires_at, is_used, created_at')
    .eq('token', token)
    .maybeSingle()

  if (inviteResult.error) {
    throw inviteResult.error
  }

  const invite = inviteResult.data ?? null

  if (!invite) {
    throw createHttpError(404, 'Token undangan tidak ditemukan.')
  }

  if (invite.is_used) {
    throw createHttpError(409, 'Token undangan sudah pernah digunakan.')
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    throw createHttpError(410, 'Token undangan sudah kedaluwarsa.')
  }

  const approvalTimestamp = new Date().toISOString()

  const upsertResult = await adminClient
    .from('team_members')
    .upsert(
      {
        team_id: invite.team_id,
        telegram_user_id: normalizedTelegramUserId,
        role: invite.role,
        is_default: false,
        status: 'active',
        approved_at: approvalTimestamp,
      },
      {
        onConflict: 'team_id,telegram_user_id',
      }
    )
    .select(
      'id, team_id, telegram_user_id, role, is_default, status, approved_at, teams:team_id ( id, name, slug, is_active )'
    )
    .single()

  if (upsertResult.error) {
    throw upsertResult.error
  }

  const markInviteResult = await adminClient
    .from('invite_tokens')
    .update({
      is_used: true,
    })
    .eq('id', invite.id)

  if (markInviteResult.error) {
    throw markInviteResult.error
  }

  return upsertResult.data ?? null
}

async function resolveOwnerTeamId(adminClient) {
  const activeDefaultTeamResult = await adminClient
    .from('teams')
    .select('id')
    .eq('slug', 'default-workspace')
    .eq('is_active', true)
    .maybeSingle()

  if (activeDefaultTeamResult.error) {
    throw activeDefaultTeamResult.error
  }

  if (activeDefaultTeamResult.data?.id) {
    return activeDefaultTeamResult.data.id
  }

  const fallbackTeamResult = await adminClient
    .from('teams')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (fallbackTeamResult.error) {
    throw fallbackTeamResult.error
  }

  if (fallbackTeamResult.data?.id) {
    return fallbackTeamResult.data.id
  }

  const inactiveDefaultTeamResult = await adminClient
    .from('teams')
    .select('id, is_active')
    .eq('slug', 'default-workspace')
    .maybeSingle()

  if (inactiveDefaultTeamResult.error) {
    throw inactiveDefaultTeamResult.error
  }

  if (inactiveDefaultTeamResult.data?.id) {
    const reactivateResult = await adminClient
      .from('teams')
      .update({
        is_active: true,
      })
      .eq('id', inactiveDefaultTeamResult.data.id)
      .select('id')
      .single()

    if (reactivateResult.error) {
      throw reactivateResult.error
    }

    return reactivateResult.data?.id ?? inactiveDefaultTeamResult.data.id
  }

  const defaultTeamResult = await adminClient
    .from('teams')
    .insert({
      name: 'Default Workspace',
      slug: 'default-workspace',
      is_active: true,
    })
    .select('id')
    .single()

  if (defaultTeamResult.error) {
    throw defaultTeamResult.error
  }

  return defaultTeamResult.data?.id ?? null
}

async function ensureOwnerMembership(adminClient, telegramUserId) {
  const normalizedTelegramUserId = normalizeTelegramIdentifier(telegramUserId)
  const approvalTimestamp = new Date().toISOString()
  const ownerTeamId = await resolveOwnerTeamId(adminClient)

  if (!ownerTeamId) {
    throw createHttpError(500, 'Workspace aktif untuk Owner tidak ditemukan.')
  }

  const upsertResult = await adminClient
    .from('team_members')
    .upsert(
      {
        team_id: ownerTeamId,
        telegram_user_id: normalizedTelegramUserId,
        role: 'Owner',
        is_default: true,
        status: 'active',
        approved_at: approvalTimestamp,
      },
      {
        onConflict: 'team_id,telegram_user_id',
      }
    )
    .select(
      'id, team_id, telegram_user_id, role, is_default, status, approved_at, teams:team_id ( id, name, slug, is_active )'
    )
    .single()

  if (upsertResult.error) {
    throw upsertResult.error
  }

  const memberships = await fetchMemberships(
    adminClient,
    normalizedTelegramUserId,
    {
      includeInactive: true,
    }
  )

  return [
    upsertResult.data,
    ...memberships.filter((membership) => membership.team_id !== ownerTeamId),
  ]
}

export { normalizeInviteStartParam, redeemInviteTokenForAuth }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed.',
    })
  }

  const supabaseUrl = getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL'))
  const serviceRoleKey = getEnv(
    'SUPABASE_SERVICE_ROLE_KEY',
    getEnv('VITE_SUPABASE_ANON_KEY')
  )
  const publishableKey = getEnv(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    getEnv('VITE_SUPABASE_ANON_KEY')
  )
  const telegramBotToken = getEnv('TELEGRAM_BOT_TOKEN')
  const appAuthSecret = getEnv('APP_AUTH_SECRET', telegramBotToken)

  if (!supabaseUrl || !serviceRoleKey || !publishableKey || !telegramBotToken) {
    return res.status(500).json({
      success: false,
      error: 'Environment auth belum lengkap.',
    })
  }

  let authStage = 'parse_request'

  try {
    const body = await parseRequestBody(req)
    const ownerTelegramIds = getOwnerTelegramIdentifiers()
    const startParam = normalizeInviteStartParam(body?.startParam)
    const useDevBypass = isTruthyBoolean(body?.devBypass)
    let telegramUserId
    let telegramUser
    let normalizedTelegramUserId
    let isOwnerBypass = false

    if (useDevBypass) {
      authStage = 'verify_dev_bypass'

      if (!isLocalDevelopmentRequest(req)) {
        throw createHttpError(
          403,
          'Dev auth bypass hanya diizinkan untuk localhost saat development.'
        )
      }

      telegramUser = buildDevBypassTelegramUser(ownerTelegramIds)
      telegramUserId = normalizeTelegramIdentifier(telegramUser.id)
      normalizedTelegramUserId = telegramUserId
      isOwnerBypass = true
    } else {
      const { initData } = body

      authStage = 'verify_telegram_init_data'
      const verifiedPayload = verifyInitData(initData, telegramBotToken)

      telegramUserId = verifiedPayload.telegramUserId
      telegramUser = verifiedPayload.telegramUser
      normalizedTelegramUserId = normalizeTelegramIdentifier(telegramUserId)
      isOwnerBypass = ownerTelegramIds.some(
        (candidateTelegramId) => candidateTelegramId === normalizedTelegramUserId
      )
    }

    const email = getTelegramLoginEmail(telegramUserId)
    const password = buildTelegramPassword(telegramUserId, appAuthSecret)
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)
    const publicClient = createPublicClient(supabaseUrl, publishableKey)
    authStage = 'sign_in_or_create_supabase_user'
    const signInResult = await signInOrCreateTelegramUser({
      adminClient,
      publicClient,
      email,
      password,
      telegramUser,
    })
    const authUser = signInResult.data.user
    const session = signInResult.data.session

    if (!authUser?.id || !session?.access_token || !session?.refresh_token) {
      throw createHttpError(500, 'Session Supabase tidak lengkap.')
    }

    authStage = 'ensure_profile'
    const profile = await ensureProfileRole(
      adminClient,
      authUser.id,
      normalizedTelegramUserId,
      isOwnerBypass ? 'Owner' : null
    )
    authStage = isOwnerBypass ? 'ensure_owner_membership' : 'fetch_memberships'
    let memberships = isOwnerBypass
      ? await ensureOwnerMembership(adminClient, normalizedTelegramUserId)
      : await fetchMemberships(adminClient, normalizedTelegramUserId)
    let currentMembership = memberships[0] ?? null
    let effectiveRole = isOwnerBypass
      ? 'Owner'
      : String(currentMembership?.role ?? profile?.role ?? 'Viewer').trim()
    const responseProfile = isOwnerBypass
      ? {
          ...profile,
          role: 'Owner',
        }
      : profile

    if (startParam && !isOwnerBypass && effectiveRole !== 'Owner') {
      try {
        await redeemInviteTokenForAuth(
          adminClient,
          normalizedTelegramUserId,
          startParam
        )
        memberships = await fetchMemberships(adminClient, normalizedTelegramUserId)
        currentMembership = memberships[0] ?? null
        effectiveRole = normalizeRole(currentMembership?.role) ?? effectiveRole
        authStage = 'fetch_memberships'
      } catch (redeemError) {
        if (memberships.length === 0) {
          throw redeemError
        }

        console.warn('Redeem invite token dilewati:', redeemError)
      }
    }

    return res.status(200).json({
      success: true,
      profile: responseProfile,
      memberships,
      role: effectiveRole,
      isOwnerBypass,
      telegramUser: {
        id: normalizedTelegramUserId,
        first_name: telegramUser?.first_name ?? null,
        last_name: telegramUser?.last_name ?? null,
        username: telegramUser?.username ?? null,
      },
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at ?? null,
        expires_in: session.expires_in ?? null,
        token_type: session.token_type ?? 'bearer',
      },
    })
  } catch (error) {
    const statusCode =
      typeof error?.statusCode === 'number' ? error.statusCode : 500

    console.error('[api/auth] bootstrap failed', {
      stage:
        typeof authStage === 'string' && authStage.length > 0
          ? authStage
          : 'unknown',
      message: error instanceof Error ? error.message : String(error),
      statusCode,
      profilesRoleColumnState,
    })

    return res.status(statusCode).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan saat memverifikasi Telegram auth.',
    })
  }
}
