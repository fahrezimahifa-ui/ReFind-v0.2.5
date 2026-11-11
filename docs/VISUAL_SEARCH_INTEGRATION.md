# Local integration of QA-scoped Visual Search

The feature source and its additive embedding table can be installed in the existing local ReFind application while external image processing remains disabled there. The 100-report corpus, independent query sets, Gemini key configuration and indexing task remain in the owned QA installation. No QA records or embeddings are copied into the main database.

## Release boundary

The [measured pilot](VISUAL_SEARCH_QA_2026-11-11.md) found four of four positive queries at rank 1, but returned candidates for four of ten irrelevant queries and measured 15–17-second p95 latency. These quality/latency goals remain unmet. The user approved proceeding with local integration and publication with those limitations retained. This does not authorize default processing of genuine-user images or establish campus accuracy.

`visual_enabled()` still requires the owned QA directory, `_test` database, isolated session and explicit synthetic Student allowlist. The main local override is preserved; its effective feature flag is false and its Student allowlist empty. No main worker or Gemini key configuration is installed. A future main-image rollout requires a separate activation decision and qualification.

## Backup and additive upgrade

1. Verify the existing main checkout is clean, capture its source manifest and preserve its original branch/revision. Use a separate integration worktree to assemble the feature changes, preserving existing local-only source differences. Do not publish the old local history as part of the feature branch.
2. Pause HTTP writes only for `/ReFind_0.2.3/` during the short backup/cutover window, allow in-flight requests to finish, and verify the main data/media inventory is stable across the backup. Apache/MariaDB global configuration and unrelated applications are unchanged.
3. Run the existing `tools/backup-project.py --writes-paused` from the main checkout. It creates a new private `storage/setup/backups/release-before-...` SQL/storage/configuration snapshot and checksum receipt. Keep these files out of Git and do not print their contents. Preserve the matching original source revision.
4. Switch to the reviewed local integration branch. Preserve ignored configuration, accounts, auth secrets, sessions and uploads. Run the dedicated additive migration with the receipt from that backup:

```powershell
& C:\xampp\php\php.exe tools/migrate-visual-search.php --main-disabled --backup-receipt $backupReceiptPath --dry-run
& C:\xampp\php\php.exe tools/migrate-visual-search.php --main-disabled --backup-receipt $backupReceiptPath
& C:\xampp\php\php.exe tools/check-database.php
```

The main mode refuses any other root/database/port/session, an enabled feature or nonempty Student allowlist, redirected storage paths, an unrecognized baseline receipt, or backup files that differ from their private checksum receipt. It creates only `item_photo_embeddings` and updates the installation receipt. It never runs setup/seeding or rewrites an existing report/photo/account. A repeat is idempotent. Ordinary no-argument migration remains guarded to owned QA; `--dry-run` performs preflight without DDL or receipt updates.

5. Compare every original table and all existing private runtime files with the pre-cutover inventory, excluding only the intentionally updated installation receipt. Confirm the new table is empty and main Visual Search remains disabled. Restore the original application-local HTTP rules and perform guest-only main browser checks. No main report/claim/login POST is needed to prove data preservation.

## Publication and rollback

Publish the feature branch based on current GitHub `main`, with the measured QA report and a reviewable pull request. Keep any local-only integration history/differences local. Source and sanitized aggregate metrics may be published; runtime photographs, keys, SQL dumps, account receipts and backups must remain ignored.

To roll back local source, briefly pause main writes and return to the recorded original branch/revision and exact original configuration/HTTP rules. Preserve accounts/uploads and the additive derived table; do not restore an older SQL dump over legitimate later user activity. Retain the private backup and schema receipt for recovery/reapplication. Disabling the QA flag or task is a separate QA operation and is not required to keep main processing off.

Execution evidence is recorded separately from this procedure. The original QA report remains a historical measurement, including its failed gates and failed early runs.
