import { getTripAccess } from "./access";

/** The member linked to the logged-in account in this trip (or null). Display-only; never used in calculations. */
export async function getYouId(tripId: string): Promise<string | null> {
  return (await getTripAccess(tripId))?.youMemberId ?? null;
}
