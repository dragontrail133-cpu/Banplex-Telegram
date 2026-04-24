import { normalizeAssistantRoutePath } from './telegram-assistant-links.js'

const assistantCommandNames = new Set([
  'start',
  'menu',
  'tambah',
  'status',
  'cari',
  'analytics',
  'riwayat',
  'buka',
])
const assistantCallbackPrefixes = Object.freeze({
  command: 'ta:cmd:',
  metric: 'ta:am:',
  entity: 'ta:ae:',
  window: 'ta:aw:',
  settlement: 'ta:sb:',
})
const allowedSettlementSummarySurfaces = new Set(['status', 'history'])
const allowedSettlementSummaryStatuses = new Set(['paid', 'partial', 'unpaid'])
const allowedAnalyticsMetricKeys = new Set([
  'bill_summary',
  'cash_outflow',
  'attendance_present',
  'obligation_ranking',
])
const allowedAnalyticsEntityTypes = new Set(['supplier', 'worker', 'creditor'])
const allowedAnalyticsWindows = new Set([
  'none',
  'today',
  'yesterday',
  'week_current',
  'week_previous',
  'month_current',
  'month_previous',
  'custom',
])
const assistantRouteTargets = Object.freeze({
  dashboard: '/',
  ledger: '/transactions',
  activeLedger: '/transactions?tab=aktif',
  billLedger: '/transactions?tab=tagihan',
  history: '/transactions?tab=history',
  payment: '/pembayaran',
  attendance: '/payroll?tab=daily',
  payroll: '/payroll',
  worker: '/payroll?tab=worker',
  incomeCreate: '/edit/project-income/new',
  expenseCreate: '/edit/expense/new',
  loanCreate: '/edit/loan/new',
  invoiceCreate: '/material-invoice/new',
  attendanceCreate: '/attendance/new',
})
const assistantRouteLabels = Object.freeze({
  '/': 'Dashboard',
  '/transactions': 'Jurnal',
  '/transactions?tab=aktif': 'Jurnal',
  '/transactions?tab=history': 'Riwayat',
  '/transactions?tab=tagihan': 'Tagihan',
  '/pembayaran': 'Pembayaran',
  '/payroll': 'Absensi',
  '/payroll?tab=daily': 'Absensi',
  '/payroll?tab=worker': 'Pekerja',
  '/edit/project-income/new': 'Pemasukan',
  '/edit/expense/new': 'Pengeluaran',
  '/edit/loan/new': 'Pinjaman',
  '/material-invoice/new': 'Faktur Barang',
  '/attendance/new': 'Absensi',
})

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function extractAssistantCommand(messageText, botUsername = '') {
  const normalizedText = normalizeText(messageText, '')
  const commandMatch = normalizedText.match(/^\/([a-z_]+)(?:@([A-Za-z0-9_]+))?(?:\s+([\s\S]+))?$/i)

  if (!commandMatch) {
    return null
  }

  const commandName = normalizeText(commandMatch[1], '').toLowerCase()
  const targetUsername = normalizeText(commandMatch[2], '').replace(/^@/, '').toLowerCase()
  const normalizedBotUsername = normalizeText(botUsername, '').replace(/^@/, '').toLowerCase()

  if (!assistantCommandNames.has(commandName)) {
    return null
  }

  if (targetUsername && normalizedBotUsername && targetUsername !== normalizedBotUsername) {
    return null
  }

  return {
    command: commandName,
    args: normalizeText(commandMatch[3], ''),
    rawText: normalizedText,
  }
}

function buildAssistantCommandRawText(commandName, args = '') {
  const normalizedCommand = normalizeText(commandName, '').toLowerCase()
  const normalizedArgs = normalizeText(args, '')

  if (!assistantCommandNames.has(normalizedCommand)) {
    return ''
  }

  return normalizedArgs ? `/${normalizedCommand} ${normalizedArgs}` : `/${normalizedCommand}`
}

function buildAssistantCommandInput(commandName, args = '') {
  const normalizedCommand = normalizeText(commandName, '').toLowerCase()
  const normalizedArgs = normalizeText(args, '')

  if (normalizedCommand === 'status') {
    return normalizedArgs ? `status ${normalizedArgs}` : 'status'
  }

  if (normalizedCommand === 'cari') {
    return normalizedArgs ? `cari ${normalizedArgs}` : ''
  }

  if (normalizedCommand === 'analytics') {
    return normalizedArgs ? `ringkas ${normalizedArgs}` : ''
  }

  if (normalizedCommand === 'riwayat') {
    return 'buka riwayat'
  }

  if (normalizedCommand === 'buka') {
    return normalizedArgs ? `buka ${normalizedArgs}` : ''
  }

  return ''
}

