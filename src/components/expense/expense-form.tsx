"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createExpenseAction, updateExpenseAction } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/native-select";
import { MemberAvatar } from "@/components/member-avatar";
import { calculateExpenseSplits, allocateProportionally } from "@/lib/expenses/calculate";
import { CATEGORY_LABELS, EXPENSE_CATEGORIES, SPLIT_TYPE_LABELS, SPLIT_TYPES, type SplitType } from "@/lib/expenses/types";
import { bpToPercentString, formatMoney, minorToInputString, parseMoneyToMinor, parsePercentToBp } from "@/lib/money";
import { parseParticipantValues } from "@/lib/validation/schemas";
import { memberLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ExpenseFormInitial {
  id: string;
  version: string;
  title: string;
  amount: string;
  category: string;
  notes: string;
  spentAt: string;
  splitType: SplitType;
  payers: { memberId: string; amount: string }[];
  participants: { memberId: string; value: string }[];
}

interface Props {
  tripId: string;
  currency: string;
  currencySymbol: string;
  members: { id: string; name: string }[];
  youId: string | null;
  today: string;
  initial?: ExpenseFormInitial;
}

const QUICK_TITLES: { title: string; category: string }[] = [
  { title: "Hotel", category: "HOTEL" },
  { title: "Dinner", category: "FOOD" },
  { title: "Breakfast", category: "FOOD" },
  { title: "Fuel", category: "FUEL" },
  { title: "Toll", category: "TRANSPORT" },
  { title: "Cab", category: "TRANSPORT" },
  { title: "Tickets", category: "TICKETS" },
  { title: "Snacks", category: "FOOD" },
];

const MULTI = "__multi__";
const SPLIT_SHORT: Record<SplitType, string> = { EQUAL: "Equal", EXACT: "Amounts", PERCENTAGE: "Percent", SHARES: "Shares" };

/** Sensible starting values when switching to a non-equal split so the totals already add up. */
function defaultValues(type: SplitType, ids: string[], totalMinor: number | null, currency: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (ids.length === 0) return out;
  const sorted = [...ids].sort();
  if (type === "SHARES") {
    for (const id of ids) out[id] = "1";
  } else if (type === "PERCENTAGE") {
    const parts = allocateProportionally(10000, sorted.map(() => 1), sorted);
    sorted.forEach((id, i) => (out[id] = bpToPercentString(parts[i])));
  } else if (type === "EXACT" && totalMinor && totalMinor > 0) {
    const parts = allocateProportionally(totalMinor, sorted.map(() => 1), sorted);
    sorted.forEach((id, i) => (out[id] = minorToInputString(parts[i], currency)));
  } else if (type === "EXACT") {
    for (const id of ids) out[id] = "";
  }
  return out;
}

export function ExpenseForm({ tripId, currency, currencySymbol, members, youId, today, initial }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const editing = !!initial;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [spentAt, setSpentAt] = useState(initial?.spentAt ?? today);
  const [splitType, setSplitType] = useState<SplitType>(initial?.splitType ?? "EQUAL");

  const initialMulti = (initial?.payers.length ?? 0) > 1;
  const defaultPayer = initial?.payers[0]?.memberId ?? (youId && members.some((m) => m.id === youId) ? youId : members[0]?.id ?? "");
  const [payerChoice, setPayerChoice] = useState<string>(initialMulti ? MULTI : defaultPayer);
  const [payerAmounts, setPayerAmounts] = useState<Record<string, string>>(
    Object.fromEntries((initial?.payers ?? []).map((p) => [p.memberId, p.amount])),
  );

  const [selected, setSelected] = useState<Set<string>>(
    new Set(initial ? initial.participants.map((p) => p.memberId) : members.map((m) => m.id)),
  );
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries((initial?.participants ?? []).map((p) => [p.memberId, p.value])),
  );

  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  const totalMinor = parseMoneyToMinor(amount, currency);
  const label = (id: string) => {
    const m = members.find((x) => x.id === id);
    return m ? memberLabel(m.name, m.id, youId) : "";
  };
  const selectedIds = members.filter((m) => selected.has(m.id)).map((m) => m.id);

  /** Live preview only - the server recalculates everything from the raw inputs. */
  const preview = useMemo(() => {
    if (!totalMinor || totalMinor <= 0 || selectedIds.length === 0) return { amounts: new Map<string, number>(), note: null as string | null, ok: false };
    try {
      const participants = parseParticipantValues(
        splitType,
        selectedIds.map((id) => ({ memberId: id, value: values[id] ?? "" })),
        currency,
      );
      const res = calculateExpenseSplits({ totalMinor, splitType, participants });
      return { amounts: new Map(res.map((r) => [r.memberId, r.amountMinor])), note: null, ok: true };
    } catch (e) {
      // Still show a helpful running total for the manual modes.
      let note: string | null = null;
      if (splitType === "EXACT") {
        const sum = selectedIds.reduce((a, id) => a + (parseMoneyToMinor(values[id] || "0", currency) ?? 0), 0);
        const diff = totalMinor - sum;
        note = diff === 0 ? null : diff > 0 ? `${formatMoney(diff, currency)} left to assign` : `${formatMoney(-diff, currency)} over the total`;
      } else if (splitType === "PERCENTAGE") {
        const sum = selectedIds.reduce((a, id) => a + (parsePercentToBp(values[id] || "0") ?? 0), 0);
        note = sum === 10000 ? null : `Total is ${bpToPercentString(sum)}% - needs to be 100%`;
      } else if (e instanceof Error) {
        note = e.message;
      }
      return { amounts: new Map<string, number>(), note, ok: false };
    }
  }, [totalMinor, splitType, selectedIds, values, currency]);

  const payerSum = members.reduce((a, m) => a + (parseMoneyToMinor(payerAmounts[m.id] || "0", currency) ?? 0), 0);
  const multi = payerChoice === MULTI;

  function toggleMember(id: string, on: boolean) {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
    if (splitType !== "EQUAL") setValues(defaultValues(splitType, members.filter((m) => next.has(m.id)).map((m) => m.id), totalMinor, currency));
  }

  function setAll(on: boolean) {
    const next = new Set(on ? members.map((m) => m.id) : []);
    setSelected(next);
    if (splitType !== "EQUAL") setValues(defaultValues(splitType, [...next], totalMinor, currency));
  }

  function changeSplitType(type: SplitType) {
    setSplitType(type);
    setValues(type === "EQUAL" ? {} : defaultValues(type, selectedIds, totalMinor, currency));
  }

  function pickQuick(q: { title: string; category: string }) {
    setTitle(q.title);
    if (!category) setCategory(q.category);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    if (!title.trim()) return setError({ message: "Enter a title, e.g. Hotel or Dinner.", field: "title" });
    if (!totalMinor || totalMinor <= 0) return setError({ message: "Enter an amount greater than zero.", field: "amount" });
    if (selectedIds.length === 0) return setError({ message: "Choose at least one person to split with.", field: "participants" });

    const payers = multi
      ? members
          .filter((m) => (parseMoneyToMinor(payerAmounts[m.id] || "0", currency) ?? 0) > 0)
          .map((m) => ({ memberId: m.id, amount: payerAmounts[m.id] }))
      : [{ memberId: payerChoice }];
    if (payers.length === 0 || !payers[0].memberId) return setError({ message: "Choose who paid.", field: "payers" });

    const payload = {
      title,
      amount,
      category: category || null,
      notes: notes || null,
      spentAt,
      splitType,
      payers,
      participants: selectedIds.map((id) => ({ memberId: id, value: splitType === "EQUAL" ? undefined : values[id] ?? "" })),
      version: initial?.version,
    };

    startTransition(async () => {
      try {
        const res = editing ? await updateExpenseAction(tripId, initial!.id, payload) : await createExpenseAction(tripId, payload);
        if (!res.ok) {
          setError({ message: res.error, field: res.field });
          toast.error(res.error);
          return;
        }
        toast.success(editing ? "Expense updated" : "Expense added");
        router.push(editing ? `/trips/${tripId}/expenses/${initial!.id}` : `/trips/${tripId}/expenses`);
        router.refresh();
      } catch {
        const message = "Couldn't reach the server. Check your connection and try again.";
        setError({ message });
        toast.error(message);
      }
    });
  }

  const errFor = (field: string) => (error?.field === field ? error.message : null);
  const generalError = error && !["title", "amount", "participants", "payers"].includes(error.field ?? "") ? error.message : null;

  return (
    <form onSubmit={submit} className="space-y-6" noValidate aria-busy={pending}>
      {generalError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-negative-soft p-3 text-sm text-negative">
          {generalError}
        </div>
      )}

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted-foreground" aria-hidden="true">
            {currencySymbol}
          </span>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            autoFocus={!editing}
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={!!errFor("amount")}
            aria-describedby={errFor("amount") ? "amount-error" : undefined}
            className="h-16 pl-11 text-3xl font-semibold tabular-nums md:h-14 md:text-2xl"
          />
        </div>
        {errFor("amount") && (
          <p id="amount-error" role="alert" className="text-sm text-destructive">
            {errFor("amount")}
          </p>
        )}
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">What was it for?</Label>
        <Input
          id="title"
          name="title"
          autoComplete="off"
          placeholder="Hotel, Dinner, Fuel..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          aria-invalid={!!errFor("title")}
          aria-describedby={errFor("title") ? "title-error" : undefined}
          className="h-12 text-base md:h-10 md:text-sm"
        />
        {errFor("title") && (
          <p id="title-error" role="alert" className="text-sm text-destructive">
            {errFor("title")}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Quick titles">
          {QUICK_TITLES.map((q) => (
            <button
              key={q.title}
              type="button"
              onClick={() => pickQuick(q)}
              className={cn(
                "min-h-9 rounded-full border px-3 text-sm transition-colors hover:bg-accent",
                title === q.title && "border-primary bg-accent text-accent-foreground",
              )}
            >
              {q.title}
            </button>
          ))}
        </div>
      </div>

      {/* Paid by */}
      <div className="space-y-1.5">
        <Label htmlFor="paid-by">Paid by</Label>
        <NativeSelect id="paid-by" value={payerChoice} onChange={(e) => setPayerChoice(e.target.value)}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {label(m.id)}
            </option>
          ))}
          <option value={MULTI}>Multiple people...</option>
        </NativeSelect>
        {multi && (
          <fieldset className="mt-2 space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm text-muted-foreground">How much did each person pay?</legend>
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <Label htmlFor={`payer-${m.id}`} className="min-w-0 flex-1 truncate font-normal">
                  {label(m.id)}
                </Label>
                <Input
                  id={`payer-${m.id}`}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={payerAmounts[m.id] ?? ""}
                  onChange={(e) => setPayerAmounts({ ...payerAmounts, [m.id]: e.target.value })}
                  className="h-11 w-32 text-right text-base tabular-nums md:h-10 md:text-sm"
                />
              </div>
            ))}
            {totalMinor ? (
              <p className={cn("text-sm", payerSum === totalMinor ? "text-positive" : "text-muted-foreground")} aria-live="polite">
                {payerSum === totalMinor
                  ? "Payments add up to the total"
                  : `${formatMoney(payerSum, currency)} of ${formatMoney(totalMinor, currency)} entered`}
              </p>
            ) : null}
          </fieldset>
        )}
        {errFor("payers") && (
          <p role="alert" className="text-sm text-destructive">
            {errFor("payers")}
          </p>
        )}
      </div>

      {/* Split */}
      <fieldset className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <legend className="text-sm font-medium">
            Split between <span className="ml-1 font-normal text-muted-foreground" aria-live="polite">{selectedIds.length} of {members.length} people</span>
          </legend>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setAll(true)}>
              Everyone
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setAll(false)}>
              Clear
            </Button>
          </div>
        </div>

        <div role="radiogroup" aria-label="How to split" className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
          {SPLIT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={splitType === t}
              aria-label={SPLIT_TYPE_LABELS[t]}
              onClick={() => changeSplitType(t)}
              className={cn(
                "min-h-10 rounded-md px-1 text-sm font-medium transition-colors",
                splitType === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {SPLIT_SHORT[t]}
            </button>
          ))}
        </div>

        <ul className="divide-y rounded-lg border bg-card">
          {members.map((m) => {
            const on = selected.has(m.id);
            const share = preview.amounts.get(m.id);
            return (
              <li key={m.id} className="flex min-h-14 items-center gap-3 px-3 py-1.5">
                <Checkbox id={`part-${m.id}`} checked={on} onCheckedChange={(c) => toggleMember(m.id, c === true)} className="size-5" />
                <Label htmlFor={`part-${m.id}`} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 font-normal">
                  <MemberAvatar name={m.name} id={m.id} className="size-8 text-xs" />
                  <span className="truncate">{label(m.id)}</span>
                </Label>
                {on && splitType === "EQUAL" && share !== undefined && (
                  <span className="text-sm tabular-nums text-muted-foreground">{formatMoney(share, currency)}</span>
                )}
                {on && splitType !== "EQUAL" && (
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`${m.name}: ${splitType === "EXACT" ? "amount" : splitType === "PERCENTAGE" ? "percent" : "shares"}`}
                      inputMode={splitType === "SHARES" ? "numeric" : "decimal"}
                      autoComplete="off"
                      value={values[m.id] ?? ""}
                      onChange={(e) => setValues({ ...values, [m.id]: e.target.value })}
                      className="h-10 w-24 text-right text-base tabular-nums md:text-sm"
                    />
                    <span className="w-4 text-sm text-muted-foreground" aria-hidden="true">
                      {splitType === "PERCENTAGE" ? "%" : splitType === "SHARES" ? "×" : ""}
                    </span>
                    {splitType !== "EXACT" && share !== undefined && (
                      <span className="w-20 text-right text-sm tabular-nums text-muted-foreground">{formatMoney(share, currency)}</span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {preview.note && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {preview.note}
          </p>
        )}
        {preview.ok && splitType !== "EQUAL" && (
          <p className="flex items-center gap-1.5 text-sm text-positive" aria-live="polite">
            <Check className="size-4" aria-hidden="true" /> Adds up to the total
          </p>
        )}
        {errFor("participants") && (
          <p role="alert" className="text-sm text-destructive">
            {errFor("participants")}
          </p>
        )}
      </fieldset>

      {/* Details */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="category">
            Category <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <NativeSelect id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">No category</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="spentAt">Date</Label>
          <Input
            id="spentAt"
            type="date"
            value={spentAt}
            max="9999-12-31"
            onChange={(e) => setSpentAt(e.target.value)}
            className="h-11 text-base md:h-10 md:text-sm"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-base md:text-sm" />
      </div>

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0">
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {pending ? "Saving..." : editing ? "Save changes" : totalMinor ? `Add ${formatMoney(totalMinor, currency)} expense` : "Add expense"}
        </Button>
      </div>
    </form>
  );
}
