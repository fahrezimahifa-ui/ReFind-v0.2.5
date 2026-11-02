# Security modernization implementation record

Checkpoint: 2026-11-02. Runtime review branch: `codex/security-wp01-wp02-preparation`. Dependency review branch: `codex/security-dependency-maintenance`.

The isolated PHP 8.4/Apache environment now runs successfully. The newest follow-up passed a clean **26-stage matrix on MariaDB 11.4.13**. Logical import and matched synthetic backup restoration passed. **WP01 live containment is proposed, not applied; no main runtime or database cutover is approved.**

Authority: [original approved audit](REFIND_SECURITY_AUDIT_AND_MODERNIZATION_PLAN.md). Its bytes and historical verification ledger are unchanged. The earlier inert preparation checkpoint is retained in commits fd4c7f7, b499942 and 5aa3fc6 and [its original receipt](evidence/2026-11-02-wp01-wp02-preparation.json); pending statements in that historical receipt are superseded below.

## Work-package status

| Package | Completed in this continuation | Remaining gate / risk |
|---|---|---|
| WP01 | Refreshed exact rule ownership/filter/service evidence; equivalent isolated loopback/private-path/TLS checks; finalized [four-rule/four-config proposal](WP01_EXPOSURE_CHANGE_PROPOSAL.md), impact and contained rollback | User approval before any live rule/listener/config edit; private rollback snapshots, existing-config syntax/restart and optional authorized LAN-client verification still required |
| WP02 / WP03 | Verified complete PHP/Apache packages and Microsoft app-local CRT; actual mod_php and TLS/library-path checks; legacy synthetic hash/session compatibility; full follow-up/LTS matrix; separate installed-source qualification | Main remains PHP 8.2.12/Apache 2.4.58; actual private backup rehearsal plus a documented native residual-risk decision are needed before a separately approved local runtime switch; no public-readiness claim |
| WP04 | Complete portable MariaDB 11.4.13; new synthetic datadir on 3313; frozen logical import, DML-only web principal, full matrix and restoration to another new old-version datadir | No main grants/data/backup inspected or migrated. Real backup/restore, selected source/data qualification and explicit DB approval required |
| WP05 | Public-deployment gate preserved; no public listener, tunnel or deployment introduced | Public hosting/TLS/secrets/backups/operations qualification and separate approval remain open |
| WP06 | Independent committed branch with redacted tracked-source scan, exact expiring advisory decisions and read-only CI; five offline tests and live 115-pair OSV review; GitHub Actions passed | minimatch 10.2.6 tooling advisory remains under exact temporary exception until 2026-11-16; no lockfile change or claim of patching |
| WP07 | Existing upload/media privacy and authorization regressions exercised; no new decoder feature or existing-media rewrite | Exact WebP/vendor BOM and metadata/orientation/format policy before adding normalization; arbitrary native DLL replacements rejected |
| WP08 | Explicit native QA discovery, unknown-profile rejection, fixture ownership/server/datadir guards and negative tests; current source's complete synthetic workflow regression | Maintainability worktree remains uncommitted and unchanged; no implicit source promotion with runtime upgrade |
| WP09 | Authentication/session/password controls exercised with synthetic accounts; preserved Student/BM roles and current recovery behavior | Campus IdP, enrollment/recovery/support decisions needed for MFA/SSO; no new auth framework or feature added |

## Exact source identities and preservation

| Baseline | Identity |
|---|---|
| GitHub main | Independently re-resolved on 2026-11-02: a610b1a0cb7ebb2b911f3468388076948a65b238 |
| Installed I | C:\xampp\htdocs\ReFind_0.2.3; 4d74e9872b3afa5fa1ab09c081b30d1a3437a2b5, codex/release-readiness, clean |
| Newest follow-up W | C:\Users\LENOVO\.codex\worktrees\refind-v025-maintainability\ReFind_0.2.3; a610b1a plus the existing 80 status entries, including the audit |
| Security S | C:\Users\LENOVO\.codex\worktrees\refind-security-wp01-wp02\ReFind_0.2.3; based on a610b1a; tooling/proposal/evidence only |
| Dependency D | C:\Users\LENOVO\.codex\worktrees\refind-security-dependencies\ReFind_0.2.3; commit b82cb530c038f3e609db65a0cb8e9b0c40a805c9; independent branch based on a610b1a |

