# UX02 — Local folder rename and button-styled navigation

BATCH: UX02 — nine underlined navigation labels become outline links; Edit/Delete align visually.

STATUS: **Verified — local-only folder rename, button-link navigation, related regression and artefact checks.** Work from GitHub checkpoint85436aa.

## BASELINE / USER DECISIONS

The user approved button-styled links plus outline-navy Edit/danger-outline Delete, then requested folder-only naming `ReFind_0.2.3`, no GitHub push and no new ZIP. Existing product labels/schema retain0.2.0 identity; the main directory was moved from `C:\xampp\htdocs\ReFind_0.2.0` to `C:\xampp\htdocs\ReFind_0.2.3` with runtime storage and Git history intact.

## CHANGELOG

- Six protected templates: Home Follow/Explore, Item Back, Claim Back, My Activity history, Profile Settings and Settings Back links now use native `<a href>` with shared `.btn.btn-outline.navigation-action` presentation. Explore has a decorative aria-hidden arrow.
- `js/student-common.js` adds one shared native navigation-link builder; `student.js` uses it for verified-pair/eligible Edit links, with danger-outline Delete; `bm.js` uses it for linked Lost navigation.
- Shared styles provide46px minimum height, scoped no-underline, clear border/focus/hover, long-label wrapping and Home/header/Profile spacing. Edit/Delete action groups wrap without clipping.
- Ignored `app/config.local.php` overrides only `base_path` to `/ReFind_0.2.3/`. Main DB `refind_db_0_2_0` and cookie/app identity remain existing values; no credential reset or migration.
- Owned QA copy remains `ReFind_0.2.0_Test`; its inspected ownership marker now references the renamed source. Preparation retains its existing DB receipts/secret/storage. Main smoke reads actual config base path instead of hardcoded folder URLs.
- UX02 extends the existing meaningful browser harness with actual destination/native new-tab/Enter behavior, Edit/Delete ownership/confirmation/cancel/commit and navigation layout checks. All mutations use fresh `_test` actors and exact-ID cleanup.
- Current conceptual wireframe/draw.io/screenshot references reconcile outline navigation; actual state/user/app flow and schema contracts remain mapped to real routes/functions.

## DB CHANGE

**None.**14 tables/2 views/25 FK remain. Main smoke preserves3 account fingerprints and40 reports/12 claims/6 handovers,60 item photos/12 claim photos/176 notifications. Supporting images/credentials moved with the folder; existing seed bookmarks and database names are retained.

## TESTS EXECUTED

Working directory: `C:\xampp\htdocs\ReFind_0.2.3`.

| Command/check | Result |
|---|---|
| `python tools/prepare-test.py` | Owned QA copy/receipts/config preserved; existing passwords maintained |
| `node tools/test-ux.cjs --ux02` | **15 scenario groups PASS**,0 browser errors; native navigation/new-tab/keyboard and conditional links verified |
| `node tools/test-student.cjs` |24 Student groups PASS |
| `node tools/test-account.cjs` |24 account/nav groups PASS |
| `node tools/test-workflow.cjs` |27 BM/transactional workflow groups PASS |
| `node tools/smoke-auth.cjs --ux02` |3 accounts positive login/logout/read pages PASS at the new main URL; dataset unchanged;9 schema checks each main/test |
| Workflow/media invariants in UX suite |17 PASS; no missing/orphan/invalid media |
| Changed JS/CLI PHP syntax |PASS before browser execution |
| Draw.io/export/link verification |81 checks PASS;11 editable diagrams/13 sheets plus8 conceptual wireframe boards regenerated |

Required360×800,390×844,768×1024,1280×800,1440×900 viewports passed with no global overflow, clipped navigation text or sub44px link targets. First12 UX01 scenarios remain included. The3 new groups cover all nine labels (Open linked report in Student and BM contexts), navigation by Enter/Ctrl-click/new tab, link destination/record identity, Edit versus Delete semantics and role/confirmation enforcement.

## MANUAL TESTS / GAPS

Open the new URL and log in using the existing credentials. Home Follow/Explore, account links, Back controls, linked reports and own report action pairs should appear as outline controls without underlines. Try keyboard Tab/Enter and browser open-new-tab. Delete opens the existing confirmation; cancelling retains the record.

Physical-device keyboard remains the manual check described in UX01; no new blocking failure remains in executed UX02 checks. No fresh-archive test is claimed for this patch: delivery is a local folder, as requested.

## NEXT / DELIVERY

User visual review of local UX02. No commit/push/new ZIP is part of this request; GitHub remains checkpoint85436aa. Historical archives already in the moved folder are retained.

- Main: `http://localhost/ReFind_0.2.3/login.html`.
- Docs: `http://localhost/ReFind_0.2.3/docs/`.
- Local report: `C:\xampp\htdocs\ReFind_0.2.3\docs\UX02_REPORT.md`.
- Evidence: `docs/verification/ux02/ux-results.json`, `main-smoke.json`, home390/1440 and actual main screenshots.
- Folder-only rename does not claim a new application/database version or change the setup manifest.
