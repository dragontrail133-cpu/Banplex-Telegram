# Unified CRUD Workspace Progress Log

Dokumen ini adalah log progres khusus untuk stream `Unified CRUD Workspace`.

## Aturan Pakai

1. Update log ini setiap selesai mengerjakan satu task dalam stream ini.
2. Jangan pindah ke task berikutnya sebelum entri task aktif memiliki hasil audit yang valid.
3. Jika task gagal validasi, tulis status `blocked` atau `audit_required`, lalu jelaskan blocker-nya.
4. Jika ada brief baru yang mengubah backlog, catat perubahan itu sebelum task implementasi berikutnya dimulai.

## Status Legend

- `planned`
- `in_progress`
- `audit_required`
- `validated`
- `blocked`
- `deferred`

## Current Active Task

- Active stream: `Unified CRUD Workspace`
- Referensi plan: `docs/unified-crud-workspace-plan-2026-04-18.md`
- Primary freeze authority: `docs/freeze/00-index.md`
- Current task: `UCW-356`
- Current status: `audit_required`
- Catatan fokus: route canonical `/reports` sudah dipatch; `/projects`, `/projects/pdf-settings`, dan `/proyek` menjadi alias direct ke canonical path, tetapi build dan smoke masih perlu validasi di environment yang mengizinkan spawn.
- Catatan brief terbaru: user meminta implementasi plan audit/arsitektur tanpa asumsi liar; batch aktif kini mencakup runtime route `/reports`, bukan hanya dokumen audit.
- Catatan audit freeze terbaru: `Report PDF` tetap output turunan, `pdf_settings` tetap konfigurasi branding, dan `Payment Receipt PDF` tetap terpisah dari laporan bisnis.
- Status transitions touched: `UCW-353` tetap `validated`; `UCW-354` tetap `planned`; `UCW-355` tetap `validated`; `UCW-356` sekarang `audit_required`.
- Review order: submit mobile income -> implement route `/reports` -> validasi lint/build/smoke, lalu lanjut ke `UCW-357` bila environment sudah aman.

### [2026-04-24] `UCW-356` - Tambahkan canonical route `/reports` tanpa mengubah generator PDF
- Status: `audit_required`
- Ringkasan:
  - Route canonical `/reports` sekarang memakai `ProjectsPage`; `/projects`, `/projects/pdf-settings`, dan `/proyek` langsung mengarah ke `/reports` atau `/reports#pdf-settings`.
  - Link internal report hub di Dashboard dan More page sudah pindah ke `/reports`, dan smoke report sudah diarahkan ke canonical path.
- Addendum audit:
  - Implementasi ini sengaja tidak mengubah `ProjectReport`, `useReportStore`, `reports-api`, atau generator PDF.
  - `npx eslint` pada file yang diubah lolos, tetapi `npm run build` dan Playwright smoke masih terhenti oleh `spawn EPERM` di environment sandbox ini.
- File berubah:
  - `src/App.jsx`
  - `src/pages/Dashboard.jsx`
  - `src/pages/MorePage.jsx`
  - `src/pages/ProjectPdfSettingsPage.jsx`
  - `src/pages/ProjectsPage.jsx`
  - `tests/e2e/report.spec.js`
  - `tests/live/report-pdf-delivery.spec.js`
- Audit hasil:
  - Canonical route `reports` sudah hidup, dan alias legacy tetap kompatibel.
  - URL alias PDF settings mendarat ke anchor `#pdf-settings` pada route canonical.
- Validasi:
  - `npx eslint src/App.jsx src/pages/ProjectsPage.jsx src/pages/ProjectPdfSettingsPage.jsx src/pages/Dashboard.jsx src/pages/MorePage.jsx tests/e2e/report.spec.js tests/live/report-pdf-delivery.spec.js`
  - `npm run build` -> failed: `spawn EPERM`
  - `npx playwright test tests/e2e/report.spec.js --reporter=line --output=.pw-route-v1-results` -> failed: `spawn EPERM`
- Risiko/regresi:
  - Because build/smoke are blocked by the sandbox, runtime confirmation should still be rerun in CI or a less restricted shell before marking the route fully validated.
- Next allowed task:
  - Re-run `UCW-356` validation in an environment that allows build and Playwright workers, then advance to `UCW-357` if the route is clean.

### [2026-04-24] `UCW-355` - Audit entrypoint dan arsitektur `/reports` untuk PDF hub
- Status: `validated`
- Ringkasan:
  - Entry point aktual unduh PDF laporan Kreditur/Supplier/Pekerja dipetakan dari runtime repo: saat ini masih berada di `/projects` melalui `ProjectReport`, `useReportStore`, `/api/records?resource=reports`, dan generator `src/lib/report-pdf.js`.
  - Keputusan arsitektur user dikunci ke canonical route `/reports`, compatibility alias `/projects`, dan pola PDF on-demand hybrid tanpa mengubah runtime pada batch ini.
- Addendum audit:
  - Dokumen audit baru memisahkan repo truth, target route, data flow, format PDF profesional, risiko skala, dan micro-task implementasi lanjutan.
  - Scope sengaja docs-only; tidak ada route, store, API, migration, dependency, atau test runtime yang diubah.
- File berubah:
  - `docs/report-pdf-hub-entrypoint-audit-2026-04-24.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `/projects` terkonfirmasi sebagai hub aktual dan `/projects/pdf-settings` sebagai alias settings saat ini.
  - `/reports` belum diimplementasi; micro-task lanjutan memerintahkan route canonical baru sambil mempertahankan alias lama.
  - Guard dataset besar belum diberi angka asumtif; dokumen menurunkan task audit query/index sebelum hardening skala runtime.
- Validasi:
  - `git diff --check`
- Risiko/regresi:
  - Runtime risk nol karena batch ini hanya menambah dokumen dan update backlog/progress.
- Next allowed task:
  - `UCW-354` untuk sinkronkan AQ gate atau `UCW-356` untuk implement route `/reports`, sesuai instruksi user berikutnya.

### [2026-04-24] `UCW-353` - Stabilkan submit mobile create `project-income` pada routed form
- Status: `validated`
- Ringkasan:
  - Footer action pada routed income form mobile sekarang tetap terlihat dan bisa diklik ketika field terakhir masih fokus, sehingga `Simpan Termin Proyek` benar-benar mengirim `POST /api/transactions`.
  - Shell form tetap memakai jalur routed yang sama; yang diubah hanya perilaku footer/action bar agar tidak disembunyikan terlalu agresif saat input aktif di mobile.
- Addendum audit:
  - Fix dipusatkan di `FormLayout` dan `IncomeForm`; action bar embedded diberi mode fixed yang pointer-safe, lalu keyboard visibility tidak lagi menyembunyikan footer untuk form income ini.
  - Scope tetap di shell form mobile dan test E2E terkait; tidak ada perubahan contract submit transaksi atau payload bisnis.
- File berubah:
  - `src/components/layouts/FormLayout.jsx`
  - `src/components/IncomeForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Mobile submit `project-income` dari route `/edit/project-income/new` sekarang lolos tanpa perlu force click atau hack scroll, dan request POST benar-benar terkirim.
  - Failure full-file di `tests/e2e/edit.spec.js` yang lain tetap terpisah dan tidak berkaitan dengan task ini.
- Validasi:
  - `npx playwright test tests/e2e/edit.spec.js -g "saves project income from the new form" --project=mobile-chrome --reporter=line`
  - `npm run lint`
  - `npm run build`
- Risiko/regresi:
  - Perilaku footer keyboard untuk form income sekarang lebih permisif; jika nanti perlu sembunyikan action saat keyboard aktif, itu perlu lane UI tersendiri.
- Next allowed task:
  - `UCW-354` untuk sinkronkan AQ gate dengan coverage smoke aktual dan gap yang masih tersisa

### [2026-04-24] `UCW-352` - Sinkronkan smoke mock `Tagihan` dan PDF dengan contract UI terbaru
- Status: `validated`
- Ringkasan:
  - Smoke mock `Tagihan` sekarang mengikuti route canonical `/transactions?tab=tagihan` dengan heading `Jurnal`, tab `Tagihan` aktif, dan empty state yang sesuai.
  - Smoke PDF di `tests/e2e/report.spec.js` kini memakai fixture laporan deterministik sehingga tombol `Unduh PDF` benar-benar menghasilkan file PDF, bukan bergantung pada seed live.
- Addendum audit:
  - Fixture report di helper mock browser sengaja cukup untuk `executive_finance` karena itu jalur PDF smoke yang dipakai suite mock saat ini; live lane tetap ditangani di spec terpisah.
  - Contract UI tidak diubah; yang diselaraskan adalah assertion smoke mock dan data fallback yang menghidupi download.
- File berubah:
  - `tests/e2e/helpers/app.js`
  - `tests/e2e/report.spec.js`
  - `docs/release-aq-gate.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `/tagihan` sekarang diverifikasi sebagai redirect ke `Jurnal` dengan tab `Tagihan` aktif, sesuai contract route yang hidup.
  - PDF mock kini menghasilkan `laporan-executive-finance` dengan data fixture deterministik, sehingga browser download asserted secara nyata.
- Validasi:
  - `npx playwright test tests/e2e/report.spec.js --reporter=line`
  - `npm run lint`
- Risiko/regresi:
  - Fixture report mock ini sengaja minimum dan fokus ke jalur `executive_finance`; jika smoke report lain ditambah nanti, ia perlu fixture sendiri atau override yang lebih spesifik.
- Next allowed task:
  - `UCW-353` untuk menstabilkan submit mobile create `project-income` pada routed form

### [2026-04-24] `UCW-351` - Stabilkan bootstrap auth mock browser dan first-route smoke
- Status: `validated`
- Ringkasan:
  - Helper Playwright mock browser sekarang menanam dev-auth bypass ke `sessionStorage` sebelum navigation dan menunggu loading screen workspace hilang, jadi smoke root dan first-route tidak lagi race dengan bootstrap auth.
- Addendum audit:
  - Fix berada di helper smoke `tests/e2e/helpers/app.js`; runtime store auth dan config Playwright tetap tidak berubah.
  - Smoke chromium dan mobile untuk `auth`, `create`, dan `telegram-shell` lolos setelah helper menunggu auth bootstrap selesai.
- File berubah:
  - `tests/e2e/helpers/app.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `openApp()` kini lebih deterministik untuk `/`, `/attendance/new`, dan route shell lain karena assert tidak lagi dimulai saat layar `Sedang memuat workspace` masih aktif.
  - Scope tetap di harness smoke; tidak ada perubahan contract auth production.
- Validasi:
  - `npx playwright test tests/e2e/auth.spec.js tests/e2e/create.spec.js --reporter=line`
  - `npx playwright test tests/e2e/telegram-shell.spec.js --reporter=line`
- Risiko/regresi:
  - Helper kini menunggu hingga 25 detik untuk loading workspace hilang; jika bootstrap auth benar-benar melambat di atas itu, smoke akan tetap gagal dengan sinyal yang jelas.
- Next allowed task:
  - `UCW-352` untuk menyinkronkan smoke mock `Tagihan` dan PDF dengan contract UI terbaru

### [2026-04-24] `UCW-350` - Stabilkan unit test lifecycle invite token agar tidak bergantung tanggal hari ini
- Status: `validated`
- Ringkasan:
  - Helper lifecycle invite menerima reference clock opsional, dan unit test mapping invite memakai timestamp deterministik agar status `active`/`expired` stabil lintas tanggal runtime.
- Addendum audit:
  - `mapInviteToken()` tetap backward-compatible untuk caller runtime karena parameter jam referensi bersifat opsional dan default-nya masih `Date.now()`.
  - Fixture test sekarang mengecek jalur `active` dan `expired` terhadap reference clock yang sama, sehingga tanggal hari ini tidak lagi memengaruhi hasil.
- File berubah:
  - `src/lib/team-invite.js`
  - `tests/unit/team-invite-store.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `lifecycle_status` dan `lifecycle_status_label` sekarang deterministik terhadap jam referensi yang disuplai test.
  - Scope tetap sempit di helper invite dan unit test store tim; tidak ada perubahan runtime store atau workflow invite lintas UI/server.
- Validasi:
  - `node --test tests/unit/team-invite-store.test.js`
  - `npm run lint`
- Risiko/regresi:
  - Caller baru yang ingin hasil deterministik tetap harus meneruskan reference clock eksplisit; perilaku runtime default tetap bergantung `Date.now()`.
- Next allowed task:
  - `UCW-351` untuk menstabilkan bootstrap auth mock browser dan first-route smoke

### [2026-04-24] `DOC-PLAN-UPDATE-06` - Audit hasil smoke global dan turunkan backlog sempit
- Status: `validated`
- Ringkasan:
  - Mengaudit hasil validasi global repo saat ini, lalu menurunkannya menjadi backlog stream yang lebih sempit dan bisa dieksekusi berurutan.
  - Menutup mismatch planning untuk `UCW-348`, lalu menambahkan lane follow-up khusus untuk lint gate, deterministic unit test, harness browser mock, smoke report/PDF, submit mobile income, dan sinkronisasi AQ docs.
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `UCW-348` diselaraskan menjadi `validated` di planning agar tidak tertinggal dari log implementasi sebelumnya.
  - Task baru yang belum tercakup sudah ditambahkan: `UCW-349`, `UCW-350`, `UCW-351`, `UCW-352`, `UCW-353`, dan `UCW-354`.
  - Urutan berikutnya dipersempit: mulai dari baseline audit (`npm run lint` yang masih noisy), lalu deterministik unit test dan stabilisasi harness browser mock sebelum menyentuh drift smoke report atau submit mobile create income.
- Validasi:
  - Validasi ringan dokumen: cek konsistensi checklist planning baru, referensi task baru, dan sinkronisasi status planning/progress
- Risiko/regresi:
  - Worktree repo saat audit masih penuh perubahan WIP, jadi backlog baru memetakan temuan pada state repo aktif sekarang, bukan baseline commit bersih.
  - Lane live write staging tetap belum boleh diasumsikan aman sebelum target staging-safe benar-benar dibuktikan terpisah.
- Next allowed task:
  - `UCW-349` untuk merapikan gate lint agar audit source repo kembali punya sinyal yang bersih

### [2026-04-24] `UCW-349` - Rapikan gate lint agar artefak generated tidak mengotori audit repo
- Status: `validated`
- Ringkasan:
  - `npm run lint` sekarang kembali membaca source repo aktif saja; artefak generated Playwright tidak lagi mengotori audit source code.
  - Gate AQ juga ditegaskan supaya lint preflight diperlakukan sebagai source-only signal, bukan pemeriksaan output smoke yang sudah dihasilkan.
- File berubah:
  - `eslint.config.js`
  - `docs/release-aq-gate.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `globalIgnores()` sekarang menutup `playwright-report/**` dan `test-results/**`, yang sebelumnya membuat `eslint .` membaca bundle trace generated.
  - Baseline lint repo kembali selaras dengan maksud gate: memeriksa source `src/api/tests/scripts` yang aktif, bukan artefak hasil smoke.
  - Scope tetap sempit pada hygiene validation gate; tidak ada perubahan workflow bisnis, route, store, atau API runtime.
- Validasi:
  - `npm run lint`
  - `git diff --check -- eslint.config.js docs/release-aq-gate.md docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`
- Risiko/regresi:
  - Direktori generated baru di luar `playwright-report/` dan `test-results/` masih perlu ditambahkan eksplisit bila nanti ikut menghasilkan file JS.
  - Task ini hanya membersihkan gate lint; failure unit/e2e yang sudah teridentifikasi di backlog lain tetap belum terselesaikan.
- Next allowed task:
  - `UCW-350` untuk menstabilkan unit test lifecycle invite token agar tidak bergantung tanggal hari ini

### [2026-04-24] `UCW-347` - Ringkas field deskripsi/catatan dan sembunyikan notes kosong di detail
- Status: `validated`
- Ringkasan:
  - Field textarea deskripsi dan catatan pada form aktif dipadatkan ke tinggi yang lebih hemat ruang tanpa mengubah contract submit.
  - Notes kosong di detail/history surface tidak lagi dirender; UI hanya menampilkan catatan saat ada isi bermakna.
- Addendum audit:
  - `AppTextarea` dan textarea raw pada form terkait turun dari `min-h-28` ke `min-h-24`.
  - Helper `hasMeaningfulText()` dipakai di detail transaksi, detail payroll worker, history pembayaran, dan detail material invoice supaya catatan kosong benar-benar hilang, bukan diganti placeholder.
  - Refinement lanjutan sekarang memakai tinggi nominal `h-12` untuk textarea yang masih terlihat di form aktif, dan area catatan pada `ExpenseForm` serta `HrdPipeline` berubah ke collapse native agar ruang vertikal ikut turun.
- File target:
  - `src/components/HrdPipeline.jsx`
  - `src/components/IncomeForm.jsx`
  - `src/components/LoanForm.jsx`
  - `src/components/MaterialInvoiceDetailPanel.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `src/components/ExpenseForm.jsx`
  - `src/components/ui/AppPrimitives.jsx`
  - `src/lib/transaction-presentation.js`
  - `src/pages/PaymentPage.jsx`
  - `src/pages/PayrollWorkerDetailPage.jsx`
  - `src/pages/PaymentsPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `tests/unit/transaction-presentation.test.js`
- Validasi:
  - `node --test tests/unit/transaction-presentation.test.js tests/unit/transaction-delete.test.js`
  - `npx eslint src/components/ExpenseForm.jsx src/components/HrdPipeline.jsx src/components/IncomeForm.jsx src/components/LoanForm.jsx src/components/MaterialInvoiceDetailPanel.jsx src/components/MaterialInvoiceForm.jsx src/components/ui/AppPrimitives.jsx src/lib/transaction-presentation.js src/pages/PaymentPage.jsx src/pages/PayrollWorkerDetailPage.jsx src/pages/PaymentsPage.jsx src/pages/TransactionDetailPage.jsx tests/unit/transaction-presentation.test.js`
  - `npm run build`

### [2026-04-24] `UCW-347` - Ringkas field deskripsi/catatan dan sembunyikan notes kosong di detail
- Status: `in_progress`
- Ringkasan:
  - Field textarea deskripsi dan catatan di form aktif diringkas supaya surface input tidak terlalu tinggi.
  - Notes kosong di detail/history surface tidak lagi dirender; UI hanya menampilkan catatan ketika memang ada isi yang bermakna.
- Addendum audit:
  - Target compact textarea diturunkan dari 28px ke 24px untuk menjaga form tetap hemat ruang tanpa mengubah contract submit.
  - Hiding notes mengikuti helper presentasi yang sama di transaction detail, payroll worker detail, payment history, dan detail material invoice.
  - Routing canonical tetap code-owned; BotFather hanya visibility command list.
- File target:
  - `api/telegram-assistant.js`
  - `src/lib/telegram-assistant-links.js`
  - `src/lib/telegram-assistant-routing.js`
  - `tests/unit/telegram-assistant-routing.test.js`
  - `docs/freeze/01-planning-decision-freeze.md`
  - `docs/freeze/02-prd-master.md`
  - `docs/freeze/03-source-of-truth-contract-map.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`

### [2026-04-24] `UCW-348` - Susun command bot step-by-step dengan `tambah`
- Status: `validated`
- Ringkasan:
  - `Telegram assistant` dipetakan ke command step-by-step dengan `/tambah`, `/buka`, `/cari`, `/status`, `/riwayat`, dan `/analytics` sebagai surface resmi.
  - `tambah` membuka domain input, `buka` membuka core surface, `cari` membuka picker domain-first, dan `status/riwayat` memakai summary bucket yang lebih ringkas.
- Addendum audit:
  - `/tambah` tetap deep-link only ke form input mini app, bukan write flow chat.
  - Routing canonical tetap code-owned; BotFather hanya visibility command list.
- File target:
  - `api/telegram-assistant.js`
  - `src/lib/telegram-assistant-links.js`
  - `src/lib/telegram-assistant-routing.js`
  - `tests/unit/telegram-assistant-routing.test.js`
  - `docs/freeze/01-planning-decision-freeze.md`
  - `docs/freeze/02-prd-master.md`
  - `docs/freeze/03-source-of-truth-contract-map.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `node --check api/telegram-assistant.js`
  - `npx eslint api/telegram-assistant.js src/lib/telegram-assistant-links.js src/lib/telegram-assistant-routing.js tests/unit/telegram-assistant-routing.test.js`
  - `node --test tests/unit/telegram-assistant-routing.test.js`
  - `npm run build`
  - `git diff --check -- api/telegram-assistant.js tests/unit/telegram-assistant-routing.test.js docs/freeze/01-planning-decision-freeze.md docs/freeze/02-prd-master.md docs/freeze/03-source-of-truth-contract-map.md docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`

### [2026-04-24] `UCW-346` - Koreksi badge row jurnal dan sembunyikan amount surat jalan
- Status: `validated`
- Ringkasan:
  - Row jurnal di `TransactionsPage` kembali menaruh amount di atas, lalu creator badge dan status settlement dibedakan secara visual agar tidak terlihat duplikat.
  - Amount untuk surat jalan disembunyikan di surface transaksi yang relevan, termasuk list jurnal, riwayat, recycle bin, dashboard recent items, dan detail transaksi.
- Addendum audit:
  - `getTransactionSettlementBadgeLabel()` sekarang punya fallback loan berbasis tagihan/amount bila status loan eksplisit kosong, jadi badge loan tetap muncul.
  - `shouldHideTransactionAmount()` dipakai lintas surface agar surat jalan tidak menampilkan nominal, sementara faktur normal tetap aman.
- File target:
  - `src/components/MaterialInvoiceDetailPanel.jsx`
  - `src/components/ui/ActionCard.jsx`
  - `src/lib/transaction-presentation.js`
  - `src/pages/Dashboard.jsx`
  - `src/pages/DeletedTransactionDetailPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `tests/unit/transaction-presentation.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `node --test tests/unit/transaction-presentation.test.js tests/unit/transaction-delete.test.js`
  - `npx eslint src/components/MaterialInvoiceDetailPanel.jsx src/components/ui/ActionCard.jsx src/lib/transaction-presentation.js src/pages/Dashboard.jsx src/pages/DeletedTransactionDetailPage.jsx src/pages/HistoryPage.jsx src/pages/TransactionDetailPage.jsx src/pages/TransactionsPage.jsx src/pages/TransactionsRecycleBinPage.jsx tests/unit/transaction-presentation.test.js`
  - `npm run build`

### [2026-04-24] `UCW-322` - Smoke browser, Mini Web Telegram, dan fallback DM untuk laporan bisnis
- Status: `validated`
- Ringkasan:
  - Smoke report/PDF divalidasi lewat `tests/live/report-pdf-delivery.spec.js`, yang membuka `ProjectsPage` di Telegram Mini Web, memverifikasi download PDF browser, dan memanggil `/api/report-pdf-delivery`.
  - Flow ini dipisah dari serial release smoke besar supaya bukti report/PDF tetap bisa diuji walau lane baseline lain masih berat di env ini.
- Addendum audit:
  - `openLiveApp()` tetap bisa men-stub Telegram WebApp dan mock route delivery report, sehingga smoke menangkap request DM tanpa side effect Telegram nyata.
  - Dedicated report smoke lolos di Chromium dan mobile-chrome, memverifikasi `%PDF-`, filename generator, dan payload `reportData`/`pdfSettings` untuk delivery DM.
  - Coverage gate di `docs/release-aq-gate.md` sudah diperbarui supaya report/PDF live smoke tercatat sebagai browser download + DM trigger pada spec khusus, sementara comparator angka deterministik masih open.
- File target:
  - `tests/live/report-pdf-delivery.spec.js`
  - `tests/live/helpers/live-app.js`
  - `docs/release-aq-gate.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npx eslint tests/live/helpers/live-app.js tests/live/release-smoke.spec.js tests/live/report-pdf-delivery.spec.js`
  - `npx playwright test --config=playwright.live.config.js tests/live/report-pdf-delivery.spec.js`

### [2026-04-23] `UCW-342` - Kunci coherence route assistant dan label CTA canonical
- Status: `validated`
- Ringkasan:
  - Route assistant, tombol inline, callback action, dan deep link sekarang mengarah ke canonical target yang sama agar navigasi bot tidak drift lintas surface.
  - Task ini tetap Bot/AI-only dan tidak menyentuh smoke, PDF, atau runtime delivery lain.
- Addendum audit:
  - `buildNavigateReply()` sekarang memakai `getAssistantRouteLabel()` bersama `assistantRouteTargets`, jadi label navigasi payroll/worker/ledger tetap konsisten dengan route canonical.
  - CTA route assistant memakai target canonical `/payroll?tab=daily` untuk attendance dan `/payroll?tab=worker` untuk worker, lalu label tombol dibaca dari helper route canonical yang sama.
  - Unit test routing menutup label payroll/ledger canonical serta attendance deep link roundtrip tanpa regresi.
- File target:
  - `api/telegram-assistant.js`
  - `src/lib/telegram-assistant-links.js`
  - `src/lib/telegram-assistant-routing.js`
  - `tests/unit/telegram-assistant-routing.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `node --test tests/unit/telegram-assistant-routing.test.js`
  - `npx eslint api/telegram-assistant.js src/lib/telegram-assistant-routing.js tests/unit/telegram-assistant-routing.test.js`
  - `npm run build`

### [2026-04-23] `UCW-343` - Kembalikan detail faktur material dan surat jalan ke tab canonical transaksi
- Status: `validated`
- Ringkasan:
  - Detail awal transaksi tetap berjalan di `TransactionDetailPage`, sementara rincian faktur/surat jalan dibuka lewat tab `Rincian Faktur` agar surface canonical tidak pecah.
  - Route legacy `/material-invoice/:id` tetap hidup sebagai alias redirect ke `/transactions/:id` supaya link lama tidak putus.
- Addendum audit:
  - `TransactionDetailPage` sekarang memuat detail material invoice dari fetch ulang terpisah dan merender item breakdown di tab khusus tanpa mengganggu tab info/history/attachments.
  - `MaterialInvoiceDetailPage` cukup jadi redirect alias, dan workspace route material invoice sekarang langsung mengarah ke `/transactions/:id`.
  - Playwright coverage menutup redirect alias dan visibility tab invoice pada route canonical.
- File target:
  - `api/transactions.js`
  - `src/components/MaterialInvoiceDetailPanel.jsx`
  - `src/lib/material-invoice.js`
  - `src/pages/MaterialInvoiceDetailPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `tests/e2e/transactions.spec.js`
  - `tests/e2e/helpers/routes.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`

### [2026-04-23] `UCW-344` - Pulihkan tombol simpan income baru yang tidak submit
- Status: `validated`
- Ringkasan:
  - `IncomeForm` sekarang kembali menempel ke `formId` yang sama dengan footer action bar, jadi tombol simpan di create income benar-benar memicu submit form.
  - Flow create pemasukan proyek lain tetap sama; perubahan hanya di wiring form submit dan coverage e2e.
- Addendum audit:
  - bug root cause-nya ada di form `IncomeForm` yang tidak punya `id`, sehingga tombol footer tidak terhubung ke form target.
  - e2e create income menutup path submit dari pemilihan proyek sampai `POST /api/transactions` terkirim dan toast sukses muncul.
- File target:
  - `src/components/IncomeForm.jsx`
  - `tests/e2e/edit.spec.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`

### [2026-04-24] `UCW-345` - Tambahkan badge status pembayaran di row jurnal
- Status: `validated`
- Ringkasan:
  - Row jurnal di `TransactionsPage` sekarang menampilkan badge settlement kecil `Lunas / Dicicil / Belum` di stack kanan bawah creator badge saat record punya billing status.
  - Layout row lain tetap aman karena mode badge-before-amount hanya diaktifkan untuk row yang memang punya status settlement.
- Addendum audit:
  - helper `getTransactionSettlementBadgeLabel()` menormalisasi status dari `ledger_summary`, `bill`, `salaryBill`, dan `loan` tanpa mengubah label summary yang sudah ada.
  - `ActionCard` sekarang bisa menumpuk badge sebelum amount untuk surface yang butuh, sementara default rendering surface lain tetap dipertahankan.
- File target:
  - `src/components/ui/ActionCard.jsx`
  - `src/lib/transaction-presentation.js`
  - `src/pages/TransactionsPage.jsx`
  - `tests/unit/transaction-presentation.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `node --test tests/unit/transaction-presentation.test.js tests/unit/transaction-delete.test.js`
  - `npx eslint src/components/ui/ActionCard.jsx src/lib/transaction-presentation.js src/pages/TransactionsPage.jsx tests/unit/transaction-presentation.test.js`
  - `npm run build`

### [2026-04-23] `UCW-334` - Tambahkan contract laporan per pihak untuk kreditur, supplier, dan pekerja
- Status: `validated`
- Ringkasan:
  - `api/records.js` sekarang melayani `reportKind=party_statement` untuk `creditor`, `supplier`, dan `worker`, dengan summary saldo, rows kronologis, dan opening balance yang dihitung dari riwayat sebelum periode.
  - `src/lib/reports-api.js` menambah helper `fetchPartyStatementFromApi()` supaya surface UI nanti bisa memanggil contract ini tanpa mengubah helper laporan yang lama.
- File target:
  - `api/records.js`
  - `src/lib/reports-api.js`
  - `tests/unit/party-statement.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - statement bergantung pada kelengkapan row `bill`/`attendance`/`loan` yang sudah ada; kalau ada record tanpa tanggal valid, ordering tetap jalan tetapi period cutoff bisa kurang presisi.
  - helper report ini masih backend-only; surface PDF baru tetap perlu micro-task lanjutan untuk konsumsi UI.
- Audit hasil:
  - helper ledger pure yang diekspor dari `api/records.js` membuktikan sorting debit/credit, opening balance, dan closing balance berjalan sesuai contract.
  - reporter backend menutup tiga domain utama: kreditur (`loan` + `loan_payment`), supplier (`supplier_bill` + `supplier_expense` + `bill_payment`), dan worker (`salary_bill` + `attendance` + `bill_payment`).
  - contract belum mengubah store atau halaman PDF existing, jadi surface yang sudah live tetap aman.
- Validasi:
  - `node --test tests/unit/party-statement.test.js`
  - `npx eslint api/records.js src/lib/reports-api.js tests/unit/party-statement.test.js`
  - `npm run build`

### [2026-04-23] `UCW-335` - Rilis statement PDF kreditur v1 dari `ProjectsPage`
- Status: `validated`
- Ringkasan:
  - `ProjectsPage` sekarang menambah jalur laporan kreditur yang memanggil contract `party_statement` dengan `partyType=creditor`, lalu merender summary saldo dan riwayat transaksi ke PDF.
  - Surface ini sengaja dibatasi ke kreditur dulu supaya supplier dan worker tetap bisa dikerjakan sebagai micro-task terpisah.
- File target:
  - `src/components/ProjectReport.jsx`
  - `src/store/useReportStore.js`
  - `src/lib/business-report.js`
  - `src/lib/report-pdf.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `ProjectsPage` sekarang mengenali `creditor_statement`, memuat daftar kreditur dari master data, dan menampilkan statement preview serta summary saldo yang sesuai dengan contract backend.
  - PDF renderer `party_statement` memakai header/footer shared, badge tema, file name yang spesifik per kreditur, dan tabel ledger debit/kredit/saldo.
  - state report menolak download saat kreditur belum dipilih sehingga jalur unduh tidak lagi menghasilkan PDF kosong.
- Validasi:
  - `node --test tests/unit/business-report.test.js tests/unit/party-statement.test.js`
  - `npx eslint src/components/ProjectReport.jsx src/store/useReportStore.js src/lib/business-report.js src/lib/report-pdf.js tests/unit/business-report.test.js tests/unit/party-statement.test.js`
  - `npm run build` masih gagal di baseline repo yang sudah ada: `fetchMaterialInvoiceByIdFromApi` tidak diekspor dari `src/lib/transactions-api.js`.

### [2026-04-23] `UCW-336` - Rilis statement PDF supplier v1 dari `ProjectsPage`
- Status: `validated`
- Ringkasan:
  - `ProjectsPage` sekarang menambah jalur laporan supplier yang memanggil contract `party_statement` dengan `partyType=supplier`, lalu merender summary saldo dan riwayat transaksi ke PDF.
  - Surface ini sengaja dibatasi ke supplier dulu supaya worker tetap bisa dikerjakan sebagai micro-task terpisah.
- File target:
  - `src/components/ProjectReport.jsx`
  - `src/store/useReportStore.js`
  - `src/lib/business-report.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - picker supplier bergantung pada data master `suppliers`; kalau master belum termuat, UI akan tetap menahan download sampai pilihan ada.
  - statement supplier memakai contract yang sama dengan kreditur, jadi regresi terbesar ada di branching UI/store yang harus tetap memetakan `partyType=supplier` dengan benar.
- Audit hasil:
  - `ProjectsPage` sekarang mengenali `supplier_statement`, menampilkan picker supplier dari master data, dan merender summary serta daftar transaksi supplier dengan label yang sesuai.
  - `useReportStore` mengarah ke `fetchPartyStatementFromApi({ partyType: 'supplier' })` saat report kind supplier dipilih, dan reset `selectedPartyId` saat kind berubah supaya cache report tidak silang.
  - `business-report` menambah option `Supplier` dan coverage test memastikan kind supplier serta label source supplier tetap terbaca.
- Validasi:
  - `node --test tests/unit/business-report.test.js tests/unit/party-statement.test.js`
  - `npx eslint src/components/ProjectReport.jsx src/store/useReportStore.js src/lib/business-report.js tests/unit/business-report.test.js tests/unit/party-statement.test.js`
  - `npm run build`

### [2026-04-24] `UCW-337` - Rilis statement PDF pekerja v1 dari `ProjectsPage`
- Status: `validated`
- Ringkasan:
  - `ProjectsPage` sekarang menambah jalur laporan pekerja yang memanggil contract `party_statement` dengan `partyType=worker`, lalu merender summary saldo dan riwayat transaksi ke PDF.
  - Surface ini sengaja dibatasi ke pekerja dulu supaya perubahan UI/store tetap kecil dan bisa diaudit.
- File target:
  - `src/components/ProjectReport.jsx`
  - `src/store/useReportStore.js`
  - `src/lib/business-report.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - picker pekerja bergantung pada master `workers`; kalau data belum termuat, UI tetap menahan download sampai pilihan ada.
  - statement pekerja memakai contract yang sama dengan kreditur/supplier, jadi regresi terbesar tetap pada branching UI/store yang memetakan `partyType=worker`.
- Audit hasil:
  - `ProjectsPage` sekarang mengenali `worker_statement`, memuat master pekerja, dan merender summary serta daftar transaksi pekerja dengan label yang sesuai.
  - `useReportStore` mengarah ke `fetchPartyStatementFromApi({ partyType: 'worker' })` saat report kind pekerja dipilih, lalu menahan fetch jika pekerja belum dipilih.
  - `business-report` menambah option `Pekerja` dan coverage test memastikan kind worker serta label source worker tetap terbaca.
- Validasi:
  - `node --test tests/unit/business-report.test.js tests/unit/party-statement.test.js`
  - `npx eslint src/components/ProjectReport.jsx src/store/useReportStore.js src/lib/business-report.js tests/unit/business-report.test.js tests/unit/party-statement.test.js`
  - `npm run build`

### [2026-04-24] `UCW-338` - Redesign kwitansi create expense dan faktur material agar senada
- Status: `validated`
- Ringkasan:
  - Kwitansi transaksi dan faktur material sekarang mengikuti shell visual yang sama dengan kwitansi pembayaran, termasuk watermark, header strip, footer, dan tonalitas warna brand.
  - Task ini tetap dibatasi ke generator PDF notification dan smoke delivery, tanpa menyentuh contract laporan pihak.
- File target:
  - `api/notify.js`
  - `src/lib/report-pdf.js`
  - `tests/live/release-smoke.spec.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - shell receipt masih bergantung pada helper `jsPDF` yang sama; jika font metrics berubah di masa depan, truncation header/footer bisa bergeser sedikit.
  - PDF notification memakai `generatedAt` dari payload runtime; kalau timestamp payload kosong, footer tetap aman tetapi waktu render bisa berbeda dari event asli.
- Audit hasil:
  - `renderPaymentReceiptShell()` menjadi source of truth untuk visual frame receipt dan dipakai oleh `createPaymentReceiptPdf()` serta generator kwitansi transaksi/faktur material di `api/notify.js`.
  - `addPaymentReceiptFooter()` dipakai ulang di jalur transaction/material invoice sehingga footer halaman tetap konsisten dengan kwitansi pembayaran.
  - `tests/unit/report-pdf-shell.test.js` menutup shared shell dan footer page marker, memastikan refactor ini tidak memutus contract visual dasar.
- Validasi:
  - `node --test tests/unit/report-pdf-shell.test.js tests/unit/business-report.test.js tests/unit/party-statement.test.js`
  - `npx eslint api/notify.js src/lib/report-pdf.js tests/unit/report-pdf-shell.test.js tests/unit/business-report.test.js tests/unit/party-statement.test.js`
  - `npm run build`

### [2026-04-23] `UCW-341` - Harden assistant reply safety
- Status: `validated`
- Ringkasan:
  - Reply writer assistant harus tetap read-only dan grounded pada fact packet, button route, serta konteks session; rewrite yang menambah fakta baru harus ditolak.
  - Fallback deterministik tetap jadi jalur aman saat model melanggar safety gate.
- Addendum audit:
  - `isAssistantResponseSafe()` sekarang memblokir rewrite yang mengarang route, entity, atau aksi baru selain angka yang tidak grounded di fact packet.
  - `tests/unit/telegram-assistant-writer.test.js` menutup jalur rewrite aman, klarifikasi, fallback angka, dan penolakan route/entity/aksi yang tidak valid.
  - `npm run build` dan test/lint writer terkait lolos tanpa regresi.
- File target:
  - `api/telegram-assistant.js`
  - `tests/unit/telegram-assistant-writer.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`

### [2026-04-23] `UCW-340` - Dedikasikan detail faktur material dan poles delete UX lintas surface
- Status: `validated`
- Ringkasan:
  - `MaterialInvoiceDetailPage` sekarang berdiri di route canonical `/material-invoice/:id` dengan satu card pusat untuk ringkasan, item, dan aksi.
  - delete tetap terlihat di surface yang relevan; bila payment history sudah ada, dialog memberi fallback riwayat tagihan dan payroll history tetap read-only.
- File target:
  - `src/App.jsx`
  - `api/transactions.js`
  - `src/components/TransactionDeleteDialog.jsx`
  - `src/lib/material-invoice.js`
  - `src/lib/transaction-delete.js`
  - `src/pages/MaterialInvoiceDetailPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `tests/unit/transaction-delete.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - guard delete material invoice masih bergantung pada metadata `current_stock`; kalau metadata stok tidak ikut terhydrate, delete tetap diblok lebih awal.
  - redirect riwayat tagihan canonical harus tetap konsisten supaya fallback dialog tidak memutus deep link history surface.
- Audit hasil:
  - route list/detail workspace material invoice sekarang menuju `/material-invoice/:id`, sementara `TransactionDeleteDialog` dipakai lintas surface untuk history fallback ketika payment history sudah ada.
  - `TransactionsPage` tidak lagi menyembunyikan delete hanya karena `transaction.canDelete` false, dan `EditRecordPage`/`TransactionDetailPage` memakai helper history fallback yang sama.
  - `PayrollWorkerDetailPage` tetap read-only di riwayat pembayaran; audit tidak menemukan aksi hapus/unduh kwitansi yang perlu ditambahkan atau dihapus.
- Validasi:
  - `node --test tests/unit/transaction-delete.test.js tests/unit/report-pdf-delivery.test.js`
  - `npx eslint api/transactions.js src/App.jsx src/components/TransactionDeleteDialog.jsx src/lib/material-invoice.js src/lib/transaction-delete.js src/pages/EditRecordPage.jsx src/pages/MaterialInvoiceDetailPage.jsx src/pages/TransactionDetailPage.jsx src/pages/TransactionsPage.jsx tests/e2e/helpers/routes.js tests/unit/transaction-delete.test.js tests/unit/report-pdf-delivery.test.js`
  - `npm run build`

### [2026-04-23] `UCW-339` - Merge `ProjectsPage` dengan pengaturan PDF sebagai satu hub
- Status: `validated`
- Ringkasan:
  - `ProjectsPage` sekarang memuat report `Unit Kerja` dan pengaturan PDF di satu surface, sehingga fungsi report dan branding PDF tidak lagi terpisah di route utama.
  - route legacy `/projects/pdf-settings` tetap hidup sebagai alias kompatibilitas yang redirect ke anchor `#pdf-settings`.
- File target:
  - `src/pages/ProjectsPage.jsx`
  - `src/pages/ProjectPdfSettingsPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - section settings menambah tinggi halaman `ProjectsPage`, jadi anchor scroll harus tetap stabil di layar kecil.
  - alias redirect bergantung pada hash routing; kalau browser membuka route lama tanpa hash support, section tetap aman tapi tidak auto-scroll.
- Audit hasil:
  - `ProjectPdfSettingsSection` dipakai inline di `ProjectsPage`, dengan `FormSection` sebagai shell pengaturan PDF dan `FormLayout embedded` sebagai form action bar.
  - `ProjectPdfSettingsPage` kini hanya redirect ke `/projects#pdf-settings`, sehingga route lama tetap kompatibel tanpa surface duplikat.
  - tombol header di `ProjectsPage` mengarah ke hash section yang sama dan effect scroll menjaga section PDF tetap mudah ditemukan.
- Validasi:
  - `npx eslint src/pages/ProjectsPage.jsx src/pages/ProjectPdfSettingsPage.jsx`
  - `npm run build`
  - `npm run lint` *(gagal pada baseline existing di `playwright-report/trace/assets/*`; bukan dari patch ini)*

### [2026-04-23] `UCW-332` - Ringkas CTA notifikasi grup Telegram jadi satu tombol dan tambahkan notifikasi save absensi
- Status: `validated`
- Ringkasan:
  - notifikasi grup Telegram sekarang memakai satu tombol CTA canonical per event, jadi surface grup tetap ringkas dan tidak lagi menumpuk dua aksi di bawah chat.
  - save sheet absensi sekarang memicu notifikasi summary baru ke grup dengan CTA `Review absensi` ke `/payroll?tab=daily`, tanpa memblokir penyimpanan sheet kalau delivery gagal.
- File target:
  - `api/notify.js`
  - `src/components/AttendanceForm.jsx`
  - `tests/unit/telegram-notify.test.js`
  - `tests/live/release-smoke.spec.js`
  - `tests/live/helpers/live-app.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - notifikasi attendance tetap bergantung pada `fetch /api/notify`; kalau endpoint Telegram gagal, sheet tetap tersimpan tetapi notifikasi grup tidak terkirim.
  - live smoke memakai mock `/api/notify` untuk menghindari side effect Telegram nyata, jadi jalur notifikasi production tetap perlu diawasi lewat unit test dan runtime staging terpisah.
- Audit hasil:
  - `buildNotificationReplyMarkup()` sekarang mengembalikan satu tombol per event, termasuk `loan_payment` yang mengarah ke detail transaksi canonical surface riwayat.
  - `AttendanceForm` mengirim payload summary sheet setelah `saveAttendanceSheet` sukses, dan payload summary itu dibaca oleh `api/notify.js` untuk membangun text notifikasi baru.
  - live smoke menangkap request `/api/notify` saat absensi tersimpan, jadi proof coverage now membuktikan payload summary attendance benar-benar keluar dari UI save path.
- Validasi:
  - `node --test tests/unit/telegram-notify.test.js tests/unit/telegram-assistant-routing.test.js`
  - `npx eslint api/notify.js src/components/AttendanceForm.jsx tests/unit/telegram-notify.test.js tests/live/release-smoke.spec.js tests/live/helpers/live-app.js`
  - `npm run build`

### [2026-04-23] `UCW-331` - Pulihkan preview lokal `vercel dev` untuk API auth
- Status: `validated`
- Ringkasan:
  - `vercel.json` sekarang memberi kontrak dev/build Vite eksplisit dan memaksa upstream Vite bind ke `127.0.0.1`.
  - `.vercelignore` membatasi scan/watch Vercel ke file runtime sehingga folder docs, test artifact, export legacy, cache, dan log tidak lagi memicu watcher `EPERM`.
  - `npm run dev:api` menjadi command canonical untuk preview lokal dengan `/api/*`, sementara `npm run dev` tetap Vite UI-only.
- File target:
  - `.vercelignore`
  - `vercel.json`
  - `package.json`
  - `playwright.live.config.js`
  - `docs/release-aq-gate.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - `npm run dev:api` tetap membutuhkan Vercel CLI tersedia di PATH dan project link `.vercel/project.json` yang valid.
  - `.vercelignore` harus dijaga jika nanti runtime deployment membutuhkan folder baru di luar `api`, `src`, `public`, atau root config.
- Audit hasil:
  - Reproduksi awal menunjukkan `npm run dev` memberi Vite-only API `404`, sedangkan `vercel dev` gagal karena watcher `EPERM`.
  - Setelah patch, `vercel dev` mengabaikan folder non-runtime dan route root dilayani dari proxy Vercel lokal.
  - GET `/api/auth` menghasilkan `405`, membuktikan request masuk ke serverless function, bukan lagi Vite fallback atau timeout.
- Validasi:
  - `vercel dev --debug --listen 127.0.0.1:3000 --yes`
  - `Invoke-WebRequest http://127.0.0.1:3000/` -> `HTTP 200`
  - `Invoke-WebRequest http://127.0.0.1:3000/api/auth` -> `HTTP 405`

### [2026-04-23] `UCW-330` - Stabilkan env fallback delivery PDF Telegram untuk DM user terverifikasi
- Status: `validated`
- Ringkasan:
  - `api/report-pdf-delivery.js` sekarang membaca `SUPABASE_URL` dengan fallback `VITE_SUPABASE_URL`, serta `SUPABASE_PUBLISHABLE_KEY` dengan fallback `VITE_SUPABASE_PUBLISHABLE_KEY` dan `VITE_SUPABASE_ANON_KEY`.
  - lookup `telegram_user_id` tetap berjalan lewat client authenticated, lalu fallback ke metadata auth user bila query `profiles` tidak menghasilkan row yang bisa dipakai.
- File target:
  - `api/report-pdf-delivery.js`
  - `tests/unit/report-pdf-delivery.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - kalau metadata auth user belum menyimpan `telegram_user_id`, delivery DM tetap bisa gagal pada guard verifikasi user.
  - fallback ke public key tetap bergantung pada policy `profiles_select_own` atau metadata auth yang sudah sinkron.
- Audit hasil:
  - helper `resolveReportDeliveryEnv()` memusatkan fallback env dan dipakai handler sebelum auth/report processing.
  - `resolveTelegramUserId()` tidak lagi hard-fail hanya karena query `profiles` error, selama metadata auth user tersedia.
  - unit test baru membuktikan fallback `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` bekerja.
- Validasi:
  - `node --test tests/unit/report-pdf-delivery.test.js`
  - `npx eslint api/report-pdf-delivery.js tests/unit/report-pdf-delivery.test.js`
  - `npm run build`

### [2026-04-23] `UCW-329` - Tumpulkan Team Invite jadi field picker owner-only tanpa helper teks
- Status: `validated`
- Ringkasan:
  - Surface `Tim` sekarang lebih ringkas dan owner-only: role dipilih lewat field-style bottom sheet tanpa search, tanpa helper/deskripsi yang tidak perlu.
  - Empty copy dan deskripsi halaman dipangkas supaya pola visual mengikuti master form existing, bukan layar edukasi.
- File target:
  - `src/pages/TeamInvitePage.jsx`
  - `src/components/TeamInviteManager.jsx`
  - `src/components/ui/MasterPickerField.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - penghapusan copy yang terlalu agresif bisa membuat state kosong terasa terlalu hampa jika data invite belum ada.
  - picker tanpa search harus tetap konsisten dengan pola master form existing agar tidak memecah UX.
- Audit hasil:
  - `TeamInvitePage` tidak lagi menampilkan description pada header, sehingga surface langsung masuk ke konten utama.
  - `TeamInviteManager` memakai `MasterPickerField` tanpa search untuk role selector, menaruh refresh pada header section, dan menghapus empty-state/helper copy yang tidak perlu.
  - `MasterPickerField` tetap dipakai sebagai field-style bottom sheet, dengan dependency memo yang sudah konsisten untuk mode searchable/non-searchable.
- Validasi:
  - `npx eslint src/pages/TeamInvitePage.jsx src/components/TeamInviteManager.jsx src/components/ui/MasterPickerField.jsx`
  - `npm run build`

### [2026-04-23] `UCW-326` - Polish UI halaman Tim invite agar lebih rapih, jelas, dan brand-consistent
- Status: `validated`
- Ringkasan:
  - shell dan composer invite kini lebih jelas urutannya, sehingga alur `pilih role -> generate -> copy` terbaca tanpa perlu membaca banyak noise visual.
  - kartu link terbaru, empty state, dan list anggota aktif tetap memakai flow yang sama, tetapi hierarchy dan brand token sudah selaras dengan sistem visual existing.
- File target:
  - `src/pages/TeamInvitePage.jsx`
  - `src/components/TeamInviteManager.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - polish harus tetap menjaga action role/suspend dan copy link agar tidak mengubah contract invite yang sudah stabil.
  - text baru harus tetap ringkas; jika terlalu banyak, halaman Tim bisa terasa lebih berat daripada page lain di shell mobile.
- Audit hasil:
  - `TeamInvitePage` sekarang menampilkan eyebrow `Akses Tim` dan description yang langsung menjelaskan fungsi halaman tanpa mengubah navigasi.
  - `TeamInviteManager` merapikan composer invite dengan card utama, role selector, CTA generate, kartu link terbaru ber-tone info, empty state yang eksplisit, dan badge anggota yang lebih konsisten dengan brand.
  - list anggota aktif kini memakai tone icon yang lebih ringan dan badge `Owner aktif`, sementara flow role/suspend/copy link tetap sama.
- Validasi:
  - `npx eslint src/pages/TeamInvitePage.jsx src/components/TeamInviteManager.jsx`
  - `npm run build`
  - `git diff --check -- src/pages/TeamInvitePage.jsx src/components/TeamInviteManager.jsx docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`

### [2026-04-23] `UCW-327` - Arahkan review pembayaran bill ke detail transaksi surface riwayat
- Status: `validated`
- Ringkasan:
  - Tombol review pembayaran bill harus mendarat ke detail transaksi dengan surface riwayat, bukan ke halaman payment settlement.
  - Deep link Telegram tetap canonical, tetapi membawa context history yang bisa dibaca detail page.
- File target:
  - `api/notify.js`
  - `src/lib/telegram-assistant-links.js`
  - `src/pages/TransactionDetailPage.jsx`
  - `tests/unit/telegram-notify.test.js`
  - `tests/unit/telegram-assistant-routing.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Query route harus tetap diterima builder deep link Telegram; jika normalization terlalu ketat, tombol bisa hilang.
  - Default tab detail harus tetap stabil untuk route lain yang tidak membawa surface riwayat.
- Audit hasil:
  - tombol review pembayaran bill sekarang membuka `/transactions/:id?surface=riwayat`, bukan `/payment/:id`.
  - `normalizeAssistantRoutePath()` menerima query `surface=riwayat|history` untuk detail transaksi dan menormalisasinya ke canonical riwayat.
  - `TransactionDetailPage` me-reset tab aktif ke `Riwayat` saat surface history dipakai, jadi deep link review mendarat ke tab yang relevan.
- Validasi:
  - `node --test tests/unit/telegram-assistant-routing.test.js tests/unit/telegram-notify.test.js`
  - `npx eslint api/notify.js src/lib/telegram-assistant-links.js src/pages/TransactionDetailPage.jsx tests/unit/telegram-assistant-routing.test.js tests/unit/telegram-notify.test.js`
  - `npm run build`

### [2026-04-23] `UCW-324` - Stabilkan hydration `invite_link` agar link undangan owner tetap visible setelah refresh
- Status: `validated`
- Ringkasan:
  - helper invite baru menyatukan shape create dan reload, sehingga `latestInvite` tetap membawa `invite_link` setelah owner generate lalu refresh/refetch.
  - boundary assistant tetap read-only; route canonical `'/more/team-invite'` tetap tidak dikenali oleh builder link bot.
- File target:
  - `src/lib/team-invite.js`
  - `src/store/useTeamStore.js`
  - `src/lib/supabase.js`
  - `tests/unit/team-invite-store.test.js`
  - `tests/unit/telegram-assistant-routing.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - invite link tetap bergantung pada `VITE_TELEGRAM_BOT_USERNAME`; jika env hilang, fallback existing tetap dipakai.
  - helper bersama harus ikut berubah bila shape `invite_tokens` berubah di schema, supaya card tetap visible setelah reload.
- Audit hasil:
  - `mapInviteToken()` sekarang selalu menyusun `invite_link` dari token + bot username, dan store memakai helper yang sama untuk jalur create maupun reload.
  - `fetchActiveTeam()` tetap refetch setelah generate, tetapi hasil reload tidak lagi men-strip card invite karena shape data sudah konsisten.
  - `normalizeAssistantRoutePath('/more/team-invite')` tetap `null`, jadi bot boundary tetap read-only.
- Validasi:
  - `node --test tests/unit/team-invite-store.test.js tests/unit/telegram-assistant-routing.test.js`
  - `npx eslint src/lib/team-invite.js src/lib/supabase.js src/store/useTeamStore.js tests/unit/team-invite-store.test.js tests/unit/telegram-assistant-routing.test.js`
  - `npm run build`
  - `npm run lint` *(gagal pada asset trace existing di `playwright-report/trace/assets/*`; bukan dari patch ini)*

### [2026-04-23] `UCW-321` - Kunci fallback AI DM untuk user terverifikasi dan arahkan ke bot/web
- Status: `validated`
- Ringkasan:
  - Assistant Telegram sekarang memindahkan klarifikasi, workspace choice, dan drill-down yang terlalu detail dari grup ke DM bot untuk user terverifikasi.
  - Surface grup tetap ringkas: bila percakapan butuh detail, bot memberi tombol DM bot dan CTA review cepat ke Mini Web, bukan melanjutkan dialog panjang di grup.
- File target:
  - `api/telegram-assistant.js`
  - `src/lib/telegram-assistant-links.js`
  - `src/lib/telegram-assistant-routing.js`
  - `tests/unit/telegram-assistant-routing.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Handoff DM tidak membawa context lintas chat karena session masih dipetakan per `chat_id`, jadi user bisa perlu mengulang satu prompt setelah pindah surface.
  - Tombol DM bergantung pada `TELEGRAM_BOT_USERNAME`; kalau env itu hilang, fallback tetap berjalan lewat teks dan tombol Mini Web, tetapi CTA DM tidak muncul.
- Audit hasil:
  - `shouldUseAssistantDmFallback()` membedakan group/supergroup dari private dan memblokir prompt klarifikasi/workspace-choice agar tidak kembali ke grup.
  - `buildAssistantDmHandoffReply()` menambahkan tombol `t.me/<bot>` langsung dan route Mini Web canonical, sementara `buildInlineKeyboardButton()` sekarang menerima URL button.
  - `processTelegramMessage()` dan `processAssistantCommand()` memakai handoff yang sama untuk klarifikasi, workspace choice, dan callback follow-up.
- Validasi:
  - `node --check api/telegram-assistant.js`
  - `node --check src/lib/telegram-assistant-links.js`
  - `node --check src/lib/telegram-assistant-routing.js`
  - `node --test tests/unit/telegram-assistant-routing.test.js`
  - `node --test tests/unit/telegram-assistant-writer.test.js`
  - `npx eslint api/telegram-assistant.js src/lib/telegram-assistant-links.js src/lib/telegram-assistant-routing.js tests/unit/telegram-assistant-routing.test.js tests/unit/telegram-assistant-writer.test.js`
  - `npm run build`

### [2026-04-23] `UCW-320` - Notifikasi grup operasional summary + CTA review cepat
- Status: `validated`
- Ringkasan:
  - Notifikasi grup untuk event operasional sekarang memakai ringkasan singkat dan tombol review cepat ke surface canonical, supaya grup tidak dipakai untuk percakapan panjang.
  - Link review diarahkan ke Mini Web/route yang relevan; event `attendance` dan `recap` sudah dipetakan sebagai surface lanjut, jadi jalur grup tetap read-only.
- File target:
  - `api/notify.js`
  - `src/store/useIncomeStore.js`
  - `docs/freeze/03-source-of-truth-contract-map.md`
  - `docs/freeze/05-ai-execution-guardrails.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
  - `tests/unit/telegram-notify.test.js`
- Risiko:
  - Tombol review bergantung pada `TELEGRAM_BOT_USERNAME` / `VITE_TELEGRAM_BOT_USERNAME`; kalau env itu hilang di production, group CTA akan hilang dan notifikasi hanya fallback text.
  - Jalur recap/attendance sekarang sudah dipetakan di notification layer, tetapi producer runtime untuk dua event itu masih belum ada di repo, jadi belum ada smoke live untuk keduanya.
- Audit hasil:
  - `api/notify.js` sekarang membangun inline URL button ke Mini Web untuk `transaction`, `material_invoice`, `bill_payment`, `project_income`, `loan`, `loan_payment`, `salary_bill`, `attendance`, dan `recap`, dengan payload summary yang lebih ringkas.
  - `src/store/useIncomeStore.js` menambahkan `transactionId` pada notifikasi project income dan loan supaya tombol review bisa membuka detail canonical, bukan hanya daftar umum.
  - Freeze map dan guardrail sekarang menegaskan bahwa notifikasi grup adalah publish/read-only surface dengan CTA cepat, bukan tempat percakapan bebas.
- Validasi:
  - `node --check api/notify.js`
  - `node --check src/store/useIncomeStore.js`
  - `node --test tests/unit/telegram-notify.test.js`
  - `node --test tests/unit/telegram-assistant-routing.test.js tests/unit/telegram-notify.test.js`
  - `npx eslint api/notify.js src/store/useIncomeStore.js tests/unit/telegram-notify.test.js`
  - `npm run build`

### [2026-04-23] `UCW-319` - Fallback laporan bisnis Telegram Mini Web ke DM user terverifikasi
- Status: `validated`
- Ringkasan:
  - `ProjectReport` sekarang punya jalur `Kirim ke DM` yang hanya muncul di Telegram Mini Web, sementara unduh PDF browser tetap menjadi jalur utama.
  - Delivery bisnis report dilakukan server-side ke DM user terverifikasi, dan jika pengiriman file gagal, bot mengirim fallback text yang mengarahkan user kembali ke browser untuk unduh langsung.
- File target:
  - `api/report-pdf-delivery.js`
  - `src/lib/report-delivery-api.js`
  - `src/store/useReportStore.js`
  - `src/components/ProjectReport.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Delivery DM tetap bergantung pada user yang sudah terverifikasi dan pernah membuka bot; kalau Telegram menolak chat pribadi, fallback hanya sempat mengirim text bila document gagal.
  - Report PDF server-side memakai generator yang sama dengan browser, jadi jika ada drift di helper PDF, efeknya akan terlihat di dua surface sekaligus.
- Audit hasil:
  - Endpoint baru memverifikasi session Supabase, membaca `telegram_user_id`, lalu mengirim PDF bisnis via `sendDocument` ke DM user terverifikasi.
  - Store report sekarang punya aksi `sendBusinessReportToTelegramDm`, dan UI `ProjectReport` menampilkan tombol fallback hanya di Telegram.
  - Jika delivery document gagal, route mengirim fallback text yang mengarahkan user kembali ke browser, sehingga user tidak terhenti tanpa petunjuk.
- Validasi:
  - `node --check api/report-pdf-delivery.js`
  - `node --check src/lib/report-delivery-api.js`
  - `node --check src/store/useReportStore.js`
  - `npx eslint api/report-pdf-delivery.js src/lib/report-delivery-api.js src/store/useReportStore.js src/components/ProjectReport.jsx`
  - `npm run build`
- Follow-up:
  - Task berikutnya adalah `UCW-321` untuk fallback DM assistant terverifikasi, lalu `UCW-322` untuk smoke browser/Mini Web/DM.

### [2026-04-23] `UCW-318` - Tambah smoke live `income -> fee bill` dan `material invoice -> bill/stock`, lalu catat blocker lane sisa
- Status: `validated`
- Ringkasan:
  - Live smoke staging sekarang menambah proof create `project-income` dan create `material invoice` unpaid, lalu merekam artifact parent-child yang dibutuhkan untuk verifier Supabase.
  - Gate release kini menandai `income` dan `material invoice` sebagai domain yang sudah punya automation path, sambil mengunci blocker aktif untuk payroll, attachment, report/PDF, delete lifecycle, dan target staging-safe.
- File target:
  - `tests/live/release-smoke.spec.js`
  - `scripts/aq/verify-live-smoke.mjs`
  - `docs/release-aq-gate.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Smoke `income -> fee bill` mengasumsikan staging punya minimal satu staff aktif dengan `payment_type` `per_termin` atau `fixed_per_termin`; tanpa itu, bill fee tidak akan muncul dan gate harus dianggap belum siap.
  - Smoke `material invoice` mengasumsikan staging punya project, supplier material, material, dan trigger stok/bill yang sinkron; jika seed atau trigger drift, proof parent-child ini akan gagal.
  - Eksekusi write smoke penuh belum dijalankan di turn ini karena context repo belum membuktikan `.env` aktif aman sebagai target staging disposable.
- Audit hasil:
  - `tests/live/release-smoke.spec.js` sekarang membuat `project-income` dari UI create form, lalu membuat `material invoice` unpaid dan merekam artifact `project_income`, `project_income_fee_bill`, `material_invoice`, `material_invoice_bill`, `material_invoice_line_item`, serta `material_stock_transaction`.
  - `scripts/aq/verify-live-smoke.mjs` kini memeriksa `project_incomes`, `bills` fee by `project_income_id`, `expenses` material invoice, `expense_line_items`, dan `stock_transactions`.
  - `docs/release-aq-gate.md` sekarang menandai coverage `Income -> fee bill` dan `Material invoice / surat jalan` sebagai `sudah ada`, lalu menambahkan section `Active Blockers` untuk domain yang belum aman dijalankan.
- Validasi:
  - `node --check tests/live/release-smoke.spec.js`
  - `node --check scripts/aq/verify-live-smoke.mjs`
  - `npx playwright test --config=playwright.live.config.js --list`
  - `npm run lint`
  - `npm run build`
  - `rg -n "Income -> fee bill|Material invoice / surat jalan|Active Blockers" docs/release-aq-gate.md`
  - `rg -n "UCW-317|UCW-318" docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`
  - `git diff --check -- tests/live/release-smoke.spec.js scripts/aq/verify-live-smoke.mjs docs/release-aq-gate.md docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`

### [2026-04-23] `UCW-317` - Hardening lane live smoke lokal pakai `vercel dev` dan auto-load verifier env
- Status: `validated`
- Ringkasan:
  - Runner live smoke lokal sekarang memakai runtime penuh `vercel dev`, sehingga jalur `/api/auth`, `/api/transactions`, dan `/api/records` bisa dilayani dari lokal tanpa base URL eksternal.
  - Verifier Supabase kini bisa membaca `.env` lalu `.env.local` otomatis saat env shell kosong, sehingga audit DB tidak lagi bergantung pada export manual.
- File target:
  - `playwright.live.config.js`
  - `scripts/aq/verify-live-smoke.mjs`
  - `docs/release-aq-gate.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - `vercel dev` tetap bergantung pada project link `.vercel/project.json` dan env lokal yang valid; kalau link atau env rusak, lane live tetap tidak bisa start.
  - Auto-load `.env` membantu lokal, tetapi tidak menggantikan kebutuhan memisahkan target staging-safe dari production-safe.
- Audit hasil:
  - `playwright.live.config.js` sekarang default menjalankan `vercel dev --listen 127.0.0.1:3000 --yes`, dengan override opsional lewat `E2E_LOCAL_SERVER_COMMAND`.
  - `scripts/aq/verify-live-smoke.mjs` sekarang memuat `.env` lalu `.env.local` sebelum membuat service-role verifier client.
  - `docs/release-aq-gate.md` sudah disinkronkan agar kontrak live smoke menyebut `vercel dev` sebagai runner lokal resmi.
- Validasi:
  - `node --check playwright.live.config.js`
  - `node --check scripts/aq/verify-live-smoke.mjs`
  - `vercel help dev`

### [2026-04-23] `UCW-316` - Tambah smoke live `expense -> bill -> partial payment -> recalc`
- Status: `validated`
- Ringkasan:
  - Live smoke staging sekarang membuktikan jalur `expense` unpaid membentuk `bill`, lalu partial `bill_payment` dari `/payment/:id` mengubah summary parent secara nyata.
  - Verifier Supabase kini memeriksa `expenses`, `bills`, dan `bill_payments` sehingga status `partial` dan `paid_amount` parent tidak lagi hanya diasumsikan dari UI.
- File target:
  - `tests/live/release-smoke.spec.js`
  - `scripts/aq/verify-live-smoke.mjs`
  - `docs/release-aq-gate.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Smoke ini mengasumsikan staging punya seed `project`, `expense category`, dan `supplier` operasional aktif; tanpa seed itu, create expense akan gagal dan gate harus dianggap belum siap.
  - Belum ada automation untuk edit expense, full payment, atau delete/restore; domain `expense/tagihan` masih butuh AQ lanjutan walau write proof partial sudah ada.
- Audit hasil:
  - `tests/live/release-smoke.spec.js` sekarang memilih master seed staging dari picker, membuat `expense` unpaid, lalu membuka `/payment/:billId` untuk menyimpan partial payment dan merekam artifact `expense`, `bill_payment`, serta `expense_bill_after_payment`.
  - `scripts/aq/verify-live-smoke.mjs` kini memverifikasi row `expenses`, row `bills` parent dengan status `partial`, dan row `bill_payments` child dengan nominal/tanggal/catatan yang sesuai artifact.
  - `docs/release-aq-gate.md` sekarang menyebut write proof minimum baru, coverage matrix `Expense -> bill -> payment` sebagai `sudah ada`, dan menggeser prioritas smoke berikutnya ke `income -> fee bill visibility`.
- Validasi:
  - `node --check tests/live/release-smoke.spec.js`
  - `node --check scripts/aq/verify-live-smoke.mjs`
  - `node scripts/aq/verify-live-smoke.mjs --help`
  - `npx playwright test --config=playwright.live.config.js --list`
  - `npm run lint`
  - `npm run build`
  - `rg -n "Expense -> bill -> payment|income -> fee bill visibility" docs/release-aq-gate.md`
  - `rg -n "UCW-316" docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`
  - `git diff --check -- tests/live/release-smoke.spec.js scripts/aq/verify-live-smoke.mjs docs/release-aq-gate.md docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`

### [2026-04-23] `UCW-315` - Petakan readiness staging dan coverage matrix AQ per domain
- Status: `validated`
- Ringkasan:
  - Gate release sekarang punya matrix readiness staging yang menegaskan env, akun uji, workspace seed, artifact, verifier, dan safety boundary sebelum live smoke dijalankan.
  - Dokumen gate juga sekarang memetakan coverage per domain: mana yang sudah dibuktikan otomatis, mana yang baru punya AQ manual, dan mana yang masih blocker release karena belum punya smoke proof.
- File target:
  - `docs/release-aq-gate.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Matrix ini masih bergantung pada asumsi schema dan seed staging mirror setara production; kalau staging drift, status coverage bisa tampak lebih siap daripada kondisi runtime sebenarnya.
  - Domain yang ditandai `belum ada` masih perlu implementasi smoke lane baru; dokumen ini hanya mengunci urutan dan definisi gap, bukan menutup gap itu sendiri.
- Audit hasil:
  - `docs/release-aq-gate.md` sekarang memiliki `Staging Readiness Matrix` yang mengunci parity Supabase, auth bootstrap, verifier access, akun uji, prefix disposable, cleanup owner, dan production safety.
  - `docs/release-aq-gate.md` juga sekarang memiliki `Coverage Matrix` yang membedakan domain yang sudah punya smoke proof (`funding_creditor`, `loan`, `invite_token`) dari domain blocker yang belum punya automation (`expense`, `income`, `material invoice`, `attendance/payroll`, `attachment`, `report/PDF`, `delete lifecycle`).
  - `docs/release-aq-gate.md` menutup dengan urutan `Next Smoke Priority` agar eksekusi setelah ini dimulai dari `expense -> bill -> partial payment -> recalc`, bukan lompat ke domain yang lebih mahal.
- Validasi:
  - `rg -n "Staging Readiness Matrix|Coverage Matrix|Next Smoke Priority" docs/release-aq-gate.md`
  - `rg -n "UCW-315" docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`
  - `git diff --check -- docs/release-aq-gate.md docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`

### [2026-04-23] `UCW-312` - Bangun AQ gate staging dan harness live smoke release
- Status: `validated`
- Ringkasan:
  - Repo sekarang punya gate AQ tertulis yang memisahkan regression mock, live smoke staging, dan production canary, sehingga keputusan `siap release production` dan `bisa simpan data real` tidak lagi bercampur.
  - Harness live smoke baru membuktikan tiga jalur write nyata yang paling murah tetapi representatif: `Master` (`funding_creditor`), core finance (`loan`), dan `Tim` (`invite_token`), lalu verifier service-role membaca artifact hasil smoke untuk memastikan row benar-benar tersimpan di Supabase.
- File target:
  - `docs/release-aq-gate.md`
  - `playwright.live.config.js`
  - `tests/live/helpers/live-app.js`
  - `tests/live/helpers/live-artifacts.js`
  - `tests/live/release-smoke.spec.js`
  - `scripts/aq/verify-live-smoke.mjs`
  - `package.json`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Lane live smoke mengasumsikan app lokal berjalan dengan env staging mirror dan `devAuthBypass`; ia bukan pengganti production canary Telegram nyata.
  - Verifier hanya memeriksa row yang sudah tercatat di artifact smoke; jika test gagal sebelum artifact lengkap, cleanup staging tetap harus memakai artifact parsial itu secara hati-hati.
- Audit hasil:
  - `docs/release-aq-gate.md` sekarang mengunci severity `blocker/major/minor`, urutan gate, env wajib, checklist manual AQ, dan boundary scope `core release + Tim + Master`.
  - `playwright.live.config.js` dan `tests/live/*` memisahkan lane write-real dari suite `tests/e2e/*` yang masih dominan mock, sehingga `npm run test:e2e` tidak otomatis menembak staging.
  - `tests/live/release-smoke.spec.js` menggunakan `devAuthBypass` lokal tanpa `page.route()` mocking untuk membuka dashboard/ledger/payroll/master, membuat `funding_creditor`, membuat `loan`, membuat `invite_token`, lalu menulis artifact ke `test-results/live-smoke-created-records.json`.
  - `scripts/aq/verify-live-smoke.mjs` membaca artifact itu dan memverifikasi `funding_creditors`, `loans`, dan `invite_tokens` lewat service-role Supabase sebelum menulis `test-results/live-smoke-verification.json`.
  - `package.json` sekarang menyediakan command eksplisit `npm run test:e2e:live` dan `npm run aq:verify:live` untuk lane AQ staging.
- Validasi:
  - `git status --short`
  - `git diff --check -- package.json playwright.live.config.js docs/release-aq-gate.md docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md tests/live scripts/aq`
  - `node --check playwright.live.config.js`
  - `node --check tests/live/helpers/live-app.js`
  - `node --check tests/live/helpers/live-artifacts.js`
  - `node --check tests/live/release-smoke.spec.js`
  - `node --check scripts/aq/verify-live-smoke.mjs`
  - `node scripts/aq/verify-live-smoke.mjs --help`
  - `npx playwright test --config=playwright.live.config.js --list`
  - `npm run lint`
  - `npm run build`

### [2026-04-23] `UCW-302` - Audit env Vercel project baru, redeploy, dan smoke test assistant
- Status: `validated`
- Ringkasan:
  - Project Vercel baru untuk `banplex-telegram` sekarang punya 14 env runtime aktif di scope `production` dan `preview`, lalu deployment baru dibangun ulang agar env terbaru dibaca.
  - Smoke test endpoint assistant lolos dengan response minimal `{"ok":true,"processed":false}`, lalu webhook Telegram dicutover ke alias production baru.
- File target:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Jika env preview berubah lagi, preview deployment berikutnya tetap harus dibangun ulang agar runtime preview membaca scope terbaru.
  - Secret webhook harus terus dirotasi jika ada indikasi kebocoran baru; cutover berikutnya wajib menyamakan env project dan webhook Telegram.
- Audit hasil:
  - `vercel env ls production` dan `vercel env ls preview` sama-sama menunjukkan 14 entry runtime untuk project `dragontrail133-cpus-projects/banplex-telegram`.
  - Jalur `vercel redeploy` pada deployment URL lama gagal dengan mismatch team, lalu rebuild final dilakukan via `vercel deploy --prod --yes --force` dari project yang ter-link.
  - Production deployment baru `https://banplex-telegram-fohs0ktih-dragontrail133-cpus-projects.vercel.app` selesai, lalu alias production aktif menjadi `https://banplex-telegram.vercel.app`.
  - Smoke POST ke `https://banplex-telegram.vercel.app/api/telegram-assistant` mengembalikan `200` + `{"ok":true,"processed":false}`.
  - `Telegram setWebhook` diarahkan ke `https://banplex-telegram.vercel.app/api/telegram-assistant`, lalu `getWebhookInfo` menunjukkan URL itu, `pending_update_count = 0`, `last_error_message = null`, dan `allowed_updates = ["message","edited_message","callback_query"]`.
  - Saat uji webhook read-only dijalankan dengan payload Telegram yang valid, sempat muncul blocker remote `telegram_assistant_sessions` belum ada; migrasi `supabase/migrations/20260423101000_create_telegram_assistant_sessions.sql` kemudian diaplikasikan ke Supabase project target, setelah itu request `status` dan `navigate` kembali lolos dengan `{"ok":true,"processed":true}`.
  - Classifier xAI awalnya sempat timeout di 8 detik dan memicu fallback deterministik; timeout dinaikkan ke 15 detik, lalu request `status` dan `navigate` ulang tetap lolos dengan `{"ok":true,"processed":true}` tanpa error timeout.
- Validasi:
  - `vercel whoami --debug`
  - `vercel env ls production`
  - `vercel env ls preview`
  - `vercel deploy --prod --yes --force`
  - smoke test POST ke `/api/telegram-assistant`
  - `Telegram setWebhook`
  - `Telegram getWebhookInfo`
  - direct POST webhook assistant dengan payload `status` dan `navigate`
  - direct check `telegram_assistant_sessions` via Supabase REST setelah migrasi

### [2026-04-23] `UCW-303` - Audit regresi notifikasi `/api/notify` pada create payment
- Status: `validated`
- Ringkasan:
  - Route `/api/notify` sempat gagal `FUNCTION_INVOCATION_FAILED` untuk notifikasi payment karena `src/lib/business-report.js` mengimpor `./date-time` tanpa ekstensi `.js`, sehingga serverless Node ESM di Vercel tidak bisa resolve dependency saat `bill_payment`/`loan_payment` memanggil jalur PDF receipt.
  - Import sudah diperbaiki ke `./date-time.js`, lalu production redeploy baru berhasil dan notifikasi `bill_payment` serta `salary_bill` kembali terkirim normal.
- File target:
  - `src/lib/business-report.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Jika ada helper server-side lain masih memakai import extensionless, Vercel serverless ESM bisa kena regresi serupa.
  - Jalur notifikasi payment tetap bergantung pada `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` yang valid di runtime project.
- Audit hasil:
  - Direct POST `https://banplex-telegram.vercel.app/api/notify` untuk `bill_payment` sempat gagal dengan `FUNCTION_INVOCATION_FAILED` + `ERR_MODULE_NOT_FOUND` dari `src/lib/business-report.js`.
  - Setelah `src/lib/business-report.js` diganti ke `./date-time.js`, `npm run lint` dan `npm run build` lolos.
  - `vercel deploy --prod --yes --force` menghasilkan deployment baru `https://banplex-telegram-ij1teid3h-dragontrail133-cpus-projects.vercel.app` dan alias production tetap aktif di `https://banplex-telegram.vercel.app`.
  - Direct POST `bill_payment` dan `salary_bill` ke `/api/notify` sekarang kembali `200` + `success: true`, dengan Telegram menerima document/text notification.

### [2026-04-23] `UCW-304` - Prioritaskan intent deterministik untuk prompt Telegram eksplisit
- Status: `validated`
- Ringkasan:
  - Prompt Telegram eksplisit sempat terus dijawab clarifying question generik karena classifier AI meng-overwrite sinyal yang sudah jelas, sehingga intent `status/search/navigate/refuse` tidak konsisten untuk prompt sederhana.
  - `api/telegram-assistant.js` sekarang memprioritaskan heuristic deterministik untuk prompt yang sudah jelas, dan AI classifier hanya dipakai saat heuristic masih `clarify`.
- File target:
  - `api/telegram-assistant.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Prompt yang sangat ambigu tetap akan lewat classifier AI; jika model provider melambat atau berubah perilaku, clarifying question bisa berbeda tanpa mengubah alur utama.
  - Jika ada intent baru di masa depan, heuristic deterministik harus diperluas supaya tidak terlalu agresif mengabaikan classifier AI.
- Audit hasil:
  - Harness lokal berbasis VM menunjukkan `status tagihan unpaid` → `status`, `cari termin 2` → `search`, `buka jurnal` → `navigate`, dan `hapus tagihan ini` → `refuse`.
  - `npx eslint api/telegram-assistant.js` dan `npm run build` lolos setelah patch.
  - `vercel deploy --prod --yes --force` menghasilkan deployment baru `https://banplex-telegram-4zcxfxjym-dragontrail133-cpus-projects.vercel.app` dan alias production tetap aktif di `https://banplex-telegram.vercel.app`.
  - Direct POST webhook assistant dengan prompt eksplisit kembali `200` + `{"ok":true,"processed":true}` tanpa error runtime.

### [2026-04-23] `UCW-305` - Batasi respons Telegram ke mention/reply atau intent eksplisit
- Status: `validated`
- Ringkasan:
  - Bot Telegram sekarang diam untuk chat bebas yang tidak jelas; private chat hanya diproses bila punya intent read-only eksplisit atau sesi lanjutan aktif, sedangkan group/supergroup hanya diproses bila bot di-mention atau dijadikan reply target.
  - Gate ini mencegah clarifying question generik muncul untuk percakapan bebas di Telegram, tanpa mengubah jalur intent eksplisit yang sudah lolos di `UCW-304`.
- File target:
  - `api/telegram-assistant.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Jika `TELEGRAM_BOT_USERNAME` salah atau kosong, mention/reply gate di group bisa terlalu ketat dan bot tidak akan merespons percakapan yang semestinya valid.
  - Chat group yang tidak memakai reply/mention tetap sengaja diabaikan, jadi user harus membiasakan pola interaksi eksplisit.
- Audit hasil:
  - `shouldProcessTelegramMessage()` sekarang menolak private `clarify` tanpa sesi aktif dan menolak group/supergroup yang tidak mention/reply bot.
  - Harness VM lokal memverifikasi private explicit `true`, private free `false`, group mention `true`, group free `false`, dan group reply `true`.
  - Production redeploy baru selesai ke `https://banplex-telegram-q1m8u8j3s-dragontrail133-cpus-projects.vercel.app` lalu alias aktif tetap `https://banplex-telegram.vercel.app`.
  - Direct POST production untuk private `halo` dan group `status tagihan unpaid` tanpa mention/reply sama-sama mengembalikan `{"ok":true,"processed":false}`.
- Validasi:
  - `npm run lint`
  - `npm run build`
  - VM harness lokal untuk gating assistant
  - `vercel deploy --prod --yes --force`
  - Direct POST ke `/api/telegram-assistant` untuk private free chat dan group free chat

### [2026-04-23] `UCW-306` - Gemini-first clarifier dengan template final dan konteks Sunda
- Status: `validated`
- Ringkasan:
  - Assistant Telegram sedang diperluas dengan context ringkas per chat, dukungan input campuran Indonesia/Sunda, dan classifier Gemini-first untuk pesan ambigu sebelum fallback ke xAI atau deterministic plan.
  - Output final tetap template-driven; model hanya memilih intent, bahasa, dan slot konteks yang dibutuhkan, bukan menulis teks bebas ke user.
- File target:
  - `api/telegram-assistant.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Jika context memory terlalu agresif, bot bisa lebih sering mengajukan klarifikasi pada pesan pendek yang seharusnya diabaikan.
  - Jika Gemini gagal atau output JSON rusak, fallback xAI/deterministic harus tetap menjaga final template.
- Audit hasil:
  - `api/telegram-assistant.js` sekarang menyimpan context ringkas per chat, memprioritaskan Gemini untuk case ambigu, dan merender reply final lewat template fixed untuk status/search/navigate/refuse/clarify.
  - `npm run lint` dan `npm run build` lolos setelah patch.
  - `vercel deploy --prod --yes --force` menghasilkan deployment baru `https://banplex-telegram-1ip8pd5xc-dragontrail133-cpus-projects.vercel.app` dan alias production aktif tetap `https://banplex-telegram.vercel.app`.
  - Smoke test aman ke `/api/telegram-assistant` dengan header secret dan body kosong mengembalikan `{"ok":true,"processed":false}`.
  - Live replay 3 update private berurutan pada chat yang sama kembali `{"ok":true,"processed":true}` untuk prompt eksplisit Indonesia, prompt Sunda, dan follow-up ambigu.
  - `vercel logs banplex-telegram.vercel.app --no-follow --since 10m` tidak menampilkan error runtime baru pada deploy final.

### [2026-04-23] `UCW-307` - Semantic analytics pack untuk query ambigu dan alias entitas
- Status: `validated`
- Ringkasan:
  - Assistant Telegram sekarang bisa menangani query read-only berbasis agregat seperti sisa hutang, total tagihan, jumlah pekerja hadir, pengeluaran per periode, dan ranking entitas terbesar dengan pemahaman Indonesia/Sunda campuran.
  - Output final tetap template-driven; classifier hanya memilih metric, entity, window, dan clarification slot, lalu reply user-facing dirender dari template fixed.
- File target:
  - `api/telegram-assistant.js`
  - `src/lib/telegram-assistant-links.js`
  - `tests/e2e/telegram-shell.spec.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Analytics ranking bergantung pada kualitas label entity dan data view yang tersedia; kalau label ambigu, bot akan kembali ke clarifying template.
  - Window periode seperti kemarin/minggu ini/bulan ini harus tetap konsisten dengan timezone app jika nanti helper tanggal berubah.
- Audit hasil:
  - `api/telegram-assistant.js` sekarang punya analytics planner, template reply, context ringkas per chat, dan clarifier slot untuk metric/entity/window.
  - `src/lib/telegram-assistant-links.js` dan Playwright shell test sudah mendukung route `/payroll` serta tab worker.
  - `node --check api/telegram-assistant.js`, `node --check src/lib/telegram-assistant-links.js`, `node --check tests/e2e/telegram-shell.spec.js`, `npm run lint`, `npm run build`, dan `npx playwright test tests/e2e/telegram-shell.spec.js --reporter=line` semuanya lolos.
  - Deploy production terbaru dan smoke test live mengonfirmasi prompt analytics jelas `{"ok":true,"processed":true}`; prompt ambigu `sisa hutang mang dindin` juga berhasil diproses setelah helper reply retry tanpa target reply yang tidak valid.

### [2026-04-23] `UCW-308` - Orkestrasi AI natural-language untuk assistant Telegram read-only
- Status: `validated`
- Ringkasan:
  - Assistant Telegram sekarang berjalan dengan pola deterministic planner + AI writer natural-language, dengan backend verifier yang menolak klaim di luar fact packet.
  - Output final tetap read-only dan paham Indonesia/Sunda campuran, tetapi tidak lagi terpaku pada template fixed; writer Gemini/xAI menjadi lapisan terakhir sebelum pesan dikirim ke Telegram.
- File target:
  - `api/telegram-assistant.js`
  - `docs/freeze/01-planning-decision-freeze.md`
  - `docs/freeze/02-prd-master.md`
  - `docs/freeze/03-source-of-truth-contract-map.md`
  - `docs/freeze/05-ai-execution-guardrails.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
  - `tests/unit/telegram-assistant-writer.test.js`
- Risiko:
  - Kalau verifier terlalu ketat, balasan AI bisa lebih sering jatuh ke fallback deterministic.
  - Kalau prompt writer terlalu longgar, model bisa mengulang angka atau nama yang tidak ada di fact packet.
- Audit hasil:
  - Helper writer dan verifier sudah ditanam di `api/telegram-assistant.js`, lalu assistant runtime sekarang merewrite reply deterministik ke natural-language sebelum dikirim.
  - `node --check api/telegram-assistant.js`, `node --check tests/unit/telegram-assistant-writer.test.js`, `npm run lint`, `npm run build`, dan `node --test tests/unit/telegram-assistant-writer.test.js` semuanya lolos.
  - `vercel deploy --prod --yes --force` menghasilkan deployment produksi baru `https://banplex-telegram-oqh25yll6-dragontrail133-cpus-projects.vercel.app` dan alias tetap aktif di `https://banplex-telegram.vercel.app`.
  - Smoke test live ke `/api/telegram-assistant` mengembalikan `{"ok":true,"processed":false}` untuk body kosong dan `{"ok":true,"processed":true}` untuk pesan read-only yang memicu writer AI.

### [2026-04-23] `UCW-309` - Upgrade assistant Telegram dengan command surface, inline callback, dan hybrid transcript
- Status: `validated`
- Ringkasan:
  - Assistant Telegram sekarang punya entrypoint command `/menu /status /cari /analytics /riwayat /buka`, inline keyboard yang bisa mencampur quick action callback dengan deep link workspace resmi, dan callback routing yang tetap masuk ke planner/verifier read-only yang sama.
  - `telegram_assistant_sessions.pending_payload` sekarang dipadatkan ke format hybrid transcript yang menyimpan summary, last turn, last route, entity hints, dan transcript pendek bercap waktu tanpa menambah kolom atau source of truth baru.
- File target:
  - `api/telegram-assistant.js`
  - `docs/freeze/01-planning-decision-freeze.md`
  - `docs/freeze/02-prd-master.md`
  - `docs/freeze/03-source-of-truth-contract-map.md`
  - `docs/freeze/05-ai-execution-guardrails.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
  - `tests/unit/telegram-assistant-writer.test.js`
  - `tests/unit/telegram-assistant-routing.test.js`
- Risiko:
  - Callback clarification untuk metric/entity/window sengaja bergantung pada session aktif; jika session expired, user harus memulai ulang dari command atau pesan baru.
  - Inline keyboard sekarang lebih kaya; kalau `TELEGRAM_BOT_USERNAME` tidak valid, deep link resmi tidak akan terbentuk meski quick action callback tetap jalan.
- Audit hasil:
  - `api/telegram-assistant.js` sekarang mengenali slash command resmi, mengizinkan explicit command di private/group, memetakan callback `ta:*` ke input planner yang sama, dan menambahkan keyboard quick action + route link pada reply yang relevan.
  - `pending_payload` sekarang dinormalisasi ke `summary`, `last_turn`, `last_route`, `entity_hints`, dan transcript pendek bercap waktu, sambil tetap kompatibel dengan field lama seperti `context_summary` dan `last_target_path`.
  - `docs/freeze/*` dan plan/progress stream kini mencatat eksplisit bahwa command bot, inline callback, dan hybrid transcript adalah satu workflow read-only yang sama, tanpa migrasi schema baru.
- Validasi:
  - `node --check api/telegram-assistant.js`
  - `node --check tests/unit/telegram-assistant-writer.test.js`
  - `node --check tests/unit/telegram-assistant-routing.test.js`
  - `node --test tests/unit/telegram-assistant-writer.test.js`
  - `node --test tests/unit/telegram-assistant-routing.test.js`
  - `npm run lint`
  - `npm run build`

### [2026-04-23] `UCW-313` - Modularisasi helper Telegram assistant menjadi routing/session/transport modules
- Status: `validated`
- Ringkasan:
  - Helper pure assistant sekarang dipisah ke modul `session`, `routing`, dan `transport`, sehingga file API utama tidak lagi memikul seluruh boundary logic sekaligus.
  - Production deploy terbaru tetap lolos smoke live read-only, termasuk command `/menu` dan `/analytics`, callback metric/window/history, serta query Supabase yang menunjukkan session hybrid masih utuh.
- File target:
  - `api/telegram-assistant.js`
  - `src/lib/telegram-assistant-session.js`
  - `src/lib/telegram-assistant-routing.js`
  - `src/lib/telegram-assistant-transport.js`
  - `tests/unit/telegram-assistant-routing.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Tiga modul baru menambah surface import yang harus dijaga konsistensinya; bila nanti helper umum berubah, perlu sinkronisasi antara API utama dan modul terpisah.
  - Lint repo masih punya dua file pre-existing yang memanggil `process` tanpa deklarasi Node global, tetapi itu di luar area assistant dan tidak mengubah hasil smoke bot.
- Audit hasil:
  - `src/lib/telegram-assistant-session.js` memuat normalisasi payload hybrid dan builder session.
  - `src/lib/telegram-assistant-routing.js` memuat parser command dan router callback.
  - `src/lib/telegram-assistant-transport.js` memuat transport Telegram, `answerTelegramCallback`, dan hardening ack invalid/expired.
  - `tests/unit/telegram-assistant-routing.test.js` sekarang memverifikasi modul direct, bukan hanya re-export API.
  - `vercel deploy --prod --yes --force --format json` berhasil mempromosikan build terbaru ke alias `https://banplex-telegram.vercel.app`.
  - Smoke live ke alias production mengembalikan `ok=true processed=true` untuk `/menu`, `/analytics`, callback `ta:am:cash_outflow`, callback `ta:aw:month_current`, dan callback `ta:cmd:riwayat`.
  - Query SQL ke `public.telegram_assistant_sessions` menunjukkan row terbaru berstatus `idle`, `pending_payload ? 'summary' = true`, `jsonb_array_length(transcript) = 4`, dan `last_route = '/transactions?tab=history'`.

### [2026-04-23] `UCW-314` - Runbook verifikasi tombol `buka` Telegram dan deep-link canonical
- Status: `validated`
- Ringkasan:
  - checklist debug `buka` sekarang terdokumentasi sebagai runbook yang memisahkan pesan lama, deploy terbaru, dan konfigurasi BotFather/Telegram Mini App.
  - unit test deep-link mengunci format canonical `https://t.me/<bot>?startapp=...` supaya tombol `buka` tidak bergeser dari target resmi.
- File target:
  - `docs/telegram-assistant-buka-debug-checklist.md`
  - `tests/unit/telegram-assistant-routing.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - runbook tidak mengubah client Telegram, jadi bila masalah ada di device/client lama, langkah manual tetap diperlukan.
- Audit hasil:
  - baseline produksi sudah terverifikasi: username bot aktif `banplex_greenfield_bot` dan webhook production mengarah ke `https://banplex-telegram.vercel.app/api/telegram-assistant`.
  - guard test deep-link sekarang menangkap regresi format URL `buka` sebelum deployment berikutnya.
  - production redeploy terbaru sudah selesai dan alias `https://banplex-telegram.vercel.app` kembali aktif untuk build yang memakai format deep-link tanpa short_name `/app`.
- Validasi:
  - `node --test tests/unit/telegram-assistant-routing.test.js`
- Validasi:
  - `node --check api/telegram-assistant.js`
  - `node --check src/lib/telegram-assistant-session.js`
  - `node --check src/lib/telegram-assistant-routing.js`
  - `node --check src/lib/telegram-assistant-transport.js`
  - `node --check tests/unit/telegram-assistant-routing.test.js`
  - `node --check tests/unit/telegram-assistant-writer.test.js`
  - `node --test tests/unit/telegram-assistant-routing.test.js tests/unit/telegram-assistant-writer.test.js`
  - `npm run build`
  - `vercel deploy --prod --yes --force --format json`
  - smoke POST live ke `https://banplex-telegram.vercel.app/api/telegram-assistant` untuk `/menu`, `/analytics`, callback metric/window/history
  - query SQL ke `public.telegram_assistant_sessions` untuk verifikasi `summary`, `transcript`, dan `last_route`

### [2026-04-23] `UCW-310` - Deploy production assistant upgrade dan smoke command runtime
- Status: `validated`
- Ringkasan:
  - Alias production `https://banplex-telegram.vercel.app` sekarang sudah mengarah ke deployment baru yang membawa command surface assistant dan payload session hybrid dari `UCW-309`.
  - Smoke live membuktikan `empty` tetap `processed:false`, sementara `/menu`, `/status tagihan unpaid`, `/analytics`, dan `/menu` penutup sudah `processed:true`; query Supabase terbaru juga menunjukkan `pending_payload` mulai memuat field `summary` dan transcript hybrid.
- File target:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Deploy production ini memakai current workspace yang juga mengandung perubahan lokal lain di luar task assistant; build dan smoke assistant lolos, tetapi area non-assistant yang ikut terdeploy tetap perlu dipantau terpisah.
  - Callback replay lewat webhook sintetis masih tidak bisa dijadikan bukti end-to-end penuh karena Telegram menolak `callback_query.id` palsu di `answerCallbackQuery`; validasi callback tetap disangga oleh unit test router dan command smoke yang sudah live.
- Audit hasil:
  - Smoke awal ke production sebelum redeploy menunjukkan runtime lama: `empty` dan `/status` masih sehat, tetapi `/analytics` slash command dan callback `ta:*` masih `processed:false`.
  - `vercel deploy --prod --yes --force --format json` berhasil membangun deployment produksi baru `https://banplex-telegram-g3xms2kha-dragontrail133-cpus-projects.vercel.app` dan alias tetap aktif di `https://banplex-telegram.vercel.app`.
  - Smoke ulang ke alias production sesudah redeploy mengembalikan `{"ok":true,"processed":false}` untuk body kosong, lalu `{"ok":true,"processed":true}` untuk `/menu`, `/status tagihan unpaid`, `/analytics`, dan `/menu` penutup.
  - Replay callback synthetic ke production sekarang memang masuk ke runtime baru, tetapi Telegram membalas `Bad Request: query is too old and response timeout expired or query ID is invalid`; ini sesuai batasan callback replay non-Telegram dan bukan regresi planner/callback router.
  - Query Supabase terbaru memperlihatkan row session paling baru berstatus `idle`, `pending_payload ? 'summary' = true`, `pending_payload ? 'context_summary' = true`, dan `jsonb_array_length(pending_payload->'transcript') = 2`, menandakan format hybrid baru sudah tersimpan di runtime production.
  - `vercel logs banplex-telegram.vercel.app --no-follow --since 15m` menunjukkan POST `200` untuk smoke command, plus log error `200` yang konsisten dengan replay callback synthetic ber-ID palsu.
- Validasi:
  - `vercel deploy --prod --yes --force --format json`
  - smoke POST live ke `https://banplex-telegram.vercel.app/api/telegram-assistant` untuk `empty`, `/menu`, `/status tagihan unpaid`, `/analytics`, callback synthetic `ta:*`, dan `/menu` penutup

### [2026-04-23] `UCW-311` - Hardening callback ack replay untuk smoke end-to-end
- Status: `validated`
- Ringkasan:
  - Runtime assistant sekarang tetap menuntaskan callback read-only walau replay webhook sintetis memakai `callback_query.id` yang invalid/expired; ack Telegram untuk kasus spesifik itu hanya dilog warning, bukan lagi menggagalkan seluruh request.
  - Smoke live ke alias production sekarang membuktikan alur `/analytics -> ta:am:cash_outflow -> ta:aw:month_current -> ta:cmd:riwayat` seluruhnya `processed:true`, dan row session terbaru tetap menyimpan summary/transcript hybrid plus `last_route` hasil navigasi.
- File target:
  - `api/telegram-assistant.js`
  - `tests/unit/telegram-assistant-routing.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Pelonggaran hanya berlaku untuk error ack Telegram yang eksplisit menyatakan query terlalu lama atau ID invalid; error Telegram lain tetap melempar exception agar kegagalan nyata tidak tertutup.
  - Deploy production masih membawa current workspace yang punya perubahan lokal lain di luar area assistant; smoke assistant sudah sehat, tetapi area non-assistant yang ikut terdeploy tetap perlu dipantau terpisah.
- Audit hasil:
  - `api/telegram-assistant.js` menambah guard `isIgnorableTelegramCallbackError(...)` dan memperbarui `answerTelegramCallback(...)` supaya hanya melewati error `query is too old` / `query ID is invalid` saat replay callback sintetis.
  - `tests/unit/telegram-assistant-routing.test.js` menambah uji untuk memastikan ack callback invalid/expired tidak menggagalkan handler, sementara routing command/callback dan hybrid transcript tetap terjaga.
  - `vercel deploy --prod --yes --force --format json` berhasil mempromosikan build terbaru ke alias `https://banplex-telegram.vercel.app`.
  - Smoke live ke `https://banplex-telegram.vercel.app/api/telegram-assistant` mengembalikan `{"ok":true,"processed":true}` untuk `/analytics`, callback `ta:am:cash_outflow`, callback `ta:aw:month_current`, dan callback `ta:cmd:riwayat`.
  - Query Supabase terbaru ke `public.telegram_assistant_sessions` menunjukkan row terkini berstatus `idle`, `pending_payload ? 'summary' = true`, `jsonb_array_length(pending_payload->'transcript') = 4`, `pending_payload->>'last_route' = '/transactions?tab=history'`, dan `pending_payload->'last_turn'->>'intent' = 'navigate'`.
- Validasi:
  - `node --check api/telegram-assistant.js`
  - `node --check tests/unit/telegram-assistant-routing.test.js`
  - `node --test tests/unit/telegram-assistant-routing.test.js`
  - `npm run lint`
  - `npm run build`
  - `vercel deploy --prod --yes --force --format json`
  - smoke POST live ke `https://banplex-telegram.vercel.app/api/telegram-assistant` untuk `/analytics`, `ta:am:cash_outflow`, `ta:aw:month_current`, dan `ta:cmd:riwayat`
  - query SQL ke `public.telegram_assistant_sessions` untuk verifikasi `summary`, `transcript`, `last_route`, dan `last_turn`
  - `select ... from public.telegram_assistant_sessions order by updated_at desc limit 1`
  - `vercel logs banplex-telegram.vercel.app --no-follow --since 15m`

### [2026-04-23] `UCW-301` - Siapkan bundle env lokal untuk migrasi Vercel Hobby
- Status: `validated`
- Ringkasan:
  - File lokal `.env.vercel-import-akhir-diedit.local` sekarang sudah dibuat dari `.env` aktif dan hanya berisi 14 key runtime yang sebelumnya dipersist ke Vercel untuk production/preview.
  - Format file tetap `.env` standar supaya bisa langsung dipindahkan ke folder lain, di-rename, lalu dipakai sebagai sumber import ke project Vercel akun baru tanpa copy-paste manual per key.
- File target:
  - `.env.vercel-import-akhir-diedit.local`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - File ini berisi secret hidup, jadi harus tetap diperlakukan sebagai local-only artifact; jangan di-commit, di-upload ke chat, atau disalin ke workspace yang tidak terkontrol.
  - Jika nilai di `.env` sumber berubah setelah file bundle dibuat, file ini bisa stale dan perlu digenerate ulang sebelum import ke akun Vercel target.
- Audit hasil:
  - `.gitignore` repo sudah meng-ignore pola `.env*.local`, sehingga file bundle baru tidak ikut muncul sebagai tracked file Git walau tetap tersedia di workspace lokal.
  - Bundle dibuat langsung dari `.env` aktif dengan whitelist 14 key runtime: `OWNER_TELEGRAM_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_ASSISTANT_GEMINI_API_KEY`, `TELEGRAM_ASSISTANT_GEMINI_MODEL`, `TELEGRAM_ASSISTANT_LLM_PROVIDER`, `TELEGRAM_ASSISTANT_WEBHOOK_SECRET`, `TELEGRAM_ASSISTANT_XAI_API_KEY`, `TELEGRAM_ASSISTANT_XAI_MODEL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, dan `VITE_TELEGRAM_BOT_USERNAME`.
  - Audit sesudah generate mengonfirmasi file berisi tepat 14 line/key, tanpa key tambahan di luar scope migrasi env yang sudah diaudit sebelumnya.
- Validasi:
  - `Get-ChildItem -Force -Name .env*`
  - `Get-Content .gitignore`
  - verifikasi presence 14 key dari `.env` aktif tanpa mencetak nilainya
  - verifikasi `.env.vercel-import-akhir-diedit.local` berisi `LINE_COUNT:14` dan nama key saja tanpa membuka secret
  - `git status --short -- docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`

### [2026-04-23] `UCW-300` - Redesign form non-absensi lintas domain agar mobile-first dan minimalis
- Status: `validated`
- Ringkasan:
  - Form non-absensi lintas domain sekarang mengikuti grammar yang lebih seragam: route form utama memakai section yang lebih ringkas, CTA footer sticky/shared, dan summary lebih compact tanpa mengubah logika data atau route canonical.
  - Editor sheet/dialog yang masih aktif (`HRD`, `Penerima Manfaat`, `Tambah Material`, `PaymentModal`) ikut dipindah ke footer shared milik overlay agar perilaku simpan/batal konsisten dengan shell form lain.
- File target:
  - `src/components/ExpenseForm.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `src/pages/PaymentPage.jsx`
  - `src/pages/MasterFormPage.jsx`
  - `src/components/master/GenericMasterForm.jsx`
  - `src/pages/ProjectPdfSettingsPage.jsx`
  - `src/components/MasterMaterialForm.jsx`
  - `src/components/PaymentModal.jsx`
  - `src/components/HrdPipeline.jsx`
  - `src/components/BeneficiaryList.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Footer aksi sekarang banyak bergantung pada `formId`; jika form baru ditambahkan tanpa `id` yang sinkron, tombol submit footer bisa terlihat tetapi tidak mengirim form.
  - `PaymentPage` dan form faktur/pengeluaran sekarang lebih compact; jika nanti domain butuh KPI tambahan di first fold, perubahan lanjutan perlu dijaga agar tidak menumpuk ulang ringkasan besar yang sebelumnya dipangkas.
- Audit hasil:
  - `ExpenseForm`, `MaterialInvoiceForm`, `PaymentPage`, dan `ProjectPdfSettingsPage` sekarang punya section hierarchy yang lebih jelas, CTA sticky/shared, dan summary yang lebih ringkas untuk mobile.
  - `MasterFormPage` dan `GenericMasterForm` disederhanakan ke identitas form yang lebih ringan dan icon tile solid; surface master tetap memakai form lama tanpa mengubah payload submit.
  - `MasterMaterialForm`, `PaymentModal`, `HrdPipeline`, dan `BeneficiaryList` sekarang memakai `AppDialog`/`AppSheet` footer shared sehingga tombol `Batal` dan `Simpan` tidak lagi diletakkan di body form.
- Validasi:
  - `npx eslint src/components/ExpenseForm.jsx src/components/MaterialInvoiceForm.jsx src/pages/PaymentPage.jsx src/pages/MasterFormPage.jsx src/components/master/GenericMasterForm.jsx src/pages/ProjectPdfSettingsPage.jsx src/components/MasterMaterialForm.jsx src/components/PaymentModal.jsx src/components/HrdPipeline.jsx src/components/BeneficiaryList.jsx`
  - `npm run lint`
  - `npm run build`

### [2026-04-23] `UCW-299` - Persist env Vercel preview via project API dan audit mismatch Git namespace
- Status: `validated`
- Ringkasan:
  - Shared env target `preview` sekarang sudah tersimpan untuk 14 key runtime assistant/client di level project Vercel, sehingga preview/staging redeploy terbaru lolos penuh tanpa inline env.
  - Flow `vercel git connect` masih gagal; audit API menunjukkan namespace GitHub yang terlihat oleh Vercel team hanya `ZooNiNe`, sehingga repo `dragontrail133-cpu/Banplex-Telegram` belum bisa di-link lewat integrasi Git native saat ini.
- File target:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Preview env parity sudah beres, tetapi Git integration tetap belum aktif; trigger deployment berbasis repo/branch dan branch-scoped env native masih bergantung pada perbaikan akses namespace atau instalasi Vercel GitHub App pada owner repo yang benar.
  - Webhook live tetap satu dan diarahkan ke alias production; preview deployment hanya tervalidasi sebagai smoke runtime, bukan bot environment live yang terpisah.
- Audit hasil:
  - `vercel git connect --yes` tetap gagal, lalu audit Vercel API `git-namespaces` dan `search-repo` mengonfirmasi team hanya melihat namespace GitHub `ZooNiNe` dan tidak menemukan repo `Banplex-Telegram` milik `dragontrail133-cpu`.
  - Shared env `preview` berhasil dipersist ke Project Env API Vercel untuk 14 key runtime yang sama dengan production, termasuk `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, dan `TELEGRAM_ASSISTANT_WEBHOOK_SECRET`; audit sesudah write menunjukkan `previewCount = 14`.
  - `vercel deploy --yes --force -m githubDeployment=1 -m githubCommitRef=staging -m githubOrg=dragontrail133-cpu -m githubRepo=Banplex-Telegram -m githubCommitOrg=dragontrail133-cpu -m githubCommitRepo=Banplex-Telegram --format json` berhasil membangun preview baru `banplex-greenfield-m48qye9mn-dzul-qornains-projects.vercel.app` tanpa inline env, lalu smoke POST ke `/api/telegram-assistant` mengembalikan `{"ok":true,"processed":false}`.
  - `Telegram getWebhookInfo` sesudah redeploy tetap menunjukkan webhook live sehat di `https://banplex-greenfield.vercel.app/api/telegram-assistant` dengan `pending_update_count = 0` dan tanpa `last_error_message`.
- Validasi:
  - `vercel git connect --yes`
  - direct Vercel API `GET /v1/integrations/git-namespaces`
  - direct Vercel API `GET /v1/integrations/search-repo?provider=github&repo=Banplex-Telegram`
  - direct Vercel API `POST /v10/projects/prj_xmPbCrrBqOPOD4N0XIKbcdmaNi4K/env?teamId=team_mlcAsBAk5ASfdkXGmmb17ybd`
  - direct Vercel API `GET /v10/projects/prj_xmPbCrrBqOPOD4N0XIKbcdmaNi4K/env?teamId=team_mlcAsBAk5ASfdkXGmmb17ybd`
  - `vercel deploy --yes --force -m githubDeployment=1 -m githubCommitRef=staging -m githubOrg=dragontrail133-cpu -m githubRepo=Banplex-Telegram -m githubCommitOrg=dragontrail133-cpu -m githubCommitRepo=Banplex-Telegram --format json`
  - `vercel curl /api/telegram-assistant --deployment banplex-greenfield-m48qye9mn-dzul-qornains-projects.vercel.app -- --request POST --header "content-type: application/json" --header "x-telegram-bot-api-secret-token: <secret>" --data "{}"` mengembalikan `{"ok":true,"processed":false}`
  - `Telegram getWebhookInfo`

### [2026-04-23] `UCW-298` - Persist env Vercel production dan audit blocker preview
- Status: `validated`
- Ringkasan:
  - Semua key runtime assistant yang berasal dari `.env` sekarang sudah tersimpan di Vercel `production`, lalu production redeploy terbaru lolos penuh tanpa `-e/-b` inline env.
  - Preview/staging belum bisa memakai env persisten Vercel karena branch-scoped preview env tertahan oleh project yang belum punya connected Git repository; staging tetap hidup, tetapi masih dideploy dengan inline env sebagai fallback sementara.
- File target:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Preview env Vercel masih kosong; kalau staging dideploy ulang tanpa inline env sebelum Git integration dibereskan, build/runtime bisa gagal karena assistant dan client build tidak mendapat key yang dibutuhkan.
  - Karena `preview` masih fallback, parity deploy antara production dan staging belum 100% setara meskipun endpoint assistant keduanya saat ini sama-sama hidup.
- Audit hasil:
  - `vercel env ls production --format=json` sekarang mengembalikan 14 key yang relevan untuk assistant/runtime produksi, termasuk `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ASSISTANT_WEBHOOK_SECRET`, dan model/provider LLM.
  - `vercel deploy --prod --yes --force --format json` berhasil membangun deployment production baru `banplex-greenfield-mhbr34gjq-dzul-qornains-projects.vercel.app` tanpa inline env, lalu alias tetap terpasang ke `banplex-greenfield.vercel.app`.
  - Attempt `vercel env add <key> preview staging ...` gagal dengan pesan bahwa project belum punya connected Git repository, sementara `vercel env ls preview --format=json` masih menunjukkan `envs: []`; karena itu staging direfresh lewat deploy fallback inline env ke `banplex-greenfield-mj5iqowit-dzul-qornains-projects.vercel.app`.
- Validasi:
  - `vercel env ls production --format=json`
  - `vercel env ls preview --format=json`
  - `vercel deploy --prod --yes --force --format json`
  - `vercel deploy --yes --force -m githubDeployment=1 -m githubCommitRef=staging ... --format json` dengan inline env fallback
  - `POST https://banplex-greenfield.vercel.app/api/telegram-assistant` dengan secret header mengembalikan `200` + `{"ok":true,"processed":false}`
  - `vercel curl /api/telegram-assistant --deployment banplex-greenfield-mj5iqowit-dzul-qornains-projects.vercel.app -- --request POST --header "content-type: application/json" --header "x-telegram-bot-api-secret-token: <secret>" --data "{}"` mengembalikan `{"ok":true,"processed":false}`
  - `Telegram getWebhookInfo` tetap menunjukkan `https://banplex-greenfield.vercel.app/api/telegram-assistant` dengan `pending_update_count = 0` dan tanpa `last_error_message`

### [2026-04-23] `UCW-297` - Deploy webhook Telegram assistant ke runtime Vercel
- Status: `validated`
- Ringkasan:
  - Deployment runtime assistant sekarang sudah hidup di dua target Vercel: production di `banplex-greenfield.vercel.app` dan preview di `banplex-greenfield-jutzwhbig-dzul-qornains-projects.vercel.app`.
  - Webhook Telegram live sudah aktif ke alias production `https://banplex-greenfield.vercel.app/api/telegram-assistant`, sedangkan preview/staging sudah tervalidasi endpoint-nya tetapi tidak dijadikan webhook aktif karena satu bot hanya bisa memegang satu webhook aktif dan preview masih berada di belakang Vercel Deployment Protection.
- File target:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - `banplex.app` dan `staging.banplex.app` belum valid di Vercel karena DNS belum mengarah ke `76.76.21.21`, jadi webhook production belum boleh dipindah ke custom domain itu.
  - Preview deployment saat ini masih protected oleh Vercel Authentication; Telegram tidak bisa memukul preview langsung tanpa bypass token atau perubahan policy protection, jadi staging live webhook perlu task infra lanjutan jika memang mau dipisah dari production.
- Audit hasil:
  - `vercel ls banplex-greenfield` menunjukkan dua deployment siap: `banplex-greenfield-ol3bty1x9-dzul-qornains-projects.vercel.app` untuk `production` dan `banplex-greenfield-jutzwhbig-dzul-qornains-projects.vercel.app` untuk `preview`.
  - `vercel inspect banplex-greenfield.vercel.app` mengonfirmasi alias production stabil ada di `banplex-greenfield.vercel.app`, sehingga itulah target webhook live yang dipakai sekarang.
  - `Telegram getWebhookInfo` sesudah `setWebhook` mengembalikan URL production alias, `pending_update_count = 0`, `last_error_message = null`, dan `allowed_updates = ["message","edited_message","callback_query"]`.
- Validasi:
  - `npm run lint`
  - `npm run build`
  - `POST https://banplex-greenfield.vercel.app/api/telegram-assistant` dengan secret header mengembalikan `200` + `{"ok":true,"processed":false}`
  - `vercel curl /api/telegram-assistant --deployment banplex-greenfield-jutzwhbig-dzul-qornains-projects.vercel.app -- --request POST --header "content-type: application/json" --header "x-telegram-bot-api-secret-token: <secret>" --data "{}"` mengembalikan `{"ok":true,"processed":false}`
  - `Telegram setWebhook` ke `https://banplex-greenfield.vercel.app/api/telegram-assistant`
  - `Telegram getWebhookInfo`

### [2026-04-23] `UCW-296` - Telegram finance assistant v1 read-only
- Status: `validated`
- Ringkasan:
  - Telegram assistant v1 sekarang selesai sebagai surface read-only untuk finance core, dengan intent `status`, `search`, dan `navigate` saja.
  - Implementasinya mencakup webhook dedicated, session singkat per chat untuk workspace choice dan klarifikasi, helper deep link resmi ke Mini Web App, serta smoke test navigasi dari `startapp`.
- File target:
  - `api/telegram-assistant.js`
  - `src/lib/telegram-assistant-links.js`
  - `src/App.jsx`
  - `tests/e2e/telegram-shell.spec.js`
  - `tests/e2e/helpers/telegram.js`
  - `supabase/migrations/20260423101000_create_telegram_assistant_sessions.sql`
  - `.env.example`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - LLM classifier bisa salah klasifikasi jika prompt atau env provider tidak valid; fallback deterministik dan guard read-only tetap harus menjadi lapisan utama.
  - Deep link assistant harus tetap dibatasi ke route resmi yang ada supaya tidak muncul asumsi navigasi liar.
- Audit hasil:
  - `api/telegram-assistant.js` sekarang melayani webhook dedicated, memvalidasi secret token, menyimpan session server-side, dan membangun response read-only untuk status/search/navigate dengan refusal eksplisit di luar scope.
  - `src/lib/telegram-assistant-links.js` dan `src/App.jsx` sudah menyepakati format `startapp` assistant dan redirect route resmi, sementara stub Telegram Playwright menjaga `start_param` tetap hidup selama smoke test.
  - `tests/e2e/telegram-shell.spec.js` lolos untuk bootstrap lifecycle dan deep-link navigation ke `/transactions?tab=tagihan`, jadi flow route yang dihasilkan benar-benar mendarat di UI resmi.
- Validasi:
  - `npm run lint`
  - `npm run build`
  - `npx playwright test tests/e2e/telegram-shell.spec.js --reporter=line`

### [2026-04-23] `UCW-292` - Standarkan feedback modal sheet HRD dan Penerima
- Status: `validated`
- Ringkasan:
  - Modal sheet create/edit di `HRD` dan `Penerima Manfaat` sekarang memakai blok feedback yang sama untuk error validasi dan error simpan, sehingga state gagal tidak lagi bercampur antara tone merah dan amber yang berbeda.
  - Surface `HRD` juga dibersihkan dari beberapa translucent class lama di card, file input, textarea, dan tombol agar modal editor terasa lebih solid di dark mode.
- File target:
  - `src/components/HrdPipeline.jsx`
  - `src/components/BeneficiaryList.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Feedback error yang disatukan menjadi satu primitive akan terasa lebih tegas; jika nanti dibutuhkan copy yang lebih spesifik per mode, itu perlu task lanjutan.
- Audit hasil:
  - `HrdPipeline` dan `BeneficiaryList` sekarang memakai `AppErrorState` untuk feedback modal, dan `BeneficiaryList` membersihkan error store lama saat modal edit dibuka.
  - Style modal HRD yang masih translucent pada beberapa surface internal sudah dirapikan ke background solid tanpa mengubah alur submit.
- Validasi:
  - `npm run lint`
  - `npm run build`

### [2026-04-23] `UCW-293` - Solidkan sisa surface form dan invite
- Status: `validated`
- Ringkasan:
  - Residual translucent surface pada `IncomeForm`, `MaterialInvoiceForm`, `LoanForm`, `TeamInviteManager`, dan `PayrollManager` sedang disolidkan agar pattern solid surface tetap konsisten.
  - Dekorasi CSS legacy yang sudah dead juga dibersihkan supaya tidak ada residu glass morphic yang tersisa di source.
- File target:
  - `src/components/IncomeForm.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `src/components/LoanForm.jsx`
  - `src/components/TeamInviteManager.jsx`
  - `src/components/PayrollManager.jsx`
  - `src/index.css`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Surface yang disolidkan dapat terasa lebih flat, tetapi tradeoff ini sengaja diambil untuk readability dark mode dan konsistensi visual.
- Audit hasil:
  - `IncomeForm`, `MaterialInvoiceForm`, `LoanForm`, `TeamInviteManager`, dan `PayrollManager` sudah tidak lagi memakai translucent background pada surface yang discope.
  - `src/index.css` sudah dibersihkan dari dekorasi shell glow dan `app-toast-surface` legacy, sehingga residu glass morphic yang memang dead sudah dihapus dari source.
- Validasi:
  - `npm run lint`
  - `npm run build`

### [2026-04-23] `UCW-294` - Solidkan residu dashboard dan form umum
- Status: `validated`
- Ringkasan:
  - Residual translucent surface di `Dashboard`, `ExpenseForm`, `ExpenseAttachmentSection`, `MasterMaterialForm`, dan `MasterPickerField` sedang disolidkan supaya cleanup glass morphic benar-benar menutup surface yang paling sering dipakai.
  - Fokus task ini hanya ke surface dan tombol/background yang masih translucent, bukan ke refactor layout atau behavior picker/form.
- File target:
  - `src/pages/Dashboard.jsx`
  - `src/components/ExpenseForm.jsx`
  - `src/components/ExpenseAttachmentSection.jsx`
  - `src/components/MasterMaterialForm.jsx`
  - `src/components/ui/MasterPickerField.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Surface solid bisa terasa lebih flat dan beberapa affordance highlight akan lebih rendah; tradeoff ini sengaja demi readability dark mode.
- Audit hasil:
  - `Dashboard`, `ExpenseForm`, `ExpenseAttachmentSection`, `MasterMaterialForm`, dan `MasterPickerField` sudah tidak lagi memakai translucent background pada surface yang discope.
  - `src/pages/Dashboard.jsx` button error state, `src/components/ExpenseForm.jsx`, `src/components/ExpenseAttachmentSection.jsx`, `src/components/MasterMaterialForm.jsx`, dan `src/components/ui/MasterPickerField.jsx` kini konsisten memakai background solid.
- Validasi:
  - `npm run lint`
  - `npm run build`

### [2026-04-23] `UCW-295` - Hapus selector opacity legacy CSS
- Status: `validated`
- Ringkasan:
  - selector compat opacity di `src/index.css` yang sudah tidak dipakai aktif sekarang dihapus supaya stylesheet tidak menyimpan residu glass morphic dead-code.
  - surface akses ditolak pada `ProtectedRoute` yang masih translucent ikut disolidkan agar cleanup tidak meninggalkan satu card opacity yang terlihat pengguna.
- File target:
  - `src/index.css`
  - `src/components/ProtectedRoute.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - penghapusan compat selector bisa membuat surface legacy yang belum tervalidasi tampil apa adanya; karena itu residual surface yang masih nyata ikut dibetulkan di `ProtectedRoute`.
- Audit hasil:
  - selector opacity legacy di `src/index.css` sudah dibersihkan, termasuk mapping compat untuk `bg-white`, `bg-slate-*`, `bg-emerald-*`, `bg-rose-*`, `bg-amber-*`, `bg-sky-*`, `bg-cyan-*`, serta override blur yang sudah tidak dipakai.
  - `ProtectedRoute` sekarang memakai surface solid `bg-rose-50`, sehingga tidak ada card translucent tersisa dari cleanup ini.
- Validasi:
  - `npm run lint`
  - `npm run build`

### [2026-04-23] `UCW-290` - Tandai entry frozen di MorePage
- Status: `validated`
- Ringkasan:
  - Kartu `HRD & Rekrutmen` dan `Penerima Manfaat` di `MorePage` sekarang menampilkan status ringkas `Dikembangkan` agar user tahu modul masih frozen sebelum masuk route placeholder.
  - Kartu lain di `MorePage` tidak berubah dan tetap tampil normal.
- File target:
  - `src/pages/MorePage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Status chip menambah satu elemen kecil di kartu frozen, tetapi scope tetap sempit dan tidak memengaruhi entrypoint lain.
- Audit hasil:
  - `MorePage` kini menandai dua kartu frozen dengan badge status warning `Dikembangkan`, sedangkan `Tim`, `Stok Barang`, dan `Unit Kerja` tetap tanpa penanda tambahan.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-23] `UCW-291` - Standarkan loading, empty, dan error surface operasional
- Status: `validated`
- Ringkasan:
  - Surface operasional `HRD`, `Penerima Manfaat`, `PayrollManager`, dan `Stok Barang` sekarang memakai primitive fallback yang sama untuk loading, empty, dan error state.
  - Loading state diganti ke `AppEmptyState` dengan loader centered, sementara error state dipusatkan ke `AppErrorState` agar fallback lebih jelas dan konsisten.
- File target:
  - `src/components/HrdPipeline.jsx`
  - `src/components/BeneficiaryList.jsx`
  - `src/components/PayrollManager.jsx`
  - `src/pages/StockPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Beberapa empty state kini memakai surface yang lebih menonjol; jika nanti perlu lebih ringkas, bisa dipoles lagi tanpa mengubah contract data.
- Audit hasil:
  - `HrdPipeline`, `BeneficiaryList`, `PayrollManager`, dan `StockPage` sudah konsisten memakai `AppEmptyState` / `AppErrorState` untuk loading, empty, dan error utama.
  - Error manual stock-out dan loading opsi Unit Kerja di sheet stok juga ikut dipusatkan ke primitive yang sama.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
- Split dependencies: `UCW-249` bergantung pada `src/pages/TransactionDetailPage.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/PaymentPage.jsx`, `src/App.jsx`, `src/components/layouts/FormLayout.jsx`, dan `src/components/ui/AppPrimitives.jsx`; `UCW-250` bergantung pada `src/pages/PaymentPage.jsx`, `src/pages/TransactionDetailPage.jsx`, `src/pages/EditRecordPage.jsx`, `src/components/layouts/FormLayout.jsx`, `src/components/ui/AppPrimitives.jsx`, dan `src/App.jsx`; `UCW-251` bergantung pada `src/pages/TransactionDetailPage.jsx`, `src/pages/EditRecordPage.jsx`, `src/pages/PaymentPage.jsx`, `src/components/layouts/FormLayout.jsx`, dan `src/components/ui/AppPrimitives.jsx`; `UCW-252` bergantung pada `src/pages/TransactionDetailPage.jsx`, `src/components/ui/AppPrimitives.jsx`, dan `src/App.jsx`; `UCW-253` bergantung pada `src/pages/Dashboard.jsx`, `src/pages/BillsPage.jsx`, `src/App.jsx`, dan `src/components/ui/AppPrimitives.jsx`; `UCW-254` bergantung pada `src/pages/BillsPage.jsx`, `src/pages/PaymentsPage.jsx`, `src/lib/transaction-presentation.js`, dan `src/components/ui/AppPrimitives.jsx`; `UCW-255` bergantung pada `src/pages/BillsPage.jsx` dan `src/lib/transaction-presentation.js`; `UCW-256` bergantung pada `src/pages/TransactionsPage.jsx`, `src/pages/BillsPage.jsx`, `src/pages/HistoryPage.jsx`, dan `src/components/ui/AppPrimitives.jsx`; `UCW-257` bergantung pada `src/pages/TransactionsPage.jsx`, `src/pages/BillsPage.jsx`, `src/pages/HistoryPage.jsx`, dan `src/components/ui/AppPrimitives.jsx`; `UCW-258` bergantung pada `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/App.jsx`, dan `src/components/ui/AppPrimitives.jsx`; `UCW-259` bergantung pada `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, `src/App.jsx`, dan `src/components/ui/AppPrimitives.jsx`; `UCW-260` bergantung pada `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, `src/components/ui/AppPrimitives.jsx`, dan `src/App.jsx`; `UCW-261` bergantung pada `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/pages/MasterRecycleBinPage.jsx`, `src/components/ui/AppPrimitives.jsx`, dan `src/App.jsx`.

### [2026-04-22] `UCW-261` - Koreksi shell mobile Jurnal, Riwayat, dan Arsip
- Status: `planned`
- Ringkasan:
  - Task ini mengunci trio mobile yang benar sebagai `Jurnal`, `Riwayat`, dan `Arsip`, dengan `Tagihan` di luar scope entrypoint ini.
  - Tujuannya menormalkan shell mobile tanpa menambah layout/header baru di dalam tab `Riwayat`.
  - File target:
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `src/pages/MasterRecycleBinPage.jsx`
  - `src/components/ui/AppPrimitives.jsx`
  - `src/App.jsx`

### [2026-04-22] `UCW-287` - Normalkan loader detail yang tersisa
- Status: `validated`
- Ringkasan:
  - Surface detail yang masih memakai card placeholder untuk loading satu record harus dipindahkan ke loader centered agar konsisten dengan policy loader baru.
  - Target utamanya adalah detail transaksi terhapus, detail pekerja payroll, dan worker detail mode di pembayaran tagihan; list surface dan skeleton list tetap dipertahankan.
- File target:
  - `src/pages/DeletedTransactionDetailPage.jsx`
  - `src/pages/PayrollWorkerDetailPage.jsx`
  - `src/pages/PaymentsPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Jika loader centered diterapkan pada detail surface tanpa menjaga fallback error state, user bisa kehilangan konteks saat data gagal ditemukan.
- Audit hasil:
  - loading satu record di detail transaksi terhapus sekarang memakai `BrandLoader` centered dengan copy singkat, bukan card placeholder.
  - loading detail pekerja payroll sekarang tampil full-page centered sebelum tab/section lain dirender.
  - worker detail mode di pembayaran tagihan juga memakai centered loader saat data worker/bill belum siap, sementara skeleton list pada surface list tetap tidak diubah.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
- Risiko:
  - Jika shell mobile dipadatkan tanpa menjaga fallback legacy dan state per tab, deep link atau restore state bisa terpengaruh.

### [2026-04-22] `UCW-288` - Shared form shell + centered modal toast
- Status: `validated`
- Ringkasan:
  - Global toast sekarang tampil sebagai modal tengah solid dengan animasi/icon di atas, title, subtitle/message, dan tombol `Tutup` full-width di bagian bawah.
  - Form lintas domain memakai return route eksplisit dan registry shell, sehingga back action tidak lagi bergantung pada `navigate(-1)` dan record yang gagal resolve menampilkan error eksplisit.
- File target:
  - `src/components/ui/GlobalToast.jsx`
  - `src/store/useToastStore.js`
  - `src/lib/form-shell.js`
  - `src/pages/AttendancePage.jsx`
  - `src/pages/MaterialInvoicePage.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `src/pages/PaymentPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/components/MasterDataManager.jsx`
  - `src/components/PayrollAttendanceHistory.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Toast persisten untuk warning/error/loading bisa terasa lebih agresif jika pengguna tidak menutupnya, tetapi itu sesuai contract baru yang diminta.
- Audit hasil:
  - `GlobalToast` kini center aligned, solid, dan memakai tombol tutup full-width di bagian bawah; success/info auto-dismiss sedangkan warning/error/loading tetap bertahan sampai ditutup.
  - `AttendancePage`, `MaterialInvoicePage`, dan `EditRecordPage` memakai return route eksplisit dari registry/helper; `EditRecordPage` juga menampilkan error state jika record tidak ditemukan.
  - `PaymentPage` kini langsung kembali ke return route saat `returnToOnSuccess` aktif, tanpa menunggu reload record yang tidak lagi diperlukan pada flow kembali.
  - edit flow dari `TransactionDetailPage`, `MasterDataManager`, dan `PayrollAttendanceHistory` sudah mengirim `returnTo` yang eksplisit agar tidak bergantung pada history stack.
- Validasi:
  - `npm run lint`
  - `npm run build`

### [2026-04-22] `UCW-270` - Kunci kontrak target bayar worker aggregate
- Status: `validated`
- Ringkasan:
  - `Bayar` untuk salary bill harus memilih satu bill aggregate outstanding per worker dengan rule deterministik `partial -> unpaid -> due_date -> created_at -> id`.
  - Summary KPI worker dipusatkan di helper data bersama supaya nominal total, billed, unbilled, sisa, dan terbayar punya source of truth yang sama di surface detail.
- File target:
  - `src/lib/transaction-presentation.js`
  - `src/pages/PaymentsPage.jsx`
  - `src/pages/PaymentPage.jsx`
- Risiko:
  - Jika rule pemilihan target belum stabil, CTA `Bayar` bisa salah mengarah ke bill outstanding yang tidak tepat.
- Audit hasil:
  - helper shared sekarang menghitung target bill aggregate payroll secara deterministik dan mengembalikan metadata target yang siap dipakai CTA `Bayar` pada task berikutnya.
  - summary tab detail worker di `PaymentsPage` sekarang membaca KPI `total beban`, `billed`, `unbilled`, `sisa`, `terbayar`, dan `jumlah rekap` dari helper yang sama, dengan fallback `unbilled = 0` di surface payment saat data attendance belum ikut dibawa.
  - backend payroll bill mapping sekarang mengekspor `workerName` dan `worker_name_snapshot` supaya worker aggregate bisa ditemukan tanpa bergantung ke fallback `supplierName`.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-271` - Tambahkan CTA Bayar pada sheet worker absensi
- Status: `validated`
- Ringkasan:
  - `Tab Pekerja` di `Catatan Absensi` harus punya CTA `Bayar` sejajar dengan `Detail` dan `Rekap` di sheet worker.
  - CTA ini membuka payment form untuk bill aggregate worker yang dipilih oleh helper kontrak data, lalu kembali ke tab pekerja setelah selesai.
- File target:
  - `src/components/PayrollAttendanceHistory.jsx`
  - `src/pages/PayrollPage.jsx`
  - `src/pages/PaymentPage.jsx`
- Risiko:
  - Jika sheet worker tidak membawa konteks worker aggregate yang lengkap, target payment dan return path bisa terasa patah.
- Audit hasil:
  - sheet aksi worker di `Catatan Absensi` sekarang menampilkan `Bayar` hanya saat helper menemukan bill payroll outstanding yang cocok untuk worker tersebut.
  - `PaymentPage` menerima `returnToOnSuccess` dari flow attendance, menyimpan return path ke `/payroll?tab=worker`, dan kembali otomatis ke tab pekerja setelah submit sukses.
  - smoke test baru di `tests/e2e/payroll.spec.js` mengunci alur `Tab Pekerja -> Bayar -> PaymentPage -> kembali ke /payroll?tab=worker`.
  - gate rekap sekarang mengabaikan row yang sudah punya `salary_bill_id`, jadi row legacy yang masih `unbilled` tetapi sudah terhubung ke salary bill tidak lagi tampil sebagai rekapable.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-273` - Restyle GlobalToast jadi solid surface dan pindah ke atas
- Status: `validated`
- Ringkasan:
  - `GlobalToast` sekarang memakai surface solid yang netral: putih solid saat mode terang dan padanan solid gelap saat mode gelap.
  - Toast diposisikan di bagian atas layar agar tidak bertabrakan dengan tombol navigasi bawah di mobile.
- File target:
  - `src/components/ui/GlobalToast.jsx`
- `src/index.css`
- Risiko:
  - Karena toast pindah ke atas, ia bisa menumpuk dengan header jika muncul di saat layar sangat pendek; namun posisi safe-area sudah dipakai untuk mengurangi benturan.
- Audit hasil:
  - card toast sekarang memakai surface solid netral tanpa skema warna translucent yang dominan.
  - posisi render di top safe-area membuat toast tidak menghalangi bottom nav mobile.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-274` - Netalkan ikon tone pada GlobalToast
- Status: `validated`
- Ringkasan:
  - Ikon pada `GlobalToast` kini memakai warna netral yang konsisten, sehingga tone toast dibaca lewat konteks pesan dan bukan lewat warna ikon yang mencolok.
  - Perubahan ini menjaga toast tetap solid, minim distraksi, dan lebih selaras dengan permintaan desain mobile.
- File target:
  - `src/components/ui/GlobalToast.jsx`
- Risiko:
  - Karena ikon seragam, perbedaan status hanya dibaca dari judul/pesan; itu masih cukup karena toast tidak dipakai sebagai indikator utama status permanen.
- Audit hasil:
  - semua tone toast sekarang menggunakan ikon berwarna netral yang sama, tanpa skema warna mencolok per status.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-272` - Bersihkan salary bill entrypoint dari Jurnal, Riwayat, dan Arsip
- Status: `validated`
- Ringkasan:
  - Surface `Jurnal`, `Riwayat`, dan `Arsip` harus berhenti menampilkan filter atau CTA salary bill sebagai entrypoint utama.
  - Tujuannya menegaskan `Catatan Absensi` sebagai primary entrypoint salary bill agar navigasi finansial tidak bercampur dengan surface transaksi umum.
- File target:
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `src/pages/MasterRecycleBinPage.jsx`
- Risiko:
  - Jika cleanup dilakukan sebelum entrypoint attendance siap, user bisa kehilangan jalur alternatif untuk menemukan salary bill.
- Audit hasil:
  - filter `Gaji/Upah` sekarang tidak lagi muncul di `Jurnal` dan `Riwayat`, dan state session lama di `Jurnal` yang masih menyimpan filter `bill` dinormalisasi kembali ke `all`.
  - row payroll bill di `Jurnal` tidak lagi menawarkan aksi `Bayar`; `Arsip` tidak perlu patch tambahan karena memang tidak memiliki filter payroll khusus.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-262` - Selaraskan shell Jurnal dengan tab Tagihan
- Status: `validated`
- Ringkasan:
  - `Jurnal` menjadi shell utama dengan tab `Aktif`, `Tagihan`, dan `Riwayat` di halaman yang sama.
  - Tab `Tagihan` dirender embedded supaya user tidak merasa pindah ke workspace lain, sementara route legacy tetap jadi fallback kompatibilitas.
  - Header shell tetap hemat ruang; `Tagihan` hanya memakai target aksi jika diperlukan, tanpa mengubah model data atau logika pembayaran.
- File target:
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/BillsPage.jsx`
  - `src/App.jsx`
  - `src/components/ui/AppPrimitives.jsx`
- Risiko:
  - Jika embedded shell tidak menjaga fallback legacy dan state header target, deep link atau restore state bisa terdampak.

### [2026-04-22] `UCW-263` - Ratakan shell embedded Tagihan di Jurnal
- Status: `validated`
- Ringkasan:
  - `Tagihan` yang dirender embedded di shell `Jurnal` harus memakai wrapper ringan tanpa header/section tambahan yang membuatnya terasa seperti page kedua.
  - Tujuannya menjaga transisi tab tetap terasa satu workspace yang sama di mobile.
- File target:
  - `src/pages/BillsPage.jsx`
  - `src/pages/TransactionsPage.jsx`
- Risiko:
  - Jika wrapper embedded terlalu agresif diubah, spacing dan restore state pada list tagihan bisa terdampak.

### [2026-04-22] `UCW-264` - Petakan search/filter per tab Jurnal
- Status: `validated`
- Ringkasan:
  - Header shell `Jurnal` dipetakan sebagai entrypoint tunggal untuk search/filter per tab, supaya `Aktif`, `Tagihan`, dan `Riwayat` konsisten secara visual.
  - Task ini hanya menata entrypoint dan target aksi, bukan mengubah query/data model atau route baru.
- File target:
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/pages/BillsPage.jsx`
- Risiko:
  - Jika pemetaan header tidak selaras dengan embedded child, slot aksi bisa terasa kosong atau dobel di mobile.

### [2026-04-22] `UCW-265` - Konsolidasikan surface Arsip ke shell Jurnal
- Status: `validated`
- Ringkasan:
  - Surface `Arsip` perlu navigasi balik yang deterministik ke shell `Jurnal`, bukan bergantung pada history browser.
  - Tujuannya menjaga `Arsip` tetap terasa sebagai recovery surface yang jelas di trio mobile `Jurnal / Riwayat / Arsip`.
- File target:
  - `src/pages/TransactionsRecycleBinPage.jsx`
- Risiko:
  - Jika navigasi balik dibuat terlalu keras, open-in-new-context atau deep link bisa terasa kurang natural.

### [2026-04-22] `UCW-266` - Alihkan route Tagihan ke shell Jurnal
- Status: `validated`
- Ringkasan:
  - Route `/tagihan` dialihkan ke tab `Tagihan` di shell `Jurnal`, supaya entrypoint list aktif terpusat dan tidak terasa sebagai page terpisah.
  - Route settlement `Tagihan` tetap ada untuk deep link pembayaran, jadi hanya surface list aktif yang dipusatkan ulang.
- File target:
  - `src/App.jsx`
- Risiko:
  - Jika redirect `/tagihan` tidak sinkron dengan shell `Jurnal`, bookmark lama bisa tetap terasa seperti surface terpisah.

### [2026-04-22] `UCW-268` - Pindahkan aggregate worker ke detail page bertab
- Status: `validated`
- Ringkasan:
  - Row worker di `Tagihan` harus menjadi entrypoint detail, bukan accordion inline yang menumpuk konten di bawah row.
  - Detail worker dipusatkan ke page bertab `Summary / Rekap / History Payment`, dan tab `Rekap` menampilkan row per bill yang bisa dibuka detailnya tanpa memilih rekap dari list utama.
- File target:
  - `src/pages/BillsPage.jsx`
  - `src/pages/PaymentsPage.jsx`
- Risiko:
  - Jika row worker dipindah tanpa menjaga return path dan state hydration detail, back navigation atau prefetch detail bisa terasa patah.
- Audit hasil:
  - row worker di tagihan sekarang hanya entrypoint summary ke detail page, tanpa accordion inline di bawah row.
  - detail worker tampil sebagai page bertab dengan `Summary / Rekap / History Payment`, dan tab `Rekap` memakai row per bill dengan detail accordion di dalamnya.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-269` - Pangkas Edit dan Payment jadi action surface murni
- Status: `validated`
- Ringkasan:
  - `EditRecordPage` dan `PaymentPage` sudah dipangkas agar hanya menyisakan aksi inti; semua ringkasan, histori, lampiran, dan teknis dipusatkan di `TransactionDetailPage`.
  - Tujuannya menjaga UX tetap fokus: `Edit` untuk ubah data, `Payment` untuk bayar, `Detail` untuk inspeksi.
- File target:
  - `src/pages/EditRecordPage.jsx`
  - `src/pages/PaymentPage.jsx`
- Risiko:
  - Jika pemangkasan terlalu agresif pada pengembangan berikutnya, user bisa kehilangan konteks minimum saat melakukan edit atau pembayaran; ringkasan inti harus tetap ada di `Detail`.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-267` - Satukan jalur settlement Tagihan ke route payment canonical
- Status: `validated`
- Ringkasan:
  - Seluruh entrypoint settlement Tagihan sekarang mengarah ke route canonical `/payment/:id` agar tidak ada percabangan antara `/tagihan/:id` dan `/pembayaran/tagihan/:id`.
  - Route legacy settlement tetap hidup sebagai redirect fallback, tetapi caller aktif sudah dipindah ke jalur canonical yang sama.
- File target:
  - `src/App.jsx`
  - `src/components/PayrollManager.jsx`
  - `src/components/ProjectReport.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `src/pages/BillsPage.jsx`
  - `src/lib/transaction-presentation.js`
- Risiko:
  - Jika redirect legacy dihapus tanpa masa transisi, bookmark settlement lama bisa putus.

### [2026-04-22] `UCW-260` - Selaraskan tiga workspace mobile Jurnal, Riwayat, dan Arsip
- Status: `validated`
- Ringkasan:
  - Trio workspace mobile yang dimaksud adalah `Jurnal`, `Riwayat`, dan `Arsip`, bukan memasukkan `Tagihan` ke alur entrypoint ini.
  - Bottom sheet filter sudah dipindah ke list vertikal yang ringan ditap, `Arsip` memakai search/filter di header, dan `Riwayat` menampilkan search/filter di header Jurnal saat tab itu aktif tanpa header kedua.
- File target:
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `src/pages/MasterRecycleBinPage.jsx`
  - `src/components/ui/AppPrimitives.jsx`
  - `src/App.jsx`
- Risiko:
  - Kalau pemetaan `Jurnal / Riwayat / Arsip` dipindah tanpa menjaga fallback lama, deep link dan layout legacy bisa terdampak.
- Audit hasil:
  - bottom sheet filter pada workspace utama kini berbentuk list vertikal, sehingga tap target lebih jelas di mobile.
  - `HistoryWorkspace` embedded tidak lagi memunculkan header kedua; toolbar ringkas sekarang langsung berada di surface tab.
  - `TransactionsRecycleBinPage` menampilkan entrypoint search/filter di header, jadi surface Arsip konsisten dengan workspace utama.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-259` - Ubah entrypoint Sampah menjadi Arsip
- Status: `validated`
- Ringkasan:
  - Entry-point recovery memakai label `Arsip` agar lebih netral dan lebih cocok dengan UX mobile.
  - Entry point arsip dipadatkan sebagai list di bawah tab dan tetap berada di area teratas surface recovery.
- File target:
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `src/pages/MasterRecycleBinPage.jsx`
  - `src/App.jsx`
  - `src/components/ui/AppPrimitives.jsx`
- Risiko:
  - Mengubah label user-facing tanpa menjaga route existing bisa membuat navigasi recovery terasa berubah walau datanya sama.
- Audit hasil:
  - label recovery user-facing sekarang memakai `Arsip` di surface recovery yang terlihat pengguna.
  - entrypoint recovery dipadatkan ke kontrol tab/toggle di atas list sehingga ruang mobile lebih hemat.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-258` - Gabungkan Riwayat ke page Jurnal sebagai tab
- Status: `validated`
- Ringkasan:
  - `Riwayat` akan dipindah dari page terpisah menjadi tab di page `Jurnal`.
  - Jurnal akan memiliki dua tab: `Aktif` dan `Riwayat`, dan icon entrypoint riwayat di header dihapus.
- File target:
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/App.jsx`
  - `src/components/ui/AppPrimitives.jsx`
- Risiko:
  - Jika route lama langsung dihapus tanpa fallback, deep link dan bookmark riwayat lama bisa putus.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-257` - Pindahkan filter workspace ke bottom sheet
- Status: `validated`
- Ringkasan:
  - Filter workspace di `Jurnal`, `Tagihan`, dan `Riwayat` dipindah ke bottom sheet yang dibuka dari tombol filter di header.
  - Search tetap ringkas supaya header mobile lebih hemat ruang.
- File target:
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/BillsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/components/ui/AppPrimitives.jsx`
- Risiko:
  - Jika bottom sheet tidak mempertahankan state filter aktif, user bisa kehilangan konteks pencarian/filter yang sedang dipakai.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-256` - Ringkas search dan tab filter di tiga workspace utama
- Status: `validated`
- Ringkasan:
  - Search di `Jurnal` dan `Riwayat` kini dibuka lewat ikon, lalu input muncul hanya saat dibutuhkan supaya fold atas lebih hemat ruang.
  - Filter chip di `Jurnal` dan `Riwayat` dipadatkan ke satu baris horizontal, sementara toggle terkait di `Tagihan` ikut dibuat lebih rapat tanpa mengubah fungsinya.
- File target:
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/BillsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/components/ui/AppPrimitives.jsx`
- Risiko:
  - Jika entrypoint filter diperkecil tanpa menjaga akses ke fungsi yang sama, user bisa kehilangan kemampuan pencarian/filtering yang sudah dipakai.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-255` - Selaraskan jalur pembukaan payment dari Tagihan dengan Jurnal
- Status: `validated`
- Ringkasan:
  - Tagihan sekarang membuka payment workspace lewat route canonical yang sama seperti Jurnal, sehingga load path dan hydration konsisten lintas surface.
  - State hydration dan return navigation mengikuti pola Jurnal dengan `transaction` + `returnTo`.
- File target:
  - `src/pages/BillsPage.jsx`
  - `src/lib/transaction-presentation.js`
- Risiko:
  - Kalau state shape Tagihan tidak disamakan dengan Jurnal, back-nav atau hydration bisa beda walau path sudah sama.
- Audit hasil:
  - `getTransactionPaymentRoute` sekarang menerima row bill langsung dari `Tagihan`, bukan hanya transaksi yang sudah membawa `sourceType = bill`.
  - `BillsPage` sekarang membuka payment lewat helper route yang sama dengan `Jurnal` dan hanya mengirim state `transaction + returnTo`, jadi path maupun hydration tidak lagi beda antar surface.
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`

### [2026-04-22] `UCW-253` - Tambahkan jalur akses tagihan dari card KPI dashboard
- Status: `validated`
- Ringkasan:
  - card KPI `Tagihan Pending` di `Dashboard` sekarang menjadi jalur akses yang jelas ke halaman `Tagihan` yang sudah ada, sehingga overview punya entrypoint langsung ke surface tagihan.
  - akses ini dibuat sederhana dan mobile-safe lewat card yang bisa diklik, tanpa mengubah grouping bill atau semantics settlement.
- File target:
  - `src/pages/Dashboard.jsx`
  - `src/pages/BillsPage.jsx`
  - `src/App.jsx`
  - `src/components/ui/AppPrimitives.jsx`
- Dependency:
  - `UCW-245`
  - `UCW-252`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser compare KPI card vs tagihan page
- Catatan:
  - task ini hanya menambahkan jalur akses, bukan mengubah logika grouping tagihan.

### [2026-04-22] `UCW-254` - Konsolidasikan detail agregat payroll worker di tab `Summary / Rekap / History Payment`
- Status: `validated`
- Ringkasan:
  - detail payroll worker dikonsolidasikan ke tab kondisional `Summary / Rekap / History Payment` di surface tagihan dan pembayaran.
  - `Summary` menampilkan nama worker, total tagihan, sisa tagihan, dan jumlah rekap; `Rekap` menampilkan list rekap yang bisa diekspand; `History Payment` hanya muncul bila ada history aktif.
  - aksi di tab tetap icon-only dan child record soft-delete harus tetap terbedakan dari record aktif tanpa mengubah semantics settlement.
- File target:
  - `src/pages/BillsPage.jsx`
  - `src/pages/PaymentsPage.jsx`
  - `src/lib/transaction-presentation.js`
  - `src/components/ui/AppPrimitives.jsx`
- Dependency:
  - `UCW-245`
  - `UCW-252`
  - `UCW-253`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
- Catatan:
  - task ini fokus pada agregasi detail worker, bukan perubahan grouping payroll atau route baru.

### [2026-04-22] `UCW-242` - Standarkan entrypoint `PaymentPage` ke route standalone fullscreen
- Status: `audit_required`
- Ringkasan:
  - entrypoint pembayaran dari row Jurnal/detail dan halaman Pembayaran sudah dipindah ke route standalone `/payment/:id` / `/loan-payment/:id`, sehingga caller aktif tidak lagi mengarahkan flow utama ke route MainLayout `/pembayaran/*`.
  - compat deep link legacy `/pembayaran/tagihan/:id` dan `/pembayaran/pinjaman/:id` tetap dipertahankan di `src/App.jsx`, jadi bookmark lama masih hidup tanpa mengubah auth atau backend.
  - lint dan build lulus, tetapi smoke browser terjadwal untuk membandingkan fullscreen parity belum selesai stabil di environment ini, jadi task tetap `audit_required` sampai browser parity terverifikasi.
- File target:
  - `src/lib/transaction-presentation.js`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/PaymentsPage.jsx`
  - `src/pages/PaymentPage.jsx`
- Dependency:
  - `UCW-214`
  - `UCW-222`
  - `UCW-226`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser smoke: buka payment dari row Jurnal lalu bandingkan dengan route standalone `/payment/:id`
- Catatan:
  - kompatibilitas `/pembayaran/*` masih ada di route table untuk deep link lama, tetapi caller aktif sudah dipindah ke route standalone fullscreen.
  - smoke Playwright ad hoc belum berhasil mencapai list/route target secara stabil di environment ini, jadi browser parity masih perlu audit lanjutan sebelum task bisa ditutup `validated`.

### [2026-04-22] `UCW-243` - Pusatkan recap salary bill hanya di tab `Pekerja`
- Status: `validated`
- Ringkasan:
  - recap salary bill sekarang tampil sebagai action di tab `Harian` dan `Pekerja`, tetapi konteks business rule yang paling stabil memang per worker.
  - tab `Harian` tetap relevan untuk inspeksi absensi harian, tetapi action recap di sana berisiko memunculkan konteks unbilled yang terlihat ada di data mentah namun tidak siap direkap dari sudut operator.
  - follow-up paling aman adalah menghapus action `Rekap` dari tab `Harian`, lalu mempertahankan seluruh alur create salary bill hanya di tab `Pekerja`.
- File target:
  - `src/components/PayrollAttendanceHistory.jsx`
  - `src/pages/PayrollPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Dependency:
  - `UCW-94`
  - `UCW-242`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser smoke: recap dari tab `Pekerja`, verifikasi tab `Harian` tidak lagi menampilkan aksi recap
- Catatan:
  - keputusan ini menjaga satu jalur rekap yang konsisten untuk operator, tanpa memindahkan source of truth data billing.

### [2026-04-22] `UCW-244` - Tambahkan context line minimal di row list workspace inti
- Status: `validated`
- Ringkasan:
  - row `Jurnal`, `Riwayat`, dan `Halaman Sampah` dapat ditambah satu baris konteks minimal di bawah tanggal untuk worker/supplier/kreditur/project sesuai jenis transaksi.
  - task ini dipisah dari payroll recap karena fokusnya murni presentasi row list dan tidak boleh menambah fetch per item.
  - helper yang sudah punya snapshot field final menjadi sumber data utama, jadi targetnya adalah clarity UI, bukan perubahan source of truth.
- File target:
  - `src/lib/transaction-presentation.js`
  - `src/components/ui/ActionCard.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
- Dependency:
  - `UCW-176`
  - `UCW-242`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser compare row density vs baseline
- Catatan:
  - task ini harus tetap cache-friendly; jangan tambah fetch relasi baru hanya untuk teks konteks.

### [2026-04-22] `UCW-245` - Kelompokkan salary bill per worker di daftar tagihan
- Status: `validated`
- Ringkasan:
  - tagihan gaji yang berasal dari rekap terpisah perlu tampil sebagai satu grup per worker agar operator bisa bayar per worker tanpa kehilangan histori bill per periode.
  - grouping ini harus terjadi di UI list, bukan di database, supaya audit trail bill tetap utuh dan fetch tambahan tidak membengkakkan first paint.
  - detail bill per periode tetap perlu bisa dibuka dari grup worker, sehingga operator tetap punya akses ke granularity rekap saat diperlukan.
- File target:
  - `src/pages/BillsPage.jsx`
  - `src/pages/PaymentsPage.jsx`
  - `src/lib/transaction-presentation.js`
  - `src/lib/records-api.js`
- Dependency:
  - `UCW-94`
  - `UCW-243`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser smoke group worker bill list
- Catatan:
  - grouping worker di list tagihan tetap harus mempertahankan urutan, status, dan akses bayar per bill individual.

### [2026-04-22] `UCW-246` - Pisahkan filter jurnal/riwayat untuk dokumen non-finansial dan termin bill-backed
- Status: `validated`
- Ringkasan:
  - temuan baru menunjukkan `Riwayat` tidak cocok menampilkan `Surat Jalan` sebagai riwayat finansial murni.
  - untuk `Surat Jalan`, user expectation-nya lebih dekat ke dokumen yang menunggu dikonversi menjadi bill/expense, jadi filternya perlu ditiadakan dari surface `Riwayat`.
  - untuk `Termin Proyek`, row jurnal sebaiknya tetap bergantung pada helper bersama dan event bill-backed yang sudah ada, agar surface jurnal tidak memunculkan termin yang tidak selaras dengan source of truth.
- File target:
  - `src/lib/transaction-presentation.js`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `api/transactions.js`
- Dependency:
  - `UCW-23`
  - `UCW-35`
  - `UCW-217`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser compare journal/history filters
- Catatan:
  - task ini harus menjaga konsistensi label vs predicate; jangan sampai filter hanya berubah di UI tapi query server-side tetap mengembalikan row yang sama.
  - fokus klarifikasi terbaru: `Riwayat` menghapus filter `Surat Jalan`; keputusan `Jurnal` tetap mengikuti helper filter bersama dan tidak perlu hardcode baru.

### [2026-04-22] `UCW-247` - Sembunyikan bill paid dari Jurnal tapi pertahankan di Riwayat
- Status: `validated`
- Ringkasan:
  - row `bill` yang sudah `paid` masih muncul di `Jurnal` walau sudah benar tampil di `Riwayat`.
  - surface `Jurnal` perlu tetap fokus ke catatan aktif yang relevan untuk operasi harian, sedangkan `Riwayat` tetap menjadi histori finansial lengkap.
  - task ini memisahkan visibility berdasarkan status `paid` tanpa mengubah histori atau payment trail yang sudah benar.
- File target:
  - `src/lib/transaction-presentation.js`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `api/transactions.js`
- Dependency:
  - `UCW-246`
  - `UCW-217`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser compare paid bill visibility in journal vs history
- Catatan:
  - paid bill harus hilang dari `Jurnal` tetapi tidak boleh hilang dari `Riwayat`; filter client dan query server-side harus sama-sama mengikuti aturan ini.

### [2026-04-22] `UCW-248` - Pisahkan detail teknis owner-only ke route terpisah
- Status: `validated`
- Ringkasan:
  - detail teknis yang sebelumnya menumpuk di `TransactionDetailPage`, `EditRecordPage`, dan `PaymentPage` dipisahkan ke route owner-only agar page utama tetap fokus ke konteks bisnis.
  - route teknis baru harus tetap bisa mengakses data yang sama, tetapi tidak lagi memaksa semua role melihat metadata teknis di atas fold.
  - owner-only access penting supaya detail operasional seperti ID mentah, status internal, dan metadata audit tidak tersebar ke role non-owner.
- File target:
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `src/pages/PaymentPage.jsx`
  - `src/components/layouts/FormLayout.jsx`
  - `src/components/layouts/FormHeader.jsx`
  - `src/components/ui/AppPrimitives.jsx`
  - `src/App.jsx`
- Dependency:
  - `UCW-242`
  - `UCW-247`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser smoke owner-only technical routes
- Catatan:
  - task ini harus menjaga page utama tetap ringkas; technical route boleh owner-only dan tidak perlu tampil sebagai panel tambahan di page existing.
  - route owner-only teknis sekarang tersedia terpisah untuk detail transaksi, edit record, dan payment tanpa menumpuk metadata di atas fold page utama.

### [2026-04-22] `UCW-249` - Rapikan owner-only technical route agar tidak duplikatif
- Status: `validated`
- Ringkasan:
  - follow-up ini muncul dari koreksi UX terakhir: technical route harus tidak duplikatif, bukan sekadar route terpisah.
  - page utama tetap menampilkan konten bisnis, sedangkan technical route owner-only hanya menampilkan status teknis, tipe, ID, source/metadata teknis, dan indikator siap edit atau tidak.
  - tombol menuju route teknis hanya boleh terlihat untuk `Owner`, bukan role lain.
- File target:
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `src/pages/PaymentPage.jsx`
  - `src/App.jsx`
  - `src/components/layouts/FormLayout.jsx`
  - `src/components/ui/AppPrimitives.jsx`
- Dependency:
  - `UCW-248`
  - `UCW-247`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser compare main page vs technical route
- Catatan:
  - task ini membekukan koreksi UX terakhir supaya technical route hanya memuat metadata teknis murni dan tidak menyalin block bisnis dari page utama.

### [2026-04-22] `UCW-250` - Tampilkan form payment dulu dan turunkan histori bill dari viewport awal
- Status: `validated`
- Ringkasan:
  - `PaymentPage` sekarang menampilkan form pembayaran sebelum histori pembayaran bill/pinjaman di viewport awal.
  - histori bill/pinjaman tetap tersedia di area sekunder setelah field pembayaran, sehingga entry payment jadi fokus first fold.
  - task ini menjaga UX tetap langsung ke aksi pembayaran tanpa mengubah auth, backend, atau route compatibility.
- File target:
  - `src/pages/PaymentPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `src/components/layouts/FormLayout.jsx`
  - `src/components/ui/AppPrimitives.jsx`
  - `src/App.jsx`
- Dependency:
  - `UCW-214`
  - `UCW-248`
  - `UCW-249`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser compare first-fold payment form vs history placement
- Catatan:
  - task ini dipisah dari owner-only technical route supaya perubahan payment UX tidak mencampur kebijakan role dengan tata letak workspace awal.

### [2026-04-22] `UCW-251` - Ringkas detail page biasa dan pindahkan tanggal ke card bawah header
- Status: `validated`
- Ringkasan:
  - detail page non-teknis sekarang tidak lagi menampilkan metadata berlebih seperti `ID`, `Sumber`, dan `Jenis` di first fold.
  - tanggal dipindah ke card tepat di bawah header, sedangkan technical route tetap menjadi tempat metadata teknis untuk owner.
- File target:
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `src/pages/PaymentPage.jsx`
  - `src/components/layouts/FormLayout.jsx`
  - `src/components/ui/AppPrimitives.jsx`
- Dependency:
  - `UCW-249`
  - `UCW-250`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
- Catatan:
  - task ini menjaga detail biasa tetap fokus ke konteks bisnis tanpa menyalin metadata teknis yang sudah dipindah ke route owner-only.

### [2026-04-22] `UCW-252` - Fokuskan histori pembayaran dan lampiran ke tab detail
- Status: `validated`
- Ringkasan:
  - detail page sekarang menjadi surface utama untuk tab kondisional `Info / Riwayat / Lampiran`, sehingga histori pembayaran dan lampiran tidak lagi diburu lewat route baru atau CTA bottom sheet.
  - tab `Riwayat` muncul hanya jika ada payment history dan memuat full list dengan tombol aksi icon-only sesuai role; tab `Lampiran` muncul hanya jika ada attachment dan menampilkan preview plus aksi icon-only `lihat / ganti / hapus` untuk role yang berwenang, sementara `Viewer` dan `Payroll` read-only.
  - tab detail tetap sinkron dengan status `partial / unpaid / paid` dan perubahan lampiran/pembayaran memicu refresh detail agar panel tidak stale.
- File target:
  - `src/pages/TransactionDetailPage.jsx`
  - `src/components/ui/AppPrimitives.jsx`
  - `src/App.jsx`
- Dependency:
  - `UCW-249`
  - `UCW-251`
  - `UCW-250`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser compare detail tabs vs baseline
- Catatan:
  - task ini tetap harus menjaga detail page tidak mencampur history surface dengan recycle bin atau CTA bottom sheet, dan tombol aksi di tab harus icon-only agar mobile tetap rapih.

### [2026-04-21] `UCW-240` - Smoke restore Playwright untuk tree `bill` dan `bill_payment`
- Status: `planned`
- Ringkasan:
  - task ini adalah micro-task test terpisah untuk memverifikasi restore tree `bill` dan restore leaf `bill_payment` di browser lokal.
  - scope test dibuat eksplisit agar deliverable docs-only ini tidak mencampur runtime validation dengan backlog implementasi.
- File target:
  - `tests/e2e/restore.spec.js`
- Dependency:
  - `UCW-239`
- Validasi:
  - `npx playwright test tests/e2e/restore.spec.js`
- Catatan:
  - `UCW-239` tetap mencerminkan outcome implementasi final; `UCW-240` menjadi micro-task test terpisah yang sudah lulus smoke gate.
  - Smoke Chromium lulus untuk restore tree `bill` dan restore leaf `bill_payment`, dengan parent settlement recalc tetap sinkron setelah restore.

### [2026-04-21] `UCW-239` - Pulihkan tree `bill` saat restore supaya child `bill_payments` ikut aktif dan settlement summary ikut dihitung ulang
- Status: `validated`
- Ringkasan:
  - `restoreBill` di `api/transactions.js` sekarang menghidupkan kembali `bill_payments` yang sebelumnya ikut di-soft-delete ketika parent bill dipulihkan dari recycle bin.
  - settlement summary bill dihitung ulang setelah child payment aktif lagi, sehingga `paid_amount`, `status`, dan `paid_at` kembali sinkron dengan histori payment.
  - recalculation di `api/records.js` juga diperkaya dengan `payment_date` agar bill yang kembali lunas tidak kehilangan konteks tanggal settlement saat summary dihitung ulang.
- File berubah:
  - `api/transactions.js`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npx.cmd eslint api/transactions.js api/records.js`
  - `npm.cmd run build`
- Risiko/regresi:
  - restore bill sekarang lebih agresif terhadap child payment history; kalau ada data legacy yang sengaja memisahkan payment leaf dari tree bill, flow ini akan menganggapnya bagian dari restore tree bill standar.

### [2026-04-21] `UCW-238` - Bangun baseline Playwright smoke suite untuk core CRUD/payment/report
- Status: `validated`
- Ringkasan:
  - suite E2E Playwright sedang dibangun untuk flow penting: auth bypass, shell Telegram, CRUD/payment, restore, dan report/PDF
  - focus awal adalah scaffold yang stabil dan bisa dijalankan di dev server lokal sebelum menambah coverage mutation yang lebih berat
  - MCP/browser tetap diposisikan sebagai alat diagnosis visual, bukan pengganti regression suite
- File berubah:
  - `package.json`
  - `.gitignore`
  - `playwright.config.js`
  - `tests/e2e/auth.spec.js`
  - `tests/e2e/create.spec.js`
  - `tests/e2e/edit.spec.js`
  - `tests/e2e/payment.spec.js`
  - `tests/e2e/report.spec.js`
  - `tests/e2e/restore.spec.js`
  - `tests/e2e/telegram-shell.spec.js`
  - `tests/e2e/transactions.spec.js`
  - `tests/e2e/helpers/app.js`
  - `tests/e2e/helpers/routes.js`
  - `tests/e2e/helpers/telegram.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Task baru atau revisi:
  - `UCW-238`
- Catatan dependency:
  - bergantung pada core flow yang sudah tervalidasi di `UCW-214`, `UCW-235`, dan `UCW-237`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `npx.cmd playwright test --project=chromium`

### [2026-04-21] `UCW-227` - Tambahkan custom fee lembur pada status absensi overtime
- Status: `validated`
- Ringkasan:
  - saat status `overtime` dipilih, form absensi dan editor record harus menampilkan input fee lembur custom
  - total upah lembur harus dihitung dari base wage ditambah fee custom, bukan multiplier statis 1.5x
  - field fee lembur perlu ikut tersimpan dan dibaca kembali lewat jalur sheet/edit agar data tidak hilang saat reopen
- File berubah:
  - `src/components/AttendanceForm.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `src/store/useAttendanceStore.js`
  - `src/lib/attendance-payroll.js`
  - `api/records.js`
  - `supabase/migrations/20260421193000_add_overtime_fee_to_attendance_records.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - perubahan ini menambahkan kontrak data attendance untuk fee custom agar tetap tersimpan konsisten di create dan edit flow

### [2026-04-21] `UCW-226` - Hardening shell `PaymentPage` dari row action dan ringkas form absensi harian untuk mobile
- Status: `validated`
- Ringkasan:
  - `PaymentPage` sekarang mempertahankan seed shell saat fetch detail mengembalikan `null`, jadi akses dari row action workspace tidak lagi menjatuhkan halaman ke blank state setelah flash awal
  - `AttendanceForm` sudah diringkas untuk mobile-first: KPI dibuat lebih rapat dan scrollable, control strip dibuat lebih hemat ruang, toggle status worker dibuat wrap-safe, dan tombol navigasi ekstra di halaman absensi dihapus
- File berubah:
  - `src/pages/PaymentPage.jsx`
  - `src/components/AttendanceForm.jsx`
  - `src/pages/AttendancePage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - smoke browser tidak bisa diselesaikan karena `npm.cmd run dev` gagal di stage config bundling dengan `spawn EPERM`, dan `vercel.cmd dev --listen 3000` tertahan error network `EACCES` ke API Vercel dari environment ini

### [2026-04-21] `UCW-225` - Buat form edit absensi unbilled agar status bisa diubah dari editor record
- Status: `audit_required`
- Ringkasan:
  - `EditRecordPage` sekarang menampilkan form edit khusus untuk `attendance_records` yang masih `unbilled`, lengkap dengan toggle status `Full Day` / `Half Day` / `Lembur` / `Tidak Hadir`, textarea catatan, dan preview total upah baru
  - store + API attendance sekarang mendukung PATCH edit record attendance, menolak row billed/linked, dan tetap menyelaraskan cache `sheetAttendances` / `unbilledAttendances` setelah save
  - task ini lulus `lint` dan `build`, tetapi browser smoke save/edit belum bisa dituntaskan di sesi browser yang tersedia karena backend route `api/*` tidak reachable dari context browser itu
- File berubah:
  - `src/pages/EditRecordPage.jsx`
  - `src/store/useAttendanceStore.js`
  - `src/lib/records-api.js`
  - `api/records.js`
  - `supabase/migrations/20260421120000_allow_absent_attendance_status.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - smoke data target yang dipakai saat audit adalah record `attendance_records` unbilled `b4e46d42-18b3-4078-a104-d0d090e0cb37`; route browser untuk `/api/auth` dan `/api/records` perlu backend API aktif sebelum edit/save bisa diverifikasi dari UI end-to-end

### [2026-04-21] `UCW-224` - Pulihkan tap row `Catatan Absensi` agar membuka bottom sheet aksi, bukan blank screen
- Status: `validated`
- Ringkasan:
  - row summary `Catatan Absensi` sekarang memakai `ActionCard` shared dan satu `ActionCardSheet` terpisah dari state loading/detail/rekap, jadi tap row kembali konsisten membuka bottom sheet aksi
  - akar blank screen ternyata bukan hanya state machine `sheetState.mode === 'actions'`, tetapi juga render detail sheet yang masih dievaluasi saat `mode === 'loading'` dengan group summary belum terhydrasi penuh; setelah guard ditambah, path loading tidak lagi membaca `records.length` pada data yang belum lengkap
  - state action kini diisolasi ke `activeActionCard`, sedangkan `sheetState` hanya menangani loading, detail, edit harian, dan konfirmasi rekap; `PaymentPage` direct route pada jalur `/tagihan/:id` dan `/pembayaran/tagihan/:id` tetap normal di audit ini
- File berubah:
  - `src/components/PayrollAttendanceHistory.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - perubahan ini juga menyelaraskan `Catatan Absensi` dengan pattern shared action sheet yang sudah dipakai di `Jurnal`, `Riwayat`, dan `Halaman Sampah`

### [2026-04-21] `UCW-221` - Samakan urutan default `Jurnal` / `Riwayat` ke timestamp realtime surface terbaru
- Status: `validated`
- Ringkasan:
  - `vw_workspace_transactions` kini menghitung `sort_at` dari timestamp realtime surface (`created_at`, `updated_at`, `bill_paid_at`) alih-alih field date-only, jadi item terbaru benar-benar naik ke atas
  - mapping transaksi workspace sekarang meneruskan `sort_at` ke client, dan subtitle `Jurnal` / `Riwayat` diprioritaskan ke timestamp yang sama supaya urutan dan label waktu tidak saling bertentangan
  - `Halaman Sampah` tetap memakai `deleted_at` sebagai source of truth sehingga tidak perlu perubahan algoritma sort tambahan
- File berubah:
  - `api/transactions.js`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `supabase/migrations/20260421200000_update_workspace_transaction_sort_order.sql`
  - `supabase/migrations/20260421200500_realign_workspace_transaction_sort_order_to_surface_time.sql`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - query audit `select source_type, id, sort_at, created_at, updated_at, bill_paid_at from public.vw_workspace_transactions order by sort_at desc, id desc limit 10`
- Catatan:
  - migration kedua dalam brief ini langsung mengoreksi iterasi awal agar `sort_at` benar-benar mengikuti waktu muncul di surface, bukan tanggal bisnis dokumen

### [2026-04-21] `UCW-222` - Perbaiki shell `PaymentPage` agar tidak flash lalu blank saat hydrate detail
- Status: `validated`
- Ringkasan:
  - `PaymentPage` sekarang selalu mempertahankan shell UI selama fetch detail berjalan, termasuk saat dibuka dari route state yang masih berupa snapshot tipis
  - seed record tidak lagi dibuang ketika refresh detail gagal, sehingga UI tidak jatuh ke blank state yang hanya menyisakan bottom nav
  - field form dan aksi destruktif tetap di-guard sampai detail hydrated selesai, jadi shell tampil dulu tetapi interaksi sensitif tidak aktif terlalu dini
- File berubah:
  - `src/pages/PaymentPage.jsx`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - akar glitch utamanya adalah shell dirender saat `record` belum ada, tetapi beberapa binding UI masih membaca `record.field` secara langsung; fallback display record sekarang menutup gap itu

### [2026-04-21] `UCW-223` - Perbaiki restore `surat jalan` yang gagal `current_stock` null dan audit domain restore lain
- Status: `validated`
- Ringkasan:
  - helper delta stok material sekarang menormalkan quantity/delta kosong menjadi `0` dan menolak delta tidak valid sebelum update `materials.current_stock`, sehingga restore `surat jalan` tidak lagi mengirim `NaN -> null`
  - akar masalah restore berasal dari mode `restore` yang sebelumnya menghitung `desired - previous - trigger` dengan nilai map kosong (`undefined`), menghasilkan `NaN` lalu gagal di constraint `current_stock not null`
  - audit code path restore menunjukkan hanya branch `material-invoices` yang melewati `syncMaterialInvoiceStockMovement`; restore `expense`, `bill-payment`, `loan-payment`, `attendance`, `loan`, dan `project-income` tidak menyentuh helper stok yang sama
- File berubah:
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - audit code path restore dengan `rg -n \"action === 'restore'|syncMaterialInvoiceStockMovement\\(adminClient\" api/records.js api/transactions.js src/pages/TransactionsRecycleBinPage.jsx src/lib/records-api.js src/lib/transactions-api.js`
- Catatan:
  - fix ini juga memperkeras jalur update/delete dokumen material terhadap delta stok tidak valid, jadi bukan cuma restore yang ikut tertutup

### [2026-04-21] `UCW-219` - Smoke create berantai untuk loan, expense, faktur, income, dan surat jalan
- Status: `validated`
- Ringkasan:
  - smoke create untuk `loan`, `expense`, `faktur`, `project_income`, dan `surat jalan` berhasil dijalankan berurutan sebagai bukti domain inti
  - blocker `project_income` yang sempat memunculkan error `42P10` pada trigger fee bill sudah diperbaiki dengan index unique yang bisa diinfer oleh `ON CONFLICT`
  - hasil audit sekarang lengkap: empat domain awal plus income semuanya tercatat jelas dengan child record yang tepat
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - audit backlog plan dan progress log
  - smoke DB create berantai untuk `loan`, `expense`, `faktur`, `surat jalan`
  - smoke DB create `project_income` setelah fix unique index
  - audit blocker `project_income` trigger fee bill
- Catatan:
  - data smoke memakai prefix khusus `SMOKE CREATE 20260421`
  - trigger `fn_sync_fee_bills_from_project_income()` sekarang berhasil membuat fee bill child setelah unique index `bills_project_income_staff_key` dibuat non-partial

### [2026-04-21] `UCW-220` - Perbaiki create `project income` yang gagal saat trigger fee bill `ON CONFLICT`
- Status: `validated`
- Ringkasan:
  - trigger fee bill untuk pemasukan proyek diselaraskan dengan index/constraint yang ada supaya insert `project_income` tidak lagi gagal `42P10`
  - unique index `bills_project_income_staff_key` sekarang non-partial, sehingga `ON CONFLICT (project_income_id, staff_id)` bisa berfungsi sesuai intent trigger
  - smoke create income dijalankan ulang dan menghasilkan fee bill child tanpa error
- File berubah:
  - `supabase/migrations/20260421190000_fix_project_income_fee_bill_unique_index.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - audit trigger fee bill dan hasil smoke DB
  - verifikasi unique index `bills_project_income_staff_key`
- Catatan:
  - task ini dipecah karena blocker-nya spesifik di create income, bukan di tiga domain lain yang sudah lolos

### [2026-04-21] `UCW-216` - Pulihkan CTA bayar untuk faktur material unpaid dari parent-child bill
- Status: `validated`
- Ringkasan:
  - workspace expense row sekarang membawa `bill_id` dan snapshot bill child lain dari view transaksi, sehingga detail route bisa menemukan bill terkait
  - helper pembayaran prioritas membaca status child bill lebih dulu, bukan hanya status parent expense, agar CTA bayar mengikuti state bill yang benar
  - focus saat ini hanya menutup gap CTA bayar untuk faktur material unpaid; label filter dan shell payment masih menunggu task follow-up masing-masing
- File berubah:
  - `api/transactions.js`
  - `src/lib/transaction-presentation.js`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - jika record parent memang tidak punya child bill valid, CTA bayar tetap harus tidak muncul

### [2026-04-21] `UCW-217` - Rapikan label filter ledger workspace agar sesuai UX kategori
- Status: `validated`
- Ringkasan:
  - label filter workspace kini sedang dirapikan agar `Pinjaman`, `Gaji/Upah`, `Faktur`, dan `Surat Jalan` terbaca lebih pendek dan tidak tumpang tindih
  - helper label bersama menjadi titik utama agar `Jurnal`, `Riwayat`, dan `Halaman Sampah` konsisten memakai string yang sama
  - update ini fokus pada label UX saja; predicate filter tetap harus mempertahankan perilaku existing
- File berubah:
  - `src/lib/transaction-presentation.js`
  - `src/pages/TransactionDetailPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - task berikutnya yang tetap relevan adalah `UCW-218` untuk shell PaymentPage

### [2026-04-21] `UCW-218` - Render shell `PaymentPage` lebih awal lalu hydrate field bertahap
- Status: `validated`
- Ringkasan:
  - `PaymentPage` tidak lagi menampilkan blank/skeleton penuh sebagai first paint; shell halaman dan ringkasan payment sekarang tetap dirender saat record masih dihydrate
  - field nominal, tanggal, dan catatan ikut tampil sebagai form shell tetapi dinonaktifkan sampai data siap, sehingga tombol aksi tetap aman
  - state ini menutup jeda visual panjang saat buka route payment dari entrypoint yang belum punya seed lengkap
- File berubah:
  - `src/pages/PaymentPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - smoke browser route belum sempat dijalankan dari shell karena local HTTP dev host tidak bisa diakses langsung dari tool ini; smoke data master tetap dilakukan via Supabase MCP di langkah terpisah

### [2026-04-21] `UCW-215` - Pertahankan nominal saldo kas full, tapi ringkas laba bersih dan pinjaman aktif di KPI Dashboard
- Status: `validated`
- Ringkasan:
  - saldo kas Dashboard tetap tampil penuh `Rp` seperti sebelumnya agar angka utama tetap formal dan jelas
  - laba bersih dan pinjaman aktif kembali memakai format nominal singkat supaya dua KPI di grid horizontal tidak terlalu lebar
  - perubahan hanya menyentuh presentasi KPI Dashboard, tanpa mengubah data source atau contract summary
- File berubah:
  - `src/pages/Dashboard.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - audit format nominal KPI di `src/pages/Dashboard.jsx`
- Catatan:
  - task ini sifatnya UI kecil; kalau nanti ada KPI baru di grid yang butuh format berbeda, rule format perlu ditetapkan per-kartu, bukan global

### [2026-04-21] `UCW-214` - Seed pembayaran dari navigation state dan tunda mount form edit sampai detail hydrated
- Status: `validated`
- Ringkasan:
  - `PaymentPage` sekarang memakai seed `transaction` / `bill` / `record` dari navigation state sehingga klik `Bayar` bisa langsung menampilkan konteks halaman sambil fetch detail berjalan di background
  - `PaymentPage` tidak lagi memaksa skeleton saat seed record sudah tersedia, sehingga route payment dari list tidak terasa blank sebelum revalidasi selesai
  - `EditRecordPage` menahan mount form edit sampai fetch detail selesai, sehingga form edit tidak lagi dibuka dalam kondisi snapshot list yang belum lengkap
- File berubah:
  - `src/pages/PaymentPage.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `src/pages/BillsPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - audit route payment dan edit hydration terhadap entrypoint `TransactionsPage`, `BillsPage`, `PaymentPage`, dan `EditRecordPage`
- Catatan:
  - task ini menutup gejala layar blank / field kosong pada flow aktif; kalau ada entrypoint lain yang masih membuka `PaymentPage` tanpa seed state, itu perlu audit terpisah

### [2026-04-21] `UCW-78` - Kunci matriks source of truth release untuk semua core feature
- Status: `validated`
- Ringkasan:
  - freeze contract map diperbarui agar route surface, store, API, dan tabel/view core feature tercantum eksplisit tanpa ambiguitas legacy
  - row `bill`, `payment`, `attendance history`, `payroll`, dan `reports` sekarang menyebut page/surface runtime yang benar, bukan placeholder atau planned page
  - plan backlog dan progress log disinkronkan sehingga status task ini tercatat sebagai `validated`
- File berubah:
  - `docs/freeze/03-source-of-truth-contract-map.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - audit repo route/store/API terhadap `src/App.jsx`, `src/pages/*`, `src/store/*`, `src/lib/*`, dan `api/*`
- Catatan:
  - task berikutnya harus dipilih dari backlog yang masih `ready`; `UCW-78` menutup gap dokumentasi contract map release

### [2026-04-21] `UCW-209` - Seed `Jurnal` dari cache dashboard lalu revalidate page pertama di background
- Status: `validated`
- Ringkasan:
  - `TransactionsPage` kini memanfaatkan snapshot `workspaceTransactions` yang sudah hangat dari `useDashboardStore` untuk menampilkan row awal `Jurnal` tanpa skeleton penuh saat data dashboard dan ledger masih sama
  - fetch page pertama tetap jalan di background dengan mode revalidate sehingga state paginated kembali ke server truth tanpa mengorbankan first paint
  - restore state session tetap dipertahankan; seed dashboard hanya dipakai saat ledger belum punya snapshot lokal yang valid
- File berubah:
  - `src/pages/TransactionsPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - HTTP smoke `GET /?devAuthBypass=1` => `200`
  - HTTP smoke `GET /transactions?devAuthBypass=1` => `200`
- Catatan:
  - browser compare penuh `Dashboard -> Jurnal` belum bisa dijalankan di session ini karena harness browser tidak tersedia; HTTP smoke dipakai sebagai verifikasi route minimum tambahan
  - task berikutnya yang paling relevan sekarang adalah `UCW-210`

### [2026-04-21] `UCW-210` - Ringankan render list `Jurnal` / `Riwayat` / `Halaman Sampah` dengan shared action sheet
- Status: `validated`
- Ringkasan:
  - `ActionCard` sekarang mendukung mode shared sehingga row ledger bisa memicu satu sheet di level halaman, bukan menanam `AppSheet` tersembunyi di tiap item
  - `TransactionsPage`, `HistoryPage`, dan `TransactionsRecycleBinPage` masing-masing menyimpan state menu aktif sendiri dan merender satu `ActionCardSheet` per halaman
  - perubahan ini menjaga UX action tetap sama, tetapi mengurangi mount cost pada list mobile yang panjang
- File berubah:
  - `src/components/ui/ActionCard.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - browser render audit penuh belum dijalankan di session ini; validasi saat ini mengandalkan audit struktur render + build lint yang lolos
  - task berikutnya yang paling relevan sekarang adalah `UCW-211`

### [2026-04-21] `UCW-211` - Ubah `Catatan Absensi` menjadi summary-first dengan detail on-demand
- Status: `validated`
- Ringkasan:
  - initial load `PayrollAttendanceHistory` sekarang memuat summary `daily` dan `worker` dari endpoint `attendance-history?view=summary`, bukan seluruh record bulanan
  - detail record baru diambil saat user membuka aksi detail, edit, atau rekap, lalu sheet yang relevan dirender setelah data hydrated selesai
  - fallback summary/detail tetap konsisten dengan kontrak existing, tetapi payload awal jauh lebih ringan daripada hydrate penuh
- File berubah:
  - `src/components/PayrollAttendanceHistory.jsx`
  - `src/lib/records-api.js`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - HTTP smoke `GET /payroll?devAuthBypass=1` => `200`
- Catatan:
  - browser compare payroll load penuh belum bisa dijalankan di session ini; HTTP smoke route dipakai sebagai verifikasi minimum tambahan
  - task berikutnya yang paling relevan sekarang adalah `UCW-212`

### [2026-04-21] `UCW-212` - Tunda fetch `stock-project-options` sampai sheet stock-out benar-benar dibuka
- Status: `validated`
- Ringkasan:
  - `StockPage` sekarang hanya memuat overview stok saat mount; request `stock-project-options` tidak lagi ikut jalan di first paint
  - opsi `Unit Kerja` baru diambil saat sheet stock-out manual dibuka, lalu hasilnya dipakai ulang selama konteks team dan role tidak berubah
  - loading state dan error tetap muncul di sheet yang sama sehingga user masih bisa melihat fallback saat fetch opsi gagal
- File berubah:
  - `src/pages/StockPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - `UCW-212` menutup fan-out request tambahan di `Stok Barang` tanpa mengubah contract stok maupun permission manual stock-out

### [2026-04-21] `UCW-213` - Normalisasi timestamp non-core dan rapikan KPI saldo kas Dashboard
- Status: `validated`
- Ringkasan:
  - sumber `summary` dashboard kini kembali mengirim `total_income`, `total_expense`, dan `ending_balance` snake_case sehingga store tidak lagi jatuh ke fallback nol
  - saldo kas, laba bersih, pinjaman aktif, dan tagihan pending di Dashboard sekarang tampil penuh `Rp 0` / nominal utuh, bukan bentuk singkat
  - formatter datetime runtime sekarang memakai timezone lokal runtime untuk timestamp nyata, sementara field date-only tetap dipetakan sebagai tanggal murni agar tidak lagi memunculkan jam statis `07.00`
- File berubah:
  - `api/transactions.js`
  - `api/notify.js`
  - `src/lib/date-time.js`
  - `src/lib/transaction-presentation.js`
  - `src/pages/Dashboard.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/pages/PaymentsPage.jsx`
  - `src/pages/DeletedTransactionDetailPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/BillsPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - residual recycle bin dan report/notifikasi kini ikut memakai formatter runtime yang sama, sehingga follow-up berikutnya tidak perlu membuka lagi bug `07.00` pada path yang sama

### [2026-04-21] Brief audit menyeluruh UX lambat list inti vs dashboard
- Status: `validated`
- Ringkasan:
  - audit diminta khusus untuk `Jurnal`, `Riwayat`, `Halaman Sampah`, `Catatan Absensi`, dan `Stok Barang`, lalu dibandingkan dengan list `Aktivitas terbaru` di dashboard yang menampilkan data workspace serupa
  - hasil audit repo + DB menunjukkan dataset aktif masih kecil, jadi kelambatan sekarang bukan karena jumlah row, melainkan fixed overhead request, strategi loading route, dan render cost row interaktif
  - backlog stream dipecah menjadi task sempit `UCW-208` s.d. `UCW-212` agar solusi berikutnya bisa dieksekusi bertahap tanpa refactor besar
- Task baru:
  - `UCW-207`
  - `UCW-208`
  - `UCW-209`
  - `UCW-210`
  - `UCW-211`
  - `UCW-212`
- Catatan:
  - `UCW-173` tetap dipertahankan sebagai umbrella optimasi first paint list, tetapi implementasi konkretnya sekarang dipecah berdasarkan akar masalah yang lebih spesifik

### [2026-04-21] `UCW-207` - Audit menyeluruh bottleneck loading list inti vs dashboard
- Status: `validated`
- Ringkasan:
  - hitungan DB aktual menunjukkan dataset aktif masih sangat kecil: `vw_workspace_transactions = 10`, `vw_history_transactions = 3`, `vw_recycle_bin_records = 1`, `attendance_records aktif = 2`, `materials aktif = 1`, dan `stock_transactions aktif = 3`
  - `EXPLAIN ANALYZE` untuk read path `workspace`, `history`, `attendance history`, `materials`, dan `stock_transactions` hanya memakan kira-kira `0.10 ms` sampai `0.57 ms`, jadi bottleneck utama bukan query DB inti
  - akar masalah paling kuat saat ini ada di luar query utama: setiap request list masih melewati `getAuthorizedContext()` + lookup `profiles` + `assertTeamAccess()` sebelum query bisnis, `Jurnal` / `Riwayat` / `Halaman Sampah` memblok layar sampai fetch pertama selesai, `Dashboard` menjadwalkan `workspaceTransactions` via `requestAnimationFrame` + `silent` sehingga terasa lebih cepat, `Catatan Absensi` memuat seluruh riwayat bulanan lalu membangun dua grouping penuh sekaligus, dan `Stok Barang` melakukan fan-out request overview + project options pada mount
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - audit code path `src/pages/Dashboard.jsx`, `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/components/PayrollAttendanceHistory.jsx`, `src/pages/StockPage.jsx`, `src/store/useDashboardStore.js`, `api/transactions.js`, `api/records.js`
  - `mcp__supabase__.execute_sql` count row aktif untuk tabel/view terkait
  - `mcp__supabase__.execute_sql` `EXPLAIN ANALYZE` untuk `vw_workspace_transactions`, `vw_history_transactions`, `attendance_records`, `materials`, dan `stock_transactions`
- Catatan:
  - prioritas implementasi berikutnya dikunci berurutan: `UCW-208` fixed overhead endpoint, `UCW-209` parity `Dashboard -> Jurnal`, `UCW-210` mount cost row list, `UCW-211` summary-first payroll history, lalu `UCW-212` lazy `stock-project-options`

### [2026-04-21] `UCW-208` - Pangkas fixed overhead auth/profile/team lookup pada endpoint read list inti
- Status: `validated`
- Ringkasan:
  - `api/transactions.js` GET path sekarang tidak lagi memanggil `getAuthorizedContext()` dan lookup `profiles` untuk `Jurnal`, `Riwayat`, `Halaman Sampah`, dan summary/read path lain; access workspace diverifikasi lebih dulu lewat session-bound client (`publishable key` + bearer token) ke `teams`, lalu query bisnis tetap memakai service client
  - `api/records.js` menambahkan fast path GET untuk `attendance-history`, `stock-overview`, dan `stock-project-options`; `attendance-history` dan `stock-overview` kini hanya butuh team access check berbasis session client, sementara `stock-project-options` tinggal memakai satu lookup `profiles` via RLS untuk resolve role stock-out tanpa lagi memukul endpoint auth Supabase
  - contract akses tidak diubah: read model berat masih dibaca lewat service client setelah access check lolos, sedangkan branch mutasi dan resource lain tetap memakai alur auth lama supaya scope tetap sempit dan aman
- File berubah:
  - `api/transactions.js`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - `UCW-209` tetap jadi lanjutan paling bernilai karena setelah overhead endpoint turun, gap UX terbesar berikutnya tetap seed `Dashboard -> Jurnal`

### [2026-04-21] Brief smoke test satu aksi per task
- Status: `validated`
- Ringkasan:
  - smoke test browser dijalankan satu aksi per task supaya hasil audit mudah ditindak dan tidak bercampur
  - tiap task hanya memvalidasi satu verb utama, misalnya create loan saja, lalu mencatat hasil, blocker, atau bug yang ditemukan
  - jika ada blocker/bug/masalah, buat task backlog baru yang sempit di stream ini untuk tindak lanjut terpisah
- Task baru:
  - `UCW-194`
  - `UCW-195`
  - `UCW-196`
  - `UCW-197`
  - `UCW-198`
  - `UCW-199`
  - `UCW-200`
  - `UCW-201`
- Urutan eksekusi:
  - `create loan`
  - `update expense`
  - `delete material invoice`
  - `payment bill`
  - `record attendance`
  - `payment loan`
  - `restore bill_payment`
  - `permanent delete loan_payment`
- Catatan:
  - hasil smoke cukup dicatat ringkas: lolos, blocker, bug, atau masalah lingkungan
  - perbaikan dari temuan smoke tidak digabung ke task smoke yang sama; pecah ke backlog task baru

### [2026-04-21] Brief follow-up hasil smoke CRUD satu aksi per task
- Status: `validated`
- Ringkasan:
  - `UCW-202`, `UCW-203`, `UCW-205`, dan `UCW-206` sudah lolos browser smoke + audit DB/UI: notify create `loan` kembali `200`, edit `expense` terkunci jelas sebelum submit, permanent delete `loan_payment` benar-benar menghapus row, dan delete `material invoice` kini diblok lebih awal di UI bila rollback stok memang tidak aman
  - `UCW-204` tetap menjadi audit historis dari blocker awal, tetapi ambiguity lifecycle-nya sudah ditutup oleh contract final `UCW-206`
  - stream ini kembali bersih dari empat blocker smoke CRUD awal, sehingga brief berikutnya bisa masuk tanpa carry-over error mentah yang sama
- Task baru:
  - tidak ada
- Catatan:
  - fixture recycle bin untuk `UCW-200` dan `UCW-201` dibuat dari row smoke `UCW-197` dan `UCW-199` yang diarsipkan setelah payment create lolos
  - follow-up `material invoice` dipisah lagi karena masalah tersisa bukan lagi error mentah runtime, melainkan rule delete saat stok sumber sudah dipakai

### [2026-04-21] `UCW-194` - Smoke create `loan` saja
- Status: `validated`
- Ringkasan:
  - create `loan` via `/edit/loan/new?devAuthBypass=1` berhasil menulis row baru `e1eef759-3cd7-413c-b6fa-f9f2faccfebb` ke `public.loans` dengan `principal_amount = 123456` dan status `unpaid`
  - write path utama `POST /api/transactions` merespons `200`, tetapi step notifikasi sesudahnya gagal karena `POST /api/notify` mengembalikan `500`
  - payload notify loan yang terkirim membawa `principalAmount: 0`, jadi follow-up dipisah ke `UCW-202`
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/edit/loan/new?devAuthBypass=1`
  - network `POST /api/transactions` => `200`
  - network `POST /api/notify` => `500`
  - audit DB `public.loans` id `e1eef759-3cd7-413c-b6fa-f9f2faccfebb`
- Catatan:
  - row smoke loan dipertahankan sebagai fixture audit create loan, karena write utama berhasil dan hanya boundary notify yang rusak

### [2026-04-21] `UCW-195` - Smoke update `expense` saja
- Status: `validated`
- Ringkasan:
  - smoke edit pada `/edit/expense/19468f63-896d-4946-997c-8fdb2bd63714?devAuthBypass=1` berhasil membuka form dan menerima perubahan field `Catatan`
  - submit update gagal dengan alert `Pengeluaran yang sudah memiliki pembayaran tidak bisa diubah atau dihapus.` dan `PATCH /api/records?resource=expenses` merespons `400`
  - guard backend ternyata benar, tetapi guard UI baru muncul setelah user mengubah field dan menekan save; follow-up guard sinkron dipisah ke `UCW-203`
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/edit/expense/19468f63-896d-4946-997c-8fdb2bd63714?devAuthBypass=1`
  - network `PATCH /api/records?resource=expenses` => `400`
  - audit DB `public.expenses` id `19468f63-896d-4946-997c-8fdb2bd63714` tetap `notes = null`
- Catatan:
  - smoke ini memakai satu-satunya `expense` operasional aktif saat ini; tidak ada fixture edit alternatif yang bebas payment history di dataset lokal aktif

### [2026-04-21] `UCW-196` - Smoke delete `material invoice` saja
- Status: `validated`
- Ringkasan:
  - tombol `Hapus` pada `/edit/expense/4a3243b7-eb8d-40ed-b04a-a3a4c36cb123?devAuthBypass=1` masih memicu confirm delete, tetapi handler delete berakhir `500`
  - pesan runtime yang tampil adalah `Stok material 49c9d426-d101-47bb-8cd1-cf548b4ef236 tidak mencukupi untuk rollback dokumen barang ini. | Code: P0001`
  - audit DB menunjukkan invoice target tetap `deleted_at = null`, jadi follow-up dipisah ke `UCW-204`
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/edit/expense/4a3243b7-eb8d-40ed-b04a-a3a4c36cb123?devAuthBypass=1`
  - network `DELETE /api/records?resource=material-invoices` => `500`
  - audit DB `public.expenses` id `4a3243b7-eb8d-40ed-b04a-a3a4c36cb123` tetap `deleted_at = null`
- Catatan:
  - blocker ini berbeda dari fix sebelumnya karena sekarang gagal pada rollback stok invoice aktif dengan error `P0001`, bukan null violation lama

### [2026-04-21] `UCW-197` - Smoke payment `bill` saja
- Status: `validated`
- Ringkasan:
  - create payment bill pada `/pembayaran/tagihan/123dffad-32ee-499b-b92f-b3c1878c3f47?devAuthBypass=1` sukses menambah payment `Rp 11.111` dengan catatan `SMOKE UCW-197 bill payment 2026-04-21`
  - sesudah submit, histori bill bertambah menjadi `3 item`, total terbayar naik ke `Rp 31.111`, dan sisa tagihan turun ke `Rp 12.468.889`
  - row smoke ini kemudian diarsipkan sebagai fixture untuk `UCW-200`, lalu berhasil dipulihkan lagi pada task restore
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/pembayaran/tagihan/123dffad-32ee-499b-b92f-b3c1878c3f47?devAuthBypass=1`
  - network `POST /api/records?resource=bill-payments` => `200`
  - audit DB `public.bill_payments` id `1bcc3b06-3e04-4a47-95a9-2d2a1929fe6e` amount `11111`
- Catatan:
  - response `/api/notify` untuk bill payment tidak memunculkan blocker baru pada smoke ini

### [2026-04-21] `UCW-198` - Smoke record `attendance` saja
- Status: `validated`
- Ringkasan:
  - sheet `Absensi Harian` di `/attendance/new?devAuthBypass=1` berhasil menghydrate worker aktif, menerima status `Full Day`, lalu menyimpan sheet tanpa hang
  - UI menampilkan pesan `Sheet absensi tersimpan. Record ini akan muncul di payroll dan bisa ditagihkan per worker.`
  - audit DB mengonfirmasi row `attendance_records` baru `b4e46d42-18b3-4078-a104-d0d090e0cb37` dengan `attendance_status = full_day` dan `total_pay = 75000`
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/attendance/new?devAuthBypass=1`
  - browser save: `Simpan Sheet Absensi`
  - audit DB `public.attendance_records` notes `SMOKE UCW-198 attendance 2026-04-21`
- Catatan:
  - smoke ini tidak membuka flow tagih payroll; task hanya memverifikasi record attendance harian satu aksi

### [2026-04-21] `UCW-199` - Smoke payment `loan` saja
- Status: `validated`
- Ringkasan:
  - create payment loan pada `/pembayaran/pinjaman/e000833d-0ca6-414b-ae69-0c32665be77d?devAuthBypass=1` sukses menambah payment `Rp 22.222` dengan catatan `SMOKE UCW-199 loan payment 2026-04-21`
  - histori loan bertambah menjadi `3 item`, total terbayar naik ke `Rp 42.222`, dan sisa pinjaman turun ke `Rp 429.957.778`
  - row smoke ini kemudian diarsipkan sebagai fixture untuk `UCW-201`
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/pembayaran/pinjaman/e000833d-0ca6-414b-ae69-0c32665be77d?devAuthBypass=1`
  - browser submit: `Simpan Pembayaran`
  - audit DB `public.loan_payments` id `f75e8d80-9824-4d3e-8413-719e70fe1675` amount `22222`
- Catatan:
  - create payment loan tidak memunculkan blocker baru; error muncul baru pada task delete permanen sesudah row ini diarsipkan

### [2026-04-21] `UCW-200` - Smoke restore `bill_payment` saja
- Status: `validated`
- Ringkasan:
  - row payment bill smoke `SMOKE UCW-197 bill payment 2026-04-21` berhasil direstore dari `Halaman Sampah`
  - network `PATCH /api/records?resource=bill-payments` merespons `200`, dan audit SQL sesudah restore menunjukkan `deleted_at = null`
  - verifikasi visual final dikunci dengan reload halaman recycle bin; setelah reload item restore hilang dan hanya `Surat jalan material baru` yang tersisa
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/transactions/recycle-bin?devAuthBypass=1`
  - network `PATCH /api/records?resource=bill-payments` => `200`
  - browser reload recycle bin sesudah restore
  - audit DB `public.bill_payments` id `1bcc3b06-3e04-4a47-95a9-2d2a1929fe6e` => `deleted_at = null`
- Catatan:
  - tidak ada follow-up baru untuk restore `bill_payment`; task ini hanya mencatat bahwa verifikasi visual final lebih aman bila dikunci dengan reload sesudah aksi

### [2026-04-21] `UCW-201` - Smoke permanent delete `loan_payment` saja
- Status: `validated`
- Ringkasan:
  - row loan payment smoke `SMOKE UCW-199 loan payment 2026-04-21` berhasil diarsipkan ke recycle bin, lalu aksi `Hapus Permanen` dari dialog recycle bin memicu `DELETE /api/transactions?resource=loan-payments` dengan respons `200`
  - hasil fungsionalnya gagal: item tetap muncul di `Halaman Sampah` sesudah reload dan row DB `f75e8d80-9824-4d3e-8413-719e70fe1675` masih ada dengan `deleted_at` terisi
  - follow-up dipisah ke `UCW-205`
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/transactions/recycle-bin?devAuthBypass=1`
  - network `DELETE /api/transactions?resource=loan-payments` => `200`
  - browser reload recycle bin sesudah `Hapus Permanen`
  - audit DB `public.loan_payments` id `f75e8d80-9824-4d3e-8413-719e70fe1675` masih ada dengan `deleted_at` terisi
- Catatan:
  - task berikutnya di stream ini adalah `UCW-202` sampai `UCW-205`

### [2026-04-21] `UCW-202` - Perbaiki payload notifikasi create `loan`
- Status: `validated`
- Ringkasan:
  - `buildLoanNotificationPayload()` sekarang memakai fallback `amount` / `loan_terms_snapshot.principal_amount` dan snapshot kreditur, sehingga payload notify tidak lagi kehilangan `principalAmount`
  - smoke browser baru di `/edit/loan/new?devAuthBypass=1` berhasil menulis loan baru sekaligus membuat `POST /api/notify` kembali `200`
  - audit network memperlihatkan payload notify yang terkirim sudah berisi `principalAmount = 123457`, `repaymentAmount = 123457`, dan `creditorName = Bank BRI`
- File berubah:
  - `src/store/useIncomeStore.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/edit/loan/new?devAuthBypass=1`
  - network `POST /api/transactions` => `200`
  - network `POST /api/notify` => `200`
  - audit request body `/api/notify` => `principalAmount = 123457`, `repaymentAmount = 123457`, `creditorName = Bank BRI`
  - audit DB `public.loans` id `33982801-e085-4c41-87c3-194914cce737`
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - fix dibatasi di builder payload store; kontrak `/api/notify` tidak diubah

### [2026-04-21] `UCW-203` - Samakan guard UI edit `expense` dengan guard backend
- Status: `validated`
- Ringkasan:
  - `ExpenseForm` dan tombol delete di `EditRecordPage` sekarang mengunci expense yang sudah punya payment history berdasarkan `bill.paid_amount` / `bill.status`
  - smoke ulang di `/edit/expense/19468f63-896d-4946-997c-8fdb2bd63714?devAuthBypass=1` menunjukkan seluruh field form, tombol submit, dan tombol `Hapus` sudah disabled sebelum user mencoba submit
  - warning yang tampil kini sama dengan rule backend: `Pengeluaran yang sudah memiliki pembayaran tidak bisa diubah atau dihapus.`
- File berubah:
  - `src/components/ExpenseForm.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/edit/expense/19468f63-896d-4946-997c-8fdb2bd63714?devAuthBypass=1`
  - audit visual: fieldset `ExpenseForm`, tombol `Perbarui Pengeluaran`, dan tombol `Hapus` semua disabled
  - audit DB `public.expenses` id `19468f63-896d-4946-997c-8fdb2bd63714` tetap `notes = null`
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - task ini menutup jalur edit semu; belum menambah fixture edit alternatif baru di dataset lokal

### [2026-04-21] `UCW-204` - Pulihkan soft delete `material invoice` yang gagal rollback stok
- Status: `blocked`
- Ringkasan:
  - jalur delete `material invoice` sekarang menjalankan precheck stok sebelum RPC rollback, sehingga error tidak lagi jatuh sebagai `500 P0001`
  - smoke ulang pada `/edit/expense/4a3243b7-eb8d-40ed-b04a-a3a4c36cb123?devAuthBypass=1` mengembalikan `DELETE /api/records?resource=material-invoices` => `400` dengan pesan domain: `Dokumen barang ini tidak bisa dihapus karena stok material Semen sudah terpakai di mutasi lain. Koreksi mutasi stok turunannya lebih dulu.`
  - task tetap `blocked` karena lifecycle final delete invoice yang sudah jadi sumber stok belum diputuskan: apakah harus diblok lebih awal di UI, atau rollback stok harus dependency-aware
- File berubah:
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/edit/expense/4a3243b7-eb8d-40ed-b04a-a3a4c36cb123?devAuthBypass=1`
  - network `DELETE /api/records?resource=material-invoices` => `400`
  - audit DB `public.expenses` id `4a3243b7-eb8d-40ed-b04a-a3a4c36cb123` tetap `deleted_at = null`
  - audit DB `public.materials` id `49c9d426-d101-47bb-8cd1-cf548b4ef236` menunjukkan `current_stock = 2496`, lebih kecil dari qty faktur `2500`
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - follow-up backlog dipisah ke `UCW-206` untuk memutuskan contract delete dokumen barang saat stok sumber sudah dipakai mutasi lain

### [2026-04-21] `UCW-205` - Perbaiki permanent delete `loan_payment`
- Status: `validated`
- Ringkasan:
  - path hard delete `loan_payment` sekarang memakai service-role client murni untuk aksi `DELETE`, sementara validasi akses team tetap memakai client bearer user
  - smoke ulang di `Halaman Sampah` berhasil menghapus permanen item `SMOKE UCW-199 loan payment 2026-04-21`; list recycle bin turun dari `2 item` menjadi `1 item` tanpa reload manual tambahan
  - audit DB mengonfirmasi row `public.loan_payments` id `f75e8d80-9824-4d3e-8413-719e70fe1675` sudah hilang total
- File berubah:
  - `api/transactions.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/transactions/recycle-bin?devAuthBypass=1`
  - network `DELETE /api/transactions?resource=loan-payments` => `200`
  - audit visual recycle bin: item `SMOKE UCW-199 loan payment 2026-04-21` hilang, sisa list `1 item`
  - audit DB `public.loan_payments` id `f75e8d80-9824-4d3e-8413-719e70fe1675` => tidak ada row
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - akar masalah terkonfirmasi berasal dari client service-role yang masih membawa `Authorization` bearer user, sehingga RLS delete tetap aktif; delete leaf ini sekarang dipisah ke client tanpa bearer

### [2026-04-21] `UCW-206` - Finalkan contract delete `material invoice` saat stok sumber sudah dipakai
- Status: `validated`
- Ringkasan:
  - freeze contract `dokumen barang` sekarang menegaskan bahwa delete harus diblok lebih awal bila rollback stok akan membuat stok final minus karena stok sumber sudah dipakai mutasi lain
  - `api/records.js` sekarang mengembalikan metadata `materials.current_stock` pada line item invoice, dan `EditRecordPage` memakai metadata itu untuk menurunkan blocker domain yang sama dengan backend sebelum user menekan delete
  - smoke ulang di `/edit/expense/4a3243b7-eb8d-40ed-b04a-a3a4c36cb123?devAuthBypass=1` menampilkan pesan blocker langsung di layar dan tombol `Hapus` sudah disabled, sehingga user tidak lagi masuk ke jalur delete yang pasti ditolak
- File berubah:
  - `docs/freeze/03-source-of-truth-contract-map.md`
  - `api/records.js`
  - `src/pages/EditRecordPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/edit/expense/4a3243b7-eb8d-40ed-b04a-a3a4c36cb123?devAuthBypass=1`
  - audit visual: pesan `Dokumen barang ini tidak bisa dihapus...` tampil sebelum aksi, tombol `Hapus` disabled
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - contract final yang dipakai sekarang adalah `block-early`, bukan rollback dependency-aware; jika produk nanti ingin delete yang lebih pintar, itu perlu brief baru karena berarti mengubah lifecycle stok final

### [2026-04-21] `UCW-186` - Fix bottom nav agar tidak terdorong keyboard saat filter `Jurnal` fokus di mobile
- Status: `validated`
- Ringkasan:
  - `BottomNav` sekarang memantau focus editable dan perubahan visual viewport di viewport mobile, lalu menyembunyikan nav sementara ketika keyboard aktif
  - state hide memakai transisi `translate-y` / `opacity` agar nav tidak terlihat meloncat ke tengah layar saat filter `Jurnal` atau input lain fokus
  - quick actions sheet tetap memakai portal dan tidak ikut terdampak behavior keyboard-aware ini
- File berubah:
  - `src/components/ui/BottomNav.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - task berikutnya di stream ini adalah `UCW-194`

### [2026-04-21] `UCW-185` - Migrasikan notifikasi in-app dan fallback transient ke `GlobalToast` global
- Status: `validated`
- Ringkasan:
  - store transaksi, pemasukan, dan pembayaran sekarang memanggil `showToast()` untuk success, info, warning, dan error agar feedback tidak lagi tersebar di state lokal
  - form/fallback transient di `Payroll`, `Payment`, `Material Invoice`, `Loan`, dan attendance history sudah dipindahkan ke satu contract toast global tanpa mengubah jalur persist yang memang harus stay-on-screen
  - warning Telegram gagal kirim tetap muncul sebagai toast, sementara flow write utama tetap mengembalikan respons yang kompatibel dengan callsite lama
- File berubah:
  - `src/store/useIncomeStore.js`
  - `src/store/usePaymentStore.js`
  - `src/store/useTransactionStore.js`
  - `src/components/MaterialInvoiceForm.jsx`
  - `src/components/LoanForm.jsx`
  - `src/components/PayrollAttendanceHistory.jsx`
  - `src/pages/PayrollPage.jsx`
  - `src/pages/PaymentPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Catatan:
  - task berikutnya di stream ini adalah `UCW-186`

### [2026-04-21] `UCW-184` - Rancang contract dan layout `GlobalToast` reusable untuk Telegram mini web mobile
- Status: `validated`
- Ringkasan:
  - `useToastStore` baru menyediakan `showToast()` dan `hideToast()` dengan default durasi per tone, guard loading persistent, dan timer cleanup supaya notifikasi transient tidak saling menimpa
  - `GlobalToast` kini merender card token-based yang safe-area aware, memakai tone `success` / `info` / `warning` / `error` / `loading`, dan dipasang di shell utama, wrapper route standalone, serta state loading/denied agar bisa dipakai lintas surface
  - shell utama dan route standalone kini punya mount toast yang konsisten tanpa menambah kontrak baru di callsite lama
- File berubah:
  - `src/store/useToastStore.js`
  - `src/components/ui/GlobalToast.jsx`
  - `src/components/layouts/MainLayout.jsx`
  - `src/App.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
- Catatan:
  - task berikutnya di stream ini adalah `UCW-186`

### [2026-04-21] `UCW-187` - Pulihkan read model `Jurnal` / `Riwayat` dari `User not allowed`
- Status: `validated`
- Ringkasan:
  - `api/transactions.js` sekarang memisahkan client auth dari client baca, sehingga session owner valid tetap dipakai untuk akses check tetapi query read model workspace/history berjalan dengan read client service-role tanpa ikut terjegal RLS view path
  - smoke Chrome membuktikan `Jurnal` dan `Riwayat` kembali terbuka normal pada `/?devAuthBypass=1`, `/transactions`, dan `/transactions/history`
- File berubah:
  - `api/transactions.js`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - smoke browser `GET /transactions?devAuthBypass=1`
  - smoke browser `GET /transactions/history?devAuthBypass=1`
- Catatan:
  - `UCW-188` masih perlu dikerjakan terpisah untuk restore `bill_payment`

### [2026-04-21] `UCW-188` - Perbaiki restore `bill_payment` yang 200 tapi row tetap deleted
- Status: `validated`
- Ringkasan:
  - `api/records.js` sekarang membawa `deleted_at` keluar dari `mapBillPaymentRow`, sehingga `restoreBillPayment()` tidak lagi salah menganggap payment sudah aktif dan short-circuit sebelum update DB
  - smoke Chrome pada `Halaman Sampah` membuktikan item `SMOKE 2026-04-21 bill payment` benar-benar hilang dari list setelah restore dan row DB `deleted_at` berubah ke `null`
- File berubah:
  - `api/records.js`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - smoke browser restore `bill_payment` di `Halaman Sampah`
- Catatan:
  - `UCW-187` dan `UCW-188` sama-sama tertutup; task berikutnya di stream ini adalah `UCW-190` sampai `UCW-193`

### [2026-04-21] Brief follow-up dari smoke Chrome menyeluruh untuk create/edit/delete/restore/payroll/material flow
- Status: `planned`
- Ringkasan:
  - check DB menunjukkan user bypass lokal dari `OWNER_TELEGRAM_ID` sudah aktif sebagai `Owner` di `default-workspace`, jadi UI denial bukan berasal dari role seed lokal yang hilang
  - `Jurnal` / `Riwayat` dan restore `bill_payment` tetap gagal seperti audit sebelumnya, sementara smoke lanjutan menambah empat blocker baru: route create `EditRecordPage`, hydrate `Absensi Harian`, create `surat_jalan`, dan delete material invoice
  - create payment `bill`, create payment `loan`, archive payment `bill`, detail payroll harian, dan edit material invoice tetap lolos, jadi follow-up cukup fokus ke blocker yang benar-benar memutus flow
- Task baru:
  - `UCW-189`
  - `UCW-190`
  - `UCW-191`
  - `UCW-192`
  - `UCW-193`
- Catatan:
  - `UCW-187` dan `UCW-188` tetap aktif karena bug yang sama terulang di smoke terbaru
  - `UCW-190` sampai `UCW-193` memecah blocker baru supaya implementasi berikutnya tetap sempit dan bisa diaudit

### [2026-04-21] `UCW-189` - Audit smoke Chrome lanjutan untuk create/edit/delete/restore/payment/payroll/material flow
- Status: `validated`
- Ringkasan:
  - verifikasi DB menunjukkan identitas bypass lokal saat ini sudah punya membership aktif `Owner` di workspace default, jadi tidak ada blocker role seed baru yang perlu ditambahkan untuk melanjutkan smoke lokal
  - `Jurnal` / `Riwayat` tetap gagal dengan `User not allowed`, restore `bill_payment` baru (`6c221e2a-233a-4d62-b608-ede1b4d4405f`) tetap 200 tetapi `deleted_at` tidak hilang, create `surat_jalan` gagal `bills_status_check` 23514, delete material invoice gagal `materials.current_stock` not-null 23502, dan `attendance/new` tertahan di `Memuat worker dan absensi...` walau fetch master + attendance sudah 200
  - flow yang lolos pada smoke terbaru: create partial payment `bill`, archive payment `bill`, create partial payment `loan`, detail payroll harian, dan edit route material invoice
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `Dashboard` root tetap bisa bootstrap auth dan summary branch, tetapi branch workspace ledger masih meledak ke `UCW-187`
  - row `bill_payment` smoke terbaru tetap berada di recycle bin setelah restore, sehingga `UCW-188` terkonfirmasi belum tertutup
  - `attendance/new` memuat master data, worker, wage rate, dan `GET /api/records?resource=attendance` 200, tetapi UI tidak pernah menghydrate row worker sehingga create attendance dan follow-up rekap harian tertahan
  - wizard `material-invoice/new` berhasil sampai langkah akhir dan mode `Surat Jalan` bisa dipilih, tetapi submit masih mencoba insert `bills.status` yang melanggar constraint
  - tombol `Hapus` pada edit material invoice tidak memindahkan record ke recycle bin karena write path berhenti di null violation `materials.current_stock`
- Validasi:
  - browser smoke: `/?devAuthBypass=1`, `/transactions`, `/transactions/history`, `/pembayaran/tagihan/123dffad-32ee-499b-b92f-b3c1878c3f47`, `/pembayaran/pinjaman/e000833d-0ca6-414b-ae69-0c32665be77d`, `/transactions/recycle-bin`, `/payroll`, `/attendance/new`, `/material-invoice/new`, `/edit/expense/4a3243b7-eb8d-40ed-b04a-a3a4c36cb123`
  - audit DB: membership bypass lokal, row `bill_payment` smoke terbaru, row `loan_payment` smoke terbaru, dan state material invoice/bill terkait via Supabase SQL

### [2026-04-21] `UCW-190` - Pulihkan create route berbasis `EditRecordPage` yang menggantung pada `/edit/*/new`
- Status: `validated`
- Ringkasan:
  - smoke browser pada `/?devAuthBypass=1` lalu buka aksi cepat `Uang Keluar` berhasil mendarat ke `/edit/expense/new` tanpa crash, dan direct load `/edit/expense/new?devAuthBypass=1` serta `/edit/loan/new?devAuthBypass=1` juga merender form create dengan normal
  - console yang tersisa hanya `favicon.ico` 404 dan warning `HapticFeedback is not supported in version 6.0`, jadi tidak ada bukti hang atau crash pada route create saat ini
  - tidak ada patch runtime yang diperlukan; masalah yang sebelumnya terlihat tidak lagi ter-repro di server dev aktif
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - browser smoke direct: `/edit/expense/new?devAuthBypass=1`
  - browser smoke direct: `/edit/loan/new?devAuthBypass=1`
  - browser smoke quick action: `Buka aksi cepat` -> `Uang Keluar Catat pengeluaran`
- Catatan:
  - blocker berikutnya tetap `UCW-191`, `UCW-192`, dan `UCW-193`

### [2026-04-21] `UCW-191` - Perbaiki hydrate sheet `Absensi Harian` yang berhenti di state loading meski fetch master + attendance 200
- Status: `validated`
- Ringkasan:
  - root cause ada di `SmartList`: visible count sebelumnya diikat ke jumlah data saat mount, jadi page absensi sempat menganggap list kosong ketika row datang setelah fetch async selesai
  - `SmartList` sekarang menginisialisasi visible count dari `initialCount` sehingga data yang tiba belakangan tetap dirender tanpa memunculkan empty state palsu
  - smoke browser membuktikan `attendance/new` sudah menampilkan row worker dan tidak lagi tertahan di `Memuat worker dan absensi...`
- File berubah:
  - `src/components/ui/SmartList.jsx`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - smoke browser `GET /attendance/new?devAuthBypass=1`
- Catatan:
  - task berikutnya di stream ini adalah `UCW-192`

### [2026-04-21] `UCW-192` - Perbaiki create `surat_jalan` yang masih memicu `bills_status_check` 23514 di `material-invoices`
- Status: `validated`
- Ringkasan:
  - root cause pertama yang terbalik adalah trigger `bills_status_check` di flow create, lalu root cause kedua adalah sync stock manual yang masih ikut mengerjakan create path dan menabrak patch `materials.current_stock`
  - `api/records.js` sekarang menahan `syncMaterialInvoiceStockMovement()` pada mode create, sehingga create `Surat Jalan` cukup memakai trigger line-item yang sudah ada dan tidak lagi memunculkan PATCH materials invalid
  - smoke browser membuktikan `material-invoice/new` mode `Surat Jalan` berhasil disimpan dan menampilkan sukses tanpa error 23514 atau 23502
- File berubah:
  - `api/records.js`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - smoke browser `GET /material-invoice/new?devAuthBypass=1`
  - audit DB `expenses`, `expense_line_items`, `stock_transactions`, dan `materials.current_stock`
- Catatan:
  - smoke create meninggalkan beberapa row uji `Surat jalan material baru` dari percobaan gagal sebelumnya; itu artefak smoke, bukan blocker baru

### [2026-04-21] `UCW-193` - Perbaiki soft delete `material invoice` yang gagal rollback stok dengan `materials.current_stock` null violation
- Status: `validated`
- Ringkasan:
  - `api/records.js` sekarang memindahkan rollback stok material invoice delete ke function SQL atomic `fn_reverse_material_invoice_stock_movement()`, sehingga soft delete tidak lagi memecah state ketika rollback `materials.current_stock` dijalankan
  - function baru dieksekusi lewat `adminClient.rpc()` dengan grant yang sesuai untuk jalur authenticated dev, lalu smoke delete pada `/edit/expense/b666dd7a-7c76-475f-af8a-c8f31b64d7db?devAuthBypass=1` berhasil menandai record ke recycle bin tanpa error 23502
  - DB terverifikasi: expense `b666dd7a-7c76-475f-af8a-c8f31b64d7db` menjadi soft-deleted, `stock_transactions` untuk expense itu bersih, dan `materials.current_stock` untuk `Semen` kembali ke `2496.000`
- File berubah:
  - `api/records.js`
  - `supabase/migrations/20260421101000_reverse_material_invoice_stock_on_delete.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - smoke browser delete material invoice via `DELETE /api/records?resource=material-invoices`
  - browser reload edit page lalu verifikasi tombol berubah ke `Restore`
  - audit DB `expenses`, `stock_transactions`, dan `materials.current_stock`

### [2026-04-21] Brief Global Toast dan keyboard-aware bottom nav
- Status: `planned`
- Ringkasan:
  - perlu satu `GlobalToast` reusable yang mobile-first untuk semua notif in-app dan fallback transient
  - toast harus safe-area aware, ringkas, token-based, dan nyaman dipakai di Telegram Mini Web App
  - bottom nav di halaman `Jurnal` harus tetap docked atau disembunyikan saat filter fokus di mobile supaya keyboard tidak membuat layout terasa pengap
- Task baru:
  - `UCW-184`
  - `UCW-185`
  - `UCW-186`
- Catatan:
  - `UCW-184` jadi fondasi visual/contract
  - `UCW-185` migrasi callsite notif dan fallback
  - `UCW-186` menangani perilaku bottom nav saat keyboard aktif di `Jurnal`

### [2026-04-21] Brief Chrome smoke audit dengan bypass auth lokal sementara
- Status: `planned`
- Ringkasan:
  - auth Telegram masih menjadi blocker utama verifikasi browser lokal karena app menolak bootstrap di luar Mini App
  - diperlukan bypass dev/local yang tetap membuat session Supabase nyata lewat `/api/auth`, bukan mock state client yang memotong boundary runtime
  - setelah bypass aktif, audit Chrome harus memetakan boundary pertama yang rusak pada `Dashboard`, `Jurnal`, detail/edit, `Pembayaran`, `Dokumen Barang`, `Halaman Sampah`, dan restore, lalu memecah follow-up task spesifik
- Task baru:
  - `UCW-182`
  - `UCW-183`
- Catatan:
  - `UCW-182` menjadi task implementasi aktif; `UCW-183` menunggu hasil bypass tervalidasi sebelum audit browser dijalankan

### [2026-04-21] Brief follow-up dari smoke audit Chrome core CRUD/payment
- Status: `planned`
- Ringkasan:
  - `Dashboard`, `Jurnal`, dan `Riwayat` masih gagal memuat read model workspace/history dengan 500 `User not allowed` meski session owner valid sudah aktif
  - restore `bill_payment` dari `Halaman Sampah` merespons 200, tetapi row tetap deleted sehingga item tidak keluar dari recycle bin
  - create/archive payment bill-loan, read `Halaman Sampah`, edit expense, dan edit material invoice sudah lolos smoke sehingga follow-up cukup fokus pada dua blocker nyata itu
- Task baru:
  - `UCW-187`
  - `UCW-188`
- Catatan:
  - smoke audit meninggalkan dua row uji bertanda `SMOKE UCW-183*` di recycle bin: satu `bill_payment` dan satu `loan_payment`

### [2026-04-21] `UCW-183` - Audit smoke Chrome untuk core CRUD, payment, dan restore pasca bypass lokal
- Status: `validated`
- Ringkasan:
  - smoke audit browser dengan `?devAuthBypass=1` membuktikan `Dashboard` summary branch, payment bill/loan detail, create partial payment, archive payment, `Halaman Sampah`, edit expense, dan edit material invoice bisa dibuka dengan session Supabase nyata
  - `Jurnal` dan `Riwayat` gagal pada boundary `/api/transactions?view=workspace|history` dengan 500 `User not allowed`, sementara `Halaman Sampah` tetap 200 pada `view=recycle-bin`
  - restore `bill_payment` lewat `Halaman Sampah` merespons 200 tetapi row `78439d44-0dd0-4b17-be59-0ef200e79f1f` tetap memiliki `deleted_at`, sehingga recycle bin tidak sinkron dengan hasil aksi
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `Dashboard` tetap menampilkan summary/loan branch, tetapi branch workspace ledger gagal karena read model transaksi
  - create + archive payment `bill` dan `loan` berhasil; notifikasi `/api/notify` juga merespons 200 pada dua flow itu
  - smoke row bertanda `SMOKE UCW-183` saat ini berada di recycle bin dan dipakai sebagai bukti audit restore/archive
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - browser smoke: `/?devAuthBypass=1`, `/transactions`, `/transactions/history`, `/pembayaran/tagihan/123dffad-32ee-499b-b92f-b3c1878c3f47`, `/pembayaran/pinjaman/e000833d-0ca6-414b-ae69-0c32665be77d`, `/edit/expense/19468f63-896d-4946-997c-8fdb2bd63714`, `/edit/expense/4a3243b7-eb8d-40ed-b04a-a3a4c36cb123`, `/transactions/recycle-bin`

### [2026-04-21] `UCW-182` - Tambahkan bypass auth Telegram lokal untuk smoke test browser
- Status: `validated`
- Ringkasan:
  - auth store sekarang bisa mengaktifkan bypass dev lokal lewat `?devAuthBypass=1` yang dipersist ke `sessionStorage`, sehingga refresh/tab yang sama tidak kembali mentok di gate Telegram-only
  - `/api/auth` sekarang menerima bypass lokal khusus localhost/development dan tetap membuat session Supabase nyata memakai identitas owner env, bukan mock state client
  - jalur auth production tetap utuh karena bypass tidak aktif tanpa flag explicit di browser lokal
- File berubah:
  - `src/lib/dev-auth-bypass.js`
  - `src/store/useAuthStore.js`
  - `api/auth.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `rg -n "devAuthBypass|mockTelegram|verify_dev_bypass|Aplikasi ini hanya bisa diakses dari Telegram Mini App" src api docs`
  - `npm.cmd run lint`
  - `npm run build`
  - browser smoke auth: buka `http://127.0.0.1:3000/?devAuthBypass=1` dan verifikasi `POST /api/auth` merespons 200

### [2026-04-21] `UCW-181` - Selaraskan rekap payroll dengan eligible rows server dan deskripsi tagihan final
- Status: `validated`
- Ringkasan:
  - `createAttendanceRecap` sekarang membangun `p_description` dari eligible rows final server, bukan dari description client yang bisa stale
  - `PayrollPage` sekarang memakai `attendanceCount` dan `totalAmount` server untuk notify Telegram serta toast hasil, termasuk partial recap
  - partial recap dihitung dari hasil server yang benar-benar diproses, bukan dari kelompok awal client
- File berubah:
  - `src/pages/PayrollPage.jsx`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - audit source dengan `rg -n "generateSalaryBillForGroup|createAttendanceRecap|attendanceCount|totalAmount|fn_generate_salary_bill" src api supabase/migrations`
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-21] `UCW-180` - Seragamkan payload notifikasi `Pembayaran` ke truth server pasca write
- Status: `validated`
- Ringkasan:
  - `submitBillPayment` dan `submitLoanPayment` sekarang memakai response final `payment` + parent server untuk membangun payload Telegram
  - `recalculateBillPaymentSummary` dan `syncLoanStatusFromPayments` menyalurkan field parent yang dibutuhkan notifikasi sehingga sisa nominal dibaca dari server truth
  - payload notifikasi tidak lagi bergantung pada `remainingAmount` hasil hitung client pra-submit
- File berubah:
  - `src/store/usePaymentStore.js`
  - `api/records.js`
  - `api/transactions.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - audit source payload notify dan shape response server final
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-21] `UCW-177` - Audit dan perbaiki RLS `stock_transactions` agar simpan faktur/material invoice tidak gagal `42501`
- Status: `validated`
- Ringkasan:
  - `stock_transactions` kini punya policy `insert`, `update`, dan `delete` selain `select`, semuanya mengikat akses ke material/team scope yang sama
  - jalur save faktur/material invoice yang memakai delete + upsert tidak lagi bergantung pada policy `select` saja
  - root cause ada di gap RLS, bukan di form atau store
- File berubah:
  - `supabase/migrations/20260411190000_setup_telegram_auth_rbac_rls.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - audit policy `stock_transactions`
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-21] `UCW-179` - Tutup celah overpayment saat edit/restore pembayaran `loan` dan `bill`
- Status: `validated`
- Ringkasan:
  - `updateLoanPayment` dan `updateBillPayment` sekarang memblokir update yang membuat total sibling aktif melebihi target parent
  - `restoreLoanPayment` dan `restoreBillPayment` sekarang memblokir pemulihan payment yang akan overpay parent
  - create/update/restore untuk `bill_payment` dan `loan_payment` kini punya aturan server yang seragam, sementara optimistic concurrency tetap dipertahankan
- File berubah:
  - `api/transactions.js`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - audit source dengan `rg -n "createLoanPayment|updateLoanPayment|restoreLoanPayment|createBillPayment|updateBillPayment|restoreBillPayment" api src`
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-21] `UCW-178` - Audit delivery notifikasi create `loan` dan surface kegagalan `/api/notify` dari entrypoint aktif
- Status: `validated`
- Ringkasan:
  - create `loan` tetap menyimpan record walau `POST /api/notify` gagal
  - helper notifikasi di `useIncomeStore` sekarang menangkap error Telegram sebagai warning yang bisa disurface ke form
  - parser `notificationType: 'loan'` di `api/notify.js` sudah cocok dengan payload dari store, jadi masalahnya ada di sinkronisasi delivery, bukan format payload
- File berubah:
  - `src/store/useIncomeStore.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - audit entrypoint create loan end-to-end
  - cek payload `notificationType: 'loan'` dan parser `api/notify.js`
  - `npm.cmd run lint`
  - `npm run build`

## Entries

### [2026-04-21] `UCW-176` - Seragamkan komposisi row list global dan hilangkan tombol `More`
- Status: `validated`
- Ringkasan:
  - `ActionCard` sekarang full-click dan membuka bottom sheet aksi dari tap row, tanpa kebab `More`
  - `Dashboard`, `Jurnal`, `Riwayat`, dan `Recycle Bin` memakai komposisi row yang sama: icon, title, tanggal, nominal, badge creator
  - backend transaksi sekarang mengisi `creator_display_name` dari metadata auth/profile agar badge tidak bergantung pada Telegram ID mentah
- File berubah:
  - `src/components/ui/ActionCard.jsx`
  - `src/pages/Dashboard.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `src/components/PayrollAttendanceHistory.jsx`
  - `api/transactions.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - surface yang sebelumnya masih punya kebab `More` sekarang membuka bottom sheet aksi saat row ditekan
  - row list transaksi/history/recycle bin menampilkan creator badge yang readable jika metadata auth/profile tersedia; fallback tetap aman ke `Sistem` / `User <id>` bila data creator tidak lengkap
  - komposisi row sekarang seragam di surface yang discope tanpa menyentuh backend/route yang dilarang
- Validasi:
  - `rg -n "MoreVertical|AppSheet|selectedActionTransaction|selectedRecord|setSelectedRecord|setSelectedActionTransaction" src/pages/HistoryPage.jsx src/pages/TransactionsPage.jsx src/pages/TransactionsRecycleBinPage.jsx src/components/PayrollAttendanceHistory.jsx src/components/ui/ActionCard.jsx`
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser check belum bisa ditutup karena browser backend lokal sempat tidak tersedia / dev server tidak berhasil dipertahankan hidup dalam sandbox ini
- Risiko/regresi:
  - transaksi list sekarang bergantung pada metadata auth/profile untuk badge nama; bila metadata tidak ada, fallback tetap tampil tetapi nama spesifik bisa hilang
  - `ActionCard` kini seluruh row clickable, jadi layout yang menanamkan interaksi lain di dalam row perlu tetap menghindari nested interactive element

### [2026-04-21] Audit kontrak core release CRUD / payment / rekap terhadap freeze
- Status: `planned`
- Ringkasan:
  - route aktif untuk `Pengeluaran`, `Dokumen Barang`, `Pemasukan Proyek`, `Pinjaman`, `Pembayaran`, `Halaman Absensi`, `Catatan Absensi`, `Tagihan Upah`, dan `Reports` sudah mengikuti pola freeze `read direct or server read model` lalu `write API only`; direct Supabase yang tersisa masih berada di boundary transisional yang memang sudah dibekukan
  - release core belum aman untuk production karena masih ada blocker konkret: gap RLS `stock_transactions`, celah overpayment pada edit/restore payment, payload notifikasi payment yang masih memakai state client pra-submit, dan rekap payroll yang bisa menyimpan deskripsi atau jumlah absensi yang tidak sama dengan row eligible final
  - issue "chat bot loan create tidak muncul" belum terbukti berasal dari entrypoint create yang hilang; source runtime menunjukkan trigger notify sudah ada, tetapi delivery `/api/notify` masih fire-and-forget dan silent jika gagal
- Task direvisi:
  - `UCW-178`
- Task baru:
  - `UCW-179`
  - `UCW-180`
  - `UCW-181`
- Catatan:
  - backlog diselaraskan ke blocker kontrak yang terverifikasi dari source aktif dan freeze, supaya agent implementasi berikutnya tidak mengejar asumsi yang tidak terbukti

### [2026-04-21] Brief follow-up untuk error save faktur `stock_transactions` dan notifikasi loan create
- Status: `planned`
- Ringkasan:
  - save faktur/material invoice masih memunculkan `42501` pada jalur `stock_transactions`, yang mengarah ke gap policy RLS pada insert/upsert
  - create `loan` perlu diaudit lagi di jalur `LoanForm -> useIncomeStore -> /api/notify` supaya notifikasi Telegram benar-benar terkirim dan bukan hanya lolos create record
- Task baru:
  - `UCW-177`
  - `UCW-178`
- Catatan:
  - belum ada patch runtime; brief ini hanya mencatat sumber masalah dan memecahnya menjadi dua micro-task terpisah

### [2026-04-21] `UCW-174` - Rekonsiliasi freeze package dengan backlog dan release pattern akhir
- Status: `validated`
- Ringkasan:
  - wording freeze, plan, dan progress log sekarang membedakan tegas `Payment Receipt PDF` sebagai output settlement dari `Pembayaran` dan `pdf_settings` sebagai boundary konfigurasi PDF bisnis user-facing
  - istilah `Referensi` / `Master`, `Riwayat` / `Recycle Bin`, `Catatan Absensi`, `Tagihan Upah`, `Dokumen Barang`, dan `Stok Barang` sekarang dipetakan konsisten di package freeze dan backlog operasional
  - release order dan blocker final ditulis eksplisit: core blocker yang sudah tertutup tetap tidak dihitung ulang, sementara boundary transitional tetap dicatat sebagai exception runtime, bukan pola inti
- File berubah:
  - `docs/freeze/02-prd-master.md`
  - `docs/freeze/03-source-of-truth-contract-map.md`
  - `docs/freeze/05-ai-execution-guardrails.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `Payment Receipt PDF` tidak lagi bercampur dengan `pdf_settings`; receipt settlement dan konfigurasi PDF bisnis sekarang punya boundary yang berbeda
  - `Referensi` tetap diperlakukan sebagai nama produk final, sementara `Master` tetap terbaca sebagai alias internal/legacy di contract map
  - `Riwayat` tetap completed/history surface dan `Recycle Bin` tetap deleted/recovery surface; `Catatan Absensi`, `Tagihan Upah`, `Dokumen Barang`, dan `Stok Barang` juga tetap berada pada boundary freeze yang sama
- Validasi:
  - `rg -n "Payment Receipt PDF|pdf_settings|Referensi|Master|Riwayat|Recycle Bin|Catatan Absensi|Tagihan Upah|Dokumen Barang|Stok Barang|release order|blocker" docs/freeze docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`
- Risiko/regresi:
  - perubahan ini hanya menyentuh docs, jadi risiko runtime nol; satu-satunya risiko adalah jika ada dokumen turunan lain yang masih memakai istilah receipt/config PDF secara tercampur dan belum ikut dibersihkan

### [2026-04-21] `UCW-173` - Ringankan first paint list `Jurnal` / `Riwayat` / `Halaman Sampah` / `Catatan Absensi` dengan detail on-demand
- Status: `blocked`
- Ringkasan:
  - payload first paint untuk `Jurnal`, `Riwayat`, `Halaman Sampah`, dan `Catatan Absensi` dipangkas dengan menghapus metadata label/badge detail dari list row path
  - `TransactionDetailPage` sekarang memuat satu record on-demand dari endpoint detail per-surface, lalu baru memuat child detail yang memang dibutuhkan saat item dibuka
  - `Catatan Absensi` memakai query history yang lebih ringan; `Halaman Sampah` dan detail deleted tetap memakai fetch on-demand per record
- File berubah:
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/lib/transactions-api.js`
  - `src/lib/records-api.js`
  - `api/transactions.js`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - bottleneck first paint yang paling nyata adalah merge metadata creator dan ledger summary pada list surface, ditambah query attendance history yang terlalu detail untuk list awal
  - list surface kini hanya memuat snapshot/minimal field untuk render awal, sedangkan metadata detail dipindah ke detail route/sheet yang dimuat saat user membuka item
  - on-demand detail fetch untuk transaksi/history/recycle-bin sudah aktif, termasuk single-record fetch dari API untuk menghindari hydration list penuh di page detail
- Validasi:
  - `rg -n "ledger_summary|creatorMetadata|salary_bill|detailRoute|fetchAttendanceHistoryFromApi|fetchWorkspaceTransactionPageFromApi|fetchHistoryTransactionPageFromApi|fetchRecycleBinPageFromApi" src api docs`
  - `npm.cmd run lint`
  - `npm run build`
  - manual timing compare: dev server berhasil dinyalakan, tetapi sandbox browser gagal menjangkau `127.0.0.1:4173`, jadi pembandingan first paint belum bisa ditutup dari environment ini
- Risiko/regresi:
  - detail route sekarang bergantung pada on-demand fetch per record; jika endpoint detail gagal, page detail akan menampilkan fallback error lebih cepat daripada sebelumnya
  - penghilangan metadata dari list meningkatkan ketergantungan UI detail/sheet untuk label tambahan yang sebelumnya ikut terhydrate di list

### [2026-04-21] `UCW-172` - Selaraskan write contract `expense_type` saat simpan faktur agar check constraint tidak gagal
- Status: `blocked`
- Ringkasan:
  - jalur save material invoice sekarang menulis `expense_type='material'` secara canonical di store dan API, sehingga constraint `expenses_expense_type_check` tidak lagi dipicu oleh nilai `material_invoice`
  - freeze contract dan plan backlog sudah diselaraskan agar canonical write value tidak drift dari schema final, sementara row legacy `material_invoice` tetap dibaca untuk kompatibilitas
- File berubah:
  - `src/store/useTransactionStore.js`
  - `api/records.js`
  - `docs/freeze/03-source-of-truth-contract-map.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - audit write contract menunjukkan mismatch lama berasal dari fallback `material_invoice` di jalur save material invoice
  - canonical write sekarang sudah selaras dengan schema final `expenses_expense_type_check`
  - read path legacy tetap aman karena filter kompatibilitas masih menerima `material_invoice`
- Validasi:
  - `rg -n "expense_type|expenseType|getMaterialInvoiceExpenseType|expenses_expense_type_check|material_invoice|material\\b" src api supabase docs`
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser check: dev server lokal berhasil dinyalakan, tetapi sandbox browser gagal menjangkau `127.0.0.1:5173`, sehingga save faktur/surat jalan tidak bisa diverifikasi end-to-end dari browser tool
- Risiko/regresi:
  - perubahan canonical write bisa memengaruhi laporan atau filter yang masih terlalu agresif menganggap `material_invoice` sebagai satu-satunya nilai tulis
  - jika ada client lama yang mengirim payload langsung ke API dengan `material_invoice`, API sekarang akan menormalkannya sebagai `material` dan itu memang disengaja

### [2026-04-21] `UCW-175` - Pastikan notifikasi loan create tetap audit-passed dan sediakan PDF receipt user-facing terpisah dari PDF bisnis
- Status: `blocked`
- Ringkasan:
  - audit loan create menunjukkan hanya ada satu entrypoint valid melalui `LoanForm -> addLoan`, dan flow itu sudah menempel `notifyTelegram(buildLoanNotificationPayload(...))`, jadi tidak ada reimplementasi notify yang diperlukan
  - payment history di `PaymentPage` sekarang punya tombol `Kwitansi PDF` untuk bill dan loan payment, dengan helper PDF terpisah di `src/lib/report-pdf.js`
  - kwitansi Telegram di `api/notify.js` tetap dipertahankan sebagai artefak document terpisah, bukan digabung ke receipt user-facing
- File berubah:
  - `src/lib/report-pdf.js`
  - `src/pages/PaymentPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - audit coverage loan notify sudah pass: entrypoint create loan yang valid tetap satu jalur dan sudah terpasang notifikasi Telegram
  - receipt PDF user-facing sudah tersedia dari payment history tanpa mengubah kontrak payment/loan yang sudah divalidasi
  - boundary Telegram document kwitansi tetap terpisah dari receipt PDF user-facing, sehingga bisnis PDF UCW-88 tidak tercampur
- Validasi:
  - `rg -n "notifyTelegram|buildLoanNotificationPayload|buildPaymentNotificationPayload|kwitansi|receipt|pdf" src api docs`
  - `npm.cmd run lint`
  - `npm run build`
  - manual browser check: bootstrapping auth/route mock untuk render PaymentPage dan klik receipt tidak bisa diselesaikan stabil; environment browser tetap kembali ke denied/error state sebelum tombol receipt bisa diverifikasi end-to-end
- Risiko/regresi:
  - receipt button kini bergantung pada render PaymentPage yang hanya muncul setelah record payment termuat; jika auth/bootstrap browser environment tidak lengkap, UI receipt tidak bisa diverifikasi secara manual
  - helper PDF baru menambah surface download di payment history, tetapi tidak mengubah flow create/update/delete payment

### [2026-04-21] `UCW-171` - Buka create/edit `Barang` di master/reference dengan backing contract `materials`
- Status: `blocked`
- Ringkasan:
  - tab `Barang` ditambahkan di master/reference dengan contract internal `materials`, route legacy `material` tetap dikenali, dan label user-facing recycle bin disinkronkan ke `Barang`
  - `MasterFormPage` kini me-hydrate `materials` ke collections dan me-remount form generic saat record edit baru tersedia, supaya create/edit barang tidak tergantung state kosong saat bootstrap
  - validasi unit/build lulus, tetapi manual check browser untuk membuka `/master`, menyimpan barang baru, lalu membuktikan item picker faktur belum bisa diselesaikan karena server lokal tidak reachable
- File berubah:
  - `src/components/master/masterTabs.js`
  - `src/pages/MasterFormPage.jsx`
  - `src/pages/MasterRecycleBinPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `Barang` sekarang memakai backing contract `materials` tanpa rename internal, dan deep link legacy `/master/material` tetap tetap valid lewat matcher route
  - edit generic master form tidak lagi rawan menempel pada state kosong ketika record material datang terlambat dari hydration store
  - recycle bin material tidak lagi tampil sebagai `Material` di surface user-facing
- Validasi:
  - `rg -n "materials|material|Barang|masterTabs|MasterFormPage|fetchMaterials|addMaterial|updateMaterial|deleteMaterial" src/components/master/masterTabs.js src/pages/MasterFormPage.jsx src/pages/MasterRecycleBinPage.jsx docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - canonical route baru `barang` tetap harus diawasi bila ada deep link eksternal yang hardcode `/master/material`; matcher masih menerima route lama, tetapi UI kini menavigasi ke route baru
  - manual verification browser tetap belum selesai sampai server lokal bisa diakses

### [2026-04-21] `UCW-89` - Hardening mobile-first dan scalable data untuk release core
- Status: `validated`
- Ringkasan:
  - ledger transaction sekarang memecah area klik utama dan area aksi agar tampilan tetap terbaca di layar kecil
  - master picker menampilkan label dan deskripsi tanpa truncation agresif, sehingga data besar lebih gampang dipilih di mobile
  - hardening tetap di boundary helper dan page list yang dipakai langsung, tanpa mengubah kontrak report, PDF, atau API
- File berubah:
  - `src/pages/TransactionsPage.jsx`
  - `src/components/ui/MasterPickerField.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - card ledger kini lebih stabil di mobile karena isi dan aksi tidak saling menekan di satu baris sempit
  - picker master tidak lagi menyembunyikan deskripsi data yang relevan
  - perubahan tidak menyentuh `useReportStore`, `ProjectReport`, atau artefak PDF yang sudah dikunci oleh task sebelumnya
- Validasi:
  - `rg -n "MasterPickerField|AppWrapToggleGroup|AppToggleGroup|TransactionsPage|flex flex-col gap-3 sm:flex-row|selectedOption\\.description|option\\.description" src/components/ui/MasterPickerField.jsx src/pages/TransactionsPage.jsx src/components/ui/AppPrimitives.jsx`
  - `npm.cmd run lint`
  - `npm run build`
- Risiko/regresi:
  - informasi yang lebih lengkap di picker dan ledger meningkatkan tinggi kartu pada layar sangat kecil, tetapi tidak mengubah contract data atau write path

### [2026-04-20] `UCW-88` - Deliver PDF bisnis user-facing dan `pdf_settings` dari app
- Status: `validated`
- Ringkasan:
  - `ProjectReport` sekarang punya boundary PDF bisnis yang bisa diunduh dari app, dan pengaturannya ditanam di card terpisah sebagai source of truth `pdf_settings`
  - `useReportStore` menambah fetch/save `pdf_settings` dan generator PDF bisnis client-side tanpa mengubah kontrak report server untuk `UCW-87`
  - API `records` menambah resource `pdf-settings` yang read/write ke `public.pdf_settings` dengan team access yang sama
- File berubah:
  - `src/store/useReportStore.js`
  - `src/components/ProjectReport.jsx`
  - `src/lib/reports-api.js`
  - `src/lib/report-pdf.js`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - PDF bisnis tidak lagi bergantung pada artifact notifikasi Telegram sebagai satu-satunya jalur PDF
  - boundary `pdf_settings` kini user-facing dan tetap terpisah dari kontrak report server `UCW-87`
  - export PDF memakai summary proyek dan portfolio overview yang sudah ada tanpa refactor report besar
- Validasi:
  - `rg -n "pdf_settings|pdf-settings|pdfSettings|header_color|downloadBusinessReportPdf|savePdfSettings|fetchPdfSettings" src api docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`
  - `rg -n "ProjectReport|useReportStore|fetchPdfSettingsFromApi|savePdfSettingsFromApi|createBusinessReportPdf|saveBusinessReportPdf" src`
  - `npm.cmd run lint`
  - `npm run build`
- Risiko/regresi:
  - PDF generator client-side masih bergantung pada data report yang sudah dimuat; jika summary belum selesai dimuat, export bisa menghasilkan dokumen kosong atau default

### [2026-04-20] `UCW-86` - Finalkan attachment platform lintas core feature termasuk bukti bayar
- Status: `validated`
- Ringkasan:
  - attachment section sekarang bisa dipakai pada payment page bill lewat parent expense bill, sehingga bukti bayar tidak lagi terpisah dari policy upload/preview yang sudah dipakai expense dan invoice
  - lifecycle permanent delete dipisah dari cleanup orphan: UI recycle attachment hanya muncul di row terhapus, sementara purge orphan pasca attach gagal memakai helper internal yang tidak mengubah contract recycle bin
  - permanen delete attachment tetap mengikuti role matrix attachment yang sama, jadi policy seragam lintas core feature tanpa menambah contract baru
- File berubah:
  - `src/store/useFileStore.js`
  - `src/components/ExpenseAttachmentSection.jsx`
  - `src/pages/PaymentPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - upload, preview, attach, restore, dan purge orphan tetap berjalan di boundary attachment yang sama
  - payment page bill kini punya surface attachment untuk bukti bayar berbasis expense parent yang sudah ada
  - permanent delete tidak lagi tampil pada attachment aktif, sehingga cleanup orphan dan recycle-bin semantics tidak drift
- Validasi:
  - `rg -n "ATTACHMENT_ROLE_MATRIX|attachment-policy|purgeFileAsset|permanentDeleteFileAsset|ExpenseAttachmentSection|expenseId=\\{billExpenseId\\}" src api`
  - `npm.cmd run lint`
  - `npm run build`
- Risiko/regresi:
  - bill payment proof tetap menumpang ke parent expense bill; jika nanti diperlukan bukti bayar pada loan payment, itu masih butuh contract/schema terpisah

### [2026-04-20] `UCW-85` - Seragamkan `soft delete`, `restore`, dan `permanent delete` lintas domain inti
- Status: `validated`
- Ringkasan:
  - backend transaksi kini menempelkan flag lifecycle eksplisit pada row recycle bin, sehingga detail deleted transaction bisa membedakan aksi restore dan permanent delete tanpa asumsi liar
  - recycle bin transaction dan detail deleted transaction hanya menampilkan `Hapus Permanen` saat contract final mengizinkan, sementara attachment recycle bin menolak purge permanen bila row belum ada di deleted state
  - policy task stream diperbarui agar `UCW-90` kembali tercatat blocked pada dependency yang memang masih tersisa
- File berubah:
  - `api/transactions.js`
  - `api/records.js`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `src/pages/DeletedTransactionDetailPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - permanent delete tidak lagi muncul di detail deleted transaction jika row tidak membawa izin contract
  - attachment permanent delete tidak bisa dipanggil dari state aktif yang belum masuk recycle bin
  - status backlog stream selaras lagi dengan freeze baseline dan dependency core release
- Validasi:
  - `rg -n "soft delete|restore|permanent delete|Recycle Bin|deleted_at|restore" api src docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`
  - `npm.cmd run lint`
  - `npm run build`
- Risiko/regresi:
  - UI detail recycle bin kini bergantung lebih ketat pada flag lifecycle dari API; bila ada row legacy tanpa flag, aksi permanent delete akan tersembunyi sampai response distandarkan

### [2026-04-20] `UCW-169` - Pusatkan boundary `auth/workspace` dan `master` agar runtime exception tidak menyebar
- Status: `validated`
- Ringkasan:
  - capability contract kini jadi source tunggal untuk gate `Tim` dan `Master`
  - `ProtectedRoute`, page entry, `useTeamStore`, `useMasterStore`, `api/auth.js`, dan `api/records.js` membaca contract yang sama
  - direct-write `Tim` dan `Master` tetap dianggap runtime exception transitional dan kini terisolasi sebagai boundary eksplisit, bukan pola inti release
- File berubah:
  - `src/lib/capabilities.js`
  - `src/components/ProtectedRoute.jsx`
  - `src/store/useTeamStore.js`
  - `src/store/useMasterStore.js`
  - `src/pages/TeamInvitePage.jsx`
  - `src/pages/MasterPage.jsx`
  - `src/pages/MasterFormPage.jsx`
  - `src/pages/MasterRecycleBinPage.jsx`
  - `src/components/MasterDataManager.jsx`
  - `src/pages/StockPage.jsx`
  - `src/pages/PayrollPage.jsx`
  - `api/auth.js`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `team_invite` dan `master_data_admin` sekarang hadir sebagai contract eksplisit di `src/lib/capabilities.js`
  - UI gate page dan `ProtectedRoute` membaca contract yang sama; fallback denial message mengikuti metadata contract
  - `useTeamStore` dan `useMasterStore` menolak direct write ketika role tidak punya capability, sehingga exception runtime tidak menyebar ke caller yang tidak terproteksi
  - `api/records.js` manual stock-out tetap memakai contract helper yang sama; `api/auth.js` sekarang mengandalkan source role list bersama dari `src/lib/rbac.js`
  - residual literal capability yang masih hardcoded di `src/components/MasterDataManager.jsx` dan `src/pages/StockPage.jsx` sudah diganti menjadi reference contract eksplisit
  - tidak ada replacement lain yang dipaksa untuk literal tanpa mapping contract resmi; sisa literal non-capability tetap ditinggalkan sebagai legacy bila ada
  - repo-wide sweep lanjutan menutup literal `payroll_access` di `src/pages/PayrollPage.jsx` dengan reference contract yang sama
  - sweep non-capability berikutnya hanya menormalkan direct owner-check literal di `src/store/useAuthStore.js`, `src/components/ui/ActionCard.jsx`, dan `src/components/TeamInviteManager.jsx`; page-level `allowedRoles` arrays di `AttendancePage`, `HrdPage`, `BeneficiariesPage`, `ProjectsPage`, dan `MaterialInvoicePage` tetap residual legacy karena tidak ada role-group contract resmi yang bisa dipetakan langsung
  - lima residual page-level `allowedRoles` itu dibekukan sebagai explicit legacy gates; jangan diformalisasi lagi kecuali freeze menambahkan contract resmi baru untuk role-group tersebut
- Validasi:
  - `rg -n "capabilityContracts|assertCapabilityAccess|getCapabilityContract|team_invite|master_data_admin|canUseCapability" src/lib/capabilities.js src/components/ProtectedRoute.jsx src/pages/TeamInvitePage.jsx src/pages/MasterPage.jsx src/pages/MasterFormPage.jsx src/pages/MasterRecycleBinPage.jsx src/store/useTeamStore.js src/store/useMasterStore.js api/auth.js api/records.js`
  - `rg -n "team_invite|master_data_admin|manual_stock_out|capabilityContracts|requiredCapability|canUseCapability" src/components/MasterDataManager.jsx src/pages/StockPage.jsx src/lib/capabilities.js`
  - `rg -n "team_invite|master_data_admin|manual_stock_out|payroll_access|requiredCapability|canUseCapability|assertCapabilityAccess" src`
  - `npm.cmd run lint`
  - `npm run build`
- Risiko/regresi:
  - direct-write Master/Tim masih transitional; jika ada consumer di luar page gate atau store boundary, mereka sekarang menerima error akses yang lebih eksplisit daripada silent failure
  - helper gate baru bergantung pada auth context yang benar; jika auth state belum terbootstrap, write guard akan menolak lebih awal

### [2026-04-20] `UCW-90` - Audit release readiness core feature end-to-end (backend + frontend)
- Status: `validated`
- Ringkasan:
  - backend API/RPC, frontend route/store/component, dan migration/schema untuk core feature akan diaudit against freeze contract
  - task ini sempat dipindahkan sementara ke `deferred` karena brief boundary centralization `UCW-169` diprioritaskan; audit sekarang resumed memakai baseline final
  - output task ini harus berupa gap matrix, urutan micro-task implementasi, dan daftar blocker release inti; audit final menyimpulkan blocker inti sudah tertutup dan yang tersisa hanya boundary transitional exception
  - stream dibalik ke tujuan inti release sesuai `docs/freeze/*` agar implementasi berikutnya tidak berjalan tanpa prioritas yang jelas
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - freeze package sudah memisahkan core domain, transitional boundary, dan legacy surface; audit ini tinggal mengubahnya menjadi backlog release terurut
  - surface backend yang harus dipetakan untuk core release: `api/auth.js`, `api/records.js`, `api/transactions.js`, dan `supabase/migrations/*`
  - surface frontend yang harus dipetakan untuk core release: `src/App.jsx`, `src/pages/*`, `src/store/*`, `src/components/*`, dan layout shell
  - audit final memetakan `Dashboard`, `Jurnal`, `Pembayaran`, `Attendance`, dan `Reports` sebagai aligned dengan freeze contract; `Master`, `Attachment`, `auth/workspace`, dan `HRD`/`File`/generate payroll tetap tercatat sebagai transitional exception runtime yang tidak dihitung sebagai blocker; `Stok Barang` tetap supporting aligned
  - `auth/workspace` sekarang dibaca sebagai boundary eksplisit: `api/auth.js` tetap boundary bootstrap utama, sementara direct-write `Tim` di store diperlakukan sebagai exception runtime yang terisolasi
  - direct Supabase write/RPC pada `Tim`, `Referensi`, `HRD`, `File`, dan generate payroll tetap tercatat sebagai transitional boundary; ini harus tetap diperlakukan sebagai exception runtime, bukan pola inti release
  - baseline audit terbaru menutup ambiguity: boundary `Tim` dan `Master` sudah dipusatkan, residual page-level `allowedRoles` dibekukan sebagai explicit legacy gates, dan `Stok Barang` tetap supporting aktif
  - urutan release yang direkomendasikan sekarang eksplisit: `UCW-85` delete/restore/permanent-delete, `UCW-86` attachment platform, `UCW-87` report server truth, `UCW-88` PDF bisnis, `UCW-89` mobile/scalable, lalu `UCW-90` audit final end-to-end
  - audit sweep detail sudah dikunci untuk `Dashboard`, `Jurnal`, `Pembayaran`, `Attendance`, `Master`, `Attachment`, `Reports`, dan `auth/workspace` agar next pass tidak melebar ke area non-core yang salah prioritas
  - baseline final menempatkan `UCW-169` sebagai task yang sudah tertutup; residual page-level `allowedRoles` tetap explicit legacy gates dan tidak dihitung sebagai blocker kecuali freeze berubah
- Validasi:
  - `rg -n "submitTransaction|TransactionForm|vw_transaction_summary|loadOperationalSummary|/stock|StockPage|usePaymentStore|team_members|invite_tokens|fn_generate_salary_bill|file_assets|hrd_documents|React.lazy|lazy\\(" docs/freeze docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md src api`
  - audit konsistensi peran freeze authority, core domain, dan transitional exception
- Risiko/regresi:
  - docs-only, jadi tidak ada risiko runtime langsung; risiko utamanya hanya salah klasifikasi antara blocker core release dan exception transitional bila matrix audit nanti tidak ketat

### [2026-04-20] `UCW-168` - Optimasi frontend route-level code splitting di `src/App.jsx`
- Status: `validated`
- Ringkasan:
  - seluruh page route aktif di `src/App.jsx` dialihkan ke `React.lazy()` / dynamic import, sehingga static import page tidak lagi menumpuk di entry bundle utama
  - `MainLayout` sekarang memegang fallback global untuk route dalam shell, sementara route standalone memakai fallback terpisah dengan desain visual yang sinkron
  - fallback loading auth dan route sekarang memakai surface visual yang konsisten dengan UI repo, bukan spinner minimal yang terpisah gayanya
- File berubah:
  - `src/App.jsx`
  - `src/components/layouts/MainLayout.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - seluruh inventory route page di `src/App.jsx` sudah dievaluasi di satu task frontend-only sesuai brief `UCW-168`
  - alias route `Navigate`, bootstrap auth, `MainLayout`, dan contract route bill/loan tetap dipertahankan
  - boundary fallback sekarang terbagi dua: global di dalam `MainLayout`, dan standalone untuk route di luar shell
  - output `vite build` sesudah perubahan tidak lagi menampilkan warning chunk `> 500 kB`; build menghasilkan asset route-level terpisah dan satu warning tersisa hanya terkait `PLUGIN_TIMINGS`
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - audit output build untuk chunk split dan warning Vite
- Risiko/regresi:
  - semua route page sekarang lazy-loaded; jika ada page yang diam-diam mengandalkan eager side effect saat bootstrap, regresinya baru akan terlihat saat route tersebut dibuka pertama kali
  - fallback visual sudah diseragamkan, tetapi kalau nanti dibutuhkan skeleton yang lebih spesifik per halaman, itu harus menjadi task UX terpisah agar tidak mencampur optimasi bundling dengan polish per-page
- Next allowed task:
  - audit browser ringan terhadap transisi first-load route setelah lazy loading
  - brief frontend-only berikutnya bila ingin mem-polish skeleton/fallback per halaman tanpa mengubah boundary code splitting

### [2026-04-20] `UCW-167` - Rekonsiliasi freeze package dengan runtime authority terkini
- Status: `validated`
- Ringkasan:
  - package `docs/freeze/*` diselaraskan ulang dengan runtime aktif untuk authority dashboard summary, boundary `Pembayaran`, status legacy `transactions`, dan route `Stok Barang`
  - wording stale tentang `submitTransaction`, direct insert payment, `vw_transaction_summary`, dan `Stok Barang` planned-only diganti dengan boundary yang cocok dengan kode aktual
  - transitional boundary yang masih direct Supabase di `Tim`, `Referensi`, `HRD`, `File`, dan generate payroll dicatat eksplisit sebagai exception runtime, bukan pola baru domain inti
- File berubah:
  - `docs/freeze/00-index.md`
  - `docs/freeze/01-planning-decision-freeze.md`
  - `docs/freeze/02-prd-master.md`
  - `docs/freeze/03-source-of-truth-contract-map.md`
  - `docs/freeze/04-lifecycle-matrix.md`
  - `docs/freeze/05-ai-execution-guardrails.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `Dashboard` freeze sekarang menunjuk `/api/transactions?view=summary` dan helper `loadOperationalSummary()` sebagai authority summary aktif, bukan `vw_transaction_summary`
  - `Pembayaran` freeze sekarang mencatat `usePaymentStore` sebagai wrapper API aktif; direct insert store diposisikan ulang sebagai wording historis
  - `Stok Barang` freeze sekarang mencatat route `/stock` dan manual stock-out terbatas sebagai surface supporting aktif, bukan planned-only
  - direct Supabase write/RPC pada store pendukung dan `PayrollManager` dicatat sebagai runtime exception/transitional boundary
- Validasi:
  - audit isi dan referensi path pada `docs/freeze/*`
  - audit runtime terhadap `src/App.jsx`, `src/store/useDashboardStore.js`, `api/transactions.js`, `src/store/useTransactionStore.js`, `src/store/usePaymentStore.js`, `src/store/useTeamStore.js`, `src/store/useMasterStore.js`, `src/store/useHrStore.js`, `src/store/useFileStore.js`, dan `src/components/PayrollManager.jsx`
  - search repo untuk `submitTransaction`, `TransactionForm`, `vw_transaction_summary`, `loadOperationalSummary`, `/stock`, `StockPage`, `usePaymentStore`, dan `transactions`
- Risiko/regresi:
  - dokumen freeze sekarang lebih akurat terhadap runtime saat ini, tetapi ia masih bergantung pada exception boundary yang belum direfaktor ke API-owned flow untuk area support/admin
  - warning bundling Vite dan import statis di `src/App.jsx` hanya dicatat sebagai debt optimasi; task ini tidak menyentuh implementasi runtime
- Next allowed task:
  - brief implementasi berikutnya yang mengutip freeze package yang sudah direkonsiliasi ini

### [2026-04-20] `UCW-166` - Bersihkan dokumentasi legacy tentang `TransactionForm`
- Status: `validated`
- Ringkasan:
  - `docs/integration-readiness-plan-2026-04-17.md` sekarang menyebut `TransactionForm` sebagai host inert/compatibility-only, bukan writer aktif
  - entri plan operasional stream juga disinkronkan agar semua referensi resmi mengikuti status runtime terbaru
  - tidak ada perubahan pada runtime code, API, dashboard summary, atau schema
- File berubah:
  - `docs/integration-readiness-plan-2026-04-17.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - referensi aktif yang sempat mengklaim `TransactionForm` masih menulis ke `transactions` sudah disorot sebagai legacy/historis
  - plan/progress sekarang konsisten dengan status inert/legacy-only
- Validasi:
  - audit dokumen `docs/integration-readiness-plan-2026-04-17.md`
  - audit plan/progress stream untuk konsistensi istilah
- Risiko/regresi:
  - dokumen historis di luar allowed file masih bisa memuat bahasa pre-migration, tetapi itu tidak mengubah runtime dan sudah tercatat sebagai histori/superseded
- Next allowed task:
  - brief berikutnya yang tetap docs-only atau deprecation boundary

### [2026-04-20] `UCW-165` - Audit residual exposure `TransactionForm` sebagai host inert
- Status: `validated`
- Ringkasan:
  - `src/components/TransactionForm.jsx` tidak punya route/alias/deep link di `src/App.jsx`, sehingga tidak ada jalur UI aktif yang menghidupkan form lama
  - search `TransactionForm` di `src` hanya menemukan file host inert itu sendiri, dan search `submitTransaction(` di `src` tidak menemukan consumer write aktif
  - dokumen aktif yang relevan tetap memperlakukan `TransactionForm` sebagai legacy/inert, bukan form aktif
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - tidak ada route baru, alias, atau deep link yang mengarah ke `TransactionForm`
  - tidak ada write behavior tersisa di host inert
  - dashboard summary dan path operasional tidak tersentuh
  - satu dokumen historis di luar scope aktif (`docs/integration-readiness-plan-2026-04-17.md`) masih memakai bahasa pre-migration tentang `TransactionForm`; itu exposure dokumentasi, bukan runtime
- Validasi:
  - audit search `TransactionForm` dan `submitTransaction(` pada `src`
  - audit `src/App.jsx` untuk route/alias exposure
- Risiko/regresi:
  - exposure residual hanya berupa keberadaan file host inert; jika ada import eksternal di luar repo, itu masih harus diputus oleh consumer tersebut
  - dokumentasi historis yang belum direvisi bisa masih membingungkan pembaca baru, tetapi tidak menghidupkan write path
- Next allowed task:
  - brief berikutnya yang masih berada di ruang deprecation/read-path boundary
### [2026-04-20] `UCW-164` - Quarantine dan retire legacy `submitTransaction()` / `TransactionForm`
- Status: `validated`
- Ringkasan:
  - `submitTransaction()` sudah dihapus dari `useTransactionStore`, sehingga tidak ada write path legacy aktif yang bisa menulis ke `transactions`
  - `src/components/TransactionForm.jsx` direduksi menjadi host inert tanpa dependency store/write, sehingga legacy form tidak lagi menghidupkan path write lama
  - dashboard summary tetap tidak tersentuh karena perubahan hanya ada di legacy write boundary
- File berubah:
  - `src/store/useTransactionStore.js`
  - `src/components/TransactionForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - search `submitTransaction(` dan referensi `TransactionForm` di `src` tidak lagi menemukan consumer write aktif
  - tidak ada path baru yang menulis ke `transactions`
  - summary dashboard tetap memakai path read operasional yang sudah dipindahkan pada task sebelumnya
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - jika ada consumer eksternal atau bookmark lama yang masih mencoba membuka `TransactionForm`, mereka sekarang hanya akan mendapatkan host inert tanpa write behavior
- Next allowed task:
  - brief berikutnya yang tetap berada di ruang deprecation/read-path boundary

### [2026-04-20] `UCW-163` - Alihkan dashboard summary off `vw_transaction_summary` bridge
- Status: `validated`
- Ringkasan:
  - summary dashboard sekarang dibangun dari cashflow operasional current source of truth via `/api/transactions?view=summary`, sehingga dashboard tidak lagi bergantung pada `vw_transaction_summary`
  - read path summary tetap server-side dan tidak menyentuh write path legacy apa pun
  - legacy bridge tetap ada sebagai kompatibilitas pasif, tetapi bukan consumer dashboard
- File berubah:
  - `api/transactions.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `api/transactions.js` sekarang membangun summary dari `project_incomes`, `loans`, `bill_payments`, dan `loan_payments` via helper operational cash mutation, bukan dari `vw_transaction_summary`
  - `fetchTransactionSummaryFromApi` tetap menjadi wrapper transport, tetapi consumer dashboard sudah keluar dari dependency legacy summary view
  - tidak ada perubahan pada `src/store/useTransactionStore.js`, `src/components/TransactionForm.jsx`, atau write boundary legacy lain
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - summary dashboard tetap bergantung pada kualitas mapping cashflow operasional di `api/transactions.js`; jika source row berubah, summary perlu disinkronkan ulang
- Next allowed task:
  - `UCW-164` atau brief berikutnya yang masih berada di ruang read-path / compatibility boundary

### [2026-04-20] `UCW-162` - Audit gap schema Supabase project baru vs legacy contract
- Status: `validated`
- Ringkasan:
  - audit schema mapping menunjukkan schema proyek baru sudah menutup sebagian besar source of truth core, tetapi `public.transactions` masih hidup sebagai legacy compatibility path yang perlu diputuskan sebelum implementasi core berikutnya
  - `public.profiles.role` pada schema baru memang tidak ada, tetapi blocker itu sudah ditangani di auth/records compatibility path dan tidak memutus runtime core saat ini
  - gap yang tersisa lebih berupa keputusan source of truth dan klasifikasi legacy (pertahankan/pindah/ganti/hapus) daripada blocker runtime aktif
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`

### [2026-04-20] `UCW-160` - Audit sisa referensi schema legacy di core flow
- Status: `validated`
- Ringkasan:
  - audit lanjut pada `api/records.js`, `api/transactions.js`, `api/auth.js`, dan store core menunjukkan tidak ada referensi schema legacy tambahan yang memutus create/edit/delete/restore/payment setelah blocker `profiles.role` ditutup
  - referensi role yang tersisa di `api/auth.js` dan permission attachment memakai fallback/compat path yang aman dan bukan lagi sumber blocker harian
  - core flow harian tetap memakai source of truth yang sama; tidak ada kontrak domain baru atau refactor besar
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`

### [2026-04-20] `UCW-161` - Smoke audit runtime core flow
- Status: `validated`
- Ringkasan:
  - auth bootstrap owner berhasil pada session Telegram valid
  - read-path core (`transactions` workspace/history/recycle-bin, summary, `records` bills / bill-payments recycle) kembali 200 tanpa runtime error
  - write entrypoint core yang diuji dengan payload aman/invalid kembali 400 validation error yang semestinya, bukan 500 runtime error
  - dataset live kosong, jadi smoke write success-path tidak dijalankan agar tidak memutasi data tanpa fixture
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `api/transactions.js` tidak ditemukan lagi membaca kolom legacy profile yang memutus flow transaksi/pembayaran
  - `api/records.js` sudah tidak lagi mengandalkan `profiles.role` untuk read path records/dashboard, dan attachment-policy memakai lookup role membership fallback
  - `api/auth.js` tetap kompatibel terhadap schema `profiles.role` lama, sehingga tidak memutus login bila kolom legacy ada atau tidak ada
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - tidak ada blocker baru yang ditemukan; sisa referensi role bersifat kompatibel dan tidak mengubah contract core flow

### [2026-04-20] `UCW-159` - Fix blocker core CRUD reliability gate
- Status: `validated`
- Ringkasan:
  - audit runtime menemukan query `profiles.role` di `api/records.js` masih memblokir read path records/dashboard setelah migrasi project baru
  - patch minimal menghapus asumsi kolom legacy itu dari query profile umum dan memindahkan lookup role attachment-policy ke fallback membership yang aman
  - perubahan ini menutup blocker awal yang sempat membuat core surface tampil error meski flow create/edit/delete/payment sendiri tidak berubah kontraknya
- File berubah:
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - root cause nyata adalah asumsi schema legacy `profiles.role` di `api/records.js`, bukan mismatch route/store pada core form pages
  - records API sekarang membaca `profiles.id` dan `profiles.telegram_user_id` saja; permission attachment tetap aman lewat lookup role membership fallback
  - tidak ada perubahan behavior create/edit/delete/restore/payment domain inti selain menutup blocker schema mismatch
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - attachment-policy endpoint kini bergantung pada fallback membership role bila profile role tidak ada; ini tradeoff aman untuk schema project baru dan lebih sesuai dengan data source of truth aktual

### [2026-04-20] `UCW-158` - Ringankan fan-out fetch `Dashboard`
- Status: `validated`
- Ringkasan:
  - fast loan/summary branch di dashboard diprioritaskan dulu, sementara workspace transactions dipindah ke fetch sibling terpisah yang tidak lagi ikut menahan path cepat
  - urutan fetch dashboard sekarang memberi kesempatan first visible state muncul lebih cepat tanpa mengubah source of truth atau kontrak domain
  - task ini adalah follow-up kecil dari temuan UCW-155 bahwa fan-out dashboard bisa ikut menahan branch yang ringan
- File berubah:
  - `src/pages/Dashboard.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - branch `summary refresh`, `unpaid bills`, `loan list`, dan `project summaries` sekarang berjalan di fast phase; `workspace transactions` dijadwalkan setelah paint awal sehingga tidak ikut menahan fast loan path
  - dashboard tetap memakai store/source of truth yang sama; hanya urutan fetch dan gating ringan yang berubah
  - behavior domain inti tidak berubah, dan tidak ada surface baru
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - recent activity workspace bisa muncul sedikit belakangan dibanding sebelum split fan-out; itu tradeoff yang disengaja untuk memprioritaskan first visible dashboard state

### [2026-04-20] `UCW-157` - Instrumentation timing kecil untuk core list dan loan path
- Status: `validated`
- Ringkasan:
  - timing ringan ditambahkan untuk membandingkan first response, first usable list, dan branch fetch dashboard loan/summary tanpa observability platform besar
  - `Jurnal`, `Riwayat`, dan `Halaman Sampah` sekarang bisa dilihat timing fetch serta first usable state-nya, sementara dashboard branch loan/summary punya timing branch fetch yang dev-safe
  - instrumen ini mengikuti rekomendasi UCW-155 dan hasil trim payload UCW-156 agar task optimasi berikutnya berbasis angka
- File berubah:
  - `api/transactions.js`
  - `api/records.js`
  - `src/pages/Dashboard.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `src/lib/reports-api.js`
  - `src/lib/timing.js`
  - `src/lib/transactions-api.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `view=workspace`, `view=history`, dan `view=recycle-bin` sekarang mengembalikan timing opsional di jalur dev sehingga first response dan hydration/merge bisa dibedakan
  - page mount to first usable list di tiga surface inti dilog sekali per mount/workspace, sementara dashboard mencatat durasi branch fetch untuk loan list, project summaries, workspace transactions, unpaid bills, dan summary refresh
  - logging dibuat dev-safe dan tidak menambah payload bisnis saat instrumentation dimatikan
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - bila log timing dianggap terlalu noisy di dev, cukup nonaktifkan flag `import.meta.env.DEV`/debug query; behavior domain inti tidak berubah

### [2026-04-20] `UCW-156` - Trim first-paint payload `Jurnal` / `Riwayat`
- Status: `validated`
- Ringkasan:
  - rekomendasi prioritas #1 dari `UCW-155` dieksekusi dengan memindahkan creator metadata keluar dari critical path first paint `Jurnal` dan `Riwayat`
  - initial page sekarang membaca list shell minimal dulu; metadata creator tidak lagi menahan skeleton utama
  - creator badge pada `Jurnal` / `Riwayat` tetap aman dari state misleading karena hanya tampil jika row memang membawa identity creator eksplisit
- File berubah:
  - `api/transactions.js`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - creator metadata merge sebelumnya terjadi di `loadTransactionViewRows()` setelah query utama untuk `vw_workspace_transactions` / `vw_history_transactions`, sehingga paginated first paint ikut menunggu hydration dari beberapa tabel source
  - paginated path sekarang melewati merge creator metadata, sedangkan load penuh/unpaginated tetap bisa mempertahankan metadata jika dibutuhkan oleh surface lain
  - row render `Jurnal` / `Riwayat` sekarang hanya menampilkan creator badge saat row sudah membawa identity creator eksplisit, sehingga list awal tidak menampilkan badge palsu atau mengubah semantics domain inti
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - creator badge pada first page `Jurnal` / `Riwayat` tidak lagi tampil dari metadata hasil hydrate server; ini tradeoff yang disengaja untuk first paint lebih cepat dan dapat dipulihkan lewat task hydrate sekunder bila nanti benar-benar diperlukan

### [2026-04-20] `UCW-155` - Profiling jalur `loan` vs `Jurnal` / `Riwayat` / `Halaman Sampah`
- Status: `validated`
- Ringkasan:
  - audit menemukan jalur `loan` lebih cepat karena membaca parent table/summary yang sempit, sementara `Jurnal`, `Riwayat`, dan `Halaman Sampah` memakai read model unified yang lebih lebar dan masih menanggung transform/merge metadata di server/client
  - bottleneck utama first paint bukan di UI polish, tetapi di breadth read path, jumlah fetch saat mount, dan gating skeleton yang menunggu payload list penuh sebelum layar terasa hidup
  - output task ini adalah diagnosis terukur plus plan urutan solusi yang spesifik, sehingga task implementasi berikutnya bisa diarahkan ke bottleneck paling berdampak tanpa refactor generik
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - jalur `loan` dashboard memakai `src/store/useIncomeStore.js` yang membaca `loans` secara langsung dengan select sempit, sementara dashboard KPI/laporan memanfaatkan summary terpisah dari `src/store/useReportStore.js`
  - `Jurnal` membaca `vw_workspace_transactions`, `Riwayat` membaca `vw_history_transactions`, dan `Halaman Sampah` membaca `vw_recycle_bin_records`; ketiganya lebih wide daripada parent-table loan path dan `Jurnal`/`Riwayat` masih menambah merge creator metadata setelah fetch
  - skeleton/list state pada ketiga surface inti tetap menunggu data list awal selesai sebelum first paint terasa stabil, jadi UX lambat lebih dipengaruhi shape query/payload daripada sekadar animasi loader
  - rute loan mutation di `src/lib/transactions-api.js` tetap resource-spesifik (`loan-payments`) dan tidak ikut jalur unified ledger list
- Validasi:
  - audit code path dan perbandingan read surface pada `src/pages/Dashboard.jsx`, `src/pages/TransactionsPage.jsx`, `src/pages/HistoryPage.jsx`, `src/pages/TransactionsRecycleBinPage.jsx`, `src/components/ProjectReport.jsx`, `src/store/useReportStore.js`, `src/lib/reports-api.js`, `src/lib/transactions-api.js`, `api/transactions.js`, `api/records.js`
- Risiko/regresi:
  - diagnosis ini belum mengubah runtime, jadi perbaikan performa nyata tetap menunggu task implementasi yang lebih spesifik; namun baseline analisis sudah cukup untuk memilih arah optimasi berikutnya

### [2026-04-20] `UCW-154` - Hardening read model dan snapshot `Halaman Sampah`
- Status: `validated`
- Ringkasan:
  - audit Halaman Sampah menemukan read path masih menggabungkan beberapa deleted source secara terpisah, lalu menyimpan snapshot list yang bisa kembali stale saat user balik dari detail atau aksi row
  - patch memindahkan list recycle bin ke view server-side `vw_recycle_bin_records`, menaruh filter/search/pagination di query yang sama, dan menandai snapshot list sebagai perlu refresh setelah restore/permanent delete dari detail
  - state kembali ke Halaman Sampah sekarang tetap mempertahankan filter/search/page cursor/scroll snapshot, tetapi tidak lagi bergantung pada hasil merge client-side yang berat
- File berubah:
  - `api/transactions.js`
  - `src/lib/recycle-bin-state.js`
  - `src/pages/DeletedTransactionDetailPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `supabase/migrations/20260420150000_create_vw_recycle_bin_records.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - root cause `Halaman Sampah` yang nyata: server route masih melakukan read amplification dari beberapa tabel deleted/recovery dan client snapshot tidak diberi sinyal refresh saat kembali dari detail mutate
  - endpoint recycle bin sekarang membaca view tunggal `vw_recycle_bin_records` dengan filter/search/pagination server-side dan tetap menjaga deleted/recovery semantics lama
  - back-navigation detail recycle bin tetap eksplisit ke `/transactions/recycle-bin`, tetapi snapshot list sekarang dipaksa refresh setelah mutate agar tidak kembali stale
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - apply migration `create_vw_recycle_bin_records` ke project Supabase baru
- Risiko/regresi:
  - jika deployment runtime belum tersinkron dengan migration view baru, endpoint recycle-bin bisa gagal sampai migration tercatat di project yang sama; selain itu, behavior domain inti tidak berubah

### [2026-04-20] `UCW-153` - Incident auth bootstrap repair setelah migrasi Supabase project baru
- Status: `validated`
- Ringkasan:
  - audit end-to-end menemukan login owner gagal bukan di `team_members`, melainkan lebih awal di bootstrap `profiles` saat `/api/auth` selalu membaca kolom `public.profiles.role` yang memang tidak ada di schema project baru
  - patch membuat bootstrap profile di `api/auth.js` adaptif terhadap dua varian schema `profiles` dan menambah incident logging aman per-stage agar failure berikutnya bisa diisolasi tanpa menebak
  - verifikasi runtime lokal dengan `initData` Telegram yang valid terhadap project baru selesai `200 success`, mengembalikan session owner dan membership workspace aktif
- File berubah:
  - `api/auth.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - failure point nyata yang ditemukan: stage `ensure_profile` di `/api/auth`, tepatnya query `select id, telegram_user_id, role, created_at from public.profiles`
  - bukti DB pada project baru: `public.profiles` hanya punya kolom `id`, `telegram_user_id`, `created_at`, `updated_at`, `deleted_at`, dan `legacy_firebase_id`; kolom `role` tidak ada
  - membership owner yang diaudit: `team_members.telegram_user_id = '7592811205'`, `role = 'Owner'`, `status = 'active'`, `is_default = true`, `approved_at` terisi, dan `teams.is_active = true`
  - verifikasi env/runtime yang diaudit: URL dan publishable key MCP cocok dengan `.env` project baru; handler lokal setelah patch berhasil sign-in/create session ke project yang sama
  - implikasi prioritas stream: incident auth bootstrap ini ditutup sebagai blocker operasional; task produk lain tetap harus menunggu auth boundary stabil
- Validasi:
  - query audit DB via MCP untuk `teams`, `team_members`, `public.profiles`, `auth.users`, dan `information_schema.columns`
  - simulasi request `/api/auth` end-to-end dengan `initData` Telegram valid terhadap project baru menghasilkan `200 success`
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - bootstrap profile sekarang kompatibel ke schema lama dan baru, tetapi bila ada boundary lain di repo yang masih mengasumsikan `profiles.role` sebagai kolom nyata, area itu perlu diaudit terpisah saat disentuh nanti

### [2026-04-20] `UCW-152` - Hardening owner bypass auth untuk project baru
- Status: `validated`
- Ringkasan:
  - audit menemukan owner bypass masih terlalu bergantung pada satu env key spesifik dan bisa jatuh ke access denied kalau workspace default belum aktif atau membership client-side belum menjamin row owner pertama
  - patch membuat owner workspace di-bootstrap otomatis lewat upsert, memperluas pembacaan env owner id ke alias yang umum, dan menahan store dari refresh membership yang bisa menimpa state owner server-side
- File berubah:
  - `api/auth.js`
  - `src/store/useAuthStore.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - owner bypass sekarang tidak lagi mengandalkan fallback team aktif yang rapuh; default workspace di-upsert sebagai aktif jika belum ada
  - auth store owner bypass sekarang memakai membership yang dikirim backend tanpa refresh client-side tambahan yang bisa merusak ordering owner
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - jika ada project yang memang sengaja mematikan default workspace, owner bypass kini akan mengaktifkannya kembali saat login owner pertama kali

### [2026-04-20] `UCW-145` - Hardening performa dan state `Halaman Sampah`
- Status: `validated`
- Ringkasan:
  - audit menemukan `Halaman Sampah` masih memuat beberapa source deleted/recovery secara terpisah lalu menggabungkannya di client, sementara state list belum memiliki search/pagination server-side yang konsisten
  - patch memindahkan read path ke satu endpoint recycle-bin server-side, menambah search/filter/pagination state, dan mempertahankan konteks deleted/recovery tanpa melemahkan guard restore/permanent delete
- File berubah:
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `src/pages/DeletedTransactionDetailPage.jsx`
  - `src/lib/transactions-api.js`
  - `api/transactions.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing `Halaman Sampah` yang ditemukan: page sudah punya snapshot sessionStorage dasar, tetapi list masih dikumpulkan dari beberapa fetch terpisah dan hanya filter client-side
  - akar masalah loading/state yang ditemukan: initial load memanggil banyak endpoint deleted/recovery, lalu menggabungkan dan memfilter di client tanpa pagination/search yang konsisten
  - yang diubah untuk loading: `view=recycle-bin` sekarang punya read path server-side tunggal dengan page cursor/limit/search/filter
  - yang diubah untuk state: `Halaman Sampah` menyimpan dan memulihkan filter, search, pageInfo, cursor history, cursor aktif, list page, dan scroll position
  - endpoint/payload: ada payload/query recycle-bin baru di `api/transactions.js` dan helper client baru di `src/lib/transactions-api.js`
  - lifecycle domain inti tidak berubah, dan tidak ada helper/descriptive UI copy baru yang ditambahkan
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - build selesai dengan warning chunk size existing, tanpa error bundling baru
- Risiko/regresi:
  - if target data is large, recycle-bin pagination still depends on the aggregated server read path; if a specific source table schema shifts, the unified loader needs to stay in sync

### [2026-04-20] `UCW-144` - Rekonsiliasi migration chain `vw_workspace_transactions` -> `vw_history_transactions`
- Status: `validated`
- Ringkasan:
  - audit menemukan migration `20260420113000_create_vw_history_transactions.sql` bergantung langsung pada `vw_workspace_transactions`, sementara target environment yang diuji belum memiliki prerequisite view tersebut di chain aktif
  - patch menyiapkan migration history agar self-sufficient dengan memastikan prerequisite workspace view ada sebelum history view dibuat
- File berubah:
  - `supabase/migrations/20260420113000_create_vw_history_transactions.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - akar masalah migration chain yang ditemukan: history migration mengasumsikan chain lokal sudah membawa `vw_workspace_transactions`, tetapi branch target yang diuji tidak punya prerequisite view itu
  - file migration yang jadi dependency: `supabase/migrations/20260420090000_create_vw_workspace_transactions.sql` untuk workspace view, dan `supabase/migrations/20260420113000_create_vw_history_transactions.sql` untuk history view
  - yang diubah agar chain aman: history migration sekarang memuat pembuatan workspace view lebih dulu sebelum mendefinisikan history view, sehingga deployment tidak bergantung pada urutan chain sebelumnya di target environment
  - migration baru atau patch existing: patch pada migration existing `20260420113000_create_vw_history_transactions.sql`
  - semantics domain inti tidak berubah, dan tidak ada helper/descriptive UI copy baru yang ditambahkan
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
  - verifikasi target env via `select to_regclass('public.vw_workspace_transactions') as workspace_view, to_regclass('public.vw_history_transactions') as history_view;` menunjukkan keduanya belum ada sebelum patch, sehingga chain yang dipatch memang menutup gap prerequisite
- Risiko/regresi:
  - patch menambah definisi workspace view ke migration history untuk memastikan deployability; jika chain lama dan baru bertemu di environment yang sudah punya view, `create or replace` menjaga definisi tetap konsisten

### [2026-04-20] `UCW-143` - Hardening performa dan state `Riwayat`
- Status: `validated`
- Ringkasan:
  - audit menemukan bahwa `Riwayat` masih menarik full workspace history lalu memfilter/paginasi di memory, sementara state list hanya sebagian matang dibanding pola Jurnal
  - patch memindahkan `view=history` ke history-only server-side read model dan menambahkan persistence state list plus scroll position yang tetap menjaga surface completed/history
- File berubah:
  - `api/transactions.js`
  - `src/pages/HistoryPage.jsx`
  - `supabase/migrations/20260420113000_create_vw_history_transactions.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing `Riwayat` yang ditemukan: list sudah punya persistence dasar, tetapi history query masih bergantung pada load penuh workspace sebelumnya
  - akar masalah loading/state yang ditemukan: server history path masih memuat seluruh workspace history lebih dulu, lalu memotong hasil di memory; state restore juga belum memakai penanda loaded yang tegas
  - yang diubah untuk loading: `view=history` sekarang memakai view history-only dengan filter/search/cursor di server
  - yang diubah untuk state: `Riwayat` menyimpan dan memulihkan filter, search, pageInfo, transaksi yang sudah dimuat, scroll position, dan loaded flag
  - endpoint/payload: tidak ada endpoint baru; payload `view=history` tetap sama dari sisi caller
  - lifecycle domain inti tidak berubah, dan tidak ada helper/descriptive UI copy baru yang ditambahkan
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
- Risiko/regresi:
  - view baru bergantung pada `vw_workspace_transactions` yang sudah menjadi source of truth di repo migration chain; jika deployment tidak menjalankan migrasi berurutan, view history baru tidak akan terbentuk

### [2026-04-20] `UCW-142` - Hardening performa dan state `Jurnal`
- Status: `validated`
- Ringkasan:
  - audit menemukan bahwa `Jurnal` masih melakukan load penuh workspace di server lalu memotongnya di memory, sementara state list belum dipersist saat kembali dari detail/aksi
  - patch memindahkan page `Jurnal` ke server-side paginated view/read model, lalu menambahkan persistence state list dan scroll position agar kembali dari detail tidak terasa reset brutal
- File berubah:
  - `api/transactions.js`
  - `src/pages/TransactionsPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing `Jurnal` yang ditemukan: page masih me-reset list ketika filter/search berubah dan tidak menyimpan konteks saat navigasi keluar
  - akar masalah loading/state yang ditemukan: route workspace masih menyiapkan data secara penuh lalu memfilter/paginasi di memory, dan state list belum dipulihkan dari session storage
  - yang diubah untuk loading: query `view=workspace` sekarang memakai paginated server-side read model dengan filter/search/cursor di server
  - yang diubah untuk state: `Jurnal` menyimpan filter, search, pageInfo, transaksi yang sudah dimuat, dan scroll position lalu memulihkannya saat kembali
  - endpoint/payload: tidak ada endpoint baru; payload `view=workspace` tetap sama dari sisi caller
  - lifecycle domain inti tidak berubah, dan tidak ada helper/descriptive UI copy baru yang ditambahkan
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
- Risiko/regresi:
  - route legacy tetap ada untuk kompatibilitas, jadi bookmark lama masih bisa masuk; jika kelak ingin menyatukan seluruh caller, itu perlu task terpisah

### [2026-04-20] `UCW-141` - Koreksi arsitektur settlement kembali ke `Jurnal`
- Status: `validated`
- Ringkasan:
  - launcher settlement standalone dari dashboard dipangkas, sehingga entry utama kembali fokus ke `Jurnal`
  - `Tagihan` dan `Pembayaran` tetap hidup sebagai route kompatibilitas, tetapi back-navigation dan launcher utama tidak lagi mendorong mereka sebagai UX utama
  - `Recycle Bin` di surface transaksi direname menjadi `Halaman Sampah`
- File berubah:
  - `src/pages/Dashboard.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/HistoryPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `src/pages/BillsPage.jsx`
  - `src/pages/PaymentsPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/PaymentPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing settlement flow yang ditemukan: dashboard masih mempromosikan `Tagihan` / `Pembayaran` sebagai quick action, sementara halaman bill/payment saling menjadi launcher utama
  - apa yang diubah agar primary UX kembali ke `Jurnal`: quick action standalone settlement dihapus dari dashboard, Jurnal tetap memegang row/detail action untuk settlement, dan payment route yang dibuka dari Jurnal kembali ke `/transactions`
  - apa yang diubah terkait `Riwayat`: tidak ada lifecycle/history logic baru, hanya label dan navigation yang tetap konsisten ke `Riwayat`
  - apa yang diubah terkait rename `Halaman Sampah`: label dashboard, tombol header Jurnal/Riwayat, title page, sheet title, dan pesan error/empty-state yang relevan diselaraskan ke `Halaman Sampah`
  - route standalone settlement masih dipertahankan untuk kompatibilitas internal, tetapi tidak lagi menjadi launcher utama dari dashboard atau saling-mendorong antar halaman
  - lifecycle domain inti tidak berubah, dan tidak ada helper/descriptive UI copy baru yang ditambahkan di luar kebutuhan rename/navigasi
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - route `/tagihan` dan `/pembayaran` masih tersedia, jadi pengguna lama yang punya bookmark langsung tetap bisa masuk ke surface kompatibilitas itu

### [2026-04-20] `UCW-140` - Preserve list state untuk `Tagihan` / `Pembayaran`
- Status: `validated`
- Ringkasan:
  - kembali dari detail ke `Tagihan` / `Pembayaran` sekarang mempertahankan scroll position dan snapshot state list sesi terakhir
  - list page tetap memakai source data yang sama, tetapi state navigasi tidak terasa reset brutal saat user balik dari detail
  - patch mengikuti pola session-backed state kecil seperti halaman list audit lain di repo
- File berubah:
  - `src/pages/BillsPage.jsx`
  - `src/pages/PaymentsPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing list/navigation yang ditemukan: `Tagihan` dan `Pembayaran` belum menyimpan snapshot list sendiri; sebelum patch, kembali dari detail umumnya mendarat di top page tanpa restore scroll
  - apa yang hilang/reset sebelum patch: scroll position list mudah kembali ke nol setelah detail navigation, sedangkan data list tetap hidup di store tetapi konteks kembali tidak terasa stabil
  - setelah patch, snapshot scroll disimpan per team di sessionStorage dan dipulihkan saat page list dibuka kembali
  - tidak ada lifecycle payment, source of truth settlement, atau domain logic inti yang berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - state session-backed akan hilang jika user membersihkan session storage atau berpindah team; itu perilaku yang diterima untuk scope hardening ini

### [2026-04-20] `UCW-139` - Legacy settlement alias removal readiness audit
- Status: `validated`
- Ringkasan:
  - alias legacy `/payment/:id` dan `/loan-payment/:id` sudah tidak punya caller aktif internal tersisa di source frontend
  - routing glue internal settlement sudah memakai route resmi `/tagihan/:id`, `/pembayaran/tagihan/:id`, dan `/pembayaran/pinjaman/:id`
  - alias dipertahankan sementara untuk kompatibilitas/backward link sampai ada sinyal usage eksternal yang cukup untuk retirement
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - alias yang diaudit: `/payment/:id` dan `/loan-payment/:id`
  - caller internal aktif yang masih ditemukan: tidak ada di `src`; search source hanya menemukan definisi alias di `src/App.jsx`
  - routing glue internal yang masih bergantung pada alias: tidak ada; helper settlement internal sudah menghasilkan route resmi baru
  - keputusan akhir: pertahankan alias legacy sementara, karena repo belum memberi bukti cukup untuk memensiunkan deep link kompatibilitas
  - lifecycle domain inti tidak berubah: payment, parent settlement, dan source data tetap sama
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - penghapusan alias sekarang berisiko memutus bookmark, deep link, atau entry point lama yang tidak terlihat dari audit source internal

### [2026-04-19] `UCW-132` - Harden `Dashboard` quick-launch dan recent activity agar selaras dengan `Jurnal`
- Status: `validated`
- Ringkasan:
  - quick-launch dashboard dipindah dari shortcut create/legacy ke surface inti yang route-able dan tidak misleading
  - recent activity diselaraskan ke source truth `Jurnal` agar subset yang tampil tetap konsisten dengan ledger
  - CTA detail dashboard ditekan menjadi detail-oriented, bukan jalur action lama
- File berubah:
  - `src/pages/Dashboard.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing dashboard flow yang ditemukan: quick-launch masih berisi shortcut create/legacy, sementara recent activity ditarik dari campuran `cashMutations`, bills, dan loans sehingga tidak sepenuhnya konsisten dengan truth `Jurnal`
  - apa yang misleading sebelum patch: surface cepat masih mendorong entry create legacy dan recent activity dapat membuka CTA yang terasa seperti jalur lama
  - setelah patch, quick-launch menunjuk ke surface inti yang route-able, recent activity memakai source `workspaceTransactions`, dan CTA detail membuka detail `Jurnal` yang netral
  - tidak ada endpoint, payload, schema, atau lifecycle domain inti yang berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - perubahan surface cepat berisiko menggeser kebiasaan pengguna jika label route tidak dipilih ketat; mapping saat ini sengaja dibatasi ke surface yang benar-benar ada

### [2026-04-19] `UCW-133` - Harden route standalone `Tagihan` / `Pembayaran`
- Status: `validated`
- Ringkasan:
  - `Tagihan` sedang diposisikan sebagai workspace kewajiban aktif dengan route standalone yang bisa dibuka langsung
  - `Pembayaran` sedang diposisikan sebagai workspace histori settlement + aksi settlement dengan route standalone yang jelas
  - settlement detail tetap memakai boundary existing, tetapi sekarang punya entry route yang lebih tegas dan bernama sesuai freeze
- File berubah:
  - `src/pages/BillsPage.jsx`
  - `src/pages/PaymentsPage.jsx`
  - `src/pages/PaymentPage.jsx`
  - `src/App.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing `Tagihan` / `Pembayaran` workspace yang ditemukan: `Tagihan` belum punya route standalone yang tegas, sementara `Pembayaran` masih bergantung pada deep-link settlement per item
  - gap routing/workspace sebelum patch: belum ada route bernama yang bisa dipakai langsung sebagai launcher utama untuk kewajiban aktif dan settlement history
  - setelah patch, `Tagihan` punya route list sendiri, `Pembayaran` punya route history/settlement sendiri, dan detail settlement bisa dibuka lewat alias route yang jelas
  - tidak ada endpoint, payload, schema, atau lifecycle domain inti yang berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - route baru harus tetap konsisten dengan label workspace yang dipakai di launcher berikutnya agar tidak muncul duplikasi nama

### [2026-04-20] `UCW-134` - Wire quick-launch `Dashboard` ke route `Tagihan` / `Pembayaran`
- Status: `validated`
- Ringkasan:
  - quick-launch dashboard perlu diarahkan ke route workspace `Tagihan` dan `Pembayaran` yang sudah valid
  - launcher lain yang sudah benar tetap dipertahankan agar patch tetap sempit
  - Dashboard tetap overview cepat, bukan workspace CRUD utama
- File berubah:
  - `src/pages/Dashboard.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing quick-launch yang ditemukan: Dashboard sudah memiliki launcher ke `Jurnal`, `Riwayat`, `Recycle Bin`, `Catatan Absensi`, `Unit Kerja`, dan `Tim`, tetapi belum memakai route baru `Tagihan` dan `Pembayaran`
  - launcher yang diubah: quick-launch `Tagihan` dan `Pembayaran` ditambahkan dengan target route workspace yang baru
  - route baru yang dipakai: `/tagihan` dan `/pembayaran`
  - tidak ada endpoint, payload, schema, atau lifecycle domain inti yang berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - launcher baru harus tetap konsisten dengan route workspace yang sudah dibekukan agar tidak memunculkan naming drift di entry surface

### [2026-04-20] `UCW-135` - Harden detail `Pembayaran` agar context settlement tetap tegas
- Status: `validated`
- Ringkasan:
  - detail payment leaf dari workspace `Pembayaran` perlu tetap terasa sebagai settlement/payment history, bukan detail transaksi generik
  - back-navigation harus kembali ke `Pembayaran` saat entry point berasal dari surface tersebut
  - CTA/detail behavior tetap audit-friendly dan tidak mengubah lifecycle payment
- File berubah:
  - `src/pages/PaymentsPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing payment-detail/navigation yang ditemukan: histori payment row di `Pembayaran` masih membuka `TransactionDetailPage` generik tanpa context workspace `Pembayaran`
  - apa yang misleading sebelum patch: detail payment leaf terasa seperti detail transaksi/jurnal umum dan back-navigation tidak eksplisit kembali ke `Pembayaran`
  - setelah patch, payment history row membawa context surface `pembayaran`, detail page membaca context itu, dan back-navigation kembali ke `/pembayaran`
  - tidak ada endpoint, payload, schema, atau lifecycle domain inti yang berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - context surface harus tetap konsisten di semua entry point payment history agar detail tidak drift kembali ke jalur generic

### [2026-04-20] `UCW-136` - Harden detail `Tagihan` agar context bill workspace tetap tegas
- Status: `validated`
- Ringkasan:
  - detail bill dari workspace `Tagihan` perlu tetap terasa sebagai context bill workspace, bukan detail transaksi generik
  - back-navigation harus kembali ke `/tagihan` saat entry point berasal dari surface itu
  - CTA/detail behavior tetap terasa sebagai kewajiban aktif dan tidak mengubah lifecycle payment
- File berubah:
  - `src/pages/BillsPage.jsx`
  - `src/pages/PaymentPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing bill-detail/navigation yang ditemukan: row bill dari `Tagihan` sudah membuka `PaymentPage`, tetapi page title masih cenderung settlement-centric
  - apa yang misleading sebelum patch: detail bill bisa terbaca seperti detail pembayaran generik, walau entry point-nya dari workspace `Tagihan`
  - setelah patch, bill row dari `Tagihan` membawa context eksplisit ke `PaymentPage`, title workspace menjadi `Tagihan`, dan back-navigation kembali ke `/tagihan`
  - tidak ada endpoint, payload, schema, atau lifecycle domain inti yang berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - workspace label harus tetap konsisten dengan route `Tagihan` agar detail tidak drift kembali ke wording settlement umum

### [2026-04-20] `UCW-137` - Cross-entry context sweep untuk `Tagihan` / `Pembayaran`
- Status: `validated`
- Ringkasan:
  - entry point penting ke bill/payment detail harus membawa context surface yang benar jika berasal dari surface settlement-aware
  - `Tagihan` tetap terasa sebagai bill workspace context, `Pembayaran` tetap terasa sebagai payment workspace context
  - `Jurnal` boleh tetap generic ledger detail jika entry point-nya memang dari ledger aktif
- File berubah:
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/BillsPage.jsx`
  - `src/pages/PaymentsPage.jsx`
  - `src/pages/PaymentPage.jsx`
  - `src/components/ProjectReport.jsx`
  - `src/pages/Dashboard.jsx`
  - `src/lib/transaction-presentation.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - entry point yang diverifikasi: `BillsPage -> bill detail`, `PaymentsPage -> payment detail`, `TransactionsPage/Jurnal -> payment CTA`, `ProjectReport/Unit Kerja breakdown -> bill detail`, dan `Dashboard recent activity -> detail`
  - entry point yang sudah benar sejak awal: `BillsPage`, `PaymentsPage`, dan `Tagihan`/`Pembayaran` workspace route utama sudah konteks-aware
  - entry point yang drift/misleading sebelum patch: `Unit Kerja` salary breakdown masih menuju legacy `/payment/:id`; dashboard recent activity untuk payment leaf masih bisa jatuh ke detail generik; payment CTA dari ledger masih memakai legacy route settlement
  - setelah patch, payment CTA memakai route workspace `Pembayaran`, salary breakdown memakai route workspace `Tagihan`, dan recent activity payment leaf membawa context payment saat membuka detail
  - tidak ada endpoint, payload, schema, atau lifecycle domain inti yang berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - route workspace baru harus tetap konsisten dengan semua caller settlement-aware agar konteks tidak drift kembali ke jalur legacy

### [2026-04-20] `UCW-138` - Targeted deprecation sweep untuk legacy settlement route callers
- Status: `validated`
- Ringkasan:
  - caller aktif baru harus makin konsisten ke route workspace settlement yang resmi
  - route legacy `/payment/:id` dan `/loan-payment/:id` tetap hidup sementara untuk kompatibilitas, tetapi caller aktif harus dipindah
  - patch harus fokus pada caller yang memang masih drift, bukan sweeping buta ke semua legacy string
- File berubah:
  - `src/components/PayrollManager.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `src/lib/transaction-presentation.js`
  - `src/components/ProjectReport.jsx`
  - `src/pages/Dashboard.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - caller legacy yang ditemukan: `PayrollManager`, `EditRecordPage`, dan dua compatibility route definisi di `App.jsx`
  - caller yang diganti: `PayrollManager` dan tiga settlement CTA di `EditRecordPage` dipindah ke `/tagihan/:id`; helper pembayaran ledger dipindah ke `/pembayaran/tagihan/:id` dan `/pembayaran/pinjaman/:id`
  - route baru yang dipakai sebagai pengganti: `/tagihan/:id`, `/pembayaran/tagihan/:id`, `/pembayaran/pinjaman/:id`
  - caller legacy yang sengaja belum disentuh: route compatibility di `App.jsx`, karena tugas ini hanya men-deprecate caller aktif, bukan memutus kompatibilitas
  - tidak ada endpoint, payload, schema, atau lifecycle domain inti yang berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - caller yang belum disapu tetap bisa muncul dari file lain bila ada import helper lama; sweep berikutnya tinggal mencari `/payment/:id` dan `/loan-payment/:id` yang tersisa di caller aktif

### [2026-04-19] `UCW-131` - Preserve list state saat kembali dari detail `Riwayat` / `Recycle Bin`
- Status: `validated`
- Ringkasan:
  - search, filter, loaded page state, dan cursor/history pagination pada `Riwayat` sekarang dipertahankan via session-backed state kecil saat user masuk detail lalu kembali
  - filter dan loaded deleted list pada `Recycle Bin` dipertahankan dengan glue state serupa, jadi kembali dari detail tidak terasa seperti reset brutal
  - scroll position ikut disimpan ringan saat menuju detail, lalu dipulihkan jika state sebelumnya tersedia
- File berubah:
  - `src/pages/HistoryPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing list/navigation yang ditemukan: `Riwayat` memakai search/filter/pagination client state, sedangkan `Recycle Bin` memakai filter + list data loaded client state; sebelum patch, kembali ke page baru bisa kehilangan snapshot state tersebut
  - apa yang hilang/reset sebelum patch: kembali dari detail cenderung mendarat ke page base dengan filter default dan tanpa snapshot cursor/list yang sama
  - setelah patch, state list dipulihkan dari session-backed snapshot dan load awal dilewati hanya ketika snapshot valid tersedia, sehingga kembali dari detail terasa stabil
  - tidak ada endpoint, payload, schema, atau lifecycle domain inti yang berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - snapshot list sekarang hidup di sessionStorage; jika user membersihkan session atau berpindah workspace/team, state lama akan sengaja diabaikan dan page kembali ke load normal

### [2026-04-19] `UCW-130` - Harden `Recycle Bin` detail/back-navigation agar context deleted/recovery tetap jelas
- Status: `validated`
- Ringkasan:
  - detail yang dibuka dari `Recycle Bin` sekarang terbaca sebagai deleted/recovery context dengan eyebrow/title recycle bin yang eksplisit
  - back-navigation detail recycle bin diarahkan langsung ke `/transactions/recycle-bin`, jadi tidak bergantung pada history stack yang bisa mengarah ke surface lain
  - CTA aktif untuk deleted documents tidak lagi membuka edit surface aktif; deleted transaction detail tetap audit-friendly dan restore/permanent delete tetap memakai boundary yang sama
- File berubah:
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `src/pages/DeletedTransactionDetailPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing detail/navigation dari `Recycle Bin` yang ditemukan: deleted transaction detail memakai route dedicated, tetapi header masih berlabel `Riwayat`; beberapa deleted document masih punya `detailRoute` menuju edit surface aktif
  - misleading sebelum patch: detail recycle bin tidak menegaskan deleted/recovery context, back bergantung pada history stack, dan deleted document bisa lompat ke edit page aktif
  - setelah patch, detail recycle bin tetap berada dalam context deleted/recovery, back eksplisit kembali ke recycle bin, dan CTA yang membuka edit surface aktif untuk deleted document dihapus
  - tidak ada endpoint, payload, schema, atau lifecycle domain inti yang berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - deleted document sekarang tidak punya jalur detail aktif dari recycle bin; bila nanti dibutuhkan audit detail khusus untuk dokumen terhapus, itu perlu task terpisah dan tetap harus deleted-context aware

### [2026-04-19] `UCW-129` - Harden `Riwayat` detail/back-navigation agar context completed/history tetap jelas
- Status: `validated`
- Ringkasan:
  - detail yang dibuka dari `Riwayat` sekarang membawa surface context completed/history secara eksplisit, bukan lagi default ke konteks aktif `Jurnal`
  - back-navigation detail riwayat diarahkan ke `Riwayat` secara jelas, dan CTA write/active tidak lagi tampil pada surface history
  - lampiran expense tetap bisa diaudit di detail history, tetapi hanya sebagai tampilan read-only tanpa mutation affordance
- File berubah:
  - `src/pages/HistoryPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/components/ExpenseAttachmentSection.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing detail/navigation dari `Riwayat` yang ditemukan: click handler history hanya mengirim transaksi ke detail, sementara detail page sebelumnya menampilkan eyebrow/title `Jurnal` dan action write aktif yang sama dengan surface ledger
  - misleading sebelum patch: pengguna dari `Riwayat` masih melihat label `Jurnal`, back button bergantung penuh pada history stack, dan CTA write/payment/attachment mutation tetap muncul seperti di workspace aktif
  - setelah patch, detail dari `Riwayat` tetap berada dalam completed/history context, back route eksplisit kembali ke `Riwayat`, dan write affordance history ditutup
  - tidak ada endpoint, payload, schema, atau lifecycle domain inti yang berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - back route history sekarang eksplisit; bila suatu saat history page butuh mempertahankan filter/search via URL, itu perlu task terpisah

### [2026-04-19] `UCW-128` - Implementasikan `Riwayat` v1 sebagai completed-only surface
- Status: `validated`
- Ringkasan:
  - surface `Riwayat` dipisahkan dari `Jurnal` aktif dan `Recycle Bin` deleted/recovery agar completed record tetap terbaca sebagai histori yang benar
  - read model tetap mengikuti source of truth server yang dibekukan, tanpa mencampur row deleted ke histori biasa
  - route dan CTA diselaraskan secukupnya agar surface baru tetap ringkas dan mobile-first
- File berubah:
  - `src/pages/HistoryPage.jsx`
  - `src/App.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `src/lib/transactions-api.js`
  - `api/transactions.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `Riwayat` sekarang punya route dedicated dan membaca completed/history record server-side dari `/api/transactions?view=history`
  - completed-only surface dibedakan dari `Jurnal` aktif dan `Recycle Bin` deleted/recovery, tanpa mencampur row deleted ke histori biasa
  - `Jurnal` mendapat CTA cepat ke `Riwayat` dan `Recycle Bin`, sehingga flow lintas surface inti tetap nyambung
  - validasi `npm.cmd run lint` dan `npm.cmd run build` keduanya lolos

### [2026-04-19] `UCW-127` - Harden smoke-flow core release lintas surface inti
- Status: `validated`
- Ringkasan:
  - naming ledger aktif diselaraskan kembali ke `Jurnal` agar tidak drift dengan freeze yang memisahkan `Jurnal` dari `Riwayat`
  - archive dari detail `Jurnal` dan `Pembayaran` sekarang mendarat ke `Recycle Bin`, jadi flow recovery terlihat langsung setelah action
  - breakdown `Unit Kerja` sekarang bisa membuka source surface yang relevan tanpa payload atau endpoint baru
- File berubah:
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/PaymentPage.jsx`
  - `src/pages/ProjectsPage.jsx`
  - `src/components/ProjectReport.jsx`
  - `src/lib/transaction-presentation.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - flow yang diverifikasi: `Dashboard -> Jurnal -> Detail -> Pembayaran -> Recycle Bin`, `Halaman Absensi -> Catatan Absensi -> Rekap -> Tagihan Upah`, `Unit Kerja -> breakdown -> source surface`, dan akses `Tim` via route existing
  - gap yang ditemukan: ledger aktif masih berlabel `Riwayat`, CTA loan payment memakai label misleading, archive dari detail/payment melempar user ke landing yang tidak menunjukkan recovery state, dan breakdown `Unit Kerja` belum punya jalur ke domain sumber
  - tidak ada endpoint/payload baru; patch tetap di route, CTA, naming, dan presentasi yang langsung terkait
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - navigasi breakdown `Unit Kerja` untuk biaya gaji bergantung pada `salary bill` relation yang memang sudah ikut di payload detail; bila payload itu berubah di masa depan, fallback navigasi akan hilang sampai route sumber disesuaikan

### [2026-04-19] `UCW-126` - Ganti toggle multi-opsi dengan layout wrap-safe agar mobile tidak melebar
- Status: `validated`
- Ringkasan:
  - komponen reusable baru dipakai untuk opsi lebih dari dua agar layout tidak memaksa satu baris horizontal di mobile
  - `Tim`, `HRD pipeline`, `Beneficiary`, dan `Stok` sekarang memakai layout wrap-safe untuk status/role/filter yang multi-opsi
  - toggle dua opsi tetap memakai design existing sehingga surface dua-tab seperti attendance tidak berubah
- File berubah:
  - `src/components/ui/AppPrimitives.jsx`
  - `src/components/TeamInviteManager.jsx`
  - `src/components/HrdPipeline.jsx`
  - `src/components/BeneficiaryList.jsx`
  - `src/pages/StockPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state break yang ditemukan: `AppToggleGroup` lama memaksa grid horizontal dengan min-width per opsi, sehingga role/status/filter dengan lebih dari dua opsi bisa memperlebar layar
  - `AppWrapToggleGroup` baru menjaga opsi multi-opsi tetap wrap-safe tanpa mengubah lifecycle/data contract yang sudah dihardening
  - 2-tab layout existing tetap dipertahankan untuk surface yang memang hanya punya dua opsi
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - label opsi yang sangat panjang tetap bisa membuat tinggi control bertambah, tetapi tidak lagi memaksa overflow horizontal

### [2026-04-19] `UCW-125` - Polish `Halaman Tim` agar layout mobile-first tetap stabil
- Status: `validated`
- Ringkasan:
  - layout halaman Tim dipadatkan ulang supaya tidak break di mobile Telegram Mini Web
  - lifecycle invite/member yang sudah dihardening tetap dipakai apa adanya; task ini hanya memperbaiki shell, hierarchy, dan scanability
  - action invite / role / suspend tetap tersedia, tetapi disusun ulang agar lebih stabil di viewport sempit
- File berubah:
  - `src/pages/TeamInvitePage.jsx`
  - `src/components/TeamInviteManager.jsx`
  - `src/pages/MorePage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state UI break yang ditemukan: action controls invite sebelumnya menempel di slot header `PageSection`, sehingga pada viewport sempit layout terasa sempit dan kurang stabil
  - `Halaman Tim` sekarang menaruh composer invite sebagai blok body tersendiri, jadi header tetap ringkas dan controls tidak memaksa wrap di baris judul
  - list anggota tetap memakai action sheet existing dan lifecycle truth dari task hardening sebelumnya tidak berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - jika tombol toggle role bertambah panjang di masa depan, blok composer invite masih bergantung pada panjang label opsi statis dan mungkin perlu penyesuaian lebar lagi

### [2026-04-19] `UCW-124` - Hardening `Tim` agar invite dan membership lifecycle tetap selaras dengan server truth

- Status: `validated`
- Ringkasan:
  - invite token dan membership list sekarang membaca lifecycle label yang lebih jelas dari server truth dan state store yang disinkronkan ulang setelah action sensitif
  - `Tim` tetap dipertahankan sebagai core support/admin capability, tanpa mengubah auth architecture besar atau menambah RBAC engine baru
  - role/status membership lebih konsisten antara UI dan server truth, sementara invite yang tampil juga membawa status lifecycle eksplisit
- File berubah:
  - `src/pages/TeamInvitePage.jsx`
  - `src/components/TeamInviteManager.jsx`
  - `src/store/useAuthStore.js`
  - `src/store/useTeamStore.js`
  - `api/auth.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing `Tim` lifecycle yang ditemukan: auth bootstrap membaca `team_members`, sementara page team invite bergantung pada active team list dan invite terakhir dari store lokal
  - drift yang ditemukan: badge status member dan lifecycle invite belum eksplisit; status server hanya tampil sebagai raw label dan invite terbaru hanya tersimpan lokal setelah create
  - domain lain tidak berubah, dan tidak ada helper/descriptive UI copy baru yang ditambahkan
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - lifecycle invite yang di-load dari `invite_tokens` bergantung pada izin read server yang sudah ada; jika RLS berubah, invite terakhir bisa kembali kosong walau membership tetap tampil

### [2026-04-19] `UCW-87` - Hardening `Unit Kerja` summary agar report hanya membaca server truth final

- Status: `validated`
- Ringkasan:
  - portfolio overview `Unit Kerja` sekarang membaca `portfolioSummary` server-side dari `/api/records?resource=reports`, bukan lagi menghitung total lintas proyek di client
  - payload report diperluas dengan total income, total expense, dan breakdown expense server-side agar agregasi finance tidak drift dari source truth final
  - summary project list tetap memakai data relasional final dari `vw_project_financial_summary` dan layar report tetap ringkas mobile-first
- File berubah:
  - `api/records.js`
  - `src/lib/reports-api.js`
  - `src/store/useReportStore.js`
  - `src/components/ProjectReport.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - state existing report yang ditemukan: project list sudah baca `vw_project_financial_summary`, tetapi overview portfolio masih dirakit di client dari row project
  - drift yang ditemukan: total income dan total biaya pada overview tidak memakai payload server secara langsung, sehingga ringkasan bergantung pada kalkulasi client
  - payment/correction logic tidak berubah, dan tidak ada helper/descriptive UI copy baru yang ditambahkan
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - payload report kini membawa field ringkasan tambahan; jika ada consumer lama di luar `ProjectReport`, mereka perlu membaca default baru atau tetap aman dengan fallback nol

### [2026-04-19] `UCW-120` - Rekap direct-action implementation + confirmation sheet

- Status: `validated`
- Ringkasan:
  - aksi `Rekap` sekarang membuka sheet konfirmasi kontekstual dari item harian atau pekerja, lalu mengeksekusi rekap langsung dari context yang dipilih
  - section rekap besar di bawah `Catatan Absensi` diparkir dari flow utama, sehingga rekap tidak lagi diarahkan ke modul payroll besar
  - sukses ditampilkan sebagai toast ringkas, sementara kegagalan ditampilkan sebagai fallback/error ringkas di sheet konfirmasi
- File berubah:
  - `src/components/PayrollAttendanceHistory.jsx`
  - `src/pages/PayrollPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - tab `Harian` dan `Pekerja` sama-sama memicu rekap langsung dari item list, bukan dari modul payroll besar di bawah halaman
  - sheet konfirmasi membedakan konteks harian multi-worker dan konteks worker dengan date range

### [2026-04-19] `UCW-121` - Rekap result-state hardening

- Status: `validated`
- Ringkasan:
  - item fully billed tidak lagi menawarkan aksi `Rekap`
  - konteks rekap di sheet konfirmasi memakai eligible record count supaya hasilnya tidak terlihat ambigu
  - result state partial-success dibuat lebih eksplisit melalui toast ringkas setelah submit
- File berubah:
  - `src/components/PayrollAttendanceHistory.jsx`
  - `src/pages/PayrollPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`

### [2026-04-19] `UCW-122` - Verification + fix rekap backend readiness and ledger list alignment

- Status: `validated`
- Ringkasan:
  - verifikasi runtime menemukan akar gagal rekap ada di backend function dan schema `bills`, bukan hanya di UI trigger
  - eksekusi rekap dipindah ke boundary `api/records` agar auth/readiness write payroll konsisten dengan read path yang sudah dipakai
  - list `Harian` dan `Pekerja` dialihkan ke shell card yang sama dengan ritme visual halaman `Jurnal/Ledger`
- File berubah:
  - `api/records.js`
  - `src/lib/records-api.js`
  - `src/pages/PayrollPage.jsx`
  - `src/components/PayrollAttendanceHistory.jsx`
  - `supabase/migrations/20260419103000_fix_salary_bill_function_runtime_and_scope.sql`
  - `supabase/migrations/20260419104000_allow_non_expense_bills.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `select public.fn_generate_salary_bill(...)` diuji via transaction rollback di database aktif dan berhasil setelah patch

### [2026-04-19] `UCW-123` - Verification + semantics hardening + restore-tree correction untuk `Riwayat` / `Recycle Bin`

- Status: `validated`
- Ringkasan:
  - verifikasi memisahkan state existing antara `Riwayat` transaksi aktif/completed dan `Recycle Bin` deleted/recovery, lalu menemukan kebocoran semantik pada header recycle bin dan beberapa restore leaf
  - guard restore diperketat agar child payment dan attachment tidak bisa dipulihkan saat parent masih deleted
  - restore parent `Pengeluaran` dibetulkan agar direct-paid tanpa child `bill` tidak dipaksa lewat tree payable
- File berubah:
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `api/records.js`
  - `api/transactions.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - surface `Riwayat` tetap membaca transaksi aktif/completed, sedangkan `Recycle Bin` hanya menampilkan row deleted/recoverable
  - child leaf restore untuk `bill_payments`, `loan_payments`, dan `expense_attachments` sekarang tertahan sampai parent aktif kembali
  - deleted `attendance_records` yang sudah billed atau sudah terkait `salary_bill` tidak lagi muncul sebagai recovery item dan tidak bisa dipulihkan dari recycle bin transaksi
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - tree restore untuk domain sensitif sekarang lebih ketat; jika ada data lama yang parent-child relation-nya sudah inkonsisten di database, restore bisa berhenti di guard baru sampai parent dibenahi lebih dulu

### [2026-04-19] `UCW-119` - PayrollManager rekap context prefill hardening

- Status: `validated`
- Ringkasan:
  - context rekap dari tab `Harian` dan `Pekerja` sekarang dipakai untuk memprefill area rekap di `PayrollManager`, bukan hanya memberi highlight visual
  - group yang relevan diprioritaskan di daftar rekap dan auto-focus diarahkan ke konteks yang aktif agar flow tetap terasa sesuai mode tab
  - generate payroll, correction rule, payment lifecycle, dan schema tetap tidak berubah
- File berubah:
  - `src/components/PayrollManager.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - mode `Harian` tetap membawa worker set relevan, tetapi sekarang group terkait diprioritaskan di rekap manager dan auto-scroll ke konteks aktif
  - mode `Pekerja` tetap membawa worker target plus rentang tanggal, lalu manager memfokuskan group worker tersebut tanpa memaksa perubahan flow generate
  - highlight visual masih ada sebagai penanda tambahan, namun bukan satu-satunya konteks
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - auto-focus bergantung pada group yang tersedia di payload current; jika data attendance kosong, manager tetap jatuh ke daftar normal tanpa prefill aktif

### [2026-04-19] `UCW-118` - Rekap UX + context hardening untuk payroll workspace

- Status: `validated`
- Ringkasan:
  - mode `Harian` dan `Pekerja` sekarang membawa context rekap yang berbeda saat CTA `Rekap` dipilih
  - workspace rekap payroll menandai group yang relevan dari context aktif tanpa mengubah generate payroll, correction rule, atau payment lifecycle
  - tidak ada perubahan read endpoint karena payload existing sudah cukup untuk hardening context ini
- File berubah:
  - `src/components/PayrollAttendanceHistory.jsx`
  - `src/components/PayrollManager.jsx`
  - `src/pages/PayrollPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - tab `Harian` tetap merepresentasikan rekap per hari untuk banyak worker, sementara tab `Pekerja` tetap merepresentasikan rekap per worker dengan rentang tanggal
  - CTA `Rekap` sekarang meneruskan context aktif ke area payroll manager sehingga highlight context mengikuti mode tab yang dipilih
  - worker tetap tampil sebagai parent operasional payroll pada mode `Pekerja`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - highlight context hanya visual dan mengikuti payload/history yang sudah ada; jika struktur group berubah, mapping context perlu diselaraskan lagi

### [2026-04-19] `UCW-117` - Verifikasi swap bottom-nav payroll / Unit Kerja

- Status: `validated`
- Ringkasan:
  - bottom nav repo aktual sudah menampilkan workspace payroll lewat tab `Payroll` ke route `/payroll`
  - `Unit Kerja` sudah keluar dari bottom nav dan tetap tersedia dari `More`
  - tidak ada patch code tambahan yang diperlukan karena state current branch sudah sesuai brief
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - swap bottom-nav sudah ada di repo aktual: `Payroll` berada di bottom nav, sementara `Unit Kerja` hanya muncul di `More`
  - `Halaman Absensi` existing tetap menjadi surface input harian via route `/attendance/new`
  - generate payroll, correction rule, payment lifecycle, dan schema/migration tetap tidak berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - karena task ini bersifat verifikasi, risiko utama hanya drift jika nav config diubah lagi tanpa pembaruan dokumen progres

### [2026-04-19] `UCW-115` - Implementasi `Catatan Absensi` v1 sebagai halaman histori/filter/rekap

- Status: `validated`
- Ringkasan:
  - route baru `Catatan Absensi` ditambahkan sebagai surface payroll v1 yang terpisah dari halaman input absensi existing
  - halaman baru menyediakan filter bulan, filter worker, list riwayat absensi yang dikelompokkan per worker, dan CTA ke flow rekap payroll existing
  - read path baru di `api/records` hanya menambah query ringan histori absensi; generate, payment, dan correction logic tetap tidak berubah
- File berubah:
  - `src/pages/CatatanAbsensiPage.jsx`
  - `src/pages/AttendancePage.jsx`
  - `src/App.jsx`
  - `src/lib/records-api.js`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `Catatan Absensi` kini hidup di route `/attendance`, sementara `Halaman Absensi` existing tetap di `/attendance/new`
  - filter bulan dan worker bekerja di atas `attendance_records` dan worker relation, lalu hasilnya dikelompokkan per worker sebagai parent konteks operasional
  - CTA rekap diarahkan ke flow payroll existing tanpa mengubah generate rule, payment lifecycle, atau correction rule
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - CTA `Buka Rekap` masih membuka flow payroll existing secara umum; belum ada pre-filtering worker/date-range ke manager rekap agar scope task tetap sempit

### [2026-04-19] `UCW-116` - Koreksi UX `Catatan Absensi` v2 agar tab Harian/Pekerja dan action sheet lebih minimalis

- Status: `validated`
- Ringkasan:
  - workspace payroll `Catatan Absensi` sekarang menampilkan title lalu tab `Harian` dan `Pekerja` tanpa action header tambahan
  - list harian dan list pekerja diringkas menjadi row minimalis dengan bottom sheet aksi per konteks
  - generate payroll, payment lifecycle, correction rule, dan schema tetap tidak berubah
- File berubah:
  - `src/components/PayrollAttendanceHistory.jsx`
  - `src/pages/PayrollPage.jsx`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `Catatan Absensi` tetap hidup di workspace `Payroll`, sementara `Halaman Absensi` existing tetap menjadi surface input harian
  - tab `Harian` menampilkan daftar per hari dengan aksi `Rekap`, `Edit Absensi`, dan `Detail`; tab `Pekerja` menampilkan daftar per worker dengan aksi `Rekap` dan `Detail`
  - CTA rekap tetap memakai flow payroll existing, dan read endpoint history tidak diperluas
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - detail/edit flow attendance harian masih bergantung pada route edit attendance existing, jadi perlu dipertahankan saat perubahan UI berikutnya

### [2026-04-19] `UCW-114` - Hardening `Catatan Absensi` / `Tagihan Upah` agar payroll read/detail tetap settlement-aware

- Status: `validated`
- Ringkasan:
  - `Catatan Absensi` dipresentasikan sebagai workspace operasional payroll harian, bukan row utama ledger finansial
  - `Tagihan Upah` dipresentasikan lebih jelas sebagai derived payroll payable dengan settlement awareness yang konsisten
  - page pembayaran payroll mengikuti label payroll payable yang lebih spesifik tanpa mengubah generate flow, correction rule, atau payment lifecycle
- File berubah:
  - `src/lib/transaction-presentation.js`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/PaymentPage.jsx`
  - `src/components/AttendanceForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - attendance record sekarang terbaca sebagai `Catatan Absensi`, sementara payroll payable memakai label `Tagihan Upah` dan settlement awareness yang lebih eksplisit
  - detail payroll menampilkan konteks absensi, pekerja, proyek, tanggal, status kehadiran, dan ringkasan tagihan upah tanpa misleading ke identitas domain baru
  - generate payroll flow, correction rule, payment lifecycle, dan formula bisnis tetap tidak berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - surface lain yang belum memakai helper presentasi terpusat mungkin masih menampilkan wording payroll lama; itu sengaja dibiarkan agar scope task tetap sempit

### [2026-04-19] `UCW-113` - Hardening `Dana Masuk / Pinjaman` agar settlement awareness dan read-model tetap konsisten

- Status: `validated`
- Ringkasan:
  - label parent loan diselaraskan menjadi `Dana Masuk / Pinjaman` pada list dan detail yang memakai helper presentasi terpusat
  - summary loan kini menampilkan settlement awareness yang lebih eksplisit tanpa mengubah formula bisnis
  - detail loan menampilkan pokok, tenor, jatuh tempo, kreditor, sisa kewajiban, dan penalti snapshot jika ada
- File berubah:
  - `src/lib/transaction-presentation.js`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/Dashboard.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `unpaid / partial / paid` tetap settlement awareness pada parent loan, bukan identitas domain baru
  - read/detail loan sekarang menampilkan label dan ringkasan yang lebih konsisten dengan freeze wording
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - dashboard dan list transaksi mengikuti label helper baru; bila ada surface lain yang masih memakai label loan lama, perlu sweep terpisah agar wording tetap sinkron

### [2026-04-19] `UCW-112` - Polish UI `Stok Barang` agar history lebih minimalis dan sheet stock-out lebih ringkas

- Status: `validated`
- Ringkasan:
  - riwayat stok terbaru disederhanakan menjadi icon, nama barang, jumlah movement, dan waktu
  - badge/source label di list history dihapus agar tampilan mobile lebih ringan
  - bottom sheet stock-out tetap kontekstual dari `Barang Aktif`, dengan field `Barang` dan `Catatan / alasan singkat` dihapus
- File berubah:
  - `src/pages/StockPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - aksi stock-out tetap dipicu dari item `Barang Aktif`
  - history tetap bisa membuka dokumen sumber lewat interaksi item tanpa menambah beban visual di list
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - sheet stock-out kini bergantung pada konteks barang dari row yang diklik; itu sengaja untuk menghindari hidden selection

### [2026-04-19] `UCW-111` - Migration sweep kecil gate sensitif ke capability contract terpusat

- Status: `validated`
- Ringkasan:
  - beberapa gate sensitif yang paling jelas dipindahkan dari `allowedRoles` lama ke `requiredCapability`
  - capability contract terpusat sekarang dipakai oleh master surface dan team invite surface yang memang sudah jelas mapping-nya
  - scope tetap kecil; gate lain yang masih ambigu sengaja dibiarkan memakai pola lama
- File berubah:
  - `src/components/MasterDataManager.jsx`
  - `src/pages/MasterFormPage.jsx`
  - `src/pages/MasterRecycleBinPage.jsx`
  - `src/components/TeamInviteManager.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - master data admin surface, master form, master recycle bin, dan team invite manager kini membaca capability contract terpusat
  - tidak ada perubahan perilaku bisnis di payment, payroll, stock math, atau dokumen barang
  - server-side authorization tidak berubah karena sweep ini murni UI gate migration
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - gate yang sengaja belum dimigrasikan masih memakai `allowedRoles` lama, jadi contract split ini memang bertahap

### [2026-04-19] `UCW-110` - Polish UI `Stok Barang` untuk aksi kontekstual dan history yang ringkas

- Status: `validated`
- Ringkasan:
  - list `Barang Aktif` menjadi entry point aksi stock-out manual; tap item membuka flow contextual bottom sheet untuk barang terpilih
  - riwayat stok terbaru diringkas, CTA dokumen sumber dipindah ke interaction pada item, dan helper text berlebih dihapus
  - write path, atomicity, role gating, dan contract stok tetap tidak berubah
- File berubah:
  - `src/pages/StockPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - stock-out manual sekarang dipicu dari item barang aktif, bukan tombol global terpisah
  - history lebih ringkas dan tetap membuka dokumen sumber lewat interaksi row bila tersedia
  - tidak ada perubahan pada source-of-truth stok atau akses capability
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - baris history tanpa `expense_id` tidak punya CTA dokumen sumber, sesuai data yang tersedia

### [2026-04-19] `UCW-109` - Centralize role capability contract untuk gate sensitif yang sudah aktif

- Status: `validated`
- Ringkasan:
  - contract capability sensitif dipusatkan ke helper eksplisit `src/lib/capabilities.js`
  - manual stock-out sekarang membaca capability yang sama di UI dan server, lalu gate sensitif lain yang murah ikut memakai `requiredCapability`
  - behavior bisnis stock-out, atomicity, dan source-of-truth stok tetap tidak berubah
- File berubah:
  - `src/lib/capabilities.js`
  - `src/components/ProtectedRoute.jsx`
  - `src/pages/StockPage.jsx`
  - `src/pages/MasterPage.jsx`
  - `src/pages/PayrollPage.jsx`
  - `src/pages/TeamInvitePage.jsx`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - helper capability baru jadi source singkat untuk manual_stock_out, master_data_admin, team_invite, dan payroll_access
  - server-side authorization manual stock-out membaca capability helper yang sama dengan UI gating
  - call site lain yang belum dipusatkan tetap bisa memakai `allowedRoles` lama sehingga scope tetap ketat
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - capability contract masih sengaja sempit; kalau ada gate sensitif baru, helper ini perlu diperluas secara eksplisit

### [2026-04-19] `UCW-108` - Rapikan history/detail stok agar audit trail lebih jelas dibaca

- Status: `validated`
- Ringkasan:
  - histori movement di `Stok Barang` dibuat lebih audit-friendly dengan badge Masuk/Keluar, source label yang jelas, Unit Kerja, waktu, dan catatan singkat
  - CTA ringan ke dokumen sumber ditambahkan untuk movement yang punya `expense_id`, tanpa menambah write path baru
  - source-of-truth stok, atomicity, dan role gating tetap tidak berubah
- File berubah:
  - `src/pages/StockPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - movement inbound dari dokumen barang tetap terbaca lebih jelas, dan manual_out tetap terlihat sebagai sumber terpisah
  - Unit Kerja serta catatan tampil di history bila ada di payload
  - link dokumen sumber muncul hanya ketika payload memang membawa `expense_id`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - CTA dokumen sumber bergantung pada route `/transactions/:id`; jika route itu berubah, link perlu disesuaikan

### [2026-04-19] `UCW-107` - Harden role gating manual stock-out `Stok Barang` untuk UI dan server

- Status: `validated`
- Ringkasan:
  - role non-authorized tidak lagi bisa membuka sheet atau submit manual stock-out dari `Stok Barang`
  - CTA dan sheet manual stock-out hanya tampil untuk role yang diizinkan, sementara server tetap menjadi source of truth untuk penolakan akses
  - flow atomic, project context, negative stock block, dan source-of-truth stok tidak diubah
- File berubah:
  - `src/pages/StockPage.jsx`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - role `Owner`, `Admin`, dan `Logistik` tetap bisa memakai flow stock-out manual
  - role lain, termasuk `Viewer`, diblok di UI dan di server walau request dikirim langsung
  - tidak ada perubahan ke stock math, atomicity, atau contract dokumen barang
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - jika role matrix repo berubah, daftar role allowed perlu diselaraskan lagi di UI dan API

### [2026-04-19] Hotfix `StockPage` blank screen setelah atomic stock-out hardening

- Status: `validated`
- Ringkasan:
  - memperbaiki crash render di `StockPage` yang terjadi karena `loadOverview` dipakai sebelum dideklarasikan pada dependency `useCallback`
  - page stok kembali termuat normal tanpa mengubah contract stock-out atomic yang baru saja ditambahkan
- File berubah:
  - `src/pages/StockPage.jsx`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - blank screen pada halaman stok tidak lagi terjadi setelah hook order dibetulkan
  - stock-out atomic, project context, dan refresh overview tetap memakai path yang sama
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - tidak ada perubahan contract baru; risiko utama hanya memastikan hook order tetap stabil jika page stok diubah lagi

### [2026-04-19] `UCW-106` - Atomic manual stock-out `Stok Barang` via server RPC

- Status: `validated`
- Ringkasan:
  - manual stock-out dipindah ke RPC server-side kecil supaya update `materials.current_stock` dan insert `stock_transactions` terjadi dalam satu transaksi database
  - compensating rollback manual di API dihapus, dan negative stock tetap diblok di server function sebelum commit final
  - `Unit Kerja` dan team access tetap tervalidasi, sementara UI stock page tetap refresh dari source resmi setelah submit
- File berubah:
  - `api/records.js`
  - `src/lib/records-api.js`
  - `src/pages/StockPage.jsx`
  - `supabase/migrations/20260419090000_create_atomic_manual_stock_out_function.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - write path sekarang satu RPC atomic, jadi risiko mismatch antara stock master dan stock transaction berkurang tajam
  - client tetap mengirim `project_id` eksplisit dan server function tetap memeriksa project aktif untuk team user
  - perubahan tidak menyentuh dokumen barang inbound-stock, payment, payroll, atau adjuster stok umum
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - migration `expense_line_item_id drop not null` harus diaplikasikan bersama fungsi RPC agar insert manual-out tetap lolos constraint live
  - jika fungsi RPC gagal diterapkan di database target, API manual stock-out akan gagal sampai migration itu tersedia

### [2026-04-19] `UCW-105` - Harden manual stock-out `Stok Barang` dengan konteks `Unit Kerja` eksplisit

- Status: `validated`
- Ringkasan:
  - flow manual stock-out sekarang wajib meminta `Unit Kerja` dari user sebelum submit
  - client mengirim `project_id` eksplisit ke API, dan server menolak project yang tidak aktif atau bukan milik team user
  - fallback tersembunyi `first active project` dihapus; histori movement kini menampilkan konteks project saat payload menyediakannya
- File berubah:
  - `api/records.js`
  - `src/lib/records-api.js`
  - `src/pages/StockPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - submit manual stock-out tidak bisa lolos tanpa `Unit Kerja` terpilih
  - API sekarang memvalidasi project aktif pada team user sebelum mencatat `stock_transactions`
  - negative stock block tetap server-authoritative dan tidak ada schema/payment/payroll/dokumen barang yang disentuh
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - jika master project aktif berubah, user harus memilih Unit Kerja aktif lain sebelum stock-out bisa lanjut
  - histori movement bergantung pada payload project relation yang valid; jika row lama tidak punya relasi project, UI tetap menampilkan material dan tanggal tanpa konteks project

### [2026-04-19] `UCW-100` - Hardening kontrak `Pengeluaran` ↔ `Tagihan` agar direct-paid dan payable tetap konsisten

- Status: `validated`
- Ringkasan:
  - expense yang langsung lunas tidak lagi dipresentasikan seolah punya open bill universal di ledger
  - expense yang masih payable tetap tampil sebagai `Tagihan` aktif, sementara detail expense tetap mempertahankan sejarah settlement untuk kedua mode
  - perubahan dibatasi ke presentation/read-model; create/update/delete payment dan schema tetap tidak disentuh
- File berubah:
  - `src/lib/transaction-presentation.js`
  - `src/pages/TransactionDetailPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - row expense settled sekarang tampil sebagai `Pengeluaran · Lunas` alih-alih label `Bill` yang menyiratkan open payable universal
  - detail expense tetap membuka riwayat tagihan untuk expense yang punya child settlement
  - tidak ada perubahan ke domain pembayaran, pinjaman, payroll, attachment tree, atau schema
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - beberapa row expense settled sekarang menampilkan label yang lebih generik; ini sengaja untuk menghindari false implication tentang open bill
  - detail page masih menampilkan histori settlement berbasis child bill, sehingga navigasi audit tetap bertahan

### [2026-04-19] `UCW-101` - Hardening kontrak `Dokumen Barang` ↔ stock movement agar surat jalan fisik, faktur finansial-only, dan conversion anti-double-count

- Status: `validated`
- Ringkasan:
  - `Surat Jalan Barang` kini menjadi jalur yang menggerakkan stok fisik, sementara `Faktur Barang` tetap financial-only di read/write contract material invoice
  - konversi dan edit menjaga tree data tanpa double count stok, dan validasi server menolak stok minus pada fase awal
  - perubahan dibatasi ke material invoice read/write contract dan payload store; payment, payroll, dan schema tidak disentuh
- File berubah:
  - `api/records.js`
  - `src/store/useTransactionStore.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - create/update material invoice dengan `document_type = surat_jalan` memeriksa ketersediaan stok sebelum insert/update dan menyinkronkan `stock_transactions`
  - payload store membedakan preset `surat_jalan` dan `faktur`, sehingga copy/default flow tetap mengikuti naming freeze
  - tidak ada perubahan pada domain pembayaran, payroll, atau manual stock adjustment
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - stock movement sekarang bergantung pada stock contract API records; jika kontrak payload material invoice berubah, store dan server harus diubah bersama
  - detail material invoice tetap memakai tree historis untuk audit, jadi row lama perlu tetap konsisten dengan source of truth yang sama

### [2026-04-19] `UCW-102` - Koreksi final kontrak `Dokumen Barang` dan wording settlement agar inbound stock, standalone faktur, dan parent-vs-settlement presisi

- Status: `validated`
- Ringkasan:
  - freeze package dikoreksi agar `Surat Jalan Barang` dan `Faktur Barang` sama-sama diakui sebagai stok masuk, sementara stock-out otomatis dari dokumen barang disupersede
  - wording settlement dibekukan ulang supaya `Pengeluaran`, `Faktur Barang`, `Tagihan Upah`, dan `Loan / Dana Masuk / Pinjaman` tetap pada domain parent masing-masing walau status `unpaid / partial / paid` berubah
  - implementasi material invoice disesuaikan kembali agar standalone faktur boleh stock-in, konversi tidak double count, dan validasi stock minus tetap keras
- File berubah:
  - `docs/freeze/00-index.md`
  - `docs/freeze/01-planning-decision-freeze.md`
  - `docs/freeze/02-prd-master.md`
  - `docs/freeze/03-source-of-truth-contract-map.md`
  - `docs/freeze/04-lifecycle-matrix.md`
  - `docs/freeze/05-ai-execution-guardrails.md`
  - `api/records.js`
  - `src/store/useTransactionStore.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `Surat Jalan Barang` dan `Faktur Barang` sama-sama menghasilkan stock-in path pada API records, dengan correction layer yang mencegah double count ketika dokumen dikonversi
  - wording freeze kini menyebut settlement child sebagai awareness/sisa kewajiban, bukan penentu identitas parent domain
  - `Payment Receipt PDF` dan payment lifecycle tetap tidak berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - stock contract sekarang bergantung pada konsistensi antara trigger stock legacy dan correction layer API; jika payload material invoice berubah, helper harus diselaraskan lagi
  - history ledger stock masih mengikuti skema active-document sync, jadi task stock page terpisah nanti harus membaca contract ini secara eksplisit

### [2026-04-19] `UCW-103` - Buka modul `Stok Barang` v0 sebagai surface monitoring read-first

- Status: `validated`
- Ringkasan:
  - route resmi `Stok Barang` dibuka sebagai surface monitoring read-first
  - page membaca `materials.current_stock` dan `stock_transactions`, menampilkan status stok sederhana, serta menegaskan stock-out manual tetap planned untuk fase berikutnya
  - tidak ada write path baru; scope tetap read-first dan mobile ringan
- File berubah:
  - `api/records.js`
  - `src/lib/records-api.js`
  - `src/pages/StockPage.jsx`
  - `src/pages/MorePage.jsx`
  - `src/App.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - route stok resmi tersedia di `MainLayout` dan dapat diakses dari `More`
  - page membaca `materials.current_stock` dan `stock_transactions` via `api/records` read boundary
  - stok ditampilkan sebagai monitoring read-first dengan status sederhana, search ringan, dan info stock-out manual yang masih planned
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - endpoint stok baru harus tetap read-only dan tidak boleh menambah write path
  - UI stok harus tetap ringan dan tidak mengganggu layout shell existing

### [2026-04-19] `UCW-104` - Buka manual stock-out v1 terbatas dari `Stok Barang`

- Status: `validated`
- Ringkasan:
  - flow stock-out manual dibuka dari route `Stok Barang` sebagai write path API-only yang sangat sempit
  - server mengurangi `materials.current_stock`, mencatat `stock_transactions` outbound/manual, dan memblok stok minus
  - scope tetap bukan inventory app penuh dan tidak menambah adjustment bebas
- File berubah:
  - `api/records.js`
  - `src/lib/records-api.js`
  - `src/pages/StockPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - route `Stok Barang` kini menyediakan CTA aktif untuk stock-out manual terbatas
  - server write path hanya lewat `api/records` resource `stock-manual-outs`
  - stok minus ditolak sebelum commit dan histori pergerakan ikut ter-refresh setelah submit
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - endpoint stock-out harus tetap satu pintu dan tidak boleh dipakai untuk adjustment bebas
  - stock page harus tetap ringan meski ditambah sheet input manual

### [2026-04-19] `UCW-99` - Alihkan create path `bill_payments` dan `loan_payments` ke API-owned boundary

- Status: `validated`
- Ringkasan:
  - `submitBillPayment` dan `submitLoanPayment` sekarang memakai API boundary resmi, bukan direct insert legacy dari store ke Supabase table
  - endpoint `bill-payments` di `api/records.js` dan `loan-payments` di `api/transactions.js` menangani insert, recalc parent settlement state, dan sinkronisasi status parent di server
  - setelah create sukses, client tetap refetch parent settlement state sehingga `Jurnal`/detail pembayaran tetap sinkron dengan source of truth resmi
- File berubah:
  - `src/store/usePaymentStore.js`
  - `src/lib/records-api.js`
  - `src/lib/transactions-api.js`
  - `api/records.js`
  - `api/transactions.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - direct insert `bill_payments` dan `loan_payments` di store sudah hilang dari create path utama
  - parent bill/loan dihitung ulang dari server boundary yang sama, jadi status `unpaid/partial/paid` tetap berasal dari source resmi
  - semantics delete/void/restore dan flow PDF tidak disentuh
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - create payment kini sepenuhnya bergantung pada API route yang sama dipakai oleh flow update/delete, sehingga perubahan kontrak payload di server harus tetap dijaga konsisten dengan store dan PaymentPage
  - `PaymentPage` belum diubah karena task ini hanya menutup legacy create path, bukan menata ulang UX pembayaran

### [2026-04-19] `UCW-98` - Selaraskan read model `Jurnal` agar `Tagihan Upah` tampil sebagai row bill dan attendance tidak lagi jadi row ledger utama

- Status: `validated`
- Ringkasan:
  - `Jurnal` sekarang membaca payroll payable sebagai row `Tagihan Upah` dari source `bill`, bukan sebagai row utama `attendance-record`
  - filter/search tetap bekerja, detail row payroll tetap bisa dibuka, dan attachment section tidak lagi muncul pada row payroll payable
  - perubahan dibatasi pada read-model/presentasi; tidak ada perubahan ke logic pembayaran, settlement, create/update/delete payroll, atau schema
- File berubah:
  - `api/transactions.js`
  - `src/lib/transaction-presentation.js`
  - `src/pages/TransactionDetailPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - row payroll payable tampil sebagai `Tagihan Upah` dan source attendance tidak lagi menjadi row ledger utama di `Jurnal`
  - `Riwayat` tetap konsisten karena payroll bill history masih dibaca dari source bill yang sama
  - attachment UI untuk payroll row tidak lagi dipasang, sehingga detail payroll tetap relevan tanpa menempel ke workspace absensi
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - filter `Tagihan` sekarang menjadi payables filter utama untuk row bill, jadi legacy URL atau asumsi lama yang masih memakai `attendance-record` hanya tersisa sebagai kompatibilitas internal
  - `PaymentPage` masih memakai wording generik tagihan karena task ini sengaja tidak menyentuh flow pembayaran

### [2026-04-19] `UCW-97` - Bekukan audit repo dan keputusan brainstorming menjadi package `docs/freeze`

- Status: `validated`
- Ringkasan:
  - menerbitkan package freeze resmi enam dokumen di `docs/freeze/` untuk menggantikan docs lama sebagai authority utama
  - membekukan keputusan produk final, PRD ringkas, contract map lintas domain, lifecycle matrix, dan guardrail AI dalam satu paket yang konsisten
  - menandai `docs/unified-crud-workspace-plan-2026-04-18.md` sebagai backlog operasional yang tunduk pada freeze package
- File berubah:
  - `docs/freeze/00-index.md`
  - `docs/freeze/01-planning-decision-freeze.md`
  - `docs/freeze/02-prd-master.md`
  - `docs/freeze/03-source-of-truth-contract-map.md`
  - `docs/freeze/04-lifecycle-matrix.md`
  - `docs/freeze/05-ai-execution-guardrails.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - package freeze sekarang menjawab apa produknya, siapa user utamanya, apa workspace utamanya, domain inti apa, source of truth tiap domain apa, lifecycle tiap domain bagaimana, dan apa yang tidak boleh dilakukan AI
  - konflik dengan docs lama dinormalisasi dengan prinsip repo reality + keputusan produk terbaru; area lama ditandai historis atau subordinate
  - `Stok Barang` masuk arsitektur sebagai modul planned/supporting tanpa mengubah gate core release saat ini
- Validasi:
  - `rg -n "^#|^##" docs/freeze/00-index.md docs/freeze/01-planning-decision-freeze.md docs/freeze/02-prd-master.md docs/freeze/03-source-of-truth-contract-map.md docs/freeze/04-lifecycle-matrix.md docs/freeze/05-ai-execution-guardrails.md`
  - `rg -n "Freeze Authority Update|UCW-97" docs/unified-crud-workspace-plan-2026-04-18.md docs/progress/unified-crud-workspace-progress-log.md`
- Risiko/regresi:
  - backlog implementasi lama yang belum diaudit terhadap freeze package berisiko memakai istilah atau boundary lama; brief berikutnya harus mengutip `docs/freeze/*`
  - beberapa write path legacy di repo masih ada sebagai debt teknis; package freeze hanya membekukan kontraknya, belum menghapus debt tersebut

### [2026-04-18] `UCW-91` - Brainstorm lanjutan dan kunci keputusan produk detail sebelum implementasi core release

- Status: `validated`
- Ringkasan:
  - memperluas PRD agar membahas detail operasional `bill`, `expense hutang`, partial payment, jurnal absensi, rekap salary bill, ledger besar, dan multi-user CRUD
  - menambah micro-task desain `UCW-92` sampai `UCW-96` supaya implementasi domain berikutnya tidak berjalan sambil menebak policy bisnis
  - merevisi dependency task implementasi core agar hardening code menunggu keputusan produk detail yang relevan
- File berubah:
  - `docs/prd-core-feature-release-2026-04-18.md`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - repo saat ini sudah punya fondasi `PaymentPage`, histori payment edit/hapus, `AttendanceForm`, dan `PayrollManager`, tetapi belum punya keputusan produk tertulis untuk daftar tagihan, koreksi absensi billed, pagination ledger besar, atau conflict multi-user
  - task implementasi sekarang lebih spesifik karena policy produk dipisahkan dulu dari coding slice
- Validasi:
  - `rg -n "7.7 Model operasional|7.8 Jurnal absensi|7.9 Ledger besar|7.10 Multi-user" docs/prd-core-feature-release-2026-04-18.md`
  - `rg -n "UCW-91|UCW-92|UCW-93|UCW-94|UCW-95|UCW-96" docs/unified-crud-workspace-plan-2026-04-18.md`
  - `rg -n "Current task|UCW-91" docs/progress/unified-crud-workspace-progress-log.md`
- Risiko/regresi:
  - beberapa keputusan di PRD ini masih berupa rekomendasi produk yang paling pragmatis untuk release inti; jika tim memilih model lain seperti `void/reversal` penuh sejak awal, backlog perlu disesuaikan lagi sebelum implementasi
  - current repo tetap belum punya test runner otomatis, jadi setiap task desain yang turun ke implementasi tetap harus mengandalkan audit manual + lint/build

### [2026-04-18] `UCW-92` - Kunci operating model `bill` dari `expense hutang` sampai daftar tagihan dan aksi `Bayar`

- Status: `validated`
- Ringkasan:
  - menambahkan helper route pembayaran bill agar dashboard, ledger detail, dan halaman detail memakai jalur yang sama
  - menyajikan action `Bayar Tagihan` pada item bill di dashboard recent activity
  - menampilkan aksi bayar pada menu list transaksi untuk bill / expense payable, termasuk kasus saat delete/edit sudah tidak relevan
  - menyamakan CTA pembayaran di detail transaksi supaya tidak ada label atau route yang berbeda-beda untuk bill yang sama
- File berubah:
  - `src/lib/transaction-presentation.js`
  - `src/pages/Dashboard.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - action `Bayar Tagihan` sekarang muncul dari surface yang memang dipakai operator harian: kartu bill terbaru di dashboard dan menu aksi list ledger
  - transaksi bill yang sudah lunas tidak lagi menampilkan CTA bayar karena route helper menolak status `paid`
  - detail transaksi memakai helper route yang sama sehingga tidak ada divergensi antara list dan detail
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - visibilitas action menu kini bergantung pada shape status bill/payable dari payload transaksi; jika payload upstream berubah, helper route perlu disesuaikan
  - task berikutnya beralih ke `UCW-94` setelah boundary partial payment dan history action diputuskan

### [2026-04-18] `UCW-93` - Kunci UX partial payment, histori pembayaran, edit/hapus, dan boundary reverse/delete

- Status: `validated`
- Ringkasan:
  - menegaskan bahwa partial payment adalah flow resmi pada `PaymentPage`, dengan bantuan copy yang eksplisit bahwa nominal tersisa dihitung ulang otomatis
  - menyamakan boundary destructive untuk bill payment dan loan payment agar action yang tampil di UI memakai label `Arsipkan` dan bukan `Hapus`
  - menyesuaikan aksi arsip tagihan dan pembayaran sehingga soft delete lebih jelas, sementara permanent delete tetap dibatasi recycle bin
- File berubah:
  - `src/pages/PaymentPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - histori pembayaran bill dan loan tetap bisa diedit atau diarsipkan dari workspace payment yang sama
  - boundary delete sekarang konsisten dengan PRD: yang dipakai di workspace aktif adalah arsip/soft delete, bukan permanent delete
  - partial payment masih menggunakan validasi sisa maksimal dan reload parent record setelah save/edit/delete
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - label `Arsipkan` mengandalkan pemahaman user bahwa data masih bisa dipulihkan dari recycle bin; jika tim ingin wording lebih eksplisit, task copywriting terpisah bisa ditambahkan
  - loan payment boundary masih mengikuti pola soft delete yang sama dan belum dipisah menjadi flow reverse yang lebih kaya, sesuai keputusan PRD release inti

### [2026-04-18] `UCW-94` - Kunci jurnal absensi CRUD, lock rule `billed`, dan rekap menjadi salary bill

- Status: `validated`
- Ringkasan:
  - row absensi yang sudah `billed` atau memiliki `salary_bill_id` kini ditandai read-only di `AttendanceForm`, termasuk disable status toggle dan catatan
  - submit sheet absensi sekarang hanya mengirim row yang masih editable, sementara server menolak perubahan pada row billed agar lock rule tidak bisa dibypass
  - `PayrollManager` sekarang menampilkan CTA langsung ke tagihan gaji yang baru dibuat, supaya alur rekap menuju payment workspace lebih jelas
- File berubah:
  - `src/components/AttendanceForm.jsx`
  - `src/components/PayrollManager.jsx`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - editor absensi harian tetap fokus untuk row `unbilled`, sedangkan row yang sudah dibundel menjadi salary bill tidak lagi bisa diubah dari sheet
  - tindakan delete pada absensi billed tetap dikunci oleh server, sehingga perubahan relasi tagihan tidak bisa terjadi diam-diam dari UI
  - rekap payroll tetap menghasilkan salary bill baru dan operator bisa langsung lompat ke `PaymentPage`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - jika ada client lama yang masih mengirim row billed ke endpoint sheet absensi, API sekarang akan menolak request tersebut sebagai read-only
  - aturan ini mengasumsikan workflow billing gaji memang final dan koreksi harus dilakukan dari salary bill terkait, bukan inline edit pada sheet yang sudah ditagihkan

### [2026-04-18] `UCW-95` - Kunci strategi pagination, pencarian spesifik, dan akurasi dashboard pada ledger besar

- Status: `validated`
- Ringkasan:
  - `TransactionsPage` sekarang memakai pagination cursor server-side dengan pencarian ledger dan filter spesifik, bukan lagi filter lokal atas seluruh dataset
  - API transaksi menerima query `limit`, `cursor`, `search`, dan `filter` untuk workspace ledger, lalu mengembalikan `pageInfo` agar tombol muat berikutnya tetap stabil
  - summary dashboard sekarang dibaca dari `vw_transaction_summary`, sehingga perhitungan akumulasi tidak tergantung pada jumlah row yang dimuat di client
- File berubah:
  - `src/pages/TransactionsPage.jsx`
  - `src/lib/transactions-api.js`
  - `src/store/useDashboardStore.js`
  - `api/transactions.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - ledger besar sekarang punya jalur query yang lebih eksplisit: filter/search terjadi di API, hasil dipaginasi dengan cursor, dan tombol muat berikutnya mengambil page lanjutan tanpa membebani client dengan full list
  - dashboard summary tidak lagi bergantung pada `cashMutations` penuh di client; jika read model server ada, nilainya dipakai langsung
  - task berikutnya di stream ini bergeser ke `UCW-96` untuk policy multi-user CRUD dan conflict handling
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - backend ledger masih menggabungkan sumber transaksi yang ada sebelum paging; untuk skala yang jauh lebih besar, read model unified ledger di database tetap bisa jadi task lanjutan
  - `TransactionDetailPage` masih mengandalkan store workspace penuh untuk beberapa hydration path, jadi sinkronisasi penuh lintas halaman tetap perlu diawasi saat task berikutnya berjalan

### [2026-04-18] `UCW-96` - Kunci policy multi-user CRUD, role matrix, ownership display, dan conflict handling

- Status: `validated`
- Ringkasan:
  - menambahkan optimistic concurrency berbasis `updated_at` / `expectedUpdatedAt` pada jalur update, soft delete, restore, dan delete parent-child yang paling sensitif
  - meneruskan snapshot version dari form dan detail/list page ke store/API supaya konflik edit lintas user bisa ditolak di server, bukan hanya di UI
  - mengunci boundary multi-user CRUD agar role/ownership final bisa dibaca konsisten oleh task implementasi berikutnya
- File berubah:
  - `api/records.js`
  - `api/transactions.js`
  - `src/lib/records-api.js`
  - `src/lib/transactions-api.js`
  - `src/store/useTransactionStore.js`
  - `src/store/useIncomeStore.js`
  - `src/store/usePaymentStore.js`
  - `src/store/useBillStore.js`
  - `src/components/ExpenseForm.jsx`
  - `src/components/IncomeForm.jsx`
  - `src/components/LoanForm.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `src/pages/PaymentPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `src/pages/DeletedTransactionDetailPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - update yang bertabrakan antar user sekarang punya guard version di server, sehingga perubahan yang stale tidak bisa menimpa record terbaru secara diam-diam
  - payload create/edit/delete/restore di surface inti sudah meneruskan snapshot version yang relevan dari record aktif ke API
  - status task di plan dan progress log sudah dipindahkan dari ready ke validated agar stream bisa lanjut ke `UCW-79`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - client lama yang belum mengirim `expectedUpdatedAt` masih bisa tertolak saat mencoba update/delete record yang sudah berubah
  - policy conflict ini sengaja konservatif; kalau tim ingin merge otomatis, task khusus perlu dibuka karena aturan produk berubah

### [2026-04-18] `UCW-79` - Hardening `input pemasukan murni` dan visibilitas fee bill end-to-end

- Status: `validated`
- Ringkasan:
  - detail pemasukan proyek sekarang memuat ringkasan fee bill turunan jika sudah terbentuk, sehingga operator bisa melihat status pendanaan tanpa pindah ke surface lain
  - edit page untuk pemasukan proyek memaksa hydration ulang record agar child fee bill ikut ter-load dari sumber data relasional, bukan bergantung pada payload navigasi lama
  - `IncomeForm` tetap menjadi editor utama create/edit, sementara detail wrapper menampilkan konteks fee bill agar jalur termin proyek dan billing turunannya lebih mudah diaudit
- File berubah:
  - `src/store/useIncomeStore.js`
  - `src/pages/EditRecordPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - pemasukan proyek yang dibuka dari route langsung sekarang tetap bisa menampilkan fee bill turunan lewat load detail terhydrasi
  - jika fee bill sudah ada, user dapat langsung lompat ke `/payment/:billId` dari edit page untuk melihat atau mengelola pembayaran tagihan
  - task di plan sudah dipindahkan ke `validated` dan antrean aktif berlanjut ke `UCW-80`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - kartu fee bill pada edit page hanya muncul bila relasi bill memang sudah terbentuk; pemasukan lawas tanpa bill tetap tampil seperti record biasa
  - pembukaan langsung ke payment dari edit page mengasumsikan user memang perlu mengelola tagihan turunan dari termin proyek tersebut

### [2026-04-18] `UCW-80` - Hardening `expense umum` beserta bill, payment, dan attachment lifecycle

- Status: `validated`
- Ringkasan:
  - `ExpenseForm` tetap menjadi editor utama create/edit expense umum, sementara attachment section menerima `expenseId` hasil simpan sehingga lampiran bisa dikelola sebagai child record
  - `EditRecordPage` sekarang menampilkan ringkasan bill dan lampiran untuk expense umum sehingga operator bisa langsung melihat status tagihan dan volume attachment dari satu layar
  - jalur create/edit/delete/restore expense umum sudah tetap memakai snapshot version dan guard bill/payment yang sama, sehingga lifecycle parent-child tidak drift
- File berubah:
  - `src/pages/EditRecordPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - expense umum yang dibuka lewat edit page sekarang menampilkan status bill, sisa tagihan, dan total lampiran untuk memudahkan audit lifecycle
  - tombol `Buka Tagihan` tersedia dari edit page saat bill sudah terbentuk, sehingga user bisa lompat ke payment flow tanpa mencari manual
  - task di plan sudah dipindah ke `validated` dan antrean aktif berlanjut ke `UCW-81`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - ringkasan lampiran bergantung pada data attachment yang sudah di-load bersama expense; kalau record lama belum punya attachment child, kartu ringkasan tetap tampil kosong
  - expense material invoice juga memakai editor yang sama di jalur expense, jadi perubahan ringkasan ini ikut berlaku ke invoice material

### [2026-04-18] `UCW-81` - Hardening `material invoice` / `surat_jalan` dan jalur konversi parent-child

- Status: `validated`
- Ringkasan:
  - form faktur material sekarang mengunci edit saat bill sudah punya pembayaran, sehingga operator tidak mencoba mengubah parent child tree yang sudah berisi histori payment
  - edit dan detail material invoice tetap mempertahankan jalur konversi dari `surat_jalan` ke `faktur`, sementara line item disinkronkan lewat editor yang sama
  - form tetap memakai attachment child dan ringkasan total, tetapi guard UI-nya sekarang menutup jalur edit yang sudah berisiko drift
- File berubah:
  - `src/components/MaterialInvoiceForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - material invoice yang sudah memiliki pembayaran tidak lagi bisa diedit dari form, sehingga rule server-side dan UI-side sama-sama menolak lifecycle drift
  - jalur create/edit tetap mendukung supplier material contextual, line item list, dan attachment child yang melekat ke expense parent
  - status task di plan sudah dipindah ke `validated` dan antrean aktif berlanjut ke `UCW-82`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - invoice material lama yang sudah punya payment history akan tampil terkunci; koreksi harus lewat policy khusus bila tim ingin mengizinkannya
  - surat jalan yang belum dikonversi tetap editable karena belum memiliki payment history, sesuai alur parent-child yang disepakati

### [2026-04-18] `UCW-77` - Audit repo menyeluruh, reprioritasi backlog, dan buat PRD core feature release

- Status: `validated`
- Ringkasan:
  - mengaudit ulang progres aktual repo untuk fitur inti dan mengganti status domain di backlog agar mengikuti kondisi nyata UI/store/API/schema saat ini
  - menurunkan `UCW-54` sampai `UCW-63` ke status `deferred`, lalu menambah task `UCW-77` sampai `UCW-90` agar stream fokus ke penyelesaian core feature full-stack
  - menerbitkan PRD baru yang menggantikan arah lama `PRD_APP_IMPROVEMENT.md` untuk scope release inti
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
  - `docs/prd-core-feature-release-2026-04-18.md`
- Audit hasil:
  - repo aktual sudah lebih maju dari backlog UI yang tersisa: create/edit/pay/recycle sudah ada di banyak domain, tetapi report, PDF, dan permanent delete masih menjadi blocker release
  - source of truth produk sekarang dipindah ke plan + PRD baru, bukan dokumen lama yang masih berbicara tentang arsitektur repo berbeda
- Validasi:
  - `rg -n "UCW-77|UCW-78|UCW-90|deferred" docs/unified-crud-workspace-plan-2026-04-18.md`
  - `rg -n "Current task|UCW-77" docs/progress/unified-crud-workspace-progress-log.md`
  - `rg -n "PRD Core Feature Release|UCW-79|UCW-88" docs/prd-core-feature-release-2026-04-18.md`
- Risiko/regresi:
  - backlog UI shell yang ditunda tetap perlu dibuka lagi setelah gate core release selesai agar konsistensi visual jangka panjang tidak hilang
  - PRD baru ini akurat untuk kondisi repo per `2026-04-18`; jika ada perubahan kontrak besar setelahnya, plan dan PRD harus diaudit ulang bersama

### [2026-04-18] `UCW-76` - Perbaiki contract `supplier_name` expense agar save tidak gagal 23502

- Status: `validated`
- Ringkasan:
  - `ExpenseForm` sekarang mewajibkan supplier saat create, tetapi tetap bisa mempertahankan supplier snapshot saat edit
  - `useTransactionStore` dan `api/records.js` sekarang mengirim dan menyimpan `supplier_name`, sehingga insert/update tidak lagi mengirim `null`
- File berubah:
  - `src/components/ExpenseForm.jsx`
  - `src/store/useTransactionStore.js`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - create expense tidak lagi bisa lolos tanpa supplier karena picker `required` + store/API validation menutup jalur `null`
  - edit expense tetap aman bila nama supplier di snapshot ada meski relasi aktif tidak tersedia
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - expense lawas yang benar-benar tidak punya supplier name/snapshot tetap tidak bisa disimpan ulang sampai datanya dibetulkan dulu

### [2026-04-18] `UCW-47` - Tambahkan safe-area wrapper untuk 4 halaman More

- Status: `validated`
- Ringkasan:
  - Membungkus 4 halaman `More` dengan `AppViewportSafeArea` agar padding aman notch + max-width konsisten meski route tidak lewat `MainLayout`
  - Hierarchy header tetap memakai `FormHeader` → `PageHeader` dan body tetap memakai section/content yang sudah ada
- File berubah:
  - `src/pages/BeneficiariesPage.jsx`
  - `src/pages/HrdPage.jsx`
  - `src/pages/PayrollPage.jsx`
  - `src/pages/TeamInvitePage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Wrapper viewport memakai `env(safe-area-inset-*)` sehingga header tidak menempel tepi layar di perangkat notch
  - `Kembali` tetap mengarah ke `/more` lewat handler existing
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Spacing halaman More jadi mengikuti safe-area minimum; jika ada page lain di luar `MainLayout`, pattern ini perlu diadopsi juga agar konsisten

### [2026-04-18] `UCW-11` - Perluas recycle bin ke expense, invoice, payment history, attachment metadata, dan master data

- Status: `validated`
- Ringkasan:
  - Menambahkan recycle bin master data lewat halaman `MasterRecycleBinPage` dan route baru di app
  - Menyediakan helper store untuk memuat deleted master records dan memulihkan kembali project, category, supplier, creditor, profession, staff, worker, dan material
  - Menautkan halaman `MasterPage` ke entry point recycle bin agar master data terhapus bisa diakses dari menu yang sama
- File berubah:
  - `src/store/useMasterStore.js`
  - `src/pages/MasterRecycleBinPage.jsx`
  - `src/pages/MasterPage.jsx`
  - `src/App.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Recycle bin master sekarang menampilkan data deleted per domain master dan memakai source of truth restore yang sama dengan store aktif
  - Restore worker juga memulihkan wage rates terkait agar tree master tetap konsisten
  - UCW-11 tidak lagi tertahan oleh gap master recycle bin
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Restore worker ikut menghidupkan wage rates child; jika kelak perlu void lebih granular, perlu task turunan khusus
  - Permanent delete master belum dibuka untuk menghindari risiko tree orphan pada domain yang masih sensitif

### [2026-04-18] `UCW-01` - Bangun read model workspace transaksi terpisah dari dashboard summary

- Status: `validated`
- Ringkasan:
  - Audit menegaskan workspace read model transaksi sudah terpisah dari summary dashboard lewat endpoint dan store yang berbeda
  - Tidak ada code delta tambahan yang dibutuhkan untuk task ini karena `TransactionsPage` sudah memakai `workspaceTransactions` sebagai source of truth list
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `fetchWorkspaceTransactionsFromApi` tetap jalur dedicated untuk ledger workspace, sedangkan dashboard summary tetap memakai `cashMutations`
  - `TransactionsPage` tidak bergantung pada summary dashboard untuk render list utama
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Tidak ada perubahan runtime untuk task ini; risiko utama hanya jika nanti ada refactor store yang menggabungkan kembali kedua source of truth

### [2026-04-18] `UCW-21` - Tambahkan permanent delete untuk recycle bin prioritas

- Status: `validated`
- Ringkasan:
  - Menambahkan hard delete untuk leaf recycle-bin `bill-payment` dan `loan-payment` agar aksi permanen tersedia langsung dari sheet recycle bin
  - Menghubungkan UI recycle bin ke API permanen baru dan mempertahankan guard recycle-bin sebelum delete permanen dijalankan
- File berubah:
  - `api/records.js`
  - `api/transactions.js`
  - `src/lib/records-api.js`
  - `src/lib/transactions-api.js`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `bill-payment` dan `loan-payment` sekarang memakai `canPermanentDelete: true` karena keduanya leaf item dengan guard recycle-bin yang jelas
  - Backend menolak permanent delete jika entitas belum berada di recycle bin, sehingga flow soft delete/restore tetap terjaga
  - `TransactionsRecycleBinPage` sekarang menampilkan aksi permanen yang sesuai untuk record leaf tanpa menambah aksi pada entitas yang masih butuh guard tree lebih kompleks
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Delete permanen payment leaf akan mengubah histori bill/loan jika dilakukan di luar urutan guard yang tepat, jadi backend tetap harus jadi satu-satunya source of truth
  - Entitas yang belum diberi permanent delete sengaja tetap restore-only untuk menghindari regresi child tree
- Next allowed task:
  - Tidak ada task aktif baru yang dibuka dari langkah ini; stream siap lanjut jika ada brief berikutnya

### [2026-04-18] `UCW-46` - Seragamkan shell konten halaman More dan hilangkan header sticky form

- Status: `validated`
- Ringkasan:
  - Menyatukan ritme section/content empat halaman More lewat primitive reusable `PageSection`, lalu menghapus wrapper card besar yang membuat halaman tampak kembali ke desain lama
  - Mengubah fullscreen `FormLayout` agar scroll terjadi di level halaman, bukan hanya body form, sehingga header tidak lagi terasa sticky saat konten panjang
- File berubah:
  - `src/components/ui/AppPrimitives.jsx`
  - `src/components/layouts/FormLayout.jsx`
  - `src/components/PayrollManager.jsx`
  - `src/components/HrdPipeline.jsx`
  - `src/components/BeneficiaryList.jsx`
  - `src/components/TeamInviteManager.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `PageSection` menjadi komposisi reusable untuk heading + action + body sehingga empat halaman More kini berbagi ritme yang sama di level konten, bukan hanya di route wrapper
  - `BeneficiaryList` dan `TeamInviteManager` sekarang memakai surface list yang lebih ringkas untuk `ActionCard`, sementara wrapper page-level lama dihapus
  - `FormLayout` kini memakai scroll halaman penuh pada overlay fullscreen sehingga header ikut bergerak seperti halaman `Recycle Bin`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Perubahan hierarki visual pada halaman More membuat spacing antarkelompok lebih minimal; komponen baru di area ini perlu mengikuti `PageSection` agar tidak drift lagi
  - Form fullscreen dengan konten sangat panjang tetap perlu dijaga agar CTA bawah tidak tertutup konten child yang terlalu agresif
- Next allowed task:
  - `UCW-21` siap dilanjutkan untuk permanent delete recycle bin prioritas

### [2026-04-18] `UCW-45` - Pindahkan safe zone reusable ke shell halaman tanpa card visual

- Status: `validated`
- Ringkasan:
  - Mengoreksi arah `UCW-44`: safe zone kini ditempatkan pada primitive reusable level viewport dan shell, bukan membungkus fullscreen form menjadi panel/card
  - `FormLayout` fullscreen sekarang mengikuti ritme visual `TransactionsRecycleBinPage` dengan ruang napas di tepi layar tanpa border, radius, atau shadow tambahan
- File berubah:
  - `src/components/ui/AppPrimitives.jsx`
  - `src/components/layouts/FormLayout.jsx`
  - `src/components/layouts/FormHeader.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `AppViewportSafeArea` menjadi token reusable untuk padding kiri-kanan-atas-bawah berbasis safe-area viewport
  - `PageShell` tetap menjadi wrapper halaman yang dipakai halaman seperti `Recycle Bin`, `Payroll`, `HRD`, `Penerima Manfaat`, dan `Team Invite`
  - `FormLayout` fullscreen sekarang memakai `AppViewportSafeArea` + `PageShell`, sehingga header dan isi form berada di safe zone yang sama tetapi tetap di luar card visual
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Form fullscreen kini full-bleed seperti halaman biasa; jika kelak dibutuhkan panel modal terpisah, itu harus memakai primitive lain agar tidak merusak pola shell ini
  - Child content yang sangat tinggi tetap harus menjaga struktur scroll internal agar ritme antar-section tidak pecah
- Next allowed task:
  - `UCW-21` siap dilanjutkan untuk permanent delete recycle bin prioritas

### [2026-04-18] `UCW-44` - Selaraskan safe zone form overlay dengan shell halaman

- Status: `validated`
- Ringkasan:
  - Audit ulang mengonfirmasi halaman berbasis `PageShell` memang sudah selaras dengan `Recycle Bin`, sehingga perubahan visual di halaman seperti `MasterPage`, `ProjectsPage`, dan halaman More sengaja minim
  - Safe zone yang benar-benar belum seragam ada di form overlay; `FormLayout` sekarang diberi inset layar, panel ber-padding, dan `FormHeader` bisa memakai wrapper inset tanpa memengaruhi halaman More
- File berubah:
  - `src/components/ui/AppPrimitives.jsx`
  - `src/components/layouts/FormHeader.jsx`
  - `src/components/layouts/FormLayout.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `FormHeader` bukan sumber masalah untuk halaman More; masalahnya ada pada tidak adanya wrapper inset saat dipakai di overlay fullscreen
  - `AppSafeZone` sekarang menjadi primitive kecil untuk inset `px-2 py-2`, `PageShell` ikut memakainya, dan `FormLayout` memakainya lewat `FormHeader inset` agar ritme header overlay setara dengan halaman biasa
  - `FormLayout` fullscreen sekarang memiliki safe-area inset kiri-kanan-atas-bawah dan panel internal ber-radius/border, sehingga header dan body tidak lagi menempel ke tepi viewport
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Panel overlay sekarang menyisakan margin konsisten di tepi layar; pada viewport sangat kecil ruang baca sedikit berkurang tetapi aman terhadap notch dan tepi gesture
  - Form yang memakai konten sangat tinggi tetap bergantung pada scroll internal `FormLayout`, jadi komponen child baru harus tetap menjaga tinggi konten
- Next allowed task:
  - `UCW-21` siap dilanjutkan untuk permanent delete recycle bin prioritas

### [2026-04-18] `UCW-43` - Audit spacing shell/card dan susun wrapper reusable

- Status: `validated`
- Ringkasan:
  - Menambahkan `PageShell` sebagai wrapper reusable untuk ritme padding halaman yang mengikuti referensi `Recycle Bin`
  - Memigrasikan halaman transaksi, detail, More, Master, dan halaman di menu More ke wrapper baru, lalu merapikan padding card utama agar tidak lagi menduplikasi `p-4` dasar
- File berubah:
  - `src/components/ui/AppPrimitives.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/DeletedTransactionDetailPage.jsx`
  - `src/pages/MorePage.jsx`
  - `src/pages/MasterPage.jsx`
  - `src/pages/ProjectsPage.jsx`
  - `src/pages/HrdPage.jsx`
  - `src/pages/PayrollPage.jsx`
  - `src/pages/BeneficiariesPage.jsx`
  - `src/pages/TeamInvitePage.jsx`
  - `src/pages/MasterFormPage.jsx`
  - `src/components/MasterDataManager.jsx`
  - `src/components/ProjectReport.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Wrapper shell halaman sekarang dikunci di satu primitive sehingga padding kiri-kanan-atas-bawah tidak lagi ditulis ulang per halaman
  - Card primitive tetap dipakai sebagai source of truth; halaman dan section utama yang sebelumnya menulis `p-4`/`p-4 sm:p-5` berulang dipangkas agar lebih konsisten dengan default card padding
  - Halaman More, Master, dan Projects kini mengikuti ritme shell/card yang sama dengan halaman transaksi dan Recycle Bin
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Halaman atau komponen baru yang belum memakai `PageShell` masih bisa keluar dari ritme spacing yang sekarang sudah dibakukan
  - Card dengan kebutuhan padding khusus seperti panel status tinggi tetap perlu class tambahan agar tidak tereduksi ke default `p-4`
- Next allowed task:
  - `UCW-21` siap dilanjutkan untuk permanent delete recycle bin prioritas

### [2026-04-18] `UCW-42` - Tambahkan padding seragam dan pulihkan render form income/expense

- Status: `validated`
- Ringkasan:
  - Menjadikan padding halaman yang memakai header baru konsisten seperti `Recycle Bin`
  - Memperbaiki blank screen pada input income dan expense yang muncul setelah perubahan wrapper form
- File berubah:
  - `src/components/layouts/FormLayout.jsx`
  - `src/components/IncomeForm.jsx`
  - `src/components/ExpenseForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Shell form sekarang punya padding seragam di luar konten utama
  - `IncomeForm` dan `ExpenseForm` kembali ter-render normal setelah dependency yang hilang dipasang
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Padding ekstra pada overlay form sedikit mengurangi ruang visual, tetapi konsisten dengan halaman referensi
- Next allowed task:
  - `UCW-21` menjadi task berikutnya yang siap dikerjakan

### [2026-04-18] `UCW-41` - Samakan wrapper header dengan layout Recycle Bin

- Status: `validated`
- Ringkasan:
  - Menghapus wrapper tebal pada `FormHeader` dan menyelaraskannya dengan komposisi `PageHeader`
  - Membuat header halaman yang sudah di-update tampil ringkas seperti `Recycle Bin` tanpa kesan sticky wrapper
- File berubah:
  - `src/components/layouts/FormHeader.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Header sekarang memakai pola ringkas yang sama dengan halaman `Recycle Bin`
  - Tidak ada class sticky tambahan pada wrapper header
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Perubahan tampilan header bisa terasa lebih lapang dibanding versi sebelumnya, tetapi konsisten dengan layout target
- Next allowed task:
  - `UCW-21` menjadi task berikutnya yang siap dikerjakan

### [2026-04-18] `UCW-40` - Pindahkan navigasi section form ke bawah tanpa scroll vertikal

- Status: `validated`
- Ringkasan:
  - Memindahkan tombol navigasi section ke area bawah panel aktif agar alur `Kembali/Lanjut` tidak lagi terasa seperti toolbar atas
  - Memindahkan tombol simpan ke section terakhir pada `IncomeForm`, `ExpenseForm`, `LoanForm`, dan `MaterialInvoiceForm`
  - Menjaga shell form tetap embedded dan meminimalkan kebutuhan scroll tambahan pada form yang sudah di-section-kan
- File berubah:
  - `src/components/layouts/FormLayout.jsx`
  - `src/components/IncomeForm.jsx`
  - `src/components/ExpenseForm.jsx`
  - `src/components/LoanForm.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Form section prioritas sekarang menempatkan aksi simpan di section akhir, bukan di footer shell
  - Navigasi `Kembali/Lanjut` tetap berada di bawah panel aktif, sesuai brief
  - `AttendanceForm` tetap menggunakan flow sheet yang ada karena bukan form section bertahap
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Form yang punya konten sangat panjang masih bisa memanjang secara vertikal jika data master atau preview besar
  - `AttendanceForm` belum dipaksa ke shell section karena alurnya berbeda dari form transaksi bertahap
- Next allowed task:
  - `UCW-21` menjadi task berikutnya yang siap dikerjakan

### [2026-04-18] `UCW-39` - Redesign header form dan halaman More agar lebih kompak

- Status: `validated`
- Ringkasan:
  - Memperbarui `FormHeader` dan shell header page agar menampilkan kicker/title di kiri dan tombol kembali berlabel di kanan atas
  - Mengubah dropdown master yang tersisa di `IncomeForm` dan `AttendanceForm` ke `MasterPickerField` agar pola global tetap konsisten
  - Mengompakkan catatan opsional di `ExpenseForm`, `LoanForm`, dan `MaterialInvoiceForm` ke accordion collapsible agar ruang vertikal lebih hemat
- File berubah:
  - `src/components/ui/AppPrimitives.jsx`
  - `src/components/layouts/FormHeader.jsx`
  - `src/components/ExpenseForm.jsx`
  - `src/components/IncomeForm.jsx`
  - `src/components/LoanForm.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `src/components/AttendanceForm.jsx`
  - `src/pages/HrdPage.jsx`
  - `src/pages/PayrollPage.jsx`
  - `src/pages/BeneficiariesPage.jsx`
  - `src/pages/TeamInvitePage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Semua header form prioritas dan 4 halaman More sekarang memakai komposisi yang seragam dan label kembali di kanan atas
  - Master picker tersisa di form utama sudah seragam memakai sheet searchable, bukan select native
  - Catatan opsional pada form prioritas tidak lagi memakan ruang penuh saat layar pendek
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Tombol kembali berlabel di header membutuhkan ruang lebih besar dibanding ikon saja, tetapi konsisten dengan brief dan lebih jelas di mobile
  - Accordion catatan menambah satu klik untuk membuka field tambahan, namun menjaga form utama tetap ringkas
- Next allowed task:
  - `UCW-21` menjadi task berikutnya yang siap dikerjakan

### [2026-04-18] `UCW-17` - Terapkan shell sectioned form ke form prioritas

- Status: `validated`
- Ringkasan:
  - Mengaktifkan mode `embedded` pada `FormLayout` agar shell section bisa dipakai di dalam form prioritas tanpa mengganggu layout page-level
  - Memecah `ExpenseForm`, `LoanForm`, dan `MaterialInvoiceForm` ke beberapa section agar navigasi `Back/Next` muncul di alur pengisian mobile
  - Menjaga submit, validasi, dan error state tetap bekerja seperti sebelumnya sambil membuat form lebih terstruktur
- File berubah:
  - `src/components/layouts/FormLayout.jsx`
  - `src/components/ExpenseForm.jsx`
  - `src/components/LoanForm.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `ExpenseForm` dan `LoanForm` kini memakai section shell embedded untuk memisahkan relasi transaksi, nilai, preview, dan catatan
  - `MaterialInvoiceForm` memakai section shell embedded tanpa mengubah kontrak submit/hideActions yang sudah dipakai page wrapper
  - `FormLayout` tetap kompatibel untuk mode fullscreen dan mode embedded, jadi form lain tidak ikut terdampak
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Navigasi section menambah satu langkah interaksi, tapi field tetap lebih rapi di layar kecil
  - Karena section shell sekarang muncul di dalam form, form yang sangat pendek mungkin tidak perlu pola ini dan sebaiknya tidak dipaksa
- Next allowed task:
  - `UCW-21` menjadi task berikutnya yang siap dikerjakan

### [2026-04-18] `UCW-33` - Pola picker master data skala besar yang mobile-friendly

- Status: `validated`
- Ringkasan:
  - Menambahkan `MasterPickerField` berbasis `AppSheet` agar master data besar bisa dipilih lewat sheet searchable yang mobile-friendly
  - Mengganti dropdown master yang panjang di `ExpenseForm`, `MaterialInvoiceForm`, dan `LoanForm` dengan picker yang tetap menjaga konteks field
  - Menjaga validasi native form lewat input tersembunyi agar field picker tetap berperilaku sebagai field form yang sah
- File berubah:
  - `src/components/ui/MasterPickerField.jsx`
  - `src/components/ExpenseForm.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `src/components/LoanForm.jsx`
  - `src/components/ui/AppPrimitives.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Picker baru bisa dipakai ulang untuk project, category, supplier, creditor, dan material item tanpa mengubah kontrak data backend
  - Pencarian di sheet membantu memilih master data dengan daftar panjang tanpa dropdown sempit di mobile
  - Context field tetap terjaga lewat label, deskripsi, dan helper text per field
  - Layer sheet dinaikkan di atas form fullscreen agar picker benar-benar tampil saat field master dibuka
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Picker berbasis sheet menambah satu lapis interaksi dibanding select native, jadi beberapa alur singkat akan terasa sedikit lebih panjang
  - Field yang sangat bergantung pada native select keyboard UX sekarang bergeser ke sheet; jika ada form lain yang butuh pola sama, perlu adopsi task turunan
- Next allowed task:
  - `UCW-17` siap dilanjutkan sebagai task berikutnya

### [2026-04-18] `UCW-18` - Standarkan post-submit flow agar tetap di dalam Mini Web App

- Status: `validated`
- Ringkasan:
  - Menghapus jalur auto-close dari `TransactionForm` sehingga submit transaksi tetap membawa user kembali ke flow aplikasi
  - Menahan navigasi balik agresif di `EditRecordPage` dan `MaterialInvoicePage` setelah create/edit, sehingga success state tetap terlihat di layar
  - Menjaga post-submit flow tetap aman di dalam Mini Web App tanpa memaksa user keluar dari halaman kerja aktif
- File berubah:
  - `src/components/TransactionForm.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `src/pages/MaterialInvoicePage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `TransactionForm` tidak lagi memanggil `tg.close()` setelah simpan sukses; user tetap di sesi aplikasi
  - Create/edit lewat `EditRecordPage` sekarang memakai callback sukses non-navigasi, jadi form menampilkan status berhasil tanpa memaksa route pop
  - `MaterialInvoicePage` juga berhenti auto-pop setelah sukses simpan, sehingga alur tetap berada di layar kerja yang sama
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - User sekarang perlu menekan tombol back secara sadar jika memang ingin keluar dari layar form; ini disengaja agar flow tidak agresif
  - Flow create/edit lama yang mengandalkan auto-pop mungkin terasa berbeda, tetapi data tetap tersimpan dan success state tetap tampil
- Next allowed task:
  - `UCW-33` menjadi task berikutnya yang siap dikerjakan

### [2026-04-18] `UCW-16` - Shell form mobile berbasis section dengan alur lanjut/kembali

- Status: `validated`
- Ringkasan:
  - Memperluas `FormLayout` agar bisa merender shell sectioned yang reusable dengan tombol Back/Next per section
  - Menambahkan navigasi section berbasis chip dan progress label tanpa menambah duplikasi CTA submit
  - Menjaga layout mobile tetap stabil karena section navigator berada di shell, bukan di masing-masing form
- File berubah:
  - `src/components/layouts/FormLayout.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `FormLayout` sekarang menerima `sections` dan menampilkan section aktif secara bergantian bila child yang diberikan berupa daftar panel
  - Navigasi section tetap terpisah dari footer submit, jadi tidak menambah duplikasi CTA
  - Shell ini bisa dipakai ulang untuk form prioritas pada task berikutnya tanpa refactor tambahan di layout dasar
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Jika consumer mengirim `sections` tanpa children berlapis, shell section tidak aktif dan layout tetap fallback ke mode lama
  - Navigasi section saat ini client-side di shell; integrasi ke form yang lebih kompleks tetap perlu task lanjutan
- Next allowed task:
  - `UCW-18` siap dilanjutkan setelah shell section tersedia

### [2026-04-18] `UCW-14` - Kalkulasi dan preview pengembalian otomatis di LoanForm

- Status: `validated`
- Ringkasan:
  - LoanForm sekarang menghitung total pengembalian secara otomatis dari pokok, tipe bunga, suku bunga, dan tenor tanpa input manual pada field repayment
  - Menambahkan preview otomatis untuk total pengembalian, jatuh tempo, estimasi denda saat ini, dan overdue agar skenario pinjaman lebih jelas sebelum submit
  - Menambahkan input denda keterlambatan yang eksplisit untuk bunga keterlambatan, basis hitung, jenis penalti, dan nominal flat
- File berubah:
  - `src/components/LoanForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Field repayment pada form loan sekarang bersifat read-only dan mengikuti helper `buildLoanTermsSnapshot`, sehingga skenario berbunga tidak lagi bergantung ke nilai manual
  - Preview otomatis menampilkan total pengembalian, jatuh tempo, bunga pokok, dan estimasi denda berbasis helper `calculateLoanLateCharge`
  - Payload submit loan kini membawa field denda keterlambatan eksplisit agar UI, store, dan API tetap selaras dengan kontrak loan business yang sudah dikunci
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Total pengembalian di form sekarang sepenuhnya mengikuti helper formula; caller lama yang berharap override manual tidak lagi punya jalur UI di LoanForm
  - Estimasi denda pada preview memakai tanggal hari ini saat render, jadi panel preview bisa berubah setelah pergantian hari atau refresh berikutnya
- Next allowed task:
  - `UCW-16` menjadi task berikutnya yang bisa dimulai

### [2026-04-18] `UCW-13` - Kontrak loan business flat interest, tenor, late charge, dan snapshot

- Status: `validated`
- Ringkasan:
  - Menambahkan helper loan business terpusat untuk formula pengembalian dasar, due date tenor, dan late charge optional
  - Menambah kolom snapshot dan field late charge di `loans`, lalu sinkronisasi trigger agar canonical repayment selalu mengikuti aturan flat interest
  - Status loan payment sekarang menghitung target amount dari snapshot canonical loan, bukan dari asumsi kolom lama saja
- File berubah:
  - `src/lib/loan-business.js`
  - `src/store/useIncomeStore.js`
  - `api/transactions.js`
  - `supabase/migrations/20260418154500_add_loan_business_rules_snapshot_columns.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Loan business rule sekarang punya source of truth terpusat untuk normalisasi interest type, basis bunga keterlambatan, penalti opsional, dan snapshot terms
  - Save/load loan di store dan API memakai snapshot helper yang sama sehingga data yang ditulis dan dibaca tetap konsisten
  - Trigger DB mengisi `loan_terms_snapshot` dan menjaga `fn_update_loan_status_on_payment()` tetap membaca target canonical dari snapshot
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `execute_sql` untuk verifikasi kolom, function, dan trigger loan business rules
  - `get_advisors` security/performance setelah DDL
- Risiko/regresi:
  - `repayment_amount` sekarang dinormalisasi ke formula canonical flat interest; caller lama yang masih mengirim angka manual berbeda akan terset mengikuti aturan baru
  - Snapshot due date dan overdue logic masih berbasis date key, jadi perubahan timezone lanjutan perlu task terpisah jika multi-zone dibutuhkan
- Next allowed task:
  - `UCW-14` siap dilanjutkan berikutnya

### [2026-04-18] `UCW-27` - Schema child collection transaksi dengan team scope relasional

- Status: `validated`
- Ringkasan:
  - Menambahkan `team_id` ke `expense_line_items` dan `expense_attachments` agar child collection transaksi punya scope team yang eksplisit
  - Menyelaraskan trigger, RLS policy, dan API child collection supaya akses baca/tulis tetap mengikuti parent expense canonical
  - `TransactionDetailPage` sekarang memuat histori pembayaran bill/pinjaman sebagai child collection read-only, sementara recycle bin attachment memakai filter team langsung
- File berubah:
  - `supabase/migrations/20260418134500_add_team_scope_to_expense_child_collections.sql`
  - `api/records.js`
  - `src/pages/TransactionDetailPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `expense_line_items` dan `expense_attachments` sekarang punya `team_id` non-null, trigger sinkronisasi dari parent expense, dan policy RLS yang langsung mengikat ke team scope
  - Recycle bin attachment tidak lagi bergantung pada deleted parent expense saja; attachment terhapus pada parent aktif juga ikut termuat karena filter team langsung
  - Detail transaksi menampilkan histori pembayaran bill/pinjaman sebagai child collection read-only, sehingga management child relation lebih mudah diaudit dari parent ledger
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - `execute_sql` untuk backfill/DDL dan verifikasi schema child collection
  - `get_advisors` security/performance untuk audit pasca-DDL
- Risiko/regresi:
  - Seluruh write path child collection sekarang bergantung pada trigger sinkronisasi team scope; jika ada insert manual di luar API, trigger itu tetap wajib dipertahankan
  - Detail transaksi bertambah satu lapis fetch child history, jadi ada sedikit overhead network saat membuka row yang punya bill atau loan
- Next allowed task:
  - `UCW-13` siap dilanjutkan berikutnya

### [2026-04-18] `UCW-11` - Recycle bin transaksi, dokumen, pembayaran, dan lampiran diperluas

- Status: `deferred`
- Ringkasan:
  - Recycle bin sekarang memuat deleted transaction tree, expense/material invoice, bill payment, loan payment, dan attachment metadata
  - Restore flow untuk transaksi, dokumen, pembayaran, dan attachment sudah dipusatkan di satu layar recycle bin
  - Scope master data recycle bin belum dituntaskan karena kontrak restore-nya masih bergantung pada task turunan
- File berubah:
  - `api/transactions.js`
  - `api/records.js`
  - `src/lib/transactions-api.js`
  - `src/lib/records-api.js`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Recycle bin sekarang menggabungkan deleted transaction, deleted expense/material invoice, deleted bill payment, deleted loan payment, dan deleted attachment metadata dalam satu list terurut
  - Restore item berjalan sesuai domain: transaksi lewat transactions API, expense/material invoice lewat records API, payment history lewat restore leaf API, dan attachment metadata lewat relasi child
  - Permanent delete tetap dibatasi ke entitas yang memang punya kontrak aman sekarang, sehingga task turunan tree delete tetap bisa diproses terpisah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Master data recycle bin masih dipisah sebagai scope turunan; kontrak restore teknis yang sebelumnya bergantung pada `UCW-27` sudah tersedia, tetapi task itu tetap deferred sampai brief khusus dijadwalkan
  - List recycle bin menjadi lebih besar sehingga keterlambatan fetch pada workspace sangat besar perlu dipantau bila nanti data tumbuh signifikan
- Next allowed task:
  - `UCW-13` menjadi task ready berikutnya di stream ini

### [2026-04-18] `UCW-10` - Guard usage dan detail master data list

- Status: `validated`
- Ringkasan:
  - Menambahkan detail rapi pada kartu master data agar penggunaan referensi terlihat langsung di list
  - Mengunci guard hapus untuk entitas master yang masih dipakai, dengan label aksi yang menunjukkan jumlah referensi aktif
- File berubah:
  - `src/components/ui/ActionCard.jsx`
  - `src/components/MasterDataManager.jsx`
  - `src/components/master/masterTabs.js`
  - `src/pages/Dashboard.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Kartu master data sekarang menampilkan detail tambahan di bawah subtitle, sehingga dependency dan konteks record lebih jelas
  - Delete action untuk proyek, pekerja, kategori, dan profesi diblokir bila masih punya referensi aktif; feedback guard ditampilkan langsung di panel manager
  - Dashboard mutasi tetap ringkas karena detail prop yang sebelumnya tidak dipakai sengaja tidak ditambahkan lagi ke list ringkas
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Guard hapus master masih berbasis referensi yang tersedia di store master lokal; entitas yang dependensinya datang dari tabel transaksi lain tetap perlu guard backend kalau nanti dibutuhkan
- Next allowed task:
  - `UCW-13` menjadi task ready berikutnya di stream ini

### [2026-04-18] `UCW-38` - Badge mutasi ringkas dan creator-aware

- Status: `validated`
- Ringkasan:
  - Mengganti badge status yang berisik di list mutasi dengan label creator yang mengacu ke id user pelaku
  - Menjaga badge list tetap ringkas di dashboard dan ledger tanpa menambah modal aksi atau status badge tambahan
- File berubah:
  - `src/lib/transaction-presentation.js`
  - `src/pages/Dashboard.jsx`
  - `src/pages/TransactionsPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Dashboard mutasi sekarang memakai label creator sebagai badge utama, dan badge status seperti `Pending` tidak lagi ditampilkan pada item ringkas
  - Ledger `TransactionsPage` menampilkan badge creator di bawah timestamp dan summary, sehingga identitas pelaku aktivitas tetap terlihat tanpa menambah keramaian visual
  - Helper presentasi tetap menjadi satu titik sumber label creator lintas dashboard dan ledger
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Label creator bergantung pada field id yang tersedia di payload; bila payload legacy tidak membawa id pelaku, badge akan jatuh ke label `Sistem`
- Next allowed task:
  - `UCW-10` sebagai task berikutnya yang sudah `ready`

### [2026-04-18] `UCW-37` - Dashboard mutasi recent-only tanpa tombol More

- Status: `validated`
- Ringkasan:
  - Membatasi daftar mutasi dashboard hanya ke beberapa item terbaru dari source of truth ledger
  - Menghapus action menu `More` pada kartu mutasi dashboard sehingga tidak ada modal aksi dari list ringkas
- File berubah:
  - `src/pages/Dashboard.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `Dashboard` sekarang merender hanya `5` mutasi terbaru per filter dan tidak lagi mengirim `actions` ke `ActionCard`, sehingga tombol `More`/modal aksi hilang
  - Entry point ke ledger penuh tetap ada lewat tombol `Lihat Semua` ke halaman transaksi
  - Loading skeleton dan chip count mengikuti jumlah item recent yang benar-benar tampil, bukan total keseluruhan
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Pengguna dashboard tidak lagi bisa membuka detail langsung dari kartu mutasi ringkas; detail penuh tetap tersedia di halaman ledger transaksi
- Next allowed task:
  - `UCW-38` sebagai task berikutnya yang sudah `ready`

### [2026-04-18] `UCW-36` - Sinkronisasi timestamp UI dan backend dengan zona input pengguna

- Status: `validated`
- Ringkasan:
  - Menyeragamkan formatter tanggal/waktu ke helper timezone bersama berbasis `Asia/Jakarta`
  - Menghapus default `new Date().toISOString().slice(0, 10)` pada form transaksi supaya input tanggal tidak lompat zona
  - Menyelaraskan formatter backend notifikasi agar output server dan UI memakai zona yang sama
- File berubah:
  - `src/lib/date-time.js`
  - `src/lib/transaction-presentation.js`
  - `src/pages/Dashboard.jsx`
  - `src/pages/PaymentPage.jsx`
  - `src/components/ExpenseForm.jsx`
  - `src/components/IncomeForm.jsx`
  - `src/components/LoanForm.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `src/components/PaymentModal.jsx`
  - `src/components/AttendanceForm.jsx`
  - `src/components/PayrollManager.jsx`
  - `src/components/TeamInviteManager.jsx`
  - `src/components/ProjectReport.jsx`
  - `src/components/BeneficiaryList.jsx`
  - `src/components/HrdPipeline.jsx`
  - `api/notify.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Helper timezone bersama kini dipakai oleh format timestamp ledger, dashboard, payment page, dan form tanggal default
  - Dashboard mutasi dan ringkasan lain membaca label waktu dari helper yang sama sehingga UI tidak lagi bergantung ke timezone browser default
  - Backend notifikasi juga dipaksa ke `Asia/Jakarta`, jadi output yang tampil ke pengguna tetap konsisten dengan UI
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Semua label waktu sekarang terikat ke zona Jakarta; kalau nanti ada kebutuhan multi-timezone, helper ini harus diganti dengan sumber zona yang eksplisit per team/user
- Next allowed task:
  - `UCW-37` sebagai task berikutnya yang sudah `ready`

### [2026-04-18] `UCW-23` - Kunci kontrak ledger tunggal dan summary row canonical

- Status: `validated`
- Ringkasan:
  - Menambahkan kontrak canonical row di workspace ledger supaya sumber data mutasi tetap satu jalur untuk `expense+bill`, `project-income+fee bill`, `attendance+salary bill`, dan `loan`
  - Menambahkan summary child record yang konsisten di API workspace dan ditampilkan kembali di list ledger
- File berubah:
  - `api/transactions.js`
  - `src/lib/transaction-presentation.js`
  - `src/pages/TransactionsPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Row workspace sekarang membawa `ledger_summary` eksplisit untuk fee bill, bill pengeluaran/material/surat jalan, salary bill, dan sisa pengembalian pinjaman
  - List `TransactionsPage` menampilkan summary child record di bawah timestamp sehingga kontrak canonical row terlihat di UI list
  - Helper presentasi tetap fallback ke data parent lama bila summary baru belum tersedia, jadi risiko breaking data lama rendah
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Summary child record hanya tampil untuk row workspace yang memang membawa relation bill/salaryBill; data legacy tanpa relasi tetap aman tetapi tidak menampilkan summary tambahan
- Next allowed task:
  - `UCW-36` sebagai task berikutnya yang sudah `ready`

### [2026-04-18] `UCW-20` - Integrasi attachment CRUD ke parent expense dan material invoice

- Status: `validated`
- Ringkasan:
  - Mengintegrasikan attachment CRUD ke parent data expense dan material invoice di form edit dan detail ledger
  - Menampilkan lampiran material/expense pada detail transaksi canonical agar source of truth attachment tidak hanya hidup di form edit
- File berubah:
  - `src/components/ExpenseAttachmentSection.jsx`
  - `src/pages/TransactionDetailPage.jsx`
- Audit hasil:
  - Expense dan material invoice edit form tetap menampilkan attachment child CRUD
  - Detail transaksi expense sekarang memuat attachment section dengan judul sesuai konteks `Lampiran Pengeluaran` atau `Lampiran Faktur Material`
  - Attachment action tetap mengikuti role matrix yang sama, dan hanya muncul saat auth readiness sudah aktif
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Attachment section pada detail transaksi expense menambah fetch tambahan di halaman detail, tapi tetap dibatasi oleh auth readiness dan scope record aktif
- Next allowed task:
  - `UCW-23` sebagai task `ready` berikutnya

### [2026-04-18] `UCW-19` - Library attachment ringan dengan hardening sesi, compress, dan background upload

- Status: `validated`
- Ringkasan:
  - Menutup akar race sesi Supabase di layer attachment dengan helper auth readiness terpusat
  - Menyelesaikan library attachment ringan: compress gambar, antrean background upload, status progres, dan rollback aman saat metadata file gagal diregistrasi
- File berubah:
  - `src/lib/auth-session.js`
  - `src/lib/attachment-upload.js`
  - `src/store/useAuthStore.js`
  - `src/lib/records-api.js`
  - `src/lib/transactions-api.js`
  - `src/lib/reports-api.js`
  - `src/store/useFileStore.js`
  - `src/components/ExpenseAttachmentSection.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `initializeTelegramAuth` sekarang dideduplikasi untuk key `initData/startParam` yang sama sehingga `React.StrictMode` di dev tidak menembakkan bootstrap auth ganda
  - Wrapper API `records`, `transactions`, dan `reports` tidak lagi membaca `getSession()` secara mentah; semuanya menunggu helper auth session yang sama sebelum mengirim bearer token
  - `useFileStore` sekarang punya pipeline upload terantrikan dengan tahap `queued/compressing/uploading/registering/completed/failed`, kompresi gambar ringan, dan rollback storage kalau insert metadata `file_assets` gagal
  - UI attachment expense/material invoice sekarang menampilkan progres upload yang nyata, termasuk hasil kompresi bila ada, tanpa kembali memicu error `Sesi Supabase belum aktif.`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Queue upload saat ini masih serial global di client; ini aman untuk konsistensi tetapi belum memaksimalkan paralelisme
  - Kompresi hanya diterapkan ke `image/jpeg`, `image/png`, dan `image/webp`; file non-image dan PDF tetap diunggah apa adanya
- Next allowed task:
  - `UCW-20` untuk mengintegrasikan attachment CRUD parent data ke seluruh form/detail yang masih tersisa

### [2026-04-18] `AUDIT-ATTACHMENT-SESSION-01` - Audit akar error sesi Supabase pada attachment UI

- Status: `validated`
- Ringkasan:
  - Menelusuri akar error `Sesi Supabase belum aktif.` yang muncul setelah task attachment
  - Memastikan regression point berasal dari sync lampiran yang dipanggil saat mount form edit, bukan dari endpoint attachment di backend
- File berubah:
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Regression langsung berasal dari `ExpenseAttachmentSection` yang menambah fetch attachment otomatis saat komponen mount, sementara `src/lib/records-api.js` melempar error keras saat `supabase.auth.getSession()` belum menghasilkan access token
  - Error menjadi terlihat setelah task attachment karena sebelumnya form edit tidak menambah caller baru ke `/api/records?resource=expense-attachments` pada fase mount
  - Kelemahan desain yang sudah laten tetap ada: wrapper API client masih mengandalkan `getSession()` per request tanpa listener `onAuthStateChange` atau mekanisme tunggu auth readiness terpusat
  - Risiko race membesar di dev karena app dijalankan dalam `React.StrictMode`, sementara bootstrap auth masih berbasis `useEffect` async tanpa deduplikasi inisialisasi
- Validasi:
  - Audit repo terhadap `src/App.jsx`, `src/main.jsx`, `src/store/useAuthStore.js`, `src/lib/records-api.js`, `src/components/ExpenseAttachmentSection.jsx`, `src/components/ExpenseForm.jsx`, dan `src/components/MaterialInvoiceForm.jsx`
  - Cross-check docs Supabase auth session via MCP docs search
- Risiko/regresi:
  - Hotfix guard di attachment UI menutup symptom utama, tetapi caller API lain tetap berpotensi memunculkan error serupa jika ada fetch baru yang berjalan sebelum auth readiness benar-benar sinkron
- Next allowed task:
  - `UCW-19` tetap task aktif berikutnya; hardening auth readiness lintas `records-api`/`transactions-api` layak diprioritaskan sebelum menambah caller attachment lain

### [2026-04-18] `HOTFIX-SESSION-GUARD-01` - Guard auth readiness di attachment UI

- Status: `validated`
- Ringkasan:
  - Menahan pemanggilan API lampiran sampai sesi Supabase benar-benar siap
  - Mencegah error `Sesi Supabase belum aktif.` dari `ExpenseAttachmentSection` saat form edit mount lebih cepat daripada inisialisasi auth
- File berubah:
  - `src/components/ExpenseAttachmentSection.jsx`
- Audit hasil:
  - Guard auth ditambahkan sebelum `fetchExpenseAttachments`, upload, edit metadata, soft delete, restore, dan permanent delete
  - Komponen attachment sekarang tidak mount sinkronisasi data sebelum `isLoading` auth selesai, `isRegistered` aktif, dan `currentTeamId` tersedia
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Section attachment tidak tampil sampai auth siap; ini disengaja agar sync tidak memicu error sesi kosong
- Next allowed task:
  - `UCW-19` tetap menjadi task aktif berikutnya di stream

### [2026-04-18] `DOC-SETUP` - Inisialisasi planning dan workflow log

- Status: `validated`
- Ringkasan:
  - Membuat dokumen backlog utama `docs/unified-crud-workspace-plan-2026-04-18.md`
  - Membuat progress log khusus stream ini
  - Memperbarui `AGENTS.md` agar workflow task harus melewati audit gate dan update log
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
  - `AGENTS.md`
- Audit hasil:
  - Dokumen plan memiliki backlog micro-task, dependency, definition of done, validasi minimum, dan audit gate
  - Dokumen progress log memiliki aturan update dan entry awal
  - Root agent rules diperbarui agar workflow baru menjadi aturan permanen repo
- Validasi:
  - Validasi ringan dokumen: cek path dan konsistensi referensi dokumen
- Risiko/regresi:
  - Workflow baru menambah disiplin proses; kalau tidak dijaga konsisten, backlog dan log bisa cepat stale
- Next allowed task:
  - `UCW-00` atau brief lain yang lebih prioritas setelah backlog diaudit terhadap brief terbaru

### [2026-04-18] `DOC-PLAN-UPDATE-01` - Audit brief lanjutan dan revisi backlog

- Status: `validated`
- Ringkasan:
  - Mengaudit brief lanjutan terkait loan flat interest, supplier filtering kontekstual, redesign form per section, post-submit stay-in-app, dan attachment library
  - Merevisi backlog aktif agar brief baru masuk sebagai kelanjutan stream yang sama
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Task existing yang terdampak sudah direvisi: `UCW-08`, `UCW-10`, `UCW-12`
  - Task baru yang belum tercakup sudah ditambahkan: `UCW-13` sampai `UCW-20`
  - Dependency baru sudah dicatat agar implementasi tidak loncat ke layer UI sebelum aturan domain dan attachment contract dikunci
- Validasi:
  - Validasi ringan dokumen: cek referensi task baru/revisi dan konsistensi path dokumen
- Risiko/regresi:
  - Backlog makin besar; tanpa disiplin audit per task, dependency antar loan/form/attachment bisa saling menabrak
- Next allowed task:
  - `UCW-00` tetap prioritas paling aman
  - jika user ingin scope kecil langsung dari brief baru, kandidat paling aman adalah `UCW-13`

### [2026-04-18] `DOC-PLAN-UPDATE-02` - Audit brief refactor buku kas besar transaksi

- Status: `validated`
- Ringkasan:
  - Mengaudit brief baru untuk mengubah halaman `Transaksi` menjadi `buku kas besar` tunggal lintas domain
  - Merevisi backlog yang terdampak agar parent dan bill tidak lagi direncanakan tampil ganda di UI
  - Memecah pekerjaan menjadi task kontrak ledger, read model, list minimal, CRUD canonical, child collection, dan guard tree
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Task existing yang terdampak sudah direvisi: `UCW-09`, `UCW-11`, `UCW-21`
  - Task baru yang belum tercakup sudah ditambahkan: `UCW-23` sampai `UCW-28`
  - Current active task digeser ke `UCW-23` karena kontrak ledger tunggal harus dikunci sebelum implementasi UI/API berikutnya
- Validasi:
  - Validasi ringan dokumen: cek referensi task baru/revisi dan konsistensi path dokumen
- Risiko/regresi:
  - Scope transaksi menjadi lebih eksplisit dan lebih besar; tanpa disiplin dependency, refactor ledger bisa bentrok dengan recycle bin, attachment, dan child payment flow
- Next allowed task:
  - `UCW-23` untuk mengunci kontrak ledger tunggal `buku kas besar`

### [2026-04-18] `DOC-PLAN-UPDATE-03` - Audit brief detail invoice, surat jalan, dashboard, dan skalabilitas list

- Status: `validated`
- Ringkasan:
  - Mengaudit brief lanjutan terkait detail line item faktur material, CRUD `surat_jalan`, sentralisasi CRUD dari dashboard, strategi skalabilitas list besar, dan manajemen picker master data di mobile
  - Merevisi task yang terdampak agar read model ledger dan shell form mobile tidak dibangun dengan asumsi list kecil
  - Menambahkan task lanjutan untuk child detail invoice, conversion flow surat jalan, dashboard action cleanup, optimasi load data besar, dan picker master data
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Task existing yang terdampak sudah direvisi: `UCW-17`, `UCW-24`
  - Task baru yang belum tercakup sudah ditambahkan: `UCW-29`, `UCW-30`, `UCW-31`, `UCW-32`, `UCW-33`
  - Current active task tetap `UCW-23` karena kontrak ledger masih menjadi pintu masuk paling aman sebelum task-task baru diimplementasikan
- Validasi:
  - Validasi ringan dokumen: cek referensi task baru/revisi dan konsistensi dependency di planning/progress
- Risiko/regresi:
  - Backlog transaksi makin dalam; jika kontrak parent-child dan canonical row tidak dikunci dengan disiplin, task surat jalan conversion dan line-item child edit mudah saling menabrak
- Next allowed task:
  - `UCW-23` untuk mengunci kontrak ledger tunggal `buku kas besar`

### [2026-04-18] `DOC-PLAN-UPDATE-04` - Audit brief role-based attachment CRUD

- Status: `validated`
- Ringkasan:
  - Mengaudit brief lanjutan agar manajemen attachment lebih teratur dan CRUD-nya tampil di UI sesuai role
  - Merevisi task attachment yang sudah ada agar kontrak schema, UI, dan child collection tidak menganggap semua role punya aksi yang sama
  - Menambahkan task khusus untuk mengunci matriks role-based CRUD attachment
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Task existing yang terdampak sudah direvisi: `UCW-12`, `UCW-20`, `UCW-27`
  - Task baru yang belum tercakup sudah ditambahkan: `UCW-34`
  - Current active task tetap `UCW-23`; task role attachment menjadi dependency untuk stream attachment, bukan pengganti kontrak ledger
- Validasi:
  - Validasi ringan dokumen: cek referensi task baru/revisi dan konsistensi dependency attachment
- Risiko/regresi:
  - Jika role matrix attachment tidak dikunci lebih awal, implementasi UI mudah bocor menampilkan aksi yang tidak semestinya ke role tertentu
- Next allowed task:
  - `UCW-23` untuk mengunci kontrak ledger tunggal `buku kas besar`

### [2026-04-18] `UCW-00` - Matriks aturan bisnis parent-child dikunci

- Status: `validated`
- Ringkasan:
  - Mengunci matriks final parent-child untuk `project_incomes`, `expenses`, `bills`, `bill_payments`, `loans`, `loan_payments`, dan `attendance_records`
  - Menautkan aturan delete guard, restore rule, dan payment rule ke mapping repo yang memang sudah aktif di API dan migration
  - Mengubah `UCW-00` menjadi acuan final untuk task-task implementasi setelahnya
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Matriks sekarang memuat source table, child record, delete guard, restore rule, payment rule, dan mapping repo per domain
  - Status backlog `UCW-00` sudah dipindah ke `validated`
  - Current active task stream sudah bergeser ke `UCW-01` sebagai task berikutnya yang siap dipakai
- Validasi:
  - Audit dokumen terhadap mapping repo: `api/transactions.js`, `api/records.js`, dan migration Supabase terkait relasi parent-child
  - Validasi ringan konsistensi referensi task dan path dokumen
- Risiko/regresi:
  - Kolom beberapa restore/delete rule menandai target final yang belum seluruhnya punya handler UI/API, jadi task turunan tetap harus mematuhi matriks ini
- Next allowed task:
  - `UCW-01` untuk read model workspace transaksi terpisah dari dashboard summary
  - atau task domain lain yang dependensinya sudah terpenuhi

### [2026-04-18] `UCW-01` - Read model workspace transaksi dipisah dari dashboard summary

- Status: `validated`
- Ringkasan:
  - Menambahkan kontrak `workspaceTransactions` pada `api/transactions.js` agar list transaksi workspace punya read model sendiri
  - Memisahkan konsumsi data `TransactionsPage` dari `cashMutations` dashboard ke state workspace khusus di `useDashboardStore`
  - Menjaga dashboard summary tetap memakai jalur lama sehingga perubahan ini tidak mengganggu KPI dan list dashboard
- File berubah:
  - `api/transactions.js`
  - `src/lib/transactions-api.js`
  - `src/store/useDashboardStore.js`
  - `src/pages/TransactionsPage.jsx`
- Audit hasil:
  - Workspace list sekarang membaca `workspaceTransactions` dari store dan endpoint `view=workspace`
  - Dashboard summary tetap membaca `cashMutations` via `refreshDashboard`
  - Aksi detail/edit/delete di workspace page masih aman karena metadata baru punya fallback ke helper existing
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Read model workspace masih berbagi source row yang sama dengan dashboard, jadi task berikutnya tetap harus jaga konsistensi mapping saat kontrak detail/delete diperluas
- Next allowed task:
  - `UCW-02` untuk finalisasi CRUD `expense umum`

### [2026-04-18] `UCW-02` - Finalisasi CRUD expense umum

- Status: `validated`
- Ringkasan:
  - Menambahkan read/update/delete/restore expense umum lewat `api/records.js` dan `src/lib/records-api.js`
  - Menautkan `ExpenseForm` ke jalur edit agar data existing bisa diperbarui tanpa memecah alur create
  - Menambahkan aksi soft delete dan restore di `EditRecordPage` untuk expense yang masuk recycle flow
- File berubah:
  - `api/records.js`
  - `src/lib/records-api.js`
  - `src/store/useTransactionStore.js`
  - `src/components/ExpenseForm.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Expense umum sekarang punya detail fetch, edit, soft delete, dan restore dari page edit
  - Jalur update memakai source data relasional final dan tidak menutup kerja create yang sudah ada
  - Status backlog `UCW-02` sudah dipindah ke `validated`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Expense edit/restore kini bergantung pada payload relasional final dan guard bill; bila data lama tidak konsisten, user akan melihat error guard yang eksplisit
- Next allowed task:
  - `UCW-03` untuk finalisasi CRUD `material invoice` beserta line items

### [2026-04-18] `UCW-03` - Finalisasi CRUD material invoice beserta line items

- Status: `validated`
- Ringkasan:
  - Menambahkan read/update/delete/restore material invoice lewat `api/records.js` dan `src/lib/records-api.js`
  - Menautkan `MaterialInvoiceForm` ke jalur edit agar header dan line items bisa diperbarui dari halaman edit
  - Menjaga kasus invoice tanpa bill tetap valid, termasuk `surat_jalan` yang memang tidak membuat tagihan
- File berubah:
  - `api/records.js`
  - `src/lib/records-api.js`
  - `src/store/useTransactionStore.js`
  - `src/components/MaterialInvoiceForm.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Edit invoice sekarang memuat detail header dan line items lengkap
  - Soft delete/restore invoice tetap sinkron dengan bill bila bill memang ada
  - Kasus invoice tanpa bill tetap aman karena route tidak memaksa sync bill yang tidak ada
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - Query skema ringan via Supabase MCP untuk memverifikasi kolom `expense_line_items`
- Risiko/regresi:
  - Edit line items belum mengompensasi stock mutation historis di database, jadi perubahan retroaktif tetap bergantung pada model data yang sudah ada
- Next allowed task:
  - `UCW-04` untuk halaman detail `bill`

### [2026-04-18] `UCW-04` - Halaman detail bill sebagai pusat view dan aksi

- Status: `validated`
- Ringkasan:
  - Menghidupkan halaman `PaymentPage` sebagai pusat detail bill yang menampilkan metadata, status pembayaran, ringkasan nominal, dan histori pembayaran
  - Menambahkan aksi hapus bill langsung dari halaman detail dengan guard yang menolak penghapusan jika sudah ada histori pembayaran
  - Menampilkan bill payment history dari `api/records.js` sehingga detail bill tidak lagi hanya form pembayaran
- File berubah:
  - `api/records.js`
  - `src/pages/PaymentPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Response bill sekarang membawa histori `bill_payments`, sehingga detail page bisa menampilkan riwayat tanpa query tambahan di client
  - PaymentPage menampilkan status, due date, supplier, proyek, dan histori payment bill di satu layar
  - Aksi hapus bill diarahkan ke root dashboard setelah sukses agar workspace memuat ulang state transaksi
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Bill dengan histori pembayaran tidak bisa dihapus dari detail page; ini sengaja mengikuti guard backend agar tidak menghasilkan orphan payment
  - PaymentPage sekarang lebih berat karena memuat detail dan histori, jadi data bill yang besar bisa menambah waktu render awal
- Next allowed task:
  - `UCW-05` untuk CRUD minimum `bill_payments`

### [2026-04-18] `UCW-05` - CRUD minimum bill_payments

- Status: `validated`
- Ringkasan:
  - Menambahkan edit dan hapus untuk `bill_payments` langsung dari halaman detail bill
  - Menyinkronkan ulang status parent bill setelah insert, update, atau soft delete payment agar `paid_amount`, `status`, dan `paid_at` tetap akurat
  - Menambahkan endpoint API khusus `bill-payments` untuk update dan delete agar flow payment tidak bergantung pada mutasi direct-only
- File berubah:
  - `api/records.js`
  - `src/lib/records-api.js`
  - `src/store/usePaymentStore.js`
  - `src/pages/PaymentPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - PaymentPage sekarang punya list payment dengan aksi edit/hapus per item dan mode edit inline
  - Parent bill dihitung ulang dari semua payment aktif setelah update/delete, sehingga status tidak tinggal stale
  - Create payment tetap berjalan dan setelah submit page me-refresh record detail supaya user bisa review hasilnya langsung
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Edit/delete payment sekarang mengubah cara page berinteraksi dengan store sehingga race condition kecil mungkin muncul jika user melakukan aksi cepat beruntun
  - PaymentPage makin padat, jadi UX mobile perlu dibaca ulang pada task refactor ledger berikutnya
- Next allowed task:
  - `UCW-06` untuk revisi guard hapus bill yang sudah dibayar/partial

### [2026-04-18] `UCW-06` - Revisi guard hapus bill yang sudah dibayar/partial

- Status: `validated`
- Ringkasan:
  - Mengubah soft delete bill agar juga menonaktifkan seluruh histori `bill_payments` aktif dalam satu fungsi database atomik
  - Menambahkan guard eksplisit di UI `PaymentPage` sehingga penghapusan bill yang punya histori pembayaran memberi peringatan jelas bahwa payment history ikut diarsipkan
  - Menjaga `paid_amount`, `status`, dan `paid_at` bill agar tidak meninggalkan state setengah aktif setelah delete
- File berubah:
  - `api/records.js`
  - `src/pages/PaymentPage.jsx`
  - `supabase/migrations/20260418094000_soft_delete_bill_with_payment_history.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Bill dengan histori pembayaran sekarang bisa dihapus tanpa orphan payment karena history ikut di-soft-delete atomik
  - Permission fungsi DB dibatasi ke `service_role`, jadi path delete tetap lewat serverless API
  - UI delete bill sekarang memberi peringatan eksplisit saat ada histori pembayaran
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
  - Query Supabase MCP untuk memverifikasi `service_role` punya execute pada fungsi baru dan `anon/authenticated` tidak punya
- Risiko/regresi:
  - Delete bill dengan histori pembayaran sekarang lebih destruktif karena payment history ikut diarsipkan; restore flow yang lengkap masih harus ditangani di task recycle bin berikutnya
  - `PaymentPage` perlu tetap dijaga ringan saat task ledger besar masuk, karena guard dan histori kini lebih tebal
- Next allowed task:
  - `UCW-07` untuk finalisasi detail dan kontrak `attendance record` yang sudah punya salary bill

### [2026-04-18] `UCW-15` - Normalisasi filter supplier kontekstual berbasis master data

- Status: `validated`
- Ringkasan:
  - Menambahkan selector supplier contextual di `useMasterStore` untuk memisahkan supplier material dan supplier operasional/lainnya
  - Mengubah `ExpenseForm` agar supplier dipilih dari master yang relevan untuk expense umum
  - Mengubah `MaterialInvoiceForm` agar supplier material dipilih dari master material sehingga schema faktur konsisten untuk testing `UCW-03`
- File berubah:
  - `src/store/useMasterStore.js`
  - `src/components/master/masterTabs.js`
  - `src/components/ExpenseForm.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `api/records.js`
  - `src/lib/records-api.js`
  - `src/store/useTransactionStore.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Material invoice sekarang memakai supplier master bertipe Material, bukan input bebas
  - Expense umum memakai supplier contextual operasional/lainnya, tetapi tetap mempertahankan supplier legacy saat edit record lama
  - Backend material invoice kini memvalidasi supplier_id material dan tetap bisa memproses data lama yang belum punya supplier schema final
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`

### [2026-04-18] `UCW-07` - Finalisasi detail dan kontrak attendance record bergaji

- Status: `validated`
- Ringkasan:
  - Menambahkan read model detail attendance per ID agar record absensi bisa dilihat sebagai satu entitas dengan salary bill yang terkait
  - Mengunci guard edit/delete untuk attendance yang sudah ditagihkan agar tidak memutus relasi ke salary bill dari halaman editor
  - Menyediakan aksi soft delete dan restore untuk attendance yang belum billed, plus link cepat ke tagihan gaji terkait
- File berubah:
  - `api/records.js`
  - `src/lib/records-api.js`
  - `src/store/useAttendanceStore.js`
  - `src/lib/transaction-presentation.js`
  - `src/pages/EditRecordPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Attendance detail sekarang bisa dimuat dari API per `attendanceId` dan menyertakan relasi `salary_bill`
  - Attendance yang sudah `billed` tidak menampilkan jalur hapus dari editor sehingga relasi salary bill tetap aman
  - Route edit attendance kini terhubung ke presentasi transaksi agar detail attendance bisa dibuka konsisten dari ledger
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Editor attendance sekarang menampilkan lebih banyak konteks relasional, sehingga data lama yang belum sinkron bisa memunculkan error guard yang eksplisit
  - Hapus attendance dibatasi dari editor; alur recycle bin tetap menjadi jalur aman untuk restore/hapus tree yang lebih dalam
- Next allowed task:
  - `UCW-08` untuk CRUD minimum `loan_payments`

### [2026-04-18] `UCW-08` - CRUD minimum loan_payments

- Status: `validated`
- Ringkasan:
  - Menambahkan read detail pembayaran pinjaman per loan dari store agar history pembayaran tampil di PaymentPage
  - Menambahkan endpoint update dan soft delete untuk `loan_payments` di server transaksi, lalu menyinkronkan ulang status parent loan secara aman
  - Menyediakan aksi edit dan hapus payment pinjaman di UI supaya flow loan payment sejajar dengan bill payment minimum CRUD
- File berubah:
  - `api/transactions.js`
  - `src/lib/transactions-api.js`
  - `src/store/useIncomeStore.js`
  - `src/store/usePaymentStore.js`
  - `src/pages/PaymentPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Loan payment kini bisa diedit dan dihapus dari halaman PaymentPage
  - Status loan dihitung ulang setelah mutasi payment sehingga `paid_amount` dan `status` tetap sinkron
  - Payment history pinjaman tampil sebagai list sendiri, bukan hanya form create
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Karena loan payment masih diproses lewat server API khusus, bila ada data lama yang tidak punya snapshot lengkap, detail history bisa tampil lebih minim
  - Delete loan payment adalah soft delete, jadi flow restore belum dibuka dan akan tetap menjadi scope recycle bin bila dibutuhkan
- Next allowed task:
  - `UCW-09` untuk finalisasi workspace transaksi sebagai `buku kas besar` lintas domain

### [2026-04-18] `UCW-09` - Finalisasi workspace transaksi sebagai buku kas besar lintas domain

- Status: `validated`
- Ringkasan:
  - Meratakan list transaksi workspace menjadi ledger tunggal tanpa header grup tanggal agar lebih dekat ke model buku kas besar
  - Memperbaiki aksi detail agar membuka detail transaksi yang benar, bukan kembali ke list yang sama
  - Menjaga aksi edit/hapus tetap berbasis presentasi transaksi yang ada tanpa menambah kontrak baru di luar kebutuhan page
- File berubah:
  - `src/pages/TransactionsPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - List transaksi sekarang flat dan diurutkan berdasarkan waktu transaksi terbaru
  - Tombol detail membuka `/transactions/:transactionId` dengan state row yang benar
  - Menu aksi tetap konsisten untuk item yang memang editable/deletable
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Task ini masih bergantung pada read model transaksi yang sudah ada; canonical row untuk semua domain detail belum sepenuhnya dipusatkan di sini
  - Karena filter ledger masih sederhana, volume data sangat besar tetap perlu strategi paging/scan berikutnya
- Next allowed task:
  - `UCW-10` untuk guard usage dan detail rapi master data list
- Risiko/regresi:
  - Record lama yang memakai supplier tipe campuran bisa tetap terlihat saat edit, tetapi submit ulang mengikuti validasi supplier contextual baru
- Next allowed task:
  - `UCW-04` untuk halaman detail `bill`

## Follow-up Brief Audit Log

Gunakan section ini setiap ada brief baru sebelum memulai task berikutnya.

### [2026-04-23] `UCW-323` - Audit smoke deep soft-delete, restore, dan permanent delete lintas domain

- Status: `validated`
- Ringkasan:
  - suite e2e untuk `payment`, `restore`, `payroll`, dan `transactions` sekarang menutup archive/restore/permanent-delete yang paling rapuh.
  - detail payroll tetap berada di tab `Riwayat` setelah archive, deleted row tidak duplikat, dan empty-state recycle-bin/payroll tetap muncul saat history kosong.
- File berubah:
  - `src/pages/PaymentsPage.jsx`
  - `src/lib/transaction-presentation.js`
  - `tests/e2e/payment.spec.js`
  - `tests/e2e/restore.spec.js`
  - `tests/e2e/payroll.spec.js`
  - `tests/e2e/transactions.spec.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `PaymentsPage` tidak lagi me-reset tab detail pada initial team hydrate, jadi `Riwayat` tidak snap balik ke `Summary` setelah archive/permanent-delete.
  - `getPayrollBillGroupHistoryRows()` sekarang men-de-duplicate payment aktif/terhapus dengan preferensi row deleted, sehingga warning key ganda hilang dan deleted row tetap tampil saat state overlap.
  - `transactions.spec` sekarang punya timeout level task yang cukup untuk route `/transactions`, `/transactions/history`, dan `/transactions/recycle-bin`, jadi smoke journal/history/recycle-bin tidak gagal karena timeout 30 detik.
- Risiko:
  - coverage ini masih memakai mock/unit-e2e harness; live staging smoke tetap perlu dipisah agar parity data nyata tetap terukur.
  - timeout transaksi dibuat lebih longgar; bila route regresi lagi, failure akan muncul sebagai timeout yang jelas, bukan false green.
- Validasi:
  - `npx playwright test tests/e2e/payment.spec.js --reporter=line`
  - `npx playwright test tests/e2e/restore.spec.js tests/e2e/payroll.spec.js --reporter=line`
  - `npx playwright test tests/e2e/transactions.spec.js --reporter=line`
  - `npm run lint`
  - `npm run build`

### [2026-04-23] `UCW-325` - Kunci DM handoff Telegram assistant dengan token sekali pakai

- Status: `validated`
- Ringkasan:
  - grup fallback Telegram sekarang mengirim tombol DM bertoken sekali pakai yang terikat ke `telegram_user_id` target
  - DM `/start <token>` memvalidasi token, expiry, dan target user sebelum context grup dipindahkan ke private chat
- File berubah:
  - `api/telegram-assistant.js`
  - `api/telegram-assistant-handoff.js`
  - `src/lib/telegram-assistant-links.js`
  - `src/lib/telegram-assistant-routing.js`
  - `supabase/migrations/20260423120000_create_telegram_assistant_handoffs.sql`
  - `tests/unit/telegram-assistant-routing.test.js`
  - `tests/unit/telegram-assistant-handoff.test.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
- Audit hasil:
  - tombol DM grup sekarang membawa token yang hanya bisa ditebus sekali oleh user yang dituju, bukan link generik
  - DM start tanpa token tetap jatuh ke menu, sementara token invalid/expired/wrong user ditolak dengan pesan aman
  - session grup tetap dipertahankan lewat payload snapshot, jadi handoff tidak membuat source of truth baru
- Validasi:
  - `node --check api/telegram-assistant.js`
  - `node --check api/telegram-assistant-handoff.js`
  - `node --check src/lib/telegram-assistant-links.js`
  - `node --check src/lib/telegram-assistant-routing.js`
  - `node --check tests/unit/telegram-assistant-routing.test.js`
  - `node --check tests/unit/telegram-assistant-handoff.test.js`
  - `node --test tests/unit/telegram-assistant-routing.test.js`
  - `node --test tests/unit/telegram-assistant-handoff.test.js`
  - `node --test tests/unit/telegram-assistant-writer.test.js`
  - `npx eslint api/telegram-assistant.js api/telegram-assistant-handoff.js src/lib/telegram-assistant-links.js src/lib/telegram-assistant-routing.js tests/unit/telegram-assistant-routing.test.js tests/unit/telegram-assistant-handoff.test.js tests/unit/telegram-assistant-writer.test.js`
  - `npm run build`
- Risiko/regresi:
  - token DM bergantung pada `TELEGRAM_BOT_USERNAME` dan table handoff baru; jika env atau migration belum ada, tombol DM bertoken akan gagal dibuat
  - user yang membuka link lama setelah expiry akan mendapat penolakan dan perlu minta ulang dari grup

### [2026-04-18]

- Tanggal: `2026-04-18`
- Brief ringkas:
  - logika pinjaman flat interest + tenor + bunga keterlambatan + penalti opsional
  - supplier faktur harus dari master supplier material dan filter supplier harus kontekstual
  - redesign form menjadi section next/back
  - submit CRUD tidak boleh menutup Mini Web App
  - attachment perlu compress + background upload + CRUD attachment terpisah dari parent
- Dampak ke backlog:
  - domain loan, master supplier filtering, shell form mobile, post-submit flow, dan attachment perlu backlog eksplisit
- Task yang ditambah/diubah:
  - tambah `UCW-13`, `UCW-14`, `UCW-15`, `UCW-16`, `UCW-17`, `UCW-18`, `UCW-19`, `UCW-20`
  - revisi `UCW-08`, `UCW-10`, `UCW-12`
- Catatan konflik/dependency:
  - implementasi loan payment tidak boleh lanjut sebelum aturan `UCW-13` dan UI `UCW-14` jelas
  - sectioned form tidak boleh didorong penuh sebelum field/filter domain prioritas sudah stabil

### [2026-04-18]

- Tanggal: `2026-04-18`
- Brief ringkas:
  - recycle bin belum punya fitur hapus permanent untuk entitas prioritas
  - permanent delete perlu dipetakan sebagai stream lanjutan setelah soft delete/restore
- Dampak ke backlog:
  - recycle bin flow tetap dipisah: soft delete/restore di `UCW-11`, permanent delete di task baru
- Task yang ditambah/diubah:
  - tambah `UCW-21`
- Catatan konflik/dependency:
  - `UCW-21` bergantung pada `UCW-11`

### [2026-04-18]

- Tanggal: `2026-04-18`
- Brief ringkas:
  - faktur material multi-item memunculkan error server generik saat simpan
  - menambah item di form material invoice mereset field yang sudah terisi
  - fokus awal analisis ada di `MaterialInvoiceForm` dan save flow material invoice
- Dampak ke backlog:
  - ada gap stabilitas draft multi-item dan gap trace error pada jalur material invoice
- Task yang ditambah/diubah:
  - tambah `UCW-22`
- Catatan konflik/dependency:
  - `UCW-22` bergantung pada `UCW-03` dan `UCW-15`

### [2026-04-18]

- Tanggal: `2026-04-18`
- Brief ringkas:
  - halaman `Transaksi` ingin diubah menjadi `buku kas besar` tunggal lintas domain
  - list harus minimal tanpa header grup tanggal dan tanpa jumlah item per grup
  - parent dan bill yang selama ini berpotensi tampil ganda harus dikonsolidasikan menjadi satu row UI
  - soft delete, restore, dan permanent delete harus aman untuk tree child seperti payment history dan attachment
  - schema dan manajemen child collection transaksi harus dirapikan
- Dampak ke backlog:
  - workspace transaksi, recycle bin, dan permanent delete perlu direstruktur agar berbasis canonical ledger row dan child tree yang aman
- Task yang ditambah/diubah:
  - tambah `UCW-23`, `UCW-24`, `UCW-25`, `UCW-26`, `UCW-27`, `UCW-28`
  - revisi `UCW-09`, `UCW-11`, `UCW-21`
- Catatan konflik/dependency:
  - kontrak ledger tunggal harus dikunci dulu sebelum read model dan UI list diubah
  - guard delete tree tidak boleh difinalkan sebelum child collection payment history dan attachment punya struktur parent yang jelas

### [2026-04-18]

- Tanggal: `2026-04-18`
- Brief ringkas:
  - rincian item material pada faktur perlu detail sendiri dan harus bisa diedit
  - `surat_jalan` perlu CRUD sendiri dan aksi konversi ke expense final dengan bill `unpaid` atau `paid`
  - CRUD di list mutasi dashboard harus dihapus agar terpusat di `Buku Kas Besar`
  - `Buku Kas Besar` perlu strategi list yang tetap ringan jika data membengkak
  - master data yang panjang perlu pola picker/search yang lebih cocok untuk mobile daripada dropdown biasa
- Dampak ke backlog:
  - material invoice child detail, surat jalan conversion, dashboard action model, strategi load data besar, dan UX picker master perlu backlog eksplisit
- Task yang ditambah/diubah:
  - tambah `UCW-29`, `UCW-30`, `UCW-31`, `UCW-32`, `UCW-33`
  - revisi `UCW-17`, `UCW-24`
- Catatan konflik/dependency:
  - detail child line item dan conversion `surat_jalan` tidak boleh dibangun sebelum canonical row ledger dan tree parent-child jelas
  - strategi skalabilitas list harus dikunci sebelum read model ledger final diimplementasikan

### [2026-04-18]

- Tanggal: `2026-04-18`
- Brief ringkas:
  - manajemen attachment harus rapi sebagai child record transaksi
  - CRUD attachment yang tampil di UI harus mengikuti role masing-masing
  - kontrak role attachment harus konsisten antara UI, API, dan schema child collection
- Dampak ke backlog:
  - stream attachment perlu matriks role eksplisit agar visibility aksi dan guard backend tidak berbeda
- Task yang ditambah/diubah:
  - tambah `UCW-34`
  - revisi `UCW-12`, `UCW-20`, `UCW-27`
- Catatan konflik/dependency:
  - attachment UI tidak boleh difinalkan sebelum role matrix CRUD dikunci
  - child collection attachment harus mengikuti rule role yang sama dengan kontrak UI

### [2026-04-18] `UCW-22` - Stabilkan draft multi-item faktur material dan trace error simpan

- Status: `validated`
- Ringkasan:
  - Menambahkan draft persistence berbasis `sessionStorage` untuk form faktur material mode create agar tambah item tidak mengosongkan field yang sudah diisi jika terjadi remount
  - Menambah guard event pada aksi tambah/hapus item supaya klik tidak memicu submit atau bubbling yang tidak perlu
  - Memperjelas error backend material invoice dengan format yang menampilkan message, detail, hint, dan code dari objek error Supabase
- File berubah:
  - `src/components/MaterialInvoiceForm.jsx`
  - `api/records.js`
  - `supabase/migrations/20260418090000_add_project_id_to_stock_transactions.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Draft create mode sekarang tetap tersimpan selama sesi browser, jadi penambahan item tidak lagi bergantung sepenuhnya pada render state in-memory
  - Error save material invoice tidak lagi jatuh ke pesan generik jika backend mengembalikan detail error yang lebih spesifik
  - Aksi add/remove item tetap semantik button biasa tanpa submit implisit
  - Schema `stock_transactions` diselaraskan dengan trigger aktif lewat penambahan kolom `project_id` dan backfill dari `expenses.project_id`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Draft create mode disimpan di `sessionStorage`, jadi browser yang sangat ketat terhadap storage bisa membuat draft tidak persisten; form tetap jalan tanpa crash
  - Error backend sekarang lebih detail, sehingga log dan toast bisa lebih panjang saat constraint SQL gagal
  - Migrasi `stock_transactions.project_id` mengandalkan integritas relasi `expenses.project_id`; jika data legacy rusak, backfill harus diinspeksi terpisah
- Next allowed task:
  - `UCW-04` untuk halaman detail `bill`

### [2026-04-18] `UCW-24/UCW-25/UCW-26/UCW-28` - Finalisasi ledger tunggal, CRUD canonical, dan guard tree recycle bin

- Status: `validated`
- Ringkasan:
  - Read model `workspaceTransactions` sekarang mengembalikan ledger tunggal lintas domain dengan row canonical untuk `project-income`, `loan-disbursement`, `expense`/faktur material, dan `attendance-record`
  - `TransactionsPage` diratakan menjadi list minimal tanpa header grup tanggal, dan aksi edit/hapus diarahkan ke canonical parent yang benar
  - `TransactionDetailPage` sekarang bisa membuka detail canonical row, mengirim ke edit/payment flow yang tepat, dan melakukan soft delete sesuai tree guard
  - Recycle bin sekarang punya permanent delete dengan guard tree sehingga data terhapus permanen tidak meninggalkan orphan child tree
- File berubah:
  - `api/transactions.js`
  - `src/lib/transaction-presentation.js`
  - `src/lib/transactions-api.js`
  - `src/pages/TransactionsPage.jsx`
  - `src/pages/TransactionDetailPage.jsx`
  - `src/pages/DeletedTransactionDetailPage.jsx`
  - `src/pages/TransactionsRecycleBinPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Workspace ledger kini menggabungkan row canonical dari income, loan, expense, dan attendance tanpa menampilkan bill sebagai list terpisah
  - Detail transaksi bisa membuka edit/canonical payment flow sesuai jenis row, termasuk expense material dan attendance yang terkait bill gaji
  - Aksi delete di list dan detail page memakai guard berbasis tree/bill status sehingga item yang sudah punya child pembayaran diblok sesuai aturan
  - Permanent delete recycle bin menghapus tree child terkait sebelum parent dibersihkan
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Ledger aktif sekarang lebih berat dari versi cash-mutation murni karena membawa row canonical lintas domain
  - Permanent delete bersifat destruktif; jika dipakai di luar recycle bin, data child akan ikut hilang
- Next allowed task:
  - `UCW-34` untuk role matrix attachment, lalu `UCW-27` setelah dependency attachment siap

### [2026-04-18] `DOC-PLAN-UPDATE-04` - Tambahan brief filter transaksi semua jenis catatan

- Status: `validated`
- Ringkasan:
  - Mencatat brief baru bahwa filter tab di `TransactionsPage` tidak boleh lagi terbatas pada `uang masuk` dan `uang keluar`
  - Menambahkan micro-task eksplisit agar filter menampilkan semua jenis catatan yang dikelola di ledger buku kas besar
  - Mempertahankan arah ledger tunggal yang sudah ada, tetapi memperjelas bahwa UI filter masih perlu task tersendiri
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Brief ini sudah tercermin sebagai `UCW-35` di planning
  - Dependency tetap konsisten dengan `UCW-09`, `UCW-24`, `UCW-25`, dan `UCW-26`
- Validasi:
  - Cek ringan `rg` untuk memastikan task baru dan status log konsisten
- Risiko/regresi:
  - Jika task ini dikerjakan sebelum filter row canonical stabil, label filter bisa tidak selaras dengan sourceType yang tampil di list
- Next allowed task:
  - `UCW-34` tetap prioritas aktif, lalu `UCW-35` setelah itu

### [2026-04-18] `UCW-31/UCW-32/UCW-35` - Dashboard mutasi read-only, strategi ledger besar, dan filter full ledger

- Status: `validated`
- Ringkasan:
  - Menghapus aksi CRUD mutasi dari dashboard sehingga dashboard kembali menjadi ringkasan dan navigasi
  - Menegaskan strategi skalabilitas `Buku Kas Besar` untuk data besar dengan window pagination, filter server-side, pencarian terindeks, dan progressive hydration
  - Menegaskan filter `TransactionsPage` sebagai filter semua jenis catatan ledger, bukan lagi hanya uang masuk/keluar
- File berubah:
  - `src/pages/Dashboard.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Dashboard mutasi sekarang hanya membuka detail row, tanpa edit/bayar/hapus
  - Strategi ledger besar sudah dicatat eksplisit sebagai arah scalable untuk task load data berikutnya
  - Filter ledger lengkap sudah selaras dengan helper presentasi canonical row di `TransactionsPage`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Dashboard kini lebih konservatif; pengguna harus masuk ke `Buku Kas Besar` untuk aksi mutasi
  - Strategi skalabilitas ledger masih harus diterapkan penuh di task list/data-load berikutnya bila volume data membesar
- Next allowed task:
  - `UCW-34` tetap active stream non-ledger, sementara ledger slice ini sudah clear

### [2026-04-18] `UCW-29/UCW-30` - Detail line item material dan konversi surat jalan

- Status: `validated`
- Ringkasan:
  - Detail transaksi material sekarang memuat rincian line item yang dapat diaudit langsung dari halaman detail
  - Edit alur material invoice tetap mempertahankan child item agar struktur faktur bisa dikelola rapi
  - Surat jalan sekarang punya jalur konversi yang jelas ke edit flow invoice sehingga status final bisa disesuaikan ke faktur/bill sesuai kebutuhan operasional
- File berubah:
  - `src/pages/TransactionDetailPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Item faktur material tampil di detail page sebagai daftar child yang eksplisit
  - Label aksi detail untuk surat jalan menegaskan jalur konversi ke edit flow
  - Status backlog `UCW-29` dan `UCW-30` sudah dipindah ke `validated`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Detail material invoice kini memuat lebih banyak informasi sehingga page sedikit lebih berat saat data item banyak
  - Jalur konversi surat jalan tetap bergantung pada disiplin edit flow agar perubahan final tidak melompat ke status yang salah
- Next allowed task:
  - `UCW-34` tetap stream berikutnya yang non-ledger

### [2026-04-18] `DOC-PLAN-UPDATE-05` - Audit brief timestamp realtime, recent-only dashboard, dan badge mutasi

- Status: `validated`
- Ringkasan:
  - Mengaudit brief baru tentang sinkronisasi timestamp UI/backend agar mengikuti zona input pengguna, bukan jam server statis
  - Mengaudit brief dashboard mutasi agar list hanya menampilkan aktivitas terbaru dari source of truth ledger di halaman `Buku Kas Besar`
  - Mengaudit brief badge list mutasi agar creator label mengikuti id user pelaku dan badge tambahan yang tidak perlu dipangkas
  - Brief ini ditegaskan ulang oleh user: tombol `More` beserta modal aksinya harus hilang, dan list mutasi hanya menampilkan beberapa aktivitas terbaru
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Task baru `UCW-36`, `UCW-37`, dan `UCW-38` sudah ditambahkan ke planning
  - Dependency baru sudah dicatat agar timestamp dan dashboard cleanup tidak dikerjakan terpisah dari source of truth ledger
  - Current active task stream tetap `UCW-34`
- Validasi:
  - Cek ringan `rg` untuk memastikan task baru dan dependency konsisten
- Risiko/regresi:
  - Timestamp menyentuh banyak layer, jadi implementasi berikutnya harus jaga format dan timezone agar tidak merusak sorting list
  - Dashboard recent-only harus tetap menjaga entry point yang cukup informatif tanpa memicu action spillover
- Next allowed task:
  - `UCW-34` tetap active stream non-ledger, sementara brief baru ini sudah masuk backlog

### [2026-04-18] `UCW-34` - Matriks role-based attachment CRUD dikunci

- Status: `validated`
- Ringkasan:
  - Menambahkan helper role matrix attachment yang dipakai bersama oleh store frontend dan API backend
  - Mengikat aksi attachment `view`, `upload`, `edit metadata`, `delete`, `restore`, dan `permanent delete` ke role eksplisit
  - Menyediakan endpoint policy ringan agar backend bisa mengembalikan matrix dan permission efektif untuk role aktif
- File berubah:
  - `src/lib/attachment-permissions.js`
  - `src/store/useFileStore.js`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Owner/Admin mendapat akses attachment penuh
  - Logistik dan Administrasi dapat mengelola attachment tetapi tidak permanent delete
  - Payroll dan Viewer dibatasi ke view-only
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Matrix ini sekarang menjadi source of truth untuk attachment; kalau ada kebutuhan role berbeda di domain tertentu, task turunan harus merevisi helper ini secara eksplisit
- Next allowed task:
  - `UCW-12` untuk arsitektur attachment expense dan material invoice

### [2026-04-18] `UCW-12` - Arsitektur attachment expense dan material invoice difinalkan

- Status: `validated`
- Ringkasan:
  - Menambahkan endpoint backend untuk relasi child attachment expense yang bisa di-load, di-attach, di-soft-delete, di-restore, dan dihapus permanen
  - Menautkan response expense dan material invoice dengan child attachment supaya form edit bisa menampilkan lampiran langsung dari source of truth
  - Menambahkan section lampiran di form expense dan faktur material untuk upload, rename metadata, restore, dan delete sesuai role matrix yang sudah dikunci
- File berubah:
  - `api/records.js`
  - `src/lib/records-api.js`
  - `src/store/useTransactionStore.js`
  - `src/components/ExpenseAttachmentSection.jsx`
  - `src/components/ExpenseForm.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `supabase/migrations/20260418094500_add_attachment_lifecycle_columns.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - Expense/material invoice sekarang memuat lampiran child dari backend, bukan data lepas
  - Upload lampiran tersambung ke parent expense dan bisa dikelola di form edit
  - Metadata file asset bisa diubah dari section lampiran, sementara delete/restore attachment mengikuti relasi child
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - Attachment sekarang bergantung pada field child `expense_attachments` yang baru; data lama tanpa relasi tidak akan muncul sampai dihubungkan ulang
  - Permanent delete attachment masih dibatasi ke relasi child agar tidak merusak file asset bersama dari domain lain
- Next allowed task:
  - `UCW-19` untuk library attachment ringan dengan compress dan background upload

### `2026-04-18` - Brief lanjutan redesign UI/UX form global dan konsisten

- Status: `planned`
- Ringkasan:
  - menambahkan backlog micro-task baru untuk redesign form agar section per halaman lebih seimbang dan konsisten secara visual
  - fokus awal dibatasi ke `Income`, `Loan`, dan `MaterialInvoice/Faktur`
  - gap tombol submit di form Faktur dicatat eksplisit supaya tidak hilang saat redesign
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - brief baru sudah dimasukkan ke planning sebagai `UCW-48` sampai `UCW-53`
  - dependency diurutkan dari audit balance section, shared section primitive, lalu form per domain
- Validasi:
  - audit dokumen planning dan progress log
- Risiko/regresi:
  - redesign per form harus tetap menjaga post-submit flow dan tidak mengulang masalah submit yang hilang pada Faktur

### `2026-04-18` - Detail backlog redesign form global

- Status: `planned`
- Ringkasan:
  - memperinci `UCW-48` sampai `UCW-53` sebagai urutan kerja yang bisa dieksekusi berurutan
  - mengunci urutan `audit -> primitive reusable -> Income -> Loan -> Faktur -> audit final`
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - baris backlog baru sudah muncul di tabel utama dan status awalnya `planned`
  - dependency menjaga supaya desain global tidak langsung lompat ke form spesifik sebelum rubric visual ada
- Validasi:
  - review konsistensi tabel backlog dan brief baru
- Risiko/regresi:
  - bila urutan ini dilanggar, hasil visual tiap form bisa drift dan tombol submit Faktur berisiko hilang lagi

### `2026-04-18` - Brief lanjutan semua form di repo menjadi section

- Status: `planned`
- Ringkasan:
  - memperluas scope redesign agar semua form di repo ikut pola section, bukan hanya form prioritas
  - membagi backlog ke inventaris form, implementasi form transaksi operasional, implementasi form master/utilitas, standardisasi global, dan audit final
  - menjaga agar form master/utilitas boleh lebih ringkas tetapi tetap konsisten satu sistem
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - task baru `UCW-54` sampai `UCW-58` sudah ditambahkan ke tabel backlog
  - dependency baru menjaga agar tidak ada form yang langsung diubah tanpa inventaris dan rubric section terlebih dulu
- Validasi:
  - review konsistensi planning dan progress log
- Risiko/regresi:
  - cakupan semua form lebih luas, jadi perlu disiplin agar task tidak melebar ke refactor yang tidak diminta

### `2026-04-18` - Brief lanjutan form Hrd dan penerima manfaat

- Status: `planned`
- Ringkasan:
  - merevisi task `Hrd` dan `Penerima Manfaat` agar target akhirnya bukan lagi modal internal, tetapi routed form sectioned seperti flow form lain
  - mempertahankan halaman list sebagai entry point, lalu memindahkan create/edit ke route form aktif yang memakai reusable component global
  - menjaga agar dua area ini tetap ringkas di mobile dan konsisten dengan header/CTA global
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `UCW-59` dan `UCW-60` direvisi menjadi audit transisi modal ke routed form
  - `UCW-61`, `UCW-62`, dan `UCW-63` ditambahkan untuk reusable routed form shell dan audit final
  - planning baru menegaskan bahwa `AppSheet` saat ini adalah path lama/transisional, bukan target akhir UI
- Validasi:
  - review konsistensi planning dan progress log
- Risiko/regresi:
  - jika implementasi nanti mencampur list page dan routed form tanpa guard yang jelas, flow navigasi bisa mismatch dengan pola form global

### `2026-04-18` - Brief lanjutan modal `HRD` dan `Penerima` menjadi routed form

- Status: `planned`
- Ringkasan:
  - menambahkan brief eksplisit bahwa modal internal untuk create/edit `HRD` dan `Penerima Manfaat` harus diubah menjadi routed form sectioned
  - route baru wajib memakai reusable component global yang sama dengan halaman form lain
  - modal lama dicatat sebagai legacy path yang nantinya harus dihapus atau dinonaktifkan saat implementasi
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - planning sudah membedakan list page, route form page, dan legacy modal path
  - dependency diarahkan ke `UCW-59` sampai `UCW-63` agar transisi tidak lompat langsung ke implementasi UI
- Validasi:
  - review konsistensi planning dan progress log
- Risiko/regresi:
  - tanpa pemisahan ini, implementasi bisa berhenti di sekadar redesign modal dan tetap mismatch dengan target UX global

### `2026-04-18` - Brief lanjutan komponen reusable global untuk semua form

- Status: `planned`
- Ringkasan:
  - menegaskan bahwa desain global semua halaman form harus diturunkan dari komponen reusable yang sama
  - scope reusable mencakup shell section, header, CTA, note/collapsible, dan safe spacing dasar
  - semua form berikutnya hanya menyesuaikan isi data, bukan membuat pattern visual baru
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - arah reusable sudah dikunci ke `UCW-49`, `UCW-57`, dan `UCW-58`
  - inventaris form di `UCW-54` tetap valid tetapi harus memakai primitive yang sama
- Validasi:
  - review konsistensi planning dan progress log
- Risiko/regresi:
  - jika tiap form kembali membuat pattern visual sendiri, konsistensi global akan pecah dan audit final jadi lebih sulit

### `2026-04-18` - Audit planning `UCW-48` sampai `UCW-60` terhadap repo aktual

- Status: `planned`
- Ringkasan:
  - mengaudit backlog `UCW-48` sampai `UCW-60` terhadap entry point form dan page-section yang benar-benar aktif di repo
  - menajamkan file target, dependency, dan definition of done supaya mengikuti wrapper aktif, bukan asumsi generik
  - mengunci perbedaan antara route form shell, page-section + sheet editor, dan komponen legacy/unused
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `FormLayout` saat ini belum memakai props `actionLabel`, `formId`, `onSubmit`, `submitDisabled`, dan `isSubmitting`, padahal wrapper aktif sudah mengirim props tersebut
  - `AttendancePage`, `MaterialInvoicePage`, `PaymentPage`, `EditRecordPage`, dan `MasterFormPage` ditegaskan sebagai wrapper form aktif yang harus jadi target utama reusable shell
  - `HrdPipeline` dan `BeneficiaryList` ditegaskan sebagai `PageSection` + `AppSheet` editor, bukan kandidat migrasi ke `FormLayout`
  - `TransactionForm` dan `MasterMaterialForm` ditegaskan sebagai exception/legacy sampai ada route atau aktivasi baru
- Validasi:
  - audit repo dengan `rg` dan review file target aktual
- Risiko/regresi:
  - tanpa pembedaan antara wrapper aktif, page-section editor, dan legacy form, implementasi mudah mismatch dan berisiko mengulang bug CTA/submit yang hilang

### `2026-04-18` - Implementasi `UCW-48` sampai `UCW-50`

- Status: `validated`
- Ringkasan:
  - menambahkan primitive reusable global `FormSection` dan `FormActionBar` di `AppPrimitives` untuk dipakai lintas halaman form aktif
  - membuat `FormLayout` menghormati contract CTA shell lewat `formId`, `actionLabel`, `isSubmitting`, dan `submitDisabled` sehingga page wrapper yang menyembunyikan aksi internal tetap punya footer submit konsisten
  - merapikan `IncomeForm` ke tiga section reusable yang lebih seimbang: identitas termin, nominal/deskripsi, serta preview/simpan
  - membersihkan wrapper kosong di `AttendancePage` dan `MaterialInvoicePage` yang sebelumnya hanya placeholder
- File berubah:
  - `src/components/ui/AppPrimitives.jsx`
  - `src/components/layouts/FormLayout.jsx`
  - `src/components/IncomeForm.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `src/pages/AttendancePage.jsx`
  - `src/pages/MaterialInvoicePage.jsx`
  - `scripts/serve-dist.mjs`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - wrapper aktif seperti `AttendancePage`, `MaterialInvoicePage`, `MasterFormPage`, dan `PaymentPage` kini punya jalur CTA shell yang nyata
  - `IncomeForm` memakai section reusable yang lebih balance tanpa mengubah payload atau flow simpan
  - `EditRecordPage` tidak lagi mengirim props CTA yang diabaikan ke shell, sehingga contract wrapper tetap selaras dengan primitive baru
  - audit mismatch repo aktual di `UCW-48` terkonfirmasi dan ditutup oleh implementasi `UCW-49` sampai `UCW-50`
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - `FormLayout` footer CTA kini bergantung pada `formId`; wrapper baru harus menjaga contract ini agar submit tidak hilang lagi
  - `IncomeForm` lebih terstruktur tetapi tetap memakai nested section shell; perubahan visual lanjutan perlu menjaga density mobile

### `2026-04-18` - Implementasi `UCW-51`

- Status: `validated`
- Ringkasan:
  - merapikan `LoanForm` ke tiga section reusable yang konsisten: sumber dana, pokok dan preview, serta denda dan catatan
  - mengganti shell section lokal dengan `FormSection` agar visual balance dan styling mengikuti primitive global yang sama
  - mengubah aksi utama ke `AppButton` dan error state ke `AppErrorState` supaya flow loan memakai komponen reusable yang sama dengan form prioritas lain
- File berubah:
  - `src/components/LoanForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - preview perhitungan tetap terbaca dan tidak mengubah payload submit
  - create/edit loan tetap berjalan lewat `EditRecordPage` tanpa bergantung pada pattern lokal yang menyimpang
  - `LoanForm` sekarang sejajar dengan primitive form reusable yang dipakai di income flow
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - perubahan visual tidak mengubah business logic, tetapi preview angka tetap perlu diawasi bila helper loan business rule berubah di task berikutnya

### `2026-04-18` - Implementasi `UCW-52`

- Status: `validated`
- Ringkasan:
  - merapikan `MaterialInvoiceForm` ke section reusable global untuk header dokumen, line items, lampiran, dan ringkasan
  - mengganti CTA tambah item dan submit ke `AppButton`, lalu error state utama ke `AppErrorState` agar UI konsisten dengan primitive form yang sudah dipakai di slice prioritas
  - menjaga dua jalur submit tetap benar: route faktur memakai footer CTA shell dari `FormLayout`, sementara edit inline di `EditRecordPage` tetap bisa memakai submit lokal saat `hideActions` tidak aktif
- File berubah:
  - `src/components/MaterialInvoiceForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - form faktur material sekarang lebih seimbang secara visual dan mengikuti pattern reusable yang sama dengan `IncomeForm` dan `LoanForm`
  - CTA submit tetap muncul di route faktur melalui `FormLayout`, dan tetap aman untuk embedded edit flow
  - lampiran tetap ditangani di section sendiri tanpa memecah alur submit
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - line item area masih padat; jika nanti dipoles lagi, jaga agar spacing desktop dan mobile tetap seimbang dan tidak memecah alur input cepat

### `2026-04-18` - Audit `UCW-53`

- Status: `validated`
- Ringkasan:
  - mengaudit tiga form prioritas `Income`, `Loan`, dan `MaterialInvoice` setelah primitive reusable dipasang
  - memverifikasi wrapper aktif `EditRecordPage` dan `MaterialInvoicePage` tetap sinkron dengan `FormLayout` baru, termasuk footer CTA dan `hideActions`
  - memastikan tidak ada mismatch visual/fungsional pada flow submit yang sudah direstrukturisasi di `UCW-50` sampai `UCW-52`
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - slice prioritas kini konsisten secara visual dan contract wrapper-nya sudah selaras dengan reusable primitive yang dipakai
  - `FormLayout` footer CTA tetap aktif untuk route form yang membawa `formId` dan `actionLabel`
  - `MaterialInvoiceForm` tetap aman di dua konteks: route faktur dan embedded edit flow
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - audit ini menutup slice prioritas, tetapi task berikutnya masih harus menjaga agar form baru yang di-section-kan ikut memakai contract reusable yang sama

### `2026-04-18` - Hotfix blank UI form prioritas

- Status: `validated`
- Ringkasan:
  - menambahkan import `AppButton` ke `FormLayout` agar branch embedded yang dipakai `Income`, `Loan`, dan `MaterialInvoice` tidak crash saat render
  - mengembalikan navigasi section aktif di shell embedded, sehingga tiga halaman prioritas yang sempat blank kembali menampilkan UI
- File berubah:
  - `src/components/layouts/FormLayout.jsx`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - blank UI pada tiga halaman prioritas tertutup karena komponen yang dipakai di branch render sekarang benar-benar tersedia
  - form shell embedded kembali bisa menampilkan kontrol section tanpa error runtime di browser
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - tidak ada perubahan logic submit; risiko tersisa hanya pada penyesuaian visual lanjutan di section embedded

### `2026-04-18` - Finalisasi attachment invoice aktif

- Status: `validated`
- Ringkasan:
  - menyatukan ringkasan dan lampiran faktur material ke satu section agar flow simpan lebih linear
  - mengaktifkan `savedExpenseId` setelah submit pertama sehingga lampiran bisa langsung diunggah tanpa pindah layar
  - menambahkan preview gambar aktif serta kontrol pilih/ganti/hapus pada draft file, sambil tetap memakai backend upload/attach yang sudah ada
- File berubah:
  - `src/components/MaterialInvoiceForm.jsx`
  - `src/components/ExpenseAttachmentSection.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - ringkasan dan lampiran kini berada dalam satu section yang sama
  - lampiran aktif langsung muncul setelah invoice tersimpan pertama kali
  - preview gambar dan kontrol draft file membantu pengguna mengganti atau menghapus file sebelum upload
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - section invoice menjadi lebih panjang, jadi spacing visual perlu diawasi kalau nanti ada penambahan field lampiran lain

### `2026-04-18` - Finalisasi UI faktur material

- Status: `validated`
- Ringkasan:
  - menghapus kicker/title/description dari section awal faktur material agar card pertama langsung fokus ke input inti
  - mengganti dropdown statis `Jenis Dokumen` dan `Status Pembayaran` menjadi toggle button agar lebih ringkas dan konsisten
  - memindahkan aksi simpan ke section terakhir dan menambahkan fallback `Tutup Form` setelah simpan/edit berhasil
- File berubah:
  - `src/components/MaterialInvoiceForm.jsx`
  - `src/pages/MaterialInvoicePage.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - section awal invoice sekarang langsung memuat field kerja tanpa header copy yang berlebihan
  - field statis yang tidak membutuhkan master data sudah memakai toggle, bukan dropdown
  - submit final tetap berada di section akhir dan hasil sukses menyediakan tombol tutup in-app
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - toggle statis perlu diuji di viewport kecil agar state aktif/nonaktif tetap terbaca jelas
  - footer CTA external pada page faktur dihapus, jadi seluruh submit bergantung pada button final di section terakhir

### `2026-04-18` - Migrasi global toggle statis

- Status: `validated`
- Ringkasan:
  - menambahkan primitive reusable `AppToggleGroup` untuk menggantikan dropdown statis yang tidak mengambil master data
  - memigrasikan status/enum statis di form loan, expense, attendance, HRD, invite, beneficiary, worker, dan faktur material ke toggle group yang sama
  - membiarkan select master-data dan select dinamis tetap memakai dropdown agar pencarian dan konteks data tidak rusak
- File berubah:
  - `src/components/ui/AppPrimitives.jsx`
  - `src/components/LoanForm.jsx`
  - `src/components/ExpenseForm.jsx`
  - `src/components/AttendanceForm.jsx`
  - `src/components/HrdPipeline.jsx`
  - `src/components/TeamInviteManager.jsx`
  - `src/components/BeneficiaryList.jsx`
  - `src/components/WorkerForm.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `select` yang tersisa di repo adalah select yang memang butuh master data atau opsi dinamis
  - static enum field sekarang memakai primitive toggle yang sama, jadi style dan perilaku lebih konsisten
  - tidak ada field statis yang tertinggal di flow form prioritas yang sudah diaudit
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - toggle group yang lebih lebar perlu dicek di viewport kecil, terutama pada 5 opsi seperti role undangan dan status pelamar

### `2026-04-18` - Rapikan shell form dan attachment create-flow

- Status: `validated`
- Ringkasan:
  - mengubah `AppToggleGroup` menjadi segmented control satu baris horizontal agar tidak lagi bertumpuk vertikal
  - menipiskan padding shell form dan menghapus padding embedded yang dobel supaya form lebih dekat ke ritme halaman utama
  - merapikan `Line Items` faktur dengan menghapus header section dan memindahkan tombol `Tambah Item` ke bawah daftar item
  - mengaktifkan attachment create-flow pada expense tanpa kontrak backend baru, karena API/store `expense-attachments` sudah tersedia dan hanya perlu diaktifkan setelah record pertama tersimpan
- File berubah:
  - `src/components/ui/AppPrimitives.jsx`
  - `src/components/layouts/FormLayout.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `src/components/ExpenseForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - toggle reusable sekarang satu baris horizontal dengan overflow aman jika opsi banyak
  - shell form tidak lagi memiliki kesan terlalu masuk ke tengah karena padding wrapper dobel dipangkas
  - attachment bukti foto pada expense aktif setelah create pertama tersimpan; flow faktur tetap memakai jalur yang sama karena invoice berbasis `expense_id`
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - penipisan padding memengaruhi shell yang memakai primitive yang sama, jadi spacing beberapa halaman perlu dicek visual di perangkat sempit
  - create-flow expense sekarang menyisakan attachment aktif pada record yang baru dibuat; jika nanti dibutuhkan mode `buat lagi`, perlu CTA reset yang eksplisit

### `2026-04-18` - Preview lampiran sebelum save

- Status: `validated`
- Ringkasan:
  - mengubah `ExpenseAttachmentSection` agar bisa dipakai tanpa `expenseId`, tetap menampilkan picker + preview lokal sebelum parent record tersimpan
  - setelah `expenseId` tersedia dari save pertama, attachment di-upload dan di-attach otomatis untuk `ExpenseForm` maupun `MaterialInvoiceForm`
  - menghapus kebutuhan placeholder pasif karena area lampiran sekarang selalu aktif di dua form tersebut
- File berubah:
  - `src/components/ExpenseAttachmentSection.jsx`
  - `src/components/ExpenseForm.jsx`
  - `src/components/MaterialInvoiceForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - flow backend tidak berubah; API `expense-attachments` tetap dipakai setelah parent record berhasil dibuat
  - preview file sekarang muncul sebelum save, lalu attach berjalan otomatis setelah create sukses
  - perilaku ini berlaku untuk form pengeluaran dan faktur material, bukan hanya faktur
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - jika upload sukses tetapi attach gagal, file asset bisa tertinggal tanpa relasi parent; ini sudah menjadi risiko jalur upload lama dan belum saya ubah di task ini
  - form create tetap me-reset field setelah save, jadi pengguna masih perlu mengandalkan pesan sukses dan panel lampiran aktif untuk konteks record yang baru dibuat

### `2026-04-18` - Hotfix blank form attachment

- Status: `validated`
- Ringkasan:
  - memperbaiki blank UI yang muncul setelah update attachment karena `isBusy` mengakses `isUploadQueueActive` sebelum variabel itu dideklarasikan
  - menambahkan cleanup otomatis ketika upload file asset sukses tetapi proses attach ke expense gagal, sehingga file asset tidak tertinggal tanpa relasi
- File berubah:
  - `src/components/ExpenseAttachmentSection.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - form expense dan faktur kembali bisa dirender tanpa runtime crash
  - jalur attach sekarang lebih aman karena orphan file asset langsung dihapus permanen saat attach gagal
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - cleanup otomatis hanya menutup kasus upload sukses lalu attach gagal; belum ada retry UI khusus untuk attach yang gagal di tahap akhir

### `2026-04-18` - Sederhanakan kontrol draft lampiran untuk mobile

- Status: `validated`
- Ringkasan:
  - merapikan area draft lampiran agar tidak lagi memakai tombol aksi ganda di bawah preview dan tidak memunculkan card bertumpuk di dalam section
  - placeholder kosong sekarang langsung membuka file picker, sedangkan preview memakai overlay aksi `Simpan`, `Ganti`, dan `Hapus` yang muncul saat area preview diketuk
  - helper status draft diringkas menjadi indikator kecil sehingga state `menunggu simpan form` tetap terbaca tanpa menambah panel baru
- File berubah:
  - `src/components/ExpenseAttachmentSection.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - flow draft lampiran lebih ringkas di mobile karena aksi utama dipusatkan di overlay preview
  - area upload tidak lagi menambah tombol `Ganti file` dan `Hapus pilihan` di luar preview
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - aksi overlay bergantung pada interaksi tap pada preview; bila pengguna tidak menyadari affordance `Kelola`, perlu verifikasi visual di device kecil

### `2026-04-18` - Rapikan overlay preview lampiran di mobile

- Status: `validated`
- Ringkasan:
  - mengubah overlay aksi draft lampiran dari area penuh yang fleksibel menjadi action bar bawah tiga kolom agar tombol tidak wrap dan tidak saling menimpa pada layar sempit
  - membatasi lebar metadata atas preview dan membuat label nama file/status di bawah preview stack pada mobile agar elemen teks tidak saling dorong
- File berubah:
  - `src/components/ExpenseAttachmentSection.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - area aksi draft preview sekarang stabil di mobile karena setiap tombol mendapat slot tetap
  - nama file panjang tidak lagi mendorong badge dan status sampai bertumpuk
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - tiga kolom tetap mengandalkan label tombol pendek; bila nanti label berubah lebih panjang, layout perlu dijaga tetap fixed-width atau diikonkan

### `2026-04-18` - Hardening preview portrait screenshot

- Status: `validated`
- Ringkasan:
  - menambahkan deteksi orientasi preview draft agar gambar portrait seperti screenshot tidak lagi dipaksa ke frame pendek yang membuat area overlay terasa bertumpuk
  - preview portrait sekarang memakai frame lebih tinggi dan `object-contain`, sementara info nama file/tipe dipindah ke bawah preview agar area gambar tidak bersaing dengan metadata atas
  - overlay atas dipadatkan menjadi chip `Kelola` saja sehingga action bar bawah tetap punya ruang aman di layar mobile
- File berubah:
  - `src/components/ExpenseAttachmentSection.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - screenshot tinggi tidak lagi memicu preview yang terasa overlap dengan overlay karena frame portrait menyediakan ruang vertikal lebih besar
  - informasi file tetap terbaca tanpa harus menimpa area gambar
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - frame portrait menambah tinggi section untuk screenshot; ini sengaja agar preview tetap aman, tetapi perlu dipantau agar tidak terasa terlalu panjang pada device yang sangat pendek

### `2026-04-18` - Kunci frame preview draft terhadap overflow horizontal

- Status: `validated`
- Ringkasan:
  - mengubah preview draft dari sizing berbasis tinggi gambar menjadi frame `aspect-ratio` yang selalu mengikuti lebar container
  - menambahkan guard `w-full`, `max-w-full`, `min-w-0`, dan media `block` agar screenshot tinggi dengan resolusi besar seperti `1080x2400` tidak lagi mendorong overflow ke samping
  - frame portrait tetap memakai `object-contain`, tetapi sekarang containment terjadi di wrapper internal yang eksplisit sehingga perilaku browser lebih stabil untuk gambar screenshot yang sangat tinggi
- File berubah:
  - `src/components/ExpenseAttachmentSection.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - preview draft portrait sekarang dikunci terhadap lebar form, bukan bergantung pada dimensi intrinsik gambar
  - action overlay tetap berada di dalam frame yang sama sehingga tidak ikut terdorong ke samping
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - frame landscape dan portrait sekarang lebih deterministik; bila nanti dibutuhkan crop/zoom yang lebih agresif, perlu task terpisah karena containment saat ini memang memprioritaskan kestabilan layout

### `2026-04-18` - Paksa preview draft ke crop statis kecil

- Status: `validated`
- Ringkasan:
  - mencabut pendekatan preview adaptif dan menggantinya dengan frame kecil tetap agar ukuran asli gambar tidak lagi ikut memengaruhi layout
  - semua preview draft sekarang dipaksa `object-cover` dengan anchor `object-top`, sehingga screenshot tinggi tetap tampil sebagai crop kecil yang stabil di mobile
  - state deteksi orientasi dihapus karena justru membuka cabang layout yang tidak diperlukan untuk kebutuhan preview statis
- File berubah:
  - `src/components/ExpenseAttachmentSection.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - preview draft sekarang baku untuk semua ukuran gambar, termasuk screenshot sangat tinggi
  - area overlay tetap menempel pada frame kecil yang sama sehingga tidak lagi bergantung pada dimensi file
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - preview kini lebih agresif memotong gambar, jadi konteks visual yang terlihat memang lebih sedikit; ini sesuai brief untuk memprioritaskan kestabilan UI mobile

### `2026-04-18` - Putus dimensi intrinsik preview draft dari layout

- Status: `validated`
- Ringkasan:
  - mengganti render preview draft dari elemen `<img>` ke frame `div` dengan `background-image` agar ukuran intrinsik file tidak ikut memengaruhi perhitungan layout browser
  - menambahkan `overflow-x-hidden` pada section lampiran untuk memastikan sisa overflow dari preview draft tidak terlihat ke samping
  - pendekatan ini khusus untuk preview draft; daftar attachment tersimpan tidak diubah agar scope tetap sempit
- File berubah:
  - `src/components/ExpenseAttachmentSection.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - preview draft sekarang murni mengikuti frame crop tetap, bukan dimensi asli gambar
  - browser tidak lagi memakai ukuran gambar screenshot untuk memperlebar box preview draft
- Validasi:
  - `npm.cmd run lint`
  - `C:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command \"npm.cmd run build\"`
- Risiko/regresi:
  - karena preview draft sekarang `background-image`, perilaku aksesibilitasnya lebih minimal daripada `<img>` biasa; saya pertahankan `role=\"img\"` dan `aria-label`, tetapi jika butuh zoom/preview detail nanti perlu task terpisah

### `2026-04-20` - Brief baseline migration bootstrap audit + repair

- Status: `validated`
- Ringkasan:
  - migration awal fresh bootstrap gagal karena `public.bills` dipakai sebelum diciptakan, lalu audit chain menemukan baseline core lain yang memang hilang dari repo migration: `profiles`, `projects`, `expense_categories`, `transactions`, `suppliers`, dan tabel runtime `expenses`
  - patch bootstrap menambahkan baseline tables core ke migration paling awal dan mengunci kolom runtime yang dipakai trigger `bills`/`loans`, termasuk `updated_at` pada `loans`
  - duplicate version prefix tetap terdeteksi pada `20260411120000_*` dan dicatat sebagai temuan audit, bukan di-rename dalam task ini
- File berubah:
  - `supabase/migrations/20260410144525_add_bill_payments_and_cash_mutation.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - fresh bootstrap chain now starts with concrete table existence for `profiles`, `projects`, `expense_categories`, `transactions`, `suppliers`, `expenses`, and `bills`
  - `loans` now has `updated_at` plus the loan status/payment columns needed by later trigger/view code
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
- Risiko/regresi:
  - because this task repairs the earliest migration file, any external branch that cached the previous file contents will need to re-run `db push` from the updated local chain; the SQL itself is idempotent via `create table if not exists` / `add column if not exists`

### `2026-04-20` - Brief duplicate Supabase migration version repair

- Status: `validated`
- Ringkasan:
  - verifikasi nyata `npx supabase db push` menunjukkan chain bootstrap sudah lolos migration awal lalu berhenti di collision `schema_migrations.version = 20260411120000`
  - repair dilakukan dengan memberi timestamp unik pada migration `add_team_id_to_materials` tanpa mengubah isi SQL, sehingga urutan tetap berada di antara `20260411120000` dan `20260411143000`
  - patch ini menyelesaikan blocker metadata migration, bukan perubahan behavior domain
- File berubah:
  - `supabase/migrations/20260411121000_add_team_id_to_materials.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - duplicate prefix `20260411120000_*` tidak lagi ada di repo migration aktif
  - SQL `add_team_id_to_materials` tetap identik, hanya version filename yang berubah
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
- Risiko/regresi:
  - environment lama yang pernah mengaplikasikan perubahan `team_id` pada `materials` di luar migration history tetap aman karena SQL memakai `add column if not exists`; tetapi jika ada tooling eksternal yang hardcode nama file lama, referensi itu harus ikut diperbarui

### `2026-04-20` - Brief Supabase storage ownership bootstrap repair

- Status: `validated`
- Ringkasan:
  - verifikasi nyata `db push` memunculkan blocker baru pada `alter table storage.objects enable row level security`, yang gagal karena remote migration role bukan owner objek storage managed Supabase
  - patch mengubah dua blok policy `hrd_documents` menjadi guarded migration: bila remote mengizinkan, policy tetap direfresh; bila tidak, migration hanya emit `notice` dan tidak mematikan bootstrap chain
  - perubahan ini menjaga intent akses bucket `hrd_documents` tanpa memaksa ownership terhadap `storage.objects`
- File berubah:
  - `supabase/migrations/20260411173000_create_hrd_pipeline_and_beneficiaries.sql`
  - `supabase/migrations/20260411235900_final_schema_alignment_hrd_pdf_soft_delete.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - operasi `alter table storage.objects enable row level security` tidak lagi menjadi hard blocker pada bootstrap remote kosong
  - refresh policy storage di file final schema juga tidak lagi gagal fatal saat ownership tidak cocok
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
- Risiko/regresi:
  - pada remote yang menolak ownership-level operations, policy storage akan diskip dengan `notice`, sehingga akses bucket `hrd_documents` harus diverifikasi setelah bootstrap; bila policy memang belum ada secara default, provisioning storage policy perlu follow-up terpisah dengan role yang punya privilege yang sesuai

### `2026-04-21` - Hapus field catatan opsional di row worker form absensi

- Status: `validated`
- Ringkasan:
  - `AttendanceForm` tidak lagi menampilkan input catatan per worker row, sehingga setiap kartu worker lebih ringkas dan fokus ke status kehadiran serta fee lembur.
  - Jalur data legacy `notes` tetap dipertahankan di payload existing agar submit tidak mengosongkan catatan lama tanpa perubahan schema atau kontrak API terpisah.
- File berubah:
  - `src/components/AttendanceForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - `AttendanceRowCard` sekarang hanya memuat toggle status dan input fee lembur saat relevan.
  - `handleCopyPreviousDay`, `Reset Sheet`, dan draft persistence tidak lagi menyalin catatan inline yang tidak dipakai.
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - jika suatu saat catatan worker memang dibutuhkan lagi di surface ini, field tersebut harus ditambahkan kembali secara eksplisit; saat ini perubahan sengaja mempertahankan catatan lama tetapi menghilangkan edit inline dari form.

### `2026-04-21` - Audit redesign Form Absensi Harian untuk micro-task bertahap

- Status: `blocked`
- Ringkasan brief:
  1. `AttendanceForm` masih memakai row card inline, toggle status di dalam kartu, KPI horizontal chip, dan bulk action strip yang perlu dipadatkan.
 2. Brief redesign dipecah jadi micro-task ketat agar tiap perubahan punya boundary jelas: `UCW-229` row shell, `UCW-230` bottom sheet status + role switch collapse, `UCW-231` grid KPI 3:1, `UCW-232` settings sheet, dan `UCW-233` compact top sheet.
 3. Klarifikasi baru menegaskan proporsi `3:1` sebagai ruang `3` untuk total upah kalkulasi dan `1` untuk tombol gear pengaturan massal.
 4. Section di atas KPI juga harus dipadatkan ke dua baris `1:1` supaya tanggal/proyek dan search/salin kemarin tidak memakan tinggi layar awal di mobile.
 5. Tidak ada runtime code yang diubah pada audit ini; eksekusi ditahan sampai urutan task dikonfirmasi.
- File berubah:
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - row worker, summary KPI, top sheet, dan bulk actions terpetakan ke lima task terpisah tanpa mencampur scope implementasi.
  - bottom sheet role switch hanya akan dipakai untuk worker yang punya lebih dari satu wage-rate pada proyek aktif, memakai source of truth master yang sudah ada.
- Task baru atau revisi:
  - Task baru: `UCW-229`
  - Task baru: `UCW-230`
  - Task baru: `UCW-231`
  - Task baru: `UCW-232`
  - Task baru: `UCW-233`
- Catatan dependency:
  - `UCW-230` bergantung pada `UCW-229`.
  - `UCW-231` bergantung pada `UCW-230`.
  - `UCW-232` bergantung pada `UCW-231`.
  - `UCW-233` bergantung pada `UCW-228`.
- Risiko/regresi:
  - jika row click, bottom sheet, dan summary state tidak dipisah dengan jelas, regresi blank UI atau state tumpang tindih bisa muncul lagi di form absensi.

### `2026-04-21` - Ringkas card Sheet Harian di atas KPI untuk mobile

- Status: `validated`
- Ringkasan:
  - `AttendanceForm` top sheet sekarang memakai dua grid horizontal `1:1`, sehingga tanggal/proyek dan search/salin kemarin menempati tinggi layar yang lebih kecil di mobile.
  - `MasterPickerField` ditambah `min-w-0` agar project picker aman saat dipaksa masuk ke kolom setengah lebar.
- File berubah:
  - `src/components/AttendanceForm.jsx`
  - `src/components/ui/MasterPickerField.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - top section absensi menjadi lebih rapat tanpa mengubah urutan kontrol utama.
  - perubahan ini memberi lebih banyak ruang untuk row worker tampil di above-the-fold mobile.
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - pada layar yang sangat sempit, label tombol `Salin Kemarin` masih bisa terasa rapat; jika itu mengganggu, next step adalah mengganti label atau bentuk tombol tanpa mengubah alur.

### `2026-04-21` - Redesign row worker, KPI, dan settings sheet absensi harian

- Status: `validated`
- Ringkasan:
  - `AttendanceForm` sekarang memakai row worker ala global list: ikon worker di kiri, nama dan role di tengah, nominal dan status badge di kanan, lalu row membuka bottom sheet detail saat ditekan.
  - Bottom sheet worker memuat grid status `2x2`, input `Fee Lembur` saat status `overtime`, dan collapse `Ubah Peran` untuk worker yang punya lebih dari satu wage-rate pada proyek aktif.
  - KPI harian diringkas ke bar horizontal `3:1`: tile `Total Upah` membuka bottom sheet KPI dengan komposisi `1-2-2`, sedangkan tombol gear membuka bottom sheet pengaturan massal `2-2-1` dengan reset di baris terakhir.
- File berubah:
  - `src/components/AttendanceForm.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - row sheet, KPI sheet, dan settings sheet sekarang dipisah jelas sehingga form absensi tetap fokus ke input utama dan tidak menumpuk kontrol inline.
  - flow status, fee lembur, dan pergantian role tetap memakai source of truth yang sudah ada di master store dan sheet draft state.
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - reset massal sekarang mengosongkan draft editable untuk kembali ke baseline; jika ada kebutuhan reset yang lebih granular, itu perlu task terpisah.

### `2026-04-21` - Pulihkan save lembur dan baca absensi saat `overtime_fee` belum ada di schema cache

- Status: `validated`
- Ringkasan:
  - runtime attendance API sekarang retry query/update tanpa `overtime_fee` ketika PostgREST mengembalikan `PGRST204` atau `42703`, sehingga form absensi, edit attendance, dan history tidak lagi blank saat schema cache/live DB belum sinkron.
  - `AttendanceForm` dan `EditRecordPage` tetap bisa menurunkan nilai fee dari `total_pay` dan wage base, jadi field overtime tetap usable walau kolom belum tersedia.
  - migration schema `overtime_fee` tetap disimpan sebagai hardening tambahan, tetapi runtime tidak lagi bergantung penuh pada kolom itu untuk mencegah crash.
- File berubah:
  - `api/records.js`
  - `src/components/AttendanceForm.jsx`
  - `src/pages/EditRecordPage.jsx`
  - `supabase/migrations/20260421194500_refresh_attendance_records_overtime_fee_schema_cache.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - jalur baca/tulis attendance sekarang toleran terhadap schema cache yang belum memuat kolom `overtime_fee`.
  - fallback legacy tetap menjaga data yang sudah ada agar bisa dibaca dan disimpan tanpa menghentikan form/history.
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - response attendance pada environment yang memang belum punya kolom `overtime_fee` tidak akan mengembalikan nilai fee tersimpan dari database, jadi UI mengandalkan derivasi dari `total_pay` dan wage base sampai schema benar-benar tersedia.

### `2026-04-21` - Guard absensi worker-hari-proyek, detail pekerja, dan redesign edit form

- Status: `validated`
- Ringkasan:
  - `AttendanceForm` sekarang membaca histori absensi harian worker di tanggal yang sama dan membatasi opsi status berdasarkan sisa jatah hari, sehingga kombinasi lintas proyek tetap bisa jalan selama tidak melampaui satu hari hitungan.
  - backend attendance menolak save/update/restore yang akan melewati batas satu hari untuk worker yang sama, dan migration baru menambah unique index `team_id + worker_id + attendance_date + project_id` pada record aktif.
  - detail tab `Pekerja` di `PayrollAttendanceHistory` tidak lagi jatuh ke `0/0/0` ketika hydrate detail kosong, sementara edit attendance diringkas supaya lebih dekat ke pola create sheet.
- File berubah:
  - `src/components/AttendanceForm.jsx`
  - `src/components/PayrollAttendanceHistory.jsx`
  - `src/components/ui/AppPrimitives.jsx`
  - `src/lib/attendance-payroll.js`
  - `src/pages/EditRecordPage.jsx`
  - `api/records.js`
  - `supabase/migrations/20260421210000_add_unique_attendance_worker_date_project.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - row existing tetap terisi saat akses sheet tanggal + proyek yang sama, dan opsi status worker sekarang ikut dibatasi oleh sisa kuota harian.
  - backend menolak konflik jatah harian di `persistAttendanceSheet`, `updateAttendance`, dan `restoreAttendance`, jadi guard tidak bergantung pada UI saja.
  - hydrate detail `PayrollAttendanceHistory` memakai fallback summary bila fetch detail kedua kosong, sehingga count worker tetap stabil.
- Validasi:
  - `npm.cmd run lint`
  - `npm.cmd run build`
- Risiko/regresi:
  - histori lama yang sudah keburu invalid terhadap kuota harian bisa tetap terbaca, tetapi akan lebih ketat saat diedit atau disimpan ulang sampai datanya dirapikan.

### `2026-04-20` - Brief Supabase profiles role bootstrap compatibility repair

- Status: `validated`
- Ringkasan:
  - verifikasi nyata `db push` memunculkan blocker berikutnya di `20260411190000_setup_telegram_auth_rbac_rls.sql` karena blok seed `team_members` masih membaca `public.profiles.role`
  - patch membuat seed tersebut adaptif: jika kolom `profiles.role` ada, nilai role lama tetap dipakai; jika tidak ada, seed default ke `Viewer`
  - perubahan ini menjaga bootstrap compatibility terhadap baseline profile minimal tanpa menambah kolom baru ke schema
- File berubah:
  - `supabase/migrations/20260411190000_setup_telegram_auth_rbac_rls.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - migration `11190000` tidak lagi hardcode ketergantungan pada `public.profiles.role`
  - remote yang sudah terlanjur apply migration sebelumnya bisa retry file yang sama karena migration ini memang belum tercatat sukses
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
- Risiko/regresi:
  - pada fresh remote tanpa `profiles.role`, semua backfill `team_members` awal akan masuk sebagai `Viewer`; jika legacy role profile memang perlu dimigrasikan, itu harus dilakukan oleh migration terpisah dengan source data yang eksplisit

### `2026-04-20` - Brief Supabase RBAC bootstrap syntax repair

- Status: `validated`
- Ringkasan:
  - retry nyata `db push` menunjukkan patch `UCW-149` masih gagal dieksekusi karena fallback SQL expression untuk default role ditulis dengan dollar-quote yang bentrok di dalam blok `do $$ ... $$`
  - repair mengganti fallback itu menjadi literal SQL yang valid tanpa mengubah intent adaptif sebelumnya
  - perubahan ini murni syntax fix agar migration `20260411190000` bisa lanjut diparse dan dieksekusi
- File berubah:
  - `supabase/migrations/20260411190000_setup_telegram_auth_rbac_rls.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - fallback role default sekarang berupa expression SQL valid: `'Viewer'`
  - logic adaptif `profiles.role` vs baseline minimal tetap sama
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
- Risiko/regresi:
  - tidak ada risiko behavior baru dari patch ini; jika `db push` masih berhenti sesudahnya, blocker berikutnya kemungkinan berasal dari asumsi schema legacy lain di migration chain, bukan dari syntax `11190000`

### `2026-04-20` - Brief Supabase file_assets bootstrap compatibility repair

- Status: `validated`
- Ringkasan:
  - retry nyata `db push` memunculkan blocker pada `create unique index file_assets_storage_bucket_path_key` karena tabel `public.file_assets` sudah ada dari migration HRD awal tetapi belum memiliki kolom `storage_bucket`
  - patch menambahkan kolom alignment yang hilang ke `public.file_assets` lebih dulu, lalu membackfill `storage_bucket` dari `bucket_name` atau fallback `hrd_documents` sebelum index dibuat
  - perubahan ini menjaga jalur bootstrap fresh remote tanpa mengubah intent schema final `file_assets`
- File berubah:
  - `supabase/migrations/20260411200000_strict_alignment_master_expenses_loans.sql`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - migration alignment tidak lagi mengasumsikan `public.file_assets` langsung berada pada schema versi penuh
  - `storage_bucket` dipastikan ada dan terisi sebelum unique index `file_assets_storage_bucket_path_key` dibuat
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`
- Risiko/regresi:
  - baris `file_assets` lama yang berasal dari migration HRD akan dibackfill ke bucket `hrd_documents` bila `bucket_name` kosong; itu aman untuk bootstrap, tetapi jika ada kebutuhan mapping bucket lain pada data legacy, itu harus ditangani oleh migration data terpisah

### Template

- Tanggal:
- Brief ringkas:
- Dampak ke backlog:
- Task yang ditambah/diubah:
- Catatan konflik/dependency:
- UCW-254 - Planned
  - Backlog: detail agregat payroll worker memakai tab `Summary / Rekap / History Payment`.
  - `Summary` wajib menampilkan nama worker sebagai konteks utama.
  - `History Payment` aktif-only; soft-delete child record ditandai icon warna khusus, permanent delete hilang total.
  - Scope belum diimplementasi; menunggu task worker setelah backlog ini dikunci.

### [2026-04-22] `UCW-275` - Pisahkan rumah PDF settings dan laporan profesional Unit Kerja
- Status: `validated`
- Ringkasan:
  - `ProjectsPage` sekarang berperan sebagai report hub `Unit Kerja` yang report-kind first untuk `Executive Finance`, `Project P&L`, dan `Cash Flow`.
  - Pengaturan PDF dipindah ke halaman mandiri `/projects/pdf-settings` agar branding laporan punya rumah UI sendiri dan tidak menumpuk di report hub.
  - Generator PDF bisnis dan data reports kini dibedakan tegas dari receipt/kwitansi pembayaran, sambil tetap memakai sumber data repo yang sudah ada.
- File berubah:
  - `src/components/ProjectReport.jsx`
  - `src/pages/ProjectPdfSettingsPage.jsx`
  - `src/lib/business-report.js`
  - `src/lib/report-pdf.js`
  - `src/lib/reports-api.js`
  - `src/store/useReportStore.js`
  - `api/records.js`
  - `src/App.jsx`
  - `src/components/ui/AppPrimitives.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - settings PDF memiliki route mandiri yang guarded Owner/Admin dan tidak lagi bergantung pada panel tumpuk di report hub.
  - PDF laporan bisnis v1 sudah mendukung preset `Executive Finance`, `Project P&L`, dan `Cash Flow` dengan branding dari `pdf_settings`.
  - jalur legacy report summary/detail tetap kompatibel karena `resource=reports` tanpa `reportKind` masih mengembalikan payload lama.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-276` - Backfill snapshot payroll legacy dan read fallback worker aggregate
- Status: `validated`
- Ringkasan:
  - Payroll bill legacy yang masih kosong snapshot harus dibackfill dari source worker yang benar, tanpa mengubah amount, status, atau relasi bill.
  - Read fallback runtime tetap disiapkan supaya detail payroll aman walau ada row legacy yang belum sempat dibackfill.
- File target:
  - `supabase/migrations/20260422143000_backfill_payroll_snapshot_consistency.sql`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - Kalau fallback terlalu agresif, surface payroll bisa menampilkan label yang tidak cocok dengan identitas worker historis.
- Audit hasil:
  - backfill migration sudah ditambahkan untuk mengisi snapshot payroll legacy dengan prioritas worker relation, lalu fallback deskripsi bila join worker gagal.
  - `loadBillById()` sekarang ikut membawa relation worker dan `mapBillRow()` punya fallback baca ke `workers.name` serta `worker_id` agar match worker aggregate tidak bergantung ke snapshot lama.
- Validasi:
  - `npm run lint`
  - `npm run build`
  - `npx playwright test tests/e2e/payroll.spec.js -g "opens bayar from worker sheet and returns to worker tab" --reporter=line`

### [2026-04-22] `UCW-277` - Redesign PDF laporan bisnis dengan konteks visual per kind
- Status: `validated`
- Ringkasan:
  - Report PDF bisnis sekarang memakai label sumber yang business-facing, bukan nama schema/database mentah.
  - `Project P&L` dipecah menjadi section kartu/band yang lebih jelas, sementara `Executive Finance` dan `Cash Flow` diberi aksen visual berbeda namun tetap satu branding.
- File berubah:
  - `src/lib/report-pdf.js`
  - `src/lib/business-report.js`
  - `src/components/ProjectReport.jsx`
  - `api/records.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Audit hasil:
  - label sumber untuk mutasi kas sekarang lewat helper bisnis bersama dan tidak lagi menampilkan `source_table` mentah di preview maupun PDF.
  - `Project P&L` sekarang menampilkan section terpisah untuk pemasukan, biaya material, biaya operasional, dan biaya gaji dengan subtotal masing-masing.
  - `Executive Finance` dan `Cash Flow` memakai card KPI dan section band dengan aksen warna berbeda sehingga konteks report lebih cepat terbaca.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-278` - Buka detail worker payroll sebagai page bertab
- Status: `validated`
- Ringkasan:
  - klik `Detail` di tab pekerja payroll membuka route detail baru, bukan bottom sheet.
  - page detail dipusatkan ke tab `Info`, `Rekap`, dan `Riwayat` saat history memang ada.
- File target:
  - `src/App.jsx`
  - `src/components/PayrollAttendanceHistory.jsx`
  - `src/pages/PayrollWorkerDetailPage.jsx`
  - `tests/e2e/payroll.spec.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - jika history payment gagal dihimpun dari detail bill dan recycle bin, tab history harus tetap tersembunyi dan page jangan error total.
- Audit hasil:
  - route `/payroll/worker/:workerId` sudah terdaftar di `src/App.jsx` dan diakses dari aksi `Detail` pada sheet worker payroll.
  - `PayrollWorkerDetailPage` sudah menampilkan tab `Info`, `Rekap`, dan `Riwayat` saat history tersedia, sesuai kontrak task.
  - smoke payroll e2e tetap memverifikasi alur detail worker dan label tab riwayat.
- Validasi:
  - `npm run lint`
  - `npm run build`

### [2026-04-22] `UCW-279` - Ringkas report hub PDF dan padatkan pengaturan logo
- Status: `validated`
- Ringkasan:
  - report hub PDF dipadatkan menjadi tab `Umum / Proyek / Kas`, tombol `Filter` sejajar dengan `Sinkronkan` dan `Unduh PDF`, lalu metadata periode dan Unit Kerja tampil sebagai info bar label/value.
  - pengaturan PDF logo memakai tile klik-upload dengan overlay delete, dan `header_color` dipakai sebagai accent utama lintas elemen report yang berwarna.
- File target:
  - `src/components/ProjectReport.jsx`
  - `src/pages/ProjectPdfSettingsPage.jsx`
  - `src/lib/business-report.js`
  - `src/lib/report-pdf.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - jika accent user terlalu terang atau terlalu gelap, sekumpulan section report bisa kehilangan kontras; derivasi tint perlu tetap dijaga aman untuk readability.
- Audit hasil:
  - Page header report hub sekarang hanya memuat identitas halaman dan tombol pengaturan PDF; tombol filter sudah dipindah ke bar aksi bersama sinkronisasi dan unduh.
  - Metadata periode dan unit kerja tidak lagi tampil sebagai badge, melainkan strip info label/value yang lebih rapi dan tidak memecah hierarchy visual.
  - `Project P&L` tetap memakai layout section fit yang sebelumnya sudah dibenahi, jadi perubahan ini hanya memoles struktur shell report hub.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-280` - Padatkan header report hub dan iconize sinkronisasi
- Status: `validated`
- Ringkasan:
  - header `Unit Kerja` sudah diringkas tanpa menambah layer visual baru.
  - tombol `Sinkronkan` kini icon-only supaya tiga aksi utama `Filter`, `Sinkronkan`, dan `Unduh PDF` tetap satu baris di viewport kecil.
- File target:
  - `src/components/ProjectReport.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - jika tombol action terlalu rapat, target tap mobile bisa turun; perlu jaga ukuran icon button tetap konsisten.
- Audit hasil:
  - page header report hub sekarang hanya menampilkan identitas halaman dan tombol pengaturan PDF; aksi sinkronisasi tidak lagi memakai label teks sehingga row aksi di mobile tetap satu baris.
  - `ProjectReport` tidak lagi memunculkan description di header atas, sehingga visual shell lebih ringan dan tidak terasa seperti dua header bertumpuk.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-281` - Satukan header ProjectsPage dan report hub
- Status: `validated`
- Ringkasan:
  - header `Pelaporan / Unit Kerja` di `ProjectsPage` harus menjadi satu-satunya header identitas report hub.
  - header duplikat di `ProjectReport` perlu dihapus, lalu tombol `Pengaturan PDF` dipindah ke header luar `ProjectsPage`.
- File target:
  - `src/pages/ProjectsPage.jsx`
  - `src/components/ProjectReport.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - jika header luar dan isi report tidak selaras, shell bisa terasa kosong di atas atau terlalu padat di bawah.
- Audit hasil:
  - `ProjectsPage` sekarang memegang satu header identitas report hub dengan tombol `Pengaturan PDF`, sementara `ProjectReport` tidak lagi merender header kedua.
  - Struktur visual report hub kini sejajar dengan pola shell `Jurnal`: satu header luar, lalu isi workspace di bawahnya.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-283` - Padatkan aksi report hub dan info strip
- Status: `validated`
- Ringkasan:
  - tombol `Refresh`/`Sinkronkan` harus pindah ke grup info `Rentang tanggal` di kanan agar metadata tetap satu strip.
  - tombol `Filter` harus diberi label dan dipasangkan 1:1 dengan `Unduh PDF` supaya action row lebih stabil di mobile.
- File target:
  - `src/components/ProjectReport.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - jika lebar tombol dan info strip tidak diseimbangkan, row metadata bisa wrap lebih cepat di layar kecil.
- Audit hasil:
  - tombol `Refresh`/`Sinkronkan` sekarang berada di kanan strip `Rentang tanggal`, sehingga metadata dan aksi ringan menyatu dalam satu grup visual.
  - tombol `Filter` sudah berlabel dan disejajarkan dalam grid 1:1 dengan `Unduh PDF`, membuat action row lebih stabil di viewport mobile.
- Validasi:
  - `npm.cmd run lint`
  - `npm run build`

### [2026-04-22] `UCW-282` - Redesign info payroll detail dan ringkas tab Riwayat
- Status: `validated`
- Ringkasan:
  - `Info` payroll detail sekarang memprioritaskan `Tercatat`, lalu kartu nominal `Billed`/`Unbilled`, lalu baris `Tagihan`/`Sisa` dengan label satu kata yang aman di mobile.
  - label tab `History Payment` sudah diganti menjadi `Riwayat` pada surface detail yang relevan.
- File target:
  - `src/pages/PayrollWorkerDetailPage.jsx`
  - `src/pages/PaymentsPage.jsx`
  - `tests/e2e/payroll.spec.js`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - jika KPI terlalu padat, label nominal bisa wrap di layar kecil; compact currency dan label satu kata harus dijaga konsisten.
- Audit hasil:
  - `PayrollWorkerDetailPage` sudah punya hierarchy baru untuk KPI finansial dan metadata non-finansial diringkas ke grid 1:1.
  - `PaymentsPage` dan worker detail payroll sama-sama memakai label tab `Riwayat`, tanpa mengubah value key internal `history`.
  - smoke payroll e2e menutup alur detail worker dan memastikan tab history tetap terbaca sebagai `Riwayat`.
- Validasi:
  - `npm run lint`
  - `npm run build`
  - `npx playwright test tests/e2e/payroll.spec.js --reporter=line`

### [2026-04-22] `UCW-284` - Solidkan seluruh surface dan row list app
- Status: `validated`
- Ringkasan:
  - glass morphic pada surface, nav, sheet, dan row list sudah dinormalisasi ke background solid agar mode gelap tetap terbaca.
- File target:
  - `src/index.css`
  - `src/components/ui/AppPrimitives.jsx`
  - `src/components/ui/ActionCard.jsx`
  - `src/components/ui/BottomNav.jsx`
  - `src/components/AttendanceForm.jsx`
  - `src/components/MasterMaterialForm.jsx`
  - `src/components/HrdPipeline.jsx`
  - `docs/unified-crud-workspace-plan-2026-04-18.md`
  - `docs/progress/unified-crud-workspace-progress-log.md`
- Risiko:
  - jika terlalu agresif, ada kemungkinan beberapa affordance warna status menjadi terlalu mirip dengan surface biasa dan perlu penyeimbangan ulang kontras.
- Audit hasil:
  - surface utama app sekarang memakai background solid tanpa body gradient dan tanpa backdrop blur pada card/page shell.
  - row/action lists yang paling sering dipakai sudah memakai background solid sehingga teks tetap terbaca lebih jelas di dark mode.
  - dekoratif blur dan chip yang paling mengganggu kontras sudah dirapikan tanpa mengubah alur data atau navigasi.
- Validasi:
  - `npm run lint`
  - `npm run build`
