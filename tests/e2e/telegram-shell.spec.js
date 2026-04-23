import { expect, test } from '@playwright/test'
import { expectDashboardShell, openApp } from './helpers/app.js'
import { buildTelegramAssistantStartParam } from '../../src/lib/telegram-assistant-links.js'

test.describe('telegram shell', () => {
  test('boots Telegram WebApp lifecycle hooks', async ({ page }) => {
    await openApp(page, '/', {
      telegram: {
        user: {
          id: 20002,
          first_name: 'Mini',
          last_name: 'App',
          username: 'mini_app_user',
        },
        startParam: 'inv_e2e',
      },
    })

    const telegramShell = await page.evaluate(() => ({
      hasTelegram: Boolean(window.Telegram?.WebApp),
      readyType: typeof window.Telegram?.WebApp?.ready,
      expandType: typeof window.Telegram?.WebApp?.expand,
      mainButtonType: typeof window.Telegram?.WebApp?.MainButton?.show,
    }))

    expect(telegramShell.hasTelegram).toBe(true)
    expect(telegramShell.readyType).toBe('function')
    expect(telegramShell.expandType).toBe('function')
    expect(telegramShell.mainButtonType).toBe('function')
    await expectDashboardShell(page)
  })

  test('navigates from assistant deep link start param', async ({ page }) => {
    await openApp(page, '/', {
      telegram: {
        user: {
          id: 20003,
          first_name: 'Mini',
          last_name: 'Assistant',
          username: 'mini_assistant_user',
        },
        startParam: buildTelegramAssistantStartParam('/transactions?tab=tagihan'),
      },
    })

    await page.waitForURL(/\/transactions\?tab=tagihan$/, {
      timeout: 15000,
    })
    await expect(page.getByRole('heading', { name: 'Jurnal' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: 'Tagihan', pressed: true })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText('Belum Ada Tagihan', { exact: false })).toBeVisible({
      timeout: 15000,
    })
  })

  test('navigates to payroll from assistant deep link start param', async ({ page }) => {
    await openApp(page, '/', {
      telegram: {
        user: {
          id: 20004,
          first_name: 'Mini',
          last_name: 'Payroll',
          username: 'mini_payroll_user',
        },
        startParam: buildTelegramAssistantStartParam('/payroll?tab=worker'),
      },
    })

    await page.waitForURL(/\/payroll\?tab=worker$/, {
      timeout: 15000,
    })
    await expect(page.getByRole('heading', { name: 'Catatan Absensi' })).toBeVisible({
      timeout: 15000,
    })
  })
})
