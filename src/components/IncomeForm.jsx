import { useEffect, useState } from 'react'
import useTelegram from '../hooks/useTelegram'
import useAuthStore from '../store/useAuthStore'
import useIncomeStore from '../store/useIncomeStore'
import useMasterStore from '../store/useMasterStore'
import { getAppTodayKey } from '../lib/date-time'
import FormLayout from './layouts/FormLayout'
import MasterPickerField from './ui/MasterPickerField'
import {
  AppCard,
  AppErrorState,
  AppNominalInput,
  FormSection,
} from './ui/AppPrimitives'

const currencyFormatter = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
})

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

function createInitialFormData(initialData = null) {
  return {
    projectId: initialData?.project_id ?? initialData?.projectId ?? '',
    date:
      initialData?.transaction_date ??
      initialData?.transactionDate ??
      initialData?.date ??
      getAppTodayKey(),
    amount:
      initialData?.amount === 0 || initialData?.amount
        ? String(initialData.amount)
        : '',
    description: initialData?.description ?? '',
  }
}

function formatCurrency(value) {
  const amount = Number(value)

  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0)
}

function buildStaffFeePreview(staffMembers = [], terminAmount = 0) {
  return staffMembers.map((staffMember) => {
    const paymentType = String(staffMember?.payment_type ?? 'monthly').trim()
    const feePercentage = Number(staffMember?.fee_percentage) || 0
    const feeAmount = Number(staffMember?.fee_amount) || 0
    const salary = Number(staffMember?.salary) || 0

    if (paymentType === 'per_termin') {
      const estimatedFee =
        feePercentage > 0 ? (terminAmount * feePercentage) / 100 : feeAmount

      return {
        id: staffMember.id,
        name: staffMember.name,
        paymentType,
        estimatedFee,
        description:
          feePercentage > 0
            ? `${feePercentage}% dari nilai termin`
            : 'Nominal fee per termin',
      }
    }

    if (paymentType === 'fixed_per_termin') {
      return {
        id: staffMember.id,
        name: staffMember.name,
        paymentType,
        estimatedFee: feeAmount,
        description: 'Nominal tetap per termin',
      }
    }

    return {
      id: staffMember.id,
      name: staffMember.name,
      paymentType,
      estimatedFee: 0,
      description: salary > 0 ? 'Gaji bulanan, tidak dipotong dari termin ini' : 'Gaji bulanan',
    }
  })
}

