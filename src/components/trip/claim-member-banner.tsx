"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { claimMemberAction } from "@/actions/trips";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";

/** Shown when your account isn't linked to anyone in this trip yet (e.g. trips created before accounts). */
export function ClaimMemberBanner({ tripId, members }: { tripId: string; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");
  if (members.length === 0) return null;

  function choose(id: string) {
    setValue(id);
    if (!id) return;
    startTransition(async () => {
      try {
        const res = await claimMemberAction(tripId, id);
        if (!res.ok) return void toast.error(res.error);
        router.refresh();
      } catch {
        toast.error("Couldn't save that. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-accent/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UserRound className="size-4 text-primary" aria-hidden="true" />
        <Label htmlFor="who-are-you">Which one are you? We&apos;ll link it to your account.</Label>
      </div>
      <div className="sm:w-56">
        <NativeSelect id="who-are-you" value={value} disabled={pending} onChange={(e) => choose(e.target.value)}>
          <option value="">Choose your name</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
