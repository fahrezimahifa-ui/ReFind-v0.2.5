# ReFind v0.2.5: architecture and local operation

This guide describes the source reviewed at `857acea`, with the existing local path override, on 27 October 2026. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the WDD/UX product story and [REQUIREMENTS_AND_ROADMAP.md](REQUIREMENTS_AND_ROADMAP.md) for implemented/proposed boundaries.

## 1. Identity and quick start

| Setting | Existing local installation |
|---|---|
| App version | **0.2.5** |
| Codex/source root | `C:\xampp\htdocs\ReFind_0.2.3` |
| Login URL | `http://localhost/ReFind_0.2.3/login.html` |
| Effective URL base | `/ReFind_0.2.3/` |
| Main MariaDB database | `refind_db_0_2_0` at `127.0.0.1:3306` |
| Owned QA app/database | `ReFind_0.2.0_Test` / `refind_db_0_2_0_test` |
| Source defaults | `app/config.php` |
| Local override | Ignored `app/config.local.php`, returning the current `base_path` |

The folder/database labels retain earlier versions. **v0.2.5 required no schema migration.** The source default URL remains `/ReFind_0.2.0/`; this installation's local override is essential.

To run this existing installation:

1. Open the XAMPP Control Panel and start **Apache** and **MySQL**.
2. Open the login URL above using HTTP.
3. Use the existing local demo account information described in [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md); the private generated receipt is `storage/setup/demo-accounts.json`.

This PHP installation runs through Apache, its rewrite rules and protected page gateway. Opening an HTML template with `file://` describes the separate academic template, not this workflow.

Runtime prerequisites: Apache with rewrite and the required `.htaccess` overrides; PHP 8.2 with mysqli/mysqlnd, mbstring, fileinfo and sessions; MariaDB/InnoDB. jQuery 3.7.1 and Bootstrap 5.3.8 are shipped locally in `vendor/`. Node/Python/browser automation are development tooling, not website startup requirements.

Configuration and database files establish the intended connection; this guide is not evidence that services are currently running. The documentation handoff does not include a new live SQL export. Existing schema/reference seed and private historical backups have different purposes.

## 2. Source map

Paths below are relative to the project root.

| Location | Responsibility |
|---|---|
| `.htaccess` | Rewrite the root and twelve `.html` routes to `page.php`; deny internal directories/dotfiles; asset cache revalidation |
| `page.php`, `app/routes.php` | Allowlisted page routing, session/role guards, template rendering and safe return URLs |
| `app/pages/` | Actual HTML templates, BM page and shared navigation partial |
| `css/` | Shared, auth, Student and BM styling |
| `js/api.js` | In-memory session/CSRF state, same-origin fetch and API error handling |
| `js/shell.js`, `js/student-common.js` | Shared navigation, feedback, formatting and Student helpers |
| `js/theme.js`, `css/theme.css` | Early client-side theme selection and shared light/dark semantic colors; no server preference or schema change |
| `js/student.js`, `js/bm.js` | Student and BM interactions |
| `js/auth-ui.js`, `js/account-ui.js`, `js/uploads.js` | Login/account UI and client image preparation |
| `assets/`, `vendor/` | Branding, local browser libraries and licenses |
| `api/` | HTTP adapters: methods, input allowlists, auth/CSRF, application calls and JSON/photo responses |
| `app/` | Configuration, authentication, authorization, repositories, business transactions and uploads |
| `database/` | Schema, views, reference-only seed and manifest |
| `storage/` | Private runtime media, installation/auth state, sessions and local backups |
| `tools/` | Setup, fixtures, focused QA, database checks, backup/release and artifact utilities |
| `docs/` | Contracts, data dictionary, historical evidence, editable diagrams, wireframes and this context pack |
| `releases/` | Historical packaged checkpoints and verification receipts |

## 3. Request and persistence flow

