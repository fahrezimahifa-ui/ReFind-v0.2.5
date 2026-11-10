# ReFind Visual Search

Visual Search helps a Student find reports when a photo is easier to provide than a description. It returns **Possible Visual Matches**. Building Management verifies ownership through the existing claims workflow.

## Data flow

1. An approved QA Student opts in when adding new public report photos. ReFind commits the photo and a pending index row together. Private ownership photos, claim evidence, and avatars are outside this flow.
2. The background worker reads an eligible photo, verifies its SHA-256 and storage path, and re-encodes it as JPEG to remove metadata. PHP sends just that JPEG to Gemini over HTTPS and stores its unit-normalized 768-value vector as little-endian float32 in MariaDB.
3. A search uses one temporary JPG or PNG and the current structured Explore filters. The query vector stays in memory. PHP computes cosine similarity as the dot product of unit vectors, keeps the highest score per report, and applies the frozen validation cutoff. The browser receives ordinary card fields and authorized photo URLs.
4. Replacing or deleting a report photo cascades to its embedding row. Indexing status on My Activity is visible to the approved report owner.

Hosted multimodal embeddings fit the existing PHP stack. Self-hosted CLIP would add model deployment and inference infrastructure. Conventional object detection identifies classes and bounding boxes, while this task compares whole item photos. V1 uses pure cosine. Image-only queries carry no keyword weight.

## Isolated Windows QA

The source baseline is `5b6bcdd`. The feature defaults off and requires the owned `ReFind_0.2.0_Test` application, `_test` database, isolated session configuration, and an explicit list of synthetic Student IDs. Keep QA loopback-only. Keep the main checkout, database, uploads, and accounts separate.

From the feature worktree, point QA tooling at the owner checkout and sync the sources. This preserves the ownership marker and local override. Check the ownership guard before any write. Use the dedicated migration on an existing QA database that has a ready pre-Visual Search receipt. On a fresh disposable installation use the existing setup and synthetic demo account tools.

~~~powershell
$env:REFIND_QA_OWNER_ROOT = 'C:\xampp\htdocs\ReFind_0.2.3'
python tools/prepare-test.py --sync-only
$qa = 'C:\xampp\htdocs\ReFind_0.2.0_Test'
& C:\xampp\php\php.exe "$qa\tools\qa-guard.php" $qa
& C:\xampp\php\php.exe "$qa\tools\migrate-visual-search.php"
& C:\xampp\php\php.exe "$qa\tools\check-database.php"
~~~

Set these options only in the ignored QA `app/config.local.php`. The IDs must come from the private QA demo account receipt.

- `visual_search_enabled` set to true
- `visual_search_students` set to the approved synthetic Student IDs as integers
- `visual_search_key_file` set to the absolute path of an ACL-restricted private file outside Apache's document root, with only the key on one line. Alternatively inject `GEMINI_API_KEY` into both PHP process environments.
- `visual_search_student_per_minute` and `visual_search_calls_per_minute` default to 6 and 20. Lower them for the provider project's actual limits.

