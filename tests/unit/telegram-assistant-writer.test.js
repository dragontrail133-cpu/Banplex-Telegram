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

test('assistant writer accepts settlement summary rewrite with loan totals', async () => {
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
                  text: JSON.stringify({
                    text: 'Tagihan lunas 1 item, pinjaman dicicil 1 item.',
                  }),
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
      },
      reply: {
        text: 'Tagihan lunas 1 item, pinjaman dicicil 1 item.',
        buttons: [],
        facts: {
          rowCount: 2,
          billCount: 1,
          loanCount: 1,
          billRemainingAmount: 0,
          loanRemainingAmount: 150000,
          summaryItems: ['Tagihan lunas 1 item', 'Pinjaman dicicil 1 item.'],
          presentation: 'html_summary',
          tone: 'santai_operasional',
        },
      },
      workspaceName: 'Banplex',
      session: {
        pending_payload: {
          context_summary: 'status ringkasan',
          last_turn: {
            user_text: 'status',
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

    assert.equal(replyText, 'Tagihan lunas 1 item, pinjaman dicicil 1 item.')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('assistant writer preserves clarification rewrite', async () => {
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
                  text: JSON.stringify({
                    text: 'Maksudnya yang tadi itu ID, nama proyek/supplier, nominal, tanggal, atau status?',
                  }),
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
        intent: 'clarify',
        language: 'id',
        clarificationCode: 'specific_filter',
      },
      reply: {
        text: 'Saya butuh filter yang lebih spesifik: ID, nama proyek/supplier, nominal, tanggal, atau status.',
        needsClarification: true,
        buttons: [],
        facts: {
          clarificationCode: 'specific_filter',
          queryLabel: 'tagihan dindin',
        },
      },
      workspaceName: 'Banplex',
      session: {
        pending_payload: {
          context_summary: 'follow-up clarification',
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

    assert.equal(
      replyText,
      'Maksudnya yang tadi itu ID, nama proyek/supplier, nominal, tanggal, atau status?'
    )
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

test('assistant response safety rejects unsupported route, entity, and action words', () => {
  const factPacket = {
    fallbackText: 'Saya menemukan 3 data paling relevan untuk "tagihan dindin":',
    buttons: [
      {
        text: 'Buka Jurnal',
        path: '/transactions',
      },
    ],
    facts: {
      rowCount: 3,
      queryLabel: 'tagihan dindin',
      items: [
        {
          index: 1,
          primaryLabel: 'Dindin',
        },
      ],
    },
    context: {
      summary: 'intent=status | query=tagihan dindin',
      lastRoute: '/transactions?tab=history',
      entityHints: ['supplier'],
    },
  }

  assert.equal(
    isAssistantResponseSafe('Ada 3 tagihan aktif untuk Dindin.', factPacket),
    true
  )

  assert.equal(
    isAssistantResponseSafe('Ada 4 tagihan aktif untuk Dindin.', factPacket),
    false
  )

  assert.equal(isAssistantResponseSafe('Buka Dashboard untuk Dindin.', factPacket), false)
  assert.equal(isAssistantResponseSafe('Ada 3 tagihan aktif untuk Rizky.', factPacket), false)
  assert.equal(isAssistantResponseSafe('Silakan hapus tagihan itu.', factPacket), false)
})
