import Link from "next/link";
import { notFound } from "next/navigation";
import { PieChart } from "lucide-react";
import { getTripLedger } from "@/lib/db/queries";
import { formatMoney } from "@/lib/money";
import { plural } from "@/lib/format";
import { CATEGORY_LABELS, type ExpenseCategory } from "@/lib/expenses/types";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Summary" };

export default async function SummaryPage({ params }: PageProps<"/trips/[tripId]/summary">) {
  const { tripId } = await params;
  const ledger = await getTripLedger(tripId);
  if (!ledger) notFound();
  const { trip, summary: s, memberById } = ledger;
  const cur = trip.currency;

  if (s.expenseCount === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="Trip summary" />
        <EmptyState icon={PieChart} title="Nothing to summarise yet" description="Add your first expense to start tracking the trip." />
      </div>
    );
  }

  const topPayerName = s.topPayer ? memberById.get(s.topPayer.memberId)?.name : undefined;
  const maxCat = Math.max(...s.categories.map((c) => c.totalMinor));
  const settledPct = s.settledAmount + s.outstandingAmount > 0 ? Math.round((s.settledAmount / (s.settledAmount + s.outstandingAmount)) * 100) : 100;

  const stats: { label: string; value: string; sub?: string }[] = [
    { label: "Total spent", value: formatMoney(s.totalSpent, cur) },
    { label: "Expenses", value: String(s.expenseCount) },
    { label: "Members", value: String(s.memberCount) },
    { label: "Average per member", value: formatMoney(s.averagePerMember, cur) },
    { label: "Highest spender", value: topPayerName ?? "-", sub: s.topPayer ? `paid ${formatMoney(s.topPayer.paid, cur)}` : undefined },
    {
      label: "Largest expense",
      value: s.largestExpense ? formatMoney(s.largestExpense.amountMinor, cur) : "-",
      sub: s.largestExpense?.title,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Trip summary" description={trip.name} />
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((st) => (
          <Card key={st.label} className="gap-0.5 p-4">
            <dt className="text-sm text-muted-foreground">{st.label}</dt>
            <dd className="truncate text-xl font-semibold tabular-nums">{st.value}</dd>
            {st.sub && <dd className="truncate text-xs text-muted-foreground">{st.sub}</dd>}
          </Card>
        ))}
      </dl>

      <section aria-labelledby="settle-progress" className="space-y-2">
        <h2 id="settle-progress" className="text-lg font-semibold">
          Settlement progress
        </h2>
        <Card className="gap-3 p-4">
          <div
            role="progressbar"
            aria-valuenow={settledPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Share of debts settled"
            className="h-2.5 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${settledPct}%` }} />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Settled</dt>
              <dd className="text-base font-semibold tabular-nums" data-testid="settled-amount">
                {formatMoney(s.settledAmount, cur)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Outstanding</dt>
              <dd className="text-base font-semibold tabular-nums" data-testid="outstanding-amount">
                {formatMoney(s.outstandingAmount, cur)}
              </dd>
            </div>
          </dl>
          {s.outstandingAmount > 0 && (
            <Link href={`/trips/${tripId}/settlements`} className="text-sm font-medium text-primary hover:underline">
              Go to Settle up
            </Link>
          )}
        </Card>
      </section>

      <section aria-labelledby="categories" className="space-y-2">
        <h2 id="categories" className="text-lg font-semibold">
          By category
        </h2>
        <Card className="gap-4 p-4">
          <ul className="space-y-3.5">
            {s.categories.map((c) => {
              const label = c.category ? CATEGORY_LABELS[c.category as ExpenseCategory] : "Uncategorised";
              const pct = Math.round((c.totalMinor / s.totalSpent) * 100);
              return (
                <li key={label} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {label} <span className="font-normal text-muted-foreground">· {plural(c.count, "expense")}</span>
                    </span>
                    <span className="tabular-nums">
                      <span className="font-semibold">{formatMoney(c.totalMinor, cur)}</span>{" "}
                      <span className="text-muted-foreground">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary/80" style={{ width: `${(c.totalMinor / maxCat) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>
    </div>
  );
}
