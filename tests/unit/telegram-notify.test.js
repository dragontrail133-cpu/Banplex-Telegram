import assert from 'node:assert/strict'
import process from 'node:process'
import test from 'node:test'

import notifyHandler from '../../api/notify.js'
import { buildTelegramAssistantLink } from '../../src/lib/telegram-assistant-links.js'

function createResponse() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value
    },
    status(code) {
      this.statusCode = code

      return this
    },
    json(payload) {
      this.body = payload

      return this
    },
  }
}

function createRequest(body) {
  return {
    method: 'POST',
    body: JSON.stringify(body),
  }
}

function installTelegramFetchMock(handler) {
  const originalFetch = globalThis.fetch
  const calls = []

  globalThis.fetch = async (url, options = {}) => {
    const record = {
      url,
      options,
    }

    calls.push(record)

    const responseBody = await handler(record)

    return {
      status: 200,
      text: async () => JSON.stringify(responseBody),
    }
  }

  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch
    },
  }
}

test('notify endpoint adds review buttons for project income text notifications', async () => {
  const originalEnv = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME,
  }

  process.env.TELEGRAM_BOT_TOKEN = 'test-token'
  process.env.TELEGRAM_CHAT_ID = '-1001234567890'
  process.env.TELEGRAM_BOT_USERNAME = 'banplex_greenfield_bot'

  const fetchMock = installTelegramFetchMock(async () => ({
    ok: true,
    result: {
      message_id: 1,
    },
  }))

  try {
    const response = createResponse()

    await notifyHandler(
      createRequest({
        notificationType: 'project_income',
        transactionId: 'income-123',
        projectName: 'Proyek A',
        transactionDate: '2026-04-23T03:00:00.000Z',
        amount: 1500000,
        userName: 'Admin Tim',
      }),
      response
    )

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.success, true)
    assert.equal(fetchMock.calls.length, 1)

    const telegramRequest = fetchMock.calls[0]
    const telegramPayload = JSON.parse(telegramRequest.options.body)
    const replyMarkup = telegramPayload.reply_markup

    assert.equal(telegramPayload.text.includes('Termin Proyek'), true)
    assert.equal(replyMarkup.inline_keyboard.length, 1)
    assert.deepEqual(replyMarkup.inline_keyboard[0], [
      {
        text: 'Review termin',
        url: buildTelegramAssistantLink(
          'banplex_greenfield_bot',
          '/transactions/income-123'
        ),
      },
      {
        text: 'Buka jurnal',
        url: buildTelegramAssistantLink('banplex_greenfield_bot', '/transactions'),
      },
    ])
  } finally {
    fetchMock.restore()
    process.env.TELEGRAM_BOT_TOKEN = originalEnv.TELEGRAM_BOT_TOKEN
    process.env.TELEGRAM_CHAT_ID = originalEnv.TELEGRAM_CHAT_ID
    process.env.TELEGRAM_BOT_USERNAME = originalEnv.TELEGRAM_BOT_USERNAME
  }
})

test('notify endpoint adds review buttons for bill payment document notifications', async () => {
  const originalEnv = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME,
  }

  process.env.TELEGRAM_BOT_TOKEN = 'test-token'
  process.env.TELEGRAM_CHAT_ID = '-1001234567890'
  process.env.TELEGRAM_BOT_USERNAME = 'banplex_greenfield_bot'

  const fetchMock = installTelegramFetchMock(async ({ options }) => {
    const formData = options.body

    return {
      ok: true,
      replyMarkup: formData.get('reply_markup'),
    }
  })

  try {
    const response = createResponse()

    await notifyHandler(
      createRequest({
        notificationType: 'bill_payment',
        billId: 'bill-9',
        paymentDate: '2026-04-23T03:00:00.000Z',
        supplierName: 'Supplier X',
        projectName: 'Proyek X',
        amount: 200000,
        remainingAmount: 300000,
      }),
      response
    )

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.success, true)
    assert.equal(fetchMock.calls.length, 1)

    const telegramRequest = fetchMock.calls[0]
    const formData = telegramRequest.options.body
    const replyMarkup = JSON.parse(formData.get('reply_markup'))

    assert.equal(formData.get('caption').includes('Pembayaran Tagihan'), true)
    assert.deepEqual(replyMarkup.inline_keyboard[0], [
      {
        text: 'Review pembayaran',
        url: buildTelegramAssistantLink(
          'banplex_greenfield_bot',
          '/transactions/bill-9?surface=riwayat'
        ),
      },
      {
        text: 'Buka riwayat',
        url: buildTelegramAssistantLink(
          'banplex_greenfield_bot',
          '/transactions?tab=history'
        ),
      },
    ])
  } finally {
    fetchMock.restore()
    process.env.TELEGRAM_BOT_TOKEN = originalEnv.TELEGRAM_BOT_TOKEN
    process.env.TELEGRAM_CHAT_ID = originalEnv.TELEGRAM_CHAT_ID
    process.env.TELEGRAM_BOT_USERNAME = originalEnv.TELEGRAM_BOT_USERNAME
  }
})

test('notify endpoint supports attendance notifications with payroll review buttons', async () => {
  const originalEnv = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME,
  }

  process.env.TELEGRAM_BOT_TOKEN = 'test-token'
  process.env.TELEGRAM_CHAT_ID = '-1001234567890'
  process.env.TELEGRAM_BOT_USERNAME = 'banplex_greenfield_bot'

  const fetchMock = installTelegramFetchMock(async () => ({
    ok: true,
    result: {
      message_id: 1,
    },
  }))

  try {
    const response = createResponse()

    await notifyHandler(
      createRequest({
        notificationType: 'attendance',
        workerName: 'Budi',
        projectName: 'Proyek A',
        attendanceDate: '2026-04-23T03:00:00.000Z',
        status: 'full_day',
      }),
      response
    )

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.success, true)

    const telegramRequest = fetchMock.calls[0]
    const telegramPayload = JSON.parse(telegramRequest.options.body)

    assert.equal(telegramPayload.text.includes('Absensi Baru Dicatat'), true)
    assert.deepEqual(telegramPayload.reply_markup.inline_keyboard[0], [
      {
        text: 'Review absensi',
        url: buildTelegramAssistantLink(
          'banplex_greenfield_bot',
          '/payroll?tab=daily'
        ),
      },
      {
        text: 'Buka payroll',
        url: buildTelegramAssistantLink('banplex_greenfield_bot', '/payroll?tab=worker'),
      },
    ])
  } finally {
    fetchMock.restore()
    process.env.TELEGRAM_BOT_TOKEN = originalEnv.TELEGRAM_BOT_TOKEN
    process.env.TELEGRAM_CHAT_ID = originalEnv.TELEGRAM_CHAT_ID
    process.env.TELEGRAM_BOT_USERNAME = originalEnv.TELEGRAM_BOT_USERNAME
  }
})
