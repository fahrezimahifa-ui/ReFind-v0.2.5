# UI/UX polish outside the AI feature — report (13 Nov 2026)

Branch `claude/ui-ux-polish`, based on GitHub `main` (`5b6bcdd`). The work was first developed on Codex's local AI branch (`1d17494`), then replayed onto `main` without any AI code; the measurements and the first test round below come from that version. AI Visual Search (Codex) is out of scope: none of this work touches AI files, and on Codex's branch every AI DOM hook stays in place. Testing ran on the owned, isolated XAMPP stage (`http://localhost/refind-xampp-stage/`, private MariaDB on port 3311, synthetic demo data only). The main database, `ReFind_0.2.0_Test` and its database were not touched.

## Issues found (live walkthrough plus measurements)
| Area | Issue | Evidence |
|---|---|---|
| Explore and lists | Cards were very tall, so few results fit per screen | 549 px cards at 1366×768 (1.5 rows), 494 px at 375 px |
| Performance | Every photo sent full size with `Cache-Control: no-store`; empty dark boxes while scrolling | 1000 px, ~120 KB images in 265 px cards and 60 px thumbnails |
| Performance | One `backdrop-filter` blur layer per card | 16 blurred elements on Explore at 1366 px |
| Navigation | Hamburger menu below 1100 px | 1024 px laptops and landscape tablets lost the visible links |
| Cards | Two links per card (photo + "View details") plus a separate title | Redundant tab stops, long cards |
| Copy | "(s)" plurals everywhere: "32 report(s) · active · most recently reported first", "2 record(s)" | |
| Item page | Every rule-based "Similarity" score was the same 75/100 | Noise with no information |
| Report form | Title "Report a Lost item", then "I lost something / I found something" asked again inside section 1 | |
| Profile | Read-only email, role and student ID looked like editable inputs | |
| Notifications | An "Unread" chip on every row (69+ unread); no way to see only unread items | |
| BM Review Queue | Tabs, search and heading stacked; decisions sat at the very bottom of a long detail pane | |
| Buttons | A disabled primary button looked almost the same as an enabled one | |
| Errors | Outage message was "The request could not be completed"; network error said "Check Apache/MySQL" | |

## What changed
| Change | Files |
|---|---|
| New shared polish layer, loaded last on every page by one line in `page.php` (no page `<head>` edits, which keeps merges with Codex clean) | `css/polish.css`, `page.php` |
| Compact cards: 176 px image area, 2-line titles, tighter metadata. The title is the single link (`a.card-details`, which the AI tests still use) and stretches over the whole card. 4 columns at ≥1280 px | `js/student-common.js` (`card`), `css/polish.css` |
| Card surfaces are near-opaque instead of blurred; panels, header and dialogs keep the glass look | `css/polish.css` |
| Photo delivery: `api/photos.php?…&w=480` serves a cached 480 px JPEG (made once with GD into `storage/thumbs/`). All item photos are sent `Cache-Control: private, no-cache` with an `ETag`, and unchanged photos get `304`. Access checks still run on every request | `api/photos.php`, `js/student-common.js` (`thumbUrl`) |
| Skeleton cards on first load of Explore, History and My Activity; the status text stays for screen readers | `js/student.js` (`loading`), `js/student-common.js` (`skeleton`), `css/polish.css` |
| Full navigation from 1000 px (was 1100 px) | `css/styles.css`, `js/shell.js` |
| Unread badges cap at "99+"; the exact count stays in the accessible label | `js/shell.js` |
| Proper plurals ("1 report", "32 reports", "2 records", "1 supporting image") | `js/student-common.js` (`plural`), `js/student.js`, `js/bm.js` |
| Item page: rule-based section renamed "Related reports"; identical scores hidden; gallery thumbnails use the 480 px copy | `app/pages/item.html`, `js/student.js` |
| Report form: one Lost/Found segmented control at the top of the form | `app/pages/report.html` (lines away from the AI consent block), `css/polish.css` |
| Form errors linked to their fields with `aria-describedby`; sticky Submit bar never covers the focused field | `js/student-common.js`, `css/polish.css` |
| Profile: read-only facts shown as text (still focusable for copying) | `css/polish.css` |
| Notifications: unread dot (the word stays for screen readers) and an All / Unread filter (`?unread=1`, validated) | `api/notifications.php`, `app/pages/notifications.html`, `js/student.js`, `css/polish.css` |
| BM queue: heading, tabs and search in a compact two-column header; decision buttons sticky at the bottom of the detail pane from 680 px up; "View details →" removed from queue cards; ↑/↓/Home/End move between queue cards | `css/polish.css`, `js/bm.js` |
| Disabled primary buttons look clearly unavailable | `css/polish.css` |
| Friendlier outage and network messages | `js/api.js` |
| Mobile: smaller page headings, two-column advanced filters, shorter results line | `css/polish.css` |

