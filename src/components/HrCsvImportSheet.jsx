import { useMemo, useRef, useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import {
  AppBadge,
  AppButton,
  AppCardDashed,
  AppEmptyState,
  AppErrorState,
  AppListCard,
  AppListRow,
  AppSheet,
} from './ui/AppPrimitives'
import { getHrCsvSchema, parseCsvPreview } from '../lib/hr-csv'

const previewStatusToneMap = {
  valid: 'success',
  skip: 'warning',
  error: 'danger',
}

const previewStatusLabelMap = {
  valid: 'Valid',
  skip: 'Skip',
  error: 'Error',
}

function SummaryStatCard({ label, value }) {
  return (
    <AppCardDashed className="space-y-1 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--app-hint-color)]">
        {label}
      </p>
      <p className="text-2xl font-semibold leading-none tracking-[-0.05em] text-[var(--app-text-color)]">
        {value}
      </p>
    </AppCardDashed>
  )
}

function HrCsvImportSheet({ kind, open, onClose, onCommit = null }) {
  return (
    <HrCsvImportSheetContent
      key={`${kind}-${open ? 'open' : 'closed'}`}
      kind={kind}
      open={open}
      onClose={onClose}
      onCommit={onCommit}
    />
  )
}

function HrCsvImportSheetContent({ kind, open, onClose, onCommit = null }) {
  const schema = useMemo(() => getHrCsvSchema(kind), [kind])
  const fileInputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState(null)
  const [commitResult, setCommitResult] = useState(null)
  const [isCommitting, setIsCommitting] = useState(false)

  const hasPreview = Boolean(preview)
  const canCommit = Boolean(onCommit && preview && preview.summary.valid > 0)

  const handlePickFile = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const csvText = await file.text()
      const nextPreview = parseCsvPreview(kind, csvText)

      setPreview(nextPreview)
      setFileName(file.name)
      setError(null)
      setCommitResult(null)
    } catch (fileError) {
      setPreview(null)
      setFileName(file.name)
      setCommitResult(null)
      setError(fileError instanceof Error ? fileError.message : 'Gagal membaca CSV.')
    }
  }

  const handleCommit = async () => {
    if (!canCommit || !preview || !onCommit) {
      return
    }

    setIsCommitting(true)

    try {
      const nextCommitResult = await onCommit(preview)

      setCommitResult(nextCommitResult ?? null)
      setError(null)
    } catch (commitError) {
      setCommitResult(null)
      setError(commitError instanceof Error ? commitError.message : 'Gagal mengimpor CSV.')
    } finally {
      setIsCommitting(false)
    }
  }

  const actionGridClassName = onCommit ? 'grid grid-cols-2 gap-2' : 'space-y-2'
  const summarySource = commitResult ?? preview
  const summaryLabels = commitResult
    ? ['Tersimpan', 'Skip', 'Error']
    : ['Valid', 'Skip', 'Error']
  const summaryValues = commitResult
    ? [commitResult.summary.saved, commitResult.summary.skipped, commitResult.summary.error]
    : [preview?.summary.valid ?? 0, preview?.summary.skipped ?? 0, preview?.summary.error ?? 0]
  const displayRows = commitResult?.rows ?? preview?.rows ?? []

  return (
    <AppSheet
      contentClassName="px-4 py-3"
      maxWidth="lg"
      onClose={onClose}
      open={open}
      title={schema.sheetTitle}
    >
      <div className="space-y-4">
        <input
          accept=".csv,text/csv"
          aria-hidden="true"
          className="sr-only"
          onChange={handleFileChange}
          ref={fileInputRef}
          tabIndex={-1}
          type="file"
        />

        <div className={actionGridClassName}>
          <AppButton
            fullWidth
            leadingIcon={<Upload className="h-4 w-4" />}
            onClick={handlePickFile}
            type="button"
            variant="secondary"
          >
            Pilih CSV
          </AppButton>
          {onCommit ? (
            <AppButton
              fullWidth
              disabled={!canCommit || isCommitting}
              onClick={handleCommit}
              type="button"
            >
              {isCommitting ? 'Memproses...' : 'Impor'}
            </AppButton>
          ) : null}
        </div>

        {error ? <AppErrorState description={error} title="CSV gagal dibaca" /> : null}

        {!error && !hasPreview ? (
          <AppEmptyState icon={<FileText className="h-10 w-10" />} title="Pilih CSV" />
        ) : null}

        {summarySource ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <SummaryStatCard label={summaryLabels[0]} value={String(summaryValues[0])} />
              <SummaryStatCard label={summaryLabels[1]} value={String(summaryValues[1])} />
              <SummaryStatCard label={summaryLabels[2]} value={String(summaryValues[2])} />
            </div>

            {fileName ? (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-hint-color)]">
                {fileName}
              </p>
            ) : null}

            {commitResult ? (
              <AppCardDashed className="space-y-2 px-3 py-3">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">Hasil impor</p>
                <p className="text-sm leading-6 text-[var(--app-hint-color)]">
                  {commitResult.summary.saved > 0
                    ? `${commitResult.summary.saved} data tersimpan.`
                    : 'Tidak ada data yang tersimpan.'}
                </p>
              </AppCardDashed>
            ) : null}

            {displayRows.length > 0 ? (
              <AppListCard className="max-h-[50vh] space-y-0 overflow-y-auto p-2">
                {displayRows.map((row) => (
                  <AppListRow
                    key={row.rowNumber}
                    title={row.title}
                    description={
                      row.status === 'error'
                        ? row.issues.join(' | ')
                        : row.description ?? null
                    }
                    trailing={
                      <AppBadge tone={previewStatusToneMap[row.status] ?? 'neutral'}>
                        {previewStatusLabelMap[row.status] ?? row.status}
                      </AppBadge>
                    }
                  />
                ))}
              </AppListCard>
            ) : (
              <AppEmptyState title="Tidak ada data" />
            )}
          </div>
        ) : null}
      </div>
    </AppSheet>
  )
}

export default HrCsvImportSheet
