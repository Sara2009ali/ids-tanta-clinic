# Architecture

This document is a general orientation to the IDS Tanta codebase: the stack, the folder
structure, the multi-tenant data model, and the data-access patterns used throughout. For
authorization specifics, see [RBAC.md](./RBAC.md) and [Permissions.md](./Permissions.md). For
the security posture, see [Security.md](./Security.md).

## Stack

- **Next.js 16** (App Router, TypeScript) — the entire app is one Next.js project; there is no
  separate API server.
- **Supabase** (Postgres, Auth, Storage) — the system of record. Postgres row-level security
  (RLS) is the primary enforcement layer for multi-tenancy and, as of Phase 2.1, for
  permission-gated writes as well (see RBAC.md).
- **Tailwind CSS v4 + shadcn/ui** for styling and UI primitives.
- **Zod** for schema validation, both of form input (`src/lib/patients/schema.ts`) and of
  process environment variables (`src/lib/env.ts`).
- **Vitest** for unit tests (`npm run test` / `npm run test:watch`).

## Project structure

```
src/
  app/
    (auth)/login          # sign-in page, unauthenticated route group
    (app)/                # authenticated app shell (sidebar + topbar)
      dashboard/
      patients/
        page.tsx           # list: search, filters, sort, pagination
        new/                # registration form
        [id]/               # profile: overview/medical/dental/timeline/files/audit
        [id]/edit/           # edit form (shares <PatientForm> with new/)
      appointments/          # calendar, booking, chairs, doctor-schedule management
      reception/             # Reception Workspace: stat cards, today's schedule, quick actions
      billing/                # Billing V1: dashboard, invoice list/detail, payments/refunds
      recalls|reports|settings/   # <ComingSoon/> placeholders
  components/
    ui/        # shadcn primitives
    layout/    # Sidebar, Topbar, UserMenu, ComingSoon
    patients/  # list/form/profile UI + shared bits (status badge, doctor select, file upload)
    appointments/  # booking sheets, calendar views, chairs/doctor-schedule managers
    billing/   # invoice/payment forms, tables, status badges, audit history
    auth/      # login form
  lib/
    env.ts     # Zod-validated NEXT_PUBLIC_* environment variables (see Security.md)
    supabase/  # browser/server/proxy client factories
    auth/      # legacy staff DAL (getCurrentStaff, requireStaff, requireRole)
    authz/     # RBAC: permissions.ts (pure helpers), session.ts (I/O, cached per-request)
    patients/  # schema (zod), queries, server actions, storage helpers, utils
    appointments/  # validation.ts (pure rules), schema.ts, queries.ts, actions.ts, chair/doctor-schedule variants
    billing/   # calculations.ts (pure rules), schema.ts, queries.ts, actions.ts
    audit/     # audit log writer
  proxy.ts     # session refresh + route protection (Next 16's renamed middleware)
supabase/
  migrations/  # SQL schema + RLS + RPCs (search_patients, current_permissions, has_permission)
scripts/
  seed-auth-users.ts   # demo staff account seeding
docs/
  Architecture.md   # this file
  RBAC.md           # role/permission model, DB schema, RLS design
  Permissions.md    # permission key reference + application-layer usage patterns
  Security.md       # headers, env validation, what's in/out of scope
  Database.md       # full schema reference (all tables)
  Phase-2.1.md       # changelog for the hardening/RBAC phase
  Phase-3A.md        # changelog for the appointments foundation phase
```

This is an evolution of the structure documented in the project `README.md`; the additions in
Phase 2.1 are `src/lib/env.ts`, `src/lib/authz/`, and `docs/`.

## Multi-tenant data model

