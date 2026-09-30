import { prisma } from "../db/prisma";
import { DomainError } from "../errors";
import { memberInputSchema, tripInputSchema } from "../validation/schemas";

export async function createTrip(raw: unknown) {
  const input = tripInputSchema.parse(raw);
  return prisma.trip.create({
    data: { name: input.name, description: input.description ?? null, currency: input.currency },
    select: { id: true },
  });
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
export async function removeMember(tripId: string, memberId: string) {
  const member = await prisma.tripMember.findFirst({
    where: { id: memberId, tripId },
    select: {
      name: true,
      _count: { select: { payments: true, splits: true, paid: true, received: true } },
    },
  });
  if (!member) throw new DomainError("That person could not be found in this trip.", "NOT_FOUND");
  const c = member._count;
  if (c.payments + c.splits + c.paid + c.received > 0) {
    throw new DomainError(
      `${member.name} is part of existing expenses or settlements, so they can't be removed. Remove or edit those first.`,
      "MEMBER_IN_USE",
    );
  }
  await prisma.tripMember.delete({ where: { id: memberId } });
}
