import { jsPDF } from 'jspdf'
import { APP_TIME_ZONE } from '../src/lib/date-time.js'
import {
  addPaymentReceiptFooter,
  createPaymentReceiptPdf,
  renderPaymentReceiptShell,
} from '../src/lib/report-pdf.js'
import { buildTelegramAssistantLink } from '../src/lib/telegram-assistant-links.js'

function normalizeText(value, fallback = '-') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function formatDate(value) {
  const normalizedValue = String(value ?? '').trim()
  const hasTimeComponent = /\dT\d|\d:\d/.test(normalizedValue)
  const dateTimeOptions = {
    dateStyle: 'medium',
    timeZone: APP_TIME_ZONE,
  }

  if (!normalizedValue) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: APP_TIME_ZONE,
    }).format(new Date())
  }

  const parsedDate = new Date(normalizedValue)

  if (hasTimeComponent && !Number.isNaN(parsedDate.getTime())) {
    return new Intl.DateTimeFormat('id-ID', {
      ...dateTimeOptions,
      timeStyle: 'short',
    }).format(parsedDate)
  }

  const parsedDateOnly = new Date(`${normalizedValue}T12:00:00Z`)

  if (!Number.isNaN(parsedDateOnly.getTime())) {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: APP_TIME_ZONE,
    }).format(parsedDateOnly)
  }

  return normalizedValue
}

function formatCurrency(value) {
  const amount = Number(value)

  if (!Number.isFinite(amount)) {
    return 'Rp 0'
  }

  return `Rp ${new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(amount)}`
}

const RECEIPT_ACCENT = [6, 95, 70]
const RECEIPT_ACCENT_SOFT = [245, 250, 248]
const RECEIPT_BORDER = [226, 232, 240]

function getTypeLabel(type) {
  return type === 'expense' ? 'Pengeluaran' : 'Pemasukan'
}

function getDocumentFileName(prefix, identifier) {
  const safeIdentifier = normalizeText(identifier, 'dokumen')
    .replace(/[^a-z0-9_-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return `${prefix}-${safeIdentifier || 'dokumen'}.pdf`
}

function getTelegramBotUsername() {
  return normalizeText(
    globalThis.process?.env?.TELEGRAM_BOT_USERNAME ??
      globalThis.process?.env?.VITE_TELEGRAM_BOT_USERNAME ??
      '',
    ''
  )
}

function buildTelegramReviewButton(telegramBotUsername, label, path) {
  const normalizedLabel = normalizeText(label, '')
  const link = buildTelegramAssistantLink(telegramBotUsername, path)

  if (!normalizedLabel || !link) {
    return null
  }

  return {
    text: normalizedLabel,
    url: link,
  }
}

function buildNotificationReplyMarkup(
  telegramBotUsername,
  notificationType,
  payload
) {
  const buildButton = (label, path) =>
    buildTelegramReviewButton(telegramBotUsername, label, path)

  const buttons = (() => {
    switch (notificationType) {
      case 'transaction':
        return [
          buildButton(
            'Review transaksi',
            payload.transactionId ? `/transactions/${payload.transactionId}` : '/transactions'
          ),
        ]
      case 'material_invoice':
        return [
          buildButton(
            'Review faktur',
            payload.expenseId ? `/transactions/${payload.expenseId}` : '/transactions'
          ),
        ]
      case 'bill_payment':
        return [
          buildButton(
            'Review pembayaran',
            payload.billId
              ? `/transactions/${payload.billId}?surface=riwayat`
              : '/transactions?tab=history'
          ),
        ]
      case 'project_income':
        return [
          buildButton(
            'Review termin',
            payload.transactionId ? `/transactions/${payload.transactionId}` : '/transactions'
          ),
        ]
      case 'loan':
        return [
          buildButton(
            'Review pinjaman',
            payload.transactionId ? `/transactions/${payload.transactionId}` : '/transactions'
          ),
        ]
      case 'loan_payment':
        return [
          buildButton(
            'Review pinjaman',
            payload.loanId
              ? `/transactions/${payload.loanId}?surface=riwayat`
              : '/transactions?tab=history'
          ),
        ]
      case 'salary_bill':
        return [
          buildButton(
            'Review tagihan',
            payload.billId ? `/transactions/${payload.billId}` : '/transactions'
          ),
        ]
      case 'attendance':
        return [
          buildButton('Review absensi', payload.routePath || '/payroll?tab=daily'),
        ]
      case 'recap':
        return [
          buildButton('Review recap', payload.routePath || '/transactions?tab=history'),
        ]
      default:
        return []
    }
  })().filter(Boolean)

  const uniqueButtons = []

  for (const button of buttons) {
    if (
      uniqueButtons.some(
        (existingButton) =>
          existingButton.text === button.text || existingButton.url === button.url
      )
    ) {
      continue
    }

    uniqueButtons.push(button)
  }

  if (uniqueButtons.length === 0) {
    return null
  }

  return {
    inline_keyboard: [uniqueButtons],
  }
}

function createTelegramError(message, status = null, data = null) {
  const error = new Error(message)

  error.telegramStatus = status
  error.telegramResponse = data

  return error
}

async function parseRequestBody(req) {
  if (typeof req.body === 'string' && req.body.trim().length > 0) {
    return JSON.parse(req.body)
  }

  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  const chunks = []

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString())
  }

  const rawBody = chunks.join('').trim()

  return rawBody ? JSON.parse(rawBody) : {}
}

