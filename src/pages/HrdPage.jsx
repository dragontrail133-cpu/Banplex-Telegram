import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Briefcase,
  FileDown,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Upload,
  Users,
} from 'lucide-react'
import FormLayout from '../components/layouts/FormLayout'
import HrCsvImportSheet from '../components/HrCsvImportSheet'
import ProtectedRoute from '../components/ProtectedRoute'
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCardDashed,
  AppCardStrong,
  AppEmptyState,
  AppErrorState,
  AppInput,
  AppListCard,
  AppListRow,
  AppSelect,
  AppSheet,
  AppTextarea,
  AppViewportSafeArea,
  FormSection,
  PageHeader,
  PageShell,
  PageSection,
} from '../components/ui/AppPrimitives'
import MasterPickerField from '../components/ui/MasterPickerField'
import { downloadHrCsvTemplate, importApplicantCsvRows } from '../lib/hr-csv'
import { sendBusinessReportPdfToTelegramDm } from '../lib/report-delivery-api'
import useMutationToast from '../hooks/useMutationToast'
import { formatAppDateLabel } from '../lib/date-time'
import useHrStore, { applicantStatusOptions } from '../store/useHrStore'

const initialVisibleCount = 25
const visibleCountStep = 25
const formId = 'hrd-applicant-routed-form'

const statusFilterOptions = [
  { value: 'all', label: 'Semua' },
  ...applicantStatusOptions,
]

const genderOptions = [
  { value: '', label: 'Pilih jenis kelamin' },
  { value: 'Laki-laki', label: 'Laki-laki' },
  { value: 'Perempuan', label: 'Perempuan' },
]

function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function getStatusLabel(status) {
  return applicantStatusOptions.find((option) => option.value === status)?.label ?? 'Screening'
}

function getStatusTone(status) {
  if (status === 'diterima') {
    return 'success'
  }

  if (status === 'ditolak') {
    return 'danger'
  }

  if (status === 'offering') {
    return 'warning'
  }

  if (status === 'interview_hr') {
    return 'info'
  }

  return 'neutral'
}

function createFormData(applicant = null) {
  return {
    name: normalizeText(applicant?.name),
    position: normalizeText(applicant?.position),
    status_aplikasi: normalizeText(applicant?.status_aplikasi, 'screening'),
    email: normalizeText(applicant?.email),
    no_telepon: normalizeText(applicant?.no_telepon),
    nik: normalizeText(applicant?.nik),
    jenis_kelamin: normalizeText(applicant?.jenis_kelamin),
    tanggal_lahir: normalizeText(applicant?.tanggal_lahir),
    tempat_lahir: normalizeText(applicant?.tempat_lahir),
    pendidikan_terakhir: normalizeText(applicant?.pendidikan_terakhir),
    nama_institusi_pendidikan: normalizeText(applicant?.nama_institusi_pendidikan),
    jurusan: normalizeText(applicant?.jurusan),
    sumber_lowongan: normalizeText(applicant?.sumber_lowongan),
    pengalaman_kerja: normalizeText(applicant?.pengalaman_kerja),
    skills: normalizeText(applicant?.skills),
    alamat_lengkap: normalizeText(applicant?.alamat_lengkap),
    alamat_domisili: normalizeText(applicant?.alamat_domisili),
    notes: normalizeText(applicant?.notes),
  }
}

function matchesSearch(applicant, searchTerm) {
  const normalizedSearch = searchTerm.trim().toLowerCase()

  if (!normalizedSearch) {
    return true
  }

  return [
    applicant.name,
    applicant.position,
    applicant.email,
    applicant.no_telepon,
    applicant.nik,
    applicant.sumber_lowongan,
    applicant.notes,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedSearch))
}

