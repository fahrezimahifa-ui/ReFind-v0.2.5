# ReFind v0.2.5: architecture and local operation

Application topology was reviewed at `857acea`; `8331d90` adds the preserved visual finish. The release-readiness branch adds validated configuration, QA isolation and disposable CI without changing the schema or workflow contracts. Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for the WDD/UX product story and [REQUIREMENTS_AND_ROADMAP.md](REQUIREMENTS_AND_ROADMAP.md) for implemented/proposed boundaries.

## 1. Identity and quick start

[Normal local signup](LOCAL_SIGNUP.md) uses the existing localhost URL and database. The entire ReFind directory is loopback-only; Create account appears directly below Log in without a key, launcher or expiry.

Student registration adds guest-only `register.html` and `api/register.php`. It defaults to disabled and local-only; session bootstrap reports effective availability for the current requester. See [registration](STUDENT_SELF_REGISTRATION.md) and [local activation safeguards](XAMPP_REGISTRATION_INTEGRATION.md).


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

The folder/database labels retain earlier versions. **The original v0.2.5 release required no schema migration.** The profile enhancement adds a nullable avatar reference; see [the upgrade guide](UI_PROFILE_ENHANCEMENTS.md). The source default URL remains `/ReFind_0.2.0/`; this installation's local override is essential.

To run this existing installation:

1. Open the XAMPP Control Panel and start **Apache** and **MySQL**.
2. Open the login URL above using HTTP.
3. Use the existing local demo account information described in [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md); the private generated receipt is `storage/setup/demo-accounts.json`.

This PHP installation runs through Apache, its rewrite rules and protected page gateway. Opening an HTML template with `file://` describes the separate academic template, not this workflow.

Runtime prerequisites: Apache with rewrite and the required `.htaccess` overrides; PHP 8.2 with mysqli/mysqlnd, mbstring, fileinfo, GD (JPEG/PNG/WebP) and sessions; MariaDB/InnoDB. jQuery 3.7.1 and Bootstrap 5.3.8 are shipped locally in `vendor/`. Node/Python/browser automation are development tooling, not website startup requirements.

Configuration and database files establish the intended connection; this guide is not evidence that services are currently running. The documentation handoff does not include a new live SQL export. Existing schema/reference seed and private historical backups have different purposes.

## 2. Source map

Paths below are relative to the project root.

| Location | Responsibility |
|---|---|
| `.htaccess` | Rewrite the root and thirteen `.html` routes to `page.php`; deny internal/runtime/evidence/dependency directories and dotfiles; asset cache revalidation |
| `page.php`, `app/routes.php` | Allowlisted page routing, session/role guards, template rendering and safe return URLs |
| `app/pages/` | Actual HTML templates, BM page and shared navigation partial |
| `css/` | Shared, auth, Student and BM styling |
| `js/api.js` | In-memory session/CSRF state, same-origin fetch and API error handling |
| `js/shell.js`, `js/student-common.js` | Shared navigation, feedback, formatting and Student helpers |
| `js/theme.js`, `css/theme.css` | Early client-side theme selection, shared light/dark surface roles and page-frame/gutter tokens; no server preference or schema change |
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
| `api/register.php` | Enabled/local guest Student creation; CSRF and independent rate limit |
| `api/account.php` | Own profile, avatar and password changes |
| `api/avatar.php` | Authenticated current-avatar delivery |
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
| `register.html` | Enabled/local guests register; otherwise login redirect; authenticated users return to their role landing |
| `browse.html`, `item.html` | Signed-in Student/BM discovery and report details |
| `report.html`, `claim.html`, `my-reports.html` | Student reports, ownership claims and personal activity |
| `admin.html?tab=claims`, `?tab=reports`, `?tab=handover` | BM operational queues and decisions |
| `history.html`, `notifications.html` | Signed-in archive and own notifications |
| `profile.html`, `settings.html` | Signed-in own account |

There are two stored roles: `STUDENT` and `BUILDING_MANAGEMENT`. Security, Student Service, owner and finder do not add auth roles in this version. Menus assist navigation; backend/page guards enforce permission.

## 5. Database and filesystem

