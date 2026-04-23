function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function createHttpError(status, message) {
  const error = new Error(message)

  error.statusCode = status

  return error
}

function buildTelegramApiUrl(botToken, method) {
  return `https://api.telegram.org/bot${botToken}/${method}`
}

async function postTelegram(url, body) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 8000)

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
      throw createHttpError(
        response.status,
        error instanceof Error
          ? `Gagal parse respons Telegram: ${error.message}`
          : 'Gagal parse respons Telegram.'
      )
    }
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createHttpError(504, 'Request ke Telegram timeout.')
    }

    throw error instanceof Error
      ? error
      : createHttpError(500, 'Terjadi kesalahan saat menghubungi Telegram API.')
  } finally {
    clearTimeout(timeoutId)
  }
}

function assertTelegramSuccess(response, fallbackMessage) {
  if (response.status >= 200 && response.status < 300 && response.data?.ok) {
    return
  }

  throw createHttpError(
    response.status,
    response.data?.description || fallbackMessage || 'Telegram request gagal.'
  )
}

function isIgnorableTelegramCallbackError(errorMessage) {
  const normalizedMessage = normalizeText(errorMessage, '').toLowerCase()

  return (
    normalizedMessage.includes('query is too old') ||
    normalizedMessage.includes('query id is invalid') ||
    normalizedMessage.includes('query_id_invalid')
  )
}

async function sendTelegramMessage({
  botToken,
  chatId,
  text,
  replyMarkup = null,
  replyToMessageId = null,
}) {
  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  }

  if (replyMarkup) {
    payload.reply_markup = replyMarkup
  }

  if (replyToMessageId) {
    payload.reply_to_message_id = replyToMessageId
  }

  const response = await postTelegram(
    buildTelegramApiUrl(botToken, 'sendMessage'),
    JSON.stringify(payload)
  )

  try {
    assertTelegramSuccess(response, 'Gagal mengirim pesan Telegram.')
  } catch (error) {
    const errorMessage = normalizeText(error?.message, '')
    if (replyToMessageId && /message to be replied not found|reply message not found/i.test(errorMessage)) {
      const fallbackPayload = {
        ...payload,
      }
      delete fallbackPayload.reply_to_message_id

      const fallbackResponse = await postTelegram(
        buildTelegramApiUrl(botToken, 'sendMessage'),
        JSON.stringify(fallbackPayload)
      )

      assertTelegramSuccess(fallbackResponse, 'Gagal mengirim pesan Telegram.')
      return fallbackResponse.data
    }

    throw error
  }

  return response.data
}

async function answerTelegramCallback({
  botToken,
  callbackQueryId,
  text = null,
  showAlert = false,
}) {
  const payload = {
    callback_query_id: callbackQueryId,
    show_alert: Boolean(showAlert),
  }

  if (text) {
    payload.text = text
  }

  const response = await postTelegram(
    buildTelegramApiUrl(botToken, 'answerCallbackQuery'),
    JSON.stringify(payload)
  )

  try {
    assertTelegramSuccess(response, 'Gagal menjawab callback Telegram.')
  } catch (error) {
    const errorMessage = normalizeText(error?.message, '')

    if (isIgnorableTelegramCallbackError(errorMessage)) {
      console.warn('[api/telegram-assistant] callback ack skipped', {
        callbackQueryId,
        message: errorMessage,
      })

      return null
    }

    throw error
  }

  return response.data
}

export {
  answerTelegramCallback,
  assertTelegramSuccess,
  buildTelegramApiUrl,
  isIgnorableTelegramCallbackError,
  postTelegram,
  sendTelegramMessage,
}
