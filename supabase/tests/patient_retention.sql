-- Run with supabase db query --linked --file supabase/tests/patient_retention.sql
-- Synthetic fixtures and every deletion are rolled back, including on failure.
begin;
do $$
declare
  ward public.wards.id%type;
  expired public.patients.id%type;
  boundary public.patients.id%type;
  recent public.patients.id%type;
  readmitted public.patients.id%type;
  undated public.patients.id%type;
  problem public.problems.id%type;
  task public.ward_tasks.id%type;
  expected bigint;
  actual bigint;
  logged bigint;
begin
  select id into strict ward from public.wards limit 1;
  select count(*) into expected from public.patients
    where lifecycle = 'discharged' and discharged_at <= now() - interval '720 hours';
  insert into public.patients (ward_id, bed, display_name, diagnosis, lifecycle, discharged_at)
    values (ward, gen_random_uuid()::text, 'Retention test', 'Synthetic', 'discharged', now()-interval '721 hours') returning id into expired;
  insert into public.patients (ward_id, bed, display_name, diagnosis, lifecycle, discharged_at)
    values (ward, gen_random_uuid()::text, 'Retention test', 'Synthetic', 'discharged', now()-interval '720 hours') returning id into boundary;
  insert into public.patients (ward_id, bed, display_name, diagnosis, lifecycle, discharged_at)
    values (ward, gen_random_uuid()::text, 'Retention test', 'Synthetic', 'discharged', now()-interval '720 hours'+interval '1 second') returning id into recent;
  insert into public.patients (ward_id, bed, display_name, diagnosis, lifecycle, discharged_at)
    values (ward, gen_random_uuid()::text, 'Retention test', 'Synthetic', 'active', now()-interval '721 hours') returning id into readmitted;
  insert into public.patients (ward_id, bed, display_name, diagnosis, lifecycle)
    values (ward, gen_random_uuid()::text, 'Retention test', 'Synthetic', 'discharged') returning id into undated;
  insert into public.problems (patient_id, title, problem_name)
    values (expired, 'Synthetic', 'Synthetic') returning id into problem;
  insert into public.problem_progress_entries (problem_id, note) values (problem, 'Synthetic');
  insert into public.ward_tasks (patient_id, problem_id, title)
    values (expired, problem, 'Synthetic') returning id into task;
  insert into public.task_updates (task_id, note) values (task, 'Synthetic');
  insert into public.handover_notes (patient_id, note) values (expired, 'Synthetic');
  insert into public.discharge_summaries (patient_id, admit_date, discharge_date, primary_diagnosis)
    values (expired, now()-interval '800 hours', now()-interval '721 hours', 'Synthetic');
  insert into public.activity_logs (patient_id, action, entity_type, entity_id)
    values (expired, 'retention.test', 'patient', expired);

  actual := wardflow_private.purge_discharged_patients();
  if actual <> expected + 2 then raise exception 'Wrong deletion count: %', actual; end if;
  if exists (select 1 from public.patients where id in (expired, boundary)) then
    raise exception 'Expired/boundary patient survived'; end if;
  if (select count(*) from public.patients where id in (recent, readmitted, undated)) <> 3 then
    raise exception 'Protected patient deleted'; end if;
  if exists (select 1 from public.problems where patient_id = expired)
    or exists (select 1 from public.problem_progress_entries where problem_id = problem)
    or exists (select 1 from public.ward_tasks where patient_id = expired)
    or exists (select 1 from public.task_updates where task_id = task)
    or exists (select 1 from public.handover_notes where patient_id = expired)
    or exists (select 1 from public.discharge_summaries where patient_id = expired)
    or exists (select 1 from public.activity_logs where patient_id = expired)
    then raise exception 'Clinical child data survived'; end if;
  select deleted_patients into logged from wardflow_private.patient_cleanup_runs order by id desc limit 1;
  if logged <> actual then raise exception 'Count log mismatch'; end if;
  if wardflow_private.purge_discharged_patients() <> 0 then raise exception 'Repeat run not idempotent'; end if;
  if has_function_privilege('anon', 'wardflow_private.purge_discharged_patients()', 'EXECUTE')
    or has_function_privilege('authenticated', 'wardflow_private.purge_discharged_patients()', 'EXECUTE')
    or has_function_privilege('service_role', 'wardflow_private.purge_discharged_patients()', 'EXECUTE')
    then raise exception 'API role can execute cleanup'; end if;
end;
$$;
rollback;
select 'PASS: boundary, recent, active, null date, all cascades, count log, repeat run and API permissions; rolled back' as result;
