# Browser Desktop + Auth Adaptation Plan - 2026-04-25

## 1. Executive Summary

Dokumen ini adalah rencana standalone untuk mendukung penggunaan Banplex Greenfield dari browser desktop biasa tanpa merusak pengalaman Telegram Mini Web App/mobile yang sudah menjadi baseline produk.

Status kerja saat ini:

- Dokumen ini dipakai sebagai planning-only authority untuk stream browser desktop + auth.
- Turn ini bersifat docs-only; tidak ada runtime code yang boleh diubah dari plan ini.
- Audit progres untuk stream ini dicatat di `docs/progress/browser-desktop-auth-adaptation-progress-log.md`.

Alasan dokumen ini dipisahkan dari stream aktif:

- Scope ini bersifat future adaptation, bukan bagian backlog `Unified CRUD Workspace` yang sedang berjalan.
- Desktop/browser menyentuh area high-risk: shell layout, auth/session, role mapping, dan coexistence dengan Telegram Mini Web App.
- Plan ini tidak memberi izin implementasi kode. Implementasi wajib memakai brief terpisah dengan file scope, validasi, dan approval eksplisit.

Prinsip utama:

- Telegram Mini Web App tetap mode utama dan prioritas.
- Mobile shell, bottom navigation, safe-area, routed form, dan UX mobile existing tidak boleh direwrite.
- Desktop adalah adaptive enhancement yang additive, bukan pengganti design system atau source-of-truth baru.
- Bootstrap dipakai sebagai inspirasi pola container/grid/layout, bukan dependency v1 dan bukan rewrite UI.

## 2. Current Repo Reality

Audit repo dilakukan terhadap struktur dan file runtime aktual pada `2026-04-25`.

### Stack dan runtime

- Frontend adalah Vite + React + `react-router-dom`; entry app memakai `BrowserRouter` di `src/main.jsx`.
- Dependency aktif mencakup `@supabase/supabase-js`, `react`, `react-router-dom`, `zustand`, `framer-motion`, `lucide-react`, dan Tailwind; tidak ada Bootstrap dependency di `package.json`.
- `index.html` sudah punya viewport meta dan memuat Telegram WebApp SDK dari `https://telegram.org/js/telegram-web-app.js`.

### Routing dan shell

- Route utama dideklarasikan di `src/App.jsx` dengan lazy-loaded pages.
- Route dalam `MainLayout` mencakup Dashboard, Payroll, Jurnal/Transactions, Payment hub, Reports, Stock, Master, More, dan recycle bin.
- Route standalone di luar `MainLayout` mencakup form create/edit, payment form, HRD, Beneficiaries, Team Invite, PDF settings, dan Master form.
- `src/components/layouts/MainLayout.jsx` memakai shell mobile `max-w-md`, `h-screen`, safe-area padding, dan `BottomNav`.
- `src/components/ui/BottomNav.jsx` adalah fixed bottom navigation mobile dengan quick actions sheet dan keyboard-aware behavior.

### Telegram integration

- `src/hooks/useTelegram.js` membaca `window.Telegram.WebApp`, `initDataUnsafe.user`, `start_param`, MainButton, dan HapticFeedback.
- `src/hooks/useTelegramThemeSync.js` menerapkan Telegram theme variables jika WebApp context ada; jika tidak, fallback ke `prefers-color-scheme`.
- `src/App.jsx` memanggil `tg.ready()` dan `tg.expand()` saat Telegram context tersedia.
- Saat ini `src/App.jsx` selalu memanggil `initializeTelegramAuth` dengan `tg?.initData` dan `startParam`; browser biasa tanpa `initData` akan ditolak kecuali dev bypass lokal aktif.

### Auth dan session

- Auth UI state berada di `src/store/useAuthStore.js`.
- Mini App auth berjalan lewat `POST /api/auth`, yang memverifikasi Telegram `initData`, membuat/sign-in Supabase user synthetic, memastikan `profiles`, mengambil `team_members`, lalu mengembalikan Supabase session.
- Browser Supabase client berada di `src/lib/supabase.js` dengan `persistSession: true`, `autoRefreshToken: true`, dan `detectSessionInUrl: false`.
- API wrapper seperti `src/lib/transactions-api.js`, `src/lib/records-api.js`, `src/lib/reports-api.js`, dan `src/lib/report-delivery-api.js` mengambil Supabase access token lalu mengirim `Authorization: Bearer`.
- `/api/auth` saat ini adalah kontrak Mini App `initData`; kontrak ini harus dianggap frozen untuk browser v1.

### Styling dan design system

- `src/index.css` memakai Tailwind layers dan CSS variables `--app-*` dengan fallback ke `--tg-theme-*`.
- Komponen UI reusable berada di `src/components/ui/AppPrimitives.jsx`, termasuk `PageShell`, `PageHeader`, card, button, sheet/dialog, empty/error state, dan safe-area helpers.
- `src/components/layouts/FormLayout.jsx` sudah mobile-first, full-screen, safe-area aware, dan punya sticky/fixed action footer.
- Dark mode saat non-Telegram context mengikuti system preference lewat hook theme sync.

### Source-of-truth dan freeze docs

- `docs/freeze/00-index.md` adalah baseline planning aktif dan menyatakan package freeze sebagai authority utama.
- `docs/freeze/05-ai-execution-guardrails.md` melarang asumsi bahwa browser adalah mode resmi utama.
- `docs/freeze/03-source-of-truth-contract-map.md` menegaskan domain sensitif memakai API/RPC write boundary dan mencatat beberapa runtime exception direct-client untuk Team, Master, HRD, File, dan Payroll legacy.
- `docs/architecture-source-of-truth-audit-2026-04-24.md` menjadi baseline audit terbaru: app sudah sebagian besar memakai Supabase relational tables + Vercel Serverless wrappers, tetapi beberapa store masih mixed/direct-client.

## 3. Problem Statement

Gap saat app dibuka di browser desktop biasa:

