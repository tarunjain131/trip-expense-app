import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authSecret, createSessionToken, safeNextPath, verifySessionToken } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

const env = process.env as Record<string, string | undefined>;
const saved = { secret: env.AUTH_SECRET, node: env.NODE_ENV };
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  env.AUTH_SECRET = "s3cret";
});
afterEach(() => {
  env.AUTH_SECRET = saved.secret;
  env.NODE_ENV = saved.node;
});

describe("sessions", () => {
  it("issues tokens that verify to the same user, expire and cannot be forged", async () => {
    const token = await createSessionToken(USER);
    expect(await verifySessionToken(token)).toBe(USER);
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("garbage")).toBeNull();
    const [, exp, sig] = token.split(".");
    expect(await verifySessionToken(`${OTHER}.${exp}.${sig}`)).toBeNull(); // another user's id
    expect(await verifySessionToken(`${USER}.${Number(exp) + 1000}.${sig}`)).toBeNull();
    expect(await verifySessionToken(token, Date.now() + 31 * 24 * 3600 * 1000)).toBeNull();
  });

  it("invalidates sessions when the secret changes", async () => {
    const token = await createSessionToken(USER);
    env.AUTH_SECRET = "rotated";
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("fails closed in production without a secret", async () => {
    const token = await createSessionToken(USER);
    delete env.AUTH_SECRET;
    env.NODE_ENV = "production";
    expect(authSecret()).toBeNull();
    expect(await verifySessionToken(token)).toBeNull();
    await expect(createSessionToken(USER)).rejects.toThrow();
  });

  it("only allows same-site relative redirects", () => {
    expect(safeNextPath("/trips/abc")).toBe("/trips/abc");
    expect(safeNextPath("/join/abc123")).toBe("/join/abc123");
    expect(safeNextPath("//evil.com")).toBe("/trips");
    expect(safeNextPath("https://evil.com")).toBe("/trips");
    expect(safeNextPath("/\\evil.com")).toBe("/trips");
    expect(safeNextPath("/login")).toBe("/trips");
    expect(safeNextPath("/signup")).toBe("/trips");
    expect(safeNextPath(undefined)).toBe("/trips");
  });
});

describe("passwords", () => {
  it("hashes with a random salt and verifies", async () => {
    const a = await hashPassword("correct horse");
    const b = await hashPassword("correct horse");
    expect(a).not.toBe(b);
    expect(await verifyPassword("correct horse", a)).toBe(true);
    expect(await verifyPassword("correct horsE", a)).toBe(false);
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
});
