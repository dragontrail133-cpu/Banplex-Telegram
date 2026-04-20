# PRD Core Feature Release

Plan date: `2026-04-18`  
Repository: `Banplex Greenfield`  
Status: `active`  
Supersedes untuk scope release inti: `PRD_APP_IMPROVEMENT.md`

## 1. Ringkasan Eksekutif

Target dokumen ini adalah menggeser fokus pengembangan ke `core feature release` yang benar-benar bisa dipakai operasional harian di Telegram Mini Web App.

Release inti dinyatakan berhasil bila `Owner`/`Admin` dapat menjalankan alur berikut tanpa SQL manual atau workaround eksternal:

1. input pemasukan murni
2. pengeluaran
3. pinjaman
4. faktur material / surat jalan
5. master data
6. absensi
7. tagihan gaji
8. CRUD, soft delete, permanent delete, attachment, payment, laporan, dan PDF yang terkait langsung dengan domain di atas

Fitur lain tetap boleh berjalan paralel, tetapi tidak boleh mengganggu penyelesaian jalur inti ini.

## 2. Realitas Repo Saat Ini

### Yang sudah nyata di repo

1. Aplikasi aktif sudah berbasis `React + Zustand + Supabase + Vercel Functions`; dokumen lama yang membahas `Hybrid Vanilla-React`, `Dexie`, atau jalur `js/*` bukan lagi source of truth produk aktif.
2. Route create/edit inti untuk `project-income`, `expense`, `loan`, `material invoice`, `attendance`, `payment`, `master`, `HRD`, dan `beneficiary` sudah ada.
3. Schema relasional dan RLS sudah luas: `project_incomes`, `expenses`, `expense_line_items`, `bills`, `bill_payments`, `loans`, `loan_payments`, `attendance_records`, `file_assets`, `expense_attachments`, `pdf_settings`, dan domain HRD.
4. Recycle bin, attachment pipeline, payment page, dan detail transaksi sudah punya fondasi nyata dan bukan lagi sekadar rencana.

### Yang belum release-safe

1. Source of truth lintas `route -> store -> API -> table/view` masih belum ditulis tegas sebagai kontrak release per domain.
2. Permanent delete belum seragam dan masih berat di leaf record.
3. Reporting operasional lintas domain dan PDF bisnis user-facing belum selesai.
4. Backlog aktif sebelum dokumen ini terlalu fokus ke form shell/UI, bukan ke blocker data + lifecycle inti.
5. `README.md` dan `PRD_APP_IMPROVEMENT.md` tidak lagi merepresentasikan kondisi repo serta prioritas produk sekarang.

## 3. Tujuan Produk

1. Menjadikan aplikasi bisa dipakai sebagai workspace operasional harian untuk transaksi dan administrasi inti.
2. Mengunci tabel relasional final sebagai source of truth fitur inti.
3. Menyamakan lifecycle `create`, `edit`, `delete`, `restore`, `pay`, `attach`, `report`, dan `export PDF`.
4. Menjaga UX `mobile-first` meski data master, ledger, dan laporan terus membesar.
5. Menyelesaikan jalur inti terlebih dahulu agar fitur lain bisa menyusul tanpa merusak fondasi.

## 4. Non-Goals untuk Gelombang Ini

1. Polish visual besar yang tidak langsung menutup blocker operasi inti.
2. Refactor global yang tidak diperlukan untuk core release.
3. Modul chat/comment/activity log terpisah dari Telegram.
4. Perluasan HRD/beneficiary yang tidak memengaruhi jalur core release finansial-operasional.

## 5. Persona dan Kebutuhan Kerja

| Persona | Kebutuhan utama | Dampak ke release |
| --- | --- | --- |
| `Owner` | Melihat kesehatan operasi, laporan, PDF, dan kontrol delete sensitif | Butuh report, PDF, permanent delete policy, dan audit trail yang jelas |
| `Admin` | Menjalankan create/edit/delete/pay, memulihkan data, mengelola master | Butuh CRUD stabil, recycle bin, attachment, payment, dan master guard |
| `Operator` | Input data cepat dan aman dari mobile | Butuh form mobile-safe, searchable picker, dan alur tidak ambigu |

## 6. Scope Release Inti

