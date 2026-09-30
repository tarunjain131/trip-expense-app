"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { revertSettlementAction } from "@/actions/settlements";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function RevertButton({ tripId, settlementId, description }: { tripId: string; settlementId: string; description: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function revert() {
    startTransition(async () => {
      try {
        const res = await revertSettlementAction(tripId, settlementId);
        if (!res.ok) toast.error(res.error);
        else toast.success("Settlement reverted. The balance is outstanding again.");
        setOpen(false);
        router.refresh();
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="h-10 shrink-0 gap-1.5 text-muted-foreground" onClick={() => setOpen(true)}>
        <Undo2 className="size-4" aria-hidden="true" />
        Undo
        <span className="sr-only"> {description}</span>
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this settlement?</AlertDialogTitle>
            <AlertDialogDescription>
              {description} will be marked as reverted and the amount becomes outstanding again. The record stays in the history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                revert();
              }}
              disabled={pending}
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Undo settlement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
