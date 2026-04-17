import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { resolveTeamId } from '../lib/auth-context'

function normalizeTeamId(teamId) {
  const normalizedValue = String(teamId ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : null
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

function unwrapRelation(relation) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null
  }

  return relation ?? null
}

function mapBillRow(bill) {
  const supplier = unwrapRelation(bill?.suppliers)
  const project = unwrapRelation(bill?.projects)
  const amount = toNumber(bill?.amount)
  const paidAmount = toNumber(bill?.paid_amount)

  return {
    id: bill?.id ?? null,
    expenseId: bill?.expense_id ?? null,
    projectIncomeId: bill?.project_income_id ?? null,
    telegramUserId: bill?.telegram_user_id ?? null,
    teamId: bill?.team_id ?? null,
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
    supplierName:
      supplier?.name ??
      bill?.worker_name_snapshot ??
      bill?.supplier_name_snapshot ??
      'Supplier belum terhubung',
    projectName:
      project?.name ??
      bill?.project_name_snapshot ??
      'Proyek belum terhubung',
  }
}

async function loadBillById(billId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedBillId = String(billId ?? '').trim()

  if (!normalizedBillId) {
    throw new Error('Bill ID tidak valid.')
  }

  const { data, error } = await supabase
    .from('bills')
    .select(
      'id, expense_id, project_income_id, telegram_user_id, team_id, supplier_id, staff_id, bill_type, description, amount, paid_amount, due_date, status, paid_at, worker_name_snapshot, supplier_name_snapshot, project_name_snapshot, suppliers:supplier_id ( id, name ), projects:project_id ( id, name )'
    )
    .eq('id', normalizedBillId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapBillRow(data) : null
}

async function softDeleteBill(billId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedBillId = String(billId ?? '').trim()

  if (!normalizedBillId) {
    throw new Error('Bill ID tidak valid.')
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('bill_payments')
    .select('id')
    .eq('bill_id', normalizedBillId)
    .is('deleted_at', null)
    .limit(1)

  if (paymentsError) {
    throw paymentsError
  }

  if ((payments ?? []).length > 0) {
    throw new Error('Tagihan yang sudah memiliki pembayaran tidak bisa dihapus.')
  }

  const { error } = await supabase
    .from('bills')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedBillId)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return true
}

const useBillStore = create((set) => ({
  bills: [],
  isLoading: false,
  error: null,
  lastUpdatedAt: null,
  clearError: () => set({ error: null }),
  fetchBillById: async (billId) => {
    try {
      return await loadBillById(billId)
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat tagihan.')

      set({
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  softDeleteBill: async (billId) => {
    try {
      await softDeleteBill(billId)
      return true
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menghapus tagihan.')

      set({
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  fetchUnpaidBills: async ({ teamId, silent = false } = {}) => {
    const normalizedTeamId = normalizeTeamId(resolveTeamId(teamId))

    if (!normalizedTeamId) {
      set({
        bills: [],
        isLoading: false,
        error: null,
        lastUpdatedAt: null,
      })

      return []
    }

    set({
      isLoading: !silent,
      error: null,
    })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const { data, error } = await supabase
        .from('bills')
        .select(
          'id, expense_id, project_income_id, telegram_user_id, team_id, supplier_id, staff_id, bill_type, description, amount, paid_amount, due_date, status, paid_at, worker_name_snapshot, supplier_name_snapshot, project_name_snapshot, suppliers:supplier_id ( id, name ), projects:project_id ( id, name )'
        )
        .is('deleted_at', null)
        .in('status', ['unpaid', 'partial'])
        .eq('team_id', normalizedTeamId)
        .order('due_date', { ascending: true })

      if (error) {
        throw error
      }

      const nextBills = (data ?? []).map(mapBillRow)

      set({
        bills: nextBills,
        isLoading: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return nextBills
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat tagihan.')

      set({
        bills: [],
        isLoading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
}))

export default useBillStore
export { useBillStore }
