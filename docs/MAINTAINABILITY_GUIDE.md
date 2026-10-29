# ReFind maintainability and code-review guide

Baseline: `0e7f7bd` on `codex/release-readiness`; refactor: `codex/maintainability-refactor`. This guide describes the PHP/MariaDB application v0.2.5. The folder and database retain older version labels. It is separate from the serverless academic submission template.

## 1. Focused findings and changes

| Priority | Finding | Changes and benefit | Complexity / regression risk |
|---|---|---|---|
| 1 | Student form handlers interleave validation, upload state, payloads and saving; activity rendering is nested inside loading. | [student.js](../js/student.js): `reportForm` now names `validateReport` and `buildReportForm`; `claimForm` uses `loadLinkableLostReports`; `activity` uses `claimActivityCard`. The controller reads as a sequence of responsibilities. | Medium / medium |
| 2 | BM operation setup uses dense conditionals; submission mixes validation and endpoint-specific fields with recovery. | [bm.js](../js/bm.js): `openOperation` has explicit explanation branches; `validateOperation` and `buildOperationRequest` separate input checks and payload routing. Save/error/finally handling remains together. | Medium / medium |
| 3 | Ownership and pickup transitions hide transaction steps inside compressed branches. | [workflow.php](../app/workflow.php): `review_claim`, `staff_status` and `mutate_handover` expose checks, locks, writes, commit and rollback. `create_approved_pickup` and `release_approved_pickup` name two substantial business steps. | High / high |

These priorities concern maintainability, not newly discovered functional defects. Helpers stay in the existing files. Short, straightforward operations remain inline; no framework, dependency, file split, schema or public API change is introduced. An inaccurate finder-prefill comment was corrected: the Found report keeps today's date.

Request order, pagination, selectors, messages, FormData keys, confirmation rules, notifications and SQL statements are preserved. Extraction adds no network/database round trips or render passes. Query-count checks are useful evidence about projection performance; they are not a general timing benchmark.

## 2. Three real before-and-after comparisons

Excerpts below are copied from the baseline and refactored source, rather than reconstructed examples. The original long lines deliberately show the readability problem. Verification references identify the existing suites that exercise the behavior; final-head CI results belong to the linked Actions run and delivery receipt.

### A. Student report submission

**Before:** the submit handler immediately clears errors, checks fields and builds the entire request. Validation and request construction are difficult to inspect independently.

```javascript
    $('#report-form').on('submit',async function(event){event.preventDefault();if(sending||publicUpload.busy||proofUpload.busy)return;U.clearErrors();if(!U.required({title:fields.title,description:fields.description,category_id:fields.category_id,location_id:fields.location_id,date:fields.date,clue:fields.clue}))return;
      let first=null;const check=(ok,key,message)=>{if(!ok){fieldError(key,message);first||=key;}};
      check(Array.from($('#r-title').val().trim()).length>=3,'title','Use at least 3 characters for the item name.');
      check($('#r-date').val()<=refs.campus_today,'date','The event date cannot be in the future.');
      check(Array.from($('#r-clue').val().trim()).length>=8,'clue','Give at least 8 characters so Building Management can verify the owner.');
      if(first){U.revealField(fields[first]);return;}
      const form=new FormData();Object.entries({action:existing?'update':'create',...(existing?{id:edit}:{}),type,title:$('#r-title').val().trim(),description:$('#r-description').val().trim(),category_id:$('#r-category').val(),location_id:$('#r-location').val(),location_detail:$('#r-detail').val().trim(),date:$('#r-date').val(),time:$('#r-time').val(),clue:$('#r-clue').val().trim(),keep_photo_ids:JSON.stringify(keepPublic),keep_ownership_ids:JSON.stringify(type==='LOST'&&$('#keep-proof').prop('checked')?savedProof:[])}).forEach(([k,v])=>form.append(k,v));publicUpload.append(form,'photos');if(type==='LOST')proofUpload.append(form,'ownershipPhotos');
```

**After:** the handler states the steps. `validateReport` retains the same required-field checks, Unicode character counting and first-error focus order. `buildReportForm` retains field order, saved-photo IDs and public/private upload collections. The following save/catch/finally block remains explicit.

```javascript
    $('#report-form').on('submit',async function(event){
      event.preventDefault();
      if(sending||publicUpload.busy||proofUpload.busy)return;
      if(!validateReport())return;
      const form=buildReportForm();
```

**Verification:** `tools/test-student.cjs` covers report creation, prepared uploads, unknown event time, failed-save drafts and retry. `tools/test-v025.cjs` covers future dates and Unicode claim answers. Syntax/lint and a baseline string-literal inventory check also pass; literal equality alone does not prove behavior.

