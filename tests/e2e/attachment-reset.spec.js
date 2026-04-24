import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'
import { openApp } from './helpers/app.js'

const samplePngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0B9b0AAAAASUVORK5CYII=',
  'base64'
)

const samplePdfBuffer = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n',
  'utf8'
)

function createDeferredUploadGate() {
  let releaseUpload = null

  const uploadGate = new Promise((resolve) => {
    releaseUpload = resolve
  })

  return {
    releaseUpload: () => {
      releaseUpload?.()
    },
    uploadGate,
  }
}

function createAttachmentSmokeMockApi(uploadGate) {
  const fileAssetsById = new Map()
  const attachmentsByExpenseId = new Map()
  let expenseSequence = 0
  let attachmentSequence = 0
  let fileAssetSequence = 0
  const timestamp = '2026-04-24T08:00:00.000Z'

  return {
    async supabase({ url, method, body }) {
      const tableName = url.pathname.split('/').filter(Boolean).at(-1)

      if (tableName === 'projects') {
        return [
          {
            id: 'project-e2e-1',
            name: 'Proyek Smoke',
            project_name: 'Proyek Smoke',
            project_type: 'Konstruksi',
            status: 'active',
            deleted_at: null,
            is_active: true,
          },
        ]
      }

      if (tableName === 'expense_categories') {
        return [
          {
            id: 'category-e2e-1',
            name: 'Operasional Umum',
            category_group: 'operational',
            deleted_at: null,
            is_active: true,
          },
        ]
      }

      if (tableName === 'suppliers') {
        return [
          {
            id: 'supplier-e2e-operational',
            name: 'Supplier Operasional',
            supplier_name: 'Supplier Operasional',
            supplier_type: 'Operasional',
            deleted_at: null,
            is_active: true,
          },
          {
            id: 'supplier-e2e-material',
            name: 'Supplier Material',
            supplier_name: 'Supplier Material',
            supplier_type: 'Material',
            deleted_at: null,
            is_active: true,
          },
        ]
      }

      if (tableName === 'materials') {
        return [
          {
            id: 'material-e2e-1',
            name: 'Baja Ringan',
            material_name: 'Baja Ringan',
            unit: 'pcs',
            current_stock: 24,
            category_name: 'Struktur',
            deleted_at: null,
            is_active: true,
          },
        ]
      }

      if (tableName === 'file_assets' && method === 'POST') {
        const fileAssetId = `file-asset-e2e-${++fileAssetSequence}`
        const fileAsset = {
          id: fileAssetId,
          team_id: body?.team_id ?? 'e2e-team',
          storage_bucket: body?.storage_bucket ?? body?.bucket_name ?? 'attachments',
          bucket_name: body?.bucket_name ?? body?.storage_bucket ?? 'attachments',
          storage_path: body?.storage_path ?? `attachments/${fileAssetId}`,
          original_name: body?.original_name ?? body?.file_name ?? 'attachment',
          file_name: body?.file_name ?? body?.original_name ?? 'attachment',
          public_url: body?.public_url ?? `https://cdn.e2e.local/${fileAssetId}`,
          mime_type: body?.mime_type ?? null,
          size_bytes: body?.size_bytes ?? body?.file_size ?? 0,
          file_size: body?.file_size ?? body?.size_bytes ?? 0,
          uploaded_by_user_id: body?.uploaded_by_user_id ?? null,
          uploaded_by: body?.uploaded_by ?? null,
          created_at: timestamp,
          updated_at: timestamp,
          deleted_at: null,
        }

        fileAssetsById.set(fileAssetId, fileAsset)

        return [fileAsset]
      }

      if (tableName === 'file_assets') {
        const fileAssetId = url.searchParams.get('id') ?? body?.id ?? null

        if (fileAssetId && fileAssetsById.has(fileAssetId)) {
          return [fileAssetsById.get(fileAssetId)]
        }

        return []
      }

      return []
    },
    async storage({ method, url }) {
      if (method === 'POST' || method === 'PUT') {
        await uploadGate
      }

      const objectPath = url.pathname.split('/object/').at(-1) ?? 'attachment.bin'

      return {
        Id: `storage-${objectPath.replace(/[^a-z0-9]+/gi, '-')}`,
        Key: objectPath,
      }
    },
    async records({ resource, method, body, url }) {
      if (resource === 'expenses' && method === 'POST') {
        const expenseId = `expense-e2e-${++expenseSequence}`

        return {
          success: true,
          expense: {
            id: expenseId,
            team_id: 'e2e-team',
            project_id: body?.project_id ?? null,
            project_name: body?.project_name ?? null,
            category_id: body?.category_id ?? null,
            category_name: body?.category_name ?? null,
            supplier_id: body?.supplier_id ?? null,
            supplier_name: body?.supplier_name ?? null,
            expense_type: body?.expense_type ?? 'operational',
            amount: Number(body?.amount ?? 0),
            total_amount: Number(body?.amount ?? 0),
            expense_date: body?.expense_date ?? null,
            status: body?.status ?? 'unpaid',
            description: body?.description ?? null,
            notes: body?.notes ?? null,
            created_at: timestamp,
            updated_at: timestamp,
            deleted_at: null,
            bill: null,
          },
        }
      }

      if (resource === 'material-invoices' && method === 'POST') {
        const expenseId = `material-invoice-e2e-${++expenseSequence}`
        const items = Array.isArray(body?.itemsData)
          ? body.itemsData.map((item, index) => ({
              id: item?.id ?? `material-line-e2e-${expenseId}-${index + 1}`,
              material_id: item?.material_id ?? null,
              item_name: item?.item_name ?? null,
              qty: item?.qty ?? null,
              unit_price: item?.unit_price ?? null,
              line_total: item?.line_total ?? null,
              sort_order: item?.sort_order ?? index + 1,
            }))
          : []
        const totalAmount = items.reduce(
          (sum, item) => sum + Number(item?.line_total ?? 0),
          0
        )

        return {
          success: true,
          expense: {
            id: expenseId,
            team_id: 'e2e-team',
            project_id: body?.headerData?.project_id ?? null,
            project_name: body?.headerData?.project_name ?? null,
            supplier_id: body?.headerData?.supplier_id ?? null,
            supplier_name: body?.headerData?.supplier_name ?? null,
            document_type: body?.headerData?.document_type ?? 'faktur',
            status: body?.headerData?.status ?? 'paid',
            expense_date: body?.headerData?.expense_date ?? null,
            description: body?.headerData?.description ?? null,
            expense_type: 'material',
            created_at: timestamp,
            updated_at: timestamp,
            deleted_at: null,
            bill: {
              id: `bill-e2e-${expenseId}`,
              status: body?.headerData?.status ?? 'paid',
              paid_amount: body?.headerData?.status === 'paid' ? totalAmount : 0,
              amount: totalAmount,
            },
          },
          items,
        }
      }

      if (resource === 'expense-attachments' && method === 'POST') {
        const expenseId = body?.expenseId ?? null
        const fileAsset = body?.fileAssetId ? fileAssetsById.get(body.fileAssetId) ?? null : null
        const attachment = {
          id: `attachment-e2e-${++attachmentSequence}`,
          expense_id: expenseId,
          file_asset_id: body?.fileAssetId ?? null,
          sort_order: Number(body?.sortOrder ?? body?.sort_order ?? 1),
          created_at: timestamp,
          updated_at: timestamp,
          deleted_at: null,
          file_assets: fileAsset,
          file_asset: fileAsset,
        }

        const existingAttachments = attachmentsByExpenseId.get(expenseId) ?? []
        attachmentsByExpenseId.set(expenseId, [...existingAttachments, attachment])

        return {
          success: true,
          attachment,
        }
      }

      if (resource === 'expense-attachments' && method === 'GET') {
        const expenseId = url.searchParams.get('expenseId')
        const includeDeleted = url.searchParams.get('includeDeleted') === 'true'
        const attachments = attachmentsByExpenseId.get(expenseId) ?? []

        return {
          success: true,
          attachments: includeDeleted
            ? attachments
            : attachments.filter((attachment) => !attachment.deleted_at),
        }
      }

      return undefined
    },
  }
}

