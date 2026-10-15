import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserPage } from "@/lib/access";
import { getInvitePreview } from "@/lib/services/trips";
import { JoinForm } from "@/components/trip/join-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Join" };
export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const user = await requireUserPage();
  const trip = await getInvitePreview(code);

  if (!trip) {
    return (
      <Shell title="This invite isn't valid" text="The link may have been reset. Ask for a new one.">
        <Button asChild size="lg" className="h-12 w-full">
          <Link href="/trips">Go to my splits</Link>
        </Button>
      </Shell>
    );
  }
  if (trip.members.some((m) => m.userId === user.id)) redirect(`/trips/${trip.id}`);

  const free = trip.members.filter((m) => m.userId === null).map((m) => ({ id: m.id, name: m.name }));
  const friend = trip.kind === "FRIEND";
  const full = friend && free.length !== 1;
  const who = trip.owner?.name ?? "Someone";

  return (
    <Shell
      title={friend ? `${who} wants to split with you` : `Join "${trip.name}"`}
      text={
        full
          ? "Both people in this ledger are already set up."
          : friend
            ? "You'll see what you owe each other and can add expenses together."
            : `${who} invited you. Pick which person you are so your past expenses are linked to you.`
      }
    >
      {full ? (
        <Button asChild size="lg" className="h-12 w-full">
          <Link href="/trips">Go to my splits</Link>
        </Button>
      ) : (
        <JoinForm code={code} kind={trip.kind} free={free} />
      )}
    </Shell>
  );
}

function Shell({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      {children}
    </main>
  );
}
