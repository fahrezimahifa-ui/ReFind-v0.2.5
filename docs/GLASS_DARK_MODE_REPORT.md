# ReFind glass surfaces and dark mode — 28 October 2026

This report records checkpoint `2536fcb`. The subsequent [layout/glass refinement report](LAYOUT_GLASS_REPORT.md) supersedes its page-width, notification-card, and surface-opacity choices. The verification below remains historical evidence for that checkpoint.

Implemented locally on `codex/glass-dark-mode` and saved at checkpoint `2536fcb`. The first visual refresh was saved as local checkpoint `945d1dc` on `codex/ui-polish`, following baseline `bc8c6c1`. No push, pull request, or merge was performed; `main` remains at `857acea`.

## Changes

- Added a visible 44px sun/moon toggle for guests and signed-in users, including mobile. Its stable accessible name is “Dark mode”; its pressed state identifies the current setting.
- Added System/Light/Dark under Settings → Appearance. The app initially follows the device. Explicit choices use only the `refind-theme` browser preference, shared across accounts in that browser. System removes the override. Device changes, open tabs, invalid values, and unavailable storage are handled without reloading forms.
- Added an external theme bootstrap before styles, preserving the existing CSP. It synchronizes the root theme, Bootstrap theme, and native `color-scheme` so date/time/select controls also follow the appearance.
- Centralized both palettes and semantic states in `css/theme.css`. Midnight blue uses `#0B1220` for the page, `#131F35` for panels, `#101C31` for fields, `#EAF0FF` for text, `#B8C5DD` for secondary text, and `#9BB3FF` for primary actions. Light buttons retain `#3F5FB5`; text links use `#344F99` for contrast over the continuous pastel wash.
- Added restrained glass to navigation, secondary buttons, tabs, menus, dialogs, and sticky action bars. Header/dialog opacity starts at 92%, secondary controls at 80%, panels at 96%, and fields at 98%. Blur is limited to small navigation/dialog/action surfaces at 12px. Primary buttons remain solid and private panels retain their distinct tint.
- Replaced the 900px background cap with one static viewport gradient behind the entire document. It stays visible while scrolling, without seams, downloads, or animation. Login/Home/other page intensities remain 60%/45%/18%; dark mode uses subdued plum, blue, and violet.
- Added opaque fallbacks for reduced transparency, forced colors, and browsers without backdrop filtering. Photos and private evidence retain their original colors. Mobile navigation can scroll within a short viewport.
- Added matching SVG/PNG light-wordmark assets for dark surfaces. Symbol geometry, gradient, spacing, and header sizes are unchanged; see the [branding guide](../assets/README.md).

No application API, PHP business code, database schema, roles, permissions, status labels, or workflow rules changed. Appearance is entirely client-side.

## Verification run for this update

Mutation suites ran sequentially against the verified owned `ReFind_0.2.0_Test` installation and `refind_db_0_2_0_test`. They exercised successful and invalid inputs, uploads and retained evidence, sessions/passwords, reports, claims, resubmission/withdrawal, review decisions, scheduling/cancellation, release/return, notifications, history, concurrency, rollback, and private-media guards.

| Suite | Light | Dark |
|---|---:|---:|
| Authentication | 28 passed | 28 passed |
| Account/profile/password | 24 passed | 24 passed |
| Student reports/claims | 24 passed | 24 passed |
| BM workflows | 27 passed | 27 passed |
| v0.2.5 regressions | 24 passed | 24 passed |
| UX/navigation/dialogs | 15 passed | 15 passed |
| **Total** | **142 passed** | **142 passed** |

The final read-only browser matrix reviewed Login, Home, Explore, report/claim forms, item details, activity, history, notifications, profile/settings, all three BM tabs, and decision/image dialogs at **360, 390, 768, 1280, and 1440px** in both themes.

- **190 screen states**, **2,162 rendered contrast samples**, and **72 axe accessibility scans** passed with no reported violations, horizontal overflow, broken visible images, uncaught JavaScript errors, or unexpected failed requests. Sampled ordinary text reached at least **4.69:1**; existing keyboard-focus/control-boundary checks also passed. Axe marked 44 checks incomplete; composited-background sampling and keyboard checks provide additional coverage, but these results are not a WCAG conformance certification.
- Checked initial paint, persistence, device changes, cross-tab updates, System reset, blocked storage, and keyboard toggling. Unsaved passwords, report text, prepared photos, focus, review notes, and confirmation state survived theme changes.
- Verified dialogs in a 430px-high viewport, short-screen navigation, reduced transparency, forced colors, and removal of backdrop-filter support. Text contrast was also sampled with black/white content behind the translucent header.
- Direct viewport pixel checks confirmed identical gradient colors at the same position before/after scrolling: light `242,234,252`; dark `28,27,52`. Dedicated bottom-of-page viewport captures preserve this evidence; full-page screenshots can render fixed/sticky layers differently.
- Desktop scroll samples averaged **16.3–16.6ms per frame**, with/without blur, over 45 frames per case. This is a local Chrome observation, not a mobile performance guarantee.
- Fingerprints of nine main business tables matched before/after the read-only review. Login/session/throttle state was exercised normally. No main records or uploaded media were modified.
- JS/CJS syntax, SVG parsing/identical dark-logo geometry, asset loading order in all 13 templates, and Git whitespace checks passed. Exported eight PNG assets from the SVG masters.

An interrupted QA process left three temporary accounts and one fixture report. Those exact run-owned records were removed; invariant checks then passed, and the affected suites were rerun successfully. Interrupted and earlier failed review attempts remain separate from final evidence.

## Evidence and rerunning

Current local resources are ignored under `output/playwright/glass-dark/`; they are not public repository links. Historical receipts under `docs/verification/` were preserved.

- Final visual/theme receipt and screenshots: `theme-complete/theme-results.json`.
- Clean mobile/desktop light/dark comparison captures: `previews/preview-results.json` and adjacent PNGs.
- Light final suite receipts: `light/auth`, `light/account`, `light/student`, `light/workflow`, `light/v025`, and `light/ux-delivery`.
- Dark final suite receipts: `dark/auth`, `dark/account-final`, `dark/student-final`, `dark/workflow-verified`, `dark/v025-verified`, and `dark/ux-delivery`.

Set the installed module paths in `REFIND_PLAYWRIGHT_MODULE`, `REFIND_SHARP_MODULE`, and `REFIND_AXE_MODULE`. Review-only accessibility dependencies were installed in ignored `output/playwright/theme-a11y/`; the application has no new runtime dependency.

```powershell
$env:REFIND_THEME = 'dark' # Repeat with light; run suites sequentially.
$env:REFIND_EVIDENCE_DIR = 'output/playwright/my-review/dark/ux'
node tools/test-ux.cjs --v025
# Other suites: test-auth, test-account, test-student, test-workflow, test-v025.
$env:REFIND_EVIDENCE_DIR = 'output/playwright/my-review/themes'
node tools/test-theme.cjs # Owned QA app; --main explicitly selects this local main app.
```

Physical iOS/Android keyboard, screen-reader operation, Safari, and low-powered-device performance remain manual device checks. Viewport, reduced-height, forced-color, and transparency cases above were exercised in desktop Chrome. Preserve those limits when describing this result.
