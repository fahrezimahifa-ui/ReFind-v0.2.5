# ReFind 0.2.5 UI/profile enhancements

## Development boundary

Branch: `codex/ui-ux-profile-enhancements`. Base: verified v0.2.5 remote main `70f8a546b13dd77f59df8d7d7bb74744cdd23c6a`. The existing application checkout has independent unpublished changes; none are imported into this branch.

The authorized worktree is `C:/xampp/htdocs/refind-dev`. Run `python tools/dev-init.py` there to generate an ignored ownership marker, development configuration and random database password. Existing private files are retained; mismatched identities are refused.

Start the dedicated runtime:

```powershell
docker compose --env-file .dev.env -f compose.dev.yml -p refind-ui-ux-dev up --build --detach --wait
docker compose --env-file .dev.env -f compose.dev.yml -p refind-ui-ux-dev exec -T web php tools/setup-db.php
docker compose --env-file .dev.env -f compose.dev.yml -p refind-ui-ux-dev exec -T web php tools/setup-demo.php
docker compose --env-file .dev.env -f compose.dev.yml -p refind-ui-ux-dev exec -T web chown -R www-data:www-data storage output
```

Open <http://127.0.0.1:8081/refind-dev/login.html>. Synthetic account credentials are generated privately in `storage/setup/demo-accounts.json`; never commit them. This runtime uses its own MariaDB service/volume and `refind_db_ui_ux_dev`, `/refind-dev/`, and `refind_ui_ux_dev`. Its startup guard checks those identities before serving requests. XAMPP settings and the original main/QA installations are not used.

All runtime uploads, auth secrets, sessions, throttle records and evidence belong to this worktree. There are no bind mounts of the existing application or QA storage. The shared Git object database is used only for normal Git/worktree operations. Legacy QA preparation explicitly refuses this worktree.

## Behavior and interfaces

Notification item links include `origin=notifications`, `notification_page` and `notification`. The item Back link and not-found recovery return to that notification page, focusing the originating notification. Context survives reload, new tabs and the guarded login return URL. Without that context, existing Explore navigation remains the default. Notification read-state behavior remains unchanged.

BM desktop queue/detail panels share a viewport-based height at 1100px and above. Each scrolls independently; the queue header and pager remain outside its scrolling list. The detail scroll resets when another record is chosen. Mobile retains its existing queue/detail history behavior. Shared section and badge gaps separate private clues, evidence and actions.

My Profile supports changing/removing a picture and a transient crop editor with drag, horizontal/vertical position sliders, zoom, reset, Save and Cancel. Sources are JPEG/PNG/WebP up to 10MB and 64 million decoded pixels; the browser uploads only a 512px square JPEG up to 250KB. The server independently validates and decodes that JPEG, then re-encodes it using GD. Source bytes and metadata are not stored.

Account `update_avatar` and `remove_avatar` actions require an authenticated account and CSRF. No target account ID is accepted. Account/session responses gain nullable `avatar_url`; item/report and claim/pickup projections gain corresponding reporter/claimant URLs. Media is served by authenticated `api/avatar.php?token=<current-random-token>`; storage paths are never exposed. Replacement/removal invalidates the former URL and cleans obsolete files after commit; failed writes retain the old reference and clean newly created files.

Avatars appear beside existing identities in the navbar, Profile, Settings, item detail, BM claimant queue cards and report/claim/handover detail. Names and role labels remain visible. Initials remain the fallback for missing or failed images.

## Schema and compatibility

Application version remains **0.2.5**. The schema adds nullable `users.avatar_path VARCHAR(80)` and private `storage/avatars`; no table, role or workflow status is added. Report matching, ownership approval, claim resubmission, pickup cancellation/release and physical-return rules are unchanged.

Fresh setup creates the new column. Repeated setup accepts the current receipt and one explicitly recorded prior SQL manifest, validates the prior users schema and applies the additive column upgrade. Unknown receipts/schema drift are refused. MariaDB DDL is not transactional; the recognized upgrade is repeatable after an interrupted column addition. Existing passwords, timestamps, records and media are preserved. Schema contracts/manifests, setup, cleanup, fingerprint and recovery tooling include avatars. SQL/contract source line endings are normalized to LF and hashes updated accordingly.

