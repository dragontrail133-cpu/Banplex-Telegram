import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_INPUT_DIR = 'firestore-legacy-export'
const DEFAULT_BATCH_SIZE = 200

const LOAD_SEQUENCE = [
  'teams',
  'projects',
  'suppliers',
  'expense_categories',
  'funding_creditors',
  'professions',
  'staff',
  'materials',
  'workers',
  'worker_wage_rates',
  'file_assets',
  'beneficiaries',
  'hrd_applicants',
  'hrd_applicant_documents',
  'project_incomes',
  'expenses',
  'expense_line_items',
  'expense_attachments',
  'loans',
  'bills',
  'loan_payments',
  'bill_payments',
  'attendance_records',
  'stock_transactions',
  'pdf_settings',
]

const CANONICAL_TABLES = new Set(LOAD_SEQUENCE)

const TABLE_CONFLICT_TARGET = {
  pdf_settings: 'team_id',
}

const ALLOWED_COLUMNS_BY_TABLE = {
  teams: ['id', 'name', 'slug', 'is_active', 'created_at', 'updated_at', 'deleted_at', 'legacy_firebase_id'],
  projects: [
    'id',
    'team_id',
    'name',
    'project_type',
    'budget',
    'is_wage_assignable',
    'status',
    'notes',
    'is_active',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  suppliers: [
    'id',
    'team_id',
    'name',
    'supplier_type',
    'notes',
    'is_active',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  expense_categories: [
    'id',
    'team_id',
    'name',
    'category_group',
    'notes',
    'is_active',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  funding_creditors: [
    'id',
    'team_id',
    'name',
    'notes',
    'is_active',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  professions: ['id', 'team_id', 'profession_name', 'notes', 'created_at', 'updated_at', 'deleted_at', 'legacy_firebase_id'],
  staff: [
    'id',
    'team_id',
    'staff_name',
    'payment_type',
    'salary',
    'fee_percentage',
    'fee_amount',
    'notes',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  materials: [
    'id',
    'team_id',
    'name',
    'unit',
    'is_active',
    'current_stock',
    'category_id',
    'usage_count',
    'reorder_point',
    'notes',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  workers: [
    'id',
    'team_id',
    'name',
    'telegram_user_id',
    'is_active',
    'profession_id',
    'status',
    'default_project_id',
    'default_role_name',
    'notes',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  worker_wage_rates: [
    'id',
    'team_id',
    'worker_id',
    'project_id',
    'role_name',
    'wage_amount',
    'is_default',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  file_assets: [
    'id',
    'team_id',
    'storage_bucket',
    'bucket_name',
    'storage_path',
    'public_url',
    'mime_type',
    'original_name',
    'file_name',
    'size_bytes',
    'file_size',
    'uploaded_by_user_id',
    'uploaded_by',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  beneficiaries: [
    'id',
    'team_id',
    'legacy_firebase_id',
    'nama_penerima',
    'nik',
    'jenis_kelamin',
    'jenjang',
    'nama_instansi',
    'npsn_nspp',
    'jarak_meter',
    'status',
    'data_status',
    'tempat_lahir',
    'tanggal_lahir',
    'district',
    'sub_district',
    'village',
    'hamlet',
    'rt',
    'rw',
    'alamat_lengkap',
    'notes',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  hrd_applicants: [
    'id',
    'team_id',
    'legacy_firebase_id',
    'source_beneficiary_id',
    'nama_lengkap',
    'email',
    'no_telepon',
    'jenis_kelamin',
    'nik',
    'no_kk',
    'tempat_lahir',
    'tanggal_lahir',
    'pendidikan_terakhir',
    'nama_institusi_pendidikan',
    'jurusan',
    'posisi_dilamar',
    'sumber_lowongan',
    'status_aplikasi',
    'pengalaman_kerja',
    'skills',
    'district',
    'sub_district',
    'village',
    'hamlet',
    'rt',
    'rw',
    'alamat_lengkap',
    'alamat_domisili',
    'catatan_hrd',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  hrd_applicant_documents: [
    'id',
    'team_id',
    'legacy_firebase_id',
    'applicant_id',
    'document_type',
    'file_asset_id',
    'created_at',
    'updated_at',
    'deleted_at',
  ],
  project_incomes: [
    'id',
    'team_id',
    'project_id',
    'transaction_date',
    'income_date',
    'amount',
    'description',
    'notes',
    'telegram_user_id',
    'created_by_user_id',
    'project_name_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  expenses: [
    'id',
    'team_id',
    'project_id',
    'supplier_id',
    'category_id',
    'expense_type',
    'document_type',
    'status',
    'expense_date',
    'description',
    'notes',
    'amount',
    'telegram_user_id',
    'created_by_user_id',
    'project_name_snapshot',
    'supplier_name_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  expense_line_items: [
    'id',
    'team_id',
    'expense_id',
    'material_id',
    'item_name',
    'qty',
    'unit_price',
    'line_total',
    'sort_order',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  expense_attachments: [
    'id',
    'expense_id',
    'team_id',
    'file_asset_id',
    'sort_order',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  bills: [
    'id',
    'expense_id',
    'project_income_id',
    'telegram_user_id',
    'team_id',
    'project_id',
    'supplier_id',
    'worker_id',
    'staff_id',
    'bill_type',
    'description',
    'amount',
    'due_date',
    'status',
    'paid_amount',
    'paid_at',
    'period_start',
    'period_end',
    'supplier_name_snapshot',
    'worker_name_snapshot',
    'project_name_snapshot',
    'creditor_name_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  bill_payments: [
    'id',
    'bill_id',
    'telegram_user_id',
    'team_id',
    'amount',
    'payment_date',
    'notes',
    'worker_name_snapshot',
    'supplier_name_snapshot',
    'project_name_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  loans: [
    'id',
    'team_id',
    'telegram_user_id',
    'creditor_id',
    'transaction_date',
    'disbursed_date',
    'principal_amount',
    'amount',
    'repayment_amount',
    'interest_type',
    'status',
    'paid_amount',
    'interest_rate',
    'tenor_months',
    'notes',
    'description',
    'created_by_user_id',
    'creditor_name_snapshot',
    'late_interest_rate',
    'late_interest_basis',
    'late_penalty_type',
    'late_penalty_amount',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  loan_payments: [
    'id',
    'loan_id',
    'telegram_user_id',
    'team_id',
    'amount',
    'payment_date',
    'notes',
    'creditor_name_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  attendance_records: [
    'id',
    'telegram_user_id',
    'team_id',
    'worker_id',
    'project_id',
    'attendance_date',
    'attendance_status',
    'total_pay',
    'overtime_fee',
    'entry_mode',
    'billing_status',
    'salary_bill_id',
    'notes',
    'worker_name_snapshot',
    'project_name_snapshot',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  stock_transactions: [
    'id',
    'team_id',
    'material_id',
    'project_id',
    'expense_id',
    'expense_line_item_id',
    'quantity',
    'direction',
    'source_type',
    'transaction_date',
    'price_per_unit',
    'notes',
    'created_by_user_id',
    'created_at',
    'updated_at',
    'deleted_at',
    'legacy_firebase_id',
  ],
  pdf_settings: [
    'team_id',
    'header_color',
    'header_logo_file_id',
    'footer_logo_file_id',
    'company_name',
    'address',
    'phone',
    'extra',
    'updated_by_user_id',
    'updated_at',
  ],
}

const PROFILE_REFERENCE_FIELDS = new Set(['created_by_user_id', 'updated_by_user_id', 'uploaded_by_user_id'])

function parseArgs(argv) {
  const options = {
    inputDir: DEFAULT_INPUT_DIR,
    envFile: null,
    reportFile: null,
    batchSize: DEFAULT_BATCH_SIZE,
    dryRun: false,
    strict: false,
    force: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '-h' || token === '--help') {
      options.help = true
      continue
    }

    if (token === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (token === '--strict') {
      options.strict = true
      continue
    }

    if (token === '--force') {
      options.force = true
      continue
    }

    if (token === '--input') {
      options.inputDir = argv[++index]
      continue
    }

    if (token === '--env-file') {
      options.envFile = argv[++index]
      continue
    }

    if (token === '--report-file') {
      options.reportFile = argv[++index]
      continue
    }

    if (token === '--batch-size') {
      const batchSize = Number(argv[++index])
      if (!Number.isFinite(batchSize) || batchSize <= 0) {
        throw new Error('--batch-size harus berupa angka positif.')
      }
      options.batchSize = Math.max(1, Math.floor(batchSize))
      continue
    }

    throw new Error(`Argumen tidak dikenal: ${token}`)
  }

  if (!options.inputDir) {
    throw new Error('Nilai --input tidak boleh kosong.')
  }

  return options
}

function printUsage() {
  console.log(`Firestore canonical loader for Supabase

Usage:
  node scripts/firestore-backfill/load.mjs --input ./firestore-legacy-export --env-file ./.env.backfill

Options:
  --input <dir>         Export directory to load (default: firestore-legacy-export)
  --env-file <path>     Optional env file containing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
  --report-file <path>  Output JSON report (default: <input>/meta/load-report.json)
  --batch-size <n>      Upsert batch size (default: 200)
  --dry-run             Inspect artifacts and build a load report without writing to Supabase
  --strict              Exit non-zero when plan status is blocked or any load issue occurs
  --force               Continue even when backfill-plan status is blocked
  -h, --help            Show this help

Required env for live load:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

What it does:
  - reads canonical artifacts from extract/validate output
  - loads data into Supabase in FK-safe order
  - reconciles rows auto-generated by active triggers
  - writes meta/load-report.json with counts and remaps
`)
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function chunkArray(values, size) {
  const chunks = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }
  return chunks
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null))]
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath)
    return stat.isFile()
  } catch {
    return false
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function parseEnvText(raw) {
  const entries = {}

  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex < 0) {
      continue
    }

    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    value = value
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')

    entries[key] = value
  }

  return entries
}

async function loadEnvFile(filePath) {
  if (!filePath) {
    return {}
  }

  const resolvedPath = path.resolve(filePath)
  if (!(await fileExists(resolvedPath))) {
    throw new Error(`Env file tidak ditemukan: ${resolvedPath}`)
  }

  return parseEnvText(await fs.readFile(resolvedPath, 'utf8'))
}

function mergeEnv(fileEnv) {
  return {
    ...fileEnv,
    ...process.env,
  }
}

function createEmptyTableReport(table, artifactPath, rowCount) {
  return {
    table,
    artifact_path: artifactPath,
    row_count: rowCount,
    attempted: 0,
    loaded: 0,
    remapped: 0,
    skipped: 0,
    dry_run: false,
    status: rowCount > 0 ? 'pending' : 'skipped',
    notes: [],
    errors: [],
  }
}

function createLoadReportSkeleton(options, manifest, plan, artifacts) {
  const report = {
    generated_at: new Date().toISOString(),
    input_dir: path.resolve(options.inputDir),
    env_file: options.envFile ? path.resolve(options.envFile) : null,
    dry_run: options.dryRun,
    force: options.force,
    manifest: {
      project_id: manifest.project_id ?? null,
      global_team_path: manifest.global_team_path ?? null,
      root_collections: Array.isArray(manifest.root_collections) ? manifest.root_collections : [],
    },
    plan: plan
      ? {
          status: plan.status ?? null,
          file: plan.plan_file ?? null,
          issues: Array.isArray(plan.issues) ? plan.issues.length : 0,
          warnings: Array.isArray(plan.warnings) ? plan.warnings.length : 0,
        }
      : null,
    summary: {
      total_tables: LOAD_SEQUENCE.length,
      total_rows: 0,
      total_loaded: 0,
      total_remapped: 0,
      total_skipped: 0,
      blocking_issues: 0,
      warnings: 0,
    },
    remaps: {
      bills: [],
      bill_payments: [],
      stock_transactions: [],
    },
    tables: {},
    warnings: [],
    issues: [],
  }

  for (const table of LOAD_SEQUENCE) {
    const artifact = artifacts.get(table)
    const rowCount = artifact?.rows.length ?? 0
    report.tables[table] = createEmptyTableReport(table, artifact?.filePath ?? null, rowCount)
    report.summary.total_rows += rowCount
  }

  return report
}

async function loadArtifacts(inputDir, manifest) {
  const artifacts = new Map()
  const canonicalEntries = Array.isArray(manifest.canonical) ? manifest.canonical : []

  for (const entry of canonicalEntries) {
    const table = entry.table ?? null
    if (!table || !CANONICAL_TABLES.has(table)) {
      continue
    }

    const filePath = path.resolve(inputDir, entry.output_file)
    const artifact = await readJson(filePath)
    artifacts.set(table, {
      table,
      filePath,
      outputFile: entry.output_file,
      domain: artifact.domain ?? entry.group ?? null,
      rows: Array.isArray(artifact.rows) ? artifact.rows : [],
      rowCount: artifact.row_count ?? null,
    })
  }

  return artifacts
}

function sanitizeRow(table, row, overrides = {}) {
  const allowedColumns = ALLOWED_COLUMNS_BY_TABLE[table]
  if (!allowedColumns) {
    throw new Error(`Tidak ada whitelist kolom untuk tabel ${table}`)
  }

  const source = { ...row, ...overrides }
  const sanitized = {}

  for (const columnName of allowedColumns) {
    if (!(columnName in source)) {
      continue
    }

    let value = source[columnName]

    if (PROFILE_REFERENCE_FIELDS.has(columnName) && !isUuid(value)) {
      value = null
    }

    if (columnName === 'extra' && value != null && typeof value !== 'object') {
      value = null
    }

    if (value !== undefined) {
      sanitized[columnName] = value
    }
  }

  return sanitized
}

async function upsertRows(client, table, rows, options) {
  const {
    batchSize,
    dryRun,
    reportEntry,
  } = options

  if (rows.length === 0) {
    reportEntry.status = 'skipped'
    reportEntry.dry_run = dryRun
    return
  }

  reportEntry.attempted = rows.length
  reportEntry.dry_run = dryRun

  if (dryRun) {
    reportEntry.loaded = rows.length
    reportEntry.status = 'dry-run'
    return
  }

  const conflictTarget = TABLE_CONFLICT_TARGET[table] ?? 'id'
  let loaded = 0

  for (const batch of chunkArray(rows, batchSize)) {
    const { error } = await client
      .from(table)
      .upsert(batch, { onConflict: conflictTarget, ignoreDuplicates: false })

    if (error) {
      throw new Error(`${table}: ${error.message}`)
    }

    loaded += batch.length
  }

  reportEntry.loaded = loaded
  reportEntry.status = 'loaded'
}

async function fetchExistingBillsByExpense(client, expenseIds) {
  const result = new Map()
  const ids = unique(expenseIds)
  if (ids.length === 0) {
    return result
  }

  for (const chunk of chunkArray(ids, 200)) {
    const { data, error } = await client
      .from('bills')
      .select('id, expense_id, project_income_id, staff_id')
      .in('expense_id', chunk)

    if (error) {
      throw new Error(`Gagal membaca bill by expense_id: ${error.message}`)
    }

    for (const row of data ?? []) {
      if (row?.expense_id) {
        result.set(row.expense_id, row)
      }
    }
  }

  return result
}

async function fetchExistingBillsByProjectIncome(client, projectIncomeIds) {
  const result = new Map()
  const ids = unique(projectIncomeIds)
  if (ids.length === 0) {
    return result
  }

  for (const chunk of chunkArray(ids, 200)) {
    const { data, error } = await client
      .from('bills')
      .select('id, project_income_id, staff_id, expense_id')
      .in('project_income_id', chunk)

    if (error) {
      throw new Error(`Gagal membaca bill by project_income_id: ${error.message}`)
    }

    for (const row of data ?? []) {
      if (row?.project_income_id && row?.staff_id) {
        result.set(`${row.project_income_id}::${row.staff_id}`, row)
      }
    }
  }

  return result
}

async function fetchExistingBillPayments(client, billIds) {
  const byBillId = new Map()
  const ids = unique(billIds)
  if (ids.length === 0) {
    return byBillId
  }

  for (const chunk of chunkArray(ids, 200)) {
    const { data, error } = await client
      .from('bill_payments')
      .select('id, bill_id, amount, payment_date, notes')
      .in('bill_id', chunk)

    if (error) {
      throw new Error(`Gagal membaca bill_payments: ${error.message}`)
    }

    for (const row of data ?? []) {
      if (!row?.bill_id) {
        continue
      }

      if (!byBillId.has(row.bill_id)) {
        byBillId.set(row.bill_id, [])
      }

      byBillId.get(row.bill_id).push(row)
    }
  }

  return byBillId
}

async function fetchExistingStockTransactions(client, expenseLineItemIds) {
  const result = new Map()
  const ids = unique(expenseLineItemIds)
  if (ids.length === 0) {
    return result
  }

  for (const chunk of chunkArray(ids, 200)) {
    const { data, error } = await client
      .from('stock_transactions')
      .select('id, expense_line_item_id')
      .in('expense_line_item_id', chunk)

    if (error) {
      throw new Error(`Gagal membaca stock_transactions: ${error.message}`)
    }

    for (const row of data ?? []) {
      if (row?.expense_line_item_id) {
        result.set(row.expense_line_item_id, row)
      }
    }
  }

  return result
}

function findMatchingExistingBillPayment(existingRows, canonicalRow, claimedIds) {
  const available = existingRows.filter((row) => !claimedIds.has(row.id))
  if (available.length === 0) {
    return null
  }

  const normalizedNotes = canonicalRow.notes ?? canonicalRow.description ?? null
  const exact = available.find(
    (row) =>
      row.amount === canonicalRow.amount &&
      row.payment_date === canonicalRow.payment_date &&
      (row.notes ?? null) === normalizedNotes
  )
  if (exact) {
    return exact
  }

  const byAmountAndDate = available.find(
    (row) => row.amount === canonicalRow.amount && row.payment_date === canonicalRow.payment_date
  )
  if (byAmountAndDate) {
    return byAmountAndDate
  }

  const byAmountOnly = available.find((row) => row.amount === canonicalRow.amount)
  return byAmountOnly ?? null
}

async function loadSimpleTable(client, artifacts, report, options, table) {
  const artifact = artifacts.get(table)
  const entry = report.tables[table]
  if (!artifact) {
    entry.status = 'skipped'
    entry.notes.push('Artifact canonical tidak ditemukan.')
    return
  }

  const rows = artifact.rows.map((row) => sanitizeRow(table, row))
  await upsertRows(client, table, rows, {
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    reportEntry: entry,
  })
}

async function loadBills(client, artifacts, report, options, state) {
  const artifact = artifacts.get('bills')
  const entry = report.tables.bills

  if (!artifact) {
    entry.status = 'skipped'
    entry.notes.push('Artifact canonical tidak ditemukan.')
    return
  }

  const canonicalRows = artifact.rows
  const expenseBillMap = options.dryRun
    ? new Map()
    : await fetchExistingBillsByExpense(
        client,
        canonicalRows.map((row) => row.expense_id).filter(Boolean)
      )
  const feeBillMap = options.dryRun
    ? new Map()
    : await fetchExistingBillsByProjectIncome(
        client,
        canonicalRows.map((row) => row.project_income_id).filter(Boolean)
      )

  let remapped = 0
  const loadRows = []

  for (const row of canonicalRows) {
    let targetId = row.id

    if (row.expense_id && expenseBillMap.has(row.expense_id)) {
      targetId = expenseBillMap.get(row.expense_id).id
    } else if (row.project_income_id && row.staff_id) {
      const key = `${row.project_income_id}::${row.staff_id}`
      if (feeBillMap.has(key)) {
        targetId = feeBillMap.get(key).id
      }
    }

    if (targetId !== row.id) {
      remapped += 1
      state.billIdMap.set(row.id, targetId)
      report.remaps.bills.push({
        legacy_id: row.id,
        actual_id: targetId,
        expense_id: row.expense_id ?? null,
        project_income_id: row.project_income_id ?? null,
        staff_id: row.staff_id ?? null,
      })
    } else {
      state.billIdMap.set(row.id, row.id)
    }

    loadRows.push(sanitizeRow('bills', row, { id: targetId }))
  }

  entry.remapped = remapped
  if (remapped > 0) {
    entry.notes.push(`${remapped} canonical bill diarahkan ke row hasil trigger yang sudah ada.`)
  }

  await upsertRows(client, 'bills', loadRows, {
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    reportEntry: entry,
  })

  state.billCanonicalRows = canonicalRows
}

async function finalizeBills(client, report, options, state) {
  const canonicalRows = state.billCanonicalRows ?? []
  if (canonicalRows.length === 0) {
    return
  }

  const exactRows = canonicalRows.map((row) =>
    sanitizeRow('bills', row, { id: state.billIdMap.get(row.id) ?? row.id })
  )

  if (options.dryRun) {
    report.tables.bills.notes.push('Dry run: final bill reapply dilewati.')
    return
  }

  const conflictTarget = TABLE_CONFLICT_TARGET.bills ?? 'id'
  for (const batch of chunkArray(exactRows, options.batchSize)) {
    const { error } = await client.from('bills').upsert(batch, {
      onConflict: conflictTarget,
      ignoreDuplicates: false,
    })

    if (error) {
      throw new Error(`finalize bills: ${error.message}`)
    }
  }

  report.tables.bills.notes.push('Canonical bill values di-apply ulang setelah bill_payments untuk menjaga histori exact.')
}

async function loadBillPayments(client, artifacts, report, options, state) {
  const artifact = artifacts.get('bill_payments')
  const entry = report.tables.bill_payments

  if (!artifact) {
    entry.status = 'skipped'
    entry.notes.push('Artifact canonical tidak ditemukan.')
    return
  }

  const canonicalRows = artifact.rows
  const billIds = canonicalRows.map((row) => state.billIdMap.get(row.bill_id) ?? row.bill_id).filter(Boolean)
  const existingByBillId = options.dryRun ? new Map() : await fetchExistingBillPayments(client, billIds)
  const claimedExistingIds = new Set()
  const loadRows = []
  let remapped = 0

  for (const row of canonicalRows) {
    const remappedBillId = state.billIdMap.get(row.bill_id) ?? row.bill_id
    const existingRows = existingByBillId.get(remappedBillId) ?? []
    const existingMatch = findMatchingExistingBillPayment(existingRows, row, claimedExistingIds)
    const targetId = existingMatch?.id ?? row.id

    if (existingMatch) {
      claimedExistingIds.add(existingMatch.id)
    }

    if (targetId !== row.id) {
      remapped += 1
      report.remaps.bill_payments.push({
        legacy_id: row.id,
        actual_id: targetId,
        legacy_bill_id: row.bill_id ?? null,
        actual_bill_id: remappedBillId ?? null,
      })
    }

    const sanitized = sanitizeRow('bill_payments', row, {
      id: targetId,
      bill_id: remappedBillId,
      notes: row.notes ?? row.description ?? null,
    })

    loadRows.push(sanitized)
  }

  entry.remapped = remapped
  if (remapped > 0) {
    entry.notes.push(`${remapped} canonical bill payment diarahkan ke row hasil trigger yang sudah ada.`)
  }

  await upsertRows(client, 'bill_payments', loadRows, {
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    reportEntry: entry,
  })
}

async function finalizeLoans(client, artifacts, report, options) {
  const artifact = artifacts.get('loans')
  if (!artifact || artifact.rows.length === 0) {
    return
  }

  if (options.dryRun) {
    report.tables.loans.notes.push('Dry run: final loan reapply dilewati.')
    return
  }

  const exactRows = artifact.rows.map((row) => sanitizeRow('loans', row))
  const conflictTarget = TABLE_CONFLICT_TARGET.loans ?? 'id'

  for (const batch of chunkArray(exactRows, options.batchSize)) {
    const { error } = await client.from('loans').upsert(batch, {
      onConflict: conflictTarget,
      ignoreDuplicates: false,
    })

    if (error) {
      throw new Error(`finalize loans: ${error.message}`)
    }
  }

  report.tables.loans.notes.push('Canonical loan values di-apply ulang setelah loan_payments untuk menjaga histori exact.')
}

async function loadAttendanceRecords(client, artifacts, report, options, state) {
  const artifact = artifacts.get('attendance_records')
  const entry = report.tables.attendance_records

  if (!artifact) {
    entry.status = 'skipped'
    entry.notes.push('Artifact canonical tidak ditemukan.')
    return
  }

  const rows = artifact.rows.map((row) =>
    sanitizeRow('attendance_records', row, {
      salary_bill_id: row.salary_bill_id ? state.billIdMap.get(row.salary_bill_id) ?? row.salary_bill_id : null,
    })
  )

  await upsertRows(client, 'attendance_records', rows, {
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    reportEntry: entry,
  })
}

async function loadStockTransactions(client, artifacts, report, options) {
  const artifact = artifacts.get('stock_transactions')
  const entry = report.tables.stock_transactions

  if (!artifact) {
    entry.status = 'skipped'
    entry.notes.push('Artifact canonical tidak ditemukan.')
    return
  }

  const canonicalRows = artifact.rows
  const existingMap = options.dryRun
    ? new Map()
    : await fetchExistingStockTransactions(
        client,
        canonicalRows.map((row) => row.expense_line_item_id).filter(Boolean)
      )
  const loadRows = []
  let remapped = 0

  for (const row of canonicalRows) {
    const targetId =
      row.expense_line_item_id && existingMap.has(row.expense_line_item_id)
        ? existingMap.get(row.expense_line_item_id).id
        : row.id

    if (targetId !== row.id) {
      remapped += 1
      report.remaps.stock_transactions.push({
        legacy_id: row.id,
        actual_id: targetId,
        expense_line_item_id: row.expense_line_item_id ?? null,
      })
    }

    loadRows.push(
      sanitizeRow('stock_transactions', row, {
        id: targetId,
      })
    )
  }

  entry.remapped = remapped
  if (remapped > 0) {
    entry.notes.push(`${remapped} stock transaction diarahkan ke row hasil trigger yang sudah ada.`)
  }

  await upsertRows(client, 'stock_transactions', loadRows, {
    batchSize: options.batchSize,
    dryRun: options.dryRun,
    reportEntry: entry,
  })
}

function summarizeReport(report) {
  for (const table of LOAD_SEQUENCE) {
    const entry = report.tables[table]
    report.summary.total_loaded += entry.loaded
    report.summary.total_remapped += entry.remapped
    report.summary.total_skipped += entry.skipped
    report.summary.blocking_issues = report.issues.length
    report.summary.warnings = report.warnings.length
  }
}

function assertPlanIsLoadable(plan, options) {
  if (!plan) {
    return
  }

  if (plan.status === 'blocked' && !options.force) {
    throw new Error(
      `Backfill plan masih blocked (${plan.plan_file ?? 'tanpa path'}). Jalankan validate dan periksa issues, atau pakai --force jika memang ingin lanjut.`
    )
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  const inputDir = path.resolve(options.inputDir)
  const manifestPath = path.join(inputDir, 'meta', 'manifest.json')
  const planPath = path.join(inputDir, 'meta', 'backfill-plan.json')
  const reportFile = path.resolve(options.reportFile ?? path.join(inputDir, 'meta', 'load-report.json'))

  if (!(await fileExists(manifestPath))) {
    throw new Error(`manifest.json tidak ditemukan: ${manifestPath}`)
  }

  const manifest = await readJson(manifestPath)
  const plan = (await fileExists(planPath)) ? await readJson(planPath) : null
  assertPlanIsLoadable(plan, options)

  const artifacts = await loadArtifacts(inputDir, manifest)
  const report = createLoadReportSkeleton(options, manifest, plan, artifacts)

  if (!plan) {
    report.warnings.push({
      scope: 'meta',
      message: 'backfill-plan.json tidak ditemukan. Loader tetap jalan, tetapi tanpa gate dari validator.',
    })
  }

  const fileEnv = await loadEnvFile(options.envFile)
  const env = mergeEnv(fileEnv)
  const supabaseUrl = env.SUPABASE_URL ?? null
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? null

  let client = null
  if (!options.dryRun) {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi untuk live load.')
    }

    const { createClient } = await import('@supabase/supabase-js')
    client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }

  const state = {
    billIdMap: new Map(),
    billCanonicalRows: [],
  }

  try {
    for (const table of ['teams', 'projects', 'suppliers', 'expense_categories', 'funding_creditors', 'professions', 'staff', 'materials', 'workers', 'worker_wage_rates', 'file_assets', 'beneficiaries', 'hrd_applicants', 'hrd_applicant_documents', 'project_incomes', 'expenses', 'expense_line_items', 'expense_attachments', 'loans']) {
      await loadSimpleTable(client, artifacts, report, options, table)
    }

    await loadBills(client, artifacts, report, options, state)
    await loadSimpleTable(client, artifacts, report, options, 'loan_payments')
    await loadBillPayments(client, artifacts, report, options, state)
    await finalizeLoans(client, artifacts, report, options)
    await finalizeBills(client, report, options, state)
    await loadAttendanceRecords(client, artifacts, report, options, state)
    await loadStockTransactions(client, artifacts, report, options)
    await loadSimpleTable(client, artifacts, report, options, 'pdf_settings')
  } catch (error) {
    report.issues.push({
      scope: 'load',
      message: error instanceof Error ? error.message : String(error),
    })
  }

  summarizeReport(report)
  await writeJson(reportFile, report)

  console.log('Firestore canonical load complete')
  console.log(`input: ${inputDir}`)
  console.log(`report: ${reportFile}`)
  console.log(`dry_run: ${options.dryRun}`)
  console.log(`loaded_rows: ${report.summary.total_loaded}`)
  console.log(`remapped_rows: ${report.summary.total_remapped}`)
  console.log(`issues: ${report.issues.length}`)
  console.log(`warnings: ${report.warnings.length}`)

  if ((options.strict || !options.dryRun) && report.issues.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
