import { expect, test } from '@playwright/test'
import { openApp } from './helpers/app.js'

test.describe.configure({ timeout: 180_000 })

function createProjectIncomeFormMockSupabase(url) {
  const tableName = url.pathname.split('/').filter(Boolean).at(-1)

  if (tableName === 'projects') {
    return [
      {
        id: 'project-e2e-1',
        name: 'Proyek E2E',
        project_name: 'Proyek E2E',
        status: 'active',
      },
    ]
  }

  return []
}

function createLoanEditRecord(overrides = {}) {
  const transactionDate = overrides.transaction_date ?? '2026-04-26'
  const principalAmount = Number(overrides.principal_amount ?? 1_250_000)
  const repaymentAmount = Number(overrides.repayment_amount ?? 1_400_000)
  const interestRate = Number(overrides.interest_rate ?? 2)
  const tenorMonths = Number(overrides.tenor_months ?? 6)
  const lateInterestRate = Number(overrides.late_interest_rate ?? 1.5)
  const latePenaltyAmount = Number(overrides.late_penalty_amount ?? 25_000)
  const creditorName = overrides.creditor_name_snapshot ?? 'Bank E2E'

  return {
    id: overrides.id ?? 'loan-e2e-1',
    team_id: overrides.team_id ?? 'e2e-team',
    creditor_id: overrides.creditor_id ?? 'creditor-e2e-1',
    transaction_date: transactionDate,
    disbursed_date: overrides.disbursed_date ?? transactionDate,
    principal_amount: principalAmount,
    repayment_amount: repaymentAmount,
    interest_type: overrides.interest_type ?? 'interest',
    interest_rate: interestRate,
    tenor_months: tenorMonths,
    late_interest_rate: lateInterestRate,
    late_interest_basis: overrides.late_interest_basis ?? 'remaining',
    late_penalty_type: overrides.late_penalty_type ?? 'flat',
    late_penalty_amount: latePenaltyAmount,
    amount: Number(overrides.amount ?? principalAmount),
    description: overrides.description ?? 'Pinjaman E2E',
    notes: overrides.notes ?? 'Catatan pinjaman E2E',
    creditor_name_snapshot: creditorName,
    status: overrides.status ?? 'unpaid',
    paid_amount: Number(overrides.paid_amount ?? 0),
    created_at: overrides.created_at ?? '2026-04-26T08:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-04-26T08:00:00.000Z',
    deleted_at: overrides.deleted_at ?? null,
    loan_terms_snapshot: {
      principal_amount: principalAmount,
      amount: Number(overrides.amount ?? principalAmount),
      repayment_amount: repaymentAmount,
      interest_type: overrides.interest_type ?? 'interest',
      interest_rate: interestRate,
      tenor_months: tenorMonths,
      transaction_date: transactionDate,
      disbursed_date: overrides.disbursed_date ?? transactionDate,
      late_interest_rate: lateInterestRate,
      late_interest_basis: overrides.late_interest_basis ?? 'remaining',
      late_penalty_type: overrides.late_penalty_type ?? 'flat',
      late_penalty_amount: latePenaltyAmount,
      creditor_name_snapshot: creditorName,
    },
  }
}

function createLoanEditRouteStateSummary(overrides = {}) {
  return {
    id: overrides.id ?? 'loan-e2e-1',
    sourceType: 'loan-disbursement',
    type: 'loan',
    amount: overrides.amount ?? 1_250_000,
    description: overrides.description ?? 'Pinjaman ringkas E2E',
    created_at: overrides.created_at ?? '2026-04-26T08:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-04-26T08:00:00.000Z',
  }
}

function createDeferred() {
  let resolve
  let reject

  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return {
    promise,
    resolve,
    reject,
  }
}

function createLoanEditMockApi({
  fundingCreditors = [
    {
      id: 'creditor-e2e-1',
      creditor_name: 'Bank E2E',
      name: 'Bank E2E',
      notes: 'Kreditur E2E',
      deleted_at: null,
      team_id: 'e2e-team',
    },
  ],
  loanResponse = [createLoanEditRecord()],
} = {}) {
  return {
    supabase: async ({ url }) => {
      const tableName = url.pathname.split('/').filter(Boolean).at(-1)

      if (tableName === 'funding_creditors') {
        return fundingCreditors
      }

      if (tableName === 'loans') {
        return loanResponse
      }

      return []
    },
  }
}

