import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function POST(request, { params }) {
  const studentId = Number(params.studentId);
  if (!Number.isInteger(studentId)) {
    return NextResponse.json({ error: "Invalid studentId" }, { status: 400 });
  }

  const pool = getPool();
  await pool.query("CALL sp_guardian_vibe_check(?)", [studentId]);

  return NextResponse.json({ status: "ok", studentId });
}
