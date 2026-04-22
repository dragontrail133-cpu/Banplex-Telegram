import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { openApp } from './helpers/app.js'

const paymentDate = '2026-04-21'

function toIsoTimestamp(index = 0) {
  return new Date(Date.parse(`${paymentDate}T10:00:00.000Z`) + index * 60_000).toISOString()
}

function clonePayment(payment) {
  return payment ? { ...payment } : null
}

function buildBillFixture() {
  const state = {
    bill: {
      id: 'bill-e2e-1',
      teamId: 'e2e-team',
      expenseId: 'expense-e2e-1',
      billType: 'operasional',
      description: 'Pembelian material proyek',
      amount: 2_500_000,
      paidAmount: 0,
      remainingAmount: 2_500_000,
      dueDate: '2026-04-30',
      status: 'unpaid',
      supplierName: 'Supplier E2E',
      projectName: 'Proyek E2E',
      worker_name_snapshot: null,
      supplier_name_snapshot: 'Supplier E2E',
      project_name_snapshot: 'Proyek E2E',
      createdAt: '2026-04-20T00:00:00.000Z',
      updatedAt: '2026-04-20T00:00:00.000Z',
      deletedAt: null,
      payments: [],
    },
    nextPaymentIndex: 1,
  }

  function syncBill() {
    const paidAmount = state.bill.payments.reduce(
      (total, payment) => total + Number(payment.amount ?? 0),
      0
    )
    const remainingAmount = Math.max(Number(state.bill.amount ?? 0) - paidAmount, 0)

    state.bill.paidAmount = paidAmount
    state.bill.remainingAmount = remainingAmount
    state.bill.status = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid'
    state.bill.updatedAt = toIsoTimestamp(state.nextPaymentIndex)
  }

  function createPayment(payload = {}) {
    const payment = {
      id: `bill-payment-${state.nextPaymentIndex++}`,
      billId: state.bill.id,
      teamId: state.bill.teamId,
      amount: Number(payload.amount ?? 0),
      paymentDate: String(payload.payment_date ?? paymentDate),
      notes: String(payload.notes ?? '').trim(),
      createdAt: toIsoTimestamp(state.nextPaymentIndex),
      updatedAt: toIsoTimestamp(state.nextPaymentIndex),
      deletedAt: null,
      supplierName: state.bill.supplierName,
      projectName: state.bill.projectName,
      worker_name_snapshot: null,
      supplier_name_snapshot: state.bill.supplierName,
      project_name_snapshot: state.bill.projectName,
    }

    state.bill.payments.unshift(payment)
    syncBill()

    return payment
  }

  function updatePayment(paymentId, payload = {}) {
    const payment = state.bill.payments.find((item) => item.id === paymentId)

    if (!payment) {
      return null
    }

    payment.amount = Number(payload.amount ?? payment.amount)
    payment.paymentDate = String(payload.paymentDate ?? payment.paymentDate)
    payment.notes = String(payload.notes ?? payment.notes ?? '').trim()
    payment.updatedAt = toIsoTimestamp(state.nextPaymentIndex)
    syncBill()

    return payment
  }

  function deletePayment(paymentId) {
    const index = state.bill.payments.findIndex((payment) => payment.id === paymentId)

    if (index < 0) {
      return null
    }

    const [deletedPayment] = state.bill.payments.splice(index, 1)
    syncBill()

    return deletedPayment
  }

  function buildBillPayload() {
    return {
      ...state.bill,
      payments: state.bill.payments.map(clonePayment),
    }
  }

  return {
    state,
    createPayment,
    updatePayment,
    deletePayment,
    buildBillPayload,
  }
}

