import { expect, test } from '@playwright/test'
import { openApp } from './helpers/app.js'

test.describe('edit surfaces', () => {
  test('opens record editor shell', async ({ page }) => {
    await openApp(page, '/edit/expense/sample-expense-id')
    await expect(page.getByRole('heading', { name: /Edit / })).toBeVisible()
  })
})
