# ReFind v1.0.0 cutover runbook: `/refind/` (main) and `/refind-test/` (QA)

Prepared and **executed on 15 November 2026**: main moved at 09:42–09:47 and QA at 09:47–09:50 (local time), with both old URLs blocked and verified backups in `C:\ReFind-Backups`. Sections 5 and 6 record the procedure as it was run, including the fixes found on the day; reuse them for future moves. Every step that changes the live installations needs the owner's explicit go-ahead. Background and readiness: [V1_RELEASE_CANDIDATE.md](V1_RELEASE_CANDIDATE.md).

## 1. Before and after

| | Before (until 15 Nov 2026) | After the cutover |
|---|---|---|
| Main (real data) | `C:\xampp\htdocs\ReFind_0.2.3` → `/ReFind_0.2.3/`, session `refind_020`, sign-up on, photo search off, v0.2.5 code | `C:\xampp\htdocs\refind` → `/refind/`, session `refind_v1`, same settings, v1.0.0 code |
| QA (synthetic corpus) | `C:\xampp\htdocs\ReFind_0.2.0_Test` → `/ReFind_0.2.0_Test/`, session `refind_020_test`, photo-search pilot (1 allowlisted Student, key file), scheduled indexer | `C:\xampp\htdocs\refind-test` → `/refind-test/`, session `refind_test`, same pilot settings, v1.0.0 code |
| Databases | `refind_db_0_2_0`, `refind_db_0_2_0_test` on MariaDB 3306 (Windows service `mysql`) | **Unchanged names, no migration**: the v1.0.0 schema is byte-identical to today's 15-table contract |
| Disposable test target | `C:\xampp\htdocs\refind-v1-rc` → `/refind-v1-rc/`, `refind_db_v1rc_test` | Keep for automated suites that write data (`REFIND_TEST_PROFILE=v1-rc`); never point them at `/refind-test/` |

Code support already on the branch: `visual_enabled()`, `assert_qa_installation()` and `visual-index-task-launcher.cs` accept exactly one extra identity, `refind-test` + `/refind-test/` + `refind_test` + `refind_db_0_2_0_test` + the sibling ownership marker (`2c4f4d6`, unit-tested). `/refind/` needs no code change and can never enable photo search.

## 2. Go / no-go gates (before cutover day)

