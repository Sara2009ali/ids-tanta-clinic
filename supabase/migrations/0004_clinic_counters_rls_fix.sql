-- Bug fix found via live testing: clinic_counters had RLS enabled (Supabase's
-- default-on-new-tables behavior) with zero policies, so the
-- assign_patient_number() trigger — which every patient insert depends on —
-- failed with "new row violates row-level security policy for table
-- clinic_counters" for every authenticated request. clinic_counters is
-- internal bookkeeping only, never queried directly by application code, so
-- the fix is to make the trigger function SECURITY DEFINER (bypassing RLS
-- for its own internal counter bookkeeping, same pattern as the
-- private.current_clinic_id()/current_staff_role() helpers) rather than
-- opening up direct RLS policies on the table.

alter table public.clinic_counters enable row level security;

create or replace function public.assign_patient_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_number integer;
begin
  if new.patient_number is not null and new.patient_number <> '' then
    return new;
  end if;

  insert into public.clinic_counters (clinic_id, next_patient_number)
  values (new.clinic_id, 2)
  on conflict (clinic_id) do update
    set next_patient_number = public.clinic_counters.next_patient_number + 1
  returning next_patient_number - 1 into next_number;

  new.patient_number := to_char(next_number, 'FM000000');
  return new;
end;
$$;
