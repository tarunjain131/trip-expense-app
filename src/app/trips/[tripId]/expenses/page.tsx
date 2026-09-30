import Link from "next/link";
import { notFound } from "next/navigation";
import { Filter, Plus, Receipt, Search } from "lucide-react";
import { filterExpenses, getTripLedger } from "@/lib/db/queries";
import { getYouId } from "@/lib/you";
import { formatMoney } from "@/lib/money";
import { CATEGORY_LABELS, EXPENSE_CATEGORIES } from "@/lib/expenses/types";
import { plural } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ExpenseRow } from "@/components/expense/expense-row";
import { NativeSelect } from "@/components/native-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = { title: "Expenses" };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function ExpensesPage({ params, searchParams }: PageProps<"/trips/[tripId]/expenses">) {
  const { tripId } = await params;
  const sp = await searchParams;
  const filters = { q: first(sp.q), category: first(sp.category), member: first(sp.member), from: first(sp.from), to: first(sp.to) };
  const [ledger, youId] = await Promise.all([getTripLedger(tripId), getYouId(tripId)]);
  if (!ledger) notFound();

  const { trip, expenses, members, memberById } = ledger;
  const shown = filterExpenses(expenses, filters);
  const activeAdvanced = [filters.category, filters.member, filters.from, filters.to].filter(Boolean).length;
  const isFiltered = activeAdvanced > 0 || !!filters.q;
  const shownTotal = shown.reduce((a, e) => a + e.amountMinor, 0);
  const base = `/trips/${tripId}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Expenses"
        description={`${plural(expenses.length, "expense")} · ${formatMoney(ledger.summary.totalSpent, trip.currency)}`}
        actions={
          <Link href={`${base}/expenses/new`} className={`${buttonVariants({ size: "lg" })} hidden h-10 gap-2 sm:inline-flex`}>
            <Plus className="size-4" aria-hidden="true" />
            Add expense
          </Link>
        }
      />

      {expenses.length > 0 && (
        <form method="get" className="space-y-2" role="search" aria-label="Filter expenses">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Label htmlFor="q" className="sr-only">
                Search expenses
              </Label>
              <Input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Search expenses" className="h-11 pl-9 text-base md:h-10 md:text-sm" />
            </div>
            <Button type="submit" size="lg" className="h-11 md:h-10">
              Search
            </Button>
          </div>
          <details className="group rounded-lg border bg-card" open={activeAdvanced > 0}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-medium">
              <Filter className="size-4" aria-hidden="true" />
              Filters{activeAdvanced > 0 ? ` (${activeAdvanced})` : ""}
            </summary>
            <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="category">Category</Label>
                <NativeSelect id="category" name="category" defaultValue={filters.category}>
                  <option value="">All categories</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                  <option value="NONE">No category</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="member">Person</Label>
                <NativeSelect id="member" name="member" defaultValue={filters.member}>
                  <option value="">Everyone</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="from">From</Label>
                <Input id="from" name="from" type="date" defaultValue={filters.from} className="h-11 text-base md:h-10 md:text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">To</Label>
                <Input id="to" name="to" type="date" defaultValue={filters.to} className="h-11 text-base md:h-10 md:text-sm" />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" size="lg" className="h-11 flex-1">
                  Apply filters
                </Button>
                {isFiltered && (
                  <Link href={`${base}/expenses`} className={`${buttonVariants({ variant: "outline", size: "lg" })} h-11`}>
                    Clear
                  </Link>
                )}
              </div>
            </div>
          </details>
        </form>
      )}

      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses yet" description="Add your first expense to start tracking the trip.">
          <Link href={`${base}/expenses/new`} className={buttonVariants({ size: "lg" })}>
            Add expense
          </Link>
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon={Search} title="No matching expenses" description="Try a different search or clear the filters.">
          <Link href={`${base}/expenses`} className={buttonVariants({ variant: "outline", size: "lg" })}>
            Clear filters
          </Link>
        </EmptyState>
      ) : (
        <>
          {isFiltered && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {plural(shown.length, "expense")} · {formatMoney(shownTotal, trip.currency)}
            </p>
          )}
          <ul className="space-y-2">
            {shown.map((e) => (
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
        </>
      )}
    </div>
  );
}
