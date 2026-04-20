# Banplex Greenfield App Flow, Core Feature, and Architecture Audit

Plan date: `2026-04-18`  
Repository: `Banplex Greenfield`  
Audit basis: repo code, route tree, stores, API handlers, Supabase migrations, and existing planning docs in `docs/`  
Scope rule: repo audit only; no application code changes

## 1. Judul dan tujuan dokumen

Dokumen ini adalah handoff strategis berbasis repo aktual untuk menjawab lima hal:

1. aplikasi ini sebenarnya sudah sampai mana,
2. core feature apa yang benar-benar ada,
3. keputusan produk/arsitektur apa yang masih belum final,
4. pertanyaan apa yang harus dijawab agar PRD matang,
5. urutan micro task paling aman agar development berbasis AI tidak liar.

Dokumen ini sengaja memakai sudut pandang `repo-first`. Semua kesimpulan diturunkan dari area seperti `src/App.jsx`, `src/pages/*`, `src/store/*`, `src/lib/*`, `api/*.js`, `supabase/migrations/*`, serta dokumen aktif seperti `docs/prd-core-feature-release-2026-04-18.md` dan `docs/integration-readiness-plan-2026-04-17.md`.

## 2. Executive summary

`Banplex Greenfield` bukan lagi prototipe kosong. Repo ini sudah berbentuk `Telegram Mini Web App` operator dashboard yang cukup besar, dengan auth Telegram -> Supabase, multi-workspace membership, role gating, ledger, pembayaran, master data, absensi, payroll, HRD, beneficiary, attachment, recycle bin, report proyek, dan notifikasi Telegram.

Masalah utamanya bukan “fitur belum ada sama sekali”, tetapi:

1. source of truth lintas domain belum sepenuhnya tegas,
2. boundary frontend store -> API handler -> direct Supabase client masih campur,
3. beberapa keputusan produk penting masih kalah cepat oleh implementasi,
4. ada file dan jalur legacy yang berpotensi menyesatkan AI assistant,
5. release contract per domain belum dibakukan menjadi boundary eksekusi yang aman.

Status paling akurat untuk repo saat ini adalah:

> `late integration-stage operational workspace`, belum `release-ready`.

Ini berarti fondasi produk sudah nyata dan usable untuk banyak flow, tetapi masih terlalu ambigu untuk menjadi landasan planning/implementasi lanjutan tanpa kontrak yang lebih keras.

## 3. Snapshot kondisi repo saat ini

### 3.1 Ringkasan kondisi aktual

| Area | Temuan repo aktual | Evidence |
| --- | --- | --- |
| App runtime | React + Vite SPA dengan `BrowserRouter`, mobile shell, Telegram WebApp SDK hook | `src/main.jsx`, `src/App.jsx`, `src/hooks/useTelegram.js` |
| State | Domain store per area memakai Zustand | `src/store/*` |
| Styling | Tailwind + CSS variable tokens + fallback tema Telegram | `src/index.css`, `src/components/ui/AppPrimitives.jsx` |
| Backend | Vercel serverless functions untuk `auth`, `transactions`, `records`, `notify` | `api/auth.js`, `api/transactions.js`, `api/records.js`, `api/notify.js` |
| Database | Supabase dengan migrasi relasional cukup luas, RLS, trigger, view, dan RPC | `supabase/migrations/*` |
| Product shape | Operator workspace finansial-operasional + HR/admin + team invite | `src/pages/*`, `src/components/*`, `docs/prd-core-feature-release-2026-04-18.md` |
| Testing | Tidak ada test suite yang terdeteksi di `package.json`; validasi repo mengandalkan `lint` dan `build` | `package.json` |

### 3.2 Struktur folder yang paling menentukan arsitektur

| Folder / file | Fungsi aktual |
| --- | --- |
| `src/App.jsx` | root flow auth, route tree, entry screen gating |
| `src/pages/*` | screen utama operator |
| `src/components/*` | feature components, forms, layout shell, reusable UI |
| `src/store/*` | state, orchestration, dan sebagian data access |
| `src/lib/*` | API client, formatting, business rule helper, auth context |
| `api/*` | server boundary untuk auth, transaksi, records, notifikasi |
| `supabase/migrations/*` | schema final-ish, trigger, RPC, RLS, read models |
| `docs/*` | planning dan handoff yang sudah mulai menggeser repo ke model relasional final |

### 3.3 Dependency yang memengaruhi arsitektur

| Dependency | Dampak arsitektur |
| --- | --- |
| `react-router-dom` | app dipetakan sebagai routed mobile workspace, bukan sekadar modal stack |
| `zustand` | state orchestration tipis dan mudah dipecah per domain, tetapi rawan coupling antar store bila boundary tidak keras |
| `@supabase/supabase-js` | memungkinkan direct client DB/storage access; ini yang membuat boundary masih campur |
| `framer-motion` | animasi shell, sheet, dan route transition jadi bagian nyata dari UI architecture |
| `jspdf` | ada Telegram notification PDF, tetapi belum sama dengan user-facing PDF settings flow |
| `lucide-react` | icon system konsisten untuk operator UI |

### 3.4 Kondisi dokumentasi yang relevan

| Dokumen | Status terhadap repo aktual |
| --- | --- |
| `README.md` | tertinggal; masih template Vite, bukan representasi produk |
| `docs/prd-core-feature-release-2026-04-18.md` | paling dekat dengan arah produk yang sekarang |
| `docs/integration-readiness-plan-2026-04-17.md` | penting untuk membaca niat deprecate jalur legacy dan mengunci source of truth |
| `docs/unified-crud-workspace-plan-2026-04-18.md` | backlog aktif lintas domain yang sudah cukup granular |
| `docs/ai-workflow/repo-assessment.md` | boundary kerja Codex yang lebih akurat daripada `README.md` |

### 3.5 Kesimpulan snapshot

- Repo sudah punya fondasi operasional nyata.
- Repo belum punya kontrak release yang cukup tegas untuk menghindari drift antara code, docs, dan task AI.
- Risiko terbesar bukan “kurang fitur”, tetapi “fitur ada dalam model campuran dan keputusan yang belum dibakukan”.

## 4. Peta arsitektur sistem saat ini

### 4.1 Peta lapisan sistem

```text
Telegram Mini App
  -> src/hooks/useTelegram.js
  -> src/App.jsx
  -> useAuthStore.initializeTelegramAuth()
  -> /api/auth
  -> Supabase Auth + profiles + team_members + invite_tokens

Authenticated Web UI
  -> src/pages/*
  -> src/components/*
  -> Zustand stores (src/store/*)

Data access split
  -> Server API boundary
     - /api/transactions
     - /api/records
     - /api/notify
  -> Direct Supabase client
     - tables
     - storage
     - rpc

Supabase layer
  -> relational tables
  -> soft delete columns
  -> SQL views
  -> trigger automation
  -> role/team RLS
```

### 4.2 Product architecture saat ini

| Product slice | Bentuk aktual di repo | Catatan |
| --- | --- | --- |
| Workspace auth | Telegram-first, team membership gated | Browser fallback bukan product flow utama |
| Core ops finance | pemasukan proyek, pengeluaran, pinjaman, tagihan, pembayaran | paling matang |
| Core ops execution | absensi, salary bill, material invoice / surat jalan | cukup matang tetapi status contract belum final |
| Reference/admin | master data, team invite, role control | nyata dan cukup luas |
| Side modules | HRD applicants, beneficiaries | sudah ada, tetapi tidak jelas apakah core release atau supporting module |
| Reporting | project financial summary + detail | ada, tetapi belum menyapu seluruh domain operasional |
| Settings | team invite ada; `pdf_settings` ada di schema tetapi belum jadi UI flow | boundary admin/settings belum lengkap |

### 4.3 Frontend architecture saat ini

| Layer | Implementasi aktual | Risiko |
| --- | --- | --- |
| App root | `src/App.jsx` sebagai auth gate + route declaration | banyak keputusan produk terkonsentrasi di route tree |
| Page layer | `src/pages/*` untuk screen-level orchestration | cukup bersih |
| Feature component layer | form/manager/report domain di `src/components/*` | ada campuran routed form vs sheet CRUD |
| Store layer | satu store per domain utama | cross-refresh dan hybrid data access membuat reasoning AI lebih sulit |
| Utility layer | `src/lib/*` menyimpan API client, business rule, presentation rule | bagus, tetapi tidak semua rule sudah terkonsolidasi |

### 4.4 Backend/API integration surface saat ini

| Surface | Tanggung jawab aktual | Catatan |
| --- | --- | --- |
| `/api/auth` | verifikasi Telegram initData, bootstrap profile/session/team access, owner bypass, invite redeem | boundary auth paling jelas |
| `/api/transactions` | workspace ledger, summary, project income, loan, recycle bin transaction-ish domain, loan payment update/delete/restore | sudah penting, tetapi masih coexist dengan jalur direct Supabase |
| `/api/records` | bills, bill payments, expenses, material invoices, attendance, reports, attachments | boundary kedua yang besar |
| `/api/notify` | side effect Telegram bot + PDF/text notification | bukan source of truth bisnis |