- Tidak ada official desktop/browser entry context; auth bootstrap mengharapkan Telegram Mini App `initData`.
- Shell utama dibatasi `max-w-md`, sehingga desktop hanya melihat mobile app di tengah layar.
- Bottom nav, FAB/quick actions, bottom sheet, full-screen forms, dan safe-area behavior sudah tepat untuk mobile, tetapi bukan layout desktop-native.
- Beberapa halaman list/report berpotensi lebih nyaman di desktop dengan sidebar, topbar, max container, dan table-like layout.

Risiko jika langsung memaksakan layout desktop:

- Regresi mobile karena `MainLayout`, `BottomNav`, `FormLayout`, dan primitives existing sudah saling bergantung pada mobile shell.
- Konflik CSS jika Bootstrap global CSS ditambahkan tanpa isolasi, terutama karena Tailwind preflight dan app CSS variables sudah menjadi design system aktif.
- Source-of-truth drift jika desktop membuat read model/API baru yang tidak mengikuti store/API canonical.
- Flow high-risk seperti payment, stock, payroll, attachment, restore, dan delete bisa rusak jika desktop membuka mutation terlalu awal.

Risiko jika auth browser dicampur tanpa desain:

- `/api/auth` Mini App bisa rusak jika payload Login Widget dan `initData` dipaksakan ke kontrak yang sama.
- Satu orang dapat memiliki dua identity/role jika Telegram identity dan email identity tidak dilink dengan jelas.
- Token/session leakage lebih besar di browser desktop karena Supabase SPA session tersimpan di browser storage.
- Role mismatch bisa terjadi jika browser auth tidak tetap memakai `team_members` dan role/capability existing.

## 4. Design Principles

- Mobile-first tetap default; desktop tidak boleh menjadi mode utama diam-diam.
- Desktop adalah enhancement additive mulai breakpoint `lg`, bukan refactor global.
- Route existing tetap dipakai; shell dipilih dari client context dan breakpoint, bukan route duplicate.
- Tidak menambah helper text, marketing copy, intro panel, placeholder, atau visual artifact di UI selain login/notice minimal yang dibutuhkan.
- Design system existing tetap dipakai: Tailwind, CSS variables `--app-*`, Telegram theme fallback, dan app primitives.
- Bootstrap diposisikan sebagai referensi container/grid/breakpoint, bukan dependency v1.
- Tidak membuat kalkulasi, API read model, atau source-of-truth desktop baru.
- Auth browser v1 harus reuse Telegram identity, Supabase user synthetic, `profiles`, dan `team_members`.
- Email/password, magic link, MFA tambahan, global search, offline/PWA, print CSS, dan analytics baru adalah future scope, bukan v1.

## 5. Decision Log

Keputusan berikut sudah dikunci sebelum dokumen ini dibuat agar implementasi masa depan tidak bergantung pada asumsi liar.

### Browser auth

- Browser v1 wajib memakai Telegram sebagai identitas utama.
- Login browser memakai Telegram Login Widget.
- Endpoint auth browser direkomendasikan sebagai `/api/browser-auth`, terpisah dari `/api/auth`.
- `/api/auth` Mini App dianggap frozen untuk v1.
- Browser auth response sebaiknya mirror field utama `/api/auth`: `session`, `profile`, `memberships`, dan `role`.
- Supabase Auth user browser harus reuse pola synthetic email existing: `telegram-{id}@banplex.local`.
- Password synthetic reuse secret existing berbasis `APP_AUTH_SECRET`; tidak membuat credential model baru.
- Backend Login Widget harus melakukan verifikasi strict sesuai Telegram spec, termasuk signature/hash dan `auth_date`.
- Batas umur payload Login Widget browser v1: 1 jam.
- Service role hanya boleh dipakai server-side secara minimal untuk bootstrap auth.
- Dev bypass hanya boleh development/localhost; production tidak boleh bypass.
- User Telegram valid tetapi tanpa `team_members` aktif ditolak dengan pesan singkat untuk menghubungi admin.
- Error login browser ke user bersifat generic; detail disimpan di server logs.
- V1 tidak menambah schema, migration, RLS policy, MFA, DB audit table, email/password, atau magic link.

### Browser session

- Session browser v1 memakai Supabase SPA session existing dan API Bearer token existing.
- Supabase storage default existing boleh dipakai; risiko XSS/token leakage dicatat di security baseline.
- Logout browser cukup `supabase.auth.signOut()` dan clear auth state existing; tidak logout akun Telegram dan tidak server revoke v1.
- Session Telegram Mini App dan browser desktop bersifat independent; logout satu context tidak otomatis logout context lain.
- CSRF menjadi risk note untuk future cookie/BFF, bukan workstream v1.

### Desktop layout

- Desktop mode aktif mulai breakpoint `lg`.
- Browser desktop memakai route existing yang sama; tidak memakai prefix `/web`.
- Context konseptual: `telegram` dan `desktop-browser`.
- Hook/lib konseptual: `useClientContext`.
- Layout konseptual: `DesktopLayout`.
- Login page konseptual: `BrowserLoginPage`.
- Desktop shell memakai sidebar + topbar.
- Desktop content memakai max container sekitar 1200-1320px.
- Sidebar awal memuat bottom-nav modules plus core More modules seperti Reports, Stock, dan Master.
- Topbar awal menampilkan context halaman, user/role/team ringkas, dan logout.
- Quick actions/FAB disembunyikan pada POC.
- Empty/loading/error state dan toast reuse primitives existing dulu.
- Desktop CSS global, jika diperlukan, harus scoped dengan prefix seperti `.app-desktop-*`; mobile tokens tidak diubah.
- Bootstrap dependency dilarang untuk v1.

### Rollout dan scope

