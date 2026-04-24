# Unified CRUD Workspace Plan

Plan date: `2026-04-18`  
Repository: `Banplex Greenfield`  
Status: `active`

## Freeze Authority Update (`2026-04-19`)

Mulai `2026-04-19`, authority utama untuk keputusan produk, PRD, contract map, lifecycle, dan guardrail AI berpindah ke package:

- `docs/freeze/00-index.md`
- `docs/freeze/01-planning-decision-freeze.md`
- `docs/freeze/02-prd-master.md`
- `docs/freeze/03-source-of-truth-contract-map.md`
- `docs/freeze/04-lifecycle-matrix.md`
- `docs/freeze/05-ai-execution-guardrails.md`

Dokumen ini tetap dipakai sebagai backlog operasional, tetapi tidak boleh mengalahkan freeze package jika terjadi konflik.

## Tujuan

Dokumen ini menjadi source of truth untuk implementasi bertahap CRUD workspace yang dipusatkan di halaman `Transaksi`, mencakup:

- workspace `buku kas besar` lintas domain sebagai ledger tunggal
- `input pemasukan murni`
- `expense umum`
- `material invoice` / `surat_jalan`
- `loan`
- `attendance record`
- `salary bill`
- `master data`
- lifecycle `CRUD`, `soft delete`, `permanent delete`, `attachment`, dan `payment`
- `laporan` operasional dan artefak `PDF`
- kesiapan `mobile-first` untuk data yang makin besar

Dokumen ini juga menjadi backlog micro-task yang harus diaudit dan diperbarui setiap ada brief lanjutan yang masih berada di stream kerja yang sama.

## Aturan Operasional Stream Ini

1. Jangan lanjut ke micro-task berikutnya sebelum task aktif berstatus `validated`.
2. Setiap task selesai dikerjakan, lakukan audit hasil task terhadap definition of done, validasi minimum, dan risiko regresi.
3. Setelah audit task, update `docs/progress/unified-crud-workspace-progress-log.md`.
4. Setiap ada brief baru yang masih terkait stream ini:
   - audit backlog di dokumen ini dulu,
   - jika brief baru belum tercakup, tambahkan micro-task baru,
   - jika brief berbenturan dengan task lama, revisi task yang terdampak,
   - baru setelah itu lanjut planning atau implementasi berikutnya.

## Keputusan Domain Awal

Keputusan awal yang dipakai untuk implementasi aman dan bertahap:

1. `loan` **belum** dimigrasikan ke tabel `bills`; fase awal memakai abstraksi UI/payable, bukan migrasi schema besar.
2. `project-income` menghasilkan `fee bill`.
3. `expense umum` dan `material invoice` menghasilkan `bill`.
4. `attendance record` yang direkap menghasilkan `salary bill`.
5. Hapus parent record harus mempertimbangkan soft delete terhadap anak turunan (`bill`, `bill_payments`, atau `loan_payments`) sesuai aturan bisnis final per domain.
6. `partial payment` wajib punya minimal `detail`, `edit`, dan `hapus` sendiri sebelum workspace transaksi dianggap rapi.
7. `loan` berbunga memakai bunga flat: `pokok + (pokok x suku_bunga x tenor)` untuk total pengembalian dasar.
8. Jika `loan` melewati tenor dan masih punya sisa bayar, bunga keterlambatan harus tetap terhitung berdasarkan aturan yang dibakukan pada task domain loan, dengan `penalti keterlambatan` sebagai field opsional.
9. Field `supplier` di form transaksi harus mengambil data master supplier secara kontekstual berdasarkan `supplier_type`, bukan input bebas jika context membutuhkan master relation.
10. Submit create/edit tidak boleh otomatis menutup Mini Web App; flow harus tetap aman di dalam app agar user bisa lanjut pekerjaan berikutnya.
11. Attachment harus diperlakukan sebagai child record yang bisa dilihat, ditambah, diedit metadatanya, dan dihapus tanpa menghapus parent data.
12. CRUD attachment yang tampil di UI harus mengikuti role matrix yang eksplisit; user hanya melihat aksi yang memang boleh ia jalankan.
13. `surat_jalan` diperlakukan sebagai parent transaksi material yang punya CRUD sendiri dan bisa dikonversi menjadi expense final dengan bill `unpaid` atau `paid` dari menu aksi yang aman.
14. CRUD transaksi harus dipusatkan di halaman `Buku Kas Besar`; list mutasi pada dashboard tidak menjadi pusat aksi tulis/edit/hapus.
15. Jika master data per jenis sudah besar, dropdown biasa tidak dianggap cukup; target UX final adalah picker yang searchable, mobile-friendly, dan tetap menjaga context field.

## Matriks Aturan Bisnis Parent-Child Final

Matriks ini mengunci kontrak final yang dipakai task-task sesudah `UCW-00`.
Kalau kolom `restore rule` atau `payment rule` belum punya handler UI/API khusus, itu berarti aturan target final sudah disepakati tetapi implementasinya masih menjadi pekerjaan micro-task turunan.

| Domain | Source table | Child record | Delete guard | Restore rule | Payment rule | Repo mapping |
| --- | --- | --- | --- | --- | --- | --- |
| `project-income` | `project_incomes` | `bills.project_income_id` untuk fee bill staf | Hapus/edit diblokir bila ada fee bill aktif yang sudah punya `paid_amount > 0` | Restore parent membuka lagi fee bill anak, set `deleted_at = null`, `status = unpaid`, `paid_at = null` | Insert/update `project_incomes` memicu `fn_sync_fee_bills_from_project_income()`; pembayaran fee masuk ke `bill_payments` lewat bill anak | `api/transactions.js`, `supabase/migrations/20260417193000_add_project_income_fee_bills_and_loan_payment_status.sql` |
| `expense umum` | `expenses` | `bills` otomatis dari `fn_auto_create_bill_from_expense()` | Hapus destruktif tidak boleh dilakukan jika bill anak atau `bill_payments` sudah aktif | Restore parent harus membuka lagi bill anak dan menjaga audit pembayaran; jika handler belum ada, targetnya masuk `UCW-11` | `status = paid` membuat bill anak dan `bill_payments` awal; `status = unpaid` hanya membuat bill | `api/records.js`, `supabase/migrations/20260410233000_add_bills_stock_automation.sql`, `supabase/migrations/20260417213000_fix_public_trigger_security_for_expenses_and_bills.sql` |
| `material invoice` | `expenses` dengan `expense_type = material` | `expense_line_items`, lalu `bills` dan `bill_payments` | Hapus destruktif diblokir jika invoice sudah settle atau child payment masih hidup; line item memang cascade dari `expense_id` | Restore header harus menghidupkan lagi bill dan line item turunan; jika belum ada handler, menjadi target `UCW-12` dan `UCW-20` | Total line item menjadi amount bill; invoice `paid` memicu bill payment awal | `api/records.js`, `supabase/migrations/20260410224500_create_material_invoice_tables.sql`, `supabase/migrations/20260417213000_fix_public_trigger_security_for_expenses_and_bills.sql` |
| `bill` | `bills` | `bill_payments` | Hapus diblokir bila ada `bill_payments` aktif; fee bill dari `project-income` juga harus menunggu parent income dipulihkan | Restore bill yang berasal dari `project-income` wajib menunggu parent income hidup lagi; bill dari attendance mengikuti flow attendance restore | Insert ke `bill_payments` mengubah `paid_amount`, `status`, dan `paid_at` pada parent bill | `api/records.js`, `api/transactions.js`, `supabase/migrations/20260410144525_add_bill_payments_and_cash_mutation.sql`, `supabase/migrations/20260417213000_fix_public_trigger_security_for_expenses_and_bills.sql` |
| `bill_payment` | `bill_payments` | tidak ada child tambahan; ini leaf audit untuk bill | Current API tidak membuka edit/delete; bila nanti diaktifkan, harus pakai void/reverse, bukan mutasi diam-diam | Restore leaf belum dijalankan sekarang; kalau soft delete ditambah, parent bill harus dihitung ulang | `fn_update_bill_status_on_payment()` mengakumulasi pembayaran dan mengubah status bill menjadi `unpaid`, `partial`, atau `paid` | `api/records.js`, `src/store/usePaymentStore.js`, `supabase/migrations/20260410144525_add_bill_payments_and_cash_mutation.sql`, `supabase/migrations/20260417213000_fix_public_trigger_security_for_expenses_and_bills.sql` |
| `loan` | `loans` | `loan_payments` | Hapus diblokir bila ada `loan_payments` aktif | Restore loan hanya membuka parent loan; pembayaran tetap melekat di riwayat child | `principal_amount`, `repayment_amount`, `interest_type`, `interest_rate`, dan `tenor_months` disimpan di parent; pembayaran masuk lewat `loan_payments` | `api/transactions.js`, `src/store/useIncomeStore.js`, `src/store/usePaymentStore.js`, `supabase/migrations/20260417193000_add_project_income_fee_bills_and_loan_payment_status.sql` |
| `loan_payment` | `loan_payments` | tidak ada child tambahan; ini leaf audit untuk loan | Current API tidak membuka edit/delete; jika nanti diaktifkan harus ada aturan void/reverse dan recalc total | Restore leaf belum dijalankan sekarang; bila soft delete ditambah, parent loan harus dihitung ulang | `fn_update_loan_status_on_payment()` mengubah status loan menjadi `unpaid`, `partial`, atau `paid` berdasarkan total pembayaran | `api/transactions.js`, `src/store/usePaymentStore.js`, `supabase/migrations/20260417193000_add_project_income_fee_bills_and_loan_payment_status.sql` |
| `attendance record` | `attendance_records` | `bills.salary_bill_id`, lalu `bill_payments` pada bill gaji | Hapus dibatasi oleh status billing; `unbilled` bisa disederhanakan sebagai soft delete sheet, sementara `billed/paid` perlu guard agar salary bill tidak orphan | Restore attendance harus menjaga link ke salary bill jika bill masih ada; bila bill sudah hilang, attendance dipulihkan dulu lalu salary bill dibangun ulang lewat flow gaji | `fn_generate_salary_bill()` membuat bill gaji dan menandai absensi `billed`; pembayaran salary tetap lewat `bill_payments` biasa | `api/records.js`, `supabase/migrations/20260411160000_create_attendance_and_salary_billing.sql`, `supabase/migrations/20260411170000_create_project_financial_summary_view.sql`, `supabase/migrations/20260411190000_setup_telegram_auth_rbac_rls.sql` |

## Status Domain Repo Aktual (`2026-04-18`)

