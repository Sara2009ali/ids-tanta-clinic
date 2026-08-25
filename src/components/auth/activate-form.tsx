"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { useTranslation } from "@/components/locale-provider";

type Status = "checking" | "ready" | "invalid";

/**
 * Completes a Supabase Auth invite: @supabase/ssr's browser client detects
 * the invite token in the URL on mount and turns it into a real (but
 * password-less) session — see lib/supabase/proxy.ts for why /activate must
 * stay in PUBLIC_PATHS so that first request isn't redirected away before
 * this ever runs. Once a session exists, the only thing left is to let the
 * invitee set the password nobody else — not even an admin — ever saw.
 */
export function ActivateForm() {
  const dict = useTranslation().onboarding.activate;
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setStatus(data.session ? "ready" : "invalid");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(dict.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(dict.passwordsDontMatch);
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError(dict.genericError);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    });
  }

  if (status === "checking") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {dict.checking}
      </div>
    );
  }

  if (status === "invalid") {
    return <p className="text-sm text-destructive">{dict.invalidLink}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <FormField label={dict.passwordLabel} htmlFor="password" required>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </FormField>

      <FormField label={dict.confirmPasswordLabel} htmlFor="confirm_password" required>
        <Input
          id="confirm_password"
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

      <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {dict.submit}
      </Button>
    </form>
  );
}
