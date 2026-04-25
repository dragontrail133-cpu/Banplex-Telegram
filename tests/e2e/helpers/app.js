import { Buffer } from 'node:buffer'
import { expect } from '@playwright/test'
import { withDevAuthBypass } from './routes.js'
import { stubTelegramWebApp } from './telegram.js'

async function fulfillJson(route, responseBody, status = 200) {
  await route.fulfill({
    contentType: 'application/json',
    status,
    body: JSON.stringify(responseBody),
  })
}

function createAuthResponse(options = {}) {
  const telegramUser = options.telegramUser ?? {
    id: 20002,
    first_name: 'Playwright',
    last_name: 'Tester',
    username: 'playwright_tester',
  }
  const telegramUserId = String(telegramUser.id ?? '20002')
  const teamId = options.teamId ?? 'e2e-team'
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    'utf8'
  ).toString('base64url')
  const accessPayload = Buffer.from(
    JSON.stringify({
      sub: `e2e-${telegramUserId}`,
      role: 'authenticated',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      iat: Math.floor(Date.now() / 1000) - 60,
      email: `telegram-${telegramUserId}@banplex.local`,
    }),
    'utf8'
  ).toString('base64url')
  const refreshPayload = Buffer.from(
    JSON.stringify({
      sub: `e2e-${telegramUserId}`,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
      iat: Math.floor(Date.now() / 1000) - 60,
    }),
    'utf8'
  ).toString('base64url')
  const signature = Buffer.from('signature', 'utf8').toString('base64url')
  const refreshSignature = Buffer.from('refresh-signature', 'utf8').toString('base64url')

  return {
    success: true,
    isOwnerBypass: true,
    profile: {
      id: 'e2e-profile',
      telegram_user_id: telegramUserId,
      role: 'Owner',
    },
    memberships: [
      {
        id: 'e2e-membership',
        team_id: teamId,
        telegram_user_id: telegramUserId,
        role: 'Owner',
        is_default: true,
        status: 'active',
        approved_at: '2026-04-21T00:00:00.000Z',
        teams: {
          id: teamId,
          name: 'E2E Team',
          slug: 'e2e-team',
          is_active: true,
        },
      },
    ],
    role: 'Owner',
    telegramUser: {
      id: telegramUserId,
      first_name: telegramUser.first_name ?? null,
      last_name: telegramUser.last_name ?? null,
      username: telegramUser.username ?? null,
    },
    session: {
      access_token: `${header}.${accessPayload}.${signature}`,
      refresh_token: `refresh.${refreshPayload}.${refreshSignature}`,
      expires_at: null,
      expires_in: null,
      token_type: 'bearer',
    },
  }
}

function createBusinessReportResponse() {
  const generatedAt = '2026-04-24T12:00:00.000Z'
  const period = {
    dateFrom: '2026-04-01',
    dateTo: '2026-04-24',
  }
  const projectSummary = {
    project_id: 'project-e2e',
    project_name: 'Proyek E2E',
    project_status: 'active',
    total_income: 18_000_000,
    material_expense: 6_000_000,
    operating_expense: 2_000_000,
    salary_expense: 3_000_000,
    net_profit_project: 7_000_000,
  }
  const summary = {
    total_income: 18_000_000,
    total_material_expense: 6_000_000,
    total_operating_expense: 2_000_000,
    total_salary_expense: 3_000_000,
    total_expense: 11_000_000,
    total_project_profit: 7_000_000,
    total_company_overhead: 1_000_000,
    net_consolidated_profit: 6_000_000,
    total_bill_count: 3,
    total_paid_bill: 4_500_000,
    total_outstanding_bill: 1_500_000,
    total_outstanding_salary: 2_250_000,
  }

  return {
    success: true,
    projectSummaries: [projectSummary],
    portfolioSummary: {
      total_income: summary.total_income,
      total_material_expense: summary.total_material_expense,
      total_operating_expense: summary.total_operating_expense,
      total_salary_expense: summary.total_salary_expense,
      total_expense: summary.total_expense,
      total_project_profit: summary.total_project_profit,
      total_company_overhead: summary.total_company_overhead,
      net_consolidated_profit: summary.net_consolidated_profit,
    },
    reportData: {
      reportKind: 'executive_finance',
      title: 'LAPORAN KEUANGAN EKSEKUTIF',
      reportTitle: 'LAPORAN KEUANGAN EKSEKUTIF',
      generatedAt,
      period,
      summary,
      projectSummaries: [projectSummary],
      cashMutations: [
        {
          transaction_date: generatedAt,
          type: 'inflow',
          amount: 18_000_000,
          source_table: 'project_incomes',
          description: 'Pemasukan Proyek E2E',
        },
      ],
      rows: [],
      billingStats: {
        total_bill_count: summary.total_bill_count,
        total_paid_bill: summary.total_paid_bill,
        total_outstanding_bill: summary.total_outstanding_bill,
        total_outstanding_salary: summary.total_outstanding_salary,
      },
    },
  }
}

