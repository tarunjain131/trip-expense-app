"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/native-select";
import { createTripAction } from "@/actions/trips";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/money/currency";

const formSchema = z.object({
  name: z.string().trim().min(1, "Give your trip a name.").max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(300, "Keep the description under 300 characters."),
  currency: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

export function CreateTripDialog({ label = "New trip", variant = "default" }: { label?: string; variant?: "default" | "outline" }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", currency: DEFAULT_CURRENCY },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      try {
        const res = await createTripAction(values);
        if (!res.ok) {
          if (res.field === "name" || res.field === "description") setError(res.field, { message: res.error });
          else toast.error(res.error);
          return;
        }
        toast.success("Trip created");
        setOpen(false);
        router.push(`/trips/${res.data.id}/members`);
      } catch {
        toast.error("Couldn't reach the server. Check your connection and try again.");
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant={variant} size="lg" className="h-11 gap-2">
          <Plus className="size-4" aria-hidden="true" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a trip</DialogTitle>
          <DialogDescription>You&apos;ll add the people and expenses next.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="trip-name">Trip name</Label>
            <Input
              id="trip-name"
              placeholder="Chopta Trip"
              autoComplete="off"
              className="h-11 text-base md:h-10 md:text-sm"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "trip-name-error" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="trip-name-error" role="alert" className="text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea id="trip-description" rows={2} placeholder="October 2026 group trip" {...register("description")} />
            {errors.description && (
              <p role="alert" className="text-sm text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trip-currency">Currency</Label>
            <NativeSelect id="trip-currency" {...register("currency")}>
              {Object.values(CURRENCIES).map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code} - {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {pending ? "Creating..." : "Create trip"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
