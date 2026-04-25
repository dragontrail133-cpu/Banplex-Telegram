import { expect, test } from '@playwright/test'
import { expectHeading, openApp } from './helpers/app.js'

test.describe.configure({ timeout: 240_000 })

function createHrdAndBeneficiaryMock() {
  const applicant = {
    id: 'hrd-e2e-1',
    team_id: 'e2e-team',
    name: 'Ayu Wulandari',
    nama_lengkap: 'Ayu Wulandari',
    position: 'Operator Administrasi',
    posisi_dilamar: 'Operator Administrasi',
    status_aplikasi: 'screening',
    email: 'ayu@example.com',
    no_telepon: '081234567890',
    nik: '3201012304000001',
    sumber_lowongan: 'Website',
    created_at: '2026-04-24T08:00:00.000Z',
    updated_at: '2026-04-24T08:00:00.000Z',
  }

  const beneficiary = {
    id: 'benef-e2e-1',
    team_id: 'e2e-team',
    name: 'Rani Putri',
    nama_penerima: 'Rani Putri',
    institution: 'SD E2E',
    nama_instansi: 'SD E2E',
    nik: '3201012304000002',
    jenjang: 'SD',
    status: 'active',
    data_status: 'Valid',
    created_at: '2026-04-24T09:00:00.000Z',
    updated_at: '2026-04-24T09:00:00.000Z',
  }

  return {
    applicant,
    beneficiary,
    supabase: async ({ method, url }) => {
      if (url.pathname.includes('/hrd_applicants')) {
        if (method === 'GET') {
          return [applicant]
        }

        if (method === 'PATCH' || method === 'DELETE') {
          return []
        }
      }

      if (url.pathname.includes('/hrd_applicant_documents')) {
        if (method === 'GET') {
          return []
        }

        if (method === 'PATCH' || method === 'DELETE' || method === 'POST') {
          return []
        }
      }

      if (url.pathname.includes('/beneficiaries')) {
        if (method === 'GET') {
          return [beneficiary]
        }

        if (method === 'PATCH' || method === 'DELETE') {
          return []
        }
      }

      return undefined
    },
  }
}

function createBeneficiaryReportMock() {
  const beneficiaries = [
    {
      id: 'benef-e2e-1',
      team_id: 'e2e-team',
      name: 'Rani Putri',
      nama_penerima: 'Rani Putri',
      institution: 'SD E2E',
      nama_instansi: 'SD E2E',
      nik: '3201012304000002',
      jenjang: 'SD',
      status: 'active',
      data_status: 'Valid',
      created_at: '2026-04-24T09:00:00.000Z',
      updated_at: '2026-04-24T09:00:00.000Z',
    },
    {
      id: 'benef-e2e-2',
      team_id: 'e2e-team',
      name: 'Sari Dewi',
      nama_penerima: 'Sari Dewi',
      institution: 'TK E2E',
      nama_instansi: 'TK E2E',
      nik: '3201012304000003',
      jenjang: 'TK',
      status: 'pending',
      data_status: 'Requires verification',
      created_at: '2026-04-24T10:00:00.000Z',
      updated_at: '2026-04-24T10:00:00.000Z',
    },
  ]

  return {
    beneficiaries,
    supabase: async ({ method, url }) => {
      if (url.pathname.includes('/beneficiaries')) {
        if (method === 'GET') {
          return beneficiaries
        }

        if (method === 'PATCH' || method === 'DELETE') {
          return []
        }
      }

      return undefined
    },
  }
}

