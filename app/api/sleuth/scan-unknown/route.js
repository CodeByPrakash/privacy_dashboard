import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function POST() {
  const pool = getPool();
  await pool.query("CALL sp_sleuth_scan_unknown_urls()");

  return NextResponse.json({ status: "ok" });
}
