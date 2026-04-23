const allowedLanguages = new Set(['id', 'su'])
const maxAssistantTranscriptEntries = 4
const maxAssistantEntityHints = 6

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function truncateText(value, maxLength = 240) {
  const normalizedValue = normalizeText(value, '')

  if (normalizedValue.length <= maxLength) {
    return normalizedValue
  }

  return `${normalizedValue.slice(0, Math.max(maxLength - 1, 1)).trim()}...`
}

function getLocaleTemplate(language) {
  const normalizedLanguage = normalizeText(language, '').toLowerCase()

  return allowedLanguages.has(normalizedLanguage) ? normalizedLanguage : 'id'
}

function normalizeAssistantTranscriptEntries(entries = []) {
  if (!Array.isArray(entries)) {
    return []
  }

  return entries
    .map((entry) => ({
      at: normalizeText(entry?.at, ''),
      role: normalizeText(entry?.role, 'user'),
      text: truncateText(entry?.text, 180),
      intent: normalizeText(entry?.intent, 'clarify'),
      route: normalizeText(entry?.route ?? entry?.target_path, null),
      entity_hints: [...new Set((Array.isArray(entry?.entity_hints) ? entry.entity_hints : [])
        .map((value) => normalizeText(value, ''))
        .filter(Boolean))].slice(0, maxAssistantEntityHints),
    }))
    .filter((entry) => entry.at && entry.text)
    .slice(-maxAssistantTranscriptEntries)
}

function normalizeAssistantPendingPayload(payload = {}) {
  const normalizedPayload =
    payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}
  const summary = truncateText(
    normalizeText(normalizedPayload.summary ?? normalizedPayload.context_summary, ''),
    360
  )
  const lastTurnSource =
    normalizedPayload?.last_turn && typeof normalizedPayload.last_turn === 'object'
      ? normalizedPayload.last_turn
      : {}
  const lastRoute = normalizeText(
    normalizedPayload.last_route ??
      normalizedPayload.last_target_path ??
      lastTurnSource.route ??
      lastTurnSource.target_path,
    null
  )
  const entityHints = [...new Set(
    (Array.isArray(normalizedPayload.entity_hints) ? normalizedPayload.entity_hints : [])
      .map((value) => normalizeText(value, ''))
      .filter(Boolean)
  )].slice(0, maxAssistantEntityHints)
  const transcript = normalizeAssistantTranscriptEntries(normalizedPayload.transcript)

  return {
    ...normalizedPayload,
    summary,
    context_summary: summary,
    last_turn: {
      user_text: truncateText(lastTurnSource.user_text ?? lastTurnSource.text, 180),
      intent: normalizeText(lastTurnSource.intent, normalizeText(normalizedPayload.last_intent, 'clarify')),
      language: getLocaleTemplate(lastTurnSource.language ?? normalizedPayload.last_language),
      workspace_name: normalizeText(
        lastTurnSource.workspace_name ?? normalizedPayload.last_workspace_name,
        null
      ),
      target_path: lastRoute,
      route: lastRoute,
      query: normalizeText(lastTurnSource.query, null),
      analytics:
        lastTurnSource.analytics && typeof lastTurnSource.analytics === 'object'
          ? {
              metric_key: normalizeText(lastTurnSource.analytics.metric_key, normalizedPayload.last_metric_key ?? null),
              entity_type: normalizeText(lastTurnSource.analytics.entity_type, normalizedPayload.last_entity_type ?? null),
              entity_query: normalizeText(lastTurnSource.analytics.entity_query, normalizedPayload.last_entity_query ?? null),
              window_key: normalizeText(lastTurnSource.analytics.window_key, normalizedPayload.last_window_key ?? null),
            }
          : {
              metric_key: normalizeText(normalizedPayload.last_metric_key, null),
              entity_type: normalizeText(normalizedPayload.last_entity_type, null),
              entity_query: normalizeText(normalizedPayload.last_entity_query, null),
              window_key: normalizeText(normalizedPayload.last_window_key, null),
            },
      entity_hints: entityHints,
      summary: truncateText(lastTurnSource.summary, 180),
      updated_at: normalizeText(lastTurnSource.updated_at, null),
    },
    last_language: getLocaleTemplate(normalizedPayload.last_language ?? lastTurnSource.language),
    last_intent: normalizeText(normalizedPayload.last_intent ?? lastTurnSource.intent, 'clarify'),
    last_workspace_name: normalizeText(
      normalizedPayload.last_workspace_name ?? lastTurnSource.workspace_name,
      null
    ),
    last_target_path: lastRoute,
    last_route: lastRoute,
    last_metric_key: normalizeText(normalizedPayload.last_metric_key, null),
    last_entity_type: normalizeText(normalizedPayload.last_entity_type, null),
    last_entity_query: normalizeText(normalizedPayload.last_entity_query, null),
    last_window_key: normalizeText(normalizedPayload.last_window_key, null),
    entity_hints: entityHints,
    transcript,
  }
}

