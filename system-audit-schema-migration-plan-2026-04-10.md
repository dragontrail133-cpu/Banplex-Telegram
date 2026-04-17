# System Audit & Schema Migration Plan

Audit date: 2026-04-10  
Audit scope: repository `banplex-vite` as-is, with focus on current implementation facts, Firebase data model mapping, and proposed SQL target for rewrite to Telegram Mini App (`React + Vite + Tailwind + Zustand + Supabase + Vercel Serverless`).

## 1. Current Tech Stack & Dependencies

### 1.1 Library utama dari `package.json`

| Area | Library | Keterangan audit |
| --- | --- | --- |
| Build tool | `vite` | Build/dev server utama. |
| React layer | `react`, `react-dom`, `@vitejs/plugin-react` | Ada di repo, tetapi app yang berjalan masih dominan legacy Vanilla JS. |
| PWA | `vite-plugin-pwa` | PWA aktif dengan `injectManifest` ke `pwa/sw-workbox.js`. |
| State | `zustand` | Sudah dipakai di `src/react/store`, tetapi migrasi belum tuntas. |
| Animation/UI | `framer-motion` | Tersedia untuk layer React baru. |
| Mobile wrapper | `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/app`, `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/status-bar` | Menandakan repo pernah/masih disiapkan untuk hybrid mobile. |
| Spreadsheet/export | `xlsx` | Dipakai untuk impor/ekspor data file storage dan HRD applicant. |
| Server-side util | `firebase-admin` | Dipakai di folder `api/` untuk endpoint notifikasi. |
| Push / notification backend | `web-push` | Untuk OS push notification. |
| KV / infra | `ioredis` | Dipakai untuk simpan push subscription di Redis/KV. |
| Testing | `cypress` | Ada dependency test E2E. |
| Build/helper | `dotenv-cli`, `esbuild`, `glob`, `sharp` | Tooling build dan optimasi asset. |

### 1.2 Library yang aktif dipakai tetapi tidak berasal dari `package.json`

Temuan penting: beberapa library runtime utama justru di-load dari CDN, bukan dari package manager.

- Firebase Web SDK di-import langsung dari `https://www.gstatic.com/firebasejs/12.3.0/...`
- Dexie di-import dari `https://unpkg.com/dexie@3/dist/dexie.mjs`
- `html2canvas`, `jspdf`, `jspdf-autotable`, `Chart.js` di-load dinamis dari CDN
- Cloudinary upload dipanggil langsung via XHR ke API Cloudinary

### 1.3 Ringkasan stack aktual

Walaupun proyek dideskripsikan sebagai `Vanilla JS + Vite + Firebase`, kondisi repo saat audit adalah **hybrid**:

- shell utama, router, halaman, service, sync, dan state utama masih legacy `Vanilla JS`
- ada migrasi parsial ke `React + Zustand` di `src/react/`
- entry HTML masih bootstrap `js/app.js`, bukan React entry tunggal
- storage client-side bersifat offline-first melalui IndexedDB/Dexie
- backend kecil berada di `api/` untuk push notification dan helper Firebase Admin

## 2. Directory Architecture

### 2.1 Struktur folder tingkat tinggi

- `js/`
  - kode utama aplikasi saat ini
  - `config/`: Firebase config, constants, navigation registry
  - `state/`: `appState`, event bus, snapshot cache, live query
  - `services/`: auth, sync, report, receipt, local DB, notification, data services
  - `ui/`: page renderer, modal, card, form, event listener, action handler
  - `utils/`: formatter, helper, validation, DOM util
- `src/react/`
  - layer React/Zustand baru yang belum menggantikan runtime legacy
  - berisi store, hooks, bridge, dashboard hooks, shared component
- `api/`
  - endpoint serverless untuk notify, save push subscription, Firebase Admin helper, Redis/KV helper
- `styles/`
  - CSS modular per base/layout/component/page
- `public/`
  - PWA manifest dan asset statis
- `pwa/`
  - service worker Workbox custom
- `android/`
  - project Android/Capacitor
- `docs/`, `plans/`
  - dokumen progress migrasi dan rencana UI/arsitektur
- `scripts/`, `tools/`
  - helper script build/maintenance
- `dist/`
  - output build produksi

### 2.2 Arsitektur runtime aktual

- `index.html` memuat shell aplikasi dan bootstrap `/js/app.js`
- `js/app.js` menginisialisasi local DB, auth session, service worker, router, event listeners
- `js/router.js` dan `js/ui/pages/pageManager.js` mengendalikan navigasi page legacy
- `js/services/syncService.js` menjadi tulang punggung sinkronisasi Firestore <-> Dexie <-> app state
- `src/react/store/appStateStore.js` mulai mengambil sebagian state shell, tetapi belum menjadi source of truth tunggal

### 2.3 Observasi arsitektural

- `TEAM_ID` saat ini hardcoded ke `'main'`
- tenant boundary lebih bersifat konvensi path Firestore daripada model multi-tenant yang eksplisit
- ada campuran static import dan dynamic import yang membuat code-splitting tidak efektif
- build produksi berhasil, tetapi masih menghasilkan chunk utama yang sangat besar dan dependency graph yang bercampur antara legacy dan React

## 3. Data Schema Migration (CRITICAL)

### 3.1 Peta schema Firebase NoSQL yang terpakai saat ini

