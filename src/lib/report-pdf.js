import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { APP_TIME_ZONE, formatAppDateLabel, toAppDateKey } from './date-time.js'
import { getBusinessSourceLabel, getPartyStatementSourceLabel } from './business-report.js'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

function normalizeText(value, fallback = '-') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function formatCurrency(value) {
  return currencyFormatter.format(toNumber(value))
}

function slugify(value) {
  return normalizeText(value, 'laporan')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseHexColor(color) {
  const normalizedColor = normalizeText(color, '#2563eb').replace(/^#/, '')

  if (/^[0-9a-fA-F]{3}$/.test(normalizedColor)) {
    const expanded = normalizedColor
      .split('')
      .map((segment) => `${segment}${segment}`)
      .join('')

    return [
      Number.parseInt(expanded.slice(0, 2), 16),
      Number.parseInt(expanded.slice(2, 4), 16),
      Number.parseInt(expanded.slice(4, 6), 16),
    ]
  }

  if (/^[0-9a-fA-F]{6}$/.test(normalizedColor)) {
    return [
      Number.parseInt(normalizedColor.slice(0, 2), 16),
      Number.parseInt(normalizedColor.slice(2, 4), 16),
      Number.parseInt(normalizedColor.slice(4, 6), 16),
    ]
  }

  return [37, 99, 235]
}

function mixPdfColor(baseColor = [37, 99, 235], targetColor = [255, 255, 255], ratio = 0.5) {
  const safeRatio = Math.min(Math.max(Number(ratio) || 0, 0), 1)

  return baseColor.map((channel, index) => {
    const targetChannel = targetColor[index] ?? 255
    return Math.round(channel + (targetChannel - channel) * safeRatio)
  })
}

function buildAccentPdfTheme(baseTheme = {}, accentColor = null) {
  const accent = Array.isArray(accentColor) && accentColor.length === 3 ? accentColor : baseTheme.accent

  return {
    ...baseTheme,
    accent,
    accentSoft: mixPdfColor(accent, [255, 255, 255], 0.88),
    accentBorder: mixPdfColor(accent, [255, 255, 255], 0.66),
    accentMuted: mixPdfColor(accent, [255, 255, 255], 0.42),
    sectionFill: mixPdfColor(accent, [255, 255, 255], 0.94),
    sectionBorder: mixPdfColor(accent, [255, 255, 255], 0.78),
  }
}

function formatPdfDateTime(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return 'tanggal belum tersedia'
  }

  const parsedDate = new Date(normalizedValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedValue
  }

  const hasTimeComponent = /\dT\d|\d:\d/.test(normalizedValue)

  if (hasTimeComponent) {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: APP_TIME_ZONE,
    }).format(parsedDate)
  }

  const normalizedDate = new Date(`${normalizedValue}T12:00:00Z`)

  if (Number.isNaN(normalizedDate.getTime())) {
    return normalizedValue
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: APP_TIME_ZONE,
  }).format(normalizedDate)
}

const SYS_COLORS = {
  primary: [0, 69, 50],
  primaryContainer: [6, 95, 70],
  onSurface: [25, 28, 29],
  mutedText: [140, 144, 145],
  surfaceLow: [243, 244, 245],
  watermark: [240, 248, 246],
}

const BUSINESS_REPORT_THEMES = {
  executive_finance: {
    accent: [37, 99, 235],
    accentSoft: [239, 246, 255],
    accentBorder: [191, 219, 254],
    accentMuted: [96, 165, 250],
    sectionFill: [248, 250, 252],
    sectionBorder: [226, 232, 240],
    kindLabel: 'UMUM',
  },
  project_pl: {
    accent: [22, 163, 74],
    accentSoft: [240, 253, 244],
    accentBorder: [187, 247, 208],
    accentMuted: [74, 222, 128],
    sectionFill: [240, 253, 244],
    sectionBorder: [187, 247, 208],
    kindLabel: 'PROYEK',
  },
  cash_flow: {
    accent: [245, 158, 11],
    accentSoft: [255, 251, 235],
    accentBorder: [253, 230, 138],
    accentMuted: [251, 191, 36],
    sectionFill: [255, 251, 235],
    sectionBorder: [253, 230, 138],
    kindLabel: 'KAS',
  },
  party_statement: {
    accent: [13, 148, 136],
    accentSoft: [240, 253, 250],
    accentBorder: [153, 246, 228],
    accentMuted: [45, 212, 191],
    sectionFill: [240, 253, 250],
    sectionBorder: [153, 246, 228],
    kindLabel: 'PIUTANG',
  },
}

function formatReceiptDate(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return '-'
  }

  const parsedDate = new Date(normalizedValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedValue
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: APP_TIME_ZONE,
  }).format(parsedDate)
}

function formatReceiptDateTime(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return formatPdfDateTime(new Date())
  }

  const parsedDate = new Date(normalizedValue)

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedValue
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIME_ZONE,
  }).format(parsedDate)
}

function formatReceiptDateKey(value) {
  const normalizedKey = toAppDateKey(value)

  return normalizedKey ? normalizedKey.replaceAll('-', '') : 'tanggal'
}

function formatReceiptCurrency(value) {
  const amount = Number(value)

  return `Rp ${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)}`
}

function resolvePaymentReceiptTitle(paymentType) {
  return paymentType === 'loan'
    ? 'KWITANSI PEMBAYARAN PINJAMAN'
    : 'KWITANSI PEMBAYARAN TAGIHAN'
}

function resolvePaymentReceiptReferenceName(paymentType, payment = {}, parentRecord = {}) {
  return paymentType === 'loan'
    ? normalizeText(
        parentRecord?.creditorName ??
          parentRecord?.creditor_name_snapshot ??
          payment?.creditorName ??
          payment?.creditorNameSnapshot,
        '-'
      )
    : normalizeText(
        parentRecord?.supplierName ??
          parentRecord?.supplier_name_snapshot ??
          parentRecord?.worker_name_snapshot ??
          payment?.supplierName ??
          payment?.workerName,
        '-'
      )
}

function resolvePaymentReceiptReferenceLabel(paymentType) {
  return paymentType === 'bill' ? 'Bill Pembelian' : 'Dokumen Pinjaman'
}

function resolvePaymentReceiptParentReferenceId(parentRecord = {}) {
  return normalizeText(parentRecord?.referenceId ?? parentRecord?.id, '-')
}

function resolvePaymentReceiptPaymentId(payment = {}) {
  return normalizeText(payment?.id ?? payment?.paymentId, 'UNDEF')
}

function resolvePaymentReceiptRemainingValue(parentRecord = {}, payment = {}) {
  const explicitRemaining =
    parentRecord?.remainingAmount ??
    parentRecord?.remaining_amount ??
    parentRecord?.remaining ??
    payment?.remainingAmount ??
    payment?.remaining_amount

  return Math.max(toNumber(explicitRemaining), 0)
}

