do $$
begin
  if not exists (select 1 from pg_type where typname = 'precaution_type') then
    create type public.precaution_type as enum ('none', 'contact', 'droplet', 'airborne');
  end if;
end $$;

do $$
begin
  if exists (select 1 from pg_type where typname = 'task_status')
    and not exists (select 1 from pg_type where typname = 'task_status_v2') then
    create type public.task_status_v2 as enum ('not_started', 'in_progress', 'done', 'blocked');
  end if;

  if exists (select 1 from pg_type where typname = 'task_priority')
    and not exists (select 1 from pg_type where typname = 'task_priority_v2') then
    create type public.task_priority_v2 as enum ('normal', 'urgent', 'emergency');
  end if;
end $$;

alter table public.patients
  add column if not exists precaution public.precaution_type not null default 'none';

update public.patients
set precaution = case
  when coalesce(isolation_flag, false) then 'contact'::public.precaution_type
  else 'none'::public.precaution_type
end
where precaution is null;

alter table public.activity_logs
  add column if not exists actor_name text not null default 'Unknown User';

create table if not exists public.discharge_summaries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients(id) on delete cascade,
  ward_id uuid references public.wards(id) on delete set null,
  created_by_id uuid references public.profiles(id) on delete set null,
  created_by_name text not null default 'Unknown User',
  admit_date timestamptz not null,
  discharge_date timestamptz not null,
  length_of_stay text not null default '',
  primary_diagnosis text not null,
  hospital_course text not null default '',
  plan text not null default '',
  home_medication text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.discharge_summaries
  add column if not exists ward_id uuid references public.wards(id) on delete set null,
  add column if not exists created_by_id uuid references public.profiles(id) on delete set null,
  add column if not exists created_by_name text not null default 'Unknown User',
  add column if not exists admit_date timestamptz,
  add column if not exists discharge_date timestamptz,
  add column if not exists length_of_stay text not null default '',
  add column if not exists primary_diagnosis text,
  add column if not exists hospital_course text not null default '',
  add column if not exists plan text not null default '',
  add column if not exists home_medication text not null default '',
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discharge_summaries'
      and column_name = 'admit_date'
      and is_nullable = 'YES'
  ) then
    update public.discharge_summaries
    set admit_date = coalesce(admit_date, created_at, timezone('utc', now()));

    alter table public.discharge_summaries
      alter column admit_date set not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discharge_summaries'
      and column_name = 'discharge_date'
      and is_nullable = 'YES'
  ) then
    update public.discharge_summaries
    set discharge_date = coalesce(discharge_date, created_at, timezone('utc', now()));

    alter table public.discharge_summaries
      alter column discharge_date set not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'discharge_summaries'
      and column_name = 'primary_diagnosis'
      and is_nullable = 'YES'
  ) then
    update public.discharge_summaries
    set primary_diagnosis = coalesce(primary_diagnosis, 'Unknown diagnosis');

    alter table public.discharge_summaries
      alter column primary_diagnosis set not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ward_tasks'
      and column_name = 'status'
      and udt_name = 'task_status'
  ) then
    alter table public.ward_tasks
      alter column status drop default,
      alter column status type public.task_status_v2
      using case
        when status::text = 'waiting' then 'blocked'::public.task_status_v2
        else status::text::public.task_status_v2
      end,
      alter column status set default 'not_started';

    drop type public.task_status;
    alter type public.task_status_v2 rename to task_status;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ward_tasks'
      and column_name = 'priority'
      and udt_name = 'task_priority'
  ) then
    alter table public.ward_tasks
      alter column priority drop default,
      alter column priority type public.task_priority_v2
      using case
        when priority::text = 'low' then 'normal'::public.task_priority_v2
        when priority::text = 'high' then 'emergency'::public.task_priority_v2
        else priority::text::public.task_priority_v2
      end,
      alter column priority set default 'normal';

    alter table public.task_templates
      alter column default_priority drop default,
      alter column default_priority type public.task_priority_v2
      using case
        when default_priority::text = 'low' then 'normal'::public.task_priority_v2
        when default_priority::text = 'high' then 'emergency'::public.task_priority_v2
        else default_priority::text::public.task_priority_v2
      end,
      alter column default_priority set default 'normal';

    drop type public.task_priority;
    alter type public.task_priority_v2 rename to task_priority;
  end if;
end $$;

update public.task_templates
set default_priority = 'emergency'
where title in ('Follow culture', 'Consult specialist', 'Procedure prep');

update public.task_templates
set default_priority = 'normal'
where title = 'Appointment';

alter table public.wards enable row level security;
alter table public.profiles enable row level security;
alter table public.task_templates enable row level security;
alter table public.discharge_summaries enable row level security;

create or replace function public.current_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.current_profile_ward_assignment()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ward_assignment
  from public.profiles
  where id = auth.uid()
$$;

drop policy if exists "wards_admin_write" on public.wards;
create policy "wards_admin_write"
on public.wards
for all
to authenticated
using (
  public.current_profile_role() = 'admin'
)
with check (
  public.current_profile_role() = 'admin'
);

drop policy if exists "profiles_same_ward_or_admin_select" on public.profiles;
create policy "profiles_same_ward_or_admin_select"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_profile_role() = 'admin'
  or (
    public.current_profile_ward_assignment() is not null
    and public.current_profile_ward_assignment() = profiles.ward_assignment
  )
);

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update"
on public.profiles
for update
to authenticated
using (
  public.current_profile_role() = 'admin'
)
with check (
  public.current_profile_role() = 'admin'
);

drop policy if exists "task_templates_admin_write" on public.task_templates;
create policy "task_templates_admin_write"
on public.task_templates
for all
to authenticated
using (
  public.current_profile_role() = 'admin'
)
with check (
  public.current_profile_role() = 'admin'
);

drop policy if exists "discharge_summaries_same_ward" on public.discharge_summaries;
create policy "discharge_summaries_same_ward"
on public.discharge_summaries
for all
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = discharge_summaries.patient_id
      and (actor.role = 'admin' or actor.ward_assignment = patient.ward_id)
  )
)
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = discharge_summaries.patient_id
      and (actor.role = 'admin' or actor.ward_assignment = patient.ward_id)
  )
);

drop trigger if exists set_discharge_summaries_updated_at on public.discharge_summaries;
create trigger set_discharge_summaries_updated_at
before update on public.discharge_summaries
for each row execute function public.set_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'discharge_summaries'
  ) then
    alter publication supabase_realtime add table public.discharge_summaries;
  end if;
end $$;
