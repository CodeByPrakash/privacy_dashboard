import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getRequestAuth, assertActiveSession } from "@/lib/auth";

export async function POST(request) {
  const auth = await getRequestAuth(request);
  if (!auth.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pool = getPool();
  try {
    await assertActiveSession(pool, auth.sessionId);
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [result] = await pool.query(
    "DELETE FROM student_activity WHERE student_id = ? AND visited_at >= (NOW() - INTERVAL 24 HOUR)",
    [auth.userId]
  );

  await pool.query("CALL sp_guardian_vibe_check(?)", [auth.userId]);

  return NextResponse.json({ status: "ok", deleted: result.affectedRows || 0 });
}
