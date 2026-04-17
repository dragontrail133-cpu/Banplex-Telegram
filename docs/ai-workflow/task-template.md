# Template Prompt (Codex CLI) untuk Repo Ini

Catatan:
- Selalu refer ke `AGENTS.md` (aturan permanen).
- Selalu isi **Scope File** secara eksplisit.
- Jangan gabungkan beberapa tujuan besar dalam satu prompt.

---

## 1) Template PLAN ONLY
**MODE:** PLAN ONLY (Jangan edit file)

**Tujuan**
- [1 kalimat]

**Scope File (Read-Only)**
- Boleh dibaca: [...]
- Dilarang disentuh: [...]

**Larangan**
- Jangan ubah file apa pun.
- Jangan tambah dependency.
- Jangan ubah kontrak API.

**Validasi Wajib**
- Tidak perlu menjalankan build/test.

**Output Wajib**
- Rencana 3-6 langkah.
- Daftar file yang akan disentuh pada implementasi.
- Risiko/regresi potensial.

---

## 2) Template IMPLEMENT MICRO-TASK
**MODE:** IMPLEMENT

**Tujuan**
- [1 kalimat outcome]

**Scope File**
- Boleh diubah: [...]
- Dilarang diubah: [...]

**Larangan**
- Dilarang scope creep.
- Dilarang rename/pindah file kecuali diminta.
- Dilarang tambah dependency.

**Validasi Wajib**
- Jalankan validasi minimal yang relevan atau tulis alasan jika tidak dijalankan.
  - Minimum umum (JS/JSX): `npm run lint`
  - Jika perubahan berpotensi memengaruhi bundling/route/style global: `npm run build`

**Output Wajib**
- Ringkasan perubahan.
- File berubah.
- Alasan perubahan.
- Risiko/regresi.
- Hasil validasi.

---

## 3) Template UI FIX MICRO-TASK
**MODE:** IMPLEMENT (UI-driven)

**Tujuan**
- [contoh: Perbaiki scroll layout form agar bisa di-scroll di mobile]

**Scope File**
- Boleh diubah: [...]
- Dilarang diubah: store, backend, schema, env, config build.

**Larangan**
- Jangan konek DB / fetch real data (gunakan mock jika diminta).
- Jangan ubah kontrak data/state global tanpa task khusus.
- Jangan tambah dependency.

**Validasi Wajib**
- Minimal:
  - `npm run lint`
  - `npm run build` hanya jika perubahan menyentuh routing/layout global, Tailwind config, atau CSS global.

**Output Wajib**
- Ringkasan perubahan.
- File berubah.
- Risiko visual/mobile.
- Hasil validasi.

---

## 4) Template BACKEND MICRO-TASK
**MODE:** IMPLEMENT (Backend-only)

**Tujuan**
- [1 kalimat]

**Scope File**
- Boleh diubah: [...]
- Dilarang diubah: komponen UI, styling, layout.

**Larangan**
- Jangan ubah kontrak API ke frontend tanpa task kontrak khusus.
- Jangan tambah dependency tanpa mandat.

**Validasi Wajib**
- Jalankan validasi minimal yang relevan (atau jelaskan kenapa tidak).
  - Jika mengubah `api/*.js`: `npm run lint` (repo tidak menyediakan script test khusus).
  - Jika mengubah `supabase/migrations/*`: jangan apply schema kecuali task memang meminta (high-risk).

**Output Wajib**
- Ringkasan.
- File berubah.
- Risiko kontrak/data.
- Hasil validasi.

---

## 5) Template AUDIT ONLY
**MODE:** AUDIT ONLY (Jangan edit file)

**Tujuan**
- Audit [komponen/fitur] untuk: bug, regresi, konsistensi token, dan edge cases.

**Scope File (Read-Only)**
- Boleh dibaca: [...]

**Larangan**
- Jangan mengedit file.
- Jangan menjalankan perintah destruktif.

**Validasi Wajib**
- Tidak ada (read-only).

**Output Wajib**
- Temuan berurutan dari yang paling kritis.
- Risiko/regresi yang mungkin.
- Rekomendasi micro-task lanjutan (dengan scope file).

---

## 6) Template REGRESSION CHECK
**MODE:** AUDIT + CHECKLIST

**Tujuan**
- Pastikan perubahan terakhir tidak menyebabkan regresi.

**Scope File**
- Boleh dibaca: file yang berubah + pemakai terdekat.
- Jangan edit file.

**Larangan**
- Jangan "sekalian benerin".

**Validasi Wajib**
- Jalankan validasi yang relevan jika memungkinkan (atau jelaskan kenapa tidak).

**Output Wajib**
- Checklist regresi terisi (refer `docs/ai-workflow/regression-checklist.md`).
- Risiko yang tersisa.

---

## 7) Template DOCS ONLY
**MODE:** IMPLEMENT (Docs-only)

**Tujuan**
- [1 kalimat]

**Scope File**
- Boleh diubah: `docs/...` (sebutkan path spesifik)
- Dilarang diubah: `src/**`, config build, dependency.

**Larangan**
- Jangan ubah kode aplikasi.
- Jangan jalankan build berat.

**Validasi Wajib**
- Minimal: cek konsistensi isi dan path referensi.

**Output Wajib**
- Ringkasan.
- File docs berubah.
- Risiko (biasanya rendah).

---

## 8) Template SAFE REFACTOR KECIL
**MODE:** IMPLEMENT (Small refactor)

**Tujuan**
- Refactor kecil untuk meningkatkan keterbacaan tanpa ubah behavior.

**Scope File**
- Boleh diubah: [...]
- Dilarang diubah: file lain.

**Larangan**
- Jangan ubah output/behavior.
- Jangan ubah naming global.
- Jangan tambah dependency.

**Validasi Wajib**
- Minimal: lint/build ringan atau test terkait (jika ada).

**Output Wajib**
- Ringkasan.
- File berubah.
- Bukti "behavior tetap sama" (argumentasi + validasi).
