import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PencilLine, RotateCcw, Trash2, Upload } from 'lucide-react'
import useMutationToast from '../hooks/useMutationToast'
import useAuthStore from '../store/useAuthStore'
import useFileStore from '../store/useFileStore'
import useTransactionStore from '../store/useTransactionStore'

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function formatFileSize(sizeBytes) {
  const amount = Number(sizeBytes)

  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  if (amount >= 1024 * 1024) {
    return `${(amount / (1024 * 1024)).toFixed(1)} MB`
  }

  if (amount >= 1024) {
    return `${(amount / 1024).toFixed(1)} KB`
  }

  return `${amount} B`
}

function resolveAttachmentFile(attachment) {
  return attachment?.file_assets ?? attachment?.file_asset ?? null
}

function formatUploadStage(stage) {
  const normalizedStage = String(stage ?? '').trim().toLowerCase()

  if (normalizedStage === 'failed') {
    return 'Gagal'
  }

  if (normalizedStage === 'completed') {
    return 'Selesai'
  }

  if (normalizedStage === 'uploading') {
    return 'Mengunggah'
  }

  if (normalizedStage === 'processing') {
    return 'Memproses'
  }

  return 'Menunggu'
}

function ExpenseAttachmentSection({
  expenseId = null,
  title = 'Lampiran',
  deferUploadUntilParentSaved = false,
  attachmentResetRequestId = null,
  onAttachmentResetSettled = null,
  readOnly = false,
}) {
  const isAuthLoading = useAuthStore((state) => state.isLoading)
  const isRegistered = useAuthStore((state) => state.isRegistered)
  const currentTeamId = useAuthStore((state) => state.currentTeamId)
  const uploadQueue = useFileStore((state) => state.uploadQueue)
  const startBackgroundUpload = useFileStore((state) => state.startBackgroundUpload)
  const dismissUploadTask = useFileStore((state) => state.dismissUploadTask)
  const updateFileAssetMetadata = useFileStore((state) => state.updateFileAssetMetadata)
  const purgeFileAsset = useFileStore((state) => state.purgeFileAsset)
  const canPerformAttachmentAction = useFileStore(
    (state) => state.canPerformAttachmentAction
  )
  const fetchExpenseAttachments = useTransactionStore(
    (state) => state.fetchExpenseAttachments
  )
  const attachExpenseAttachment = useTransactionStore(
    (state) => state.attachExpenseAttachment
  )
  const softDeleteExpenseAttachment = useTransactionStore(
    (state) => state.softDeleteExpenseAttachment
  )
  const restoreExpenseAttachment = useTransactionStore(
    (state) => state.restoreExpenseAttachment
  )
  const permanentDeleteExpenseAttachment = useTransactionStore(
    (state) => state.permanentDeleteExpenseAttachment
  )

  const [attachments, setAttachments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState(null)
  const [uploadLabel, setUploadLabel] = useState('')
  const [isDraftOverlayVisible, setIsDraftOverlayVisible] = useState(false)
  const [editingAttachmentId, setEditingAttachmentId] = useState(null)
  const [editingFileName, setEditingFileName] = useState('')
  const fileInputRef = useRef(null)
  const selectedBeforeParentSaveRef = useRef(false)
  const lastAttachmentResetHandledRef = useRef(null)
  const { begin, clear, fail, succeed } = useMutationToast()
  const showInlineMutationFeedback = false

  const canUpload = !readOnly && canPerformAttachmentAction('upload')
  const canEditMetadata = !readOnly && canPerformAttachmentAction('editMetadata')
  const canDelete = !readOnly && canPerformAttachmentAction('delete')
  const canRestore = !readOnly && canPerformAttachmentAction('restore')
  const canPermanentDelete = !readOnly && canPerformAttachmentAction('permanentDelete')
  const isAuthReady = !isAuthLoading && isRegistered && Boolean(currentTeamId)
  const uploadScopeKey = `expense-attachment:${expenseId ?? 'unknown'}`

  const activeAttachments = useMemo(
    () => attachments.filter((attachment) => !attachment.deleted_at),
    [attachments]
  )
  const deletedAttachments = useMemo(
    () => attachments.filter((attachment) => attachment.deleted_at),
    [attachments]
  )
  const scopedUploadTasks = useMemo(
    () =>
      uploadQueue
        .filter((task) => task.scopeKey === uploadScopeKey)
        .slice(0, 3),
    [uploadQueue, uploadScopeKey]
  )
  const isUploadQueueActive = useMemo(
    () =>
      scopedUploadTasks.some((task) =>
        ['queued', 'compressing', 'uploading', 'registering'].includes(task.stage)
      ),
    [scopedUploadTasks]
  )
  const isBusy = isLoading || isUploadQueueActive

  useEffect(() => () => clear(), [clear])

  useEffect(() => {
    if (!selectedFile || !String(selectedFile.type ?? '').startsWith('image/')) {
      setSelectedFilePreviewUrl(null)
      return undefined
    }

    const objectUrl = URL.createObjectURL(selectedFile)
    setSelectedFilePreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [selectedFile])

  useEffect(() => {
    let isActive = true

    if (!isAuthReady) {
      setAttachments([])
      setError(null)
      return () => {
        isActive = false
      }
    }

    if (attachmentResetRequestId) {
      setAttachments([])
      setError(null)
      return () => {
        isActive = false
      }
    }

    if (!expenseId) {
      setAttachments([])
      setError(null)
      return () => {
        isActive = false
      }
    }

    async function loadAttachments() {
      setIsLoading(true)
      setError(null)

      try {
        const nextAttachments = await fetchExpenseAttachments(expenseId, {
          includeDeleted: true,
        })

        if (!isActive) {
          return
        }

        setAttachments(nextAttachments)
      } catch (loadError) {
        if (!isActive) {
          return
        }

        setError(loadError instanceof Error ? loadError.message : 'Gagal memuat lampiran.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadAttachments()

    return () => {
      isActive = false
    }
  }, [attachmentResetRequestId, expenseId, fetchExpenseAttachments, isAuthReady])

  const reloadAttachments = useCallback(async () => {
    if (!expenseId || !isAuthReady || attachmentResetRequestId) {
      return
    }

    const nextAttachments = await fetchExpenseAttachments(expenseId, {
      includeDeleted: true,
    })

    setAttachments(nextAttachments)
  }, [attachmentResetRequestId, expenseId, fetchExpenseAttachments, isAuthReady])

  const clearSelectedFile = useCallback(() => {
    setSelectedFile(null)
    setUploadLabel('')
    setIsDraftOverlayVisible(false)
    setEditingAttachmentId(null)
    setEditingFileName('')
    selectedBeforeParentSaveRef.current = false

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  const handleDraftFileChange = (event) => {
    const nextFile = event.target.files?.[0] ?? null

    setSelectedFile(nextFile)
    setUploadLabel(nextFile?.name ?? '')
    setIsDraftOverlayVisible(false)
    selectedBeforeParentSaveRef.current = Boolean(
      deferUploadUntilParentSaved && nextFile && !expenseId
    )
  }

  const uploadSelectedFile = useCallback(async (resolvedExpenseId) => {
    if (!resolvedExpenseId || !selectedFile || !canUpload || !isAuthReady) {
      return
    }

    setIsLoading(true)
    setError(null)
    begin({
      title: 'Mengunggah lampiran',
      message: 'Mohon tunggu sampai lampiran selesai diproses.',
    })

    try {
      const { resultPromise } = startBackgroundUpload(selectedFile, {
        team_id: currentTeamId,
        uploaded_by_user_id: useAuthStore.getState().user?.id ?? null,
        uploaded_by: useAuthStore.getState().user?.telegram_user_id ?? null,
        folder: 'expense',
        scopeKey: uploadScopeKey,
        original_name: selectedFile.name,
        file_name: selectedFile.name,
      })
      const { fileAsset } = await resultPromise

      try {
        await attachExpenseAttachment(resolvedExpenseId, fileAsset.id, {
          teamId: currentTeamId,
          sortOrder: activeAttachments.length + 1,
        })
      } catch (attachError) {
        if (fileAsset?.id) {
          await purgeFileAsset(fileAsset.id).catch(() => null)
        }

        throw attachError
      }

      clearSelectedFile()
      await reloadAttachments()
      succeed({
        title: 'Lampiran tersimpan',
        message: 'Lampiran berhasil diunggah.',
      })
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : 'Gagal mengunggah lampiran.'
      setError(message)
      fail({
        title: 'Lampiran gagal diunggah',
        message,
      })
    } finally {
      setIsLoading(false)
    }
  }, [
    activeAttachments.length,
    attachExpenseAttachment,
    canUpload,
    currentTeamId,
    isAuthReady,
    reloadAttachments,
    selectedFile,
    clearSelectedFile,
    purgeFileAsset,
    startBackgroundUpload,
    uploadScopeKey,
    begin,
    fail,
    succeed,
    ])

  const handleUpload = async () => {
    await uploadSelectedFile(expenseId)
  }

  const draftPreviewFrameClass = 'h-44 sm:h-48'

  useEffect(() => {
    if (
      !deferUploadUntilParentSaved ||
      !expenseId ||
      !selectedFile ||
      !selectedBeforeParentSaveRef.current ||
      !canUpload ||
      !isAuthReady
    ) {
      return
    }

    selectedBeforeParentSaveRef.current = false

    void uploadSelectedFile(expenseId)
  }, [
    canUpload,
    deferUploadUntilParentSaved,
    expenseId,
    isAuthReady,
    selectedFile,
    uploadSelectedFile,
  ])

  useEffect(() => {
    if (!attachmentResetRequestId) {
      lastAttachmentResetHandledRef.current = null
      return
    }

    if (lastAttachmentResetHandledRef.current === attachmentResetRequestId) {
      return
    }

    if (isBusy || selectedFile) {
      return
    }

    scopedUploadTasks.forEach((task) => {
      dismissUploadTask(task.id)
    })

    lastAttachmentResetHandledRef.current = attachmentResetRequestId
    setAttachments([])
    clearSelectedFile()
    setError(null)
    onAttachmentResetSettled?.(attachmentResetRequestId)
  }, [
    attachmentResetRequestId,
    clearSelectedFile,
    dismissUploadTask,
    isBusy,
    onAttachmentResetSettled,
    scopedUploadTasks,
    selectedFile,
  ])

  const handleEditMetadata = async (attachment) => {
    const fileAsset = resolveAttachmentFile(attachment)

    if (!fileAsset?.id || !editingFileName.trim() || !isAuthReady) {
      return
    }

    setIsLoading(true)
    setError(null)
    begin({
      title: 'Menyimpan metadata lampiran',
      message: 'Mohon tunggu sampai perubahan tersimpan.',
    })

    try {
      await updateFileAssetMetadata(fileAsset.id, {
        file_name: editingFileName,
        original_name: editingFileName,
      })

      setEditingAttachmentId(null)
      setEditingFileName('')
      await reloadAttachments()
      succeed({
        title: 'Metadata lampiran tersimpan',
        message: 'Nama file lampiran berhasil diperbarui.',
      })
    } catch (editError) {
      const message =
        editError instanceof Error ? editError.message : 'Gagal memperbarui metadata.'
      setError(message)
      fail({
        title: 'Metadata lampiran gagal diperbarui',
        message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSoftDelete = async (attachment) => {
    if (!attachment?.id || !canDelete || !isAuthReady) {
      return
    }

    setIsLoading(true)
    setError(null)
    begin({
      title: 'Menghapus lampiran',
      message: 'Mohon tunggu sampai lampiran dipindahkan ke arsip.',
    })

    try {
      await softDeleteExpenseAttachment(attachment.id, currentTeamId)
      await reloadAttachments()
      succeed({
        title: 'Lampiran diarsipkan',
        message: 'Lampiran berhasil dihapus.',
      })
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : 'Gagal menghapus lampiran.'
      setError(message)
      fail({
        title: 'Lampiran gagal dihapus',
        message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestore = async (attachment) => {
    if (!attachment?.id || !canRestore || !isAuthReady) {
      return
    }

    setIsLoading(true)
    setError(null)
    begin({
      title: 'Memulihkan lampiran',
      message: 'Mohon tunggu sampai lampiran kembali aktif.',
    })

    try {
      await restoreExpenseAttachment(attachment.id, currentTeamId)
      await reloadAttachments()
      succeed({
        title: 'Lampiran dipulihkan',
        message: 'Lampiran berhasil dipulihkan.',
      })
    } catch (restoreError) {
      const message =
        restoreError instanceof Error ? restoreError.message : 'Gagal memulihkan lampiran.'
      setError(message)
      fail({
        title: 'Lampiran gagal dipulihkan',
        message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePermanentDelete = async (attachment) => {
    if (!attachment?.id || !canPermanentDelete || !isAuthReady) {
      return
    }

    setIsLoading(true)
    setError(null)
    begin({
      title: 'Menghapus permanen lampiran',
      message: 'Mohon tunggu sampai lampiran dihapus permanen.',
    })

    try {
      await permanentDeleteExpenseAttachment(attachment.id, currentTeamId)
      await reloadAttachments()
      succeed({
        title: 'Lampiran dihapus permanen',
        message: 'Lampiran berhasil dihapus permanen.',
      })
    } catch (permanentDeleteError) {
      const message =
        permanentDeleteError instanceof Error
          ? permanentDeleteError.message
          : 'Gagal menghapus lampiran secara permanen.'
      setError(message)
      fail({
        title: 'Lampiran gagal dihapus permanen',
        message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!isAuthReady) {
    return null
  }

  return (
    <section className="space-y-4 overflow-x-hidden rounded-[26px] border border-slate-200 bg-white p-4 sm:p-5">
      <div className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--app-accent-color)]">
          {title}
        </p>
      </div>

      <div className="space-y-3">
        {activeAttachments.map((attachment) => {
          const fileAsset = resolveAttachmentFile(attachment)
          const isEditing = editingAttachmentId === attachment.id
          const fileName =
            fileAsset?.file_name ?? fileAsset?.original_name ?? 'Lampiran'

          return (
            <article
              key={attachment.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-hint-color)]">
                        Nama file
                      </span>
                      <input
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                        onChange={(event) => setEditingFileName(event.target.value)}
                        value={editingFileName}
                      />
                    </label>
                  ) : (
                    <>
                      <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                        {normalizeText(fileName, 'Lampiran')}
                      </p>
                      {fileAsset?.public_url ? (
                        <a
                          className="mt-1 block truncate text-xs font-medium text-sky-700 underline"
                          href={fileAsset.public_url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Buka file
                        </a>
                      ) : null}
                      <p className="mt-1 text-xs text-[var(--app-hint-color)]">
                        {[
                          fileAsset?.mime_type,
                          formatFileSize(fileAsset?.size_bytes ?? fileAsset?.file_size),
                          attachment.deleted_at ? 'Terhapus' : 'Aktif',
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </p>
                    </>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {isEditing ? (
                    <>
                      <button
              className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                        disabled={isBusy}
                        onClick={() => {
                          setEditingAttachmentId(null)
                          setEditingFileName('')
                        }}
                        type="button"
                      >
                        Batal
                      </button>
                      <button
                        className="rounded-full bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                        disabled={isBusy}
                        onClick={() => handleEditMetadata(attachment)}
                        type="button"
                      >
                        Simpan
                      </button>
                    </>
                  ) : (
                    <>
                      {canEditMetadata ? (
                        <button
                          className="rounded-full border border-slate-200 p-2 text-slate-700 disabled:opacity-60"
                          disabled={isBusy}
                          onClick={() => {
                            setEditingAttachmentId(attachment.id)
                            setEditingFileName(fileAsset?.file_name ?? fileAsset?.original_name ?? '')
                          }}
                          type="button"
                          aria-label="Edit metadata lampiran"
                        >
                          <PencilLine className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canDelete ? (
                        <button
                          className="rounded-full border border-slate-200 p-2 text-rose-600 disabled:opacity-60"
                          disabled={isBusy}
                          onClick={() => handleSoftDelete(attachment)}
                          type="button"
                          aria-label="Hapus lampiran"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canRestore && attachment.deleted_at ? (
                        <button
                          className="rounded-full border border-slate-200 p-2 text-emerald-600 disabled:opacity-60"
                          disabled={isBusy}
                          onClick={() => handleRestore(attachment)}
                          type="button"
                          aria-label="Pulihkan lampiran"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      ) : null}
                      {canPermanentDelete ? (
                        attachment.deleted_at ? (
                          <button
                            className="rounded-full border border-slate-200 p-2 text-rose-700 disabled:opacity-60"
                            disabled={isBusy}
                            onClick={() => handlePermanentDelete(attachment)}
                            type="button"
                            aria-label="Hapus permanen lampiran"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              {fileAsset?.public_url &&
              String(fileAsset?.mime_type ?? '').startsWith('image/') ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <img
                    alt={fileName}
                    className="h-44 w-full object-cover"
                    src={fileAsset.public_url}
                  />
                </div>
              ) : null}
            </article>
          )
        })}

        {deletedAttachments.length > 0 ? (
          <div className="space-y-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-hint-color)]">
              Lampiran terhapus
            </p>
            {deletedAttachments.map((attachment) => {
              const fileAsset = resolveAttachmentFile(attachment)

              return (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--app-text-color)]">
                      {normalizeText(fileAsset?.file_name ?? fileAsset?.original_name, 'Lampiran')}
                    </p>
                    <p className="text-xs text-[var(--app-hint-color)]">Terhapus</p>
                  </div>
                  {canRestore ? (
                    <button
                      className="rounded-full border border-slate-200 p-2 text-emerald-600 disabled:opacity-60"
                      disabled={isBusy}
                      onClick={() => handleRestore(attachment)}
                      type="button"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  ) : null}
                  {canPermanentDelete ? (
                    <button
                      className="rounded-full border border-slate-200 p-2 text-rose-700 disabled:opacity-60"
                      disabled={isBusy}
                      onClick={() => handlePermanentDelete(attachment)}
                      type="button"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>

      {canUpload ? (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            accept="image/*,.pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleDraftFileChange}
            type="file"
          />

          {!selectedFile ? (
            <button
              className="flex h-52 w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center transition hover:border-sky-300 hover:bg-sky-50"
              disabled={isBusy}
              onClick={openFilePicker}
              type="button"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                <Upload className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--app-text-color)]">
                  Ketuk untuk pilih lampiran
                </p>
                <p className="text-xs text-[var(--app-hint-color)]">
                  Gambar atau PDF
                </p>
              </div>
            </button>
          ) : (
            <div className="space-y-2">
              <div className="group relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
                <button
                  aria-label="Buka manajemen draft lampiran"
                  className="block w-full max-w-full overflow-hidden text-left"
                  disabled={isBusy}
                  onClick={() => setIsDraftOverlayVisible((currentValue) => !currentValue)}
                  type="button"
                >
                  <div className={`relative w-full max-w-full overflow-hidden ${draftPreviewFrameClass}`}>
                    {selectedFilePreviewUrl ? (
                      <div
                        aria-label={uploadLabel || 'Preview lampiran'}
                        className="h-full w-full bg-cover bg-top bg-no-repeat opacity-95 transition group-hover:opacity-100"
                        role="img"
                        style={{ backgroundImage: `url("${selectedFilePreviewUrl}")` }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-slate-100 px-4 text-center text-sm text-slate-600">
                        <div className="space-y-2">
                          <p className="font-semibold text-[var(--app-text-color)]">
                            {uploadLabel || 'File terpilih'}
                          </p>
                          <p>{formatFileSize(selectedFile.size) ?? 'Ukuran tidak diketahui'}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end bg-gradient-to-b from-slate-950/55 via-slate-950/10 to-transparent px-4 py-4 text-white">
                    <span className="rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-2.5 py-1 text-[11px] font-semibold text-[var(--app-text-color)]">
                      {isDraftOverlayVisible ? 'Tutup' : 'Kelola'}
                    </span>
                  </div>
                </button>

                <div
                  className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/82 to-transparent px-3 pb-3 pt-16 transition ${
                    isDraftOverlayVisible
                      ? 'opacity-100'
                      : 'pointer-events-none opacity-0'
                  }`}
                >
                  <div className="grid w-full grid-cols-3 gap-2">
                    <button
                      className="min-w-0 rounded-full bg-white px-2 py-2 text-center text-[11px] font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isBusy || !expenseId}
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleUpload()
                      }}
                      type="button"
                    >
                      Simpan
                    </button>
                    <button
                      className="min-w-0 rounded-full border border-[var(--app-border-color)] bg-[var(--app-surface-strong-color)] px-2 py-2 text-center text-[11px] font-semibold text-[var(--app-text-color)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isBusy}
                      onClick={(event) => {
                        event.stopPropagation()
                        openFilePicker()
                      }}
                      type="button"
                    >
                      Ganti
                    </button>
                    <button
                      className="min-w-0 rounded-full border border-[var(--app-tone-danger-border)] bg-[var(--app-tone-danger-bg)] px-2 py-2 text-center text-[11px] font-semibold text-[var(--app-tone-danger-text)] disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isBusy}
                      onClick={(event) => {
                        event.stopPropagation()
                        clearSelectedFile()
                      }}
                      type="button"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1 px-1">
                <p className="truncate text-xs font-medium text-[var(--app-text-color)]">
                  {uploadLabel || selectedFile.name}
                </p>
                <div className="flex flex-col items-start gap-1 text-[11px] text-[var(--app-hint-color)] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <p className="min-w-0 truncate">
                    {[selectedFile.type, formatFileSize(selectedFile.size)].filter(Boolean).join(' • ')}
                  </p>
                  {deferUploadUntilParentSaved && !expenseId ? (
                    <span className="shrink-0 text-[11px] font-medium text-[var(--app-hint-color)]">
                      Menunggu simpan form
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )}
          {showInlineMutationFeedback && scopedUploadTasks.length > 0 ? (
            <div className="space-y-2">
              {scopedUploadTasks.map((task) => {
                const savedBytes = task.compressionSummary?.savedBytes ?? 0
                const progressWidth = Math.min(Math.max(Number(task.progress) || 0, 8), 100)

                return (
                  <div
                    key={task.id}
                    className="rounded-2xl border border-slate-200 bg-white px-3 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-[var(--app-text-color)]">
                        {normalizeText(task.fileName, 'Lampiran')}
                      </p>
                      <span className="text-xs font-semibold text-[var(--app-hint-color)]">
                        {Math.round(task.progress)}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--app-hint-color)]">
                      {[
                        formatUploadStage(task.stage),
                        formatFileSize(task.originalSizeBytes),
                        savedBytes > 0 ? `hemat ${formatFileSize(savedBytes)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${
                          task.stage === 'failed'
                            ? 'bg-rose-500'
                            : task.stage === 'completed'
                              ? 'bg-emerald-500'
                              : 'bg-sky-500'
                        }`}
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                    {task.error ? (
                      <p className="mt-2 text-xs text-rose-700">{task.error}</p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {showInlineMutationFeedback && error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
          {error}
        </div>
      ) : null}

      {showInlineMutationFeedback && isBusy ? (
        <p className="text-xs text-[var(--app-hint-color)]">
          Memproses lampiran...
        </p>
      ) : null}
    </section>
  )
}

export default ExpenseAttachmentSection
