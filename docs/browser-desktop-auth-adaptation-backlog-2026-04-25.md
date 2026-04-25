# Browser Desktop + Auth Adaptation Backlog - 2026-04-25

## 1. Status dan Boundary Stream

Dokumen ini adalah backlog stream baru untuk memecah `docs/browser-desktop-auth-adaptation-plan-2026-04-25.md` menjadi micro-task implementasi v1 yang kecil, berurutan, dan bisa diaudit.

Status:

- Stream: `Browser Desktop + Auth Adaptation`
- Source plan: `docs/browser-desktop-auth-adaptation-plan-2026-04-25.md`
- Backlog status: `draft implementation backlog`
- Scope: future implementation planning
- Relation to UCW: terpisah dari `docs/unified-crud-workspace-plan-2026-04-18.md`
- Progress log aktif: tidak dipakai untuk stream ini kecuali owner membuat log stream khusus nanti

Boundary wajib:

- Mobile Telegram Mini Web App tetap prioritas dan tidak boleh regresi.
- `/api/auth` Mini App dianggap frozen untuk v1 browser.
- V1 tidak menambah Bootstrap dependency.
- V1 tidak menambah schema, migration, RLS policy, DB audit table, MFA, email/password, atau magic link.
- Browser desktop v1 memakai same origin/domain, Telegram Login Widget, Supabase SPA session, dan role dari `team_members`.
- Setiap task implementasi harus punya brief terpisah sebelum coding.

## 2. Leveling Model

Backlog dibagi menjadi level agar dependency jelas dan implementer tidak melompat ke area high-risk sebelum guard siap.

| Level | Nama | Tujuan | Gate sebelum lanjut |
| --- | --- | --- | --- |
| `L0` | Readiness | Mengunci setup eksternal, brief, dan guardrail | Owner menyetujui task implementation pertama |
| `L1` | Detection + Gating | Menyiapkan context detection, env flag, dan public behavior tanpa desktop UI besar | Mobile Mini App tetap berjalan seperti baseline |
| `L2` | Desktop Shell POC | Menambah shell desktop additive untuk Owner/Admin tanpa write/mutation | Dashboard + Jurnal read/navigation usable di desktop |
| `L3` | Browser Auth Foundation | Menambah login browser Telegram Widget dan session Supabase tanpa mengubah `/api/auth` | Browser login/logout dan denied state valid |
| `L4` | Integration Hardening | Menutup redirect, smoke test, security baseline, dan rollout preview | Mobile + desktop smoke lolos |
| `L5` | Page Adaptation V1 | Adaptasi halaman read-heavy setelah POC: Reports lalu Payments hub/list | Tiap page punya smoke dan tidak mengubah source-of-truth |
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

### Level L6 - Deferred / Future Scope

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
| `BDA-F-09` | Master desktop | Direct-client transitional boundary | Master boundary proposal |
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
16. `BDA-L2-07`
17. `BDA-L2-08`
18. `BDA-L3-01`
19. `BDA-L3-02`
20. `BDA-L3-03`
21. `BDA-L3-04`
22. `BDA-L3-05`
23. `BDA-L3-06`
24. `BDA-L3-07`
25. `BDA-L3-08`
26. `BDA-L3-09`
27. `BDA-L3-10`
28. `BDA-L4-01`
29. `BDA-L4-02`
30. `BDA-L4-03`
31. `BDA-L4-04`
32. `BDA-L4-05`
33. `BDA-L4-06`
34. `BDA-L4-07`
35. `BDA-L5-01`
36. `BDA-L5-02`
37. `BDA-L5-03`
38. `BDA-L5-04`
39. `BDA-L5-05`
40. `BDA-L5-06`

## 6. Stream-Level Definition of Done

V1 stream dianggap selesai jika:

- Browser desktop context dan flag behavior berjalan sesuai decision log.
- Desktop shell POC tersedia untuk Owner/Admin di `lg` ke atas.
- Dashboard + Jurnal usable untuk read/navigation di desktop.
- Browser auth Telegram Login Widget berjalan lewat `/api/browser-auth`.
- `/api/auth` Mini App tetap tidak berubah kontraknya.
- Session browser memakai Supabase SPA session dan API Bearer existing.
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
