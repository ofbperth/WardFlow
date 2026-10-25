-- Only older progress note rows may be removed. All current rows, including
-- intentionally blank notes and legacy fields, must remain byte-for-byte equal.
-- This migration must run as one transaction (Supabase migrations do so).
set local lock_timeout = '5s';

do $guard$
declare t record; before_hash text; after_hash text;
begin
  -- Freeze public data for a short verification window, including concurrent autosaves.
  for t in select tablename from pg_tables where schemaname='public' order by tablename loop
    execute format('lock table public.%I in share row exclusive mode',t.tablename);
  end loop;
  if exists(select 1 from pg_constraint where contype='f' and confrelid='public.problem_progress_entries'::regclass) then
    raise exception 'Unexpected reference to progress note rows; abort rather than affect related data';
  end if;
  if exists(select 1 from pg_trigger where tgrelid='public.problem_progress_entries'::regclass and not tgisinternal and (tgtype & 8) <> 0) then
    raise exception 'Unexpected DELETE trigger; abort rather than affect related data';
  end if;
  if exists (
    select 1 from (
      select problem_id,dense_rank() over(partition by problem_id order by date_time desc,updated_at desc) position
      from public.problem_progress_entries
    ) ranked where position=1 group by problem_id having count(*)>1
  ) then raise exception 'Ambiguous current note; abort rather than choose a version'; end if;

  create temporary table retained_progress_notes on commit drop as
    select distinct on(problem_id) * from public.problem_progress_entries
    order by problem_id,date_time desc,updated_at desc,created_at desc,id desc;
  create temporary table untouched_table_hashes(table_name text, fingerprint text) on commit drop;
  for t in select tablename from pg_tables where schemaname='public' and tablename <> 'problem_progress_entries' order by tablename loop
    execute format('select md5(coalesce(string_agg(row_hash, %L order by row_hash), %L)) from (select md5(to_jsonb(r)::text) row_hash from public.%I r) hashed','','',t.tablename) into before_hash;
    insert into untouched_table_hashes values(t.tablename,before_hash);
  end loop;

  delete from public.problem_progress_entries e
  where not exists(select 1 from retained_progress_notes kept where kept.id=e.id);

  if exists(select * from retained_progress_notes except select * from public.problem_progress_entries)
    or exists(select * from public.problem_progress_entries except select * from retained_progress_notes) then
    raise exception 'Current notes changed; rolling back ALL deletions';
  end if;
  for t in select * from untouched_table_hashes loop
    execute format('select md5(coalesce(string_agg(row_hash, %L order by row_hash), %L)) from (select md5(to_jsonb(r)::text) row_hash from public.%I r) hashed','','',t.table_name) into after_hash;
    if after_hash is distinct from t.fingerprint then
      raise exception 'Data changed in %, rolling back ALL deletions',t.table_name;
    end if;
  end loop;
end $guard$;

alter table public.problem_progress_entries
  add constraint problem_progress_entries_one_current_note unique(problem_id);

-- Keep a single current note per problem under the same lock and RLS.
-- The current row ID is the last successful request token; stale retries conflict.
create or replace function public.autosave_problem_note(
  p_patient_id uuid, p_problem_id uuid, p_request_id text,
  p_expected_id text, p_expected_updated_at timestamptz, p_note text
) returns jsonb
language plpgsql security invoker set search_path = public
as $$
declare
  v_problem public.problems%rowtype;
  v_patient public.patients%rowtype;
  v_latest public.problem_progress_entries%rowtype;
  v_saved public.problem_progress_entries%rowtype;
  v_time timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_problem from public.problems where id = p_problem_id for update;
  if not found or v_problem.patient_id <> p_patient_id then raise exception 'Problem not found'; end if;
  select * into v_patient from public.patients where id = p_patient_id for share;
  if not found or not public.can_write_patient_core_ward_uuid(v_patient.ward_id) then
    raise exception 'Ward access denied';
  end if;
  if v_patient.lifecycle <> 'active' then raise exception 'Patient is discharged'; end if;
  if p_note is null or p_request_id is null or length(p_request_id) > 100 then
    raise exception 'Invalid progress note';
  end if;
  select * into v_saved from public.problem_progress_entries where id = p_request_id;
  if found then
    if v_saved.problem_id <> p_problem_id or v_saved.author_id <> auth.uid() or v_saved.note is distinct from p_note then
      raise exception 'Invalid retry';
    end if;
    return jsonb_build_object('ok', true, 'snapshot', jsonb_build_object('id', v_saved.id, 'updatedAt', v_saved.updated_at, 'note', v_saved.note));
  end if;
  select * into v_latest from public.problem_progress_entries where problem_id = p_problem_id
    order by date_time desc, updated_at desc, created_at desc, id desc limit 1 for update;
  if v_latest.id is distinct from p_expected_id or v_latest.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'conflict', true, 'message', 'มีการแก้ไขจากอีกหน้าต่าง กรุณาคัดลอกข้อความของคุณก่อนโหลดหน้าใหม่');
  end if;
  v_time := greatest(clock_timestamp(), coalesce(v_latest.date_time + interval '1 microsecond', clock_timestamp()));
  if v_latest.id is null then
    insert into public.problem_progress_entries(id, problem_id, date_time, author_id, note)
      values(p_request_id, p_problem_id, v_time, auth.uid(), p_note) returning * into v_saved;
  else
    update public.problem_progress_entries
      set id = p_request_id, date_time = v_time, author_id = auth.uid(), note = p_note
      where id = v_latest.id returning * into v_saved;
    if not found then raise exception 'Note update denied'; end if;
  end if;
  update public.problems set updated_by_id = auth.uid() where id = p_problem_id;
  update public.patients set updated_by_id = auth.uid() where id = p_patient_id;
  return jsonb_build_object('ok', true, 'snapshot', jsonb_build_object('id', v_saved.id, 'updatedAt', v_saved.updated_at, 'note', v_saved.note));
end;
$$;
revoke all on function public.autosave_problem_note(uuid, uuid, text, text, timestamptz, text) from public, anon;
grant execute on function public.autosave_problem_note(uuid, uuid, text, text, timestamptz, text) to authenticated;
