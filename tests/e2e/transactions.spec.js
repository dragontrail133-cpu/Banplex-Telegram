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

function createBillReceiptDetailMock() {
  const transactionId = 'bill-receipt-e2e'
  const billId = 'bill-receipt-e2e-1'
  const payment = {
    id: 'payment-receipt-e2e-1',
    billId,
    amount: 300_000,
    paymentDate: '2026-04-23',
    notes: 'Bayar tahap 1',
    createdAt: '2026-04-23T10:00:00.000Z',
    updatedAt: '2026-04-23T10:00:00.000Z',
  }

  const bill = {
    id: billId,
    status: 'partial',
    amount: 500_000,
    paid_amount: 300_000,
    remaining_amount: 200_000,
    payments: [payment],
    dueDate: '2026-04-25',
    billType: 'operasional',
    description: 'Tagihan Riwayat E2E',
    teamId: 'e2e-team',
  }

  const transaction = {
    id: transactionId,
    team_id: 'e2e-team',
    sourceType: 'bill',
    type: 'expense',
    bill_type: 'operasional',
    amount: 500_000,
    description: 'Tagihan Riwayat E2E',
    created_at: '2026-04-23T10:00:00.000Z',
    updated_at: '2026-04-23T10:00:00.000Z',
    bill,
  }

  return { bill, billId, payment, transaction, transactionId }
}