Restrict the key file to the QA operator and the Apache runtime identity as needed. Keep credentials out of the repository, chat, shell arguments, and captures. Google can use unpaid service inputs for product improvement and human review. Use only authorized nonsensitive demo assets and confirm the applicable terms, billing and quotas before live calls. [Gemini data terms](https://ai.google.dev/gemini-api/terms) · [Project quotas](https://ai.google.dev/gemini-api/docs/rate-limits)

~~~powershell
& C:\xampp\php\php.exe "$qa\tools\index-visual-photos.php" --probe 'C:\private\approved-probe.jpg'
& C:\xampp\php\php.exe "$qa\tools\index-visual-photos.php" --status
~~~

## Automatic indexing and recovery

Qualify one launcher in the running QA installation. First try Task Scheduler under the existing signed-in QA operator. In Task Scheduler, use **Run only when user is logged on**, a once trigger that repeats every minute indefinitely, and the action below. Enable **Run task as soon as possible after a scheduled start is missed**, cap runtime at 55 seconds using the task settings, and set **Do not start a new instance**.

~~~text
Program   C:\xampp\php\php.exe
Arguments "C:\xampp\htdocs\ReFind_0.2.0_Test\tools\index-visual-photos.php" --drain
Start in  C:\xampp\htdocs\ReFind_0.2.0_Test
~~~

If Scheduler cannot register or run reliably, start the included fallback once during each signed-in QA session.

~~~powershell
& "$qa\tools\visual-index-loop.ps1"
& "$qa\tools\visual-index-loop.ps1" -Stop
~~~

Check `--status` for queue counts, sanitized failure reasons, and the latest worker tick. The fallback also records its launcher status in private QA storage. Qualify automatic processing by creating a cleared report through the Student form, checking that its photo moves from pending to searchable without invoking the CLI, and repeating after a QA database restart. The worker drains up to five jobs per minute under one database-scoped lock. Transient errors retry after one and five minutes. Quota delays honor `Retry-After` or use 15 minutes. After correcting a terminal failure, run `--retry PHOTO_ID` and let the launcher drain it. Manual `--drain` is available for recovery.

## Audit and backfill

Use a private manifest for positively identified disposable QA report photos. Start with `report_id` and `photo_id` entries. Run `--audit MANIFEST` to collect hashes, missing-file findings, and possible duplicates. Review the suggestions and the actual photos on their authorized report pages. Use distinct item photos that match their report descriptions. Record the hash and reason for each decision, and record the source and approval for each inclusion.

~~~json
{
  "photos": [
    {
      "report_id": 101,
      "photo_id": 151,
      "sha256": "<SHA-256 of the approved original bytes>",
      "decision": "include",
      "source": "Operator-approved independent photograph",
      "approved": true,
      "reason": "Cleared public item photo"
    }
  ]
}
~~~

Run `--dry-run MANIFEST`, then `--backfill MANIFEST`. Only listed and approved public photos can be enqueued. Use `exclude` and the recorded hash to remove a previously indexed disposable photo from the derived index. Its report and upload remain available. Re-add it through a revised, cleared manifest if appropriate. Omit unindexed missing files when no hash can be verified. The manifest and assets remain private.

## Calibration and held-out evaluation

Prepare separate six-report pilot galleries with four targets and two distractors in each. For each gallery collect four independently photographed views of the target objects, four distinct look-alike objects, and ten visually irrelevant objects. Keep validation, held-out and demo objects disjoint. Use separate existing campus area filters to isolate each gallery. Prepare JPG or PNG queries at no more than 250 KB and 1,200 pixels per side. Keep each query photo next to its private manifest.

~~~json
{
  "split": "validation",
  "filters": { "location_id": 37 },
  "gallery": [
    { "report_id": 101, "photo_id": 151, "sha256": "<gallery photo SHA-256>" }
  ],
  "queries": [
    { "group": "same_object", "expected_ids": [101], "image": "view-b.jpg", "sha256": "<query photo SHA-256>" },
    { "group": "lookalike", "expected_ids": [101], "image": "lookalike.jpg", "sha256": "<query photo SHA-256>" },
    { "group": "irrelevant", "expected_ids": [], "image": "unrelated.jpg", "sha256": "<query photo SHA-256>" }
  ]
}
~~~

After gallery indexing, run `calibrate-visual-search.php --calibrate VALIDATION_MANIFEST` in the QA copy. It checks exact gallery membership, compares candidate cutoffs and freezes the winner under `storage/setup/visual-calibration.json`. It maximizes same-object Hit`5 under the 10% visually irrelevant return cap, with MRR, fewer irrelevant returns, and the lower cutoff breaking ties. Look-alikes are tracked separately. If no cutoff qualifies, search stays unavailable.

Use `held_out` as the split for the independent test manifest. From the feature worktree run the held-out browser evaluation twice with distinct private receipt paths.

~~~powershell
node tools/evaluate-visual-search.cjs 'C:\private\held-out.json' 'C:\private\live-run-1.json'
node tools/evaluate-visual-search.cjs 'C:\private\held-out.json' 'C:\private\live-run-2.json'
~~~

The receipt records raw counts, same-object Hit`1, Hit`5 and MRR, visually irrelevant false positives, look-alike returns and ranks, browser latency, and provider errors. Repeated queries measure reliability. The 20-positive expanded gates are proposed benchmarks and require their own untouched final held-out set. After a missed gate, retain the evidence and diagnose using validation data. Preserve old receipts before recalibrating.

For each of two live demo runs, submit a new approved report, confirm background indexing within 120 seconds with a clear queue, retrieve it using a separate capture of the object, follow the actual report link, and demonstrate rejection of an irrelevant photo. Verify login, keyword search, reports and claims separately. Disable the flag and stop the QA launcher to roll back. Leave original media and the additive table in place.

## Verification status

The 10 November 2026 rehearsal used disposable Windows Apache and MariaDB processes on dedicated loopback ports. The main XAMPP application and its database were outside the rehearsal.

- PHPStan, PHP and JavaScript syntax checks, and focused ESLint passed.
- The disposable fresh schema, upgrade from the pre-feature receipt, and repeat migration passed. The index, exclusion, retry, and browser checks passed with a mock Gemini transport in light mobile and dark desktop configurations.
- Existing authentication, Student, Building Management, and v0.2.5 suites passed 103 scenario groups, followed by the workflow invariant checks.
- A temporary Scheduled Task invoked the guarded worker. The PowerShell fallback independently completed two automatic ticks. Both reported missing project configuration. These runs verified invocation, while processing and recovery with Gemini still require the approved live pilot.

- `php tools/test-visual-search.php` checks cosine, ranking, rejection, validation-only calibration, image preparation, and provider error mapping without Gemini.
- `node tools/test-visual-search.cjs` requires a disposable Apache and MariaDB stack with an explicit nonstandard database port and an empty test index. For this test stack only, point Apache `auto_prepend_file` at `tools/test-visual-http-prepend.php` and set `REFIND_VISUAL_DISPOSABLE_DB_PORT` in Apache and the test runner. This fixture exercises real browser, API, SQL and upload paths with a deterministic provider. The fixture file is excluded from ordinary QA sync.
- The configured Gemini project and independent photo pilot remain unverified. There are no live retrieval or accuracy measurements.
