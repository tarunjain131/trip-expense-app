import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Luggage, Users } from "lucide-react";
import { listTrips } from "@/lib/db/queries";
import { formatMoney } from "@/lib/money";
import { plural } from "@/lib/format";
import { CreateTripDialog } from "@/components/trip/create-trip-dialog";
import { EmptyState } from "@/components/empty-state";
import { Card } from "@/components/ui/card";
import { LogoutButton } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Your trips" };
export const dynamic = "force-dynamic";

export default async function TripsPage() {
  const trips = await listTrips();
  return (
    <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 md:py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your trips</h1>
          <p className="text-sm text-muted-foreground">Track shared expenses and settle up with your group.</p>
        </div>
        <div className="flex items-center gap-1">
          {trips.length > 0 && <CreateTripDialog />}
          <LogoutButton />
        </div>
      </div>

      {trips.length === 0 ? (
        <EmptyState
          icon={Luggage}
          title="No trips yet"
          description="Create a trip, add your friends, and start splitting expenses."
        >
          <CreateTripDialog label="Create your first trip" />
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {trips.map((t) => (
            <li key={t.id}>
              <Link href={`/trips/${t.id}`} className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                <Card className="flex-row items-center justify-between gap-3 p-4 transition-colors hover:bg-accent/50">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{t.name}</p>
                    {t.description && <p className="truncate text-sm text-muted-foreground">{t.description}</p>}
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Users className="size-3.5" aria-hidden="true" />
                      {plural(t.memberCount, "member")} · {plural(t.expenseCount, "expense")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-base font-semibold tabular-nums">{formatMoney(t.totalMinor, t.currency)}</span>
                    <ChevronRight className="size-5 text-muted-foreground" aria-hidden="true" />
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
