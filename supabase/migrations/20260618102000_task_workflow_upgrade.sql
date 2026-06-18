create table if not exists public.task_updates (
  id text primary key default public.generate_prefixed_id('task-update'),
  task_id text not null references public.ward_tasks(id) on delete cascade,
  note text not null,
  created_by_id uuid references public.profiles(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_task_updates_task_id on public.task_updates (task_id);
create index if not exists idx_task_updates_created_at on public.task_updates (created_at desc);

alter table public.task_updates enable row level security;

create or replace function public.current_profile_ward_assignment_text()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ward_assignment
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.can_read_ward(target_ward text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() in ('admin', 'resident')
    or (
      target_ward is not null
      and public.current_profile_ward_assignment_text() is not null
      and public.current_profile_ward_assignment_text() = target_ward
    )
$$;

create or replace function public.can_write_task_workflow_ward(target_ward text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() in ('admin', 'resident')
    or (
      target_ward is not null
      and public.current_profile_role() = 'student'
      and public.current_profile_ward_assignment_text() is not null
      and public.current_profile_ward_assignment_text() = target_ward
    )
$$;

create or replace function public.can_write_patient_core_ward(target_ward text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'admin'
    or (
      target_ward is not null
      and public.current_profile_ward_assignment_text() is not null
      and public.current_profile_ward_assignment_text() = target_ward
    )
$$;

drop policy if exists "profiles_self_select" on public.profiles;
drop policy if exists "profiles_same_ward_or_admin_select" on public.profiles;
create policy "profiles_visible_scope_select"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_profile_role() in ('admin', 'resident')
  or (
    public.current_profile_ward_assignment_text() is not null
    and public.current_profile_ward_assignment_text() = profiles.ward_assignment
  )
);

drop policy if exists "patients_select" on public.patients;
create policy "patients_select"
on public.patients
for select
to authenticated
using (public.can_read_ward(ward_id));

drop policy if exists "patients_insert" on public.patients;
create policy "patients_insert"
on public.patients
for insert
to authenticated
with check (
  public.can_manage_patients()
  and public.can_write_patient_core_ward(ward_id)
);

drop policy if exists "patients_update" on public.patients;
create policy "patients_update"
on public.patients
for update
to authenticated
using (
  public.can_manage_patients()
  and public.can_write_patient_core_ward(ward_id)
);

drop policy if exists "patients_update_check" on public.patients;
create policy "patients_update_check"
on public.patients
for update
to authenticated
with check (
  public.can_manage_patients()
  and public.can_write_patient_core_ward(ward_id)
);

drop policy if exists "patients_delete" on public.patients;
create policy "patients_delete"
on public.patients
for delete
to authenticated
using (
  public.can_manage_patients()
  and public.can_write_patient_core_ward(ward_id)
);

drop policy if exists "problems_select" on public.problems;
create policy "problems_select"
on public.problems
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    where patient.id = problems.patient_id
      and public.can_read_ward(patient.ward_id)
  )
);

drop policy if exists "problems_insert" on public.problems;
create policy "problems_insert"
on public.problems
for insert
to authenticated
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = problems.patient_id
      and public.can_write_patient_core_ward(patient.ward_id)
  )
);

drop policy if exists "problems_update" on public.problems;
create policy "problems_update"
on public.problems
for update
to authenticated
using (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = problems.patient_id
      and public.can_write_patient_core_ward(patient.ward_id)
  )
)
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = problems.patient_id
      and public.can_write_patient_core_ward(patient.ward_id)
  )
);

drop policy if exists "tasks_select" on public.ward_tasks;
create policy "tasks_select"
on public.ward_tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    where patient.id = ward_tasks.patient_id
      and public.can_read_ward(patient.ward_id)
  )
);

drop policy if exists "tasks_insert" on public.ward_tasks;
create policy "tasks_insert"
on public.ward_tasks
for insert
to authenticated
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = ward_tasks.patient_id
      and public.can_write_task_workflow_ward(patient.ward_id)
  )
);

drop policy if exists "tasks_update" on public.ward_tasks;
create policy "tasks_update"
on public.ward_tasks
for update
to authenticated
using (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = ward_tasks.patient_id
      and public.can_write_task_workflow_ward(patient.ward_id)
  )
)
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = ward_tasks.patient_id
      and public.can_write_task_workflow_ward(patient.ward_id)
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
    where task.id = task_updates.task_id
      and public.can_read_ward(patient.ward_id)
  )
);

drop policy if exists "task_updates_insert" on public.task_updates;
create policy "task_updates_insert"
on public.task_updates
for insert
to authenticated
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.ward_tasks task
    join public.patients patient on patient.id = task.patient_id
    where task.id = task_updates.task_id
      and public.can_write_task_workflow_ward(patient.ward_id)
  )
);

drop policy if exists "handover_select" on public.handover_notes;
create policy "handover_select"
on public.handover_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    where patient.id = handover_notes.patient_id
      and public.can_read_ward(patient.ward_id)
  )
);

drop policy if exists "handover_insert" on public.handover_notes;
create policy "handover_insert"
on public.handover_notes
for insert
to authenticated
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = handover_notes.patient_id
      and public.can_write_patient_core_ward(patient.ward_id)
  )
);

drop policy if exists "handover_update" on public.handover_notes;
create policy "handover_update"
on public.handover_notes
for update
to authenticated
using (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = handover_notes.patient_id
      and public.can_write_patient_core_ward(patient.ward_id)
  )
)
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = handover_notes.patient_id
      and public.can_write_patient_core_ward(patient.ward_id)
  )
);

drop policy if exists "activity_select" on public.activity_logs;
create policy "activity_select"
on public.activity_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    where patient.id = activity_logs.patient_id
      and public.can_read_ward(patient.ward_id)
  )
);

drop policy if exists "activity_insert" on public.activity_logs;
create policy "activity_insert"
on public.activity_logs
for insert
to authenticated
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = activity_logs.patient_id
      and (
        public.can_write_patient_core_ward(patient.ward_id)
        or public.can_write_task_workflow_ward(patient.ward_id)
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
  public.current_profile_role() = 'admin'
  or public.can_read_ward(ward_id)
);

drop policy if exists "discharge_summaries_insert" on public.discharge_summaries;
create policy "discharge_summaries_insert"
on public.discharge_summaries
for insert
to authenticated
with check (
  public.can_manage_patients()
  and public.can_write_patient_core_ward(ward_id)
);

drop policy if exists "discharge_summaries_update" on public.discharge_summaries;
create policy "discharge_summaries_update"
on public.discharge_summaries
for update
to authenticated
using (
  public.can_manage_patients()
  and public.can_write_patient_core_ward(ward_id)
)
with check (
  public.can_manage_patients()
  and public.can_write_patient_core_ward(ward_id)
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
