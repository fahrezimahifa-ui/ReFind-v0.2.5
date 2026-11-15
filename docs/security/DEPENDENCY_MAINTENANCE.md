# WP06 dependency and advisory maintenance

Branch: codex/security-dependency-maintenance. Review date: 2026-11-02.
This is a source-only maintenance change. It does not update dependencies, alter ReFind behavior, patch the installed runtime or approve deployment.

The checker reads the npm and Composer lockfiles, queries OSV over verified HTTPS when --online is supplied, and fails on an advisory without an exact current review exception. It also fails on expired exceptions or overdue native-component reviews. OSV does not replace vendor/native-library review.

A tracked-source scan reports high-confidence token/private-key matches with file and line only, replacing the value with REDACTED. Protected configuration/runtime filenames are rejected before their contents are read, and filesystem redirects are refused. This is a bounded pattern scan, not proof that every possible secret is absent. Ignored credentials, sessions, uploads, backup contents and machine configuration are not scanned.

The workflow runs on pull requests, its review branch, manual dispatch and weekly after merge. It uses a verified immutable actions/checkout v6 commit, contents: read, persist-credentials: false, a five-minute timeout, and Python's standard library. It installs no dependencies, starts no application/database, requires no Docker and writes no issues or notifications through an API. GitHub main remains unchanged until the owner approves a merge.

## Current advisory decision

The 2026-11-02 live OSV query covered **115 locked package/version pairs**. One finding remains: minimatch 10.2.6, GHSA-g3hv-75wg-m249 / CVE-2026-118764. The [vendor advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249) identifies attacker-controlled glob patterns with optimizationLevel >= 2 as the trigger and 11.0.1 as fixed.

Official npm metadata currently lists minimatch 11.0.4 and ESLint 10.14.0; ESLint still requires minimatch ^10.2.6. Forcing a major override would violate the parent range. The exception is limited to this exact package, version and advisory, owned by ReFind maintainers and expires **2026-11-16**. ReFind's PHP HTTP application does not execute Node or accept glob patterns into this tool. Repository-controlled lint/CI inputs are a separate tooling risk, bounded by job timeouts. This is an explicit temporary risk decision, not a patched classification.

Review a compatible upstream dependency graph when available. Do not remove a failing assertion or extend the exception automatically. Native installed/candidate versions also have a 2026-11-16 review deadline; their known operational risks and approval gates remain in the [runtime implementation record](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5/blob/codex/security-wp01-wp02-preparation/docs/security/SECURITY_MODERNIZATION_IMPLEMENTATION.md).

## Verification and rollback

Run these from this worktree:

~~~powershell
python -B tools/test-security-maintenance.py
python -B tools/check-security-maintenance.py --online
~~~

Five offline tests passed: private filenames are refused without reads, reported values are redacted, new advisories fail, exceptions match exact versions and expire, and stale native reviews fail. The live query returned the one reviewed finding, no unreviewed advisories and no secret-pattern hits. The lockfiles remain byte-identical to main.

Rollback is a source-only revert of this change set. Do not replace dependency manifests/installed packages separately or silently remove recorded unresolved risks. The live application is unaffected by this rollback.

## Manual PR creation if the integration remains unavailable

Open [the branch comparison](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5/compare/main...codex/security-dependency-maintenance), choose Create pull request, confirm base main and this head branch, then choose Create draft pull request. Review and merge remain separate owner decisions.

Suggested title: Add a read-only dependency and redacted secret review gate.

Suggested description: This adds a five-minute, read-only maintenance workflow and exact expiring advisory decisions for the locked tooling graph. It preserves application/runtime/dependency versions. Five offline safety tests and the live 115-package OSV check pass with one documented development-only exception.
