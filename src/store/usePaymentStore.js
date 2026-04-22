import { create } from 'zustand'
import { resolveTeamId, resolveTelegramUserId } from '../lib/auth-context'
import {
  createBillPaymentFromApi,
  deleteBillPaymentFromApi,
  updateBillPaymentFromApi,
} from '../lib/records-api'
import {
  createLoanPaymentFromApi,
  deleteLoanPaymentFromApi,
  updateLoanPaymentFromApi,
} from '../lib/transactions-api'
import useIncomeStore from './useIncomeStore'
import useBillStore from './useBillStore'
import useToastStore from './useToastStore'

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toError(error) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : 'Gagal menyimpan pembayaran. Silakan coba lagi.'

  return error instanceof Error ? error : new Error(message)
}

function showToast(toast) {
  useToastStore.getState().showToast(toast)
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

function buildBillPaymentPayload(paymentData = {}) {
  const billId = normalizeText(paymentData.bill_id ?? paymentData.billId)
  const telegramUserId = resolveTelegramUserId(
    paymentData.telegram_user_id ?? paymentData.telegramUserId
  )
  const teamId = resolveTeamId(paymentData.team_id ?? paymentData.teamId)
  const paymentDate = normalizeText(
    paymentData.payment_date ?? paymentData.paymentDate
  )
  const notes = normalizeText(paymentData.notes)
  const amount = Number(paymentData.amount)
  const maxAmount = Number(paymentData.maxAmount ?? paymentData.remainingAmountBeforePayment)

  if (!billId) {
    throw new Error('Bill ID tidak valid.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal pembayaran harus lebih dari 0.')
  }

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  if (Number.isFinite(maxAmount) && amount > maxAmount) {
    throw new Error('Nominal pembayaran melebihi sisa tagihan.')
  }

  if (!paymentDate) {
    throw new Error('Tanggal pembayaran wajib diisi.')
  }

  return {
    bill_id: billId,
    telegram_user_id: telegramUserId,
    team_id: teamId,
    amount,
    payment_date: paymentDate,
    notes,
    worker_name_snapshot: normalizeText(paymentData.workerName, null),
    supplier_name_snapshot: normalizeText(paymentData.supplierName, null),
    project_name_snapshot: normalizeText(paymentData.projectName, null),
    updated_at: new Date().toISOString(),
    expectedUpdatedAt: normalizeText(
      paymentData.expectedUpdatedAt ?? paymentData.expected_updated_at ?? paymentData.updated_at ?? paymentData.updatedAt,
      null
    ),
  }
}

function buildBillPaymentUpdatePayload(paymentData = {}) {
  const paymentId = normalizeText(paymentData.payment_id ?? paymentData.paymentId)
  const teamId = resolveTeamId(paymentData.team_id ?? paymentData.teamId)
  const amount = Number(paymentData.amount)
  const paymentDate = normalizeText(
    paymentData.payment_date ?? paymentData.paymentDate
  )

  if (!paymentId) {
    throw new Error('Bill payment ID tidak valid.')
  }

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal pembayaran harus lebih dari 0.')
  }

  if (!paymentDate) {
    throw new Error('Tanggal pembayaran wajib diisi.')
  }

  return {
    paymentId,
    teamId,
    amount,
    paymentDate,
    notes: normalizeText(paymentData.notes),
    expectedUpdatedAt: normalizeText(
      paymentData.expectedUpdatedAt ?? paymentData.expected_updated_at ?? paymentData.updated_at ?? paymentData.updatedAt,
      null
    ),
  }
}

function buildBillPaymentDeletePayload(paymentData = {}) {
  const paymentId = normalizeText(paymentData.payment_id ?? paymentData.paymentId)
  const teamId = resolveTeamId(paymentData.team_id ?? paymentData.teamId)

  if (!paymentId) {
    throw new Error('Bill payment ID tidak valid.')
  }

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  return {
    paymentId,
    teamId,
  }
}

