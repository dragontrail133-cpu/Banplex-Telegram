import assert from 'node:assert/strict'
import test from 'node:test'

import {
  answerTelegramCallback,
} from '../../src/lib/telegram-assistant-transport.js'
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
