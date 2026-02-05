import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { createSession } from "@/lib/session";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { studentId, email, name, password, role, inviteCode } = body || {};

  if (!studentId || !email || !name || !password || !role || !inviteCode) {
    return NextResponse.json(
      { error: "studentId, email, name, password, role, inviteCode required" },
      { status: 400 }
    );
  }

  if (!role || !["admin", "super-admin"].includes(role)) {
    return NextResponse.json({ error: "role must be admin or super-admin" }, { status: 400 });
  }

  const expectedCode = process.env.ADMIN_INVITE_CODE || "";
  if (!expectedCode || inviteCode !== expectedCode) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 403 });
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  const pool = getPool();
  const [existingAdmins] = await pool.query(
    "SELECT id FROM admins WHERE admin_id = ? OR email = ? LIMIT 1",
    [studentId, email]
  );

  if (existingAdmins.length > 0) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.query(
    "INSERT INTO admins (admin_id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)",
    [studentId, email, name, role, passwordHash]
  );

  const user = {
    id: result.insertId,
    admin_id: studentId,
    email,
    name,
    role
  };

  const { token } = await createSession(pool, user);

  const response = NextResponse.json({
    status: "ok",
    user: {
      id: user.id,
      studentId: user.admin_id,
      name: user.name,
      role: user.role
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
