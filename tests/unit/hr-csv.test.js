import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createHrCsvTemplateText,
  importApplicantCsvRows,
  importBeneficiaryCsvRows,
  parseCsvPreview,
  parseCsvRows,
} from '../../src/lib/hr-csv.js'

test('HR CSV templates expose the expected headers', () => {
  assert.equal(
    createHrCsvTemplateText('applicant'),
    'name,position,status_aplikasi,email,no_telepon,nik,no_kk,jenis_kelamin,tempat_lahir,tanggal_lahir,pendidikan_terakhir,nama_institusi_pendidikan,jurusan,sumber_lowongan,pengalaman_kerja,skills,alamat_lengkap,alamat_domisili,notes'
  )

  assert.equal(
    createHrCsvTemplateText('beneficiary'),
    'name,institution,status,data_status,nik,jenis_kelamin,jenjang,npsn_nspp,jarak_meter,tempat_lahir,tanggal_lahir,district,sub_district,village,hamlet,rt,rw,alamat_lengkap,notes'
  )
})

test('CSV parser accepts quoted commas and maps template headers', () => {
  const rows = parseCsvRows('Nama,Posisi\n"Rina, Sari",Admin')

  assert.deepEqual(rows, [
    ['Nama', 'Posisi'],
    ['Rina, Sari', 'Admin'],
  ])

  const preview = parseCsvPreview('applicant', 'Nama,Posisi\n"Rina, Sari",Admin')

  assert.equal(preview.rows.length, 1)
  assert.equal(preview.rows[0].status, 'valid')
  assert.equal(preview.rows[0].title, 'Rina, Sari')
  assert.equal(preview.rows[0].record.name, 'Rina, Sari')
  assert.equal(preview.rows[0].record.position, 'Admin')
})

test('CSV parser marks blank rows as skipped', () => {
  const preview = parseCsvPreview('beneficiary', 'Nama,Instansi\n\nAyu,SDN 01')

  assert.equal(preview.summary.skipped, 1)
  assert.equal(preview.rows[0].status, 'skip')
  assert.equal(preview.rows[1].status, 'valid')
})

test('CSV parser marks missing required fields as errors', () => {
  const preview = parseCsvPreview('applicant', 'Nama,Posisi\nRina,')

  assert.equal(preview.rows[0].status, 'error')
  assert.ok(preview.rows[0].issues.includes('Posisi wajib diisi'))
})

test('CSV parser rejects malformed quoted rows', () => {
  assert.throws(() => parseCsvRows('Nama,Posisi\n"Rina,Admin'), /Format CSV tidak valid\./)
})

test('beneficiary import skips duplicate NIK rows', async () => {
  const preview = parseCsvPreview(
    'beneficiary',
    'Nama,Instansi,NIK\nAyu,SDN 01,123\nBimo,SDN 02,123\nCici,SDN 03,456'
  )
  const savedRows = []

  const result = await importBeneficiaryCsvRows({
    existingNiks: ['456'],
    previewRows: preview.rows,
    saveBeneficiary: async (record) => {
      savedRows.push(record)
      return record
    },
  })

  assert.equal(result.summary.saved, 1)
  assert.equal(result.summary.skipped, 2)
  assert.equal(result.summary.error, 0)
  assert.equal(savedRows.length, 1)
  assert.equal(savedRows[0].name, 'Ayu')
  assert.equal(result.rows[1].status, 'skip')
  assert.equal(result.rows[2].status, 'skip')
})

test('applicant import skips duplicate NIK and fallback contact rows', async () => {
  const preview = parseCsvPreview(
    'applicant',
    [
      'Nama,Posisi,NIK,Email,Telepon',
      'Ayu,Admin,123,ayu@example.com,081',
      'Bimo,Admin,123,bimo@example.com,082',
      'Cici,Admin,,existing@example.com,083',
      'Dewi,Admin,,dewi@example.com,090',
      'Eka,Admin,,eka@example.com,084',
      'Fani,Admin,,eka@example.com,085',
      'Gita,Admin,,gita@example.com,090',
    ].join('\n')
  )
  const savedRows = []

  const result = await importApplicantCsvRows({
    existingApplicants: [
      {
        nik: '999',
        email: 'existing@example.com',
      },
    ],
    previewRows: preview.rows,
    saveApplicant: async (record) => {
      savedRows.push(record)
      return record
    },
  })

  assert.equal(result.summary.saved, 3)
  assert.equal(result.summary.skipped, 4)
  assert.equal(result.summary.error, 0)
  assert.equal(savedRows.length, 3)
  assert.equal(savedRows[0].name, 'Ayu')
  assert.equal(savedRows[1].name, 'Dewi')
  assert.equal(savedRows[2].name, 'Eka')
  assert.equal(result.rows[1].status, 'skip')
  assert.equal(result.rows[2].status, 'skip')
  assert.equal(result.rows[3].status, 'valid')
  assert.equal(result.rows[5].status, 'skip')
  assert.equal(result.rows[6].status, 'skip')
})
