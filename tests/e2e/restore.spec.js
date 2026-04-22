import { expect, test } from '@playwright/test'
import { expectHeading, openApp } from './helpers/app.js'

function buildBillTreeRestoreMockApi() {
  const state = {
    deletedBill: true,
    deletedPayment: true,
    lastBillRestoreRequest: null,
    lastBillRestoreRecord: null,
  }

  const billRecord = {
    id: 'bill-restore-1',
    sourceType: 'bill',
    type: 'expense',
    amount: 2_500_000,
    description: 'Tagihan Restorasi',
    deleted_at: '2026-04-21T08:00:00.000Z',
    updated_at: '2026-04-21T08:00:00.000Z',
    created_at: '2026-04-20T08:00:00.000Z',
    canPermanentDelete: true,
    canRestore: true,
    group: 'transaction',
  }

  const billPaymentRecord = {
    id: 'bill-payment-restore-1',
    sourceType: 'bill-payment',
    type: 'expense',
    amount: 1_000_000,
    description: 'Pembayaran Restorasi',
    bill_id: 'bill-restore-1',
    deleted_at: '2026-04-21T08:10:00.000Z',
    updated_at: '2026-04-21T08:10:00.000Z',
    created_at: '2026-04-20T09:00:00.000Z',
    canPermanentDelete: true,
    canRestore: true,
    group: 'payment',
  }

  return {
    state,
    notify: async () => ({ success: true }),
    transactions: async ({ method, url, body }) => {
      if (method === 'GET' && url.searchParams.get('view') === 'recycle-bin') {
        const recycleBinRecords = []

        if (state.deletedBill) {
          recycleBinRecords.push(billRecord)
        }

        if (state.deletedPayment) {
          recycleBinRecords.push(billPaymentRecord)
        }

        return {
          success: true,
          recycleBinRecords,
          cashMutations: recycleBinRecords,
          pageInfo: {
            hasMore: false,
            nextCursor: null,
            totalCount: recycleBinRecords.length,
          },
        }
      }

      if (method === 'PATCH' && body?.action === 'restore' && body?.recordType === 'bill') {
        state.deletedBill = false
        state.deletedPayment = false
        state.lastBillRestoreRequest = body
        state.lastBillRestoreRecord = {
          ...billRecord,
          deleted_at: null,
          paid_amount: 1_000_000,
          status: 'partial',
          paid_at: '2026-04-20T09:00:00.000Z',
          updated_at: '2026-04-21T08:11:00.000Z',
        }

        return {
          success: true,
          record: state.lastBillRestoreRecord,
        }
      }

      return undefined
    },
  }
}

function buildBillPaymentRestoreMockApi() {
  const state = {
    deletedPayment: true,
    lastPaymentRestoreRequest: null,
    lastBillSummary: null,
  }

  const paymentRecord = {
    id: 'bill-payment-restore-2',
    sourceType: 'bill-payment',
    type: 'expense',
    amount: 750_000,
    description: 'Pembayaran Restorasi Mandiri',
    bill_id: 'bill-restore-2',
    deleted_at: '2026-04-21T09:00:00.000Z',
    updated_at: '2026-04-21T09:00:00.000Z',
    created_at: '2026-04-20T09:15:00.000Z',
    canPermanentDelete: true,
    canRestore: true,
    group: 'payment',
  }

  return {
    state,
    notify: async () => ({ success: true }),
    transactions: async ({ method, url }) => {
      if (method === 'GET' && url.searchParams.get('view') === 'recycle-bin') {
        const recycleBinRecords = state.deletedPayment ? [paymentRecord] : []

        return {
          success: true,
          recycleBinRecords,
          cashMutations: recycleBinRecords,
          pageInfo: {
            hasMore: false,
            nextCursor: null,
            totalCount: recycleBinRecords.length,
          },
        }
      }

      return undefined
    },
    records: async ({ method, resource, body }) => {
      if (resource === 'bill-payments' && method === 'PATCH' && body?.action === 'restore') {
        state.deletedPayment = false
        state.lastPaymentRestoreRequest = body
        state.lastBillSummary = {
          id: 'bill-restore-2',
          paid_amount: 750_000,
          status: 'partial',
          paid_at: '2026-04-20T09:15:00.000Z',
        }

        return {
          success: true,
          payment: {
            ...paymentRecord,
            deleted_at: null,
            updated_at: '2026-04-21T09:01:00.000Z',
          },
          bill: state.lastBillSummary,
        }
      }

      return undefined
    },
  }
}

test.describe('restore surfaces', () => {
  test('opens transaction recycle bin', async ({ page }) => {
    await openApp(page, '/transactions/recycle-bin')
    await expectHeading(page, 'Halaman Sampah')
  })

  test('opens master recycle bin', async ({ page }) => {
    await openApp(page, '/master/recycle-bin')
    await expectHeading(page, 'Recycle Bin Master')
  })

  test('restores a bill tree and recalculates the restored summary', async ({ page }) => {
    const mockApi = buildBillTreeRestoreMockApi()

    await openApp(page, '/transactions/recycle-bin', {
      mockApi,
    })

    await expectHeading(page, 'Halaman Sampah')
    await expect(page.getByRole('button', { name: /Tagihan Restorasi/ })).toBeVisible()
    await page.getByRole('button', { name: /Tagihan Restorasi/ }).click()
    await page.getByRole('button', { name: 'Restore' }).click()

    await expect(page.getByRole('button', { name: /Tagihan Restorasi/ })).toHaveCount(0)
    await expect(page.getByText('Pembayaran Restorasi')).toHaveCount(0)
    expect(mockApi.state.lastBillRestoreRequest).toMatchObject({
      action: 'restore',
      recordType: 'bill',
      id: 'bill-restore-1',
    })
    expect(mockApi.state.lastBillRestoreRecord).toMatchObject({
      id: 'bill-restore-1',
      deleted_at: null,
      paid_amount: 1_000_000,
      status: 'partial',
      paid_at: '2026-04-20T09:00:00.000Z',
    })
  })

  test('restores a bill payment leaf and returns a synced bill summary', async ({ page }) => {
    const mockApi = buildBillPaymentRestoreMockApi()

    await openApp(page, '/transactions/recycle-bin', {
      mockApi,
    })

    await expectHeading(page, 'Halaman Sampah')
    await expect(page.getByRole('button', { name: /Pembayaran Restorasi Mandiri/ })).toBeVisible()
    await page.getByRole('button', { name: /Pembayaran Restorasi Mandiri/ }).click()
    await page.getByRole('button', { name: 'Restore' }).click()

    await expect(page.getByRole('button', { name: /Pembayaran Restorasi Mandiri/ })).toHaveCount(0)
    expect(mockApi.state.lastPaymentRestoreRequest).toMatchObject({
      action: 'restore',
      paymentId: 'bill-payment-restore-2',
    })
    expect(mockApi.state.lastBillSummary).toMatchObject({
      id: 'bill-restore-2',
      paid_amount: 750_000,
      status: 'partial',
      paid_at: '2026-04-20T09:15:00.000Z',
    })
  })
})
