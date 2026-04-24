import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import {
  resolveProfileId,
  resolveTeamId,
  resolveTelegramUserId,
} from '../lib/auth-context'
import {
  buildLoanTermsSnapshot,
  buildLoanLateChargeSummary,
  normalizeLoanInterestType,
  normalizeLoanLateInterestBasis,
  normalizeLoanLatePenaltyType,
} from '../lib/loan-business'
import {
  saveTransactionRecordFromApi,
  softDeleteTransactionFromApi,
} from '../lib/transactions-api'

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

async function notifyTelegram(payload) {
  const response = await fetch('/api/notify', {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const result = await response.json().catch(() => ({}))

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || 'Gagal mengirim notifikasi Telegram.')
  }

  return result
}

function showToast() {}

const loanSelectColumns =
  'id, telegram_user_id, created_by_user_id, team_id, creditor_id, transaction_date, disbursed_date, principal_amount, repayment_amount, interest_type, interest_rate, tenor_months, late_interest_rate, late_interest_basis, late_penalty_type, late_penalty_amount, loan_terms_snapshot, amount, description, notes, creditor_name_snapshot, status, paid_amount, created_at, updated_at, deleted_at'
const billSelectColumns =
  'id, expense_id, project_income_id, team_id, bill_type, description, amount, paid_amount, due_date, status, paid_at, supplier_name_snapshot, project_name_snapshot, worker_name_snapshot, created_at, updated_at, deleted_at'