async function openApp(page, path = '/', options = {}) {
  const telegramUser = options.telegram?.user
  const mockApi = options.mockApi ?? {}

  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem('banplex.dev-auth-bypass', '1')
    } catch {
      return
    }
  })

  await page.route('**/api/auth', async (route) => {
    const responseBody = await mockApi.auth?.({
      route,
      url: new URL(route.request().url()),
      method: route.request().method(),
      telegramUser,
    })

    if (responseBody !== undefined) {
      await fulfillJson(route, responseBody)
      return
    }

    await fulfillJson(route, createAuthResponse({ telegramUser }))
  })

  await page.route('**/auth/v1/user', async (route) => {
    const responseBody = await mockApi.supabaseAuthUser?.({
      route,
      url: new URL(route.request().url()),
      method: route.request().method(),
      telegramUser,
    })

    if (responseBody !== undefined) {
      await fulfillJson(route, responseBody)
      return
    }

    await fulfillJson(route, {
      id: 'e2e-user',
      email: `telegram-${telegramUser?.id ?? '20002'}@banplex.local`,
      role: 'authenticated',
    })
  })

  await page.route('**/auth/v1/token**', async (route) => {
    const responseBody = await mockApi.supabaseAuthToken?.({
      route,
      url: new URL(route.request().url()),
      method: route.request().method(),
      telegramUser,
      session: createAuthResponse({ telegramUser }).session,
    })

    if (responseBody !== undefined) {
      await fulfillJson(route, responseBody)
      return
    }

    await fulfillJson(route, {
      access_token: createAuthResponse({ telegramUser }).session.access_token,
      refresh_token: createAuthResponse({ telegramUser }).session.refresh_token,
      expires_at: null,
      expires_in: null,
      token_type: 'bearer',
      user: {
        id: 'e2e-user',
        email: `telegram-${telegramUser?.id ?? '20002'}@banplex.local`,
        role: 'authenticated',
      },
    })
  })

  await page.route('**/api/notify', async (route) => {
    const request = route.request()
    let requestBody = null

    try {
      requestBody = request.postDataJSON()
    } catch {
      requestBody = request.postData()
    }

    const responseBody = await mockApi.notify?.({
      route,
      url: new URL(request.url()),
      method: request.method(),
      body: requestBody,
      telegramUser,
    })

    if (responseBody !== undefined) {
      await fulfillJson(route, responseBody)
      return
    }

    await fulfillJson(route, { success: true })
  })

  await page.route('**/api/report-pdf-delivery', async (route) => {
    const request = route.request()
    let requestBody = null

    try {
      requestBody = request.postDataJSON()
    } catch {
      requestBody = request.postData()
    }

    const responseBody = await mockApi.reportDelivery?.({
      route,
      url: new URL(request.url()),
      method: request.method(),
      headers: request.headers(),
      body: requestBody,
      telegramUser,
    })

    if (responseBody !== undefined) {
      await fulfillJson(route, responseBody)
      return
    }

    await fulfillJson(route, { success: true })
  })

  await page.route('**/storage/v1/**', async (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())
    let requestBody = null

    try {
      requestBody = request.postDataJSON()
    } catch {
      requestBody = request.postData()
    }

    const responseBody = await mockApi.storage?.({
      route,
      url: requestUrl,
      method: request.method(),
      body: requestBody,
      telegramUser,
    })

    if (responseBody !== undefined) {
      await fulfillJson(route, responseBody)
      return
    }

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204 })
      return
    }

    const objectPath = requestUrl.pathname.split('/object/').at(-1) ?? 'attachment.bin'

    await fulfillJson(route, {
      Id: `e2e-storage-${Date.now()}`,
      Key: objectPath,
    })
  })

  await page.route('**/api/transactions**', async (route) => {
    const request = route.request()
    const requestUrl = new URL(route.request().url())
    const view = requestUrl.searchParams.get('view')
    const resource = requestUrl.searchParams.get('resource')
    let requestBody = null

    try {
      requestBody = request.postDataJSON()
    } catch {
      requestBody = request.postData()
    }

    const responseBody = await mockApi.transactions?.({
      route,
      url: requestUrl,
      method: request.method(),
      view,
      resource,
      body: requestBody,
      telegramUser,
    })

    if (responseBody !== undefined) {
      await fulfillJson(route, responseBody)
      return
    }

    const defaultResponseBody = (() => {
      if (view === 'summary') {
        return {
          success: true,
          summary: {
            total_income: 0,
            total_expense: 0,
            ending_balance: 0,
          },
        }
      }

      if (view === 'workspace') {
        return {
          success: true,
          workspaceTransactions: [],
          pageInfo: {
            hasMore: false,
            nextCursor: null,
            totalCount: 0,
          },
        }
      }

      if (view === 'history') {
        return {
          success: true,
          historyTransactions: [],
          pageInfo: {
            hasMore: false,
            nextCursor: null,
            totalCount: 0,
          },
        }
      }

      if (view === 'recycle-bin') {
        return {
          success: true,
          cashMutations: [],
          pageInfo: {
            hasMore: false,
            nextCursor: null,
            totalCount: 0,
          },
        }
      }

      return {
        success: true,
      }
    })()

    await fulfillJson(route, defaultResponseBody)
  })

  await page.route('**/api/records**', async (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())
    const resource = requestUrl.searchParams.get('resource')
    let requestBody = null

    try {
      requestBody = request.postDataJSON()
    } catch {
      requestBody = request.postData()
    }

    const responseBody = await mockApi.records?.({
      route,
      url: requestUrl,
      method: request.method(),
      resource,
      body: requestBody,
      telegramUser,
    })

    if (responseBody !== undefined) {
      await fulfillJson(route, responseBody)
      return
    }

    const defaultResponseBody = (() => {
      if (resource === 'bills') {
        return {
          success: true,
          bill: null,
          bills: [],
          payments: [],
        }
      }

      if (resource === 'attendance') {
        return {
          success: true,
          record: null,
          records: [],
          summary: null,
          bill: null,
          salaryBill: null,
        }
      }

      if (resource === 'expense-attachments') {
        return {
          success: true,
          attachments: [],
        }
      }

      if (resource === 'stock-overview') {
        return {
          success: true,
          materials: [],
          stockTransactions: [],
        }
      }

      if (resource === 'stock-project-options') {
        return {
          success: true,
          projects: [],
        }
      }

      if (resource === 'reports') {
        return createBusinessReportResponse()
      }

      return {
        success: true,
      }
    })()

    await fulfillJson(route, defaultResponseBody)
  })

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())
    let requestBody = null

    try {
      requestBody = request.postDataJSON()
    } catch {
      requestBody = request.postData()
    }

    const responseBody = await mockApi.supabase?.({
      route,
      url: requestUrl,
      method: request.method(),
      body: requestBody,
      telegramUser,
    })

    if (responseBody !== undefined) {
      await fulfillJson(route, responseBody)
      return
    }

    await fulfillJson(route, [])
  })

  if (options.telegram) {
    await stubTelegramWebApp(page, options.telegram)
  }

  await page.goto(withDevAuthBypass(path), { waitUntil: 'domcontentloaded' })

  await expect(
    page.getByRole('heading', { name: 'Sedang memuat workspace', exact: true })
  ).toBeHidden({
    timeout: 25000,
  })

  await expect(
    page.getByRole('heading', { name: 'Sedang memuat halaman', exact: true })
  ).toBeHidden({
    timeout: 120000,
  })
}

async function expectHeading(page, heading) {
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible({
    timeout: 15000,
  })
}

async function expectDashboardShell(page) {
  await expect(page.getByText('Halo,', { exact: false })).toBeVisible({
    timeout: 15000,
  })
  await expect(page.getByText('Saldo Kas', { exact: false })).toBeVisible({
    timeout: 15000,
  })
  await expect(page.getByRole('button', { name: 'Refresh dashboard' })).toBeVisible({
    timeout: 15000,
  })
}

export { expectDashboardShell, expectHeading, openApp }
