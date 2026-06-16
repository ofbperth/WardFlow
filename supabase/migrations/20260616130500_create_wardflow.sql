create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'resident', 'student');
  end if;
  if not exists (select 1 from pg_type where typname = 'patient_status') then
    create type public.patient_status as enum ('stable', 'watch', 'critical');
  end if;
  if not exists (select 1 from pg_type where typname = 'patient_lifecycle') then
    create type public.patient_lifecycle as enum ('active', 'discharged');
  end if;
  if not exists (select 1 from pg_type where typname = 'problem_status') then
    create type public.problem_status as enum ('active', 'improving', 'worsening', 'resolved');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum ('not_started', 'in_progress', 'waiting', 'done', 'blocked');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_type') then
    create type public.task_type as enum ('lab', 'imaging', 'consult', 'procedure', 'family_talk', 'discharge', 'medication', 'other');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.wards (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  avatar_url text,
  role public.app_role not null default 'student',
  ward_assignment uuid references public.wards(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  ward_id uuid not null references public.wards(id) on delete cascade,
  bed text not null,
  display_name text not null,
  age integer,
  sex text,
  diagnosis text not null,
  status public.patient_status not null default 'stable',
  responsible_doctor_id uuid references public.profiles(id) on delete set null,
  allergy text,
  isolation_flag boolean not null default false,
  code_status text,
  lifecycle public.patient_lifecycle not null default 'active',
  discharged_at timestamptz,
  updated_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.problems (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null,
  status public.problem_status not null default 'active',
  key_data text,
  plan text,
  pending text,
  watch_out text,
  include_in_handover boolean not null default true,
  sort_order integer not null default 1,
  updated_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ward_tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null,
  note text,
  owner_id uuid references public.profiles(id) on delete set null,
  status public.task_status not null default 'not_started',
  priority public.task_priority not null default 'normal',
  type public.task_type not null default 'other',
  due_at timestamptz,
  blocked_reason text,
  updated_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.handover_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients(id) on delete cascade,
  note text not null default '',
  escalation_instruction text,
  updated_by_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.task_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  type public.task_type not null,
  default_priority public.task_priority not null default 'normal',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.wards enable row level security;
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.problems enable row level security;
alter table public.ward_tasks enable row level security;
alter table public.handover_notes enable row level security;
alter table public.activity_logs enable row level security;
alter table public.task_templates enable row level security;

create policy "profiles_self"
on public.profiles
for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "wards_select"
on public.wards
for select
to authenticated
using (true);

create policy "task_templates_select"
on public.task_templates
for select
to authenticated
using (true);

create policy "patients_same_ward"
on public.patients
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and (actor.role = 'admin' or actor.ward_assignment = patients.ward_id)
  )
)
with check (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and (actor.role = 'admin' or actor.ward_assignment = patients.ward_id)
  )
);

create policy "problems_same_ward"
on public.problems
for all
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = problems.patient_id
      and (actor.role = 'admin' or actor.ward_assignment = patient.ward_id)
  )
)
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = problems.patient_id
      and (actor.role = 'admin' or actor.ward_assignment = patient.ward_id)
  )
);

create policy "tasks_same_ward"
on public.ward_tasks
for all
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = ward_tasks.patient_id
      and (actor.role = 'admin' or actor.ward_assignment = patient.ward_id)
  )
)
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = ward_tasks.patient_id
      and (actor.role = 'admin' or actor.ward_assignment = patient.ward_id)
  )
);

create policy "handover_same_ward"
on public.handover_notes
for all
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = handover_notes.patient_id
      and (actor.role = 'admin' or actor.ward_assignment = patient.ward_id)
  )
)
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = handover_notes.patient_id
      and (actor.role = 'admin' or actor.ward_assignment = patient.ward_id)
  )
);

create policy "activity_same_ward"
on public.activity_logs
for all
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = activity_logs.patient_id
      and (actor.role = 'admin' or actor.ward_assignment = patient.ward_id)
  )
)
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = activity_logs.patient_id
      and (actor.role = 'admin' or actor.ward_assignment = patient.ward_id)
  )
);

alter publication supabase_realtime add table public.patients;
alter publication supabase_realtime add table public.problems;
alter publication supabase_realtime add table public.ward_tasks;
alter publication supabase_realtime add table public.handover_notes;

insert into public.task_templates (title, type, default_priority)
values
  ('Follow lab', 'lab', 'normal'),
  ('Follow culture', 'lab', 'high'),
  ('Consult specialist', 'consult', 'high'),
  ('Talk to family', 'family_talk', 'normal'),
  ('Discharge summary', 'discharge', 'normal'),
  ('Home meds', 'medication', 'normal'),
  ('Appointment', 'other', 'low'),
  ('Procedure prep', 'procedure', 'high')
on conflict (title) do nothing;
