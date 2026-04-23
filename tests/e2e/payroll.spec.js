import { expect, test } from '@playwright/test'
import { openApp } from './helpers/app.js'

const paymentDate = '2026-04-21'

function toIsoTimestamp(index = 0) {
  return new Date(Date.parse(`${paymentDate}T10:00:00.000Z`) + index * 60_000).toISOString()
}

function cloneBill(bill) {
  return bill ? { ...bill } : null
}

function buildPayrollFixture() {
  const state = {
    payableBill: {
      id: 'salary-bill-e2e-payable',
      teamId: 'e2e-team',
      billType: 'gaji',
      description: 'Tagihan gaji Budi E2E',
      amount: 1_500_000,
      paidAmount: 0,
      remainingAmount: 1_500_000,
      dueDate: '2026-04-21',
      status: 'unpaid',
      workerId: 'worker-e2e-1',
      workerName: 'Budi E2E',
      worker_name_snapshot: 'Budi E2E',
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
      deletedAt: null,
      payments: [],
    },
    historyBill: {
      id: 'salary-bill-e2e-history',
      teamId: 'e2e-team',
      billType: 'gaji',
      description: 'Tagihan gaji Budi E2E periode April',
      amount: 1_500_000,
      paidAmount: 250_000,
      remainingAmount: 1_250_000,
      dueDate: '2026-04-22',
      status: 'partial',
      workerId: 'worker-e2e-1',
      workerName: 'Budi E2E',
      worker_name_snapshot: 'Budi E2E',
      createdAt: '2026-04-19T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
      deletedAt: null,
      payments: [
        {
          id: 'salary-payment-history-1',
          billId: 'salary-bill-e2e-history',
          teamId: 'e2e-team',
          amount: 250000,
          paymentDate: '2026-04-20',
          notes: 'Bayar termin awal',
          createdAt: toIsoTimestamp(0),
          updatedAt: toIsoTimestamp(0),
          deletedAt: null,
          worker_name_snapshot: 'Budi E2E',
        },
      ],
    },
    attendanceRows: [
      {
        id: 'attendance-e2e-1',
        worker_id: 'worker-e2e-1',
        worker_name_snapshot: 'Budi E2E',
        project_id: 'project-e2e-1',
        project_name_snapshot: 'Proyek E2E',
        attendance_date: '2026-04-20',
        attendance_status: 'full_day',
        billing_status: 'billed',
        salary_bill_id: 'salary-bill-e2e-history',
        total_pay: 750000,
        notes: 'Shift pagi',
        salary_bill: {
          id: 'salary-bill-e2e-history',
          bill_type: 'gaji',
          amount: 1500000,
          paid_amount: 250000,
          due_date: '2026-04-22',
          status: 'partial',
          paid_at: null,
          description: 'Tagihan gaji Budi E2E periode April',
          deleted_at: null,
        },
      },
      {
        id: 'attendance-e2e-2',
        worker_id: 'worker-e2e-1',
        worker_name_snapshot: 'Budi E2E',
        project_id: 'project-e2e-1',
        project_name_snapshot: 'Proyek E2E',
        attendance_date: '2026-04-21',
        attendance_status: 'half_day',
        billing_status: 'unbilled',
        salary_bill_id: null,
        total_pay: 750000,
        notes: 'Shift siang',
        salary_bill: null,
      },
    ],
    deletedBillPayments: [
      {
        id: 'deleted-salary-payment-1',
        billId: 'salary-bill-e2e-history',
        teamId: 'e2e-team',
        amount: 100000,
        paymentDate: '2026-04-19',
        notes: 'Pembayaran terhapus',
        createdAt: toIsoTimestamp(1),
        updatedAt: toIsoTimestamp(1),
        deleted_at: '2026-04-21T00:00:00.000Z',
        canRestore: true,
        canPermanentDelete: true,
        worker_name_snapshot: 'Budi E2E',
      },
    ],
    projects: [
      {
        id: 'project-e2e-1',
        name: 'Proyek E2E',
        project_name: 'Proyek E2E',
        status: 'active',
        is_active: true,
        deleted_at: null,
      },
    ],
    workers: [
      {
        id: 'worker-e2e-1',
        name: 'Budi E2E',
        worker_name: 'Budi E2E',
        default_role_name: 'Helper',
        is_active: true,
        deleted_at: null,
      },
    ],
    workerWageRates: [
      {
        id: 'rate-e2e-1',
        team_id: 'e2e-team',
        worker_id: 'worker-e2e-1',
        project_id: 'project-e2e-1',
        role_name: 'Tukang',
        wage_amount: 750000,
        is_default: true,
        deleted_at: null,
        created_at: '2026-04-18T00:00:00.000Z',
        workers: {
          id: 'worker-e2e-1',
          name: 'Budi E2E',
          worker_name: 'Budi E2E',
        },
        projects: {
          id: 'project-e2e-1',
          name: 'Proyek E2E',
          project_name: 'Proyek E2E',
        },
      },
    ],
  }

  function syncBill() {
    const paidAmount = state.payableBill.payments.reduce(
      (total, payment) => total + Number(payment.amount ?? 0),
      0
    )
    const remainingAmount = Math.max(Number(state.payableBill.amount ?? 0) - paidAmount, 0)

    state.payableBill.paidAmount = paidAmount
    state.payableBill.remainingAmount = remainingAmount
    state.payableBill.status = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid'
    state.payableBill.updatedAt = toIsoTimestamp(state.payableBill.payments.length)
  }

  function createPayment(payload = {}) {
    const payment = {
      id: `salary-payment-${state.payableBill.payments.length + 1}`,
      billId: state.payableBill.id,
      teamId: state.payableBill.teamId,
      amount: Number(payload.amount ?? 0),
      paymentDate: String(payload.payment_date ?? paymentDate),
      notes: String(payload.notes ?? '').trim(),
      createdAt: toIsoTimestamp(state.payableBill.payments.length + 1),
      updatedAt: toIsoTimestamp(state.payableBill.payments.length + 1),
      deletedAt: null,
      worker_name_snapshot: state.payableBill.workerName,
    }

    state.payableBill.payments.unshift(payment)
    syncBill()

    return payment
  }

  function buildBillPayload(bill) {
    return {
      ...bill,
      payments: bill.payments.map(cloneBill),
    }
  }

  function buildAttendanceRows() {
    return state.attendanceRows.map(cloneBill)
  }

  function buildDeletedBillPayments() {
    return state.deletedBillPayments.map(cloneBill)
  }

  return {
    state,
    createPayment,
    buildBillPayload,
    buildAttendanceRows,
    buildDeletedBillPayments,
  }
}

