import { expect, test } from '@playwright/test'
import { openApp } from './helpers/app.js'

test.describe.configure({ timeout: 180_000 })

function createProjectIncomeFormMockSupabase(url) {
  const tableName = url.pathname.split('/').filter(Boolean).at(-1)

  if (tableName === 'projects') {
    return [
      {
        id: 'project-e2e-1',
        name: 'Proyek E2E',
        project_name: 'Proyek E2E',
        status: 'active',
      },
    ]
  }

  return []
}

test.describe('edit surfaces', () => {
  test('opens record editor shell', async ({ page }) => {
    await openApp(page, '/edit/expense/sample-expense-id')
    await expect(page.getByRole('heading', { name: /Edit / })).toBeVisible()
  })

  test('saves project income from the new form', async ({ page }) => {
    await openApp(page, '/edit/project-income/new', {
      mockApi: {
        transactions: async ({ method, body }) => {
          if (method === 'POST' && body?.recordType === 'project-income') {
            return {
              success: true,
              record: {
                id: 'project-income-e2e-1',
                ...body,
              },
            }
          }

          return undefined
        },
        supabase: async ({ url }) => createProjectIncomeFormMockSupabase(url),
      },
    })

    await expect(page.getByRole('button', { name: /Pilih proyek/i })).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /Pilih proyek/i }).click()
    const projectDialog = page.getByRole('dialog', { name: 'Pilih Proyek' })
    await expect(projectDialog).toBeVisible({ timeout: 15000 })

    const projectOption = projectDialog.locator('button').filter({ hasText: 'Proyek E2E' }).first()
    await expect(projectOption).toBeVisible({ timeout: 15000 })
    await projectOption.click()

    await page.locator('input[placeholder="Rp 0"]').first().fill('125000')
    await page
      .getByPlaceholder('Contoh: Termin 1 pekerjaan struktur.')
      .fill('Termin E2E')

    const saveRequestPromise = page.waitForResponse((response) => {
      return response.request().method() === 'POST' && response.url().includes('/api/transactions')
    })

    await page.getByRole('button', { name: 'Simpan Termin Proyek' }).click()

    const saveResponse = await saveRequestPromise
    expect(saveResponse.ok()).toBeTruthy()
    await expect(page.getByText('Pemasukan proyek tersimpan')).toBeVisible({
      timeout: 15000,
    })
  })
})
