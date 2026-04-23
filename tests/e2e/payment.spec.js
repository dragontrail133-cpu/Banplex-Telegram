import { expect, test } from '@playwright/test'
import { openApp } from './helpers/app.js'

const paymentDate = '2026-04-21'

test.describe.configure({ timeout: 240_000 })

function clonePayment(payment) {
  return payment ? { ...payment } : null
}

function makeActivePayment(overrides = {}) {
  return {
    id: overrides.id ?? 'payment-live-1',
    billId: overrides.billId ?? 'bill-e2e-1',
    bill_id: overrides.bill_id ?? overrides.billId ?? 'bill-e2e-1',
    amount: overrides.amount ?? 750_000,
    notes: overrides.notes ?? 'Pembayaran Aktif E2E',
    paymentDate: overrides.paymentDate ?? paymentDate,
    createdAt: overrides.createdAt ?? '2026-04-21T09:00:00.000Z',
    created_at: overrides.created_at ?? overrides.createdAt ?? '2026-04-21T09:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-04-21T09:00:00.000Z',
    updated_at: overrides.updated_at ?? overrides.updatedAt ?? '2026-04-21T09:00:00.000Z',
    deleted_at: overrides.deleted_at ?? null,
    deletedAt: overrides.deletedAt ?? null,
    canRestore: overrides.canRestore ?? false,
    canPermanentDelete: overrides.canPermanentDelete ?? false,
    worker_name_snapshot: overrides.worker_name_snapshot ?? 'Budi E2E',
    supplier_name_snapshot: overrides.supplier_name_snapshot ?? 'Budi E2E',
    project_name_snapshot: overrides.project_name_snapshot ?? 'Proyek E2E',
  }
}

function makeDeletedPayment(overrides = {}) {
  return {
    id: overrides.id ?? 'payment-trash-1',
    billId: overrides.billId ?? 'bill-e2e-1',
    bill_id: overrides.bill_id ?? overrides.billId ?? 'bill-e2e-1',
    amount: overrides.amount ?? 750_000,
    notes: overrides.notes ?? 'Pembayaran Terhapus E2E',
    paymentDate: overrides.paymentDate ?? paymentDate,
    createdAt: overrides.createdAt ?? '2026-04-20T09:00:00.000Z',
    created_at: overrides.created_at ?? overrides.createdAt ?? '2026-04-20T09:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-04-20T09:00:00.000Z',
    updated_at: overrides.updated_at ?? overrides.updatedAt ?? '2026-04-20T09:00:00.000Z',
    deleted_at: overrides.deleted_at ?? '2026-04-21T09:10:00.000Z',
    deletedAt: overrides.deletedAt ?? '2026-04-21T09:10:00.000Z',
    canRestore: overrides.canRestore ?? true,
    canPermanentDelete: overrides.canPermanentDelete ?? true,
    worker_name_snapshot: overrides.worker_name_snapshot ?? 'Budi E2E',
    supplier_name_snapshot: overrides.supplier_name_snapshot ?? 'Budi E2E',
    project_name_snapshot: overrides.project_name_snapshot ?? 'Proyek E2E',
  }
}

