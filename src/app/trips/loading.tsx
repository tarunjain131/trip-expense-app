import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
      <Skeleton className="h-8 w-40" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </main>
  );
}
