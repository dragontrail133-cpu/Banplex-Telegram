# Production Readiness Hardening Plan - 2026-04-25

Plan date: `2026-04-25`  
Repository: `Banplex Greenfield`  
Authority baseline:
- `docs/freeze/00-index.md`
- `docs/freeze/03-source-of-truth-contract-map.md`
- `docs/architecture-source-of-truth-audit-2026-04-24.md`

## 1. Summary

Tujuan plan ini adalah mengunci kesiapan production secara end-to-end: audit state, guard, server, schema, database, data integrity, dan data contract di semua layer frontend/backend.

Prinsip kerja:

1. Audit dulu, harden setelah bukti cukup.
2. Read-only live audit adalah default.
3. Tidak ada migration, DDL, DML, deploy, atau repair database tanpa approval eksplisit.
4. UI polish dan cleanup hanya masuk setelah security dan integrity gate lolos.

Stream ini memakai prefix `PRH-*` agar tidak bentrok dengan backlog `UCW` yang sudah aktif dan sudah memakai nomor task berbeda.

## 2. Current State Snapshot

Audit read-only terbaru menunjukkan repo sudah cukup matang, tetapi belum seragam di semua boundary.

| Area | Current state | Risk |
| --- | --- | --- |
| Source of truth | Core finance/read flows mostly lewat API wrapper dan view final, tetapi Master, HRD/Penerima, File, Team, dan beberapa read path masih direct-client transitional | Boundary write/read belum seragam |
| RLS / security | Semua table `public` yang terlihat sudah RLS-enabled, tetapi `telegram_assistant_sessions` belum punya policy dan `team_members` punya multiple permissive select policies | Policy gap dan perf/security noise |
| Storage | Bucket publik `hrd_documents` masih punya policy listing yang terlalu luas | Exposure metadata lebih besar dari yang dibutuhkan |
| Auth hardening | Leaked-password protection Supabase belum aktif | Security posture belum maksimal |
| Schema drift | Local migrations 43, remote migrations 34 | Drift harus diklasifikasikan sebelum ada repair |
| Performance advisors | Banyak FK belum punya covering index, plus warning `auth_rls_initplan` pada `profiles` dan `invite_tokens` | Potensi latency dan RLS overhead |
| Data integrity | Delete/restore tree, payment settlement, attachment lifecycle, stock movement, attendance/payroll, dan reports adalah area derived-state paling sensitif | Orphan, stale state, dan mismatch contract |

## 3. Hardening Order

### P0 - Security and Contract Lock

- Petakan ulang `route -> store -> API/server -> schema/view` untuk semua domain inti.
- Verifikasi auth/session, capability, service-role boundary, cron auth, dan guard UI/server.
- Kunci source-of-truth final untuk read/write path sensitif agar tidak ada mixed contract yang lolos ke production.

### P1 - Data Integrity and Schema

- Audit delete/restore tree, parent-child settlement, orphan attachment, stock, attendance, payroll, dan recycle bin.
- Klasifikasikan migration drift menjadi `already-applied`, `truly-pending`, atau `obsolete` sebelum ada aksi schema.
- Triage advisor security/performance menjadi backlog yang bisa dieksekusi bertahap.

### P2 - Server and State Hardening

- Normalisasi error shape, loading state, idempotency mutation, row-count verification, dan refresh recovery.
- Pastikan store tidak menutupi gagal mutation atau stale state setelah write sensitif.

### P3 - Polish and Cleanup

- Cleanup legacy surface, dead code, dan affordance UI hanya setelah P0/P1 stabil.
- Hindari refactor besar atau polish visual yang mengubah contract data.

## 4. Production Gates

Plan ini dianggap aman menuju production hanya jika gate berikut terpenuhi:

1. Semua core route punya source-of-truth map yang jelas dan konsisten.
2. Tidak ada security advisor warning yang dibiarkan tanpa keputusan eksplisit.
3. Tidak ada delete/restore/payment/stock/attachment tree yang orphan atau mismatch.
4. Mutation sensitif punya guard server-side dan feedback UI yang tidak menyesatkan.
5. Lint, build, dan smoke test tetap lolos setelah setiap perubahan berarti.
6. Live write smoke hanya dijalankan kalau approval eksplisit sudah ada.

## 5. Explicit Assumptions

- Audit baseline yang dipakai adalah snapshot read-only yang sudah ada di repo, ditambah advisor Supabase read-only.
- Mini Web App Telegram tetap mode canonical; browser/desktop enhancement tidak boleh menggeser contract inti.
- Tidak ada schema mutation di plan ini; schema work dipisah menjadi task tersendiri jika benar-benar diperlukan.
- `UCW-411` tidak dipakai ulang di plan ini karena nomor itu sudah terpakai untuk backlog lain; stream baru memakai `PRH-*`.
- Worktree yang sudah dirty di area lain tetap tidak disentuh.

## 6. Handoff

Implementasi lanjutan harus memecah plan ini menjadi micro-task kecil di:

- `docs/production-readiness-hardening-backlog-2026-04-25.md`
- `docs/progress/production-readiness-hardening-progress-log.md`

Setiap micro-task harus menyebut file target, gate validasi, dan risiko regresi sebelum mulai coding.
