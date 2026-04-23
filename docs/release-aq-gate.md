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

- app lokal via `Vite`
- `devAuthBypass=1`
- session Supabase nyata dari `/api/auth`
- request bisnis nyata tanpa `page.route()` mocking

Artifact yang dihasilkan:

- `test-results/live-smoke-created-records.json`
- `test-results/live-smoke-verification.json`

Write proof minimum yang harus lolos:

- create `funding_creditor` di `Master`
- create `loan` yang memakai kreditor baru itu
- generate `invite_token` di `Tim`

Verifier DB memeriksa:

- row `funding_creditors` tersimpan dan tidak `deleted_at`
- row `loans` tersimpan dengan `creditor_id`, `principal_amount`, `notes`, dan `status` yang benar
- row `invite_tokens` tersimpan dan belum `is_used`

## Required Env

Untuk lane live smoke:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` atau `VITE_SUPABASE_ANON_KEY`
- `OWNER_TELEGRAM_ID` atau `DEV_BYPASS_TELEGRAM_ID`
- `E2E_BASE_URL` opsional, default `http://127.0.0.1:3000`
- `E2E_SMOKE_PREFIX` opsional

Untuk verifier:

- `E2E_VERIFY_SUPABASE_URL` atau fallback `VITE_SUPABASE_URL`
- `E2E_VERIFY_SUPABASE_SERVICE_ROLE_KEY` atau fallback `SUPABASE_SERVICE_ROLE_KEY`

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
