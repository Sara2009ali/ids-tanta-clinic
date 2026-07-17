# Database

This is a full schema reference for the Supabase Postgres database: every table, its columns,
constraints, indexes, and the reasoning behind non-obvious design choices. For the multi-tenant
model and how RLS fits into the wider architecture, see [Architecture.md](./Architecture.md). For
the role/permission model referenced throughout this document's RLS policies, see
[RBAC.md](./RBAC.md) and [Permissions.md](./Permissions.md).

Migrations live in `supabase/migrations/`, applied in filename order:

| Migration | Adds |
| --- | --- |
| `0001_phase1_foundation.sql` | `clinics`, `staff_profiles`, `patients` (base), `patient_clinical_info`, `patient_medical_alerts`, `patient_files`, `audit_log`, `clinic_counters`, storage bucket + policies |
| `0002_patient_number_insert_default.sql` | Insert-default fix for `patients.patient_number` |
| `0003_patient_management.sql` | Patient registration field set, `search_patients()` RPC, trigram search indexes |
| `0004_clinic_counters_rls_fix.sql` | `SECURITY DEFINER` fix for `assign_patient_number()` |
| `0005_rbac.sql` / `0006_revert_rbac.sql` / `0007_reapply_rbac.sql` | `roles`, `permissions`, `role_permissions`, `staff_profiles.role_id`, permission-gated RLS (see history note below) |
| `0008_appointments.sql` | `appointment_status`, `visit_types`, `chairs`, `appointments`, `appointment_status_history` |
| `0010_doctor_schedules.sql` | `doctor_weekly_hours`, `doctor_vacations`, `doctor_schedule_exceptions` |
| `0011_billing.sql` | `invoices`, `invoice_items`, `payments`, invoice numbering, total-recalculation trigger |
| `0012_billing_payment_model.sql` | `payments.type` ('payment'/'refund'), refund-aware total recalculation |
| `0013_appointments_cancel_permission_fix.sql` | Aligns the `appointments` update RLS policy with the `appointments.cancel` app-layer check (see history note below) |

**History note on 0005–0007**: `0005_rbac.sql` was applied to the live project, then reverted in
full by `0006_revert_rbac.sql` after being pushed without the required review/authorization, then
reapplied — reviewed and approved — as `0007_reapply_rbac.sql`. The end state is identical to
`0005`; the revert/reapply pair exists only in the migration history as a record of that incident.
RBAC is live in production as of `0007`.

**Note on the `0009` gap**: there is no `0009` migration, on either the local filesystem or the
remote project (`supabase migration list` shows the same gap). The sequence intentionally skips
from `0008` to `0010` — no migration was ever authored or lost under that number.

## Multi-tenant model (summary)

Every clinic-owned table carries a `clinic_id` column, scoped by RLS policies that compare it
against `private.current_clinic_id()` (a `SECURITY DEFINER` SQL function reading the caller's
`staff_profiles.clinic_id`), with `super_admin` bypassing clinic scoping entirely. See
Architecture.md for the full explanation — this document assumes it and focuses on the schema
itself.

## `clinics`

The multi-tenant root. `id`, `name`, `slug` (unique), `timezone` (default `Africa/Cairo`), `phone`,
`address`, `logo_url`, `is_active`, `created_at`/`updated_at`. As of `0008`, an `after insert`
trigger (`seed_clinic_appointment_defaults`) auto-provisions default `visit_types` and `chairs`
rows for every new clinic — see below.

## `staff_profiles`

One row per authenticated user (`id` is a FK to `auth.users`, cascading on delete). `clinic_id`
(nullable — only `super_admin` may operate without a home clinic, enforced by
`staff_profiles_clinic_required_unless_super_admin`), `full_name`, the legacy `role` enum
(`staff_role`: `super_admin`/`admin`/`doctor`/`assistant`/`reception`/`accounting`), `phone`,
`avatar_url`, `is_active`, `deleted_at`, timestamps. `role_id` (added in `0005`/`0007`) is a
nullable FK to `roles`, auto-backfilled and kept in sync with the legacy `role` column by the
`sync_staff_role_id` trigger — see RBAC.md for the full legacy-role mapping and why both columns
are kept. Index: `(clinic_id)`.

