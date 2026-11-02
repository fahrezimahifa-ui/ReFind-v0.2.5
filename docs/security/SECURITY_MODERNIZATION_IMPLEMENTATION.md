# WP01 and WP02/WP03 preparation record

Checkpoint: 2026-11-02. Branch: codex/security-wp01-wp02-preparation.
Scope: WP01 read-only exposure revalidation and exact change proposal; inert Windows-native QA preparation. **WP01 containment is not applied. WP02/WP03 are not complete and no runtime cutover is approved.**

Authority: [approved audit and modernization plan](REFIND_SECURITY_AUDIT_AND_MODERNIZATION_PLAN.md).
Review: [exact WP01 proposed changes, acceptance and rollback](WP01_EXPOSURE_CHANGE_PROPOSAL.md).

## Source identity and preservation

| Baseline | Identity / current result |
|---|---|
| GitHub main | Independently resolved through GitHub on 2026-11-02 to a610b1a0cb7ebb2b911f3468388076948a65b238 |
| Installed application | C:\xampp\htdocs\ReFind_0.2.3; 4d74e9872b3afa5fa1ab09c081b30d1a3437a2b5; codex/release-readiness; clean |
| Latest development source | C:\Users\LENOVO\.codex\worktrees\refind-v025-maintainability\ReFind_0.2.3; a610b1a plus existing follow-up; 80 pre-existing status entries including report |
| Security preparation | New separate worktree C:\Users\LENOVO\.codex\worktrees\refind-security-wp01-wp02\ReFind_0.2.3, based on a610b1a; no application code modifications |

The installed 605-file fingerprint remains d9475b06037997c8f5a2b8d1c72b589477f79e7b5b57ebec626774580d49cabc.
The follow-up 609-file fingerprint excluding the report remains 7baac5e0857ed460905a32a7b010ed57ab77bf6ef8b2ac88b28c29bc975c5033.
Algorithm: sorted unique git ls-files -co --exclude-standard, per-file SHA256, aggregate UTF-8 path + NUL + hash + LF, excluding the audit report.
The approved report is copied unchanged into this branch: SHA256 372eb6a46f2eaa29cc761b47dfb1e6adb66133e60bdad41e28676a6c8040ad0a.

No main app/config.local.php values, auth secret, session payload, private uploaded content, database records or backup contents were inspected. No main HTTP requests, database connections, Windows Firewall/service configuration changes, executable replacements, service installs, MariaDB migration, deployment or GitHub main merge occurred.

## WP01 outcome

Apache and MariaDB are currently stopped; ports 80/443/3306 have no listeners at this checkpoint. The four enabled Public Any-address/Any-port allow rules and wildcard configured listeners remain present. Effective inbound default is Block, outbound Allow, across all enabled firewall profiles. Active network category is Public.

The minimum proposal disables exactly those four rule IDs, binds Apache HTTP/HTTPS to IPv4/IPv6 loopback and MariaDB to IPv4 loopback, and removes unused CGI/AJP mappings. Existing local-only admin restrictions are retained. Other XAMPP consumers could be affected by local-only binding or CGI/AJP removal, so the review explicitly covers that scope.

Remaining WP01 evidence: equivalent native QA listener/alias tests, user review, private rollback snapshots at application time, main syntax/effective-listener checks in an agreed verification window, and any authorized off-host reachability test. No outside-client or router exposure conclusion is claimed.

## Prepared native QA artifact

Owned private directory:

C:\Users\LENOVO\AppData\Local\ReFindRuntimeQA\security-modernization-a2d82264c5570f0b

It is outside htdocs, restricted to the current user and SYSTEM, and contains:

