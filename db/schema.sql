-- Privacy Dashboard schema (MySQL 8.0)

CREATE TABLE IF NOT EXISTS students (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    student_id VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    name VARCHAR(255) NOT NULL,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    privacy_score INT NOT NULL DEFAULT 100,
    security_level ENUM('normal','warning','high-risk','revoked') NOT NULL DEFAULT 'normal',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admins (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    admin_id VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(255) NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('admin','super-admin') NOT NULL DEFAULT 'admin',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS password_meta (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    student_id BIGINT UNSIGNED NOT NULL,
    length_check BOOLEAN NOT NULL DEFAULT FALSE,
    complexity_check BOOLEAN NOT NULL DEFAULT FALSE,
    pwned_check BOOLEAN NOT NULL DEFAULT FALSE,
    entropy_score DECIMAL(6,2) NULL,
    last_changed DATE NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_password_meta_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_logs (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    student_id BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auth_logs_student FOREIGN KEY (student_id) REFERENCES students(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS student_activity (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    student_id BIGINT UNSIGNED NOT NULL,
    url VARCHAR(2048) NOT NULL,
    visited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_suspicious BOOLEAN NOT NULL DEFAULT FALSE,
    source VARCHAR(64) NULL,
    last_vibe_checked TIMESTAMP NULL INVISIBLE,
    CONSTRAINT fk_student_activity_student FOREIGN KEY (student_id) REFERENCES students(id),
    INDEX idx_student_activity_student_time (student_id, visited_at),
    INDEX idx_student_activity_suspicious_time (is_suspicious, visited_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS web_filter_list (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    url VARCHAR(2048) NOT NULL UNIQUE,
    category ENUM('Phishing','Social','Safe','Unknown') NOT NULL DEFAULT 'Unknown',
    status ENUM('Allowed','Blocked','Pending') NOT NULL DEFAULT 'Pending',
    threat_intel JSON NULL,
    refined_by VARCHAR(64) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_refined_at TIMESTAMP NULL INVISIBLE,
    INDEX idx_web_filter_status (status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS blocked_sites (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    url VARCHAR(2048) NOT NULL UNIQUE,
    status ENUM('Blocked','Pending','Allowed') NOT NULL DEFAULT 'Pending',
    threat_intel JSON NULL,
    source VARCHAR(64) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    student_id BIGINT UNSIGNED NULL,
    admin_id BIGINT UNSIGNED NULL,
    token VARCHAR(512) NOT NULL,
    status ENUM('active','revoked') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    revoked_at TIMESTAMP NULL,
    CONSTRAINT fk_sessions_student FOREIGN KEY (student_id) REFERENCES students(id),
    CONSTRAINT fk_sessions_admin FOREIGN KEY (admin_id) REFERENCES admins(id),
    INDEX idx_sessions_student_status (student_id, status),
    INDEX idx_sessions_admin_status (admin_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS auth_tokens (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    student_id BIGINT UNSIGNED NULL,
    admin_id BIGINT UNSIGNED NULL,
    token VARCHAR(512) NOT NULL,
    status ENUM('active','revoked') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    revoked_at TIMESTAMP NULL,
    CONSTRAINT fk_auth_tokens_student FOREIGN KEY (student_id) REFERENCES students(id),
    CONSTRAINT fk_auth_tokens_admin FOREIGN KEY (admin_id) REFERENCES admins(id),
    INDEX idx_auth_tokens_student_status (student_id, status),
    INDEX idx_auth_tokens_admin_status (admin_id, status)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS security_audit (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    student_id BIGINT UNSIGNED NOT NULL,
    audit_type VARCHAR(64) NOT NULL,
    severity ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
    details JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_security_audit_student FOREIGN KEY (student_id) REFERENCES students(id),
    INDEX idx_security_audit_student_time (student_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_reports (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    student_id BIGINT UNSIGNED NOT NULL,
    action VARCHAR(64) NOT NULL,
    reason VARCHAR(255) NULL,
    report_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_reports_student FOREIGN KEY (student_id) REFERENCES students(id),
    INDEX idx_admin_reports_student_time (student_id, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS privacy_score_history (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    student_id BIGINT UNSIGNED NOT NULL,
    privacy_score INT NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_privacy_score_history_student FOREIGN KEY (student_id) REFERENCES students(id),
    INDEX idx_privacy_score_history_student_time (student_id, recorded_at)
) ENGINE=InnoDB;
