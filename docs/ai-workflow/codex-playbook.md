# Codex Playbook (Repo Banplex Greenfield)

## Tujuan Playbook
Dokumen ini adalah panduan operasional untuk menggunakan Codex CLI di repo ini secara:
- Konsisten (hasil predictable).
- Hemat context/token (minim baca ulang tidak perlu).
- Minim regresi (scope ketat, validasi proporsional, audit jelas).

Aturan permanen yang bersifat lintas-task berada di `AGENTS.md` agar tidak perlu diulang di setiap prompt.

---

## Prinsip Hemat Context/Token
- Selalu sebutkan **tujuan 1 kalimat** + **scope file eksplisit**.
- Hindari prompt panjang yang mencampur banyak tujuan.
- Minta Codex membaca file minimal yang relevan, bukan seluruh repo.
- Ulangi hanya info yang berubah; sisanya refer ke `AGENTS.md`.

---

## Kenapa Aturan Permanen di AGENTS.md
- Menghindari repetisi aturan di tiap task.
- Menjadikan workflow konsisten lintas sesi.
- Membuat audit lebih mudah (satu sumber kebenaran aturan).

---

## Kapan Memakai Mode Plan / Implement / Audit
Gunakan sesuai kebutuhan:
- **Plan mode**: saat scope belum jelas, banyak file kandidat, atau ada risiko regresi tinggi.
- **Implement mode**: saat tujuan dan scope sudah jelas, perubahan kecil dan terukur.
- **Audit mode**: saat ingin review perubahan tanpa menambah scope (cek risiko, edge cases, konsistensi).

Catatan:
- Jika task hanya minta audit, jangan mengedit file.

---

## Cara Memecah Task Besar jadi Micro-Task
Tanda task terlalu besar:
- Menyentuh lebih dari 3-5 file.
- Mengandung beberapa tujuan yang tidak saling tergantung.
- Membutuhkan desain ulang arsitektur.

Strategi pemecahan:
1. Tentukan outcome kecil yang bisa diverifikasi (contoh: `scroll form normal`).
2. Batasi file target (contoh: hanya `src/components/layouts/FormLayout.jsx`).
3. Kerjakan satu perubahan perilaku/visual per task.
4. Validasi minimal, lalu lanjut micro-task berikutnya.

---

## Pola Task: Baik vs Buruk
Baik:
- "Perbaiki sticky footer X di file A, jangan sentuh store, validasi build."
- "Refactor class Tailwind pada komponen B saja, tanpa ubah logic."

Buruk:
- "Rapikan semua UI biar bagus."
- "Sekalian refactor store dan styling global."
- "Update design system seluruh aplikasi dalam satu task."

---

## Kapan Boleh Paralel, Kapan Tidak
Boleh paralel jika:
- Membaca beberapa file untuk konteks (read-only).
- Mengumpulkan daftar pemakaian komponen/prop (search).

Jangan paralel jika:
- Sedang mengedit file yang sama.
- Ada risiko konflik edit atau perlu urutan perubahan.
- Task memerlukan satu sumber kebenaran yang harus ditetapkan dulu.

---

## Cara Mencegah Regresi
- Jangan menyentuh file di luar scope (bahkan untuk "sekalian rapihin").
- Jangan ubah kontrak API/props tanpa task khusus.
- Jangan tambah dependency tanpa mandat.
- Hindari sweeping refactor; pilih perbaikan lokal (leaf component) dulu.
- Tulis risiko/regresi potensial di akhir task.

---

## Ritme Kerja yang Direkomendasikan
1. Plan singkat: tujuan + scope file + larangan + validasi.
2. Implement terbatas: edit minimal sesuai scope.
3. Validasi: jalankan yang relevan (atau jelaskan alasan tidak).
4. Audit: cek file changed, risiko, konsistensi tokens/pola.
5. Lanjut task berikutnya.

---

## Kapan Memulai Sesi Baru vs Melanjutkan Sesi Lama
Mulai sesi baru jika:
- Context sudah panjang dan tidak relevan untuk task berikutnya.
- Berpindah domain (UI ke backend atau sebaliknya).
- Task berikutnya tidak butuh detail diskusi sebelumnya.

Lanjut sesi lama jika:
- Masih satu area file yang sama.
- Ada keputusan desain yang harus konsisten.
- Masih tahap iterasi satu komponen/fitur.

---

## Panduan Khusus Fase UI-Driven
Saat UI-driven:
- Jangan menyentuh DB, schema, RLS, atau integrasi backend.
- Prioritaskan perbaikan surface kecil (komponen leaf, layout lokal).
- Hindari sweeping refactor styling global.
- Jika menyentuh UI: cek mobile-safe layout (scroll, safe-area, sticky CTA).

---

## Anti-Pattern (Wajib Dihindari)
- Mengubah banyak file tanpa diminta.
- Menggabungkan cleanup + feature dalam satu task.
- Menambah dependency untuk masalah kecil.
- Mengubah kontrak API/props "sekalian biar rapi".
- Menghapus code path tanpa verifikasi pemakaian.
- Menjalankan build/test berat untuk task docs-only.