Do not run this upgrade against the existing main or QA installation during this task. A future deployment requires approval and a private matching SQL/storage/configuration backup with writers paused.

## Verification

Baseline before feature edits: 11 offline safety/configuration tests and JavaScript syntax (31 files) passed in the new worktree. Current source results and browser evidence are recorded separately below; historical results are not counted as current passes.

Run checks only through the guarded new runtime:

```powershell
docker compose --env-file .dev.env -f compose.dev.yml -p refind-ui-ux-dev exec -T --user www-data web node tools/run-qa.cjs
docker compose --env-file .dev.env -f compose.dev.yml -p refind-ui-ux-dev --profile verification up --detach --wait upgrade-database recovery-database
docker compose --env-file .dev.env -f compose.dev.yml -p refind-ui-ux-dev exec -T web python tools/test-avatar-upgrade.py
```

The two verification databases are separate disposable services in this new project, with no published database ports. Upgrade/recovery fixtures use only those services.

Current task results, 30 October 2026:

| Check | Result |
|---|---|
| PHP / JavaScript syntax | PASS: 42 PHP source files / 33 JS and CJS files |
| ESLint / PHPStan level 5 / offline safety | PASS / PASS / 14 tests PASS |
| Full integration runner | PASS: all 23 stages, including schema/invariants before and after |
| Existing auth/account/Student/workflow/v0.2.5/UX suites | PASS: 142 groups per theme, 284 total |
| Projection / focused security | PASS: 12 comparisons / 6 groups |
| Notification layout/feed | PASS: 21 checks |
| Final UI/profile acceptance | PASS: 12 groups, including actual saved crop, EXIF orientation, drag/reset, concurrent replacement, failed writes, context navigation, queue avatars and navbar clearance |
| Theme | PASS: 23 checks, 190 captures, 2,434 contrast samples; no browser exceptions |
| Appearance | PASS: 16 groups, 3,532 motion-phase samples |
| Positive smoke | PASS: 3 accounts login/logout, unchanged development business/media fingerprint |
| Fresh setup / populated upgrade / repeat upgrade / recovery | PASS: 4 checks on the two separate verification services; valid linked JPEGs and restored workflow invariants |
| Manual screenshot review | Desktop/mobile, light/dark BM records and both roles' crop editors reviewed; captures leave the development business/media fingerprint unchanged |

The full matrix receipt is under `output/playwright/release-readiness/results/ui-profile-full-20261030-r4/summary.json`. Final focused results are under `output/playwright/ui-profile/final-20261030-1/`; final static and upgrade logs are private under `storage/setup/`. Earlier failed attempts remain available. Two legacy authentication assertions still assumed the old QA directory/cookie path or stderr-only diagnostics; these were adapted without weakening the profile/isolation checks. Screenshot review found a loading-row removal that shifted focused panels behind the navbar; loading now settles before focus, and final acceptance asserts the clearance. Editor close cleanup is synchronous so rapid reopening with a large photo cannot lose the new source.

Online dependency downloads failed with ECONNRESET. Local validation used copied cached packages, portable Sharp, system Chromium 156 and FFmpeg inside the dedicated container. The standard pinned CI dependency workflow remains in source. These environmental retries are recorded as failures, not counted as successful checks.

The preservation audit confirms all **682 inventoried non-session main files** (including configuration, auth secret, uploads and unpublished working files) and **all 939 inventoried QA files** match their initial hashes. One pre-existing main session file was absent at the end while separate main-app HTTP activity was recorded. Its contents were not inspected or restored; volatile session state was left alone. No task setup, seed, migration, browser login or mutation suite targeted the original main or QA installation. Git fetch/worktree/branch bookkeeping was the only intended shared-repository change.

Main/QA login, seed, migration and mutation traffic is excluded. Physical-device/screen-reader checks remain manual. Delivery is a pushed branch and draft pull request; no merge, auto-merge or deployment is authorized.

## Follow-up: approved local XAMPP integration

The original isolation-only delivery above records the 30 October checkpoint. The subsequent owner-approved XAMPP integration, glass polish, title punctuation cleanup and project-only Docker removal are described in [XAMPP_INTEGRATION.md](XAMPP_INTEGRATION.md). Its current results are recorded separately; existing main credentials/data remain authoritative.