Every clinic-owned table (`patients`, `patient_clinical_info`, `patient_medical_alerts`,
`patient_files`, `audit_log`, and going forward any new module's tables) carries a `clinic_id`
column and is scoped by RLS policies that compare it against
`private.current_clinic_id()` — a `SECURITY DEFINER` SQL function defined in
`0001_phase1_foundation.sql` that looks up the calling user's `clinic_id` from
`staff_profiles`. `super_admin` is the one role that bypasses clinic scoping entirely (every
tenancy check in the schema is written as `clinic_id = current_clinic_id() OR
current_staff_role() = 'super_admin'`).

Storage objects follow the same convention: patient files live at
`{clinic_id}/{patient_id}/{filename}` in the `patient-files` bucket, so storage RLS can scope
access by clinic without a join back to `patient_files`.

This tenancy model is orthogonal to RBAC: tenancy answers "which rows belong to your clinic,"
role/permission checks answer "what are you allowed to do with rows in your clinic." Both are
enforced at the database layer (RLS) as the ultimate authority, with the application layer
providing the same checks earlier for a good UX (see RBAC.md's design-decision note on why both
layers matter).

## Data access pattern: Server Components + Server Actions

There is no client-side data-fetching library (no SWR/React Query/tRPC). All reads happen in
React Server Components via functions in each domain's `queries.ts` (e.g.
`src/lib/patients/queries.ts`), which call the Supabase server client
(`src/lib/supabase/server.ts`) directly. All writes happen in `"use server"` Server Actions
(e.g. `src/lib/patients/actions.ts`), invoked from Client Components via `useTransition` so the
UI can show a pending state, with `sonner` toasts for success/error feedback and
`revalidatePath()` to refresh server-rendered data after a mutation.

The general shape for a page that needs both data and permissions:

```ts
// Server Component
const [data, permissions] = await Promise.all([
  someQuery(),
  getCurrentPermissions(),
]);
```

`permissions` (a plain `string[]` of permission keys) is then threaded down as a prop to any
Client Component that needs to conditionally render UI — there is no client-side permissions
fetch; it is always computed once per request on the server and passed down.

## Session and identity

