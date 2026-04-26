# Browser Desktop + Auth Adaptation Backlog - 2026-04-25

## 1. Status dan Boundary Stream

Dokumen ini adalah backlog stream baru untuk memecah `docs/browser-desktop-auth-adaptation-plan-2026-04-25.md` menjadi micro-task implementasi v1 yang kecil, berurutan, dan bisa diaudit.

Status:

- Stream: `Browser Desktop + Auth Adaptation`
- Source plan: `docs/browser-desktop-auth-adaptation-plan-2026-04-25.md`
- Backlog status: `draft implementation backlog`
- Scope: future implementation planning
- Relation to UCW: terpisah dari `docs/unified-crud-workspace-plan-2026-04-18.md`
- Progress log aktif: `docs/progress/browser-desktop-auth-adaptation-progress-log.md`

Boundary wajib:

- Mobile Telegram Mini Web App tetap prioritas dan tidak boleh regresi.
- `/api/auth` Mini App dianggap frozen untuk v1 browser.
- V1 tidak menambah Bootstrap dependency.
- V1 tidak menambah schema, migration, RLS policy, DB audit table, MFA, email/password, atau magic link.
- Browser desktop v1 memakai same origin/domain, Telegram Login Widget, Supabase SPA session, dan role dari `team_members`.
- Setiap task implementasi harus punya brief terpisah sebelum coding.
- Urutan brief pertama untuk pass ini adalah `Jurnal` contract + first table adaptation; brief `Dashboard` menyusul.
- Stream ini saat ini berada pada mode docs-only maturity pass; tidak ada runtime code yang boleh diubah sebelum brief implementasi eksplisit disetujui.

Current control state:

- Progress log aktif: `docs/progress/browser-desktop-auth-adaptation-progress-log.md`
- Setiap brief berikutnya wajib mencatat statusnya di progress log ini sebelum task implementasi berjalan.
- Jika dokumen ini bertentangan dengan progress log atau brief yang lebih baru, progress log tetap wajib dipakai sebagai audit trail eksekusi.

## 2. Leveling Model

Backlog dibagi menjadi level agar dependency jelas dan implementer tidak melompat ke area high-risk sebelum guard siap.

| Level | Nama | Tujuan | Gate sebelum lanjut |
| --- | --- | --- | --- |
| `L0` | Readiness | Mengunci setup eksternal, brief, dan guardrail | Owner menyetujui task implementation pertama |
| `L1` | Detection + Gating | Menyiapkan context detection, env flag, dan public behavior tanpa desktop UI besar | Mobile Mini App tetap berjalan seperti baseline |
| `L2` | Desktop Shell POC | Menambah shell desktop additive untuk Owner/Admin tanpa write/mutation | Dashboard + Jurnal read/navigation usable di desktop |
| `L3` | Browser Auth Foundation | Menambah login browser Telegram Widget dan session Supabase tanpa mengubah `/api/auth` | Browser login/logout dan denied state valid |
| `L4` | Integration Hardening | Menutup redirect, smoke test, security baseline, dan rollout preview | Mobile + desktop smoke lolos |
| `L5` | Page Adaptation V1 | Adaptasi halaman read-heavy setelah POC: Dashboard home hub, Reports, lalu Payments hub/list | Tiap page punya smoke dan tidak mengubah source-of-truth |
| `L6` | Deferred/Future | Area yang sengaja tidak masuk v1 awal | Harus dibuat proposal baru |

## 3. Global Validation Rules

Validasi minimum untuk task implementasi v1:

- `npm run lint`
- `npm run build`
- Smoke mobile Telegram: auth/bootstrap, bottom nav, Dashboard, Jurnal, satu standalone form
- Smoke desktop 1366px: login/guard, Dashboard, Jurnal, sidebar/topbar, logout jika scope task menyentuh auth

Validasi dapat dipersempit hanya untuk docs-only task.

Setiap output implementasi wajib menyebut:

- file berubah,
- alasan perubahan,
- risiko/regresi,
- hasil validasi,
- source-of-truth yang dipakai,
- konfirmasi `/api/auth` Mini App tidak berubah kecuali memang task khusus.

## 3A. Route Coverage Matrix

Catatan:

- Route canonical selalu jadi nama utama.
- Alias/redirect hanya ditulis di catatan row canonical, bukan sebagai surface baru.
- Route technical diperlakukan sebagai sub-entry boundary, bukan surface redesign utama.

