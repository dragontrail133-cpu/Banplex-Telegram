import { expect, test } from '@playwright/test'
import { expectDashboardShell, expectHeading, openApp } from './helpers/app.js'

test.describe('dashboard refresh', () => {
  test('keeps refresh button and shows loading feedback while refreshing', async ({ page }) => {
    let summaryRequestCount = 0
    let releaseSecondSummary = () => {}

    const workspaceTransactions = [
      {
        id: 'dashboard-refresh-e2e-1',
        sourceType: 'expense',
        source_type: 'expense',
        type: 'expense',
        expense_type: 'operasional',
        document_type: 'faktur',
        amount: 125000,
        description: 'Dashboard Refresh E2E',
        created_at: '2026-04-24T08:00:00.000Z',
        updated_at: '2026-04-24T08:00:00.000Z',
        sort_at: '2026-04-24T08:00:00.000Z',
        search_text: 'dashboard refresh e2e',
      },
    ]

    const secondSummaryResponse = new Promise((resolve) => {
      releaseSecondSummary = resolve
    })

    await openApp(page, '/', {
      mockApi: {
        transactions: async ({ view }) => {
          if (view === 'workspace') {
            return {
              success: true,
              workspaceTransactions,
              pageInfo: {
                hasMore: false,
                nextCursor: null,
                totalCount: workspaceTransactions.length,
              },
            }
          }

          if (view === 'summary') {
            summaryRequestCount += 1

            if (summaryRequestCount === 2) {
              await secondSummaryResponse
            }

            return {
              success: true,
              summary: {
                total_income: 125000,
                total_expense: 25000,
                ending_balance: 100000,
              },
            }
          }

          return undefined
        },
      },
    })

    await expectDashboardShell(page)

    const refreshButton = page.getByRole('button', { name: 'Refresh dashboard' })

    await refreshButton.click()
    await expect(refreshButton).toBeDisabled()
    await expect(refreshButton).toHaveAttribute('aria-busy', 'true')
    await expect.poll(() => summaryRequestCount).toBe(2)
    await expect(refreshButton.locator('svg')).toHaveClass(/animate-spin/)

    releaseSecondSummary()

    await expect(refreshButton).toBeEnabled({
      timeout: 20000,
    })
    await expect(refreshButton).toHaveAttribute('aria-busy', 'false')
  })

  test('routes the Tim quick action to the stock page', async ({ page }) => {
    await openApp(page)

    await expectDashboardShell(page)

    await page.getByRole('button', { name: 'Stok Barang' }).click()

    await expect(page).toHaveURL(/\/stock(?:\?.*)?$/)
    await expectHeading(page, 'Stok Barang')
  })
})
