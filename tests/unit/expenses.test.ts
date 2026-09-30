import { describe, expect, it } from "vitest";
import { calculateExpenseSplits, validatePayers } from "@/lib/expenses/calculate";
import { DomainError } from "@/lib/errors";

const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
const sum = (xs: { amountMinor: number }[]) => xs.reduce((a, x) => a + x.amountMinor, 0);
const amountOf = (xs: { memberId: string; amountMinor: number }[], id: string) =>
  xs.find((x) => x.memberId === id)!.amountMinor;

describe("calculateExpenseSplits", () => {
  it("1. equal split", () => {
    const r = calculateExpenseSplits({
      totalMinor: 120000,
      splitType: "EQUAL",
      participants: ids.slice(0, 4).map((memberId) => ({ memberId })),
    });
    expect(r.map((x) => x.amountMinor)).toEqual([30000, 30000, 30000, 30000]);
  });

  it("2. equal split with rounding never loses a paisa", () => {
    const r = calculateExpenseSplits({
      totalMinor: 10000,
      splitType: "EQUAL",
      participants: ids.slice(0, 3).map((memberId) => ({ memberId })),
    });
    expect(sum(r)).toBe(10000);
    expect(r.map((x) => x.amountMinor).sort()).toEqual([3333, 3333, 3334]);
    // deterministic regardless of input ordering
    const r2 = calculateExpenseSplits({
      totalMinor: 10000,
      splitType: "EQUAL",
      participants: ids.slice(0, 3).reverse().map((memberId) => ({ memberId })),
    });
    expect(r2).toEqual(r);
  });

  it("3. exact amounts", () => {
    const r = calculateExpenseSplits({
      totalMinor: 120000,
      splitType: "EXACT",
      participants: [
        { memberId: "a", value: 40000 },
        { memberId: "b", value: 30000 },
        { memberId: "c", value: 30000 },
        { memberId: "d", value: 20000 },
      ],
    });
    expect(amountOf(r, "a")).toBe(40000);
    expect(amountOf(r, "d")).toBe(20000);
    expect(sum(r)).toBe(120000);
  });

  it("3b. exact amounts that do not add up are rejected", () => {
    expect(() =>
      calculateExpenseSplits({
        totalMinor: 120000,
        splitType: "EXACT",
        participants: [
          { memberId: "a", value: 40000 },
          { memberId: "b", value: 30000 },
        ],
      }),
    ).toThrow(/add up/);
  });

  it("4. percentage split", () => {
    const r = calculateExpenseSplits({
      totalMinor: 100000,
      splitType: "PERCENTAGE",
      participants: [
        { memberId: "a", value: 5000 },
        { memberId: "b", value: 2500 },
        { memberId: "c", value: 2500 },
      ],
    });
    expect([amountOf(r, "a"), amountOf(r, "b"), amountOf(r, "c")]).toEqual([50000, 25000, 25000]);
  });

  it("4b. percentage split with rounding still sums to the total", () => {
    const r = calculateExpenseSplits({
      totalMinor: 10001,
      splitType: "PERCENTAGE",
      participants: [
        { memberId: "a", value: 3333 },
        { memberId: "b", value: 3333 },
        { memberId: "c", value: 3334 },
      ],
    });
    expect(sum(r)).toBe(10001);
  });

  it("4c. percentages not totalling 100 are rejected", () => {
    expect(() =>
      calculateExpenseSplits({
        totalMinor: 1000,
        splitType: "PERCENTAGE",
        participants: [
          { memberId: "a", value: 5000 },
          { memberId: "b", value: 4000 },
        ],
      }),
    ).toThrow(/100%/);
  });

  it("5. shares split", () => {
    const r = calculateExpenseSplits({
      totalMinor: 100000,
      splitType: "SHARES",
      participants: [
        { memberId: "a", value: 2 },
        { memberId: "b", value: 1 },
        { memberId: "c", value: 1 },
      ],
    });
    expect([amountOf(r, "a"), amountOf(r, "b"), amountOf(r, "c")]).toEqual([50000, 25000, 25000]);
  });

  it("5b. shares with rounding", () => {
    const r = calculateExpenseSplits({
      totalMinor: 100,
      splitType: "SHARES",
      participants: [
        { memberId: "a", value: 1 },
        { memberId: "b", value: 1 },
        { memberId: "c", value: 1 },
      ],
    });
    expect(sum(r)).toBe(100);
  });

  it("6. one person paying for everyone is just an equal split over all members", () => {
    const r = calculateExpenseSplits({
      totalMinor: 1200000,
      splitType: "EQUAL",
      participants: ids.map((memberId) => ({ memberId })),
    });
    expect(r).toHaveLength(12);
    expect(sum(r)).toBe(1200000);
    expect(r.every((x) => x.amountMinor === 100000)).toBe(true);
  });

  it("7. partial participation only charges participants", () => {
    const r = calculateExpenseSplits({
      totalMinor: 240000,
      splitType: "EQUAL",
      participants: ids.slice(0, 8).map((memberId) => ({ memberId })),
    });
    expect(r).toHaveLength(8);
    expect(r.every((x) => x.amountMinor === 30000)).toBe(true);
  });

  it("25. paise edge cases", () => {
    const one = calculateExpenseSplits({
      totalMinor: 1,
      splitType: "EQUAL",
      participants: ids.slice(0, 5).map((memberId) => ({ memberId })),
    });
    expect(sum(one)).toBe(1);
    expect(one.filter((x) => x.amountMinor === 1)).toHaveLength(1);

    const big = calculateExpenseSplits({
      totalMinor: 999_999_999,
      splitType: "EQUAL",
      participants: ids.map((memberId) => ({ memberId })),
    });
    expect(sum(big)).toBe(999_999_999);
    expect(Math.max(...big.map((x) => x.amountMinor)) - Math.min(...big.map((x) => x.amountMinor))).toBeLessThanOrEqual(1);

    const pct = calculateExpenseSplits({
      totalMinor: 999_999_999,
      splitType: "PERCENTAGE",
      participants: [
        { memberId: "a", value: 3333 },
        { memberId: "b", value: 3333 },
        { memberId: "c", value: 3334 },
      ],
    });
    expect(sum(pct)).toBe(999_999_999);
  });

  it("rejects empty, duplicate and non-positive input", () => {
    expect(() => calculateExpenseSplits({ totalMinor: 100, splitType: "EQUAL", participants: [] })).toThrow(DomainError);
    expect(() =>
      calculateExpenseSplits({ totalMinor: 100, splitType: "EQUAL", participants: [{ memberId: "a" }, { memberId: "a" }] }),
    ).toThrow(/more than once/);
    expect(() => calculateExpenseSplits({ totalMinor: 0, splitType: "EQUAL", participants: [{ memberId: "a" }] })).toThrow();
    expect(() => calculateExpenseSplits({ totalMinor: 10.5, splitType: "EQUAL", participants: [{ memberId: "a" }] })).toThrow();
  });
});

describe("validatePayers", () => {
  it("8. accepts multiple payers that add up", () => {
    expect(
      validatePayers(300000, [
        { memberId: "a", amountMinor: 200000 },
        { memberId: "b", amountMinor: 100000 },
      ]),
    ).toHaveLength(2);
  });
  it("rejects mismatched, duplicate and empty payers", () => {
    expect(() => validatePayers(300000, [{ memberId: "a", amountMinor: 100000 }])).toThrow(/add up/);
    expect(() =>
      validatePayers(200, [
        { memberId: "a", amountMinor: 100 },
        { memberId: "a", amountMinor: 100 },
      ]),
    ).toThrow(/more than once/);
    expect(() => validatePayers(200, [])).toThrow(/who paid/);
  });
});
