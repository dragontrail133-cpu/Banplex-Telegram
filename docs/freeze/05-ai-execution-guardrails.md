# AI Execution Guardrails

Freeze date: `2026-04-19`
Runtime reconciliation: `2026-04-23`

## 1. Global rules for AI implementation

1. `docs/freeze/*` adalah planning authority utama untuk task berikutnya.
2. Repo reality tetap wajib dicek sebelum edit, tetapi keputusan produk harus mengikuti freeze package ini.
3. Domain inti memakai pola `read direct or server read model`, lalu `write API/RPC only`.
4. AI tidak boleh membuat tabel, view, status, source, atau lifecycle baru tanpa acuan langsung dari contract map.
5. Satu task implementasi harus sempit, terverifikasi, dan menyebut domain source of truth secara eksplisit.
6. Jika task menyentuh domain settlement, delete tree, atau stock, validasi manual review wajib disebutkan.
7. AI tidak boleh menggabungkan `Riwayat` dan `Recycle Bin` sebagai satu konsep.
8. `Halaman Absensi` existing harus diperlakukan sebagai surface input absensi harian; `Catatan Absensi` adalah halaman baru untuk histori, filter, dan rekap; payroll payable yang masuk `Jurnal` adalah `Tagihan Upah` per worker.
9. `Payment Receipt PDF` hanya output turunan dari `Pembayaran`, bukan source of truth.
10. Dokumen barang diperlakukan sebagai inbound-stock contract untuk core release; stock-out otomatis dari dokumen barang adalah asumsi yang salah, dan stock-out manual yang aktif saat ini hanya boundary terbatas di `Stok Barang`.
11. Route-level code splitting frontend sudah aktif di `src/App.jsx`; jangan menulis brief yang mengembalikan page utama ke static import atau menganggap lazy route belum menjadi baseline runtime.
12. `Referensi` / `Master` adalah core-release fondasional untuk semua form inti; boundary implementasi yang masih transitional tidak mengubah status domain ini sebagai release inti.
13. Task yang menyentuh `api/telegram-assistant.js` harus mempertahankan urutan runtime: deterministic intent gate -> Gemini/xAI writer untuk balasan natural-language -> backend verifier fact packet -> xAI fallback/deterministic fallback; model boleh menulis respons user-facing, tetapi hanya dari fakta yang sudah diverifikasi backend dan tidak boleh mengarang angka, nama, atau aksi baru.
14. Surface command bot, inline callback, dan teks bebas untuk `Telegram assistant` wajib memakai planner, verifier, dan read boundary yang sama; command/inline tidak boleh membuka jalur mutasi atau source of truth baru.

## 2. What AI must never assume

- `transactions` boleh dipakai sebagai write path baru.
- Dashboard boleh menjadi write workspace utama.
- Browser adalah mode resmi utama.
- `Surat Jalan Barang` adalah dokumen inbound-stock, bukan stock-out otomatis.
- `Faktur Barang` tidak boleh diperlakukan sebagai stok keluar otomatis; ia tetap dokumen finansial yang juga dapat mencatat stok masuk.
- `Halaman Absensi` existing sama dengan `Catatan Absensi`.
- `Catatan Absensi` boleh diperlakukan sebagai row utama `Jurnal` finance.
- Rekap payroll hanya punya satu mode bundling generik.
- Worker bukan parent operasional payroll.
- `Tagihan Upah` tidak boleh muncul di `Jurnal` atau `Riwayat`.
- `Riwayat` sama dengan `Recycle Bin`.
- setiap `Pengeluaran` wajib selalu punya `Tagihan`.
- Jangan menganggap `Stok Barang` masih planned-only atau belum punya route aktif; route `/stock` sudah aktif dan manual stock-out tetap dibatasi.
- manual stock-out di `Stok Barang` boleh dijadikan adjustment bebas atau pattern umum baru untuk domain lain.
- `Referensi` / `Master` boleh diperlakukan sebagai supporting module.
- route-level code splitting frontend harus dipertahankan; jangan balik ke static import page utama.
- Hapus payment berarti hard delete yang menghilangkan histori.
- `Payment Receipt PDF` adalah source of truth atau full PDF suite inti.
- `pdf_settings` adalah boundary konfigurasi PDF bisnis yang berbeda dari `Payment Receipt PDF`; jangan mencampur konfigurasi report dengan receipt settlement.
- `telegram_assistant_sessions` boleh menyimpan memory ringkas dalam bentuk summary, last turn, last route, entity hints, dan hybrid transcript pendek; ia bukan transcript panjang atau state bisnis baru.
- `Telegram assistant` hanya read-only finance core; jangan memperluasnya menjadi chatbot umum, mutasi, atau kanal support bebas.
- Dokumen lama atau brief chat lama boleh mengalahkan freeze package.
- Supporting module seperti `HRD` atau `Penerima Manfaat` boleh dijadikan blocker core release tanpa keputusan baru.

