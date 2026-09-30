import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "../db/prisma";
import { DomainError } from "../errors";
import { calculateExpenseSplits, validatePayers } from "../expenses/calculate";
import type { ExpenseCategory } from "../expenses/types";
import { expenseInputSchema, parseParticipantValues, requireMinor } from "../validation/schemas";

type Tx = Prisma.TransactionClient;

/** Lock the trip row so concurrent financial mutations on one trip are serialised. */
export async function lockTrip(tx: Tx, tripId: string) {
  const rows = await tx.$queryRaw<{ currency: string }[]>`SELECT "currency" FROM "Trip" WHERE "id" = ${tripId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw new DomainError("This trip could not be found.", "NOT_FOUND");
  return rows[0];
}

/** Validate input, verify every referenced member belongs to the trip, and compute the stored rows. */
async function buildExpenseRows(tx: Tx, tripId: string, currency: string, raw: unknown) {
  const input = expenseInputSchema.parse(raw);
  const totalMinor = requireMinor(input.amount, currency, "Amount");

  const memberIds = new Set(
    (await tx.tripMember.findMany({ where: { tripId }, select: { id: true } })).map((m) => m.id),
  );
  const referenced = [...input.payers.map((p) => p.memberId), ...input.participants.map((p) => p.memberId)];
  if (referenced.some((id) => !memberIds.has(id))) {
    throw new DomainError("Someone in this expense is not part of the trip.", "FOREIGN_MEMBER");
  }

  const payers = validatePayers(
    totalMinor,
    input.payers.map((p) => ({
      memberId: p.memberId,
      amountMinor:
        input.payers.length === 1 && !p.amount ? totalMinor : requireMinor(p.amount ?? "", currency, "Paid amount", "payers"),
    })),
  );
  const splits = calculateExpenseSplits({
    totalMinor,
    splitType: input.splitType,
    participants: parseParticipantValues(input.splitType, input.participants, currency),
  });

  let spentAt: Date | undefined;
  if (input.spentAt) {
    // Noon UTC keeps the calendar day stable in every timezone.
    spentAt = new Date(`${input.spentAt}T12:00:00.000Z`);
    if (Number.isNaN(spentAt.getTime())) throw new DomainError("Choose a valid date.", "INVALID_DATE", "spentAt");
  }
  return { input, totalMinor, payers, splits, spentAt };
}

export async function createExpense(tripId: string, raw: unknown) {
  return prisma.$transaction(async (tx) => {
    const { currency } = await lockTrip(tx, tripId);
    const { input, totalMinor, payers, splits, spentAt } = await buildExpenseRows(tx, tripId, currency, raw);
    return tx.expense.create({
      data: {
        tripId,
        title: input.title,
        amount: totalMinor,
        currency,
        category: (input.category ?? null) as ExpenseCategory | null,
        notes: input.notes,
        splitType: input.splitType,
        ...(spentAt ? { spentAt } : {}),
        payers: { create: payers.map((p) => ({ memberId: p.memberId, amount: p.amountMinor })) },
        splits: {
          create: splits.map((s) => ({ memberId: s.memberId, amount: s.amountMinor, value: s.value })),
        },
      },
      select: { id: true },
    });
  });
}

export async function updateExpense(tripId: string, expenseId: string, raw: unknown) {
  return prisma.$transaction(async (tx) => {
    const { currency } = await lockTrip(tx, tripId);
    const existing = await tx.expense.findFirst({ where: { id: expenseId, tripId }, select: { updatedAt: true } });
    if (!existing) throw new DomainError("This expense no longer exists.", "NOT_FOUND");
    const { input, totalMinor, payers, splits, spentAt } = await buildExpenseRows(tx, tripId, currency, raw);
    if (input.version && input.version !== existing.updatedAt.toISOString()) {
      throw new DomainError(
        "This expense was changed by someone else while you were editing. Reload it and try again.",
        "STALE",
      );
    }
    // Replace payers/splits wholesale inside the same transaction.
    await tx.expensePayer.deleteMany({ where: { expenseId } });
    await tx.expenseSplit.deleteMany({ where: { expenseId } });
    await tx.expense.update({
      where: { id: expenseId },
      data: {
        title: input.title,
        amount: totalMinor,
        category: (input.category ?? null) as ExpenseCategory | null,
        notes: input.notes,
        splitType: input.splitType,
        ...(spentAt ? { spentAt } : {}),
        payers: { create: payers.map((p) => ({ memberId: p.memberId, amount: p.amountMinor })) },
        splits: {
          create: splits.map((s) => ({ memberId: s.memberId, amount: s.amountMinor, value: s.value })),
        },
      },
    });
    return { id: expenseId };
  });
}

export async function deleteExpense(tripId: string, expenseId: string) {
  await prisma.$transaction(async (tx) => {
    await lockTrip(tx, tripId);
    const res = await tx.expense.deleteMany({ where: { id: expenseId, tripId } });
    if (res.count === 0) throw new DomainError("This expense was already deleted.", "NOT_FOUND");
  });
}

export async function duplicateExpense(tripId: string, expenseId: string) {
  return prisma.$transaction(async (tx) => {
    await lockTrip(tx, tripId);
    const src = await tx.expense.findFirst({
      where: { id: expenseId, tripId },
      include: { payers: true, splits: true },
    });
    if (!src) throw new DomainError("This expense no longer exists.", "NOT_FOUND");
    return tx.expense.create({
      data: {
        tripId,
        title: `${src.title} (copy)`.slice(0, 100),
        amount: src.amount,
        currency: src.currency,
        category: src.category,
        notes: src.notes,
        splitType: src.splitType,
        payers: { create: src.payers.map((p) => ({ memberId: p.memberId, amount: p.amount })) },
        splits: { create: src.splits.map((s) => ({ memberId: s.memberId, amount: s.amount, value: s.value })) },
      },
      select: { id: true },
    });
  });
}
