import { notFound } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";
import { getTripLedger } from "@/lib/db/queries";
import { getYouId } from "@/lib/you";
import { getCurrency } from "@/lib/money";
import { todayInput } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ExpenseForm } from "@/components/expense/expense-form";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Add expense" };

export default async function NewExpensePage({ params }: PageProps<"/trips/[tripId]/expenses/new">) {
  const { tripId } = await params;
  const [ledger, youId] = await Promise.all([getTripLedger(tripId), getYouId(tripId)]);
  if (!ledger) notFound();

  return (
    <div>
      <PageHeader title="Add expense" back={{ href: `/trips/${tripId}/expenses`, label: "Expenses" }} />
      {ledger.members.length === 0 ? (
        <EmptyState icon={Users} title="Add members first" description="Add your trip members to start splitting expenses.">
          <Link href={`/trips/${tripId}/members`} className={buttonVariants({ size: "lg" })}>
            Add members
          </Link>
        </EmptyState>
      ) : (
        <ExpenseForm
          tripId={tripId}
          currency={ledger.trip.currency}
          currencySymbol={getCurrency(ledger.trip.currency).symbol}
          members={ledger.members}
          youId={youId}
          today={todayInput()}
        />
      )}
    </div>
  );
}
