import assert from 'node:assert/strict'
import test from 'node:test'

import { mapInviteToken } from '../../src/lib/team-invite.js'

const referenceTime = Date.parse('2026-04-24T12:00:00.000Z')

test('invite token mapping hydrates a shareable invite link', () => {
  const invite = mapInviteToken(
    {
      id: 'invite-1',
      team_id: 'team-1',
      token: 'inv_abc123',
      role: 'Admin',
      expires_at: '2026-04-25T00:00:00.000Z',
      is_used: false,
      created_at: '2026-04-23T00:00:00.000Z',
    },
    'banplex_greenfield_bot',
    referenceTime
  )

  assert.equal(
    invite.invite_link,
    'https://t.me/banplex_greenfield_bot?startapp=inv_abc123'
  )
  assert.equal(invite.lifecycle_status, 'active')
  assert.equal(invite.lifecycle_status_label, 'Aktif')
})

test('invite token mapping marks expired invites against a reference clock', () => {
  const invite = mapInviteToken(
    {
      id: 'invite-1',
      team_id: 'team-1',
      token: 'inv_abc123',
      role: 'Admin',
      expires_at: '2026-04-24T11:59:59.999Z',
      is_used: false,
      created_at: '2026-04-23T00:00:00.000Z',
    },
    'banplex_greenfield_bot',
    referenceTime
  )

  assert.equal(invite.lifecycle_status, 'expired')
  assert.equal(invite.lifecycle_status_label, 'Kedaluwarsa')
})

test('invite token mapping keeps invite link null when token is absent', () => {
  const invite = mapInviteToken(
    {
      id: 'invite-2',
      team_id: 'team-1',
      token: null,
      role: 'Viewer',
      expires_at: null,
      is_used: false,
      created_at: '2026-04-23T00:00:00.000Z',
    },
    'banplex_greenfield_bot'
  )

  assert.equal(invite.invite_link, null)
  assert.equal(invite.token, null)
})
