# ReFind v1.0.0: unified release record

**Status (15 November 2026):** the candidate was merged into `main` by PR #8 as merge commit `72d5e50` (parents `7aefd9e` and the tested head `7afdbb9`, identical tree) and tagged `v1.0.0-rc.1`. Version `1.0.0` (PR #9, merge `5481c79`, tag `v1.0.0`) is the same application with the label changed; see section 7 for the release qualification. **Deployed on 15 November 2026** following [CUTOVER_RUNBOOK.md](CUTOVER_RUNBOOK.md): main at `http://localhost/refind/` and QA at `http://localhost/refind-test/`, both checked out at `v1.0.0`, with the old URLs blocked and verified backups in `C:\ReFind-Backups`.

Assembled 14 November 2026 on branch `release/v1.0.0-candidate`, worktree `C:\xampp\htdocs\refind-v1-rc`. Discovery input: the Codex report `REFIND_UNIFICATION_DISCOVERY_AND_V1_RELEASE_ASSESSMENT.md` (same date), with every material source identity re-verified before changes.

ReFind v1.0.0 is a **local-only release** and is not deployed yet. The main installation (`C:\xampp\htdocs\ReFind_0.2.3`, `refind_db_0_2_0`) and the persistent QA corpus (`ReFind_0.2.0_Test`, `refind_db_0_2_0_test`) were not modified; read-only checks after every incident confirmed their schema, invariants and record counts unchanged (section 5.4).

## 1. Source identities (verified at assembly)