test.describe('HRD and beneficiary row sheets', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('keeps CSV import sheet closed on initial load and can close it', async ({ page }) => {
    const mockData = createHrdAndBeneficiaryMock()

    await openApp(page, '/more/hrd', {
      mockApi: {
        supabase: mockData.supabase,
      },
    })

    await expectHeading(page, 'HRD & Rekrutmen')
    await expect(page.getByRole('dialog', { name: 'Impor CSV HRD' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Impor CSV' }).click()

    const importSheet = page.getByRole('dialog', { name: 'Impor CSV HRD' })
    await expect(importSheet).toBeVisible()

    await importSheet.getByRole('button', { name: 'Tutup' }).click()
    await expect(page.getByRole('dialog', { name: 'Impor CSV HRD' })).toHaveCount(0)
  })

  test('opens HRD actions from the row card', async ({ page }) => {
    const mockData = createHrdAndBeneficiaryMock()

    await openApp(page, '/more/hrd', {
      mockApi: {
        supabase: mockData.supabase,
      },
    })

    await expectHeading(page, 'HRD & Rekrutmen')

    await page.getByRole('button', { name: `Buka detail pelamar ${mockData.applicant.name}` }).click()

    const detailSheet = page.getByRole('dialog', { name: mockData.applicant.name })
    await expect(detailSheet).toBeVisible()
    await expect(detailSheet.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(detailSheet.getByRole('button', { name: 'Hapus' })).toBeVisible()

    await detailSheet.getByRole('button', { name: 'Edit' }).click()

    await expect(page).toHaveURL(new RegExp(`/more/hrd/${mockData.applicant.id}/edit$`))
    await expectHeading(page, 'Edit Pelamar')
  })

  test('sends applicant PDF by selected status to telegram DM', async ({ page }) => {
    const mockData = createHrdAndBeneficiaryMock()
    let reportDeliveryBody = null

    await openApp(page, '/more/hrd', {
      mockApi: {
        supabase: mockData.supabase,
        reportDelivery: async ({ body }) => {
          reportDeliveryBody = body

          return {
            success: true,
            deliveryMode: 'document',
            telegramStatus: 200,
            telegramResponse: {
              ok: true,
            },
            fileName: 'laporan-pelamar-status-screening-20260424.pdf',
            pdfError: null,
          }
        },
      },
    })

    await expectHeading(page, 'HRD & Rekrutmen')

    await page.getByRole('button', { name: /Semua/i }).click()
    const statusSheet = page.getByRole('dialog', { name: 'Status Aplikasi' })
    await expect(statusSheet).toBeVisible()
    await statusSheet.getByRole('button', { name: 'Screening' }).click()

    await page.getByRole('button', { name: 'Kirim' }).click()

    await expect.poll(() => reportDeliveryBody?.reportData?.reportKind).toBe('applicant_statement')
    await expect.poll(() => reportDeliveryBody?.reportData?.groupValue).toBe('Screening')
    await expect.poll(() => reportDeliveryBody?.reportData?.rows?.length).toBe(1)
    await expect.poll(() => reportDeliveryBody?.reportData?.summary?.total_applicants).toBe(1)
  })

  test('opens beneficiary actions from the row card and deletes the record', async ({ page }) => {
    const mockData = createHrdAndBeneficiaryMock()

    await openApp(page, '/more/beneficiaries', {
      mockApi: {
        supabase: mockData.supabase,
      },
    })

    await expectHeading(page, 'Penerima Manfaat')

    await page.getByRole('button', { name: `Buka detail penerima ${mockData.beneficiary.name}` }).click()

    const detailSheet = page.getByRole('dialog', { name: mockData.beneficiary.name })
    await expect(detailSheet).toBeVisible()
    await expect(detailSheet.getByRole('button', { name: 'Edit' })).toBeVisible()
    await expect(detailSheet.getByRole('button', { name: 'Hapus' })).toBeVisible()

    page.once('dialog', (dialog) => dialog.accept())
    await detailSheet.getByRole('button', { name: 'Hapus' }).click()

    await expect(page.getByRole('dialog', { name: mockData.beneficiary.name })).toHaveCount(0)
    await expect(page.getByRole('button', { name: `Buka detail penerima ${mockData.beneficiary.name}` })).toHaveCount(0)
    await expect(page.getByText('Belum ada penerima manfaat')).toBeVisible()
  })

  test('sends beneficiary PDF by selected institution to telegram DM', async ({ page }) => {
    const mockData = createBeneficiaryReportMock()
    let reportDeliveryBody = null

    await openApp(page, '/more/beneficiaries', {
      mockApi: {
        supabase: mockData.supabase,
        reportDelivery: async ({ body }) => {
          reportDeliveryBody = body

          return {
            success: true,
            deliveryMode: 'document',
            telegramStatus: 200,
            telegramResponse: {
              ok: true,
            },
            fileName: 'laporan-penerima-instansi-sd-e2e-20260424.pdf',
            pdfError: null,
          }
        },
      },
    })

    await expectHeading(page, 'Penerima Manfaat')

    await page.getByRole('button', { name: /Semua instansi/i }).click()
    const institutionSheet = page.getByRole('dialog', { name: 'Instansi' })
    await expect(institutionSheet).toBeVisible()
    await institutionSheet.getByRole('button', { name: 'SD E2E' }).click()

    await page.getByRole('button', { name: 'Kirim' }).click()

    await expect.poll(() => reportDeliveryBody?.reportData?.reportKind).toBe('beneficiary_statement')
    await expect.poll(() => reportDeliveryBody?.reportData?.groupValue).toBe('SD E2E')
    await expect.poll(() => reportDeliveryBody?.reportData?.rows?.length).toBe(1)
    await expect.poll(() => reportDeliveryBody?.reportData?.summary?.total_beneficiaries).toBe(1)
  })

  test('keeps CSV import sheet closed on initial load and can close it for beneficiaries', async ({
    page,
  }) => {
    const mockData = createHrdAndBeneficiaryMock()

    await openApp(page, '/more/beneficiaries', {
      mockApi: {
        supabase: mockData.supabase,
      },
    })

    await expectHeading(page, 'Penerima Manfaat')
    await expect(page.getByRole('dialog', { name: 'Impor CSV Penerima' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Impor CSV' }).click()

    const importSheet = page.getByRole('dialog', { name: 'Impor CSV Penerima' })
    await expect(importSheet).toBeVisible()

    await importSheet.getByRole('button', { name: 'Tutup' }).click()
    await expect(page.getByRole('dialog', { name: 'Impor CSV Penerima' })).toHaveCount(0)
  })
})
