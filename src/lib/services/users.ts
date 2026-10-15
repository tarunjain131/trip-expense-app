import { prisma } from "../db/prisma";
import { DomainError } from "../errors";
import { hashPassword, verifyPassword } from "../password";
import { loginInputSchema, signupInputSchema } from "../validation/schemas";

/**
 * Trips created before accounts existed have no owner. Only the account whose email matches LEGACY_OWNER_EMAIL
 * adopts them (in development, the first account does), so a stranger who signs up first can't take them.
 * Runs on signup and on login, so it doesn't matter which comes first.
 */
export async function adoptLegacyTrips(userId: string, email: string): Promise<number> {
  const owner = process.env.LEGACY_OWNER_EMAIL?.trim().toLowerCase();
  let allowed = owner ? owner === email.toLowerCase() : false;
  if (!owner && process.env.NODE_ENV !== "production") allowed = (await prisma.user.count()) === 1;
  if (!allowed) return 0;
  const res = await prisma.trip.updateMany({ where: { ownerId: null }, data: { ownerId: userId } });
  return res.count;
}

/** Create an account. */
export async function signUp(raw: unknown): Promise<{ id: string }> {
  const input = signupInputSchema.parse(raw);
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw new DomainError("An account with this email already exists. Try logging in.", "EMAIL_TAKEN", "email");
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({ data: { email: input.email, name: input.name, passwordHash }, select: { id: true } });
  await adoptLegacyTrips(user.id, input.email);
  return user;
}

const DUMMY_HASH = "scrypt$00000000000000000000000000000000$" + "00".repeat(64);

/** Returns the user id on success, or null. Always does one hash comparison so timing doesn't reveal which emails exist. */
export async function authenticate(raw: unknown): Promise<string | null> {
  const parsed = loginInputSchema.safeParse(raw);
  if (!parsed.success) return null;
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, passwordHash: true } });
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return null;
  await adoptLegacyTrips(user.id, parsed.data.email);
  return user.id;
}
