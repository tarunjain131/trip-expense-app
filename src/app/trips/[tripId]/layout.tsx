import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTripBasics } from "@/lib/db/queries";
import { plural } from "@/lib/format";
import { LogoutButton } from "@/components/auth/login-form";
import { TripBottomNav, TripTopNav } from "@/components/trip/trip-nav";

export async function generateMetadata({ params }: LayoutProps<"/trips/[tripId]">) {
  const { tripId } = await params;
  const trip = await getTripBasics(tripId);
  return { title: trip?.name ?? "Trip" };
}

export default async function TripLayout({ children, params }: LayoutProps<"/trips/[tripId]">) {
  const { tripId } = await params;
  const trip = await getTripBasics(tripId);
  if (!trip) notFound();

  return (
    <div className="flex min-h-dvh flex-col pb-40 md:pb-10">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-4xl px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2 md:mb-2">
            <Link
              href="/trips"
              aria-label="All trips"
              className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </Link>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight">{trip.name}</p>
              <p className="text-xs text-muted-foreground">{plural(trip._count.members, "member")}</p>
            </div>
            <div className="ml-auto">
              <LogoutButton />
            </div>
          </div>
          <TripTopNav tripId={tripId} />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-5">
        {children}
      </main>
      <TripBottomNav tripId={tripId} />
    </div>
  );
}
