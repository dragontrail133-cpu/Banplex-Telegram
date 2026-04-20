import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { resolveTeamId, resolveTelegramUserId } from '../lib/auth-context'

const projectSelectColumns =
  'id, name, project_name, project_type, budget, is_wage_assignable, status, notes, deleted_at, is_active, team_id, created_at'
const categorySelectColumns =
  'id, name, category_group, notes, deleted_at, is_active, team_id, created_at'
const supplierSelectColumns =
  'id, name, supplier_name, supplier_type, notes, deleted_at, is_active, team_id, created_at'
const professionSelectColumns =
  'id, profession_name, notes, deleted_at, team_id, created_at'
const staffSelectColumns =
  'id, staff_name, payment_type, salary, fee_percentage, fee_amount, notes, deleted_at, team_id, created_at'
const materialSelectColumns =
  'id, name, material_name, unit, current_stock, category_id, usage_count, reorder_point, notes, deleted_at, team_id, is_active, created_at, updated_at'
const fundingCreditorSelectColumns =
  'id, name, creditor_name, notes, deleted_at, team_id, is_active, created_at'
const workerSelectColumns =
  'id, name, worker_name, is_active, team_id, telegram_user_id, profession_id, status, default_project_id, default_role_name, notes, deleted_at, created_at'
const workerWageRateSelectColumns =
  'id, team_id, worker_id, project_id, role_name, wage_amount, is_default, deleted_at, created_at, workers:worker_id ( id, name, worker_name ), projects:project_id ( id, name, project_name )'

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toNumber(value, fallback = 0) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function sortByName(left, right) {
  return normalizeText(left?.name, '').localeCompare(normalizeText(right?.name, ''), 'id', {
    sensitivity: 'base',
  })
}

function normalizeProjectRow(project) {
  const projectName = normalizeText(project?.project_name ?? project?.name, '')

  return {
    ...project,
    name: projectName,
    project_name: projectName,
    project_type: normalizeText(project?.project_type, null),
    budget: toNumber(project?.budget, 0),
    is_wage_assignable: Boolean(project?.is_wage_assignable),
    status: normalizeText(project?.status, 'active'),
    notes: normalizeText(project?.notes, null),
    deleted_at: normalizeText(project?.deleted_at, null),
    is_active: project?.is_active ?? true,
    team_id: normalizeText(project?.team_id, null),
  }
}

function normalizeCategoryRow(category) {
  return {
    ...category,
    name: normalizeText(category?.name, ''),
    category_group: normalizeText(category?.category_group, 'operational'),
    notes: normalizeText(category?.notes, null),
    deleted_at: normalizeText(category?.deleted_at, null),
    is_active: category?.is_active ?? true,
    team_id: normalizeText(category?.team_id, null),
  }
}

function normalizeSupplierRow(supplier) {
  const supplierName = normalizeText(supplier?.supplier_name ?? supplier?.name, '')

  return {
    ...supplier,
    name: supplierName,
    supplier_name: supplierName,
    supplier_type: normalizeText(supplier?.supplier_type, 'Material'),
    notes: normalizeText(supplier?.notes, null),
    deleted_at: normalizeText(supplier?.deleted_at, null),
    is_active: supplier?.is_active ?? true,
    team_id: normalizeText(supplier?.team_id, null),
  }
}

function normalizeSupplierType(value) {
  return normalizeText(value, '').toLowerCase()
}

function filterSuppliersByTypes(suppliers = [], allowedTypes = []) {
  const normalizedAllowedTypes = new Set(
    allowedTypes.map((type) => normalizeSupplierType(type)).filter(Boolean)
  )

  if (normalizedAllowedTypes.size === 0) {
    return [...suppliers]
  }

  return suppliers.filter((supplier) =>
    normalizedAllowedTypes.has(normalizeSupplierType(supplier?.supplier_type))
  )
}

function normalizeProfessionRow(profession) {
  const professionName = normalizeText(profession?.profession_name, '')

  return {
    ...profession,
    id: profession?.id ?? null,
    name: professionName,
    profession_name: professionName,
    notes: normalizeText(profession?.notes, null),
    deleted_at: normalizeText(profession?.deleted_at, null),
    team_id: normalizeText(profession?.team_id, null),
  }
}

function normalizeStaffRow(staffMember) {
  const staffName = normalizeText(staffMember?.staff_name, '')

  return {
    ...staffMember,
    name: staffName,
    staff_name: staffName,
    payment_type: normalizeText(staffMember?.payment_type, 'monthly'),
    salary: toNumber(staffMember?.salary, 0),
    fee_percentage: toNumber(staffMember?.fee_percentage, 0),
    fee_amount: toNumber(staffMember?.fee_amount, 0),
    notes: normalizeText(staffMember?.notes, null),
    deleted_at: normalizeText(staffMember?.deleted_at, null),
    team_id: normalizeText(staffMember?.team_id, null),
  }
}

function normalizeMaterialRow(material) {
  const materialName = normalizeText(material?.material_name ?? material?.name, '')

  return {
    ...material,
    name: materialName,
    material_name: materialName,
    unit: normalizeText(material?.unit, ''),
    current_stock: toNumber(material?.current_stock, 0),
    category_id: normalizeText(material?.category_id, null),
    usage_count: Math.trunc(toNumber(material?.usage_count, 0)),
    reorder_point: toNumber(material?.reorder_point, 0),
    notes: normalizeText(material?.notes, null),
    deleted_at: normalizeText(material?.deleted_at, null),
    team_id: normalizeText(material?.team_id, null),
    is_active: material?.is_active ?? true,
  }
}

