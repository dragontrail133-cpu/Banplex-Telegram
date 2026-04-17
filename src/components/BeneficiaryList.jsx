import { useEffect, useState } from 'react'
import { Plus, RefreshCcw } from 'lucide-react'
import ActionCard from './ui/ActionCard'
import { AppButton, AppInput, AppSelect, AppSheet, AppTextarea } from './ui/AppPrimitives'
import useHrStore, { beneficiaryStatusOptions } from '../store/useHrStore'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function formatDate(value) {
  const normalizedValue = String(value ?? '').trim()

  if (!normalizedValue) {
    return '-'
  }

  const parsedDate = new Date(`${normalizedValue}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) {
    return normalizedValue
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate)
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

function BeneficiaryList() {
  const [formData, setFormData] = useState(createInitialFormData)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [localError, setLocalError] = useState(null)
  const beneficiaries = useHrStore((state) => state.beneficiaries)
  const isLoading = useHrStore((state) => state.isLoading)
  const isSubmitting = useHrStore((state) => state.isSubmitting)
  const error = useHrStore((state) => state.error)
  const clearError = useHrStore((state) => state.clearError)
  const fetchBeneficiaries = useHrStore((state) => state.fetchBeneficiaries)
  const addBeneficiary = useHrStore((state) => state.addBeneficiary)
  const updateBeneficiary = useHrStore((state) => state.updateBeneficiary)
  const deleteBeneficiary = useHrStore((state) => state.deleteBeneficiary)

  useEffect(() => {
    fetchBeneficiaries({ force: true }).catch((fetchError) => {
      console.error('Gagal memuat penerima manfaat:', fetchError)
    })
  }, [fetchBeneficiaries])

  const resetModalState = () => {
    setFormData(createInitialFormData())
    setEditingId(null)
    setLocalError(null)
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
    setLocalError(null)
    setIsModalOpen(true)
  }

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormData((current) => ({
      ...current,
      [name]: value,
    }))

    if (localError) {
      setLocalError(null)
    }

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
      setLocalError('Nama penerima manfaat wajib diisi.')
      return
    }

    try {
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
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan data penerima manfaat.'

      setLocalError(message)
    }
  }

  return (
    <section className="space-y-6 rounded-[28px] border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--app-accent-color)]">
            Data Penerima Manfaat
          </p>
          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[var(--app-text-color)]">
            Daftar penerima manfaat
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-[var(--app-hint-color)]">
            Kelola data penerima manfaat secara sederhana dengan tabel, tambah,
            edit, dan hapus langsung dari modal ini.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-[var(--app-text-color)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onClick={() => {
              void fetchBeneficiaries({ force: true }).catch((fetchError) => {
                console.error('Gagal memuat ulang penerima manfaat:', fetchError)
              })
            }}
            type="button"
          >
            <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            className="inline-flex items-center justify-center gap-2 rounded-[20px] bg-gradient-to-r from-sky-600 via-cyan-500 to-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition active:scale-[0.99]"
            onClick={openCreateModal}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Tambah Data
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {error}
        </div>
      ) : null}

      {isLoading && beneficiaries.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white/80 px-4 py-5 text-sm text-[var(--app-hint-color)]">
          Memuat data penerima manfaat...
        </div>
      ) : beneficiaries.length > 0 ? (
        <div className="space-y-3">
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
                    void deleteBeneficiary(beneficiary.id).catch((deleteError) => {
                      console.error('Gagal menghapus penerima manfaat:', deleteError)
                    })
                  },
                },
              ]}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white/70 px-4 py-5 text-sm leading-6 text-[var(--app-hint-color)]">
          Belum ada data penerima manfaat. Tambahkan data pertama untuk memulai.
        </div>
      )}

      {isModalOpen ? (
        <AppSheet
          open={isModalOpen}
          onClose={handleCloseModal}
          title={editingId ? 'Edit Data' : 'Tambah Data Baru'}
          description="Masukkan biodata dasar penerima manfaat agar data lebih rapi."
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
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

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">
                Status
              </span>
              <AppSelect
                name="status"
                onChange={handleChange}
                value={formData.status}
              >
                {beneficiaryStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AppSelect>
            </label>

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

            {localError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                {localError}
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                {error}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <AppButton onClick={handleCloseModal} type="button" variant="secondary">
                Batal
              </AppButton>

              <AppButton disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Menyimpan...' : 'Simpan Data'}
              </AppButton>
            </div>
          </form>
        </AppSheet>
      ) : null}
    </section>
  )
}

export default BeneficiaryList