| Feature | Output release minimal | Maturity repo saat audit | Anchor backlog |
| --- | --- | --- | --- |
| `Input Pemasukan (Murni)` | create/edit/delete/restore pemasukan proyek, fee bill child terlihat, dan mutasi masuk ke ledger/report | `usable` dengan follow-up | `UCW-79` |
| `Pengeluaran` | expense umum lengkap dengan bill/payment/attachment lifecycle | `usable` dengan hardening | `UCW-80` |
| `Faktur / Surat Jalan` | invoice material dan delivery order aman untuk CRUD + line items + konversi | `usable parsial` | `UCW-81` |
| `Pinjaman` | create/edit/delete/pay sinkron dengan aturan tunggakan operasional | `usable` dengan hardening | `UCW-82` |
| `Absensi` | sheet harian, edit/delete/restore, dan link ke salary bill aman | `usable` | `UCW-83` |
| `Tagihan Gaji` | bundling absensi jadi bill, detail bill, payment, dan visibility di report | `usable parsial` | `UCW-83` |
| `Master Data` | CRUD lengkap, searchable picker, usage guard, recycle bin, boundary delete eksplisit | `usable` | `UCW-84` |
| `Soft Delete + Permanent Delete` | delete matrix lintas domain yang tidak ambigu | `parsial` | `UCW-85` |
| `Attachment` | attachment seragam untuk transaksi inti dan bukti bayar | `parsial` | `UCW-86` |
| `Laporan` | laporan operasional lintas domain dari source relasional final | `parsial` | `UCW-87` |
| `PDF` | minimal satu PDF bisnis profesional yang bisa diunduh + `pdf_settings` | `belum user-facing` | `UCW-88` |
| `Mobile First + Scalable Data` | list besar, picker master, ledger, dan report tetap usable di mobile | `parsial` | `UCW-89` |

## 7. Aturan Operasional Produk

### 7.1 Source of truth

1. Jalur create utama tidak boleh kembali bergantung pada tabel legacy secara diam-diam.
2. Untuk release ini, source of truth harus ditulis tegas per fitur: route, store, API, tabel/view.
3. `transactions` hanya boleh dipakai bila perannya sudah dijelaskan sebagai compatibility/read layer, bukan jalur create yang ambigu.

### 7.2 CRUD dan child collection

1. Parent record harus menunjukkan child record yang relevan: `bill`, `bill_payments`, `loan_payments`, `expense_line_items`, `attachments`, atau `salary bill`.
2. Detail page tidak boleh menyembunyikan child lifecycle yang memengaruhi operasi bisnis.
3. Parent dan child tidak boleh punya aturan delete/restore yang saling bertentangan.

### 7.3 Delete policy

1. `Soft delete` menjadi default untuk semua domain inti.
2. `Permanent delete` hanya boleh dibuka bila guard parent-child dan audit trail-nya jelas.
3. Bila delete butuh `void/reverse`, itu harus diperlakukan berbeda dari hard delete dan ditulis eksplisit di kontrak fitur.

### 7.4 Attachment policy

1. File bisnis harus lewat `file_assets` + relation table, bukan URL bebas.
2. Upload gagal tidak boleh meninggalkan orphan asset.
3. Hak lihat/tambah/hapus attachment harus mengikuti role matrix yang eksplisit.

### 7.5 Reporting dan PDF

1. Laporan operasional harus membaca data relasional final atau SQL view final, bukan agregasi ad-hoc yang berbeda dari payment/ledger.
2. PDF notifikasi Telegram dan PDF bisnis user-facing harus dibedakan boundary-nya.
3. `pdf_settings` tidak dianggap selesai hanya karena tabelnya ada; harus ada jalur UI atau keputusan defer yang tertulis.

### 7.6 Mobile-first dan scalable data

1. Semua flow inti diasumsikan dipakai di layar mobile lebih dulu.
2. Searchable picker wajib dipertahankan untuk master data yang berpotensi besar.
3. Ledger, recycle bin, dan report harus dipikirkan untuk data yang terus bertambah, bukan hanya sample dataset kecil.

### 7.7 Model operasional `bill`, `expense hutang`, dan partial payment

**Temuan repo saat ini**

1. `useBillStore.fetchUnpaidBills()` sudah memuat daftar bill `unpaid` dan `partial`, lalu dashboard sudah menampilkannya sebagai beban yang perlu dibayar.
2. `PaymentPage` sudah bertindak sebagai workspace pembayaran untuk bill dan loan, termasuk histori pembayaran dan aksi `edit` / `hapus`.
3. Yang belum dibakukan di produk adalah permukaan UI daftar tagihan, aksi `Bayar` langsung dari daftar, dan policy resmi untuk partial payment vs delete history.

