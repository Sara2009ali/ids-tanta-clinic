-- Inventory & Stock Management, Phase 2. Per the approved architecture:
-- six new, self-contained tables, zero changes to any existing table.
-- Every table shape mirrors an already-proven pattern in this schema:
--   inventory_categories/inventory_suppliers    -> visit_types/chairs (clinic-scoped catalog, is_active)
--   inventory_products                          -> visit_types, extended
--   purchase_orders/purchase_order_items        -> invoices/invoice_items (header + lines)
--   inventory_movements                         -> doctor_earnings (signed, append-only ledger,
--                                                   a type discriminator, a generic reference pair
--                                                   mirroring audit_log.entity_type/entity_id)
--
-- Two new permission keys (inventory.view, inventory.manage), granted the
-- same way compensation.view/compensation.manage were in 0014: admin and
-- accountant get manage; dentist/dental_assistant/reception_manager/viewer
-- get view only. Consumption movements are the one exception — gated on
-- clinical.edit instead of inventory.manage, since logging what was used
-- during a treatment is a clinical action performed by the doctor who
-- already holds that key, not an inventory-management action. No third
-- inventory-specific key was introduced for this.

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
insert into public.permissions (key, label) values
  ('inventory.view', 'View inventory'),
  ('inventory.manage', 'Manage inventory, purchasing, and stock adjustments')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'admin' and p.key in ('inventory.view', 'inventory.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key = 'accountant' and p.key in ('inventory.view', 'inventory.manage')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.key in ('dentist', 'dental_assistant', 'reception_manager', 'viewer') and p.key = 'inventory.view'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- inventory_categories
-- ---------------------------------------------------------------------------
create table public.inventory_categories (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_categories_clinic_name_unique unique (clinic_id, name)
);

create index inventory_categories_clinic_id_idx on public.inventory_categories (clinic_id);

create trigger set_updated_at
  before update on public.inventory_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- inventory_suppliers
-- ---------------------------------------------------------------------------
create table public.inventory_suppliers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_suppliers_clinic_name_unique unique (clinic_id, name)
);

create index inventory_suppliers_clinic_id_idx on public.inventory_suppliers (clinic_id);

create trigger set_updated_at
  before update on public.inventory_suppliers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- inventory_products. unit is text + check (same convention as
-- payments.method, 0011) rather than a table — units of measure don't need
-- per-clinic customization the way categories/suppliers do.
-- ---------------------------------------------------------------------------
create table public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  category_id uuid references public.inventory_categories (id) on delete restrict,
  default_supplier_id uuid references public.inventory_suppliers (id) on delete set null,
  name text not null,
  sku text,
  unit text not null default 'piece' check (unit in ('piece', 'box', 'pack', 'ml', 'l', 'g', 'kg')),
  reorder_threshold numeric(10, 2) not null default 0 check (reorder_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_products_clinic_name_unique unique (clinic_id, name)
);

create index inventory_products_clinic_id_idx on public.inventory_products (clinic_id);
create index inventory_products_category_id_idx on public.inventory_products (category_id);

create trigger set_updated_at
  before update on public.inventory_products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- purchase_orders: mirrors invoices' shape exactly (status text + check,
-- header fields, created_by).
-- ---------------------------------------------------------------------------
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  supplier_id uuid not null references public.inventory_suppliers (id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'partially_received', 'received', 'cancelled')),
  reference_number text,
  order_date date not null default current_date,
  received_date date,
  notes text,
  created_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_orders_clinic_id_idx on public.purchase_orders (clinic_id);
create index purchase_orders_supplier_id_idx on public.purchase_orders (supplier_id);
create index purchase_orders_status_idx on public.purchase_orders (status);

create trigger set_updated_at
  before update on public.purchase_orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- purchase_order_items: mirrors invoice_items. Also serves as the "batch"
-- unit for expiration tracking — a PO line IS the received lot, so no
-- separate batch table exists (per the approved architecture).
-- ---------------------------------------------------------------------------
create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id uuid not null references public.inventory_products (id) on delete restrict,
  quantity_ordered numeric(10, 2) not null check (quantity_ordered > 0),
  quantity_received numeric(10, 2) not null default 0 check (quantity_received >= 0),
  unit_cost numeric(10, 2) not null default 0 check (unit_cost >= 0),
  expiration_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_order_items_clinic_id_idx on public.purchase_order_items (clinic_id);
