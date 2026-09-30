/** Display timezone for timestamps (settlements). Expense dates are calendar days stored at noon UTC. */
export const APP_TIME_ZONE = process.env.NEXT_PUBLIC_TIME_ZONE ?? "Asia/Kolkata";

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(d);
}

export function formatTimestampDay(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: APP_TIME_ZONE }).format(d);
}

/** yyyy-mm-dd for <input type="date"> from a stored expense date. */
export function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/** "Tarun (You)" when the member is the current viewer. */
export function memberLabel(name: string, id: string, youId: string | null): string {
  return id === youId ? `${name} (You)` : name;
}

/** Today's calendar date (yyyy-mm-dd) in the app time zone, for form defaults. */
export function todayInput(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