## `roles`, `permissions`, `role_permissions`

The RBAC catalog: `roles` (`key`, `label`, `description`, `is_system`), `permissions` (`key`,
`label`, `description`), and the `role_permissions` many-to-many join. Deliberately data, not
enums or code, so a new role or permission is an `insert`, not a migration touching application
code. Readable by any authenticated staff member (needed to render permission-aware UI); not
writable through the API — catalog changes are migration-only. Full design rationale, the seeded
role/permission list, and the two SQL functions that read this catalog
(`public.current_permissions()`, `private.has_permission()`) are in [RBAC.md](./RBAC.md).

## `clinic_counters`

Internal bookkeeping only (never queried directly by application code): one row per clinic,
`next_patient_number`, incremented atomically by the `assign_patient_number()` trigger to produce
human-friendly, zero-padded, per-clinic sequential patient numbers. `SECURITY DEFINER` so it
works regardless of the calling user's RLS grants on this table (`0004`).

## `patients`

The core patient record. Notable columns beyond the obvious contact/demographic fields:

- `patient_number` — assigned by the `assign_patient_number` trigger from `clinic_counters`,
  unique per `(clinic_id, patient_number)`.
- `first_name`/`last_name` — the editable name fields; `full_name` is a `generated always as`
  stored column (`trim(first_name || ' ' || last_name)`) kept for backward compatibility with
  code that reads `full_name` directly (e.g. the appointments module's joined schedule queries).
- `gender` — `text` with a check constraint (`male`/`female`/`other`/`unspecified`), not a
  Postgres enum — the same "small fixed set, no cross-table reuse" reasoning `0008`'s comment
  applies to `appointments.priority`.
- `status` — `patient_status` enum (`active`/`inactive`/`archived`).
- `deleted_at` — soft-delete marker; `patients.delete` permission gates only this transition (see
  RBAC.md).
- `preferred_dentist_id` — FK to `staff_profiles`.
- Uniqueness: `patients_clinic_patient_number_unique` and a partial unique index
  `patients_clinic_phone_unique_idx` on `(clinic_id, phone) where phone is not null and deleted_at
  is null` — "no duplicate active phone number per clinic" enforced at the database level, not
  just checked in application code.
- Search: `search_patients()` (`0003`) is a single indexed RPC backing the patient list —
  search/filter/sort/pagination with a total count in one round trip, `SECURITY INVOKER` so RLS
  still applies per caller. Trigram GIN indexes back the `ilike` search
  (`patients_name_trgm_idx`, `patients_phone_trgm_idx`).

## `patient_clinical_info`, `patient_medical_alerts`, `patient_files`, `audit_log`

Covered in full in the Phase 1/2 migrations; brief summary here since this document's focus is
`0008`:

- **`patient_clinical_info`** — 1:1 with `patients` (`patient_id` is the primary key). Free-text
  fields (`medical_conditions`/`allergies`/`current_medications` arrays, `dental_history`,
  `chief_complaint`, `notes`) plus structured boolean alert flags added in `0003`
  (`is_pregnant`, `is_smoker`, `has_hypertension`, `has_diabetes`, `has_heart_disease`,
  `has_bleeding_disorder`).
- **`patient_medical_alerts`** — one row per flagged alert (`label`, `severity` enum
  `info`/`warning`/`critical`). Still on its original single clinic-tenancy-only RLS policy — no
  write path exists yet, so it wasn't included in the `0005`/`0007` permission-gating pass (see
  Security.md).
- **`patient_files`** — one row per uploaded file (`file_type` enum, `storage_path`,
  `uploaded_by`, `description`). Storage objects live at `{clinic_id}/{patient_id}/{filename}` in
  the `patient-files` bucket so storage RLS can scope by clinic without a join back to this table.
- **`audit_log`** — generic append-only activity trail (`action`, `entity_type`, `entity_id`,
  `changes` jsonb). Written via `src/lib/audit/log.ts`'s `writeAuditLog()` helper, used by both the
  patients and appointments Server Actions; failures are logged but never thrown, so an audit-log
  outage never blocks the underlying mutation.

## Appointments module (`0008_appointments.sql`)

Introduced in Phase 3A. See [Phase-3A.md](./Phase-3A.md) for the changelog context; this section
is the detailed schema reference.

