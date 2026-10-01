import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authMode, safeNextPath, verifySessionToken } from "@/lib/auth";

/** Everything except /login requires a valid session cookie. */
export async function proxy(request: NextRequest) {
  const mode = authMode();
  if (mode === "disabled") return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const authed = mode === "enabled" && (await verifySessionToken(request.cookies.get(AUTH_COOKIE)?.value));

  if (pathname === "/login") {
    return authed ? NextResponse.redirect(new URL("/trips", request.url)) : NextResponse.next();
  }
  if (authed) return NextResponse.next();

  // Server Action calls are POSTs: answer with 401 rather than an HTML redirect.
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const login = new URL("/login", request.url);
  const next = safeNextPath(pathname + search);
  if (next !== "/trips") login.searchParams.set("next", next);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip static assets and the public icons/manifest (needed by the login page itself).
  matcher: ["/((?!_next/static|_next/image|manifest.webmanifest|icon|apple-icon|pwa-icon|favicon.ico).*)"],
};
