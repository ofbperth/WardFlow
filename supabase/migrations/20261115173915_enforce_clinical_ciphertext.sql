-- Deploy only in the documented maintenance window with application keys ready.
-- NOT VALID allows existing rows to be backfilled, while all new writes are checked.
-- No key/decryption function is stored in Postgres, and existing RLS is unchanged.
set local lock_timeout = '5s';

do $migration$
declare
  entry record;
  protected_column text;
  constraint_name text;
  expression text;
  snapshot_expression text;
  field_name text;
begin
  for entry in select * from (values
    ('patients', array['hospital_number','admission_number','display_name','underlying_disease','diagnosis','allergy','code_status']),
    ('problems', array['title','problem_name','current_status_summary','current_status','evidence','treatment','reasoning','today_plan','key_data','plan','pending','watch_out']),
    ('problem_progress_entries', array['note','status_update','new_evidence','treatment_change','reasoning_update','today_plan']),
    ('ward_tasks', array['title','note','blocked_reason']),
    ('task_updates', array['note']),
    ('handover_notes', array['note','escalation_instruction']),
    ('discharge_summaries', array['primary_diagnosis','hospital_course','plan','home_medication']),
    ('activity_logs', array['before_json','after_json'])
  ) as protected(table_name, columns) loop
    foreach protected_column in array entry.columns loop
      -- Some legacy optional columns do not exist on every supported schema.
      if not exists (select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = entry.table_name and c.column_name = protected_column) then
        continue;
      end if;
      constraint_name := 'wf_enc_' || protected_column;
      if entry.table_name <> 'activity_logs' then
        expression := format('%I is null or (%I ~ %L)', protected_column, protected_column, '^wfphi:1:[A-Za-z0-9+/]+=*$');
      else
        -- transfer_patient logs a complete copy of the encrypted patient row.
        snapshot_expression := format(
          'entity_type = %L and (%I ->> %L) = entity_id::text and (%I ->> %L) like %L',
          'patient', protected_column, 'id', protected_column, 'display_name', 'wfphi:1:%%');
        foreach field_name in array array['hospital_number','admission_number','display_name','underlying_disease','diagnosis','allergy','code_status'] loop
          snapshot_expression := snapshot_expression || format(
            ' and (not (%I ? %L) or %I -> %L = ''null''::jsonb or (jsonb_typeof(%I -> %L) = ''string'' and (%I ->> %L) like %L))',
            protected_column, field_name, protected_column, field_name, protected_column, field_name, protected_column, field_name, 'wfphi:1:%%');
        end loop;
        expression := format(
          '%I is null or (case when jsonb_typeof(%I) = ''object'' then (((%I - %L) = ''{}''::jsonb and jsonb_typeof(%I -> %L) = ''string'' and (%I ->> %L) like %L) or (%s)) else false end) is true',
          protected_column, protected_column, protected_column, '__wardflow_encrypted', protected_column, '__wardflow_encrypted', protected_column, '__wardflow_encrypted', 'wfphi:1:%%', snapshot_expression);
      end if;
      if not exists (select 1 from pg_constraint where conrelid = format('public.%I', entry.table_name)::regclass and conname = constraint_name) then
        execute format('alter table public.%I add constraint %I check (%s) not valid', entry.table_name, constraint_name, expression);
      end if;
    end loop;
  end loop;
end;
$migration$;