- Env flag default: `VITE_ENABLE_DESKTOP_BROWSER_MODE`.
- Satu flag cukup untuk browser auth + desktop POC v1.
- Jika flag mati, browser desktop menampilkan notice minimal; bukan marketing/placeholder panel.
- Public browser route hanya `/login`.
- Mobile browser biasa dan tablet non-Telegram di bawah `lg` menampilkan notice minimal untuk membuka dari Telegram.
- Browser desktop v1 memakai same origin/domain dengan Mini App.
- Telegram Login Widget domain/bot setup masuk pre-implementation checklist.
- Setelah login, redirect ke intended route yang aman atau `/`.
- Deep link ke protected routes existing boleh, tetap lewat auth guard.
- Role browser mengikuti role/capability existing; tidak ada permission matrix paralel.
- API existing tidak perlu membedakan token browser vs Mini App pada v1.
- Rollout awal digate env flag + Owner/Admin.
- POC desktop awal hanya Owner/Admin, read + navigation, tanpa write/mutation.
- POC pertama: Dashboard + Jurnal.
- Setelah POC: Reports read/report + PDF, lalu Payments hub/list.
- Payment form, create/edit forms, stock, payroll, master, team invite, attachment/upload, HRD, dan Beneficiaries tidak masuk fase awal.
- Form desktop diputus case-by-case per domain.
- Data table desktop adalah arah future untuk list besar, tetapi POC tidak wajib rewrite table.
- Minimal kolom future Jurnal desktop: tanggal, tipe, pihak/proyek, deskripsi, status, nominal, aksi/detail.
- Minimal kolom future Reports desktop: project/unit, income, expense, paid, remaining, status/health, aksi PDF/detail.

### Validation dan release

- Validasi implementasi desktop nanti wajib mencakup mobile + desktop smoke.
- Minimum viewport test: mobile existing + desktop 1366px.
- Mobile smoke wajib mencakup auth/bootstrap Mini App, bottom nav, Dashboard, Jurnal, dan satu standalone form.
- Target browser awal: modern Chromium/Edge; Firefox/Safari best-effort.
- Release harus preview internal first sebelum production flag dinyalakan.
- Rollback utama adalah disable `VITE_ENABLE_DESKTOP_BROWSER_MODE`.
- Dokumen ini bukan izin implementasi; coding wajib brief implementasi terpisah.
- Progress log aktif untuk stream ini berada di `docs/progress/browser-desktop-auth-adaptation-progress-log.md`.

## 6. Frontend Desktop Adaptation Plan

### Opsi A - Tailwind tetap utama, Bootstrap-like layout dibuat manual

Deskripsi:

- Tetap memakai Tailwind + CSS variables existing.
- Buat desktop shell, grid, container, sidebar/topbar, dan responsive utilities dengan utility classes atau class scoped `.app-desktop-*`.
- Bootstrap dijadikan referensi mental model: container max width, 12-column grid, breakpoint tier, gutters, dan responsive display.

Kelebihan:

- Risiko konflik CSS paling rendah.
- Tidak menambah dependency dan tidak mengubah global reset.
- Konsisten dengan current design system dan app tokens.
- Lebih mudah menjaga mobile shell tetap utuh.

Kekurangan:

- Perlu membuat pola layout sendiri.
- Developer harus disiplin agar pola Bootstrap-like tidak berubah-ubah antar halaman.
- Tidak mendapat komponen siap pakai Bootstrap.

Risiko regresi mobile:

- Rendah jika desktop layer benar-benar additive dan aktif di `lg` ke atas.
- Tetap perlu mobile smoke karena `App`/auth/layout selection akan berubah saat implementasi.

Effort:

- Medium. Perlu shell dan adapter, tetapi tidak perlu mengisolasi CSS pihak ketiga.

Status rekomendasi:

- Direkomendasikan untuk v1.

### Opsi B - Menambahkan Bootstrap hanya untuk desktop shell tertentu

Deskripsi:

- Install Bootstrap dan pakai CSS/komponen Bootstrap untuk desktop shell atau halaman tertentu.

Kelebihan:

- Cepat mendapat grid/container/table conventions yang familiar.
- Dokumentasi dan pola layout luas.

Kekurangan:

- Menambah dependency.
- Bootstrap CSS global dapat memengaruhi element base, utility, form, button, dan spacing.
- Butuh strategi isolasi serius agar tidak bentrok dengan Tailwind preflight dan `src/index.css`.
- Tidak sesuai instruksi v1 yang melarang dependency baru.

Risiko regresi mobile:

- Tinggi jika Bootstrap CSS masuk global bundle tanpa scope.
- Medium jika diisolasi ketat, tetapi tetap butuh proof dan approval.

Effort:

- Medium-high karena konflik CSS dan QA bertambah.

Status rekomendasi:

- Tidak direkomendasikan untuk v1. Hanya boleh dibuka ulang lewat proposal dependency khusus.

### Opsi C - Hybrid token/layout adapter

Deskripsi:

- Buat layer token/layout adapter sendiri yang terinspirasi Bootstrap, misalnya desktop container, row/col, table wrapper, dan sidebar primitives.
- Tidak install Bootstrap; naming bisa disesuaikan dengan app vocabulary.

Kelebihan:

- Lebih reusable dari utility-only.
- Cocok jika desktop adaptation berkembang ke banyak halaman.
- Tetap menjaga CSS dan tokens existing.

Kekurangan:

- Butuh desain abstraction yang hati-hati agar tidak overengineering.
- Risiko membuat parallel design system jika terlalu besar.

Risiko regresi mobile:

- Low-medium jika adapter hanya dipakai di `DesktopLayout` dan halaman desktop.

Effort:

- Medium-high untuk setup awal, lebih hemat di fase berikutnya.

Status rekomendasi:

- Cocok sebagai evolusi setelah Opsi A terbukti melalui POC.

### Rekomendasi final frontend

Gunakan Opsi A untuk v1: Tailwind tetap utama dengan Bootstrap-like responsive layout manual. Jika desktop adoption tumbuh, evolusikan ke Opsi C secara bertahap. Jangan menambahkan Bootstrap dependency pada v1.

## 7. Recommended Desktop UI Architecture

### Context selection

Future implementation harus membuat context detection terpusat, konseptualnya `useClientContext`.

Sumber context:

- Ada atau tidaknya `window.Telegram.WebApp`.
- Ada atau tidaknya `tg.initData`.
- Breakpoint `lg` ke atas.
- Status `VITE_ENABLE_DESKTOP_BROWSER_MODE`.
- Development-only dev bypass existing.

