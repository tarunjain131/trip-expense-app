"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createFriendAction } from "@/actions/trips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/native-select";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/money/currency";

/** Start a running two-person balance. The email is optional: with it, an existing account is linked instantly. */
export function AddFriendDialog({ label = "Add friend", variant = "outline" }: { label?: string; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      try {
        const res = await createFriendAction({ name, email, currency });
        if (!res.ok) {
          if (res.field === "name" || res.field === "email") setErrors({ [res.field]: res.error });
          else toast.error(res.error);
          return;
        }
        toast.success(res.data.existing ? "You already share a ledger. Opening it." : "Added");
        setOpen(false);
        setName("");
        setEmail("");
        router.push(`/trips/${res.data.id}`);
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant={variant} size="lg" className="h-11 gap-2">
          <UserPlus className="size-4" aria-hidden="true" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a friend</DialogTitle>
          <DialogDescription>Keep one running balance between the two of you: who owes whom, always up to date.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="friend-name">Friend&apos;s name</Label>
            <Input id="friend-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} className="h-11 text-base md:h-10 md:text-sm" />
            {errors.name && (
              <p role="alert" className="text-sm text-destructive">
                {errors.name}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="friend-email">
              Their email <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="friend-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              className="h-11 text-base md:h-10 md:text-sm"
            />
            <p className="text-xs text-muted-foreground">If they already have an account, they&apos;ll see this right away. Otherwise you can send them a link.</p>
            {errors.email && (
              <p role="alert" className="text-sm text-destructive">
                {errors.email}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="friend-currency">Currency</Label>
            <NativeSelect id="friend-currency" value={currency} onChange={(e) => setCurrency(e.target.value as typeof currency)}>
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code} - {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {pending ? "Adding..." : "Add friend"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