function IncomeForm({ onSuccess, initialData = null, recordId = null, formId = 'income-form' }) {
  const [formData, setFormData] = useState(() => createInitialFormData(initialData))
  const [successMessage, setSuccessMessage] = useState(null)
  const { user } = useTelegram()
  const authUser = useAuthStore((state) => state.user)
  const projects = useMasterStore((state) => state.projects)
  const staffMembers = useMasterStore((state) => state.staffMembers)
  const isMasterLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const addProjectIncome = useIncomeStore((state) => state.addProjectIncome)
  const updateProjectIncome = useIncomeStore((state) => state.updateProjectIncome)
  const isSubmitting = useIncomeStore((state) => state.isSubmitting)
  const error = useIncomeStore((state) => state.error)
  const clearError = useIncomeStore((state) => state.clearError)
  const isEditMode = Boolean(recordId)
  const telegramUserId = getTelegramUserId(user, authUser)
  const userName = getUserDisplayName(user, authUser)
  const selectedProject = projects.find((project) => project.id === formData.projectId)
  const projectPickerOptions = projects.map((project) => ({
    value: project.id,
    label: project.name,
    description: project.project_type
      ? `Tipe: ${project.project_type}`
      : 'Master proyek aktif',
    searchText: [project.name, project.project_type, project.status].join(' '),
  }))
  const terminAmount = Number(formData.amount) || 0
  const staffFeePreview = buildStaffFeePreview(staffMembers, terminAmount)
  const estimatedStaffFeeTotal = staffFeePreview.reduce(
    (sum, item) => sum + item.estimatedFee,
    0
  )
  const isProjectDisabled = isSubmitting || isMasterLoading || projects.length === 0
  const isMasterDataReady = !isMasterLoading && projects.length > 0

  useEffect(() => {
    fetchMasters().catch((fetchError) => {
      console.error('Gagal memuat master data pemasukan:', fetchError)
    })
  }, [fetchMasters])

  useEffect(() => () => clearError(), [clearError])

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))

    if (error) {
      clearError()
    }

    if (successMessage) {
      setSuccessMessage(null)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (isSubmitting || !isMasterDataReady) {
      return
    }

    try {
      const payload = {
        telegram_user_id: telegramUserId,
        userName,
        expectedUpdatedAt: initialData?.updated_at ?? initialData?.updatedAt ?? null,
        project_id: formData.projectId,
        project_name: selectedProject?.name ?? null,
        transaction_date: formData.date,
        amount: formData.amount,
        description: formData.description,
      }

      if (isEditMode) {
        await updateProjectIncome(recordId, payload)
      } else {
        await addProjectIncome(payload)
      }

      try {
        await onSuccess?.()
      } catch (refreshError) {
        console.error('Gagal memperbarui ringkasan setelah termin proyek:', refreshError)
      }

      if (!isEditMode) {
        setFormData(createInitialFormData())
      }

      setSuccessMessage(
        isEditMode
          ? 'Pemasukan proyek berhasil diperbarui.'
          : 'Termin proyek berhasil disimpan.'
      )
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan termin proyek.'

      console.error(message)
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <fieldset className="space-y-6" disabled={isSubmitting}>
        <FormLayout
          embedded
          actionLabel={isEditMode ? 'Perbarui Pemasukan Proyek' : 'Simpan Termin Proyek'}
          formId={formId}
          isSubmitting={isSubmitting}
          sections={[
            {
              id: 'income-identity',
              title: 'Identitas Termin',
              description: 'Pilih proyek dan tanggal transaksi.',
            },
            {
              id: 'income-details',
              title: 'Nominal dan Deskripsi',
              description: 'Isi nominal termin dan ringkasan singkat.',
            },
            {
              id: 'income-preview',
              title: 'Preview dan Simpan',
              description: 'Cek ringkasan fee sebelum menyimpan.',
            },
          ]}
          submitDisabled={!isMasterDataReady}
        >
          <FormSection
            title="Identitas Termin"
            description="Pilih proyek dan tanggal transaksi."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-4">
                <MasterPickerField
                  disabled={isProjectDisabled}
                  emptyMessage="Data proyek belum tersedia."
                  label="Proyek"
                  name="projectId"
                  onChange={(nextValue) =>
                    handleChange({
                      target: {
                        name: 'projectId',
                        value: nextValue,
                      },
                    })
                  }
                  placeholder="Pilih proyek"
                  required
                  searchPlaceholder="Cari proyek..."
                  title="Pilih Proyek"
                  value={formData.projectId}
                  options={projectPickerOptions}
                />
              </div>

              <div className="space-y-4">
                <AppCard className="space-y-3 bg-white">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[var(--app-text-color)]">
                      Tanggal
                    </span>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                      name="date"
                      onChange={handleChange}
                      required
                      type="date"
                      value={formData.date}
                    />
                  </label>
                </AppCard>

                <AppCard className="space-y-2 bg-sky-50">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                    Ringkasan Proyek
                  </p>
                  <p className="text-sm font-semibold text-sky-900">
                    {selectedProject?.name ?? 'Pilih proyek untuk melihat ringkasan.'}
                  </p>
                  <p className="text-sm leading-6 text-sky-800">
                    {selectedProject?.project_type
                      ? `Tipe proyek: ${selectedProject.project_type}`
                      : 'Ringkasan proyek akan membantu memastikan termin masuk ke konteks yang tepat.'}
                  </p>
                </AppCard>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Nominal dan Deskripsi"
            description="Isi nominal termin dan ringkasan singkat."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <AppCard className="space-y-3 bg-white">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--app-text-color)]">
                    Nominal Termin
                  </span>
                  <AppNominalInput
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    name="amount"
                    onValueChange={(nextValue) =>
                      handleChange({
                        target: {
                          name: 'amount',
                          value: nextValue,
                        },
                      })
                    }
                    placeholder="Rp 0"
                    required
                    value={formData.amount}
                  />
                </label>
              </AppCard>

              <div className="space-y-4">
                <AppCard className="space-y-3 bg-white">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-[var(--app-text-color)]">
                      Deskripsi
                    </span>
                    <textarea
                      className="min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                      name="description"
                      onChange={handleChange}
                      placeholder="Contoh: Termin 1 pekerjaan struktur."
                      required
                      value={formData.description}
                    />
                  </label>
                </AppCard>

                <AppCard className="space-y-2 bg-slate-50">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    Ringkasan Nominal
                  </p>
                  <p className="text-sm font-semibold text-[var(--app-text-color)]">
                    {formatCurrency(terminAmount)}
                  </p>
                  <p className="text-sm leading-6 text-[var(--app-hint-color)]">
                    Estimasi fee staf akan dihitung berdasarkan nominal termin yang diisi.
                  </p>
                </AppCard>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Preview dan Simpan"
            description="Cek ringkasan nominal dan estimasi fee staf."
          >
            <div className="grid gap-4">
              <AppCard className="space-y-3 bg-white">
                <div className="space-y-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">
                    Preview Fee Staf
                  </p>
                </div>

                {staffFeePreview.length === 0 ? (
                  <p className="text-sm leading-6 text-sky-800">
                    Belum ada data staf. Tambahkan staf jika fee termin perlu dihitung.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {staffFeePreview.map((staffPreview) => (
                      <AppCard
                        key={staffPreview.id}
                        className="space-y-2 bg-white px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {staffPreview.name}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {staffPreview.description}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-sky-700">
                            {formatCurrency(staffPreview.estimatedFee)}
                          </p>
                        </div>
                      </AppCard>
                    ))}
                  </div>
                )}
              </AppCard>

              <div className="grid gap-3 sm:grid-cols-2">
                <AppCard className="space-y-2 bg-sky-50">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                    Total Estimasi Fee
                  </p>
                  <p className="text-lg font-semibold text-sky-900">
                    {formatCurrency(estimatedStaffFeeTotal)}
                  </p>
                </AppCard>

                <AppCard className="space-y-2 bg-white">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
                    Estimasi Dana Bersih
                  </p>
                  <p className="text-lg font-semibold text-[var(--app-text-color)]">
                    {formatCurrency(Math.max(terminAmount - estimatedStaffFeeTotal, 0))}
                  </p>
                </AppCard>
              </div>

              {error ? <AppErrorState title="Form belum valid" description={error} /> : null}

              {masterError ? (
                <AppErrorState
                  title="Master data belum siap"
                  description={masterError}
                />
              ) : null}

              {successMessage ? (
                <AppCard className="border-emerald-200 bg-emerald-50 text-sm leading-6 text-emerald-700">
                  {successMessage}
                </AppCard>
              ) : null}
            </div>
          </FormSection>
        </FormLayout>
      </fieldset>
    </form>
  )
}

export default IncomeForm
