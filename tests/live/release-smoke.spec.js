import { expect, test } from '@playwright/test'
import { dismissToastIfVisible, expectDashboardReady, openLiveApp } from './helpers/live-app.js'
import { createLiveSmokeArtifact } from './helpers/live-artifacts.js'

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function parseJsonResponse(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function normalizeInsertedRecord(payload) {
  if (Array.isArray(payload)) {
    return payload[0] ?? null
  }

  return payload ?? null
}

test.describe('live release smoke', () => {
  test.describe.configure({ mode: 'serial' })

  test('proves real auth, master write, loan write, and team invite write', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(240000)

    const artifact = await createLiveSmokeArtifact({ baseURL })
    const creditorName = `${artifact.smokePrefix} Kreditur`
    const creditorNotes = `${artifact.smokePrefix} master creditor`
    const loanNotes = `${artifact.smokePrefix} loan smoke`

    await artifact.addStep('open_dashboard')
    await openLiveApp(page, '/')
    await expectDashboardReady(page)

    await artifact.addStep('open_transactions')
    await openLiveApp(page, '/transactions')
    await expect(page).toHaveURL(/\/transactions(?:\?.*)?$/)
    await expect(page.getByRole('button', { name: 'Buka filter Jurnal' })).toBeVisible({
      timeout: 20000,
    })

    await artifact.addStep('open_payroll')
    await openLiveApp(page, '/payroll')
    await expect(page.getByRole('heading', { name: 'Catatan Absensi' })).toBeVisible({
      timeout: 20000,
    })

    await artifact.addStep('open_master')
    await openLiveApp(page, '/master')
    await expect(page.getByRole('heading', { name: 'Master' })).toBeVisible({
      timeout: 20000,
    })

    await artifact.addStep('create_funding_creditor')
    await openLiveApp(page, '/master/creditor/add')
    await expect(page).toHaveURL(/\/master\/creditor\/add(?:\?.*)?$/)

    const creditorResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'POST' &&
        response.url().includes('/rest/v1/funding_creditors')
      )
    })

    await page.getByPlaceholder('Contoh: Pak Hendra').fill(creditorName)
    await page.getByPlaceholder('Catatan kreditur jika diperlukan.').fill(creditorNotes)
    await page.getByRole('button', { name: 'Tambah Kreditur' }).click()

    const creditorResponse = await creditorResponsePromise
    expect(creditorResponse.ok()).toBeTruthy()

    const creditor = normalizeInsertedRecord(await parseJsonResponse(creditorResponse))
    expect(creditor?.id).toBeTruthy()

    await artifact.record('funding_creditor', {
      id: creditor.id,
      team_id: creditor.team_id ?? null,
      name: creditor.name ?? null,
      notes: creditor.notes ?? null,
      created_at: creditor.created_at ?? null,
    })

    await expect(page).toHaveURL(/\/master(?:\?.*)?$/)

    await artifact.addStep('create_loan')
    await openLiveApp(page, '/edit/loan/new')
    await expect(page).toHaveURL(/\/edit\/loan\/new(?:\?.*)?$/)
    await expect(page.getByRole('button', { name: /Pilih kreditur/i })).toBeVisible({
      timeout: 20000,
    })

    await page.getByRole('button', { name: /Pilih kreditur/i }).click()
    await page.getByPlaceholder('Cari kreditur...').fill(creditorName)
    await page.getByRole('button', { name: new RegExp(escapeRegExp(creditorName), 'i') }).click()
    await page.locator('input[placeholder="Rp 0"]').first().fill('123456')
    await page.getByText('Catatan opsional').click()
    await page
      .getByPlaceholder('Contoh: Dana talangan untuk pembelian material.')
      .fill(loanNotes)

    const loanResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'POST' &&
        response.url().includes('/api/transactions')
      )
    })

    await page.getByRole('button', { name: 'Simpan Pinjaman' }).click()

    const loanResponse = await loanResponsePromise
    expect(loanResponse.ok()).toBeTruthy()

    const loanPayload = await parseJsonResponse(loanResponse)
    const loan = loanPayload?.record ?? null
    expect(loan?.id).toBeTruthy()

    await artifact.record('loan', {
      id: loan.id,
      team_id: loan.team_id ?? null,
      creditor_id: loan.creditor_id ?? null,
      principal_amount: loan.principal_amount ?? null,
      repayment_amount: loan.repayment_amount ?? null,
      status: loan.status ?? null,
      notes: loan.notes ?? null,
      created_at: loan.created_at ?? null,
    })

    await expect(page.getByText('Pinjaman tersimpan')).toBeVisible({
      timeout: 20000,
    })
    await expect(page.getByText('Data pinjaman berhasil dicatat.')).toBeVisible({
      timeout: 20000,
    })
    await dismissToastIfVisible(page)

    await artifact.addStep('create_team_invite')
    await openLiveApp(page, '/more/team-invite')
    await expect(page).toHaveURL(/\/more\/team-invite(?:\?.*)?$/)
    await expect(page.getByText('Magic Invite Link')).toBeVisible({
      timeout: 20000,
    })

    const inviteResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'POST' &&
        response.url().includes('/rest/v1/invite_tokens')
      )
    })

    await page.getByRole('button', { name: 'Buat Link Undangan' }).click()

    const inviteResponse = await inviteResponsePromise
    expect(inviteResponse.ok()).toBeTruthy()

    const invite = normalizeInsertedRecord(await parseJsonResponse(inviteResponse))
    expect(invite?.id).toBeTruthy()

    await expect(page.getByText('Link terbaru')).toBeVisible({
      timeout: 20000,
    })

    const inviteLinkText = (
      await page.getByText(/https:\/\/t\.me\/.+startapp=inv_/).first().textContent()
    )?.trim()

    await artifact.record('invite_token', {
      id: invite.id,
      team_id: invite.team_id ?? null,
      role: invite.role ?? null,
      token: invite.token ?? null,
      expires_at: invite.expires_at ?? null,
      created_at: invite.created_at ?? null,
      invite_link: inviteLinkText ?? null,
    })

    await artifact.addStep('completed', {
      status: 'ready_for_verification',
      artifact_path: artifact.artifactPath,
    })
  })
})
