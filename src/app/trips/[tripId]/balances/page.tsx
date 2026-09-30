import Link from "next/link";
import { notFound } from "next/navigation";
import { HandCoins, Scale } from "lucide-react";
import { getTripLedger } from "@/lib/db/queries";
import { getYouId } from "@/lib/you";
import { formatMoney } from "@/lib/money";
import { memberLabel } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/member-avatar";
import { BalanceStatus } from "@/components/balance-status";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Balances" };

export default async function BalancesPage({ params }: PageProps<"/trips/[tripId]/balances">) {
  const { tripId } = await params;
  const [ledger, youId] = await Promise.all([getTripLedger(tripId), getYouId(tripId)]);
  if (!ledger) notFound();
  const { trip, members, balances } = ledger;
  const cur = trip.currency;
  const nameOf = new Map(members.map((m) => [m.id, m.name]));
  const sorted = [...balances].sort((a, b) => b.net - a.net || (nameOf.get(a.memberId)! < nameOf.get(b.memberId)! ? -1 : 1));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Balances"
        description="Net = what someone paid minus their share, adjusted for settlements."
        actions={
          <Link href={`/trips/${tripId}/settlements`} className={`${buttonVariants({ size: "lg" })} h-10 gap-2`}>
            <HandCoins className="size-4" aria-hidden="true" />
            Settle up
          </Link>
        }
      />
      {members.length === 0 ? (
        <EmptyState icon={Scale} title="No members yet" description="Add your trip members to start splitting expenses." />
      ) : (
        <ul className="space-y-2.5">
          {sorted.map((b) => {
            const name = nameOf.get(b.memberId)!;
            return (
              <li key={b.memberId} className="rounded-xl border bg-card p-4" data-testid={`balance-${name}`}>
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/trips/${tripId}/members/${b.memberId}`}
                    className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <MemberAvatar name={name} id={b.memberId} />
                    <span className="truncate font-semibold">{memberLabel(name, b.memberId, youId)}</span>
                  </Link>
                  <BalanceStatus net={b.net} currency={cur} className="shrink-0 text-right tabular-nums" />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Paid</dt>
                    <dd className="font-medium tabular-nums">{formatMoney(b.paid, cur)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Share</dt>
                    <dd className="font-medium tabular-nums">{formatMoney(b.share, cur)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Net</dt>
                    <dd className="font-medium tabular-nums" data-testid="net">
                      {b.net > 0 ? "+" : b.net < 0 ? "-" : ""}
                      {formatMoney(Math.abs(b.net), cur)}
                    </dd>
                  </div>
                </dl>
                {(b.settlementsPaid > 0 || b.settlementsReceived > 0) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Includes settlements: paid out {formatMoney(b.settlementsPaid, cur)}, received{" "}
                    {formatMoney(b.settlementsReceived, cur)}.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
