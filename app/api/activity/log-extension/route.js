import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function POST(request) {
  const key = request.headers.get("x-extension-key") || "";
  const expected = process.env.EXTENSION_API_KEY || "";
  if (!expected || key !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { url, token } = body || {};

  if (!url || !token) {
    return NextResponse.json({ error: "url and token required" }, { status: 400 });
  }

  const pool = getPool();
  const [tokenRows] = await pool.query(
    "SELECT student_id FROM auth_tokens WHERE token = ? AND status = 'active' LIMIT 1",
    [token]
  );

  const tokenRow = tokenRows && tokenRows[0];
  if (!tokenRow?.student_id) {
    return NextResponse.json({ error: "Invalid token" }, { status: 403 });
  }

  const isLocalhost = (() => {
    try {
      const parsed = new URL(url);
      return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    } catch {
      return false;
    }
  })();

  if (isLocalhost) {
    return NextResponse.json({
      status: "ok",
      allowed: true,
      reason: "Localhost allowed"
    });
  }

  const normalizedHost = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      try {
        return new URL(`https://${url}`).hostname;
      } catch {
        return null;
      }
    }
  })();
  const baseHost = normalizedHost?.startsWith("www.")
    ? normalizedHost.slice(4)
    : normalizedHost || null;

  let entry = null;
  let rows = [];

  [rows] = await pool.query(
    "SELECT status, threat_intel FROM web_filter_list WHERE url = ? LIMIT 1",
    [url]
  );
  entry = rows && rows[0];

  if (!entry && normalizedHost) {
    [rows] = await pool.query(
      "SELECT status, threat_intel FROM web_filter_list WHERE url IN (?, ?) OR url LIKE CONCAT('http://', ?, '/%') OR url LIKE CONCAT('https://', ?, '/%') LIMIT 1",
      [normalizedHost, baseHost || normalizedHost, normalizedHost, normalizedHost]
    );
    entry = rows && rows[0];
  }
  const isInsecure = typeof url === "string" && url.startsWith("http://");
  const status = entry?.status || "Pending";
  const isSuspicious = status === "Blocked" || isInsecure;

  await pool.query(
    "INSERT INTO student_activity (student_id, url, is_suspicious, source) VALUES (?, ?, ?, 'extension')",
    [tokenRow.student_id, url, isSuspicious]
  );

  if (!entry && isInsecure) {
    const threatIntel = JSON.stringify({ reason: "Insecure protocol (HTTP)", protocol: "http" });
    await pool.query(
      "INSERT IGNORE INTO web_filter_list (url, category, status, threat_intel, refined_by, last_refined_at) VALUES (?, 'Unknown', 'Blocked', ?, 'extension', NOW())",
      [url, threatIntel]
    );
    await pool.query(
      "INSERT INTO blocked_sites (url, status, threat_intel, source) VALUES (?, 'Blocked', ?, 'extension') " +
        "ON DUPLICATE KEY UPDATE status = VALUES(status), threat_intel = VALUES(threat_intel), source = 'extension', updated_at = CURRENT_TIMESTAMP",
      [url, threatIntel]
    );
  } else if (!entry) {
    await pool.query(
      "INSERT IGNORE INTO web_filter_list (url, category, status, refined_by, last_refined_at) VALUES (?, 'Unknown', 'Pending', 'extension', NOW())",
      [url]
    );
  }

  await pool.query("CALL sp_guardian_vibe_check(?)", [tokenRow.student_id]);

  return NextResponse.json({
    status: "ok",
    allowed: !isSuspicious,
    reason: isInsecure
      ? "Insecure protocol (HTTP)"
      : entry?.threat_intel
        ? "Flagged by threat intel"
        : "No threat intel"
  });
}
