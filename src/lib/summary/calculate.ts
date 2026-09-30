import type { MemberBalance } from "../balances/calculate";

export interface SummaryExpense {
  id: string;
  title: string;
  amountMinor: number;
  category: string | null;
}

export interface TripSummary {
  totalSpent: number;
  expenseCount: number;
  memberCount: number;
  averagePerMember: number;
  topPayer: { memberId: string; paid: number } | null;
  largestExpense: { id: string; title: string; amountMinor: number } | null;
  categories: { category: string | null; totalMinor: number; count: number }[];
  settledAmount: number;
  outstandingAmount: number;
}

export function calculateTripSummary(input: {
  expenses: SummaryExpense[];
  balances: MemberBalance[];
  completedSettlementAmounts: number[];
}): TripSummary {
  const { expenses, balances } = input;
  const totalSpent = expenses.reduce((a, e) => a + e.amountMinor, 0);
  const memberCount = balances.length;

  let topPayer: TripSummary["topPayer"] = null;
  for (const b of balances) {
    if (b.paid > 0 && (!topPayer || b.paid > topPayer.paid)) topPayer = { memberId: b.memberId, paid: b.paid };
  }
  let largest: TripSummary["largestExpense"] = null;
  for (const e of expenses) {
    if (!largest || e.amountMinor > largest.amountMinor) {
      largest = { id: e.id, title: e.title, amountMinor: e.amountMinor };
    }
  }
  const byCat = new Map<string | null, { totalMinor: number; count: number }>();
  for (const e of expenses) {
    const c = byCat.get(e.category) ?? { totalMinor: 0, count: 0 };
    c.totalMinor += e.amountMinor;
    c.count += 1;
    byCat.set(e.category, c);
  }
  const categories = [...byCat.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.totalMinor - a.totalMinor);

  return {
    totalSpent,
    expenseCount: expenses.length,
    memberCount,
    averagePerMember: memberCount ? Math.round(totalSpent / memberCount) : 0,
    topPayer,
    largestExpense: largest,
    categories,
    settledAmount: input.completedSettlementAmounts.reduce((a, b) => a + b, 0),
    outstandingAmount: balances.filter((b) => b.net > 0).reduce((a, b) => a + b.net, 0),
  };
}
