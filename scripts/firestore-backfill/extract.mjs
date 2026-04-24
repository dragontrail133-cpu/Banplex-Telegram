import crypto from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveLoanNominalAmounts, shouldBackfillAttendanceRecord } from './helpers.mjs'

const DEFAULT_OUTPUT_DIR = 'firestore-legacy-export'
const DEFAULT_ROOT_COLLECTIONS = ['teams', 'penerimaManfaat', 'users']
const DEFAULT_GLOBAL_TEAM_PATH = 'teams/main'
const DEFAULT_BUCKET_NAME = 'hrd_documents'
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore'
const FIRESTORE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FIRESTORE_PAGE_SIZE = 1000
const FIRESTORE_DOC_NAME_PREFIX = '/documents/'

const CANONICAL_OUTPUT = {
  teams: { group: 'workspace', table: 'teams' },
  projects: { group: 'reference', table: 'projects' },
  suppliers: { group: 'reference', table: 'suppliers' },
  expense_categories: { group: 'reference', table: 'expense_categories' },
  funding_creditors: { group: 'reference', table: 'funding_creditors' },
  professions: { group: 'reference', table: 'professions' },
  staff: { group: 'reference', table: 'staff' },
  materials: { group: 'reference', table: 'materials' },
  workers: { group: 'reference', table: 'workers' },
  worker_wage_rates: { group: 'reference', table: 'worker_wage_rates' },
  project_incomes: { group: 'finance', table: 'project_incomes' },
  expenses: { group: 'finance', table: 'expenses' },
  expense_line_items: { group: 'finance', table: 'expense_line_items' },
  expense_attachments: { group: 'finance', table: 'expense_attachments' },
  bills: { group: 'finance', table: 'bills' },
  bill_payments: { group: 'finance', table: 'bill_payments' },
  loans: { group: 'finance', table: 'loans' },
  loan_payments: { group: 'finance', table: 'loan_payments' },
  attendance_records: { group: 'payroll', table: 'attendance_records' },
  stock_transactions: { group: 'stock', table: 'stock_transactions' },
  file_assets: { group: 'storage', table: 'file_assets' },
  beneficiaries: { group: 'hrd', table: 'beneficiaries' },
  hrd_applicants: { group: 'hrd', table: 'hrd_applicants' },
  hrd_applicant_documents: { group: 'hrd', table: 'hrd_applicant_documents' },
  pdf_settings: { group: 'config', table: 'pdf_settings' },
}

const SIDECAR_OUTPUT = {
  users: { group: 'identity', table: 'users' },
  team_members: { group: 'identity', table: 'team_members' },
  profiles: { group: 'identity', table: 'profiles' },
}

const TRANSFORMED_CANONICAL_TABLES = [
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
  'project_incomes',
  'expenses',
  'expense_line_items',
  'expense_attachments',
  'bills',
  'bill_payments',
  'loans',
  'loan_payments',
  'attendance_records',
  'stock_transactions',
  'file_assets',
  'beneficiaries',
  'hrd_applicants',
  'hrd_applicant_documents',
  'pdf_settings',
]

const TRANSFORMED_SIDECAR_TABLES = ['users', 'team_members', 'profiles']

const NAME_FIELDS_BY_COLLECTION = {
  teams: ['name', 'teamName', 'team_name', 'workspaceName', 'workspace_name', 'slug'],
  projects: ['projectName', 'project_name', 'name'],
  suppliers: ['supplierName', 'supplier_name', 'name'],
  expense_categories: ['categoryName', 'category_name', 'name'],
  funding_creditors: ['creditorName', 'creditor_name', 'name'],
  professions: ['professionName', 'profession_name', 'name'],
  staff: ['staffName', 'staff_name', 'name'],
  materials: ['materialName', 'material_name', 'name'],
  workers: ['workerName', 'worker_name', 'name'],
  beneficiaries: ['namaPenerima', 'nama_penerima', 'name'],
  hrd_applicants: ['namaLengkap', 'nama_lengkap', 'name'],
}

const RELATION_COLLECTIONS = {
  project_id: ['projects'],
  supplier_id: ['suppliers'],
  category_id: ['expense_categories'],
  creditor_id: ['funding_creditors'],
  profession_id: ['professions'],
  default_project_id: ['projects'],
  worker_id: ['workers'],
  staff_id: ['staff'],
  material_id: ['materials'],
  expense_id: ['expenses'],
  bill_id: ['bills'],
  loan_id: ['loans'],
  file_asset_id: ['file_assets'],
  header_logo_file_id: ['file_assets'],
  footer_logo_file_id: ['file_assets'],
  source_beneficiary_id: ['beneficiaries'],
  salary_bill_id: ['bills'],
  project_income_id: ['project_incomes'],
  attendance_record_id: ['attendance_records'],
}