function buildLoanFixture() {
  const state = {
    loan: {
      id: 'loan-e2e-1',
      team_id: 'e2e-team',
      created_by_user_id: 'e2e-user',
      telegram_user_id: '20002',
      creditor_name_snapshot: 'Kreditur E2E',
      description: 'Pinjaman modal kerja',
      notes: 'Pinjaman modal kerja',
      principal_amount: 5_000_000,
      amount: 5_000_000,
      repayment_amount: 6_000_000,
      interest_type: 'none',
      interest_rate: null,
      tenor_months: 0,
      late_interest_rate: 0,
      late_interest_basis: 'remaining',
      late_penalty_type: 'none',
      late_penalty_amount: 0,
      transaction_date: '2026-04-01',
      disbursed_date: '2026-04-01',
      due_date: '2026-04-01',
      status: 'unpaid',
      paid_amount: 0,
      remainingAmount: 6_000_000,
      remaining_amount: 6_000_000,
      created_at: '2026-04-01T00:00:00.000Z',
      updated_at: '2026-04-01T00:00:00.000Z',
      deleted_at: null,
    },
    payments: [],
    nextPaymentIndex: 1,
  }

  function syncLoan() {
    const paidAmount = state.payments.reduce((total, payment) => total + Number(payment.amount ?? 0), 0)
    const remainingAmount = Math.max(Number(state.loan.repayment_amount ?? 0) - paidAmount, 0)

    state.loan.paid_amount = paidAmount
    state.loan.remainingAmount = remainingAmount
    state.loan.remaining_amount = remainingAmount
    state.loan.status = remainingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid'
    state.loan.updated_at = toIsoTimestamp(state.nextPaymentIndex)
  }

  function createPayment(payload = {}) {
    const payment = {
      id: `loan-payment-${state.nextPaymentIndex++}`,
      loanId: state.loan.id,
      teamId: state.loan.team_id,
      telegramUserId: state.loan.telegram_user_id,
      amount: Number(payload.amount ?? 0),
      paymentDate: String(payload.payment_date ?? paymentDate),
      notes: String(payload.notes ?? '').trim(),
      createdAt: toIsoTimestamp(state.nextPaymentIndex),
      updatedAt: toIsoTimestamp(state.nextPaymentIndex),
      deletedAt: null,
      creditorNameSnapshot: state.loan.creditor_name_snapshot,
    }

    state.payments.unshift(payment)
    syncLoan()

    return payment
  }

  function updatePayment(paymentId, payload = {}) {
    const payment = state.payments.find((item) => item.id === paymentId)

    if (!payment) {
      return null
    }

    payment.amount = Number(payload.amount ?? payment.amount)
    payment.paymentDate = String(payload.paymentDate ?? payment.paymentDate)
    payment.notes = String(payload.notes ?? payment.notes ?? '').trim()
    payment.updatedAt = toIsoTimestamp(state.nextPaymentIndex)
    syncLoan()

    return payment
  }

  function deletePayment(paymentId) {
    const index = state.payments.findIndex((payment) => payment.id === paymentId)

    if (index < 0) {
      return null
    }

    const [deletedPayment] = state.payments.splice(index, 1)
    syncLoan()

    return deletedPayment
  }

  function buildLoanPayload() {
    return {
      ...state.loan,
      payments: state.payments.map(clonePayment),
    }
  }

  return {
    state,
    createPayment,
    updatePayment,
    deletePayment,
    buildLoanPayload,
  }
}

function createBillMockApi() {
  const fixture = buildBillFixture()

  return {
    notify: async () => ({ success: true }),
    records: async ({ method, resource, url, body }) => {
      if (resource === 'bills' && method === 'GET' && url.searchParams.get('billId') === fixture.state.bill.id) {
        return { success: true, bill: fixture.buildBillPayload() }
      }

      if (resource === 'bills' && method === 'GET' && url.searchParams.get('teamId') === fixture.state.bill.teamId) {
        return { success: true, bills: [fixture.buildBillPayload()] }
      }

      if (resource === 'bill-payments' && method === 'POST') {
        const payment = fixture.createPayment(body ?? {})

        return {
          success: true,
          payment: clonePayment(payment),
          bill: fixture.buildBillPayload(),
        }
      }

      if (resource === 'bill-payments' && method === 'PATCH') {
        const payment = fixture.updatePayment(String(body?.paymentId ?? ''), body ?? {})

        return {
          success: true,
          payment: clonePayment(payment),
          bill: fixture.buildBillPayload(),
        }
      }

      if (resource === 'bill-payments' && method === 'DELETE') {
        const payment = fixture.deletePayment(String(body?.paymentId ?? ''))

        return {
          success: true,
          payment: clonePayment(payment),
          bill: fixture.buildBillPayload(),
        }
      }

      return undefined
    },
  }
}

function createLoanMockApi() {
  const fixture = buildLoanFixture()

  return {
    notify: async () => ({ success: true }),
    supabase: async ({ method, url }) => {
      if (method === 'GET' && url.pathname.endsWith('/loans')) {
        return [fixture.buildLoanPayload()]
      }

      if (method === 'GET' && url.pathname.endsWith('/loan_payments')) {
        return fixture.state.payments.map(clonePayment)
      }

      return undefined
    },
    transactions: async ({ method, resource, body }) => {
      if (resource !== 'loan-payments') {
        return undefined
      }

      if (method === 'POST') {
        const payment = fixture.createPayment(body ?? {})

        return {
          success: true,
          payment: clonePayment(payment),
          loan: fixture.buildLoanPayload(),
        }
      }

      if (method === 'PATCH') {
        const payment = fixture.updatePayment(String(body?.paymentId ?? ''), body ?? {})

        return {
          success: true,
          payment: clonePayment(payment),
          loan: fixture.buildLoanPayload(),
        }
      }

      if (method === 'DELETE') {
        const payment = fixture.deletePayment(String(body?.paymentId ?? ''))

        return {
          success: true,
          payment: clonePayment(payment),
          loan: fixture.buildLoanPayload(),
        }
      }

      return undefined
    },
  }
}

