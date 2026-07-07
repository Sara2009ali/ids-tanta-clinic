# RBAC (Role-Based Access Control)

This document describes the role/permission model introduced in Phase 2.1: the database
schema (`supabase/migrations/0005_rbac.sql`), the RLS policy changes it makes, and the
application-layer helpers (`src/lib/authz/`) that consume it. For the permission key reference
and usage patterns for future modules, see [Permissions.md](./Permissions.md).

## Status: implemented, not yet deployed

**`supabase/migrations/0005_rbac.sql` has been authored and dry-run-validated against the live
linked Supabase project (`npx supabase db push --dry-run` confirmed it applies cleanly with no
conflicts), but has not been applied yet.** Applying schema/RLS changes to the live project
requires explicit user sign-off, which is pending as of this writing. Do not treat the RBAC
schema described below as live in production — it is implemented and ready to deploy, pending
a `npm run db:push` + `npm run db:types` step that requires explicit approval. See
[Phase-2.1.md](./Phase-2.1.md) for the current rollout status.

Because the migration isn't applied yet, the application code has a graceful fallback so that
nothing depends on the migration having landed — see "Legacy-role fallback" below.

## Roles

Roles are rows in a new `public.roles` table (`key`, `label`, `description`), **not** a
Postgres enum. This is a deliberate choice: adding a role later is a data insert, not a
code/schema migration. The eight seeded roles are:

| Key | Label |
| --- | --- |
| `super_admin` | Super Admin |
| `admin` | Admin |
| `dentist` | Dentist |
| `receptionist` | Receptionist |
| `reception_manager` | Reception Manager |
| `dental_assistant` | Dental Assistant |
| `accountant` | Accountant |
| `viewer` | Viewer |

## Permissions

`public.permissions` is seeded with the following keys, grouped by module:

| Module | Keys |
| --- | --- |
| Patients | `patients.view`, `patients.create`, `patients.edit`, `patients.delete` |
| Appointments | `appointments.view`, `appointments.create`, `appointments.edit`, `appointments.cancel` |
| Clinical | `clinical.view`, `clinical.edit` |
| Billing | `billing.view`, `billing.edit` |
| Reports | `reports.view` |
| Settings | `settings.manage` |

Appointments, clinical, billing, reports, and settings permission keys are registered now even
though those modules don't exist yet (they're all still `<ComingSoon/>` placeholders). This is
intentional: future phases inherit RBAC from day one instead of retrofitting a permission model
onto an already-shipped module.

## `role_permissions`: the role → permission mapping

`public.role_permissions` is the many-to-many join table mapping roles to permissions. The
`insert into role_permissions` statements in `0005_rbac.sql` encode the following rationale per
role:

| Role | Grants | Rationale |
| --- | --- | --- |
| `super_admin` | everything | Full access across all clinics and modules; also see the `current_permissions()` special case below, which grants super_admin every permission row automatically. |
| `admin` | everything | Clinic-level administrator; full access within their clinic. |
| `dentist` | `patients.view/create/edit`, full `appointments.*`, `clinical.*`, `reports.view` | Clinical work, scheduling, and patient record maintenance, but not `patients.delete` (deletion is a data-governance action, not a clinical one) or `settings.manage`/`billing.*`. |
| `receptionist` | `patients.view/create/edit`, full `appointments.*` | Front-desk patient intake and scheduling, but not `patients.delete` (no deletion authority) or `clinical.*` (no clinical access). |
| `reception_manager` | everything `receptionist` has, **plus** `patients.delete`, `billing.view`, `reports.view` | A supervising receptionist: same day-to-day front-desk permissions, plus the deletion authority and financial/reporting visibility a manager needs but a line receptionist doesn't. |
| `dental_assistant` | `patients.view/edit`, `appointments.view`, `clinical.view` | Supports clinical work with read access to the schedule and clinical record, and can update (but not create) patient records, without independent authority to create patients, touch billing, or delete records. |
| `accountant` | `billing.*`, `patients.view`, `reports.view` | Full financial access, read-only patient context (to attribute invoices/payments to the right patient), and reporting visibility, but no clinical or patient-editing access. |
| `viewer` | every `*.view` permission, and nothing else | Read-only access across every module — the "look but don't touch" role. |

Read the actual `insert into role_permissions` statements in `0005_rbac.sql` for the exact,
authoritative list per role; the table above documents the intended rationale.

## `patients.delete` vs `patients.edit`: the archive/restore/soft-delete mapping

This mapping is a deliberate design choice worth stating explicitly, since it isn't obvious
from the permission names alone:

- **`patients.delete`** gates only the soft-delete transition — `patients.deleted_at` going
  from `null` to a timestamp (i.e. the `deletePatient` action).
- **`patients.edit`** gates everything else on the `patients` row, **including archive and
  restore** — those actions only change `patients.status` (`active` ⇄ `archived`), not
  `deleted_at`.

No separate "archive" permission was requested for this phase, so archive/restore was folded
under `patients.edit` rather than introducing a ninth permission key. If a future phase needs
archive/restore to be independently controllable from general edit access, that would be a new
`patients.archive` permission key plus a corresponding RLS/application change — not a
reinterpretation of the existing keys.