const LEGACY_FIELD_CANDIDATES = {
  projects: {
    name: ['projectName', 'project_name', 'name'],
    project_type: ['projectType', 'project_type'],
    budget: ['budget'],
    is_wage_assignable: ['isWageAssignable', 'is_wage_assignable'],
    status: ['status'],
    notes: ['notes'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
    is_active: ['isActive', 'is_active'],
  },
  suppliers: {
    name: ['supplierName', 'supplier_name', 'name'],
    supplier_type: ['supplierType', 'supplier_type', 'category'],
    notes: ['notes'],
    is_active: ['isActive', 'is_active'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  expense_categories: {
    name: ['categoryName', 'category_name', 'name'],
    category_group: ['categoryGroup', 'category_group'],
    notes: ['notes'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  funding_creditors: {
    name: ['creditorName', 'creditor_name', 'name'],
    notes: ['notes'],
    is_active: ['isActive', 'is_active'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  professions: {
    profession_name: ['professionName', 'profession_name', 'name'],
    notes: ['notes'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  staff: {
    staff_name: ['staffName', 'staff_name', 'name'],
    payment_type: ['paymentType', 'payment_type'],
    salary: ['salary'],
    fee_percentage: ['feePercentage', 'fee_percentage'],
    fee_amount: ['feeAmount', 'fee_amount'],
    notes: ['notes'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  materials: {
    name: ['materialName', 'material_name', 'name'],
    unit: ['unit'],
    current_stock: ['currentStock', 'current_stock'],
    category_id: ['categoryId', 'category_id'],
    usage_count: ['usageCount', 'usage_count'],
    reorder_point: ['reorderPoint', 'reorder_point'],
    notes: ['notes'],
    is_active: ['isActive', 'is_active'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  workers: {
    name: ['workerName', 'worker_name', 'name'],
    telegram_user_id: ['telegramUserId', 'telegram_user_id'],
    profession_id: ['professionId', 'profession_id'],
    status: ['status'],
    default_project_id: ['defaultProjectId', 'default_project_id'],
    default_role_name: ['defaultRole', 'default_role_name'],
    notes: ['notes'],
    is_active: ['isActive', 'is_active'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  project_incomes: {
    project_id: ['projectId', 'project_id'],
    transaction_date: ['transactionDate', 'transaction_date', 'date'],
    income_date: ['incomeDate', 'income_date', 'date'],
    amount: ['amount', 'totalAmount', 'total_amount'],
    description: ['description', 'notes'],
    notes: ['notes'],
    telegram_user_id: ['telegramUserId', 'telegram_user_id', 'createdBy'],
    created_by_user_id: ['createdByUserId', 'created_by_user_id'],
    project_name_snapshot: ['projectName', 'project_name', 'projectNameSnapshot'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  expenses: {
    project_id: ['projectId', 'project_id'],
    supplier_id: ['supplierId', 'supplier_id'],
    category_id: ['categoryId', 'category_id'],
    expense_type: ['expenseType', 'expense_type', 'type'],
    document_type: ['documentType', 'document_type', 'formType'],
    status: ['status'],
    expense_date: ['expenseDate', 'expense_date', 'date'],
    description: ['description', 'notes'],
    notes: ['notes'],
    amount: ['amount', 'totalAmount', 'total_amount'],
    telegram_user_id: ['telegramUserId', 'telegram_user_id'],
    created_by_user_id: ['createdByUserId', 'created_by_user_id'],
    project_name_snapshot: ['projectNameSnapshot', 'projectName', 'project_name'],
    supplier_name_snapshot: ['supplierNameSnapshot', 'supplierName', 'supplier_name'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  bills: {
    expense_id: ['expenseId', 'expense_id'],
    project_income_id: ['projectIncomeId', 'project_income_id'],
    worker_id: ['workerId', 'worker_id'],
    staff_id: ['staffId', 'staff_id'],
    project_id: ['projectId', 'project_id'],
    supplier_id: ['supplierId', 'supplier_id'],
    bill_type: ['billType', 'bill_type', 'type'],
    description: ['description', 'notes'],
    amount: ['amount', 'billAmount', 'totalAmount'],
    paid_amount: ['paidAmount', 'paid_amount'],
    due_date: ['dueDate', 'due_date', 'date'],
    status: ['status'],
    paid_at: ['paidAt', 'paid_at'],
    period_start: ['periodStart', 'period_start', 'startDate'],
    period_end: ['periodEnd', 'period_end', 'endDate'],
    supplier_name_snapshot: ['supplierNameSnapshot', 'supplierName', 'supplier_name'],
    worker_name_snapshot: ['workerNameSnapshot', 'workerName', 'worker_name'],
    project_name_snapshot: ['projectNameSnapshot', 'projectName', 'project_name'],
    creditor_name_snapshot: ['creditorNameSnapshot', 'creditorName', 'creditor_name'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  bill_payments: {
    bill_id: ['billId', 'bill_id'],
    worker_id: ['workerId', 'worker_id'],
    amount: ['amount'],
    payment_date: ['paymentDate', 'payment_date', 'date'],
    recipient_name: ['recipientName', 'recipient_name', 'workerName', 'supplierName'],
    description: ['description', 'notes'],
    notes: ['notes'],
    telegram_user_id: ['telegramUserId', 'telegram_user_id'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  loans: {
    creditor_id: ['creditorId', 'creditor_id'],
    transaction_date: ['transactionDate', 'transaction_date', 'date'],
    disbursed_date: ['disbursedDate', 'disbursed_date', 'date'],
    principal_amount: ['principalAmount', 'principal_amount', 'amount'],
    repayment_amount: ['repaymentAmount', 'repayment_amount', 'totalRepaymentAmount'],
    amount: ['amount', 'principalAmount', 'principal_amount'],
    interest_type: ['interestType', 'interest_type'],
    interest_rate: ['interestRate', 'interest_rate', 'rate'],
    tenor_months: ['tenorMonths', 'tenor_months', 'tenor'],
    late_interest_rate: ['lateInterestRate', 'late_interest_rate'],
    late_interest_basis: ['lateInterestBasis', 'late_interest_basis'],
    late_penalty_type: ['latePenaltyType', 'late_penalty_type'],
    late_penalty_amount: ['latePenaltyAmount', 'late_penalty_amount'],
    description: ['description', 'notes'],
    notes: ['notes'],
    status: ['status'],
    paid_amount: ['paidAmount', 'paid_amount'],
    creditor_name_snapshot: ['creditorNameSnapshot', 'creditorName', 'creditor_name'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  loan_payments: {
    loan_id: ['loanId', 'loan_id'],
    amount: ['amount'],
    payment_date: ['paymentDate', 'payment_date', 'date'],
    description: ['description', 'notes'],
    notes: ['notes'],
    creditor_name_snapshot: ['creditorNameSnapshot', 'creditorName', 'creditor_name'],
    telegram_user_id: ['telegramUserId', 'telegram_user_id'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  attendance_records: {
    worker_id: ['workerId', 'worker_id'],
    project_id: ['projectId', 'project_id'],
    attendance_date: ['attendanceDate', 'attendance_date', 'date'],
    attendance_status: ['attendanceStatus', 'attendance_status', 'status'],
    entry_mode: ['entryMode', 'entry_mode'],
    total_pay: ['totalPay', 'total_pay'],
    overtime_fee: ['overtimeFee', 'overtime_fee'],
    billing_status: ['billingStatus', 'billing_status', 'isPaid'],
    salary_bill_id: ['billId', 'salaryBillId', 'salary_bill_id', 'bill_id'],
    notes: ['notes'],
    worker_name_snapshot: ['workerNameSnapshot', 'workerName', 'worker_name'],
    project_name_snapshot: ['projectNameSnapshot', 'projectName', 'project_name'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  stock_transactions: {
    material_id: ['materialId', 'material_id'],
    project_id: ['projectId', 'project_id'],
    expense_id: ['expenseId', 'expense_id', 'relatedExpenseId'],
    expense_line_item_id: ['expenseLineItemId', 'expense_line_item_id', 'relatedExpenseLineItemId'],
    quantity: ['quantity', 'qty'],
    direction: ['direction', 'type'],
    source_type: ['sourceType', 'source_type'],
    transaction_date: ['transactionDate', 'transaction_date', 'date'],
    price_per_unit: ['pricePerUnit', 'price_per_unit'],
    notes: ['notes'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
  },
  beneficiaries: {
    nama_penerima: ['namaPenerima', 'nama_penerima', 'name'],
    nik: ['nik'],
    jenis_kelamin: ['jenisKelamin', 'jenis_kelamin'],
    jenjang: ['jenjang'],
    nama_instansi: ['namaInstansi', 'nama_instansi', 'institution'],
    npsn_nspp: ['npsnNspp', 'npsn_nspp'],
    jarak_meter: ['jarak', 'jarakMeter', 'jarak_meter'],
    status: ['status'],
    data_status: ['dataStatus', 'data_status'],
    tempat_lahir: ['tempatLahir', 'tempat_lahir'],
    tanggal_lahir: ['tanggalLahir', 'tanggal_lahir'],
    district: ['district'],
    sub_district: ['subDistrict', 'sub_district'],
    village: ['village'],
    hamlet: ['hamlet'],
    rt: ['rt'],
    rw: ['rw'],
    alamat_lengkap: ['alamatLengkap', 'alamat_lengkap'],
    notes: ['notes'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  hrd_applicants: {
    nama_lengkap: ['namaLengkap', 'nama_lengkap', 'name'],
    email: ['email'],
    no_telepon: ['noTelepon', 'no_telepon', 'phone'],
    jenis_kelamin: ['jenisKelamin', 'jenis_kelamin'],
    nik: ['nik'],
    no_kk: ['noKk', 'no_kk'],
    tempat_lahir: ['tempatLahir', 'tempat_lahir'],
    tanggal_lahir: ['tanggalLahir', 'tanggal_lahir'],
    pendidikan_terakhir: ['pendidikanTerakhir', 'pendidikan_terakhir'],
    nama_institusi_pendidikan: ['namaInstitusiPendidikan', 'nama_institusi_pendidikan'],
    jurusan: ['jurusan'],
    posisi_dilamar: ['posisiDilamar', 'posisi_dilamar', 'position'],
    sumber_lowongan: ['sumberLowongan', 'sumber_lowongan'],
    status_aplikasi: ['statusAplikasi', 'status_aplikasi', 'status'],
    pengalaman_kerja: ['pengalamanKerja', 'pengalaman_kerja'],
    skills: ['skills'],
    district: ['district'],
    sub_district: ['subDistrict', 'sub_district'],
    village: ['village'],
    hamlet: ['hamlet'],
    rt: ['rt'],
    rw: ['rw'],
    alamat_lengkap: ['alamatLengkap', 'alamat_lengkap'],
    alamat_domisili: ['alamatDomisili', 'alamat_domisili'],
    catatan_hrd: ['catatanHrd', 'catatan_hrd', 'notes'],
    source_beneficiary_id: ['sourceBeneficiaryId', 'source_beneficiary_id', 'beneficiaryId'],
    created_at: ['createdAt', 'created_at'],
    updated_at: ['updatedAt', 'updated_at'],
    deleted_at: ['deletedAt', 'deleted_at', 'isDeleted'],
  },
  pdf_settings: {
    header_color: ['headerColor', 'header_color'],
    header_logo_file_id: ['headerLogoFileId', 'header_logo_file_id', 'headerLogoUrl'],
    footer_logo_file_id: ['footerLogoFileId', 'footer_logo_file_id', 'footerLogoUrl'],
    company_name: ['companyName', 'company_name'],
    address: ['address'],
    phone: ['phone'],
    extra: ['extra'],
    updated_by_user_id: ['updatedByUserId', 'updated_by_user_id'],
    updated_at: ['updatedAt', 'updated_at'],
  },
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function isMainModule() {
  return pathToFileURL(process.argv[1] ?? '').href === pathToFileURL(__filename).href
}

function assertOutputTableCoverage() {
  const missingCanonicalMeta = TRANSFORMED_CANONICAL_TABLES.filter((tableName) => !CANONICAL_OUTPUT[tableName])
  const missingSidecarMeta = TRANSFORMED_SIDECAR_TABLES.filter((tableName) => !SIDECAR_OUTPUT[tableName])

  if (missingCanonicalMeta.length > 0 || missingSidecarMeta.length > 0) {
    const messages = []

    if (missingCanonicalMeta.length > 0) {
      messages.push(`canonical: ${missingCanonicalMeta.join(', ')}`)
    }

    if (missingSidecarMeta.length > 0) {
      messages.push(`sidecar: ${missingSidecarMeta.join(', ')}`)
    }

    throw new Error(`Output metadata belum lengkap untuk tabel transform: ${messages.join(' | ')}`)
  }
}

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function normalizeLowerText(value, fallback = null) {
  const normalizedValue = normalizeText(value, null)

  return normalizedValue ? normalizedValue.toLowerCase() : fallback
}

function toNumber(value, fallback = 0) {
  if (value == null || value === '') {
    return fallback
  }

  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function toInteger(value, fallback = 0) {
  return Math.trunc(toNumber(value, fallback))
}

function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  const normalizedValue = normalizeLowerText(value, null)

  if (!normalizedValue) {
    return fallback
  }

  if (['true', '1', 'yes', 'y', 'on', 'active', 'aktif'].includes(normalizedValue)) {
    return true
  }

  if (['false', '0', 'no', 'n', 'off', 'inactive', 'nonaktif'].includes(normalizedValue)) {
    return false
  }

  return fallback
}

function toIsoString(value, fallback = null) {
  if (!value) {
    return fallback
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim()

    if (!normalizedValue) {
      return fallback
    }

    const parsedDate = new Date(normalizedValue)
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString()
    }

    return normalizedValue
  }

  if (typeof value === 'object') {
    const seconds = Number(value.seconds ?? NaN)
    const nanos = Number(value.nanoseconds ?? 0)

    if (Number.isFinite(seconds)) {
      const date = new Date(seconds * 1000 + nanos / 1e6)
      return date.toISOString()
    }
  }

  const parsedDate = new Date(value)

  return Number.isNaN(parsedDate.getTime()) ? fallback : parsedDate.toISOString()
}

function toDateString(value, fallback = null) {
  const isoValue = toIsoString(value, null)

  if (!isoValue) {
    return fallback
  }

  return isoValue.slice(0, 10)
}

function normalizeStatusFlag(value, fallback = null) {
  if (value == null) {
    return fallback
  }

  if (typeof value === 'boolean') {
    return value ? 'active' : 'inactive'
  }

  const normalizedValue = normalizeLowerText(value, null)

  if (!normalizedValue) {
    return fallback
  }

  if (['active', 'aktif', 'enabled', 'open', 'unpaid', 'billed', 'paid', 'screening', 'interview_hr', 'offering', 'diterima', 'ditolak', 'delivery_order'].includes(normalizedValue)) {
    return normalizedValue
  }

  return fallback ?? normalizedValue
}

function slugify(value, fallback = 'workspace') {
  const normalizedValue = normalizeText(value, '')
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalizedValue || fallback
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : []
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter(([, entry]) => entry !== undefined)
  )
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => normalizeText(value, null)).filter(Boolean))]
}

function ensureArray(value) {
  if (Array.isArray(value)) {
    return value
  }

  if (value == null) {
    return []
  }

  return [value]
}

function normalizeLegacyMoney(value, fallback = null) {
  if (value == null || value === '') {
    return fallback
  }

  const parsedValue = Number(String(value).replaceAll(',', ''))

  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function stableUuid(name) {
  const namespace = 'b6f0a8ae-87de-4f12-9d31-f7d0dc5b1d89'
  const hash = crypto
    .createHash('sha1')
    .update(namespace)
    .update('::')
    .update(String(name ?? ''))
    .digest('hex')
    .slice(0, 32)

  const bytes = hash.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []

  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-')
}

function hashText(text, length = 16) {
  return crypto.createHash('sha1').update(String(text ?? '')).digest('hex').slice(0, length)
}

function docNameToPath(documentName) {
  const normalizedName = String(documentName ?? '').trim()
  const prefixIndex = normalizedName.indexOf(FIRESTORE_DOC_NAME_PREFIX)

  if (prefixIndex === -1) {
    return normalizedName
  }

  return normalizedName.slice(prefixIndex + FIRESTORE_DOC_NAME_PREFIX.length)
}

function encodeFirestorePath(documentPath) {
  return String(documentPath)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function safeFileName(fileName, fallback = 'file.json') {
  const normalizedName = normalizeText(fileName, fallback)
  return normalizedName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
}

function guessExtensionFromUrlOrName(value) {
  const normalizedValue = normalizeText(value, '')

  if (!normalizedValue) {
    return ''
  }

  const parsedUrl = (() => {
    try {
      return new URL(normalizedValue)
    } catch {
      return null
    }
  })()

  const candidate = parsedUrl?.pathname ?? normalizedValue
  const extensionMatch = candidate.match(/(\.[a-z0-9]+)$/i)

  return extensionMatch ? extensionMatch[1].toLowerCase() : ''
}

function basenameFromUrl(value) {
  const normalizedValue = normalizeText(value, '')

  if (!normalizedValue) {
    return null
  }

  try {
    const url = new URL(normalizedValue)
    const parts = url.pathname.split('/').filter(Boolean)
    return parts.at(-1) ?? null
  } catch {
    const parts = normalizedValue.split('/').filter(Boolean)
    return parts.at(-1) ?? null
  }
}

function normalizeFirestoreValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeFirestoreValue(entry))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) {
    return null
  }

  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) {
    return Boolean(value.booleanValue)
  }

  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) {
    return Number(value.integerValue)
  }

  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) {
    return Number(value.doubleValue)
  }

  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) {
    return value.stringValue
  }

  if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) {
    return toIsoString(value.timestampValue, value.timestampValue)
  }

  if (Object.prototype.hasOwnProperty.call(value, 'referenceValue')) {
    return docNameToPath(value.referenceValue)
  }

  if (Object.prototype.hasOwnProperty.call(value, 'bytesValue')) {
    return value.bytesValue
  }

  if (Object.prototype.hasOwnProperty.call(value, 'geoPointValue')) {
    return {
      latitude: Number(value.geoPointValue.latitude ?? 0),
      longitude: Number(value.geoPointValue.longitude ?? 0),
    }
  }

  if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) {
    return normalizeFirestoreFields(value.mapValue?.fields ?? {})
  }

  if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) {
    return normalizeArray(value.arrayValue?.values ?? []).map((entry) =>
      normalizeFirestoreValue(entry)
    )
  }

  if (Object.prototype.hasOwnProperty.call(value, 'values')) {
    return normalizeArray(value.values).map((entry) => normalizeFirestoreValue(entry))
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, normalizeFirestoreValue(entry)])
  )
}

function normalizeFirestoreFields(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, normalizeFirestoreValue(value)])
  )
}

function createCliParser(argv) {
  const options = {
    help: false,
    serviceAccountPath: normalizeText(process.env.GOOGLE_APPLICATION_CREDENTIALS, null),
    serviceAccountJson: normalizeText(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, null),
    projectId: normalizeText(process.env.GOOGLE_CLOUD_PROJECT ?? process.env.FIRESTORE_PROJECT_ID, null),
    snapshotInputDir: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    rootCollections: [...DEFAULT_ROOT_COLLECTIONS],
    rootCollectionsExplicit: false,
    globalTeamPath: DEFAULT_GLOBAL_TEAM_PATH,
    includeRaw: true,
    includeCanonical: true,
    includeSidecar: true,
    pageSize: FIRESTORE_PAGE_SIZE,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--help' || token === '-h') {
      options.help = true
      continue
    }

    if (token === '--no-raw') {
      options.includeRaw = false
      continue
    }

    if (token === '--no-canonical') {
      options.includeCanonical = false
      continue
    }

    if (token === '--no-sidecar') {
      options.includeSidecar = false
      continue
    }

    if (token.startsWith('--service-account-json=')) {
      options.serviceAccountJson = token.slice('--service-account-json='.length)
      continue
    }

    if (token === '--service-account-json') {
      options.serviceAccountJson = argv[++index] ?? ''
      continue
    }

    if (token.startsWith('--service-account=')) {
      options.serviceAccountPath = token.slice('--service-account='.length)
      continue
    }

    if (token === '--service-account') {
      options.serviceAccountPath = argv[++index] ?? ''
      continue
    }

    if (token.startsWith('--project-id=')) {
      options.projectId = token.slice('--project-id='.length)
      continue
    }

    if (token === '--project-id') {
      options.projectId = argv[++index] ?? ''
      continue
    }

    if (token.startsWith('--snapshot-input=')) {
      options.snapshotInputDir = token.slice('--snapshot-input='.length)
      continue
    }

    if (token === '--snapshot-input') {
      options.snapshotInputDir = argv[++index] ?? ''
      continue
    }

    if (token.startsWith('--output=')) {
      options.outputDir = token.slice('--output='.length)
      continue
    }

    if (token === '--output') {
      options.outputDir = argv[++index] ?? ''
      continue
    }

    if (token.startsWith('--root-collections=')) {
      options.rootCollections = uniqueStrings(token.slice('--root-collections='.length).split(','))
      options.rootCollectionsExplicit = true
      continue
    }

    if (token === '--root-collections') {
      options.rootCollections = uniqueStrings(String(argv[++index] ?? '').split(','))
      options.rootCollectionsExplicit = true
      continue
    }

    if (token.startsWith('--global-team-path=')) {
      options.globalTeamPath = token.slice('--global-team-path='.length)
      continue
    }

    if (token === '--global-team-path') {
      options.globalTeamPath = argv[++index] ?? ''
      continue
    }

    if (token.startsWith('--page-size=')) {
      options.pageSize = Math.max(1, toInteger(token.slice('--page-size='.length), FIRESTORE_PAGE_SIZE))
      continue
    }

    if (token === '--page-size') {
      options.pageSize = Math.max(1, toInteger(argv[++index] ?? '', FIRESTORE_PAGE_SIZE))
      continue
    }

    if (token.startsWith('--collection=')) {
      options.rootCollections = uniqueStrings([
        ...options.rootCollections,
        token.slice('--collection='.length),
      ])
      options.rootCollectionsExplicit = true
      continue
    }

    if (token === '--collection') {
      options.rootCollections = uniqueStrings([
        ...options.rootCollections,
        argv[++index] ?? '',
      ])
      options.rootCollectionsExplicit = true
      continue
    }
  }

  return options
}

function printUsage() {
  console.log(`
Firestore legacy JSON extractor

Usage:
  node scripts/firestore-backfill/extract.mjs --service-account ./serviceAccount.json --project-id legacy-project --output ./firestore-legacy-export

Options:
  --service-account <path>        Path to Firebase service account JSON
  --service-account-json <json>   Inline service account JSON
  --project-id <id>               Override Firestore project id
  --snapshot-input <dir>          Local export snapshot root with manifest.json and collection folders
  --output <dir>                  Output directory (default: firestore-legacy-export)
  --root-collections <list>       Root collections to walk (comma separated)
  --global-team-path <path>       Team path used for global legacy collections (default: teams/main)
  --no-raw                        Skip raw dump output
  --no-canonical                  Skip canonical output
  --no-sidecar                    Skip identity sidecar output
  --page-size <n>                 Firestore page size (default: 1000)
  -h, --help                      Show this help

Default root collections:
  teams, penerimaManfaat, users

Output tree:
  raw/      - Firestore-shaped dumps per collection path
  canonical/- insert-ready JSON per target domain/table
  sidecar/  - identity bridge artifacts that still need Telegram mapping
  meta/     - manifest, id-map, validation report
`)
}

async function loadServiceAccount(options) {
  if (options.serviceAccountJson) {
    return JSON.parse(options.serviceAccountJson)
  }

  if (options.serviceAccountPath) {
    const rawText = await fs.readFile(path.resolve(options.serviceAccountPath), 'utf8')
    return JSON.parse(rawText)
  }

  throw new Error(
    'Service account belum ditemukan. Gunakan --service-account atau --service-account-json, atau set GOOGLE_APPLICATION_CREDENTIALS.'
  )
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath)
    return stat.isFile()
  } catch {
    return false
  }
}

async function directoryExists(filePath) {
  try {
    const stat = await fs.stat(filePath)
    return stat.isDirectory()
  } catch {
    return false
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'))
}

function createSnapshotFirestoreClient(snapshotRoot) {
  function resolveCollectionDir(collectionPath) {
    return path.join(snapshotRoot, ...String(collectionPath).split('/').filter(Boolean))
  }

  function resolveDocumentDir(documentPath) {
    return path.join(snapshotRoot, ...String(documentPath).split('/').filter(Boolean))
  }

  return {
    async listDocuments(collectionPath) {
      const collectionDir = resolveCollectionDir(collectionPath)
      if (!(await directoryExists(collectionDir))) {
        return { documents: [], nextPageToken: null }
      }

      const entries = await fs.readdir(collectionDir, { withFileTypes: true })
      const documents = []

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue
        }

        const documentJsonPath = path.join(collectionDir, entry.name, 'document.json')
        if (!(await fileExists(documentJsonPath))) {
          continue
        }

        const rawDocument = await readJson(documentJsonPath)
        const documentPath = normalizeText(rawDocument.path ?? `${collectionPath}/${entry.name}`, null)

        documents.push({
          name: rawDocument.name ?? documentPath ?? '',
          fields: rawDocument.fields ?? rawDocument.data ?? {},
          createTime: rawDocument.createTime ?? rawDocument.exportedAt ?? null,
          updateTime: rawDocument.updateTime ?? rawDocument.exportedAt ?? null,
        })
      }

      documents.sort((left, right) => normalizeText(left.name, '').localeCompare(normalizeText(right.name, '')))

      return { documents, nextPageToken: null }
    },

    async listCollectionIds(documentPath) {
      const documentDir = resolveDocumentDir(documentPath)
      if (!(await directoryExists(documentDir))) {
        return { collectionIds: [], nextPageToken: null }
      }

      const entries = await fs.readdir(documentDir, { withFileTypes: true })
      const collectionIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
      collectionIds.sort((left, right) => left.localeCompare(right))

      return { collectionIds, nextPageToken: null }
    },
  }
}

function createFirestoreClient(projectId, accessToken, pageSize = FIRESTORE_PAGE_SIZE) {
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    projectId
  )}/databases/(default)/documents`

  async function requestJson(url, init = {}) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })

    const bodyText = await response.text()

    if (!response.ok) {
      const normalizedBody = bodyText.trim()
      throw new Error(
        `Firestore request gagal (${response.status} ${response.statusText}) untuk ${url}: ${
          normalizedBody || 'empty response'
        }`
      )
    }

    return bodyText ? JSON.parse(bodyText) : {}
  }

  return {
    async listDocuments(collectionPath, pageToken = null) {
      const params = new URLSearchParams()
      params.set('pageSize', String(pageSize))
      if (pageToken) {
        params.set('pageToken', pageToken)
      }

      const url = `${baseUrl}/${encodeFirestorePath(collectionPath)}?${params.toString()}`
      return requestJson(url)
    },
    async listCollectionIds(documentPath, pageToken = null) {
      const params = new URLSearchParams()
      const url = `${baseUrl}/${encodeFirestorePath(documentPath)}:listCollectionIds`
      const payload = { pageSize, ...(pageToken ? { pageToken } : {}) }
      return requestJson(`${url}?${params.toString()}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },
  }
}

function createJwtAssertion(serviceAccount, scope = FIRESTORE_SCOPE) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: serviceAccount.private_key_id,
  }

  const issuedAt = Math.floor(Date.now() / 1000)
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    scope,
    aud: FIRESTORE_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  }

  const encode = (value) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '')

  const unsignedToken = `${encode(header)}.${encode(payload)}`
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(unsignedToken)
  signer.end()
  const signature = signer.sign(serviceAccount.private_key)
  const encodedSignature = Buffer.from(signature)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')

  return `${unsignedToken}.${encodedSignature}`
}

async function exchangeJwtForAccessToken(serviceAccount, scope = FIRESTORE_SCOPE) {
  const assertion = createJwtAssertion(serviceAccount, scope)
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  })

  const response = await fetch(FIRESTORE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  const responseText = await response.text()

  if (!response.ok) {
    throw new Error(
      `Gagal mengambil access token Google: ${response.status} ${response.statusText} - ${
        responseText.trim() || 'empty response'
      }`
    )
  }

  const parsed = JSON.parse(responseText)

  if (!parsed?.access_token) {
    throw new Error('Access token Google tidak ditemukan di response auth.')
  }

  return parsed.access_token
}

function normalizeDocumentPath(document) {
  const name = normalizeText(document?.name, '')
  return name ? docNameToPath(name) : ''
}

function getCollectionPath(documentPath) {
  const parts = String(documentPath).split('/').filter(Boolean)
  return parts.slice(0, -1).join('/')
}

function getParentDocumentPath(documentPath) {
  const parts = String(documentPath).split('/').filter(Boolean)

  if (parts.length < 2) {
    return null
  }

  return parts.slice(0, -2).join('/') || null
}

function getDocId(documentPath) {
  return String(documentPath).split('/').filter(Boolean).at(-1) ?? ''
}

function getTeamPathForDocumentPath(documentPath, defaultTeamPath) {
  const normalizedPath = String(documentPath)
  if (!normalizedPath.startsWith('teams/')) {
    return defaultTeamPath
  }

  const parts = normalizedPath.split('/').filter(Boolean)
  if (parts.length < 2) {
    return defaultTeamPath
  }

  return `${parts[0]}/${parts[1]}`
}

function getCanonicalId(tableName, legacyPath) {
  return stableUuid(`${tableName}:${legacyPath}`)
}

function getTeamCanonicalId(teamPath) {
  return getCanonicalId('teams', teamPath)
}

function getCanonicalMeta(tableName) {
  return CANONICAL_OUTPUT[tableName] ?? null
}

function getSidecarMeta(tableName) {
  return SIDECAR_OUTPUT[tableName] ?? null
}

function createOutputContext(options) {
  return {
    options,
    rawCollections: new Map(),
    rawDocumentsByPath: new Map(),
    rawDocumentsByCollection: new Map(),
    nameIndex: new Map(),
    canonicalRows: new Map(),
    canonicalMeta: new Map(),
    sidecarRows: new Map(),
    sidecarMeta: new Map(),
    idMap: [],
    validation: {
      warnings: [],
      errors: [],
      missingRelations: [],
      duplicateKeys: [],
      skippedDocuments: [],
    },
    fileAssetRegistry: new Map(),
    billPaymentTotals: new Map(),
    loanPaymentTotals: new Map(),
    attendanceBillLinks: new Map(),
    knownTeamPaths: new Set(),
    walkedCollections: new Set(),
    docCollectionIds: new Map(),
  }
}

function addOutputRow(context, kind, tableName, row, meta = {}) {
  const bucketMap = kind === 'canonical' ? context.canonicalRows : context.sidecarRows
  const metaMap = kind === 'canonical' ? context.canonicalMeta : context.sidecarMeta
  const outputMeta = getCanonicalMeta(tableName) ?? getSidecarMeta(tableName)

  if (!outputMeta) {
    throw new Error(`Output meta tidak ditemukan untuk ${kind}.${tableName}`)
  }

  if (!bucketMap.has(tableName)) {
    bucketMap.set(tableName, [])
    metaMap.set(tableName, outputMeta)
  }

  bucketMap.get(tableName).push(row)

  if (meta.legacyPath) {
    context.idMap.push({
      legacy_firebase_path: meta.legacyPath,
      legacy_firebase_id: meta.legacyId ?? getDocId(meta.legacyPath),
      canonical_table: tableName,
      canonical_id: meta.canonicalId ?? row.id ?? row.team_id ?? null,
      kind,
      team_path: meta.teamPath ?? null,
      parent_legacy_path: meta.parentLegacyPath ?? null,
      derived: Boolean(meta.derived),
    })
  }
}

function addRawCollection(context, collectionPath, docs) {
  context.rawCollections.set(collectionPath, docs)
  context.rawDocumentsByCollection.set(collectionPath, docs)
  for (const doc of docs) {
    context.rawDocumentsByPath.set(doc.path, doc)
  }
}

function getNameCandidatesForCollection(collectionPath) {
  const collectionName = String(collectionPath).split('/').filter(Boolean).at(-1) ?? ''
  return NAME_FIELDS_BY_COLLECTION[collectionName] ?? ['name', 'title', 'displayName']
}

function addNameIndex(context, collectionPath, doc) {
  const docNameCandidates = getNameCandidatesForCollection(collectionPath)
  const fields = doc.data ?? {}
  const docId = doc.docId

  const keys = uniqueStrings(
    docNameCandidates.map((fieldName) => normalizeText(fields[fieldName], null)).filter(Boolean)
  )

  for (const key of keys) {
    const indexKey = `${collectionPath}::${normalizeLowerText(key, key)}`
    if (!context.nameIndex.has(indexKey)) {
      context.nameIndex.set(indexKey, [])
    }

    context.nameIndex.get(indexKey).push(doc.path)
  }

  const idIndexKey = `${collectionPath}::${docId}`
  context.nameIndex.set(idIndexKey, [doc.path])
}

function buildRawIndexes(context) {
  for (const [collectionPath, docs] of context.rawCollections.entries()) {
    for (const doc of docs) {
      addNameIndex(context, collectionPath, doc)
      const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
      if (teamPath) {
        context.knownTeamPaths.add(teamPath)
      }
    }
  }
}

function resolveLegacyPathById(context, teamPath, candidateCollections, legacyValue) {
  const normalizedValue = normalizeText(legacyValue, null)
  if (!normalizedValue) {
    return null
  }

  const normalizedTeamPath = normalizeText(teamPath, null)

  for (const collectionName of candidateCollections) {
    const scopedPath = normalizedTeamPath ? `${normalizedTeamPath}/${collectionName}/${normalizedValue}` : null
    if (scopedPath && context.rawDocumentsByPath.has(scopedPath)) {
      return scopedPath
    }
  }

  for (const collectionName of candidateCollections) {
    const indexKey = `${normalizedTeamPath ?? ''}/${collectionName}::${normalizedValue}`.replace(/^\/+/, '')
    const matchedPath = context.nameIndex.get(indexKey)?.[0] ?? null
    if (matchedPath) {
      return matchedPath
    }
  }

  return null
}

function resolveLegacyPathByName(context, teamPath, candidateCollections, legacyValue) {
  const normalizedValue = normalizeLowerText(legacyValue, null)
  if (!normalizedValue) {
    return null
  }

  const normalizedTeamPath = normalizeText(teamPath, null)

  for (const collectionName of candidateCollections) {
    const indexKey = `${normalizedTeamPath ?? ''}/${collectionName}::${normalizedValue}`.replace(/^\/+/, '')
    const matchedPath = context.nameIndex.get(indexKey)?.[0] ?? null
    if (matchedPath) {
      return matchedPath
    }
  }

  return null
}

function resolveLegacyPath(context, teamPath, candidateCollections, rawValue, { allowNameLookup = true } = {}) {
  const byId = resolveLegacyPathById(context, teamPath, candidateCollections, rawValue)

  if (byId) {
    return byId
  }

  if (!allowNameLookup) {
    return null
  }

  return resolveLegacyPathByName(context, teamPath, candidateCollections, rawValue)
}

function resolveCanonicalIdFromLegacyPath(context, tableName, legacyPath) {
  const canonicalId = getCanonicalId(tableName, legacyPath)

  return {
    canonicalId,
    legacyId: getDocId(legacyPath),
    legacyPath,
  }
}

function resolveRelationId(context, teamPath, fieldName, rawValue, { allowNameLookup = true } = {}) {
  const candidateCollections = RELATION_COLLECTIONS[fieldName] ?? []
  if (candidateCollections.length === 0) {
    return null
  }

  const legacyPath = resolveLegacyPath(context, teamPath, candidateCollections, rawValue, {
    allowNameLookup,
  })

  if (!legacyPath) {
    return null
  }

  const tableName = candidateCollections[0]
  return resolveCanonicalIdFromLegacyPath(context, tableName, legacyPath).canonicalId
}

function resolveRelationPath(context, teamPath, fieldName, rawValue, options = {}) {
  const candidateCollections = RELATION_COLLECTIONS[fieldName] ?? []
  return resolveLegacyPath(context, teamPath, candidateCollections, rawValue, options)
}

function normalizeDeletedAt(value, deletedFlag, fallbackIso = null) {
  const explicitDeletedAt = toIsoString(value, null)

  if (explicitDeletedAt) {
    return explicitDeletedAt
  }

  if (toBoolean(deletedFlag, false)) {
    return fallbackIso ?? new Date().toISOString()
  }

  return null
}

function pickField(data, fieldName, fallback = null) {
  const candidates = LEGACY_FIELD_CANDIDATES[fieldName] ?? [fieldName]

  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(data, candidate) && data[candidate] != null) {
      return data[candidate]
    }
  }

  return fallback
}