| Source | Identity | Use in the candidate |
|---|---|---|
| GitHub main (`v025/main`) | `7aefd9e` (PR #7 on PR #6), fetched; tree equals `claude/item-journey` `7f65283` | **Baseline** |
| refind-dev (D) | `claude/item-journey` `9dad730`, clean | Cherry-picked `bb79bb8` → `142024e`, `9dad730` → `f58acc3` |
| Main XAMPP (M) | `codex/visual-search-xampp-20261111` `1d17494`, clean | Visual-search delta `77ebcbc..1d17494` ported as `4370a07`. M's registration line equals PR #4 `5b6bcdd` except G's newer `Dockerfile.qa` |
| Maintainability follow-up (W) | `codex/maintainability-v025-followup` `a610b1a` + 80 uncommitted paths | Read only. Functional claim/BM batching and its oracle suite ported as `9280fe0`; reformatting not adopted. W left untouched |
| Dependency maintenance (DEP) | `codex/security-dependency-maintenance` `b82cb53` | Cherry-picked → `af1016f`; branch trigger `e0546be` |
| Security/native runtime (SEC) | `codex/security-wp01-wp02-preparation` `1e0b1f3` | Not integrated (section 6) |
| Visual results UI | `claude/visual-results-ui` `57728df` | Not integrated (QA-only experiment that changes the API contract) |

Candidate commits on `7aefd9e`, in order:

| Commit | Purpose |
|---|---|
| `142024e`, `f58acc3` | refind-dev word search; guidance, next steps, accessibility |
| `4370a07` | QA-only visual-search infrastructure and 15-table schema from M |
| `5351283` | Unread notification view survives login return and item round trip |
| `01e980e` | Version label `1.0.0-rc.1` |
| `af1016f`, `e0546be` | Dependency/secret maintenance CI |
| `7d8bd77`, `8d91967`, `806580a` | Fail-closed `v1-rc` QA profile and provisioning (no privilege-table writes) |
| `9280fe0` | Batched claim and BM list projections + oracle suite |
| `27abebc` | CI runs the pure search suite; release branches covered |
| `30b9ca2` | Visibility disclosure lists every public field |
| `b8cc88d`, `496118e`, `11dcd8e`, `a04a0f9`, `c3f08d8` | Test-only: CI-only skips, real-SQL search and visual-off suites, native keep-alive fix, updated Delete expectation, stage cool-down, glass-titles fixture |

**Application code has been unchanged since `8d91967`**; every later commit touches only tests/tooling, so all matrix runs below exercise the same application.

## 2. Feature consolidation matrix

Status: **V** verified by a check run for this candidate (section 5), **H** historical evidence only, **U** not exercised end to end here.

| Feature | Selected source | Status | Notes / limitations |
|---|---|---|---|
| Login, logout, sessions, CSRF, role checks, rate limits | G = M shared v0.2.5 code | V | auth 28/28 both themes; security suite. |
| Normal localhost Student registration | PR #4 `5b6bcdd` (= M) | V | Registration + UI suites both themes. Default disabled in source; no temporary keys/launchers/expiry. No enrollment/mailbox verification (not claimed). Non-loopback denial is CI-only (skipped natively). |
| Account, password change, avatar crop/replace/remove | PR #3 `a610b1a` + PR #6 polish | V | account (both themes), profile 12/12. |
| Lost/Found reports, edit/delete locks, photos, private evidence | G/M shared | V | student, workflow, v0.2.5 suites both themes. |
| Order-independent multi-word search, conservative plurals | D `bb79bb8` (`app/search.php`) | V | Pure 50/50; real MariaDB 20/20. ≤8 terms, substring matching; **not accent-insensitive** for multi-byte letters (section 6). |
| Structured filters, pagination | M `app/item-filters.php` | V | Same rules as G's inline code; shared with visual search. |
| Useful empty search states, Lost/Found intent | D `bb79bb8` | V | UX suites. |
| Compact cards, guarded 480px thumbnails, skeletons | PR #6 `e195499` | V | layout 21/21, glass titles 8/8, theme. Thumbnail cache has no removal policy. |
| Five-step journey, newest-first role-level history | PR #7 `7aefd9e` | V | workflow/UX suites. |
| Contextual next actions, claim/report guidance | D `9dad730` | V | Wording only; no permission/state rule changes. |
| Pickup place shown only when scheduled; desk card | D `9dad730` | V | Found area is not presented as custody/storage. |
| Past-due appointment indicator | D `9dad730` | V (source review + suites) | Display only; offers existing confirm-return/reschedule. No no-show policy. |
| Photo upload discoverability (open section) | D `9dad730` | V | UX 9 keyboard disclosure. |
| Reporter-visibility disclosure | D `9dad730`, corrected `30b9ca2` | V (source) | Matches `public_columns()`. |
| Skip-to-content, mobile primary action, quieter Delete | D `9dad730` | V | UX/menu/layout suites; UX 14 now asserts the danger text button. Physical assistive-tech check not performed. |
| Notifications: unread filter, dot, 99+ | PR #6 + fix `5351283` | V | Offline `safe_return()` cases; UI suites. |
| BM dashboard, review, approve/reject/more-info, stale/competing safeguards | G/M shared + PR #6 UI | V | workflow 27/27 both themes incl. concurrent approvals and forced rollbacks. |
| Claim and BM list projections | W functional patch `9280fe0` | V | 49/49 oracle parity; claims 124→2, BM 158→6 statements (48 records). |
| Handover schedule/cancel/release/physical return | G/M shared | V | workflow/v0.2.5 suites. |
| Light/dark themes, Appearance, responsive nav (1000px) | PR #3/#6 | V | theme 11/11 (190 screenshots, 1,926 contrast samples), appearance, menus 14/14. |
| Visual search (Search by photo, indexing, calibration) | M `1d17494` | V (disabled posture) | **QA-only, off.** `visual_enabled()` still requires the exact `ReFind_0.2.0_Test` identity; visual-off suite 5/5; offline unit 13/13. No provider request made. Mock-provider browser test blocked (section 6). |
| Version label | `01e980e` | V | Settings asserts `Version 1.0.0-rc.1`. |
| Dependency/secret maintenance CI | DEP `b82cb53` | V (offline) | **Policy exception and native reviews expire 16 Nov 2026.** |

## 3. Schema and configuration compatibility

- `database/schema.sql`, `views.sql`, `seed-reference.sql`, `manifest.json`, `docs/schema-contract.json`, `app/visual-schema.php`, `app/avatar-migration.php`, `check-database.php`, `check-workflow.php` and `migrate-visual-search.php` are **byte-identical to M `1d17494`** (`setup-db.php` adds only the RC guard line). `schema.sql` SHA-256 `7c58fe8b35f8d635f9db04ea518afe77ea7a9a8982237a7f0f983faa343a2bfd` matches the fingerprint recorded for main and QA: 15 tables (incl. nullable `users.avatar_path` and `item_photo_embeddings`), 2 views, 26 FKs, 13 UNIQUE, 10 CHECK, handover enum `PENDING/SCHEDULED/COMPLETED`.
- G/D's 14-table source was **not** used for schema; no table is dropped. Existing main/QA databases need **no migration** for this source.
- Account identities, password hashes, IDs, media paths and status codes are untouched. No data was imported, exported or copied between databases.
- `app/config.php` keeps every existing identity and adds exactly one: `refind_db_v1rc_test` is accepted only with `127.0.0.1:3306`, the local `root` login, base `/refind-v1-rc/` and session `refind_v1rc_test`. No existing guard was loosened.
- Visual gating, QA allowlist, rate limits (6 per Student / 20 per installation per minute), quota and timeout validation are unchanged from M.

## 4. Isolated QA environment (`REFIND_TEST_PROFILE=v1-rc`)

| Item | Value |
|---|---|
| URL | `http://localhost/refind-v1-rc/` (loopback-only `.htaccess`; `tools/`, marker and config return 403) |
| Database | `refind_db_v1rc_test` on the native MariaDB (3306), local `root` login like main and QA; no users or grants are created |
| Config / marker | ignored `app/config.local.php` and `.refind-v1-rc.json` |
| Media/sessions/auth | this worktree's ignored `storage/` |
| Provisioning | `python tools/prepare-v1rc.py` (validates folder, marker and identity before any write; runs `setup-db.php` and `setup-demo.php` behind `assert_v1rc_installation()`) |
| Runner | `REFIND_TEST_PROFILE=v1-rc REFIND_QA_STAGE_PAUSE_SECONDS=45 node tools/run-qa.cjs` (the pause is for native Windows only) |

Fail-closed: the `refind-v1-rc` folder refuses QA tools without the profile; the profile refuses any other folder; `prepare-test.py` refuses the RC (it would otherwise target the persistent QA corpus); the fixture allowlist adds only the RC database; container-only boundary checks are recorded as SKIPPED, never PASS. Unit tests in `tools/test-release.py` cover positive and negative cases.

## 5. Verification

### 5.1 Newly executed: offline and static (14 Nov 2026)

| Check | Result |
|---|---|
| `php -l` on every PHP file | PASS |
| `node tools/check-js.cjs` | PASS, 43 files |
| ESLint `js tools` (locked M toolchain) | PASS, 0 findings |
| `php tools/test-search.php` | 50/50 |
| `php tools/test-visual-search.php` | 13/13 |
| `python tools/test-release.py` | 18/18 (incl. unread return, `v1-rc` positive/negative guards, legacy preparation refusal) |
| `python tools/test-registration.py` / `test-registration-source.py` | 12/12 / 3/3 |
| `python tools/test-security-maintenance.py` | 5/5 |
| `check-security-maintenance.py` (offline) | 0 secret findings in tracked source, 0 policy errors, 115 locked packages; online advisory query not run |
| PHPStan (`composer analyse`) | **NOT RUN** (no Composer vendor tree locally) |

### 5.2 Newly executed: disposable candidate database

| Check | Result |
|---|---|
| `check-database.php` / `check-workflow.php` | 9/9 and 18/18 before and after every run, including after the MariaDB crash |
| `test-projection.php` (W oracle) | 49/49 parity; per 48 records: claims 124→2, BM 158→6, public 4 (Student)/3 (BM) |
| `test-search-sql.php` | 20/20; 1 known limitation recorded (accents) |
| `test-visual-disabled.cjs` | 5/5 |
| HTTP | login 200; `tools/`, marker, local config 403 |

### 5.3 Newly executed: integration matrix (`run-qa.cjs`)

Earlier attempts and their causes are retained (evidence under ignored `output/playwright/release-readiness/results/`):

| Run | Commit | Outcome | Cause / action |
|---|---|---|---|
| `v1rc-20261114-183637` | `b8cc88d` | 12 PASS, 1 SKIP, stopped at light workflow | Native keep-alive race in the Node test client (`496118e` yields before each request). Reproduced and isolated; application responses verified correct. |
| `v1rc-20261114-185909` | `496118e` | 16 PASS, 1 SKIP, stopped at light UX | Outdated Delete-class assertion after D's intentional restyle (`11dcd8e`). |
| `v1rc-20261114-191450` | `11dcd8e` | 12 PASS, 1 SKIP, stopped at light account | Host ephemeral-port exhaustion (WSAEADDRINUSE); optional stage cool-down added (`a04a0f9`). |
| `v1rc-20261114-192329` | `a04a0f9` | **20 PASS**, 1 SKIP; dark UX passed 15/15 groups, then MariaDB crashed | Host MariaDB file-handle fault (section 6); `schema-after` failed only because the server was down. |
| UI completion `v1rc-ui-20261114-224918` + appearance runs | `a04a0f9` / `c3f08d8` | layout 21/21, profile 12/12, menus 14/14, theme 11/11, appearance PASS, smoke PASS, glass titles 8/8 | Glass titles needed a claim fixture on a fresh database (`c3f08d8`); verified with the fixture and the runner change. |

Combined suite result on the unchanged application code:

| Suite | Light | Dark |
|---|---|---|
| Registration UI / registration | PASS / PASS | PASS |
| Security, projection, search-sql, visual-disabled | PASS | n/a |
| Auth (28) | PASS | PASS |
| Account | PASS | PASS |
| Student (24) | PASS | PASS |
| Workflow (27) | PASS | PASS |
| v0.2.5 fixes | PASS | PASS |
| UX (15) | PASS | 15/15 groups PASS (end-of-suite cleanup lost the crashed server) |
| Layout, profile, glass titles, menus, theme, appearance, smoke | PASS | (suites cover both themes internally) |
| Local access (non-loopback boundary) | SKIPPED: CI container only | |

**Not yet a single uninterrupted green run.** The suites have each passed on the same application code, but the full matrix has not completed end to end in one run because of the host MariaDB instability and harness fixes along the way.

### 5.4 Protected installations (read-only)

After the 17:10 crash, after the repair, after the 19:52 crash and after the service switch: main and QA `check-database.php` 9/9 and `check-workflow.php` 18/18 with no missing/orphan/invalid media; record counts identical to the discovery snapshot (main: 3 users, 40 reports, 12 claims, 6 handovers, 61 item photos, 12 claim photos, 86 matches, 176 notifications, 135 history, 0 embeddings; QA: 3/101/20/5/101/0/558/314/243, 81 READY embeddings). No server log text in any ReFind data file.

### 5.5 Historical evidence (not re-run)

PR #6/#7 receipts in `docs/verification/uiux/` and the original `output/playwright/uiux/`; v0.2.5 receipts in `docs/verification/v025/`; W's 26-stage run and final focused validation (W `docs/MAINTAINABILITY_FOLLOWUP.md`); visual QA evidence in `docs/VISUAL_SEARCH_QA_2026-11-11.md` and `docs/verification/visual-search-20261111.json`. These keep their original scope and dates.

## 6. Not integrated, deferred, blocked or found

| Item | Classification | Reason / next step |
|---|---|---|
| Accent-insensitive search (`cafe` → "Café") | Known limitation (pre-existing) | MariaDB `LOCATE()` compares byte-length substrings. Fix would switch to escaped `LIKE` and change the search contract; propose separately. |
| Host MariaDB 10.4.32 instability | Environment risk (found) | XAMPP-launched mysqld wrote its own log into Aria system-table files (`mysql.db` corrupted; restored from XAMPP's copy with a checksummed backup in `C:\xampp\mysql\repair-backup-20261114-mysql-db\`) and crashed on Aria/InnoDB log writes. Now runs as the Windows service `mysql` (clean restart, no errors since). MariaDB 10.4 is past end of life; plan a supported LTS (10.11/11.4) via logical dump/restore. |
| Stray empty login `refind_v1rc@localhost` | Cleanup decision for the owner | Left by the aborted first provisioning; no grants. Remove with `DROP USER` only on approval. |
| W reformatting, shared head/script partials, request trimming, `mutate_account()` extraction, CSS cleanup | Deferred (maintainability) | 11.7k-line reformat on the old base; would collide with PR #6/#7/D UI work. W remains intact. |
| SEC native runtime harness | Deferred (operational) | Downloads/launches a separate native runtime; edits the same QA guard files. Re-port later. |
| `claude/visual-results-ui` panel and labels | Excluded (experimental) | Changes visual API `match_label`/calibration; retrieval gates still fail. |
| Visual search for Students | Excluded | QA-only by design. |
| `test-visual-search.cjs` (mock-provider browser test) | Blocked | Needs a second disposable MariaDB on another port plus an Apache prepend (new infrastructure). |
| `test-local-access.cjs`, non-loopback registration check, disposable recovery, fresh install | CI-only | Need the disposable container network. |
| PHPStan | Blocked locally | Composer vendor tree not installed; CI job keeps it. |
| Thumbnail cache cleanup policy | Deferred | No removal policy yet; authorization still precedes cache/304. |
| Campus SSO/mailbox verification, recovery, custody roles, disposal/no-show policy, email transport | Excluded (policy) | Not implemented; require stakeholder decisions. |
| Physical device and screen-reader checks | Pending (manual) | Not automatable here. |

## 7. Release-readiness criteria

Qualification evidence added 15 November 2026 (not re-runs of earlier results):

| Evidence | Result |
|---|---|
| PR #8 CI on head `7afdbb9`: Release readiness / integration (`pull_request`) | **PASS** in 17 min: disposable Apache/PHP/MariaDB container, `prepare-test.py`, disposable recovery, `profile-queries.php` and the full `run-qa.cjs` matrix (including `local-access` and the non-loopback registration check) in one uninterrupted run |
| Release readiness / static (`pull_request`) | **PASS** in 34 s: PHP lint, `check:js`, ESLint, **PHPStan**, offline visual/search/release/registration suites |
| Security maintenance / review (`pull_request` and `push`) | **PASS**: redacted secret scan and online locked-advisory review within the reviewed exception |
| Merge | `72d5e50` into `main`, tagged `v1.0.0-rc.1` |
| Owner phone check (15 Nov 2026) | **PASS**: candidate reviewed on a phone; report detail page approved |

| # | Criterion | Status |
|---|---|---|
| 1 | One reviewable source identity containing all accepted features, conflicts resolved | **PASS** (merged as `72d5e50`, tag `v1.0.0-rc.1`) |
| 2 | Schema compatible with main/QA without migration; no table dropped | **PASS** |
| 3 | Visual search off for stable/default; no provider calls | **PASS** |
| 4 | Guest/Student/BM journeys on owned synthetic data, both themes (auth, account, reports, uploads, search, claims, review, stale/concurrent, handover, return) | **PASS** per suite |
| 5 | Security/authorization/private-media regression | **PASS** (incl. container-only boundary in CI) |
| 6 | UI: layout, responsive, theme/contrast, Appearance, profile, menus, smoke | **PASS** |
| 7 | One uninterrupted full-matrix run on the final commit | **PASS** (CI integration on `7afdbb9`) |
| 8 | Static analysis incl. PHPStan; container-only suites | **PASS** (CI) |
| 9 | Main/QA preserved and isolated from candidate testing | **PASS** |
| 10 | Runtime/advisory qualification | **OPEN (environment, not code):** host MariaDB 10.4 is past end of life (now a Windows service, stable since the switch); the dependency-policy exception and native reviews fall due 16 Nov 2026 and need the owner's reassessment |
| 11 | Manual device and assistive-technology checks | **PASS (owner):** phone check and post-cutover sign-in with real accounts completed; a screen-reader pass was not performed |
| 12 | Verified main backup/restore and rollback rehearsal | **PASS:** main and QA backups taken with writes paused and proven by restore into scratch databases (all 15 tables, row counts and checksums matched); rollback is removing the two Apache deny blocks, with the old folders untouched |

**Verdict:** **v1.0.0 is released and deployed locally** within the approved scope: feature-complete, CI-green on the exact merged tree, main schema and data preserved through the cutover (record counts unchanged), photo search disabled outside the QA pilot. Remaining items are operational, not code: reassess the dependency policy (due 16 Nov 2026), plan the MariaDB LTS move, and optionally add a screen-reader pass.

## 8. Future cutover to `/refind/` and `/refind-test/` (informational; not executed)

The step-by-step commands, verification and rollback are in [CUTOVER_RUNBOOK.md](CUTOVER_RUNBOOK.md); this section is the summary.

1. **Freeze inputs.** Tag the reviewed candidate commit; record its tree hash, `schema.sql` hash and the configuration profile. Merge to GitHub main only through a reviewed PR with CI green.
2. **Stabilise the database runtime first.** Keep MariaDB as a service; preferably move to a supported LTS (10.11 matches CI) on a separate port via logical dump/restore, verified with `check-database.php`, `check-workflow.php` and record counts before switching `db_port`.
3. **Back up main consistently.** Pause writes (stop Apache or put the app in maintenance), take `mariadb-dump --single-transaction --routines --triggers` of `refind_db_0_2_0`, copy `storage/{items,evidence,claims,avatars,auth,setup}` and `app/config.local.php`, and record SHA-256 for every file. Store outside the web root and Git.
4. **Prove the backup.** Restore privately into a throwaway database/folder on the target runtime, run the two checkers, and compare `tools/fingerprint.php` output with the source. Do not rely on the Desktop raw datadir copy.
5. **Stage side by side.** Create `C:\xampp\htdocs\refind` from the tagged source with its own ignored config: keep `refind_db_0_2_0` initially (no rename), set `base_path=/refind/` and a **new session name** (e.g. `refind_v1`), and use a copy of main's media. Add narrowly scoped identities for `/refind-test/` with its own synthetic database, as done for `v1-rc`; never share a database, media, session name or auth secret between the two.
6. **Switch.** With writes paused, copy the final media delta, verify login with an existing account, private media, a BM review page and the schema checks. Leave `/ReFind_0.2.3/` in place, read-only/maintenance, until accepted. The new session name and cookie path invalidate old sessions; users sign in again.
7. **Rollback.** Before new writes: stop `/refind/` and restore `/ReFind_0.2.3/` access (its files and database are untouched). After new writes: keep the new database authoritative and re-point the old source only if schema-compatible (it is identical); never restore an older dump over legitimate new records.
8. **QA move.** Copy the persistent QA corpus to `/refind-test/` with a new marker/identity; keep `ReFind_0.2.0_Test` until the copy passes both checkers and the visual gate is re-qualified for the new identity.
