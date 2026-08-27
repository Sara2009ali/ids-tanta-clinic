"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppOrigin } from "@/lib/http/origin";
import { getLocale, getDictionary } from "@/lib/i18n/server";

export interface LoginFormState {
  error?: string;
}

export async function login(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export interface ForgotPasswordFormState {
  error?: string;
  success?: boolean;
}

/**
 * Sends a Supabase Auth recovery email, reusing /activate as the completion
 * step: a recovery link and an invite link both just establish a
 * password-less session client-side (see activate-form.tsx), and that page
 * already does nothing more than wait for a session and then call
 * updateUser({password}) — no separate "reset password" completion page is
 * needed. Always returns a generic success response regardless of whether
 * the email matches an account, so this can't be used to enumerate which
 * emails have accounts.
 */
export async function requestPasswordReset(
  _prevState: ForgotPasswordFormState,
  formData: FormData,
): Promise<ForgotPasswordFormState> {
  const email = formData.get("email");
  const dict = getDictionary(await getLocale()).auth.forgotPassword;

  if (typeof email !== "string" || !email.trim()) {
    return { error: dict.missingEmailError };
  }

  const supabase = await createClient();
  const origin = await getAppOrigin();
  await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origin}/activate` });

  return { success: true };
}
