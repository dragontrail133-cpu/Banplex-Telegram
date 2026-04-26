# Production Readiness Hardening Backlog - 2026-04-25

## 1. Stream Boundary

- Stream: `Production Readiness Hardening`
- Source plan: `docs/production-readiness-hardening-plan-2026-04-25.md`
- Progress log: `docs/progress/production-readiness-hardening-progress-log.md`
- Task prefix: `PRH-*`
- Catatan penting: backlog ini terpisah dari `UCW`; nomor `UCW-411` sudah dipakai backlog lain dan tidak boleh ditimpa.

Boundary tetap:

- Read-only live audit adalah default.
- Tidak ada migration, DDL, DML, deploy, atau repair database tanpa approval eksplisit.
- Mobile Telegram Mini Web App tetap canonical.
- Cleanup/polish baru boleh dikerjakan setelah security dan integrity gate stabil.

## 2. Level Model

| Level | Nama | Tujuan | Gate sebelum lanjut |
| --- | --- | --- | --- |
| `L0` | Baseline | Mengunci evidence dan peta truth | Plan + progress log terbit, baseline audit referensi jelas |
| `L1` | Security/Guard | Mengunci auth, RLS, storage, cron, dan service boundary | Tidak ada ambiguity pada guard jalur sensitif |
| `L2` | Integrity/Schema | Menutup orphan, drift, dan mismatch data contract | Anomali data utama sudah dipetakan dan diklasifikasikan |
| `L3` | Server/State | Menstabilkan mutation, error handling, refresh, dan idempotency | State UI tidak menutupi error server |
| `L4` | Cleanup/Polish | Membersihkan legacy dan merapikan UX | Hanya dilakukan setelah P0-P2 aman |

## 3. Micro-task Backlog

| ID | Fokus | Scope utama | Definition of done | Validasi minimum |
| --- | --- | --- | --- | --- |
| `PRH-L0-01` | Baseline audit matrix | Peta `route -> store -> API/server -> schema/view` untuk domain inti | Ada matriks truth yang bisa dipakai sebagai sumber audit berikutnya | Review dokumen + `rg` mapping |
| `PRH-L1-01` | Auth and guard audit | `ProtectedRoute`, capability contract, `assertTeamAccess`, `assertCapabilityAccess`, auth bootstrap, cron auth | Semua guard sensitif punya boundary yang jelas antara UI dan server | Audit read-only + lint/build bila ada patch |
| `PRH-L1-02` | RLS, view, storage audit | Supabase policies, views, bucket policy, service-role exposure | Policy gap, insecure view, dan storage listing exposure terdokumentasi atau ditutup | Read-only advisor + schema review |
| `PRH-L1-03` | Env and secret audit | `SUPABASE_*`, `CRON_SECRET`, publishable key usage, logging | Tidak ada secret sensitif yang bocor ke client, URL, atau log | Read-only config audit |
| `PRH-L2-01` | Delete/restore integrity | Recycle bin, soft delete tree, permanent delete tree, restore path | Parent-child delete tree tidak meninggalkan orphan dan state restore konsisten | E2E smoke recycle bin + data audit |
| `PRH-L2-02` | Settlement integrity | Bill/payment/loan/attendance payroll reconciliation | Status settlement dan child payment kembali konsisten ke source-of-truth final | Unit/helper test + target smoke |
| `PRH-L2-03` | Attachment/report/stock integrity | Attachment lifecycle, report views, stock movement, PDF settings | Tidak ada orphan asset, report drift, atau stock mismatch yang lolos | Unit/helper test + audit read-only |
| `PRH-L2-04` | Migration drift triage | Local vs remote migration classification | Setiap drift diklasifikasikan sebelum ada repair atau apply apa pun | `list_migrations` + file review |
| `PRH-L2-05` | Advisor remediation list | Unindexed FK, auth_rls_initplan, public bucket, leaked-password protection | Advisor warning dipetakan ke action item atau exception yang eksplisit | Advisor read-only + docs update |
| `PRH-L3-01` | Mutation error hardening | API mutation response, row-count verification, idempotency | Gagal mutation tidak diam dan tidak dianggap sukses | Lint/build + targeted API test |
| `PRH-L3-02` | Store state hardening | Zustand loading/error/refresh behavior | UI state tetap sinkron dengan server state setelah mutation | Lint/build + targeted smoke |
| `PRH-L3-03` | Destructive action guard | Delete, permanent delete, retention cron, batch mutation | Aksi destruktif punya guard dan feedback yang eksplisit | Smoke + review response contract |
| `PRH-L4-01` | Legacy cleanup | Surface legacy inert, dead code, dan compatibility-only artifacts | Cleanup tidak mengubah contract data atau write path final | Lint/build + smoke relevan |
| `PRH-L4-02` | Final polish | UI polish minor setelah hardening aman | Polishing tidak mengubah source-of-truth atau guard | Lint/build + visual smoke |

## 4. Recommended Order

1. `PRH-L0-01`
2. `PRH-L1-01`
3. `PRH-L1-02`
4. `PRH-L1-03`
5. `PRH-L2-01`
6. `PRH-L2-02`
7. `PRH-L2-03`
8. `PRH-L2-04`
9. `PRH-L2-05`
10. `PRH-L3-01`
11. `PRH-L3-02`
12. `PRH-L3-03`
13. `PRH-L4-01`
14. `PRH-L4-02`

## 5. Validation Rules

- Docs-only tasks: path review, `rg`, and consistency check cukup.
- Audit/read-only tasks: Supabase MCP read-only + advisor check wajib.
- Runtime hardening tasks: `npm run lint`, `npm run build`, lalu smoke Playwright yang relevan.
- Live write smoke tidak boleh dipakai sebagai default; itu hanya untuk task yang memang membutuhkan approval eksplisit.

## 6. Definition of Done For The Stream

Stream produksi dianggap siap lanjut ke eksekusi kalau:

- audit matrix dan backlog micro-task terbit,
- security advisor warning sudah dipetakan ke aksi atau exception yang eksplisit,
- migration drift sudah diklasifikasikan,
- integrity gap utama untuk delete/restore/payment/stock/attachment/report sudah jelas,
- dan task runtime pertama bisa dieksekusi tanpa keputusan tambahan dari implementer.
