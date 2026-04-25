import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { resolveTeamId } from '../lib/auth-context'
import { deleteFileAsset, uploadAndRegisterFile } from './useFileStore'

const applicantStatusOptions = [
  { value: 'screening', label: 'Screening' },
  { value: 'interview_hr', label: 'Interview HR' },
  { value: 'offering', label: 'Offering' },
  { value: 'diterima', label: 'Diterima' },
  { value: 'ditolak', label: 'Ditolak' },
]

const beneficiaryStatusOptions = [
  { value: 'active', label: 'Aktif' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Nonaktif' },
]

const applicantSelectColumns =
  'id, team_id, legacy_firebase_id, source_beneficiary_id, name, nama_lengkap, position, posisi_dilamar, email, no_telepon, jenis_kelamin, nik, no_kk, tempat_lahir, tanggal_lahir, pendidikan_terakhir, nama_institusi_pendidikan, jurusan, sumber_lowongan, status_aplikasi, pengalaman_kerja, skills, district, sub_district, village, hamlet, rt, rw, alamat_lengkap, alamat_domisili, notes, catatan_hrd, created_at, updated_at, deleted_at'

const beneficiarySelectColumns =
  'id, team_id, legacy_firebase_id, name, nama_penerima, nik, institution, nama_instansi, jenis_kelamin, jenjang, npsn_nspp, jarak_meter, status, data_status, tempat_lahir, tanggal_lahir, district, sub_district, village, hamlet, rt, rw, alamat_lengkap, notes, created_at, updated_at, deleted_at'

const supabasePageSize = 1000
const relationChunkSize = 200

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

async function fetchAllSupabaseRows(createQuery) {
  const rows = []
  let from = 0

  while (true) {
    const { data, error } = await createQuery().range(from, from + supabasePageSize - 1)

    if (error) {
      throw error
    }

    const nextRows = data ?? []
    rows.push(...nextRows)

    if (nextRows.length < supabasePageSize) {
      break
    }

    from += supabasePageSize
  }

  return rows
}

function chunkArray(values, size = relationChunkSize) {
  const chunks = []

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size))
  }

  return chunks
}

function normalizeApplicantStatus(value) {
  const normalizedValue = normalizeText(value, 'screening')
  const allowedValues = new Set(applicantStatusOptions.map((option) => option.value))

  return allowedValues.has(normalizedValue) ? normalizedValue : 'screening'
}

function normalizeBeneficiaryStatus(value) {
  const normalizedValue = normalizeText(value, 'active')
  const allowedValues = new Set(beneficiaryStatusOptions.map((option) => option.value))

  return allowedValues.has(normalizedValue) ? normalizedValue : 'active'
}

function normalizeFileAssetRow(fileAsset) {
  return fileAsset
    ? {
        ...fileAsset,
        bucket_name: normalizeText(fileAsset.bucket_name, 'hrd_documents'),
        storage_path: normalizeText(fileAsset.storage_path),
        file_name: normalizeText(fileAsset.file_name),
        public_url: normalizeText(fileAsset.public_url),
        mime_type: normalizeText(fileAsset.mime_type, null),
        file_size: toNumber(fileAsset.file_size),
        uploaded_by: normalizeText(fileAsset.uploaded_by, null),
        deleted_at: normalizeText(fileAsset.deleted_at, null),
      }
    : null
}

function normalizeApplicantDocumentRow(document) {
  return {
    ...document,
    team_id: normalizeText(document?.team_id, null),
    applicant_id: normalizeText(document?.applicant_id, null),
    document_type: normalizeText(document?.document_type, 'other'),
    deleted_at: normalizeText(document?.deleted_at, null),
    file_assets: normalizeFileAssetRow(document?.file_assets),
  }
}

