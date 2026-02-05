import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getRequestAuth, requireRole, assertActiveSession } from "@/lib/auth";

export async function POST(request) {
  const auth = await getRequestAuth(request);
  const pool = getPool();
  try {
    if (!auth || !["admin", "super-admin"].includes(auth.role)) {
      requireRole("super-admin", auth);
    }
    await assertActiveSession(pool, auth.sessionId);
  } catch (error) {
    const status = error.status || 403;
    return NextResponse.json({ error: error.message || "Forbidden" }, { status });
  }

  const body = await request.json().catch(() => ({}));
  const { url, status, category, threatIntel } = body || {};

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  if (!status || !["Allowed", "Blocked", "Pending"].includes(status)) {
    return NextResponse.json({ error: "status must be Allowed, Blocked, or Pending" }, { status: 400 });
  }

  const normalizedHost = (() => {
    try {
      const parsed = new URL(url);
      return parsed.hostname || null;
    } catch {
      try {
        const parsed = new URL(`https://${url}`);
        return parsed.hostname || null;
      } catch {
        return null;
      }
    }
  })();
  const baseHost = normalizedHost?.startsWith("www.")
    ? normalizedHost.slice(4)
    : normalizedHost || null;

  await pool.query(
    "INSERT INTO web_filter_list (url, category, status, threat_intel, refined_by, last_refined_at) VALUES (?, ?, ?, ?, 'admin', NOW()) " +
      "ON DUPLICATE KEY UPDATE category = VALUES(category), status = VALUES(status), threat_intel = VALUES(threat_intel), refined_by = 'admin', last_refined_at = NOW()",
    [
      url,
      category && ["Phishing", "Social", "Safe", "Unknown"].includes(category) ? category : "Unknown",
      status,
      threatIntel ? JSON.stringify(threatIntel) : null
    ]
  );

  if (normalizedHost && normalizedHost !== url) {
    await pool.query(
      "INSERT INTO web_filter_list (url, category, status, threat_intel, refined_by, last_refined_at) VALUES (?, ?, ?, ?, 'admin', NOW()) " +
        "ON DUPLICATE KEY UPDATE category = VALUES(category), status = VALUES(status), threat_intel = VALUES(threat_intel), refined_by = 'admin', last_refined_at = NOW()",
      [
        normalizedHost,
        category && ["Phishing", "Social", "Safe", "Unknown"].includes(category) ? category : "Unknown",
        status,
        threatIntel ? JSON.stringify(threatIntel) : null
      ]
    );
  }

  if (baseHost && baseHost !== normalizedHost && baseHost !== url) {
    await pool.query(
      "INSERT INTO web_filter_list (url, category, status, threat_intel, refined_by, last_refined_at) VALUES (?, ?, ?, ?, 'admin', NOW()) " +
        "ON DUPLICATE KEY UPDATE category = VALUES(category), status = VALUES(status), threat_intel = VALUES(threat_intel), refined_by = 'admin', last_refined_at = NOW()",
      [
        baseHost,
        category && ["Phishing", "Social", "Safe", "Unknown"].includes(category) ? category : "Unknown",
        status,
        threatIntel ? JSON.stringify(threatIntel) : null
      ]
    );
  }

  await pool.query(
    "INSERT INTO blocked_sites (url, status, threat_intel, source) VALUES (?, ?, ?, 'admin') " +
      "ON DUPLICATE KEY UPDATE status = VALUES(status), threat_intel = VALUES(threat_intel), source = 'admin', updated_at = CURRENT_TIMESTAMP",
    [url, status, threatIntel ? JSON.stringify(threatIntel) : null]
  );

  if (normalizedHost && normalizedHost !== url) {
    await pool.query(
      "INSERT INTO blocked_sites (url, status, threat_intel, source) VALUES (?, ?, ?, 'admin') " +
        "ON DUPLICATE KEY UPDATE status = VALUES(status), threat_intel = VALUES(threat_intel), source = 'admin', updated_at = CURRENT_TIMESTAMP",
      [normalizedHost, status, threatIntel ? JSON.stringify(threatIntel) : null]
    );
  }

  if (baseHost && baseHost !== normalizedHost && baseHost !== url) {
    await pool.query(
      "INSERT INTO blocked_sites (url, status, threat_intel, source) VALUES (?, ?, ?, 'admin') " +
        "ON DUPLICATE KEY UPDATE status = VALUES(status), threat_intel = VALUES(threat_intel), source = 'admin', updated_at = CURRENT_TIMESTAMP",
      [baseHost, status, threatIntel ? JSON.stringify(threatIntel) : null]
    );
  }

  if (status === "Blocked" || status === "Allowed") {
    const suspiciousFlag = status === "Blocked" ? 1 : 0;
    await pool.query(
      "UPDATE student_activity SET is_suspicious = ? WHERE url = ?",
      [suspiciousFlag, url]
    );

    const [affectedStudents] = await pool.query(
      "SELECT DISTINCT student_id FROM student_activity WHERE url = ?",
      [url]
    );

    for (const row of affectedStudents) {
      await pool.query("CALL sp_guardian_vibe_check(?)", [row.student_id]);
    }
  }

  return NextResponse.json({ status: "ok", url, updated: status });
}