test.describe('edit surfaces', () => {
  test('opens record editor shell', async ({ page }) => {
    await openApp(page, '/edit/expense/sample-expense-id')
    await expect(page.getByRole('heading', { name: /Edit / })).toBeVisible()
  })

  test('saves project income from the new form', async ({ page }) => {
    await openApp(page, '/edit/project-income/new', {
      mockApi: {
        transactions: async ({ method, body }) => {
          if (method === 'POST' && body?.recordType === 'project-income') {
            return {
              success: true,
              record: {
                id: 'project-income-e2e-1',
                ...body,
              },
            }
          }

          return undefined
        },
        supabase: async ({ url }) => createProjectIncomeFormMockSupabase(url),
      },
    })

    await expect(page.getByRole('button', { name: /Pilih proyek/i })).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole('button', { name: /Pilih proyek/i }).click()
    const projectDialog = page.getByRole('dialog', { name: 'Pilih Proyek' })
    await expect(projectDialog).toBeVisible({ timeout: 15000 })

    const projectOption = projectDialog.locator('button').filter({ hasText: 'Proyek E2E' }).first()
    await expect(projectOption).toBeVisible({ timeout: 15000 })
    await projectOption.click()

    await page.locator('input[placeholder="Rp 0"]').first().fill('125000')
    await page
      .getByPlaceholder('Contoh: Termin 1 pekerjaan struktur.')
      .fill('Termin E2E')

    const saveRequestPromise = page.waitForResponse((response) => {
      return response.request().method() === 'POST' && response.url().includes('/api/transactions')
    })

    await page.getByRole('button', { name: 'Simpan Termin Proyek' }).click()

    const saveResponse = await saveRequestPromise
    expect(saveResponse.ok()).toBeTruthy()
    await expect(page.getByText('Pemasukan proyek tersimpan')).toBeVisible({
      timeout: 15000,
    })
  })

  test('hydrates loan edit form from canonical record even when route state is sparse', async ({
    page,
  }) => {
    const loanSummary = createLoanEditRouteStateSummary()

    await page.addInitScript((summary) => {
      if (!window.location.pathname.startsWith('/edit/loan/')) {
        return
      }

      window.history.replaceState(
        {
          usr: {
            item: summary,
          },
          key: 'loan-edit-e2e',
          idx: 0,
        },
        '',
        window.location.href
      )
    }, loanSummary)

    await openApp(page, '/edit/loan/loan-e2e-1', {
      mockApi: createLoanEditMockApi(),
    })

    await expect(page.getByRole('heading', { name: 'Edit Pinjaman' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.locator('input[name="creditorId"]')).toHaveValue('creditor-e2e-1')
    await expect(page.locator('input[name="date"]')).toHaveValue('2026-04-26')
    await expect(page.locator('input[name="principalAmount"]')).toHaveValue('1.250.000')
    await expect(page.locator('input[name="repaymentAmount"]')).toHaveValue('1.400.000')
    await expect(page.locator('input[name="interestRate"]')).toHaveValue('2')
    await expect(page.locator('input[name="tenorMonths"]')).toHaveValue('6')
  })

  test('keeps the loan loading shell inside the viewport safe zone', async ({ page }) => {
    const loanSummary = createLoanEditRouteStateSummary()
    const loanDeferred = createDeferred()

    await page.addInitScript((summary) => {
      if (!window.location.pathname.startsWith('/edit/loan/')) {
        return
      }

      window.history.replaceState(
        {
          usr: {
            item: summary,
          },
          key: 'loan-loading-e2e',
          idx: 0,
        },
        '',
        window.location.href
      )
    }, loanSummary)

    await openApp(page, '/edit/loan/loan-loading-e2e', {
      mockApi: createLoanEditMockApi({
        loanResponse: loanDeferred.promise,
      }),
    })

    const loadingHeading = page.getByRole('heading', { name: 'Memuat Pinjaman' })
    await expect(loadingHeading).toBeVisible({ timeout: 15000 })

    const loadingSafeArea = page
      .locator('div[class*="safe-area-inset-left"]')
      .filter({ has: loadingHeading })
      .first()

    await expect(loadingSafeArea).toBeVisible({ timeout: 15000 })
    await expect(loadingSafeArea).toContainText('Memuat Pinjaman')
    const paddingLeft = Number.parseFloat(
      await loadingSafeArea.evaluate((element) => getComputedStyle(element).paddingLeft)
    )

    expect(paddingLeft).toBeGreaterThan(4)

    loanDeferred.resolve([createLoanEditRecord({ id: 'loan-loading-e2e' })])

    await expect(page.getByRole('heading', { name: 'Edit Pinjaman' })).toBeVisible({
      timeout: 15000,
    })
  })
})
