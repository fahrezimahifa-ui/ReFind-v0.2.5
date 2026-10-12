# v0.2.5 — Fixes for the 49-finding QA pass

BATCH: v0.2.5 — every bug, flow, redundancy and copy finding from the full QA pass of the local UX02 build, fixed in four priority tiers.

STATUS: **Verified — all automated suites, the new v0.2.5 suite, a manual browser re-test and the restore proof pass.** Built on commit `08b7158` (UX02 checkpoint). Published to `https://github.com/fahrezimahifa-ui/ReFind-v0.2.5`.

## BASELINE / USER DECISIONS

The QA pass (12 Oct 2026) tested every page, button and flow for Student A, Student B and Building Management on the main app and found 15 bugs (F01–F15), 10 illogical flows (A01–A10), 9 redundancies (R01–R09) and 15 copy/consistency issues (C01–C15). The user approved a tiered fix plan with these product decisions:

1. **Pickup contact (A01):** students see a configurable Building Management desk (name, location, hours, contact); BM sees the claimant's email and student ID. No database change.
2. **Claim rules (A03/A04):** students can withdraw a PENDING or NEED_MORE_INFO claim and claim again later; a REJECTED claim is final for that item; only active claims (PENDING, NEED_MORE_INFO, APPROVED) lock reports.
3. **History (R01):** History is the archive of closed reports (Returned, Never retrieved) and appears in the Student navigation; Explore shows active reports by default.
4. **Version label:** visible labels read 0.2.5. Database names (`refind_db_0_2_0`, `_test`), the local folder `ReFind_0.2.3`, config defaults and the session name are unchanged.

## CHANGELOG

### Tier 1 — data integrity and core flows

- **Matching (F01, F08):** suggestions require two different reporters, the same category and a Found date no earlier than the day before the loss. Weights are category 25, area 25, shared words 7 each (max 35), date 15/10/5; the threshold rises from 35 to 55. Stored pairs that break these rules are no longer shown.
- **Shared Lost link (F02):** a Lost report can back only one claim under review (422 on `lostItemId`); the claim form hides Lost reports already in use. Approval also closes older claims that reused the same Lost report and re-settles their Found reports. New invariant `one_active_claim_per_lost` (18 invariants).
- **Locks (F03):** only active claims lock reports, with a visible reason on the report. Deleting a report also removes the photo files of closed claims that cascade with it.
- **Reject (F04, A04):** the Found report returns to Possible match when suggestions exist, otherwise Reported. A rejected claim is final (`409 claim_final`).
- **Withdraw (A03):** `api/claims.php` `action=withdraw` for PENDING/NEED_MORE_INFO, with a confirmation dialog on My Activity and the claim page.
- **Pickup desk and contact (A01):** four `pickup_desk_*` config keys (overridable in `config.local.php`), exposed by `api/references.php` and shown on approved claims; BM claim and pickup details include claimant email and student ID.
- **Validation (F05, F06, F07, F14):** event dates after today (Asia/Jakarta) are rejected; titles need 3 and private clues 8 characters. Missing or invalid ids show a not-found state with a way out. The item page keeps the claimant's own status next to a verified pair. Public item photos require a signed-in user.

### Tier 2 — important flows

