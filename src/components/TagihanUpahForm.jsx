import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getAppTodayKey } from '../lib/date-time'
import { resolveFormBackRoute } from '../lib/form-shell'
import useMutationToast from '../hooks/useMutationToast'
import useMasterStore from '../store/useMasterStore'
import usePaymentStore from '../store/usePaymentStore'
import FormLayout from './layouts/FormLayout'
import MasterPickerField from './ui/MasterPickerField'
import {
  AppErrorState,
  AppInput,
  AppNominalInput,
  AppTextarea,
  FormSection,
} from './ui/AppPrimitives'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function createInitialFormData(initialData = null) {
  return {
    staffId: normalizeText(
      initialData?.staff_id ??
        initialData?.staffId ??
        initialData?.worker_id ??
        initialData?.workerId,
      ''
    ),
    projectId: normalizeText(initialData?.project_id ?? initialData?.projectId, ''),
    date: normalizeText(
      initialData?.transaction_date ?? initialData?.transactionDate ?? initialData?.date,
      getAppTodayKey()
    ),
    dueDate: normalizeText(initialData?.due_date ?? initialData?.dueDate, ''),
    amount: normalizeText(initialData?.amount, ''),
    notes: normalizeText(initialData?.notes, ''),
  }
}

function TagihanUpahForm({
  initialData = null,
  formId = 'tagihan-upah-form',
  onSuccess = null,
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [formData, setFormData] = useState(() => createInitialFormData(initialData))
  const projects = useMasterStore((state) => state.projects)
  const staffMembers = useMasterStore((state) => state.staffMembers)
  const isMasterLoading = useMasterStore((state) => state.isLoading)
  const masterError = useMasterStore((state) => state.error)
  const fetchMasters = useMasterStore((state) => state.fetchMasters)
  const submitBill = usePaymentStore((state) => state.submitBill)
  const isSubmitting = usePaymentStore((state) => state.isSubmitting)
  const error = usePaymentStore((state) => state.error)
  const clearError = usePaymentStore((state) => state.clearError)
  const { begin, clear, fail, succeed } = useMutationToast()
  const backRoute = resolveFormBackRoute('editRecord', {
    locationState: location.state,
    type: 'bill',
    fallbackRoute: '/pembayaran',
  })

  useEffect(() => {
    fetchMasters().catch((fetchError) => {
      console.error('Gagal memuat master data tagihan upah:', fetchError)
    })
  }, [fetchMasters])

  useEffect(() => {
    setFormData(createInitialFormData(initialData))
  }, [initialData])

  useEffect(() => () => clearError(), [clearError])
  useEffect(() => () => clear(), [clear])

  const staffOptions = useMemo(
    () =>
      staffMembers.map((staffMember) => ({
        value: staffMember.id,
        label: staffMember.staff_name ?? staffMember.name ?? 'Staf',
        description: staffMember.payment_type ? `Tipe: ${staffMember.payment_type}` : null,
        searchText: [
          staffMember.staff_name,
          staffMember.name,
          staffMember.payment_type,
          staffMember.fee_percentage,
          staffMember.fee_amount,
        ]
          .filter(Boolean)
          .join(' '),
      })),
    [staffMembers]
  )
  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.name,
        description: project.project_type ? `Tipe: ${project.project_type}` : null,
        searchText: [project.name, project.project_type, project.status].join(' '),
      })),
    [projects]
  )
  const selectedStaff = useMemo(
    () => staffOptions.find((staffMember) => staffMember.value === formData.staffId) ?? null,
    [formData.staffId, staffOptions]
  )
  const selectedProject = useMemo(
    () => projectOptions.find((project) => project.value === formData.projectId) ?? null,
    [formData.projectId, projectOptions]
  )
  const isMasterDataReady = !isMasterLoading && staffMembers.length > 0
  const masterDataMissing = !isMasterLoading && staffMembers.length === 0

  const handleFieldChange = (event) => {
    const { name, value } = event.target

    setFormData((currentValue) => ({
      ...currentValue,
      [name]: value,
    }))

    if (error) {
      clearError()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (isSubmitting || !isMasterDataReady) {
      return
    }

    try {
      begin({
        title: 'Menyimpan tagihan upah',
        message: 'Mohon tunggu sampai tagihan upah selesai disimpan.',
      })

      const createdBill = await submitBill({
        bill_type: 'gaji',
        staff_id: selectedStaff?.value ?? formData.staffId,
        staff_name_snapshot: selectedStaff?.label ?? null,
        project_id: selectedProject?.value ?? null,
        project_name_snapshot: selectedProject?.label ?? null,
        date: formData.date,
        dueDate: formData.dueDate,
        amount: formData.amount,
        notes: formData.notes,
      })

      try {
        await onSuccess?.(createdBill)
      } catch (refreshError) {
        console.error('Gagal memproses hasil simpan tagihan upah:', refreshError)
      }

      succeed({
        title: 'Tagihan upah tersimpan',
        message: 'Tagihan upah berhasil dicatat.',
      })

      navigate(backRoute ?? '/pembayaran', { replace: true })
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan tagihan upah.'

      fail({
        title: 'Tagihan upah gagal disimpan',
        message,
      })
      console.error(message)
    }
  }

  return (
    <form className="space-y-6" id={formId} onSubmit={handleSubmit}>
      <fieldset className="space-y-6" disabled={isSubmitting}>
        <FormLayout
          embedded
          embeddedFooterMode="fixed"
          hideFooterOnKeyboardVisible={false}
          actionLabel="Simpan Tagihan Upah"
          formId={formId}
          isSubmitting={isSubmitting}
          sections={[
            {
              id: 'tagihan-upah-identity',
              title: 'Data Utama',
            },
            {
              id: 'tagihan-upah-dates',
              title: 'Tanggal',
            },
            {
              id: 'tagihan-upah-amount',
              title: 'Nominal',
            },
            {
              id: 'tagihan-upah-notes',
              title: 'Catatan',
            },
          ]}
          submitDisabled={!isMasterDataReady}
        >
          <FormSection title="Data Utama">
            <div className="space-y-4">
              <MasterPickerField
                label="Staf"
                name="staffId"
                disabled={isMasterLoading}
                onChange={(nextValue) =>
                  setFormData((currentValue) => ({
                    ...currentValue,
                    staffId: nextValue,
                  }))
                }
                options={staffOptions}
                required
                searchable
                value={formData.staffId}
              />
              <MasterPickerField
                label="Proyek Terkait"
                name="projectId"
                disabled={isMasterLoading}
                onChange={(nextValue) =>
                  setFormData((currentValue) => ({
                    ...currentValue,
                    projectId: nextValue,
                  }))
                }
                options={projectOptions}
                searchable
                value={formData.projectId}
              />
            </div>
          </FormSection>

          <FormSection title="Tanggal">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Tanggal Tagih
                </span>
                <AppInput
                  name="date"
                  onChange={handleFieldChange}
                  type="date"
                  value={formData.date}
                  required
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Jatuh Tempo
                </span>
                <AppInput
                  name="dueDate"
                  onChange={handleFieldChange}
                  type="date"
                  value={formData.dueDate}
                />
              </label>
            </div>
          </FormSection>

          <FormSection title="Nominal">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Nominal Tagihan
              </span>
              <AppNominalInput
                name="amount"
                onValueChange={(nextValue) =>
                  setFormData((currentValue) => ({
                    ...currentValue,
                    amount: nextValue,
                  }))
                }
                required
                value={formData.amount}
              />
            </label>
          </FormSection>

          <FormSection title="Catatan">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Catatan</span>
              <AppTextarea name="notes" onChange={handleFieldChange} value={formData.notes} />
            </label>
          </FormSection>

          {error ? <AppErrorState title="Form belum valid" description={error} /> : null}

          {masterDataMissing || masterError ? (
            <AppErrorState
              title="Master data belum siap"
              description={masterError ?? 'Data staf belum tersedia.'}
            />
          ) : null}
        </FormLayout>
      </fieldset>
    </form>
  )
}

export default TagihanUpahForm
