# Installation, production requirements and recovery — ReFind v0.2.5

This is the current operational guide. Existing B06/UX01 archives and acceptance reports are historical checkpoints. The release branch preserves the visual finish at `8331d90`; app 0.2.5, local folder 0.2.3 and schema/database 0.2.0 labels remain intentional. The original release-readiness changes did not migrate the schema. The subsequent profile-picture enhancement adds nullable users.avatar_path through a recognized, repeatable upgrade; see [XAMPP integration](XAMPP_INTEGRATION.md).

## Existing installation

For registration, follow [normal local signup](LOCAL_SIGNUP.md), with the whole ReFind directory restricted to loopback. It defaults to disabled/local-only. Main acceptance is guest-only; account creation and workflow mutations stay in disposable QA.


Use `http://localhost/ReFind_0.2.3/login.html` after starting Apache/MySQL. Preserve `app/config.local.php`, database `refind_db_0_2_0`, and all private storage. Never use setup, seeding or match refresh as a connection check. The read-only CLI schema/workflow checks do not initialize anything.

## Fresh XAMPP installation

Use a genuinely new installation/server. Do not perform these steps over existing application records or runtime files.

1. Clone the v0.2.5 repository at the reviewed release commit into a folder matching the configured URL base. PHP 8.2 requires mysqli/mysqlnd, mbstring, fileinfo, GD (JPEG/PNG/WebP) and sessions. Apache needs rewrite, authorization and the applicable `.htaccess` overrides.
2. Create ignored `app/config.local.php` returning supported keys from `app/config.php`. Set the database host/port/account/password and `/folder/` base path; the application currently accepts only `refind_db_0_2_0` or `refind_db_0_2_0_test`. Folder/database names do not need a version-driven rename. Protect this file and retain it across upgrades.
3. Only on the fresh destination, run `php tools/setup-db.php`. It creates the 14 tables, two views, reference rows and local authentication/storage state. Nonempty databases without matching ownership receipts are rejected.
4. For a classroom demonstration, run `php tools/setup-demo.php`; optionally add `seed-student-demo.php` and `seed-expanded-demo.php`. The generated credential receipt is private. These optional synthetic data tools are not production account provisioning.
5. Run `php tools/check-database.php` and `php tools/check-workflow.php`, then verify role-specific login and private-media denials. Do not claim fresh-install acceptance until those checks have actually passed.

Runtime storage comprises `items`, `evidence`, `claims`, `avatars`, `auth`, `sessions` and `setup`. A code clone has neither current database records nor these ignored files. Never connect a second independently writable media directory to the same live database.

## Production requirements — deployment remains manual