### 4.5 Supabase contract saat ini

Domain yang nyata di migrasi:

- workspace/access: `teams`, `team_members`, `profiles`, `invite_tokens`
- finance: `transactions`, `project_incomes`, `expenses`, `expense_line_items`, `bills`, `bill_payments`, `loans`, `loan_payments`
- operations: `workers`, `worker_wage_rates`, `attendance_records`, `stock_transactions`
- reference: `projects`, `suppliers`, `expense_categories`, `funding_creditors`, `professions`, `staff`, `materials`
- file/document: `file_assets`, `expense_attachments`, `hrd_applicant_documents`
- people/admin: `beneficiaries`, `hrd_applicants`
- views/rpc: `vw_cash_mutation`, `vw_transaction_summary`, `vw_project_financial_summary`, `fn_generate_salary_bill`, `fn_redeem_invite_token`, `fn_upsert_worker_with_wages`, `fn_soft_delete_worker`

### 4.6 Arsitektur yang paling perlu diperhatikan

1. `transactions` belum sepenuhnya keluar dari model aktif:
   - `src/store/useTransactionStore.js` masih punya `submitTransaction()` yang menulis langsung ke `transactions`
   - `supabase/migrations/20260411190000_setup_telegram_auth_rbac_rls.sql` membuat `vw_transaction_summary` sebagai union `transactions` + `vw_cash_mutation`
   - implikasi: summary kas final belum 100% bebas legacy
2. Boundary write masih hybrid:
   - project income dan loan create/update/delete lewat `/api/transactions`
   - expense/material invoice lewat `/api/records`
   - payment create masih direct `supabase.from(...)` di `src/store/usePaymentStore.js`
   - master, HRD, team invite, file assets banyak direct Supabase client
3. Ada layer read model yang sudah baik (`vw_cash_mutation`, `vw_project_financial_summary`), tetapi adoption-nya belum seragam di semua UI/store.

## 5. Peta app flow aktual

### 5.1 Entry flow utama

| Flow | Status | Evidence | Catatan |
| --- | --- | --- | --- |
| Telegram membuka Mini App | implemented | `src/hooks/useTelegram.js`, `src/App.jsx` | app membaca `initData`, `user`, `startParam` |
| WebApp ready + expand | implemented | `src/App.jsx` | `tg.ready()` dan `tg.expand()` dipanggil pada mount |
| Telegram auth bootstrap | implemented | `src/store/useAuthStore.js`, `api/auth.js` | auth diverifikasi server-side |
| Invite redemption via `start_param` | implemented | `src/hooks/useTelegram.js`, `src/store/useAuthStore.js`, `api/auth.js`, `fn_redeem_invite_token` | deep link onboarding nyata |
| Workspace access gating | implemented | `src/App.jsx`, `src/store/useAuthStore.js` | tanpa membership aktif user berhenti di `UnregisteredScreen` |

### 5.2 Navigation flow utama

| Screen / route | Status | Evidence | Peran aktual |
| --- | --- | --- | --- |
| `/` | implemented | `src/pages/Dashboard.jsx` | home dashboard operasional |
| `/transactions` | implemented | `src/pages/TransactionsPage.jsx` | ledger/workspace utama |
| `/projects` | implemented | `src/pages/ProjectsPage.jsx` | report proyek |
| `/master` | implemented | `src/pages/MasterPage.jsx` | master data admin |
| `/more` | implemented | `src/pages/MorePage.jsx` | hub modul samping |
| `/attendance/new` | implemented | `src/pages/AttendancePage.jsx` | form absensi harian |
| `/material-invoice/new` | implemented | `src/pages/MaterialInvoicePage.jsx` | create faktur/surat jalan |
| `/edit/:type/:id` | implemented | `src/pages/EditRecordPage.jsx` | create/edit record by type |
| `/payment/:id`, `/loan-payment/:id` | implemented | `src/pages/PaymentPage.jsx` | payment workspace |

### 5.3 Flow operator dari dashboard

Flow aktual:

1. User masuk ke dashboard.
2. Dashboard refresh empat sumber data sekaligus:
   - summary + cash mutation dari `useDashboardStore`
   - unpaid bills dari `useBillStore`
   - loans dari `useIncomeStore`
   - project summaries dari `useReportStore`
3. Dashboard menampilkan:
   - saldo kas,
   - profit ringkas,
   - tagihan aktif,
   - pinjaman aktif,
   - quick actions,
   - recent unified items.

Evidence:

- `src/pages/Dashboard.jsx`
- `src/store/useDashboardStore.js`
- `src/store/useBillStore.js`
- `src/store/useIncomeStore.js`
- `src/store/useReportStore.js`

Status: `implemented but composite`.

Catatan penting:

- “recent activity” dashboard bukan read model tunggal; ia merupakan gabungan client-side dari `cashMutations`, `bills`, dan `loans`.
- artinya dashboard feed dan ledger page bukan dua tampilan dari source tunggal yang sama.

### 5.4 Flow create record aktual

| Entry | Target route | Status | Evidence | Catatan |
| --- | --- | --- | --- | --- |
| Bottom FAB / dashboard action “Pemasukan” | `/edit/project-income/new` | implemented | `src/components/ui/BottomNav.jsx`, `src/pages/Dashboard.jsx` | routed form |
| “Pengeluaran” | `/edit/expense/new` | implemented | `src/components/ui/BottomNav.jsx`, `src/pages/Dashboard.jsx` | create expense operasional |
| “Pinjaman” | `/edit/loan/new` | implemented | `src/components/ui/BottomNav.jsx`, `src/pages/Dashboard.jsx` | routed form |
| “Absensi” | `/attendance/new` | implemented | `src/components/ui/BottomNav.jsx`, `src/pages/Dashboard.jsx` | separate page |
| “Faktur” | `/material-invoice/new` | implemented | `src/components/ui/BottomNav.jsx` | separate page |
| “Master” | `/master` then tab action | implemented | `src/pages/MasterPage.jsx`, `src/pages/MasterFormPage.jsx` | admin-only |

### 5.5 Flow ledger -> detail -> edit/pay/delete

Flow aktual:

1. User membuka `/transactions`.
2. Page memuat ledger secara server-side paginated melalui `/api/transactions?view=workspace`.
3. User dapat:
   - cari,
   - filter source type,
   - buka detail,
   - buka edit,
   - buka payment,
   - delete/archive.
4. Detail page meng-hydrate child record bila perlu:
   - `bill`
   - `bill_payments`
   - `loan_payments`
   - `material invoice items`
   - `attachments`
5. Dari detail, user dapat lanjut ke `EditRecordPage` atau `PaymentPage`.

Evidence:

- `src/pages/TransactionsPage.jsx`
- `src/lib/transactions-api.js`
- `api/transactions.js`
- `src/pages/TransactionDetailPage.jsx`
- `src/lib/transaction-presentation.js`

Status: `implemented`.

Catatan:

- ini adalah flow paling dekat ke “workspace utama”.
- tetapi “detail/edit capability matrix” belum sepenuhnya seragam untuk semua `sourceType`.

### 5.6 Flow expense/material invoice/attachment aktual

| Flow | Status | Evidence | Catatan |
| --- | --- | --- | --- |
| Create expense operasional | implemented | `src/components/ExpenseForm.jsx`, `src/store/useTransactionStore.js`, `/api/records` | menulis ke `expenses`, bukan `transactions` |
| Create material invoice / surat jalan | implemented | `src/components/MaterialInvoiceForm.jsx`, `src/store/useTransactionStore.js`, `/api/records` | item child tersimpan ke `expense_line_items` |
| Attachment upload | implemented | `src/components/ExpenseAttachmentSection.jsx`, `src/store/useFileStore.js`, `file_assets`, `expense_attachments` | ada draft, queue, soft delete, restore |
| Draft invoice di session | implemented | `src/components/MaterialInvoiceForm.jsx` | create mode memakai `sessionStorage` |
| Lock edit setelah payment history | implemented | `src/components/MaterialInvoiceForm.jsx` | edit dikunci bila bill sudah punya payment |

Status keseluruhan: `implemented with hardening needed`.

### 5.7 Flow attendance -> payroll -> salary bill aktual

Flow aktual:

1. User mengisi attendance sheet per `tanggal + proyek`.
2. Row absensi memuat worker wage rate dan status multiplier.
3. Record dengan `billing_status = billed` atau `salary_bill_id` menjadi read-only.
4. Payroll page memuat unbilled attendances.
5. Payroll manager mengelompokkan per worker dan memanggil `fn_generate_salary_bill`.
6. Setelah salary bill terbentuk, user diarahkan ke payment flow via `/payment/:billId`.

Evidence:

- `src/components/AttendanceForm.jsx`
- `src/store/useAttendanceStore.js`
- `src/components/PayrollManager.jsx`
- `supabase/migrations/20260411160000_create_attendance_and_salary_billing.sql`

Status: `implemented`.

Gap penting:

- belum ada flow resmi untuk “membuka ulang” attendance yang sudah dibundel menjadi salary bill.

### 5.8 Flow payment aktual

