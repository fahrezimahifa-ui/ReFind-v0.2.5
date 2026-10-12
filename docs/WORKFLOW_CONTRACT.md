# Workflow contract — As-built B06, updated v0.2.5

**Status:** kontrak aplikasi berikut telah diimplementasikan melalui B02–B05 dan direverifikasi B06 melalui regression serta fresh-install actual ZIP. Full Lost → Returned, exceptions/concurrency/rollback, private evidence dan pickup cancellation tetap lulus. Final draw.io flowcharts/user/app flows berlabel As-built / B06; evidence: [B06_REPORT.md](B06_REPORT.md). Main operational mock outcomes merupakan synthetic classroom simulations melalui fungsi workflow ini.

## 1. Item states

| Code | Label UI | Cara masuk / batasan |
|---|---|---|
| OPEN | Reported | Valid new report; no current suggestion |
| UNDER_REVIEW | Under review | BM manual review; no claim/confirmed match/handover conflict |
| POTENTIAL_MATCH | Possible match | Rule-based suggestions; bukan verified owner |
| VERIFICATION | Claim review | Pending/needs-more-info claim; no owner assigned |
| HANDOVER | Ready for pickup | One approved claim; optional confirmed Lost pair; handover exists |
| RESOLVED | Returned | Confirmed completion; synchronized pair; terminal read-only |
| UNCLAIMED_CLOSED | Never retrieved | BM archive, no active claim/approved handover; terminal read-only |

Status transition harus divalidasi backend. Manual status UI hanya menawarkan choices eligible. Lost recovery tanpa linked active claim boleh dicatat BM sebagai RESOLVED; Found membutuhkan approved handover sebelum Returned.

## 2. Reports, matching, upload

- Student login → pilih Lost/Found → item/category/location/event date/time → public photos → private clue → optional Lost evidence → validate/save transaction → activity/status/matches.
- Event time unknown tetap NULL; browser campus display Asia/Jakarta. Audit timestamps UTC. Schedule input Asia/Jakarta dikonversi ke UTC lalu output ISO timezone yang eksplisit.
- Public photos max 4. Lost ownership max 2. Claim photos max 2. Found report menggunakan private finder clue, tanpa ownership-photo collection.
- Client menerima readable input ≤10 MB dan menyiapkan image ≤1200px long side / ≤250000 bytes. Server independently memeriksa count, upload status, MIME JPEG/PNG/WebP, dimensions, size, generated safe path dan ownership.
- Save baru membersihkan created files jika rollback; file lama baru dihapus setelah commit.
- Report edit/delete hanya own OPEN/POTENTIAL_MATCH, tanpa claim aktif (PENDING/NEED_MORE_INFO/APPROVED) atau confirmed pair (v0.2.5: claim REJECTED/WITHDRAWN tidak lagi mengunci). Delete confirmation; metadata cascade termasuk foto claim yang ikut terhapus, notification refs SET NULL.
- v0.2.5: event date tidak boleh setelah hari ini (Asia/Jakarta); judul minimal 3 dan private clue minimal 8 karakter.
- Matching score v0.2.5: kategori harus sama (25), area sama 25, shared identifying words 7 per kata max 35, date proximity max 15; minimum 55. Reporter yang sama tidak pernah dipasangkan, dan Found bertanggal lebih dari 1 hari sebelum Lost dilewati. Confirmed/terminal reports dikecualikan. Match adalah rule-based suggestion, bukan automatic ownership approval. Notifikasi hanya saat pasangan baru terbentuk.

## 3. Claim states dan review

| State | Aksi yang tersedia |
|---|---|
| PENDING | BM approve/reject/request-more-info; Student follow status |
| NEED_MORE_INFO | Student update/resubmit; BM review; request note private |
| APPROVED | Handover; tidak dapat disubmit ulang |
| REJECTED | Final untuk item ini (v0.2.5, `409 claim_final`) |
| WITHDRAWN | Student menarik claim PENDING/NEED_MORE_INFO (`action=withdraw`); same-record resubmit eligible selama Found masih eligible |

Satu record claim per `(item_id, claimant_user_id)` melalui UNIQUE. Active duplicate tidak membuat record baru. Resubmit NEED_MORE_INFO/WITHDRAWN mengubah record yang sama kembali PENDING.

Eligibility: Found milik orang lain, state OPEN/UNDER_REVIEW/POTENTIAL_MATCH/VERIFICATION, belum assigned/confirmed. Linked Lost opsional tetapi harus own, LOST, aktif, belum confirmed/closed, dan (v0.2.5) tidak sedang dipakai claim lain yang PENDING/NEED_MORE_INFO. Ownership answer minimal 8, maksimal 1000 karakter; photo evidence optional.

Resubmit form menampilkan previous answer, own Lost link, review note, dan retained evidence count. User memilih retain/replace/remove evidence secara eksplisit; kelebihan total dua foto ditolak. Private evidence URL tidak diberikan kepada Student.

Request-more-info: BM pada PENDING memasukkan note 8–500 karakter; transaksi menetapkan NEED_MORE_INFO, reviewer/time, generic item history event dan private notification. Request berulang pada state yang sama ditolak sebagai stale/duplicate. Resubmit mencatat event lalu kembali ke review queue; detail BM menampilkan permintaan terakhir dan waktu resubmit (v0.2.5).

Reject: note 8–500 karakter; notify claimant. Item tetap VERIFICATION jika claim lain aktif; setelah last active rejection kembali POTENTIAL_MATCH bila suggestion masih ada, selain itu OPEN (v0.2.5). Rincian note tidak masuk public timeline.