function getBillPaymentRemainingAmount(bill = {}) {
  const totalAmount = Number(bill.amount ?? bill.total_amount ?? bill.totalAmount)
  const paidAmount = Number(bill.paid_amount ?? bill.paidAmount)
  const remainingAmount = Number(bill.remainingAmount ?? bill.remaining_amount)

  if (Number.isFinite(remainingAmount) && remainingAmount >= 0) {
    return remainingAmount
  }

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return 0
  }

  return Math.max(totalAmount - (Number.isFinite(paidAmount) ? paidAmount : 0), 0)
}

function getLoanPaymentRemainingAmount(loan = {}) {
  const targetAmount = Number(
    loan.loan_terms_snapshot?.base_repayment_amount ??
      loan.loan_terms_snapshot?.repayment_amount ??
      loan.repayment_amount ??
      loan.principal_amount ??
      loan.amount ??
      loan.total_amount ??
      loan.totalAmount
  )
  const paidAmount = Number(loan.paid_amount ?? loan.paidAmount)
  const remainingAmount = Number(loan.remainingAmount ?? loan.remaining_amount)

  if (Number.isFinite(remainingAmount) && remainingAmount >= 0) {
    return remainingAmount
  }

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return 0
  }

  return Math.max(targetAmount - (Number.isFinite(paidAmount) ? paidAmount : 0), 0)
}

function buildPaymentNotificationPayload({ payment = {}, bill = {}, userName = 'Pengguna Telegram' } = {}) {
  return {
    notificationType: 'bill_payment',
    billId: normalizeText(
      payment.billId ?? payment.bill_id ?? bill.id ?? bill.billId,
      '-'
    ),
    paymentDate: normalizeText(
      payment.paymentDate ?? payment.payment_date ?? payment.date,
      new Date().toISOString()
    ),
    userName: normalizeText(userName, 'Pengguna Telegram'),
    supplierName: normalizeText(
      bill.supplierName ??
        bill.supplier_name_snapshot ??
        bill.worker_name_snapshot ??
        payment.supplierName ??
        payment.supplier_name_snapshot ??
        payment.worker_name_snapshot,
      '-'
    ),
    projectName: normalizeText(
      bill.projectName ??
        bill.project_name_snapshot ??
        payment.projectName ??
        payment.project_name_snapshot,
      '-'
    ),
    amount: Number(payment.amount) || 0,
    remainingAmount: getBillPaymentRemainingAmount(bill),
    description: normalizeText(
      payment.notes ?? payment.description ?? bill.description,
      'Pembayaran tagihan telah dilakukan.'
    ),
  }
}

function buildLoanPaymentPayload(paymentData = {}) {
  const loanId = normalizeText(paymentData.loan_id ?? paymentData.loanId)
  const teamId = resolveTeamId(paymentData.team_id ?? paymentData.teamId)
  const telegramUserId = resolveTelegramUserId(
    paymentData.telegram_user_id ?? paymentData.telegramUserId
  )
  const paymentDate = normalizeText(
    paymentData.payment_date ?? paymentData.paymentDate
  )
  const amount = Number(paymentData.amount)
  const maxAmount = Number(
    paymentData.maxAmount ?? paymentData.remainingAmountBeforePayment
  )

  if (!loanId) {
    throw new Error('Loan ID tidak valid.')
  }

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal pembayaran pinjaman harus lebih dari 0.')
  }

  if (Number.isFinite(maxAmount) && amount > maxAmount) {
    throw new Error('Nominal pembayaran melebihi sisa pinjaman.')
  }

  if (!paymentDate) {
    throw new Error('Tanggal pembayaran wajib diisi.')
  }

  return {
    loan_id: loanId,
    team_id: teamId,
    telegram_user_id: telegramUserId,
    amount,
    payment_date: paymentDate,
    notes: normalizeText(paymentData.notes),
    creditor_name_snapshot: normalizeText(paymentData.creditorName, null),
    updated_at: new Date().toISOString(),
    expectedUpdatedAt: normalizeText(
      paymentData.expectedUpdatedAt ?? paymentData.expected_updated_at ?? paymentData.updated_at ?? paymentData.updatedAt,
      null
    ),
  }
}

