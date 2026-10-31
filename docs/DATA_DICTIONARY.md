# Data dictionary — As-built B06 / SQL 0.2.0

Schema SQL 0.2.0 actual; status implementasi workflow dirinci di WORKFLOW_CONTRACT.md.

**14 tables · 2 views · 25 FK · 14 PK · 13 UNIQUE · 9 CHECK.**

Diagram menampilkan PK/FK dan fields relevan; dictionary ini memuat seluruh columns dan constraints.

## Perbedaan terhadap baseline

`handovers.handover_status`: baseline PENDING/SCHEDULED/COMPLETED/CANCELLED; schema 0.2.0 PENDING/SCHEDULED/COMPLETED. Batal jadwal → PENDING (D05), bukan membatalkan ownership. Operasi handover dan private audit dirinci di WORKFLOW_CONTRACT.md.

## Cardinality

Parent dapat memiliki nol children. `1:M` tidak mewajibkan minimal satu child. FK nullable berarti parent-per-child 0..1. `claims → handovers` 1:0..1 karena UNIQUE claim_id. Lost ↔ Found M:N melalui dua FK 1:M pada item_matches; one confirmed owner/pair juga diperiksa aplikasi.

## `users`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `user_id` | PK | No | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `student_id` | — | Yes | `varchar(30) DEFAULT NULL` |
| `full_name` | — | No | `varchar(120) NOT NULL` |
| `email` | — | No | `varchar(150) NOT NULL` |
| `password_hash` | — | No | `varchar(255) NOT NULL` |
| `role` | — | No | `enum('STUDENT','BUILDING_MANAGEMENT') NOT NULL DEFAULT 'STUDENT'` |
| `is_active` | — | No | `tinyint(1) NOT NULL DEFAULT 1` |
| `created_at` | — | No | `datetime NOT NULL DEFAULT current_timestamp()` |
| `updated_at` | — | No | `datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` |
| `avatar_path` | — | Yes | `varchar(80) DEFAULT NULL` |

The field stores a private random avatar reference. APIs return an authenticated URL, never the storage path. See [migration and verification](UI_PROFILE_ENHANCEMENTS.md).

- PK: `user_id`.
- UNIQUE `uq_user_email`: (email).
- UNIQUE `uq_student_id`: (student_id).
- CONSTRAINT `chk_user_active` CHECK (`is_active` in (0,1))

## `buildings`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `building_id` | PK | No | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `building_name` | — | No | `varchar(120) NOT NULL` |

- PK: `building_id`.
- UNIQUE `uq_building_name`: (building_name).

## `categories`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `category_id` | PK | No | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `category_name` | — | No | `varchar(80) NOT NULL` |
| `display_order` | — | No | `tinyint(3) unsigned NOT NULL DEFAULT 0` |
| `is_active` | — | No | `tinyint(1) NOT NULL DEFAULT 1` |

- PK: `category_id`.
- UNIQUE `uq_category_name`: (category_name).
- CONSTRAINT `chk_category_active` CHECK (`is_active` in (0,1))

## `item_statuses`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `status_id` | PK | No | `tinyint(3) unsigned NOT NULL AUTO_INCREMENT` |
| `status_code` | — | No | `varchar(40) NOT NULL` |
| `status_name` | — | No | `varchar(80) NOT NULL` |
| `display_order` | — | No | `tinyint(3) unsigned NOT NULL` |

- PK: `status_id`.
- UNIQUE `uq_status_code`: (status_code).
- UNIQUE `uq_status_name`: (status_name).

## `campus_locations`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `location_id` | PK | No | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `location_code` | — | Yes | `varchar(40) DEFAULT NULL` |
| `location_name` | — | No | `varchar(120) NOT NULL` |
| `location_kind` | — | No | `enum('AREA','DETAIL') NOT NULL DEFAULT 'DETAIL'` |
| `display_order` | — | No | `smallint(5) unsigned NOT NULL DEFAULT 0` |
| `is_active` | — | No | `tinyint(1) NOT NULL DEFAULT 1` |
| `building_id` | FK | Yes | `int(10) unsigned DEFAULT NULL` |