| Flow | Status | Evidence | Catatan |
| --- | --- | --- | --- |
| Bill payment page | implemented | `src/pages/PaymentPage.jsx`, `src/store/usePaymentStore.js` | histori, create, edit, archive payment |
| Loan payment page | implemented | `src/pages/PaymentPage.jsx`, `src/store/usePaymentStore.js` | histori, create, edit, archive |
| Bill archive from payment page | implemented | `src/pages/PaymentPage.jsx`, `src/store/useBillStore.js` | masih model arsip, belum reversal accounting |
| Telegram notification on payment | implemented | `src/store/usePaymentStore.js`, `api/notify.js` | side effect, bukan source of truth |

Status: `implemented but policy-not-final`.

### 5.9 Flow team onboarding dan Telegram responsibility

Yang nyata di repo:

- Telegram dipakai untuk:
  - auth identity,
  - deep link invite onboarding,
  - UI theme sync,
  - haptic feedback,
  - outbound notification.

Yang **tidak** terlihat di repo:

- general bot-driven intake flow,
- bot chat workflow untuk input operasional,
- conversational operator loop di luar Mini App.

Kesimpulan:

> Repo saat ini adalah Telegram Mini App dengan bot sebagai identity + notification surface, bukan bot-centric workflow app.

### 5.10 Flow publish / export / handoff

Temuan:

- ada Telegram notification PDF/text (`api/notify.js`)
- ada `pdf_settings` di schema
- tidak ada UI settings untuk PDF
- tidak ada publish/export/upload package flow terpisah yang terlihat sebagai modul operator
- tidak ada content generation workflow yang nyata di repo

Kesimpulan:

> Flow publish/export/handoff bisnis belum menjadi capability utama di aplikasi ini. Yang sudah ada baru notifikasi Telegram dan sebagian PDF backend-side.

## 6. Daftar core feature dan status maturity

### 6.1 Matriks feature aktual

| Feature | Tujuan user-facing | Evidence utama | Status maturity | Dependency utama | Risk bila dijadikan fondasi tanpa hardening |
| --- | --- | --- | --- | --- | --- |
| Telegram auth + workspace gating | hanya user/team aktif yang masuk workspace | `src/App.jsx`, `src/store/useAuthStore.js`, `api/auth.js` | implemented | Telegram initData, Supabase auth, `team_members` | rendah; ini salah satu area paling jelas |
| Multi-workspace membership + role | kontrol akses per workspace/role | `api/auth.js`, `src/store/useAuthStore.js`, `supabase/migrations/20260411190000_setup_telegram_auth_rbac_rls.sql` | implemented | `profiles`, `team_members`, RLS | rendah-menengah; role matrix UI belum menyapu semua domain |
| Dashboard operational overview | lihat saldo, pending bills, active loans, recent items | `src/pages/Dashboard.jsx` | implemented | summary + bill + loan + report stores | menengah; feed dan summary belum benar-benar satu source |
| Workspace ledger | telusuri aktivitas operasional | `src/pages/TransactionsPage.jsx`, `/api/transactions` | implemented | workspace read model | menengah; delete/edit matrix belum final untuk semua source |
| Project income | catat termin proyek dan fee bill child | `src/components/IncomeForm.jsx`, `src/store/useIncomeStore.js` | implemented | `project_incomes`, `bills`, trigger fee bill | menengah; edit/delete rules tergantung payment child |
| Expense operasional | catat pengeluaran dan bill-nya | `src/components/ExpenseForm.jsx`, `src/store/useTransactionStore.js`, `/api/records` | implemented | `expenses`, `bills`, attachments | menengah; status model dan delete tree perlu dibakukan |
| Material invoice / surat jalan | catat item material per proyek/supplier | `src/components/MaterialInvoiceForm.jsx`, `expense_line_items` | implemented | materials master, bills, attachments | menengah; document semantics belum final |
| Loan | catat pinjaman dan lifecycle pengembalian | `src/components/LoanForm.jsx`, `src/store/useIncomeStore.js`, `src/lib/loan-business.js` | implemented | loans, loan_payments | menengah; late charge policy sudah ada di code tapi belum menjadi produk formal |
| Payment workspace | bayar bill/pinjaman, edit history, archive history | `src/pages/PaymentPage.jsx`, `src/store/usePaymentStore.js` | implemented | bills, bill_payments, loans, loan_payments | tinggi; create path masih direct Supabase, delete semantics masih archive-centric |
| Recycle bin transaksi lintas domain | restore / permanent delete entity terhapus | `src/pages/TransactionsRecycleBinPage.jsx` | implemented | records API, transactions API | menengah-tinggi; coverage lintas domain belum sepenuhnya simetris |
| Attendance daily sheet | input absensi harian mobile-first | `src/components/AttendanceForm.jsx`, `src/store/useAttendanceStore.js` | implemented | workers, wage rates, attendance_records | menengah; reopen/correction flow pasca billing belum final |
| Payroll manager + salary bill | bundel absensi jadi salary bill | `src/components/PayrollManager.jsx`, `fn_generate_salary_bill` | implemented | attendance, bills | menengah; cancel/reopen policy belum final |
| Master data CRUD | referensi proyek, kategori, supplier, pekerja, staff, material, kreditor | `src/components/MasterDataManager.jsx`, `src/store/useMasterStore.js` | implemented | direct Supabase + worker RPC | menengah; direct client writes banyak |
| Team invite + role management | onboarding anggota via deep link | `src/components/TeamInviteManager.jsx`, `src/store/useTeamStore.js` | implemented | invite tokens, team members | rendah-menengah; admin settings boundary belum lengkap |
| HRD applicants | pipeline pelamar + dokumen | `src/components/HrdPipeline.jsx`, `src/store/useHrStore.js` | implemented | hrd_applicants, file_assets | menengah; bukan jelas core release |
| Beneficiaries | CRUD penerima manfaat | `src/components/BeneficiaryList.jsx`, `src/store/useHrStore.js` | implemented | beneficiaries | menengah; domain relation ke core workflow belum tegas |
| Project report | ringkasan dan breakdown profit proyek | `src/components/ProjectReport.jsx`, `/api/records?resource=reports` | partially implemented | `vw_project_financial_summary` | menengah; belum jadi report operasional lintas domain penuh |
| PDF settings | konfigurasi header/footer/logo PDF | `pdf_settings` migration | scaffolded/prepared | file assets, settings UI | tinggi; schema ada, UX tidak ada |
| Payment proof / attachment beyond expense | bukti pembayaran dan dokumen lain | sebagian tersirat | `file_assets`, `expense_attachments`, HRD docs | scaffolded/prepared | tinggi; belum seragam lintas domain |

### 6.2 Klasifikasi maturity yang lebih tegas

#### Implemented

- Telegram auth + workspace gating
- dashboard operasional dasar
- ledger workspace
- pemasukan proyek
- pengeluaran operasional
- material invoice / surat jalan
- pinjaman
- bill payment dan loan payment
- attendance sheet
- payroll manager + salary bill generation
- master data CRUD
- team invite
- recycle bin utama

#### Partially implemented

- reporting operasional
- permanent delete contract lintas domain
- attachment contract lintas domain
- complete edit matrix semua record type
- full delete/restore tree consistency

#### Scaffolded / prepared

- `pdf_settings`
- beberapa surface legacy yang menandakan transisi dari model lama
- read model/view SQL yang sudah cukup matang tetapi belum diadopsi secara konsisten

#### Missing but clearly required by current architecture

- matriks source of truth final per domain
- keputusan final peran `transactions`
- policy `archive/delete/restore/permanent delete/reversal`
- definisi final status lifecycle lintas domain
- boundary tegas “domain mana wajib lewat API” vs “boleh direct client”
- mapping feature release core vs side module

#### Nice-to-have / future

- realtime multi-user sync
- user-facing PDF suite
- granular settings/admin page
- advanced search/indexing beyond current pagination/search
- decommission/cleanup file legacy yang tidak lagi dipakai

## 7. Audit UI architecture

### 7.1 Pola UI yang sudah jelas

| Area | Temuan | Evidence |
| --- | --- | --- |
| Shell mobile-first | app dibungkus `max-w-md`, fixed bottom nav, safe-area aware | `src/components/layouts/MainLayout.jsx`, `src/index.css` |
| Design tokens | token warna, radius, spacing, tone, dark mode, Telegram fallback | `src/index.css` |
| UI primitives | card/button/badge/page section/sheet/dialog sudah reusable | `src/components/ui/AppPrimitives.jsx` |
| Main navigation | 4 tab + FAB quick actions | `src/components/ui/BottomNav.jsx` |
| Routed full-screen forms | create/edit/payment/material invoice/master form memakai `FormLayout` | `src/components/layouts/FormLayout.jsx`, pages/form components |
| In-page sheets | picker, action sheet, HRD CRUD, beneficiary CRUD, transaction action menu | `AppSheet` usage di banyak komponen |

### 7.2 Kekuatan UI architecture

1. konsistensi visual sudah cukup tinggi untuk repo yang tumbuh cepat,
2. mobile-first benar-benar tercermin di shell dan spacing,
3. reusable primitives membuat micro-task UI relatif aman bila boundary file dijaga,
4. `FormLayout` memberi pattern yang cukup repeatable untuk routed forms.

