# ReFind 0.2.5 — QA fixes

## Current release v0.2.5 / folder ReFind_0.2.3

v0.2.5 fixes all 49 findings of the full QA pass (15 bugs, 10 flows, 9 redundancies, 15 copy issues) in four tiers. Highlights: no self-matches and a stricter match score; one active claim per Lost report; withdraw a claim; rejection is final; only active claims lock reports; a configurable Building Management pickup desk plus claimant contact for BM; "I found this item"; a `release` pickup operation for no-shows; History as the closed-report archive; quieter notifications with mark-all-read; confirmation only for final BM decisions; plain-language copy and the 0.2.5 label. No database change. Details, tests and gaps: [v0.2.5 report](docs/V025_REPORT.md). Repository: `https://github.com/fahrezimahifa-ui/ReFind-v0.2.5`.

Pickup desk text comes from `pickup_desk_name`, `pickup_desk_location`, `pickup_desk_hours` and `pickup_desk_contact` in `app/config.php` (override them in `app/config.local.php`). To recompute stored suggestions in an existing demo with the new rules, back up first and run `C:\xampp\php\php.exe tools/refresh-matches.php --dry-run`, then without `--dry-run`.

Tests: `python tools/prepare-test.py`, then `node tools/test-v025.cjs` and the regression suites with `REFIND_EVIDENCE_BATCH=v025` (`test-auth`, `test-account`, `test-student`, `test-workflow`), `node tools/test-ux.cjs --v025` and `node tools/smoke-auth.cjs --v025`. Evidence goes to `docs/verification/v025/`.

## Previous local UX02 / folder ReFind_0.2.3

Local-only edition: `C:\xampp\htdocs\ReFind_0.2.3`, login `http://localhost/ReFind_0.2.3/login.html`, docs `http://localhost/ReFind_0.2.3/docs/`. Nine underlined UI navigation labels now have outline-button affordance; own report Edit/Delete use navy/red outlines.15 UX groups and24/24/27 Student/account/BM regressions pass. [UX02 report](docs/UX02_REPORT.md) contains current evidence.

The directory name is the user's version label only. Existing app labels/DB `refind_db_0_2_0`/credentials/data retain their0.2.0 identity. Ignored `app/config.local.php` sets `base_path` to `/ReFind_0.2.3/`; preserve this local override if copying the renamed folder. QA remains the owned `ReFind_0.2.0_Test` copy with updated source marker. This patch is not pushed or packaged into a new ZIP; GitHub/B06/UX01 paragraphs below describe previous checkpoints.

**Status B06: Verified — seluruh enam batch selesai.** Fitur auth/account/Student/BM dan full Lost → Returned sudah teruji. Final artefak draw.io, 40 synthetic reports/12 claims/6 handovers, fresh-install acceptance dan clean release ZIP tersedia. [Laporan B06](docs/B06_REPORT.md) memuat hasil nyata; [installation & release guide](docs/INSTALLATION_AND_RELEASE.md) memuat setup lengkap, termasuk mock seed.

**Latest update UX01:** synced BM selection, focused mobile detail/Back, identified confirmations, single-primary/danger hierarchy, Returned timestamps, direct pickup notifications, human-readable private history, improved contrast and optional/custom uploads.12 UX groups and auth/account/Student/BM28/24/24/27 regressions PASS. [UX01 report](docs/UX01_REPORT.md) records current evidence and physical-device keyboard manual check.

ReFind adalah Lost & Found kampus UMN dengan target **mobile-first**, top navbar, discovery cards, dan dua aktor: **Student** dan **Building Management (BM)**. Frontend memakai HTML/CSS/JavaScript, jQuery, dan Bootstrap lokal; backend memakai PHP prosedural + mysqli + MariaDB/XAMPP.

## Keputusan pengguna

