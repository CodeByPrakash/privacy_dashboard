-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Feb 05, 2026 at 11:35 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `privacy_dashboard`
--

DELIMITER $$
--
-- Procedures
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_enforcer_restore_student_access` (IN `p_student_id` BIGINT UNSIGNED, IN `p_reason` VARCHAR(255))   BEGIN
    UPDATE students
    SET security_level = 'normal',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_student_id;

    INSERT INTO admin_reports (student_id, action, reason, report_json)
    VALUES (
        p_student_id,
        'restore_access',
        p_reason,
        JSON_OBJECT('status', 'restored')
    );
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_enforcer_revoke_student_access` (IN `p_student_id` BIGINT UNSIGNED, IN `p_reason` VARCHAR(255))   BEGIN
    DECLARE v_sessions INT DEFAULT 0;
    DECLARE v_tokens INT DEFAULT 0;

    UPDATE sessions
    SET status = 'revoked',
        revoked_at = NOW()
    WHERE student_id = p_student_id AND status = 'active';

    SET v_sessions = ROW_COUNT();

    UPDATE auth_tokens
    SET status = 'revoked',
        revoked_at = NOW()
    WHERE student_id = p_student_id AND status = 'active';

    SET v_tokens = ROW_COUNT();

    UPDATE students
    SET security_level = 'revoked',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_student_id;

    INSERT INTO admin_reports (student_id, action, reason, report_json)
    VALUES (
        p_student_id,
        'revoke_access',
        p_reason,
        JSON_OBJECT('revoked_sessions', v_sessions, 'revoked_tokens', v_tokens)
    );
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_guardian_vibe_check` (IN `p_student_id` BIGINT UNSIGNED)   BEGIN
    DECLARE v_weak_passwords INT DEFAULT 0;
    DECLARE v_suspicious_visits INT DEFAULT 0;
    DECLARE v_two_fa BOOLEAN DEFAULT FALSE;
    DECLARE v_score INT DEFAULT 100;
    DECLARE v_entropy_threshold DECIMAL(6,2) DEFAULT 35.00;
    DECLARE v_days_since_change INT DEFAULT 0;

    SELECT 
        COUNT(*)
    INTO v_weak_passwords
    FROM password_meta pm
    WHERE pm.student_id = p_student_id
      AND (
          pm.length_check = FALSE OR
          pm.complexity_check = FALSE OR
          pm.pwned_check = TRUE OR
          (pm.entropy_score IS NOT NULL AND pm.entropy_score < v_entropy_threshold)
      )
      AND (pm.last_changed IS NULL OR pm.last_changed < (CURRENT_DATE - INTERVAL 30 DAY));

    SELECT 
        COUNT(*)
    INTO v_suspicious_visits
    FROM student_activity sa
    WHERE sa.student_id = p_student_id
      AND sa.is_suspicious = TRUE
      AND sa.visited_at >= (NOW() - INTERVAL 1 DAY);

    SELECT u.two_factor_enabled
    INTO v_two_fa
    FROM students u
    WHERE u.id = p_student_id;

    SET v_score = 100 - (v_weak_passwords * 10) - (v_suspicious_visits * 5) + (CASE WHEN v_two_fa THEN 20 ELSE 0 END);

    IF v_score < 0 THEN
        SET v_score = 0;
    END IF;
    IF v_score > 100 THEN
        SET v_score = 100;
    END IF;

    UPDATE students
    SET privacy_score = v_score,
        security_level = CASE
            WHEN v_score < 40 THEN 'high-risk'
            WHEN v_score < 70 THEN 'warning'
            ELSE 'normal'
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_student_id;

    INSERT INTO privacy_score_history (student_id, privacy_score)
    VALUES (p_student_id, v_score);

    IF v_weak_passwords > 0 THEN
        INSERT INTO security_audit (student_id, audit_type, severity, details)
        VALUES (
            p_student_id,
            'weak_password_detected',
            'warning',
            JSON_OBJECT('weak_passwords', v_weak_passwords, 'days_since_change', 30)
        );
    END IF;

    IF v_suspicious_visits > 0 THEN
        INSERT INTO security_audit (student_id, audit_type, severity, details)
        VALUES (
            p_student_id,
            'suspicious_site_visits',
            'warning',
            JSON_OBJECT('count_last_24h', v_suspicious_visits)
        );
    END IF;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_guardian_vibe_check_all` ()   BEGIN
    UPDATE students u
    LEFT JOIN (
        SELECT pm.student_id,
               COUNT(*) AS weak_passwords
        FROM password_meta pm
        WHERE (
            pm.length_check = FALSE OR
            pm.complexity_check = FALSE OR
            pm.pwned_check = TRUE OR
            (pm.entropy_score IS NOT NULL AND pm.entropy_score < 35.00)
        )
        AND (pm.last_changed IS NULL OR pm.last_changed < (CURRENT_DATE - INTERVAL 30 DAY))
        GROUP BY pm.student_id
    ) wp ON wp.student_id = u.id
    LEFT JOIN (
        SELECT sa.student_id,
               COUNT(*) AS suspicious_visits
        FROM student_activity sa
        WHERE sa.is_suspicious = TRUE
          AND sa.visited_at >= (NOW() - INTERVAL 1 DAY)
        GROUP BY sa.student_id
    ) sv ON sv.student_id = u.id
    SET u.privacy_score = GREATEST(0, LEAST(100,
        100 - (COALESCE(wp.weak_passwords, 0) * 10) - (COALESCE(sv.suspicious_visits, 0) * 5) + (CASE WHEN u.two_factor_enabled THEN 20 ELSE 0 END)
    )),
    u.security_level = CASE
        WHEN (100 - (COALESCE(wp.weak_passwords, 0) * 10) - (COALESCE(sv.suspicious_visits, 0) * 5) + (CASE WHEN u.two_factor_enabled THEN 20 ELSE 0 END)) < 40 THEN 'high-risk'
        WHEN (100 - (COALESCE(wp.weak_passwords, 0) * 10) - (COALESCE(sv.suspicious_visits, 0) * 5) + (CASE WHEN u.two_factor_enabled THEN 20 ELSE 0 END)) < 70 THEN 'warning'
        ELSE 'normal'
    END,
    u.updated_at = CURRENT_TIMESTAMP;

    INSERT INTO privacy_score_history (student_id, privacy_score)
    SELECT id, privacy_score FROM students;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_sleuth_refine_url` (IN `p_url` VARCHAR(2048), IN `p_is_suspicious` BOOLEAN, IN `p_category` VARCHAR(32), IN `p_threat_intel` JSON, IN `p_source` VARCHAR(64))   BEGIN
    INSERT INTO web_filter_list (url, category, status, threat_intel, refined_by, last_refined_at)
    VALUES (
        p_url,
        CASE
            WHEN p_category IS NULL OR p_category = '' THEN 'Unknown'
            WHEN p_category IN ('Phishing','Social','Safe') THEN p_category
            ELSE 'Unknown'
        END,
        CASE WHEN p_is_suspicious THEN 'Blocked' ELSE 'Allowed' END,
        p_threat_intel,
        'sleuth',
        NOW()
    )
    ON DUPLICATE KEY UPDATE
        category = VALUES(category),
        status = VALUES(status),
        threat_intel = VALUES(threat_intel),
        refined_by = 'sleuth',
        last_refined_at = NOW();

    INSERT INTO blocked_sites (url, status, threat_intel, source)
    VALUES (
        p_url,
        CASE WHEN p_is_suspicious THEN 'Blocked' ELSE 'Pending' END,
        p_threat_intel,
        p_source
    )
    ON DUPLICATE KEY UPDATE
        status = VALUES(status),
        threat_intel = VALUES(threat_intel),
        source = VALUES(source),
        updated_at = CURRENT_TIMESTAMP;
END$$

CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_sleuth_scan_unknown_urls` ()   BEGIN
    INSERT IGNORE INTO web_filter_list (url, category, status, refined_by, last_refined_at)
    SELECT DISTINCT sa.url, 'Unknown', 'Pending', 'sleuth', NOW()
    FROM student_activity sa
    LEFT JOIN web_filter_list wfl ON wfl.url = sa.url
    WHERE wfl.url IS NULL;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `admin_id` varchar(64) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `role` enum('admin','super-admin') NOT NULL DEFAULT 'admin',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admins`
--

INSERT INTO `admins` (`id`, `admin_id`, `email`, `password_hash`, `name`, `role`, `created_at`, `updated_at`) VALUES
(1, '01', 'admin@gmail.com', '$2a$12$iWtuaXAHxtcZ0.CXk2.nh.wD3X78BHEtU6lQVwqA5wi8g0V6I1ftO', 'admin', 'admin', '2026-02-05 09:27:39', '2026-02-05 09:27:39');

-- --------------------------------------------------------

--
-- Table structure for table `admin_reports`
--

CREATE TABLE `admin_reports` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_id` bigint(20) UNSIGNED NOT NULL,
  `action` varchar(64) NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `report_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`report_json`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admin_reports`