Behavior:

- `telegram`: pakai Mini App bootstrap, `MainLayout`, `BottomNav`, Telegram theme, dan current mobile behavior.
- `desktop-browser`: pakai browser login/session, `DesktopLayout`, same route tree, dan system theme/app tokens.
- `mobile-browser-non-telegram`: tampilkan notice minimal untuk membuka dari Telegram.
- Desktop flag off: tampilkan notice minimal, bukan membuka unofficial desktop shell.

### Shell

`DesktopLayout` future harus berada sebagai layout baru, bukan refactor besar `MainLayout`.

Elemen utama:

- Sidebar untuk navigasi modul.
- Topbar untuk context halaman, role/team ringkas, dan logout.
- Main content dengan max container 1200-1320px.
- Content area scrollable tanpa bottom nav padding.
- Route content tetap lazy-loaded seperti baseline `src/App.jsx`.

Sidebar awal:

- Beranda.
- Jurnal.
- Payroll.
- Menu.
- Reports.
- Stock.
- Master.

Catatan: Link ke Stock/Master boleh ada sebagai navigasi, tetapi desktop adaptation page tersebut tidak otomatis masuk fase awal.

Topbar awal:

- Page/module context.
- User name jika tersedia.
- Role dan team ringkas.
- Logout.
- Optional link minimal ke Telegram/Mini App di account menu.

### Responsive boundary

- Di bawah `lg`, shell mobile existing tetap authority.
- Di `lg` ke atas, browser desktop dapat memakai `DesktopLayout` jika flag aktif dan session valid.
- Tidak memakai route prefix `/web`; semua route existing tetap protected.
- Jika user membuka deep link browser, guard menyimpan intended route lalu redirect setelah login.

### Cara menjaga mobile bottom nav tetap aman

- Jangan ubah `BottomNav` untuk POC desktop.
- Jangan pindahkan quick actions/FAB ke desktop pada POC.
- Jangan ubah `MainLayout` mobile spacing, `max-w-md`, safe-area, atau bottom padding untuk membuat desktop terlihat lebar.
- Desktop shell harus menjadi sibling/alternative layout, bukan modifier agresif dari mobile shell.

### Cara mencegah konflik Bootstrap CSS

- V1 tidak menambahkan Bootstrap dependency.
- Jika suatu saat Bootstrap dibuka ulang, wajib ada proposal teknis dependency dengan:
  - alasan tidak cukup memakai Tailwind,
  - scope CSS terisolasi,
  - test mobile visual regression,
  - audit form/button/table/global reset,
  - rollback plan.
- Untuk v1, class desktop global harus scoped, misalnya `.app-desktop-shell`, `.app-desktop-sidebar`, `.app-desktop-container`.
- Jangan mengubah token `--app-*` existing kecuali ada task design-system khusus.

### Komponen yang sebaiknya tidak disentuh pada fase awal

- `MainLayout` mobile, kecuali hanya untuk memilih layout di parent.
- `BottomNav`.
- `FormLayout` dan routed form high-risk.
- Payment form.
- Stock manual stock-out.
- Payroll recap/generate.
- Team Invite/Admin management.
- Master CRUD.
- Attachment upload/storage.

### Komponen yang dapat menjadi adapter desktop

- `DesktopLayout` baru.
- `BrowserLoginPage` baru.
- `useClientContext` atau helper context baru.
- Desktop navigation mapping yang reuse route metadata existing.
- Wrapper desktop untuk Dashboard/Jurnal read surfaces.
- Future data table adapter untuk Jurnal/Reports setelah POC.

## 8. Auth Recommendation for Small Team Web Browser Usage

Target usage adalah tim kecil/internal team, bukan public SaaS besar.

### Opsi auth dibandingkan

| Opsi | Kelebihan | Kekurangan | Status |
| --- | --- | --- | --- |
| Telegram-only via Login Widget | Reuse identity utama, role `team_members`, dan Supabase user synthetic existing | User browser tetap harus punya Telegram | Direkomendasikan v1 |
| Shared session dengan Telegram Mini App | Terlihat seamless jika satu device/context | Sulit karena Telegram WebView dan browser desktop berbeda context/device; risiko leakage | Tidak direkomendasikan v1 |
| Email/password internal team | Familiar untuk browser | Butuh identity linking agar tidak membuat user/role paralel | Future only |
| Magic link | Passwordless dan cocok internal | Butuh email setup, redirect config, identity linking, dan abuse/rate-limit review | Future only |
| Supabase Auth native email | Sudah tersedia di stack | Tanpa linking ke Telegram bisa memecah role model | Future only |
| Admin-created users | Kontrol owner lebih kuat | Menambah admin lifecycle dan credential policy | Future only |

### Rekomendasi final

Browser desktop v1 memakai Telegram Login Widget dengan backend endpoint baru `/api/browser-auth`.

Flow konseptual:

1. Browser membuka `/login`.
2. Telegram Login Widget mengembalikan signed payload.
3. `/api/browser-auth` memverifikasi hash/signature dan `auth_date`.
4. Server resolve `telegram_user_id`.
5. Server reuse synthetic Supabase user pattern existing.
6. Server ensure/read `profiles` dan `team_members`.
7. Server mengembalikan Supabase `session`, `profile`, `memberships`, dan `role`.
8. Frontend memanggil `supabase.auth.setSession`.
9. App memakai `useAuthStore` sebagai auth UI state tunggal.

### Security baseline

- Verifikasi Login Widget harus server-side.
- Payload Login Widget maksimal berumur 1 jam.
- `service_role` hanya di serverless function dan tidak pernah terekspos ke browser.
- Browser auth tidak boleh menerima role dari client.
- Authorization tetap dari `team_members` dan capability existing.
- Jangan memakai `user_metadata` untuk authorization decision.
- Jangan log access token, refresh token, service key, atau full signed payload.
- UI auth error generic; server logs menyimpan detail stage/error.
- Rate limit lightweight direkomendasikan sebelum production rollout luas.
- XSS baseline: tidak memakai unsafe HTML, tidak memasukkan token ke URL, tidak menyimpan token di custom logs, dan CSP bisa menjadi hardening setelah audit script Telegram/Vite/Vercel.

