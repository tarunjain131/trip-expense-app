import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authSecret, safeNextPath, verifySessionToken } from "@/lib/auth";

const PUBLIC_PAGES = new Set(["/login", "/signup"]);

/** Everything except the login/signup pages requires a validly signed session cookie. */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authed = authSecret() !== null && (await verifySessionToken(request.cookies.get(AUTH_COOKIE)?.value)) !== null;

  // Logged-in visitors are bounced from these pages by the pages themselves (they can check the user still exists).
  if (PUBLIC_PAGES.has(pathname)) return NextResponse.next();
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
