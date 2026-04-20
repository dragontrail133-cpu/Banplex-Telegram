# Integration Readiness Plan

Plan date: `2026-04-17`  
Repository: `Banplex Greenfield`  
Input utama:
- `system-audit-schema-migration-plan-2026-04-10.md`
- `docs/implementation-continuation-plan-2026-04-17.md`
- kondisi repo aktual pada `src/`, `api/`, dan `supabase/migrations/`

## Tujuan

Dokumen ini memadankan audit schema lama dengan implementasi repo saat ini untuk menentukan urutan kerja yang paling aman sebelum masuk ke:

1. `UI Polish Optimization`
2. `AQ`
3. `QC`
4. `Production`

Fokus dokumen ini adalah **menutup gap integrasi**, bukan menambah polish visual atau cleanup umum.

## Ringkasan Padanan Audit vs Repo Saat Ini

| Domain audit | Bukti di repo saat ini | Status | Gap integrasi aktual |
| --- | --- | --- | --- |
| Auth Telegram + Supabase + tenancy | `api/auth.js`, `src/store/useAuthStore.js`, migrasi `20260411190000_*`, `20260411233000_*` | Sebagian besar sudah terimplementasi | Perlu regression checklist untuk bootstrap session, owner bypass, redeem invite, dan role gating UI |
| Source of truth transaksi inti | `src/components/TransactionForm.jsx`, `src/store/useTransactionStore.js`, `src/components/IncomeForm.jsx`, `src/store/useIncomeStore.js`, `src/components/MaterialInvoiceForm.jsx` | Legacy host inert + relasional | `TransactionForm` sekarang host inert/compatibility-only; income/material/loan sudah menulis ke tabel relasional |
| Dashboard dan daftar mutasi | `src/store/useDashboardStore.js`, `src/pages/Dashboard.jsx`, `src/pages/TransactionsPage.jsx` | Campuran | KPI kas masih dari `vw_transaction_summary` dan daftar cepat masih bergantung pada `transactions` |
| Pengeluaran operasional dan tagihan | `src/components/TransactionForm.jsx`, `src/store/useTransactionStore.js`, migrasi `expenses`, `bills` | Legacy host inert + target relasional | Pengeluaran operasional utama tidak lagi bergantung pada `TransactionForm` aktif; target final tetap `expenses` dan `bills` |
| Pemasukan proyek | `src/components/IncomeForm.jsx`, `src/store/useIncomeStore.js` | Sudah ada | Quick action dan route create utama belum diarahkan penuh ke flow ini |
| Fee staf per termin | `IncomeForm` preview ada, tabel `staff` sudah ada di migration | Parsial | Belum ada pembentukan bill fee otomatis setelah insert `project_incomes` |
| Pinjaman dan pembayaran pinjaman | `src/store/useIncomeStore.js`, tabel `loans` dan `loan_payments` ada di migration | Parsial | UI/store untuk `loan_payments` belum ada |
| Lampiran file | `src/store/useFileStore.js`, `src/store/useHrStore.js`, tabel `file_assets`, `expense_attachments` | Parsial | Lampiran baru aktif di modul HRD; transaksi dan payment belum memakai pola file relasional |
| Reporting dan PDF settings | `src/store/useReportStore.js`, view `vw_project_financial_summary`, migration `vw_cash_mutation`, `vw_billing_stats`, `pdf_settings` | Parsial | `vw_cash_mutation`, `vw_billing_stats`, dan `pdf_settings` belum masuk flow aplikasi utama |
| HRD dan beneficiary | `src/store/useHrStore.js`, `src/components/HrdPipeline.jsx`, `src/components/BeneficiaryList.jsx` | CRUD dasar sudah ada | Import/export dan dedupe UI-ready belum selesai |
| Recycle bin dan restore | soft delete sudah konsisten di store master/HRD/transaksi | Parsial | Belum ada layar restore lintas entitas |

## Keputusan Arsitektur yang Direkomendasikan

Rekomendasi untuk fase integrasi ini:

1. Jadikan **tabel relasional final** sebagai source of truth utama:
   `project_incomes`, `expenses`, `expense_line_items`, `bills`, `bill_payments`, `loans`, `loan_payments`, `attendance_records`, `file_assets`, dan SQL view final.
