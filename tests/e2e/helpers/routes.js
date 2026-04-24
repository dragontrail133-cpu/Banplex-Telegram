const DEFAULT_BASE_URL = 'http://127.0.0.1:3000'

function withDevAuthBypass(path = '/') {
  const url = new URL(path, DEFAULT_BASE_URL)
  url.searchParams.set('devAuthBypass', '1')

  return `${url.pathname}${url.search}${url.hash}`
}

const appRoutes = {
  dashboard: '/',
  createAttendance: '/attendance/new',
  createMaterialInvoice: '/material-invoice/new',
  materialInvoiceDetail: '/transactions/sample-expense-id',
  editExpense: '/edit/expense/sample-expense-id',
  paymentBill: '/payment/sample-payment-id',
  paymentLoan: '/loan-payment/sample-loan-payment-id',
  tagihan: '/tagihan',
  transactions: '/transactions',
  history: '/transactions/history',
  recycleBin: '/transactions/recycle-bin',
  payroll: '/payroll',
  masterRecycleBin: '/master/recycle-bin',
}

export { appRoutes, withDevAuthBypass }