1. Apache receives the request. `.htaccess` directs the root or an allowed page URL to `page.php` and blocks direct access to `app`, `database`, `storage`, `tools` and `releases`.
2. The page gateway consults `app/routes.php`, applies authentication/role checks and renders the internal template with the configured base path.
3. Browser scripts call `api/*.php` with same-origin cookies. `api/session.php` bootstraps session identity and CSRF; `js/api.js` retains that state in memory.
4. API adapters invoke the procedural application layer. Business reads/writes use mysqli prepared statements through `app/db.php`.
5. MariaDB is the authority for accounts, reports, claims, handovers and notifications. Authorized image delivery reads files from private storage via `api/photos.php`.

Browser state is not the authority for role, ownership or persisted business records. Report-localStorage and simulated APIs in the WDD template must not be substituted for this implementation.

### Key backend modules

| Module | Main responsibility |
|---|---|
| `app/config.php`, `app/db.php` | Validated local configuration and shared mysqli/prepared-query helpers |
| `app/auth.php`, `app/accounts.php`, `app/http.php` | Sessions/login, account changes, CSRF, validation and HTTP/error helpers |
| `app/policies.php` | Shared identity/ownership and item-policy helpers |
| `app/repository.php` | Public-safe records, status names, matching scores and suggestion refresh |
| `app/reports.php` | Report create/update/delete with media and matching consistency |
| `app/claims.php` | Claim submit/resubmit/withdraw and evidence lifecycle |
| `app/workflow.php` | BM review/status, fresh revisions, transaction locks and handover operations |
| `app/staff-read.php`, `app/pickup-read.php` | Authorized BM/pickup read models and available operations |
| `app/uploads.php` | Independent server file validation, safe storage paths and rollback/reference-aware cleanup |

### HTTP API map

| Endpoint | Purpose |
|---|---|
| `api/session.php` | Guest/auth state and CSRF bootstrap |
| `api/auth.php` | Login/logout |
| `api/account.php` | Own profile and password changes |
| `api/references.php` | Categories, locations, status labels and configurable pickup-desk details |
| `api/items.php` | Search/detail/matches, own reports, report mutations |
| `api/claims.php` | Authorized claims and Student submit/resubmit/withdraw |
| `api/staff.php` | BM queue/details, ownership review and eligible report-status changes |
| `api/handovers.php` | Own/authorized pickup details and BM pickup operations |
| `api/notifications.php` | Own notifications, count and read/read-all updates |
| `api/photos.php` | Authorized image bytes |

See [ROLE_ROUTE_MATRIX.md](ROLE_ROUTE_MATRIX.md) for exact payloads and permissions. Important HTTP outcomes include 401 unauthenticated, 403 forbidden/CSRF, 409 duplicate/stale/state conflict, 422 field/file validation and 429 throttling.

## 4. Routes and roles

The actual route allowlist is [app/routes.php](../app/routes.php). `admin.html` renders internal `bm.html`.

| Route | Access/use |
|---|---|
| `index.html`, `login.html` | Guest landing/login; authenticated role-specific landing/redirects |
| `browse.html`, `item.html` | Signed-in Student/BM discovery and report details |
| `report.html`, `claim.html`, `my-reports.html` | Student reports, ownership claims and personal activity |
| `admin.html?tab=claims`, `?tab=reports`, `?tab=handover` | BM operational queues and decisions |
| `history.html`, `notifications.html` | Signed-in archive and own notifications |
| `profile.html`, `settings.html` | Signed-in own account |

There are two stored roles: `STUDENT` and `BUILDING_MANAGEMENT`. Security, Student Service, owner and finder do not add auth roles in this version. Menus assist navigation; backend/page guards enforce permission.

## 5. Database and filesystem

The schema has **14 tables, 2 views and 25 foreign keys**. Canonical schema is [database/schema.sql](../database/schema.sql); [DATA_DICTIONARY.md](DATA_DICTIONARY.md) and [schema-contract.json](schema-contract.json) describe its contract.