Semua path di bawah adalah temuan langsung dari service/config repo saat audit.

| Firebase path | Fungsi | Field utama yang teramati | Catatan migrasi |
| --- | --- | --- | --- |
| `users/{uid}` | profil role tambahan di luar membership | `role` | Dipakai sebagai fallback/normalisasi role. |
| `teams/main/members/{uid}` | membership + authorization | `email`, `name`, `photoURL`, `role`, `status`, `createdAt`, `updatedAt` | Sumber role/status aktif di app. |
| `teams/main/projects/{projectId}` | master proyek | `projectName`, `notes`, `projectType`, `budget`, `isWageAssignable`, `isDeleted`, timestamps | Dipakai hampir di semua flow transaksi. |
| `teams/main/funding_creditors/{id}` | master kreditur/pemberi pinjaman | `creditorName`, `notes`, `isDeleted`, timestamps | Dipakai oleh pinjaman. |
| `teams/main/operational_categories/{id}` | kategori pengeluaran operasional | `categoryName`, `isDeleted`, timestamps | Dipakai di form pengeluaran operasional. |
| `teams/main/material_categories/{id}` | kategori material | `categoryName`, `isDeleted`, timestamps | Terdefinisi di config/sync/local DB, tetapi bukti penggunaan bisnis aktif lemah. |
| `teams/main/other_categories/{id}` | kategori pengeluaran lain | `categoryName`, `isDeleted`, timestamps | Dipakai di form pengeluaran lainnya. |
| `teams/main/suppliers/{id}` | master supplier | `supplierName`, `category`, `notes`, `isDeleted`, timestamps | `category` dipakai untuk membedakan Material/Operasional/Lainnya. |
| `teams/main/professions/{id}` | master profesi pekerja | `professionName`, `notes`, `isDeleted`, timestamps | Dipakai pada pekerja/absensi. |
| `teams/main/workers/{id}` | master pekerja lapangan | `workerName`, `professionId`, `status`, `projectWages`, `defaultProjectId`, `defaultRole`, `notes`, `isDeleted`, timestamps | `projectWages` adalah object bertingkat yang perlu dinormalisasi. |
| `teams/main/staff/{id}` | master staf inti/fee rule | `staffName`, `paymentType`, `salary`, `feePercentage`, `feeAmount`, `notes`, `isDeleted`, timestamps | Dipakai untuk skema fee per termin. |
| `teams/main/materials/{id}` | master material/stok | `materialName`, `unit`, `currentStock`, `usageCount`, `reorderPoint`, `notes`, `isDeleted`, timestamps | Dipakai untuk stok dan faktur material. |
| `teams/main/incomes/{id}` | termin pemasukan proyek | `amount`, `date`, `projectId`, `projectName`, `description`, `notes`, `createdBy`, `createdByName`, `isDeleted`, timestamps | Nama proyek disimpan denormalized. |
| `teams/main/funding_sources/{id}` | pinjaman/modal masuk | `creditorId`, `creditorName`, `totalAmount`, `totalRepaymentAmount`, `interestType`, `rate`, `tenor`, `paidAmount`, `status`, `date`, `description`, `notes`, `isDeleted`, timestamps | Menyimpan pokok + total pengembalian. |
| `teams/main/funding_sources/{loanId}/payments/{paymentId}` | histori pembayaran pinjaman | `amount`, `date`, `createdAt`, `creditorName`, `attachmentUrl` | Subcollection. |
| `teams/main/expenses/{id}` | transaksi pengeluaran | `type`, `formType`, `projectId`, `supplierId`, `supplierName`, `categoryId`, `date`, `amount`, `description`, `notes`, `status`, `attachments`, `attachmentsLocalIds`, `items[]`, `isDeleted`, timestamps | `items[]` dipakai untuk faktur material/surat jalan. |
| `teams/main/bills/{id}` | tagihan hasil transaksi | `expenseId`, `description`, `amount`, `paidAmount`, `dueDate`, `status`, `type`, `projectId`, `supplierId`, `supplierName`, `workerId`, `workerDetails[]`, `recordIds[]`, `startDate`, `endDate`, `staffId`, `isDeleted`, timestamps | Menjadi pusat pembayaran, payroll, receipt, mutasi. |
| `teams/main/bills/{billId}/payments/{paymentId}` | histori pembayaran tagihan | `amount`, `date`, `createdAt`, `workerId`, `workerName`, `recipientName`, `description`, `attachmentUrl` | Subcollection. |
| `teams/main/attendance_records/{id}` | absensi & upah harian | `workerId`, `workerName`, `projectId`, `jobRole`, `date`, `attendanceStatus`, `checkIn`, `checkOut`, `workHours`, `normalHours`, `overtimeHours`, `dailyWage`, `hourlyWage`, `customWage`, `totalPay`, `isPaid`, `billId`, `integrityFlag`, `isDeleted`, timestamps | Satu record bisa mewakili manual atau timestamp flow. |
| `teams/main/stock_transactions/{id}` | mutasi stok | `materialId`, `quantity`, `type`, `date`, `pricePerUnit`, `projectId`, `relatedExpenseId`, `isDeleted`, timestamps | Dipakai untuk stok masuk/keluar. |
| `teams/main/settings/pdf` | konfigurasi PDF | minimal teramati: `headerColor` | Setting PDF saat ini minim dan sebagian asset masih file statis di `public/`. |
| `teams/main/statistics/billing` | statistik tagihan singleton | `totalOutstanding`, `totalPaid`, `totalCount`, `lastUpdated`, `lastCalculated` | Derived data, bukan source of truth. |
| `teams/main/hrd_applicants/{id}` | database pelamar HRD | biodata, alamat, pendidikan, `statusAplikasi`, `sumberLowongan`, `catatanHrd`, `urlKtp`, `urlKk`, `urlPasFoto`, `urlSuratSehat`, `urlCv`, `urlLainnya`, timestamps | Dokumen masih berupa URL file. |
| `penerimaManfaat/{id}` | database file storage/beneficiary | `namaPenerima`, `nik`, `jenisKelamin`, `jenjang`, `namaInstansi`, `npsnNspp`, `jarak`, `dataStatus`, data lahir/alamat, timestamps | Koleksi ini global, tidak berada di bawah `teams/main/*`. |