function createLedgerVisibilityMock() {
  const workspaceTransactions = [
    {
      id: 'workspace-expense-1',
      sourceType: 'expense',
      source_type: 'expense',
      type: 'expense',
      expense_type: 'operasional',
      document_type: 'faktur',
      amount: 125_000,
      description: 'Operasional Aktif',
      created_at: '2026-04-24T08:00:00.000Z',
      updated_at: '2026-04-24T08:00:00.000Z',
      sort_at: '2026-04-24T08:00:00.000Z',
      search_text: 'operasional aktif',
    },
    {
      id: 'workspace-invoice-1',
      sourceType: 'expense',
      source_type: 'expense',
      type: 'expense',
      expense_type: 'material',
      document_type: 'faktur',
      amount: 250_000,
      description: 'Faktur Aktif',
      created_at: '2026-04-24T09:00:00.000Z',
      updated_at: '2026-04-24T09:00:00.000Z',
      sort_at: '2026-04-24T09:00:00.000Z',
      search_text: 'faktur aktif',
    },
    {
      id: 'workspace-delivery-1',
      sourceType: 'expense',
      source_type: 'expense',
      type: 'expense',
      expense_type: 'material',
      document_type: 'surat_jalan',
      amount: 275_000,
      description: 'Surat Jalan Aktif',
      created_at: '2026-04-24T10:00:00.000Z',
      updated_at: '2026-04-24T10:00:00.000Z',
      sort_at: '2026-04-24T10:00:00.000Z',
      search_text: 'surat jalan aktif',
    },
    {
      id: 'workspace-paid-bill-1',
      sourceType: 'bill',
      source_type: 'bill',
      type: 'expense',
      bill_type: 'operasional',
      bill_status: 'paid',
      bill_amount: 500_000,
      bill_paid_amount: 500_000,
      bill_remaining_amount: 0,
      bill_due_date: '2026-04-24',
      bill_paid_at: '2026-04-24T10:30:00.000Z',
      amount: 500_000,
      description: 'Tagihan Lunas Aktif',
      created_at: '2026-04-24T10:30:00.000Z',
      updated_at: '2026-04-24T10:30:00.000Z',
      sort_at: '2026-04-24T10:30:00.000Z',
      search_text: 'tagihan lunas aktif',
    },
    {
      id: 'workspace-payroll-bill-1',
      sourceType: 'bill',
      source_type: 'bill',
      type: 'expense',
      bill_type: 'gaji',
      bill_status: 'unpaid',
      bill_amount: 600_000,
      bill_paid_amount: 0,
      bill_remaining_amount: 600_000,
      bill_due_date: '2026-04-24',
      bill_paid_at: null,
      amount: 600_000,
      description: 'Tagihan Upah Aktif',
      created_at: '2026-04-24T11:00:00.000Z',
      updated_at: '2026-04-24T11:00:00.000Z',
      sort_at: '2026-04-24T11:00:00.000Z',
      search_text: 'tagihan upah aktif',
    },
  ]

  const historyTransactions = [
    {
      id: 'history-paid-bill-1',
      sourceType: 'bill',
      source_type: 'bill',
      type: 'expense',
      bill_type: 'operasional',
      bill_status: 'paid',
      bill_amount: 420_000,
      bill_paid_amount: 420_000,
      bill_remaining_amount: 0,
      bill_due_date: '2026-04-23',
      bill_paid_at: '2026-04-23T10:00:00.000Z',
      amount: 420_000,
      description: 'Tagihan Riwayat',
      created_at: '2026-04-23T10:00:00.000Z',
      updated_at: '2026-04-23T10:00:00.000Z',
      sort_at: '2026-04-23T10:00:00.000Z',
      search_text: 'tagihan riwayat',
    },
    {
      id: 'history-payroll-bill-1',
      sourceType: 'bill',
      source_type: 'bill',
      type: 'expense',
      bill_type: 'gaji',
      bill_status: 'paid',
      bill_amount: 700_000,
      bill_paid_amount: 700_000,
      bill_remaining_amount: 0,
      bill_due_date: '2026-04-23',
      bill_paid_at: '2026-04-23T11:00:00.000Z',
      amount: 700_000,
      description: 'Tagihan Upah Riwayat',
      created_at: '2026-04-23T11:00:00.000Z',
      updated_at: '2026-04-23T11:00:00.000Z',
      sort_at: '2026-04-23T11:00:00.000Z',
      search_text: 'tagihan upah riwayat',
    },
    {
      id: 'history-delivery-1',
      sourceType: 'expense',
      source_type: 'expense',
      type: 'expense',
      expense_type: 'material',
      document_type: 'surat_jalan',
      amount: 275_000,
      description: 'Surat Jalan Riwayat',
      created_at: '2026-04-23T12:00:00.000Z',
      updated_at: '2026-04-23T12:00:00.000Z',
      sort_at: '2026-04-23T12:00:00.000Z',
      search_text: 'surat jalan riwayat',
    },
  ]

  return { historyTransactions, workspaceTransactions }
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

  test('keeps Jurnal free of payroll and paid bills, and filters surat jalan out of Faktur view', async ({
    page,
  }) => {
    const mockLedger = createLedgerVisibilityMock()

    await openApp(page, '/transactions', {
      mockApi: {
        transactions: async ({ view }) => {
          if (view === 'workspace') {
            return {
              success: true,
              workspaceTransactions: mockLedger.workspaceTransactions,
              pageInfo: {
                hasMore: false,
                nextCursor: null,
                totalCount: mockLedger.workspaceTransactions.length,
              },
            }
          }

          if (view === 'history') {
            return {
              success: true,
              historyTransactions: mockLedger.historyTransactions,
              pageInfo: {
                hasMore: false,
                nextCursor: null,
                totalCount: mockLedger.historyTransactions.length,
              },
            }
          }

          return undefined
        },
      },
    })

    await expectHeading(page, 'Jurnal')
    await expect(page.getByRole('heading', { name: 'Operasional Aktif' })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByRole('heading', { name: 'Faktur Aktif' })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByRole('heading', { name: 'Tagihan Lunas Aktif' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Tagihan Upah Aktif' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Buka filter Jurnal' }).click()
    await page.getByRole('dialog', { name: 'Filter' }).getByRole('button', { name: 'Faktur', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Faktur Aktif' })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByRole('heading', { name: 'Surat Jalan Aktif' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Operasional Aktif' })).toHaveCount(0)
  })

  test('opens recycle bin', async ({ page }) => {
    await openApp(page, '/transactions/recycle-bin')
    await expectHeading(page, 'Arsip')
    await expect(page.getByText('Belum Ada Data Terhapus')).toBeVisible()
  })

  test('keeps history free of payroll bills and surat jalan rows', async ({ page }) => {
    const mockLedger = createLedgerVisibilityMock()

    await openApp(page, '/transactions?tab=history', {
      mockApi: {
        transactions: async ({ view }) => {
          if (view === 'workspace') {
            return {
              success: true,
              workspaceTransactions: mockLedger.workspaceTransactions,
              pageInfo: {
                hasMore: false,
                nextCursor: null,
                totalCount: mockLedger.workspaceTransactions.length,
              },
            }
          }

          if (view === 'history') {
            return {
              success: true,
              historyTransactions: mockLedger.historyTransactions,
              pageInfo: {
                hasMore: false,
                nextCursor: null,
                totalCount: mockLedger.historyTransactions.length,
              },
            }
          }

          return undefined
        },
      },
    })

    await expectHeading(page, 'Jurnal')
    await expect(page.getByRole('heading', { name: 'Tagihan Riwayat' })).toBeVisible({
      timeout: 30000,
    })
    await expect(page.getByRole('heading', { name: 'Tagihan Upah Riwayat' })).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Surat Jalan Riwayat' })).toHaveCount(0)
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
    await expect(page.locator('.app-chip', { hasText: 'Subtotal' })).toHaveCount(0)
  })

  test('returns from technical transaction detail to the same history record', async ({ page }) => {
    const { billId, transaction, transactionId } = createBillReceiptDetailMock()

    await openApp(page, `/transactions/${transactionId}/technical?surface=riwayat`, {
      mockApi: {
        transactions: async ({ method, url }) => {
          if (method === 'GET' && url.searchParams.get('transactionId') === transactionId) {
            return {
              success: true,
              record: transaction,
            }
          }

          return undefined
        },
        records: async ({ method, resource, url }) => {
          if (resource === 'bills' && method === 'GET' && url.searchParams.get('billId') === billId) {
            return {
              success: true,
              bill: transaction.bill,
            }
          }

          return undefined
        },
      },
    })

    await expectHeading(page, 'Detail Teknis Detail Jurnal')
    await page.getByRole('button', { name: 'Kembali' }).click()

    await expect(page).toHaveURL(new RegExp(`/transactions/${transactionId}\\?surface=riwayat$`))
    await expectHeading(page, 'Detail Riwayat')
  })

  test('preserves detail state when opening technical transaction detail from the general page', async ({
    page,
  }) => {
    const { billId, transaction, transactionId } = createBillReceiptDetailMock()

    await openApp(page, `/transactions/${transactionId}?surface=riwayat`, {
      mockApi: {
        transactions: async ({ method, url }) => {
          if (method === 'GET' && url.searchParams.get('transactionId') === transactionId) {
            return {
              success: true,
              record: transaction,
            }
          }

          return undefined
        },
        records: async ({ method, resource, url }) => {
          if (resource === 'bills' && method === 'GET' && url.searchParams.get('billId') === billId) {
            return {
              success: true,
              bill: transaction.bill,
            }
          }

          return undefined
        },
      },
    })

    await expectHeading(page, 'Detail Riwayat')
    await page.getByRole('button', { name: 'Detail Teknis' }).click()

    await expect(page.getByRole('heading', { name: /Detail Teknis/i })).toBeVisible({
      timeout: 30000,
    })

    const technicalState = await page.evaluate(() => ({
      detailSurface: window.history.state?.usr?.detailSurface ?? null,
      surface: window.history.state?.usr?.surface ?? null,
      transactionId: window.history.state?.usr?.transaction?.id ?? null,
    }))

    expect(technicalState).toMatchObject({
      detailSurface: 'riwayat',
      surface: 'riwayat',
      transactionId,
    })

    await page.getByRole('button', { name: 'Kembali' }).click()

    await expect(page).toHaveURL(new RegExp(`/transactions/${transactionId}\\?surface=riwayat$`))
    await expectHeading(page, 'Detail Riwayat')
  })

  test('returns from technical edit detail to the same expense form', async ({ page }) => {
    const { expenseId, invoice } = createMaterialInvoiceDetailMock()

    await openApp(page, `/edit/expense/${expenseId}/technical`, {
      mockApi: {
        records: async ({ method, resource }) => {
          if (resource === 'material-invoices' && method === 'GET') {
            return {
              success: true,
              expense: invoice,
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

    await expect(page.getByRole('heading', { name: 'Detail Teknis Pengeluaran' })).toBeVisible({
      timeout: 30000,
    })
    await page.getByRole('button', { name: 'Kembali' }).click()

    await expect(page).toHaveURL(new RegExp(`/edit/expense/${expenseId}$`))
    await expectHeading(page, 'Edit Pengeluaran')
  })

  test('sends a bill receipt to telegram dm from transaction history', async ({ page }) => {
    const { bill, billId, payment, transaction, transactionId } = createBillReceiptDetailMock()
    const mockApi = {
      reportDelivery: async ({ body }) => {
        mockApi.lastReportDeliveryRequest = body

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
          fileName: 'kwitansi-tagihan-bill-receipt-e2e-1-payment-receipt-e2e-1-20260424.pdf',
          pdfError: null,
        }
      },
      transactions: async ({ method, url }) => {
        if (method === 'GET' && url.searchParams.get('transactionId') === transactionId) {
          return {
            success: true,
            record: transaction,
          }
        }

        return undefined
      },
      records: async ({ method, resource, url }) => {
        if (resource === 'bills' && method === 'GET' && url.searchParams.get('billId') === billId) {
          return {
            success: true,
            bill,
          }
        }

        return undefined
      },
      lastReportDeliveryRequest: null,
    }

    await openApp(page, `/transactions/${transactionId}?surface=history`, {
      mockApi,
      telegram: {
        user: {
          id: 20005,
          first_name: 'Mini',
          last_name: 'Transaction',
          username: 'mini_transaction_user',
        },
        startParam: '',
      },
    })

    await expectHeading(page, 'Detail Riwayat')
    await page.getByRole('button', { name: 'Riwayat' }).click()

    const sendReceiptButton = page.getByRole('button', { name: 'Kirim' }).first()
    await expect(sendReceiptButton).toBeVisible({ timeout: 30000 })
    await sendReceiptButton.click()

    expect(mockApi.lastReportDeliveryRequest).toMatchObject({
      deliveryKind: 'payment_receipt',
      paymentType: 'bill',
      payment: {
        id: payment.id,
        billId,
      },
      parentRecord: {
        id: billId,
      },
    })
  })
})
