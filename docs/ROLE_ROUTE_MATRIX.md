# Role, routes, API, dan auth — As-built B06

**Current checkpoint: B06.** Seluruh12 routes dan MVP operations pada matriks berikut aktif. Bagian B02–B05 mencatat kondisi pada batch terkait; final regression/fresh-install evidence berada di [B06_REPORT.md](B06_REPORT.md). Dua role: STUDENT dan BUILDING_MANAGEMENT; main memiliki2 Student +1 BM.

## Status setelah B02

Auth/session/CSRF/throttling dan guards seluruh planned page/API sudah diimplementasikan. Tiga halaman auth foundation aktif; remaining authorized pages memberi 501 sampai B03–B05. API GET/read dan ownership policies tersedia; own notification mark-read berfungsi. Account edits B03, report/claim writes B04, staff/handover writes B05 memberi explicit 501 sesudah guard. Tabel berikut adalah kontrak final, bukan klaim semua operations sudah tersedia.

## Status setelah B03

Profile/Settings routes + own account writes telah aktif untuk Student/BM. `api/account.php` POST memakai action `update_profile` (name) atau `change_password` (current_password/new_password/confirm_password); identifiers/role ditolak dari payload. Lock row akun + fresh fingerprint check mencegah stale/concurrent credential overwrite. Current session ID/CSRF diregenerasi setelah password commit; sessions lain invalid pada protected request berikutnya. Wrong current-password attempts dibatasi 5/15 menit per user+IP, independen dari login limiter.

Shared top navbar/disclosure dipakai semua actual app pages dan messages. Live menu Home/Staff home + Profile/Settings/Logout; future business menu muncul B04/B05. Badge unread berasal dari notifikasi user sendiri. Halaman workflow lain tetap 501 setelah authorization.

## Page authorization

### Status B04

Student/shared routes and report/claim mutations are live. GET items supports prepared SQL filters/paging, detail/history/suggestions and own eligible edit metadata. Claim submit/resubmit locks related reports, preserves UNIQUE same-user/item record and selected evidence; evidence actual URLs remain BM-only. Notifications/read state and history UI are live for both roles. BM review/status/handover mutations remain explicit 501 until B05.

Upload constraints are checked independently on client/server. Matching serializes report mutations with a database-specific advisory lock and locks parent reports in numeric order. Files created before a failed transaction are removed; replaced files are removed only after commit and reference checks.

### Status B05

BM Claims/Reports/Handover queues dan authorized evidence/detail kini aktif. Review approve/reject/request-more-info, manual status/archive/Lost recovery dan pickup operations menyimpan real DB changes atomically. Semua BM mutations membutuhkan CSRF, `confirm=1`, eligible fresh state dan `revision` dari authorized detail. Stale/duplicate/concurrent decisions ditolak 409; UI mempertahankan draft note dan meminta explicit refresh.

Claim/report/handover deep links selalu membaca exact requested ID, termasuk reviewed/terminal read-only outcomes. Private review notes dan pickup before/after audit tidak masuk public detail/history. BM navbar menawarkan Review Queue/Handover/Explore/History/Notifications; Student menu tetap Student-only. Bukti 27 B05 groups dan regression suites: B05_REPORT.md.

### Status B06 (current)

Role/ownership/API contract berikut direverifikasi lewat regression dan fresh-install actual ZIP. Main40-report dataset mendukung demonstrasi semua states, sementara mutasi QA tetap terisolasi. Final sitemap/app flow membaca12 routes actual; draw.io diagrams dan81 artefact checks mengikuti files/functions yang tersedia. Release/local setup preserves account identities/passwords and public/private collections.

| Route | Guest | Student | BM |
|---|---|---|---|
| index.html | Landing | Student Home | Redirect Review Queue |
| login.html | Login | Redirect Home | Redirect Review Queue |
| browse.html, item.html | Login + safe return | Public report content | Public report content |
| report.html, claim.html, my-reports.html | Login + safe return | Allowed; object eligibility still checked | 403 / link kembali Queue |
| admin.html, seluruh tab/deep link | Login + safe return | 403 / link kembali Home | Allowed; stale state still checked |
| history.html, notifications.html | Login + safe return | Allowed | Allowed |
| profile.html, settings.html | Login + safe return | Own account | Own account |

Server page gateway harus memeriksa session/role **sebelum HTML protected dikirim**. Menu role bukan substitusi guard. Akses file melalui gateway memakai allowlist; parameter path bebas tidak diterima.

## API contract current

UX02 standalone navigation controls remain native anchor links with outline-button styling. Eligible own Edit versus confirmed Delete preserve separate navigation/mutation semantics. Local main base path is `/ReFind_0.2.3/` via ignored config; all12 route/role/API definitions and DB names retain the existing identity.

UX01 read models add `notification_type`, `item_title`, authorized `handover_id` and parsed `pickup_event` to own notifications, plus parsed private events to BM pickup audit. Stored messages are unchanged. BM metadata is role-authorized; Student handover links require the same claimant. UI filters/page changes reset transient selection, while explicit record deep links/saved outcomes remain pinned and identified.