### 3.2 Temuan model data yang penting untuk migrasi

- Current tenant model bersifat semi-multi-tenant: hampir semua data ada di `teams/main/*`, tetapi `penerimaManfaat` global.
- Authorization tersebar di tiga tempat:
  - Firebase Auth user
  - `/users/{uid}`
  - `teams/main/members/{uid}`
- Banyak field display disimpan denormalized:
  - `projectName`
  - `supplierName`
  - `creditorName`
  - `workerName`
- Struktur yang wajib dinormalisasi:
  - `workers.projectWages`
  - `expenses.items[]`
  - `bills.workerDetails[]`
  - `bills.recordIds[]`
  - subcollection `payments`
- Tabel Dexie berikut **jangan** dimigrasikan 1:1 ke server schema:
  - `outbox`
  - `pending_payments`
  - `pending_logs`
  - `pending_conflicts`
  - `files`
- `statistics/billing` sebaiknya menjadi SQL view/materialized view, bukan tabel mutable.
- `material_categories` terdefinisi tetapi tidak tampak menjadi bagian flow master data aktif; perlu keputusan PRD apakah tetap dipertahankan atau digabung ke kategori umum.

### 3.3 Prinsip desain schema PostgreSQL/Supabase yang diusulkan

- Gunakan `uuid` sebagai PK internal baru.
- Simpan `legacy_firebase_id text unique null` pada tabel hasil migrasi bila data lama perlu dilacak.
- Gunakan `team_id uuid not null` pada seluruh data operasional agar RLS Supabase bisa konsisten.
- Ganti `isDeleted` dengan `deleted_at timestamptz null`.
- Gunakan `date` untuk tanggal bisnis:
  - `transaction_date`
  - `due_date`
  - `attendance_date`
- Gunakan `timestamptz` untuk audit:
  - `created_at`
  - `updated_at`
  - `approved_at`
  - `paid_at`
- Ganti array/subcollection dengan child table relasional.
- File jangan disimpan sebagai URL mentah di data inti; gunakan Supabase Storage + tabel metadata file.
- Dashboard, mutasi, dan laporan ringkas lebih baik dibentuk dari SQL view daripada dokumen statistik manual.

### 3.4 Usulan relational database schema untuk Supabase/PostgreSQL

Catatan konvensi: kecuali disebut lain, tabel domain di bawah diasumsikan memiliki kolom dasar berikut:

- `id uuid primary key default gen_random_uuid()`
- `team_id uuid not null references teams(id)`
- `legacy_firebase_id text unique null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz null`

#### A. Identity, tenancy, dan authorization

**Table: `teams`**

- `id uuid primary key default gen_random_uuid()`
- `code text unique not null`
- `name text not null`
- `status text not null default 'active'`

PK:
- `id`

FK:
- none

**Table: `profiles`**

- `user_id uuid primary key references auth.users(id)`
- `legacy_firebase_uid text unique null`
- `telegram_user_id bigint unique null`
- `email text null`
- `full_name text null`
- `avatar_url text null`
- `last_login_at timestamptz null`

PK:
- `user_id`

FK:
- `user_id -> auth.users.id`

**Table: `team_members`**

- `id uuid primary key default gen_random_uuid()`
- `team_id uuid not null references teams(id)`
- `user_id uuid not null references profiles(user_id)`
- `role text not null`
- `status text not null`
- `approved_by uuid null references profiles(user_id)`
- `approved_at timestamptz null`
- `notes text null`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `user_id -> profiles.user_id`
- `approved_by -> profiles.user_id`

Constraint yang disarankan:
- `unique(team_id, user_id)`
- `check (role in ('Owner','Admin','Logistik','Payroll','Administrasi','Viewer'))`
- `check (status in ('pending','active','suspended','rejected'))`

#### B. Master data

**Table: `expense_categories`**

- `name text not null`
- `category_group text not null`
- `notes text null`

PK:
- `id`

FK:
- `team_id -> teams.id`

Constraint yang disarankan:
- `unique(team_id, category_group, name)`
- `check (category_group in ('operational','material','other'))`

Mapping:
- `operational_categories` -> `category_group='operational'`
- `other_categories` -> `category_group='other'`
- `material_categories` -> `category_group='material'` bila PRD memutuskan tetap dipakai

**Table: `projects`**

- `project_name text not null`
- `project_type text null`
- `budget numeric(16,2) null`
- `is_wage_assignable boolean not null default false`
- `status text not null default 'active'`
- `notes text null`

