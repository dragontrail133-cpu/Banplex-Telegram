# Regression Checklist (Sebelum Task Dianggap Selesai)

Isi checklist ini pada akhir task yang menyentuh kode/UX/flow penting.
Tujuan: memastikan scope tidak melebar dan tidak ada regresi tersembunyi.

---

## 1) Regresi Scope
- [ ] Perubahan hanya pada file yang diizinkan di scope.
- [ ] Tidak ada "sekalian rapihin" di luar tujuan.
- [ ] Tidak ada refactor global yang tidak diminta.

## 2) Regresi File Tak Terkait
- [ ] Tidak ada file lain ikut berubah (cek `git status`).
- [ ] Tidak ada perubahan format besar tanpa alasan (mass reformat).

## 3) Regresi Arsitektur
- [ ] Tidak ada perubahan pola arsitektur (routing/store/data flow) tanpa task khusus.
- [ ] Tidak ada perubahan kontrak internal (props/util) yang tidak di-update pemakainya.

## 4) Regresi Visual/Mobile
- [ ] Layout aman di mobile (scroll berjalan, safe-area terhitung).
- [ ] Sticky CTA tidak menutupi konten penting.
- [ ] Kontras teks sesuai high-contrast dark mode (pakai design tokens).
- [ ] Tidak ada `shadow` jika aturan melarang.

## 5) Regresi Contract/API
- [ ] Tidak ada perubahan payload/response shape tanpa mandat kontrak.
- [ ] Jika ada perubahan kontrak: terdokumentasi dan pemakai di-update.

## 6) Regresi State/Data Flow
- [ ] Tidak ada perubahan state global tanpa kebutuhan task.
- [ ] Side-effect tetap terkontrol (useEffect tidak memicu loop).
- [ ] Error/empty/loading state tidak rusak.

## 7) Regresi Dependency
- [ ] Tidak ada dependency baru.
- [ ] Tidak ada lockfile berubah tanpa izin.

## 8) Regresi Naming/Consistency
- [ ] Naming konsisten dengan repo (tidak ada gaya baru mendadak).
- [ ] Komponen/util mengikuti pola existing, tidak bikin abstraksi baru tanpa kebutuhan.

## 9) Regresi Validasi/Test/Build
- [ ] Validasi yang relevan sudah dijalankan (atau alasan tidak dijalankan ditulis).
- [ ] Tidak ada error obvious pada build/lint terkait scope.

---

## Keputusan Akhir
- [ ] VALID: aman merge / lanjut task berikutnya
- [ ] PERLU REVISI: ada risiko/regresi yang belum dibereskan

Catatan reviewer:
- Temuan:
- Risiko:
- Next micro-task:
