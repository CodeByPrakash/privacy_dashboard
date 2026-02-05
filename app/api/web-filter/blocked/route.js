import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function GET(request) {
  const key = request.headers.get("x-extension-key") || "";
  const expected = process.env.EXTENSION_API_KEY || "";
  if (!expected || key !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT url FROM web_filter_list WHERE status = 'Blocked' ORDER BY updated_at DESC LIMIT 1000"
  );

  return NextResponse.json({
    blocked: rows.map((row) => row.url)
  });
}