PK:
- `id`

FK:
- `team_id -> teams.id`

**Table: `suppliers`**

- `supplier_name text not null`
- `supplier_type text not null`
- `notes text null`

PK:
- `id`

FK:
- `team_id -> teams.id`

Constraint yang disarankan:
- `check (supplier_type in ('Material','Operasional','Lainnya'))`
- `unique(team_id, supplier_name, supplier_type)`

**Table: `funding_creditors`**

- `creditor_name text not null`
- `notes text null`

PK:
- `id`

FK:
- `team_id -> teams.id`

Constraint yang disarankan:
- `unique(team_id, creditor_name)`

**Table: `professions`**

- `profession_name text not null`
- `notes text null`

PK:
- `id`

FK:
- `team_id -> teams.id`

Constraint yang disarankan:
- `unique(team_id, profession_name)`

**Table: `workers`**

- `profession_id uuid null references professions(id)`
- `worker_name text not null`
- `status text not null default 'active'`
- `default_project_id uuid null references projects(id)`
- `default_role_name text null`
- `notes text null`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `profession_id -> professions.id`
- `default_project_id -> projects.id`

**Table: `worker_wage_rates`**

- `worker_id uuid not null references workers(id)`
- `project_id uuid not null references projects(id)`
- `role_name text not null`
- `wage_amount numeric(16,2) not null`
- `is_default boolean not null default false`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `worker_id -> workers.id`
- `project_id -> projects.id`

Constraint yang disarankan:
- `unique(worker_id, project_id, role_name)`

Mapping penting:
- berasal dari object `workers.projectWages[projectId][roleName] = wage`

**Table: `staff`**

- `staff_name text not null`
- `payment_type text not null`
- `salary numeric(16,2) null`
- `fee_percentage numeric(8,4) null`
- `fee_amount numeric(16,2) null`
- `notes text null`

PK:
- `id`

FK:
- `team_id -> teams.id`

Constraint yang disarankan:
- `check (payment_type in ('monthly','per_termin','fixed_per_termin'))`

**Table: `materials`**

- `category_id uuid null references expense_categories(id)`
- `material_name text not null`
- `unit text null`
- `current_stock numeric(14,3) not null default 0`
- `usage_count integer not null default 0`
- `reorder_point numeric(14,3) not null default 0`
- `notes text null`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `category_id -> expense_categories.id`

#### C. File metadata

**Table: `file_assets`**

- `storage_bucket text not null`
- `storage_path text not null`
- `public_url text null`
- `mime_type text null`
- `original_name text null`
- `size_bytes bigint null`
- `uploaded_by_user_id uuid null references profiles(user_id)`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `uploaded_by_user_id -> profiles.user_id`

Constraint yang disarankan:
- `unique(storage_bucket, storage_path)`

#### D. Finance and transaction core

**Table: `project_incomes`**

- `project_id uuid not null references projects(id)`
- `transaction_date date not null`
- `amount numeric(16,2) not null`
- `description text null`
- `notes text null`
- `created_by_user_id uuid null references profiles(user_id)`
- `project_name_snapshot text null`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `project_id -> projects.id`
- `created_by_user_id -> profiles.user_id`

**Table: `loans`**

- `creditor_id uuid not null references funding_creditors(id)`
- `transaction_date date not null`
- `principal_amount numeric(16,2) not null`
- `repayment_amount numeric(16,2) not null`
- `paid_amount numeric(16,2) not null default 0`
- `status text not null default 'unpaid'`
- `interest_type text not null default 'none'`
- `interest_rate numeric(8,4) null`
- `tenor_months integer null`
- `description text null`
- `notes text null`
- `created_by_user_id uuid null references profiles(user_id)`
- `creditor_name_snapshot text null`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `creditor_id -> funding_creditors.id`
- `created_by_user_id -> profiles.user_id`

Constraint yang disarankan:
- `check (status in ('unpaid','paid','partial','cancelled'))`
- `check (interest_type in ('none','interest'))`

Mapping penting:
- Firebase `totalAmount` -> `principal_amount`
- Firebase `totalRepaymentAmount` -> `repayment_amount`

**Table: `loan_payments`**

- `loan_id uuid not null references loans(id)`
- `payment_date date not null`
- `amount numeric(16,2) not null`
- `description text null`
- `attachment_file_id uuid null references file_assets(id)`
- `created_by_user_id uuid null references profiles(user_id)`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `loan_id -> loans.id`
- `attachment_file_id -> file_assets.id`
- `created_by_user_id -> profiles.user_id`

**Table: `expenses`**

- `project_id uuid not null references projects(id)`
- `supplier_id uuid null references suppliers(id)`
- `category_id uuid null references expense_categories(id)`
- `expense_type text not null`
- `document_type text not null`
- `status text not null`
- `expense_date date not null`
- `description text not null`
- `notes text null`
- `amount numeric(16,2) not null`
- `created_by_user_id uuid null references profiles(user_id)`
- `project_name_snapshot text null`
- `supplier_name_snapshot text null`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `project_id -> projects.id`
- `supplier_id -> suppliers.id`
- `category_id -> expense_categories.id`
- `created_by_user_id -> profiles.user_id`

