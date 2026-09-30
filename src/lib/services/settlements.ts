import { prisma } from "../db/prisma";
import { DomainError } from "../errors";
import { calculateMemberBalances } from "../balances/calculate";
import { validateSettlementAgainstBalances } from "../settlements/validate";
import { requireMinor, settlementInputSchema } from "../validation/schemas";
import { lockTrip } from "./expenses";

/**
 * Record a completed payment between two members. Runs under a trip lock and
 * re-checks the live balances, so stale screens or double clicks can never
 * over-settle.
 */
export async function createSettlement(tripId: string, raw: unknown) {
  const input = settlementInputSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const { currency } = await lockTrip(tx, tripId);
    if (input.payerId === input.receiverId) {
      throw new DomainError("Someone can't pay themselves.", "SAME_PARTY");
    }
    const amountMinor = requireMinor(input.amount, currency);

    const [members, expenses, settlements] = await Promise.all([
      tx.tripMember.findMany({ where: { tripId }, select: { id: true } }),
      tx.expense.findMany({
        where: { tripId },
        select: { payers: { select: { memberId: true, amount: true } }, splits: { select: { memberId: true, amount: true } } },
      }),
      tx.settlement.findMany({
        where: { tripId, status: "COMPLETED" },
        select: { payerId: true, receiverId: true, amount: true, status: true },
      }),
    ]);
    const ids = new Set(members.map((m) => m.id));
    if (!ids.has(input.payerId) || !ids.has(input.receiverId)) {
      throw new DomainError("Both people must belong to this trip.", "FOREIGN_MEMBER");
    }
    const balances = calculateMemberBalances({
      memberIds: [...ids],
      expenses: expenses.map((e) => ({
        payers: e.payers.map((p) => ({ memberId: p.memberId, amountMinor: p.amount })),
        splits: e.splits.map((s) => ({ memberId: s.memberId, amountMinor: s.amount })),
      })),
      settlements: settlements.map((s) => ({ ...s, amountMinor: s.amount })),
    });
    const net = (id: string) => balances.find((b) => b.memberId === id)!.net;
    validateSettlementAgainstBalances({
      amountMinor,
      payerNet: net(input.payerId),
      receiverNet: net(input.receiverId),
    });
    return tx.settlement.create({
      data: { tripId, payerId: input.payerId, receiverId: input.receiverId, amount: amountMinor, status: "COMPLETED" },
      select: { id: true },
    });
  });
}

/** Undo a settlement. The record is kept (status REVERTED) so history is never lost. */
export async function revertSettlement(tripId: string, settlementId: string) {
  await prisma.$transaction(async (tx) => {
    await lockTrip(tx, tripId);
    const res = await tx.settlement.updateMany({
      where: { id: settlementId, tripId, status: "COMPLETED" },
      data: { status: "REVERTED", revertedAt: new Date() },
    });
    if (res.count === 0) {
      throw new DomainError("This settlement was already reverted or no longer exists.", "NOT_FOUND");
    }
  });
}
