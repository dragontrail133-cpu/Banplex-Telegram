import assert from 'node:assert/strict'
import process from 'node:process'
import test from 'node:test'

import { resolveReportDeliveryEnv } from '../../api/report-pdf-delivery.js'

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