async function postTelegram(url, body) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, 5000)

  try {
    const headers = {
      Accept: 'application/json',
      'User-Agent': 'Vercel-Serverless-Function',
    }

    if (typeof body === 'string') {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(url, {
      method: 'POST',
      body,
      signal: controller.signal,
      headers,
    })
    const rawBody = (await response.text()).trim()

    try {
      return {
        status: response.status,
        data: rawBody ? JSON.parse(rawBody) : {},
      }
    } catch (error) {
      throw createTelegramError(
        error instanceof Error
          ? `Gagal parse respons Telegram: ${error.message}`
          : 'Gagal parse respons Telegram.',
        response.status,
        rawBody
      )
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createTelegramError('Request ke Telegram timeout setelah 5 detik.')
    }

    throw error instanceof Error
      ? error
      : createTelegramError('Terjadi kesalahan saat menghubungi Telegram API.')
  } finally {
    clearTimeout(timeoutId)
  }
}

function assertTelegramSuccess(response, fallbackMessage) {
  if (
    response.status >= 200 &&
    response.status < 300 &&
    response.data?.ok
  ) {
    return
  }

  throw createTelegramError(
    response.data?.description || fallbackMessage,
    response.status,
    response.data
  )
}

function ensurePdfSpace(doc, y, requiredHeight, marginBottom = 16) {
  const pageHeight = doc.internal.pageSize.getHeight()

  if (y + requiredHeight <= pageHeight - marginBottom) {
    return y
  }

  doc.addPage()

  return 16
}

function renderPdfField(doc, label, value, y, valueX, maxWidth) {
  const wrappedValue = doc.splitTextToSize(normalizeText(value), maxWidth)

  doc.setFont('helvetica', 'bold')
  doc.text(`${label}:`, 12, y)
  doc.setFont('helvetica', 'normal')
  doc.text(wrappedValue, valueX, y)

  return y + Math.max(7, wrappedValue.length * 5.2)
}

function generateTransactionPdf(payload) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const valueX = 42
  const valueWidth = pageWidth - valueX - 12
  let y = 48

  renderPaymentReceiptShell(doc, {
    documentTitle: 'KWITANSI DIGITAL',
    secondaryText: 'Ringkasan transaksi',
    referenceLabel: 'DICATAT OLEH',
    referenceValue: payload.userName,
  })

  doc.setTextColor(...RECEIPT_ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Detail Transaksi', 12, y)
  y += 8

  doc.setDrawColor(...RECEIPT_BORDER)
  doc.line(12, y - 3, pageWidth - 12, y - 3)
  doc.setFontSize(10)

  y = renderPdfField(doc, 'ID', payload.transactionId, y, valueX, valueWidth)
  y = renderPdfField(
    doc,
    'Tanggal',
    formatDate(payload.transactionDate),
    y,
    valueX,
    valueWidth
  )
  y = renderPdfField(doc, 'Nama User', payload.userName, y, valueX, valueWidth)
  y = renderPdfField(
    doc,
    'Tipe',
    getTypeLabel(payload.type),
    y,
    valueX,
    valueWidth
  )
  y = renderPdfField(doc, 'Kategori', payload.category, y, valueX, valueWidth)
  y = renderPdfField(
    doc,
    'Deskripsi',
    payload.description,
    y,
    valueX,
    valueWidth
  )

  y += 3
  y = ensurePdfSpace(doc, y, 28)
  doc.setFillColor(...RECEIPT_ACCENT_SOFT)
  doc.setDrawColor(...RECEIPT_ACCENT)
  doc.roundedRect(12, y, pageWidth - 24, 20, 4, 4, 'F')
  doc.setTextColor(...RECEIPT_ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Nominal', 16, y + 7)
  doc.setFontSize(18)
  doc.text(formatCurrency(payload.amount), 16, y + 15)

  y += 32
  y = ensurePdfSpace(doc, y, 20)
  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  const footerLines = doc.splitTextToSize(
    'Terima kasih telah mencatat keuangan dengan jujur.',
    pageWidth - 24
  )
  doc.text(footerLines, 12, Math.min(y, pageHeight - 16))
  addPaymentReceiptFooter(doc, 'LEDGER BANPLEX', payload.transactionDate ?? new Date())

  return new Uint8Array(doc.output('arraybuffer'))
}

function drawInvoiceTableHeader(doc, y, columns) {
  let x = 12

  doc.setFillColor(...RECEIPT_ACCENT_SOFT)
  doc.setTextColor(...RECEIPT_ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)

  columns.forEach((column) => {
    doc.setDrawColor(...RECEIPT_BORDER)
    doc.rect(x, y, column.width, 8, 'F')
    doc.text(column.label, x + 2, y + 5)
    x += column.width
  })

  return y + 8
}

function drawInvoiceRow(doc, y, columns, item) {
  const itemLines = doc.splitTextToSize(normalizeText(item.itemName), columns[0].width - 4)
  const rowHeight = Math.max(8, itemLines.length * 4.2 + 4)
  let x = 12

  doc.setDrawColor(...RECEIPT_BORDER)
  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)

  columns.forEach((column) => {
    doc.rect(x, y, column.width, rowHeight)

    if (column.key === 'itemName') {
      doc.text(itemLines, x + 2, y + 4.5)
    } else {
      doc.text(String(item[column.key]), x + column.width - 2, y + 4.5, {
        align: 'right',
      })
    }

    x += column.width
  })

  return y + rowHeight
}