### `appointment_status` (enum)

Eight values, shared by `appointments.status` and `appointment_status_history.to_status`/
`from_status`: `scheduled`, `confirmed`, `checked_in`, `waiting`, `in_treatment`, `completed`,
`cancelled`, `no_show`.

### `visit_types`

Clinic-scoped lookup table, not an enum — deliberately, so a clinic's visit catalog (its own
service names, durations, and colors) can grow or change without a schema migration. Columns:
`id`, `clinic_id`, `name`, `default_duration_minutes` (check `> 0`, default 30), `color` (default
`#6366f1`), `is_active`, timestamps. Unique on `(clinic_id, name)`. Index on `(clinic_id)`.

Every clinic gets six defaults, seeded automatically:

| Name | Default duration | Color |
| --- | --- | --- |
| Consultation | 30 min | `#6366f1` |
| Cleaning | 30 min | `#22c55e` |
| Filling | 45 min | `#f59e0b` |
| Root Canal | 60 min | `#ef4444` |
| Follow-up | 15 min | `#8b5cf6` |
| Emergency | 30 min | `#dc2626` |

The `seed_clinic_appointment_defaults()` trigger (`after insert on clinics`) inserts these (and two
default chairs — see below) for every clinic created from now on, so the booking screen always has
something to select from without a manual setup step. A one-time backfill statement in the same
migration inserted the same defaults for every clinic that existed before `0008` landed (the
trigger only fires on future inserts). Both the trigger and the backfill use
`on conflict (clinic_id, name) do nothing`, so re-running is safe.

### `chairs`

Clinic-scoped, minimal by design in this phase — assignment and conflict-prevention only, no
schedule/working-hours concept attached (that's Phase 3B's Chair Management). Columns: `id`,
`clinic_id`, `label`, `is_active`, timestamps. Unique on `(clinic_id, label)`. Index on
`(clinic_id)`. Two defaults ("Chair 1", "Chair 2") are seeded per clinic the same way as
`visit_types`, via the same trigger and backfill.

### `appointments`

The core booking record.

| Column | Notes |
| --- | --- |
| `id` | uuid PK |
| `clinic_id` | FK to `clinics`, `on delete restrict` |
| `patient_id` | FK to `patients`, `on delete restrict` |
| `doctor_id` | FK to `staff_profiles`, `on delete restrict` |
| `chair_id` | FK to `chairs`, `on delete set null` — nullable, since an appointment can exist without a chair assignment yet |
| `visit_type_id` | FK to `visit_types`, `on delete restrict` |
| `scheduled_start` / `scheduled_end` | `timestamptz`; check constraint `appointments_end_after_start` (`scheduled_end > scheduled_start`) |
| `status` | `appointment_status`, default `scheduled` |
| `priority` | `text` with check constraint (`normal`/`high`/`urgent`), not an enum — same "small fixed set, no cross-table reuse" reasoning as `patients.gender` |
| `is_emergency` | `boolean`, default `false` |
| `chief_complaint`, `notes` | free text |
| `created_by` / `updated_by` | FK to `staff_profiles`, `on delete set null` |
| `deleted_at`, `created_at`, `updated_at` | full audit fields, same convention as `patients` |

Indexes: `(clinic_id)`, `(patient_id)`, `(doctor_id, scheduled_start)`, `(chair_id,
scheduled_start)`, `(status)`, `(scheduled_start)` — chosen to match the actual read patterns in
`src/lib/appointments/queries.ts`: per-clinic scans, a patient's appointment history, a doctor's or
chair's day (the composite indexes support both the schedule view and the conflict-check queries),
status-filtered dashboard counts, and date-range scans for "today's schedule."

`updated_at` is kept current by the shared `set_updated_at()` trigger (the same one every other
mutable table in the schema uses).

#### Double-booking prevention: exclusion constraints

Two `EXCLUDE USING gist` constraints are the real, database-level guarantee against double-booking
— everything at the application layer exists only to give a fast, friendly error *before* ever
reaching one of these:

