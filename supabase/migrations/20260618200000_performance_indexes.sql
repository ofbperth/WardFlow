create index if not exists patients_ward_id_lifecycle_idx
  on public.patients (ward_id, lifecycle);

create index if not exists ward_tasks_patient_id_status_updated_at_idx
  on public.ward_tasks (patient_id, status, updated_at desc);

create index if not exists problems_patient_id_sort_order_idx
  on public.problems (patient_id, sort_order);

create index if not exists handover_notes_patient_id_idx
  on public.handover_notes (patient_id);

create index if not exists task_updates_task_id_created_at_idx
  on public.task_updates (task_id, created_at desc);

create index if not exists profiles_ward_assignment_role_idx
  on public.profiles (ward_assignment, role);