| Category | Canonical path | UI label / component | Final source-of-truth chain | Desktop stance | Notes |
| --- | --- | --- | --- | --- | --- |
| Auth | `/login` | `BrowserLoginPage` | `useAuthStore` -> `/api/browser-auth` -> Supabase Auth -> `profiles`, `team_members` | core auth | Public browser entry; `api/auth` Mini App tetap frozen. |
| Dashboard | `/` | `Dashboard` / `src/pages/Dashboard.jsx` | `useDashboardStore`, `useBillStore`, `useIncomeStore`, `useReportStore` -> `transactions-api`, `records-api`, `reports-api` -> raw tables + `vw_cash_mutation`, `vw_workspace_transactions`, `vw_project_financial_summary`, `vw_billing_stats` | core v1 | Home hub desktop; no action grid. |
| Jurnal | `/transactions` | `TransactionsPage` | page state + `useDashboardStore` -> `/api/transactions` -> `vw_workspace_transactions`, `vw_history_transactions` | core v1 | Aliases: `/transactions/history`, `/history`, `/riwayat`, `/tagihan`, `/transaksi`; first brief targets this surface. |
| Reports | `/reports` | `ProjectsPage` + `ProjectReport` | `useReportStore` -> `reports-api`/`records-api` -> `vw_project_financial_summary`, `vw_cash_mutation`, `vw_billing_stats`, `pdf_settings` | core v1 | Aliases: `/projects`, `/proyek`; `/reports/pdf-settings` is adjacent config route. |
| Payments | `/pembayaran` | `PaymentsPage` | `usePaymentStore`, `useBillStore`, `useIncomeStore`, `useDashboardStore` -> `records-api`, `transactions-api` -> `workspaceTransactions`, `bills`, `loans`, `deletedBillPayments` | core read/list | Nested payment routes stay deferred: `/payment/:id`, `/loan-payment/:id`, `?group=` detail. |
| Master | `/master` | `MasterPage` + `MasterDataManager` | `useMasterStore` direct Supabase client + worker RPC | core v1 | Route-based CRUD and recycle bin stay route-based. |
| Boundary | `/transactions/:transactionId`, `/transactions/recycle-bin`, `/transactions/recycle-bin/:transactionId` | `TransactionDetailPage`, `TransactionsRecycleBinPage`, `DeletedTransactionDetailPage` | `useDashboardStore` + `transactions-api` / `records-api` -> `vw_workspace_transactions`, `vw_history_transactions`, `vw_recycle_bin_records` | adjacent boundary | Read/recycle boundary only; no redesign in this pass. |
| Boundary | `/reports/pdf-settings` | `ProjectPdfSettingsPage` | `useReportStore` -> `reports-api`/`records-api` -> `pdf_settings`, `file_assets` | adjacent boundary | Config route, not a desktop shell surface. |
| Boundary | `/transactions/:transactionId/technical`, `/edit/:type/:id/technical`, `/payment/:id/technical`, `/loan-payment/:id/technical` | Technical variants | Route-specific existing flows | adjacent boundary | Keep as audit/access boundary; no redesign target. |
| Deferred | `/more` + `/more/*` | `MorePage` + HRD/beneficiaries/team invite pages | `useHrStore`, `useTeamStore`, `useFileStore` direct client domains | deferred appendix | Utility hub and subroutes stay out of v1. |
| Deferred | `/payroll`, `/payroll/worker/:workerId` | `PayrollPage`, `PayrollWorkerDetailPage` | `useAttendanceStore` + `useBillStore` -> `/api/records?resource=attendance-recap` + attendance/bill sources | deferred appendix | Payroll recap/payment lifecycle is high-risk. |
| Deferred | `/stock` | `StockPage` | `records-api` -> `materials`, `stock_transactions`, `fn_create_atomic_manual_stock_out` | deferred appendix | Stock and manual outflow stay separate from desktop v1. |
| Deferred | `/attendance/new` | `AttendancePage` | `useAttendanceStore` -> `records-api` -> `attendance_records` | deferred appendix | Form/mutation route; no desktop rewrite in this pass. |
| Deferred | `/material-invoice/new`, `/material-invoice/:id` | `MaterialInvoicePage`, `MaterialInvoiceDetailPage` | `useTransactionStore` -> `records-api` -> `expenses`, `expense_line_items`, `bills`, `stock_transactions`, `materials` | deferred appendix | High-risk write flow with stock side effects. |
| Deferred | `/edit/:type/:id` | `EditRecordPage` | domain stores/API wrappers by type | deferred appendix | Generic edit surface; keep out of desktop v1. |
| Deferred | `/payment/:id`, `/loan-payment/:id` | `PaymentPage` | `usePaymentStore`, `useBillStore`, `useIncomeStore` -> `records-api` / `transactions-api` -> `bills`, `bill_payments`, `loans`, `loan_payments` | deferred appendix | Standalone payment mutation routes stay route-based and high-risk. |

## 4. Micro-task Backlog

### Level L0 - Readiness

| ID | Judul | Scope In | Scope Out | Dependency | Definition of Done | Validasi |
| --- | --- | --- | --- | --- | --- | --- |
| `BDA-L0-01` | Buat implementation brief untuk context/gating | Tulis brief task pertama dari backlog ini dengan file allowed/forbidden dan validasi | Coding | Dokumen ini | Brief siap dieksekusi tanpa keputusan tambahan | Review dokumen |
| `BDA-L0-02` | Checklist Telegram Login Widget setup | Dokumentasikan domain/bot setup yang harus selesai sebelum browser auth diuji | Mengubah config Telegram/Supabase | `BDA-L0-01` | Owner tahu precondition eksternal untuk auth browser | Docs-only path/diff |
| `BDA-L0-03` | Tentukan env flag rollout | Kunci `VITE_ENABLE_DESKTOP_BROWSER_MODE` di brief implementasi dan deployment checklist | Menulis env production/preview | `BDA-L0-01` | Flag name, default off, rollback behavior tercatat | Docs-only path/diff |
| `BDA-L0-04` | Tetapkan smoke checklist desktop/mobile | Tulis checklist manual/Playwright target untuk mobile dan desktop 1366px | Menulis test otomatis | `BDA-L0-01` | Checklist siap dipakai setiap task UI/auth v1 | Docs-only path/diff |

### Level L1 - Detection + Gating

| ID | Judul | Scope In | Scope Out | Dependency | Definition of Done | Validasi |
| --- | --- | --- | --- | --- | --- | --- |
| `BDA-L1-01` | Tambah context detection helper | Tambah helper/hook konseptual `useClientContext` untuk context `telegram`, `desktop-browser`, dan `mobile-browser-non-telegram` | Desktop shell, browser auth, route rewrite | `BDA-L0-03` | Context bisa dibaca dari App/layout tanpa mengubah mobile behavior | Lint/build + mobile smoke |
| `BDA-L1-02` | Gate desktop flag di app entry | Baca `VITE_ENABLE_DESKTOP_BROWSER_MODE` dan pastikan flag off tidak membuka desktop mode | Login Widget, DesktopLayout penuh | `BDA-L1-01` | Browser desktop flag off menampilkan notice minimal; Mini App tetap normal | Lint/build + mobile smoke |
| `BDA-L1-03` | Public browser notice minimal | Tambah notice minimal untuk desktop flag off dan mobile/tablet browser non-Telegram | Marketing copy, onboarding page panjang | `BDA-L1-02` | Notice tidak mengubah UI Mini App dan tidak menjadi placeholder besar | Lint/build + visual smoke |
| `BDA-L1-04` | Guard public route policy | Pastikan hanya route `/login` future yang public untuk browser; route app tetap protected | Implementasi Login Widget | `BDA-L1-02` | Route protected tidak terbuka tanpa session | Lint/build + guard smoke |
| `BDA-L1-05` | Preserve Telegram bootstrap path | Audit dan pastikan context/gating tidak mengubah `initializeTelegramAuth` Mini App | Refactor `/api/auth` | `BDA-L1-04` | Telegram Mini App tetap memakai `initData` flow existing | Mobile auth smoke |

