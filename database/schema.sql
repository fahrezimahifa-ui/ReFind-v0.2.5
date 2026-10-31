-- ReFind 0.2.0: new database schema, B02.

-- No DROP/TRUNCATE; run with tools/setup-db.php on the approved new databases.

SET NAMES utf8mb4;

SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS `users` (
  `user_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `student_id` varchar(30) DEFAULT NULL,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('STUDENT','BUILDING_MANAGEMENT') NOT NULL DEFAULT 'STUDENT',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `avatar_path` varchar(80) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_user_email` (`email`),
  UNIQUE KEY `uq_student_id` (`student_id`),
  CONSTRAINT `chk_user_active` CHECK (`is_active` in (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `buildings` (
  `building_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `building_name` varchar(120) NOT NULL,
  PRIMARY KEY (`building_id`),
  UNIQUE KEY `uq_building_name` (`building_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categories` (
  `category_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `category_name` varchar(80) NOT NULL,
  `display_order` tinyint(3) unsigned NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`category_id`),
  UNIQUE KEY `uq_category_name` (`category_name`),
  CONSTRAINT `chk_category_active` CHECK (`is_active` in (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `item_statuses` (
  `status_id` tinyint(3) unsigned NOT NULL AUTO_INCREMENT,
  `status_code` varchar(40) NOT NULL,
  `status_name` varchar(80) NOT NULL,
  `display_order` tinyint(3) unsigned NOT NULL,
  PRIMARY KEY (`status_id`),
  UNIQUE KEY `uq_status_code` (`status_code`),
  UNIQUE KEY `uq_status_name` (`status_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `campus_locations` (
  `location_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `location_code` varchar(40) DEFAULT NULL,
  `location_name` varchar(120) NOT NULL,
  `location_kind` enum('AREA','DETAIL') NOT NULL DEFAULT 'DETAIL',
  `display_order` smallint(5) unsigned NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `building_id` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`location_id`),
  UNIQUE KEY `uq_location_code` (`location_code`),
  UNIQUE KEY `uq_location` (`location_name`,`building_id`),
  KEY `idx_report_locations` (`location_kind`,`is_active`,`display_order`),
  KEY `fk_location_building` (`building_id`),
  CONSTRAINT `fk_location_building` FOREIGN KEY (`building_id`) REFERENCES `buildings` (`building_id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_location_active` CHECK (`is_active` in (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `location_floors` (
  `location_floor_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `location_id` int(10) unsigned NOT NULL,
  `floor_name` varchar(50) NOT NULL,
  PRIMARY KEY (`location_floor_id`),
  UNIQUE KEY `uq_location_floor` (`location_id`,`floor_name`),
  UNIQUE KEY `uq_floor_location_pair` (`location_floor_id`,`location_id`),
  CONSTRAINT `fk_floor_location` FOREIGN KEY (`location_id`) REFERENCES `campus_locations` (`location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `items` (
  `item_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `reporter_user_id` int(10) unsigned NOT NULL,
  `category_id` int(10) unsigned NOT NULL,
  `location_id` int(10) unsigned DEFAULT NULL,
  `location_floor_id` int(10) unsigned DEFAULT NULL,
  `status_id` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `item_type` enum('LOST','FOUND') NOT NULL,
  `title` varchar(150) NOT NULL,
  `description` text NOT NULL,
  `location_detail` text DEFAULT NULL,
  `event_date` date NOT NULL,
  `event_time` time DEFAULT NULL,
  `verification_clue` text DEFAULT NULL,
  `contact_preference` enum('IN_APP','IN_APP_EMAIL') NOT NULL DEFAULT 'IN_APP',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`item_id`),
  KEY `idx_items_user` (`reporter_user_id`),
  KEY `idx_items_type` (`item_type`),
  KEY `idx_items_status` (`status_id`),
  KEY `idx_items_category` (`category_id`),
  KEY `idx_items_location` (`location_id`),
  KEY `idx_items_floor_location` (`location_floor_id`,`location_id`),
  KEY `idx_items_event_date` (`event_date`),
  CONSTRAINT `fk_items_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`category_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_items_floor_location` FOREIGN KEY (`location_floor_id`, `location_id`) REFERENCES `location_floors` (`location_floor_id`, `location_id`),
  CONSTRAINT `fk_items_location` FOREIGN KEY (`location_id`) REFERENCES `campus_locations` (`location_id`),
  CONSTRAINT `fk_items_status` FOREIGN KEY (`status_id`) REFERENCES `item_statuses` (`status_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_items_user` FOREIGN KEY (`reporter_user_id`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE,
  CONSTRAINT `chk_item_floor_requires_location` CHECK (`location_floor_id` is null or `location_id` is not null),
  CONSTRAINT `chk_item_location_detail` CHECK (`location_detail` is null or char_length(`location_detail`) <= 500)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `item_photos` (
  `photo_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `item_id` int(10) unsigned NOT NULL,
  `photo_kind` enum('ITEM','OWNERSHIP') NOT NULL DEFAULT 'ITEM',
  `file_path` varchar(255) NOT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`photo_id`),
  KEY `idx_item_photos_kind` (`item_id`,`photo_kind`,`uploaded_at`),
  CONSTRAINT `fk_item_photos_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_item_photo_primary` CHECK (`is_primary` in (0,1) and (`photo_kind` = 'ITEM' or `is_primary` = 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `item_matches` (
  `match_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `lost_item_id` int(10) unsigned NOT NULL,
  `found_item_id` int(10) unsigned NOT NULL,
  `match_score` decimal(5,2) DEFAULT NULL,
  `match_status` enum('SUGGESTED','CONFIRMED','REJECTED') NOT NULL DEFAULT 'SUGGESTED',
  `confirmed_by_user_id` int(10) unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `confirmed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`match_id`),
  UNIQUE KEY `uq_item_match` (`lost_item_id`,`found_item_id`),
  KEY `idx_match_found_item` (`found_item_id`),
  KEY `idx_match_confirmer` (`confirmed_by_user_id`),
  KEY `idx_match_status` (`match_status`),
  CONSTRAINT `fk_match_confirmer` FOREIGN KEY (`confirmed_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_match_found_item` FOREIGN KEY (`found_item_id`) REFERENCES `items` (`item_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_match_lost_item` FOREIGN KEY (`lost_item_id`) REFERENCES `items` (`item_id`) ON DELETE CASCADE,
  CONSTRAINT `chk_match_score` CHECK (`match_score` is null or `match_score` between 0 and 100),
  CONSTRAINT `chk_match_different_items` CHECK (`lost_item_id` <> `found_item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `claims` (
  `claim_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `item_id` int(10) unsigned NOT NULL,
  `related_lost_item_id` int(10) unsigned DEFAULT NULL,
  `claimant_user_id` int(10) unsigned NOT NULL,
  `ownership_answer` text NOT NULL,
  `claim_status` enum('PENDING','NEED_MORE_INFO','APPROVED','REJECTED','WITHDRAWN') NOT NULL DEFAULT 'PENDING',
  `reviewed_by_user_id` int(10) unsigned DEFAULT NULL,
  `review_note` text DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`claim_id`),
  UNIQUE KEY `uq_claim_user_item` (`item_id`,`claimant_user_id`),
  KEY `idx_claim_related_lost` (`related_lost_item_id`),
  KEY `idx_claim_reviewer` (`reviewed_by_user_id`),
  KEY `idx_claim_status` (`claim_status`),
  KEY `idx_claim_claimant` (`claimant_user_id`),
  CONSTRAINT `fk_claim_claimant` FOREIGN KEY (`claimant_user_id`) REFERENCES `users` (`user_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_claim_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_claim_related_lost` FOREIGN KEY (`related_lost_item_id`) REFERENCES `items` (`item_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_claim_reviewer` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `claim_photos` (
  `claim_photo_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `claim_id` int(10) unsigned NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`claim_photo_id`),
  KEY `idx_claim_photos_claim` (`claim_id`,`uploaded_at`),
  CONSTRAINT `fk_claim_photos_claim` FOREIGN KEY (`claim_id`) REFERENCES `claims` (`claim_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `handovers` (
  `handover_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `claim_id` int(10) unsigned NOT NULL,
  `pickup_location_id` int(10) unsigned DEFAULT NULL,
  `scheduled_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `handled_by_user_id` int(10) unsigned DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `handover_status` enum('PENDING','SCHEDULED','COMPLETED') NOT NULL DEFAULT 'PENDING',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`handover_id`),
  UNIQUE KEY `uq_handover_claim` (`claim_id`),
  KEY `idx_handover_location` (`pickup_location_id`),
  KEY `idx_handover_handler` (`handled_by_user_id`),
  KEY `idx_handover_status` (`handover_status`),
  CONSTRAINT `fk_handover_claim` FOREIGN KEY (`claim_id`) REFERENCES `claims` (`claim_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_handover_handler` FOREIGN KEY (`handled_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_handover_location` FOREIGN KEY (`pickup_location_id`) REFERENCES `campus_locations` (`location_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `notification_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` int(10) unsigned NOT NULL,
  `claim_id` int(10) unsigned DEFAULT NULL,
  `item_id` int(10) unsigned DEFAULT NULL,
  `notification_type` varchar(50) NOT NULL,
  `title` varchar(150) NOT NULL,
  `message` varchar(500) NOT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`notification_id`),
  KEY `idx_notification_user_read` (`user_id`,`is_read`),
  KEY `idx_notification_claim` (`claim_id`),
  KEY `idx_notification_item` (`item_id`),
  KEY `idx_notification_created` (`created_at`),
  CONSTRAINT `fk_notification_claim` FOREIGN KEY (`claim_id`) REFERENCES `claims` (`claim_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_notification_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_notification_read` CHECK (`is_read` in (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `item_status_history` (
  `history_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `item_id` int(10) unsigned NOT NULL,
  `status_id` tinyint(3) unsigned NOT NULL,
  `changed_by_user_id` int(10) unsigned DEFAULT NULL,
  `note` varchar(500) DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`history_id`),
  KEY `idx_history_item_time` (`item_id`,`changed_at`),
  KEY `idx_history_status` (`status_id`),
  KEY `idx_history_user` (`changed_by_user_id`),
  CONSTRAINT `fk_history_item` FOREIGN KEY (`item_id`) REFERENCES `items` (`item_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_history_status` FOREIGN KEY (`status_id`) REFERENCES `item_statuses` (`status_id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_history_user` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
