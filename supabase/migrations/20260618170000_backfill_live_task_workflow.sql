create extension if not exists pgcrypto;

create or replace function public.generate_prefixed_id(prefix text)
returns text
language sql
as $$
  select prefix || '-' || gen_random_uuid()::text
$$;

do $$
declare
  ward_task_id_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
  into ward_task_id_type
  from pg_attribute attribute
  join pg_class class on class.oid = attribute.attrelid
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = 'ward_tasks'
    and attribute.attname = 'id'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if ward_task_id_type is null then
    raise exception 'public.ward_tasks.id type could not be resolved';
  end if;

  execute format(
    'create table if not exists public.task_updates (
      id text primary key default public.generate_prefixed_id(''task-update''),
      task_id %s not null references public.ward_tasks(id) on delete cascade,
      note text not null,
      created_by_id uuid references public.profiles(id) on delete set null,
      created_by_name text not null default '''',
      created_at timestamptz not null default timezone(''utc'', now())
    )',
    ward_task_id_type
  );
end $$;

create index if not exists idx_task_updates_task_id on public.task_updates (task_id);
create index if not exists idx_task_updates_created_at on public.task_updates (created_at desc);

alter table public.task_updates enable row level security;

drop policy if exists "profiles_visible_scope_select" on public.profiles;
drop policy if exists "profiles_same_ward_or_admin_select" on public.profiles;
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_visible_scope_select"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.role in ('admin', 'resident')
  )
  or exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and actor.ward_assignment is not null
      and actor.ward_assignment = profiles.ward_assignment
  )
);

drop policy if exists "patients_select" on public.patients;
drop policy if exists "patients_same_ward" on public.patients;
create policy "patients_select"
on public.patients
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and (
        actor.role in ('admin', 'resident')
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patients.ward_id
        )
      )
  )
);

drop policy if exists "patients_insert" on public.patients;
create policy "patients_insert"
on public.patients
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and (
        actor.role = 'admin'
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patients.ward_id
        )
      )
  )
);

drop policy if exists "patients_update" on public.patients;
drop policy if exists "patients_update_check" on public.patients;
create policy "patients_update"
on public.patients
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and (
        actor.role = 'admin'
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patients.ward_id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and (
        actor.role = 'admin'
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patients.ward_id
        )
      )
  )
);

drop policy if exists "patients_delete" on public.patients;
create policy "patients_delete"
on public.patients
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = auth.uid()
      and (
        actor.role = 'admin'
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patients.ward_id
        )
      )
  )
);

drop policy if exists "problems_select" on public.problems;
drop policy if exists "problems_same_ward" on public.problems;
create policy "problems_select"
on public.problems
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = problems.patient_id
      and (
        actor.role in ('admin', 'resident')
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "problems_insert" on public.problems;
create policy "problems_insert"
on public.problems
for insert
to authenticated
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = problems.patient_id
      and (
        actor.role = 'admin'
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "problems_update" on public.problems;
create policy "problems_update"
on public.problems
for update
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = problems.patient_id
      and (
        actor.role = 'admin'
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = problems.patient_id
      and (
        actor.role = 'admin'
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "tasks_select" on public.ward_tasks;
drop policy if exists "tasks_same_ward" on public.ward_tasks;
create policy "tasks_select"
on public.ward_tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = ward_tasks.patient_id
      and (
        actor.role in ('admin', 'resident')
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "tasks_insert" on public.ward_tasks;
create policy "tasks_insert"
on public.ward_tasks
for insert
to authenticated
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = ward_tasks.patient_id
      and (
        actor.role in ('admin', 'resident')
        or (
          actor.role = 'student'
          and actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "tasks_update" on public.ward_tasks;
create policy "tasks_update"
on public.ward_tasks
for update
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = ward_tasks.patient_id
      and (
        actor.role in ('admin', 'resident')
        or (
          actor.role = 'student'
          and actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = ward_tasks.patient_id
      and (
        actor.role in ('admin', 'resident')
        or (
          actor.role = 'student'
          and actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "tasks_delete" on public.ward_tasks;
create policy "tasks_delete"
on public.ward_tasks
for delete
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = ward_tasks.patient_id
      and (
        actor.role in ('admin', 'resident')
        or (
          actor.role = 'student'
          and actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "task_updates_select" on public.task_updates;
create policy "task_updates_select"
on public.task_updates
for select
to authenticated
using (
  exists (
    select 1
    from public.ward_tasks task
    join public.patients patient on patient.id = task.patient_id
    join public.profiles actor on actor.id = auth.uid()
    where task.id = task_updates.task_id
      and (
        actor.role in ('admin', 'resident')
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "task_updates_insert" on public.task_updates;
create policy "task_updates_insert"
on public.task_updates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.ward_tasks task
    join public.patients patient on patient.id = task.patient_id
    join public.profiles actor on actor.id = auth.uid()
    where task.id = task_updates.task_id
      and (
        actor.role in ('admin', 'resident')
        or (
          actor.role = 'student'
          and actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "handover_select" on public.handover_notes;
drop policy if exists "handover_same_ward" on public.handover_notes;
create policy "handover_select"
on public.handover_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = handover_notes.patient_id
      and (
        actor.role in ('admin', 'resident')
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "handover_insert" on public.handover_notes;
create policy "handover_insert"
on public.handover_notes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = handover_notes.patient_id
      and (
        actor.role = 'admin'
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "handover_update" on public.handover_notes;
create policy "handover_update"
on public.handover_notes
for update
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = handover_notes.patient_id
      and (
        actor.role = 'admin'
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = handover_notes.patient_id
      and (
        actor.role = 'admin'
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "activity_select" on public.activity_logs;
drop policy if exists "activity_same_ward" on public.activity_logs;
create policy "activity_select"
on public.activity_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = activity_logs.patient_id
      and (
        actor.role in ('admin', 'resident')
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "activity_insert" on public.activity_logs;
create policy "activity_insert"
on public.activity_logs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = activity_logs.patient_id
      and (
        actor.role in ('admin', 'resident')
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "discharge_summaries_select" on public.discharge_summaries;
drop policy if exists "discharge_summaries_same_ward" on public.discharge_summaries;
create policy "discharge_summaries_select"
on public.discharge_summaries
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = discharge_summaries.patient_id
      and (
        actor.role in ('admin', 'resident')
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "discharge_summaries_insert" on public.discharge_summaries;
create policy "discharge_summaries_insert"
on public.discharge_summaries
for insert
to authenticated
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = discharge_summaries.patient_id
      and (
        actor.role = 'admin'
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

drop policy if exists "discharge_summaries_update" on public.discharge_summaries;
create policy "discharge_summaries_update"
on public.discharge_summaries
for update
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = discharge_summaries.patient_id
      and (
        actor.role = 'admin'
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.patients patient
    join public.profiles actor on actor.id = auth.uid()
    where patient.id = discharge_summaries.patient_id
      and (
        actor.role = 'admin'
        or (
          actor.ward_assignment is not null
          and actor.ward_assignment = patient.ward_id
        )
      )
  )
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'task_updates'
  ) then
    alter publication supabase_realtime add table public.task_updates;
  end if;
end $$;
