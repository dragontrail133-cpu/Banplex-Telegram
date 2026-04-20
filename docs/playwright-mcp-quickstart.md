# Playwright MCP Quickstart (Codex)

Dokumen ini menjelaskan cara memakai **Playwright MCP** untuk automation browser UI dari Codex CLI.

## Apakah perlu install skill?

Tidak. Jika sesi Codex Anda sudah menyediakan tool `mcp__playwright__*`, maka Playwright MCP sudah siap dipakai tanpa install skill tambahan.

Skill seperti `vercel:agent-browser` bisa membantu workflow verifikasi, tapi bukan syarat untuk memakai Playwright MCP.

## Cara pakai (pola kerja)

1. **Jalankan web app** Anda lebih dulu (di terminal biasa, bukan via tool command Codex).
   - Vite dev: `npm.cmd run dev -- --host 127.0.0.1 --port 5173`
   - Atau serve build: `npm.cmd run build` lalu `node scripts/serve-dist.mjs`
2. Minta Codex melakukan automation dengan Playwright MCP ke URL tersebut, misalnya `http://127.0.0.1:5173`.

Catatan: Di environment tool eksekusi Codex, proses background yang di-start dari command tool bisa dihentikan saat command selesai, jadi yang paling stabil adalah menyalakan dev server dari terminal Anda sendiri.

## Smoke test cepat (tanpa server)

Untuk memastikan Playwright MCP berfungsi, Anda bisa pakai file `scripts/playwright-mcp-smoke.html` dan minta Codex:

- membuka file tersebut via `file:///.../scripts/playwright-mcp-smoke.html`
- klik tombol, isi input, cek teks hasil.

