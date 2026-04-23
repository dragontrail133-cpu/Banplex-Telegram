import assert from 'node:assert/strict'
import test from 'node:test'

import {
  answerTelegramCallback,
} from '../../src/lib/telegram-assistant-transport.js'
import {
  buildTelegramAssistantLink,
  buildTelegramAssistantChatLink,
  buildTelegramAssistantStartParam,
  normalizeAssistantRoutePath,
  parseTelegramAssistantStartParam,
} from '../../src/lib/telegram-assistant-links.js'
import {
  buildAssistantMemoryPayload,
  buildPendingSessionPayload,
  normalizeAssistantPendingPayload,
} from '../../src/lib/telegram-assistant-session.js'
import {
  buildAssistantCommandInput,
  buildAssistantCommandRawText,
  extractAssistantCommand,
  resolveAssistantCallbackAction,
  shouldUseAssistantDmFallback,
} from '../../src/lib/telegram-assistant-routing.js'

test('assistant command parser recognizes supported slash commands', () => {
  assert.deepEqual(
    extractAssistantCommand('/status@banplex_bot tagihan unpaid', 'banplex_bot'),
    {
      command: 'status',
      args: 'tagihan unpaid',
      rawText: '/status@banplex_bot tagihan unpaid',
    }
  )

  assert.equal(buildAssistantCommandRawText('riwayat'), '/riwayat')
  assert.equal(
    buildAssistantCommandInput('analytics', 'pengeluaran minggu ini'),
    'ringkas pengeluaran minggu ini'
  )
})

test('assistant command parser ignores unsupported or foreign bot commands', () => {
  assert.equal(extractAssistantCommand('/status@other_bot tagihan', 'banplex_bot'), null)
  assert.equal(extractAssistantCommand('/hapus tagihan', 'banplex_bot'), null)
})

test('assistant start command parser carries DM handoff tokens', () => {
  assert.deepEqual(extractAssistantCommand('/start dh_abcdEFGH12345678', 'banplex_bot'), {
    command: 'start',
    args: 'dh_abcdEFGH12345678',
    rawText: '/start dh_abcdEFGH12345678',
  })

  assert.equal(buildAssistantCommandRawText('start', 'dh_abcdEFGH12345678'), '/start dh_abcdEFGH12345678')
  assert.equal(
    buildTelegramAssistantChatLink('@banplex_greenfield_bot', 'dh_abcdEFGH12345678'),
    'https://t.me/banplex_greenfield_bot?start=dh_abcdEFGH12345678'
  )
})

test('assistant callback routing maps quick action and clarification callbacks', () => {
  assert.deepEqual(resolveAssistantCallbackAction('ta:cmd:riwayat'), {
    type: 'message',
    messageText: '/riwayat',
    requiresSession: false,
  })

  assert.deepEqual(resolveAssistantCallbackAction('ta:am:cash_outflow'), {
    type: 'message',
    messageText: 'ringkas pengeluaran',
    requiresSession: true,
  })

  assert.deepEqual(resolveAssistantCallbackAction('ta:aw:week_current'), {
    type: 'message',
    messageText: 'minggu ini',
    requiresSession: true,
  })

  assert.equal(resolveAssistantCallbackAction('ta:cmd:hapus'), null)
})

test('assistant session payload keeps summary, route, entity hints, and compact transcript', () => {
  const previousPayload = normalizeAssistantPendingPayload({
    summary: 'intent=status | query=dindin',
    entity_hints: ['supplier'],
    transcript: [
      {
        at: '2026-04-23T00:00:00.000Z',
        role: 'user',
        text: 'status dindin',
        intent: 'status',
      },
      {
        at: '2026-04-23T00:01:00.000Z',
        role: 'user',
        text: 'cari tagihan dindin',
        intent: 'search',
      },
      {
        at: '2026-04-23T00:02:00.000Z',
        role: 'user',
        text: 'ringkas pengeluaran',
        intent: 'analytics',
      },
      {
        at: '2026-04-23T00:03:00.000Z',
        role: 'user',
        text: 'buka riwayat',
        intent: 'navigate',
      },
    ],
  })

  const turnData = {
    userText: 'ringkas hutang mang dindin',
    intent: 'analytics',
    language: 'id',
    workspaceName: 'Banplex',
    targetPath: '/transactions?tab=history',
    query: 'mang dindin',
    metricKey: 'bill_summary',
    entityType: 'supplier',
    entityQuery: 'Dindin',
    entityHints: ['supplier'],
    windowKey: 'month_current',
    summary: 'intent=analytics | query=mang dindin | path=/transactions?tab=history',
  }

  const memoryPayload = buildAssistantMemoryPayload(previousPayload, turnData)

  assert.equal(memoryPayload.summary.includes('intent=analytics'), true)
  assert.equal(memoryPayload.context_summary, memoryPayload.summary)
  assert.equal(memoryPayload.last_route, '/transactions?tab=history')
  assert.deepEqual(memoryPayload.entity_hints, ['supplier'])
  assert.equal(memoryPayload.transcript.length, 4)
  assert.equal(memoryPayload.transcript.at(-1).intent, 'analytics')
  assert.equal(memoryPayload.transcript.at(-1).route, '/transactions?tab=history')

  const pendingPayload = buildPendingSessionPayload(
    '/analytics hutang mang dindin',
    {
      intent: 'clarify',
      language: 'id',
      search: {},
      analytics: {},
      clarificationCode: 'analytics_entity',
    },
    previousPayload,
    turnData
  )

  assert.equal(pendingPayload.original_text, '/analytics hutang mang dindin')
  assert.equal(pendingPayload.last_intent, 'analytics')
  assert.equal(pendingPayload.last_turn.analytics.metric_key, 'bill_summary')
})

test('assistant deep link builder keeps buka route canonical', () => {
  const routePath = '/transactions?tab=history'
  const startParam = buildTelegramAssistantStartParam(routePath)

  assert.equal(startParam?.startsWith('nav_'), true)
  assert.equal(parseTelegramAssistantStartParam(startParam), routePath)
  assert.equal(
    buildTelegramAssistantLink('banplex_greenfield_bot', routePath),
    `https://t.me/banplex_greenfield_bot?startapp=${encodeURIComponent(startParam)}`
  )
})

test('assistant deep link builder keeps transaction detail history canonical', () => {
  const routePath = '/transactions/bill-9?surface=riwayat'
  const startParam = buildTelegramAssistantStartParam(routePath)

  assert.equal(startParam?.startsWith('nav_'), true)
  assert.equal(parseTelegramAssistantStartParam(startParam), routePath)
  assert.equal(normalizeAssistantRoutePath('/transactions/bill-9?surface=history'), routePath)
  assert.equal(
    buildTelegramAssistantLink('banplex_greenfield_bot', routePath),
    `https://t.me/banplex_greenfield_bot?startapp=${encodeURIComponent(startParam)}`
  )
})

test('assistant chat link builder opens the bot DM surface', () => {
  assert.equal(
    buildTelegramAssistantChatLink('@banplex_greenfield_bot'),
    'https://t.me/banplex_greenfield_bot'
  )
})

test('assistant route normalization rejects invite generation surfaces', () => {
  assert.equal(normalizeAssistantRoutePath('/more/team-invite'), null)
  assert.equal(
    buildTelegramAssistantLink('banplex_greenfield_bot', '/more/team-invite'),
    null
  )
})

test('assistant DM fallback policy only applies to group drill-down', () => {
  assert.equal(
    shouldUseAssistantDmFallback({
      chatType: 'private',
      needsClarification: true,
    }),
    false
  )

  assert.equal(
    shouldUseAssistantDmFallback({
      chatType: 'group',
      needsClarification: true,
    }),
    true
  )

  assert.equal(
    shouldUseAssistantDmFallback({
      chatType: 'supergroup',
      needsWorkspaceChoice: true,
    }),
    true
  )
})

test('assistant callback ack ignores invalid or expired callback query ids', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => ({
    status: 400,
    text: async () =>
      JSON.stringify({
        ok: false,
        description: 'Bad Request: query is too old and response timeout expired or query ID is invalid',
      }),
  })

  try {
    const response = await answerTelegramCallback({
      botToken: 'test-token',
      callbackQueryId: 'expired-query-id',
      text: 'ok',
    })

    assert.equal(response, null)
  } finally {
    globalThis.fetch = originalFetch
  }
})
