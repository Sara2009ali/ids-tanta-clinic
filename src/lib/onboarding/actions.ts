"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentStaff } from "@/lib/auth/session";
import { isDuplicateAuthError } from "@/lib/auth/errors";
import { fieldErrorsFromZod } from "@/lib/forms/zod-errors";
import {
  signUpFormSchema,
  signUpFormValuesFromFormData,
  generateClinicSlug,
  canSelfServeSignUp,
} from "@/lib/onboarding/schema";

export interface SignUpActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Creates a brand-new clinic, its owner's login identity, and their admin
 * staff_profiles row in one action — the only application-level path that
 * can ever insert into `clinics` (there is no authenticated-user RLS policy
 * for it; only a SELECT policy exists, see 0001_phase1_foundation.sql). All
 * three writes use the service-role client for exactly that reason, the
 * same class of trusted, tightly-scoped bypass createDoctor() already uses
 * for auth.users. On any failure, everything created so far is rolled back,
 * mirroring createDoctor()'s compensating-delete pattern.
 *
 * Guarded by canSelfServeSignUp: a request from someone who already has a
 * staff_profiles row (any role, any clinic) is rejected before anything is
 * created — this flow is for provisioning a brand-new clinic only, never a
 * second clinic for an existing staff member.
 */
export async function signUpClinic(
  _prevState: SignUpActionState,
  formData: FormData,
): Promise<SignUpActionState> {
  const existingStaff = await getCurrentStaff();
  if (!canSelfServeSignUp(existingStaff)) {
    return { error: "You're already part of a clinic. Sign out first to create a new one." };
  }

  const parsed = signUpFormSchema.safeParse(signUpFormValuesFromFormData(formData));
  if (!parsed.success) {
    return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFromZod(parsed.error) };
  }
  const values = parsed.data;

  let admin;
  try {
    admin = createAdminClient();
  } catch (error) {
    console.error("signUpClinic: admin client unavailable", error);
    return { error: "Sign-up isn't configured in this environment yet. Please contact support." };
  }

  const desiredSlug = generateClinicSlug(values.clinic_name, []);
  const { data: collisions } = await admin.from("clinics").select("slug").ilike("slug", `${desiredSlug}%`);
  const slug = generateClinicSlug(
    values.clinic_name,
    (collisions ?? []).map((row) => row.slug),
  );

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email: values.email,
    password: values.password,
    email_confirm: true,
  });

  if (createUserError || !createdUser?.user) {
    if (isDuplicateAuthError(createUserError)) {
      return { error: "This email is already in use.", fieldErrors: { email: "Already in use" } };
    }
    console.error("signUpClinic: auth user creation failed", createUserError);
    return { error: "Couldn't create your account. Please try again." };
  }

  const ownerId = createdUser.user.id;

  const { data: clinic, error: clinicError } = await admin
    .from("clinics")
    .insert({ name: values.clinic_name, slug, timezone: values.timezone, address: values.address ?? null })
    .select("id")
    .single();

  if (clinicError || !clinic) {
    console.error("signUpClinic: clinic insert failed", clinicError);
    await admin.auth.admin.deleteUser(ownerId);
    return { error: "Couldn't create your clinic. Please try again." };
  }

  const { error: staffError } = await admin.from("staff_profiles").insert({
    id: ownerId,
    clinic_id: clinic.id,
    full_name: values.full_name,
    role: "admin",
  });

  if (staffError) {
    console.error("signUpClinic: staff_profiles insert failed", staffError);
    await admin.from("clinics").delete().eq("id", clinic.id);
    await admin.auth.admin.deleteUser(ownerId);
    return { error: "Couldn't finish setting up your account. Please try again." };
  }

  const { error: auditError } = await admin.from("audit_log").insert({
    clinic_id: clinic.id,
    actor_id: ownerId,
    action: "clinic.created",
    entity_type: "clinic",
    entity_id: clinic.id,
  });
  if (auditError) {
    console.error("signUpClinic: audit log write failed", auditError);
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: values.email,
    password: values.password,
  });

  if (signInError) {
    console.error("signUpClinic: sign-in after creation failed", signInError);
    return { error: "Your clinic was created. Please sign in to continue." };
  }

  redirect("/dashboard");
}
