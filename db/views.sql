-- Views for Privacy Dashboard

CREATE OR REPLACE VIEW student_privacy_vibe AS
SELECT 
    u.student_id,
    u.name,
    u.privacy_score AS current_privacy_score
FROM students u;
