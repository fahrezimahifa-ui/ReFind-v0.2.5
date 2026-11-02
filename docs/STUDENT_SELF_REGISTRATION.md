# Student self-registration — ReFind v0.2.5

## Scope and preservation

The feature branch starts from remote `main` at `a610b1a0cb7ebb2b911f3468388076948a65b238`. Security preparation remains seven commits ahead and dependency maintenance one commit ahead; neither branch was merged or modified. Implementation uses a new source-only worktree outside XAMPP. No main local override, private records, credentials, secrets, sessions or uploads were inspected, copied or fingerprinted during implementation. Preservation checks use Git/source boundaries, branch identities, QA guards and non-sensitive metadata.

Registration defaults to disabled. When enabled it creates immediately active **STUDENT** accounts and signs them in. Student ID and avatar remain SQL NULL. No schema migration, dependency/runtime upgrade, new role, email sending, OTP, MFA, OAuth, SSO, deletion or public password recovery is included.

PHP may cache included configuration according to its normal OPcache settings. After an operator changes an owned demonstration's override, ensure the server has observed the new configuration before declaring the gate changed. QA waits for the public availability boolean after each configuration flip and before each theme run; it does not alter PHP/OPcache configuration.

An address is syntactically validated but unverified; it proves neither mailbox ownership nor UMN enrollment. Any valid email domain is permitted. An unverified address must not become a trusted password-recovery destination. Campus identity proof, verified contact changes, recovery and deployment operations require separate product/security work; no future verification system is preemptively added.

## Configuration and routes

Validated defaults:

```php
'registration_enabled' => false,
'registration_window_seconds' => 900,
'registration_ip_limit' => 10,
```

Availability requires a real boolean and limits require positive integers. Existing overrides remain compatible because defaults supply omitted keys. `GET api/session.php` adds only the public `registration_enabled` boolean.

To enable a separately owned local demonstration, add `'registration_enabled' => true` to **that demonstration's** ignored override while preserving its synthetic settings. Restore false to disable. Do not change the existing live installation, expose ports, or promote an internet deployment for this task. The QA suite temporarily enables only its owned configuration and restores the original bytes in `finally`.

`register.html` uses the existing page gateway, navigation, themes and assets. Signed-in visitors redirect to their role landing. Disabled guests redirect to login; Create account stays hidden there. Registration is excluded from safe-return targets. The backend also rejects a stale form after availability changes.

## API and security

`POST api/register.php` accepts multipart or URL-encoded fields `name`, `email`, `password`, `confirm_password`, and optional `_csrf`. No query parameters, uploads, role, account ID, Student ID, activation, avatar or other overrides are accepted. Use the guest session's `X-CSRF-Token`; existing header/body agreement and origin rules apply.

- Name follows Profile: trimmed, valid UTF-8, 1–120 characters, no control characters.
- Email follows login: trimmed and lowercased, valid syntax, maximum 150 characters/bytes under the current validator.
- Password follows existing account rules: at least 10 Unicode characters, at most 72 UTF-8 bytes, no NUL, exact confirmation. Never trimmed, logged or stored plaintext.
- Prepared SQL explicitly inserts `STUDENT`, active status and NULL Student ID/avatar. The unique email index arbitrates duplicates and concurrent requests without an availability endpoint.
- The insert commits before shared login/registration session creation. That helper rotates the session ID and CSRF, preserves credential fingerprints/expiry, and removes private response fields. If authentication fails after commit, the valid account remains available for normal login rather than being deleted or recreated.

Success is HTTP 201 with the established envelope:

```json
{"ok":true,"authenticated":true,"user":{"id":"123","name":"Example Student","role":"STUDENT","avatar_url":null},"csrf":"<new token>","redirect":"<base_path>index.html"}
```

| Status | Meaning/code |
|---|---|
| 400 | Unsupported fields/query/files/content type: `invalid_request` |
| 403 | Disabled: `registration_disabled`; invalid CSRF/origin: `csrf_invalid` |
| 405 | POST required: `method_not_allowed` |
| 409 | Signed in: `already_authenticated`; duplicate email: `registration_conflict` |
| 422 | Invalid required value/confirmation: `validation_error`, with `fields` |
| 429 | `registration_rate_limited`, with `Retry-After` seconds |
| 500 | Existing generic `server_error`; no SQL, hashes or stack details |

Availability and guest checks precede CSRF and limiter reservation. After CSRF succeeds, each admitted request consumes one per-IP place before payload validation, hashing or SQL. Reservations use a private locked `registration-attempts.json`; the lock is released before expensive/database work. Success never clears counts. Keys are HMACs of server-observed IPs, never email/password combinations; forwarded IP headers are ignored. Corrupt or unwritable limiter state fails closed.

Duplicate feedback is neutral: “An account could not be created with these details. Try another email or log in.” Success/conflict outcomes still permit some enumeration; throttling limits rather than eliminates it. Ten attempts per 15 minutes can affect legitimate students sharing campus Wi-Fi. The limiter is per installation, consistent with the single-server architecture.

