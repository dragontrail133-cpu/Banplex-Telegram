import { useEffect, useMemo, useRef, useState } from 'react'
import { Trash2, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import FormLayout from '../components/layouts/FormLayout'
import BrandLoader from '../components/ui/BrandLoader'
import useAuthStore from '../store/useAuthStore'
import useFileStore from '../store/useFileStore'
import useReportStore from '../store/useReportStore'
import {
  AppBadge,
  AppButton,
  AppCard,
  AppErrorState,
  AppEmptyState,
  AppInput,
  AppTextarea,
  FormSection,
  PageHeader,
  PageShell,
} from '../components/ui/AppPrimitives'
import { createPdfSettingsDraft, normalizePdfColor, serializePdfSettingsDraft } from '../lib/business-report'

function LogoPickerCard({ label, logoAsset, inputRef, isBusy = false, onClear = null, onUpload = null }) {
  const hasLogo = Boolean(logoAsset?.public_url)

  const openPicker = () => {
    if (isBusy) {
      return
    }

    inputRef.current?.click()
  }

  const handleKeyDown = (event) => {
    if (isBusy) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPicker()
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null
          event.target.value = ''
          void onUpload?.(file)
        }}
        type="file"
      />
      <AppCard
        as={hasLogo ? 'div' : 'button'}
        className="group relative cursor-pointer overflow-hidden bg-[var(--app-surface-strong-color)] transition active:scale-[0.99]"
        onClick={openPicker}
        onKeyDown={hasLogo ? handleKeyDown : undefined}
        role={hasLogo ? 'button' : undefined}
        tabIndex={hasLogo ? 0 : undefined}
        type={hasLogo ? undefined : 'button'}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="app-meta">{label}</p>
            <p className="text-sm text-[var(--app-hint-color)]">
              {hasLogo ? logoAsset?.file_name ?? 'Logo siap digunakan' : 'Klik area ini untuk upload logo'}
            </p>
          </div>
          <AppBadge tone={hasLogo ? 'success' : 'warning'}>{hasLogo ? 'Terpasang' : 'Kosong'}</AppBadge>
        </div>

        {hasLogo ? (
          <div className="relative mt-3 overflow-hidden rounded-[20px] border border-[var(--app-border-color)] bg-white p-4">
            <img alt={logoAsset.file_name ?? label} className="max-h-24 max-w-full object-contain" src={logoAsset.public_url} />
            <AppButton
              aria-label={`Hapus ${label}`}
              className="absolute right-3 top-3 shadow-sm"
              iconOnly
              leadingIcon={<Trash2 className="h-4 w-4" />}
              disabled={isBusy}
              onClick={(event) => {
                event.stopPropagation()
                onClear?.()
              }}
              type="button"
              variant="secondary"
            />
          </div>
        ) : (
          <AppEmptyState
            icon={<Upload className="h-5 w-5" />}
            title="Klik untuk upload"
            description="Logo akan dipakai di header atau footer PDF."
          />
        )}
      </AppCard>
    </div>
  )
}

function ProjectPdfSettingsForm({
  initialPdfSettings = null,
  isBusy = false,
  currentTeamId = null,
  currentUser = null,
  formId = 'project-pdf-settings-form',
  onSave = null,
  onUploadLogo = null,
}) {
  const headerInputRef = useRef(null)
  const footerInputRef = useRef(null)
  const [draft, setDraft] = useState(() => createPdfSettingsDraft(initialPdfSettings))
  const [headerLogoPreview, setHeaderLogoPreview] = useState(
    () => initialPdfSettings?.header_logo_file_asset ?? null
  )
  const [footerLogoPreview, setFooterLogoPreview] = useState(
    () => initialPdfSettings?.footer_logo_file_asset ?? null
  )
  const [uploadError, setUploadError] = useState(null)

  const normalizedHeaderColor = useMemo(() => normalizePdfColor(draft.header_color), [draft.header_color])

  const handleSave = async (event) => {
    event.preventDefault()

    if (!currentTeamId || typeof onSave !== 'function') {
      return
    }

    try {
      await onSave({
        teamId: currentTeamId,
        ...serializePdfSettingsDraft(draft),
      })
    } catch (saveError) {
      console.error('Gagal menyimpan pengaturan PDF:', saveError)
    }
  }

  const handleUpload = async (target, file) => {
    if (!file || !currentTeamId || typeof onUploadLogo !== 'function') {
      return
    }

    setUploadError(null)

    try {
      const uploadedFile = await onUploadLogo(file, {
        team_id: currentTeamId,
        uploaded_by_user_id: currentUser?.id,
        uploaded_by: currentUser?.telegram_user_id,
        folder: 'pdf-settings',
        original_file_name: file.name,
        file_name: file.name,
      })

      if (target === 'header') {
        setDraft((currentDraft) => ({ ...currentDraft, header_logo_file_id: uploadedFile.id }))
        setHeaderLogoPreview(uploadedFile)
      } else {
        setDraft((currentDraft) => ({ ...currentDraft, footer_logo_file_id: uploadedFile.id }))
        setFooterLogoPreview(uploadedFile)
      }
    } catch (error) {
      console.error('Gagal mengunggah logo PDF:', error)
      setUploadError(error instanceof Error ? error.message : 'Gagal mengunggah logo PDF.')
    }
  }

  const handleClearLogo = (target) => {
    if (target === 'header') {
      setDraft((currentDraft) => ({ ...currentDraft, header_logo_file_id: '' }))
      setHeaderLogoPreview(null)
      return
    }

    setDraft((currentDraft) => ({ ...currentDraft, footer_logo_file_id: '' }))
    setFooterLogoPreview(null)
  }

  return (
    <form id={formId} className="space-y-4" onSubmit={handleSave}>
      {uploadError ? <AppErrorState title="Pengaturan PDF gagal diproses" description={uploadError} /> : null}

      <FormSection
        eyebrow="Identitas"
        title="Branding laporan"
        description="Lengkapi identitas utama yang tampil di PDF hasil unduh."
      >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 sm:col-span-2">
              <span className="app-meta">Nama perusahaan</span>
              <AppInput
                disabled={isBusy}
                onChange={(event) => {
                  setDraft((currentDraft) => ({ ...currentDraft, company_name: event.target.value }))
                }}
                value={draft.company_name}
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="app-meta">Alamat</span>
              <AppTextarea
                disabled={isBusy}
                onChange={(event) => {
                  setDraft((currentDraft) => ({ ...currentDraft, address: event.target.value }))
                }}
                value={draft.address}
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="app-meta">Telepon</span>
              <AppInput
                disabled={isBusy}
                onChange={(event) => {
                  setDraft((currentDraft) => ({ ...currentDraft, phone: event.target.value }))
                }}
                value={draft.phone}
              />
            </label>

            <label className="space-y-2 sm:col-span-2">
              <span className="app-meta">Warna header</span>
              <AppInput
                className="h-14 p-2"
                disabled={isBusy}
                onChange={(event) => {
                  setDraft((currentDraft) => ({ ...currentDraft, header_color: event.target.value }))
                }}
                type="color"
                value={normalizedHeaderColor}
              />
            </label>
          </div>
      </FormSection>

      <FormSection
        eyebrow="Logo"
        title="Logo header dan footer"
        description="Upload aset brand yang dipakai pada area atas dan bawah PDF."
      >
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-3">
              <LogoPickerCard
                inputRef={headerInputRef}
                isBusy={isBusy || !currentTeamId}
                label="Logo Header"
                logoAsset={headerLogoPreview}
                onClear={() => handleClearLogo('header')}
                onUpload={(file) => handleUpload('header', file)}
              />
            </div>

            <div className="space-y-3">
              <LogoPickerCard
                inputRef={footerInputRef}
                isBusy={isBusy || !currentTeamId}
                label="Logo Footer"
                logoAsset={footerLogoPreview}
                onClear={() => handleClearLogo('footer')}
                onUpload={(file) => handleUpload('footer', file)}
              />
            </div>
          </div>
      </FormSection>
    </form>
  )
}

