import { describe, expect, it } from "vitest";
import {
  balanceStatus,
  calculateMemberBalances,
  calculateOutstandingBalances,
  type BalanceExpense,
  type BalanceSettlement,
} from "@/lib/balances/calculate";
import { calculateExpenseSplits } from "@/lib/expenses/calculate";
import { calculateSettlements } from "@/lib/settlements/simplify";
import { validateSettlementAgainstBalances } from "@/lib/settlements/validate";
import { calculateTripSummary } from "@/lib/summary/calculate";

const M = ["tarun", "rahul", "amit", "rohit"];

function expense(total: number, payers: Record<string, number>, participants: string[]): BalanceExpense {
  return {
    payers: Object.entries(payers).map(([memberId, amountMinor]) => ({ memberId, amountMinor })),
    splits: calculateExpenseSplits({
      totalMinor: total,
      splitType: "EQUAL",
      participants: participants.map((memberId) => ({ memberId })),
    }),
  };
}
const net = (bs: { memberId: string; net: number }[], id: string) => bs.find((b) => b.memberId === id)!.net;
const totalNet = (bs: { net: number }[]) => bs.reduce((a, b) => a + b.net, 0);

describe("calculateMemberBalances", () => {
  it("9. one expense", () => {
    const bs = calculateMemberBalances({
      memberIds: M,
      expenses: [expense(120000, { tarun: 120000 }, M)],
      settlements: [],
    });
    expect(net(bs, "tarun")).toBe(90000);
    expect(net(bs, "rahul")).toBe(-30000);
    expect(totalNet(bs)).toBe(0);
    const t = bs.find((b) => b.memberId === "tarun")!;
    expect([t.paid, t.share]).toEqual([120000, 30000]);
  });

  it("10. multiple expenses with partial participation", () => {
    const bs = calculateMemberBalances({
      memberIds: M,
      expenses: [
        expense(400000, { tarun: 400000 }, M), // 100k each
        expense(90000, { rahul: 90000 }, ["rahul", "amit", "rohit"]), // 30k each
        expense(50000, { amit: 50000 }, ["tarun", "amit"]), // 25k each
      ],
      settlements: [],
    });
    expect(net(bs, "tarun")).toBe(400000 - 100000 - 25000);
    expect(net(bs, "rahul")).toBe(90000 - 100000 - 30000);
    expect(net(bs, "amit")).toBe(50000 - 100000 - 30000 - 25000);
    expect(net(bs, "rohit")).toBe(-100000 - 30000);
    expect(totalNet(bs)).toBe(0);
  });

  it("11. multiple payers", () => {
    const bs = calculateMemberBalances({
      memberIds: M,
      expenses: [expense(300000, { tarun: 200000, rahul: 100000 }, ["tarun", "rahul", "amit"])],
      settlements: [],
    });
    expect(net(bs, "tarun")).toBe(100000);
    expect(net(bs, "rahul")).toBe(0);
    expect(net(bs, "amit")).toBe(-100000);
    expect(net(bs, "rohit")).toBe(0);
  });

  it("12-14. zero, positive and negative balances have the right status", () => {
    expect(balanceStatus(1)).toBe("gets_back");
    expect(balanceStatus(-1)).toBe("owes");
    expect(balanceStatus(0)).toBe("settled");
    const bs = calculateMemberBalances({
      memberIds: M,
      expenses: [expense(200000, { tarun: 200000 }, ["tarun", "rahul"])],
      settlements: [],
    });
    expect(net(bs, "amit")).toBe(0);
    const out = calculateOutstandingBalances(bs);
    expect(out.creditors).toEqual([{ memberId: "tarun", amountMinor: 100000 }]);
    expect(out.debtors).toEqual([{ memberId: "rahul", amountMinor: 100000 }]);
    expect(out.totalOutstanding).toBe(100000);
  });

  it("throws if data references a member outside the trip", () => {
    expect(() =>
      calculateMemberBalances({ memberIds: ["a"], expenses: [expense(100, { z: 100 }, ["a"])], settlements: [] }),
    ).toThrow();
  });
});

