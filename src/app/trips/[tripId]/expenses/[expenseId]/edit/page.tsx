import { notFound } from "next/navigation";
import { getTripLedger } from "@/lib/db/queries";
import { getYouId } from "@/lib/you";
import { getCurrency, bpToPercentString, minorToInputString } from "@/lib/money";
import { toDateInputValue, todayInput } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ExpenseForm, type ExpenseFormInitial } from "@/components/expense/expense-form";

export const metadata = { title: "Edit expense" };

export default async function EditExpensePage({ params }: PageProps<"/trips/[tripId]/expenses/[expenseId]/edit">) {
  const { tripId, expenseId } = await params;
  const [ledger, youId] = await Promise.all([getTripLedger(tripId), getYouId(tripId)]);
  if (!ledger) notFound();
  const e = ledger.expenses.find((x) => x.id === expenseId);
  if (!e) notFound();
  const cur = ledger.trip.currency;

  const valueText = (v: number | null) =>
    v === null ? "" : e.splitType === "EXACT" ? minorToInputString(v, cur) : e.splitType === "PERCENTAGE" ? bpToPercentString(v) : String(v);

  const initial: ExpenseFormInitial = {
    id: e.id,
    version: e.updatedAt.toISOString(),
    title: e.title,
    amount: minorToInputString(e.amountMinor, cur),
    category: e.category ?? "",
    notes: e.notes ?? "",
    spentAt: toDateInputValue(e.spentAt),
    splitType: e.splitType,
    payers: e.payers.map((p) => ({ memberId: p.memberId, amount: minorToInputString(p.amountMinor, cur) })),
    participants: e.splits.map((s) => ({ memberId: s.memberId, value: valueText(s.value) })),
  };

  return (
    <div>
      <PageHeader title="Edit expense" back={{ href: `/trips/${tripId}/expenses/${e.id}`, label: e.title }} />
      <ExpenseForm
        tripId={tripId}
        currency={cur}
        currencySymbol={getCurrency(cur).symbol}
        members={ledger.members}
        youId={youId}
        today={todayInput()}
        initial={initial}
      />
    </div>
  );
}
