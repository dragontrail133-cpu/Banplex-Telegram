import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'test-results',
  'live-smoke-created-records.json'
)
const DEFAULT_OUTPUT_PATH = path.resolve(
  process.cwd(),
  'test-results',
  'live-smoke-verification.json'
)

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function getEnv(name, fallback = null) {
  return normalizeText(process.env[name], fallback)
}

function parseDotEnvValue(rawValue) {
  const trimmedValue = String(rawValue ?? '').trim()

  if (
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1)
  }

  return trimmedValue
}

async function loadEnvFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')

    for (const line of raw.split(/\r?\n/gu)) {
      const trimmedLine = line.trim()

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue
      }

      const match = trimmedLine.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u)

      if (!match) {
        continue
      }

      const [, name, rawValue] = match

      if (normalizeText(process.env[name], null)) {
        continue
      }

      process.env[name] = parseDotEnvValue(rawValue)
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }
  }
}

async function loadLocalEnvIfNeeded() {
  await loadEnvFile(path.resolve(process.cwd(), '.env'))
  await loadEnvFile(path.resolve(process.cwd(), '.env.local'))
}

function parseArgs(argv) {
  const options = {
    artifactPath: DEFAULT_ARTIFACT_PATH,
    outputPath: DEFAULT_OUTPUT_PATH,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '-h' || token === '--help') {
      options.help = true
      continue
    }

    if (token === '--artifact') {
      options.artifactPath = path.resolve(argv[++index])
      continue
    }

    if (token === '--output') {
      options.outputPath = path.resolve(argv[++index])
      continue
    }

    throw new Error(`Argumen tidak dikenal: ${token}`)
  }

  return options
}

