# ReFind MVP visual finish — 28 October 2026

Checkpoint branch: [`codex/mvp-visual-finish`](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5/tree/codex/mvp-visual-finish), based on published checkpoint `4f295aa`. The visual implementation and verification below were completed on 28 October 2026; this Git checkpoint was saved on 29 October 2026. The earlier `codex/layout-glass-refinement` branch is preserved and `main` remains `857acea`. No pull request or merge is included. Application version remains 0.2.5.

This snapshot includes application source, the bundled font/license, QA tools and documentation. Local configuration/credentials, databases, private media, screenshots, recordings, backups and review dependencies remain separate local assets and are excluded from the commit.

## Delivered

- Blue, cyan, lilac, pink and apricot pools, composed separately for light and midnight themes. A fixed foundation keeps color visible while scrolling; two oversized layers drift through bounded transforms on 47/71-second alternating cycles. Gradient stops and blur do not animate. Only the two moving layers request transform promotion while running, following [web.dev's animation guidance](https://web.dev/articles/animations-and-performance/).
- Glass panel/navigation/popup tokens at 64/82/88% in light mode and 62/82/88% in dark mode. Account/form/BM panels join the existing hero, filters and feed. Repeated cards have quieter translucent fills and highlighted edges, without individual blur. Blur is 16px desktop/12px mobile. Fields remain nearly opaque, primary actions solid, private sections distinctly tinted, and photos unfiltered. The account menu avoids a second blur inside the header; Appearance is a body-level dialog. Unsupported filtering, reduced transparency and forced colors retain opaque/native fallbacks.
- Self-hosted [Manrope from Google Fonts](https://github.com/google/fonts/tree/main/ofl/manrope), with its OFL license and provenance in [assets/fonts](../assets/fonts/README.md). The full 53,672-byte WOFF2 is not subsetted. Application weights are 400/500/600/700 with Segoe UI/Arial/system-script fallbacks. Body and inputs are 16px; important metadata is 14px. Headings, navigation weight, decorative labels and inline icons were refined; outlined logo assets are unchanged.
- One 44px **Appearance** button before/after login opens an anchored modeless dialog with native System/Light/Dark radios and a labeled Background motion switch. Escape/Close restore trigger focus; outside clicks and leaving the panel dismiss it. The panel and Settings use the same state controller. Existing `refind-theme` values remain valid; `refind-motion` is a separate browser preference shared across accounts and synchronized across tabs.
- Motion defaults on unless a device preference overrides it. Pausing holds the current transform; reloading with motion off preserves the richer static design. Hidden tabs pause. Reduced motion, reduced transparency and forced colors stop animation and explain/disable the effective motion control. Reduced motion also removes decorative control/dialog transitions.

The established 1160px frame, 18/24px gutters, notification grouping/spacing/read behavior, supplied logos, server APIs, schema, permissions, status meanings and business workflows are preserved. No PHP business code, server API, database schema or configuration changes are included.

## Verification completed for this pass

The owned `ReFind_0.2.0_Test` marker/configuration were checked before syncing. Mutation suites ran sequentially, only against the isolated `_test` database and its media. Main-app reviews used read-only pages/API reads and ordinary login/session state.

| Existing regression suite | Light | Dark |
|---|---:|---:|
| Authentication | 28 | 28 |
| Account | 24 | 24 |
| Student | 24 | 24 |
| Workflow/BM | 27 | 27 |
| v0.2.5 | 24 | 24 |
| UX | 15 | 15 |
| **Total scenario groups** | **142 passed** | **142 passed** |

- **21 focused notification groups** passed: short/multiline/long/missing-context content, date groups, natural row heights, target sizes, pagination, individual/mark-all read, focus destinations, modified clicks, loading, retry/error states and effective 200% reflow. Both themes include 1099/1100px navigation boundaries.
- **200 screen captures** cover Login, Appearance, Home, Explore, Lost/Found reports, Activity/claims, History, Notifications, profile/settings, item/claim forms, all BM tabs, decision/photo dialogs, mobile navigation, short heights, scroll depth and opacity/forced-color fallbacks at **360/390/768/1280/1440px**. No horizontal overflow, broken visible images, unexpected failed requests or uncaught browser errors occurred in the completed matrix.
- **2,478 rendered text samples** passed 4.5:1 ordinary/3:1 large-text thresholds (observed minima 5.77:1 and 8.15:1). **20 rendered header-focus checks** over black/white backdrops passed 3:1, minimum 3.70:1. The corrected dark campus label now uses the main text color.
- **76 axe audits** reported zero automated violations. They also returned 144 incomplete rule results across those audits; these are not treated as conformance passes. Pixel sampling supplements automated checks for the composited glass backgrounds.
- **16 main-app Appearance groups** passed: keyboard/dismissal/short-height behavior, independent preference storage and cross-tab sync, motion pause/resume, device overrides, font loading/failure, settings/password drafts, Unicode report drafts/prepared uploads/focus, motion-phase contrast, performance, and cross-tab changes while a BM decision note and checked confirmation remain open on the same record. **1,783 motion-phase text samples** passed across 360/390/1440px, including independent warm/cool combinations. Ordinary-text minimum was 5.49:1. Visibility handling was tested with a simulated hidden/visible event; native background-tab behavior still needs physical-browser confirmation.
- **44 paired comparison captures** and **16 final control/boundary checks** passed after the switch styling was finished. Lazy images were explicitly decoded before capture. These include the role-denial message page, 1099/1100px navigation and a 720×450 effective zoom viewport. Final popup text also passed 60 rendered samples.
- A final synchronized owned-QA pass completed **14 Appearance groups** and **3,036 rendered phase samples**, including both extreme endpoints of each independent animation at 360/390/1440px. Its business-table fingerprint was unchanged and no browser exceptions occurred. BM confirmation preservation remains covered by the main review and the isolated fixture-based workflow suites; the clean QA seed has no claims.
- Cold/blocked local font tests preserved forms and fallback legibility. The cold-font run recorded approximately **0.00008 layout shift**. This is a targeted lab observation, not a field Core Web Vitals claim.
- Main business-table fingerprints matched before/after the completed visual/Appearance reviews. A separate hash comparison also preserved **72 private media files** across items/evidence/claims. No main setup/seeding or business mutations were performed.
- JavaScript syntax and Git whitespace checks passed. Font hash/license/provenance and unchanged API/schema/logo scope were reviewed.

### Performance observations

The final main-app motion-on/off scroll samples averaged 16.50–17.91ms/frame, with p95 17.7–27.2ms in the repeated run. Motion-on typing samples took 783–813ms versus 465–487ms off for the same 25-character automated input; popup two-frame samples averaged 28–44ms. An earlier completed run measured motion-on typing at 436–459ms and popup averages 29–31ms. These runs shared the local machine with other browser/QA work, so the timing spread is retained rather than presented as a precise animation cost.

The final owned-QA comparison, after the other large suites finished, averaged **16.51–16.62ms/frame** with **16.9–17.0ms p95**. Typing took 445–446ms on / 422–427ms off; popup averages were 28–31ms in either state. No dropped characters or sustained scroll stalls were observed. Motion can be paused, mobile blur is reduced, and no per-card backdrop filters were added. Physical-device profiling remains necessary.

### Corrections and retained unsuccessful receipts

- Early contrast samplers hit adjacent radios, hidden text behind dialogs/sticky actions, or color transitions. The reusable sampler now measures unobscured text ranges and hides glyph fill without changing UI colors. These were test-sampling errors, not accepted contrast results.
- The first dark campus label measured 4.35:1. It was changed to the main text color, and the full 200-screen matrix was rerun successfully.
- The UX navigation selector was updated when its decorative text arrow became an aria-hidden SVG; the link's visible words and destination are preserved.
- Two dark Student attempts encountered a closed HTTP socket before upload checks after blocking fixture/Python work. The test harness now requests fresh connections, with no automatic mutation retry; the complete 24-group Student rerun passed. Production HTTP behavior was not changed.
- Initial recording lacked Playwright's encoder. FFmpeg was downloaded only into ignored review dependencies, then both recordings completed.
- The cleaned QA seed contains no claims. The initial read-only QA Appearance run therefore could not open a BM decision. BM appearance/confirmation preservation was verified against the populated main demo; isolated workflow/UX suites exercised their own QA claim fixtures and cleaned them afterward.

## Local evidence and rerunning

New evidence is under ignored `output/playwright/mvp-finish/`; previous `ui-polish/`, `theme/`, and `layout-glass/` evidence remains separate. These are local review resources, not repository links:

- `theme-accepted/theme-results.json` and associated 200 captures.
- `appearance-accepted/appearance-results.json` and `recordings/{light,dark}-ambient.webm`: main read-only review and 13.68-second clips. Native Chrome playback and seeking passed at 1280×800; `recording-validation.json` records those checks.
- `qa-appearance-complete/appearance-results.json`: final owned-QA controls, extreme endpoint sampling, recordings and performance. `qa-appearance/` preserves the earlier no-claim-fixture result.
- `comparisons-final/comparison-results.json` and paired viewport captures; `comparisons.md` is a local viewing index.
- `focused/layout-results.json`: 21 focused notification/reflow groups.
- `light/{auth,account,student,workflow,v025}/`, `light/ux-final/`: successful light regression receipts.
- `dark/{auth,account,workflow,v025,ux}/`, `dark/student-complete/`: successful dark receipts. Earlier attempts are preserved in their original directories.
- `main-media-before.json` / `main-media-after.json`: local-only media fingerprint comparison.

See [ARCHITECTURE.md](ARCHITECTURE.md#verification-and-tooling) for module paths and safe QA preparation. Choose fresh evidence directories; keep the ignored `output/playwright/.htaccess` HTTP-denial guard. `tools/test-appearance.cjs` defaults to owned QA; `--main` explicitly selects the populated local main app and adds BM confirmation preservation. Mutation suites provide their own isolated QA claim fixtures. Do not run mutation suites concurrently.

## Physical-device limitations

Automated browser work used desktop Chrome with viewport/media emulation. Actual Safari/iOS/Android, physical keyboards, touch feel, screen-reader operation, native browser zoom UI, native tab suspension, battery/thermal behavior and low-powered-device performance remain manual checks. The fixed background should be judged while actually scrolling: full-page stitched screenshots show the fixed viewport layer only once. This report does not assert complete WCAG conformance or production-device performance.
