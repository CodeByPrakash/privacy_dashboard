import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { createSession } from "@/lib/session";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { identifier, password } = body || {};

  if (!identifier || !password) {
    return NextResponse.json({ error: "identifier and password required" }, { status: 400 });
  }

  const pool = getPool();
  const [studentRows] = await pool.query(
    "SELECT id, student_id, email, name, password_hash FROM students WHERE student_id = ? OR email = ? LIMIT 1",
    [identifier, identifier]
  );

  let user = studentRows && studentRows[0];
  let role = "student";

  if (!user) {
    const [adminRows] = await pool.query(
      "SELECT id, admin_id, email, name, role, password_hash FROM admins WHERE admin_id = ? OR email = ? LIMIT 1",
      [identifier, identifier]
    );
    user = adminRows && adminRows[0];
    role = user?.role || "admin";
  }

  if (!user || !user.password_hash) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const { token } = await createSession(pool, { ...user, role });

  const response = NextResponse.json({
    status: "ok",
    user: {
      id: user.id,
      studentId: user.student_id || user.admin_id,
      name: user.name,
      role
    }
  });

  response.cookies.set({
    name: "pd_session",
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return response;
}
