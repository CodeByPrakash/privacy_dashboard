import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { createSession } from "@/lib/session";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { studentId, email, name, password } = body || {};

  if (!studentId || !email || !name || !password) {
    return NextResponse.json({ error: "studentId, email, name, and password required" }, { status: 400 });
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
  }

  const pool = getPool();
  const [existingStudents] = await pool.query(
    "SELECT id FROM students WHERE student_id = ? OR email = ? LIMIT 1",
    [studentId, email]
  );

  if (existingStudents.length > 0) {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await pool.query(
    "INSERT INTO students (student_id, email, name, password_hash) VALUES (?, ?, ?, ?)",
    [studentId, email, name, passwordHash]
  );

  const user = {
    id: result.insertId,
    student_id: studentId,
    email,
    name,
    role: "student"
  };

  const { token } = await createSession(pool, user);

  const response = NextResponse.json({
    status: "ok",
    user: {
      id: user.id,
      studentId: user.student_id,
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
