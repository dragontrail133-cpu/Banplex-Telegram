import { jsPDF } from 'jspdf'

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

  if (!normalizedValue) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())
  }

  const parsedDate = new Date(normalizedValue)

  if (!Number.isNaN(parsedDate.getTime())) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsedDate)
  }

  const parsedDateOnly = new Date(`${normalizedValue}T00:00:00`)

  if (!Number.isNaN(parsedDateOnly.getTime())) {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
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

function drawDocumentHeader(doc, title, subtitle) {
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setFillColor(15, 23, 42)
  doc.roundedRect(10, 10, pageWidth - 20, 28, 4, 4, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text('BANPLEX GREENFIELD', 15, 21)
  doc.setFontSize(11)
  doc.text(title, 15, 29)

  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.text(subtitle, pageWidth - 15, 29, { align: 'right' })
  }
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

  drawDocumentHeader(doc, 'KWITANSI DIGITAL', 'Ringkasan transaksi')

  doc.setTextColor(16, 36, 59)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Detail Transaksi', 12, y)
  y += 8

  doc.setDrawColor(203, 213, 225)
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
  doc.setFillColor(240, 249, 255)
  doc.roundedRect(12, y, pageWidth - 24, 20, 4, 4, 'F')
  doc.setTextColor(8, 47, 73)
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

  return new Uint8Array(doc.output('arraybuffer'))
}

function drawInvoiceTableHeader(doc, y, columns) {
  let x = 12

  doc.setFillColor(226, 232, 240)
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)

  columns.forEach((column) => {
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

  doc.setDrawColor(226, 232, 240)
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

  drawDocumentHeader(doc, 'FAKTUR MATERIAL', 'Relational expense invoice')

  doc.setTextColor(16, 36, 59)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Informasi Faktur', 12, y)
  y += 8

  doc.setDrawColor(203, 213, 225)
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
  doc.setTextColor(16, 36, 59)
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
  doc.setFillColor(240, 249, 255)
  doc.roundedRect(12, y, pageWidth - 24, 20, 4, 4, 'F')
  doc.setTextColor(8, 47, 73)
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

  return new Uint8Array(doc.output('arraybuffer'))
}

function buildTransactionMessage(payload) {
  return [
    '<b>Transaksi Baru Dicatat</b>',
    `<i>ID: ${escapeHtml(normalizeText(payload.transactionId, '-'))}</i>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.transactionDate))}</b>`,
    `Oleh: <b>${escapeHtml(normalizeText(payload.userName, 'Pengguna Telegram'))}</b>`,
    `Tipe: ${escapeHtml(getTypeLabel(payload.type))}`,
    `Kategori: <b>${escapeHtml(normalizeText(payload.category))}</b>`,
    `Nominal: <b>${escapeHtml(formatCurrency(payload.amount))}</b>`,
    `Deskripsi: <i>${escapeHtml(normalizeText(payload.description))}</i>`,
  ].join('\n')
}

function buildTransactionCaption(payload) {
  return [
    '<b>Kwitansi Digital Banplex</b>',
    `<i>ID: ${escapeHtml(normalizeText(payload.transactionId, '-'))}</i>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.transactionDate))}</b>`,
    `Oleh: <b>${escapeHtml(normalizeText(payload.userName, 'Pengguna Telegram'))}</b>`,
    `Tipe: ${escapeHtml(getTypeLabel(payload.type))}`,
    `Nominal: <b>${escapeHtml(formatCurrency(payload.amount))}</b>`,
  ].join('\n')
}

function buildMaterialInvoiceMessage(payload) {
  return [
    '<b>Faktur Material Baru Dicatat</b>',
    `<i>Expense ID: ${escapeHtml(normalizeText(payload.expenseId, '-'))}</i>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.invoiceDate))}</b>`,
    `Proyek: <b>${escapeHtml(normalizeText(payload.projectName))}</b>`,
    `Supplier: <b>${escapeHtml(normalizeText(payload.supplierName))}</b>`,
    `Oleh: <b>${escapeHtml(normalizeText(payload.userName, 'Pengguna Telegram'))}</b>`,
    `Jumlah Item: <b>${escapeHtml(String(payload.items.length))}</b>`,
    `Total: <b>${escapeHtml(formatCurrency(payload.totalAmount))}</b>`,
    `Catatan: <i>${escapeHtml(normalizeText(payload.description))}</i>`,
  ].join('\n')
}

function buildMaterialInvoiceCaption(payload) {
  return [
    '<b>Faktur Material Banplex</b>',
    `<i>Expense ID: ${escapeHtml(normalizeText(payload.expenseId, '-'))}</i>`,
    `Supplier: <b>${escapeHtml(normalizeText(payload.supplierName))}</b>`,
    `Proyek: <b>${escapeHtml(normalizeText(payload.projectName))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.invoiceDate))}</b>`,
    `Total: <b>${escapeHtml(formatCurrency(payload.totalAmount))}</b>`,
  ].join('\n')
}

function buildBillPaymentMessage(payload) {
  return [
    '<b>Pembayaran Tagihan Berhasil Dicatat</b>',
    `<i>Bill ID: ${escapeHtml(normalizeText(payload.billId, '-'))}</i>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.paymentDate))}</b>`,
    `Supplier: <b>${escapeHtml(normalizeText(payload.supplierName))}</b>`,
    `Proyek: <b>${escapeHtml(normalizeText(payload.projectName))}</b>`,
    `Oleh: <b>${escapeHtml(normalizeText(payload.userName, 'Pengguna Telegram'))}</b>`,
    `Nominal Bayar: <b>${escapeHtml(formatCurrency(payload.amount))}</b>`,
    `Sisa Tagihan: <b>${escapeHtml(formatCurrency(payload.remainingAmount))}</b>`,
    `Catatan: <i>${escapeHtml(normalizeText(payload.description))}</i>`,
  ].join('\n')
}

function getInterestLabel(value) {
  return value === 'interest' ? 'Berbunga' : 'Tanpa Bunga'
}

function buildProjectIncomeMessage(payload) {
  return [
    `<b>Dana Masuk: Termin Proyek ${escapeHtml(normalizeText(payload.projectName))} sebesar ${escapeHtml(formatCurrency(payload.amount))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.transactionDate))}</b>`,
    `Oleh: <b>${escapeHtml(normalizeText(payload.userName, 'Pengguna Telegram'))}</b>`,
    `Keterangan: <i>${escapeHtml(normalizeText(payload.description))}</i>`,
  ].join('\n')
}

function buildLoanMessage(payload) {
  return [
    `<b>Dana Masuk: Pinjaman dari ${escapeHtml(normalizeText(payload.creditorName))} sebesar ${escapeHtml(formatCurrency(payload.principalAmount))}</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.transactionDate))}</b>`,
    `Oleh: <b>${escapeHtml(normalizeText(payload.userName, 'Pengguna Telegram'))}</b>`,
    `Total Pengembalian: <b>${escapeHtml(formatCurrency(payload.repaymentAmount))}</b>`,
    `Tipe Bunga: <b>${escapeHtml(getInterestLabel(payload.interestType))}</b>`,
    `Catatan: <i>${escapeHtml(normalizeText(payload.description))}</i>`,
  ].join('\n')
}

function buildLoanPaymentMessage(payload) {
  return [
    '<b>Pembayaran Pinjaman Berhasil Dicatat</b>',
    `<i>Loan ID: ${escapeHtml(normalizeText(payload.loanId, '-'))}</i>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.paymentDate))}</b>`,
    `Kreditur: <b>${escapeHtml(normalizeText(payload.creditorName))}</b>`,
    `Oleh: <b>${escapeHtml(normalizeText(payload.userName, 'Pengguna Telegram'))}</b>`,
    `Nominal Bayar: <b>${escapeHtml(formatCurrency(payload.amount))}</b>`,
    `Sisa Pinjaman: <b>${escapeHtml(formatCurrency(payload.remainingAmount))}</b>`,
    `Catatan: <i>${escapeHtml(normalizeText(payload.description))}</i>`,
  ].join('\n')
}

function buildSalaryBillMessage(payload) {
  return [
    `<b>Tagihan Gaji untuk ${escapeHtml(normalizeText(payload.workerName))} sebesar ${escapeHtml(formatCurrency(payload.amount))} telah dibuat.</b>`,
    `Tanggal: <b>${escapeHtml(formatDate(payload.transactionDate ?? payload.dueDate))}</b>`,
    `Oleh: <b>${escapeHtml(normalizeText(payload.userName, 'Pengguna Telegram'))}</b>`,
    `Jumlah Absensi: <b>${escapeHtml(String(payload.recordCount ?? 0))}</b>`,
    `Jatuh Tempo: <b>${escapeHtml(formatDate(payload.dueDate))}</b>`,
    `Keterangan: <i>${escapeHtml(normalizeText(payload.description, '-'))}</i>`,
  ].join('\n')
}

async function sendTelegramTextNotification({
  telegramBotToken,
  telegramChatId,
  message,
  prefixMessage = null,
}) {
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`
  const text = prefixMessage
    ? `${escapeHtml(prefixMessage)}\n\n${message}`
    : message
  const response = await postTelegram(
    url,
    JSON.stringify({
      chat_id: telegramChatId,
      text,
      parse_mode: 'HTML',
    })
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
}) {
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendDocument`

  try {
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
    const formData = new FormData()

    formData.append('chat_id', telegramChatId)
    formData.append('document', pdfBlob, fileName)
    formData.append('caption', caption)
    formData.append('parse_mode', 'HTML')

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

async function sendTransactionNotification(payload, telegramBotToken, telegramChatId) {
  return sendTelegramDocumentNotification({
    telegramBotToken,
    telegramChatId,
    pdfBytes: generateTransactionPdf(payload),
    fileName: getDocumentFileName('kwitansi', payload.transactionId),
    caption: buildTransactionCaption(payload),
    fallbackMessage: buildTransactionMessage(payload),
    fallbackPrefix:
      'PDF kwitansi gagal dibuat atau gagal dikirim. Notifikasi teks dikirim sebagai cadangan.',
  })
}

async function sendMaterialInvoiceNotification(
  payload,
  telegramBotToken,
  telegramChatId
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
  })
}

async function sendBillPaymentNotification(payload, telegramBotToken, telegramChatId) {
  return sendTelegramTextNotification({
    telegramBotToken,
    telegramChatId,
    message: buildBillPaymentMessage(payload),
  })
}

async function sendProjectIncomeNotification(payload, telegramBotToken, telegramChatId) {
  return sendTelegramTextNotification({
    telegramBotToken,
    telegramChatId,
    message: buildProjectIncomeMessage(payload),
  })
}

async function sendLoanNotification(payload, telegramBotToken, telegramChatId) {
  return sendTelegramTextNotification({
    telegramBotToken,
    telegramChatId,
    message: buildLoanMessage(payload),
  })
}

async function sendLoanPaymentNotification(payload, telegramBotToken, telegramChatId) {
  return sendTelegramTextNotification({
    telegramBotToken,
    telegramChatId,
    message: buildLoanPaymentMessage(payload),
  })
}

async function sendSalaryBillNotification(payload, telegramBotToken, telegramChatId) {
  return sendTelegramTextNotification({
    telegramBotToken,
    telegramChatId,
    message: buildSalaryBillMessage(payload),
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
        TELEGRAM_CHAT_ID
      )
    } else if (isBillPaymentPayload(body)) {
      telegramResult = await sendBillPaymentNotification(
        parseBillPaymentPayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID
      )
    } else if (isProjectIncomePayload(body)) {
      telegramResult = await sendProjectIncomeNotification(
        parseProjectIncomePayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID
      )
    } else if (isLoanPayload(body)) {
      telegramResult = await sendLoanNotification(
        parseLoanPayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID
      )
    } else if (isLoanPaymentPayload(body)) {
      telegramResult = await sendLoanPaymentNotification(
        parseLoanPaymentPayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID
      )
    } else if (isSalaryBillPayload(body)) {
      telegramResult = await sendSalaryBillNotification(
        parseSalaryBillPayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID
      )
    } else {
      telegramResult = await sendTransactionNotification(
        parseTransactionPayload(body),
        TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID
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