- **Finder path (A02):** "I found this item" on another student's active Lost report opens a prefilled Found form.
- **Resubmitted claims (A05):** BM sees the previous "more info" request and the resubmit time.
- **Release (A06):** new `release` pickup operation for no-shows or revoked ownership: claim REJECTED with the reason, confirmed pair REJECTED, handover removed, both reports available again. Confirming a return before the appointment shows a warning.
- **BM navigation (A07, A08):** "Open in Review Queue" on item pages; locked reports link to their claim or pickup; on phones a card opens the detail as its own history step, so system Back returns to the queue.
- **History and My Activity (R01, R04):** History lists closed reports; Explore and the Reports tab show active reports; the Closed tab is no longer a subset.
- **Notifications (R02, R08):** the acting BM is no longer notified of their own pickup change (BM pickup history reads the claimant's copy); one notification per status update; matching notifies only on a new pairing; "Mark all as read"; the badge uses a count-only request.
- **Fewer BM steps (R03, R05):** the confirmation tick is required only for final decisions (approve, reject, complete, release, final statuses); "Open handover" and "Schedule pickup now" switch tabs in place; queue defaults are "Waiting for BM" and "Active pickups".

### Tier 3 — validation and behaviour polish

URL parameters are sanitised and pages clamped (F09); empty pickup area/date show field errors (F10); unchanged reschedules are caught before sending (F11); emoji answers count as characters (F12); the deep-linked claim highlight applies once (F13); the selection note matches the viewport (F15); confirmation resets after failed attempts (A09); the status picker has a placeholder and marks final options (A10); the duplicate Handover nav item is gone and the tab title follows the tab (R06); the claim form preselects the matching Lost report (R07); the claim page has a single back path (R09).

### Tier 4 — copy and consistency

One status vocabulary in filters, cards, timelines and notifications (C01); accurate sort label (C02); developer jargon removed (C03); clear "claim unavailable" reasons (C04); Found-mode copy (C05); messages addressed to the right person (C06); "Keep appointment" and length hints in dialogs (C07); default pickup at the next working day 10:00 WIB (C08); accurate profile/password copy (C09); success messages after redirects via `sessionStorage` (C10); unified dialogs and labels (C11); unread badge on Notifications and the mobile Menu button (C12); filters list only usable values and show an active-filter count (C13); pager moves focus to the results (C14). C15 (raw demo titles in the edit form) is a demo-seed artifact and is unchanged.

### Found during the re-test

- After "Release pickup" the review screen opens the closed claim instead of a missing pickup record.
- Browsers kept a cached `bm.js` after the update; `.htaccess` now sends `Cache-Control: no-cache` for JS/CSS (ETag revalidation), so upgrades reach users without a hard refresh.

### Tooling

- `tools/test-v025.cjs`: 24 API/browser groups, one or more per finding.
- `REFIND_EVIDENCE_BATCH=v025` (and `--v025` for `test-ux`/`smoke-auth`) writes evidence to `docs/verification/v025/` without overwriting earlier batches.
- `tools/refresh-matches.php [--dry-run]`: recomputes stored suggestions with the v0.2.5 rules (CLI only; back up first).

## DB CHANGE

**None.** 14 tables / 2 views / 25 foreign keys; `schema.sql` and its fingerprint are untouched. The main demo dataset was restored after testing and verified identical (40 reports, 12 claims, 6 handovers, 60 item photos, 12 claim photos, 176 notifications, 133 history events). Stored suggestions in the existing demo still use the old scoring until `tools/refresh-matches.php` is run.

## TESTS EXECUTED

Working directory: `C:\xampp\htdocs\ReFind_0.2.3`.

| Command/check | Result |
|---|---|
| `php -l` (all PHP) / `node --check` (all JS and CJS) | PASS |
| `python tools/prepare-test.py` | Test copy synced; existing passwords preserved |
| `node tools/test-v025.cjs` | **24 groups PASS**, 0 browser errors |
| `REFIND_EVIDENCE_BATCH=v025 node tools/test-auth.cjs` | 28 groups PASS |
| `REFIND_EVIDENCE_BATCH=v025 node tools/test-account.cjs` | 24 groups PASS |
| `REFIND_EVIDENCE_BATCH=v025 node tools/test-student.cjs` | 24 groups PASS |
| `REFIND_EVIDENCE_BATCH=v025 node tools/test-workflow.cjs` | 27 groups PASS |
| `node tools/test-ux.cjs --v025` | 15 groups PASS (UX01 + UX02) |
| `node tools/smoke-auth.cjs --v025` | 3 accounts PASS on main; data unchanged; 9 schema checks on both databases |
| `tools/check-database.php` / `tools/check-workflow.php` | 9/9 and 18/18 PASS on main and `_test` |

Assertions were updated only where behaviour changed on purpose (rejection final, one active claim per Lost report, no tick for reversible BM actions, 6 filter areas, signed-in public photos, acting BM not self-notified).

## MANUAL TESTS / GAPS

A manual browser re-test on the main app repeated the original QA journey: Lost report with photos, "I found this item", automatic Lost preselection, shared-Lost block, request more info, resubmit with the BM question shown, approval with "Schedule pickup now", schedule/reschedule/cancel/complete with inline errors and early-return warning, release, reject-final, withdraw, History archive, mobile menu badge, 404 pages and console. Main DB and storage were backed up first and restored afterwards (checksums and file hashes identical).

Known gaps: draw.io flowcharts (FC03/FC04/FC05) are not regenerated for withdraw/release; physical-device keyboard checks remain manual; no release ZIP is built for this version.

## NEXT / DELIVERY

- Main: `http://localhost/ReFind_0.2.3/login.html` (local folder keeps its name; `config.local.php` sets the base path).
- Repository: `https://github.com/fahrezimahifa-ui/ReFind-v0.2.5`.
- Evidence: `docs/verification/v025/` (`fixes/`, `auth/`, `account/`, `student/`, `workflow/`, `ux/`, `smoke/`).
- Optional data refresh for the existing demo: `C:\xampp\php\php.exe tools/refresh-matches.php --dry-run`, then without `--dry-run` after a backup.