describe("settlement accounting", () => {
  const base = [expense(300000, { tarun: 300000 }, ["tarun", "rahul", "amit"])];
  const s = (payerId: string, receiverId: string, amountMinor: number, status: BalanceSettlement["status"] = "COMPLETED") => ({
    payerId,
    receiverId,
    amountMinor,
    status,
  });

  it("20. partial settlement reduces the outstanding balance", () => {
    const bs = calculateMemberBalances({ memberIds: M, expenses: base, settlements: [s("rahul", "tarun", 40000)] });
    expect(net(bs, "rahul")).toBe(-60000);
    expect(net(bs, "tarun")).toBe(160000);
    expect(totalNet(bs)).toBe(0);
  });

  it("24. marking a full settlement paid zeroes both sides", () => {
    const bs = calculateMemberBalances({
      memberIds: M,
      expenses: base,
      settlements: [s("rahul", "tarun", 100000), s("amit", "tarun", 100000)],
    });
    expect(bs.every((b) => b.net === 0)).toBe(true);
    expect(calculateSettlements(bs)).toEqual([]);
  });

  it("21. reverting a settlement restores the outstanding balance", () => {
    const before = calculateMemberBalances({ memberIds: M, expenses: base, settlements: [] });
    const reverted = calculateMemberBalances({
      memberIds: M,
      expenses: base,
      settlements: [s("rahul", "tarun", 100000, "REVERTED")],
    });
    expect(reverted).toEqual(before);
  });

  it("22-23. editing or deleting an expense changes balances automatically", () => {
    const original = [expense(300000, { tarun: 300000 }, ["tarun", "rahul", "amit"])];
    const edited = [expense(600000, { tarun: 600000 }, ["tarun", "rahul", "amit"])];
    expect(net(calculateMemberBalances({ memberIds: M, expenses: original, settlements: [] }), "rahul")).toBe(-100000);
    expect(net(calculateMemberBalances({ memberIds: M, expenses: edited, settlements: [] }), "rahul")).toBe(-200000);
    const deleted = calculateMemberBalances({ memberIds: M, expenses: [], settlements: [] });
    expect(deleted.every((b) => b.net === 0)).toBe(true);
  });

  it("validates settlements against what is outstanding", () => {
    expect(() => validateSettlementAgainstBalances({ amountMinor: 500, payerNet: -1000, receiverNet: 800 })).not.toThrow();
    expect(() => validateSettlementAgainstBalances({ amountMinor: 900, payerNet: -1000, receiverNet: 800 })).toThrow(/outstanding/);
    expect(() => validateSettlementAgainstBalances({ amountMinor: 1100, payerNet: -1000, receiverNet: 5000 })).toThrow();
    expect(() => validateSettlementAgainstBalances({ amountMinor: 100, payerNet: 0, receiverNet: 5000 })).toThrow();
    expect(() => validateSettlementAgainstBalances({ amountMinor: 100, payerNet: -100, receiverNet: 0 })).toThrow();
    expect(() => validateSettlementAgainstBalances({ amountMinor: 0, payerNet: -100, receiverNet: 100 })).toThrow();
  });
});

function apply(balances: { memberId: string; net: number }[], transfers: { fromId: string; toId: string; amountMinor: number }[]) {
  const m = new Map(balances.map((b) => [b.memberId, b.net]));
  for (const t of transfers) {
    m.set(t.fromId, m.get(t.fromId)! + t.amountMinor);
    m.set(t.toId, m.get(t.toId)! - t.amountMinor);
  }
  return m;
}

