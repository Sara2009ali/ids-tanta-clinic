# IDS Tanta — Dental Practice Management System

**Phase 1** (done): project foundation — structure, database schema, authentication, and a UI
shell for Dashboard and Patients.

**Phase 2** (done): full Patient Management module — patient list with instant search,
filters, sorting and pagination; a complete registration form (personal/medical/dental
information); patient profiles with medical/dental history, a real activity timeline built
from the audit log, file uploads (photo/documents/X-rays/consent forms), and audit history;
archive and soft-delete. Appointments, Clinical Notes, Invoices, Payments, Recalls, Reports,
and Settings remain placeholders until their own phases.

## Stack

- Next.js 16 (App Router, TypeScript)
- Supabase (Postgres, Auth, Storage)
- Tailwind CSS v4 + shadcn/ui

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) (free tier is fine).

2. **Install the Supabase CLI** if you don't have it, then link this project to yours:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```

3. **Apply the database migration**:

   ```bash
   npm run db:push
   ```

   This creates `clinics`, `staff_profiles`, `patients` and related tables, plus row-level
   security policies, in your Supabase project.

4. **Copy the env template** and fill in your project's API keys (Project Settings → API in the
   Supabase dashboard):

   ```bash
   cp .env.local.example .env.local
   ```

5. **Seed demo staff accounts** (creates a demo clinic + one admin/doctor/reception login):

   ```bash
   npm run seed
   ```

   Prints the demo email/password combinations to sign in with.

6. **Run the app**:

   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

## Regenerating types after a schema change

`src/types/database.generated.ts` is generated from the live Supabase schema — never hand-edit
it. After any migration, regenerate it:

```bash
npm run db:types
```

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
    supabase/  # browser/server/proxy client factories
    auth/      # session DAL (getCurrentStaff, requireRole)
    patients/  # schema (zod), queries, server actions, storage helpers, utils
    audit/     # audit log writer
  proxy.ts     # session refresh + route protection (Next 16's renamed middleware)
supabase/
  migrations/  # SQL schema + RLS + search_patients RPC
scripts/
  seed-auth-users.ts   # demo staff account seeding
```
