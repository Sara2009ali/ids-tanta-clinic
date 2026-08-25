"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { signUpClinic, type SignUpActionState } from "@/lib/onboarding/actions";
import { CLINIC_TIMEZONE_OPTIONS } from "@/lib/onboarding/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/components/locale-provider";

const initialState: SignUpActionState = {};

export function SignUpForm() {
  const dict = useTranslation().onboarding.signup;
  const [state, formAction, pending] = useActionState(signUpClinic, initialState);
  const fieldErrors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <FormField label={dict.clinicNameLabel} htmlFor="clinic_name" required error={fieldErrors.clinic_name}>
        <Input
          id="clinic_name"
          name="clinic_name"
          placeholder={dict.clinicNamePlaceholder}
          required
          autoFocus
          aria-invalid={!!fieldErrors.clinic_name}
        />
      </FormField>

      <FormField label={dict.addressLabel} htmlFor="address" error={fieldErrors.address}>
        <Input id="address" name="address" placeholder={dict.addressPlaceholder} aria-invalid={!!fieldErrors.address} />
      </FormField>

      <FormField label={dict.timezoneLabel} htmlFor="timezone" error={fieldErrors.timezone}>
        <Select name="timezone" defaultValue="Africa/Cairo">
          <SelectTrigger id="timezone" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLINIC_TIMEZONE_OPTIONS.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <FormField label={dict.fullNameLabel} htmlFor="full_name" required error={fieldErrors.full_name}>
        <Input id="full_name" name="full_name" placeholder={dict.fullNamePlaceholder} required aria-invalid={!!fieldErrors.full_name} />
      </FormField>

      <FormField label={dict.emailLabel} htmlFor="email" required error={fieldErrors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder={dict.emailPlaceholder}
          required
          aria-invalid={!!fieldErrors.email}
        />
      </FormField>

      <FormField label={dict.passwordLabel} htmlFor="password" required error={fieldErrors.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!fieldErrors.password} />
      </FormField>

      <FormField label={dict.confirmPasswordLabel} htmlFor="confirm_password" required error={fieldErrors.confirm_password}>
        <Input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!fieldErrors.confirm_password}
        />
      </FormField>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {dict.submit}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {dict.haveAccount} <Link href="/login" className="text-foreground underline underline-offset-2">{dict.signIn}</Link>
      </p>
    </form>
  );
}
