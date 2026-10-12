# Sumber dan keputusan — B01–B06

**Status current:** seluruh enam approved batches implemented/verified, termasuk final draw.io artefacts, expanded mock dataset dan fresh-install release B06. Blueprint awal dibuat10 Oktober2026. Checkpoint per batch di bawah menjaga riwayat keputusan dan scope verifikasi.

## Sumber utama

- Panduan lengkap: `C:\Users\LENOVO\Downloads\REFIND_OPENCODE_PROJECT_GUIDE_v2 (1).md`.
- Baseline ZIP: `C:\Users\LENOVO\Downloads\ReFind_Version 0.1.0.zip`.
- Dalam ZIP: root README, `ReFind_New/README.md`, schema SQL, sembilan HTML, CSS, dua shared JS, semua API, session, upload protections, CLI setup/invariant tools, test harness dan hasil historis.
- SHA-256 SQL baseline: `8b2fe2c560b524c4e8710280c1a7222551f0e52ee047f0201e7993b09f0ae289`.

Prioritas requirement: instruksi pengguna terbaru > revisi dosen eksplisit > guide v2 > konvensi baseline.

## Decision log

| ID | Keputusan | Sumber / akibat |
|---|---|---|
| D01 | Mobile-first; desktop usable | Guide v2, R01; viewport 360/390/768/1280/1440 |
| D02 | Discovery cards + top navbar untuk semua role | Guide v2, R02/R03/R11 |
| D03 | PHP + MySQL diperbolehkan | Jawaban pengguna; frontend tetap HTML/CSS/JS |
| D04 | Aplikasi baru dan database baru | Jawaban pengguna; override scope revisi-in-place pada guide |
| D05 | Handover batal = batal jadwal, ownership tetap | Pengguna memilih rekomendasi; SCHEDULED → PENDING |
| D06 | Kerja per batch, approval gate sebelum pelaksanaan | Instruksi pengguna; B01–B06 telah disetujui dan dijalankan |
| D07 | Nama target ReFind 0.2.0 | Penamaan rencana yang disetujui untuk pelaksanaan batch |
| D08 | Landing/Login publik; workflow memerlukan login | Default blueprint; shared Explore/detail tersedia bagi Student/BM |
| D09 | 14 tabel + 2 views sebagai acuan; profil di users | Reuse model SQL, bukan membuat relasi user_profiles fiktif |
| D10 | MVP akun demo A/B/BM, email/NIM readonly | Guide auth MVP; setup credential CLI dan hashing |
| D11 | Pembatalan jadwal dicatat, notif tersimpan | Guide audit trail; history publik generik, rincian hanya pihak authorized |
| D12 | Semua diagram final memakai draw.io/diagrams.net | Instruksi pengguna sebelum B06; editable `.drawio` untuk sitemap, ERD, flowcharts, user/app flow dan artefak diagram terkait, dengan PDF/PNG exports |
| D13 | Perbanyak mock data pada B06 | Instruksi pengguna dan approval B06; target 40 laporan total, 12 claims dan 6 handovers synthetic, melalui valid business workflow dan seeding idempotent |
| D14 | Implementasikan fixes dari audit UI/UX setelah B06 | Pengguna menyetujui selection/navigation, Returned clarity, button hierarchy, colour/contrast, upload/microcopy polish; tetap memakai stack dan draw.io yang disetujui |
| D15 | UX02 outline navigation + Edit/Delete pairing | User approved9 standalone labels as button-styled native anchors; Delete uses danger outline and existing confirmation |
| D17 | v0.2.5 pickup contact | QA finding A01; user chose a configurable BM desk for students and claimant email/student ID for BM, without schema change |
| D18 | v0.2.5 claim rules | QA findings A03/A04/F03; user chose withdraw for claims under review, final rejection, and locks only from active claims |
| D19 | v0.2.5 History archive | QA finding R01; user chose History = Returned/Never retrieved archive in the Student nav, Explore active by default |
| D20 | v0.2.5 version label and publication | User chose visible label 0.2.5 with unchanged DB names/folder/config defaults; push to ReFind-v0.2.5 after all checks pass |
| D16 | Rename local folder only / no publication or ZIP | User requested ReFind_0.2.3 directory label; main base-path override only, existing DB/app identity/data retained, no commit/push/new ZIP |

## Audit baseline R01–R12