--

INSERT INTO `admin_reports` (`id`, `student_id`, `action`, `reason`, `report_json`, `created_at`) VALUES
(1, 1, 'revoke_access', 'Manual admin revoke', '{\"revoked_sessions\": \"1\", \"revoked_tokens\": \"1\"}', '2026-02-05 10:30:45'),
(2, 1, 'restore_access', 'Admin restore from console', '{\"status\": \"restored\"}', '2026-02-05 10:31:29');

-- --------------------------------------------------------

--
-- Table structure for table `auth_logs`
--

CREATE TABLE `auth_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_id` bigint(20) UNSIGNED NOT NULL,
  `event_type` varchar(64) NOT NULL,
  `success` tinyint(1) NOT NULL DEFAULT 1,
  `ip_address` varchar(64) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auth_tokens`
--

CREATE TABLE `auth_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_id` bigint(20) UNSIGNED DEFAULT NULL,
  `admin_id` bigint(20) UNSIGNED DEFAULT NULL,
  `token` varchar(512) NOT NULL,
  `status` enum('active','revoked') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `auth_tokens`
--

INSERT INTO `auth_tokens` (`id`, `student_id`, `admin_id`, `token`, `status`, `created_at`, `expires_at`, `revoked_at`) VALUES
(1, 1, NULL, '4393bc78-92bf-4bab-8df1-d928ffea8e30', 'revoked', '2026-02-05 09:58:22', NULL, '2026-02-05 09:59:12'),
(2, 1, NULL, '96543ddb-1099-4f6e-b335-f2f3ae45892f', 'revoked', '2026-02-05 09:59:12', NULL, '2026-02-05 10:23:39'),
(3, 1, NULL, 'e06578d0-e690-44a0-9289-7432036b6355', 'revoked', '2026-02-05 10:23:39', NULL, '2026-02-05 10:30:45'),
(4, 1, NULL, 'c9803c17-1cdb-4f43-ae5f-50300405db4c', 'active', '2026-02-05 10:31:48', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `blocked_sites`
--

CREATE TABLE `blocked_sites` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `url` varchar(2048) NOT NULL,
  `status` enum('Blocked','Pending','Allowed') NOT NULL DEFAULT 'Pending',
  `threat_intel` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`threat_intel`)),
  `source` varchar(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `blocked_sites`
--

INSERT INTO `blocked_sites` (`id`, `url`, `status`, `threat_intel`, `source`, `created_at`, `updated_at`) VALUES
(1, 'youtube.com', 'Blocked', NULL, 'admin', '2026-02-05 09:30:58', '2026-02-05 10:27:45'),
(2, 'http://localhost:3000/', 'Blocked', '{\"source\":\"admin\",\"reason\":\"Blocked from activity review\"}', 'admin', '2026-02-05 09:43:22', '2026-02-05 09:43:22'),
(3, 'http://localhost:3000/student', 'Blocked', '{\"reason\":\"Insecure protocol (HTTP)\",\"protocol\":\"http\"}', 'extension', '2026-02-05 10:08:13', '2026-02-05 10:08:13'),
(4, 'http://localhost:3000/tools/password-checker', 'Allowed', NULL, 'admin', '2026-02-05 10:14:40', '2026-02-05 10:17:15'),
(5, 'https://www.youtube.com/', 'Blocked', NULL, 'admin', '2026-02-05 10:17:18', '2026-02-05 10:27:45'),
(6, 'https://youtube.com/', 'Allowed', NULL, 'admin', '2026-02-05 10:18:02', '2026-02-05 10:18:02'),
(7, 'www.youtube.com', 'Blocked', NULL, 'admin', '2026-02-05 10:18:42', '2026-02-05 10:27:45'),
(8, 'flipkart.com', 'Allowed', NULL, 'admin', '2026-02-05 10:26:24', '2026-02-05 10:26:24');

-- --------------------------------------------------------

--
-- Table structure for table `password_meta`
--

CREATE TABLE `password_meta` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_id` bigint(20) UNSIGNED NOT NULL,
  `length_check` tinyint(1) NOT NULL DEFAULT 0,
  `complexity_check` tinyint(1) NOT NULL DEFAULT 0,
  `pwned_check` tinyint(1) NOT NULL DEFAULT 0,
  `entropy_score` decimal(6,2) DEFAULT NULL,
  `last_changed` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `privacy_score_history`