function buildApplicantStatusReportData(applicants = [], statusLabel = '') {
  const generatedAt = new Date().toISOString()
  const sortedApplicants = [...applicants]
    .sort((left, right) => {
      const leftTime = new Date(String(left?.created_at ?? '')).getTime()
      const rightTime = new Date(String(right?.created_at ?? '')).getTime()

      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
    })

  const rows = sortedApplicants
    .map((applicant) => ({
      id: applicant.id,
      name: normalizeText(applicant.name, '-'),
      position: normalizeText(applicant.position, '-'),
      nik: normalizeText(applicant.nik, '-'),
      email: normalizeText(applicant.email, '-'),
      no_telepon: normalizeText(applicant.no_telepon, '-'),
      documentCount: Number(applicant.documentCount) || 0,
    }))

  return {
    reportKind: 'applicant_statement',
    title: 'LAPORAN PELAMAR PER STATUS',
    groupLabel: 'Status',
    groupValue: normalizeText(statusLabel, '-'),
    period: {
      dateFrom: generatedAt,
      dateTo: generatedAt,
    },
    generatedAt,
    summary: {
      total_applicants: sortedApplicants.length,
      with_email_applicants: sortedApplicants.filter((applicant) =>
        normalizeText(applicant.email, '').length > 0
      ).length,
      with_phone_applicants: sortedApplicants.filter((applicant) =>
        normalizeText(applicant.no_telepon, '').length > 0
      ).length,
      with_documents_applicants: sortedApplicants.filter((applicant) => Number(applicant.documentCount) > 0).length,
    },
    rows,
  }
}

function PageViewportShell({ children }) {
  return (
    <AppViewportSafeArea as="main" className="min-h-screen sm:mx-auto sm:max-w-md">
      {children}
    </AppViewportSafeArea>
  )
}

const summaryMetricToneClassNameMap = {
  neutral: 'app-tone-neutral',
  info: 'app-tone-info',
  success: 'app-tone-success',
  warning: 'app-tone-warning',
}

function SummaryMetricCard({ label, value, tone = 'neutral' }) {
  return (
    <AppCard
      className={`${summaryMetricToneClassNameMap[tone] ?? summaryMetricToneClassNameMap.neutral} flex min-h-[104px] flex-col justify-between px-4 py-4`}
      padded={false}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="text-[1.8rem] font-semibold leading-none tracking-[-0.05em] sm:text-[2rem]">
        {value}
      </p>
    </AppCard>
  )
}