function createPayrollMockApi() {
  const fixture = buildPayrollFixture()

  return {
    notify: async () => ({ success: true }),
    records: async ({ method, resource, url, body }) => {
      if (resource === 'attendance-history' && method === 'GET' && url.searchParams.get('view') === 'summary') {
        return {
          success: true,
          summary: {
            month: '2026-04',
            attendanceCount: 2,
            dailyGroups: [],
            workerGroups: [
              {
                workerId: fixture.state.payableBill.workerId,
                workerName: fixture.state.payableBill.workerName,
                title: fixture.state.payableBill.workerName,
                description: '2 record',
                records: fixture.buildAttendanceRows(),
                recapableCount: 1,
                recordCount: 2,
                billedCount: 1,
                unbilledCount: 1,
              },
            ],
          },
        }
      }

      if (resource === 'attendance-history' && method === 'GET') {
        return {
          success: true,
          attendances: fixture.buildAttendanceRows(),
        }
      }

      if (resource === 'bills' && method === 'GET' && url.searchParams.get('billId') === fixture.state.payableBill.id) {
        return {
          success: true,
          bill: fixture.buildBillPayload(fixture.state.payableBill),
        }
      }

      if (resource === 'bills' && method === 'GET' && url.searchParams.get('billId') === fixture.state.historyBill.id) {
        return {
          success: true,
          bill: fixture.buildBillPayload(fixture.state.historyBill),
        }
      }

      if (resource === 'bills' && method === 'GET' && url.searchParams.get('teamId') === fixture.state.payableBill.teamId) {
        return {
          success: true,
          bills: [fixture.buildBillPayload(fixture.state.payableBill)],
        }
      }

      if (resource === 'bill-payments' && method === 'GET' && url.searchParams.get('view') === 'recycle-bin') {
        return {
          success: true,
          payments: fixture.buildDeletedBillPayments(),
        }
      }

      if (resource === 'bill-payments' && method === 'POST') {
        const payment = fixture.createPayment(body ?? {})

        return {
          success: true,
          payment: cloneBill(payment),
          bill: fixture.buildBillPayload(fixture.state.payableBill),
        }
      }

      return undefined
    },
    supabase: async ({ url }) => {
      const tableName = url.pathname.split('/').filter(Boolean).at(-1)

      if (tableName === 'projects') {
        return fixture.state.projects
      }

      if (tableName === 'workers') {
        return fixture.state.workers
      }

      if (tableName === 'worker_wage_rates') {
        return fixture.state.workerWageRates
      }

      return []
    },
  }
}

