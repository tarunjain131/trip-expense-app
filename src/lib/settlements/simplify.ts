import { DomainError } from "../errors";

export interface SuggestedSettlement {
  fromId: string;
  toId: string;
  amountMinor: number;
}

/** Above this many non-zero balances the exact search is skipped in favour of a greedy pass. */
const EXACT_SEARCH_LIMIT = 16;

interface Entry {
  id: string;
  amount: number; // signed: + gets back, - owes
}

/**
 * Turn net balances into a small set of payments that settles everybody.
 *
 * Works purely from net balances (never pairwise expense matching). Settling a
 * group of k people takes at most k-1 payments, so the number of payments is
 * minimised by splitting the balances into the largest possible number of
 * independent zero-sum groups. For up to 16 non-zero balances this is solved
 * exactly with a bitmask DP; beyond that a greedy fallback (exact matches first,
 * then largest debtor -> largest creditor) is used.
 */
export function calculateSettlements(balances: { memberId: string; net: number }[]): SuggestedSettlement[] {
  const entries: Entry[] = balances
    .filter((b) => b.net !== 0)
    .map((b) => ({ id: b.memberId, amount: b.net }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  if (entries.reduce((a, e) => a + e.amount, 0) !== 0) {
    throw new DomainError("Balances do not add up to zero.", "UNBALANCED");
  }
  if (entries.length === 0) return [];

  const groups = entries.length <= EXACT_SEARCH_LIMIT ? partitionZeroSumGroups(entries) : greedyPrepass(entries);

  const result: SuggestedSettlement[] = [];
  for (const group of groups) result.push(...settleGroup(group));
  return result.sort(
    (a, b) =>
      b.amountMinor - a.amountMinor ||
      (a.fromId < b.fromId ? -1 : a.fromId > b.fromId ? 1 : a.toId < b.toId ? -1 : 1),
  );
}

/** Max partition of entries into zero-sum subsets via DP over bitmasks. */
function partitionZeroSumGroups(entries: Entry[]): Entry[][] {
  const n = entries.length;
  const size = 1 << n;
  const sum = new Float64Array(size);
  for (let mask = 1; mask < size; mask++) {
    const low = mask & -mask;
    sum[mask] = sum[mask ^ low] + entries[31 - Math.clz32(low)].amount;
  }
  const best = new Int16Array(size);
  const choice = new Int8Array(size);
  for (let mask = 1; mask < size; mask++) {
    let bestVal = -1;
    let bestI = 0;
    for (let i = 0; i < n; i++) {
      if (!(mask & (1 << i))) continue;
      const v = best[mask ^ (1 << i)];
      if (v > bestVal) {
        bestVal = v;
        bestI = i;
      }
    }
    best[mask] = bestVal + (sum[mask] === 0 ? 1 : 0);
    choice[mask] = bestI;
  }
  // Walk the removal chain from the full set; the reversed order is a build-up
  // sequence in which every zero prefix-sum closes an independent group.
  const order: number[] = [];
  let mask = size - 1;
  while (mask) {
    const i = choice[mask];
    order.push(i);
    mask ^= 1 << i;
  }
  order.reverse();

  const groups: Entry[][] = [];
  let current: Entry[] = [];
  let running = 0;
  for (const i of order) {
    current.push(entries[i]);
    running += entries[i].amount;
    if (running === 0) {
      groups.push(current);
      current = [];
    }
  }
  return groups;
}

/** For large groups: peel off exact debtor/creditor matches, leave the rest as one group. */
function greedyPrepass(entries: Entry[]): Entry[][] {
  const groups: Entry[][] = [];
  const credit = entries.filter((e) => e.amount > 0);
  const debt = entries.filter((e) => e.amount < 0);
  const rest: Entry[] = [];
  const usedDebt = new Set<number>();
  for (const c of credit) {
    const idx = debt.findIndex((d, i) => !usedDebt.has(i) && -d.amount === c.amount);
    if (idx >= 0) {
      usedDebt.add(idx);
      groups.push([c, debt[idx]]);
    } else rest.push(c);
  }
  debt.forEach((d, i) => {
    if (!usedDebt.has(i)) rest.push(d);
  });
  if (rest.length) groups.push(rest);
  return groups;
}

/** Settle one zero-sum group with at most (size - 1) payments. */
function settleGroup(group: Entry[]): SuggestedSettlement[] {
  const cmp = (a: Entry, b: Entry) => Math.abs(b.amount) - Math.abs(a.amount) || (a.id < b.id ? -1 : 1);
  const creditors = group.filter((e) => e.amount > 0).map((e) => ({ ...e })).sort(cmp);
  const debtors = group.filter((e) => e.amount < 0).map((e) => ({ ...e })).sort(cmp);
  const out: SuggestedSettlement[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const pay = Math.min(c.amount, -d.amount);
    out.push({ fromId: d.id, toId: c.id, amountMinor: pay });
    c.amount -= pay;
    d.amount += pay;
    if (c.amount === 0) ci++;
    if (d.amount === 0) di++;
  }
  return out;
}
