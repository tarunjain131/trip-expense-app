import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/access";
import { authSecret, safeNextPath } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  if (await getCurrentUser()) redirect(safeNextPath(next));
  return (
    <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 space-y-2 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-2xl font-bold text-primary-foreground" aria-hidden="true">
          ₹
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-sm text-muted-foreground">Split trips, groups and one-to-one balances with friends.</p>
      </div>
      <AuthForm mode="signup" next={next} misconfigured={authSecret() === null} />
    </main>
  );
}