### Level L2 - Desktop Shell POC

| ID | Judul | Scope In | Scope Out | Dependency | Definition of Done | Validasi |
| --- | --- | --- | --- | --- | --- | --- |
| `BDA-L2-01` | Tambah `DesktopLayout` skeleton | Buat layout desktop additive dengan sidebar/topbar/main container | Auth browser, page rewrite, mutations | `BDA-L1-05` | Layout muncul hanya `lg` + flag + allowed role/session | Lint/build + desktop smoke |
| `BDA-L2-02` | Buat desktop nav mapping | Tambah mapping nav: Beranda, Jurnal, Payroll, Menu, Reports, Stock, Master | Mengubah `BottomNav` | `BDA-L2-01` | Sidebar navigasi tidak mengubah bottom nav mobile | Lint/build + mobile nav smoke |
| `BDA-L2-03` | Tambah topbar context ringkas | Topbar menampilkan page context, user, role/team, logout slot | Global search, team switcher | `BDA-L2-02` | User tahu role/team di desktop tanpa panel tambahan | Lint/build + desktop visual smoke |
| `BDA-L2-04` | Tambah scoped desktop CSS jika perlu | Class `.app-desktop-*` untuk shell/container saja | Mengubah token `--app-*`, Bootstrap dependency | `BDA-L2-03` | CSS tidak memengaruhi mobile shell | Lint/build + mobile visual smoke |
| `BDA-L2-05` | Render Dashboard dalam desktop shell | Dashboard tampil di desktop container tanpa mengubah kalkulasi/store | Redesign Dashboard penuh | `BDA-L2-04` | Dashboard read-only/navigasi usable desktop | Lint/build + desktop Dashboard smoke |
| `BDA-L2-06` | Render Jurnal dalam desktop shell | Jurnal tampil di desktop container dengan read/navigation existing | Data table rewrite, create/edit/delete/pay | `BDA-L2-05` | Jurnal read/navigation usable desktop | Lint/build + desktop Jurnal smoke |
| `BDA-L2-07` | Hide quick actions in desktop POC | Pastikan FAB/quick actions tidak membuka write flow desktop awal | Menghapus quick actions mobile | `BDA-L2-06` | Desktop POC tidak membuka create/edit mutation | Lint/build + desktop nav smoke |
| `BDA-L2-08` | Owner/Admin desktop rollout gate | Batasi desktop POC ke Owner/Admin saat flag aktif | Permission matrix baru | `BDA-L2-07` | Non Owner/Admin tetap tidak mendapat desktop POC | Lint/build + role smoke |

#### Level L2 - Jurnal Redesign Addendum

Addendum ini khusus untuk freeze dan implementasi desktop `Jurnal`, dan sengaja ditempatkan dekat Level L2 karena `Jurnal` adalah bagian dari desktop POC awal.

| ID | Judul | Scope In | Scope Out | Dependency | Definition of Done | Validasi |
| --- | --- | --- | --- | --- | --- | --- |
| `BDA-L2-J1` | Lock Jurnal redesign contract | `docs/browser-desktop-auth-adaptation-plan-2026-04-25.md`, `docs/browser-desktop-auth-adaptation-backlog-2026-04-25.md` | `api/transactions.js`, `src/App.jsx`, `api/auth.js`, `supabase/migrations/*`, `package.json`, `package-lock.json` | `BDA-L2-06` | Contract resmi menetapkan `Jurnal` sebagai workspace table desktop dengan tiga tab setara, sticky header, route-based detail, no new source-of-truth, dan no API contract change | Docs-only check |
| `BDA-L2-J2` | Define sticky desktop Jurnal header | `src/pages/TransactionsPage.jsx`, desktop layout wrapper terkait | `src/components/layouts/MainLayout.jsx`, `src/components/ui/BottomNav.jsx`, route tree global, mobile shell spacing | `BDA-L2-J1` | Desktop `Jurnal` punya sticky workspace header berisi title, tabs, search/filter controls, dan shortcut `Arsip` tanpa KPI strip tambahan | Lint/build + mobile/desktop visual smoke |
| `BDA-L2-J3` | Adapt Aktif into context-rich table | `src/pages/TransactionsPage.jsx`, action/table wrapper terkait, `src/lib/transaction-presentation.js` untuk presentasi | new transactions API contract, numbered pagination, inline edit/payment form, dashboard/report source changes | `BDA-L2-J2` | Tab `Aktif` tampil sebagai tabel desktop dengan kolom `Tanggal/Waktu`, `Tipe/Source`, `Proyek/Pihak`, `Deskripsi`, `Status Settlement`, `Nominal`, `Aksi`, row click membuka detail route existing, dan `Aksi` memakai action column + kebab | Lint/build + desktop Jurnal smoke |
| `BDA-L2-J4` | Preserve per-tab state and cursor model | `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/BillsPage.jsx` bila perlu untuk embedded behavior | contract search/filter baru, numbered pagination, global search, local persistence di luar scope Jurnal | `BDA-L2-J3` | Search/filter state per tab tetap independen, cursor pagination + `Muat Berikutnya` tetap dipakai, dan perpindahan tab tidak memaksa redesign state model baru | Lint/build + tab/state smoke |
| `BDA-L2-J5` | Adapt Riwayat into audit-focused table | `src/pages/HistoryPage.jsx`, `src/pages/TransactionsPage.jsx`, action/table wrapper terkait | pay/edit/delete action di history, new history API contract, recycle-bin rewrite | `BDA-L2-J4` | Tab `Riwayat` tampil sebagai audit-focused table dengan kolom `Waktu`, `Source`, `Context`, `Nominal`, `Creator`, `Detail` dan action scope `detail only` | Lint/build + history-mode smoke |
| `BDA-L2-J6` | Adapt Tagihan into grouped inline-expand settlement surface | `src/pages/BillsPage.jsx`, `src/pages/TransactionsPage.jsx`, payment-route helper presentasi terkait | full Payments workspace duplication, nested expand level kedua, payment form rewrite, source-of-truth bill changes | `BDA-L2-J4` | Tab `Tagihan` tetap grouped, punya search + simple filters `group type` dan `due urgency`, inline expand hanya menampilkan summary + child bills, dan klik child bill membuka route payment/detail existing | Lint/build + bill-mode smoke |
| `BDA-L2-J7` | Validate archive access and regression boundary | `src/pages/TransactionsPage.jsx`, desktop smoke checklist, docs output task | auth/browser foundation rewrite, recycle-bin contract change, dependency install tanpa approval | `BDA-L2-J6` | Shortcut `Arsip` tetap tersedia di header `Jurnal`, mobile shell tetap authority di bawah `lg`, dan desktop `Jurnal` tidak mengubah `/api/transactions`, `MainLayout`, `BottomNav`, atau route high-risk existing | Lint/build + mobile/desktop smoke |

