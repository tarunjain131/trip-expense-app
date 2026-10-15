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
import { getTripAccess, requireUserPage } from "../access";

export type TripKind = "TRIP" | "GROUP" | "FRIEND";

export interface MemberDTO {
  id: string;
  name: string;
  /** True when this person has an account linked. */
  linked: boolean;
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
  trip: {
    id: string;
    name: string;
    description: string | null;
    currency: string;
    kind: TripKind;
    createdAt: Date;
    isOwner: boolean;
    inviteCode: string | null;
  };
  /** The member linked to the logged-in account, if any. */
  youMemberId: string | null;
  members: MemberDTO[];
  memberById: Map<string, MemberDTO>;
  expenses: ExpenseDTO[];
  settlements: SettlementDTO[];
  balances: MemberBalance[];
  outstanding: ReturnType<typeof calculateOutstandingBalances>;
  suggestions: SuggestedSettlement[];
  summary: TripSummary;
}

/** Only returns trips the logged-in user owns or belongs to. */
export const getTripBasics = cache(async (tripId: string) => {
  const access = await getTripAccess(tripId);
  if (!access) return null;
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    select: {
      id: true,
      name: true,
      description: true,
      currency: true,
      kind: true,
      createdAt: true,
      members: { select: { id: true, name: true } },
    },
  });
  if (!trip) return null;
  return { ...trip, name: displayTripName(trip, access.youMemberId), memberCount: trip.members.length, isOwner: access.isOwner };
});

/** A two-person ledger is shown as the *other* person's name, whichever side is looking. */
export function displayTripName(trip: { name: string; kind: string; members: { id: string; name: string }[] }, youMemberId: string | null) {
  if (trip.kind !== "FRIEND" || !youMemberId) return trip.name;
  return trip.members.find((m) => m.id !== youMemberId)?.name ?? trip.name;
}

export function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Everything about a trip in three queries; balances and settlements are derived, never stored. */
export const getTripLedger = cache(async (tripId: string): Promise<TripLedger | null> => {
  const access = await getTripAccess(tripId);
  if (!access) return null;
  return loadTripLedger(tripId, access);
});

/** Unguarded loader (callers must have checked access). Also used directly by tests. */
export async function loadTripLedger(
  tripId: string,
  access?: { isOwner: boolean; youMemberId: string | null },
): Promise<TripLedger | null> {
  if (!isUuid(tripId)) return null;
  const [trip, rawMembers, expenses, settlements] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      select: { id: true, name: true, description: true, currency: true, kind: true, createdAt: true, inviteCode: true },
    }),
    prisma.tripMember.findMany({ where: { tripId }, select: { id: true, name: true, userId: true }, orderBy: [{ createdAt: "asc" }, { name: "asc" }] }),
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
  const members: MemberDTO[] = rawMembers.map((m) => ({ id: m.id, name: m.name, linked: m.userId !== null }));

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
    trip: { ...trip, name: displayTripName({ ...trip, members }, access?.youMemberId ?? null), isOwner: access?.isOwner ?? false },
    youMemberId: access?.youMemberId ?? null,
    members,
    memberById: new Map(members.map((m) => [m.id, m])),
    expenses: expenseDtos,
    settlements: settlementDtos,
    balances,
    outstanding: calculateOutstandingBalances(balances),
    suggestions: calculateSettlements(balances),
    summary,
  };
}

export interface SplitListItem {
  id: string;
  kind: TripKind;
  name: string;
  description: string | null;
  currency: string;
  createdAt: Date;
  memberCount: number;
  expenseCount: number;
  totalMinor: number;
  /** The logged-in user's balance here (positive = gets back). Null if their account isn't linked to a member. */
  myNet: number | null;
}

/** Every trip, group and friend ledger the logged-in user can open, with their own balance in each. */
export async function listSplits(): Promise<SplitListItem[]> {
  const user = await requireUserPage();
  const trips = await prisma.trip.findMany({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    orderBy: { createdAt: "desc" },
    include: {
      members: { select: { id: true, name: true, userId: true } },
      expenses: {
        select: { amount: true, payers: { select: { memberId: true, amount: true } }, splits: { select: { memberId: true, amount: true } } },
      },
      settlements: { select: { payerId: true, receiverId: true, amount: true, status: true } },
    },
  });
  return trips.map((t) => {
    const me = t.members.find((m) => m.userId === user.id) ?? null;
    let myNet: number | null = null;
    if (me) {
      const balances = calculateMemberBalances({
        memberIds: t.members.map((m) => m.id),
        expenses: t.expenses.map((e) => ({
          payers: e.payers.map((p) => ({ memberId: p.memberId, amountMinor: p.amount })),
          splits: e.splits.map((x) => ({ memberId: x.memberId, amountMinor: x.amount })),
        })),
        settlements: t.settlements.map((x) => ({ payerId: x.payerId, receiverId: x.receiverId, amountMinor: x.amount, status: x.status })),
      });
      myNet = balances.find((b) => b.memberId === me.id)?.net ?? 0;
    }
    return {
      id: t.id,
      kind: t.kind,
      name: displayTripName(t, me?.id ?? null),
      description: t.description,
      currency: t.currency,
      createdAt: t.createdAt,
      memberCount: t.members.length,
      expenseCount: t.expenses.length,
      totalMinor: t.expenses.reduce((a, e) => a + e.amount, 0),
      myNet,
    };
  });
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