## Measured effect (same pages, same synthetic data, before → after)
| Page / viewport | Card height | Page height | Blurred elements |
|---|---|---|---|
| Explore 1366×768 | 549 → 370 px | 2714 → 1706 px | 16 → 4 |
| Explore 1024×768 | 583 → 316 px | 4158 → 2533 px | 15 → 4 |
| Explore 768×1024 | 544 → 370 px | 3907 → 2742 px | 15 → 3 |
| Explore 375×812 | 494 → 404 px (first card at 563 → 466 px) | 6681 → 5511 px | 15 → 3 |
| My Activity 1366×768 | 620 → 441 px | 4098 → 2281 px | 21 → 5 |
| History 1366×768 | 549 → 370 px | 2167 → 1291 px | 12 → 4 |

- **Card photo:** 121 KB → 24 KB (480 px copy). Repeat views return `304 Not Modified`.
- **No horizontal overflow and no page script errors** on any of the 96 captured screens (4 viewports, Student, BM and guest, light and dark).

Screenshots: `docs/verification/uiux/*-before.jpg` / `*-after.jpg`.

## Tests
All browser suites ran against the owned stage (`REFIND_TEST_PROFILE=xampp-stage`) with the repo's own Playwright runners.

| Suite | Baseline (before changes) | After changes |
|---|---|---|
| test-layout | 21 pass | 21 pass |
| test-ux | 12 pass | 12 pass (re-run after the final sync) |
| test-student | 24 pass | 24 pass |
| test-account | 24 pass | 24 pass |
| test-theme (includes contrast) | 11 pass | 11 pass |
| test-appearance (includes axe, focus and contrast) | 14 pass | 14 pass |
| test-ui-profile | 12 pass | 12 pass (re-run after the final sync) |
| test-menu-polish (includes contrast) | 14 pass | first run failed on the old 1100 px breakpoint → test updated to 1000 px → 14 pass |
| test-glass-titles | 8 pass | first run failed on "cards must blur" → test updated: cards must not blur, the filter panel must → 8 pass |

Updated test expectations (both are intentional behaviour changes):
- **`tools/test-menu-polish.cjs`:** breakpoint 1100 → 1000 px, now also checking 999/1000/1099 px.
- **`tools/test-glass-titles.cjs`:** cards are now opaque, and the filter panel must still be glass.
- **`tools/test-ux.cjs`:** queue count text "2 record(s)" → "2 records".

