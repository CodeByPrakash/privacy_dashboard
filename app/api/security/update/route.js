import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
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

  const body = await request.json().catch(() => ({}));
  const { currentPassword, newPassword, confirmPassword } = body || {};

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "All password fields are required" }, { status: 400 });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
  }

  const [rows] = await pool.query(
    "SELECT password_hash FROM students WHERE id = ? LIMIT 1",
    [auth.userId]
  );

  const student = rows && rows[0];
  if (!student?.password_hash) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const matches = await bcrypt.compare(currentPassword, student.password_hash);
  if (!matches) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await pool.query(
    "UPDATE students SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [passwordHash, auth.userId]
  );

  await pool.query(
    "INSERT INTO password_meta (student_id, last_changed) VALUES (?, CURRENT_DATE)",
    [auth.userId]
  );

  return NextResponse.json({ status: "ok" });
}
