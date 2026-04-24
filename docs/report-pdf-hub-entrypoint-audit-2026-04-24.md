# Report PDF Hub Entrypoint Audit - 2026-04-24

## Status

Dokumen ini adalah hasil batch audit + planning saja.

- Tidak ada perubahan runtime.
- Tidak ada route baru yang dibuat pada batch ini.
- Tidak ada migration, dependency, atau kontrak API baru.
- Keputusan user yang sudah dikunci:
  - canonical route target berikutnya adalah `/reports`;
  - `/projects` tetap menjadi alias/compatibility path sementara;
  - PDF generation memakai pola on-demand hybrid;
  - batch pertama berhenti di audit + plan rinci sebelum implementasi kode.

## Repo Truth Aktual

| Area | Entrypoint aktual | Evidence repo | Catatan |
| --- | --- | --- | --- |
| Route report hub | `/projects` | `src/App.jsx`, `src/pages/ProjectsPage.jsx` | `/projects` masih menjadi rumah aktual `ProjectReport` + pengaturan PDF. |
| Alias PDF settings | `/projects/pdf-settings` | `src/App.jsx`, `src/pages/ProjectPdfSettingsPage.jsx` | Route ini redirect ke `/projects#pdf-settings`; tidak punya surface terpisah lagi. |
| UI laporan | `ProjectReport` | `src/components/ProjectReport.jsx` | Tab report sudah mencakup `Umum`, `Proyek`, `Kas`, `Kreditur`, `Supplier`, dan `Pekerja`. |
| Browser PDF download | Tombol `Unduh PDF` | `src/components/ProjectReport.jsx`, `src/store/useReportStore.js`, `src/lib/report-pdf.js` | Download browser memakai data report yang sudah dimuat atau fetch fresh, lalu generator `jsPDF`. |
| Telegram Mini Web fallback | Tombol `Kirim ke DM` | `src/components/ProjectReport.jsx`, `src/store/useReportStore.js`, `api/report-pdf-delivery.js` | Fallback DM server-side memakai generator PDF yang sama dan mengirim dokumen ke user Telegram terverifikasi. |
| Data report | `/api/records?resource=reports` | `src/lib/reports-api.js`, `api/records.js` | UI tidak menghitung agregat finansial liar di client; data utama berasal dari API report. |
| Statement pihak | `reportKind=party_statement` | `api/records.js`, `tests/unit/party-statement.test.js` | Contract backend sudah mendukung `creditor`, `supplier`, dan `worker`. |
| PDF settings | `pdf_settings` | `src/pages/ProjectPdfSettingsPage.jsx`, `api/records.js` | Settings adalah konfigurasi branding, bukan source of truth transaksi atau settlement. |
| Smoke proof | PDF `%PDF-` | `tests/e2e/report.spec.js`, `tests/live/report-pdf-delivery.spec.js` | Browser download dan trigger DM sudah punya lane test khusus. |

Temuan utama: fitur yang diminta bukan blank slate. Yang belum ada adalah canonical route `/reports` dan pemisahan naming arsitektural dari konsep `Unit Kerja` ke `Pelaporan`.

## Target Arsitektur

Target aman untuk implementasi lanjutan:

1. Buat `/reports` sebagai route canonical untuk report hub.
2. Pertahankan `/projects` sebagai compatibility alias selama transisi.
3. Pertahankan `/projects/pdf-settings` sebagai alias ke section settings di route canonical.
4. Jangan membuat route per laporan dulu; satu hub tabbed mengurangi duplikasi state filter, PDF settings, test, dan risiko drift.
5. Jangan menyimpan PDF sebagai artefak permanen pada v1; PDF tetap output turunan yang bisa diregenerate dari source data.

Target route setelah implementasi lanjutan:

| Route | Target behavior |
| --- | --- |
| `/reports` | Report hub canonical: semua tab laporan + PDF settings. |
| `/reports#pdf-settings` | Anchor canonical untuk pengaturan branding PDF. |
| `/projects` | Alias kompatibilitas ke report hub sampai semua entrypoint UI dipindahkan. |
| `/projects#pdf-settings` | Alias kompatibilitas ke settings canonical. |
| `/projects/pdf-settings` | Alias kompatibilitas lama ke settings canonical. |

## Data Flow Target

Data flow report harus tetap satu arah:

1. UI memilih `reportKind`, periode, `projectId`, atau `partyId`.
2. `useReportStore` membentuk query key yang mencakup kind + filter.
3. `src/lib/reports-api.js` memanggil `/api/records?resource=reports`.
4. `api/records.js` membangun report dari server truth:
   - `executive_finance` dari summary proyek, cash mutation, billing stats;
   - `project_pl` dari detail proyek dan relasi transaksi;
   - `cash_flow` dari mutasi kas;
   - `party_statement` dari ledger `creditor`, `supplier`, atau `worker`.
5. `src/lib/report-pdf.js` merender PDF dari payload report final.
6. Browser download atau Telegram DM delivery hanya transport output, bukan sumber data baru.

## Format PDF Profesional

