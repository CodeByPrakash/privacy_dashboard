import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getRequestAuth, requireRole, assertActiveSession } from "@/lib/auth";

export async function POST(request, { params }) {
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

  const studentId = Number(params.id);
  if (!Number.isInteger(studentId)) {
    return NextResponse.json({ error: "Invalid student id" }, { status: 400 });
  }

  const [activityResult] = await pool.query(
    "DELETE FROM student_activity WHERE student_id = ?",
    [studentId]
  );

  const [scoreResult] = await pool.query(
    "DELETE FROM privacy_score_history WHERE student_id = ?",
    [studentId]
  );

  const [auditResult] = await pool.query(
    "DELETE FROM security_audit WHERE student_id = ?",
    [studentId]
  );

  await pool.query("CALL sp_guardian_vibe_check(?)", [studentId]);

  return NextResponse.json({
    status: "ok",
    studentId,
    deleted: {
      activity: activityResult.affectedRows || 0,
      history: scoreResult.affectedRows || 0,
      audit: auditResult.affectedRows || 0
    }
  });
}