- PK: `location_id`.
- UNIQUE `uq_location_code`: (location_code).
- UNIQUE `uq_location`: (location_name, building_id).
- FK `fk_location_building`: (building_id) → `buildings` (building_id); ON UPDATE CASCADE; 1:M; parent/child 0..1, children/parent 0..M.
- CONSTRAINT `chk_location_active` CHECK (`is_active` in (0,1))

## `location_floors`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `location_floor_id` | PK | No | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `location_id` | FK | No | `int(10) unsigned NOT NULL` |
| `floor_name` | — | No | `varchar(50) NOT NULL` |

- PK: `location_floor_id`.
- UNIQUE `uq_location_floor`: (location_id, floor_name).
- UNIQUE `uq_floor_location_pair`: (location_floor_id, location_id).
- FK `fk_floor_location`: (location_id) → `campus_locations` (location_id); RESTRICT (default); 1:M; parent/child 1, children/parent 0..M.

## `items`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `item_id` | PK | No | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `reporter_user_id` | FK | No | `int(10) unsigned NOT NULL` |
| `category_id` | FK | No | `int(10) unsigned NOT NULL` |
| `location_id` | FK | Yes | `int(10) unsigned DEFAULT NULL` |
| `location_floor_id` | FK | Yes | `int(10) unsigned DEFAULT NULL` |
| `status_id` | FK | No | `tinyint(3) unsigned NOT NULL DEFAULT 1` |
| `item_type` | — | No | `enum('LOST','FOUND') NOT NULL` |
| `title` | — | No | `varchar(150) NOT NULL` |
| `description` | — | No | `text NOT NULL` |
| `location_detail` | — | Yes | `text DEFAULT NULL` |
| `event_date` | — | No | `date NOT NULL` |
| `event_time` | — | Yes | `time DEFAULT NULL` |
| `verification_clue` | — | Yes | `text DEFAULT NULL` |
| `contact_preference` | — | No | `enum('IN_APP','IN_APP_EMAIL') NOT NULL DEFAULT 'IN_APP'` |
| `created_at` | — | No | `datetime NOT NULL DEFAULT current_timestamp()` |
| `updated_at` | — | No | `datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` |
| `resolved_at` | — | Yes | `datetime DEFAULT NULL` |

- PK: `item_id`.
- FK `fk_items_category`: (category_id) → `categories` (category_id); ON UPDATE CASCADE; 1:M; parent/child 1, children/parent 0..M.
- FK `fk_items_floor_location`: (location_floor_id, location_id) → `location_floors` (location_floor_id, location_id); RESTRICT (default); 1:M; parent/child 0..1, children/parent 0..M.
- FK `fk_items_location`: (location_id) → `campus_locations` (location_id); RESTRICT (default); 1:M; parent/child 0..1, children/parent 0..M.
- FK `fk_items_status`: (status_id) → `item_statuses` (status_id); ON UPDATE CASCADE; 1:M; parent/child 1, children/parent 0..M.
- FK `fk_items_user`: (reporter_user_id) → `users` (user_id); ON UPDATE CASCADE; 1:M; parent/child 1, children/parent 0..M.
- CONSTRAINT `chk_item_floor_requires_location` CHECK (`location_floor_id` is null or `location_id` is not null)
- CONSTRAINT `chk_item_location_detail` CHECK (`location_detail` is null or char_length(`location_detail`) <= 500)