### B. BM operation request construction

**Before:** endpoint selection and all operation-specific fields appear in the middle of the submit lifecycle.

```javascript
    const values = {id:operation.id,revision:operation.revision,note,confirm:'1'}; let endpoint = 'staff.php';
    if (operation.kind === 'claim') { values.action = 'review'; values.decision = action; }
    else if (operation.kind === 'report') { values.action = 'status'; values.status = $('#operation-status').val(); }
    else { endpoint = 'handovers.php'; values.action = action; if (['schedule','reschedule'].includes(action)) { values.pickup_location_id = $('#operation-location').val(); values.scheduled_at = $('#operation-date').val(); } }
```

**After:** the same routing is readable on its own. The submit handler calls `validateOperation(note)` before `buildOperationRequest(note)`, then sends once. Draft retention, refresh after a 409, confirmation reset and button recovery remain in its catch/finally blocks.

```javascript
  function buildOperationRequest(note) {
    const action = operation.action;
    // Every BM mutation carries the displayed revision; a failed request is never replayed automatically.
    const values = {id:operation.id,revision:operation.revision,note,confirm:'1'};
    let endpoint = 'staff.php';
    if (operation.kind === 'claim') {
      values.action = 'review';
      values.decision = action;
    } else if (operation.kind === 'report') {
      values.action = 'status';
      values.status = $('#operation-status').val();
    } else {
      endpoint = 'handovers.php';
      values.action = action;
      if (['schedule','reschedule'].includes(action)) {
        values.pickup_location_id = $('#operation-location').val();
        values.scheduled_at = $('#operation-date').val();
      }
    }
    return {endpoint,values};
  }
```

**Verification:** `tools/test-workflow.cjs` covers actual review/pickup dialogs, stale revisions and draft preservation without automatic replay. `tools/test-v025.cjs` covers final-action confirmation, unchanged rescheduling, release navigation and mobile Back behavior. `tools/test-appearance.cjs` checks BM drafts and confirmation during theme/motion changes. Syntax/lint and baseline string inventory pass.

### C. Approval creates an approved pickup inside one transaction

**Before:** optional pair creation, report status updates and handover creation are compressed directly into the approval branch.

```php
                if($lostId){$lost=&$locked[$lostId];sql("INSERT INTO item_matches(lost_item_id,found_item_id,match_score,match_status,confirmed_by_user_id,confirmed_at) VALUES (?,?,?,'CONFIRMED',?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE match_score=VALUES(match_score),match_status='CONFIRMED',confirmed_by_user_id=VALUES(confirmed_by_user_id),confirmed_at=VALUES(confirmed_at)",[$lostId,$foundId,match_score($lost,$found),(int)$user['user_id']]);status_change($lost,'HANDOVER',(int)$user['user_id'],'Ownership verified; matched item is ready for pickup.',false);unset($lost);}
                status_change($found,'HANDOVER',(int)$user['user_id'],'Ownership verified by BM. Item is ready for pickup.');
                sql("INSERT INTO handovers(claim_id,pickup_location_id,handled_by_user_id,notes) VALUES (?,?,?,'Awaiting a pickup appointment.')",[$id,$found['location_id']?(int)$found['location_id']:null,(int)$user['user_id']]);
                $handoverId=(string)db()->insert_id;
```

**After:** the branch names that business step, then closes competitors. `create_approved_pickup` performs the same optional pair write, Lost/Found status changes and handover insert in the same order. It captures `insert_id` immediately, before notification/history inserts can replace it.

```php
                $handoverId = create_approved_pickup($locked, $claim, (int) $user['user_id']);
                foreach ($active as $other) {
                    if ((int) $other['claim_id'] === $id) continue;
                    $reason = 'Another ownership claim was verified by Building Management.';
                    sql("UPDATE claims SET claim_status='REJECTED',reviewed_by_user_id=?,review_note=?,reviewed_at=UTC_TIMESTAMP() WHERE claim_id=?", [(int) $user['user_id'], $reason, (int) $other['claim_id']]);
                    notification((int) $other['claimant_user_id'], 'CLAIM_REJECTED', 'Claim closed', $reason, $foundId, (int) $other['claim_id']);
                }
```

The helper takes the locked report collection by reference so status changes update the same records the transaction uses. It does not acquire locks or commit. `review_claim` still owns eligibility checks, claim update, competitor handling, suggestion cleanup, final notification, commit and rollback. Similarly, `release_approved_pickup` changes claim/pair ownership and deletes the pickup; `mutate_handover` retains report settlement and audit.

