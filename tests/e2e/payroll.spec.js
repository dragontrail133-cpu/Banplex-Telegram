import { expect, test } from '@playwright/test'
import { openApp } from './helpers/app.js'

const paymentDate = '2026-04-21'
const calendarLabelFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
})

function toIsoTimestamp(index = 0) {
  return new Date(Date.parse(`${paymentDate}T10:00:00.000Z`) + index * 60_000).toISOString()
}

function formatCalendarLabel(dateKey) {
  return calendarLabelFormatter.format(new Date(`${dateKey}T00:00:00Z`))
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
    lastArchiveRequest: null,
    lastRestoreRequest: null,
    lastPermanentDeleteRequest: null,
    lastReportDeliveryRequest: null,
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

  function syncHistoryBill() {
    const paidAmount = state.historyBill.payments.reduce(
      (total, payment) => total + Number(payment.amount ?? 0),
      0
    )
    const remainingAmount = Math.max(Number(state.historyBill.amount ?? 0) - paidAmount, 0)

    state.historyBill.paidAmount = paidAmount
    state.historyBill.remainingAmount = remainingAmount
    state.historyBill.status = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid'
    state.historyBill.updatedAt = toIsoTimestamp(state.historyBill.payments.length)
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

  function archiveHistoryPayment(paymentId, body = {}) {
    const paymentIndex = state.historyBill.payments.findIndex(
      (payment) => String(payment.id) === String(paymentId)
    )

    if (paymentIndex === -1) {
      return null
    }

    const archivedPayment = cloneBill(state.historyBill.payments[paymentIndex])
    const deletedAt = body?.expectedUpdatedAt ?? toIsoTimestamp(state.deletedBillPayments.length + 1)

    state.historyBill.payments.splice(paymentIndex, 1)
    syncHistoryBill()
    state.deletedBillPayments = [
      {
        ...archivedPayment,
        deleted_at: deletedAt,
        deletedAt,
        canRestore: true,
        canPermanentDelete: true,
      },
      ...state.deletedBillPayments,
    ]
    state.lastArchiveRequest = {
      paymentId: String(paymentId),
      teamId: String(body?.teamId ?? ''),
      expectedUpdatedAt: body?.expectedUpdatedAt ?? null,
    }

    return {
      bill: buildBillPayload(state.historyBill),
    }
  }

  function restoreHistoryPayment(paymentId, body = {}) {
    const paymentIndex = state.deletedBillPayments.findIndex(
      (payment) => String(payment.id) === String(paymentId)
    )

    if (paymentIndex === -1) {
      return null
    }

    const restoredPayment = cloneBill(state.deletedBillPayments[paymentIndex])

    state.deletedBillPayments.splice(paymentIndex, 1)
    state.historyBill.payments.unshift({
      ...restoredPayment,
      deleted_at: null,
      deletedAt: null,
      canRestore: false,
      canPermanentDelete: false,
    })
    syncHistoryBill()
    state.lastRestoreRequest = {
      action: 'restore',
      paymentId: String(paymentId),
      teamId: String(body?.teamId ?? ''),
      expectedUpdatedAt: body?.expectedUpdatedAt ?? null,
    }

    return {
      payment: restoredPayment,
      bill: buildBillPayload(state.historyBill),
    }
  }

  function permanentDeleteHistoryPayment(paymentId, body = {}) {
    const paymentIndex = state.deletedBillPayments.findIndex(
      (payment) => String(payment.id) === String(paymentId)
    )

    if (paymentIndex === -1) {
      return null
    }

    const permanentDeletedPayment = cloneBill(state.deletedBillPayments[paymentIndex])

    state.deletedBillPayments.splice(paymentIndex, 1)
    state.lastPermanentDeleteRequest = {
      action: 'permanent-delete',
      paymentId: String(paymentId),
      teamId: String(body?.teamId ?? ''),
    }

    return {
      payment: permanentDeletedPayment,
      bill: buildBillPayload(state.historyBill),
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
    archiveHistoryPayment,
    restoreHistoryPayment,
    permanentDeleteHistoryPayment,
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
            dailyGroups: [
              {
                dateKey: paymentDate,
                title: formatCalendarLabel(paymentDate),
                description: '1 record',
                records: [fixture.state.attendanceRows[1]],
                recapableCount: 1,
                recordCount: 1,
                billedCount: 0,
                unbilledCount: 1,
              },
            ],
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

      if (resource === 'attendance' && method === 'GET') {
        const date = String(url.searchParams.get('date') ?? '').trim()
        const projectId = String(url.searchParams.get('projectId') ?? '').trim()

        return {
          success: true,
          attendances: fixture.state.attendanceRows.filter(
            (row) =>
              String(row.attendance_date ?? '') === date &&
              String(row.project_id ?? '') === projectId
          ),
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

      if (resource === 'bill-payments' && method === 'DELETE' && body?.action !== 'permanent-delete') {
        const result = fixture.archiveHistoryPayment(
          String(body?.paymentId ?? body?.payment_id ?? ''),
          body
        )

        return result ? { success: true, ...result } : { success: false, error: 'Payment not found' }
      }

      if (resource === 'bill-payments' && method === 'DELETE' && body?.action === 'permanent-delete') {
        const result = fixture.permanentDeleteHistoryPayment(
          String(body?.paymentId ?? body?.payment_id ?? ''),
          body
        )

        return result ? { success: true, ...result } : { success: false, error: 'Payment not found' }
      }

      if (resource === 'bill-payments' && method === 'PATCH' && body?.action === 'restore') {
        const result = fixture.restoreHistoryPayment(
          String(body?.paymentId ?? body?.payment_id ?? ''),
          body
        )

        return result ? { success: true, ...result } : { success: false, error: 'Payment not found' }
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
    const mockApi = createPayrollMockApi()
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
        fileName: 'kwitansi-tagihan-salary-bill-e2e-history-salary-payment-history-1-20260424.pdf',
        pdfError: null,
      }
    }

    await openApp(page, '/payroll?tab=worker', {
      mockApi,
      telegram: {
        user: {
          id: 20005,
          first_name: 'Mini',
          last_name: 'Payroll',
          username: 'mini_payroll_user',
        },
        startParam: '',
      },
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
    const sendReceiptButton = page.getByRole('button', { name: 'Kirim' }).first()
    await expect(sendReceiptButton).toBeVisible()
    await sendReceiptButton.click()
    await expect(page.getByRole('button', { name: 'Arsipkan pembayaran' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pulihkan pembayaran' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hapus permanen pembayaran' })).toBeVisible()
    expect(mockApi.state.lastReportDeliveryRequest).toMatchObject({
      deliveryKind: 'payment_receipt',
      paymentType: 'bill',
      payment: {
        id: 'salary-payment-history-1',
        billId: 'salary-bill-e2e-history',
      },
      parentRecord: {
        id: 'salary-bill-e2e-history',
      },
    })

    await page.getByRole('button', { name: 'Arsipkan pembayaran' }).click()

    await expect(page.getByRole('button', { name: 'Arsipkan pembayaran' })).toHaveCount(0, {
      timeout: 30000,
    })
    expect(mockApi.state.lastArchiveRequest).toMatchObject({
      paymentId: 'salary-payment-history-1',
      teamId: 'e2e-team',
    })

    await page.getByRole('button', { name: 'Kembali' }).click()
    await expect(page).toHaveURL(/\/payroll\?tab=worker$/)
  })

  test('opens daily attendance edit sheet with the same date and project', async ({ page }) => {
    const mockApi = createPayrollMockApi()

    await openApp(page, '/payroll?tab=daily&month=2026-04', {
      mockApi,
    })

    await expect(page.getByRole('heading', { name: 'Catatan Absensi' })).toBeVisible({
      timeout: 15000,
    })

    const dailyGroupButton = page
      .getByRole('button')
      .filter({ hasText: formatCalendarLabel(paymentDate) })
      .first()

    await expect(dailyGroupButton).toBeVisible({ timeout: 30000 })
    await dailyGroupButton.click()
    await expect(page.getByRole('button', { name: 'Edit Absensi' })).toBeVisible({
      timeout: 30000,
    })

    await page.getByRole('button', { name: 'Edit Absensi' }).click()

    await expect(page.getByRole('button', { name: 'Edit' }).first()).toBeVisible({
      timeout: 30000,
    })
    await page.getByRole('button', { name: 'Edit' }).first().click()

    await expect(page).toHaveURL(
      new RegExp(`/attendance/new\\?date=${paymentDate}&projectId=project-e2e-1$`)
    )
    await expect(page.getByRole('heading', { name: 'Absensi Harian' })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.locator('input[name="date"]')).toHaveValue(paymentDate)
    await expect(page.getByText('Proyek E2E', { exact: true })).toBeVisible({
      timeout: 30000,
    })

    await page.getByRole('button', { name: 'Kembali' }).click()
    await expect(page).toHaveURL(/\/payroll\?tab=daily&month=2026-04$/)
  })
})
