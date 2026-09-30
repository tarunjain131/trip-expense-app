import { DomainError } from "../errors";
import type { ExpenseSplitResult, PayerInput, SplitParticipantInput, SplitType } from "./types";

export const TOTAL_BASIS_POINTS = 10_000;

/**
 * Distribute `total` across `weights` using the largest-remainder method so the
 * parts always sum exactly to `total`. Ties on the remainder are broken by
 * `ids` (ascending) so results are fully deterministic.
 */
export function allocateProportionally(total: number, weights: number[], ids: string[]): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) throw new DomainError("Nothing to split between.", "NO_WEIGHT");

  const base = weights.map((w) => Math.floor((total * w) / weightSum));
  const remainders = weights.map((w) => (total * w) % weightSum);
  let leftover = total - base.reduce((a, b) => a + b, 0);

  const order = weights
    .map((_, i) => i)
    .sort((a, b) => remainders[b] - remainders[a] || (ids[a] < ids[b] ? -1 : ids[a] > ids[b] ? 1 : 0));
  for (const i of order) {
    if (leftover === 0) break;
    base[i] += 1;
    leftover -= 1;
  }
  return base;
}

function assertPositiveInt(n: unknown, label: string): asserts n is number {
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n <= 0) {
    throw new DomainError(`${label} must be greater than zero.`, "INVALID_AMOUNT");
  }
}

function nonNegativeInts(participants: SplitParticipantInput[], message: string, code: string): number[] {
  return participants.map((p) => {
    if (typeof p.value !== "number" || !Number.isSafeInteger(p.value) || p.value < 0) {
      throw new DomainError(message, code, "participants");
    }
    return p.value;
  });
}

/** Split an expense between participants. Pure and deterministic. */
export function calculateExpenseSplits(input: {
  totalMinor: number;
  splitType: SplitType;
  participants: SplitParticipantInput[];
}): ExpenseSplitResult[] {
  const { totalMinor, splitType, participants } = input;
  assertPositiveInt(totalMinor, "Amount");
  if (participants.length === 0) {
    throw new DomainError("Choose at least one person to split with.", "NO_PARTICIPANTS", "participants");
  }
  const ids = participants.map((p) => p.memberId);
  if (new Set(ids).size !== ids.length) {
    throw new DomainError("A person appears more than once in the split.", "DUPLICATE_PARTICIPANT", "participants");
  }
  // Canonical order (by member id) keeps output independent of input ordering.
  const sorted = [...participants].sort((a, b) => (a.memberId < b.memberId ? -1 : 1));
  const sortedIds = sorted.map((p) => p.memberId);

  switch (splitType) {
    case "EQUAL": {
      const amounts = allocateProportionally(totalMinor, sorted.map(() => 1), sortedIds);
      return sorted.map((p, i) => ({ memberId: p.memberId, amountMinor: amounts[i], value: null }));
    }
    case "EXACT": {
      const values = nonNegativeInts(sorted, "Enter a valid amount for every person.", "INVALID_AMOUNT");
      if (values.reduce((a, b) => a + b, 0) !== totalMinor) {
        throw new DomainError("Exact amounts must add up to the expense total.", "EXACT_SUM_MISMATCH", "participants");
      }
      return sorted.map((p, i) => ({ memberId: p.memberId, amountMinor: values[i], value: values[i] }));
    }
    case "PERCENTAGE": {
      const values = nonNegativeInts(sorted, "Enter a valid percentage for every person.", "INVALID_PERCENT");
      if (values.reduce((a, b) => a + b, 0) !== TOTAL_BASIS_POINTS) {
        throw new DomainError("Percentages must add up to 100%.", "PERCENT_SUM_MISMATCH", "participants");
      }
      const amounts = allocateProportionally(totalMinor, values, sortedIds);
      return sorted.map((p, i) => ({ memberId: p.memberId, amountMinor: amounts[i], value: values[i] }));
    }
    case "SHARES": {
      const values = nonNegativeInts(sorted, "Shares must be whole numbers.", "INVALID_SHARES");
      if (values.every((v) => v === 0)) {
        throw new DomainError("Give at least one person a share.", "NO_SHARES", "participants");
      }
      const amounts = allocateProportionally(totalMinor, values, sortedIds);
      return sorted.map((p, i) => ({ memberId: p.memberId, amountMinor: amounts[i], value: values[i] }));
    }
    default:
      throw new DomainError("Unknown split type.", "INVALID_SPLIT_TYPE");
  }
}

/** Validate the payer list of an expense (supports multiple payers). */
export function validatePayers(totalMinor: number, payers: PayerInput[]): PayerInput[] {
  if (payers.length === 0) {
    throw new DomainError("Choose who paid.", "NO_PAYER", "payers");
  }
  const ids = payers.map((p) => p.memberId);
  if (new Set(ids).size !== ids.length) {
    throw new DomainError("A payer appears more than once.", "DUPLICATE_PAYER", "payers");
  }
  for (const p of payers) assertPositiveInt(p.amountMinor, "Each payer amount");
  const sum = payers.reduce((a, p) => a + p.amountMinor, 0);
  if (sum !== totalMinor) {
    throw new DomainError("The amounts paid must add up to the expense total.", "PAYER_SUM_MISMATCH", "payers");
  }
  return payers;
}