| ID | Kondisi baseline terhadap target |
|---|---|
| R01 | Missing: desktop-first dan min-width 1100px |
| R02 | Partial: cards ada; Browse masih master-detail dashboard |
| R03 | Missing: navigasi utama sidebar; utility topbar bukan top nav |
| R04 | Missing artefak ERD dalam ZIP; SQL relasional tersedia |
| R05 | Missing artefak sitemap dalam ZIP |
| R06 | Missing artefak flowchart dalam ZIP |
| R07 | Missing artefak swimlane dalam ZIP |
| R08 | Partial: session/CSRF ada, credential login/logout belum |
| R09 | Missing: profile/settings page/API; users fields mendukung |
| R10 | Partial: guards/ownership ada, session privilege masih selectable |
| R11 | Partial: validation/feedback ada; mobile layout belum |
| R12 | Partial: transaksi/workflows/tests kuat, cabang dan dokumentasi belum lengkap |

## Temuan source yang menjadi input desain

1. `api/bootstrap.php` memakai session `account` dengan default Student. `api/session.php` POST dapat memilih BM. Target autentikasi menggunakan `user_id` hasil credential check dan menutup mekanisme privilege switch.
2. `api/workflow.php` hanya menerima approve/reject. Enum NEED_MORE_INFO dan resubmit tersedia; aksi BM request-more-info perlu diimplementasikan.
3. Handover baseline dapat dibuat dan completed, tetapi scheduling UI/API belum lengkap.
4. Deep link klaim selesai dapat jatuh ke klaim aktif lain karena queue memilih ulang selected ID. Target harus membuka detail klaim yang tepat, termasuk read-only outcome.
5. SQL 7 Oktober menautkan 27 foto. ZIP memuat 30 foto aplikasi; tiga tambahan 8 Oktober belum terdaftar dalam dump. Seluruh 27 foto baseline dan bundle-nya cocok checksum. Seed baru menautkan hanya media demonstrasi terverifikasi.
6. Hasil 41 kelompok tes dalam ZIP adalah hasil historis. Belum ada klaim E2E v0.2.0.

## Lingkungan yang diperiksa read-only

- PHP CLI: 8.2.12.
- MariaDB: 10.4.32 pada 127.0.0.1:3306.
- Database `refind_db_0_2_0` belum ada saat pemeriksaan.
- Parent folder `C:\xampp\htdocs` tersedia; folder baru dibuat untuk artefak B01.
- Graphviz, Python/Pillow/PyMuPDF, Node, Playwright Core, dan Chrome tersedia untuk export/QA dokumen.

## Batas status B01

B01 menghasilkan dokumen, sumber diagram editable, exports, wireframes, dan QA artefak. Database, login, API, upload, session, dan workflow aplikasi masih **NOT IMPLEMENTED / NOT TESTED E2E**. Diagram aktual final akan direkonsiliasi terhadap SQL dan aplikasi setelah implementasi.

## Checkpoint B02

Pengguna menyetujui B02. Dua schema baru 0.2.0/main + `_test` telah dibuat dengan 14 tabel/2 views, reference seed dan tiga akun demo per DB. Auth/session/page/API guards telah diimplementasikan dan diuji pada app test. Dictionary/schema-contract sekarang membaca `database/schema.sql` actual, termasuk enum handover tiga states. Full workflow B03–B05 masih target. Detail dan output verifikasi ada pada B02_REPORT.md.

## Checkpoint B03

Pengguna menyetujui B03. Shared top navbar, own Profile/Settings, name persistence dan verified password change telah diimplementasikan; schema tetap 14 tabel/2 views tanpa migration. Password change menjaga current session dan membatalkan sessions lain; row lock/fingerprint check menangani concurrent requests. Navbar hanya menawarkan live pages, sementara target business navigation tetap pada B04/B05. FC01/FC06 behaviour kini didukung implementasi; exports blueprint tetap ditandai Target sampai final documentation reconciliation B06.

Saat awal B03, Apache/MySQL stopped. Kedua process XAMPP dinyalakan dengan konfigurasi existing (HTTP 80, DB 3306); tidak ada config repair/reseed. Verifikasi kemudian berhasil pada actual server.

## Checkpoint B04

Pengguna menyetujui Student workflows. Seven Student/shared pages and report/claim writes are implemented without schema migration. Matches are persisted suggestions; ownership decisions stay manual. Three synthetic/credited photo-backed examples were added non-destructively to the previously empty main report dataset, with private ID bookmarks. Auth/Profile/Settings regressions stay passing. BM request-more-info/approval/return actions remain B05; their state exceptions were tested only through isolated CLI fixtures. Detail: B04_REPORT.md.

