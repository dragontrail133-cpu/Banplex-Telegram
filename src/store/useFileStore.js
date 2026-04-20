import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { compressImageFile } from '../lib/attachment-upload'
import { waitForAuthStoreReady, waitForSupabaseSession } from '../lib/auth-session'
import {
  assertAttachmentAction,
  canPerformAttachmentAction,
  getAttachmentPermissions,
} from '../lib/attachment-permissions'
import useAuthStore from './useAuthStore'
import {
  resolveProfileId,
  resolveTeamId,
  resolveTelegramUserId,
} from '../lib/auth-context'

const DEFAULT_BUCKET_NAME = 'hrd_documents'
const ACTIVE_UPLOAD_STAGES = new Set([
  'queued',
  'compressing',
  'uploading',
  'registering',
])

let uploadTaskSequence = 0
let uploadQueuePromise = Promise.resolve()

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

function getCurrentAttachmentRole() {
  return useAuthStore.getState().role
}

function sanitizeFileName(fileName) {
  return String(fileName ?? 'document')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildStoragePath(fileName, folder = 'hrd') {
  const safeFileName = sanitizeFileName(fileName)
  const dateSegment = new Date().toISOString().slice(0, 10)
  const uniqueSegment =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return [normalizeText(folder, 'hrd'), dateSegment, `${uniqueSegment}-${safeFileName}`]
    .filter(Boolean)
    .join('/')
}

function normalizeFileAssetRow(fileAsset) {
  return {
    ...fileAsset,
    team_id: normalizeText(fileAsset?.team_id, null),
    storage_bucket: normalizeText(
      fileAsset?.storage_bucket ?? fileAsset?.bucket_name,
      DEFAULT_BUCKET_NAME
    ),
    bucket_name: normalizeText(fileAsset?.bucket_name, DEFAULT_BUCKET_NAME),
    storage_path: normalizeText(fileAsset?.storage_path),
    original_name: normalizeText(fileAsset?.original_name ?? fileAsset?.file_name),
    file_name: normalizeText(fileAsset?.file_name ?? fileAsset?.original_name),
    public_url: normalizeText(fileAsset?.public_url),
    mime_type: normalizeText(fileAsset?.mime_type, null),
    size_bytes: toNumber(fileAsset?.size_bytes ?? fileAsset?.file_size),
    file_size: toNumber(fileAsset?.file_size ?? fileAsset?.size_bytes),
    uploaded_by_user_id: normalizeText(fileAsset?.uploaded_by_user_id, null),
    uploaded_by: normalizeText(fileAsset?.uploaded_by, null),
    deleted_at: normalizeText(fileAsset?.deleted_at, null),
  }
}

function nextUploadTaskId() {
  uploadTaskSequence += 1

  return `attachment-upload-${uploadTaskSequence}`
}

function isUploadTaskActive(task) {
  return ACTIVE_UPLOAD_STAGES.has(task?.stage)
}

function updateUploadQueue(set, updater) {
  set((state) => {
    const nextUploadQueue = updater(state.uploadQueue)

    return {
      uploadQueue: nextUploadQueue,
      isUploading: nextUploadQueue.some((task) => isUploadTaskActive(task)),
    }
  })
}

function createUploadTask(file, options = {}) {
  const now = new Date().toISOString()

  return {
    id: nextUploadTaskId(),
    scopeKey: normalizeText(options.scopeKey, 'global'),
    fileName: normalizeText(file?.name, 'attachment'),
    mimeType: normalizeText(file?.type, null),
    originalSizeBytes: toNumber(file?.size),
    processedSizeBytes: toNumber(file?.size),
    progress: 5,
    stage: 'queued',
    error: null,
    fileAssetId: null,
    compressionSummary: null,
    createdAt: now,
    updatedAt: now,
  }
}

function patchUploadTask(set, taskId, patch = {}) {
  updateUploadQueue(set, (queue) =>
    queue.map((task) =>
      task.id === taskId
        ? {
            ...task,
            ...patch,
            updatedAt: new Date().toISOString(),
          }
        : task
    )
  )
}

function dismissUploadTaskById(set, taskId) {
  updateUploadQueue(set, (queue) => queue.filter((task) => task.id !== taskId))
}

function scheduleUploadTask(taskRunner) {
  const scheduledTask = uploadQueuePromise.then(taskRunner, taskRunner)
  uploadQueuePromise = scheduledTask.catch(() => null)

  return scheduledTask
}

async function deleteStorageObject(bucketName, storagePath) {
  if (!supabase || !bucketName || !storagePath) {
    return null
  }

  const { error } = await supabase.storage.from(bucketName).remove([storagePath])

  return error ?? null
}

async function insertFileAssetRecord(uploadMeta = {}) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  await waitForAuthStoreReady()
  await waitForSupabaseSession()

  assertAttachmentAction(
    getCurrentAttachmentRole(),
    'upload',
    'Role Anda tidak diizinkan meregistrasi attachment.'
  )

  const teamId = resolveTeamId(uploadMeta.team_id)
  const bucketName = normalizeText(uploadMeta.bucket_name, DEFAULT_BUCKET_NAME)
  const storagePath = normalizeText(uploadMeta.storage_path)
  const fileName = normalizeText(uploadMeta.file_name)
  const originalName = normalizeText(uploadMeta.original_name, fileName)
  const publicUrl = normalizeText(uploadMeta.public_url)
  const uploadedByUserId = resolveProfileId(uploadMeta.uploaded_by_user_id)
  const uploadedBy = resolveTelegramUserId(uploadMeta.uploaded_by)

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  if (!bucketName) {
    throw new Error('Nama bucket file wajib diisi.')
  }

  if (!storagePath) {
    throw new Error('Storage path file wajib diisi.')
  }

  if (!fileName) {
    throw new Error('Nama file wajib diisi.')
  }

  if (!publicUrl) {
    throw new Error('Public URL file wajib diisi.')
  }

  const { data, error } = await supabase
    .from('file_assets')
    .insert({
      team_id: teamId,
      storage_bucket: bucketName,
      bucket_name: bucketName,
      storage_path: storagePath,
      original_name: originalName,
      file_name: fileName,
      public_url: publicUrl,
      mime_type: normalizeText(uploadMeta.mime_type, null),
      size_bytes: toNumber(uploadMeta.file_size),
      file_size: toNumber(uploadMeta.file_size),
      uploaded_by_user_id: uploadedByUserId,
      uploaded_by: uploadedBy,
    })
    .select(
      'id, team_id, storage_bucket, bucket_name, storage_path, original_name, file_name, public_url, mime_type, size_bytes, file_size, uploaded_by_user_id, uploaded_by, created_at, updated_at, deleted_at'
    )
    .single()

  if (error) {
    throw error
  }

  return normalizeFileAssetRow(data)
}

