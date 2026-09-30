import { Check, Undo2 } from "lucide-react";
import type { MemberDTO, SettlementDTO } from "@/lib/db/queries";
import { formatMoney } from "@/lib/money";
import { memberLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SettlementLine({
  settlement: s,
  memberById,
  youId,
  currency,
  dateLabel,
  action,
}: {
  settlement: SettlementDTO;
  memberById: Map<string, MemberDTO>;
  youId: string | null;
  currency: string;
  dateLabel: string;
  action?: React.ReactNode;
}) {
  const payer = memberById.get(s.payerId);
  const receiver = memberById.get(s.receiverId);
  const reverted = s.status === "REVERTED";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
            reverted ? "bg-muted text-muted-foreground" : "bg-positive-soft text-positive",
          )}
        >
          {reverted ? <Undo2 className="size-3.5" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
        </span>
        <div className="min-w-0">
          <p className={cn("font-medium", reverted && "text-muted-foreground line-through")}>
            <span className="sr-only">{reverted ? "Reverted: " : "Paid: "}</span>
            {payer ? memberLabel(payer.name, payer.id, youId) : "Unknown"} paid{" "}
            {receiver ? memberLabel(receiver.name, receiver.id, youId) : "Unknown"}{" "}
            <span className="tabular-nums">{formatMoney(s.amountMinor, currency)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {dateLabel}
            {reverted && " · Reverted"}
          </p>
        </div>
      </div>
      {action}
    </div>
  );
}