function resolvePaymentReceiptStatus(parentRecord = {}, payment = {}) {
  return normalizeText(parentRecord?.status ?? payment?.status, 'Active')
}

function resolvePaymentReceiptSummaryRows(paymentType, payment, parentRecord, generatedAt) {
  return [
    ['Jenis Pembayaran', paymentType === 'bill' ? 'Tagihan (Bill)' : 'Pinjaman (Loan)'],
    ['ID Pembayaran', resolvePaymentReceiptPaymentId(payment)],
    [
      'Tanggal',
      payment?.paymentDate
        ? formatReceiptDate(payment.paymentDate)
        : formatReceiptDateTime(generatedAt),
    ],
    ['Nominal', formatReceiptCurrency(payment?.amount)],
    ['Catatan', normalizeText(payment?.notes ?? payment?.description, '-')],
  ]
}

function resolvePaymentReceiptContextRows(paymentType, payment, parentRecord) {
  return [
    ['Referensi', resolvePaymentReceiptReferenceLabel(paymentType)],
    ['ID Referensi', resolvePaymentReceiptParentReferenceId(parentRecord)],
    ['Sisa Saat Ini', formatReceiptCurrency(resolvePaymentReceiptRemainingValue(parentRecord, payment))],
    ['Status', resolvePaymentReceiptStatus(parentRecord, payment)],
  ]
}

function truncatePdfText(doc, text, maxWidth) {
  const normalizedText = normalizeText(text, '')
  if (!normalizedText) return ''
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return normalizedText

  if (doc.getTextWidth(normalizedText) <= maxWidth) return normalizedText

  const ellipsis = '\u2026'
  const ellipsisWidth = doc.getTextWidth(ellipsis)
  if (ellipsisWidth >= maxWidth) return ellipsis

  let truncated = normalizedText
  while (truncated.length > 0 && doc.getTextWidth(truncated) + ellipsisWidth > maxWidth) {
    truncated = truncated.slice(0, -1)
  }

  return `${truncated}${ellipsis}`
}

export function renderPaymentReceiptShell(
  doc,
  {
    companyName = 'BANPLEX GREENFIELD',
    documentTitle = '',
    secondaryText = null,
    referenceLabel = 'DIBAYARKAN KEPADA',
    referenceValue = '-',
  } = {}
) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10

  doc.setFillColor(...SYS_COLORS.primaryContainer)
  doc.rect(0, 0, pageWidth, 1.5, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(80)
  doc.setTextColor(...SYS_COLORS.watermark)
  doc.text('BG', pageWidth - 10, pageHeight / 2 - 10, { angle: -15, align: 'right' })

  doc.setFontSize(12)
  doc.setTextColor(...SYS_COLORS.primaryContainer)
  doc.text(truncatePdfText(doc, companyName, pageWidth - margin * 2), margin, 14)

  doc.setFontSize(6.5)
  doc.setTextColor(...SYS_COLORS.mutedText)
  doc.text(truncatePdfText(doc, documentTitle, pageWidth - margin * 2), margin, 18)

  if (secondaryText) {
    doc.setFontSize(6)
    doc.text(truncatePdfText(doc, secondaryText, pageWidth - margin * 2), margin, 22)
  }

  doc.setFontSize(6)
  doc.text(referenceLabel, pageWidth - margin, 13, { align: 'right' })
  doc.setFontSize(8)
  doc.setTextColor(...SYS_COLORS.onSurface)
  doc.text(truncatePdfText(doc, referenceValue, 42), pageWidth - margin, 17, {
    align: 'right',
  })
}

export function addPaymentReceiptFooter(doc, companyName, generatedAt) {
  const pageCount = doc.internal.getNumberOfPages()
  const dateStr = formatReceiptDateTime(generatedAt)
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 10

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(231, 232, 233)
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(5.5)
    doc.setTextColor(...SYS_COLORS.mutedText)

    const footerText = `${String(companyName ?? '').toUpperCase()} \u2022 ${dateStr}`
    const pageText = `HALAMAN ${page} / ${pageCount}`
    const reservedRightWidth = 26
    const footerMaxWidth = Math.max(pageWidth - margin * 2 - reservedRightWidth, 10)
    const safeFooterText = truncatePdfText(doc, footerText, footerMaxWidth)

    doc.text(safeFooterText, margin, pageHeight - 6)
    doc.text(pageText, pageWidth - margin, pageHeight - 6, {
      align: 'right',
    })
  }
}

function buildPaymentReceiptFileName(paymentType, payment = {}, parentRecord = {}, generatedAt = new Date()) {
  const typeStr = paymentType === 'bill' ? 'tagihan' : 'pinjaman'
  const refId = resolvePaymentReceiptParentReferenceId(parentRecord)
  const paymentId = resolvePaymentReceiptPaymentId(payment)
  const dateStr = formatReceiptDateKey(generatedAt)

  return `kwitansi-${typeStr}-${refId}-${paymentId}-${dateStr}.pdf`
}

