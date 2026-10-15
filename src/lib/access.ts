import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db/prisma";
import { AUTH_COOKIE, verifySessionToken } from "./auth";
import { DomainError } from "./errors";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

/** The logged-in user (verified against the database), or null. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await verifySessionToken((await cookies()).get(AUTH_COOKIE)?.value);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
  return user ? { id: user.id, email: user.email, name: user.name ?? user.email.split("@")[0] } : null;
});

/** For pages: send logged-out visitors to /login. */
export async function requireUserPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For server actions: throw a user-safe error. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new DomainError("Your session has expired. Please log in again.", "UNAUTHORIZED");
  return user;
}

export interface TripAccess {
  user: CurrentUser;
  isOwner: boolean;
  /** The member in this trip linked to the logged-in user, if any. */
  youMemberId: string | null;
}

/** Owner or any member linked to this account may access a trip. Returns null otherwise (treat as "not found"). */
export const getTripAccess = cache(async (tripId: string): Promise<TripAccess | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  return accessFor(user, tripId);
});

export async function accessFor(user: CurrentUser, tripId: string): Promise<TripAccess | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tripId)) return null;
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    select: { ownerId: true, members: { where: { userId: user.id }, select: { id: true }, take: 1 } },
  });
  if (!trip) return null;
  return { user, isOwner: trip.ownerId === user.id, youMemberId: trip.members[0]?.id ?? null };
}

/** For server actions on a trip. */
export async function requireTripAccess(tripId: string): Promise<TripAccess> {
  const user = await requireUser();
  const access = await accessFor(user, tripId);
  if (!access) throw new DomainError("This trip could not be found.", "NOT_FOUND");
  return access;
}

export async function requireTripOwner(tripId: string): Promise<TripAccess> {
  const access = await requireTripAccess(tripId);
  if (!access.isOwner) throw new DomainError("Only the person who created this can do that.", "FORBIDDEN");
  return access;
}
