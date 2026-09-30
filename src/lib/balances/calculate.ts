import { DomainError } from "../errors";

export interface BalanceExpense {
  payers: { memberId: string; amountMinor: number }[];
  splits: { memberId: string; amountMinor: number }[];
}

export interface BalanceSettlement {
  payerId: string;
  receiverId: string;
  amountMinor: number;
  /** Only COMPLETED settlements affect balances. */
  status: "COMPLETED" | "REVERTED";
}

export interface MemberBalance {
  memberId: string;
  /** Total paid towards expenses. */
  paid: number;
  /** Total share of expenses owed. */
  share: number;
  /** Money this member has paid to others via settlements. */
  settlementsPaid: number;
  /** Money this member has received via settlements. */
  settlementsReceived: number;
  /** paid - share + settlementsPaid - settlementsReceived. Positive => gets back. */
  net: number;
}

export type BalanceStatus = "gets_back" | "owes" | "settled";

export function balanceStatus(net: number): BalanceStatus {
  return net > 0 ? "gets_back" : net < 0 ? "owes" : "settled";
}

/** Derive every member's balance from expenses and settlements. Nothing is stored. */
export function calculateMemberBalances(input: {
  memberIds: string[];
  expenses: BalanceExpense[];
  settlements: BalanceSettlement[];
}): MemberBalance[] {
  const map = new Map<string, MemberBalance>();
  for (const memberId of input.memberIds) {
    map.set(memberId, { memberId, paid: 0, share: 0, settlementsPaid: 0, settlementsReceived: 0, net: 0 });
  }
  const get = (id: string) => {
    const b = map.get(id);
    if (!b) throw new DomainError("A record references someone who is not in this trip.", "UNKNOWN_MEMBER");
    return b;
  };

  for (const e of input.expenses) {
    for (const p of e.payers) get(p.memberId).paid += p.amountMinor;
    for (const s of e.splits) get(s.memberId).share += s.amountMinor;
  }
  for (const s of input.settlements) {
    if (s.status !== "COMPLETED") continue;
    get(s.payerId).settlementsPaid += s.amountMinor;
    get(s.receiverId).settlementsReceived += s.amountMinor;
  }
  const result = [...map.values()];
  for (const b of result) b.net = b.paid - b.share + b.settlementsPaid - b.settlementsReceived;
  return result;
}

export interface OutstandingBalances {
  /** Members who should receive money, largest first. */
  creditors: { memberId: string; amountMinor: number }[];
  /** Members who owe money, largest first. */
  debtors: { memberId: string; amountMinor: number }[];
  /** Total still to be paid between members. */
  totalOutstanding: number;
}

export function calculateOutstandingBalances(
  balances: Pick<MemberBalance, "memberId" | "net">[],
): OutstandingBalances {
  const order = (a: { memberId: string; amountMinor: number }, b: { memberId: string; amountMinor: number }) =>
    b.amountMinor - a.amountMinor || (a.memberId < b.memberId ? -1 : 1);
  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ memberId: b.memberId, amountMinor: b.net }))
    .sort(order);
  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ memberId: b.memberId, amountMinor: -b.net }))
    .sort(order);
  return {
    creditors,
    debtors,
    totalOutstanding: creditors.reduce((a, c) => a + c.amountMinor, 0),
  };
}
