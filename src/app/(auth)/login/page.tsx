import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { typography } from "@/lib/typography";

export const metadata: Metadata = {
  title: "Sign in — Dentra",
};

export default function LoginPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className={typography.pageTitle}>Welcome back</h1>
        <p className="text-sm text-muted-foreground">Sign in to your clinic workspace to continue.</p>
      </div>
      <LoginForm />
    </div>
  );
}