### 7.3 Kelemahan UI architecture

| Masalah | Dampak | Evidence |
| --- | --- | --- |
| routed form dan sheet CRUD hidup berdampingan tanpa aturan eksplisit | navigation/back behavior dan mental model operator bisa berbeda-beda | `FormLayout` vs `AppSheet` usage di `HrdPipeline`, `BeneficiaryList`, `TransactionsPage` |
| beberapa modul under `More` adalah full route, tetapi CRUD di dalamnya masih sheet-heavy | boundary page vs modal tidak konsisten | `src/pages/HrdPage.jsx`, `src/components/HrdPipeline.jsx` |
| `EditRecordPage` menjadi matrix editor multi-domain | powerful tetapi rawan ambiguity saat type bertambah | `src/pages/EditRecordPage.jsx` |
| ada surface legacy yang tidak terpakai | AI assistant dapat salah membaca scope aktif | `src/pages/HomePage.jsx`, `src/components/PaymentModal.jsx`, `src/components/TransactionForm.jsx`, `src/store/useAppStore.js` |

### 7.4 Temuan UI yang penting untuk planning

1. `MainLayout` + `BottomNav` sudah cukup final sebagai shell utama.
2. domain inti finance lebih condong ke `routed full-screen form`.
3. domain samping admin/HRD masih condong ke `sheet-in-page CRUD`.
4. sebelum polish besar, perlu diputuskan rule berikut:
   - modul mana wajib full route,
   - modul mana boleh tetap sheet,
   - kapan action sheet dipakai hanya untuk quick action, bukan editor utama.

### 7.5 Empty / loading / error state

Temuan:

- sudah ada `AppEmptyState`, `AppErrorState`, skeleton blocks di beberapa area,
- coverage tidak sepenuhnya merata,
- banyak fallback masih berupa string error atau `console.error`.

Kesimpulan:

> fondasi state UX ada, tetapi belum dibakukan sebagai contract per domain.

## 8. Audit state/data/API flow

### 8.1 Matriks route -> store -> API -> table/view

| Domain | Read path aktual | Write path aktual | Final table/view yang dipakai | Boundary quality |
| --- | --- | --- | --- | --- |
| Auth/workspace | `useAuthStore` -> `/api/auth` -> Supabase auth/profile/team | `/api/auth`, Supabase auth session, invite RPC | `profiles`, `team_members`, `invite_tokens` | jelas |
| Dashboard summary | `useDashboardStore` -> `/api/transactions?view=summary` | read only | `vw_transaction_summary` fallback `vw_cash_mutation` | rawan legacy contamination |
| Dashboard recent items | dashboard compose client-side | read only | `cashMutations` + `bills` + `loans` | campur |
| Ledger workspace | `/api/transactions?view=workspace` | delete via stores/API | workspace composite load in handler | cukup baik |
| Project income | store read direct Supabase by id; create/update/delete via `/api/transactions` | `/api/transactions` | `project_incomes`, child `bills` | hybrid |
| Loan | list/detail read direct Supabase; create/update/delete via `/api/transactions`; payment create direct Supabase | hybrid | `loans`, `loan_payments` | hybrid/rawan |
| Expense | read/write via `/api/records` | `/api/records` | `expenses`, `bills` | cukup baik |
| Material invoice | read/write via `/api/records` | `/api/records` | `expenses`, `expense_line_items`, `bills` | cukup baik |
| Bill | read/delete via `/api/records` | `/api/records` | `bills`, `bill_payments` | cukup baik |
| Bill payment | read/update/delete/restore via `/api/records`; create direct Supabase | hybrid | `bill_payments`, `bills` | hybrid/rawan |
| Attendance | read/write via `/api/records` | `/api/records` | `attendance_records` | baik |
| Payroll | load unbilled via `/api/records`, generate via Supabase RPC | direct RPC + notify | `attendance_records`, `bills` | mixed but understandable |
| Master data | direct Supabase client + worker RPC | direct Supabase client | master tables | sangat hybrid |
| HRD / beneficiary | direct Supabase client + file store | direct Supabase client | `hrd_applicants`, `beneficiaries`, `hrd_applicant_documents` | sangat hybrid |
| Team invite | direct Supabase client | direct Supabase client | `invite_tokens`, `team_members` | hybrid |
| Attachments | direct storage + direct `file_assets`, relation via `/api/records` | mixed | `file_assets`, `expense_attachments` | hybrid |
| Reports | `/api/records?resource=reports` | read only | `vw_project_financial_summary` + detail queries | cukup baik |

### 8.2 Coupling yang paling berbahaya

#### A. Legacy `transactions` masih memengaruhi saldo

Evidence:

- `src/store/useTransactionStore.js` masih punya `submitTransaction()` yang insert ke `transactions`
- `supabase/migrations/20260411190000_setup_telegram_auth_rbac_rls.sql` mendefinisikan `vw_transaction_summary` sebagai union `transactions` + `vw_cash_mutation`
- `api/transactions.js` membaca `vw_transaction_summary`

Dampak:

- saldo dashboard dapat tetap terpengaruh data legacy,
- AI assistant mudah salah mengira `transactions` masih jalur utama,
- release contract “relational final” menjadi kabur.

#### B. Payment create vs update/delete berbeda boundary

Evidence:

- `src/store/usePaymentStore.js` create bill payment dan loan payment memakai direct `supabase.from(...)`
- update/delete payment memakai `/api/records` atau `/api/transactions`

Dampak:

- concurrency, validation, dan audit semantics tidak seragam,
- future hardening harus menyentuh lebih dari satu layer.

#### C. Dashboard dan ledger bukan read model tunggal

Evidence:

- `Dashboard.jsx` membangun feed dari cash mutation + bills + loans
- `TransactionsPage.jsx` memanggil `/api/transactions?view=workspace`

Dampak:

- operator bisa melihat urutan, label, atau coverage item berbeda antara dashboard dan ledger,
- PRD release bisa ambigu soal “workspace utama” yang sebenarnya.

#### D. Direct Supabase client terlalu banyak untuk domain besar

Area paling nyata:

- `useMasterStore.js`
- `useHrStore.js`
- `useTeamStore.js`
- `useFileStore.js`

Dampak:

- boundary security/business rule tersebar,
- AI task mudah menyentuh table langsung tanpa melihat kontrak server,
- reasoning lintas domain menjadi lebih sulit.

### 8.3 Naming dan mental model yang membingungkan

| Istilah / area | Mengapa membingungkan | Evidence |
| --- | --- | --- |
| `transactions` vs `workspaceTransactions` vs `cashMutations` | tiga istilah untuk hal yang mirip tetapi bukan hal yang sama | `useDashboardStore`, `/api/transactions`, migrations |
| `loan` vs `loan-disbursement` | source type di UI dan recordType write tidak selalu sama | `src/lib/transaction-presentation.js`, `api/transactions.js` |
| `expense` vs `material-invoice` vs `surat-jalan` | satu parent table (`expenses`) mewadahi beberapa mental model bisnis | `src/store/useTransactionStore.js`, `api/records.js` |
| `bill` delete vs payment delete vs permanent delete | semantics lebih condong ke arsip tree daripada reversal accounting | `PaymentPage.jsx`, recycle bin pages, APIs |
| `More` | label terlalu generik untuk modul yang sebenarnya penting (`Payroll`, `HRD`, `Beneficiaries`, `Team Invite`) | `src/pages/MorePage.jsx` |

### 8.4 Maintainability untuk AI-assisted development

#### Hal yang membantu

- store dipisah per domain,
- `AppPrimitives` dan CSS token sudah cukup jelas,
- route tree eksplisit di `App.jsx`,
- API client terpisah di `src/lib`.

#### Hal yang berpotensi menyesatkan AI

1. file legacy tidak terpakai tetapi masih ada (`HomePage`, `PaymentModal`, `TransactionForm`, `useAppStore`),
2. hybrid direct Supabase vs server API membuat assistant mudah menulis ke layer yang salah,
3. satu halaman seperti `EditRecordPage` menampung banyak rule lintas domain,
4. source of truth per domain belum tertulis sebagai kontrak teknis tunggal.

## 9. Gap analysis PRD dan product decision yang belum matang

### 9.1 Perbandingan repo vs product intent yang sudah tertulis

`docs/prd-core-feature-release-2026-04-18.md` dan `docs/integration-readiness-plan-2026-04-17.md` jelas mengarah ke model:

- relasional final,
- ledger/workspace yang jelas,
- jalur legacy makin didepresiasi,
- flow inti mobile-first,
- delete/restore/payment/attachment/report yang seragam.

Implementasi aktual sudah bergerak ke sana, tetapi belum sepenuhnya selesai.

### 9.2 Tabel gap utama

