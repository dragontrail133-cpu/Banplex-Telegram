import { useEffect, useMemo, useState } from 'react'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useIncomeStore from '../store/useIncomeStore'
import useMasterStore from '../store/useMasterStore'
import { getAppTodayKey } from '../lib/date-time'
import {
  buildLoanTermsSnapshot,
  calculateLoanLateCharge,
} from '../lib/loan-business'
import FormLayout from './layouts/FormLayout'
import MasterPickerField from './ui/MasterPickerField'
import {
  AppButton,
  AppErrorState,
  AppNominalInput,
  AppToggleGroup,
  FormSection,
} from './ui/AppPrimitives'

function getUserDisplayName(user, authUser) {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()

  if (fullName) {
    return fullName
  }

  if (user?.username) {
    return `@${user.username}`
  }

  if (authUser?.name) {
    return authUser.name
  }

  if (authUser?.telegram_user_id) {
    return authUser.telegram_user_id
  }

  return 'Pengguna Telegram'
}

function getTelegramUserId(user, authUser) {
  const resolvedValue = user?.id ?? authUser?.telegram_user_id ?? null
  const normalizedValue = String(resolvedValue ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : null
}

const previewCurrencyFormatter = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
})

function formatPreviewCurrency(value) {
  const normalizedValue = Number(value)

  if (!Number.isFinite(normalizedValue)) {
    return '-'
  }

  return `Rp ${previewCurrencyFormatter.format(Math.round(normalizedValue))}`
}

function createInitialFormData(initialData = null) {
  const loanTermsSnapshot = initialData ? buildLoanTermsSnapshot(initialData) : null

  return {
    creditorId: initialData?.creditor_id ?? initialData?.creditorId ?? '',
    date:
      initialData?.transaction_date ??
      initialData?.transactionDate ??
      initialData?.date ??
      getAppTodayKey(),
    principalAmount:
      initialData?.principal_amount === 0 || initialData?.principal_amount
        ? String(initialData.principal_amount)
        : initialData?.principalAmount === 0 || initialData?.principalAmount
          ? String(initialData.principalAmount)
          : '',
    repaymentAmount:
      loanTermsSnapshot?.repayment_amount === 0 || loanTermsSnapshot?.repayment_amount
        ? String(loanTermsSnapshot.repayment_amount)
        : initialData?.repayment_amount === 0 || initialData?.repayment_amount
          ? String(initialData.repayment_amount)
          : initialData?.repaymentAmount === 0 || initialData?.repaymentAmount
            ? String(initialData.repaymentAmount)
            : '',
    interestType:
      initialData?.interest_type ?? initialData?.interestType ?? 'none',
    interestRate:
      initialData?.interest_rate === 0 || initialData?.interest_rate
        ? String(initialData.interest_rate)
        : initialData?.interestRate === 0 || initialData?.interestRate
          ? String(initialData.interestRate)
          : '',
    tenorMonths:
      initialData?.tenor_months === 0 || initialData?.tenor_months
        ? String(initialData.tenor_months)
        : initialData?.tenorMonths === 0 || initialData?.tenorMonths
          ? String(initialData.tenorMonths)
          : '',
    lateInterestRate:
      initialData?.late_interest_rate === 0 || initialData?.late_interest_rate
        ? String(initialData.late_interest_rate)
        : initialData?.lateInterestRate === 0 || initialData?.lateInterestRate
          ? String(initialData.lateInterestRate)
          : '',
    lateInterestBasis:
      initialData?.late_interest_basis ?? initialData?.lateInterestBasis ?? 'remaining',
    latePenaltyType:
      initialData?.late_penalty_type ?? initialData?.latePenaltyType ?? 'none',
    latePenaltyAmount:
      initialData?.late_penalty_amount === 0 || initialData?.late_penalty_amount
        ? String(initialData.late_penalty_amount)
        : initialData?.latePenaltyAmount === 0 || initialData?.latePenaltyAmount
          ? String(initialData.latePenaltyAmount)
          : '',
    notes: initialData?.notes ?? initialData?.description ?? '',
  }
}

