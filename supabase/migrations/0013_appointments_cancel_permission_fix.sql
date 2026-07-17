-- Version 1 Stabilization — closes a permission-check mismatch flagged by
-- the pre-production architecture review: cancelAppointmentStatus
-- (src/lib/appointments/actions.ts) gates cancellation on
-- appointments.cancel at the application layer, but the "authorized staff
-- can update appointments" policy from 0008_appointments.sql only ever
-- required appointments.edit, regardless of what the update changed. Every
-- seeded role holding appointments.cancel also holds appointments.edit
-- (0007_reapply_rbac.sql), so this changes no current behavior — it closes
-- the gap for any future role where that stops being true.
--
-- Mirrors the exact technique already used for patients.delete on the
-- patients update policy (0007_reapply_rbac.sql): the base .edit permission
-- still covers every ordinary update; transitioning status to 'cancelled'
-- additionally requires .cancel.
drop policy if exists "authorized staff can update appointments" on public.appointments;

create policy "authorized staff can update appointments"
  on public.appointments for update
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('appointments.edit'))
    and (status is distinct from 'cancelled' or (select private.has_permission('appointments.cancel')))
  );
