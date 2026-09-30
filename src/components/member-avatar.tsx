import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-teal-100 text-teal-900",
  "bg-sky-100 text-sky-900",
  "bg-amber-100 text-amber-900",
  "bg-rose-100 text-rose-900",
  "bg-violet-100 text-violet-900",
  "bg-lime-100 text-lime-900",
  "bg-orange-100 text-orange-900",
  "bg-indigo-100 text-indigo-900",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function MemberAvatar({ name, id, className }: { name: string; id: string; className?: string }) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        PALETTE[hash(id) % PALETTE.length],
        className,
      )}
    >
      {initial}
    </span>
  );
}