I full-source SHA256 (605 files): `d9475b06037997c8f5a2b8d1c72b589477f79e7b5b57ebec626774580d49cabc`.
W full-source SHA256 (609 files, audit excluded): `7baac5e0857ed460905a32a7b010ed57ab77bf6ef8b2ac88b28c29bc975c5033`.
Full-source algorithm: sorted unique git ls-files -co --exclude-standard; aggregate UTF-8 relative path + NUL + file SHA256 + LF; original audit excluded. Installed executable application code matches remote main, with eight documentation/exclusion-file differences; the uncommitted follow-up is a distinct audited source.

Original audit SHA256 in W and S: `372eb6a46f2eaa29cc761b47dfb1e6adb66133e60bdad41e28676a6c8040ad0a`.
Public deployment subset W: 84 files, `b797e36fd87c53e37e6f8a77fe491f6357486064ce6cd020b512087d67e529e3`.
Public deployment subset I: 82 files, `59d7a5aeb331cb7fbafd3c215625f3722d06d8a2f16af9f4bd979be4357bf3a2`.
Deployment subsets exclude tools, SQL, Git/dependencies, ignored local configuration, accounts, session/auth material and real uploads. Native QA then adds separate synthetic configuration and copies only source-selected QA tools/schema/demo fixtures, with recorded harness overlays. W's corrected projection oracle and negative assertions are retained, not overwritten with an older oracle.

No main ignored credentials, session payloads, uploaded content, user records or backup contents were inspected. There were no main HTTP requests or database connections. Other worktrees and all pre-existing changes remain preserved. Read-only use of old PHP/MariaDB executable files for synthetic compatibility is distinct from changing their binaries/configuration or connecting to main.

## Resolved download / CRT / OpenSSL blockers

All package access dates: 2026-11-02. Exact URLs and SHA256 values are pinned in [runtime-qa-packages.json](../../tools/runtime-qa-packages.json). HTTPS verification and origin/integrity checks stayed enabled; no installer, unofficial DLL source or certificate bypass was used.

| Component | Verification / selected behavior |
|---|---|
| PHP 8.4.27-1 TS VS17 x64 | Official Windows archive hash matched. CLI and actual apache2handler report 8.4.27; the -1 rebuild supplies Brotli 1.2.1. Required mysqli/mysqlnd, mbstring, fileinfo, GD and sessions work. Upload progress disabled before request parsing. |
| Apache 2.4.69-261002 VS18 x64 | Provider archive hash matched. Explicit honest User-Agent returns HTTPS 200 instead of the earlier off-origin 308; the strict redirect rejection remains. Configuration syntax and mod_php passed. |
| Microsoft CRT 14.51.36247.0 | Official signed redistributable bundle and all 12 extracted minimum-runtime DLLs have valid Microsoft Authenticode signatures. Cabinet extraction was static; installer never run. Complete minimum set placed app-locally in QA PHP/Apache directories. System CRT registry/DLLs unchanged. [Pinned extraction recipe](NATIVE_RUNTIME_MIGRATION_RUNBOOK.md). |
| Apache TLS OpenSSL | Actual loaded libcrypto/libssl paths are the candidate Apache bin directory, version 3.5.9. TLS 1.2/1.3 with explicit test CA; unknown chain, wrong hostname and TLS 1.1 rejected. OpenSSL reports Brotli and Zstd disabled. |
| PHP package OpenSSL | Package still contains 3.0.22; upstream support/advisory issue is not magically fixed. ReFind uses no PHP OpenSSL/cURL API and the selected minimal ini leaves both extensions unloaded. HTTP module inspection confirms no PHP-side old crypto dependency; TLS uses Apache's verified libraries. Re-review a complete matched package before enabling either extension. |
| Node 24.22.2 | Complete official portable archive hash matched against SHASUMS256; used only in QA. Global Node 24.15.0/npm 11.12.1 unchanged. |
| MariaDB 11.4.13 | Complete official archive hash matched; fresh test-only datadir, logical app-schema import. Vendor identifies the 11.4 series as maintained through May 2029. No executable-only replacement/raw datadir copy. |
| Browser/video tooling | Existing locked Playwright 1.64.1, sharp and axe modules read-only; installed Chrome with separate temporary contexts. Playwright downloaded FFmpeg 1013/Winldd 1007 through its normal official verified-HTTPS installer into the owned cache only. No dependency/global/browser-profile modification or independently verified publisher digest for those cache files is claimed. |

