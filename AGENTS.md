# ReFind development context

ReFind is one UMN campus Lost & Found product developed across **IS556 Web Design and Development (WDD)** and **IS301 User Experience (UX)**. This workspace contains the **PHP/MariaDB application v0.2.5**. The similarly versioned serverless WDD submission template is a separate artifact.

## Read first

1. [Product context and research](docs/PROJECT_CONTEXT.md): what ReFind is, why it exists, evidence boundaries, and the three reference reports.
2. [Current architecture and local operation](docs/ARCHITECTURE.md): source map, routing, database/storage, configuration, and verification commands.
3. [Requirements and proposed roadmap](docs/REQUIREMENTS_AND_ROADMAP.md): implemented behavior versus research proposals and unresolved decisions.
4. [v0.2.5 change report](docs/V025_REPORT.md) and [workflow contract](docs/WORKFLOW_CONTRACT.md) before changing business rules.

Consult [role/API contracts](docs/ROLE_ROUTE_MATRIX.md), [data dictionary](docs/DATA_DICTIONARY.md), and [decision history](docs/SOURCES_AND_DECISIONS.md) for deeper work. Earlier batch reports describe their historical checkpoint; later v0.2.5 updates supersede older behavior.

## Workspace identity

- Local project: `C:\xampp\htdocs\ReFind_0.2.3`.
- Local login: `http://localhost/ReFind_0.2.3/login.html`.
- Effective local `base_path`: `/ReFind_0.2.3/`, set in ignored `app/config.local.php`.
- Main database: `refind_db_0_2_0` at `127.0.0.1:3306`; isolated QA database: `refind_db_0_2_0_test`.
- App version **0.2.5**, folder label **0.2.3**, and database label **0.2.0** are intentional. A version-label change does not imply a database migration.
- Runtime: Apache/XAMPP, PHP 8.2 with mysqli/mysqlnd, mbstring, fileinfo, GD (JPEG/PNG/WebP) and sessions, MariaDB; frontend HTML/CSS/JS with local jQuery/Bootstrap.

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

Mutation suites use the owned `ReFind_0.2.0_Test` sibling and `_test` database. `tools/prepare-test.py` writes that copy and runs its setup, so inspect its ownership marker and configuration before use. Browser smoke/login checks also write session/throttle state. See the commands and prerequisites in [ARCHITECTURE.md](docs/ARCHITECTURE.md#verification-and-tooling).

Separate historical recorded test results from checks run for the current task. Keep source links and implemented/proposed labels current when updating these guides.
