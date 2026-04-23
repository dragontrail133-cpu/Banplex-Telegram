const assistantCommandNames = new Set([
  'start',
  'menu',
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
})
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

export {
  allowedAnalyticsEntityTypes,
  allowedAnalyticsMetricKeys,
  allowedAnalyticsWindows,
  assistantCallbackPrefixes,
  assistantCommandNames,
  buildAssistantCommandInput,
  buildAssistantCommandRawText,
  extractAssistantCommand,
  resolveAssistantCallbackAction,
  shouldUseAssistantDmFallback,
}
