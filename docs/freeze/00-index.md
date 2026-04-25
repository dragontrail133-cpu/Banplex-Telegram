# Freeze Package Index

Freeze date: `2026-04-19`
Runtime reconciliation: `2026-04-25`
Package status: `official active baseline, runtime-reconciled`
Authority level: `primary planning authority for product, PRD, technical contract, lifecycle, and future AI task framing`

## Tujuan package

Package ini membekukan hasil audit repo, keputusan brainstorming produk terbaru, dan boundary teknis yang harus dipakai oleh task berikutnya.

Mulai freeze ini:

- repo reality tetap menjadi dasar teknis,
- keputusan produk di `docs/freeze/` menjadi keputusan resmi terbaru,
- kontrak `Dokumen Barang` dibekukan sebagai inbound-stock-first, sementara settlement child tidak mengubah identitas parent domain,
- dokumen lama tidak lagi boleh dipakai sebagai sumber utama jika bertentangan,
- brief AI berikutnya harus mengutip domain contract dan lifecycle dari package ini, bukan dari chat atau backlog lama secara liar.

## Rekonsiliasi runtime aktif (`2026-04-23`)

Audit repo aktual menegaskan boundary berikut sebagai baseline package ini:

- dashboard summary aktif dibaca dari `/api/transactions?view=summary` melalui helper server `loadOperationalSummary()` di `api/transactions.js`; `vw_transaction_summary` tinggal artefak kompatibilitas/report legacy,
- `src/store/usePaymentStore.js` sudah memakai wrapper API untuk create/update/delete payment; wording direct insert payment lama hanya historis dan tidak boleh dipakai lagi,
- `src/App.jsx` sudah membuka route `/stock`, dan `src/pages/StockPage.jsx` sudah memuat monitoring stok + manual stock-out terbatas,
- `Referensi` / `Master` adalah domain core-release yang menjadi fondasi semua form inti; boundary runtime yang masih transitional tidak mengubah status domain ini sebagai bagian release inti,
- tabel/view legacy `transactions` dan `vw_transaction_summary` boleh tetap ada di migration chain/schema, tetapi bukan authority write path atau summary aktif,
- direct Supabase write/RPC pada `Tim`, `Referensi`, `HRD`, `File`, dan generate payroll tetap tercatat sebagai runtime exception/transitional boundary, bukan pola baru untuk domain inti.
- snapshot repo terbaru sampai backlog stream `UCW-293` yang sudah `validated` tetap selaras dengan freeze package; sisa kerja aktif berada di boundary transisional yang memang dipisahkan.

## Urutan baca yang direkomendasikan

1. `docs/freeze/00-index.md`
2. `docs/freeze/01-planning-decision-freeze.md`
3. `docs/freeze/02-prd-master.md`
4. `docs/freeze/03-source-of-truth-contract-map.md`
5. `docs/freeze/04-lifecycle-matrix.md`
6. `docs/freeze/05-ai-execution-guardrails.md`

## Fungsi tiap file

| File | Fungsi resmi |
| --- | --- |
| `docs/freeze/00-index.md` | entry point, status package, dan peta superseded references |
| `docs/freeze/01-planning-decision-freeze.md` | keputusan produk final hasil freeze brainstorming |
| `docs/freeze/02-prd-master.md` | PRD ringkas resmi untuk manusia dan AI |
| `docs/freeze/03-source-of-truth-contract-map.md` | kontrak teknis lintas domain untuk task implementasi |
| `docs/freeze/04-lifecycle-matrix.md` | matrix perilaku domain untuk micro-task implementasi |
| `docs/freeze/05-ai-execution-guardrails.md` | guardrail wajib untuk semua task AI sesudah freeze |

## Dokumen lama yang kini historis atau superseded

### Historis / superseded

Dokumen di bawah tetap boleh dibaca sebagai jejak keputusan lama, tetapi tidak lagi menjadi sumber utama:

- `docs/hand-off/app-flow-core-feature-architecture-audit.md`
- `docs/prd-core-feature-release-2026-04-18.md`
- `docs/prd/banplex-prd-master.md`
- `docs/prd/product-requirements-and-planning-handoff.md`
- `docs/ui-ux-planning-blueprint.md`
- `docs/integration-readiness-plan-2026-04-17.md`
- `docs/implementation-continuation-plan-2026-04-17.md`
- `docs/transactions-crud-backend-followup.md`
- `PRD_APP_IMPROVEMENT.md`
- `react-migration-stage-2.md`

### Operasional tetapi tidak boleh mengalahkan freeze package

Dokumen di bawah tetap hidup sebagai backlog atau log kerja, tetapi harus tunduk pada freeze package ini:

- `docs/unified-crud-workspace-plan-2026-04-18.md`
- `docs/progress/unified-crud-workspace-progress-log.md`
- `docs/ai-workflow/*`

## Aturan pemakaian sesudah freeze

1. Jika ada konflik antara dokumen lama dan `docs/freeze/*`, pakai `docs/freeze/*`.
2. Jika ada konflik antara repo reality dan dokumen freeze, cek repo reality dulu lalu revisi freeze secara eksplisit; jangan diam-diam mengikuti asumsi lama.
3. Jika ada brief baru, identifikasi dulu domain target di `docs/freeze/03-source-of-truth-contract-map.md` dan lifecycle-nya di `docs/freeze/04-lifecycle-matrix.md`.
4. `Riwayat` berarti completed/history surface; deleted recovery memakai `Recycle Bin` yang terpisah.
5. `Halaman Absensi` existing adalah workspace input absensi harian. `Catatan Absensi` adalah halaman baru untuk histori, filter, dan rekap; payroll payable `Tagihan Upah` dikelola lewat payroll/payment surfaces dan tidak menjadi row `Jurnal` / `Riwayat`.
6. `Payment Receipt PDF` adalah supporting capability awal dari `Pembayaran`, bukan source of truth.
