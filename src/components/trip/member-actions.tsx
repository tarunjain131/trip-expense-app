"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { removeMemberAction, renameMemberAction } from "@/actions/trips";
import { setYouAction } from "@/actions/you";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function MemberActions({
  tripId,
  member,
  isYou,
  redirectOnRemove,
  compact,
}: {
  tripId: string;
  member: { id: string; name: string };
  isYou: boolean;
  redirectOnRemove?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [name, setName] = useState(member.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function rename(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await renameMemberAction(tripId, member.id, { name });
        if (!res.ok) return setError(res.error);
        toast.success("Name updated");
        setRenameOpen(false);
        router.refresh();
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      try {
        const res = await removeMemberAction(tripId, member.id);
        if (!res.ok) {
          toast.error(res.error);
          setRemoveOpen(false);
          return;
        }
        toast.success(`${member.name} removed`);
        setRemoveOpen(false);
        if (redirectOnRemove) router.push(redirectOnRemove);
        else router.refresh();
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  function toggleYou() {
    startTransition(async () => {
      try {
        const res = await setYouAction(tripId, isYou ? null : member.id);
        if (!res.ok) return void toast.error(res.error);
        toast.success(isYou ? "Cleared" : `You are ${member.name}`);
        router.refresh();
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  const size = compact ? "icon" : "lg";
  return (
    <div className="flex items-center gap-1.5">
      {!compact && (
        <Button variant={isYou ? "secondary" : "outline"} size="lg" className="h-11 gap-2" onClick={toggleYou} disabled={pending}>
          <UserCheck className="size-4" aria-hidden="true" />
          {isYou ? "This is not me" : "This is me"}
        </Button>
      )}
      <Button
        variant="outline"
        size={size}
        className={compact ? "size-10" : "h-11 gap-2"}
        onClick={() => {
          setName(member.name);
          setError(null);
          setRenameOpen(true);
        }}
        aria-label={`Rename ${member.name}`}
      >
        <Pencil className="size-4" aria-hidden="true" />
        {!compact && "Rename"}
      </Button>
      <Button
        variant="outline"
        size={size}
        className={compact ? "size-10 text-destructive" : "h-11 gap-2 text-destructive"}
        onClick={() => setRemoveOpen(true)}
        aria-label={`Remove ${member.name}`}
      >
        <Trash2 className="size-4" aria-hidden="true" />
        {!compact && "Remove"}
      </Button>

      <Dialog open={renameOpen} onOpenChange={(o) => !pending && setRenameOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename member</DialogTitle>
            <DialogDescription>Past expenses keep their amounts; only the name changes.</DialogDescription>
          </DialogHeader>
          <form onSubmit={rename} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor={`rename-${member.id}`}>Name</Label>
              <Input
                id={`rename-${member.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
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
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removeOpen} onOpenChange={(o) => !pending && setRemoveOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This only works if {member.name} isn&apos;t part of any expense or settlement yet.
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
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