## `item_photos`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `photo_id` | PK | No | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `item_id` | FK | No | `int(10) unsigned NOT NULL` |
| `photo_kind` | — | No | `enum('ITEM','OWNERSHIP') NOT NULL DEFAULT 'ITEM'` |
| `file_path` | — | No | `varchar(255) NOT NULL` |
| `is_primary` | — | No | `tinyint(1) NOT NULL DEFAULT 0` |
| `uploaded_at` | — | No | `datetime NOT NULL DEFAULT current_timestamp()` |

- PK: `photo_id`.
- FK `fk_item_photos_item`: (item_id) → `items` (item_id); ON DELETE CASCADE ON UPDATE CASCADE; 1:M; parent/child 1, children/parent 0..M.
- CONSTRAINT `chk_item_photo_primary` CHECK (`is_primary` in (0,1) and (`photo_kind` = 'ITEM' or `is_primary` = 0))

## `item_matches`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `match_id` | PK | No | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `lost_item_id` | FK | No | `int(10) unsigned NOT NULL` |
| `found_item_id` | FK | No | `int(10) unsigned NOT NULL` |
| `match_score` | — | Yes | `decimal(5,2) DEFAULT NULL` |
| `match_status` | — | No | `enum('SUGGESTED','CONFIRMED','REJECTED') NOT NULL DEFAULT 'SUGGESTED'` |
| `confirmed_by_user_id` | FK | Yes | `int(10) unsigned DEFAULT NULL` |
| `created_at` | — | No | `datetime NOT NULL DEFAULT current_timestamp()` |
| `confirmed_at` | — | Yes | `datetime DEFAULT NULL` |

- PK: `match_id`.
- UNIQUE `uq_item_match`: (lost_item_id, found_item_id).
- FK `fk_match_confirmer`: (confirmed_by_user_id) → `users` (user_id); ON DELETE SET NULL ON UPDATE CASCADE; 1:M; parent/child 0..1, children/parent 0..M.
- FK `fk_match_found_item`: (found_item_id) → `items` (item_id); ON DELETE CASCADE; 1:M; parent/child 1, children/parent 0..M.
- FK `fk_match_lost_item`: (lost_item_id) → `items` (item_id); ON DELETE CASCADE; 1:M; parent/child 1, children/parent 0..M.
- CONSTRAINT `chk_match_score` CHECK (`match_score` is null or `match_score` between 0 and 100)
- CONSTRAINT `chk_match_different_items` CHECK (`lost_item_id` <> `found_item_id`)

## `claims`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `claim_id` | PK | No | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `item_id` | FK | No | `int(10) unsigned NOT NULL` |
| `related_lost_item_id` | FK | Yes | `int(10) unsigned DEFAULT NULL` |
| `claimant_user_id` | FK | No | `int(10) unsigned NOT NULL` |
| `ownership_answer` | — | No | `text NOT NULL` |
| `claim_status` | — | No | `enum('PENDING','NEED_MORE_INFO','APPROVED','REJECTED','WITHDRAWN') NOT NULL DEFAULT 'PENDING'` |
| `reviewed_by_user_id` | FK | Yes | `int(10) unsigned DEFAULT NULL` |
| `review_note` | — | Yes | `text DEFAULT NULL` |
| `reviewed_at` | — | Yes | `datetime DEFAULT NULL` |
| `created_at` | — | No | `datetime NOT NULL DEFAULT current_timestamp()` |
| `updated_at` | — | No | `datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` |

- PK: `claim_id`.
- UNIQUE `uq_claim_user_item`: (item_id, claimant_user_id).
- FK `fk_claim_claimant`: (claimant_user_id) → `users` (user_id); ON UPDATE CASCADE; 1:M; parent/child 1, children/parent 0..M.
- FK `fk_claim_item`: (item_id) → `items` (item_id); ON DELETE CASCADE ON UPDATE CASCADE; 1:M; parent/child 1, children/parent 0..M.
- FK `fk_claim_related_lost`: (related_lost_item_id) → `items` (item_id); ON DELETE SET NULL ON UPDATE CASCADE; 1:M; parent/child 0..1, children/parent 0..M.
- FK `fk_claim_reviewer`: (reviewed_by_user_id) → `users` (user_id); ON DELETE SET NULL ON UPDATE CASCADE; 1:M; parent/child 0..1, children/parent 0..M.