function createAttachmentEditMockApi() {
  const baseMockApi = createAttachmentSmokeMockApi(Promise.resolve())
  const expenseEditId = 'expense-edit-e2e-1'
  const materialInvoiceEditId = 'material-invoice-edit-e2e-1'
  const timestamp = '2026-04-24T09:00:00.000Z'

  const expenseAttachmentFileAsset = {
    id: 'file-asset-edit-expense-1',
    team_id: 'e2e-team',
    storage_bucket: 'hrd_documents',
    bucket_name: 'hrd_documents',
    storage_path: 'expense/edit/expense-edit-e2e-1.png',
    original_name: 'expense-edit.png',
    file_name: 'expense-edit.png',
    public_url: 'https://cdn.e2e.local/expense-edit.png',
    mime_type: 'image/png',
    size_bytes: 512_000,
    file_size: 512_000,
    uploaded_by_user_id: '20002',
    uploaded_by: 'Playwright Tester',
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  }

  const expenseAttachment = {
    id: 'attachment-edit-expense-1',
    expense_id: expenseEditId,
    file_asset_id: expenseAttachmentFileAsset.id,
    sort_order: 1,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    file_assets: expenseAttachmentFileAsset,
    file_asset: expenseAttachmentFileAsset,
  }

  const materialInvoiceAttachmentFileAsset = {
    id: 'file-asset-edit-material-1',
    team_id: 'e2e-team',
    storage_bucket: 'hrd_documents',
    bucket_name: 'hrd_documents',
    storage_path: 'expense/edit/material-invoice-edit-e2e-1.pdf',
    original_name: 'material-invoice-edit.pdf',
    file_name: 'material-invoice-edit.pdf',
    public_url: 'https://cdn.e2e.local/material-invoice-edit.pdf',
    mime_type: 'application/pdf',
    size_bytes: 1_024_000,
    file_size: 1_024_000,
    uploaded_by_user_id: '20002',
    uploaded_by: 'Playwright Tester',
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  }

  const materialInvoiceItems = [
    {
      id: 'material-line-edit-1',
      material_id: 'material-e2e-1',
      item_name: 'Baja Ringan',
      qty: 4,
      unit_price: 125_000,
      line_total: 500_000,
      sort_order: 1,
    },
  ]

  const materialInvoiceAttachment = {
    id: 'attachment-edit-material-1',
    expense_id: materialInvoiceEditId,
    file_asset_id: materialInvoiceAttachmentFileAsset.id,
    sort_order: 1,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    file_assets: materialInvoiceAttachmentFileAsset,
    file_asset: materialInvoiceAttachmentFileAsset,
  }

  const expenseRecord = {
    id: expenseEditId,
    team_id: 'e2e-team',
    project_id: 'project-e2e-1',
    project_name: 'Proyek Smoke',
    category_id: 'category-e2e-1',
    category_name: 'Operasional Umum',
    supplier_id: 'supplier-e2e-operational',
    supplier_name: 'Supplier Operasional',
    expense_type: 'operational',
    amount: 125_000,
    total_amount: 125_000,
    expense_date: '2026-04-24',
    status: 'paid',
    description: 'Pengeluaran edit smoke',
    notes: 'Lampiran edit expense',
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    bill: null,
  }

  const materialInvoiceRecord = {
    id: materialInvoiceEditId,
    team_id: 'e2e-team',
    project_id: 'project-e2e-1',
    project_name: 'Proyek Smoke',
    supplier_id: 'supplier-e2e-material',
    supplier_name: 'Supplier Material',
    document_type: 'faktur',
    status: 'unpaid',
    expense_date: '2026-04-24',
    description: 'Faktur material edit smoke',
    expense_type: 'material',
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    bill: {
      id: 'bill-edit-material-1',
      status: 'unpaid',
      paid_amount: 0,
      amount: 500_000,
      remaining_amount: 500_000,
      payments: [],
    },
    items: materialInvoiceItems,
  }

  const attachmentsByExpenseId = new Map([
    [expenseEditId, [expenseAttachment]],
    [materialInvoiceEditId, [materialInvoiceAttachment]],
  ])

  const recordsByExpenseId = new Map([
    [expenseEditId, expenseRecord],
    [materialInvoiceEditId, materialInvoiceRecord],
  ])

  return {
    ...baseMockApi,
    expenseEditId,
    materialInvoiceEditId,
    async records({ resource, method, body, url }) {
      const expenseId = url.searchParams.get('expenseId') ?? body?.expenseId ?? body?.id ?? null

      if (resource === 'expense-attachments' && method === 'GET' && expenseId) {
        return {
          success: true,
          attachments: attachmentsByExpenseId.get(expenseId) ?? [],
        }
      }

      if (resource === 'material-invoices' && method === 'GET' && expenseId) {
        const record = recordsByExpenseId.get(expenseId) ?? null

        if (record) {
          return {
            success: true,
            expense: record,
            items: record.items ?? [],
          }
        }
      }

      if (resource === 'expenses' && method === 'PATCH' && body?.id === expenseEditId) {
        return {
          success: true,
          expense: expenseRecord,
        }
      }

      if (
        resource === 'material-invoices' &&
        method === 'PATCH' &&
        body?.expenseId === materialInvoiceEditId
      ) {
        return {
          success: true,
          expense: materialInvoiceRecord,
          items: materialInvoiceItems,
        }
      }

      return baseMockApi.records({ resource, method, body, url })
    },
  }
}

