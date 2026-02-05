import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { url, isSuspicious, category, threatIntel, source } = body || {};

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const pool = getPool();
  await pool.query("CALL sp_sleuth_refine_url(?, ?, ?, ?, ?)", [
    url,
    Boolean(isSuspicious),
    category || null,
    threatIntel ? JSON.stringify(threatIntel) : null,
    source || null
  ]);

  return NextResponse.json({ status: "ok", url });
}
