-- Phase 2: Patient Management module schema.
-- Extends patients + patient_clinical_info with the full registration
-- field set, adds instant multi-table search via a whitelisted-sort RPC,
-- and adds a partial unique index to enforce "no duplicate phone" at the
-- database level (not just in application code).

create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------------
-- patients: split full_name into first_name/last_name (kept as a generated
-- column for backward compatibility with anything still reading full_name),
-- plus the rest of the registration fields.
-- ---------------------------------------------------------------------------
alter table public.patients
  add column first_name text,
  add column last_name text;

update public.patients
  set first_name = coalesce(split_part(full_name, ' ', 1), ''),
      last_name = coalesce(nullif(substr(full_name, length(split_part(full_name, ' ', 1)) + 2), ''), '')
  where first_name is null;

alter table public.patients
  alter column first_name set not null,
  alter column last_name set not null,
  alter column first_name set default '',
  alter column last_name set default '';

alter table public.patients drop column full_name;

alter table public.patients
  add column full_name text generated always as (trim(both ' ' from first_name || ' ' || last_name)) stored;

alter table public.patients
  add column national_id text,
  add column occupation text,
  add column referral_source text,
  add column preferred_dentist_id uuid references public.staff_profiles (id) on delete set null,
  add column photo_path text,
  add column last_visit_at timestamptz,
  add column updated_by uuid references public.staff_profiles (id) on delete set null;

-- "archived" joins the existing active/inactive workflow states. Added here
-- (not used until a later transaction) since Postgres can't use a new enum
-- value in the same transaction that adds it.
alter type public.patient_status add value 'archived';

-- Enforce "no duplicate active patient per phone within a clinic" at the
-- database level — an application-level pre-check alone has a race window.
create unique index patients_clinic_phone_unique_idx
  on public.patients (clinic_id, phone)
  where phone is not null and deleted_at is null;

create index patients_preferred_dentist_id_idx on public.patients (preferred_dentist_id);
create index patients_status_idx on public.patients (status);
create index patients_gender_idx on public.patients (gender);
create index patients_last_visit_at_idx on public.patients (last_visit_at);
create index patients_name_trgm_idx on public.patients using gin ((first_name || ' ' || last_name) gin_trgm_ops);
create index patients_phone_trgm_idx on public.patients using gin (phone gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- patient_clinical_info: structured medical alert flags, alongside the
-- existing free-text medical_conditions/allergies/notes.
-- ---------------------------------------------------------------------------
alter table public.patient_clinical_info
  add column is_pregnant boolean not null default false,
  add column is_smoker boolean not null default false,
  add column has_hypertension boolean not null default false,
  add column has_diabetes boolean not null default false,
  add column has_heart_disease boolean not null default false,
  add column has_bleeding_disorder boolean not null default false,
  add column updated_by uuid references public.staff_profiles (id) on delete set null;

-- ---------------------------------------------------------------------------
-- search_patients: single indexed query backing the patient list — search
-- (name/phone/patient number/medical condition/notes), filters, whitelisted
-- sort, and pagination with a total count, all in one round trip.
-- SECURITY INVOKER (the default) so RLS on patients/patient_clinical_info
-- still applies per the calling user — no security regression.
-- ---------------------------------------------------------------------------
create or replace function public.search_patients(
  p_query text default null,
  p_gender text default null,
  p_status public.patient_status default null,
  p_doctor_id uuid default null,
  p_sort_by text default 'created_at',
  p_sort_dir text default 'desc',
  p_page int default 1,
  p_page_size int default 20
)
returns table (
  id uuid,
  clinic_id uuid,
  patient_number text,
  first_name text,
  last_name text,
  full_name text,
  date_of_birth date,
  gender text,
  phone text,
  email text,
  status public.patient_status,
  tags text[],
  preferred_dentist_id uuid,
  photo_path text,
  last_visit_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_sort_dir text;
  v_order_by text;
begin
  v_sort_dir := case lower(coalesce(p_sort_dir, 'desc'))
    when 'asc' then 'asc'
    else 'desc'
  end;

  -- Built from a hardcoded whitelist below, never from raw user input, so
  -- interpolating it into the query string via format(%s) is safe.
  v_order_by := case p_sort_by
    when 'name' then format('p.first_name %1$s, p.last_name %1$s', v_sort_dir)
    when 'last_visit_at' then format('p.last_visit_at %s nulls last', v_sort_dir)
    when 'status' then format('p.status %s', v_sort_dir)
    else format('p.created_at %s', v_sort_dir)
  end;

  return query execute format(
    $q$
      select p.id, p.clinic_id, p.patient_number, p.first_name, p.last_name,
             p.full_name, p.date_of_birth, p.gender, p.phone, p.email,
             p.status, p.tags, p.preferred_dentist_id, p.photo_path, p.last_visit_at,
             p.created_at, p.updated_at,
             count(*) over() as total_count
      from public.patients p
      left join public.patient_clinical_info ci on ci.patient_id = p.id
      where p.deleted_at is null
        and ($1 is null or (
          p.first_name ilike '%%' || $1 || '%%'
          or p.last_name ilike '%%' || $1 || '%%'
          or p.phone ilike '%%' || $1 || '%%'
          or p.patient_number ilike '%%' || $1 || '%%'
          or ci.notes ilike '%%' || $1 || '%%'
          or exists (
            select 1 from unnest(ci.medical_conditions) mc where mc ilike '%%' || $1 || '%%'
          )
        ))
        and ($2 is null or p.gender = $2)
        and ($3 is null or p.status = $3)
        and ($4 is null or p.preferred_dentist_id = $4)
      order by %s
      limit $5 offset $6
    $q$,
    v_order_by
  )
  using p_query, p_gender, p_status, p_doctor_id, p_page_size, greatest(p_page - 1, 0) * p_page_size;
end;
$$;

revoke all on function public.search_patients from public;
grant execute on function public.search_patients to authenticated;
