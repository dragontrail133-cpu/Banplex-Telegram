import { test } from '@playwright/test'
import { expectDashboardShell, openApp } from './helpers/app.js'

test.describe('auth bypass', () => {
  test('opens dashboard shell without Telegram container', async ({ page }) => {
    await openApp(page)
    await expectDashboardShell(page)
  })
})