test.describe('payroll surfaces', () => {
  test('opens bayar from worker sheet and returns to worker tab', async ({ page }) => {
    await openApp(page, '/payroll?tab=worker', {
      mockApi: createPayrollMockApi(),
    })

    await expect(page.getByRole('heading', { name: 'Catatan Absensi' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page).toHaveURL(/\/payroll\?tab=worker/)
    await expect(page.getByRole('button', { name: /^Budi E2E/ })).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /^Budi E2E/ }).click()
    await expect(page.getByRole('dialog', { name: 'Budi E2E' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bayar' })).toBeVisible()

    await page.getByRole('button', { name: 'Bayar' }).click()

    await expect(page.getByRole('heading', { name: 'Pembayaran Tagihan Upah' })).toBeVisible({
      timeout: 15000,
    })
    await page.getByLabel('Nominal Pembayaran').fill('1500000')
    await page.getByLabel('Tanggal Pembayaran').fill(paymentDate)
    await page.getByLabel('Catatan').fill('Bayar gaji worker E2E')
    const savePayrollPaymentButton = page.getByRole('button', { name: 'Simpan Pembayaran' })
    await savePayrollPaymentButton.evaluate((button) => button.click())

    await expect(page).toHaveURL(/\/payroll\?tab=worker$/)
    await expect(page.getByRole('button', { name: /^Budi E2E/ })).toBeVisible({
      timeout: 15000,
    })
  })

  test('opens worker detail page with info, recap, and history tabs', async ({ page }) => {
    await openApp(page, '/payroll?tab=worker', {
      mockApi: createPayrollMockApi(),
    })

    await expect(page.getByRole('heading', { name: 'Catatan Absensi' })).toBeVisible({
      timeout: 15000,
    })
    await page.getByRole('button', { name: /^Budi E2E/ }).click()
    await page.getByRole('button', { name: 'Detail' }).click()

    await expect(page).toHaveURL(/\/payroll\/worker\/worker-e2e-1\?month=2026-04/)
    await expect(page.getByRole('heading', { name: 'Budi E2E' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: 'Info' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rekap' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Riwayat' })).toBeVisible()

    await expect(page.getByText('Tercatat', { exact: true })).toBeVisible()
    await expect(page.getByText('Billed', { exact: true })).toBeVisible()
    await expect(page.getByText('Unbilled', { exact: true })).toBeVisible()
    await expect(page.getByText('Tagihan', { exact: true })).toBeVisible()
    await expect(page.getByText('Sisa', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Rekap' }).click()
    await expect(page.getByText(/Proyek E2E .* Aktif .* Tukang/).first()).toBeVisible()
    await expect(page.getByText('Billed').first()).toBeVisible()
    await expect(page.getByText('Unbilled').first()).toBeVisible()

    await page.getByRole('button', { name: 'Riwayat' }).click()
    await expect(page.getByText('Bayar termin awal')).toBeVisible()
    await expect(page.getByText('Pembayaran terhapus')).toBeVisible()

    await page.getByRole('button', { name: 'Kembali' }).click()
    await expect(page).toHaveURL(/\/payroll\?tab=worker$/)
  })
})
