import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Route-level gate: anything under (dashboard) or (mobile) requires a
// signed-in session. Fine-grained permission checks (per role) happen
// inside each route/server action via lib/authorize.ts — this middleware
// only blocks anonymous access.
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthRoute =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/api/auth");

  if (isAuthRoute) return NextResponse.next();

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
