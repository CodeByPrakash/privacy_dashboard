import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getRequestAuth, assertActiveSession } from "@/lib/auth";

export async function POST(request) {
  const auth = await getRequestAuth(request);
  if (!auth.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { url } = body || {};

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const pool = getPool();
  try {
    await assertActiveSession(pool, auth.sessionId);
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      allowed: true,
      status: "Allowed",
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
    "SELECT status, category, threat_intel FROM web_filter_list WHERE url = ? LIMIT 1",
    [url]
  );
  entry = rows && rows[0];

  if (!entry && normalizedHost) {
    [rows] = await pool.query(
      "SELECT status, category, threat_intel FROM web_filter_list WHERE url IN (?, ?) OR url LIKE CONCAT('http://', ?, '/%') OR url LIKE CONCAT('https://', ?, '/%') LIMIT 1",
      [normalizedHost, baseHost || normalizedHost, normalizedHost, normalizedHost]
    );
    entry = rows && rows[0];
  }
  const isInsecure = typeof url === "string" && url.startsWith("http://");
  const status = entry?.status || "Pending";
  const isSuspicious = status === "Blocked" || isInsecure;

  if (!entry && isInsecure) {
    const threatIntel = JSON.stringify({ reason: "Insecure protocol (HTTP)", protocol: "http" });
    await pool.query(
      "INSERT IGNORE INTO web_filter_list (url, category, status, threat_intel, refined_by, last_refined_at) VALUES (?, 'Unknown', 'Blocked', ?, 'guardian', NOW())",
      [url, threatIntel]
    );
    await pool.query(
      "INSERT INTO blocked_sites (url, status, threat_intel, source) VALUES (?, 'Blocked', ?, 'guardian') " +
        "ON DUPLICATE KEY UPDATE status = VALUES(status), threat_intel = VALUES(threat_intel), source = 'guardian', updated_at = CURRENT_TIMESTAMP",
      [url, threatIntel]
    );
  } else if (!entry) {
    await pool.query(
      "INSERT IGNORE INTO web_filter_list (url, category, status, refined_by, last_refined_at) VALUES (?, 'Unknown', 'Pending', 'guardian', NOW())",
      [url]
    );
  }

  return NextResponse.json({
    allowed: !isSuspicious,
    status: isInsecure ? "Blocked" : status,
    reason: isInsecure
      ? "Insecure protocol (HTTP)"
      : entry?.threat_intel
        ? "Flagged by threat intel"
        : "No threat intel"
  });
}
