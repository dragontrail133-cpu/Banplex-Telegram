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
    await expect(page).toHaveURL(/\/transactions\?tab=tagihan$/)
    await expectHeading(page, 'Jurnal')
    await expect(page.getByRole('button', { name: 'Tagihan', pressed: true })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText('Belum Ada Tagihan', { exact: false })).toBeVisible({
      timeout: 15000,
    })
  })

  test('redirects the project report alias to reports', async ({ page }) => {
    await openApp(page, '/projects')
    await expect(page).toHaveURL(/\/reports(?:\?.*)?$/)
    await expect(page.getByRole('button', { name: 'Pengaturan PDF' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: 'Unduh PDF' })).toBeVisible({
      timeout: 15000,
    })
  })

  test('opens the dedicated pdf settings page', async ({ page }) => {
    await openApp(page, '/projects/pdf-settings')
    await expect(page).toHaveURL(/\/reports\/pdf-settings(?:\?.*)?$/)
    await expectHeading(page, 'Pengaturan PDF')
    await expect(page.getByRole('button', { name: 'Laporan' })).toBeVisible({
      timeout: 15000,
    })
  })

  test('exports business report PDF', async ({ page }) => {
    await openApp(page, '/reports')
    await expect(page).toHaveURL(/\/reports(?:\?.*)?$/)

    const downloadButton = page.getByRole('button', { name: 'Unduh PDF' })
    await expect(downloadButton).toBeVisible({ timeout: 15000 })
    await expect(downloadButton).toBeEnabled({ timeout: 15000 })
    await expect(page.getByRole('button', { name: 'Kirim' })).toHaveCount(0)

    const pdfDownload = page.waitForEvent('download')
    await downloadButton.click()
    const reportPdf = await pdfDownload
    const reportPdfPath = await reportPdf.path()
    expect(reportPdfPath).toBeTruthy()
    expect((await readFile(reportPdfPath)).subarray(0, 5).toString('utf8')).toBe('%PDF-')

    expect(reportPdf.suggestedFilename()).toContain('laporan-executive-finance')
  })
})