--

CREATE TABLE `privacy_score_history` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_id` bigint(20) UNSIGNED NOT NULL,
  `privacy_score` int(11) NOT NULL,
  `recorded_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `privacy_score_history`
--

INSERT INTO `privacy_score_history` (`id`, `student_id`, `privacy_score`, `recorded_at`) VALUES
(113, 1, 100, '2026-02-05 10:28:18'),
(114, 1, 95, '2026-02-05 10:28:39'),
(115, 1, 95, '2026-02-05 10:30:33'),
(116, 1, 95, '2026-02-05 10:30:37'),
(117, 1, 90, '2026-02-05 10:32:09');

-- --------------------------------------------------------

--
-- Table structure for table `security_audit`
--

CREATE TABLE `security_audit` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_id` bigint(20) UNSIGNED NOT NULL,
  `audit_type` varchar(64) NOT NULL,
  `severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `security_audit`
--

INSERT INTO `security_audit` (`id`, `student_id`, `audit_type`, `severity`, `details`, `created_at`) VALUES
(71, 1, 'suspicious_site_visits', 'warning', '{\"count_last_24h\": \"1\"}', '2026-02-05 10:28:39'),
(72, 1, 'suspicious_site_visits', 'warning', '{\"count_last_24h\": \"1\"}', '2026-02-05 10:30:37'),
(73, 1, 'suspicious_site_visits', 'warning', '{\"count_last_24h\": \"2\"}', '2026-02-05 10:32:09');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_id` bigint(20) UNSIGNED DEFAULT NULL,
  `admin_id` bigint(20) UNSIGNED DEFAULT NULL,
  `token` varchar(512) NOT NULL,
  `status` enum('active','revoked') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` timestamp NULL DEFAULT NULL,
  `revoked_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`id`, `student_id`, `admin_id`, `token`, `status`, `created_at`, `expires_at`, `revoked_at`) VALUES
(1, NULL, 1, '97339d85-d819-49f6-b224-d4817ab9cbbd', 'active', '2026-02-05 09:27:39', NULL, NULL),
(2, 1, NULL, 'b77bb9ab-2402-413e-a200-9f9685053ebe', 'revoked', '2026-02-05 09:30:14', NULL, '2026-02-05 10:30:45'),
(3, 1, NULL, '6101211c-e95c-4655-96e5-18e5d7c0f66e', 'active', '2026-02-05 10:31:12', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `students`
--

CREATE TABLE `students` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_id` varchar(64) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `two_factor_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `privacy_score` int(11) NOT NULL DEFAULT 100,
  `security_level` enum('normal','warning','high-risk','revoked') NOT NULL DEFAULT 'normal',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `students`
--

INSERT INTO `students` (`id`, `student_id`, `email`, `password_hash`, `name`, `two_factor_enabled`, `privacy_score`, `security_level`, `created_at`, `updated_at`) VALUES
(1, '01', 'student@gmail.com', '$2a$12$fDxQ2MTVDPIHdAn4iQmOReUVF130OA0a.gnP3A7zmXjp.p8cfmcOy', 'student', 0, 90, 'normal', '2026-02-05 09:30:14', '2026-02-05 10:32:09');

-- --------------------------------------------------------

--
-- Table structure for table `student_activity`
--

CREATE TABLE `student_activity` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `student_id` bigint(20) UNSIGNED NOT NULL,
  `url` varchar(2048) NOT NULL,
  `visited_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_suspicious` tinyint(1) NOT NULL DEFAULT 0,
  `source` varchar(64) DEFAULT NULL,
  `last_vibe_checked` timestamp NULL INVISIBLE DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `student_activity`
--

INSERT INTO `student_activity` (`id`, `student_id`, `url`, `visited_at`, `is_suspicious`, `source`, `last_vibe_checked`) VALUES
(103, 1, 'https://www.youtube.com/', '2026-02-05 10:28:39', 1, 'extension', NULL),
(104, 1, 'https://www.youtube.com/', '2026-02-05 10:32:09', 1, 'extension', NULL);

-- --------------------------------------------------------

--
-- Stand-in structure for view `student_privacy_vibe`
-- (See below for the actual view)
--
CREATE TABLE `student_privacy_vibe` (
`student_id` varchar(64)
,`name` varchar(255)
,`current_privacy_score` int(11)
);

-- --------------------------------------------------------

--
-- Table structure for table `web_filter_list`
--

CREATE TABLE `web_filter_list` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `url` varchar(2048) NOT NULL,
  `category` enum('Phishing','Social','Safe','Unknown') NOT NULL DEFAULT 'Unknown',
  `status` enum('Allowed','Blocked','Pending') NOT NULL DEFAULT 'Pending',
  `threat_intel` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`threat_intel`)),
  `refined_by` varchar(64) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_refined_at` timestamp NULL INVISIBLE DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `web_filter_list`
