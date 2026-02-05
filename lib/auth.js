import { verifyJwt } from "./jwt";

export async function getRequestAuth(request) {
  const cookie = request.cookies?.get("pd_session")?.value;
  if (!cookie) {
    return { role: "guest", userId: null, sessionId: null };
  }

  try {
    const { payload } = await verifyJwt(cookie);
    return {
      role: payload.role || "guest",
      userId: payload.userId || null,
      sessionId: payload.jti || null
    };
  } catch {
    return { role: "guest", userId: null, sessionId: null };
  }
}

export async function getAuthFromCookieValue(cookieValue) {
  if (!cookieValue) {
    return { role: "guest", userId: null, sessionId: null };
  }

  try {
    const { payload } = await verifyJwt(cookieValue);
    return {
      role: payload.role || "guest",
      userId: payload.userId || null,
      sessionId: payload.jti || null
    };
  } catch {
    return { role: "guest", userId: null, sessionId: null };
  }
}

export function requireRole(role, auth) {
  if (!auth || auth.role !== role) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }
}

export async function assertActiveSession(pool, sessionId) {
  if (!sessionId) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }

  const [rows] = await pool.query(
    "SELECT id FROM sessions WHERE token = ? AND status = 'active' LIMIT 1",
    [sessionId]
  );

  if (!rows || rows.length === 0) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }
}
