import { test } from '@playwright/test'
import { expectHeading, openApp } from './helpers/app.js'

test.describe('create surfaces', () => {
  test('opens attendance create sheet', async ({ page }) => {
    await openApp(page, '/attendance/new')
    await expectHeading(page, 'Absensi Harian')
  })

  test('opens material invoice create sheet', async ({ page }) => {
    await openApp(page, '/material-invoice/new')
    await expectHeading(page, 'Faktur Material')
  })
})
