import { cookies } from "next/headers";

export const YOU_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const youCookieName = (tripId: string) => `you_${tripId}`;

/** The member this browser identified as "You" (or null). Display-only; never used in calculations. */
export async function getYouId(tripId: string): Promise<string | null> {
  const store = await cookies();
  return store.get(youCookieName(tripId))?.value ?? null;
}
