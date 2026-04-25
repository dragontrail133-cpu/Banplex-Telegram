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
    lastPaymentPermanentDeleteRequest: null,
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
        if (url.searchParams.get('transactionId') === paymentRecord.id) {
          return {
            success: true,
            record: state.deletedPayment ? paymentRecord : null,
          }
        }

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

      if (resource === 'bill-payments' && method === 'DELETE' && body?.action === 'permanent-delete') {
        state.deletedPayment = false
        state.lastPaymentPermanentDeleteRequest = body

        return {
          success: true,
          bill: state.lastBillSummary,
        }
      }

      return undefined
    },
  }
}

function buildEmptyRecycleBinMockApi() {
  return {
    notify: async () => ({ success: true }),
    transactions: async ({ method, url }) => {
      if (method === 'GET' && url.searchParams.get('view') === 'recycle-bin') {
        return {
          success: true,
          recycleBinRecords: [],
          cashMutations: [],
          pageInfo: {
            hasMore: false,
            nextCursor: null,
            totalCount: 0,
          },
        }
      }

      return undefined
    },
  }
}

function buildMasterRecycleBinMockApi() {
  const state = {
    deletedProject: true,
    lastRestoreRequest: null,
    lastRestoreRecord: null,
  }

  const deletedProject = {
    id: 'project-master-trash-1',
    team_id: 'e2e-team',
    name: 'Proyek Master Arsip',
    project_name: 'Proyek Master Arsip',
    budget: 5_000_000,
    is_active: false,
    deleted_at: '2026-04-21T08:00:00.000Z',
    updated_at: '2026-04-21T08:00:00.000Z',
  }

  return {
    state,
    notify: async () => ({ success: true }),
    supabase: async ({ method, url }) => {
      const tableName = url.pathname.split('/').filter(Boolean).at(-1)

      if (tableName !== 'projects') {
        return []
      }

      const deletedAtFilter = url.searchParams.get('deleted_at')

      if (method === 'GET' && deletedAtFilter === 'is.null') {
        return []
      }

      if (method === 'GET' && deletedAtFilter === 'not.is.null') {
        return state.deletedProject ? [deletedProject] : []
      }

      if (method === 'PATCH') {
        state.deletedProject = false
        state.lastRestoreRequest = {
          method,
          url: url.toString(),
        }
        state.lastRestoreRecord = {
          ...deletedProject,
          deleted_at: null,
          is_active: true,
          updated_at: '2026-04-21T08:05:00.000Z',
        }

        return state.lastRestoreRecord
      }

      return []
    },
  }
}