export function ProjectPdfSettingsSection() {
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const currentUser = useAuthStore((state) => state.user)
  const pdfSettings = useReportStore((state) => state.pdfSettings)
  const isPdfSettingsLoading = useReportStore((state) => state.isPdfSettingsLoading)
  const isPdfSettingsSaving = useReportStore((state) => state.isPdfSettingsSaving)
  const pdfSettingsError = useReportStore((state) => state.pdfSettingsError)
  const fetchPdfSettings = useReportStore((state) => state.fetchPdfSettings)
  const savePdfSettings = useReportStore((state) => state.savePdfSettings)
  const uploadAndRegisterFile = useFileStore((state) => state.uploadAndRegisterFile)

  useEffect(() => {
    if (!currentTeamId) {
      return
    }

    void fetchPdfSettings(currentTeamId).catch((fetchError) => {
      console.error('Gagal memuat pengaturan PDF:', fetchError)
    })
  }, [currentTeamId, fetchPdfSettings])

  const isBusy = isPdfSettingsLoading || isPdfSettingsSaving
  const settingsRevisionKey = pdfSettings?.updated_at ?? pdfSettings?.team_id ?? currentTeamId ?? 'empty'
  const formId = 'project-pdf-settings-form'

  return (
    <section id="pdf-settings" className="scroll-mt-24 space-y-4">
      {pdfSettingsError ? (
        <AppErrorState title="Pengaturan PDF gagal diproses" description={pdfSettingsError} />
      ) : null}

      {isPdfSettingsLoading && !pdfSettings ? (
        <div className="grid min-h-[16rem] place-items-center px-4 text-center">
          <div className="flex flex-col items-center gap-5">
            <BrandLoader context="form" size="hero" />
            <div className="space-y-2">
              <h2 className="text-xl font-bold tracking-[-0.03em] text-[var(--app-text-color)]">
                Memuat pengaturan PDF
              </h2>
              <p className="max-w-[20rem] text-sm leading-6 text-[var(--app-hint-color)]">
                Menyiapkan branding laporan.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <FormLayout
          embedded
          actionLabel="Simpan Pengaturan"
          formId={formId}
          isSubmitting={isBusy}
          submitDisabled={!currentTeamId}
        >
          <ProjectPdfSettingsForm
            key={settingsRevisionKey}
            currentTeamId={currentTeamId}
            currentUser={currentUser}
            formId={formId}
            initialPdfSettings={pdfSettings}
            isBusy={isBusy}
            onSave={savePdfSettings}
            onUploadLogo={uploadAndRegisterFile}
          />
        </FormLayout>
      )}
    </section>
  )
}

function ProjectPdfSettingsPage() {
  const navigate = useNavigate()

  return (
    <PageShell className="space-y-4">
      <PageHeader
        eyebrow="Pelaporan"
        title="Pengaturan PDF"
        description="Atur identitas laporan, warna utama, dan logo yang dipakai saat PDF diunduh."
        compact
        backAction={() => navigate('/reports')}
        backLabel="Laporan"
      />
      <ProjectPdfSettingsSection />
    </PageShell>
  )
}

export default ProjectPdfSettingsPage
