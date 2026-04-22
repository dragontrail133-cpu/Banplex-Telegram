import { createClient } from '@supabase/supabase-js'
import {
  ATTACHMENT_ROLE_MATRIX,
  getAttachmentPermissions,
} from '../src/lib/attachment-permissions.js'
import { assertCapabilityAccess } from '../src/lib/capabilities.js'
import { nowMs } from '../src/lib/timing.js'

const attendanceSelectColumns =
  'id, telegram_user_id, team_id, worker_id, project_id, attendance_date, attendance_status, total_pay, overtime_fee, entry_mode, billing_status, salary_bill_id, notes, worker_name_snapshot, project_name_snapshot, created_at, updated_at, deleted_at, workers:worker_id ( id, name ), projects:project_id ( id, name )'
const attendanceSelectColumnsWithoutOvertimeFee =
  'id, telegram_user_id, team_id, worker_id, project_id, attendance_date, attendance_status, total_pay, entry_mode, billing_status, salary_bill_id, notes, worker_name_snapshot, project_name_snapshot, created_at, updated_at, deleted_at, workers:worker_id ( id, name ), projects:project_id ( id, name )'
const attendanceHistorySummaryColumns =
  'id, team_id, worker_id, project_id, attendance_date, attendance_status, total_pay, overtime_fee, billing_status, salary_bill_id, worker_name_snapshot, project_name_snapshot, created_at'
const attendanceHistorySummaryColumnsWithoutOvertimeFee =
  'id, team_id, worker_id, project_id, attendance_date, attendance_status, total_pay, billing_status, salary_bill_id, worker_name_snapshot, project_name_snapshot, created_at'
const attendanceDetailSelectColumns =
  'id, telegram_user_id, team_id, worker_id, project_id, attendance_date, attendance_status, total_pay, overtime_fee, entry_mode, billing_status, salary_bill_id, notes, worker_name_snapshot, project_name_snapshot, created_at, updated_at, deleted_at, workers:worker_id ( id, name ), projects:project_id ( id, name ), salary_bill:salary_bill_id ( id, bill_type, amount, paid_amount, due_date, status, paid_at, description, deleted_at )'
const attendanceDetailSelectColumnsWithoutOvertimeFee =
  'id, telegram_user_id, team_id, worker_id, project_id, attendance_date, attendance_status, total_pay, entry_mode, billing_status, salary_bill_id, notes, worker_name_snapshot, project_name_snapshot, created_at, updated_at, deleted_at, workers:worker_id ( id, name ), projects:project_id ( id, name ), salary_bill:salary_bill_id ( id, bill_type, amount, paid_amount, due_date, status, paid_at, description, deleted_at )'
const attendanceRowsByIdsColumns =
  'id, telegram_user_id, team_id, worker_id, project_id, attendance_date, attendance_status, total_pay, overtime_fee, notes, billing_status, salary_bill_id, deleted_at, created_at'
const attendanceRowsByIdsColumnsWithoutOvertimeFee =
  'id, telegram_user_id, team_id, worker_id, project_id, attendance_date, attendance_status, total_pay, notes, billing_status, salary_bill_id, deleted_at, created_at'
const expenseSelectColumns =
  'id, telegram_user_id, created_by_user_id, team_id, project_id, category_id, supplier_id, supplier_name, expense_type, document_type, status, expense_date, amount, total_amount, description, notes, project_name_snapshot, supplier_name_snapshot, created_at, updated_at, deleted_at'
const materialInvoiceExpenseTypes = new Set(['material', 'material_invoice'])
const materialInvoiceLineItemColumns =
  'id, expense_id, team_id, material_id, item_name, qty, unit_price, line_total, sort_order, created_at, updated_at, deleted_at, materials:material_id ( id, name, material_name, unit, current_stock )'
const expenseAttachmentColumns =
  'id, expense_id, team_id, file_asset_id, sort_order, created_at, updated_at, deleted_at, file_assets:file_asset_id ( id, team_id, storage_bucket, bucket_name, storage_path, original_name, file_name, public_url, mime_type, size_bytes, file_size, uploaded_by_user_id, uploaded_by, created_at, updated_at, deleted_at )'
const stockMaterialColumns =
  'id, team_id, name, material_name, unit, current_stock, reorder_point, updated_at'
const stockTransactionColumns =
  'id, team_id, material_id, project_id, expense_id, expense_line_item_id, quantity, direction, source_type, transaction_date, price_per_unit, notes, created_at, updated_at, materials:material_id ( id, name, material_name, unit ), projects:project_id ( id, name, project_name )'

function isMissingAttendanceOvertimeFeeColumnError(error) {
  const normalizedCode = normalizeText(error?.code, null)
  const normalizedMessage = normalizeText(error?.message, '').toLowerCase()
  const normalizedDetails = normalizeText(error?.details, '').toLowerCase()

  if (normalizedCode === 'PGRST204' || normalizedCode === '42703') {
    return (
      normalizedMessage.includes('overtime_fee') ||
      normalizedDetails.includes('overtime_fee') ||
      normalizedMessage.includes('attendance_records.overtime_fee') ||
      normalizedDetails.includes('attendance_records.overtime_fee')
    )
  }

  return (
    normalizedMessage.includes('overtime_fee') &&
    (normalizedMessage.includes('attendance_records') ||
      normalizedDetails.includes('attendance_records'))
  )
}

async function runAttendanceQueryWithFallback(buildQuery) {
  const primaryResult = await buildQuery(true)

  if (!primaryResult.error) {
    return primaryResult.data
  }

  if (!isMissingAttendanceOvertimeFeeColumnError(primaryResult.error)) {
    throw primaryResult.error
  }

  const legacyResult = await buildQuery(false)

  if (legacyResult.error) {
    throw legacyResult.error
  }

  return legacyResult.data
}

async function runAttendanceMutationWithFallback(buildMutation) {
  const primaryResult = await buildMutation(true)

  if (!primaryResult.error) {
    return primaryResult.data
  }

  if (!isMissingAttendanceOvertimeFeeColumnError(primaryResult.error)) {
    throw primaryResult.error
  }

  const legacyResult = await buildMutation(false)

  if (legacyResult.error) {
    throw legacyResult.error
  }

  return legacyResult.data
}

function getAttendanceDayWeight(attendanceStatus) {
  const normalizedStatus = normalizeText(attendanceStatus, '').toLowerCase()

  if (normalizedStatus === 'full_day') {
    return 1
  }

  if (normalizedStatus === 'half_day') {
    return 0.5
  }

  return 0
}

async function loadAttendanceRowsForWorkerDay(adminClient, teamId, attendanceDate, workerIds = []) {
  const normalizedTeamId = normalizeText(teamId)
  const normalizedDate = normalizeText(attendanceDate)
  const normalizedWorkerIds = [...new Set(workerIds.map((value) => normalizeText(value))).values()].filter(Boolean)

  if (!normalizedTeamId || !normalizedDate || normalizedWorkerIds.length === 0) {
    return new Map()
  }

  const { data, error } = await adminClient
    .from('attendance_records')
    .select('id, worker_id, project_id, attendance_date, attendance_status, billing_status, salary_bill_id, deleted_at')
    .eq('team_id', normalizedTeamId)
    .eq('attendance_date', normalizedDate)
    .is('deleted_at', null)
    .in('worker_id', normalizedWorkerIds)

  if (error) {
    throw error
  }

  return (data ?? []).reduce((groupedRows, row) => {
    const workerId = normalizeText(row?.worker_id, null)

    if (!workerId) {
      return groupedRows
    }

    const nextRows = groupedRows.get(workerId) ?? []
    nextRows.push(row)
    groupedRows.set(workerId, nextRows)
    return groupedRows
  }, new Map())
}

function assertAttendanceDayWeightWithinLimit({ workerRows = [], currentSourceId = null, nextAttendanceStatus = null, workerName = 'Pekerja', attendanceDate = null } = {}) {
  const normalizedCurrentSourceId = normalizeText(currentSourceId, null)
  const normalizedNextAttendanceStatus = normalizeText(nextAttendanceStatus, null)
  const totalOtherWeight = workerRows.reduce((totalWeight, row) => {
    if (normalizeText(row?.id, null) === normalizedCurrentSourceId) {
      return totalWeight
    }

    return totalWeight + getAttendanceDayWeight(row?.attendance_status)
  }, 0)

  const nextWeight = getAttendanceDayWeight(normalizedNextAttendanceStatus)

  if (totalOtherWeight + nextWeight > 1) {
    throw createHttpError(
      400,
      `Absensi ${workerName} pada ${attendanceDate ?? 'tanggal ini'} sudah mencapai batas satu hari. Gunakan half_day atau overtime sesuai sisa jatah harian.`
    )
  }
}

function buildAttendanceSheetRowPayload(
  row,
  {
    includeOvertimeFee = true,
    telegramUserId = null,
    teamId = null,
    normalizedDate = null,
    normalizedProjectId = null,
    timestamp = null,
  } = {}
) {
  const payload = {
    telegram_user_id: telegramUserId,
    team_id: teamId,
    worker_id: row.worker_id,
    project_id: normalizedProjectId,
    worker_name_snapshot: row.worker_name,
    project_name_snapshot: row.project_name,
    attendance_date: normalizedDate,
    attendance_status: row.attendance_status,
    total_pay: row.total_pay,
    entry_mode: 'manual',
    billing_status: 'unbilled',
    notes: row.notes,
    updated_at: timestamp,
  }

  if (includeOvertimeFee) {
    payload.overtime_fee = row.attendance_status === 'overtime' ? row.overtime_fee : null
  }

  return payload
}

function buildAttendanceUpdatePayload(
  { attendanceStatus, overtimeFee, totalPay, notes, timestamp },
  { includeOvertimeFee = true } = {}
) {
  const payload = {
    attendance_status: attendanceStatus,
    total_pay: totalPay,
    notes,
    updated_at: timestamp,
  }

  if (includeOvertimeFee) {
    payload.overtime_fee = attendanceStatus === 'overtime' ? overtimeFee : null
  }

  return payload
}

function getMaterialInvoiceExpenseType() {
  return 'material'
}

function addNumericMapValue(map, key, value) {
  const normalizedKey = normalizeText(key, null)
  const numericValue = toNumber(value)

  if (!normalizedKey || !Number.isFinite(numericValue)) {
    return
  }

  const currentValue = toNumber(map.get(normalizedKey))
  map.set(normalizedKey, (Number.isFinite(currentValue) ? currentValue : 0) + numericValue)
}

function isMaterialInvoiceStockDocument(documentType) {
  return ['faktur', 'surat_jalan'].includes(normalizeText(documentType, 'faktur'))
}

function getMaterialInvoiceStockQuantity(quantity) {
  const numericQuantity = toNumber(quantity)

  return Number.isFinite(numericQuantity) ? numericQuantity : 0
}

function buildMaterialInvoiceStockDeltaMaps(
  previousItems = [],
  nextItems = [],
  { mode = 'update', documentType = 'faktur' } = {}
) {
  const normalizedMode = normalizeText(mode, 'update')
  const nextDocumentType = normalizeText(documentType, 'faktur')
  const previousItemsById = new Map(
    previousItems
      .map((item) => [normalizeText(item?.id, null), item])
      .filter(([itemId]) => Boolean(itemId))
  )
  const correctionByMaterialId = new Map()
  const previousQuantityByMaterialId = new Map()
  const nextQuantityByMaterialId = new Map()
  const triggerDeltaByMaterialId = new Map()

  for (const previousItem of previousItems) {
    addNumericMapValue(previousQuantityByMaterialId, previousItem.material_id, previousItem.qty)
  }

  for (const nextItem of nextItems) {
    addNumericMapValue(nextQuantityByMaterialId, nextItem.material_id, nextItem.qty)

    if (normalizedMode === 'create' || normalizedMode === 'update') {
      const nextItemId = normalizeText(nextItem?.id, null)

      if (!nextItemId || previousItemsById.has(nextItemId)) {
        continue
      }

      const triggerQuantity = nextDocumentType === 'surat_jalan'
        ? -getMaterialInvoiceStockQuantity(nextItem.qty)
        : getMaterialInvoiceStockQuantity(nextItem.qty)

      addNumericMapValue(triggerDeltaByMaterialId, nextItem.material_id, triggerQuantity)
    }
  }

  const materialIds = new Set([
    ...previousQuantityByMaterialId.keys(),
    ...nextQuantityByMaterialId.keys(),
    ...triggerDeltaByMaterialId.keys(),
  ])

  for (const materialId of materialIds) {
    const desiredQuantity = Number.isFinite(toNumber(nextQuantityByMaterialId.get(materialId)))
      ? toNumber(nextQuantityByMaterialId.get(materialId))
      : 0
    const previousQuantity = Number.isFinite(toNumber(previousQuantityByMaterialId.get(materialId)))
      ? toNumber(previousQuantityByMaterialId.get(materialId))
      : 0
    const triggerQuantity = Number.isFinite(toNumber(triggerDeltaByMaterialId.get(materialId)))
      ? toNumber(triggerDeltaByMaterialId.get(materialId))
      : 0
    const correctionQuantity = desiredQuantity - previousQuantity - triggerQuantity

    if (correctionQuantity !== 0) {
      correctionByMaterialId.set(materialId, correctionQuantity)
    }
  }

  return {
    correctionByMaterialId,
  }
}

async function loadMaterialStocksByIds(adminClient, materialIds = []) {
  const normalizedMaterialIds = [
    ...new Set(materialIds.map((value) => normalizeText(value, null)).filter(Boolean)),
  ]

  if (normalizedMaterialIds.length === 0) {
    return new Map()
  }

  const { data, error } = await adminClient
    .from('materials')
    .select('id, name, material_name, current_stock')
    .in('id', normalizedMaterialIds)

  if (error) {
    throw error
  }

  return new Map(
    (data ?? []).map((row) => [
      row.id,
      {
        id: row.id,
        name: normalizeText(row?.name ?? row?.material_name, row.id),
        current_stock: Number.isFinite(toNumber(row?.current_stock))
          ? toNumber(row?.current_stock)
          : 0,
      },
    ])
  )
}

async function assertMaterialStockAvailability(adminClient, deltaByMaterialId = new Map()) {
  const materialStocks = await loadMaterialStocksByIds(adminClient, [...deltaByMaterialId.keys()])

  for (const [materialId, delta] of deltaByMaterialId.entries()) {
    const numericDelta = toNumber(delta)
    const material = materialStocks.get(materialId) ?? {
      id: materialId,
      name: materialId,
      current_stock: 0,
    }
    if (!Number.isFinite(numericDelta)) {
      throw createHttpError(500, 'Delta stok material tidak valid.')
    }
    const currentStock = Number.isFinite(toNumber(material.current_stock))
      ? toNumber(material.current_stock)
      : 0
    const nextStock = currentStock + numericDelta

    if (nextStock < 0) {
      throw createHttpError(
        400,
        `Stok material ${material.name ?? material.id} tidak mencukupi untuk dokumen barang ini.`
      )
    }
  }
}

async function applyMaterialStockDelta(adminClient, deltaByMaterialId = new Map()) {
  const materialStocks = await loadMaterialStocksByIds(adminClient, [...deltaByMaterialId.keys()])
  const timestamp = new Date().toISOString()

  await Promise.all(
    [...deltaByMaterialId.entries()].map(async ([materialId, delta]) => {
      const numericDelta = toNumber(delta)
      const currentMaterial = materialStocks.get(materialId) ?? {
        id: materialId,
        current_stock: 0,
      }
      if (!Number.isFinite(numericDelta)) {
        throw createHttpError(500, 'Delta stok material tidak valid.')
      }
      const currentStock = Number.isFinite(toNumber(currentMaterial.current_stock))
        ? toNumber(currentMaterial.current_stock)
        : 0
      const nextStock = currentStock + numericDelta

      const { error } = await adminClient
        .from('materials')
        .update({
          current_stock: nextStock,
          updated_at: timestamp,
        })
        .eq('id', materialId)

      if (error) {
        throw error
      }
    })
  )
}

async function assertMaterialInvoiceDeleteStockAvailability(
  adminClient,
  items = [],
  documentType = 'faktur'
) {
  if (!isMaterialInvoiceStockDocument(documentType) || items.length === 0) {
    return
  }

  const normalizedDocumentType = normalizeText(documentType, 'faktur')
  const deltaByMaterialId = new Map()

  for (const item of items) {
    const rollbackQuantity =
      normalizedDocumentType === 'surat_jalan'
        ? getMaterialInvoiceStockQuantity(item?.qty)
        : -getMaterialInvoiceStockQuantity(item?.qty)

    addNumericMapValue(deltaByMaterialId, item?.material_id, rollbackQuantity)
  }

  const materialStocks = await loadMaterialStocksByIds(adminClient, [...deltaByMaterialId.keys()])

  for (const [materialId, delta] of deltaByMaterialId.entries()) {
    const material = materialStocks.get(materialId) ?? {
      id: materialId,
      name: materialId,
      current_stock: 0,
    }
    const currentStock = Number.isFinite(toNumber(material.current_stock))
      ? toNumber(material.current_stock)
      : 0
    const nextStock = currentStock + toNumber(delta)

    if (nextStock < 0) {
      throw createHttpError(
        400,
        `Dokumen barang ini tidak bisa dihapus karena stok material ${material.name ?? material.id} sudah terpakai di mutasi lain. Koreksi mutasi stok turunannya lebih dulu.`
      )
    }
  }
}

async function syncMaterialInvoiceStockMovement(
  adminClient,
  {
    expenseId,
    previousItems = [],
    nextItems = [],
    mode = 'update',
    documentType = 'faktur',
    teamId = null,
    projectId = null,
    expenseDate = null,
  } = {}
) {
  if (!isMaterialInvoiceStockDocument(documentType)) {
    return
  }

  const normalizedMode = normalizeText(mode, 'update')

  if (normalizedMode === 'create') {
    return
  }

  if (normalizedMode === 'delete') {
    const { error } = await adminClient.rpc('fn_reverse_material_invoice_stock_movement', {
      p_expense_id: expenseId,
      p_team_id: teamId,
      p_document_type: documentType,
    })

    if (error) {
      throw error
    }

    return
  }

  const { correctionByMaterialId } = buildMaterialInvoiceStockDeltaMaps(previousItems, nextItems, {
    mode: normalizedMode,
    documentType,
  })

  if (previousItems.length === 0 && nextItems.length === 0) {
    return
  }

  const transactionDate = normalizeText(expenseDate, null) ?? new Date().toISOString().slice(0, 10)
  const stockSourceType = normalizeText(documentType, 'faktur') === 'surat_jalan'
    ? 'delivery_order'
    : 'invoice'
  const nextItemIds = new Set(
    nextItems.map((item) => normalizeText(item?.id, null)).filter(Boolean)
  )
  const deleteIds = previousItems
    .map((item) => normalizeText(item?.id, null))
    .filter((itemId) => itemId && !nextItemIds.has(itemId))

  if (deleteIds.length > 0) {
    const { error } = await adminClient
      .from('stock_transactions')
      .delete()
      .in('expense_line_item_id', deleteIds)

    if (error) {
      throw error
    }
  }

  await Promise.all(
    nextItems.map(async (item) => {
      const itemId = normalizeText(item?.id, null)
      const unitPrice = toNumber(item?.unit_price)

      if (!itemId) {
        return
      }

      const { error } = await adminClient
        .from('stock_transactions')
        .upsert(
          {
            team_id: teamId,
            project_id: projectId,
            material_id: item.material_id,
            expense_id: expenseId,
            expense_line_item_id: itemId,
            quantity: toNumber(item.qty),
            direction: 'in',
            source_type: stockSourceType,
            transaction_date: transactionDate,
            price_per_unit:
              Number.isFinite(unitPrice) && unitPrice !== 0 ? unitPrice : null,
          },
          {
            onConflict: 'expense_line_item_id',
          }
        )

      if (error) {
        throw error
      }
    })
  )

  if (correctionByMaterialId.size > 0) {
    await assertMaterialStockAvailability(adminClient, correctionByMaterialId)
    await applyMaterialStockDelta(adminClient, correctionByMaterialId)
  }
}

function getEnv(name, fallback = '') {
  return String(globalThis.process?.env?.[name] ?? fallback).trim()
}

function createHttpError(status, message) {
  const error = new Error(message)

  error.statusCode = status

  return error
}

function getBearerToken(req) {
  const authorizationHeader = String(req.headers?.authorization ?? '').trim()
  const bearerToken = authorizationHeader.toLowerCase().startsWith('bearer ')
    ? authorizationHeader.slice(7).trim()
    : null

  if (!bearerToken) {
    throw createHttpError(401, 'Authorization token tidak ditemukan.')
  }

  return bearerToken
}

async function parseRequestBody(req) {
  if (typeof req.body === 'string' && req.body.trim().length > 0) {
    return JSON.parse(req.body)
  }

  if (req.body && typeof req.body === 'object') {
    return req.body
  }

  const chunks = []

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString())
  }

  const rawBody = chunks.join('').trim()

  return rawBody ? JSON.parse(rawBody) : {}
}

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function formatRecordError(error, fallback = 'Terjadi kesalahan di server records.') {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message.trim()
      : error instanceof Error && error.message.trim().length > 0
        ? error.message.trim()
        : null
  const details = normalizeText(error?.details, null)
  const hint = normalizeText(error?.hint, null)
  const code = normalizeText(error?.code, null)

  const fragments = []

  if (message) {
    fragments.push(message)
  }

  if (details) {
    fragments.push(`Detail: ${details}`)
  }

  if (hint) {
    fragments.push(`Hint: ${hint}`)
  }

  if (code) {
    fragments.push(`Code: ${code}`)
  }

  return fragments.length > 0 ? fragments.join(' | ') : fallback
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : NaN
}

function compareText(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), 'id', {
    sensitivity: 'base',
  })
}