function buildProjectIncomeNotificationPayload(
  data = {},
  projectName = '-',
  transactionId = null
) {
  return {
    notificationType: 'project_income',
    transactionId: normalizeText(transactionId, ''),
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

function buildLoanNotificationPayload(data = {}, creditorName = '-', transactionId = null) {
  const repaymentAmount =
    Number(data.repayment_amount ?? data.repaymentAmount ?? data.loan_terms_snapshot?.repayment_amount) || 0
  const principalAmount =
    Number(
      data.principal_amount ??
        data.principalAmount ??
        data.amount ??
        data.loan_terms_snapshot?.principal_amount
    ) || 0

  return {
    notificationType: 'loan',
    transactionId: normalizeText(transactionId, ''),
    userName: normalizeText(data.userName, 'Pengguna Telegram'),
    creditorName: normalizeText(creditorName, normalizeText(data.creditor_name_snapshot, '-')),
    transactionDate: normalizeText(
      data.transaction_date ?? data.transactionDate,
      new Date().toISOString()
    ),
    principalAmount,
    repaymentAmount,
    interestType: normalizeLoanInterestType(data.interest_type ?? data.interestType),
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

function mapBillSummaryRow(bill) {
  if (!bill?.id) {
    return null
  }

  const amount = toNumber(bill?.amount)
  const paidAmount = toNumber(bill?.paid_amount)

  return {
    id: bill.id,
    expenseId: bill.expense_id ?? null,
    projectIncomeId: bill.project_income_id ?? null,
    teamId: bill.team_id ?? null,
    billType: bill.bill_type ?? null,
    description: bill.description ?? null,
    amount,
    paidAmount,
    remainingAmount: Math.max(amount - paidAmount, 0),
    dueDate: bill.due_date ?? null,
    status: normalizeText(bill?.status, 'unpaid'),
    paidAt: bill.paid_at ?? null,
    supplierName: normalizeText(
      bill?.supplier_name_snapshot ?? bill?.worker_name_snapshot,
      'Tagihan belum terhubung'
    ),
    projectName: normalizeText(bill?.project_name_snapshot, 'Proyek belum terhubung'),
    deletedAt: bill.deleted_at ?? null,
    updatedAt: bill.updated_at ?? null,
  }
}

function getAggregatedBillStatus(totalAmount, paidAmount) {
  if (totalAmount > 0 && paidAmount >= totalAmount) {
    return 'paid'
  }

  if (paidAmount > 0) {
    return 'partial'
  }

  return 'unpaid'
}

function aggregateBillSummaries(bills = []) {
  const mappedBills = bills.map(mapBillSummaryRow).filter(Boolean)

  if (mappedBills.length === 0) {
    return {
      bill: null,
      bills: [],
    }
  }

  if (mappedBills.length === 1) {
    return {
      bill: mappedBills[0],
      bills: mappedBills,
    }
  }

  const amount = mappedBills.reduce((sum, bill) => sum + toNumber(bill.amount, 0), 0)
  const paidAmount = mappedBills.reduce((sum, bill) => sum + toNumber(bill.paidAmount, 0), 0)
  const dueDates = mappedBills.map((bill) => normalizeText(bill.dueDate, null)).filter(Boolean).sort()
  const paidAtValues = mappedBills
    .map((bill) => normalizeText(bill.paidAt, null))
    .filter(Boolean)
    .sort()
  const projectName = normalizeText(mappedBills[0]?.projectName, 'Proyek belum terhubung')
  const descriptions = [...new Set(mappedBills.map((bill) => normalizeText(bill.description, null)).filter(Boolean))]

  return {
    bill: {
      id: null,
      billIds: mappedBills.map((bill) => bill.id),
      projectIncomeId: mappedBills[0]?.projectIncomeId ?? null,
      teamId: mappedBills[0]?.teamId ?? null,
      billType: 'fee',
      description:
        descriptions.length === 1
          ? descriptions[0]
          : `Fee termin (${mappedBills.length} tagihan)`,
      amount,
      paidAmount,
      remainingAmount: Math.max(amount - paidAmount, 0),
      dueDate: dueDates[0] ?? null,
      status: getAggregatedBillStatus(amount, paidAmount),
      paidAt: paidAtValues.at(-1) ?? null,
      supplierName: mappedBills.length === 1 ? mappedBills[0].supplierName : `${mappedBills.length} fee staff`,
      projectName,
      deletedAt: null,
      updatedAt: null,
    },
    bills: mappedBills,
  }
}

function mapLoanRow(loan) {
  const loanTermsSnapshot = buildLoanTermsSnapshot(loan)
  const repaymentAmount = toNumber(loan?.repayment_amount ?? loanTermsSnapshot.repayment_amount, 0)
  const paidAmount = toNumber(loan?.paid_amount, 0)
  const remainingAmount = Math.max(repaymentAmount - paidAmount, 0)
  const lateChargeSummary = buildLoanLateChargeSummary(loan)

  return {
    ...loan,
    ...loanTermsSnapshot,
    late_charge_summary: lateChargeSummary,
    lateChargeSummary,
    principal_amount: loanTermsSnapshot.principal_amount,
    repayment_amount: repaymentAmount,
    amount: loanTermsSnapshot.amount,
    paid_amount: paidAmount,
    base_repayment_amount: loanTermsSnapshot.base_repayment_amount,
    baseRepaymentAmount: loanTermsSnapshot.base_repayment_amount,
    due_date: loanTermsSnapshot.due_date,
    dueDate: loanTermsSnapshot.due_date,
    creditor_name_snapshot: loanTermsSnapshot.creditor_name_snapshot,
    status: normalizeText(loan?.status, 'unpaid'),
    remaining_amount: remainingAmount,
    remainingAmount,
    loan_terms_snapshot: loan?.loan_terms_snapshot ?? loanTermsSnapshot,
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

  const [incomeResult, billResult] = await Promise.all([
    supabase
      .from('project_incomes')
      .select(
        'id, telegram_user_id, created_by_user_id, team_id, project_id, transaction_date, income_date, amount, description, notes, project_name_snapshot, created_at, updated_at, deleted_at'
      )
      .eq('id', normalizedId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('bills')
      .select(billSelectColumns)
      .eq('project_income_id', normalizedId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true })
      .order('created_at', { ascending: false }),
  ])

  if (incomeResult.error) {
    throw incomeResult.error
  }

  if (billResult.error) {
    throw billResult.error
  }

  if (!incomeResult.data) {
    return null
  }

  const { bill, bills } = aggregateBillSummaries(billResult.data ?? [])

  return {
    ...mapProjectIncomeRow(incomeResult.data),
    bill,
    bills,
  }
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
    .select(loanSelectColumns)
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

  const [loanResult, paymentResult] = await Promise.all([
    supabase
      .from('loans')
      .select(loanSelectColumns)
      .eq('id', normalizedLoanId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('loan_payments')
      .select(
        'id, loan_id, team_id, telegram_user_id, amount, payment_date, notes, created_at, updated_at, deleted_at, creditor_name_snapshot'
      )
      .eq('loan_id', normalizedLoanId)
      .is('deleted_at', null)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (loanResult.error) {
    throw loanResult.error
  }

  if (paymentResult.error) {
    throw paymentResult.error
  }

  if (!loanResult.data) {
    return null
  }

  return {
    ...mapLoanRow(loanResult.data),
    payments: (paymentResult.data ?? []).map((payment) => ({
      id: payment?.id,
      loanId: payment?.loan_id,
      teamId: payment?.team_id,
      telegramUserId: payment?.telegram_user_id,
      amount: toNumber(payment?.amount),
      paymentDate: payment?.payment_date,
      notes: payment?.notes,
      createdAt: payment?.created_at,
      updatedAt: payment?.updated_at,
      deletedAt: payment?.deleted_at,
      creditorNameSnapshot: payment?.creditor_name_snapshot,
    })),
  }
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
  softDeleteProjectIncome: async (projectIncomeId, expectedUpdatedAt = null) => {
    try {
      await softDeleteTransactionFromApi(
        'project-income',
        projectIncomeId,
        resolveTeamId(),
        expectedUpdatedAt
      )
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
  softDeleteLoan: async (loanId, expectedUpdatedAt = null) => {
    try {
      await softDeleteTransactionFromApi('loan', loanId, resolveTeamId(), expectedUpdatedAt)
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
        expectedUpdatedAt: normalizeText(
          patch.expectedUpdatedAt ?? patch.expected_updated_at ?? patch.updated_at ?? patch.updatedAt,
          null
        ),
      }

      const apiRecord = await saveTransactionRecordFromApi('PATCH', {
        recordType: 'project-income',
        id: normalizedId,
        teamId: resolveTeamId(),
        ...updatePayload,
      })

      if (!apiRecord) {
        throw new Error('Server tidak mengembalikan data pemasukan proyek.')
      }

      set({ error: null })

      return apiRecord
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

      const apiRecord = await saveTransactionRecordFromApi('POST', {
        recordType: 'project-income',
        ...insertPayload,
        project_name: projectName,
        teamId,
      })

      if (!apiRecord) {
        throw new Error('Server tidak mengembalikan data pemasukan proyek.')
      }

      void notifyTelegram(
        buildProjectIncomeNotificationPayload(
          {
            ...data,
            transaction_date: apiRecord.transaction_date ?? data.transaction_date,
          },
          projectName,
          apiRecord.id
        )
      ).catch(
        (notifyError) => {
          console.error('Notifikasi termin proyek gagal dikirim:', notifyError)
          showToast({
            tone: 'warning',
            title: 'Notifikasi termin proyek',
            message: 'Pemasukan proyek tersimpan, tetapi notifikasi Telegram gagal dikirim.',
          })
        }
      )

      set({ error: null })
      showToast({
        tone: 'success',
        title: 'Pemasukan proyek tersimpan',
        message: 'Termin proyek berhasil dicatat.',
      })

      return apiRecord
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menyimpan pemasukan proyek.')

      set({ error: normalizedError.message })
      showToast({
        tone: 'error',
        title: 'Pemasukan proyek gagal disimpan',
        message: normalizedError.message,
      })

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
      const interestType = normalizeLoanInterestType(
        patch.interest_type ?? patch.interestType
      )
      const interestRate = toNumber(patch.interest_rate ?? patch.interestRate, 0)
      const tenorMonths = Math.trunc(
        toNumber(patch.tenor_months ?? patch.tenorMonths, 0)
      )
      const lateInterestRate = toNumber(
        patch.late_interest_rate ?? patch.lateInterestRate,
        0
      )
      const lateInterestBasis = normalizeText(
        normalizeLoanLateInterestBasis(
          patch.late_interest_basis ?? patch.lateInterestBasis
        ),
        'remaining'
      )
      const latePenaltyType = normalizeText(
        normalizeLoanLatePenaltyType(
          patch.late_penalty_type ?? patch.latePenaltyType
        ),
        'none'
      )
      const latePenaltyAmount = toNumber(
        patch.late_penalty_amount ?? patch.latePenaltyAmount,
        0
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

      if (!creditorId) {
        throw new Error('Kreditur wajib dipilih.')
      }

      if (!transactionDate) {
        throw new Error('Tanggal pinjaman wajib diisi.')
      }

      if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
        throw new Error('Pokok pinjaman harus lebih dari 0.')
      }

      if (interestRate < 0) {
        throw new Error('Suku bunga tidak valid.')
      }

      if (tenorMonths < 0) {
        throw new Error('Tenor pinjaman tidak valid.')
      }

      if (lateInterestRate < 0) {
        throw new Error('Bunga keterlambatan tidak valid.')
      }

      if (latePenaltyAmount < 0) {
        throw new Error('Penalti keterlambatan tidak valid.')
      }

      const loanTermsSnapshot = buildLoanTermsSnapshot({
        principal_amount: principalAmount,
        interest_type: interestType,
        interest_rate: interestRate,
        tenor_months: tenorMonths,
        transaction_date: transactionDate,
        disbursed_date: transactionDate,
        late_interest_rate: lateInterestRate,
        late_interest_basis: lateInterestBasis,
        late_penalty_type: latePenaltyType,
        late_penalty_amount: latePenaltyAmount,
        creditor_name_snapshot: creditorName,
        amount: principalAmount,
      })
      const repaymentAmount = loanTermsSnapshot.repayment_amount

      const currentPaidAmount = toNumber(currentLoan?.paid_amount, 0)

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
        late_interest_rate: lateInterestRate > 0 ? lateInterestRate : 0,
        late_interest_basis: lateInterestBasis,
        late_penalty_type: latePenaltyType,
        late_penalty_amount: latePenaltyType === 'flat' ? latePenaltyAmount : 0,
        loan_terms_snapshot: loanTermsSnapshot,
        amount: principalAmount,
        description,
        notes,
        creditor_name_snapshot: creditorName,
        updated_at: new Date().toISOString(),
        expectedUpdatedAt: normalizeText(
          patch.expectedUpdatedAt ?? patch.expected_updated_at ?? patch.updated_at ?? patch.updatedAt,
          null
        ),
      }

      const apiRecord = await saveTransactionRecordFromApi('PATCH', {
        recordType: 'loan',
        id: normalizedLoanId,
        teamId: resolveTeamId(),
        ...updatePayload,
      })

      if (!apiRecord) {
        throw new Error('Server tidak mengembalikan data pinjaman.')
      }

      set({ error: null })
      showToast({
        tone: 'success',
        title: 'Pinjaman diperbarui',
        message: 'Perubahan pinjaman berhasil disimpan.',
      })

      return apiRecord
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memperbarui pinjaman.')

      set({ error: normalizedError.message })
      showToast({
        tone: 'error',
        title: 'Pinjaman gagal diperbarui',
        message: normalizedError.message,
      })

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
      const interestType = normalizeLoanInterestType(
        data.interest_type ?? data.interestType
      )
      const interestRate = toNumber(data.interest_rate ?? data.interestRate, 0)
      const tenorMonths = Math.trunc(
        toNumber(data.tenor_months ?? data.tenorMonths, 0)
      )
      const lateInterestRate = toNumber(
        data.late_interest_rate ?? data.lateInterestRate,
        0
      )
      const lateInterestBasis = normalizeText(
        normalizeLoanLateInterestBasis(
          data.late_interest_basis ?? data.lateInterestBasis
        ),
        'remaining'
      )
      const latePenaltyType = normalizeText(
        normalizeLoanLatePenaltyType(
          data.late_penalty_type ?? data.latePenaltyType
        ),
        'none'
      )
      const latePenaltyAmount = toNumber(
        data.late_penalty_amount ?? data.latePenaltyAmount,
        0
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

      if (interestType === 'interest' && interestRate < 0) {
        throw new Error('Suku bunga tidak valid.')
      }

      if (tenorMonths < 0) {
        throw new Error('Tenor pinjaman tidak valid.')
      }

      if (lateInterestRate < 0) {
        throw new Error('Bunga keterlambatan tidak valid.')
      }

      if (latePenaltyAmount < 0) {
        throw new Error('Penalti keterlambatan tidak valid.')
      }

      const loanTermsSnapshot = buildLoanTermsSnapshot({
        principal_amount: principalAmount,
        interest_type: interestType,
        interest_rate: interestRate,
        tenor_months: tenorMonths,
        transaction_date: transactionDate,
        disbursed_date: transactionDate,
        late_interest_rate: lateInterestRate,
        late_interest_basis: lateInterestBasis,
        late_penalty_type: latePenaltyType,
        late_penalty_amount: latePenaltyAmount,
        creditor_name_snapshot: creditorName,
        amount: principalAmount,
      })
      const repaymentAmount = loanTermsSnapshot.repayment_amount

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
        late_interest_rate: lateInterestRate > 0 ? lateInterestRate : 0,
        late_interest_basis: lateInterestBasis,
        late_penalty_type: latePenaltyType,
        late_penalty_amount: latePenaltyType === 'flat' ? latePenaltyAmount : 0,
        loan_terms_snapshot: loanTermsSnapshot,
        amount: principalAmount,
        description,
        notes,
        creditor_name_snapshot: creditorName,
        status: 'unpaid',
        paid_amount: 0,
      }

      const apiRecord = await saveTransactionRecordFromApi('POST', {
        recordType: 'loan',
        ...insertPayload,
        teamId,
      })

      if (!apiRecord) {
        throw new Error('Server tidak mengembalikan data pinjaman.')
      }

      let notificationError = null

      try {
        await notifyTelegram(
          buildLoanNotificationPayload(
            {
              ...apiRecord,
              userName: data.userName,
            },
            creditorName,
            apiRecord.id
          )
        )
      } catch (notifyError) {
        notificationError =
          notifyError instanceof Error
            ? notifyError.message
            : 'Gagal mengirim notifikasi Telegram.'

        console.error('Notifikasi loan gagal dikirim:', notifyError)
        showToast({
          tone: 'warning',
          title: 'Notifikasi pinjaman',
          message: 'Pinjaman tersimpan, tetapi notifikasi Telegram gagal dikirim.',
        })
      }

      set({ error: null })
      showToast({
        tone: 'success',
        title: 'Pinjaman tersimpan',
        message: 'Data pinjaman berhasil dicatat.',
      })

      return {
        ...apiRecord,
        notificationError,
      }
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menyimpan pinjaman.')

      set({ error: normalizedError.message })
      showToast({
        tone: 'error',
        title: 'Pinjaman gagal disimpan',
        message: normalizedError.message,
      })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
}))

export default useIncomeStore
export { useIncomeStore }
