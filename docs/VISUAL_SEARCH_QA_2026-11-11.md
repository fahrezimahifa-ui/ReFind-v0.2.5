# Visual Search QA results — 11 November 2026

**QA is populated and usable with real Gemini embeddings. Rejection quality and response latency do not meet the proposed acceptance goals. Main installation/database changes, Git merges and pushes are on hold at the user's request.**

## Installed data and access

- Native QA: `C:\xampp\htdocs\ReFind_0.2.0_Test`, [login](http://localhost/ReFind_0.2.0_Test/login.html).
- 100 clearly labeled synthetic reports, each with a distinct reviewed licensed image; 20 claims and five handovers created through existing business functions.
- 80 allowlisted gallery images have genuine 768-dimensional `gemini-embedding-2` vectors. Twenty workflow fixtures are excluded from visual indexing. One additional normal Student demo report remains, giving 101 current reports and 81 READY vectors.
- Genuine reports, uploads and accounts in the main installation were not changed. Credentials remain local and outside Git. Initial native QA had no reports or claims.
- The source catalogs, provenance, reproduction/rollback commands and evidence limitations are in [VISUAL_DATASET.md](VISUAL_DATASET.md). Runtime photos, account receipts and full evaluation logs remain private and ignored.

## Frozen pilot evaluation

Validation and held-out galleries each contain ten reports, with four same-object queries, four different-object look-alikes and ten visually irrelevant queries. Photographs/objects are disjoint between splits; positive pairs have the documented source-session identity limitations. All thresholds used validation only. The selected cutoff is **0.7116861307**, frozen with the model, 768 dimensions, `jpeg-white-v1` preprocessing and the validation-manifest hash before held-out scoring. It was not changed after held-out results.

Validation returned the correct report first for 4/4 positive queries, no results for 10/10 irrelevant queries, and labeled visual candidates for 4/4 look-alikes. This did not generalize to the independent gallery's irrelevant queries.

| Measurement | Final run A | Final run B |
|---|---:|---:|
| Successful browser requests | 18/18 | 18/18 |
| Same-object Hit@1 | 4/4 | 4/4 |
| Same-object Hit@5 | 4/4 | 4/4 |
| Same-object MRR | 1.00 | 1.00 |
| Visually irrelevant false returns | 4/10 (40%) | 4/10 (40%) |
| Look-alike queries returning results | 2/4 | 2/4 |
| Labeled look-alike candidate ranks | 1, none, 2, none | 1, none, 2, none |
| Browser p50 | 4.153 s | 4.641 s |
| Browser p95 | 15.074 s | 17.445 s |
| API errors | 0 | 0 |

Both runs used the same frozen queries, cutoff and 20-second QA request allowance. Result IDs and ranks were identical. There are **four distinct positive queries**; repeated requests do not increase that sample. The expanded 20-positive academic gates are unevaluated. No Precision@5 claim is made.

The initial eight-second run is retained separately: 8/18 successful requests, six timeouts and four temporary-limit responses. Its successful subset is not a complete accuracy estimate. An initial demo also retrieved the correct new report but failed on a subsequent no-target request timeout; that failed receipt was preserved.

## What the failures imply

All four final false returns pointed to the same source asset, `item-027`, an outdoor photograph of sports sunglasses. The negative queries did not depict a matching item. Shared outdoor/background appearance is a plausible cause; this is an inference from the images and returned candidates, not a controlled causal experiment. We did not remove that gallery record, change labels, or tune the cutoff against held-out results.

Native transport evidence showed both TLS setup exceeding the original two-second connection allowance and a later request completing TLS in 0.45 seconds but waiting 10.5 seconds for the first provider byte. The connection allowance is now five seconds. The source total-timeout default remains eight seconds; ignored QA configuration uses a strictly bounded 20-second setting. Worker jobs start only when their complete allowance fits within the existing 44-second work budget and 50-second launcher limit. Rate limits remain six Student / twenty installation calls per minute. This improved completion reliability while **the proposed eight-second p95 goal still fails**.

Before a new accuracy claim, collect more representative validation scenes, including clutter/background confounders, and obtain a fresh untouched held-out set. Recalibration must use validation only. Preserve these failed quality results. Investigate provider latency separately; do not disguise it by reporting only successful or fastest requests. The current key can access the selected model; maximum project quotas/billing were not established from successful calls alone.

## Genuine end-to-end and fault checks

Two final browser demonstrations created fresh opted-in reports normally. The existing scheduled task indexed them in **10.3 and 41.9 seconds**, with PENDING observed first. There were no manual drains during either demonstration. Separate photographs retrieved the new reports from the full eligible catalog, the exact result links opened the correct report, and the independent no-target demo scene returned “No sufficiently similar matches.” The first successful report was deleted normally before the second was created; the second remains for inspection.

The task is `\ReFind Visual Search QA`, using `storage/setup/visual-index-task-quiet.exe` every minute. Its existing console-free PHP child/job mechanism and shared database lock are preserved. One-time maintenance drains were used only for the initial backfill, with overlap safely skipped.

Quota, timeout and unavailable browser responses were injected and explicitly labeled separately from real-provider results. Actual missing-key configuration returned HTTP 503 and truthful unavailable UI with no provider call. A disabled QA feature made the worker exit 0 with `paused=disabled`. The exact original configuration was restored after both faults; the actual key file was never edited or displayed.

Current-task authentication/Student/workflow/v0.2.5 regressions passed **103 scenario groups** before the transport-only follow-up. Focused visual unit checks, PHP/JS/Python checks, full ESLint and PHPStan passed afterward. All 18 workflow invariants passed with the installed corpus. A frozen source snapshot verified 111 runtime/schema/required CLI files against the tested worktree revision `4263007`; private configuration and runtime data were excluded. Older unrelated QA documentation was not claimed as source-equivalent; the operational runbooks were refreshed separately.

## Test it locally

Use the approved synthetic Student account. A small convenience pack is in `C:\xampp\htdocs\ReFind_0.2.0_Test\storage\setup\visual-demo`:

- `matching-controller.jpg`: separate photographed view for the retained live report.
- `no-target-waterfall.jpg`: independent nonsensitive no-target demo scene.
- `reference-controller.jpg`: original report view; do not count this same view as an independent accuracy query.
- `credits.html`: source attribution and license links.

These are convenience copies of the separate demo assets, not additional evaluation observations. Existing keyword search, report creation, login and claims remain available. Visual results are **Possible Visual Matches**, not verified physical-object identity or ownership.

The [sanitized aggregate receipt](verification/visual-search-20261111.json) records raw counts, failed and final runs, provenance hashes and tested revisions. Main remains at its original local revision; no Git merge or push was performed. Larger deployment work remains on hold.
