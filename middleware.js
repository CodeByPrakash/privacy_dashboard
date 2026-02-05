import { NextResponse } from "next/server";
import { verifyJwt } from "./lib/jwt";

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("pd_session")?.value;
  let role = "guest";

  if (token) {
    try {
      const { payload } = await verifyJwt(token);
      role = payload.role || "guest";
    } catch {
      role = "guest";
    }
  }

  if (pathname.startsWith("/api/enforcer") || pathname.startsWith("/api/admin")) {
    if (role !== "admin" && role !== "super-admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (pathname.startsWith("/student")) {
    const url = request.nextUrl.clone();
    if (role === "guest") {
      url.pathname = "/auth/signin";
      return NextResponse.redirect(url);
    }
    if (role === "admin" || role === "super-admin") {
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/security/update") && role === "guest") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/enforcer/:path*", "/api/admin/:path*", "/student/:path*", "/security/update/:path*"]
};