PHP's vendor advisory calls for PHP 8.4.27/8.2.35 or later for CVE-2026-109618/109619 and identifies mod_php as the highest demonstrated exposure case. Main remains affected by version; synthetic success is not remediation of it. The Windows -1 package rebuild is separately identified. [PHP advisory/rebuild](https://www.php.net/archive/2026.php), [ASF Windows fixes](https://httpd.apache.org/security/vulnerabilities_24.html), [provider package/BOM](https://www.apachelounge.com/download/), [Microsoft deployment guidance](https://learn.microsoft.com/en-us/cpp/windows/redistributing-visual-cpp-files?view=msvc-170), [Node sums](https://nodejs.org/dist/v24.22.2/SHASUMS256.txt), [MariaDB release](https://mariadb.com/docs/release-notes/community-server/11.4/11.4.13).

October claim recheck: Node's vendor confirms the October 21 security release; 24.22.2 is the selected subsequent patch. MariaDB's current 11.4.13 release/support and security register substantiate the candidate, but a claim of a distinct October maintenance release is not established by those dates; CVE publication can follow the release. phpMyAdmin's vendor register still lists 2025 advisories and stable 5.2.3; an October 2026 application security release remains unsupported. Main phpMyAdmin 5.2.1 was not upgraded. The official MariaDB checksum is in the **winx64-packages/sha256sums.txt** directory, verified independently; the root-level guess returned 404 and was corrected. [Node October advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases), [MariaDB release](https://mariadb.com/docs/release-notes/community-server/11.4/11.4.13), [phpMyAdmin register](https://www.phpmyadmin.net/security/).

### Native qualification remaining

The entire downloaded archive is not declared vulnerability-free. Unused mod_brotli/curl/proxy modules are omitted; Apache's optional bundled Brotli 1.2.0 remains a package caveat. Unused old PHP OpenSSL files remain private and inactive rather than being replaced with arbitrary DLLs.