## `staff_profiles.role_id`: backfill from the legacy `role` enum

`staff_profiles.role_id` is a new nullable FK to `roles` (`on delete set null`). It is
auto-backfilled from the legacy `role` enum (`public.staff_role`, defined in
`0001_phase1_foundation.sql`) using this mapping, implemented as
`private.role_key_for_legacy_role(p_role)` — an `immutable` SQL function:

| Legacy `staff_role` enum value | New `roles.key` |
| --- | --- |
| `doctor` | `dentist` |
| `assistant` | `dental_assistant` |
| `reception` | `receptionist` |
| `accounting` | `accountant` |
| `admin` | `admin` |
| `super_admin` | `super_admin` |

`private.role_key_for_legacy_role()` is used in two places: a one-time `update` statement in
the migration that backfills `role_id` for every existing `staff_profiles` row, and the
`sync_staff_role_id` trigger (`before insert or update of role, role_id`) that keeps new/updated
rows in sync going forward. The trigger only fills `role_id` in **when it's null** — so a future
role-management UI that sets `role_id` explicitly (e.g. assigning `reception_manager`, which has
no legacy equivalent) won't have its value clobbered back to the legacy mapping.

The legacy `role` enum column is kept, unmodified, for backward compatibility. Code that
displays or reads it directly — the user menu's role label (`STAFF_ROLE_LABELS` in
`src/types/domain.ts`, consumed by `src/components/layout/user-menu.tsx`), the
`"admins can manage staff in their clinic"` RLS policy from `0001_phase1_foundation.sql`, and
`scripts/seed-auth-users.ts` — keeps working with zero changes. Note that the legacy enum has
only six values and the new `roles` table has eight (`reception_manager` and `viewer` have no
legacy equivalent); those two roles are only reachable via `role_id`, not via the legacy `role`
column — there is no legacy `staff_role` value that maps to them, so a staff member must have
`role_id` set directly (there's no role-management UI yet, so today that's a manual/service-role
update).

`roles`, `permissions`, and `role_permissions` are all RLS-enabled and readable by any
authenticated staff member (needed to render permission-aware UI, and later a role-management
picker), but not writable through the API in this phase — there's no role-management UI yet, so
changes to the catalog or the mapping are migration-only/service-role-only.

## SQL functions

