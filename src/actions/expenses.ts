"use server";

import { revalidatePath } from "next/cache";
import * as expenses from "@/lib/services/expenses";
import { requireTripAccess } from "@/lib/access";
import { run, type ActionResult } from "./result";

const refresh = (tripId: string) => revalidatePath(`/trips/${tripId}`, "layout");

export async function createExpenseAction(tripId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const res = await run(async () => {
    await requireTripAccess(tripId);
    return expenses.createExpense(tripId, input);
  });
  if (res.ok) refresh(tripId);
  return res;
}

export async function updateExpenseAction(
  tripId: string,
  expenseId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const res = await run(async () => {
    await requireTripAccess(tripId);
    return expenses.updateExpense(tripId, expenseId, input);
  });
  if (res.ok) refresh(tripId);
  return res;
}

export async function deleteExpenseAction(tripId: string, expenseId: string): Promise<ActionResult<undefined>> {
  const res = await run(async () => {
    await requireTripAccess(tripId);
    await expenses.deleteExpense(tripId, expenseId);
    return undefined;
  });
  if (res.ok) refresh(tripId);
  return res;
}

export async function duplicateExpenseAction(tripId: string, expenseId: string): Promise<ActionResult<{ id: string }>> {
  const res = await run(async () => {
    await requireTripAccess(tripId);
    return expenses.duplicateExpense(tripId, expenseId);
  });
  if (res.ok) refresh(tripId);
  return res;
}