--

INSERT INTO `web_filter_list` (`id`, `url`, `category`, `status`, `threat_intel`, `refined_by`, `updated_at`, `last_refined_at`) VALUES
(2, 'https://www.youtube.com/', 'Unknown', 'Blocked', NULL, 'admin', '2026-02-05 10:27:45', '2026-02-05 10:27:45'),
(11, 'http://localhost:3000/student', 'Unknown', 'Allowed', '{\"reason\":\"Insecure protocol (HTTP)\",\"protocol\":\"http\"}', 'extension', '2026-02-05 10:09:12', NULL),
(12, 'http://localhost:3000/tools/password-checker', 'Unknown', 'Allowed', NULL, 'admin', '2026-02-05 10:17:15', '2026-02-05 10:17:15'),
(13, 'https://youtube.com/', 'Unknown', 'Allowed', NULL, 'admin', '2026-02-05 10:18:02', '2026-02-05 10:18:02'),
(14, 'www.youtube.com', 'Unknown', 'Blocked', NULL, 'admin', '2026-02-05 10:27:45', '2026-02-05 10:27:45'),
(15, 'flipkart.com', 'Unknown', 'Allowed', NULL, 'admin', '2026-02-05 10:26:24', '2026-02-05 10:26:24'),
(16, 'youtube.com', 'Unknown', 'Blocked', NULL, 'admin', '2026-02-05 10:27:45', '2026-02-05 10:27:45');