async function selectMasterOption(page, buttonName, dialogName, optionName) {
  await page.getByRole('button', { name: buttonName }).click()

  const dialog = page.getByRole('dialog', { name: dialogName })
  await expect(dialog).toBeVisible({ timeout: 15000 })

  await dialog.getByRole('button', { name: optionName }).click()
}

test.describe.configure({ timeout: 180_000 })

test.describe('attachment reset smoke', () => {
  test('keeps expense attachment draft pending until upload sync settles, then resets blank', async ({
    page,
  }) => {
    const { releaseUpload, uploadGate } = createDeferredUploadGate()
    const mockApi = createAttachmentSmokeMockApi(uploadGate)

    await openApp(page, '/edit/expense/new', {
      mockApi,
    })

    await selectMasterOption(page, /Pilih proyek/i, 'Pilih Proyek', 'Proyek Smoke')
    await selectMasterOption(page, /Pilih kategori/i, 'Pilih Kategori', 'Operasional Umum')
    await selectMasterOption(page, /Pilih supplier/i, 'Pilih Supplier', 'Supplier Operasional')

    await page.locator('input[placeholder="Rp 0"]').first().fill('125000')
    await page
      .getByPlaceholder('Contoh: Pembelian alat kerja lapangan.')
      .fill('Pengeluaran smoke dengan lampiran gambar.')
    await page.getByPlaceholder('Catatan tambahan opsional.').fill('Lampiran smoke expense')

    await page.locator('input[type="file"]').setInputFiles({
      name: 'expense-attachment.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    })

    await expect(page.getByText('Menunggu simpan form')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('img', { name: 'expense-attachment.png' })).toBeVisible({
      timeout: 15000,
    })

    const saveResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'POST' &&
        response.url().includes('resource=expenses')
      )
    })

    await page.getByRole('button', { name: /Simpan Pengeluaran/i }).click()
    await saveResponsePromise

    await expect(page.getByText('Menunggu simpan form')).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'expense-attachment.png' })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: /Simpan Pengeluaran/i })).toBeDisabled()

    releaseUpload()

    await expect(page.getByRole('button', { name: /Pilih proyek/i })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: /Pilih kategori/i })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByRole('button', { name: /Pilih supplier/i })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText('Menunggu simpan form')).toHaveCount(0)
    await expect(page.getByText('expense-attachment.png')).toHaveCount(0)
    await expect(page.getByRole('img', { name: 'expense-attachment.png' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Simpan Pengeluaran/i })).toBeEnabled()
  })

  test('keeps material invoice attachment draft pending until upload sync settles, then closes', async ({
    page,
  }) => {
    const { releaseUpload, uploadGate } = createDeferredUploadGate()
    const mockApi = createAttachmentSmokeMockApi(uploadGate)

    await openApp(page, '/material-invoice/new', {
      mockApi,
    })

    await selectMasterOption(page, /Pilih proyek/i, 'Pilih Proyek', 'Proyek Smoke')
    await selectMasterOption(page, /Pilih supplier material/i, 'Pilih Supplier Material', 'Supplier Material')
    await selectMasterOption(page, /Pilih material 1/i, 'Pilih Material 1', 'Baja Ringan')

    await page.locator('input[placeholder="0"]').first().fill('12')
    await page.locator('input[placeholder="Rp 0"]').first().fill('75000')
    await page
      .getByPlaceholder('Tambahkan konteks singkat untuk invoice material ini.')
      .fill('Faktur material smoke dengan PDF.')

    await page.locator('input[type="file"]').setInputFiles({
      name: 'material-invoice.pdf',
      mimeType: 'application/pdf',
      buffer: samplePdfBuffer,
    })

    await expect(page.getByText('Menunggu simpan form')).toBeVisible({ timeout: 15000 })

    const saveResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'POST' &&
        response.url().includes('resource=material-invoices')
      )
    })

    await page.getByRole('button', { name: /Simpan Faktur Material/i }).click()
    await saveResponsePromise

    await expect(page).toHaveURL(/\/material-invoice\/new(?:\?.*)?$/)
    await expect(page.getByText('Menunggu simpan form')).toHaveCount(0)
    await expect(page.getByText('material-invoice.pdf')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: /Simpan Faktur Material/i })).toBeDisabled()

    releaseUpload()

    await expect(page).toHaveURL(/\/transactions(?:\?.*)?$/, { timeout: 15000 })
    await expect(page.getByRole('heading', { name: 'Jurnal', exact: true })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText('material-invoice.pdf')).toHaveCount(0)
  })

  test('keeps expense attachment preview visible after edit save', async ({ page }) => {
    const mockApi = createAttachmentEditMockApi()

    await openApp(page, `/edit/expense/${mockApi.expenseEditId}`, {
      mockApi,
    })

    await expect(page.getByText('expense-edit.png')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('img', { name: 'expense-edit.png' })).toBeVisible({
      timeout: 15000,
    })

    const saveResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'PATCH' &&
        response.url().includes('/api/records') &&
        response.url().includes('resource=expenses')
      )
    })

    await page.getByRole('button', { name: /Perbarui Pengeluaran/i }).click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBeTruthy()

    await expect(page.getByText('expense-edit.png')).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('img', { name: 'expense-edit.png' })).toBeVisible({
      timeout: 15000,
    })
  })

  test('keeps material invoice attachment preview visible through edit save', async ({
    page,
  }) => {
    const mockApi = createAttachmentEditMockApi()

    await openApp(page, `/edit/expense/${mockApi.materialInvoiceEditId}`, {
      mockApi,
    })

    await expect(page.getByText('material-invoice-edit.pdf')).toBeVisible({
      timeout: 15000,
    })

    const saveResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === 'PATCH' &&
        response.url().includes('/api/records') &&
        response.url().includes('resource=material-invoices')
      )
    })

    await page.getByRole('button', { name: /Perbarui Faktur Material/i }).click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBeTruthy()

    await expect(page).toHaveURL(/\/transactions(?:\?.*)?$/, { timeout: 15000 })
  })
})
