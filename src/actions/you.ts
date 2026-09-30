"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { YOU_COOKIE_MAX_AGE, youCookieName } from "@/lib/you";
import { isUuid } from "@/lib/db/queries";
import { prisma } from "@/lib/db/prisma";
import { run, type ActionResult } from "./result";

/**
 * Remember which member is "You" on this device. Stored in a cookie (not the
 * database) so it never affects the books and works without authentication.
 */
export async function setYouAction(tripId: string, memberId: string | null): Promise<ActionResult<undefined>> {
  return run(async () => {
    if (!isUuid(tripId)) return undefined;
    const store = await cookies();
    if (memberId === null) {
      store.delete(youCookieName(tripId));
    } else {
      const member = await prisma.tripMember.findFirst({ where: { id: memberId, tripId }, select: { id: true } });
      if (!member) return undefined;
      store.set(youCookieName(tripId), memberId, {
        path: "/",
        maxAge: YOU_COOKIE_MAX_AGE,
        sameSite: "lax",
      });
    }
    revalidatePath(`/trips/${tripId}`, "layout");
    return undefined;
  });
}