function buildLoanPaymentUpdatePayload(paymentData = {}) {
  const paymentId = normalizeText(paymentData.payment_id ?? paymentData.paymentId)
  const teamId = resolveTeamId(paymentData.team_id ?? paymentData.teamId)
  const amount = Number(paymentData.amount)
  const paymentDate = normalizeText(
    paymentData.payment_date ?? paymentData.paymentDate
  )

  if (!paymentId) {
    throw new Error('Loan payment ID tidak valid.')
  }

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Nominal pembayaran pinjaman harus lebih dari 0.')
  }

  if (!paymentDate) {
    throw new Error('Tanggal pembayaran wajib diisi.')
  }

  return {
    paymentId,
    teamId,
    amount,
    paymentDate,
    notes: normalizeText(paymentData.notes),
    expectedUpdatedAt: normalizeText(
      paymentData.expectedUpdatedAt ?? paymentData.expected_updated_at ?? paymentData.updated_at ?? paymentData.updatedAt,
      null
    ),
  }
}

function buildLoanPaymentDeletePayload(paymentData = {}) {
  const paymentId = normalizeText(paymentData.payment_id ?? paymentData.paymentId)
  const teamId = resolveTeamId(paymentData.team_id ?? paymentData.teamId)

  if (!paymentId) {
    throw new Error('Loan payment ID tidak valid.')
  }

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  return {
    paymentId,
    teamId,
  }
}

function buildLoanPaymentNotificationPayload({ payment = {}, loan = {}, userName = 'Pengguna Telegram' } = {}) {
  return {
    notificationType: 'loan_payment',
    loanId: normalizeText(payment.loanId ?? payment.loan_id ?? loan.id ?? loan.loanId, '-'),
    paymentDate: normalizeText(
      payment.paymentDate ?? payment.payment_date ?? payment.date,
      new Date().toISOString()
    ),
    userName: normalizeText(userName, 'Pengguna Telegram'),
    creditorName: normalizeText(
      payment.creditorName ??
        payment.creditor_name_snapshot ??
        loan.creditorName ??
        loan.creditor_name_snapshot,
      '-'
    ),
    amount: Number(payment.amount) || 0,
    remainingAmount: getLoanPaymentRemainingAmount(loan),
    description: normalizeText(
      payment.notes ?? payment.description ?? loan.description,
      'Pembayaran pinjaman telah dilakukan.'
    ),
  }
}

