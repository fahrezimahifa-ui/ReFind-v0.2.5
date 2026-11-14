# ReFind v1.0.0-rc.1: unified release candidate

Assembled 14 November 2026 on branch `release/v1.0.0-candidate`, worktree `C:\xampp\htdocs\refind-v1-rc`. Discovery input: the Codex report `REFIND_UNIFICATION_DISCOVERY_AND_V1_RELEASE_ASSESSMENT.md` (same date), with every material source identity re-verified before changes.

This is a **local-only release candidate**. It is not deployed, not merged into GitHub main and not declared stable. The main installation (`C:\xampp\htdocs\ReFind_0.2.3`, `refind_db_0_2_0`) and the persistent QA corpus (`ReFind_0.2.0_Test`, `refind_db_0_2_0_test`) were not modified.

## 1. Source identities (verified at assembly)

| Source | Identity | Use in the candidate |
|---|---|---|
| GitHub main (`v025/main`) | `7aefd9e` (PR #7 on PR #6). Fetched; tree equals `claude/item-journey` `7f65283` | **Baseline** |
| refind-dev (D) | `claude/item-journey` `9dad730`, clean | Cherry-picked `bb79bb8` → `142024e`, `9dad730` → `f58acc3` |
| Main XAMPP (M) | `codex/visual-search-xampp-20261111` `1d17494`, clean | Visual-search delta `77ebcbc..1d17494` ported as `4370a07`. M's registration line equals PR #4 `5b6bcdd` except G's newer `Dockerfile.qa` |
| Maintainability follow-up (W) | `codex/maintainability-v025-followup` `a610b1a` + 80 uncommitted paths | Read only. Functional claim/BM batching and its oracle test ported as `9280fe0`; reformatting not adopted. W left untouched |
| Dependency maintenance (DEP) | `codex/security-dependency-maintenance` `b82cb53` | Cherry-picked → `af1016f`, branch trigger adjusted `e0546be` |
| Security/native runtime (SEC) | `codex/security-wp01-wp02-preparation` `1e0b1f3` | Not integrated (section 6) |
| Visual results UI | `claude/visual-results-ui` `57728df` | Not integrated (QA-only experiment, changes the API contract) |

Candidate commits on top of `7aefd9e`: `142024e`, `f58acc3`, `4370a07`, `5351283`, `01e980e`, `af1016f`, `e0546be`, `7d8bd77`, `9280fe0`, `27abebc`, `30b9ca2`, `806580a` (plus this documentation commit).

## 2. Feature consolidation matrix

**Selected** names the implementation kept. Status uses: **V** verified by a check run for this candidate (section 5), **H** historical evidence only, **U** not yet exercised end to end on the candidate.

| Feature | Selected source | Status | Notes / limitations |
|---|---|---|---|
| Login, logout, sessions, CSRF, role checks, rate limits | G = M shared v0.2.5 code | see §5 | Unchanged server authority. |
| Normal localhost Student registration | PR #4 `5b6bcdd` (= M) | see §5 | Default disabled in source; local override enables it. No temporary keys/launchers/expiry. No enrollment/mailbox verification (not claimed). |
| Account, password change, avatar crop/replace/remove | PR #3 `a610b1a` + PR #6 polish | see §5 | Unchanged. |
| Lost/Found reports, edit/delete locks, photos, private evidence | G/M shared | see §5 | Unchanged limits (4 public / 2 Lost / 2 claim, ≤250 kB prepared). |
| Order-independent multi-word search, conservative plurals | D `bb79bb8` (`app/search.php`) | V (pure suite) + §5 | ≤8 terms, substring matching. Not semantic or language-aware. Coexists with M's extracted `item_structured_filters()`. |
| Structured filters, pagination | M `app/item-filters.php` | see §5 | Same rules as G's inline code, now shared with visual search. |
| Useful empty search states, Lost/Found intent | D `bb79bb8` | see §5 | Report-it CTA keeps the user's words. |
| Compact cards, guarded 480px thumbnails, skeletons | PR #6 `e195499` | see §5 | Thumbnail cache has no removal policy (deferred). |
| Five-step journey, newest-first role-level history | PR #7 `7aefd9e` | see §5 | Actor is a role label, never a name/ID. |
| Contextual next actions, claim/report guidance | D `9dad730` | see §5 | Wording only; no permission/state rule changes. |
| Pickup place shown only when scheduled; desk card | D `9dad730` | see §5 | Found area is not presented as custody/storage. |
| Past-due appointment indicator | D `9dad730` | see §5 | Display only; offers existing confirm-return/reschedule. No no-show policy. |
| Photo upload discoverability (open section) | D `9dad730` | see §5 | |
| Reporter-visibility disclosure | D `9dad730`, corrected `30b9ca2` | see §5 | Now lists every `public_columns()` field (adds category, time, status). |
| Skip-to-content, mobile primary action | D `9dad730` | see §5 | Physical assistive-tech check not performed. |
| Notifications: unread filter, dot, 99+ | PR #6 | see §5 | **Fixed** `5351283`: `filter=unread` now survives login return and item round trip (allowlisted value only). |
| BM dashboard, review, approve/reject/more-info, stale/competing safeguards | G/M shared + PR #6 UI | see §5 | Business transactions unchanged. |
| Claim and BM list projections | W functional patch, `9280fe0` | see §5 | Batched reads; mutations keep fresh locked reads. Oracle parity suite included. |
| Handover schedule/cancel/release/physical return | G/M shared | see §5 | Cancel keeps approved owner; release closes claim; return is separate. |
| Light/dark themes, Appearance, responsive nav (1000px) | PR #3/#6 | see §5 | |
| Visual search (Search by photo, indexing, calibration) | M `1d17494` | V (offline unit) | **QA-only, disabled.** `visual_enabled()` still requires the exact `ReFind_0.2.0_Test` identity and marker; stable defaults `visual_search_enabled=false`, empty allowlist. No provider call made. |
| Version label | `01e980e` | V (static) | `1.0.0-rc.1` in Settings, message page, error-log prefix, QA package. Folder/database labels unchanged. |
| Dependency/secret maintenance CI | DEP `b82cb53` | V (offline) | Policy exception for `minimatch` and native reviews **expire 16 Nov 2026**; owner must reassess before then. |

## 3. Schema and configuration compatibility

- `database/schema.sql`, `views.sql`, `seed-reference.sql`, `manifest.json`, `docs/schema-contract.json`, `app/visual-schema.php`, `app/avatar-migration.php`, `tools/setup-db.php` (except the new guard line), `check-database.php`, `check-workflow.php` and `migrate-visual-search.php` are **byte-identical to M `1d17494`**. `schema.sql` SHA-256 `7c58fe8b35f8d635f9db04ea518afe77ea7a9a8982237a7f0f983faa343a2bfd` matches the fingerprint recorded for main and QA. The contract is 15 tables (including nullable `users.avatar_path` and `item_photo_embeddings`), 2 views, 26 FKs, 13 UNIQUE, 10 CHECK, handover enum `PENDING/SCHEDULED/COMPLETED`.
- G/D's 14-table source was **not** used for schema; no table is dropped. Existing main/QA databases need **no migration** to run this source.
- Account identities, password hashes, IDs, media paths and status codes are untouched. No data was imported, exported or copied between databases.
- `app/config.php` keeps every existing database identity and adds exactly one: `refind_db_v1rc_test` is accepted only with `127.0.0.1:3306`, principal `refind_v1rc`, base `/refind-v1-rc/`, session `refind_v1rc_test`. No existing guard was loosened.
- Visual gating, QA allowlist, rate limits (6 per Student / 20 per installation per minute), quota and timeout validation are unchanged from M.

## 4. Isolated QA environment (`REFIND_TEST_PROFILE=v1-rc`)

| Item | Value |
|---|---|
| URL | `http://localhost/refind-v1-rc/` (loopback-only `.htaccess`) |
| Database / principal | `refind_db_v1rc_test` on native MariaDB 3306; `refind_v1rc` granted on that database only |
| Config / marker | ignored `app/config.local.php` (generated password) and `.refind-v1-rc.json` |
| Media/sessions/auth | this worktree's ignored `storage/` |
| Provisioning | `python tools/prepare-v1rc.py` (validates folder, marker and identity before any write; runs `setup-db.php` and `setup-demo.php` behind `assert_v1rc_installation()`) |
| Runner | `REFIND_TEST_PROFILE=v1-rc node tools/run-qa.cjs` |

Fail-closed behaviour: the `refind-v1-rc` folder refuses to run QA tools without the profile; the profile refuses any other folder; `prepare-test.py` refuses the RC (it would otherwise target the persistent QA corpus); the fixture allowlist adds only the RC database. Unit tests in `tools/test-release.py` cover positive and negative cases.

## 5. Verification

RESULTS_PLACEHOLDER

## 6. Not integrated, deferred or blocked

| Item | Classification | Reason |
|---|---|---|
| W reformatting, shared head/script partials, frontend request trimming, `mutate_account()` extraction, CSS cleanup | Deferred (maintainability) | 11.7k-line reformat on the old base; would collide with PR #6/#7/D UI work. Only the measured batching was ported. W remains intact for later selective review. |
| SEC native runtime harness (`prepare-runtime-qa.py`, TLS/recovery rehearsal) | Deferred (operational) | Downloads and launches a separate native runtime, outside this task's no-new-infrastructure boundary; it also edits the same QA guard files. Re-port onto the candidate's guards later. |
| `claude/visual-results-ui` panel and qualitative labels | Excluded (experimental) | Changes the visual API `match_label` and calibration contract; retrieval quality/latency gates still fail. |
| Visual search for Students | Excluded | QA-only by design; no real provider request made. |
| PHPStan (`composer analyse`) | Blocked locally | No Composer vendor tree installed; installing requires a download. CI job retains it. |
| Thumbnail cache cleanup policy | Deferred | No removal policy yet; authorization still precedes cache/304. |
| Campus SSO/mailbox verification, recovery, custody roles, disposal/no-show policy, email transport | Excluded (policy) | Not implemented; require stakeholder decisions. |
| Physical device and screen-reader checks | Pending (manual) | Not automatable here. |

## 7. Release-readiness criteria for `v1.0.0-rc.1`

READINESS_PLACEHOLDER

## 8. Future cutover to `/refind/` and `/refind-test/` (informational; not executed)

1. **Freeze inputs.** Tag the reviewed candidate commit; record its tree hash, `schema.sql` hash and the configuration profile. Merge to GitHub main only through a reviewed PR with CI green.
2. **Back up main consistently.** Pause writes (stop Apache or put the app in maintenance), then take a logical `mariadb-dump --single-transaction --routines --triggers` of `refind_db_0_2_0`, copy `storage/{items,evidence,claims,avatars,auth,setup}` and `app/config.local.php`, and record SHA-256 for every file. Store outside the web root and Git.
3. **Prove the backup.** Restore privately into a throwaway database/folder on the same runtime, run `check-database.php` and `check-workflow.php`, and compare `tools/fingerprint.php` output with the source. Do not rely on the Desktop raw datadir copy.
4. **Stage the new layout side by side.** Create `C:\xampp\htdocs\refind` from the tagged source with its own ignored config: keep database `refind_db_0_2_0` initially (no rename), set `base_path=/refind/` and a **new session name** (e.g. `refind_v1`), and point storage at a copy of main's media (or move it during the paused window). Add a narrowly scoped identity to `app/config.php` and the QA guards for `/refind-test/` with its own synthetic database and principal, as done for `v1-rc`; never let the two share a database, media, session name or auth secret.
5. **Switch.** With writes paused, copy the final media delta, start Apache, verify login with an existing account, private media access, a BM review page and the schema checks. Leave `/ReFind_0.2.3/` in place but read-only/maintenance until accepted. Old sessions are invalidated by the new session name and cookie path, so users sign in again.
6. **Rollback.** Before any new writes, rollback is: stop `/refind/`, restore `/ReFind_0.2.3/` access (its files and database were untouched). After new writes exist, do not restore the old dump blindly: export the new records or keep the new database authoritative and re-point the old source only if it is schema-compatible (it is: the schema is identical).
7. **QA move.** Repoint the persistent QA corpus only by copying it to `/refind-test/` with a new marker/identity; keep `ReFind_0.2.0_Test` until the copy passes `check-database.php`/`check-workflow.php` and the visual gate is re-qualified for the new identity.
