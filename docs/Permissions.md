# Permissions reference

This is the practical reference for working with permissions day-to-day: the full key list,
the application-layer API, and the exact pattern to follow when wiring a new page, Server
Action, or piece of conditional UI. For the underlying role/permission database design and the
legacy-role fallback mechanism, see [RBAC.md](./RBAC.md).

## Permission keys

All keys live in `public.permissions` (seeded by `supabase/migrations/0005_rbac.sql`) and are
exposed as named constants on `PERMISSIONS` in `src/lib/authz/permissions.ts`. Always reference
`PERMISSIONS.X`, never a hand-typed string literal — the constant is the single source of truth
for the key spelling.

| `PERMISSIONS` constant | Key | Module |
| --- | --- | --- |
| `PATIENTS_VIEW` | `patients.view` | Patients |
| `PATIENTS_CREATE` | `patients.create` | Patients |
| `PATIENTS_EDIT` | `patients.edit` | Patients (also gates archive/restore — see RBAC.md) |
| `PATIENTS_DELETE` | `patients.delete` | Patients (soft-delete only — see RBAC.md) |
| `APPOINTMENTS_VIEW` | `appointments.view` | Appointments (module not yet built) |
| `APPOINTMENTS_CREATE` | `appointments.create` | Appointments (module not yet built) |
| `APPOINTMENTS_EDIT` | `appointments.edit` | Appointments (module not yet built) |
| `APPOINTMENTS_CANCEL` | `appointments.cancel` | Appointments (module not yet built) |
| `CLINICAL_VIEW` | `clinical.view` | Clinical (module not yet built) |
| `CLINICAL_EDIT` | `clinical.edit` | Clinical (module not yet built) |
| `BILLING_VIEW` | `billing.view` | Billing (module not yet built) |
| `BILLING_EDIT` | `billing.edit` | Billing (module not yet built) |
| `REPORTS_VIEW` | `reports.view` | Reports (module not yet built) |
| `SETTINGS_MANAGE` | `settings.manage` | Settings (module not yet built) |

Naming convention: `<module>.<action>`, lowercase, dot-separated. When a future module needs a
new permission, add the row to the `permissions` table in a migration, add a `role_permissions`
row for every role that should have it, add the `PERMISSIONS` constant, and (if applicable) add
it to `LEGACY_ROLE_PERMISSIONS` in `src/lib/authz/session.ts` so the pre-migration fallback
stays in sync — see RBAC.md's "Legacy-role fallback" section for why that mapping must be kept
accurate.

## API surface

### `src/lib/authz/permissions.ts` (pure — safe to import anywhere, including tests)

- `PERMISSIONS` — the key constants above.
- `hasPermission(granted: string[], required: Permission | Permission[]): boolean` — AND
  semantics when `required` is an array (every key must be present).
- `hasAnyPermission(granted: string[], required: Permission | Permission[]): boolean` — OR
  semantics (at least one key must be present).

### `src/lib/authz/session.ts` (I/O — Server Components/Actions only)

- `getCurrentPermissions(): Promise<string[]>` — the current user's full permission-key set,
  cached per request.
- `requirePermission(permission: Permission | Permission[]): Promise<StaffProfile>` —
  page-level guard. Requires sign-in first (redirects to `/login`, via `requireStaff()`), then
  redirects to `/dashboard` if the current user lacks the permission(s); returns the
  `StaffProfile` on success. This is the permission-driven successor to `requireRole()` in
  `@/lib/auth/session` — prefer it for anything new.
- `ensurePermission(permission: Permission | Permission[]): Promise<EnsurePermissionResult>` —
  Server Action guard, where `EnsurePermissionResult` is
  `{ ok: true; staff: StaffProfile } | { ok: false; error: string }`. Also requires sign-in
  first, but never redirects on a missing permission — it returns `{ ok: false, error }` so the
  caller can surface it the same way as any other action failure.

## Usage patterns

Follow the pattern already established by the Patients module for every new feature:

**1. Page-level access — `requirePermission`**

```ts
// src/app/(app)/patients/new/page.tsx
import { requirePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";

export default async function NewPatientPage() {
  await requirePermission(PERMISSIONS.PATIENTS_CREATE);
  // ...rest of the page
}
```

Use this at the top of any Server Component page whose entire content should be inaccessible
without a given permission — it redirects before rendering anything.

**2. Server Action mutations — `ensurePermission`**

```ts
"use server";
import { ensurePermission } from "@/lib/authz/session";
import { PERMISSIONS } from "@/lib/authz/permissions";

export async function createPatient(formData: FormData) {
  const check = await ensurePermission(PERMISSIONS.PATIENTS_CREATE);
  if (!check.ok) return { error: check.error };
  const staff = check.staff;
  // ...rest of the action
}
```

Use this inside every mutating Server Action. Unlike `requirePermission`, it never redirects —
a Server Action is invoked via `useTransition` from a Client Component, so the caller needs a
normal return value it can show as a form/toast error, not a navigation.

**3. Conditional UI — `hasPermission` with a `permissions` prop**

```tsx
// Server Component: compute once, pass down
const permissions = await getCurrentPermissions();
return <PatientsTable rows={rows} permissions={permissions} />;

// Client Component: read from the prop, never fetch permissions itself
function PatientsTable({ permissions }: { permissions: string[] }) {
  const canDelete = hasPermission(permissions, PERMISSIONS.PATIENTS_DELETE);
  return canDelete ? <DeleteButton /> : null;
}
```

`permissions` is always computed once per request in a Server Component via
`getCurrentPermissions()` and threaded down as a plain `string[]` prop — there is no
client-side permissions fetch anywhere in the app. This mirrors the no-client-data-fetching
convention described in [Architecture.md](./Architecture.md).

## What's wired up as of Phase 2.1

The Patients module is the reference implementation of every pattern above:

- `src/lib/authz/permissions.ts` and `src/lib/authz/session.ts` exist and implement the API
  above.
- Every Server Action in `src/lib/patients/actions.ts` calls `ensurePermission()` with the
  matching permission before mutating: `createPatient` → `PATIENTS_CREATE`; `updatePatient`,
  `archivePatient`/`restorePatient`, `recordPatientFile`, `deletePatientFile` →
  `PATIENTS_EDIT`; `deletePatient` → `PATIENTS_DELETE`.
- Page-level guards: `src/app/(app)/patients/new/page.tsx` and
  `src/app/(app)/patients/[id]/edit/page.tsx` call `requirePermission()`.
- Conditional UI: `src/components/layout/sidebar.tsx` (nav items), the "Add Patient" button in
  `src/app/(app)/patients/page.tsx`, and the patient row/header action menus all read from a
  `permissions` prop populated by `getCurrentPermissions()` in their parent Server Component
  (`src/app/(app)/layout.tsx`, `src/app/(app)/patients/page.tsx`,
  `src/app/(app)/patients/[id]/page.tsx`).

See [Phase-2.1.md](./Phase-2.1.md) for the precise, current status of this wiring — some of it
was still landing as this documentation was being written, so check that changelog rather than
assuming everything above is finished in every file.