- **`public.current_permissions()`** — `SECURITY DEFINER`, `stable`, returns `setof text` (the
  calling user's full permission-key set). Implemented as a `union` of two selects: every
  `permissions.key` row when `private.current_staff_role() = 'super_admin'`, plus the normal
  join path (`staff_profiles.role_id` → `role_permissions` → `permissions`, filtered to
  `sp.id = auth.uid()`). Because it's a `union` against the whole `permissions` table for
  super_admin rather than a lookup through `role_permissions`, a future permission added to the
  `permissions` table is automatically available to super_admin without a second migration.
  Access is revoked from `public` and granted only to `authenticated`, and it's callable from
  the application directly via `supabase.rpc("current_permissions")`.
- **`private.has_permission(key)`** — `SECURITY DEFINER`, `stable`, boolean convenience wrapper
  (`exists (select 1 from current_permissions() perm where perm = p_key)`) used inside RLS
  policy `using`/`with check` expressions (`private` schema, following the same convention as
  `private.current_clinic_id()` / `private.current_staff_role()` from
  `0001_phase1_foundation.sql`).

## RLS changes

The original Phase 1 RLS design used one broad policy per table:
`"clinic staff can access their patients" for all` (and the equivalent policies on
`patient_clinical_info` and `patient_files`) — a single policy per table covering
select/insert/update/delete, gated only by clinic tenancy
(`clinic_id = current_clinic_id() OR current_staff_role() = 'super_admin'`).

`0005_rbac.sql` drops each of these broad policies and replaces them with separate
select/insert/update/delete policies:

- **Reads (`select`)** stay open to any clinic staff member — every role has at least the
  relevant `.view` permission, so splitting out `select` doesn't change who can read what; it's
  split out so the RLS structure is symmetric and so future roles that genuinely lack a `.view`
  permission are supported without redesigning the policies again.
- **Writes (`insert`/`update`/`delete`)** now also require a permission via
  `private.has_permission(key)`, on top of the existing clinic-tenancy check. The permission
  required per table/operation:

  | Table | Operation | Required permission |
  | --- | --- | --- |
  | `patients` | `insert` | `patients.create` |
  | `patients` | `update` | `patients.edit`, **and** `patients.delete` if the new row's `deleted_at` is being set to non-null |
  | `patients` | `delete` (hard delete) | `patients.delete` |
  | `patient_clinical_info` | `insert` / `update` | `patients.edit` |
  | `patient_files` | `insert` (upload) / `delete` (remove) | `patients.edit` |

  Note that `patient_clinical_info` and `patient_files` writes are gated by `patients.edit`,
  **not** a separate `clinical.edit` or file-specific permission — the migration's own comment
  explains this mirrors "the exact permission keys requested for Phase 2.1" rather than
  introducing new ones; `clinical.edit`/`clinical.view` are reserved for the future Clinical
  module (structured chart notes, treatment plans, etc.), not the medical/dental fields already
  on a patient's record today. Also note the `patients` table gets both an `update` policy
  (which is what the app actually uses for soft-delete, via `deletePatient` setting
  `deleted_at`) **and** a `delete` policy for a genuine SQL `DELETE` — the app doesn't issue
  hard deletes today, but the policy exists so one can't slip through ungated if a future code
  path ever does.

`patient_medical_alerts` is explicitly **not** part of this change — see
[Security.md](./Security.md) for why (no write path exists for that table yet, so its original
single `for all` clinic-tenancy-only policy is left in place).

## Application-layer helpers

### `src/lib/authz/permissions.ts` — pure, no I/O

- `PERMISSIONS` — a constant map of permission key names to their string values (e.g.
  `PERMISSIONS.PATIENTS_VIEW === "patients.view"`), used everywhere instead of hand-typed
  string literals.
- `hasPermission(granted, required)` — `required` may be a single key or an array (AND
  semantics: every key in the array must be present in `granted`).
- `hasAnyPermission(granted, required)` — OR semantics: true if `granted` contains at least one
  of the keys in `required`.

Being pure functions with no Supabase/React dependency, these are unit-testable in isolation —
see `src/lib/authz/permissions.test.ts`.

### `src/lib/authz/session.ts` — I/O, cached per request

- `getCurrentPermissions()` — resolves the current user's permission-key array. Cached per
  request (mirroring the `cache()` pattern `src/lib/auth/session.ts` uses for
  `getCurrentStaff()`), so multiple Server Components in the same request tree can call it
  without duplicating the round trip. Internally tries the `current_permissions()` RPC first;
  falls back to `LEGACY_ROLE_PERMISSIONS` if the RPC doesn't exist (see below).
- `requirePermission(permission)` — for page-level guards: requires sign-in first (redirects to
  `/login` via `requireStaff()`), then redirects to `/dashboard` (mirroring `requireRole()`'s
  behavior) when the current user lacks the given permission(s); returns the `StaffProfile` on
  success. Used at the top of a Server Component page, e.g.
  `await requirePermission(PERMISSIONS.PATIENTS_CREATE)` in
  `src/app/(app)/patients/new/page.tsx`.
- `ensurePermission(permission)` — for Server Action mutations: returns
  `{ ok: true, staff } | { ok: false, error }` instead of redirecting on a missing permission
  (it still requires sign-in first), so the action can return a normal
  `PatientActionState`-shaped error to the calling form instead of blowing away the in-progress
  mutation with a redirect.

## Legacy-role fallback: why the system is safe to deploy code-first, database-second

`getCurrentPermissions()` first tries the new `current_permissions()` RPC. If that RPC doesn't
exist yet — i.e. before `0005_rbac.sql` is applied — it falls back to a hardcoded mapping,
`LEGACY_ROLE_PERMISSIONS` in `src/lib/authz/session.ts`, computed from the legacy `staff_role`
enum. `LEGACY_ROLE_PERMISSIONS` is written to mirror the exact same role→permission assignments
the migration seeds into `role_permissions` (mapped through the same legacy-role → new-role
correspondence used by the `sync_staff_role_id` trigger).

This means authorization behaves identically before and after the migration is applied:

- **Before the migration lands**: `current_permissions()` doesn't exist in the database, the
  RPC call fails, and `getCurrentPermissions()` falls back to `LEGACY_ROLE_PERMISSIONS` — which
  computes the same permission set the migration would have, from the `role` enum column that
  already exists on every `staff_profiles` row.
- **After the migration lands**: the RPC exists, succeeds, and returns the same permission set
  from the real `role_permissions` join — now driven by `role_id` instead of the hardcoded
  mapping.

Nothing breaks in the interim, and the switch-over is automatic and silent once the migration
is applied — there is no code change required at cutover time. This is the reason application
code (permission-gated server actions, nav items, action menus) can be written and shipped now,
ahead of the database migration, without a window where authorization is either broken or
inconsistent.

## Usage pattern for future modules

When building a new module (appointments, clinical, billing, etc.), follow the same shape
patients already uses:

- **Page-level access** → `requirePermission(PERMISSIONS.X)` at the top of the Server Component
  page.
- **Server Action mutations** → `ensurePermission(PERMISSIONS.X)` at the top of the action,
  returning its `{ ok, error }` result (or a merged action-state shape) to the caller on
  failure.
- **Conditional UI** → compute `permissions` once via `getCurrentPermissions()` in a Server
  Component, pass it down as a `permissions: string[]` prop, and call
  `hasPermission(permissions, PERMISSIONS.X)` (or `hasAnyPermission`) in the Client Component
  that needs to conditionally render a button/menu item. This is exactly the pattern
  `src/components/layout/sidebar.tsx` uses for nav items and
  `src/app/(app)/patients/page.tsx` uses for the "Add Patient" button.
