import { notFound } from "next/navigation";
import { ArrowRight, PartyPopper, History } from "lucide-react";
import { getTripLedger } from "@/lib/db/queries";
import { getYouId } from "@/lib/you";
import { formatMoney } from "@/lib/money";
import { formatTimestampDay, memberLabel, plural } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/member-avatar";
import { MarkPaidButton } from "@/components/settle/mark-paid-button";
import { RevertButton } from "@/components/settle/revert-button";
import { SettlementLine } from "@/components/settle/settlement-line";

export const metadata = { title: "Settle up" };

export default async function SettlementsPage({ params }: PageProps<"/trips/[tripId]/settlements">) {
  const { tripId } = await params;
  const [ledger, youId] = await Promise.all([getTripLedger(tripId), getYouId(tripId)]);
  if (!ledger) notFound();
  const { trip, memberById, suggestions, settlements, outstanding } = ledger;
  const cur = trip.currency;
  const name = (id: string) => memberById.get(id)?.name ?? "Unknown";
  const label = (id: string) => memberLabel(name(id), id, youId);

  return (
    <div className="space-y-6">
      <PageHeader title="Settle up" description="The fewest payments that clear every balance." />

      <section aria-labelledby="suggested" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 id="suggested" className="text-lg font-semibold">
            Suggested payments
          </h2>
          {suggestions.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {plural(suggestions.length, "payment")} · {formatMoney(outstanding.totalOutstanding, cur)} total
            </p>
          )}
        </div>
        {suggestions.length === 0 ? (
          <EmptyState
            icon={PartyPopper}
            title="Everyone is currently settled"
            description={
              ledger.expenses.length === 0
                ? "Add some expenses and the payments needed to settle up will show here."
                : "Nobody owes anything right now."
            }
          />
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li
                key={`${s.fromId}-${s.toId}`}
                className="flex flex-col gap-3 rounded-xl border bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between"
                data-testid="suggestion"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <MemberAvatar name={name(s.fromId)} id={s.fromId} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-1.5 font-medium">
                      <span>{label(s.fromId)}</span>
                      <ArrowRight className="size-4 text-muted-foreground" aria-label="pays" />
                      <span>{label(s.toId)}</span>
                    </p>
                    <p className="text-lg font-semibold tabular-nums">{formatMoney(s.amountMinor, cur)}</p>
                  </div>
                </div>
                <MarkPaidButton
                  tripId={tripId}
                  payerId={s.fromId}
                  receiverId={s.toId}
                  amountMinor={s.amountMinor}
                  currency={cur}
                  payerName={name(s.fromId)}
                  receiverName={name(s.toId)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history" className="space-y-3">
        <h2 id="history" className="text-lg font-semibold">
          Settlement history
        </h2>
        {settlements.length === 0 ? (
          <EmptyState icon={History} title="No settlements yet" description="Payments you mark as paid will be recorded here." />
        ) : (
          <ul className="space-y-2">
            {settlements.map((s) => (
              <li key={s.id}>
                <SettlementLine
                  settlement={s}
                  memberById={memberById}
                  youId={youId}
                  currency={cur}
                  dateLabel={formatTimestampDay(s.paidAt)}
                  action={
                    s.status === "COMPLETED" ? (
                      <RevertButton
                        tripId={tripId}
                        settlementId={s.id}
                        description={`${name(s.payerId)} paid ${name(s.receiverId)} ${formatMoney(s.amountMinor, cur)}`}
                      />
                    ) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