### Session/cookie/token strategy

V1 tetap SPA token strategy:

- Supabase session disimpan oleh client existing.
- API wrappers tetap memakai Bearer token.
- Tidak menambah cookie session.
- Tidak menambah CSRF token.

Future cookie/BFF only:

- Jika pindah ke cookie/BFF, wajib review `Secure`, `HttpOnly`, `SameSite`, CSRF, cache key, server refresh handling, dan logout/revoke behavior.

### Role mapping

- Role final tetap dari `team_members.role`.
- `profiles` tetap link Supabase user ke `telegram_user_id`.
- Browser tidak membuat role matrix paralel.
- Multi-team behavior reuse `currentTeamId` dan `selectTeam` existing; explicit team switcher bukan scope awal.

### Cara menjaga Telegram Web App auth tetap tidak terganggu

- `/api/auth` Mini App tidak diubah untuk v1 browser.
- Browser auth memakai endpoint baru.
- Telegram Mini App tetap membutuhkan `initData`.
- Dev bypass existing tetap hanya development/localhost.
- Mobile Mini App smoke wajib dijalankan pada implementasi desktop/auth nanti.

## 9. One Environment Strategy

Telegram Mini Web App dan browser desktop dapat hidup dalam satu environment dengan batas berikut.

### Same backend dan database

- Tetap memakai Vercel Serverless Functions existing.
- Tetap memakai Supabase Auth, `profiles`, `teams`, `team_members`, dan source-of-truth relational existing.
- Tidak membuat database atau API read model khusus desktop pada v1.

### Different client entry context

- Telegram context memakai `window.Telegram.WebApp` dan `initData`.
- Browser desktop context memakai Telegram Login Widget dan Supabase SPA session.
- Context detection harus terpusat agar layout/auth flow tidak tersebar di banyak file.

### Auth boundary

- Mini App: `/api/auth`.
- Browser desktop: `/api/browser-auth`.
- Keduanya menghasilkan Supabase session untuk user Telegram yang sama.
- Keduanya membaca membership yang sama.

### Role/permission consistency

- API existing tetap authorize berdasar Supabase user/profile/team/role.
- Browser v1 tidak perlu claim khusus untuk membedakan browser vs Mini App.
- Jika future membutuhkan per-context permission, itu harus menjadi auth/RLS proposal terpisah.

### Risiko dan mitigasi

- Context mismatch: mitigasi dengan `useClientContext`.
- Role mismatch: mitigasi dengan source tunggal `team_members`.
- Session leakage: mitigasi dengan no token logging, XSS baseline, logout, dan future CSP.
- Mobile regression: mitigasi dengan additive `DesktopLayout` dan mobile smoke.
- Desktop flag bug: mitigasi dengan rollback via env flag.

## 10. Implementation Roadmap Draft

Roadmap ini konseptual dan bukan backlog aktif.

### Phase 0 - Confirm decisions

- Review dokumen ini.
- Pastikan domain Login Widget dikonfigurasi pada bot/domain production/preview yang relevan.
- Pastikan `VITE_ENABLE_DESKTOP_BROWSER_MODE` disepakati sebagai flag.
- Buat brief implementasi terpisah sebelum coding.

### Phase 1 - Desktop shell proof-of-concept

- Tambah context detection terpusat.
- Tambah `DesktopLayout` di balik env flag dan role Owner/Admin.
- Route tetap sama; mobile shell tetap unchanged.
- POC Dashboard + Jurnal read/navigation.
- Quick actions dan write/mutation desktop disembunyikan.
- Validasi mobile smoke + desktop 1366px.

### Phase 2 - Browser auth foundation

- Tambah `/login` dan `BrowserLoginPage`.
- Tambah `/api/browser-auth`.
- Implement Telegram Login Widget verification strict.
- Reuse Supabase user synthetic pattern, session response, and `team_members` role mapping.
- Keep `/api/auth` Mini App frozen.
- Preview internal first.

Catatan sequencing: Phase 1 dan Phase 2 dapat dipisah atau diurutkan sesuai kebutuhan preview. Browser auth harus selesai sebelum production desktop browser dipakai oleh user nyata.

### Phase 3 - Page-by-page desktop adaptation

- Jurnal contract + first table adaptation first.
- Dashboard home hub next.
- Reports read/report + PDF download after Dashboard.
- Payments hub/list after Reports.
- Master workspace CRUD after Payments.
- Future data table adapter untuk Jurnal dan Reports.
- Forms, payment form, payroll, stock, master, team, attachments, HRD, dan Beneficiaries hanya setelah audit per-domain.

### Phase 3A - Reports desktop redesign contract

Keputusan khusus untuk redesign desktop `Reports` dikunci sebagai berikut agar task implementasi berikutnya tidak melebar:

- Scope redesign hanya untuk route existing `/reports`.
- Redesign ini additive; tidak menjadi redesign total app atau penggantian design system global.
- Flowbite React, jika dipakai, hanya untuk desktop shell primitives seperti sidebar/topbar/container/table wrapper; komponen konten inti tetap mengikuti app primitives existing.
- Layout target adalah `hybrid summary`: KPI + dua chart di atas, lalu detail/list existing tetap dipertahankan di bawah.
- Chart prioritas hanya untuk `executive_finance`.
- Set chart awal:
  - `Cash Flow Trend` dari payload `cashMutations`.
  - `Project Profit Comparison` dari payload `projectSummaries`.