### Level L3 - Browser Auth Foundation

| ID | Judul | Scope In | Scope Out | Dependency | Definition of Done | Validasi |
| --- | --- | --- | --- | --- | --- | --- |
| `BDA-L3-01` | Tambah `/login` route browser | Tambah route public `/login` dan placeholder functional minimal untuk Login Widget slot | Desktop marketing page | `BDA-L1-04` | Browser unauthenticated diarahkan ke `/login` jika flag aktif | Lint/build + route smoke |
| `BDA-L3-02` | Tambah `BrowserLoginPage` UI minimal | Halaman login dengan Telegram Login Widget mount point dan error generic | Email/password, magic link | `BDA-L3-01` | Login UI minimal, tidak muncul di Mini App flow | Lint/build + desktop login visual smoke |
| `BDA-L3-03` | Tambah `/api/browser-auth` endpoint skeleton | Endpoint POST baru dengan method guard, env guard, generic error response | Verifikasi penuh, session creation | `BDA-L3-02` | Endpoint ada dan tidak mengubah `/api/auth` | Lint/build + targeted API smoke |
| `BDA-L3-04` | Implement Telegram Login Widget verifier | Server-side hash/signature verification dan `auth_date` max 1 jam | Dependency verifier baru | `BDA-L3-03` | Payload invalid/expired ditolak; valid payload lanjut stage berikutnya | Unit/API test atau manual API smoke |
| `BDA-L3-05` | Reuse Supabase synthetic user flow | Reuse pola `telegram-{id}@banplex.local` dan `APP_AUTH_SECRET` untuk Supabase sign-in/create | Schema change, new identity model | `BDA-L3-04` | Browser dan Mini App resolve ke Supabase user Telegram yang sama | Lint/build + auth smoke |
| `BDA-L3-06` | Return auth payload mirror | Endpoint mengembalikan `session`, `profile`, `memberships`, `role` seperti `/api/auth` | Web-specific role model | `BDA-L3-05` | Frontend bisa reuse auth mapping | Lint/build + API response smoke |
| `BDA-L3-07` | Extend `useAuthStore` carefully | Tambah browser auth initializer tanpa mengubah Telegram initializer | Auth store rewrite | `BDA-L3-06` | Satu auth state tetap dipakai untuk Telegram dan browser | Lint/build + mobile/browser auth smoke |
| `BDA-L3-08` | Browser session setSession | Browser login menyimpan Supabase session via `supabase.auth.setSession` | Cookie/BFF session | `BDA-L3-07` | API wrappers bisa memakai Bearer token existing | Lint/build + authenticated API smoke |
| `BDA-L3-09` | Browser logout behavior | Logout desktop memanggil Supabase signOut/state clear existing | Server revoke, Telegram logout | `BDA-L3-08` | Logout browser tidak memengaruhi Mini App session | Lint/build + logout smoke |
| `BDA-L3-10` | Non-member denied state | User Telegram valid tanpa membership aktif mendapat denied generic contact admin | Invite/redeem browser | `BDA-L3-08` | Tidak ada data team bocor ke non-member | Lint/build + denied smoke |

### Level L4 - Integration Hardening

| ID | Judul | Scope In | Scope Out | Dependency | Definition of Done | Validasi |
| --- | --- | --- | --- | --- | --- | --- |
| `BDA-L4-01` | Intended route redirect | Simpan intended route aman dan redirect setelah login | Last visited route persistence | `BDA-L3-08` | Deep link protected route bisa lanjut setelah login | Lint/build + route smoke |
| `BDA-L4-02` | Security logging baseline | Pastikan browser-auth log stage/error tanpa token/payload sensitif | DB audit table | `BDA-L3-10` | Debug cukup di server log, token tidak tercetak | Code audit + lint/build |
| `BDA-L4-03` | Token leakage audit | Audit no token in URL/log/UI dan no service role exposure | CSP implementation | `BDA-L4-02` | Security baseline documented in output | Code audit + lint/build |
| `BDA-L4-04` | Rate limit proposal note | Tambah lightweight rate-limit recommendation untuk production rollout | Implement infra rate limit jika belum disetujui | `BDA-L4-03` | Owner tahu hardening sebelum rollout luas | Docs/code audit |
| `BDA-L4-05` | Mobile Telegram regression smoke | Jalankan mobile smoke: auth/bootstrap, bottom nav, Dashboard, Jurnal, one standalone form | Full e2e suite kecuali diminta | `BDA-L4-03` | Tidak ada regresi mobile dari desktop/auth changes | Smoke result |
| `BDA-L4-06` | Desktop browser smoke | Jalankan desktop 1366px smoke: login, sidebar/topbar, Dashboard, Jurnal, logout | Full cross-browser matrix | `BDA-L4-05` | POC siap preview internal | Smoke result |
| `BDA-L4-07` | Preview rollout checklist | Siapkan checklist enable flag preview, Owner/Admin test, rollback flag off | Production enable | `BDA-L4-06` | Preview internal bisa dijalankan terkontrol | Docs-only diff/checklist |