The UI provides associated errors, focus/live feedback, password visibility and submission locking. It clears submitted passwords and handles CSRF changes, throttling and disabled registration. For network/JSON/uncertain server outcomes it checks session state before offering login/retry, never automatically replaying the POST. Form contents are not persisted in browser storage or evidence.

## Isolated verification

Before Docker use, inspect its context, engine state, existing project metadata and resolved Compose configuration. Confirm a unique project name, no collisions, no host runtime/database mounts and no published ports. Do not start an engine when its effects on other environments cannot be established; never start/stop unrelated services.

After preflight succeeds, from the feature worktree:

```text
docker compose -p refind-student-registration-20261102 -f compose.qa.yml up --build --detach --wait
docker compose -p refind-student-registration-20261102 -f compose.qa.yml exec -T qa python3 tools/prepare-test.py
docker compose -p refind-student-registration-20261102 -f compose.qa.yml exec -T qa chown -R www-data:www-data /var/www/html/ReFind_0.2.0_Test /var/www/html/ReFind_0.2.3/output
docker compose -p refind-student-registration-20261102 -f compose.qa.yml exec -T --user www-data qa node tools/run-qa.cjs
```

Browsers and HTTP clients run inside QA against its internal Apache URL. No public URL, tunnel, firewall change or host port mapping is needed. Existing ownership/configuration/path/session guards precede fixture mutations. Registration controls are CLI-only, require an owned QA identity and matching run marker, refuse file redirection, and keep a private restoration receipt. Cleanup restores configuration/limiter bytes, removes only the controlled trigger, and deletes only test-run users/reports. After interruption, retain the private receipt and diagnose the owned environment before using the guarded `end` action with its matching run ID. Never include restoration receipts in artifacts.

The runner adds registration in both themes alongside existing auth/account/security/workflow regressions. Registration scenarios include duplicate races, malformed/oversized values, role/activation tampering, CSRF/origin, successful-signup throttling, rollback, disabled/authenticated access and malformed-success recovery. Newly registered SQL-NULL Student IDs are explicitly tested through Profile, Lost/Found reports, claims, BM claimant displays, approval, scheduling, Student pickup views, cancellation, release and completion.

Safe offline checks:

```text
npm ci --ignore-scripts
npm run check:js
npm run lint
npm run test:unit
node tools/test-registration-ui.cjs
```

Also run PHP syntax, PHPStan level 5 and Git whitespace checks. Offline registration PHP tests use temporary synthetic files and connection-refusing database stubs. Offline browser checks intercept every request, serving feature assets and mocked responses without any HTTP server, listener or database. They cover both themes at 320/390/768/1280/1440px, axe, keyboard/focus, visibility, validation, loading, duplicate submission and failure recovery. These do not prove PHP/MariaDB integration or real screen-reader speech.

The existing release-readiness workflow runs on this feature branch with pinned disposable GitHub-hosted QA. Evidence uses fresh protected/ignored directories. No password-filled screenshots, browser traces or private restoration receipts are collected. Export synthetic receipts/captures before stopping only this task's verified project; do not clean up another environment.

## Implementation report — 2 November 2026

Changes comprise the registration application module/API, shared authentication-session helper, validated configuration/session capability, page gateway/route/rewrite, Sign Up UI/login link/auth styling, guarded QA controls, offline/browser/integration suites, CI wiring and current developer guides. Existing workflow modules, database schema, dependency lockfiles and historical reports are unchanged.

The first remote history scan flagged the same public, synthetic validation password twice on one test line. Its exact file and complete line are narrowly allowlisted; real credentials, other test values and all other source/history remain scanned. The existing checker version is unchanged. This is feature-fixture handling, not an import from either security branch.

| Check executed locally | Result |
|---|---|
| PHP syntax | PASS, 45 files |
| JavaScript syntax | PASS, 38 files |
| ESLint | PASS |
| PHPStan level 5 | PASS with existing installed development tool; cache in feature worktree |
| Offline registration | PASS, 9 tests, including concurrent limiter reservations and database-refusing API guard checks |
| Existing offline release tests | PASS, 14 passed; one Windows junction-capability check skipped |
| Mocked offline browser UI | PASS, 21 groups, zero tagged axe violations/page-script errors; light/dark captures visually reviewed |
| Resolved Compose configuration | Three services, zero published ports, zero host mounts; unique proposed project name |
| Local integration/full workflow regression | BLOCKED: selected Docker engine socket unavailable; safe startup effects cannot be established, so engine/services left untouched |
| Actual screen-reader speech / physical devices | NOT RUN; keyboard/semantic/axe checks have the narrower scope above |

Local results alone do not establish database registration or NULL-ID pickup readiness; those integration tests await disposable CI execution. Historical results are not reused as current evidence. Remote CI and draft-PR outcomes will be recorded after feature publication. No merge, deployment or live enablement is included.