async function uploadFileToStorage(file, options = {}) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  await waitForAuthStoreReady()
  await waitForSupabaseSession()

  assertAttachmentAction(
    getCurrentAttachmentRole(),
    'upload',
    'Role Anda tidak diizinkan mengunggah attachment.'
  )

  if (!(file instanceof File)) {
    throw new Error('File yang diunggah tidak valid.')
  }

  const bucketName = normalizeText(options.bucket_name, DEFAULT_BUCKET_NAME)
  const folder = normalizeText(options.folder, 'hrd')
  const originalFileName =
    normalizeText(options.original_file_name, null) ?? normalizeText(file.name, 'document')
  const displayFileName =
    normalizeText(options.file_name, null) ?? normalizeText(file.name, 'document')
  const storagePath = buildStoragePath(originalFileName, folder)
  const contentType = normalizeText(file.type, 'application/octet-stream')

  const { error } = await supabase.storage.from(bucketName).upload(storagePath, file, {
    contentType,
    upsert: false,
  })

  if (error) {
    throw error
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath)
  const publicUrl = normalizeText(data?.publicUrl)

  if (!publicUrl) {
    throw new Error('Public URL file gagal dibentuk.')
  }

  return {
    team_id: resolveTeamId(options.team_id),
    storage_bucket: bucketName,
    bucket_name: bucketName,
    storage_path: storagePath,
    original_name: originalFileName,
    file_name: displayFileName,
    public_url: publicUrl,
    mime_type: file.type || null,
    size_bytes: file.size,
    file_size: file.size,
    uploaded_by_user_id: resolveProfileId(options.uploaded_by_user_id),
    uploaded_by: resolveTelegramUserId(options.uploaded_by),
  }
}

async function uploadAndRegisterFile(file, options = {}) {
  await waitForAuthStoreReady()
  await waitForSupabaseSession()

  assertAttachmentAction(
    getCurrentAttachmentRole(),
    'upload',
    'Role Anda tidak diizinkan mengunggah attachment.'
  )

  const uploadedFile = await uploadFileToStorage(file, options)

  try {
    return await insertFileAssetRecord(uploadedFile)
  } catch (error) {
    await deleteStorageObject(uploadedFile.bucket_name, uploadedFile.storage_path)
    throw error
  }
}