Approve: konfirmasi eksplisit, reviewer/note, lock related reports ascending ID dan claim rows, verify current eligibility, reject competing active claims (termasuk claim lama lain yang memakai Lost yang sama), confirm optional pair, set HANDOVER, create exactly one handover, append history/notifications, commit together. Failed transaction rollback semuanya.

Deep link claim resolved/rejected membuka record yang dimaksud dalam mode outcome/read-only, bukan memilih klaim aktif lain.

### Fresh state dan confirmation

Seluruh review/status/pickup operations membutuhkan CSRF, explicit `confirm=1` dan SHA-256 `revision` dari latest authorized detail. Claim revision mencakup evidence IDs; report revision mencakup latest history ID; handover revision mencakup snapshot jadwal/notes/handler. Server reread di dalam transaksi, membandingkan revision, lalu memeriksa eligibility. Stale/missing revision atau repeated decision memberi 409 tanpa partial write. UI tidak mengulang POST otomatis dan menyediakan explicit refresh dengan draft note dipertahankan. v0.2.5: UI hanya meminta centang konfirmasi untuk keputusan final (approve, reject, complete, release, status Returned/Never retrieved); client tetap mengirim `confirm=1`.

BM workflow dan report matching berbagi advisory lock per database (`refind-matching-<db_name>`); related report rows dikunci ascending ID. UNIQUE/deadlock/lock-timeout conflict dipetakan 409. Approval/return gagal sebelum commit me-rollback claim/items/pair/handover/history/notifs bersama.

## 4. Handover — keputusan D05

| Operation | Allowed before | After | Efek |
|---|---|---|---|
| create on approve | No handover for claim | PENDING | Claim APPROVED, item HANDOVER |
| schedule | PENDING | SCHEDULED | Valid active campus pickup location + future date/time |
| reschedule | SCHEDULED | SCHEDULED | Schedule before/after dan reason dicatat |
| cancel_schedule | SCHEDULED | PENDING | scheduled_at NULL, reason required; ownership approved tetap |
| complete | PENDING/SCHEDULED | COMPLETED | BM confirms physical return; completed_at UTC; item/pair RESOLVED |
| release (v0.2.5) | PENDING/SCHEDULED | handover dihapus | Reason wajib ≥8; claim REJECTED dengan note "Pickup released: …", confirmed pair REJECTED, Found/Lost kembali OPEN/POTENTIAL_MATCH; audit tetap via claim_id |

Pickup spontan boleh completed dari PENDING sesudah confirmation. Cancel schedule tidak membuat handover kedua dan tidak mengaktifkan ulang competing claims. Completed handover dan terminal reports read-only. Delete/archive/review yang bertentangan dengan approved handover ditolak.

Schedule/reschedule memakai active campus AREA dan future `YYYY-MM-DDTHH:mm` dalam Asia/Jakarta. Server menyimpan UTC dan mengirim ISO `Z`. Reschedule dengan time/location yang sama ditolak 409. Pickup notes maksimal 250 karakter; reschedule/cancel reason wajib minimal 8. Cancel mengosongkan `scheduled_at`, mempertahankan pickup area, dan tidak menghapus private audit sebelumnya.

### Audit tanpa exposure publik

- Every schedule/reschedule/cancel/completion appends generic item_status_history event with actor/time for related reports.
- Detailed before/after pickup schedule, location, reason and claim reference disimpan dalam notifications untuk claimant dan BM lain (v0.2.5: BM pelaku tidak dinotifikasi; riwayat BM dibaca dari salinan claimant); current snapshot di handovers.
- Public history event hanya contoh `Pickup schedule updated`, tanpa alamat/tanggal/review proof privat.
- Pembatalan jadwal adalah exception yang dapat didemonstrasikan. Waiting for pickup adalah terminal **skenario flowchart**, bukan terminal database state.

## 5. Invariants

1. Identity/role/ownership bersumber dari authenticated DB user, bukan client dropdown.
2. Public ITEM dan private OWNERSHIP/claim media berbeda collections/endpoints/authorization.
3. One approved owner per Found; one confirmed pair per Lost/Found; one handover per claim.
4. Approval/return/history/notification consistency atomic. Reread state under lock; stale update 409.
5. Suggestions tidak mengalahkan confirmed/rejected pair atau status review/handover.
6. Latest item history status cocok current status. Repeated same-status audit event tetap append.
7. Public API/copy tidak membocorkan clue, evidence, NIM/email privat, review note, atau pickup details.
8. Client/server validation, prepared statements, escaping dan CSRF diterapkan.
9. Existing license/local assets tersedia dalam release. Timestamp NULL tidak dikarang.
10. v0.2.5: satu Lost report hanya dipakai satu claim PENDING/NEED_MORE_INFO (`one_active_claim_per_lost`).

## 6. Flowchart cross-reference

UX01 presentation: completed pickup displays Returned/completed_at, exact links focus the target, BM mobile Back restores queue and filter/page changes clear stale selection. Confirmation shows target identity;409 refresh retains note but resets confirmation. Private pickup summaries resolve area names and format WIB in UI; raw immutable audit remains available to authorized BM.

- FC01: login, role landing, session check, expired session, logout.
- FC02: Student Lost/Found report dan follow-up.
- FC03: discovery, claim eligibility, validation dan submission.
- FC04: Student ↔ BM review loop; continuation A menuju handover.
- FC05: BM manual status/archive dan schedule/reschedule/cancel/complete.
- FC06: Student/BM own profile/password/logout.
- UF01: actor goals, Student↔BM handoff, request-info/resubmit dan returned outcomes.
- AF01: actual protected routes, API boundaries, role/ownership/state guards dan persistence.

FC04 memiliki dua sheets dengan **satu Start total** dan pasangan connector A. Shared blocks melintasi batas dua lane untuk operasi kedua aktor/system; `(System)` jelas menandai otomatisasi, bukan tugas BM.