function normalizeApplicantRow(applicant) {
  const documents = Array.isArray(applicant?.documents)
    ? applicant.documents
        .map(normalizeApplicantDocumentRow)
        .filter((document) => !document.deleted_at && !document.file_assets?.deleted_at)
    : []
  const fullName = normalizeText(applicant?.nama_lengkap ?? applicant?.name)
  const position = normalizeText(applicant?.posisi_dilamar ?? applicant?.position)
  const notes = normalizeText(applicant?.catatan_hrd ?? applicant?.notes, null)

  return {
    ...applicant,
    name: fullName,
    nama_lengkap: fullName,
    position,
    posisi_dilamar: position,
    status_aplikasi: normalizeApplicantStatus(applicant?.status_aplikasi),
    notes,
    catatan_hrd: notes,
    email: normalizeText(applicant?.email, null),
    no_telepon: normalizeText(applicant?.no_telepon, null),
    jenis_kelamin: normalizeText(applicant?.jenis_kelamin, null),
    nik: normalizeText(applicant?.nik, null),
    no_kk: normalizeText(applicant?.no_kk, null),
    tempat_lahir: normalizeText(applicant?.tempat_lahir, null),
    tanggal_lahir: normalizeText(applicant?.tanggal_lahir, null),
    pendidikan_terakhir: normalizeText(applicant?.pendidikan_terakhir, null),
    nama_institusi_pendidikan: normalizeText(applicant?.nama_institusi_pendidikan, null),
    jurusan: normalizeText(applicant?.jurusan, null),
    sumber_lowongan: normalizeText(applicant?.sumber_lowongan, null),
    pengalaman_kerja: normalizeText(applicant?.pengalaman_kerja, null),
    skills: normalizeText(applicant?.skills, null),
    district: normalizeText(applicant?.district, null),
    sub_district: normalizeText(applicant?.sub_district, null),
    village: normalizeText(applicant?.village, null),
    hamlet: normalizeText(applicant?.hamlet, null),
    rt: normalizeText(applicant?.rt, null),
    rw: normalizeText(applicant?.rw, null),
    alamat_lengkap: normalizeText(applicant?.alamat_lengkap, null),
    alamat_domisili: normalizeText(applicant?.alamat_domisili, null),
    source_beneficiary_id: normalizeText(applicant?.source_beneficiary_id, null),
    deleted_at: normalizeText(applicant?.deleted_at, null),
    documents,
    documentCount: documents.length,
  }
}

function normalizeBeneficiaryRow(beneficiary) {
  const beneficiaryName = normalizeText(
    beneficiary?.nama_penerima ?? beneficiary?.name
  )
  const institution = normalizeText(
    beneficiary?.nama_instansi ?? beneficiary?.institution,
    null
  )
  const status = normalizeBeneficiaryStatus(
    beneficiary?.status ?? beneficiary?.data_status
  )
  const dataStatus = normalizeText(
    beneficiary?.data_status ?? beneficiary?.dataStatus,
    status
  )

  return {
    ...beneficiary,
    name: beneficiaryName,
    nama_penerima: beneficiaryName,
    nik: normalizeText(beneficiary?.nik, null),
    institution,
    nama_instansi: institution,
    status,
    data_status: dataStatus,
    jenis_kelamin: normalizeText(beneficiary?.jenis_kelamin, null),
    jenjang: normalizeText(beneficiary?.jenjang, null),
    npsn_nspp: normalizeText(beneficiary?.npsn_nspp, null),
    jarak_meter: toNumber(beneficiary?.jarak_meter),
    tempat_lahir: normalizeText(beneficiary?.tempat_lahir, null),
    tanggal_lahir: normalizeText(beneficiary?.tanggal_lahir, null),
    district: normalizeText(beneficiary?.district, null),
    sub_district: normalizeText(beneficiary?.sub_district, null),
    village: normalizeText(beneficiary?.village, null),
    hamlet: normalizeText(beneficiary?.hamlet, null),
    rt: normalizeText(beneficiary?.rt, null),
    rw: normalizeText(beneficiary?.rw, null),
    alamat_lengkap: normalizeText(beneficiary?.alamat_lengkap, null),
    notes: normalizeText(beneficiary?.notes, null),
    deleted_at: normalizeText(beneficiary?.deleted_at, null),
  }
}

function mergeApplicantDocuments(applicants, documents) {
  const documentMap = documents.reduce((accumulator, document) => {
    const applicantId = document.applicant_id

    if (!applicantId) {
      return accumulator
    }

    if (!accumulator[applicantId]) {
      accumulator[applicantId] = []
    }

    accumulator[applicantId].push(normalizeApplicantDocumentRow(document))

    return accumulator
  }, {})

  return applicants.map((applicant) => {
    const applicantDocuments = (documentMap[applicant.id] ?? []).filter(
      (document) => !document.deleted_at && !document.file_assets?.deleted_at
    )

    return normalizeApplicantRow({
      ...applicant,
      documents: applicantDocuments,
    })
  })
}

