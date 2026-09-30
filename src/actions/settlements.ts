"use server";

import { revalidatePath } from "next/cache";
import * as settlements from "@/lib/services/settlements";
import { run, type ActionResult } from "./result";

const refresh = (tripId: string) => revalidatePath(`/trips/${tripId}`, "layout");

export async function markSettlementPaidAction(tripId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const res = await run(() => settlements.createSettlement(tripId, input));
  if (res.ok) refresh(tripId);
  return res;
}

export async function revertSettlementAction(tripId: string, settlementId: string): Promise<ActionResult<undefined>> {
  const res = await run(async () => {
    await settlements.revertSettlement(tripId, settlementId);
    return undefined;
  });
  if (res.ok) refresh(tripId);
  return res;
}
