# Acceptance test plan — ReFind 0.2.0

**Status awal B01: semua test aplikasi NOT RUN.** B01 hanya memverifikasi artefak blueprint; hasilnya terpisah di B01_REPORT.md. Mutation tests menggunakan `refind_db_0_2_0_test` dan test URL terpisah, dengan fixtures yang dibersihkan berdasarkan ID.

**Status B02:** AU01–AU08 (auth/session/roles/CSRF/throttle) telah diuji melalui real HTTP/browser. Foundation ownership/private-photo/notification-read policies, schema/constraints, safe return dan XSS escaping juga diuji. Login/logout UI diuji pada lima viewport wajib. Detail: B02_REPORT.md dan `verification/b02/auth-results.json`. Profile edit/change-password UI, upload/report/claim mutations, BM decisions/handover serta full workflow masih **NOT RUN**. Credential fingerprint dites melalui perubahan hash fixture DB, bukan klaim bahwa change-password UI B03 sudah tersedia. Tabel di bawah tetap matriks target; hasil parsial tidak berarti satu modul penuh selesai.

**Status B03:** AC01–AC04 sudah diuji lewat actual API/browser; nama persist/relogin, old/new password login, other-session invalidation, current SID/CSRF rotation, readonly identity dan own-account scope. Profile/Settings + navbar diuji untuk kedua role pada lima viewport; keyboard/focus/inline validation/loading/retry turut diuji. Regression AU01–AU08 B02 tetap lulus. Upload/report/claim/review/handover/full workflow masih **NOT RUN** pada checkpoint B03. Bukti: B03_REPORT.md dan `verification/b03/account-results.json`.

**Status B04:** Student submit/edit/delete, search/filter/paging, public/private upload, rule-based match, claim/duplicate/concurrency/resubmit, own activity/notification/history were tested with actual HTTP/browser/SQL/storage. Controlled CLI-only `_test` failure triggers verify rollback after file save. Seven Student pages were tested at all five viewports. Auth/account regression remains passing. NEED_MORE_INFO/approved/terminal exception states were injected as isolated fixtures; BM actions and full Lost → Returned were **NOT RUN** at the B04 checkpoint. See B04_REPORT.md and verification/b04/student-results.json.

**Status B05:** BM01–BM08 dan full workflow Lost → Found → Claim → BM Verification → Handover → Returned diuji melalui real API/browser/SQL pada `_test`. Request-more-info/resubmit, approval/reject, status/archive/recovery, pickup operations, private audit, stale/races dan forced rollback lulus. Bukti: [B05_REPORT.md](B05_REPORT.md), [verification/b05/workflow-results.json](verification/b05/workflow-results.json) (**27 groups**, complete=true,0 browser errors). Main B05 smoke memiliki3 accounts tanpa business mutations.

**Status B06 (current):** auth28/account24/Student24/BM27 regression groups,7 meaningful seed/idempotency groups dan13 actual extracted-ZIP browser groups PASS. DC01–DC03 final draw.io sitemap/ERD/flowchart/user/app flow reconciliation lulus81 semantic/source/export/link checks. RL01 lulus new empty-DB setup/seeding, repeatability, role/privacy, full Returned,9 schema checks/17 invariants dan all five viewports on an isolated server. Main3-account40-report smoke passes with business data unchanged. Actual screenshots and screen-only demo clips supplement conceptual editable wireframes. Evidence: [B06_REPORT.md](B06_REPORT.md), `verification/b06/`.

Status B01–B05 di atas adalah checkpoint historis. The final approved MVP has executed auth/account/Student/BM/security/persistence/responsive/documentation/fresh-install acceptance coverage; user manual demo follows the SOP.

## Auth / account

**v0.2.5 update:** new `tools/test-v025.cjs` (24 API/browser groups covering the 49 QA findings) plus regressions with v0.2.5 evidence: auth 28, account 24, Student 24, BM workflow 27, UX 15 groups and 3-account main smoke PASS; 9 schema checks and 18 workflow invariants (new `one_active_claim_per_lost`) PASS on main and `_test`. Assertions changed only for intended behaviour (rejection final, one active claim per Lost report, no tick for reversible BM actions, 6 filter areas, signed-in public photos, acting BM not self-notified). Manual browser re-test on main with backup/restore. Evidence: [V025_REPORT.md](V025_REPORT.md), `verification/v025/`.