## 3. Source-of-truth instruction pattern

Setiap brief implementasi setelah freeze harus minimal menyebut:

- `Domain target`
- `User-facing module name`
- `Read source of truth`
- `Write boundary`
- `Parent-child tree`
- `Lifecycle rule yang paling relevan`
- `File scope in`
- `File scope out`
- `Validasi minimum`

Format minimum yang direkomendasikan:

```text
Domain:
Read source of truth:
Write boundary:
Parent-child tree:
Lifecycle rule:
Files allowed:
Files forbidden:
Validation:
```

## 4. File boundary discipline

- Jika task `frontend-only`, jangan sentuh backend, schema, migration, atau API.
- Jika task `backend-only`, jangan sentuh UI.
- Jika task menyentuh `Pembayaran`, `Tagihan`, kalkulasi pinjaman, atau lifecycle delete, jangan campur dengan cleanup visual.
- Jika task `docs-only`, jangan menyentuh kode.
- Jika task menyentuh `Dokumen Barang`, cek juga dampak `stock_transactions` dan jangan improvisasi adjustment manual.
- Jika task menyentuh `Riwayat` atau `Recycle Bin`, jangan blur history vs recovery; cek parent-child restore tree lebih dulu.

## 5. Legacy docs/files that must not be used as primary task source

Dokumen historis yang tidak boleh jadi authority utama:

- `docs/hand-off/app-flow-core-feature-architecture-audit.md`
- `docs/prd-core-feature-release-2026-04-18.md`
- `docs/prd/banplex-prd-master.md`
- `docs/prd/product-requirements-and-planning-handoff.md`
- `docs/ui-ux-planning-blueprint.md`
- `docs/integration-readiness-plan-2026-04-17.md`
- `PRD_APP_IMPROVEMENT.md`
- `react-migration-stage-2.md`

Surface code legacy yang tidak boleh dijadikan target task baru tanpa verifikasi ulang:

- `src/pages/HomePage.jsx`
- `src/components/PaymentModal.jsx`
- `src/components/TransactionForm.jsx`
- `src/store/useAppStore.js`
- jalur historis `submitTransaction` yang sudah dihapus dari `src/store/useTransactionStore.js`
- narasi direct insert payment lama di `src/store/usePaymentStore.js`

## 6. How to write future micro-task prompts

Aturan prompt future task:

1. pilih satu domain kecil,
2. sebut source of truth domain,
3. sebut file boundary secara ketat,
4. sebut validation minimum,
5. sebut risiko parent-child jika ada,
6. jangan mencampur docs freeze dengan implementasi tanpa alasan.

Template singkat:

```text
Tujuan:
Domain:
Source of truth:
Write boundary:
Allowed files:
Forbidden files:
Validation:
Output:
```

## 7. Required output format for future implementation tasks

Output minimal setiap task implementasi:

1. ringkasan perubahan,
2. daftar file berubah,
3. alasan perubahan,
4. risiko atau regresi potensial,
5. hasil validasi atau alasan tidak dijalankan,
6. source of truth domain yang dipakai,
7. follow-up jika ada.

