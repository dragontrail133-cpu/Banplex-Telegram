import { expect, test } from '@playwright/test'
import { expectHeading, openApp } from './helpers/app.js'

test.describe.configure({ timeout: 240_000 })

test.describe('transaction surfaces', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(120_000)
  })

  test('opens journal', async ({ page }) => {
    await openApp(page, '/transactions')
    await expectHeading(page, 'Jurnal')
  })

  test('opens history', async ({ page }) => {
    await openApp(page, '/transactions/history')
    await expectHeading(page, 'Jurnal')
    await expect(page.getByRole('button', { name: 'Riwayat', pressed: true })).toBeVisible()
    await expect(page.getByText('Belum Ada Riwayat')).toBeVisible()
  })

  test('opens recycle bin', async ({ page }) => {
    await openApp(page, '/transactions/recycle-bin')
    await expectHeading(page, 'Arsip')
    await expect(page.getByText('Belum Ada Data Terhapus')).toBeVisible()
  })
})
