# PRD — Banplex Greenfield

Freeze date: `2026-04-19`
Runtime reconciliation: `2026-04-23`
Status: `official concise master PRD`

## 1. Overview

Banplex Greenfield adalah `Telegram Mini Web` untuk operator tim yang perlu mencatat operasi harian secara mobile-first. Produk ini berfokus pada `Dashboard` sebagai overview cepat dan `Jurnal` sebagai workspace aktif utama untuk finance dan settlement, sambil menjaga `Halaman Absensi` sebagai surface input absensi harian dan `Catatan Absensi` sebagai halaman payroll untuk histori, filter, dan rekap. `Telegram assistant` berperan sebagai helper read-only finance core di Telegram: ia membaca source of truth yang sudah ada, memahami campuran Indonesia/Sunda, menyediakan command step-by-step `/menu /tambah /buka /cari /status /riwayat /analytics` plus inline keyboard read-only, menyimpan hybrid transcript pendek untuk continuation, lalu memakai AI writer untuk merangkai balasan natural-language yang tetap tervalidasi backend sebelum dikirim. `Tagihan Upah` adalah derived payable payroll hasil rekap per worker yang boleh muncul di `Jurnal` dan `Riwayat`, sedangkan deleted recovery tetap berjalan lewat `Recycle Bin` yang terpisah.

## 2. Requirements

| Area | Requirement resmi |
| --- | --- |
| Platform | mode resmi adalah `Telegram Mini Web`; browser bukan mode resmi utama |
| User | role utama: `Owner`, `Admin`, `Administrasi`, `Logistik`, `Payroll`, `Viewer` |
| Workspace | semua data inti terikat ke `team_id` dan access control workspace |
| Main workspace | `Jurnal` menjadi workspace aktif utama untuk finance/settlement; `Dashboard` hanya overview; `Halaman Absensi` dan `Catatan Absensi` tetap terpisah dari ledger |
| Payroll surface | `Halaman Absensi` = input harian, `Catatan Absensi` = histori/filter/rekap, `Tagihan Upah` = derived payable payroll per worker |
| Telegram assistant | helper read-only finance core; mixed Indonesia/Sunda; command + inline read-only; hybrid transcript pendek; AI writer natural-language tervalidasi backend; tanpa mutasi atau free-form write action |
| History semantics | `Riwayat` = completed/history surface; deleted recovery memakai `Recycle Bin` terpisah |
| Data contract | domain inti memakai source of truth relasional final, bukan brief lama atau tabel legacy campuran |
| Boundary | domain inti memakai `read direct/read model server` dan `write API/RPC only` |
| Integrity | parent-child lifecycle, payment, restore, dan history harus konsisten |
| Supporting output | `Payment Receipt PDF` adalah capability awal resmi dari flow `Pembayaran`, regenerate-able, dan bukan source of truth |
| Supporting config | `pdf_settings` adalah boundary konfigurasi PDF bisnis user-facing; ia terpisah dari `Payment Receipt PDF` dan tidak menjadi source of truth settlement |
| Mobile-first | form routed, list ringan, searchable picker, dan aman di Telegram mobile |

## 3. Core Features

- `Dashboard` untuk saldo, kewajiban aktif, quick launch, dan recent subset.
- `Jurnal` untuk record aktif lintas domain inti.
- `Pemasukan Proyek`.
- `Pengeluaran`.
- `Dokumen Barang` yang mencakup `Faktur Barang` dan `Surat Jalan Barang`.
- `Dana Masuk / Pinjaman`.
- `Tagihan`.
- `Pembayaran`.
- `Halaman Absensi` sebagai workspace input absensi harian.
- `Catatan Absensi` sebagai halaman histori absensi, filter, dan rekap payroll.
- `Tagihan Upah` sebagai derived payable payroll per worker.
- `Referensi` sebagai master/reference core release yang menjadi fondasi semua form inti.
- `Riwayat`.
- `Recycle Bin`.
- `Tim` sebagai capability support/admin.
- `Telegram assistant` sebagai helper read-only finance core yang merespons lewat AI writer natural-language tervalidasi backend, command/inline resmi, dan deep link workspace resmi.

## 4. User Flow

1. User membuka Mini App dari Telegram dan lolos bootstrap `/api/auth`.
2. User mendarat di `Dashboard` untuk overview cepat.
3. User masuk ke `Jurnal` untuk melihat record aktif finance/settlement dan membuka detail.
4. User create/edit record melalui routed form domain.
5. Jika record punya kewajiban settlement, user bergerak ke `Tagihan` lalu `Pembayaran`.
6. Untuk payroll, user menulis absensi harian di `Halaman Absensi`, membuka `Catatan Absensi` untuk histori/filter dan rekap, lalu menyelesaikan `Tagihan Upah` per worker di flow pembayaran.
7. Record completed ditelusuri dari `Riwayat`, sedangkan deleted recovery berjalan lewat `Recycle Bin`.

## 5. Architecture

- Frontend: `Vite + React + react-router-dom + Zustand`.
- Routing saat ini sudah memakai route-level code splitting di `src/App.jsx` melalui `React.lazy()` / dynamic import; warning chunk Vite `> 500 kB` bukan lagi baseline runtime.
- `Referensi` / `Master` adalah jantung logika bisnis app ini; secara product scope ia termasuk core release walau boundary runtime untuk beberapa store masih transitional.
- Styling: `Tailwind + CSS variables + Telegram theme fallback`.
- Backend: Vercel serverless functions di `api/`.
- Database: Supabase PostgreSQL relasional dengan RLS, views, trigger, RPC, dan storage.
- Official pattern: core domain read via server read model or direct query terkontrol, write via API/RPC.

