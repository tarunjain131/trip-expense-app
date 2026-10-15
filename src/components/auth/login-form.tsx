"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, LogOut, UserPlus } from "lucide-react";
import { loginAction, logoutAction, signupAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Errors = Partial<Record<"name" | "email" | "password" | "form", string>>;

/** Log-in and sign-up share one form: sign-up just adds a name field. */
export function AuthForm({ mode, next, misconfigured }: { mode: "login" | "signup"; next?: string; misconfigured?: boolean }) {
  const router = useRouter();
  const signup = mode === "signup";
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Errors>(
    misconfigured ? { form: "Login isn't set up yet. The site owner needs to set AUTH_SECRET." } : {},
  );
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setErrors({});
    startTransition(async () => {
      try {
        const res = signup ? await signupAction(values, next) : await loginAction({ email: values.email, password: values.password }, next);
        if (!res.ok) {
          const field = res.field === "name" || res.field === "email" || res.field === "password" ? res.field : "form";
          return setErrors({ [field]: res.error });
        }
        router.replace(res.data.next);
        router.refresh();
      } catch {
        setErrors({ form: "Couldn't reach the server. Check your connection and try again." });
      }
    });
  }

  const other = `${signup ? "/login" : "/signup"}${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {signup && (
        <Field id="name" label="Your name" error={errors.name}>
          <Input id="name" autoComplete="name" autoFocus value={values.name} onChange={set("name")} aria-invalid={!!errors.name} className="h-12 text-base" />
        </Field>
      )}
      <Field id="email" label="Email" error={errors.email}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus={!signup}
          value={values.email}
          onChange={set("email")}
          aria-invalid={!!errors.email}
          className="h-12 text-base"
        />
      </Field>
      <Field id="password" label="Password" error={errors.password} hint={signup ? "At least 8 characters." : undefined}>
        <Input
          id="password"
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          value={values.password}
          onChange={set("password")}
          aria-invalid={!!errors.password}
          className="h-12 text-base"
        />
      </Field>
      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}
      <Button type="submit" size="lg" className="h-12 w-full gap-2 text-base" disabled={pending || misconfigured}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : signup ? (
          <UserPlus className="size-4" aria-hidden="true" />
        ) : (
          <LogIn className="size-4" aria-hidden="true" />
        )}
        {pending ? "Please wait..." : signup ? "Create account" : "Log in"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {signup ? "Already have an account? " : "New here? "}
        <Link href={other} className="font-medium text-primary underline-offset-4 hover:underline">
          {signup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-10 gap-1.5 text-muted-foreground"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await logoutAction();
          router.replace("/login");
          router.refresh();
        })
      }
    >
      <LogOut className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">Log out</span>
      <span className="sr-only sm:hidden">Log out</span>
    </Button>
  );
}