1. PR #8 integration CI green on the final commit, then reviewed and merged into `main`; tag the merge commit (e.g. `v1.0.0`). Use that tag below as `<TAG>`.
2. Optional but recommended: one uninterrupted local `run-qa.cjs` pass on the tag (`REFIND_TEST_PROFILE=v1-rc REFIND_QA_STAGE_PAUSE_SECONDS=45`).
3. Decide: keep sign-up on for `/refind/` (today's main has it on); session names as above; how to block the old URLs (section 5, step 9).
4. Do **not** combine with the MariaDB LTS upgrade; do that as its own change before or after.
5. Pick a window with no users; tell anyone using the app.

## 3. Rehearsal (safe, any time)

Restore proof on a copy, from the candidate worktree (read-only on the source, writes only a scratch database it drops):

```powershell
cd C:\xampp\htdocs\refind-v1-rc
& C:\xampp\mysql\bin\mysqldump.exe --host=127.0.0.1 --user=root --single-transaction --routines --triggers --skip-add-drop-table --result-file=$env:TEMP\rc.sql refind_db_v1rc_test
python tools\verify-restore.py --dump $env:TEMP\rc.sql --source-db refind_db_v1rc_test
Remove-Item $env:TEMP\rc.sql
```

Rehearsed 15 Nov 2026: 15 tables, 512 rows, all counts and checksums matched, scratch dropped.

## 4. Pre-flight on cutover day (read-only)

```powershell
Get-Service mysql                                  # Running, Automatic
cd C:\xampp\htdocs\ReFind_0.2.3;     php tools\check-database.php; php tools\check-workflow.php   # 9/9, 18/18
cd C:\xampp\htdocs\ReFind_0.2.0_Test; php tools\check-database.php; php tools\check-workflow.php   # 9/9, 18/18
cd C:\xampp\htdocs\ReFind_0.2.3;     php tools\fingerprint.php > C:\ReFind-Backups\main-fingerprint-before.json
```

Record record counts (users, items, claims, handovers, item_photos, claim_photos, notifications, history; QA embeddings READY).

## 5. Main → `/refind/` (CUTOVER DAY; executed 15 Nov 2026)

1. **Pause writes.** XAMPP's `apache_stop.bat` is broken (it still contains an unreplaced `@@BITROCK_INSTALLDIR@@` installer placeholder), so stop Apache by ending its processes. MySQL keeps running as a service; main receives no writes until step 9.
   ```powershell
   Get-Process httpd | Stop-Process -Force
   Remove-Item C:\xampp\apache\logs\httpd.pid -ErrorAction SilentlyContinue
   ```
2. **Back up the deployment** (private SQL, storage, local config, receipt). Run the tool that lives in the folder being backed up; on 15 Nov that was `ReFind_0.2.3`, from now on it is `refind`:
   ```powershell
   cd C:\xampp\htdocs\ReFind_0.2.3
   python tools\backup-project.py --writes-paused        # prints the backup folder under storage\setup\backups\
   New-Item -ItemType Directory C:\ReFind-Backups -Force
   Copy-Item -Recurse <printed folder> C:\ReFind-Backups\
   ```
   Keep `C:\ReFind-Backups` outside `htdocs` and outside Git.
3. **Prove the backup restores:**
   ```powershell
   cd C:\xampp\htdocs\refind-v1-rc
   python tools\verify-restore.py --backup-dir C:\ReFind-Backups\<folder> --source-db refind_db_0_2_0   # must print "passed": true
   ```
   On 15 Nov the first attempt returned an empty table list and failed closed; an immediate re-run passed every check. The tool now reports an empty table list as an explicit error. Re-run once; stop if it fails again.
4. **Create the checkout** at the release tag (detached, from the shared repository):
   ```powershell
   git -C C:\xampp\htdocs\refind-v1-rc fetch v025 --tags
   git -C C:\xampp\htdocs\refind-v1-rc worktree add --detach C:\xampp\htdocs\refind <TAG>
   ```
5. **Configure it** from main's private config, changing only the URL and session (validated, refuses to overwrite):
   ```powershell
   php C:\xampp\htdocs\refind\tools\derive-config.php C:\xampp\htdocs\ReFind_0.2.3 C:\xampp\htdocs\refind /refind/ refind_v1
   ```
   From Git Bash prefix `MSYS_NO_PATHCONV=1`, otherwise `/refind/` is rewritten into a Windows path and validation refuses it.
6. **Copy private media and auth state, then create an empty sessions folder** (old sessions are not copied; without the folder every page returns 500):
   ```powershell
   foreach ($d in 'items','evidence','claims','avatars','auth','setup') {
     robocopy C:\xampp\htdocs\ReFind_0.2.3\storage\$d C:\xampp\htdocs\refind\storage\$d /E /COPY:DAT /XD backups }
   New-Item -ItemType Directory -Force C:\xampp\htdocs\refind\storage\sessions
   ```
   Robocopy exit codes below 8 mean success.
7. **Verify offline:**
   ```powershell
   cd C:\xampp\htdocs\refind; php tools\check-database.php; php tools\check-workflow.php    # 9/9, 18/18, 0 missing/orphan media
   php tools\fingerprint.php > C:\ReFind-Backups\main-fingerprint-refind.json             # "tables" and "schema_sha256" identical to before; private_files differs only because the config changed
   ```
8. **Block the old URL before Apache starts**, so two copies never write to the same database. Back up `C:\xampp\apache\conf\extra\httpd-xampp.conf`, append, and run `C:\xampp\apache\bin\httpd.exe -t` (must print `Syntax OK`):
   ```apache
   <Directory "C:/xampp/htdocs/ReFind_0.2.3">
       AllowOverride None
       Require all denied
   </Directory>
   ```
   `AllowOverride None` is required: without it the old folder's own `.htaccess` `Require` rule overrides the deny.
9. **Start Apache and verify online.** Start it as an independent process (or from the XAMPP Control Panel):
   ```powershell
   Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine='C:\xampp\apache\bin\httpd.exe'; CurrentDirectory='C:\xampp\apache'}
   ```
   `/refind/login.html` and `/refind/api/session.php` return 200, the old URL returns 403, the session cookie is `refind_v1` with path `/refind/`, and the owner signs in with real Student and BM accounts.

## 6. QA → `/refind-test/` (CUTOVER DAY; executed 15 Nov 2026)

1. **Check the indexer has no queued work, then disable it** (re-enabling with pending rows would call the paid provider):
   ```powershell
   & C:\xampp\mysql\bin\mysql.exe --host=127.0.0.1 --user=root refind_db_0_2_0_test -e "SELECT status, COUNT(*) FROM item_photo_embeddings GROUP BY status"
   Disable-ScheduledTask -TaskName 'ReFind Visual Search QA'
   ```
2. **Pause QA without taking main down:** append the same `<Directory>` block for `C:/xampp/htdocs/ReFind_0.2.0_Test`, run `httpd.exe -t`, then restart Apache (stop as in 5.1, start as in 5.9). Main is unavailable for a few seconds.
3. **Back up QA and prove it restores.** From v1.0.0 deployments run `python tools\backup-project.py --writes-paused` inside `C:\xampp\htdocs\refind-test` (it now accepts the QA database and includes the ownership marker). The legacy QA folder had no copy of the tool, so on 15 Nov an equivalent snapshot was taken into `C:\ReFind-Backups\qa-before-20261115-094758`. Then `verify-restore.py --backup-dir <folder> --source-db refind_db_0_2_0_test`.
4. **Create the checkout:** `git -C C:\xampp\htdocs\refind-v1-rc worktree add --detach C:\xampp\htdocs\refind-test <TAG>`.
5. **Configure it:** `php C:\xampp\htdocs\refind-test\tools\derive-config.php C:\xampp\htdocs\ReFind_0.2.0_Test C:\xampp\htdocs\refind-test /refind-test/ refind_test` (keeps the test database, photo-search flag, allowlist, key file and timeout; the key file stays outside `htdocs`).
6. **Ownership marker** (source must be the sibling main checkout; git-ignored):
   ```powershell
   # UTF-8 without a byte-order mark (Windows PowerShell's Set-Content -Encoding utf8 adds one, which json_decode rejects)
   [IO.File]::WriteAllText('C:\xampp\htdocs\refind-test\.refind-b02-test.json', '{"source": "C:\\xampp\\htdocs\\refind", "scope": "owned isolated QA"}')
   ```
7. **Copy storage and create the sessions folder** exactly as in 5.6 (this carries `visual-calibration.json`, the demo receipts and the old launcher builds).
8. **Rebuild both launchers for the new folder, repoint and re-enable the task:**
   ```powershell
   $csc='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'; $setup='C:\xampp\htdocs\refind-test\storage\setup'
   & $csc -nologo -target:winexe "-out:$setup\visual-index-task-quiet.exe" C:\xampp\htdocs\refind-test\tools\visual-index-task-launcher.cs
   & $csc -nologo -target:exe "-out:$setup\visual-index-task.exe" C:\xampp\htdocs\refind-test\tools\visual-index-task-launcher.cs
   $a = New-ScheduledTaskAction -Execute "$setup\visual-index-task-quiet.exe" -WorkingDirectory 'C:\xampp\htdocs\refind-test'
   Set-ScheduledTask -TaskName 'ReFind Visual Search QA' -Action $a; Enable-ScheduledTask -TaskName 'ReFind Visual Search QA'
   Start-ScheduledTask -TaskName 'ReFind Visual Search QA'   # last result 0; refind-test\storage\setup\visual-index-last.json updates
   ```
9. **Verify:** in `refind-test`, `check-database.php` 9/9 and `check-workflow.php` 18/18; record counts unchanged (15 Nov: 101 reports, 81 READY embeddings); `php tools\qa-guard.php C:\xampp\htdocs\refind-test` prints `{"qa_isolated":true}`; signed in as the allowlisted synthetic Student the session reports `visual_search_enabled: true` and any other Student `false`; the cookie is `refind_test` with path `/refind-test/`; the old QA URL returns 403.

## 7. Rollback

| Situation | Action |
|---|---|
| Before any new writes on `/refind/` | Remove the Apache deny for the old folder, restart Apache, stop using `/refind/`. The old folder and database were never modified. |
| New records exist on `/refind/` | The database is shared and the schema identical, so pointing users back to `/ReFind_0.2.3/` keeps all records. Copy new uploads back first: `robocopy C:\xampp\htdocs\refind\storage\<d> C:\xampp\htdocs\ReFind_0.2.3\storage\<d> /E /XC /XN /XO` for items/evidence/claims/avatars. Never restore an older SQL dump over legitimate new records. |
| Database damaged | Restore the verified dump into the original name only after stopping Apache, and only after confirming with `verify-restore.py` against the dump; reconcile any records created after the backup by hand. |
| QA problems | Disable the task, remove the old-URL deny, repoint the task to the old `visual-index-task-quiet.exe` in `ReFind_0.2.0_Test`, re-enable. |

## 8. After acceptance (separate approvals)

- Retire the old folders only after a waiting period; keep `C:\ReFind-Backups` with its receipts.
- Remove the legacy `ReFind_0.2.0_Test` identity from `visual_enabled()`/`qa-guard.php` in a later release once nothing depends on it.
- Keep `/refind-v1-rc/` (or a renamed disposable target) for automated suites that write data; the persistent QA corpus is not a mutation target.
- Plan the MariaDB LTS move (logical dump/restore to a new service on another port, verified with the same checks).
