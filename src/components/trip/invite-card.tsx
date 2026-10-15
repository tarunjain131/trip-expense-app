"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { ensureInviteAction, regenerateInviteAction } from "@/actions/trips";
import { Button } from "@/components/ui/button";

const subscribeNever = () => () => {};

/** Shareable join link. Anyone with it can join after logging in, so the owner can reset it. */
export function InviteCard({ tripId, name, code, isOwner, kind }: { tripId: string; name: string; code: string | null; isOwner: boolean; kind: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  // The origin is only known in the browser; computing it after mount avoids a server/client hydration mismatch.
  const origin = useSyncExternalStore(subscribeNever, () => window.location.origin, () => "");
  const canShare = useSyncExternalStore(subscribeNever, () => typeof navigator.share === "function", () => false);
  const url = code && origin ? `${origin}/join/${code}` : null;

  function make(fn: typeof ensureInviteAction) {
    startTransition(async () => {
      try {
        const res = await fn(tripId);
        if (!res.ok) return void toast.error(res.error);
        router.refresh();
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  }

  async function share() {
    if (!url) return;
    try {
      await navigator.share({ title: name, text: `Join "${name}" on Splitrip`, url });
    } catch {
      /* user dismissed the share sheet */
    }
  }

  return (
    <section aria-labelledby="invite-title" className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Link2 className="size-4 text-primary" aria-hidden="true" />
        <h2 id="invite-title" className="font-medium">
          {kind === "FRIEND" ? "Invite your friend" : "Invite people"}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Send this link. They create an account (or log in) and {kind === "FRIEND" ? "see your shared balance" : "pick which person they are"}.
      </p>
      {code ? (
        <>
          <input readOnly value={url ?? ""} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className="h-11 w-full rounded-lg border bg-muted/40 px-3 text-sm" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11 gap-2" onClick={copy}>
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            {canShare && (
              <Button variant="outline" className="h-11 gap-2" onClick={share}>
                <Share2 className="size-4" aria-hidden="true" />
                Share
              </Button>
            )}
            {isOwner && (
              <Button variant="ghost" className="h-11 gap-2 text-muted-foreground" disabled={pending} onClick={() => make(regenerateInviteAction)}>
                <RefreshCw className="size-4" aria-hidden="true" />
                New link
              </Button>
            )}
          </div>
        </>
      ) : (
        <Button className="h-11" disabled={pending} onClick={() => make(ensureInviteAction)}>
          Create invite link
        </Button>
      )}
    </section>
  );
}