| Area | Sudah diputuskan oleh kode | Masih implied | Belum jelas dan wajib diputuskan | Sebaiknya ditunda |
| --- | --- | --- | --- | --- |
| Telegram auth | ya, Telegram adalah auth surface utama | browser non-Telegram hanya fallback dev | apakah browser-only access akan didukung resmi | browser-first auth |
| Workspace model | ya, team membership + role aktif sudah final-ish | owner bypass tetap special case | apakah owner bypass tetap dipertahankan di release final | ekspansi multi-workspace kompleks |
| Source of truth finance | sebagian: `project_incomes`, `expenses`, `loans`, `bills`, `payments` | `transactions` tampak ingin jadi legacy | apakah `transactions` masih dipertahankan sebagai write path apa tidak | refactor besar read model lain |
| Dashboard workspace definition | sebagian: dashboard = overview, ledger = `/transactions` | recent activity masih gabungan client-side | apakah dashboard feed harus menjadi subset ledger resmi | polish dashboard besar |
| Bill/payment model | partial payment jelas ada | archive history berfungsi sebagai “hapus” | apakah delete child payment = archive, void, atau reversal akuntansi | accounting engine penuh |
| Expense vs material invoice | sama-sama parent `expenses` | UI sudah memisahkan secara form | apakah keduanya produk yang benar-benar satu domain atau dua domain dengan kontrak berbeda | restructure table besar |
| Attendance lifecycle | `unbilled -> billed` sudah nyata | read-only setelah billed sudah implied kuat | bagaimana reopen/cancel/correct attendance setelah salary bill dibuat | realtime attendance |
| Reports | report proyek sudah ada | report operasional lintas domain tampak diinginkan | domain report release apa saja yang wajib ada | BI/reporting lanjutan |
| PDF | Telegram notification PDF sudah ada | `pdf_settings` menunjukkan niat PDF bisnis | PDF user-facing apa yang wajib release, siapa owner-nya | desain PDF lengkap multi-template |
| Side modules (`HRD`, `Beneficiaries`) | modulnya nyata | belum jelas apakah core release | apakah modul ini ikut gate release atau dikelompokkan supporting | perluasan HRD besar |
| Settings/admin | team invite sudah ada | `pdf_settings` dan bot config implied | settings page scope final apa saja | generalized admin console |
| AI/content workflow | tidak ada jejak nyata | user-level niat belum terlihat di code | apakah repo ini memang akan punya AI generation/prompt config | membangun AI workflow baru |

### 9.3 Gap paling mendesak

1. keputusan final tentang `transactions`,
2. keputusan final tentang delete/archive/reversal semantics,
3. definisi final workspace utama: dashboard feed vs ledger vs bills list,
4. boundary write API vs direct client,
5. status model lintas domain.

## 10. Keputusan/definisi yang sudah implicit di codebase

Berikut keputusan yang pada praktiknya **sudah diambil oleh kode**, walaupun belum selalu ditulis formal di PRD:

1. aplikasi ini adalah `Telegram Mini Web App`, bukan web dashboard biasa.
2. workspace diikat ke `team_members`, bukan sekadar `telegram_user_id`.
3. owner/admin adalah operator utama untuk kebanyakan modul.
4. `bills` dan `payments` adalah child lifecycle resmi, bukan edge case.
5. `attendance_records` yang sudah punya `salary_bill_id` tidak boleh diedit bebas.
6. `file_assets` + relation table adalah pola file resmi; URL liar bukan pola utama.
7. `project_incomes`, `expenses`, `loans`, dan `attendance_records` adalah entitas bisnis utama.
8. operator utama bekerja di mobile shell dengan bottom nav dan routed forms.
9. `More` berfungsi sebagai catch-all hub untuk modul yang belum diberi posisi IA yang lebih tegas.
10. timezone operasional default aplikasi adalah `Asia/Jakarta` karena formatter bersama memaksakan nilai itu di `src/lib/date-time.js` dan `api/notify.js`.

## 11. Area ambiguity / missing decision / risk tinggi

### 11.1 Top ambiguity

| Area | Ambiguitas | Mengapa berbahaya |
| --- | --- | --- |
| `transactions` | legacy compatibility layer atau domain aktif? | memengaruhi saldo, task scope, dan data migration |
| Dashboard feed | overview tersendiri atau subset dari ledger resmi? | operator bisa membaca dua “riwayat utama” |
| Payment deletion | archive-only atau reversal semantics? | menyentuh akurasi finance dan audit trail |
| Expense status | `paid/unpaid` parent vs `bill.status` child siapa pemilik lifecycle? | rawan drift antar status |
| Material docs | `faktur` vs `surat_jalan` beda bisnis atau cuma variasi UI? | memengaruhi report, payment, stock, delete |
| Salary bill reopen | bagaimana koreksi absensi setelah billed? | tanpa aturan, payroll correction jadi liar |
| Side module scope | HRD/beneficiary masuk core release atau supporting? | backlog dan QA bisa membesar tanpa batas |
| PDF responsibility | Telegram notification PDF vs business PDF user-facing | boundary settings dan output tidak jelas |
| API boundary | domain mana wajib lewat server API? | AI assistant mudah langsung menulis ke DB |

### 11.2 Area yang berpotensi paling sering salah dipahami AI assistant

1. `src/components/TransactionForm.jsx` terlihat seperti form transaksi utama, padahal route create utama sudah bergerak ke flow domain spesifik.
2. `src/pages/HomePage.jsx` terlihat seperti home, padahal tidak diroute di `src/App.jsx`.
3. `src/components/PaymentModal.jsx` terlihat aktif, padahal payment utama memakai `src/pages/PaymentPage.jsx`.
4. `usePaymentStore` create direct Supabase tetapi update/delete via API; assistant mudah mengira semuanya direct atau semuanya via API.
5. `vw_transaction_summary` masih meng-union `transactions`, sehingga assistant bisa salah menganggap legacy table masih design resmi.

### 11.3 Risiko tertinggi bila ambiguity dibiarkan

1. saldo dashboard dan ledger menjadi sulit dipercaya,
2. task AI berikutnya akan terus bolak-balik antara layer yang salah,
3. feature terlihat “selesai” di UI tetapi kontrak datanya belum release-safe,
4. delete/restore/payment dapat menimbulkan tree state yang tidak konsisten,
5. polish UI dikerjakan di atas fondasi flow yang masih berubah.

## 12. Brainstorming questions untuk hardening PRD

### 12.1 Product vision & success metric

1. Apa definisi “release inti berhasil” yang benar-benar dapat diuji dari UI saat ini: apakah `Owner/Admin` harus bisa menyelesaikan create -> edit -> pay -> restore untuk semua domain utama tanpa SQL manual?
2. Apakah target utama aplikasi ini adalah `financial operations workspace`, `field operations workspace`, atau keduanya setara?
3. Dari modul yang sudah ada, mana yang benar-benar harus lolos release pertama: finance + attendance saja, atau finance + attendance + HRD + beneficiary + team management?

### 12.2 User persona & operator workflow

1. Role mana yang benar-benar melakukan input harian paling sering: `Admin`, `Logistik`, `Payroll`, atau `Administrasi`?
2. Apakah dashboard yang sekarang terlalu “Owner/Admin overview”, sementara operator input harian sebenarnya lebih sering butuh ledger/form cepat?
3. Apakah role seperti `Payroll` dan `Logistik` perlu home surface yang lebih fokus dibanding sekadar masuk lewat `More`?

### 12.3 App entrypoint & Telegram/Web division of responsibility

1. Apakah aplikasi ini akan tetap Telegram-only secara resmi, atau browser login non-Telegram juga harus didukung nanti?
2. Apakah bot hanya dipakai untuk auth + invite + notifikasi, atau nanti juga akan menjadi intake channel operasional?
3. Seberapa penting fallback browser di luar Telegram untuk reviewer/admin/backoffice?

### 12.4 Source of truth & lifecycle data

1. Apakah `transactions` akan dipertahankan sebagai compatibility read layer, atau harus dikeluarkan total dari summary dan create flow?
2. Source of truth final untuk saldo kas apa: `vw_transaction_summary` saat ini, atau view baru yang tidak lagi menyentuh `transactions`?
3. Untuk setiap domain inti, dokumen kontrak finalnya apa: `route -> store -> API -> table/view`?

### 12.5 Status model dan transisi status

1. Siapa pemilik lifecycle pembayaran expense: `expenses.status` atau `bills.status`?
2. Apakah `surat_jalan` memang harus memakai `delivery_order` sebagai status parent final, atau itu hanya internal implementation detail?
3. Untuk loan, apakah state `unpaid/partial/paid/cancelled` sudah cukup, dan bagaimana posisi denda/late charge terhadap status tersebut?

### 12.6 Manual vs automation boundaries

1. Trigger database seperti auto-create bill dari expense dan sync fee bill dari project income akan tetap dipertahankan, atau diangkat ke orchestration API agar audit lebih eksplisit?
2. Kapan operator boleh override hasil otomasi, dan lewat surface apa?
3. Apakah create payment selalu manual oleh user, atau beberapa status harus otomatis setelah event tertentu?

### 12.7 Editing / review / finalization flow

1. Setelah payment child ada, domain mana yang harus terkunci total untuk edit parent?
2. Apakah edit record dilakukan selalu dari detail page, atau tetap boleh dari quick action/row action langsung?
3. Perlukah status `draft/review/finalized` di beberapa domain, atau saat ini cukup dengan rule based on payment/billing state?