**Verification:** `tools/test-workflow.cjs` covers one owner/pair/handover, competing approvals, stale writes and forced notification/audit failures with rollback. `tools/test-v025.cjs` covers legacy shared-Lost competitors and pickup release. PHP syntax, PHPStan level 5 and the baseline SQL/workflow-call inventory check pass. Database integration is confirmed separately by CI.

## 3. Architecture and code navigation

| Layer | Start here | Responsibility |
|---|---|---|
| Page routing and templates | [.htaccess](../.htaccess), [page.php](../page.php), [routes.php](../app/routes.php), `app/pages/` | Allowlisted routes, session/role guards, configured base path and shared HTML navigation. `admin.html` renders the BM template. |
| Presentation and browser controllers | `css/`, [student.js](../js/student.js), [bm.js](../js/bm.js), [student-common.js](../js/student-common.js) | Existing typography, layout, jQuery event handling, cards, forms and feedback. `js/theme.js` and `css/theme.css` handle Appearance and light/dark presentation. |
| Shared browser communication | [api.js](../js/api.js), `js/shell.js` | Same-origin fetch, in-memory CSRF/session identity, shared navigation and unread state. |
| HTTP adapters | `api/*.php`, [bootstrap.php](../api/bootstrap.php) | Methods, allowed fields, authentication/role/CSRF guards, application calls and JSON/photo responses. |
| Business operations | [reports.php](../app/reports.php), [claims.php](../app/claims.php), [workflow.php](../app/workflow.php) | Report create/edit/delete; claim submit/resubmit/withdraw; BM review, operational status and pickup transactions. |
| Reads and policies | [repository.php](../app/repository.php), `app/policies.php`, `app/staff-read.php`, `app/pickup-read.php` | Safe projections, eligibility, matching, BM details and authorized pickup information. |
| Persistence and media | [db.php](../app/db.php), [schema.sql](../database/schema.sql), [uploads.php](../app/uploads.php) | mysqli prepared statements; relational constraints; independently validated files in private storage. |
| Identity and errors | [auth.php](../app/auth.php), [http.php](../app/http.php) | Server sessions, role/CSRF checks, validation, `HttpError`, generic server failures and JSON responses. |

A concrete report-submission trace:

1. Apache routes `report.html` through `page.php`; `page_routes()` allows Students and renders the internal template.
2. `reportForm()` validates and constructs FormData. `ReFind.request()` sends it to `api/items.php` with same-origin cookies and an `X-CSRF-Token` header.
3. `request_user('STUDENT', true)` verifies the server identity, role and CSRF. The adapter calls `mutate_report()`.
4. The backend validates fields/files, locks affected reports and uses prepared `sql()` calls in a transaction. Media cleanup follows rollback/commit rules.
5. `json_response()` returns the result. The browser displays a flash message and redirects to the saved item.

The frontend improves usability; the server remains authoritative. Students report, search, submit identifying claims and follow their activity. BM inspects private evidence, decides ownership, schedules pickup and confirms physical return. Suggested matches are not ownership decisions.

Important records live in MariaDB **and** private `storage/items`, `storage/evidence` and `storage/claims`. A Git checkout alone is not a populated installation. For detailed contracts, use [ARCHITECTURE.md](ARCHITECTURE.md), [WORKFLOW_CONTRACT.md](WORKFLOW_CONTRACT.md), [ROLE_ROUTE_MATRIX.md](ROLE_ROUTE_MATRIX.md) and [DATA_DICTIONARY.md](DATA_DICTIONARY.md); later v0.2.5 behavior supersedes historical checkpoints.

## 4. Professor preparation: 12 questions

1. **Why procedural PHP, and where are responsibilities separated?** The application uses small HTTP adapters, procedural domain modules and shared prepared-query helpers. This suits the existing XAMPP deployment and avoids a framework migration. The trade-off is that developers must keep module responsibilities and transactions clear themselves. Start with `api/items.php`, `mutate_report()` and `sql()`.

2. **Does hiding a BM menu prevent Student access?** No. `page.php` and `page_routes()` guard page delivery; `request_user()` and `require_role()` protect APIs. Object policies additionally check ownership and workflow eligibility. Browser navigation is only presentation.

3. **How do login, sessions and CSRF work together?** `login_account()` verifies a password hash and establishes a server session. `auth_user()` resolves identity; `verify_csrf()` checks mutation tokens. `ReFind.request()` sends the token. Neither localStorage nor a submitted role/user ID grants authority. Study session regeneration and credential invalidation in `app/auth.php` and `app/accounts.php`.

4. **How is private evidence protected?** Safe read models omit private clues and evidence URLs from public report views. `api/photos.php` checks the signed-in user and collection permissions; BM can read ownership evidence. Students may retain their own evidence IDs/counts without permission to read the private image bytes in this MVP. Read `safe_item()` and the photo endpoint.