function normalizeFundingCreditorRow(creditor) {
  const creditorName = normalizeText(creditor?.creditor_name ?? creditor?.name, '')

  return {
    ...creditor,
    name: creditorName,
    creditor_name: creditorName,
    notes: normalizeText(creditor?.notes, null),
    deleted_at: normalizeText(creditor?.deleted_at, null),
    team_id: normalizeText(creditor?.team_id, null),
    is_active: creditor?.is_active ?? true,
  }
}

function normalizeWorkerRow(worker) {
  const workerName = normalizeText(worker?.worker_name ?? worker?.name, '')

  return {
    ...worker,
    name: workerName,
    worker_name: workerName,
    team_id: normalizeText(worker?.team_id, null),
    telegram_user_id: normalizeText(worker?.telegram_user_id, null),
    profession_id: normalizeText(worker?.profession_id, null),
    status: normalizeText(worker?.status, 'active'),
    default_project_id: normalizeText(worker?.default_project_id, null),
    default_role_name: normalizeText(worker?.default_role_name, null),
    notes: normalizeText(worker?.notes, null),
    deleted_at: normalizeText(worker?.deleted_at, null),
    is_active: worker?.is_active ?? true,
  }
}

function unwrapRelation(value) {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

function normalizeWorkerWageRateRow(rate) {
  const worker = unwrapRelation(rate?.workers)
  const project = unwrapRelation(rate?.projects)

  return {
    ...rate,
    role_name: normalizeText(rate?.role_name, ''),
    wage_amount: toNumber(rate?.wage_amount, 0),
    is_default: Boolean(rate?.is_default),
    worker_id: normalizeText(rate?.worker_id, null),
    project_id: normalizeText(rate?.project_id, null),
    team_id: normalizeText(rate?.team_id, null),
    deleted_at: normalizeText(rate?.deleted_at, null),
    worker_name: normalizeText(worker?.worker_name ?? worker?.name, null),
    project_name: normalizeText(project?.project_name ?? project?.name, null),
    workers: worker,
    projects: project,
  }
}

function sortWorkerWageRates(rows = []) {
  return [...rows].sort((left, right) => {
    const workerComparison = normalizeText(left.worker_name, '').localeCompare(
      normalizeText(right.worker_name, ''),
      'id',
      { sensitivity: 'base' }
    )

    if (workerComparison !== 0) {
      return workerComparison
    }

    return normalizeText(left.role_name, '').localeCompare(
      normalizeText(right.role_name, ''),
      'id',
      { sensitivity: 'base' }
    )
  })
}

async function selectUndeletedRows(tableName, columns, orderColumn) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const { data, error } = await supabase
    .from(tableName)
    .select(columns)
    .is('deleted_at', null)
    .order(orderColumn, { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}

async function selectDeletedRows(tableName, columns, orderColumn = 'deleted_at') {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const { data, error } = await supabase
    .from(tableName)
    .select(columns)
    .not('deleted_at', 'is', null)
    .order(orderColumn, { ascending: false })

  if (error) {
    throw error
  }

  return data ?? []
}

async function loadProjects() {
  return (await selectUndeletedRows('projects', projectSelectColumns, 'project_name')).map(
    normalizeProjectRow
  )
}

async function loadCategories() {
  return (
    await selectUndeletedRows('expense_categories', categorySelectColumns, 'name')
  ).map(normalizeCategoryRow)
}

async function loadSuppliers() {
  return (await selectUndeletedRows('suppliers', supplierSelectColumns, 'supplier_name')).map(
    normalizeSupplierRow
  )
}

async function loadFundingCreditors() {
  return (
    await selectUndeletedRows(
      'funding_creditors',
      fundingCreditorSelectColumns,
      'creditor_name'
    )
  ).map(normalizeFundingCreditorRow)
}

async function loadProfessions() {
  return (
    await selectUndeletedRows('professions', professionSelectColumns, 'profession_name')
  ).map(normalizeProfessionRow)
}

async function loadWorkers() {
  return (await selectUndeletedRows('workers', workerSelectColumns, 'worker_name')).map(
    normalizeWorkerRow
  )
}

async function loadStaffMembers() {
  return (await selectUndeletedRows('staff', staffSelectColumns, 'staff_name')).map(
    normalizeStaffRow
  )
}

async function loadWorkerWageRates() {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const { data, error } = await supabase
    .from('worker_wage_rates')
    .select(workerWageRateSelectColumns)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('role_name', { ascending: true })

  if (error) {
    throw error
  }

  return sortWorkerWageRates((data ?? []).map(normalizeWorkerWageRateRow))
}

async function loadMaterials() {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const { data, error } = await supabase
    .from('materials')
    .select(materialSelectColumns)
    .is('deleted_at', null)
    .eq('is_active', true)
    .order('material_name', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map(normalizeMaterialRow)
}

async function loadDeletedProjects() {
  return (await selectDeletedRows('projects', projectSelectColumns, 'deleted_at')).map(
    normalizeProjectRow
  )
}

async function loadDeletedCategories() {
  return (
    await selectDeletedRows('expense_categories', categorySelectColumns, 'deleted_at')
  ).map(normalizeCategoryRow)
}

async function loadDeletedSuppliers() {
  return (await selectDeletedRows('suppliers', supplierSelectColumns, 'deleted_at')).map(
    normalizeSupplierRow
  )
}

async function loadDeletedFundingCreditors() {
  return (
    await selectDeletedRows('funding_creditors', fundingCreditorSelectColumns, 'deleted_at')
  ).map(normalizeFundingCreditorRow)
}

async function loadDeletedProfessions() {
  return (await selectDeletedRows('professions', professionSelectColumns, 'deleted_at')).map(
    normalizeProfessionRow
  )
}

async function loadDeletedStaffMembers() {
  return (await selectDeletedRows('staff', staffSelectColumns, 'deleted_at')).map(
    normalizeStaffRow
  )
}

async function loadDeletedWorkers() {
  return (await selectDeletedRows('workers', workerSelectColumns, 'deleted_at')).map(
    normalizeWorkerRow
  )
}

async function loadDeletedMaterials() {
  return (await selectDeletedRows('materials', materialSelectColumns, 'deleted_at')).map(
    normalizeMaterialRow
  )
}

async function loadDeletedMasterRecords() {
  const [
    projects,
    categories,
    suppliers,
    fundingCreditors,
    professions,
    staffMembers,
    workers,
    materials,
  ] = await Promise.all([
    loadDeletedProjects(),
    loadDeletedCategories(),
    loadDeletedSuppliers(),
    loadDeletedFundingCreditors(),
    loadDeletedProfessions(),
    loadDeletedStaffMembers(),
    loadDeletedWorkers(),
    loadDeletedMaterials(),
  ])

  return {
    projects,
    categories,
    suppliers,
    fundingCreditors,
    professions,
    staffMembers,
    workers,
    materials,
  }
}

function setLoading(set) {
  set({ isLoading: true, error: null })
}

function setFailure(set, error, fallbackMessage, patch = {}) {
  const normalizedError = toError(error, fallbackMessage)

  set({
    isLoading: false,
    error: normalizedError.message,
    ...patch,
  })

  throw normalizedError
}

async function insertRow(tableName, payload, columns) {
  const { data, error } = await supabase
    .from(tableName)
    .insert(payload)
    .select(columns)
    .single()

  if (error) {
    throw error
  }

  return data
}

async function updateRow(tableName, recordId, payload, columns) {
  const { data, error } = await supabase
    .from(tableName)
    .update(payload)
    .eq('id', recordId)
    .is('deleted_at', null)
    .select(columns)
    .single()

  if (error) {
    throw error
  }

  return data
}

async function restoreRow(tableName, recordId, payload, columns) {
  const { data, error } = await supabase
    .from(tableName)
    .update(payload)
    .eq('id', recordId)
    .select(columns)
    .single()

  if (error) {
    throw error
  }

  return data
}

async function softDeleteRow(tableName, recordId, extraPatch = {}) {
  const { error } = await supabase
    .from(tableName)
    .update({
      deleted_at: new Date().toISOString(),
      ...extraPatch,
    })
    .eq('id', recordId)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return true
}

function normalizeWageRatesInput(wageRates = []) {
  if (!Array.isArray(wageRates)) {
    return []
  }

  return wageRates
    .map((rate) => ({
      project_id: normalizeText(rate?.project_id ?? rate?.projectId),
      role_name: normalizeText(rate?.role_name ?? rate?.roleName),
      wage_amount: toNumber(rate?.wage_amount ?? rate?.wageAmount, NaN),
      is_default: Boolean(rate?.is_default),
    }))
    .filter(
      (rate) =>
        rate.project_id &&
        rate.role_name &&
        Number.isFinite(rate.wage_amount) &&
        rate.wage_amount > 0
    )
}

async function saveWorkerWithRates(workerData = {}, existingWorkerId = null) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const teamId = resolveTeamId(workerData.team_id)
  const telegramUserId = resolveTelegramUserId(workerData.telegram_user_id)
  const workerName = normalizeText(workerData.worker_name ?? workerData.name)
  const wageRates = normalizeWageRatesInput(
    workerData.wage_rates ?? workerData.wageRates
  )

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  if (!workerName) {
    throw new Error('Nama pekerja wajib diisi.')
  }

  const { data, error } = await supabase.rpc('fn_upsert_worker_with_wages', {
    p_worker_id: normalizeText(existingWorkerId, null),
    p_team_id: teamId,
    p_worker_name: workerName,
    p_telegram_user_id: telegramUserId,
    p_profession_id: normalizeText(workerData.profession_id, null),
    p_status: normalizeText(workerData.status, 'active'),
    p_default_project_id: normalizeText(workerData.default_project_id, null),
    p_default_role_name: normalizeText(workerData.default_role_name, null),
    p_notes: normalizeText(workerData.notes, null),
    p_wage_rates: wageRates,
  })

  if (error) {
    throw error
  }

  return normalizeText(data, null)
}

async function softDeleteWorkerRecord(workerId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const { error } = await supabase.rpc('fn_soft_delete_worker', {
    p_worker_id: workerId,
  })

  if (error) {
    throw error
  }
}

const useMasterStore = create((set, get) => ({
  projects: [],
  categories: [],
  suppliers: [],
  professions: [],
  staffMembers: [],
  materials: [],
  fundingCreditors: [],
  workers: [],
  workerWageRates: [],
  deletedMasters: null,
  hasFetched: false,
  isLoading: false,
  error: null,
  clearError: () => set({ error: null }),
  fetchMasters: async ({ force = false } = {}) => {
    const { hasFetched, isLoading } = get()

    if (!force && hasFetched && !isLoading) {
      return {
        projects: get().projects,
        categories: get().categories,
        suppliers: get().suppliers,
        professions: get().professions,
        staffMembers: get().staffMembers,
        materials: get().materials,
        fundingCreditors: get().fundingCreditors,
        workers: get().workers,
        workerWageRates: get().workerWageRates,
      }
    }

    setLoading(set)

    try {
      const [
        projects,
        categories,
        suppliers,
        professions,
        staffMembers,
        materials,
        fundingCreditors,
        workers,
        workerWageRates,
      ] = await Promise.all([
        loadProjects(),
        loadCategories(),
        loadSuppliers(),
        loadProfessions(),
        loadStaffMembers(),
        loadMaterials(),
        loadFundingCreditors(),
        loadWorkers(),
        loadWorkerWageRates(),
      ])

      const nextState = {
        projects,
        categories,
        suppliers,
        professions,
        staffMembers,
        materials,
        fundingCreditors,
        workers,
        workerWageRates,
        hasFetched: true,
        isLoading: false,
        error: null,
      }

      set(nextState)

      return nextState
    } catch (error) {
      return setFailure(set, error, 'Gagal memuat master data.', {
        projects: [],
        categories: [],
        suppliers: [],
        professions: [],
        staffMembers: [],
        materials: [],
        fundingCreditors: [],
        workers: [],
        workerWageRates: [],
        hasFetched: false,
      })
    }
  },
  fetchProjects: async ({ force = false } = {}) => {
    const { projects, isLoading } = get()

    if (!force && projects.length > 0 && !isLoading) {
      return projects
    }

    setLoading(set)

    try {
      const nextProjects = await loadProjects()
      set({ projects: nextProjects, isLoading: false, error: null })
      return nextProjects
    } catch (error) {
      return setFailure(set, error, 'Gagal memuat proyek.', { projects: [] })
    }
  },
  fetchCategories: async ({ force = false } = {}) => {
    const { categories, isLoading } = get()

    if (!force && categories.length > 0 && !isLoading) {
      return categories
    }

    setLoading(set)

    try {
      const nextCategories = await loadCategories()
      set({ categories: nextCategories, isLoading: false, error: null })
      return nextCategories
    } catch (error) {
      return setFailure(set, error, 'Gagal memuat kategori biaya.', {
        categories: [],
      })
    }
  },
  fetchExpenseCategories: async (options = {}) => get().fetchCategories(options),
  fetchSuppliers: async ({ force = false } = {}) => {
    const { suppliers, isLoading } = get()

    if (!force && suppliers.length > 0 && !isLoading) {
      return suppliers
    }

    setLoading(set)

    try {
      const nextSuppliers = await loadSuppliers()
      set({ suppliers: nextSuppliers, isLoading: false, error: null })
      return nextSuppliers
    } catch (error) {
      return setFailure(set, error, 'Gagal memuat supplier.', { suppliers: [] })
    }
  },
  getSuppliersByTypes: (allowedTypes = []) => filterSuppliersByTypes(get().suppliers, allowedTypes),
  getMaterialSuppliers: () => filterSuppliersByTypes(get().suppliers, ['Material']),
  getOperationalSuppliers: () =>
    filterSuppliersByTypes(get().suppliers, ['Operasional', 'Lainnya']),
  fetchProfessions: async ({ force = false } = {}) => {
    const { professions, isLoading } = get()

    if (!force && professions.length > 0 && !isLoading) {
      return professions
    }

    setLoading(set)

    try {
      const nextProfessions = await loadProfessions()
      set({ professions: nextProfessions, isLoading: false, error: null })
      return nextProfessions
    } catch (error) {
      return setFailure(set, error, 'Gagal memuat profesi.', { professions: [] })
    }
  },
  fetchStaffMembers: async ({ force = false } = {}) => {
    const { staffMembers, isLoading } = get()

    if (!force && staffMembers.length > 0 && !isLoading) {
      return staffMembers
    }

    setLoading(set)

    try {
      const nextStaffMembers = await loadStaffMembers()
      set({ staffMembers: nextStaffMembers, isLoading: false, error: null })
      return nextStaffMembers
    } catch (error) {
      return setFailure(set, error, 'Gagal memuat data staf.', {
        staffMembers: [],
      })
    }
  },
  fetchStaff: async (options = {}) => get().fetchStaffMembers(options),
  fetchMaterials: async ({ force = false } = {}) => {
    const { materials, isLoading } = get()

    if (!force && materials.length > 0 && !isLoading) {
      return materials
    }

    setLoading(set)

    try {
      const nextMaterials = await loadMaterials()
      set({ materials: nextMaterials, isLoading: false, error: null })
      return nextMaterials
    } catch (error) {
      return setFailure(set, error, 'Gagal memuat material.', { materials: [] })
    }
  },
  fetchFundingCreditors: async ({ force = false } = {}) => {
    const { fundingCreditors, isLoading } = get()

    if (!force && fundingCreditors.length > 0 && !isLoading) {
      return fundingCreditors
    }

    setLoading(set)

    try {
      const nextFundingCreditors = await loadFundingCreditors()
      set({ fundingCreditors: nextFundingCreditors, isLoading: false, error: null })
      return nextFundingCreditors
    } catch (error) {
      return setFailure(set, error, 'Gagal memuat kreditur pendanaan.', {
        fundingCreditors: [],
      })
    }
  },
  fetchWorkers: async ({ force = false } = {}) => {
    const { workers, isLoading } = get()

    if (!force && workers.length > 0 && !isLoading) {
      return workers
    }

    setLoading(set)

    try {
      const nextWorkers = await loadWorkers()
      set({ workers: nextWorkers, isLoading: false, error: null })
      return nextWorkers
    } catch (error) {
      return setFailure(set, error, 'Gagal memuat pekerja.', { workers: [] })
    }
  },
  fetchWorkerWageRates: async ({ force = false } = {}) => {
    const { workerWageRates, isLoading } = get()

    if (!force && workerWageRates.length > 0 && !isLoading) {
      return workerWageRates
    }

    setLoading(set)

    try {
      const nextRates = await loadWorkerWageRates()
      set({ workerWageRates: nextRates, isLoading: false, error: null })
      return nextRates
    } catch (error) {
      return setFailure(set, error, 'Gagal memuat data upah pekerja.', {
        workerWageRates: [],
      })
    }
  },
  fetchDeletedMasters: async () => {
    set({
      deletedMasters: null,
      isLoading: true,
      error: null,
    })

    try {
      const deletedMasters = await loadDeletedMasterRecords()

      set({
        deletedMasters,
        isLoading: false,
        error: null,
      })

      return deletedMasters
    } catch (error) {
      return setFailure(set, error, 'Gagal memuat recycle bin master.', {
        deletedMasters: null,
        isLoading: false,
      })
    }
  },
  restoreMasterRecord: async (entityType, recordId) => {
    set({ isLoading: true, error: null })

    try {
      const normalizedEntityType = normalizeText(entityType, '').toLowerCase()
      const normalizedRecordId = normalizeText(recordId, null)

      if (!normalizedEntityType) {
        throw new Error('Tipe master record wajib diisi.')
      }

      if (!normalizedRecordId) {
        throw new Error('ID master record wajib diisi.')
      }

      if (normalizedEntityType === 'project') {
        await restoreRow(
          'projects',
          normalizedRecordId,
          {
            deleted_at: null,
            is_active: true,
          },
          projectSelectColumns
        )
      } else if (normalizedEntityType === 'category') {
        await restoreRow(
          'expense_categories',
          normalizedRecordId,
          {
            deleted_at: null,
            is_active: true,
          },
          categorySelectColumns
        )
      } else if (normalizedEntityType === 'supplier') {
        await restoreRow(
          'suppliers',
          normalizedRecordId,
          {
            deleted_at: null,
            is_active: true,
          },
          supplierSelectColumns
        )
      } else if (normalizedEntityType === 'creditor') {
        await restoreRow(
          'funding_creditors',
          normalizedRecordId,
          {
            deleted_at: null,
            is_active: true,
          },
          fundingCreditorSelectColumns
        )
      } else if (normalizedEntityType === 'profession') {
        await restoreRow(
          'professions',
          normalizedRecordId,
          {
            deleted_at: null,
          },
          professionSelectColumns
        )
      } else if (normalizedEntityType === 'staff') {
        await restoreRow(
          'staff',
          normalizedRecordId,
          {
            deleted_at: null,
          },
          staffSelectColumns
        )
      } else if (normalizedEntityType === 'material') {
        await restoreRow(
          'materials',
          normalizedRecordId,
          {
            deleted_at: null,
            is_active: true,
          },
          materialSelectColumns
        )
      } else if (normalizedEntityType === 'worker') {
        await restoreRow(
          'workers',
          normalizedRecordId,
          {
            deleted_at: null,
            is_active: true,
            status: 'active',
          },
          workerSelectColumns
        )

        const { error: wageRateError } = await supabase
          .from('worker_wage_rates')
          .update({
            deleted_at: null,
          })
          .eq('worker_id', normalizedRecordId)

        if (wageRateError) {
          throw wageRateError
        }
      } else {
        throw new Error('Tipe master record tidak dikenali.')
      }

      await get().fetchMasters({ force: true })

      set({ isLoading: false, error: null })

      return true
    } catch (error) {
      return setFailure(set, error, 'Gagal memulihkan master data.')
    }
  },
  addProject: async (projectData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const teamId = resolveTeamId(projectData.team_id)
      const projectName = normalizeText(projectData.project_name ?? projectData.name)

      if (!teamId) {
        throw new Error('Akses workspace tidak ditemukan.')
      }

      if (!projectName) {
        throw new Error('Nama proyek wajib diisi.')
      }

      const insertedProject = await insertRow(
        'projects',
        {
          team_id: teamId,
          name: projectName,
          project_type: normalizeText(projectData.project_type, null),
          budget: toNumber(projectData.budget, 0),
          is_wage_assignable: Boolean(projectData.is_wage_assignable),
          status: normalizeText(projectData.status, 'active'),
          notes: normalizeText(projectData.notes, null),
          is_active: projectData.is_active ?? true,
          deleted_at: null,
        },
        projectSelectColumns
      )

      const nextProject = normalizeProjectRow(insertedProject)

      set((state) => ({
        projects: [...state.projects, nextProject].sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextProject
    } catch (error) {
      return setFailure(set, error, 'Gagal menambah proyek.')
    }
  },
  updateProject: async (projectId, projectData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const updatedProject = await updateRow(
        'projects',
        projectId,
        {
          name: normalizeText(projectData.project_name ?? projectData.name),
          project_type: normalizeText(projectData.project_type, null),
          budget: toNumber(projectData.budget, 0),
          is_wage_assignable: Boolean(projectData.is_wage_assignable),
          status: normalizeText(projectData.status, 'active'),
          notes: normalizeText(projectData.notes, null),
        },
        projectSelectColumns
      )

      const nextProject = normalizeProjectRow(updatedProject)

      set((state) => ({
        projects: state.projects
          .map((project) => (project.id === projectId ? nextProject : project))
          .sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextProject
    } catch (error) {
      return setFailure(set, error, 'Gagal memperbarui proyek.')
    }
  },
  deleteProject: async (projectId) => {
    set({ isLoading: true, error: null })

    try {
      await softDeleteRow('projects', projectId, { is_active: false })

      set((state) => ({
        projects: state.projects.filter((project) => project.id !== projectId),
        isLoading: false,
        error: null,
      }))

      return true
    } catch (error) {
      return setFailure(set, error, 'Gagal menghapus proyek.')
    }
  },
  addExpenseCategory: async (categoryData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const teamId = resolveTeamId(categoryData.team_id)
      const categoryName = normalizeText(categoryData.name)

      if (!teamId) {
        throw new Error('Akses workspace tidak ditemukan.')
      }

      if (!categoryName) {
        throw new Error('Nama kategori biaya wajib diisi.')
      }

      const insertedCategory = await insertRow(
        'expense_categories',
        {
          team_id: teamId,
          name: categoryName,
          category_group: normalizeText(categoryData.category_group, 'operational'),
          notes: normalizeText(categoryData.notes, null),
          is_active: categoryData.is_active ?? true,
          deleted_at: null,
        },
        categorySelectColumns
      )

      const nextCategory = normalizeCategoryRow(insertedCategory)

      set((state) => ({
        categories: [...state.categories, nextCategory].sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextCategory
    } catch (error) {
      return setFailure(set, error, 'Gagal menambah kategori biaya.')
    }
  },
  updateExpenseCategory: async (categoryId, categoryData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const updatedCategory = await updateRow(
        'expense_categories',
        categoryId,
        {
          name: normalizeText(categoryData.name),
          category_group: normalizeText(categoryData.category_group, 'operational'),
          notes: normalizeText(categoryData.notes, null),
        },
        categorySelectColumns
      )

      const nextCategory = normalizeCategoryRow(updatedCategory)

      set((state) => ({
        categories: state.categories
          .map((category) => (category.id === categoryId ? nextCategory : category))
          .sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextCategory
    } catch (error) {
      return setFailure(set, error, 'Gagal memperbarui kategori biaya.')
    }
  },
  deleteExpenseCategory: async (categoryId) => {
    set({ isLoading: true, error: null })

    try {
      await softDeleteRow('expense_categories', categoryId, { is_active: false })

      set((state) => ({
        categories: state.categories.filter((category) => category.id !== categoryId),
        isLoading: false,
        error: null,
      }))

      return true
    } catch (error) {
      return setFailure(set, error, 'Gagal menghapus kategori biaya.')
    }
  },
  addSupplier: async (supplierData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const teamId = resolveTeamId(supplierData.team_id)
      const supplierName = normalizeText(
        supplierData.supplier_name ?? supplierData.name
      )

      if (!teamId) {
        throw new Error('Akses workspace tidak ditemukan.')
      }

      if (!supplierName) {
        throw new Error('Nama supplier wajib diisi.')
      }

      const insertedSupplier = await insertRow(
        'suppliers',
        {
          team_id: teamId,
          name: supplierName,
          supplier_type: normalizeText(supplierData.supplier_type, 'Material'),
          notes: normalizeText(supplierData.notes, null),
          is_active: supplierData.is_active ?? true,
          deleted_at: null,
        },
        supplierSelectColumns
      )

      const nextSupplier = normalizeSupplierRow(insertedSupplier)

      set((state) => ({
        suppliers: [...state.suppliers, nextSupplier].sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextSupplier
    } catch (error) {
      return setFailure(set, error, 'Gagal menambah supplier.')
    }
  },
  updateSupplier: async (supplierId, supplierData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const updatedSupplier = await updateRow(
        'suppliers',
        supplierId,
        {
          name: normalizeText(supplierData.supplier_name ?? supplierData.name),
          supplier_type: normalizeText(supplierData.supplier_type, 'Material'),
          notes: normalizeText(supplierData.notes, null),
        },
        supplierSelectColumns
      )

      const nextSupplier = normalizeSupplierRow(updatedSupplier)

      set((state) => ({
        suppliers: state.suppliers
          .map((supplier) => (supplier.id === supplierId ? nextSupplier : supplier))
          .sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextSupplier
    } catch (error) {
      return setFailure(set, error, 'Gagal memperbarui supplier.')
    }
  },
  deleteSupplier: async (supplierId) => {
    set({ isLoading: true, error: null })

    try {
      await softDeleteRow('suppliers', supplierId, { is_active: false })

      set((state) => ({
        suppliers: state.suppliers.filter((supplier) => supplier.id !== supplierId),
        isLoading: false,
        error: null,
      }))

      return true
    } catch (error) {
      return setFailure(set, error, 'Gagal menghapus supplier.')
    }
  },
  addFundingCreditor: async (creditorData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const teamId = resolveTeamId(creditorData.team_id)
      const creditorName = normalizeText(
        creditorData.creditor_name ?? creditorData.name
      )

      if (!teamId) {
        throw new Error('Akses workspace tidak ditemukan.')
      }

      if (!creditorName) {
        throw new Error('Nama kreditur wajib diisi.')
      }

      const insertedCreditor = await insertRow(
        'funding_creditors',
        {
          team_id: teamId,
          name: creditorName,
          notes: normalizeText(creditorData.notes, null),
          is_active: creditorData.is_active ?? true,
          deleted_at: null,
        },
        fundingCreditorSelectColumns
      )

      const nextCreditor = normalizeFundingCreditorRow(insertedCreditor)

      set((state) => ({
        fundingCreditors: [...state.fundingCreditors, nextCreditor].sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextCreditor
    } catch (error) {
      return setFailure(set, error, 'Gagal menambah kreditur pendanaan.')
    }
  },
  updateFundingCreditor: async (creditorId, creditorData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const updatedCreditor = await updateRow(
        'funding_creditors',
        creditorId,
        {
          name: normalizeText(creditorData.creditor_name ?? creditorData.name),
          notes: normalizeText(creditorData.notes, null),
        },
        fundingCreditorSelectColumns
      )

      const nextCreditor = normalizeFundingCreditorRow(updatedCreditor)

      set((state) => ({
        fundingCreditors: state.fundingCreditors
          .map((creditor) => (creditor.id === creditorId ? nextCreditor : creditor))
          .sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextCreditor
    } catch (error) {
      return setFailure(set, error, 'Gagal memperbarui kreditur pendanaan.')
    }
  },
  deleteFundingCreditor: async (creditorId) => {
    set({ isLoading: true, error: null })

    try {
      await softDeleteRow('funding_creditors', creditorId, { is_active: false })

      set((state) => ({
        fundingCreditors: state.fundingCreditors.filter(
          (creditor) => creditor.id !== creditorId
        ),
        isLoading: false,
        error: null,
      }))

      return true
    } catch (error) {
      return setFailure(set, error, 'Gagal menghapus kreditur pendanaan.')
    }
  },
  addProfession: async (professionData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const teamId = resolveTeamId(professionData.team_id)
      const professionName = normalizeText(
        professionData.profession_name ?? professionData.name
      )

      if (!teamId) {
        throw new Error('Akses workspace tidak ditemukan.')
      }

      if (!professionName) {
        throw new Error('Nama profesi wajib diisi.')
      }

      const insertedProfession = await insertRow(
        'professions',
        {
          team_id: teamId,
          profession_name: professionName,
          notes: normalizeText(professionData.notes, null),
          deleted_at: null,
        },
        professionSelectColumns
      )

      const nextProfession = normalizeProfessionRow(insertedProfession)

      set((state) => ({
        professions: [...state.professions, nextProfession].sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextProfession
    } catch (error) {
      return setFailure(set, error, 'Gagal menambah profesi.')
    }
  },
  updateProfession: async (professionId, professionData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const updatedProfession = await updateRow(
        'professions',
        professionId,
        {
          profession_name: normalizeText(
            professionData.profession_name ?? professionData.name
          ),
          notes: normalizeText(professionData.notes, null),
        },
        professionSelectColumns
      )

      const nextProfession = normalizeProfessionRow(updatedProfession)

      set((state) => ({
        professions: state.professions
          .map((profession) =>
            profession.id === professionId ? nextProfession : profession
          )
          .sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextProfession
    } catch (error) {
      return setFailure(set, error, 'Gagal memperbarui profesi.')
    }
  },
  deleteProfession: async (professionId) => {
    set({ isLoading: true, error: null })

    try {
      await softDeleteRow('professions', professionId)

      set((state) => ({
        professions: state.professions.filter((profession) => profession.id !== professionId),
        isLoading: false,
        error: null,
      }))

      return true
    } catch (error) {
      return setFailure(set, error, 'Gagal menghapus profesi.')
    }
  },
  addStaffMember: async (staffData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const teamId = resolveTeamId(staffData.team_id)
      const staffName = normalizeText(staffData.staff_name ?? staffData.name)

      if (!teamId) {
        throw new Error('Akses workspace tidak ditemukan.')
      }

      if (!staffName) {
        throw new Error('Nama staf wajib diisi.')
      }

      const insertedStaff = await insertRow(
        'staff',
        {
          team_id: teamId,
          staff_name: staffName,
          payment_type: normalizeText(staffData.payment_type, 'monthly'),
          salary: toNumber(staffData.salary, 0),
          fee_percentage: toNumber(staffData.fee_percentage, 0),
          fee_amount: toNumber(staffData.fee_amount, 0),
          notes: normalizeText(staffData.notes, null),
          deleted_at: null,
        },
        staffSelectColumns
      )

      const nextStaff = normalizeStaffRow(insertedStaff)

      set((state) => ({
        staffMembers: [...state.staffMembers, nextStaff].sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextStaff
    } catch (error) {
      return setFailure(set, error, 'Gagal menambah data staf.')
    }
  },
  addStaff: async (staffData = {}) => get().addStaffMember(staffData),
  updateStaffMember: async (staffId, staffData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const updatedStaff = await updateRow(
        'staff',
        staffId,
        {
          staff_name: normalizeText(staffData.staff_name ?? staffData.name),
          payment_type: normalizeText(staffData.payment_type, 'monthly'),
          salary: toNumber(staffData.salary, 0),
          fee_percentage: toNumber(staffData.fee_percentage, 0),
          fee_amount: toNumber(staffData.fee_amount, 0),
          notes: normalizeText(staffData.notes, null),
        },
        staffSelectColumns
      )

      const nextStaff = normalizeStaffRow(updatedStaff)

      set((state) => ({
        staffMembers: state.staffMembers
          .map((staffMember) => (staffMember.id === staffId ? nextStaff : staffMember))
          .sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextStaff
    } catch (error) {
      return setFailure(set, error, 'Gagal memperbarui data staf.')
    }
  },
  updateStaff: async (staffId, staffData = {}) =>
    get().updateStaffMember(staffId, staffData),
  deleteStaffMember: async (staffId) => {
    set({ isLoading: true, error: null })

    try {
      await softDeleteRow('staff', staffId)

      set((state) => ({
        staffMembers: state.staffMembers.filter((staffMember) => staffMember.id !== staffId),
        isLoading: false,
        error: null,
      }))

      return true
    } catch (error) {
      return setFailure(set, error, 'Gagal menghapus data staf.')
    }
  },
  deleteStaff: async (staffId) => get().deleteStaffMember(staffId),
  addWorker: async (workerData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const workerId = await saveWorkerWithRates(workerData, null)
      const [workers, workerWageRates] = await Promise.all([
        loadWorkers(),
        loadWorkerWageRates(),
      ])
      const nextWorker =
        workers.find((worker) => worker.id === workerId) ?? normalizeWorkerRow({})

      set({
        workers,
        workerWageRates,
        isLoading: false,
        error: null,
      })

      return nextWorker
    } catch (error) {
      return setFailure(set, error, 'Gagal menambah pekerja.')
    }
  },
  updateWorker: async (workerId, workerData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const savedWorkerId = await saveWorkerWithRates(workerData, workerId)
      const [workers, workerWageRates] = await Promise.all([
        loadWorkers(),
        loadWorkerWageRates(),
      ])
      const nextWorker =
        workers.find((worker) => worker.id === savedWorkerId) ?? normalizeWorkerRow({})

      set({
        workers,
        workerWageRates,
        isLoading: false,
        error: null,
      })

      return nextWorker
    } catch (error) {
      return setFailure(set, error, 'Gagal memperbarui pekerja.')
    }
  },
  deleteWorker: async (workerId) => {
    set({ isLoading: true, error: null })

    try {
      await softDeleteWorkerRecord(workerId)

      set((state) => ({
        workers: state.workers.filter((worker) => worker.id !== workerId),
        workerWageRates: state.workerWageRates.filter(
          (rate) => rate.worker_id !== workerId
        ),
        isLoading: false,
        error: null,
      }))

      return true
    } catch (error) {
      return setFailure(set, error, 'Gagal menghapus pekerja.')
    }
  },
  addMaterial: async (materialData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const teamId = resolveTeamId(materialData.team_id)
      const materialName = normalizeText(
        materialData.material_name ?? materialData.name
      )
      const unit = normalizeText(materialData.unit, '')

      if (!teamId) {
        throw new Error('Akses workspace tidak ditemukan.')
      }

      if (!materialName) {
        throw new Error('Nama material wajib diisi.')
      }

      if (!unit) {
        throw new Error('Satuan material wajib diisi.')
      }

      const insertedMaterial = await insertRow(
        'materials',
        {
          team_id: teamId,
          name: materialName,
          unit,
          current_stock: toNumber(materialData.current_stock, 0),
          category_id: normalizeText(materialData.category_id, null),
          reorder_point: toNumber(materialData.reorder_point, 0),
          notes: normalizeText(materialData.notes, null),
          is_active: materialData.is_active ?? true,
        },
        materialSelectColumns
      )

      const nextMaterial = normalizeMaterialRow(insertedMaterial)

      set((state) => ({
        materials: [...state.materials, nextMaterial].sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextMaterial
    } catch (error) {
      return setFailure(set, error, 'Gagal menambah material.')
    }
  },
  updateMaterial: async (materialId, materialData = {}) => {
    set({ isLoading: true, error: null })

    try {
      const materialName = normalizeText(
        materialData.material_name ?? materialData.name
      )
      const unit = normalizeText(materialData.unit, '')

      if (!materialName) {
        throw new Error('Nama material wajib diisi.')
      }

      if (!unit) {
        throw new Error('Satuan material wajib diisi.')
      }

      const updatedMaterial = await updateRow(
        'materials',
        materialId,
        {
          name: materialName,
          unit,
          current_stock: toNumber(materialData.current_stock, 0),
          category_id: normalizeText(materialData.category_id, null),
          reorder_point: toNumber(materialData.reorder_point, 0),
          notes: normalizeText(materialData.notes, null),
          is_active: materialData.is_active ?? true,
          updated_at: new Date().toISOString(),
        },
        materialSelectColumns
      )

      const nextMaterial = normalizeMaterialRow(updatedMaterial)

      set((state) => ({
        materials: state.materials
          .map((material) => (material.id === materialId ? nextMaterial : material))
          .sort(sortByName),
        isLoading: false,
        error: null,
      }))

      return nextMaterial
    } catch (error) {
      return setFailure(set, error, 'Gagal memperbarui material.')
    }
  },
  deleteMaterial: async (materialId) => {
    set({ isLoading: true, error: null })

    try {
      await softDeleteRow('materials', materialId, {
        is_active: false,
        updated_at: new Date().toISOString(),
      })

      set((state) => ({
        materials: state.materials.filter((material) => material.id !== materialId),
        isLoading: false,
        error: null,
      }))

      return true
    } catch (error) {
      return setFailure(set, error, 'Gagal menghapus material.')
    }
  },
}))

export default useMasterStore
export { useMasterStore }
