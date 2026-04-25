import assert from 'node:assert/strict'
import process from 'node:process'
import test from 'node:test'

import reportPdfDeliveryHandler, {
  resolveReportDeliveryEnv,
} from '../../api/report-pdf-delivery.js'

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
    headers: {
      authorization: 'Bearer test-access-token',
    },
  }
}

function createFetchResponse(body, { status = 200, headers = {} } = {}) {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body)
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value])
  )

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return normalizedHeaders.get(String(name).toLowerCase()) ?? null
      },
    },
    text: async () => rawBody,
    json: async () => JSON.parse(rawBody),
  }
}

function installFetchMock(handler) {
  const originalFetch = globalThis.fetch
  const calls = []

  globalThis.fetch = async (url, options = {}) => {
    const record = {
      url: String(url),
      options,
    }

    calls.push(record)

    return handler(record)
  }

  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch
    },
  }
}

test('report PDF delivery resolves VITE Supabase env fallbacks', () => {
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  }

  try {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_PUBLISHABLE_KEY
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co'
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key-test'
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-bot-token'

    const config = resolveReportDeliveryEnv()

    assert.equal(config.supabaseUrl, 'https://example.supabase.co')
    assert.equal(config.publishableKey, 'anon-key-test')
    assert.equal(config.telegramBotToken, 'telegram-bot-token')
  } finally {
    process.env.SUPABASE_URL = originalEnv.SUPABASE_URL
    process.env.SUPABASE_PUBLISHABLE_KEY = originalEnv.SUPABASE_PUBLISHABLE_KEY
    process.env.VITE_SUPABASE_URL = originalEnv.VITE_SUPABASE_URL
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY = originalEnv.VITE_SUPABASE_PUBLISHABLE_KEY
    process.env.VITE_SUPABASE_ANON_KEY = originalEnv.VITE_SUPABASE_ANON_KEY
    process.env.TELEGRAM_BOT_TOKEN = originalEnv.TELEGRAM_BOT_TOKEN
  }
})

test('report PDF delivery sends payment receipts to telegram DM', async () => {
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  }

  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key'
  process.env.TELEGRAM_BOT_TOKEN = 'test-telegram-token'

  const fetchMock = installFetchMock(async ({ url }) => {
    if (url.endsWith('/auth/v1/user')) {
      return createFetchResponse({
        id: 'e2e-user',
        user_metadata: {
          telegram_user_id: '20005',
        },
      })
    }

    if (url.includes('/rest/v1/profiles')) {
      return createFetchResponse([], {
        headers: {
          'content-range': '0-0/0',
        },
      })
    }

    if (url.startsWith('https://api.telegram.org/bottest-telegram-token/sendDocument')) {
      return createFetchResponse({
        ok: true,
        result: {
          message_id: 9001,
        },
      })
    }

    throw new Error(`Unexpected fetch call: ${url}`)
  })

  try {
    const response = createResponse()

    await reportPdfDeliveryHandler(
      createRequest({
        deliveryKind: 'payment_receipt',
        paymentType: 'loan',
        payment: {
          id: 'loan-payment-1',
          amount: 750000,
          paymentDate: '2026-04-23T03:00:00.000Z',
          notes: 'Angsuran pertama',
        },
        parentRecord: {
          id: 'loan-1',
          referenceId: 'loan-1',
          status: 'unpaid',
          remainingAmount: 1250000,
        },
        generatedAt: '2026-04-24T12:00:00.000Z',
      }),
      response
    )

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.deliveryMode, 'document')
    assert.equal(response.body.pdfError, null)
    assert.equal(response.body.fileName.startsWith('kwitansi-pinjaman-loan-1-loan-payment-1-'), true)
    assert.equal(fetchMock.calls.length, 3)

    const telegramCall = fetchMock.calls.at(-1)
    const telegramFormData = telegramCall.options.body

    assert.equal(telegramFormData.get('caption').includes('Kwitansi pembayaran pinjaman'), true)
    assert.equal(telegramFormData.get('document').name.startsWith('kwitansi-pinjaman-'), true)
  } finally {
    fetchMock.restore()
    process.env.SUPABASE_URL = originalEnv.SUPABASE_URL
    process.env.SUPABASE_PUBLISHABLE_KEY = originalEnv.SUPABASE_PUBLISHABLE_KEY
    process.env.TELEGRAM_BOT_TOKEN = originalEnv.TELEGRAM_BOT_TOKEN
  }
})

