"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { addMembersAction } from "@/actions/trips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** One name, or several separated by commas / new lines, so a whole group can be added in one go. */
export function AddMembersForm({ tripId }: { tripId: string }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const names = value
      .split(/[,\n;]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) {
      setError("Enter a name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await addMembersAction(tripId, names);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        toast.success(res.data.added === 1 ? "Member added" : `${res.data.added} members added`);
        setValue("");
        router.refresh();
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2" noValidate>
      <Label htmlFor="member-names">Add members</Label>
      <div className="flex gap-2">
        <Input
          id="member-names"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Name, or paste several separated by commas"
          autoComplete="off"
          enterKeyHint="done"
          className="h-11 text-base md:h-10 md:text-sm"
          aria-invalid={!!error}
          aria-describedby="member-names-help"
        />
        <Button type="submit" size="lg" className="h-11 shrink-0 gap-2" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
          Add
        </Button>
      </div>
      <p id="member-names-help" role={error ? "alert" : undefined} className={error ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
        {error ?? "Tip: paste “Tarun, Rahul, Amit” to add everyone at once."}
      </p>
    </form>
  );
}