create index purchase_order_items_purchase_order_id_idx on public.purchase_order_items (purchase_order_id);
create index purchase_order_items_product_id_idx on public.purchase_order_items (product_id);

create trigger set_updated_at
  before update on public.purchase_order_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- inventory_movements: the ledger. Insert-only — no update/delete policy
-- for authenticated (see RLS below), same "never mutate, always add"
-- shape doctor_earnings already established. Current stock is always
-- sum(quantity) for a product, never a stored running total, for the same
-- reason doctor_earnings.amount is summed rather than cached. The sign
-- constraint below encodes exactly what the approved lifecycle design
-- specifies (receive is always a gain, consumption/expiration are always a
-- loss, adjustment can go either way) as a database fact, not just an
-- application convention.
-- ---------------------------------------------------------------------------
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  product_id uuid not null references public.inventory_products (id) on delete restrict,
  purchase_order_item_id uuid references public.purchase_order_items (id) on delete restrict,
  movement_type text not null check (movement_type in ('receive', 'consumption', 'adjustment', 'expiration')),
  quantity numeric(10, 2) not null check (quantity <> 0),
  reference_type text,
  reference_id uuid,
  notes text,
  created_by uuid references public.staff_profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventory_movements_sign_matches_type check (
    (movement_type = 'receive' and quantity > 0)
    or (movement_type in ('consumption', 'expiration') and quantity < 0)
    or (movement_type = 'adjustment')
  )
);

create index inventory_movements_clinic_id_idx on public.inventory_movements (clinic_id);
create index inventory_movements_product_id_idx on public.inventory_movements (product_id);
create index inventory_movements_purchase_order_item_id_idx on public.inventory_movements (purchase_order_item_id);

-- ---------------------------------------------------------------------------
-- RLS. Every policy is the same clinic-tenancy + permission-key shape
-- compensation_rules/doctor_earnings already established (has_permission(),
-- not the legacy current_staff_role() check visit_types/chairs use — those
-- predate the RBAC system; these are new tables with no legacy shape to
-- preserve, so they use the current, more granular pattern directly).
-- ---------------------------------------------------------------------------
alter table public.inventory_categories enable row level security;
alter table public.inventory_suppliers enable row level security;
alter table public.inventory_products enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy "inventory staff can view categories"
  on public.inventory_categories for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.view'))
  );

create policy "inventory managers can write categories"
  on public.inventory_categories for all
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.manage'))
  )
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.manage'))
  );

create policy "inventory staff can view suppliers"
  on public.inventory_suppliers for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.view'))
  );

create policy "inventory managers can write suppliers"
  on public.inventory_suppliers for all
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.manage'))
  )
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.manage'))
  );

create policy "inventory staff can view products"
  on public.inventory_products for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.view'))
  );

create policy "inventory managers can write products"
  on public.inventory_products for all
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.manage'))
  )
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.manage'))
  );

create policy "inventory staff can view purchase orders"
  on public.purchase_orders for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.view'))
  );

create policy "inventory managers can write purchase orders"
  on public.purchase_orders for all
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.manage'))
  )
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.manage'))
  );

create policy "inventory staff can view purchase order items"
  on public.purchase_order_items for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.view'))
  );

create policy "inventory managers can write purchase order items"
  on public.purchase_order_items for all
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.manage'))
  )
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.manage'))
  );

create policy "inventory staff can view movements"
  on public.inventory_movements for select
  to authenticated
  using (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (select private.has_permission('inventory.view'))
  );

-- The one split policy: consumption movements need clinical.edit (the
-- doctor logging what was used), every other movement_type needs
-- inventory.manage — see this file's header comment.
create policy "clinical or inventory staff can create movements"
  on public.inventory_movements for insert
  to authenticated
  with check (
    (clinic_id = (select private.current_clinic_id()) or (select private.current_staff_role()) = 'super_admin')
    and (
      (movement_type = 'consumption' and (select private.has_permission('clinical.edit')))
      or (movement_type <> 'consumption' and (select private.has_permission('inventory.manage')))
    )
  );