**Keputusan produk yang dipakai untuk release inti**

1. `expense.status = unpaid / hutang` wajib menghasilkan child `bill` yang langsung masuk ke daftar tagihan aktif.
2. Surface tagihan harus dipisah tegas dari ledger kas:
   - `ledger` untuk mutasi kas nyata,
   - `daftar tagihan` untuk kewajiban yang belum lunas,
   - `PaymentPage` untuk histori dan aksi pembayaran per bill.
3. Dari daftar tagihan, aksi minimum per row adalah:
   - `Buka Detail`
   - `Bayar`
   - `Lihat Riwayat`
   - `Arsipkan/Hapus` sesuai role dan state
4. Tombol `Bayar` tidak memakai modal generik; ia harus membuka `PaymentPage` dengan bill terpilih agar histori, partial payment, dan edit/hapus payment tetap berada di satu workspace yang konsisten.
5. Partial payment adalah flow resmi, bukan edge case:
   - bill berpindah `unpaid -> partial -> paid`
   - setiap payment adalah child record audit
   - `remaining amount` dihitung ulang server-side setelah setiap perubahan
6. Untuk release inti, histori payment boleh `edit` dan `hapus` lewat soft delete child record, lalu parent bill dihitung ulang.
7. `Permanent delete` payment hanya boleh dari recycle bin. Model `void/reversal` tetap dicatat sebagai follow-up terpisah, bukan blocker release pertama.
8. Jika parent bill di-soft-delete, histori payment child ikut diarsipkan sebagai satu tree. Restore parent wajib memulihkan tree yang sama.

### 7.8 Jurnal absensi, CRUD absensi, dan rekap menjadi tagihan gaji

**Temuan repo saat ini**

1. `AttendanceForm` sudah menjadi jurnal harian berbasis `tanggal + proyek`, punya pencarian worker, bulk apply status, dan salin dari hari sebelumnya.
2. `PayrollManager` sudah mengelompokkan absensi `unbilled` per worker lalu membentuk salary bill lewat `fn_generate_salary_bill`.
3. `api/records.js` sudah memblokir delete absensi bila `billing_status = billed` atau `salary_bill_id` sudah ada.

**Keputusan produk yang dipakai untuk release inti**

1. Jurnal absensi harian adalah write surface utama untuk absensi, bukan detail page satuan.
2. CRUD absensi berlaku penuh hanya selama record masih `unbilled`.
3. Setelah direkap menjadi salary bill, record absensi berubah menjadi `read-only` dari jurnal harian.
4. Koreksi absensi yang sudah `billed` tidak dilakukan dengan edit diam-diam pada row attendance:
   - jika salary bill belum punya pembayaran, admin boleh menjalankan aksi `batalkan rekap gaji` agar row kembali `unbilled`
   - jika salary bill sudah punya payment, payment harus dibatalkan / diarsipkan dulu sebelum rekap bisa dibuka ulang
5. Rekap salary bill minimal harus menampilkan preview:
   - worker
   - rentang tanggal
   - jumlah row absensi
   - total upah
   - status salary bill setelah dibuat
6. Salary bill masuk ke lifecycle bill yang sama: daftar tagihan, payment history, delete/restore, dan laporan.
7. Detail attendance tetap dibutuhkan, tetapi fungsinya lebih ke audit dan navigasi ke salary bill, bukan editor utama.

### 7.9 Ledger besar, pencarian, pagination, dan akurasi dashboard

**Temuan repo saat ini**

1. `TransactionsPage` masih memakai filter client-side atas `workspaceTransactions` yang sudah dimuat penuh.
2. `SmartList` baru menangani progressive reveal di sisi UI, belum pagination server-side.
3. `useDashboardStore` masih menghitung summary dari array `cashMutations` di client.

**Keputusan produk yang dipakai untuk release inti**

1. Ledger besar tidak boleh lagi mengandalkan load-full-array ke client.
2. Query ledger harus pindah ke server-side dengan parameter minimum:
   - `cursor`
   - `limit`
   - `search`
   - `type/source`
   - `status`
   - `date_from` / `date_to`
   - filter entitas seperti `project`, `supplier`, `worker`, `creditor`