const usePaymentStore = create((set) => ({
  isSubmitting: false,
  error: null,
  clearError: () => set({ error: null }),
  submitBillPayment: async (paymentData = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      const payload = buildBillPaymentPayload(paymentData)
      const { payment, bill } = await createBillPaymentFromApi(payload)

      await useBillStore.getState().fetchUnpaidBills({
        teamId: payload.team_id,
        silent: true,
      })

      notifyTelegram(
        buildPaymentNotificationPayload({
          payment,
          bill,
          userName: paymentData.userName,
        })
      ).catch((notifyError) => {
        console.error('Gagal memanggil endpoint notifikasi pembayaran:', notifyError)
        showToast({
          tone: 'warning',
          title: 'Notifikasi pembayaran',
          message: 'Pembayaran tagihan tersimpan, tetapi notifikasi Telegram gagal dikirim.',
        })
      })

      set({ error: null })
      showToast({
        tone: 'success',
        title: 'Pembayaran tagihan tersimpan',
        message: 'Pembayaran tagihan berhasil dicatat.',
      })

      return payment
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })
      showToast({
        tone: 'error',
        title: 'Pembayaran tagihan gagal',
        message: normalizedError.message,
      })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
  updateBillPayment: async (paymentData = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      const payload = buildBillPaymentUpdatePayload(paymentData)
      const { payment, bill } = await updateBillPaymentFromApi(payload.paymentId, payload)

      await useBillStore.getState().fetchUnpaidBills({
        teamId: payload.teamId,
        silent: true,
      })

      set({ error: null })
      showToast({
        tone: 'success',
        title: 'Pembayaran tagihan diperbarui',
        message: 'Perubahan pembayaran tagihan berhasil disimpan.',
      })

      return {
        payment,
        bill,
      }
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })
      showToast({
        tone: 'error',
        title: 'Pembayaran tagihan gagal diperbarui',
        message: normalizedError.message,
      })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
  deleteBillPayment: async (paymentData = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      const payload = buildBillPaymentDeletePayload(paymentData)
      const { bill } = await deleteBillPaymentFromApi(payload.paymentId, payload.teamId)

      await useBillStore.getState().fetchUnpaidBills({
        teamId: payload.teamId,
        silent: true,
      })

      set({ error: null })
      showToast({
        tone: 'success',
        title: 'Pembayaran tagihan diarsipkan',
        message: 'Pembayaran tagihan berhasil dihapus.',
      })

      return bill
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })
      showToast({
        tone: 'error',
        title: 'Pembayaran tagihan gagal diarsipkan',
        message: normalizedError.message,
      })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
  updateLoanPayment: async (paymentData = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      const payload = buildLoanPaymentUpdatePayload(paymentData)
      const { payment, loan } = await updateLoanPaymentFromApi(payload.paymentId, payload)

      await useIncomeStore.getState().fetchLoans({
        teamId: payload.teamId,
      })

      set({ error: null })
      showToast({
        tone: 'success',
        title: 'Pembayaran pinjaman diperbarui',
        message: 'Perubahan pembayaran pinjaman berhasil disimpan.',
      })

      return {
        payment,
        loan,
      }
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })
      showToast({
        tone: 'error',
        title: 'Pembayaran pinjaman gagal diperbarui',
        message: normalizedError.message,
      })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
  deleteLoanPayment: async (paymentData = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      const payload = buildLoanPaymentDeletePayload(paymentData)
      const { payment, loan } = await deleteLoanPaymentFromApi(payload.paymentId, payload.teamId)

      await useIncomeStore.getState().fetchLoans({
        teamId: payload.teamId,
      })

      set({ error: null })
      showToast({
        tone: 'success',
        title: 'Pembayaran pinjaman diarsipkan',
        message: 'Pembayaran pinjaman berhasil dihapus.',
      })

      return {
        payment,
        loan,
      }
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })
      showToast({
        tone: 'error',
        title: 'Pembayaran pinjaman gagal diarsipkan',
        message: normalizedError.message,
      })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
  submitLoanPayment: async (paymentData = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      const payload = buildLoanPaymentPayload(paymentData)
      const { payment, loan } = await createLoanPaymentFromApi(payload)

      await useIncomeStore.getState().fetchLoans({
        teamId: payload.team_id,
      })

      notifyTelegram(
        buildLoanPaymentNotificationPayload({
          payment,
          loan,
          userName: paymentData.userName,
        })
      ).catch((notifyError) => {
        console.error('Gagal memanggil endpoint notifikasi pembayaran:', notifyError)
        showToast({
          tone: 'warning',
          title: 'Notifikasi pembayaran',
          message: 'Pembayaran pinjaman tersimpan, tetapi notifikasi Telegram gagal dikirim.',
        })
      })

      set({ error: null })
      showToast({
        tone: 'success',
        title: 'Pembayaran pinjaman tersimpan',
        message: 'Pembayaran pinjaman berhasil dicatat.',
      })

      return payment
    } catch (error) {
      const normalizedError = toError(error)

      set({ error: normalizedError.message })
      showToast({
        tone: 'error',
        title: 'Pembayaran pinjaman gagal',
        message: normalizedError.message,
      })

      throw normalizedError
    } finally {
      set({ isSubmitting: false })
    }
  },
}))

export default usePaymentStore
export { usePaymentStore }