## 6. Data Model / Database Schema

| Domain | Source of truth utama |
| --- | --- |
| Workspace | `teams`, `team_members`, `profiles`, `invite_tokens` |
| Finance | `project_incomes`, `expenses`, `bills`, `bill_payments`, `loans`, `loan_payments` |
| Dokumen Barang | `expenses`, `expense_line_items`, `stock_transactions` |
| Payroll | `attendance_records`, `workers`, generated `bills` untuk `Tagihan Upah` per worker |
| Reference | `projects`, `suppliers`, `expense_categories`, `funding_creditors`, `materials`, `workers`, `staff`, `professions` |
| Files | `file_assets`, `expense_attachments` |
| Reports | `/api/transactions?view=summary`, `vw_cash_mutation`, `vw_project_financial_summary`, dengan `vw_transaction_summary` tinggal compatibility view legacy |

## 7. Design & Technical Constraints

- `Dashboard` tetap ringkas dan read-only.
- `Jurnal` tetap menjadi workspace utama untuk finance/settlement, bukan dashboard.
- `Halaman Absensi` existing bukan `Catatan Absensi`; ia khusus input absensi harian.
- `Catatan Absensi` adalah halaman baru untuk histori, filter per bulan, filter per worker, dan aksi rekap.
- Rekap payroll harus mendukung mode per hari multi-worker dan mode per worker date-range.
- Worker adalah parent operasional payroll; `Tagihan Upah` adalah hasil rekap per worker.
- `Tagihan Upah` boleh muncul di `Jurnal` dan `Riwayat`, dan row payroll di ledger harus terbaca per worker.
- `Riwayat` adalah completed/history surface dan dipisah dari `Recycle Bin`.
- Dashboard summary aktif dibaca dari `/api/transactions?view=summary`; `vw_transaction_summary` masih boleh hidup sebagai compatibility/report layer, tetapi bukan authority utama.
- `transactions` adalah compatibility layer legacy, bukan target flow baru.
- `Pembayaran` pada runtime saat ini sudah memakai wrapper API di `src/store/usePaymentStore.js`; direct insert store adalah wording historis, bukan baseline aktif.
- `Tagihan` memegang status settlement `unpaid / partial / paid` hanya ketika parent memang masih memiliki kewajiban pembayaran hidup; status tersebut tidak mengubah identitas domain parent.
- cancellation payment adalah soft-delete log, bukan hard delete.
- `Surat Jalan Barang` dan `Faktur Barang` sama-sama dapat mencatat stok masuk; `Faktur Barang` tetap menggerakkan nilai finansial.
- `Stok Barang` adalah supporting module dengan route aktif `/stock` untuk monitoring stok dan manual stock-out terbatas; ia bukan workspace otomatis dari dokumen barang pada fase inti.
- `Referensi` / `Master` adalah domain fondasional yang dipakai semua form inti; boundary implementasinya boleh transitional sementara, tetapi status produknya tetap core release.
- `Payment Receipt PDF` adalah output turunan dari settlement resmi, bukan source of truth.
- AI tidak boleh membuat source data baru di luar contract map freeze.

## 8. Supporting / Planned Modules

- `Stok Barang`: supporting/non-core, route aktif `/stock`, read/monitoring first, dan saat ini sudah membuka manual stock-out terbatas.
- `HRD`: supporting module, bukan gate release inti.
- `Penerima Manfaat`: supporting module, bukan gate release inti.
- `Payment Receipt PDF`: supporting capability resmi fase awal dari `Pembayaran` atau detail terkait, boleh diregenerate, bukan full PDF suite, dan bukan source of truth.
- Telegram notification dan PDF bot: side effect support surface, bukan source of truth.
- `Referensi` / `Master`: core release, bukan supporting module; ia fondasi form inti meski beberapa boundary runtime masih transitional.

## 9. Release Scope

Release inti menekankan:

- CRUD domain inti,
- payment dan partial payment,
- `Payment Receipt PDF` sederhana sebagai supporting capability resmi flow `Pembayaran`,
- kalkulasi dan status settlement yang konsisten,
- master/reference yang dipakai form inti,
- `Referensi` / `Master` sebagai fondasi logika bisnis core release untuk seluruh form inti,
- data integrity, delete/restore tree, dan history,
- `Tim` sebagai capability support/admin,
- mode resmi `Telegram Mini Web`.

`HRD`, `Penerima Manfaat`, dan `Stok Barang` tidak memblokir release inti; `Stok Barang` tetap supporting/non-core walau route monitoring dan manual stock-out terbatas sudah aktif.

## 10. Anti-Scope

- browser-first mode resmi,
- refactor besar tanpa kebutuhan kontrak domain,
- full accounting / reversal engine penuh,
- full business PDF suite pada fase awal,
- stock-out otomatis dari `Surat Jalan Barang` atau `Faktur Barang`,
- penyamaan semantik `Riwayat` dengan `Recycle Bin`,
- penggunaan `archive manual` sebagai konsep umum yang menggantikan lifecycle domain,
- brief lama liar sebagai sumber utama,
- task baru yang menambah write path ke `transactions` atau bypass API pada domain inti.