async function loadFileAssetById(fileAssetId, { includeDeleted = true } = {}) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  await waitForAuthStoreReady()
  await waitForSupabaseSession()

  assertAttachmentAction(
    getCurrentAttachmentRole(),
    'view',
    'Role Anda tidak diizinkan melihat attachment.'
  )

  const normalizedId = normalizeText(fileAssetId)

  if (!normalizedId) {
    throw new Error('ID file asset wajib diisi.')
  }

  let query = supabase
    .from('file_assets')
    .select(
      'id, team_id, storage_bucket, bucket_name, storage_path, original_name, file_name, public_url, mime_type, size_bytes, file_size, uploaded_by_user_id, uploaded_by, created_at, updated_at, deleted_at'
    )
    .eq('id', normalizedId)

  if (!includeDeleted) {
    query = query.is('deleted_at', null)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    throw error
  }

  return data ? normalizeFileAssetRow(data) : null
}

async function updateFileAssetMetadata(fileAssetId, metadata = {}) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  await waitForAuthStoreReady()
  await waitForSupabaseSession()

  const normalizedId = normalizeText(fileAssetId)
  const currentRole = useAuthStore.getState().role

  assertAttachmentAction(
    currentRole,
    'editMetadata',
    'Role Anda tidak diizinkan mengedit metadata attachment.'
  )

  if (!normalizedId) {
    throw new Error('ID file asset wajib diisi.')
  }

  const fileName = normalizeText(metadata.file_name ?? metadata.fileName)
  const originalName = normalizeText(metadata.original_name ?? metadata.originalName, fileName)

  if (!fileName) {
    throw new Error('Nama file wajib diisi.')
  }

  const existingFileAsset = await loadFileAssetById(normalizedId, { includeDeleted: true })

  if (!existingFileAsset?.id) {
    throw new Error('File asset tidak ditemukan.')
  }

  if (existingFileAsset.deleted_at) {
    throw new Error('Metadata attachment terhapus harus dipulihkan lebih dulu.')
  }

  const { data, error } = await supabase
    .from('file_assets')
    .update({
      file_name: fileName,
      original_name: originalName,
      mime_type: normalizeText(metadata.mime_type ?? metadata.mimeType, existingFileAsset.mime_type),
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedId)
    .is('deleted_at', null)
    .select(
      'id, team_id, storage_bucket, bucket_name, storage_path, original_name, file_name, public_url, mime_type, size_bytes, file_size, uploaded_by_user_id, uploaded_by, created_at, updated_at, deleted_at'
    )
    .single()

  if (error) {
    throw error
  }

  return normalizeFileAssetRow(data)
}

async function restoreFileAsset(fileAssetId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  await waitForAuthStoreReady()
  await waitForSupabaseSession()

  const normalizedId = normalizeText(fileAssetId)
  const currentRole = useAuthStore.getState().role

  assertAttachmentAction(
    currentRole,
    'restore',
    'Role Anda tidak diizinkan memulihkan attachment.'
  )

  if (!normalizedId) {
    throw new Error('ID file asset wajib diisi.')
  }

  const existingFileAsset = await loadFileAssetById(normalizedId, { includeDeleted: true })

  if (!existingFileAsset?.id) {
    throw new Error('File asset tidak ditemukan.')
  }

  const { data, error } = await supabase
    .from('file_assets')
    .update({
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedId)
    .not('deleted_at', 'is', null)
    .select(
      'id, team_id, storage_bucket, bucket_name, storage_path, original_name, file_name, public_url, mime_type, size_bytes, file_size, uploaded_by_user_id, uploaded_by, created_at, updated_at, deleted_at'
    )
    .single()

  if (error) {
    throw error
  }

  return normalizeFileAssetRow(data)
}

async function permanentDeleteFileAsset(fileAssetId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  await waitForAuthStoreReady()
  await waitForSupabaseSession()

  const normalizedId = normalizeText(fileAssetId)
  const currentRole = useAuthStore.getState().role

  assertAttachmentAction(
    currentRole,
    'permanentDelete',
    'Role Anda tidak diizinkan menghapus attachment secara permanen.'
  )

  if (!normalizedId) {
    throw new Error('ID file asset wajib diisi.')
  }

  const existingFileAsset = await loadFileAssetById(normalizedId, { includeDeleted: true })

  if (!existingFileAsset?.id) {
    return true
  }

  const storageDeleteError = await deleteStorageObject(
    existingFileAsset.bucket_name,
    existingFileAsset.storage_path
  )

  if (storageDeleteError) {
    throw storageDeleteError
  }

  const { error } = await supabase.from('file_assets').delete().eq('id', normalizedId)

  if (error) {
    throw error
  }

  return true
}

async function deleteFileAsset(fileAssetId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  await waitForAuthStoreReady()
  await waitForSupabaseSession()

  const normalizedId = normalizeText(fileAssetId)
  const currentRole = useAuthStore.getState().role

  assertAttachmentAction(
    currentRole,
    'delete',
    'Role Anda tidak diizinkan menghapus attachment.'
  )

  if (!normalizedId) {
    throw new Error('ID file asset wajib diisi.')
  }

  const { data: fileAsset, error: fetchError } = await supabase
    .from('file_assets')
    .select('id')
    .eq('id', normalizedId)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchError) {
    throw fetchError
  }

  if (!fileAsset?.id) {
    return true
  }

  const { error } = await supabase
    .from('file_assets')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedId)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return true
}

