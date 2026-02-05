import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getRequestAuth, assertActiveSession } from "@/lib/auth";

export async function GET(request) {
  const auth = await getRequestAuth(request);
  if (!auth.userId) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const pool = getPool();
  try {
    await assertActiveSession(pool, auth.sessionId);
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  let rows = [];
  if (auth.role === "admin" || auth.role === "super-admin") {
    [rows] = await pool.query(
      "SELECT id, admin_id, name, role FROM admins WHERE id = ? LIMIT 1",
      [auth.userId]
    );
  } else {
    [rows] = await pool.query(
      "SELECT id, student_id, name FROM students WHERE id = ? LIMIT 1",
      [auth.userId]
    );
  }

  const user = rows && rows[0];
  return NextResponse.json({
    user: user
      ? {
          id: user.id,
          studentId: user.student_id || user.admin_id,
          name: user.name,
          role: user.role || "student"
        }
      : null
  });
}
