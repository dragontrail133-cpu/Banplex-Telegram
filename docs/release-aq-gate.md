# Release AQ Gate

Dokumen ini memisahkan tiga lane yang sebelumnya masih bercampur:

- `mock regression` untuk menjaga UI shell dan route dasar tetap sehat
- `live smoke staging` untuk membuktikan write real ke Supabase benar-benar bekerja
- `production canary` untuk memastikan runtime production sehat tanpa mutasi destruktif

Gate ini dipakai untuk menjawab dua pertanyaan release:

1. apakah app sudah aman masuk production
2. apakah jalur simpan data real sudah benar-benar berjalan end-to-end

## Baseline Scope

Gate release ini mengikuti scope `core release + Tim + Master`.

Flow yang wajib masuk keputusan release:

- auth bootstrap + workspace access
- dashboard dan `Jurnal`
- create/edit/write core finance
- payment + payroll read path
- `Master`
- `Tim`
- report/PDF business path

Flow yang tetap di luar blocker gate ini:

- `HRD`
- `Penerima Manfaat`
- `Stok Barang`
- assistant Telegram read-only

## Severity

- `blocker`: auth gagal, write real gagal, parent-child mismatch, payment recalculation salah, restore/delete salah target, role gate bocor, report tidak konsisten dengan source final, atau orphan asset
- `major`: flow selesai tetapi ada warning penting seperti notify/report/PDF sebagian gagal
- `minor`: isu UX non-kritis yang tidak mengubah integritas data

Release dinyatakan `Ready` hanya jika tidak ada `blocker`.

## Execution Order

1. `Preflight`
   - `npm run lint`
   - `npm run build`
   - cek env app dan env verifier
   - lint harus membaca source repo saja; artefak generated seperti `playwright-report/` dan `test-results/` tidak boleh ikut mengubah hasil gate
2. `Mock regression`
   - `npm run test:e2e`
   - ini bukan bukti write real
3. `Live smoke staging`
   - jalankan app lokal dengan env staging mirror
   - `npm run test:e2e:live`
   - `npm run aq:verify:live`
4. `Manual AQ`
   - invite redemption akun kedua
   - role switch multi-user
   - sampling mobile Telegram WebView
   - report/PDF business review
5. `Production canary`
   - auth Telegram nyata
   - buka route inti
   - baca report/PDF path
   - tanpa create/update/delete/destructive write

## Live Smoke Contract

Lane `tests/live/release-smoke.spec.js` sengaja memakai:

- app lokal via `vercel dev`
- `devAuthBypass=1`
- session Supabase nyata dari `/api/auth`
- request bisnis nyata tanpa `page.route()` mocking

Smoke report/PDF yang fokus ke browser download + `Kirim ke DM` dipisah ke `tests/live/report-pdf-delivery.spec.js` supaya lane itu bisa divalidasi tanpa menunggu serial smoke besar.
Smoke report mock di `tests/e2e/report.spec.js` mengikuti route canonical `Jurnal` / `Tagihan` dan memakai fixture laporan deterministik supaya download PDF bisa ditrigger dari contract UI terbaru.

Artifact yang dihasilkan:

- `test-results/live-smoke-created-records.json`
- `test-results/live-smoke-verification.json`

Write proof minimum yang harus lolos:

- create `funding_creditor` di `Master`
- create `loan` yang memakai kreditor baru itu
- create `project-income` dan buktikan `fee bill` terkait ikut terbentuk
- create `material invoice` unpaid dan buktikan `bill`, `expense_line_item`, serta `stock_transaction` ikut terbentuk
- create `expense` unpaid yang membentuk `bill`
- create `bill_payment` partial dan buktikan `bill.paid_amount/status` ikut recalculated
- generate `invite_token` di `Tim`

Verifier DB memeriksa:

