-- Batch 7 — Scheduler foundation. Additive only: one new table plus two
-- helper functions, no changes to any existing table, policy, or function.
--
-- This table is deliberately clinic-independent: the external cron trigger
-- that reaches the scheduler endpoint is infrastructure-level execution,
-- authenticated by a shared secret, not a staff session — there is no
-- clinic_id to scope it by, and it must never be treated as one. Individual
-- future jobs (appointment reminders, overdue invoice checks, low-stock
-- checks) remain responsible for deriving and iterating their own clinic
-- scope when they're implemented; this table only ever tracks "did the
-- scheduler run, and is one already running."
--
-- Why persistence is needed at all (not just an in-memory/process-local
-- guard): Dentra may run on multiple server instances, and a process-local
-- lock (a module-level variable, an in-memory Map, a setTimeout-based
-- guard) would not be visible across instances or across a redeploy — two
-- concurrent cron-triggered requests hitting two different instances could
-- both believe they're the only one running. A plain Postgres table with a
-- partial unique index gives an atomic, connection-independent mutual
-- exclusion guarantee enforced by the database itself, which is exactly
-- what a horizontally-scaled deployment needs and an in-process lock
-- cannot provide.
create table public.scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'timed_out')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  -- Job-level outcome summary only (job name, status, duration) — never
  -- patient data, never request headers/secrets. See runner.ts's own
  -- doc comment for exactly what is allowed to end up here.
  results jsonb,
  created_at timestamptz not null default now()
);

-- The actual lock: at most one row with status = 'running' can exist at any
-- time. A second concurrent attempt to insert a 'running' row raises a
-- unique_violation, which claim_scheduler_run() below treats as "someone
-- else is already running this tick" rather than an error.
create unique index scheduler_runs_singleton_running_idx
  on public.scheduler_runs ((status))
  where status = 'running';

-- Supports both the stale-run cleanup query in claim_scheduler_run() and
-- any future "show recent scheduler runs" operational view, without a
-- sequential scan as this table grows.
create index scheduler_runs_started_at_idx on public.scheduler_runs (started_at desc);

-- RLS is enabled with zero policies for `authenticated`/`anon` — this table
-- is never queried directly by the application's RLS-scoped client (staff
-- sessions have no legitimate reason to read or write it), only through the
-- two `security definer` functions below, which run with the function
-- owner's privileges regardless of RLS, the same pattern every other
-- privileged helper in this schema (private.current_clinic_id(), etc.)
-- already uses.
alter table public.scheduler_runs enable row level security;

-- Atomically reclaims any stale 'running' row (older than
-- p_stale_after_seconds — a crashed or platform-timed-out request that
-- never called finish_scheduler_run()) and then attempts to claim a new
-- run. Returns the new run's id, or null if another run is genuinely still
-- in progress. The stale-cleanup UPDATE and the claiming INSERT happen in
-- one function invocation — one implicit transaction — so two concurrent
-- callers can never both observe the same stale row as "safe to reclaim"
-- and then both successfully insert; the unique index still arbitrates
-- between them exactly as it would without the cleanup step.
create or replace function public.claim_scheduler_run(p_stale_after_seconds integer default 120)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
begin
  update public.scheduler_runs
  set status = 'timed_out', finished_at = now()
  where status = 'running'
    and started_at < now() - (p_stale_after_seconds || ' seconds')::interval;

  insert into public.scheduler_runs (status)
  values ('running')
  returning id into v_run_id;

  return v_run_id;
exception
  when unique_violation then
    return null;
end;
$$;

-- Marks a claimed run finished (success or failure) with its job-level
-- results attached. Only ever called with the id claim_scheduler_run()
-- itself returned, from the same request — never a client-supplied id.
create or replace function public.finish_scheduler_run(p_run_id uuid, p_status text, p_results jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'invalid scheduler run status: %', p_status;
  end if;

  update public.scheduler_runs
  set status = p_status, finished_at = now(), results = p_results
  where id = p_run_id;
end;
$$;