- KPI angka utama tetap mengambil `reportData.summary`; chart tidak boleh menjadi owner baru untuk total/saldo/status.
- Filter, mode laporan, dan tombol PDF tetap memakai flow existing; yang berubah hanya penempatan/komposisi visual desktop.
- PDF desktop tetap `download-first`; tidak ada redesign kontrak PDF atau template PDF pada fase ini.
- Tidak membuat source-of-truth baru, endpoint baru, agregasi server baru, atau kalkulasi canonical baru untuk desktop reports.
- Browser auth tidak menjadi syarat desain dokumen ini; sequencing untuk redesign reports adalah `UI-first`, sedangkan browser auth tetap mengikuti stream foundation terpisah.
- Access implementasi awal tetap `Owner/Admin` only sesuai gate desktop browser plan existing.
- Jika implementasi chart nanti membutuhkan library baru, kandidat yang boleh dievaluasi lebih lanjut adalah ApexCharts; keputusan install dependency tetap memerlukan brief implementasi terpisah dan approval eksplisit.

### Phase 3B - Jurnal desktop redesign contract

Keputusan khusus untuk redesign desktop `Jurnal` dikunci sebagai berikut agar implementasi berikutnya tidak mengubah perilaku ledger secara liar:

- Scope redesign hanya untuk route existing `/transactions` beserta query tab existing: `active`, `tagihan`, dan `history`.
- Desktop `Jurnal` adalah `workspace table`, bukan card-first layout, bukan modal-heavy workspace, dan bukan split master-detail.
- `Aktif`, `Tagihan`, dan `Riwayat` tetap menjadi satu workspace dengan tiga tab setara pada surface `Jurnal`.
- Header desktop `Jurnal` bersifat `sticky workspace header` di area content desktop.
- Header desktop hanya berisi title, tabs, search/filter controls, dan shortcut `Arsip`; tidak ada KPI strip tambahan agar tidak tumpang tindih dengan `Dashboard`.
- Navigasi data tetap memakai cursor pagination existing + tombol `Muat Berikutnya`; tidak membuka numbered pagination baru dan tidak mengubah kontrak API.
- Detail pattern tetap route-based: klik row utama membuka route detail existing, sedangkan pay/edit/delete tetap menuju route atau flow existing.
- Model filter tetap menjaga taxonomy existing dari ledger filter source-type; tidak membuka multi-filter contract baru pada fase ini.

#### Kontrak tab `Aktif`

- Presentasi desktop `Aktif` memakai tabel dengan baseline kolom:
  - `Tanggal/Waktu`
  - `Tipe/Source`
  - `Proyek/Pihak`
  - `Deskripsi`
  - `Status Settlement`
  - `Nominal`
  - `Aksi`
- Klik row membuka detail route existing.
- Kolom `Aksi` memakai model `aksi column + kebab`: ada action primer yang terlihat dan menu ringkas untuk action sekunder, tetapi tidak memindahkan mutation inline ke dalam tabel.
- Search/filter state untuk `Aktif` dipertahankan independen terhadap tab lain.

#### Kontrak tab `Riwayat`

- Presentasi desktop `Riwayat` memakai `audit-focused table`, bukan copy penuh dari tabel `Aktif`.
- Baseline kolom `Riwayat`:
  - `Waktu`
  - `Source`
  - `Context`
  - `Nominal`
  - `Creator`
  - `Detail`
- Aksi `Riwayat` dibatasi `detail only`; tidak membawa pay/edit/delete kembali ke surface audit.
- Search/filter state `Riwayat` independen dari tab lain.

#### Kontrak tab `Tagihan`

- Presentasi desktop `Tagihan` tetap mempertahankan grouped settlement list; tidak diratakan penuh menjadi tabel umum.
- `Tagihan` memiliki `search + simple filters` dengan cakupan:
  - `group type`
  - `due urgency`
- `Tagihan` boleh `inline expand` di dalam workspace `Jurnal`, tetapi kedalaman expand dibatasi hanya:
  - summary group/item
  - daftar child bills
- Expand `Tagihan` tidak boleh menduplikasi seluruh capability `Payments hub`.
- Klik child bill di dalam expand harus membuka route payment/detail existing; tidak ada nested expand level kedua.
- Shortcut `Arsip` tetap hidup di header `Jurnal`, bukan dipindah ke utilitas sidebar.

#### Guardrail implementasi

- Tidak menambah source-of-truth baru, API baru, atau server aggregation baru untuk desktop `Jurnal`.
- Tidak mengubah kontrak `/api/transactions`, `vw_workspace_transactions`, atau `vw_history_transactions` untuk sekadar memenuhi layout desktop.
- Tidak mengubah route high-risk seperti payment form, edit form, atau recycle-bin detail flow.
- Desktop `Jurnal` hanya mengadaptasi presentasi read/navigation dan reuse permission helper existing untuk visibility aksi.

### Phase 3C - Dashboard desktop redesign contract

Keputusan khusus untuk redesign desktop `Dashboard` dikunci sebagai berikut agar task implementasi berikutnya tidak melebar:

- Scope redesign hanya untuk route existing `/` sebagai landing page `Dashboard`.
- Redesign ini additive; tidak menjadi redesign total app atau penggantian design system global.
- Desktop `Dashboard` adalah `home hub`, bukan command center penuh, bukan analytics dashboard penuh, dan bukan shortcut grid yang menggantikan shell navigasi.
- Header desktop disederhanakan menjadi title `Dashboard` dan tombol refresh; tidak ada chip row tambahan, tidak ada action grid di header, dan tidak ada intro copy baru.
- Layout desktop memakai komposisi dua kolom: konten utama tetap menonjol, sedangkan chart cash flow ditempatkan di side panel.
- Empat kartu ringkasan atas tetap dipertahankan dalam grid `2x2`: `Saldo Kas`, `Laba Bersih`, `Pinjaman Aktif`, dan `Tagihan Pending`.
- `Tagihan Pending` tetap menjadi `CTA alert card`; tidak diperlakukan sebagai KPI biasa.
- Semua shortcut aksi utama di area dashboard desktop dihapus; discovery navigasi pindah ke desktop shell/sidebar, bukan ke action card di dashboard.
- Satu chart desktop yang dibekukan adalah `Cash Flow Trend` dengan visual `stacked bar`, rentang `14 hari`, dan source dari `cashMutations`.
- CTA pada card chart mengarah ke `Jurnal penuh` di `/transactions`.
- Aktivitas terbaru menjadi `preview table` read-only dengan 8 baris, source dari `workspaceTransactions`.
- Kolom preview table dibekukan sebagai:
  - `Waktu`
  - `Jenis`
  - `Deskripsi`
  - `Nominal`
  - `Status`
