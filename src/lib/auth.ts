/**
 * Minimal shared-password gate. Uses Web Crypto only, so it works in both the proxy and server actions.
 *
 * - APP_PASSWORD: the password people type on /login (required in production).
 * - AUTH_SECRET:  optional extra secret mixed into the session signature.
 *
 * Sessions are stateless: a signed expiry timestamp in an HttpOnly cookie.
 * Changing APP_PASSWORD or AUTH_SECRET signs everyone out.
 */
export const AUTH_COOKIE = "splitrip_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type AuthMode = "disabled" | "enabled" | "misconfigured";

/** Fail closed: in production a missing password locks the app instead of opening it. */
export function authMode(): AuthMode {
  if (process.env.APP_PASSWORD) return "enabled";
  return process.env.NODE_ENV === "production" ? "misconfigured" : "disabled";
}

const encoder = new TextEncoder();

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function sessionSecret(): string {
  return `${process.env.AUTH_SECRET ?? ""}|${process.env.APP_PASSWORD ?? ""}`;
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  // Compare fixed-length digests so neither length nor content leaks through timing.
  const [a, b] = await Promise.all([hmacHex(input, "pw-check"), hmacHex(expected, "pw-check")]);
  return safeEqual(a, b);
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const expires = Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS;
  return `${expires}.${await hmacHex(`v1.${expires}`, sessionSecret())}`;
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  if (!token || authMode() !== "enabled") return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !/^\d+$/.test(expires)) return false;
  if (Number(expires) * 1000 < now) return false;
  return safeEqual(signature, await hmacHex(`v1.${expires}`, sessionSecret()));
}

/** Only allow same-site relative redirects after login. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/login")) return "/trips";
  return next;
}