function resolveAssistantMenuCommandFromText(text, labels = {}) {
  const normalizedText = normalizeText(text, '').toLowerCase()

  if (!normalizedText) {
    return null
  }

  const labelToCommandPairs = [
    ['menu', labels.menu],
    ['tambah', labels.add],
    ['buka', labels.open],
    ['cari', labels.search],
    ['status', labels.status],
    ['riwayat', labels.history],
    ['analytics', labels.analytics],
  ]

  for (const [commandName, label] of labelToCommandPairs) {
    if (normalizeText(label, '').toLowerCase() === normalizedText) {
      return commandName
    }
  }

  return null
}

function resolveAssistantCallbackAction(callbackData) {
  const normalizedCallbackData = normalizeText(callbackData, '')

  if (normalizedCallbackData.startsWith('ws:')) {
    return {
      type: 'workspace',
      teamId: normalizedCallbackData.slice(3),
      requiresSession: true,
    }
  }

  if (normalizedCallbackData.startsWith(assistantCallbackPrefixes.command)) {
    const commandName = normalizedCallbackData.slice(assistantCallbackPrefixes.command.length)

    if (!assistantCommandNames.has(commandName)) {
      return null
    }

    return {
      type: 'message',
      messageText: buildAssistantCommandRawText(commandName),
      requiresSession: false,
    }
  }

  if (normalizedCallbackData.startsWith(assistantCallbackPrefixes.metric)) {
    const metricKey = normalizedCallbackData.slice(assistantCallbackPrefixes.metric.length)

    if (!allowedAnalyticsMetricKeys.has(metricKey)) {
      return null
    }

    const metricPrompts = {
      bill_summary: 'ringkas tagihan aktif',
      cash_outflow: 'ringkas pengeluaran',
      attendance_present: 'ringkas kehadiran',
      obligation_ranking: 'ringkas ranking hutang terbesar',
    }

    return {
      type: 'message',
      messageText: metricPrompts[metricKey] ?? '',
      requiresSession: true,
    }
  }

  if (normalizedCallbackData.startsWith(assistantCallbackPrefixes.settlement)) {
    const payload = normalizedCallbackData.slice(assistantCallbackPrefixes.settlement.length)
    const [surface = '', status = ''] = payload.split(':')
    const normalizedSurface = normalizeText(surface, '').toLowerCase()
    const normalizedStatus = normalizeText(status, '').toLowerCase()

    if (
      !allowedSettlementSummarySurfaces.has(normalizedSurface) ||
      !allowedSettlementSummaryStatuses.has(normalizedStatus)
    ) {
      return null
    }

    return {
      type: 'settlement_summary',
      surface: normalizedSurface,
      status: normalizedStatus,
      requiresSession: true,
    }
  }

  if (normalizedCallbackData.startsWith(assistantCallbackPrefixes.entity)) {
    const entityType = normalizedCallbackData.slice(assistantCallbackPrefixes.entity.length)

    if (!allowedAnalyticsEntityTypes.has(entityType)) {
      return null
    }

    const entityPrompts = {
      supplier: 'supplier',
      worker: 'worker',
      creditor: 'kreditur',
    }

    return {
      type: 'message',
      messageText: entityPrompts[entityType] ?? '',
      requiresSession: true,
    }
  }

  if (normalizedCallbackData.startsWith(assistantCallbackPrefixes.window)) {
    const windowKey = normalizedCallbackData.slice(assistantCallbackPrefixes.window.length)

    if (!allowedAnalyticsWindows.has(windowKey)) {
      return null
    }

    const windowPrompts = {
      today: 'hari ini',
      yesterday: 'kemarin',
      week_current: 'minggu ini',
      month_current: 'bulan ini',
    }

    return {
      type: 'message',
      messageText: windowPrompts[windowKey] ?? '',
      requiresSession: true,
    }
  }

  return null
}

function shouldUseAssistantDmFallback({
  chatType,
  sessionState = 'idle',
  needsClarification = false,
  needsWorkspaceChoice = false,
} = {}) {
  const normalizedChatType = normalizeText(chatType, '').toLowerCase()
  const isGroupChat = normalizedChatType === 'group' || normalizedChatType === 'supergroup'

  if (!isGroupChat) {
    return false
  }

  if (needsClarification || needsWorkspaceChoice) {
    return true
  }

  return ['awaiting_workspace_choice', 'awaiting_clarification'].includes(
    normalizeText(sessionState, '')
  )
}

function getAssistantRouteLabel(path) {
  const normalizedPath = normalizeAssistantRoutePath(path) ?? normalizeText(path, '')

  return assistantRouteLabels[normalizedPath] ?? 'halaman tujuan'
}

export {
  assistantRouteLabels,
  assistantRouteTargets,
  allowedAnalyticsEntityTypes,
  allowedAnalyticsMetricKeys,
  allowedAnalyticsWindows,
  assistantCallbackPrefixes,
  assistantCommandNames,
  buildAssistantCommandInput,
  buildAssistantCommandRawText,
  extractAssistantCommand,
  resolveAssistantCallbackAction,
  resolveAssistantMenuCommandFromText,
  getAssistantRouteLabel,
  shouldUseAssistantDmFallback,
}
