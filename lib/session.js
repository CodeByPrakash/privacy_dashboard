import { signJwt } from "./jwt";

export async function createSession(pool, user) {
  const sessionId = crypto.randomUUID();
  const isAdmin = user?.role && user.role !== "student";
  await pool.query(
    "INSERT INTO sessions (student_id, admin_id, token, status) VALUES (?, ?, ?, 'active')",
    [isAdmin ? null : user.id, isAdmin ? user.id : null, sessionId]
  );

  const token = await signJwt({
    userId: user.id,
    role: user.role,
    jti: sessionId
  });

  return { token, sessionId };
}