function normalizeVersion(value) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : null
}

function assertOptimisticConcurrency(expectedVersion, currentVersion, label) {
  const normalizedExpected = normalizeVersion(expectedVersion)

  if (!normalizedExpected) {
    return
  }

  const normalizedCurrent = normalizeVersion(currentVersion)

  if (normalizedCurrent && normalizedCurrent !== normalizedExpected) {
    throw createHttpError(
      409,
      `${label} sudah berubah oleh pengguna lain. Muat ulang data terbaru sebelum menyimpan lagi.`
    )
  }
}

function createDatabaseClient(url, apiKey, bearerToken) {
  return createClient(url, apiKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: bearerToken
      ? {
          headers: {
            Authorization: `Bearer ${bearerToken}`,
          },
        }
      : undefined,
  })
}

async function getAuthorizedContext(req, supabaseUrl, publishableKey) {
  const bearerToken = getBearerToken(req)

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      apikey: publishableKey,
    },
  })

  if (!authResponse.ok) {
    throw createHttpError(401, 'Sesi Supabase tidak valid.')
  }

  const authUser = await authResponse.json()

  if (!authUser?.id) {
    throw createHttpError(401, 'User Supabase tidak ditemukan.')
  }

  return {
    authUser,
    bearerToken,
  }
}

async function loadSessionProfile(sessionClient) {
  const { data, error } = await sessionClient
    .from('profiles')
    .select('id, telegram_user_id')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ?? null
}

async function assertSessionTeamAccess(sessionClient, teamId) {
  const normalizedTeamId = normalizeText(teamId)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Team ID wajib diisi.')
  }

  const { data: team, error } = await sessionClient
    .from('teams')
    .select('id')
    .eq('id', normalizedTeamId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!team?.id) {
    throw createHttpError(403, 'Akses workspace tidak ditemukan.')
  }

  return normalizedTeamId
}

async function assertTeamAccess(adminClient, telegramUserId, teamId) {
  const normalizedTeamId = normalizeText(teamId)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Team ID wajib diisi.')
  }

  const { data: membership, error } = await adminClient
    .from('team_members')
    .select('id')
    .eq('telegram_user_id', telegramUserId)
    .eq('team_id', normalizedTeamId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!membership?.id) {
    throw createHttpError(403, 'Akses workspace tidak ditemukan.')
  }

  return normalizedTeamId
}

async function assertManualStockOutAccess(adminClient, telegramUserId, teamId) {
  const normalizedTeamId = await assertTeamAccess(adminClient, telegramUserId, teamId)

  const { data, error } = await adminClient
    .from('team_members')
    .select('id, role')
    .eq('telegram_user_id', telegramUserId)
    .eq('team_id', normalizedTeamId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw createHttpError(403, 'Role Anda tidak diizinkan untuk stock-out manual.')
  }

  assertCapabilityAccess(data.role, 'manual_stock_out', null, 403)

  return normalizedTeamId
}

function unwrapRelation(relation) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null
  }

  return relation ?? null
}

function mapBillRow(bill) {
  const worker = unwrapRelation(bill?.workers)
  const supplier = unwrapRelation(bill?.suppliers)
  const project = unwrapRelation(bill?.projects)
  const amount = toNumber(bill?.amount)
  const paidAmount = toNumber(bill?.paid_amount)
  const workerName = normalizeText(
    bill?.worker_name_snapshot ??
      worker?.name ??
      supplier?.name ??
      bill?.supplier_name_snapshot,
    null
  )

  return {
    id: bill?.id ?? null,
    expenseId: bill?.expense_id ?? null,
    projectIncomeId: bill?.project_income_id ?? null,
    telegramUserId: bill?.telegram_user_id ?? null,
    teamId: bill?.team_id ?? null,
    workerId: bill?.worker_id ?? null,
    supplierId: bill?.supplier_id ?? null,
    staffId: bill?.staff_id ?? null,
    billType: bill?.bill_type ?? null,
    description: bill?.description ?? null,
    amount,
    paidAmount,
    remainingAmount: Math.max(amount - paidAmount, 0),
    dueDate: bill?.due_date ?? null,
    status: bill?.status ?? 'unpaid',
    paidAt: bill?.paid_at ?? null,
    updatedAt: bill?.updated_at ?? null,
    updated_at: bill?.updated_at ?? null,
    workerName,
    worker_name_snapshot: workerName,
    supplierName:
      supplier?.name ??
      worker?.name ??
      bill?.worker_name_snapshot ??
      bill?.supplier_name_snapshot ??
      'Supplier belum terhubung',
    projectName:
      project?.name ??
      bill?.project_name_snapshot ??
      'Proyek belum terhubung',
  }
}

function mapBillPaymentRow(row) {
  return {
    id: row?.id ?? null,
    billId: row?.bill_id ?? null,
    telegramUserId: row?.telegram_user_id ?? null,
    teamId: row?.team_id ?? null,
    amount: toNumber(row?.amount),
    paymentDate: row?.payment_date ?? null,
    notes: row?.notes ?? null,
    createdAt: row?.created_at ?? null,
    updatedAt: row?.updated_at ?? null,
    updated_at: row?.updated_at ?? null,
    deleted_at: row?.deleted_at ?? null,
    canRestore: Boolean(row?.deleted_at),
    canPermanentDelete: Boolean(row?.deleted_at),
  }
}

function getBillPaymentStatus(totalAmount, paidAmount, existingPaidAt = null) {
  if (totalAmount > 0 && paidAmount >= totalAmount) {
    return {
      status: 'paid',
      paidAt: existingPaidAt ?? new Date().toISOString(),
    }
  }

  if (paidAmount > 0) {
    return {
      status: 'partial',
      paidAt: null,
    }
  }

  return {
    status: 'unpaid',
    paidAt: null,
  }
}

async function loadBillPaymentById(adminClient, paymentId, { includeDeleted = false } = {}) {
  const normalizedPaymentId = normalizeText(paymentId)

  if (!normalizedPaymentId) {
    throw createHttpError(400, 'Bill payment ID tidak valid.')
  }

  let query = adminClient
    .from('bill_payments')
    .select('id, bill_id, telegram_user_id, team_id, amount, payment_date, notes, created_at, updated_at, deleted_at')
    .eq('id', normalizedPaymentId)

  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapBillPaymentRow(data) : null
}

async function loadDeletedBillPayments(adminClient, teamId) {
  const normalizedTeamId = normalizeText(teamId)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Team ID wajib diisi.')
  }

  const { data, error } = await adminClient
    .from('bill_payments')
    .select(
      'id, bill_id, telegram_user_id, team_id, amount, payment_date, notes, created_at, updated_at, deleted_at'
    )
    .eq('team_id', normalizedTeamId)
    .not('deleted_at', 'is', null)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const billIds = [...new Set((data ?? []).map((row) => normalizeText(row?.bill_id, null)).filter(Boolean))]

  if (billIds.length === 0) {
    return []
  }

  const { data: bills, error: billsError } = await adminClient
    .from('bills')
    .select('id, deleted_at')
    .in('id', billIds)

  if (billsError) {
    throw billsError
  }

  const activeBillIds = new Set(
    (bills ?? [])
      .filter((bill) => !bill?.deleted_at)
      .map((bill) => String(bill.id))
  )

  return (data ?? [])
    .filter((row) => activeBillIds.has(String(row.bill_id ?? '')))
    .map(mapBillPaymentRow)
}

async function recalculateBillPaymentSummary(adminClient, billId) {
  const normalizedBillId = normalizeText(billId)

  if (!normalizedBillId) {
    throw createHttpError(400, 'Bill ID tidak valid.')
  }

  const { data: bill, error: billError } = await adminClient
    .from('bills')
    .select('id, amount, paid_amount, paid_at, status, team_id, deleted_at')
    .eq('id', normalizedBillId)
    .maybeSingle()

  if (billError) {
    throw billError
  }

  if (!bill?.id) {
    throw createHttpError(404, 'Tagihan tidak ditemukan.')
  }

  const { data: payments, error: paymentsError } = await adminClient
    .from('bill_payments')
    .select('amount, payment_date')
    .eq('bill_id', normalizedBillId)
    .is('deleted_at', null)

  if (paymentsError) {
    throw paymentsError
  }

  const paidAmount = (payments ?? []).reduce((sum, payment) => sum + toNumber(payment.amount), 0)
  const totalAmount = toNumber(bill.amount)
  const latestPaymentDate = (payments ?? []).reduce((latest, payment) => {
    const paymentDate = normalizeText(payment?.payment_date, null)

    if (!paymentDate) {
      return latest
    }

    if (!latest) {
      return paymentDate
    }

    return new Date(paymentDate).getTime() > new Date(latest).getTime()
      ? paymentDate
      : latest
  }, null)
  const paidAtSource = latestPaymentDate ?? bill.paid_at ?? null
  const nextBillState = getBillPaymentStatus(totalAmount, paidAmount, paidAtSource)
  const timestamp = new Date().toISOString()

  const { data: updatedBill, error: updateError } = await adminClient
    .from('bills')
    .update({
      paid_amount: paidAmount,
      status: nextBillState.status,
      paid_at: nextBillState.paidAt,
      updated_at: timestamp,
    })
    .eq('id', normalizedBillId)
    .select(
      'id, expense_id, amount, paid_amount, due_date, status, paid_at, deleted_at, supplier_name_snapshot, project_name_snapshot, worker_name_snapshot'
    )
    .single()

  if (updateError) {
    throw updateError
  }

  return updatedBill
}

function assertPaymentDoesNotOverpayParent(nextPaidAmount, targetAmount, message) {
  if (targetAmount > 0 && nextPaidAmount > targetAmount) {
    throw createHttpError(400, message)
  }
}

