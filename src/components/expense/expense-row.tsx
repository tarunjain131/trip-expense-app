import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ExpenseDTO, MemberDTO } from "@/lib/db/queries";
import { CATEGORY_LABELS } from "@/lib/expenses/types";
import { formatMoney } from "@/lib/money";
import { formatDate, memberLabel, plural } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function paidByLabel(e: ExpenseDTO, memberById: Map<string, MemberDTO>, youId: string | null) {
  const names = e.payers.map((p) => {
    const m = memberById.get(p.memberId);
    return m ? memberLabel(m.name, m.id, youId) : "Unknown";
  });
  if (names.length <= 2) return names.join(" & ");
  return `${names[0]} +${names.length - 1} others`;
}

export function ExpenseRow({
  tripId,
  expense,
  memberById,
  youId,
  currency,
  totalMembers,
}: {
  tripId: string;
  expense: ExpenseDTO;
  memberById: Map<string, MemberDTO>;
  youId: string | null;
  currency: string;
  totalMembers: number;
}) {
  const count = expense.splits.length;
  return (
    <Link
      href={`/trips/${tripId}/expenses/${expense.id}`}
      className="flex min-h-[4.5rem] items-center justify-between gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <div className="min-w-0 space-y-1">
        <p className="truncate text-base font-semibold">{expense.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          Paid by {paidByLabel(expense, memberById, youId)} ·{" "}
          {count === totalMembers && totalMembers > 1 ? "Everyone" : plural(count, "person", "people")}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {expense.category && <Badge variant="secondary">{CATEGORY_LABELS[expense.category]}</Badge>}
          <span>{formatDate(expense.spentAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-base font-semibold tabular-nums">{formatMoney(expense.amountMinor, currency)}</span>
        <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
    </Link>
  );
}
