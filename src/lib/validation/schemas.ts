import { z } from "zod";
import { CURRENCY_CODES, DEFAULT_CURRENCY, MAX_AMOUNT_MINOR, parseMoneyToMinor, parsePercentToBp } from "../money";
import { EXPENSE_CATEGORIES, SPLIT_TYPES, type SplitType } from "../expenses/types";
import { DomainError } from "../errors";

const uuid = z.string().uuid("Invalid identifier.");

const trimmed = (label: string, max: number) =>
  z
    .string({ error: `${label} is required.` })
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`);

/** Strip control characters; React escapes output, this keeps stored text tidy. */
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

export const tripInputSchema = z.object({
  name: trimmed("Trip name", 80).transform(clean),
  description: z
    .string()
    .trim()
    .max(300, "Description must be 300 characters or fewer.")
    .optional()
    .transform((v) => (v ? clean(v) : undefined)),
  currency: z.enum(CURRENCY_CODES).default(DEFAULT_CURRENCY),
});
export type TripInput = z.infer<typeof tripInputSchema>;

export const memberInputSchema = z.object({
  name: trimmed("Name", 60).transform(clean),
});

export const expenseInputSchema = z.object({
  title: trimmed("Title", 100).transform(clean),
  /** Human-typed amount, e.g. "6,000.50". Parsed on the server. */
  amount: z.string().trim().min(1, "Enter an amount."),
  category: z.enum(EXPENSE_CATEGORIES).nullish(),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or fewer.")
    .nullish()
    .transform((v) => (v ? clean(v) : null)),
  /** yyyy-mm-dd */
  spentAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date.")
    .nullish(),
  splitType: z.enum(SPLIT_TYPES),
  payers: z
    .array(z.object({ memberId: uuid, amount: z.string().trim().optional() }))
    .min(1, "Choose who paid.")
    .max(100),
  participants: z
    .array(z.object({ memberId: uuid, value: z.string().trim().optional() }))
    .min(1, "Choose at least one person to split with.")
    .max(100),
  /** Optimistic-concurrency token when editing (the expense's updatedAt as ISO string). */
  version: z.string().optional(),
});
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const settlementInputSchema = z.object({
  payerId: uuid,
  receiverId: uuid,
  amount: z.string().trim().min(1, "Enter an amount."),
});
export type SettlementInput = z.infer<typeof settlementInputSchema>;

/** Convert a typed amount into validated integer minor units. */
export function requireMinor(text: string, currency: string, label = "Amount", field = "amount"): number {
  const minor = parseMoneyToMinor(text, currency);
  if (minor === null) throw new DomainError(`${label} is not a valid amount.`, "INVALID_AMOUNT", field);
  if (minor <= 0) throw new DomainError(`${label} must be greater than zero.`, "INVALID_AMOUNT", field);
  if (minor > MAX_AMOUNT_MINOR) throw new DomainError(`${label} is too large.`, "AMOUNT_TOO_LARGE", field);
  return minor;
}

/** Convert the per-participant typed values into the numeric form the domain expects. */
export function parseParticipantValues(
  splitType: SplitType,
  participants: { memberId: string; value?: string }[],
  currency: string,
): { memberId: string; value?: number }[] {
  return participants.map((p) => {
    if (splitType === "EQUAL") return { memberId: p.memberId };
    const raw = p.value ?? "";
    let value: number | null;
    if (splitType === "EXACT") value = raw === "" ? 0 : parseMoneyToMinor(raw, currency);
    else if (splitType === "PERCENTAGE") value = raw === "" ? 0 : parsePercentToBp(raw);
    else value = raw === "" ? 0 : /^\d{1,4}$/.test(raw) ? Number(raw) : null;
    if (value === null) {
      const what = splitType === "EXACT" ? "amount" : splitType === "PERCENTAGE" ? "percentage" : "share count";
      throw new DomainError(`Enter a valid ${what} for every person.`, "INVALID_SPLIT_VALUE", "participants");
    }
    return { memberId: p.memberId, value };
  });
}