| Endpoint | GET | POST / permission |
|---|---|---|
| api/session.php | Guest/auth state + CSRF token; own minimal identity when authenticated | Tidak menyediakan account switch |
| api/auth.php | — | Login untuk guest; logout untuk session sendiri; CSRF |
| api/account.php | Own profile; requires login | Edit display name / change password; own session ID, CSRF |
| api/references.php | Reference labels/categories/locations | — |
| api/items.php | Authenticated public list/detail/matches; mine from session; editable private metadata only own eligible report | Create/update/delete: Student; ownership + status + transaction |
| api/claims.php | Student's own claims / BM authorized queue/detail | Submit/resubmit: Student; own Lost link + Found eligibility + unique pair |
| api/staff.php | BM-only scoped report clue/evidence/review data | BM-only review/status, CSRF, allowed transition, transaction |
| api/handovers.php | Student's own claimed-item pickup record / BM operational queue | BM-only schedule/reschedule/cancel_schedule/complete |
| api/photos.php | ITEM public; OWNERSHIP/claim photo requires BM | — |
| api/notifications.php | Own notifications | Mark own record read |

GET memakai explicit query allowlist; sensitive fields tidak tersedia dalam public response. Private photo physical path tidak dikirim ke browser. Student boleh mendapatkan count/retained photo IDs untuk edit own report/claim; actual private photo read tetap BM-only pada MVP.

## Action permissions

| Action | Student | BM |
|---|---|---|
| Browse/search/filter/public detail | Ya | Ya |
| Create Lost/Found | Ya | Data demo dapat disediakan CLI; tidak ada report-submission menu BM |
| Edit/delete report | Own OPEN/POTENTIAL_MATCH tanpa claim/confirmed pair | Operational status melalui staff API |
| Submit/resubmit claim | Eligible Found orang lain; Lost link own | Review role, bukan representasi claimant |
| Read private evidence | Tidak pada MVP | Ya, melalui protected endpoint |
| Approve/reject/request-more-info | Tidak | Ya, eligible active claim |
| Schedule/reschedule/cancel appointment/complete handover | Tidak | Ya, approved handover eligible |
| View personal pickup status | Own approved claim | Authorized staff |
| Profile/settings/notifications | Own account | Own account |

### BM request payloads

- `api/staff.php` GET: `resource=claims|reports`, optional `id`, `q`, `status`, `type`, `page`, `limit`. Default resource reports; claim queue default active PENDING/NEED_MORE_INFO. Direct `id` membaca outcome tanpa mengganti selection dengan record aktif lain.
- `api/staff.php` POST review: `action=review`, `id` claim, `decision=approved|rejected|need_more_info`, `note` 8–500 karakter, `revision`, `confirm=1`, `_csrf`.
- `api/staff.php` POST status: `action=status`, `id` report, `status` dari `allowed_statuses`, `note` 8–500 karakter, `revision`, `confirm=1`, `_csrf`.
- `api/handovers.php` GET: optional `id`, `status=PENDING|SCHEDULED|COMPLETED|all`, `q`, `page`, `limit`; Student scope hanya own claim. BM detail menambah `revision`, eligible `operations` dan private `audit`.
- `api/handovers.php` POST: `action=schedule|reschedule|cancel_schedule|complete`, `id` handover, `revision`, `confirm=1`, `_csrf`; schedule/reschedule membutuhkan active campus `pickup_location_id` dan future `scheduled_at` format `YYYY-MM-DDTHH:mm` Asia/Jakarta. `note` maksimal 250 karakter; wajib minimal 8 untuk reschedule/cancel_schedule, optional untuk schedule/complete.
- Cancel schedule mengosongkan scheduled time pada handover yang sama; claim APPROVED dan item HANDOVER tetap. Complete mencatat physical return, item/pair RESOLVED dan timestamp UTC bersama history/notifs.

## Session/auth decisions

- Login email + password; lookup users, `password_verify()`, active account check, generic failed-login message.
- Session authority = server `user_id`. Request fields `role`, `account`, `user_id` tidak dapat menentukan identitas/permission.
- `session.use_strict_mode`, HttpOnly, SameSite=Lax, scoped cookie path `/ReFind_0.2.0/`, Secure bila HTTPS, regenerate ID setelah login/change password.
- Idle expiry target 30 menit, absolute expiry 8 jam; configurable. Expired protected request → 401, UI login + allowlisted local return route.
- Logout: CSRF-protected POST, clear session data, destroy session, expire cookie. Replaying old cookie harus ditolak.
- CSRF bootstrap tersedia bagi guest login; token baru setelah login/logout/credential change.
- Login throttle: maksimum 5 gagal per 15 menit per email+IP dengan server-side protected/locked storage, ditambah IP limit. Session baru tidak mereset attempt counter. 429 menyertakan Retry-After.
- Password change: current password + new + confirmation. Minimum 10 karakter, maksimum 72 UTF-8 bytes pada PHP 8.2 PASSWORD_DEFAULT/bcrypt; mencegah suffix truncation. Password tidak di-trim, dicatat dalam log, atau disimpan plaintext.
- Credential fingerprint pada session diperiksa terhadap password hash terbaru: other sessions invalid setelah password change, session current diregenerasi.
- Nama trim/nonempty, maksimum 120 karakter; email/NIM/role readonly. Tidak ada profile query untuk akun lain.

## HTTP outcomes

| HTTP | Makna |
|---|---|
| 200 / 201 | Successful read/mutation / new record |
| 400 | Malformed ID/query |
| 401 | Not logged in / expired / invalid credential |
| 403 | Wrong role/ownership or invalid CSRF |
| 404 | Record/photo unavailable |
| 405 | Method not supported |
| 409 | Duplicate, locked/terminal state, stale/concurrent change |
| 422 | Field/file validation |
| 429 | Authentication attempt limit |
| 500 | Generic server failure; internal detail only server log |

401 redirect tidak mengulang POST otomatis. Draft form dapat dipertahankan dalam memori saat retry; private evidence/password tidak disimpan dalam localStorage.
