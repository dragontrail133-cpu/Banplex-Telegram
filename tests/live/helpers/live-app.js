import { expect } from '@playwright/test'
import { withDevAuthBypass } from '../../e2e/helpers/routes.js'

async function openLiveApp(page, path = '/') {
  await page.goto(withDevAuthBypass(path), { waitUntil: 'domcontentloaded' })
}

async function expectDashboardReady(page) {
  await expect(page.getByText('Halo,', { exact: false })).toBeVisible({
    timeout: 20000,
  })
  await expect(page.getByText('Saldo Kas', { exact: false })).toBeVisible({
    timeout: 20000,
  })
  await expect(page.getByRole('button', { name: 'Refresh dashboard' })).toBeVisible({
    timeout: 20000,
  })
}

async function dismissToastIfVisible(page) {
  const closeButton = page.getByRole('button', { name: 'Tutup' })

  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click()
  }
}

export { dismissToastIfVisible, expectDashboardReady, openLiveApp }