```sql
alter table public.appointments
  add constraint appointments_doctor_no_overlap
  exclude using gist (
    doctor_id with =,
    tstzrange(scheduled_start, scheduled_end) with &&
  ) where (status not in ('cancelled', 'no_show') and deleted_at is null);

alter table public.appointments
  add constraint appointments_chair_no_overlap
  exclude using gist (
    chair_id with =,
    tstzrange(scheduled_start, scheduled_end) with &&
  ) where (chair_id is not null and status not in ('cancelled', 'no_show') and deleted_at is null);
```

Each says: for a given `doctor_id` (or `chair_id`), no two rows may have overlapping
`[scheduled_start, scheduled_end)` ranges, unless one of them is cancelled/no-show/soft-deleted.
Both require the `btree_gist` extension (`create extension if not exists "btree_gist"`, at the top
of `0008`) so a plain-equality column (`doctor_id`/`chair_id`) can be combined with a
range-overlap operator (`&&` on `tstzrange`) in the same GiST index.

**Why both an application-level check and a database constraint exist**: any "check for a
conflict, then insert" sequence in application code has an inherent race window — two concurrent
requests can both pass the check before either has inserted. Only a database constraint, evaluated
atomically as part of the write itself, closes that window completely. The application-level check
in `src/lib/appointments/validation.ts`/`actions.ts` exists purely for UX: it's the difference
between a clear, immediate "this doctor already has an appointment at that time" message and a
raw Postgres error surfacing to the user in the rare case both checks are actually racing.

### `appointment_status_history`

Append-only log of every status transition. Columns: `id`, `appointment_id` (FK, cascades on
delete), `clinic_id`, `from_status` (nullable — null on the row logging initial creation),
`to_status`, `changed_by` (FK to `staff_profiles`), `note`, `created_at`. Indexes on
`(appointment_id)` and `(clinic_id)`.

**Why this table is populated exclusively by a trigger, never by application code**: the
`log_appointment_status_change()` function runs `after insert or update on appointments`, logging
a row on insert (`from_status: null → status`) and on any update where `new.status is distinct
from old.status`. Because no Server Action, RPC, or ad-hoc SQL statement writes to this table
directly — there is no insert/update/delete RLS policy on it at all, only `select` — the history
can never drift from the real `status` column, regardless of which code path (or future code path)
changes it. The trigger function is `SECURITY DEFINER`, the same pattern
`assign_patient_number()` uses to bypass RLS for its own internal bookkeeping.

### RLS

Mirrors the patients module's `0005`/`0007` shape exactly: `select` is open to any clinic staff
member (every seeded role has at least `appointments.view`); `insert` additionally requires
`private.has_permission('appointments.create')`, `update` requires
`private.has_permission('appointments.edit')` — both on top of the standard `clinic_id =
current_clinic_id() OR current_staff_role() = 'super_admin'` tenancy check. `visit_types` and
`chairs` follow the same `select`-open/`admin`-manages shape as other lookup tables. Both
`appointments.create`/`appointments.edit` permission keys already existed in the `permissions`
table before this migration — they were seeded in `0005`/`0007` in anticipation of this module, so
`0008` adds zero rows to `permissions`/`role_permissions`.

### Deliberately out of scope for `0008`

No Billing or Clinical columns/tables were added speculatively. Those future modules are expected
to add their own tables referencing `appointments.id` by foreign key — nothing in this schema
needs to change to support that. See [Phase-3A.md](./Phase-3A.md) for the full list of what's
deferred to Phase 3B+.

## Doctor Schedules module (`0010_doctor_schedules.sql`)

Clinic-configuration data — a doctor's own recurring availability, vacations, and one-off
exceptions — kept deliberately separate from `appointments` itself.

- **`doctor_weekly_hours`** — recurring template. `doctor_id`, `day_of_week` (0–6),
  `start_minutes`/`end_minutes` (int, checked `0–1440` and `end > start`). Multiple rows per
  doctor/day are allowed (split shifts). A `gist` exclusion constraint
  (`doctor_weekly_hours_no_overlap`) prevents overlapping blocks for the same doctor/day — the
  same `btree_gist`-backed technique `0008`'s double-booking guards use.
- **`doctor_vacations`** — a date range (`start_date`/`end_date`, checked `end_date >=
  start_date`) plus an optional reason.
- **`doctor_schedule_exceptions`** — a single-date hour override plus a reason, for one-off
  changes that don't fit the weekly template or a vacation.

