-- Batch 5 — Clinic Administration. Additive only: one new RLS policy on an
-- existing table, one new storage bucket + two storage policies. No new
-- tables, no new columns, no change to any existing policy or function.
--
-- 1. clinics currently has only a SELECT policy ("staff can read their own
--    clinic", 0001_phase1_foundation.sql) — clinic creation deliberately
--    stays exclusive to onboarding's service-role bypass (signUpClinic()),
--    but there was no way for an authenticated admin to edit their own
--    clinic's name/phone/address/timezone/logo afterwards without a second
--    service-role path. This adds exactly one UPDATE policy, in the same
--    "clinic tenancy AND role" shape "admins can manage staff in their
--    clinic" already uses on staff_profiles — least-privilege, ordinary
--    authenticated write, no service-role client involved.
create policy "admins can update their own clinic"
  on public.clinics for update
  to authenticated
  using (
    (id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
    or (select private.current_staff_role()) = 'super_admin'
  )
  with check (
    (id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
    or (select private.current_staff_role()) = 'super_admin'
  );

-- 2. Clinic logo storage. Mirrors the patient-files bucket's own convention
--    (0001_phase1_foundation.sql) — a private-by-default bucket with
--    objects path-prefixed by clinic_id, RLS scoping writes to that same
--    prefix — except this bucket is `public`: a clinic logo is branding,
--    not PII, so it can be read via a plain public URL (no signed-URL
--    refresh needed) the same way clinics.logo_url is already meant to be
--    used. A public bucket needs no SELECT policy on storage.objects —
--    Supabase serves the public object URL unconditionally — only INSERT
--    and DELETE need policies, restricted to admin/super_admin (the same
--    authority level settings.manage already requires) rather than every
--    clinic staff member.
insert into storage.buckets (id, name, public)
values ('clinic-logos', 'clinic-logos', true)
on conflict (id) do nothing;

create policy "admins can upload their clinic logo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'clinic-logos'
    and (
      (select private.current_staff_role()) = 'super_admin'
      or (
        (storage.foldername(name))[1] = (select private.current_clinic_id())::text
        and (select private.current_staff_role()) = 'admin'
      )
    )
  );

create policy "admins can delete their clinic logo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'clinic-logos'
    and (
      (select private.current_staff_role()) = 'super_admin'
      or (
        (storage.foldername(name))[1] = (select private.current_clinic_id())::text
        and (select private.current_staff_role()) = 'admin'
      )
    )
  );
