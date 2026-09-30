"use client";

import { useState, useTransition } from "react";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { setYouAction } from "@/actions/you";
import { NativeSelect } from "@/components/native-select";
import { Label } from "@/components/ui/label";

/** Banner asking "Who are you?" - the answer is stored in a cookie on this device only. */
export function YouPicker({ tripId, members }: { tripId: string; members: { id: string; name: string }[] }) {
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState("");

  function choose(id: string) {
    setValue(id);
    if (!id) return;
    startTransition(async () => {
      try {
        const res = await setYouAction(tripId, id);
        if (!res.ok) toast.error(res.error);
      } catch {
        toast.error("Couldn't save that. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-accent/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm font-medium">
        <UserRound className="size-4 text-primary" aria-hidden="true" />
        <Label htmlFor="who-are-you">Who are you? We&apos;ll show your balance here.</Label>
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