Other checks:
- `node tools/check-js.cjs` (42 files) and ESLint pass; `php -l` is clean on every changed PHP file.
- AI PHP unit checks (`tools/test-visual-search.php`): passed on the AI-based version (the file isn't on `main`).
- **Photo access, checked by hand on the stage:** logged out → 401 (full photo and thumbnail); Student → 403 for ownership and claim photos (thumbnail included); bad `w` → 400; repeat view with `If-None-Match` → 304.
- Skeleton loader: 8 placeholders while loading (delayed API), 0 afterwards.

**Re-test after replaying onto `main` (`5b6bcdd`):**
- All nine suites pass again on the stage built from this branch: layout 21, ux 12, student 24, account 24, theme 11, appearance 14, ui-profile 12, menu-polish 14, glass-titles 8 (140 checks).
- `check-js` (39 files), ESLint and `php -l` pass.
- Photo checks repeated with the same results: 401 logged out, 403 for Student on ownership and claim photos (thumbnail included), 400 for a bad size, 304 on revalidation.
- The notification filter accepts `?unread=1` and rejects other values with 400.

Not run:
- **`tools/test-visual-search.cjs` and `test-visual-live.cjs`:** they need Codex's disposable Docker stack (mock or real Gemini, explicit DB port), which isn't available on the XAMPP stage. AI compatibility was checked statically instead: no AI file changed, all `#visual-*` hooks present, and `a.card-details` kept.
- **Full registration suites** (`test-registration*.cjs`), `test-workflow.cjs` and `run-qa.cjs`: not run in this pass.
- **Final sync timing:** layout/student/account/theme/appearance ran before the last sync. That sync only reverted one count string and changed the BM action bar on phones; the BM suites were re-run after it.

## Accessibility notes
- **One link per card.** The title link's hit area covers the whole card (≥ 44 px), and the card shows a focus ring when the link has keyboard focus. My automated "small target" count went up only because it measures the visible link text, not the stretched hit area.
- **Error linking:** inline errors are linked to their fields, and the unread state is still announced as text.
- **Motion and transparency:** skeleton shimmer and card transitions respect `prefers-reduced-motion`; card surfaces fall back to opaque under `prefers-reduced-transparency` / forced colours.
- **BM queue keyboard support:** ↑/↓/Home/End move between queue cards; Enter/Space still open them.

## Known limitations and items not done
- **Mobile filters:** still the inline expanding panel (now two columns on phones), not a bottom-sheet dialog. **Mobile search bar:** not made sticky; the filter panel is too tall for a sticky header on phones.
- **Notification grouping:** stays Today / Earlier. A "This week" group would change the established grouping that the layout test checks.
- **BM desktop:** the page still scrolls about 200 px before both panes are fully visible at 1366×768, because the panes keep the viewport height.
- **One plural left:** the My Activity reports count still says "report(s)". That code shares a minified line with the AI `visual-index-status` code, so it was deliberately left untouched.
- **Thumbnail storage:** cached copies are not deleted when a photo is removed (a few KB each; they become unreachable because their name is a hash of the photo path).
- **AI feature on the stage:** photo search is disabled on the stage by design (`visual_enabled()` only allows `ReFind_0.2.0_Test`), so its panel couldn't be clicked through there.

## Possible conflicts with Codex's AI branch
This branch is based on `main`, which doesn't yet include the AI work. When Codex rebases or merges the AI branch on top of it, expect these overlaps:
- `js/student-common.js`: `card()` markup changed (the media is no longer a link; `a.card-details` is now the title). `#visual-results` cards render through the same function. Both AI browser tests click `a.card-details`, which still exists and still links to the item.
- `js/student.js`: edits only in non-AI functions (`loading`, discovery count text, item detail, report, notifications, history, home). The home-feed line (`limit:4`) sits next to the line where the AI branch adds `visualEnabled`, so git may flag it; keep both changes. The `bindVisualSearch` block and every line containing visual code are byte-identical.
- `app/pages/report.html`: the switch moved at the top of the form, separate from the AI consent block.
- `css/student.css` and `app/pages/browse.html`: not edited.

## Item page: report journey (branch `claude/item-timeline`)
- **New "Report journey" section** on the item page. It replaces the old plain status list with a five-step tracker: Reported → Possible match → Claim review → Ready for pickup → Returned.
- **How statuses map to steps** (per `docs/WORKFLOW_CONTRACT.md`):
  - `UNDER_REVIEW` shows as Reported, with a "Building Management is reviewing this report" note.
  - `UNCLAIMED_CLOSED` turns the last step into a muted "Never retrieved".
- **Step states:**
  - **Current:** a ringed dot plus "Now".
  - **Done:** a filled dot with a check.
  - **Skipped:** dashed outline, for steps the history never visited. For example, a Lost report recorded as Returned without a claim.
  - **Upcoming:** hollow.

  Screen-reader text names each state. On screens up to 519 px the tracker stacks vertically.
- **History is listed newest first:** status chip, relative time (exact campus time in the tooltip and screen-reader text), who made the change, then the note.
- **`api/items.php` history entries gained `actor`:** one of `you`, `building_management`, `reporter`, `student` or `system`. It's computed server-side; no names or user IDs are exposed.
- **Checked on the stage:**
  - every status (`OPEN`, `UNDER_REVIEW`, `POTENTIAL_MATCH`, `VERIFICATION`, `HANDOVER`, `RESOLVED`, `UNCLAIMED_CLOSED`), plus a Lost report returned without a claim;
  - 1366/768/375 px in dark and light: no overflow, no script errors;
  - `test-student` 24, `test-workflow` 27, `test-v025` 24, `test-layout` 21: all pass;
  - check-js and ESLint pass.
- **Screenshots:** `docs/verification/uiux/journey-*.jpg`.
