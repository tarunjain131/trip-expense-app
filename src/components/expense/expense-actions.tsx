"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteExpenseAction, duplicateExpenseAction } from "@/actions/expenses";
import { Button, buttonVariants } from "@/components/ui/button";
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

export function ExpenseActions({ tripId, expenseId, title }: { tripId: string; expenseId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function duplicate() {
    startTransition(async () => {
      try {
        const res = await duplicateExpenseAction(tripId, expenseId);
        if (!res.ok) return void toast.error(res.error);
        toast.success("Expense duplicated - adjust it if needed");
        router.push(`/trips/${tripId}/expenses/${res.data.id}/edit`);
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        const res = await deleteExpenseAction(tripId, expenseId);
        if (!res.ok) {
          toast.error(res.error);
          setOpen(false);
          router.refresh();
          return;
        }
        toast.success("Expense deleted");
        router.push(`/trips/${tripId}/expenses`);
        router.refresh();
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <Link href={`/trips/${tripId}/expenses/${expenseId}/edit`} className={`${buttonVariants({ variant: "outline", size: "lg" })} h-11 gap-2`}>
        <Pencil className="size-4" aria-hidden="true" />
        Edit
      </Link>
      <Button variant="outline" size="lg" className="h-11 gap-2" onClick={duplicate} disabled={pending}>
        {pending && !open ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        Duplicate
      </Button>
      <Button variant="outline" size="lg" className="h-11 gap-2 text-destructive" onClick={() => setOpen(true)} disabled={pending}>
        <Trash2 className="size-4" aria-hidden="true" />
        Delete
      </Button>

      <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Everyone&apos;s balances will be recalculated without this expense. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Delete expense
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
