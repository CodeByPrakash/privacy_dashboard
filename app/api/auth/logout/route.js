import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { getRequestAuth } from "@/lib/auth";

export async function POST(request) {
  const auth = await getRequestAuth(request);

  if (auth?.sessionId) {
    const pool = getPool();
    await pool.query(
      "UPDATE sessions SET status = 'revoked', revoked_at = NOW() WHERE token = ?",
      [auth.sessionId]
    );
  }

  const response = NextResponse.json({ status: "ok" });
  response.cookies.set({
    name: "pd_session",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });

  return response;
}
