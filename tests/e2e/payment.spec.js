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
    lastReportDeliveryRequest: null,
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

function makeFeeBill(overrides = {}) {
  const createdAt = overrides.createdAt ?? '2026-04-18T09:00:00.000Z'

  return {
    id: overrides.id ?? 'bill-fee-oldest',
    billId: overrides.billId ?? overrides.id ?? 'bill-fee-oldest',
    bill_id: overrides.bill_id ?? overrides.billId ?? overrides.id ?? 'bill-fee-oldest',
    team_id: overrides.team_id ?? 'e2e-team',
    teamId: overrides.teamId ?? 'e2e-team',
    bill_type: overrides.bill_type ?? 'fee',
    billType: overrides.billType ?? 'fee',
    description: overrides.description ?? 'Fee termin Proyek E2E - Staff A',
    amount: overrides.amount ?? 100_000,
    paid_amount: overrides.paid_amount ?? 0,
    paidAmount: overrides.paidAmount ?? 0,
    remaining_amount: overrides.remaining_amount ?? overrides.amount ?? 100_000,
    remainingAmount: overrides.remainingAmount ?? overrides.remaining_amount ?? overrides.amount ?? 100_000,
    due_date: overrides.due_date ?? '2026-04-20',
    dueDate: overrides.dueDate ?? '2026-04-20',
    status: overrides.status ?? 'unpaid',
    paid_at: overrides.paid_at ?? null,
    paidAt: overrides.paidAt ?? null,
    project_income_id: overrides.project_income_id ?? 'income-fee-1',
    projectIncomeId: overrides.projectIncomeId ?? 'income-fee-1',
    staff_id: overrides.staff_id ?? 'staff-e2e-1',
    staffId: overrides.staffId ?? 'staff-e2e-1',
    worker_name_snapshot: overrides.worker_name_snapshot ?? 'Staff A',
    workerName: overrides.workerName ?? 'Staff A',
    project_name_snapshot: overrides.project_name_snapshot ?? 'Proyek E2E',
    projectName: overrides.projectName ?? 'Proyek E2E',
    supplier_name_snapshot: overrides.supplier_name_snapshot ?? null,
    supplierName: overrides.supplierName ?? 'Staff A',
    created_at: overrides.created_at ?? createdAt,
    createdAt: overrides.createdAt ?? createdAt,
    updated_at: overrides.updated_at ?? createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
  }
}

function createBillsPageMockApi({ bills = [] } = {}) {
  const state = {
    bills: bills.map(clonePayment),
  }

  const billById = new Map(
    state.bills
      .map((bill) => [String(bill?.id ?? ''), bill])
      .filter(([billId]) => Boolean(billId))
  )

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
    records: async ({ method, resource, url }) => {
      if (resource !== 'bills' || method !== 'GET') {
        return undefined
      }

      const billId = url.searchParams.get('billId')

      if (billId) {
        return {
          success: true,
          bill: clonePayment(billById.get(String(billId)) ?? null),
        }
      }

      return {
        success: true,
        bills: state.bills.map(clonePayment),
      }
    },
    supabase: async () => [],
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

  test('returns from technical payment detail to the same payment form', async ({ page }) => {
    page.setDefaultNavigationTimeout(120_000)
    const mockApi = createPaymentsPageMockApi({
      activePayments: [makeActivePayment()],
    })

    await openApp(page, '/payment/bill-e2e-1/technical', {
      mockApi,
    })

    await expect(
      page.getByRole('heading', { name: 'Detail Teknis Pembayaran Tagihan Upah' })
    ).toBeVisible({
      timeout: 30000,
    })
    await page.getByRole('button', { name: 'Kembali' }).click()

    await expect(page).toHaveURL(new RegExp('/payment/bill-e2e-1$'))
    await expect(page.getByRole('heading', { name: 'Pembayaran Tagihan Upah' })).toBeVisible({
      timeout: 30000,
    })
  })

  test('groups fee bills by staff and opens the oldest outstanding bill', async ({ page }) => {
    page.setDefaultNavigationTimeout(120_000)
    const mockApi = createBillsPageMockApi({
      bills: [
        makeFeeBill({
          id: 'bill-fee-oldest',
          description: 'Fee termin Proyek E2E - Staff A',
          amount: 100_000,
          paid_amount: 50_000,
          remaining_amount: 50_000,
          remainingAmount: 50_000,
          status: 'partial',
          due_date: '2026-04-20',
          dueDate: '2026-04-20',
          created_at: '2026-04-18T09:00:00.000Z',
          createdAt: '2026-04-18T09:00:00.000Z',
        }),
        makeFeeBill({
          id: 'bill-fee-newer',
          description: 'Fee termin Proyek E2E - Staff A',
          amount: 120_000,
          paid_amount: 0,
          paidAmount: 0,
          remaining_amount: 120_000,
          remainingAmount: 120_000,
          status: 'unpaid',
          due_date: '2026-04-22',
          dueDate: '2026-04-22',
          created_at: '2026-04-19T09:00:00.000Z',
          createdAt: '2026-04-19T09:00:00.000Z',
        }),
      ],
    })

    await openApp(page, '/transactions?tab=tagihan', {
      mockApi,
    })

    await expect(page.getByRole('button', { name: /Staff A/ })).toBeVisible({
      timeout: 30000,
    })

    await page.getByRole('button', { name: /Staff A/ }).click()

    await expect(page).toHaveURL(/\/payment\/bill-fee-oldest(?:\?.*)?$/)
  })

  test('sends a bill receipt to telegram dm from payment history', async ({ page }) => {
    page.setDefaultNavigationTimeout(120_000)
    const mockApi = createPaymentsPageMockApi({
      activePayments: [makeActivePayment()],
    })

    mockApi.reportDelivery = async ({ body }) => {
      mockApi.state.lastReportDeliveryRequest = body

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
        fileName: 'kwitansi-tagihan-bill-e2e-1-payment-live-1-20260424.pdf',
        pdfError: null,
      }
    }

    await openApp(page, '/pembayaran?group=worker-e2e-1', {
      mockApi,
      telegram: {
        user: {
          id: 20005,
          first_name: 'Mini',
          last_name: 'Pay',
          username: 'mini_pay_user',
        },
        startParam: '',
      },
    })

    await expect(page.getByRole('heading', { name: 'Budi E2E', exact: true })).toBeVisible({
      timeout: 30000,
    })
    await page.getByRole('button', { name: 'Riwayat' }).click()
    const sendReceiptButton = page.getByRole('button', { name: 'Kirim' }).first()

    await expect(sendReceiptButton).toBeVisible({
      timeout: 30000,
    })

    await sendReceiptButton.click()

    await expect(page.getByRole('button', { name: 'Kirim' }).first()).toBeVisible({
      timeout: 30000,
    })
    expect(mockApi.state.lastReportDeliveryRequest).toMatchObject({
      deliveryKind: 'payment_receipt',
      paymentType: 'bill',
      payment: {
        id: 'payment-live-1',
        billId: 'bill-e2e-1',
      },
      parentRecord: {
        id: 'bill-e2e-1',
      },
    })
  })
})