2. Perlakukan `transactions` sebagai **legacy compatibility layer** yang harus keluar dari jalur create utama.
3. Gunakan **view/read model SQL** untuk dashboard dan mutasi, bukan agregasi campuran yang masih bergantung pada tabel legacy.
4. Simpan file transaksi/payment lewat **Supabase Storage + `file_assets` + relation table**, bukan URL mentah.

Catatan:
- Ini adalah inferensi teknis dari kondisi repo saat ini, bukan keputusan produk final yang sudah tertulis eksplisit.
- Jika tim memilih mempertahankan `transactions` sebagai unified ledger permanen, keputusan itu harus didokumentasikan lebih dulu sebelum implementasi lanjutan.

## Status Keputusan IR-00

`IR-00` untuk sprint integrasi ini ditetapkan sebagai berikut:

1. `transactions` **tidak lagi dipakai untuk jalur create utama**.
2. `transactions` diperlakukan sebagai **legacy compatibility layer sementara**.
3. Source of truth aktif untuk flow inti dipindahkan ke:
   - `project_incomes`
   - `expenses`
   - `bills`
   - `bill_payments`
   - `loans`
   - `loan_payments`
4. Dashboard dan daftar mutasi harus dibaca dari domain relasional final, bukan dari `transactions`.

Implikasi langsung:

1. route create `income` harus mengarah ke `IncomeForm`
2. route create `expense` harus menulis ke `expenses`
3. `transactions` boleh tetap ada untuk data lama, tetapi bukan lagi sumber data aktif untuk fitur baru

## Status Pemetaan IR-01

Matriks source of truth untuk flow inti setelah keputusan `IR-00`:

| Fitur | Route/UI utama | Store utama | Source of truth final |
| --- | --- | --- | --- |
| Buat pemasukan proyek | `/edit/project-income/new` | `useIncomeStore.addProjectIncome` | `project_incomes` |
| Buat pengeluaran operasional/lainnya | `/edit/expense/new` | `useTransactionStore.submitExpense` | `expenses` -> trigger `bills` / `bill_payments` |
| Buat faktur material | `/material-invoice/new` | `useTransactionStore.submitMaterialInvoice` | `expenses` + `expense_line_items` |
| Buat pinjaman | `/edit/loan/new` | `useIncomeStore.addLoan` | `loans` |
| Bayar tagihan | `/payment/:id` | `usePaymentStore.submitBillPayment` | `bill_payments` |
| Summary kas dashboard | `Dashboard` | `useDashboardStore.refreshDashboard` | agregasi tabel cashflow final |
| Daftar mutasi kas | `Dashboard`, `/transactions` | `useDashboardStore.refreshDashboard` | `project_incomes`, `loans`, `bill_payments`, `loan_payments` |
| Daftar tagihan unpaid | `Dashboard`, `PaymentPage` | `useBillStore.fetchUnpaidBills` | `bills` |

## Gate Sebelum UI Polish, AQ, dan QC

`UI Polish Optimization` tidak boleh menjadi prioritas utama sebelum seluruh gate berikut lolos:

1. Tidak ada quick action utama yang masih membuka flow legacy yang salah domain.
2. Dashboard, halaman transaksi, dan pembayaran membaca source of truth final yang sama.
3. Flow `income`, `expense`, `material invoice`, `loan`, `bill payment`, dan `loan payment` sudah jelas jalurnya.
4. Lampiran transaksi/payment memakai storage relasional final atau dinyatakan out-of-scope release.
5. Reporting operasional minimal memakai `vw_cash_mutation` dan `vw_billing_stats` atau keputusan defer-nya sudah tertulis.

Jika gate di atas belum lolos, polish UI berisiko mengunci tampilan di atas contract data yang masih berubah.

## Urutan Eksekusi Makro

### Phase 0 - Baseline Keputusan

Fase ini menyelesaikan ambiguitas arsitektur agar task setelahnya tidak bolak-balik.

