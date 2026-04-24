import { useEffect, useState } from 'react'
import { Loader2, Plus, RefreshCcw, Users } from 'lucide-react'
import ActionCard from './ui/ActionCard'
import {
  AppButton,
  AppCardDashed,
  AppCardStrong,
  AppEmptyState,
  AppInput,
  AppSelect,
  AppSheet,
  AppWrapToggleGroup,
  AppTextarea,
  PageSection,
} from './ui/AppPrimitives'
import useMutationToast from '../hooks/useMutationToast'
import { formatAppDateLabel } from '../lib/date-time'
import useHrStore, { beneficiaryStatusOptions } from '../store/useHrStore'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function formatDate(value) {
  return formatAppDateLabel(value)
}

function createInitialFormData() {
  return {
    name: '',
    nik: '',
    institution: '',
    status: 'active',
    notes: '',
  }
}

function renderSheetFeedback(helperText) {
  return (
    <AppCardDashed className="px-4 py-3 text-sm leading-6 text-[var(--app-hint-color)]">
      {helperText}
    </AppCardDashed>
  )
}

function BeneficiaryList() {
  const [formData, setFormData] = useState(createInitialFormData)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const formId = 'beneficiary-form'
  const beneficiaries = useHrStore((state) => state.beneficiaries)
  const isLoading = useHrStore((state) => state.isLoading)
  const isSubmitting = useHrStore((state) => state.isSubmitting)
  const error = useHrStore((state) => state.error)
  const clearError = useHrStore((state) => state.clearError)
  const fetchBeneficiaries = useHrStore((state) => state.fetchBeneficiaries)
  const addBeneficiary = useHrStore((state) => state.addBeneficiary)
  const updateBeneficiary = useHrStore((state) => state.updateBeneficiary)
  const deleteBeneficiary = useHrStore((state) => state.deleteBeneficiary)
  const { begin, fail, succeed } = useMutationToast()
  useEffect(() => {
    fetchBeneficiaries({ force: true }).catch((fetchError) => {
      console.error('Gagal memuat penerima manfaat:', fetchError)
    })
  }, [fetchBeneficiaries])

  const resetModalState = () => {
    setFormData(createInitialFormData())
    setEditingId(null)
    clearError()
  }

  const handleCloseModal = () => {
    resetModalState()
    setIsModalOpen(false)
  }

  const openCreateModal = () => {
    resetModalState()
    setIsModalOpen(true)
  }

  const openEditModal = (beneficiary) => {
    setEditingId(beneficiary.id)
    setFormData({
      name: beneficiary.name ?? '',
      nik: beneficiary.nik ?? '',
      institution: beneficiary.institution ?? '',
      status: beneficiary.status ?? 'active',
      notes: beneficiary.notes ?? '',
    })
    clearError()
    setIsModalOpen(true)
  }

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))

    if (error) {
      clearError()
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const name = normalizeText(formData.name)
    const nik = normalizeText(formData.nik, '')
    const institution = normalizeText(formData.institution, '')
    const status = normalizeText(formData.status, 'active')
    const notes = normalizeText(formData.notes, '')

    if (!name) {
      fail({
        title: 'Form penerima manfaat belum lengkap',
        message: 'Nama penerima manfaat wajib diisi.',
      })
      return
    }

    try {
      begin({
        title: editingId ? 'Memperbarui penerima manfaat' : 'Menyimpan penerima manfaat',
        message: 'Mohon tunggu sampai data penerima manfaat selesai diproses.',
      })

      if (editingId) {
        await updateBeneficiary(editingId, {
          name,
          nik,
          institution,
          status,
          notes,
        })
      } else {
        await addBeneficiary({
          name,
          nik,
          institution,
          status,
          notes,
        })
      }

      await fetchBeneficiaries({ force: true })

      handleCloseModal()
      succeed({
        title: editingId ? 'Penerima manfaat diperbarui' : 'Penerima manfaat tersimpan',
        message: editingId
          ? 'Perubahan data penerima manfaat berhasil disimpan.'
          : 'Data penerima manfaat berhasil disimpan.',
      })
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan data penerima manfaat.'

      fail({
        title: editingId ? 'Penerima manfaat gagal diperbarui' : 'Penerima manfaat gagal disimpan',
        message,
      })
      clearError()
    }
  }

  const handleDeleteBeneficiary = async (beneficiary) => {
    if (!beneficiary?.id || isSubmitting) {
      return
    }

    begin({
      title: 'Menghapus penerima manfaat',
      message: 'Mohon tunggu sampai data hilang dari daftar.',
    })

    try {
      await deleteBeneficiary(beneficiary.id)
      await fetchBeneficiaries({ force: true })
      succeed({
        title: 'Penerima manfaat dihapus',
        message: 'Data penerima manfaat berhasil dihapus.',
      })
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Gagal menghapus penerima manfaat.'

      fail({
        title: 'Penerima manfaat gagal dihapus',
        message,
      })
      clearError()
      console.error('Gagal menghapus penerima manfaat:', deleteError)
    }
  }

  return (
    <PageSection
      eyebrow="Data Penerima Manfaat"
      title="Daftar penerima manfaat"
      description="Kelola data penerima manfaat secara sederhana dengan tabel, tambah, edit, dan hapus langsung dari modal ini."
      action={
        <div className="flex flex-wrap justify-end gap-3">
          <AppButton
            disabled={isLoading}
            onClick={() => {
              void fetchBeneficiaries({ force: true }).catch((fetchError) => {
                console.error('Gagal memuat ulang penerima manfaat:', fetchError)
              })
            }}
            variant="secondary"
            type="button"
          >
            <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </AppButton>

          <AppButton
            onClick={openCreateModal}
            leadingIcon={<Plus className="h-4 w-4" />}
            type="button"
          >
            Tambah Data
          </AppButton>
        </div>
      }
    >

      {error ? (
        <AppErrorState
          description={error}
          title="Penerima manfaat gagal dimuat"
        />
      ) : null}

      {isLoading && beneficiaries.length === 0 ? (
        <AppEmptyState
          description="Menarik data terbaru dari server."
          icon={<Loader2 className="h-10 w-10 animate-spin" />}
          title="Memuat data penerima manfaat"
        />
      ) : beneficiaries.length > 0 ? (
        <AppCardStrong padded={false} className="overflow-hidden">
          {beneficiaries.map((beneficiary) => (
            <ActionCard
              key={beneficiary.id}
              title={beneficiary.name}
              subtitle={beneficiary.institution || beneficiary.nik || 'Penerima manfaat aktif'}
              badge={beneficiary.status}
              badges={beneficiary.nik ? [beneficiary.nik] : []}
              details={[
                `Dicatat ${formatDate(beneficiary.created_at)}`,
                beneficiary.notes || 'Tanpa catatan',
              ]}
              actions={[
                {
                  id: 'edit',
                  label: 'Edit',
                  onClick: () => openEditModal(beneficiary),
                },
                {
                  id: 'delete',
                  label: 'Hapus',
                  destructive: true,
                  onClick: () => {
                    void handleDeleteBeneficiary(beneficiary)
                  },
                },
              ]}
            />
          ))}
        </AppCardStrong>
      ) : (
        <AppEmptyState
          description="Tambahkan data pertama untuk memulai."
          icon={<Users className="h-10 w-10" />}
          title="Belum ada data penerima manfaat"
        />
      )}

      {isModalOpen ? (
        <AppSheet
          footer={
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <AppButton onClick={handleCloseModal} type="button" variant="secondary">
                Batal
              </AppButton>
              <AppButton
                disabled={isSubmitting}
                form={formId}
                type="submit"
              >
                Simpan Data
              </AppButton>
            </div>
          }
          open={isModalOpen}
          onClose={handleCloseModal}
          title={editingId ? 'Edit Data' : 'Tambah Data Baru'}
          description="Masukkan biodata dasar penerima manfaat agar data lebih rapi."
        >
          <form id={formId} className="space-y-5" onSubmit={handleSubmit}>
            {renderSheetFeedback(
              editingId ? 'Perbarui data penerima manfaat di bawah.' : 'Isi data penerima manfaat di bawah.'
            )}

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Nama
              </span>
              <AppInput
                name="name"
                onChange={handleChange}
                placeholder="Contoh: Siti Aminah"
                required
                type="text"
                value={formData.name}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  NIK
                </span>
                <AppInput
                  name="nik"
                  onChange={handleChange}
                  placeholder="Nomor KTP"
                  type="text"
                  value={formData.nik}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Instansi
                </span>
                <AppInput
                  name="institution"
                  onChange={handleChange}
                  placeholder="Contoh: Yayasan Mandiri"
                  type="text"
                  value={formData.institution}
                />
              </label>
            </div>

            <AppWrapToggleGroup
              buttonSize="sm"
              description="Status penerima manfaat memakai opsi statis."
              label="Status"
              onChange={(nextValue) =>
                handleChange({
                  target: {
                    name: 'status',
                    value: nextValue,
                  },
                })
              }
              options={beneficiaryStatusOptions}
              value={formData.status}
            />

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Catatan
              </span>
              <AppTextarea
                name="notes"
                onChange={handleChange}
                placeholder="Opsional"
                value={formData.notes}
              />
            </label>
          </form>
        </AppSheet>
      ) : null}
    </PageSection>
  )
}

export default BeneficiaryList
