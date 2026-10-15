"use server";

import { revalidatePath } from "next/cache";
import { requireTripAccess, requireTripOwner, requireUser } from "@/lib/access";
import { DomainError } from "@/lib/errors";
import * as trips from "@/lib/services/trips";
import { run, type ActionResult } from "./result";

export async function createTripAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const res = await run(async () => trips.createTrip(input, await requireUser()));
  if (res.ok) revalidatePath("/trips");
  return res;
}

export async function createFriendAction(input: unknown): Promise<ActionResult<{ id: string; existing: boolean }>> {
  const res = await run(async () => trips.createFriendLedger(input, await requireUser()));
  if (res.ok) revalidatePath("/trips");
  return res;
}

export async function joinTripAction(code: string, memberId: string | null): Promise<ActionResult<{ id: string }>> {
  const res = await run(async () => trips.joinTrip(code, await requireUser(), memberId));
  if (res.ok) revalidatePath("/trips");
  return res;
}

export async function claimMemberAction(tripId: string, memberId: string): Promise<ActionResult<undefined>> {
  const res = await run(async () => {
    const { user } = await requireTripAccess(tripId);
    await trips.claimMember(tripId, memberId, user);
    return undefined;
  });
  if (res.ok) revalidatePath(`/trips/${tripId}`, "layout");
  return res;
}

export async function renameTripAction(tripId: string, input: unknown): Promise<ActionResult<undefined>> {
  const res = await run(async () => {
    await requireTripOwner(tripId);
    await trips.renameTrip(tripId, input);
    return undefined;
  });
  if (res.ok) {
    revalidatePath(`/trips/${tripId}`, "layout");
    revalidatePath("/trips");
  }
  return res;
}

export async function deleteTripAction(tripId: string): Promise<ActionResult<undefined>> {
  const res = await run(async () => {
    await requireTripOwner(tripId);
    await trips.deleteTrip(tripId);
    return undefined;
  });
  if (res.ok) revalidatePath("/trips");
  return res;
}

export async function regenerateInviteAction(tripId: string): Promise<ActionResult<{ code: string }>> {
  const res = await run(async () => {
    await requireTripOwner(tripId);
    return { code: await trips.regenerateInviteCode(tripId) };
  });
  if (res.ok) revalidatePath(`/trips/${tripId}`, "layout");
  return res;
}

export async function ensureInviteAction(tripId: string): Promise<ActionResult<{ code: string }>> {
  const res = await run(async () => {
    await requireTripAccess(tripId);
    return { code: await trips.ensureInviteCode(tripId) };
  });
  if (res.ok) revalidatePath(`/trips/${tripId}`, "layout");
  return res;
}

export async function addMembersAction(tripId: string, names: string[]): Promise<ActionResult<{ added: number }>> {
  const res = await run(async () => {
    const { kind } = await requireTripKind(tripId);
    if (kind === "FRIEND") throw new DomainError("A friend ledger is just you and one other person.", "FRIEND_LOCKED");
    return { added: await trips.addMembersBulk(tripId, names) };
  });
  if (res.ok) revalidatePath(`/trips/${tripId}`, "layout");
  return res;
}

export async function renameMemberAction(tripId: string, memberId: string, input: unknown): Promise<ActionResult<undefined>> {
  const res = await run(async () => {
    await requireTripAccess(tripId);
    await trips.renameMember(tripId, memberId, input);
    return undefined;
  });
  if (res.ok) revalidatePath(`/trips/${tripId}`, "layout");
  return res;
}

export async function removeMemberAction(tripId: string, memberId: string): Promise<ActionResult<undefined>> {
  const res = await run(async () => {
    const { user, isOwner } = await requireTripAccess(tripId);
    const { kind } = await trips.getTripKind(tripId);
    if (kind === "FRIEND") throw new DomainError("A friend ledger always keeps both people.", "FRIEND_LOCKED");
    await trips.removeMember(tripId, memberId, { id: user.id, isOwner });
    return undefined;
  });
  if (res.ok) revalidatePath(`/trips/${tripId}`, "layout");
  return res;
}

async function requireTripKind(tripId: string) {
  await requireTripAccess(tripId);
  return trips.getTripKind(tripId);
}
