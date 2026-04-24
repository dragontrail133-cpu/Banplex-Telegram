import { expect } from '@playwright/test'
import { withDevAuthBypass } from '../../e2e/helpers/routes.js'
import { stubTelegramWebApp } from '../../e2e/helpers/telegram.js'

async function fulfillJson(route, payload) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload),
  })
}

async function openLiveApp(page, path = '/', options = {}) {
  const mockApi = options.mockApi ?? {}

  if (typeof mockApi.notify === 'function') {
    await page.route('**/api/notify', async (route) => {
      const request = route.request()
      let requestBody = null

      try {
        requestBody = request.postDataJSON()
      } catch {
        requestBody = request.postData()
      }

      const responseBody = await mockApi.notify({
        route,
        url: new URL(request.url()),
        method: request.method(),
        body: requestBody,
      })

      if (responseBody !== undefined) {
        await fulfillJson(route, responseBody)
        return
      }

      await fulfillJson(route, { success: true })
    })
  }

  if (typeof mockApi.reportDelivery === 'function') {
    await page.route('**/api/report-pdf-delivery', async (route) => {
      const request = route.request()
      let requestBody = null

      try {
        requestBody = request.postDataJSON()
      } catch {
        requestBody = request.postData()
      }

      const responseBody = await mockApi.reportDelivery({
        route,
        url: new URL(request.url()),
        method: request.method(),
        headers: request.headers(),
        body: requestBody,
      })

      if (responseBody !== undefined) {
        await fulfillJson(route, responseBody)
        return
      }

      await fulfillJson(route, { success: true })
    })
  }

  if (options.telegram) {
    await stubTelegramWebApp(page, options.telegram)
  }

  await page.goto(withDevAuthBypass(path), { waitUntil: 'domcontentloaded' })
}

async function expectDashboardReady(page) {
  await expect(page.getByRole('heading', { name: /^Halo,/ })).toBeVisible({
    timeout: 60000,
  })
  await expect(page.getByText('Saldo Kas', { exact: false })).toBeVisible({
    timeout: 60000,
  })
  await expect(page.getByRole('button', { name: 'Refresh dashboard' })).toBeVisible({
    timeout: 60000,
  })
}

async function dismissToastIfVisible(page) {
  const closeButton = page.getByRole('button', { name: 'Tutup' })

  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click()
  }
}

export { dismissToastIfVisible, expectDashboardReady, openLiveApp }