async function loadApplicants() {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const applicants = await fetchAllSupabaseRows(() =>
    supabase
      .from('hrd_applicants')
      .select(applicantSelectColumns)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
  )
  const applicantIds = applicants.map((applicant) => applicant.id)

  if (applicantIds.length === 0) {
    return []
  }

  const documents = []

  for (const applicantIdChunk of chunkArray(applicantIds)) {
    const chunkDocuments = await fetchAllSupabaseRows(() =>
      supabase
        .from('hrd_applicant_documents')
        .select(
          'id, team_id, applicant_id, file_asset_id, document_type, created_at, updated_at, deleted_at, file_assets:file_asset_id ( id, bucket_name, storage_path, file_name, public_url, mime_type, file_size, uploaded_by, created_at, updated_at, deleted_at )'
        )
        .in('applicant_id', applicantIdChunk)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
    )

    documents.push(...chunkDocuments)
  }

  return mergeApplicantDocuments(applicants, documents)
}

async function loadBeneficiaries() {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const data = await fetchAllSupabaseRows(() =>
    supabase
      .from('beneficiaries')
      .select(beneficiarySelectColumns)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
  )

  return (data ?? []).map(normalizeBeneficiaryRow)
}

async function loadApplicantDocuments(applicantId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedApplicantId = normalizeText(applicantId)

  if (!normalizedApplicantId) {
    return []
  }

  const data = await fetchAllSupabaseRows(() =>
    supabase
      .from('hrd_applicant_documents')
      .select(
        'id, team_id, applicant_id, file_asset_id, document_type, created_at, updated_at, deleted_at, file_assets:file_asset_id ( id, bucket_name, storage_path, file_name, public_url, mime_type, file_size, uploaded_by, created_at, updated_at, deleted_at )'
      )
      .eq('applicant_id', normalizedApplicantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
  )

  return data
    .map(normalizeApplicantDocumentRow)
    .filter((document) => !document.deleted_at && !document.file_assets?.deleted_at)
}

async function softDeleteRecord(tableName, id, patch = {}) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedId = normalizeText(id)

  if (!normalizedId) {
    throw new Error('ID data tidak valid.')
  }

  const { error } = await supabase
    .from(tableName)
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...patch,
    })
    .eq('id', normalizedId)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return true
}

async function softDeleteApplicantDocuments(applicantId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedApplicantId = normalizeText(applicantId)

  if (!normalizedApplicantId) {
    return false
  }

  const { error } = await supabase
    .from('hrd_applicant_documents')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('applicant_id', normalizedApplicantId)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return true
}

async function softDeleteApplicantDocument(documentId) {
  return softDeleteRecord('hrd_applicant_documents', documentId)
}

