import { expect, test } from '@playwright/test'
import { dismissToastIfVisible, expectDashboardReady, openLiveApp } from './helpers/live-app.js'
import { createLiveSmokeArtifact } from './helpers/live-artifacts.js'
import { getAppTodayKey } from '../../src/lib/date-time.js'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildCurrencyPattern(value) {
  const numericValue = Number(value)
  const formattedValue = currencyFormatter
    .format(Number.isFinite(numericValue) ? numericValue : 0)
    .replace(/\s+/gu, ' ')

  return new RegExp(escapeRegExp(formattedValue).replace(/ /g, '\\s*'))
}

function pickSmokeAttendanceDate() {
  const [year, month, day] = getAppTodayKey().split('-')

  return `${year}-${month}-${Number(day) <= 10 ? '20' : '10'}`
}

async function parseJsonResponse(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function normalizeInsertedRecord(payload) {
  if (Array.isArray(payload)) {
    return payload[0] ?? null
  }

  return payload ?? null
}

function isRecordsApiResponse(response, resource, method = 'POST') {
  if (response.request().method() !== method) {
    return false
  }

  try {
    const responseUrl = new URL(response.url())

    return (
      responseUrl.pathname.endsWith('/api/records') &&
      responseUrl.searchParams.get('resource') === resource
    )
  } catch {
    return false
  }
}

function isTransactionsApiResponse(response, method = 'POST', resource = null) {
  if (response.request().method() !== method) {
    return false
  }

  try {
    const responseUrl = new URL(response.url())

    return (
      responseUrl.pathname.endsWith('/api/transactions') &&
      (resource === null || responseUrl.searchParams.get('resource') === resource)
    )
  } catch {
    return false
  }
}

async function pickFirstMasterOption(page, triggerPattern, dialogTitle) {
  const trigger = page.getByRole('button', { name: triggerPattern }).first()
  await expect(trigger).toBeVisible({ timeout: 20000 })
  await trigger.click()

  const dialog = page.getByRole('dialog', { name: dialogTitle })
  await expect(dialog).toBeVisible({ timeout: 20000 })

  const option = dialog.locator('button').filter({ hasNotText: 'Tutup' }).first()
  await expect(option).toBeVisible({ timeout: 20000 })

  const label =
    (
      await option
        .locator('p')
        .first()
        .textContent()
        .catch(() => option.textContent())
    )?.trim() ?? ''

  await option.click()
  await expect(dialog).toBeHidden({ timeout: 20000 })

  return label
}

test.describe('live release smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('proves real auth, master write, income fee bills, material invoice stock, expense payment recalc, and team invite write', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(300000)

    const artifact = await createLiveSmokeArtifact({ baseURL })
    const attendanceDate = pickSmokeAttendanceDate()
    const salaryPaymentNotes = `${artifact.smokePrefix} salary bill smoke`
    const creditorName = `${artifact.smokePrefix} Kreditur`
    const creditorNotes = `${artifact.smokePrefix} master creditor`
    const loanNotes = `${artifact.smokePrefix} loan smoke`
    const projectIncomeAmount = 789012
    const projectIncomeDescription = `${artifact.smokePrefix} income smoke`
    const materialInvoiceQty = 2
    const materialInvoiceUnitPrice = 345678
    const materialInvoiceLineTotal = materialInvoiceQty * materialInvoiceUnitPrice
    const materialInvoiceDescription = `${artifact.smokePrefix} material invoice smoke`
    const expenseAmount = 654321
    const expensePaymentAmount = 200000
    const expenseDescription = `${artifact.smokePrefix} expense smoke`
    const expenseNotes = `${artifact.smokePrefix} expense note`
    const expensePaymentNotes = `${artifact.smokePrefix} bill payment smoke`

    await artifact.addStep('open_dashboard')
    await openLiveApp(page, '/')
    await expectDashboardReady(page)

    await artifact.addStep('open_transactions')
    await openLiveApp(page, '/transactions')
    await expect(page).toHaveURL(/\/transactions(?:\?.*)?$/)
    await expect(page.getByRole('button', { name: 'Buka filter Jurnal' })).toBeVisible({
      timeout: 20000,
    })

    await artifact.addStep('open_payroll')
    await openLiveApp(page, '/payroll')
    await expect(page.getByRole('heading', { name: 'Catatan Absensi' })).toBeVisible({
      timeout: 20000,
    })

    await artifact.addStep('create_attendance')
    await openLiveApp(page, '/attendance/new')
    await expect(page.getByRole('heading', { name: 'Absensi Harian' })).toBeVisible({
      timeout: 20000,
    })

    const attendanceSheetResponsePromise = page.waitForResponse((response) => {
      if (response.request().method() !== 'GET') {
        return false
      }

      try {
        const responseUrl = new URL(response.url())

        return (
          responseUrl.pathname.endsWith('/api/records') &&
          responseUrl.searchParams.get('resource') === 'attendance' &&
          responseUrl.searchParams.get('date') === attendanceDate
        )
      } catch {
        return false
      }
    })

    await page.locator('input[name="date"]').fill(attendanceDate)
    const attendanceSheetResponse = await attendanceSheetResponsePromise
    expect(attendanceSheetResponse.ok()).toBeTruthy()

    const attendanceRowButton = page
      .locator('button[aria-haspopup="dialog"]')
      .filter({ hasNotText: 'Terkunci' })
      .first()
    await expect(attendanceRowButton).toBeVisible({
      timeout: 20000,
    })

    const attendanceWorkerName =
      (await attendanceRowButton.locator('p').first().textContent().catch(() => null))?.trim() ??
      ''
    expect(attendanceWorkerName).toBeTruthy()

    await attendanceRowButton.click()

    const attendanceDialog = page.getByRole('dialog', { name: attendanceWorkerName })
    await expect(attendanceDialog).toBeVisible({
      timeout: 20000,
    })
    await attendanceDialog.getByRole('button', { name: 'Penuh' }).click()
    await attendanceDialog.getByRole('button', { name: 'Tutup' }).click()

    const attendanceResponsePromise = page.waitForResponse((response) =>
      isRecordsApiResponse(response, 'attendance')
    )

    await page.getByRole('button', { name: 'Simpan Absensi' }).click()

    const attendanceResponse = await attendanceResponsePromise
    expect(attendanceResponse.ok()).toBeTruthy()

    const attendancePayload = await parseJsonResponse(attendanceResponse)
    const attendanceRows = Array.isArray(attendancePayload?.attendances)
      ? attendancePayload.attendances
      : []
    const savedAttendance =
      attendanceRows.find(
        (record) =>
          record?.attendance_date === attendanceDate &&
          String(record?.worker_name_snapshot ?? record?.worker_name ?? '').trim() ===
            attendanceWorkerName &&
          String(record?.attendance_status ?? '').trim() === 'full_day'
      ) ?? attendanceRows[0] ?? null

    expect(savedAttendance?.id).toBeTruthy()
    expect(String(savedAttendance?.billing_status ?? '').trim()).toBe('unbilled')
    expect(savedAttendance?.salary_bill_id ?? null).toBeNull()

    await artifact.record('attendance_record', {
      id: savedAttendance.id,
      team_id: savedAttendance.team_id ?? null,
      worker_id: savedAttendance.worker_id ?? null,
      project_id: savedAttendance.project_id ?? null,
      attendance_date: savedAttendance.attendance_date ?? attendanceDate,
      attendance_status: savedAttendance.attendance_status ?? 'full_day',
      total_pay: savedAttendance.total_pay ?? null,
      billing_status: savedAttendance.billing_status ?? null,
      salary_bill_id: savedAttendance.salary_bill_id ?? null,
      worker_name_snapshot:
        savedAttendance.worker_name_snapshot ?? savedAttendance.worker_name ?? attendanceWorkerName,
      project_name_snapshot: savedAttendance.project_name_snapshot ?? null,
      created_at: savedAttendance.created_at ?? null,
      updated_at: savedAttendance.updated_at ?? null,
    })

    await expect(page.getByText('Sheet absensi tersimpan')).toBeVisible({
      timeout: 20000,
    })
    await expect(page.getByText('Record ini akan muncul di payroll dan bisa ditagihkan per worker.')).toBeVisible({
      timeout: 20000,
    })
    await dismissToastIfVisible(page)

    await artifact.addStep('generate_salary_bill')
    await openLiveApp(page, '/payroll?tab=worker')
    await expect(page.getByRole('heading', { name: 'Catatan Absensi' })).toBeVisible({
      timeout: 20000,
    })

    const workerCardButton = page
      .locator('button[aria-haspopup="dialog"]')
      .filter({ hasText: new RegExp(escapeRegExp(attendanceWorkerName), 'i') })
      .first()
    await expect(workerCardButton).toBeVisible({
      timeout: 20000,
    })
    await workerCardButton.click()

    const workerActionSheet = page.getByRole('dialog', { name: 'Detail dan Aksi' })
    await expect(workerActionSheet.getByRole('button', { name: 'Rekap' })).toBeVisible({
      timeout: 20000,
    })

    const recapResponsePromise = page.waitForResponse((response) =>
      isRecordsApiResponse(response, 'attendance-recap')
    )

    await workerActionSheet.getByRole('button', { name: 'Rekap' }).click()

    const recapDialog = page.getByRole('dialog', { name: 'Konfirmasi Rekap Pekerja' })
    await expect(recapDialog).toBeVisible({
      timeout: 20000,
    })

    await recapDialog.getByRole('button', { name: 'Rekap' }).click()

    const recapResponse = await recapResponsePromise
    expect(recapResponse.ok()).toBeTruthy()

    const recapPayload = await parseJsonResponse(recapResponse)
    const salaryBillId = recapPayload?.billId ?? null
    const salaryBillTotalAmount = Number(recapPayload?.totalAmount ?? savedAttendance.total_pay ?? 0)
    const salaryBillAttendanceCount = Number(recapPayload?.attendanceCount ?? 0)

    expect(salaryBillId).toBeTruthy()
    expect(salaryBillTotalAmount).toBeGreaterThan(0)
    expect(salaryBillAttendanceCount).toBeGreaterThan(0)

    await artifact.record('salary_bill', {
      id: salaryBillId,
      team_id: savedAttendance.team_id ?? null,
      worker_id: savedAttendance.worker_id ?? null,
      bill_type: 'gaji',
      amount: salaryBillTotalAmount,
      paid_amount: 0,
      due_date: getAppTodayKey(),
      status: 'unpaid',
      worker_name_snapshot: attendanceWorkerName,
      attendance_count: salaryBillAttendanceCount,
      created_at: null,
      updated_at: null,
    })

    await artifact.addStep('pay_salary_bill')
    await openLiveApp(page, `/payment/${salaryBillId}`)
    await expect(page.getByRole('heading', { name: 'Pembayaran Tagihan Upah' })).toBeVisible({
      timeout: 20000,
    })
    await expect(
      page.getByRole('heading', { name: new RegExp(escapeRegExp(attendanceWorkerName), 'i') })
    ).toBeVisible({
      timeout: 20000,
    })

    const salaryPaymentResponsePromise = page.waitForResponse((response) =>
      isRecordsApiResponse(response, 'bill-payments')
    )

    await page.getByLabel('Nominal Pembayaran').fill(String(salaryBillTotalAmount))
    await page.getByLabel('Catatan').fill(salaryPaymentNotes)
    await page.getByRole('button', { name: 'Simpan Pembayaran' }).click()

    const salaryPaymentResponse = await salaryPaymentResponsePromise
    expect(salaryPaymentResponse.ok()).toBeTruthy()

    const salaryPaymentPayload = await parseJsonResponse(salaryPaymentResponse)
    const salaryPayment = salaryPaymentPayload?.payment ?? null
    const paidSalaryBill = salaryPaymentPayload?.bill ?? null

    expect(salaryPayment?.id).toBeTruthy()
    expect(paidSalaryBill?.id).toBeTruthy()
    expect(Number(salaryPayment?.amount ?? 0)).toBe(salaryBillTotalAmount)
    expect(Number(paidSalaryBill?.amount ?? paidSalaryBill?.total_amount ?? 0)).toBe(
      salaryBillTotalAmount
    )
    expect(Number(paidSalaryBill?.paid_amount ?? paidSalaryBill?.paidAmount ?? 0)).toBe(
      salaryBillTotalAmount
    )
    expect(String(paidSalaryBill?.status ?? '').trim().toLowerCase()).toBe('paid')

    await artifact.record('salary_bill', {
      id: paidSalaryBill.id,
      team_id: paidSalaryBill.teamId ?? paidSalaryBill.team_id ?? savedAttendance.team_id ?? null,
      worker_id:
        paidSalaryBill.workerId ??
        paidSalaryBill.worker_id ??
        savedAttendance.worker_id ??
        null,
      bill_type: paidSalaryBill.billType ?? paidSalaryBill.bill_type ?? 'gaji',
      amount: paidSalaryBill.amount ?? paidSalaryBill.total_amount ?? salaryBillTotalAmount,
      paid_amount: paidSalaryBill.paidAmount ?? paidSalaryBill.paid_amount ?? salaryBillTotalAmount,
      due_date: paidSalaryBill.dueDate ?? paidSalaryBill.due_date ?? getAppTodayKey(),
      status: paidSalaryBill.status ?? 'paid',
      paid_at: paidSalaryBill.paidAt ?? paidSalaryBill.paid_at ?? null,
      worker_name_snapshot:
        paidSalaryBill.workerName ??
        paidSalaryBill.worker_name_snapshot ??
        attendanceWorkerName,
      attendance_count: salaryBillAttendanceCount,
      created_at: paidSalaryBill.createdAt ?? paidSalaryBill.created_at ?? null,
      updated_at: paidSalaryBill.updatedAt ?? paidSalaryBill.updated_at ?? null,
    })

    await artifact.record('salary_bill_payment', {
      id: salaryPayment.id,
      bill_id: salaryPayment.billId ?? salaryPayment.bill_id ?? paidSalaryBill.id,
      team_id: salaryPayment.teamId ?? salaryPayment.team_id ?? savedAttendance.team_id ?? null,
      amount: salaryPayment.amount ?? null,
      payment_date: salaryPayment.paymentDate ?? salaryPayment.payment_date ?? null,
      notes: salaryPayment.notes ?? null,
      created_at: salaryPayment.createdAt ?? salaryPayment.created_at ?? null,
      updated_at: salaryPayment.updatedAt ?? salaryPayment.updated_at ?? null,
    })

    await artifact.record('attendance_record', {
      id: savedAttendance.id,
      team_id: savedAttendance.team_id ?? null,
      worker_id: savedAttendance.worker_id ?? null,
      project_id: savedAttendance.project_id ?? null,
      attendance_date: savedAttendance.attendance_date ?? attendanceDate,
      attendance_status: savedAttendance.attendance_status ?? 'full_day',
      total_pay: savedAttendance.total_pay ?? null,
      billing_status: 'billed',
      salary_bill_id: paidSalaryBill.id,
      worker_name_snapshot:
        savedAttendance.worker_name_snapshot ?? savedAttendance.worker_name ?? attendanceWorkerName,
      project_name_snapshot: savedAttendance.project_name_snapshot ?? null,
      created_at: savedAttendance.created_at ?? null,
      updated_at: paidSalaryBill.updatedAt ?? paidSalaryBill.updated_at ?? savedAttendance.updated_at ?? null,
    })

    await expect(page.getByRole('button', { name: 'Simpan Pembayaran' })).toBeVisible({
      timeout: 20000,
    })
    await dismissToastIfVisible(page)

    await artifact.addStep('open_master')
    await openLiveApp(page, '/master')
    await expect(page.getByRole('heading', { name: 'Master' })).toBeVisible({
      timeout: 20000,
    })

    await artifact.addStep('create_funding_creditor')
    await openLiveApp(page, '/master/creditor/add')
    await expect(page).toHaveURL(/\/master\/creditor\/add(?:\?.*)?$/)

    const creditorResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'POST' &&
        response.url().includes('/rest/v1/funding_creditors')
      )
    })

    await page.getByPlaceholder('Contoh: Pak Hendra').fill(creditorName)
    await page.getByPlaceholder('Catatan kreditur jika diperlukan.').fill(creditorNotes)
    await page.getByRole('button', { name: 'Tambah Kreditur' }).click()

    const creditorResponse = await creditorResponsePromise
    expect(creditorResponse.ok()).toBeTruthy()

    const creditor = normalizeInsertedRecord(await parseJsonResponse(creditorResponse))
    expect(creditor?.id).toBeTruthy()

    await artifact.record('funding_creditor', {
      id: creditor.id,
      team_id: creditor.team_id ?? null,
      name: creditor.name ?? null,
      notes: creditor.notes ?? null,
      created_at: creditor.created_at ?? null,
    })

    await expect(page).toHaveURL(/\/master(?:\?.*)?$/)

    await artifact.addStep('create_loan')
    await openLiveApp(page, '/edit/loan/new')
    await expect(page).toHaveURL(/\/edit\/loan\/new(?:\?.*)?$/)
    await expect(page.getByRole('button', { name: /Pilih kreditur/i })).toBeVisible({
      timeout: 20000,
    })

    await page.getByRole('button', { name: /Pilih kreditur/i }).click()
    await page.getByPlaceholder('Cari kreditur...').fill(creditorName)
    await page.getByRole('button', { name: new RegExp(escapeRegExp(creditorName), 'i') }).click()
    await page.locator('input[placeholder="Rp 0"]').first().fill('123456')
    await page.getByText('Catatan opsional').click()
    await page
      .getByPlaceholder('Contoh: Dana talangan untuk pembelian material.')
      .fill(loanNotes)

    const loanResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'POST' &&
        response.url().includes('/api/transactions')
      )
    })

    await page.getByRole('button', { name: 'Simpan Pinjaman' }).click()

    const loanResponse = await loanResponsePromise
    expect(loanResponse.ok()).toBeTruthy()

    const loanPayload = await parseJsonResponse(loanResponse)
    const loan = loanPayload?.record ?? null
    expect(loan?.id).toBeTruthy()

    await artifact.record('loan', {
      id: loan.id,
      team_id: loan.team_id ?? null,
      creditor_id: loan.creditor_id ?? null,
      principal_amount: loan.principal_amount ?? null,
      repayment_amount: loan.repayment_amount ?? null,
      status: loan.status ?? null,
      notes: loan.notes ?? null,
      created_at: loan.created_at ?? null,
    })

    await expect(page.getByText('Pinjaman tersimpan')).toBeVisible({
      timeout: 20000,
    })
    await expect(page.getByText('Data pinjaman berhasil dicatat.')).toBeVisible({
      timeout: 20000,
    })
    await dismissToastIfVisible(page)

    await artifact.addStep('create_project_income')
    await openLiveApp(page, '/edit/project-income/new')
    await expect(page).toHaveURL(/\/edit\/project-income\/new(?:\?.*)?$/)

    const selectedIncomeProjectName = await pickFirstMasterOption(
      page,
      /Pilih proyek/i,
      'Pilih Proyek'
    )

    const projectIncomeResponsePromise = page.waitForResponse((response) =>
      isTransactionsApiResponse(response)
    )

    await page.locator('input[placeholder="Rp 0"]').first().fill(String(projectIncomeAmount))
    await page
      .getByPlaceholder('Contoh: Termin 1 pekerjaan struktur.')
      .fill(projectIncomeDescription)
    await page.getByRole('button', { name: 'Simpan Termin Proyek' }).click()

    const projectIncomeResponse = await projectIncomeResponsePromise
    expect(projectIncomeResponse.ok()).toBeTruthy()

    const projectIncomePayload = await parseJsonResponse(projectIncomeResponse)
    const projectIncome = projectIncomePayload?.record ?? null
    expect(projectIncome?.id).toBeTruthy()

    await artifact.record('project_income', {
      id: projectIncome.id,
      amount: projectIncome.amount ?? null,
      description: projectIncome.description ?? null,
      transaction_date: projectIncome.transaction_date ?? null,
      project_name_snapshot: projectIncome.project_name ?? selectedIncomeProjectName ?? null,
      created_at: projectIncome.created_at ?? null,
      updated_at: projectIncome.updated_at ?? null,
      deleted_at: projectIncome.deleted_at ?? null,
    })

    await artifact.record('project_income_fee_bill', {
      project_income_id: projectIncome.id,
      bill_type: 'fee',
      due_date: projectIncome.transaction_date ?? null,
      project_name_snapshot: projectIncome.project_name ?? selectedIncomeProjectName ?? null,
      expected_min_count: 1,
    })

    await expect(page.getByText('Pemasukan proyek tersimpan')).toBeVisible({
      timeout: 20000,
    })
    await expect(page.getByText('Termin proyek berhasil dicatat.')).toBeVisible({
      timeout: 20000,
    })
    await dismissToastIfVisible(page)

    await artifact.addStep('create_material_invoice')
    await openLiveApp(page, '/material-invoice/new')
    await expect(page).toHaveURL(/\/material-invoice\/new(?:\?.*)?$/)

    const selectedMaterialProjectName = await pickFirstMasterOption(
      page,
      /Pilih proyek/i,
      'Pilih Proyek'
    )
    const selectedMaterialSupplierName = await pickFirstMasterOption(
      page,
      /Pilih supplier material/i,
      'Pilih Supplier Material'
    )
    const selectedMaterialName = await pickFirstMasterOption(
      page,
      /Pilih material/i,
      'Pilih Material 1'
    )

    await page.getByRole('button', { name: 'Hutang' }).click()
    await page.getByLabel('Qty').fill(String(materialInvoiceQty))
    await page.getByLabel('Harga Satuan').fill(String(materialInvoiceUnitPrice))
    await page
      .getByPlaceholder('Tambahkan konteks singkat untuk invoice material ini.')
      .fill(materialInvoiceDescription)

    const materialInvoiceResponsePromise = page.waitForResponse((response) =>
      isRecordsApiResponse(response, 'material-invoices')
    )

    await page.getByRole('button', { name: 'Simpan Faktur Material' }).click()

    const materialInvoiceResponse = await materialInvoiceResponsePromise
    expect(materialInvoiceResponse.ok()).toBeTruthy()

    const materialInvoicePayload = await parseJsonResponse(materialInvoiceResponse)
    const materialInvoice = materialInvoicePayload?.expense ?? null
    const materialInvoiceItems = Array.isArray(materialInvoicePayload?.items)
      ? materialInvoicePayload.items
      : []
    const firstMaterialInvoiceItem = materialInvoiceItems[0] ?? null

    expect(materialInvoice?.id).toBeTruthy()
    expect(firstMaterialInvoiceItem?.material_id).toBeTruthy()

    await artifact.record('material_invoice', {
      id: materialInvoice.id,
      team_id: materialInvoice.team_id ?? null,
      project_id: materialInvoice.project_id ?? null,
      supplier_id: materialInvoice.supplier_id ?? null,
      amount: materialInvoice.amount ?? materialInvoice.total_amount ?? materialInvoiceLineTotal,
      total_amount:
        materialInvoice.total_amount ?? materialInvoice.amount ?? materialInvoiceLineTotal,
      status: materialInvoice.status ?? 'unpaid',
      expense_date: materialInvoice.expense_date ?? null,
      description: materialInvoice.description ?? null,
      notes: materialInvoice.notes ?? null,
      expense_type: materialInvoice.expense_type ?? null,
      document_type: materialInvoice.document_type ?? 'faktur',
      project_name_snapshot:
        materialInvoice.project_name_snapshot ?? selectedMaterialProjectName ?? null,
      supplier_name_snapshot:
        materialInvoice.supplier_name_snapshot ?? selectedMaterialSupplierName ?? null,
      created_at: materialInvoice.created_at ?? null,
      updated_at: materialInvoice.updated_at ?? null,
    })

    await artifact.record('material_invoice_bill', {
      expense_id: materialInvoice.id,
      bill_type: materialInvoice.expense_type ?? 'material',
      amount: materialInvoice.amount ?? materialInvoice.total_amount ?? materialInvoiceLineTotal,
      due_date: materialInvoice.expense_date ?? null,
      status: 'unpaid',
      project_name_snapshot:
        materialInvoice.project_name_snapshot ?? selectedMaterialProjectName ?? null,
      supplier_name_snapshot:
        materialInvoice.supplier_name_snapshot ?? selectedMaterialSupplierName ?? null,
    })

    await artifact.record('material_invoice_line_item', {
      expense_id: materialInvoice.id,
      material_id: firstMaterialInvoiceItem.material_id ?? null,
      item_name: firstMaterialInvoiceItem.item_name ?? selectedMaterialName ?? null,
      qty: firstMaterialInvoiceItem.qty ?? materialInvoiceQty,
      unit_price: firstMaterialInvoiceItem.unit_price ?? materialInvoiceUnitPrice,
      line_total: firstMaterialInvoiceItem.line_total ?? materialInvoiceLineTotal,
      material_name: selectedMaterialName || null,
    })

    await artifact.record('material_stock_transaction', {
      expense_id: materialInvoice.id,
      material_id: firstMaterialInvoiceItem.material_id ?? null,
      quantity: firstMaterialInvoiceItem.qty ?? materialInvoiceQty,
      direction: 'in',
      source_type: 'invoice',
    })

    await expect(page.getByText('Faktur material tersimpan')).toBeVisible({
      timeout: 20000,
    })
    await expect(page.getByText('Faktur material berhasil dicatat.')).toBeVisible({
      timeout: 20000,
    })
    await dismissToastIfVisible(page)

    await artifact.addStep('create_expense')
    await openLiveApp(page, '/edit/expense/new')
    await expect(page).toHaveURL(/\/edit\/expense\/new(?:\?.*)?$/)

    const selectedProjectName = await pickFirstMasterOption(page, /Pilih proyek/i, 'Pilih Proyek')
    const selectedCategoryName = await pickFirstMasterOption(page, /Pilih kategori/i, 'Pilih Kategori')
    const selectedSupplierName = await pickFirstMasterOption(page, /Pilih supplier/i, 'Pilih Supplier')

    await page.locator('input[placeholder="Rp 0"]').first().fill(String(expenseAmount))
    await page.getByPlaceholder('Contoh: Pembelian alat kerja lapangan.').fill(expenseDescription)
    await page.getByPlaceholder('Catatan tambahan opsional.').fill(expenseNotes)

    const expenseResponsePromise = page.waitForResponse((response) =>
      isRecordsApiResponse(response, 'expenses')
    )

    await page.getByRole('button', { name: 'Simpan Pengeluaran' }).click()

    const expenseResponse = await expenseResponsePromise
    expect(expenseResponse.ok()).toBeTruthy()

    const expensePayload = await parseJsonResponse(expenseResponse)
    const expense = expensePayload?.expense ?? null
    expect(expense?.id).toBeTruthy()
    expect(expense?.bill?.id).toBeTruthy()

    await artifact.record('expense', {
      id: expense.id,
      team_id: expense.team_id ?? null,
      project_id: expense.project_id ?? null,
      category_id: expense.category_id ?? null,
      supplier_id: expense.supplier_id ?? null,
      bill_id: expense.bill?.id ?? null,
      amount: expense.amount ?? null,
      total_amount: expense.total_amount ?? null,
      status: expense.status ?? null,
      expense_date: expense.expense_date ?? null,
      description: expense.description ?? null,
      notes: expense.notes ?? null,
      project_name_snapshot: expense.project_name_snapshot ?? selectedProjectName ?? null,
      supplier_name_snapshot: expense.supplier_name_snapshot ?? selectedSupplierName ?? null,
      category_name: selectedCategoryName || null,
      created_at: expense.created_at ?? null,
      bill_status_before_payment: expense.bill?.status ?? null,
      bill_paid_amount_before_payment: expense.bill?.paid_amount ?? null,
    })

    await expect(page.getByText('Pengeluaran tersimpan')).toBeVisible({
      timeout: 20000,
    })
    await expect(page.getByText('Pengeluaran berhasil dicatat.')).toBeVisible({
      timeout: 20000,
    })
    await dismissToastIfVisible(page)

    await artifact.addStep('create_expense_bill_payment')
    await openLiveApp(page, `/payment/${expense.bill.id}`)
    await expect(page).toHaveURL(new RegExp(`/payment/${escapeRegExp(expense.bill.id)}(?:\\?.*)?$`))
    await expect(page.getByRole('heading', { name: 'Pembayaran Tagihan' })).toBeVisible({
      timeout: 20000,
    })
    await expect(page.getByRole('heading', { name: new RegExp(escapeRegExp(selectedSupplierName), 'i') })).toBeVisible({
      timeout: 20000,
    })

    const billPaymentResponsePromise = page.waitForResponse((response) =>
      isRecordsApiResponse(response, 'bill-payments')
    )

    await page.getByLabel('Nominal Pembayaran').fill(String(expensePaymentAmount))
    await page.getByLabel('Catatan').fill(expensePaymentNotes)
    await page.getByRole('button', { name: 'Simpan Pembayaran' }).click()

    const billPaymentResponse = await billPaymentResponsePromise
    expect(billPaymentResponse.ok()).toBeTruthy()

    const billPaymentPayload = await parseJsonResponse(billPaymentResponse)
    const billPayment = billPaymentPayload?.payment ?? null
    const paidBill = billPaymentPayload?.bill ?? null
    expect(billPayment?.id).toBeTruthy()
    expect(paidBill?.id).toBeTruthy()

    await artifact.record('bill_payment', {
      id: billPayment.id,
      bill_id: billPayment.billId ?? billPayment.bill_id ?? expense.bill.id,
      team_id: billPayment.teamId ?? billPayment.team_id ?? null,
      amount: billPayment.amount ?? null,
      payment_date: billPayment.paymentDate ?? billPayment.payment_date ?? null,
      notes: billPayment.notes ?? null,
      created_at: billPayment.createdAt ?? billPayment.created_at ?? null,
    })

    await artifact.record('expense_bill_after_payment', {
      id: paidBill.id,
      expense_id: paidBill.expenseId ?? paidBill.expense_id ?? expense.id,
      amount: paidBill.amount ?? null,
      paid_amount: paidBill.paidAmount ?? paidBill.paid_amount ?? null,
      remaining_amount:
        paidBill.remainingAmount ?? paidBill.remaining_amount ?? expenseAmount - expensePaymentAmount,
      status: paidBill.status ?? null,
      due_date: paidBill.dueDate ?? paidBill.due_date ?? null,
      paid_at: paidBill.paidAt ?? paidBill.paid_at ?? null,
    })

    await expect(page.getByText('Pembayaran tagihan tersimpan')).toBeVisible({
      timeout: 20000,
    })
    await expect(page.getByText('Pembayaran tagihan berhasil dicatat.')).toBeVisible({
      timeout: 20000,
    })
    await expect(page.getByText(buildCurrencyPattern(expensePaymentAmount)).first()).toBeVisible({
      timeout: 20000,
    })
    await expect(
      page.getByText(buildCurrencyPattern(expenseAmount - expensePaymentAmount)).first()
    ).toBeVisible({
      timeout: 20000,
    })
    await dismissToastIfVisible(page)

    await artifact.addStep('create_team_invite')
    await openLiveApp(page, '/more/team-invite')
    await expect(page).toHaveURL(/\/more\/team-invite(?:\?.*)?$/)
    await expect(page.getByText('Magic Invite Link')).toBeVisible({
      timeout: 20000,
    })

    const inviteResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'POST' &&
        response.url().includes('/rest/v1/invite_tokens')
      )
    })

    await page.getByRole('button', { name: 'Buat Link Undangan' }).click()

    const inviteResponse = await inviteResponsePromise
    expect(inviteResponse.ok()).toBeTruthy()

    const invite = normalizeInsertedRecord(await parseJsonResponse(inviteResponse))
    expect(invite?.id).toBeTruthy()

    await expect(page.getByText('Link terbaru')).toBeVisible({
      timeout: 20000,
    })

    const inviteLinkText = (
      await page.getByText(/https:\/\/t\.me\/.+\?startapp=inv_/).first().textContent()
    )?.trim()

    await artifact.record('invite_token', {
      id: invite.id,
      team_id: invite.team_id ?? null,
      role: invite.role ?? null,
      token: invite.token ?? null,
      expires_at: invite.expires_at ?? null,
      created_at: invite.created_at ?? null,
      invite_link: inviteLinkText ?? null,
    })

    await artifact.addStep('completed', {
      status: 'ready_for_verification',
      artifact_path: artifact.artifactPath,
    })
  })
})
