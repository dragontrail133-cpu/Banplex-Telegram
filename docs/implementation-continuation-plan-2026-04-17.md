# Implementation Continuation Plan

Plan date: 2026-04-17
Repository: `Banplex Greenfield`
Scope: lanjutan implementasi core feature yang masih gap terhadap `system-audit-schema-migration-plan-2026-04-10.md`

## Tujuan

Dokumen ini dibuat untuk melanjutkan implementasi fitur inti yang masih belum selesai atau belum konsisten di aplikasi baru `React + Supabase`.

Dokumen ini secara sengaja **menghapus poin notifikasi/chat/log in-app** dari prioritas lanjutan karena arahan terbaru menetapkan bahwa kebutuhan tersebut sudah dianggap tercakup lewat Telegram in-app.

## Prinsip Eksekusi

- Dahulukan perbaikan domain data yang menjadi fondasi fitur lain.
- Hindari menambah UI baru sebelum jalur data dan schema sudah konsisten.
- Semua flow baru harus mengikuti model `team_id`, soft delete, dan RLS yang sudah ada.
- Fitur baru harus masuk ke jalur aplikasi utama, bukan hanya tersedia sebagai komponen terpisah.
- Setiap workstream harus berakhir dengan definisi selesai yang bisa diuji dari UI.

## Prioritas Lanjutan

### 1. Konsolidasi domain transaksi utama

#### Masalah saat ini

- Aplikasi masih bercampur antara `transactions` dan tabel domain baru seperti `project_incomes`, `expenses`, `loans`, dan `bill_payments`.
- Quick action `+Pemasukan` masih membuka `TransactionForm`, bukan flow `IncomeForm`.
- Dashboard dan halaman transaksi masih bergantung besar pada `transactions`, sehingga ringkasan kas dan mutasi belum sepenuhnya mencerminkan domain schema final.

#### Target implementasi

- Tentukan `transactions` sebagai:
  - tetap dipertahankan sebagai unified ledger yang sah, atau
  - dihapus dari jalur aplikasi dan digantikan oleh view relasional.
- Samakan quick action, form create, dashboard summary, dan transaction list ke model domain final.
- Pastikan flow berikut konsisten:
  - pemasukan termin proyek -> `project_incomes`
  - pengeluaran operasional/lainnya -> `expenses`
  - faktur material -> `expenses` + `expense_line_items`
  - pinjaman -> `loans`
  - pembayaran -> `bill_payments` atau `loan_payments`

#### Deliverables

- keputusan arsitektur final untuk `transactions`
- dashboard summary yang membaca source of truth final
- halaman transaksi terpadu yang tidak ambigu
- route create/edit yang tidak lagi salah arah

#### Definition of done

- `+Pemasukan`, `+Pengeluaran`, `+Pinjaman`, `+Faktur`, dan `Bayar` semua menulis ke model domain yang benar
- dashboard dan transaction list menampilkan data yang sama dengan tabel domain final
- tidak ada jalur create utama yang masih tergantung pada model lama tanpa justifikasi

#### Keputusan sprint integrasi saat ini

- `transactions` ditetapkan sebagai compatibility layer sementara.
- Jalur create utama wajib pindah ke tabel domain relasional final.
- Dashboard dan transaction list wajib membaca cashflow final dari tabel domain, bukan `transactions`.

### 2. Otomasi fee staf per termin

#### Masalah saat ini

- Rule fee staf sudah ada di master data.
- `IncomeForm` baru menampilkan preview estimasi fee.
- Belum ada pembentukan bill fee otomatis setelah termin proyek dicatat.

#### Target implementasi

- Saat `project_incomes` dibuat, sistem menghitung fee staf yang relevan.
- Fee staf yang valid dibentuk menjadi bill relasional yang bisa ditinjau dan dibayar.
- Pisahkan skenario:
  - `per_termin`
  - `fixed_per_termin`
  - staff bulanan yang tidak masuk potongan termin

#### Deliverables

- fungsi/service pembentuk bill fee staf
- snapshot referensi termin pada bill fee
- tampilan bill fee di dashboard atau halaman pembayaran

#### Definition of done

- setiap termin yang relevan dapat menghasilkan bill fee staf otomatis
- nominal bill fee sama dengan rule yang aktif
- bill fee bisa masuk ke flow pembayaran biasa

### 3. Lampiran transaksi dan pembayaran

#### Masalah saat ini

- Schema relasional untuk file sudah tersedia melalui `file_assets`.
- Lampiran pada flow transaksi inti belum ada di UI baru.
- Payment flow belum mendukung upload bukti bayar.

#### Target implementasi

- Tambahkan upload lampiran untuk:
  - pengeluaran operasional/lainnya
  - faktur material
  - pembayaran bill
  - pembayaran loan bila flow-nya sudah dibuka
- Simpan file ke Supabase Storage melalui `file_assets`.
- Hubungkan file ke entitas relasional yang tepat, bukan URL bebas.

#### Deliverables

