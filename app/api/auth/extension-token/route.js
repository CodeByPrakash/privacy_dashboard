import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getRequestAuth, assertActiveSession } from "@/lib/auth";

export async function POST(request) {
  const auth = await getRequestAuth(request);
  const pool = getPool();

  try {
    await assertActiveSession(pool, auth.sessionId);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }

  if (!auth.userId || auth.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = crypto.randomUUID();

  await pool.query(
    "UPDATE auth_tokens SET status = 'revoked', revoked_at = NOW() WHERE student_id = ? AND status = 'active'",
    [auth.userId]
  );

  await pool.query(
    "INSERT INTO auth_tokens (student_id, token, status, created_at) VALUES (?, ?, 'active', NOW())",
    [auth.userId, token]
  );

  return NextResponse.json({ status: "ok", token });
}

export async function GET(request) {
  const auth = await getRequestAuth(request);
  const pool = getPool();

  try {
    await assertActiveSession(pool, auth.sessionId);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }

  if (!auth.userId || auth.role !== "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [rows] = await pool.query(
    "SELECT token FROM auth_tokens WHERE student_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [auth.userId]
  );

  const row = rows && rows[0];
  return NextResponse.json({ status: "ok", token: row?.token || null });
}
