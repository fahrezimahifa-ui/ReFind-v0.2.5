# ReFind: requirements, implementation and proposed roadmap

This is a traceability guide for the v0.2.5 development workspace, compiled on 27 October 2026. It relates academic product intent to current source and records later research proposals. It is not authorization to implement the whole backlog.

Read [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) for evidence/roles and [ARCHITECTURE.md](ARCHITECTURE.md) for technical details. **WDD**, **UX8** and **UX-I** use the [source register](PROJECT_CONTEXT.md#source-register); all report citations are 1-based PDF viewer pages.

## 1. How to interpret status

| Status | Meaning |
|---|---|
| **Implemented** | Supported by the current source/schema and documented workflow; historical runtime tests are separately referenced |
| **Academic template** | Behavior of the serverless WDD submission; not the persistence/auth architecture of this workspace |
| **Proposed** | A report's next-iteration idea or priority, requiring a scoped development task and any needed operational decisions |
| **Open decision** | Source disagreement or incomplete campus/product policy; the context pack does not choose a new rule |

Latest user instructions determine task scope. Code/schema/configuration establish current implementation; reports establish intent/evidence; official briefs establish academic submission requirements. Preserve differences rather than silently treating every source as a single specification.

## 2. WDD functional requirements and implementation

The KF identifiers below come from the report's requirements, WDD pp.22–23, Tables 4.4–4.5. Detailed flows are on pp.40–43, 55–56, and multimedia/privacy on pp.64–65.

| Requirement | Status and current interpretation | Implementation entry points |
|---|---|---|
| **KF-01: Lost/Found reporting** | Implemented: Student creates reports with required item/event/location details and private identifying clue; photographs follow collection/count rules | [reports.php](../app/reports.php), [items API](../api/items.php), [report template](../app/pages/report.html), [uploads.php](../app/uploads.php) |
| **KF-02: search/filter** | Implemented: keyword, Lost/Found, category, location, status/date filtering and pagination | [items API](../api/items.php), [student.js](../js/student.js), [browse template](../app/pages/browse.html) |
| **KF-03: suggested matches** | Implemented: eligible rule-based opposite-type pairs, threshold 55, no same-reporter/other-category pairing; not automatic approval | [repository.php](../app/repository.php), [refresh maintenance tool](../tools/refresh-matches.php) |
| **KF-04: structured ownership claims** | Implemented: identifying answer, optional evidence/own Lost link, request-info resubmission and undecided-claim withdrawal; one claim record per claimant/item | [claims.php](../app/claims.php), [claims API](../api/claims.php), [claim template](../app/pages/claim.html) |
| **KF-05: BM verification** | Implemented: approve, request more info or reject, with private clues/evidence, eligible state and fresh revisions; rejection is final | [workflow.php](../app/workflow.php), [staff API](../api/staff.php), [staff-read.php](../app/staff-read.php) |
| **KF-06/KF-07: status/history and notifications** | Implemented: persisted status events and own in-app notifications/read-all; History is the closed-report archive | [repository.php](../app/repository.php), [notifications API](../api/notifications.php), [history template](../app/pages/history.html), [schema](../database/schema.sql) |
| **KF-08: pickup and closure** | Implemented: schedule/reschedule/cancel schedule/release/confirm return; eligible Lost recovery and Never retrieved closure; physical custody transfers are not separately recorded | [workflow.php](../app/workflow.php), [handovers API](../api/handovers.php), [pickup-read.php](../app/pickup-read.php) |
| **KF-09: accounts and restricted access** | Implemented: email/password session login/logout, own display-name/password updates, server route/API roles; no campus SSO | [auth.php](../app/auth.php), [accounts.php](../app/accounts.php), [routes.php](../app/routes.php), [account API](../api/account.php) |

Additional current behavior includes eligible own report editing/deletion, “I found this item” from another student's Lost report, a configurable BM pickup desk, claim/pickup deep links and role-aware navigation. Trace exact transitions to [WORKFLOW_CONTRACT.md](WORKFLOW_CONTRACT.md) and latest fixes to [V025_REPORT.md](V025_REPORT.md).

### Quality and integrity requirements

| Requirement area | Current implementation/design | Evidence boundary |
|---|---|---|
| Responsive, understandable interface | Mobile-first top navigation, photo-led discovery, contextual feedback, explicit final decisions and native route links | Implementation decisions and recorded UI QA; user usability still needs evaluation |
| Role/ownership/privacy | Server identity, CSRF, authorization, signed-in report media, BM-only private evidence, prepared statements and validated file delivery | Code and role/workflow contracts; template client checks are not equivalent |
| Consistent persistence | MariaDB/InnoDB, ordered locks, transactions, revision checks, database constraints, rollback-aware file lifecycle | Existing engineering tests are historical; rerun relevant checks for changes |
| One rightful recipient | One approved claim/owner for Found, one confirmed pair, one handover per claim | Human review remains the authority; match score is not verified accuracy |
| Time and audit | UTC audit/schedules, campus-time presentation, null unknown times, private pickup audit | Preserve actual timestamps and privacy boundaries |

Sources: WDD pp.23–24, 51–56, 64–66; [role/API contract](ROLE_ROUTE_MATRIX.md), [workflow contract](WORKFLOW_CONTRACT.md), [acceptance history](ACCEPTANCE_TESTS.md).

## 3. UX needs mapped to current coverage

The K identifiers are from UX8 p.46, Table 4.12. Proposed design links are in UX8 pp.47–48 and UX-I pp.48–49. The reports' priority labels describe research recommendations, not current implementation scope.

| UX need | Current coverage | Remaining proposal or research question |
|---|---|---|
| **K-01/K-02/K-09: know the official route, search/report centrally, identify the responsible unit** | Explore, Report, Home actions, My Activity and BM desk information | Explicit service-point/how-it-works guidance and responsible-unit labels |
| **K-03: know status and current physical location** | Report status, report event location and authorized pickup details | Actual current custody/location, transfer events and meaningful freshness information |
| **K-04/K-08: prove and verify ownership clearly** | Private clue, identifying answer, optional evidence, BM review and request-info loop | Guided questions aligned with staff practice; operational agreement about KTM/identity requirements |
| **K-05: easy, trusted finder handoff** | Found reporting | Lower effort and confirmation of physical staff receipt; finder motivations still need interviews |
| **K-06: know what a finder must record** | Current validated form and collection rules | Research-backed minimum inputs; this need was not directly validated |
| **K-07/K-11: connect receipt, transfer and handover without burdening staff** | Claim review, pickup, return and private audit | Security intake/logbook, custody transfer confirmation and workload testing |
| **K-10: understand retention/display timing** | Manual Never retrieved archive state | Approved retention/display/reminder rules and exceptions |

**Important distinction:** report discovery location, pickup appointment location and present physical custody are different concepts. Existing location fields do not prove an implemented custody-tracking feature.

## 4. Proposed next-iteration backlog

All rows below remain **Proposed**, including those marked Must in a report. Their implementation has not been approved merely by creating these guides. Sources: UX8 pp.47–49; UX-I pp.33–34, 48–50.

| Proposal | Intended benefit | Decisions/dependencies before implementation |
|---|---|---|
| Security intake role and digital logbook | Mirror the existing entry procedure with low data-entry burden | Validate security workflow, required fields, permissions and relationship to BM |
| Physical receipt/custody transfers | Show who has the item and where it is now | Define custody events, confirmation, locations, roles and audit; receipt cannot be inferred from a Found post |
| How-it-works/service-point guidance | Clarify official reporting and collection route | Confirm units, service points and wording; validate information architecture |
| Simplified finder form and guided claim questions | Reduce effort while retaining useful discovery/verification data | Reconcile required title/date/private clue with the proposed three-input form |
| Campus authentication/identity | Improve confidence in campus membership | Integration availability, identity proof, privacy and staff policy; existing demo login is not SSO |
| Retention/display dates and reminders | Reduce uncertainty and missed collection | Confirm policy and valuable-item exceptions; approximate one week is insufficient for an automatic timer |
| Privacy-preserving Student Service handoff | Help contact owners of identifiable belongings | Define access, consent/contact handling and cross-unit responsibilities |
| Mediated communication, share-back links and QR discoverability | Connect existing channels to a canonical report | Scope, privacy, staff workload and evidence that the change helps |

Existing matching should be preserved during unrelated work. Improving matching quality is a separate proposal requiring useful labeled/evaluated examples; the current threshold does not establish accuracy.

## 5. Open decisions and documentation conflicts

| Topic | Current baseline / report conflict | How to carry it forward |
|---|---|---|
| Artifact scope | WDD frontend-only template and PHP application share v0.2.5 | Identify the artifact in every implementation/test claim |
| Staff roles | Actual auth has Student/BM; research involves security/Student Service | Keep additional roles proposed until a scoped role/workflow design is requested |
| Identity and collection | Research mentions KTM/signature; proposals discuss campus login | Confirm whether and how a digital identity changes physical checks |
| Custody and retention | Approximate security-to-BM interval, display/disposal practices and exceptions | Establish actual campus policy; Never retrieved does not mean discarded |
| Required finder fields | A proposed photo/category/location form differs from current title/date/clue rules | Resolve research, matching and verification needs together |
| Language and branding | Current actions are English; research recommends familiar Indonesian campus wording | Confirm intended locale; keep meaning and terminology consistent |
| SUS acceptance target | Detailed UX tables say at least 80; nearby individual prose refers to comparator score 86.5 | Treat 80 as the table's proposed target; confirm before using it as acceptance |
| Matching priority | Listed Should in some tables, Must elsewhere for persistent-report matching | Separate preserving existing behavior from prioritizing enhancements |
| UI validation versus storage size | Pickup note UI/API limit is 250; database column supports 500 | Preserve the current API contract unless deliberately revised |
| Diagram freshness | B06 flowcharts omit newer withdraw/release changes | Consult v0.2.5 code/contracts; update source and exports when diagrams are changed |

For exact implemented exception behavior: WITHDRAWN/NEED_MORE_INFO resubmit the same claim record; REJECTED remains final; releasing pickup removes that handover, rejects the claim/pair and settles reports. These resolve report-level ambiguities through [app/claims.php](../app/claims.php) and [app/workflow.php](../app/workflow.php), not new assumptions.

## 6. Proposed evaluation and success criteria

These are **planned targets**, not achieved ReFind outcomes. Sources: UX8 p.49, Table 4.14; UX-I p.50, Table 3.25.

| Task | Proposed evaluation target |
|---|---|
| Five Student finders report an item | Without assistance, at most 60 seconds; individual table also specifies at least 90% success |
| Five owners search and submit a claim | At least 90% success |
| Five owners inspect status/location/retention | At least 90% success without asking |
| One–two security staff record intake | At most 30 seconds per item |
| One BM operator reviews claim/records handover | Without assistance; individual table adds at most five minutes |
| Overall usability | Detailed test tables propose SUS at least 80; reconcile the prose discrepancy |

With five participants, a 90% participant-success threshold requires 5/5. Define timing boundaries and task-level success before testing. Future operational measures could include recording coverage, legitimate return rate, collection before closure and matching usefulness; the reports provide no achieved outcomes or approved numerical targets for them.

## 7. Academic deliverables versus application features

- **WDD theory:** product/design report, storyboard, wireframes, site diagram, user flow, design methodology, relevant multimedia, conceptual database and a five-minute presentation. [Official theory brief pp.1–3, location in the source register]
- **WDD lab:** explain technical use of design artifacts and demonstrate HTML/CSS/JS without server-side code for the midterm submission. The team's packaging instructions select the serverless template; the PHP implementation remains a separate artifact. [Official lab brief pp.1–3; WDD pp.52–56]
- **UX:** evidence-led As-Is/To-Be analysis, prior-study/gap/comparator reasoning, method stages, personas/stakeholder needs, citations and findings-to-design links in the required individual submission. [Official UX brief pp.1–4]

Course grouping, templates, report format, citations and submission rules are academic context. They do not create runtime roles, force a framework change or prove production deployment. For official brief paths and local report filenames, use the [source register](PROJECT_CONTEXT.md#source-register). The academic PDFs are excluded from the public repository.
