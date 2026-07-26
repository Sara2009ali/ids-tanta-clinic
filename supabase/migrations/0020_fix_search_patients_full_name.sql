-- Fix: global patient search (search_patients RPC, used by the topbar
-- QuickPatientSearch on every page including the Dashboard) returned zero
-- rows when searching by a patient's full name.
--
-- Root cause: the name-matching predicate only checked p.first_name ILIKE
-- and p.last_name ILIKE independently. A two-word query like "sara
-- elghamry" (or an Arabic equivalent) never matches either column alone,
-- since the words are split across first_name/last_name — even though that
-- exact string is what's displayed everywhere in the UI (patients list,
-- patient header) as full_name. Single-word queries and phone search were
-- unaffected, which is why this wasn't caught earlier.
--
-- Fix: also match against p.full_name (the existing generated column),
-- alongside the existing first_name/last_name checks.
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
          or p.full_name ilike '%%' || $1 || '%%'
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
