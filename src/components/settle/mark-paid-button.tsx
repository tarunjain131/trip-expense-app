"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { markSettlementPaidAction } from "@/actions/settlements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { minorToInputString } from "@/lib/money";

export function MarkPaidButton({
  tripId,
  payerId,
  receiverId,
  amountMinor,
  currency,
  payerName,
  receiverName,
}: {
  tripId: string;
  payerId: string;
  receiverId: string;
  amountMinor: number;
  currency: string;
  payerName: string;
  receiverName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(minorToInputString(amountMinor, currency));
  const [error, setError] = useState<string | null>(null);

  function pay(amount: string, onDone?: () => void) {
    startTransition(async () => {
      try {
        const res = await markSettlementPaidAction(tripId, { payerId, receiverId, amount });
        if (!res.ok) {
          setError(res.error);
          toast.error(res.error);
          router.refresh(); // outstanding amounts may have changed
          return;
        }
        toast.success(`${payerName} paid ${receiverName}`);
        onDone?.();
        router.refresh();
      } catch {
        const msg = "Couldn't reach the server. Check your connection and try again.";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
      <Button
        size="lg"
        className="h-11 gap-2"
        disabled={pending}
        onClick={() => pay(minorToInputString(amountMinor, currency))}
        aria-label={`Mark as paid: ${payerName} pays ${receiverName}`}
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
        Mark as paid
      </Button>
      <Button
        variant="ghost"
        size="lg"
        className="h-11"
        disabled={pending}
        onClick={() => {
          setError(null);
          setCustom(minorToInputString(amountMinor, currency));
          setOpen(true);
        }}
      >
        Part payment
      </Button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record a part payment</DialogTitle>
            <DialogDescription>
              {payerName} pays {receiverName}. Up to the outstanding amount.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              pay(custom, () => setOpen(false));
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor={`part-${payerId}-${receiverId}`}>Amount paid</Label>
              <Input
                id={`part-${payerId}-${receiverId}`}
                inputMode="decimal"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="h-11 text-base md:h-10 md:text-sm"
                aria-invalid={!!error}
              />
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" size="lg" className="h-11 w-full sm:w-auto" disabled={pending}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Record payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