- row `funding_creditors` tersimpan dan tidak `deleted_at`
- row `loans` tersimpan dengan `creditor_id`, `principal_amount`, `notes`, dan `status` yang benar
- row `project_incomes` tersimpan dengan nominal, tanggal, dan deskripsi smoke yang benar
- row `bills` fee untuk `project_income_id` terkait ada minimal satu dan tetap `unpaid`
- row `expenses` untuk `material invoice` tersimpan dengan total, `document_type`, dan snapshot supplier/proyek yang benar
- row `expense_line_items` dan `stock_transactions` untuk `material invoice` tersimpan sinkron
- row `expenses` tersimpan dengan nominal dan snapshot smoke yang benar
- row `bills` terkait `expense` berubah ke `partial` dengan `paid_amount` dan `remaining` yang sinkron
- row `bill_payments` tersimpan dan terhubung ke `bill` yang benar
- row `invite_tokens` tersimpan dan belum `is_used`

## Required Env

Untuk lane live smoke:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` atau `VITE_SUPABASE_ANON_KEY`
- `OWNER_TELEGRAM_ID` atau `DEV_BYPASS_TELEGRAM_ID`
- `E2E_BASE_URL` opsional, default `http://127.0.0.1:3000`
- `E2E_LOCAL_SERVER_COMMAND` opsional, default `npm run dev:api`
- `E2E_SMOKE_PREFIX` opsional

Untuk verifier:

- `E2E_VERIFY_SUPABASE_URL` atau fallback `VITE_SUPABASE_URL`
- `E2E_VERIFY_SUPABASE_SERVICE_ROLE_KEY` atau fallback `SUPABASE_SERVICE_ROLE_KEY`
- bila env shell kosong, verifier akan membaca `.env` lalu `.env.local`

## Staging Readiness Matrix

| Area | Requirement minimum | Evidence yang harus ada | Blocker jika gagal |
| --- | --- | --- | --- |
| `Supabase parity` | schema migration, RLS, storage bucket, dan function env staging setara production | hasil migrate terbaru, auth bootstrap sukses, bucket target bisa diakses dari app staging | ya |
| `Auth bootstrap` | `devAuthBypass` owner aktif hanya untuk staging/lokal dan menghasilkan session Supabase nyata | app lokal bisa masuk dashboard tanpa mock dan route inti terbuka | ya |
| `Verifier access` | service-role verifier tersedia hanya untuk lane audit | `npm run aq:verify:live` bisa query row smoke | ya |
| `Workspace seed` | ada team staging aktif plus data referensi minimum untuk flow yang diuji | owner masuk ke workspace benar dan picker master yang dibutuhkan punya data | ya |
| `Test accounts` | minimal `Owner`, `Admin`, `Payroll`, dan 1 akun kedua untuk redeem invite | daftar akun uji dan role sudah dibekukan sebelum run | ya |
| `Disposable prefix` | semua data smoke memakai prefix `AQ-SMOKE-*` | artifact `test-results/live-smoke-created-records.json` terisi prefix dan ID row | ya |
| `Cleanup owner` | ada penanggung jawab cleanup staging pasca-run | artifact disimpan dan row smoke bisa dihapus deterministik | ya |
| `Production safety` | production canary tetap read-only | checklist canary tidak berisi create/update/delete | ya |

## Coverage Matrix