**UX02 local update:**15 UX groups (the12 prior scenarios plus3 navigation/conditional-action/responsive groups),24 Student/24 account/27 BM regressions and3-account main smoke PASS. All9 formerly underlined standalone labels remain native anchors with correct record destinations, Enter/native new tabs and outline presentation; Edit/Delete roles/cancel/commit remain valid. Local main folder is ReFind_0.2.3 with base-path override; schema/version/data preserved, no new ZIP or push. Evidence: [UX02_REPORT.md](UX02_REPORT.md), `verification/ux02/`.

**UX01 update:**12 additional HTTP/browser UX groups exercise selection reset/late response, queue paging, one-primary review/identified confirmation, pinned/deep-link focus/back, retained draft/reconfirmation, Returned completion time, direct private pickup links, accessible uploads/disclosure and computed contrast. Five required viewports and a reduced-height simulation pass. Physical Android/iOS keyboard checks remain manual. [UX01 report](UX01_REPORT.md), `verification/ux01/ux-results.json` and latest regression outputs document this update.

| ID | Skenario | Expected / evidence |
|---|---|---|
| AU01 | Student A/B dan BM login credential benar | Distinct IDs, DB role, correct landing; capture API/cookie |
| AU02 | Salah password, unknown email, inactive user | Same generic rejection, no authenticated session; DB before/after |
| AU03 | Session fixation / refresh / idle+absolute expiry | ID rotates after login; refresh persists; expired protected request 401 |
| AU04 | Logout then replay old session cookie | Protected page/API unavailable; no mutation |
| AU05 | Student requests admin page / GET+POST staff/handover APIs | 403; compare DB fingerprints |
| AU06 | Guest requests protected route/API | Login + allowlisted return / 401 API; no implicit Student |
| AU07 | Role-aware navbar and client-forged role/account/user_id | Menu correct; identity/permission never changes from input |
| AU08 | Invalid/stale CSRF, repeated failed logins with new sessions | 403 mutation; 429 + Retry-After for throttle; no DB changes |
| AC01 | Change display name, reload, logout/login | Same name in DB/Profile/public display; invalid/overlong rejected |
| AC02 | Current password wrong / confirmation mismatch | Rejected; stored hash unchanged |
| AC03 | Valid password change | Hash updated; old login fails, new works; other session invalid |
| AC04 | Read/edit other account or change role/email/NIM | Rejected/readonly; no private profile exposure |

## Student workflow

| ID | Skenario | Expected / evidence |
|---|---|---|
| ST01 | Lost creation with 4 public + 2 private photos | DB+files+history persist, private fields absent public response |
| ST02 | Found creation, known/unknown time | No Lost evidence field; server rejects injected ownership files; NULL respected |
| ST03 | All filters/search, rapid changes, literal `%/_/'`, zero results | Correct result cards, request ordering, clear/reset works |
| ST04 | Suggestion score and opposite types | Rule-based score persists; terminal/confirmed excluded; no auto approval |
| ST05 | Own eligible report edit/delete vs foreign/locked report | Only eligible own mutation; cascade/cleanup after commit; notification refs NULL |
| ST06 | Valid claim + optional own Lost + 2 photos | PENDING same authenticated claimant, VERIFICATION, BM notification |
| ST07 | Own Found, duplicate active claim, foreign/closed Lost, terminal Found | 403/409/422 appropriate; no partial DB/file writes |
| ST08 | NEED_MORE_INFO/REJECTED resubmit | Same claim ID, updated answer, explicit retained/replaced files, PENDING |
| ST09 | My Activity, own pickup status, notifications/read state | User-isolated, reload persists, correct deep links including completed claims |

## BM workflow

| ID | Skenario | Expected / evidence |
|---|---|---|
| BM01 | Queue/detail + enlarge evidence + keyboard close | Authorized private data, right record, focus restored |
| BM02 | Request More Info → Student resubmit → BM queue | Note private, same claim ID, correct history/notif, no duplicate request |
| BM03 | Reject one vs last active claim | VERIFICATION vs OPEN appropriately; reason delivered to claimant |
| BM04 | Approve linked/unlinked claim | One approved owner/handover; optional confirmed pair; competing claims rejected |
| BM05 | Schedule/reschedule/cancel_schedule | One handover ID, before/after audit+notif; cancellation PENDING and ownership retained |
| BM06 | Complete pickup from PENDING/SCHEDULED | COMPLETED + completed_at; confirmed item pair RESOLVED; notifications/history atomic |
| BM07 | Manual status / Lost recovery / Never retrieved | Eligible choices only; active claim/handover conflicts rejected; terminal read-only |
| BM08 | Two BM approvals / shared Lost race / stale schedule/completion | Exactly one owner/pair/handover; loser 409; no contradictory state |

## Security / persistence