### Level L5 - Page Adaptation V1

| ID | Judul | Scope In | Scope Out | Dependency | Definition of Done | Validasi |
| --- | --- | --- | --- | --- | --- | --- |
| `BDA-L5-01` | Reports desktop read shell | Adaptasi Reports read/report layout desktop menggunakan API/store existing | PDF settings, calculation changes | `BDA-L4-07` | Reports nyaman di desktop tanpa source-of-truth baru | Lint/build + desktop Reports smoke |
| `BDA-L5-02` | Reports browser PDF download priority | Pastikan desktop mengutamakan browser download; Telegram DM tetap fallback/transport | Mengubah PDF template/kalkulasi | `BDA-L5-01` | PDF flow desktop tidak mengubah reporting truth | Lint/build + PDF smoke |
| `BDA-L5-03` | Reports future data table design note | Dokumentasikan kolom minimal future data table Reports sebelum implementasi table | Implement data table | `BDA-L5-02` | Scope future table jelas dan tidak masuk POC | Docs-only check |
| `BDA-L5-04` | Payments hub/list desktop shell | Adaptasi Payments hub/list untuk desktop read/navigation | Payment form, create/update/delete payment | `BDA-L5-02` | Payment hub/list desktop usable tanpa mutation baru | Lint/build + desktop Payments smoke |
| `BDA-L5-05` | Payment form deferral guard | Pastikan route/form payment tetap memakai behavior existing dan tidak dipaksa desktop rewrite | Desktop payment form | `BDA-L5-04` | Flow bayar high-risk tetap mobile-safe sampai task khusus | Lint/build + payment route smoke |
| `BDA-L5-06` | Jurnal future data table design note | Dokumentasikan kolom minimal future data table Jurnal dan dependency source-of-truth | Implement data table | `BDA-L5-04` | Future table tidak menjadi scope creep di POC | Docs-only check |

#### Level L5 - Dashboard Redesign Addendum

Addendum ini khusus untuk redesign desktop `Dashboard` sebagai home hub desktop dan tidak menggantikan sequencing auth/browser foundation yang sudah ada.

| ID | Judul | Scope In | Scope Out | Dependency | Definition of Done | Validasi |
| --- | --- | --- | --- | --- | --- | --- |
| `BDA-L5-D1` | Lock dashboard redesign contract | `docs/browser-desktop-auth-adaptation-plan-2026-04-25.md`, `docs/browser-desktop-auth-adaptation-backlog-2026-04-25.md` | `src/App.jsx`, `api/auth.js`, `supabase/migrations/*`, `package.json`, `package-lock.json` | `BDA-L2-08` | Contract resmi menetapkan scope `Dashboard` only di route `/`, layout home hub desktop, header sederhana, 4 kartu 2x2, side-panel cash flow chart, preview table read-only, no action grid, no new source-of-truth, dan access `Owner/Admin` only | Docs-only check |
| `BDA-L5-D2` | Define dashboard home layout adapter | `src/pages/Dashboard.jsx`, desktop layout wrapper terkait | `src/components/layouts/MainLayout.jsx`, `src/components/ui/BottomNav.jsx`, route tree global, browser auth flow | `BDA-L5-D1` | Ada layout adapter desktop additive khusus route `/` yang menempatkan chart di side panel, mempertahankan 4 kartu ringkasan, dan tidak mengubah shell mobile existing | Lint/build + mobile/desktop visual smoke |
| `BDA-L5-D3` | Freeze composite dashboard data mapping | `src/pages/Dashboard.jsx`, `src/store/useDashboardStore.js`, `src/store/useBillStore.js`, `src/store/useIncomeStore.js`, `src/store/useReportStore.js`, `src/lib/transactions-api.js` read contract audit | endpoint baru, server aggregation baru, schema/migration, payment/report/dashboard source changes | `BDA-L5-D2` | Mapping dashboard hanya memakai source existing: `summary`, `workspaceTransactions`, `bills`, `loans`, `portfolioSummary`, dan `cashMutations`; tidak ada derived source baru untuk desktop layout | Code audit + lint/build |
| `BDA-L5-D4` | Add stacked cash-flow side chart | `src/pages/Dashboard.jsx`, desktop chart wrapper terkait | chart source baru, chart mode tambahan, redesign beyond single chart, `package.json` tanpa approval khusus | `BDA-L5-D3` | Dashboard desktop menampilkan chart `Cash Flow Trend` berbentuk `stacked bar`, rentang `14 hari`, CTA ke `/transactions`, tanpa mengubah canonical data | Lint/build + desktop Dashboard smoke |
| `BDA-L5-D5` | Add read-only activity preview table | `src/pages/Dashboard.jsx`, table wrapper terkait, `src/lib/transaction-presentation.js` bila perlu label presentasi | action card grid, inline mutation, global search, route baru | `BDA-L5-D3` | Preview aktivitas terbaru tampil sebagai table read-only 8 baris dari `workspaceTransactions` dengan kolom `Waktu`, `Jenis`, `Deskripsi`, `Nominal`, `Status` dan filter `Semua/Hari Ini/Proyek` tetap ada | Lint/build + desktop Dashboard smoke |
| `BDA-L5-D6` | Preserve Tagihan CTA, refresh, and filters | `src/pages/Dashboard.jsx` | menghapus kartu `Tagihan Pending`, refresh header, atau filter chips existing | `BDA-L5-D2` | `Tagihan Pending` tetap CTA alert card, tombol refresh tetap ada, header tetap sederhana, dan filter chips dashboard tetap jalan tanpa menambah artefak UI baru | Lint/build + desktop Dashboard smoke |
| `BDA-L5-D7` | Validate dashboard access gate and regression boundary | `src/pages/Dashboard.jsx`, desktop smoke checklist, docs output task | auth/browser foundation rewrite, dependency install tanpa approval, perubahan `/api/auth` | `BDA-L5-D6` | Dashboard desktop aman untuk `Owner/Admin` only, mobile shell tetap authority di bawah `lg`, tidak ada perubahan `/api/auth` atau `MainLayout`/`BottomNav`, dan navigasi ke `/transactions` tetap tersedia via CTA chart | Lint/build + mobile/desktop smoke |

