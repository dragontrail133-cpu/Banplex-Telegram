# Command Map (Validasi Repo-First)

Dokumen ini memetakan command yang benar-benar tersedia di repo, kapan dipakai, dan mana yang harus dihindari untuk task kecil.

---

## Package Manager
Terverifikasi dari repo:
- Menggunakan npm (`package-lock.json` ada).

Catatan:
- Jangan install dependency pada task docs/workflow.
- Jangan ubah `package.json`/lockfile kecuali task eksplisit.

---

## Script yang Tersedia (package.json)
- `npm run dev` : menjalankan Vite dev server
- `npm run build` : build produksi (Vite build)
- `npm run preview` : preview hasil build
- `npm run lint` : lint seluruh repo (ESLint flat config)

Tidak tersedia:
- `npm test`
- `npm run typecheck`

---

## Kapan Memakai Command

### Docs-only (docs/ai-workflow/*)
Minimum:
- Tidak wajib menjalankan command.
Rekomendasi:
- Self-review: konsistensi antar dokumen + cek path yang dirujuk.

### UI-only (src/pages, src/components, src/index.css)
Minimum:
- `npm run lint`
Opsional (gunakan jika perubahan berisiko):
- `npm run build` jika menyentuh routing core, CSS global, atau Tailwind config.

### Backend-only (api/*)
Minimum:
- `npm run lint`
Catatan:
- Repo tidak menyediakan test runner. Manual test endpoint harus dijelaskan oleh task.

### Schema/DB (supabase/migrations/*)
Minimum:
- Tidak ada command aman yang bisa dijalankan tanpa environment DB.
Catatan:
- Jangan apply migrasi tanpa task eksplisit dan lingkungan yang disepakati.

---

## Command yang Sebaiknya Tidak Dijalankan untuk Task Kecil
- `npm run build` untuk task docs-only atau perubahan UI yang sangat lokal, kecuali ada indikasi bundling/routing/style global terdampak.
- Menjalankan dev server untuk sekadar mengubah dokumen workflow.