Jika task menyentuh domain inti, output wajib menyebut:

- parent entity,
- child or settlement entity,
- apakah lifecycle lock berubah atau tidak.

## 8. Risk areas that require manual review

- `Pembayaran` dan core calculation logic,
- `Tagihan` dengan child payment history,
- `Dana Masuk / Pinjaman` dengan bunga, tenor, dan penalti,
- `Catatan Absensi`, `Tagihan Upah`, dan pembatalan payroll,
- `Dokumen Barang` dengan stock movement,
- delete/restore tree lintas parent-child,
- pemisahan semantik `Riwayat` vs `Recycle Bin`,
- perubahan schema, trigger, view, RLS, atau migration,
- concurrency dan optimistic locking pada domain sensitif.

## 9. Domain-specific danger zones

| Domain | Danger zone utama |
| --- | --- |
| `Pemasukan Proyek` | child fee `Tagihan` bisa membuat parent terlihat editable padahal sudah locked |
| `Pengeluaran` | `Tagihan` child hanya muncul saat payable masih hidup; jangan paksa universal bill creation untuk direct-paid expense |
| `Dokumen Barang` | inbound stock, conversion `Surat Jalan Barang -> Faktur Barang`, dan risiko double-count stok masuk |
| `Dana Masuk / Pinjaman` | formula repayment, late charge, dan snapshot terms |
| `Tagihan` | bill list jangan berubah menjadi authoring parent baru |
| `Pembayaran` | runtime create path sudah API-owned; task baru tidak boleh mengembalikan direct Supabase insert; `Payment Receipt PDF` tetap turunan, bukan source of truth |
| `Halaman Absensi` | surface input absensi harian existing; jangan disamakan dengan `Catatan Absensi` |
| `Catatan Absensi` | halaman baru untuk histori absensi, filter per bulan, filter per worker, dan aksi rekap; jangan dipaksa menjadi row ledger finance |
| `Tagihan Upah` | payroll payable hasil rekap per worker boleh tampil di `Jurnal`/`Riwayat`, tetapi koreksi setelah payment history sangat sensitif |
| `Attachment` | orphan asset, role matrix, dan relation tree |
| `Reports` | agregasi client-side bisa drift dari truth relasional |
| `Stok Barang` | negative stock, manual stock-out terbatas yang sudah aktif, dan risiko adjustment liar |
| `Telegram assistant` | context summary terlalu panjang, fallback order provider tertukar, response bebas model, dan scope read-only melebar ke mutasi |

## 10. Recommended implementation order

1. pastikan brief implementasi berikut mengutip `docs/freeze/03-source-of-truth-contract-map.md`,
2. jaga `Pembayaran` tetap API-owned dan jangan reintroduce direct insert Supabase,
3. audit dan rapikan sisa jalur write baru ke `transactions` agar tidak dipakai lagi,
4. pastikan `Dashboard` dan `Jurnal` membaca read model server yang konsisten,
5. harden `Pengeluaran` dan `Tagihan` sebagai tree parent-child,
6. harden `Dokumen Barang` dan safeguard stock movement,
7. harden `Dana Masuk / Pinjaman`,
8. koreksi docs lalu harden `Halaman Absensi`, `Catatan Absensi`, dan `Tagihan Upah`,
9. finalkan report inti,
10. harden `Stok Barang` sebagai route supporting aktif tanpa mengubahnya menjadi adjustment domain yang liar.
11. perlakukan `Referensi` / `Master` sebagai fondasi semua form inti saat menyusun task boundary atau capability gate berikutnya.

## Prinsip penutup

- AI wajib treat freeze package ini sebagai primary planning authority.
- AI wajib menyebut source of truth domain dalam brief dan hasil task.
- AI tidak boleh menyentuh `Pembayaran` atau logic kalkulasi inti tanpa task khusus yang eksplisit.
- AI tidak boleh menjadikan backlog atau docs lama yang liar sebagai acuan utama.