export function createPaymentReceiptPdf({
  paymentType = 'bill',
  payment = {},
  parentRecord = {},
  generatedAt = new Date(),
} = {}) {
  const normalizedPaymentType = paymentType === 'loan' ? 'loan' : 'bill'
  const companyName = 'BANPLEX GREENFIELD'
  const receiptTitle = resolvePaymentReceiptTitle(normalizedPaymentType)
  const referenceName = resolvePaymentReceiptReferenceName(
    normalizedPaymentType,
    payment,
    parentRecord
  )
  const fileName = buildPaymentReceiptFileName(
    normalizedPaymentType,
    payment,
    parentRecord,
    generatedAt
  )
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a6',
  })
  const margin = 10
  const footerReservedSpace = 14
  let startY = margin

  doc.setProperties({
    title: receiptTitle,
    subject: receiptTitle,
    author: companyName,
  })

  renderPaymentReceiptShell(doc, {
    companyName,
    documentTitle: receiptTitle,
    referenceLabel: 'DIBAYARKAN KEPADA',
    referenceValue: referenceName,
  })

  startY += 16

  doc.setFontSize(8)
  doc.setTextColor(...SYS_COLORS.primaryContainer)
  doc.text('DETAIL PEMBAYARAN', margin, startY)
  startY += 3

  autoTable(doc, {
    startY,
    body: resolvePaymentReceiptSummaryRows(normalizedPaymentType, payment, parentRecord, generatedAt),
    theme: 'plain',
    styles: {
      cellPadding: { top: 1.5, bottom: 1.5, left: 0, right: 0 },
      font: 'helvetica',
    },
    columnStyles: {
      0: {
        fontStyle: 'bold',
        fontSize: 6.5,
        textColor: SYS_COLORS.mutedText,
        cellWidth: 35,
      },
      1: {
        fontStyle: 'bold',
        fontSize: 8,
        textColor: SYS_COLORS.onSurface,
      },
    },
    margin: { left: margin, right: margin, bottom: footerReservedSpace },
    didParseCell: (data) => {
      if (data.row.index === 3 && data.column.index === 1) {
        data.cell.styles.textColor = SYS_COLORS.primaryContainer
        data.cell.styles.fontSize = 10
      }
    },
    didDrawCell: (data) => {
      if (data.row.index === 3 && data.column.index === 1) {
        const tw = doc.getTextWidth(data.cell.text[0])
        doc.setDrawColor(...SYS_COLORS.primaryContainer)
        doc.setLineWidth(0.2)
        doc.setFillColor(245, 250, 248)
        doc.roundedRect(data.cell.x + tw + 3, data.cell.y + 1, 14, 3.5, 1, 1, 'FD')
        doc.setFontSize(5)
        doc.setTextColor(...SYS_COLORS.primaryContainer)
        doc.text('LUNAS', data.cell.x + tw + 5.5, data.cell.y + 3.5)
      }
    },
    didDrawPage: (data) => {
      startY = data.cursor.y
    },
  })

  startY += 8

  doc.setFontSize(8)
  doc.setTextColor(...SYS_COLORS.primaryContainer)
  doc.text('REFERENSI INDUK', margin, startY)
  startY += 3

  const parentStatusText = resolvePaymentReceiptStatus(parentRecord, payment)

  autoTable(doc, {
    startY,
    body: resolvePaymentReceiptContextRows(normalizedPaymentType, payment, parentRecord),
    theme: 'plain',
    styles: {
      cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
      font: 'helvetica',
      fillColor: SYS_COLORS.surfaceLow,
    },
    columnStyles: {
      0: {
        fontStyle: 'bold',
        fontSize: 6.5,
        textColor: SYS_COLORS.mutedText,
        cellWidth: 35,
      },
      1: {
        fontStyle: 'bold',
        fontSize: 8,
        textColor: SYS_COLORS.onSurface,
      },
    },
    margin: { left: margin, right: margin, bottom: footerReservedSpace },
    didParseCell: (data) => {
      if (data.row.index === 0) {
        data.cell.styles.cellPadding.top = 4
      }
      if (data.row.index === 3) {
        data.cell.styles.cellPadding.bottom = 4
      }
      if (data.row.index === 3 && data.column.index === 1) {
        data.cell.text = []
      }
    },
    didDrawCell: (data) => {
      if (data.row.index === 3 && data.column.index === 1) {
        const safeStatusText = truncatePdfText(doc, parentStatusText, data.cell.width - 12)
        const tw = doc.getTextWidth(safeStatusText)
        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.2)
        doc.roundedRect(data.cell.x + 3, data.cell.y + 1, tw + 6, 4.5, 0.5, 0.5, 'FD')
        doc.setFontSize(7.5)
        doc.setTextColor(...SYS_COLORS.onSurface)
        doc.text(safeStatusText, data.cell.x + 6, data.cell.y + 4.2)
      }
    },
    didDrawPage: (data) => {
      startY = data.cursor.y
    },
  })

  addPaymentReceiptFooter(doc, 'LEDGER BANPLEX', generatedAt)

  return {
    doc,
    fileName,
  }
}

export function savePaymentReceiptPdf(payload = {}) {
  const { doc, fileName } = createPaymentReceiptPdf(payload)

  doc.save(fileName)

  return fileName
}

function normalizeBusinessPdfSettings(pdfSettings = {}) {
  return {
    companyName: normalizeText(
      pdfSettings?.companyName ?? pdfSettings?.company_name,
      'BANPLEX GREENFIELD'
    ),
    address: normalizeText(pdfSettings?.address, ''),
    phone: normalizeText(pdfSettings?.phone, ''),
    headerColor: parseHexColor(pdfSettings?.headerColor ?? pdfSettings?.header_color),
    headerLogo: pdfSettings?.header_logo_file_asset ?? null,
    footerLogo: pdfSettings?.footer_logo_file_asset ?? null,
  }
}

function normalizeBusinessReportKind(value) {
  const normalizedValue = normalizeText(value, 'executive_finance')

  return ['executive_finance', 'project_pl', 'cash_flow', 'party_statement'].includes(normalizedValue)
    ? normalizedValue
    : 'executive_finance'
}

function getBusinessReportTheme(reportKind) {
  const normalizedKind = normalizeBusinessReportKind(reportKind)

  return BUSINESS_REPORT_THEMES[normalizedKind] ?? BUSINESS_REPORT_THEMES.executive_finance
}

function getBusinessReportKindLabel(reportKind) {
  return getBusinessReportTheme(reportKind).kindLabel
}