### 12.8 Content generation workflow

1. Repo saat ini tidak menunjukkan workflow AI/content generation. Apakah itu memang bukan scope produk repo ini?
2. Jika nanti ada prompt configuration atau generated content, apakah modul itu akan hidup di repo ini atau di service lain?
3. Apakah istilah “publish handoff” yang diinginkan sebenarnya merujuk ke PDF/report/export, bukan content generation?

### 12.9 Publish / export / upload handoff

1. Dokumen bisnis apa yang wajib bisa dihasilkan user-facing pada release pertama: kwitansi, invoice, laporan proyek, salary recap, atau lainnya?
2. Apakah `pdf_settings` wajib punya UI sekarang, atau cukup dinyatakan defer resmi?
3. Selain notifikasi Telegram, apakah ada kebutuhan export/download/share ke luar Telegram?

### 12.10 Settings / admin responsibility

1. Siapa yang berhak mengubah branding PDF, bot username-related config, dan role override?
2. Apakah `Team Invite` cukup berada di `More`, atau harus menjadi bagian admin/settings yang lebih tegas?
3. Apakah dibutuhkan halaman settings/admin yang nyata, atau cukup dengan beberapa submodule terpisah?

### 12.11 Error handling & fallback

1. Apa fallback resmi bila `/api/notify` gagal: retry manual, ignore, atau queue?
2. Apa yang harus user lihat jika auth valid tetapi team membership belum tersedia: tunggu approval, contact admin, atau onboarding retry?
3. Untuk conflict edit (`expectedUpdatedAt`), apakah UX cukup dengan force reload, atau perlu diff/review state?

### 12.12 Mobile-first UX constraints

1. Modul mana yang wajib tetap usable di layar Telegram mobile saat data tumbuh besar: ledger, master picker, attendance, report?
2. List mana yang harus dipastikan server-side paginated selain ledger?
3. Apakah modul `Projects` dan `Master` sekarang sudah terlalu padat untuk mobile, atau masih cukup?

### 12.13 Architecture boundary per module

1. Domain mana yang wajib lewat server API untuk semua write: payment, master, HRD, file relations, team invite?
2. Domain mana yang aman tetap direct Supabase client karena rule-nya cukup simpel?
3. Apakah boundary final akan dibagi per domain (`transactions API`, `records API`, `admin API`) atau per operation style?

### 12.14 Future integrations readiness

1. Apakah Telegram notification adalah satu-satunya external side effect yang harus dipertahankan?
2. Apakah storage policy untuk lampiran sekarang cukup untuk future expansion ke payment proof, PDF assets, dan HR documents?
3. Apakah diperlukan event/audit layer sebelum integrasi lain ditambahkan?

### 12.15 Non-goals / anti-scope

1. Modul apa yang secara eksplisit tidak ikut gate release pertama walaupun sudah ada di repo?
2. Apakah `HomePage`, `PaymentModal`, `TransactionForm`, dan `useAppStore` resmi dianggap legacy dan out-of-scope untuk feature work baru?
3. Apa yang tidak boleh lagi dikerjakan sebelum source-of-truth matrix selesai?

### 12.16 What must never be ambiguous again

1. table mana yang menjadi source of truth final per domain,
2. route mana yang menjadi editor utama per domain,
3. aksi `delete`, `archive`, `restore`, `permanent delete`, `reversal` berarti apa,
4. status owner ada di parent atau child mana,
5. domain mana yang boleh direct Supabase client dan mana yang wajib lewat API.

## 13. Recommended planning order / phase order

### 13.1 Prinsip urutan

Urutan berikut tidak mengasumsikan rewrite greenfield. Tujuannya adalah mengunci kontrak di atas codebase yang sudah ada, lalu menutup gap paling berisiko terlebih dahulu.

### 13.2 Phase plan

| Phase | Objective | Why now | Prerequisites | Output wajib | Files/areas likely affected di implementasi nanti | Hal yang sengaja belum disentuh |
| --- | --- | --- | --- | --- | --- | --- |
| P0 - Release Contract Reset | mengunci source-of-truth, role `transactions`, dan module boundary | semua task berikutnya akan liar tanpa ini | audit repo ini disetujui | dokumen kontrak domain final | `docs/*`, kemungkinan `src/lib/*` docs map | UI polish, schema refactor |
| P1 - Ledger and Summary Truth | memastikan saldo, dashboard, ledger membaca model final yang sama | finance trust adalah blocker tertinggi | P0 | keputusan dan implementasi final `transactions` vs relational cashflow | `supabase/migrations/*`, `api/transactions.js`, `src/store/useDashboardStore.js`, `src/pages/Dashboard.jsx` | modul HRD, admin polish |
| P2 - Lifecycle Hardening Core Domains | membakukan create/edit/delete/pay/restore untuk income, expense, material invoice, loan, attendance | domain inti sudah ada tetapi kontraknya belum seragam | P0, sebagian P1 | matrix lifecycle per domain + implementation hardening | `src/pages/EditRecordPage.jsx`, `src/pages/PaymentPage.jsx`, `src/store/*`, `api/*` | reporting besar, PDF settings |
| P3 - Boundary Simplification | menyederhanakan write path agar domain penting tidak hybrid | AI-assisted coding rawan salah layer | P1, P2 | domain write boundary yang lebih konsisten | `src/store/*`, `src/lib/*`, `api/*` | UI polish |
| P4 - Cross-domain Output Layer | finalisasi report, PDF scope, attachment tree, recycle bin tree | setelah lifecycle domain stabil | P2 | report/PDF/backoffice output yang bisa diaudit | `api/records.js`, `src/components/ProjectReport.jsx`, attachment/report files, migrations | fitur baru non-core |
| P5 - Surface Cleanup for AI-safe Work | mengkarantina legacy surface dan menulis boundary tasking | supaya sprint berikut lebih aman | P0-P4 core selesai cukup | daftar hard boundary + cleanup target | `docs/ai-workflow/*`, kemungkinan legacy file removal nanti | ekspansi fitur baru |

### 13.3 Urutan yang paling realistis

1. jangan mulai dari polish,
2. jangan mulai dari feature baru,
3. mulai dari `P0 -> P1`,
4. lanjut `P2` domain-by-domain,
5. baru setelah itu `P3/P4/P5`.

## 14. Micro task breakdown yang ketat

Micro task di bawah sengaja kecil, tidak saling tumpang tindih, dan cocok untuk AI assistant bila scope file dijaga keras.

### MT-01 — Lock Source-of-Truth Matrix

- **Tujuan**: menulis matriks final `route -> store -> API -> table/view` untuk semua domain inti.
- **Scope in**: dashboard, ledger, income, expense, material invoice, loan, payment, attendance, payroll, report.
- **Scope out**: perubahan UI, schema, handler, store behavior.
- **Files/areas likely affected**: `docs/*`.
- **Dependency**: audit handoff ini.
- **Definition of done**: ada dokumen tunggal yang menyebut source of truth final per domain dan status legacy.
- **Acceptance criteria**: tidak ada domain inti yang masih “mungkin lewat ini atau itu”.
- **Risk notes**: jika buru-buru, matrix akan setengah benar dan merusak task berikut.
- **Testing/verification**: audit silang dengan `src/pages/*`, `src/store/*`, `api/*`, `supabase/migrations/*`.
- **Kenapa harus berdiri sendiri**: ini task keputusan/kontrak, bukan task implementasi.

### MT-02 — Decide the Future of `transactions`

- **Tujuan**: memutuskan apakah `transactions` tetap dipertahankan sebagai compatibility layer atau dikeluarkan dari flow inti.
- **Scope in**: `transactions`, `vw_transaction_summary`, `submitTransaction`, docs.
- **Scope out**: refactor semua domain lain.
- **Files/areas likely affected**: `docs/*`, `src/store/useTransactionStore.js`, `supabase/migrations/*`, `api/transactions.js`.
- **Dependency**: `MT-01`.
- **Definition of done**: ada keputusan eksplisit dan dampak ke summary/ledger/create flow terpetakan.
- **Acceptance criteria**: assistant berikutnya tidak akan lagi bingung apakah boleh menambah flow baru ke `transactions`.
- **Risk notes**: salah keputusan di sini akan memaksa revisi besar berikutnya.
- **Testing/verification**: verifikasi keputusan terhadap `Dashboard`, `TransactionsPage`, dan `vw_transaction_summary`.
- **Kenapa harus berdiri sendiri**: ini blocker arsitektur paling besar.

### MT-03 — Align Summary and Ledger Read Models