-- --------------------------------------------------------

--
-- Structure for view `student_privacy_vibe`
--
DROP TABLE IF EXISTS `student_privacy_vibe`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `student_privacy_vibe`  AS SELECT `u`.`student_id` AS `student_id`, `u`.`name` AS `name`, `u`.`privacy_score` AS `current_privacy_score` FROM `students` AS `u` ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `admin_id` (`admin_id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `admin_reports`
--
ALTER TABLE `admin_reports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_admin_reports_student_time` (`student_id`,`created_at`);

--
-- Indexes for table `auth_logs`
--
ALTER TABLE `auth_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_auth_logs_student` (`student_id`);

--
-- Indexes for table `auth_tokens`
--
ALTER TABLE `auth_tokens`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_auth_tokens_student_status` (`student_id`,`status`),
  ADD KEY `idx_auth_tokens_admin_status` (`admin_id`,`status`);

--
-- Indexes for table `blocked_sites`
--
ALTER TABLE `blocked_sites`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `url` (`url`) USING HASH;

--
-- Indexes for table `password_meta`
--
ALTER TABLE `password_meta`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_password_meta_student` (`student_id`);

--
-- Indexes for table `privacy_score_history`
--
ALTER TABLE `privacy_score_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_privacy_score_history_student_time` (`student_id`,`recorded_at`);

--
-- Indexes for table `security_audit`
--
ALTER TABLE `security_audit`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_security_audit_student_time` (`student_id`,`created_at`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sessions_student_status` (`student_id`,`status`),
  ADD KEY `idx_sessions_admin_status` (`admin_id`,`status`);

--
-- Indexes for table `students`
--
ALTER TABLE `students`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `student_id` (`student_id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `student_activity`
--
ALTER TABLE `student_activity`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_student_activity_student_time` (`student_id`,`visited_at`),
  ADD KEY `idx_student_activity_suspicious_time` (`is_suspicious`,`visited_at`);

--
-- Indexes for table `web_filter_list`
--
ALTER TABLE `web_filter_list`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `url` (`url`) USING HASH,
  ADD KEY `idx_web_filter_status` (`status`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admins`
--
ALTER TABLE `admins`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `admin_reports`
--
ALTER TABLE `admin_reports`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `auth_logs`
--
ALTER TABLE `auth_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auth_tokens`
--
ALTER TABLE `auth_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `blocked_sites`
--
ALTER TABLE `blocked_sites`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `password_meta`
--
ALTER TABLE `password_meta`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `privacy_score_history`
--
ALTER TABLE `privacy_score_history`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=118;

--
-- AUTO_INCREMENT for table `security_audit`
--
ALTER TABLE `security_audit`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=74;

--
-- AUTO_INCREMENT for table `sessions`
--
ALTER TABLE `sessions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `students`
--
ALTER TABLE `students`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `student_activity`
--
ALTER TABLE `student_activity`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=105;

--
-- AUTO_INCREMENT for table `web_filter_list`
--
ALTER TABLE `web_filter_list`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `admin_reports`
--
ALTER TABLE `admin_reports`
  ADD CONSTRAINT `fk_admin_reports_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`);

--
-- Constraints for table `auth_logs`
--
ALTER TABLE `auth_logs`
  ADD CONSTRAINT `fk_auth_logs_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`);

