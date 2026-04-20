import { getSupabaseAccessToken } from './auth-session'

async function requestReportsApi(query = {}) {
  const accessToken = await getSupabaseAccessToken()

  const url = new URL('/api/records', window.location.origin)
  url.searchParams.set('resource', 'reports')
  if (import.meta.env.DEV) {
    url.searchParams.set('debugTiming', '1')
  }

  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === '') {
      continue
    }

    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Gagal memuat laporan dari server.')
  }

  return result
}

export async function fetchProjectSummariesFromApi() {
  const result = await requestReportsApi()

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
  const result = await requestReportsApi({
    projectId,
  })

  return result.projectDetail ?? null
}
