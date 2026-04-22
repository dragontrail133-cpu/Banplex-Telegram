import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { expectDashboardShell, expectHeading, openApp } from './helpers/app.js'

test.describe('report surfaces', () => {
  test('opens dashboard summary', async ({ page }) => {
    await openApp(page, '/')
    await expectDashboardShell(page)
  })

  test('opens payroll summary', async ({ page }) => {
    await openApp(page, '/payroll')
    await expectHeading(page, 'Catatan Absensi')
  })

  test('opens tagihan summary', async ({ page }) => {
    await openApp(page, '/tagihan')
    await expectHeading(page, 'Tagihan')
  })

  test('exports business report PDF', async ({ page }) => {
    await openApp(page, '/projects')

    const downloadButton = page.getByRole('button', { name: 'Unduh PDF' })
    await expect(downloadButton).toBeVisible({ timeout: 15000 })
    await expect(downloadButton).toBeEnabled({ timeout: 15000 })

    const pdfDownload = page.waitForEvent('download')
    await downloadButton.click()
    const reportPdf = await pdfDownload
    const reportPdfPath = await reportPdf.path()
    expect(reportPdfPath).toBeTruthy()
    expect((await readFile(reportPdfPath)).subarray(0, 5).toString('utf8')).toBe('%PDF-')

    expect(reportPdf.suggestedFilename()).toContain('laporan-bisnis')
  })
})