3. Strategi pagination default adalah `cursor/keyset pagination`, bukan `offset`, agar performa tetap stabil ketika halaman makin dalam.
4. Dashboard summary tidak boleh dihitung dari data halaman ledger yang sedang dimuat; summary harus dibaca dari query agregat/server read model yang terpisah.
5. View SQL seperti `vw_cash_mutation`, `vw_transaction_summary`, `vw_billing_stats`, dan `vw_project_financial_summary` menjadi kandidat utama read model, dengan indeks pada kolom filter/join/RLS yang sering dipakai.
6. Pencarian spesifik di ledger harus berjalan server-side. Jika `ILIKE` + index belum cukup saat volume tumbuh, follow-up boleh memakai `pg_trgm` atau strategi search yang setara.
7. Target UX untuk dataset besar:
   - default membuka data terbaru
   - filter cepat tetap ringan
   - pencarian spesifik tidak memaksa user memuat ribuan row dulu
   - total dashboard tetap akurat walau ledger hanya memuat satu halaman

### 7.10 Multi-user CRUD, role matrix, dan conflict handling

**Temuan repo saat ini**

1. RLS dan team membership sudah ada di schema (`team_members`, role `Owner/Admin/Logistik/Payroll/Administrasi/Viewer`).
2. `ProtectedRoute` dan `useAuthStore` sudah mengenali role workspace.
3. Belum ada policy produk tertulis untuk conflict edit antar-user, ownership display, dan refresh consistency setelah banyak user bekerja bersamaan.

**Keputusan produk yang dipakai untuk release inti**

| Area | Keputusan produk |
| --- | --- |
| `otorisasi` | `Owner` dan `Admin` memegang full operational CRUD + restore; permanent delete dibatasi ke role tinggi; role domain seperti `Payroll` hanya mengakses area payroll/attendance/payment yang relevan |
| `concurrency` | Release inti memakai `optimistic concurrency`, bukan hard lock UI; request update/delete harus memeriksa `updated_at` versi terakhir yang dilihat user |
| `conflict` | Jika record berubah sejak dibuka user, server mengembalikan conflict yang memaksa reload dan menampilkan snapshot terbaru |
| `ownership` | Detail dan list prioritas harus menampilkan `created_by` / actor snapshot yang relevan agar tim bisa tahu siapa penginput terakhir |
| `refresh` | Setelah create/edit/delete/restore/pay berhasil, store wajib refetch source data server; realtime live-sync bisa menyusul, tetapi bukan blocker release inti |
| `audit` | Perubahan destruktif tidak boleh sunyi; minimal harus ada timestamp dan actor yang bisa ditelusuri dari row atau child history |

**Role matrix operasional minimum untuk release inti**

| Role | Scope minimum |
| --- | --- |
| `Owner` | full CRUD, restore, permanent delete yang diizinkan produk, pengaturan PDF, dan keputusan override saat conflict |
| `Admin` | full operational CRUD lintas domain inti, restore, dan recycle-bin management; permanent delete hanya pada flow yang memang disetujui produk |
| `Payroll` | absensi harian, rekap salary bill, pembayaran salary bill, dan akses baca ke detail yang relevan |
| `Logistik` | master material/supplier terkait logistik, expense/invoice operasional, dan attachment yang relevan; tanpa permanent delete finansial |
| `Administrasi` | input dan koreksi operasional administratif yang disetujui role matrix final, tetapi tanpa akses destructive tertinggi |
| `Viewer` | baca saja |

## 8. Urutan Delivery yang Disetujui

### Phase A - Reset source of truth

- `UCW-77`: audit repo menyeluruh, reprioritasi backlog, terbitkan PRD baru
- `UCW-78`: kunci matriks source of truth release lintas fitur inti

**Exit criteria**

1. Tidak ada ambiguitas route/store/API/table untuk fitur inti.
2. Backlog aktif sudah fokus ke core release, bukan polish non-blocker.

### Phase B - Kunci keputusan produk detail sebelum implementasi

- `UCW-91`: audit lanjutan dan dokumentasi keputusan bill, absensi, ledger besar, dan multi-user CRUD
- `UCW-92`: finalisasi model operasional bill dari expense hutang sampai daftar tagihan
- `UCW-93`: finalisasi policy partial payment dan histori payment
- `UCW-94`: finalisasi jurnal absensi CRUD dan bundling salary bill
- `UCW-95`: finalisasi strategi pagination, search, dan akurasi dashboard
- `UCW-96`: finalisasi multi-user CRUD, role matrix, dan conflict handling

