"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { useTranslation } from "@/components/locale-provider";
import { validateNewPassword } from "@/lib/settings/password";

/**
 * Changes the signed-in staff member's own password. Unlike /activate
 * (which trusts a freshly-established, password-less invite/recovery
 * session), this re-verifies the CURRENT password first via
 * signInWithPassword before calling updateUser() — otherwise anyone at an
 * unlocked, already-signed-in device could silently take over the account
 * without ever knowing the existing password. Both calls go through the
 * same browser Supabase client and existing Auth conventions; no new
 * architecture, no MFA, no device management.
 */
export function PasswordChangeForm({ email }: { email: string }) {
  const dict = useTranslation().account;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const validation = validateNewPassword(newPassword, confirmPassword);
    if (!validation.ok) {
      setError(validation.reason === "too_short" ? dict.passwordTooShort : dict.passwordsDontMatch);
      return;
    }

    startTransition(async () => {
      const supabase = createClient();

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) {
        setError(dict.currentPasswordIncorrect);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(dict.genericError);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(dict.passwordUpdatedToast);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormField label={dict.currentPasswordLabel} htmlFor="current_password" required>
        <Input
          id="current_password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
      </FormField>

      <FormField label={dict.newPasswordLabel} htmlFor="new_password" required>
        <Input
          id="new_password"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
      </FormField>

      <FormField label={dict.confirmPasswordLabel} htmlFor="confirm_new_password" required>
        <Input
          id="confirm_new_password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </FormField>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {dict.submit}
      </Button>
    </form>
  );
}
