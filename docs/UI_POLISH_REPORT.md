# ReFind visual refresh — 28 October 2026

Implemented as working changes on `codex/ui-polish`, created from the saved baseline `bc8c6c1`. The application remains v0.2.5. The baseline audit is [UI_AESTHETICS_REVIEW_2026-10-28.md](UI_AESTHETICS_REVIEW_2026-10-28.md).

## Visual changes

- Reconstructed the supplied horizontal logo and standalone symbol as transparent SVG masters with outlined lettering and the blue/cyan gradient. Header sizes are 144px on desktop and 124px on mobile. Added PNG fallbacks, 16/32/48px favicons, and rounded white shortcut exports. See the [asset guide](../assets/README.md).
- Added static pink (`#FCDAFF`), sky-blue (`#79CCFE`), and lilac (`#D8A5FF`) radial gradients over `#F7F8FC`. Login uses 60% layer opacity, Home 45%, and other pages 18%; the wash fades within the upper 900px without repeating down long pages.
- Introduced shared palette, radius, spacing, and surface tokens. Interface blue is `#3F5FB5`, hover is `#344F99`, and secondary text is `#526178`. White panels, inputs, navigation, and dialogs retain opaque surfaces. Major panels have restrained shadows; private-information and semantic status colors remain distinct.
- Balanced Lost/Found action widths and stacked them below 420px; shortened the Home search hint and made activity navigation quieter. Login's journey is an informational ordered sequence.
- Completed shared button state colors, retained secondary borders on hover, and preserved visible focus indicators and usable touch targets.
- Kept claim badges compact, allowed cards to use their natural height, and grouped claim actions in one footer. Discovery uses 14px metadata, lighter detail links, and full-photo 16:10 image areas on mobile.
- Compacted BM claim identity details, replaced the large public photo with an enlargable thumbnail, and moved ownership comparison/evidence earlier. Decisions remain grouped after the review content.

The low-resolution logo references were used to reconstruct vector contours; these are cleaned interpretations of the supplied shapes rather than original editable artwork. SVG paths contain the wordmark directly, so no font download is required. The page backgrounds use CSS without animation or blur filters.

## Interaction found during verification

The first v0.2.5 regression run exposed a timing issue after claim approval: “Schedule pickup now” appeared enabled while the preceding save was still refreshing notifications, and its click could be ignored by the existing saving guard. The follow-up button now stays disabled until that refresh finishes. The regression case holds the notification request deliberately, verifies the disabled state, then releases it and exercises scheduling successfully.

Approval, ownership, scheduling, cancellation, return, and release decisions retain their existing API/business behavior. Backend PHP, API adapters, schema, and configuration were not changed.

## Verification performed for this change

All browser checks used Chrome on this workstation. Mutation scenarios used the owned `ReFind_0.2.0_Test` copy and `refind_db_0_2_0_test`, after checking its ownership marker and effective configuration. Preparation reported existing data/passwords preserved.

| Check | Result |
|---|---|
| Final `node tools/test-v025.cjs` | 24 scenario groups passed, including the deliberately delayed approval follow-up |
| Final `node tools/test-ux.cjs --v025` | 15 scenario groups passed; zero browser errors |
| Main-app visual checks | 66 screen/state captures across 360, 390, 768, 1280, and 1440px; zero horizontal overflow, broken visible images, JavaScript errors, or failed requests |
| Rendered gradient contrast | 45 background samples across Login/Home/working-page presets; minimum secondary-text contrast approximately 4.85:1 |
| Main-app record preservation | Before/after fingerprints matched for nine business tables, including users, reports, claims, handovers, notifications, photos, matches, and item history |
| Branding | Three standalone SVGs validated; PNG export dimensions/transparency checked; logo/favicons inspected at header, enlarged, 16px, and 32px sizes |
| Asset export command | `node tools/export-branding.cjs` passed and regenerated seven PNG files |
| Source checks | Changed JS/CJS syntax, asset references across 13 page templates, and `git diff --check` passed |

The first gradient check measured secondary text below 4.5:1 at a sampled Login location. Darkening the secondary-text token resolved it while retaining the selected background colors and intensity. These are focused engineering checks, not a complete accessibility or usability study. Physical-device keyboard behavior remains a manual check.

## Evidence and reproduction

New evidence stays local under ignored `output/playwright/ui-polish/`:

- `screens/results.json`: visual/layout/contrast checks and main-data fingerprint comparison; screenshots are alongside it.
- `ux-final/ux-results.json`: final UX acceptance result.
- `v025-delayed/v025-results.json`: final v0.2.5 regression result, including the held notification request.
- `branding-review.png`: comparison with the supplied logo reference and small-size previews.

Historical files under `docs/verification/` were retained. `tools/test-ux.cjs` and `tools/test-v025.cjs` now accept the optional `REFIND_EVIDENCE_DIR` output-directory override; their default output locations are unchanged. `REFIND_PLAYWRIGHT_MODULE` and, if necessary, `REFIND_CHROME` select the existing local browser tooling.

To repeat these suites, prepare the owned QA installation and set a separate `REFIND_EVIDENCE_DIR` for each suite before running its command. The local visual script is `output/playwright/ui-polish-check.cjs`. It reads existing main demo records and opens dialogs without submitting business changes; login writes session/throttle state.

The refreshed installation is available at `http://localhost/ReFind_0.2.3/login.html`. No UI commit, push, merge, or pull request was performed during this implementation.
