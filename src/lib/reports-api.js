import { getSupabaseAccessToken } from './auth-session'

async function requestRecordsApi(
  resource,
  { method = 'GET', query = {}, body = null, fallbackMessage = 'Gagal memuat laporan dari server.' } = {}
) {
  const accessToken = await getSupabaseAccessToken()

  const url = new URL('/api/records', window.location.origin)
  url.searchParams.set('resource', resource)

  if (import.meta.env.DEV && resource === 'reports') {
    url.searchParams.set('debugTiming', '1')
  }

  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') {
      continue
    }

    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || fallbackMessage)
  }

  return result
}

export async function fetchProjectSummariesFromApi() {
  const result = await requestRecordsApi('reports')

  return {
    projectSummaries: result.projectSummaries ?? [],
    portfolioSummary: result.portfolioSummary ?? {
      total_income: 0,
      total_material_expense: 0,
      total_operating_expense: 0,
      total_salary_expense: 0,
      total_expense: 0,
      total_project_profit: 0,
      total_company_overhead: 0,
      net_consolidated_profit: 0,
    },
    timing: result.timing ?? null,
  }
}

export async function fetchProjectDetailFromApi(projectId) {
  const result = await requestRecordsApi('reports', {
    query: {
      projectId,
    },
  })

  return result.projectDetail ?? null
}

export async function fetchBusinessReportFromApi(query = {}) {
  const result = await requestRecordsApi('reports', {
    query,
  })

  return result.reportData ?? null
}

export async function fetchPdfSettingsFromApi(teamId) {
  const result = await requestRecordsApi('pdf-settings', {
    query: {
      teamId,
    },
    fallbackMessage: 'Gagal memuat pengaturan PDF.',
  })

  return result.pdfSettings ?? null
}

export async function savePdfSettingsFromApi(payload = {}) {
  const result = await requestRecordsApi('pdf-settings', {
    method: 'PATCH',
    body: payload,
    fallbackMessage: 'Gagal menyimpan pengaturan PDF.',
  })

  return result.pdfSettings ?? null
}
