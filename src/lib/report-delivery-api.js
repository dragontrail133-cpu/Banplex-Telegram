import { getSupabaseAccessToken } from './auth-session'

async function requestReportDeliveryApi(body = {}) {
  const accessToken = await getSupabaseAccessToken()
  const url = new URL('/api/report-pdf-delivery', window.location.origin)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Gagal mengirim dokumen ke DM Telegram.')
  }

  return result
}

export async function sendBusinessReportPdfToTelegramDm(payload = {}) {
  return requestReportDeliveryApi(payload)
}

export async function sendPaymentReceiptPdfToTelegramDm(payload = {}) {
  return requestReportDeliveryApi({
    deliveryKind: 'payment_receipt',
    ...payload,
  })
}
