import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/split_expense_test?schema=public";

type Services = {
  trips: typeof import("@/lib/services/trips");
  expenses: typeof import("@/lib/services/expenses");
  settlements: typeof import("@/lib/services/settlements");
  queries: typeof import("@/lib/db/queries");
  prisma: typeof import("@/lib/db/prisma").prisma;
};
let s: Services;

beforeAll(async () => {
  s = {
    trips: await import("@/lib/services/trips"),
    expenses: await import("@/lib/services/expenses"),
    settlements: await import("@/lib/services/settlements"),
    queries: await import("@/lib/db/queries"),
    prisma: (await import("@/lib/db/prisma")).prisma,
  };
});
afterAll(async () => {
  await s.prisma.$disconnect();
});

async function setup(names = ["Tarun", "Rahul", "Amit", "Rohit"]) {
  const trip = await s.trips.createTrip({ name: `Test ${Math.random()}`, currency: "INR" });
  const ids: Record<string, string> = {};
  for (const n of names) ids[n] = (await s.trips.addMember(trip.id, { name: n })).id;
  return { tripId: trip.id, ids };
}
const net = (l: NonNullable<Awaited<ReturnType<Services["queries"]["getTripLedger"]>>>, id: string) =>
  l.balances.find((b) => b.memberId === id)!.net;