function humanizeBusinessLabel(value, fallback = '-') {
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

function formatBusinessReportPeriod(dateFrom = null, dateTo = null) {
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

function isMaterialProjectExpense(expense = {}) {
  const expenseType = normalizeText(expense?.expense_type, '').toLowerCase()
  const documentType = normalizeText(expense?.document_type, '').toLowerCase()

  return (
    expenseType === 'material' ||
    expenseType === 'material_invoice' ||
    documentType === 'material_invoice'
  )
}

function isOperationalProjectExpense(expense = {}) {
  if (isMaterialProjectExpense(expense)) {
    return false
  }

  const expenseType = normalizeText(expense?.expense_type, '').toLowerCase()

  return (
    expenseType === 'operasional' ||
    expenseType === 'operational' ||
    expenseType === 'lainnya' ||
    expenseType === 'other'
  )
}

function getProjectExpenseCategoryLabel(expense = {}) {
  if (isMaterialProjectExpense(expense)) {
    return 'Material'
  }

  const expenseType = normalizeText(expense?.expense_type, '').toLowerCase()

  if (expenseType === 'operasional' || expenseType === 'operational') {
    return 'Operasional'
  }

  if (expenseType === 'lainnya' || expenseType === 'other') {
    return 'Lainnya'
  }

  return normalizeText(expense?.expense_type, 'Operasional')
}

function getProjectDocumentLabel(value) {
  const normalizedValue = normalizeText(value, '').toLowerCase()

  if (!normalizedValue) {
    return '-'
  }

  if (normalizedValue === 'material_invoice') {
    return 'Faktur Material'
  }

  if (normalizedValue === 'surat_jalan') {
    return 'Surat Jalan'
  }

  if (normalizedValue === 'faktur') {
    return 'Faktur'
  }

  return humanizeBusinessLabel(normalizedValue)
}

function getPartyStatementFileNamePrefix(partyType) {
  if (partyType === 'creditor') {
    return 'piutang-kreditur'
  }

  if (partyType === 'supplier') {
    return 'hutang-supplier'
  }

  if (partyType === 'worker') {
    return 'gaji-pekerja'
  }

  return 'statement-pihak'
}

function buildPartyStatementRowsBody(rows = []) {
  return rows.map((row) => [
    formatPdfDateTime(row?.transactionDate),
    getPartyStatementSourceLabel(row?.sourceType),
    normalizeText(row?.description, '-'),
    row?.entryType === 'debit' ? formatCurrency(row?.amount) : '-',
    row?.entryType === 'credit' ? formatCurrency(row?.amount) : '-',
    formatCurrency(row?.balance),
  ])
}

function buildBusinessReportKpis(reportData = {}) {
  const reportKind = normalizeBusinessReportKind(reportData?.reportKind)
  const summary = reportData?.summary ?? {}

  if (reportKind === 'party_statement') {
    return [
      { label: 'Saldo Awal', value: formatCurrency(summary?.opening_balance) },
      { label: 'Total Debit', value: formatCurrency(summary?.total_debit) },
      { label: 'Total Kredit', value: formatCurrency(summary?.total_credit) },
      { label: 'Saldo Akhir', value: formatCurrency(summary?.closing_balance ?? summary?.outstanding_amount) },
    ]
  }

  if (reportKind === 'project_pl') {
    return [
      { label: 'Pendapatan', value: formatCurrency(summary?.total_income) },
      { label: 'Biaya Material', value: formatCurrency(summary?.material_expense) },
      { label: 'Biaya Gaji', value: formatCurrency(summary?.salary_expense) },
      { label: 'Net Profit', value: formatCurrency(summary?.net_profit ?? summary?.net_profit_project) },
    ]
  }

  if (reportKind === 'cash_flow') {
    return [
      { label: 'Cash In', value: formatCurrency(summary?.total_inflow) },
      { label: 'Cash Out', value: formatCurrency(summary?.total_outflow) },
      { label: 'Net Cash Flow', value: formatCurrency(summary?.total_net_cash_flow) },
      { label: 'Mutasi', value: normalizeText(summary?.total_mutation, '0') },
    ]
  }

  return [
    { label: 'Laba Bersih', value: formatCurrency(summary?.net_consolidated_profit) },
    { label: 'Pendapatan', value: formatCurrency(summary?.total_income) },
    { label: 'Pengeluaran', value: formatCurrency(summary?.total_expense) },
    { label: 'Outstanding', value: formatCurrency(summary?.total_outstanding_bill) },
  ]
}

function buildBusinessProjectSummaryBody(projectSummaries = []) {
  return projectSummaries.map((summary) => [
    normalizeText(summary?.project_name, 'Proyek tanpa nama'),
    normalizeText(summary?.project_status, '-'),
    formatCurrency(summary?.total_income),
    formatCurrency(summary?.material_expense),
    formatCurrency(summary?.operating_expense),
    formatCurrency(summary?.salary_expense),
    formatCurrency(summary?.net_profit_project ?? summary?.net_profit),
  ])
}

function buildBusinessCashMutationBody(cashMutations = []) {
  return cashMutations.map((row) => [
    formatPdfDateTime(row?.transaction_date),
    normalizeText(row?.type, '-').toUpperCase(),
    formatCurrency(row?.amount),
    getBusinessSourceLabel(row?.source_table),
    normalizeText(row?.description, '-'),
  ])
}

function buildBusinessProjectPlSections(projectDetail = null) {
  if (!projectDetail?.summary) {
    return {
      incomes: [],
      materialExpenses: [],
      operatingExpenses: [],
      salaries: [],
    }
  }

  const incomes = (projectDetail.incomes ?? [])
    .map((income) => ({
      date: income?.transaction_date,
      description: normalizeText(income?.description, '-'),
      amount: income?.amount,
    }))
    .sort((left, right) => {
      const leftTime = new Date(String(left?.date ?? '')).getTime()
      const rightTime = new Date(String(right?.date ?? '')).getTime()

      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
    })

  const materialExpenses = (projectDetail.expenses ?? [])
    .filter(isMaterialProjectExpense)
    .map((expense) => ({
      date: expense?.expense_date,
      supplier: normalizeText(expense?.supplier_name_snapshot, 'Supplier'),
      description: normalizeText(expense?.description, '-'),
      documentType: normalizeText(expense?.document_type, '-'),
      amount: expense?.total_amount,
    }))
    .sort((left, right) => {
      const leftTime = new Date(String(left?.date ?? '')).getTime()
      const rightTime = new Date(String(right?.date ?? '')).getTime()

      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
    })

  const operatingExpenses = (projectDetail.expenses ?? [])
    .filter(isOperationalProjectExpense)
    .map((expense) => ({
      date: expense?.expense_date,
      category: getProjectExpenseCategoryLabel(expense),
      description: normalizeText(expense?.description, '-'),
      amount: expense?.total_amount,
    }))
    .sort((left, right) => {
      const leftTime = new Date(String(left?.date ?? '')).getTime()
      const rightTime = new Date(String(right?.date ?? '')).getTime()

      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
    })

  const salaries = (projectDetail.salaries ?? [])
    .map((salary) => ({
      date: salary?.attendance_date,
      worker: normalizeText(
        salary?.workers?.name ?? salary?.worker_name_snapshot ?? salary?.description,
        'Pekerja'
      ),
      notes: normalizeText(salary?.notes ?? salary?.attendance_status ?? '-', '-'),
      amount: salary?.total_pay,
    }))
    .sort((left, right) => {
      const leftTime = new Date(String(left?.date ?? '')).getTime()
      const rightTime = new Date(String(right?.date ?? '')).getTime()

      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
    })

  return {
    incomes,
    materialExpenses,
    operatingExpenses,
    salaries,
  }
}

function formatBusinessSubtotalRow(label, amount, columnCount = 3) {
  const safeAmount = formatCurrency(amount)

  if (columnCount <= 3) {
    return [label, '', safeAmount]
  }

  if (columnCount === 4) {
    return [label, '', '', safeAmount]
  }

  return [label, safeAmount]
}

function normalizeBusinessReportData(reportData = {}) {
  const reportKind = normalizeBusinessReportKind(reportData?.reportKind ?? reportData?.report_kind)
  const generatedAt = reportData?.generatedAt ?? reportData?.generated_at ?? new Date()
  const partyProfile = reportData?.partyProfile ?? reportData?.party_profile ?? null
  const partyType = normalizeText(reportData?.partyType ?? reportData?.party_type, null)
  const partyId = normalizeText(reportData?.partyId ?? reportData?.party_id, null)
  const projectSummaries = Array.isArray(reportData?.projectSummaries)
    ? reportData.projectSummaries
    : []
  const projectDetail = reportData?.projectDetail?.summary ? reportData.projectDetail : null
  const cashMutations = Array.isArray(reportData?.cashMutations) ? reportData.cashMutations : []
  const rows = Array.isArray(reportData?.rows) ? reportData.rows : []
  const billingStats = reportData?.billingStats ?? null
  const defaultTitle = {
    executive_finance: 'LAPORAN KEUANGAN EKSEKUTIF',
    project_pl: 'LAPORAN LABA RUGI PROYEK',
    cash_flow: 'LAPORAN ARUS KAS',
    party_statement:
      partyType === 'supplier'
        ? 'LAPORAN HUTANG SUPPLIER'
        : partyType === 'worker'
          ? 'LAPORAN GAJI PEKERJA'
          : 'LAPORAN PIUTANG KREDITUR',
  }[reportKind] ?? 'LAPORAN BISNIS'
  const title = normalizeText(reportData?.title ?? reportData?.reportTitle ?? defaultTitle, 'LAPORAN BISNIS')

  return {
    reportKind,
    title,
    period: {
      dateFrom: normalizeText(reportData?.period?.dateFrom ?? reportData?.dateFrom, null),
      dateTo: normalizeText(reportData?.period?.dateTo ?? reportData?.dateTo, null),
    },
    generatedAt,
    summary: reportData?.summary ?? {},
    partyProfile,
    partyType,
    partyId,
    projectSummaries,
    projectDetail,
    cashMutations,
    rows,
    billingStats,
  }
}

function ensureBusinessReportSectionSpace(doc, startY, minimumRemaining = 30) {
  const pageHeight = doc.internal.pageSize.getHeight()

  if (startY > pageHeight - minimumRemaining) {
    doc.addPage()
    return 18
  }

  return startY
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onerror = () => reject(new Error('Gagal membaca data logo.'))
    reader.onload = () => {
      resolve(typeof reader.result === 'string' ? reader.result : '')
    }
    reader.readAsDataURL(blob)
  })
}