| Domain | Preconditions staging | Automation live smoke | Verifier DB | Manual AQ wajib | Release blocker |
| --- | --- | --- | --- | --- | --- |
| `Auth + workspace access` | env app lengkap, owner bypass, team staging aktif | `tests/live/release-smoke.spec.js` membuka `/`, `/transactions`, `/payroll`, `/master` | tidak ada row write khusus; bukti dari route boot sukses | role gate `Owner/Admin/Payroll`, WebView Telegram/mobile | ya |
| `Master: funding creditor` | owner punya akses `Master` | sudah ada create kreditor | `funding_creditors` diverifikasi | CRUD master lain masih manual | ya |
| `Core finance: loan create` | ada kreditor aktif | sudah ada create `loan` | `loans` diverifikasi | payment, detail, report, delete masih manual | ya |
| `Tim: invite generate` | owner punya akses `Tim` | sudah ada generate `invite_token` | `invite_tokens` diverifikasi | redeem invite akun kedua, ubah role, suspend member | ya |
| `Expense -> bill -> payment` | supplier, category, project, dan kas staging siap | sudah ada create `expense` unpaid + partial `bill_payment` dari `/payment/:id` | `expenses`, `bills`, `bill_payments`, dan status `partial` diverifikasi | edit expense, full payment, delete/restore, ledger/tagihan sinkron | ya |
| `Income -> fee bill` | project aktif dan minimal satu staff `per_termin`/`fixed_per_termin` siap | sudah ada create `project-income` dari UI create form | `project_incomes` dan `bills` fee by `project_income_id` diverifikasi | edit income, payment fee, report sinkron, delete lifecycle | ya |
| `Material invoice / surat jalan` | material, supplier material, project, dan stock context siap | sudah ada create `material invoice` unpaid dari UI create form | `expenses`, `bills`, `expense_line_items`, dan `stock_transactions` diverifikasi | edit invoice, `surat_jalan`, rollback stock saat delete/restore | ya |
| `Attendance -> salary bill -> payment` | worker, wage rate, project, dan payroll seed siap | belum ada | belum ada | create attendance, generate salary bill, payment history, guard `billed` | ya |
| `Attachment / file assets` | bucket storage, policy upload, dan metadata relation siap | belum ada | belum ada | upload, preview, relation, cleanup orphan | ya |
| `Report / PDF` | data staging representatif dan env PDF/notifikasi siap | smoke browser download PDF + trigger `Kirim ke DM` dari Mini Web di `tests/live/report-pdf-delivery.spec.js` | belum ada | buka report, cocokkan angka, unduh PDF valid | ya |
| `Delete lifecycle` | row smoke parent-child tersedia untuk uji delete | belum ada | belum ada | soft delete, restore, permanent delete staging-only | ya |

## Next Smoke Priority

Urutan penutupan gap otomatis setelah lane live smoke dasar berjalan:

1. `attendance -> salary bill -> payment`
2. `attachment / file_assets`
3. `soft delete / restore / permanent delete`

## Active Blockers

- `Staging-safe target`
  - repo lokal belum memberi bukti bahwa `.env` aktif benar-benar menunjuk ke mirror staging yang aman untuk write smoke disposable
  - until itu dibuktikan, eksekusi write smoke penuh tidak boleh diasumsikan aman hanya dari context repo
- `Payroll seed`
  - smoke payroll butuh worker, wage rate, project, dan unbilled attendance yang benar-benar siap
  - tanpa seed itu, `fn_generate_salary_bill` tidak bisa dibuktikan end-to-end dari UI
- `Attachment / storage`
  - smoke attachment masih butuh strategi file disposable, proof relation `file_assets`, dan audit orphan cleanup
  - domain ini belum punya artifact verifier khusus
- `Report / PDF`
  - smoke PDF export sekarang sudah divalidasi di lane dedicated browser + Mini Web DM trigger
  - live gate masih belum punya comparator angka source-vs-report yang deterministik dan dataset staging-safe yang representatif
  - target UI/report juga tetap bergantung pada staging-safe dataset yang representatif
- `Delete lifecycle`
  - soft delete/restore bisa diotomasi berikutnya, tetapi permanent delete masih perlu domain disposable yang aman dan verifier cascade child yang jelas

## Checklist Manual AQ

- `Auth`
  - owner bootstrap berhasil
  - current workspace benar
  - capability `Master` dan `Tim` hanya muncul untuk role yang benar
- `Finance`
  - create/edit `income`, `expense`, `loan`, `material invoice`
  - `expense hutang` muncul di `Tagihan`
  - partial payment mengubah parent summary dengan benar
- `Payroll`
  - attendance read path sehat
  - salary bill path dan payment history terbaca
- `Delete lifecycle`
  - soft delete
  - restore
  - permanent delete staging-only
- `Report/PDF`
  - minimal satu report bisnis
  - minimal satu PDF bisnis valid
- `Tim`
  - generate invite
  - redeem invite akun kedua
  - ubah role
  - suspend member
- `Mobile`
  - route inti tetap usable di WebView Telegram/mobile viewport

## Cleanup Rule

Data smoke staging wajib memakai prefix `AQ-SMOKE-*` dan dicatat lewat artifact.

Cleanup dilakukan setelah verifikasi staging dengan aturan:

- hapus row smoke berdasarkan artifact ID, bukan search bebas
- jangan jalankan cleanup ke production
- jika cleanup tidak dijalankan, artifact harus tetap disimpan sebagai audit trail
