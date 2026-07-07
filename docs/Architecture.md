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
      appointments|recalls|reports|settings/   # <ComingSoon/> placeholders
  components/
    ui/        # shadcn primitives
    layout/    # Sidebar, Topbar, UserMenu, ComingSoon
    patients/  # list/form/profile UI + shared bits (status badge, doctor select, file upload)
    auth/      # login form
  lib/
    env.ts     # Zod-validated NEXT_PUBLIC_* environment variables (see Security.md)
    supabase/  # browser/server/proxy client factories
    auth/      # legacy staff DAL (getCurrentStaff, requireStaff, requireRole)
    authz/     # RBAC: permissions.ts (pure helpers), session.ts (I/O, cached per-request)
    patients/  # schema (zod), queries, server actions, storage helpers, utils
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
  Phase-2.1.md       # changelog for this hardening phase
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
