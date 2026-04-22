import { test } from '@playwright/test'
import { expectHeading, openApp } from './helpers/app.js'

test.describe('transaction surfaces', () => {
  test('opens journal', async ({ page }) => {
    await openApp(page, '/transactions')
    await expectHeading(page, 'Jurnal')
  })

  test('opens history', async ({ page }) => {
    await openApp(page, '/transactions/history')
    await expectHeading(page, 'Riwayat')
  })

  test('opens recycle bin', async ({ page }) => {
    await openApp(page, '/transactions/recycle-bin')
    await expectHeading(page, 'Halaman Sampah')
  })
})
