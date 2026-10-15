import { randomBytes } from "node:crypto";
import { prisma } from "../db/prisma";
import { DomainError } from "../errors";
import { friendInputSchema, memberInputSchema, tripInputSchema } from "../validation/schemas";

export interface Actor {
  id: string;
  name: string;
}

const newInviteCode = () => randomBytes(9).toString("base64url");

/** Create a trip/group. With an owner, the owner is also added as a linked member. */
export async function createTrip(raw: unknown, owner?: Actor) {
  const input = tripInputSchema.parse(raw);
  return prisma.trip.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      currency: input.currency,
      kind: input.kind,
      inviteCode: newInviteCode(),
      ownerId: owner?.id ?? null,
      members: owner ? { create: { name: owner.name, userId: owner.id } } : undefined,
    },
    select: { id: true },
  });
}

/**
 * Start (or reopen) a two-person ledger with a friend. If the email belongs to a registered user they are
 * linked right away; otherwise the friend is a placeholder who can claim it through the invite link.
 */
export async function createFriendLedger(raw: unknown, owner: Actor): Promise<{ id: string; existing: boolean }> {
  const input = friendInputSchema.parse(raw);
  let friend: { id: string } | null = null;
  if (input.email) {
    const found = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (found?.id === owner.id) throw new DomainError("That's your own email.", "SELF", "email");
    friend = found;
  }
  if (friend) {
    const existing = await prisma.trip.findFirst({
      where: {
        kind: "FRIEND",
        AND: [{ members: { some: { userId: owner.id } } }, { members: { some: { userId: friend.id } } }],
      },
      select: { id: true },
    });
    if (existing) return { id: existing.id, existing: true };
  }
  if (input.name.toLowerCase() === owner.name.toLowerCase()) {
    throw new DomainError("Use a name different from yours so you can tell you apart.", "DUPLICATE_MEMBER", "name");
  }
  const trip = await prisma.trip.create({
    data: {
      name: input.name,
      currency: input.currency,
      kind: "FRIEND",
      inviteCode: newInviteCode(),
      ownerId: owner.id,
      members: {
        create: [
          { name: owner.name, userId: owner.id },
          { name: input.name, userId: friend?.id ?? null },
        ],
      },
    },
    select: { id: true },
  });
  return { id: trip.id, existing: false };
}

export async function getTripKind(tripId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { kind: true } });
  if (!trip) throw new DomainError("This trip could not be found.", "NOT_FOUND");
  return trip;
}

export async function ensureInviteCode(tripId: string): Promise<string> {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { inviteCode: true } });
  if (!trip) throw new DomainError("This trip could not be found.", "NOT_FOUND");
  if (trip.inviteCode) return trip.inviteCode;
  const code = newInviteCode();
  await prisma.trip.update({ where: { id: tripId }, data: { inviteCode: code } });
  return code;
}

export async function regenerateInviteCode(tripId: string): Promise<string> {
  const code = newInviteCode();
  await prisma.trip.update({ where: { id: tripId }, data: { inviteCode: code } });
  return code;
}

export async function getInvitePreview(code: string) {
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(code)) return null;
  return prisma.trip.findUnique({
    where: { inviteCode: code },
    select: {
      id: true,
      name: true,
      kind: true,
      owner: { select: { name: true } },
      members: { select: { id: true, name: true, userId: true }, orderBy: [{ createdAt: "asc" }, { name: "asc" }] },
    },
  });
}

async function uniqueMemberName(tripId: string, wanted: string): Promise<string> {
  const rows = await prisma.tripMember.findMany({ where: { tripId }, select: { name: true } });
  const taken = new Set(rows.map((r) => r.name.toLowerCase()));
  if (!taken.has(wanted.toLowerCase())) return wanted;
  for (let i = 2; i < 100; i++) if (!taken.has(`${wanted} (${i})`.toLowerCase())) return `${wanted} (${i})`;
  return `${wanted} (${Date.now()})`;
}

/**
 * Join through an invite link: claim a placeholder member ("I'm Rahul") or join as a new member.
 * A two-person friend ledger always claims its one free spot.
 */
export async function joinTrip(code: string, user: Actor, memberId: string | null): Promise<{ id: string }> {
  const trip = await getInvitePreview(code);
  if (!trip) throw new DomainError("This invite link isn't valid any more.", "NOT_FOUND");
  if (trip.members.some((m) => m.userId === user.id)) return { id: trip.id };

  const free = trip.members.filter((m) => m.userId === null);
  if (trip.kind === "FRIEND") {
    if (free.length !== 1) throw new DomainError("This two-person ledger already has both people.", "FULL");
    const res = await prisma.tripMember.updateMany({ where: { id: free[0].id, userId: null }, data: { userId: user.id } });
    if (res.count === 0) throw new DomainError("This two-person ledger already has both people.", "FULL");
    return { id: trip.id };
  }
  if (memberId) {
    // updateMany guards against two people claiming the same person at the same moment.
    const res = await prisma.tripMember.updateMany({ where: { id: memberId, tripId: trip.id, userId: null }, data: { userId: user.id } });
    if (res.count === 0) throw new DomainError("That person was already claimed by someone else.", "CLAIMED");
    return { id: trip.id };
  }
  await prisma.tripMember.create({ data: { tripId: trip.id, name: await uniqueMemberName(trip.id, user.name), userId: user.id } });
  return { id: trip.id };
}

