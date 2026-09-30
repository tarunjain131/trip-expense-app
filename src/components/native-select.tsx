import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Styled native <select>: the best picker UX on phones (native wheel/sheet) and fully accessible. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  function NativeSelect({ className, children, ...props }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "h-11 w-full appearance-none rounded-lg border border-input bg-background pl-3 pr-9 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:h-10 md:text-sm",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
    );
  },
);