| Domain inti | Bukti repo aktual | Status aktual | Gap blocker release |
| --- | --- | --- | --- |
| `input pemasukan murni` | `src/components/IncomeForm.jsx`, `src/store/useIncomeStore.js`, `src/pages/EditRecordPage.jsx`, `api/transactions.js`, migration `20260417193000_*` | `usable` | Fee bill turunan sudah punya trigger schema, tetapi visibilitas detail/payment/report dan audit restore masih perlu dikunci sebagai flow release |
| `expense umum` | `src/components/ExpenseForm.jsx`, `src/store/useTransactionStore.js`, `src/pages/TransactionDetailPage.jsx`, `api/records.js` | `usable` | Guard delete tree, laporan lintas domain, dan data legacy yang tidak punya snapshot supplier masih butuh hardening |
| `loan` | `src/components/LoanForm.jsx`, `src/store/useIncomeStore.js`, `src/store/usePaymentStore.js`, `src/pages/PaymentPage.jsx`, `api/transactions.js` | `usable` | Paket aturan tunggakan, reporting, dan destructive policy belum dibakukan sebagai release path tunggal |
| `material invoice` / `surat_jalan` | `src/components/MaterialInvoiceForm.jsx`, `src/store/useTransactionStore.js`, `src/pages/TransactionDetailPage.jsx`, `api/records.js` | `usable parsial` | Jalur konversi `surat_jalan`, laporan material, dan lifecycle parent-child masih perlu hardening lebih lanjut |
| `master data` | `src/pages/MasterPage.jsx`, `src/components/MasterDataManager.jsx`, `src/store/useMasterStore.js`, `src/pages/MasterRecycleBinPage.jsx` | `usable` | Usage guard dan destructive boundary final per entitas belum seragam; permanent delete masih sengaja dibatasi |
| `attendance` | `src/pages/AttendancePage.jsx`, `src/components/AttendanceForm.jsx`, `src/store/useAttendanceStore.js`, `api/records.js` | `usable` | Edit/delete/restore untuk absensi yang sudah `billed` masih perlu audit release yang lebih tegas |
| `tagihan gaji` | `src/components/PayrollManager.jsx`, `src/pages/PaymentPage.jsx`, `src/pages/EditRecordPage.jsx`, RPC `fn_generate_salary_bill` | `usable parsial` | Workflow buat bill sudah ada, tetapi recycle bin, permanent delete, dan reporting salary bill belum final |
| `soft delete` + `recycle bin` | `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, `api/transactions.js`, `api/records.js` | `usable parsial` | Restore sudah luas, tetapi permanent delete masih dominan untuk leaf record dan belum seragam pada parent entity |
| `attachment` | `src/components/ExpenseAttachmentSection.jsx`, `src/store/useFileStore.js`, `api/records.js`, `src/store/useHrStore.js` | `usable parsial` | Expense/faktur/HRD sudah punya pipeline kuat, tetapi bukti bayar dan policy lintas domain belum final |
| `payment` | `src/pages/PaymentPage.jsx`, `src/store/usePaymentStore.js`, `src/store/useBillStore.js`, `src/store/useIncomeStore.js` | `usable` | Audit trail/reversal semantics, lampiran bukti bayar, dan ringkasan report pembayaran belum lengkap |
| `laporan` | `src/components/ProjectReport.jsx`, `src/store/useReportStore.js`, `src/lib/reports-api.js`, `api/records.js` | `parsial` | Baru fokus pada laporan proyek; belum ada laporan operasional kas, tagihan, pinjaman, dan salary bill yang siap release |
| `PDF bisnis` + `pdf_settings` | `api/notify.js`, migration `20260411235900_*`, dependency `jspdf` | `belum user-facing` | PDF masih dominan untuk notifikasi Telegram; belum ada UI pengaturan PDF atau export bisnis yang bisa diunduh dari app |
| `mobile-first` + data scalable | `src/components/layouts/FormLayout.jsx`, `src/components/ui/MasterPickerField.jsx`, `src/pages/TransactionsPage.jsx`, `src/components/ExpenseAttachmentSection.jsx` | `parsial` | Form mobile sudah matang, tetapi list besar, report dataset besar, dan tooling integrity/admin belum dipaketkan |

### Catatan Audit Repo-First

1. `PRD_APP_IMPROVEMENT.md` tidak lagi mencerminkan arsitektur repo saat ini karena masih berbicara tentang `Hybrid Vanilla-React`, `Dexie`, dan folder `js/*` yang bukan source of truth aktif.
2. `README.md` juga belum menggambarkan fitur inti, kontrak data, dan cara kerja repo aktual.
3. Backlog aktif sebelum brief ini terlalu berat ke standardisasi shell form/UI, padahal blocker release inti sekarang berada di domain data, delete lifecycle, reporting, dan PDF.

## Reprioritasi Backlog Aktif (`2026-04-18`)

1. Fokus stream digeser dari standardisasi shell form lanjutan ke `core feature release` full-stack.
2. `UCW-54` sampai `UCW-63` dipertahankan sebagai backlog `UI follow-up`, tetapi statusnya diturunkan menjadi `deferred` sampai gate core release lolos.
3. Task aktif utama berpindah ke `UCW-77` sampai `UCW-90` agar repo lebih cepat mencapai kondisi operasional yang benar-benar bisa dipakai harian.
4. `PRD_APP_IMPROVEMENT.md` diperlakukan sebagai referensi legacy dan bukan lagi source of truth produk untuk stream ini.
5. Task implementasi yang menyentuh `bill`, `partial payment`, `attendance journal`, `salary bill`, `ledger besar`, atau `multi-user CRUD` tidak boleh dimulai sebelum paket keputusan produk detailnya dikunci di task desain terkait.
6. Residual page-level `allowedRoles` arrays di `AttendancePage`, `HrdPage`, `BeneficiariesPage`, `ProjectsPage`, dan `MaterialInvoicePage` adalah explicit legacy gates; jangan diformalisasi kecuali freeze menambahkan contract resmi role-group baru.
7. `UCW-90` audit memakai baseline final: capability contract sudah dipusatkan, `Master` tetap core-release fondasional, dan `Stok Barang` tetap supporting aktif; blocker release inti hanya yang masih benar-benar tersisa di matrix.

## Lifecycle Status Task

Gunakan status berikut:

- `planned`
- `ready`
- `in_progress`
- `audit_required`
- `validated`
- `blocked`
- `deferred`

Aturan:

1. Hanya satu task boleh `in_progress`.
2. Task tidak boleh lompat dari `in_progress` ke task berikutnya tanpa melewati audit.
3. Task dianggap selesai hanya jika status akhirnya `validated` atau `deferred` dengan alasan tertulis.

## Backlog Micro-Task

| ID | Micro-task | File target utama | Dependency | Definition of done | Validasi minimum | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `UCW-00` | Kunci matriks aturan bisnis parent-child untuk income, expense, bill, payment, loan, attendance | `docs/unified-crud-workspace-plan-2026-04-18.md`, `api/transactions.js`, `api/records.js`, `supabase/migrations/*` | - | Ada matriks final: source table, child record, delete guard, restore rule, payment rule | audit dokumen + mapping repo | `validated` |
| `UCW-01` | Bangun read model workspace transaksi terpisah dari dashboard summary | `api/transactions.js`, `src/lib/transactions-api.js`, `src/store/useDashboardStore.js`, `src/pages/TransactionsPage.jsx` | `UCW-00` | List transaksi memakai source of truth workspace sendiri, bukan kontrak dashboard campuran | `npm run lint`, `npm run build` | `validated` |
| `UCW-02` | Finalkan CRUD `expense umum` | `api/records.js`, `src/lib/records-api.js`, `src/store/useTransactionStore.js`, `src/pages/EditRecordPage.jsx`, `src/components/ExpenseForm.jsx` | `UCW-00` | Expense umum punya detail, edit, soft delete, restore, dan tampil benar di workspace | `npm run lint`, `npm run build` | `validated` |
| `UCW-03` | Finalkan CRUD `material invoice` beserta line items | `api/records.js`, `src/lib/records-api.js`, `src/store/useTransactionStore.js`, `src/components/MaterialInvoiceForm.jsx`, `src/pages/EditRecordPage.jsx` | `UCW-02` | Header dan item bisa dilihat, diedit, dihapus, direstore tanpa merusak bill turunan | `npm run lint`, `npm run build` | `validated` |
| `UCW-04` | Buat halaman detail `bill` sebagai pusat view dan aksi | `api/records.js`, `src/lib/records-api.js`, `src/pages/PaymentPage.jsx`, `src/pages/TransactionDetailPage.jsx` | `UCW-01` | Bill punya detail page yang memuat metadata, status, histori payment, dan CTA yang relevan | `npm run lint`, `npm run build` | `validated` |
| `UCW-05` | Tambahkan CRUD minimum untuk `bill_payments` | `api/records.js`, `src/lib/records-api.js`, `src/store/usePaymentStore.js`, `src/pages/PaymentPage.jsx` | `UCW-04` | Partial payment punya detail, edit, hapus, dan sinkronisasi status parent bill | `npm run lint`, `npm run build` | `validated` |
| `UCW-06` | Revisi guard hapus bill yang sudah dibayar/partial | `api/records.js`, `src/pages/PaymentPage.jsx`, `src/pages/TransactionDetailPage.jsx` | `UCW-05` | Hapus bill terbayar punya guard eksplisit dan menghapus histori partial payment sesuai aturan final | `npm run lint`, `npm run build` | `validated` |
| `UCW-07` | Finalkan detail dan kontrak `attendance record` yang sudah punya salary bill | `api/records.js`, `src/lib/records-api.js`, `src/store/useAttendanceStore.js`, `src/pages/EditRecordPage.jsx` | `UCW-00`, `UCW-04` | Attendance billed bisa dilihat, dijaga guard edit/delete-nya, dan relasinya ke salary bill konsisten | `npm run lint`, `npm run build` | `validated` |
| `UCW-08` | Tambahkan CRUD minimum untuk `loan_payments` | `api/transactions.js`, `src/lib/transactions-api.js`, `src/store/usePaymentStore.js`, `src/pages/PaymentPage.jsx` | `UCW-13`, `UCW-14` | Loan payment punya detail, edit, hapus, dan sinkronisasi status parent loan sesuai rule bunga flat, tenor, dan tunggakan | `npm run lint`, `npm run build` | `validated` |
| `UCW-09` | Finalkan workspace transaksi sebagai `buku kas besar` lintas domain | `src/pages/TransactionsPage.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/App.jsx`, `src/lib/transaction-presentation.js`, helper terkait | `UCW-24`, `UCW-25`, `UCW-26`, `UCW-28` | Halaman transaksi tampil sebagai ledger tunggal lintas domain tanpa row ganda parent-vs-bill, dengan CTA CRUD yang konsisten | `npm run lint`, `npm run build` | `validated` |
| `UCW-10` | Tambahkan guard usage dan detail rapi untuk master data list | `src/store/useMasterStore.js`, `src/pages/MasterFormPage.jsx`, `src/components/master/*`, backend terkait bila diperlukan | `UCW-00` | Master data bisa dilihat, diedit, dihapus dengan guard dependency yang jelas, termasuk field klasifikasi yang dipakai untuk filter kontekstual form | `npm run lint`, `npm run build` | `validated` |
| `UCW-11` | Perluas recycle bin ke expense, invoice, payment history, attachment metadata, dan master data | `api/transactions.js`, `api/records.js`, `src/store/useMasterStore.js`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, `src/pages/MasterPage.jsx`, `src/App.jsx` | `UCW-02`, `UCW-03`, `UCW-05`, `UCW-08`, `UCW-10`, `UCW-27` | Entitas prioritas bisa soft delete dan restore dengan tree parent-child aman, termasuk child payment history, attachment metadata, dan recycle bin master data terpisah | `npm run lint`, `npm run build` | `validated` |
| `UCW-12` | Finalkan arsitektur attachment untuk expense umum dan material invoice | `supabase/migrations/*`, `api/records.js`, `src/store/useFileStore.js`, form/detail expense & invoice | `UCW-02`, `UCW-03`, `UCW-34` | Ada kontrak final relasi attachment child record, metadata, lifecycle hapus, integrasi parent data, dan role matrix CRUD yang eksplisit | audit schema + mapping repo | `validated` |
| `UCW-13` | Kunci aturan bisnis pinjaman flat interest, tenor, bunga keterlambatan, dan penalti opsional | `docs/unified-crud-workspace-plan-2026-04-18.md`, `api/transactions.js`, `src/store/useIncomeStore.js`, `supabase/migrations/*` | `UCW-00` | Formula pengembalian dasar, aturan keterlambatan, snapshot data pinjaman, dan kontrak field penalti tertulis jelas dan selaras dengan repo | audit dokumen + mapping repo | `validated` |
| `UCW-14` | Terapkan kalkulasi dan preview pengembalian otomatis di `LoanForm` | `src/components/LoanForm.jsx`, `src/store/useIncomeStore.js`, `api/transactions.js` | `UCW-13` | Field pengembalian tidak lagi logika manual untuk skenario berbunga; preview perhitungan dan input penalti opsional tampil jelas di form | `npm run lint`, `npm run build` | `validated` |
| `UCW-15` | Normalisasi filter supplier kontekstual berbasis master data | `src/store/useMasterStore.js`, `src/components/MaterialInvoiceForm.jsx`, `src/components/ExpenseForm.jsx`, `src/components/master/masterTabs.js`, backend terkait bila perlu | `UCW-03`, `UCW-10` | Form yang butuh supplier memilih dari master supplier yang sudah difilter sesuai `supplier_type` dan context transaksi | `npm run lint`, `npm run build` | `validated` |
| `UCW-16` | Rancang shell form mobile berbasis section dengan alur lanjut/kembali | `src/components/layouts/FormLayout.jsx`, komponen UI terkait, form prioritas | `UCW-01` | Ada pola reusable untuk form section terpisah yang mobile-safe tanpa menambah duplikasi CTA | `npm run lint`, `npm run build` | `validated` |
| `UCW-17` | Terapkan shell sectioned form ke form prioritas | `src/components/LoanForm.jsx`, `src/components/ExpenseForm.jsx`, `src/components/MaterialInvoiceForm.jsx`, form prioritas lain bila relevan | `UCW-14`, `UCW-15`, `UCW-16`, `UCW-33` | Form prioritas memakai section next/back dan tetap menjaga validasi serta konteks field dengan rapi di mobile, termasuk saat picker master data sudah besar | `npm run lint`, `npm run build` | `validated` |
| `UCW-18` | Standarkan post-submit flow agar tetap di dalam Mini Web App | `src/pages/EditRecordPage.jsx`, `src/pages/MaterialInvoicePage.jsx`, `src/components/*Form.jsx`, `src/components/TransactionForm.jsx`, hook Telegram terkait | `UCW-16` | Setelah create/edit, app tidak auto-close dan tidak auto-keluar route secara agresif; user tetap berada di flow aman untuk lanjut kerja | `npm run lint`, `npm run build` | `validated` |
| `UCW-19` | Bangun library attachment ringan dengan compress dan background upload | `src/store/useFileStore.js`, helper file baru di `src/lib/`, UI upload terkait | `UCW-12` | Ada pipeline compress, queue/background upload, status progress, dan rollback aman jika registrasi metadata gagal | `npm run lint`, `npm run build` | `validated` |
| `UCW-20` | Integrasikan attachment CRUD ke parent data expense dan material invoice | `api/records.js`, `src/store/useFileStore.js`, `src/components/ExpenseForm.jsx`, `src/components/MaterialInvoiceForm.jsx`, halaman detail terkait | `UCW-19`, `UCW-34` | Attachment parent data bisa dilihat, ditambah, dihapus, dan diubah tanpa menghapus parent record, dengan aksi UI yang hanya muncul sesuai role | `npm run lint`, `npm run build` | `validated` |
| `UCW-21` | Tambahkan permanent delete untuk recycle bin prioritas | `api/transactions.js`, `api/records.js`, `src/pages/TransactionsRecycleBinPage.jsx`, detail page recycle bin terkait, helper store bila perlu | `UCW-11`, `UCW-28` | Entitas recycle bin prioritas bisa dihapus permanen dengan guard child tree yang jelas, tanpa merusak soft delete/restore flow yang sudah ada | `npm run lint`, `npm run build` | `validated` |
| `UCW-22` | Stabilkan draft multi-item faktur material dan trace error simpan | `src/components/MaterialInvoiceForm.jsx`, `src/store/useTransactionStore.js`, `src/lib/records-api.js`, `api/records.js`, `supabase/migrations/20260418090000_add_project_id_to_stock_transactions.sql` | `UCW-03`, `UCW-15` | Tambah item pada faktur material tidak mereset field yang sudah diisi, dan save multi-item gagal dengan error spesifik kalau ada constraint/backend issue | `npm run lint`, `npm run build` | `validated` |
| `UCW-23` | Kunci kontrak ledger tunggal `buku kas besar` dan aturan konsolidasi row | `docs/unified-crud-workspace-plan-2026-04-18.md`, `api/transactions.js`, `src/lib/transaction-presentation.js`, mapping repo terkait | `UCW-00` | Ada kontrak eksplisit untuk canonical row: `expense+bill`, `project-income+fee bill`, `attendance+salary bill`, `loan`, `material invoice`, `surat jalan`, dan child summary yang ditampilkan di list | audit dokumen + mapping repo | `validated` |
| `UCW-24` | Bangun read model ledger transaksi tunggal untuk workspace | `api/transactions.js`, `src/lib/transactions-api.js`, `src/store/useDashboardStore.js`, `src/lib/transaction-presentation.js` | `UCW-23`, `UCW-01` | Endpoint workspace mengembalikan row ledger tunggal lintas domain tanpa duplikasi parent-vs-bill, membawa pointer CRUD ke canonical parent, dan siap untuk strategi load data besar | `npm run lint`, `npm run build` | `validated` |
| `UCW-25` | Refactor `TransactionsPage` menjadi list minimal tanpa header grup | `src/pages/TransactionsPage.jsx`, komponen/list helper terkait | `UCW-24` | List transaksi tidak lagi memakai header grup tanggal, tidak menampilkan jumlah item per grup, dan tetap terbaca sebagai buku kas besar yang ringkas | `npm run lint`, `npm run build` | `validated` |
| `UCW-26` | Lengkapi CRUD tunggal dari row ledger ke canonical parent | `src/pages/TransactionDetailPage.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/PaymentPage.jsx`, `src/App.jsx`, helper presentasi terkait | `UCW-02`, `UCW-03`, `UCW-04`, `UCW-07`, `UCW-08`, `UCW-25` | Row ledger tunggal membuka aksi `lihat`, `edit`, `hapus`, `restore`, dan `bayar` ke parent yang benar tanpa menampilkan parent dan bill sebagai dua list terpisah | `npm run lint`, `npm run build` | `validated` |
| `UCW-27` | Rapikan schema dan manajemen child collection transaksi | `supabase/migrations/*`, `api/records.js`, `api/transactions.js`, `src/store/useFileStore.js`, `src/store/usePaymentStore.js`, halaman detail terkait | `UCW-05`, `UCW-12`, `UCW-20`, `UCW-34` | Riwayat pembayaran dan attachment berada di struktur child collection yang rapi, relasional, konsisten terhadap canonical parent transaksi, dan aman terhadap role-based access | audit schema + mapping repo | `validated` |
| `UCW-28` | Finalkan guard delete/restore/permanent-delete untuk tree transaksi | `api/records.js`, `api/transactions.js`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/TransactionDetailPage.jsx`, detail/helper store terkait | `UCW-11`, `UCW-26`, `UCW-27` | Soft delete, restore, dan permanent delete aman terhadap tree parent-child sehingga tidak meninggalkan orphan bill, payment history, attachment, atau child record lain | `npm run lint`, `npm run build` | `validated` |
| `UCW-29` | Buat detail dan edit terstruktur untuk line item faktur material | `api/records.js`, `src/lib/records-api.js`, `src/pages/TransactionDetailPage.jsx`, `src/components/MaterialInvoiceForm.jsx`, helper presentasi terkait | `UCW-03`, `UCW-26`, `UCW-27` | Rincian item material pada faktur punya detail yang jelas, bisa diedit sebagai child terstruktur, dan tetap aman terhadap total parent invoice | `npm run lint`, `npm run build` | `validated` |
| `UCW-30` | Finalkan CRUD `surat_jalan` dan aksi konversi ke expense final | `api/records.js`, `src/lib/records-api.js`, `src/components/MaterialInvoiceForm.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/pages/EditRecordPage.jsx` | `UCW-03`, `UCW-04`, `UCW-23`, `UCW-26` | Surat jalan punya CRUD sendiri, muncul jelas di buku kas besar, dan dapat dikonversi dari menu aksi menjadi expense final dengan bill `unpaid` atau `paid` tanpa orphan data | `npm run lint`, `npm run build` | `validated` |
| `UCW-31` | Hapus aksi CRUD dari list mutasi dashboard dan pusatkan ke buku kas besar | `src/pages/Dashboard.jsx`, `src/pages/TransactionsPage.jsx`, route/helper aksi terkait | `UCW-09` | Dashboard hanya menjadi ringkasan/navigasi; aksi CRUD transaksi tidak lagi dieksekusi dari list mutasi dashboard | `npm run lint`, `npm run build` | `validated` |
| `UCW-32` | Kunci strategi skalabilitas list `Buku Kas Besar` untuk data besar | `docs/unified-crud-workspace-plan-2026-04-18.md`, `api/transactions.js`, `src/lib/transactions-api.js`, `src/store/useDashboardStore.js`, `src/pages/TransactionsPage.jsx` | `UCW-23` | Ada strategi eksplisit untuk `cursor/date-window pagination`, filter server-side, pencarian terindeks, dan progressive hydration agar ledger tetap ringan saat data membengkak | audit dokumen + mapping repo | `validated` |
| `UCW-33` | Rancang pola picker master data skala besar yang mobile-friendly | `src/components/ui/*`, `src/components/master/*`, `src/components/ExpenseForm.jsx`, `src/components/MaterialInvoiceForm.jsx`, `src/components/LoanForm.jsx`, store/helper terkait | `UCW-10`, `UCW-15`, `UCW-16` | Dropdown master data yang besar beralih ke pola picker/search sheet yang mudah dipakai di mobile, cepat dicari, dan tetap menjaga validasi/context field | `npm run lint`, `npm run build` | `validated` |
| `UCW-34` | Kunci matriks role-based CRUD untuk attachment di UI dan API | `docs/unified-crud-workspace-plan-2026-04-18.md`, `api/records.js`, `src/store/useFileStore.js`, komponen/detail attachment terkait | `UCW-00` | Ada matriks eksplisit per role untuk `view`, `upload`, `edit metadata`, `delete`, `restore`, dan `permanent delete` attachment sehingga UI dan backend memakai aturan yang sama | audit dokumen + mapping repo | `validated` |
| `UCW-35` | Ubah filter tab `TransactionsPage` agar mewakili semua jenis catatan ledger | `src/pages/TransactionsPage.jsx`, helper presentasi/list terkait | `UCW-09`, `UCW-24`, `UCW-25`, `UCW-26` | Filter transaksi tidak lagi dibatasi `uang masuk/uang keluar` saja, melainkan menampilkan semua jenis catatan yang dikelola di buku kas besar dengan label yang tetap ringkas dan mobile-friendly | `npm run lint`, `npm run build` | `validated` |
| `UCW-36` | Sinkronkan timestamp UI dan backend dengan zona input pengguna | `src/lib/transaction-presentation.js`, `src/pages/*`, `src/store/*`, `api/records.js`, `api/transactions.js`, helper tanggal/waktu terkait | `UCW-23` | Semua timestamp ditampilkan konsisten terhadap zona input/penginputan, tidak lagi statis ke jam server, dan label waktu di UI tidak tertinggal satu zona | audit mapping repo + lint/build | `validated` |
| `UCW-37` | Jadikan list mutasi dashboard recent-only tanpa tombol More | `src/pages/Dashboard.jsx`, `src/store/useDashboardStore.js`, `src/pages/TransactionsPage.jsx` | `UCW-31`, `UCW-32` | Dashboard mutasi hanya menampilkan beberapa aktivitas terbaru dari source of truth buku kas besar, tanpa tombol More atau modal aksi, dan tetap jadi entry point ke ledger penuh | `npm run lint`, `npm run build` | `validated` |
| `UCW-38` | Rapikan badge list mutasi agar ringkas dan creator-aware | `src/pages/Dashboard.jsx`, `src/pages/TransactionsPage.jsx`, `src/lib/transaction-presentation.js`, helper badge terkait | `UCW-24`, `UCW-25`, `UCW-31`, `UCW-36` | Row ledger menampilkan `created_by` sesuai user yang melakukan aktivitas, dan badge berlebih seperti status pending dipangkas supaya UI tetap bersih dan fokus | `npm run lint`, `npm run build` | `validated` |
| `UCW-39` | Redesign header form dan halaman More agar lebih kompak | `src/components/ui/AppPrimitives.jsx`, `src/components/layouts/FormHeader.jsx`, `src/components/ExpenseForm.jsx`, `src/components/IncomeForm.jsx`, `src/components/LoanForm.jsx`, `src/components/MaterialInvoiceForm.jsx`, `src/components/AttendanceForm.jsx`, `src/pages/HrdPage.jsx`, `src/pages/PayrollPage.jsx`, `src/pages/BeneficiariesPage.jsx`, `src/pages/TeamInvitePage.jsx` | `UCW-16`, `UCW-17`, `UCW-33` | Header form dan 4 halaman More memakai komposisi yang sama: kicker/title di kiri, tombol kembali berlabel di kanan atas, field master tetap global, dan catatan opsional dikompakkan ke accordion | `npm run lint`, `npm run build` | `validated` |
| `UCW-40` | Pindahkan navigasi section form ke bawah tanpa scroll vertikal | `src/components/layouts/FormLayout.jsx`, `src/components/IncomeForm.jsx`, `src/components/ExpenseForm.jsx`, `src/components/LoanForm.jsx`, `src/components/MaterialInvoiceForm.jsx`, `src/components/AttendanceForm.jsx` | `UCW-39` | Form section menampilkan satu panel aktif, tombol Lanjut/Kembali berada di bawah panel, tombol Simpan muncul di section akhir, dan shell tidak memaksa scroll vertikal di area form | `npm run lint`, `npm run build` | `validated` |
| `UCW-41` | Samakan wrapper header dengan layout Recycle Bin | `src/components/layouts/FormHeader.jsx` | `UCW-39` | Header pada halaman yang sudah di-update tidak lagi memakai wrapper tebal/sticky, memakai tata letak ringkas seperti Recycle Bin, dan tetap konsisten untuk form maupun halaman More | `npm run lint`, `npm run build` | `validated` |
| `UCW-42` | Tambahkan padding seragam dan pulihkan render form income/expense | `src/components/layouts/FormLayout.jsx`, `src/components/IncomeForm.jsx`, `src/components/ExpenseForm.jsx`, `src/pages/EditRecordPage.jsx` | `UCW-41` | Halaman dengan header baru punya padding seragam seperti Recycle Bin, dan form income/expense tetap ter-render tanpa layar blank ketika dibuka | `npm run lint`, `npm run build` | `validated` |
| `UCW-43` | Audit spacing shell/card dan susun wrapper reusable | `src/components/ui/AppPrimitives.jsx`, `src/pages/*`, `src/components/MasterDataManager.jsx`, `src/components/ProjectReport.jsx` | `UCW-41`, `UCW-42` | Semua halaman punya padding konsisten di shell dan card, memakai komponen wrapper reusable yang jelas, dan perubahan berikutnya bisa diterapkan tanpa duplikasi class spacing | audit design repo + lint/build | `validated` |
| `UCW-44` | Selaraskan safe zone form overlay dengan shell halaman | `src/components/layouts/FormLayout.jsx`, `src/components/layouts/FormHeader.jsx`, `src/components/ui/AppPrimitives.jsx` | `UCW-41`, `UCW-42`, `UCW-43` | Form overlay punya padding kiri-kanan-atas-bawah dan safe area yang setara dengan halaman `Recycle Bin`, tanpa header menempel ke tepi layar atau konten kehilangan ruang napas | `npm run lint`, `npm run build` | `validated` |
| `UCW-45` | Pindahkan safe zone reusable ke shell halaman tanpa card visual | `src/components/ui/AppPrimitives.jsx`, `src/components/layouts/FormLayout.jsx`, `src/components/layouts/FormHeader.jsx` | `UCW-43`, `UCW-44` | Safe zone reusable berada di shell halaman dan viewport, bukan membungkus fullscreen form sebagai card/panel; visual akhir tetap mengikuti ritme `Recycle Bin` | `npm run lint`, `npm run build` | `validated` |
| `UCW-46` | Seragamkan shell konten halaman More dan hilangkan header sticky form | `src/components/ui/AppPrimitives.jsx`, `src/components/layouts/FormLayout.jsx`, `src/components/PayrollManager.jsx`, `src/components/HrdPipeline.jsx`, `src/components/BeneficiaryList.jsx`, `src/components/TeamInviteManager.jsx` | `UCW-39`, `UCW-45` | Empat halaman More memakai ritme section/content yang sama tanpa wrapper card lama, dan fullscreen form kembali scroll sebagai halaman biasa sehingga header tidak terasa sticky | `npm run lint`, `npm run build` | `validated` |
| `UCW-47` | Tambahkan safe-area wrapper untuk 4 halaman More | `src/pages/BeneficiariesPage.jsx`, `src/pages/HrdPage.jsx`, `src/pages/PayrollPage.jsx`, `src/pages/TeamInvitePage.jsx` | `UCW-46` | Empat halaman More punya padding safe-area + max-width yang konsisten meski tidak lewat `MainLayout`, tanpa mengubah hierarchy header/body yang sudah ada | `npm run lint`, `npm run build` | `validated` |
| `UCW-48` | Audit entry point form aktif, contract shell, dan mismatch repo aktual | `docs/unified-crud-workspace-plan-2026-04-18.md`, `src/App.jsx`, `src/components/layouts/FormLayout.jsx`, `src/components/layouts/FormHeader.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/AttendancePage.jsx`, `src/pages/MaterialInvoicePage.jsx`, `src/pages/PaymentPage.jsx`, `src/pages/MasterFormPage.jsx`, `src/pages/HrdPage.jsx`, `src/pages/BeneficiariesPage.jsx` | `UCW-16`, `UCW-17`, `UCW-39`, `UCW-40` | Ada matriks aktual repo yang memisahkan route form aktif, page-section aktif, modal editor internal, dan komponen legacy/unused; mismatch contract `FormLayout` (`actionLabel`, `formId`, `onSubmit`, `submitDisabled`, `isSubmitting`) terdokumentasi sebagai guard anti-regresi | audit dokumen + mapping repo | `validated` |
| `UCW-49` | Finalkan primitive reusable global untuk halaman form aktif | `src/components/layouts/FormLayout.jsx`, `src/components/layouts/FormHeader.jsx`, `src/components/ui/AppPrimitives.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/AttendancePage.jsx`, `src/pages/MaterialInvoicePage.jsx`, `src/pages/PaymentPage.jsx`, `src/pages/MasterFormPage.jsx` | `UCW-48` | Ada contract reusable tunggal untuk halaman form aktif: shell, section panel, header, safe spacing, dan footer CTA yang benar-benar memakai `formId`, `onSubmit`, `submitDisabled`, dan `isSubmitting`; wrapper aktif tidak lagi mengirim props yang diabaikan | `npm run lint`, `npm run build` | `validated` |
| `UCW-50` | Terapkan primitive reusable ke flow create/edit `Income` | `src/components/IncomeForm.jsx`, `src/pages/EditRecordPage.jsx`, `src/components/layouts/FormLayout.jsx` | `UCW-49` | Flow create/edit income di `EditRecordPage` memakai section reusable yang seimbang, tetap menjaga snapshot data existing, dan tidak memecah submit flow | `npm run lint`, `npm run build` | `validated` |
| `UCW-51` | Terapkan primitive reusable ke flow create/edit `Loan` | `src/components/LoanForm.jsx`, `src/pages/EditRecordPage.jsx`, `src/components/layouts/FormLayout.jsx` | `UCW-49` | Flow create/edit loan memakai section reusable yang seimbang, preview perhitungan tetap terbaca, dan submit/edit tidak bergantung pada pattern lokal yang menyimpang | `npm run lint`, `npm run build` | `validated` |
| `UCW-52` | Terapkan primitive reusable ke flow create/edit `MaterialInvoice` dan pulihkan CTA submit | `src/components/MaterialInvoiceForm.jsx`, `src/pages/MaterialInvoicePage.jsx`, `src/pages/EditRecordPage.jsx`, `src/components/layouts/FormLayout.jsx` | `UCW-49` | Flow create dan edit faktur material memakai section reusable yang sama; CTA submit muncul jelas di route create dan edit; `hideActions` child form tidak lagi bertabrakan dengan footer CTA wrapper | `npm run lint`, `npm run build` | `validated` |
| `UCW-53` | Audit slice prioritas setelah primitive reusable terpasang | `src/components/IncomeForm.jsx`, `src/components/LoanForm.jsx`, `src/components/MaterialInvoiceForm.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/MaterialInvoicePage.jsx`, `src/components/layouts/FormLayout.jsx` | `UCW-50`, `UCW-51`, `UCW-52`, `UCW-18` | Ada audit final bahwa form prioritas konsisten secara visual, wrapper aktif tidak lagi bergantung pada props `FormLayout` yang diabaikan, dan post-submit flow tetap aman | audit UI + lint/build | `validated` |
| `UCW-54` | Audit seluruh editor/form aktual dan klasifikasikan exception repo | `docs/unified-crud-workspace-plan-2026-04-18.md`, `src/App.jsx`, `src/components/*Form.jsx`, `src/components/HrdPipeline.jsx`, `src/components/BeneficiaryList.jsx`, `src/pages/*` | `UCW-48`, `UCW-53` | Ada inventaris aktual repo yang membedakan route form aktif, embedded child form, page-section + sheet editor, dan komponen legacy/unused; `TransactionForm` dan `MasterMaterialForm` tercatat eksplisit sebagai exception sampai dipakai lagi | audit dokumen + mapping repo | `deferred` |
| `UCW-55` | Terapkan reusable shell ke route form operasional aktif di luar slice prioritas | `src/components/ExpenseForm.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/AttendancePage.jsx`, `src/components/AttendanceForm.jsx`, `src/pages/PaymentPage.jsx`, `src/components/layouts/FormLayout.jsx` | `UCW-49`, `UCW-54` | Expense, attendance, dan payment flow aktif memakai shell/CTA contract yang sama; wrapper route tidak drift dari primitive global; komponen legacy `TransactionForm` tidak disentuh kecuali sudah diaktifkan lewat route | `npm run lint`, `npm run build` | `deferred` |
| `UCW-56` | Terapkan reusable shell ke route form master aktif dan tetapkan exception modal | `src/pages/MasterFormPage.jsx`, `src/components/WorkerForm.jsx`, `src/components/master/GenericMasterForm.jsx`, `src/components/layouts/FormLayout.jsx` | `UCW-49`, `UCW-54` | Flow master aktif memakai shell/CTA contract yang sama; `WorkerForm` dan `GenericMasterForm` tidak lagi bergantung pada pola lokal yang berbeda; `MasterMaterialForm` tetap dicatat sebagai modal exception sampai punya primitive modal yang setara | `npm run lint`, `npm run build` | `deferred` |
| `UCW-57` | Standarkan primitive header, section, CTA, dan sheet editor lintas form | `src/components/layouts/FormHeader.jsx`, `src/components/layouts/FormLayout.jsx`, `src/components/ui/AppPrimitives.jsx`, `src/components/HrdPipeline.jsx`, `src/components/BeneficiaryList.jsx`, `src/components/WorkerForm.jsx`, `src/components/master/GenericMasterForm.jsx` | `UCW-55`, `UCW-56` | Header, section title, CTA/footer, note/collapsible, dan editor berbasis `AppSheet` memakai bahasa visual dan primitive yang sama di route form maupun page-section editor | `npm run lint`, `npm run build` | `deferred` |
| `UCW-58` | Audit final semua form aktif dan daftar exception yang disengaja | `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`, `src/App.jsx`, `src/components/*Form.jsx`, `src/components/HrdPipeline.jsx`, `src/components/BeneficiaryList.jsx` | `UCW-57`, `UCW-18` | Semua entry form/editor aktif di repo sudah dipetakan ke primitive global yang sama atau masuk daftar exception yang tertulis; tidak ada wrapper aktif dengan CTA/submit flow yang mismatch | audit UI + lint/build | `deferred` |
| `UCW-59` | Audit konversi modal `HRD` menjadi routed form sectioned | `src/pages/HrdPage.jsx`, `src/components/HrdPipeline.jsx`, `src/App.jsx`, `src/components/layouts/FormLayout.jsx`, `src/components/ui/AppPrimitives.jsx` | `UCW-54`, `UCW-57` | Ada kontrak transisi yang jelas: create/edit pelamar tidak lagi final di `AppSheet`, tetapi dipindah ke route form aktif dengan shell sectioned yang sama seperti form lain; list HRD tetap menjadi entry page yang menavigasi ke route baru | audit dokumen + mapping repo | `deferred` |
| `UCW-60` | Audit konversi modal `Penerima Manfaat` menjadi routed form sectioned | `src/pages/BeneficiariesPage.jsx`, `src/components/BeneficiaryList.jsx`, `src/App.jsx`, `src/components/layouts/FormLayout.jsx`, `src/components/ui/AppPrimitives.jsx` | `UCW-54`, `UCW-57` | Ada kontrak transisi yang jelas: create/edit penerima manfaat tidak lagi final di `AppSheet`, tetapi dipindah ke route form aktif dengan shell sectioned yang sama seperti form lain; list penerima tetap menjadi entry page yang menavigasi ke route baru | audit dokumen + mapping repo | `deferred` |
| `UCW-61` | Rancang reusable routed form shell untuk flow `HRD` create/edit | `src/components/layouts/FormLayout.jsx`, `src/components/layouts/FormHeader.jsx`, `src/components/ui/AppPrimitives.jsx`, `src/pages/HrdPage.jsx`, `src/components/HrdPipeline.jsx`, route/page baru terkait | `UCW-49`, `UCW-59` | Ada spesifikasi reusable component untuk route form pelamar: header, section panel, CTA footer, status chips, dan pola kembali ke pipeline, tanpa menyisakan ketergantungan UI pada modal sheet lama | `npm run lint`, `npm run build` | `deferred` |
| `UCW-62` | Rancang reusable routed form shell untuk flow `Penerima Manfaat` create/edit | `src/components/layouts/FormLayout.jsx`, `src/components/layouts/FormHeader.jsx`, `src/components/ui/AppPrimitives.jsx`, `src/pages/BeneficiariesPage.jsx`, `src/components/BeneficiaryList.jsx`, route/page baru terkait | `UCW-49`, `UCW-60` | Ada spesifikasi reusable component untuk route form penerima manfaat: header, section panel, CTA footer, dan pola kembali ke list, tanpa menyisakan ketergantungan UI pada modal sheet lama | `npm run lint`, `npm run build` | `deferred` |
| `UCW-63` | Audit final penyelarasan routed form `HRD` dan `Penerima` dengan sistem form global | `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`, `src/App.jsx`, route/page baru terkait, `src/components/HrdPipeline.jsx`, `src/components/BeneficiaryList.jsx` | `UCW-61`, `UCW-62`, `UCW-18` | Flow create/edit HRD dan penerima manfaat sudah dipetakan ke routed form sectioned yang memakai reusable component global; modal lama tercatat sebagai legacy path yang harus dihapus atau dinonaktifkan saat implementasi | audit UI + lint/build | `deferred` |
| `UCW-64` | Finalisasi section invoice untuk ringkasan + lampiran aktif | `src/components/MaterialInvoiceForm.jsx`, `src/components/ExpenseAttachmentSection.jsx`, `src/store/useFileStore.js`, `src/store/useTransactionStore.js` | `UCW-52`, `UCW-53` | Ringkasan dan lampiran faktur material berada dalam satu section; submit pertama mengaktifkan `expenseId` sehingga lampiran bisa diunggah setelah invoice tersimpan; preview gambar aktif dan kontrol pilih/ganti/hapus draft file tetap selaras dengan backend upload/attach yang sudah ada | `npm run lint`, `npm run build` | `validated` |
| `UCW-65` | Finalisasi UI faktur material agar section, toggle, dan submit fallback konsisten | `src/components/MaterialInvoiceForm.jsx`, `src/pages/MaterialInvoicePage.jsx`, `src/pages/EditRecordPage.jsx`, `src/components/ExpenseAttachmentSection.jsx` | `UCW-64`, `UCW-53` | Section 1 invoice tidak lagi menampilkan kicker/title/description, dropdown statis berubah menjadi toggle, section akhir memuat ringkasan + lampiran + tombol simpan, dan hasil simpan/edit punya fallback tutup form in-app | `npm run lint`, `npm run build` | `validated` |
| `UCW-66` | Audit dan migrasi global dropdown statis ke reusable toggle group | `src/components/ui/AppPrimitives.jsx`, `src/components/LoanForm.jsx`, `src/components/ExpenseForm.jsx`, `src/components/AttendanceForm.jsx`, `src/components/HrdPipeline.jsx`, `src/components/TeamInviteManager.jsx`, `src/components/BeneficiaryList.jsx`, `src/components/WorkerForm.jsx`, `src/components/MaterialInvoiceForm.jsx` | `UCW-65` | Semua dropdown statis yang tidak mengambil master data dipetakan ke primitive toggle group reusable; field master data dan select dinamis tetap memakai select agar tidak merusak flow pencarian | `npm run lint`, `npm run build` | `validated` |
| `UCW-67` | Rapikan shell form, line items faktur, dan aktifkan attachment create-flow | `src/components/ui/AppPrimitives.jsx`, `src/components/layouts/FormLayout.jsx`, `src/components/MaterialInvoiceForm.jsx`, `src/components/ExpenseForm.jsx`, `src/components/ExpenseAttachmentSection.jsx`, `src/store/useTransactionStore.js`, `src/lib/records-api.js` | `UCW-66` | Toggle reusable tampil satu baris horizontal seperti saklar, padding shell form tidak dobel dengan safe area, line items faktur tidak lagi memakai section header dan tombol tambah item pindah ke bawah, serta attachment expense/faktur bisa dipakai setelah create pertama tanpa perubahan kontrak API | `npm run lint`, `npm run build` | `validated` |
| `UCW-68` | Ubah lampiran expense dan faktur menjadi preview-dulu lalu auto-attach setelah simpan | `src/components/ExpenseAttachmentSection.jsx`, `src/components/ExpenseForm.jsx`, `src/components/MaterialInvoiceForm.jsx`, `src/store/useFileStore.js`, `src/store/useTransactionStore.js`, `src/lib/records-api.js` | `UCW-67` | Form expense dan faktur selalu menampilkan area lampiran; file bisa dipilih dan dipreview sebelum parent record tersimpan; setelah create pertama berhasil dan `expenseId` tersedia, upload + attach berjalan otomatis memakai kontrak backend yang sudah ada | `npm run lint`, `npm run build` | `validated` |
| `UCW-69` | Hotfix blank form attachment dan cleanup otomatis saat attach gagal | `src/components/ExpenseAttachmentSection.jsx`, `src/store/useFileStore.js` | `UCW-68` | Runtime blank karena urutan deklarasi state upload tertutup; jika upload file asset sukses tetapi attach ke expense gagal, file asset dihapus permanen otomatis agar tidak orphan | `npm run lint`, `npm run build` | `validated` |
| `UCW-70` | Sederhanakan manajemen draft lampiran agar mobile-safe dan tanpa tombol ganda | `src/components/ExpenseAttachmentSection.jsx` | `UCW-69` | Draft lampiran tidak lagi memakai tombol terpisah di bawah preview; placeholder kosong langsung membuka file picker; saat preview diklik, aksi `Simpan`, `Ganti`, dan `Hapus` tampil sebagai overlay di dalam preview; helper text status diringkas agar tidak menambah card di dalam card pada mobile | `npm run lint`, `npm run build` | `validated` |
| `UCW-71` | Rapikan overlay preview lampiran agar tidak overlap di layar mobile | `src/components/ExpenseAttachmentSection.jsx` | `UCW-70` | Overlay aksi draft lampiran terkunci sebagai action bar bawah tiga kolom yang tidak wrap; label bawah preview ikut stack di mobile agar nama file dan status tidak saling tindih | `npm run lint`, `npm run build` | `validated` |
| `UCW-72` | Hardening preview portrait screenshot agar overlay tidak menimpa area draft | `src/components/ExpenseAttachmentSection.jsx` | `UCW-71` | Preview draft mendeteksi orientasi gambar; screenshot/portrait memakai frame lebih tinggi dengan `object-contain`, info file dipindah ke bawah preview, dan overlay atas dipadatkan menjadi chip aksi saja agar tidak bertumpuk dengan action bar bawah | `npm run lint`, `npm run build` | `validated` |
| `UCW-73` | Kunci frame preview draft agar screenshot tinggi tidak overflow ke samping | `src/components/ExpenseAttachmentSection.jsx` | `UCW-72` | Preview draft tidak lagi mengandalkan `height` langsung pada elemen gambar; frame memakai `aspect-ratio` dan `max-width` container, media dipaksa `block` + `max-w-full`, sehingga screenshot tinggi seperti `1080x2400` tetap terkunci di lebar form tanpa overlap horizontal | `npm run lint`, `npm run build` | `validated` |
| `UCW-74` | Paksa preview draft menjadi crop statis kecil untuk semua ukuran gambar | `src/components/ExpenseAttachmentSection.jsx` | `UCW-73` | Preview draft tidak lagi adaptif terhadap orientasi atau dimensi file; semua gambar dipaksa ke frame kecil tetap dengan `object-cover` dan `object-top` sehingga screenshot tinggi tidak pernah mendorong overflow horizontal di mobile | `npm run lint`, `npm run build` | `validated` |
| `UCW-75` | Putus dimensi intrinsik gambar dari layout preview draft | `src/components/ExpenseAttachmentSection.jsx` | `UCW-74` | Preview draft tidak lagi dirender dengan elemen `<img>`; gambar dipasang sebagai `background-image` pada frame crop tetap dan section dikunci `overflow-x-hidden`, sehingga browser tidak punya kesempatan memperluas layout berdasarkan ukuran asli screenshot | `npm run lint`, `npm run build` | `validated` |
| `UCW-76` | Perbaiki contract `supplier_name` expense agar save tidak gagal 23502 | `src/components/ExpenseForm.jsx`, `src/store/useTransactionStore.js`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-02`, `UCW-15` | Create/edit expense selalu mengirim `supplier_name` non-null ke API/DB, field supplier menjadi required di UI, dan edit tetap bisa mempertahankan nama supplier existing dari snapshot bila relasi aktif tidak tersedia | `npm run lint`, `npm run build` | `validated` |
| `UCW-77` | Audit repo menyeluruh, reprioritasi backlog, dan buat PRD core feature release | `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`, `docs/prd-core-feature-release-2026-04-18.md` | `UCW-76` | Ada audit repo aktual per fitur inti, backlog bergeser ke target core release full-stack, task UI non-blocker ditandai `deferred`, dan PRD baru terbit sebagai source of truth produk | audit konsistensi dokumen | `validated` |
| `UCW-78` | Kunci matriks source of truth release untuk semua core feature | `docs/unified-crud-workspace-plan-2026-04-18.md`, `src/App.jsx`, `src/pages/Dashboard.jsx`, `src/pages/TransactionsPage.jsx`, `src/pages/PaymentPage.jsx`, store/API terkait | `UCW-77` | Ada matriks final route -> store -> API -> tabel/view untuk pemasukan, expense, invoice/surat jalan, loan, attendance, salary bill, payment, attachment, report, dan PDF tanpa ambiguitas legacy | audit dokumen + mapping repo | `validated` |
| `UCW-98` | Selaraskan read model `Jurnal` agar `Tagihan Upah` tampil sebagai row bill dan attendance tidak lagi jadi row ledger utama | `api/transactions.js`, `src/lib/transaction-presentation.js`, `src/pages/TransactionDetailPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-97` | Workspace `Jurnal` sekarang menampilkan payroll payable sebagai `Tagihan Upah` dari source `bill`, attendance record tidak lagi muncul sebagai row ledger utama, search/filter tetap stabil, dan detail/payment flow payroll tetap berjalan | `npm run lint`, `npm run build` | `validated` |
| `UCW-97` | Bekukan keputusan audit dan brainstorming menjadi package `docs/freeze` | `docs/freeze/*`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-77`, `UCW-91`, `UCW-96` | Ada package freeze resmi enam dokumen yang menggantikan docs lama sebagai authority utama untuk produk, PRD, contract map, lifecycle, dan guardrail AI | audit dokumen + `rg` section check | `validated` |
| `UCW-91` | Brainstorm lanjutan dan kunci keputusan produk detail sebelum implementasi core release | `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`, `docs/prd-core-feature-release-2026-04-18.md` | `UCW-77` | PRD dan plan memuat keputusan produk detail untuk bill, partial payment, jurnal absensi, rekap salary bill, ledger besar, dan multi-user CRUD sehingga implementasi berikutnya tidak berjalan dengan asumsi kabur | audit konsistensi dokumen | `validated` |
| `UCW-92` | Kunci operating model `bill` dari `expense hutang` sampai daftar tagihan dan aksi `Bayar` | `src/pages/Dashboard.jsx`, `src/store/useBillStore.js`, `src/pages/PaymentPage.jsx`, `src/pages/TransactionDetailPage.jsx`, `api/records.js`, `docs/prd-core-feature-release-2026-04-18.md` | `UCW-78`, `UCW-91` | Ada keputusan final untuk kapan bill dibuat dari expense, bagaimana bill muncul di daftar tagihan, CTA `Bayar` dari list/detail, dan bagaimana parent-child bill terhubung ke expense, salary bill, dan recycle bin | audit dokumen + mapping repo | `validated` |
| `UCW-93` | Kunci UX partial payment, histori pembayaran, edit/hapus, dan boundary reverse/delete | `src/pages/PaymentPage.jsx`, `src/store/usePaymentStore.js`, `src/store/useBillStore.js`, `src/store/useIncomeStore.js`, `api/records.js`, `api/transactions.js`, `docs/prd-core-feature-release-2026-04-18.md` | `UCW-78`, `UCW-91` | Flow partial payment bill/loan, histori pembayaran, edit/hapus child payment, recalc parent, dan aturan permanent delete vs future reversal terdokumentasi final sebelum coding domain berikutnya berjalan | audit dokumen + mapping repo | `validated` |
| `UCW-94` | Kunci jurnal absensi CRUD, lock rule `billed`, dan rekap menjadi salary bill | `src/components/AttendanceForm.jsx`, `src/components/PayrollManager.jsx`, `src/pages/EditRecordPage.jsx`, `src/store/useAttendanceStore.js`, `api/records.js`, `api/transactions.js`, `docs/prd-core-feature-release-2026-04-18.md` | `UCW-78`, `UCW-91` | Ada keputusan final untuk editor utama absensi, kapan row boleh diedit/dihapus, bagaimana `batalkan rekap gaji` bekerja, dan bagaimana salary bill masuk ke daftar tagihan serta payment flow umum | audit dokumen + mapping repo | `validated` |
| `UCW-95` | Kunci strategi pagination, pencarian spesifik, dan akurasi dashboard pada ledger besar | `src/pages/TransactionsPage.jsx`, `src/components/ui/SmartList.jsx`, `src/store/useDashboardStore.js`, `src/lib/transactions-api.js`, `api/transactions.js`, `api/records.js`, `supabase/migrations/*`, `docs/prd-core-feature-release-2026-04-18.md` | `UCW-78`, `UCW-91` | Ada keputusan final bahwa ledger memakai query server-side dengan pagination cursor, pencarian/filter spesifik, dan dashboard summary dihitung dari read model server yang tidak bergantung pada jumlah row yang dimuat di client | audit dokumen + mapping repo | `validated` |
| `UCW-96` | Kunci policy multi-user CRUD, role matrix, ownership display, dan conflict handling | `src/store/useAuthStore.js`, `src/components/ProtectedRoute.jsx`, `api/auth.js`, `api/records.js`, `api/transactions.js`, `supabase/migrations/*`, `docs/prd-core-feature-release-2026-04-18.md` | `UCW-78`, `UCW-91` | Ada policy final untuk role yang boleh CRUD/delete/restore/permanent-delete, bagaimana `updated_at` dipakai mendeteksi conflict, dan apa perilaku UI saat record sudah diubah user lain | audit dokumen + mapping repo | `validated` |
| `UCW-99` | Alihkan create path `bill_payments` dan `loan_payments` ke API-owned boundary | `src/store/usePaymentStore.js`, `src/lib/records-api.js`, `src/lib/transactions-api.js`, `api/records.js`, `api/transactions.js` | `UCW-98` | Create pembayaran bill dan loan tidak lagi direct insert dari store; insert, parent recalc, dan sync status dilakukan di server boundary resmi, lalu client refetch parent state | `npm run lint`, `npm run build` | `validated` |
| `UCW-100` | Hardening kontrak `Pengeluaran` ↔ `Tagihan` agar direct-paid dan payable tetap konsisten | `src/lib/transaction-presentation.js`, `src/pages/TransactionDetailPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-99` | Expense direct-paid tidak lagi dipresentasikan seolah universal open bill; payable expense tetap tampil sebagai tagihan aktif, dan detail/history tetap konsisten untuk kedua mode | audit dokumen + `npm run lint` + `npm run build` | `validated` |
| `UCW-101` | Hardening kontrak `Dokumen Barang` ↔ stock movement agar surat jalan fisik, faktur finansial-only, dan conversion anti-double-count | `api/records.js`, `src/store/useTransactionStore.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-100` | Surat Jalan Barang menggerakkan stok fisik, Faktur Barang tetap finansial-only, konversi tidak double count stok, dan stok minus diblok keras di fase awal | audit dokumen + `npm run lint` + `npm run build` | `validated` |
| `UCW-102` | Koreksi final kontrak `Dokumen Barang` dan wording settlement agar inbound stock, standalone faktur, dan parent-vs-settlement presisi | `docs/freeze/*`, `api/records.js`, `src/store/useTransactionStore.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-101` | `Surat Jalan Barang` dan `Faktur Barang` sama-sama mencatat stok masuk, standalone faktur boleh stock-in, konversi tidak double count, dan wording parent-vs-settlement dibekukan presisi | audit dokumen + `npm run lint` + `npm run build` | `validated` |
| `UCW-103` | Buka modul `Stok Barang` v0 sebagai surface monitoring read-first | `api/records.js`, `src/lib/records-api.js`, `src/pages/StockPage.jsx`, `src/pages/MorePage.jsx`, `src/App.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-102` | Ada route resmi `Stok Barang` yang membaca `materials.current_stock` dan `stock_transactions`, menampilkan status stok sederhana, serta menegaskan stock-out manual masih planned untuk fase berikutnya | `npm run lint`, `npm run build` | `validated` |
| `UCW-104` | Buka manual stock-out v1 terbatas dari `Stok Barang` | `api/records.js`, `src/lib/records-api.js`, `src/pages/StockPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-103` | Stock-out manual hanya dari `Stok Barang`, write via API-only, material stock berkurang aman, transaction outbound/manual tercatat, dan stok minus diblok keras | `npm run lint`, `npm run build` | `validated` |
| `UCW-105` | Harden manual stock-out `Stok Barang` dengan konteks `Unit Kerja` eksplisit | `api/records.js`, `src/lib/records-api.js`, `src/pages/StockPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-104` | Flow stock-out manual wajib meminta Unit Kerja, client mengirim `project_id` eksplisit, server memvalidasi project aktif milik team user, hidden fallback project dihapus, dan histori movement menampilkan konteks project yang benar | `npm run lint`, `npm run build` | `validated` |
| `UCW-106` | Atomic manual stock-out `Stok Barang` via server RPC | `api/records.js`, `src/lib/records-api.js`, `src/pages/StockPage.jsx`, `supabase/migrations/20260419090000_create_atomic_manual_stock_out_function.sql`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-105` | Write path manual stock-out menjadi atomic lewat RPC kecil, negative stock dicek di server function, compensating rollback client hilang, dan source of truth tetap `materials.current_stock` + `stock_transactions` | `npm run lint`, `npm run build` | `validated` |
| `UCW-107` | Harden role gating manual stock-out `Stok Barang` untuk UI dan server | `src/pages/StockPage.jsx`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-106` | Role yang tidak berwenang tidak bisa membuka atau submit stock-out manual, CTA/sheet di-hide atau dinonaktifkan di UI, dan API tetap menolak request manual meski dikirim langsung | `npm run lint`, `npm run build` | `validated` |
| `UCW-108` | Rapikan history/detail stok agar audit trail lebih jelas dibaca | `src/pages/StockPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-107` | History movement menampilkan Masuk/Keluar, source label yang jelas, Unit Kerja, waktu, catatan singkat, dan CTA dokumen sumber ringan tanpa mengubah write path | `npm run lint`, `npm run build` | `validated` |
| `UCW-109` | Centralize role capability contract untuk gate sensitif yang sudah aktif | `src/lib/capabilities.js`, `src/components/ProtectedRoute.jsx`, `src/pages/StockPage.jsx`, `src/pages/MasterPage.jsx`, `src/pages/PayrollPage.jsx`, `src/pages/TeamInvitePage.jsx`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-108` | Capability sensitif mulai dipusatkan ke helper eksplisit agar UI gating dan server gating baca sumber yang sama, dimulai dari manual stock-out dan gate sensitif lain yang murah dipusatkan | `npm run lint`, `npm run build` | `validated` |
| `UCW-110` | Polish UI `Stok Barang` untuk aksi kontekstual dan history yang ringkas | `src/pages/StockPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-109` | Barang aktif jadi entry point aksi stok keluar, riwayat stok dibuat lebih ringkas, helper text berlebih dihapus, dan mobile usability membaik tanpa mengubah write contract | `npm run lint`, `npm run build` | `validated` |
| `UCW-111` | Migration sweep kecil gate sensitif ke capability contract terpusat | `src/components/MasterDataManager.jsx`, `src/pages/MasterFormPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, `src/components/TeamInviteManager.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-110` | Gate sensitif yang paling jelas dipindahkan dari `allowedRoles` lama ke `requiredCapability` agar UI sinkron dengan contract capability terpusat tanpa refactor RBAC menyeluruh | `npm run lint`, `npm run build` | `validated` |
| `UCW-79` | Hardening `input pemasukan murni` dan visibilitas fee bill end-to-end | `src/components/IncomeForm.jsx`, `src/store/useIncomeStore.js`, `src/pages/TransactionDetailPage.jsx`, `src/pages/PaymentPage.jsx`, `api/transactions.js` | `UCW-78`, `UCW-96` | Create/edit/delete/restore pemasukan murni aman, fee bill turunan terlihat di detail/payment/report, dan ledger tidak ambigu terhadap child bill | `npm run lint`, `npm run build` | `validated` |
| `UCW-80` | Hardening `expense umum` beserta bill, payment, dan attachment lifecycle | `src/components/ExpenseForm.jsx`, `src/store/useTransactionStore.js`, `src/pages/TransactionDetailPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `api/records.js` | `UCW-78`, `UCW-92`, `UCW-93`, `UCW-96` | Expense umum release-safe untuk create/edit/delete/restore, guard child bill/payment jelas, attachment child konsisten, dan jalur permanen delete terdokumentasi | `npm run lint`, `npm run build` | `validated` |
| `UCW-81` | Hardening `material invoice` / `surat_jalan` dan jalur konversi parent-child | `src/components/MaterialInvoiceForm.jsx`, `src/store/useTransactionStore.js`, `src/pages/TransactionDetailPage.jsx`, `api/records.js` | `UCW-78`, `UCW-80`, `UCW-92`, `UCW-93`, `UCW-96` | Faktur dan surat jalan aman untuk create/edit/delete/restore, line item tidak drift, dan konversi ke expense payable berjalan dengan guard yang jelas | `npm run lint`, `npm run build` | `validated` |
| `UCW-82` | Hardening `loan` + `loan_payments` + aturan tunggakan operasional | `src/components/LoanForm.jsx`, `src/store/useIncomeStore.js`, `src/store/usePaymentStore.js`, `src/pages/PaymentPage.jsx`, `api/transactions.js` | `UCW-78`, `UCW-93`, `UCW-96` | Pinjaman dan pembayaran pinjaman sinkron di detail/payment/report, perhitungan tunggakan terdokumentasi, dan destructive flow tidak memutus audit trail | `npm run lint`, `npm run build` | `planned` |
| `UCW-83` | Hardening `attendance` -> `salary bill` -> `payment` lifecycle | `src/components/AttendanceForm.jsx`, `src/store/useAttendanceStore.js`, `src/components/PayrollManager.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/PaymentPage.jsx`, `api/records.js`, `api/transactions.js` | `UCW-78`, `UCW-94`, `UCW-96` | Absensi, payroll bundling, salary bill detail, payment, delete, dan restore memiliki kontrak release yang eksplisit dan tidak orphan | `npm run lint`, `npm run build` | `planned` |
| `UCW-84` | Finalkan policy `master data`, usage guard, dan destructive boundary | `src/store/useMasterStore.js`, `src/pages/MasterPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, form master terkait, backend terkait bila perlu | `UCW-78`, `UCW-96` | Master data siap menjadi fondasi semua form inti, usage guard terlihat di UI, soft delete stabil, dan permanent delete per entitas diputuskan secara eksplisit | `npm run lint`, `npm run build` | `planned` |
| `UCW-124` | Hardening `Tim` agar invite dan membership lifecycle tetap selaras dengan server truth | `src/pages/TeamInvitePage.jsx`, `src/components/TeamInviteManager.jsx`, `src/store/useAuthStore.js`, `src/store/useTeamStore.js`, `api/auth.js` | `UCW-84`, `UCW-96` | Invite token dan membership status tampil konsisten dengan truth server, role/status lebih akurat di UI, dan Tim tetap terbaca sebagai core support/admin capability | `npm run lint`, `npm run build` | `validated` |
| `UCW-125` | Polish `Halaman Tim` agar layout mobile-first tetap stabil dan scan-friendly | `src/pages/TeamInvitePage.jsx`, `src/components/TeamInviteManager.jsx`, `src/pages/MorePage.jsx` | `UCW-124` | Layout Tim tidak break di mobile, hierarchy ringkas, invite state dan list anggota tetap jelas, dan action sensitif tetap mudah dipakai | `npm run lint`, `npm run build` | `validated` |
| `UCW-126` | Ganti toggle multi-opsi dengan layout wrap-safe agar mobile tidak melebar | `src/components/ui/AppPrimitives.jsx`, `src/components/TeamInviteManager.jsx`, `src/components/HrdPipeline.jsx`, `src/components/BeneficiaryList.jsx`, `src/pages/StockPage.jsx` | `UCW-124`, `UCW-125` | Toggle untuk opsi lebih dari dua tidak lagi memaksa satu baris horizontal; Tim, HRD, Beneficiary, dan Stock tetap ringkas di mobile sementara toggle dua opsi tetap memakai design existing | `npm run lint`, `npm run build` | `validated` |
| `UCW-127` | Harden smoke-flow core release lintas Dashboard, Jurnal, Pembayaran, Payroll, dan Unit Kerja | `src/pages/TransactionsPage.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/pages/PaymentPage.jsx`, `src/pages/ProjectsPage.jsx`, `src/components/ProjectReport.jsx`, `src/lib/transaction-presentation.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-87`, `UCW-124`, `UCW-125`, `UCW-126` | Naming surface aktif kembali selaras (`Jurnal` vs `Riwayat`), archive flow dari detail/payment mendarat ke `Recycle Bin`, CTA loan/payment tidak misleading, dan breakdown `Unit Kerja` bisa membuka surface sumber tanpa menambah write/domain baru | `npm run lint`, `npm run build` | `validated` |
| `UCW-128` | Implementasikan `Riwayat` v1 sebagai completed-only surface | `src/pages/HistoryPage.jsx`, `src/App.jsx`, `src/pages/TransactionsPage.jsx`, `src/lib/transactions-api.js`, `api/transactions.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-127` | `Riwayat` membaca completed/history record server-side, tetap terpisah dari `Jurnal` aktif dan `Recycle Bin` deleted/recovery, dan tidak mencampur deleted row ke histori biasa | `npm run lint`, `npm run build` | `validated` |
| `UCW-129` | Hardening detail `Riwayat` agar back-navigation dan CTA tetap completed/history-aware | `src/pages/HistoryPage.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/components/ExpenseAttachmentSection.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-128` | Detail yang dibuka dari `Riwayat` membawa context completed/history yang jelas, kembali ke `Riwayat` saat entry point-nya dari sana, dan tidak membuka CTA write/active workspace yang milik `Jurnal` | `npm run lint`, `npm run build` | `validated` |
| `UCW-130` | Hardening detail `Recycle Bin` agar back-navigation dan CTA tetap deleted/recovery-aware | `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/DeletedTransactionDetailPage.jsx`, `src/App.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-129` | Detail yang dibuka dari `Recycle Bin` membawa context deleted/recovery yang jelas, kembali ke `Recycle Bin` secara eksplisit, dan tidak membuka CTA write/active workspace yang milik surface lain | `npm run lint`, `npm run build` | `validated` |
| `UCW-85` | Seragamkan `soft delete`, `restore`, dan `permanent delete` lintas domain inti | `api/transactions.js`, `api/records.js`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, store/detail terkait | `UCW-79`, `UCW-80`, `UCW-81`, `UCW-82`, `UCW-83`, `UCW-84` | Setiap domain inti punya matriks delete yang jelas: boleh, diblokir, cara restore, dan kapan permanent delete aman dijalankan | `npm run lint`, `npm run build` | `validated` |
| `UCW-86` | Finalkan attachment platform lintas core feature termasuk bukti bayar | `src/store/useFileStore.js`, `src/components/ExpenseAttachmentSection.jsx`, payment forms/pages terkait, `api/records.js`, helper/schema bila perlu | `UCW-80`, `UCW-81`, `UCW-82`, `UCW-83` | Expense, invoice, salary/payment proof, dan dokumen inti lain berbagi policy upload, preview, cleanup orphan, dan role matrix yang seragam | `npm run lint`, `npm run build` | `validated` |
| `UCW-87` | Hardening `Unit Kerja` summary agar report hanya membaca server truth final | `src/store/useReportStore.js`, `src/lib/reports-api.js`, `src/components/ProjectReport.jsx`, `api/records.js` | `UCW-79`, `UCW-80`, `UCW-81`, `UCW-82`, `UCW-83`, `UCW-85`, `UCW-95` | Summary `Unit Kerja` dan portfolio overview membaca `vw_project_financial_summary` / `api/records` server-side, agregasi lintas domain tidak dihitung liar di client, dan layar report tetap ringkas mobile-first | `npm run lint`, `npm run build`, audit data mapping | `validated` |
| `UCW-88` | Deliver PDF bisnis user-facing dan `pdf_settings` dari app | `docs/prd-core-feature-release-2026-04-18.md`, `src/store/useReportStore.js`, UI report/settings terkait, `api/notify.js` atau service PDF baru, `api/records.js`, `supabase/migrations/*` bila perlu | `UCW-87`, `UCW-95` | Minimal satu PDF bisnis profesional bisa diunduh dari app, `pdf_settings` punya boundary UI yang jelas, dan PDF notifikasi Telegram tidak lagi menjadi satu-satunya artefak PDF | `npm run lint`, `npm run build`, uji manual export | `validated` |
| `UCW-89` | Hardening mobile-first dan scalable data untuk release core | `src/components/layouts/FormLayout.jsx`, `src/components/ui/*`, `src/pages/TransactionsPage.jsx`, halaman report terkait, picker/list helpers | `UCW-84`, `UCW-86`, `UCW-87`, `UCW-95` | List besar, picker master, ledger, dan report dataset tetap usable di mobile tanpa menunggu gelombang polish UI besar berikutnya | `npm run lint`, `npm run build` | `validated` |
| `UCW-90` | Audit release readiness core feature end-to-end (backend + frontend) | `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`, `src/App.jsx`, `src/pages/*`, `src/store/*`, `src/components/*`, `api/*`, `supabase/migrations/*` | `UCW-85`, `UCW-86`, `UCW-87`, `UCW-88`, `UCW-89` | Ada gap matrix backend/frontend terhadap freeze contract final, residual legacy gates sudah dibekukan dan tidak dihitung sebagai blocker, urutan micro-task implementasi berikutnya tertulis eksplisit, dan blocker release inti terpisah jelas sebelum coding | audit dokumen + `rg` mapping repo | `validated` |
| `UCW-169` | Pusatkan boundary `auth/workspace` dan `master` agar runtime exception tidak menyebar | `src/store/useTeamStore.js`, `src/store/useMasterStore.js`, `src/lib/capabilities.js`, `src/components/ProtectedRoute.jsx`, `src/pages/TeamInvitePage.jsx`, `src/pages/MasterPage.jsx`, `src/pages/MasterFormPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, `api/auth.js`, `api/records.js` | `UCW-90`, `UCW-96`, `UCW-84` | Direct-write transisional untuk `Tim` dan boundary runtime `Master` dipusatkan ke contract yang eksplisit; `Master` tetap core-release fondasional walau implementasinya sementara transitional, UI/server capability gate baca contract yang sama, dan exception runtime terdokumentasi tanpa memperluas pola inti | audit dokumen + mapping repo | `validated` |
| `UCW-171` | Buka create/edit `Barang` di master/reference dengan backing contract `materials` | `src/components/master/masterTabs.js`, `src/pages/MasterFormPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-90`, `UCW-169`, `UCW-170` | Tab `Barang` aktif dari contract `materials`, route legacy `material` tetap kompatibel, create/edit material terhydrate ke form master, dan label recycle bin konsisten tanpa rename internal | `rg`, `npm.cmd run lint`, `npm run build`, manual browser check | `blocked` |
| `UCW-172` | Selaraskan write contract `expense_type` saat simpan faktur agar check constraint tidak gagal | `src/components/MaterialInvoiceForm.jsx`, `src/store/useTransactionStore.js`, `api/records.js`, `supabase/migrations/*`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-81`, `UCW-90` | Save/update faktur atau surat jalan tidak lagi memicu error `expenses_expense_type_check` 23514 karena canonical write value `expense_type='material'` selaras dengan schema final, sementara read path tetap kompatibel dengan row legacy `material_invoice` bila masih ada | `rg`, `npm.cmd run lint`, `npm run build`, manual create/save faktur | `blocked` |
| `UCW-175` | Pastikan notifikasi loan create tetap audit-passed dan sediakan PDF receipt user-facing terpisah dari PDF bisnis | `src/store/useIncomeStore.js`, `src/store/usePaymentStore.js`, `src/pages/PaymentPage.jsx`, `src/lib/report-pdf.js`, `api/notify.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-88`, `UCW-90` | Audit menunjukkan create loan hanya lewat entrypoint yang sudah menempel notify Telegram, payment history punya receipt PDF user-facing sendiri dengan tombol unduh, dan kwitansi Telegram tetap terpisah dari receipt bisnis | `rg`, `npm.cmd run lint`, `npm run build`, manual browser check receipt | `blocked` |
| `UCW-176` | Seragamkan komposisi row list global dan hilangkan tombol `More` | `src/components/ui/ActionCard.jsx`, `src/components/ui/AppPrimitives.jsx`, `src/lib/transaction-presentation.js`, `api/transactions.js`, `src/pages/Dashboard.jsx`, `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/components/PayrollAttendanceHistory.jsx`, `src/components/MasterDataManager.jsx`, `src/components/BeneficiaryList.jsx`, `src/components/TeamInviteManager.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-90`, `UCW-173`, `UCW-174` | Komposisi row yang dipakai lintas list menjadi seragam dari kiri ke kanan: icon, title, tanggal, nominal, lalu badge nama user yang terbaca; tap row membuka bottom sheet aksi; tombol `More` di semua list terdampak dihapus; creator badge tidak lagi menampilkan Telegram ID mentah | `rg`, audit payload/row pattern, `npm.cmd run lint`, `npm run build`, manual tap row vs sheet | `validated` |
| `UCW-177` | Audit dan perbaiki RLS `stock_transactions` agar simpan faktur/material invoice tidak gagal `42501` | `supabase/migrations/20260411190000_setup_telegram_auth_rbac_rls.sql`, `supabase/migrations/20260411200000_strict_alignment_master_expenses_loans.sql`, `api/records.js`, `src/store/useTransactionStore.js`, `src/components/MaterialInvoiceForm.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-22`, `UCW-103` | Insert/update/delete `stock_transactions` punya policy yang sesuai dengan flow save faktur/surat jalan, dan error RLS 42501 tidak lagi memblokir simpan invoice material | audit policy + `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-178` | Audit delivery notifikasi create `loan` dan surface kegagalan `/api/notify` dari entrypoint aktif | `src/components/LoanForm.jsx`, `src/store/useIncomeStore.js`, `api/notify.js`, `src/lib/transactions-api.js`, `api/transactions.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-175`, `UCW-176` | Create `loan` tetap memakai satu entrypoint notify yang tervalidasi, tetapi kegagalan `/api/notify` atau konfigurasi Telegram tidak lagi silent; record kasbon tetap tersimpan dan user/operator mendapat warning yang bisa diaudit saat chat bot gagal | audit entrypoint + `rg` + `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-179` | Tutup celah overpayment saat edit/restore pembayaran `loan` dan `bill` | `api/transactions.js`, `api/records.js`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/store/usePaymentStore.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-90`, `UCW-175` | Update `loan_payment`, restore `loan_payment`, dan restore `bill_payment` tidak bisa membuat total `paid_amount` parent melebihi target; pesan error konsisten lintas active flow dan recycle bin; status parent tetap sinkron setelah edit/restore | audit sibling-payment guard + `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-180` | Seragamkan payload notifikasi `Pembayaran` ke truth server pasca write | `src/store/usePaymentStore.js`, `src/pages/PaymentPage.jsx`, `api/records.js`, `api/transactions.js`, `api/notify.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-175`, `UCW-179` | Notifikasi bill/loan payment dibangun dari response server final `payment` + parent `bill/loan`, bukan dari kalkulasi client pra-submit, sehingga nominal tersisa dan status settlement yang dikirim ke Telegram selalu cocok dengan hasil server | audit notify payload + `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-181` | Selaraskan rekap payroll dengan eligible rows server dan deskripsi tagihan final | `src/pages/PayrollPage.jsx`, `api/records.js`, `supabase/migrations/20260419103000_fix_salary_bill_function_runtime_and_scope.sql`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-90`, `UCW-173` | Deskripsi `Tagihan Upah`, toast hasil, dan notifikasi Telegram memakai `attendanceCount`/`totalAmount` yang benar-benar diproses server; partial recap tidak lagi menyimpan jumlah absensi atau nominal yang salah ketika server memfilter row eligible | audit recap payload + `npm.cmd run lint`, `npm run build`, manual rekap payroll | `validated` |
| `UCW-182` | Tambahkan bypass auth Telegram lokal untuk smoke test browser | `src/store/useAuthStore.js`, `src/lib/dev-auth-bypass.js`, `api/auth.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-90`, `UCW-169` | Browser lokal bisa bootstrap auth/session nyata tanpa container Telegram lewat bypass dev yang eksplisit, memakai owner Telegram env sebagai identitas default, dan tidak mengubah jalur auth production atau kontrak API core | `rg`, `npm.cmd run lint`, `npm run build`, smoke auth browser lokal | `validated` |
| `UCW-183` | Audit smoke Chrome untuk core CRUD, payment, dan restore pasca bypass lokal | `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-182` | Ada bukti browser untuk dashboard, jurnal, detail/edit, payment bill/loan, material invoice, recycle bin, dan restore; error console/network dan boundary pertama yang rusak tercatat jelas; follow-up task diturunkan spesifik dari temuan nyata | `browser smoke audit + capture console/network`, `npm.cmd run lint`, `npm run build` bila task `UCW-182` menyentuh runtime | `validated` |
| `UCW-187` | Pulihkan read model `Jurnal` / `Riwayat` yang gagal `User not allowed` pada session owner valid | `api/transactions.js`, `supabase/migrations/20260420090000_create_vw_workspace_transactions.sql`, `supabase/migrations/20260420113000_create_vw_history_transactions.sql`, `src/lib/transactions-api.js`, `src/pages/Dashboard.jsx`, `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-183` | Owner/session valid bisa memuat branch workspace `Dashboard`, `Jurnal`, dan `Riwayat` tanpa 500 `User not allowed`; penyebab RLS/view/auth-context terdokumentasi jelas; branch summary, recycle bin, dan payment yang sudah sehat tidak diregresikan | `browser smoke audit`, `npm.cmd run lint`, `npm run build`, audit query/view/RLS | `validated` |
| `UCW-188` | Perbaiki restore `bill_payment` yang mengembalikan 200 tetapi tidak benar-benar memulihkan row | `api/records.js`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/PaymentPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-183` | Restore payment bill benar-benar menghapus `deleted_at`, item hilang dari `Halaman Sampah`, histori pembayaran aktif muncul lagi, dan total parent bill ikut sinkron; audit field-mapping restore bill/loan tidak lagi mismatch camelCase vs snake_case | `browser archive/restore smoke`, `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-189` | Audit smoke Chrome lanjutan untuk create/edit/delete/restore/payment/payroll/material flow | `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-182`, `UCW-183` | Ada bukti browser + DB untuk state lokal auth, create payment bill/loan, archive payment, restore recycle bin, create/edit material flow, dan attendance/payroll; blocker baru dipisah menjadi task sempit yang tidak tumpang tindih dengan `UCW-187` / `UCW-188` | `browser smoke audit`, audit query DB, `npm.cmd run lint`, `npm run build` bila runtime berubah | `validated` |
| `UCW-190` | Pulihkan create route berbasis `EditRecordPage` yang menggantung atau menjatuhkan `vercel dev` pada `/edit/*/new` | `src/App.jsx`, `src/pages/EditRecordPage.jsx`, `src/components/ui/BottomNav.jsx`, `src/store/useTransactionStore.js`, `src/store/useIncomeStore.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-189` | Route create `Pengeluaran` dan `Pinjaman` terbuka konsisten dari quick action `/edit/expense/new` dan `/edit/loan/new`, lazy route tidak lagi tertahan pada fetch module `src/pages/EditRecordPage.jsx`, dan `vercel dev` tidak crash saat smoke create dijalankan | `browser smoke create route`, `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-191` | Perbaiki hydrate sheet `Absensi Harian` yang berhenti di state loading meski fetch master + attendance 200 | `src/pages/AttendancePage.jsx`, `src/components/AttendanceForm.jsx`, `src/store/useAttendanceStore.js`, `src/store/useMasterStore.js`, `src/lib/records-api.js`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-189` | `attendance/new` merender worker row yang bisa diedit setelah master data dan `GET /api/records?resource=attendance` sukses; spinner `Memuat worker dan absensi...` tidak tertahan; create attendance dan jalur rekap harian kembali bisa diuji dari browser | `browser smoke attendance/new + payroll`, `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-192` | Perbaiki create `surat_jalan` yang masih memicu `bills_status_check` 23514 di `material-invoices` | `src/components/MaterialInvoiceForm.jsx`, `src/store/useTransactionStore.js`, `api/records.js`, `supabase/migrations/20260419104000_allow_non_expense_bills.sql`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-177`, `UCW-189` | Wizard `material-invoice/new` dalam mode `Surat Jalan` bisa tersimpan dari browser tanpa memaksa insert `bills.status` yang melanggar constraint; row surat jalan dan stock movement tercipta sesuai contract tanpa meregresikan flow `Faktur` | `browser smoke create surat jalan`, `npm.cmd run lint`, `npm run build`, audit insert bill/material invoice | `validated` |
| `UCW-193` | Perbaiki soft delete `material invoice` yang gagal rollback stok dengan `materials.current_stock` null violation | `src/pages/EditRecordPage.jsx`, `src/store/useTransactionStore.js`, `api/records.js`, `supabase/migrations/20260419090000_create_atomic_manual_stock_out_function.sql`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-177`, `UCW-189` | Tombol `Hapus` pada edit material invoice melakukan soft delete tanpa error `materials_current_stock` 23502, stock rollback/cleanup tetap konsisten, dan record bisa muncul benar di `Halaman Sampah` untuk flow restore selanjutnya | `browser delete smoke material invoice`, `npm.cmd run lint`, `npm run build`, audit stock rollback SQL/API | `validated` |
| `UCW-194` | Smoke create `loan` saja | `src/components/LoanForm.jsx`, `src/store/useIncomeStore.js`, `src/pages/PaymentPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-182`, `UCW-189` | Satu aksi `create loan` dijalankan end-to-end dari browser, hasilnya dicatat ringkas, dan bila ada blocker/bug maka perbaikannya dipecah ke backlog task terpisah | browser smoke create loan + catatan hasil | `validated` |
| `UCW-195` | Smoke update `expense` saja | `src/pages/EditRecordPage.jsx`, `src/store/useTransactionStore.js`, `src/pages/TransactionsPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-182`, `UCW-189` | Satu aksi `update expense` dijalankan end-to-end dari browser, hasilnya dicatat ringkas, dan bila ada blocker/bug maka perbaikannya dipecah ke backlog task terpisah | browser smoke update expense + catatan hasil | `validated` |
| `UCW-196` | Smoke delete `material invoice` saja | `src/pages/EditRecordPage.jsx`, `src/store/useTransactionStore.js`, `src/pages/TransactionsRecycleBinPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-182`, `UCW-189` | Satu aksi `delete material invoice` dijalankan end-to-end dari browser, hasilnya dicatat ringkas, dan bila ada blocker/bug maka perbaikannya dipecah ke backlog task terpisah | browser smoke delete material invoice + catatan hasil | `validated` |
| `UCW-197` | Smoke payment `bill` saja | `src/pages/PaymentPage.jsx`, `src/store/usePaymentStore.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-182`, `UCW-189` | Satu aksi `payment bill` dijalankan end-to-end dari browser, hasilnya dicatat ringkas, dan bila ada blocker/bug maka perbaikannya dipecah ke backlog task terpisah | browser smoke bill payment + catatan hasil | `validated` |
| `UCW-198` | Smoke record `attendance` saja | `src/pages/AttendancePage.jsx`, `src/components/AttendanceForm.jsx`, `src/store/useAttendanceStore.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-182`, `UCW-189` | Satu aksi `record attendance` dijalankan end-to-end dari browser, hasilnya dicatat ringkas, dan bila ada blocker/bug maka perbaikannya dipecah ke backlog task terpisah | browser smoke attendance record + catatan hasil | `validated` |
| `UCW-199` | Smoke payment `loan` saja | `src/pages/PaymentPage.jsx`, `src/store/usePaymentStore.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-182`, `UCW-189` | Satu aksi `payment loan` dijalankan end-to-end dari browser, hasilnya dicatat ringkas, dan bila ada blocker/bug maka perbaikannya dipecah ke backlog task terpisah | browser smoke loan payment + catatan hasil | `validated` |
| `UCW-200` | Smoke restore `bill_payment` saja | `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/PaymentPage.jsx`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-182`, `UCW-189` | Satu aksi `restore bill_payment` dijalankan end-to-end dari browser, hasilnya dicatat ringkas, dan bila ada blocker/bug maka perbaikannya dipecah ke backlog task terpisah | browser smoke restore bill_payment + catatan hasil | `validated` |
| `UCW-201` | Smoke permanent delete `loan_payment` saja | `src/pages/TransactionsRecycleBinPage.jsx`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-182`, `UCW-189` | Satu aksi `permanent delete loan_payment` dijalankan end-to-end dari browser, hasilnya dicatat ringkas, dan bila ada blocker/bug maka perbaikannya dipecah ke backlog task terpisah | browser smoke permanent delete loan_payment + catatan hasil | `validated` |
| `UCW-202` | Perbaiki payload notifikasi create `loan` yang masih membuat `/api/notify` gagal 500 sesudah insert sukses | `src/store/useIncomeStore.js`, `api/notify.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-194` | Create `loan` tetap sukses dan call `/api/notify` ikut 200 dengan `principalAmount`, `repaymentAmount`, dan label kreditur yang valid; warning toast notifikasi tidak lagi muncul pada create loan dev smoke | browser smoke create loan, audit payload `/api/notify`, `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-203` | Samakan guard UI edit `expense` dengan guard backend ketika expense sudah punya payment history | `src/pages/EditRecordPage.jsx`, `src/components/ExpenseForm.jsx`, `src/store/useTransactionStore.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-195` | User tidak bisa melakukan edit semu pada `expense` yang sudah punya payment history tanpa guard yang jelas sebelum submit, atau tersedia fixture edit yang valid sehingga smoke `update expense` bisa selesai end-to-end tanpa PATCH 400 setelah field diubah | browser smoke update expense, audit request `PATCH /api/records?resource=expenses`, `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-204` | Pulihkan soft delete `material invoice` yang kembali gagal rollback stok dengan error `P0001` | `api/records.js`, `supabase/migrations/*`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-196` | Tombol `Hapus` pada material invoice aktif kembali memindahkan record ke recycle bin tanpa 500 `Stok material ... tidak mencukupi`, dan rollback stok tetap konsisten di DB | browser smoke delete material invoice, audit stock rollback SQL/API, `npm.cmd run lint`, `npm run build` | `blocked` |
| `UCW-205` | Perbaiki permanent delete `loan_payment` yang 200 tetapi row tetap soft-deleted di recycle bin | `api/transactions.js`, `src/pages/TransactionsRecycleBinPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-201` | Aksi `Hapus Permanen` benar-benar menghapus row `loan_payments` dari DB, item hilang dari `Halaman Sampah` tanpa reload ganda, dan detail parent loan tidak kembali memuat payment yang sudah dihapus permanen | browser smoke permanent delete loan payment, audit SQL `loan_payments`, `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-206` | Finalkan contract delete `material invoice` saat stok sumber sudah dipakai mutasi lain | `docs/freeze/03-source-of-truth-contract-map.md`, `api/records.js`, `src/pages/EditRecordPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-204` | Ada keputusan final yang eksplisit apakah delete harus diblok lebih awal di UI, atau rollback stok harus dependency-aware; smoke delete `material invoice` mengikuti rule yang sama tanpa 500 dan tanpa ambiguity stok | audit contract delete dokumen barang, browser smoke delete material invoice, `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-207` | Audit menyeluruh bottleneck loading `Jurnal` / `Riwayat` / `Halaman Sampah` / `Catatan Absensi` / `Stok Barang` vs list `Aktivitas terbaru` di dashboard | `src/pages/Dashboard.jsx`, `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/components/PayrollAttendanceHistory.jsx`, `src/pages/StockPage.jsx`, `src/store/useDashboardStore.js`, `src/lib/transactions-api.js`, `src/lib/records-api.js`, `src/components/ui/ActionCard.jsx`, `api/transactions.js`, `api/records.js`, `supabase/migrations/20260420090000_create_vw_workspace_transactions.sql`, `supabase/migrations/20260420113000_create_vw_history_transactions.sql`, `supabase/migrations/20260420150000_create_vw_recycle_bin_records.sql`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | - | Ada diagnosis repo + DB terukur yang menjelaskan kenapa dataset yang masih kecil tetap terasa lambat, perbedaan perilaku dashboard vs route khusus tertulis jelas, dan backlog solusi berikutnya terpecah menjadi task sempit yang bisa dieksekusi bertahap tanpa refactor liar | audit code path + `mcp__supabase__.execute_sql` count/explain + pembandingan dashboard/list | `validated` |
| `UCW-208` | Pangkas fixed overhead auth/profile/team lookup pada endpoint read list inti | `api/transactions.js`, `api/records.js`, helper auth/context terkait, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-207` | Read endpoint `Jurnal`, `Riwayat`, `Halaman Sampah`, `Catatan Absensi`, dan `Stok Barang` tidak lagi membayar round-trip terpisah yang redundant untuk auth user -> profile -> team access pada setiap request; latency tetap turun tanpa mengubah contract akses workspace | audit code path + `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-209` | Seed `Jurnal` dari cache dashboard lalu revalidate page pertama di background | `src/store/useDashboardStore.js`, `src/pages/TransactionsPage.jsx`, `src/lib/transactions-api.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-207` | Navigasi `Dashboard -> Jurnal` langsung menampilkan seed row dari `workspaceTransactions` / snapshot yang sudah hangat, lalu page pertama direkonsiliasi di background; skeleton penuh tidak muncul lagi saat data yang ditampilkan sebenarnya sama | browser compare `Dashboard -> Jurnal`, `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-210` | Ringankan render list `Jurnal` / `Riwayat` / `Halaman Sampah` dengan shared action sheet | `src/components/ui/ActionCard.jsx`, `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-207` | Initial render list tidak lagi membuat banyak `AppSheet` tersembunyi per-row sekaligus; aksi tetap tersedia lewat satu sheet shared untuk row aktif dan mount cost route turun jelas di mobile | browser render audit + `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-211` | Ubah `Catatan Absensi` menjadi summary-first dengan detail on-demand | `src/components/PayrollAttendanceHistory.jsx`, `src/lib/records-api.js`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-207` | `Catatan Absensi` tidak lagi hydrate seluruh record bulanan lalu menggandakan grouping `daily` + `worker` pada initial load; summary group ringan dimuat dulu dan detail record per group baru diambil saat sheet/detail dibuka | browser compare payroll load, `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-212` | Tunda fetch `stock-project-options` sampai sheet stock-out benar-benar dibuka | `src/pages/StockPage.jsx`, `src/lib/records-api.js`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-207` | `Stok Barang` first paint hanya menunggu overview stok; request opsi `Unit Kerja` baru jalan saat sheet manual stock-out dibuka sehingga route tidak lagi fan-out dua request pada mount untuk user yang belum tentu memakai action itu | browser compare stock first paint, `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-213` | Normalisasi sisa timestamp non-core agar tidak lagi jatuh ke jam `07.00` dari field date-only | `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, `src/lib/report-pdf.js`, `api/notify.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-207` | Surfaces non-core yang masih memakai field date-only atau formatter datetime generik dipetakan tegas ke date label atau realtime timestamp yang benar, tanpa merusak semantics due date dan recycle bin | audit callsite + browser compare + `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-216` | Pulihkan CTA bayar untuk faktur material unpaid dari parent-child bill | `api/transactions.js`, `api/records.js`, `src/lib/records-api.js`, `src/lib/transaction-presentation.js`, `src/pages/TransactionsPage.jsx`, `src/pages/TransactionDetailPage.jsx` | `UCW-09`, `UCW-04` | `Faktur Material` yang masih `unpaid` menampilkan CTA `Bayar` di list/detail ketika child bill memang ada; status pengganti atau guard tetap jelas kalau parent belum punya bill child yang valid | audit data shape parent-child + `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-217` | Rapikan label filter ledger workspace agar sesuai UX kategori | `src/lib/transaction-presentation.js`, `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-09` | Filter `Surat Jalan` tidak lagi tercampur dengan `Faktur Material`, label payroll menjadi `Gaji/Upah`, dan `Dana Masuk / Pinjaman` diringkas menjadi `Pinjaman` tanpa mengubah predicate filter | audit label/filter UX + `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-218` | Render shell `PaymentPage` lebih awal lalu hydrate field bertahap | `src/pages/PaymentPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-214` | Route pembayaran menampilkan shell UI lengkap segera, field dan tombol aksi aktif setelah data selesai ter-hydrate, dan layar blank / skeleton penuh tidak lagi mendominasi first paint | audit route payment + `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-219` | Smoke create berantai untuk loan, expense, faktur, income, dan surat jalan | `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-182`, `UCW-189`, `UCW-218` | Ada bukti smoke create berurutan untuk lima domain inti dengan auth bypass lokal: loan, expense, faktur material, pemasukan proyek, dan surat jalan; hasil create dan child record terkait tercatat jelas | audit result DB/API + catatan smoke | `validated` |
| `UCW-220` | Perbaiki create `project income` yang gagal saat trigger fee bill `ON CONFLICT` | `supabase/migrations/20260417193000_add_project_income_fee_bills_and_loan_payment_status.sql`, `supabase/migrations/20260421190000_fix_project_income_fee_bill_unique_index.sql`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-219` | Insert `project_income` tidak lagi gagal `42P10` saat trigger fee bill berjalan; fee bill child untuk staff termin/fixed termin tetap tercipta dan smoke create income bisa lolos penuh | audit trigger fee bill + DB smoke create project income | `validated` |
| `UCW-221` | Samakan urutan default `Jurnal` / `Riwayat` ke timestamp realtime surface terbaru | `api/transactions.js`, `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `supabase/migrations/20260421200000_update_workspace_transaction_sort_order.sql`, `supabase/migrations/20260421200500_realign_workspace_transaction_sort_order_to_surface_time.sql`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-209`, `UCW-210` | `Jurnal` dan `Riwayat` default sort kini mengikuti timestamp realtime saat record terakhir muncul/berubah di surface (`created_at` / `updated_at` / `bill_paid_at`), bukan lagi jatuh ke field date-only; item terbaru konsisten muncul paling atas di semua filter | audit view ordering + `npm.cmd run lint`, `npm.cmd run build`, query `vw_workspace_transactions` | `validated` |
| `UCW-222` | Perbaiki shell `PaymentPage` agar tidak flash lalu blank saat hydrate detail | `src/pages/PaymentPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-218` | Route pembayaran selalu mempertahankan shell UI saat fetch detail berjalan; seed route state tetap dipakai sebagai fallback display, field/tombol aman di-guard sampai hydrate selesai, dan error refresh tidak lagi menjatuhkan layar ke blank state | audit render shell + `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-223` | Perbaiki restore `surat jalan` yang gagal `current_stock` null dan audit domain restore lain | `api/records.js`, `src/pages/TransactionsRecycleBinPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-181` | Restore dokumen material (`faktur` / `surat jalan`) tidak lagi membentuk delta stok `NaN` yang jatuh ke `current_stock = null`; audit code path juga memastikan domain restore lain tidak melewati helper stok yang sama sehingga tidak terkena akar masalah ini | audit helper restore + `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-224` | Pulihkan tap row `Catatan Absensi` agar membuka bottom sheet aksi, bukan blank screen | `src/components/PayrollAttendanceHistory.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-211`, `UCW-176` | Tap row di tab `Harian` dan `Pekerja` kembali membuka bottom sheet aksi yang stabil; state action tidak lagi bercampur dengan state loading/detail sehingga list `Catatan Absensi` tidak jatuh ke layar blank saat row ditekan | audit row interaction + `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-225` | Buat form edit absensi unbilled agar status bisa diubah dari editor record | `src/pages/EditRecordPage.jsx`, `src/store/useAttendanceStore.js`, `src/lib/records-api.js`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-224`, `UCW-94` | Record `attendance_records` dengan status `unbilled` bisa diedit dari editor record, status `full_day`/`half_day`/`overtime`/`absent` tersimpan aman bersama `total_pay` baru, dan record billed/linked tetap terkunci | `npm.cmd run lint`, `npm.cmd run build`, browser smoke edit attendance unbilled | `audit_required` |
| `UCW-226` | Hardening shell `PaymentPage` dari row action dan ringkas form absensi harian untuk mobile | `src/pages/PaymentPage.jsx`, `src/components/AttendanceForm.jsx`, `src/pages/AttendancePage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-222`, `UCW-94` | Payment page dari row action workspace tetap mempertahankan shell saat hydrate gagal/null, sementara form absensi harian jadi lebih ringkas: KPI lebih padat, control strip lebih hemat ruang, tombol navigasi tambahan dihapus, dan toggle status worker tidak lagi melebar horizontal | `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-227` | Tambahkan custom fee lembur pada status absensi overtime | `src/components/AttendanceForm.jsx`, `src/pages/EditRecordPage.jsx`, `src/store/useAttendanceStore.js`, `src/lib/attendance-payroll.js`, `api/records.js`, `supabase/migrations/20260421193000_add_overtime_fee_to_attendance_records.sql`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-226`, `UCW-225` | Saat status `overtime` dipilih, form absensi menampilkan input fee lembur custom, total upah dihitung dari base wage + fee lembur, nilai fee tersimpan ke record, dan jalur sheet/edit tetap konsisten | `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-228` | Hapus field catatan opsional di row worker form absensi | `src/components/AttendanceForm.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-226`, `UCW-227` | Row worker di `AttendanceForm` tidak lagi menampilkan input catatan yang berlebihan; form tetap menyimpan status dan fee lembur, tetapi UX tiap worker jadi lebih ringkas dan fokus ke input yang dipakai | `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-229` | Redesign shell row worker absensi agar mengikuti row list global | `src/components/AttendanceForm.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-228` | Row worker memakai komposisi list global: icon di kiri, nama dan role di tengah, nominal dan badge status di kanan atas, lalu row menjadi trigger untuk membuka bottom sheet detail | `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-230` | Pindahkan aksi status absensi ke bottom sheet grid 2x2 dan collapse role switch | `src/components/AttendanceForm.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-229` | Klik row membuka bottom sheet aksi berisi grid 2x2 untuk status kehadiran, lalu section collapse untuk worker dengan lebih dari satu role/wage agar pergantian role tetap hemat ruang | `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-231` | Ringkas KPI absensi harian ke grid horizontal 3:1 | `src/components/AttendanceForm.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-230` | KPI atas berubah jadi grid horizontal 3:1: total upah kalkulasi mengambil 3 bagian ruang dan tombol gear pengaturan massal mengambil 1 bagian ruang; tile total upah membuka bottom sheet KPI berisi komposisi 1-2-2 agar detail tetap tersedia tanpa memakan ruang form utama | `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-232` | Ubah pengaturan massal absensi ke gear icon dan bottom sheet grid 2-2-1 | `src/components/AttendanceForm.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-231` | Tombol pengaturan semua menjadi icon gear pada bar KPI, lalu bottom sheet mass action memakai grid 2-2-1 dengan reset semua sebagai aksi terakhir yang paling jelas | `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-233` | Ringkas card Sheet Harian di atas KPI untuk mobile | `src/components/AttendanceForm.jsx`, `src/components/ui/MasterPickerField.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-228` | Section di atas KPI berubah jadi dua baris grid 1:1: tanggal + proyek satu baris, search + salin kemarin satu baris, supaya row worker lebih banyak terlihat saat form pertama kali dibuka di mobile | `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-234` | Pulihkan save lembur dan baca absensi saat `overtime_fee` belum ada di schema cache | `api/records.js`, `src/components/AttendanceForm.jsx`, `src/pages/EditRecordPage.jsx`, `supabase/migrations/20260421194500_refresh_attendance_records_overtime_fee_schema_cache.sql`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-227`, `UCW-233` | Save absensi status `overtime`, first open form absensi, edit attendance, dan history tetap aman; bila kolom `overtime_fee` tersedia maka dipakai normal, tetapi bila schema cache/live DB belum punya kolom itu query/update retry tanpa field tersebut dan fee tetap bisa diderivasi dari `total_pay` | `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-235` | Kunci satu worker satu record per hari/proyek dan rule lintas role | `src/components/AttendanceForm.jsx`, `src/pages/EditRecordPage.jsx`, `src/store/useAttendanceStore.js`, `src/lib/records-api.js`, `api/records.js`, `supabase/migrations/20260421210000_add_unique_attendance_worker_date_project.sql`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-234`, `UCW-227` | Sheet absensi pada tanggal/proyek yang sama tetap membuka record existing yang sudah terisi, worker tidak bisa dobel input pada kombinasi worker-hari-proyek yang sama, dan jika satu worker sudah `half_day` pada proyek yang sama maka role lain di proyek yang sama hanya boleh melanjutkan dengan `half_day` atau `overtime`, sementara lintas proyek tetap boleh sesuai source of truth | `npm.cmd run lint`, `npm.cmd run build`, smoke attendance same-day/same-project cross-role | `validated` |
| `UCW-236` | Stabilkan detail worker di `Catatan Absensi` supaya record/billed/unbilled tidak nol | `src/components/PayrollAttendanceHistory.jsx`, `src/lib/records-api.js`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-224` | Detail tab `Pekerja` mengisi `Record`, `Billed`, dan `Unbilled` dari hasil hydrate yang sama dengan summary atau fallback cache saat fetch detail kosong; kartu detail tidak lagi jatuh ke `0/0/0` untuk worker yang punya riwayat | `npm.cmd run lint`, `npm.cmd run build`, smoke detail worker history | `validated` |
| `UCW-237` | Redesign form edit absensi agar minimalis dan sejajar create sheet | `src/pages/EditRecordPage.jsx`, `src/components/AttendanceForm.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-225`, `UCW-226` | Form edit absensi mengikuti pattern create: shell sectioned yang ringkas, info penting di atas, kontrol status/edit seperlunya, tanpa blok ringkasan berlapis yang tidak dipakai untuk operasi edit harian | `npm.cmd run lint`, `npm.cmd run build`, browser smoke edit attendance | `validated` |
| `UCW-238` | Bangun baseline Playwright smoke suite untuk core CRUD/payment/report | `playwright.config.*`, `tests/e2e/**`, `src/lib/dev-auth-bypass.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-214`, `UCW-235`, `UCW-237` | Ada suite E2E Playwright yang stabil untuk auth bypass, create/update/delete/payment/restore, rekap/report, dan Telegram WebApp shell; suite bisa jalan di dev server lokal dengan mobile emulation dan menghasilkan smoke gate yang bisa diulang | `npx playwright test`, `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-239` | Pulihkan tree `bill` saat restore dan hitung ulang settlement summary parent | `api/transactions.js`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-200`, `UCW-205` | Restore `bill` dari recycle bin menghidupkan kembali child payment yang sebelumnya ikut di-soft-delete, lalu parent bill dikalkulasi ulang server-side agar `paid_amount`, `status`, dan `paid_at` kembali sinkron dengan histori payment | `npm.cmd run lint`, `npm.cmd run build`, audit code path restore bill/payment | `validated` |
| `UCW-240` | Smoke restore Playwright untuk tree `bill` dan `bill_payment` | `tests/e2e/restore.spec.js` | `UCW-239` | Smoke Playwright memverifikasi restore tree `bill` dan restore leaf `bill_payment` berjalan konsisten di browser lokal tanpa mengubah runtime code | `npx playwright test tests/e2e/restore.spec.js --project=chromium` | `validated` |
| `UCW-242` | Standarkan entrypoint `PaymentPage` ke route standalone fullscreen | `src/lib/transaction-presentation.js`, `src/pages/TransactionsPage.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/pages/PaymentsPage.jsx`, `src/pages/PaymentPage.jsx` | `UCW-214`, `UCW-222`, `UCW-226` | Launch point pembayaran dari row Jurnal/detail dan halaman Pembayaran memakai route standalone `/payment/:id` / `/loan-payment/:id` agar shell `PaymentPage` tampil fullscreen konsisten seperti form create, sambil menjaga deep link legacy `/pembayaran/*` tetap kompatibel | `npm.cmd run lint`, `npm run build`, manual browser compare row action vs standalone route | `audit_required` |
| `UCW-243` | Pusatkan recap salary bill hanya di tab `Pekerja` | `src/components/PayrollAttendanceHistory.jsx`, `src/pages/PayrollPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-94`, `UCW-242` | Aksi `Rekap` hanya muncul di tab `Pekerja`; tab `Harian` tetap untuk inspeksi harian dan detail, sehingga operator tidak lagi masuk jalur recap yang ambigu dan seluruh billing worker terpusat di satu modal aksi yang konsisten | `npm.cmd run lint`, `npm run build`, manual browser smoke recap worker tab vs daily tab | `validated` |
| `UCW-244` | Tambahkan context line minimal di row list workspace inti | `src/lib/transaction-presentation.js`, `src/components/ui/ActionCard.jsx`, `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx` | `UCW-176`, `UCW-242` | List `Jurnal`, `Riwayat`, dan `Halaman Sampah` menampilkan satu baris konteks minimal di bawah tanggal untuk worker/supplier/kreditur/project sesuai jenis transaksi, memakai field snapshot yang sudah ada tanpa fetch tambahan dan tanpa memperlambat first paint | `npm.cmd run lint`, `npm run build`, manual browser compare row density vs baseline | `validated` |
| `UCW-245` | Kelompokkan salary bill per worker di daftar tagihan | `src/pages/BillsPage.jsx`, `src/pages/PaymentsPage.jsx`, `src/lib/transaction-presentation.js`, `src/lib/records-api.js` | `UCW-94`, `UCW-243` | Tagihan gaji ditampilkan sebagai satu grup per worker agar rekap yang dipisah-pisah tetap mudah dibayar per worker, sementara detail bill per periode tetap tersedia di dalam grup dan tidak menambah fetch per item | `npm.cmd run lint`, `npm run build`, manual browser smoke group worker bill list | `validated` |
| `UCW-246` | Pisahkan filter jurnal/riwayat untuk dokumen non-finansial dan termin bill-backed | `src/lib/transaction-presentation.js`, `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `api/transactions.js` | `UCW-23`, `UCW-35`, `UCW-217` | `Riwayat` tidak lagi menampilkan filter `Surat Jalan`, sedangkan `Termin Proyek` di jurnal hanya tampil bila benar-benar punya bill/fee bill yang melandasinya; tujuan task ini adalah menyelaraskan filter dengan makna bisnis surface, bukan sekadar label | `npm.cmd run lint`, `npm run build`, manual browser compare journal/history filters | `validated` |
| `UCW-247` | Sembunyikan bill paid dari Jurnal tapi pertahankan di Riwayat | `src/lib/transaction-presentation.js`, `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `api/transactions.js` | `UCW-246`, `UCW-217` | Row `bill` yang sudah `paid` tetap muncul di `Riwayat` sebagai histori finansial, tetapi tidak lagi tampil di `Jurnal` yang dipakai sebagai surface aktif; ini menjaga jurnal tetap fokus ke item yang masih relevan untuk operasi harian | `npm.cmd run lint`, `npm run build`, manual browser compare paid bill visibility in journal vs history | `validated` |
| `UCW-248` | Pisahkan detail teknis owner-only ke route terpisah | `src/pages/TransactionDetailPage.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/PaymentPage.jsx`, `src/components/layouts/FormLayout.jsx`, `src/components/layouts/FormHeader.jsx`, `src/components/ui/AppPrimitives.jsx`, `src/App.jsx` | `UCW-242`, `UCW-247` | Detail teknis seperti ID, status mentah, tanggal audit, dan metadata operasional dipindah ke route owner-only terpisah agar page utama tetap fokus ke konteks bisnis dan tidak memaksa scroll di atas fold | `npm.cmd run lint`, `npm run build`, manual browser smoke owner-only technical routes | `validated` |
| `UCW-249` | Rapikan owner-only technical route agar tidak duplikatif | `src/pages/TransactionDetailPage.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/PaymentPage.jsx`, `src/App.jsx`, `src/components/layouts/FormLayout.jsx`, `src/components/ui/AppPrimitives.jsx` | `UCW-248`, `UCW-247` | Route owner-only teknis hanya menampilkan info teknis murni seperti status siap edit atau tidak, tipe, ID, dan sumber/metadata teknis; tombol ke route ini hanya terlihat untuk `Owner`, sementara page utama tetap bebas dari panel teknis yang duplikatif | `npm.cmd run lint`, `npm run build`, manual browser compare main page vs technical route | `validated` |
| `UCW-250` | Tampilkan form payment dulu dan turunkan histori bill dari viewport awal | `src/pages/PaymentPage.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/pages/EditRecordPage.jsx`, `src/components/layouts/FormLayout.jsx`, `src/components/ui/AppPrimitives.jsx`, `src/App.jsx` | `UCW-214`, `UCW-248`, `UCW-249` | Workspace `PaymentPage` harus membuka field pembayaran sebagai fokus awal, sementara histori pembayaran bill/pinjaman dipindah ke area sekunder atau route detail agar pengguna tidak perlu scroll dulu untuk mencapai field utama | `npm.cmd run lint`, `npm run build`, manual browser compare first-fold payment form vs history placement | `validated` |
| `UCW-251` | Ringkas detail page biasa dan pindahkan tanggal ke card bawah header | `src/pages/TransactionDetailPage.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/PaymentPage.jsx`, `src/components/layouts/FormLayout.jsx`, `src/components/ui/AppPrimitives.jsx` | `UCW-249`, `UCW-250` | Page detail non-teknis tidak lagi menampilkan metadata berlebih seperti `ID`, `Sumber`, dan `Jenis` di semua role; field itu dihapus dari detail biasa, sedangkan tanggal dipindah ke card yang berada tepat di bawah header agar first fold tetap fokus ke konteks bisnis, bukan field teknis yang sudah dipindah ke route owner-only | `npm.cmd run lint`, `npm run build`, manual browser compare detail page first fold vs technical route | `validated` |
| `UCW-252` | Fokuskan histori pembayaran dan lampiran ke tab detail | `src/pages/TransactionDetailPage.jsx`, `src/components/ui/AppPrimitives.jsx`, `src/App.jsx` | `UCW-249`, `UCW-250`, `UCW-251` | Detail page menjadi surface utama untuk tab kondisional `Info / Riwayat / Lampiran`; tab `Riwayat` tampil hanya jika ada payment history dan memuat full list dengan tombol aksi icon-only sesuai role, tab `Lampiran` tampil hanya jika ada attachment dan menampilkan preview plus aksi icon-only `lihat / ganti / hapus` untuk role yang berwenang, sementara `Viewer` dan `Payroll` read-only | `npm.cmd run lint`, `npm run build`, manual browser compare detail tabs vs baseline | `validated` |
| `UCW-253` | Tambahkan jalur akses tagihan dari card KPI dashboard | `src/pages/Dashboard.jsx`, `src/pages/BillsPage.jsx`, `src/App.jsx`, `src/components/ui/AppPrimitives.jsx` | `UCW-245`, `UCW-252` | Card KPI `Tagihan Pending` di `Dashboard` harus bisa membuka halaman `Tagihan` yang sudah ada, supaya surface tagihan punya jalur akses jelas dari overview tanpa shortcut tersembunyi di tempat lain | `npm.cmd run lint`, `npm run build`, manual browser compare KPI card vs tagihan page | `validated` |
| `UCW-215` | Pertahankan nominal saldo kas full, tapi ringkas laba bersih dan pinjaman aktif di KPI Dashboard | `src/pages/Dashboard.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-213` | KPI `Saldo Kas` tetap full `Rp`, sementara `Laba Bersih` dan `Pinjaman Aktif` kembali memakai format singkat agar dua kartu di grid horizontal tetap lebih rapat dan mudah dibaca | audit UI + `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-214` | Seed pembayaran dari navigation state dan tunda mount form edit sampai detail hydrated | `src/pages/PaymentPage.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/BillsPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-92`, `UCW-93`, `UCW-94` | Klik `Bayar` di list data tidak lagi mendarat ke layar kosong karena `PaymentPage` memakai seed route state sementara fetch detail berjalan; form edit juga tidak lagi menampilkan field kosong karena komponen baru mount setelah detail siap | audit route + `npm.cmd run lint`, `npm.cmd run build` | `validated` |
| `UCW-184` | Rancang contract dan layout `GlobalToast` reusable untuk Telegram mini web mobile | `src/App.jsx`, `src/components/ui/GlobalToast.jsx`, `src/components/ui/AppPrimitives.jsx`, `src/components/layouts/MainLayout.jsx`, `src/store/useToastStore.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-183` | Ada contract toast global yang mobile-first, token-based, safe-area aware, mendukung `success` / `info` / `warning` / `error` / `loading`, dan bisa dipakai semua surface tanpa interpretasi ganda | audit contract + `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-185` | Migrasikan notifikasi in-app dan fallback transient ke `GlobalToast` global | `src/pages/PayrollPage.jsx`, `src/pages/PaymentPage.jsx`, `src/store/useIncomeStore.js`, `src/store/usePaymentStore.js`, `src/store/useTransactionStore.js`, `src/components/MaterialInvoiceForm.jsx`, `src/components/LoanForm.jsx`, `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/components/PayrollAttendanceHistory.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-184` | Notif success/error/partial result dan fallback transient memakai satu pintu toast global, sementara fallback yang persisten tetap stay-on-screen jika memang harus | migrasi callsite + `npm.cmd run lint`, `npm run build` | `validated` |
| `UCW-186` | Fix bottom nav agar tidak terdorong keyboard saat filter `Jurnal` fokus di mobile | `src/components/ui/BottomNav.jsx`, `src/components/layouts/MainLayout.jsx`, `src/pages/TransactionsPage.jsx`, `src/index.css`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-184`, `UCW-185` | Saat field filter aktif di mobile, bottom nav tetap docked atau disembunyikan sementara tanpa naik ke tengah viewport; input filter tetap nyaman dan tidak membuat layout terasa pengap | audit viewport behavior + `npm.cmd run lint`, `npm run build`, manual mobile keyboard check | `validated` |
| `UCW-173` | Ringankan first paint list `Jurnal` / `Riwayat` / `Halaman Sampah` / `Catatan Absensi` dengan detail on-demand | `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/components/PayrollAttendanceHistory.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/pages/DeletedTransactionDetailPage.jsx`, `src/lib/transactions-api.js`, `src/lib/records-api.js`, `api/transactions.js`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-89`, `UCW-90`, `UCW-171` | List surface hanya memuat snapshot/minimal field yang benar-benar dipakai untuk title, tanggal, amount, dan filter; label/badge/detail metadata yang berat dipindah ke detail route atau sheet yang dimuat saat user membuka item, sehingga payload awal lebih ringan dan detail tidak dihydrate sebelum dibutuhkan | `rg`, audit query payload, `npm.cmd run lint`, `npm run build`, manual timing compare | `blocked` |
| `UCW-174` | Rekonsiliasi `docs/freeze/*` dengan backlog dan release pattern akhir agar tidak stale atau bertabrakan | `docs/freeze/*`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md` | `UCW-90` | Wording freeze, plan, dan progress log selaras dengan runtime terbaru; `Payment Receipt PDF` dan `pdf_settings` dipisah tegas; `Referensi` / `Master`, `Riwayat` / `Recycle Bin`, `Catatan Absensi`, `Tagihan Upah`, `Dokumen Barang`, dan `Stok Barang` dipetakan konsisten; urutan release akhir dan blocker tersisa tertulis eksplisit; dan perbedaan authority freeze vs backlog operasional dipertegas tanpa menyentuh runtime | audit dokumen + `rg` konsistensi + update plan/progress | `validated` |

Catatan split untuk restore bill:

- `UCW-239` tetap menjadi slice tree-restore dan berstatus `validated`.
- `UCW-240` tetap menjadi slice settlement-recalc dan berstatus `planned`.
- Urutan review akhir: Agent 1 memegang audit/implementasi tree restore, Agent 2 memegang audit/implementasi settlement recalc, lalu Agent 3 menutup sinkronisasi plan/progress.

**Brief implementasi siap eksekusi**

- Tujuan:
  - audit seluruh core feature backend dan frontend terhadap `docs/freeze/*`, lalu turunkan hasil audit ke urutan kerja release yang konkret
- Scope audit backend:
  - `api/auth.js`
  - `api/records.js`
  - `api/transactions.js`
  - `supabase/migrations/*`
  - jalur write/read yang masih direct dari store pendukung bila berdampak ke domain inti
- Scope audit frontend:
  - `src/App.jsx`
  - `src/pages/*`
  - `src/store/*`
  - `src/components/*`
  - layout/shell route yang memengaruhi core release
- Forbidden files:
  - `README.md`
  - `package.json`
  - `package-lock.json`
  - config build
  - file runtime di luar area audit yang tidak relevan dengan core release
- Domain yang wajib dipetakan:
  - `Dashboard`
  - `Jurnal` / `TransactionsPage`
  - `Pembayaran`
  - `Pemasukan Proyek`
  - `Pengeluaran`
  - `Faktur Barang` / `Surat Jalan Barang`
  - `Dana Masuk / Pinjaman`
  - `Halaman Absensi` / `Catatan Absensi`
  - `Tagihan Upah`
  - `Referensi` / `Master`
  - `Attachment`
  - `Reports`
  - `Stok Barang`
- Output wajib:
  - gap matrix per domain: freeze contract, runtime repo reality, blocker, dan follow-up yang dibutuhkan
  - daftar micro-task berikutnya yang diurutkan dari blocker paling kritis
  - boundary yang harus tetap dianggap transitional exception
  - boundary legacy yang tidak boleh dipakai untuk task baru
- Validasi minimum:
  - `rg -n "submitTransaction|TransactionForm|vw_transaction_summary|loadOperationalSummary|/stock|StockPage|usePaymentStore|team_members|invite_tokens|fn_generate_salary_bill|file_assets|hrd_documents|React.lazy|lazy\\(" docs/freeze docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md src api`
  - audit konsistensi antara freeze authority, runtime repo, dan backlog plan/progress
- Guard wajib:
  - jangan ubah runtime code saat audit planning ini berjalan
  - jangan memasukkan polish atau refactor yang tidak langsung membantu gap matrix release
  - jangan menjadikan transitional boundary sebagai pola baru domain inti

**Audit sweep detail**

- `Dashboard`: cek `src/store/useDashboardStore.js` terhadap `api/transactions.js` untuk memastikan summary aktif benar-benar server-owned.
- `Jurnal`: cek `src/pages/TransactionsPage.jsx`, `src/pages/TransactionDetailPage.jsx`, dan `src/lib/transactions-api.js` untuk memastikan active ledger, history, dan recycle boundary tidak bercampur.
- `Pembayaran`: cek `src/store/usePaymentStore.js`, `src/pages/PaymentPage.jsx`, `src/lib/records-api.js`, dan `src/lib/transactions-api.js` untuk memastikan create/update/delete payment tetap API-owned.
- `Attendance`: cek `src/store/useAttendanceStore.js`, `src/components/AttendanceForm.jsx`, `src/components/PayrollManager.jsx`, dan `api/records.js` untuk memastikan billed/paid rules dan recap flow tidak drift.
- `Master`: cek `src/store/useMasterStore.js`, `src/pages/MasterPage.jsx`, dan `src/pages/MasterRecycleBinPage.jsx` untuk memastikan direct CRUD master tetap dibatasi sebagai transitional boundary.
- `Attachment`: cek `src/store/useFileStore.js`, `src/store/useHrStore.js`, dan `src/components/ExpenseAttachmentSection.jsx` untuk memastikan storage/file asset boundary tidak dianggap pola inti.
- `Reports`: cek `src/store/useReportStore.js`, `src/components/ProjectReport.jsx`, dan `api/records.js` untuk memastikan report summary final dan PDF delivery bergerak ke server truth yang benar.
- `auth/workspace`: cek `src/store/useTeamStore.js` dan `api/auth.js` untuk memastikan direct write membership tetap exception runtime, bukan baseline core release.

**Audit gap matrix awal**

| Domain | Freeze contract aktif | Repo reality saat ini | Status audit | Next blocker / follow-up |
| --- | --- | --- | --- | --- |
| `Dashboard` | summary aktif dari `/api/transactions?view=summary` via `loadOperationalSummary()` | runtime sudah mengikuti helper server; `vw_transaction_summary` hanya legacy compatibility | `aligned` | tidak ada blocker baru di summary boundary |
| `auth/workspace` | bootstrap dan access changes tetap sensitif, direct write lama bukan pola baru | `api/auth.js` sudah jadi boundary bootstrap; boundary `Tim` sekarang sudah dipusatkan ke contract eksplisit dan direct-write transitional diperlakukan sebagai exception runtime | `transitional` | core release tidak boleh menganggap direct-write `Tim` sebagai pola baru; boundary ini tetap exception runtime yang terisolasi |
| `Jurnal` / `TransactionsPage` | ledger aktif dibaca server-side, bukan summary dashboard | route dan store ledger aktif sudah selaras dengan surface `Riwayat` / `Recycle Bin` yang dipisah | `aligned` | tidak ada blocker core baru di ledger boundary |
| `Pembayaran` | API-owned boundary untuk create/update/delete/restore payment | `usePaymentStore` sudah wrapper API; legacy modal/host inert masih ada sebagai surface historis | `aligned` | jangan reintroduce direct Supabase insert di store payment |
| `Stok Barang` | supporting/non-core dengan manual stock-out terbatas | route `/stock` aktif, manual stock-out sudah hidup, dan boundary ini tetap supporting aktif | `aligned` | jangan menaikkan stock-out menjadi adjustment bebas atau core write path baru |
| `attendance` | absensi harian, history, recap, dan salary bill tetap terpisah sesuai freeze | `useAttendanceStore` sudah memakai API read/write boundary dan billed/paid guard, sehingga recap flow berada di contract freeze yang dipetakan | `aligned` | tidak ada blocker core baru di attendance boundary |
| `master` / `referensi` | master data tetap transisional dengan guard usage dan delete/restore | boundary `Master` sudah dipusatkan ke contract eksplisit; direct CRUD master tetap runtime transitional exception, tetapi `Master` tetap core-release fondasional | `transitional` | jangan jadikan direct CRUD master sebagai pola inti release; release berikutnya hanya boleh menutup exception per entitas yang memang masih tersisa |
| `attachment` | upload physical boleh, relation write lewat `/api/records` | `useFileStore` masih memegang upload storage dan `file_assets` langsung; `useHrStore` ikut bergantung pada boundary ini | `transitional` | pastikan role matrix, cleanup orphan, dan restore/delete semantics ditutup sebelum core release final |
| `HRD` / `File` / payroll generate | ditandai freeze sebagai runtime exception / transitional boundary | masih ada direct Supabase write/RPC pada store pendukung dan `PayrollManager` | `transitional` | jangan diperlakukan sebagai pola baru domain inti; dokumentasikan sebagai exception, bukan target standardisasi release inti |
| `Reports` | report final membaca server truth, PDF bisnis user-facing sudah tersedia dari app | summary report proyek dan PDF bisnis keduanya sudah membaca server truth yang sama | `aligned` | tidak ada blocker core baru di report boundary |

Hasil audit ini dipakai sebagai urutan kerja implementasi berikutnya: tidak ada blocker core yang tersisa, dan sisa work hanya boundary transitional exception atau polish non-blocking yang tidak menutup release inti.

**Urutan micro-task release yang direkomendasikan**

1. `UCW-85` — kunci boundary `delete / restore / permanent-delete` lintas domain inti.
2. `UCW-86` — finalkan attachment platform, cleanup orphan, dan role matrix.
3. `UCW-87` — tutup laporan server truth final untuk `Unit Kerja`.
4. `UCW-88` — deliver PDF bisnis user-facing dan `pdf_settings`.
5. `UCW-89` — hardening mobile-first dan scalable data untuk ledger, report, dan picker master.
6. `UCW-90` — audit final release readiness end-to-end setelah blocker di atas tertutup; explicit legacy gates tetap dikecualikan dari blocker count kecuali freeze berubah.

## Audit Gate Per Task

Setiap micro-task wajib melewati audit berikut sebelum status diubah menjadi `validated`:

1. Scope file sesuai task.
2. Tidak ada perubahan di luar tujuan task.
3. Definition of done pada row task terpenuhi.
4. Validasi minimum dijalankan atau alasan tertulis bila tidak bisa dijalankan.
5. Risiko/regresi dicatat.
6. Progress log diperbarui.

Jika salah satu poin gagal, ubah status task menjadi `blocked` atau tetap `audit_required`.

## Template Update Saat Ada Brief Baru

Saat ada brief baru yang masih terkait stream ini, update dokumen dengan format:

1. `Tanggal brief`
2. `Ringkasan brief`
3. `Dampak ke task existing`
4. `Task baru atau task revisi`
5. `Perubahan dependency`

## Audit Brief Lanjutan

### `2026-04-18` - Brief lanjutan loan, supplier, form UX, post-submit, attachment

**Ringkasan brief**

1. `LoanForm` harus memakai logika bunga flat dan preview pengembalian otomatis, plus skema bunga keterlambatan dan penalti opsional.
2. Field supplier di faktur harus mengambil master supplier material; filter supplier harus kontekstual berdasarkan tipe supplier.
3. Form perlu dipecah menjadi section dengan tombol lanjut/kembali agar mobile-friendly.
4. Setelah CRUD create/edit, Mini Web App tidak boleh langsung tertutup.
5. Attachment perlu library ringan dengan compress dan background upload, serta CRUD attachment yang terpisah dari parent data.

**Dampak ke backlog existing**

- `UCW-08` direvisi agar loan payment mengikuti aturan domain loan yang lebih final.
- `UCW-10` direvisi agar guard master data mencakup klasifikasi untuk filtering form.
- `UCW-12` direvisi dari readiness umum menjadi arsitektur attachment yang lebih eksplisit.

**Task baru atau task revisi**

- Task baru: `UCW-13`, `UCW-14`, `UCW-15`, `UCW-16`, `UCW-17`, `UCW-18`, `UCW-19`, `UCW-20`
- Task revisi: `UCW-08`, `UCW-10`, `UCW-12`

**Perubahan dependency**

- `UCW-08` sekarang bergantung pada `UCW-13` dan `UCW-14`
- `UCW-17` bergantung pada `UCW-14`, `UCW-15`, dan `UCW-16`
- `UCW-18` bergantung pada `UCW-16`
- `UCW-20` bergantung pada `UCW-19`

### `2026-04-18` - Brief lanjutan recycle bin permanent delete

**Ringkasan brief**

1. Recycle bin belum punya fitur hapus permanent untuk entitas prioritas.
2. Flow recycle bin perlu dipetakan sebagai lanjutan setelah soft delete/restore agar tidak merusak relasi parent-child.

**Dampak ke backlog existing**

- `UCW-11` tetap menangani soft delete dan restore.
- `UCW-21` ditambahkan untuk permanent delete terpisah supaya scope audit lebih jelas dan aman.

**Task baru atau task revisi**

- Task baru: `UCW-21`

**Perubahan dependency**

- `UCW-21` bergantung pada `UCW-11`

### `2026-04-18` - Brief lanjutan stabilisasi faktur material multi-item

**Ringkasan brief**

1. Saat menyimpan faktur material dengan lebih dari satu item, muncul error server generik `Terjadi Kesalahan di server record`.
2. Saat user menambah item, seluruh field yang sudah terisi ikut reset; behavior ini harus dihentikan karena merusak draft form.
3. Analisis sementara mengarah ke jalur `MaterialInvoiceForm` dan save flow material invoice.

**Dampak ke backlog existing**

- `UCW-03` masih menyisakan gap stabilitas draft multi-item.
- `UCW-15` tetap relevan sebagai fondasi validasi supplier, tetapi belum menyentuh bug add-item/reset dan error save multi-item.

**Task baru atau task revisi**

- Task baru: `UCW-22`

**Perubahan dependency**

- `UCW-22` bergantung pada `UCW-03` dan `UCW-15`

### `2026-04-18` - Brief lanjutan refactor halaman transaksi menjadi buku kas besar

**Ringkasan brief**

1. Halaman `Transaksi` harus diubah menjadi semacam `buku kas besar` untuk keseluruhan workspace: pemasukan, pengeluaran, pinjaman, faktur, surat jalan, tagihan, dan tagihan gaji.
2. UI list harus minimal, tanpa header grup tanggal dan tanpa jumlah item per grup.
3. Record yang saat ini tampil ganda sebagai parent dan bill harus dikonsolidasikan menjadi satu row ledger di UI, tetapi tetap mendukung CRUD lengkap ke parent canonical.
4. Soft delete, restore, dan permanent delete harus punya guard tree yang aman agar child seperti riwayat pembayaran dan attachment tidak orphan.
5. Schema dan manajemen child collection transaksi perlu dirapikan agar payment history dan attachment mengikuti struktur parent-child yang jelas.

**Dampak ke backlog existing**

- `UCW-09` direvisi dari workspace UI umum menjadi finalisasi `buku kas besar` lintas domain.
- `UCW-11` direvisi agar recycle bin menangani child collection transaksi yang ikut parent tree.
- `UCW-21` direvisi agar permanent delete bergantung pada guard tree final.

**Task baru atau task revisi**

- Task baru: `UCW-23`, `UCW-24`, `UCW-25`, `UCW-26`, `UCW-27`, `UCW-28`
- Task revisi: `UCW-09`, `UCW-11`, `UCW-21`

**Perubahan dependency**

- `UCW-09` sekarang bergantung pada `UCW-24`, `UCW-25`, `UCW-26`, dan `UCW-28`
- `UCW-11` sekarang bergantung pada `UCW-27`
- `UCW-21` sekarang bergantung pada `UCW-11` dan `UCW-28`
- `UCW-24` bergantung pada `UCW-23` dan `UCW-01`
- `UCW-25` bergantung pada `UCW-24`
- `UCW-26` bergantung pada `UCW-25` dan CRUD domain prioritas terkait
- `UCW-28` bergantung pada `UCW-11`, `UCW-26`, dan `UCW-27`

### `2026-04-18` - Brief lanjutan detail invoice, surat jalan, dashboard, skalabilitas list, dan picker master

**Ringkasan brief**

1. Rincian item material pada faktur perlu punya detail sendiri dan harus bisa diedit dengan aman sebagai child record.
2. `surat_jalan` harus punya CRUD sendiri dan bisa dikonversi dari menu aksi menjadi expense final dengan bill tagihan atau lunas.
3. CRUD di list mutasi dashboard harus dihapus agar pusat pengelolaan transaksi pindah ke halaman `Buku Kas Besar`.
4. Halaman `Buku Kas Besar` perlu strategi data-loading yang tetap ringan jika data membengkak.
5. Dropdown master data yang panjang perlu pola pengelolaan UI/UX yang lebih cocok untuk mobile.

**Dampak ke backlog existing**

- `UCW-17` direvisi agar shell form mobile mengikuti strategi picker master data skala besar.
- `UCW-24` direvisi agar read model ledger mengikuti strategi skalabilitas list besar.

**Task baru atau task revisi**

- Task baru: `UCW-29`, `UCW-30`, `UCW-31`, `UCW-32`, `UCW-33`
- Task revisi: `UCW-17`, `UCW-24`

**Perubahan dependency**

- `UCW-17` sekarang bergantung pada `UCW-33`
- `UCW-24` sekarang bergantung pada `UCW-23` dan `UCW-01`
- `UCW-29` bergantung pada `UCW-03`, `UCW-26`, dan `UCW-27`
- `UCW-30` bergantung pada `UCW-03`, `UCW-04`, `UCW-23`, dan `UCW-26`
- `UCW-31` bergantung pada `UCW-09`
- `UCW-32` bergantung pada `UCW-23`
- `UCW-33` bergantung pada `UCW-10`, `UCW-15`, dan `UCW-16`

### `2026-04-18` - Brief lanjutan role-based attachment CRUD

**Ringkasan brief**

1. Manajemen attachment harus bisa dikelola dengan teratur sebagai child record transaksi.
2. CRUD attachment yang tampil di UI harus mengikuti role masing-masing, bukan semua role melihat aksi yang sama.
3. Role matrix attachment harus konsisten antara kontrak UI, store/API, dan struktur schema child collection.

**Dampak ke backlog existing**

- `UCW-12` direvisi agar arsitektur attachment mencakup role matrix CRUD.
- `UCW-20` direvisi agar integrasi attachment CRUD di UI mengikuti visibility per role.
- `UCW-27` direvisi agar child collection attachment aman terhadap role-based access.

**Task baru atau task revisi**

- Task baru: `UCW-34`
- Task revisi: `UCW-12`, `UCW-20`, `UCW-27`

**Perubahan dependency**

- `UCW-12` sekarang bergantung pada `UCW-34`
- `UCW-20` sekarang bergantung pada `UCW-34`
- `UCW-27` sekarang bergantung pada `UCW-34`

### Matriks Role Attachment Final

| Role | view | upload | edit metadata | delete | restore | permanent delete |
| --- | --- | --- | --- | --- | --- | --- |
| `Owner` | ya | ya | ya | ya | ya | ya |
| `Admin` | ya | ya | ya | ya | ya | ya |
| `Logistik` | ya | ya | ya | ya | ya | tidak |
| `Payroll` | ya | tidak | tidak | tidak | tidak | tidak |
| `Administrasi` | ya | ya | ya | ya | ya | tidak |
| `Viewer` | ya | tidak | tidak | tidak | tidak | tidak |

### `2026-04-18` - Brief lanjutan cleanup dashboard mutasi dan filter ledger lengkap

**Ringkasan brief**

1. Dashboard mutasi harus kehilangan aksi CRUD dan tetap menjadi ringkasan/navigasi.
2. Filter tab `TransactionsPage` harus mencakup semua jenis catatan ledger, bukan hanya uang masuk/keluar.
3. Ledger buku kas besar perlu strategi eksplisit untuk pagination per window, filter server-side, pencarian terindeks, dan progressive hydration saat data membengkak.

**Dampak ke backlog existing**

- `UCW-31` ditegaskan sebagai cleanup dashboard mutasi read-only.
- `UCW-32` ditegaskan sebagai strategi skalabilitas ledger besar.
- `UCW-35` ditegaskan sebagai penyelarasan filter tab ledger lengkap.

**Task baru atau task revisi**

- Task revisi: `UCW-31`, `UCW-32`, `UCW-35`

**Perubahan dependency**

- tetap mengikuti `UCW-09`, `UCW-23`, `UCW-24`, `UCW-25`, dan `UCW-26`

### `2026-04-18` - Brief lanjutan timestamp realtime dan dashboard recent-only

**Ringkasan brief**

1. Timestamp di UI dan backend harus mengikuti zona input pengguna secara realtime, bukan statis ke zona server.
2. List mutasi dashboard harus hanya menampilkan aktivitas terbaru dari source of truth ledger buku kas besar di halaman `Buku Kas Besar`.
3. Tombol `More` dan modal aksi di list dashboard harus dihapus.
4. Badge row mutasi harus diringkas, dan label `created_by` harus menunjukkan user yang benar-benar melakukan aktivitas sesuai id user pelaku.
5. Badge berlebih lain seperti status pending dan label serupa harus dipangkas agar row tetap ringkas.

**Dampak ke backlog**

- `UCW-36` ditambahkan untuk normalisasi timestamp lintas UI/backend.
- `UCW-37` ditambahkan untuk recent-only dashboard mutasi tanpa action modal.
- `UCW-38` ditambahkan untuk badge/creator label yang lebih ringkas di row mutasi.

**Task yang ditambah atau diubah**

- Task baru: `UCW-36`, `UCW-37`, `UCW-38`

**Perubahan dependency**

- `UCW-37` bergantung pada `UCW-31` dan `UCW-32`
- `UCW-38` bergantung pada `UCW-24`, `UCW-25`, `UCW-31`, dan `UCW-36`

### `2026-04-18` - Brief lanjutan redesign header form, master picker global, dan catatan collapsible

**Ringkasan brief**

1. Semua form input perlu lebih hemat ruang dengan section yang lebih ringkas.
2. Header form dan halaman `More` perlu memakai komposisi seragam: kicker/title di kiri dan tombol kembali berlabel di kanan atas.
3. Dropdown master data harus tetap global dan konsisten pada input yang masih tersisa.
4. Field catatan opsional perlu dibuat collapsible agar tinggi form turun.

**Dampak ke backlog existing**

- `UCW-17` tetap valid sebagai shell sectioned form, tetapi brief ini menuntut penyempurnaan komposisi header dan catatan collapsible.
- `UCW-33` diperluas dari picker master mobile-friendly menjadi pola global untuk semua dropdown master yang masih tersisa.

**Task baru atau task revisi**

- Task baru: `UCW-39`

**Perubahan dependency**

- `UCW-39` bergantung pada `UCW-16`, `UCW-17`, dan `UCW-33`

### `2026-04-18` - Brief lanjutan jalankan `UCW-01` dan `UCW-11` sekaligus

**Ringkasan brief**

1. User meminta dua task backlog terakhir dijalankan sekaligus.
2. Read model workspace transaksi harus benar-benar dipisah dari dashboard summary.
3. Recycle bin master data perlu tersedia agar scope `UCW-11` tidak tertahan lagi.

**Dampak ke backlog existing**

- `UCW-01` diformalkan sebagai validated karena workspace read model sudah dipakai di `TransactionsPage`.
- `UCW-11` diperluas dengan recycle bin master data melalui halaman baru.

**Task baru atau task revisi**

- Task revisi: `UCW-01`, `UCW-11`

**Perubahan dependency**

- Tidak ada perubahan dependency tambahan di luar implementasi recycle bin master data

### `2026-04-18` - Brief lanjutan safe-area wrapper halaman More

**Ringkasan brief**

1. Empat halaman `More` tidak lewat `MainLayout`, sehingga safe-area/padding bisa drift di perangkat dengan notch.
2. Header/back tetap mengikuti komposisi repo (`FormHeader` → `PageHeader`) dan tidak dikonsolidasikan menjadi header baru.

**Dampak ke backlog existing**

- Membuka micro-task baru untuk wrapper safe-area halaman More tanpa mengubah hierarchy header/body.

**Task baru atau task revisi**

- Task baru: `UCW-47`

**Perubahan dependency**

- `UCW-47` bergantung pada `UCW-46`

### `2026-04-18` - Brief lanjutan redesign UI/UX form global dan konsisten

**Ringkasan brief**

1. Form perlu dirapikan per section dengan ritme visual yang seimbang, tidak berat sebelah, dan konsisten lintas halaman.
2. Fokus awal redesign hanya pada `Income`, `Loan`, dan `MaterialInvoice/Faktur`.
3. Tombol submit pada form Faktur wajib muncul kembali dan ditempatkan jelas di alur section akhir.

**Dampak ke backlog existing**

- `UCW-16`, `UCW-17`, `UCW-39`, `UCW-40`, `UCW-41`, `UCW-42`, `UCW-44`, `UCW-45`, `UCW-46`, dan `UCW-47` sudah membuktikan shell section ada, tetapi belum membakukan balance visual per form.
- `UCW-18` tetap relevan karena perubahan layout tidak boleh merusak post-submit flow yang aman di dalam Mini Web App.
- Audit repo aktual menunjukkan wrapper aktif seperti `AttendancePage`, `MaterialInvoicePage`, `PaymentPage`, `EditRecordPage`, dan `MasterFormPage` sudah mengirim props CTA ke `FormLayout`, tetapi contract itu belum dipakai oleh komponen shell saat ini.

**Task baru atau task revisi**

- Task baru: `UCW-48`
- Task baru: `UCW-49`
- Task baru: `UCW-50`
- Task baru: `UCW-51`
- Task baru: `UCW-52`
- Task baru: `UCW-53`

**Perubahan dependency**

- `UCW-49` bergantung pada `UCW-48`
- `UCW-50`, `UCW-51`, dan `UCW-52` bergantung pada `UCW-49`
- `UCW-53` bergantung pada `UCW-50`, `UCW-51`, `UCW-52`, dan `UCW-18`

### `2026-04-18` - Brief lanjutan semua form di repo menjadi section

**Ringkasan brief**

1. Scope redesign section tidak boleh berhenti di `Income`, `Loan`, dan `MaterialInvoice/Faktur`.
2. Semua form yang ada di repo harus dipetakan dan diberi pola section yang konsisten.
3. Form master dan form utilitas boleh punya density berbeda, tetapi tetap satu bahasa komposisi.

**Dampak ke backlog existing**

- `UCW-48` sampai `UCW-53` tetap menjadi slice prioritas awal, lalu scope diperluas ke seluruh form di repo.
- `UCW-54` sampai `UCW-58` ditambahkan agar inventaris, implementasi, standardisasi, dan audit final punya urutan yang jelas.
- Audit repo aktual menegaskan bahwa `TransactionForm` dan `MasterMaterialForm` belum menjadi entry form aktif lewat route, sehingga keduanya harus dicatat sebagai exception, bukan diasumsikan ikut gelombang implementasi utama.

**Task baru atau task revisi**

- Task baru: `UCW-54`
- Task baru: `UCW-55`
- Task baru: `UCW-56`
- Task baru: `UCW-57`
- Task baru: `UCW-58`

**Perubahan dependency**

- `UCW-54` bergantung pada `UCW-48` dan `UCW-53`
- `UCW-55` dan `UCW-56` bergantung pada `UCW-49` dan `UCW-54`
- `UCW-57` bergantung pada `UCW-55` dan `UCW-56`
- `UCW-58` bergantung pada `UCW-57` dan `UCW-18`

### `2026-04-18` - Brief lanjutan form Hrd dan penerima manfaat

**Ringkasan brief**

1. `Hrd` juga harus masuk gelombang sectioned form, bukan hanya form transaksi utama.
2. Konten `Penerima Manfaat` juga perlu section agar ritme visualnya konsisten dengan form lain.
3. Keduanya harus tetap ringkas di mobile dan tidak memecah pola header/CTA yang sudah dibakukan.

**Dampak ke backlog existing**

- `UCW-59` dan `UCW-60` direvisi menjadi audit transisi dari modal internal ke routed form sectioned.
- `UCW-61`, `UCW-62`, dan `UCW-63` ditambahkan untuk mengunci arah UI/UX bahwa create/edit `HRD` dan `Penerima Manfaat` harus mengikuti routing form aktif seperti halaman form lain.
- `UCW-46` dan `UCW-47` tetap relevan untuk shell halaman list, sementara task baru ini fokus pada pemisahan list page vs routed form page yang memakai reusable component global.
- Audit repo aktual menunjukkan `HrdPipeline` dan `BeneficiaryList` sekarang masih memakai `PageSection` + `AppSheet`; target planning baru adalah menjadikan sheet/modal tersebut transitional path, bukan target final.

**Task baru atau task revisi**

- Task revisi: `UCW-59`
- Task revisi: `UCW-60`
- Task baru: `UCW-61`
- Task baru: `UCW-62`
- Task baru: `UCW-63`

**Perubahan dependency**

- `UCW-59` dan `UCW-60` bergantung pada `UCW-54` dan `UCW-57`
- `UCW-61` bergantung pada `UCW-49` dan `UCW-59`
- `UCW-62` bergantung pada `UCW-49` dan `UCW-60`
- `UCW-63` bergantung pada `UCW-61`, `UCW-62`, dan `UCW-18`

### `2026-04-18` - Brief lanjutan modal form `HRD` dan `Penerima` menjadi routed form

**Ringkasan brief**

1. Modal form internal pada `HRD` dan `Penerima Manfaat` tidak menjadi target UI final.
2. Create/edit untuk dua domain tersebut harus dipindah ke route form seperti flow form lainnya di repo.
3. Route baru wajib memakai reusable component global yang sama: shell, section, header, CTA, dan safe spacing.

**Dampak ke backlog existing**

- Menggeser target `HRD` dan `Penerima` dari optimasi `AppSheet` ke transisi menuju routed form page.
- Menambah kebutuhan audit pemisahan yang tegas antara halaman list, halaman form create/edit, dan legacy modal path.

**Task baru atau task revisi**

- Task revisi: `UCW-59`, `UCW-60`
- Task baru: `UCW-61`, `UCW-62`, `UCW-63`

**Perubahan dependency**

- Tetap mengikuti dependency `UCW-59` sampai `UCW-63` di backlog utama.

### `2026-04-18` - Brief lanjutan komponen reusable global untuk semua form

**Ringkasan brief**

1. Semua halaman form harus dibangun dari komponen reusable yang sama supaya desain global konsisten.
2. Komponen reusable harus mencakup shell section, header, CTA, note/collapsible, dan safe spacing dasar.
3. Semua form di repo cukup menyesuaikan komposisi data, bukan membuat pattern visual baru per halaman.

**Dampak ke backlog existing**

- `UCW-49`, `UCW-57`, dan `UCW-58` menjadi pondasi utama untuk reusable design system di area form.
- `UCW-54` tetap dipakai untuk inventaris form, tetapi implementasinya harus mengarah ke komponen reusable yang sama.
- Audit repo aktual menegaskan bahwa primitive reusable harus mencakup dua jalur: route form shell (`FormLayout`) dan page-section editor (`PageSection`/`AppSheet`), bukan hanya satu pattern.

**Task baru atau task revisi**

- Tidak menambah task baru saat ini; brief ini mengikat arah teknis dari `UCW-49` dan `UCW-57`.

**Perubahan dependency**

- Tidak ada perubahan dependency tambahan.

### `2026-04-18` - Brief lanjutan fix save expense `supplier_name` non-null

**Ringkasan brief**

1. Save expense gagal karena `supplier_name` tetap kosong saat kontrak create/update dipakai.
2. UI expense masih memberi kesan supplier opsional, padahal schema menolak `null`.
3. Kontrak form, store, dan API perlu diselaraskan agar supplier name selalu terisi.

**Dampak ke backlog existing**

- `UCW-02` dibuka lagi sebagai hotfix kontrak expense karena jalur save belum aman terhadap not-null constraint.
- `UCW-15` tetap relevan sebagai fondasi supplier kontekstual, tetapi kini harus dipastikan juga mengisi nama supplier untuk expense umum.

**Task baru atau task revisi**

- Task baru: `UCW-76`

**Perubahan dependency**

- `UCW-76` bergantung pada `UCW-02` dan `UCW-15`

### `2026-04-18` - Brief audit repo menyeluruh, reset fokus core feature, dan buat PRD baru

**Ringkasan brief**

1. Audit harus memakai kondisi repo nyata dan backlog aktual, bukan asumsi dokumen lama.
2. Target utama digeser ke `core feature release` full-stack: `input pemasukan`, `pengeluaran`, `pinjaman`, `faktur/surat_jalan`, `master data`, `absensi`, dan `tagihan gaji`.
3. Feature lintas domain yang wajib ikut release adalah `CRUD`, `soft delete`, `permanent delete`, `attachment`, `payment`, `laporan`, `PDF`, dan `mobile-first scalable data`.

**Dampak ke backlog existing**

- `UCW-54` sampai `UCW-63` tidak lagi menjadi blocker utama release inti sehingga statusnya diturunkan menjadi `deferred`.
- `UCW-77` sampai `UCW-90` ditambahkan untuk menutup gap full-stack yang masih tersisa di repo aktual.
- Audit repo aktual juga menegaskan bahwa `PRD_APP_IMPROVEMENT.md` dan `README.md` tidak lagi cukup akurat untuk menjadi source of truth stream ini.

**Task baru atau task revisi**

- Task revisi: `UCW-54`, `UCW-55`, `UCW-56`, `UCW-57`, `UCW-58`, `UCW-59`, `UCW-60`, `UCW-61`, `UCW-62`, `UCW-63`
- Task baru: `UCW-77`, `UCW-78`, `UCW-79`, `UCW-80`, `UCW-81`, `UCW-82`, `UCW-83`, `UCW-84`, `UCW-85`, `UCW-86`, `UCW-87`, `UCW-88`, `UCW-89`, `UCW-90`

**Perubahan dependency**

- `UCW-78` bergantung pada `UCW-77`
- `UCW-79`, `UCW-80`, `UCW-82`, `UCW-83`, dan `UCW-84` bergantung pada `UCW-78`
- `UCW-81` bergantung pada `UCW-78` dan `UCW-80`
- `UCW-85` bergantung pada `UCW-79`, `UCW-80`, `UCW-81`, `UCW-82`, `UCW-83`, dan `UCW-84`
- `UCW-86` bergantung pada `UCW-80`, `UCW-81`, `UCW-82`, dan `UCW-83`
- `UCW-87` bergantung pada `UCW-79`, `UCW-80`, `UCW-81`, `UCW-82`, `UCW-83`, dan `UCW-85`
- `UCW-88` bergantung pada `UCW-87`
- `UCW-89` bergantung pada `UCW-84`, `UCW-86`, dan `UCW-87`
- `UCW-90` bergantung pada `UCW-85`, `UCW-86`, `UCW-87`, `UCW-88`, dan `UCW-89`

### `2026-04-18` - Brief lanjutan brainstorm bill, absensi, ledger besar, dan multi-user CRUD

**Ringkasan brief**

1. PRD perlu membahas lebih detail flow `bill`, `expense hutang`, partial payment, histori pembayaran, dan CTA `Bayar` dari daftar tagihan.
2. PRD juga harus mengunci jurnal absensi, CRUD absensi, rekap absensi menjadi salary bill, dan apa yang terjadi saat record sudah `billed`.
3. Sebelum coding, perlu keputusan terdokumentasi untuk pagination, pencarian data spesifik di ledger besar, akurasi dashboard saat data ribuan row, dan strategi CRUD multi-user.

**Dampak ke backlog existing**

- `UCW-79` sampai `UCW-89` terlalu cepat masuk implementasi bila keputusan produk detail di area ini belum dibakukan.
- Backlog perlu task desain tambahan agar implementasi tidak menyelesaikan UI lebih dulu lalu mengganti policy bisnis di tengah jalan.

**Task baru atau task revisi**

- Task baru: `UCW-91`
- Task baru: `UCW-92`
- Task baru: `UCW-93`
- Task baru: `UCW-94`
- Task baru: `UCW-95`
- Task baru: `UCW-96`
- Task revisi dependency: `UCW-79`, `UCW-80`, `UCW-81`, `UCW-82`, `UCW-83`, `UCW-84`, `UCW-87`, `UCW-88`, `UCW-89`

**Perubahan dependency**

- `UCW-92`, `UCW-93`, `UCW-94`, `UCW-95`, dan `UCW-96` bergantung pada `UCW-78` dan `UCW-91`
- `UCW-79` bergantung pada `UCW-78` dan `UCW-96`
- `UCW-80` bergantung pada `UCW-78`, `UCW-92`, `UCW-93`, dan `UCW-96`
- `UCW-81` bergantung pada `UCW-78`, `UCW-80`, `UCW-92`, `UCW-93`, dan `UCW-96`
- `UCW-82` bergantung pada `UCW-78`, `UCW-93`, dan `UCW-96`
- `UCW-83` bergantung pada `UCW-78`, `UCW-94`, dan `UCW-96`
- `UCW-84` bergantung pada `UCW-78` dan `UCW-96`
- `UCW-87`, `UCW-88`, dan `UCW-89` sekarang juga bergantung pada `UCW-95`

## Change Log Dokumen

### `2026-04-18`

- Dokumen dibuat untuk menggantikan planning ad-hoc di chat menjadi backlog micro-task yang bisa diaudit.
- Aturan progres task, audit gate, dan change-control follow-up brief dibakukan di dokumen ini.
- Backlog diperluas untuk brief lanjutan terkait loan flat interest, filtering supplier kontekstual, redesign form mobile, post-submit stay-in-app, dan attachment pipeline.
- `UCW-00` dikunci dengan matriks parent-child final berdasarkan mapping repo nyata dan trigger/migration yang aktif.
- Brief stabilisasi faktur material multi-item ditambahkan sebagai micro-task lanjutan.
- Brief tentang bill, absensi, ledger besar, dan multi-user CRUD menambahkan `UCW-91` sampai `UCW-96`; `UCW-95` memfinalkan strategi cursor pagination ledger dan summary dashboard berbasis read model server.
- Brief refactor halaman transaksi menjadi `buku kas besar` ditambahkan sebagai stream lanjutan dengan task ledger, CRUD tunggal, child collection, dan guard tree.
- Brief lanjutan detail line item invoice, CRUD `surat_jalan`, sentralisasi CRUD dari dashboard, strategi skalabilitas list, dan picker master data ditambahkan sebagai backlog lanjutan.
- Brief lanjutan jalankan `UCW-01` dan `UCW-11` sekaligus ditutup dengan formal validation read model workspace dan recycle bin master data.
- Brief audit repo menyeluruh dan PRD core release menurunkan backlog UI non-blocker ke status `deferred`, lalu menambahkan task `UCW-77` sampai `UCW-90` sebagai jalur delivery full-stack baru.
- Brief lanjutan tentang bill, absensi, ledger besar, dan multi-user CRUD menambahkan task desain `UCW-91` sampai `UCW-96` agar keputusan produk detail selesai sebelum implementasi core feature dilanjutkan.

### `2026-04-19`

- Freeze package `docs/freeze/*` diterbitkan sebagai authority utama baru untuk keputusan produk, PRD, contract map, lifecycle, dan guardrail AI.
- `UCW-97` ditutup `validated` untuk menandai bahwa docs freeze menggantikan docs lama sebagai sumber utama task berikutnya.
- Dokumen ini tetap aktif sebagai backlog operasional, tetapi kini tunduk pada freeze package jika terjadi konflik.

### `2026-04-19` - Brief polish `Stok Barang` lanjutan untuk history minimalis dan sheet stock-out ringkas

**Ringkasan brief**

1. Riwayat stok terbaru perlu dibuat lebih minimalis agar lebih nyaman dibaca di mobile Telegram Mini Web.
2. Bottom sheet stock-out perlu tetap kontekstual dari `Barang Aktif`, tetapi lebih ringkas dengan field yang tidak wajib dihilangkan.
3. Task ini tetap UI polish saja, tanpa mengubah write path, atomicity, role gating, atau source of truth stok.

**Task baru**

- `UCW-112`

**Catatan scope**

- Scope tetap di `src/pages/StockPage.jsx` dan helper UI yang langsung dipakai StockPage.
- `Barang Aktif` tetap entry point stock-out, history tetap read-only, dan dokumen sumber tetap dapat dibuka bila tersedia.

### `2026-04-19` - Brief hardening `Dana Masuk / Pinjaman` sebagai parent domain settlement-aware

**Ringkasan brief**

1. Parent domain pendanaan/kewajiban harus tetap terbaca sebagai `Dana Masuk / Pinjaman`, bukan domain baru saat status settlement berubah.
2. `unpaid / partial / paid` perlu dipresentasikan sebagai settlement awareness pada parent yang sama, dengan ringkasan detail yang tidak misleading.
3. Formula bisnis pinjaman tidak boleh diubah kecuali ada bug kecil yang benar-benar terlokalisasi.

**Task baru**

- `UCW-113`

**Catatan scope**

- Fokus pada helper presentasi, detail loan, dan list/read-model yang sudah ada.
- Payment lifecycle, create path, dan schema tetap di luar scope task ini.

### `2026-04-19` - Brief hardening `Catatan Absensi` / `Tagihan Upah` sebagai parent payroll settlement-aware

**Ringkasan brief**

1. `Catatan Absensi` harus terbaca sebagai workspace operasional payroll harian, bukan row utama `Jurnal`.
2. `Tagihan Upah` harus terbaca jelas sebagai derived payroll payable / payroll expense dengan settlement awareness pada parent yang sama.
3. Read/detail payroll harus konsisten dan tidak misleading, tanpa mengubah generate flow, correction rule, atau payment lifecycle.

**Task baru**

- `UCW-114`

**Catatan scope**

- Fokus pada helper presentasi, detail payroll, dan label payment/page yang benar-benar misleading.
- Generate payroll flow, correction rule, payment lifecycle, dan schema tetap di luar scope task ini.

### `2026-04-19` - Brief implementasi `Catatan Absensi` v1 sebagai halaman histori/filter/rekap

**Ringkasan brief**

1. `Catatan Absensi` harus dibangun sebagai halaman baru yang terpisah dari `Halaman Absensi` existing.
2. Surface v1 harus menyediakan riwayat absensi, filter per bulan, filter per worker, framing worker sebagai parent konteks, dan CTA ke flow rekap yang sudah ada.
3. Task ini tidak boleh mengubah payment lifecycle, generate payroll rule, correction rule, atau schema.

**Task baru**

- `UCW-115`

**Catatan scope**

- Fokus pada route baru, read/filter UI, query read ringan attendance history, dan CTA ke flow payroll existing.
- Tidak memindahkan logic input absensi harian ke halaman baru dan tidak mengubah generate/payment/correction behavior.

### `2026-04-19` - Brief koreksi UX `Catatan Absensi` v2: tab Harian/Pekerja minimalis

**Ringkasan brief**

1. `Catatan Absensi` tetap hidup di workspace `Payroll`, tetapi header harus ringkas: title lalu dua tab `Harian` dan `Pekerja`.
2. List harian dan list pekerja harus minimalis, mobile-first, dan memakai bottom sheet aksi untuk `Rekap`, `Edit Absensi`, dan `Detail` sesuai konteks.
3. Task ini hanya correction patch UI/UX; generate payroll, payment lifecycle, correction rule, schema, dan read endpoint tidak boleh berubah kecuali wiring ringan yang benar-benar diperlukan.

**Task baru**

- `UCW-116`

**Catatan scope**

- Fokus pada `src/components/PayrollAttendanceHistory.jsx` dan wiring page yang langsung memuat workspace payroll ini.
- Tidak mengubah flow generate/payment/correction atau memperluas payload read tanpa alasan fungsi UI.

### `2026-04-19` - Brief verifikasi swap bottom-nav payroll / Unit Kerja

**Ringkasan brief**

1. Payroll workspace / `Catatan Absensi` harus muncul di bottom nav.
2. `Unit Kerja` harus keluar dari bottom nav dan tetap tersedia dari `More`.
3. Tidak boleh ada entry duplikat yang membingungkan, dan desain navigasi tidak boleh dirombak.

**Task baru**

- `UCW-117`

**Catatan scope**

- Fokus pada verifikasi route/nav config existing dan patch minimal jika ada mismatch.
- `More` tetap menjadi akses stabil untuk `Unit Kerja`; route alias lama boleh tetap sebagai kompatibilitas, bukan entry navigasi baru.

### `2026-04-19` - Brief rekap UX + context hardening untuk payroll workspace

**Ringkasan brief**

1. `Harian` harus terasa sebagai rekap per hari untuk banyak worker.
2. `Pekerja` harus terasa sebagai rekap per worker dengan rentang tanggal.
3. CTA `Rekap` harus meneruskan context tab aktif tanpa mengubah generate/payment/correction behavior.

**Task baru**

- `UCW-118`

**Catatan scope**

- Fokus pada context wiring di payroll workspace dan penanda visual minimal agar mode tab tidak ambigu.
- Tidak ada perubahan schema, payment lifecycle, atau read model besar.

### `2026-04-19` - Brief PayrollManager rekap context prefill hardening

**Ringkasan brief**

1. Context rekap dari tab `Harian` dan `Pekerja` harus terasa nyata di `PayrollManager`, bukan hanya highlight visual.
2. Prefill harus tetap mengikuti mode tab aktif tanpa menciptakan flow baru yang asing.
3. Generate payroll, correction rule, dan payment lifecycle tetap tidak boleh berubah.

**Task baru**

- `UCW-119`

**Catatan scope**

- Fokus pada prefill, ordering, dan fokus konteks ringan di area rekap.
- Tidak memperluas schema atau endpoint read, kecuali bila benar-benar diperlukan.

### `2026-04-19` - Brief rekap direct-action implementation + confirmation sheet

**Ringkasan brief**

1. Aksi `Rekap` harus memicu sheet konfirmasi dari item daftar, bukan mengarah ke modul payroll besar di bawah halaman.
2. Konfirmasi harus menjalankan rekap langsung dari konteks item yang dipilih.
3. Sukses harus tampil sebagai toast ringkas; gagal harus tampil sebagai fallback/error ringkas.

**Task baru**

- `UCW-120`

**Catatan scope**

- Fokus pada flow direct-action untuk `Harian` dan `Pekerja`, plus tombol confirm/fallback yang ringan.
- Modul rekap besar di bawah `Catatan Absensi` diparkir dari flow utama jika sudah tidak dibutuhkan.

### `2026-04-19` - Brief rekap result-state hardening

**Ringkasan brief**

1. State hasil rekap harus lebih jelas setelah aksi `Rekap`.
2. Item yang sudah fully billed tidak boleh terasa masih bisa direkap.
3. Partial-success dan no-op harus tetap singkat dan operasional.

**Task baru**

- `UCW-121`

**Catatan scope**

- Fokus pada result-state, disable/omit aksi yang tidak relevan, dan refresh sinkron setelah submit.
- Tidak memperluas schema atau lifecycle pembayaran.

### `2026-04-19` - Brief verification + fix rekap backend readiness and ledger list alignment

**Ringkasan brief**

1. Rekap harus benar-benar berjalan end-to-end, bukan hanya tampak sukses di UI.
2. Jika ada blocker di backend, RPC, payload, atau readiness, patch harus dilakukan sekecil mungkin dan eksplisit.
3. List `Harian` dan `Pekerja` harus memakai shell visual yang sama dengan halaman `Jurnal/Ledger`.

**Task baru**

- `UCW-122`

**Catatan scope**

- Fokus pada boundary write payroll yang resmi, bukan refactor besar payroll.
- Alignment list mengikuti pattern ledger reusable yang sudah ada, tanpa menambah metadata atau copy baru.

### `2026-04-19` - Brief verification + semantics hardening + restore-tree correction untuk `Riwayat` / `Recycle Bin`

**Ringkasan brief**

1. `Riwayat` harus tetap berarti completed/history surface, bukan deleted recovery.
2. `Recycle Bin` harus tetap berarti deleted/recovery surface, bukan history biasa.
3. Restore harus mengikuti parent-child tree dan tidak boleh memulihkan leaf ketika parent lifecycle masih deleted.

**Task baru**

- `UCW-123`

**Catatan scope**

- Fokus pada surface `Riwayat` transaksi, `Recycle Bin`, dan boundary restore yang sudah ada.
- Patch hanya pada semantik surface dan guard tree restore yang salah, tanpa mengubah lifecycle bisnis inti.

### `2026-04-19` - Brief hardening `Tim` / invite + membership lifecycle

**Ringkasan brief**

1. `Tim` harus tetap terbaca sebagai core support/admin capability, bukan auth redesign baru.
2. Lifecycle invite dan membership harus konsisten dengan server truth dan status yang tampil tidak misleading.
3. Role/status membership perlu selaras antara UI, store, dan boundary auth yang resmi.

**Dampak ke backlog existing**

- `UCW-124` ditambahkan sebagai micro-task hardening khusus untuk `Tim`.
- Task ini tetap sempit pada invite/member lifecycle dan tidak membuka auth architecture baru.

**Task baru atau task revisi**

- Task baru: `UCW-124`

**Perubahan dependency**

- `UCW-124` bergantung pada `UCW-84` dan `UCW-96`.

### `2026-04-19` - Brief polish `Halaman Tim` agar layout mobile-first tetap stabil

**Ringkasan brief**

1. UI `Halaman Tim` setelah hardening lifecycle sebelumnya perlu dipoles ulang karena layout mobile-break.
2. Hierarchy halaman harus ringkas: invite state, anggota tim, dan action sensitif.
3. Tidak ada perubahan lifecycle/server truth, hanya perbaikan shell dan rhythm visual.

**Dampak ke backlog existing**

- `UCW-125` ditambahkan sebagai task polish frontend terpisah dari lifecycle hardening.
- Task ini tetap mengikuti lifecycle truth yang sudah dibakukan di `UCW-124`.

**Task baru atau task revisi**

- Task baru: `UCW-125`

**Perubahan dependency**

- `UCW-125` bergantung pada `UCW-124`.

### `2026-04-19` - Brief reusable toggle wrap-safe untuk opsi multi-tab

**Ringkasan brief**

1. Komponen toggle existing cocok untuk opsi dua tab, tetapi layout horizontalnya memaksa overflow saat opsi lebih dari dua.
2. Beberapa surface yang memakai opsi multi-status / multi-role di mobile mulai melebar dan perlu desain wrap-safe yang reusable.
3. Surface yang terdampak: `Tim`, `HRD pipeline`, `Beneficiary`, dan `Stok`.

**Dampak ke backlog existing**

- `UCW-125` tetap valid untuk shell `Halaman Tim`, tetapi butuh komponen reusable baru agar role selector tidak kembali memaksa horizontal scroll.
- `UCW-110` dan surface HRD lain tetap memakai toggle 2 opsi yang sudah benar; brief ini hanya menyasar opsi >2.

**Task baru atau task revisi**

- Task baru: `UCW-126`

**Perubahan dependency**

- `UCW-126` bergantung pada `UCW-124` dan `UCW-125`.

### `2026-04-19` - Brief core release smoke-flow hardening

**Ringkasan brief**

1. Sambungan lintas surface inti harus diverifikasi agar `Dashboard`, `Jurnal`, `Pembayaran`, payroll workspace, `Unit Kerja`, `Riwayat`, dan `Recycle Bin` terasa satu sistem.
2. Task ini bukan redesign atau feature baru; fokusnya patch route, CTA, naming, dan flow glue yang masih misleading atau buntu.
3. Lifecycle domain, payment logic, payroll correction rule, dan kontrak server truth harus tetap utuh.

**Dampak ke backlog existing**

- `UCW-87` tetap menjadi hardening server truth untuk `Unit Kerja`, tetapi masih butuh glue navigasi ke surface sumber.
- `UCW-124` sampai `UCW-126` tetap valid; task baru ini hanya memastikan sambungan core release tidak drift secara naming atau landing flow.

**Task baru atau task revisi**

- Task baru: `UCW-127`

**Perubahan dependency**

- `UCW-127` bergantung pada `UCW-87`, `UCW-124`, `UCW-125`, dan `UCW-126`.

### `2026-04-19` - Brief hardening `Unit Kerja` summary report agar source truth server-side

**Ringkasan brief**

1. Summary `Unit Kerja` harus membaca source of truth server-side, bukan agregasi client yang bisa drift.
2. Agregasi finance lintas domain untuk report inti harus tetap ringkas, mobile-first, dan operasional.
3. UI report tidak boleh menambah kalkulasi liar, helper text baru, atau perluasan domain bisnis.

**Dampak ke backlog existing**

- `UCW-87` menjadi task implementasi report inti yang spesifik untuk hardening summary `Unit Kerja`.
- Task ini tetap sempit pada read model report dan tidak membuka domain write baru.

**Task baru atau task revisi**

- Task revisi: `UCW-87`

**Perubahan dependency**

- Tetap mengikuti dependency `UCW-79`, `UCW-80`, `UCW-81`, `UCW-82`, `UCW-83`, `UCW-85`, dan `UCW-95`.

### `2026-04-19` - Brief hardening `Riwayat` detail/back-navigation agar context completed/history tetap jelas

**Ringkasan brief**

1. Detail yang dibuka dari `Riwayat` harus tetap terbaca sebagai completed/history context, bukan surface aktif `Jurnal`.
2. Back-navigation dari detail riwayat harus kembali ke `Riwayat`, bukan bergantung pada history stack yang bisa drift.
3. CTA write/active seperti payment, edit, delete, dan attachment mutation tidak boleh terasa sebagai aksi workspace aktif saat detail berasal dari `Riwayat`.

**Dampak ke backlog existing**

- `UCW-128` sudah memisahkan surface `Riwayat`, tetapi detail context masih perlu hardening agar page detail tidak misleading saat entry point-nya dari histori.
- `ExpenseAttachmentSection` perlu bisa dibaca read-only ketika dipakai dari detail history agar audit tetap lengkap tanpa membuka write affordance.

**Task baru atau task revisi**

- Task baru: `UCW-129`

**Perubahan dependency**

- `UCW-129` bergantung pada `UCW-128`.

### `2026-04-19` - Brief hardening `Recycle Bin` detail/back-navigation agar context deleted/recovery tetap jelas

**Ringkasan brief**

1. Detail yang dibuka dari `Recycle Bin` harus tetap terbaca sebagai deleted/recovery context, bukan surface aktif `Jurnal` atau `Riwayat`.
2. Back-navigation dari detail recycle bin harus kembali ke `Recycle Bin` secara eksplisit.
3. CTA write/active yang tidak relevan untuk deleted context harus dibatasi, tetapi restore dan permanent delete tetap usable sesuai guard tree yang sudah ada.

**Dampak ke backlog existing**

- `UCW-129` sudah mengunci completed/history detail, tetapi deleted/recovery surface masih perlu hardening agar page detail tidak misleading saat entry point-nya dari recycle bin.
- Detail recycle bin untuk deleted transaction perlu berperan sebagai surface audit, bukan jalan masuk ke workspace aktif.

**Task baru atau task revisi**

- Task baru: `UCW-130`

**Perubahan dependency**

- `UCW-130` bergantung pada `UCW-129`.

### `2026-04-19` - Brief preserve list state saat kembali dari detail `Riwayat` / `Recycle Bin`

**Ringkasan brief**

1. Search/filter dan pagination state pada `Riwayat` harus tetap terasa stabil saat user kembali dari detail.
2. Filter serta posisi list pada `Recycle Bin` harus tetap terasa stabil saat user kembali dari detail.
3. Jika murah untuk dipertahankan, scroll position ikut dijaga lewat state glue kecil, tanpa mengubah domain semantics.

**Dampak ke backlog existing**

- `UCW-129` dan `UCW-130` sudah mengunci context detail, tetapi back-navigation masih bisa terasa reset jika list state tidak dipreservasi.
- Preserve state ini murni hardening navigasi/list state, bukan perubahan read/write domain.

**Task baru atau task revisi**

- Task baru: `UCW-131`

**Perubahan dependency**

- `UCW-131` bergantung pada `UCW-129` dan `UCW-130`.

### `2026-04-19` - Brief hardening `Dashboard` quick-launch dan recent activity agar tetap selaras dengan `Jurnal`

**Ringkasan brief**

1. `Dashboard` tetap harus menjadi overview cepat, bukan workspace CRUD utama.
2. Quick-launch di dashboard harus mengarah ke surface inti yang benar dan tidak mempertahankan naming/route lama yang misleading.
3. Recent activity harus tetap menjadi subset yang konsisten dari truth `Jurnal`, lalu CTA detail-nya tidak boleh membuka jalur action lama yang drift.

**Dampak ke backlog existing**

- `UCW-127` sudah menutup smoke-flow lintas surface inti, tetapi `Dashboard` masih perlu hardening supaya entry CTA dan recent activity benar-benar mengikuti contract map.
- `UCW-37` sudah menekan aksi mutasi dashboard, namun data recent activity masih perlu diselaraskan ke source `Jurnal` yang sama dengan ledger.

**Task baru atau task revisi**

- Task baru: `UCW-132`

**Perubahan dependency**

- `UCW-132` bergantung pada `UCW-127` dan `UCW-131`.

### `2026-04-19` - Brief hardening route standalone `Tagihan` / `Pembayaran`

**Ringkasan brief**

1. `Tagihan` perlu punya workspace route sendiri agar kewajiban aktif tidak bergantung pada deep-link settlement.
2. `Pembayaran` perlu punya workspace route sendiri agar histori settlement dan aksi settlement punya surface yang tegas.
3. Naming surface harus selaras freeze, tetapi lifecycle payment, delete/void semantics, dan source of truth settlement tetap utuh.

**Dampak ke backlog existing**

- `UCW-132` sudah memberi route target yang jelas untuk dashboard, tetapi dua workspace payment belum punya surface yang cukup tegas untuk dipakai sebagai launcher utama.
- Brief ini hanya menambah route/workspace clarity; tidak membuka domain write baru.

**Task baru atau task revisi**

- Task baru: `UCW-133`

**Perubahan dependency**

- `UCW-133` bergantung pada `UCW-132`.

### `2026-04-20` - Brief wiring quick-launch `Dashboard` untuk `Tagihan` / `Pembayaran`

**Ringkasan brief**

1. Dashboard quick-launch harus memakai route workspace `Tagihan` dan `Pembayaran` yang baru.
2. Wiring CTA harus tetap ringkas dan tidak mengubah Dashboard menjadi workspace CRUD utama.
3. Launcher lain yang sudah benar tidak boleh terdampak oleh patch ini.

**Dampak ke backlog existing**

- `UCW-133` sudah memberi route standalone yang tegas untuk `Tagihan` dan `Pembayaran`, tetapi Dashboard masih belum memakainya sebagai target quick-launch.
- Brief ini hanya menyambungkan launcher ke route yang sudah valid; tidak membuka domain write baru.

**Task baru atau task revisi**

- Task baru: `UCW-134`

**Perubahan dependency**

- `UCW-134` bergantung pada `UCW-133`.

### `2026-04-20` - Brief hardening detail `Pembayaran` agar context settlement tetap tegas

**Ringkasan brief**

1. Detail payment leaf dari workspace `Pembayaran` harus tetap terasa sebagai context settlement/payment history.
2. Back-navigation dari detail payment leaf harus kembali ke `Pembayaran`, bukan ke `Jurnal` atau surface generik.
3. CTA/detail behavior untuk payment leaf harus tetap audit-friendly dan tidak menggeser lifecycle payment.

**Dampak ke backlog existing**

- `UCW-133` dan `UCW-134` sudah menegaskan route `Pembayaran`, tetapi row histori payment masih membuka detail transaksi generik tanpa context workspace yang eksplisit.
- Brief ini hanya menajamkan context detail dan back-navigation; tidak membuka domain write baru.

**Task baru atau task revisi**

- Task baru: `UCW-135`

**Perubahan dependency**

- `UCW-135` bergantung pada `UCW-133` dan `UCW-134`.

### `2026-04-20` - Brief hardening detail `Tagihan` agar context bill workspace tetap tegas

**Ringkasan brief**

1. Detail bill dari workspace `Tagihan` harus tetap terasa sebagai context bill workspace.
2. Back-navigation dari detail bill harus kembali ke `/tagihan` saat entry point berasal dari sana.
3. CTA/detail behavior untuk bill harus tetap terasa sebagai kewajiban aktif dan tidak menggeser lifecycle payment.

**Dampak ke backlog existing**

- `UCW-133` dan `UCW-135` sudah menegaskan route `Tagihan` dan detail-context `Pembayaran`, tetapi detail bill masih perlu konfirmasi context workspace yang eksplisit.
- Brief ini hanya menajamkan context detail dan back-navigation; tidak membuka domain write baru.

**Task baru atau task revisi**

- Task baru: `UCW-136`

**Perubahan dependency**

- `UCW-136` bergantung pada `UCW-133` dan `UCW-135`.

### `2026-04-20` - Brief cross-entry context sweep untuk `Tagihan` / `Pembayaran`

**Ringkasan brief**

1. Entry point penting ke bill/payment detail harus membawa context surface yang benar jika berasal dari surface settlement-aware.
2. `Tagihan` tetap harus terasa sebagai bill workspace context, dan `Pembayaran` tetap harus terasa sebagai payment workspace context.
3. `Jurnal` boleh tetap generic ledger detail jika entry point-nya memang dari ledger aktif.

**Dampak ke backlog existing**

- `UCW-133`, `UCW-135`, dan `UCW-136` sudah menutup route/detail utama, tetapi masih ada cross-entry CTA yang berpotensi drift ke route generik.
- Brief ini hanya menyapu context propagation dan back-navigation untuk entry point penting; tidak membuka domain write baru.

**Task baru atau task revisi**

- Task baru: `UCW-137`

**Perubahan dependency**

- `UCW-137` bergantung pada `UCW-133`, `UCW-135`, dan `UCW-136`.

### `2026-04-20` - Brief targeted deprecation sweep untuk legacy settlement route callers

**Ringkasan brief**

1. Caller aktif baru harus makin konsisten ke route workspace settlement yang resmi.
2. Route legacy `/payment/:id` dan `/loan-payment/:id` boleh tetap hidup sementara untuk kompatibilitas, tetapi caller aktif harus dipindah.
3. Patch harus fokus pada caller yang memang masih drift, bukan sweeping buta ke semua legacy string.

**Dampak ke backlog existing**

- `UCW-137` sudah menyapu context propagation utama, tetapi beberapa caller settlement lama masih tersisa di file operasional yang sering dipakai.
- Brief ini hanya memindahkan caller aktif yang masih drift ke route workspace baru; tidak membuka domain write baru.

**Task baru atau task revisi**

- Task baru: `UCW-138`

**Perubahan dependency**

- `UCW-138` bergantung pada `UCW-133` dan `UCW-137`.

### `2026-04-20` - Legacy settlement alias removal readiness audit

**Ringkasan brief**

1. Audit apakah alias settlement lama `/payment/:id` dan `/loan-payment/:id` masih punya caller aktif internal atau routing glue internal yang bergantung padanya.
2. Jika aman, alias boleh dipensiunkan; jika belum aman, alias dipertahankan dan keputusan harus didokumentasikan tegas.
3. Task ini hanya audit compatibility/routing, bukan perubahan lifecycle payment.

**Dampak ke backlog existing**

- `UCW-138` sudah memindahkan caller aktif ke route workspace resmi; audit ini hanya menilai apakah compatibility alias masih perlu hidup.
- Tidak ada domain write baru, schema baru, atau perubahan payment lifecycle yang dibuka oleh audit ini.

**Task baru atau task revisi**

- Task baru: `UCW-139`

**Perubahan dependency**

- `UCW-139` bergantung pada `UCW-138`.

### `2026-04-20` - Brief preserve list state untuk `Tagihan` / `Pembayaran`

**Ringkasan brief**

1. Kembalinya user dari detail ke workspace `Tagihan` atau `Pembayaran` harus mempertahankan konteks list agar tidak terasa reset brutal.
2. Preserve state ini fokus pada list/navigation state dan scroll position, bukan perubahan lifecycle settlement.
3. Patch harus kecil dan mengikuti pola state persistence yang sudah dipakai di halaman list lain.

**Dampak ke backlog existing**

- `UCW-133` sampai `UCW-139` sudah menegaskan route dan context settlement; brief ini hanya menguatkan UX kembali ke list.
- Tidak ada domain write baru, schema baru, atau perubahan payment lifecycle yang dibuka oleh brief ini.

**Task baru atau task revisi**

- Task baru: `UCW-140`

**Perubahan dependency**

- `UCW-140` bergantung pada `UCW-139`.

### `2026-04-20` - Brief koreksi arsitektur settlement: Jurnal kembali jadi primary UX

**Ringkasan brief**

1. `Jurnal` kembali menjadi workspace aktif utama untuk settlement dan row action parent.
2. `Tagihan` dan `Pembayaran` tetap boleh hidup sebagai route kompatibilitas, tetapi tidak lagi menjadi launcher atau UX utama.
3. UI `Recycle Bin` harus ditampilkan sebagai `Halaman Sampah`.

**Dampak ke backlog existing**

- `UCW-133` sampai `UCW-140` yang sempat menguatkan route standalone `Tagihan` / `Pembayaran` dibaca sebagai direction sementara yang sekarang superseded untuk primary UX.
- Tidak ada perubahan lifecycle payment, correction rule payroll, schema, atau write boundary.

**Task baru atau task revisi**

- Task baru: `UCW-141`

**Perubahan dependency**

- `UCW-141` bergantung pada `UCW-140`.

### `2026-04-20` - Brief hardening performa dan state `Jurnal`

**Ringkasan brief**

1. `Jurnal` harus lebih ringan saat memuat data dan lebih stabil saat user kembali dari detail atau aksi row.
2. Search, filter, dan pagination untuk `Jurnal` harus tetap server-side, bukan bergantung pada load penuh client-side.
3. Patch harus kecil, tetap menempel ke row parent di `Jurnal`, dan tidak mengubah lifecycle domain inti.

**Dampak ke backlog existing**

- Brief settlement correction sebelumnya sudah mengembalikan pusat UX ke `Jurnal`; brief ini mengeraskan performa/state workspace yang sama tanpa membuka flow settlement terpisah lagi.
- `Riwayat` dan `Halaman Sampah` tetap menjadi surface pendukung yang tidak diubah dalam task ini.

**Task baru atau task revisi**

- Task baru: `UCW-142`

**Perubahan dependency**

- `UCW-142` bergantung pada `UCW-141`.

### `2026-04-20` - Brief hardening performa dan state `Riwayat`

**Ringkasan brief**

1. `Riwayat` harus lebih ringan saat memuat data dan lebih stabil saat user kembali dari detail.
2. Search, filter, dan pagination untuk `Riwayat` harus tetap server-side, bukan bergantung pada load penuh client-side.
3. Patch harus kecil, tetap menjaga `Riwayat` sebagai completed/history surface, dan tidak mencampur recovery/deleted surface.

**Dampak ke backlog existing**

- Brief `Jurnal` sebelumnya sudah mengunci pola server-side read model dan persistence state list; brief ini menerapkan pola yang sama untuk `Riwayat` dengan domain completed/history saja.
- `Halaman Sampah` tetap surface terpisah dan tidak ikut dicampur ke `Riwayat`.

**Task baru atau task revisi**

- Task baru: `UCW-143`

**Perubahan dependency**

- `UCW-143` bergantung pada `UCW-142`.

### `2026-04-20` - Brief rekonsiliasi migration chain `vw_workspace_transactions` -> `vw_history_transactions`

**Ringkasan brief**

1. Migration history read model harus bisa diterapkan bersih di target environment tanpa asumsi prerequisite view sudah ada.
2. Chain `vw_workspace_transactions` -> `vw_history_transactions` harus aman saat deployment berurutan maupun saat branch target belum membawa prerequisite chain yang lengkap.
3. Patch harus kecil, menjaga `Riwayat` tetap completed/history-only server-side surface, dan tidak mengubah semantics domain inti.

**Dampak ke backlog existing**

- Task `Riwayat` sudah valid di code, tetapi target deployment masih gagal karena migration history view bergantung pada prerequisite workspace view yang belum ada di chain aktif.
- Rekonsiliasi migration ini diperlukan sebelum hardening lanjutan `Halaman Sampah`.

**Task baru atau task revisi**

- Task baru: `UCW-144`

**Perubahan dependency**

- `UCW-144` bergantung pada `UCW-143`.

### `2026-04-20` - Brief hardening performa dan state `Halaman Sampah`

**Ringkasan brief**

1. `Halaman Sampah` harus lebih ringan saat memuat data dan lebih stabil saat kembali dari detail atau aksi row.
2. Search, filter, dan pagination untuk `Halaman Sampah` harus konsisten, tetap deleted/recovery-only, dan tidak melemahkan guard tree restore/permanent delete.
3. Patch harus kecil dan tidak mencampur `Halaman Sampah` dengan completed/history surface.

**Dampak ke backlog existing**

- Setelah `Jurnal`, `Riwayat`, dan migration chain history stabil, surface deleted/recovery ini perlu hardening yang setara tanpa mengubah lifecycle domain inti.
- `Halaman Sampah` tetap terpisah dari `Riwayat` dan tetap hanya memuat konteks deleted/recovery.

**Task baru atau task revisi**

- Task baru: `UCW-145`

**Perubahan dependency**

- `UCW-145` bergantung pada `UCW-144`.

### `2026-04-20` - Brief baseline migration bootstrap audit + repair

**Ringkasan brief**

1. Fresh Supabase project harus bisa menerima migration dari nol tanpa gagal di migration awal.
2. Chain awal perlu diaudit untuk baseline table yang hilang, urutan migration yang salah, dan duplicate version prefix.
3. Patch harus sekecil mungkin tetapi cukup untuk membuat bootstrap deployable di environment kosong.

**Dampak ke backlog existing**

- Bootstrap blocker ini memblokir task core berikutnya sampai chain awal bisa dipush bersih ke remote kosong.
- Audit menemukan baseline core yang hilang di migration awal, terutama `projects`, `expenses`, `suppliers`, `transactions`, `profiles`, dan dukungan kolom runtime untuk `bills`/`loans`.

**Task baru atau task revisi**

- Task baru: `UCW-146`

**Perubahan dependency**

- Tidak ada dependency baru; task ini menjadi blocker hygiene untuk bootstrap fresh environment.

### `2026-04-20` - Brief duplicate Supabase migration version repair

**Ringkasan brief**

1. Fresh `supabase db push` sekarang sudah melewati blocker baseline awal, tetapi berhenti di duplicate migration version `20260411120000`.
2. Chain migration harus punya version unik untuk setiap file agar `schema_migrations` tidak bentrok pada remote kosong.
3. Patch harus sekecil mungkin dan tidak mengubah semantics SQL migration terkait.

**Dampak ke backlog existing**

- `UCW-146` menyelesaikan baseline table blocker, lalu verifikasi nyata memunculkan blocker berikutnya pada duplicate version prefix.
- Repair ini wajib selesai sebelum bootstrap remote kosong bisa lanjut ke migration setelah `20260411120000_*`.

**Task baru atau task revisi**

- Task baru: `UCW-147`

**Perubahan dependency**

- `UCW-147` bergantung pada `UCW-146`.

### `2026-04-20` - Brief Supabase storage ownership bootstrap repair

**Ringkasan brief**

1. Fresh `supabase db push` sudah melewati blocker baseline dan duplicate version, tetapi berhenti di operasi ownership-only terhadap `storage.objects`.
2. Chain migration harus tetap bisa bootstrap di remote kosong tanpa mencoba `alter table` atau policy refresh yang tidak diizinkan pada objek storage managed Supabase.
3. Patch harus menjaga intent policy `hrd_documents`, tetapi defensif bila remote role tidak memiliki ownership atas `storage.objects`.

**Dampak ke backlog existing**

- `UCW-147` membuka blocker berikutnya di migration storage policy.
- Repair ini diperlukan agar bootstrap chain tetap maju di project Supabase baru yang memakai ownership default platform untuk schema `storage`.

**Task baru atau task revisi**

- Task baru: `UCW-148`

**Perubahan dependency**

- `UCW-148` bergantung pada `UCW-147`.

### `2026-04-20` - Brief Supabase profiles role bootstrap compatibility repair

**Ringkasan brief**

1. Fresh `supabase db push` sudah melewati blocker storage, tetapi berhenti di migration `20260411190000` karena masih mengasumsikan kolom legacy `public.profiles.role`.
2. Seed `team_members` harus tetap berjalan pada baseline profile minimal yang hanya menjamin `id` dan `telegram_user_id`.
3. Patch harus kecil, kompatibel ke dua kondisi schema, dan tidak menambah semantics domain baru.

**Dampak ke backlog existing**

- `UCW-148` membuka blocker berikutnya pada asumsi schema legacy di blok backfill RBAC.
- Repair ini diperlukan agar bootstrap fresh remote bisa terus maju tanpa bergantung pada kolom `profiles.role` yang tidak lagi menjadi baseline wajib.

**Task baru atau task revisi**

- Task baru: `UCW-149`

**Perubahan dependency**

- `UCW-149` bergantung pada `UCW-148`.

### `2026-04-20` - Brief Supabase RBAC bootstrap syntax repair

**Ringkasan brief**

1. Retry `db push` setelah `UCW-149` masih berhenti di file yang sama karena fallback expression SQL untuk role default memakai dollar-quote yang bentrok.
2. Repair yang dibutuhkan hanya koreksi syntax pada fallback `'Viewer'`, bukan perubahan logic baru.
3. Patch harus menjaga perilaku adaptif `profiles.role` yang sudah ditetapkan pada `UCW-149`.

**Dampak ke backlog existing**

- `UCW-149` benar secara intent, tetapi implementasinya masih menyisakan parser error di remote.
- Repair ini diperlukan agar migration `20260411190000` benar-benar bisa dieksekusi ulang pada project yang sama.

**Task baru atau task revisi**

- Task baru: `UCW-150`

**Perubahan dependency**

- `UCW-150` bergantung pada `UCW-149`.

### `2026-04-20` - Brief Supabase file_assets bootstrap compatibility repair

**Ringkasan brief**

1. Retry `db push` setelah `UCW-150` berhenti di `file_assets_storage_bucket_path_key` karena `public.file_assets` sudah ada dalam bentuk minimal dari migration HRD awal.
2. Migration alignment harus memperkaya tabel `file_assets` lama itu sebelum membuat index yang bergantung pada `storage_bucket`.
3. Patch harus menjaga semantics alignment yang sama, hanya menutup mismatch baseline-vs-alignment untuk fresh bootstrap.

**Dampak ke backlog existing**

- `UCW-150` membuka blocker berikutnya pada asumsi bahwa `public.file_assets` sudah berada pada schema versi penuh.
- Repair ini diperlukan agar chain bootstrap bisa terus maju saat remote kosong membangun tabel `file_assets` lewat migration HRD lebih dulu.

**Task baru atau task revisi**

- Task baru: `UCW-151`

**Perubahan dependency**

- `UCW-151` bergantung pada `UCW-150`.

### `2026-04-20` - Brief hardening owner bypass auth untuk project baru

**Ringkasan brief**

1. Owner bypass harus tetap lolos pada project Supabase baru tanpa bergantung pada team default yang sudah ada secara manual.
2. Env owner id perlu lebih toleran terhadap alias yang umum dipakai saat deploy atau migrasi project.
3. Auth owner jangan jatuh ke `Akses Ditolak` hanya karena workspace default belum aktif atau membership cache client belum sinkron.

**Dampak ke backlog existing**

- `UCW-151` menutup bootstrap storage/file_assets, tetapi auth owner di project fresh masih bisa drift ke access denied bila team default tidak tersedia atau env owner id tidak terbaca dari alias yang dipakai.
- Brief ini hanya menguatkan boundary auth owner bypass dan workspace bootstrap kecil; tidak membuka schema baru atau write domain baru.

**Task baru atau task revisi**

- Task baru: `UCW-152`

**Perubahan dependency**

- Tidak ada dependency baru; task ini berdiri sendiri pada boundary auth.

### `2026-04-20` - Incident auth bootstrap repair setelah migrasi Supabase project baru

**Ringkasan brief**

1. Login Telegram Mini App gagal di boundary auth bootstrap meskipun migration dasar, `teams`, dan `team_members` owner sudah benar di project baru.
2. Incident harus diaudit end-to-end sampai ketemu titik gagal nyata pada verifikasi Telegram auth, bootstrap profile, atau membership bootstrap.
3. Incident ini memblokir kelanjutan task produk berikutnya sampai owner account bisa lolos masuk workspace lagi.

**Dampak ke backlog existing**

- `UCW-152` sudah mengeraskan owner bypass terhadap workspace default/env alias, tetapi incident nyata di project baru menunjukkan blocker auth bootstrap tambahan yang lebih awal pada query profile.
- Semua task produk sesudah auth boundary ini harus ditahan sementara sampai incident login owner tervalidasi selesai, karena stream tidak boleh lanjut saat workspace utama belum bisa dibuka.

**Task baru atau task revisi**

- Task baru: `UCW-153`

**Perubahan dependency**

- `UCW-153` menjadi blocker operasional sebelum stream kembali lanjut ke task produk berikutnya.

### `2026-04-20` - Brief hardening read model dan snapshot `Halaman Sampah`

**Ringkasan brief**

1. Read path `Halaman Sampah` harus lebih ringan dan stabil dengan source of truth tunggal untuk deleted/recovery list.
2. Kembali dari detail atau aksi row tidak boleh merusak state filter/search/pagination yang sudah ada.
3. Guard restore/permanent delete dan boundary deleted/recovery harus tetap utuh tanpa drift ke `Riwayat` atau `Jurnal`.

**Dampak ke backlog existing**

- Incident auth bootstrap sudah ditutup, jadi stream kembali fokus ke hardening surface deleted/recovery yang tersisa.
- `Halaman Sampah` masih sensitif terhadap read amplification karena list, search, pagination, dan detail return semuanya bertemu di satu jalur.

**Task baru atau task revisi**

- Task baru: `UCW-154`

**Perubahan dependency**

- `UCW-154` bergantung pada `UCW-153`.

### `2026-04-20` - Brief profiling jalur `loan` vs `Jurnal` / `Riwayat` / `Halaman Sampah`

**Ringkasan brief**

1. Jalur `loan` yang terasa instan perlu dipetakan sebagai baseline performa: read path sempit, payload kecil, dan transform minimal.
2. Tiga surface inti `Jurnal`, `Riwayat`, dan `Halaman Sampah` perlu diaudit sebagai read model unified yang berpotensi menahan first paint karena breadth payload, merge metadata, dan state restore.
3. Task lanjutan harus spesifik dan berurutan, bukan refactor generik, agar solusi performance berikutnya bisa dipilih berdasarkan bottleneck nyata.

**Dampak ke backlog existing**

- Hardening state yang sudah validated tetap berlaku, tetapi audit ini menunjukkan first-page performance nyata masih bisa tertahan oleh struktur read path yang berbeda antara `loan` dan surface unified ledger.
- Task berikutnya harus memisahkan bottleneck pertama antara payload awal, transform client-side, dan skeleton gating sebelum menyentuh refactor implementasi yang lebih besar.

**Task baru atau task revisi**

- Task baru: `UCW-155`

**Perubahan dependency**

- `UCW-155` bergantung pada hasil audit yang menegaskan perbedaan struktural jalur `loan` vs `Jurnal` / `Riwayat` / `Halaman Sampah`.

### `2026-04-20` - Brief trim first-paint payload `Jurnal` / `Riwayat`

**Ringkasan brief**

1. Implementasikan rekomendasi prioritas #1 dari `UCW-155` dengan menyingkirkan creator metadata merge dari critical path first paint `Jurnal` dan `Riwayat`.
2. Initial list tetap harus render dari shell minimal yang cukup, tanpa menahan skeleton karena hydration metadata sekunder.
3. Perubahan harus tetap menjaga server-side pagination/filter/search, canonical row contract, dan semantics domain inti.

**Dampak ke backlog existing**

- `UCW-155` sudah membuktikan bottleneck utama ada pada breadth read path dan merge metadata; brief ini mengeksekusi rekomendasi paling berdampak dengan scope paling sempit.
- `Jurnal` dan `Riwayat` tetap menjadi surface inti, tetapi payload awalnya perlu dipangkas agar first paint tidak menunggu metadata sekunder.

**Task baru atau task revisi**

- Task baru: `UCW-156`

**Perubahan dependency**

- `UCW-156` bergantung pada hasil audit `UCW-155`.

### `2026-04-20` - Brief instrumentation timing kecil untuk core list dan loan path

**Ringkasan brief**

1. Tambahkan timing ringan untuk membandingkan `Jurnal`, `Riwayat`, `Halaman Sampah`, dan branch fast loan yang relevan di dashboard.
2. Instrumentasi harus membedakan first response, first usable list, dan bila ada hydration/secondary merge tanpa observability platform besar.
3. Logging harus dev-safe, sempit, dan mudah diabaikan di produksi.

**Dampak ke backlog existing**

- `UCW-155` dan `UCW-156` sudah memberi diagnosis dan trim payload; brief ini menambahkan bukti timing supaya task optimasi berikutnya berbasis angka, bukan asumsi.
- `Jurnal`, `Riwayat`, `Halaman Sampah`, dan dashboard loan branch tetap domain yang sama; tugas ini hanya menambah pengukuran kecil.

**Task baru atau task revisi**

- Task baru: `UCW-157`

**Perubahan dependency**

- `UCW-157` bergantung pada baseline diagnosis `UCW-155` dan trim payload `UCW-156`.

### `2026-04-20` - Brief ringankan fan-out fetch `Dashboard`

**Ringkasan brief**

1. Fast loan/summary path di `Dashboard` harus diprioritaskan sebelum branch yang lebih berat agar dashboard terasa hidup lebih cepat.
2. Workspace transactions dapat ditunda sebagai sibling fetch terpisah tanpa mengubah source of truth atau kontrak domain.
3. Perubahan harus tetap kecil, hanya mengatur urutan fetch dan gating ringan.

**Dampak ke backlog existing**

- Temuan `UCW-155` menunjukkan fan-out dashboard ikut menahan branch yang lebih ringan; brief ini mengeksekusi follow-up kecil untuk mengurangi blocking itu.
- `Jurnal`, `Riwayat`, dan `Halaman Sampah` tidak berubah dalam task ini.

**Task baru atau task revisi**

- Task baru: `UCW-158`

**Perubahan dependency**

- `UCW-158` bergantung pada instrumentasi dan diagnosis `UCW-157` serta temuan fan-out `UCW-155`.

### `2026-04-20` - Brief core CRUD reliability gate

**Ringkasan brief**

1. Fokus berikutnya harus menutup blocker fungsi inti yang paling dipakai harian: create, edit, delete, restore, dan payment.
2. Task ini harus audit end-to-end konsistensi route UI, store, API, dan source of truth data untuk `TransactionsPage`, `EditRecordPage`, `PaymentPage`, serta store terkait.
3. Perubahan harus tetap sempit dan memprioritaskan perbaikan fungsi dasar yang benar sebelum polish visual atau perluasan feature lain.

**Dampak ke backlog existing**

- Task performa dan hardening yang sudah validated tetap berlaku, tetapi kebutuhan release sekarang bergeser ke reliability core CRUD.
- Jika ada mismatch antara route, store, API, dan schema yang menghalangi create/edit/delete/payment, itu menjadi blocker utama task ini.
- Audit awal menemukan mismatch schema `profiles.role` di `api/records.js` yang sempat memblokir read path records/dashboard; patch minimal menurunkannya ke lookup role yang aman tanpa membuka perubahan kontrak domain.

**Task baru atau task revisi**

- Task baru: `UCW-159`

**Perubahan dependency**

- Tidak ada dependency baru; task ini berdiri sebagai gate audit reliabilitas core feature.

### `2026-04-20` - Audit sisa referensi schema legacy di core flow

**Ringkasan brief**

1. Audit sisa jalur core feature untuk memastikan tidak ada referensi schema legacy yang masih bisa memutus create, edit, delete, restore, payment, atau load harian.
2. Fokus audit tetap sempit pada handler dan store core flow, bukan polish UI atau refactor besar.
3. Jika ada referensi legacy yang benar-benar memutus jalur harian, patch harus dilakukan minimal pada sumbernya.

**Dampak ke backlog existing**

- Setelah `UCW-159`, core flow sudah kembali hidup; brief ini hanya memverifikasi bahwa tidak ada referensi schema legacy lain yang masih berbahaya di jalur harian.
- Referensi legacy yang masih tersisa dan kompatibel tidak perlu disentuh bila tidak memutus flow inti.

**Task baru atau task revisi**

- Task baru: `UCW-160`

**Perubahan dependency**

- Tidak ada dependency baru; audit ini berdiri sebagai verifikasi lanjutan setelah blocker schema legacy utama ditutup.

### `2026-04-20` - Smoke audit runtime core flow

**Ringkasan brief**

1. Lakukan smoke audit end-to-end untuk core flow `create`, `edit`, `delete`, `restore`, dan `payment` dengan fokus pada runtime error, bukan feature baru.
2. Gunakan session owner Telegram valid untuk memverifikasi auth bootstrap, lalu smoke read/write entrypoint core flow dengan payload aman.
3. Jika tidak ada blocker runtime baru, tugas ini berakhir sebagai audit valid tanpa patch kosmetik.

**Dampak ke backlog existing**

- `UCW-159` dan `UCW-160` sudah menutup blocker schema legacy utama; brief ini memverifikasi bahwa runtime core flow tetap clear setelah patch tersebut.
- Karena dataset live saat ini kosong, smoke write path hanya bisa diuji sampai validasi handler/entrypoint tanpa mutasi data yang berisiko.

**Task baru atau task revisi**

- Task baru: `UCW-161`

**Perubahan dependency**

- Tidak ada dependency baru; task ini berdiri sebagai smoke verification gate setelah audit legacy core flow.

### `2026-04-20` - Audit gap schema Supabase project baru vs legacy contract

**Ringkasan brief**

1. Audit menyeluruh perlu memetakan gap antara schema Supabase project baru dan schema/kontrak legacy dari project sebelumnya agar core feature bisa diputuskan dengan bukti, bukan asumsi.
2. Fokus audit tetap pada create, edit, delete/restore, payment/partial payment, attachment bila memblokir core flow, dan read model workspace/ledger yang memutus operasi inti.
3. Task ini audit-only: tidak ada patch runtime, migration, refactor, atau implementasi feature sampai matriks gap dan prioritas blocker selesai.

**Dampak ke backlog existing**

- Audit ini menjadi dasar implementasi berikutnya setelah `UCW-161` memastikan runtime core flow masih clear.
- Referensi legacy yang masih hidup harus diklasifikasikan apakah wajib dipertahankan, dipindah, diganti, atau dihapus sebelum ada perubahan runtime.

**Task baru atau task revisi**

- Task baru: `UCW-162`

**Perubahan dependency**

- Tidak ada dependency baru; audit ini berdiri sebagai pemetaan source of truth sebelum langkah implementasi core berikutnya.

### `2026-04-20` - Alihkan dashboard summary off `vw_transaction_summary` bridge

**Ringkasan brief**

1. Dashboard summary harus dibangun dari cashflow operasional current source of truth, bukan lagi bergantung pada bridge legacy `vw_transaction_summary`.
2. Read path tetap server-side dan tidak boleh membuka write path legacy baru atau menyentuh `TransactionForm`.
3. Perubahan dibuat sesempit mungkin: cukup pindahkan summary read model, tanpa mengubah lifecycle domain lain.

**Dampak ke backlog existing**

- Menutup sisa gap `IR-00` untuk dashboard summary agar tidak lagi tergantung pada bridge legacy.
- Mengurangi risiko legacy contamination dari `transactions` pada read model dashboard.
- `vw_transaction_summary` masih boleh hidup sementara sebagai bridge kompatibilitas, tetapi bukan consumer dashboard.

**Task baru atau task revisi**

- Task baru: `UCW-163`

**Perubahan dependency**

- Tidak ada dependency baru; task ini hanya memindahkan dashboard summary ke source operasional yang sudah ada.

### `2026-04-20` - Quarantine dan retire legacy `submitTransaction()` / `TransactionForm`

**Ringkasan brief**

1. Legacy write path `submitTransaction()` harus diputus total dari flow aktif karena dashboard summary sudah pindah ke path operasional.
2. Host form lamanya harus dikarantina atau diretir tanpa menghidupkan write path ke `transactions`.
3. Perubahan harus sempit, hanya pada legacy write boundary dan dokumen backlog/progress.

**Dampak ke backlog existing**

- Menutup jalur legacy write paling jelas yang masih menulis ke `transactions`.
- Mengurangi risiko AI assistant atau contributor berikutnya salah mengira `TransactionForm` masih form aktif.
- Dashboard summary dan flow core current tetap tidak tersentuh.

**Task baru atau task revisi**

- Task baru: `UCW-164`

**Perubahan dependency**

- Tidak ada dependency baru; task ini hanya memutus dan mengkarantina write path legacy yang tersisa.

### `2026-04-20` - Audit residual exposure `TransactionForm` sebagai host inert

**Ringkasan brief**

1. Audit apakah `TransactionForm` masih punya route, alias, deep link, atau consumer internal yang menghidupkan write path lama.
2. Pastikan tidak ada referensi dokumen aktif yang masih memperlakukan `TransactionForm` sebagai form aktif.
3. Task ini audit-only; tidak boleh mengubah write boundary, dashboard summary, atau schema.

**Dampak ke backlog existing**

- Mengonfirmasi bahwa `TransactionForm` benar-benar tinggal sebagai host inert.
- Memastikan tidak ada exposure internal yang membuat legacy write path aktif lagi secara tidak sengaja.
- Tidak membuka pekerjaan implementasi baru; ini hanya checkpoint deprecation.

**Task baru atau task revisi**

- Task baru: `UCW-165`

**Perubahan dependency**

- Tidak ada dependency baru; hasil audit hanya mempertegas status inert dan exposure-nya.

### `2026-04-20` - Bersihkan dokumentasi legacy tentang `TransactionForm`

**Ringkasan brief**

1. Sinkronkan bahasa pre-migration yang masih menggambarkan `TransactionForm` sebagai writer aktif.
2. Pastikan dokumen operasional stream menyebut `TransactionForm` sebagai host inert/legacy-only.
3. Perubahan harus docs-only; jangan menyentuh runtime code, API, atau schema.

**Dampak ke backlog existing**

- Mengurangi drift dokumentasi yang berpotensi menyesatkan contributor baru.
- Menjaga plan/progress dan dokumen audit tetap konsisten dengan status runtime saat ini.

**Task baru atau task revisi**

- Task baru: `UCW-166`

**Perubahan dependency**

- Tidak ada dependency baru; hanya sinkronisasi istilah legacy pada dokumen.

### `2026-04-20` - Rekonsiliasi freeze package dengan runtime authority terkini

**Ringkasan brief**

1. Audit `docs/freeze/*` terhadap runtime aktual untuk dashboard summary, payment boundary, `transactions` legacy, dan `Stok Barang`.
2. Sinkronkan wording freeze hanya pada poin yang punya bukti repo: `submitTransaction`, `usePaymentStore`, `loadOperationalSummary`, route `/stock`, dan boundary direct Supabase exception.
3. Perubahan harus docs-only; jangan menyentuh runtime code, API, schema, atau config build.

**Dampak ke backlog existing**

- Freeze package kembali aman dipakai sebagai authority utama untuk brief implementasi berikutnya.
- Drift antara dokumen freeze dan runtime aktif berkurang pada area summary, pembayaran, stok, dan legacy compatibility.
- Boundary transitional yang masih langsung ke Supabase tercatat jelas sehingga tidak disalahartikan sebagai pola baru domain inti.

**Task baru atau task revisi**

- Task baru: `UCW-167`

**Perubahan dependency**

- Tidak ada dependency baru; task ini hanya merekonsiliasi authority docs dengan runtime repo aktual.

### `2026-04-20` - Optimasi frontend route-level code splitting di `src/App.jsx`

**Ringkasan brief**

1. Ganti static import seluruh page di `src/App.jsx` menjadi route-level code splitting (`React.lazy()` / dynamic import) dalam satu task frontend-only.
2. Pakai fallback global untuk route di dalam `MainLayout` dan fallback terpisah hanya untuk route standalone, dengan desain yang tetap sinkron terhadap shell/app surface repo.
3. Task ini tidak boleh bercampur dengan refactor routing besar, perubahan domain contract, atau cleanup runtime lain di luar optimasi loading boundary.

**Dampak ke backlog existing**

- Debt bundling frontend di `src/App.jsx` sekarang ditutup langsung di task ini, bukan lagi hanya dicatat sebagai catatan samping.
- Seluruh surface route page di `src/App.jsx` dievaluasi dalam satu task frontend-only agar keputusan chunk boundary konsisten.
- Desain fallback auth, layout route, dan standalone route sekarang mengikuti surface visual yang sama sehingga tidak ada loading state yang terasa asing terhadap UI aktif.
- Freeze package tetap menjadi authority produk/kontrak, sementara optimasi bundle diperlakukan sebagai task teknis terukur.

**Task baru atau task revisi**

- Task baru: `UCW-168`

**Perubahan dependency**

- Mengacu pada baseline runtime di `docs/freeze/02-prd-master.md` dan `docs/freeze/05-ai-execution-guardrails.md` yang sudah mencatat static import page dan warning chunk Vite.
- Tidak membuka dependency baru; implementasi mengevaluasi seluruh route page aktif di `src/App.jsx` dalam satu task frontend-only, lalu menjalankan validasi bundling/lint yang relevan.

**Status task**

- `validated`

**Brief implementasi siap eksekusi**

- Tujuan:
  - kurangi debt bundling di `src/App.jsx` dengan route-level code splitting yang mengevaluasi seluruh page route aktif dalam satu task frontend-only
- Allowed files:
  - `src/App.jsx`
  - page/helper loading yang benar-benar dibutuhkan untuk boundary lazy route, bila tanpa itu fallback loading tidak konsisten
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Forbidden files:
  - `api/**`
  - `supabase/**`
  - store domain, schema, kontrak API, `package.json`, `package-lock.json`, config build
- Route/page inventory yang harus dievaluasi bersama:
  - `Dashboard`, `PayrollPage`, `TransactionsPage`, `HistoryPage`, `TransactionsRecycleBinPage`, `DeletedTransactionDetailPage`, `TransactionDetailPage`
  - `BillsPage`, `PaymentPage`, `PaymentsPage`, `ProjectsPage`, `StockPage`, `MasterPage`, `MasterRecycleBinPage`, `MorePage`
  - `AttendancePage`, `HrdPage`, `BeneficiariesPage`, `TeamInvitePage`, `MaterialInvoicePage`, `EditRecordPage`, `MasterFormPage`
- Guard wajib:
  - jangan ubah path route, alias `Navigate`, bootstrap auth, `MainLayout`, atau capability gate route
  - jangan campur cleanup logic page, refactor domain, atau perubahan UX di luar fallback loading yang dibutuhkan oleh lazy route
  - `PaymentPage` yang dipakai lintas beberapa route harus diperlakukan hati-hati agar split boundary tidak menggandakan perilaku route bill/loan
- Validasi wajib:
  - `npm run lint`
  - `npm run build`
  - audit hasil build apakah warning chunk Vite berubah, mengecil, atau tetap ada

**Hasil implementasi**

- `src/App.jsx` sekarang melazy-load seluruh page route aktif melalui `React.lazy()`
- `src/components/layouts/MainLayout.jsx` sekarang memegang `Suspense` global untuk route di dalam shell layout
- fallback auth/loading, fallback route di dalam layout, dan fallback route standalone diselaraskan ke visual `app-page-surface` yang sama
- build produksi sesudah perubahan tidak lagi mengeluarkan warning chunk Vite `> 500 kB`; chunk utama terpecah menjadi beberapa asset route-level yang lebih kecil

### `2026-04-21` - Brief Chrome smoke audit dengan bypass auth lokal sementara

**Ringkasan brief**

1. Browser test lokal harus bisa membuka app tanpa container Telegram, tetapi tetap memakai session Supabase nyata agar flow CRUD/payment diuji pada boundary runtime sebenarnya.
2. Bypass auth harus eksplisit, hanya untuk local/dev smoke testing, dan default ke owner Telegram env agar workspace aktif tetap konsisten.
3. Setelah bypass aktif, lakukan audit Chrome untuk `Dashboard`, `Jurnal`, detail/edit record, `Pembayaran` bill/loan, `Dokumen Barang`, `Halaman Sampah`, dan restore; catat error nyata lalu turunkan follow-up task spesifik.

**Dampak ke backlog existing**

- Menutup blocker verifikasi manual yang sebelumnya membuat beberapa task berstatus `blocked` hanya karena auth Telegram tidak bisa dibootstrap dari browser lokal.
- Memberi jalur audit runtime yang bisa diulang untuk core CRUD/payment tanpa mengubah source of truth domain.
- Temuan browser berikutnya harus diperlakukan sebagai backlog release baru yang berbasis bukti, bukan asumsi.

**Task baru atau task revisi**

- Task baru: `UCW-182`
- Task baru: `UCW-183`

**Perubahan dependency**

- `UCW-183` bergantung pada `UCW-182`.

### `2026-04-21` - Hasil smoke audit Chrome core CRUD/payment pasca bypass lokal

**Ringkasan brief**

1. Bypass lokal `?devAuthBypass=1` berhasil membuka app dari browser biasa dan membuat session Supabase nyata lewat `/api/auth`.
2. Core payment write path untuk bill dan loan terbukti hidup: load detail, create partial payment, kirim `/api/notify`, dan archive payment berjalan.
3. Dua blocker release muncul dari audit browser nyata: read model `Jurnal` / `Riwayat` gagal 500 `User not allowed`, dan restore `bill_payment` mengembalikan 200 tetapi row tetap berada di recycle bin.

**Dampak ke backlog existing**

- `UCW-171`, `UCW-172`, `UCW-173`, dan `UCW-175` tidak lagi terblokir oleh auth Telegram lokal; browser smoke sekarang bisa diulang pada localhost.
- Core write path payment sudah punya bukti runtime pass, jadi backlog berikutnya harus fokus ke read model transaksi dan restore `bill_payment`.
- Audit menunjukkan `Halaman Sampah`, edit `expense`, edit material invoice, dan archive payment masih hidup, sehingga follow-up tidak perlu membuka refactor luas di area itu.

**Task baru atau task revisi**

- Task baru: `UCW-187`
- Task baru: `UCW-188`

**Perubahan dependency**

- `UCW-187` dan `UCW-188` bergantung pada hasil audit `UCW-183`.

### `2026-04-21` - Hasil smoke audit Chrome menyeluruh untuk create/edit/delete/restore/payroll/material flow

**Ringkasan brief**

1. Verifikasi database menunjukkan user bypass lokal dari `OWNER_TELEGRAM_ID` sudah punya membership aktif di workspace default, jadi denial UI yang terlihat bukan disebabkan role seed yang hilang.
2. Smoke browser lanjutan membuktikan create payment `bill` dan `loan` tetap hidup, archive payment `bill` hidup, edit material invoice route hidup, tetapi sejumlah flow inti lain masih terblokir pada route create, attendance sheet, create `surat_jalan`, dan delete material invoice.
3. Follow-up berikutnya harus mempertahankan task existing `UCW-187` dan `UCW-188`, lalu menutup empat blocker baru dengan task sempit yang langsung menargetkan boundary rusak yang terbukti di browser.

**Dampak ke backlog existing**

- `UCW-187` dan `UCW-188` tetap relevan karena `User not allowed` dan restore `bill_payment` gagal masih terulang pada smoke terbaru.
- Audit ini menambah blocker baru yang belum tercakup: route create berbasis `EditRecordPage`, hydrate `Absensi Harian`, create `surat_jalan`, dan soft delete material invoice.
- Flow yang sudah lolos browser terbaru tidak perlu dibuka ulang di backlog: create payment `bill`, create payment `loan`, archive payment `bill`, detail payroll harian, dan edit route material invoice.

**Task baru atau task revisi**

- Task baru: `UCW-189`
- Task baru: `UCW-190`
- Task baru: `UCW-191`
- Task baru: `UCW-192`
- Task baru: `UCW-193`

**Perubahan dependency**

- `UCW-190`, `UCW-191`, `UCW-192`, dan `UCW-193` bergantung pada hasil audit `UCW-189`.
- `UCW-192` dan `UCW-193` juga mengandalkan baseline material/stock dari `UCW-177`.

### `2026-04-21` - Hasil smoke test CRUD satu aksi per task dengan bypass lokal

**Ringkasan brief**

1. `UCW-202`, `UCW-203`, `UCW-205`, dan `UCW-206` sudah tervalidasi lewat browser smoke + audit DB/UI: notify create `loan` kembali `200`, guard edit `expense` terkunci sebelum submit, hard delete `loan_payment` benar-benar menghapus row, dan delete `material invoice` yang stoknya sudah terpakai kini diblok lebih awal di UI.
2. `UCW-204` tetap tercatat sebagai blocker audit historis, tetapi ambiguity lifecycle-nya sudah ditutup oleh `UCW-206`: contract final yang dipakai sekarang adalah delete diblok lebih awal bila rollback stok akan melanggar stok final.
3. Backlog stream ini kembali bersih dari empat blocker smoke awal; follow-up berikutnya bisa kembali ke brief baru tanpa membuka ulang error mentah `P0001`/`200 tapi tidak terhapus`.

**Dampak ke backlog existing**

- `UCW-202`, `UCW-203`, `UCW-205`, dan `UCW-206` tertutup sebagai implementasi follow-up yang konsisten dengan smoke browser dan source-of-truth contract.
- `UCW-204` tidak lagi perlu dibuka sebagai bug runtime terpisah, karena perilaku finalnya kini dipindahkan ke rule delete yang eksplisit di freeze, API, dan UI.
- `UCW-188` tetap sehat untuk restore `bill_payment`, dan `UCW-201` tetap tertutup sesudah path delete leaf memakai service-role client murni untuk bypass RLS delete yang sebelumnya masih mengikuti bearer user.

**Task baru atau task revisi**

- Task revisi: `UCW-204` => status `blocked` sebagai audit historis

**Perubahan dependency**

- `UCW-202` bergantung pada hasil smoke `UCW-194`.
- `UCW-203` bergantung pada hasil smoke `UCW-195`.
- `UCW-204` bergantung pada hasil smoke `UCW-196`.
- `UCW-205` bergantung pada hasil smoke `UCW-201`.

### `2026-04-21` - Audit menyeluruh UX lambat untuk `Jurnal` / `Riwayat` / `Halaman Sampah` / `Catatan Absensi` / `Stok Barang`

**Ringkasan brief**

1. Audit repo + DB menunjukkan dataset aktif saat ini masih sangat kecil (`vw_workspace_transactions = 10`, `vw_history_transactions = 3`, `vw_recycle_bin_records = 1`, `attendance_records aktif = 2`, `materials aktif = 1`, `stock_transactions aktif = 3`), jadi kelambatan yang dirasakan sekarang bukan karena volume list yang memang besar.
2. `EXPLAIN ANALYZE` untuk query inti menunjukkan execution query DB masih sub-millisecond sampai sekitar `0.6 ms`, sehingga bottleneck utama saat ini berada di fixed overhead request (`auth -> profile -> team access` per endpoint), strategi first paint yang memblok layar sampai fetch selesai, dan mount cost komponen list di client.
3. Dashboard terasa lebih cepat bukan karena read path `workspace` intrinsik lebih murah, tetapi karena branch `workspaceTransactions` dijadwalkan via `requestAnimationFrame` dan `silent` di background, dashboard sudah punya shell/KPI yang terlihat duluan, lalu hanya merender `5` item terbaru; sebaliknya route khusus melakukan refetch baru, menunggu list page selesai, lalu langsung merender lebih banyak row interaktif.

**Dampak ke backlog existing**

- `UCW-173` tetap relevan sebagai umbrella optimasi first paint list, tetapi terlalu lebar untuk dieksekusi aman dalam satu langkah; brief ini memecahnya menjadi task eksekusi yang lebih sempit dan bisa diaudit.
- Temuan baru menambahkan satu akar masalah lintas-surface yang sebelumnya belum ditulis eksplisit: setiap hit ke `api/transactions.js` dan `api/records.js` masih membayar fixed overhead auth/profile/team lookup yang besar relatif terhadap dataset saat ini.
- `Stok Barang` sebelumnya belum tercakup dalam cluster optimasi `UCW-173`; sekarang dicatat sebagai sibling task sendiri karena source of truth dan route fan-out-nya berbeda.

**Task baru atau task revisi**

- Task baru: `UCW-207`
- Task baru: `UCW-208`
- Task baru: `UCW-209`
- Task baru: `UCW-210`
- Task baru: `UCW-211`
- Task baru: `UCW-212`

**Perubahan dependency**

- `UCW-208` sampai `UCW-212` bergantung pada diagnosis `UCW-207`.
- `UCW-209` fokus pada parity `Dashboard -> Jurnal` untuk data yang sama.
- `UCW-210` menutup mount cost render row/action sheet pada list transaksi.
- `UCW-211` dan `UCW-212` menangani dua route sibling yang lambat karena pola fetch dan hydrate-nya berbeda dari `Jurnal`.
- [x] UCW-254 - Konsolidasikan detail agregat payroll worker di tab `Summary / Rekap / History Payment`
  - Ringkas grup payroll berdasarkan `worker_id` dengan nama worker tampil di `Summary`.
  - `Summary` menampilkan nama worker, jumlah tagihan, sisa tagihan, dan jumlah rekap.
  - `Rekap` menampilkan daftar rekap saja dengan expand detail record.
  - `History Payment` muncul hanya jika ada history aktif; aksi icon-only mengikuti role.
  - Soft-delete child record tetap ditandai icon warna khusus di list aktif dan detail tab; permanent delete hilang total.
  - Scope target: `src/pages/BillsPage.jsx`, `src/pages/PaymentsPage.jsx`, `src/lib/transaction-presentation.js`, `src/components/ui/AppPrimitives.jsx`.
  - Dependensi: `UCW-245`, `UCW-252`, `UCW-253`.
- [x] UCW-255 - Selaraskan jalur pembukaan payment dari Tagihan dengan Jurnal
  - Tagihan harus membuka payment workspace via route canonical yang sama seperti Jurnal, bukan jalur legacy/tagihan terpisah.
  - Payload state yang dikirim ke payment page harus mengikuti pola Jurnal supaya hydration dan back-nav konsisten.
  - Scope target: `src/pages/BillsPage.jsx`, `src/lib/transaction-presentation.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-253`.
- [x] UCW-256 - Ringkas search dan tab filter di tiga workspace utama
  - Ubah search menjadi ikon di `Jurnal`, `Tagihan`, dan `Riwayat` supaya header mobile lebih hemat ruang.
  - Pertahankan fungsi filter, tetapi ringkas entrypoint tab/filter agar tidak memakan fold atas.
  - Fokus awal hanya pada tiga workspace utama untuk menjaga scope kecil dan risiko regresi rendah.
  - Scope target: `src/pages/TransactionsPage.jsx`, `src/pages/BillsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/components/ui/AppPrimitives.jsx`.
  - Dependensi: `UCW-255`.
- [x] UCW-257 - Pindahkan filter workspace ke bottom sheet
  - Pindahkan entrypoint filter di `Jurnal`, `Tagihan`, dan `Riwayat` ke bottom sheet yang dibuka lewat tombol filter di header.
  - Search tetap ringkas dan filter tidak lagi memakan fold atas.
  - Scope target: `src/pages/TransactionsPage.jsx`, `src/pages/BillsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/components/ui/AppPrimitives.jsx`.
  - Dependensi: `UCW-256`.
- [x] UCW-258 - Gabungkan Riwayat ke page Jurnal sebagai tab
  - Ubah `Riwayat` dari page terpisah menjadi tab di page `Jurnal`.
  - Jurnal memiliki dua tab: `Aktif` dan `Riwayat`; entrypoint icon riwayat di header dihapus.
  - Scope target: `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/App.jsx`, `src/components/ui/AppPrimitives.jsx`.
  - Dependensi: `UCW-257`.
- [x] UCW-259 - Ubah entrypoint Sampah menjadi Arsip
  - Ganti penamaan user-facing `Sampah` menjadi `Arsip` dan pindahkan entrypoint ke list di bawah tab yang selalu tampil teratas di area recovery.
  - Surface recovery tetap terpisah dari workspace aktif, tapi label dan entrypoint harus lebih netral dan mudah dipahami.
  - Scope target: `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, `src/App.jsx`, `src/components/ui/AppPrimitives.jsx`.
  - Dependensi: `UCW-257`.
- [x] UCW-260 - Selaraskan tiga workspace mobile Jurnal, Riwayat, dan Arsip
  - Koreksi pemetaan workspace mobile menjadi `Jurnal`, `Riwayat`, dan `Arsip` sebagai trio utama, bukan memasukkan `Tagihan` ke alur entrypoint ini.
  - Bottom sheet filter harus berbentuk list vertikal yang mudah dipilih di mobile, bukan tombol horizontal yang butuh banyak tap effort.
  - `Arsip` harus punya search dan filter di header yang konsisten dengan workspace lain, dan tab `Riwayat` di Jurnal tidak boleh memunculkan header tambahan kedua.
  - Scope target: `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, `src/components/ui/AppPrimitives.jsx`, `src/App.jsx`.
  - Dependensi: `UCW-256`, `UCW-257`, `UCW-258`, `UCW-259`.
- [x] UCW-261 - Koreksi shell mobile Jurnal, Riwayat, dan Arsip
  - Pemetaan mobile final untuk task ini hanya `Jurnal`, `Riwayat`, dan `Arsip`; `Tagihan` berada di luar scope.
  - Di `Jurnal`, tab `Riwayat` harus tetap tampil sebagai tab biasa di shell yang sama, tanpa header kedua atau layout baru di bawah tab.
  - Bottom sheet filter harus berisi opsi vertikal/list-based agar cepat dipilih di mobile, bukan deretan tombol horizontal.
  - Di `Arsip`, search dan filter harus muncul di header sehingga entrypoint recovery konsisten dengan workspace lain.
  - Scope target: `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, `src/components/ui/AppPrimitives.jsx`, `src/App.jsx`.
  - Dependensi: `UCW-260`.
- [x] UCW-262 - Selaraskan shell Jurnal dengan tab Tagihan
  - `Jurnal` menjadi shell utama dengan tab `Aktif`, `Tagihan`, dan `Riwayat` dalam satu halaman; route legacy tetap dipertahankan hanya sebagai fallback.
  - Tab `Tagihan` dirender embedded di shell `Jurnal` tanpa header halaman terpisah, sehingga user tidak merasa pindah workspace yang berbeda.
  - Header shell tetap hemat ruang; `Tagihan` memakai action target sendiri bila perlu, tanpa mengubah data model atau logika pembayaran.
  - Scope target: `src/pages/TransactionsPage.jsx`, `src/pages/BillsPage.jsx`, `src/App.jsx`, `src/components/ui/AppPrimitives.jsx`.
  - Dependensi: `UCW-261`.
- [x] UCW-263 - Ratakan shell embedded Tagihan di Jurnal
  - Saat `Tagihan` dirender embedded di shell `Jurnal`, komponen harus memakai shell ringan tanpa header/section layer tambahan yang membuatnya terasa seperti page kedua.
  - Tujuannya menjaga transisi tab tetap terasa satu workspace yang sama, terutama di mobile, tanpa mengubah route legacy atau logika pembayaran.
  - Scope target: `src/pages/BillsPage.jsx`, `src/pages/TransactionsPage.jsx`.
  - Dependensi: `UCW-262`.
- [x] UCW-264 - Petakan search/filter per tab Jurnal
  - Header shell `Jurnal` perlu menjadi mapping tunggal untuk entrypoint search/filter per tab, supaya `Aktif`, `Tagihan`, dan `Riwayat` tetap konsisten secara visual.
  - Pemetaan ini hanya menata entrypoint dan target aksi, bukan mengubah query/data model atau menambah route baru.
  - Scope target: `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/BillsPage.jsx`.
  - Dependensi: `UCW-262`, `UCW-263`.
- [x] UCW-265 - Konsolidasikan surface Arsip ke shell Jurnal
  - Surface `Arsip` perlu navigasi balik yang deterministik ke shell `Jurnal`, bukan bergantung pada history browser.
  - Konsolidasi ini menjaga `Arsip` tetap terasa sebagai recovery surface yang jelas di trio mobile `Jurnal / Riwayat / Arsip`.
  - Scope target: `src/pages/TransactionsRecycleBinPage.jsx`.
  - Dependensi: `UCW-264`.
- [x] UCW-266 - Alihkan route Tagihan ke shell Jurnal
  - Route `/tagihan` harus mengarah ke tab `Tagihan` di shell `Jurnal`, bukan lagi menjadi entrypoint page terpisah.
  - Route payment `Tagihan` tetap dipertahankan untuk deep link settlement, tetapi surface list aktifnya harus terpusat di shell `Jurnal`.
  - Scope target: `src/App.jsx`.
  - Dependensi: `UCW-262`, `UCW-263`, `UCW-264`, `UCW-265`.
- [x] UCW-267 - Satukan jalur settlement Tagihan ke route payment canonical
  - Semua entrypoint settlement Tagihan harus memakai route canonical `/payment/:id` agar tidak ada percabangan antara `/tagihan/:id` dan `/pembayaran/tagihan/:id`.
  - Route legacy settlement boleh tetap hidup sebagai fallback redirect, tetapi callsite aktif harus diarahkan ke helper/route canonical yang sama.
  - Scope target: `src/App.jsx`, `src/components/PayrollManager.jsx`, `src/components/ProjectReport.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/BillsPage.jsx`, `src/lib/transaction-presentation.js`.
  - Dependensi: `UCW-255`, `UCW-266`.
- [x] UCW-268 - Pindahkan aggregate worker ke detail page bertab
  - Row worker di Tagihan harus menjadi entrypoint detail, bukan accordion inline yang menumpuk konten di bawah row.
  - Detail worker dipusatkan ke page bertab `Summary / Rekap / History Payment`, dan tab `Rekap` menampilkan row per bill yang bisa dibuka detailnya tanpa memilih rekap dari list utama.
  - Scope target: `src/pages/BillsPage.jsx`, `src/pages/PaymentsPage.jsx`.
  - Dependensi: `UCW-245`, `UCW-267`.
- [x] UCW-269 - Pangkas Edit dan Payment jadi action surface murni
  - `EditRecordPage` dan `PaymentPage` harus menghapus ringkasan, histori, lampiran, dan teknis dari surface utama agar hanya workspace inti yang tersisa.
  - Semua konteks inspeksi harus dipusatkan di `TransactionDetailPage`, sedangkan `Edit` fokus ke form edit dan `Payment` fokus ke form bayar.
  - Scope target: `src/pages/EditRecordPage.jsx`, `src/pages/PaymentPage.jsx`.
  - Dependensi: `UCW-251`, `UCW-252`, `UCW-267`, `UCW-268`.
- [x] UCW-270 - Kunci kontrak target bayar worker aggregate
  - `Bayar` untuk salary bill harus memilih satu bill aggregate outstanding per worker dengan rule deterministik `partial -> unpaid -> due_date -> created_at -> id`.
  - Summary KPI worker dipusatkan di helper data bersama supaya nominal total, billed, unbilled, sisa, dan terbayar punya source of truth yang sama di surface detail.
  - Scope target: `src/lib/transaction-presentation.js`, `src/pages/PaymentsPage.jsx`, `src/pages/PaymentPage.jsx`.
  - Dependensi: `UCW-268`, `UCW-269`.
- [x] UCW-271 - Tambahkan CTA Bayar pada sheet worker absensi
  - `Tab Pekerja` di `Catatan Absensi` harus punya CTA `Bayar` sejajar dengan `Detail` dan `Rekap` di sheet worker.
  - CTA ini membuka payment form untuk bill aggregate worker yang dipilih oleh helper kontrak data, lalu kembali ke tab pekerja setelah selesai.
  - Scope target: `src/components/PayrollAttendanceHistory.jsx`, `src/pages/PayrollPage.jsx`, `src/pages/PaymentPage.jsx`.
  - Dependensi: `UCW-270`.
- [x] UCW-273 - Restyle GlobalToast jadi solid surface dan pindah ke atas
  - `GlobalToast` harus memakai surface solid yang netral: putih solid saat mode terang dan padanan solid gelap saat mode gelap, tanpa card berwarna/translucent.
  - Toast harus diposisikan di atas agar tidak bertabrakan dengan tombol navigasi bawah di mobile.
  - Scope target: `src/components/ui/GlobalToast.jsx`, `src/index.css`.
  - Dependensi: `UCW-184`, `UCW-185`.
- [x] UCW-274 - Netalkan ikon tone pada GlobalToast
  - Ikon pada `GlobalToast` harus tetap informatif, tetapi tampil netral dan tidak terlalu berwarna agar card toast terasa lebih solid dan minim distraksi.
  - Perbedaan tone cukup terlihat dari ikon dan konteks pesan; warna ikon tidak perlu mencolok per status.
  - Scope target: `src/components/ui/GlobalToast.jsx`.
  - Dependensi: `UCW-273`.
- [x] UCW-275 - Pisahkan rumah PDF settings dan laporan profesional Unit Kerja
  - PDF settings sekarang di-merge ke `ProjectsPage` sebagai section `PDF & Laporan`; `/projects/pdf-settings` tetap hidup sebagai alias kompatibilitas.
  - `/projects` menjadi report hub `Unit Kerja` yang report-kind first untuk `Executive Finance`, `Project P&L`, dan `Cash Flow`, dengan data laporan bisnis yang diolah dari source data repo yang sudah ada.
  - Scope target: `src/components/ProjectReport.jsx`, `src/pages/ProjectsPage.jsx`, `src/pages/ProjectPdfSettingsPage.jsx`, `src/lib/business-report.js`, `src/lib/report-pdf.js`, `src/lib/reports-api.js`, `src/store/useReportStore.js`, `api/records.js`, `src/App.jsx`, `src/components/ui/AppPrimitives.jsx`.
- [x] UCW-276 - Backfill snapshot payroll legacy dan read fallback worker aggregate
  - Payroll bill legacy yang masih kosong snapshot harus dibackfill dari `workers.name` dengan fallback deskripsi bila join worker gagal.
  - Read fallback detail payroll harus tetap aman walau ada row legacy yang belum sempat dibackfill, tanpa mengubah amount/status/relasi.
  - Scope target: `supabase/migrations/20260422143000_backfill_payroll_snapshot_consistency.sql`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-271`, `UCW-275`.
- [x] UCW-272 - Bersihkan salary bill entrypoint dari Jurnal, Riwayat, dan Arsip
  - Surface `Jurnal`, `Riwayat`, dan `Arsip` harus berhenti menampilkan filter atau CTA salary bill sebagai entrypoint utama.
  - Tujuannya menegaskan `Catatan Absensi` sebagai primary entrypoint salary bill agar navigasi finansial tidak bercampur dengan surface transaksi umum.
  - Scope target: `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`.
  - Dependensi: `UCW-271`.
- [x] UCW-277 - Redesign PDF laporan bisnis dengan konteks visual per kind
  - PDF laporan bisnis harus memakai label sumber yang business-facing, bukan nama schema/database mentah; fallback tetap human-readable bila label spesifik belum ada.
  - `Project P&L` perlu dipecah menjadi section kartu/band yang jelas agar tidak ada tabel campuran dengan kolom kosong dan agar konteks pemasukan, biaya material, biaya operasional, dan gaji terbaca terpisah.
  - `Executive Finance` dan `Cash Flow` tetap satu branding profesional, tetapi masing-masing perlu aksen visual yang berbeda dan report summary berbasis card agar PDF terasa lebih hidup dan konteksnya cepat terbaca.
  - Scope target: `src/lib/report-pdf.js`, `src/lib/business-report.js`, `src/components/ProjectReport.jsx`, `api/records.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-275`, `UCW-276`.
- [x] UCW-279 - Ringkas report hub PDF dan rapikan header visual
  - Tab report kind di report hub dipendekkan menjadi `Umum`, `Proyek`, dan `Kas`, lalu tombol `Pengaturan PDF` dipindah ke header agar fold atas lebih lega.
  - Tombol `Filter` sejajar dengan `Sinkronkan` dan `Unduh PDF`, sementara badge periode dan Unit Kerja diganti menjadi info bar label/value yang lebih proper.
  - `header_color` dari settings dipakai sebagai accent utama lintas elemen report yang berwarna, sementara `Project P&L` harus memakai lebar kolom yang lebih fit per section agar tidak ada ruang kosong yang memicu wrap berlebihan.
  - Upload/hapus logo di settings dipadatkan menjadi tile klik-upload dengan overlay delete saat logo sudah ada.
  - Scope target: `src/components/ProjectReport.jsx`, `src/pages/ProjectPdfSettingsPage.jsx`, `src/lib/business-report.js`, `src/lib/report-pdf.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-275`, `UCW-277`.
- [x] UCW-280 - Padatkan header report hub dan iconize sinkronisasi
  - Header `Unit Kerja` masih terasa dobel di mobile, jadi top shell harus diringkas tanpa menambah layer visual baru.
  - Tombol `Sinkronkan` harus menjadi icon-only agar tiga aksi utama `Filter`, `Sinkronkan`, dan `Unduh PDF` bisa tetap satu baris di viewport mobile.
  - `Pengaturan PDF` tetap tersedia dari header, tetapi struktur atas report hub harus terasa satu blok identitas + aksi, bukan dua header berturut-turut.
  - Scope target: `src/components/ProjectReport.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-279`.
- [x] UCW-281 - Satukan header ProjectsPage dan report hub
  - Header `Pelaporan / Unit Kerja` di `ProjectsPage` menjadi satu-satunya header identitas report hub, sementara header duplikat di `ProjectReport` dihapus agar struktur visual sama dengan shell `Jurnal`.
  - Tombol `Pengaturan PDF` dipindah ke header luar `ProjectsPage` supaya berada satu grup dengan identitas halaman, bukan di dalam report card.
  - Scope target: `src/pages/ProjectsPage.jsx`, `src/components/ProjectReport.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-280`.
- [x] UCW-283 - Padatkan aksi report hub dan info strip
  - Tombol `Refresh`/`Sinkronkan` dipindah ke satu grup dengan info `Rentang tanggal` di kanan agar bar metadata tetap ringkas dan aksi tidak bertumpuk di bawahnya.
  - Tombol `Filter` diberi label dan ditempatkan satu baris dengan `Unduh PDF` dalam grid 1:1 agar action row lebih stabil di mobile.
  - Scope target: `src/components/ProjectReport.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-281`.
- [x] UCW-282 - Redesign info payroll detail dan ringkas tab Riwayat
  - `Info` di detail worker payroll harus memprioritaskan `Tercatat` sebagai KPI kuat, lalu kartu nominal `Billed`/`Unbilled`, lalu baris `Tagihan`/`Sisa` dengan label satu kata agar aman di mobile.
  - Sisa metadata detail payroll tetap dipertahankan, tetapi harus diringkas ke grid 1:1 dan label `History Payment` diganti menjadi `Riwayat` pada detail page yang relevan.
  - Scope target: `src/pages/PayrollWorkerDetailPage.jsx`, `src/pages/PaymentsPage.jsx`, `tests/e2e/payroll.spec.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-278`.
- [x] UCW-278 - Buka detail worker payroll sebagai page bertab
  - Klik `Detail` di tab pekerja payroll harus membuka route detail baru, bukan bottom sheet, dengan tab `Info`, `Rekap`, dan `History Payment` bila history memang ada.
  - `Info` menampilkan KPI ringkas worker, `Rekap` menampilkan baris absensi read-only dengan status project dan wage role, lalu `History Payment` meniru pola detail bill untuk payment aktif dan terhapus.
  - Scope target: `src/App.jsx`, `src/components/PayrollAttendanceHistory.jsx`, `src/pages/PayrollWorkerDetailPage.jsx`, `tests/e2e/payroll.spec.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-271`, `UCW-276`.
- [x] UCW-284 - Solidkan seluruh surface dan row list app
  - Semua surface utama harus berhenti terasa glass morphic: background page, card, sheet, nav, dan row list perlu solid agar teks tetap terbaca jelas di dark mode.
  - Row list dan action row yang masih memakai transparansi atau blur harus dinormalisasi ke surface solid tanpa mengubah kontrak data atau alur navigasi.
  - Scope target: `src/index.css`, `src/components/ui/AppPrimitives.jsx`, `src/components/ui/ActionCard.jsx`, `src/components/ui/BottomNav.jsx`, `src/components/AttendanceForm.jsx`, `src/components/MasterMaterialForm.jsx`, `src/components/HrdPipeline.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-282`, `UCW-283`.
- [x] UCW-285 - Redesign loader jadi motion-only centered
  - Loader bootstrap, lazy route, dan dashboard initial load harus hanya menampilkan animasi di tengah layar, tanpa card, border, shadow, atau wrapper visual lain.
  - Teks harus ringkas: satu judul tebal dan satu subtitle singkat yang menyesuaikan konteks loading, sementara dashboard refresh kecil tetap tidak diubah.
  - Scope target: `src/App.jsx`, `src/components/ui/BrandLoader.jsx`, `src/pages/Dashboard.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
- [x] UCW-286 - Pecah loader per konteks
  - Loader global, form/page, dan server/connect harus memakai animasi berbeda sesuai konteks, sementara placement tetap motion-only dan centered.
  - Dashboard initial load harus benar-benar center di viewport, sedangkan bootstrap dan lazy route tetap memakai loader global.
  - Scope target: `src/App.jsx`, `src/components/ui/BrandLoader.jsx`, `src/pages/Dashboard.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/PaymentPage.jsx`, `src/pages/ProjectPdfSettingsPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-285`.
- [x] UCW-287 - Normalkan loader detail yang tersisa
  - Surface detail yang masih memakai card placeholder untuk loading satu record harus dipindahkan ke loader centered agar konsisten dengan policy loader baru.
  - Target utama adalah detail transaksi terhapus, detail pekerja payroll, dan worker detail mode di pembayaran tagihan; list surface dan skeleton list tetap tidak diubah.
  - Scope target: `src/pages/DeletedTransactionDetailPage.jsx`, `src/pages/PayrollWorkerDetailPage.jsx`, `src/pages/PaymentsPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-286`.
- [x] UCW-288 - Shared form shell + centered modal toast
  - Toast global harus menjadi popup modal tengah yang solid dengan animasi/icon di atas, lalu title, subtitle/message, dan tombol `Tutup` full-width di bawah; success/info auto-dismiss sementara warning/error/loading menunggu tutup manual.
  - Form lintas domain harus memakai return route eksplisit dan registry shell, tanpa `navigate(-1)` fallback atau data substitusi saat record/param gagal resolve di UI.
  - Scope target: `src/components/ui/GlobalToast.jsx`, `src/store/useToastStore.js`, `src/lib/form-shell.js`, `src/pages/AttendancePage.jsx`, `src/pages/MaterialInvoicePage.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/PaymentPage.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/components/MasterDataManager.jsx`, `src/components/PayrollAttendanceHistory.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-287`.
- [x] UCW-289 - Placeholder frozen untuk HRD dan penerima
  - Route `/more/hrd` dan `/more/beneficiaries` harus menampilkan placeholder frozen-state, bukan surface operasional aktif.
  - Placeholder mengikuti pola loader global: animasi server di tengah, title `Fitur sedang dikembangkan`, subtitle konteks spesifik, dan tombol `Kembali` di bawah subtitle.
  - Scope target: `src/pages/HrdPage.jsx`, `src/pages/BeneficiariesPage.jsx`, `src/components/ui/FrozenRoutePlaceholder.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-59`, `UCW-60`, `UCW-286`.
- [x] UCW-290 - Tandai entry frozen di MorePage
  - Kartu `HRD & Rekrutmen` dan `Penerima Manfaat` di `MorePage` harus menampilkan status frozen yang ringkas dan jelas agar user tahu fitur masih dikembangkan sebelum masuk route placeholder.
  - Label status harus singkat, tidak menambah panel penjelasan, dan tetap menjaga kartu lain di `MorePage` tampil normal.
  - Scope target: `src/pages/MorePage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-289`.
- [x] UCW-291 - Standarkan loading, empty, dan error surface operasional
  - Surface operasional `HRD`, `Penerima Manfaat`, `PayrollManager`, dan `Stok Barang` harus memakai bahasa visual yang seragam untuk loading, empty, dan error state tanpa mengubah flow data atau struktur halaman.
  - Targetnya adalah menormalisasi state yang masih terasa campur antara card placeholder, teks loading, dan error block supaya fallback user jelas dan konsisten.
  - Scope target: `src/components/HrdPipeline.jsx`, `src/components/BeneficiaryList.jsx`, `src/components/PayrollManager.jsx`, `src/pages/StockPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-284`, `UCW-290`.
- [x] UCW-292 - Standarkan feedback modal sheet HRD dan Penerima
  - Modal sheet create/edit di `HRD` dan `Penerima Manfaat` harus memakai pola feedback yang seragam untuk error validasi, error simpan, dan state kosong form tanpa menambah copy baru yang panjang.
  - Targetnya adalah merapikan feedback di dalam sheet agar user tidak melihat campuran block error yang berbeda-beda di dua modal editor ini.
  - Scope target: `src/components/HrdPipeline.jsx`, `src/components/BeneficiaryList.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-291`.
- [x] UCW-293 - Solidkan sisa surface form dan invite
  - Residual translucent surface pada `IncomeForm`, `MaterialInvoiceForm`, `LoanForm`, `TeamInviteManager`, dan `PayrollManager` perlu disolidkan agar pattern solid surface konsisten dengan cleanup sebelumnya.
  - Hapus juga dekorasi shell CSS yang sudah dead seperti glow pseudo-element dan toast surface legacy agar tidak ada residu glass morphic yang tersisa di source.
  - Scope target: `src/components/IncomeForm.jsx`, `src/components/MaterialInvoiceForm.jsx`, `src/components/LoanForm.jsx`, `src/components/TeamInviteManager.jsx`, `src/components/PayrollManager.jsx`, `src/index.css`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-284`, `UCW-292`.
- [x] UCW-294 - Solidkan residu dashboard dan form umum
  - Residual translucent surface yang masih tersisa di `Dashboard`, `ExpenseForm`, `ExpenseAttachmentSection`, `MasterMaterialForm`, dan `MasterPickerField` perlu disolidkan agar cleanup glass morphic benar-benar menutup surface yang paling sering dipakai.
  - Fokus task ini hanya ke surface dan tombol/background yang masih translucent, bukan refactor layout atau behavior picker/form.
  - Scope target: `src/pages/Dashboard.jsx`, `src/components/ExpenseForm.jsx`, `src/components/ExpenseAttachmentSection.jsx`, `src/components/MasterMaterialForm.jsx`, `src/components/ui/MasterPickerField.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-293`.
- [x] UCW-295 - Hapus selector opacity legacy CSS
  - Selector kompatibilitas opacity di `src/index.css` yang sudah tidak punya pemakai aktif perlu dihapus agar tidak ada residu glass morphic dead-code tersisa di stylesheet.
  - Scope task ini hanya ke cleanup selector CSS yang kosong, bukan mengubah surface atau layout runtime baru; `ProtectedRoute` ikut disolidkan agar tidak menyisakan surface opacity yang tertinggal setelah selector compat dihapus.
  - Scope target: `src/index.css`, `src/components/ProtectedRoute.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-294`.
- [x] UCW-296 - Telegram finance assistant v1 read-only
  - Telegram assistant harus membaca finance core secara read-only, menerima intent `status/search/navigate`, menolak mutasi dan scope payroll di luar v1, lalu membalas ringkas dengan deep link ke route resmi Mini Web App.
  - Scope target: `api/telegram-assistant.js`, `src/lib/telegram-assistant-links.js`, `src/App.jsx`, `tests/e2e/telegram-shell.spec.js`, `supabase/migrations/20260423101000_create_telegram_assistant_sessions.sql`, `.env.example`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-90`, `UCW-182`, `UCW-238`.
- [x] UCW-297 - Deploy webhook Telegram assistant ke runtime Vercel
  - Deployment runtime assistant harus benar-benar hidup di Vercel untuk `production` dan `preview`, lalu webhook Telegram aktif diarahkan ke alias production yang stabil dan bisa diaudit.
  - Audit deploy harus mencatat batasan nyata environment: satu bot hanya bisa punya satu webhook aktif, preview masih berada di belakang Vercel Deployment Protection, dan custom domain `banplex.app` / `staging.banplex.app` belum valid di DNS sehingga alias live masih memakai `*.vercel.app`.
  - Scope target: `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-296`.
- [x] UCW-298 - Persist env Vercel production dan audit blocker preview
  - Runtime assistant production tidak boleh lagi bergantung pada inline env saat deploy; seluruh key dari `.env` yang relevan harus tersimpan di Vercel `production`, lalu deployment production terbaru harus lolos tanpa `-e/-b` inline env.
  - Untuk `preview/staging`, audit harus mencatat hasil nyata bila env persisten belum bisa dipasang: project belum punya connected Git repository di Vercel sehingga branch-scoped preview env gagal, maka staging sementara tetap dideploy memakai inline env sampai integrasi Git dibereskan.
  - Scope target: `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-297`.
- [x] UCW-300 - Redesign form non-absensi lintas domain agar mobile-first dan minimalis
  - Form input selain absensi harus memakai hierarki section yang lebih ringkas, footer aksi sticky/shared, summary yang compact, dan surface solid agar tetap ramah untuk operator mobile tanpa mengubah logika data atau route canonical.
  - Scope target: `src/components/ExpenseForm.jsx`, `src/components/MaterialInvoiceForm.jsx`, `src/pages/PaymentPage.jsx`, `src/pages/MasterFormPage.jsx`, `src/components/master/GenericMasterForm.jsx`, `src/pages/ProjectPdfSettingsPage.jsx`, `src/components/MasterMaterialForm.jsx`, `src/components/PaymentModal.jsx`, `src/components/HrdPipeline.jsx`, `src/components/BeneficiaryList.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-288`, `UCW-293`, `UCW-294`.
- [x] UCW-301 - Siapkan bundle env lokal untuk migrasi Vercel Hobby
  - Migrasi ke akun Vercel Hobby baru butuh bundle env lokal yang sudah berisi tepat 14 key runtime aktif agar bisa langsung dipindahkan, di-rename, lalu di-import ke project target tanpa copy-paste manual satu per satu.
  - Bundle harus dibuat sebagai file local yang ter-ignore Git, memakai nilai dari `.env` aktif saat ini, dan tetap dibatasi hanya ke key runtime yang memang sudah diaudit pada `UCW-298` dan `UCW-299`.
  - Scope target: `.env.vercel-import-akhir-diedit.local`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-299`.
- [x] UCW-302 - Audit env Vercel project baru, redeploy, dan smoke test assistant
  - Project Vercel baru harus punya 14 env runtime aktif di scope `production` dan `preview`, lalu deployment baru wajib dibangun ulang setelah env berubah supaya endpoint assistant membaca nilai terbaru tanpa inline env.
  - Smoke test `/api/telegram-assistant` harus mengembalikan `{"ok":true,"processed":false}`; jika webhook dipindah ke project baru, `getWebhookInfo` harus mengonfirmasi URL aktif yang benar sebelum cutover dinyatakan siap.
  - Scope target: `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-301`, `UCW-299`.
  - Addendum audit: `telegram_assistant_sessions` sempat belum ada di remote Supabase dan membuat reply flow gagal saat `clearAssistantSession`; migrasi `20260423101000_create_telegram_assistant_sessions.sql` sudah diaplikasikan, lalu timeout classifier xAI dinaikkan dari 8s ke 15s agar intent `status`/`navigate` lolos tanpa fallback timeout.
- [x] UCW-303 - Audit regresi notifikasi `/api/notify` pada create payment
  - Notifikasi create bill/loan payment dan rekap salary bill harus kembali sukses di runtime Vercel tanpa mengubah payload client, karena route `/api/notify` sempat gagal `FUNCTION_INVOCATION_FAILED` akibat import ESM serverless yang tidak valid.
  - Scope target: `src/lib/business-report.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-302`.
- [x] UCW-304 - Prioritaskan intent deterministik untuk prompt Telegram eksplisit
  - Prompt bot yang eksplisit seperti `status`, `search`, `navigate`, dan `refuse` harus diputuskan dari heuristic deterministik dulu supaya AI classifier tidak terus jatuh ke clarify generik pada prompt sederhana, sementara AI tetap dipakai untuk kasus ambigu.
  - Scope target: `api/telegram-assistant.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-303`.
- [x] UCW-305 - Batasi respons Telegram ke mention/reply atau intent eksplisit
  - Bot Telegram harus diam pada chat bebas yang tidak jelas, lalu hanya merespons private chat yang punya intent read-only eksplisit atau sesi lanjutan aktif, serta merespons group/supergroup hanya ketika bot di-mention atau dijadikan reply target.
  - Scope target: `api/telegram-assistant.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-304`.
- [x] UCW-299 - Persist env Vercel preview via project API dan audit mismatch Git namespace
  - Runtime assistant `preview/staging` harus bisa dideploy ulang tanpa inline env; shared env level project untuk target `preview` perlu dipersist penuh untuk semua key runtime yang relevan, lalu deployment preview terbaru harus lolos tanpa `-e/-b`.
  - Audit harus membedakan jelas antara blocker yang masih tersisa dan workaround yang sudah valid: `vercel git connect` tetap gagal karena namespace GitHub yang terlihat oleh Vercel team tidak punya akses ke repo `dragontrail133-cpu/Banplex-Telegram`, tetapi shared preview env tetap bisa dipasang lewat Project Env API Vercel.
  - Scope target: `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-298`.
- [x] UCW-306 - Gemini-first clarifier dengan template final dan konteks Sunda
  - Assistant Telegram harus tetap template-driven di output final, tetapi konteks per chat diperluas, intent ambigu diprioritaskan ke Gemini dulu, dan input campuran Indonesia/Sunda harus dipahami tanpa mengubah scope read-only.
  - Klarifikasi tetap dikirim lewat template fixed, bukan teks bebas dari model, sehingga model hanya memilih intent, language, dan slot konteks yang dibutuhkan.
  - Scope target: `api/telegram-assistant.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-304`, `UCW-305`.
  - Addendum audit: context memory ringkas per chat sudah disimpan lewat `telegram_assistant_sessions`, Gemini diprioritaskan untuk prompt ambigu, dan reply final tetap dirender dari template fixed untuk `status`, `search`, `navigate`, `refuse`, serta `clarify`.
- [x] UCW-307 - Semantic analytics pack untuk query ambigu dan alias entitas
  - Assistant Telegram harus memahami pertanyaan read-only berbasis agregat seperti total tagihan, sisa hutang, jumlah pekerja hadir, pengeluaran per periode, dan ranking entitas terbesar dengan input campuran Indonesia/Sunda.
  - Output final tetap template-driven; planner Gemini/xAI hanya memilih metric, entity, window, dan clarification slot, sementara reply user-facing tetap dirender dari template fixed.
  - Scope target: `api/telegram-assistant.js`, `src/lib/telegram-assistant-links.js`, `tests/e2e/telegram-shell.spec.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-306`.
  - Addendum audit: query analytics sudah dipetakan ke metric `bill_summary`, `cash_outflow`, `attendance_present`, dan `obligation_ranking`; route `/payroll`/tab worker sudah dibuka; classifier analytics-aware dan template reply tetap dijaga; reply helper juga retry tanpa `reply_to_message_id` kalau Telegram menolak target reply yang tidak valid.
- [x] UCW-308 - Orkestrasi AI natural-language untuk assistant Telegram read-only
  - Assistant Telegram harus memadukan deterministic planner/backend read model dengan AI writer agar balasan final ke user terasa natural, tetapi tetap berbasis fakta yang sudah diverifikasi backend.
  - Bot harus paham Indonesia/Sunda campuran, alias entitas ambigu seperti `mang dindin`, compound query read-only, dan follow-up antar-turn; response final boleh natural-language, tetapi verifier backend wajib menolak klaim yang tidak ada di fact packet.
  - Scope target: `api/telegram-assistant.js`, `docs/freeze/01-planning-decision-freeze.md`, `docs/freeze/02-prd-master.md`, `docs/freeze/03-source-of-truth-contract-map.md`, `docs/freeze/05-ai-execution-guardrails.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`, `tests/unit/telegram-assistant-writer.test.js`.
  - Dependensi: `UCW-307`.
  - Delegation slices: fact packet + boundary planner, AI writer/verifier integration, compound answer assembly, dan docs/tests guardrail.
  - Addendum audit: writer AI berjalan setelah planner deterministik, Gemini menjadi writer utama dengan xAI fallback, helper verifier menolak output yang mengarang angka/nama/aksi baru, dan smoke test production + unit test writer sudah lulus.
- [x] UCW-309 - Upgrade assistant Telegram dengan command surface, inline callback, dan hybrid transcript
  - Assistant Telegram harus menambah command `/menu /status /cari /analytics /riwayat /buka`, inline keyboard callback/deep link yang konsisten, dan hybrid transcript pendek di `telegram_assistant_sessions.pending_payload`, tanpa menambah jalur mutasi atau schema baru.
  - Command, inline callback, dan teks bebas harus tetap memakai planner/verifier read-only yang sama; `pending_payload` cukup selama hanya menyimpan summary, last turn, last route, entity hints, dan transcript pendek yang dicap.
  - Scope target: `api/telegram-assistant.js`, `docs/freeze/01-planning-decision-freeze.md`, `docs/freeze/02-prd-master.md`, `docs/freeze/03-source-of-truth-contract-map.md`, `docs/freeze/05-ai-execution-guardrails.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`, `tests/unit/telegram-assistant-writer.test.js`, `tests/unit/telegram-assistant-routing.test.js`.
  - Dependensi: `UCW-308`.
  - Addendum audit: command parser dan callback router sekarang memetakan slash command/inline ke workflow planner yang sama, reply markup bisa mencampur callback quick action dengan deep link resmi, dan `pending_payload` dipadatkan ke bentuk hybrid transcript tanpa migrasi kolom baru.
- [x] UCW-310 - Deploy production assistant upgrade dan smoke command runtime
  - Runtime production `banplex-telegram.vercel.app` harus dinaikkan ke build terbaru supaya slash command `/menu /status /analytics` dan session hybrid benar-benar hidup di alias yang dipakai webhook Telegram.
  - Smoke live cukup membuktikan command read-only dan penyimpanan `pending_payload` hybrid di production; replay callback synthetic boleh gagal di `answerCallbackQuery` jika `callback_query.id` bukan ID Telegram asli, selama router callback sudah tertutup oleh unit test dan tidak membuka jalur mutasi.
  - Scope target: `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-309`.
  - Addendum audit: production deploy baru berhasil, alias tetap `banplex-telegram.vercel.app`, smoke POST `empty/menu/status/analytics/menu` sudah `processed=true` sesuai ekspektasi, dan query Supabase terbaru menunjukkan `pending_payload` mulai menyimpan field `summary` serta transcript hybrid.
- [x] UCW-311 - Hardening callback ack replay untuk smoke end-to-end
  - Runtime assistant harus tetap menuntaskan callback read-only saat webhook sintetis memakai `callback_query.id` palsu; kegagalan `answerCallbackQuery` boleh diabaikan hanya untuk error Telegram `query is too old` atau `query ID is invalid`, tanpa mengubah route planner/verifier atau membuka jalur mutasi baru.
  - Scope target: `api/telegram-assistant.js`, `tests/unit/telegram-assistant-routing.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-310`.
  - Addendum audit: `answerTelegramCallback` sekarang hanya melonggarkan ack untuk query ID invalid/expired, unit test routing bertambah untuk guard ini, smoke live `/analytics -> ta:am:cash_outflow -> ta:aw:month_current -> ta:cmd:riwayat` semuanya `processed:true`, dan row `telegram_assistant_sessions` tetap menyimpan summary/transcript hybrid serta `last_route` terbaru.
- [x] UCW-312 - Bangun AQ gate staging dan harness live smoke release
  - Stream release perlu punya gate AQ tertulis yang membedakan regression mock, live smoke staging, dan production canary, supaya keputusan `siap release` dan `simpan data real` tidak lagi bergantung pada audit ad-hoc.
  - Live smoke minimal harus membuktikan auth nyata via `devAuthBypass` lokal, write `Master` (`funding_creditor`), write core finance (`loan`), dan write admin `Tim` (`invite_token`) terhadap Supabase staging mirror, lalu hasilnya diverifikasi lagi lewat service-role verifier dan artifact file.
  - Scope target: `docs/release-aq-gate.md`, `playwright.live.config.js`, `tests/live/release-smoke.spec.js`, `tests/live/helpers/live-app.js`, `tests/live/helpers/live-artifacts.js`, `scripts/aq/verify-live-smoke.mjs`, `package.json`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-90`, `UCW-182`, `UCW-219`, `UCW-311`.
  - Addendum audit: suite mock existing tetap dipakai untuk regression cepat, lane `tests/live/*` dipisah agar tidak ikut `npm run test:e2e`, artifact `test-results/live-smoke-created-records.json` menjadi source of truth smoke write staging, dan verifier service-role membaca artifact itu untuk memutuskan pass/fail persistence DB.
- [x] UCW-313 - Modularisasi helper Telegram assistant menjadi routing/session/transport modules
  - API assistant harus memindahkan helper pure ke modul terpisah agar routing command, session memory hybrid, dan transport Telegram tidak lagi bercampur di satu file besar, tetapi kontrak read-only dan hasil production tetap sama.
  - Scope target: `api/telegram-assistant.js`, `src/lib/telegram-assistant-session.js`, `src/lib/telegram-assistant-routing.js`, `src/lib/telegram-assistant-transport.js`, `tests/unit/telegram-assistant-routing.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-312`.
  - Addendum audit: helper session, routing, dan transport sekarang dipisah ke modul terpisah; routing test langsung memverifikasi modul baru; production deploy terbaru tetap lolos smoke live `/menu`, `/analytics`, callback metric/window/history, dan row `telegram_assistant_sessions` tetap menyimpan summary/transcript hybrid plus `last_route`.
- [x] UCW-314 - Runbook verifikasi tombol `buka` Telegram dan deep-link canonical
  - Checklist troubleshooting harus membedakan pesan lama, deploy production terbaru, dan konfigurasi BotFather/Telegram Mini App, lalu mengunci format deep-link `https://t.me/<bot>?startapp=...` sebagai target resmi tombol `buka`.
  - Scope target: `docs/telegram-assistant-buka-debug-checklist.md`, `tests/unit/telegram-assistant-routing.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-313`.
  - Addendum audit: username bot lokal dan production sama-sama konsisten (`banplex_greenfield_bot`), webhook production sudah aktif ke `https://banplex-telegram.vercel.app/api/telegram-assistant`, production redeploy terbaru sudah aktif di alias `https://banplex-telegram.vercel.app`, dan unit test deep-link menjaga format URL `buka` tetap canonical tanpa short_name `/app`.
- [x] UCW-315 - Petakan readiness staging dan coverage matrix AQ per domain
  - Gate release perlu matrix operasional yang menegaskan precondition staging, bukti automation yang sudah ada, verifier DB, manual AQ wajib, dan domain blocker yang belum terbukti, supaya eksekusi smoke berikutnya tidak lagi ad-hoc.
  - Scope target: `docs/release-aq-gate.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-312`.
  - Addendum audit: `docs/release-aq-gate.md` sekarang memuat staging readiness matrix, coverage matrix per domain, dan urutan prioritas smoke backlog mulai dari `expense/bill/payment` sampai `delete lifecycle`.
- [x] UCW-316 - Tambah smoke live `expense -> bill -> partial payment -> recalc`
  - Lane AQ staging perlu membuktikan bahwa pengeluaran unpaid benar-benar membuat bill, lalu partial payment dari `/payment/:id` mengubah `bill.paid_amount`, `remaining`, dan `status` secara sinkron tanpa mock.
  - Scope target: `tests/live/release-smoke.spec.js`, `scripts/aq/verify-live-smoke.mjs`, `docs/release-aq-gate.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-315`.
  - Addendum audit: live smoke sekarang membuat `expense` unpaid, melakukan `bill_payment` partial, merekam artifact `expense/bill_payment/bill_after_payment`, dan verifier service-role memeriksa row `expenses`, `bills`, `bill_payments`, serta status `partial` hasil recalc.
- [x] UCW-317 - Hardening lane live smoke lokal pakai `vercel dev` dan auto-load verifier env
  - Lane AQ live harus menjalankan runtime penuh yang melayani `/api/auth`, `/api/transactions`, dan `/api/records`, bukan hanya shell Vite; verifier DB juga harus bisa membaca `.env` lokal tanpa export manual.
  - Scope target: `playwright.live.config.js`, `scripts/aq/verify-live-smoke.mjs`, `docs/release-aq-gate.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-312`.
  - Addendum audit: local runner sekarang default ke `vercel dev`, command lokal bisa dioverride via env bila perlu, dan verifier live smoke otomatis membaca `.env` lalu `.env.local` saat env shell kosong.
- [x] UCW-318 - Tambah smoke live `income -> fee bill` dan `material invoice -> bill/stock`, lalu catat blocker lane sisa
  - Lane AQ staging perlu membuktikan bahwa create `project-income` benar-benar membentuk `fee bill`, dan create `material invoice` unpaid benar-benar membentuk `bill`, `expense_line_items`, serta `stock_transactions`, lalu blocker domain sisa harus dibekukan di gate docs.
  - Scope target: `tests/live/release-smoke.spec.js`, `scripts/aq/verify-live-smoke.mjs`, `docs/release-aq-gate.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-317`.
  - Addendum audit: live smoke sekarang merekam artifact `project_income`, `project_income_fee_bill`, `material_invoice`, `material_invoice_bill`, `material_invoice_line_item`, dan `material_stock_transaction`; gate docs juga kini memuat blocker aktif untuk target staging-safe, payroll seed, attachment/storage, report/PDF, dan delete lifecycle.
- [x] UCW-319 - Fallback laporan bisnis Telegram Mini Web ke DM user terverifikasi
  - Jika `Unduh PDF` di `ProjectReport` gagal di Telegram Mini Web, surface report harus menyediakan tombol `Kirim ke DM` yang mengirim PDF bisnis ke chat privat bot milik user terverifikasi; browser download tetap menjadi jalur utama.
  - Scope target: `api/report-pdf-delivery.js`, `src/lib/report-delivery-api.js`, `src/store/useReportStore.js`, `src/components/ProjectReport.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-88`, `UCW-309`, `UCW-313`.
  - Addendum audit: endpoint baru men-generate PDF bisnis server-side lalu mengirimnya ke DM Telegram user terverifikasi; kalau delivery file gagal, bot mengirim fallback text yang mengarahkan user kembali ke browser untuk unduh langsung.
- [x] UCW-320 - Petakan notifikasi grup operasional menjadi summary + CTA review cepat
  - Grup harus tetap ringkas: event `create`, `payment`, `recap`, dan `attendance` hanya mengirim summary singkat + tombol review data, tanpa balasan AI panjang di grup.
  - Scope target: docs freeze/backlog Telegram, surface group notification terkait, dan jika perlu helper CTA yang mengarah ke Mini Web / DM.
  - Dependensi: `UCW-319`.
  - Addendum audit: event grup diperlakukan sebagai publish/read-only surface; detail review pindah ke tombol atau DM, bukan percakapan panjang di grup. Notifikasi sekarang mengirim summary ringkas + CTA review cepat ke surface canonical, dan jalur recap/attendance sudah dipetakan sebagai surface lanjut.
- [x] UCW-321 - Kunci fallback AI DM untuk user terverifikasi dan arahkan ke bot/web
  - DM assistant harus menjadi tempat klarifikasi dan drill-down untuk user yang terverifikasi, lalu hasil akhirnya tetap diarahkan ke bot/web jika membutuhkan detail atau review data.
  - Scope target: `api/telegram-assistant.js`, `src/lib/telegram-assistant-links.js`, `src/lib/telegram-assistant-routing.js`, `tests/unit/telegram-assistant-routing.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-319`, `UCW-320`.
  - Addendum audit: fallback conversational state tetap read-only, membedakan grup vs DM, dan DM pribadi dipakai untuk follow-up terverifikasi tanpa membuat source of truth baru.
- [x] UCW-322 - Smoke browser, Mini Web Telegram, dan fallback DM untuk laporan bisnis
  - Harus ada bukti smoke bahwa browser tetap bisa unduh PDF, Telegram Mini Web menyediakan jalur `Kirim ke DM`, dan delivery DM benar-benar memanggil endpoint server-side untuk user terverifikasi.
  - Scope target: `tests/live/report-pdf-delivery.spec.js`, `tests/live/helpers/live-app.js`, `docs/progress/unified-crud-workspace-progress-log.md`, `docs/release-aq-gate.md`.
  - Dependensi: `UCW-319`.
  - Addendum audit: smoke report/PDF dipindah ke spec khusus supaya bisa divalidasi tanpa menunggu baseline serial smoke yang lebih berat; browser download + DM trigger sekarang lolos di `tests/live/report-pdf-delivery.spec.js` terhadap `ProjectsPage`.
- [x] UCW-323 - Audit smoke deep soft-delete, restore, dan permanent delete lintas domain
  - Browser/unit smoke harus membuktikan label UI aktual (`Jurnal`, `Arsip`, `Arsip Master`) dan policy recycle-bin untuk document restore-only, master restore-only, attendance permanent delete, serta payment leaf restore/permanent delete.
  - Scope target: `tests/e2e/transactions.spec.js`, `tests/e2e/restore.spec.js`, `tests/e2e/payment.spec.js`, `tests/unit/attachment-permissions.test.js`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-85`, `UCW-90`, `UCW-238`.
  - Addendum audit: task ini menjembatani gap test stale label vs policy final, tanpa mengubah runtime source of truth.
- [x] UCW-324 - Stabilkan hydration `invite_link` agar link undangan owner tidak hilang setelah refresh
  - `latestInvite` dari generate dan reload harus memakai shape yang sama, sehingga card invite tetap tampil setelah owner membuat link lalu halaman/refetch berjalan.
  - Scope target: `src/store/useTeamStore.js`, `src/lib/supabase.js`, `tests/unit/team-invite-store.test.js`, `tests/unit/telegram-assistant-routing.test.js`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-124`, `UCW-125`, `UCW-321`.
  - Addendum audit: task ini hanya menghidupkan kembali `invite_link` di read/hydration path dan memastikan bot tetap read-only; tidak ada surface invite write baru di assistant.
- [x] UCW-325 - Kunci DM handoff Telegram assistant dengan token sekali pakai
  - Link DM dari grup harus membawa token handoff yang terikat ke `telegram_user_id` target, berlaku sekali, dan kedaluwarsa supaya user lain tidak bisa mengambil alih context yang sama.
  - Scope target: `api/telegram-assistant.js`, `api/telegram-assistant-handoff.js`, `src/lib/telegram-assistant-links.js`, `src/lib/telegram-assistant-routing.js`, `supabase/migrations/20260423120000_create_telegram_assistant_handoffs.sql`, `tests/unit/telegram-assistant-routing.test.js`, `tests/unit/telegram-assistant-handoff.test.js`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-321`.
  - Addendum audit: group fallback tetap read-only; tombol DM sekarang mengarah ke `/start <handoff-token>` dan token hanya boleh dipakai oleh akun yang dituju.
- [x] UCW-326 - Polish UI halaman Tim invite agar lebih rapih dan brand-consistent
  - Halaman `Tim` harus lebih jelas secara hierarchy: composer invite, kartu link terbaru, dan list anggota aktif tetap terbaca mobile-first tanpa mengubah contract invite.
  - Scope target: `src/pages/TeamInvitePage.jsx`, `src/components/TeamInviteManager.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-124`, `UCW-125`, `UCW-324`.
  - Addendum audit: polish ini hanya merapikan shell, card, spacing, dan brand tokens untuk flow invite yang sudah ada; tidak ada logic, schema, atau bot write boundary baru.
- [x] UCW-327 - Arahkan review pembayaran bill ke detail transaksi surface riwayat
  - Tombol review pembayaran bill harus mendarat ke detail transaksi canonical dengan surface riwayat, bukan ke halaman payment settlement.
  - Scope target: `api/notify.js`, `src/lib/telegram-assistant-links.js`, `src/pages/TransactionDetailPage.jsx`, `tests/unit/telegram-notify.test.js`, `tests/unit/telegram-assistant-routing.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-242`, `UCW-252`, `UCW-320`.
  - Addendum audit: route review harus tetap canonical untuk Telegram deep link, dan detail page perlu menegaskan surface history tanpa mengubah source of truth settlement.
- [ ] UCW-328 - Smoke live `attendance -> salary bill -> payment`
  - Lane AQ staging harus membuktikan absensi UI bisa dibuat, direkap menjadi salary bill, lalu dibayar dari `/payment/:id` dengan hasil yang bisa diverifikasi service-role tanpa bergantung pada mock.
  - Scope target: `tests/live/release-smoke.spec.js`, `scripts/aq/verify-live-smoke.mjs`, `docs/release-aq-gate.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-315`, `UCW-317`, `UCW-318`, `UCW-243`, `UCW-245`, `UCW-252`.
  - Addendum audit: smoke akan memakai worker/project seed yang ada, membuat attendance sheet pada tanggal aman, men-trigger recap payroll, lalu membayar salary bill dan memverifikasi link attendance -> bill -> payment; jika seed belum siap, blocker tetap dibukukan di gate.
- [x] UCW-329 - Tumpulkan Team Invite jadi field picker owner-only tanpa helper teks
  - Halaman `Tim` harus tampil ringkas untuk owner: role dipilih lewat bottom sheet tanpa search, dan copy/helper text yang tidak perlu dihapus.
  - Scope target: `src/pages/TeamInvitePage.jsx`, `src/components/TeamInviteManager.jsx`, `src/components/ui/MasterPickerField.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-124`, `UCW-125`, `UCW-324`, `UCW-326`.
  - Addendum audit: surface invite boleh tetap punya action link/copy dan list anggota, tetapi tanpa deskripsi panjang, helper text, atau search field di picker.
- [x] UCW-330 - Stabilkan env fallback delivery PDF Telegram untuk DM user terverifikasi
  - Endpoint delivery PDF harus menerima fallback `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`/`VITE_SUPABASE_ANON_KEY`, lalu tetap bisa melanjutkan lookup profile Telegram untuk delivery DM tanpa berhenti di env incomplete.
  - Scope target: `api/report-pdf-delivery.js`, `tests/unit/report-pdf-delivery.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-319`.
  - Addendum audit: brief ini skip smoke dulu; fokusnya menutup failure env di jalur kirim PDF ke DM dan menambah coverage unit untuk fallback runtime.
- [x] UCW-331 - Pulihkan preview lokal `vercel dev` untuk API auth
  - Preview lokal full runtime harus bisa melayani Vite dan Vercel serverless API di Windows tanpa watcher `EPERM`, serta punya command npm yang jelas untuk membedakan UI-only dev dan API dev.
  - Scope target: `.vercelignore`, `vercel.json`, `package.json`, `playwright.live.config.js`, `docs/release-aq-gate.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-317`.
  - Addendum audit: `vercel.json` memaksa Vite upstream bind ke `127.0.0.1`, `.vercelignore` membatasi watcher ke file runtime, dan `npm run dev:api` menjadi command full preview lokal.
- [x] UCW-332 - Ringkas CTA notifikasi grup Telegram jadi satu tombol dan tambahkan notifikasi save absensi
  - Notifikasi grup operasional harus tetap ringkas dengan satu tombol CTA canonical per event, dan save sheet absensi harus memicu notifikasi summary yang mengarah ke review payroll harian.
  - Scope target: `api/notify.js`, `src/components/AttendanceForm.jsx`, `tests/unit/telegram-notify.test.js`, `tests/live/release-smoke.spec.js`, `tests/live/helpers/live-app.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-320`, `UCW-327`, `UCW-331`.
  - Addendum audit: `loan_payment` kini menuju detail transaksi canonical pada surface riwayat, `AttendanceForm` mengirim summary sheet ke `/api/notify` setelah save sukses, dan live smoke meng-capture request notify tanpa side effect Telegram nyata.
- [x] UCW-334 - Tambahkan contract laporan per pihak untuk kreditur, supplier, dan pekerja
  - Laporan statement harus punya contract backend domain-native untuk `creditor`, `supplier`, dan `worker`, lalu mengekspos summary saldo + rows transaksi supaya PDF baru bisa dibangun di atas source of truth yang sama.
  - Scope target: `api/records.js`, `src/lib/reports-api.js`, `tests/unit/party-statement.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-88`, `UCW-275`, `UCW-332`.
  - Addendum audit: ledger statement memakai row obligation/payment yang disortir kronologis, opening balance dihitung dari riwayat sebelum periode, dan helper client expose `fetchPartyStatementFromApi()` untuk surface UI nanti.
- [x] UCW-335 - Rilis statement PDF kreditur v1 dari `ProjectsPage`
  - Statement kreditur harus bisa dipilih dari hub `ProjectsPage`, mengambil row dari contract `party_statement`, lalu menghasilkan PDF dengan ringkasan saldo dan daftar transaksi.
  - Scope target: `src/components/ProjectReport.jsx`, `src/store/useReportStore.js`, `src/lib/business-report.js`, `src/lib/report-pdf.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-334`, `UCW-339`.
  - Addendum audit: kreditur dulu untuk v1; supplier dan worker tetap micro-task terpisah supaya scope tetap kecil.
  - Addendum audit final: `ProjectsPage` sekarang punya toggle `Kreditur`, picker kreditur, summary saldo awal/debit/kredit/saldo akhir, daftar transaksi kreditur, dan PDF statement memakai palette `pdf_settings` yang sama dengan shell bisnis existing.
- [x] UCW-336 - Rilis statement PDF supplier v1 dari `ProjectsPage`
  - Statement supplier harus bisa dipilih dari hub `ProjectsPage`, mengambil row dari contract `party_statement`, lalu menghasilkan PDF dengan ringkasan saldo dan daftar transaksi.
  - Scope target: `src/components/ProjectReport.jsx`, `src/store/useReportStore.js`, `src/lib/business-report.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-334`, `UCW-335`, `UCW-339`.
  - Addendum audit: supplier v1 ikut pola statement yang sama dengan kreditur, tapi tetap dipisah supaya perubahan UI/store tetap kecil dan mudah diaudit.
  - Addendum audit final: `ProjectsPage` sekarang punya toggle `Supplier`, picker supplier, summary saldo awal/debit/kredit/saldo akhir, daftar transaksi supplier, dan `useReportStore` mengarah ke `party_statement` dengan `partyType=supplier`.
- [x] UCW-337 - Rilis statement PDF pekerja v1 dari `ProjectsPage`
  - Statement pekerja harus bisa dipilih dari hub `ProjectsPage`, mengambil row dari contract `party_statement`, lalu menghasilkan PDF dengan ringkasan saldo dan daftar transaksi.
  - Scope target: `src/components/ProjectReport.jsx`, `src/store/useReportStore.js`, `src/lib/business-report.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-334`, `UCW-335`, `UCW-336`, `UCW-339`.
  - Addendum audit: pekerja v1 ikut pola statement yang sama dengan kreditur dan supplier, tapi tetap dipisah supaya perubahan UI/store tetap kecil dan mudah diaudit.
- [x] UCW-338 - Redesign kwitansi create expense dan faktur material agar senada
  - Kwitansi transaksi dan faktur material harus memakai shell visual yang sama dengan kwitansi pembayaran supaya branding, header, dan feel PDF tetap konsisten.
  - Scope target: `api/notify.js`, `src/lib/report-pdf.js`, `tests/live/release-smoke.spec.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-335`, `UCW-336`, `UCW-339`.
  - Addendum audit: task ini akan fokus ke generator PDF kwitansi/faktur yang sudah ada tanpa mengubah contract laporan pihak.
  - Addendum audit final: `renderPaymentReceiptShell()` dan `addPaymentReceiptFooter()` sekarang dipakai bersama oleh kwitansi pembayaran, kwitansi transaksi, dan faktur material sehingga header, watermark, footer, dan tonalitas brand tetap konsisten.
- [x] UCW-339 - Merge `ProjectsPage` dengan pengaturan PDF sebagai satu hub
  - Surface `ProjectReport` dan pengaturan PDF harus tampil dalam `ProjectsPage` yang sama, sementara `/projects/pdf-settings` tetap hidup sebagai alias kompatibilitas yang mendarat ke section `PDF & Laporan`.
  - Scope target: `src/pages/ProjectsPage.jsx`, `src/pages/ProjectPdfSettingsPage.jsx`, `src/App.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-88`, `UCW-275`, `UCW-332`.
  - Addendum audit: `ProjectsPage` sekarang memuat report dan section pengaturan PDF secara inline, route legacy `/projects/pdf-settings` hanya redirect ke anchor section yang sama, dan kontrak data settings / generator PDF bisnis tetap tidak berubah.
- [x] UCW-340 - Dedikasikan detail faktur material dan poles delete UX lintas surface
  - Route canonical `Material Invoice` harus berdiri sendiri, detail page memakai satu card pusat, tombol hapus tetap terlihat lalu memberi fallback riwayat saat payment history sudah ada, dan history payroll worker tetap read-only tanpa aksi hapus/kwitansi.
  - Scope target: `src/App.jsx`, `api/transactions.js`, `src/components/TransactionDeleteDialog.jsx`, `src/lib/material-invoice.js`, `src/lib/transaction-delete.js`, `src/pages/MaterialInvoiceDetailPage.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/TransactionsPage.jsx`, `tests/unit/transaction-delete.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-03`, `UCW-26`, `UCW-28`, `UCW-93`, `UCW-236`.
  - Addendum audit: route canonical `/material-invoice/:id` sekarang dipakai untuk detail workspace, delete dialog reuse lintas surface menampilkan fallback riwayat saat payment history ada, dan guard stock material tetap mencegah delete bila rollback tidak aman.
- [x] UCW-341 - Harden assistant reply safety
  - Reply writer assistant harus tetap grounded pada fact packet, button route, dan konteks session; rewrite yang mengarang angka, entity, route, atau aksi baru harus fallback ke teks deterministik.
  - Scope target: `api/telegram-assistant.js`, `tests/unit/telegram-assistant-writer.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-332`, `UCW-340`.
  - Addendum audit: safety gate writer sekarang menolak rewrite yang mengarang angka, entity, route, atau aksi baru di luar fact packet, klarifikasi tetap lolos, dan fallback deterministik tetap jadi jalur aman.
- [x] UCW-342 - Kunci coherence route assistant dan label CTA canonical
  - Navigate reply, tombol inline, callback action, dan deep link assistant harus menunjuk ke route canonical yang sama tanpa drift label atau target.
  - Scope target: `api/telegram-assistant.js`, `src/lib/telegram-assistant-links.js`, `src/lib/telegram-assistant-routing.js`, `tests/unit/telegram-assistant-routing.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-332`, `UCW-341`.
  - Addendum audit: label reply dan CTA sekarang dibaca dari satu source of truth route canonical; attendance CTA mengarah ke `/payroll?tab=daily`, worker CTA ke `/payroll?tab=worker`, navigate reply payroll tetap memetakan label yang sama, dan deep link attendance roundtrip lolos unit test.
- [x] UCW-343 - Kembalikan detail faktur material dan surat jalan ke tab canonical transaksi
  - Surface detail awal tetap sama di `TransactionDetailPage`, rincian faktur/surat jalan dibuka lewat tab, dan route legacy `/material-invoice/:id` cukup jadi alias redirect ke `/transactions/:id`.
  - Scope target: `api/transactions.js`, `src/components/MaterialInvoiceDetailPanel.jsx`, `src/lib/material-invoice.js`, `src/pages/MaterialInvoiceDetailPage.jsx`, `src/pages/TransactionDetailPage.jsx`, `tests/e2e/transactions.spec.js`, `tests/e2e/helpers/routes.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-340`.
  - Addendum audit: tab `Rincian Faktur` sekarang dibangun dari detail material invoice yang difetch ulang, sementara route legacy tetap hidup sebagai redirect supaya link lama tidak putus.
- [x] UCW-344 - Pulihkan tombol simpan income baru yang tidak submit
  - Tombol simpan pada form pemasukan proyek baru harus submit beneran lewat wiring `formId`, tanpa mengubah flow create income lain.
  - Scope target: `src/components/IncomeForm.jsx`, `tests/e2e/edit.spec.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-336`.
  - Addendum audit: form `IncomeForm` kembali punya `id` yang cocok dengan footer action bar, dan e2e create income sekarang membuktikan request `POST /api/transactions` benar-benar terkirim.
- [x] UCW-345 - Tambahkan badge status pembayaran di row jurnal
  - Row jurnal di `TransactionsPage` menampilkan badge status kecil `Lunas / Dicicil / Belum` di stack kanan bawah badge creator, dengan amount tetap di bawahnya saat billing status tersedia.
  - Scope target: `src/components/ui/ActionCard.jsx`, `src/lib/transaction-presentation.js`, `src/pages/TransactionsPage.jsx`, `tests/unit/transaction-presentation.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-340`, `UCW-343`.
  - Addendum audit: badge status hanya muncul untuk row yang memang punya settlement/billing status; row tanpa status tetap memakai layout lama agar perubahan tetap kecil dan terukur.
- [x] UCW-346 - Koreksi badge row jurnal dan sembunyikan amount surat jalan
  - Row jurnal tetap menaruh amount di atas, creator badge tetap jadi chip utama, status settlement ikut badge yang berbeda, loan tetap menampilkan status dari bill/amount fallback, dan amount surat jalan disembunyikan di surface transaksi yang relevan.
  - Scope target: `src/components/MaterialInvoiceDetailPanel.jsx`, `src/components/ui/ActionCard.jsx`, `src/lib/transaction-presentation.js`, `src/pages/Dashboard.jsx`, `src/pages/DeletedTransactionDetailPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/pages/TransactionsPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `tests/unit/transaction-presentation.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-345`.
  - Addendum audit: revisi ini menutup mismatch layout amount vs badge, membedakan creator dan status secara visual, dan menyembunyikan amount pada delivery order tanpa mengganggu faktur normal.
- [x] UCW-347 - Ringkas field deskripsi/catatan dan sembunyikan notes kosong di detail
  - Field textarea deskripsi dan catatan pada form aktif perlu lebih hemat tinggi, sementara notes kosong tidak boleh dirender lagi di surface detail/history mana pun.
  - Scope target: `src/components/ui/AppPrimitives.jsx`, `src/components/ExpenseForm.jsx`, `src/components/IncomeForm.jsx`, `src/components/LoanForm.jsx`, `src/components/MaterialInvoiceForm.jsx`, `src/components/HrdPipeline.jsx`, `src/pages/PaymentPage.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/pages/PayrollWorkerDetailPage.jsx`, `src/pages/PaymentsPage.jsx`, `src/components/MaterialInvoiceDetailPanel.jsx`, `src/lib/transaction-presentation.js`, `tests/unit/transaction-presentation.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-343`, `UCW-346`.
  - Addendum audit: compact textarea target diturunkan dari 28px ke 24px agar form tidak terlalu tinggi; note yang kosong disembunyikan sepenuhnya di surface detail, bukan diganti placeholder.
- [x] UCW-348 - Susun command bot step-by-step dengan `tambah`
  - Surface `Telegram assistant` harus bergerak step-by-step: `/tambah` membuka submenu domain input, `/buka` membuka core surface, `/cari` domain-first search picker, `/status` dan `/riwayat` menampilkan summary bucket, serta `/analytics` memakai metric-first clarification.
  - Scope target: `api/telegram-assistant.js`, `src/lib/telegram-assistant-links.js`, `src/lib/telegram-assistant-routing.js`, `tests/unit/telegram-assistant-routing.test.js`, `docs/freeze/01-planning-decision-freeze.md`, `docs/freeze/02-prd-master.md`, `docs/freeze/03-source-of-truth-contract-map.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-341`, `UCW-342`.
  - Addendum audit: command surface tetap read-only dan code-owned; BotFather hanya visibility command list, `tambah` hanya deep-link ke form input mini app, `buka/cari` mendarat ke route picker canonical, dan `status/riwayat/analytics` tetap summary-first atau clarification-first tanpa menambah jalur mutasi.
- [x] UCW-349 - Rapikan gate lint agar artefak generated tidak mengotori audit repo
  - `npm run lint` harus kembali memeriksa source repo saja; artefak `playwright-report`, `test-results`, dan output generated lain tidak boleh membuat audit source code gagal palsu.
  - Scope target: `eslint.config.js`, `.gitignore`, `docs/release-aq-gate.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-312`, `UCW-323`.
  - Addendum audit: `eslint` global ignore sekarang menutup `playwright-report/**` dan `test-results/**`, jadi `npm run lint` kembali memotret source repo aktif tanpa noise artefak smoke/test.
- [x] UCW-350 - Stabilkan unit test lifecycle invite token agar tidak bergantung tanggal hari ini
  - Unit test mapping invite tidak boleh gagal hanya karena tanggal absolut pada fixture sudah lewat; lifecycle invite harus diuji dengan jam referensi deterministik atau fixture yang relatif.
  - Scope target: `src/lib/team-invite.js`, `tests/unit/team-invite-store.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-349`.
  - Addendum audit: boundary yang disentuh hanya helper invite dan unit test store tim; helper lifecycle menerima jam referensi opsional supaya fixture test bisa deterministik tanpa mengubah workflow invite lintas UI/server.
- [x] UCW-351 - Stabilkan bootstrap auth mock browser dan first-route smoke
  - Harness Playwright mock harus bisa membuka `/`, `/attendance/new`, dan route shell lain tanpa macet di `Sedang memuat workspace`, timeout `goto`, atau `ERR_CONNECTION_REFUSED` yang tidak deterministik.
  - Scope target: `tests/e2e/helpers/app.js`, `playwright.config.js`, `src/store/useAuthStore.js`, `src/lib/dev-auth-bypass.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-182`, `UCW-349`.
  - Addendum audit: targetnya menormalkan auth bootstrap dan startup harness; helper smoke sekarang menanam bypass storage sebelum navigation dan menunggu loading screen workspace hilang sebelum assert route, tanpa mengubah mode produk browser-first di luar contract dev/reviewer.
- [x] UCW-352 - Sinkronkan smoke mock `Tagihan` dan PDF dengan contract UI terbaru
  - Suite mock report harus mengikuti route canonical terbaru: `/tagihan` mendarat ke `Jurnal` tab `Tagihan`, dan smoke PDF harus memakai data/mock yang benar-benar cukup untuk memicu download atau dipisah tegas dari lane live.
  - Scope target: `tests/e2e/report.spec.js`, `tests/e2e/helpers/app.js`, `src/pages/TransactionsPage.jsx`, `src/components/ProjectReport.jsx`, `src/store/useReportStore.js`, `docs/release-aq-gate.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-351`, `UCW-322`.
  - Addendum audit: task ini tidak boleh mengubah source of truth report; smoke mock sekarang mengikuti route `Jurnal` / `Tagihan` canonical dan memakai fixture laporan deterministik supaya unduhan PDF benar-benar terjadi pada lane mock, bukan bergantung pada live seed.
- [x] UCW-353 - Stabilkan submit mobile create `project-income` pada routed form
  - Tombol `Simpan Termin Proyek` di viewport mobile tidak boleh tertutup layer form atau gagal diklik; request `POST /api/transactions` harus benar-benar terkirim dari surface routed form.
  - Scope target: `src/components/IncomeForm.jsx`, `src/pages/EditRecordPage.jsx`, `src/components/layouts/FormLayout.jsx`, `tests/e2e/edit.spec.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-344`, `UCW-351`.
  - Addendum audit: fokus hanya pada submit path mobile create income; footer routed form tetap di satu shell yang sama, tetapi action bar kini tetap terlihat di mobile dan tetap bisa menerima pointer event saat field terakhir masih fokus.
- [ ] UCW-354 - Sinkronkan AQ gate dengan coverage smoke aktual dan gap yang masih tersisa
  - Dokumen AQ harus mencatat coverage live yang sudah nyata untuk `attendance -> salary bill -> payment` serta report/PDF dedicated smoke, sambil membiarkan gap attachment, delete lifecycle, comparator report, dan staging-safe target tetap eksplisit.
  - Scope target: `docs/release-aq-gate.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-322`, `UCW-312`, `UCW-315`.
  - Addendum audit: task ini docs-only; tidak membuka write smoke baru sebelum target staging-safe terbukti aman.
- [x] UCW-355 - Audit entrypoint dan arsitektur `/reports` untuk PDF hub
  - Sebelum implementasi runtime route baru, entrypoint unduh PDF laporan Kreditur/Supplier/Pekerja harus dipetakan dari repo aktual, pilihan arsitektur user harus dikunci, dan micro-task berikutnya harus ditulis tanpa asumsi liar.
  - Scope target: `docs/report-pdf-hub-entrypoint-audit-2026-04-24.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-334`, `UCW-335`, `UCW-336`, `UCW-337`, `UCW-339`, `UCW-352`.
  - Addendum audit: canonical target dikunci ke `/reports`, `/projects` tetap alias kompatibilitas, PDF generation tetap on-demand hybrid, dan batch ini berhenti di dokumen audit/plan tanpa menyentuh runtime.
- [ ] UCW-356 - Tambahkan canonical route `/reports` tanpa mengubah generator PDF
  - Route report hub canonical harus mendarat ke `ProjectsPage` yang sama, sementara `/projects`, `/projects/pdf-settings`, dan `/proyek` tetap berfungsi sebagai alias kompatibilitas direct ke `/reports` / `/reports#pdf-settings`.
  - Scope target: `src/App.jsx`, `src/pages/ProjectsPage.jsx`, `src/pages/ProjectPdfSettingsPage.jsx`, `src/pages/Dashboard.jsx`, `src/pages/MorePage.jsx`, `tests/e2e/report.spec.js`, `tests/live/report-pdf-delivery.spec.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-355`.
  - Addendum audit: canonical route dipilih ke `/reports`; alias lama tetap hidup, PDF generator dan source data report tidak berubah, dan naming UI `Unit Kerja` tetap ditahan untuk task lanjutan.
- [x] UCW-357 - Reset lampiran pasca save pada create flow expense dan faktur material
  - Create expense dan faktur material menahan reset surface sampai sync attachment settle, lalu draft file, preview, daftar lampiran tersimpan, dan session form kembali blank hanya setelah upload/attach sukses.
  - Scope target: `src/components/ExpenseAttachmentSection.jsx`, `src/components/ExpenseForm.jsx`, `src/components/MaterialInvoiceForm.jsx`, `tests/e2e/helpers/app.js`, `tests/e2e/attachment-reset.spec.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-20`, `UCW-68`, `UCW-69`, `UCW-81`, `UCW-86`.
  - Addendum audit: create flow expense dan faktur material sekarang menunggu child attachment settle sebelum reset; edit flow tetap tidak berubah, upload gagal mempertahankan draft untuk retry, dan smoke browser memverifikasi image/PDF attachment kembali blank setelah sync selesai.
- [ ] UCW-358 - Kunci guard absensi lintas proyek per worker-day
  - Guard absensi harian harus menutup kombinasi lintas proyek yang melampaui quota worker per tanggal: `full_day` menutup proyek lain, `half_day` hanya menyisakan `half_day` atau `overtime`, dan kombinasi `half+half` menutup semua status baru di proyek berikutnya.
  - Scope target: `src/lib/attendance-payroll.js`, `src/components/AttendanceForm.jsx`, `src/pages/EditRecordPage.jsx`, `api/records.js`, `tests/unit/attendance-guard.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-07`, `UCW-149`, `UCW-151`.
  - Addendum audit: billed tetap read-only; record unbilled existing tetap bisa diedit sesuai quota atau dikosongkan untuk memindahkan alokasi ke proyek lain; surface `Catatan Absensi` dan detail pekerja tetap read-only consumer dari `attendance_records`.
- [ ] UCW-359 - Redesign navigasi laporan mobile dengan picker sheet dan pisahkan `Pengaturan PDF`
  - Mode laporan di mobile harus dipilih lewat field picker bergaya `MasterPickerField`, bukan tab horizontal yang perlu scroll, dan entrypoint `Pengaturan PDF` harus pindah ke halaman terpisah yang terlihat dari atas fold.
  - Scope target: `src/components/ProjectReport.jsx`, `src/pages/ProjectsPage.jsx`, `src/pages/ProjectPdfSettingsPage.jsx`, `src/App.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-355`, `UCW-356`.
  - Addendum audit: bottomsheet mode laporan tidak memakai search field, opsi tampil 2 kolom x 3 baris dengan card balance, safezone atas sheet dibuat lebih lega agar picker cepat discan di mobile, page `Pengaturan PDF` diringkas dengan header compact tanpa duplikasi judul, dan filter party statement memakai picker searchable dengan tinggi sheet dibatasi agar tidak overlap di mobile.
  - Validasi minimum: `npm run lint`, `npm run build`, manual mobile check untuk picker mode dan entrypoint PDF settings.
- [x] UCW-360 - Harden worker party statement report against missing `overtime_fee`
  - Statement pekerja harus memakai attendance row tanpa kolom opsional `overtime_fee` agar unduhan PDF tidak gagal pada schema cache atau runtime DB yang belum sinkron.
  - Scope target: `api/records.js`, `tests/unit/party-statement.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-334`, `UCW-337`.
  - Addendum audit: worker statement tetap membaca attendance fields yang dipakai PDF, tetapi query tidak lagi menghardcode kolom `overtime_fee` yang tidak diperlukan rendering dan bisa hilang di runtime schema.
- [x] UCW-361 - Konsolidasikan kompres attachment gambar di boundary upload
  - Attachment gambar sekarang dikompres lewat satu boundary prepare sebelum upload storage, sehingga jalur direct dan background upload memakai perilaku yang sama.
  - Scope target: `src/store/useFileStore.js`, `tests/unit/attachment-upload.test.js`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-19`, `UCW-86`.
  - Addendum audit: helper kompres yang sudah ada kini dipakai di semua entrypoint upload attachment gambar; PDF/non-image tetap tidak dikompres, metadata `file_size` mengikuti hasil file akhir, dan cleanup storage tetap berjalan saat registrasi metadata gagal.
- [x] UCW-362 - Modal-only mutation feedback untuk create/edit/bayar/hapus/restore
  - Loading, success, dan error mutation dipindahkan ke modal pop-up agar surface CRUD utama tidak lagi menampilkan feedback inline yang membingungkan saat mutasi sedang berjalan.
  - Scope target: `src/components/HrdPipeline.jsx`, `src/components/BeneficiaryList.jsx`, `src/components/MasterMaterialForm.jsx`, `src/pages/StockPage.jsx`, `src/components/WorkerForm.jsx`, `src/components/master/GenericMasterForm.jsx`, `src/components/LoanForm.jsx`, `src/pages/PaymentPage.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/components/ExpenseAttachmentSection.jsx`, `src/components/ExpenseForm.jsx`, `src/components/MaterialInvoiceForm.jsx`, `src/components/IncomeForm.jsx`, `src/components/PaymentModal.jsx`, `src/components/AttendanceForm.jsx`, `src/components/PayrollManager.jsx`, `src/pages/PayrollPage.jsx`, `src/pages/PaymentsPage.jsx`, `src/pages/TransactionsPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/DeletedTransactionDetailPage.jsx`, `src/components/TransactionDeleteDialog.jsx`, `src/components/PayrollAttendanceHistory.jsx`, `src/store/usePaymentStore.js`, `src/store/useIncomeStore.js`, `src/store/useTransactionStore.js`, `src/store/useToastStore.js`, `src/components/ui/GlobalToast.jsx`, `src/components/ui/AppPrimitives.jsx`, `src/lib/mutation-toast.js`, `src/hooks/useMutationToast.js`.
  - Dependensi: `UCW-357`, `UCW-359`, `UCW-360`, `UCW-361`.
  - Addendum audit: submit success baru muncul setelah reset/refresh/close settle selesai, delete success baru muncul setelah list/detail sudah hilang dari UI, dan inline loading/success banners yang tersisa di surface mutasi utama dihilangkan.
- [x] UCW-363 - Finalisasi cleanup modal-only untuk validasi form mutasi yang tersisa
  - Inline validation fallback yang masih tampil di HrdPipeline, BeneficiaryList, WorkerForm, MasterMaterialForm, dan StockPage dihapus; invalid input sekarang hanya memunculkan modal fail.
  - Scope target: `src/components/HrdPipeline.jsx`, `src/components/BeneficiaryList.jsx`, `src/components/WorkerForm.jsx`, `src/components/MasterMaterialForm.jsx`, `src/pages/StockPage.jsx`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-362`.
  - Addendum audit: feedback mutation tetap modal-only; state inline yang tersisa dipertahankan hanya untuk load/error data non-mutation.
- [x] UCW-364 - Selaraskan backfill attendance legacy dengan aturan repo berbasis project
  - Backfill attendance legacy hanya boleh memuat row yang punya `projectId` eksplisit; row legacy tanpa `projectId` harus dilewati walau punya relasi worker atau salary bill, karena repo ini memodelkan absensi per proyek.
  - Scope target: `scripts/firestore-backfill/helpers.mjs`, `scripts/firestore-backfill/extract.mjs`, `scripts/firestore-backfill/load.mjs`, `tests/unit/firestore-backfill.test.js`, `scripts/firestore-backfill/README.md`, `docs/firestore-backfill-handoff-2026-04-23.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-07`, `UCW-13`, `UCW-334`.
  - Addendum audit: extractor kini menyaring row attendance tanpa `projectId` legacy dari artifact canonical dan membersihkan `id-map` terkait; loader juga skip defensif jika artifact lama masih membawa row tanpa project sehingga backfill staging tidak lagi mengisi `project_id` lewat fallback `salary_bill` atau `worker.default_project_id`.
- [x] UCW-365 - Selaraskan nominal loan legacy dan dedupe source `project-income` di transaksi
  - Snapshot loan harus mempertahankan `totalRepaymentAmount` legacy sebagai total kewajiban pengembalian, sementara source transaksi workspace/history harus menggabungkan row `project-income` multi fee-bill menjadi satu row canonical agar UI tidak terlihat dobel pasca backfill.
  - Scope target: `src/lib/loan-business.js`, `src/store/usePaymentStore.js`, `src/store/useIncomeStore.js`, `api/transactions.js`, `tests/unit/firestore-backfill.test.js`, `tests/unit/transactions-project-income-aggregation.test.js`, `docs/firestore-backfill-handoff-2026-04-23.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-24`, `UCW-82`, `UCW-364`.
  - Addendum audit: helper snapshot loan kini menjaga `repayment_amount` eksplisit dari legacy/backfill sehingga nominal pengembalian di detail/payment tidak turun ke fallback formula; read model `vw_workspace_transactions` dan `vw_history_transactions` juga menggabungkan sibling fee bill `project-income`, termasuk summary bill teragregasi pada detail income.
- [x] UCW-366 - Finalkan live backfill attendance ke project UI aktif dan kunci jalur audit surface
  - Project `.env` yang dipakai UI frontend harus menerima rerun backfill attendance final beserta asset sync setelah schema remote `attendance_records` diselaraskan untuk `attendance_status = 'absent'` dan kolom `overtime_fee`; hasil audit juga harus menegaskan bahwa attendance diverifikasi dari surface `Absensi`/`Payroll`, bukan `Jurnal`.
  - Scope target: `docs/firestore-backfill-handoff-2026-04-23.md`, `docs/unified-crud-workspace-plan-2026-04-18.md`, `docs/progress/unified-crud-workspace-progress-log.md`.
  - Dependensi: `UCW-364`, `UCW-365`.
  - Addendum audit: live load `.env` kini selesai dengan `meta/load-report.json` `blocking_issues = 0` dan `meta/asset-sync-report.json` `failed = 0`; `.env.backfill.local` tetap dicatat sebagai target terpisah yang belum repo-ready sehingga tidak dipakai untuk audit UI saat ini.