| Domain | Tables |
|---|---|
| Accounts | `users` |
| Reference taxonomy and locations | `categories`, `item_statuses`, `buildings`, `campus_locations`, `location_floors` |
| Reports and illustrations | `items`, `item_photos` |
| Suggested/confirmed pairs | `item_matches` |
| Ownership requests and evidence | `claims`, `claim_photos` |
| Approved-item pickup | `handovers` |
| Audit and user feedback | `item_status_history`, `notifications` |

Views: `v_items_overview`, `v_pending_claims`. `users` already stores the MVP profile; there is no separate `user_profiles` table.

`database/seed-reference.sql` contains taxonomy/status/location data, not a copy of current users/reports. SQL schema, reference seed, demo-seeding tools and a current SQL data export are different artifacts. The [database guide](../database/README.md) explains installation receipts and existing-data handling.

### Files required alongside database records

- `storage/items/`: discoverable report images.
- `storage/evidence/`: private Lost ownership evidence.
- `storage/claims/`: private claim evidence.
- `storage/auth/`: per-install auth secret and throttle state.
- `storage/sessions/`: server-side PHP sessions.
- `storage/setup/`: installation/demo receipts and private local backups.

Photo rows store relative file paths. A data backup must preserve the corresponding media. A Git clone excludes most runtime storage and the local override; a second write-active copy sharing the same database can create diverging media directories.

The valid local auth secret is required for authentication. Setup tools can generate installation state, but rerunning setup/seeding is not needed to attach Codex to this existing site. Preserve existing receipts when maintaining the installation.

### Privacy and file validation

“Public” ITEM photos mean visible to signed-in app users. OWNERSHIP/claim evidence bytes remain BM-only in the MVP, even where a student can retain/remove their evidence IDs. Public responses omit private verification clues, review evidence, claimant identifiers and pickup details.

Client preparation accepts images up to 10 MB and prepares at most 1200 px on the longest side. The server independently accepts JPEG/PNG/WebP at most **250000 bytes**, enforces dimensions/counts and creates random safe filenames. Limits: four public report photos, two Lost ownership photos and two claim photos. Failed transactions clean up newly created files; old unreferenced files are removed after commit.

## 6. State and transactional boundaries

| Stored report code | UI label |
|---|---|
| `OPEN` | Reported |
| `UNDER_REVIEW` | Under review |
| `POTENTIAL_MATCH` | Possible match |
| `VERIFICATION` | Claim review |
| `HANDOVER` | Ready for pickup |
| `RESOLVED` | Returned |
| `UNCLAIMED_CLOSED` | Never retrieved |

These are allowed states, not a compulsory linear sequence. [WORKFLOW_CONTRACT.md](WORKFLOW_CONTRACT.md) is the detailed transition reference.

- A suggestion requires different reporters, opposite Lost/Found types, the same category and an eligible date relationship. Threshold: 55/100; category 25, same area 25, shared identifying words 7 each capped at 35, date proximity up to 15. BM still verifies ownership.
- An eligible Student can submit identifying details and an optional own Lost link. Only one claim under review can use a particular Lost report at a time.
- `NEED_MORE_INFO` and `WITHDRAWN` can return to `PENDING` using the same claim record. `REJECTED` is final for that claimant/item.
- Approval atomically updates related reports, optional confirmed pair, competing claims, one handover, history and notifications.
- `cancel_schedule` moves a scheduled handover back to `PENDING`, preserving approval. `release` marks the claim rejected, removes the active handover and releases the related reports/pair. `complete` records physical return and synchronizes Returned states.
- BM mutations require CSRF, `confirm=1`, a current revision and eligible state. Transactions, ordered parent-row locking and a database-specific matching advisory lock protect consistency; stale/concurrent decisions yield 409.
- Detailed pickup changes remain in authorized audit/notifications; public item history uses generic events.