--
-- Constraints for table `auth_tokens`
--
ALTER TABLE `auth_tokens`
  ADD CONSTRAINT `fk_auth_tokens_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`),
  ADD CONSTRAINT `fk_auth_tokens_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`);

--
-- Constraints for table `password_meta`
--
ALTER TABLE `password_meta`
  ADD CONSTRAINT `fk_password_meta_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`);

--
-- Constraints for table `privacy_score_history`
--
ALTER TABLE `privacy_score_history`
  ADD CONSTRAINT `fk_privacy_score_history_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`);

--
-- Constraints for table `security_audit`
--
ALTER TABLE `security_audit`
  ADD CONSTRAINT `fk_security_audit_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`);

--
-- Constraints for table `sessions`
--
ALTER TABLE `sessions`
  ADD CONSTRAINT `fk_sessions_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`),
  ADD CONSTRAINT `fk_sessions_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`);

--
-- Constraints for table `student_activity`
--
ALTER TABLE `student_activity`
  ADD CONSTRAINT `fk_student_activity_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`);

DELIMITER $$
--
-- Events
--
CREATE DEFINER=`root`@`localhost` EVENT `ev_guardian_daily_vibe_check` ON SCHEDULE EVERY 1 DAY STARTS '2026-02-05 02:00:00' ON COMPLETION NOT PRESERVE ENABLE DO BEGIN
    CALL sp_guardian_vibe_check_all();
END$$

CREATE DEFINER=`root`@`localhost` EVENT `ev_sleuth_hourly_unknown_scan` ON SCHEDULE EVERY 1 HOUR STARTS '2026-02-05 14:47:59' ON COMPLETION NOT PRESERVE ENABLE DO BEGIN
    CALL sp_sleuth_scan_unknown_urls();
END$$

DELIMITER ;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
