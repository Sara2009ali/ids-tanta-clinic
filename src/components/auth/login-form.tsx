"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { login, type LoginFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/components/locale-provider";

const initialState: LoginFormState = {};

export function LoginForm() {
  const dict = useTranslation().onboarding.signup;
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@idstanta.com"
          required
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>
      {state.error && (
        <p id="login-error" className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Sign in
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {dict.newClinicQuestion}{" "}
        <Link href="/signup" className="text-foreground underline underline-offset-2">
          {dict.newClinicCta}
        </Link>
      </p>
    </form>
  );
}