- Filter preview table tetap `Semua`, `Hari Ini`, dan `Proyek` dengan kontrol `chips/segmented` inline.
- Data composite dashboard tetap memakai source existing: `summary`, `workspaceTransactions`, `bills`, `loans`, dan `portfolioSummary`; tidak ada source-of-truth baru atau kalkulasi canonical baru.
- Access implementasi awal tetap `Owner/Admin` only sesuai gate desktop browser plan existing.
- Browser auth tidak menjadi syarat desain dokumen ini; sequencing untuk redesign dashboard adalah `UI-first`, sedangkan browser auth tetap mengikuti stream foundation terpisah.

### Phase 3D - Payments desktop redesign contract

Keputusan khusus untuk redesign desktop `Payments` dikunci sebagai berikut agar task implementasi berikutnya tidak melebar:

- Scope redesign hanya untuk route existing `/pembayaran`, termasuk mode detail existing `?group=` untuk worker-group settlement.
- Route payment entry `/payment/:id` dan `/loan-payment/:id` tetap standalone, route-based, dan high-risk; tidak ikut diredesign pada fase ini.
- Redesign ini additive; tidak menjadi redesign total app atau penggantian design system global.
- Desktop `Payments` adalah settlement hub/list, bukan form pembayaran, bukan command center penuh, dan bukan analytics dashboard.
- Layout desktop mempertahankan tiga blok utama:
  - `Histori settlement`
  - `Tagihan`
  - `Pinjaman`
- `Histori settlement` tetap menjadi preview read-only dari settlement transaction existing; baris yang dibuka tetap menuju detail transaction existing.
- `Tagihan` tetap menjadi grouped settlement list berdasarkan worker, dengan entry point ke detail group dan entry point ke route pembayaran existing.
- `Pinjaman` tetap menjadi list outstanding loan, dengan entry point ke route payment loan existing.
- Detail group `?group=` tetap mempertahankan tab `Summary`, `Rekap`, dan `Riwayat`; tidak dipindahkan ke modal baru, nested route baru, atau write-heavy workspace baru.
- Receipt delivery, archive, restore, dan permanent delete tetap visible hanya pada kondisi yang sudah diizinkan helper existing; tidak ada action permission matrix baru.
- Payment entry points tetap route-based:
  - bill payment membuka `/payment/:id`
  - loan payment membuka `/loan-payment/:id`
  - history entry membuka `/transactions/:id?surface=pembayaran`
- Tidak membuat source-of-truth baru, endpoint baru, agregasi server baru, atau kalkulasi canonical baru untuk desktop payments.
- Access implementasi awal tetap `Owner/Admin` only sesuai gate desktop browser plan existing.
- Browser auth tidak menjadi syarat desain dokumen ini; sequencing untuk redesign payments adalah `UI-first`, sedangkan browser auth tetap mengikuti stream foundation terpisah.

### Phase 3E - Master desktop redesign contract

Keputusan khusus untuk redesign desktop `Master` dikunci sebagai berikut agar task implementasi berikutnya tidak melebar:

- Scope redesign hanya untuk route existing `/master` beserta subroute existing `/master/:tab/add`, `/master/:tab/edit/:id`, dan `/master/recycle-bin`.
- Redesign ini additive; tidak menjadi redesign total app atau penggantian design system global.
- Desktop `Master` adalah `workspace CRUD` dengan `overview + top tabs`, bukan read-only index, bukan split detail shell, dan bukan modal-heavy editor.
- Panel overview desktop menampilkan count entity aktif dan hotspot dependency/deletion dari data existing; panel ini berada di atas tab strip, bukan menggantikan tab strip.
- Delapan tab entity existing tetap menjadi scope penuh:
  - `Projects`
  - `Workers`
  - `Suppliers`
  - `Materials`
  - `Categories`
  - `Creditors`
  - `Professions`
  - `Staff`
- Isi tiap tab tetap list berbasis card seperti existing; tidak ada rewrite ke tabel desktop pada freeze ini.
- Create/edit/delete tetap route-based existing; tidak ada modal CRUD baru, inline editor, atau split detail workspace.
- Tombol `Recycle Bin` dan route recycle bin existing tetap dipertahankan sebagai boundary arsip.
- Dependency guard existing tetap dipertahankan untuk record yang masih dipakai; tidak ada perubahan contract guard.
- Tidak membuat source-of-truth baru, endpoint baru, agregasi server baru, atau kalkulasi canonical baru untuk desktop master.
- Access implementasi awal tetap `Owner/Admin` only sesuai gate desktop browser plan existing.
- Browser auth tidak menjadi syarat desain dokumen ini; sequencing untuk redesign master adalah `UI-first`, sedangkan browser auth tetap mengikuti stream foundation terpisah.

### Phase 4 - Hardening and regression testing

- Mobile Telegram smoke.
- Desktop smoke.
- Role/capability verification.
- Auth error/replay test.
- Token/log audit.
- Rate limit review.
- Rollback via flag.

