# WP06 dependency and advisory maintenance

Branch: codex/security-dependency-maintenance. Review date: 2026-11-02. Reassessed 2026-11-15 (see [Current advisory decision](#current-advisory-decision)).
The original change was source-only: it did not update dependencies, alter ReFind behavior, patch the installed runtime or approve deployment. The 2026-11-15 reassessment updates the development-only ESLint lockfile entries and still changes no application runtime code.

The checker reads the npm and Composer lockfiles, queries OSV over verified HTTPS when --online is supplied, and fails on an advisory without an exact current review exception. It also fails on expired exceptions or overdue native-component reviews. OSV does not replace vendor/native-library review.

A tracked-source scan reports high-confidence token/private-key matches with file and line only, replacing the value with REDACTED. Protected configuration/runtime filenames are rejected before their contents are read, and filesystem redirects are refused. This is a bounded pattern scan, not proof that every possible secret is absent. Ignored credentials, sessions, uploads, backup contents and machine configuration are not scanned.

The workflow runs on pull requests, its review branch, manual dispatch and weekly after merge. It uses a verified immutable actions/checkout v6 commit, contents: read, persist-credentials: false, a five-minute timeout, and Python's standard library. It installs no dependencies, starts no application/database, requires no Docker and writes no issues or notifications through an API. GitHub main remains unchanged until the owner approves a merge.

## Current advisory decision

Reassessed **2026-11-15**. The minimatch exception (GHSA-g3hv-75wg-m249) was closed by an upstream fix, not renewed. [ESLint 10.15.0](https://www.npmjs.com/package/eslint/v/10.15.0) and @eslint/config-array 0.23.6, both published 2026-11-13, now require minimatch ^11.0.5. The lockfile therefore moves from ESLint 10.13.0 / minimatch 10.2.6 to **ESLint 10.15.0 / minimatch 11.0.8**, inside every parent range and with no override.

Four lockfile entries change: eslint, @eslint/config-array, minimatch, and one new dependency, @isaacs/nonrecursive-glob-match 1.1.0, which is published by the minimatch maintainer. brace-expansion stays at 5.0.12, which satisfies minimatch's ^5.0.12. Every other locked package is unchanged, and the policy now lists no exceptions.

The 2026-11-15 live OSV query covered **116 locked package/version pairs** and returned no advisories. `npm audit signatures` verified registry signatures for 90 packages and reported none missing or invalid. These packages remain development-only tools; ReFind's PHP HTTP application does not execute Node.

Do not remove a failing assertion or extend an exception automatically. A new advisory needs a fresh, exact, owner-approved entry with a short expiry. The native installed/candidate review entries and their due dates are in [DEPENDENCY_REVIEW_POLICY.json](DEPENDENCY_REVIEW_POLICY.json). Their known operational risks and approval gates remain in the [runtime implementation record](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5/blob/codex/security-wp01-wp02-preparation/docs/security/SECURITY_MODERNIZATION_IMPLEMENTATION.md), the [release-readiness audit](../RELEASE_READINESS_AUDIT.md) (DEP-01) and the [v1.0.0 record](../V1_RELEASE_CANDIDATE.md).

### 2026-11-02 decision (superseded)

The 2026-11-02 live OSV query covered 115 locked package/version pairs. One finding remained: minimatch 10.2.6, GHSA-g3hv-75wg-m249 / CVE-2026-118764. The [vendor advisory](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249) identifies attacker-controlled glob patterns with optimizationLevel >= 2 as the trigger and 11.0.1 as fixed.

Official npm metadata then listed minimatch 11.0.4 and ESLint 10.14.0, and ESLint still required minimatch ^10.2.6. Forcing a major override would have violated the parent range. The exception covered only that exact package, version and advisory, was owned by ReFind maintainers and expired 2026-11-16. Repository-controlled lint/CI inputs were treated as a separate tooling risk, bounded by job timeouts. It was an explicit temporary risk decision, not a patched classification.

## Verification and rollback

Run these from this worktree:

~~~powershell
python -B tools/test-security-maintenance.py
python -B tools/check-security-maintenance.py --online
~~~

The five offline tests check that private filenames are refused without reads, reported values are redacted, new advisories fail, exceptions match exact versions and expire, and stale native reviews fail.

On 2026-11-02 all five passed, and the live query returned the one reviewed finding, no unreviewed advisories and no secret-pattern hits; the lockfiles were byte-identical to main. On 2026-11-15, after the ESLint update, all five passed again, and the live query returned no advisories, no policy errors and no secret-pattern hits. `npm ci --ignore-scripts` accepted the updated lockfile unchanged, and `npm run check:js` (43 files) and `npm run lint` passed with ESLint 10.15.0.

Rollback is a source-only revert of this change set. Reverting the 2026-11-15 lockfile update would bring back minimatch 10.2.6, which then needs a new owner-approved exception. Do not replace dependency manifests/installed packages separately or silently remove recorded unresolved risks. The live application is unaffected by this rollback.

## Manual PR creation if the integration remains unavailable

Open [the branch comparison](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5/compare/main...codex/security-dependency-maintenance), choose Create pull request, confirm base main and this head branch, then choose Create draft pull request. Review and merge remain separate owner decisions.

Suggested title: Add a read-only dependency and redacted secret review gate.

Suggested description: This adds a five-minute, read-only maintenance workflow and exact expiring advisory decisions for the locked tooling graph. It preserves application/runtime/dependency versions. Five offline safety tests and the live 115-package OSV check pass with one documented development-only exception.
