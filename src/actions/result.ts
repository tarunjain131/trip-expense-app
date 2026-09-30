import { ZodError } from "zod";
import { DomainError } from "@/lib/errors";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

const GENERIC = "Something went wrong. Please try again.";

function prismaCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return undefined;
}

/** Map any thrown error to a message that is safe to show to people. Never leaks stack traces. */
export function toFailure(err: unknown): { ok: false; error: string; field?: string } {
  if (err instanceof DomainError) return { ok: false, error: err.message, field: err.field };
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return { ok: false, error: issue?.message ?? "Please check the form and try again.", field: issue?.path[0]?.toString() };
  }
  const code = prismaCode(err);
  if (code === "P2025") return { ok: false, error: "That item no longer exists. Refresh and try again." };
  if (code === "P2003") return { ok: false, error: "That item is still in use and can't be changed." };
  if (code === "P2002") return { ok: false, error: "That already exists." };
  if (code === "P2034") return { ok: false, error: "Someone else made a change at the same time. Please try again." };
  if (code && /^P1\d{3}$/.test(code)) {
    console.error("[database]", err);
    return { ok: false, error: "We couldn't reach the database. Please try again in a moment." };
  }
  if (err instanceof Error && /Can't reach database|ECONNREFUSED|ETIMEDOUT|Connection terminated/i.test(err.message)) {
    console.error("[database]", err);
    return { ok: false, error: "We couldn't reach the database. Please try again in a moment." };
  }
  console.error("[action]", err);
  return { ok: false, error: GENERIC };
}

export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return toFailure(err);
  }
}
