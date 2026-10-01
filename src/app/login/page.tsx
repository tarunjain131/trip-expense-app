import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { authMode } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  return (
    <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 space-y-2 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground" aria-hidden="true">
          ₹
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Splitrip</h1>
        <p className="text-sm text-muted-foreground">Enter the group password to continue.</p>
      </div>
      <LoginForm next={next} misconfigured={authMode() === "misconfigured"} />
    </main>
  );
}
