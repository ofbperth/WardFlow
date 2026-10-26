-- Retain previous status/reason in activity history before resetting legacy work.
insert into public.activity_logs
  (patient_id, actor_name, action, entity_type, entity_id, before_json, after_json)
select patient_id, 'WardFlow status migration', 'task.status_changed', 'ward_task', id,
  jsonb_build_object('status', status, 'blocked_reason', blocked_reason),
  jsonb_build_object('status', 'not_started', 'blocked_reason', null)
from public.ward_tasks
where status = 'blocked' or (status = 'in_progress' and type not in ('lab', 'imaging'));

update public.ward_tasks
set status = 'not_started', blocked_reason = null, updated_at = now()
where status = 'blocked' or (status = 'in_progress' and type not in ('lab', 'imaging'));

alter table public.ward_tasks
  add constraint ward_tasks_status_by_type_check
  check (status in ('not_started', 'done') or (status = 'in_progress' and type in ('lab', 'imaging')));
