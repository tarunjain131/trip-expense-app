import Link from "next/link";
import { notFound } from "next/navigation";
import { getTripLedger } from "@/lib/db/queries";
import { getYouId } from "@/lib/you";
import { formatMoney } from "@/lib/money";
import { formatDate, formatTimestampDay, memberLabel } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { MemberAvatar } from "@/components/member-avatar";
import { BalanceStatus } from "@/components/balance-status";
import { MemberActions } from "@/components/trip/member-actions";
import { SettlementLine } from "@/components/settle/settlement-line";
import { Card } from "@/components/ui/card";

export async function generateMetadata({ params }: PageProps<"/trips/[tripId]/members/[memberId]">) {
  const { tripId, memberId } = await params;
  const ledger = await getTripLedger(tripId);
  return { title: ledger?.memberById.get(memberId)?.name ?? "Member" };
}

export default async function MemberDetailPage({ params }: PageProps<"/trips/[tripId]/members/[memberId]">) {
  const { tripId, memberId } = await params;
  const [ledger, youId] = await Promise.all([getTripLedger(tripId), getYouId(tripId)]);
  if (!ledger) notFound();
  const member = ledger.memberById.get(memberId);
  if (!member) notFound();

  const { trip, expenses, settlements, balances, memberById } = ledger;
  const cur = trip.currency;
  const b = balances.find((x) => x.memberId === memberId)!;
  const paidExpenses = expenses.filter((e) => e.payers.some((p) => p.memberId === memberId));
  const shareExpenses = expenses.filter((e) => e.splits.some((s) => s.memberId === memberId));
  const memberSettlements = settlements.filter((s) => s.payerId === memberId || s.receiverId === memberId);

  return (
    <div className="space-y-5">
      <PageHeader title={memberLabel(member.name, member.id, youId)} back={{ href: `/trips/${tripId}/members`, label: "Members" }} />

      <Card className="gap-4 p-5">
        <div className="flex items-center gap-3">
          <MemberAvatar name={member.name} id={member.id} className="size-12 text-lg" />
          <BalanceStatus net={b.net} currency={cur} className="text-lg tabular-nums" />
        </div>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">Total paid</dt>
            <dd className="text-base font-semibold tabular-nums">{formatMoney(b.paid, cur)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total share</dt>
            <dd className="text-base font-semibold tabular-nums">{formatMoney(b.share, cur)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Settled</dt>
            <dd className="text-base font-semibold tabular-nums">
              {formatMoney(b.settlementsPaid - b.settlementsReceived, cur)}
            </dd>
          </div>
        </dl>
      </Card>

      <MemberActions tripId={tripId} member={member} isYou={member.id === youId} redirectOnRemove={`/trips/${tripId}/members`} />

      <Section title="Expenses paid" empty="Hasn't paid for anything yet.">
        {paidExpenses.map((e) => (
          <ExpenseLine
            key={e.id}
            href={`/trips/${tripId}/expenses/${e.id}`}
            title={e.title}
            date={formatDate(e.spentAt)}
            amount={formatMoney(e.payers.find((p) => p.memberId === memberId)!.amountMinor, cur)}
          />
        ))}
      </Section>

      <Section title="Expenses participated in" empty="Isn't part of any expense yet.">
        {shareExpenses.map((e) => (
          <ExpenseLine
            key={e.id}
            href={`/trips/${tripId}/expenses/${e.id}`}
            title={e.title}
            date={formatDate(e.spentAt)}
            amount={formatMoney(e.splits.find((s) => s.memberId === memberId)!.amountMinor, cur)}
            hint="share"
          />
        ))}
      </Section>

      <Section title="Settlements" empty="No settlements yet.">
        {memberSettlements.map((s) => (
          <li key={s.id}>
            <SettlementLine
              settlement={s}
              memberById={memberById}
              youId={youId}
              currency={cur}
              dateLabel={formatTimestampDay(s.paidAt)}
            />
          </li>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card p-4 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  );
}

function ExpenseLine({ href, title, date, amount, hint }: { href: string; title: string; date: string; amount: string; hint?: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-14 items-center justify-between gap-3 rounded-xl border bg-card px-3.5 py-2 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <div className="min-w-0">
          <p className="truncate font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{date}</p>
        </div>
        <p className="shrink-0 font-semibold tabular-nums">
          {amount}
          {hint && <span className="ml-1 text-xs font-normal text-muted-foreground">{hint}</span>}
        </p>
      </Link>
    </li>
  );
}
