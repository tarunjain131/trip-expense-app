"use server";

import { cookies, headers } from "next/headers";
import { AUTH_COOKIE, SESSION_MAX_AGE_SECONDS, authMode, checkPassword, createSessionToken, safeNextPath } from "@/lib/auth";

type LoginResult = { ok: true; next: string } | { ok: false; error: string };

// Best-effort brute-force throttle (per server instance; serverless instances don't share memory).
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export async function loginAction(password: string, next?: string): Promise<LoginResult> {
  if (authMode() === "misconfigured") {
    return { ok: false, error: "Login isn't set up yet. The site owner needs to set APP_PASSWORD." };
  }
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && now - entry.first > WINDOW_MS) attempts.delete(ip);
  const current = attempts.get(ip);
  if (current && current.count >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  if (typeof password !== "string" || password.length === 0 || password.length > 200 || !(await checkPassword(password))) {
    attempts.set(ip, { count: (current?.count ?? 0) + 1, first: current?.first ?? now });
    await new Promise((r) => setTimeout(r, 700)); // slow down guessing
    return { ok: false, error: "That password isn't right." };
  }

  attempts.delete(ip);
  (await cookies()).set(AUTH_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return { ok: true, next: safeNextPath(next) };
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(AUTH_COOKIE);
}
