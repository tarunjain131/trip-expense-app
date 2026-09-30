import { getCurrency, DEFAULT_CURRENCY } from "./currency";

export * from "./currency";

/** Largest single amount accepted (fits comfortably in a 32-bit Postgres INTEGER). */
export const MAX_AMOUNT_MINOR = 1_000_000_000;

/**
 * Parse a user-typed amount ("1,200.50", "₹6000") into integer minor units.
 * Uses string arithmetic only - no floating point. Returns null when invalid.
 */
export function parseMoneyToMinor(input: string, currency = DEFAULT_CURRENCY): number | null {
  const { digits } = getCurrency(currency);
  const cleaned = input.replace(/[\s,]/g, "").replace(/^[^\d.-]+/, "");
  const match = /^(\d+)?(?:\.(\d*))?$/.exec(cleaned);
  if (!match || (match[1] === undefined && !match[2])) return null;
  const whole = match[1] ?? "0";
  const frac = match[2] ?? "";
  if (frac.length > digits) return null;
  const minor = Number(whole + frac.padEnd(digits, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Parse "33.33" into basis points (3333). Two decimals max. */
export function parsePercentToBp(input: string): number | null {
  const cleaned = input.replace(/[\s%]/g, "");
  const match = /^(\d+)?(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match || (match[1] === undefined && !match[2])) return null;
  return Number((match[1] ?? "0") + (match[2] ?? "").padEnd(2, "0"));
}

export function bpToPercentString(bp: number): string {
  const whole = Math.trunc(bp / 100);
  const frac = String(bp % 100).padStart(2, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : String(whole);
}

/** Plain editable string for a form input, e.g. 10050 -> "100.5". */
export function minorToInputString(minor: number, currency = DEFAULT_CURRENCY): string {
  const { digits } = getCurrency(currency);
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const base = 10 ** digits;
  const whole = Math.trunc(abs / base);
  const frac = String(abs % base).padStart(digits, "0").replace(/0+$/, "");
  return `${sign}${whole}${frac ? "." + frac : ""}`;
}

/** Format minor units for display, e.g. 4285000 -> "₹42,850". Whole amounts drop the decimals. */
export function formatMoney(minor: number, currency = DEFAULT_CURRENCY): string {
  const info = getCurrency(currency);
  const base = 10 ** info.digits;
  const abs = Math.abs(minor);
  const isWhole = abs % base === 0;
  const formatted = new Intl.NumberFormat(info.locale, {
    minimumFractionDigits: isWhole ? 0 : info.digits,
    maximumFractionDigits: info.digits,
  }).format(abs / base);
  return `${minor < 0 ? "-" : ""}${info.symbol}${formatted}`;
}

/** Signed display: "+₹2,800" / "-₹2,000" / "₹0". */
export function formatSignedMoney(minor: number, currency = DEFAULT_CURRENCY): string {
  if (minor === 0) return formatMoney(0, currency);
  return `${minor > 0 ? "+" : "-"}${formatMoney(Math.abs(minor), currency)}`;
}
