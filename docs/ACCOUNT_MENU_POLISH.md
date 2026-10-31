# ReFind 0.2.5: account menu and layout polish

This follow-up changes the shared UI without changing public API payloads, database schema, ownership/claim rules or stored version. Source work remains on `codex/ui-ux-profile-enhancements`; local XAMPP integration is separately backed up and verified. Docker stays stopped and the original QA installation is preserved.

## Behavior

- Item-detail and My Activity report Delete controls share red text/outline and a pale peach fill, with warm dark-theme, hover, pressed and disabled states. Edit keeps its existing blue styling. Confirmation and server-side authorization remain required.
- At1100px and above the account disclosure uses the same DOM node moved outside the header's backdrop root. Its own16px blur and dedicated92% light/90% dark surface tint provide readable frosting. A placeholder restores the inline mobile navigation position below1100px. IDs, native links, account identity and logout handlers remain stable.
- Account and Appearance share viewport-aware positioning: right-aligned with their trigger,12px below the measured navbar, with horizontal gutters and available-height scrolling. Header/viewport changes reposition open popups; crossing the mobile breakpoint closes/reparents the menu and restores focus to the visible trigger.
- Desktop keyboard order runs Account, My profile, Account settings, Log out, Appearance. Shift+Tab reverses that order; ArrowDown opens at the first link, Escape restores Account focus, and outside clicks/focus dismiss without stealing an input's focus. Mobile keeps the inline disclosure and native navigation order.
- Repeated branding/version/tagline footers are removed. Settings contains a quiet `Version 0.2.5` line. Form help, campus-time labels and academic/license documentation remain available.
- The login introduction keeps its exact headline, explanation and journey labels. Desktop content aligns with the navbar frame, with a40px headline and48px column gap. Below1100px it uses a centered stacked layout,32px headline and32px section gap. Eyebrow/headline/body/journey gaps use12/18/24px, supporting text stays16px, and wrapping no longer depends on a hard line break.

## Verification and operation

Use the existing owned XAMPP staging profile/server on3311 described in [XAMPP_INTEGRATION.md](XAMPP_INTEGRATION.md). Verify its ownership/configuration and synthetic credential receipt before fixtures; a prior recovery rehearsal can replace database password hashes while retaining an old receipt. Reconcile only staging's known synthetic accounts if needed. Keep receipt user IDs as strings, matching the setup/API contract. Main credentials are never reset for testing.

The focused `tools/test-menu-polish.cjs` suite covers both roles/themes,360/390/768/1099/1100/1440px and an effective200% viewport; login alignment/wrapping and validation; popup clearance/reparenting/keyboard/outside behavior; long names; extreme composited backdrops and opaque accessibility fallbacks; unsaved Settings input; and report Delete states/cancel/commit/unauthorized requests. Browser event/animation settling is awaited before geometry assertions.

The existing v0.2.5 matching scenario now compares the candidates created by that scenario, allowing unrelated eligible demo matches to coexist. Its explicit own-reporter, category and impossible-date exclusion checks remain intact. This is fixture isolation for populated staging, not a product matching change. The version-copy regression now checks Settings and absence of repeated footers.

Main cutover uses a private matching SQL/source/runtime/configuration backup with writers paused through the previously verified HTTP guard. Runtime backup/fingerprints include existing avatars. Apply only the reviewed source merge, run read-only schema/workflow checks and positive existing-account UI/media smoke, then restore the exact original configuration bytes. Do not run setup, seeds or migrations for this follow-up. Keep the safety/local merge history unpublished; push only the feature branch and update draft PR3 without merging GitHub main.

Current receipts and screenshots remain under ignored `output/playwright/menu-polish`, `output/playwright/release-readiness/results/account-menu-polish-*` and `storage/setup/menu-*`. Failed attempts are retained separately from final passes. Physical-device/screen-reader checks remain manual.

## Current results: 31 October 2026

- PHP syntax43 files, JavaScript/CJS syntax, ESLint, PHPStan level5,15 offline safety tests and whitespace checks: PASS.
- Focused menu/layout suite:14 groups,14 captures and74 composited contrast samples: PASS, with no browser exceptions. Both roles/themes and all requested viewport cases are included.
- Relevant regression subset:15 selected stages completed across retained runs r1/r2/r3, with prior passes explicitly linked. Account24, v0.2.5 fixes24 and UX15 groups passed per theme (126 total); layout/feed21 and material/title8 passed. Backend-only matrix stages were explicitly not selected for this source-only change.
- Theme:23 groups,190 captures and2,368 contrast samples: PASS. Appearance:16 groups and3,474 phase samples: PASS. No browser exceptions. Positive staging smoke passed for all three synthetic accounts with unchanged business/media fingerprint; schema and workflow/media invariants passed before/after.
- Retained failed attempts include premature entrance-animation/responsive-event assertions, the legacy matching test's assumption that no other eligible demo match exists, and a numeric-versus-string staging receipt ID error introduced during private credential reconciliation. Final checks await actual browser state, scope matching assertions to their scenario, and use the setup-compatible string ID receipt. Product matching logic is unchanged.

Final focused evidence is `output/playwright/menu-polish/20261031-r3/results.json`; the regression continuation receipt is `output/playwright/release-readiness/results/account-menu-polish-20261031-r3/summary.json` and references the earlier current-task passes. Current main cutover, preservation and positive-smoke receipts are stored only with the operator's private backup. The draft PR records their final outcome.