test.describe('payment surfaces', () => {
  test('manages bill payment lifecycle', async ({ page }) => {
    await openApp(page, '/tagihan/bill-e2e-1', {
      mockApi: createBillMockApi(),
    })

    await expect(page.locator('h1').filter({ hasText: 'Tagihan' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('heading', { name: 'Supplier E2E' })).toBeVisible()
    await expect(page.getByText(/Rp\s?2\.500\.000/).first()).toBeVisible()

    await page.getByLabel('Nominal Pembayaran').fill('1250000')
    await page.getByLabel('Tanggal Pembayaran').fill(paymentDate)
    await page.getByLabel('Catatan').fill('Pembayaran tahap pertama')
    await page.getByRole('button', { name: 'Simpan Pembayaran' }).click()

    await expect(page.getByText('Pembayaran tahap pertama')).toBeVisible()
    await expect(page.getByText(/Rp\s?1\.250\.000/).first()).toBeVisible()

    const billReceiptDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Kwitansi PDF' }).first().click()
    const billReceipt = await billReceiptDownload
    const billReceiptPath = await billReceipt.path()
    expect(billReceiptPath).toBeTruthy()
    expect((await readFile(billReceiptPath)).subarray(0, 5).toString('utf8')).toBe('%PDF-')
    expect(billReceipt.suggestedFilename()).toContain('kwitansi-tagihan')

    await page.getByRole('button', { name: 'Edit' }).first().click()
    await expect(page.getByRole('button', { name: 'Simpan Perubahan' })).toBeVisible()
    await page.getByLabel('Nominal Pembayaran').fill('1000000')
    await page.getByLabel('Catatan').fill('Revisi pembayaran tahap pertama')
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click()

    await expect(page.getByText('Revisi pembayaran tahap pertama')).toBeVisible()
    await expect(page.getByText(/Rp\s?1\.000\.000/).first()).toBeVisible()

    page.once('dialog', async (dialog) => {
      await dialog.accept()
    })
    await page.getByRole('button', { name: 'Arsipkan' }).first().click()

    await expect(page.getByText('Belum ada pembayaran untuk tagihan ini.')).toBeVisible()
    await expect(page.getByText('Revisi pembayaran tahap pertama')).toHaveCount(0)
  })

  test('manages loan payment lifecycle', async ({ page }) => {
    await openApp(page, '/pembayaran/pinjaman/loan-e2e-1', {
      mockApi: createLoanMockApi(),
    })

    await expect(page.getByRole('heading', { name: 'Pembayaran Pinjaman' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('heading', { name: 'Kreditur E2E' })).toBeVisible()
    await expect(page.getByText(/Rp\s?6\.000\.000/).first()).toBeVisible()

    await page.getByLabel('Nominal Pembayaran').fill('2000000')
    await page.getByLabel('Tanggal Pembayaran').fill(paymentDate)
    await page.getByLabel('Catatan').fill('Cicilan pinjaman tahap pertama')
    await page.getByRole('button', { name: 'Simpan Pembayaran' }).click()

    await expect(page.getByText('Cicilan pinjaman tahap pertama')).toBeVisible()
    await expect(page.getByText(/Rp\s?2\.000\.000/).first()).toBeVisible()

    const loanReceiptDownload = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Kwitansi PDF' }).first().click()
    const loanReceipt = await loanReceiptDownload
    const loanReceiptPath = await loanReceipt.path()
    expect(loanReceiptPath).toBeTruthy()
    expect((await readFile(loanReceiptPath)).subarray(0, 5).toString('utf8')).toBe('%PDF-')
    expect(loanReceipt.suggestedFilename()).toContain('kwitansi-pinjaman')

    await page.getByRole('button', { name: 'Edit' }).first().click()
    await expect(page.getByRole('button', { name: 'Simpan Perubahan' })).toBeVisible()
    await page.getByLabel('Nominal Pembayaran').fill('1500000')
    await page.getByLabel('Catatan').fill('Revisi cicilan pinjaman tahap pertama')
    await page.getByRole('button', { name: 'Simpan Perubahan' }).click()

    await expect(page.getByText('Revisi cicilan pinjaman tahap pertama')).toBeVisible()
    await expect(page.getByText(/Rp\s?1\.500\.000/).first()).toBeVisible()

    await expect(page.getByText('Revisi cicilan pinjaman tahap pertama')).toBeVisible()
  })
})
