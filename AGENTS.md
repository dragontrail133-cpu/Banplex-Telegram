# AGENTS.md (Aturan Permanen Codex untuk Repo Ini)

## Ringkasan Proyek
Proyek ini adalah Telegram Mini Web App (operator dashboard) berbasis React yang terintegrasi dengan Telegram WebApp SDK dan Supabase.

Fakta repo yang terverifikasi:
- Frontend: Vite + React + react-router-dom, state via Zustand.
- Styling: Tailwind + CSS variables di `src/index.css` (kelas komponen `app-*`), dengan fallback ke tema Telegram (`--tg-theme-*`).
- Backend: Vercel Serverless Functions di `api/` dan migrasi/schema Supabase di `supabase/migrations/`.
- Repo aktif dikembangkan: perubahan harus ketat, terukur, dan bisa diaudit.

Tujuan file ini:
- Membuat workflow Codex CLI konsisten, hemat context/token.
- Membatasi scope agar tidak terjadi regresi atau scope creep.
- Memaksa validasi minimum dan laporan audit tiap task.

---

## Fase Delivery Aktif
Per `2026-04-17`, fase aktif repo ini adalah **Integration Readiness** untuk menutup gap integrasi app sebelum masuk ke:

1. `UI Polish Optimization`
2. `AQ`
3. `QC`
4. `Production`

Prioritas eksekusi saat ini:
1. Selaraskan source of truth data final antara UI, store, API, dan schema Supabase.
2. Tutup gap flow inti: create, edit, bayar, lampiran, reporting, dan restore data.
3. Setelah gate integrasi lolos, baru lanjutkan polish visual besar dan quality stage.

Implikasi wajib untuk agent:
1. Jika task menyentuh `Dashboard`, `Transactions`, `EditRecordPage`, `PaymentPage`, store transaksi/laporan, `api/auth`, atau migration Supabase, anggap task sebagai **integration-critical** sampai terbukti sebaliknya.
2. Untuk task **integration-critical**, wajib cek kesesuaian antara route UI, store, dan tabel/view Supabase yang menjadi source of truth.
3. Jangan memulai polish visual besar saat flow create/edit/pay/report utama masih bercampur antara model legacy dan model relasional, kecuali user meminta polish-only secara eksplisit.

---

## Safety Gate Project (Wajib)
1. Jika user menyatakan `proposal-only`, `read-only`, `audit-only`, atau `tanpa implementasi`, agent wajib berhenti di dokumen/proposal dan dilarang patch runtime code.
2. Sebelum edit, sebutkan file target dan pastikan scope sesuai instruksi user.
3. Jika worktree sudah dirty, jangan revert atau menormalkan perubahan lain; abaikan perubahan di luar scope dan laporkan bila relevan.
4. Untuk task yang meminta diff, tampilkan diff hanya untuk file scope task, kecuali user meminta status repo penuh.
5. Dilarang menjalankan command destruktif atau state-changing tanpa approval eksplisit, termasuk command database, deploy, reset, repair, rename massal, atau install dependency.
6. Jika `git` menolak karena `safe.directory`, boleh gunakan override per-command `git -c safe.directory="C:/Project/Banplex Greenfield" ...`; jangan menulis config global kecuali user meminta.

---

## Source-of-Truth Rules (Wajib)
1. Gunakan `docs/architecture-source-of-truth-audit-2026-04-24.md` sebagai baseline audit source-of-truth terbaru sampai ada dokumen pengganti.
2. Untuk flow integration-critical, identifikasi dan tulis sumber final data: route UI, Zustand store, API/client wrapper, Vercel function, RPC/view/table Supabase.
3. Jangan membuat kalkulasi duplikat di UI/store jika sudah ada canonical view, RPC, trigger, atau API wrapper.
4. Jika source-of-truth masih `mixed`, `direct client`, atau `unknown`, jangan ubah kontrak sebelum ada proposal kecil dan approval user.
5. Reporting dan dashboard harus dicek terhadap canonical reporting views sebelum mengubah total, saldo, paid amount, remaining amount, atau status.
6. Payment, stock, attendance recap, restore, dan soft-delete harus dianggap high-risk karena menyentuh derived state, trigger/RPC, atau child records.

---

