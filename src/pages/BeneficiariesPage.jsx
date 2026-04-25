import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  HeartHandshake,
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
import { downloadHrCsvTemplate, importBeneficiaryCsvRows } from '../lib/hr-csv'
import { sendBusinessReportPdfToTelegramDm } from '../lib/report-delivery-api'
import useMutationToast from '../hooks/useMutationToast'
import { formatAppDateLabel } from '../lib/date-time'
import useHrStore, { beneficiaryStatusOptions } from '../store/useHrStore'

const initialVisibleCount = 40
const visibleCountStep = 40
const formId = 'beneficiary-routed-form'

const dataStatusOptions = [
  { value: 'Valid', label: 'Valid' },
  { value: 'Requires verification', label: 'Perlu Verifikasi' },
]

const dataStatusFilterOptions = [
  { value: 'all', label: 'Semua' },
  ...dataStatusOptions,
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

function getDataStatusLabel(value) {
  return dataStatusOptions.find((option) => option.value === value)?.label ?? normalizeText(value, 'Belum Dicek')
}

function getDataStatusTone(value) {
  if (value === 'Valid') {
    return 'success'
  }

  if (value === 'Requires verification') {
    return 'warning'
  }

  return 'neutral'
}

function getStatusLabel(status) {
  return beneficiaryStatusOptions.find((option) => option.value === status)?.label ?? 'Aktif'
}

function createFormData(beneficiary = null) {
  return {
    name: normalizeText(beneficiary?.name),
    nik: normalizeText(beneficiary?.nik),
    jenis_kelamin: normalizeText(beneficiary?.jenis_kelamin),
    jenjang: normalizeText(beneficiary?.jenjang),
    institution: normalizeText(beneficiary?.institution),
    npsn_nspp: normalizeText(beneficiary?.npsn_nspp),
    status: normalizeText(beneficiary?.status, 'active'),
    data_status: normalizeText(beneficiary?.data_status, 'Requires verification'),
    tempat_lahir: normalizeText(beneficiary?.tempat_lahir),
    tanggal_lahir: normalizeText(beneficiary?.tanggal_lahir),
    district: normalizeText(beneficiary?.district),
    sub_district: normalizeText(beneficiary?.sub_district),
    village: normalizeText(beneficiary?.village),
    hamlet: normalizeText(beneficiary?.hamlet),
    rt: normalizeText(beneficiary?.rt),
    rw: normalizeText(beneficiary?.rw),
    alamat_lengkap: normalizeText(beneficiary?.alamat_lengkap),
    notes: normalizeText(beneficiary?.notes),
  }
}

function matchesSearch(beneficiary, searchTerm) {
  const normalizedSearch = searchTerm.trim().toLowerCase()

  if (!normalizedSearch) {
    return true
  }

  return [
    beneficiary.name,
    beneficiary.nik,
    beneficiary.institution,
    beneficiary.jenjang,
    beneficiary.npsn_nspp,
    beneficiary.alamat_lengkap,
    beneficiary.notes,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedSearch))
}