- conf/httpd.conf: inert minimal Apache configuration for 127.0.0.1 and ::1 port 8086, same /ReFind_0.2.3/ public path, original .htaccess routing, no CGI/proxy/AJP/Brotli/admin mappings.
- conf/php.ini: matched extension paths; display errors off; upload-progress disabled; private temporary/log/session paths. This is candidate QA configuration only.
- conf/my.ini: planned new datadir db/data on 127.0.0.1:3312, 64 MB InnoDB buffer. No datadir initialization or MariaDB process start.
- www/ReFind_0.2.3: 84 reviewed deployment files from the newest follow-up, plus new synthetic local configuration and empty separate storage collections. No setup/fixture tools, SQL files, ignored configuration, existing accounts, session/auth files or media were imported.
- php/: the complete hash-verified PHP 8.4.27-1 TS VS17 x64 package.
- downloads/: original PHP archive retained for provenance.
- .refind-runtime-qa.json: source manifest, pinned package identity, preparation-only phase and blockers; fixture_mutations_enabled is false.

Deployment-subset fingerprint: b797e36fd87c53e37e6f8a77fe491f6357486064ce6cd020b512087d67e529e3 (84 files). It differs deliberately from the full source fingerprint because the QA copy contains deployed code only. The generated synthetic config is additional and excluded from this source hash.

HTTP 8086, reserved TLS 8446 and database 3312 were checked unused for both address families before preparation. No listener, Windows service, firewall exception or scheduled background task was created. TLS is reserved but not configured or tested.

The preparer supports **file preparation only**. It deliberately has no start, setup, sync-over-existing or cleanup action. Do not run the existing legacy QA suites against this tree: a dedicated runtime-upgrade ownership profile is still required. No change was made to the existing 3311 staging, Docker or legacy QA profiles.

## Current package/advisory verification

Access date for all sources below: 2026-11-02.