#### Level L5 - Reports Redesign Addendum

Addendum ini khusus untuk redesign desktop `Reports` dan tidak menggantikan sequencing auth/browser foundation yang sudah ada.

| ID | Judul | Scope In | Scope Out | Dependency | Definition of Done | Validasi |
| --- | --- | --- | --- | --- | --- | --- |
| `BDA-L5-R1` | Lock reports redesign contract | `docs/browser-desktop-auth-adaptation-plan-2026-04-25.md`, `docs/browser-desktop-auth-adaptation-backlog-2026-04-25.md` | `src/App.jsx`, `api/auth.js`, `supabase/migrations/*`, `package.json`, `package-lock.json` | `BDA-L5-01` | Contract resmi menetapkan scope `Reports` only, `hybrid summary`, `Flowbite shell only`, chart `Cash Flow Trend` + `Project Profit Comparison`, PDF download-first, dan no new source-of-truth | Docs-only check |
| `BDA-L5-R2` | Define reports desktop layout adapter | `src/pages/ProjectsPage.jsx`, `src/components/ProjectReport.jsx`, desktop layout wrapper terkait | `src/components/layouts/MainLayout.jsx`, `src/components/ui/BottomNav.jsx`, route tree global, browser auth flow | `BDA-L5-R1` | Ada layout adapter desktop khusus `/reports` yang additive di `lg` ke atas tanpa mengubah shell mobile existing | Lint/build + mobile/desktop visual smoke |
| `BDA-L5-R3` | Map executive chart inputs from canonical payload | `src/components/ProjectReport.jsx`, `src/store/useReportStore.js`, `src/lib/reports-api.js`, `api/records.js` read contract audit | endpoint baru, server aggregation baru, schema/migration, payment/dashboard source changes | `BDA-L5-R2` | Mapping chart hanya memakai `reportData.summary`, `cashMutations`, dan `projectSummaries` existing; tidak ada contract drift dari `/api/records` | Code audit + lint/build |
| `BDA-L5-R4` | Add desktop executive chart surface | `src/components/ProjectReport.jsx`, desktop shell/chart wrapper terkait | redesign mode report lain, PDF template, mobile-only primitives global, `package.json` tanpa approval khusus | `BDA-L5-R3` | Mode `executive_finance` di desktop menampilkan KPI existing + chart `Cash Flow Trend` dan `Project Profit Comparison` tanpa mengubah total canonical | Lint/build + desktop Reports smoke |
| `BDA-L5-R5` | Reposition filters and PDF actions | `src/components/ProjectReport.jsx`, `src/pages/ProjectsPage.jsx` | kontrak filter, kontrak PDF, `src/lib/report-pdf.js`, `api/report-pdf-delivery.js` | `BDA-L5-R4` | Filter, mode laporan, dan action PDF tetap memakai flow existing, hanya diposisikan ulang agar desktop lebih efisien | Lint/build + desktop Reports smoke |
| `BDA-L5-R6` | Preserve non-executive report modes | `src/components/ProjectReport.jsx`, desktop wrapper terkait | source-of-truth party statement, project PL, cash-flow API contract, master/auth/store di luar report scope | `BDA-L5-R5` | `project_pl`, `cash_flow`, dan party statements tetap usable di desktop tanpa redesign total dan tanpa perubahan kontrak data | Lint/build + targeted report-mode smoke |
| `BDA-L5-R7` | Validate reports regression boundary | `/reports` desktop/mobile smoke checklist, docs output task | full auth stream, payments, dashboard, stock, migrations, dependency install tanpa approval | `BDA-L5-R6` | Validasi task menegaskan mobile shell tetap authority di bawah `lg`, desktop report aman untuk `Owner/Admin`, dan tidak ada perubahan `/api/auth`, `MainLayout`, `BottomNav`, atau source-of-truth report | Lint/build + mobile/desktop smoke |

#### Level L5 - Payments Redesign Addendum

Addendum ini khusus untuk redesign desktop `Payments` sebagai settlement hub/list desktop dan tidak menggantikan sequencing auth/browser foundation yang sudah ada.