## `claim_photos`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `claim_photo_id` | PK | No | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `claim_id` | FK | No | `int(10) unsigned NOT NULL` |
| `file_path` | — | No | `varchar(255) NOT NULL` |
| `uploaded_at` | — | No | `datetime NOT NULL DEFAULT current_timestamp()` |

- PK: `claim_photo_id`.
- FK `fk_claim_photos_claim`: (claim_id) → `claims` (claim_id); ON DELETE CASCADE ON UPDATE CASCADE; 1:M; parent/child 1, children/parent 0..M.

## `handovers`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `handover_id` | PK | No | `int(10) unsigned NOT NULL AUTO_INCREMENT` |
| `claim_id` | FK | No | `int(10) unsigned NOT NULL` |
| `pickup_location_id` | FK | Yes | `int(10) unsigned DEFAULT NULL` |
| `scheduled_at` | — | Yes | `datetime DEFAULT NULL` |
| `completed_at` | — | Yes | `datetime DEFAULT NULL` |
| `handled_by_user_id` | FK | Yes | `int(10) unsigned DEFAULT NULL` |
| `notes` | — | Yes | `varchar(500) DEFAULT NULL` |
| `handover_status` | — | No | `enum('PENDING','SCHEDULED','COMPLETED') NOT NULL DEFAULT 'PENDING'` |
| `created_at` | — | No | `datetime NOT NULL DEFAULT current_timestamp()` |
| `updated_at` | — | No | `datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()` |

- PK: `handover_id`.
- UNIQUE `uq_handover_claim`: (claim_id).
- FK `fk_handover_claim`: (claim_id) → `claims` (claim_id); ON DELETE CASCADE ON UPDATE CASCADE; 1:0..1; parent/child 1, children/parent 0..1.
- FK `fk_handover_handler`: (handled_by_user_id) → `users` (user_id); ON DELETE SET NULL ON UPDATE CASCADE; 1:M; parent/child 0..1, children/parent 0..M.
- FK `fk_handover_location`: (pickup_location_id) → `campus_locations` (location_id); ON DELETE SET NULL ON UPDATE CASCADE; 1:M; parent/child 0..1, children/parent 0..M.

## `notifications`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `notification_id` | PK | No | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `user_id` | FK | No | `int(10) unsigned NOT NULL` |
| `claim_id` | FK | Yes | `int(10) unsigned DEFAULT NULL` |
| `item_id` | FK | Yes | `int(10) unsigned DEFAULT NULL` |
| `notification_type` | — | No | `varchar(50) NOT NULL` |
| `title` | — | No | `varchar(150) NOT NULL` |
| `message` | — | No | `varchar(500) NOT NULL` |
| `is_read` | — | No | `tinyint(1) NOT NULL DEFAULT 0` |
| `created_at` | — | No | `datetime NOT NULL DEFAULT current_timestamp()` |

- PK: `notification_id`.
- FK `fk_notification_claim`: (claim_id) → `claims` (claim_id); ON DELETE SET NULL ON UPDATE CASCADE; 1:M; parent/child 0..1, children/parent 0..M.
- FK `fk_notification_item`: (item_id) → `items` (item_id); ON DELETE SET NULL ON UPDATE CASCADE; 1:M; parent/child 0..1, children/parent 0..M.
- FK `fk_notification_user`: (user_id) → `users` (user_id); ON DELETE CASCADE ON UPDATE CASCADE; 1:M; parent/child 1, children/parent 0..M.
- CONSTRAINT `chk_notification_read` CHECK (`is_read` in (0,1))

## `item_status_history`