async function processUploadTask(taskId, file, options, set) {
  let uploadedFile = null

  try {
    patchUploadTask(set, taskId, {
      stage: 'compressing',
      progress: 20,
      error: null,
    })

    const { file: preparedFile, summary } = await compressImageFile(
      file,
      options.compression ?? {}
    )

    patchUploadTask(set, taskId, {
      stage: 'uploading',
      progress: 55,
      compressionSummary: summary,
      processedSizeBytes: toNumber(preparedFile?.size),
      mimeType: normalizeText(preparedFile?.type, normalizeText(file?.type, null)),
    })

    uploadedFile = await uploadFileToStorage(preparedFile, {
      ...options,
      original_file_name: normalizeText(options.original_file_name, file?.name),
      file_name: normalizeText(options.file_name, file?.name),
    })

    patchUploadTask(set, taskId, {
      stage: 'registering',
      progress: 85,
      processedSizeBytes: toNumber(uploadedFile?.file_size),
    })

    const fileAsset = await insertFileAssetRecord({
      ...uploadedFile,
      original_name: normalizeText(options.original_name, file?.name),
      file_name: normalizeText(options.file_name, file?.name),
    })

    patchUploadTask(set, taskId, {
      stage: 'completed',
      progress: 100,
      fileAssetId: fileAsset.id,
      error: null,
    })

    set((state) => ({
      uploadedFileAssets: [
        fileAsset,
        ...state.uploadedFileAssets.filter((item) => item.id !== fileAsset.id),
      ],
      error: null,
    }))

    return {
      taskId,
      fileAsset,
      compressionSummary: summary,
    }
  } catch (error) {
    if (uploadedFile?.bucket_name && uploadedFile?.storage_path) {
      await deleteStorageObject(uploadedFile.bucket_name, uploadedFile.storage_path).catch(
        () => null
      )
    }

    const normalizedError = toError(error, 'Gagal memproses upload attachment.')

    patchUploadTask(set, taskId, {
      stage: 'failed',
      progress: 100,
      error: normalizedError.message,
    })

    set({
      error: normalizedError.message,
    })

    throw normalizedError
  }
}