## Supabase Migration Restrictions (Wajib)
1. Dilarang menjalankan `supabase db push`, `supabase db reset`, `supabase migration up`, `supabase migration repair`, `supabase db pull`, `apply_migration`, atau SQL DDL/DML tanpa approval eksplisit user.
2. Dilarang rename, hapus, squash, atau membuat migration baru tanpa mandat eksplisit.
3. Jika audit migration drift diminta, lakukan read-only compare saja: local filenames, MCP `list_migrations`, schema object check, dan dokumentasi mapping.
4. Untuk drift local-only vs remote-only, klasifikasikan dulu sebagai `timestamp-equivalent`, `already-applied-out-of-band`, `truly-pending`, atau `obsolete`.
5. `migration repair` hanya boleh diusulkan, bukan dijalankan, kecuali user memberi approval eksplisit setelah mapping dan risiko tertulis.
6. Jangan mark migration sebagai applied jika object/column/index/function/view yang dimaksud belum terbukti ada di remote schema.
7. Jangan apply migration yang berisi backfill/data mutation tanpa backup plan, expected row count, stop condition, dan rollback plan.
8. Jika menyentuh RLS, storage policy, auth, trigger, function, atau view, wajib review security impact dan gunakan `security_invoker=true` untuk public views bila relevan.

---

## Aturan Umum (Wajib)
1. Selalu **baca struktur file** dan konteks lokal sebelum edit.
2. Selalu jaga scope sempit: **1 task = 1 tujuan kecil**.
3. Dilarang scope creep: jangan menambah pekerjaan di luar instruksi user.
4. Dilarang refactor liar: jangan ubah struktur besar tanpa diminta.
5. Dilarang mengubah file di luar area task.
6. Dilarang menambah dependency tanpa instruksi eksplisit.
7. Pisahkan domain kerja:
   - Jika task **frontend-only**: dilarang ubah backend, schema, RLS, atau kontrak API.
   - Jika task **backend-only**: dilarang ubah UI/komponen.
8. Dilarang mengubah kontrak API/state global kecuali task memang khusus kontrak.
9. Dilarang melakukan sweeping styling/global rename tanpa mandat khusus.

---

## Prinsip Workflow (Micro-Task)
1. Satu task = satu tujuan kecil yang dapat diverifikasi.
2. Satu task = area file terbatas (sebutkan daftar file target sejak awal).
3. Wajib ada validasi yang relevan dengan scope (lihat bagian Validasi).
4. Wajib ada laporan hasil yang bisa diaudit (lihat Output Wajib).

---

## Dokumen Kerja Wajib untuk Stream Multi-Brief
Jika user membuka stream kerja yang berlanjut lintas banyak brief, wajib ada:

1. **Dokumen planning + micro-task** yang menjadi source of truth backlog.
2. **Dokumen progress log** yang mencatat hasil audit tiap task.

Untuk stream CRUD workspace yang sedang aktif, dokumen wajibnya adalah:

- `docs/unified-crud-workspace-plan-2026-04-18.md`
- `docs/progress/unified-crud-workspace-progress-log.md`

Aturan wajib:

1. Sebelum melanjutkan brief lanjutan pada stream yang sama, audit dulu dokumen planning aktif.
2. Jika brief baru belum tercakup, tambahkan sebagai micro-task baru.
3. Jika brief baru berbenturan dengan task yang sudah ada, revisi task yang terdampak sebelum planning/implementasi lanjut.
4. Jangan lanjut implementasi task berikutnya jika progress log dan status audit task sebelumnya belum diperbarui.

---

## Standar Eksekusi Default
Urutan wajib:
1. **Baca dulu**: file yang relevan, cari pola existing, identifikasi risiko.
2. **Rencana singkat** (3-6 langkah, hanya yang akan dikerjakan).
3. **Edit minimal**: perubahan sekecil mungkin untuk mencapai tujuan.
4. **Preserve style**: ikuti pola, naming, dan struktur existing repo.
5. Hindari rename/pemindahan file kecuali diminta eksplisit.

Tambahan wajib untuk stream multi-brief:
6. Setelah satu task selesai, lakukan audit hasil task terhadap definition of done dan validasi minimum.
7. Jangan lanjut ke task berikutnya sampai task aktif berstatus `validated`, `deferred`, atau `blocked` dengan alasan tertulis.
8. Setelah audit, update progress log stream yang relevan sebelum menutup task.

---