Campus event/schedule presentation uses `Asia/Jakarta`. Audit and scheduled timestamps are stored/returned with UTC handling; unknown event times remain null. Stored older suggestion scores can survive the v0.2.5 code change; `tools/refresh-matches.php` is a deliberate data-maintenance action, not a startup step.

## Verification and tooling

Run commands from the project root. For a documentation-only change, check links, referenced files and source consistency; application mutation suites are not necessary.

For relevant PHP/JS edits, focused syntax checks can be run without Apache/MySQL, for example:

```powershell
& "C:\xampp\php\php.exe" -l "app/claims.php"
node --check "js/student.js"
```

With the database running, these existing CLI checks inspect schema/workflow data; review their source before extending them:

```powershell
& "C:\xampp\php\php.exe" "tools/check-database.php"
& "C:\xampp\php\php.exe" "tools/check-workflow.php"
```

For behavioral changes, use the isolated QA installation. **Preparation and browser suites modify test/runtime state and write evidence.** The preparation script validates the existing ownership marker, syncs the sibling copy and runs its setup tools. Browser suites require Node, an available Playwright Core module/browser and running Apache/MariaDB. `test-v025.cjs` supports `REFIND_PLAYWRIGHT_MODULE`; tooling includes machine-specific paths.

```powershell
python "tools/prepare-test.py"
node "tools/test-v025.cjs"
```

Choose additional suites for the affected surface: `tools/test-auth.cjs`, `test-account.cjs`, `test-student.cjs`, `test-workflow.cjs`, or `test-ux.cjs --v025`. The regression evidence batch can be set with `$env:REFIND_EVIDENCE_BATCH = "v025"`. `smoke-auth.cjs --v025` targets the main app and writes session/auth state, although it is intended to preserve business records.

Historical engineering results are in [ACCEPTANCE_TESTS.md](ACCEPTANCE_TESTS.md), [V025_REPORT.md](V025_REPORT.md) and `docs/verification/v025/`. Historical data counts and PASS results should be attributed to those runs, not stated as a fresh live audit.

All six regression suites accept `REFIND_THEME=light` or `dark` and `REFIND_EVIDENCE_DIR` for a separate receipt directory. Run mutation suites sequentially. `tools/test-theme.cjs` performs read-only responsive/theme/accessibility review on the owned QA app; `--main` explicitly selects this local main installation and checks business-table fingerprints before/after. It needs Playwright, Sharp, and `@axe-core/playwright` (module paths can be supplied with `REFIND_PLAYWRIGHT_MODULE`, `REFIND_SHARP_MODULE`, and `REFIND_AXE_MODULE`). Keep review dependencies and screenshots under ignored `output/playwright/`. See [GLASS_DARK_MODE_REPORT.md](GLASS_DARK_MODE_REPORT.md) for the current run and its limits.

## 8. Existing documentation and known drift

- [B01_BLUEPRINT.md](B01_BLUEPRINT.md): initial architecture and traceability, reconciled through B06; read later v0.2.5 changes with it.
- [SOURCES_AND_DECISIONS.md](SOURCES_AND_DECISIONS.md): original scope and subsequent decisions.
- [diagrams/README.md](diagrams/README.md): editable draw.io sources and exports. FC03/FC04/FC05 were not regenerated for v0.2.5 withdraw/release.
- [wireframes/index.html](wireframes/index.html): conceptual design references, distinct from tested UI screenshots.
- [INSTALLATION_AND_RELEASE.md](INSTALLATION_AND_RELEASE.md): installation/package history. B06/UX01 release ZIPs predate the latest source; older `/ReFind_0.2.0/` links are not this installation's effective URL.
- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md#source-register): primary academic sources, provenance and page-number convention.

Physical custody history, separate security/Student Service accounts, campus SSO and automated retention/disposal are not implemented by the present schema/routes. See [REQUIREMENTS_AND_ROADMAP.md](REQUIREMENTS_AND_ROADMAP.md) before treating later UX proposals as existing capability.