/** "This is me": link an unclaimed member of a trip you can already open to your account. */
export async function claimMember(tripId: string, memberId: string, user: Actor) {
  const mine = await prisma.tripMember.findFirst({ where: { tripId, userId: user.id }, select: { id: true } });
  if (mine) throw new DomainError("You're already part of this one.", "ALREADY_LINKED");
  const res = await prisma.tripMember.updateMany({ where: { id: memberId, tripId, userId: null }, data: { userId: user.id } });
  if (res.count === 0) throw new DomainError("That person is already linked to an account.", "CLAIMED");
}

export async function renameTrip(tripId: string, raw: unknown) {
  const input = tripInputSchema.pick({ name: true, description: true }).parse(raw);
  await prisma.trip.update({ where: { id: tripId }, data: { name: input.name, description: input.description ?? null } });
}

/** Permanently removes a trip with all its expenses and settlements. */
export async function deleteTrip(tripId: string) {
  await prisma.$transaction([
    prisma.settlement.deleteMany({ where: { tripId } }),
    prisma.expense.deleteMany({ where: { tripId } }), // cascades payers + splits
    prisma.tripMember.deleteMany({ where: { tripId } }),
    prisma.trip.delete({ where: { id: tripId } }),
  ]);
}

export async function addMember(tripId: string, raw: unknown) {
  const { name } = memberInputSchema.parse(raw);
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { id: true } });
  if (!trip) throw new DomainError("This trip could not be found.", "NOT_FOUND");
  const duplicate = await prisma.tripMember.findFirst({
    where: { tripId, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) throw new DomainError(`Someone named "${name}" is already in this trip.`, "DUPLICATE_MEMBER", "name");
  return prisma.tripMember.create({ data: { tripId, name }, select: { id: true } });
}

/** Add several members at once (one name per entry). Skips blanks and case-insensitive duplicates. */
export async function addMembersBulk(tripId: string, names: string[]) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, select: { id: true } });
  if (!trip) throw new DomainError("This trip could not be found.", "NOT_FOUND");
  const existing = await prisma.tripMember.findMany({ where: { tripId }, select: { name: true } });
  const seen = new Set(existing.map((m) => m.name.toLowerCase()));
  const toCreate: string[] = [];
  for (const n of names) {
    const { name } = memberInputSchema.parse({ name: n });
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    toCreate.push(name);
  }
  if (toCreate.length === 0) throw new DomainError("Those people are already in this trip.", "DUPLICATE_MEMBER", "name");
  await prisma.tripMember.createMany({ data: toCreate.map((name) => ({ tripId, name })) });
  return toCreate.length;
}

export async function renameMember(tripId: string, memberId: string, raw: unknown) {
  const { name } = memberInputSchema.parse(raw);
  const member = await prisma.tripMember.findFirst({ where: { id: memberId, tripId }, select: { id: true } });
  if (!member) throw new DomainError("That person could not be found in this trip.", "NOT_FOUND");
  const duplicate = await prisma.tripMember.findFirst({
    where: { tripId, id: { not: memberId }, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (duplicate) throw new DomainError(`Someone named "${name}" is already in this trip.`, "DUPLICATE_MEMBER", "name");
  await prisma.tripMember.update({ where: { id: memberId }, data: { name } });
}

/** Members that appear in any expense or settlement can't be removed (it would corrupt the books). */
export async function removeMember(tripId: string, memberId: string, actor?: { id: string; isOwner: boolean }) {
  const member = await prisma.tripMember.findFirst({
    where: { id: memberId, tripId },
    select: {
      name: true,
      userId: true,
      _count: { select: { payments: true, splits: true, paid: true, received: true } },
    },
  });
  if (!member) throw new DomainError("That person could not be found in this trip.", "NOT_FOUND");
  // Someone with an account can only be removed by the trip owner (or by themselves).
  if (actor && member.userId && member.userId !== actor.id && !actor.isOwner) {
    throw new DomainError(`${member.name} has an account, so only the person who created this can remove them.`, "FORBIDDEN");
  }
  const c = member._count;
  if (c.payments + c.splits + c.paid + c.received > 0) {
    throw new DomainError(
      `${member.name} is part of existing expenses or settlements, so they can't be removed. Remove or edit those first.`,
      "MEMBER_IN_USE",
    );
  }
  await prisma.tripMember.delete({ where: { id: memberId } });
}
