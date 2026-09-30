import Link from "next/link";
import { SearchX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function TripNotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <EmptyState
        icon={SearchX}
        title="We couldn't find that"
        description="The trip or page you're looking for doesn't exist or was deleted."
      >
        <Link href="/trips" className={buttonVariants({ size: "lg" })}>
          Back to your trips
        </Link>
      </EmptyState>
    </div>
  );
}