- **Tujuan**: memastikan dashboard summary dan ledger merujuk model keuangan final yang konsisten.
- **Scope in**: summary, cash mutation, workspace ledger coverage.
- **Scope out**: report proyek, HRD, master data.
- **Files/areas likely affected**: `api/transactions.js`, `src/store/useDashboardStore.js`, `src/pages/Dashboard.jsx`, `supabase/migrations/*`.
- **Dependency**: `MT-02`.
- **Definition of done**: saldo dan riwayat utama tidak bergantung pada model campuran yang ambigu.
- **Acceptance criteria**: ada satu jawaban jelas untuk “angka saldo ini berasal dari mana”.
- **Risk notes**: area finance paling sensitif.
- **Testing/verification**: `npm run lint`, `npm run build`, plus audit manual `summary vs transactions page`.
- **Kenapa harus berdiri sendiri**: perubahan ini cross-cutting dan menyentuh trust finance.

### MT-04 — Formalize Dashboard vs Ledger Responsibility

- **Tujuan**: membedakan tanggung jawab dashboard dan halaman transaksi.
- **Scope in**: definisi feed dashboard, quick stats, relation ke `/transactions`.
- **Scope out**: perubahan visual besar.
- **Files/areas likely affected**: `docs/*`, nanti `src/pages/Dashboard.jsx`, `src/pages/TransactionsPage.jsx`.
- **Dependency**: `MT-03`.
- **Definition of done**: ada rule eksplisit “dashboard menampilkan apa, ledger menampilkan apa”.
- **Acceptance criteria**: tidak ada lagi dua workspace utama yang tumpang tindih secara konsep.
- **Risk notes**: kalau kabur, task UI dan product copy akan terus berubah.
- **Testing/verification**: audit mapping terhadap code paths aktual.
- **Kenapa harus berdiri sendiri**: ini keputusan product IA, bukan implementasi domain.

### MT-05 — Freeze Core Domain Lifecycle Matrix

- **Tujuan**: mendefinisikan state transition resmi untuk income, expense, material invoice, bill, payment, loan, attendance, salary bill.
- **Scope in**: state/status/create/edit/delete/restore/pay lock rules.
- **Scope out**: reporting, PDF, side modules.
- **Files/areas likely affected**: `docs/*`, nanti `src/lib/transaction-presentation.js`, forms, APIs, migrations.
- **Dependency**: `MT-01`, `MT-02`.
- **Definition of done**: tiap domain punya lifecycle matrix parent-child yang jelas.
- **Acceptance criteria**: tidak ada status penting yang hanya hidup di kepala developer.
- **Risk notes**: tanpa ini, hardening domain akan saling bertabrakan.
- **Testing/verification**: audit ke `EditRecordPage`, `PaymentPage`, stores, trigger SQL.
- **Kenapa harus berdiri sendiri**: ini dasar semua micro task domain berikut.

### MT-06 — Harden Project Income Rules

- **Tujuan**: mengunci aturan edit/delete/restore project income terhadap fee bill child.
- **Scope in**: project income + child fee bill relation.
- **Scope out**: expense, loan, attendance.
- **Files/areas likely affected**: `src/components/IncomeForm.jsx`, `src/store/useIncomeStore.js`, `api/transactions.js`, trigger fee bill migration bila perlu.
- **Dependency**: `MT-05`.
- **Definition of done**: parent-child behavior setelah fee bill/payment ada menjadi jelas.
- **Acceptance criteria**: edit/delete/restore tidak bertentangan dengan histori fee bill.
- **Risk notes**: bisa memengaruhi data yang sudah ada.
- **Testing/verification**: `npm run lint`, `npm run build`, plus manual scenario paid/unpaid fee bill.
- **Kenapa harus berdiri sendiri**: domain kecil dan jelas, cocok untuk AI task sempit.

### MT-07 — Harden Expense and Bill Ownership

- **Tujuan**: menetapkan siapa pemilik lifecycle pembayaran: expense parent atau bill child.
- **Scope in**: expense operasional, bill, payment visibility.
- **Scope out**: material invoice, loan.
- **Files/areas likely affected**: `src/components/ExpenseForm.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/store/useTransactionStore.js`, `src/store/useBillStore.js`, `api/records.js`.
- **Dependency**: `MT-05`.
- **Definition of done**: status, delete tree, detail visibility tidak ambigu.
- **Acceptance criteria**: operator paham di mana “tagihan aktif” hidup.
- **Risk notes**: salah boundary di sini akan merusak payment UX.
- **Testing/verification**: lint/build + create/edit/pay/delete/restore scenario.
- **Kenapa harus berdiri sendiri**: domain expense sudah cukup kompleks sendiri.

### MT-08 — Harden Material Invoice vs Surat Jalan Semantics

- **Tujuan**: memisahkan kontrak bisnis `faktur` dan `surat_jalan`.
- **Scope in**: status, payment, stock, edit lock, reporting semantics.
- **Scope out**: expense operasional umum.
- **Files/areas likely affected**: `src/components/MaterialInvoiceForm.jsx`, `src/store/useTransactionStore.js`, `api/records.js`, expense-related migrations/views.
- **Dependency**: `MT-05`.
- **Definition of done**: `surat_jalan` bukan cuma kondisi if-else implisit.
- **Acceptance criteria**: report/detail/delete/pay behavior sesuai keputusan final.
- **Risk notes**: domain ini menyentuh stock, billing, dan document meaning sekaligus.
- **Testing/verification**: lint/build + create/edit/delete/restore faktur vs surat jalan.
- **Kenapa harus berdiri sendiri**: campur dengan expense umum akan terlalu besar.

### MT-09 — Harden Loan and Loan Payment Boundary

- **Tujuan**: membuat loan dan loan payment memakai boundary write yang konsisten.
- **Scope in**: loan create/update/delete, loan payment create/update/delete/restore.
- **Scope out**: bill payment.
- **Files/areas likely affected**: `src/store/useIncomeStore.js`, `src/store/usePaymentStore.js`, `src/pages/PaymentPage.jsx`, `api/transactions.js`.
- **Dependency**: `MT-05`.
- **Definition of done**: create/update/delete tidak lagi hybrid tanpa alasan.
- **Acceptance criteria**: satu domain tidak memakai dua strategi write yang bertentangan.
- **Risk notes**: menyentuh finance dan concurrency.
- **Testing/verification**: lint/build + loan payment history scenarios.
- **Kenapa harus berdiri sendiri**: loan domain punya business rule sendiri (`loan-business.js`).

### MT-10 — Formalize Payment Archive vs Reversal Policy

- **Tujuan**: memutuskan dan mengimplementasikan arti `hapus pembayaran`.
- **Scope in**: bill payment dan loan payment delete/archive/permanent delete.
- **Scope out**: parent bill/loan status selain dampak langsung delete child.
- **Files/areas likely affected**: `src/pages/PaymentPage.jsx`, `src/store/usePaymentStore.js`, `api/records.js`, `api/transactions.js`, recycle bin pages, docs.
- **Dependency**: `MT-05`, `MT-09`.
- **Definition of done**: “archive” tidak lagi dianggap surrogate untuk beberapa konsep berbeda.
- **Acceptance criteria**: ada satu bahasa produk yang konsisten di UI dan API.
- **Risk notes**: ini area audit finance paling sensitif sesudah saldo.
- **Testing/verification**: lint/build + payment create/edit/archive/restore/permanent delete scenarios.
- **Kenapa harus berdiri sendiri**: ini policy-heavy dan rawan side effect.

### MT-11 — Finalize Attendance Correction Policy

- **Tujuan**: menetapkan apa yang terjadi jika attendance yang sudah billed perlu dikoreksi.
- **Scope in**: attendance read-only state, salary bill linkage, reopen/cancel flow.
- **Scope out**: payroll UI polish.
- **Files/areas likely affected**: `src/components/AttendanceForm.jsx`, `src/components/PayrollManager.jsx`, `src/store/useAttendanceStore.js`, `api/records.js`, kemungkinan migration/RPC.
- **Dependency**: `MT-05`.
- **Definition of done**: ada flow resmi pasca billing.
- **Acceptance criteria**: tidak ada edit diam-diam pada attendance yang sudah menjadi dasar bill.
- **Risk notes**: menyentuh payroll correctness.
- **Testing/verification**: lint/build + unbilled/billed/paid salary bill scenarios.
- **Kenapa harus berdiri sendiri**: attendance/payroll adalah domain operasional tersendiri.

### MT-12 — Standardize Attachment Tree Semantics

- **Tujuan**: membakukan aturan upload, orphan cleanup, soft delete, restore, permanent delete attachment.
- **Scope in**: `file_assets`, `expense_attachments`, future payment proof implication.
- **Scope out**: redesign UI attachment.
- **Files/areas likely affected**: `src/store/useFileStore.js`, `src/components/ExpenseAttachmentSection.jsx`, `api/records.js`, migrations bila perlu, docs.
- **Dependency**: `MT-05`.
- **Definition of done**: file relation tree jelas dan tidak meninggalkan orphan.
- **Acceptance criteria**: ada jawaban tegas atas attachment parent-delete/child-delete/restore.
- **Risk notes**: storage cleanup dan permission matrix rawan.
- **Testing/verification**: lint/build + upload/delete/restore/permanent delete scenario.
- **Kenapa harus berdiri sendiri**: attachment adalah cross-cutting concern dan mudah melebar.

### MT-13 — Lock Reporting Scope for Release

