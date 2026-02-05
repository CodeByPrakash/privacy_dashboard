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
  const { studentId, reason } = body || {};
  const parsedId = Number(studentId);

  if (!Number.isInteger(parsedId)) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
  }

  await pool.query("CALL sp_enforcer_restore_student_access(?, ?)", [
    parsedId,
    reason || null
  ]);

  return NextResponse.json({ status: "ok", studentId: parsedId });
}
