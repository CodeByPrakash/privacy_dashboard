-- Scheduled events (enable event_scheduler)

SET GLOBAL event_scheduler = ON;

DELIMITER //

CREATE EVENT IF NOT EXISTS ev_guardian_daily_vibe_check
ON SCHEDULE EVERY 1 DAY
STARTS (CURRENT_DATE + INTERVAL 2 HOUR)
DO
BEGIN
    CALL sp_guardian_vibe_check_all();
END//

CREATE EVENT IF NOT EXISTS ev_sleuth_hourly_unknown_scan
ON SCHEDULE EVERY 1 HOUR
STARTS (CURRENT_TIMESTAMP + INTERVAL 5 MINUTE)
DO
BEGIN
    CALL sp_sleuth_scan_unknown_urls();
END//

DELIMITER ;