async function loadImageAsset(imageAsset = null) {
  const publicUrl = normalizeText(imageAsset?.public_url, null)

  if (!publicUrl || typeof fetch !== 'function') {
    return null
  }

  try {
    const response = await fetch(publicUrl)

    if (!response.ok) {
      return null
    }

    const blob = await response.blob()
    const dataUrl = await blobToDataUrl(blob)

    if (!dataUrl) {
      return null
    }

    return {
      dataUrl,
      mimeType: normalizeText(blob?.type, null),
    }
  } catch {
    return null
  }
}

async function measureImageSize(dataUrl) {
  if (typeof Image === 'undefined') {
    return null
  }

  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width || 0,
        height: image.naturalHeight || image.height || 0,
      })
    }
    image.onerror = () => resolve(null)
    image.src = dataUrl
  })
}

function getJsPdfImageFormat(mimeType = '') {
  const normalizedMimeType = String(mimeType ?? '').toLowerCase()

  if (normalizedMimeType.includes('png')) {
    return 'PNG'
  }

  if (normalizedMimeType.includes('webp')) {
    return 'WEBP'
  }

  return 'JPEG'
}

async function addBusinessLogo(doc, imageAsset, x, y, maxWidth, maxHeight) {
  const loadedImage = await loadImageAsset(imageAsset)

  if (!loadedImage?.dataUrl) {
    return null
  }

  const dimensions = await measureImageSize(loadedImage.dataUrl)
  if (!dimensions?.width || !dimensions?.height) {
    return null
  }

  const scale = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height, 1)
  const width = dimensions.width * scale
  const height = dimensions.height * scale
  const imageFormat = getJsPdfImageFormat(loadedImage.mimeType)

  doc.addImage(loadedImage.dataUrl, imageFormat, x, y, width, height)

  return {
    width,
    height,
  }
}

function buildBusinessHeaderLayout({
  doc,
  settings,
  reportData,
  margin,
  pageWidth,
  generatedAt,
  theme = getBusinessReportTheme(reportData?.reportKind),
}) {
  const headerLogo = settings.headerLogo
  const companyName = settings.companyName
  const reportTitle = reportData.title
  const periodLabel = formatBusinessReportPeriod(reportData.period?.dateFrom, reportData.period?.dateTo)
  const generatedLabel = formatPdfDateTime(generatedAt)
  const headerTop = 16
  const logoBox = headerLogo ? 12 : 0
  const titleStartX = headerLogo ? margin + logoBox + 4 : margin

  doc.setFillColor(...settings.headerColor)
  doc.rect(0, 0, pageWidth, 4, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(150)
  doc.setTextColor(...SYS_COLORS.watermark)
  doc.text('BG', pageWidth - 20, 110, { angle: -15, align: 'right' })

  const renderHeaderContent = (logoSize = null) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(...SYS_COLORS.primaryContainer)
    doc.text(companyName, titleStartX, headerTop + 2)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...SYS_COLORS.mutedText)
    doc.text(reportTitle, titleStartX, headerTop + 8)

    if (reportData?.reportKind === 'party_statement' && reportData?.partyProfile?.name) {
      doc.setFontSize(8)
      doc.text(`Pihak: ${normalizeText(reportData.partyProfile.name, '-')}`, titleStartX, headerTop + 13)
    }

    const kindBadgeLabel = getBusinessReportKindLabel(reportData?.reportKind)
    const badgeWidth = Math.max(22, doc.getTextWidth(kindBadgeLabel) + 6)
    doc.setFillColor(...theme.accentSoft)
    doc.setDrawColor(...theme.accentBorder)
    doc.roundedRect(titleStartX, headerTop + 10.2, badgeWidth, 5.2, 2.2, 2.2, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.4)
    doc.setTextColor(...theme.accent)
    doc.text(kindBadgeLabel, titleStartX + 2.8, headerTop + 13.8)

    doc.setFontSize(8)
    doc.setTextColor(...SYS_COLORS.onSurface)
    const rightBlock = [`Periode: ${periodLabel}`, `Dibuat: ${generatedLabel}`]
    doc.text(rightBlock[0], pageWidth - margin, headerTop + 1, { align: 'right' })
    doc.text(rightBlock[1], pageWidth - margin, headerTop + 7, { align: 'right' })

    if (settings.address) {
      const splitAddress = doc.splitTextToSize(settings.address, 65)
      doc.text(splitAddress, pageWidth - margin, headerTop + 14, { align: 'right' })
    }

    if (settings.phone) {
      doc.text(`Telepon: ${settings.phone}`, pageWidth - margin, headerTop + 20, { align: 'right' })
    }

    return (logoSize?.height ?? 14) + (reportData?.reportKind === 'party_statement' ? 16 : 12)
  }

  if (headerLogo) {
    return addBusinessLogo(doc, headerLogo, margin, headerTop - 4, 14, 14).then((logoSize) =>
      renderHeaderContent(logoSize)
    )
  }

  return Promise.resolve(renderHeaderContent())
}

