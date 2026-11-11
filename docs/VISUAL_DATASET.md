# Reproducible Visual Search QA corpus

This corpus is synthetic campus report data illustrated by individually licensed internet photographs. It is **QA-only**. It does not describe real losses, claims, ownership decisions, or campus returns. Main installation data is never imported or replaced by these tools.

## Contents and evidence boundaries

`tools/visual-demo-sources.json` pins 138 source assets, their Commons source revisions, authors, licenses, prepared image hashes, object-group annotations and roles. `tools/visual-demo-live-sources.json` independently prepares the professor-demo pair and one additional no-target scene. Runtime photographs, accounts, report IDs and evaluation receipts stay in ignored private storage.

| Cohort | Gallery reports | Separate queries | Campus-area filter |
|---|---:|---|---|
| Validation pilot | 10 | 4 same-object, 4 look-alike, 10 visually irrelevant | 35 / Gedung A |
| Held-out pilot | 10 | 4 same-object, 4 look-alike, 10 visually irrelevant | 36 / Gedung B |
| Larger browsing/discovery set | 60 | No independent accuracy claim | 37 / Gedung C |
| Workflow demonstrations | 20 | Not in the visual index | 38 / Gedung D |
| Live professor demonstration | New Student reports | One separate reference/query pair, repeated for reliability | 39 / Parkiran; matching searches can include the full eligible index |

The 100 seed reports contain 100 distinct prepared item images across the six existing active categories. Some images depict a set of belongings. The workflow cohort creates 20 claims through the real business functions: five approved, four needing more information, four rejected, three withdrawn and four pending. Five resulting handovers demonstrate pending, scheduled/rescheduled, cancelled-schedule and completed states. No fabricated ownership-evidence images are added.

The eight positive pairs are separate photographs in named, dated photographer product/session series, checked for consistent physical details. They are not crops, renamed files or AI-generated alternate views. The reference/query pair for the demonstration is separate from both pilot splits. Source-session identity is supporting evidence, not an independent certification of ownership or physical custody.

Studio photographs, close object views, and fruit/nature no-target queries have substantial domain bias. Results apply to this small controlled pilot. They do not establish performance on campus photographs or on a 100-item gallery. The expanded 20-positive-per-split academic gates remain unevaluated until a fresh, suitably photographed held-out set is available. Repeating the frozen queries is reliability evidence only.

## Source review and preservation

Sources are Wikimedia Commons files with CC0, explicit PD-self release, CC BY or CC BY-SA licenses. Each file is checked individually. Attribution and license links remain in the source catalog and generated `credits.html`; distribute these credits with any redistributed prepared assets, retaining applicable share-alike terms. Sources can be removed or changed upstream: a hash mismatch requires a reviewed dataset revision, not silent replacement.

Preparation applies EXIF orientation, resizes to at most 1,000 pixels per side, strips metadata and writes JPEGs of at most 250 KB. Reproduction was qualified with Python 3.13 and Pillow 12.2.0. Up to three source downloads run concurrently, with bounded retries. Contact sheets and SHA-256/dHash review precede import. The initial review excluded portraits/faces, readable personal cards, unrelated scenes, disassembly/medical imagery and a second view of the same wooden pencil case. Original candidate files were retained privately; no genuine report or upload was changed.

The old `seed-student-demo.php` / `seed-expanded-demo.php` illustrations are not an accuracy corpus. Their crops and repeated stock subjects must stay outside the visual backfill allowlist. On a QA installation containing legacy data, identify disposable fixtures using their original receipts, run `index-visual-photos.php --audit`, review contact sheets and use explicit `exclude` decisions for repeated/unsuitable derived vectors. Preserve report records and original files.

## Reproduce in owned native QA

Run from the `codex/visual-search` worktree. Existing QA configuration and credentials remain local. The ownership guard must pass before imports, migrations or browser writes.

```powershell
$env:REFIND_QA_OWNER_ROOT = 'C:\xampp\htdocs\ReFind_0.2.3'
python tools/prepare-test.py --sync-only
$qa = 'C:\xampp\htdocs\ReFind_0.2.0_Test'
& C:\xampp\php\php.exe "$qa\tools\qa-guard.php" $qa
python tools/prepare-visual-corpus.py tools/visual-demo-sources.json storage/visual-corpus/final
& C:\xampp\php\php.exe "$qa\tools\seed-visual-demo.php" --import "$PWD\storage\visual-corpus\final\corpus.json"
& C:\xampp\php\php.exe "$qa\tools\seed-visual-demo.php" --status
python tools/build-visual-evaluation.py storage/visual-corpus/final/corpus.json "$qa\storage\setup\visual-demo.json"
```