| ID | Judul | Scope In | Scope Out | Dependency | Definition of Done | Validasi |
| --- | --- | --- | --- | --- | --- | --- |
| `BDA-L5-P1` | Lock payments redesign contract | `docs/browser-desktop-auth-adaptation-plan-2026-04-25.md`, `docs/browser-desktop-auth-adaptation-backlog-2026-04-25.md` | `src/App.jsx`, `api/auth.js`, `supabase/migrations/*`, `package.json`, `package-lock.json` | `BDA-L5-03` | Contract resmi menetapkan scope `Payments` only di route `/pembayaran`, layout settlement hub/list desktop, detail group `?group=`, no new source-of-truth, payment routes tetap standalone, dan access awal tetap mengikuti gate desktop browser plan existing | Docs-only check |
| `BDA-L5-P2` | Define payments hub layout adapter | `src/pages/PaymentsPage.jsx`, desktop layout wrapper terkait | `src/components/layouts/MainLayout.jsx`, `src/components/ui/BottomNav.jsx`, route tree global, browser auth flow | `BDA-L5-P1` | Ada layout adapter desktop additive khusus `/pembayaran` yang mempertahankan tiga blok utama `Histori settlement`, `Tagihan`, dan `Pinjaman`, dengan area detail group aktif di split/rail desktop | Lint/build + mobile/desktop visual smoke |
| `BDA-L5-P3` | Freeze payment hub read sources | `src/pages/PaymentsPage.jsx`, `src/lib/transaction-presentation.js`, `src/lib/records-api.js`, `src/lib/transactions-api.js`, `src/store/useDashboardStore.js` read contract audit | endpoint baru, server aggregation baru, schema/migration, payment/report/dashboard source changes | `BDA-L5-P2` | Mapping payments hanya memakai source existing: `workspaceTransactions`, `bills`, `loans`, dan `deletedBillPayments`; tidak ada read model baru untuk settlement hub | Code audit + lint/build |
| `BDA-L5-P4` | Preserve group detail split workspace | `src/pages/PaymentsPage.jsx`, detail/group wrapper terkait | modal rewrite, nested route baru, payment form rewrite, new history contract | `BDA-L5-P3` | Mode `?group=` tetap menampilkan detail settlement worker dengan tab `Summary`, `Rekap`, dan `Riwayat` dalam page yang sama tanpa memecah route baru | Lint/build + desktop Payments smoke |
| `BDA-L5-P5` | Preserve payment route boundaries | `src/pages/PaymentPage.jsx`, route config terkait, `src/pages/PaymentsPage.jsx` entry point | redesign payment form, new payment state model, source-of-truth mutation changes | `BDA-L5-P4` | Bill payment tetap membuka `/payment/:id`, loan payment tetap membuka `/loan-payment/:id`, dan history entry tetap membuka `/transactions/:id?surface=pembayaran` | Lint/build + payment-route smoke |
| `BDA-L5-P6` | Preserve settlement actions and visibility | `src/pages/PaymentsPage.jsx`, `src/pages/PaymentPage.jsx`, `src/store/usePaymentStore.js` bila perlu untuk action visibility | permission matrix baru, bulk action redesign, inline mutation surface baru | `BDA-L5-P5` | Receipt send, archive, restore, dan permanent delete tetap mengikuti helper/role existing tanpa matrix baru, dan desktop tidak memunculkan action yang sebelumnya tidak tersedia | Lint/build + desktop Payments smoke |
| `BDA-L5-P7` | Validate payments regression boundary | `/pembayaran` desktop/mobile smoke checklist, docs output task | full auth stream, dashboard, reports, stock, migrations, dependency install tanpa approval | `BDA-L5-P6` | Validasi task menegaskan mobile shell tetap authority di bawah `lg`, desktop payments aman untuk role gate existing, dan tidak ada perubahan `/api/auth`, `MainLayout`, `BottomNav`, atau source-of-truth settlement | Lint/build + mobile/desktop smoke |

#### Level L6 - Master Redesign Addendum

Addendum ini khusus untuk redesign desktop `Master` sebagai workspace CRUD desktop dan tidak menggantikan sequencing auth/browser foundation yang sudah ada.