function addBusinessSectionTitle(doc, title, margin, startY, theme = getBusinessReportTheme()) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const bandHeight = 10
  const nextY = ensureBusinessReportSectionSpace(doc, startY, bandHeight + 4)
  const bandWidth = pageWidth - margin * 2
  const bandTop = nextY - 1

  doc.setFillColor(...theme.sectionFill)
  doc.setDrawColor(...theme.sectionBorder)
  doc.roundedRect(margin, bandTop, bandWidth, bandHeight, 2.5, 2.5, 'FD')

  doc.setFillColor(...theme.accent)
  doc.roundedRect(margin + 1.2, bandTop + 1.2, 1.4, bandHeight - 2.4, 0.7, 0.7, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.2)
  doc.setTextColor(...theme.accent)
  doc.text(title, margin + 4.5, bandTop + 6.4)

  return bandTop + bandHeight + 4
}

function renderBusinessMetricCards(doc, cards = [], margin, startY, theme = getBusinessReportTheme(), { columns = 2 } = {}) {
  const normalizedCards = Array.isArray(cards) ? cards.filter(Boolean) : []

  if (normalizedCards.length === 0) {
    return startY
  }

  const pageWidth = doc.internal.pageSize.getWidth()
  const usableWidth = pageWidth - margin * 2
  const gap = 4
  const safeColumns = Math.max(1, columns)
  const cardWidth = (usableWidth - gap * (safeColumns - 1)) / safeColumns
  const cardHeight = 23
  const rowsCount = Math.ceil(normalizedCards.length / safeColumns)
  const requiredHeight = rowsCount * cardHeight + Math.max(0, rowsCount - 1) * gap + 2
  const nextY = ensureBusinessReportSectionSpace(doc, startY, requiredHeight)

  normalizedCards.forEach((card, index) => {
    const rowIndex = Math.floor(index / safeColumns)
    const columnIndex = index % safeColumns
    const x = margin + columnIndex * (cardWidth + gap)
    const y = nextY + rowIndex * (cardHeight + gap)

    doc.setDrawColor(...theme.accentBorder)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD')

    doc.setFillColor(...theme.accentSoft)
    doc.roundedRect(x + 1.5, y + 1.5, cardWidth - 3, 3.3, 1.1, 1.1, 'F')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.3)
    doc.setTextColor(...SYS_COLORS.mutedText)
    doc.text(normalizeText(card.label, '-').toUpperCase(), x + 4, y + 8)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...theme.accent)
    const valueLines = doc.splitTextToSize(normalizeText(card.value, '-'), cardWidth - 8)
    doc.text(valueLines, x + 4, y + 14)

    if (card.caption) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.6)
      doc.setTextColor(...SYS_COLORS.mutedText)
      const captionLines = doc.splitTextToSize(normalizeText(card.caption, ''), cardWidth - 8)
      doc.text(captionLines, x + 4, y + cardHeight - 3.5)
    }
  })

  return nextY + rowsCount * cardHeight + Math.max(0, rowsCount - 1) * gap + 4
}

function addBusinessReportFooter(doc, companyName, generatedAt, footerLogo = null) {
  const pageCount = doc.internal.getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 18
  const footerLabel = `${normalizeText(companyName, 'BANPLEX GREENFIELD').toUpperCase()} \u2022 ${formatPdfDateTime(generatedAt)}`

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(231, 232, 233)
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12)

    if (footerLogo?.dataUrl) {
      const logoHeight = 5
      const logoWidth = 5
      doc.addImage(
        footerLogo.dataUrl,
        getJsPdfImageFormat(footerLogo.mimeType),
        margin,
        pageHeight - 10.5,
        logoWidth,
        logoHeight
      )
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(107, 114, 128)
      doc.text(footerLabel, margin + 7, pageHeight - 7)
    } else {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(6.5)
      doc.setTextColor(107, 114, 128)
      doc.text(footerLabel, margin, pageHeight - 7)
    }

    doc.text(`HALAMAN ${page} / ${pageCount}`, pageWidth - margin, pageHeight - 7, {
      align: 'right',
    })
  }
}

function renderBusinessReportTable({
  doc,
  startY,
  head,
  body,
  margin,
  headStyles = {},
  bodyStyles = {},
  columnStyles = {},
  didParseCell = null,
  didDrawCell = null,
  emptyText = 'Tidak ada data untuk ditampilkan.',
}) {
  if (!body || body.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...SYS_COLORS.mutedText)
    doc.text(emptyText, margin, startY)
    return startY + 10
  }

  autoTable(doc, {
    startY,
    theme: 'grid',
    head,
    body,
    styles: {
      cellPadding: 3.3,
      font: 'helvetica',
      textColor: [31, 41, 55],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [249, 250, 251],
      lineColor: [226, 232, 240],
      textColor: SYS_COLORS.mutedText,
      fontSize: 7,
      fontStyle: 'bold',
      ...headStyles,
    },
    bodyStyles: {
      textColor: SYS_COLORS.onSurface,
      fontSize: 8,
      ...bodyStyles,
    },
    columnStyles,
    alternateRowStyles: {
      fillColor: [252, 252, 253],
    },
    margin: { left: margin, right: margin },
    didParseCell,
    didDrawCell,
  })

  return (doc.lastAutoTable?.finalY ?? startY) + 10
}

