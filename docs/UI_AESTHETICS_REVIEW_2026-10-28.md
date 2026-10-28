# ReFind v0.2.5 UI aesthetics review

Reviewed on 28 October 2026 against the live PHP/MariaDB installation at `http://localhost/ReFind_0.2.3/`.

**Assessment:** a focused visual polish pass is worthwhile. The navy/cyan identity, restrained backgrounds, readable headings, private-information panels, and generous control sizes are a useful foundation. The largest opportunities concern action hierarchy, card composition, secondary text, and the amount of scrolling needed to review a claim.

These are review findings and proposed changes. Application UI and business rules were not changed.

## Scope and current verification

- Started the existing XAMPP Apache and MariaDB installation; login URL returned HTTP 200.
- Captured 45 screen/state combinations at 1440px and 390px: guest/login, Student Home, Explore, expanded filters, empty search, item detail, Lost/Found forms, claim form, activity/claims, History, Notifications, profile/settings, mobile navigation, and all three BM queues/details.
- Follow-up captures verified loaded BM details and approval dialogs at both widths, plus Home at 360px and 768px. The six BM detail screenshots were replaced after explicitly waiting for their selected record to render.
- Initial capture run: zero horizontal overflow, zero broken visible images, zero JavaScript page errors, and zero failed network requests. Fingerprints of nine business tables matched before/after that run, including users, reports, claims, handovers, photos, matches, notifications, and item history.
- Follow-up checks: primary and secondary hover colors inspected after transitions completed; sampled Tab navigation through report location, specific spot, and date kept those focused controls clear of the sticky action bar. The mobile BM dialog displayed its target, note, confirmation, and actions within the viewport.
- Login creates session/throttle state. No report, claim, pickup, account, or notification update was submitted. This was a visual inspection with interaction spot checks, not a complete accessibility audit, physical-device test, or workflow regression suite.

Local evidence remains in `output/playwright/2026-10-28-ui-review/`: `results.json` contains the capture results and `details.json` contains the focused checks. Evidence filenames below are relative to that directory. Screenshots, results, and review scripts are ignored local resources and are excluded from the public GitHub repository.

## Prioritized findings

### 1. Give the two Home reporting paths balanced space

[app/pages/home.html:12](../app/pages/home.html#L12), [css/styles.css:74](../css/styles.css#L74), [css/auth.css:23](../css/auth.css#L23) — the generic primary-action `flex:2` rule makes “I lost something” much wider than “I found something.” At 390px the Found label wraps to two lines; at 360px the controls measure approximately 165px and 111px wide and both grow to 67px high. The search hint also truncates in its narrow input.

**Proposed, medium priority:** give these two entry points equal width, use concise labels with supporting context if necessary, and stack them when neither label fits comfortably. Keep Search visually distinct from report creation, and use a shorter search hint on small screens. Make the activity follow-up a quieter navigation link.

Local evidence: `home-1440.png`, `home-390-viewport.png`, `home-360-viewport.png`.

### 2. Preserve the border on secondary-button hover

[css/auth.css:8](../css/auth.css#L8), [css/auth.css:16](../css/auth.css#L16) — `.btn-outline` sets a resting border but does not override Bootstrap's hover border variable. Live computed styles change the Found button border from `rgb(123, 138, 160)` to fully transparent on hover, while its background becomes `rgb(238, 241, 251)`.

**Proposed, medium priority:** explicitly set the hover and active border colors for the shared secondary button. Increase visual emphasis on hover while preserving the existing focus ring. Establish consistent primary, secondary, text-navigation, warning, and destructive treatments so frequent “View details” links do not compete with workflow decisions.

Local evidence: normal/hover computed styles in `details.json`.

### 3. Compact claim cards and group their actions

[css/student.css:5](../css/student.css#L5), [js/student.js:142](../js/student.js#L142) — activity cards stretch to their grid row's tallest content. Status and classroom-example chips stretch across the card, and `margin-top:auto` applies to every button. A short pending claim consequently contains large gaps between its content, “View item,” and “Withdraw claim.” Pickup cards mix desk information, notes, and outcomes in the same tall grid.

**Proposed, medium priority:** size badges to their content and put a claim's actions in one footer group. Use content-sized cards or compact activity rows; make the status, next action, and pickup information easy to scan. Preserve visible demo identification, review notes, and ownership/pickup semantics.

Local evidence: `claims-1440.png`, `claims-390.png`.

### 4. Bring BM verification content into view sooner

[js/bm.js:81](../js/bm.js#L81), [css/bm.css:1](../css/bm.css#L1) — claim details place several identity fields and a large public image before the claimant/finder comparison. In the sampled desktop record, the comparison starts below the initial 900px viewport; mobile needs substantial scrolling to reach both evidence and decision controls.

**Proposed, medium priority:** use a compact identity summary and smaller public-photo preview, then prioritize the answer/clue comparison and private evidence. Keep the decision controls grouped directly after the required review content. Preserve full evidence access, target identity, revision checks, and explicit confirmation for final decisions.

Local evidence: `bm-claims-detail-1440.png`, `bm-claims-detail-390.png`, `bm-approve-dialog-390.png`.

### 5. Improve secondary-text hierarchy and discovery density

[css/student.css:2](../css/student.css#L2), [css/student.css:3](../css/student.css#L3), [css/bm.css:1](../css/bm.css#L1), [js/student-common.js:19](../js/student-common.js#L19) — location/date text is generally 13px, and several metadata labels and queue descriptions are 12px. Discovery combines large image areas, multiple chips, long demo location strings, and a full-width outlined action on every card. The sampled 12-card Explore page is approximately 6809px tall at 390px.

**Proposed, lower priority:** define a small shared type scale, use approximately 14px for important secondary information, and reserve 12px for incidental metadata. Separate campus area from detailed location text, reduce repetitive framing, and consider a compact discovery layout on mobile. Preserve complete item names, real links, image access, meaningful status labels, and visible synthetic-data identification. Duplicate photos and long synthetic descriptions in this dataset are demo characteristics, not evidence of a matching or data defect.

Local evidence: `explore-1440.png`, `explore-390.png`.

### 6. Make decorative onboarding elements look informational

[app/pages/login.html:12](../app/pages/login.html#L12), [css/auth.css:6](../css/auth.css#L6) — “Report / Discover / Verify / Return” are noninteractive spans styled as outlined capsules, visually similar to actual filter and type buttons elsewhere.

**Proposed, lower priority:** present them as a simple connected sequence or text list, with restrained cyan accents. A smaller mobile introduction would also bring the sign-in form higher in the first screen. Keep the existing brand and clear field labels.

Local evidence: `login-1440.png`, `login-390.png`.

## Suggested implementation order

1. Correct shared secondary-button states and Home action sizing.
2. Refine activity-card badges, spacing, and action grouping.
3. Compact BM claim presentation around comparison and evidence.
4. Apply shared typography, card, and informational-element refinements.

Keep the current routes, auth roles, private-media boundaries, status vocabulary, and transactional workflow. Validate changed screens at 360px, 390px, 768px, and 1440px, including hover, focus, long labels, and dialogs. Any changes to required inputs or business rules need their own scoped development task.

Reference used for interaction review: [Vercel Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), accessed 28 October 2026. These guidelines support the hover/focus checks; visual-density and hierarchy recommendations are design judgments from the live screens.