| Column | PK/FK | Nullable | Actual SQL definition |
|---|---|---|---|
| `history_id` | PK | No | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `item_id` | FK | No | `int(10) unsigned NOT NULL` |
| `status_id` | FK | No | `tinyint(3) unsigned NOT NULL` |
| `changed_by_user_id` | FK | Yes | `int(10) unsigned DEFAULT NULL` |
| `note` | — | Yes | `varchar(500) DEFAULT NULL` |
| `changed_at` | — | No | `datetime NOT NULL DEFAULT current_timestamp()` |

- PK: `history_id`.
- FK `fk_history_item`: (item_id) → `items` (item_id); ON DELETE CASCADE ON UPDATE CASCADE; 1:M; parent/child 1, children/parent 0..M.
- FK `fk_history_status`: (status_id) → `item_statuses` (status_id); ON UPDATE CASCADE; 1:M; parent/child 1, children/parent 0..M.
- FK `fk_history_user`: (changed_by_user_id) → `users` (user_id); ON DELETE SET NULL ON UPDATE CASCADE; 1:M; parent/child 0..1, children/parent 0..M.

## Views

- `v_items_overview`: public item projection; private clue/evidence/email/NIM excluded.
- `v_pending_claims`: BM review projection; exposed only through authorized staff API.

## Relationship index — 25 FK

| FK | Parent → Child | Cardinality | Parent per child | Children per parent |
|---|---|---|---|---|
| `fk_location_building` | `buildings` → `campus_locations` | **1:M** | 0..1 | 0..M |
| `fk_floor_location` | `campus_locations` → `location_floors` | **1:M** | 1 | 0..M |
| `fk_items_category` | `categories` → `items` | **1:M** | 1 | 0..M |
| `fk_items_floor_location` | `location_floors` → `items` | **1:M** | 0..1 | 0..M |
| `fk_items_location` | `campus_locations` → `items` | **1:M** | 0..1 | 0..M |
| `fk_items_status` | `item_statuses` → `items` | **1:M** | 1 | 0..M |
| `fk_items_user` | `users` → `items` | **1:M** | 1 | 0..M |
| `fk_item_photos_item` | `items` → `item_photos` | **1:M** | 1 | 0..M |
| `fk_match_confirmer` | `users` → `item_matches` | **1:M** | 0..1 | 0..M |
| `fk_match_found_item` | `items` → `item_matches` | **1:M** | 1 | 0..M |
| `fk_match_lost_item` | `items` → `item_matches` | **1:M** | 1 | 0..M |
| `fk_claim_claimant` | `users` → `claims` | **1:M** | 1 | 0..M |
| `fk_claim_item` | `items` → `claims` | **1:M** | 1 | 0..M |
| `fk_claim_related_lost` | `items` → `claims` | **1:M** | 0..1 | 0..M |
| `fk_claim_reviewer` | `users` → `claims` | **1:M** | 0..1 | 0..M |
| `fk_claim_photos_claim` | `claims` → `claim_photos` | **1:M** | 1 | 0..M |
| `fk_handover_claim` | `claims` → `handovers` | **1:0..1** | 1 | 0..1 |
| `fk_handover_handler` | `users` → `handovers` | **1:M** | 0..1 | 0..M |
| `fk_handover_location` | `campus_locations` → `handovers` | **1:M** | 0..1 | 0..M |
| `fk_notification_claim` | `claims` → `notifications` | **1:M** | 0..1 | 0..M |
| `fk_notification_item` | `items` → `notifications` | **1:M** | 0..1 | 0..M |
| `fk_notification_user` | `users` → `notifications` | **1:M** | 1 | 0..M |
| `fk_history_item` | `items` → `item_status_history` | **1:M** | 1 | 0..M |
| `fk_history_status` | `item_statuses` → `item_status_history` | **1:M** | 1 | 0..M |
| `fk_history_user` | `users` → `item_status_history` | **1:M** | 0..1 | 0..M |