function LoanForm({ onSuccess, initialData = null, recordId = null }) {
  const [formData, setFormData] = useState(() => createInitialFormData(initialData))
  const [creditorNameDraft, setCreditorNameDraft] = useState('')
  const [successMessage, setSuccessMessage] = useState(null)
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const fundingCreditors = useMasterStore((state) => state.fundingCreditors)
  const isMasterLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const addFundingCreditor = useMasterStore((state) => state.addFundingCreditor)
  const addLoan = useIncomeStore((state) => state.addLoan)
  const updateLoan = useIncomeStore((state) => state.updateLoan)
  const isSubmitting = useIncomeStore((state) => state.isSubmitting)
  const error = useIncomeStore((state) => state.error)
  const clearError = useIncomeStore((state) => state.clearError)
  const isEditMode = Boolean(recordId)
  const telegramUserId = getTelegramUserId(user, authUser)
  const userName = getUserDisplayName(user, authUser)
  const selectedCreditor = fundingCreditors.find(
    (creditor) => creditor.id === formData.creditorId
  )
  const creditorPickerOptions = useMemo(
    () =>
      fundingCreditors.map((creditor) => ({
        value: creditor.id,
        label: creditor.name,
        description: creditor.notes ? creditor.notes : 'Master kreditur pendanaan',
        searchText: [creditor.name, creditor.notes].join(' '),
      })),
    [fundingCreditors]
  )
  const loanPreview = useMemo(
    () =>
      buildLoanTermsSnapshot({
        principal_amount: formData.principalAmount,
        interest_type: formData.interestType,
        interest_rate: formData.interestRate,
        tenor_months: formData.tenorMonths,
        transaction_date: formData.date,
        disbursed_date: formData.date,
        late_interest_rate: formData.lateInterestRate,
        late_interest_basis: formData.lateInterestBasis,
        late_penalty_type: formData.latePenaltyType,
        late_penalty_amount: formData.latePenaltyAmount,
        creditor_name_snapshot: selectedCreditor?.name ?? '-',
        amount: formData.principalAmount,
      }),
    [
      formData.date,
      formData.interestRate,
      formData.interestType,
      formData.lateInterestBasis,
      formData.lateInterestRate,
      formData.latePenaltyAmount,
      formData.latePenaltyType,
      formData.principalAmount,
      formData.tenorMonths,
      selectedCreditor?.name,
    ]
  )
  const lateChargePreview = useMemo(
    () =>
      calculateLoanLateCharge({
        principalAmount: loanPreview.principal_amount,
        remainingAmount: loanPreview.repayment_amount,
        dueDate: loanPreview.due_date,
        referenceDate: getAppTodayKey(),
        lateInterestRate: formData.lateInterestRate,
        lateInterestBasis: formData.lateInterestBasis,
        latePenaltyType: formData.latePenaltyType,
        latePenaltyAmount: formData.latePenaltyAmount,
      }),
    [
      formData.lateInterestBasis,
      formData.lateInterestRate,
      formData.latePenaltyAmount,
      formData.latePenaltyType,
      loanPreview.due_date,
      loanPreview.principal_amount,
      loanPreview.repayment_amount,
    ]
  )
  const isCreditorDisabled =
    isSubmitting || isMasterLoading || fundingCreditors.length === 0
  const isMasterDataReady = !isMasterLoading && fundingCreditors.length > 0

  useEffect(() => {
    fetchMasters().catch((fetchError) => {
      console.error('Gagal memuat master data pinjaman:', fetchError)
    })
  }, [fetchMasters])

  useEffect(() => () => clearError(), [clearError])

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
      ...(name === 'interestType' && value !== 'interest' ? { interestRate: '' } : {}),
      ...(name === 'latePenaltyType' && value !== 'flat' ? { latePenaltyAmount: '' } : {}),
    }))

    if (error) {
      clearError()
    }

    if (successMessage) {
      setSuccessMessage(null)
    }
  }

  const handleCreateCreditor = async () => {
    const normalizedName = String(creditorNameDraft ?? '').trim()

    if (!normalizedName) {
      return
    }

    try {
      const createdCreditor = await addFundingCreditor({
        creditor_name: normalizedName,
      })

      setCreditorNameDraft('')
      setFormData((current) => ({
        ...current,
        creditorId: createdCreditor.id,
      }))
    } catch (createError) {
      console.error(
        createError instanceof Error
          ? createError.message
          : 'Gagal menambah kreditur pendanaan.'
      )
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (isSubmitting || !isMasterDataReady) {
      return
    }

    try {
      if (!selectedCreditor) {
        throw new Error('Kreditur wajib dipilih.')
      }

      const payload = {
        telegram_user_id: telegramUserId,
        userName,
        expectedUpdatedAt: initialData?.updated_at ?? initialData?.updatedAt ?? null,
        creditor_id: formData.creditorId,
        creditor_name: selectedCreditor?.name ?? null,
        transaction_date: formData.date,
        principal_amount: formData.principalAmount,
        repayment_amount: loanPreview.repayment_amount,
        interest_type: formData.interestType,
        interest_rate: formData.interestRate,
        tenor_months: formData.tenorMonths,
        late_interest_rate: formData.lateInterestRate,
        late_interest_basis: formData.lateInterestBasis,
        late_penalty_type: formData.latePenaltyType,
        late_penalty_amount: formData.latePenaltyAmount,
        description: formData.notes,
        notes: formData.notes,
      }

      if (isEditMode) {
        await updateLoan(recordId, payload)
      } else {
        await addLoan(payload)
      }

      try {
        await onSuccess?.()
      } catch (refreshError) {
        console.error('Gagal memperbarui ringkasan setelah pinjaman:', refreshError)
      }

      if (!isEditMode) {
        setFormData(createInitialFormData())
      }

      setSuccessMessage(
        isEditMode ? 'Pinjaman berhasil diperbarui.' : 'Pinjaman berhasil disimpan.'
      )
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan pinjaman.'

      console.error(message)
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <fieldset className="space-y-6" disabled={isSubmitting}>
        <FormLayout
          embedded
          sections={[
            {
              id: 'loan-identity',
              title: 'Sumber Dana',
              description: 'Pilih kreditur dan tanggal pinjaman terlebih dahulu.',
            },
            {
              id: 'loan-preview',
              title: 'Pokok dan Preview',
              description: 'Masukkan nominal lalu lihat hasil pengembalian otomatis.',
            },
            {
              id: 'loan-late-charge',
              title: 'Denda dan Catatan',
              description: 'Atur bunga keterlambatan, penalti, dan catatan internal.',
            },
          ]}
        >
          <FormSection
            eyebrow="Pinjaman / Modal"
            title="Sumber Dana"
            description="Pilih kreditur dan tanggal pinjaman terlebih dahulu."
          >

            <MasterPickerField
              disabled={isCreditorDisabled}
              emptyMessage="Data kreditur belum tersedia."
              label="Kreditur / Sumber Dana"
              name="creditorId"
              onChange={(nextValue) =>
                handleChange({
                  target: {
                    name: 'creditorId',
                    value: nextValue,
                  },
                })
              }
              placeholder="Pilih kreditur"
              required
              searchPlaceholder="Cari kreditur..."
              title="Pilih Kreditur"
              value={formData.creditorId}
              options={creditorPickerOptions}
            />

            {fundingCreditors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/80 p-4">
                <p className="text-sm font-medium text-sky-800">
                  Belum ada kreditur tersimpan.
                </p>
                <p className="mt-1 text-sm leading-6 text-sky-700">
                  Tambahkan kreditur pertama agar pinjaman bisa dicatat.
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <input
                    className="flex-1 rounded-2xl border border-sky-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    onChange={(event) => setCreditorNameDraft(event.target.value)}
                    placeholder="Nama kreditur, misal: Bank Mandiri"
                    type="text"
                    value={creditorNameDraft}
                  />
                  <AppButton
                    className="sm:w-auto"
                    disabled={!String(creditorNameDraft ?? '').trim()}
                    onClick={handleCreateCreditor}
                    type="button"
                  >
                    Tambah Kreditur
                  </AppButton>
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Tanggal
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name="date"
                  onChange={handleChange}
                  required
                  type="date"
                  value={formData.date}
                />
              </label>

              <AppToggleGroup
                buttonSize="sm"
                description="Tipe bunga hanya punya dua mode dan tidak mengambil master data."
                label="Tipe Bunga"
                onChange={(nextValue) =>
                  handleChange({
                    target: {
                      name: 'interestType',
                      value: nextValue,
                    },
                  })
                }
                options={[
                  { value: 'none', label: 'Tanpa Bunga' },
                  { value: 'interest', label: 'Berbunga' },
                ]}
                value={formData.interestType}
              />
            </div>
          </FormSection>

          <FormSection
            eyebrow="Perhitungan"
            title="Pokok dan Preview"
            description="Masukkan nominal lalu lihat hasil pengembalian otomatis."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Pokok Pinjaman
                </span>
                <AppNominalInput
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name="principalAmount"
                  onValueChange={(nextValue) =>
                    handleChange({
                      target: {
                        name: 'principalAmount',
                        value: nextValue,
                      },
                    })
                  }
                  placeholder="Rp 0"
                  required
                  value={formData.principalAmount}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Total Pengembalian Otomatis
                </span>
                <AppNominalInput
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name="repaymentAmount"
                  placeholder="Rp 0"
                  required
                  readOnly
                  value={String(loanPreview.repayment_amount ?? '')}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Suku Bunga (%)
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                  disabled={formData.interestType !== 'interest'}
                  inputMode="decimal"
                  min="0"
                  name="interestRate"
                  onChange={handleChange}
                  placeholder="0"
                  step="0.01"
                  type="number"
                  value={formData.interestRate}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Tenor (Bulan)
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  inputMode="numeric"
                  min="0"
                  name="tenorMonths"
                  onChange={handleChange}
                  placeholder="0"
                  step="1"
                  type="number"
                  value={formData.tenorMonths}
                />
              </label>
            </div>

            <div className="space-y-4 rounded-[24px] border border-sky-100 bg-sky-50/70 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
                  Preview Otomatis
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-sky-100 bg-white/90 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Pokok + Bunga
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--app-text-color)]">
                    {formatPreviewCurrency(loanPreview.repayment_amount)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                    Total pengembalian akan mengikuti formula pinjaman yang dipilih.
                  </p>
                </div>

                <div className="rounded-2xl border border-sky-100 bg-white/90 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Jatuh Tempo
                  </p>
                  <p className="mt-2 text-lg font-semibold text-[var(--app-text-color)]">
                    {loanPreview.due_date ?? '-'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--app-hint-color)]">
                    Mengikuti tanggal transaksi dan tenor yang diisi.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-white/90 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Bunga Pokok
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                    {formatPreviewCurrency(
                      Math.max(
                        Number(loanPreview.repayment_amount) -
                          Number(loanPreview.principal_amount),
                        0
                      )
                    )}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/90 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Estimasi Denda Saat Ini
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                    {formatPreviewCurrency(lateChargePreview.totalLateChargeAmount ?? 0)}
                  </p>
                </div>

                <div className="rounded-2xl bg-white/90 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Overdue
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--app-text-color)]">
                    {lateChargePreview.overdueMonths > 0
                      ? `${lateChargePreview.overdueMonths} bulan`
                      : 'Belum lewat tempo'}
                  </p>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection
            eyebrow="Risiko"
            title="Denda dan Catatan"
            description="Atur bunga keterlambatan, penalti, dan catatan internal."
          >

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Bunga Keterlambatan (%)
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  inputMode="decimal"
                  min="0"
                  name="lateInterestRate"
                  onChange={handleChange}
                  placeholder="0"
                  step="0.01"
                  type="number"
                  value={formData.lateInterestRate}
                />
              </label>

              <AppToggleGroup
                buttonSize="sm"
                description="Basis hitung denda hanya punya dua opsi."
                label="Basis Hitung Denda"
                onChange={(nextValue) =>
                  handleChange({
                    target: {
                      name: 'lateInterestBasis',
                      value: nextValue,
                    },
                  })
                }
                options={[
                  { value: 'remaining', label: 'Sisa Pengembalian' },
                  { value: 'principal', label: 'Pokok Pinjaman' },
                ]}
                value={formData.lateInterestBasis}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <AppToggleGroup
                buttonSize="sm"
                description="Jenis penalti hanya punya dua mode."
                label="Jenis Penalti"
                onChange={(nextValue) =>
                  handleChange({
                    target: {
                      name: 'latePenaltyType',
                      value: nextValue,
                    },
                  })
                }
                options={[
                  { value: 'none', label: 'Tanpa Penalti' },
                  { value: 'flat', label: 'Flat' },
                ]}
                value={formData.latePenaltyType}
              />

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Nominal Penalti Flat
                </span>
                <AppNominalInput
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                  disabled={formData.latePenaltyType !== 'flat'}
                  name="latePenaltyAmount"
                  onValueChange={(nextValue) =>
                    handleChange({
                      target: {
                        name: 'latePenaltyAmount',
                        value: nextValue,
                      },
                    })
                  }
                  placeholder="Rp 0"
                  value={formData.latePenaltyAmount}
                />
              </label>
            </div>

            <details className="group rounded-[22px] border border-dashed border-[var(--app-outline-soft)] bg-[var(--app-surface-low-color)] px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--app-text-color)]">
                <span>Catatan opsional</span>
                <span className="text-xs font-medium text-[var(--app-hint-color)] group-open:hidden">
                  Tampilkan
                </span>
                <span className="hidden text-xs font-medium text-[var(--app-hint-color)] group-open:inline">
                  Sembunyikan
                </span>
              </summary>
              <div className="pt-4">
                <textarea
                  className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name="notes"
                  onChange={handleChange}
                  placeholder="Contoh: Dana talangan untuk pembelian material."
                  value={formData.notes}
                />
              </div>
            </details>

            {error ? <AppErrorState description={error} title="Form belum valid" /> : null}

            {masterError ? (
              <AppErrorState description={masterError} title="Master data belum siap" />
            ) : null}

            {successMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700">
                {successMessage}
              </div>
            ) : null}

            <AppButton
              className="w-full"
              disabled={isSubmitting || !isMasterDataReady}
              size="lg"
              type="submit"
            >
              {isSubmitting
                ? 'Menyimpan...'
                : isEditMode
                  ? 'Perbarui Pinjaman'
                  : 'Simpan Pinjaman'}
            </AppButton>
          </FormSection>
        </FormLayout>
      </fieldset>
    </form>
  )
}

export default LoanForm