function printUsage() {
  console.log(`Verify live smoke artifacts against Supabase

Usage:
  node scripts/aq/verify-live-smoke.mjs --artifact ./test-results/live-smoke-created-records.json

Options:
  --artifact <path>   Artifact file from tests/live/release-smoke.spec.js
  --output <path>     Output verification report JSON
  -h, --help          Show this help

Environment:
  E2E_VERIFY_SUPABASE_URL or VITE_SUPABASE_URL
  E2E_VERIFY_SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY
`)
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function createVerifierClient() {
  const supabaseUrl = getEnv('E2E_VERIFY_SUPABASE_URL', getEnv('VITE_SUPABASE_URL'))
  const serviceRoleKey = getEnv(
    'E2E_VERIFY_SUPABASE_SERVICE_ROLE_KEY',
    getEnv('SUPABASE_SERVICE_ROLE_KEY')
  )

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Env verifier belum lengkap. Set E2E_VERIFY_SUPABASE_URL dan E2E_VERIFY_SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function createCheckResult(name, ok, detail = {}) {
  return {
    name,
    ok,
    ...detail,
  }
}

async function verifyExpense(client, artifact, smokePrefix) {
  const record = artifact.records?.expense

  if (!record?.id) {
    return createCheckResult('expense', false, {
      reason: 'Artifact expense.id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('expenses')
    .select(
      'id, team_id, project_id, category_id, supplier_id, status, expense_date, amount, total_amount, description, notes, deleted_at, created_at'
    )
    .eq('id', record.id)
    .maybeSingle()

  if (error) {
    return createCheckResult('expense', false, {
      reason: error.message,
      record_id: record.id,
    })
  }

  if (!data) {
    return createCheckResult('expense', false, {
      reason: 'Row expenses tidak ditemukan.',
      record_id: record.id,
    })
  }

  const amountMatches = Number(data.amount ?? data.total_amount) === Number(record.amount ?? record.total_amount)
  const descriptionMatches = normalizeText(data.description, '') === normalizeText(record.description, '')
  const notesMatches = normalizeText(data.notes, '') === normalizeText(record.notes, '')
  const prefixMatches = [data.description, data.notes].some((value) =>
    normalizeText(value, '').includes(smokePrefix)
  )

  return createCheckResult(
    'expense',
    Boolean(
      amountMatches &&
        descriptionMatches &&
        notesMatches &&
        normalizeText(data.status, '') === normalizeText(record.status, 'unpaid') &&
        !data.deleted_at &&
        prefixMatches
    ),
    {
      record_id: data.id,
      team_id: data.team_id,
      deleted_at: data.deleted_at,
      actual_status: data.status,
      actual_amount: data.amount ?? data.total_amount,
      actual_description: data.description,
      actual_notes: data.notes,
    }
  )
}

async function verifyExpenseBill(client, artifact) {
  const record = artifact.records?.expense_bill_after_payment
  const expenseRecord = artifact.records?.expense
  const paymentRecord = artifact.records?.bill_payment

  if (!record?.id) {
    return createCheckResult('expense_bill_after_payment', false, {
      reason: 'Artifact expense_bill_after_payment.id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('bills')
    .select('id, expense_id, team_id, amount, paid_amount, due_date, status, paid_at, deleted_at')
    .eq('id', record.id)
    .maybeSingle()

  if (error) {
    return createCheckResult('expense_bill_after_payment', false, {
      reason: error.message,
      record_id: record.id,
    })
  }

  if (!data) {
    return createCheckResult('expense_bill_after_payment', false, {
      reason: 'Row bills tidak ditemukan.',
      record_id: record.id,
    })
  }

  const amountMatches = Number(data.amount) === Number(record.amount ?? expenseRecord?.amount)
  const paidMatches = Number(data.paid_amount) === Number(record.paid_amount ?? paymentRecord?.amount)
  const expenseMatches =
    normalizeText(data.expense_id, '') === normalizeText(record.expense_id ?? expenseRecord?.id, '')
  const dueDateMatches =
    normalizeText(data.due_date, '') ===
    normalizeText(record.due_date ?? expenseRecord?.expense_date, '')
  const remainingAmount = Number(data.amount) - Number(data.paid_amount)

  return createCheckResult(
    'expense_bill_after_payment',
    Boolean(
      amountMatches &&
        paidMatches &&
        expenseMatches &&
        dueDateMatches &&
        normalizeText(data.status, '') === 'partial' &&
        !data.deleted_at &&
        remainingAmount > 0
    ),
    {
      record_id: data.id,
      team_id: data.team_id,
      deleted_at: data.deleted_at,
      actual_status: data.status,
      actual_amount: data.amount,
      actual_paid_amount: data.paid_amount,
      actual_due_date: data.due_date,
      actual_paid_at: data.paid_at,
    }
  )
}

async function verifyBillPayment(client, artifact, recordKey = 'bill_payment') {
  const record = artifact.records?.[recordKey]

  if (!record?.id) {
    return createCheckResult(recordKey, false, {
      reason: `Artifact ${recordKey}.id tidak ditemukan.`,
    })
  }

  const { data, error } = await client
    .from('bill_payments')
    .select('id, bill_id, team_id, amount, payment_date, notes, deleted_at, created_at')
    .eq('id', record.id)
    .maybeSingle()

  if (error) {
    return createCheckResult(recordKey, false, {
      reason: error.message,
      record_id: record.id,
    })
  }

  if (!data) {
    return createCheckResult(recordKey, false, {
      reason: 'Row bill_payments tidak ditemukan.',
      record_id: record.id,
    })
  }

  const billMatches = normalizeText(data.bill_id, '') === normalizeText(record.bill_id, '')
  const amountMatches = Number(data.amount) === Number(record.amount)
  const paymentDateMatches = normalizeText(data.payment_date, '') === normalizeText(record.payment_date, '')
  const notesMatches = normalizeText(data.notes, '') === normalizeText(record.notes, '')

  return createCheckResult(
    recordKey,
    Boolean(billMatches && amountMatches && paymentDateMatches && notesMatches && !data.deleted_at),
    {
      record_id: data.id,
      team_id: data.team_id,
      deleted_at: data.deleted_at,
      actual_amount: data.amount,
      actual_payment_date: data.payment_date,
      actual_notes: data.notes,
    }
  )
}

async function verifyAttendanceRecord(client, artifact) {
  const record = artifact.records?.attendance_record

  if (!record?.id) {
    return createCheckResult('attendance_record', false, {
      reason: 'Artifact attendance_record.id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('attendance_records')
    .select(
      'id, team_id, worker_id, project_id, attendance_date, attendance_status, total_pay, billing_status, salary_bill_id, worker_name_snapshot, project_name_snapshot, deleted_at, created_at, updated_at'
    )
    .eq('id', record.id)
    .maybeSingle()

  if (error) {
    return createCheckResult('attendance_record', false, {
      reason: error.message,
      record_id: record.id,
    })
  }

  if (!data) {
    return createCheckResult('attendance_record', false, {
      reason: 'Row attendance_records tidak ditemukan.',
      record_id: record.id,
    })
  }

  const billIdMatches =
    normalizeText(data.salary_bill_id, '') ===
    normalizeText(record.salary_bill_id ?? artifact.records?.salary_bill?.id, '')
  const attendanceDateMatches =
    normalizeText(data.attendance_date, '') === normalizeText(record.attendance_date, '')
  const attendanceStatusMatches =
    normalizeText(data.attendance_status, '') === normalizeText(record.attendance_status, '')
  const workerMatches = normalizeText(data.worker_id, '') === normalizeText(record.worker_id, '')
  const projectMatches = normalizeText(data.project_id, '') === normalizeText(record.project_id, '')
  const amountMatches = Number(data.total_pay) === Number(record.total_pay)
  const billingStatusMatches = normalizeText(data.billing_status, '') === 'billed'

  return createCheckResult(
    'attendance_record',
    Boolean(
      billIdMatches &&
        attendanceDateMatches &&
        attendanceStatusMatches &&
        workerMatches &&
        projectMatches &&
        amountMatches &&
        billingStatusMatches &&
        !data.deleted_at
    ),
    {
      record_id: data.id,
      team_id: data.team_id,
      deleted_at: data.deleted_at,
      actual_billing_status: data.billing_status,
      actual_salary_bill_id: data.salary_bill_id,
      actual_attendance_date: data.attendance_date,
      actual_attendance_status: data.attendance_status,
      actual_total_pay: data.total_pay,
    }
  )
}

async function verifySalaryBill(client, artifact) {
  const record = artifact.records?.salary_bill

  if (!record?.id) {
    return createCheckResult('salary_bill', false, {
      reason: 'Artifact salary_bill.id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('bills')
    .select(
      'id, team_id, worker_id, bill_type, amount, paid_amount, due_date, status, paid_at, description, worker_name_snapshot, deleted_at, created_at, updated_at'
    )
    .eq('id', record.id)
    .maybeSingle()

  if (error) {
    return createCheckResult('salary_bill', false, {
      reason: error.message,
      record_id: record.id,
    })
  }

  if (!data) {
    return createCheckResult('salary_bill', false, {
      reason: 'Row bills untuk salary bill tidak ditemukan.',
      record_id: record.id,
    })
  }

  const amountMatches = Number(data.amount) === Number(record.amount)
  const paidMatches = Number(data.paid_amount) === Number(record.paid_amount ?? record.amount)
  const dueDateMatches = normalizeText(data.due_date, '') === normalizeText(record.due_date, '')
  const workerIdMatches = record.worker_id
    ? normalizeText(data.worker_id, '') === normalizeText(record.worker_id, '')
    : true
  const workerNameMatches = record.worker_name_snapshot
    ? normalizeText(data.worker_name_snapshot, '') ===
      normalizeText(record.worker_name_snapshot, '')
    : true
  const statusMatches = normalizeText(data.status, '') === normalizeText(record.status, 'paid')

  return createCheckResult(
    'salary_bill',
      Boolean(
        amountMatches &&
        paidMatches &&
        dueDateMatches &&
        workerIdMatches &&
        workerNameMatches &&
        statusMatches &&
        normalizeText(data.bill_type, '') === normalizeText(record.bill_type, 'gaji') &&
        normalizeText(data.paid_at, '') !== '' &&
        !data.deleted_at
    ),
    {
      record_id: data.id,
      team_id: data.team_id,
      deleted_at: data.deleted_at,
      actual_bill_type: data.bill_type,
      actual_status: data.status,
      actual_amount: data.amount,
      actual_paid_amount: data.paid_amount,
      actual_due_date: data.due_date,
      actual_paid_at: data.paid_at,
    }
  )
}

async function verifyProjectIncome(client, artifact, smokePrefix) {
  const record = artifact.records?.project_income

  if (!record?.id) {
    return createCheckResult('project_income', false, {
      reason: 'Artifact project_income.id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('project_incomes')
    .select(
      'id, team_id, project_id, transaction_date, income_date, amount, description, notes, project_name_snapshot, deleted_at, created_at, updated_at'
    )
    .eq('id', record.id)
    .maybeSingle()

  if (error) {
    return createCheckResult('project_income', false, {
      reason: error.message,
      record_id: record.id,
    })
  }

  if (!data) {
    return createCheckResult('project_income', false, {
      reason: 'Row project_incomes tidak ditemukan.',
      record_id: record.id,
    })
  }

  const amountMatches = Number(data.amount) === Number(record.amount)
  const descriptionMatches =
    normalizeText(data.description, '') === normalizeText(record.description, '')
  const projectMatches =
    normalizeText(data.project_name_snapshot, '') ===
    normalizeText(record.project_name_snapshot, '')
  const dateMatches =
    normalizeText(data.transaction_date ?? data.income_date, '') ===
    normalizeText(record.transaction_date, '')
  const prefixMatches = normalizeText(data.description, '').includes(smokePrefix)

  return createCheckResult(
    'project_income',
    Boolean(
      amountMatches &&
        descriptionMatches &&
        projectMatches &&
        dateMatches &&
        prefixMatches &&
        !data.deleted_at
    ),
    {
      record_id: data.id,
      team_id: data.team_id,
      deleted_at: data.deleted_at,
      actual_amount: data.amount,
      actual_description: data.description,
      actual_project_name_snapshot: data.project_name_snapshot,
      actual_transaction_date: data.transaction_date ?? data.income_date,
    }
  )
}

async function verifyProjectIncomeFeeBill(client, artifact) {
  const record = artifact.records?.project_income_fee_bill
  const projectIncomeRecord = artifact.records?.project_income

  if (!record?.project_income_id) {
    return createCheckResult('project_income_fee_bill', false, {
      reason: 'Artifact project_income_fee_bill.project_income_id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('bills')
    .select(
      'id, project_income_id, team_id, bill_type, description, amount, paid_amount, due_date, status, worker_name_snapshot, project_name_snapshot, deleted_at'
    )
    .eq('project_income_id', record.project_income_id)
    .eq('bill_type', 'fee')
    .is('deleted_at', null)

  if (error) {
    return createCheckResult('project_income_fee_bill', false, {
      reason: error.message,
      record_id: record.project_income_id,
    })
  }

  const bills = Array.isArray(data) ? data : []
  const expectedMinCount = Number(record.expected_min_count ?? 1)
  const dueDate = normalizeText(record.due_date ?? projectIncomeRecord?.transaction_date, '')
  const expectedProjectName = normalizeText(
    record.project_name_snapshot ?? projectIncomeRecord?.project_name_snapshot,
    ''
  )
  const validBills = bills.filter((bill) => {
    const dueDateMatches = normalizeText(bill.due_date, '') === dueDate
    const amountIsPositive = Number(bill.amount) > 0
    const paidAmountIsZero = Number(bill.paid_amount ?? 0) === 0
    const statusMatches = normalizeText(bill.status, '') === 'unpaid'
    const projectMatches =
      normalizeText(bill.project_name_snapshot, '') === expectedProjectName

    return dueDateMatches && amountIsPositive && paidAmountIsZero && statusMatches && projectMatches
  })

  return createCheckResult(
    'project_income_fee_bill',
    Boolean(validBills.length >= expectedMinCount),
    {
      record_id: record.project_income_id,
      bill_count: bills.length,
      matching_bill_count: validBills.length,
      sample_bill_id: validBills[0]?.id ?? bills[0]?.id ?? null,
      expected_due_date: dueDate,
      expected_project_name_snapshot: expectedProjectName,
    }
  )
}

async function verifyFundingCreditor(client, artifact, smokePrefix) {
  const record = artifact.records?.funding_creditor

  if (!record?.id) {
    return createCheckResult('funding_creditor', false, {
      reason: 'Artifact funding_creditor.id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('funding_creditors')
    .select('id, team_id, name, notes, deleted_at, created_at')
    .eq('id', record.id)
    .maybeSingle()

  if (error) {
    return createCheckResult('funding_creditor', false, {
      reason: error.message,
      record_id: record.id,
    })
  }

  if (!data) {
    return createCheckResult('funding_creditor', false, {
      reason: 'Row funding_creditors tidak ditemukan.',
      record_id: record.id,
    })
  }

  const nameMatches = normalizeText(data.name, '') === normalizeText(record.name, '')
  const prefixMatches = [data.name, data.notes].some((value) =>
    normalizeText(value, '').includes(smokePrefix)
  )

  return createCheckResult(
    'funding_creditor',
    Boolean(nameMatches && prefixMatches && !data.deleted_at),
    {
      record_id: data.id,
      team_id: data.team_id,
      deleted_at: data.deleted_at,
      expected_name: record.name,
      actual_name: data.name,
      prefix_matches: prefixMatches,
    }
  )
}

async function verifyMaterialInvoice(client, artifact, smokePrefix) {
  const record = artifact.records?.material_invoice

  if (!record?.id) {
    return createCheckResult('material_invoice', false, {
      reason: 'Artifact material_invoice.id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('expenses')
    .select(
      'id, team_id, project_id, supplier_id, expense_type, document_type, status, expense_date, amount, total_amount, description, notes, project_name_snapshot, supplier_name_snapshot, deleted_at, created_at, updated_at'
    )
    .eq('id', record.id)
    .maybeSingle()

  if (error) {
    return createCheckResult('material_invoice', false, {
      reason: error.message,
      record_id: record.id,
    })
  }

  if (!data) {
    return createCheckResult('material_invoice', false, {
      reason: 'Row expenses untuk material invoice tidak ditemukan.',
      record_id: record.id,
    })
  }

  const totalMatches = Number(data.amount ?? data.total_amount) === Number(record.amount ?? record.total_amount)
  const descriptionMatches =
    normalizeText(data.description, '') === normalizeText(record.description, '')
  const projectMatches =
    normalizeText(data.project_name_snapshot, '') ===
    normalizeText(record.project_name_snapshot, '')
  const supplierMatches =
    normalizeText(data.supplier_name_snapshot, '') ===
    normalizeText(record.supplier_name_snapshot, '')
  const prefixMatches = normalizeText(data.description, '').includes(smokePrefix)

  return createCheckResult(
    'material_invoice',
    Boolean(
      totalMatches &&
        descriptionMatches &&
        projectMatches &&
        supplierMatches &&
        normalizeText(data.expense_type, '') === 'material' &&
        normalizeText(data.document_type, '') === 'faktur' &&
        normalizeText(data.status, '') === 'unpaid' &&
        !data.deleted_at &&
        prefixMatches
    ),
    {
      record_id: data.id,
      team_id: data.team_id,
      deleted_at: data.deleted_at,
      actual_expense_type: data.expense_type,
      actual_document_type: data.document_type,
      actual_status: data.status,
      actual_amount: data.amount ?? data.total_amount,
      actual_description: data.description,
    }
  )
}

async function verifyMaterialInvoiceBill(client, artifact) {
  const record = artifact.records?.material_invoice_bill
  const materialInvoiceRecord = artifact.records?.material_invoice

  if (!record?.expense_id) {
    return createCheckResult('material_invoice_bill', false, {
      reason: 'Artifact material_invoice_bill.expense_id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('bills')
    .select(
      'id, expense_id, team_id, bill_type, amount, paid_amount, due_date, status, supplier_name_snapshot, project_name_snapshot, deleted_at'
    )
    .eq('expense_id', record.expense_id)
    .maybeSingle()

  if (error) {
    return createCheckResult('material_invoice_bill', false, {
      reason: error.message,
      record_id: record.expense_id,
    })
  }

  if (!data) {
    return createCheckResult('material_invoice_bill', false, {
      reason: 'Row bills untuk material invoice tidak ditemukan.',
      record_id: record.expense_id,
    })
  }

  const amountMatches = Number(data.amount) === Number(record.amount ?? materialInvoiceRecord?.amount)
  const dueDateMatches =
    normalizeText(data.due_date, '') ===
    normalizeText(record.due_date ?? materialInvoiceRecord?.expense_date, '')
  const projectMatches =
    normalizeText(data.project_name_snapshot, '') ===
    normalizeText(record.project_name_snapshot ?? materialInvoiceRecord?.project_name_snapshot, '')
  const supplierMatches =
    normalizeText(data.supplier_name_snapshot, '') ===
    normalizeText(record.supplier_name_snapshot ?? materialInvoiceRecord?.supplier_name_snapshot, '')

  return createCheckResult(
    'material_invoice_bill',
    Boolean(
      amountMatches &&
        dueDateMatches &&
        projectMatches &&
        supplierMatches &&
        normalizeText(data.bill_type, '') === normalizeText(record.bill_type, 'material') &&
        normalizeText(data.status, '') === 'unpaid' &&
        Number(data.paid_amount ?? 0) === 0 &&
        !data.deleted_at
    ),
    {
      record_id: data.id,
      team_id: data.team_id,
      deleted_at: data.deleted_at,
      actual_bill_type: data.bill_type,
      actual_status: data.status,
      actual_amount: data.amount,
      actual_due_date: data.due_date,
    }
  )
}

async function verifyMaterialInvoiceLineItem(client, artifact) {
  const record = artifact.records?.material_invoice_line_item
  const materialInvoiceRecord = artifact.records?.material_invoice

  if (!record?.expense_id) {
    return createCheckResult('material_invoice_line_item', false, {
      reason: 'Artifact material_invoice_line_item.expense_id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('expense_line_items')
    .select('id, expense_id, material_id, item_name, qty, unit_price, line_total, deleted_at')
    .eq('expense_id', record.expense_id)
    .is('deleted_at', null)

  if (error) {
    return createCheckResult('material_invoice_line_item', false, {
      reason: error.message,
      record_id: record.expense_id,
    })
  }

  const lineItems = Array.isArray(data) ? data : []
  const matchedLineItem = lineItems.find((lineItem) => {
    const materialMatches =
      normalizeText(lineItem.material_id, '') === normalizeText(record.material_id, '')
    const qtyMatches = Number(lineItem.qty) === Number(record.qty)
    const unitPriceMatches = Number(lineItem.unit_price) === Number(record.unit_price)
    const lineTotalMatches = Number(lineItem.line_total) === Number(record.line_total)

    return materialMatches && qtyMatches && unitPriceMatches && lineTotalMatches
  })

  return createCheckResult(
    'material_invoice_line_item',
    Boolean(matchedLineItem && lineItems.length > 0),
    {
      record_id: matchedLineItem?.id ?? null,
      expense_id: record.expense_id ?? materialInvoiceRecord?.id ?? null,
      item_count: lineItems.length,
      actual_item_name: matchedLineItem?.item_name ?? null,
    }
  )
}

async function verifyMaterialStockTransaction(client, artifact) {
  const record = artifact.records?.material_stock_transaction

  if (!record?.expense_id) {
    return createCheckResult('material_stock_transaction', false, {
      reason: 'Artifact material_stock_transaction.expense_id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('stock_transactions')
    .select('id, expense_id, material_id, quantity, direction, source_type')
    .eq('expense_id', record.expense_id)

  if (error) {
    return createCheckResult('material_stock_transaction', false, {
      reason: error.message,
      record_id: record.expense_id,
    })
  }

  const transactions = Array.isArray(data) ? data : []
  const matchedTransaction = transactions.find((transaction) => {
    return (
      normalizeText(transaction.material_id, '') === normalizeText(record.material_id, '') &&
      Number(transaction.quantity) === Number(record.quantity) &&
      normalizeText(transaction.direction, '') === normalizeText(record.direction, 'in') &&
      normalizeText(transaction.source_type, '') === normalizeText(record.source_type, 'invoice')
    )
  })

  return createCheckResult(
    'material_stock_transaction',
    Boolean(matchedTransaction),
    {
      record_id: matchedTransaction?.id ?? null,
      expense_id: record.expense_id,
      transaction_count: transactions.length,
      actual_direction: matchedTransaction?.direction ?? null,
      actual_source_type: matchedTransaction?.source_type ?? null,
    }
  )
}

async function verifyLoan(client, artifact) {
  const record = artifact.records?.loan

  if (!record?.id) {
    return createCheckResult('loan', false, {
      reason: 'Artifact loan.id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('loans')
    .select(
      'id, team_id, creditor_id, principal_amount, repayment_amount, status, notes, deleted_at, created_at'
    )
    .eq('id', record.id)
    .maybeSingle()

  if (error) {
    return createCheckResult('loan', false, {
      reason: error.message,
      record_id: record.id,
    })
  }

  if (!data) {
    return createCheckResult('loan', false, {
      reason: 'Row loans tidak ditemukan.',
      record_id: record.id,
    })
  }

  const principalMatches = Number(data.principal_amount) === Number(record.principal_amount)
  const creditorMatches = normalizeText(data.creditor_id, '') === normalizeText(record.creditor_id, '')
  const noteMatches = normalizeText(data.notes, '') === normalizeText(record.notes, '')

  return createCheckResult(
    'loan',
    Boolean(
      principalMatches &&
        creditorMatches &&
        noteMatches &&
        normalizeText(data.status, '') === 'unpaid' &&
        !data.deleted_at
    ),
    {
      record_id: data.id,
      team_id: data.team_id,
      creditor_id: data.creditor_id,
      deleted_at: data.deleted_at,
      actual_status: data.status,
      actual_principal_amount: data.principal_amount,
      actual_notes: data.notes,
    }
  )
}

async function verifyInviteToken(client, artifact) {
  const record = artifact.records?.invite_token

  if (!record?.id) {
    return createCheckResult('invite_token', false, {
      reason: 'Artifact invite_token.id tidak ditemukan.',
    })
  }

  const { data, error } = await client
    .from('invite_tokens')
    .select('id, team_id, token, role, is_used, expires_at, created_at')
    .eq('id', record.id)
    .maybeSingle()

  if (error) {
    return createCheckResult('invite_token', false, {
      reason: error.message,
      record_id: record.id,
    })
  }

  if (!data) {
    return createCheckResult('invite_token', false, {
      reason: 'Row invite_tokens tidak ditemukan.',
      record_id: record.id,
    })
  }

  const tokenMatches = normalizeText(data.token, '') === normalizeText(record.token, '')
  const roleMatches = normalizeText(data.role, '') === normalizeText(record.role, '')

  return createCheckResult(
    'invite_token',
    Boolean(tokenMatches && roleMatches && data.is_used === false),
    {
      record_id: data.id,
      team_id: data.team_id,
      token: data.token,
      role: data.role,
      is_used: data.is_used,
      expires_at: data.expires_at,
    }
  )
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  await loadLocalEnvIfNeeded()

  const artifact = await readJson(options.artifactPath)
  const client = createVerifierClient()
  const smokePrefix = normalizeText(artifact.smoke_prefix, '')
  const checks = [
    await verifyFundingCreditor(client, artifact, smokePrefix),
    await verifyLoan(client, artifact),
    await verifyProjectIncome(client, artifact, smokePrefix),
    await verifyProjectIncomeFeeBill(client, artifact),
    await verifyMaterialInvoice(client, artifact, smokePrefix),
    await verifyMaterialInvoiceBill(client, artifact),
    await verifyMaterialInvoiceLineItem(client, artifact),
    await verifyMaterialStockTransaction(client, artifact),
    await verifyExpense(client, artifact, smokePrefix),
    await verifyExpenseBill(client, artifact),
    await verifyBillPayment(client, artifact),
    await verifyAttendanceRecord(client, artifact),
    await verifySalaryBill(client, artifact),
    await verifyBillPayment(client, artifact, 'salary_bill_payment'),
    await verifyInviteToken(client, artifact),
  ]
  const status = checks.every((check) => check.ok) ? 'verified' : 'failed'
  const report = {
    generated_at: new Date().toISOString(),
    status,
    artifact_file: options.artifactPath,
    smoke_prefix: smokePrefix,
    checks,
  }

  await writeJson(options.outputPath, report)

  console.log(`live smoke verification: ${status}`)
  console.log(`artifact: ${options.artifactPath}`)
  console.log(`report: ${options.outputPath}`)

  if (status !== 'verified') {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
