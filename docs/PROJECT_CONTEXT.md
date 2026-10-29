# ReFind: product context and research

Compiled on 27 October 2026 from the v0.2.5 workspace and the WDD/UX reports listed in the [source register](#source-register). Source baseline reviewed: Git commit `857acea` (13 October 2026). The research reports describe both an existing prototype and proposals for its next iteration.

## 1. One product, two classes

**ReFind is a UMN campus Lost & Found web application connecting reports, discovery, ownership verification, and the physical return of belongings.** The same product supports two academic streams:

| Stream | Contribution | Main report |
|---|---|---|
| IS556 Web Design and Development, Group 5 | Requirements, storyboards, wireframes, sitemap/flows, interface implementation, multimedia and relational data design | **WDD** |
| IS301 User Experience, Group 3 | Student/staff research, As-Is/To-Be analysis, personas, needs, design reasoning and evaluation planning | **UX8** |
| Individual IS301 analysis | An individually attributed analysis of the shared research and product, including more explicit evidence-to-design mapping | **UX-I** |

These are complementary accounts of one project. The individual analysis reuses the group's research; it is not a second independent survey. [UX8 pp.24–27, 46–48; UX-I p.8]

### Artifact identities matter

| Artifact | What it is | How to interpret it |
|---|---|---|
| This workspace, `ReFind_0.2.3` | ReFind **v0.2.5**, with a PHP backend, server sessions and MariaDB persistence | Current development implementation |
| `ReFind-Template-v0.2.5.zip` in the WDD materials | A serverless HTML/CSS/JavaScript submission template with simulated APIs/localStorage | A separate, deliberately frontend-only academic artifact |
| Reports, wireframes, mockups and recorded demonstrations | Research, design intent and checkpoint evidence | Check their date, artifact and claimed verification scope |

The WDD lab brief's serverless-demo requirement explains the template. The submission's `BACA-DULU.txt` explicitly distinguishes that template from the PHP ZIP. Statements such as “PHP/MariaDB is future work” or “open index.html directly” describe that submission narrative, not this application's runtime. The individual UX report also contains a dated frontend/backend boundary. [WDD pp.9–10, 52–56; UX-I p.34]

For current behavior, inspect code/schema/configuration and the [v0.2.5 report](V025_REPORT.md). For user needs and design rationale, consult the reports. For coursework packaging, consult the relevant official brief. A proposed improvement is not automatically an approved implementation task.

## 2. The problem ReFind addresses

The campus already has a Lost & Found procedure. The key problem is that information is scattered or unavailable: students may not know where to start, unsuccessful searches leave no persistent trace, and they cannot readily see an item's status or physical whereabouts. ReFind should connect those gaps while preserving staff custody and judgment. [WDD pp.8–10, 14–16; UX8 pp.21–27, 42–43]

### Existing campus procedure, as reported in Week 8

One BM respondent describes this process:

1. Found items enter through **security**, which records item name, discovery place and date in a physical logbook.
2. After approximately one week at security, items can move to BM storage.
3. Identifiable belongings may involve **Student Service** to help identify/contact their owner.
4. Collection involves descriptive questions, KTM/student identification and a signature.
5. Inquiries about items that are not present are not recorded.
6. Uncollected items are displayed around UTS/UAS; subsequent handling distinguishes valuables and unusable belongings.

This is a single staff account of operations, not an approved software policy. “Approximately one week” does not authorize automatic day-seven transfers. Closing an item as Never retrieved does not authorize disposal. [UX8 pp.21–24, 42, 49–50]

Week 8 incorporates a BM response received on 16 October 2026. Week 7's “awaiting BM confirmation” statements are historical. The code baseline predates this new operational evidence; it does not already model every real-world actor and custody event.

## 3. Research evidence and its limits

### Method

- Collection window: **26 September–7 October 2026**.
- **85** survey responses received; **11** after the cutoff excluded; **74** included.
- Convenience sample from classes A–D, with descriptive statistics, cross-tabulations and grouped open suggestions.
- Branches: **50** respondents with loss experience, **34** with finding experience, and **64** with either. These overlap and must not be added as separate populations.
- Staff evidence: **one BM respondent**, providing **14 written answers**.
- The individual report reanalyses this shared evidence. Student interviews, direct security/Student Service interviews, observation and user usability testing remained planned.

Sources: WDD p.17 and Appendix B p.72; UX8 pp.28–35, 50–51; UX-I pp.8, 36, 53.

### Findings that should guide design

| Finding | Interpretation for ReFind | Source |
|---|---|---|
| 30/50 owners did not know where to report; only 9/50 first approached security/BM | Make the official entry route and next action easy to understand | UX8 pp.36–37 |
| Information-finding ease averaged 2.58/5 among 50 owners; process clarity also averaged 2.58/5 among 64 experienced respondents | Prioritize discoverability and understandable progress | UX8 p.39 |
| 16/50 owners reported unknown status; 20/64 did not know storage location; 19/64 cited stale information | Distinguish report status, physical custody/location and information freshness | UX8 pp.37, 41, 43, 46 |
| 17/34 finders did not hand belongings to staff; 10 of 23 who knew the official route still used other channels | Explore effort, trust and motivation; more instructions alone may be insufficient | UX8 pp.38–39, 43 |
| 13/34 finders struggled to identify the rightful owner; 12/64 lacked proof of ownership | Guide verification without turning a suggestion into ownership approval | UX8 pp.23, 38, 43, 46 |
| BM says Lost & Found is not its primary job; unsuccessful inquiries are not recorded | Retain lost reports for later matching and minimize staff entry burden | UX8 p.42 |
| Photos 45/74, search 40/74, campus identity verification 32/74, matching notifications 31/74 | Inputs to prioritization, not an automatically ordered feature backlog | UX8 p.40; UX-I p.38 |
| 71/74 expressed willingness to use ReFind | Stated interest, not measured adoption | WDD p.9; UX8 p.40 |

The sample is not campus-representative. Self-report, recall, small cells and no survey pilot constrain certainty. Finder motives and some persona emotions are inferred. The reports' descriptive “hypothesis proven” language is not inferential statistical proof or preregistered validation. [UX8 pp.28–35, 50–51; UX-I pp.21, 36, 40, 53]

## 4. People, jobs and current roles

Persona names are fictional. [UX8 pp.32–34; UX-I pp.44–45]

| Persona/stakeholder | Main job or concern | Current application representation |
|---|---|---|
| Nadia, student owner | Know where to start, preserve a lost report, find candidates, prove ownership and see progress | `STUDENT` using Lost reports, Explore, claims and My Activity |
| Bima, student finder | Report and hand over belongings with little effort and confidence in rightful return | `STUDENT` using Found reports; physical custody is not separately tracked |
| Pak Rudi, BM operator | Verify and return belongings through a familiar procedure with little extra workload | `BUILDING_MANAGEMENT`, Review Queue and Handover |
| Security | Intake, physical logbook and initial custody | Operational stakeholder; no separate auth role |
| Student Service | Assist with identifiable belongings and contacting an owner | Operational stakeholder; no separate auth role or integration |

Owner and finder are contexts within the same Student role. Campus SSO is a proposal; demo email/password login does not independently verify real campus membership.

## 5. Core product journey

The current owner journey identified in research is: notice loss, search independently, report/post, wait, then claim and collect. ReFind's intended improvement is a persistent, connected journey: [UX8 p.41; UX-I p.40]

1. **Report:** a student records Lost or Found details. A digital Found report does not itself prove that staff received the physical item.
2. **Discover:** search/filter and compare details. Existing rule-based suggestions help identify candidates.
3. **Claim:** submit identifying details, optionally connect an own Lost report, and optionally provide private evidence.
4. **Verify:** BM compares the claim with private clues/evidence and approves, requests more information, or rejects it.
5. **Arrange pickup:** approval creates an active handover; scheduling, rescheduling and schedule cancellation are distinct operations.
6. **Return:** BM confirms physical return. Completed reports enter History.
7. **Handle exceptions:** information can be supplemented; undecided claims withdrawn; pickup released; independently recovered Lost reports closed; eligible unresolved reports archived.

The [workflow contract](WORKFLOW_CONTRACT.md) defines exact implemented eligibility and transitions. Match score is rule-based similarity out of 100, not probability, validated accuracy, or AI ownership verification. Approval/Ready for pickup is not Returned. [WDD pp.40–43, 55–56; UX8 pp.25, 48; UX-I pp.25–28]

## 6. Design principles and scope

### Principles supported by research and current product decisions

- Make “I lost something” and “I found something” clear entry points.
- Connect search, persistent reports, My Activity and next actions.
- Use familiar campus areas and plain, consistent status language.
- Guide identifying answers and minimize unnecessary form entry.
- Separate discoverable report content from private clues, claim evidence and contact/pickup information.
- Keep BM review and return operations distinct, with exact record context and clear feedback.
- Treat staff workload and the physical procedure as design constraints.

Sources: UX8 pp.46–48; UX-I pp.48–50; WDD pp.22–24, 51, 64–65.

The mobile-first top-navbar, photo-led discovery cards, touch-target guidance and current English UI labels are implementation/design decisions documented in [B01_BLUEPRINT.md](B01_BLUEPRINT.md), [SOURCES_AND_DECISIONS.md](SOURCES_AND_DECISIONS.md), and v0.2.5 code. Research does not establish a validated brand palette or typography system. Do not derive application design tokens from report-diagram colors.

### Scope and future work

The current MVP supports reports, discovery, suggestions, private claims, manual BM review, pickup, notifications, history and account settings. The [requirements/roadmap](REQUIREMENTS_AND_ROADMAP.md) records proposed custody tracking, service guidance, campus authentication and retention information separately.

Paid shipping/logistics and theft investigation are outside the reported scope; theft concerns route to security. Direct owner–finder chat, geolocation and automatic ownership decisions are not approved features merely because the reports discuss alternatives. SDG 11 is conceptual alignment, not a measured outcome. [WDD pp.10, 23–24; UX8 pp.9–10, 47–49; UX-I pp.19, 27–28, 33, 48–50]

## 7. What has and has not been evaluated

- Existing code QA: [V025_REPORT.md](V025_REPORT.md) records automated API/browser suites, a manual re-test and main-data restoration. These are historical engineering results, not newly executed tests for this context pack.
- WDD's reported 34 `file://` scenarios and accessibility spot-check describe the **serverless template**, not the PHP deployment or a full WCAG audit. [WDD p.66]
- User-task evaluations and SUS in the UX reports are **planned**. The detailed test tables propose SUS **at least 80**; a neighboring passage mentions comparator score **86.5**, which needs reconciliation. No ReFind SUS result is reported. [UX8 p.49; UX-I p.50]
- Planned tasks include found-report completion within 60 seconds, owner search/claim/status tasks with at least 90% success, security intake within 30 seconds/item, and BM review/handover without assistance. Sample sizes are small; 90% participant success with five users means all five succeed. [UX8 p.49; UX-I p.50]
- The reported 26/50 recovered belongings is a pre-ReFind self-reported baseline, not an app success rate. Adoption, matching accuracy and return-rate improvement have not been demonstrated by these reports.

## Source register

**Citation convention:** WDD, UX8 and UX-I page numbers above and in [REQUIREMENTS_AND_ROADMAP.md](REQUIREMENTS_AND_ROADMAP.md) are **1-based PDF viewer pages**, including the cover. Their printed footer numbers can differ. Local PDF copies retain their original bytes; the editable DOCX versions remain in the original course folders. The academic PDFs are ignored local resources and are not included in the public GitHub repository.

| Key | Local reference (relative to the project root) | Use |
|---|---|---|
| **WDD** | ReFind IS556 report: `docs/references/ReFind_IS556_Laporan_UTS_Kelompok5.pdf` | Product requirements, academic template, design and implementation narrative |
| **UX8** | IS301 Week 8 group report: `docs/references/IS301_Laporan_ReFind_Kelompok3_Week8.pdf` | Latest group research, BM response, K-01–K-11 needs and evaluation plan |
| **UX-I** | IS301 individual analysis: `docs/references/00000147909_IS301_C-EN_MidTerm.pdf` | Shared-data attribution, detailed evidence-to-design mapping and proposals |

Original source locations on this device:

```text
WDD:
C:\Users\LENOVO\Downloads\UTS Sems 3\WDD\ReFind_UTS_IS556_Kelompok5_Submission\ReFind_IS556_Laporan_UTS_Kelompok5.pdf

UX8:
C:\Users\LENOVO\Downloads\UTS Sems 3\UX\UX Report (Week 8)\IS301_Laporan_ReFind_Kelompok3_Week8.pdf

UX-I:
C:\Users\LENOVO\Downloads\UTS Sems 3\UX\UTS Individu\00000147909_IS301_C-EN_MidTerm.pdf
```

Other source roles:

- `WDD\ReFind_UTS_IS556_Kelompok5_Submission\BACA-DULU.txt`: team packaging instructions; distinguishes serverless submission/PHP backup and warns about older video branding.
- `WDD\Midterm Exam-IS556-Web Design and Development (Lab)-Odd2026-2027 [Approved].pdf`, pp.1–3: formal lab brief, including the frontend-only midterm demonstration.
- `WDD\Midterm Exam-IS556-Web Design and Development (Lec)-Odd2026-2027 [Approved].pdf`, pp.1–3: formal theory brief for design/report/database-concept deliverables and presentation.
- `UX\Midterm Exam-IS301-User Experience-Odd2026-2027 [Approved].pdf`, pp.1–4: formal individual research/analysis brief. Academic requirements are not application features.
- `UX\UX Report (Milestone 2 Week 7)\`: historical milestone before the BM response. `_arsip` files are historical revisions.

The WDD/UX prefixes in the last list are relative to `C:\Users\LENOVO\Downloads\UTS Sems 3`. The three primary report PDFs remain available locally in `docs/references`; cloning the repository does not include them.