Constraint yang disarankan:
- `check (expense_type in ('material','operasional','lainnya'))`
- `check (document_type in ('faktur','surat_jalan'))`
- `check (status in ('unpaid','paid','delivery_order','cancelled'))`

**Table: `expense_line_items`**

- `expense_id uuid not null references expenses(id)`
- `material_id uuid null references materials(id)`
- `item_name text not null`
- `qty numeric(14,3) not null`
- `unit_price numeric(16,2) not null default 0`
- `line_total numeric(16,2) not null default 0`
- `sort_order integer not null default 1`

PK:
- `id`

FK:
- `expense_id -> expenses.id`
- `material_id -> materials.id`

Mapping penting:
- berasal dari array `expenses.items[]`

**Table: `expense_attachments`**

- `expense_id uuid not null references expenses(id)`
- `file_asset_id uuid not null references file_assets(id)`
- `sort_order integer not null default 1`

PK:
- `id`

FK:
- `expense_id -> expenses.id`
- `file_asset_id -> file_assets.id`

**Table: `bills`**

- `expense_id uuid null references expenses(id)`
- `worker_id uuid null references workers(id)`
- `staff_id uuid null references staff(id)`
- `project_id uuid null references projects(id)`
- `supplier_id uuid null references suppliers(id)`
- `bill_type text not null`
- `description text not null`
- `amount numeric(16,2) not null`
- `paid_amount numeric(16,2) not null default 0`
- `due_date date not null`
- `status text not null default 'unpaid'`
- `paid_at timestamptz null`
- `period_start date null`
- `period_end date null`
- `supplier_name_snapshot text null`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `expense_id -> expenses.id`
- `worker_id -> workers.id`
- `staff_id -> staff.id`
- `project_id -> projects.id`
- `supplier_id -> suppliers.id`

Constraint yang disarankan:
- `check (bill_type in ('material','operasional','lainnya','gaji','fee'))`
- `check (status in ('unpaid','partial','paid','cancelled'))`

Mapping penting:
- bill gaji saat ini berasal dari absensi pekerja dan satu bill umumnya mewakili satu pekerja
- `workerDetails[]` dan `recordIds[]` tidak perlu dipertahankan sebagai JSON

**Table: `bill_payments`**

- `bill_id uuid not null references bills(id)`
- `worker_id uuid null references workers(id)`
- `payment_date date not null`
- `amount numeric(16,2) not null`
- `recipient_name text null`
- `description text null`
- `attachment_file_id uuid null references file_assets(id)`
- `created_by_user_id uuid null references profiles(user_id)`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `bill_id -> bills.id`
- `worker_id -> workers.id`
- `attachment_file_id -> file_assets.id`
- `created_by_user_id -> profiles.user_id`

Catatan:
- untuk salary bill saat ini `worker_id` penting agar kwitansi individual tetap bisa dicetak

**Table: `attendance_records`**

- `worker_id uuid not null references workers(id)`
- `project_id uuid not null references projects(id)`
- `salary_bill_id uuid null references bills(id)`
- `attendance_date date not null`
- `entry_mode text not null`
- `attendance_status text not null`
- `job_role_name text null`
- `check_in_at timestamptz null`
- `check_out_at timestamptz null`
- `work_hours numeric(6,2) null`
- `normal_hours numeric(6,2) null`
- `overtime_hours numeric(6,2) null`
- `daily_wage numeric(16,2) null`
- `hourly_wage numeric(16,2) null`
- `custom_wage numeric(16,2) null`
- `total_pay numeric(16,2) not null default 0`
- `billing_status text not null default 'unbilled'`
- `integrity_flag text null`
- `worker_name_snapshot text null`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `worker_id -> workers.id`
- `project_id -> projects.id`
- `salary_bill_id -> bills.id`

Constraint yang disarankan:
- `check (entry_mode in ('manual','timestamp'))`
- `check (attendance_status in ('checked_in','completed','full_day','half_day','absent'))`
- `check (billing_status in ('unbilled','billed','paid'))`

Mapping penting:
- Firebase `billId` -> `salary_bill_id`
- Firebase `isPaid` lebih baik diganti `billing_status`

**Table: `stock_transactions`**

- `material_id uuid not null references materials(id)`
- `project_id uuid null references projects(id)`
- `expense_id uuid null references expenses(id)`
- `transaction_date date not null`
- `direction text not null`
- `source_type text not null`
- `quantity numeric(14,3) not null`
- `price_per_unit numeric(16,2) null`
- `notes text null`
- `created_by_user_id uuid null references profiles(user_id)`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `material_id -> materials.id`
- `project_id -> projects.id`
- `expense_id -> expenses.id`
- `created_by_user_id -> profiles.user_id`

Constraint yang disarankan:
- `check (direction in ('in','out'))`
- `check (source_type in ('invoice','delivery_order','manual_adjustment','usage'))`

#### E. Collaboration, reporting config, and administrative data

**Table: `comments`**

- `entity_type text not null`
- `entity_id uuid not null`
- `reply_to_comment_id uuid null references comments(id)`
- `user_id uuid not null references profiles(user_id)`
- `user_name_snapshot text null`
- `content text not null`
- `metadata jsonb null`
- `is_edited boolean not null default false`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `reply_to_comment_id -> comments.id`
- `user_id -> profiles.user_id`

Catatan:
- `entity_type + entity_id` menggantikan `parentType + parentId`
- ini tetap model polymorphic; integritas target entity dikelola aplikasi