- attachment picker/upload di form transaksi
- metadata file relasional
- preview dan hapus lampiran dari UI

#### Definition of done

- user bisa upload file pada transaksi dan pembayaran utama
- file tercatat di `file_assets`
- relasi attachment dapat ditampilkan kembali dari detail data

### 4. Ekspansi laporan, mutasi kas, dan artefak PDF

#### Masalah saat ini

- Laporan proyek baru mencakup `vw_project_financial_summary`.
- `vw_billing_stats`, `vw_cash_mutation`, dan `pdf_settings` belum masuk ke flow aplikasi utama.
- PDF saat ini dominan dipakai untuk notifikasi Telegram, belum sebagai modul laporan user-facing.

#### Target implementasi

- Tambah layar laporan operasional yang mencakup:
  - billing stats
  - cash mutation
  - detail pembiayaan/pinjaman
  - summary proyek dan overhead
- Aktifkan pengaturan PDF berbasis `pdf_settings`.
- Rapikan boundary:
  - laporan operasional untuk dibaca user
  - PDF notifikasi untuk Telegram
  - PDF dokumen/report untuk kebutuhan bisnis

#### Deliverables

- halaman mutasi kas baru
- card atau section billing stats
- UI pengaturan PDF
- minimal satu laporan PDF bisnis yang bisa diunduh dari app

#### Definition of done

- user dapat melihat mutasi kas dari source data final
- user dapat mengubah pengaturan PDF dari UI
- minimal satu laporan PDF bisnis terbentuk dari data relasional final

### 5. Penyempurnaan modul HRD dan beneficiary

#### Masalah saat ini

- CRUD HRD applicant dan beneficiary sudah ada.
- Dokumen file untuk HRD sudah berjalan.
- Fitur impor/ekspor XLSX/CSV/PDF yang tercantum di audit belum ada di app baru.

#### Target implementasi

- Tambahkan import dan export untuk:
  - beneficiary
  - HRD applicants
- Tambahkan validasi dedupe minimal berbasis `nik` bila tersedia.
- Pertimbangkan export ringan dulu sebelum PDF kompleks.

#### Deliverables

- import CSV/XLSX beneficiary
- import CSV/XLSX applicant
- export CSV/XLSX beneficiary
- export CSV/XLSX applicant

#### Definition of done

- user dapat impor batch data beneficiary dan applicant
- user dapat ekspor ulang data yang sudah tersimpan
- data hasil import tetap mengikuti schema final dan soft delete policy

### 6. Recycle bin dan admin tooling ringan

#### Masalah saat ini

- Soft delete sudah dipakai di banyak entitas.
- Belum ada layar recycle bin untuk restore data.
- Belum ada utilitas admin ringan untuk inspeksi data yang orphan atau status yang tidak sinkron.

#### Target implementasi

- Tambahkan recycle bin dasar untuk entitas penting:
  - projects
  - suppliers
  - materials
  - workers
  - expenses
  - bills
  - loans
- Tambahkan admin utilities ringan, bukan toolkit maintenance besar.
- Fokus awal pada restore dan verifikasi integritas sederhana.

#### Deliverables

- halaman recycle bin
- aksi restore untuk entitas prioritas
- panel admin kecil untuk check data orphan atau data without relation

#### Definition of done

- data yang di-soft-delete dapat ditemukan kembali dari UI
- restore berhasil mengembalikan data ke daftar aktif
- utilitas admin dasar tersedia tanpa perlu akses database manual

## Urutan Eksekusi yang Disarankan

### Phase 1 - Foundation

1. Konsolidasi domain transaksi utama
2. Rapikan route create/edit agar mengarah ke form yang benar
3. Validasi ulang dashboard dan transaction list

### Phase 2 - Financial Automation

1. Otomasi fee staf per termin
2. Lampiran transaksi dan pembayaran
3. Rapikan detail bill dan payment flow

### Phase 3 - Reporting Layer

1. Mutasi kas
2. Billing stats
3. PDF settings
4. Minimal satu report export/PDF bisnis

### Phase 4 - Admin and Data Ops

1. Import/export HRD dan beneficiary
2. Recycle bin
3. Admin tooling ringan

## Rekomendasi Sprint Berikutnya

Jika implementasi dilanjutkan bertahap, sprint berikutnya paling efektif difokuskan ke:

1. Menetapkan keputusan final apakah `transactions` tetap dipakai atau digantikan penuh oleh view/domain relasional.
2. Mengubah quick action `+Pemasukan` agar memakai `IncomeForm`, bukan `TransactionForm`.
3. Menyelaraskan dashboard summary dan transaction list ke source of truth final.
4. Menutup gap fee staf otomatis setelah flow pemasukan sudah stabil.

## Out of Scope Dokumen Ini

- Chat/komentar lintas entitas
- notifikasi in-app terpisah dari Telegram in-app
- activity log sebagai modul UI tersendiri

Ketiga area di atas dikeluarkan dari planning lanjutan ini sesuai keputusan terbaru.
