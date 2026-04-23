import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isAssistantResponseSafe,
  rewriteAssistantReply,
} from '../../api/telegram-assistant.js'

test('assistant writer accepts safe natural rewrite', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({ text: 'Ada 3 tagihan aktif untuk Dindin.' }),
                },
              ],
            },
          },
        ],
      }),
  })

  try {
    const replyText = await rewriteAssistantReply({
      plan: {
        intent: 'status',
        language: 'id',
        search: {
          query: 'tagihan dindin',
        },
      },
      reply: {
        text: 'Saya menemukan 3 data paling relevan untuk "tagihan dindin":',
        buttons: [],
        facts: {
          rowCount: 3,
          queryLabel: 'tagihan dindin',
          items: [
            {
              index: 1,
              primaryLabel: 'Dindin',
              amountLabel: 'Rp 1.000',
            },
          ],
        },
      },
      workspaceName: 'Banplex',
      session: {
        pending_payload: {
          context_summary: 'follow-up status',
          last_turn: {
            user_text: 'tagihan dindin',
          },
        },
      },
      providerConfigs: [
        {
          provider: 'gemini',
          apiKey: 'test-key',
          model: 'test-model',
        },
      ],
    })

    assert.equal(replyText, 'Ada 3 tagihan aktif untuk Dindin.')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('assistant writer falls back when model invents unsupported number', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({ text: 'Ada 4 tagihan aktif untuk Dindin.' }),
                },
              ],
            },
          },
        ],
      }),
  })

  try {
    const replyText = await rewriteAssistantReply({
      plan: {
        intent: 'status',
        language: 'id',
        search: {
          query: 'tagihan dindin',
        },
      },
      reply: {
        text: 'Saya menemukan 3 data paling relevan untuk "tagihan dindin":',
        buttons: [],
        facts: {
          rowCount: 3,
          queryLabel: 'tagihan dindin',
        },
      },
      workspaceName: 'Banplex',
      session: {
        pending_payload: {
          context_summary: 'follow-up status',
          last_turn: {
            user_text: 'tagihan dindin',
          },
        },
      },
      providerConfigs: [
        {
          provider: 'gemini',
          apiKey: 'test-key',
          model: 'test-model',
        },
      ],
    })

    assert.equal(replyText, 'Saya menemukan 3 data paling relevan untuk "tagihan dindin":')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('assistant response safety rejects unsupported numbers', () => {
  assert.equal(
    isAssistantResponseSafe('Ada 3 tagihan aktif untuk Dindin.', {
      fallbackText: 'Ada 3 tagihan aktif untuk Dindin.',
      facts: {
        rowCount: 3,
      },
    }),
    true
  )

  assert.equal(
    isAssistantResponseSafe('Ada 4 tagihan aktif untuk Dindin.', {
      fallbackText: 'Ada 3 tagihan aktif untuk Dindin.',
      facts: {
        rowCount: 3,
      },
    }),
    false
  )
})
