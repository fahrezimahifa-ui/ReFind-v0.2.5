# Akun demo, mock inventory & SOP final B06

**Current local UX02 path:** `http://localhost/ReFind_0.2.3/login.html`. The main folder was renamed only; the same DB/accounts/passwords remain. Current private credential receipt is `C:\xampp\htdocs\ReFind_0.2.3\storage\setup\demo-accounts.json`. Older0.2.0 paths below belong to the prior B06 checkpoint.

Credential authentication sudah berfungsi. Tidak ada account/privilege selector.

Main memiliki **3 active accounts /2 role types**:2 Student dan1 Building Management. Existing main credentials tetap berlaku; fresh installation generates different random credentials in its own protected receipt.

| Email | Role | Nama |
|---|---|---|
| student-a@refind.test | STUDENT | Student Demo A |
| student-b@refind.test | STUDENT | Student Demo B |
| bm@refind.test | BUILDING_MANAGEMENT | Building Management |

**Password:** buka file lokal berikut melalui Explorer/editor, lalu lihat field `password` milik email yang dipilih:

```text
C:\xampp\htdocs\ReFind_0.2.0\storage\setup\demo-accounts.json
```

File ini berisi credential demo yang dibuat otomatis oleh CLI, bukan password personal. File tidak bisa diunduh melalui HTTP dan tidak masuk Git/submission ZIP. Jangan menaruh password atau secret di README publik.

Login URL: `http://localhost/ReFind_0.2.0/login.html`.

Student diarahkan ke Student Home; BM ke Review Queue. Account menu menyediakan My profile, Account settings, dan Logout. Profile/password, Student discovery/report/claim serta BM review/status/handover kini aktif. Wrong-role pages/APIs tetap ditolak403 di server.

Jika Anda mengganti password lewat Settings, gunakan **password baru** untuk login berikutnya. Initial setup receipt tidak menyimpan password baru dan tidak dapat dipakai sebagai password reset. Re-run setup mempertahankan existing passwords.

Untuk demo: login Student A → refresh → logout → login BM → lihat pemisahan landing → logout. Pemisahan permission juga diuji lewat server/API pada test app; record fixtures tidak ditaruh di DB demo utama.

## Original Student examples

Main database contains three clearly labelled synthetic photo-backed examples: Lost headphones by Student A, Found headphones and Found umbrella by Student B. Login A → Explore → Found headphones → Claim + own Lost link → My Activity pending → Notifications. Login B cannot claim their own Found report. Uploaded evidence remains private; images are credited stock classroom illustrations.

The original examples are item1 Lost headphones, item2 Found headphones and item3 Found umbrella. B06 additionally seeded37 reports around them. At the initial final checkpoint: **40 reports (20 Lost/20 Found),12 claims,6 pickups,40 public photos,20 Lost evidence photos,12 claim proof photos,176 notifications,133 history events**. Operational outcomes are synthetic simulations through the actual application workflow.

## Prepared mock cases — initial B06 checkpoint

| Case | Owner | Lost / Found item IDs | Claim / pickup IDs | State / demonstration |
|---|---|---|---|---|
|C01|A|4 /5|1 /1|Approved; Pending pickup |
|C02|B|6 /7|2 /2|Approved; Pending after cancelled appointment |
|C03|A|8 /9|3 /3|Approved; Scheduled pickup |
|C04|B|10 /11|4 /4|Approved; Scheduled after reschedule |
|C05|A|12 /13|5 /5|Completed; both Returned, spontaneous pickup |
|C06|B|14 /15|6 /6|Completed; both Returned after scheduling |
|C07|A|16 /17|7 /—|Need More Info; same-ID resubmit |
|C08|B|18 /19|8 /—|Need More Info; same-ID resubmit |
|C09|A|20 /21|9 /—|Rejected; Found Reported, eligible resubmit |
|C10|B|22 /23|10 /—|Rejected; Found Reported, eligible resubmit |
|C11|A|24 /25|11 /—|Pending review |
|C12|B|26 /27|12 /—|Pending review |
|C13|A|28 /29|—|Both Under review |
|C14|B|30 /31|—|Found Never retrieved |
|C15|A|32 /33|—|Both Never retrieved |
|C16|B|34 /35|—|Lost manually recovered/Returned; Found remains available |
|C17|A|36 /37|—|Reported; eligible report edit/delete |
|C18|B|38 /39|—|Possible match; eligible own report actions |
|C19|A|40 /—|—|Extra Lost, older event date and unknown time |

Found reporter is the other Student. Main initial IDs are listed above; bookmark recipes retain actual IDs locally. Fresh installation of this clean schema produces the same logical cases, while later user actions can alter states and counts. Private bookmarks: `storage/setup/expanded-demo.json`; read-only current inventory: PHP `tools/demo-summary.php`.

## Full Lost → Returned demo

1. Login Student A, buka original Found item2 (`item.html?id=2`) dan submit claim dengan own Lost item1. Tambahkan ownership answer/optional proof. Or use existing Pending C11 or Need More Info C07; note its exact claim ID in My Activity.
2. Logout lalu login `bm@refind.test` → **Review Queue → Claims**. Pilih claim yang sama; bandingkan claimant answer, finder clue, linked Lost dan supporting photos privat. Klik thumbnail untuk enlarge; Escape/Close kembali ke detail.
3. **Request more info** dengan note minimal8 karakter dan checkbox confirmation. Logout → login A → Notifications/My Activity → buka same-ID claim, lengkapi jawaban/retained evidence lalu resubmit. Status kembali Pending.
4. Login BM → pilih same-ID claim → **Approve claim**, isi note dan confirmation. Claim Approved, Lost/Found Ready for pickup, tepat satu pickup record dibuat.
5. Tab **Handover** → pilih record → **Schedule pickup**, pilih campus area aktif dan waktu mendatang dalam Asia/Jakarta. **Reschedule** menggunakan waktu/lokasi berbeda dan reason.
6. **Cancel appointment** dengan reason/confirmation: jadwal kosong, pickup Pending, ownership tetap approved dan kedua report tetap Ready for pickup. Schedule ulang menggunakan handover yang sama.
7. Setelah simulasi physical return, BM **Confirm item returned** dengan confirmation. Pickup Completed, kedua report Returned; buka History dan reviewed claim deep link untuk memastikan outcome read-only.
8. Student A melihat pickup/hasil dan private notifications miliknya. Student B tidak dapat membaca ownership proof atau BM controls. Public history tidak menampilkan private review/pickup reason/jadwal.

Langkah demo menyimpan perubahan nyata melalui UI. Untuk mengulang lifecycle setelah terminal Returned, pilih eligible prepared case lain atau buat pasangan Lost/Found baru dengan akun A/B. Reseeding menjaga edited/deleted bookmarks dan existing outcomes/passwords.

Alternative exception demo: reject/resubmit C09/C10; operational status/archive C13–C16; eligible own edit/delete C17–C19. Two BM browser sessions with old detail receive409/explicit refresh without replay. Final evidence: [B06_REPORT.md](B06_REPORT.md). Presentation sequence and actual screen-only clips: [DEMO_SCRIPT_5_MIN.md](DEMO_SCRIPT_5_MIN.md).
