import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Users } from "lucide-react";
import { getTripLedger } from "@/lib/db/queries";
import { getYouId } from "@/lib/you";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/member-avatar";
import { BalanceStatus } from "@/components/balance-status";
import { AddMembersForm } from "@/components/trip/add-members-form";
import { MemberActions } from "@/components/trip/member-actions";
import { plural } from "@/lib/format";

export const metadata = { title: "Members" };

export default async function MembersPage({ params }: PageProps<"/trips/[tripId]/members">) {
  const { tripId } = await params;
  const [ledger, youId] = await Promise.all([getTripLedger(tripId), getYouId(tripId)]);
  if (!ledger) notFound();
  const { members, balances, trip } = ledger;

  return (
    <div className="space-y-5">
      <PageHeader title="Members" description={plural(members.length, "person", "people")} />
      <AddMembersForm tripId={tripId} />

      {members.length === 0 ? (
        <EmptyState icon={Users} title="No members yet" description="Add your trip members to start splitting expenses." />
      ) : (
        <ul className="space-y-2">
          {members.map((m) => {
            const b = balances.find((x) => x.memberId === m.id)!;
            return (
              <li key={m.id} className="flex items-center gap-2 rounded-xl border bg-card p-2.5 pl-3.5">
                <Link
                  href={`/trips/${tripId}/members/${m.id}`}
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <MemberAvatar name={m.name} id={m.id} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {m.name}
                      {m.id === youId && <span className="ml-1 text-muted-foreground">(You)</span>}
                    </p>
                    <BalanceStatus net={b.net} currency={trip.currency} className="text-sm" />
                  </div>
                  <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
                <MemberActions tripId={tripId} member={m} isYou={m.id === youId} compact />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
