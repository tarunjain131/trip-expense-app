"use server";

import { cookies, headers } from "next/headers";
import { AUTH_COOKIE, SESSION_MAX_AGE_SECONDS, authSecret, createSessionToken, safeNextPath } from "@/lib/auth";
import { authenticate, signUp } from "@/lib/services/users";
import { runPublic, type ActionResult } from "./result";
import { DomainError } from "@/lib/errors";

// Best-effort brute-force throttle (per server instance; serverless instances don't share memory).
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

async function throttle(bucket: string): Promise<{ clear: () => void }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const entry = attempts.get(key);
  if (entry && now - entry.first > WINDOW_MS) attempts.delete(key);
  if (attempts.size > 5000) for (const [k, v] of attempts) if (now - v.first > WINDOW_MS) attempts.delete(k);
  const current = attempts.get(key);
  if (current && current.count >= MAX_ATTEMPTS) {
    throw new DomainError("Too many attempts. Please wait a few minutes and try again.", "RATE_LIMITED");
  }
  // Count the attempt immediately (synchronously, before any await), so parallel requests can't all slip under the limit.
  attempts.set(key, { count: (current?.count ?? 0) + 1, first: current?.first ?? now });
  return { clear: () => attempts.delete(key) };
}

async function startSession(userId: string) {
  (await cookies()).set(AUTH_COOKIE, await createSessionToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

function assertConfigured() {
  if (!authSecret()) throw new DomainError("Login isn't set up yet. The site owner needs to set AUTH_SECRET.", "MISCONFIGURED");
}

export async function loginAction(input: { email: string; password: string }, next?: string): Promise<ActionResult<{ next: string }>> {
  return runPublic(async () => {
    assertConfigured();
    const limiter = await throttle("login");
    const userId = await authenticate(input);
    if (!userId) {
      await new Promise((r) => setTimeout(r, 500)); // slow down guessing
      throw new DomainError("That email or password isn't right.", "BAD_LOGIN");
    }
    limiter.clear();
    await startSession(userId);
    return { next: safeNextPath(next) };
  });
}

export async function signupAction(
  input: { name: string; email: string; password: string },
  next?: string,
): Promise<ActionResult<{ next: string }>> {
  return runPublic(async () => {
    assertConfigured();
    const limiter = await throttle("signup");
    void limiter; // every signup attempt counts, to slow down account spam
    const user = await signUp(input);
    await startSession(user.id);
    return { next: safeNextPath(next) };
  });
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(AUTH_COOKIE);
}