Review the contact sheets and local credits before importing a revised corpus. Keep the existing synthetic account passwords in `storage/setup/demo-accounts.json`; never copy them into documentation or commands. Keep the Gemini key in the already configured external private key file; these tools do not accept a key argument.

An interrupted import resumes from its private journal. A completed rerun verifies fingerprints and creates no additional records. If a fixture was edited, import/rollback refuses to overwrite it. `--rollback` checks the recorded IDs, record fingerprints and file hashes, then removes only those fixtures and their derived media/index rows. Accounts and unrelated data are retained. Preserve the receipt and photographs when keeping evaluation evidence; do not reset setup or run legacy seeds over the corpus.

## Indexing, calibration and live checks

The scheduled task **ReFind Visual Search QA** runs the existing GUI launcher every minute. Its PHP child has no console and shares the database lock and call budget with maintenance drains. Initial backfill may use bounded CLI maintenance drains, recorded separately from automatic-indexing evidence. A new normal Student report must still become searchable through the scheduled launcher without a manual drain.

TLS setup on the actual QA network exceeded the original two-second connection allowance during initial backfill. The connection allowance is five seconds. A later browser request finished TLS promptly but received no provider response before the eight-second total deadline. A validation-only diagnostic with a 20-second QA allowance completed that request in 10.8 seconds. The source default remains eight seconds; ignored native QA configuration sets `visual_search_timeout_seconds=20`, strictly bounded to 2–20 seconds. The worker starts a job only when its full configured allowance fits inside its 44-second budget, preserving the silent launcher's 50-second process limit. Actual latency must still be reported against the proposed eight-second p95 gate. Original QA configuration was backed up privately before the change. Do not disable TLS verification or bypass the call budget.

Once both pilot galleries are READY:

```powershell
& C:\xampp\php\php.exe "$qa\tools\calibrate-visual-search.php" --calibrate "$PWD\storage\visual-corpus\final\validation.json"
node tools/evaluate-visual-search.cjs storage/visual-corpus/final/held_out.json storage/visual-corpus/held-out-run-1.json
node tools/evaluate-visual-search.cjs storage/visual-corpus/final/held_out.json storage/visual-corpus/held-out-run-2.json
python tools/prepare-visual-corpus.py tools/visual-demo-live-sources.json storage/visual-corpus/live-assets
node tools/test-visual-live.cjs storage/visual-corpus/live-assets/corpus.json storage/visual-corpus/live-demo.json
```

Use the project's installed Playwright dependency (or set `REFIND_PLAYWRIGHT_MODULE` to its existing module directory). Calibration is paced at no more than six calls per minute, uses validation only, and retains its full score matrix separately from the small runtime threshold receipt. A missing/incompatible cutoff keeps search unavailable. Held-out verification checks frozen gallery membership and image hashes against validation before browser evaluation.

Receipts report planned, attempted and successful queries by class, API errors, Hit@1/5, MRR and latency. Incomplete API runs cannot be presented as complete accuracy results. Keep failed runs. The browser runner leaves budget headroom for ordinary QA use, records Retry-After and timestamps, and preserves the actual application limits. The most recent transport timing is retained privately in `storage/setup/visual-provider-last.json`, excluding headers, keys, images and response bodies. Diagnose with validation data; a new accuracy claim after recalibration needs a fresh held-out set. Numerical expanded targets are proposed gates, not guaranteed model performance.

The live demonstration creates two normal opted-in reports, polls their index state for at most 120 seconds, searches with the independent view, follows the exact report link and submits an unrelated nature query. The first report is deleted normally before creating the second so it does not become a duplicate candidate. The second remains for browser inspection. Quota, timeout and unavailable UI response injections are explicitly recorded separately from live Gemini calls.

## Promotion boundary

Keep the large dataset, its accounts, media and evaluation receipts in QA. Integration into the newest local application follows acceptance review and a private database/media/configuration backup. Provider activation for genuine users remains a separate decision. Push source, the public source catalog, credits/methodology and sanitized aggregate results; never push keys, database dumps, runtime photographs or private receipts.
