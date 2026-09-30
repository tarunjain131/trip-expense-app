"use server";

import { revalidatePath } from "next/cache";
import * as trips from "@/lib/services/trips";
import { run, type ActionResult } from "./result";

export async function createTripAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const res = await run(() => trips.createTrip(input));
  if (res.ok) revalidatePath("/trips");
  return res;
}

export async function addMembersAction(tripId: string, names: string[]): Promise<ActionResult<{ added: number }>> {
  const res = await run(async () => ({ added: await trips.addMembersBulk(tripId, names) }));
  if (res.ok) revalidatePath(`/trips/${tripId}`, "layout");
  return res;
}

export async function renameMemberAction(tripId: string, memberId: string, input: unknown): Promise<ActionResult<undefined>> {
  const res = await run(async () => {
    await trips.renameMember(tripId, memberId, input);
    return undefined;
  });
  if (res.ok) revalidatePath(`/trips/${tripId}`, "layout");
  return res;
}

export async function removeMemberAction(tripId: string, memberId: string): Promise<ActionResult<undefined>> {
  const res = await run(async () => {
    await trips.removeMember(tripId, memberId);
    return undefined;
  });
  if (res.ok) revalidatePath(`/trips/${tripId}`, "layout");
  return res;
}
