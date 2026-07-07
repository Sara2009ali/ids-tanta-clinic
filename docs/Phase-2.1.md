# Phase 2.1 — Infrastructure Hardening & Authorization

This is a changelog-style summary of Phase 2.1. It follows Phase 1 (foundation) and Phase 2
(Patient Management) described in `README.md`. Phase 2.1 does not add a user-facing module —
it hardens the infrastructure and access-control model underneath the modules that already
exist, in preparation for Appointments, Clinical, Billing, and Reports being built on top of a
solid foundation instead of retrofitting one later.

## Why this phase happened

An architectural audit of the Phase 1/2 codebase surfaced a Critical-severity gap: **any
authenticated staff member, regardless of role, could delete or archive any patient record in
their clinic** — at the application layer (no server action checked the caller's role) and at
the database layer (the `patients` RLS policy checked only clinic tenancy, not role). A
receptionist, an assistant — anyone with a login — had the same destructive authority as an
admin. See [Security.md](./Security.md) for the full description of this finding.

Fixing that properly meant introducing a real role/permission model rather than a narrow
patch — one that could also serve every module still to come (Appointments, Clinical, Billing,
Reports, Settings) instead of being patients-specific. That's the RBAC system described in
[RBAC.md](./RBAC.md) and [Permissions.md](./Permissions.md).

Three workstreams were carried out in this phase, described below.

## 1. Environment validation and HTTP security headers

- `src/lib/env.ts` — centralized, Zod-validated `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, failing fast with a descriptive error at import time
  instead of three separate non-null-assertion call sites.
- `next.config.ts` — added `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, and a `Content-Security-Policy` to every route.

Full detail in [Security.md](./Security.md).

## 2. RBAC: roles, permissions, and RLS

- New tables: `public.roles`, `public.permissions`, `public.role_permissions` (migration
  `supabase/migrations/0005_rbac.sql`).
- `staff_profiles.role_id` — new nullable FK to `roles`, backfilled from the legacy `role`
  enum via a `sync_staff_role_id` trigger. The legacy `role` column is untouched, so existing
  code (the user menu's role label, `scripts/seed-auth-users.ts`) needs no changes.
- Two SQL functions: `public.current_permissions()` and `private.has_permission(key)`.
- `patients`/`patient_clinical_info`/`patient_files` RLS: the old single `for all` policy per
  table is split into select/insert/update/delete, with writes additionally gated by
  `private.has_permission(key)`.
- Application layer: `src/lib/authz/permissions.ts` (pure helpers — `PERMISSIONS`,
  `hasPermission`, `hasAnyPermission`) and `src/lib/authz/session.ts` (I/O —
  `getCurrentPermissions`, `requirePermission`, `ensurePermission`), plus the legacy-role
  fallback (`LEGACY_ROLE_PERMISSIONS`) that makes the whole system safe to ship ahead of the
  database migration.

Full detail in [RBAC.md](./RBAC.md) and [Permissions.md](./Permissions.md).

## 3. Testing foundation

A Vitest setup was added for pure-logic unit tests: `vitest.config.ts` (Node environment, `@/*`
path alias matching `tsconfig.json`), and `npm run test` / `npm run test:watch` scripts in
`package.json`. Test files exist alongside the modules they cover (e.g.
`src/lib/patients/schema.test.ts`, `src/lib/patients/utils.test.ts`,
`src/components/patients/patients-filters.test.ts`, `src/lib/authz/permissions.test.ts`).

## Current status

**Pending explicit approval:** `supabase/migrations/0005_rbac.sql` has been authored and
dry-run-validated (`npx supabase db push --dry-run` applies cleanly, no conflicts) but has
**not** been pushed to the live Supabase project. Running it requires:

```bash
npm run db:push    # applies 0005_rbac.sql (and any other pending migrations)
npm run db:types    # regenerates src/types/database.generated.ts against the new schema
```

Both steps require explicit user sign-off before they're run against the live project — this
is a deliberate gate, not an oversight. Until that happens, `getCurrentPermissions()` runs
entirely on the `LEGACY_ROLE_PERMISSIONS` fallback path described in RBAC.md; behavior is
identical either way, so there's no rush to push purely for correctness reasons.

**Application-layer wiring: complete.** As of the final check made while writing this
documentation, all of the following are in place:

- `src/lib/authz/permissions.ts` (`PERMISSIONS`, `ROLE_LABELS`, `hasPermission`,
  `hasAnyPermission`) and `src/lib/authz/session.ts` (`getCurrentPermissions`,
  `requirePermission`, `ensurePermission`, `LEGACY_ROLE_PERMISSIONS`) both exist and implement
  the contract described in RBAC.md and Permissions.md.
- Every exported action in `src/lib/patients/actions.ts` calls `ensurePermission()` first:
  `createPatient` → `PATIENTS_CREATE`; `updatePatient`, `archivePatient`/`restorePatient` (via
  the shared `setPatientStatus` helper), `recordPatientFile`, and `deletePatientFile` →
  `PATIENTS_EDIT`; `deletePatient` → `PATIENTS_DELETE`.
- Page-level guards (`requirePermission`) are in `src/app/(app)/patients/new/page.tsx` and
  `src/app/(app)/patients/[id]/edit/page.tsx`; `getCurrentPermissions()` feeds conditional UI in
  `src/app/(app)/layout.tsx` (sidebar), `src/app/(app)/patients/page.tsx` (Add Patient button,
  patients table), and `src/app/(app)/patients/[id]/page.tsx` (header action menu).

So the only remaining step for this phase is the `db:push`/`db:types` approval above — the RLS
enforcement described in RBAC.md isn't live until then, but the application layer already
enforces the same rules today via the legacy-role fallback, so there is no window where the
Critical finding from "Why this phase happened" is unmitigated.

## Deliberately deferred to later phases

- **Rate limiting / lockout on login** — not addressed this phase; see Security.md.
- **Centralized error/monitoring service** — errors are still `console.error`-only.
- **`patient_medical_alerts` write policies** — left on the original clinic-tenancy-only
  policy, since no write path exists for that table yet.
- **A dedicated "archive" permission** — archive/restore remains folded under `patients.edit`
  (see RBAC.md); revisit only if a future requirement needs it split out.
- **Appointments, Clinical, Billing, Reports, Settings modules themselves** — this phase only
  reserves their permission keys; the modules remain `<ComingSoon/>` placeholders.
