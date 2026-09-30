import { describe, expect, it } from "vitest";
import {
  bpToPercentString,
  formatMoney,
  formatSignedMoney,
  minorToInputString,
  parseMoneyToMinor,
  parsePercentToBp,
} from "@/lib/money";

describe("parseMoneyToMinor", () => {
  it("parses whole and decimal amounts without float error", () => {
    expect(parseMoneyToMinor("100.50")).toBe(10050);
    expect(parseMoneyToMinor("6000")).toBe(600000);
    expect(parseMoneyToMinor("₹1,200")).toBe(120000);
    expect(parseMoneyToMinor("0.1")).toBe(10);
    expect(parseMoneyToMinor("19.99")).toBe(1999);
    expect(parseMoneyToMinor("1.005")).toBeNull();
    expect(parseMoneyToMinor(".5")).toBe(50);
  });
  it("rejects garbage", () => {
    expect(parseMoneyToMinor("")).toBeNull();
    expect(parseMoneyToMinor("abc")).toBeNull();
    expect(parseMoneyToMinor("1.2.3")).toBeNull();
    expect(parseMoneyToMinor("-5")).toBeNull();
    expect(parseMoneyToMinor(".")).toBeNull();
  });
});

describe("percent helpers", () => {
  it("round-trips basis points", () => {
    expect(parsePercentToBp("33.33")).toBe(3333);
    expect(parsePercentToBp("50%")).toBe(5000);
    expect(parsePercentToBp("12.345")).toBeNull();
    expect(bpToPercentString(3333)).toBe("33.33");
    expect(bpToPercentString(5000)).toBe("50");
    expect(bpToPercentString(1050)).toBe("10.5");
  });
});

describe("formatting", () => {
  it("formats INR with Indian grouping", () => {
    expect(formatMoney(4285000)).toBe("₹42,850");
    expect(formatMoney(10050)).toBe("₹100.50");
    expect(formatMoney(0)).toBe("₹0");
    expect(formatMoney(12345678900)).toBe("₹12,34,56,789");
  });
  it("formats signed values", () => {
    expect(formatSignedMoney(280000)).toBe("+₹2,800");
    expect(formatSignedMoney(-200000)).toBe("-₹2,000");
    expect(formatSignedMoney(0)).toBe("₹0");
  });
  it("makes editable strings", () => {
    expect(minorToInputString(10050)).toBe("100.5");
    expect(minorToInputString(600000)).toBe("6000");
    expect(minorToInputString(5)).toBe("0.05");
  });
});