5. **How are database queries protected from SQL injection?** `sql()` in `app/db.php` prepares statements and binds values. Dynamic filtering uses controlled SQL fragments and field allowlists. Prepared values cannot safely replace arbitrary SQL identifiers, so allowlisting remains necessary.

6. **Why validate both in JavaScript and PHP?** Browser checks give immediate feedback, but requests can bypass them. `report_values()`, `valid_event_date()`, `mutate_claim()` and `uploaded_images()` independently enforce server rules. `field_fail()` preserves field-specific errors. Both layers must retain the same user-visible contract.

7. **What if a save fails after writing a photo?** `save_upload()` records newly created files. Report/claim catch blocks roll back SQL and clean those files; replaced files are removed after commit with reference checks. Database rollback alone cannot undo filesystem writes. Study `mutate_report()`, `mutate_claim()` and `cleanup_media()`.

8. **Does a high matching score prove ownership?** No. `suggestion_score()` and `match_score()` apply category, location, word and date rules; `MATCH_THRESHOLD` is 55. Suggestions require eligible opposite-type reports from different reporters. BM still reviews identifying evidence. The score is not an ownership probability or measured accuracy rate.

9. **Can a rejected claim be resubmitted?** Rejection is final for that claimant/item. `NEED_MORE_INFO` and `WITHDRAWN` can return to `PENDING` using the same claim record when eligible. A linked Lost report can back only one claim under review. Read `mutate_claim()`, `withdraw_claim()` and the policy constants.

10. **How are two simultaneous ownership approvals handled?** `workflow_lock()` serializes matching-related operations per database; `lock_items()` locks parent reports in numeric order. `review_claim()` rereads and checks the revision inside the transaction. Claims, pair, handover, history and notifications commit together. Stale/duplicate/concurrent conflicts return 409; failure rolls back all related SQL.

11. **How do cancellation, release and completion differ?** `cancel_schedule` clears the appointment while retaining approved ownership. `release` rejects the claim, withdraws the confirmed pair, removes the handover and settles report availability. `complete` records physical return and synchronizes Returned states. `valid_schedule()` interprets campus input as Asia/Jakarta and stores UTC; unknown event times remain null.

12. **How do you establish that this refactor preserves behavior?** Review the source diff, run syntax/static checks and existing regression suites, then inspect final CI receipts for roles, files, workflows, concurrency, rollback and both themes. Appearance tests cover drafts/focus and motion preferences; query checks cover projections. These engineering checks do not replace physical-device testing or demonstrate user-research outcomes.

These answers are navigation starting points, not a script to memorize. This refactor and guide were produced with AI assistance and automated checks. They do not establish that any student personally authored every line. Be prepared to trace one real request and explain the checks in your own words.

## 5. Verification, limits and next study

Local results during this refactor:

| Check | Result |
|---|---|
| PHP syntax (39 files) / JavaScript syntax (31 files) | PASS |
| ESLint / PHPStan level 5 | PASS |
| Offline release/isolation tests (11) | PASS |
| Baseline JS string literals and PHP SQL/workflow-call inventories | PASS |
| Local API/browser mutation suites | NOT RUN: Docker engine and MariaDB were unavailable |
| Main database fingerprint comparison | NOT RUN: read-only fingerprint command could not connect to MariaDB |

The [branch Actions runs](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5/actions?query=branch%3Acodex%2Fmaintainability-refactor) provide the complete remote matrix; the delivery receipt identifies the exact tested commit and result. The [successful baseline run](https://github.com/fahrezimahifa-ui/ReFind-v0.2.5/actions/runs/40824241745) is historical baseline evidence, not verification of the refactor.

Main setup/seeding/login and the existing local QA installation were not used. Protected-file/media/schema and unrelated-edit hashes are captured privately for preservation checks. No screenshot collection is committed. Visual evidence remains in ignored/local or synthetic CI artifacts; physical devices and manual assistive-technology checks remain outside this automated run.

Remaining recommendations, in order:

1. **Study transaction and error paths first.** Understand by-reference locked records, advisory versus row locks, revision freshness, rollback and filesystem cleanup before changing ownership rules.
2. **Simplify remaining dense form setup/rendering only when modifying it for a real task.** `reportForm`, `claimForm`, notification rendering and other backend modules retain readable-improvement opportunities; a blanket rewrite would enlarge regression risk.
3. **Consider shared query/dialog helpers only after repetition causes a concrete maintenance problem.** Current small duplication does not justify a general component system.
4. **Keep performance and research claims evidence-based.** Preserve existing request/query shape; separately scope any optimization, production runtime upgrade, matching evaluation or usability study. Existing matching has no demonstrated probability interpretation.
