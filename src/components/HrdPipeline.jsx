import { useEffect, useMemo, useState } from 'react'
import { EyeOff, Loader2, Plus, RefreshCcw, Trash2, Users } from 'lucide-react'
import {
  AppButton,
  AppCardDashed,
  AppEmptyState,
  AppSheet,
  AppWrapToggleGroup,
  PageSection,
} from './ui/AppPrimitives'
import useMutationToast from '../hooks/useMutationToast'
import { formatAppDateLabel } from '../lib/date-time'
import useHrStore, { applicantStatusOptions } from '../store/useHrStore'

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function formatDate(value) {
  return formatAppDateLabel(value)
}

function getStatusColor(status) {
  if (status === 'interview_hr') {
    return 'border-sky-200 bg-sky-50 text-sky-700'
  }

  if (status === 'offering') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  if (status === 'diterima') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (status === 'ditolak') {
    return 'border-rose-200 bg-rose-50 text-rose-700'
  }

  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function createInitialFormData() {
  return {
    name: '',
    position: '',
    status_aplikasi: 'screening',
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

function HrdPipeline() {
  const [formData, setFormData] = useState(createInitialFormData)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const formId = 'hrd-applicant-form'
  const applicants = useHrStore((state) => state.applicants)
  const isLoading = useHrStore((state) => state.isLoading)
  const isSubmitting = useHrStore((state) => state.isSubmitting)
  const error = useHrStore((state) => state.error)
  const clearError = useHrStore((state) => state.clearError)
  const fetchApplicants = useHrStore((state) => state.fetchApplicants)
  const addApplicant = useHrStore((state) => state.addApplicant)
  const updateApplicant = useHrStore((state) => state.updateApplicant)
  const deleteApplicant = useHrStore((state) => state.deleteApplicant)
  const { begin, fail, succeed } = useMutationToast()

  useEffect(() => {
    fetchApplicants({ force: true }).catch((fetchError) => {
      console.error('Gagal memuat pelamar:', fetchError)
    })
  }, [fetchApplicants])

  const resetModalState = () => {
    setFormData(createInitialFormData())
    clearError()
  }

  const openCreateModal = () => {
    resetModalState()
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    resetModalState()
    setIsModalOpen(false)
  }

  const groupedApplicants = useMemo(
    () =>
      applicantStatusOptions.map((statusOption) => ({
        ...statusOption,
        applicants: applicants.filter(
          (applicant) => applicant.status_aplikasi === statusOption.value
        ),
      })),
    [applicants]
  )
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

    const formElement = event.currentTarget
    const submittedFormData = new FormData(formElement)
    const name = normalizeText(submittedFormData.get('name'))
    const position = normalizeText(submittedFormData.get('position'))
    const status_aplikasi = normalizeText(
      submittedFormData.get('status_aplikasi'),
      'screening'
    )
    const notes = normalizeText(submittedFormData.get('notes'), '')
    const cvFile = submittedFormData.get('cvFile')
    const ktpFile = submittedFormData.get('ktpFile')

    const documents = [
      cvFile instanceof File && cvFile.size > 0
        ? { file: cvFile, documentType: 'cv' }
        : null,
      ktpFile instanceof File && ktpFile.size > 0
        ? { file: ktpFile, documentType: 'ktp' }
        : null,
    ].filter(Boolean)

    if (!name) {
      fail({
        title: 'Form pelamar belum lengkap',
        message: 'Nama pelamar wajib diisi.',
      })
      return
    }

    if (!position) {
      fail({
        title: 'Form pelamar belum lengkap',
        message: 'Posisi pelamar wajib diisi.',
      })
      return
    }

    try {
      begin({
        title: 'Menyimpan pelamar',
        message: 'Mohon tunggu sampai data pelamar dan dokumen selesai diproses.',
      })

      await addApplicant({
        name,
        position,
        status_aplikasi,
        notes,
        documents,
      })

      await fetchApplicants({ force: true })

      handleCloseModal()
      succeed({
        title: 'Pelamar tersimpan',
        message: 'Data pelamar berhasil disimpan.',
      })
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : 'Gagal menyimpan pelamar.'

      fail({
        title: 'Pelamar gagal disimpan',
        message,
      })
      clearError()
    }
  }

  const handleDeleteApplicant = async (applicant) => {
    if (!applicant?.id || isSubmitting) {
      return
    }

    begin({
      title: 'Menghapus pelamar',
      message: 'Mohon tunggu sampai pelamar hilang dari daftar.',
    })

    try {
      await deleteApplicant(applicant.id)
      await fetchApplicants({ force: true })
      succeed({
        title: 'Pelamar dihapus',
        message: 'Data pelamar berhasil dihapus.',
      })
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Gagal menghapus pelamar.'

      fail({
        title: 'Pelamar gagal dihapus',
        message,
      })
      clearError()
      console.error('Gagal menghapus pelamar:', deleteError)
    }
  }

  return (
    <PageSection
      eyebrow="HRD & Rekrutmen"
      title="Pipeline pelamar berbasis status"
      description="Lihat pergerakan pelamar dari screening sampai diterima atau ditolak, lalu kelola dokumen CV dan KTP langsung dari form ini."
      action={
        <div className="flex flex-wrap justify-end gap-3">
          <AppButton
            disabled={isLoading}
            onClick={() => {
              void fetchApplicants({ force: true }).catch((fetchError) => {
                console.error('Gagal memuat ulang pelamar:', fetchError)
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
            Tambah Pelamar
          </AppButton>
        </div>
      }
    >

      {error ? (
        <AppErrorState
          description={error}
          title="Pelamar gagal dimuat"
        />
      ) : null}

      {isLoading && applicants.length === 0 ? (
        <AppEmptyState
          description="Menarik data terbaru dari server."
          icon={<Loader2 className="h-10 w-10 animate-spin" />}
          title="Memuat data pelamar"
        />
      ) : applicants.length > 0 ? (
      <div className="grid gap-4 xl:grid-cols-5">
          {groupedApplicants.map((group) => (
            <div
              key={group.value}
              className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--app-text-color)]">
                    {group.label}
                  </p>
                  <p className="text-xs text-[var(--app-hint-color)]">
                    {group.applicants.length} pelamar
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusColor(
                    group.value
                  )}`}
                >
                  {group.value}
                </span>
              </div>

              <div className="space-y-3">
                {group.applicants.length > 0 ? (
                  group.applicants.map((applicant) => (
                    <article
                      key={applicant.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-sky-600" />
                            <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                              {applicant.name}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-[var(--app-hint-color)]">
                            {applicant.position}
                          </p>
                        </div>

                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isSubmitting}
                          onClick={() => {
                            void handleDeleteApplicant(applicant)
                          }}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                        <span
                          className={`rounded-full border px-2.5 py-1 ${getStatusColor(
                            applicant.status_aplikasi
                          )}`}
                        >
                          {applicant.status_aplikasi}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                          {applicant.documentCount} dokumen
                        </span>
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-600">
                          {formatDate(applicant.created_at)}
                        </span>
                      </div>

                      <AppWrapToggleGroup
                        buttonSize="sm"
                        className="mt-3"
                        description="Status pelamar memakai opsi statis agar lebih cepat diubah."
                        label="Update Status"
                        disabled={isSubmitting}
                        onChange={(nextValue) => {
                          void updateApplicant(applicant.id, {
                            status_aplikasi: nextValue,
                          }).catch((updateError) => {
                            console.error(
                              'Gagal memperbarui status pelamar:',
                              updateError
                            )
                          })
                        }}
                        options={applicantStatusOptions}
                        value={applicant.status_aplikasi}
                      />

                      {applicant.documents.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {applicant.documents.map((document) => (
                            <div
                              key={document.id}
                              className="rounded-xl border border-white/70 bg-white px-3 py-2 text-xs text-slate-600"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold uppercase tracking-[0.16em] text-slate-500">
                                  {document.document_type}
                                </span>
                                <a
                                  className="text-sky-600 transition hover:text-sky-700"
                                  href={document.file_assets?.public_url}
                                  rel="noreferrer"
                                  target="_blank"
                                >
                                  Lihat File
                                </a>
                              </div>
                              <p className="mt-1 truncate text-slate-500">
                                {document.file_assets?.file_name ?? 'File'}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                          <EyeOff className="h-3.5 w-3.5" />
                          Belum ada dokumen
                        </div>
                      )}
                    </article>
                  ))
                ) : (
                  <AppEmptyState
                    className="px-2 py-0"
                    icon={<EyeOff className="h-8 w-8" />}
                    title="Belum ada pelamar pada status ini"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AppEmptyState
          description="Tambahkan pelamar pertama untuk memulai pipeline."
          icon={<Users className="h-10 w-10" />}
          title="Belum ada data pelamar"
        />
      )}

      {isModalOpen ? (
        <AppSheet
          description="Isi data utama pelamar dan unggah dokumen dasar dari satu form yang sama."
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
                Simpan Pelamar
              </AppButton>
            </div>
          }
          open={isModalOpen}
          onClose={handleCloseModal}
          title="Tambah Pelamar Baru"
        >
          <form
            id={formId}
            className="space-y-5"
            encType="multipart/form-data"
            onSubmit={handleSubmit}
          >
              {renderSheetFeedback('Isi data pelamar di bawah.')}

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Nama
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name="name"
                  onChange={handleChange}
                  placeholder="Contoh: Andi Pratama"
                  required
                  type="text"
                  value={formData.name}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">
                  Posisi
                </span>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  name="position"
                  onChange={handleChange}
                  placeholder="Contoh: Staff Administrasi"
                  required
                  type="text"
                  value={formData.position}
                />
              </label>

              <AppWrapToggleGroup
                buttonSize="sm"
                description="Status pelamar memakai opsi statis."
                label="Status"
                onChange={(nextValue) =>
                  handleChange({
                    target: {
                      name: 'status_aplikasi',
                      value: nextValue,
                    },
                  })
                }
                options={applicantStatusOptions}
                value={formData.status_aplikasi}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--app-text-color)]">
                    Upload CV
                  </span>
                  <input
                    className="w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-[var(--app-text-color)] outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    accept=".pdf,.doc,.docx,image/*"
                    name="cvFile"
                    type="file"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-[var(--app-text-color)]">
                    Upload KTP
                  </span>
                  <input
                    className="w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-[var(--app-text-color)] outline-none transition file:mr-4 file:rounded-full file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    accept=".pdf,.jpg,.jpeg,.png,image/*"
                    name="ktpFile"
                    type="file"
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
                    className="h-12 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-[var(--app-text-color)] outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    name="notes"
                    onChange={handleChange}
                    placeholder="Opsional, misal: referensi internal."
                    value={formData.notes}
                  />
                </div>
              </details>
          </form>
        </AppSheet>
      ) : null}
    </PageSection>
  )
}

export default HrdPipeline