function generateMaterialInvoicePdf(payload) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  })
  const pageWidth = doc.internal.pageSize.getWidth()
  const valueX = 42
  const valueWidth = pageWidth - valueX - 12
  const columns = [
    { key: 'itemName', label: 'Item', width: 50 },
    { key: 'qty', label: 'Qty', width: 15 },
    { key: 'unitPrice', label: 'Harga', width: 24 },
    { key: 'lineTotal', label: 'Total', width: 27 },
  ]
  let y = 48

  renderPaymentReceiptShell(doc, {
    documentTitle: 'FAKTUR MATERIAL',
    secondaryText: 'Relational expense invoice',
    referenceLabel: 'SUPPLIER',
    referenceValue: payload.supplierName,
  })

  doc.setTextColor(...RECEIPT_ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Informasi Faktur', 12, y)
  y += 8

  doc.setDrawColor(...RECEIPT_BORDER)
  doc.line(12, y - 3, pageWidth - 12, y - 3)
  doc.setFontSize(10)

  y = renderPdfField(doc, 'Expense ID', payload.expenseId, y, valueX, valueWidth)
  y = renderPdfField(
    doc,
    'Tanggal',
    formatDate(payload.invoiceDate),
    y,
    valueX,
    valueWidth
  )
  y = renderPdfField(doc, 'Proyek', payload.projectName, y, valueX, valueWidth)
  y = renderPdfField(doc, 'Supplier', payload.supplierName, y, valueX, valueWidth)
  y = renderPdfField(doc, 'Nama User', payload.userName, y, valueX, valueWidth)
  y = renderPdfField(
    doc,
    'Catatan',
    payload.description,
    y,
    valueX,
    valueWidth
  )

  y += 4
  y = ensurePdfSpace(doc, y, 20)
  doc.setTextColor(...RECEIPT_ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Line Items', 12, y)
  y += 6
  y = drawInvoiceTableHeader(doc, y, columns)

  payload.items.forEach((item) => {
    const printableItem = {
      itemName: normalizeText(item.itemName),
      qty: Number(item.qty).toString(),
      unitPrice: formatCurrency(item.unitPrice),
      lineTotal: formatCurrency(item.lineTotal),
    }
    const estimatedHeight = Math.max(
      8,
      doc.splitTextToSize(printableItem.itemName, columns[0].width - 4).length * 4.2 + 4
    )

    if (y + estimatedHeight > doc.internal.pageSize.getHeight() - 24) {
      doc.addPage()
      y = 16
      y = drawInvoiceTableHeader(doc, y, columns)
    }

    y = drawInvoiceRow(doc, y, columns, printableItem)
  })

  y += 6
  y = ensurePdfSpace(doc, y, 30)
  doc.setFillColor(...RECEIPT_ACCENT_SOFT)
  doc.setDrawColor(...RECEIPT_ACCENT)
  doc.roundedRect(12, y, pageWidth - 24, 20, 4, 4, 'F')
  doc.setTextColor(...RECEIPT_ACCENT)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Total Invoice', 16, y + 7)
  doc.setFontSize(18)
  doc.text(formatCurrency(payload.totalAmount), 16, y + 15)

  y += 30
  y = ensurePdfSpace(doc, y, 20)
  doc.setTextColor(71, 85, 105)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(10)
  const footerLines = doc.splitTextToSize(
    'Terima kasih telah mencatat keuangan dengan jujur.',
    pageWidth - 24
  )
  doc.text(footerLines, 12, y)
  addPaymentReceiptFooter(doc, 'LEDGER BANPLEX', payload.invoiceDate ?? new Date())

  return new Uint8Array(doc.output('arraybuffer'))
}

function buildTransactionMessage(payload) {
  return [
    '<b>Transaksi Baru Dicatat</b>',
    `Tipe: ${escapeHtml(getTypeLabel(payload.type))}`,
    `Kategori: <b>${escapeHtml(normalizeText(payload.category))}</b>`,
    `Nominal: <b>${escapeHtml(formatCurrency(payload.amount))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.transactionDate))}</b>`,
  ].join('\n')
}

function buildTransactionCaption(payload) {
  return [
    '<b>Kwitansi Digital Banplex</b>',
    `Tipe: ${escapeHtml(getTypeLabel(payload.type))}`,
    `Kategori: <b>${escapeHtml(normalizeText(payload.category))}</b>`,
    `Nominal: <b>${escapeHtml(formatCurrency(payload.amount))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.transactionDate))}</b>`,
  ].join('\n')
}

function buildMaterialInvoiceMessage(payload) {
  return [
    '<b>Faktur Material Baru Dicatat</b>',
    `Proyek: <b>${escapeHtml(normalizeText(payload.projectName))}</b>`,
    `Supplier: <b>${escapeHtml(normalizeText(payload.supplierName))}</b>`,
    `Jumlah Item: <b>${escapeHtml(String(payload.items.length))}</b>`,
    `Total: <b>${escapeHtml(formatCurrency(payload.totalAmount))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.invoiceDate))}</b>`,
  ].join('\n')
}

function buildMaterialInvoiceCaption(payload) {
  return [
    '<b>Faktur Material Banplex</b>',
    `Proyek: <b>${escapeHtml(normalizeText(payload.projectName))}</b>`,
    `Supplier: <b>${escapeHtml(normalizeText(payload.supplierName))}</b>`,
    `Jumlah Item: <b>${escapeHtml(String(payload.items.length))}</b>`,
    `Total: <b>${escapeHtml(formatCurrency(payload.totalAmount))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.invoiceDate))}</b>`,
  ].join('\n')
}

function buildBillPaymentMessage(payload) {
  return [
    '<b>Pembayaran Tagihan Berhasil Dicatat</b>',
    `Supplier: <b>${escapeHtml(normalizeText(payload.supplierName))}</b>`,
    `Proyek: <b>${escapeHtml(normalizeText(payload.projectName))}</b>`,
    `Nominal Bayar: <b>${escapeHtml(formatCurrency(payload.amount))}</b>`,
    `Sisa Tagihan: <b>${escapeHtml(formatCurrency(payload.remainingAmount))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.paymentDate))}</b>`,
  ].join('\n')
}

function getInterestLabel(value) {
  return value === 'interest' ? 'Berbunga' : 'Tanpa Bunga'
}

function buildProjectIncomeMessage(payload) {
  return [
    `<b>Dana Masuk: Termin Proyek ${escapeHtml(normalizeText(payload.projectName))} sebesar ${escapeHtml(formatCurrency(payload.amount))}</b>`,
    `Oleh: <b>${escapeHtml(normalizeText(payload.userName, 'Pengguna Telegram'))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.transactionDate))}</b>`,
  ].join('\n')
}

function buildLoanMessage(payload) {
  return [
    `<b>Dana Masuk: Pinjaman dari ${escapeHtml(normalizeText(payload.creditorName))} sebesar ${escapeHtml(formatCurrency(payload.principalAmount))}</b>`,
    `Oleh: <b>${escapeHtml(normalizeText(payload.userName, 'Pengguna Telegram'))}</b>`,
    `Total Pengembalian: <b>${escapeHtml(formatCurrency(payload.repaymentAmount))}</b>`,
    `Tipe Bunga: <b>${escapeHtml(getInterestLabel(payload.interestType))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.transactionDate))}</b>`,
  ].join('\n')
}

function buildLoanPaymentMessage(payload) {
  return [
    '<b>Pembayaran Pinjaman Berhasil Dicatat</b>',
    `Kreditur: <b>${escapeHtml(normalizeText(payload.creditorName))}</b>`,
    `Nominal Bayar: <b>${escapeHtml(formatCurrency(payload.amount))}</b>`,
    `Sisa Pinjaman: <b>${escapeHtml(formatCurrency(payload.remainingAmount))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.paymentDate))}</b>`,
  ].join('\n')
}

function buildSalaryBillMessage(payload) {
  return [
    `<b>Tagihan Gaji untuk ${escapeHtml(normalizeText(payload.workerName))} sebesar ${escapeHtml(formatCurrency(payload.amount))} telah dibuat.</b>`,
    `Oleh: <b>${escapeHtml(normalizeText(payload.userName, 'Pengguna Telegram'))}</b>`,
    `Jumlah Absensi: <b>${escapeHtml(String(payload.recordCount ?? 0))}</b>`,
    `Jatuh Tempo: <b>${escapeHtml(formatDate(payload.dueDate))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.transactionDate ?? payload.dueDate))}</b>`,
  ].join('\n')
}

function buildAttendanceMessage(payload) {
  const recordCount = Number(payload.recordCount ?? 0)
  const totalPay = Number(payload.totalPay ?? 0)

  if (Number.isFinite(recordCount) && recordCount > 0) {
    return [
      '<b>Sheet Absensi Baru Dicatat</b>',
      `Oleh: <b>${escapeHtml(normalizeText(payload.userName, 'Pengguna Telegram'))}</b>`,
      `Proyek: <b>${escapeHtml(normalizeText(payload.projectName))}</b>`,
      `Jumlah Record: <b>${escapeHtml(String(recordCount))}</b>`,
      `Total Upah: <b>${escapeHtml(formatCurrency(totalPay))}</b>`,
      `Tanggal: <b>${escapeHtml(formatDate(payload.attendanceDate))}</b>`,
    ].join('\n')
  }

  return [
    '<b>Absensi Baru Dicatat</b>',
    `Pekerja: <b>${escapeHtml(normalizeText(payload.workerName))}</b>`,
    `Proyek: <b>${escapeHtml(normalizeText(payload.projectName))}</b>`,
    `Status: <b>${escapeHtml(normalizeText(payload.status))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.attendanceDate))}</b>`,
  ].join('\n')
}

function buildRecapMessage(payload) {
  return [
    '<b>Rekap Baru Tersedia</b>',
    `Judul: <b>${escapeHtml(normalizeText(payload.title))}</b>`,
    `Periode: <b>${escapeHtml(normalizeText(payload.periodLabel || '-'))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.generatedAt))}</b>`,
    payload.summary ? `Ringkasan: <i>${escapeHtml(normalizeText(payload.summary))}</i>` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

async function sendTelegramTextNotification({
  telegramBotToken,
  telegramChatId,
  message,
  prefixMessage = null,
  replyMarkup = null,
}) {
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`
  const text = prefixMessage
    ? `${escapeHtml(prefixMessage)}\n\n${message}`
    : message
  const payload = {
    chat_id: telegramChatId,
    text,
    parse_mode: 'HTML',
  }

  if (replyMarkup) {
    payload.reply_markup = replyMarkup
  }

  const response = await postTelegram(
    url,
    JSON.stringify(payload)
  )

  assertTelegramSuccess(response, 'Gagal mengirim notifikasi teks Telegram.')

  return {
    telegramStatus: response.status,
    telegramResponse: response.data,
    deliveryMode: 'message',
  }
}

async function sendTelegramDocumentNotification({
  telegramBotToken,
  telegramChatId,
  pdfBytes,
  fileName,
  caption,
  fallbackMessage,
  fallbackPrefix,
  replyMarkup = null,
}) {
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendDocument`

  try {
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
    const formData = new FormData()

    formData.append('chat_id', telegramChatId)
    formData.append('document', pdfBlob, fileName)
    formData.append('caption', caption)
    formData.append('parse_mode', 'HTML')

    if (replyMarkup) {
      formData.append('reply_markup', JSON.stringify(replyMarkup))
    }

    const response = await postTelegram(url, formData)

    assertTelegramSuccess(response, 'Gagal mengirim dokumen Telegram.')

    return {
      telegramStatus: response.status,
      telegramResponse: response.data,
      deliveryMode: 'document',
    }
  } catch (error) {
    const normalizedError =
      error instanceof Error
        ? error
        : new Error('Terjadi kesalahan saat menghubungi Telegram API.')

    if (typeof normalizedError.telegramStatus !== 'number') {
      normalizedError.telegramStatus = null
    }

    if (normalizedError.telegramResponse === undefined) {
      normalizedError.telegramResponse = null
    }

    const fallbackResult = await sendTelegramTextNotification({
      telegramBotToken,
      telegramChatId,
      message: fallbackMessage,
      prefixMessage: fallbackPrefix,
      replyMarkup,
    })

    return {
      ...fallbackResult,
      pdfError: normalizedError.message,
    }
  }
}

function isMaterialInvoicePayload(body) {
  return normalizeText(body.notificationType, '') === 'material_invoice'
}

function isBillPaymentPayload(body) {
  return normalizeText(body.notificationType, '') === 'bill_payment'
}

function isProjectIncomePayload(body) {
  return normalizeText(body.notificationType, '') === 'project_income'
}

function isLoanPayload(body) {
  return normalizeText(body.notificationType, '') === 'loan'
}

function isLoanPaymentPayload(body) {
  return normalizeText(body.notificationType, '') === 'loan_payment'
}

function isSalaryBillPayload(body) {
  return normalizeText(body.notificationType, '') === 'salary_bill'
}

function isAttendancePayload(body) {
  return normalizeText(body.notificationType, '') === 'attendance'
}

function isRecapPayload(body) {
  return normalizeText(body.notificationType, '') === 'recap'
}

function parseAttendancePayload(body) {
  return {
    workerName: normalizeText(body.workerName ?? body.worker_name, 'Pekerja'),
    projectName: normalizeText(body.projectName ?? body.project_name, 'Workspace'),
    attendanceDate: normalizeText(
      body.attendanceDate ?? body.attendance_date ?? body.date,
      new Date().toISOString()
    ),
    status: normalizeText(body.status ?? body.attendanceStatus, 'full_day'),
    routePath: normalizeText(body.routePath ?? body.route, ''),
    recordCount: Number(body.recordCount ?? body.record_count ?? 0),
    totalPay: Number(body.totalPay ?? body.total_pay ?? 0),
    userName: normalizeText(body.userName, 'Pengguna Telegram'),
  }
}

function parseRecapPayload(body) {
  return {
    title: normalizeText(body.title ?? body.summaryTitle ?? body.recapTitle, 'Rekap baru tersedia'),
    periodLabel: normalizeText(body.periodLabel ?? body.period ?? body.windowLabel, ''),
    summary: normalizeText(body.summary ?? body.description ?? body.notes, ''),
    generatedAt: normalizeText(body.generatedAt ?? body.generated_at ?? body.date, new Date().toISOString()),
    routePath: normalizeText(body.routePath ?? body.route, ''),
  }
}

function parseTransactionPayload(body) {
  const payload = {
    transactionId: normalizeText(body.transactionId, ''),
    transactionDate: normalizeText(
      body.transactionDate ?? body.transaction_date ?? body.date,
      new Date().toISOString()
    ),
    userName: normalizeText(body.userName, ''),
    type: normalizeText(body.type, ''),
    amount: Number(body.amount),
    category: normalizeText(body.category, ''),
    description: normalizeText(body.description, ''),
  }

  if (
    !payload.transactionId ||
    !payload.userName ||
    !payload.type ||
    !Number.isFinite(payload.amount) ||
    !payload.category
  ) {
    throw new Error('Payload notifikasi transaksi tidak lengkap atau tidak valid.')
  }

  return payload
}

function parseMaterialInvoicePayload(body) {
  const items = Array.isArray(body.items) ? body.items : []
  const payload = {
    expenseId: normalizeText(body.expenseId, ''),
    invoiceDate: normalizeText(body.invoiceDate ?? body.date, new Date().toISOString()),
    userName: normalizeText(body.userName, 'Pengguna Telegram'),
    supplierName: normalizeText(body.supplierName, ''),
    projectName: normalizeText(body.projectName, ''),
    totalAmount: Number(body.totalAmount),
    description: normalizeText(body.description, 'Faktur material baru dicatat.'),
    items: items.map((item) => ({
      itemName: normalizeText(item.itemName, ''),
      qty: Number(item.qty),
      unitPrice: Number(item.unitPrice),
      lineTotal: Number(item.lineTotal),
    })),
  }

  if (
    !payload.expenseId ||
    !payload.supplierName ||
    !payload.projectName ||
    !Number.isFinite(payload.totalAmount) ||
    payload.items.length === 0
  ) {
    throw new Error('Payload notifikasi faktur material tidak lengkap atau tidak valid.')
  }

  payload.items.forEach((item, index) => {
    if (
      !item.itemName ||
      !Number.isFinite(item.qty) ||
      !Number.isFinite(item.unitPrice) ||
      !Number.isFinite(item.lineTotal)
    ) {
      throw new Error(
        `Line item notifikasi pada baris ${index + 1} tidak lengkap atau tidak valid.`
      )
    }
  })

  return payload
}

function parseBillPaymentPayload(body) {
  const payload = {
    billId: normalizeText(body.billId ?? body.bill_id, ''),
    paymentDate: normalizeText(
      body.paymentDate ?? body.payment_date ?? body.date,
      new Date().toISOString()
    ),
    userName: normalizeText(body.userName, 'Pengguna Telegram'),
    supplierName: normalizeText(body.supplierName, ''),
    projectName: normalizeText(body.projectName, ''),
    amount: Number(body.amount),
    remainingAmount: Number(body.remainingAmount),
    description: normalizeText(
      body.description ?? body.notes,
      'Pembayaran tagihan telah dilakukan.'
    ),
  }

  if (!payload.billId || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error('Payload notifikasi pembayaran tagihan tidak lengkap atau tidak valid.')
  }

  if (!Number.isFinite(payload.remainingAmount) || payload.remainingAmount < 0) {
    payload.remainingAmount = 0
  }

  return payload
}

function parseProjectIncomePayload(body) {
  const payload = {
    transactionId: normalizeText(body.transactionId ?? body.transaction_id, ''),
    projectName: normalizeText(body.projectName, ''),
    transactionDate: normalizeText(body.transactionDate ?? body.transaction_date ?? body.date, new Date().toISOString()),
    userName: normalizeText(body.userName, 'Pengguna Telegram'),
    amount: Number(body.amount),
    description: normalizeText(body.description, 'Termin proyek baru dicatat.'),
  }

  if (!payload.projectName || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error('Payload notifikasi termin proyek tidak lengkap atau tidak valid.')
  }

  return payload
}

function parseLoanPayload(body) {
  const payload = {
    transactionId: normalizeText(body.transactionId ?? body.transaction_id, ''),
    creditorName: normalizeText(body.creditorName, ''),
    transactionDate: normalizeText(body.transactionDate ?? body.transaction_date ?? body.date, new Date().toISOString()),
    userName: normalizeText(body.userName, 'Pengguna Telegram'),
    principalAmount: Number(body.principalAmount ?? body.principal_amount),
    repaymentAmount: Number(body.repaymentAmount ?? body.repayment_amount),
    interestType: normalizeText(body.interestType ?? body.interest_type, 'no_interest'),
    description: normalizeText(body.description, 'Pinjaman baru dicatat.'),
  }

  if (
    !payload.creditorName ||
    !Number.isFinite(payload.principalAmount) ||
    payload.principalAmount <= 0 ||
    !Number.isFinite(payload.repaymentAmount) ||
    payload.repaymentAmount <= 0
  ) {
    throw new Error('Payload notifikasi pinjaman tidak lengkap atau tidak valid.')
  }

  return payload
}

function parseLoanPaymentPayload(body) {
  const payload = {
    loanId: normalizeText(body.loanId ?? body.loan_id, ''),
    paymentDate: normalizeText(
      body.paymentDate ?? body.payment_date ?? body.date,
      new Date().toISOString()
    ),
    userName: normalizeText(body.userName, 'Pengguna Telegram'),
    creditorName: normalizeText(body.creditorName, ''),
    amount: Number(body.amount),
    remainingAmount: Number(body.remainingAmount),
    description: normalizeText(
      body.description ?? body.notes,
      'Pembayaran pinjaman telah dilakukan.'
    ),
  }

  if (!payload.loanId || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error('Payload notifikasi pembayaran pinjaman tidak lengkap atau tidak valid.')
  }

  if (!Number.isFinite(payload.remainingAmount) || payload.remainingAmount < 0) {
    payload.remainingAmount = 0
  }

  return payload
}

function parseSalaryBillPayload(body) {
  const payload = {
    workerName: normalizeText(body.workerName, ''),
    transactionDate: normalizeText(
      body.transactionDate ?? body.transaction_date ?? body.date,
      new Date().toISOString()
    ),
    dueDate: normalizeText(body.dueDate ?? body.due_date, new Date().toISOString()),
    userName: normalizeText(body.userName, 'Pengguna Telegram'),
    amount: Number(body.amount ?? body.totalAmount),
    billId: normalizeText(body.billId ?? body.bill_id, ''),
    recordCount: Number(body.recordCount ?? body.record_count ?? 0),
    description: normalizeText(
      body.description,
      'Tagihan gaji telah dibuat.'
    ),
  }

  if (!payload.workerName || !Number.isFinite(payload.amount) || payload.amount <= 0) {
    throw new Error('Payload notifikasi tagihan gaji tidak lengkap atau tidak valid.')
  }

  return payload
}

function buildBillPaymentReceiptContext(payload) {
  const amount = Math.max(Number(payload.amount) || 0, 0)
  const remainingAmount = Math.max(Number(payload.remainingAmount) || 0, 0)
  const paymentDate = normalizeText(
    payload.paymentDate ?? payload.payment_date ?? payload.date,
    new Date().toISOString()
  )
  const referenceId = normalizeText(payload.billId, 'payment')
  const parentRecord = {
    id: referenceId,
    amount: amount + remainingAmount,
    remainingAmount,
    dueDate: paymentDate,
    status: remainingAmount > 0 ? 'partial' : 'paid',
    supplierName: normalizeText(payload.supplierName, '-'),
    projectName: normalizeText(payload.projectName, '-'),
    description: normalizeText(
      payload.description,
      'Pembayaran tagihan telah dilakukan.'
    ),
  }

  return {
    payment: {
      id: referenceId,
      referenceId,
      billId: referenceId,
      paymentDate,
      createdAt: paymentDate,
      amount,
      notes: parentRecord.description,
      supplierName: parentRecord.supplierName,
      projectName: parentRecord.projectName,
    },
    parentRecord,
  }
}

function buildLoanPaymentReceiptContext(payload) {
  const amount = Math.max(Number(payload.amount) || 0, 0)
  const remainingAmount = Math.max(Number(payload.remainingAmount) || 0, 0)
  const paymentDate = normalizeText(
    payload.paymentDate ?? payload.payment_date ?? payload.date,
    new Date().toISOString()
  )
  const referenceId = normalizeText(payload.loanId, 'payment')
  const parentRecord = {
    id: referenceId,
    amount: amount + remainingAmount,
    repayment_amount: amount + remainingAmount,
    remainingAmount,
    dueDate: paymentDate,
    status: remainingAmount > 0 ? 'partial' : 'paid',
    creditor_name_snapshot: normalizeText(payload.creditorName, '-'),
    description: normalizeText(
      payload.description,
      'Pembayaran pinjaman telah dilakukan.'
    ),
  }

  return {
    payment: {
      id: referenceId,
      referenceId,
      loanId: referenceId,
      paymentDate,
      createdAt: paymentDate,
      amount,
      notes: parentRecord.description,
      creditorNameSnapshot: parentRecord.creditor_name_snapshot,
    },
    parentRecord,
  }
}

function buildPaymentReceiptDocument(paymentType, payload) {
  const receiptContext =
    paymentType === 'loan'
      ? buildLoanPaymentReceiptContext(payload)
      : buildBillPaymentReceiptContext(payload)
  const { doc, fileName } = createPaymentReceiptPdf({
    paymentType,
    payment: receiptContext.payment,
    parentRecord: receiptContext.parentRecord,
    generatedAt: new Date(),
  })

  return {
    pdfBytes: new Uint8Array(doc.output('arraybuffer')),
    fileName,
  }
}

async function sendTransactionNotification(
  payload,
  telegramBotToken,
  telegramChatId,
  telegramBotUsername
) {
  return sendTelegramDocumentNotification({
    telegramBotToken,
    telegramChatId,
    pdfBytes: generateTransactionPdf(payload),
    fileName: getDocumentFileName('kwitansi', payload.transactionId),
    caption: buildTransactionCaption(payload),
    fallbackMessage: buildTransactionMessage(payload),
    fallbackPrefix:
      'PDF kwitansi gagal dibuat atau gagal dikirim. Notifikasi teks dikirim sebagai cadangan.',
    replyMarkup: buildNotificationReplyMarkup(
      telegramBotUsername,
      'transaction',
      payload
    ),
  })
}

async function sendMaterialInvoiceNotification(
  payload,
  telegramBotToken,
  telegramChatId,
  telegramBotUsername
) {
  return sendTelegramDocumentNotification({
    telegramBotToken,
    telegramChatId,
    pdfBytes: generateMaterialInvoicePdf(payload),
    fileName: getDocumentFileName('faktur-material', payload.expenseId),
    caption: buildMaterialInvoiceCaption(payload),
    fallbackMessage: buildMaterialInvoiceMessage(payload),
    fallbackPrefix:
      'PDF faktur material gagal dibuat atau gagal dikirim. Notifikasi teks dikirim sebagai cadangan.',
    replyMarkup: buildNotificationReplyMarkup(
      telegramBotUsername,
      'material_invoice',
      payload
    ),
  })
}

async function sendBillPaymentNotification(
  payload,
  telegramBotToken,
  telegramChatId,
  telegramBotUsername
) {
  const { pdfBytes, fileName } = buildPaymentReceiptDocument('bill', payload)

  return sendTelegramDocumentNotification({
    telegramBotToken,
    telegramChatId,
    pdfBytes,
    fileName,
    caption: buildBillPaymentMessage(payload),
    fallbackMessage: buildBillPaymentMessage(payload),
    fallbackPrefix:
      'PDF kwitansi pembayaran tagihan gagal dibuat atau gagal dikirim. Notifikasi teks dikirim sebagai cadangan.',
    replyMarkup: buildNotificationReplyMarkup(
      telegramBotUsername,
      'bill_payment',
      payload
    ),
  })
}

async function sendProjectIncomeNotification(
  payload,
  telegramBotToken,
  telegramChatId,
  telegramBotUsername
) {
  return sendTelegramTextNotification({
    telegramBotToken,
    telegramChatId,
    message: buildProjectIncomeMessage(payload),
    replyMarkup: buildNotificationReplyMarkup(
      telegramBotUsername,
      'project_income',
      payload
    ),
  })
}

async function sendLoanNotification(
  payload,
  telegramBotToken,
  telegramChatId,
  telegramBotUsername
) {
  return sendTelegramTextNotification({
    telegramBotToken,
    telegramChatId,
    message: buildLoanMessage(payload),
    replyMarkup: buildNotificationReplyMarkup(
      telegramBotUsername,
      'loan',
      payload
    ),
  })
}

async function sendLoanPaymentNotification(
  payload,
  telegramBotToken,
  telegramChatId,
  telegramBotUsername
) {
  const { pdfBytes, fileName } = buildPaymentReceiptDocument('loan', payload)

  return sendTelegramDocumentNotification({
    telegramBotToken,
    telegramChatId,
    pdfBytes,
    fileName,
    caption: buildLoanPaymentMessage(payload),
    fallbackMessage: buildLoanPaymentMessage(payload),
    fallbackPrefix:
      'PDF kwitansi pembayaran pinjaman gagal dibuat atau gagal dikirim. Notifikasi teks dikirim sebagai cadangan.',
    replyMarkup: buildNotificationReplyMarkup(
      telegramBotUsername,
      'loan_payment',
      payload
    ),
  })
}

async function sendSalaryBillNotification(
  payload,
  telegramBotToken,
  telegramChatId,
  telegramBotUsername
) {
  return sendTelegramTextNotification({
    telegramBotToken,
    telegramChatId,
    message: buildSalaryBillMessage(payload),
    replyMarkup: buildNotificationReplyMarkup(
      telegramBotUsername,
      'salary_bill',
      payload
    ),
  })
}

async function sendAttendanceNotification(
  payload,
  telegramBotToken,
  telegramChatId,
  telegramBotUsername
) {
  return sendTelegramTextNotification({
    telegramBotToken,
    telegramChatId,
    message: buildAttendanceMessage(payload),
    replyMarkup: buildNotificationReplyMarkup(
      telegramBotUsername,
      'attendance',
      payload
    ),
  })
}

async function sendRecapNotification(
  payload,
  telegramBotToken,
  telegramChatId,
  telegramBotUsername
) {
  return sendTelegramTextNotification({
    telegramBotToken,
    telegramChatId,
    message: buildRecapMessage(payload),
    replyMarkup: buildNotificationReplyMarkup(
      telegramBotUsername,
      'recap',
      payload
    ),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')

    return res.status(405).json({
      success: false,
      error: 'Method not allowed.',
    })
  }

  const TELEGRAM_BOT_TOKEN = String(
    globalThis.process?.env?.TELEGRAM_BOT_TOKEN ?? ''
  ).trim()
  const TELEGRAM_CHAT_ID = String(
    globalThis.process?.env?.TELEGRAM_CHAT_ID ?? ''
  ).trim()
  const TELEGRAM_BOT_USERNAME = getTelegramBotUsername()

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return res.status(500).json({
      success: false,
      error: 'Telegram environment variables are not configured.',
    })
  }

  try {
    const body = await parseRequestBody(req)
    let telegramResult

    if (isMaterialInvoicePayload(body)) {
      telegramResult = await sendMaterialInvoiceNotification(
        parseMaterialInvoicePayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID,
        TELEGRAM_BOT_USERNAME
      )
    } else if (isBillPaymentPayload(body)) {
      telegramResult = await sendBillPaymentNotification(
        parseBillPaymentPayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID,
        TELEGRAM_BOT_USERNAME
      )
    } else if (isProjectIncomePayload(body)) {
      telegramResult = await sendProjectIncomeNotification(
        parseProjectIncomePayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID,
        TELEGRAM_BOT_USERNAME
      )
    } else if (isLoanPayload(body)) {
      telegramResult = await sendLoanNotification(
        parseLoanPayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID,
        TELEGRAM_BOT_USERNAME
      )
    } else if (isLoanPaymentPayload(body)) {
      telegramResult = await sendLoanPaymentNotification(
        parseLoanPaymentPayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID,
        TELEGRAM_BOT_USERNAME
      )
    } else if (isSalaryBillPayload(body)) {
      telegramResult = await sendSalaryBillNotification(
        parseSalaryBillPayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID,
        TELEGRAM_BOT_USERNAME
      )
    } else if (isAttendancePayload(body)) {
      telegramResult = await sendAttendanceNotification(
        parseAttendancePayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID,
        TELEGRAM_BOT_USERNAME
      )
    } else if (isRecapPayload(body)) {
      telegramResult = await sendRecapNotification(
        parseRecapPayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID,
        TELEGRAM_BOT_USERNAME
      )
    } else {
      telegramResult = await sendTransactionNotification(
        parseTransactionPayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID,
        TELEGRAM_BOT_USERNAME
      )
    }

    return res.status(200).json({
      success: true,
      telegramStatus: telegramResult.telegramStatus,
      telegramResponse: telegramResult.telegramResponse,
      deliveryMode: telegramResult.deliveryMode,
      pdfError: telegramResult.pdfError ?? null,
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Terjadi kesalahan saat mengirim notifikasi Telegram.'

    return res.status(500).json({
      success: false,
      error: message,
      telegramStatus:
        typeof error?.telegramStatus === 'number' ? error.telegramStatus : null,
      telegramResponse: error?.telegramResponse ?? null,
    })
  }
}