Format PDF report yang harus dipertahankan atau dijadikan acceptance criteria:

- Header: logo/nama perusahaan, judul laporan, periode, party/project terpilih, dan timestamp generate.
- Summary: KPI utama di bagian atas; untuk statement pihak wajib memuat saldo awal, debit, kredit, dan saldo akhir.
- Detail ledger: tabel tanggal, sumber, keterangan, debit, kredit, saldo.
- Pagination: header tabel berulang, footer nomor halaman, dan timestamp generate.
- Filename: spesifik report kind dan entity, misalnya `laporan-hutang-supplier-<nama>-<tanggal>.pdf`.
- Empty state: PDF tetap valid bila tidak ada row, tetapi tidak boleh bisa diunduh bila filter wajib belum dipilih.
- Bahasa: label business-facing, bukan nama tabel atau field mentah.

## Keamanan dan Skalabilitas

Guard jangka panjang yang harus masuk sebelum dataset besar:

- Semua query report wajib tetap punya filter eksplisit: team/session dari auth context, periode, dan party/project bila report kind membutuhkannya.
- Audit index diperlukan untuk kolom filter report besar: `team_id`, `deleted_at`, tanggal transaksi, `supplier_id`, `worker_id`, `creditor_id`, `bill_id`, dan `loan_id`.
- View yang diekspos harus tetap `security_invoker` atau dilindungi dari bypass RLS.
- Text user seperti nama, notes, dan deskripsi harus dinormalisasi/sanitized sebelum masuk PDF.
- Browser PDF tetap aman untuk laporan kecil/menengah; untuk payload besar, fallback harus server-side atau job-based agar tidak menabrak batas payload/runtime platform.
- Storage arsip PDF hanya boleh ditambahkan bila ada requirement audit/legal eksplisit, lengkap dengan private bucket, retention, dan access-control.

Referensi eksternal yang dipakai untuk arah teknis:

- Supabase RLS dan performance: https://supabase.com/docs/guides/database/postgres/row-level-security
- Vercel Functions limits: https://vercel.com/docs/functions/limitations
- jsPDF usage/security note: https://github.com/parallax/jsPDF
- jsPDF-AutoTable pagination/table options: https://github.com/simonbengtsson/jsPDF-AutoTable

## Risiko Aktual

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| `/projects` masih menjadi nama route report | Naming UX/arsitektur bisa membingungkan karena report tidak hanya Unit Kerja | Pindahkan canonical ke `/reports`, simpan alias lama. |
| PDF browser untuk dataset besar | Memory/browser freeze atau file gagal dibuat | Tambah guard row/period, lalu fallback server-side/job jika diperlukan. |
| Payload DM mengirim `reportData` dari client | Payload besar bisa terkena batas request platform | Untuk fase besar, endpoint server perlu regenerate by query/filter, bukan menerima full rows. |
| Index report belum diaudit khusus dataset besar | Query report party statement bisa melambat saat data membesar | Buat micro-task audit query plan/index sebelum guard dataset besar. |
| Route alias terlalu cepat dihapus | Deep link lama, bot link, dan smoke bisa putus | Jangan hapus `/projects` dan `/projects/pdf-settings` pada fase route awal. |

## Micro-task Lanjutan

1. `UCW-356` - Tambahkan canonical route `/reports` tanpa mengubah generator PDF.
   - Scope: `src/App.jsx`, page wrapper report, navigasi yang menunjuk report hub, docs/progress.
   - Acceptance: `/reports` membuka report hub yang sama; `/projects` dan `/projects/pdf-settings` tetap kompatibel.

2. `UCW-357` - Selaraskan naming UI report hub dari `Unit Kerja` ke `Pelaporan`.
   - Scope: page header/navigasi yang relevan, tanpa mengubah data flow.
   - Acceptance: istilah route/report tidak lagi memberi kesan laporan hanya milik proyek.

3. `UCW-358` - Audit scalability query/index untuk party statement.
   - Scope: read-only SQL/API audit, migration hanya jika audit membuktikan index kurang.
   - Acceptance: rekomendasi index berbasis query aktual, bukan asumsi.

4. `UCW-359` - Tambahkan smoke PDF party statement.
   - Scope: Playwright report spec atau helper mock report.
   - Acceptance: Kreditur/Supplier/Pekerja bisa download PDF valid dengan proof `%PDF-` dan filename sesuai kind.

5. `UCW-360` - Hardening payload besar untuk server-side PDF fallback.
   - Scope: `api/report-pdf-delivery.js`, `src/lib/report-delivery-api.js`, `useReportStore`.
   - Acceptance: endpoint bisa regenerate dari query/filter saat payload row terlalu besar, tanpa menerima full report rows dari client.

## Validation Scope Untuk Batch Ini

Karena batch ini docs-only:

- Validasi cukup `git diff --check`.
- Tidak perlu `npm run lint` atau `npm run build` karena tidak ada runtime code yang berubah.
- Jika implementasi route/PDF dilanjutkan pada micro-task berikutnya, validasi minimal harus naik ke `npm run lint`, `npm run build`, dan targeted Playwright report PDF.
