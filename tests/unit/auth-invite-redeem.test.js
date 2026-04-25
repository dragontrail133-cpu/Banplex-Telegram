import assert from 'node:assert/strict'
import test from 'node:test'

import { redeemInviteTokenForAuth } from '../../api/auth.js'

function createThenableResult(result) {
  return {
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject)
    },
  }
}

function createAdminClientMock({
  invite = null,
  teamMember = null,
  markInviteError = null,
}) {
  const calls = []

  const inviteQuery = {
    select(columns) {
      calls.push({
        table: 'invite_tokens',
        action: 'select',
        columns,
      })
      return inviteQuery
    },
    eq(column, value) {
      calls.push({
        table: 'invite_tokens',
        action: 'eq',
        column,
        value,
      })
      return inviteQuery
    },
    maybeSingle: async () => ({
      data: invite,
      error: null,
    }),
    update(payload) {
      calls.push({
        table: 'invite_tokens',
        action: 'update',
        payload,
      })

      return {
        eq(column, value) {
          calls.push({
            table: 'invite_tokens',
            action: 'update-eq',
            column,
            value,
          })

          return createThenableResult({
            data: null,
            error: markInviteError,
          })
        },
      }
    },
  }

  const teamMembersQuery = {
    upsert(payload, options) {
      calls.push({
        table: 'team_members',
        action: 'upsert',
        payload,
        options,
      })

      return {
        select(columns) {
          calls.push({
            table: 'team_members',
            action: 'select',
            columns,
          })

          return {
            single: async () => ({
              data: teamMember,
              error: null,
            }),
          }
        },
      }
    },
  }

  return {
    calls,
    from(table) {
      if (table === 'invite_tokens') {
        return inviteQuery
      }

      if (table === 'team_members') {
        return teamMembersQuery
      }

      throw new Error(`Unexpected table: ${table}`)
    },
  }
}

test('redeems invite token through server-side Supabase client', async () => {
  const adminClient = createAdminClientMock({
    invite: {
      id: 'invite-1',
      team_id: 'team-1',
      token: 'inv_abc123',
      role: 'Admin',
      expires_at: '2026-04-26T00:00:00.000Z',
      is_used: false,
      created_at: '2026-04-25T00:00:00.000Z',
    },
    teamMember: {
      id: 'member-1',
      team_id: 'team-1',
      telegram_user_id: '999001',
      role: 'Admin',
      is_default: false,
      status: 'active',
      approved_at: '2026-04-25T00:00:00.000Z',
    },
  })

  const result = await redeemInviteTokenForAuth(adminClient, '999001', 'inv_abc123')

  assert.equal(result?.id, 'member-1')
  assert.equal(result?.team_id, 'team-1')
  const upsertPayload = adminClient.calls.find(
    (call) => call.table === 'team_members' && call.action === 'upsert'
  )?.payload

  assert.equal(upsertPayload.team_id, 'team-1')
  assert.equal(upsertPayload.telegram_user_id, '999001')
  assert.equal(upsertPayload.role, 'Admin')
  assert.equal(upsertPayload.is_default, false)
  assert.equal(upsertPayload.status, 'active')
  assert.equal(typeof upsertPayload.approved_at, 'string')
  assert.equal(Number.isNaN(new Date(upsertPayload.approved_at).getTime()), false)
  assert.deepEqual(
    adminClient.calls.find((call) => call.table === 'invite_tokens' && call.action === 'update')?.payload,
    {
      is_used: true,
    }
  )
})

test('rejects used invite tokens', async () => {
  const adminClient = createAdminClientMock({
    invite: {
      id: 'invite-2',
      team_id: 'team-1',
      token: 'inv_used',
      role: 'Admin',
      expires_at: '2026-04-26T00:00:00.000Z',
      is_used: true,
      created_at: '2026-04-25T00:00:00.000Z',
    },
  })

  await assert.rejects(
    redeemInviteTokenForAuth(adminClient, '999001', 'inv_used'),
    (error) => error?.statusCode === 409
  )
})