| ID | Judul | Scope In | Scope Out | Dependency | Definition of Done | Validasi |
| --- | --- | --- | --- | --- | --- | --- |
| `BDA-L6-M1` | Lock master redesign contract | `docs/browser-desktop-auth-adaptation-plan-2026-04-25.md`, `docs/browser-desktop-auth-adaptation-backlog-2026-04-25.md` | `src/App.jsx`, `api/auth.js`, `supabase/migrations/*`, `package.json`, `package-lock.json` | `BDA-L5-P7` | Contract resmi menetapkan scope `Master` only di route `/master`, workspace CRUD desktop, panel overview di atas tab strip, 8 tab entity existing, route-based forms, recycle bin, dan no new source-of-truth | Docs-only check |
| `BDA-L6-M2` | Define master overview layout adapter | `src/components/MasterDataManager.jsx`, `src/pages/MasterPage.jsx`, desktop layout wrapper terkait | `src/components/layouts/MainLayout.jsx`, `src/components/ui/BottomNav.jsx`, route tree global, browser auth flow | `BDA-L6-M1` | Ada layout adapter desktop additive khusus `/master` yang menempatkan overview counts dan hotspot di atas top tabs tanpa mengubah shell mobile existing | Lint/build + mobile/desktop visual smoke |
| `BDA-L6-M3` | Preserve card-based entity lists | `src/components/MasterDataManager.jsx`, `src/components/master/masterTabs.js`, `src/store/useMasterStore.js` read contract audit | table rewrite, list virtualization, new entity source-of-truth, schema/migration, endpoint baru | `BDA-L6-M2` | Delapan tab entity tetap card-based seperti existing, dengan data berasal dari store/entity collection existing dan tanpa rewrite tabel desktop | Code audit + lint/build |
| `BDA-L6-M4` | Preserve route-based CRUD and recycle bin | `src/pages/MasterFormPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, route config terkait | modal CRUD baru, inline editor, split-detail workspace, mutation model baru | `BDA-L6-M3` | Create/edit tetap lewat route `/master/:tab/add` dan `/master/:tab/edit/:id`, recycle bin tetap di route existing, dan tidak ada modal CRUD baru | Lint/build + route smoke |
| `BDA-L6-M5` | Preserve dependency guards and capability gate | `src/components/MasterDataManager.jsx`, `src/store/useMasterStore.js` | permission matrix baru, delete guard redesign, role source baru, auth rewrite | `BDA-L6-M4` | Delete guard existing tetap mencegah penghapusan record yang masih dipakai, dan access implementasi awal tetap `Owner/Admin` only sesuai gate existing | Lint/build + master delete-guard smoke |
| `BDA-L6-M6` | Validate master regression boundary | `/master` desktop/mobile smoke checklist, docs output task | full auth stream, dashboard, reports, payments, stock, migrations, dependency install tanpa approval | `BDA-L6-M5` | Validasi task menegaskan mobile shell tetap authority di bawah `lg`, desktop master aman untuk role gate existing, dan tidak ada perubahan `/api/auth`, `MainLayout`, `BottomNav`, atau source-of-truth master | Lint/build + mobile/desktop smoke |

### Level L7 - Deferred / Future Scope

Item berikut sengaja tidak masuk v1 awal. Masing-masing wajib proposal baru sebelum implementasi.

| ID | Area | Alasan deferred | Prasyarat sebelum dibuka |
| --- | --- | --- | --- |
| `BDA-F-01` | Email/password auth | Butuh identity linking Telegram-email | Proposal auth identity + security review |
| `BDA-F-02` | Magic link | Butuh email setup, redirect, anti-abuse, identity linking | Proposal auth identity + email config review |
| `BDA-F-03` | Cookie/BFF session | Butuh CSRF, cookie, refresh, cache, logout design | Security design doc |
| `BDA-F-04` | Data table implementation | Butuh column spec, sorting/filter, empty state, responsive overflow | Page-specific table proposal |
| `BDA-F-05` | Create/edit form desktop | High-risk per domain | Audit form domain + source-of-truth |
| `BDA-F-06` | Payment form desktop | Payment/status derived state high-risk | Payment-specific proposal + smoke |
| `BDA-F-07` | Stock desktop | Negative stock/manual stock-out risk | Stock source-of-truth audit |
| `BDA-F-08` | Payroll desktop | Payroll recap/tagihan upah high-risk | Payroll lifecycle proposal |
| `BDA-F-10` | Team Invite desktop | Auth/workspace sensitive | Role/security proposal |
| `BDA-F-11` | Attachment upload desktop | Storage/RLS/orphan asset risk | Attachment permission audit |
| `BDA-F-12` | HRD/Beneficiaries desktop | Side modules not core desktop v1 | Usage-driven proposal |
| `BDA-F-13` | Global search | Needs cross-domain source/index design | Search source-of-truth proposal |
| `BDA-F-14` | Keyboard shortcuts | Could conflict with form input/write flows | UX/accessibility proposal |
| `BDA-F-15` | Print CSS | Reports/PDF should stabilize first | Reports desktop validated |
| `BDA-F-16` | Offline/PWA | Conflicts with online Supabase/API source-of-truth | Separate offline architecture plan |
| `BDA-F-17` | Analytics/telemetry | Adds dependency/privacy/config work | Owner-approved telemetry plan |
| `BDA-F-18` | Bootstrap dependency | CSS conflict/dependency risk | Dependency proposal + mobile visual regression plan |

## 5. Recommended Execution Order

Urutan eksekusi v1 yang disarankan:

1. `BDA-L0-01`
2. `BDA-L0-02`
3. `BDA-L0-03`
4. `BDA-L0-04`
5. `BDA-L1-01`
6. `BDA-L1-02`
7. `BDA-L1-03`
8. `BDA-L1-04`
9. `BDA-L1-05`
10. `BDA-L2-01`
11. `BDA-L2-02`
12. `BDA-L2-03`
13. `BDA-L2-04`
14. `BDA-L2-05`
15. `BDA-L2-06`
16. `BDA-L2-J1`
17. `BDA-L2-J2`
18. `BDA-L2-J3`
19. `BDA-L2-J4`
20. `BDA-L2-J5`
21. `BDA-L2-J6`
22. `BDA-L2-J7`
23. `BDA-L2-07`
24. `BDA-L2-08`
25. `BDA-L3-01`
26. `BDA-L3-02`
27. `BDA-L3-03`
28. `BDA-L3-04`
29. `BDA-L3-05`
30. `BDA-L3-06`
31. `BDA-L3-07`
32. `BDA-L3-08`
33. `BDA-L3-09`
34. `BDA-L3-10`
35. `BDA-L4-01`
36. `BDA-L4-02`
37. `BDA-L4-03`
38. `BDA-L4-04`
39. `BDA-L4-05`
40. `BDA-L4-06`
41. `BDA-L4-07`
42. `BDA-L5-D1`
43. `BDA-L5-D2`
44. `BDA-L5-D3`
45. `BDA-L5-D4`
46. `BDA-L5-D5`
47. `BDA-L5-D6`
48. `BDA-L5-D7`
49. `BDA-L5-01`
50. `BDA-L5-R1`
51. `BDA-L5-R2`
52. `BDA-L5-R3`
53. `BDA-L5-R4`
54. `BDA-L5-R5`
55. `BDA-L5-R6`
56. `BDA-L5-R7`
57. `BDA-L5-02`
58. `BDA-L5-03`
59. `BDA-L5-P1`
60. `BDA-L5-P2`
61. `BDA-L5-P3`
62. `BDA-L5-P4`
63. `BDA-L5-P5`
64. `BDA-L5-P6`
65. `BDA-L5-P7`
66. `BDA-L6-M1`
67. `BDA-L6-M2`
68. `BDA-L6-M3`
69. `BDA-L6-M4`
70. `BDA-L6-M5`
71. `BDA-L6-M6`
72. `BDA-L5-04`
73. `BDA-L5-05`
74. `BDA-L5-06`

## 6. Stream-Level Definition of Done

V1 stream dianggap selesai jika:

- Browser desktop context dan flag behavior berjalan sesuai decision log.
- Desktop shell POC tersedia untuk Owner/Admin di `lg` ke atas.
- Dashboard + Jurnal usable untuk read/navigation di desktop.
- Jurnal desktop redesign menjaga contract workspace table, three-tab workspace, sticky header, dan no new source-of-truth.
- Browser auth Telegram Login Widget berjalan lewat `/api/browser-auth`.
- `/api/auth` Mini App tetap tidak berubah kontraknya.
- Session browser memakai Supabase SPA session dan API Bearer existing.
- Reports desktop redesign menjaga contract `Reports only`, `hybrid summary`, dan tidak membuat source-of-truth baru.
- Reports read/report + PDF desktop selesai.
- Payments hub/list desktop selesai.
- Mobile Telegram smoke tetap lolos.
- Desktop 1366px smoke tetap lolos.
- Rollback via `VITE_ENABLE_DESKTOP_BROWSER_MODE` terbukti.
- Tidak ada Bootstrap dependency, schema/migration/RLS baru, email/password, magic link, atau MFA v1.

## 7. Task Brief Template untuk Stream Ini

Gunakan template ini untuk setiap micro-task implementasi:

```text
Tujuan:
Backlog ID:
Level:
Source plan:
Source of truth:
Allowed files:
Forbidden files:
Scope in:
Scope out:
Dependencies:
Validation:
Output:
```

Wajib isi `Forbidden files` untuk mencegah scope creep, terutama:

- `supabase/migrations/*`
- `package.json`
- `package-lock.json`
- `docs/unified-crud-workspace-plan-2026-04-18.md`
- `docs/progress/unified-crud-workspace-progress-log.md`
- `/api/auth` kecuali task secara eksplisit menyebut audit/read-only atau approval perubahan Mini App auth.