**Exit criteria**

1. Tidak ada pertanyaan produk besar yang tersisa untuk bill, absensi, payment history, ledger besar, atau multi-user sebelum coding dimulai.
2. Backlog implementasi sudah terpecah menjadi slice yang benar-benar bisa dikerjakan tanpa menebak policy bisnis di tengah jalan.

### Phase C - Hardening domain operasional

- `UCW-79`: pemasukan murni
- `UCW-80`: expense umum
- `UCW-81`: material invoice / surat jalan
- `UCW-82`: loan dan loan payments
- `UCW-83`: attendance dan salary bill
- `UCW-84`: master data

**Exit criteria**

1. Semua domain inti punya flow create/edit/delete/restore/pay yang jelas.
2. Child collection yang penting terlihat dan sinkron.

### Phase D - Cross-cutting release layer

- `UCW-85`: soft delete / restore / permanent delete lintas domain
- `UCW-86`: attachment platform lintas domain
- `UCW-87`: laporan operasional
- `UCW-88`: PDF bisnis + `pdf_settings`
- `UCW-89`: mobile-first + scalable data hardening

**Exit criteria**

1. Delete boundary tidak ambigu.
2. Attachment dan payment proof konsisten.
3. Ada laporan operasional inti dan minimal satu PDF bisnis yang bisa dipakai.
4. Dataset yang membesar tetap usable dari mobile.

### Phase E - Release audit

- `UCW-90`: audit release readiness core feature end-to-end

**Exit criteria**

1. Dokumen plan, progress log, dan PRD sinkron.
2. Setiap fitur inti punya jalur create/edit/delete/pay/report yang sudah diaudit.
3. Sisa scope di luar release inti tertulis jelas sebagai follow-up.

## 9. Acceptance Criteria Release

Release inti dianggap siap bila seluruh poin berikut terpenuhi:

1. `Input pemasukan`, `pengeluaran`, `pinjaman`, `faktur/surat_jalan`, `master data`, `absensi`, dan `tagihan gaji` bisa dijalankan dari UI utama tanpa kontrak data yang ambigu.
2. Soft delete, restore, dan permanent delete punya aturan tertulis dan UI yang sesuai untuk tiap domain inti.
3. Attachment dan payment proof tidak meninggalkan orphan asset serta bisa dilihat kembali dari flow operasional.
4. Laporan operasional membaca source data final yang sama dengan ledger/payment.
5. Minimal satu PDF bisnis bisa dihasilkan dari aplikasi dan tampak profesional.
6. Penggunaan mobile-first tetap layak ketika jumlah record master, ledger, dan report meningkat.
7. Expense berstatus `hutang` otomatis muncul di daftar tagihan dengan aksi `Bayar` yang jelas.
8. Partial payment punya UI khusus yang stabil, histori payment bisa dikelola, dan recalculation parent bill tetap akurat.
9. Attendance journal, rekap salary bill, dan koreksi record `billed` mengikuti policy yang sama di UI, API, dan recycle bin.
10. Multi-user update tidak saling menimpa diam-diam; conflict handling dan ownership terlihat jelas.

## 10. Risiko Utama

1. Jika fokus kembali bergeser ke polish UI terlalu cepat, backlog akan mengulang pola lama: tampilan maju, lifecycle data tertinggal.
2. Permanent delete yang dibuka tanpa matriks parent-child final berisiko merusak audit trail.
3. Reporting dan PDF bisa menjadi mahal untuk direvisi bila source of truth belum dikunci lebih dulu.
4. Tidak adanya test runner otomatis berarti audit manual, lint, dan build akan tetap menjadi gerbang penting untuk setiap task.
5. Jika ledger tetap client-heavy, pencarian dan dashboard akan melambat tidak proporsional saat data mencapai ribuan row.
6. Jika multi-user CRUD tidak punya conflict policy, koreksi data bisa saling menimpa tanpa jejak yang jelas.

## 11. Keputusan Handoff Setelah Core Release

Setelah `UCW-90` lolos, backlog yang boleh dibuka kembali sebagai follow-up antara lain:

1. `UCW-54` sampai `UCW-63` untuk standardisasi shell/UI form lanjutan
2. polish visual yang lebih agresif
3. fitur tambahan non-core yang tidak masuk release inti pertama