- **Tujuan**: memutuskan report apa yang benar-benar masuk release inti dan source-nya dari mana.
- **Scope in**: report proyek, portfolio summary, kemungkinan report tagihan/payments.
- **Scope out**: dashboard cards umum.
- **Files/areas likely affected**: `docs/*`, lalu `src/components/ProjectReport.jsx`, `src/store/useReportStore.js`, `api/records.js`, SQL views.
- **Dependency**: `MT-03`, `MT-05`.
- **Definition of done**: release report scope tidak lagi generik.
- **Acceptance criteria**: ada daftar report wajib, sumber data, dan actor pengguna.
- **Risk notes**: tanpa scope lock, reporting mudah menjadi proyek baru sendiri.
- **Testing/verification**: audit terhadap view SQL dan UI yang ada.
- **Kenapa harus berdiri sendiri**: report adalah read model concern, bukan CRUD core.

### MT-14 — Decide PDF Strategy

- **Tujuan**: membedakan Telegram notification PDF dari business PDF user-facing.
- **Scope in**: `api/notify.js`, `pdf_settings`, release output doc.
- **Scope out**: implement semua template PDF.
- **Files/areas likely affected**: `docs/*`, lalu `api/notify.js`, settings UI future, migrations bila perlu.
- **Dependency**: `MT-13`.
- **Definition of done**: satu keputusan tegas tentang PDF yang wajib/ditunda.
- **Acceptance criteria**: `pdf_settings` tidak lagi menggantung tanpa owner.
- **Risk notes**: desain template bisa menyedot scope bila tidak dibatasi.
- **Testing/verification**: audit use case dan evidence di repo.
- **Kenapa harus berdiri sendiri**: output strategy perlu diputuskan sebelum implement.

### MT-15 — Clarify Core vs Supporting Modules

- **Tujuan**: menentukan status release `HRD`, `Beneficiaries`, `Team Invite`, `Master`, `Projects`.
- **Scope in**: module categorization dan release gate.
- **Scope out**: perubahan fitur modul.
- **Files/areas likely affected**: `docs/*`.
- **Dependency**: audit ini.
- **Definition of done**: tiap modul diberi label `core release`, `supporting`, atau `deferred`.
- **Acceptance criteria**: backlog dan QA phase tidak lagi melebar tanpa batas.
- **Risk notes**: ini murni product scoping task.
- **Testing/verification**: cocokkan dengan route tree dan PRD aktif.
- **Kenapa harus berdiri sendiri**: tanpa ini roadmap akan terus kabur.

### MT-16 — Remove AI Misread Traps

- **Tujuan**: mengkarantina atau menandai file legacy/unused yang berpotensi menyesatkan AI.
- **Scope in**: `HomePage`, `PaymentModal`, `TransactionForm`, `useAppStore`, docs AI workflow.
- **Scope out**: cleanup besar seluruh repo.
- **Files/areas likely affected**: `docs/ai-workflow/*`, kemungkinan file legacy itu sendiri di fase implementasi.
- **Dependency**: `MT-01`, `MT-02`.
- **Definition of done**: ada daftar resmi file legacy dan boundary penggunaannya.
- **Acceptance criteria**: task AI berikut bisa menyebut “jangan sentuh legacy surfaces”.
- **Risk notes**: jangan hapus file sebelum dipastikan benar-benar tidak terpakai.
- **Testing/verification**: `rg` reference scan + lint/build jika ada cleanup code.
- **Kenapa harus berdiri sendiri**: sangat efektif mengurangi chaos task AI berikut.

## 15. Detailed backlog

### 15.1 Immediate next

| Nama | Alasan masuk backlog | Dependency | Kategori | Urgency | Ambiguity | Perlu keputusan produk dulu? |
| --- | --- | --- | --- | --- | --- | --- |
| Lock source-of-truth matrix | blocker untuk semua task implementasi | none | docs / architecture | critical | medium | no |
| Decide `transactions` boundary | masih memengaruhi saldo dan task scope | source-of-truth matrix | architecture / integration | critical | high | yes |
| Align dashboard summary with final cashflow | trust finance tidak boleh ambigu | `transactions` decision | frontend / backend / integration | critical | high | yes |
| Freeze lifecycle matrix core domains | create/edit/delete/pay/restore masih campur | source-of-truth matrix | product / architecture | critical | high | yes |
| Clarify core vs supporting modules | backlog dan QA scope masih bisa melebar | none | product | high | medium | yes |

### 15.2 Near-term

| Nama | Alasan masuk backlog | Dependency | Kategori | Urgency | Ambiguity | Perlu keputusan produk dulu? |
| --- | --- | --- | --- | --- | --- | --- |
| Harden project income + fee bill rules | sudah usable tapi child payment rule perlu dikunci | lifecycle matrix | frontend / backend | high | medium | mostly done |
| Harden expense + bill ownership | source of payment status perlu jelas | lifecycle matrix | product / frontend / backend | high | high | yes |
| Harden material invoice vs surat jalan semantics | document meaning belum final | lifecycle matrix | product / frontend / backend | high | high | yes |
| Unify loan payment write boundary | hybrid path rawan error | `transactions` decision | architecture / backend / frontend | high | medium | no |
| Formalize payment archive/reversal policy | audit trail finance harus jelas | lifecycle matrix | product / architecture | high | high | yes |
| Finalize attendance correction policy | payroll correction belum punya flow resmi | lifecycle matrix | product / backend / frontend | high | high | yes |
| Standardize attachment tree semantics | orphan/restore policy harus konsisten | lifecycle matrix | architecture / integration | high | medium | no |

### 15.3 Later

| Nama | Alasan masuk backlog | Dependency | Kategori | Urgency | Ambiguity | Perlu keputusan produk dulu? |
| --- | --- | --- | --- | --- | --- | --- |
| Lock release reporting scope | report saat ini masih sempit | summary and lifecycle hardening | product / reporting | medium | medium | yes |
| Decide user-facing PDF strategy | `pdf_settings` masih tanpa UI owner | reporting scope | product / docs | medium | high | yes |
| Standardize admin/settings IA | `More` dan settings responsibility belum tegas | module categorization | UX / product | medium | medium | yes |
| Cleanup legacy AI traps | mengurangi salah-scope pada sprint lanjut | source-of-truth decision | technical debt / docs | medium | low | no |
| Move remaining direct writes behind API where justified | menyederhanakan boundary jangka menengah | domain hardening | architecture / backend | medium | medium | no |

### 15.4 Parking lot

| Nama | Alasan masuk backlog | Dependency | Kategori | Urgency | Ambiguity | Perlu keputusan produk dulu? |
| --- | --- | --- | --- | --- | --- | --- |
| Browser-first auth mode | tidak ada jejak kuat sebagai kebutuhan release saat ini | product strategy | product / auth | low | high | yes |
| Realtime live sync antar operator | bukan blocker release inti | lifecycle hardening | architecture | low | medium | no |
| Advanced search/index strategy | current pagination cukup untuk fase sekarang | ledger truth alignment | performance | low | medium | no |
| Business PDF template suite penuh | schema ada tetapi UI/product belum siap | PDF strategy | docs / product / frontend | low | high | yes |
| Expanding HRD/beneficiary beyond current CRUD | bukan blocker finance core | module categorization | product | low | medium | yes |

## 16. Risiko terbesar bila development lanjut tanpa perapihan

1. **Financial trust risk**  
   Saldo, mutasi, dan status pembayaran bisa terus hidup di model campuran.

2. **AI scope drift risk**  
   Assistant akan terus bingung antara jalur legacy, direct Supabase, dan API boundary.

3. **Feature-complete illusion risk**  
   Banyak flow terlihat “sudah ada”, tetapi sebenarnya belum punya kontrak lifecycle yang release-safe.

4. **Delete/audit risk**  
   Tanpa definisi archive vs restore vs reversal, histori finansial akan sulit dipercaya.

5. **Planning churn risk**  
   UI polish, refactor, dan task domain berikutnya berisiko diulang karena berdiri di atas keputusan produk yang belum final.

## 17. Rekomendasi cara memakai dokumen ini untuk step berikutnya

1. Pakai dokumen ini sebagai baseline sebelum membuat brief implementasi baru.
2. Jangan lompat ke task code sebelum `MT-01` sampai `MT-05` minimal tervalidasi sebagai keputusan tertulis.
3. Saat membuat task AI, selalu rujuk:
   - domain target,
   - source of truth domain,
   - scope file in/out,
   - acceptance criteria yang mengacu pada lifecycle matrix.
4. Setiap task implementasi berikutnya sebaiknya hanya mengambil **satu** micro task dari dokumen ini.
5. Jika ada keputusan produk baru yang mengubah salah satu asumsi besar di dokumen ini, revisi dulu bagian `source-of-truth`, `lifecycle`, dan `backlog` sebelum lanjut coding.

## Penutup singkat

Repo ini sudah lebih maju daripada repo prototype biasa: fondasi operasional utamanya nyata. Namun justru karena banyak hal sudah dibangun, fase berikutnya harus lebih disiplin. Fokus paling aman bukan menambah fitur baru, melainkan mengunci kontrak arsitektur dan lifecycle di atas codebase yang sudah ada.
