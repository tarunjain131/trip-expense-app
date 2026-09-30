import Link from "next/link";
import { notFound } from "next/navigation";
import { HandCoins, Plus, Receipt, Scale, Users, PieChart, ChevronRight } from "lucide-react";
import { getTripLedger } from "@/lib/db/queries";
import { getYouId } from "@/lib/you";
import { formatMoney } from "@/lib/money";
import { plural } from "@/lib/format";
import { BalanceStatus } from "@/components/balance-status";
import { EmptyState } from "@/components/empty-state";
import { ExpenseRow } from "@/components/expense/expense-row";
import { YouPicker } from "@/components/trip/you-picker";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function DashboardPage({ params }: PageProps<"/trips/[tripId]">) {
  const { tripId } = await params;
  const [ledger, youId] = await Promise.all([getTripLedger(tripId), getYouId(tripId)]);
  if (!ledger) notFound();

  const { trip, members, memberById, expenses, balances, summary, suggestions } = ledger;
  const you = youId ? memberById.get(youId) : undefined;
  const yourBalance = you ? balances.find((b) => b.memberId === you.id) : undefined;
  const base = `/trips/${tripId}`;

  if (members.length === 0) {
    return (
      <div className="space-y-5">
        <TripHeading name={trip.name} description={trip.description} count={0} />
        <EmptyState
          icon={Users}
          title="No members yet"
          description="Add your trip members to start splitting expenses."
        >
          <Link href={`${base}/members`} className={buttonVariants({ size: "lg" })}>
            Add members
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <TripHeading name={trip.name} description={trip.description} count={members.length} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="gap-1 p-5">
          <p className="text-sm text-muted-foreground">Total expenses</p>
          <p className="text-3xl font-semibold tabular-nums tracking-tight" data-testid="total-expenses">
            {formatMoney(summary.totalSpent, trip.currency)}
          </p>
          <p className="text-sm text-muted-foreground">{plural(summary.expenseCount, "expense")}</p>
        </Card>
        <Card className="gap-1 p-5">
          <p className="text-sm text-muted-foreground">Your balance{you ? ` · ${you.name}` : ""}</p>
          {yourBalance ? (
            <>
              <BalanceStatus
                net={yourBalance.net}
                currency={trip.currency}
                subject="You"
                className="text-xl tabular-nums"
              />
              <p className="text-sm text-muted-foreground">
                Paid {formatMoney(yourBalance.paid, trip.currency)} · Share {formatMoney(yourBalance.share, trip.currency)}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Pick who you are below to see your balance.</p>
          )}
        </Card>
      </div>

      {!you && <YouPicker tripId={tripId} members={members} />}

      <section aria-labelledby="quick-actions" className="space-y-2">
        <h2 id="quick-actions" className="sr-only">
          Quick actions
        </h2>
        <Link
          href={`${base}/expenses/new`}
          className={cn(buttonVariants({ size: "lg" }), "h-12 w-full gap-2 text-base")}
        >
          <Plus className="size-5" aria-hidden="true" />
          Add expense
        </Link>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {[
            { href: "/settlements", label: "Settle up", icon: HandCoins },
            { href: "/members", label: "Members", icon: Users },
            { href: "/expenses", label: "Expenses", icon: Receipt },
            { href: "/balances", label: "Balances", icon: Scale },
            { href: "/summary", label: "Summary", icon: PieChart },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={base + href}
              className="flex min-h-14 items-center gap-2.5 rounded-xl border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Icon className="size-5 text-primary" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </section>

      {suggestions.length > 0 && (
        <Card className="gap-2 p-4">
          <CardContent className="flex items-center justify-between gap-3 p-0">
            <p className="text-sm">
              <span className="font-semibold">{plural(suggestions.length, "payment")}</span> would settle everyone up.
            </p>
            <Link href={`${base}/settlements`} className="inline-flex shrink-0 items-center whitespace-nowrap text-sm font-medium text-primary hover:underline">
              Settle up <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </CardContent>
        </Card>
      )}

      <section aria-labelledby="recent" className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 id="recent" className="text-lg font-semibold">
            Recent expenses
          </h2>
          {expenses.length > 0 && (
            <Link href={`${base}/expenses`} className="text-sm font-medium text-primary hover:underline">
              View all
            </Link>
          )}
        </div>
        {expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses yet"
            description="Add your first expense to start tracking the trip."
          >
            <Link href={`${base}/expenses/new`} className={buttonVariants({ size: "lg" })}>
              Add expense
            </Link>
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {expenses.slice(0, 5).map((e) => (
              <li key={e.id}>
                <ExpenseRow
                  tripId={tripId}
                  expense={e}
                  memberById={memberById}
                  youId={youId}
                  currency={trip.currency}
                  totalMembers={members.length}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TripHeading({ name, description, count }: { name: string; description: string | null; count: number }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
      <p className="text-sm text-muted-foreground">
        {plural(count, "member")}
        {description ? ` · ${description}` : ""}
      </p>
    </div>
  );
}