1. PHP + MySQL diperbolehkan. MariaDB tersedia di `127.0.0.1:3306`.
2. Bangun **aplikasi baru**, folder baru, dan database baru. Source 0.1.0 menjadi referensi aturan bisnis.
3. Pembatalan handover membatalkan **jadwal pickup**, mempertahankan ownership approved, dan dapat dijadwalkan ulang.
4. Kerjakan **per batch**. B01 blueprint, B02 database/auth, B03 profile/settings/shell, B04 Student, B05 BM workflows, B06 verification/release telah disetujui dan selesai.
5. Semua diagram memakai **draw.io / diagrams.net**: sitemap, ERD, FC01–FC06, user flow/app flow; editable sources dengan PDF/PNG exports. Wireframe boards juga memiliki editable `.drawio` components.
6. B06 memperbanyak mock data untuk demo, melalui workflow valid dan seeding idempotent.
7. UX02 converts standalone underlined links to outline-button anchors, aligns Edit/Delete, renames only the local main folder to ReFind_0.2.3, and has no GitHub push/new ZIP.
8. v0.2.5 pickup contact: a configurable BM desk for students and claimant email/student ID for BM.
9. v0.2.5 claim rules: students can withdraw a claim under review; a rejected claim is final; only active claims lock reports.
10. v0.2.5 History is the archive of closed reports and appears in the Student navigation; Explore shows active reports by default.
11. v0.2.5 visible version label; DB names, folder and config defaults unchanged. Published to the ReFind-v0.2.5 repository.

Folder: `C:\xampp\htdocs\ReFind_0.2.0`. Database: `refind_db_0_2_0`. Database test: `refind_db_0_2_0_test`.

## Jalankan aplikasi

Pada mesin baru, clone ke nama folder yang sesuai dengan default `base_path`, lalu jalankan langkah setup di bawah:

```powershell
git clone "https://github.com/fahrezimahifa-ui/ReFind-v0.2.0.git" "C:\xampp\htdocs\ReFind_0.2.0"
```

Repository berisi source, SQL/reference seed, licensed demo inputs, draw.io sources/exports dan academic evidence. Runtime credentials/uploads/config/backups serta generated release ZIP tidak di-versioning; setup membuat credential dan media lokal. `.gitattributes` mempertahankan bytes SQL/vendor yang diverifikasi dengan SHA-256.

