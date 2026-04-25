function normalizeText(value, fallback = '') {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function normalizeHeaderName(value) {
  return normalizeText(value, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function escapeCsvCell(value) {
  const normalizedValue = normalizeText(value, '')

  if (/[",\r\n]/.test(normalizedValue)) {
    return `"${normalizedValue.replace(/"/g, '""')}"`
  }

  return normalizedValue
}

function serializeCsvRows(rows) {
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')
}

function parseCsvRows(csvText) {
  const normalizedText = String(csvText ?? '').replace(/^\uFEFF/, '')

  if (normalizedText.length === 0) {
    return []
  }

  const rows = []
  let currentRow = []
  let currentCell = ''
  let inQuotes = false

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index]

    if (inQuotes) {
      if (character === '"') {
        if (normalizedText[index + 1] === '"') {
          currentCell += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        currentCell += character
      }

      continue
    }

    if (character === '"') {
      if (currentCell.length === 0) {
        inQuotes = true
      } else {
        currentCell += character
      }

      continue
    }

    if (character === ',') {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if (character === '\r' || character === '\n') {
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''

      if (character === '\r' && normalizedText[index + 1] === '\n') {
        index += 1
      }

      continue
    }

    currentCell += character
  }

  if (inQuotes) {
    throw new Error('Format CSV tidak valid.')
  }

  if (currentRow.length > 0 || currentCell.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }

  return rows
}

function createColumnIndexMap(schema, headerRow) {
  const headerLookup = headerRow.reduce((accumulator, headerValue, index) => {
    const normalizedHeader = normalizeHeaderName(headerValue)

    if (normalizedHeader && accumulator[normalizedHeader] === undefined) {
      accumulator[normalizedHeader] = index
    }

    return accumulator
  }, {})

  return schema.columns.reduce((accumulator, column) => {
    const columnAliases = [column.key, column.label, ...(column.aliases ?? [])]
      .map(normalizeHeaderName)
      .filter(Boolean)

    const matchedIndex = columnAliases
      .map((alias) => headerLookup[alias])
      .find((index) => index !== undefined)

    if (matchedIndex !== undefined) {
      accumulator[column.key] = matchedIndex
    }

    return accumulator
  }, {})
}

function getPreviewTitle(schema, record, rowNumber) {
  return schema.previewTitle?.(record, rowNumber) ?? `Baris ${rowNumber}`
}

function getPreviewDescription(schema, record, rowNumber) {
  return schema.previewDescription?.(record, rowNumber) ?? null
}

function buildPreviewRow(schema, headerRow, rowCells, rowNumber, columnIndexMap) {
  const record = schema.columns.reduce((accumulator, column) => {
    const cellIndex = columnIndexMap[column.key]
    const cellValue = cellIndex === undefined ? '' : normalizeText(rowCells[cellIndex], '')

    accumulator[column.key] = cellValue
    return accumulator
  }, {})

  const hasMappedValue = Object.values(record).some((value) => normalizeText(value, '').length > 0)
  const hasRawValue = rowCells.some((value) => normalizeText(value, '').length > 0)

  if (!hasRawValue) {
    return {
      rowNumber,
      status: 'skip',
      record,
      issues: ['Baris kosong'],
      title: `Baris ${rowNumber}`,
      description: 'Baris kosong',
    }
  }

  const issues = []

  if (rowCells.length > headerRow.length) {
    issues.push('Kolom berlebih')
  }

  if (!hasMappedValue) {
    issues.push('Kolom template tidak dikenali')
  }

  for (const column of schema.columns) {
    if (column.required && normalizeText(record[column.key], '').length === 0) {
      issues.push(`${column.label} wajib diisi`)
    }
  }

  const status = issues.length > 0 ? 'error' : 'valid'

  return {
    rowNumber,
    status,
    record,
    issues,
    title: getPreviewTitle(schema, record, rowNumber),
    description:
      status === 'error'
        ? issues.join(' | ')
        : normalizeText(getPreviewDescription(schema, record, rowNumber), null),
  }
}

function parseCsvPreview(schemaKey, csvText) {
  const schema = getHrCsvSchema(schemaKey)
  const rows = parseCsvRows(csvText)

  if (rows.length === 0) {
    return {
      schemaKey: schema.key,
      headers: [],
      rows: [],
      summary: {
        total: 0,
        valid: 0,
        skipped: 0,
        error: 0,
      },
    }
  }

  const [headerRow, ...dataRows] = rows
  const columnIndexMap = createColumnIndexMap(schema, headerRow)
  const previewRows = dataRows.map((rowCells, index) =>
    buildPreviewRow(schema, headerRow, rowCells, index + 2, columnIndexMap)
  )

  const summary = previewRows.reduce(
    (accumulator, row) => {
      accumulator.total += 1
      const summaryKey = row.status === 'skip' ? 'skipped' : row.status

      accumulator[summaryKey] += 1
      return accumulator
    },
    {
      total: 0,
      valid: 0,
      skipped: 0,
      error: 0,
    }
  )

  return {
    schemaKey: schema.key,
    headers: headerRow.map((header) => normalizeHeaderName(header)),
    rows: previewRows,
    summary,
  }
}

const hrCsvSchemas = {
  applicant: {
    key: 'applicant',
    label: 'HRD',
    sheetTitle: 'Impor CSV HRD',
    templateFileName: 'template-hrd.csv',
    columns: [
      { key: 'name', label: 'Nama', required: true, aliases: ['nama_lengkap', 'nama', 'pelamar'] },
      { key: 'position', label: 'Posisi', required: true, aliases: ['posisi_dilamar', 'posisi', 'jabatan'] },
      { key: 'status_aplikasi', label: 'Status Aplikasi', aliases: ['status', 'status_aplikasi'] },
      { key: 'email', label: 'Email' },
      { key: 'no_telepon', label: 'Telepon', aliases: ['telepon'] },
      { key: 'nik', label: 'NIK' },
      { key: 'no_kk', label: 'No KK', aliases: ['no_kk', 'nokk'] },
      { key: 'jenis_kelamin', label: 'Jenis Kelamin' },
      { key: 'tempat_lahir', label: 'Tempat Lahir' },
      { key: 'tanggal_lahir', label: 'Tanggal Lahir' },
      { key: 'pendidikan_terakhir', label: 'Pendidikan Terakhir' },
      { key: 'nama_institusi_pendidikan', label: 'Institusi Pendidikan' },
      { key: 'jurusan', label: 'Jurusan' },
      { key: 'sumber_lowongan', label: 'Sumber Lowongan' },
      { key: 'pengalaman_kerja', label: 'Pengalaman Kerja' },
      { key: 'skills', label: 'Skills' },
      { key: 'alamat_lengkap', label: 'Alamat Lengkap' },
      { key: 'alamat_domisili', label: 'Alamat Domisili' },
      { key: 'notes', label: 'Catatan', aliases: ['catatan_hrd'] },
    ],
    previewTitle: (record, rowNumber) => normalizeText(record.name, `Baris ${rowNumber}`),
    previewDescription: (record) => normalizeText(record.position, 'Posisi belum diisi'),
  },
  beneficiary: {
    key: 'beneficiary',
    label: 'Penerima',
    sheetTitle: 'Impor CSV Penerima',
    templateFileName: 'template-penerima.csv',
    columns: [
      { key: 'name', label: 'Nama', required: true, aliases: ['nama_penerima', 'nama', 'penerima'] },
      { key: 'institution', label: 'Instansi', required: true, aliases: ['nama_instansi', 'instansi'] },
      { key: 'status', label: 'Status', aliases: ['status'] },
      { key: 'data_status', label: 'Status Data', aliases: ['data_status', 'dataStatus'] },
      { key: 'nik', label: 'NIK' },
      { key: 'jenis_kelamin', label: 'Jenis Kelamin' },
      { key: 'jenjang', label: 'Jenjang' },
      { key: 'npsn_nspp', label: 'NPSN/NSPP' },
      { key: 'jarak_meter', label: 'Jarak Meter' },
      { key: 'tempat_lahir', label: 'Tempat Lahir' },
      { key: 'tanggal_lahir', label: 'Tanggal Lahir' },
      { key: 'district', label: 'District' },
      { key: 'sub_district', label: 'Sub District' },
      { key: 'village', label: 'Village' },
      { key: 'hamlet', label: 'Hamlet' },
      { key: 'rt', label: 'RT' },
      { key: 'rw', label: 'RW' },
      { key: 'alamat_lengkap', label: 'Alamat Lengkap' },
      { key: 'notes', label: 'Catatan' },
    ],
    previewTitle: (record, rowNumber) => normalizeText(record.name, `Baris ${rowNumber}`),
    previewDescription: (record) => normalizeText(record.institution, 'Instansi belum diisi'),
  },
}

function getHrCsvSchema(kind) {
  const schema = hrCsvSchemas[kind]

  if (!schema) {
    throw new Error('Skema CSV tidak dikenal.')
  }

  return schema
}

function createHrCsvTemplateText(kind) {
  const schema = getHrCsvSchema(kind)

  return serializeCsvRows([schema.columns.map((column) => column.key)])
}

function downloadHrCsvTemplate(kind) {
  const schema = getHrCsvSchema(kind)

  if (typeof document === 'undefined') {
    return
  }

  const csvText = createHrCsvTemplateText(kind)
  const csvBlob = new Blob([csvText], { type: 'text/csv;charset=utf-8' })
  const csvUrl = URL.createObjectURL(csvBlob)
  const anchor = document.createElement('a')

  anchor.href = csvUrl
  anchor.download = schema.templateFileName
  anchor.rel = 'noreferrer'
  anchor.style.display = 'none'

  document.body.appendChild(anchor)
  anchor.click()

  window.setTimeout(() => {
    URL.revokeObjectURL(csvUrl)
    anchor.remove()
  }, 0)
}

function getApplicantImportDedupKeys(applicant = {}, { includeContactKeys = false } = {}) {
  const nik = normalizeText(applicant.nik, '')
  const email = normalizeText(applicant.email, '').toLowerCase()
  const noTelepon = normalizeText(applicant.no_telepon, '')
  const keys = []

  if (nik) {
    keys.push(`nik:${nik}`)
  }

  if (includeContactKeys || !nik) {
    if (email) {
      keys.push(`email:${email}`)
    }

    if (noTelepon) {
      keys.push(`no_telepon:${noTelepon}`)
    }
  }

  return keys
}

function getApplicantDuplicateLabel(dedupKey) {
  if (dedupKey.startsWith('nik:')) {
    return 'NIK'
  }

  if (dedupKey.startsWith('email:')) {
    return 'email'
  }

  if (dedupKey.startsWith('no_telepon:')) {
    return 'telepon'
  }

  return 'data pelamar'
}

async function importApplicantCsvRows({
  existingApplicants = [],
  previewRows = [],
  saveApplicant,
}) {
  if (typeof saveApplicant !== 'function') {
    throw new Error('Fungsi penyimpanan pelamar wajib tersedia.')
  }

  const seenKeys = new Set(
    existingApplicants.flatMap((applicant) =>
      getApplicantImportDedupKeys(applicant, { includeContactKeys: true })
    )
  )
  const rows = []
  let saved = 0
  let skipped = 0
  let error = 0

  for (const previewRow of previewRows) {
    if (previewRow.status === 'skip') {
      skipped += 1
      rows.push(previewRow)
      continue
    }

    if (previewRow.status === 'error') {
      error += 1
      rows.push(previewRow)
      continue
    }

    const rowKeys = getApplicantImportDedupKeys(previewRow.record)
    const duplicateKey = rowKeys.find((key) => seenKeys.has(key))

    if (duplicateKey) {
      skipped += 1
      rows.push({
        ...previewRow,
        status: 'skip',
        description: `Duplikat ${getApplicantDuplicateLabel(duplicateKey)}${duplicateKey.includes(':') ? `: ${duplicateKey.slice(duplicateKey.indexOf(':') + 1)}` : ''}`,
      })
      continue
    }

    try {
      await saveApplicant(previewRow.record)

      rowKeys.forEach((key) => seenKeys.add(key))

      saved += 1
      rows.push(previewRow)
    } catch (saveError) {
      error += 1
      rows.push({
        ...previewRow,
        status: 'error',
        issues: [saveError instanceof Error ? saveError.message : 'Gagal menyimpan pelamar.'],
        description: saveError instanceof Error ? saveError.message : 'Gagal menyimpan pelamar.',
      })
    }
  }

  return {
    rows,
    summary: {
      total: previewRows.length,
      saved,
      skipped,
      error,
    },
  }
}

async function importBeneficiaryCsvRows({
  existingNiks = [],
  previewRows = [],
  saveBeneficiary,
}) {
  if (typeof saveBeneficiary !== 'function') {
    throw new Error('Fungsi penyimpanan penerima wajib tersedia.')
  }

  const seenNiks = new Set(
    existingNiks.map((nik) => normalizeText(nik, '')).filter(Boolean)
  )
  const rows = []
  let saved = 0
  let skipped = 0
  let error = 0

  for (const previewRow of previewRows) {
    if (previewRow.status === 'skip') {
      skipped += 1
      rows.push(previewRow)
      continue
    }

    if (previewRow.status === 'error') {
      error += 1
      rows.push(previewRow)
      continue
    }

    const nik = normalizeText(previewRow.record?.nik, '')

    if (nik && seenNiks.has(nik)) {
      skipped += 1
      rows.push({
        ...previewRow,
        status: 'skip',
        description: `Duplikat NIK${nik ? `: ${nik}` : ''}`,
      })
      continue
    }

    try {
      await saveBeneficiary(previewRow.record)

      if (nik) {
        seenNiks.add(nik)
      }

      saved += 1
      rows.push(previewRow)
    } catch (saveError) {
      error += 1
      rows.push({
        ...previewRow,
        status: 'error',
        issues: [saveError instanceof Error ? saveError.message : 'Gagal menyimpan penerima manfaat.'],
        description: saveError instanceof Error ? saveError.message : 'Gagal menyimpan penerima manfaat.',
      })
    }
  }

  return {
    rows,
    summary: {
      total: previewRows.length,
      saved,
      skipped,
      error,
    },
  }
}

export {
  createHrCsvTemplateText,
  downloadHrCsvTemplate,
  getHrCsvSchema,
  importApplicantCsvRows,
  importBeneficiaryCsvRows,
  parseCsvPreview,
  parseCsvRows,
}