function createPaymentsPageMockApi({
  activePayments = [],
  deletedPayments = [],
} = {}) {
  const state = {
    activePayments: activePayments.map(clonePayment),
    deletedPayments: deletedPayments.map(clonePayment),
    lastArchiveRequest: null,
    lastRestoreRequest: null,
    lastPermanentDeleteRequest: null,
  }

  const baseBill = {
    id: 'bill-e2e-1',
    team_id: 'e2e-team',
    teamId: 'e2e-team',
    bill_type: 'gaji',
    billType: 'gaji',
    description: 'Tagihan gaji Budi E2E',
    amount: 1_500_000,
    due_date: '2026-04-30',
    dueDate: '2026-04-30',
    worker_id: 'worker-e2e-1',
    workerId: 'worker-e2e-1',
    worker_name_snapshot: 'Budi E2E',
    workerName: 'Budi E2E',
    project_name_snapshot: 'Proyek E2E',
    projectName: 'Proyek E2E',
    created_at: '2026-04-20T00:00:00.000Z',
    createdAt: '2026-04-20T00:00:00.000Z',
    updated_at: '2026-04-20T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
  }

  function syncBill() {
    const paidAmount = state.activePayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0)
    const remainingAmount = Math.max(Number(baseBill.amount ?? 0) - paidAmount, 0)

    return {
      ...baseBill,
      paid_amount: paidAmount,
      paidAmount,
      remaining_amount: remainingAmount,
      remainingAmount,
      status: paidAmount > 0 ? (remainingAmount > 0 ? 'partial' : 'paid') : 'unpaid',
      payments: state.activePayments.map(clonePayment),
      updated_at: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  function archivePayment(paymentId, body) {
    const paymentIndex = state.activePayments.findIndex((payment) => String(payment.id) === String(paymentId))

    if (paymentIndex < 0) {
      return null
    }

    const archivedPayment = clonePayment(state.activePayments[paymentIndex])
    const timestamp = new Date().toISOString()

    state.activePayments.splice(paymentIndex, 1)
    state.deletedPayments = [
      {
        ...archivedPayment,
        deleted_at: timestamp,
        deletedAt: timestamp,
        updated_at: timestamp,
        updatedAt: timestamp,
        canRestore: true,
        canPermanentDelete: true,
      },
      ...state.deletedPayments,
    ]
    state.lastArchiveRequest = body

    return {
      payment: archivedPayment,
      bill: syncBill(),
    }
  }

  function restorePayment(paymentId, body) {
    const paymentIndex = state.deletedPayments.findIndex((payment) => String(payment.id) === String(paymentId))

    if (paymentIndex < 0) {
      return null
    }

    const restoredPayment = clonePayment(state.deletedPayments[paymentIndex])
    const timestamp = new Date().toISOString()

    state.deletedPayments.splice(paymentIndex, 1)
    state.activePayments = [
      {
        ...restoredPayment,
        deleted_at: null,
        deletedAt: null,
        updated_at: timestamp,
        updatedAt: timestamp,
        canRestore: false,
        canPermanentDelete: false,
      },
      ...state.activePayments,
    ]
    state.lastRestoreRequest = body

    return {
      payment: restoredPayment,
      bill: syncBill(),
    }
  }

  function permanentDeletePayment(paymentId, body) {
    const paymentIndex = state.deletedPayments.findIndex((payment) => String(payment.id) === String(paymentId))

    if (paymentIndex < 0) {
      return null
    }

    state.deletedPayments.splice(paymentIndex, 1)
    state.lastPermanentDeleteRequest = body

    return {
      bill: syncBill(),
    }
  }

  return {
    state,
    notify: async () => ({ success: true }),
    transactions: async ({ method, url }) => {
      if (method === 'GET' && url.searchParams.get('view') === 'workspace') {
        return {
          success: true,
          workspaceTransactions: [],
          pageInfo: {
            hasMore: false,
            nextCursor: null,
            totalCount: 0,
          },
        }
      }

      return undefined
    },
    records: async ({ method, resource, url, body }) => {
      const billId = url.searchParams.get('billId')
      const view = url.searchParams.get('view')

      if (resource === 'bills' && method === 'GET' && billId) {
        return {
          success: true,
          bill: syncBill(),
        }
      }

      if (resource === 'bills' && method === 'GET') {
        return {
          success: true,
          bills: [syncBill()],
        }
      }

      if (resource === 'bill-payments' && method === 'GET' && view === 'recycle-bin') {
        return {
          success: true,
          payments: state.deletedPayments.map(clonePayment),
        }
      }

      if (resource === 'bill-payments' && method === 'DELETE') {
        if (body?.action === 'permanent-delete') {
          const result = permanentDeletePayment(
            String(body?.paymentId ?? body?.payment_id ?? ''),
            body
          )

          return result ? { success: true, ...result } : { success: true, bill: syncBill() }
        }

        const result = archivePayment(String(body?.paymentId ?? body?.payment_id ?? ''), body)

        return result ? { success: true, ...result } : { success: true, bill: syncBill() }
      }

      if (resource === 'bill-payments' && method === 'PATCH' && body?.action === 'restore') {
        const result = restorePayment(String(body?.paymentId ?? body?.payment_id ?? ''), body)

        return result ? { success: true, ...result } : { success: true, bill: syncBill() }
      }

      return undefined
    },
    supabase: async ({ url }) => {
      const tableName = url.pathname.split('/').filter(Boolean).at(-1)

      if (tableName === 'loans') {
        return []
      }

      return []
    },
  }
}

test.describe('payment surfaces', () => {
  test('archives an active payment row', async ({ page }) => {
    page.setDefaultNavigationTimeout(120_000)
    const mockApi = createPaymentsPageMockApi({
      activePayments: [makeActivePayment()],
    })

    await openApp(page, '/pembayaran?group=worker-e2e-1', {
      mockApi,
    })

    await expect(page.getByRole('heading', { name: 'Budi E2E', exact: true })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByRole('button', { name: 'Riwayat' })).toBeVisible({
      timeout: 30000,
    })
    await page.getByRole('button', { name: 'Riwayat' }).click()
    await expect(page.getByRole('button', { name: 'Riwayat', pressed: true })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByText('Pembayaran Aktif E2E')).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByRole('button', { name: 'Arsipkan pembayaran' })).toBeVisible({
      timeout: 30000,
    })

    page.once('dialog', async (dialog) => {
      await dialog.accept()
    })
    await page.getByRole('button', { name: 'Arsipkan pembayaran' }).click()

    await expect(page.getByRole('button', { name: 'Arsipkan pembayaran' })).toHaveCount(0, {
      timeout: 30000,
    })
    await expect(page.getByRole('button', { name: 'Pulihkan pembayaran' })).toBeVisible({
      timeout: 30000,
    })
    expect(mockApi.state.lastArchiveRequest).toMatchObject({
      paymentId: 'payment-live-1',
      teamId: 'e2e-team',
    })
  })

  test('restores a deleted payment row', async ({ page }) => {
    page.setDefaultNavigationTimeout(120_000)
    const mockApi = createPaymentsPageMockApi({
      deletedPayments: [makeDeletedPayment()],
    })

    await openApp(page, '/pembayaran?group=worker-e2e-1', {
      mockApi,
    })

    await expect(page.getByRole('heading', { name: 'Budi E2E', exact: true })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByRole('button', { name: 'Riwayat' })).toBeVisible({
      timeout: 30000,
    })
    await page.getByRole('button', { name: 'Riwayat' }).click()
    await expect(page.getByRole('button', { name: 'Riwayat', pressed: true })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByText('Pembayaran Terhapus E2E')).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByRole('button', { name: 'Pulihkan pembayaran' })).toBeVisible({
      timeout: 30000,
    })

    await page.getByRole('button', { name: 'Pulihkan pembayaran' }).click()

    await expect(page.getByRole('button', { name: 'Pulihkan pembayaran' })).toHaveCount(0, {
      timeout: 30000,
    })
    await expect(page.getByRole('button', { name: 'Arsipkan pembayaran' })).toBeVisible({
      timeout: 30000,
    })
    expect(mockApi.state.lastRestoreRequest).toMatchObject({
      action: 'restore',
      paymentId: 'payment-trash-1',
      teamId: 'e2e-team',
    })
  })

  test('permanently deletes a deleted payment row', async ({ page }) => {
    page.setDefaultNavigationTimeout(120_000)
    const mockApi = createPaymentsPageMockApi({
      deletedPayments: [makeDeletedPayment()],
    })

    await openApp(page, '/pembayaran?group=worker-e2e-1', {
      mockApi,
    })

    await expect(page.getByRole('heading', { name: 'Budi E2E', exact: true })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByRole('button', { name: 'Riwayat' })).toBeVisible({
      timeout: 30000,
    })
    await page.getByRole('button', { name: 'Riwayat' }).click()
    await expect(page.getByRole('button', { name: 'Riwayat', pressed: true })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByText('Pembayaran Terhapus E2E')).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByRole('button', { name: 'Hapus permanen pembayaran' })).toBeVisible({
      timeout: 30000,
    })

    page.once('dialog', async (dialog) => {
      await dialog.accept()
    })
    await page.getByRole('button', { name: 'Hapus permanen pembayaran' }).click()

    await expect(page.getByText('Belum ada riwayat pembayaran aktif.')).toBeVisible({
      timeout: 30000,
    })
    expect(mockApi.state.lastPermanentDeleteRequest).toMatchObject({
      action: 'permanent-delete',
      paymentId: 'payment-trash-1',
      teamId: 'e2e-team',
    })
  })
})
