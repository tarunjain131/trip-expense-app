"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Plus, Receipt, Scale, HandCoins, Users, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const ITEMS = [
  { href: "", label: "Home", icon: Home, exact: true },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/balances", label: "Balances", icon: Scale },
  { href: "/settlements", label: "Settle up", icon: HandCoins },
  { href: "/members", label: "Members", icon: Users },
  { href: "/summary", label: "Summary", icon: PieChart, desktopOnly: true },
] as const;

function useActive(tripId: string) {
  const pathname = usePathname();
  const base = `/trips/${tripId}`;
  const isActive = (href: string, exact?: boolean) => {
    const full = base + href;
    return exact ? pathname === full : pathname === full || pathname.startsWith(full + "/");
  };
  return { pathname, base, isActive };
}

/** Desktop tabs, rendered inside the page header. */
export function TripTopNav({ tripId }: { tripId: string }) {
  const { base, isActive } = useActive(tripId);
  return (
      <nav aria-label="Trip sections" className="-mx-3 hidden items-center gap-1 whitespace-nowrap md:flex">
        {ITEMS.map(({ href, label, icon: Icon, ...rest }) => {
          const active = isActive(href, "exact" in rest ? rest.exact : false);
          return (
            <Link
              key={label}
              href={base + href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
        <Link href={`${base}/expenses/new`} className={cn(buttonVariants({ size: "sm" }), "ml-2 gap-1.5")}>
          <Plus className="size-4" aria-hidden="true" />
          Add expense
        </Link>
      </nav>
  );
}

/**
 * Mobile floating "Add expense" + bottom bar. Must NOT be rendered inside an element with
 * backdrop-filter/transform (e.g. the header), or `position: fixed` would anchor to it.
 */
export function TripBottomNav({ tripId }: { tripId: string }) {
  const { pathname, base, isActive } = useActive(tripId);
  const hideFab = pathname.endsWith("/expenses/new") || pathname.endsWith("/edit");
  return (
    <>
      {/* Mobile: floating add + bottom bar */}
      {!hideFab && (
        <Link
          href={`${base}/expenses/new`}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 md:hidden"
        >
          <Plus className="size-5" aria-hidden="true" />
          Add expense
        </Link>
      )}
      <nav
        aria-label="Trip sections"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {ITEMS.filter((i) => !("desktopOnly" in i)).map(({ href, label, icon: Icon, ...rest }) => {
          const active = isActive(href, "exact" in rest ? rest.exact : false);
          return (
            <Link
              key={label}
              href={base + href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "stroke-[2.5]")} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