| ID | Micro task | File target utama | Output wajib | Validasi |
| --- | --- | --- | --- | --- |
| `IR-00` | Tetapkan keputusan final posisi `transactions`: dideprekasi dari flow utama atau dipertahankan sebagai ledger resmi | `docs/integration-readiness-plan-2026-04-17.md`, `docs/implementation-continuation-plan-2026-04-17.md` | keputusan arsitektur singkat + daftar flow yang terdampak | cek konsistensi dokumen |
| `IR-01` | Buat peta source of truth per fitur: create, edit, delete, pay, report | `src/pages/Dashboard.jsx`, `src/pages/TransactionsPage.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/PaymentPage.jsx`, store terkait | matriks fitur -> tabel/view -> store -> route | review file mapping, belum perlu build |

### Phase 1 - Blocking Integration Core

Fase ini adalah blocker langsung sebelum `UI Polish Optimization`.

| ID | Micro task | File target utama | Dependency | Definition of done | Validasi minimum |
| --- | --- | --- | --- | --- | --- |
| `IR-02` | Ubah quick action dan route create agar memakai flow domain yang benar | `src/pages/Dashboard.jsx`, `src/pages/EditRecordPage.jsx`, `src/App.jsx` | `IR-00` | `+Pemasukan` memakai `IncomeForm`; `+Pengeluaran` tidak lagi ke legacy/inert `TransactionForm`; route item lain tidak ambigu | `npm run lint`, `npm run build` |
| `IR-03` | Bangun flow pengeluaran operasional relasional | `src/components/TransactionForm.jsx` atau komponen baru, `src/store/useTransactionStore.js`, `src/store/useBillStore.js` | `IR-02` | pengeluaran utama menulis ke `expenses` dan memicu jalur bill final, bukan ke `transactions`; `TransactionForm` tetap legacy/inert sampai diganti route aktif | `npm run lint`, `npm run build` |
| `IR-04` | Samakan dashboard summary dan daftar mutasi dengan source of truth final | `src/store/useDashboardStore.js`, `src/pages/Dashboard.jsx`, `src/pages/TransactionsPage.jsx`, view SQL bila perlu | `IR-00`, `IR-03` | saldo kas, list mutasi, dan daftar transaksi berasal dari model relasional final yang sama | `npm run lint`, `npm run build` |
| `IR-05` | Rapikan contract edit/delete per item agar sesuai jenis domain | `src/pages/Dashboard.jsx`, `src/pages/EditRecordPage.jsx`, store domain terkait | `IR-04` | edit/delete tidak lagi memperlakukan income/expense relasional sebagai item legacy | `npm run lint`, `npm run build` |
| `IR-06` | Implementasi otomatis bill fee staf per termin proyek | `src/store/useIncomeStore.js`, store/payment terkait, migration atau RPC bila diperlukan | `IR-02` | insert `project_incomes` menghasilkan bill fee staf sesuai rule aktif | `npm run lint`, `npm run build`, uji query/manual data |
| `IR-07` | Tambahkan flow pembayaran pinjaman (`loan_payments`) | `src/store/useIncomeStore.js`, store/payment baru atau existing, `src/pages/PaymentPage.jsx` atau route baru, migration bila perlu | `IR-04` | loan dapat dibayar dari UI dan muncul di mutasi kas final | `npm run lint`, `npm run build` |

### Phase 2 - Financial Attachment and Reporting Layer

Fase ini menutup gap integrasi yang harus stabil sebelum `AQ` dan `QC` finansial.

| ID | Micro task | File target utama | Dependency | Definition of done | Validasi minimum |
| --- | --- | --- | --- | --- | --- |
| `IR-08` | Putuskan model relasi lampiran untuk payment dan transaksi selain HRD | `supabase/migrations/*`, `src/store/useFileStore.js`, store expense/payment | `IR-03`, `IR-07` | ada strategi final yang konsisten untuk bukti bayar dan lampiran expense | review schema + advisor/security check |
| `IR-09` | Implementasi lampiran pada expense/material invoice/bill payment/loan payment | form transaksi/payment, `src/store/useFileStore.js`, store domain, komponen preview | `IR-08` | file tersimpan di storage, tercatat di `file_assets`, dan dapat ditampilkan ulang | `npm run lint`, `npm run build` |
| `IR-10` | Integrasikan `vw_cash_mutation` ke layar operasional | `src/store/useDashboardStore.js`, halaman transaksi atau halaman laporan baru | `IR-04`, `IR-07` | user bisa membaca mutasi kas dari view final | `npm run lint`, `npm run build` |
| `IR-11` | Integrasikan `vw_billing_stats` dan `pdf_settings` ke UI | `src/store/useReportStore.js`, `src/pages/MorePage.jsx` atau halaman baru, migration bila perlu | `IR-10` | stats tagihan dan pengaturan PDF bisa dibaca/diubah dari app | `npm run lint`, `npm run build` |
| `IR-12` | Sediakan minimal satu laporan PDF bisnis dari data relasional final | modul report/PDF baru atau perluasan `ProjectReport`, serverless bila perlu | `IR-11` | satu export PDF bisnis tersedia dari app, bukan hanya notifikasi Telegram | `npm run lint`, `npm run build`, uji manual export |