- Use maintained OS, Apache, PHP and MariaDB patches. CI targets PHP 8.2 and MariaDB 10.11; this does not certify every hosting platform. PHP 8.2 security support ends 31 December 2026, so budget a separately tested runtime upgrade. MariaDB 10.4 community maintenance ended 18 June 2024; the existing local XAMPP binaries must not be treated as a production image. [PHP support policy](https://www.php.net/supported-versions.php), [MariaDB maintenance policy](https://mariadb.org/about/#maintenance-policy).
- Enforce HTTPS at the chosen host, canonical host allowlisting and an appropriate HSTS policy after validating TLS. Verify actual `Secure`, `HttpOnly` and `SameSite` cookie attributes. The application derives HTTPS from server state and ignores client-supplied forwarded headers.
- For a reverse proxy, restrict backend access to the trusted proxy, strip incoming forwarded headers, normalize the HTTPS server state, and explicitly configure trusted client-IP handling. Otherwise all users may share the proxy's throttle bucket, or an unsafe server configuration may permit spoofing. Do not globally trust forwarded headers. [Apache mod_remoteip guidance](https://httpd.apache.org/docs/2.4/mod/mod_remoteip.html).
- Use a dedicated runtime database account limited to SELECT/INSERT/UPDATE/DELETE on this application's schema. Use a separate, temporary provisioning account for schema creation. Do not expose MariaDB publicly or use the development root/blank-password defaults in production.
- Keep source/configuration read-only to the web account; allow necessary writes only in private runtime directories. Deny direct HTTP access to internal code, SQL, storage, tools, release archives, dotfiles, development dependencies and generated evidence. Preserve the tracked `.htaccess` rules or equivalent virtual-host rules and verify actual 403 responses before opening access.
- Disable PHP error display; retain protected server/error logs with restricted access and a retention policy. Avoid credentials, raw session values, private clues and evidence in logs or monitoring. Monitor repeated 500s, auth 429s, storage exhaustion and database lock conflicts; investigate without automatic mutation replay.
- Keep the existing same-origin CSP and private/no-store API responses. Do not relax script policy to preserve a hosting shortcut. Validate assets, uploads, request/body limits and fonts under the deployed headers.
- The file-backed limiter, PHP sessions and private media assume one coordinated host/filesystem. Multi-node scaling and shared/distributed throttling require separate design and load testing. Confirm real account provisioning, pickup desk contact, campus access/privacy policy, backup ownership and operational support before a real campus pilot. Research proposals such as SSO, additional roles and automatic disposal remain out of scope.

No server configuration, production credentials, database upgrade, repository permission or deployment is changed by this guide.

## Backup and recovery

1. Pause application writers for the full backup window, including other copies, scheduled tasks and BM/Student writes. A transactional SQL dump alone cannot make later filesystem reads consistent with concurrently deleted media.
2. Create a new private backup destination, never reuse an existing backup. `python tools/backup-project.py --writes-paused` exports the main SQL and archives private storage plus local configuration; it does not modify main records. This existing XAMPP helper requires `mysqldump.exe` and the configured database account. Do not run it just to test connectivity.
3. Protect the SQL, ZIP and SHA-256 receipt as sensitive data. Restrict access, encrypt/off-site copy according to the chosen hosting policy, and retain a tested copy of matching application code. The backup contains credentials, auth state and private evidence; never commit or publish it.
4. Restore only into a separate empty server/database and new private media directory. Verify the destination identity before importing SQL; never restore over `refind_db_0_2_0` on the current main server. Preserve the original backup, receipts and credentials. Configure the recovered copy for its new host without overwriting the live configuration.
5. Compare table/schema and media hashes, run schema/workflow checks, then verify authorized photo delivery and Student/BM workflows before any separately approved cutover. Keep sessions isolated; decide whether to invalidate restored sessions. Code rollback alone does not restore database/media consistency.

The CI recovery proof uses two disposable MariaDB services, the allowlisted `_test` schema on each, synthetic accounts/media and an empty restore destination. It refuses a populated destination and keeps private dumps outside uploaded artifacts. Its result is evidence about that synthetic restoration, not proof of the operator's production backup process.

## Local QA and CI

Install development dependencies with Node 24+, Python 3.11+ and Composer; use `npm ci --ignore-scripts` and `composer install`. The existing oversized-image fixture also needs Pillow in the QA Python environment (installed in the disposable image). Install matching browser/encoder binaries with `npx playwright install chromium ffmpeg`; Windows may use installed Chrome through runtime discovery. Local PHP CLI ZIP support is needed for Composer extraction; `php -d extension=zip composer.phar install` can enable the existing extension for that invocation without changing PHP configuration.

Offline gates: `npm run check:js`, `npm run lint`, `composer analyse`, `python tools/test-release.py`, PHP syntax and Git whitespace checks. CI scans all reachable history with Gitleaks 8.30.1 and fully redacted output. The only allowlist covers verified checksum lines in two historical manifests. Actions and container images are pinned; review and refresh them regularly. [GitHub Actions security guidance](https://docs.github.com/en/actions/reference/security/secure-use).

For local behavioral testing, start Apache/MariaDB, inspect the owned sibling marker and configuration, then run `python tools/prepare-test.py` followed by `node tools/run-qa.cjs`. Preparation never overwrites an existing local override; guards reject the main database, shared paths and sessions. Back up QA runtime data before deliberately changing its setup. Mutation suites run sequentially, in both themes. After an Appearance-only dependency failure, `node tools/run-qa.cjs --appearance-only` reruns Appearance and smoke with a fresh fixture; its receipt explicitly identifies the subset and must be combined with the earlier full-matrix results. Reusing an existing evidence run name is refused. The release runner creates and cleans only its own visual fixture and stores evidence in a fresh ignored directory. It uses no main-app HTTP requests.

Runtime overrides: `REFIND_PHP`, `REFIND_CHROME`, `REFIND_PLAYWRIGHT_MODULE`, `REFIND_SHARP_MODULE`, `REFIND_AXE_MODULE`, existing theme/evidence settings, and a validated `REFIND_QA_RUN` evidence name. New QA configuration may take `REFIND_QA_DB_HOST`, `REFIND_QA_DB_PORT`, `REFIND_QA_DB_USER`, `REFIND_QA_DB_PASSWORD`; these do not replace an existing override.

Disposable Linux verification, requiring Docker Desktop/Engine:

```text
docker compose -f compose.qa.yml up --build --detach --wait
docker compose -f compose.qa.yml exec -T qa python3 tools/prepare-test.py
docker compose -f compose.qa.yml exec -T qa chown -R www-data:www-data /var/www/html/ReFind_0.2.0_Test /var/www/html/ReFind_0.2.3/output
docker compose -f compose.qa.yml exec -T --user www-data qa python3 tools/test-disposable-recovery.py
docker compose -f compose.qa.yml exec -T --user www-data qa node tools/run-qa.cjs
```

The Compose services have no host database/runtime mounts and publish no ports. After reviewing/exporting synthetic receipts, stop only this named disposable project with `docker compose -f compose.qa.yml down --volumes --remove-orphans`. Do not reuse that cleanup command for another installation.

GitHub Actions uploads only synthetic test receipts/captures for seven days. Real local screenshots, SQL, credentials, session/throttle files and backup archives remain excluded. Record PASS, FAIL and NOT RUN separately; physical Safari/iOS/Android, touch, keyboard/screen-reader use and battery/thermal performance remain manual checks.

For the approved Docker-free local integration and new isolated staging profile, use [XAMPP_INTEGRATION.md](XAMPP_INTEGRATION.md). Preserve the existing QA installation; do not prepare it as part of this staging workflow.
