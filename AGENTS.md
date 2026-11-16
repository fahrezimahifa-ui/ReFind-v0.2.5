# ReFind development context

ReFind is one UMN campus Lost & Found product developed across **IS556 Web Design and Development (WDD)** and **IS301 User Experience (UX)**. This workspace contains the **PHP/MariaDB application**, developed through v0.2.5 and released as **v1.0.0**. The similarly versioned serverless WDD submission template is a separate artifact.

## Read first

1. [Product context and research](docs/PROJECT_CONTEXT.md): what ReFind is, why it exists, evidence boundaries, and the three reference reports.
2. [Current architecture and local operation](docs/ARCHITECTURE.md): source map, routing, database/storage, configuration, and verification commands.
3. [Requirements and proposed roadmap](docs/REQUIREMENTS_AND_ROADMAP.md): implemented behavior versus research proposals and unresolved decisions.
4. [v0.2.5 change report](docs/V025_REPORT.md) and [workflow contract](docs/WORKFLOW_CONTRACT.md) before changing business rules.
5. [v1.0.0 release record](docs/V1_RELEASE_CANDIDATE.md) for per-feature sources, the isolated `v1-rc` QA profile, test results and release criteria, and the [cutover runbook](docs/CUTOVER_RUNBOOK.md) for moving to `/refind/` and `/refind-test/`.

Consult [role/API contracts](docs/ROLE_ROUTE_MATRIX.md), [data dictionary](docs/DATA_DICTIONARY.md), and [decision history](docs/SOURCES_AND_DECISIONS.md) for deeper work. Earlier batch reports describe their historical checkpoint; later v0.2.5 updates supersede older behavior.

## Workspace identity

All working copies live in `C:\xampp\htdocs\` and are worktrees of **one** git repository. Check what a folder runs with `git -C <folder> log -1`. Tag `v1.0.0` (15 Nov 2026 cutover, [runbook](docs/CUTOVER_RUNBOOK.md)) is the baseline; later reviewed merges on `v025/main` are deployed on top of it.

| Folder | Role | URL / database |
|---|---|---|
| `refind` | **Main, real data.** Detached worktree; never edit in place. | `http://localhost/refind/`, session `refind_v1`, `refind_db_0_2_0` |
| `refind-test` | **QA:** persistent synthetic corpus and photo-search pilot; the "ReFind Visual Search QA" task runs its `storage\setup\visual-index-task-quiet.exe`. Detached worktree; never edit in place. | `http://localhost/refind-test/`, session `refind_test`, `refind_db_0_2_0_test` |
| `refind-v1-rc` | Disposable target for mutation and browser suites (`REFIND_TEST_PROFILE=v1-rc`). Detached worktree. | `http://localhost/refind-v1-rc/`, `refind_db_v1rc_test` |
| `refind-dev` | Development worktree for feature branches. Its local config targets a Docker setup, so XAMPP does not serve it; verify changes through `refind-v1-rc`. | none |
| `ReFind_0.2.3` | Retired main, denied in Apache, kept for rollback. **It also holds the shared `.git` for every worktree above: never delete, move or clean it.** | denied |
| `ReFind_0.2.0_Test` | Retired QA, denied in Apache, kept for rollback. | denied |
| `refind-xampp-stage`, `ReFind_0.2.0_Fresh_*` | Old staging and fresh-install test copies, not part of the current setup. Leave them unless the owner asks. | not maintained |

- GitHub: remote `v025` (`fahrezimahifa-ui/ReFind-v0.2.5`) is the live repository; base all work on `v025/main`. Remote `origin` is the older `ReFind-v0.2.0` repository, and the local `main` branch is stale.
- Each deployment keeps its URL, session and flags in its ignored `app/config.local.php` and its private media/auth state in its ignored `storage/`. The Apache deny blocks are in `C:\xampp\apache\conf\extra\httpd-xampp.conf`; verified pre-cutover backups are in `C:\ReFind-Backups`.
- MariaDB 3306 runs as the Windows service `mysql`. Database names keep their 0.2.0 labels; a version or URL change does not imply a database migration.
- Runtime: Apache/XAMPP, PHP 8.2 with mysqli/mysqlnd, mbstring, fileinfo, GD (JPEG/PNG/WebP) and sessions, MariaDB; frontend HTML/CSS/JS with local jQuery/Bootstrap.

## Change and deploy flow