function buildAssistantMemoryPayload(previousPayload = {}, turnData = {}) {
  const normalizedPreviousPayload = normalizeAssistantPendingPayload(previousPayload)
  const previousSummary = normalizeText(normalizedPreviousPayload.summary, '')
  const currentSummary = normalizeText(turnData?.summary, '')
  const mergedSummary = [previousSummary, currentSummary].filter(Boolean).join(' || ')
  const entityHints = [...new Set([
    ...normalizedPreviousPayload.entity_hints,
    ...(Array.isArray(turnData?.entityHints) ? turnData.entityHints : []),
  ])].slice(0, maxAssistantEntityHints)
  const lastTurnAnalytics = {
    metric_key: normalizeText(turnData?.metricKey, null),
    entity_type: normalizeText(turnData?.entityType, null),
    entity_query: normalizeText(turnData?.entityQuery, null),
    window_key: normalizeText(turnData?.windowKey, null),
  }
  const transcriptEntry = {
    at: new Date().toISOString(),
    role: 'user',
    text: truncateText(turnData?.userText, 180),
    intent: normalizeText(turnData?.intent, 'clarify'),
    route: normalizeText(turnData?.targetPath, null),
    entity_hints: entityHints,
  }

  return normalizeAssistantPendingPayload({
    ...normalizedPreviousPayload,
    summary: truncateText(mergedSummary || currentSummary || previousSummary, 360),
    context_summary: truncateText(mergedSummary || currentSummary || previousSummary, 360),
    last_turn: {
      user_text: truncateText(turnData?.userText, 180),
      intent: normalizeText(turnData?.intent, 'clarify'),
      language: getLocaleTemplate(turnData?.language),
      workspace_name: normalizeText(turnData?.workspaceName, null),
      target_path: normalizeText(turnData?.targetPath, null),
      route: normalizeText(turnData?.targetPath, null),
      query: normalizeText(turnData?.query, null),
      analytics: lastTurnAnalytics,
      entity_hints: entityHints,
      summary: currentSummary,
      updated_at: new Date().toISOString(),
    },
    last_language: getLocaleTemplate(turnData?.language),
    last_intent: normalizeText(turnData?.intent, 'clarify'),
    last_workspace_name: normalizeText(turnData?.workspaceName, null),
    last_target_path: normalizeText(turnData?.targetPath, null),
    last_route: normalizeText(turnData?.targetPath, null),
    last_metric_key: normalizeText(turnData?.metricKey, null),
    last_entity_type: normalizeText(turnData?.entityType, null),
    last_entity_query: normalizeText(turnData?.entityQuery, null),
    last_window_key: normalizeText(turnData?.windowKey, null),
    entity_hints: entityHints,
    transcript: normalizeAssistantTranscriptEntries([
      ...normalizedPreviousPayload.transcript,
      transcriptEntry,
    ]),
  })
}

function buildPendingSessionPayload(text, plan, previousPayload = {}, turnData = {}) {
  return normalizeAssistantPendingPayload({
    ...buildAssistantMemoryPayload(previousPayload, turnData),
    original_text: normalizeText(text, ''),
    original_plan: plan,
  })
}

export {
  allowedLanguages,
  buildAssistantMemoryPayload,
  buildPendingSessionPayload,
  maxAssistantEntityHints,
  maxAssistantTranscriptEntries,
  normalizeAssistantPendingPayload,
}
