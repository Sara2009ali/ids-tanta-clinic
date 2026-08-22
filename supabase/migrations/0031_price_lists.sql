-- Price Lists foundation (commercial readiness batch).
--
-- visit_types.price (0022_procedures_catalog_pricing.sql) stays the single
-- "Normal" price for a procedure — nothing here duplicates it. A clinic's
-- other Price Lists (Insurance A, VIP, Staff, ...) only ever store the
-- procedures whose price actually differs from Normal, as rows in
-- price_list_items; any procedure a Price List doesn't mention simply falls
-- back to visit_types.price. That fallback is resolved by one pure function
-- (src/lib/pricing/resolve.ts), never re-implemented per call site.
--
-- The default ("Normal") Price List is a real, visible row in price_lists —
-- it shows up in the same picker as every other list — but it never gets
-- price_list_items of its own: resolveServicePrice() special-cases
-- "selected list is the clinic's default" to mean "use visit_types.price",
-- so there is exactly one place a clinic edits its Normal price (the
-- existing Procedures Catalog), not two that could drift apart.
--
-- Every clinic gets its "Normal" list auto-provisioned, same mechanism as
-- seed_clinic_appointment_defaults() (0001_phase1_foundation.sql): a trigger
-- for future clinics, a one-time backfill for existing ones.

-- ---------------------------------------------------------------------------
-- price_lists.
-- ---------------------------------------------------------------------------
create table public.price_lists (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_lists_clinic_name_unique unique (clinic_id, name)
);

create index price_lists_clinic_id_idx on public.price_lists (clinic_id);

-- At most one default Price List per clinic — the row resolveServicePrice()
-- treats as "no override, use visit_types.price".
create unique index price_lists_one_default_per_clinic_idx
  on public.price_lists (clinic_id) where is_default;

create trigger set_updated_at
  before update on public.price_lists
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- price_list_items: overrides only. A procedure with no row here, for a
-- given Price List, resolves to visit_types.price — see the module header.
-- on delete cascade for visit_type_id (unlike invoice_items' on delete set
-- null) is deliberate: this table is current pricing configuration, not a
-- historical financial record, so there's nothing worth preserving once the
-- procedure itself is gone.
-- ---------------------------------------------------------------------------
create table public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  price_list_id uuid not null references public.price_lists (id) on delete cascade,
  visit_type_id uuid not null references public.visit_types (id) on delete cascade,
  price numeric(10, 2) not null check (price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_list_items_list_visit_type_unique unique (price_list_id, visit_type_id)
);

create index price_list_items_clinic_id_idx on public.price_list_items (clinic_id);
create index price_list_items_price_list_id_idx on public.price_list_items (price_list_id);
create index price_list_items_visit_type_id_idx on public.price_list_items (visit_type_id);

create trigger set_updated_at
  before update on public.price_list_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-provision the default "Normal" Price List for every clinic, present
-- and future — same shape as seed_clinic_appointment_defaults(). A separate
-- trigger function (not folded into the existing one) since this is a
-- distinct concern seeded from a distinct migration.
-- ---------------------------------------------------------------------------
create or replace function public.seed_clinic_default_price_list()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.price_lists (clinic_id, name, is_default) values
    (new.id, 'Normal', true)
  on conflict (clinic_id, name) do nothing;

  return new;
end;
$$;

create trigger seed_clinic_default_price_list
  after insert on public.clinics
  for each row execute function public.seed_clinic_default_price_list();

-- Backfill for clinics that already exist.
insert into public.price_lists (clinic_id, name, is_default)
select c.id, 'Normal', true
from public.clinics c
on conflict (clinic_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- patients.price_list_id: the pricing context a patient resolves services
-- against. Nullable — null means "use the clinic's default Price List",
-- exactly like an unset override in price_list_items falls back to
-- visit_types.price. No per-visit override column: Phase 4 of the batch
-- directive is explicit that this is the smallest model that supports real
-- clinic workflows without requiring a future rewrite, and a per-visit
-- override isn't needed by anything built in this batch.
-- ---------------------------------------------------------------------------
alter table public.patients
  add column price_list_id uuid references public.price_lists (id) on delete set null;

create index patients_price_list_id_idx on public.patients (price_list_id);

-- ---------------------------------------------------------------------------
-- RLS. Mirrors visit_types exactly (0008_appointments.sql): reads open to
-- any clinic staff, writes admin-only — Price Lists are clinic-configuration
-- catalog data, the same category as the Procedures Catalog they price.
-- ---------------------------------------------------------------------------
alter table public.price_lists enable row level security;
alter table public.price_list_items enable row level security;

create policy "clinic staff can view price lists"
  on public.price_lists for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "admins can manage price lists"
  on public.price_lists for all
  to authenticated
  using (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  )
  with check (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  );

create policy "clinic staff can view price list items"
  on public.price_list_items for select
  to authenticated
  using (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin');

create policy "admins can manage price list items"
  on public.price_list_items for all
  to authenticated
  using (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  )
  with check (
    (select private.current_staff_role()) = 'super_admin'
    or (clinic_id = (select private.current_clinic_id()) and (select private.current_staff_role()) = 'admin')
  );
