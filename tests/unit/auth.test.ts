import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { authMode, checkPassword, createSessionToken, safeNextPath, verifySessionToken } from "@/lib/auth";

const env = process.env as Record<string, string | undefined>;
const saved = { pw: env.APP_PASSWORD, secret: env.AUTH_SECRET, node: env.NODE_ENV };
beforeEach(() => {
  env.APP_PASSWORD = "correct horse";
  env.AUTH_SECRET = "s3cret";
});
afterEach(() => {
  env.APP_PASSWORD = saved.pw;
  env.AUTH_SECRET = saved.secret;
  env.NODE_ENV = saved.node;
});

describe("auth", () => {
  it("checks the password", async () => {
    expect(await checkPassword("correct horse")).toBe(true);
    expect(await checkPassword("correct horsE")).toBe(false);
    expect(await checkPassword("")).toBe(false);
  });

  it("issues tokens that verify, expire and cannot be forged", async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("garbage")).toBe(false);
    const [exp, sig] = token.split(".");
    expect(await verifySessionToken(`${Number(exp) + 1000}.${sig}`)).toBe(false);
    expect(await verifySessionToken(token, Date.now() + 31 * 24 * 3600 * 1000)).toBe(false);
  });

  it("invalidates sessions when the password or secret changes", async () => {
    const token = await createSessionToken();
    env.APP_PASSWORD = "different";
    expect(await verifySessionToken(token)).toBe(false);
    env.APP_PASSWORD = "correct horse";
    env.AUTH_SECRET = "rotated";
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("fails closed in production without a password", () => {
    delete env.APP_PASSWORD;
    env.NODE_ENV = "production";
    expect(authMode()).toBe("misconfigured");
    env.NODE_ENV = "development";
    expect(authMode()).toBe("disabled");
  });

  it("only allows same-site relative redirects", () => {
    expect(safeNextPath("/trips/abc")).toBe("/trips/abc");
    expect(safeNextPath("//evil.com")).toBe("/trips");
    expect(safeNextPath("https://evil.com")).toBe("/trips");
    expect(safeNextPath("/\\evil.com")).toBe("/trips");
    expect(safeNextPath("/login")).toBe("/trips");
    expect(safeNextPath(undefined)).toBe("/trips");
  });
});
