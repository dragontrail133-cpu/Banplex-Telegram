# PRD — Banplex Greenfield

Freeze date: `2026-04-19`  
Status: `official concise master PRD`

## 1. Overview

Banplex Greenfield adalah `Telegram Mini Web` untuk operator tim yang perlu mencatat operasi harian secara mobile-first. Produk ini berfokus pada `Dashboard` sebagai overview cepat dan `Jurnal` sebagai workspace aktif utama untuk finance dan settlement, sambil menjaga `Halaman Absensi` sebagai surface input absensi harian dan `Catatan Absensi` sebagai halaman payroll untuk histori, filter, dan rekap. `Tagihan Upah` adalah derived payable payroll hasil rekap per worker yang boleh muncul di `Jurnal` dan `Riwayat`, sedangkan deleted recovery tetap berjalan lewat `Recycle Bin` yang terpisah.

## 2. Requirements

| Area | Requirement resmi |
| --- | --- |
| Platform | mode resmi adalah `Telegram Mini Web`; browser bukan mode resmi utama |
| User | role utama: `Owner`, `Admin`, `Administrasi`, `Logistik`, `Payroll`, `Viewer` |
| Workspace | semua data inti terikat ke `team_id` dan access control workspace |
| Main workspace | `Jurnal` menjadi workspace aktif utama untuk finance/settlement; `Dashboard` hanya overview; `Halaman Absensi` dan `Catatan Absensi` tetap terpisah dari ledger |
| Payroll surface | `Halaman Absensi` = input harian, `Catatan Absensi` = histori/filter/rekap, `Tagihan Upah` = derived payable payroll per worker |
| History semantics | `Riwayat` = completed/history surface; deleted recovery memakai `Recycle Bin` terpisah |
| Data contract | domain inti memakai source of truth relasional final, bukan brief lama atau tabel legacy campuran |
| Boundary | domain inti memakai `read direct/read model server` dan `write API/RPC only` |
| Integrity | parent-child lifecycle, payment, restore, dan history harus konsisten |
| Supporting output | `Payment Receipt PDF` adalah capability awal resmi dari flow `Pembayaran`, regenerate-able, dan bukan source of truth |
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
- `Referensi`.
- `Riwayat`.
- `Recycle Bin`.
- `Tim` sebagai capability support/admin.

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
| Reports | `vw_transaction_summary`, `vw_cash_mutation`, `vw_project_financial_summary` |

## 7. Design & Technical Constraints

- `Dashboard` tetap ringkas dan read-only.
- `Jurnal` tetap menjadi workspace utama untuk finance/settlement, bukan dashboard.
- `Halaman Absensi` existing bukan `Catatan Absensi`; ia khusus input absensi harian.
- `Catatan Absensi` adalah halaman baru untuk histori, filter per bulan, filter per worker, dan aksi rekap.
- Rekap payroll harus mendukung mode per hari multi-worker dan mode per worker date-range.
- Worker adalah parent operasional payroll; `Tagihan Upah` adalah hasil rekap per worker.
- `Tagihan Upah` boleh muncul di `Jurnal` dan `Riwayat`, dan row payroll di ledger harus terbaca per worker.
- `Riwayat` adalah completed/history surface dan dipisah dari `Recycle Bin`.
- `transactions` adalah compatibility layer legacy, bukan target flow baru.
- `Tagihan` memegang status settlement `unpaid / partial / paid` hanya ketika parent memang masih memiliki kewajiban pembayaran hidup; status tersebut tidak mengubah identitas domain parent.
- cancellation payment adalah soft-delete log, bukan hard delete.
- `Surat Jalan Barang` dan `Faktur Barang` sama-sama dapat mencatat stok masuk; `Faktur Barang` tetap menggerakkan nilai finansial.
- `Stok Barang` adalah planned/supporting module untuk kontrol stok keluar manual, bukan workspace otomatis dari dokumen barang pada fase inti.
- `Payment Receipt PDF` adalah output turunan dari settlement resmi, bukan source of truth.
- AI tidak boleh membuat source data baru di luar contract map freeze.

## 8. Supporting / Planned Modules

- `Stok Barang`: planned/supporting, top-level route sendiri, read/monitoring first, dan nanti menjadi surface manual stock-out.
- `HRD`: supporting module, bukan gate release inti.
- `Penerima Manfaat`: supporting module, bukan gate release inti.
- `Payment Receipt PDF`: supporting capability resmi fase awal dari `Pembayaran` atau detail terkait, boleh diregenerate, bukan full PDF suite, dan bukan source of truth.
- Telegram notification dan PDF bot: side effect support surface, bukan source of truth.

## 9. Release Scope

Release inti menekankan:

- CRUD domain inti,
- payment dan partial payment,
- `Payment Receipt PDF` sederhana sebagai supporting capability resmi flow `Pembayaran`,
- kalkulasi dan status settlement yang konsisten,
- master/reference yang dipakai form inti,
- data integrity, delete/restore tree, dan history,
- `Tim` sebagai capability support/admin,
- mode resmi `Telegram Mini Web`.

`HRD`, `Penerima Manfaat`, dan `Stok Barang` tidak memblokir release inti; `Stok Barang` tetap planned/supporting sampai flow manual stock-out dibuka secara khusus.

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