1. Branch from `v025/main` in `refind-dev` (or a fresh worktree). Never commit in `refind`, `refind-test` or `refind-v1-rc`.
2. Verify on `refind-v1-rc`: `git -C C:\xampp\htdocs\refind-v1-rc checkout --detach <commit>`, then run the relevant suites from that folder (see Verification).
3. Push the branch to `v025` and open a pull request against `main`. The GitHub CLI is not installed; use the repository's compare page. The owner reviews and merges.
4. Deploy only a reviewed tag or merge commit on `v025/main`. Note each folder's current commit first (rollback is checking it out again). Run `git -C C:\xampp\htdocs\refind-test checkout --detach <commit>` and smoke-test it: guest redirect, login page, the changed behavior, MariaDB up. Then do the same for `C:\xampp\htdocs\refind`. A checkout changes tracked source files only; data stays in MariaDB and the ignored `storage/`.
5. A change that alters the schema needs its own migration plan and a verified backup first (see the [runbook](docs/CUTOVER_RUNBOOK.md)); a checkout alone never migrates a database.

## Local hazards

- **The shared MariaDB server hosts other, unrelated projects, and one of them has a damaged InnoDB table.** Any query that makes MariaDB open every table on the server stops the whole server, taking `/refind/` down with it. Examples: an `information_schema` join without its own schema filter on each joined table, or tools that list every database's tables. Before running a new metadata query, `EXPLAIN` it: the Extra column must say `Scanned 0 databases` or `Scanned 1 database`, never `Scanned all databases`. ReFind's own setup and test scripts are safe from commit `6ed1089` on, which includes all current `main`.
- Starting or restarting the `mysql` service needs administrator rights: the XAMPP Control Panel run as administrator, or an elevated `Start-Service mysql`. Apache runs as a plain process, not a service, so start it from the XAMPP Control Panel after a reboot.
- Bootstrap enables smooth scrolling (`scroll-behavior: smooth`) unless the user prefers reduced motion. Browser checks of scroll or focus positions must let scrolling settle (at least 800 ms) or emulate reduced motion. Measuring mid-animation produces false failures.

## Working conventions

- Follow the current procedural PHP, prepared-SQL, shared-template and same-origin API patterns. Keep changes consistent with surrounding code.
- Treat actual code/schema/configuration as evidence of implemented behavior; use the reports for product intent and research. Official briefs govern the relevant academic submission. Record discrepancies instead of assuming a report's future-tense statement describes this workspace.
- Preserve existing records and uploaded files. Main application data lives in MariaDB **and** private `storage/items`, `storage/evidence`, and `storage/claims` collections. A clone alone omits ignored local configuration and runtime files.
- Use existing configuration to open this installation. Setup/seeding scripts initialize or modify state; they are not connection checks for an already populated database.
- Keep local credentials, auth secrets, session payloads and private backups out of tracked documentation and command output.
- Keep research proposals as proposals until they are part of the requested development task. Security and Student Service are real-world stakeholders; the implemented auth roles remain `STUDENT` and `BUILDING_MANAGEMENT`.
- Existing editable design/architecture diagrams use draw.io. Check the documented B06-to-v0.2.5 gaps before regenerating diagrams.

## Business rules to preserve

- Rule-based matches suggest candidates; a score is not ownership probability. BM makes the ownership decision.
- Maintain server-side session, role, ownership, CSRF, input/file validation and private-media authorization boundaries.
- One approved owner per Found item, one confirmed pair per Lost/Found report, and one handover per claim. Related updates remain transactional with fresh-state checks.
- `NEED_MORE_INFO` and `WITHDRAWN` claims can be resubmitted using the same record when eligible. `REJECTED` is final for that claimant/item.
- Cancelling a pickup **schedule** retains approved ownership. Releasing a pickup closes the claim and makes eligible reports available again. Confirming physical return is a separate operation.
- Preserve internal status codes and their user-facing labels. `HANDOVER` means Ready for pickup; `RESOLVED` means Returned. Never retrieved does not establish a disposal policy.
- Use campus time `Asia/Jakarta` for event/schedule presentation and UTC for audit/scheduled timestamps; preserve unknown event times as null.

## Verification

Choose checks that exercise the changed behavior. PHP/JS syntax checks do not require starting the website; API/browser suites do.

Mutation suites run against the disposable `refind-v1-rc` worktree (`REFIND_TEST_PROFILE=v1-rc`, database `refind_db_v1rc_test`, provisioned by `tools/prepare-v1rc.py`) or the CI container, never against `/refind/` or the persistent `/refind-test/` corpus. The legacy `tools/prepare-test.py` flow targets the retired `ReFind_0.2.0_Test` sibling. Browser smoke/login checks also write session/throttle state. See the commands and prerequisites in [ARCHITECTURE.md](docs/ARCHITECTURE.md#verification-and-tooling).

Separate historical recorded test results from checks run for the current task. Keep source links and implemented/proposed labels current when updating these guides.