| Component | Verified result / implications |
|---|---|
| Existing PHP 8.2.12 mod_php | Still below the PHP fixes for CVE-2026-109618 / CVE-2026-109619. PHP identifies mod_php as the highest demonstrated exposure case. Treat patching as urgent after containment; no exploit payload was run. [PHP vendor advisory](https://www.php.net/archive/2026.php#2026-10-21-5) |
| Candidate PHP | Official Windows metadata lists 8.4.27-1 TS VS17 x64, Oct 26 package rebuild. Archive SHA256 53db2047139bdfb8e6c7c7d5860a0a6a2a4f1dcac49fcf18ae610a14d8ccdf5b matched locally. Rebuild includes the vendor's Brotli fix; the runtime version string stays 8.4.27. [Metadata](https://downloads.php.net/~windows/releases/releases.json), [Windows rebuild notice](https://www.php.net/archive/2026.php#2026-10-26-1) |
| Apache candidate | ASF 2.4.69 fixes Windows CVE-2026-59685 (affected through 2.4.68), among other issues. Provider advertises 2.4.69-261002 VS18 x64. Published SHA256 77d715d0d9cee731e2251e7ddc2090a7a8e6d41fedef2e9827cd918593c5a652 is pinned, **not locally verified**, because no Apache archive was obtained. [ASF advisories](https://httpd.apache.org/security/vulnerabilities_24.html), [provider](https://www.apachelounge.com/download/), [checksum](https://www.apachelounge.com/download/VS18/binaries/httpd-2.4.69-261002-Win64-VS18.zip.txt) |
| Apache download blocker | The advertised HTTPS binary URL returned HTTP 308 Location: http://localhost/. The original attempt followed it and failed with connection refused; the preparer now rejects off-origin or HTTP redirects before following them. No HTTP archive, alternative unofficial mirror or unverified executable was accepted. Metadata pages remain accessible. |
| Apache native BOM | Provider lists OpenSSL 3.5.9 and Brotli 1.2.0; the latter still has the October decoder advisory. The minimal QA config omits Brotli/cURL/proxy modules, but a future loaded-library/path review is required; do not call the complete bundle fully patched. [Provider BOM](https://www.apachelounge.com/viewtopic.php?p=44502) |
| CRT prerequisite | Provider requires Visual C++ x64 14.51.36247. Registry inventory reports v14.42.34438.00 installed, while actual System32 vcruntime140.dll / msvcp140.dll files report 14.44.35211.0. Neither establishes the provider's 14.51 prerequisite. PHP VS17 CLI starts, which does not validate Apache VS18. No shared CRT update, installer or hand-copied DLL replacement was performed. [Provider prerequisites](https://www.apachelounge.com/download/), [Microsoft deployment guidance](https://learn.microsoft.com/en-us/cpp/windows/redistributing-visual-cpp-files?view=msvc-170) |
| PHP package OpenSSL | CLI extension reports **Library and Header 3.0.22, 25 Aug 2026**, independently of Apache's advertised 3.5.9. Upstream 3.0 is unsupported. September CVE-2026-35189 and CVE-2026-54872 list versions before 3.0.23 affected. Version applicability is confirmed; ReFind exploitability is unverified and depends on the relevant certificate-processing/non-NIST signing paths, which were not exercised. Resolve matched-package support/BOM before stack acceptance; do not manually swap libcrypto/libssl DLLs. [OpenSSL support policy](https://openssl-library.org/policies/releasestrat/), [3.0 advisories](https://openssl-library.org/news/vulnerabilities-3.0/) |
| PHP 8.2 bridge | Official 8.2.35-1 TS VS16 x64 remains an option only if a concrete 8.4 regression blocks timely patching. It was not downloaded or selected; PHP 8.4 CLI has no observed failure so far. |
| MariaDB / Node / phpMyAdmin | Existing versions are unchanged. No upgrade, database query or dependency installation was part of this preparation. Their broader audit findings remain open; this checkpoint does not reclassify them as patched. |

No Apache web SAPI, DLL compatibility, TLS negotiation or network denial claim is made from CLI-only success. Publisher SHA256 over TLS is the completed PHP provenance check; no PGP signature verification is claimed.

## Checks actually executed in this package

| Check | Baseline / result |
|---|---|
| Source identities/status/fingerprints | Installed and follow-up hashes match the audit; clean installed tree and 80-entry follow-up overlay preserved |
| Windows exposure inventory | Read-only process/listener, firewall rule/filter/effective policy, network category, service and CRT metadata |
| Existing executable identity | PHP 8.2.12, Apache 2.4.58, MariaDB 10.4.32, version commands only |
| New preparation safety tests | python -B tools/test-runtime-qa.py: **10 passed**, no skips. Includes ZIP traversal/absolute paths/Windows aliases/streams, archive symlink/case collision, junctions, hash mismatch, preserved existing destination, hidden/private/unreviewed source exclusion, off-origin/downgrade redirect rejection failed-download ownership receipts and loopback template checks |
| Candidate PHP CLI/extensions | 8.4.27 ZTS x64 CLI, no startup stderr; mysqli/mysqlnd 8.4.27, mbstring, fileinfo, sessions, GD JPEG/PNG/WebP available; upload-progress 0 |
| Candidate image/native metadata | FreeType 2.15.0, JPEG API 8, libPNG 1.6.59; OpenSSL Library/Header 3.0.22. Support flags are not full malformed-image/media tests |
| Candidate source syntax | **30 PHP files passed**, using the newest follow-up's deployed QA copy including the new synthetic configuration |
| Existing offline regression suite | **15 tests passed**, tools/test-release.py from the a610b1a security worktree, using candidate PHP via REFIND_PHP and PHPRC. Synthetic temporary files under that new worktree's ignored output only; no database/HTTP access |
| Historical regression ledger | The approved report's earlier full and focused checkpoints remain historical, not new tests for this package |
| Browser/API/transaction regression | **Not run**: Apache/CRT/native BOM and mutation guards pending. No real account login or synthetic SQL setup was attempted |

## Next isolated implementation increment

1. Obtain an intact official/provider Apache archive over HTTPS and verify the pinned checksum (or re-research a changed supported package). Resolve the compatible CRT prerequisite. A shared system CRT installation affects more than this QA tree and requires its own concrete review/approval; no installer has been run.
2. Resolve the candidate PHP OpenSSL support/advisory issue through a provider-supported complete package/dependency set. Record loaded DLL paths, not only compile-time version strings. Do not mix arbitrary DLLs or declare the stack supported based solely on PHP core's version.
3. Add a small, separately reviewed runtime-upgrade profile to qa-runtime.cjs, qa-guard.php, setup-db.php and the projection/profiling discovery adapters. Preserve all existing profiles. Before any fixture write verify the exact private root/marker/source identity, absence of junctions, ports 8086/3312, host 127.0.0.1, _test database, refind_runtime_qa user, base path and unique session name. Check @@port and @@datadir against the owned new server before mutation; fail closed on mismatches.
4. Negatively test main/legacy QA ports, wrong datadir/user/session/root/marker, missing marker, occupied ports and redirected paths before initializing any synthetic schema.
5. Initialize **only a new** db/data on 3312 with isolated credentials; use the existing MariaDB binary read-only if compatible. This is a new synthetic server, not migration of the main database, and the inherited 10.4 support limitation must remain explicit. Never connect fixtures to main 3306 or legacy/staging servers.
6. Start only the exact owned native processes, hidden and without Windows service registration, for the test window; verify PIDs/executable/config/datadir identities and stop them afterwards. First prove loopback IPv4/IPv6 and private/alias denials.
7. Run roadmap T01-T11 as applicable, full Student/BM matrix and both themes, canonical API projections, concurrent sessions/claims/handovers, synthetic uploads and schema/invariant checks. Existing suites require updated explicit discovery; do not bypass guards with arbitrary environment URL overrides.
8. Review the complete receipt before applying approved WP01 host changes. WP02 PHP replacement, WP03 main runtime switch, database migration and public deployment remain separate approval gates.

## Rollback and review boundaries

- This increment: no running QA processes exist. Leave the inert private tree stopped. To remove it later, first verify the exact marker/root and resolved path under LOCALAPPDATA/ReFindRuntimeQA, reject junctions, confirm no owned process uses it, then delete only that explicitly verified directory using native PowerShell. No broad cleanup command is provided.
- Revert the preparation commit(s) on the security branch if needed; this does not roll back main because main was never changed. Preserve the existing maintainability worktree and its uncommitted overlay.
- WP01 operational rollback is in the exact change proposal; containment must remain during recovery.
- No original database dump/raw datadir, media, credentials, hashes or sessions are copied or restored in this package.
- Proposed review units: (1) audit/proposal documentation; (2) inert QA preparer/negative tests; (3) later fixture-profile integration and isolated regression evidence; (4) separately approved operational application/cutover. Keep unrelated follow-up refactors and UI changes out of the security branch.

## Final review checkpoint

The proposal/evidence and inert tooling were committed separately as fd4c7f7 and b499942 and pushed only to codex/security-wp01-wp02-preparation. Commits use a command-scoped Codex agent identity because no author was configured; existing Git settings were not changed.

GitHub main was re-resolved after the push and remains a610b1a0cb7ebb2b911f3468388076948a65b238. Draft PR creation through the GitHub integration returned HTTP 403, Resource not accessible by integration. No GitHub CLI is installed. No PR was created or merged. The branch is available for [comparison/review](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5/compare/main...codex/security-wp01-wp02-preparation).

Final preservation checks again returned the same installed/follow-up source fingerprints, zero installed status entries and the original 80 follow-up entries. All four main configuration SHA256 values match the pre-change table. No XAMPP or new QA listeners/processes were present. The owned QA receipt remains prepared-incomplete with fixture mutations disabled, no db/data directory and no Apache package. The new native web environment is not ready to run regression yet.
