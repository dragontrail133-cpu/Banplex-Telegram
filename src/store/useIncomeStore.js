import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import {
  resolveProfileId,
  resolveTeamId,
  resolveTelegramUserId,
} from '../lib/auth-context'

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toNumber(value, fallback = NaN) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

function notifyTelegram(payload) {
  void fetch('/api/notify', {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).catch((error) => {
    console.error('Gagal memanggil endpoint notifikasi pemasukan:', error)
  })
}

function normalizeInterestType(value) {
  const normalizedValue = normalizeText(value, 'none')

  if (normalizedValue === 'no_interest') {
    return 'none'
  }

  return ['none', 'interest'].includes(normalizedValue) ? normalizedValue : 'none'
}

function buildProjectIncomeNotificationPayload(data = {}, projectName = '-') {
  return {
    notificationType: 'project_income',
    userName: normalizeText(data.userName, 'Pengguna Telegram'),
    projectName: normalizeText(projectName, '-'),
    transactionDate: normalizeText(
      data.transaction_date ?? data.transactionDate,
      new Date().toISOString()
    ),
    amount: Number(data.amount) || 0,
    description: normalizeText(data.description, 'Termin proyek baru dicatat.'),
  }
}

function buildLoanNotificationPayload(data = {}, creditorName = '-') {
  return {
    notificationType: 'loan',
    userName: normalizeText(data.userName, 'Pengguna Telegram'),
    creditorName: normalizeText(creditorName, '-'),
    transactionDate: normalizeText(
      data.transaction_date ?? data.transactionDate,
      new Date().toISOString()
    ),
    principalAmount: Number(data.principal_amount ?? data.principalAmount) || 0,
    repaymentAmount: Number(data.repayment_amount ?? data.repaymentAmount) || 0,
    interestType: normalizeInterestType(data.interest_type ?? data.interestType),
    description: normalizeText(data.description ?? data.notes, 'Pinjaman baru dicatat.'),
  }
}

function mapProjectIncomeRow(projectIncome) {
  return {
    ...projectIncome,
    amount: toNumber(projectIncome?.amount),
    project_name_snapshot: normalizeText(projectIncome?.project_name_snapshot, '-'),
  }
}

function mapLoanRow(loan) {
  const repaymentAmount = toNumber(loan?.repayment_amount, 0)
  const paidAmount = toNumber(loan?.paid_amount, 0)
  const remainingAmount = Math.max(repaymentAmount - paidAmount, 0)

  return {
    ...loan,
    principal_amount: toNumber(loan?.principal_amount ?? loan?.amount),
    repayment_amount: repaymentAmount,
    amount: toNumber(loan?.amount ?? loan?.principal_amount),
    paid_amount: paidAmount,
    interest_rate: toNumber(loan?.interest_rate, 0),
    tenor_months:
      loan?.tenor_months === null || loan?.tenor_months === undefined
        ? null
        : Math.trunc(toNumber(loan?.tenor_months, 0)),
    creditor_name_snapshot: normalizeText(loan?.creditor_name_snapshot, '-'),
    status: normalizeText(loan?.status, 'unpaid'),
    remaining_amount: remainingAmount,
    remainingAmount,
  }
}

async function loadProjectIncomeById(projectIncomeId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedId = normalizeText(projectIncomeId)

  if (!normalizedId) {
    throw new Error('ID pemasukan proyek tidak valid.')
  }

  const { data, error } = await supabase
    .from('project_incomes')
    .select(
      'id, telegram_user_id, created_by_user_id, team_id, project_id, transaction_date, income_date, amount, description, notes, project_name_snapshot, created_at, updated_at, deleted_at'
    )
    .eq('id', normalizedId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapProjectIncomeRow(data) : null
}

async function loadLoans(teamId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedTeamId = resolveTeamId(teamId)

  if (!normalizedTeamId) {
    return []
  }

  const { data, error } = await supabase
    .from('loans')
    .select(
      'id, telegram_user_id, created_by_user_id, team_id, creditor_id, transaction_date, disbursed_date, principal_amount, repayment_amount, interest_type, interest_rate, tenor_months, amount, description, notes, creditor_name_snapshot, status, paid_amount, created_at, updated_at, deleted_at'
    )
    .eq('team_id', normalizedTeamId)
    .is('deleted_at', null)
    .order('transaction_date', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []).map(mapLoanRow)
}

async function loadLoanById(loanId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedLoanId = normalizeText(loanId)

  if (!normalizedLoanId) {
    throw new Error('Loan ID tidak valid.')
  }

  const { data, error } = await supabase
    .from('loans')
    .select(
      'id, telegram_user_id, created_by_user_id, team_id, creditor_id, transaction_date, disbursed_date, principal_amount, repayment_amount, interest_type, interest_rate, tenor_months, amount, description, notes, creditor_name_snapshot, status, paid_amount, created_at, updated_at, deleted_at'
    )
    .eq('id', normalizedLoanId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapLoanRow(data) : null
}

async function softDeleteProjectIncome(projectIncomeId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedId = normalizeText(projectIncomeId)

  if (!normalizedId) {
    throw new Error('ID pemasukan proyek tidak valid.')
  }

  const { data: paidFeeBills, error: paidFeeBillsError } = await supabase
    .from('bills')
    .select('id')
    .eq('project_income_id', normalizedId)
    .is('deleted_at', null)
    .gt('paid_amount', 0)
    .limit(1)

  if (paidFeeBillsError) {
    throw paidFeeBillsError
  }

  if ((paidFeeBills ?? []).length > 0) {
    throw new Error(
      'Pemasukan proyek yang sudah memiliki pembayaran fee tidak bisa dihapus.'
    )
  }

  const timestamp = new Date().toISOString()

  const { error: incomeError } = await supabase
    .from('project_incomes')
    .update({
      deleted_at: timestamp,
      updated_at: timestamp,
    })
    .eq('id', normalizedId)
    .is('deleted_at', null)

  if (incomeError) {
    throw incomeError
  }

  const { error: billError } = await supabase
    .from('bills')
    .update({
      deleted_at: timestamp,
      updated_at: timestamp,
      status: 'cancelled',
    })
    .eq('project_income_id', normalizedId)
    .is('deleted_at', null)

  if (billError) {
    throw billError
  }

  return true
}

async function softDeleteLoan(loanId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedLoanId = String(loanId ?? '').trim()

  if (!normalizedLoanId) {
    throw new Error('Loan ID tidak valid.')
  }

  const { data: payments, error: paymentsError } = await supabase
    .from('loan_payments')
    .select('id')
    .eq('loan_id', normalizedLoanId)
    .is('deleted_at', null)
    .limit(1)

  if (paymentsError) {
    throw paymentsError
  }

  if ((payments ?? []).length > 0) {
    throw new Error('Pinjaman yang sudah memiliki pembayaran tidak bisa dihapus.')
  }

  const { error } = await supabase
    .from('loans')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedLoanId)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return true
}

const useIncomeStore = create((set) => ({
  isSubmitting: false,
  isLoadingLoans: false,
  loans: [],
  error: null,
  clearError: () => set({ error: null }),
  fetchProjectIncomeById: async (projectIncomeId) => {
    try {
      return await loadProjectIncomeById(projectIncomeId)
    } catch (error) {
      const normalizedError = toError(
        error,
        'Gagal memuat pemasukan proyek.'
      )

      set({
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  fetchLoans: async ({ teamId } = {}) => {
    set({ isLoadingLoans: true, error: null })

    try {
      const nextLoans = await loadLoans(teamId)

      set({
        loans: nextLoans,
        isLoadingLoans: false,
        error: null,
      })

      return nextLoans
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat pinjaman.')

      set({
        loans: [],
        isLoadingLoans: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  fetchLoanById: async (loanId) => {
    try {
      return await loadLoanById(loanId)
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat pinjaman.')

      set({
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  softDeleteProjectIncome: async (projectIncomeId) => {
    try {
      await softDeleteProjectIncome(projectIncomeId)
      return true
    } catch (error) {
      const normalizedError = toError(
        error,
        'Gagal menghapus pemasukan proyek.'
      )

      set({
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  softDeleteLoan: async (loanId) => {
    try {
      await softDeleteLoan(loanId)
      return true
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menghapus pinjaman.')

      set({
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  updateProjectIncome: async (projectIncomeId, patch = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const normalizedId = normalizeText(projectIncomeId)
      const transactionDate = normalizeText(
        patch.transaction_date ?? patch.transactionDate
      )
      const amount = toNumber(patch.amount)
      const description = normalizeText(patch.description)
      const notes = normalizeText(patch.notes, null)
      const projectId = normalizeText(patch.project_id)
      const projectName = normalizeText(patch.project_name, '-')

      if (!normalizedId) {
        throw new Error('ID pemasukan proyek tidak valid.')
      }

      const { data: paidFeeBills, error: paidFeeBillsError } = await supabase
        .from('bills')
        .select('id')
        .eq('project_income_id', normalizedId)
        .is('deleted_at', null)
        .gt('paid_amount', 0)
        .limit(1)

      if (paidFeeBillsError) {
        throw paidFeeBillsError
      }

      if ((paidFeeBills ?? []).length > 0) {
        throw new Error(
          'Pemasukan proyek yang sudah memiliki pembayaran fee tidak bisa diubah.'
        )
      }

      if (!projectId) {
        throw new Error('Proyek wajib dipilih.')
      }

      if (!transactionDate) {
        throw new Error('Tanggal pemasukan wajib diisi.')
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Nominal termin harus lebih dari 0.')
      }

      if (!description) {
        throw new Error('Deskripsi termin wajib diisi.')
      }

      const updatePayload = {
        project_id: projectId,
        transaction_date: transactionDate,
        income_date: transactionDate,
        amount,
        description,
        notes,
        project_name_snapshot: projectName,
        updated_at: new Date().toISOString(),
      }

      const { data: updatedIncome, error } = await supabase
        .from('project_incomes')
        .update(updatePayload)
        .eq('id', normalizedId)
        .is('deleted_at', null)
        .select(
          'id, telegram_user_id, created_by_user_id, team_id, project_id, transaction_date, income_date, amount, description, notes, project_name_snapshot, created_at, updated_at, deleted_at'
        )
        .single()

      if (error) {
        throw error
      }

      set({ error: null })

      return mapProjectIncomeRow(updatedIncome)
    } catch (error) {
      const normalizedError = toError(
        error,
        'Gagal memperbarui pemasukan proyek.'
      )

      set({ error: normalizedError.message })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
  addProjectIncome: async (data = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const telegramUserId = resolveTelegramUserId(data.telegram_user_id)
      const createdByUserId = resolveProfileId(data.created_by_user_id)
      const teamId = resolveTeamId(data.team_id)
      const projectId = normalizeText(data.project_id)
      const projectName = normalizeText(data.project_name, '-')
      const transactionDate = normalizeText(data.transaction_date ?? data.transactionDate)
      const amount = toNumber(data.amount)
      const description = normalizeText(data.description)
      const notes = normalizeText(data.notes, null)

      if (!telegramUserId) {
        throw new Error('ID pengguna Telegram tidak ditemukan.')
      }

      if (!teamId) {
        throw new Error('Akses workspace tidak ditemukan.')
      }

      if (!projectId) {
        throw new Error('Proyek wajib dipilih.')
      }

      if (!transactionDate) {
        throw new Error('Tanggal pemasukan wajib diisi.')
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Nominal termin harus lebih dari 0.')
      }

      if (!description) {
        throw new Error('Deskripsi termin wajib diisi.')
      }

      const insertPayload = {
        telegram_user_id: telegramUserId,
        created_by_user_id: createdByUserId,
        team_id: teamId,
        project_id: projectId,
        transaction_date: transactionDate,
        income_date: transactionDate,
        amount,
        description,
        notes,
        project_name_snapshot: projectName,
      }

      const { data: insertedIncome, error } = await supabase
        .from('project_incomes')
        .insert(insertPayload)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      notifyTelegram(buildProjectIncomeNotificationPayload(data, projectName))

      set({ error: null })

      return {
        ...insertPayload,
        id: insertedIncome?.id ?? null,
      }
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menyimpan pemasukan proyek.')

      set({ error: normalizedError.message })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
  updateLoan: async (loanId, patch = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const normalizedLoanId = normalizeText(loanId)
      const creditorId = normalizeText(patch.creditor_id ?? patch.creditorId)
      const creditorName = normalizeText(patch.creditor_name ?? patch.creditorName, '-')
      const transactionDate = normalizeText(patch.transaction_date ?? patch.transactionDate)
      const principalAmount = toNumber(patch.principal_amount ?? patch.principalAmount)
      const repaymentAmount = toNumber(patch.repayment_amount ?? patch.repaymentAmount)
      const interestType = normalizeInterestType(
        patch.interest_type ?? patch.interestType
      )
      const interestRate = toNumber(patch.interest_rate ?? patch.interestRate, 0)
      const tenorMonths = Math.trunc(
        toNumber(patch.tenor_months ?? patch.tenorMonths, 0)
      )
      const description = normalizeText(patch.description)
      const notes = normalizeText(patch.notes, description)

      if (!normalizedLoanId) {
        throw new Error('Loan ID tidak valid.')
      }

      const { data: currentLoan, error: currentLoanError } = await supabase
        .from('loans')
        .select('paid_amount')
        .eq('id', normalizedLoanId)
        .is('deleted_at', null)
        .maybeSingle()

      if (currentLoanError) {
        throw currentLoanError
      }

      const currentPaidAmount = toNumber(currentLoan?.paid_amount, 0)

      if (!creditorId) {
        throw new Error('Kreditur wajib dipilih.')
      }

      if (!transactionDate) {
        throw new Error('Tanggal pinjaman wajib diisi.')
      }

      if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
        throw new Error('Pokok pinjaman harus lebih dari 0.')
      }

      if (!Number.isFinite(repaymentAmount) || repaymentAmount <= 0) {
        throw new Error('Total pengembalian harus lebih dari 0.')
      }

      if (repaymentAmount < currentPaidAmount) {
        throw new Error(
          'Total pengembalian tidak boleh lebih kecil dari nominal yang sudah dibayar.'
        )
      }

      const updatePayload = {
        creditor_id: creditorId,
        transaction_date: transactionDate,
        disbursed_date: transactionDate,
        principal_amount: principalAmount,
        repayment_amount: repaymentAmount,
        interest_type: interestType,
        interest_rate: interestType === 'interest' ? interestRate : null,
        tenor_months: tenorMonths > 0 ? tenorMonths : null,
        amount: principalAmount,
        description,
        notes,
        creditor_name_snapshot: creditorName,
        updated_at: new Date().toISOString(),
      }

      const { data: updatedLoan, error } = await supabase
        .from('loans')
        .update(updatePayload)
        .eq('id', normalizedLoanId)
        .is('deleted_at', null)
        .select(
          'id, telegram_user_id, created_by_user_id, team_id, creditor_id, transaction_date, disbursed_date, principal_amount, repayment_amount, interest_type, interest_rate, tenor_months, amount, description, notes, creditor_name_snapshot, status, paid_amount, created_at, updated_at, deleted_at'
        )
        .single()

      if (error) {
        throw error
      }

      set({ error: null })

      return mapLoanRow(updatedLoan)
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memperbarui pinjaman.')

      set({ error: normalizedError.message })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
  addLoan: async (data = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const telegramUserId = resolveTelegramUserId(data.telegram_user_id)
      const createdByUserId = resolveProfileId(data.created_by_user_id)
      const teamId = resolveTeamId(data.team_id)
      const creditorId = normalizeText(data.creditor_id ?? data.creditorId)
      const creditorName = normalizeText(data.creditor_name ?? data.creditorName, '-')
      const transactionDate = normalizeText(data.transaction_date ?? data.transactionDate)
      const principalAmount = toNumber(data.principal_amount ?? data.principalAmount)
      const repaymentAmount = toNumber(data.repayment_amount ?? data.repaymentAmount)
      const interestType = normalizeInterestType(
        data.interest_type ?? data.interestType
      )
      const interestRate = toNumber(data.interest_rate ?? data.interestRate, 0)
      const tenorMonths = Math.trunc(
        toNumber(data.tenor_months ?? data.tenorMonths, 0)
      )
      const description = normalizeText(data.description)
      const notes = normalizeText(data.notes, description)

      if (!telegramUserId) {
        throw new Error('ID pengguna Telegram tidak ditemukan.')
      }

      if (!teamId) {
        throw new Error('Akses workspace tidak ditemukan.')
      }

      if (!creditorId) {
        throw new Error('Kreditur wajib dipilih.')
      }

      if (!transactionDate) {
        throw new Error('Tanggal pinjaman wajib diisi.')
      }

      if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
        throw new Error('Pokok pinjaman harus lebih dari 0.')
      }

      if (!Number.isFinite(repaymentAmount) || repaymentAmount <= 0) {
        throw new Error('Total pengembalian harus lebih dari 0.')
      }

      if (interestType === 'interest' && interestRate < 0) {
        throw new Error('Suku bunga tidak valid.')
      }

      if (tenorMonths < 0) {
        throw new Error('Tenor pinjaman tidak valid.')
      }

      const insertPayload = {
        telegram_user_id: telegramUserId,
        created_by_user_id: createdByUserId,
        team_id: teamId,
        creditor_id: creditorId,
        transaction_date: transactionDate,
        disbursed_date: transactionDate,
        principal_amount: principalAmount,
        repayment_amount: repaymentAmount,
        interest_type: interestType,
        interest_rate: interestType === 'interest' ? interestRate : null,
        tenor_months: tenorMonths > 0 ? tenorMonths : null,
        amount: principalAmount,
        description,
        notes,
        creditor_name_snapshot: creditorName,
        status: 'unpaid',
        paid_amount: 0,
      }

      const { data: insertedLoan, error } = await supabase
        .from('loans')
        .insert(insertPayload)
        .select('id')
        .single()

      if (error) {
        throw error
      }

      notifyTelegram(buildLoanNotificationPayload(data, creditorName))

      set({ error: null })

      return {
        ...insertPayload,
        id: insertedLoan?.id ?? null,
      }
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menyimpan pinjaman.')

      set({ error: normalizedError.message })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
}))

export default useIncomeStore
export { useIncomeStore }