const useHrStore = create((set, get) => ({
  applicants: [],
  beneficiaries: [],
  isLoading: false,
  isSubmitting: false,
  error: null,
  lastUpdatedAt: null,
  clearError: () => set({ error: null }),
  fetchApplicants: async ({ force = false } = {}) => {
    const { applicants, isLoading } = get()

    if (!force && !isLoading && applicants.length > 0) {
      return applicants
    }

    set({ isLoading: true, error: null })

    try {
      const nextApplicants = await loadApplicants()

      set({
        applicants: nextApplicants,
        isLoading: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return nextApplicants
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat pelamar.')

      set({
        applicants: [],
        isLoading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  fetchBeneficiaries: async ({ force = false } = {}) => {
    const { beneficiaries, isLoading } = get()

    if (!force && !isLoading && beneficiaries.length > 0) {
      return beneficiaries
    }

    set({ isLoading: true, error: null })

    try {
      const nextBeneficiaries = await loadBeneficiaries()

      set({
        beneficiaries: nextBeneficiaries,
        isLoading: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      })

      return nextBeneficiaries
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat penerima manfaat.')

      set({
        beneficiaries: [],
        isLoading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  fetchApplicantDocuments: async (applicantId) => {
    set({ isLoading: true, error: null })

    try {
      const documents = await loadApplicantDocuments(applicantId)

      set((state) => ({
        applicants: state.applicants.map((applicant) =>
          applicant.id === applicantId
            ? normalizeApplicantRow({
                ...applicant,
                documents,
              })
            : applicant
        ),
        isLoading: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      }))

      return documents
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memuat dokumen pelamar.')

      set({
        isLoading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  addApplicant: async (applicantData = {}) => {
    set({ isSubmitting: true, error: null })

    const createdFileAssets = []
    let insertedApplicantId = null

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const teamId = resolveTeamId(applicantData.team_id)
      const applicantName = normalizeText(
        applicantData.name ?? applicantData.nama_lengkap ?? applicantData.applicant_name
      )
      const position = normalizeText(
        applicantData.position ?? applicantData.posisi_dilamar
      )
      const status = normalizeApplicantStatus(applicantData.status_aplikasi)
      const notes = normalizeText(applicantData.notes ?? applicantData.catatan_hrd, null)

      if (!teamId) {
        throw new Error('Akses workspace tidak ditemukan.')
      }

      if (!applicantName) {
        throw new Error('Nama pelamar wajib diisi.')
      }

      if (!position) {
        throw new Error('Posisi pelamar wajib diisi.')
      }

      const { data: insertedApplicant, error } = await supabase
        .from('hrd_applicants')
        .insert({
          team_id: teamId,
          name: applicantName,
          nama_lengkap: applicantName,
          position,
          posisi_dilamar: position,
          status_aplikasi: status,
          notes,
          catatan_hrd: notes,
          email: normalizeText(applicantData.email, null),
          no_telepon: normalizeText(applicantData.no_telepon, null),
          jenis_kelamin: normalizeText(applicantData.jenis_kelamin, null),
          nik: normalizeText(applicantData.nik, null),
          no_kk: normalizeText(applicantData.no_kk, null),
          tempat_lahir: normalizeText(applicantData.tempat_lahir, null),
          tanggal_lahir: normalizeText(applicantData.tanggal_lahir, null),
          pendidikan_terakhir: normalizeText(applicantData.pendidikan_terakhir, null),
          nama_institusi_pendidikan: normalizeText(applicantData.nama_institusi_pendidikan, null),
          jurusan: normalizeText(applicantData.jurusan, null),
          sumber_lowongan: normalizeText(applicantData.sumber_lowongan, null),
          pengalaman_kerja: normalizeText(applicantData.pengalaman_kerja, null),
          skills: normalizeText(applicantData.skills, null),
          district: normalizeText(applicantData.district, null),
          sub_district: normalizeText(applicantData.sub_district, null),
          village: normalizeText(applicantData.village, null),
          hamlet: normalizeText(applicantData.hamlet, null),
          rt: normalizeText(applicantData.rt, null),
          rw: normalizeText(applicantData.rw, null),
          alamat_lengkap: normalizeText(applicantData.alamat_lengkap, null),
          alamat_domisili: normalizeText(applicantData.alamat_domisili, null),
          source_beneficiary_id: normalizeText(applicantData.source_beneficiary_id, null),
          updated_at: new Date().toISOString(),
        })
        .select(applicantSelectColumns)
        .single()

      if (error) {
        throw error
      }

      insertedApplicantId = insertedApplicant?.id ?? null

      if (!insertedApplicantId) {
        throw new Error('ID pelamar gagal dibuat.')
      }

      const documentInputs = Array.isArray(applicantData.documents)
        ? applicantData.documents
        : [
            applicantData.cvFile
              ? { file: applicantData.cvFile, documentType: 'cv' }
              : null,
            applicantData.ktpFile
              ? { file: applicantData.ktpFile, documentType: 'ktp' }
              : null,
          ].filter(Boolean)

      for (const documentInput of documentInputs) {
        if (!(documentInput?.file instanceof File)) {
          continue
        }

        const fileAsset = await uploadAndRegisterFile(documentInput.file, {
          team_id: teamId,
          bucket_name: 'hrd_documents',
          folder: `hrd-applicants/${insertedApplicantId}/${documentInput.documentType}`,
          uploaded_by: normalizeText(applicantData.uploaded_by, null),
        })

        createdFileAssets.push(fileAsset)

        const { error: documentError } = await supabase
          .from('hrd_applicant_documents')
          .insert({
            team_id: teamId,
            applicant_id: insertedApplicantId,
            file_asset_id: fileAsset.id,
            document_type: normalizeText(documentInput.documentType, 'other'),
          })

        if (documentError) {
          throw documentError
        }
      }

      const documents = await loadApplicantDocuments(insertedApplicantId)
      const nextApplicant = normalizeApplicantRow({
        ...insertedApplicant,
        documents,
      })

      set((state) => ({
        applicants: [nextApplicant, ...state.applicants].sort((a, b) =>
          String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
        ),
        isSubmitting: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      }))

      return nextApplicant
    } catch (error) {
      for (const fileAsset of createdFileAssets.reverse()) {
        if (fileAsset?.id) {
          await deleteFileAsset(fileAsset.id).catch(() => null)
        }
      }

      if (insertedApplicantId) {
        await softDeleteApplicantDocuments(insertedApplicantId).catch(() => null)
        await softDeleteRecord('hrd_applicants', insertedApplicantId).catch(() => null)
      }

      const normalizedError = toError(error, 'Gagal menyimpan pelamar.')

      set({
        isSubmitting: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  updateApplicant: async (applicantId, patch = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const normalizedApplicantId = normalizeText(applicantId)
      if (!normalizedApplicantId) {
        throw new Error('ID pelamar wajib diisi.')
      }

      const payload = {}

      if (patch.name !== undefined || patch.nama_lengkap !== undefined) {
        const value = normalizeText(patch.name ?? patch.nama_lengkap)
        if (!value) {
          throw new Error('Nama pelamar wajib diisi.')
        }
        payload.name = value
        payload.nama_lengkap = value
      }

      if (patch.position !== undefined || patch.posisi_dilamar !== undefined) {
        const value = normalizeText(patch.position ?? patch.posisi_dilamar)
        if (!value) {
          throw new Error('Posisi pelamar wajib diisi.')
        }
        payload.position = value
        payload.posisi_dilamar = value
      }

      if (patch.status_aplikasi !== undefined) {
        payload.status_aplikasi = normalizeApplicantStatus(patch.status_aplikasi)
      }

      if (patch.notes !== undefined || patch.catatan_hrd !== undefined) {
        const notes = normalizeText(patch.notes ?? patch.catatan_hrd, null)
        payload.notes = notes
        payload.catatan_hrd = notes
      }

      if (patch.email !== undefined) {
        payload.email = normalizeText(patch.email, null)
      }

      if (patch.no_telepon !== undefined) {
        payload.no_telepon = normalizeText(patch.no_telepon, null)
      }

      if (patch.jenis_kelamin !== undefined) {
        payload.jenis_kelamin = normalizeText(patch.jenis_kelamin, null)
      }

      if (patch.nik !== undefined) {
        payload.nik = normalizeText(patch.nik, null)
      }

      if (patch.no_kk !== undefined) {
        payload.no_kk = normalizeText(patch.no_kk, null)
      }

      if (patch.tempat_lahir !== undefined) {
        payload.tempat_lahir = normalizeText(patch.tempat_lahir, null)
      }

      if (patch.tanggal_lahir !== undefined) {
        payload.tanggal_lahir = normalizeText(patch.tanggal_lahir, null)
      }

      if (patch.pendidikan_terakhir !== undefined) {
        payload.pendidikan_terakhir = normalizeText(patch.pendidikan_terakhir, null)
      }

      if (patch.nama_institusi_pendidikan !== undefined) {
        payload.nama_institusi_pendidikan = normalizeText(patch.nama_institusi_pendidikan, null)
      }

      if (patch.jurusan !== undefined) {
        payload.jurusan = normalizeText(patch.jurusan, null)
      }

      if (patch.sumber_lowongan !== undefined) {
        payload.sumber_lowongan = normalizeText(patch.sumber_lowongan, null)
      }

      if (patch.pengalaman_kerja !== undefined) {
        payload.pengalaman_kerja = normalizeText(patch.pengalaman_kerja, null)
      }

      if (patch.skills !== undefined) {
        payload.skills = normalizeText(patch.skills, null)
      }

      if (patch.district !== undefined) {
        payload.district = normalizeText(patch.district, null)
      }

      if (patch.sub_district !== undefined) {
        payload.sub_district = normalizeText(patch.sub_district, null)
      }

      if (patch.village !== undefined) {
        payload.village = normalizeText(patch.village, null)
      }

      if (patch.hamlet !== undefined) {
        payload.hamlet = normalizeText(patch.hamlet, null)
      }

      if (patch.rt !== undefined) {
        payload.rt = normalizeText(patch.rt, null)
      }

      if (patch.rw !== undefined) {
        payload.rw = normalizeText(patch.rw, null)
      }

      if (patch.alamat_lengkap !== undefined) {
        payload.alamat_lengkap = normalizeText(patch.alamat_lengkap, null)
      }

      if (patch.alamat_domisili !== undefined) {
        payload.alamat_domisili = normalizeText(patch.alamat_domisili, null)
      }

      payload.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('hrd_applicants')
        .update(payload)
        .eq('id', normalizedApplicantId)
        .is('deleted_at', null)
        .select(applicantSelectColumns)
        .single()

      if (error) {
        throw error
      }

      const documents = await loadApplicantDocuments(normalizedApplicantId)
      const updatedApplicant = normalizeApplicantRow({
        ...data,
        documents,
      })

      set((state) => ({
        applicants: state.applicants
          .map((applicant) =>
            applicant.id === normalizedApplicantId ? updatedApplicant : applicant
          )
          .sort((a, b) =>
            String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
          ),
        isSubmitting: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      }))

      return updatedApplicant
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memperbarui pelamar.')

      set({
        isSubmitting: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  addApplicantDocument: async (applicantId, documentInput = {}, options = {}) => {
    set({ isSubmitting: true, error: null })

    let createdFileAssetId = null

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const normalizedApplicantId = normalizeText(applicantId)
      const documentType = normalizeText(documentInput.documentType, 'other')

      if (!normalizedApplicantId) {
        throw new Error('ID pelamar wajib diisi.')
      }

      if (!(documentInput.file instanceof File)) {
        throw new Error('File dokumen tidak valid.')
      }

      const { data: applicant, error: applicantError } = await supabase
        .from('hrd_applicants')
        .select('id, team_id')
        .eq('id', normalizedApplicantId)
        .is('deleted_at', null)
        .maybeSingle()

      if (applicantError) {
        throw applicantError
      }

      const teamId = resolveTeamId(options.team_id ?? applicant?.team_id)

      if (!teamId) {
        throw new Error('Akses workspace tidak ditemukan.')
      }

      const fileAsset = await uploadAndRegisterFile(documentInput.file, {
        team_id: teamId,
        bucket_name: 'hrd_documents',
        folder: `hrd-applicants/${normalizedApplicantId}/${documentType}`,
        uploaded_by: normalizeText(options.uploaded_by, null),
      })

      createdFileAssetId = fileAsset.id

      const { data, error } = await supabase
        .from('hrd_applicant_documents')
        .insert({
          team_id: teamId,
          applicant_id: normalizedApplicantId,
          file_asset_id: fileAsset.id,
          document_type: documentType,
        })
        .select(
          'id, team_id, applicant_id, file_asset_id, document_type, created_at, updated_at, deleted_at, file_assets:file_asset_id ( id, bucket_name, storage_path, file_name, public_url, mime_type, file_size, uploaded_by, created_at, updated_at, deleted_at )'
        )
        .single()

      if (error) {
        throw error
      }

      const nextDocument = normalizeApplicantDocumentRow(data)

      set((state) => ({
        applicants: state.applicants.map((applicantRow) => {
          if (applicantRow.id !== normalizedApplicantId) {
            return applicantRow
          }

          return normalizeApplicantRow({
            ...applicantRow,
            documents: [nextDocument, ...(applicantRow.documents ?? [])],
          })
        }),
        isSubmitting: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      }))

      return nextDocument
    } catch (error) {
      if (createdFileAssetId) {
        await deleteFileAsset(createdFileAssetId).catch(() => null)
      }

      const normalizedError = toError(error, 'Gagal menambahkan dokumen pelamar.')

      set({
        isSubmitting: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  deleteApplicantDocument: async (documentId) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const normalizedDocumentId = normalizeText(documentId)

      if (!normalizedDocumentId) {
        throw new Error('ID dokumen wajib diisi.')
      }

      const { data: document, error: documentError } = await supabase
        .from('hrd_applicant_documents')
        .select('id, applicant_id, file_asset_id')
        .eq('id', normalizedDocumentId)
        .is('deleted_at', null)
        .maybeSingle()

      if (documentError) {
        throw documentError
      }

      if (!document?.id) {
        set({ isSubmitting: false, error: null })
        return true
      }

      if (document.file_asset_id) {
        await deleteFileAsset(document.file_asset_id).catch(() => null)
      }

      await softDeleteApplicantDocument(normalizedDocumentId)

      set((state) => ({
        applicants: state.applicants.map((applicant) => {
          if (applicant.id !== document.applicant_id) {
            return applicant
          }

          return normalizeApplicantRow({
            ...applicant,
            documents: (applicant.documents ?? []).filter(
              (item) => item.id !== normalizedDocumentId
            ),
          })
        }),
        isSubmitting: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      }))

      return true
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menghapus dokumen pelamar.')

      set({
        isSubmitting: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  deleteApplicant: async (applicantId) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const normalizedApplicantId = normalizeText(applicantId)

      if (!normalizedApplicantId) {
        throw new Error('ID pelamar wajib diisi.')
      }

      const documents = await loadApplicantDocuments(normalizedApplicantId)

      for (const document of documents) {
        if (document?.file_asset_id) {
          await deleteFileAsset(document.file_asset_id).catch(() => null)
        }
      }

      await softDeleteApplicantDocuments(normalizedApplicantId)
      await softDeleteRecord('hrd_applicants', normalizedApplicantId)

      set((state) => ({
        applicants: state.applicants.filter(
          (applicant) => applicant.id !== normalizedApplicantId
        ),
        isSubmitting: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      }))

      return true
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menghapus pelamar.')

      set({
        isSubmitting: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  addBeneficiary: async (beneficiaryData = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const teamId = resolveTeamId(beneficiaryData.team_id)
      const name = normalizeText(
        beneficiaryData.name ?? beneficiaryData.nama_penerima ?? beneficiaryData.beneficiary_name
      )
      const nik = normalizeText(beneficiaryData.nik, null)
      const institution = normalizeText(
        beneficiaryData.institution ??
          beneficiaryData.nama_instansi ??
          beneficiaryData.instansi,
        null
      )
      const status = normalizeBeneficiaryStatus(beneficiaryData.status)
      const dataStatus = normalizeText(
        beneficiaryData.data_status ?? beneficiaryData.dataStatus,
        status
      )
      const notes = normalizeText(beneficiaryData.notes, null)

      if (!teamId) {
        throw new Error('Akses workspace tidak ditemukan.')
      }

      if (!name) {
        throw new Error('Nama penerima manfaat wajib diisi.')
      }

      const { data, error } = await supabase
        .from('beneficiaries')
        .insert({
          team_id: teamId,
          name,
          nama_penerima: name,
          nik,
          institution,
          nama_instansi: institution,
          jenis_kelamin: normalizeText(beneficiaryData.jenis_kelamin, null),
          jenjang: normalizeText(beneficiaryData.jenjang, null),
          npsn_nspp: normalizeText(beneficiaryData.npsn_nspp, null),
          jarak_meter: toNumber(beneficiaryData.jarak_meter),
          status,
          data_status: dataStatus,
          tempat_lahir: normalizeText(beneficiaryData.tempat_lahir, null),
          tanggal_lahir: normalizeText(beneficiaryData.tanggal_lahir, null),
          district: normalizeText(beneficiaryData.district, null),
          sub_district: normalizeText(beneficiaryData.sub_district, null),
          village: normalizeText(beneficiaryData.village, null),
          hamlet: normalizeText(beneficiaryData.hamlet, null),
          rt: normalizeText(beneficiaryData.rt, null),
          rw: normalizeText(beneficiaryData.rw, null),
          alamat_lengkap: normalizeText(beneficiaryData.alamat_lengkap, null),
          notes,
          updated_at: new Date().toISOString(),
        })
        .select(beneficiarySelectColumns)
        .single()

      if (error) {
        throw error
      }

      const nextBeneficiary = normalizeBeneficiaryRow(data)

      set((state) => ({
        beneficiaries: [nextBeneficiary, ...state.beneficiaries].sort((a, b) =>
          String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
        ),
        isSubmitting: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      }))

      return nextBeneficiary
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menyimpan penerima manfaat.')

      set({
        isSubmitting: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  updateBeneficiary: async (beneficiaryId, patch = {}) => {
    set({ isSubmitting: true, error: null })

    try {
      if (!supabase) {
        throw new Error('Client Supabase belum dikonfigurasi.')
      }

      const normalizedBeneficiaryId = normalizeText(beneficiaryId)

      if (!normalizedBeneficiaryId) {
        throw new Error('ID penerima manfaat wajib diisi.')
      }

      const payload = {}

      if (patch.name !== undefined || patch.nama_penerima !== undefined) {
        const value = normalizeText(patch.name ?? patch.nama_penerima)
        if (!value) {
          throw new Error('Nama penerima manfaat wajib diisi.')
        }
        payload.name = value
        payload.nama_penerima = value
      }

      if (patch.nik !== undefined) {
        payload.nik = normalizeText(patch.nik, null)
      }

      if (patch.institution !== undefined || patch.nama_instansi !== undefined) {
        const institution = normalizeText(
          patch.institution ?? patch.nama_instansi,
          null
        )
        payload.institution = institution
        payload.nama_instansi = institution
      }

      if (patch.status !== undefined) {
        const status = normalizeBeneficiaryStatus(patch.status)
        payload.status = status
      }

      if (patch.data_status !== undefined || patch.dataStatus !== undefined) {
        payload.data_status = normalizeText(patch.data_status ?? patch.dataStatus, null)
      }

      if (patch.jenis_kelamin !== undefined) {
        payload.jenis_kelamin = normalizeText(patch.jenis_kelamin, null)
      }

      if (patch.jenjang !== undefined) {
        payload.jenjang = normalizeText(patch.jenjang, null)
      }

      if (patch.npsn_nspp !== undefined) {
        payload.npsn_nspp = normalizeText(patch.npsn_nspp, null)
      }

      if (patch.jarak_meter !== undefined) {
        payload.jarak_meter = toNumber(patch.jarak_meter)
      }

      if (patch.tempat_lahir !== undefined) {
        payload.tempat_lahir = normalizeText(patch.tempat_lahir, null)
      }

      if (patch.tanggal_lahir !== undefined) {
        payload.tanggal_lahir = normalizeText(patch.tanggal_lahir, null)
      }

      if (patch.district !== undefined) {
        payload.district = normalizeText(patch.district, null)
      }

      if (patch.sub_district !== undefined) {
        payload.sub_district = normalizeText(patch.sub_district, null)
      }

      if (patch.village !== undefined) {
        payload.village = normalizeText(patch.village, null)
      }

      if (patch.hamlet !== undefined) {
        payload.hamlet = normalizeText(patch.hamlet, null)
      }

      if (patch.rt !== undefined) {
        payload.rt = normalizeText(patch.rt, null)
      }

      if (patch.rw !== undefined) {
        payload.rw = normalizeText(patch.rw, null)
      }

      if (patch.alamat_lengkap !== undefined) {
        payload.alamat_lengkap = normalizeText(patch.alamat_lengkap, null)
      }

      if (patch.notes !== undefined) {
        payload.notes = normalizeText(patch.notes, null)
      }

      payload.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('beneficiaries')
        .update(payload)
        .eq('id', normalizedBeneficiaryId)
        .is('deleted_at', null)
        .select(beneficiarySelectColumns)
        .single()

      if (error) {
        throw error
      }

      const updatedBeneficiary = normalizeBeneficiaryRow(data)

      set((state) => ({
        beneficiaries: state.beneficiaries
          .map((beneficiary) =>
            beneficiary.id === normalizedBeneficiaryId
              ? updatedBeneficiary
              : beneficiary
          )
          .sort((a, b) =>
            String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
          ),
        isSubmitting: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      }))

      return updatedBeneficiary
    } catch (error) {
      const normalizedError = toError(error, 'Gagal memperbarui penerima manfaat.')

      set({
        isSubmitting: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  deleteBeneficiary: async (beneficiaryId) => {
    set({ isSubmitting: true, error: null })

    try {
      const normalizedBeneficiaryId = normalizeText(beneficiaryId)

      if (!normalizedBeneficiaryId) {
        throw new Error('ID penerima manfaat wajib diisi.')
      }

      await softDeleteRecord('beneficiaries', normalizedBeneficiaryId)

      set((state) => ({
        beneficiaries: state.beneficiaries.filter(
          (beneficiary) => beneficiary.id !== normalizedBeneficiaryId
        ),
        isSubmitting: false,
        error: null,
        lastUpdatedAt: new Date().toISOString(),
      }))

      return true
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menghapus penerima manfaat.')

      set({
        isSubmitting: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
}))

export default useHrStore
export { applicantStatusOptions, beneficiaryStatusOptions, useHrStore }