- `src/lib/auth/session.ts` — the original Phase 1 staff DAL: `getCurrentStaff()` (cached per
  request via React's `cache()`), `requireStaff()` (redirects to `/login` if unauthenticated),
  and `requireRole(roles)` (redirects unauthorized staff to `/dashboard`). This still backs
  `full_name`/`role` display (e.g. the topbar and `UserMenu`) and is unaffected by RBAC.
- `src/lib/authz/session.ts` — the Phase 2.1 permission layer sitting alongside it:
  `getCurrentPermissions()`, `requirePermission()`, `ensurePermission()`. See RBAC.md and
  Permissions.md for the full contract.
- `src/proxy.ts` (Next 16's renamed middleware) calls `updateSession()` from
  `src/lib/supabase/proxy.ts` on every request (except static assets) to keep the Supabase
  session cookie fresh and to redirect unauthenticated requests away from the authenticated app
  shell. Server Components/Actions still re-check `requireStaff()`/`requirePermission()`
  directly rather than trusting proxy alone.

## RBAC as a cross-cutting concern

As of Phase 2.1, authorization is a first-class concern threaded through the whole request
lifecycle rather than a patients-specific feature: permission keys are pre-registered for
modules that don't exist yet (appointments, clinical, billing, reports, settings), the
`getCurrentPermissions()`/`requirePermission()`/`ensurePermission()`/`hasPermission()` contract
is designed to be reused by every future module exactly as it's used by patients today, and RLS
enforces the same permission model at the database layer independent of the application code.
See [RBAC.md](./RBAC.md) for the full design and [Permissions.md](./Permissions.md) for the
permission key reference and usage patterns for future modules.

## Appointments (Phase 3A): the second module, same pattern

Phase 3A adds the Appointments module (`supabase/migrations/0008_appointments.sql`,
`src/lib/appointments/`). Architecturally it introduces nothing new — that's a deliberate
consistency point, not an oversight: Appointments is built as a second, independent proof that
the patterns established in Phase 1/2/2.1 generalize, rather than as a special case.

- **Multi-tenant model**: `appointments`, `appointment_status_history`, `visit_types`, and
  `chairs` all carry `clinic_id` and are scoped by the same
  `clinic_id = current_clinic_id() OR current_staff_role() = 'super_admin'` RLS shape as every
  other clinic-owned table.
- **RBAC**: reads are open to any clinic staff member; writes are gated by
  `appointments.create`/`appointments.edit` via `private.has_permission()` in RLS, and by
  `ensurePermission(PERMISSIONS.APPOINTMENTS_CREATE)`/`ensurePermission(PERMISSIONS.APPOINTMENTS_EDIT)`
  in `src/lib/appointments/actions.ts` — the exact same two-layer enforcement (application-layer
  check for UX, RLS as the ultimate authority) described above for patients. These permission
  keys were pre-registered in the Phase 2.1 RBAC migration specifically so this module could
  reuse the contract without a follow-up migration.
- **Server Components + Server Actions**: reads live in `src/lib/appointments/queries.ts` (called
  directly from Server Components, e.g. the Reception Dashboard), writes are `"use server"`
  actions in `src/lib/appointments/actions.ts` (`createAppointment`/`updateAppointment`),
  following the same `queries.ts`/`actions.ts` split as `src/lib/patients/`.
- **Validation**: `src/lib/appointments/schema.ts` mirrors `src/lib/patients/schema.ts`'s
  Zod-plus-FormData-parsing shape. `src/lib/appointments/validation.ts` adds a layer patients
  didn't need — pure, I/O-free business rules (working hours, overlap detection) shared between
  the server action and (eventually) client-side instant feedback — but it plugs into the same
  "application-layer check backstopped by a database constraint" idea already used for
  `patients_clinic_phone_unique_idx`: two exclusion constraints
  (`appointments_doctor_no_overlap`/`appointments_chair_no_overlap`) are the real
  double-booking guarantee, closing the race window that any "check then insert" application
  check inherently has. See [Database.md](./Database.md) for the schema detail.

One genuinely new piece of infrastructure appears here — the append-only
`appointment_status_history` table, populated exclusively by a database trigger rather than
application code, so it can never drift from the `appointments.status` column regardless of
which code path changes it. That's a schema-level technique specific to needing a tamper-proof
history of a mutable field, not a new architectural layer; the RLS/permission/Server-Component
pattern around it is unchanged.

See [Phase-3A.md](./Phase-3A.md) for the phase changelog and [Database.md](./Database.md) for
the full schema reference (all tables, not just this phase's).

## Billing (Billing Version 1): the third module, same pattern

Billing (`supabase/migrations/0011_billing.sql`, `0012_billing_payment_model.sql`,
`src/lib/billing/`) is a third independent instance of the same pattern described above for
Appointments: `clinic_id` + `current_clinic_id()` tenancy, `billing.view`/`billing.edit` gating
both RLS and `ensurePermission()`/`requirePermission()` calls (these permission keys were
pre-registered in `0005`/`0007`, the same "future modules inherit RBAC from day one" reasoning as
`appointments.*`), `queries.ts`/`actions.ts` split, and `writeAuditLog()` on every mutation. See
[Database.md](./Database.md) for the schema detail.

Two things are genuinely new, not just a third repetition of existing techniques:

- **A derived-totals trigger** (`recalculate_invoice_totals()`) that recomputes
  `subtotal`/`tax_amount`/`total`/`paid_amount`/`balance_due`/`status` on `invoices` any time
  `invoice_items` or `payments` changes, regardless of code path — the same tamper-proof-by-
  construction idea as `appointment_status_history`, applied to derived numeric state instead of
  an append-only log.
- **A transaction-classification column** (`payments.type`) designed explicitly for
  forward-compatible extension: today it's `'payment'`/`'refund'`, and a future category is a
  check-constraint widening plus a small addition to the recalculation trigger's `CASE` —
  never a new column or a schema redesign. This was a deliberate design decision (see the header
  comment in `0012_billing_payment_model.sql`), made after evaluating and rejecting encoding
  refunds as signed/negative amounts specifically because a sign error in any of the several
  `sum(amount)` call sites across the app would silently corrupt a financial total.

Billing deliberately does **not** compute or store anything about doctor compensation — it
exposes invoice/payment facts only (including `invoices.appointment_id`, which is the join point
a future Doctor Compensation module would use), keeping that future module a pure downstream
consumer rather than something Billing needs to be redesigned around.
