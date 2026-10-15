"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { joinTripAction } from "@/actions/trips";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function JoinForm({ code, kind, free }: { code: string; kind: string; free: { id: string; name: string }[] }) {
  const router = useRouter();
  const [choice, setChoice] = useState<string | null>(null); // member id, or "new"
  const [pending, startTransition] = useTransition();
  const friend = kind === "FRIEND";

  function join() {
    startTransition(async () => {
      try {
        const res = await joinTripAction(code, choice && choice !== "new" ? choice : null);
        if (!res.ok) return void toast.error(res.error);
        router.replace(`/trips/${res.data.id}`);
        router.refresh();
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  const options = [...free.map((m) => ({ id: m.id, label: `I'm ${m.name}` })), { id: "new", label: "I'm someone new" }];
  return (
    <div className="space-y-4">
      {!friend && (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Which one are you?</legend>
          {options.map((o) => (
            <label
              key={o.id}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 text-sm font-medium",
                choice === o.id && "border-primary bg-accent/50",
              )}
            >
              <input type="radio" name="who" className="size-4 accent-[var(--primary)]" checked={choice === o.id} onChange={() => setChoice(o.id)} />
              {o.label}
            </label>
          ))}
        </fieldset>
      )}
      <Button size="lg" className="h-12 w-full text-base" disabled={pending || (!friend && choice === null)} onClick={join}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {friend ? "Join" : "Join this group"}
      </Button>
    </div>
  );
}
