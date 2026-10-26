-- Daily 01:00 Asia/Bangkok = 18:00 UTC. No application/API credentials needed.
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if current_setting('cron.timezone') not in ('GMT', 'UTC', 'Etc/UTC') then
    raise exception 'Expected UTC cron timezone; review the Bangkok schedule';
  end if;
end;
$$;

create schema if not exists wardflow_private;
revoke all on schema wardflow_private from public, anon, authenticated, service_role;

create table wardflow_private.patient_cleanup_runs (
  id bigint generated always as identity primary key,
  executed_at timestamptz not null default now(),
  cutoff_at timestamptz not null,
  deleted_patients bigint not null check (deleted_patients >= 0)
);
alter table wardflow_private.patient_cleanup_runs enable row level security;
revoke all on wardflow_private.patient_cleanup_runs from public, anon, authenticated, service_role;

create index if not exists patients_discharged_cleanup_idx
  on public.patients (discharged_at) where lifecycle = 'discharged';

create or replace function wardflow_private.purge_discharged_patients()
returns bigint
language plpgsql
security invoker
set search_path = ''
set timezone = 'UTC'
as $$
declare
  cutoff timestamptz := now() - interval '720 hours';
  deleted_count bigint;
begin
  -- Serialize manual and scheduled runs. PostgreSQL rechecks the DELETE
  -- predicate after a concurrent update, protecting patients readmitted first.
  perform pg_catalog.pg_advisory_xact_lock(48130726054153);
  delete from public.patients
  where lifecycle = 'discharged' and discharged_at <= cutoff;
  get diagnostics deleted_count = row_count;

  -- All clinical children are removed by existing ON DELETE CASCADE FKs.
  -- Store counts only; deletion and success record commit atomically.
  insert into wardflow_private.patient_cleanup_runs (cutoff_at, deleted_patients)
  values (cutoff, deleted_count);
  return deleted_count;
end;
$$;
revoke all on function wardflow_private.purge_discharged_patients()
  from public, anon, authenticated, service_role;

select cron.schedule(
  'wardflow-purge-discharged-patients',
  '0 18 * * *',
  $job$set statement_timeout = '5min'; select wardflow_private.purge_discharged_patients();$job$
);