describe("service layer (real database)", () => {
  it("creates an expense with payers and splits, and derives balances", async () => {
    const { tripId, ids } = await setup();
    await s.expenses.createExpense(tripId, {
      title: "Hotel",
      amount: "6000",
      category: "HOTEL",
      splitType: "EQUAL",
      payers: [{ memberId: ids.Tarun }],
      participants: Object.values(ids).map((memberId) => ({ memberId })),
    });
    const l = (await s.queries.getTripLedger(tripId))!;
    expect(l.summary.totalSpent).toBe(600000);
    expect(net(l, ids.Tarun)).toBe(450000);
    expect(net(l, ids.Rahul)).toBe(-150000);
    expect(l.suggestions).toHaveLength(3);
  });

  it("supports exact, percentage, shares and multiple payers", async () => {
    const { tripId, ids } = await setup(["A", "B", "C"]);
    await s.expenses.createExpense(tripId, {
      title: "Dinner",
      amount: "3000",
      splitType: "EXACT",
      payers: [
        { memberId: ids.A, amount: "2000" },
        { memberId: ids.B, amount: "1000" },
      ],
      participants: [
        { memberId: ids.A, value: "1000" },
        { memberId: ids.B, value: "1500" },
        { memberId: ids.C, value: "500" },
      ],
    });
    await s.expenses.createExpense(tripId, {
      title: "Fuel",
      amount: "100",
      splitType: "PERCENTAGE",
      payers: [{ memberId: ids.C }],
      participants: [
        { memberId: ids.A, value: "33.33" },
        { memberId: ids.B, value: "33.33" },
        { memberId: ids.C, value: "33.34" },
      ],
    });
    await s.expenses.createExpense(tripId, {
      title: "Snacks",
      amount: "100",
      splitType: "SHARES",
      payers: [{ memberId: ids.C }],
      participants: [
        { memberId: ids.A, value: "2" },
        { memberId: ids.B, value: "1" },
        { memberId: ids.C, value: "1" },
      ],
    });
    const l = (await s.queries.getTripLedger(tripId))!;
    expect(l.balances.reduce((a, b) => a + b.net, 0)).toBe(0);
    expect(l.expenses).toHaveLength(3);
  });

  it("rejects invalid input and foreign members", async () => {
    const one = await setup(["A", "B"]);
    const other = await setup(["X"]);
    const base = {
      title: "Bad",
      amount: "100",
      splitType: "EQUAL",
      payers: [{ memberId: one.ids.A }],
      participants: [{ memberId: one.ids.A }, { memberId: one.ids.B }],
    };
    await expect(s.expenses.createExpense(one.tripId, { ...base, amount: "0" })).rejects.toThrow();
    await expect(s.expenses.createExpense(one.tripId, { ...base, amount: "abc" })).rejects.toThrow();
    await expect(s.expenses.createExpense(one.tripId, { ...base, title: "  " })).rejects.toThrow();
    await expect(s.expenses.createExpense(one.tripId, { ...base, participants: [] })).rejects.toThrow();
    await expect(
      s.expenses.createExpense(one.tripId, { ...base, splitType: "EXACT", participants: [{ memberId: one.ids.A, value: "50" }] }),
    ).rejects.toThrow(/add up/);
    // cross-trip member
    await expect(
      s.expenses.createExpense(one.tripId, { ...base, payers: [{ memberId: other.ids.X }] }),
    ).rejects.toThrow(/not part of the trip/);
    expect((await s.queries.getTripLedger(one.tripId))!.expenses).toHaveLength(0);
  });

  it("22. edits an expense and balances follow", async () => {
    const { tripId, ids } = await setup(["A", "B"]);
    const { id } = await s.expenses.createExpense(tripId, {
      title: "Cab",
      amount: "1000",
      splitType: "EQUAL",
      payers: [{ memberId: ids.A }],
      participants: [{ memberId: ids.A }, { memberId: ids.B }],
    });
    const before = (await s.queries.getTripLedger(tripId))!;
    expect(net(before, ids.B)).toBe(-50000);
    await s.expenses.updateExpense(tripId, id, {
      title: "Cab",
      amount: "2000",
      splitType: "EQUAL",
      payers: [{ memberId: ids.A }],
      participants: [{ memberId: ids.A }, { memberId: ids.B }],
      version: before.expenses[0].updatedAt.toISOString(),
    });
    const after = (await s.queries.getTripLedger(tripId))!;
    expect(net(after, ids.B)).toBe(-100000);
    // stale version is rejected
    await expect(
      s.expenses.updateExpense(tripId, id, {
        title: "Cab",
        amount: "5",
        splitType: "EQUAL",
        payers: [{ memberId: ids.A }],
        participants: [{ memberId: ids.A }],
        version: before.expenses[0].updatedAt.toISOString(),
      }),
    ).rejects.toThrow(/changed by someone else/);
  });

  it("23. deletes and duplicates expenses; cannot touch another trip's expense", async () => {
    const a = await setup(["A", "B"]);
    const b = await setup(["X", "Y"]);
    const { id } = await s.expenses.createExpense(a.tripId, {
      title: "Toll",
      amount: "300",
      splitType: "EQUAL",
      payers: [{ memberId: a.ids.A }],
      participants: [{ memberId: a.ids.A }, { memberId: a.ids.B }],
    });
    await expect(s.expenses.deleteExpense(b.tripId, id)).rejects.toThrow(/already deleted/);
    await s.expenses.duplicateExpense(a.tripId, id);
    expect((await s.queries.getTripLedger(a.tripId))!.expenses).toHaveLength(2);
    await s.expenses.deleteExpense(a.tripId, id);
    const l = (await s.queries.getTripLedger(a.tripId))!;
    expect(l.expenses).toHaveLength(1);
    expect(net(l, a.ids.B)).toBe(-15000);
  });

  it("24/20/21. settlements: mark paid, partial, over-settlement blocked, revert", async () => {
    const { tripId, ids } = await setup(["A", "B", "C"]);
    await s.expenses.createExpense(tripId, {
      title: "Hotel",
      amount: "3000",
      splitType: "EQUAL",
      payers: [{ memberId: ids.A }],
      participants: Object.values(ids).map((memberId) => ({ memberId })),
    });
    const { id: partial } = await s.settlements.createSettlement(tripId, { payerId: ids.B, receiverId: ids.A, amount: "400" });
    let l = (await s.queries.getTripLedger(tripId))!;
    expect(net(l, ids.B)).toBe(-60000);
    expect(l.suggestions.find((x) => x.fromId === ids.B)?.amountMinor).toBe(60000);

    await expect(
      s.settlements.createSettlement(tripId, { payerId: ids.B, receiverId: ids.A, amount: "700" }),
    ).rejects.toThrow(/more than is currently outstanding/);
    await expect(
      s.settlements.createSettlement(tripId, { payerId: ids.A, receiverId: ids.B, amount: "1" }),
    ).rejects.toThrow();
    await expect(
      s.settlements.createSettlement(tripId, { payerId: ids.B, receiverId: ids.B, amount: "1" }),
    ).rejects.toThrow();

    // concurrent duplicate submissions can't over-settle
    const results = await Promise.allSettled([
      s.settlements.createSettlement(tripId, { payerId: ids.C, receiverId: ids.A, amount: "1000" }),
      s.settlements.createSettlement(tripId, { payerId: ids.C, receiverId: ids.A, amount: "1000" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    await s.settlements.revertSettlement(tripId, partial);
    l = (await s.queries.getTripLedger(tripId))!;
    expect(net(l, ids.B)).toBe(-100000);
    expect(l.settlements.find((x) => x.id === partial)?.status).toBe("REVERTED");
    await expect(s.settlements.revertSettlement(tripId, partial)).rejects.toThrow(/already reverted/);
  });

  it("removes members only when they have no financial history", async () => {
    const { tripId, ids } = await setup(["A", "B", "C"]);
    await s.expenses.createExpense(tripId, {
      title: "Snacks",
      amount: "100",
      splitType: "EQUAL",
      payers: [{ memberId: ids.A }],
      participants: [{ memberId: ids.A }, { memberId: ids.B }],
    });
    await expect(s.trips.removeMember(tripId, ids.A)).rejects.toThrow(/can't be removed/);
    await s.trips.removeMember(tripId, ids.C);
    await s.trips.renameMember(tripId, ids.B, { name: "Bobby" });
    await expect(s.trips.addMember(tripId, { name: "bobby" })).rejects.toThrow(/already in this trip/);
    await expect(s.trips.addMember(tripId, { name: "  " })).rejects.toThrow();
    const l = (await s.queries.getTripLedger(tripId))!;
    expect(l.members.map((m) => m.name).sort()).toEqual(["A", "Bobby"]);
  });
});