function buildRecycleBinRecordMockApi(record, { permanentDeleteRecordType = record.sourceType } = {}) {
  const state = {
    deleted: true,
    lastPermanentDeleteRequest: null,
  }

  return {
    state,
    notify: async () => ({ success: true }),
    transactions: async ({ method, url, body }) => {
      if (method === 'GET' && url.searchParams.get('view') === 'recycle-bin') {
        if (url.searchParams.get('transactionId') === record.id) {
          return {
            success: true,
            record: state.deleted ? record : null,
          }
        }

        const recycleBinRecords = state.deleted ? [record] : []

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

      if (
        method === 'DELETE' &&
        body?.action === 'permanent-delete' &&
        body?.recordType === permanentDeleteRecordType
      ) {
        state.deleted = false
        state.lastPermanentDeleteRequest = body

        return {
          success: true,
        }
      }

      return undefined
    },
  }
}

function buildBulkPermanentDeleteMockApi() {
  const restoreOnlyRecord = {
    id: 'expense-restore-only-1',
    sourceType: 'expense',
    type: 'expense',
    amount: 450_000,
    description: 'Pengeluaran Restore Only',
    deleted_at: '2026-04-21T07:00:00.000Z',
    updated_at: '2026-04-21T07:00:00.000Z',
    created_at: '2026-04-20T07:00:00.000Z',
    canPermanentDelete: false,
    canRestore: true,
    group: 'document',
  }
  const eligiblePaymentRecord = {
    id: 'loan-payment-bulk-1',
    sourceType: 'loan-payment',
    type: 'expense',
    amount: 350_000,
    description: 'Pembayaran Pinjaman Bulk',
    deleted_at: '2026-04-21T08:00:00.000Z',
    updated_at: '2026-04-21T08:00:00.000Z',
    created_at: '2026-04-20T08:00:00.000Z',
    canPermanentDelete: true,
    canRestore: true,
    group: 'payment',
  }
  const eligibleBillRecord = {
    id: 'bill-bulk-1',
    sourceType: 'bill',
    type: 'expense',
    amount: 900_000,
    description: 'Tagihan Bulk',
    deleted_at: '2026-04-21T09:00:00.000Z',
    updated_at: '2026-04-21T09:00:00.000Z',
    created_at: '2026-04-20T09:00:00.000Z',
    canPermanentDelete: true,
    canRestore: true,
    group: 'transaction',
  }
  const state = {
    records: [eligiblePaymentRecord, eligibleBillRecord, restoreOnlyRecord],
    lastBulkDeleteRequest: null,
  }

  return {
    state,
    notify: async () => ({ success: true }),
    transactions: async ({ method, url, body }) => {
      if (method === 'GET' && url.searchParams.get('view') === 'recycle-bin') {
        return {
          success: true,
          recycleBinRecords: state.records,
          cashMutations: state.records,
          pageInfo: {
            hasMore: false,
            nextCursor: null,
            totalCount: state.records.length,
          },
        }
      }

      if (method === 'DELETE' && body?.action === 'permanent-delete-all-eligible') {
        const deletedCount = state.records.filter(
          (record) => record.canPermanentDelete === true
        ).length

        state.records = state.records.filter((record) => record.canPermanentDelete !== true)
        state.lastBulkDeleteRequest = body

        return {
          success: true,
          deletedCount,
          skippedCount: 0,
          failedCount: 0,
          candidateCount: deletedCount,
          errors: [],
        }
      }

      return undefined
    },
  }
}

test.describe('restore surfaces', () => {
  test('opens transaction recycle bin', async ({ page }) => {
    await openApp(page, '/transactions/recycle-bin', {
      mockApi: buildEmptyRecycleBinMockApi(),
    })
    await expect(page.getByRole('heading', { name: 'Arsip', exact: true })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByText('Belum Ada Data Terhapus')).toBeVisible({
      timeout: 30000,
    })
  })

  test('opens master recycle bin', async ({ page }) => {
    await openApp(page, '/master/recycle-bin')
    await expectHeading(page, 'Arsip Master')
    await expect(page.getByRole('button', { name: 'Muat Ulang' })).toBeVisible()
  })

  test('restores a master project and keeps permanent delete hidden', async ({ page }) => {
    const mockApi = buildMasterRecycleBinMockApi()

    await openApp(page, '/master/recycle-bin', {
      mockApi,
    })

    await expectHeading(page, 'Arsip Master')
    await expect(page.getByRole('heading', { name: 'Proyek Master Arsip', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hapus Permanen' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Pulihkan' }).click()

    await expect(page.getByRole('heading', { name: 'Proyek Master Arsip', exact: true })).toHaveCount(0)
    await expect(page.getByText('Arsip master kosong')).toBeVisible()

    expect(mockApi.state.lastRestoreRecord).toMatchObject({
      id: 'project-master-trash-1',
      deleted_at: null,
      is_active: true,
    })
  })

  test('restores a bill tree and recalculates the restored summary', async ({ page }) => {
    const mockApi = buildBillTreeRestoreMockApi()

    await openApp(page, '/transactions/recycle-bin', {
      mockApi,
    })

    await expectHeading(page, 'Arsip')
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

    await expectHeading(page, 'Arsip')
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

  test('permanently deletes a bill payment leaf from the recycle bin', async ({ page }) => {
    const mockApi = buildBillPaymentRestoreMockApi()

    await openApp(page, '/transactions/recycle-bin', {
      mockApi,
    })

    await expectHeading(page, 'Arsip')
    await expect(page.getByRole('button', { name: /Pembayaran Restorasi Mandiri/ })).toBeVisible()

    await page.getByRole('button', { name: /Pembayaran Restorasi Mandiri/ }).click()

    page.once('dialog', async (dialog) => {
      await dialog.accept()
    })

    await page.getByRole('button', { name: 'Hapus Permanen' }).click()

    await expect(page.getByText('Belum Ada Data Terhapus')).toBeVisible()
    expect(mockApi.state.lastPaymentPermanentDeleteRequest).toMatchObject({
      action: 'permanent-delete',
      paymentId: 'bill-payment-restore-2',
    })
  })

  test('permanently deletes all eligible recycle bin records only', async ({ page }) => {
    const mockApi = buildBulkPermanentDeleteMockApi()

    await openApp(page, '/transactions/recycle-bin', {
      mockApi,
    })

    await expectHeading(page, 'Arsip')
    await expect(page.getByRole('button', { name: /Pembayaran Pinjaman Bulk/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Tagihan Bulk/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Pengeluaran Restore Only/ })).toBeVisible()

    page.once('dialog', async (dialog) => {
      await dialog.accept()
    })

    await page.getByRole('button', { name: 'Hapus Semua' }).click()

    await expect(page.getByRole('button', { name: /Pembayaran Pinjaman Bulk/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Tagihan Bulk/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Pengeluaran Restore Only/ })).toBeVisible()
    expect(mockApi.state.lastBulkDeleteRequest).toMatchObject({
      action: 'permanent-delete-all-eligible',
      teamId: 'e2e-team',
    })
  })

  test('keeps expense documents restore-only in the recycle bin', async ({ page }) => {
    const mockApi = buildRecycleBinRecordMockApi({
      id: 'expense-trash-1',
      sourceType: 'expense',
      type: 'expense',
      amount: 450_000,
      description: 'Pengeluaran Arsip',
      deleted_at: '2026-04-21T07:00:00.000Z',
      updated_at: '2026-04-21T07:00:00.000Z',
      created_at: '2026-04-20T07:00:00.000Z',
      canPermanentDelete: false,
      canRestore: true,
      group: 'document',
    })

    await openApp(page, '/transactions/recycle-bin', {
      mockApi,
    })

    await expectHeading(page, 'Arsip')
    await expect(page.getByRole('button', { name: /Pengeluaran Arsip/ })).toBeVisible()

    await page.getByRole('button', { name: /Pengeluaran Arsip/ }).click()

    await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hapus Permanen' })).toHaveCount(0)
  })

  test('permanently deletes an attendance record from the recycle bin', async ({ page }) => {
    const mockApi = buildRecycleBinRecordMockApi(
      {
        id: 'attendance-trash-1',
        sourceType: 'attendance-record',
        type: 'expense',
        amount: 250_000,
        description: 'Absensi Arsip',
        worker_name_snapshot: 'Budi Arsip',
        project_name_snapshot: 'Proyek Arsip',
        deleted_at: '2026-04-21T06:30:00.000Z',
        updated_at: '2026-04-21T06:30:00.000Z',
        created_at: '2026-04-20T06:30:00.000Z',
        canPermanentDelete: true,
        canRestore: true,
        group: 'transaction',
      },
      { permanentDeleteRecordType: 'attendance-record' }
    )

    await openApp(page, '/transactions/recycle-bin', {
      mockApi,
    })

    await expectHeading(page, 'Arsip')
    await expect(page.getByRole('button', { name: /Absensi Arsip/ })).toBeVisible()

    await page.getByRole('button', { name: /Absensi Arsip/ }).click()

    page.once('dialog', async (dialog) => {
      await dialog.accept()
    })

    await page.getByRole('button', { name: 'Hapus Permanen' }).click()

    await expect(page.getByText('Belum Ada Data Terhapus')).toBeVisible()
    expect(mockApi.state.lastPermanentDeleteRequest).toMatchObject({
      action: 'permanent-delete',
      recordType: 'attendance-record',
      id: 'attendance-trash-1',
    })
  })
})
