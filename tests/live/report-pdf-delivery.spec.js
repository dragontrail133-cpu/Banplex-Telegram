import { expect, test } from '@playwright/test'
import { openLiveApp } from './helpers/live-app.js'

test.describe('live report pdf smoke', () => {
  test('delivers business report PDF via DM from Telegram Mini Web', async ({ page }) => {
    test.setTimeout(300000)

    let resolveReportDelivery = null
    const reportDeliveryPromise = new Promise((resolve) => {
      resolveReportDelivery = resolve
    })

    await openLiveApp(page, '/reports', {
      telegram: {
        user: {
          id: 20005,
          first_name: 'Mini',
          last_name: 'Report',
          username: 'mini_report_user',
        },
        startParam: '',
      },
      mockApi: {
        reportDelivery: async ({ url, method, headers, body }) => {
          resolveReportDelivery?.({
            url: url.pathname,
            method,
            headers,
            body,
          })

          return {
            success: true,
            deliveryMode: 'document',
            telegramStatus: 200,
            telegramResponse: {
              ok: true,
              result: {
                message_id: 20005,
              },
            },
            fileName: 'laporan-bisnis.pdf',
            pdfError: null,
          }
        },
      },
    })

    await expect(page).toHaveURL(/\/reports(?:\?.*)?$/)
    await expect(page.getByRole('button', { name: 'Unduh PDF' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Kirim ke DM' })).toHaveCount(0)
    const reportDeliveryButton = page.getByRole('button', { name: 'Kirim' })
    await expect(reportDeliveryButton).toBeVisible({
      timeout: 60000,
    })

    await reportDeliveryButton.click()

    const reportDelivery = await reportDeliveryPromise

    expect(reportDelivery?.url).toBe('/api/report-pdf-delivery')
    expect(reportDelivery?.method).toBe('POST')
    expect(reportDelivery?.headers?.authorization?.startsWith('Bearer ')).toBe(true)
    expect(reportDelivery?.body?.reportData?.reportKind).toBe('executive_finance')
    expect(reportDelivery?.body?.pdfSettings).not.toBeUndefined()
  })
})
