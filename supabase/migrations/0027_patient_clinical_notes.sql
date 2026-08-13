create table public.patient_clinical_notes (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  author_id uuid references public.staff_profiles (id) on delete set null,
  note text not null,
  appointment_id uuid references public.appointments (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patient_clinical_notes_clinic_id_idx on public.patient_clinical_notes (clinic_id);
create index patient_clinical_notes_patient_id_idx on public.patient_clinical_notes (patient_id);
create index patient_clinical_notes_appointment_id_idx on public.patient_clinical_notes (appointment_id);

create trigger set_updated_at
  before update on public.patient_clinical_notes
  for each row execute function public.set_updated_at();

alter table public.patient_clinical_notes enable row level security;

create policy "clinical staff can view clinical notes"
  on public.patient_clinical_notes for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.view'))
  );

create policy "clinical staff can create clinical notes"
  on public.patient_clinical_notes for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  );

create policy "clinical staff can update clinical notes"
  on public.patient_clinical_notes for update
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  )
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('clinical.edit'))
  );
