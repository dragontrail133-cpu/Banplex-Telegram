import { expect, test } from '@playwright/test'
import { expectHeading, openApp } from './helpers/app.js'

function cloneBill(bill) {
  return bill ? { ...bill, payments: Array.isArray(bill.payments) ? bill.payments.map((payment) => ({ ...payment })) : [] } : null
}

function makeTagihanUpahBill(overrides = {}) {
  const createdAt = overrides.created_at ?? overrides.createdAt ?? '2026-04-26T09:00:00.000Z'
  const amount = Number(overrides.amount ?? 750000)

  return {
    id: overrides.id ?? 'bill-created-1',
    team_id: overrides.team_id ?? 'e2e-team',
    teamId: overrides.teamId ?? 'e2e-team',
    staff_id: overrides.staff_id ?? 'staff-e2e-1',
    staffId: overrides.staffId ?? 'staff-e2e-1',
    project_id: overrides.project_id ?? null,
    projectId: overrides.projectId ?? null,
    bill_type: overrides.bill_type ?? 'gaji',
    billType: overrides.billType ?? 'gaji',
    description: overrides.description ?? 'Tagihan Upah Staff A E2E',
    amount,
    paid_amount: overrides.paid_amount ?? 0,
    paidAmount: overrides.paidAmount ?? 0,
    remaining_amount: overrides.remaining_amount ?? amount,
    remainingAmount: overrides.remainingAmount ?? amount,
    due_date: overrides.due_date ?? '2026-04-30',
    dueDate: overrides.dueDate ?? '2026-04-30',
    status: overrides.status ?? 'unpaid',
    paid_at: overrides.paid_at ?? null,
    paidAt: overrides.paidAt ?? null,
    worker_name_snapshot: overrides.worker_name_snapshot ?? 'Staff A E2E',
    workerName: overrides.workerName ?? 'Staff A E2E',
    supplier_name_snapshot: overrides.supplier_name_snapshot ?? null,
    supplierName: overrides.supplierName ?? null,
    project_name_snapshot: overrides.project_name_snapshot ?? 'Proyek E2E',
    projectName: overrides.projectName ?? 'Proyek E2E',
    notes: overrides.notes ?? 'Tagihan upah manual',
    payments: Array.isArray(overrides.payments)
      ? overrides.payments.map((payment) => ({ ...payment }))
      : [],
    created_at: createdAt,
    createdAt,
    updated_at: overrides.updated_at ?? createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
  }
}

function createTagihanUpahMockApi() {
  const state = {
    createdBills: [],
    lastCreateBillRequest: null,
  }

  const masterRows = {
    staff: [
      {
        id: 'staff-e2e-1',
        staff_name: 'Staff A E2E',
        payment_type: 'per_termin',
        fee_percentage: 10,
        fee_amount: 0,
        salary: 0,
        deleted_at: null,
        team_id: 'e2e-team',
      },
    ],
    projects: [
      {
        id: 'project-e2e-1',
        name: 'Proyek E2E',
        project_name: 'Proyek E2E',
        status: 'active',
        deleted_at: null,
        team_id: 'e2e-team',
      },
    ],
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
      if (resource !== 'bills') {
        return undefined
      }

      if (method === 'GET') {
        const billId = url.searchParams.get('billId')

        if (billId) {
          const bill = state.createdBills.find((item) => String(item.id) === String(billId)) ?? null

          return {
            success: true,
            bill: cloneBill(bill),
          }
        }

        return {
          success: true,
          bills: state.createdBills.map(cloneBill),
        }
      }

      if (method === 'POST') {
        state.lastCreateBillRequest = body

        const createdBill = makeTagihanUpahBill({
          amount: Number(body?.amount ?? 0),
          bill_type: body?.bill_type ?? body?.billType ?? 'gaji',
          description: body?.description ?? 'Tagihan Upah Staff A E2E',
          due_date: body?.due_date ?? body?.dueDate ?? body?.date ?? '2026-04-30',
          notes: body?.notes ?? 'Tagihan upah manual',
          project_id: body?.project_id ?? body?.projectId ?? null,
          project_name_snapshot:
            body?.project_name_snapshot ?? body?.projectName ?? 'Proyek E2E',
          staff_id: body?.staff_id ?? body?.staffId ?? 'staff-e2e-1',
          worker_name_snapshot: body?.staff_name_snapshot ?? 'Staff A E2E',
        })

        state.createdBills = [createdBill]

        return {
          success: true,
          bill: cloneBill(createdBill),
        }
      }

      return undefined
    },
    supabase: async ({ url }) => {
      const tableName = url.pathname.split('/').filter(Boolean).at(-1)

      if (tableName === 'staff') {
        return masterRows.staff.map((row) => ({ ...row }))
      }

      if (tableName === 'projects') {
        return masterRows.projects.map((row) => ({ ...row }))
      }

      return []
    },
  }
}

test.describe('create surfaces', () => {
  test('opens attendance create sheet', async ({ page }) => {
    await openApp(page, '/attendance/new')
    await expectHeading(page, 'Absensi Harian')
  })

  test('opens material invoice create sheet', async ({ page }) => {
    await openApp(page, '/material-invoice/new')
    await expectHeading(page, 'Faktur Material')
  })

  test('opens tagihan upah shell from pembayaran', async ({ page }) => {
    await openApp(page, '/pembayaran')
    await expectHeading(page, 'Pembayaran')

    await page.getByRole('button', { name: 'Tambah Tagihan Upah' }).click()

    await expectHeading(page, 'Tambah Tagihan Upah')
    await expect(page.getByRole('heading', { name: 'Data Utama' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Tanggal' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Nominal' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Catatan' })).toBeVisible()
  })

  test('saves tagihan upah and returns to pembayaran', async ({ page }) => {
    page.setDefaultNavigationTimeout(120_000)
    const mockApi = createTagihanUpahMockApi()

    await openApp(page, '/pembayaran', {
      mockApi,
    })

    await expectHeading(page, 'Pembayaran')
    await page.getByRole('button', { name: 'Tambah Tagihan Upah' }).click()
    await expectHeading(page, 'Tambah Tagihan Upah')

    await page.getByRole('button', { name: 'Pilih data Ubah' }).first().click()
    await page.getByRole('button', { name: 'Staff A E2E' }).click()

    await page.getByLabel('Tanggal Tagih').fill('2026-04-26')
    await page.getByLabel('Jatuh Tempo').fill('2026-04-30')
    await page.getByLabel('Nominal Tagihan').fill('750000')
    await page.getByLabel('Catatan').fill('Tagihan upah manual')

    await page.getByRole('button', { name: 'Simpan Tagihan Upah' }).click()

    await expect(page).toHaveURL(/\/pembayaran(?:\?.*)?$/)
    await expectHeading(page, 'Pembayaran')
    await expect(page.getByRole('button', { name: /Staff A E2E/ })).toBeVisible({
      timeout: 30000,
    })
    expect(mockApi.state.lastCreateBillRequest).toMatchObject({
      bill_type: 'gaji',
      staff_id: 'staff-e2e-1',
      due_date: '2026-04-30',
      amount: 750000,
      notes: 'Tagihan upah manual',
      description: 'Tagihan Upah Staff A E2E',
    })
  })
})
