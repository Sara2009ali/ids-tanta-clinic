-- patients.patient_number had no SQL-level default, even though
-- assign_patient_number() always fills it in via trigger. That made
-- Supabase's generated TypeScript types mark it as a required Insert
-- field, when callers should never supply it themselves. Giving the
-- column an empty-string default makes it optional in the generated
-- types, and the trigger is updated to treat '' the same as null.

alter table public.patients alter column patient_number set default '';

create or replace function public.assign_patient_number()
returns trigger
language plpgsql
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
