"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function TripError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Something went wrong"
      description="We couldn't load this page. Check your connection and try again."
    >
      <Button onClick={reset} size="lg" className="h-11">
        Try again
      </Button>
    </EmptyState>
  );
}