test('report PDF delivery sends beneficiary grouped reports to telegram DM', async () => {
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  }

  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key'
  process.env.TELEGRAM_BOT_TOKEN = 'test-telegram-token'

  const fetchMock = installFetchMock(async ({ url }) => {
    if (url.endsWith('/auth/v1/user')) {
      return createFetchResponse({
        id: 'e2e-user',
        user_metadata: {
          telegram_user_id: '20005',
        },
      })
    }

    if (url.includes('/rest/v1/profiles')) {
      return createFetchResponse([], {
        headers: {
          'content-range': '0-0/0',
        },
      })
    }

    if (url.startsWith('https://api.telegram.org/bottest-telegram-token/sendDocument')) {
      return createFetchResponse({
        ok: true,
        result: {
          message_id: 9002,
        },
      })
    }

    throw new Error(`Unexpected fetch call: ${url}`)
  })

  try {
    const response = createResponse()

    await reportPdfDeliveryHandler(
      createRequest({
        reportData: {
          reportKind: 'beneficiary_statement',
          title: 'LAPORAN PENERIMA PER INSTANSI',
          groupLabel: 'Instansi',
          groupValue: 'SD E2E',
          period: {
            dateFrom: '2026-04-24T12:00:00.000Z',
            dateTo: '2026-04-24T12:00:00.000Z',
          },
          summary: {
            total_beneficiaries: 2,
            valid_beneficiaries: 1,
            needs_review_beneficiaries: 1,
            unique_jenjang_count: 1,
          },
          rows: [
            {
              id: 'beneficiary-1',
              name: 'Rani Putri',
              nik: '3201012304000002',
              jenjang: 'SD',
              status: 'active',
              data_status: 'Valid',
            },
            {
              id: 'beneficiary-2',
              name: 'Sari Dewi',
              nik: '3201012304000003',
              jenjang: 'SD',
              status: 'pending',
              data_status: 'Requires verification',
            },
          ],
        },
      }),
      response
    )

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.deliveryMode, 'document')
    assert.equal(response.body.pdfError, null)
    assert.equal(response.body.fileName.startsWith('laporan-penerima-instansi-sd-e2e-'), true)
    assert.equal(fetchMock.calls.length, 3)

    const telegramCall = fetchMock.calls.at(-1)
    const telegramFormData = telegramCall.options.body

    assert.equal(telegramFormData.get('caption').includes('Laporan LAPORAN PENERIMA PER INSTANSI'), true)
    assert.equal(telegramFormData.get('document').name.startsWith('laporan-penerima-instansi-'), true)
  } finally {
    fetchMock.restore()
    process.env.SUPABASE_URL = originalEnv.SUPABASE_URL
    process.env.SUPABASE_PUBLISHABLE_KEY = originalEnv.SUPABASE_PUBLISHABLE_KEY
    process.env.TELEGRAM_BOT_TOKEN = originalEnv.TELEGRAM_BOT_TOKEN
  }
})

test('report PDF delivery sends applicant grouped reports to telegram DM', async () => {
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  }

  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key'
  process.env.TELEGRAM_BOT_TOKEN = 'test-telegram-token'

  const fetchMock = installFetchMock(async ({ url }) => {
    if (url.endsWith('/auth/v1/user')) {
      return createFetchResponse({
        id: 'e2e-user',
        user_metadata: {
          telegram_user_id: '20005',
        },
      })
    }

    if (url.includes('/rest/v1/profiles')) {
      return createFetchResponse([], {
        headers: {
          'content-range': '0-0/0',
        },
      })
    }

    if (url.startsWith('https://api.telegram.org/bottest-telegram-token/sendDocument')) {
      return createFetchResponse({
        ok: true,
        result: {
          message_id: 9003,
        },
      })
    }

    throw new Error(`Unexpected fetch call: ${url}`)
  })

  try {
    const response = createResponse()

    await reportPdfDeliveryHandler(
      createRequest({
        reportData: {
          reportKind: 'applicant_statement',
          title: 'LAPORAN PELAMAR PER STATUS',
          groupLabel: 'Status',
          groupValue: 'Screening',
          period: {
            dateFrom: '2026-04-24T12:00:00.000Z',
            dateTo: '2026-04-24T12:00:00.000Z',
          },
          summary: {
            total_applicants: 1,
            with_email_applicants: 1,
            with_phone_applicants: 1,
            with_documents_applicants: 1,
          },
          rows: [
            {
              id: 'applicant-1',
              name: 'Ayu Wulandari',
              position: 'Operator Administrasi',
              nik: '3201012304000001',
              email: 'ayu@example.com',
              no_telepon: '081234567890',
            },
          ],
        },
      }),
      response
    )

    assert.equal(response.statusCode, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.deliveryMode, 'document')
    assert.equal(response.body.pdfError, null)
    assert.equal(response.body.fileName.startsWith('laporan-pelamar-status-screening-'), true)
    assert.equal(fetchMock.calls.length, 3)

    const telegramCall = fetchMock.calls.at(-1)
    const telegramFormData = telegramCall.options.body

    assert.equal(telegramFormData.get('caption').includes('Laporan LAPORAN PELAMAR PER STATUS'), true)
    assert.equal(telegramFormData.get('document').name.startsWith('laporan-pelamar-status-'), true)
  } finally {
    fetchMock.restore()
    process.env.SUPABASE_URL = originalEnv.SUPABASE_URL
    process.env.SUPABASE_PUBLISHABLE_KEY = originalEnv.SUPABASE_PUBLISHABLE_KEY
    process.env.TELEGRAM_BOT_TOKEN = originalEnv.TELEGRAM_BOT_TOKEN
  }
})