All three carry `clinic_id` and are indexed on `(doctor_id, ...)` to match how the booking flow
reads them (a doctor's day). RLS scopes `select` to any clinic staff member, same tenancy check as
every other table — but **writes are gated by `current_staff_role() = 'admin'` directly, not
`private.has_permission()`**, the same shape `0008` already uses for `chairs`/`visit_types`. This
is a deliberate second convention, not an oversight: doctor schedules, chairs, and visit types are
all treated as clinic-configuration data (an admin concern), distinct from clinical/financial
entities like `patients`/`appointments`/`invoices`, which are gated by the permission-key system
instead. Both conventions are intentional and both are in active use — there is no single
`has_permission()` rule covering every write in this schema.

## Billing module (`0011_billing.sql`, `0012_billing_payment_model.sql`)

- **`invoices`** — `patient_id`/`appointment_id` (nullable) FKs, a per-clinic sequential
  `invoice_number` (same `assign_invoice_number()`/`clinic_counters` mechanism as
  `patient_number`), `status` (`text + check`: `draft`/`unpaid`/`partially_paid`/`paid`/
  `cancelled`), and `subtotal`/`tax_percent`/`tax_amount`/`total`/`paid_amount`/`balance_due` —
  all five of the last group are **derived, not application-set**; see the trigger below.
- **`invoice_items`** — line items (`description`, `quantity`, `unit_price`, `discount_amount`,
  `line_total`). Only mutable while the parent invoice is `draft`, an application-layer rule (see
  `canEditInvoiceItems` in `src/lib/billing/calculations.ts`), not a DB constraint — the same
  "app-layer rule on top of a general-purpose table" shape appointments uses for "can't book in
  the past."
- **`payments`** — `amount` (checked `> 0` regardless of type — see below), `method` (`text +
  check`: `cash`/`visa`/`bank_transfer`/`wallet`/`other`), and `type` (`0012`: `text + check`,
  `'payment'`/`'refund'`, default `'payment'`) — a general transaction classification, not a
  refund-specific flag; a future category (e.g. `'adjustment'`) is a check-constraint widening,
  not a new column. Soft-deleted (`deleted_at`) rather than hard-deleted — "void" corrects a
  mistaken entry, while a `'refund'`-type row is its own real, auditable transaction, never a
  mutation of the original payment.
- **`recalculate_invoice_totals()`** — the single source of truth for every derived total on
  `invoices`. Runs via an `after insert or update or delete` trigger on both `invoice_items` and
  `payments` (`recalculate_invoice_totals_on_items`/`_on_payments`), so the totals can never drift
  regardless of which code path touched either table — the same guarantee
  `log_appointment_status_change()` provides for `appointment_status_history`. As of `0012`, the
  paid-amount sum nets refunds against payments
  (`sum(case when type = 'refund' then -amount else amount end)`); `status` is auto-derived from
  paid-vs-total except `'draft'`/`'cancelled'`, which are always set explicitly by the
  application.
- **RLS**: mirrors the appointments shape exactly — `select` requires `billing.view`, writes
  require `billing.edit`, both on top of the standard clinic-tenancy check. Unlike
  `chairs`/`visit_types`/doctor schedules, billing reads are **not** open to every clinic staff
  member — `billing.view`/`billing.edit` are deliberately not granted to every role (see
  [RBAC.md](./RBAC.md)).

## `0013_appointments_cancel_permission_fix.sql`

Closes a gap flagged by the Version 1 pre-production architecture review: `cancelAppointmentStatus`
(`src/lib/appointments/actions.ts`) gates cancellation on `appointments.cancel` at the application
layer, but the `0008`-era "authorized staff can update appointments" RLS policy only ever checked
`appointments.edit`, regardless of what the update changed. This migration adds a conditional
requirement to that policy's `with check` clause — a transition to `status = 'cancelled'`
additionally requires `appointments.cancel` — mirroring the exact technique the `patients` update
policy already uses for `patients.delete` (`deleted_at is null or has_permission('patients.delete')`).
Every seeded role holding `appointments.cancel` already holds `appointments.edit`
(`0007_reapply_rbac.sql`), so this changes no current behavior; it closes the gap for any future
role where that stops being true.
