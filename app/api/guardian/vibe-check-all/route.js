import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function POST() {
  const pool = getPool();
  await pool.query("CALL sp_guardian_vibe_check_all()");

  return NextResponse.json({ status: "ok" });
}