**Table: `notifications`**

- `recipient_user_id uuid null references profiles(user_id)`
- `message text not null`
- `notification_type text not null`
- `payload jsonb null`
- `read_at timestamptz null`
- `created_by_user_id uuid null references profiles(user_id)`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `recipient_user_id -> profiles.user_id`
- `created_by_user_id -> profiles.user_id`

Catatan:
- `recipient_user_id null` dapat dipakai untuk global notification

**Table: `activity_logs`**

- `actor_user_id uuid null references profiles(user_id)`
- `action text not null`
- `action_type text not null`
- `entity_type text null`
- `entity_id uuid null`
- `status text null`
- `operation text null`
- `details jsonb null`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `actor_user_id -> profiles.user_id`

**Table: `pdf_settings`**

- `team_id uuid primary key references teams(id)`
- `header_color text null`
- `header_logo_file_id uuid null references file_assets(id)`
- `footer_logo_file_id uuid null references file_assets(id)`
- `company_name text null`
- `address text null`
- `phone text null`
- `extra jsonb null`
- `updated_by_user_id uuid null references profiles(user_id)`
- `updated_at timestamptz not null default now()`

PK:
- `team_id`

FK:
- `team_id -> teams.id`
- `header_logo_file_id -> file_assets.id`
- `footer_logo_file_id -> file_assets.id`
- `updated_by_user_id -> profiles.user_id`

**Table: `beneficiaries`**

- `nama_penerima text not null`
- `nik text null`
- `jenis_kelamin text null`
- `jenjang text null`
- `nama_instansi text null`
- `npsn_nspp text null`
- `jarak_meter integer null`
- `data_status text null`
- `tempat_lahir text null`
- `tanggal_lahir date null`
- `district text null`
- `sub_district text null`
- `village text null`
- `hamlet text null`
- `rt text null`
- `rw text null`
- `alamat_lengkap text null`

PK:
- `id`

FK:
- `team_id -> teams.id`

Constraint yang disarankan:
- `unique(team_id, nik)` untuk record yang memiliki NIK

Catatan:
- saya menyarankan data ini menjadi team-scoped di schema baru agar tidak mengulang leakage collection global `penerimaManfaat`

**Table: `hrd_applicants`**

- `source_beneficiary_id uuid null references beneficiaries(id)`
- `nama_lengkap text not null`
- `email text null`
- `no_telepon text null`
- `jenis_kelamin text null`
- `nik text null`
- `no_kk text null`
- `tempat_lahir text null`
- `tanggal_lahir date null`
- `pendidikan_terakhir text null`
- `nama_institusi_pendidikan text null`
- `jurusan text null`
- `posisi_dilamar text null`
- `sumber_lowongan text null`
- `status_aplikasi text null`
- `pengalaman_kerja text null`
- `skills text null`
- `district text null`
- `sub_district text null`
- `village text null`
- `hamlet text null`
- `rt text null`
- `rw text null`
- `alamat_lengkap text null`
- `alamat_domisili text null`
- `catatan_hrd text null`

PK:
- `id`

FK:
- `team_id -> teams.id`
- `source_beneficiary_id -> beneficiaries.id`

Constraint yang disarankan:
- `unique(team_id, nik)` untuk record yang memiliki NIK

**Table: `hrd_applicant_documents`**

- `applicant_id uuid not null references hrd_applicants(id)`
- `document_type text not null`
- `file_asset_id uuid not null references file_assets(id)`

PK:
- `id`

FK:
- `applicant_id -> hrd_applicants.id`
- `file_asset_id -> file_assets.id`

Constraint yang disarankan:
- `check (document_type in ('cv','ktp','kk','pas_foto','surat_sehat','other'))`

### 3.5 View SQL yang disarankan

**View: `vw_billing_stats`**

Menggantikan `teams/main/statistics/billing`.

Isi derivasi:
- total outstanding bill
- total paid bill
- total bill count
- total outstanding salary bill

**View: `vw_cash_mutation`**

Menggantikan kebutuhan mutasi yang saat ini menggabungkan:
- `project_incomes`
- `loans`
- `bill_payments`
- `loan_payments`

**View: `vw_project_financial_summary`**

Mendukung halaman `laporan`:
- revenue per project
- expense by type
- wages paid/unpaid
- gross/net profit

### 3.6 Transformasi data yang wajib saat migrasi

1. `workers.projectWages` dipecah menjadi banyak row di `worker_wage_rates`.
2. `expenses.items[]` dipecah menjadi row di `expense_line_items`.
3. `bills/{billId}/payments` dipindah ke `bill_payments`.
4. `funding_sources/{loanId}/payments` dipindah ke `loan_payments`.
5. `attendance_records.billId` dipetakan ke `attendance_records.salary_bill_id`.
6. `bills.workerDetails[]` tidak perlu dipertahankan sebagai JSON; worker salary dapat diturunkan dari `bills.worker_id` dan `attendance_records`.
7. `attachments`, `attachmentUrl`, dan URL dokumen HRD dipindah ke metadata `file_assets` + relation table.
8. `projectName`, `supplierName`, `creditorName`, `workerName` bisa:
   - dihapus dan diganti join penuh, atau
   - dipertahankan sebagai snapshot field bila tim ingin invoice/histori tidak berubah saat master data rename.

## 4. Core Business Logic & Features

