import assert from 'node:assert/strict'
import test from 'node:test'

import {
  answerTelegramCallback,
  deleteTelegramMessage,
  editTelegramMessageText,
  sendTelegramMessage,
  sendTelegramChatAction,
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
  assistantRouteTargets,
  buildAssistantCommandInput,
  buildAssistantCommandRawText,
  extractAssistantCommand,
  getAssistantRouteLabel,
  resolveAssistantCallbackAction,
  resolveAssistantMenuCommandFromText,
  shouldUseAssistantDmFallback,
} from '../../src/lib/telegram-assistant-routing.js'
import {
  buildAssistantMainMenuReplyMarkup,
  buildAnalyticsFollowUpRows,
  buildAssistantSummaryMessageState,
  buildSettlementBucketDetailReply,
  buildSettlementBucketReply,
  buildStatusReply,
  getTelegramMessageIdFromResponse,
  processAssistantCommand,
  sendAssistantHybridSummaryReply,
  shouldProcessTelegramMessage,
  stripAssistantSummaryMessageState,
} from '../../api/telegram-assistant.js'

function createTelegramApiFetchMock() {
  const calls = []

  const fetch = async (url, init = {}) => {
    const endpoint = String(url).split('/').pop()
    const body = init.body ? JSON.parse(init.body) : null

    calls.push({
      url: String(url),
      endpoint,
      body,
    })

    const result =
      endpoint === 'sendChatAction'
        ? true
        : endpoint === 'sendMessage' || endpoint === 'editMessageText'
          ? {
              message_id: 202,
            }
          : true

    return {
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          result,
        }),
    }
  }

  return {
    calls,
    fetch,
  }
}

test('assistant command parser recognizes supported slash commands', () => {
  assert.deepEqual(
    extractAssistantCommand('/status@banplex_bot tagihan unpaid', 'banplex_bot'),
    {
      command: 'status',
      args: 'tagihan unpaid',
      rawText: '/status@banplex_bot tagihan unpaid',
    }
  )

  assert.deepEqual(extractAssistantCommand('/tambah pemasukan', 'banplex_bot'), {
    command: 'tambah',
    args: 'pemasukan',
    rawText: '/tambah pemasukan',
  })

  assert.equal(buildAssistantCommandRawText('tambah'), '/tambah')
  assert.equal(buildAssistantCommandRawText('riwayat'), '/riwayat')
  assert.equal(
    buildAssistantCommandInput('analytics', 'pengeluaran minggu ini'),
    'ringkas pengeluaran minggu ini'
  )
})

test('assistant menu resolver maps reply keyboard text back to existing commands', () => {
  assert.equal(
    resolveAssistantMenuCommandFromText('Menu', {
      menu: 'Menu',
      add: 'Tambah',
      open: 'Buka',
      search: 'Cari',
      status: 'Status',
      history: 'Riwayat',
      analytics: 'Analytics',
    }),
    'menu'
  )

  assert.equal(
    resolveAssistantMenuCommandFromText('Muka', {
      menu: 'Menu',
      add: 'Tambah',
      open: 'Muka',
      search: 'Cari',
      status: 'Status',
      history: 'Riwayat',
      analytics: 'Analytics',
    }),
    'buka'
  )

  assert.equal(
    resolveAssistantMenuCommandFromText('Status', {
      menu: 'Menu',
      add: 'Tambah',
      open: 'Buka',
      search: 'Cari',
      status: 'Status',
      history: 'Riwayat',
      analytics: 'Analytics',
    }),
    'status'
  )
})