async function restoreBillPayment(adminClient, body = {}, telegramUserId) {
  const paymentId = normalizeText(body.paymentId ?? body.id, null)
  const expectedUpdatedAt = normalizeText(
    body.expectedUpdatedAt ?? body.expected_updated_at,
    null
  )
  const teamId = normalizeText(body.teamId ?? body.team_id, null)

  if (!paymentId) {
    throw createHttpError(400, 'Bill payment ID wajib diisi.')
  }

  const payment = await loadBillPaymentById(adminClient, paymentId, {
    includeDeleted: true,
  })

  if (!payment) {
    throw createHttpError(404, 'Pembayaran tagihan tidak ditemukan.')
  }

  assertOptimisticConcurrency(expectedUpdatedAt, payment.updatedAt, 'Pembayaran tagihan')

  const { data: bill, error: billError } = await adminClient
    .from('bills')
    .select('id, team_id, amount, paid_amount, paid_at, status, deleted_at')
    .eq('id', payment.billId)
    .maybeSingle()

  if (billError) {
    throw billError
  }

  if (!bill?.id) {
    throw createHttpError(404, 'Tagihan terkait tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, teamId ?? bill.team_id ?? payment.teamId)

  if (bill.deleted_at) {
    throw createHttpError(400, 'Tagihan parent masih ada di recycle bin. Pulihkan tagihan lebih dulu.')
  }

  if (!payment.deleted_at) {
    const nextBill = await recalculateBillPaymentSummary(adminClient, bill.id)

    return {
      payment,
      bill: nextBill,
    }
  }

  const { data: siblingPayments, error: siblingError } = await adminClient
    .from('bill_payments')
    .select('id, amount')
    .eq('bill_id', payment.billId)
    .is('deleted_at', null)

  if (siblingError) {
    throw siblingError
  }

  const nextPaidAmount =
    (siblingPayments ?? []).reduce((sum, row) => sum + Number(row?.amount ?? 0), 0) +
    Number(payment.amount ?? 0)

  assertPaymentDoesNotOverpayParent(
    nextPaidAmount,
    Number(bill.amount),
    'Nominal pembayaran melebihi total tagihan.'
  )

  const timestamp = new Date().toISOString()
  const { data: restoredPayment, error } = await adminClient
    .from('bill_payments')
    .update({
      deleted_at: null,
      updated_at: timestamp,
    })
    .eq('id', payment.id)
    .not('deleted_at', 'is', null)
    .select(
      'id, bill_id, telegram_user_id, team_id, amount, payment_date, notes, created_at, updated_at, deleted_at'
    )
    .single()

  if (error) {
    throw error
  }

  const updatedBill = await recalculateBillPaymentSummary(adminClient, bill.id)

  return {
    payment: mapBillPaymentRow(restoredPayment),
    bill: updatedBill,
  }
}

function normalizeAttendanceRow(attendance) {
  const worker = Array.isArray(attendance?.workers)
    ? attendance.workers[0] ?? null
    : attendance?.workers ?? null
  const project = Array.isArray(attendance?.projects)
    ? attendance.projects[0] ?? null
    : attendance?.projects ?? null

  return {
    ...attendance,
    total_pay: toNumber(attendance?.total_pay),
    overtime_fee: attendance?.overtime_fee ?? null,
    worker_name: normalizeText(
      worker?.name ?? attendance?.worker_name_snapshot,
      'Pekerja belum terhubung'
    ),
    project_name: normalizeText(
      project?.name ?? attendance?.project_name_snapshot,
      'Proyek belum terhubung'
    ),
    attendance_status: normalizeText(attendance?.attendance_status, 'full_day'),
    billing_status: normalizeText(attendance?.billing_status, 'unbilled'),
    entry_mode: normalizeText(attendance?.entry_mode, 'manual'),
  }
}

function normalizeAttendanceDetailRow(attendance) {
  const salaryBill = Array.isArray(attendance?.salary_bill)
    ? attendance.salary_bill[0] ?? null
    : attendance?.salary_bill ?? null

  return {
    ...normalizeAttendanceRow(attendance),
    salary_bill: salaryBill
      ? {
          ...salaryBill,
          amount: toNumber(salaryBill?.amount),
          paid_amount: toNumber(salaryBill?.paid_amount),
        }
      : null,
  }
}

function normalizeSummaryRow(row) {
  return {
    ...row,
    project_type: normalizeText(row?.project_type, 'Utama'),
    total_income: toNumber(row?.total_income),
    material_expense: toNumber(row?.material_expense),
    operating_expense: toNumber(row?.operating_expense),
    salary_expense: toNumber(row?.salary_expense),
    gross_profit: toNumber(row?.gross_profit),
    net_profit: toNumber(row?.net_profit),
    net_profit_project: toNumber(row?.net_profit_project ?? row?.net_profit),
    company_overhead: toNumber(row?.company_overhead),
    project_status: normalizeText(row?.project_status, 'inactive'),
  }
}

function normalizeIncomeRow(row) {
  return {
    ...row,
    amount: toNumber(row?.amount),
  }
}

function normalizeExpenseRow(row) {
  return {
    ...row,
    total_amount: toNumber(row?.total_amount),
  }
}

function normalizeMaterialInvoiceLineItem(row) {
  const material = unwrapRelation(row?.materials)

  return {
    ...row,
    team_id: row?.team_id ?? null,
    qty: toNumber(row?.qty),
    unit_price: toNumber(row?.unit_price),
    line_total: toNumber(row?.line_total),
    material_name: normalizeText(
      row?.item_name,
      normalizeText(material?.name ?? material?.material_name, null)
    ),
    materials: material
      ? {
          id: material?.id ?? null,
          name: normalizeText(material?.name ?? material?.material_name, material?.id ?? null),
          material_name: normalizeText(material?.material_name ?? material?.name, material?.id ?? null),
          unit: normalizeText(material?.unit, null),
          current_stock: toNumber(material?.current_stock),
        }
      : null,
    sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : 1,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
    deleted_at: row?.deleted_at ?? null,
  }
}

function normalizeFileAssetRow(row) {
  return {
    id: row?.id ?? null,
    team_id: row?.team_id ?? null,
    storage_bucket: row?.storage_bucket ?? row?.bucket_name ?? null,
    bucket_name: row?.bucket_name ?? row?.storage_bucket ?? null,
    storage_path: row?.storage_path ?? null,
    original_name: row?.original_name ?? row?.file_name ?? null,
    file_name: row?.file_name ?? row?.original_name ?? null,
    public_url: row?.public_url ?? null,
    mime_type: row?.mime_type ?? null,
    size_bytes: toNumber(row?.size_bytes ?? row?.file_size),
    file_size: toNumber(row?.file_size ?? row?.size_bytes),
    uploaded_by_user_id: row?.uploaded_by_user_id ?? null,
    uploaded_by: row?.uploaded_by ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
    deleted_at: row?.deleted_at ?? null,
  }
}

function normalizeExpenseAttachmentRow(row) {
  const fileAsset = unwrapRelation(row?.file_assets)

  return {
    id: row?.id ?? null,
    expense_id: row?.expense_id ?? null,
    team_id: row?.team_id ?? null,
    file_asset_id: row?.file_asset_id ?? null,
    sort_order: Number.isFinite(Number(row?.sort_order)) ? Number(row.sort_order) : 1,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
    deleted_at: row?.deleted_at ?? null,
    file_assets: fileAsset ? normalizeFileAssetRow(fileAsset) : null,
    canRestore: Boolean(row?.deleted_at),
    canPermanentDelete: Boolean(row?.deleted_at),
  }
}

function normalizeStockMaterialRow(row) {
  const materialName = normalizeText(row?.material_name ?? row?.name, row?.id ?? null)

  return {
    id: row?.id ?? null,
    team_id: row?.team_id ?? null,
    name: materialName,
    material_name: materialName,
    unit: normalizeText(row?.unit, ''),
    current_stock: toNumber(row?.current_stock),
    reorder_point: toNumber(row?.reorder_point),
    updated_at: row?.updated_at ?? null,
  }
}

function normalizeStockTransactionRow(row) {
  const material = unwrapRelation(row?.materials)
  const project = unwrapRelation(row?.projects)
  const materialName = normalizeText(
    material?.material_name ?? material?.name ?? row?.material_name,
    row?.material_id ?? null
  )
  const projectName = normalizeText(
    project?.project_name ?? project?.name ?? row?.project_name,
    null
  )

  return {
    id: row?.id ?? null,
    team_id: row?.team_id ?? null,
    material_id: row?.material_id ?? null,
    material_name: materialName,
    material_unit: normalizeText(material?.unit ?? row?.material_unit, ''),
    project_id: row?.project_id ?? null,
    project_name: projectName,
    expense_id: row?.expense_id ?? null,
    expense_line_item_id: row?.expense_line_item_id ?? null,
    quantity: toNumber(row?.quantity),
    direction: normalizeText(row?.direction, 'in'),
    source_type: normalizeText(row?.source_type, 'invoice'),
    transaction_date: row?.transaction_date ?? null,
    price_per_unit: row?.price_per_unit == null ? null : toNumber(row?.price_per_unit),
    notes: normalizeText(row?.notes, null),
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  }
}

function normalizeProjectOptionRow(row) {
  const projectName = normalizeText(row?.project_name ?? row?.name, row?.id ?? null)

  return {
    id: row?.id ?? null,
    team_id: row?.team_id ?? null,
    name: projectName,
    project_name: projectName,
    is_active: row?.is_active ?? true,
    status: normalizeText(row?.status, null),
    project_type: normalizeText(row?.project_type, null),
  }
}

function mapExpenseRow(expense, bill = null, attachments = []) {
  const normalizedBill = bill ?? null

  return {
    ...expense,
    amount: toNumber(expense?.amount),
    total_amount: toNumber(expense?.total_amount),
    status: normalizeText(expense?.status, 'unpaid'),
    expense_type: normalizeText(expense?.expense_type, 'operasional'),
    document_type: normalizeText(expense?.document_type, 'faktur'),
    bill: normalizedBill
      ? {
          id: normalizedBill.id ?? null,
          expense_id: normalizedBill.expense_id ?? null,
          amount: toNumber(normalizedBill.amount),
          paid_amount: toNumber(normalizedBill.paid_amount),
          due_date: normalizedBill.due_date ?? null,
          status: normalizeText(normalizedBill.status, 'unpaid'),
          paid_at: normalizedBill.paid_at ?? null,
          deleted_at: normalizedBill.deleted_at ?? null,
        }
      : null,
    attachments: Array.isArray(attachments)
      ? attachments.map(normalizeExpenseAttachmentRow)
      : [],
  }
}

function normalizeSalaryRow(row) {
  return {
    ...row,
    total_pay: toNumber(row?.total_pay),
  }
}

function normalizePdfSettingsRow(row) {
  if (!row) {
    return null
  }

  const headerLogoFileAsset = unwrapRelation(row?.header_logo_file_asset)
  const footerLogoFileAsset = unwrapRelation(row?.footer_logo_file_asset)

  return {
    team_id: row?.team_id ?? null,
    header_color: normalizeText(row?.header_color, null),
    header_logo_file_id: row?.header_logo_file_id ?? null,
    footer_logo_file_id: row?.footer_logo_file_id ?? null,
    header_logo_file_asset: headerLogoFileAsset
      ? normalizeFileAssetRow(headerLogoFileAsset)
      : null,
    footer_logo_file_asset: footerLogoFileAsset
      ? normalizeFileAssetRow(footerLogoFileAsset)
      : null,
    company_name: normalizeText(row?.company_name, null),
    address: normalizeText(row?.address, null),
    phone: normalizeText(row?.phone, null),
    extra: row?.extra ?? null,
    updated_by_user_id: row?.updated_by_user_id ?? null,
    updated_at: row?.updated_at ?? null,
  }
}

function createPortfolioSummary(rows = []) {
  const totalProjectProfit = rows.reduce(
    (sum, row) => sum + toNumber(row.net_profit_project ?? row.net_profit),
    0
  )
  const totalIncome = rows.reduce((sum, row) => sum + toNumber(row.total_income), 0)
  const totalMaterialExpense = rows.reduce((sum, row) => sum + toNumber(row.material_expense), 0)
  const totalOperatingExpense = rows.reduce((sum, row) => sum + toNumber(row.operating_expense), 0)
  const totalSalaryExpense = rows.reduce((sum, row) => sum + toNumber(row.salary_expense), 0)
  const totalCompanyOverhead = rows.reduce(
    (sum, row) => sum + toNumber(row.company_overhead),
    0
  )

  return {
    total_income: totalIncome,
    total_material_expense: totalMaterialExpense,
    total_operating_expense: totalOperatingExpense,
    total_salary_expense: totalSalaryExpense,
    total_expense: totalMaterialExpense + totalOperatingExpense + totalSalaryExpense,
    total_project_profit: totalProjectProfit,
    total_company_overhead: totalCompanyOverhead,
    net_consolidated_profit: totalProjectProfit - totalCompanyOverhead,
  }
}

function normalizeBillingStatsRow(row) {
  return {
    team_id: row?.team_id ?? null,
    total_outstanding: toNumber(row?.total_outstanding),
    total_paid: toNumber(row?.total_paid),
    total_bill_count: toNumber(row?.total_bill_count),
    total_outstanding_salary: toNumber(row?.total_outstanding_salary),
  }
}

function normalizeCashMutationRow(row) {
  return {
    transaction_date: row?.transaction_date ?? null,
    type: normalizeText(row?.type, 'out'),
    amount: toNumber(row?.amount),
    description: normalizeText(row?.description, '-'),
    source_table: normalizeText(row?.source_table, '-'),
    team_id: row?.team_id ?? null,
  }
}

function createBillingStatsSummary(rows = []) {
  return rows.reduce(
    (summary, row) => ({
      total_outstanding: summary.total_outstanding + toNumber(row?.total_outstanding),
      total_paid: summary.total_paid + toNumber(row?.total_paid),
      total_bill_count: summary.total_bill_count + toNumber(row?.total_bill_count),
      total_outstanding_salary:
        summary.total_outstanding_salary + toNumber(row?.total_outstanding_salary),
    }),
    {
      total_outstanding: 0,
      total_paid: 0,
      total_bill_count: 0,
      total_outstanding_salary: 0,
    }
  )
}

function createCashMutationSummary(rows = []) {
  return rows.reduce(
    (summary, row) => {
      const amount = toNumber(row?.amount)

      if (row?.type === 'in') {
        summary.total_inflow += amount
      } else {
        summary.total_outflow += amount
      }

      summary.total_mutation += 1

      return summary
    },
    {
      total_inflow: 0,
      total_outflow: 0,
      total_net_cash_flow: 0,
      total_mutation: 0,
    }
  )
}

function applyDateRangeToQuery(query, columnName, dateFrom = null, dateTo = null) {
  let nextQuery = query

  if (dateFrom) {
    nextQuery = nextQuery.gte(columnName, dateFrom)
  }

  if (dateTo) {
    nextQuery = nextQuery.lte(columnName, dateTo)
  }

  return nextQuery
}

async function loadBillById(adminClient, billId) {
  const normalizedBillId = normalizeText(billId)

  if (!normalizedBillId) {
    throw createHttpError(400, 'Bill ID tidak valid.')
  }

  const { data, error } = await adminClient
    .from('bills')
    .select(
      'id, expense_id, project_income_id, telegram_user_id, team_id, worker_id, supplier_id, staff_id, bill_type, description, amount, paid_amount, due_date, status, paid_at, updated_at, worker_name_snapshot, supplier_name_snapshot, project_name_snapshot, workers:worker_id ( id, name ), suppliers:supplier_id ( id, name ), projects:project_id ( id, name )'
    )
    .eq('id', normalizedBillId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  const { data: payments, error: paymentsError } = await adminClient
    .from('bill_payments')
    .select('id, bill_id, telegram_user_id, team_id, amount, payment_date, notes, created_at')
    .eq('bill_id', normalizedBillId)
    .is('deleted_at', null)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (paymentsError) {
    throw paymentsError
  }

  return {
    ...mapBillRow(data),
    payments: (payments ?? []).map(mapBillPaymentRow),
  }
}

async function createBillPayment(adminClient, body = {}, telegramUserId) {
  const billId = normalizeText(body.billId ?? body.bill_id ?? body.id, null)
  const teamId = normalizeText(body.teamId ?? body.team_id, null)
  const normalizedAmount = toNumber(body.amount)
  const paymentDate = normalizeText(body.paymentDate ?? body.payment_date, null)
  const notes = normalizeText(body.notes, null)

  if (!billId) {
    throw createHttpError(400, 'Bill ID wajib diisi.')
  }

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw createHttpError(400, 'Nominal pembayaran tidak valid.')
  }

  if (!paymentDate) {
    throw createHttpError(400, 'Tanggal pembayaran wajib diisi.')
  }

  const bill = await loadBillById(adminClient, billId)

  if (!bill) {
    throw createHttpError(404, 'Tagihan terkait tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, teamId ?? bill.teamId)

  const { data: siblingPayments, error: siblingError } = await adminClient
    .from('bill_payments')
    .select('amount')
    .eq('bill_id', bill.id)
    .is('deleted_at', null)

  if (siblingError) {
    throw siblingError
  }

  const nextPaidAmount =
    (siblingPayments ?? []).reduce((sum, row) => sum + toNumber(row.amount), 0) +
    normalizedAmount
  const totalBillAmount = toNumber(bill.amount)

  if (totalBillAmount > 0 && nextPaidAmount > totalBillAmount) {
    throw createHttpError(400, 'Nominal pembayaran melebihi total tagihan.')
  }

  const timestamp = new Date().toISOString()
  const { data: insertedPayment, error: insertError } = await adminClient
    .from('bill_payments')
    .insert({
      bill_id: bill.id,
      telegram_user_id: telegramUserId,
      team_id: bill.teamId ?? teamId,
      amount: normalizedAmount,
      payment_date: paymentDate,
      notes,
      worker_name_snapshot:
        bill.billType === 'gaji' ? normalizeText(bill.supplierName, null) : null,
      supplier_name_snapshot:
        bill.billType === 'gaji' ? null : normalizeText(bill.supplierName, null),
      project_name_snapshot: normalizeText(bill.projectName, null),
      updated_at: timestamp,
    })
    .select(
      'id, bill_id, telegram_user_id, team_id, amount, payment_date, notes, created_at, updated_at, deleted_at'
    )
    .single()

  if (insertError) {
    throw insertError
  }

  const updatedBill = await recalculateBillPaymentSummary(adminClient, bill.id)

  return {
    payment: mapBillPaymentRow(insertedPayment),
    bill: updatedBill,
  }
}

async function updateBillPayment(adminClient, body = {}, telegramUserId) {
  const paymentId = normalizeText(body.paymentId ?? body.id, null)
  const normalizedAmount = toNumber(body.amount)
  const paymentDate = normalizeText(body.paymentDate ?? body.payment_date, null)
  const notes = normalizeText(body.notes, null)
  const expectedUpdatedAt = normalizeText(
    body.expectedUpdatedAt ?? body.expected_updated_at,
    null
  )

  if (!paymentId) {
    throw createHttpError(400, 'Bill payment ID wajib diisi.')
  }

  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw createHttpError(400, 'Nominal pembayaran tidak valid.')
  }

  if (!paymentDate) {
    throw createHttpError(400, 'Tanggal pembayaran wajib diisi.')
  }

  const payment = await loadBillPaymentById(adminClient, paymentId)

  if (!payment) {
    throw createHttpError(404, 'Pembayaran tagihan tidak ditemukan.')
  }

  assertOptimisticConcurrency(expectedUpdatedAt, payment.updatedAt, 'Pembayaran tagihan')

  const { data: bill, error: billError } = await adminClient
    .from('bills')
    .select('id, team_id, amount, paid_amount, paid_at, status, deleted_at')
    .eq('id', payment.billId)
    .maybeSingle()

  if (billError) {
    throw billError
  }

  if (!bill?.id) {
    throw createHttpError(404, 'Tagihan terkait tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, bill.team_id ?? payment.teamId)

  const { data: siblingPayments, error: siblingError } = await adminClient
    .from('bill_payments')
    .select('id, amount')
    .eq('bill_id', bill.id)
    .is('deleted_at', null)

  if (siblingError) {
    throw siblingError
  }

  const nextPaidAmount = (siblingPayments ?? []).reduce((sum, row) => {
    if (String(row.id ?? '') === String(payment.id ?? '')) {
      return sum
    }

    return sum + Number(row?.amount ?? 0)
  }, 0) + normalizedAmount

  assertPaymentDoesNotOverpayParent(
    nextPaidAmount,
    Number(bill.amount),
    'Nominal pembayaran melebihi total tagihan.'
  )

  const timestamp = new Date().toISOString()

  const { data: updatedPayment, error: updateError } = await adminClient
    .from('bill_payments')
    .update({
      amount: normalizedAmount,
      payment_date: paymentDate,
      notes,
      telegram_user_id: payment.telegramUserId,
      team_id: bill.team_id ?? payment.teamId,
      updated_at: timestamp,
    })
    .eq('id', payment.id)
    .select('id, bill_id, telegram_user_id, team_id, amount, payment_date, notes, created_at, updated_at, deleted_at')
    .single()

  if (updateError) {
    throw updateError
  }

  const updatedBill = await recalculateBillPaymentSummary(adminClient, bill.id)

  return {
    payment: mapBillPaymentRow(updatedPayment),
    bill: updatedBill,
  }
}

async function deleteBillPayment(adminClient, body = {}, telegramUserId) {
  const paymentId = normalizeText(body.paymentId ?? body.id, null)
  const expectedUpdatedAt = normalizeText(
    body.expectedUpdatedAt ?? body.expected_updated_at,
    null
  )

  if (!paymentId) {
    throw createHttpError(400, 'Bill payment ID wajib diisi.')
  }

  const payment = await loadBillPaymentById(adminClient, paymentId)

  if (!payment) {
    throw createHttpError(404, 'Pembayaran tagihan tidak ditemukan.')
  }

  assertOptimisticConcurrency(expectedUpdatedAt, payment.updatedAt, 'Pembayaran tagihan')

  const { data: bill, error: billError } = await adminClient
    .from('bills')
    .select('id, team_id, amount, paid_amount, paid_at, status, deleted_at')
    .eq('id', payment.billId)
    .maybeSingle()

  if (billError) {
    throw billError
  }

  if (!bill?.id) {
    throw createHttpError(404, 'Tagihan terkait tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, bill.team_id ?? payment.teamId)

  const timestamp = new Date().toISOString()

  const { error: deleteError } = await adminClient
    .from('bill_payments')
    .update({
      deleted_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', payment.id)
    .is('deleted_at', null)

  if (deleteError) {
    throw deleteError
  }

  const updatedBill = await recalculateBillPaymentSummary(adminClient, bill.id)

  return {
    bill: updatedBill,
  }
}

async function hardDeleteBillPayment(adminClient, body = {}, telegramUserId) {
  const paymentId = normalizeText(body.paymentId ?? body.id, null)

  if (!paymentId) {
    throw createHttpError(400, 'Bill payment ID wajib diisi.')
  }

  const payment = await loadBillPaymentById(adminClient, paymentId, {
    includeDeleted: true,
  })

  if (!payment) {
    throw createHttpError(404, 'Pembayaran tagihan tidak ditemukan.')
  }

  const { data: bill, error: billError } = await adminClient
    .from('bills')
    .select('id, team_id, deleted_at')
    .eq('id', payment.billId)
    .maybeSingle()

  if (billError) {
    throw billError
  }

  await assertTeamAccess(adminClient, telegramUserId, body.teamId ?? bill?.team_id ?? payment.teamId)

  if (!payment.deleted_at) {
    throw createHttpError(
      400,
      'Pembayaran tagihan harus ada di recycle bin sebelum dihapus permanen.'
    )
  }

  const { error: deleteError } = await adminClient
    .from('bill_payments')
    .delete()
    .eq('id', payment.id)

  if (deleteError) {
    throw deleteError
  }

  const updatedBill = bill?.id ? await recalculateBillPaymentSummary(adminClient, bill.id) : null

  return {
    bill: updatedBill,
  }
}

async function loadUnpaidBills(adminClient, teamId) {
  const normalizedTeamId = normalizeText(teamId)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Team ID wajib diisi.')
  }

  const { data, error } = await adminClient
    .from('bills')
    .select(
      'id, expense_id, project_income_id, telegram_user_id, team_id, worker_id, supplier_id, staff_id, bill_type, description, amount, paid_amount, due_date, status, paid_at, worker_name_snapshot, supplier_name_snapshot, project_name_snapshot, workers:worker_id ( id, name ), suppliers:supplier_id ( id, name ), projects:project_id ( id, name )'
    )
    .is('deleted_at', null)
    .in('status', ['unpaid', 'partial'])
    .eq('team_id', normalizedTeamId)
    .order('due_date', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map(mapBillRow)
}

async function softDeleteBill(adminClient, billId, expectedUpdatedAt = null) {
  const normalizedBillId = normalizeText(billId)

  if (!normalizedBillId) {
    throw createHttpError(400, 'Bill ID tidak valid.')
  }

  if (normalizeVersion(expectedUpdatedAt)) {
    const { data: bill, error: billError } = await adminClient
      .from('bills')
      .select('updated_at')
      .eq('id', normalizedBillId)
      .maybeSingle()

    if (billError) {
      throw billError
    }

    assertOptimisticConcurrency(expectedUpdatedAt, bill?.updated_at, 'Tagihan')
  }

  const { error } = await adminClient.rpc('fn_soft_delete_bill_with_history', {
    p_bill_id: normalizedBillId,
  })

  if (error) {
    throw error
  }

  return true
}

async function loadExpenseById(adminClient, expenseId, { includeDeleted = false } = {}) {
  const normalizedExpenseId = normalizeText(expenseId)

  if (!normalizedExpenseId) {
    throw createHttpError(400, 'Expense ID tidak valid.')
  }

  const expenseQuery = adminClient
    .from('expenses')
    .select(expenseSelectColumns)

  if (includeDeleted) {
    expenseQuery.eq('id', normalizedExpenseId)
  } else {
    expenseQuery.eq('id', normalizedExpenseId).is('deleted_at', null)
  }

  const { data: expense, error: expenseError } = await expenseQuery.maybeSingle()

  if (expenseError) {
    throw expenseError
  }

  if (!expense?.id) {
    return null
  }

  let billQuery = adminClient
    .from('bills')
    .select('id, expense_id, amount, paid_amount, due_date, status, paid_at, deleted_at')
    .eq('expense_id', normalizedExpenseId)

  if (!includeDeleted) {
    billQuery = billQuery.is('deleted_at', null)
  }

  const { data: bill, error: billError } = await billQuery.maybeSingle()

  if (billError) {
    throw billError
  }

  const attachments = await loadExpenseAttachments(adminClient, normalizedExpenseId, {
    includeDeleted,
  })

  return mapExpenseRow(expense, bill, attachments)
}

async function loadExpenseAttachments(adminClient, expenseId, { includeDeleted = true } = {}) {
  const normalizedExpenseId = normalizeText(expenseId)

  if (!normalizedExpenseId) {
    throw createHttpError(400, 'Expense ID tidak valid.')
  }

  let query = adminClient
    .from('expense_attachments')
    .select(expenseAttachmentColumns)
    .eq('expense_id', normalizedExpenseId)

  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query.order('sort_order', { ascending: true }).order('created_at', {
    ascending: true,
  })

  if (error) {
    throw error
  }

  return (data ?? []).map(normalizeExpenseAttachmentRow)
}

async function loadStockOverview(adminClient, teamId, limit = 8) {
  const normalizedTeamId = normalizeText(teamId, null)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Team ID wajib diisi.')
  }

  const normalizedLimit = Number.isFinite(Number(limit))
    ? Math.min(Math.max(Math.trunc(Number(limit)), 1), 20)
    : 8

  const [materialsResult, stockTransactionsResult] = await Promise.all([
    adminClient
      .from('materials')
      .select(stockMaterialColumns)
      .eq('team_id', normalizedTeamId)
      .is('deleted_at', null)
      .eq('is_active', true)
      .order('material_name', { ascending: true }),
    adminClient
      .from('stock_transactions')
      .select(stockTransactionColumns)
      .eq('team_id', normalizedTeamId)
      .is('deleted_at', null)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(normalizedLimit),
  ])

  if (materialsResult.error) {
    throw materialsResult.error
  }

  if (stockTransactionsResult.error) {
    throw stockTransactionsResult.error
  }

  return {
    materials: (materialsResult.data ?? []).map(normalizeStockMaterialRow),
    stockTransactions: (stockTransactionsResult.data ?? []).map(normalizeStockTransactionRow),
  }
}

async function loadMaterialById(adminClient, materialId) {
  const normalizedMaterialId = normalizeText(materialId, null)

  if (!normalizedMaterialId) {
    throw createHttpError(400, 'Material ID tidak valid.')
  }

  const { data, error } = await adminClient
    .from('materials')
    .select(stockMaterialColumns)
    .eq('id', normalizedMaterialId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? normalizeStockMaterialRow(data) : null
}

async function loadActiveProjectsForTeam(adminClient, teamId) {
  const normalizedTeamId = normalizeText(teamId, null)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Team ID wajib diisi.')
  }

  const { data, error } = await adminClient
    .from('projects')
    .select('id, team_id, name, project_name, project_type, status, is_active')
    .eq('team_id', normalizedTeamId)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('project_name', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map(normalizeProjectOptionRow)
}

async function createManualStockOut(adminClient, body = {}, telegramUserId, createdByUserId = null) {
  const materialId = normalizeText(body.materialId ?? body.material_id, null)
  const teamId = normalizeText(body.teamId ?? body.team_id, null)
  const projectId = normalizeText(body.projectId ?? body.project_id, null)
  const rawQuantity = toNumber(body.quantity ?? body.qty)
  const notes = normalizeText(body.notes ?? body.reason, null)

  if (!materialId) {
    throw createHttpError(400, 'Material ID wajib diisi.')
  }

  if (!Number.isFinite(rawQuantity) || rawQuantity <= 0) {
    throw createHttpError(400, 'Qty stock-out harus lebih dari 0.')
  }

  if (!notes) {
    throw createHttpError(400, 'Catatan stock-out wajib diisi.')
  }

  const material = await loadMaterialById(adminClient, materialId)

  if (!material) {
    throw createHttpError(404, 'Material tidak ditemukan.')
  }

  const effectiveTeamId = await assertTeamAccess(adminClient, telegramUserId, teamId ?? material.team_id)

  if (normalizeText(material.team_id, null) !== effectiveTeamId) {
    throw createHttpError(404, 'Material tidak ditemukan.')
  }

  const { data, error } = await adminClient.rpc('fn_create_atomic_manual_stock_out', {
    p_telegram_user_id: telegramUserId,
    p_team_id: effectiveTeamId,
    p_project_id: projectId,
    p_material_id: material.id,
    p_quantity: Math.trunc(rawQuantity),
    p_notes: notes,
    p_created_by_user_id: createdByUserId,
  })

  if (error) {
    throw error
  }

  const result = Array.isArray(data) ? data[0] ?? null : data ?? null
  const updatedMaterial = result?.material ?? null
  const stockTransaction = result?.stock_transaction ?? null

  return {
    material: updatedMaterial ? normalizeStockMaterialRow(updatedMaterial) : null,
    stockTransaction: stockTransaction ? normalizeStockTransactionRow(stockTransaction) : null,
  }
}

async function loadDeletedExpenseAttachments(adminClient, teamId) {
  const normalizedTeamId = normalizeText(teamId)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Team ID wajib diisi.')
  }

  const { data: attachmentRows, error } = await adminClient
    .from('expense_attachments')
    .select(expenseAttachmentColumns)
    .eq('team_id', normalizedTeamId)
    .not('deleted_at', 'is', null)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const expenseIds = [
    ...new Set((attachmentRows ?? []).map((row) => normalizeText(row?.expense_id, null)).filter(Boolean)),
  ]

  if (expenseIds.length === 0) {
    return []
  }

  const { data: expenses, error: expenseError } = await adminClient
    .from('expenses')
    .select(
      'id, team_id, expense_type, document_type, expense_date, description, project_name_snapshot, supplier_name_snapshot, deleted_at'
    )
    .eq('team_id', normalizedTeamId)
    .in('id', expenseIds)

  if (expenseError) {
    throw expenseError
  }

  const expenseById = new Map((expenses ?? []).map((expense) => [expense.id, expense]))

  return (attachmentRows ?? [])
    .filter((row) => {
      const expense = expenseById.get(normalizeText(row?.expense_id, null))

      return Boolean(expense?.id) && !expense?.deleted_at
    })
    .map((row) => {
    const normalizedRow = normalizeExpenseAttachmentRow(row)
    const expense = expenseById.get(normalizedRow.expense_id) ?? null

    return {
      ...normalizedRow,
      expense: expense
        ? {
            id: expense.id ?? null,
            team_id: expense.team_id ?? null,
            expense_type: expense.expense_type ?? null,
            document_type: expense.document_type ?? null,
            expense_date: expense.expense_date ?? null,
            description: expense.description ?? null,
            project_name_snapshot: expense.project_name_snapshot ?? null,
            supplier_name_snapshot: expense.supplier_name_snapshot ?? null,
            deleted_at: expense.deleted_at ?? null,
          }
        : null,
    }
  })
}

async function loadExpenseContextById(adminClient, expenseId, { includeDeleted = true } = {}) {
  const normalizedExpenseId = normalizeText(expenseId)

  if (!normalizedExpenseId) {
    throw createHttpError(400, 'Expense ID tidak valid.')
  }

  let query = adminClient.from('expenses').select('id, team_id, deleted_at').eq('id', normalizedExpenseId)

  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw error
  }

  return data ?? null
}

async function loadExpenseAttachmentById(adminClient, attachmentId, { includeDeleted = true } = {}) {
  const normalizedAttachmentId = normalizeText(attachmentId)

  if (!normalizedAttachmentId) {
    throw createHttpError(400, 'Attachment ID tidak valid.')
  }

  let query = adminClient
    .from('expense_attachments')
    .select(expenseAttachmentColumns)
    .eq('id', normalizedAttachmentId)

  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw error
  }

  return data ? normalizeExpenseAttachmentRow(data) : null
}

async function upsertExpenseAttachment(adminClient, body, telegramUserId) {
  const expenseId = normalizeText(body.expenseId ?? body.expense_id ?? body.id, null)
  const fileAssetId = normalizeText(body.fileAssetId ?? body.file_asset_id, null)
  const teamId = normalizeText(body.teamId ?? body.team_id, null)
  const sortOrder = Number.isFinite(Number(body.sortOrder ?? body.sort_order))
    ? Number(body.sortOrder ?? body.sort_order)
    : 1

  if (!expenseId) {
    throw createHttpError(400, 'Expense ID wajib diisi.')
  }

  if (!fileAssetId) {
    throw createHttpError(400, 'File asset ID wajib diisi.')
  }

  const expense = await loadExpenseContextById(adminClient, expenseId, { includeDeleted: true })

  if (!expense?.id) {
    throw createHttpError(404, 'Parent expense tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, teamId ?? expense.team_id)

  const { data: fileAsset, error: fileAssetError } = await adminClient
    .from('file_assets')
    .select('id, team_id, deleted_at')
    .eq('id', fileAssetId)
    .maybeSingle()

  if (fileAssetError) {
    throw fileAssetError
  }

  if (!fileAsset?.id) {
    throw createHttpError(404, 'File asset tidak ditemukan.')
  }

  if (fileAsset.team_id !== expense.team_id) {
    throw createHttpError(403, 'File asset tidak berada pada team yang sama.')
  }

  if (fileAsset.deleted_at) {
    throw createHttpError(400, 'File asset terhapus harus dipulihkan lebih dulu.')
  }

  const timestamp = new Date().toISOString()
  const { data, error } = await adminClient
    .from('expense_attachments')
    .upsert(
      {
        expense_id: expense.id,
        team_id: expense.team_id,
        file_asset_id: fileAsset.id,
        sort_order: sortOrder,
        updated_at: timestamp,
        deleted_at: null,
      },
      {
        onConflict: 'expense_id,file_asset_id',
      }
    )
    .select(expenseAttachmentColumns)
    .single()

  if (error) {
    throw error
  }

  return normalizeExpenseAttachmentRow(data)
}

async function softDeleteExpenseAttachment(adminClient, body, telegramUserId) {
  const attachmentId = normalizeText(body.attachmentId ?? body.id, null)
  const teamId = normalizeText(body.teamId ?? body.team_id, null)

  if (!attachmentId) {
    throw createHttpError(400, 'Attachment ID wajib diisi.')
  }

  const attachment = await loadExpenseAttachmentById(adminClient, attachmentId, {
    includeDeleted: true,
  })

  if (!attachment?.id) {
    throw createHttpError(404, 'Lampiran tidak ditemukan.')
  }

  const expense = await loadExpenseContextById(adminClient, attachment.expense_id, {
    includeDeleted: true,
  })

  if (!expense?.id) {
    throw createHttpError(404, 'Parent expense tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, teamId ?? expense.team_id)

  const { data, error } = await adminClient
    .from('expense_attachments')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', attachment.id)
    .is('deleted_at', null)
    .select(expenseAttachmentColumns)
    .single()

  if (error) {
    throw error
  }

  return normalizeExpenseAttachmentRow(data)
}

async function restoreExpenseAttachment(adminClient, body, telegramUserId) {
  const attachmentId = normalizeText(body.attachmentId ?? body.id, null)
  const teamId = normalizeText(body.teamId ?? body.team_id, null)

  if (!attachmentId) {
    throw createHttpError(400, 'Attachment ID wajib diisi.')
  }

  const attachment = await loadExpenseAttachmentById(adminClient, attachmentId, {
    includeDeleted: true,
  })

  if (!attachment?.id) {
    throw createHttpError(404, 'Lampiran terhapus tidak ditemukan.')
  }

  const expense = await loadExpenseContextById(adminClient, attachment.expense_id, {
    includeDeleted: true,
  })

  if (!expense?.id) {
    throw createHttpError(404, 'Parent expense tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, teamId ?? expense.team_id)

  if (expense.deleted_at) {
    throw createHttpError(400, 'Parent pengeluaran masih ada di recycle bin. Pulihkan pengeluaran lebih dulu.')
  }

  const { data, error } = await adminClient
    .from('expense_attachments')
    .update({
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', attachment.id)
    .not('deleted_at', 'is', null)
    .select(expenseAttachmentColumns)
    .single()

  if (error) {
    throw error
  }

  return normalizeExpenseAttachmentRow(data)
}

async function permanentDeleteExpenseAttachment(adminClient, body, telegramUserId) {
  const attachmentId = normalizeText(body.attachmentId ?? body.id, null)
  const teamId = normalizeText(body.teamId ?? body.team_id, null)

  if (!attachmentId) {
    throw createHttpError(400, 'Attachment ID wajib diisi.')
  }

  const attachment = await loadExpenseAttachmentById(adminClient, attachmentId, {
    includeDeleted: true,
  })

  if (!attachment?.id) {
    return true
  }

  if (!attachment.deleted_at) {
    throw createHttpError(400, 'Lampiran harus ada di recycle bin sebelum dihapus permanen.')
  }

  const expense = await loadExpenseContextById(adminClient, attachment.expense_id, {
    includeDeleted: true,
  })

  if (!expense?.id) {
    throw createHttpError(404, 'Parent expense tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, teamId ?? expense.team_id)

  const { error } = await adminClient
    .from('expense_attachments')
    .delete()
    .eq('id', attachment.id)

  if (error) {
    throw error
  }

  return true
}

async function loadMaterialInvoiceLineItems(adminClient, expenseId) {
  const normalizedExpenseId = normalizeText(expenseId)

  if (!normalizedExpenseId) {
    throw createHttpError(400, 'Expense ID tidak valid.')
  }

  const { data, error } = await adminClient
    .from('expense_line_items')
    .select(materialInvoiceLineItemColumns)
    .eq('expense_id', normalizedExpenseId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map(normalizeMaterialInvoiceLineItem)
}

async function loadMaterialInvoiceById(adminClient, expenseId, { includeDeleted = false } = {}) {
  const expense = await loadExpenseById(adminClient, expenseId, { includeDeleted })

  if (!expense?.id) {
    return null
  }

  const items = await loadMaterialInvoiceLineItems(adminClient, expense.id)

  return {
    ...expense,
    items,
  }
}

async function syncMaterialInvoiceLineItems(adminClient, expenseId, itemsData = [], teamId = null) {
  const normalizedExpenseId = normalizeText(expenseId)
  const normalizedTeamId = normalizeText(teamId, null)

  let effectiveTeamId = normalizedTeamId

  if (!normalizedExpenseId) {
    throw createHttpError(400, 'Expense ID tidak valid.')
  }

  if (!effectiveTeamId) {
    const expense = await loadExpenseContextById(adminClient, normalizedExpenseId, {
      includeDeleted: true,
    })

    effectiveTeamId = normalizeText(expense?.team_id, null)
  }

  if (!effectiveTeamId) {
    throw createHttpError(400, 'Team faktur material tidak valid.')
  }

  const currentItems = await loadMaterialInvoiceLineItems(adminClient, normalizedExpenseId)
  const currentItemsById = new Map(currentItems.map((item) => [item.id, item]))
  const normalizedItems = Array.isArray(itemsData)
    ? itemsData.map((item, index) => {
        const materialId = normalizeText(item.material_id ?? item.materialId)
        const itemName = normalizeText(item.item_name ?? item.itemName ?? item.material_name)
        const qty = toNumber(item.qty)
        const unitPrice = toNumber(item.unit_price ?? item.unitPrice)
        const lineTotal = toNumber(item.line_total ?? item.lineTotal ?? qty * unitPrice)
        const sortOrder = Number.isFinite(Number(item.sort_order))
          ? Number(item.sort_order)
          : index + 1

        if (!materialId) {
          throw createHttpError(400, `Material pada baris ${index + 1} wajib dipilih.`)
        }

        if (!itemName) {
          throw createHttpError(400, `Nama item pada baris ${index + 1} tidak valid.`)
        }

        if (!Number.isFinite(qty) || qty <= 0) {
          throw createHttpError(400, `Qty pada baris ${index + 1} harus lebih dari 0.`)
        }

        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw createHttpError(400, `Harga satuan pada baris ${index + 1} tidak valid.`)
        }

        if (!Number.isFinite(lineTotal) || lineTotal < 0) {
          throw createHttpError(400, `Subtotal pada baris ${index + 1} tidak valid.`)
        }

        return {
          id: normalizeText(item.id, null),
          team_id: effectiveTeamId,
          material_id: materialId,
          item_name: itemName,
          qty,
          unit_price: unitPrice,
          line_total: lineTotal,
          sort_order: sortOrder,
        }
      })
    : []

  const nextIds = new Set(normalizedItems.map((item) => item.id).filter(Boolean))
  const deleteIds = currentItems
    .map((item) => item.id)
    .filter((itemId) => !nextIds.has(itemId))

  if (deleteIds.length > 0) {
    const { error } = await adminClient
      .from('expense_line_items')
      .delete()
      .in('id', deleteIds)

    if (error) {
      throw error
    }
  }

  await Promise.all(
    normalizedItems.map(async (item) => {
      const payload = {
        expense_id: normalizedExpenseId,
        team_id: effectiveTeamId,
        material_id: item.material_id,
        item_name: item.item_name,
        qty: item.qty,
        unit_price: item.unit_price,
        line_total: item.line_total,
        sort_order: item.sort_order,
      }

      if (item.id && currentItemsById.has(item.id)) {
        const { error } = await adminClient
          .from('expense_line_items')
          .update(payload)
          .eq('id', item.id)

        if (error) {
          throw error
        }

        return
      }

      const { error } = await adminClient
        .from('expense_line_items')
        .insert(payload)

      if (error) {
        throw error
      }
    })
  )

  return loadMaterialInvoiceLineItems(adminClient, normalizedExpenseId)
}

async function guardExpenseBillPayments(adminClient, billId) {
  const normalizedBillId = normalizeText(billId)

  if (!normalizedBillId) {
    throw createHttpError(400, 'Bill ID tidak valid.')
  }

  const { data: payments, error: paymentsError } = await adminClient
    .from('bill_payments')
    .select('id')
    .eq('bill_id', normalizedBillId)
    .is('deleted_at', null)
    .limit(1)

  if (paymentsError) {
    throw paymentsError
  }

  if ((payments ?? []).length > 0) {
    throw createHttpError(
      400,
      'Pengeluaran yang sudah memiliki pembayaran tidak bisa diubah atau dihapus.'
    )
  }

  return true
}

async function syncExpenseBill(adminClient, expense, bill, { deletedAt = null } = {}) {
  if (!expense?.id || !bill?.id) {
    throw createHttpError(500, 'Relasi bill pengeluaran tidak ditemukan.')
  }

  const timestamp = new Date().toISOString()
  const nextDeletedAt = deletedAt
  const nextStatus =
    nextDeletedAt !== null
      ? 'cancelled'
      : normalizeText(expense.status, 'unpaid')
  const nextPaidAmount =
    nextDeletedAt !== null
      ? 0
      : nextStatus === 'paid'
        ? toNumber(expense.total_amount ?? expense.amount, bill.paid_amount ?? 0)
        : toNumber(bill.paid_amount, 0)
  const nextPaidAt =
    nextDeletedAt !== null
      ? null
      : nextStatus === 'paid'
        ? bill.paid_at ?? expense.updated_at ?? expense.created_at ?? timestamp
        : null

  const { data: updatedBill, error } = await adminClient
    .from('bills')
    .update({
      team_id: expense.team_id,
      project_id: expense.project_id,
      supplier_id: expense.supplier_id,
      bill_type: expense.expense_type,
      description: expense.description,
      amount: expense.total_amount ?? expense.amount,
      due_date: expense.expense_date,
      status: nextStatus,
      paid_amount: nextPaidAmount,
      paid_at: nextPaidAt,
      deleted_at: nextDeletedAt,
      updated_at: timestamp,
    })
    .eq('id', bill.id)
    .select('id, expense_id, amount, paid_amount, due_date, status, paid_at, deleted_at')
    .single()

  if (error) {
    throw error
  }

  return updatedBill
}

async function createExpensePaymentFromBill(adminClient, expense, bill) {
  if (normalizeText(expense?.status, 'unpaid') !== 'paid') {
    return bill
  }

  const { data: existingPayments, error: existingPaymentsError } = await adminClient
    .from('bill_payments')
    .select('id')
    .eq('bill_id', bill.id)
    .is('deleted_at', null)
    .limit(1)

  if (existingPaymentsError) {
    throw existingPaymentsError
  }

  if ((existingPayments ?? []).length > 0) {
    return bill
  }

  const paymentDate = expense.expense_date ?? expense.created_at ?? new Date().toISOString()

  const { error: paymentError } = await adminClient.from('bill_payments').insert({
    bill_id: bill.id,
    telegram_user_id: expense.telegram_user_id,
    team_id: expense.team_id,
    amount: expense.total_amount ?? expense.amount,
    payment_date: paymentDate,
    notes: expense.description,
    worker_name_snapshot: null,
    supplier_name_snapshot: expense.supplier_name_snapshot,
    project_name_snapshot: expense.project_name_snapshot,
  })

  if (paymentError) {
    throw paymentError
  }

  return bill
}

async function createMaterialInvoiceBillFromExpense(adminClient, expense) {
  if (!expense?.id) {
    throw createHttpError(500, 'Faktur material tidak ditemukan.')
  }

  const status = normalizeText(expense.status, 'unpaid')

  if (normalizeText(expense.document_type, 'faktur') === 'surat_jalan' || status === 'delivery_order') {
    return null
  }

  const amount = toNumber(expense.total_amount ?? expense.amount)
  const billStatus = status === 'paid' ? 'paid' : 'unpaid'

  const { data: bill, error } = await adminClient
    .from('bills')
    .upsert(
      {
        expense_id: expense.id,
        telegram_user_id: expense.telegram_user_id,
        team_id: expense.team_id,
        project_id: expense.project_id,
        supplier_id: expense.supplier_id,
        bill_type: expense.expense_type,
        description: expense.description,
        amount,
        due_date: expense.expense_date,
        status: billStatus,
        paid_amount: billStatus === 'paid' ? amount : 0,
        paid_at: billStatus === 'paid' ? new Date().toISOString() : null,
        supplier_name_snapshot: expense.supplier_name_snapshot,
      },
      {
        onConflict: 'expense_id',
      }
    )
    .select('id, expense_id, amount, paid_amount, due_date, status, paid_at, deleted_at')
    .single()

  if (error) {
    throw error
  }

  if (billStatus === 'paid') {
    await createExpensePaymentFromBill(adminClient, expense, bill)
  }

  return bill
}

async function rollbackExpense(adminClient, expenseId) {
  if (!expenseId) {
    return null
  }

  const timestamp = new Date().toISOString()

  const { error } = await adminClient
    .from('expenses')
    .update({
      deleted_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', expenseId)
    .is('deleted_at', null)

  return error ?? null
}

async function upsertExpense(adminClient, body, authUserId, telegramUserId, teamId) {
  const normalizedExpenseId = normalizeText(body.id, null)
  const createdByUserId = normalizeText(body.created_by_user_id ?? body.createdByUserId, authUserId)
  const projectId = normalizeText(body.project_id ?? body.projectId)
  const categoryId = normalizeText(body.category_id ?? body.expense_category_id)
  const supplierId = normalizeText(body.supplier_id)
  const expenseType = normalizeText(body.expense_type, 'operasional')
  const expenseDate = normalizeText(body.expense_date ?? body.transaction_date)
  const status = normalizeText(body.status, 'unpaid')
  const description = normalizeText(body.description)
  const notes = normalizeText(body.notes)
  const amount = toNumber(body.amount)
  const projectNameSnapshot = normalizeText(body.project_name ?? body.projectName)
  const supplierName =
    normalizeText(body.supplier_name, null) ??
    normalizeText(body.supplierName, null) ??
    normalizeText(body.supplier_name_snapshot, null)
  const supplierNameSnapshot = supplierName
  const expectedUpdatedAt = normalizeText(
    body.expectedUpdatedAt ?? body.expected_updated_at,
    null
  )

  if (!telegramUserId) {
    throw createHttpError(403, 'ID pengguna Telegram tidak ditemukan.')
  }

  if (!createdByUserId) {
    throw createHttpError(403, 'Profile pembuat data tidak ditemukan.')
  }

  if (!projectId) {
    throw createHttpError(400, 'Proyek wajib dipilih.')
  }

  if (!categoryId) {
    throw createHttpError(400, 'Kategori pengeluaran wajib dipilih.')
  }

  if (!['operasional', 'lainnya'].includes(expenseType)) {
    throw createHttpError(400, 'Tipe pengeluaran tidak valid.')
  }

  if (!expenseDate) {
    throw createHttpError(400, 'Tanggal pengeluaran wajib diisi.')
  }

  if (!['unpaid', 'paid'].includes(status)) {
    throw createHttpError(400, 'Status pembayaran pengeluaran tidak valid.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw createHttpError(400, 'Nominal pengeluaran harus lebih dari 0.')
  }

  if (!description) {
    throw createHttpError(400, 'Deskripsi pengeluaran wajib diisi.')
  }

  if (!supplierName) {
    throw createHttpError(400, 'Nama supplier wajib diisi.')
  }

  const payload = {
    project_id: projectId,
    category_id: categoryId,
    supplier_id: supplierId,
    supplier_name: supplierName,
    expense_type: expenseType,
    document_type: 'faktur',
    status,
    expense_date: expenseDate,
    amount,
    total_amount: amount,
    description,
    notes,
    project_name_snapshot: projectNameSnapshot,
    supplier_name_snapshot: supplierNameSnapshot,
    updated_at: new Date().toISOString(),
  }

  if (normalizedExpenseId) {
    const expense = await loadExpenseById(adminClient, normalizedExpenseId, {
      includeDeleted: true,
    })

    if (!expense?.id) {
      throw createHttpError(404, 'Pengeluaran tidak ditemukan.')
    }

    if (!expense.bill?.id) {
      throw createHttpError(500, 'Tagihan pengeluaran tidak ditemukan.')
    }

    await guardExpenseBillPayments(adminClient, expense.bill.id)

    if (expense.deleted_at) {
      throw createHttpError(
        400,
        'Pengeluaran terhapus harus dipulihkan lebih dulu sebelum bisa diedit.'
      )
    }

    assertOptimisticConcurrency(expectedUpdatedAt, expense.updated_at, 'Pengeluaran')

    const { data: updatedExpense, error: expenseError } = await adminClient
      .from('expenses')
      .update(payload)
      .eq('id', normalizedExpenseId)
      .is('deleted_at', null)
      .select(expenseSelectColumns)
      .single()

    if (expenseError) {
      throw expenseError
    }

    const updatedBill = await syncExpenseBill(adminClient, updatedExpense, expense.bill)

    if (status === 'paid') {
      await createExpensePaymentFromBill(adminClient, updatedExpense, updatedBill)
    }

    const refreshedExpense = await loadExpenseById(adminClient, normalizedExpenseId, {
      includeDeleted: false,
    })

    if (!refreshedExpense?.id) {
      throw createHttpError(500, 'Pengeluaran gagal dimuat ulang setelah update.')
    }

    return refreshedExpense
  }

  const insertPayload = {
    telegram_user_id: telegramUserId,
    created_by_user_id: createdByUserId,
    team_id: teamId,
    ...payload,
  }

  const { data: insertedExpense, error: expenseError } = await adminClient
    .from('expenses')
    .insert(insertPayload)
    .select(expenseSelectColumns)
    .single()

  if (expenseError) {
    throw expenseError
  }

  const { data: insertedBill, error: billError } = await adminClient
    .from('bills')
    .select('id, expense_id, amount, paid_amount, due_date, status, paid_at, deleted_at')
    .eq('expense_id', insertedExpense.id)
    .maybeSingle()

  if (billError) {
    throw billError
  }

  if (!insertedBill?.id) {
    throw createHttpError(500, 'Tagihan pengeluaran gagal dibuat.')
  }

  if (status === 'paid') {
    await createExpensePaymentFromBill(adminClient, insertedExpense, insertedBill)
  }

  return loadExpenseById(adminClient, insertedExpense.id, { includeDeleted: false })
}

async function upsertMaterialSupplier(adminClient, supplierName, teamId) {
  const normalizedSupplierName = normalizeText(supplierName)
  const normalizedTeamId = normalizeText(teamId)

  if (!normalizedSupplierName) {
    throw createHttpError(400, 'Nama supplier wajib diisi.')
  }

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Akses workspace tidak ditemukan.')
  }

  const { data: existingSupplier, error: existingSupplierError } = await adminClient
    .from('suppliers')
    .select('id, name, supplier_name, supplier_type, team_id')
    .eq('team_id', normalizedTeamId)
    .is('deleted_at', null)
    .eq('supplier_type', 'Material')
    .ilike('name', normalizedSupplierName)
    .maybeSingle()

  if (existingSupplierError) {
    throw existingSupplierError
  }

  if (existingSupplier?.id) {
    return existingSupplier
  }

  const { data, error } = await adminClient
    .from('suppliers')
    .insert({
      name: normalizedSupplierName,
      supplier_type: 'Material',
      team_id: normalizedTeamId,
      is_active: true,
    })
    .select('id, name, supplier_name, supplier_type, team_id')
    .single()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw createHttpError(500, 'Supplier gagal dipersiapkan.')
  }

  return data
}

async function loadSupplierById(adminClient, supplierId, teamId = null) {
  const normalizedSupplierId = normalizeText(supplierId, null)
  const normalizedTeamId = normalizeText(teamId, null)

  if (!normalizedSupplierId) {
    return null
  }

  const supplierQuery = adminClient
    .from('suppliers')
    .select('id, name, supplier_name, supplier_type, team_id')
    .eq('id', normalizedSupplierId)

  if (normalizedTeamId) {
    supplierQuery.eq('team_id', normalizedTeamId)
  }

  const { data, error } = await supplierQuery.maybeSingle()

  if (error) {
    throw error
  }

  return data ?? null
}

async function resolveMaterialSupplier(adminClient, { supplierId = null, supplierName = null, teamId }) {
  const existingSupplier = await loadSupplierById(adminClient, supplierId, teamId)

  if (existingSupplier?.id) {
    if (normalizeText(existingSupplier.supplier_type, '').toLowerCase() !== 'material') {
      throw createHttpError(400, 'Supplier faktur material harus bertipe Material.')
    }

    return existingSupplier
  }

  if (!normalizeText(supplierName, null)) {
    throw createHttpError(400, 'Supplier material wajib dipilih.')
  }

  return upsertMaterialSupplier(adminClient, supplierName, teamId)
}

async function createMaterialInvoice(adminClient, body, authUserId, telegramUserId, teamId) {
  const headerData = body?.headerData ?? {}
  const itemsData = Array.isArray(body?.itemsData) ? body.itemsData : []
  const projectId = normalizeText(headerData.project_id ?? headerData.projectId)
  const supplierId = normalizeText(headerData.supplier_id ?? headerData.supplierId)
  const supplierName = normalizeText(headerData.supplier_name ?? headerData.supplierName)
  const expenseDate = normalizeText(headerData.expense_date ?? headerData.expenseDate)
  const documentType = normalizeText(headerData.document_type ?? headerData.documentType, 'faktur')
  const status =
    documentType === 'surat_jalan'
      ? 'delivery_order'
      : normalizeText(headerData.status, 'paid')
  const expenseType = getMaterialInvoiceExpenseType(documentType)
  const description = normalizeText(headerData.description)
  const notes = normalizeText(headerData.notes)
  const projectNameSnapshot = normalizeText(
    headerData.project_name_snapshot ?? headerData.project_name ?? headerData.projectName,
    '-'
  )

  if (!projectId) {
    throw createHttpError(400, 'Proyek faktur material wajib dipilih.')
  }

  if (!supplierName) {
    throw createHttpError(400, 'Nama supplier wajib diisi.')
  }

  if (!expenseDate) {
    throw createHttpError(400, 'Tanggal faktur wajib diisi.')
  }

  if (!['faktur', 'surat_jalan'].includes(documentType)) {
    throw createHttpError(400, 'Jenis dokumen material tidak valid.')
  }

  if (!['paid', 'unpaid', 'delivery_order'].includes(status)) {
    throw createHttpError(400, 'Status pembayaran faktur tidak valid.')
  }

  if (!Array.isArray(itemsData) || itemsData.length === 0) {
    throw createHttpError(400, 'Minimal satu item material harus diisi.')
  }

  const isDeliveryOrder = documentType === 'surat_jalan'

  const normalizedItems = itemsData.map((item, index) => {
    const materialId = normalizeText(item.material_id ?? item.materialId)
    const itemName = normalizeText(item.item_name ?? item.itemName ?? item.material_name)
    const qty = toNumber(item.qty)
    const unitPrice = isDeliveryOrder ? 0 : toNumber(item.unit_price ?? item.unitPrice)
    const computedLineTotal = qty * unitPrice

    if (!materialId) {
      throw createHttpError(400, `Material pada baris ${index + 1} wajib dipilih.`)
    }

    if (!itemName) {
      throw createHttpError(400, `Nama item pada baris ${index + 1} tidak valid.`)
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      throw createHttpError(400, `Qty pada baris ${index + 1} harus lebih dari 0.`)
    }

    if (!isDeliveryOrder && (!Number.isFinite(unitPrice) || unitPrice <= 0)) {
      throw createHttpError(400, `Harga satuan pada baris ${index + 1} harus lebih dari 0.`)
    }

    if (!isDeliveryOrder && (!Number.isFinite(computedLineTotal) || computedLineTotal <= 0)) {
      throw createHttpError(400, `Subtotal pada baris ${index + 1} tidak valid.`)
    }

    return {
      material_id: materialId,
      item_name: itemName,
      qty,
      unit_price: unitPrice,
      line_total: isDeliveryOrder ? 0 : computedLineTotal,
      sort_order: index + 1,
    }
  })

  const totalAmount = normalizedItems.reduce((sum, item) => sum + item.line_total, 0)
  const supplier = await resolveMaterialSupplier(adminClient, {
    supplierId,
    supplierName,
    teamId,
  })
  const expenseInsertPayload = {
    telegram_user_id: telegramUserId,
    created_by_user_id: authUserId,
    team_id: teamId,
    project_id: projectId,
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    supplier_name_snapshot: supplier.name,
    project_name_snapshot: projectNameSnapshot,
    expense_type: expenseType,
    document_type: documentType,
    status,
    expense_date: expenseDate,
    amount: totalAmount,
    total_amount: totalAmount,
    description,
    notes,
  }

  const { data: insertedExpense, error: expenseError } = await adminClient
    .from('expenses')
    .insert(expenseInsertPayload)
    .select(
      'id, telegram_user_id, created_by_user_id, team_id, project_id, supplier_id, supplier_name_snapshot, project_name_snapshot, expense_type, document_type, status, expense_date, amount, total_amount, description, notes, created_at, updated_at, deleted_at'
    )
    .single()

  if (expenseError) {
    throw expenseError
  }

  const expenseId = insertedExpense?.id ?? null

  if (!expenseId) {
    throw createHttpError(500, 'ID faktur material gagal dibuat.')
  }

  const lineItemsPayload = normalizedItems.map((item) => ({
    ...item,
    expense_id: expenseId,
    team_id: insertedExpense.team_id ?? teamId,
  }))

  const { error: lineItemsError } = await adminClient
    .from('expense_line_items')
    .insert(lineItemsPayload)

  if (lineItemsError) {
    const rollbackError = await rollbackExpense(adminClient, expenseId)

    if (rollbackError) {
      throw createHttpError(
        500,
        `Gagal menyimpan item faktur material. Rollback header juga gagal: ${formatRecordError(rollbackError)}`
      )
    }

    throw createHttpError(
      500,
      `Gagal menyimpan item faktur material: ${formatRecordError(lineItemsError)}`
    )
  }

  const createdLineItems = await loadMaterialInvoiceLineItems(adminClient, expenseId)

  await syncMaterialInvoiceStockMovement(adminClient, {
    expenseId,
    previousItems: [],
    nextItems: createdLineItems,
    mode: 'create',
    documentType,
    teamId: insertedExpense.team_id ?? teamId,
    projectId: insertedExpense.project_id ?? projectId,
    expenseDate,
  })

  return {
    expense: insertedExpense,
    items: lineItemsPayload,
    totalAmount,
  }
}

async function updateMaterialInvoice(adminClient, body, authUserId, telegramUserId, teamId) {
  const headerData = body?.headerData ?? {}
  const itemsData = Array.isArray(body?.itemsData) ? body.itemsData : []
  const normalizedExpenseId = normalizeText(
    body.expenseId ?? body.id ?? headerData.expenseId ?? headerData.id,
    null
  )

  if (!normalizedExpenseId) {
    throw createHttpError(400, 'Expense ID wajib diisi.')
  }

  const existingExpense = await loadMaterialInvoiceById(adminClient, normalizedExpenseId, {
    includeDeleted: true,
  })

  if (!existingExpense?.id) {
    throw createHttpError(404, 'Faktur material tidak ditemukan.')
  }

  if (!materialInvoiceExpenseTypes.has(normalizeText(existingExpense.expense_type, ''))) {
    throw createHttpError(400, 'Record yang dipilih bukan faktur material.')
  }

  const projectId = normalizeText(headerData.project_id ?? headerData.projectId)
  const supplierId = normalizeText(headerData.supplier_id ?? headerData.supplierId)
  const supplierName = normalizeText(headerData.supplier_name ?? headerData.supplierName)
  const expenseDate = normalizeText(headerData.expense_date ?? headerData.expenseDate)
  const documentType = normalizeText(headerData.document_type ?? headerData.documentType, 'faktur')
  const status =
    documentType === 'surat_jalan'
      ? 'delivery_order'
      : normalizeText(headerData.status, 'paid')
  const expenseType = getMaterialInvoiceExpenseType(documentType)
  const description = normalizeText(headerData.description)
  const notes = normalizeText(headerData.notes)
  const projectNameSnapshot = normalizeText(
    headerData.project_name_snapshot ?? headerData.project_name ?? headerData.projectName,
    '-'
  )
  const expectedUpdatedAt = normalizeText(
    headerData.expectedUpdatedAt ?? headerData.expected_updated_at,
    null
  )

  if (existingExpense.deleted_at) {
    throw createHttpError(
      400,
      'Faktur material terhapus harus dipulihkan lebih dulu sebelum bisa diedit.'
    )
  }

  assertOptimisticConcurrency(expectedUpdatedAt, existingExpense.updated_at, 'Faktur material')

  if (!projectId) {
    throw createHttpError(400, 'Proyek faktur material wajib dipilih.')
  }

  if (!supplierName) {
    throw createHttpError(400, 'Nama supplier wajib diisi.')
  }

  if (!expenseDate) {
    throw createHttpError(400, 'Tanggal faktur wajib diisi.')
  }

  if (!['faktur', 'surat_jalan'].includes(documentType)) {
    throw createHttpError(400, 'Jenis dokumen material tidak valid.')
  }

  if (!['paid', 'unpaid', 'delivery_order'].includes(status)) {
    throw createHttpError(400, 'Status pembayaran faktur tidak valid.')
  }

  if (!Array.isArray(itemsData) || itemsData.length === 0) {
    throw createHttpError(400, 'Minimal satu item material harus diisi.')
  }

  const isDeliveryOrder = documentType === 'surat_jalan'

  const normalizedItems = itemsData.map((item, index) => {
    const materialId = normalizeText(item.material_id ?? item.materialId)
    const itemName = normalizeText(item.item_name ?? item.itemName ?? item.material_name)
    const qty = toNumber(item.qty)
    const unitPrice = isDeliveryOrder ? 0 : toNumber(item.unit_price ?? item.unitPrice)
    const computedLineTotal = qty * unitPrice

    if (!materialId) {
      throw createHttpError(400, `Material pada baris ${index + 1} wajib dipilih.`)
    }

    if (!itemName) {
      throw createHttpError(400, `Nama item pada baris ${index + 1} tidak valid.`)
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      throw createHttpError(400, `Qty pada baris ${index + 1} harus lebih dari 0.`)
    }

    if (!isDeliveryOrder && (!Number.isFinite(unitPrice) || unitPrice <= 0)) {
      throw createHttpError(400, `Harga satuan pada baris ${index + 1} harus lebih dari 0.`)
    }

    if (!isDeliveryOrder && (!Number.isFinite(computedLineTotal) || computedLineTotal <= 0)) {
      throw createHttpError(400, `Subtotal pada baris ${index + 1} tidak valid.`)
    }

    return {
      id: normalizeText(item.id, null),
      material_id: materialId,
      item_name: itemName,
      qty,
      unit_price: unitPrice,
      line_total: isDeliveryOrder ? 0 : computedLineTotal,
      sort_order: Number.isFinite(Number(item.sort_order)) ? Number(item.sort_order) : index + 1,
    }
  })

  const totalAmount = normalizedItems.reduce((sum, item) => sum + item.line_total, 0)
  const effectiveTeamId = teamId ?? existingExpense.team_id
  const supplier = await resolveMaterialSupplier(adminClient, {
    supplierId,
    supplierName,
    teamId: effectiveTeamId,
  })

  const updatePayload = {
    telegram_user_id: existingExpense.telegram_user_id ?? telegramUserId,
    created_by_user_id: existingExpense.created_by_user_id ?? authUserId,
    team_id: effectiveTeamId,
    project_id: projectId,
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    supplier_name_snapshot: supplier.name,
    project_name_snapshot: projectNameSnapshot,
    expense_type: expenseType,
    document_type: documentType,
    status,
    expense_date: expenseDate,
    amount: totalAmount,
    total_amount: totalAmount,
    description,
    notes,
    updated_at: new Date().toISOString(),
  }

  const { data: updatedExpense, error: expenseError } = await adminClient
    .from('expenses')
    .update(updatePayload)
    .eq('id', normalizedExpenseId)
    .is('deleted_at', null)
    .select(
      'id, telegram_user_id, created_by_user_id, team_id, project_id, supplier_id, supplier_name_snapshot, project_name_snapshot, expense_type, document_type, status, expense_date, amount, total_amount, description, notes, created_at, updated_at, deleted_at'
    )
    .single()

  if (expenseError) {
    throw expenseError
  }

  let updatedLineItems

  try {
    updatedLineItems = await syncMaterialInvoiceLineItems(
      adminClient,
      normalizedExpenseId,
      normalizedItems,
      effectiveTeamId
    )
  } catch (lineItemsError) {
    throw createHttpError(
      500,
      `Gagal sinkronisasi item faktur material: ${formatRecordError(lineItemsError)}`
    )
  }

  if (existingExpense.bill?.id) {
    await guardExpenseBillPayments(adminClient, existingExpense.bill.id)

    const updatedBill = await syncExpenseBill(adminClient, updatedExpense, existingExpense.bill, {
      deletedAt: null,
    })

    if (status === 'paid') {
      await createExpensePaymentFromBill(adminClient, updatedExpense, updatedBill)
    }
  } else {
    await createMaterialInvoiceBillFromExpense(adminClient, updatedExpense)
  }

  await syncMaterialInvoiceStockMovement(adminClient, {
    expenseId: normalizedExpenseId,
    previousItems: Array.isArray(existingExpense.items) ? existingExpense.items : [],
    nextItems: Array.isArray(updatedLineItems) ? updatedLineItems : [],
    mode: 'update',
    documentType,
    teamId: effectiveTeamId ?? updatedExpense.team_id,
    projectId: updatedExpense.project_id ?? projectId,
    expenseDate: updatedExpense.expense_date ?? expenseDate,
  })

  const refreshedExpense = await loadMaterialInvoiceById(adminClient, normalizedExpenseId, {
    includeDeleted: false,
  })

  if (!refreshedExpense?.id) {
    throw createHttpError(500, 'Faktur material gagal dimuat ulang setelah update.')
  }

  return {
    ...refreshedExpense,
    items: updatedLineItems,
  }
}

async function loadAttendanceEntries(adminClient, teamId, date, projectId) {
  const normalizedTeamId = normalizeText(teamId)
  const normalizedDate = normalizeText(date)
  const normalizedProjectId = normalizeText(projectId)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Akses workspace tidak ditemukan.')
  }

  if (!normalizedDate) {
    throw createHttpError(400, 'Tanggal absensi wajib dipilih.')
  }

  if (!normalizedProjectId) {
    throw createHttpError(400, 'Proyek absensi wajib dipilih.')
  }

  const data = await runAttendanceQueryWithFallback(async (includeOvertimeFee) => {
    const { data: nextData, error } = await adminClient
      .from('attendance_records')
      .select(
        includeOvertimeFee ? attendanceSelectColumns : attendanceSelectColumnsWithoutOvertimeFee
      )
      .eq('team_id', normalizedTeamId)
      .eq('attendance_date', normalizedDate)
      .eq('project_id', normalizedProjectId)
      .is('deleted_at', null)
      .order('worker_name_snapshot', { ascending: true })
      .order('created_at', { ascending: true })

    return { data: nextData, error }
  })

  return (data ?? []).map(normalizeAttendanceRow)
}

function resolveAttendanceMonthRange(monthValue) {
  const normalizedMonthValue = normalizeText(monthValue, '')

  if (!/^\d{4}-\d{2}$/.test(normalizedMonthValue)) {
    return null
  }

  const [yearPart, monthPart] = normalizedMonthValue.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }

  const startDate = `${yearPart}-${monthPart}-01`
  const nextMonthDate = new Date(Date.UTC(year, month, 1))
  const endDate = nextMonthDate.toISOString().slice(0, 10)

  return {
    startDate,
    endDate,
  }
}

function buildAttendanceHistorySummary(rows = []) {
  const dailyGroups = new Map()
  const workerGroups = new Map()

  for (const row of rows) {
    const dateKey = normalizeText(row?.attendance_date, null)
    const workerId = normalizeText(row?.worker_id, null)
    const workerName = normalizeText(row?.worker_name_snapshot, 'Pekerja')
    const projectName = normalizeText(row?.project_name_snapshot, 'Proyek')
    const billingStatus = normalizeText(row?.billing_status, 'unbilled').toLowerCase()
    const hasSalaryBill = Boolean(normalizeText(row?.salary_bill_id, null))
    const totalPay = toNumber(row?.total_pay)
    const isRecapable = billingStatus === 'unbilled' && totalPay > 0 && !hasSalaryBill

    if (dateKey) {
      const nextDailyGroup =
        dailyGroups.get(dateKey) ?? {
          dateKey,
          recordCount: 0,
          billedCount: 0,
          unbilledCount: 0,
          totalPay: 0,
          workerIds: new Set(),
        }

      nextDailyGroup.recordCount += 1
      nextDailyGroup.totalPay += Number.isFinite(totalPay) ? totalPay : 0

      if (workerId) {
        nextDailyGroup.workerIds.add(workerId)
      }

      if (billingStatus === 'billed') {
        nextDailyGroup.billedCount += 1
      } else {
        nextDailyGroup.unbilledCount += 1
      }

      if (isRecapable) {
        nextDailyGroup.recapableCount = (nextDailyGroup.recapableCount ?? 0) + 1
      }

      dailyGroups.set(dateKey, nextDailyGroup)
    }

    const workerKey = workerId || workerName

    if (workerKey) {
      const nextWorkerGroup =
        workerGroups.get(workerKey) ?? {
          workerId: workerId || null,
          workerName,
          recordCount: 0,
          billedCount: 0,
          unbilledCount: 0,
          recapableCount: 0,
          totalPay: 0,
          firstDate: null,
          lastDate: null,
          projectNames: new Set(),
        }

      nextWorkerGroup.recordCount += 1
      nextWorkerGroup.totalPay += Number.isFinite(totalPay) ? totalPay : 0

      if (projectName) {
        nextWorkerGroup.projectNames.add(projectName)
      }

      if (!nextWorkerGroup.firstDate || compareText(dateKey, nextWorkerGroup.firstDate) < 0) {
        nextWorkerGroup.firstDate = dateKey
      }

      if (!nextWorkerGroup.lastDate || compareText(dateKey, nextWorkerGroup.lastDate) > 0) {
        nextWorkerGroup.lastDate = dateKey
      }

      if (billingStatus === 'billed') {
        nextWorkerGroup.billedCount += 1
      } else {
        nextWorkerGroup.unbilledCount += 1
      }

      if (isRecapable) {
        nextWorkerGroup.recapableCount += 1
      }

      workerGroups.set(workerKey, nextWorkerGroup)
    }
  }

  return {
    dailyGroups: [...dailyGroups.values()]
      .map((group) => ({
        dateKey: group.dateKey,
        title: group.dateKey,
        description: `${group.recordCount} terabsen`,
        recordCount: group.recordCount,
        billedCount: group.billedCount,
        unbilledCount: group.unbilledCount,
        totalPay: group.totalPay,
        workerIds: [...group.workerIds],
        recapableCount: group.recapableCount ?? 0,
      }))
      .sort((left, right) => compareText(right.dateKey, left.dateKey)),
    workerGroups: [...workerGroups.values()]
      .map((group) => ({
        workerId: group.workerId,
        workerName: group.workerName,
        title: group.workerName,
        description: `${group.recordCount} record`,
        recordCount: group.recordCount,
        billedCount: group.billedCount,
        unbilledCount: group.unbilledCount,
        totalPay: group.totalPay,
        firstDate: group.firstDate,
        lastDate: group.lastDate,
        projectNames: [...group.projectNames],
        recapableCount: group.recapableCount ?? 0,
      }))
      .sort((left, right) => compareText(left.workerName, right.workerName)),
  }
}

async function loadAttendanceHistorySummary(adminClient, teamId, { month = null } = {}) {
  const normalizedTeamId = normalizeText(teamId)
  const monthRange = resolveAttendanceMonthRange(month)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Akses workspace tidak ditemukan.')
  }

  const data = await runAttendanceQueryWithFallback(async (includeOvertimeFee) => {
    let query = adminClient
      .from('attendance_records')
      .select(
        includeOvertimeFee
          ? attendanceHistorySummaryColumns
          : attendanceHistorySummaryColumnsWithoutOvertimeFee
      )
      .eq('team_id', normalizedTeamId)
      .is('deleted_at', null)

    if (monthRange) {
      query = query
        .gte('attendance_date', monthRange.startDate)
        .lt('attendance_date', monthRange.endDate)
    }

    const { data: nextData, error } = await query

    return { data: nextData, error }
  })

  const summaries = buildAttendanceHistorySummary(data ?? [])

  return {
    month: normalizeText(month, null),
    attendanceCount: (data ?? []).length,
    dailyGroups: summaries.dailyGroups,
    workerGroups: summaries.workerGroups,
  }
}

async function loadAttendanceHistory(
  adminClient,
  teamId,
  { month = null, workerId = null, workerName = null, date = null } = {}
) {
  const normalizedTeamId = normalizeText(teamId)
  const normalizedWorkerId = normalizeText(workerId, null)
  const normalizedWorkerName = normalizeText(workerName, null)
  const normalizedDate = normalizeText(date, null)
  const monthRange = resolveAttendanceMonthRange(month)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Akses workspace tidak ditemukan.')
  }

  const data = await runAttendanceQueryWithFallback(async (includeOvertimeFee) => {
    let query = adminClient
      .from('attendance_records')
      .select(
        includeOvertimeFee ? attendanceDetailSelectColumns : attendanceDetailSelectColumnsWithoutOvertimeFee
      )
      .eq('team_id', normalizedTeamId)
      .is('deleted_at', null)
      .order('worker_name_snapshot', { ascending: true })
      .order('attendance_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (monthRange) {
      query = query
        .gte('attendance_date', monthRange.startDate)
        .lt('attendance_date', monthRange.endDate)
    }

    if (normalizedWorkerId) {
      query = query.eq('worker_id', normalizedWorkerId)
    }

    if (normalizedWorkerName) {
      query = query.eq('worker_name_snapshot', normalizedWorkerName)
    }

    if (normalizedDate) {
      query = query.eq('attendance_date', normalizedDate)
    }

    const { data: nextData, error } = await query

    return { data: nextData, error }
  })

  return (data ?? []).map(normalizeAttendanceDetailRow)
}

async function loadAttendanceRowsByIds(adminClient, attendanceIds = []) {
  const normalizedAttendanceIds = [...new Set(attendanceIds.map((value) => normalizeText(value)))].filter(Boolean)

  if (normalizedAttendanceIds.length === 0) {
    return new Map()
  }

  const data = await runAttendanceQueryWithFallback(async (includeOvertimeFee) => {
    const { data: nextData, error } = await adminClient
      .from('attendance_records')
      .select(
        includeOvertimeFee ? attendanceRowsByIdsColumns : attendanceRowsByIdsColumnsWithoutOvertimeFee
      )
      .in('id', normalizedAttendanceIds)

    return { data: nextData, error }
  })

  return new Map((data ?? []).map((row) => [row.id, row]))
}

async function createAttendanceRecap(adminClient, body, telegramUserId) {
  const teamId = normalizeText(body.teamId ?? body.team_id, null)
  const workerId = normalizeText(body.workerId ?? body.worker_id, null)
  const dueDate = normalizeText(body.dueDate ?? body.due_date, null)
  const recordIds = [
    ...new Set(
      (Array.isArray(body.recordIds) ? body.recordIds : body.record_ids ?? [])
        .map((value) => normalizeText(value, null))
        .filter(Boolean)
    ),
  ]

  if (!telegramUserId) {
    throw createHttpError(403, 'Profile Telegram tidak ditemukan.')
  }

  if (!teamId) {
    throw createHttpError(400, 'Team ID wajib diisi.')
  }

  if (!workerId) {
    throw createHttpError(400, 'Worker ID wajib diisi.')
  }

  if (recordIds.length === 0) {
    throw createHttpError(400, 'Record absensi wajib diisi.')
  }

  const effectiveTeamId = await assertTeamAccess(adminClient, telegramUserId, teamId)
  const attendanceRowsById = await loadAttendanceRowsByIds(adminClient, recordIds)

  if (attendanceRowsById.size !== recordIds.length) {
    throw createHttpError(400, 'Sebagian absensi tidak ditemukan.')
  }

  const orderedRows = recordIds.map((recordId) => attendanceRowsById.get(recordId)).filter(Boolean)
  const invalidRows = orderedRows.filter((row) => {
    if (!row || row.deleted_at) {
      return true
    }

    return (
      normalizeText(row.team_id, null) !== effectiveTeamId ||
      normalizeText(row.worker_id, null) !== workerId
    )
  })

  if (invalidRows.length > 0) {
    throw createHttpError(400, 'Konteks rekap tidak valid.')
  }

  const eligibleRows = orderedRows.filter((row) => {
    const billingStatus = normalizeText(row.billing_status, 'unbilled')

    return billingStatus === 'unbilled' && !normalizeText(row.salary_bill_id, null)
  })

  if (eligibleRows.length === 0) {
    throw createHttpError(400, 'Tidak ada absensi yang bisa direkap.')
  }

  const totalAmount = eligibleRows.reduce((sum, row) => sum + toNumber(row.total_pay), 0)
  const attendanceCount = eligibleRows.length
  const workerName = normalizeText(
    eligibleRows[0]?.worker_name_snapshot ?? orderedRows[0]?.worker_name_snapshot,
    'Pekerja'
  )
  const finalDescription = `Tagihan gaji untuk ${workerName} (${attendanceCount} absensi)`

  if (totalAmount <= 0) {
    throw createHttpError(400, 'Total rekap tidak valid.')
  }

  const { data, error } = await adminClient.rpc('fn_generate_salary_bill', {
    p_worker_id: workerId,
    p_record_ids: eligibleRows.map((row) => row.id),
    p_total_amount: totalAmount,
    p_due_date: dueDate ?? new Date().toISOString().slice(0, 10),
    p_description: finalDescription,
  })

  if (error) {
    throw error
  }

  return {
    billId: Array.isArray(data) ? data[0] : data ?? null,
    attendanceCount,
    totalAmount,
    description: finalDescription,
  }
}

async function loadAttendanceById(adminClient, attendanceId, { includeDeleted = true } = {}) {
  const normalizedAttendanceId = normalizeText(attendanceId)

  if (!normalizedAttendanceId) {
    throw createHttpError(400, 'Attendance ID wajib diisi.')
  }

  const data = await runAttendanceQueryWithFallback(async (includeOvertimeFee) => {
    let query = adminClient
      .from('attendance_records')
      .select(
        includeOvertimeFee ? attendanceDetailSelectColumns : attendanceDetailSelectColumnsWithoutOvertimeFee
      )
      .eq('id', normalizedAttendanceId)

    if (!includeDeleted) {
      query = query.is('deleted_at', null)
    }

    const { data: nextData, error } = await query.maybeSingle()

    return { data: nextData, error }
  })

  return data ? normalizeAttendanceDetailRow(data) : null
}

async function loadUnbilledAttendances(adminClient, teamId) {
  const normalizedTeamId = normalizeText(teamId)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Akses workspace tidak ditemukan.')
  }

  const data = await runAttendanceQueryWithFallback(async (includeOvertimeFee) => {
    const { data: nextData, error } = await adminClient
      .from('attendance_records')
      .select(
        includeOvertimeFee ? attendanceSelectColumns : attendanceSelectColumnsWithoutOvertimeFee
      )
      .is('deleted_at', null)
      .eq('billing_status', 'unbilled')
      .eq('team_id', normalizedTeamId)
      .order('attendance_date', { ascending: true })
      .order('created_at', { ascending: true })

    return { data: nextData, error }
  })

  return (data ?? []).map(normalizeAttendanceRow)
}

async function persistAttendanceSheet(adminClient, body, telegramUserId, teamId) {
  const normalizedDate = normalizeText(body.attendance_date ?? body.date ?? body.attendanceDate)
  const normalizedProjectId = normalizeText(body.project_id ?? body.projectId)
  const normalizedRows = Array.isArray(body.rows) ? body.rows : []
  const rowsToPersist = normalizedRows
    .map((row) => ({
      sourceId: normalizeText(row?.sourceId ?? row?.id, null),
      worker_id: normalizeText(row?.worker_id ?? row?.workerId),
      worker_name: normalizeText(row?.worker_name ?? row?.workerName, null),
      project_id: normalizedProjectId,
      project_name: normalizeText(row?.project_name ?? row?.projectName, null),
      attendance_status: normalizeText(
        row?.attendance_status ?? row?.attendanceStatus,
        null
      ),
      overtime_fee:
        normalizeText(row?.attendance_status ?? row?.attendanceStatus, null) === 'overtime'
          ? Number.isFinite(toNumber(row?.overtime_fee ?? row?.overtimeFee))
            ? toNumber(row?.overtime_fee ?? row?.overtimeFee)
            : 0
          : null,
      total_pay: toNumber(row?.total_pay ?? row?.totalPay),
      notes: normalizeText(row?.notes, null),
    }))
    .filter((row) => row.worker_id || row.sourceId)

  if (!normalizedDate) {
    throw createHttpError(400, 'Tanggal absensi wajib dipilih.')
  }

  if (!normalizedProjectId) {
    throw createHttpError(400, 'Proyek absensi wajib dipilih.')
  }

  if (!telegramUserId) {
    throw createHttpError(403, 'ID pengguna Telegram tidak ditemukan.')
  }

  const existingRowsById = await loadAttendanceRowsByIds(
    adminClient,
    rowsToPersist.map((row) => row.sourceId)
  )

  const lockedRows = rowsToPersist.filter((row) => {
    if (!row.sourceId) {
      return false
    }

    const existingRow = existingRowsById.get(row.sourceId)

    return (
      Boolean(existingRow) &&
      (normalizeText(existingRow.billing_status, 'unbilled') === 'billed' ||
        Boolean(existingRow.salary_bill_id))
    )
  })

  if (lockedRows.length > 0) {
    throw createHttpError(
      400,
      'Absensi yang sudah ditagihkan bersifat read-only dan harus dikelola dari tagihan gaji terkait.'
    )
  }

  const workerDayRowsByWorkerId = await loadAttendanceRowsForWorkerDay(
    adminClient,
    teamId,
    normalizedDate,
    rowsToPersist.map((row) => row.worker_id)
  )

  for (const row of rowsToPersist) {
    const workerRows = workerDayRowsByWorkerId.get(row.worker_id) ?? []
    const existingRow = row.sourceId ? existingRowsById.get(row.sourceId) ?? null : null
    const workerName =
      normalizeText(row.worker_name, null) ??
      normalizeText(existingRow?.worker_name_snapshot, null) ??
      'Pekerja'

    assertAttendanceDayWeightWithinLimit({
      workerRows,
      currentSourceId: row.sourceId,
      nextAttendanceStatus: row.attendance_status,
      workerName,
      attendanceDate: normalizedDate,
    })
  }

  const deletes = rowsToPersist.filter((row) => row.sourceId && !row.attendance_status)
  const saves = rowsToPersist.filter((row) => row.attendance_status)
  const updates = saves.filter((row) => row.sourceId)
  const inserts = saves.filter((row) => !row.sourceId)
  const timestamp = new Date().toISOString()

  await Promise.all(
    deletes.map(async (row) => {
      const { error } = await adminClient
        .from('attendance_records')
        .update({
          deleted_at: timestamp,
          updated_at: timestamp,
        })
        .eq('id', row.sourceId)
        .is('deleted_at', null)

      if (error) {
        throw error
      }
    })
  )

  await runAttendanceMutationWithFallback(async (includeOvertimeFee) => {
    const updateResults = await Promise.all(
      updates.map(async (row) => {
        const { data, error } = await adminClient
          .from('attendance_records')
          .update(
            buildAttendanceSheetRowPayload(row, {
              includeOvertimeFee,
              telegramUserId,
              teamId,
              normalizedDate,
              normalizedProjectId,
              timestamp,
            })
          )
          .eq('id', row.sourceId)
          .select(
            includeOvertimeFee
              ? attendanceSelectColumns
              : attendanceSelectColumnsWithoutOvertimeFee
          )
          .single()

        return { data, error }
      })
    )

    const insertRows = inserts.map((row) =>
      buildAttendanceSheetRowPayload(row, {
        includeOvertimeFee,
        telegramUserId,
        teamId,
        normalizedDate,
        normalizedProjectId,
        timestamp,
      })
    )

    const { data, error } =
      insertRows.length > 0
        ? await adminClient.from('attendance_records').insert(insertRows).select(
            includeOvertimeFee
              ? attendanceSelectColumns
              : attendanceSelectColumnsWithoutOvertimeFee
          )
        : { data: [], error: null }

    if (error) {
      return { data: null, error }
    }

    const updateError = updateResults.find((result) => result.error)?.error ?? null

    if (updateError) {
      return { data: null, error: updateError }
    }

    return { data, error: null }
  })

  return loadAttendanceEntries(adminClient, teamId, normalizedDate, normalizedProjectId)
}

async function softDeleteAttendance(adminClient, body, telegramUserId) {
  const normalizedAttendanceId = normalizeText(body.attendanceId ?? body.id, null)
  const normalizedTeamId = normalizeText(body.teamId ?? body.team_id, null)

  if (!normalizedAttendanceId) {
    throw createHttpError(400, 'Attendance ID wajib diisi.')
  }

  const attendance = await loadAttendanceById(adminClient, normalizedAttendanceId, {
    includeDeleted: true,
  })

  if (!attendance) {
    throw createHttpError(404, 'Absensi tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, normalizedTeamId ?? attendance.team_id)

  if (attendance.billing_status === 'billed' || attendance.salary_bill_id) {
    throw createHttpError(
      400,
      'Absensi yang sudah ditagihkan tidak boleh dihapus dari editor. Pulihkan atau hapus dari recycle bin jika diperlukan.'
    )
  }

  const timestamp = new Date().toISOString()
  const deletedAttendance = await runAttendanceQueryWithFallback(async (includeOvertimeFee) => {
    const { data, error } = await adminClient
      .from('attendance_records')
      .update({
        deleted_at: timestamp,
        updated_at: timestamp,
      })
      .eq('id', normalizedAttendanceId)
      .is('deleted_at', null)
      .select(
        includeOvertimeFee ? attendanceDetailSelectColumns : attendanceDetailSelectColumnsWithoutOvertimeFee
      )
      .single()

    return { data, error }
  })

  return normalizeAttendanceDetailRow(deletedAttendance)
}

async function updateAttendance(adminClient, body, telegramUserId) {
  const normalizedAttendanceId = normalizeText(body.attendanceId ?? body.id, null)
  const normalizedTeamId = normalizeText(body.teamId ?? body.team_id, null)
  const normalizedAttendanceStatus = normalizeText(
    body.attendanceStatus ?? body.attendance_status,
    null
  ).toLowerCase()
  const rawOvertimeFee = body.overtimeFee ?? body.overtime_fee
  const normalizedNotes = normalizeText(body.notes, null)
  const expectedUpdatedAt = normalizeText(
    body.expectedUpdatedAt ?? body.expected_updated_at,
    null
  )
  const normalizedTotalPay = Number(body.totalPay ?? body.total_pay)

  if (!normalizedAttendanceId) {
    throw createHttpError(400, 'Attendance ID wajib diisi.')
  }

  const attendance = await loadAttendanceById(adminClient, normalizedAttendanceId, {
    includeDeleted: true,
  })

  if (!attendance) {
    throw createHttpError(404, 'Absensi tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, normalizedTeamId ?? attendance.team_id)

  if (attendance.deleted_at) {
    throw createHttpError(
      400,
      'Absensi yang terhapus harus dipulihkan lebih dulu sebelum diedit.'
    )
  }

  if (attendance.billing_status === 'billed' || attendance.salary_bill_id) {
    throw createHttpError(
      400,
      'Absensi yang sudah ditagihkan hanya bisa dilihat. Ubah status dari record unbilled.'
    )
  }

  if (normalizeVersion(expectedUpdatedAt)) {
    assertOptimisticConcurrency(expectedUpdatedAt, attendance.updated_at, 'Absensi')
  }

  if (!normalizedAttendanceStatus) {
    throw createHttpError(400, 'Status absensi wajib diisi.')
  }

  if (!['full_day', 'half_day', 'overtime', 'absent'].includes(normalizedAttendanceStatus)) {
    throw createHttpError(400, 'Status absensi tidak valid.')
  }

  const normalizedOvertimeFee =
    normalizedAttendanceStatus === 'overtime'
      ? Number.isFinite(toNumber(rawOvertimeFee))
        ? toNumber(rawOvertimeFee)
        : 0
      : null
  const nextTotalPay = Number.isFinite(normalizedTotalPay)
    ? normalizedTotalPay
    : toNumber(attendance.total_pay)

  if (!Number.isFinite(nextTotalPay) || nextTotalPay < 0) {
    throw createHttpError(400, 'Total upah tidak valid.')
  }

  const workerDayRowsByWorkerId = await loadAttendanceRowsForWorkerDay(
    adminClient,
    normalizedTeamId ?? attendance.team_id,
    attendance.attendance_date,
    [attendance.worker_id]
  )

  assertAttendanceDayWeightWithinLimit({
    workerRows: workerDayRowsByWorkerId.get(attendance.worker_id) ?? [],
    currentSourceId: attendance.id,
    nextAttendanceStatus: normalizedAttendanceStatus,
    workerName:
      normalizeText(attendance.worker_name_snapshot ?? attendance.worker_name, null) ?? 'Pekerja',
    attendanceDate: attendance.attendance_date,
  })

  const timestamp = new Date().toISOString()
  const updatedAttendance = await runAttendanceMutationWithFallback(async (includeOvertimeFee) => {
    const { data, error } = await adminClient
      .from('attendance_records')
      .update(
        buildAttendanceUpdatePayload(
          {
            attendanceStatus: normalizedAttendanceStatus,
            overtimeFee: normalizedOvertimeFee,
            totalPay: nextTotalPay,
            notes: normalizedNotes,
            timestamp,
          },
          { includeOvertimeFee }
        )
      )
      .eq('id', normalizedAttendanceId)
      .is('deleted_at', null)
      .select(
        includeOvertimeFee ? attendanceDetailSelectColumns : attendanceDetailSelectColumnsWithoutOvertimeFee
      )
      .single()

    return { data, error }
  })

  return normalizeAttendanceDetailRow(updatedAttendance)
}

async function restoreAttendance(adminClient, body, telegramUserId) {
  const normalizedAttendanceId = normalizeText(body.attendanceId ?? body.id, null)
  const normalizedTeamId = normalizeText(body.teamId ?? body.team_id, null)

  if (!normalizedAttendanceId) {
    throw createHttpError(400, 'Attendance ID wajib diisi.')
  }

  const attendance = await loadAttendanceById(adminClient, normalizedAttendanceId, {
    includeDeleted: true,
  })

  if (!attendance) {
    throw createHttpError(404, 'Absensi terhapus tidak ditemukan.')
  }

  await assertTeamAccess(adminClient, telegramUserId, normalizedTeamId ?? attendance.team_id)

  if (attendance.billing_status === 'billed' && !attendance.salary_bill_id) {
    throw createHttpError(
      400,
      'Absensi yang sudah ditagihkan tidak bisa dipulihkan karena tagihan gaji tidak ditemukan.'
    )
  }

  const workerDayRowsByWorkerId = await loadAttendanceRowsForWorkerDay(
    adminClient,
    normalizedTeamId ?? attendance.team_id,
    attendance.attendance_date,
    [attendance.worker_id]
  )

  assertAttendanceDayWeightWithinLimit({
    workerRows: workerDayRowsByWorkerId.get(attendance.worker_id) ?? [],
    currentSourceId: attendance.id,
    nextAttendanceStatus: attendance.attendance_status,
    workerName:
      normalizeText(attendance.worker_name_snapshot ?? attendance.worker_name, null) ?? 'Pekerja',
    attendanceDate: attendance.attendance_date,
  })

  const restoredAttendance = await runAttendanceQueryWithFallback(async (includeOvertimeFee) => {
    const { data, error } = await adminClient
      .from('attendance_records')
      .update({
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', normalizedAttendanceId)
      .not('deleted_at', 'is', null)
      .select(
        includeOvertimeFee ? attendanceDetailSelectColumns : attendanceDetailSelectColumnsWithoutOvertimeFee
      )
      .single()

    return { data, error }
  })

  return normalizeAttendanceDetailRow(restoredAttendance)
}

async function loadProjectSummaries(readClient, { debugTiming = false } = {}) {
  const startedAt = nowMs()
  const { data, error } = await readClient
    .from('vw_project_financial_summary')
    .select(
      'project_id, team_id, project_name, project_type, project_status, total_income, material_expense, operating_expense, salary_expense, gross_profit, net_profit, net_profit_project, company_overhead'
    )
    .order('project_name', { ascending: true })

  if (error) {
    throw error
  }

  const rows = (data ?? []).map(normalizeSummaryRow)

  return {
    rows,
    timing: debugTiming
      ? {
          queryMs: nowMs() - startedAt,
          totalMs: nowMs() - startedAt,
        }
      : null,
  }
}

async function loadProjectDetail(
  readClient,
  projectId,
  { dateFrom = null, dateTo = null, includeUnbilledSalaries = false } = {}
) {
  const normalizedProjectId = normalizeText(projectId)
  const normalizedDateFrom = normalizeText(dateFrom, null)
  const normalizedDateTo = normalizeText(dateTo, null)

  if (!normalizedProjectId) {
    throw createHttpError(400, 'Project ID wajib diisi.')
  }

  const [summariesResult, incomesResult, expensesResult, salariesResult] =
    await Promise.all([
      readClient
        .from('vw_project_financial_summary')
        .select(
          'project_id, team_id, project_name, project_type, project_status, total_income, material_expense, operating_expense, salary_expense, gross_profit, net_profit, net_profit_project, company_overhead'
        )
        .eq('project_id', normalizedProjectId),
      applyDateRangeToQuery(
        readClient
          .from('project_incomes')
          .select('id, project_id, team_id, transaction_date, amount, description, created_at')
          .eq('project_id', normalizedProjectId)
          .is('deleted_at', null)
          .order('transaction_date', { ascending: false }),
        'transaction_date',
        normalizedDateFrom,
        normalizedDateTo
      ),
      applyDateRangeToQuery(
        readClient
          .from('expenses')
          .select(
            'id, project_id, team_id, expense_date, expense_type, document_type, status, total_amount, description, supplier_name_snapshot, created_at'
          )
          .eq('project_id', normalizedProjectId)
          .is('deleted_at', null)
          .order('expense_date', { ascending: false }),
        'expense_date',
        normalizedDateFrom,
        normalizedDateTo
      ),
      applyDateRangeToQuery(
        includeUnbilledSalaries
          ? readClient
              .from('attendance_records')
              .select(
                'id, project_id, team_id, worker_id, attendance_date, attendance_status, total_pay, billing_status, salary_bill_id, notes, created_at, workers:worker_id ( id, name ), bills:salary_bill_id ( id, bill_type, amount, due_date, status, description )'
              )
              .eq('project_id', normalizedProjectId)
              .is('deleted_at', null)
              .order('attendance_date', { ascending: false })
          : readClient
              .from('attendance_records')
              .select(
                'id, project_id, team_id, worker_id, attendance_date, attendance_status, total_pay, billing_status, salary_bill_id, notes, created_at, workers:worker_id ( id, name ), bills:salary_bill_id ( id, bill_type, amount, due_date, status, description )'
              )
              .eq('project_id', normalizedProjectId)
              .is('deleted_at', null)
              .eq('billing_status', 'billed')
              .order('attendance_date', { ascending: false }),
        'attendance_date',
        normalizedDateFrom,
        normalizedDateTo
      ),
    ])

  const [summaries, incomes, expenses, salaries] = [
    summariesResult,
    incomesResult,
    expensesResult,
    salariesResult,
  ].map((result) => {
    if (result.error) {
      throw result.error
    }

    return result.data ?? []
  })

  const summaryBaseRow = summaries.length > 0 ? summaries[0] : null
  const summary = summaryBaseRow
    ? normalizeSummaryRow({
        ...summaryBaseRow,
        total_income: incomes.reduce((sum, row) => sum + toNumber(row.amount), 0),
        material_expense: expenses.reduce((sum, row) => {
          const expenseType = normalizeText(row?.expense_type, '').toLowerCase()

          if (expenseType === 'material' || expenseType === 'material_invoice') {
            return sum + toNumber(row.total_amount)
          }

          return sum
        }, 0),
        operating_expense: expenses.reduce((sum, row) => {
          const expenseType = normalizeText(row?.expense_type, '').toLowerCase()

          if (
            expenseType === 'operasional' ||
            expenseType === 'operational' ||
            expenseType === 'lainnya' ||
            expenseType === 'other'
          ) {
            return sum + toNumber(row.total_amount)
          }

          return sum
        }, 0),
        salary_expense: salaries.reduce((sum, row) => sum + toNumber(row.total_pay), 0),
        gross_profit:
          incomes.reduce((sum, row) => sum + toNumber(row.amount), 0) -
          expenses.reduce((sum, row) => {
            const expenseType = normalizeText(row?.expense_type, '').toLowerCase()

            if (expenseType === 'material' || expenseType === 'material_invoice') {
              return sum + toNumber(row.total_amount)
            }

            if (
              expenseType === 'operasional' ||
              expenseType === 'operational' ||
              expenseType === 'lainnya' ||
              expenseType === 'other'
            ) {
              return sum + toNumber(row.total_amount)
            }

            return sum
          }, 0) -
          salaries.reduce((sum, row) => sum + toNumber(row.total_pay), 0),
        net_profit_project:
          incomes.reduce((sum, row) => sum + toNumber(row.amount), 0) -
          expenses.reduce((sum, row) => {
            const expenseType = normalizeText(row?.expense_type, '').toLowerCase()

            if (expenseType === 'material' || expenseType === 'material_invoice') {
              return sum + toNumber(row.total_amount)
            }

            if (
              expenseType === 'operasional' ||
              expenseType === 'operational' ||
              expenseType === 'lainnya' ||
              expenseType === 'other'
            ) {
              return sum + toNumber(row.total_amount)
            }

            return sum
          }, 0) -
          salaries.reduce((sum, row) => sum + toNumber(row.total_pay), 0),
        company_overhead: toNumber(summaryBaseRow.company_overhead),
      })
    : null

  return {
    summary,
    incomes: incomes.map(normalizeIncomeRow),
    expenses: expenses.map(normalizeExpenseRow),
    salaries: salaries.map(normalizeSalaryRow),
  }
}

async function loadCashMutationRows(readClient, { dateFrom = null, dateTo = null } = {}) {
  let query = readClient
    .from('vw_cash_mutation')
    .select('transaction_date, type, amount, description, source_table, team_id')
    .order('transaction_date', { ascending: false })
    .order('amount', { ascending: false })

  const normalizedDateFrom = normalizeText(dateFrom, null)
  const normalizedDateTo = normalizeText(dateTo, null)

  if (normalizedDateFrom) {
    query = query.gte('transaction_date', normalizedDateFrom)
  }

  if (normalizedDateTo) {
    query = query.lte('transaction_date', normalizedDateTo)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []).map(normalizeCashMutationRow)
}

async function loadBillingStatsSummary(readClient) {
  const { data, error } = await readClient
    .from('vw_billing_stats')
    .select('team_id, total_outstanding, total_paid, total_bill_count, total_outstanding_salary')

  if (error) {
    throw error
  }

  return createBillingStatsSummary((data ?? []).map(normalizeBillingStatsRow))
}

function buildCashMutationSummaryRows(cashRows = []) {
  const summary = createCashMutationSummary(cashRows)

  return {
    ...summary,
    total_net_cash_flow: summary.total_inflow - summary.total_outflow,
  }
}

function buildBusinessReportPeriod(dateFrom = null, dateTo = null) {
  return {
    dateFrom: normalizeText(dateFrom, null),
    dateTo: normalizeText(dateTo, null),
  }
}

function createBusinessReportBase({
  reportKind,
  title,
  period,
  generatedAt = new Date().toISOString(),
  summary = {},
  projectSummaries = [],
  projectDetail = null,
  cashMutations = [],
  billingStats = null,
} = {}) {
  return {
    reportKind,
    title,
    period: buildBusinessReportPeriod(period?.dateFrom, period?.dateTo),
    generatedAt,
    summary,
    projectSummaries,
    projectDetail,
    cashMutations,
    billingStats,
  }
}

async function buildExecutiveFinanceReportData(readClient, { dateFrom = null, dateTo = null } = {}) {
  const [projectSummariesResult, cashRows, billingStats] = await Promise.all([
    loadProjectSummaries(readClient),
    loadCashMutationRows(readClient, { dateFrom, dateTo }),
    loadBillingStatsSummary(readClient),
  ])

  const projectSummaries = projectSummariesResult?.rows ?? []
  const portfolioSummary = createPortfolioSummary(projectSummaries)
  const cashSummary = buildCashMutationSummaryRows(cashRows)

  return createBusinessReportBase({
    reportKind: 'executive_finance',
    title: 'LAPORAN KEUANGAN EKSEKUTIF',
    period: { dateFrom, dateTo },
    summary: {
      total_income: portfolioSummary.total_income,
      total_expense: portfolioSummary.total_expense,
      total_project_profit: portfolioSummary.total_project_profit,
      total_company_overhead: portfolioSummary.total_company_overhead,
      net_consolidated_profit: portfolioSummary.net_consolidated_profit,
      total_cash_in: cashSummary.total_inflow,
      total_cash_out: cashSummary.total_outflow,
      total_net_cash_flow: cashSummary.total_net_cash_flow,
      total_bill_count: billingStats.total_bill_count,
      total_outstanding_bill: billingStats.total_outstanding,
      total_paid_bill: billingStats.total_paid,
      total_outstanding_salary: billingStats.total_outstanding_salary,
    },
    projectSummaries,
    cashMutations: cashRows,
    billingStats,
  })
}

async function buildCashFlowReportData(readClient, { dateFrom = null, dateTo = null } = {}) {
  const cashRows = await loadCashMutationRows(readClient, { dateFrom, dateTo })
  const summary = buildCashMutationSummaryRows(cashRows)

  return createBusinessReportBase({
    reportKind: 'cash_flow',
    title: 'LAPORAN ARUS KAS',
    period: { dateFrom, dateTo },
    summary,
    cashMutations: cashRows,
  })
}

async function buildProjectPlReportData(
  readClient,
  projectId,
  { dateFrom = null, dateTo = null } = {}
) {
  const projectDetail = await loadProjectDetail(readClient, projectId, {
    dateFrom,
    dateTo,
    includeUnbilledSalaries: false,
  })

  return createBusinessReportBase({
    reportKind: 'project_pl',
    title: 'LAPORAN LABA RUGI PROYEK',
    period: { dateFrom, dateTo },
    summary: projectDetail?.summary
      ? {
          total_income: projectDetail.summary.total_income,
          material_expense: projectDetail.summary.material_expense,
          operating_expense: projectDetail.summary.operating_expense,
          salary_expense: projectDetail.summary.salary_expense,
          gross_profit: projectDetail.summary.gross_profit,
          net_profit: projectDetail.summary.net_profit,
          net_profit_project: projectDetail.summary.net_profit_project,
          company_overhead: projectDetail.summary.company_overhead,
        }
      : {},
    projectDetail,
  })
}

async function loadAttachmentPolicyRole(adminClient, telegramUserId) {
  const normalizedTelegramUserId = normalizeText(telegramUserId, null)

  if (!normalizedTelegramUserId) {
    return null
  }

  const { data, error } = await adminClient
    .from('team_members')
    .select('role, is_default, approved_at, created_at')
    .eq('telegram_user_id', normalizedTelegramUserId)
    .eq('status', 'active')
    .order('is_default', { ascending: false })
    .order('approved_at', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.role ?? null
}

async function loadPdfSettings(adminClient, teamId) {
  const normalizedTeamId = normalizeText(teamId, null)

  if (!normalizedTeamId) {
    throw createHttpError(400, 'Team ID wajib diisi.')
  }

  const { data, error } = await adminClient
    .from('pdf_settings')
    .select(
      'team_id, header_color, header_logo_file_id, footer_logo_file_id, company_name, address, phone, extra, updated_by_user_id, updated_at, header_logo_file_asset:file_assets!header_logo_file_id ( id, team_id, storage_bucket, bucket_name, storage_path, original_name, file_name, public_url, mime_type, size_bytes, file_size, uploaded_by_user_id, uploaded_by, created_at, updated_at, deleted_at ), footer_logo_file_asset:file_assets!footer_logo_file_id ( id, team_id, storage_bucket, bucket_name, storage_path, original_name, file_name, public_url, mime_type, size_bytes, file_size, uploaded_by_user_id, uploaded_by, created_at, updated_at, deleted_at )'
    )
    .eq('team_id', normalizedTeamId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return normalizePdfSettingsRow(data)
}

function readPdfSettingValue(body, keys, fallback = null) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      return normalizeText(body[key], null)
    }
  }

  return fallback
}

async function savePdfSettings(adminClient, body = {}, telegramUserId, updatedByUserId) {
  const teamId = normalizeText(body.teamId ?? body.team_id, null)

  if (!teamId) {
    throw createHttpError(400, 'Team ID wajib diisi.')
  }

  const effectiveTeamId = await assertTeamAccess(adminClient, telegramUserId, teamId)
  const existingSettings = await loadPdfSettings(adminClient, effectiveTeamId)
  const timestamp = new Date().toISOString()
  const nextSettings = {
    team_id: effectiveTeamId,
    header_color: readPdfSettingValue(
      body,
      ['header_color', 'headerColor'],
      existingSettings?.header_color ?? null
    ),
    header_logo_file_id: readPdfSettingValue(
      body,
      ['header_logo_file_id', 'headerLogoFileId'],
      existingSettings?.header_logo_file_id ?? null
    ),
    footer_logo_file_id: readPdfSettingValue(
      body,
      ['footer_logo_file_id', 'footerLogoFileId'],
      existingSettings?.footer_logo_file_id ?? null
    ),
    company_name: readPdfSettingValue(
      body,
      ['company_name', 'companyName'],
      existingSettings?.company_name ?? null
    ),
    address: readPdfSettingValue(body, ['address'], existingSettings?.address ?? null),
    phone: readPdfSettingValue(body, ['phone'], existingSettings?.phone ?? null),
    extra: Object.prototype.hasOwnProperty.call(body, 'extra')
      ? body.extra ?? null
      : existingSettings?.extra ?? null,
    updated_by_user_id: updatedByUserId,
    updated_at: timestamp,
  }

  const { data, error } = await adminClient
    .from('pdf_settings')
    .upsert(nextSettings, { onConflict: 'team_id' })
    .select(
      'team_id, header_color, header_logo_file_id, footer_logo_file_id, company_name, address, phone, extra, updated_by_user_id, updated_at, header_logo_file_asset:file_assets!header_logo_file_id ( id, team_id, storage_bucket, bucket_name, storage_path, original_name, file_name, public_url, mime_type, size_bytes, file_size, uploaded_by_user_id, uploaded_by, created_at, updated_at, deleted_at ), footer_logo_file_asset:file_assets!footer_logo_file_id ( id, team_id, storage_bucket, bucket_name, storage_path, original_name, file_name, public_url, mime_type, size_bytes, file_size, uploaded_by_user_id, uploaded_by, created_at, updated_at, deleted_at )'
    )
    .single()

  if (error) {
    throw error
  }

  return normalizePdfSettingsRow(data)
}

export default async function handler(req, res) {
  const supabaseUrl = getEnv('SUPABASE_URL', getEnv('VITE_SUPABASE_URL'))
  const publishableKey = getEnv(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    getEnv('VITE_SUPABASE_ANON_KEY')
  )
  const databaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', publishableKey)

  if (!supabaseUrl || !publishableKey) {
    return res.status(500).json({
      success: false,
      error: 'Environment records belum lengkap.',
    })
  }

  try {
    const method = String(req.method ?? 'GET').toUpperCase()
    const resource = normalizeText(req.query?.resource ?? req.body?.resource)

    if (!resource) {
      throw createHttpError(400, 'Resource tidak valid.')
    }

    if (
      method === 'GET' &&
      ['attendance-history', 'stock-project-options', 'stock-overview'].includes(resource)
    ) {
      const bearerToken = getBearerToken(req)
      const accessClient = createDatabaseClient(
        supabaseUrl,
        publishableKey,
        bearerToken
      )
      const readClient = createDatabaseClient(supabaseUrl, databaseKey)

      if (resource === 'attendance-history') {
        const queryTeamId = normalizeText(req.query?.teamId, null)
        const effectiveTeamId = await assertSessionTeamAccess(accessClient, queryTeamId)
        const view = normalizeText(req.query?.view, 'detail')

        if (view === 'summary') {
          const summary = await loadAttendanceHistorySummary(readClient, effectiveTeamId, {
            month: req.query?.month ?? null,
          })

          return res.status(200).json({
            success: true,
            summary,
          })
        }

        const attendances = await loadAttendanceHistory(readClient, effectiveTeamId, {
          month: req.query?.month ?? null,
          workerId: req.query?.workerId ?? null,
          workerName: req.query?.workerName ?? null,
          date: req.query?.date ?? null,
        })

        return res.status(200).json({
          success: true,
          attendances,
        })
      }

      if (resource === 'stock-project-options') {
        const teamId = normalizeText(req.query?.teamId, null)
        const profile = await loadSessionProfile(accessClient)
        const telegramUserId = normalizeText(profile?.telegram_user_id, null)

        if (!telegramUserId) {
          throw createHttpError(403, 'Profile Telegram tidak ditemukan.')
        }

        const effectiveTeamId = await assertManualStockOutAccess(
          accessClient,
          telegramUserId,
          teamId
        )
        const projects = await loadActiveProjectsForTeam(readClient, effectiveTeamId)

        return res.status(200).json({
          success: true,
          projects,
        })
      }

      const teamId = normalizeText(req.query?.teamId, null)
      const limit = Number.isFinite(Number(req.query?.limit))
        ? Number(req.query.limit)
        : 8
      const effectiveTeamId = await assertSessionTeamAccess(accessClient, teamId)
      const overview = await loadStockOverview(readClient, effectiveTeamId, limit)

      return res.status(200).json({
        success: true,
        ...overview,
      })
    }

    const context = await getAuthorizedContext(req, supabaseUrl, publishableKey)
    const adminClient = createDatabaseClient(
      supabaseUrl,
      databaseKey,
      context.bearerToken
    )
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, telegram_user_id')
      .eq('id', context.authUser.id)
      .maybeSingle()

    if (profileError) {
      throw profileError
    }

    const telegramUserId = normalizeText(
      profile?.telegram_user_id ?? context.authUser?.user_metadata?.telegram_user_id,
      null
    )

    if (!telegramUserId) {
      throw createHttpError(403, 'Profile Telegram tidak ditemukan.')
    }

    if (resource === 'bill-payments') {
    if (method === 'GET') {
        const paymentId = normalizeText(req.query?.paymentId, null)
        const teamId = normalizeText(req.query?.teamId, null)
        const billId = normalizeText(req.query?.billId, null)
        const view = normalizeText(req.query?.view, null)
        const includeDeleted = normalizeText(req.query?.includeDeleted, '') === 'true'

        if (paymentId) {
          const payment = await loadBillPaymentById(adminClient, paymentId, {
            includeDeleted,
          })

          return res.status(200).json({
            success: true,
            payment,
          })
        }

        if (view === 'recycle-bin') {
          const effectiveTeamId = await assertTeamAccess(adminClient, telegramUserId, teamId)
          const payments = await loadDeletedBillPayments(adminClient, effectiveTeamId)

          return res.status(200).json({
            success: true,
            payments,
          })
        }

        if (billId) {
          const bill = await loadBillById(adminClient, billId)

          if (!bill) {
            return res.status(200).json({
              success: true,
              payments: [],
            })
          }

          await assertTeamAccess(adminClient, telegramUserId, bill.teamId)

          return res.status(200).json({
            success: true,
            payments: bill.payments ?? [],
          })
        }

        throw createHttpError(400, 'Bill ID atau Payment ID wajib diisi.')
      }

      if (method === 'POST') {
        const body = await parseRequestBody(req)
        const result = await createBillPayment(adminClient, body, telegramUserId)
        const bill = result.bill?.id ? await loadBillById(adminClient, result.bill.id) : null

        return res.status(200).json({
          success: true,
          payment: result.payment,
          bill,
        })
      }

      if (method === 'PATCH') {
        const body = await parseRequestBody(req)

        if (normalizeText(body.action, '') === 'restore') {
          const result = await restoreBillPayment(adminClient, body, telegramUserId)
          const bill = result.bill?.id ? await loadBillById(adminClient, result.bill.id) : null

          return res.status(200).json({
            success: true,
            payment: result.payment,
            bill,
          })
        }

        const result = await updateBillPayment(adminClient, body, telegramUserId)
        const bill = result.bill?.id ? await loadBillById(adminClient, result.bill.id) : null

        return res.status(200).json({
          success: true,
          payment: result.payment,
          bill,
        })
      }

      if (method === 'DELETE') {
        const body = await parseRequestBody(req)
        if (normalizeText(body.action, '') === 'permanent-delete') {
          const result = await hardDeleteBillPayment(adminClient, body, telegramUserId)
          const bill = result.bill?.id ? await loadBillById(adminClient, result.bill.id) : null

          return res.status(200).json({
            success: true,
            bill,
          })
        }

        const result = await deleteBillPayment(adminClient, body, telegramUserId)
        const bill = result.bill?.id ? await loadBillById(adminClient, result.bill.id) : null

        return res.status(200).json({
          success: true,
          bill,
        })
      }
    }

    if (resource === 'attachment-policy' && method === 'GET') {
      const role = profile?.role ?? (await loadAttachmentPolicyRole(adminClient, telegramUserId))
      const permissions = getAttachmentPermissions(role)

      return res.status(200).json({
        success: true,
        role: role ?? null,
        permissions,
        matrix: ATTACHMENT_ROLE_MATRIX,
      })
    }

    if (resource === 'bills') {
      if (method === 'GET') {
        const billId = normalizeText(req.query?.billId, null)

        if (billId) {
          const bill = await loadBillById(adminClient, billId)

          if (!bill) {
            return res.status(200).json({
              success: true,
              bill: null,
            })
          }

          await assertTeamAccess(adminClient, telegramUserId, bill.teamId)

          return res.status(200).json({
            success: true,
            bill,
          })
        }

        const teamId = normalizeText(req.query?.teamId, null)
        const effectiveTeamId = await assertTeamAccess(
          adminClient,
          telegramUserId,
          teamId
        )
        const bills = await loadUnpaidBills(adminClient, effectiveTeamId)

        return res.status(200).json({
          success: true,
          bills,
        })
      }

      if (method === 'DELETE') {
        const body = await parseRequestBody(req)
        const bill = await loadBillById(adminClient, body.billId)
        const expectedUpdatedAt = normalizeText(
          body.expectedUpdatedAt ?? body.expected_updated_at,
          null
        )

        if (!bill) {
          throw createHttpError(404, 'Tagihan tidak ditemukan.')
        }

        await assertTeamAccess(adminClient, telegramUserId, body.teamId ?? bill.teamId)
        await softDeleteBill(adminClient, body.billId, expectedUpdatedAt)

        return res.status(200).json({
          success: true,
        })
      }
    }

    if (resource === 'stock-manual-outs') {
      if (method !== 'POST') {
        throw createHttpError(405, 'Method tidak didukung.')
      }

      const body = await parseRequestBody(req)
      const teamId = normalizeText(body.teamId ?? body.team_id, null)
      await assertManualStockOutAccess(adminClient, telegramUserId, teamId)
      const result = await createManualStockOut(
        adminClient,
        body,
        telegramUserId,
        profile?.id ?? context.authUser.id
      )

      return res.status(200).json({
        success: true,
        material: result.material,
        stockTransaction: result.stockTransaction,
      })
    }

    if (resource === 'stock-project-options' && method === 'GET') {
      const teamId = normalizeText(req.query?.teamId, null)
      const effectiveTeamId = await assertManualStockOutAccess(adminClient, telegramUserId, teamId)
      const projects = await loadActiveProjectsForTeam(adminClient, effectiveTeamId)

      return res.status(200).json({
        success: true,
        projects,
      })
    }

    if (resource === 'stock-overview' && method === 'GET') {
      const teamId = normalizeText(req.query?.teamId, null)
      const limit = Number.isFinite(Number(req.query?.limit))
        ? Number(req.query.limit)
        : 8
      const effectiveTeamId = await assertTeamAccess(adminClient, telegramUserId, teamId)
      const overview = await loadStockOverview(adminClient, effectiveTeamId, limit)

      return res.status(200).json({
        success: true,
        ...overview,
      })
    }

    if (resource === 'expense-attachments') {
      if (method === 'GET') {
        const expenseId = normalizeText(req.query?.expenseId, null)
        const teamId = normalizeText(req.query?.teamId, null)
        const view = normalizeText(req.query?.view, null)
        const includeDeleted = normalizeText(req.query?.includeDeleted, '') === 'true'

        if (view === 'recycle-bin') {
          const effectiveTeamId = await assertTeamAccess(adminClient, telegramUserId, teamId)
          const attachments = await loadDeletedExpenseAttachments(adminClient, effectiveTeamId)

          return res.status(200).json({
            success: true,
            attachments,
          })
        }

        if (!expenseId) {
          throw createHttpError(400, 'Expense ID wajib diisi.')
        }

        const expense = await loadExpenseContextById(adminClient, expenseId, {
          includeDeleted: true,
        })

        if (!expense?.id) {
          throw createHttpError(404, 'Parent expense tidak ditemukan.')
        }

        await assertTeamAccess(adminClient, telegramUserId, expense.team_id)

        const attachments = await loadExpenseAttachments(adminClient, expenseId, {
          includeDeleted,
        })

        return res.status(200).json({
          success: true,
          attachments,
        })
      }

      if (method === 'POST') {
        const body = await parseRequestBody(req)
        const attachment = await upsertExpenseAttachment(adminClient, body, telegramUserId)

        return res.status(200).json({
          success: true,
          attachment,
        })
      }

      if (method === 'PATCH') {
        const body = await parseRequestBody(req)

        if (normalizeText(body.action, '') === 'restore') {
          const attachment = await restoreExpenseAttachment(adminClient, body, telegramUserId)

          return res.status(200).json({
            success: true,
            attachment,
          })
        }
      }

      if (method === 'DELETE') {
        const body = await parseRequestBody(req)

        if (normalizeText(body.action, '') === 'permanent-delete') {
          await permanentDeleteExpenseAttachment(adminClient, body, telegramUserId)

          return res.status(200).json({
            success: true,
          })
        }

        const attachment = await softDeleteExpenseAttachment(adminClient, body, telegramUserId)

        return res.status(200).json({
          success: true,
          attachment,
        })
      }
    }

    if (resource === 'expenses') {
      if (method === 'GET') {
        const expenseId = normalizeText(req.query?.expenseId, null)
        const teamId = normalizeText(req.query?.teamId, null)
        const view = normalizeText(req.query?.view, null)
        const includeDeleted = normalizeText(req.query?.includeDeleted, '') === 'true'

        if (view === 'recycle-bin') {
          const effectiveTeamId = await assertTeamAccess(adminClient, telegramUserId, teamId)
          const expenses = await adminClient
            .from('expenses')
            .select(expenseSelectColumns)
            .eq('team_id', effectiveTeamId)
            .not('deleted_at', 'is', null)
            .order('updated_at', { ascending: false })
            .order('created_at', { ascending: false })

          if (expenses.error) {
            throw expenses.error
          }

          return res.status(200).json({
            success: true,
            expenses: (expenses.data ?? []).map((expense) => mapExpenseRow(expense)),
          })
        }

        if (!expenseId) {
          throw createHttpError(400, 'Expense ID wajib diisi.')
        }

        const expense = await loadExpenseById(adminClient, expenseId, {
          includeDeleted,
        })

        if (!expense) {
          return res.status(200).json({
            success: true,
            expense: null,
          })
        }

        await assertTeamAccess(adminClient, telegramUserId, expense.team_id)

        return res.status(200).json({
          success: true,
          expense,
        })
      }

      if (method === 'POST' || method === 'PATCH') {
        const body = await parseRequestBody(req)
        if (method === 'PATCH' && body.action === 'restore') {
          const expenseId = normalizeText(body.expenseId ?? body.id, null)
          const expectedUpdatedAt = normalizeText(
            body.expectedUpdatedAt ?? body.expected_updated_at,
            null
          )

          if (!expenseId) {
            throw createHttpError(400, 'Expense ID wajib diisi.')
          }

          const expense = await loadExpenseById(adminClient, expenseId, {
            includeDeleted: true,
          })

          if (!expense) {
            throw createHttpError(404, 'Pengeluaran terhapus tidak ditemukan.')
          }

          if (!expense.deleted_at) {
            return res.status(200).json({
              success: true,
              expense,
            })
          }

          assertOptimisticConcurrency(expectedUpdatedAt, expense.updated_at, 'Pengeluaran')

          await assertTeamAccess(adminClient, telegramUserId, body.teamId ?? expense.team_id)

          const timestamp = new Date().toISOString()

          const { data: restoredExpense, error: expenseError } = await adminClient
            .from('expenses')
            .update({
              deleted_at: null,
              updated_at: timestamp,
            })
            .eq('id', expenseId)
            .not('deleted_at', 'is', null)
            .select(expenseSelectColumns)
            .single()

          if (expenseError) {
            throw expenseError
          }

          const restoredBill = expense.bill?.id
            ? await syncExpenseBill(adminClient, restoredExpense, expense.bill, {
                deletedAt: null,
              })
            : null

          return res.status(200).json({
            success: true,
            expense: mapExpenseRow(restoredExpense, restoredBill),
          })
        }

        const teamId = normalizeText(body.teamId ?? body.team_id, null)
        const effectiveTeamId = await assertTeamAccess(
          adminClient,
          telegramUserId,
          teamId
        )
        const expense = await upsertExpense(
          adminClient,
          body,
          profile?.id ?? context.authUser.id,
          telegramUserId,
          effectiveTeamId
        )

        return res.status(200).json({
          success: true,
          expense,
        })
      }

      if (method === 'DELETE') {
        const body = await parseRequestBody(req)
        const expenseId = normalizeText(body.expenseId ?? body.id, null)
        const expectedUpdatedAt = normalizeText(
          body.expectedUpdatedAt ?? body.expected_updated_at,
          null
        )

        if (!expenseId) {
          throw createHttpError(400, 'Expense ID wajib diisi.')
        }

        const expense = await loadExpenseById(adminClient, expenseId, {
          includeDeleted: true,
        })

        if (!expense) {
          throw createHttpError(404, 'Pengeluaran tidak ditemukan.')
        }

        await assertTeamAccess(adminClient, telegramUserId, body.teamId ?? expense.team_id)
        await guardExpenseBillPayments(adminClient, expense.bill?.id)
        assertOptimisticConcurrency(expectedUpdatedAt, expense.updated_at, 'Pengeluaran')

        const timestamp = new Date().toISOString()

        const { data: deletedExpense, error: expenseError } = await adminClient
          .from('expenses')
          .update({
            deleted_at: timestamp,
            updated_at: timestamp,
          })
          .eq('id', expenseId)
          .is('deleted_at', null)
          .select(expenseSelectColumns)
          .single()

        if (expenseError) {
          throw expenseError
        }

        if (!expense.bill?.id) {
          throw createHttpError(500, 'Tagihan pengeluaran tidak ditemukan.')
        }

        const deletedBill = await syncExpenseBill(adminClient, deletedExpense, expense.bill, {
          deletedAt: timestamp,
        })

        return res.status(200).json({
          success: true,
          expense: mapExpenseRow(deletedExpense, deletedBill),
        })
      }
    }

    if (resource === 'material-invoices') {
      if (method === 'GET') {
        const expenseId = normalizeText(req.query?.expenseId, null)
        const teamId = normalizeText(req.query?.teamId, null)
        const view = normalizeText(req.query?.view, null)
        const includeDeleted = normalizeText(req.query?.includeDeleted, '') === 'true'

        if (view === 'recycle-bin') {
          const effectiveTeamId = await assertTeamAccess(adminClient, telegramUserId, teamId)
          const { data, error } = await adminClient
            .from('expenses')
            .select(expenseSelectColumns)
            .eq('team_id', effectiveTeamId)
            .not('deleted_at', 'is', null)
            .in('expense_type', [...materialInvoiceExpenseTypes])
            .order('updated_at', { ascending: false })
            .order('created_at', { ascending: false })

          if (error) {
            throw error
          }

          return res.status(200).json({
            success: true,
            expenses: (data ?? []).map((expense) => mapExpenseRow(expense)),
          })
        }

        if (!expenseId) {
          throw createHttpError(400, 'Expense ID wajib diisi.')
        }

        const invoice = await loadMaterialInvoiceById(adminClient, expenseId, {
          includeDeleted,
        })

        if (!invoice) {
          return res.status(200).json({
            success: true,
            expense: null,
          })
        }

        await assertTeamAccess(adminClient, telegramUserId, invoice.team_id)

        return res.status(200).json({
          success: true,
          expense: invoice,
        })
      }

      if (method === 'POST' || method === 'PATCH') {
        const body = await parseRequestBody(req)

        if (method === 'PATCH' && body.action === 'restore') {
          const expenseId = normalizeText(body.expenseId ?? body.id, null)

          if (!expenseId) {
            throw createHttpError(400, 'Expense ID wajib diisi.')
          }

          const invoice = await loadMaterialInvoiceById(adminClient, expenseId, {
            includeDeleted: true,
          })

          if (!invoice) {
            throw createHttpError(404, 'Faktur material terhapus tidak ditemukan.')
          }

          if (!invoice.deleted_at) {
            return res.status(200).json({
              success: true,
              expense: invoice,
            })
          }

          await assertTeamAccess(adminClient, telegramUserId, body.teamId ?? invoice.team_id)
          const expectedUpdatedAt = normalizeText(
            body.expectedUpdatedAt ?? body.expected_updated_at,
            null
          )
          assertOptimisticConcurrency(expectedUpdatedAt, invoice.updated_at, 'Faktur material')

          const timestamp = new Date().toISOString()

          const { data: restoredExpense, error: expenseError } = await adminClient
            .from('expenses')
            .update({
              deleted_at: null,
              updated_at: timestamp,
            })
            .eq('id', expenseId)
            .not('deleted_at', 'is', null)
            .select(
              'id, telegram_user_id, created_by_user_id, team_id, project_id, supplier_id, supplier_name_snapshot, project_name_snapshot, expense_type, document_type, status, expense_date, amount, total_amount, description, notes, created_at, updated_at, deleted_at'
            )
            .single()

          if (expenseError) {
            throw expenseError
          }

          const restoredBill = invoice.bill?.id
            ? await syncExpenseBill(adminClient, restoredExpense, invoice.bill, {
                deletedAt: null,
              })
            : await createMaterialInvoiceBillFromExpense(adminClient, restoredExpense)

          await syncMaterialInvoiceStockMovement(adminClient, {
            expenseId,
            previousItems: [],
            nextItems: Array.isArray(invoice.items) ? invoice.items : [],
            mode: 'restore',
            documentType: invoice.document_type,
            teamId: body.teamId ?? invoice.team_id,
            projectId: invoice.project_id ?? null,
            expenseDate: invoice.expense_date ?? null,
          })

          const restoredInvoice = await loadMaterialInvoiceById(adminClient, expenseId, {
            includeDeleted: false,
          })

          return res.status(200).json({
            success: true,
            expense: mapExpenseRow(restoredExpense, restoredBill),
            items: restoredInvoice?.items ?? [],
          })
        }

        const headerData = body?.headerData ?? {}
        const teamId = normalizeText(
          body.teamId ??
            body.team_id ??
            headerData.team_id ??
            headerData.teamId ??
            null,
          null
        )
        const effectiveTeamId = teamId
          ? await assertTeamAccess(adminClient, telegramUserId, teamId)
          : null

        const result =
          method === 'PATCH'
            ? await updateMaterialInvoice(
                adminClient,
                body,
                profile?.id ?? context.authUser.id,
                telegramUserId,
                effectiveTeamId ?? teamId
              )
            : await createMaterialInvoice(
                adminClient,
                body,
                profile?.id ?? context.authUser.id,
                telegramUserId,
                effectiveTeamId ?? teamId
              )

        return res.status(200).json({
          success: true,
          ...result,
        })
      }

      if (method === 'DELETE') {
        const body = await parseRequestBody(req)
        const expenseId = normalizeText(body.expenseId ?? body.id, null)
        const expectedUpdatedAt = normalizeText(
          body.expectedUpdatedAt ?? body.expected_updated_at,
          null
        )

        if (!expenseId) {
          throw createHttpError(400, 'Expense ID wajib diisi.')
        }

        const invoice = await loadMaterialInvoiceById(adminClient, expenseId, {
          includeDeleted: true,
        })

        if (!invoice) {
          throw createHttpError(404, 'Faktur material tidak ditemukan.')
        }

        await assertTeamAccess(adminClient, telegramUserId, body.teamId ?? invoice.team_id)
        if (invoice.bill?.id) {
          await guardExpenseBillPayments(adminClient, invoice.bill.id)
        }
        assertOptimisticConcurrency(expectedUpdatedAt, invoice.updated_at, 'Faktur material')
        await assertMaterialInvoiceDeleteStockAvailability(
          adminClient,
          Array.isArray(invoice.items) ? invoice.items : [],
          invoice.document_type
        )

        await syncMaterialInvoiceStockMovement(adminClient, {
          expenseId,
          previousItems: Array.isArray(invoice.items) ? invoice.items : [],
          nextItems: [],
          mode: 'delete',
          documentType: invoice.document_type,
          teamId: body.teamId ?? invoice.team_id,
          projectId: invoice.project_id ?? null,
          expenseDate: invoice.expense_date ?? null,
        })

        const timestamp = new Date().toISOString()

        const { data: deletedExpense, error: expenseError } = await adminClient
          .from('expenses')
          .update({
            deleted_at: timestamp,
            updated_at: timestamp,
          })
          .eq('id', expenseId)
          .is('deleted_at', null)
          .select(
            'id, telegram_user_id, created_by_user_id, team_id, project_id, supplier_id, supplier_name_snapshot, project_name_snapshot, expense_type, document_type, status, expense_date, amount, total_amount, description, notes, created_at, updated_at, deleted_at'
          )
          .single()

        if (expenseError) {
          throw expenseError
        }

        const deletedBill = invoice.bill?.id
          ? await syncExpenseBill(adminClient, deletedExpense, invoice.bill, {
              deletedAt: timestamp,
            })
          : null

        const deletedInvoice = await loadMaterialInvoiceById(adminClient, expenseId, {
          includeDeleted: true,
        })

        return res.status(200).json({
          success: true,
          expense: mapExpenseRow(deletedExpense, deletedBill),
          items: deletedInvoice?.items ?? invoice.items ?? [],
        })
      }
    }

    if (resource === 'attendance') {
      if (method === 'GET') {
        const teamId = normalizeText(req.query?.teamId, null)
        const attendanceId = normalizeText(req.query?.attendanceId, null)
        const includeDeleted = normalizeText(req.query?.includeDeleted, '') === 'true'

        if (attendanceId) {
          const attendance = await loadAttendanceById(adminClient, attendanceId, {
            includeDeleted,
          })

          if (!attendance) {
            return res.status(200).json({
              success: true,
              attendance: null,
            })
          }

          await assertTeamAccess(adminClient, telegramUserId, teamId ?? attendance.team_id)

          return res.status(200).json({
            success: true,
            attendance,
          })
        }

        const effectiveTeamId = await assertTeamAccess(
          adminClient,
          telegramUserId,
          teamId
        )
        const date = normalizeText(req.query?.date, null)
        const projectId = normalizeText(req.query?.projectId, null)
        const attendances = await loadAttendanceEntries(
          adminClient,
          effectiveTeamId,
          date,
          projectId
        )

        return res.status(200).json({
          success: true,
          attendances,
        })
      }

      if (method === 'POST') {
        const body = await parseRequestBody(req)
        const teamId = normalizeText(body.teamId ?? body.team_id, null)
        const effectiveTeamId = await assertTeamAccess(
          adminClient,
          telegramUserId,
          teamId
        )
        const attendances = await persistAttendanceSheet(
          adminClient,
          body,
          telegramUserId,
          effectiveTeamId
        )

        return res.status(200).json({
          success: true,
          attendances,
        })
      }

      if (method === 'DELETE') {
        const body = await parseRequestBody(req)
        const attendance = await softDeleteAttendance(adminClient, body, telegramUserId)

        return res.status(200).json({
          success: true,
          attendance,
        })
      }

      if (method === 'PATCH') {
        const body = await parseRequestBody(req)

        if (normalizeText(body.action, '') === 'restore') {
          const attendance = await restoreAttendance(adminClient, body, telegramUserId)

          return res.status(200).json({
            success: true,
            attendance,
          })
        }

        const attendance = await updateAttendance(adminClient, body, telegramUserId)

        return res.status(200).json({
          success: true,
          attendance,
        })
      }
    }

    if (resource === 'attendance-history' && method === 'GET') {
      const queryTeamId = normalizeText(req.query?.teamId, null)
      const effectiveTeamId = await assertTeamAccess(
        adminClient,
        telegramUserId,
        queryTeamId
      )
      const view = normalizeText(req.query?.view, 'detail')

      if (view === 'summary') {
        const summary = await loadAttendanceHistorySummary(adminClient, effectiveTeamId, {
          month: req.query?.month ?? null,
        })

        return res.status(200).json({
          success: true,
          summary,
        })
      }

      const attendances = await loadAttendanceHistory(adminClient, effectiveTeamId, {
        month: req.query?.month ?? null,
        workerId: req.query?.workerId ?? null,
        workerName: req.query?.workerName ?? null,
        date: req.query?.date ?? null,
      })

      return res.status(200).json({
        success: true,
        attendances,
      })
    }

    if (resource === 'attendance-unbilled' && method === 'GET') {
      const teamId = normalizeText(req.query?.teamId, null)
      const effectiveTeamId = await assertTeamAccess(
        adminClient,
        telegramUserId,
        teamId
      )
      const attendances = await loadUnbilledAttendances(adminClient, effectiveTeamId)

      return res.status(200).json({
        success: true,
        attendances,
      })
    }

    if (resource === 'attendance-recap' && method === 'POST') {
      const body = await parseRequestBody(req)
      const result = await createAttendanceRecap(adminClient, body, telegramUserId)

      return res.status(200).json({
        success: true,
        billId: result.billId,
        attendanceCount: result.attendanceCount,
        totalAmount: result.totalAmount,
      })
    }

    if (resource === 'reports' && method === 'GET') {
      const readClient = createDatabaseClient(
        supabaseUrl,
        publishableKey,
        context.bearerToken
      )
      const hasReportKindQuery = Object.prototype.hasOwnProperty.call(req.query ?? {}, 'reportKind')
      const reportKind = normalizeText(req.query?.reportKind, 'executive_finance')
      const dateFrom = normalizeText(req.query?.dateFrom, null)
      const dateTo = normalizeText(req.query?.dateTo, null)
      const projectId = normalizeText(req.query?.projectId, null)
      const debugTimingEnabled = normalizeText(req.query?.debugTiming, '') === '1'

      if (!hasReportKindQuery) {
        if (projectId) {
          const projectDetail = await loadProjectDetail(readClient, projectId)

          return res.status(200).json({
            success: true,
            projectDetail,
          })
        }

        const { rows: projectSummaries, timing } = await loadProjectSummaries(readClient, {
          debugTiming: debugTimingEnabled,
        })

        return res.status(200).json({
          success: true,
          projectSummaries,
          portfolioSummary: createPortfolioSummary(projectSummaries),
          ...(debugTimingEnabled ? { timing } : {}),
        })
      }

      if (reportKind === 'project_pl') {
        if (!projectId) {
          throw createHttpError(400, 'Project ID wajib diisi untuk laporan proyek.')
        }

        const reportData = await buildProjectPlReportData(readClient, projectId, {
          dateFrom,
          dateTo,
        })

        return res.status(200).json({
          success: true,
          reportData,
        })
      }

      if (reportKind === 'cash_flow') {
        const reportData = await buildCashFlowReportData(readClient, {
          dateFrom,
          dateTo,
        })

        return res.status(200).json({
          success: true,
          reportData,
        })
      }

      if (reportKind === 'executive_finance') {
        const reportData = await buildExecutiveFinanceReportData(readClient, {
          dateFrom,
          dateTo,
        })

        return res.status(200).json({
          success: true,
          reportData,
        })
      }

      const { rows: projectSummaries, timing } = await loadProjectSummaries(readClient, {
        debugTiming: debugTimingEnabled,
      })

      return res.status(200).json({
        success: true,
        projectSummaries,
        portfolioSummary: createPortfolioSummary(projectSummaries),
        ...(debugTimingEnabled ? { timing } : {}),
      })
    }

    if (resource === 'pdf-settings') {
      if (method === 'GET') {
        const teamId = normalizeText(req.query?.teamId, null)
        const effectiveTeamId = await assertTeamAccess(adminClient, telegramUserId, teamId)
        const pdfSettings = await loadPdfSettings(adminClient, effectiveTeamId)

        return res.status(200).json({
          success: true,
          pdfSettings,
        })
      }

      if (method === 'PATCH') {
        const body = await parseRequestBody(req)
        const pdfSettings = await savePdfSettings(
          adminClient,
          body,
          telegramUserId,
          profile?.id ?? context.authUser.id
        )

        return res.status(200).json({
          success: true,
          pdfSettings,
        })
      }

      throw createHttpError(405, 'Method tidak didukung.')
    }

    throw createHttpError(405, 'Resource atau method tidak didukung.')
  } catch (error) {
    const statusCode =
      typeof error?.statusCode === 'number' ? error.statusCode : 500

    return res.status(statusCode).json({
      success: false,
      error: formatRecordError(error),
    })
  }
}