## Checkpoint B05

Pengguna menyetujui BM Review & Transactional Handover. BM Claims/Reports/Handover tabs, private evidence review, approve/reject/request-more-info, operational status/archive/recovered Lost, schedule/reschedule/cancel_schedule/complete kini berfungsi melalui protected APIs dan actual browser UI. Tidak ada schema migration. D05 diuji: cancel hanya membatalkan jadwal, claim tetap APPROVED, item/pair HANDOVER, handover ID tetap sama dan bisa dijadwalkan ulang.

Full Lost → Found → Claim → actual BM Verification → Handover → Returned sudah diverifikasi end-to-end pada `_test`: 27 B05 groups PASS, termasuk real request-more-info/resubmit loop, stale revisions, competing/shared-Lost races, rollback approval/completion dan lima viewport wajib. Auth28/account24/Student24 regression tetap PASS. Main smoke ketiga akun dan tiga tab BM PASS tanpa perubahan business dataset. Schema tetap14 tables/2 views/25 FK, 9 live checks per DB dan17 workflow invariants PASS. Detail dan actual evidence: [B05_REPORT.md](B05_REPORT.md), `verification/b05/`.

Rincian pickup before/after/reason disimpan sebagai private claimant/BM notifications, sedangkan item history publik memakai generic events. Semua BM mutations membutuhkan CSRF, explicit confirmation dan fresh revision. Workflow serializes dengan matching advisory lock per DB dan numeric parent locking; stale/duplicate requests memberi409. Exact reviewed-claim deep link tidak berpindah ke record aktif lain.

Blueprint sources/exports masih berlabel Target / To-be sampai B06 merekonsiliasi final as-built diagrams dengan SQL/routes/UI actual. Fresh-install verification dan clean submission ZIP belum dijalankan/dibuat. Tidak ada approval B06 pada checkpoint ini.

## Checkpoint B06 (final)

Pengguna menyetujui B06 setelah menetapkan draw.io dan banyak mock data. Final11 diagram/13 sheets (Sitemap,2 ERD,FC01–FC06,UF01,AF01),8 editable draw.io wireframe boards dan PDF/PNG exports kini tersedia;81 checks reconcile actual SQL/routes/functions. Main ditambah37 reports melalui valid workflow menjadi40 reports,12 claims,6 handovers dengan seluruh states. Sebelum ekspansi dibuat private SQL+storage backup; existing accounts/passwords tetap, schema tanpa migration.

Auth28/account24/Student24/BM27 regression, seed7 groups, main read-only smoke dan fresh-install13 browser groups lulus. Fresh install berasal actual ZIP pada new empty MariaDB datadir/server3307; existing3306 data tetap dan server QA dihentikan. Actual Student/BM screen-only clips dan five-minute narration script disediakan. Release CRC, per-file/runtime hashes serta exclusion of credentials/config/runtime storage/backups/mutation helpers diverifikasi. Detail current: [B06_REPORT.md](B06_REPORT.md).

## UX01 — approved post-B06 polish

Audit and user approval led to synced filtered selection with exact pinned outcomes, target identity in confirmations, mobile detail/back focus, correct Returned time, semantic colours/stronger contrast, authorized friendly audit/notification links and optional custom upload controls. Original audit messages, schema, main data and credentials are preserved.12 meaningful UX browser scenarios and28/24/24/27 regression groups pass. Current checkpoint/evidence: [UX01_REPORT.md](UX01_REPORT.md).

## UX02 — local-only navigation buttons and folder rename

GitHub checkpoint85436aa was inspected before moving the main directory to ReFind_0.2.3. Ignored local base-path configuration preserves existing DB/schema/credentials/runtime. Native anchor routes and Enter/new-tab behavior are preserved with secondary-outline styling; actual Delete remains a confirmed mutation button.15 UX groups plus24/24/27 relevant regressions pass, with main read-only smoke verifying the new URL/data preservation. Current report: [UX02_REPORT.md](UX02_REPORT.md).

## v0.2.5 — QA fixes

A full QA pass of the UX02 build produced 49 findings. They were fixed in four tiers (integrity, flows, polish, copy) under decisions D17–D20, without schema change. Matching now excludes the reporter's own reports and other categories with a higher threshold; one Lost report backs one claim under review; withdraw and release operations close the remaining dead ends. See [V025_REPORT.md](V025_REPORT.md).
