export const SPLIT_TYPES = ["EQUAL", "EXACT", "PERCENTAGE", "SHARES"] as const;
export type SplitType = (typeof SPLIT_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  "FOOD",
  "HOTEL",
  "TRANSPORT",
  "FUEL",
  "TICKETS",
  "ACTIVITIES",
  "SHOPPING",
  "MISC",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  FOOD: "Food",
  HOTEL: "Hotel",
  TRANSPORT: "Transport",
  FUEL: "Fuel",
  TICKETS: "Tickets",
  ACTIVITIES: "Activities",
  SHOPPING: "Shopping",
  MISC: "Miscellaneous",
};

export const SPLIT_TYPE_LABELS: Record<SplitType, string> = {
  EQUAL: "Equally",
  EXACT: "Exact amounts",
  PERCENTAGE: "Percentages",
  SHARES: "Shares",
};

/**
 * `value` meaning depends on the split type:
 * EXACT: minor units - PERCENTAGE: basis points (100% = 10000) - SHARES: share count.
 */
export interface SplitParticipantInput {
  memberId: string;
  value?: number;
}

export interface ExpenseSplitResult {
  memberId: string;
  amountMinor: number;
  /** Raw input preserved so the expense can be edited later. Null for EQUAL. */
  value: number | null;
}

export interface PayerInput {
  memberId: string;
  amountMinor: number;
}
