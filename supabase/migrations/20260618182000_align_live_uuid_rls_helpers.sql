create or replace function public.can_read_ward_uuid(target_ward uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() in ('admin', 'resident')
    or (
      target_ward is not null
      and public.current_profile_ward_assignment() is not null
      and public.current_profile_ward_assignment() = target_ward
    )
$$;

create or replace function public.can_write_task_workflow_ward_uuid(target_ward uuid)
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
      and public.current_profile_ward_assignment() is not null
      and public.current_profile_ward_assignment() = target_ward
    )
$$;

create or replace function public.can_write_patient_core_ward_uuid(target_ward uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() = 'admin'
    or (
      target_ward is not null
      and public.current_profile_ward_assignment() is not null
      and public.current_profile_ward_assignment() = target_ward
    )
$$;

drop policy if exists "patients_select" on public.patients;
create policy "patients_select"
on public.patients
for select
to authenticated
using (public.can_read_ward_uuid(ward_id));

drop policy if exists "patients_insert" on public.patients;
create policy "patients_insert"
on public.patients
for insert
to authenticated
with check (public.can_write_patient_core_ward_uuid(ward_id));

drop policy if exists "patients_update" on public.patients;
create policy "patients_update"
on public.patients
for update
to authenticated
using (public.can_write_patient_core_ward_uuid(ward_id))
with check (public.can_write_patient_core_ward_uuid(ward_id));

drop policy if exists "patients_delete" on public.patients;
create policy "patients_delete"
on public.patients
for delete
to authenticated
using (public.can_write_patient_core_ward_uuid(ward_id));

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
      and public.can_read_ward_uuid(patient.ward_id)
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
    where patient.id = problems.patient_id
      and public.can_write_patient_core_ward_uuid(patient.ward_id)
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
    where patient.id = problems.patient_id
      and public.can_write_patient_core_ward_uuid(patient.ward_id)
  )
)
with check (
  exists (
    select 1
    from public.patients patient
    where patient.id = problems.patient_id
      and public.can_write_patient_core_ward_uuid(patient.ward_id)
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
      and public.can_read_ward_uuid(patient.ward_id)
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
    where patient.id = ward_tasks.patient_id
      and public.can_write_task_workflow_ward_uuid(patient.ward_id)
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
    where patient.id = ward_tasks.patient_id
      and public.can_write_task_workflow_ward_uuid(patient.ward_id)
  )
)
with check (
  exists (
    select 1
    from public.patients patient
    where patient.id = ward_tasks.patient_id
      and public.can_write_task_workflow_ward_uuid(patient.ward_id)
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
    where patient.id = ward_tasks.patient_id
      and public.can_write_task_workflow_ward_uuid(patient.ward_id)
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
      and public.can_read_ward_uuid(patient.ward_id)
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
    where task.id = task_updates.task_id
      and public.can_write_task_workflow_ward_uuid(patient.ward_id)
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
      and public.can_read_ward_uuid(patient.ward_id)
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
    where patient.id = handover_notes.patient_id
      and public.can_write_patient_core_ward_uuid(patient.ward_id)
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
    where patient.id = handover_notes.patient_id
      and public.can_write_patient_core_ward_uuid(patient.ward_id)
  )
)
with check (
  exists (
    select 1
    from public.patients patient
    where patient.id = handover_notes.patient_id
      and public.can_write_patient_core_ward_uuid(patient.ward_id)
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
      and public.can_read_ward_uuid(patient.ward_id)
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
    where patient.id = activity_logs.patient_id
      and (
        public.can_write_patient_core_ward_uuid(patient.ward_id)
        or public.can_write_task_workflow_ward_uuid(patient.ward_id)
      )
  )
);

drop policy if exists "discharge_summaries_select" on public.discharge_summaries;
create policy "discharge_summaries_select"
on public.discharge_summaries
for select
to authenticated
using (
  public.current_profile_role() = 'admin'
  or public.can_read_ward_uuid(ward_id)
);

drop policy if exists "discharge_summaries_insert" on public.discharge_summaries;
create policy "discharge_summaries_insert"
on public.discharge_summaries
for insert
to authenticated
with check (public.can_write_patient_core_ward_uuid(ward_id));

drop policy if exists "discharge_summaries_update" on public.discharge_summaries;
create policy "discharge_summaries_update"
on public.discharge_summaries
for update
to authenticated
using (public.can_write_patient_core_ward_uuid(ward_id))
with check (public.can_write_patient_core_ward_uuid(ward_id));