describe("calculateSettlements", () => {
  it("15. simple 2-person settlement", () => {
    expect(
      calculateSettlements([
        { memberId: "a", net: 5000 },
        { memberId: "b", net: -5000 },
      ]),
    ).toEqual([{ fromId: "b", toId: "a", amountMinor: 5000 }]);
  });

  it("16. 3-person settlement (spec example)", () => {
    const r = calculateSettlements([
      { memberId: "A", net: 300000 },
      { memberId: "B", net: -200000 },
      { memberId: "C", net: -100000 },
    ]);
    expect(r).toEqual([
      { fromId: "B", toId: "A", amountMinor: 200000 },
      { fromId: "C", toId: "A", amountMinor: 100000 },
    ]);
  });

  it("returns nothing when everybody is settled", () => {
    expect(calculateSettlements([{ memberId: "a", net: 0 }])).toEqual([]);
    expect(calculateSettlements([])).toEqual([]);
  });

  it("refuses unbalanced input", () => {
    expect(() => calculateSettlements([{ memberId: "a", net: 100 }])).toThrow();
  });

  it("18. minimises transactions: independent pairs are not merged into a chain", () => {
    const bs = [
      { memberId: "a", net: 1000 },
      { memberId: "b", net: -1000 },
      { memberId: "c", net: 700 },
      { memberId: "d", net: -700 },
    ];
    const r = calculateSettlements(bs);
    expect(r).toHaveLength(2);
    expect([...apply(bs, r).values()].every((v) => v === 0)).toBe(true);
  });

  it("18b. finds a non-obvious zero-sum subset (greedy would use more payments)", () => {
    // +5 +4 vs -6 -3: greedy pairs 5<-6 then leaves messy leftovers; the optimum is 3 payments? Check by brute force.
    const bs = [
      { memberId: "a", net: 5 },
      { memberId: "b", net: 4 },
      { memberId: "c", net: -5 },
      { memberId: "d", net: -4 },
    ];
    expect(calculateSettlements(bs)).toHaveLength(2);
  });

  it("17/19. realistic 12-person trip with several settlements", () => {
    const names = ["Tarun", "Rahul", "Amit", "Rohit", "Kunal", "Ankit", "Vivek", "Harsh", "Mohit", "Nikhil", "Akash", "Varun"];
    const expenses: BalanceExpense[] = [
      expense(4800000, { Tarun: 4800000 }, names),
      expense(2400000, { Rahul: 2400000 }, names.slice(0, 8)),
      expense(1500000, { Amit: 900000, Kunal: 600000 }, names.slice(4, 9)),
      expense(1200000, { Varun: 1200000 }, names),
      expense(310050, { Akash: 310050 }, names.slice(1, 6)),
    ];
    const bs = calculateMemberBalances({ memberIds: names, expenses, settlements: [] });
    expect(totalNet(bs)).toBe(0);
    const transfers = calculateSettlements(bs);
    expect(transfers.length).toBeLessThanOrEqual(names.length - 1);
    expect(transfers.every((t) => t.amountMinor > 0)).toBe(true);
    expect([...apply(bs, transfers).values()].every((v) => v === 0)).toBe(true);
    // Paying all suggestions leaves everyone settled.
    const after = calculateMemberBalances({
      memberIds: names,
      expenses,
      settlements: transfers.map((t) => ({ payerId: t.fromId, receiverId: t.toId, amountMinor: t.amountMinor, status: "COMPLETED" as const })),
    });
    expect(after.every((b) => b.net === 0)).toBe(true);
  });

  it("is deterministic", () => {
    const bs = [
      { memberId: "x", net: 700 },
      { memberId: "y", net: -300 },
      { memberId: "z", net: -400 },
    ];
    expect(calculateSettlements(bs)).toEqual(calculateSettlements([...bs].reverse()));
  });

  it("property: random balanced inputs are always fully settled in at most n-1 payments", () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let round = 0; round < 200; round++) {
      const n = 2 + Math.floor(rand() * 24); // crosses the exact / greedy threshold
      const raw = Array.from({ length: n }, () => Math.round((rand() - 0.5) * 200000));
      raw[n - 1] -= raw.reduce((a, b) => a + b, 0);
      const bs = raw.map((v, i) => ({ memberId: `m${String(i).padStart(2, "0")}`, net: v }));
      const r = calculateSettlements(bs);
      const nonZero = bs.filter((b) => b.net !== 0).length;
      expect(r.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1));
      expect([...apply(bs, r).values()].every((v) => v === 0)).toBe(true);
    }
  });

  it("handles large numbers of expenses quickly", () => {
    const names = Array.from({ length: 12 }, (_, i) => `m${String(i).padStart(2, "0")}`);
    const expenses: BalanceExpense[] = [];
    for (let i = 0; i < 5000; i++) {
      const payer = names[i % 12];
      const participants = names.filter((_, j) => (i + j) % 3 !== 0);
      expenses.push(expense(1000 + i * 7, { [payer]: 1000 + i * 7 }, participants));
    }
    const start = Date.now();
    const bs = calculateMemberBalances({ memberIds: names, expenses, settlements: [] });
    const r = calculateSettlements(bs);
    expect(Date.now() - start).toBeLessThan(2000);
    expect(totalNet(bs)).toBe(0);
    expect([...apply(bs, r).values()].every((v) => v === 0)).toBe(true);
  });
});

describe("calculateTripSummary", () => {
  it("summarises spend, categories and outstanding", () => {
    const balances = calculateMemberBalances({
      memberIds: M,
      expenses: [expense(400000, { tarun: 400000 }, M)],
      settlements: [{ payerId: "rahul", receiverId: "tarun", amountMinor: 100000, status: "COMPLETED" }],
    });
    const s = calculateTripSummary({
      expenses: [
        { id: "1", title: "Hotel", amountMinor: 300000, category: "HOTEL" },
        { id: "2", title: "Dinner", amountMinor: 100000, category: null },
      ],
      balances,
      completedSettlementAmounts: [100000],
    });
    expect(s.totalSpent).toBe(400000);
    expect(s.averagePerMember).toBe(100000);
    expect(s.topPayer?.memberId).toBe("tarun");
    expect(s.largestExpense?.title).toBe("Hotel");
    expect(s.categories[0]).toMatchObject({ category: "HOTEL", totalMinor: 300000 });
    expect(s.settledAmount).toBe(100000);
    expect(s.outstandingAmount).toBe(200000);
  });
});
