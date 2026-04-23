import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createTelegramAssistantHandoffToken,
  hashTelegramAssistantHandoffToken,
  normalizeTelegramAssistantHandoffToken,
  redeemTelegramAssistantHandoff,
  saveTelegramAssistantHandoff,
} from '../../api/telegram-assistant-handoff.js'

function createFakeAdminClient() {
  const rows = []

  const matchFilter = (candidate, filter) => {
    if (filter.kind === 'eq') {
      return candidate?.[filter.column] === filter.value
    }

    if (filter.kind === 'is') {
      return filter.value === null ? candidate?.[filter.column] == null : candidate?.[filter.column] === filter.value
    }

    if (filter.kind === 'gt') {
      return String(candidate?.[filter.column] ?? '') > String(filter.value ?? '')
    }

    return false
  }

  return {
    rows,
    from(tableName) {
      assert.equal(tableName, 'telegram_assistant_handoffs')

      return {
        insert(payload) {
          const row = {
            id: `handoff-${rows.length + 1}`,
            consumed_at: null,
            consumed_chat_id: null,
            created_at: '2026-04-23T00:00:00.000Z',
            updated_at: '2026-04-23T00:00:00.000Z',
            ...payload,
          }

          rows.push(row)

          return {
            select() {
              return {
                single: async () => ({
                  data: { ...row },
                  error: null,
                }),
              }
            },
          }
        },
        update(payload) {
          const filters = []

          const chain = {
            eq(column, value) {
              filters.push({ kind: 'eq', column, value })
              return chain
            },
            is(column, value) {
              filters.push({ kind: 'is', column, value })
              return chain
            },
            gt(column, value) {
              filters.push({ kind: 'gt', column, value })
              return chain
            },
            select() {
              return {
                maybeSingle: async () => {
                  const row = rows.find((candidate) => filters.every((filter) => matchFilter(candidate, filter)))

                  if (!row) {
                    return {
                      data: null,
                      error: null,
                    }
                  }

                  Object.assign(row, payload)

                  return {
                    data: { ...row },
                    error: null,
                  }
                },
              }
            },
          }

          return chain
        },
      }
    },
  }
}

test('assistant handoff token save and redeem are one-time', async () => {
  const adminClient = createFakeAdminClient()
  const token = createTelegramAssistantHandoffToken()

  assert.equal(token.startsWith('dh_'), true)
  assert.equal(normalizeTelegramAssistantHandoffToken(`  ${token}  `), token)
  assert.equal(normalizeTelegramAssistantHandoffToken('bad token'), null)
  assert.equal(hashTelegramAssistantHandoffToken(token)?.length, 64)

  const saved = await saveTelegramAssistantHandoff(adminClient, {
    token,
    sourceChatId: '-1001234567890',
    sourceMessageId: '42',
    telegramUserId: '20001',
    teamId: 'team-abc',
    sessionPayload: {
      summary: 'intent=status',
    },
    originalText: 'status tagihan dindin',
    language: 'su',
    expiresAt: '2099-01-01T00:00:00.000Z',
  })

  assert.equal(saved.token_hash, hashTelegramAssistantHandoffToken(token))
  assert.equal(saved.language, 'su')
  assert.equal(saved.session_payload.summary, 'intent=status')

  assert.equal(
    await redeemTelegramAssistantHandoff(adminClient, {
      token,
      telegramUserId: '20002',
      consumedChatId: '900',
    }),
    null
  )

  const redeemed = await redeemTelegramAssistantHandoff(adminClient, {
    token,
    telegramUserId: '20001',
    consumedChatId: '900',
  })

  assert.equal(redeemed?.consumed_chat_id, '900')
  assert.equal(redeemed?.original_text, 'status tagihan dindin')

  assert.equal(
    await redeemTelegramAssistantHandoff(adminClient, {
      token,
      telegramUserId: '20001',
      consumedChatId: '900',
    }),
    null
  )
})