Allowlisted actual PHP metadata: PCRE 10.44 (2024-06-07), zlib 1.3.2, libxml header 2.11.9/loaded 21109, Oniguruma 6.9.10, FreeType 2.15.0, JPEG API 8, PNG 1.6.59 and WebP support. Read-only inspection of the verified php_gd.dll identifies the embedded string **libjpeg-turbo version 3.2.0 (build 20260804)**; this is binary identifier evidence, not a runtime version API or a full vendor SBOM. Upstream lists 3.2.0 as active/stable. Exact WebP version and PHP vendor backport/support qualification for PCRE/libxml remain **unverified**. [JPEG maintainer release](https://github.com/libjpeg-turbo/libjpeg-turbo/releases/tag/3.2.0). A PHP source-tag/ChangeLog lookup did not establish those backports; no unsupported conclusion is inferred solely from an old displayed version.

Upstream PCRE checks distinguish prerequisites: CVE-2025-58050 affects 10.45, not displayed 10.44; GHSA-fmgr-6ggq-9859 and GHSA-q8g2-wprr-34m9 require 32-bit processes/APIs absent from this x64 PHP use; GHSA-3r4p-g7gg-ppmf requires the DFA API; GHSA-9qww-pwc4-77qq and GHSA-2p8c-ff85-vh9x require invalid-UTF matching modes/specific patterns. ReFind uses fixed/allowlisted regexes and no XML parser routes. These missing prerequisites are a source-based reachability inference, not proof of vendor patch status. Do not execute exploit payloads to resolve it. [PCRE advisory index](https://github.com/PCRE2Project/pcre2/security), [10.45-only advisory](https://github.com/PCRE2Project/pcre2/security/advisories/GHSA-c2gv-xgf5-5cc2), [32-bit compile](https://github.com/PCRE2Project/pcre2/security/advisories/GHSA-fmgr-6ggq-9859), [32-bit convert](https://github.com/PCRE2Project/pcre2/security/advisories/GHSA-q8g2-wprr-34m9), [invalid UTF](https://github.com/PCRE2Project/pcre2/security/advisories/GHSA-9qww-pwc4-77qq).

The remaining native BOM items are not confirmed exploitable ReFind application defects. For a local urgent PHP patch, document their prerequisites and the operator's residual-risk decision alongside the required real backup/restore evidence; do not silently convert unverified backports into patched status. Public deployment remains a separate WP05 gate. The tested 8.4 candidate is preferred; an 8.2 bridge is justified only by a concrete unresolved compatibility/package blocker and its own tests, not by assuming it has newer native dependencies.

### Additional Node and MariaDB native evidence

Node 24.22.2 actually reports OpenSSL 3.5.9, Brotli 1.2.0, c-ares 1.34.9, Undici 7.30.1, libuv 1.52.1, zlib 1.3.2.1-motley-285e94b and V8 13.6.233.17-node.63; its bundled npm is 11.19.1, separate from global npm 11.12.1. Despite the retained Brotli version string, the vendor's 24.22.1 security notes explicitly identify the CVE-2026-111497 cherry-pick 0ed4268a4401abcb44720963. The selected 24.22.2 package follows that release. Classify this Node backport as patched by vendor evidence, not potentially affected solely by the displayed upstream number. [Security-release backport](https://nodejs.org/en/blog/release/v24.22.1), [selected patch](https://nodejs.org/en/blog/release/v24.22.2).

The owned LTS server reports **11.4.13-MariaDB / WolfSSL 5.9.1 / have_ssl YES**. Its server defaults are latin1/latin1_swedish_ci, SYSTEM timezone and STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION. Imported schema/tables explicitly use utf8mb4/utf8mb4_unicode_ci; I/S app/db.php:12-13 sets connection utf8mb4 and UTC. The exact synthetic Unicode/null/time/value fingerprints survived import; do not inherit server defaults when creating future databases.

| Candidate library risk | Applicability and confidence | Minimum next action |
|---|---|---|
| WolfSSL CVE-2026-93302, upstream High | 5.3.0–5.9.2; fixed 5.9.4. Requires trusted-peer certificate APIs/build configuration. Displayed 5.9.1 matches the range; MariaDB's compiled options/backports/reachability are unverified. **Potentially affected**, not a confirmed ReFind exploit. | Obtain MariaDB vendor backport/build evidence or a complete provider-supported patched package; retain local-only binding. No DLL substitution. |
| WolfSSL CVE-2026-89102, upstream High | 5.7.2–5.9.2; fixed 5.9.4. Client OCSP stapling-v2 multi-response prerequisites not demonstrated in this standalone QA server. Backports unverified. **Potentially affected** by version, exploitability unverified. | Qualify any DB TLS client/replication paths before promotion; consult the complete vendor register for other conditional 5.9.2/5.9.4 fixes. |

The [WolfSSL register](https://www.wolfssl.com/docs/security-vulnerabilities/) and [5.9.4 release evidence](https://github.com/wolfSSL/wolfssl/releases/tag/v5.9.4-stable) were accessed 2026-11-02; the latter is dated 2026-09-27. NVD/CVE API lookups did not return readable independent records here; these identifiers/ranges remain attributed to the vendor, not falsely marked independently CNA-verified. This is an additional WP04 native qualification item, not a reason to replace a library manually or assume another MariaDB series has a safer Windows build.

Two metadata probes ran after the matrix had shut down its server and correctly failed to connect; no main fallback occurred. The MariaDB client also printed an automatic-SSL warning on that failed probe. The corrected inspection started only its owned LTS server, verified password denials, and stopped it. A separate explicit-CA/--ssl-verify-server-cert test then negotiated TLS 1.3 and rejected an unrelated CA. Full application matrices used the existing local TCP connection behavior; database certificate verification is asserted only for this explicit TLS test. No certificate-verification override or global CA installation was used in the explicit TLS tests; ordinary trust rejection does not test the specialized WolfSSL advisory cases.

## Owned native environment and fixture protections

Logical root: `C:\Users\LENOVO\AppData\Local\ReFindRuntimeQA\security-modernization-a2d82264c5570f0b`.
Canonical root Q: `C:\Users\LENOVO\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\ReFindRuntimeQA\security-modernization-a2d82264c5570f0b`.

The root is outside webroots/repos, ACL-restricted to this user/SYSTEM. HTTP binds 127.0.0.1 and ::1:8086; TLS equivalently uses 8446. Old test DB binds only 127.0.0.1:3312, LTS only 127.0.0.1:3313. Main/legacy/staging ports, accounts, storage and sessions are not accepted. No Windows services, firewall exceptions, OS CA trust entries, tunnel, Docker or scheduled process were created.

The native profile checks exact canonical parent/name/root/source marker and phase, frozen public source hashes, no redirects, new datadir ownership, 127.0.0.1/_test database/test principal/base path/session name, and actual server @@port/@@datadir before fixture mutation. Unknown profile names fail closed in PHP, Node and the legacy Python preparer; runtime-upgrade cannot trigger legacy copy/setup. CLI auto-prepend protects owned fixture scripts that otherwise seed files before their explicit guard. An additional actual-server negative probe confirmed both PHP and Python reject a foreign private datadir using identity SELECTs only; the Python probe supplied the verified LTS client path because the restore root has PHP only, without mocking returned SQL values. Temporary synthetic config was restored byte-for-byte; an initial missing-client probe also cleaned up before the corrected probe passed. Separate negative tests exercise structural boundaries without touching a DB.

Only a new owned datadir may be initialized. MariaDB starts with --no-defaults, explicit basedir/datadir/port/tmp/log paths, small buffers and no service flag. Shutdown checks server identity. Apache shutdown targets only the process handle/PID tree launched by this runner. Errors retain logs and receipts and stop the owned processes. Main was stopped at the initial preparation checkpoint. The final privileged read-only inventory confirms the existing XAMPP instances running: Apache parent PID 17468/child 19732 and MariaDB PID 19572, launched from xampp-control.exe around 12:40 +07 on 2026-11-02. Their original wildcard 80/443/3306 listeners are active. These were not started, stopped or reconfigured by the QA tools; earlier stopped-state statements apply only to the initial checkpoint. Owned QA processes are stopped. No main HTTP/SQL probes were used.

Production-style LTS web principal has SELECT/INSERT/UPDATE/DELETE on the test schema and global USAGE only. CREATE TABLE returned expected 1142 denial. A separate CLI fixture principal retains DDL solely in the test schema. Actual HTTP confirmed refind_runtime_dml@127.0.0.1 on 3313. The generated conditional synthetic configuration is a test mechanism, not a proposal to put fixture/admin credentials in production.

## Verification executed now

These are new tests on 2026-11-02, distinct from the original audit's historical checkpoints. Raw synthetic artifacts/logs stay private under Q; tracked evidence contains counts/statuses/hashes only. [Redacted continuation receipt](evidence/2026-11-02-native-qualification.json).

| Check | Baseline and result |
|---|---|
| Offline archive/preparer negatives | 10 passed, no skips |
| Native identity/profile negatives | 7 groups passed, no skips; main/legacy port, wrong host/database/user/base/session/root/phase/source, redirects, missing environment and unknown-profile fallbacks refused |
| Synthetic backup negatives | 6 passed, no skips; corrupt/foreign/live/unpaused artifacts, redirected directory/path set refused; line-delimiter-only canonicalization preserves changed-value detection |
| Existing offline release suite | 15 passed, no skips, candidate PHP; no HTTP/DB |
| Source syntax | 30 candidate PHP files passed; changed Python/PHP/Node tooling syntax passed |
| HTTP boundary | Both IPv4/IPv6 report owned 8.4 apache2handler/ini; seven private/CGI/AJP paths 403. Temporary public runtime probes removed afterwards |
| TLS | W and I each passed the same 4 checks: explicit trusted test chain/hostname and Secure/HttpOnly/Lax cookies, unknown CA rejected, wrong hostname rejected, TLS 1.1 server rejection; negotiated TLS 1.3; loaded OpenSSL 3.5.9/CRT 14.51 |
| LTS TLS/authentication | Explicit private CA and certificate verification enabled: TLS 1.3/AES-256-GCM established; unrelated CA rejected with 2026 error. Empty/wrong root and runtime passwords each rejected with 1045. No OS trust or app DB transport change. Ordinary TLS success does not clear WolfSSL advisory prerequisites. |
| Legacy PHP formats | Synthetic cost-10 bcrypt verifies unchanged; PHP 8.2's 26-character session ID and php-format Unicode/null/auth payload read by 8.4 strict mode without ID change. No real hashes/sessions read |
| W + PHP 8.4/Apache + MariaDB 11.4 | **26/26 PASS**, clean full run `20261102-124742-lts`, source subset b797e36f...; HTTP DML-only principal, separate CLI fixtures |
| W + candidate stack + MariaDB 10.4 | All relevant stages covered across retained core/remainder/appearance runs; **not represented as one clean full run**; interrupted attempts and corrections below |
| I + candidate stack + MariaDB 10.4 | **25/25 PASS**, clean full run `20261102-132957-current`, source subset 59d7a5ae...; separate owned root security-modernization-a458ebb05c3f239c. Its 14-table/601-row/463-runtime-file frozen snapshot also imported unchanged into LTS; **25/25 PASS** on LTS in clean run `20261102-135458-lts` with the DML-only HTTP principal |
| WP06 | Five offline maintenance tests and live OSV 115 locked npm/Packagist pairs passed with exactly one reviewed tooling exception; no lockfile change. [GitHub Actions success](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5/actions/runs/41393370461) |

The full native matrix includes schema/invariants before and after, canonical projection, security, both light/dark auth/account/student/workflow/v025/UX suites, layout, UI/profile, glass/menu, theme/appearance and smoke; W additionally has the maintainability suite. Assertions cover Guest/Student/BM boundaries, protected account fields, CSRF, response omissions/private media/path checks, password change/session replay/revocation/throttling, malformed uploads, stale revisions/competing approvals/rollback/uniqueness, withdrawal/resubmission/final rejection, pickup cancellation vs release vs completion, timezone and null times. Image metadata stripping, malformed decoder fuzzing, real data/backup compatibility, router/off-host exposure and performance at production load are not established by this matrix.

### Retained failed attempts and corrections

- W runs 114915/115008: duplicate guard inclusion and CLI display-errors-off diagnostic prevented harness progress. Switched require to require_once and returned a generic safe stderr denial; original negative-test assertion kept.
- W run 115243: 17 core stages and final schema/invariants passed; UI/profile lacked bare sharp module discovery. Added explicit read-only NODE_PATH to the existing locked modules, no install.
- W run 120713: UI/profile passed, glass suite required rich synthetic items. Seeded the existing fixture generators; no UI/application or assertion change.
- W run 121037: remaining UI/profile/glass/menu/maintainability/theme passed; appearance video needed FFmpeg. Installed only the private Playwright tool cache through official verified HTTPS.
- W run 122950: six-stage appearance/smoke/schema/invariant subset passed. One console label initially said full matrix; fixed the label and kept the correctly scoped receipt. Only the later 124742 LTS run is a clean full 26-stage pass.
- Initial LTS import succeeded but all table hashes differed because the 10.4 Windows client used CRLF record delimiters and 11.4 used LF. Compared every frozen original hash with a delimiter-only canonicalizer, added a changed-value negative test, then verified the already imported data. Did not reimport, overwrite expected fingerprints or normalize stored values.
- Installed-source private package copy first hit Windows MAX_PATH. Completed only that new owned copy through extended paths and compared every copied file hash before initialization; no policy/junction/guard change.

## Synthetic migration and recovery evidence

Frozen backup: Q/backups/synthetic-20261102-121017. HTTP writers paused, database-only snapshot; SHA256 of database.sql and storage-config.zip verified. **14 tables, 591 rows, 436 runtime/media/config files**. No main/real backup contents used.

The new LTS datadir imported that logical application database. All 14 table counts/value fingerprints matched and 9 schema plus 18 workflow checks passed; original media/config archive hashes matched. Later QA mutations are independent of the frozen snapshot and are not expected to match it.

Restoration rehearsed into new owned root `security-modernization-083d45badec12fb4`, old MariaDB 10.4.32 with a freshly initialized datadir. Restored original SQL and matching synthetic media/config files; all 14 table fingerprints and all 436 runtime-file hashes matched. Schema/workflow checks passed. No raw datadir or mysql privilege-table copy, overwrite of an existing DB, or main DB operation occurred. Receipts remain in the owned backup directory.

The archive contains synthetic local credentials/session files and stays private. Tracked records contain no payloads, credentials or actual user data. The real main data's size, engines, grants and restoration remain unverified. A real cutover requires a separate paused-write backup and successful private restore, not reliance on synthetic success. [Detailed migration/rollback runbook](NATIVE_RUNTIME_MIGRATION_RUNBOOK.md).

## Runtime fingerprints

Complete extracted package trees including app-local CRT; SHA256 aggregate of sorted Windows Path relative POSIX path + NUL + file SHA256 + LF. Enumeration uses extended paths so every long-path file is included. The initial Node 1986-file fingerprint df346db3... omitted eight files through ordinary Windows enumeration; the complete 1994-file value below supersedes it. The copied distributions were compared with extended paths before tests. These package fingerprints use Windows Path ordering, distinct from the source-list string ordering; original archive SHA256 values remain separately pinned.

| Private runtime | Files | SHA256 |
|---|---:|---|
| PHP | 92 | 5c8ffa605a3c7eb48aba577d5b2aff91f33da1cb7990a559af0fb13b10f5a8ae |
| Apache | 1011 | e4136c0f7f2dd6c28552482e82ab5592985a750e787f01793e32784a912aa830 |
| Node | 1994 | 954a55a7ea6290988a36bad8a3d80d64c29cf3390118aa5a75986700240fc50a |
| MariaDB | 616 | d7e78ba1d49dc417330133e50400feccfe2ffcff3a124e71094824abc466def0 |

## Review and rollback boundaries

The tooling/receipts and dependency CI are independent development changes. Runtime branch retains earlier preparation commits; new native profile (7905500), recovery tools (e8671df), explicit database TLS/UTF-8 qualification (1d8b6ad) and evidence are separate reviewable commits. No unrelated follow-up refactor, application/UI behavior, lockfile or business-rule change is included. Push only to the v025 remote; origin is the older v0.2.0 repository. No Git configuration/author settings changed; commits use command-scoped Codex identity.

GitHub integration PR creation returned HTTP 403, Resource not accessible by integration. A read-only comparison opened through the computer-use plugin showed GitHub signed out; no credentials read or permission expansion attempted. No PR created or merged. Use [runtime branch comparison](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5/compare/main...codex/security-wp01-wp02-preparation) and [dependency branch comparison](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5/compare/main...codex/security-dependency-maintenance). Sign in, select base main and the stated head, Create pull request, then Create draft pull request. Do not merge until separately approved.

Suggested runtime PR title: Qualify an owned Windows-native PHP 8.4 stack and synthetic recovery.
Description: Adds fail-closed native QA ownership/profile tooling and synthetic logical migration/restore rehearsal. Preserves application routes/rules, main XAMPP and data. Includes package provenance, full compatibility/security matrix evidence and explicit live-system approval/rollback gates.

Rollback for this continuation is to stop the owned private test processes (already handled by the runners) and revert the specific source/tooling commit if necessary. Do not remove another worktree, change live rule state or restore synthetic fixtures into main. Leave private artifacts stopped for review; no broad cleanup is required. Operational rollback for proposed WP01 and future cutovers is in the linked documents.

Final preservation/result checkpoint follows the final source/configuration/rule comparison. No additional full matrix was repeated for the optional explicit-TLS-only runner flag: default arguments are unchanged, the actual TLS positive/negative cases passed, and the new no-overwrite guard and syntax checks passed.


## Final preservation and next approval

Final privileged inventory on 2026-11-02: installed I is still clean (605-file source SHA256 unchanged); W retains the exact original 80 status entries/status SHA256 and 609-file source SHA256; both original audit copies retain SHA256 372eb6a46f2eaa29cc761b47dfb1e6adb66133e60bdad41e28676a6c8040ad0a. All four main configuration hashes match the proposal. The exact four firewall rules are still enabled with the same Public/Any local filters in PersistentStore and ActiveStore; no matching Windows service was registered. No owned QA process/listener remains on 8086/8446/3312/3313.

**Main is currently running on its original wildcard listeners**, as confirmed by process creation/parent metadata and listener inventory. It began through the existing XAMPP Control Panel around 12:40 +07; this continuation did not launch that panel or those main instances. Its current state is preserved. Main data/accounts/hashes/media/session contents were not inspected or changed by these tools. A source/config hash check does not assert that another user's live application activity cannot change its own runtime data.

Next operational proposal: approve only the exact WP01 four-rule/four-configuration containment change in the linked proposal, including a coordinated pause/restart window for the currently running XAMPP instances. Impact covers every consumer of those binaries; intentional shared LAN/CGI/AJP requirements remain an operator review item. Keep PHP/Apache runtime cutover, database migration, public deployment and GitHub main merge as separate future approvals. Main PHP 8.2.12 remains urgent to patch after containment and the approved backup/cutover preparation; isolated passes do not patch it.
