"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { requestPasswordReset, type ForgotPasswordFormState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/components/locale-provider";

const initialState: ForgotPasswordFormState = {};

export function ForgotPasswordForm() {
  const dict = useTranslation().auth.forgotPassword;
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  if (state.success) {
    return <p className="text-sm text-muted-foreground">{dict.successMessage}</p>;
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">{dict.emailLabel}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder={dict.emailPlaceholder}
          required
          aria-invalid={!!state.error}
          aria-describedby={state.error ? "forgot-password-error" : undefined}
        />
      </div>
      {state.error && (
        <p id="forgot-password-error" className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {dict.submit}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-foreground underline underline-offset-2">
          {dict.backToLogin}
        </Link>
      </p>
    </form>
  );
}