function HrdDetailSheet({ applicant, onClose, onDelete, onEdit }) {
  return (
    <AppSheet
      contentClassName="px-4 py-3"
      onClose={onClose}
      open={Boolean(applicant)}
      title={normalizeText(applicant?.name, 'Detail Pelamar')}
    >
      {applicant ? (
        <div className="space-y-3">
          <AppCardDashed className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                  {applicant.position || 'Posisi belum diisi'}
                </p>
                <p className="mt-1 text-xs text-[var(--app-hint-color)]">
                  Dicatat {formatAppDateLabel(applicant.created_at)}
                </p>
              </div>
              <AppBadge tone={getStatusTone(applicant.status_aplikasi)}>
                {getStatusLabel(applicant.status_aplikasi)}
              </AppBadge>
            </div>
          </AppCardDashed>

          <AppListCard className="space-y-0 overflow-hidden p-2">
            <AppListRow title="Email" trailing={<span className="text-sm">{applicant.email || '-'}</span>} />
            <AppListRow title="Telepon" trailing={<span className="text-sm">{applicant.no_telepon || '-'}</span>} />
            <AppListRow title="NIK" trailing={<span className="text-sm">{applicant.nik || '-'}</span>} />
            <AppListRow title="Sumber" trailing={<span className="text-sm">{applicant.sumber_lowongan || '-'}</span>} />
          </AppListCard>

          <AppCardDashed className="space-y-2">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">Dokumen</p>
            {applicant.documents?.length > 0 ? (
              <div className="space-y-2">
                {applicant.documents.map((document) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-3 py-2"
                    key={document.id}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-hint-color)]">
                        {document.document_type}
                      </p>
                      <p className="truncate text-sm text-[var(--app-text-color)]">
                        {document.file_assets?.file_name ?? 'File'}
                      </p>
                    </div>
                    {document.file_assets?.public_url ? (
                      <a
                        className="text-xs font-semibold text-[var(--app-accent-color)]"
                        href={document.file_assets.public_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Lihat
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--app-hint-color)]">Belum ada dokumen.</p>
            )}
          </AppCardDashed>

          <div className="grid grid-cols-2 gap-2">
            <AppButton onClick={onEdit} size="sm" variant="secondary">
              Edit
            </AppButton>
            <AppButton onClick={onDelete} size="sm" variant="danger">
              Hapus
            </AppButton>
          </div>
        </div>
      ) : null}
    </AppSheet>
  )
}

function HrdListPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount)
  const [selectedApplicantId, setSelectedApplicantId] = useState(null)
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false)
  const [isPdfDelivering, setIsPdfDelivering] = useState(false)
  const applicants = useHrStore((state) => state.applicants)
  const isLoading = useHrStore((state) => state.isLoading)
  const isSubmitting = useHrStore((state) => state.isSubmitting)
  const error = useHrStore((state) => state.error)
  const clearError = useHrStore((state) => state.clearError)
  const fetchApplicants = useHrStore((state) => state.fetchApplicants)
  const addApplicant = useHrStore((state) => state.addApplicant)
  const deleteApplicant = useHrStore((state) => state.deleteApplicant)
  const { begin, fail, succeed } = useMutationToast()

  useEffect(() => {
    fetchApplicants({ force: true }).catch((fetchError) => {
      console.error('Gagal memuat pelamar:', fetchError)
    })
  }, [fetchApplicants])

  const filteredApplicants = useMemo(() => {
    return applicants.filter((applicant) => {
      if (statusFilter !== 'all' && applicant.status_aplikasi !== statusFilter) {
        return false
      }

      return matchesSearch(applicant, searchTerm)
    })
  }, [applicants, searchTerm, statusFilter])

  const selectedApplicant = useMemo(
    () => applicants.find((applicant) => applicant.id === selectedApplicantId) ?? null,
    [applicants, selectedApplicantId]
  )

  const selectedStatusLabel = useMemo(
    () =>
      statusFilter === 'all'
        ? null
        : statusFilterOptions.find((option) => option.value === statusFilter)?.label ?? null,
    [statusFilter]
  )

  const selectedStatusApplicants = useMemo(() => {
    if (!selectedStatusLabel) {
      return []
    }

    return applicants
      .filter((applicant) => normalizeText(applicant.status_aplikasi) === statusFilter)
      .sort((left, right) => {
        const leftTime = new Date(String(left?.created_at ?? '')).getTime()
        const rightTime = new Date(String(right?.created_at ?? '')).getTime()

        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime)
      })
  }, [applicants, selectedStatusLabel, statusFilter])

  const statusCounts = useMemo(() => {
    return applicantStatusOptions.reduce((accumulator, option) => {
      accumulator[option.value] = applicants.filter(
        (applicant) => applicant.status_aplikasi === option.value
      ).length
      return accumulator
    }, {})
  }, [applicants])

  const visibleApplicants = filteredApplicants.slice(0, visibleCount)

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value)
    setVisibleCount(initialVisibleCount)
  }

  const handleStatusFilterChange = (nextStatusFilter) => {
    setStatusFilter(nextStatusFilter)
    setVisibleCount(initialVisibleCount)
  }

  const handleDownloadCsvTemplate = () => {
    downloadHrCsvTemplate('applicant')
  }

  const handleCsvImportCommit = async (preview) => {
    begin({
      title: 'Mengimpor pelamar',
      message: 'Mohon tunggu sampai data selesai diproses.',
    })

    try {
      const result = await importApplicantCsvRows({
        existingApplicants: applicants,
        previewRows: preview.rows,
        saveApplicant: async (applicantData) => {
          try {
            return await addApplicant(applicantData)
          } catch (saveError) {
            clearError()
            throw saveError
          }
        },
      })

      const messageParts = [
        `${result.summary.saved} tersimpan`,
        `${result.summary.skipped} skip`,
        `${result.summary.error} error`,
      ]

      if (result.summary.saved > 0 || result.summary.error === 0) {
        succeed({
          title: 'Impor pelamar selesai',
          message: messageParts.join(' | '),
        })
      } else {
        fail({
          title: 'Impor pelamar gagal',
          message: messageParts.join(' | '),
        })
      }

      return result
    } catch (importError) {
      fail({
        title: 'Impor pelamar gagal',
        message: importError instanceof Error ? importError.message : 'Gagal mengimpor pelamar.',
      })
      clearError()
      throw importError
    }
  }

  const handleSendStatusReport = async () => {
    if (isPdfDelivering || isLoading || isSubmitting) {
      return
    }

    if (!selectedStatusLabel) {
      fail({
        title: 'Pilih status dulu',
        message: 'Gunakan filter Status Aplikasi untuk memilih satu status sebelum mengirim PDF.',
      })
      return
    }

    begin({
      title: 'Mengirim laporan pelamar',
      message: 'Mohon tunggu sampai PDF terkirim ke DM Telegram.',
    })

    setIsPdfDelivering(true)

    try {
      const result = await sendBusinessReportPdfToTelegramDm({
        reportData: buildApplicantStatusReportData(selectedStatusApplicants, selectedStatusLabel),
      })

      succeed({
        title: result?.pdfError ? 'Laporan terkirim sebagian' : 'Laporan terkirim',
        message: result?.pdfError
          ? 'PDF gagal dikirim, tetapi pesan Telegram berhasil diterima.'
          : `PDF pelamar untuk status ${selectedStatusLabel} berhasil dikirim ke DM Telegram.`,
      })
    } catch (sendError) {
      fail({
        title: 'Laporan pelamar gagal dikirim',
        message: sendError instanceof Error ? sendError.message : 'Gagal mengirim laporan pelamar.',
      })
    } finally {
      setIsPdfDelivering(false)
    }
  }

  const handleDelete = async (applicant) => {
    if (!applicant?.id || isSubmitting) {
      return
    }

    if (!window.confirm(`Hapus pelamar ${applicant.name}?`)) {
      return
    }

    begin({ title: 'Menghapus pelamar', message: 'Mohon tunggu sampai data selesai diproses.' })

    try {
      await deleteApplicant(applicant.id)
      setSelectedApplicantId(null)
      succeed({ title: 'Pelamar dihapus', message: 'Data pelamar berhasil dihapus.' })
    } catch (deleteError) {
      fail({
        title: 'Pelamar gagal dihapus',
        message: deleteError instanceof Error ? deleteError.message : 'Gagal menghapus pelamar.',
      })
      clearError()
    }
  }

  return (
    <PageViewportShell>
      <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
        <PageShell>
          <PageHeader
            action={
              <AppButton
                leadingIcon={<Plus className="h-4 w-4" />}
                onClick={() => navigate('/more/hrd/new')}
                size="sm"
              >
                Tambah
              </AppButton>
            }
            backAction={() => navigate('/more')}
            compact
            eyebrow="More"
            title="HRD & Rekrutmen"
          />

          <div className="grid grid-cols-2 gap-2">
            <SummaryMetricCard label="Total" tone="neutral" value={String(applicants.length)} />
            <SummaryMetricCard
              label="Diproses"
              tone="info"
              value={String(statusCounts.screening + statusCounts.interview_hr + statusCounts.offering)}
            />
            <SummaryMetricCard label="Diterima" tone="success" value={String(statusCounts.diterima)} />
            <SummaryMetricCard
              label="Dokumen"
              tone="warning"
              value={String(applicants.reduce((total, applicant) => total + applicant.documentCount, 0))}
            />
          </div>

          <AppCardStrong className="space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Cari pelamar</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-hint-color)]" />
                <AppInput
                  className="pl-11"
                  onChange={handleSearchChange}
                  placeholder="Nama, posisi, NIK"
                  value={searchTerm}
                />
              </div>
            </label>

            <MasterPickerField
              compact
              label="Status Aplikasi"
              onChange={handleStatusFilterChange}
              options={statusFilterOptions}
              placeholder="Semua"
              searchable={false}
              title="Status Aplikasi"
              value={statusFilter}
            />

            <AppButton
              fullWidth
              leadingIcon={<Send className={`h-4 w-4 ${isPdfDelivering ? 'animate-pulse' : ''}`} />}
              onClick={() => void handleSendStatusReport()}
              type="button"
              variant="primary"
              disabled={isPdfDelivering || isLoading || isSubmitting || !selectedStatusLabel}
            >
              {isPdfDelivering ? 'Mengirim' : 'Kirim'}
            </AppButton>

            <div className="grid grid-cols-2 gap-2">
              <AppButton
                fullWidth
                leadingIcon={<FileDown className="h-4 w-4" />}
                onClick={handleDownloadCsvTemplate}
                type="button"
                variant="secondary"
              >
                Template CSV
              </AppButton>
              <AppButton
                fullWidth
                leadingIcon={<Upload className="h-4 w-4" />}
                onClick={() => setIsCsvImportOpen(true)}
                type="button"
                variant="secondary"
              >
                Impor CSV
              </AppButton>
            </div>
          </AppCardStrong>

        {error ? (
          <AppErrorState
            action={
              <AppButton onClick={() => void fetchApplicants({ force: true })} size="sm" variant="secondary">
                Coba lagi
              </AppButton>
            }
            description={error}
            title="Pelamar gagal dimuat"
          />
        ) : null}

        {isLoading && applicants.length === 0 ? (
          <AppEmptyState
            icon={<Loader2 className="h-10 w-10 animate-spin" />}
            title="Memuat pelamar"
          />
        ) : null}

        <PageSection
          action={
            <AppButton
              disabled={isLoading}
              leadingIcon={<RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={() => void fetchApplicants({ force: true })}
              size="sm"
              variant="secondary"
            >
              Refresh
            </AppButton>
          }
          eyebrow={`${filteredApplicants.length} hasil`}
          title="Daftar Pelamar"
        >
          {visibleApplicants.length > 0 ? (
            <div className="space-y-2">
              {visibleApplicants.map((applicant) => (
                <AppCardStrong
                  aria-label={`Buka detail pelamar ${normalizeText(applicant.name, 'pelamar')}`}
                  as="button"
                  className="w-full space-y-3 text-left"
                  key={applicant.id}
                  onClick={() => setSelectedApplicantId(applicant.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 text-[var(--app-accent-color)]" />
                        <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                          {applicant.name}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--app-hint-color)]">
                        {applicant.position || 'Posisi belum diisi'}
                      </p>
                    </div>
                    <AppBadge tone={getStatusTone(applicant.status_aplikasi)}>
                      {getStatusLabel(applicant.status_aplikasi)}
                    </AppBadge>
                  </div>
                </AppCardStrong>
              ))}
            </div>
          ) : !isLoading ? (
            <AppEmptyState
              icon={<Briefcase className="h-10 w-10" />}
              title={applicants.length > 0 ? 'Tidak ada pelamar yang cocok' : 'Belum ada pelamar'}
            />
          ) : null}

          {filteredApplicants.length > visibleApplicants.length ? (
            <AppButton
              className="mt-3"
              fullWidth
              onClick={() => setVisibleCount((current) => current + visibleCountStep)}
              type="button"
              variant="secondary"
            >
              Muat lagi
            </AppButton>
          ) : null}
        </PageSection>

        <HrdDetailSheet
          applicant={selectedApplicant}
          onClose={() => setSelectedApplicantId(null)}
          onDelete={() => void handleDelete(selectedApplicant)}
          onEdit={() => {
            if (selectedApplicant?.id) {
              navigate(`/more/hrd/${selectedApplicant.id}/edit`)
            }
          }}
        />
        <HrCsvImportSheet
          kind="applicant"
          open={isCsvImportOpen}
          onCommit={handleCsvImportCommit}
          onClose={() => setIsCsvImportOpen(false)}
        />
        </PageShell>
      </ProtectedRoute>
    </PageViewportShell>
  )
}