| ID | Skenario | Expected / evidence |
|---|---|---|
| SE01 | Guest/Student B guesses private photo IDs and direct storage/tools/config path | 401/403; no evidence bytes; public photo endpoint still valid |
| SE02 | Cross-user edit/delete/Lost link/notification/profile requests | Ownership enforced from session; DB unchanged |
| SE03 | Fake MIME, SVG/GIF, >1200px, >250000 bytes, excess count, upload failure | Server rejection independent client; rollback and cleanup |
| SE04 | Injection/HTML content, wrong methods, unsafe return/path traversal | Prepared statement, escaped output, 405, local allowlist; no debug leakage |
| DB01 | Reload/new browser reads after each mutation | DB source of truth; no app record persistence in localStorage |
| DB02 | Forced approval/notification/handover failure | Full rollback: claim/items/match/history/handover/notif |
| DB03 | FK/UNIQUE/CHECK and media invariant checks | 14 tables, 2 views, 25 FKs; one owner/pair, limits, latest status, no missing/orphan files |
| DB04 | Event timezone / NULL time / schedule conversion | Asia/Jakarta display; UTC audit; no fabricated time |

## UI / documentation / release

| ID | Skenario | Expected / evidence |
|---|---|---|
| UI01 | 360×800, 390×844, 768×1024, 1280×800, 1440×900 | No global horizontal overflow; screenshots + actual interactions |
| UI02 | Top menu/account/nav/badge on both roles | No primary sidebar; active page and touch/keyboard behavior correct |
| UI03 | Report/claim upload, modal, keyboard on smartphone | Form/buttons visible, scrollable modal, min 44px primary touch targets |
| UI04 | Loading/error/retry/empty/success/disabled states | No fake data/state; draft survives failed save; focus/feedback understandable |
| UI05 | BM queue/review/handovers on mobile | List cards usable; confirmation visible; no forced wide table |
| UI06 | Color/contrast, type, public-vs-private upload labels | Readable and consistently meaningful; possible match ≠ approved |
| DC01 | Sitemap and all page/feature nodes | Root Home/Landing Page; each route maps real final UI; no fictitious page |
| DC02 | FC01–FC06 source and export review | One Start each (FC04 total across sheets), two actors, labelled branches, reachable End, paired A |
| DC03 | SQL vs dictionary/ERD comparison | PK/FK/nullability/UNIQUE/cardinality exact; final docs marked implemented only after verification |
| RL01 | Fresh XAMPP install from release README+SQL | New schema/seed/media/auth work; local dependencies/licenses; no .git/secrets/runtime QA leakage |

## Executed suite / evidence mapping

| Coverage | Latest executed evidence | Result |
|---|---|---|
| AU01–AU08, SE01/SE02/SE04 foundation | `verification/b02/auth-results.json` | 28 groups PASS; regression after B05 |
| AC01–AC04, shared navbar/keyboard/responsive | `verification/b03/account-results.json` | 24 groups PASS; regression after B05 |
| ST01–ST09, upload/privacy/rollback/persistence | `verification/b04/student-results.json` | 24 groups PASS; Student regression after B05 |
| BM01–BM08, DB01/DB02/DB04, UI05 and operational dialogs | `verification/b05/workflow-results.json` | 27 groups PASS, including actual browser lifecycle |
| DB03 live schema + main read-only application smoke | `verification/b05/main-smoke.json` | 9 checks each main/test; three accounts PASS; unchanged business dataset |
| DB03 workflow/media invariants | B05 workflow JSON + CLI `tools/check-workflow.php` main/test | 17 checks PASS; no missing/orphan/invalid media |
| UI01–UI04 responsive interactions | Account/Student/BM suite viewport checks and screenshots | Required 360/390/768/1280/1440 viewports exercised |
| DC01–DC03 final as-built draw.io/source/export reconciliation | `verification/b06/artifact-results.json` |81 final checks PASS;11 diagrams/13 sheets plus8 editable wireframe boards |
| Expanded mock seed / retention / cleanup | `verification/b06/seed-results.json` |7 groups PASS;40 reports/12 claims/6 pickups, safe reseed/edit/delete behaviour |
| RL01 clean installation/package / actual full lifecycle | `verification/b06/fresh-install-results.json`, `fresh-browser-results.json` |8 fresh setup checks +13 browser groups PASS; main unchanged |
| Main expanded dataset / current schema | `verification/b06/main-smoke.json`, `dataset.json` |3-account smoke PASS;40 reports,12 claims,6 pickups;9 checks each main/test |

B06 uses the existing repeatable credential-login/test-database harness plus isolated fresh-server acceptance. Counts are reported from executed evidence; the historical baseline41 groups are not used as current test results.