- **Auth & session bootstrap**: login via Google popup, lalu session menginisialisasi membership, master data, local DB, sync, realtime listener, notifikasi, dan redirect ke halaman aktif terakhir.
- **Dashboard**: menampilkan KPI pemasukan, pengeluaran, tagihan, pinjaman, pekerja aktif, hari kerja, upah lunas/belum lunas, serta ringkasan anggaran proyek dan chart.
- **Pemasukan termin proyek**: user memilih proyek, tanggal, nominal; data disimpan ke `incomes`; form juga menghitung preview alokasi fee staf berdasarkan rule staff.
- **Fee staf per termin**: rule fee staf (`per_termin` / `fixed_per_termin`) sudah dimodelkan di master data dan dipreview di form pemasukan, tetapi jalur pembentukan tagihan fee otomatis tidak sejelas flow tagihan lain di service layer yang diaudit.
- **Pinjaman/modal masuk**: user memilih kreditur, tanggal, nominal, bunga/tenor; sistem menghitung `totalRepaymentAmount`, status unpaid, dan histori pembayaran pinjaman.
- **Pengeluaran operasional/lainnya**: user memilih proyek, supplier, kategori, deskripsi, nominal, tanggal; sistem membuat `expense` dan otomatis membuat `bill`.
- **Faktur material**: user dapat memasukkan banyak item material; tiap item punya material, qty, harga, subtotal; total `expense.amount` adalah penjumlahan line item; sistem juga membuat tagihan dan update stok masuk.
- **Surat jalan material**: mode khusus material tanpa nominal invoice; item tetap dicatat, stok langsung keluar, dan item muncul pada tab `surat_jalan`.
- **Lampiran transaksi**: pengeluaran dan pembayaran mendukung upload file/image; saat ini file diunggah ke Cloudinary dan metadata URL disimpan ke dokumen transaksi.
- **Tagihan & pembayaran**: tab tagihan memisahkan `unpaid`, `paid`, dan `surat_jalan`; pembayaran update `paidAmount`, `status`, dan menulis record `payments`.
- **Mutasi kas**: halaman mutasi menggabungkan termin proyek, pinjaman, dan semua pembayaran dari collectionGroup `payments`.
- **Absensi pekerja**: mendukung manual attendance dan timestamp flow; menghitung role, wage, totalPay, dan mencegah bentrok kehadiran pada proyek lain di tanggal yang sama.
- **Jurnal & rekap gaji**: absensi yang belum dibayar dapat dibundel menjadi bill gaji per pekerja; saat bill dibuat, attendance record ditandai terhubung ke bill.
- **Stok**: menyimpan master material, stok saat ini, histori stok masuk dari faktur, dan stok keluar dari surat jalan/penggunaan.
- **Laporan**: membuat banyak output PDF, termasuk laba rugi, cost analysis, material by supplier, project health, accounting summary, invoice detail, attendance report, dan simulation report.
- **Simulasi pembayaran**: user menginput dana tersedia, memilih atau auto-select tagihan/pinjaman yang ingin dialokasikan, lalu dapat mengunduh simulasi sebagai PDF.
- **File Storage / Beneficiary DB**: CRUD, filter, impor XLSX/CSV, ekspor CSV/XLSX/PDF untuk data `penerimaManfaat`.
- **HRD Applicants**: CRUD, filter status, impor/ekspor, lampiran dokumen, dan status pipeline HR seperti `Screening`, `Interview HR`, `Offering`, `Diterima`, `Ditolak`.
- **Recycle bin**: soft delete untuk master data dan transaksi, termasuk logika restore untuk item terkait.
- **Admin tools**: manual push sync, repair data, orphan loan restore, integrity check, cleanup server, dan utilitas maintenance lain.

### Validasi bisnis yang tampak jelas di repo

- nominal pembayaran harus lebih dari nol
- pengeluaran material harus memiliki minimal satu item valid
- pengeluaran non-surat-jalan harus bernilai positif
- rekap gaji hanya bisa dibuat dari attendance record yang belum dibayar
- salary bill tidak bisa dibatalkan bila sudah punya riwayat pembayaran
- import beneficiary dan applicant mencoba dedupe berdasarkan `nik`

## 5. Auth Flow

### 5.1 Cara login Firebase berjalan saat ini

1. User login menggunakan `signInWithPopup()` dengan `GoogleAuthProvider`.
2. Firebase Auth persistence diset ke `browserLocalPersistence`.
3. Saat `onAuthStateChanged` aktif:
   - user profile disimpan ke `appState`
   - app mengecek `/users/{uid}` untuk membaca/menormalkan role
4. App lalu membaca `teams/main/members/{uid}`.
5. Jika dokumen membership belum ada:
   - jika email sama dengan `OWNER_EMAIL`, user otomatis dibuat sebagai `Owner` dan `active`
   - selain itu dibuat sebagai `Viewer` dengan status `pending`
6. Role dan status final diambil dari dokumen `members/{uid}`, bukan dari Firebase Auth.
7. App memasang realtime listener ke `members/{uid}` agar perubahan role/status langsung merender ulang UI.
8. Jika role `Owner`, app juga memantau user pending approval.
9. Setelah auth berhasil, app:
   - memastikan master data tersedia
   - memuat Dexie local DB
   - sync awal dari server
   - subscribe realtime data
   - subscribe notification
   - hitung dashboard
   - minta izin notifikasi
   - navigasi ke halaman terakhir

