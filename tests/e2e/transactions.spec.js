import { expect, test } from '@playwright/test'
import { expectHeading, openApp } from './helpers/app.js'

test.describe.configure({ timeout: 240_000 })

function createMaterialInvoiceDetailMock() {
  const expenseId = 'material-expense-e2e'
  const billId = 'bill-material-e2e'

  const transaction = {
    id: expenseId,
    team_id: 'e2e-team',
    sourceType: 'expense',
    type: 'expense',
    expense_type: 'material',
    document_type: 'faktur',
    amount: 450_000,
    total_amount: 450_000,
    description: 'Faktur material E2E',
    project_name_snapshot: 'Proyek E2E',
    supplier_name_snapshot: 'Supplier E2E',
    created_at: '2026-04-23T10:00:00.000Z',
    updated_at: '2026-04-23T10:00:00.000Z',
    bill: {
      id: billId,
      status: 'unpaid',
      amount: 450_000,
      paid_amount: 0,
      remaining_amount: 450_000,
      payments: [],
    },
  }

  const invoice = {
    ...transaction,
    items: [
      {
        id: 'item-material-e2e-1',
        item_name: 'Besi 10 mm',
        qty: 5,
        unit_price: 120_000,
        line_total: 600_000,
        sort_order: 1,
      },
    ],
  }

  return { billId, expenseId, invoice, transaction }
}

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

  test('redirects material invoice details to the canonical transaction page and shows invoice tab', async ({
    page,
  }) => {
    const { billId, expenseId, invoice, transaction } = createMaterialInvoiceDetailMock()

    await openApp(page, `/material-invoice/${expenseId}`, {
      mockApi: {
        transactions: async ({ method, url }) => {
          if (method === 'GET' && url.searchParams.get('transactionId') === expenseId) {
            return {
              success: true,
              record: transaction,
            }
          }

          return undefined
        },
        records: async ({ method, resource, url }) => {
          if (resource === 'material-invoices' && method === 'GET') {
            return {
              success: true,
              expense: invoice,
            }
          }

          if (resource === 'bills' && method === 'GET' && url.searchParams.get('billId') === billId) {
            return {
              success: true,
              bill: transaction.bill,
            }
          }

          if (resource === 'expense-attachments' && method === 'GET') {
            return {
              success: true,
              attachments: [],
            }
          }

          return undefined
        },
      },
    })

    await expect(page).toHaveURL(new RegExp(`/transactions/${expenseId}(?:\\?.*)?$`))
    const invoiceTab = page.locator('button').filter({ hasText: 'Rincian Faktur' }).first()
    await expect(invoiceTab).toBeVisible({
      timeout: 30000,
    })

    await invoiceTab.click()
    await expect(page.getByText('Besi 10 mm')).toBeVisible({ timeout: 15000 })
  })
})
