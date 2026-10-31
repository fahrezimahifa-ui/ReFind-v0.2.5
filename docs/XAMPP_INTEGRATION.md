# ReFind 0.2.5: local XAMPP integration

This follow-up integrates the UI/profile feature branch into the existing local application at `http://localhost/ReFind_0.2.3/index.html`. GitHub main remains a separate review decision. The application version remains **0.2.5**.

## Existing installation

Keep the main `refind_db_0_2_0` database on port3306, `/ReFind_0.2.3/`, `refind_020`, existing account password hashes, auth secret and uploaded media. Do not copy Docker test accounts, credentials or database records into main. The additive upgrade adds nullable `users.avatar_path` and private `storage/avatars`; the existing receipt must be recognized before setup can proceed. Never run demo seeding during this upgrade.

Before cutover, pause application writers and create a matching private SQL/source/runtime/configuration backup. Backups and checksum receipts live outside Apache under the operator's private local application-data directory. A local-only safety commit preserves the pre-existing documentation and ignore-file changes. Integrate into the existing checkout branch without pushing that safety commit.

GD is required for server-side avatar decoding/re-encoding. On this XAMPP installation the existing GD extension was enabled after backing up php.ini. Apache runs as a console process, so its service restart command does not apply ([Apache Windows documentation](https://httpd.apache.org/docs/2.4/platform/windows.html)); restart the verified XAMPP Apache instance and verify GD through HTTP as well as CLI. Main MariaDB must remain running throughout that runtime change.

If migration or acceptance fails, keep writers paused and restore the matching source, SQL, storage and local configuration snapshot before reopening. An application-code rollback alone is insufficient. Preserve newer runtime evidence for diagnosis.

## Docker-free staging

From the `refind-dev` feature worktree on Windows:

```powershell
python tools/xampp-stage.py init
$env:REFIND_TEST_PROFILE = 'xampp-stage'
php C:/xampp/htdocs/refind-xampp-stage/tools/setup-db.php
php C:/xampp/htdocs/refind-xampp-stage/tools/setup-demo.php
```

Use the installed XAMPP PHP binary explicitly if it is not on PATH. `init` refuses an existing destination/state or occupied port3311. The new `refind-xampp-stage` directory uses a separate MariaDB datadir/server on loopback3311, a dedicated account, `_test` schema, `/refind-xampp-stage/`, private storage and `refind_xampp_stage` sessions. Its ignored ownership/state files contain local identities and credentials. The guard rejects port3306, main URLs/sessions and redirected storage before fixture mutations. Existing legacy QA remains untouched.

`python tools/xampp-stage.py sync` updates source only after ownership validation and preserves local configuration/runtime. `start` and `stop` verify the server's actual port and datadir before acting. Mutating tests run with `REFIND_TEST_PROFILE=xampp-stage`; `node tools/run-qa.cjs` exercises the same suites through XAMPP. Existing `REFIND_*` dependency overrides may point to already installed read-only host tooling. Legacy `prepare-test.py` remains prohibited from this feature worktree.

Rehearse the populated upgrade by importing a private main SQL snapshot into the guarded staging server, copying its matching media, and adapting only the copied receipt's database identity. Preserve the stage-specific configuration/auth/session boundaries. Verify all original columns/records and password hashes, existing media, repeated setup and workflow invariants before main cutover.

## Visual changes

The avatar editor, discovery cards, activity cards and standalone empty states share the established glass panel/popup tokens. Nested BM queue cards, comparison blocks and pickup summaries use translucent inset materials without repeated backdrop filters. Private clues retain their warm semantic tint; selected states, fields and primary actions retain contrast. Opaque fallbacks cover unsupported blur, reduced transparency and forced colors.

Application-authored browser-title separators use a middle dot, including dynamic item/BM titles. Sentence copy uses ordinary punctuation. User-entered report titles/descriptions and stored historical records are preserved.

## Verification and cleanup

Record current XAMPP results separately from the 30 October Docker results in `UI_PROFILE_ENHANCEMENTS.md`. All destructive fixtures belong to staging. Main acceptance uses the existing three accounts and checks navigation/media/schema without creating business fixtures.

After successful cutover, export and checksum the Docker development database and private runtime, then remove only `refind-ui-ux-dev` containers/volumes and exclusive images/cache. Cache records with an unproven owner remain intact. Keep the source worktree and rollback backups. Stop staging MariaDB after verification. Docker's internal free space and Windows filesystem allocation are different measurements; report actual results without assuming the virtual disk shrank.

## Current XAMPP verification: 31 October 2026

- Static gates: 43 PHP files, JavaScript/CJS syntax, ESLint, PHPStan level5, 15 offline safety tests and whitespace checks passed.
- The 24-stage matrix completed across retained runs `xampp-glass-20261031-r1`, `r2` and `r3`. Continuation receipts explicitly reference earlier passes. The first attempt retained two obsolete em-dash title expectations; the new material test initially opened Active reports rather than Claims. Those test assertions/routes were corrected, without weakening application behavior checks.
- Existing auth/account/Student/workflow/v0.2.5/UX coverage: 284 groups across both themes; projection12, security6, layout/feed21 and UI/profile12 passed. Schema and workflow/media invariants passed before and after.
- New glass/title coverage: eight groups, 16 captures and editor contrast samples; requested widths including1099/1100 and effective200%, both roles/themes, dynamic titles, inset blur limits and opaque accessibility fallbacks passed.
- Theme: 23 groups, 190 captures and 2,434 composited contrast samples. Appearance: 16 groups and 3,534 phase samples. No browser exceptions were recorded. Three synthetic accounts passed positive smoke with unchanged staging business/media fingerprints.
- A private copy of the main database/media passed populated upgrade, repeat upgrade and SQL/media recovery followed by re-upgrade. All14 original table-value hashes, 73 existing media files and the staging auth secret were preserved. Fresh setup was exercised before the matrix on the same isolated server.

Private current receipts are under ignored `output/playwright/release-readiness/results/xampp-glass-20261031-r3`, `output/playwright/xampp-rehearsal`, and `storage/setup/xampp-final-static.*`. Historical Docker results remain separately labelled. Main cutover and targeted Docker cleanup receipts remain with the operator's private backups; the draft PR records their final disposition.

The subsequent source-only [account-menu and layout polish](ACCOUNT_MENU_POLISH.md) uses the same guarded staging workflow without rerunning main setup or migrations.
