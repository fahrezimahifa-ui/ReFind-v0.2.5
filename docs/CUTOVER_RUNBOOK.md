# ReFind v1.0.0 cutover runbook: `/refind/` (main) and `/refind-test/` (QA)

Prepared 15 November 2026 on `release/v1.0.0-candidate`. **Nothing in this runbook has been executed.** Every step marked **CUTOVER DAY** changes the live installations and needs the owner's explicit go-ahead at that time. Background and readiness criteria: [V1_RELEASE_CANDIDATE.md](V1_RELEASE_CANDIDATE.md).

## 1. Today and target

| | Today | Target |
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

## 5. Main → `/refind/` (CUTOVER DAY)

1. **Pause writes.** Stop Apache in XAMPP (MySQL keeps running as a service). From here until step 8 no browser traffic reaches ReFind.
2. **Back up main** (private: SQL, storage, local config, receipt):
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
   Stop here if it fails.
4. **Create the stable checkout** at the tag (detached, from the shared repository):
   ```powershell
   git -C C:\xampp\htdocs\refind-v1-rc fetch v025 --tags
   git -C C:\xampp\htdocs\refind-v1-rc worktree add --detach C:\xampp\htdocs\refind <TAG>
   ```
5. **Configure it.** Copy main's private config and change only the URL and session:
   ```powershell
   Copy-Item C:\xampp\htdocs\ReFind_0.2.3\app\config.local.php C:\xampp\htdocs\refind\app\config.local.php
   # edit: 'base_path' => '/refind/', 'session_name' => 'refind_v1'   (keep database, sign-up, pickup desk values)
   ```
6. **Copy private media and auth state** (not sessions):
   ```powershell
   foreach ($d in 'items','evidence','claims','avatars','auth','setup') {
     robocopy C:\xampp\htdocs\ReFind_0.2.3\storage\$d C:\xampp\htdocs\refind\storage\$d /E /COPY:DAT /XD backups }
   ```
7. **Verify offline:**
   ```powershell
   cd C:\xampp\htdocs\refind; php tools\check-database.php; php tools\check-workflow.php    # 9/9, 18/18, 0 missing/orphan media
   php tools\fingerprint.php > C:\ReFind-Backups\main-fingerprint-refind.json             # "tables" and "schema_sha256" identical to before; private_files differs only because the config changed
   ```
8. **Start Apache and verify online:** open `http://localhost/refind/login.html`, sign in with an existing Student and the BM account, open a report with a private ownership photo as BM, open My Activity, check Settings shows the released version label (bump `1.0.0-rc.1` in a commit before tagging).
9. **Block the old main URL immediately** so two write-active copies never share `refind_db_0_2_0` with different media folders. Recommended: an Apache rule outside the repositories, e.g. in `C:\xampp\apache\conf\extra\httpd-xampp.conf`:
   ```apache
   <Directory "C:/xampp/htdocs/ReFind_0.2.3">
       Require all denied
   </Directory>
   ```
   then restart Apache. The old folder and its files stay untouched for rollback.

## 6. QA → `/refind-test/` (CUTOVER DAY, after main is accepted)

1. **Disable the indexer task** (it runs every minute against the old folder):
   ```powershell
   Disable-ScheduledTask -TaskName 'ReFind Visual Search QA'
   ```
2. Stop Apache; back up QA the same way (`mysqldump` of `refind_db_0_2_0_test` + a zip of its `storage\` and `app\config.local.php`) into `C:\ReFind-Backups\qa-<date>\`, then `verify-restore.py --dump ... --source-db refind_db_0_2_0_test`.
3. Create the QA checkout: `git -C C:\xampp\htdocs\refind-v1-rc worktree add --detach C:\xampp\htdocs\refind-test <TAG>`.
4. Config: copy `ReFind_0.2.0_Test\app\config.local.php` and change only `'base_path' => '/refind-test/'`, `'session_name' => 'refind_test'` (keep the test database, photo-search flag, allowlist, key file, limits, timeout). The key file must stay outside `htdocs`.
5. Ownership marker (source must be the sibling stable checkout):
   ```powershell
   # UTF-8 without a byte-order mark (Windows PowerShell's Set-Content -Encoding utf8 adds one, which json_decode rejects)
   [IO.File]::WriteAllText('C:\xampp\htdocs\refind-test\.refind-b02-test.json', '{"source": "C:\\xampp\\htdocs\\refind", "scope": "owned isolated QA"}')
   ```
6. Copy `storage\{items,evidence,claims,avatars,auth,setup}` from `ReFind_0.2.0_Test` with `robocopy` as in section 5 (this carries `visual-calibration.json` and demo receipts).
7. Recompile the indexer launcher for the new folder and repoint the task:
   ```powershell
   $csc='C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
   & $csc -nologo -target:winexe -out:C:\xampp\htdocs\refind-test\storage\setup\visual-index-task-quiet.exe C:\xampp\htdocs\refind-test\tools\visual-index-task-launcher.cs
   $a = New-ScheduledTaskAction -Execute 'C:\xampp\htdocs\refind-test\storage\setup\visual-index-task-quiet.exe' -WorkingDirectory 'C:\xampp\htdocs\refind-test'
   Set-ScheduledTask -TaskName 'ReFind Visual Search QA' -Action $a
   ```
8. Verify: `php tools\check-database.php` / `check-workflow.php` in `refind-test` (9/9, 18/18), record counts equal to QA's (101 reports, 81 READY embeddings at the 14 Nov audit), `php tools\qa-guard.php C:\xampp\htdocs\refind-test` prints `{"qa_isolated":true}`, and signed in as the allowlisted Student the session reports `visual_search_enabled: true`. No provider call is needed to verify.
9. Start Apache, block `/ReFind_0.2.0_Test/` like step 5.9, then `Enable-ScheduledTask -TaskName 'ReFind Visual Search QA'` and confirm `storage\setup\visual-index-last.json` updates.

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
