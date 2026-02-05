-- Stored procedures for agentic logic (MySQL 8.0)

DELIMITER //

CREATE PROCEDURE sp_guardian_vibe_check(IN p_student_id BIGINT UNSIGNED)
BEGIN
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
END//

CREATE PROCEDURE sp_guardian_vibe_check_all()
BEGIN
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
END//

CREATE PROCEDURE sp_sleuth_refine_url(
    IN p_url VARCHAR(2048),
    IN p_is_suspicious BOOLEAN,
    IN p_category VARCHAR(32),
    IN p_threat_intel JSON,
    IN p_source VARCHAR(64)
)
BEGIN
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
END//

CREATE PROCEDURE sp_sleuth_scan_unknown_urls()
BEGIN
    INSERT IGNORE INTO web_filter_list (url, category, status, refined_by, last_refined_at)
    SELECT DISTINCT sa.url, 'Unknown', 'Pending', 'sleuth', NOW()
    FROM student_activity sa
    LEFT JOIN web_filter_list wfl ON wfl.url = sa.url
    WHERE wfl.url IS NULL;
END//

CREATE PROCEDURE sp_enforcer_revoke_student_access(
    IN p_student_id BIGINT UNSIGNED,
    IN p_reason VARCHAR(255)
)
BEGIN
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
END//

CREATE PROCEDURE sp_enforcer_restore_student_access(
    IN p_student_id BIGINT UNSIGNED,
    IN p_reason VARCHAR(255)
)
BEGIN
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
END//

DELIMITER ;