## Aturan Validasi
Validasi harus proporsional terhadap scope:
- Jika **docs-only**: cukup validasi ringan (misal cek path, konsistensi isi). Jangan build berat.
- Jika menyentuh **UI/komponen**: jalankan validasi minimal yang relevan bila tersedia.
  - Perubahan UI kecil yang hanya menyentuh copy, spacing, warna, ikon, atau susunan elemen di route yang sudah ada cukup dengan `npm run lint` dan, bila relevan, `npm run build`.
  - Playwright tidak wajib untuk perubahan UI kecil selama tidak mengubah route, navigation, state/data flow, role gating, atau interaksi lintas-halaman.
  - Jika perubahan UI menyentuh alur navigasi, form submit, fetch/mutation, atau behavior integration-critical, jalankan smoke Playwright yang relevan bila tersedia.
- Jika menyentuh **logic/state**: jalankan test/lint/build yang paling dekat dengan area tersebut bila tersedia.
- Jika task **integration-critical**: minimal validasi harus memastikan route, store, dan source data final konsisten. Untuk perubahan kode UI/store, default validasi adalah `npm run lint` dan `npm run build` bila memungkinkan.

Catatan:
- Jangan menginstal package atau mengubah lockfile untuk sekadar validasi kecuali diminta.
- Jika validasi tidak bisa dijalankan, tulis alasannya di laporan akhir.
- Untuk stream multi-brief, validasi task juga harus mencakup audit status task di dokumen planning/progress, bukan hanya hasil command.

---

## Output Wajib Setiap Task
Setiap task harus ditutup dengan output berisi:
1. Ringkasan perubahan (1-3 kalimat).
2. Daftar file berubah.
3. Alasan perubahan (kenapa perlu).
4. Risiko/regresi potensial (apa yang bisa rusak).
5. Hasil validasi (perintah yang dijalankan, atau alasan tidak dijalankan).
6. Catatan follow-up (opsional, jika ada).

---

## Aturan Khusus Anti-Regresi
1. Jangan sentuh file yang tidak dibutuhkan.
2. Jangan campur cleanup dengan feature work.
3. Jangan ubah naming/pattern global tanpa instruksi.
4. Jangan buat abstraksi baru jika tidak dibutuhkan oleh task.
5. Jangan mengubah `public API` internal komponen/util tanpa alasan kuat dan tanpa update semua pemakai.
6. Untuk task UI, jangan menambahkan artefak placeholder, ringkasan perubahan, atau panel pengantar yang hanya menjelaskan perubahan di layar; jelaskan konteks perubahan di respon chat saja.
7. Untuk UI baru atau UI yang diubah, jangan sisipkan intro copy, badge penjelasan perubahan, atau panel placeholder yang tidak dibutuhkan oleh fungsi layar.
8. Untuk perubahan UI apa pun, jangan inisiatif menambahkan `title`, deskripsi, copy text, intro, placeholder, atau artefak visual tambahan tanpa mandat eksplisit; ringkasan perubahan hanya ditulis di respon chat, bukan di UI.

---

## Template Task Ideal (Untuk User)
Gunakan template ini saat memberi instruksi:

**Tujuan**
- (1 kalimat) Apa hasil akhir yang diinginkan.

**Scope File**
- File yang boleh diubah: `path/to/fileA`, `path/to/fileB`
- File yang dilarang disentuh: (sebutkan jika ada)

**Aturan Tambahan**
- (contoh) UI-driven: dilarang konek DB, dilarang ubah store.
- (contoh) Dilarang tambah dependency.

**Validasi Wajib**
- (contoh) Jalankan `npm run build` atau lint ringan, atau sebutkan jika tidak perlu.

**Output Wajib**
- Ringkasan, file berubah, risiko, hasil validasi.

---

## Checklist Sebelum Selesai (Untuk Agent)
- Scope file sesuai instruksi user.
- Tidak ada perubahan tambahan di luar task.
- Tidak ada dependency/lockfile berubah tanpa izin.
- Tidak ada perubahan kontrak API tanpa mandat.
- Untuk task integration-critical: source of truth final sudah dicek dan tidak ambigu.
- Styling mengikuti design tokens yang ditentukan.
- Validasi relevan sudah dijalankan atau diberi alasan.
- Laporan akhir lengkap (ringkasan, file, alasan, risiko, validasi).
- Jika task bagian dari stream multi-brief: dokumen planning sudah diaudit, status task sudah diperbarui, dan progress log sudah di-update.

---

## Checklist Audit Reviewer (Untuk Reviewer)
- Apakah perubahan hanya menyentuh file yang discope?
- Apakah ada tanda scope creep/refactor liar?
- Apakah perubahan konsisten dengan pola repo?
- Apakah ada perubahan kontrak/state global yang tidak diminta?
- Apakah risiko/regresi sudah disebutkan dan masuk akal?
- Apakah validasi relevan dilakukan?
