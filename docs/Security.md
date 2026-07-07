# Security

This document covers the security-relevant work done in Phase 2.1 — environment validation,
HTTP security headers, and the RBAC hardening — plus an honest list of what remains out of
scope for this phase.

## Environment variable validation

`src/lib/env.ts` centralizes and validates the two public Supabase environment variables with
Zod:

- `NEXT_PUBLIC_SUPABASE_URL` (must be a valid URL)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (must be a non-empty string)

If either is missing or invalid, the module throws at import time with a descriptive error
listing exactly which variable is missing/invalid and a pointer to check `.env.local` or the
deployment environment's configuration — failing fast at startup instead of surfacing a
confusing runtime error deep in a Supabase client call. `src/lib/supabase/server.ts` (and the
browser client) import `env.supabaseUrl` / `env.supabasePublishableKey` from this module rather
than reading `process.env.NEXT_PUBLIC_SUPABASE_URL!` directly, which replaces three previously
separate non-null-assertion call sites with one validated source of truth.

Only `NEXT_PUBLIC_*` variables belong in `src/lib/env.ts`, because it's imported by
`src/lib/supabase/client.ts`, which runs in the browser. Server-only secrets — e.g.
`SUPABASE_SECRET_KEY`, used by `scripts/seed-auth-users.ts` — must never be added to this
schema, since anything validated there is safe to assume is bundled client-side.

## HTTP security headers

`next.config.ts` adds a `headers()` function that applies the following headers to every route
(`source: "/(.*)"`):

| Header | Value |
| --- | --- |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | see below |

The Content-Security-Policy is assembled from:

```
default-src 'self'
script-src 'self' 'unsafe-inline'[ 'unsafe-eval' in development only]
style-src 'self' 'unsafe-inline'
img-src 'self' data: https://*.supabase.co
font-src 'self' data:
connect-src 'self' https://*.supabase.co wss://*.supabase.co
frame-ancestors 'none'
base-uri 'self'
object-src 'none'
```

Notes on the CSP, per the comment in `next.config.ts`:

- `'unsafe-inline'` on `script-src` is required for Next.js hydration.
- `'unsafe-eval'` is added to `script-src` only when `NODE_ENV !== "production"`, because
  Turbopack's dev-mode HMR needs it; production builds do not get `'unsafe-eval'`.
- `img-src`, `connect-src` (including the `wss://` variant for realtime) allow `*.supabase.co`
  because Supabase Auth/REST/Storage/Realtime all live under that domain.
- `frame-ancestors 'none'` and `X-Frame-Options: DENY` both prevent the app from being framed
  (clickjacking protection); `object-src 'none'` blocks `<object>`/`<embed>` content entirely.

## RBAC as a security fix

The RBAC work in this phase (see [RBAC.md](./RBAC.md)) is not purely an authorization feature —
it closes a genuine access-control gap. Before this phase:

- **Application layer**: no patient server action (`createPatient`, `updatePatient`,
  `archivePatient`, `restorePatient`, `deletePatient`, `recordPatientFile`,
  `deletePatientFile`) checked the caller's role at all beyond confirming they were signed in
  and belonged to a clinic. Any authenticated staff member — a receptionist, an assistant —
  could call `deletePatient` or `archivePatient` on any patient in their clinic.
- **Database layer**: the RLS policy on `patients` (and `patient_clinical_info`/
  `patient_files`) was a single `for all` policy that checked only clinic tenancy
  (`clinic_id = current_clinic_id()`), not role. So even a hardened server action would not
  have been backstopped by the database if it had a bug — the RLS policy itself permitted any
  clinic staff member to perform any write.

This was a **Critical**-severity finding from the architectural audit that preceded Phase 2.1:
any authenticated staff member, regardless of role, could delete or archive any patient
record, at both layers. The 0005 migration's split select/insert/update/delete policies (gated
by `private.has_permission(key)` in addition to the existing clinic-tenancy check) and the
`ensurePermission()` calls added to every patient server action close this gap at both layers
simultaneously. See RBAC.md for exactly which permission gates which policy/action.

## Out of scope for this phase

To be direct about what Phase 2.1 does *not* cover, so it isn't mistaken for a comprehensive
security pass:

- **No rate limiting on login.** `src/lib/auth/actions.ts`'s sign-in action has no attempt
  throttling, lockout, or CAPTCHA; brute-forcing is only as hard as Supabase Auth's own default
  protections make it.
- **No centralized error/monitoring service.** Errors from Supabase calls are logged with
  `console.error` at the call site (see the patient server actions); there is no Sentry (or
  equivalent) integration, so failures are only visible in server logs.
- **`patient_medical_alerts` write policies are unchanged.** The 0005 migration leaves the
  original single `for all` clinic-tenancy-only policy in place for this table, because no
  write path exists for it yet (no server action inserts/updates/deletes medical alerts) — read
  access is what's actually exercised today. When a write path is added, it should get the same
  select/insert/update/delete + permission-gated treatment the other patient tables received.

None of these are regressions introduced by Phase 2.1 — they were out of scope before this
phase too — but they're worth tracking explicitly rather than leaving as implicit gaps.
