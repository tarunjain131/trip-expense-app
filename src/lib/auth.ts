/**
 * Session tokens. Uses Web Crypto only, so it works in the proxy and in server code.
 *
 * - AUTH_SECRET: signs the session cookie (required in production; the app locks without it).
 *
 * A session is a stateless, signed `userId.expiry.signature` value in an HttpOnly cookie. Whether the user still
 * exists is checked against the database by `getCurrentUser()` (src/lib/access.ts).
 */
export const AUTH_COOKIE = "splitrip_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const encoder = new TextEncoder();

/** Fail closed: in production a missing secret locks the app instead of using a guessable one. */
export function authSecret(): string | null {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  return process.env.NODE_ENV === "production" ? null : "dev-only-insecure-secret";
}

async function hmacHex(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function createSessionToken(userId: string, now = Date.now()): Promise<string> {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  const expires = Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS;
  return `${userId}.${expires}.${await hmacHex(`v2.${userId}.${expires}`, secret)}`;
}

/** Returns the user id the token was issued to, or null if it is missing, expired or forged. */
export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<string | null> {
  const secret = authSecret();
  if (!token || !secret) return null;
  const [userId, expires, signature] = token.split(".");
  if (!userId || !expires || !signature || !UUID.test(userId) || !/^\d+$/.test(expires)) return null;
  if (Number(expires) * 1000 < now) return null;
  return safeEqual(signature, await hmacHex(`v2.${userId}.${expires}`, secret)) ? userId : null;
}

/** Only allow same-site relative redirects after login. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/trips";
  if (next.startsWith("/login") || next.startsWith("/signup")) return "/trips";
  return next;
}
