import { ArrowDownLeft, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { balanceStatus } from "@/lib/balances/calculate";
import { cn } from "@/lib/utils";

/**
 * Communicates a balance with words and an icon as well as colour:
 * "gets back ₹2,800" / "owes ₹2,000" / "settled".
 */
export function BalanceStatus({
  net,
  currency,
  className,
  subject,
}: {
  net: number;
  currency: string;
  className?: string;
  /** Optional leading subject, e.g. "You" -> "You owe". */
  subject?: string;
}) {
  const status = balanceStatus(net);
  const amount = formatMoney(Math.abs(net), currency);
  const owes = subject === "You" ? "owe" : "owes";
  const gets = subject === "You" ? "get back" : "gets back";
  const lead = subject ? `${subject} ` : "";

  if (status === "settled") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-medium text-muted-foreground", className)}>
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {subject ? `${subject} ${subject === "You" ? "are" : "is"} settled up` : "Settled"}
      </span>
    );
  }
  if (status === "gets_back") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 font-semibold text-positive", className)}>
        <ArrowDownLeft className="size-4" aria-hidden="true" />
        {lead}
        {gets} {amount}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold text-negative", className)}>
      <ArrowUpRight className="size-4" aria-hidden="true" />
      {lead}
      {owes} {amount}
    </span>
  );
}
