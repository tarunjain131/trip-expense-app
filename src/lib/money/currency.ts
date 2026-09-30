export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  /** Number of minor-unit digits (2 => 100 minor units per major unit). */
  digits: number;
  locale: string;
}

export const CURRENCIES: Record<string, CurrencyInfo> = {
  INR: { code: "INR", name: "Indian Rupee", symbol: "₹", digits: 2, locale: "en-IN" },
  USD: { code: "USD", name: "US Dollar", symbol: "$", digits: 2, locale: "en-US" },
  EUR: { code: "EUR", name: "Euro", symbol: "€", digits: 2, locale: "en-IE" },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", digits: 2, locale: "en-GB" },
};

export const DEFAULT_CURRENCY = "INR";
export const CURRENCY_CODES = Object.keys(CURRENCIES) as [string, ...string[]];

export function getCurrency(code: string): CurrencyInfo {
  return CURRENCIES[code] ?? CURRENCIES[DEFAULT_CURRENCY];
}