## 11. Risk Register

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Mobile regression | Bottom nav, form footer, safe-area, atau Telegram bootstrap rusak | Desktop additive layer, jangan rewrite `MainLayout`/`BottomNav`, wajib mobile smoke |
| CSS conflict | Bootstrap/global CSS menimpa Tailwind/app tokens | Larang Bootstrap dependency v1, pakai scoped `.app-desktop-*` jika perlu CSS |
| Auth/session leakage | Access/refresh token terekspos lewat logs, URL, atau XSS | No token logging, no token URL, service role server-only, XSS baseline, future CSP |
| Telegram Login replay | Payload login dipakai ulang | Verifikasi hash server-side dan `auth_date` max 1 jam |
| Role mismatch | Browser dan Mini App melihat role berbeda | Satu source role dari `team_members`; no browser-specific role matrix |
| Identity split | Satu user punya Telegram identity dan email identity terpisah | V1 Telegram-only; email/password/magic link future setelah identity linking |
| Telegram WebApp context mismatch | Browser tanpa SDK masuk flow Mini App atau sebaliknya | `useClientContext`, public `/login`, notice minimal untuk mobile browser |
| API source-of-truth drift | Desktop membuat API/read model baru | Reuse API/store existing; no desktop source-of-truth baru v1 |
| High-risk mutation regression | Payment, payroll, stock, attachment, restore/delete rusak | POC read/navigation only; high-risk domains case-by-case |
| Overengineering desktop | Shell/table/global search/shortcuts terlalu besar | Phase POC sempit, no global search v1, shortcuts future |
| Maintenance burden | Mobile dan desktop fork terlalu banyak | Route same, shared data layer, desktop shell terpisah tapi page adaptation bertahap |
| Rollout failure | Browser auth/layout bermasalah di production | Env flag, Owner/Admin gate, preview internal first, rollback by disabling flag |

## 12. Open Questions

Blocking open questions untuk v1 sudah ditutup dalam Decision Log.

Pertanyaan non-blocking untuk fase future:

- Kapan email/password atau magic link layak dibuka, dan bagaimana identity linking Telegram-email dirancang?
- Apakah data table desktop perlu sorting/filter advanced lintas kolom setelah POC?
- Apakah global search perlu index/API khusus setelah desktop usage nyata?
- Apakah team switcher eksplisit perlu masuk topbar setelah ada user multi-team aktif?
- Apakah CSP wajib diterapkan sebelum browser desktop dibuka lebih luas?
- Apakah browser support perlu diperluas ke Safari/Firefox sebagai target formal setelah internal preview?

## 13. Source / Research Notes

Research digunakan sebagai input prinsip, bukan sebagai pengganti audit repo.

- [web.dev - Responsive Web Design Basics](https://web.dev/articles/responsive-web-design-basics)  
  Implikasi: plan harus menjaga viewport meta, menghindari horizontal overflow, dan memakai layout responsive/adaptive yang tidak memecah small-screen UX.

- [Bootstrap 5.3 - Grid System](https://getbootstrap.com/docs/5.3/layout/grid/)  
  Implikasi: Bootstrap berguna sebagai referensi 12-column grid, gutters, dan mobile-first layout tiers, tetapi pola ini dapat ditiru dengan Tailwind tanpa dependency.

- [Bootstrap 5.3 - Breakpoints](https://getbootstrap.com/docs/5.3/layout/breakpoints/)  
  Implikasi: desktop enhancement sebaiknya memakai breakpoint eksplisit dan tidak mengubah mobile-first base styles.

- [Bootstrap 5.3 - Containers](https://getbootstrap.com/docs/5.3/layout/containers/)  
  Implikasi: desktop content perlu max container agar nyaman dibaca, bukan full-width liar di layar besar.

- [Tailwind CSS v3 - Responsive Design](https://v3.tailwindcss.com/docs/responsive-design)  
  Implikasi: repo dapat mempertahankan mobile-first default dan menambah enhancement dengan breakpoint utilities seperti `lg:`.

- [Tailwind CSS v3 - Preflight](https://v3.tailwindcss.com/docs/preflight)  
  Implikasi: menambah CSS framework lain harus dihindari pada v1 karena global reset/base styles dapat bertabrakan.

- [Tailwind CSS v3 - Configuration prefix](https://v3.tailwindcss.com/docs/configuration#prefix)  
  Implikasi: jika suatu saat CSS utility pihak ketiga atau custom utility besar dibuka, isolasi/prefix menjadi mekanisme penting; untuk v1 cukup scoped `.app-desktop-*`.

- [Telegram Mini Apps / Web Apps](https://core.telegram.org/bots/webapps)  
  Implikasi: Mini App tetap mengandalkan signed `initData` dan Telegram WebApp context; browser desktop tidak boleh merusak kontrak ini.

- [Telegram Login Widget](https://core.telegram.org/widgets/login)  
  Implikasi: browser auth v1 paling aman tetap memakai Telegram identity dengan signed login payload yang diverifikasi backend.

- [Supabase Auth - Sessions](https://supabase.com/docs/guides/auth/sessions)  
  Implikasi: Supabase session terdiri dari access token dan refresh token; v1 bisa reuse SPA session existing, sedangkan cookie/BFF butuh desain terpisah.

- [Supabase Auth - Users](https://supabase.com/docs/guides/auth/users)  
  Implikasi: authorization tidak boleh bergantung pada user-editable metadata; role tetap harus dari source aplikasi seperti `team_members` atau app-controlled data.

- [Supabase Auth - Passwordless email logins](https://supabase.com/docs/guides/auth/auth-email-passwordless)  
  Implikasi: magic link tersedia tetapi harus menjadi future option karena v1 menjaga Telegram sebagai identity utama.

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)  
  Implikasi: browser v1 tidak perlu RLS baru jika user/session/role tetap sama; perubahan direct-client atau claim context baru harus diaudit terpisah.

- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)  
  Implikasi: future cookie/BFF harus memperhatikan cookie attributes, session fixation, logout, timeout, dan leakage; v1 SPA token tetap butuh XSS/logging baseline.

## 14. Definition of Done for Future Implementation

Dokumen ini dianggap siap menjadi referensi jika future implementation brief memuat:

- File scope sempit.
- Mode kerja bukan docs-only.
- Source-of-truth domain yang disentuh.
- Kontrak redesign desktop `Master` sudah dibekukan.
- Validasi mobile + desktop smoke.
- Rollback via `VITE_ENABLE_DESKTOP_BROWSER_MODE`.
- Konfirmasi tidak mengubah `/api/auth` Mini App kecuali ada approval khusus.
- Konfirmasi tidak menambah Bootstrap/dependency tanpa approval khusus.
- Konfirmasi tidak membuat migration/RLS/schema baru untuk v1 browser desktop.
