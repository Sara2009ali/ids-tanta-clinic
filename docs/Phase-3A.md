# Phase 3A — Appointment & Reception Management Foundation

This is a changelog-style summary of Phase 3A, following the pattern of
[Phase-2.1.md](./Phase-2.1.md). It follows Phase 1 (foundation), Phase 2 (Patient Management), and
Phase 2.1 (infrastructure hardening and RBAC) described in `README.md` and `Phase-2.1.md`. Phase
3A lays the schema and application-layer foundation for scheduling; later phases (3B+) build the
calendar, doctor-schedule management, and reception workspace on top of it.

## Why this phase happened

Phase 2.1 registered `appointments.*` permission keys and RLS conventions ahead of time, explicitly
so that Appointments — along with Clinical, Billing, Reports, and Settings — could "inherit RBAC
from day one instead of retrofitting a permission model onto an already-shipped module" (see
Phase-2.1.md). Phase 3A is the first phase to draw on that groundwork: it is the module those
permission keys (`appointments.view`/`create`/`edit`/`cancel`) were seeded for, and it reuses the
exact select/insert/update RLS shape `0005`/`0007` established for `patients`.

The scope for this phase, following the Phase 3 planning/audit that preceded it, was deliberately
narrowed to the scheduling foundation — the database schema, double-booking prevention, and the
Server Action/query layer — rather than the full set of appointment-related screens (calendar,
doctor schedules, chair management, reception workspace), which are sequenced into Phase 3B+ so
each can be designed against real workflow decisions instead of being guessed up front.

## What was built

### Database (`supabase/migrations/0008_appointments.sql`, applied to the live project)

- **`appointment_status`** enum — eight values covering the full patient-visit lifecycle:
  `scheduled`, `confirmed`, `checked_in`, `waiting`, `in_treatment`, `completed`, `cancelled`,
  `no_show`.
- **`visit_types`** — a clinic-scoped lookup table (not an enum), auto-seeded with six defaults
  per clinic (Consultation, Cleaning, Filling, Root Canal, Follow-up, Emergency) via a trigger on
  `clinics` insert, plus a backfill for clinics that already existed.
- **`chairs`** — clinic-scoped, auto-seeded with two defaults ("Chair 1", "Chair 2") the same way.
  Assignment and conflict-checking only in this phase; no chair-management screen yet.
- **`appointments`** — patient/doctor/chair/visit-type foreign keys, `scheduled_start`/
  `scheduled_end`, `status`, a text-check-constrained `priority` (`normal`/`high`/`urgent`),
  `is_emergency`, `chief_complaint`, `notes`, and full audit fields (`created_by`/`updated_by`/
  `created_at`/`updated_at`/`deleted_at`), matching the audit-field convention already used by
  `patients`.
- **`appointment_status_history`** — append-only, populated exclusively by the
  `log_appointment_status_change()` database trigger, never written directly by application code.
- **Two `EXCLUDE USING gist` constraints** (`appointments_doctor_no_overlap`,
  `appointments_chair_no_overlap`, requiring the `btree_gist` extension) — the actual
  double-booking guarantee, enforced atomically at the database layer.
- **Indexes** on `(clinic_id)`, `(patient_id)`, `(doctor_id, scheduled_start)`, `(chair_id,
  scheduled_start)`, `(status)`, `(scheduled_start)`.
- **RLS** mirrors the patients module exactly: reads open to any clinic staff member, writes
  gated by `appointments.create`/`appointments.edit` — permissions already seeded in the Phase
  2.1 RBAC migration, so this migration adds zero new rows to `permissions`/`role_permissions`.

See [Database.md](./Database.md) for the full column-by-column reference and the reasoning behind
each design choice (why `visit_types`/`chairs` are tables and not enums, why the status history is
trigger-only, why the exclusion constraints exist alongside application-level validation).

### Application layer

- **`src/lib/appointments/validation.ts`** — pure business rules, no I/O: `calculateEndTime`,
  `isInPast`, `isWithinWorkingHours` (checked against `DEFAULT_CLINIC_HOURS`, a simple
  clinic-wide 9:00–21:00 default — see "Deferred to Phase 3B+" below), `hasOverlap`, and the
  umbrella `validateAppointment`, which runs every rule and returns the complete list of problems
  at once rather than failing fast on the first one, so the UI can surface everything wrong in a
  single pass.
- **`src/lib/appointments/schema.ts`** — Zod validation (`appointmentFormSchema`) and FormData
  parsing (`appointmentFormValuesFromFormData`), mirroring the existing pattern in
  `src/lib/patients/schema.ts`.
- **`src/lib/appointments/queries.ts`** — server-only reads: `listVisitTypes`, `listChairs`,
  `getDashboardCounts` (the Reception Dashboard's stat cards), `getTodaysSchedule` (today's
  appointments with patient/doctor/chair/visit-type names already joined in),
  `getRecentActivity` (a feed built from `appointment_status_history`), and
  `getDoctorBookingsForDay`/`getChairBookingsForDay` (same-day booking lookups used for the
  pre-insert conflict check).