### 5.2 Implikasi untuk target Telegram ID + Supabase Auth

Struktur saat ini memisahkan tiga konsep:

- **identity**: Firebase Auth user
- **profile/role fallback**: `/users/{uid}`
- **authorization/team access**: `teams/main/members/{uid}`

Untuk rewrite baru, struktur ini sebaiknya dipadatkan menjadi:

- `auth.users`
- `profiles`
  - menyimpan `telegram_user_id`
  - display name, avatar, email bila ada
- `team_members`
  - menyimpan role dan status akses

### 5.3 Skema auth yang saya sarankan untuk versi baru

- Telegram WebApp `initData` divalidasi di Vercel Serverless
- hasil validasi digunakan untuk login Supabase:
  - opsi A: custom JWT / custom auth bridge
  - opsi B: identity mapping server-side lalu issue session Supabase
- `profiles.telegram_user_id bigint unique` menjadi pengganti utama identitas eksternal
- `team_members.status` mempertahankan flow approval saat ini bila masih dibutuhkan
- seluruh RLS mengacu ke `team_members`, bukan ke klaim role mentah

## 6. Deep Dive - Fitur Invoice & Print

### 6.1 Invoice detail saat ini

Flow invoice detail saat ini berasal dari transaksi `expense` tipe material.

Data yang ditarik:

- `expense.items[]`
- `expense.amount`
- `expense.date`
- `expense.supplierName` atau join ke supplier
- `expense.projectId` untuk mencari nama proyek

Struktur item invoice yang dipakai:

- `name`
- `qty`
- `price`
- `total`
- `materialId`

Kalkulasi:

- subtotal per baris = `qty * price`
- total invoice = penjumlahan seluruh subtotal
- nilai total akhir ditampilkan dari `expense.amount`

Output:

- modal detail invoice menampilkan supplier, tanggal, item list, dan total
- `downloadInvoiceDetailPdf(expense)` membuat PDF client-side memakai `jsPDF` + `autoTable`
- filename dibentuk dari supplier dan tanggal

Catatan penting:

- invoice detail saat ini bukan hasil render server-side
- kebenaran data bergantung pada field denormalized di `expense`
- tidak ada versi dokumen yang immutable di backend

### 6.2 Kwitansi/print pembayaran saat ini

Fitur print saat ini sebenarnya lebih dekat ke **kwitansi pembayaran** daripada invoice final.

Sumber data:

- `bill`
- `bill.paidAmount`
- `bill.status`
- `bill.paidAt`
- `bill.description`
- `bills/{billId}/payments`
- `pending_payments` lokal bila offline

Logika penerima:

- bill gaji:
  - memakai `bill.workerDetails[0].name` bila satu pekerja
  - memakai `"Beberapa Pekerja"` bila multi worker
  - fallback ke worker master bila data lama
- bill non-gaji:
  - resolve dari `bill.expenseId -> expense.supplierId -> supplier.supplierName`

Isi kwitansi:

- nomor kwitansi
- tanggal
- nama penerima
- deskripsi pembayaran
- jumlah nominal
- terbilang
- status `LUNAS` / `BELUM LUNAS`
- total tagihan dan sisa tagihan
- nama pencetak
- QR sederhana berbasis email user
- logo header/footer dari asset statis

Format output:

- A6 portrait
- bisa diunduh sebagai PDF atau JPG
- dirender via HTML tersembunyi -> `html2canvas` -> `jsPDF`

### 6.3 Kwitansi individual dan kolektif

Repo saat ini mendukung:

- kwitansi satu bill
- kwitansi individual untuk worker tertentu pada bill gaji
- kwitansi kolektif multi-halaman untuk sekumpulan pembayaran gaji

Khusus kolektif, sistem:

1. menggabungkan payment history server + pending lokal
2. mengelompokkan pembayaran per `workerId`
3. menghitung nominal terbayar per pekerja
4. membuat satu halaman A6 per pekerja di PDF kolektif

### 6.4 Implikasi untuk rewrite auto-generate PDF

Untuk versi baru, fitur ini sebaiknya diubah menjadi server-generated artifact:

- source of truth berasal dari SQL tables:
  - `expenses`
  - `expense_line_items`
  - `bills`
  - `bill_payments`
  - `loan_payments`
- template PDF dibangkitkan di serverless function
- metadata PDF final bisa disimpan ke `file_assets`
- invoice PDF dan receipt PDF sebaiknya memiliki nomor dokumen yang stabil, snapshot data yang immutable, dan histori regenerasi bila template berubah

## Penutup Audit

Kesimpulan utama audit:

- aplikasi saat ini sudah kaya fitur, tetapi model data Firebase sangat denormalized dan bercampur dengan concern offline sync
- transaksi keuangan, payroll, dan invoice/receipt dapat dipindah dengan aman ke PostgreSQL bila child structures dipisah menjadi tabel relasional
- boundary tenant/auth perlu dibersihkan sejak awal rewrite
- area paling kritis untuk migrasi schema adalah:
  - `workers.projectWages`
  - `expenses.items[]`
  - `bills` + subcollection `payments`
  - `funding_sources` + subcollection `payments`
  - `attendance_records <-> bills`
  - URL attachment/dokumen ke model storage metadata yang rapi