### Phase 3 - Release Scope Completion

Fase ini penting untuk scope aplikasi yang lengkap, tetapi dapat dikerjakan paralel setelah Gate Phase 1 aman jika tim ingin mulai polish lebih cepat.

| ID | Micro task | File target utama | Dependency | Definition of done | Validasi minimum |
| --- | --- | --- | --- | --- | --- |
| `IR-13` | Tambahkan import/export beneficiary | `src/store/useHrStore.js`, `src/components/BeneficiaryList.jsx` | tidak bergantung pada Phase 1 | import/export CSV/XLSX berjalan dan dedupe minimal `nik` diterapkan | `npm run lint`, `npm run build` |
| `IR-14` | Tambahkan import/export HRD applicants | `src/store/useHrStore.js`, `src/components/HrdPipeline.jsx` | tidak bergantung pada Phase 1 | applicant dapat diimpor/diekspor tanpa merusak dokumen eksisting | `npm run lint`, `npm run build` |
| `IR-15` | Bangun recycle bin dasar dan restore flow | store master/HRD/transaksi terkait, halaman baru di `src/pages/` atau `src/components/` | `IR-05` | entitas soft-delete prioritas dapat dicari dan direstore dari UI | `npm run lint`, `npm run build` |
| `IR-16` | Tambahkan admin utilities ringan untuk orphan/integrity check | halaman utilitas kecil, query/store ringan | `IR-15` | owner/admin dapat melihat anomali dasar tanpa SQL manual | `npm run lint`, `npm run build` |

## Sprint Rekomendasi Paling Aman

Urutan sprint yang paling aman untuk menghindari regresi adalah:

1. `IR-00` sampai `IR-04`
2. `IR-05` sampai `IR-07`
3. `IR-08` sampai `IR-12`
4. `IR-13` sampai `IR-16`
5. baru masuk `UI Polish Optimization`
6. lanjut `AQ`
7. lanjut `QC`

## Handoff ke UI Polish, AQ, dan QC

### Syarat masuk UI Polish Optimization

1. Semua quick action utama sudah menuju form final.
2. Tidak ada lagi create flow inti yang bergantung pada `transactions` tanpa justifikasi eksplisit.
3. Dashboard, mutasi, dan payment membaca source data yang konsisten.

### Syarat masuk AQ

1. Flow create/edit/delete/pay utama lolos uji manual.
2. Auth Telegram, invite, dan role gating lolos smoke test.
3. Lampiran dan report final yang masuk scope release sudah stabil.

### Syarat masuk QC

1. Build produksi bersih.
2. Regression checklist tertulis untuk mobile Telegram WebView.
3. Tidak ada gap schema/UI yang masih memaksa perubahan contract besar.

## Risiko Utama Jika Urutan Diabaikan

1. UI dipoles di atas flow data yang masih berubah, sehingga polish harus diulang.
2. AQ/QC menguji perilaku yang nanti berubah lagi saat source of truth diperbaiki.
3. Payment, reporting, dan attachment berpotensi pecah diam-diam karena kontrak tabel belum final.
4. Soft delete dan restore bisa tidak sinkron jika delete contract belum dinormalisasi dulu.

## Catatan Scope

Yang **tidak** saya jadikan prioritas integrasi blocker dari audit lama:

1. chat/comment in-app
2. notifikasi in-app terpisah dari Telegram
3. activity log sebagai modul UI mandiri

Ketiga area ini tetap mengikuti keputusan repo yang sudah tertulis di `docs/implementation-continuation-plan-2026-04-17.md`.