function buildBeneficiaryInstitutionReportData(beneficiaries = [], institutionName = '') {
  const generatedAt = new Date().toISOString()
  const rows = [...beneficiaries]
    .sort((left, right) => normalizeText(left.name).localeCompare(normalizeText(right.name)))
    .map((beneficiary) => ({
      id: beneficiary.id,
      name: normalizeText(beneficiary.name, '-'),
      nik: normalizeText(beneficiary.nik, '-'),
      jenjang: normalizeText(beneficiary.jenjang, '-'),
      status: normalizeText(beneficiary.status, '-'),
      data_status: normalizeText(beneficiary.data_status, '-'),
    }))

  return {
    reportKind: 'beneficiary_statement',
    title: 'LAPORAN PENERIMA PER INSTANSI',
    groupLabel: 'Instansi',
    groupValue: normalizeText(institutionName, '-'),
    period: {
      dateFrom: generatedAt,
      dateTo: generatedAt,
    },
    generatedAt,
    summary: {
      total_beneficiaries: rows.length,
      valid_beneficiaries: rows.filter((row) => row.data_status === 'Valid').length,
      needs_review_beneficiaries: rows.filter((row) => row.data_status === 'Requires verification').length,
      unique_jenjang_count: new Set(rows.map((row) => normalizeText(row.jenjang)).filter(Boolean)).size,
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

function BeneficiaryDetailSheet({ beneficiary, onClose, onDelete, onEdit }) {
  return (
    <AppSheet
      contentClassName="px-4 py-3"
      onClose={onClose}
      open={Boolean(beneficiary)}
      title={normalizeText(beneficiary?.name, 'Detail Penerima')}
    >
      {beneficiary ? (
        <div className="space-y-3">
          <AppCardDashed className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                  {beneficiary.institution || 'Instansi belum diisi'}
                </p>
                <p className="mt-1 text-xs text-[var(--app-hint-color)]">
                  Dicatat {formatAppDateLabel(beneficiary.created_at)}
                </p>
              </div>
              <AppBadge tone={getDataStatusTone(beneficiary.data_status)}>
                {getDataStatusLabel(beneficiary.data_status)}
              </AppBadge>
            </div>
          </AppCardDashed>

          <AppListCard className="space-y-0 overflow-hidden p-2">
            <AppListRow title="NIK" trailing={<span className="text-sm">{beneficiary.nik || '-'}</span>} />
            <AppListRow title="Jenjang" trailing={<span className="text-sm">{beneficiary.jenjang || '-'}</span>} />
            <AppListRow title="NPSN/NSPP" trailing={<span className="text-sm">{beneficiary.npsn_nspp || '-'}</span>} />
            <AppListRow title="Status" trailing={<span className="text-sm">{getStatusLabel(beneficiary.status)}</span>} />
            <AppListRow title="Lahir" trailing={<span className="text-sm">{[beneficiary.tempat_lahir, formatAppDateLabel(beneficiary.tanggal_lahir)].filter(Boolean).join(', ')}</span>} />
          </AppListCard>

          <AppCardDashed className="space-y-2">
            <p className="text-sm font-semibold text-[var(--app-text-color)]">Alamat</p>
            <p className="text-sm leading-6 text-[var(--app-hint-color)]">
              {beneficiary.alamat_lengkap || '-'}
            </p>
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

function BeneficiariesListPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [dataStatusFilter, setDataStatusFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [institutionFilter, setInstitutionFilter] = useState('all')
  const [visibleCount, setVisibleCount] = useState(initialVisibleCount)
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState(null)
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false)
  const [isPdfDelivering, setIsPdfDelivering] = useState(false)
  const beneficiaries = useHrStore((state) => state.beneficiaries)
  const isLoading = useHrStore((state) => state.isLoading)
  const isSubmitting = useHrStore((state) => state.isSubmitting)
  const error = useHrStore((state) => state.error)
  const clearError = useHrStore((state) => state.clearError)
  const fetchBeneficiaries = useHrStore((state) => state.fetchBeneficiaries)
  const addBeneficiary = useHrStore((state) => state.addBeneficiary)
  const deleteBeneficiary = useHrStore((state) => state.deleteBeneficiary)
  const { begin, fail, succeed } = useMutationToast()

  useEffect(() => {
    fetchBeneficiaries({ force: true }).catch((fetchError) => {
      console.error('Gagal memuat penerima manfaat:', fetchError)
    })
  }, [fetchBeneficiaries])

  const gradeOptions = useMemo(() => {
    const grades = Array.from(
      new Set(beneficiaries.map((beneficiary) => normalizeText(beneficiary.jenjang)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b))

    return [{ value: 'all', label: 'Semua jenjang' }, ...grades.map((grade) => ({ value: grade, label: grade }))]
  }, [beneficiaries])

  const institutionOptions = useMemo(() => {
    const institutions = Array.from(
      new Set(beneficiaries.map((beneficiary) => normalizeText(beneficiary.institution)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b))

    return [
      { value: 'all', label: 'Semua instansi' },
      ...institutions.map((institution) => ({ value: institution, label: institution })),
    ]
  }, [beneficiaries])

  const selectedInstitutionLabel = useMemo(
    () =>
      institutionFilter === 'all'
        ? null
        : institutionOptions.find((option) => option.value === institutionFilter)?.label ?? null,
    [institutionFilter, institutionOptions]
  )

  const selectedInstitutionBeneficiaries = useMemo(() => {
    if (!selectedInstitutionLabel) {
      return []
    }

    return beneficiaries
      .filter((beneficiary) => normalizeText(beneficiary.institution) === selectedInstitutionLabel)
      .sort((left, right) => normalizeText(left.name).localeCompare(normalizeText(right.name)))
  }, [beneficiaries, selectedInstitutionLabel])

  const filteredBeneficiaries = useMemo(() => {
    return beneficiaries.filter((beneficiary) => {
      if (dataStatusFilter !== 'all' && beneficiary.data_status !== dataStatusFilter) {
        return false
      }

      if (gradeFilter !== 'all' && beneficiary.jenjang !== gradeFilter) {
        return false
      }

      if (institutionFilter !== 'all' && normalizeText(beneficiary.institution) !== institutionFilter) {
        return false
      }

      return matchesSearch(beneficiary, searchTerm)
    })
  }, [beneficiaries, dataStatusFilter, gradeFilter, institutionFilter, searchTerm])

  const selectedBeneficiary = useMemo(
    () => beneficiaries.find((beneficiary) => beneficiary.id === selectedBeneficiaryId) ?? null,
    [beneficiaries, selectedBeneficiaryId]
  )

  const summary = useMemo(() => {
    const institutionCount = new Set(
      beneficiaries.map((beneficiary) => normalizeText(beneficiary.institution)).filter(Boolean)
    ).size

    return {
      total: beneficiaries.length,
      valid: beneficiaries.filter((beneficiary) => beneficiary.data_status === 'Valid').length,
      needsReview: beneficiaries.filter((beneficiary) => beneficiary.data_status === 'Requires verification').length,
      institutions: institutionCount,
    }
  }, [beneficiaries])

  const visibleBeneficiaries = filteredBeneficiaries.slice(0, visibleCount)

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value)
    setVisibleCount(initialVisibleCount)
  }

  const handleDataStatusFilterChange = (nextDataStatusFilter) => {
    setDataStatusFilter(nextDataStatusFilter)
    setVisibleCount(initialVisibleCount)
  }

  const handleGradeFilterChange = (nextGradeFilter) => {
    setGradeFilter(nextGradeFilter)
    setVisibleCount(initialVisibleCount)
  }

  const handleInstitutionFilterChange = (nextInstitutionFilter) => {
    setInstitutionFilter(nextInstitutionFilter)
    setVisibleCount(initialVisibleCount)
  }

  const handleDownloadCsvTemplate = () => {
    downloadHrCsvTemplate('beneficiary')
  }

  const handleCsvImportCommit = async (preview) => {
    const existingNiks = beneficiaries.map((beneficiary) => beneficiary.nik)

    begin({
      title: 'Mengimpor penerima',
      message: 'Mohon tunggu sampai data selesai diproses.',
    })

    try {
      const result = await importBeneficiaryCsvRows({
        existingNiks,
        previewRows: preview.rows,
        saveBeneficiary: async (beneficiaryData) => {
          try {
            return await addBeneficiary(beneficiaryData)
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
          title: 'Impor penerima selesai',
          message: messageParts.join(' | '),
        })
      } else {
        fail({
          title: 'Impor penerima gagal',
          message: messageParts.join(' | '),
        })
      }

      return result
    } catch (importError) {
      fail({
        title: 'Impor penerima gagal',
        message: importError instanceof Error ? importError.message : 'Gagal mengimpor penerima manfaat.',
      })
      clearError()
      throw importError
    }
  }

  const handleSendInstitutionReport = async () => {
    if (isPdfDelivering || isLoading || isSubmitting) {
      return
    }

    if (!selectedInstitutionLabel) {
      fail({
        title: 'Pilih instansi dulu',
        message: 'Gunakan filter Instansi untuk memilih satu instansi sebelum mengirim PDF.',
      })
      return
    }

    if (selectedInstitutionBeneficiaries.length === 0) {
      fail({
        title: 'Instansi kosong',
        message: 'Tidak ada penerima pada instansi yang dipilih.',
      })
      return
    }

    begin({
      title: 'Mengirim laporan penerima',
      message: 'Mohon tunggu sampai PDF terkirim ke DM Telegram.',
    })

    setIsPdfDelivering(true)

    try {
      const result = await sendBusinessReportPdfToTelegramDm({
        reportData: buildBeneficiaryInstitutionReportData(
          selectedInstitutionBeneficiaries,
          selectedInstitutionLabel
        ),
      })

      succeed({
        title: result?.pdfError ? 'Laporan terkirim sebagian' : 'Laporan terkirim',
        message: result?.pdfError
          ? 'PDF gagal dikirim, tetapi pesan Telegram berhasil diterima.'
          : `PDF penerima untuk ${selectedInstitutionLabel} berhasil dikirim ke DM Telegram.`,
      })
    } catch (sendError) {
      fail({
        title: 'Laporan penerima gagal dikirim',
        message: sendError instanceof Error ? sendError.message : 'Gagal mengirim laporan penerima.',
      })
    } finally {
      setIsPdfDelivering(false)
    }
  }

  const handleDelete = async (beneficiary) => {
    if (!beneficiary?.id || isSubmitting) {
      return
    }

    if (!window.confirm(`Hapus penerima manfaat ${beneficiary.name}?`)) {
      return
    }

    begin({ title: 'Menghapus penerima', message: 'Mohon tunggu sampai data selesai diproses.' })

    try {
      await deleteBeneficiary(beneficiary.id)
      setSelectedBeneficiaryId(null)
      succeed({ title: 'Penerima dihapus', message: 'Data penerima manfaat berhasil dihapus.' })
    } catch (deleteError) {
      fail({
        title: 'Penerima gagal dihapus',
        message: deleteError instanceof Error ? deleteError.message : 'Gagal menghapus penerima manfaat.',
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
                onClick={() => navigate('/more/beneficiaries/new')}
                size="sm"
              >
                Tambah
              </AppButton>
            }
            backAction={() => navigate('/more')}
            compact
            eyebrow="More"
            title="Penerima Manfaat"
          />

          <div className="grid grid-cols-2 gap-2">
            <SummaryMetricCard label="Total" tone="neutral" value={String(summary.total)} />
            <SummaryMetricCard label="Valid" tone="success" value={String(summary.valid)} />
            <SummaryMetricCard label="Perlu Cek" tone="warning" value={String(summary.needsReview)} />
            <SummaryMetricCard label="Instansi" tone="info" value={String(summary.institutions)} />
          </div>

          <AppCardStrong className="space-y-3">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Cari penerima</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-hint-color)]" />
                <AppInput
                  className="pl-11"
                  onChange={handleSearchChange}
                  placeholder="Nama, NIK, instansi"
                  value={searchTerm}
                />
              </div>
            </label>

            <MasterPickerField
              compact
              label="Status Data"
              onChange={handleDataStatusFilterChange}
              options={dataStatusFilterOptions}
              placeholder="Semua"
              searchable={false}
              title="Status Data"
              value={dataStatusFilter}
            />

            <div className="grid grid-cols-2 gap-2">
              <MasterPickerField
                compact
                label="Jenjang"
                onChange={handleGradeFilterChange}
                options={gradeOptions}
                placeholder="Semua jenjang"
                searchable={false}
                title="Jenjang"
                value={gradeFilter}
              />

              <MasterPickerField
                compact
                label="Instansi"
                onChange={handleInstitutionFilterChange}
                options={institutionOptions}
                placeholder="Semua instansi"
                searchPlaceholder="Cari instansi..."
                title="Instansi"
                value={institutionFilter}
              />
            </div>

            <AppButton
              fullWidth
              leadingIcon={<Send className={`h-4 w-4 ${isPdfDelivering ? 'animate-pulse' : ''}`} />}
              onClick={() => void handleSendInstitutionReport()}
              type="button"
              variant="primary"
              disabled={isPdfDelivering || isLoading || isSubmitting}
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
              <AppButton onClick={() => void fetchBeneficiaries({ force: true })} size="sm" variant="secondary">
                Coba lagi
              </AppButton>
            }
            description={error}
            title="Penerima gagal dimuat"
          />
        ) : null}

        {isLoading && beneficiaries.length === 0 ? (
          <AppEmptyState
            icon={<Loader2 className="h-10 w-10 animate-spin" />}
            title="Memuat penerima manfaat"
          />
        ) : null}

        <PageSection
          action={
            <AppButton
              disabled={isLoading}
              leadingIcon={<RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
              onClick={() => void fetchBeneficiaries({ force: true })}
              size="sm"
              variant="secondary"
            >
              Refresh
            </AppButton>
          }
          eyebrow={`${filteredBeneficiaries.length} hasil`}
          title="Daftar Penerima"
        >
          {visibleBeneficiaries.length > 0 ? (
            <div className="space-y-2">
              {visibleBeneficiaries.map((beneficiary) => (
                <AppCardStrong
                  aria-label={`Buka detail penerima ${normalizeText(beneficiary.name, 'penerima')}`}
                  as="button"
                  className="w-full space-y-3 text-left"
                  key={beneficiary.id}
                  onClick={() => setSelectedBeneficiaryId(beneficiary.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 text-[var(--app-accent-color)]" />
                        <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                          {beneficiary.name}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-xs text-[var(--app-hint-color)]">
                        {beneficiary.institution || 'Instansi belum diisi'}
                      </p>
                    </div>
                    <AppBadge tone={getDataStatusTone(beneficiary.data_status)}>
                      {getDataStatusLabel(beneficiary.data_status)}
                    </AppBadge>
                  </div>

                </AppCardStrong>
              ))}
            </div>
          ) : !isLoading ? (
            <AppEmptyState
              icon={<HeartHandshake className="h-10 w-10" />}
              title={beneficiaries.length > 0 ? 'Tidak ada penerima yang cocok' : 'Belum ada penerima manfaat'}
            />
          ) : null}

          {filteredBeneficiaries.length > visibleBeneficiaries.length ? (
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

        <BeneficiaryDetailSheet
          beneficiary={selectedBeneficiary}
          onClose={() => setSelectedBeneficiaryId(null)}
          onDelete={() => void handleDelete(selectedBeneficiary)}
          onEdit={() => {
            if (selectedBeneficiary?.id) {
              navigate(`/more/beneficiaries/${selectedBeneficiary.id}/edit`)
            }
          }}
        />
        <HrCsvImportSheet
          kind="beneficiary"
          open={isCsvImportOpen}
          onCommit={handleCsvImportCommit}
          onClose={() => setIsCsvImportOpen(false)}
        />
        </PageShell>
      </ProtectedRoute>
    </PageViewportShell>
  )
}

function BeneficiaryFormPage() {
  const navigate = useNavigate()
  const { beneficiaryId } = useParams()
  const isEditMode = Boolean(beneficiaryId)
  const beneficiaries = useHrStore((state) => state.beneficiaries)
  const isLoading = useHrStore((state) => state.isLoading)
  const isSubmitting = useHrStore((state) => state.isSubmitting)
  const fetchBeneficiaries = useHrStore((state) => state.fetchBeneficiaries)
  const addBeneficiary = useHrStore((state) => state.addBeneficiary)
  const updateBeneficiary = useHrStore((state) => state.updateBeneficiary)
  const clearError = useHrStore((state) => state.clearError)
  const { begin, fail, succeed } = useMutationToast()
  const selectedBeneficiary = useMemo(
    () => beneficiaries.find((beneficiary) => beneficiary.id === beneficiaryId) ?? null,
    [beneficiaries, beneficiaryId]
  )
  const [formData, setFormData] = useState(() => createFormData())

  useEffect(() => {
    if (isEditMode && beneficiaries.length === 0) {
      fetchBeneficiaries({ force: true }).catch((fetchError) => {
        console.error('Gagal memuat penerima manfaat:', fetchError)
      })
    }
  }, [beneficiaries.length, fetchBeneficiaries, isEditMode])

  useEffect(() => {
    if (selectedBeneficiary) {
      setFormData(createFormData(selectedBeneficiary))
    }
  }, [selectedBeneficiary])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
    clearError()
  }

  const handleBack = () => {
    navigate('/more/beneficiaries')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!normalizeText(formData.name)) {
      fail({ title: 'Form belum lengkap', message: 'Nama penerima manfaat wajib diisi.' })
      return
    }

    begin({ title: isEditMode ? 'Menyimpan perubahan' : 'Menyimpan penerima', message: 'Mohon tunggu sampai data selesai diproses.' })

    try {
      if (isEditMode) {
        if (!selectedBeneficiary?.id) {
          throw new Error('Data penerima manfaat tidak ditemukan.')
        }

        await updateBeneficiary(selectedBeneficiary.id, formData)
      } else {
        await addBeneficiary(formData)
      }

      await fetchBeneficiaries({ force: true })
      succeed({ title: isEditMode ? 'Penerima diperbarui' : 'Penerima tersimpan', message: 'Data penerima manfaat berhasil disimpan.' })
      navigate('/more/beneficiaries')
    } catch (submitError) {
      fail({
        title: 'Penerima gagal disimpan',
        message: submitError instanceof Error ? submitError.message : 'Gagal menyimpan penerima manfaat.',
      })
      clearError()
    }
  }

  if (isEditMode && isLoading && !selectedBeneficiary) {
    return (
      <PageViewportShell>
        <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
          <PageShell>
            <AppEmptyState icon={<Loader2 className="h-10 w-10 animate-spin" />} title="Memuat penerima" />
          </PageShell>
        </ProtectedRoute>
      </PageViewportShell>
    )
  }

  if (isEditMode && !isLoading && !selectedBeneficiary) {
    return (
      <PageViewportShell>
        <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
          <PageShell>
            <PageHeader backAction={handleBack} compact title="Penerima tidak ditemukan" />
            <AppErrorState description="Data penerima manfaat tidak tersedia atau sudah dihapus." />
          </PageShell>
        </ProtectedRoute>
      </PageViewportShell>
    )
  }

  return (
    <ProtectedRoute allowedRoles={['Owner', 'Admin']}>
      <FormLayout
        actionLabel={isEditMode ? 'Simpan perubahan' : 'Simpan penerima'}
        description={null}
        eyebrow="Penerima Manfaat"
        formId={formId}
        isSubmitting={isSubmitting}
        onBack={handleBack}
        secondaryAction={
          <AppButton onClick={handleBack} type="button" variant="secondary">
            Batal
          </AppButton>
        }
        title={isEditMode ? 'Edit Penerima' : 'Tambah Penerima'}
      >
        <form className="space-y-4" id={formId} onSubmit={handleSubmit}>
          <FormSection title="Data Utama">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Nama</span>
              <AppInput name="name" onChange={handleChange} required value={formData.name} />
            </label>

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

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">Status</span>
                <AppSelect name="status" onChange={handleChange} value={formData.status}>
                  {beneficiaryStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AppSelect>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">Validasi Data</span>
                <AppSelect name="data_status" onChange={handleChange} value={formData.data_status}>
                  {dataStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AppSelect>
              </label>
            </div>
          </FormSection>

          <FormSection title="Instansi">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">Jenjang</span>
                <AppInput name="jenjang" onChange={handleChange} value={formData.jenjang} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">NPSN/NSPP</span>
                <AppInput name="npsn_nspp" onChange={handleChange} value={formData.npsn_nspp} />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Nama Instansi</span>
              <AppInput name="institution" onChange={handleChange} value={formData.institution} />
            </label>
          </FormSection>

          <FormSection title="Kelahiran">
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
          </FormSection>

          <FormSection title="Alamat">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">Kecamatan</span>
                <AppInput name="district" onChange={handleChange} value={formData.district} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">Desa/Kelurahan</span>
                <AppInput name="village" onChange={handleChange} value={formData.village} />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">Dusun</span>
                <AppInput name="hamlet" onChange={handleChange} value={formData.hamlet} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">RT</span>
                <AppInput name="rt" onChange={handleChange} value={formData.rt} />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--app-text-color)]">RW</span>
                <AppInput name="rw" onChange={handleChange} value={formData.rw} />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Alamat Lengkap</span>
              <AppTextarea className="h-24" name="alamat_lengkap" onChange={handleChange} value={formData.alamat_lengkap} />
            </label>
          </FormSection>

          <FormSection title="Catatan">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--app-text-color)]">Catatan</span>
              <AppTextarea className="h-24" name="notes" onChange={handleChange} value={formData.notes} />
            </label>
          </FormSection>
        </form>
      </FormLayout>
    </ProtectedRoute>
  )
}

function BeneficiariesPage() {
  const location = useLocation()
  const isFormRoute = location.pathname.endsWith('/new') || location.pathname.endsWith('/edit')

  return isFormRoute ? <BeneficiaryFormPage /> : <BeneficiariesListPage />
}

export default BeneficiariesPage
