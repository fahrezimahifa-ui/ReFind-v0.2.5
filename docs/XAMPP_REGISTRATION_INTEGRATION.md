# Historical guarded XAMPP integration checkpoint

The current implementation is [normal local signup](LOCAL_SIGNUP.md): the whole ReFind directory is loopback-only and the temporary key workflow has been removed. The procedures below record the earlier integration checkpoint; use the current guide for operation.

## Source and privacy boundary

The local integration starts from `4d74e9872b3afa5fa1ab09c081b30d1a3437a2b5` on `codex/release-readiness`, merging the registration feature into local-only `codex/xampp-student-registration`. Current release guidance, the release-readiness audit, historical evidence and ignore protections are preserved. No local-only history is pushed to GitHub. Version remains 0.2.5; schema, dependency lockfiles and workflow rules are unchanged.

Non-writing merge previews and complete source inventories precede integration and cutover. A clean status is insufficient: `tools/registration-source.py` checks actual tracked bytes against Git blobs, detects hidden index flags, unexpected application files, redirected paths, missing files and changed inventories. It excludes ignored credentials/runtime and refuses private paths even if accidentally tracked. `.gitattributes` preserves exact source line endings. The test suite demonstrates that an assumed-unchanged documentation edit is detected despite clean Git status.

Capture the final committed source manifest in a new ignored evidence path. Verify every included file in the Docker image and the prepared synthetic QA app before testing, then repeat verification after testing and after live checkout. Docker excludes only unchanged historical verification captures from that comparison; every changed/conflict-resolved source/build/documentation file is included. The full manifest also retains those historical file hashes for the final live-source comparison. Never substitute an older registration CI result for this integrated source.

## Local-only policy and forwarding gate

The subsequently approved [temporary local signup key](LOCAL_SIGNUP.md) adds an explicit activation alternative when forwarding clearance remains unresolved. It requires both loopback and a server-validated, one-hour private capability. It does not claim that the forwarding inventory is cleared. The original ungated activation procedure below still requires forwarding clearance.

Defaults are `registration_enabled=false`, `registration_local_only=true`, `registration_window_seconds=900`, and `registration_ip_limit=10`. Both booleans are strictly validated. The gateway, session bootstrap and registration API share effective availability. Non-loopback guests see no signup advertising, the signup page returns to login, and POST returns 403 `registration_disabled` before identity, CSRF or limiter work.

The peer rule supports IPv4/IPv6 loopback and ignores Host, X-Forwarded-For and Forwarded claims. It identifies a socket peer, not a person. A local reverse proxy or tunnel could present that peer for an outside visitor. Before enabling, inspect active and configured Apache/IIS/proxy routes, Cloudflare/ngrok/frp/Tailscale forwarding, containers, WSL, SSH, Windows port proxies, services, scheduled tasks and startup entries. Inspect routing metadata only; never disclose tokens, private keys or secret-bearing commands/configurations.

Missing process names or conventional config files do not prove clearance. Any inaccessible container/WSL/managed-tunnel configuration or ambiguous inbound route leaves the gate unresolved. Keep registration disabled and report the blocker; do not start a stopped distribution, tunnel or unrelated service merely to investigate. Recheck immediately before activation, and reassess after any forwarding change. Broader XAMPP wildcard listeners/firewall containment remains separate work; this task changes none of it.

## Exact-source isolated QA

Use a unique owned disposable Compose project. Inspect the already-running engine/context and all existing container/project metadata first; do not start an unavailable engine or interfere with another project. Resolved services must publish no host ports and mount no host runtime/database. No main configuration, data, secrets, sessions or uploaded evidence enters the build context or QA.

The full matrix runs with the existing pinned stack, synthetic database/storage/sessions and browsers inside the QA container. It includes syntax/lint/PHPStan, offline release/registration/source-manifest tests, both themes, browser accessibility/failure recovery, existing account/security/Student/BM/workflow regressions and NULL Student ID report/claim/pickup scenarios. A real client using the private Docker service address also proves non-loopback denial, including forwarded-header forgery, without public ports. Main acceptance never creates a test account.

Tools for exact source verification:

```text
python tools/registration-source.py capture --root <committed-source> --manifest <new-source-manifest.json>
python tools/registration-source.py verify --root <source-or-installed-app> --manifest <source-manifest.json>
python tools/registration-source.py verify --root <docker-source> --manifest <source-manifest.json> --profile docker
python tools/registration-source.py verify --root <prepared-QA-app> --manifest <source-manifest.json> --profile qa
```

If source equivalence or adequate QA cannot be established, do not activate. Any later application/build/test/conflict-resolution change requires new appropriate verification. Current task results belong in the ignored `output/playwright/xampp-integration/` ledger, including the tested commit/tree, source manifest, owned project identity, forwarding gate, installed revision and guest-only acceptance. This guide describes the procedure; it does not assert that activation gates passed.

## Private backup and cutover

Before changing the ignored local override, create a new byte-exact full-file backup outside Apache, worktrees and exported evidence, with access restricted to the current user and SYSTEM. Reject collisions/redirection. Compare bytes privately and record only success/failure; do not generate or print configuration fingerprints or decoded values. Verify the original source's validator accepts the original configuration using CLI only, without DB/session startup. Keep the backup receipt private.

Revalidate the original source inventory immediately before a quiet ReFind cutover, protecting unrelated tracked documentation and all ignored runtime. Detach only this task's staging worktree before switching the live checkout to the verified local integration branch. Do not force checkout, reset, clean, automatically stash, replace the installation wholesale, or modify unrelated worktrees. Keep registration disabled while verifying the installed source against the successfully tested manifest and observing the refreshed PHP application.

Only after QA, exact-source verification, backup and forwarding clearance pass, narrowly insert/set `registration_enabled=true` and `registration_local_only=true` in the existing ignored override without reserializing unrelated settings. Guest-only checks may create ordinary anonymous sessions, but perform no registration/login POSTs and inspect no existing sessions. Do not capture cookies or CSRF values. If cache refresh cannot be established, leave activation off; do not restart shared services automatically.

## Complete rollback

Restore the entire private configuration backup **before** switching back to the recorded original source revision. Verify byte equality without printing contents, then verify the original configuration validator accepts the restored file before reopening the app. Never attempt a flag-only rollback: the previous validator rejects new keys.

Rollback changes source and configuration only. Preserve all accounts, hashes, sessions, uploads and database records, including any legitimate new accounts. No SQL restore, setup, seeding, migration, account reset/deletion, runtime upgrade, firewall/listener edit, shared-service restart, GitHub main merge or security-branch modification is authorized.
