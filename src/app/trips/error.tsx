"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <EmptyState
        icon={AlertTriangle}
        title="Something went wrong"
        description="We couldn't load this page. Check your connection and try again."
      >
        <Button onClick={reset} size="lg" className="h-11">
          Try again
        </Button>
      </EmptyState>
    </main>
  );
}