function pickText(data, fieldName, fallback = null) {
  return normalizeText(pickField(data, fieldName, fallback), fallback)
}

function pickLowerText(data, fieldName, fallback = null) {
  return normalizeLowerText(pickField(data, fieldName, fallback), fallback)
}

function pickNumber(data, fieldName, fallback = null) {
  const rawValue = pickField(data, fieldName, null)
  if (rawValue == null || rawValue === '') {
    return fallback
  }

  const parsedValue = Number(String(rawValue).replaceAll(',', ''))
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function pickInteger(data, fieldName, fallback = null) {
  const rawValue = pickNumber(data, fieldName, null)
  return rawValue == null ? fallback : Math.trunc(rawValue)
}

function pickDate(data, fieldName, fallback = null) {
  return toDateString(pickField(data, fieldName, null), fallback)
}

function pickTimestamp(data, fieldName, fallback = null) {
  return toIsoString(pickField(data, fieldName, null), fallback)
}

function transformTeamDoc(context, doc) {
  const teamPath = doc.path
  const teamId = getCanonicalId('teams', teamPath)
  const data = doc.data ?? {}
  const name =
    pickText(data, 'name', null) ??
    pickText(data, 'teamName', null) ??
    pickText(data, 'team_name', null) ??
    doc.docId
  const slug = slugify(pickText(data, 'slug', null) ?? name, doc.docId)
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )

  const row = compactObject({
    id: teamId,
    name,
    slug,
    is_active: toBoolean(pickField(data, 'is_active', null), !deletedAt),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'teams', row, {
    canonicalId: teamId,
    legacyPath: teamPath,
    legacyId: doc.docId,
    teamPath,
  })
}

function transformProjectDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('projects', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    name:
      pickText(data, 'name', null) ??
      pickText(data, 'projectName', null) ??
      doc.docId,
    project_type: pickText(data, 'project_type', null) ?? pickText(data, 'projectType', null),
    budget: pickNumber(data, 'budget', null),
    is_wage_assignable: toBoolean(pickField(data, 'is_wage_assignable', null), false),
    status: normalizeStatusFlag(pickField(data, 'status', null), deletedAt ? 'inactive' : 'active'),
    notes: pickText(data, 'notes', null),
    is_active: toBoolean(pickField(data, 'is_active', null), !deletedAt),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'projects', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })
}

function transformSupplierDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('suppliers', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )

  const supplierTypeRaw = pickText(data, 'supplier_type', null) ?? pickText(data, 'category', null)
  const supplierType = (() => {
    const normalized = normalizeLowerText(supplierTypeRaw, '')
    if (['material', 'bahan', 'stok'].includes(normalized)) return 'Material'
    if (['operasional', 'operational', 'ops'].includes(normalized)) return 'Operasional'
    if (['lainnya', 'other', 'misc'].includes(normalized)) return 'Lainnya'
    return 'Material'
  })()

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    name:
      pickText(data, 'name', null) ??
      pickText(data, 'supplierName', null) ??
      doc.docId,
    supplier_type: supplierType,
    notes: pickText(data, 'notes', null),
    is_active: toBoolean(pickField(data, 'is_active', null), !deletedAt),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'suppliers', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })
}

function transformExpenseCategoryDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('expense_categories', doc.path)
  const data = doc.data ?? {}
  const collectionName = getCollectionPath(doc.path).split('/').filter(Boolean).at(-1) ?? ''
  const categoryGroup = (() => {
    const rawGroup = pickLowerText(data, 'category_group', null)
    if (rawGroup && ['operational', 'material', 'other'].includes(rawGroup)) {
      return rawGroup
    }

    if (collectionName === 'material_categories') return 'material'
    if (collectionName === 'other_categories') return 'other'
    return 'operational'
  })()
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    name:
      pickText(data, 'name', null) ??
      pickText(data, 'categoryName', null) ??
      doc.docId,
    category_group: categoryGroup,
    notes: pickText(data, 'notes', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'expense_categories', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })
}

function transformFundingCreditorDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('funding_creditors', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    name:
      pickText(data, 'name', null) ??
      pickText(data, 'creditorName', null) ??
      doc.docId,
    notes: pickText(data, 'notes', null),
    is_active: toBoolean(pickField(data, 'is_active', null), !deletedAt),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'funding_creditors', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })
}

function transformProfessionDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('professions', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    profession_name:
      pickText(data, 'profession_name', null) ??
      pickText(data, 'professionName', null) ??
      doc.docId,
    notes: pickText(data, 'notes', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'professions', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })
}

function transformStaffDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('staff', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    staff_name:
      pickText(data, 'staff_name', null) ??
      pickText(data, 'staffName', null) ??
      doc.docId,
    payment_type: pickText(data, 'payment_type', null) ?? pickText(data, 'paymentType', null) ?? 'monthly',
    salary: pickNumber(data, 'salary', null),
    fee_percentage: pickNumber(data, 'fee_percentage', null) ?? pickNumber(data, 'feePercentage', null),
    fee_amount: pickNumber(data, 'fee_amount', null) ?? pickNumber(data, 'feeAmount', null),
    notes: pickText(data, 'notes', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'staff', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })
}

function transformMaterialDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('materials', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )
  const categoryId = resolveRelationId(
    context,
    teamPath,
    'category_id',
    pickField(data, 'categoryId', null) ?? pickField(data, 'category_id', null),
    { allowNameLookup: true }
  )

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    name:
      pickText(data, 'name', null) ??
      pickText(data, 'materialName', null) ??
      doc.docId,
    unit: pickText(data, 'unit', null),
    current_stock: pickNumber(data, 'current_stock', null) ?? pickNumber(data, 'currentStock', null) ?? 0,
    category_id: categoryId,
    usage_count: pickInteger(data, 'usage_count', null) ?? pickInteger(data, 'usageCount', null) ?? 0,
    reorder_point: pickNumber(data, 'reorder_point', null) ?? pickNumber(data, 'reorderPoint', null) ?? 0,
    notes: pickText(data, 'notes', null),
    is_active: toBoolean(pickField(data, 'is_active', null), !deletedAt),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'materials', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })
}

function transformWorkerDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('workers', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )
  const professionId = resolveRelationId(
    context,
    teamPath,
    'profession_id',
    pickField(data, 'professionId', null) ?? pickField(data, 'profession_id', null),
    { allowNameLookup: true }
  )
  const defaultProjectId = resolveRelationId(
    context,
    teamPath,
    'default_project_id',
    pickField(data, 'defaultProjectId', null) ?? pickField(data, 'default_project_id', null),
    { allowNameLookup: true }
  )

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    name:
      pickText(data, 'name', null) ??
      pickText(data, 'workerName', null) ??
      doc.docId,
    telegram_user_id: pickText(data, 'telegramUserId', null) ?? pickText(data, 'telegram_user_id', null),
    profession_id: professionId,
    status: normalizeStatusFlag(pickField(data, 'status', null), deletedAt ? 'inactive' : 'active'),
    default_project_id: defaultProjectId,
    default_role_name: pickText(data, 'defaultRole', null) ?? pickText(data, 'default_role_name', null),
    notes: pickText(data, 'notes', null),
    is_active: toBoolean(pickField(data, 'is_active', null), !deletedAt),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'workers', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })

  const projectWages = normalizeObject(pickField(data, 'projectWages', null))
  const workerName = row.name
  const baseUpdatedAt = row.updated_at ?? row.created_at ?? doc.updateTime ?? doc.createTime ?? null

  for (const [projectKey, roleValue] of Object.entries(projectWages)) {
    const projectPath = resolveLegacyPath(context, teamPath, ['projects'], projectKey, {
      allowNameLookup: true,
    })
    const projectCanonicalId = projectPath ? getCanonicalId('projects', projectPath) : null
    const roleMap = normalizeObject(roleValue)

    if (!projectCanonicalId) {
      context.validation.missingRelations.push({
        table: 'worker_wage_rates',
        field: 'project_id',
        legacy_path: `${doc.path}#projectWages/${projectKey}`,
        reason: 'project legacy reference tidak ditemukan',
      })
      continue
    }

    for (const [roleName, wageValue] of Object.entries(roleMap)) {
      const wageAmount = normalizeLegacyMoney(wageValue, null)
      if (wageAmount == null) {
        continue
      }

      const wageLegacyPath = `${doc.path}#projectWages/${projectKey}/${roleName}`
      const wageCanonicalId = getCanonicalId('worker_wage_rates', wageLegacyPath)
      const rowData = compactObject({
        id: wageCanonicalId,
        team_id: teamId,
        worker_id: canonicalId,
        project_id: projectCanonicalId,
        role_name: normalizeText(roleName, 'default'),
        wage_amount: wageAmount,
        is_default:
          normalizeText(row.default_role_name, null) != null &&
          normalizeText(roleName, null) === normalizeText(row.default_role_name, null),
        created_at: baseUpdatedAt,
        updated_at: baseUpdatedAt,
        deleted_at: deletedAt,
        legacy_firebase_id: `${doc.docId}:${projectKey}:${roleName}`,
      })

      addOutputRow(context, 'canonical', 'worker_wage_rates', rowData, {
        canonicalId: wageCanonicalId,
        legacyPath: wageLegacyPath,
        legacyId: `${doc.docId}:${projectKey}:${roleName}`,
        teamPath,
        derived: true,
      })
    }
  }
}

function normalizeExpenseType(value, fallback = 'material') {
  const normalized = normalizeLowerText(value, '')

  if (['material', 'material_invoice', 'invoice'].includes(normalized)) {
    return 'material'
  }

  if (['operasional', 'operational', 'expense', 'lainnya', 'other'].includes(normalized)) {
    return normalized === 'expense' ? 'operasional' : normalized
  }

  return fallback
}

function normalizeBillType(value, fallback = 'material') {
  const normalized = normalizeLowerText(value, '')

  if (['material', 'operasional', 'lainnya', 'gaji', 'fee'].includes(normalized)) {
    return normalized
  }

  if (['expense', 'material_invoice', 'invoice'].includes(normalized)) {
    return 'material'
  }

  return fallback
}

function normalizeDocumentType(value, fallback = 'faktur') {
  const normalized = normalizeLowerText(value, '')

  if (['faktur', 'surat_jalan'].includes(normalized)) {
    return normalized
  }

  if (['invoice', 'material_invoice'].includes(normalized)) {
    return 'faktur'
  }

  return fallback
}

function normalizeAttendanceStatus(value, fallback = 'full_day') {
  const normalized = normalizeLowerText(value, '')

  if (['full_day', 'half_day', 'overtime', 'absent'].includes(normalized)) {
    return normalized
  }

  if (['present', 'completed', 'checked_in', 'checked_out', 'full', 'hadir'].includes(normalized)) {
    return 'full_day'
  }

  if (['half', 'setengah', 'paruh'].includes(normalized)) {
    return 'half_day'
  }

  if (['lembur', 'extra'].includes(normalized)) {
    return 'overtime'
  }

  if (['alpha', 'absen', 'missing'].includes(normalized)) {
    return 'absent'
  }

  return fallback
}

function normalizeBillingStatus(value, fallback = 'unbilled') {
  if (typeof value === 'boolean') {
    return value ? 'billed' : 'unbilled'
  }

  const normalized = normalizeLowerText(value, '')
  if (['unbilled', 'billed', 'paid'].includes(normalized)) {
    return normalized
  }

  if (['true', 'yes', '1', 'paid'].includes(normalized)) {
    return 'billed'
  }

  return fallback
}

function ensureFileAsset(context, {
  teamPath,
  sourcePath,
  sourceLabel,
  url = null,
  originalName = null,
  fileName = null,
  mimeType = null,
  sizeBytes = null,
  uploadedBy = null,
  createdAt = null,
  updatedAt = null,
  bucketName = DEFAULT_BUCKET_NAME,
}) {
  const normalizedUrl = normalizeText(url, null)
  const normalizedBucket = normalizeText(bucketName, DEFAULT_BUCKET_NAME)
  const normalizedOriginalName = normalizeText(originalName, null)
  const normalizedFileName = normalizeText(fileName ?? originalName, null)
  const normalizedTeamPath = normalizeText(teamPath, DEFAULT_GLOBAL_TEAM_PATH)
  const assetKey = `${normalizedTeamPath}|${normalizedBucket}|${normalizedUrl ?? sourcePath}|${normalizedOriginalName ?? ''}`

  if (context.fileAssetRegistry.has(assetKey)) {
    return context.fileAssetRegistry.get(assetKey).id
  }

  const fileAssetId = getCanonicalId('file_assets', assetKey)
  const storageSuffix = hashText(assetKey, 24)
  const fallbackExtension =
    guessExtensionFromUrlOrName(normalizedUrl ?? normalizedOriginalName ?? normalizedFileName ?? '') ||
    '.bin'

  const row = compactObject({
    id: fileAssetId,
    team_id: getTeamCanonicalId(normalizedTeamPath),
    storage_bucket: normalizedBucket,
    bucket_name: normalizedBucket,
    storage_path: `legacy/${slugify(normalizedTeamPath, 'workspace')}/${slugify(
      normalizeText(sourceLabel, 'asset'),
      'asset'
    )}/${storageSuffix}${fallbackExtension}`,
    public_url: normalizedUrl ?? `legacy://${sourcePath}/${sourceLabel}/${storageSuffix}`,
    original_name:
      normalizedOriginalName ?? basenameFromUrl(normalizedUrl ?? '') ?? `${storageSuffix}${fallbackExtension}`,
    file_name:
      normalizedFileName ?? basenameFromUrl(normalizedUrl ?? '') ?? `${storageSuffix}${fallbackExtension}`,
    size_bytes: sizeBytes == null ? null : Number(sizeBytes),
    file_size: sizeBytes == null ? null : Number(sizeBytes),
    mime_type: normalizeText(mimeType, null),
    uploaded_by_user_id: null,
    uploaded_by: normalizeText(uploadedBy, null),
    created_at: normalizeText(createdAt, null),
    updated_at: normalizeText(updatedAt, null),
    deleted_at: null,
    legacy_firebase_id: `file_asset:${sourcePath}:${sourceLabel}:${storageSuffix}`,
  })

  context.fileAssetRegistry.set(assetKey, {
    id: fileAssetId,
    row,
    sourcePath,
    sourceLabel,
  })

  addOutputRow(context, 'canonical', 'file_assets', row, {
    canonicalId: fileAssetId,
    legacyPath: `${sourcePath}#${sourceLabel}`,
    legacyId: `file_asset:${sourcePath}:${sourceLabel}:${storageSuffix}`,
    teamPath: normalizedTeamPath,
    derived: true,
  })

  return fileAssetId
}

function transformExpenseDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('expenses', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )
  const projectId = resolveRelationId(
    context,
    teamPath,
    'project_id',
    pickField(data, 'projectId', null) ?? pickField(data, 'project_id', null),
    { allowNameLookup: true }
  )
  const supplierId = resolveRelationId(
    context,
    teamPath,
    'supplier_id',
    pickField(data, 'supplierId', null) ?? pickField(data, 'supplier_id', null),
    { allowNameLookup: true }
  )
  const categoryId = resolveRelationId(
    context,
    teamPath,
    'category_id',
    pickField(data, 'categoryId', null) ?? pickField(data, 'category_id', null),
    { allowNameLookup: true }
  )
  const expenseType = normalizeExpenseType(
    pickField(data, 'expense_type', null) ??
      pickField(data, 'expenseType', null) ??
      pickField(data, 'type', null),
    'material'
  )
  const documentType = normalizeDocumentType(
    pickField(data, 'document_type', null) ??
      pickField(data, 'documentType', null) ??
      pickField(data, 'formType', null),
    expenseType === 'material' ? 'faktur' : 'faktur'
  )
  const amount = pickNumber(data, 'amount', null) ?? pickNumber(data, 'total_amount', null) ?? 0
  const status = (() => {
    const normalizedStatus = normalizeLowerText(pickField(data, 'status', null), '')
    if (['unpaid', 'paid', 'delivery_order', 'cancelled'].includes(normalizedStatus)) {
      return normalizedStatus
    }
    if (documentType === 'surat_jalan') {
      return 'delivery_order'
    }
    return amount > 0 ? 'unpaid' : 'cancelled'
  })()

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    project_id: projectId,
    supplier_id: supplierId,
    category_id: categoryId,
    expense_type: expenseType,
    document_type: documentType,
    status,
    expense_date:
      pickDate(data, 'expense_date', null) ??
      pickDate(data, 'date', null) ??
      pickDate(data, 'transaction_date', null),
    description:
      pickText(data, 'description', null) ??
      pickText(data, 'notes', null) ??
      null,
    notes: pickText(data, 'notes', null),
    amount,
    total_amount: amount,
    telegram_user_id:
      pickText(data, 'telegramUserId', null) ??
      pickText(data, 'telegram_user_id', null) ??
      null,
    created_by_user_id:
      pickText(data, 'createdByUserId', null) ?? pickText(data, 'created_by_user_id', null),
    project_name_snapshot: pickText(data, 'project_name_snapshot', null) ?? pickText(data, 'projectName', null),
    supplier_name_snapshot:
      pickText(data, 'supplier_name_snapshot', null) ?? pickText(data, 'supplierName', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'expenses', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })

  const itemCandidates = []

  if (Array.isArray(data.items)) {
    itemCandidates.push(...data.items)
  }

  if (Array.isArray(data.line_items)) {
    itemCandidates.push(...data.line_items)
  }

  if (Array.isArray(data.lineItems)) {
    itemCandidates.push(...data.lineItems)
  }

  if (itemCandidates.length > 0) {
    itemCandidates.forEach((item, index) => {
      const itemData = normalizeObject(item)
      const sourceMaterialId = pickField(itemData, 'materialId', null) ?? pickField(itemData, 'material_id', null)
      const materialId = resolveRelationId(context, teamPath, 'material_id', sourceMaterialId, {
        allowNameLookup: true,
      })
      const lineTotal =
        pickNumber(itemData, 'lineTotal', null) ??
        pickNumber(itemData, 'line_total', null) ??
        pickNumber(itemData, 'subtotal', null) ??
        ((pickNumber(itemData, 'qty', null) ?? pickNumber(itemData, 'quantity', null) ?? 0) *
          (pickNumber(itemData, 'unitPrice', null) ?? pickNumber(itemData, 'unit_price', null) ?? 0))
      const lineLegacyPath = `${doc.path}#items/${index}`
      const lineCanonicalId = getCanonicalId('expense_line_items', lineLegacyPath)
      const lineRow = compactObject({
        id: lineCanonicalId,
        team_id: teamId,
        expense_id: canonicalId,
        material_id: materialId,
        item_name:
          pickText(itemData, 'item_name', null) ??
          pickText(itemData, 'name', null) ??
          pickText(itemData, 'materialName', null) ??
          pickText(itemData, 'material_name', null) ??
          `Item ${index + 1}`,
        qty: pickNumber(itemData, 'qty', null) ?? pickNumber(itemData, 'quantity', null) ?? 0,
        unit_price: pickNumber(itemData, 'unit_price', null) ?? pickNumber(itemData, 'unitPrice', null) ?? 0,
        line_total: lineTotal,
        sort_order: toInteger(pickField(itemData, 'sortOrder', null) ?? pickField(itemData, 'sort_order', null), index + 1),
        created_at: pickTimestamp(itemData, 'created_at', doc.createTime ?? null),
        updated_at: pickTimestamp(itemData, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
        deleted_at: normalizeDeletedAt(
          pickField(itemData, 'deleted_at', null),
          pickField(itemData, 'isDeleted', null),
          doc.updateTime ?? doc.createTime ?? null
        ),
        legacy_firebase_id: `${doc.docId}:item:${index}`,
      })

      addOutputRow(context, 'canonical', 'expense_line_items', lineRow, {
        canonicalId: lineCanonicalId,
        legacyPath: lineLegacyPath,
        legacyId: `${doc.docId}:item:${index}`,
        teamPath,
        derived: true,
      })
    })
  }

  const attachmentCandidates = []
  if (Array.isArray(data.attachments)) {
    attachmentCandidates.push(...data.attachments)
  }
  if (Array.isArray(data.files)) {
    attachmentCandidates.push(...data.files)
  }
  if (Array.isArray(data.attachmentUrls)) {
    attachmentCandidates.push(...data.attachmentUrls)
  }
  if (data.attachmentUrl) {
    attachmentCandidates.push(data.attachmentUrl)
  }

  attachmentCandidates.forEach((attachment, index) => {
    const attachmentData = normalizeObject(attachment)
    const url =
      typeof attachment === 'string'
        ? attachment
        : pickText(attachmentData, 'url', null) ??
          pickText(attachmentData, 'attachmentUrl', null) ??
          pickText(attachmentData, 'publicUrl', null) ??
          pickText(attachmentData, 'downloadUrl', null)
    const originalName =
      typeof attachment === 'string'
        ? basenameFromUrl(attachment)
        : pickText(attachmentData, 'name', null) ??
          pickText(attachmentData, 'file_name', null) ??
          pickText(attachmentData, 'original_name', null) ??
          basenameFromUrl(url)
    const mimeType = typeof attachment === 'string' ? null : pickText(attachmentData, 'mimeType', null) ?? pickText(attachmentData, 'mime_type', null)
    const sizeBytes = typeof attachment === 'string'
      ? null
      : pickNumber(attachmentData, 'sizeBytes', null) ?? pickNumber(attachmentData, 'size_bytes', null) ?? pickNumber(attachmentData, 'fileSize', null) ?? pickNumber(attachmentData, 'file_size', null)
    const uploadedBy = typeof attachment === 'string' ? null : pickText(attachmentData, 'uploadedBy', null) ?? pickText(attachmentData, 'uploaded_by', null)
    const fileAssetId = ensureFileAsset(context, {
      teamPath,
      sourcePath: doc.path,
      sourceLabel: `expense-attachment-${index}`,
      url: url ?? `legacy://${doc.path}/attachments/${index}`,
      originalName,
      fileName: originalName,
      mimeType,
      sizeBytes,
      uploadedBy,
      createdAt: pickTimestamp(attachmentData, 'created_at', doc.createTime ?? null),
      updatedAt: pickTimestamp(attachmentData, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
      bucketName: DEFAULT_BUCKET_NAME,
    })

    const attachmentLegacyPath = `${doc.path}#attachments/${index}`
    const attachmentCanonicalId = getCanonicalId('expense_attachments', attachmentLegacyPath)
    const attachmentRow = compactObject({
      id: attachmentCanonicalId,
      expense_id: canonicalId,
      team_id: teamId,
      file_asset_id: fileAssetId,
      sort_order: toInteger(
        pickField(attachmentData, 'sortOrder', null) ?? pickField(attachmentData, 'sort_order', null),
        index + 1
      ),
      created_at: pickTimestamp(attachmentData, 'created_at', doc.createTime ?? null),
      updated_at: pickTimestamp(attachmentData, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
      deleted_at: normalizeDeletedAt(
        pickField(attachmentData, 'deleted_at', null),
        pickField(attachmentData, 'isDeleted', null),
        doc.updateTime ?? doc.createTime ?? null
      ),
      legacy_firebase_id: `${doc.docId}:attachment:${index}`,
    })

    addOutputRow(context, 'canonical', 'expense_attachments', attachmentRow, {
      canonicalId: attachmentCanonicalId,
      legacyPath: attachmentLegacyPath,
      legacyId: `${doc.docId}:attachment:${index}`,
      teamPath,
      derived: true,
    })
  })
}

function transformProjectIncomeDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('project_incomes', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )
  const projectId = resolveRelationId(
    context,
    teamPath,
    'project_id',
    pickField(data, 'projectId', null) ?? pickField(data, 'project_id', null),
    { allowNameLookup: true }
  )

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    project_id: projectId,
    transaction_date:
      pickDate(data, 'transaction_date', null) ??
      pickDate(data, 'income_date', null) ??
      pickDate(data, 'date', null),
    income_date:
      pickDate(data, 'income_date', null) ?? pickDate(data, 'transaction_date', null) ?? pickDate(data, 'date', null),
    amount: pickNumber(data, 'amount', null) ?? 0,
    description: pickText(data, 'description', null),
    notes: pickText(data, 'notes', null),
    telegram_user_id: pickText(data, 'telegram_user_id', null) ?? pickText(data, 'telegramUserId', null),
    created_by_user_id: pickText(data, 'created_by_user_id', null) ?? pickText(data, 'createdByUserId', null),
    project_name_snapshot:
      pickText(data, 'project_name_snapshot', null) ?? pickText(data, 'projectName', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'project_incomes', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })
}

function normalizeLoanInterestTypeValue(value) {
  const normalized = normalizeLowerText(value, 'none')
  if (['no_interest', 'none', 'tanpa_bunga'].includes(normalized)) {
    return 'none'
  }
  if (['interest', 'bunga'].includes(normalized)) {
    return 'interest'
  }
  return 'none'
}

function transformLoanDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('loans', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )
  const creditorId = resolveRelationId(
    context,
    teamPath,
    'creditor_id',
    pickField(data, 'creditorId', null) ?? pickField(data, 'creditor_id', null),
    { allowNameLookup: true }
  )

  const loanNominalAmounts = resolveLoanNominalAmounts({
    principalAmount:
      pickNumber(data, 'principal_amount', null) ??
      pickNumber(data, 'principalAmount', null) ??
      pickNumber(data, 'amount', null) ??
      pickNumber(data, 'totalAmount', null) ??
      null,
    amount:
      pickNumber(data, 'amount', null) ??
      pickNumber(data, 'totalAmount', null) ??
      null,
    totalAmount: pickNumber(data, 'totalAmount', null) ?? pickNumber(data, 'total_amount', null) ?? null,
    repaymentAmount:
      pickNumber(data, 'repayment_amount', null) ??
      pickNumber(data, 'repaymentAmount', null) ??
      pickNumber(data, 'totalRepaymentAmount', null) ??
      null,
    totalRepaymentAmount:
      pickNumber(data, 'totalRepaymentAmount', null) ??
      pickNumber(data, 'total_repayment_amount', null) ??
      null,
    interestType:
      pickField(data, 'interest_type', null) ??
      pickField(data, 'interestType', null) ??
      null,
  })
  const interestType = normalizeLoanInterestTypeValue(
    pickField(data, 'interest_type', null) ?? pickField(data, 'interestType', null)
  )
  const interestRate = interestType === 'interest'
    ? pickNumber(data, 'interest_rate', null) ?? pickNumber(data, 'interestRate', null)
    : null

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    creditor_id: creditorId,
    transaction_date:
      pickDate(data, 'transaction_date', null) ??
      pickDate(data, 'disbursed_date', null) ??
      pickDate(data, 'date', null),
    disbursed_date:
      pickDate(data, 'disbursed_date', null) ??
      pickDate(data, 'transaction_date', null) ??
      pickDate(data, 'date', null),
    principal_amount: loanNominalAmounts.principal_amount,
    amount: loanNominalAmounts.amount,
    repayment_amount: loanNominalAmounts.repayment_amount,
    interest_type: interestType,
    interest_rate: interestRate,
    tenor_months: pickInteger(data, 'tenor_months', null) ?? pickInteger(data, 'tenorMonths', null),
    late_interest_rate: pickNumber(data, 'late_interest_rate', null) ?? pickNumber(data, 'lateInterestRate', null) ?? 0,
    late_interest_basis:
      pickText(data, 'late_interest_basis', null) ?? pickText(data, 'lateInterestBasis', null) ?? 'remaining',
    late_penalty_type:
      pickText(data, 'late_penalty_type', null) ?? pickText(data, 'latePenaltyType', null) ?? 'none',
    late_penalty_amount:
      pickNumber(data, 'late_penalty_amount', null) ?? pickNumber(data, 'latePenaltyAmount', null) ?? 0,
    description: pickText(data, 'description', null),
    notes: pickText(data, 'notes', null),
    status: normalizeStatusFlag(pickField(data, 'status', null), deletedAt ? 'cancelled' : 'unpaid'),
    paid_amount: pickNumber(data, 'paid_amount', null) ?? pickNumber(data, 'paidAmount', null) ?? 0,
    creditor_name_snapshot:
      pickText(data, 'creditor_name_snapshot', null) ?? pickText(data, 'creditorName', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'loans', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })
}

function transformLoanPaymentDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('loan_payments', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )
  const loanId = resolveRelationId(
    context,
    teamPath,
    'loan_id',
    pickField(data, 'loanId', null) ?? pickField(data, 'loan_id', null),
    { allowNameLookup: true }
  )

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    loan_id: loanId,
    amount: pickNumber(data, 'amount', null) ?? 0,
    payment_date:
      pickDate(data, 'payment_date', null) ??
      pickDate(data, 'paymentDate', null) ??
      pickDate(data, 'date', null),
    description: pickText(data, 'description', null) ?? pickText(data, 'notes', null),
    notes: pickText(data, 'notes', null),
    creditor_name_snapshot:
      pickText(data, 'creditor_name_snapshot', null) ?? pickText(data, 'creditorName', null),
    telegram_user_id: pickText(data, 'telegram_user_id', null) ?? pickText(data, 'telegramUserId', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'loan_payments', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })

  const previous = context.loanPaymentTotals.get(loanId) ?? { amount: 0, latestPaymentDate: null }
  previous.amount += row.amount ?? 0
  if (row.payment_date && (!previous.latestPaymentDate || row.payment_date > previous.latestPaymentDate)) {
    previous.latestPaymentDate = row.payment_date
  }
  context.loanPaymentTotals.set(loanId, previous)
}

function transformBillDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('bills', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )
  const expenseId = resolveRelationId(
    context,
    teamPath,
    'expense_id',
    pickField(data, 'expenseId', null) ?? pickField(data, 'expense_id', null),
    { allowNameLookup: true }
  )
  const projectIncomeId = resolveRelationId(
    context,
    teamPath,
    'project_income_id',
    pickField(data, 'projectIncomeId', null) ?? pickField(data, 'project_income_id', null),
    { allowNameLookup: true }
  )
  const workerId = resolveRelationId(
    context,
    teamPath,
    'worker_id',
    pickField(data, 'workerId', null) ?? pickField(data, 'worker_id', null),
    { allowNameLookup: true }
  )
  const staffId = resolveRelationId(
    context,
    teamPath,
    'staff_id',
    pickField(data, 'staffId', null) ?? pickField(data, 'staff_id', null),
    { allowNameLookup: true }
  )
  const projectId = resolveRelationId(
    context,
    teamPath,
    'project_id',
    pickField(data, 'projectId', null) ?? pickField(data, 'project_id', null),
    { allowNameLookup: true }
  )
  const supplierId = resolveRelationId(
    context,
    teamPath,
    'supplier_id',
    pickField(data, 'supplierId', null) ?? pickField(data, 'supplier_id', null),
    { allowNameLookup: true }
  )
  const billType = normalizeBillType(
    pickField(data, 'bill_type', null) ?? pickField(data, 'billType', null) ?? pickField(data, 'type', null),
    expenseId ? 'material' : workerId ? 'gaji' : 'fee'
  )
  const amount = pickNumber(data, 'amount', null) ?? pickNumber(data, 'billAmount', null) ?? 0
  const paidAmount = pickNumber(data, 'paid_amount', null) ?? pickNumber(data, 'paidAmount', null) ?? 0
  const dueDate = pickDate(data, 'due_date', null) ?? pickDate(data, 'dueDate', null)

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    expense_id: expenseId,
    project_income_id: projectIncomeId,
    worker_id: workerId,
    staff_id: staffId,
    project_id: projectId,
    supplier_id: supplierId,
    bill_type: billType,
    description: pickText(data, 'description', null) ?? pickText(data, 'notes', null) ?? null,
    amount,
    paid_amount: paidAmount,
    due_date: dueDate,
    status: normalizeStatusFlag(pickField(data, 'status', null), paidAmount > 0 ? (paidAmount >= amount && amount > 0 ? 'paid' : 'partial') : 'unpaid'),
    paid_at: pickTimestamp(data, 'paid_at', null) ?? pickTimestamp(data, 'paidAt', null),
    period_start: pickDate(data, 'period_start', null) ?? pickDate(data, 'startDate', null) ?? pickDate(data, 'periodStart', null),
    period_end: pickDate(data, 'period_end', null) ?? pickDate(data, 'endDate', null) ?? pickDate(data, 'periodEnd', null),
    supplier_name_snapshot:
      pickText(data, 'supplier_name_snapshot', null) ?? pickText(data, 'supplierNameSnapshot', null) ?? pickText(data, 'supplierName', null),
    worker_name_snapshot:
      pickText(data, 'worker_name_snapshot', null) ?? pickText(data, 'workerNameSnapshot', null) ?? pickText(data, 'workerName', null),
    project_name_snapshot:
      pickText(data, 'project_name_snapshot', null) ?? pickText(data, 'projectNameSnapshot', null) ?? pickText(data, 'projectName', null),
    creditor_name_snapshot:
      pickText(data, 'creditor_name_snapshot', null) ?? pickText(data, 'creditorNameSnapshot', null) ?? pickText(data, 'creditorName', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'bills', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })

  const recordIds = normalizeArray(pickField(data, 'recordIds', null) ?? pickField(data, 'record_ids', null))
  const resolvedAttendancePaths = recordIds
    .map((recordId) => resolveLegacyPath(context, teamPath, ['attendance_records'], recordId, { allowNameLookup: true }))
    .filter(Boolean)

  for (const attendancePath of resolvedAttendancePaths) {
    context.attendanceBillLinks.set(attendancePath, canonicalId)
  }

  const paymentTotals = context.billPaymentTotals.get(canonicalId) ?? { amount: 0, latestPaymentDate: null }
  if (paymentTotals.amount > 0 && (!row.paid_amount || row.paid_amount <= 0)) {
    row.paid_amount = paymentTotals.amount
  }
  if (!row.paid_at && paymentTotals.latestPaymentDate) {
    row.paid_at = paymentTotals.latestPaymentDate
  }
}

function transformBillPaymentDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('bill_payments', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )
  const billId = resolveRelationId(
    context,
    teamPath,
    'bill_id',
    pickField(data, 'billId', null) ?? pickField(data, 'bill_id', null),
    { allowNameLookup: true }
  )
  const workerId = resolveRelationId(
    context,
    teamPath,
    'worker_id',
    pickField(data, 'workerId', null) ?? pickField(data, 'worker_id', null),
    { allowNameLookup: true }
  )
  const amount = pickNumber(data, 'amount', null) ?? 0
  const paymentDate = pickDate(data, 'payment_date', null) ?? pickDate(data, 'paymentDate', null) ?? pickDate(data, 'date', null)

  const attachmentUrl =
    pickText(data, 'attachmentUrl', null) ??
    pickText(data, 'attachment_url', null) ??
    pickText(data, 'url', null)
  const attachmentFileId = attachmentUrl
    ? ensureFileAsset(context, {
        teamPath,
        sourcePath: doc.path,
        sourceLabel: 'bill-payment-attachment',
        url: attachmentUrl,
        originalName: basenameFromUrl(attachmentUrl),
        fileName: basenameFromUrl(attachmentUrl),
        mimeType: pickText(data, 'mimeType', null) ?? pickText(data, 'mime_type', null),
        sizeBytes: pickNumber(data, 'sizeBytes', null) ?? pickNumber(data, 'size_bytes', null),
        uploadedBy: pickText(data, 'uploadedBy', null),
        createdAt: pickTimestamp(data, 'created_at', doc.createTime ?? null),
        updatedAt: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
      })
    : null

  const row = compactObject({
    id: canonicalId,
    bill_id: billId,
    team_id: teamId,
    worker_id: workerId,
    amount,
    payment_date: paymentDate,
    recipient_name:
      pickText(data, 'recipient_name', null) ??
      pickText(data, 'recipientName', null) ??
      pickText(data, 'workerName', null) ??
      pickText(data, 'supplierName', null),
    description: pickText(data, 'description', null) ?? pickText(data, 'notes', null),
    notes: pickText(data, 'notes', null),
    attachment_file_id: attachmentFileId,
    telegram_user_id: pickText(data, 'telegram_user_id', null) ?? pickText(data, 'telegramUserId', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'bill_payments', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })

  const parentTotals = context.billPaymentTotals.get(billId) ?? { amount: 0, latestPaymentDate: null }
  parentTotals.amount += amount
  if (paymentDate && (!parentTotals.latestPaymentDate || paymentDate > parentTotals.latestPaymentDate)) {
    parentTotals.latestPaymentDate = paymentDate
  }
  context.billPaymentTotals.set(billId, parentTotals)
}

function transformAttendanceDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('attendance_records', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )
  const workerId = resolveRelationId(
    context,
    teamPath,
    'worker_id',
    pickField(data, 'workerId', null) ?? pickField(data, 'worker_id', null),
    { allowNameLookup: true }
  )
  const projectId = resolveRelationId(
    context,
    teamPath,
    'project_id',
    pickField(data, 'projectId', null) ?? pickField(data, 'project_id', null),
    { allowNameLookup: true }
  )
  const billIdFromField = resolveRelationId(
    context,
    teamPath,
    'salary_bill_id',
    pickField(data, 'billId', null) ?? pickField(data, 'salaryBillId', null) ?? pickField(data, 'salary_bill_id', null),
    { allowNameLookup: true }
  )
  const billIdFromLink = context.attendanceBillLinks.get(doc.path) ?? null
  const billId = billIdFromField ?? billIdFromLink
  const attendanceStatus = normalizeAttendanceStatus(
    pickField(data, 'attendance_status', null) ?? pickField(data, 'attendanceStatus', null),
    'full_day'
  )
  const billingStatus = normalizeBillingStatus(
    pickField(data, 'billing_status', null) ?? pickField(data, 'billingStatus', null) ?? pickField(data, 'isPaid', null),
    billId ? 'billed' : 'unbilled'
  )

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    worker_id: workerId,
    project_id: projectId,
    attendance_date:
      pickDate(data, 'attendance_date', null) ??
      pickDate(data, 'attendanceDate', null) ??
      pickDate(data, 'date', null),
    attendance_status: attendanceStatus,
    entry_mode: pickText(data, 'entry_mode', null) ?? pickText(data, 'entryMode', null) ?? 'manual',
    total_pay: pickNumber(data, 'total_pay', null) ?? pickNumber(data, 'totalPay', null) ?? 0,
    overtime_fee: pickNumber(data, 'overtime_fee', null) ?? pickNumber(data, 'overtimeFee', null) ?? null,
    billing_status: billingStatus,
    salary_bill_id: billId,
    notes: pickText(data, 'notes', null),
    worker_name_snapshot:
      pickText(data, 'worker_name_snapshot', null) ?? pickText(data, 'workerName', null),
    project_name_snapshot:
      pickText(data, 'project_name_snapshot', null) ?? pickText(data, 'projectName', null),
    telegram_user_id: pickText(data, 'telegram_user_id', null) ?? pickText(data, 'telegramUserId', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'attendance_records', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })
}

function transformStockTransactionDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('stock_transactions', doc.path)
  const data = doc.data ?? {}
  const materialId = resolveRelationId(
    context,
    teamPath,
    'material_id',
    pickField(data, 'materialId', null) ?? pickField(data, 'material_id', null),
    { allowNameLookup: true }
  )
  const projectId = resolveRelationId(
    context,
    teamPath,
    'project_id',
    pickField(data, 'projectId', null) ?? pickField(data, 'project_id', null),
    { allowNameLookup: true }
  )
  const expenseId = resolveRelationId(
    context,
    teamPath,
    'expense_id',
    pickField(data, 'relatedExpenseId', null) ?? pickField(data, 'expenseId', null) ?? pickField(data, 'expense_id', null),
    { allowNameLookup: true }
  )
  const expenseLineItemId = resolveRelationId(
    context,
    teamPath,
    'expense_line_item_id',
    pickField(data, 'expenseLineItemId', null) ?? pickField(data, 'expense_line_item_id', null) ?? pickField(data, 'relatedExpenseLineItemId', null),
    { allowNameLookup: true }
  )
  const rawDirection = normalizeLowerText(pickField(data, 'direction', null) ?? pickField(data, 'type', null), 'in')
  const direction = ['out', 'keluar', 'stock_out', 'decrease', 'minus'].includes(rawDirection) ? 'out' : 'in'
  const sourceTypeRaw = pickField(data, 'source_type', null) ?? pickField(data, 'sourceType', null) ?? pickField(data, 'type', null)
  const sourceType = normalizeText(sourceTypeRaw, direction === 'out' ? 'delivery_order' : 'invoice')

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    material_id: materialId,
    project_id: projectId,
    expense_id: expenseId,
    expense_line_item_id: expenseLineItemId,
    quantity: pickNumber(data, 'quantity', null) ?? pickNumber(data, 'qty', null) ?? 0,
    direction,
    source_type: sourceType,
    transaction_date:
      pickDate(data, 'transaction_date', null) ??
      pickDate(data, 'date', null) ??
      pickDate(data, 'createdAt', null),
    price_per_unit:
      pickNumber(data, 'price_per_unit', null) ?? pickNumber(data, 'pricePerUnit', null) ?? null,
    notes: pickText(data, 'notes', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'stock_transactions', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })
}

function transformBeneficiaryDoc(context, doc) {
  const teamPath = context.options.globalTeamPath
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('beneficiaries', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )

  const statusRaw = normalizeLowerText(
    pickField(data, 'status', null) ?? pickField(data, 'dataStatus', null),
    'active'
  )
  const status = ['active', 'pending', 'inactive'].includes(statusRaw) ? statusRaw : 'active'

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    nama_penerima: pickText(data, 'nama_penerima', null) ?? pickText(data, 'namaPenerima', null) ?? doc.docId,
    nik: pickText(data, 'nik', null),
    jenis_kelamin: pickText(data, 'jenis_kelamin', null) ?? pickText(data, 'jenisKelamin', null),
    jenjang: pickText(data, 'jenjang', null),
    nama_instansi: pickText(data, 'nama_instansi', null) ?? pickText(data, 'namaInstansi', null),
    npsn_nspp: pickText(data, 'npsn_nspp', null) ?? pickText(data, 'npsnNspp', null),
    jarak_meter: pickInteger(data, 'jarak_meter', null) ?? pickInteger(data, 'jarakMeter', null) ?? pickInteger(data, 'jarak', null),
    status,
    data_status: pickText(data, 'data_status', null) ?? pickText(data, 'dataStatus', null),
    tempat_lahir: pickText(data, 'tempat_lahir', null) ?? pickText(data, 'tempatLahir', null),
    tanggal_lahir: pickDate(data, 'tanggal_lahir', null) ?? pickDate(data, 'tanggalLahir', null),
    district: pickText(data, 'district', null),
    sub_district: pickText(data, 'sub_district', null) ?? pickText(data, 'subDistrict', null),
    village: pickText(data, 'village', null),
    hamlet: pickText(data, 'hamlet', null),
    rt: pickText(data, 'rt', null),
    rw: pickText(data, 'rw', null),
    alamat_lengkap: pickText(data, 'alamat_lengkap', null) ?? pickText(data, 'alamatLengkap', null),
    notes: pickText(data, 'notes', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'beneficiaries', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })
}

function transformApplicantDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const canonicalId = getCanonicalId('hrd_applicants', doc.path)
  const data = doc.data ?? {}
  const deletedAt = normalizeDeletedAt(
    pickField(data, 'deleted_at', null),
    pickField(data, 'isDeleted', null),
    doc.updateTime ?? doc.createTime ?? null
  )
  const sourceBeneficiaryId = resolveRelationId(
    context,
    teamPath,
    'source_beneficiary_id',
    pickField(data, 'sourceBeneficiaryId', null) ?? pickField(data, 'source_beneficiary_id', null) ?? pickField(data, 'beneficiaryId', null),
    { allowNameLookup: true }
  )

  const row = compactObject({
    id: canonicalId,
    team_id: teamId,
    source_beneficiary_id: sourceBeneficiaryId,
    nama_lengkap: pickText(data, 'nama_lengkap', null) ?? pickText(data, 'namaLengkap', null) ?? pickText(data, 'name', null) ?? doc.docId,
    email: pickText(data, 'email', null),
    no_telepon: pickText(data, 'no_telepon', null) ?? pickText(data, 'noTelepon', null) ?? pickText(data, 'phone', null),
    jenis_kelamin: pickText(data, 'jenis_kelamin', null) ?? pickText(data, 'jenisKelamin', null),
    nik: pickText(data, 'nik', null),
    no_kk: pickText(data, 'no_kk', null) ?? pickText(data, 'noKk', null),
    tempat_lahir: pickText(data, 'tempat_lahir', null) ?? pickText(data, 'tempatLahir', null),
    tanggal_lahir: pickDate(data, 'tanggal_lahir', null) ?? pickDate(data, 'tanggalLahir', null),
    pendidikan_terakhir: pickText(data, 'pendidikan_terakhir', null) ?? pickText(data, 'pendidikanTerakhir', null),
    nama_institusi_pendidikan:
      pickText(data, 'nama_institusi_pendidikan', null) ?? pickText(data, 'namaInstitusiPendidikan', null),
    jurusan: pickText(data, 'jurusan', null),
    posisi_dilamar: pickText(data, 'posisi_dilamar', null) ?? pickText(data, 'posisiDilamar', null) ?? pickText(data, 'position', null),
    sumber_lowongan: pickText(data, 'sumber_lowongan', null) ?? pickText(data, 'sumberLowongan', null),
    status_aplikasi:
      normalizeText(pickField(data, 'status_aplikasi', null) ?? pickField(data, 'statusAplikasi', null) ?? pickField(data, 'status', null), 'screening'),
    pengalaman_kerja: pickText(data, 'pengalaman_kerja', null) ?? pickText(data, 'pengalamanKerja', null),
    skills: pickText(data, 'skills', null),
    district: pickText(data, 'district', null),
    sub_district: pickText(data, 'sub_district', null) ?? pickText(data, 'subDistrict', null),
    village: pickText(data, 'village', null),
    hamlet: pickText(data, 'hamlet', null),
    rt: pickText(data, 'rt', null),
    rw: pickText(data, 'rw', null),
    alamat_lengkap: pickText(data, 'alamat_lengkap', null) ?? pickText(data, 'alamatLengkap', null),
    alamat_domisili: pickText(data, 'alamat_domisili', null) ?? pickText(data, 'alamatDomisili', null),
    catatan_hrd: pickText(data, 'catatan_hrd', null) ?? pickText(data, 'catatanHrd', null) ?? pickText(data, 'notes', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: deletedAt,
    legacy_firebase_id: doc.docId,
  })

  addOutputRow(context, 'canonical', 'hrd_applicants', row, {
    canonicalId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })

  const documents = []
  if (Array.isArray(data.documents)) {
    documents.push(...data.documents)
  }

  const directDocCandidates = [
    ['cv', pickField(data, 'urlCv', null)],
    ['ktp', pickField(data, 'urlKtp', null)],
    ['kk', pickField(data, 'urlKk', null)],
    ['pas_foto', pickField(data, 'urlPasFoto', null)],
    ['surat_sehat', pickField(data, 'urlSuratSehat', null)],
    ['other', pickField(data, 'urlLainnya', null)],
  ]

  for (const [documentType, urlValue] of directDocCandidates) {
    if (!urlValue) {
      continue
    }

    documents.push({
      documentType,
      url: urlValue,
    })
  }

  documents.forEach((documentItem, index) => {
    const documentData = normalizeObject(documentItem)
    const documentTypeRaw =
      pickText(documentData, 'documentType', null) ??
      pickText(documentData, 'document_type', null) ??
      'other'
    const normalizedDocumentType = normalizeLowerText(documentTypeRaw, 'other')
    const documentType = ['cv', 'ktp', 'kk', 'pas_foto', 'surat_sehat', 'other'].includes(
      normalizedDocumentType
    )
      ? normalizedDocumentType
      : 'other'
    const url =
      pickText(documentData, 'url', null) ??
      pickText(documentData, 'attachmentUrl', null) ??
      pickText(documentData, 'publicUrl', null) ??
      pickText(documentData, 'downloadUrl', null)

    if (!url) {
      return
    }

    const fileAssetId = ensureFileAsset(context, {
      teamPath,
      sourcePath: doc.path,
      sourceLabel: `applicant-document-${documentType}-${index}`,
      url,
      originalName: pickText(documentData, 'name', null) ?? basenameFromUrl(url),
      fileName: pickText(documentData, 'fileName', null) ?? pickText(documentData, 'file_name', null) ?? basenameFromUrl(url),
      mimeType: pickText(documentData, 'mimeType', null) ?? pickText(documentData, 'mime_type', null),
      sizeBytes: pickNumber(documentData, 'sizeBytes', null) ?? pickNumber(documentData, 'fileSize', null) ?? pickNumber(documentData, 'size_bytes', null),
      uploadedBy: pickText(documentData, 'uploadedBy', null),
      createdAt: pickTimestamp(documentData, 'created_at', doc.createTime ?? null),
      updatedAt: pickTimestamp(documentData, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
      bucketName: DEFAULT_BUCKET_NAME,
    })

    const applicantDocumentLegacyPath = `${doc.path}#documents/${documentType}-${index}`
    const applicantDocumentCanonicalId = getCanonicalId('hrd_applicant_documents', applicantDocumentLegacyPath)

    const rowData = compactObject({
      id: applicantDocumentCanonicalId,
      team_id: teamId,
      applicant_id: canonicalId,
      document_type: documentType,
      file_asset_id: fileAssetId,
      created_at: pickTimestamp(documentData, 'created_at', doc.createTime ?? null),
      updated_at: pickTimestamp(documentData, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
      deleted_at: normalizeDeletedAt(
        pickField(documentData, 'deleted_at', null),
        pickField(documentData, 'isDeleted', null),
        doc.updateTime ?? doc.createTime ?? null
      ),
      legacy_firebase_id: `${doc.docId}:document:${documentType}-${index}`,
    })

    addOutputRow(context, 'canonical', 'hrd_applicant_documents', rowData, {
      canonicalId: applicantDocumentCanonicalId,
      legacyPath: applicantDocumentLegacyPath,
      legacyId: `${doc.docId}:document:${documentType}-${index}`,
      teamPath,
      derived: true,
    })
  })
}

function transformPdfSettingsDoc(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const data = doc.data ?? {}
  const headerLogoUrl =
    pickText(data, 'headerLogoUrl', null) ??
    pickText(data, 'header_logo_url', null) ??
    pickText(data, 'headerLogoFileId', null)
  const footerLogoUrl =
    pickText(data, 'footerLogoUrl', null) ??
    pickText(data, 'footer_logo_url', null) ??
    pickText(data, 'footerLogoFileId', null)

  const headerLogoFileId = headerLogoUrl
    ? ensureFileAsset(context, {
        teamPath,
        sourcePath: doc.path,
        sourceLabel: 'pdf-header-logo',
        url: /^https?:\/\//i.test(headerLogoUrl) ? headerLogoUrl : `legacy://${doc.path}/header-logo/${headerLogoUrl}`,
        originalName: /^https?:\/\//i.test(headerLogoUrl) ? basenameFromUrl(headerLogoUrl) : `header-${headerLogoUrl}.png`,
        fileName: /^https?:\/\//i.test(headerLogoUrl) ? basenameFromUrl(headerLogoUrl) : `header-${headerLogoUrl}.png`,
        mimeType: pickText(data, 'headerLogoMimeType', null) ?? pickText(data, 'header_logo_mime_type', null),
        bucketName: DEFAULT_BUCKET_NAME,
        createdAt: pickTimestamp(data, 'created_at', doc.createTime ?? null),
        updatedAt: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
      })
    : null

  const footerLogoFileId = footerLogoUrl
    ? ensureFileAsset(context, {
        teamPath,
        sourcePath: doc.path,
        sourceLabel: 'pdf-footer-logo',
        url: /^https?:\/\//i.test(footerLogoUrl) ? footerLogoUrl : `legacy://${doc.path}/footer-logo/${footerLogoUrl}`,
        originalName: /^https?:\/\//i.test(footerLogoUrl) ? basenameFromUrl(footerLogoUrl) : `footer-${footerLogoUrl}.png`,
        fileName: /^https?:\/\//i.test(footerLogoUrl) ? basenameFromUrl(footerLogoUrl) : `footer-${footerLogoUrl}.png`,
        mimeType: pickText(data, 'footerLogoMimeType', null) ?? pickText(data, 'footer_logo_mime_type', null),
        bucketName: DEFAULT_BUCKET_NAME,
        createdAt: pickTimestamp(data, 'created_at', doc.createTime ?? null),
        updatedAt: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
      })
    : null

  const row = compactObject({
    team_id: teamId,
    header_color: pickText(data, 'header_color', null) ?? pickText(data, 'headerColor', null),
    header_logo_file_id: headerLogoFileId,
    footer_logo_file_id: footerLogoFileId,
    company_name: pickText(data, 'company_name', null) ?? pickText(data, 'companyName', null),
    address: pickText(data, 'address', null),
    phone: pickText(data, 'phone', null),
    extra: pickField(data, 'extra', null) ?? null,
    updated_by_user_id: pickText(data, 'updated_by_user_id', null) ?? pickText(data, 'updatedByUserId', null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
  })

  addOutputRow(context, 'canonical', 'pdf_settings', row, {
    canonicalId: teamId,
    legacyPath: doc.path,
    legacyId: doc.docId,
    teamPath,
  })
}

function transformUserSidecar(context, doc) {
  const data = doc.data ?? {}
  const firebaseUid = doc.docId
  const displayName =
    pickText(data, 'name', null) ??
    pickText(data, 'displayName', null) ??
    pickText(data, 'display_name', null)

  const row = compactObject({
    firebase_uid: firebaseUid,
    display_name: displayName,
    email: pickText(data, 'email', null),
    photo_url: pickText(data, 'photoURL', null) ?? pickText(data, 'photo_url', null),
    role: pickText(data, 'role', null),
    status: pickText(data, 'status', null),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    legacy_firebase_id: firebaseUid,
  })

  addOutputRow(context, 'sidecar', 'users', row, {
    canonicalId: firebaseUid,
    legacyPath: doc.path,
    legacyId: firebaseUid,
  })
}

function transformTeamMemberSidecar(context, doc) {
  const teamPath = getTeamPathForDocumentPath(doc.path, context.options.globalTeamPath)
  const teamId = getTeamCanonicalId(teamPath)
  const data = doc.data ?? {}
  const firebaseUid = doc.docId

  const row = compactObject({
    firebase_uid: firebaseUid,
    team_id: teamId,
    team_path: teamPath,
    email: pickText(data, 'email', null),
    name: pickText(data, 'name', null) ?? pickText(data, 'displayName', null),
    photo_url: pickText(data, 'photoURL', null) ?? pickText(data, 'photo_url', null),
    role: pickText(data, 'role', null),
    status: normalizeText(pickField(data, 'status', null), 'active'),
    is_default: toBoolean(pickField(data, 'isDefault', null), false),
    created_at: pickTimestamp(data, 'created_at', doc.createTime ?? null),
    updated_at: pickTimestamp(data, 'updated_at', doc.updateTime ?? doc.createTime ?? null),
    deleted_at: normalizeDeletedAt(
      pickField(data, 'deleted_at', null),
      pickField(data, 'isDeleted', null),
      doc.updateTime ?? doc.createTime ?? null
    ),
    legacy_firebase_id: firebaseUid,
  })

  addOutputRow(context, 'sidecar', 'team_members', row, {
    canonicalId: firebaseUid,
    legacyPath: doc.path,
    legacyId: firebaseUid,
    teamPath,
  })
}

function buildProfileSidecar(context) {
  const userRows = context.sidecarRows.get('users') ?? []
  const memberRows = context.sidecarRows.get('team_members') ?? []
  const profiles = new Map()

  for (const row of userRows) {
    const key = normalizeText(row.firebase_uid, null)
    if (!key) continue

    profiles.set(key, {
      firebase_uid: key,
      display_name: row.display_name ?? null,
      email: row.email ?? null,
      photo_url: row.photo_url ?? null,
      role: row.role ?? null,
      team_paths: [],
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
      legacy_firebase_id: row.legacy_firebase_id ?? key,
    })
  }

  for (const row of memberRows) {
    const key = normalizeText(row.firebase_uid, null)
    if (!key) continue

    const existing = profiles.get(key) ?? {
      firebase_uid: key,
      display_name: null,
      email: null,
      photo_url: null,
      role: null,
      team_paths: [],
      created_at: row.created_at ?? null,
      updated_at: row.updated_at ?? null,
      legacy_firebase_id: row.legacy_firebase_id ?? key,
    }

    if (!existing.display_name && row.name) {
      existing.display_name = row.name
    }
    if (!existing.email && row.email) {
      existing.email = row.email
    }
    if (!existing.photo_url && row.photo_url) {
      existing.photo_url = row.photo_url
    }
    if (!existing.role && row.role) {
      existing.role = row.role
    }
    if (!existing.created_at && row.created_at) {
      existing.created_at = row.created_at
    }
    if (!existing.updated_at && row.updated_at) {
      existing.updated_at = row.updated_at
    }
    if (row.team_path && !existing.team_paths.includes(row.team_path)) {
      existing.team_paths.push(row.team_path)
    }

    profiles.set(key, existing)
  }

  const profileRows = [...profiles.values()].map((row) =>
    compactObject({
      ...row,
      team_paths: row.team_paths.length > 0 ? row.team_paths : undefined,
      member_count: row.team_paths.length,
    })
  )

  context.sidecarRows.set('profiles', profileRows)
  context.sidecarMeta.set('profiles', SIDECAR_OUTPUT.profiles)
}

function canonicalRowsAsArray(context, tableName) {
  return context.canonicalRows.get(tableName) ?? []
}

function sidecarRowsAsArray(context, tableName) {
  return context.sidecarRows.get(tableName) ?? []
}

function finalizeBillAndLoanSummaries(context) {
  const billRows = canonicalRowsAsArray(context, 'bills')
  const billPayments = canonicalRowsAsArray(context, 'bill_payments')
  const loanRows = canonicalRowsAsArray(context, 'loans')
  const loanPayments = canonicalRowsAsArray(context, 'loan_payments')

  const billPaymentTotals = new Map()
  for (const payment of billPayments) {
    const billId = normalizeText(payment.bill_id, null)
    if (!billId) continue

    const existing = billPaymentTotals.get(billId) ?? { amount: 0, latestPaymentDate: null }
    existing.amount += toNumber(payment.amount, 0)
    if (payment.payment_date && (!existing.latestPaymentDate || payment.payment_date > existing.latestPaymentDate)) {
      existing.latestPaymentDate = payment.payment_date
    }
    billPaymentTotals.set(billId, existing)
  }

  for (const bill of billRows) {
    const paymentSummary = billPaymentTotals.get(bill.id)
    if (!paymentSummary) {
      continue
    }

    const existingPaid = toNumber(bill.paid_amount, 0)
    if (!existingPaid && paymentSummary.amount > 0) {
      bill.paid_amount = paymentSummary.amount
    }

    if (!bill.paid_at && paymentSummary.latestPaymentDate) {
      bill.paid_at = paymentSummary.latestPaymentDate
    }

    if (!bill.status || !['unpaid', 'partial', 'paid', 'cancelled'].includes(String(bill.status).toLowerCase())) {
      if (toNumber(bill.paid_amount, 0) >= toNumber(bill.amount, 0) && toNumber(bill.amount, 0) > 0) {
        bill.status = 'paid'
      } else if (toNumber(bill.paid_amount, 0) > 0) {
        bill.status = 'partial'
      } else {
        bill.status = 'unpaid'
      }
    }
  }

  const loanPaymentTotals = new Map()
  for (const payment of loanPayments) {
    const loanId = normalizeText(payment.loan_id, null)
    if (!loanId) continue

    const existing = loanPaymentTotals.get(loanId) ?? { amount: 0, latestPaymentDate: null }
    existing.amount += toNumber(payment.amount, 0)
    if (payment.payment_date && (!existing.latestPaymentDate || payment.payment_date > existing.latestPaymentDate)) {
      existing.latestPaymentDate = payment.payment_date
    }
    loanPaymentTotals.set(loanId, existing)
  }

  for (const loan of loanRows) {
    const paymentSummary = loanPaymentTotals.get(loan.id)
    if (!paymentSummary) {
      continue
    }

    const existingPaid = toNumber(loan.paid_amount, 0)
    if (!existingPaid && paymentSummary.amount > 0) {
      loan.paid_amount = paymentSummary.amount
    }

    if (!loan.status || !['unpaid', 'partial', 'paid', 'cancelled'].includes(String(loan.status).toLowerCase())) {
      if (toNumber(loan.paid_amount, 0) >= toNumber(loan.repayment_amount, 0) && toNumber(loan.repayment_amount, 0) > 0) {
        loan.status = 'paid'
      } else if (toNumber(loan.paid_amount, 0) > 0) {
        loan.status = 'partial'
      } else {
        loan.status = 'unpaid'
      }
    }
  }

  const attendanceRows = canonicalRowsAsArray(context, 'attendance_records')
  const attendanceByLegacyPath = new Map()
  for (const entry of context.idMap) {
    if (entry.canonical_table !== 'attendance_records') {
      continue
    }
    attendanceByLegacyPath.set(entry.legacy_firebase_path, entry.canonical_id)
  }

  for (const [legacyPath, billId] of context.attendanceBillLinks.entries()) {
    const attendanceCanonicalId = attendanceByLegacyPath.get(legacyPath)
    if (!attendanceCanonicalId) continue

    const attendance = attendanceRows.find((row) => row.id === attendanceCanonicalId)
    if (attendance && !attendance.salary_bill_id) {
      attendance.salary_bill_id = billId
      attendance.billing_status = attendance.billing_status === 'unbilled' ? 'billed' : attendance.billing_status
    }
  }

  const filteredAttendanceRows = attendanceRows.filter((attendance) =>
    shouldBackfillAttendanceRecord({ projectId: attendance.project_id })
  )
  const skippedAttendanceIds = new Set(
    attendanceRows
      .filter((attendance) => !shouldBackfillAttendanceRecord({ projectId: attendance.project_id }))
      .map((attendance) => attendance.id)
  )

  if (skippedAttendanceIds.size > 0) {
    context.canonicalRows.set('attendance_records', filteredAttendanceRows)
    context.idMap = context.idMap.filter(
      (entry) => entry.canonical_table !== 'attendance_records' || !skippedAttendanceIds.has(entry.canonical_id)
    )
    context.validation.warnings.push({
      scope: 'attendance_records',
      message: `${skippedAttendanceIds.size} attendance record legacy tanpa projectId dilewati dari backfill attendance.`,
    })
  }
}

function validateCanonical(context) {
  const pushDuplicateIssue = (tableName, keyFields) => {
    const rows = canonicalRowsAsArray(context, tableName)
    const seen = new Map()
    for (const row of rows) {
      const key = keyFields.map((field) => normalizeText(row[field], '')).join('::')
      if (!key.trim()) {
        continue
      }

      if (seen.has(key)) {
        context.validation.duplicateKeys.push({
          table: tableName,
          key,
          first: seen.get(key),
          duplicate: row.id ?? row.team_id ?? null,
        })
        continue
      }

      seen.set(key, row.id ?? row.team_id ?? null)
    }
  }

  pushDuplicateIssue('projects', ['team_id', 'name'])
  pushDuplicateIssue('suppliers', ['team_id', 'supplier_type', 'name'])
  pushDuplicateIssue('expense_categories', ['team_id', 'category_group', 'name'])
  pushDuplicateIssue('funding_creditors', ['team_id', 'name'])
  pushDuplicateIssue('professions', ['team_id', 'profession_name'])
  pushDuplicateIssue('staff', ['team_id', 'staff_name'])
  pushDuplicateIssue('materials', ['team_id', 'name'])
  pushDuplicateIssue('workers', ['team_id', 'name'])
  pushDuplicateIssue('beneficiaries', ['team_id', 'nik'])
  pushDuplicateIssue('hrd_applicants', ['team_id', 'nik'])
  pushDuplicateIssue('file_assets', ['team_id', 'storage_bucket', 'storage_path'])

  const relationChecks = [
    ['project_incomes', 'project_id', 'projects'],
    ['expenses', 'project_id', 'projects'],
    ['expenses', 'supplier_id', 'suppliers'],
    ['expenses', 'category_id', 'expense_categories'],
    ['expense_line_items', 'expense_id', 'expenses'],
    ['expense_line_items', 'material_id', 'materials'],
    ['expense_attachments', 'expense_id', 'expenses'],
    ['expense_attachments', 'file_asset_id', 'file_assets'],
    ['bills', 'expense_id', 'expenses'],
    ['bills', 'project_income_id', 'project_incomes'],
    ['bills', 'worker_id', 'workers'],
    ['bills', 'staff_id', 'staff'],
    ['bills', 'project_id', 'projects'],
    ['bills', 'supplier_id', 'suppliers'],
    ['bill_payments', 'bill_id', 'bills'],
    ['bill_payments', 'worker_id', 'workers'],
    ['loan_payments', 'loan_id', 'loans'],
    ['loans', 'creditor_id', 'funding_creditors'],
    ['attendance_records', 'worker_id', 'workers'],
    ['attendance_records', 'project_id', 'projects'],
    ['attendance_records', 'salary_bill_id', 'bills'],
    ['stock_transactions', 'material_id', 'materials'],
    ['stock_transactions', 'project_id', 'projects'],
    ['stock_transactions', 'expense_id', 'expenses'],
    ['stock_transactions', 'expense_line_item_id', 'expense_line_items'],
    ['hrd_applicants', 'source_beneficiary_id', 'beneficiaries'],
    ['hrd_applicant_documents', 'applicant_id', 'hrd_applicants'],
    ['hrd_applicant_documents', 'file_asset_id', 'file_assets'],
    ['pdf_settings', 'header_logo_file_id', 'file_assets'],
    ['pdf_settings', 'footer_logo_file_id', 'file_assets'],
  ]

  const tableIndex = new Map()
  for (const tableName of [...context.canonicalRows.keys()]) {
    const rows = canonicalRowsAsArray(context, tableName)
    const byId = new Map(rows.map((row) => [normalizeText(row.id ?? row.team_id, null), row]))
    tableIndex.set(tableName, byId)
  }

  for (const [tableName, fieldName, targetTable] of relationChecks) {
    const rows = canonicalRowsAsArray(context, tableName)
    const targetRows = tableIndex.get(targetTable) ?? new Map()

    for (const row of rows) {
      const relationValue = normalizeText(row[fieldName], null)
      if (!relationValue) {
        continue
      }

      if (!targetRows.has(relationValue)) {
        context.validation.missingRelations.push({
          table: tableName,
          field: fieldName,
          value: relationValue,
          primaryKey: row.id ?? null,
          targetTable,
        })
      }
    }
  }
}

function buildManifest(context) {
  const rawSummaries = [...context.rawCollections.entries()].map(([collectionPath, docs]) => ({
    collection_path: collectionPath,
    document_count: docs.length,
    output_file: `raw/${collectionPath}.json`,
  }))

  const canonicalSummaries = [...context.canonicalRows.entries()].map(([tableName, rows]) => ({
    table: tableName,
    group: getCanonicalMeta(tableName)?.group ?? null,
    row_count: rows.length,
    output_file: `canonical/${getCanonicalMeta(tableName)?.group ?? 'misc'}/${tableName}.json`,
  }))

  const sidecarSummaries = [...context.sidecarRows.entries()].map(([tableName, rows]) => ({
    table: tableName,
    group: getSidecarMeta(tableName)?.group ?? null,
    row_count: rows.length,
    output_file: `sidecar/${getSidecarMeta(tableName)?.group ?? 'misc'}/${tableName}.json`,
  }))

  return {
    generated_at: new Date().toISOString(),
    project_id: context.projectId,
    root_collections: context.options.rootCollections,
    global_team_path: context.options.globalTeamPath,
    output_dir: context.outputDir,
    raw: rawSummaries,
    canonical: canonicalSummaries,
    sidecar: sidecarSummaries,
    warnings: context.validation.warnings,
    missing_relations: context.validation.missingRelations.length,
    duplicate_keys: context.validation.duplicateKeys.length,
    skipped_documents: context.validation.skippedDocuments.length,
  }
}

async function prepareOutputRoot(outputRoot) {
  const resolvedRoot = path.resolve(outputRoot)
  const relative = path.relative(process.cwd(), resolvedRoot)

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Output directory harus berada di bawah workspace saat ini: ${resolvedRoot}`)
  }

  await fs.rm(resolvedRoot, { recursive: true, force: true })
  await fs.mkdir(resolvedRoot, { recursive: true })
  return resolvedRoot
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function writeOutputs(outputRoot, context, manifest) {
  const rawDir = path.join(outputRoot, 'raw')
  const canonicalDir = path.join(outputRoot, 'canonical')
  const sidecarDir = path.join(outputRoot, 'sidecar')
  const metaDir = path.join(outputRoot, 'meta')

  if (context.options.includeRaw) {
    for (const [collectionPath, docs] of context.rawCollections.entries()) {
      await writeJson(path.join(rawDir, `${collectionPath}.json`), {
        collection_path: collectionPath,
        generated_at: new Date().toISOString(),
        document_count: docs.length,
        documents: docs,
      })
    }
  }

  if (context.options.includeCanonical) {
    for (const [tableName, rows] of context.canonicalRows.entries()) {
      const meta = getCanonicalMeta(tableName)
      const filePath = path.join(canonicalDir, meta.group, `${meta.table}.json`)
      await writeJson(filePath, {
        domain: meta.group,
        target_table: meta.table,
        generated_at: new Date().toISOString(),
        row_count: rows.length,
        rows,
      })
    }
  }

  if (context.options.includeSidecar) {
    buildProfileSidecar(context)

    for (const [tableName, rows] of context.sidecarRows.entries()) {
      const meta = getSidecarMeta(tableName)
      const filePath = path.join(sidecarDir, meta.group, `${meta.table}.json`)
      await writeJson(filePath, {
        domain: meta.group,
        target_table: meta.table,
        generated_at: new Date().toISOString(),
        row_count: rows.length,
        rows,
      })
    }
  }

  await writeJson(path.join(metaDir, 'manifest.json'), manifest)
  await writeJson(path.join(metaDir, 'id-map.json'), context.idMap)
  await writeJson(path.join(metaDir, 'validation-report.json'), context.validation)
}

function walkCanonicalAndSidecarDocs(context, doc) {
  const pathName = doc.path

  if (/^teams\/[^/]+$/.test(pathName)) {
    transformTeamDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/projects\/[^/]+$/.test(pathName)) {
    transformProjectDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/suppliers\/[^/]+$/.test(pathName)) {
    transformSupplierDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/(operational_categories|material_categories|other_categories)\/[^/]+$/.test(pathName)) {
    transformExpenseCategoryDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/funding_creditors\/[^/]+$/.test(pathName)) {
    transformFundingCreditorDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/professions\/[^/]+$/.test(pathName)) {
    transformProfessionDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/staff\/[^/]+$/.test(pathName)) {
    transformStaffDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/materials\/[^/]+$/.test(pathName)) {
    transformMaterialDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/workers\/[^/]+$/.test(pathName)) {
    transformWorkerDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/(?:incomes|project_incomes)\/[^/]+$/.test(pathName)) {
    transformProjectIncomeDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/(?:funding_sources|loans)\/[^/]+$/.test(pathName)) {
    transformLoanDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/(?:funding_sources|loans)\/[^/]+\/payments\/[^/]+$/.test(pathName)) {
    transformLoanPaymentDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/expenses\/[^/]+$/.test(pathName)) {
    transformExpenseDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/bills\/[^/]+$/.test(pathName)) {
    transformBillDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/bills\/[^/]+\/payments\/[^/]+$/.test(pathName)) {
    transformBillPaymentDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/attendance_records\/[^/]+$/.test(pathName)) {
    transformAttendanceDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/stock_transactions\/[^/]+$/.test(pathName)) {
    transformStockTransactionDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/settings\/pdf$/.test(pathName)) {
    transformPdfSettingsDoc(context, doc)
    return
  }

  if (/^teams\/[^/]+\/members\/[^/]+$/.test(pathName)) {
    transformTeamMemberSidecar(context, doc)
    return
  }

  if (/^teams\/[^/]+\/hrd_applicants\/[^/]+$/.test(pathName)) {
    transformApplicantDoc(context, doc)
    return
  }

  if (/^penerimaManfaat\/[^/]+$/.test(pathName)) {
    transformBeneficiaryDoc(context, doc)
    return
  }

  if (/^users\/[^/]+$/.test(pathName)) {
    transformUserSidecar(context, doc)
    return
  }

  context.validation.skippedDocuments.push({
    path: pathName,
    collection_path: doc.collectionPath,
    reason: 'Tidak ada transform canonical/sidecar yang cocok.',
  })
}

function createRawDocModel(document) {
  const documentPath = normalizeText(
    normalizeDocumentPath(document),
    normalizeText(document?.path ?? document?.documentPath ?? null, '')
  )
  const fields = document?.fields ?? document?.data ?? {}
  const createTime = document?.createTime ?? document?.exportedAt ?? null
  const updateTime = document?.updateTime ?? document?.exportedAt ?? createTime ?? null

  return {
    path: documentPath,
    collectionPath: getCollectionPath(documentPath),
    parentPath: getParentDocumentPath(documentPath),
    docId: getDocId(documentPath),
    createTime: toIsoString(createTime, null),
    updateTime: toIsoString(updateTime, null),
    data: normalizeFirestoreFields(fields),
  }
}

async function walkCollection(client, collectionPath, context) {
  if (!collectionPath || context.walkedCollections.has(collectionPath)) {
    return
  }

  context.walkedCollections.add(collectionPath)

  const docs = []
  let pageToken = null

  do {
    const response = await client.listDocuments(collectionPath, pageToken)
    const documents = normalizeArray(response.documents)
    for (const document of documents) {
      docs.push(createRawDocModel(document))
    }
    pageToken = response.nextPageToken ?? null
  } while (pageToken)

  addRawCollection(context, collectionPath, docs)

  for (const doc of docs) {
    const childResponse = await client.listCollectionIds(doc.path)
    const childCollections = normalizeArray(childResponse.collectionIds)
    context.docCollectionIds.set(doc.path, childCollections)

    for (const childCollection of childCollections) {
      await walkCollection(client, `${doc.path}/${childCollection}`, context)
    }
  }
}

function deriveDefaultTeamPath(context) {
  if (context.rawDocumentsByPath.has(context.options.globalTeamPath)) {
    return context.options.globalTeamPath
  }

  const firstTeamDoc = [...context.rawDocumentsByPath.keys()].find((docPath) => /^teams\/[^/]+$/.test(docPath))

  return firstTeamDoc ?? context.options.globalTeamPath
}

async function main() {
  assertOutputTableCoverage()
  const options = createCliParser(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  const outputRoot = await prepareOutputRoot(options.outputDir)
  const contextOptions = {
    ...options,
    outputDir: outputRoot,
  }

  let client = null
  let projectId = normalizeText(options.projectId ?? null, null)
  let rootCollections = [...options.rootCollections]

  if (options.snapshotInputDir) {
    const snapshotInputDir = path.resolve(options.snapshotInputDir)
    const snapshotManifestPath = path.join(snapshotInputDir, 'manifest.json')

    if (!(await fileExists(snapshotManifestPath))) {
      throw new Error(`manifest.json tidak ditemukan pada snapshot input: ${snapshotManifestPath}`)
    }

    const snapshotManifest = await readJson(snapshotManifestPath)
    projectId = normalizeText(projectId ?? snapshotManifest.projectId ?? snapshotManifest.project_id ?? null, null)

    if (!projectId) {
      throw new Error(
        'Project ID snapshot tidak ditemukan. Gunakan --project-id atau pastikan manifest snapshot berisi projectId.'
      )
    }

    const snapshotRootCollections = Array.isArray(snapshotManifest.rootCollections)
      ? snapshotManifest.rootCollections
      : []

    if (options.rootCollectionsExplicit) {
      rootCollections = uniqueStrings(rootCollections)
    } else if (snapshotRootCollections.length > 0) {
      rootCollections = uniqueStrings(snapshotRootCollections)
    }

    if (rootCollections.length === 0) {
      rootCollections = [...DEFAULT_ROOT_COLLECTIONS]
    }

    client = createSnapshotFirestoreClient(snapshotInputDir)
  } else {
    const serviceAccount = await loadServiceAccount(options)
    projectId = normalizeText(
      projectId ?? serviceAccount.project_id ?? serviceAccount.projectId ?? null,
      null
    )

    if (!projectId) {
      throw new Error(
        'Project ID Firestore tidak ditemukan. Gunakan --project-id atau pastikan service account berisi project_id.'
      )
    }

    const accessToken = await exchangeJwtForAccessToken(serviceAccount)
    client = createFirestoreClient(projectId, accessToken, options.pageSize)
  }

  const context = createOutputContext({
    ...contextOptions,
    projectId,
    rootCollections,
  })

  for (const rootCollection of rootCollections) {
    await walkCollection(client, rootCollection, context)
  }

  buildRawIndexes(context)
  context.options.globalTeamPath = deriveDefaultTeamPath(context)

  for (const docs of context.rawCollections.values()) {
    for (const doc of docs) {
      walkCanonicalAndSidecarDocs(context, doc)
    }
  }

  finalizeBillAndLoanSummaries(context)
  validateCanonical(context)

  const manifest = buildManifest(context)
  await writeOutputs(outputRoot, context, manifest)

  console.log(
    JSON.stringify(
      {
        ok: true,
        project_id: projectId,
        output_dir: outputRoot,
        raw_collections: context.rawCollections.size,
        canonical_tables: context.canonicalRows.size,
        sidecar_tables: context.sidecarRows.size,
        missing_relations: context.validation.missingRelations.length,
        duplicate_keys: context.validation.duplicateKeys.length,
      },
      null,
      2
    )
  )
}

if (isMainModule()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  })
}