**[http://localhost/ReFind_0.2.0/login.html](http://localhost/ReFind_0.2.0/login.html)** — credential login. Student menuju Home; BM menuju Review Queue. Logout di navbar berfungsi.

Setelah login, buka **Account → My profile / Account settings**. URL: `profile.html` dan `settings.html`. Nama disimpan ke DB; password change meminta current/new/confirmation, merotasi ID/CSRF session current dan menginvalidasi sessions lain. Mobile navigation membuka menu di bawah header, bukan sidebar.

1. Copy folder lengkap ke `C:\xampp\htdocs\ReFind_0.2.0`.
2. Start Apache + MySQL XAMPP, port DB 3306. PHP 8.2 dengan mysqli/mysqlnd, mbstring, fileinfo, session diperlukan.
3. Bila koneksi berbeda, `app/config.local.php` dapat mengoverride keys di `app/config.php`; file lokal di-Git-ignore dan diblokir HTTP. B02 hanya menerima nama DB 0.2.0/main atau `_test` agar tidak mengarah ke DB versi lain.
4. Dari folder proyek:

```powershell
& "C:\xampp\php\php.exe" "tools/setup-db.php"
& "C:\xampp\php\php.exe" "tools/setup-demo.php"
& "C:\xampp\php\php.exe" "tools/seed-student-demo.php"
& "C:\xampp\php\php.exe" "tools/seed-expanded-demo.php"
& "C:\xampp\php\php.exe" "tools/check-database.php"
& "C:\xampp\php\php.exe" "tools/check-workflow.php"
```

5. Lihat [akun demo](docs/DEMO_ACCOUNTS.md). Password random ada dalam file privat lokal `storage/setup/demo-accounts.json`; bukan dalam SQL atau README publik.

Setup non-destructive dan idempotent. Existing nonempty DB tanpa receipt proyek ditolak. Reference seed berisi kategori/lokasi/status, tanpa report/claim data atau password baseline. [Database guide](database/README.md) menjelaskan setup dan rollback/backup.

## Route dan scope current

Student: **Explore** (`browse.html`) → search/type/category/location/status/date → public detail (`item.html?id=...`) → explicit claim (`claim.html?id=...`). Similarity /100 adalah suggestion, bukan ownership probability atau approval. **My Activity** (`my-reports.html`) menampilkan own reports/claims, eligible edit/delete, private review note, same-ID resubmit dengan selected retained evidence, dan authorized pickup status. **Notifications** (`notifications.html`) menyimpan read state sebelum navigasi; **History** (`history.html`) read-only.

**Report** (`report.html?type=lost/found`): public photos max 4; required private clue; optional Lost ownership max 2. JPEG/PNG/WebP input up to 10 MB diprepare client ke ≤1200px / ≤250 KB dan divalidasi PHP independen. Supporting photos BM-only. Unknown time tetap NULL; display Asia/Jakarta.

**BM Review Queue** (`admin.html?tab=claims`): pilih claim, bandingkan claimant answer dengan finder clue/private evidence, lalu approve/reject/request-more-info dengan note dan confirmation. Tab **Reports** (`?tab=reports`) menyediakan eligible status/archive/recovered-Lost actions. Tab **Handover** (`?tab=handover`) menyediakan schedule/reschedule/cancel schedule/complete, private before/after audit dan exact read-only outcomes. Cancel schedule mempertahankan claim APPROVED dan item HANDOVER; completion mengembalikan related pair menjadi Returned.

- URL `.html` dilayani melalui `page.php` dan server guard; templates actual di `app/pages/` yang tidak dapat dibuka langsung lewat HTTP.
- Seluruh 12 routes aktif dengan server role guard, termasuk ketiga tab BM. Wrong role **403**, unauthenticated API **401**.
- Account POST `update_profile` / `change_password` benar-benar berfungsi. Email/NIM/role readonly; identitas hanya dari session.
- Student nav: Home/Explore/Report/My Activity/Notifications; BM: Review Queue/Handover/Explore/History/Notifications. Account menu: Profile/Settings/Logout. Tablet/mobile collapses below the top header, never a primary sidebar.
- Report/claim/BM writes memakai transaksi/ownership/CSRF. BM operations memerlukan explicit confirmation dan fresh revision; stale/concurrent changes memberi **409**, tanpa automatic POST replay.
- Private config, SQL, storage, tools dan dotfiles diblokir direct HTTP. Public media harus melewati photo endpoint.

## Baca dari sini

**Browser-friendly overview:** [docs/index.html](docs/index.html). Jika Apache tersedia: `http://localhost/ReFind_0.2.0/docs/`.

| File | Isi |
|---|---|
| [docs/B01_BLUEPRINT.md](docs/B01_BLUEPRINT.md) | Scope, traceability R01–R12, arsitektur, dependensi, batch dan gate |
| [docs/ROLE_ROUTE_MATRIX.md](docs/ROLE_ROUTE_MATRIX.md) | Halaman, role, API, ownership, auth/session |
| [docs/WORKFLOW_CONTRACT.md](docs/WORKFLOW_CONTRACT.md) | State machine, matching, claim, evidence, handover, transaksi |
| [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) | 14 tabel, PK/FK, nullability, unique, 25 relasi |
| [docs/ACCEPTANCE_TESTS.md](docs/ACCEPTANCE_TESTS.md) | Acceptance matrix dan hasil B02–B06/UX01, termasuk fresh-install verification |
| [docs/SOURCES_AND_DECISIONS.md](docs/SOURCES_AND_DECISIONS.md) | Sumber, persetujuan scope, temuan audit, keputusan |
| [docs/diagrams/README.md](docs/diagrams/README.md) | Sitemap, ERD, FC01–FC06, editable sources dan exports |
| [docs/wireframes/index.html](docs/wireframes/index.html) | Delapan board wireframe statis; bukan aplikasi yang berfungsi |
| [docs/B01_REPORT.md](docs/B01_REPORT.md) | Hasil pemeriksaan B01 yang benar-benar dijalankan |
| [docs/B02_REPORT.md](docs/B02_REPORT.md) | Scope, hasil auth/schema tests, gaps dan path B02 |
| [docs/DEMO_ACCOUNTS.md](docs/DEMO_ACCOUNTS.md) | Akun demo dan lokasi credential privat |
| [docs/B03_REPORT.md](docs/B03_REPORT.md) | Hasil profile/password/navbar tests, file changes dan gaps B03 |
| [docs/B04_REPORT.md](docs/B04_REPORT.md) | Hasil Student E2E, upload/privacy/concurrency, gaps dan paths |
| [docs/B05_REPORT.md](docs/B05_REPORT.md) | Hasil BM/full lifecycle, atomic approval/return, pickup audit dan paths |
| [docs/B06_REPORT.md](docs/B06_REPORT.md) | Final artefak, expanded mock dataset, regression/fresh install dan release |
| [docs/UX01_REPORT.md](docs/UX01_REPORT.md) | Approved audit fixes, contrast/focus/navigation and current release checkpoint |
| [docs/INSTALLATION_AND_RELEASE.md](docs/INSTALLATION_AND_RELEASE.md) | Clean XAMPP setup, package contents dan checksum/fresh-install verification |
| [docs/DEMO_SCRIPT_5_MIN.md](docs/DEMO_SCRIPT_5_MIN.md) | Naskah presentasi lima menit + actual Student/BM workflow clips |

Final sitemap/ERD/FC01–FC06/UF01/AF01 berlabel **As-built / B06**, direkonsiliasi terhadap actual SQL/routes/functions. Paket berisi **11 diagram /13 sheets**, editable `.drawio` dan individual/combined PNG/PDF/SVG exports. **8 conceptual wireframe boards** tetap design references; individual editable components ada di `docs/wireframes/sources/`. Actual screenshots/recordings ada di `docs/verification/b06/`. Schema tetap14 tables/2 views/25 FK tanpa migration B03–B06.

## Pengujian auth

```powershell
python "tools/prepare-test.py"
node "tools/test-auth.cjs"
node "tools/smoke-auth.cjs"
```

Test copy: `C:\xampp\htdocs\ReFind_0.2.0_Test`, URL `http://localhost/ReFind_0.2.0_Test/`, database `refind_db_0_2_0_test`. Runtime config, secret, sessions dan credentials terpisah. Mutasi fixtures hanya di `_test`; main smoke hanya positive login/logout/read checks. Hasil berada di `docs/verification/b02/`.

Node/Playwright/Chrome hanya diperlukan untuk QA, bukan runtime app. Override module/browser melalui `REFIND_PLAYWRIGHT_MODULE` / `REFIND_CHROME`.

## Pengujian Profile/Settings B03

```powershell
python "tools/prepare-test.py"
node "tools/test-account.cjs"
node "tools/test-auth.cjs"
node "tools/smoke-auth.cjs" --b03
```

Suite B03 membuat fresh QA accounts/records di `_test` dan membersihkannya berdasarkan ID; akun main tidak diubah. Bukti di `docs/verification/b03/`. Private initial demo password receipt **tidak diperbarui saat password diubah**; gunakan new password pilihan Anda. Re-run setup tidak mereset existing passwords.

## Classroom demo/media B04

Main B06 memiliki **40 synthetic classroom reports** (20 Lost/20 Found), **12 claims**, **6 handovers**, **40 public photos**, **20 Lost evidence photos**, **12 claim proof photos**, **176 notifications** dan **133 status-history events** pada checkpoint seed awal. Semua tujuh report states, empat claim states dan tiga pickup states tersedia. Tiga contoh B04 tetap terpelihara. [Photo attribution](PHOTO_CREDITS.md) mencatat source/crop/license; seeding idempotent mempertahankan edited/deleted bookmarks. Operational returns merupakan simulasi synthetic melalui workflow nyata.

```powershell
& "C:\xampp\php\php.exe" "tools/seed-student-demo.php"
& "C:\xampp\php\php.exe" "tools/seed-expanded-demo.php"
& "C:\xampp\php\php.exe" "tools/check-workflow.php"
```

Stock inputs di protected `tools/demo-photos/`, bookmarks di private setup storage. File runtime generated terpisah public/private collections.

## Pengujian Student B04

```powershell
python "tools/prepare-test.py"
node "tools/test-student.cjs"
node "tools/test-auth.cjs"
node "tools/test-account.cjs"
node "tools/smoke-auth.cjs" --b04
```

Run suites as separate commands to avoid long process timeouts. Mutation tests use fresh `_test` accounts/records, exact-ID cleanup and CLI-only controlled rollback triggers. Main smoke is read-only with respect to business records. Evidence: `docs/verification/b04/`.

## Pengujian BM & full lifecycle B05

```powershell
python "tools/prepare-test.py"
node "tools/test-workflow.cjs"
node "tools/test-student.cjs"
node "tools/test-auth.cjs"
node "tools/test-account.cjs"
node "tools/smoke-auth.cjs" --b05
& "C:\xampp\php\php.exe" "tools/check-workflow.php"
& "C:\xampp\php\php.exe" "C:\xampp\htdocs\ReFind_0.2.0_Test\tools\check-workflow.php"
```

Jalankan setiap perintah secara terpisah. Latest executed suites: **27 B05**, **24 Student**, **28 auth**, **24 account** scenario groups PASS; ketiga tab BM/dialogs diuji pada lima viewport wajib. Workflow checker: **17 invariants PASS** pada main/test. Schema checker: **9 checks PASS** per DB. Main smoke tidak mengubah business dataset. Bukti: [workflow-results.json](docs/verification/b05/workflow-results.json), [main-smoke.json](docs/verification/b05/main-smoke.json), actual screenshots di `docs/verification/b05/`.

CLI-only `_test` failpoints memverifikasi rollback approval dan completion; race tests memverifikasi satu approval/pair/handover serta stale completion/reschedule ditolak409. Bukti private review/pickup tetap hanya untuk pihak authorized; public timeline berisi generic events.

### Blueprint export regeneration

Tool dokumentasi membutuhkan Python 3, Graphviz, Node, Playwright Core, dan Chrome; kebutuhan ini **bukan dependency runtime aplikasi**.

```powershell
python "tools/build-blueprint.py"
node "tools/render-blueprint.cjs"
python "tools/verify-blueprint.py"
```

Renderer menerima `REFIND_PLAYWRIGHT_MODULE` dan `REFIND_CHROME`. Builder menerima `REFIND_DOT`. Default memakai instalasi lokal yang diverifikasi untuk batch ini; detail di README diagram. `docs/verification/b01-results.json` adalah hasil pemeriksaan dokumen/desain, bukan hasil E2E aplikasi.

## B06 final verification & delivery

Executed evidence: auth28/account24/Student24/BM27 regression groups, seed7 groups, fresh-install13 actual browser groups,81 artifact checks,9 schema checks dan17 invariants per database. Final PHP33/JS-CJS17/Python9 syntax sources pass. Required five viewports are exercised; main smoke preserves the expanded dataset.

Latest release: `releases/ReFind_0.2.0_UX01.zip`; historical B06 ZIP retained. Adjacent `.manifest.json` and `.verification.json` record exact archive/runtime hashes and fresh acceptance. App/SQL/local assets/setup/demo inputs and academic artefacts/evidence are included; destination setup generates its own credentials/media.

```powershell
node "tools/test-demo-seed.cjs"
node "tools/smoke-auth.cjs" --b06
python "tools/build-release.py" --batch UX01
python "tools/verify-fresh-install.py" --batch UX01
```

Development QA requires the owned test copy and Node/Python tooling. Fresh QA uses a new extracted folder and isolated MariaDB3307 datadir; the existing3306 schemas remain intact, and the temporary server is stopped afterwards. Actual screen-only clips: `docs/verification/b06/DEMO_STUDENT_WORKFLOW.webm` and `DEMO_BM_WORKFLOW.webm`. All six planned batches are complete; use the final SOP for acceptance review/demo.