export async function generateBusinessReportPdf(reportData = {}, pdfSettings = {}) {
  const normalizedReportData = normalizeBusinessReportData(reportData)
  const normalizedPdfSettings = normalizeBusinessPdfSettings(pdfSettings)
  const theme = buildAccentPdfTheme(
    getBusinessReportTheme(normalizedReportData.reportKind),
    normalizedPdfSettings.headerColor
  )
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })
  const companyName = normalizedPdfSettings.companyName
  const reportTitle = normalizedReportData.title
  const generatedAt = normalizedReportData.generatedAt
  const fileName =
    normalizedReportData.reportKind === 'party_statement'
      ? `laporan-${getPartyStatementFileNamePrefix(normalizedReportData.partyType)}-${slugify(
          normalizedReportData.partyProfile?.name ?? normalizedReportData.partyId ?? 'pihak'
        )}-${toAppDateKey(generatedAt) || 'tanggal'}.pdf`
      : `laporan-${slugify(normalizedReportData.reportKind)}-${slugify(companyName)}-${toAppDateKey(generatedAt) || 'tanggal'}.pdf`
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 18
  const usableWidth = pageWidth - margin * 2
  const projectPlWidths = {
    income: {
      date: 22,
      description: Math.max(72, usableWidth - 22 - 28),
      amount: 28,
    },
    material: {
      date: 22,
      supplier: 34,
      description: Math.max(52, usableWidth - 22 - 34 - 28),
      amount: 28,
    },
    operating: {
      date: 22,
      category: 34,
      description: Math.max(52, usableWidth - 22 - 34 - 28),
      amount: 28,
    },
    salary: {
      date: 22,
      worker: 44,
      notes: Math.max(48, usableWidth - 22 - 44 - 28),
      amount: 28,
    },
    partyStatement: {
      date: 24,
      source: 34,
      description: Math.max(38, usableWidth - 24 - 34 - 25 - 25 - 28),
      debit: 25,
      credit: 25,
      balance: 28,
    },
  }
  const partyStatementWidths = projectPlWidths.partyStatement

  doc.setProperties({
    title: reportTitle,
    subject: reportTitle,
    author: companyName,
  })

  const headerExtraSpace = await buildBusinessHeaderLayout({
    doc,
    settings: normalizedPdfSettings,
    reportData: normalizedReportData,
    margin,
    pageWidth,
    generatedAt,
    theme,
  })

  let startY = margin + headerExtraSpace

  startY = renderBusinessMetricCards(doc, buildBusinessReportKpis(normalizedReportData), margin, startY, theme)

  if (normalizedReportData.reportKind === 'executive_finance') {
    startY = addBusinessSectionTitle(doc, 'RINGKASAN PROYEK', margin, startY, theme)
    startY = renderBusinessReportTable({
      doc,
      startY,
      head: [['NAMA PROYEK', 'STATUS', 'PENDAPATAN', 'BIAYA MATERIAL', 'BIAYA OPS', 'BIAYA GAJI', 'NET PROFIT']],
      body: buildBusinessProjectSummaryBody(normalizedReportData.projectSummaries),
      margin,
      headStyles: {
        fillColor: theme.accentSoft,
        textColor: theme.accent,
        lineColor: theme.accentBorder,
        fontSize: 7.2,
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      columnStyles: {
        0: { cellWidth: 42 },
        1: { cellWidth: 22 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right', textColor: theme.accent, fontStyle: 'bold' },
      },
      emptyText: 'Tidak ada data proyek di periode ini.',
    })

    startY = addBusinessSectionTitle(doc, 'RINGKASAN TAGIHAN', margin, startY, theme)
    startY = renderBusinessMetricCards(
      doc,
      [
        {
          label: 'Total Tagihan',
          value: normalizeText(normalizedReportData.summary?.total_bill_count, '0'),
          caption: 'Seluruh bill aktif pada periode ini',
        },
        {
          label: 'Total Paid',
          value: formatCurrency(normalizedReportData.summary?.total_paid_bill),
          caption: 'Tagihan yang sudah diselesaikan',
        },
        {
          label: 'Tagihan Aktif',
          value: formatCurrency(normalizedReportData.summary?.total_outstanding_bill),
          caption: 'Sisa tagihan yang belum lunas',
        },
        {
          label: 'Upah Outstanding',
          value: formatCurrency(normalizedReportData.summary?.total_outstanding_salary),
          caption: 'Payroll yang masih menunggu pembayaran',
        },
      ],
      margin,
      startY,
      theme
    )

    startY = addBusinessSectionTitle(doc, 'ARUS KAS', margin, startY, theme)
    startY = renderBusinessReportTable({
      doc,
      startY,
      head: [['TANGGAL', 'TIPE', 'NOMINAL', 'SUMBER', 'KETERANGAN']],
      body: buildBusinessCashMutationBody(normalizedReportData.cashMutations),
      margin,
      headStyles: {
        fillColor: theme.accentSoft,
        textColor: theme.accent,
        lineColor: theme.accentBorder,
        fontSize: 7.2,
      },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 20 },
        2: { halign: 'right', textColor: theme.accent, fontStyle: 'bold', cellWidth: 28 },
        3: { cellWidth: 38 },
      },
      emptyText: 'Tidak ada mutasi kas di periode ini.',
    })
  } else if (normalizedReportData.reportKind === 'cash_flow') {
    startY = addBusinessSectionTitle(doc, 'ARUS KAS DETAIL', margin, startY, theme)
    startY = renderBusinessReportTable({
      doc,
      startY,
      head: [['TANGGAL', 'TIPE', 'NOMINAL', 'SUMBER', 'KETERANGAN']],
      body: buildBusinessCashMutationBody(normalizedReportData.cashMutations),
      margin,
      headStyles: {
        fillColor: theme.accentSoft,
        textColor: theme.accent,
        lineColor: theme.accentBorder,
        fontSize: 7.2,
      },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 20 },
        2: { halign: 'right', textColor: theme.accent, fontStyle: 'bold', cellWidth: 28 },
        3: { cellWidth: 38 },
      },
      emptyText: 'Tidak ada mutasi kas di periode ini.',
    })
  } else if (normalizedReportData.reportKind === 'party_statement') {
    startY = addBusinessSectionTitle(doc, 'RINGKASAN PIUTANG', margin, startY, theme)
    startY = renderBusinessMetricCards(
      doc,
      buildBusinessReportKpis(normalizedReportData),
      margin,
      startY,
      theme
    )

    startY = addBusinessSectionTitle(doc, 'RINCIAN TRANSAKSI', margin, startY, theme)
    startY = renderBusinessReportTable({
      doc,
      startY,
      head: [['TANGGAL', 'SUMBER', 'KETERANGAN', 'DEBIT', 'KREDIT', 'SALDO']],
      body: buildPartyStatementRowsBody(normalizedReportData.rows),
      margin,
      headStyles: {
        fillColor: theme.accentSoft,
        textColor: theme.accent,
        lineColor: theme.accentBorder,
        fontSize: 7.2,
      },
      columnStyles: {
        0: { cellWidth: partyStatementWidths.date },
        1: { cellWidth: partyStatementWidths.source },
        2: { cellWidth: partyStatementWidths.description },
        3: { halign: 'right', textColor: theme.accent, fontStyle: 'bold', cellWidth: partyStatementWidths.debit },
        4: { halign: 'right', textColor: theme.accent, fontStyle: 'bold', cellWidth: partyStatementWidths.credit },
        5: { halign: 'right', textColor: theme.accent, fontStyle: 'bold', cellWidth: partyStatementWidths.balance },
      },
      emptyText: 'Tidak ada transaksi kreditur pada periode ini.',
    })
  } else if (normalizedReportData.reportKind === 'project_pl') {
    const projectSections = buildBusinessProjectPlSections(normalizedReportData.projectDetail)

    if (!normalizedReportData.projectDetail?.summary) {
      startY = addBusinessSectionTitle(doc, 'RINCIAN TRANSAKSI PROYEK', margin, startY, theme)
      renderBusinessReportTable({
        doc,
        startY,
        head: [['TANGGAL', 'KATEGORI', 'DESKRIPSI', 'PEMASUKAN', 'PENGELUARAN']],
        body: [],
        margin,
        emptyText: 'Tidak ada rincian transaksi untuk laporan ini.',
      })
    } else {
      startY = addBusinessSectionTitle(doc, 'PENDAPATAN', margin, startY, theme)
      const incomeRows = projectSections.incomes.map((income) => [
        formatPdfDateTime(income?.date),
        normalizeText(income?.description, '-'),
        formatCurrency(income?.amount),
      ])
      const incomeBody = [
        ...incomeRows,
        formatBusinessSubtotalRow('Subtotal Pendapatan', projectSections.incomes.reduce((sum, item) => sum + toNumber(item?.amount), 0)),
      ]
      startY = renderBusinessReportTable({
        doc,
        startY,
        head: [['TANGGAL', 'DESKRIPSI', 'NOMINAL']],
        body: incomeBody,
        margin,
        headStyles: {
          fillColor: theme.accentSoft,
          textColor: theme.accent,
          lineColor: theme.accentBorder,
          fontSize: 7.2,
        },
        columnStyles: {
          0: { cellWidth: projectPlWidths.income.date },
          1: { cellWidth: projectPlWidths.income.description },
          2: { halign: 'right', textColor: theme.accent, fontStyle: 'bold', cellWidth: projectPlWidths.income.amount },
        },
        didParseCell: (data) => {
          if (data.row.index === incomeBody.length - 1) {
            data.cell.styles.fillColor = theme.accentSoft
            data.cell.styles.textColor = theme.accent
            data.cell.styles.fontStyle = 'bold'
          }
        },
        emptyText: 'Tidak ada pemasukan pada periode ini.',
      })

      startY = addBusinessSectionTitle(doc, 'BIAYA MATERIAL', margin, startY, theme)
      const materialRows = projectSections.materialExpenses.map((expense) => [
        formatPdfDateTime(expense?.date),
        normalizeText(expense?.supplier, '-'),
        `${getProjectDocumentLabel(expense?.documentType)} • ${normalizeText(expense?.description, '-')}`,
        formatCurrency(expense?.amount),
      ])
      const materialBody = [
        ...materialRows,
        formatBusinessSubtotalRow(
          'Subtotal Biaya Material',
          projectSections.materialExpenses.reduce((sum, item) => sum + toNumber(item?.amount), 0),
          4
        ),
      ]
      startY = renderBusinessReportTable({
        doc,
        startY,
        head: [['TANGGAL', 'SUPPLIER', 'DESKRIPSI', 'NOMINAL']],
        body: materialBody,
        margin,
        headStyles: {
          fillColor: theme.accentSoft,
          textColor: theme.accent,
          lineColor: theme.accentBorder,
          fontSize: 7.2,
        },
        columnStyles: {
          0: { cellWidth: projectPlWidths.material.date },
          1: { cellWidth: projectPlWidths.material.supplier },
          2: { cellWidth: projectPlWidths.material.description },
          3: { halign: 'right', textColor: theme.accent, fontStyle: 'bold', cellWidth: projectPlWidths.material.amount },
        },
        didParseCell: (data) => {
          if (data.row.index === materialBody.length - 1) {
            data.cell.styles.fillColor = theme.accentSoft
            data.cell.styles.textColor = theme.accent
            data.cell.styles.fontStyle = 'bold'
          }
        },
        emptyText: 'Tidak ada biaya material pada periode ini.',
      })

      startY = addBusinessSectionTitle(doc, 'BIAYA OPERASIONAL', margin, startY, theme)
      const operatingRows = projectSections.operatingExpenses.map((expense) => [
        formatPdfDateTime(expense?.date),
        normalizeText(expense?.category, '-'),
        normalizeText(expense?.description, '-'),
        formatCurrency(expense?.amount),
      ])
      const operatingBody = [
        ...operatingRows,
        formatBusinessSubtotalRow(
          'Subtotal Biaya Operasional',
          projectSections.operatingExpenses.reduce((sum, item) => sum + toNumber(item?.amount), 0),
          4
        ),
      ]
      startY = renderBusinessReportTable({
        doc,
        startY,
        head: [['TANGGAL', 'KATEGORI', 'DESKRIPSI', 'NOMINAL']],
        body: operatingBody,
        margin,
        headStyles: {
          fillColor: theme.accentSoft,
          textColor: theme.accent,
          lineColor: theme.accentBorder,
          fontSize: 7.2,
        },
        columnStyles: {
          0: { cellWidth: projectPlWidths.operating.date },
          1: { cellWidth: projectPlWidths.operating.category },
          2: { cellWidth: projectPlWidths.operating.description },
          3: { halign: 'right', textColor: theme.accent, fontStyle: 'bold', cellWidth: projectPlWidths.operating.amount },
        },
        didParseCell: (data) => {
          if (data.row.index === operatingBody.length - 1) {
            data.cell.styles.fillColor = theme.accentSoft
            data.cell.styles.textColor = theme.accent
            data.cell.styles.fontStyle = 'bold'
          }
        },
        emptyText: 'Tidak ada biaya operasional pada periode ini.',
      })

      startY = addBusinessSectionTitle(doc, 'BIAYA GAJI', margin, startY, theme)
      const salaryRows = projectSections.salaries.map((salary) => [
        formatPdfDateTime(salary?.date),
        normalizeText(salary?.worker, '-'),
        `${normalizeText(salary?.notes, '-')}`,
        formatCurrency(salary?.amount),
      ])
      const salaryBody = [
        ...salaryRows,
        formatBusinessSubtotalRow(
          'Subtotal Biaya Gaji',
          projectSections.salaries.reduce((sum, item) => sum + toNumber(item?.amount), 0),
          4
        ),
      ]
      renderBusinessReportTable({
        doc,
        startY,
        head: [['TANGGAL', 'PEKERJA', 'KETERANGAN', 'NOMINAL']],
        body: salaryBody,
        margin,
        headStyles: {
          fillColor: theme.accentSoft,
          textColor: theme.accent,
          lineColor: theme.accentBorder,
          fontSize: 7.2,
        },
        columnStyles: {
          0: { cellWidth: projectPlWidths.salary.date },
          1: { cellWidth: projectPlWidths.salary.worker },
          2: { cellWidth: projectPlWidths.salary.notes },
          3: { halign: 'right', textColor: theme.accent, fontStyle: 'bold', cellWidth: projectPlWidths.salary.amount },
        },
        didParseCell: (data) => {
          if (data.row.index === salaryBody.length - 1) {
            data.cell.styles.fillColor = theme.accentSoft
            data.cell.styles.textColor = theme.accent
            data.cell.styles.fontStyle = 'bold'
          }
        },
        emptyText: 'Tidak ada biaya gaji pada periode ini.',
      })
    }
  }

  const footerLogo = normalizedPdfSettings.footerLogo
  const footerAsset = footerLogo?.dataUrl
    ? footerLogo
    : footerLogo?.public_url
      ? await loadImageAsset(footerLogo)
      : null

  addBusinessReportFooter(doc, companyName, generatedAt, footerAsset)

  return {
    doc,
    fileName,
  }
}

export async function createBusinessReportPdf(payload = {}) {
  return generateBusinessReportPdf(payload?.reportData ?? payload, payload?.pdfSettings ?? payload)
}

export async function saveBusinessReportPdf(payload = {}) {
  const { doc, fileName } = await createBusinessReportPdf(payload)

  doc.save(fileName)

  return fileName
}


