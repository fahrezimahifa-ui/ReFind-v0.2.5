# Installation & release — ReFind 0.2.0 B06 (updated v0.2.5)

v0.2.5 needs no database migration. Clone the repository into a folder whose name matches `base_path` (default `/ReFind_0.2.0/`), or set `base_path` in `app/config.local.php`. The optional `pickup_desk_*` keys set the pickup desk shown to students. Existing demos can recompute match suggestions with `tools/refresh-matches.php` (back up first). See [V025_REPORT.md](V025_REPORT.md).

## Fresh XAMPP installation

1. Extract latest `ReFind_0.2.0_UX01.zip` so the application is at `C:\xampp\htdocs\ReFind_0.2.0`. Historical B06 ZIP remains a separately verified checkpoint.
2. Start Apache (HTTP80) and MySQL/MariaDB (3306). PHP8.2 needs mysqli/mysqlnd, mbstring, fileinfo and sessions. No Node/Python is required to run the website or create the demo dataset.
3. If host/port/user/password/path differs, create protected `app/config.local.php` returning only supported keys from `app/config.php`. For another folder set `base_path` to that folder's `/name/`. The app only allows its own main/test DB names. Schema remains 14 tables/2 views.
4. Open PowerShell with the application as working directory and execute separately:

```powershell
& "C:\xampp\php\php.exe" "tools/setup-db.php"
& "C:\xampp\php\php.exe" "tools/setup-demo.php"
& "C:\xampp\php\php.exe" "tools/seed-student-demo.php"
& "C:\xampp\php\php.exe" "tools/seed-expanded-demo.php"
& "C:\xampp\php\php.exe" "tools/check-database.php"
& "C:\xampp\php\php.exe" "tools/check-workflow.php"
```

5. Read the locally generated credentials from `storage/setup/demo-accounts.json`. Log in at `http://localhost/ReFind_0.2.0/login.html`.

The installation creates Student A, Student B and BM; synthetic demo records are generated through real report/claim/review/pickup functions. Expected initial dataset:40 reports,12 claims,6 handovers,40 public illustrations,20 Lost evidence illustrations and12 claim proof illustrations. Dates/pickup times are relative to installation; all operational outcomes are simulated classroom scenarios.

Setup/seeding is idempotent and keeps existing passwords/edited/deleted bookmarked examples. Initial expansion accepts only its original bookmarked demo records or exact recoverable synthetic identities; unrelated existing reports stop initial seeding. For an existing site, preserve SQL and storage together before making changes. See [database guide](../database/README.md).

## Editable academic artefacts

Open `.drawio` sources in diagrams.net; individual nodes, relationships, connectors and wireframe components are editable. Final sitemap/ERD/FC01–FC06/UF01/AF01 sources and PNG/PDF exports are in `docs/diagrams/`. Editable conceptual wireframes are in `docs/wireframes/sources/`. Actual tested UI screenshots are in `docs/verification/b06/`.

Optional regeneration tooling uses Python/Pillow/PyMuPDF, Graphviz, Node/Playwright and Chrome; overrides are documented in [diagram guide](diagrams/README.md). The actual SQL in this package is sufficient for final diagram generation; the original baseline ZIP is not required. Recording-enabled development QA also needs Playwright FFmpeg; this is a QA dependency, not an application runtime requirement.

## Packaging & verification

`python tools/build-release.py --batch UX01` generates the latest archive/external checksum manifest in `releases/`. `python tools/verify-fresh-install.py --batch UX01` writes an exact-archive acceptance receipt after successful verification. Both tools support `--batch B06` for the historical edition. Setup tools, licensed prepared photos/local vendor and `.htaccess` are included; local/runtime private data and mutation helpers are excluded.

Fresh-install QA extracts the archive into a new owned XAMPP folder and initializes a separate MariaDB datadir/server on localhost3307. It uses the allowlisted `_test` DB name on that isolated server, so the existing3306 main/test databases are retained. The fresh server is stopped after verification; fresh QA folders are labelled and preserved for inspection. Evidence is in `docs/verification/b06/fresh-install-results.json` after execution.