test('assistant group reply keyboard labels are accepted by message gate', () => {
  assert.equal(
    shouldProcessTelegramMessage({
      message: {
        chat: { type: 'group' },
      },
      session: null,
      botUsername: 'banplex_bot',
      messageText: 'Analytics',
      menuLabels: {
        menu: 'Menu',
        add: 'Tambah',
        open: 'Buka',
        search: 'Cari',
        status: 'Status',
        history: 'Riwayat',
        analytics: 'Analytics',
      },
    }),
    true
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

  assert.deepEqual(resolveAssistantCallbackAction('ta:cmd:tambah'), {
    type: 'message',
    messageText: '/tambah',
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

  assert.deepEqual(resolveAssistantCallbackAction('ta:sb:status:paid'), {
    type: 'settlement_summary',
    surface: 'status',
    status: 'paid',
    requiresSession: true,
  })

  assert.equal(resolveAssistantCallbackAction('ta:cmd:hapus'), null)
})

test('assistant settlement summary reply uses inline callbacks only', () => {
  const sampleRows = [
    {
      bill_status: 'paid',
      source_type: 'bill',
      bill_type: 'Tagihan',
      bill_amount: 120000,
      bill_remaining_amount: 0,
      bill_description: 'Tagihan A',
      description: 'Tagihan A',
      sort_at: '2026-04-24',
    },
    {
      bill_status: 'paid',
      source_type: 'loan-disbursement',
      bill_type: 'Pinjaman',
      bill_amount: 250000,
      bill_remaining_amount: 0,
      creditor_name_snapshot: 'Kreditur A',
      description: 'Pinjaman A',
      sort_at: '2026-04-24',
    },
  ]

  const bucketReply = buildSettlementBucketReply('id', sampleRows, 'status')
  const detailReply = buildSettlementBucketDetailReply('id', sampleRows, 'status', 'paid')
  const statusReply = buildStatusReply(sampleRows, { language: 'id', search: {} })

  assert.equal(bucketReply.parseMode, 'HTML')
  assert.equal(detailReply.parseMode, 'HTML')
  assert.equal(statusReply.parseMode, 'HTML')
  assert.equal(bucketReply.text.startsWith('<blockquote>'), true)
  assert.equal(detailReply.text.startsWith('<blockquote>'), true)
  assert.equal(statusReply.text.startsWith('<blockquote>'), true)
  assert.equal(bucketReply.text.includes('SUMMARY SEMUA DATA'), true)
  assert.equal(detailReply.text.includes('SUMMARY LUNAS'), true)
  assert.equal(bucketReply.buttonRows[0][0].callbackData, 'ta:sb:status:paid')
  assert.equal(bucketReply.buttonRows.at(-1)[0].callbackData, 'ta:cmd:menu')
  assert.equal(bucketReply.buttonRows.flat().every((button) => !button.path && !button.url), true)
  assert.equal(bucketReply.text.includes('<i>Pilih bucket lain atau Menu.</i>'), true)
  assert.equal(detailReply.buttonRows.at(-1)[0].callbackData, 'ta:cmd:menu')
  assert.equal(detailReply.buttonRows.flat().every((button) => !button.path && !button.url), true)
  assert.equal(detailReply.appendQuickActions, false)
  assert.equal(detailReply.text.includes('<i>Pilih bucket lain atau Menu.</i>'), true)
})

test('assistant settlement summary escapes dynamic html fields', () => {
  const escapedReply = buildSettlementBucketDetailReply(
    'id',
    [
      {
        bill_status: 'paid',
        source_type: 'expense',
        bill_type: 'Tagihan',
        bill_amount: 125000,
        bill_remaining_amount: 0,
        supplier_name_snapshot: 'CV <Sumber> & Co',
        bill_description: 'Faktur <material>',
        description: 'Catatan <teks>',
        sort_at: '2026-04-24',
      },
    ],
    'status',
    'paid'
  )

  assert.equal(escapedReply.text.includes('&lt;Sumber&gt; &amp; Co'), true)
  assert.equal(escapedReply.text.includes('&lt;teks&gt;'), true)
})

test('assistant analytics follow-up rows stay callback-only', () => {
  const followUpRows = buildAnalyticsFollowUpRows('id', 'cash_outflow')
  const flattenedButtons = followUpRows.flat()

  assert.equal(flattenedButtons.at(-1).callbackData, 'ta:cmd:menu')
  assert.equal(flattenedButtons.every((button) => !button.path && !button.url), true)
  assert.equal(flattenedButtons.some((button) => button.callbackData?.startsWith('ta:aw:')), true)
})

test('assistant analytics slash command replies with loading fallback and cleanup', async () => {
  const originalFetch = globalThis.fetch
  const { calls, fetch } = createTelegramApiFetchMock()
  globalThis.fetch = fetch

  const adminClient = {
    from: () => ({
      upsert: async () => ({
        error: null,
      }),
    }),
  }

  try {
    const result = await processAssistantCommand({
      adminClient,
      botToken: 'test-token',
      chatId: '123456',
      replyToMessageId: 11,
      telegramUserId: '999',
      chatType: 'private',
      rawText: '/analytics',
      command: {
        command: 'analytics',
        args: '',
      },
      session: {
        team_id: 'team-1',
        state: 'idle',
        pending_payload: {
          summary_message_id: 41,
          transient_message_ids: [42, 43],
        },
      },
      memberships: [
        {
          team_id: 'team-1',
          team_name: 'Workspace A',
          is_default: true,
          team_is_active: true,
          role: 'member',
        },
      ],
    })

    assert.equal(result.processed, true)
    assert.equal(result.messageId, 202)
    assert.equal(calls[0].endpoint, 'sendChatAction')
    assert.deepEqual(calls[0].body, {
      chat_id: '123456',
      action: 'typing',
    })
    assert.equal(calls[1].endpoint, 'sendMessage')
    assert.equal(calls[1].body.text, 'Bot sedang memproses analytics...')
    assert.equal(calls[1].body.reply_to_message_id, 11)
    assert.equal(calls[2].endpoint, 'editMessageText')
    assert.equal(calls[2].body.message_id, 202)
    assert.equal(Boolean(calls[2].body.reply_markup?.inline_keyboard?.length), true)
    assert.equal(calls.some((call) => call.endpoint === 'deleteMessage' && call.body.message_id === 41), true)
    assert.equal(calls.some((call) => call.endpoint === 'deleteMessage' && call.body.message_id === 42), true)
    assert.equal(calls.some((call) => call.endpoint === 'deleteMessage' && call.body.message_id === 43), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('assistant summary helper sends loading before final edit', async () => {
  const originalFetch = globalThis.fetch
  const { calls, fetch } = createTelegramApiFetchMock()
  globalThis.fetch = fetch

  const adminClient = {
    from: () => ({
      upsert: async () => ({
        error: null,
      }),
    }),
  }

  try {
    const result = await sendAssistantHybridSummaryReply({
      adminClient,
      botToken: 'test-token',
      chatId: '123456',
      replyToMessageId: 21,
      telegramUserId: '999',
      session: {
        pending_payload: {
          summary_message_id: 51,
          transient_message_ids: [52],
        },
      },
      sessionPayload: {
        summary_message_id: 51,
        transient_message_ids: [52],
      },
      selectedMembership: {
        team_id: 'team-1',
        team_name: 'Workspace A',
      },
      plan: {
        intent: 'status',
        language: 'id',
      },
      reply: {
        text: '<blockquote><b>SUMMARY</b></blockquote>',
        parseMode: 'HTML',
        buttonRows: [],
        needsClarification: false,
      },
      turnData: {
        userText: 'status',
        intent: 'status',
        language: 'id',
        workspaceName: 'Workspace A',
      },
    })

    assert.equal(result.processed, true)
    assert.equal(calls[0].endpoint, 'sendChatAction')
    assert.equal(calls[1].endpoint, 'sendMessage')
    assert.equal(calls[1].body.text, 'Bot sedang memproses ringkasan...')
    assert.equal(calls[2].endpoint, 'editMessageText')
    assert.equal(calls[2].body.text, '<blockquote><b>SUMMARY</b></blockquote>')
    assert.equal(calls.some((call) => call.endpoint === 'deleteMessage' && call.body.message_id === 51), true)
    assert.equal(calls.some((call) => call.endpoint === 'deleteMessage' && call.body.message_id === 52), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('assistant summary session message state keeps active and transient ids', () => {
  const initialState = buildAssistantSummaryMessageState(
    {
      summary_message_id: 21,
      transient_message_ids: [3, '7', 21],
      other_field: 'keep-me',
    },
    21
  )
  const nextState = buildAssistantSummaryMessageState(initialState, 42)

  assert.equal(initialState.summary_message_id, 21)
  assert.deepEqual(initialState.transient_message_ids, [3, 7])
  assert.equal(nextState.summary_message_id, 42)
  assert.deepEqual(nextState.transient_message_ids, [3, 7, 21])
  assert.deepEqual(
    stripAssistantSummaryMessageState(nextState),
    {
      other_field: 'keep-me',
    }
  )
})

test('assistant telegram message id extractor reads Telegram sendMessage response shape', () => {
  assert.equal(
    getTelegramMessageIdFromResponse({
      ok: true,
      result: {
        message_id: 77,
      },
    }),
    77
  )

  assert.equal(getTelegramMessageIdFromResponse({ message_id: 12 }), 12)
})

test('assistant telegram transport edits summary messages with inline markup', async () => {
  const originalFetch = globalThis.fetch
  let capturedRequest = null

  globalThis.fetch = async (url, init) => {
    capturedRequest = {
      url,
      init,
    }

    return {
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          result: {
            message_id: 99,
          },
        }),
    }
  }

  try {
    const response = await editTelegramMessageText({
      botToken: 'test-token',
      chatId: '123456',
      messageId: 17,
      text: 'Ringkasan status',
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [[{ text: 'Menu', callback_data: 'ta:cmd:menu' }]],
      },
    })

    assert.equal(capturedRequest.url.endsWith('/editMessageText'), true)
    assert.deepEqual(JSON.parse(capturedRequest.init.body), {
      chat_id: '123456',
      message_id: 17,
      text: 'Ringkasan status',
      disable_web_page_preview: true,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[{ text: 'Menu', callback_data: 'ta:cmd:menu' }]],
      },
    })
    assert.equal(response.result.message_id, 99)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('assistant telegram transport sends html parse mode for summary messages', async () => {
  const originalFetch = globalThis.fetch
  let capturedRequest = null

  globalThis.fetch = async (url, init) => {
    capturedRequest = {
      url,
      init,
    }

    return {
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          result: {
            message_id: 101,
          },
        }),
    }
  }

  try {
    const response = await sendTelegramMessage({
      botToken: 'test-token',
      chatId: '123456',
      text: '<blockquote><b>SUMMARY</b></blockquote>',
      parseMode: 'HTML',
    })

    assert.equal(capturedRequest.url.endsWith('/sendMessage'), true)
    assert.deepEqual(JSON.parse(capturedRequest.init.body), {
      chat_id: '123456',
      text: '<blockquote><b>SUMMARY</b></blockquote>',
      disable_web_page_preview: true,
      parse_mode: 'HTML',
    })
    assert.equal(response.result.message_id, 101)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('assistant telegram transport sends chat action for loading feedback', async () => {
  const originalFetch = globalThis.fetch
  let capturedRequest = null

  globalThis.fetch = async (url, init) => {
    capturedRequest = {
      url,
      init,
    }

    return {
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          result: true,
        }),
    }
  }

  try {
    const response = await sendTelegramChatAction({
      botToken: 'test-token',
      chatId: '123456',
      action: 'typing',
    })

    assert.equal(capturedRequest.url.endsWith('/sendChatAction'), true)
    assert.deepEqual(JSON.parse(capturedRequest.init.body), {
      chat_id: '123456',
      action: 'typing',
    })
    assert.equal(response.result, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('assistant telegram transport deletes summary messages', async () => {
  const originalFetch = globalThis.fetch
  let capturedRequest = null

  globalThis.fetch = async (url, init) => {
    capturedRequest = {
      url,
      init,
    }

    return {
      status: 200,
      text: async () =>
        JSON.stringify({
          ok: true,
          result: true,
        }),
    }
  }

  try {
    const response = await deleteTelegramMessage({
      botToken: 'test-token',
      chatId: '123456',
      messageId: 17,
    })

    assert.equal(capturedRequest.url.endsWith('/deleteMessage'), true)
    assert.deepEqual(JSON.parse(capturedRequest.init.body), {
      chat_id: '123456',
      message_id: 17,
    })
    assert.equal(response.ok, true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('assistant main menu reply markup is persistent and resizeable', () => {
  const replyMarkup = buildAssistantMainMenuReplyMarkup('id')

  assert.deepEqual(replyMarkup.keyboard, [
    [{ text: 'Tambah' }, { text: 'Buka' }, { text: 'Cari' }],
    [{ text: 'Status' }, { text: 'Riwayat' }, { text: 'Analytics' }],
    [{ text: 'Menu' }],
  ])
  assert.equal(replyMarkup.resize_keyboard, true)
  assert.equal(replyMarkup.is_persistent, true)
  assert.equal(replyMarkup.input_field_placeholder, 'Pilih aksi assistant yang dibutuhkan.')
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

test('assistant deep link builder keeps create routes canonical', () => {
  const createRoutes = [
    assistantRouteTargets.dashboard,
    assistantRouteTargets.incomeCreate,
    assistantRouteTargets.expenseCreate,
    assistantRouteTargets.loanCreate,
    assistantRouteTargets.invoiceCreate,
    assistantRouteTargets.attendanceCreate,
  ]

  for (const routePath of createRoutes) {
    const startParam = buildTelegramAssistantStartParam(routePath)

    assert.equal(startParam?.startsWith('nav_'), true)
    assert.equal(parseTelegramAssistantStartParam(startParam), routePath)
    assert.equal(
      buildTelegramAssistantLink('banplex_greenfield_bot', routePath),
      `https://t.me/banplex_greenfield_bot?startapp=${encodeURIComponent(startParam)}`
    )
  }
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

test('assistant route labels stay canonical across payroll and ledger variants', () => {
  assert.equal(getAssistantRouteLabel(assistantRouteTargets.dashboard), 'Dashboard')
  assert.equal(getAssistantRouteLabel(assistantRouteTargets.ledger), 'Jurnal')
  assert.equal(getAssistantRouteLabel(assistantRouteTargets.activeLedger), 'Jurnal')
  assert.equal(getAssistantRouteLabel(assistantRouteTargets.billLedger), 'Tagihan')
  assert.equal(getAssistantRouteLabel(assistantRouteTargets.history), 'Riwayat')
  assert.equal(getAssistantRouteLabel(assistantRouteTargets.payment), 'Pembayaran')
  assert.equal(getAssistantRouteLabel(assistantRouteTargets.payroll), 'Absensi')
  assert.equal(getAssistantRouteLabel(assistantRouteTargets.attendance), 'Absensi')
  assert.equal(getAssistantRouteLabel(assistantRouteTargets.worker), 'Pekerja')
})

test('assistant deep link builder keeps attendance canonical', () => {
  const routePath = assistantRouteTargets.attendance
  const startParam = buildTelegramAssistantStartParam(routePath)

  assert.equal(startParam?.startsWith('nav_'), true)
  assert.equal(parseTelegramAssistantStartParam(startParam), routePath)
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