const useFileStore = create((set, get) => ({
  uploadedFileAssets: [],
  uploadQueue: [],
  isUploading: false,
  error: null,
  getAttachmentPermissions: () => getAttachmentPermissions(useAuthStore.getState().role),
  canPerformAttachmentAction: (action) =>
    canPerformAttachmentAction(useAuthStore.getState().role, action),
  clearError: () => set({ error: null }),
  dismissUploadTask: (taskId) => {
    dismissUploadTaskById(set, taskId)
  },
  startBackgroundUpload: (file, options = {}) => {
    const task = createUploadTask(file, options)

    updateUploadQueue(set, (queue) => [task, ...queue])
    set({ error: null })

    const resultPromise = scheduleUploadTask(() =>
      processUploadTask(task.id, file, options, set)
    )

    return {
      taskId: task.id,
      resultPromise,
    }
  },
  uploadFileToStorage: async (file, options = {}) => {
    set({ isUploading: true, error: null })

    try {
      assertAttachmentAction(
        useAuthStore.getState().role,
        'upload',
        'Role Anda tidak diizinkan mengunggah attachment.'
      )

      const uploadedFile = await uploadFileToStorage(file, options)
      const fileAsset = await insertFileAssetRecord(uploadedFile)

      set((state) => ({
        uploadedFileAssets: [fileAsset, ...state.uploadedFileAssets],
        isUploading: state.uploadQueue.some((task) => isUploadTaskActive(task)),
        error: null,
      }))

      return fileAsset
    } catch (error) {
      const normalizedError = toError(error, 'Gagal mengunggah file.')

      set((state) => ({
        isUploading: state.uploadQueue.some((task) => isUploadTaskActive(task)),
        error: normalizedError.message,
      }))

      throw normalizedError
    }
  },
  registerFileAsset: async (uploadMeta = {}) => {
    set({ isUploading: true, error: null })

    try {
      assertAttachmentAction(
        useAuthStore.getState().role,
        'upload',
        'Role Anda tidak diizinkan meregistrasi attachment.'
      )

      const fileAsset = await insertFileAssetRecord(uploadMeta)

      set((state) => ({
        uploadedFileAssets: [fileAsset, ...state.uploadedFileAssets],
        isUploading: state.uploadQueue.some((task) => isUploadTaskActive(task)),
        error: null,
      }))

      return fileAsset
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menyimpan metadata file.')

      set((state) => ({
        isUploading: state.uploadQueue.some((task) => isUploadTaskActive(task)),
        error: normalizedError.message,
      }))

      throw normalizedError
    }
  },
  uploadAndRegisterFile: async (file, options = {}) => {
    const { resultPromise } = get().startBackgroundUpload(file, options)
    const result = await resultPromise

    return result.fileAsset
  },
  deleteFileAsset: async (fileAssetId) => {
    set({ isUploading: true, error: null })

    try {
      await deleteFileAsset(fileAssetId)

      set((state) => ({
        uploadedFileAssets: state.uploadedFileAssets.filter(
          (item) => item.id !== fileAssetId
        ),
        isUploading: state.uploadQueue.some((task) => isUploadTaskActive(task)),
        error: null,
      }))

      return true
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menghapus file.')

      set((state) => ({
        isUploading: state.uploadQueue.some((task) => isUploadTaskActive(task)),
        error: normalizedError.message,
      }))

      throw normalizedError
    }
  },
  updateFileAssetMetadata: async (fileAssetId, metadata = {}) => {
    set({ isUploading: true, error: null })

    try {
      const fileAsset = await updateFileAssetMetadata(fileAssetId, metadata)

      set((state) => ({
        uploadedFileAssets: state.uploadedFileAssets.map((item) =>
          item.id === fileAsset.id ? fileAsset : item
        ),
        isUploading: state.uploadQueue.some((task) => isUploadTaskActive(task)),
        error: null,
      }))

      return fileAsset
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memperbarui metadata file.')

      set((state) => ({
        isUploading: state.uploadQueue.some((task) => isUploadTaskActive(task)),
        error: normalizedError.message,
      }))

      throw normalizedError
    }
  },
  restoreFileAsset: async (fileAssetId) => {
    set({ isUploading: true, error: null })

    try {
      const fileAsset = await restoreFileAsset(fileAssetId)

      set((state) => ({
        uploadedFileAssets: state.uploadedFileAssets.map((item) =>
          item.id === fileAsset.id ? fileAsset : item
        ),
        isUploading: state.uploadQueue.some((task) => isUploadTaskActive(task)),
        error: null,
      }))

      return fileAsset
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memulihkan file.')

      set((state) => ({
        isUploading: state.uploadQueue.some((task) => isUploadTaskActive(task)),
        error: normalizedError.message,
      }))

      throw normalizedError
    }
  },
  permanentDeleteFileAsset: async (fileAssetId) => {
    set({ isUploading: true, error: null })

    try {
      await permanentDeleteFileAsset(fileAssetId)

      set((state) => ({
        uploadedFileAssets: state.uploadedFileAssets.filter(
          (item) => item.id !== fileAssetId
        ),
        isUploading: state.uploadQueue.some((task) => isUploadTaskActive(task)),
        error: null,
      }))

      return true
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menghapus file secara permanen.')

      set((state) => ({
        isUploading: state.uploadQueue.some((task) => isUploadTaskActive(task)),
        error: normalizedError.message,
      }))

      throw normalizedError
    }
  },
}))

export default useFileStore
export {
  deleteFileAsset,
  insertFileAssetRecord,
  loadFileAssetById,
  uploadAndRegisterFile,
  uploadFileToStorage,
  updateFileAssetMetadata,
  restoreFileAsset,
  permanentDeleteFileAsset,
  useFileStore,
}
