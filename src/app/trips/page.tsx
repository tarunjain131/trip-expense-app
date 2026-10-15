import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Luggage, UserRound, Users } from "lucide-react";
import { requireUserPage } from "@/lib/access";
import { listSplits, type SplitListItem } from "@/lib/db/queries";
import { formatMoney } from "@/lib/money";
import { plural } from "@/lib/format";
import { CreateTripDialog } from "@/components/trip/create-trip-dialog";
import { AddFriendDialog } from "@/components/trip/add-friend-dialog";
import { BalanceStatus } from "@/components/balance-status";
import { MemberAvatar } from "@/components/member-avatar";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Your splits" };
export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const user = await requireUserPage();
  const splits = await listSplits();
  const friends = splits.filter((s) => s.kind === "FRIEND");
  const groups = splits.filter((s) => s.kind !== "FRIEND");

  // Totals per currency: balances in different currencies can't be added together.
  const totals = new Map<string, { owed: number; owe: number }>();
  for (const s of splits) {
    if (!s.myNet) continue;
    const t = totals.get(s.currency) ?? { owed: 0, owe: 0 };
    if (s.myNet > 0) t.owed += s.myNet;
    else t.owe += -s.myNet;
    totals.set(s.currency, t);
  }

  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 md:py-10">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Hi, {user.name.split(" ")[0]}</h1>
          <p className="truncate text-sm text-muted-foreground">Friends, groups and trips in one place.</p>
        </div>
        <LogoutButton />
      </div>

      {totals.size > 0 && (
        <section aria-label="Your overall balance" className="grid gap-3 sm:grid-cols-2">
          {[...totals.entries()].map(([currency, t]) => (
            <Card key={currency} className="grid grid-cols-2 gap-3 p-4">
              <div>
                <p className="text-sm text-muted-foreground">You are owed</p>
                <p className="text-xl font-semibold tabular-nums text-positive">{formatMoney(t.owed, currency)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">You owe</p>
                <p className="text-xl font-semibold tabular-nums text-negative">{formatMoney(t.owe, currency)}</p>
              </div>
            </Card>
          ))}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <CreateTripDialog />
        <AddFriendDialog />
      </div>

      {splits.length === 0 && (
        <EmptyState icon={Luggage} title="Nothing here yet" description="Add a friend for a running two-person balance, or create a trip or group to split with many people." />
      )}

      {friends.length > 0 && (
        <Section title="Friends" icon={UserRound}>
          {friends.map((s) => (
            <SplitRow key={s.id} s={s} />
          ))}
        </Section>
      )}

      {groups.length > 0 && (
        <Section title="Trips & groups" icon={Users}>
          {groups.map((s) => (
            <SplitRow key={s.id} s={s} />
          ))}
        </Section>
      )}
    </main>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {title}
      </h2>
      <ul className="space-y-3">{children}</ul>
    </section>
  );
}

function SplitRow({ s }: { s: SplitListItem }) {
  const friend = s.kind === "FRIEND";
  return (
    <li>
      <Link href={`/trips/${s.id}`} className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Card className="flex-row items-center justify-between gap-3 p-4 transition-colors hover:bg-accent/50">
          <div className="flex min-w-0 items-center gap-3">
            {friend && <MemberAvatar name={s.name} id={s.id} />}
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-base font-semibold">{s.name}</p>
              <p className="text-sm text-muted-foreground">
                {friend ? plural(s.expenseCount, "expense") : `${plural(s.memberCount, "member")} · ${plural(s.expenseCount, "expense")}`}
              </p>
              {s.myNet === null ? (
                <p className="text-sm tabular-nums text-muted-foreground">Total {formatMoney(s.totalMinor, s.currency)}</p>
              ) : (
                <BalanceStatus net={s.myNet} currency={s.currency} subject="You" className="text-sm" />
              )}
            </div>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Card>
      </Link>
    </li>
  );
}
