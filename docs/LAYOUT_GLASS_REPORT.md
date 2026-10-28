# ReFind layout and notification refinement — 28 October 2026

Checkpoint branch: `codex/layout-glass-refinement`, based on the completed dark-mode refresh at `2536fcb`. This branch preserves the reviewed layout, notification feed, glass surfaces, and verification report. GitHub `main` remains `857acea`; no pull request or merge is included.

## Delivered changes

- Replaced conflicting page-width limits with one **1160px outer frame**, including Home, reports/claims, Notifications, Explore, Activity, History, BM, profile, and settings. Navigation, feedback, and footer use the same edges. Gutters are **18px below 768px**, **24px from 768px**; page-top spacing is also shared. Login retains its separate composition.
- Rebuilt Notifications as one frosted feed with Today/Earlier sections and neutral row dividers. Removed cyan stripes/fills, added explicit Unread labels, and retained full messages and classroom-example context.
- Notification titles/messages use **16px**, context/timestamps **14px**. Related context sits 4px below the title group, the message 8px below its preceding content, and actions 12px below the preceding content/time. Rows use 18px mobile/24px desktop padding and natural heights. Timestamps move from the heading’s right side to beneath the message on mobile.
- Replaced wide repeated buttons with compact destination links and quieter read actions, retaining 44px targets. Read actions remove the unread state and put focus on the destination or heading. Mark-all focuses its feedback. Normal, Control, and middle-click navigation preserve their destinations and read persistence.
- Split glass into **panel/navigation/popup** roles at **64%/78%/86%** opacity with 16px blur. Applied stronger glass to hero/Login/filter/feed surfaces and navigation/popups. Repeated cards remain quieter, fields nearly opaque, primary actions solid, and private panels distinctly tinted. Notification rows and nested controls add no blur.
- Localized the static background color pools and increased the general page wash to 28%; Home/Login retain 45%/60%. Strengthened light secondary text to `#4B5970` and used dark/light body text for inactive navigation to keep translucent surfaces readable. Opaque, reduced-transparency, and forced-color fallbacks remain available.

No API, schema, server business rules, permissions, status labels, logo, or theme-preference behavior changed.

## Verification for this update

All mutation suites ran sequentially in the verified owned QA installation, using `refind_db_0_2_0_test`. Fresh focused-test actors and fixtures were removed after testing. Historical evidence was preserved.

| Suite | Light | Dark |
|---|---:|---:|
| Authentication | 28 passed | 28 passed |
| Account/profile/password | 24 passed | 24 passed |
| Student reports/claims | 24 passed | 24 passed |
| BM workflows | 27 passed | 27 passed |
| v0.2.5 regressions | 24 passed | 24 passed |
| UX/navigation/dialogs | 15 passed | 15 passed |
| **Total** | **142 passed** | **142 passed** |

Additional results:

- **21 focused notification checks** passed: measured typography/gaps/targets, long multiline content, missing context/destinations, read persistence, focus, last unread, mark-all, pagination, native new tabs, failure/retry, loading/empty states, and reflow at a **200% effective desktop CSS viewport** (720×450 at device scale 2).
- **190 screen states** passed at **360, 390, 768, 1280, and 1440px** in both themes. Geometry assertions compared main/navigation/footer/feedback widths and gutters. Additional **1099/1100px** checks verified navigation and BM queue/detail transitions.
- **2,364 composited-background contrast samples** passed; sampled ordinary text reached at least **5.75:1**. Existing focus/control-boundary checks passed. **72 axe scans** reported no violations, with 42 incomplete automated checks. These results do not constitute WCAG certification.
- A final extreme-backdrop check found that the original light focus ring fell to 2.66:1 over black content behind the header. Changed only the light focus token to `#086E83`; **20 rendered focus checks** then passed at all five widths, with a minimum **3.33:1**. Both 15-group UX suites were rerun after this final focus-color adjustment. The full normal-screen matrix above preceded that adjustment.
- No uncaught browser errors, unexpected failed requests, broken visible images, or horizontal overflow occurred in the read-only visual matrix. Theme switching retained prepared uploads, form text, passwords, focus, notes, and confirmation state. Short viewports, dialogs, private-photo presentation, continuous scrolling backgrounds, and opaque fallbacks were checked.
- Notification scroll samples averaged **16.37–16.70ms/frame** with/without blur; p95 was **16.9–21.2ms** over 60 frames per case. This is a local desktop observation, not a mobile performance guarantee. Popup bounds and Escape/focus return also passed.
- Main business-table fingerprints matched before/after the visual and boundary reviews. Main records/media were not modified; normal login/session/throttle state was exercised. Review captures remain ignored local files and are denied over HTTP (403).
- JS/CJS syntax and Git whitespace checks passed. Backend, schema, branding, and theme-controller source remained unchanged.

One initial dark v0.2.5 run failed on a database connection constructor, logged at `db.php:11`. The server’s subsequent counters showed no maximum-connection/internal errors and a peak of 6 connections against a limit of 151; the exact cause was not established. The complete 24-group suite passed on rerun, followed by all 15 UX groups, without a backend change. The initial failed receipt is retained separately.

## Evidence and rerunning

Current evidence is under ignored `output/playwright/layout-glass/`, accessible through local files rather than website URLs:

- `focused/layout-results.json`: focused notification/reflow cases and screenshots.
- `theme/theme-results.json`: full screen/alignment/theme/contrast/accessibility review.
- `boundaries/boundary-results.json`: BM/navigation boundaries, popup focus, notification performance, and data fingerprint checks.
- `previews/`: paired light/dark desktop/mobile views.
- `focus/focus-results.json`: final 20-case focus check; `focus/focus-before.json` preserves the pre-correction result. The check is reusable through `tools/qa-focus.cjs` and integrated into future `test-theme.cjs` runs.
- `light/{auth,account,student,workflow,v025}/`, `light/ux-focus/`: final light regression receipts.
- `dark/{auth,account,student,workflow}/`, `dark/v025-verified/`, `dark/ux-focus/`: final dark receipts. `dark/v025/` retains the earlier failure; earlier successful UX receipts remain separate.

Use the installed Playwright/Sharp/axe module paths described in [ARCHITECTURE.md](ARCHITECTURE.md#verification-and-tooling). Choose a fresh evidence directory when rerunning:

```powershell
$env:REFIND_EVIDENCE_DIR = 'output/playwright/my-next-review/focused'
node tools/test-layout.cjs
$env:REFIND_EVIDENCE_DIR = 'output/playwright/my-next-review/screens'
node tools/test-theme.cjs # Owned QA app; --main explicitly selects this local main app.
```

Physical iOS/Android keyboards, Safari, actual screen-reader operation, and low-powered devices remain manual checks. The zoom case emulates the effective CSS viewport; it does not operate the browser’s native zoom UI. Previous results are recorded in [GLASS_DARK_MODE_REPORT.md](GLASS_DARK_MODE_REPORT.md) and [UI_POLISH_REPORT.md](UI_POLISH_REPORT.md).
