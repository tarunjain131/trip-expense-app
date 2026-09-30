import { notFound } from "next/navigation";
import { getTripLedger } from "@/lib/db/queries";
import { getYouId } from "@/lib/you";
import { formatMoney, bpToPercentString } from "@/lib/money";
import { formatDate, memberLabel, plural } from "@/lib/format";
import { CATEGORY_LABELS, SPLIT_TYPE_LABELS } from "@/lib/expenses/types";
import { PageHeader } from "@/components/page-header";
import { MemberAvatar } from "@/components/member-avatar";
import { ExpenseActions } from "@/components/expense/expense-actions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export async function generateMetadata({ params }: PageProps<"/trips/[tripId]/expenses/[expenseId]">) {
  const { tripId, expenseId } = await params;
  const ledger = await getTripLedger(tripId);
  return { title: ledger?.expenses.find((e) => e.id === expenseId)?.title ?? "Expense" };
}

export default async function ExpenseDetailPage({ params }: PageProps<"/trips/[tripId]/expenses/[expenseId]">) {
  const { tripId, expenseId } = await params;
  const [ledger, youId] = await Promise.all([getTripLedger(tripId), getYouId(tripId)]);
  if (!ledger) notFound();
  const e = ledger.expenses.find((x) => x.id === expenseId);
  if (!e) notFound();
  const { memberById, trip } = ledger;
  const cur = trip.currency;
  const name = (id: string) => {
    const m = memberById.get(id);
    return m ? memberLabel(m.name, m.id, youId) : "Unknown";
  };
  const splits = [...e.splits].sort((a, b) => b.amountMinor - a.amountMinor || name(a.memberId).localeCompare(name(b.memberId)));

  return (
    <div className="space-y-5">
      <PageHeader title={e.title} back={{ href: `/trips/${tripId}/expenses`, label: "Expenses" }} />

      <Card className="gap-3 p-5">
        <p className="text-3xl font-semibold tabular-nums tracking-tight" data-testid="expense-amount">
          {formatMoney(e.amountMinor, cur)}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {e.category && <Badge variant="secondary">{CATEGORY_LABELS[e.category]}</Badge>}
          <span>{formatDate(e.spentAt)}</span>
          <span>·</span>
          <span>Split {SPLIT_TYPE_LABELS[e.splitType].toLowerCase()}</span>
        </div>
        {e.notes && <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{e.notes}</p>}
      </Card>

      <ExpenseActions tripId={tripId} expenseId={e.id} title={e.title} />

      <section aria-labelledby="paid-by" className="space-y-2">
        <h2 id="paid-by" className="text-lg font-semibold">
          Paid by
        </h2>
        <ul className="divide-y rounded-xl border bg-card">
          {e.payers.map((p) => (
            <li key={p.memberId} className="flex items-center justify-between gap-3 p-3">
              <span className="flex items-center gap-2.5">
                <MemberAvatar name={memberById.get(p.memberId)?.name ?? "?"} id={p.memberId} className="size-8 text-xs" />
                {name(p.memberId)}
              </span>
              <span className="font-semibold tabular-nums">{formatMoney(p.amountMinor, cur)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="split" className="space-y-2">
        <h2 id="split" className="text-lg font-semibold">
          Split between {plural(e.splits.length, "person", "people")}
        </h2>
        <ul className="divide-y rounded-xl border bg-card">
          {splits.map((s) => (
            <li key={s.memberId} className="flex items-center justify-between gap-3 p-3">
              <span className="flex items-center gap-2.5">
                <MemberAvatar name={memberById.get(s.memberId)?.name ?? "?"} id={s.memberId} className="size-8 text-xs" />
                {name(s.memberId)}
              </span>
              <span className="text-right">
                <span className="font-semibold tabular-nums">{formatMoney(s.amountMinor, cur)}</span>
                {e.splitType === "PERCENTAGE" && s.value !== null && (
                  <span className="ml-2 text-xs text-muted-foreground">{bpToPercentString(s.value)}%</span>
                )}
                {e.splitType === "SHARES" && s.value !== null && (
                  <span className="ml-2 text-xs text-muted-foreground">{plural(s.value, "share")}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
