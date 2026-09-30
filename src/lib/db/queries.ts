import { cache } from "react";
import { prisma } from "./prisma";
import {
  calculateMemberBalances,
  calculateOutstandingBalances,
  type MemberBalance,
} from "../balances/calculate";
import { calculateSettlements, type SuggestedSettlement } from "../settlements/simplify";
import { calculateTripSummary, type TripSummary } from "../summary/calculate";
import type { ExpenseCategory, SplitType } from "../expenses/types";

export interface MemberDTO {
  id: string;
  name: string;
}

export interface ExpenseDTO {
  id: string;
  title: string;
  amountMinor: number;
  currency: string;
  category: ExpenseCategory | null;
  notes: string | null;
  splitType: SplitType;
  spentAt: Date;
  createdAt: Date;
  updatedAt: Date;
  payers: { memberId: string; amountMinor: number }[];
  splits: { memberId: string; amountMinor: number; value: number | null }[];
}

export interface SettlementDTO {
  id: string;
  payerId: string;
  receiverId: string;
  amountMinor: number;
  status: "COMPLETED" | "REVERTED";
  createdAt: Date;
  paidAt: Date;
  revertedAt: Date | null;
}

export interface TripLedger {
  trip: { id: string; name: string; description: string | null; currency: string; createdAt: Date };
  members: MemberDTO[];
  memberById: Map<string, MemberDTO>;
  expenses: ExpenseDTO[];
  settlements: SettlementDTO[];
  balances: MemberBalance[];
  outstanding: ReturnType<typeof calculateOutstandingBalances>;
  suggestions: SuggestedSettlement[];
  summary: TripSummary;
}

export const getTripBasics = cache(async (tripId: string) => {
  if (!isUuid(tripId)) return null;
  return prisma.trip.findUnique({
    where: { id: tripId },
    select: { id: true, name: true, description: true, currency: true, createdAt: true, _count: { select: { members: true } } },
  });
});

export function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Everything about a trip in three queries; balances and settlements are derived, never stored. */
export const getTripLedger = cache(async (tripId: string): Promise<TripLedger | null> => {
  if (!isUuid(tripId)) return null;
  const [trip, members, expenses, settlements] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, name: true, description: true, currency: true, createdAt: true },
    }),
    prisma.tripMember.findMany({ where: { tripId }, select: { id: true, name: true }, orderBy: [{ createdAt: "asc" }, { name: "asc" }] }),
    prisma.expense.findMany({
      where: { tripId },
      orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
      include: {
        payers: { select: { memberId: true, amount: true } },
        splits: { select: { memberId: true, amount: true, value: true } },
      },
    }),
    prisma.settlement.findMany({ where: { tripId }, orderBy: { paidAt: "desc" } }),
  ]);
  if (!trip) return null;

  const expenseDtos: ExpenseDTO[] = expenses.map((e) => ({
    id: e.id,
    title: e.title,
    amountMinor: e.amount,
    currency: e.currency,
    category: e.category,
    notes: e.notes,
    splitType: e.splitType,
    spentAt: e.spentAt,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    payers: e.payers.map((p) => ({ memberId: p.memberId, amountMinor: p.amount })),
    splits: e.splits.map((s) => ({ memberId: s.memberId, amountMinor: s.amount, value: s.value })),
  }));
  const settlementDtos: SettlementDTO[] = settlements.map((s) => ({
    id: s.id,
    payerId: s.payerId,
    receiverId: s.receiverId,
    amountMinor: s.amount,
    status: s.status,
    createdAt: s.createdAt,
    paidAt: s.paidAt,
    revertedAt: s.revertedAt,
  }));

  const balances = calculateMemberBalances({
    memberIds: members.map((m) => m.id),
    expenses: expenseDtos,
    settlements: settlementDtos,
  });
  const summary = calculateTripSummary({
    expenses: expenseDtos.map((e) => ({ id: e.id, title: e.title, amountMinor: e.amountMinor, category: e.category })),
    balances,
    completedSettlementAmounts: settlementDtos.filter((s) => s.status === "COMPLETED").map((s) => s.amountMinor),
  });

  return {
    trip,
    members,
    memberById: new Map(members.map((m) => [m.id, m])),
    expenses: expenseDtos,
    settlements: settlementDtos,
    balances,
    outstanding: calculateOutstandingBalances(balances),
    suggestions: calculateSettlements(balances),
    summary,
  };
});

export async function listTrips() {
  const trips = await prisma.trip.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, description: true, currency: true, createdAt: true, _count: { select: { members: true, expenses: true } } },
  });
  const totals = await prisma.expense.groupBy({ by: ["tripId"], _sum: { amount: true } });
  const totalByTrip = new Map(totals.map((t) => [t.tripId, t._sum.amount ?? 0]));
  return trips.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    currency: t.currency,
    createdAt: t.createdAt,
    memberCount: t._count.members,
    expenseCount: t._count.expenses,
    totalMinor: totalByTrip.get(t.id) ?? 0,
  }));
}

export interface ExpenseFilters {
  q?: string;
  category?: string;
  member?: string;
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
}

/** In-memory filtering (a trip has at most a few hundred expenses). */
export function filterExpenses(expenses: ExpenseDTO[], f: ExpenseFilters): ExpenseDTO[] {
  const q = f.q?.trim().toLowerCase();
  const from = f.from ? new Date(`${f.from}T00:00:00.000Z`).getTime() : null;
  const to = f.to ? new Date(`${f.to}T23:59:59.999Z`).getTime() : null;
  return expenses.filter((e) => {
    if (q && !e.title.toLowerCase().includes(q) && !(e.notes ?? "").toLowerCase().includes(q)) return false;
    if (f.category) {
      if (f.category === "NONE" ? e.category !== null : e.category !== f.category) return false;
    }
    if (f.member && !e.payers.some((p) => p.memberId === f.member) && !e.splits.some((s) => s.memberId === f.member)) return false;
    const t = e.spentAt.getTime();
    if (from !== null && t < from) return false;
    if (to !== null && t > to) return false;
    return true;
  });
}
