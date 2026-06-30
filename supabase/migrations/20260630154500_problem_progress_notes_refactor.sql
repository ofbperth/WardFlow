do $$
begin
  if not exists (select 1 from pg_type where typname = 'problem_diagnosis_status') then
    create type public.problem_diagnosis_status as enum (
      'SUSPECTED',
      'CONFIRMED',
      'RULED_OUT'
    );
  end if;
end
$$;

alter table public.problems
  add column if not exists problem_name text,
  add column if not exists current_status_summary text,
  add column if not exists diagnosis_status public.problem_diagnosis_status not null default 'CONFIRMED',
  add column if not exists resolved_at timestamptz;

update public.problems
set
  problem_name = coalesce(problem_name, title),
  current_status_summary = coalesce(current_status_summary, current_status, key_data),
  diagnosis_status = coalesce(diagnosis_status, 'CONFIRMED'::public.problem_diagnosis_status),
  resolved_at = case
    when resolved_at is not null then resolved_at
    when priority = 'RESOLVED_CHRONIC'::public.problem_priority then updated_at
    when status = 'resolved' then updated_at
    else null
  end
where
  problem_name is null
  or current_status_summary is null
  or diagnosis_status is null
  or (resolved_at is null and (priority = 'RESOLVED_CHRONIC'::public.problem_priority or status = 'resolved'));

alter table public.problems
  alter column problem_name set not null;

create table if not exists public.problem_progress_entries (
  id text primary key default public.generate_prefixed_id('problem-progress'),
  problem_id text not null references public.problems(id) on delete cascade,
  date_time timestamptz not null default timezone('utc', now()),
  author_id uuid references public.profiles(id) on delete set null,
  status_update text,
  new_evidence text,
  treatment_change text,
  reasoning_update text,
  today_plan text,
  pending_task_ids text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists problem_progress_problem_datetime_idx
  on public.problem_progress_entries (problem_id, date_time desc);

create index if not exists problem_progress_author_idx
  on public.problem_progress_entries (author_id);

drop trigger if exists set_problem_progress_entries_updated_at on public.problem_progress_entries;
create trigger set_problem_progress_entries_updated_at
before update on public.problem_progress_entries
for each row
execute function public.set_updated_at();

insert into public.problem_progress_entries (
  problem_id,
  date_time,
  author_id,
  status_update,
  new_evidence,
  treatment_change,
  reasoning_update,
  today_plan,
  pending_task_ids,
  created_at,
  updated_at
)
select
  problem.id,
  coalesce(problem.updated_at, timezone('utc', now())),
  problem.updated_by_id,
  coalesce(problem.current_status, problem.key_data),
  coalesce(problem.evidence, problem.key_data),
  problem.treatment,
  problem.reasoning,
  coalesce(problem.today_plan, problem.plan),
  '{}'::text[],
  coalesce(problem.created_at, timezone('utc', now())),
  coalesce(problem.updated_at, timezone('utc', now()))
from public.problems problem
where not exists (
  select 1
  from public.problem_progress_entries progress
  where progress.problem_id = problem.id
);

alter table public.problem_progress_entries enable row level security;

drop policy if exists "problem_progress_entries_select" on public.problem_progress_entries;
create policy "problem_progress_entries_select"
on public.problem_progress_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.problems problem
    join public.patients patient on patient.id = problem.patient_id
    where problem.id = problem_progress_entries.problem_id
      and public.can_read_ward_uuid(patient.ward_id)
  )
);

drop policy if exists "problem_progress_entries_insert" on public.problem_progress_entries;
create policy "problem_progress_entries_insert"
on public.problem_progress_entries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.problems problem
    join public.patients patient on patient.id = problem.patient_id
    where problem.id = problem_progress_entries.problem_id
      and public.can_write_patient_core_ward_uuid(patient.ward_id)
  )
);

drop policy if exists "problem_progress_entries_update" on public.problem_progress_entries;
create policy "problem_progress_entries_update"
on public.problem_progress_entries
for update
to authenticated
using (
  exists (
    select 1
    from public.problems problem
    join public.patients patient on patient.id = problem.patient_id
    where problem.id = problem_progress_entries.problem_id
      and public.can_write_patient_core_ward_uuid(patient.ward_id)
  )
)
with check (
  exists (
    select 1
    from public.problems problem
    join public.patients patient on patient.id = problem.patient_id
    where problem.id = problem_progress_entries.problem_id
      and public.can_write_patient_core_ward_uuid(patient.ward_id)
  )
);

do $$
begin
  begin
    alter publication supabase_realtime add table public.problem_progress_entries;
  exception
    when duplicate_object then null;
  end;
end
$$;

alter table public.problems
  drop column if exists current_status,
  drop column if exists evidence,
  drop column if exists treatment,
  drop column if exists reasoning,
  drop column if exists today_plan,
  drop column if exists key_data,
  drop column if exists plan,
  drop column if exists pending,
  drop column if exists watch_out;