function HrdFormPage() {
  const navigate = useNavigate()
  const { applicantId } = useParams()
  const isEditMode = Boolean(applicantId)
  const applicants = useHrStore((state) => state.applicants)
  const isLoading = useHrStore((state) => state.isLoading)
  const isSubmitting = useHrStore((state) => state.isSubmitting)
  const fetchApplicants = useHrStore((state) => state.fetchApplicants)
  const addApplicant = useHrStore((state) => state.addApplicant)
  const updateApplicant = useHrStore((state) => state.updateApplicant)
  const addApplicantDocument = useHrStore((state) => state.addApplicantDocument)
  const clearError = useHrStore((state) => state.clearError)
  const { begin, fail, succeed } = useMutationToast()
  const selectedApplicant = useMemo(
    () => applicants.find((applicant) => applicant.id === applicantId) ?? null,
    [applicantId, applicants]
  )
  const [formData, setFormData] = useState(() => createFormData())

  useEffect(() => {
    if (isEditMode && applicants.length === 0) {
      fetchApplicants({ force: true }).catch((fetchError) => {
        console.error('Gagal memuat pelamar:', fetchError)
      })
    }
  }, [applicants.length, fetchApplicants, isEditMode])

  useEffect(() => {
    if (selectedApplicant) {
      setFormData(createFormData(selectedApplicant))
    }
  }, [selectedApplicant])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
    clearError()
  }

  const handleBack = () => {
    navigate('/more/hrd')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const submittedFormData = new FormData(event.currentTarget)
    const documents = [
      submittedFormData.get('cvFile') instanceof File && submittedFormData.get('cvFile').size > 0
        ? { file: submittedFormData.get('cvFile'), documentType: 'cv' }
        : null,
      submittedFormData.get('ktpFile') instanceof File && submittedFormData.get('ktpFile').size > 0
        ? { file: submittedFormData.get('ktpFile'), documentType: 'ktp' }
        : null,
    ].filter(Boolean)

    const payload = {
      ...formData,
      documents,
    }

    if (!normalizeText(payload.name)) {
      fail({ title: 'Form belum lengkap', message: 'Nama pelamar wajib diisi.' })
      return
    }

    if (!normalizeText(payload.position)) {
      fail({ title: 'Form belum lengkap', message: 'Posisi pelamar wajib diisi.' })
      return
    }

    begin({ title: isEditMode ? 'Menyimpan perubahan' : 'Menyimpan pelamar', message: 'Mohon tunggu sampai data selesai diproses.' })

    try {
      if (isEditMode) {
        if (!selectedApplicant?.id) {
          throw new Error('Data pelamar tidak ditemukan.')
        }

        await updateApplicant(selectedApplicant.id, payload)

        for (const documentInput of documents) {
          await addApplicantDocument(selectedApplicant.id, documentInput)
        }
      } else {
        await addApplicant(payload)
      }

      await fetchApplicants({ force: true })
      succeed({ title: isEditMode ? 'Pelamar diperbarui' : 'Pelamar tersimpan', message: 'Data pelamar berhasil disimpan.' })
      navigate('/more/hrd')
    } catch (submitError) {
      fail({
        title: 'Pelamar gagal disimpan',
        message: submitError instanceof Error ? submitError.message : 'Gagal menyimpan pelamar.',
      })
      clearError()
    }
  }

  if (isEditMode && isLoading && !selectedApplicant) {
    return (
      <PageViewportShell>
        <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
          <PageShell>
            <AppEmptyState icon={<Loader2 className="h-10 w-10 animate-spin" />} title="Memuat pelamar" />
          </PageShell>
        </ProtectedRoute>
      </PageViewportShell>
    )
  }

  if (isEditMode && !isLoading && !selectedApplicant) {
    return (
      <PageViewportShell>
        <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
          <PageShell>
            <PageHeader backAction={handleBack} compact title="Pelamar tidak ditemukan" />
            <AppErrorState description="Data pelamar tidak tersedia atau sudah dihapus." />
          </PageShell>
        </ProtectedRoute>
      </PageViewportShell>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
      <FormLayout
        actionLabel={isEditMode ? 'Simpan perubahan' : 'Simpan pelamar'}
        description={null}
        eyebrow="HRD"
        formId={formId}
        isSubmitting={isSubmitting}
        onBack={handleBack}
        secondaryAction={
          <AppButton onClick={handleBack} type="button" variant="secondary">
            Batal
          </AppButton>
        }
        title={isEditMode ? 'Edit Pelamar' : 'Tambah Pelamar'}
      >
        <form className="space-y-4" encType="multipart/form-data" id={formId} onSubmit={handleSubmit}>
          <FormSection title="Data Utama">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Nama</span>
              <AppInput name="name" onChange={handleChange} required value={formData.name} />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Posisi</span>
              <AppInput name="position" onChange={handleChange} required value={formData.position} />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Status</span>
              <AppSelect name="status_aplikasi" onChange={handleChange} value={formData.status_aplikasi}>
                {applicantStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AppSelect>
            </label>
          </FormSection>

          <FormSection title="Kontak">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">Email</span>
                <AppInput name="email" onChange={handleChange} type="email" value={formData.email} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">Telepon</span>
                <AppInput name="no_telepon" onChange={handleChange} type="tel" value={formData.no_telepon} />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">NIK</span>
                <AppInput name="nik" onChange={handleChange} value={formData.nik} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">Jenis Kelamin</span>
                <AppSelect name="jenis_kelamin" onChange={handleChange} value={formData.jenis_kelamin}>
                  {genderOptions.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AppSelect>
              </label>
            </div>
          </FormSection>

          <FormSection title="Profil">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">Tempat Lahir</span>
                <AppInput name="tempat_lahir" onChange={handleChange} value={formData.tempat_lahir} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">Tanggal Lahir</span>
                <AppInput name="tanggal_lahir" onChange={handleChange} type="date" value={formData.tanggal_lahir} />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Sumber Lowongan</span>
              <AppInput name="sumber_lowongan" onChange={handleChange} value={formData.sumber_lowongan} />
            </label>
          </FormSection>

          <FormSection title="Pendidikan">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">Pendidikan Terakhir</span>
                <AppInput name="pendidikan_terakhir" onChange={handleChange} value={formData.pendidikan_terakhir} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">Jurusan</span>
                <AppInput name="jurusan" onChange={handleChange} value={formData.jurusan} />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Institusi Pendidikan</span>
              <AppInput name="nama_institusi_pendidikan" onChange={handleChange} value={formData.nama_institusi_pendidikan} />
            </label>
          </FormSection>

          <FormSection title="Tambahan">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Pengalaman</span>
              <AppTextarea className="h-24" name="pengalaman_kerja" onChange={handleChange} value={formData.pengalaman_kerja} />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Keahlian</span>
              <AppInput name="skills" onChange={handleChange} value={formData.skills} />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Alamat KTP</span>
              <AppTextarea className="h-24" name="alamat_lengkap" onChange={handleChange} value={formData.alamat_lengkap} />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Alamat Domisili</span>
              <AppTextarea className="h-24" name="alamat_domisili" onChange={handleChange} value={formData.alamat_domisili} />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Catatan</span>
              <AppTextarea className="h-24" name="notes" onChange={handleChange} value={formData.notes} />
            </label>
          </FormSection>

          <FormSection title="Dokumen">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">CV</span>
                <AppInput accept=".pdf,.doc,.docx,image/*" name="cvFile" type="file" />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">KTP</span>
                <AppInput accept=".pdf,.jpg,.jpeg,.png,image/*" name="ktpFile" type="file" />
              </label>
            </div>
          </FormSection>
        </form>
      </FormLayout>
    </ProtectedRoute>
  )
}

function HrdPage() {
  const location = useLocation()
  const isFormRoute = location.pathname.endsWith('/new') || location.pathname.endsWith('/edit')

  return isFormRoute ? <HrdFormPage /> : <HrdListPage />
}

export default HrdPage