- **`src/lib/appointments/actions.ts`** — `createAppointment`/`updateAppointment` Server Actions.
  Both call `ensurePermission()` first (`APPOINTMENTS_CREATE`/`APPOINTMENTS_EDIT`), run the
  conflict check via `validateAppointment` against that day's bookings, and — if a race is lost
  anyway — map a Postgres exclusion-constraint violation (SQLSTATE `23P01`) to a friendly "this
  doctor or chair was just booked for that time by someone else" message instead of surfacing a
  raw database error. Both write to `audit_log` via the existing `writeAuditLog()` helper
  (`appointment.created`/`appointment.updated`) and `revalidatePath()` the dashboard and
  appointments routes on success.

## Deliberately deferred to Phase 3B+

The following are explicitly **not** part of Phase 3A, even though some groundwork for them
already exists in the schema:

- **Calendar view** (day/week/month) — no calendar UI yet.
- **Doctor Schedule management** — working hours, breaks, vacations. Phase 3A only has the simple
  clinic-wide `DEFAULT_CLINIC_HOURS` default (9:00 AM–9:00 PM) in
  `src/lib/appointments/validation.ts`.
- **Chair Management UI** — `chairs` exist in the schema and can be assigned to and
  conflict-checked against an appointment, but there is no CRUD screen for creating or editing
  chairs yet (today, chairs come only from the auto-seeded defaults or a manual/service-role
  insert).
- **Reception Workspace** — the all-in-one, single-page operational view for front-desk staff.
- **Billing** and **Clinical records** modules.

## What Phase 3B can build on top of this without schema changes

- A calendar view is a different presentation of `appointments` rows already returned by
  `getTodaysSchedule()`'s query shape — no new columns are needed, only new query functions
  (week/month ranges) and UI.
- Doctor Schedule management can replace `DEFAULT_CLINIC_HOURS` with real per-doctor working-hours
  data without touching `appointments`, `visit_types`, or `chairs` — `isWithinWorkingHours()`
  already takes an explicit `WorkingHours` argument rather than hardcoding the default, so a real
  schedule lookup can be substituted in.
- Chair Management is purely a CRUD UI over the existing `chairs` table and its existing RLS
  (`admins can manage chairs`) — no migration required.
- Billing and Clinical modules are expected to add their own tables with a foreign key to
  `appointments.id`; the appointments schema was kept deliberately free of any speculative
  columns for either, so neither module's arrival requires a change to this schema.
- The Reception Workspace can be assembled entirely from queries that already exist
  (`getDashboardCounts`, `getTodaysSchedule`, `getRecentActivity`, `listVisitTypes`, `listChairs`)
  plus the existing `createAppointment`/`updateAppointment` actions — it's a UI composition
  exercise, not a new data layer.

## Frontend

- **`src/app/(app)/dashboard/page.tsx`** — the Reception Dashboard. Fetches
  `getDashboardCounts`/`getTodaysSchedule`/`getRecentActivity`/`listDoctors`/`listChairs`/
  `listVisitTypes`/`getCurrentPermissions` in parallel and renders eight stat cards (the seven
  Phase 3A cards plus the pre-existing Active Patients card), Today's Schedule, a Recent Activity
  feed, and a Quick Actions panel.
- **`src/components/appointments/appointment-form-sheet.tsx`** — the booking workflow, a `Sheet`
  (not a centered `Dialog` — the form is too long for the project's `sm:max-w-sm` dialog cap) with
  every Module 2 field, a live "Ends at HH:MM" preview computed from `calculateEndTime`, and
  duration auto-filling from the selected visit type's default.
- **`src/components/appointments/patient-picker.tsx`** — debounced patient search (via the new
  `src/lib/appointments/patient-search-action.ts` server-action wrapper around
  `searchPatients()`) with an inline "+ New Patient" mini-form that calls the existing
  `createPatient()` action directly and auto-selects the result — satisfies "create a patient
  without leaving the booking screen" without duplicating patient-creation logic.
- **`src/components/appointments/{chair-select,visit-type-select}.tsx`** — `DoctorSelect`-style
  dropdowns for the two new lookup tables.
- **`src/components/appointments/{todays-schedule,recent-activity-feed}.tsx`** — the dashboard's
  schedule list (status badges via `APPOINTMENT_STATUS_LABELS`, priority/emergency badges,
  visit-type color accent bar) and activity feed (relative timestamps, matching the existing
  patient-timeline's `formatRelative` convention).
- RBAC: the "New Appointment" quick action only renders when the caller has
  `appointments.create`; "New Patient" only when they have `patients.create`.

## Status

Complete: database migration (applied and verified), full application layer, frontend (dashboard +
booking workflow), 39 new Vitest tests, and this documentation set. `npm run typecheck`, `lint`,
`vitest run`, and `next build` all pass with zero errors as of this writing.