The v0.2.5 baseline schema has **14 tables, 2 views and 25 foreign keys**. The isolated [Visual Search feature](VISUAL_SEARCH.md) adds one derived photo-index table and one foreign key. Canonical schema is [database/schema.sql](../database/schema.sql); [DATA_DICTIONARY.md](DATA_DICTIONARY.md) and [schema-contract.json](schema-contract.json) describe its contract.

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
- `storage/avatars/`: private prepared profile images, visible to signed-in users through the avatar endpoint.
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

The authoritative commands and safety boundaries are in [INSTALLATION_AND_RELEASE.md](INSTALLATION_AND_RELEASE.md#local-qa-and-ci); actual run outcomes are in [RELEASE_READINESS_AUDIT.md](RELEASE_READINESS_AUDIT.md). Historical checkpoint PASS totals are not release-readiness results.

Offline PHP/JS syntax, focused ESLint, PHPStan level 5 and `python tools/test-release.py` require no running website/database. Development dependencies are locked in package/composer lockfiles; no Node/Python/Composer dependency is introduced into the application's HTTP request path.

`python tools/prepare-test.py` first validates the existing sibling's ownership marker, resolved paths, `_test` configuration and session isolation. It preserves existing configuration and runtime files, synchronizes source, then runs setup only on the isolated test database. New fixture commands and all current regression runners repeat a fail-closed isolation check. Never run preparation/setup against the main installation.

With Apache/MariaDB running, `node tools/run-qa.cjs` runs focused security coverage, the six workflow regression suites sequentially in both themes, then layout/theme/Appearance and a QA-only login smoke. A fresh pending claim covers BM draft/confirmation preservation without using a populated main account. Release theme/Appearance tools reject `--main`; the smoke defaults to owned QA. New evidence directories preserve earlier attempts and remain ignored/protected through tracked Apache rules.

`tools/fingerprint.php` performs read-only data/schema/config/secret/media hashing and emits no raw records or secret contents. It can establish and compare main fingerprints without main-app HTTP login or session writes. A failed database connection is NOT RUN, never an unchanged-data proof.

`tools/profile-queries.php` measures list-projection statement counts using owned QA records; matching's database-specific advisory lock and ascending parent locks remain unchanged unless separately verified. Browser QA needs Playwright, Sharp and axe; recording requires Playwright FFmpeg. Existing `REFIND_*` overrides remain supported alongside shared runtime discovery.

Disposable Compose CI uses Apache/PHP 8.2, MariaDB 10.11, browser automation, synthetic accounts/media and a second empty database service for recovery. It publishes no ports and mounts no host runtime/database data. Private runtime files and SQL backups are excluded from artifacts. Physical-device, native tab suspension, screen-reader and battery/thermal checks remain manual. Existing [MVP visual evidence](MVP_VISUAL_FINISH_REPORT.md) retains its historical scope.

## 8. Existing documentation and known drift

- [B01_BLUEPRINT.md](B01_BLUEPRINT.md): initial architecture and traceability, reconciled through B06; read later v0.2.5 changes with it.
- [SOURCES_AND_DECISIONS.md](SOURCES_AND_DECISIONS.md): original scope and subsequent decisions.
- [diagrams/README.md](diagrams/README.md): editable draw.io sources and exports. FC03/FC04/FC05 were not regenerated for v0.2.5 withdraw/release.
- [wireframes/index.html](wireframes/index.html): conceptual design references, distinct from tested UI screenshots.
- [INSTALLATION_AND_RELEASE.md](INSTALLATION_AND_RELEASE.md): installation/package history. B06/UX01 release ZIPs predate the latest source; older `/ReFind_0.2.0/` links are not this installation's effective URL.
- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md#source-register): primary academic sources, provenance and page-number convention.

Physical custody history, separate security/Student Service accounts, campus SSO and automated retention/disposal are not implemented by the present schema/routes. See [REQUIREMENTS_AND_ROADMAP.md](REQUIREMENTS_AND_ROADMAP.md) before treating later UX proposals as existing capability.

UI/profile development uses a separate worktree and Docker project; see [its environment and migration guide](UI_PROFILE_ENHANCEMENTS.md). Do not use the existing QA sibling for this branch’s local verification.
