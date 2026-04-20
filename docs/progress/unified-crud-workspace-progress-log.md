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
- Current task: `UCW-166`
- Current status: `validated`
- Catatan fokus: bersihkan dokumentasi legacy tentang `TransactionForm`.

## Entries

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
