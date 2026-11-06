# ReFind v0.2.5

UMN campus Lost & Found, built with procedural PHP, MariaDB/InnoDB, local jQuery/Bootstrap and a mobile-first interface. Student reports, rule-based suggestions, private ownership claims, BM review, pickup and Returned history use server-side sessions and transactions.

The PHP application and the similarly versioned WDD serverless submission are separate artifacts. Read [product context](docs/PROJECT_CONTEXT.md) and [implemented requirements versus proposals](docs/REQUIREMENTS_AND_ROADMAP.md) before expanding scope.

## Existing local installation

- Workspace: `C:\xampp\htdocs\ReFind_0.2.3`.
- Login: [http://localhost/ReFind_0.2.3/login.html](http://localhost/ReFind_0.2.3/login.html).
- Main database: `refind_db_0_2_0`; isolated QA: `refind_db_0_2_0_test`.
- App 0.2.5, folder 0.2.3 and database 0.2.0 labels are intentional. The profile-picture enhancement adds one nullable avatar reference; follow the upgrade guide below.

Start Apache/MySQL in XAMPP and preserve the ignored local configuration, generated credentials and private media. **Do not rerun setup or seed tools to open an existing installation.** Account references are described in [DEMO_ACCOUNTS.md](docs/DEMO_ACCOUNTS.md); passwords live only in the protected local receipt.

## Current release work

Student self-registration defaults to disabled. See [registration scope and QA](docs/STUDENT_SELF_REGISTRATION.md) and [guarded local activation](docs/XAMPP_REGISTRATION_INTEGRATION.md). Activation requires exact-source QA, a private configuration rollback and forwarding clearance. No schema or runtime upgrade is included.


`codex/release-readiness` starts from `codex/mvp-visual-finish` (`8331d90`), preserving Manrope, glass panels, the 1160px frame, responsive navigation, both themes, Appearance preferences and ambient motion. The correct repository remote is `v025`, pointing to [ReFind-v0.2.5](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5); this workspace's `origin` points to the older v0.2.0 repository.

Release changes add validated configuration/error handling, stronger QA isolation, protected review output, pinned development tooling and disposable integration CI. See the [release audit and verification report](docs/RELEASE_READINESS_AUDIT.md) for actual results and remaining gates. Historical PASS totals are not current-run results.

## Install, operate and verify

Use the authoritative [installation, production requirements and recovery guide](docs/INSTALLATION_AND_RELEASE.md). [Architecture](docs/ARCHITECTURE.md), [role/API permissions](docs/ROLE_ROUTE_MATRIX.md), [workflow rules](docs/WORKFLOW_CONTRACT.md) and [data dictionary](docs/DATA_DICTIONARY.md) describe the application contracts.

Development tooling requires Node 24+, Python 3.11+ and PHP 8.2 with the listed extensions. It is not needed to serve the website.

```powershell
npm ci --ignore-scripts
composer install
npm run check:js
npm run lint
composer analyse
python tools/test-release.py
```

Mutation suites require the owned QA installation and running Apache/MariaDB. Preparation preserves existing QA configuration and runtime files; it refuses unsafe markers, paths, databases or sessions.

```powershell
python tools/prepare-test.py
node tools/run-qa.cjs
```

A separate disposable Docker environment runs fresh setup/recovery and full regression CI without mounting host databases or runtime files. Commands and prerequisites are in the installation guide. No automatic deployment or merge is configured.

## Historical evidence and assets

- [v0.2.5 workflow corrections](docs/V025_REPORT.md), [UX01](docs/UX01_REPORT.md), [UX02](docs/UX02_REPORT.md), and [B06](docs/B06_REPORT.md) retain their checkpoint-specific results.
- [MVP visual finish](docs/MVP_VISUAL_FINISH_REPORT.md), [layout/glass](docs/LAYOUT_GLASS_REPORT.md), [dark mode](docs/GLASS_DARK_MODE_REPORT.md), and [branding/font licenses](assets/README.md) document the preserved design.
- [Editable draw.io diagrams](docs/diagrams/README.md) include documented gaps relative to newer withdraw/release flows.
- Existing B06/UX01 ZIP manifests are historical artifacts. This release is delivered through the release branch and draft PR; they must not be advertised as new release archives.

## UI/profile integration and local XAMPP operation

Notification return navigation, equal desktop review panels, profile pictures, glass materials and title punctuation are described in [UI/profile enhancements](docs/UI_PROFILE_ENHANCEMENTS.md). Use the [XAMPP integration guide](docs/XAMPP_INTEGRATION.md) for the additive migration, GD prerequisite, Docker-free staging and current verification. Existing accounts, password hashes and private media are retained. The application remains 0.2.5.
