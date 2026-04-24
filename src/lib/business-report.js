import { formatAppDateLabel } from './date-time.js'

const REPORT_KIND_OPTIONS = [
  {
    value: 'executive_finance',
    label: 'Umum',
    description: 'Ringkasan keuangan gabungan.',
  },
  {
    value: 'project_pl',
    label: 'Proyek',
    description: 'Laba rugi unit kerja terpilih.',
  },
  {
    value: 'cash_flow',
    label: 'Kas',
    description: 'Arus kas masuk dan keluar.',
  },
  {
    value: 'creditor_statement',
    label: 'Kreditur',
    description: 'Statement piutang kreditur.',
  },
  {
    value: 'supplier_statement',
    label: 'Supplier',
    description: 'Statement hutang supplier.',
  },
  {
    value: 'worker_statement',
    label: 'Pekerja',
    description: 'Statement gaji pekerja.',
  },
]

const BUSINESS_SOURCE_LABELS = {
  bill_payments: 'Pembayaran Tagihan',
  loan_payments: 'Angsuran Pinjaman',
  project_incomes: 'Pemasukan Proyek',
  loans: 'Pencairan Pinjaman',
}

const PARTY_STATEMENT_SOURCE_LABELS = {
  attendance: 'Absensi',
  bill_payment: 'Pembayaran Tagihan',
  loan: 'Pencairan Pinjaman',
  loan_payment: 'Pembayaran Pinjaman',
  salary_bill: 'Tagihan Gaji',
  supplier_bill: 'Tagihan Supplier',
  supplier_expense: 'Biaya Supplier',
}

function normalizeReportKind(value) {
  const normalizedValue = String(value ?? '').trim()

  if (REPORT_KIND_OPTIONS.some((option) => option.value === normalizedValue)) {
    return normalizedValue
  }

  return REPORT_KIND_OPTIONS[0].value
}

function getReportKindOption(reportKind) {
  const normalizedKind = normalizeReportKind(reportKind)

  return (
    REPORT_KIND_OPTIONS.find((option) => option.value === normalizedKind) ??
    REPORT_KIND_OPTIONS[0]
  )
}

function humanizeSnakeLabel(value, fallback = '-') {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return fallback
  }

  const compactValue = normalizedValue.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()

  if (!compactValue) {
    return fallback
  }

  return compactValue
    .split(' ')
    .map((segment) => {
      if (!segment) {
        return segment
      }

      return `${segment.slice(0, 1).toUpperCase()}${segment.slice(1).toLowerCase()}`
    })
    .join(' ')
}

function getBusinessSourceLabel(value) {
  const normalizedValue = String(value ?? '').trim().toLowerCase()

  if (!normalizedValue) {
    return '-'
  }

  return BUSINESS_SOURCE_LABELS[normalizedValue] ?? humanizeSnakeLabel(normalizedValue)
}

function getPartyStatementSourceLabel(value) {
  const normalizedValue = String(value ?? '').trim().toLowerCase()

  if (!normalizedValue) {
    return '-'
  }

  return PARTY_STATEMENT_SOURCE_LABELS[normalizedValue] ?? humanizeSnakeLabel(normalizedValue)
}

function getDefaultBusinessReportPeriod() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  return {
    dateFrom: formatDateInputValue(startOfMonth),
    dateTo: formatDateInputValue(now),
  }
}

function formatDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(String(value ?? '').trim())

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toISOString().slice(0, 10)
}

function formatReportPeriodLabel(dateFrom, dateTo) {
  const fromLabel = formatAppDateLabel(dateFrom)
  const toLabel = formatAppDateLabel(dateTo)

  if (!fromLabel && !toLabel) {
    return 'Periode belum dipilih'
  }

  if (fromLabel === toLabel) {
    return fromLabel
  }

  return `${fromLabel} - ${toLabel}`
}

function normalizePdfColor(value, fallback = '#2563eb') {
  const normalizedValue = String(value ?? '').trim()

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalizedValue)) {
    return normalizedValue
  }

  return fallback
}

function createPdfSettingsDraft(pdfSettings) {
  return {
    company_name: String(pdfSettings?.company_name ?? '').trim(),
    address: String(pdfSettings?.address ?? '').trim(),
    phone: String(pdfSettings?.phone ?? '').trim(),
    header_color: normalizePdfColor(pdfSettings?.header_color),
    header_logo_file_id: String(pdfSettings?.header_logo_file_id ?? '').trim(),
    footer_logo_file_id: String(pdfSettings?.footer_logo_file_id ?? '').trim(),
  }
}

function serializePdfSettingsDraft(draft) {
  return {
    company_name: String(draft?.company_name ?? '').trim(),
    address: String(draft?.address ?? '').trim(),
    phone: String(draft?.phone ?? '').trim(),
    header_color: normalizePdfColor(draft?.header_color),
    header_logo_file_id: String(draft?.header_logo_file_id ?? '').trim() || null,
    footer_logo_file_id: String(draft?.footer_logo_file_id ?? '').trim() || null,
  }
}

export {
  REPORT_KIND_OPTIONS,
  createPdfSettingsDraft,
  getBusinessSourceLabel,
  formatDateInputValue,
  formatReportPeriodLabel,
  getDefaultBusinessReportPeriod,
  getPartyStatementSourceLabel,
  getReportKindOption,
  normalizeReportKind,
  normalizePdfColor,
  serializePdfSettingsDraft,
}
