-- Append immutable snapshots under a per-problem lock. A retry uses the same ID.
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
    order by date_time desc, created_at desc limit 1;
  if v_latest.id is distinct from p_expected_id or v_latest.updated_at is distinct from p_expected_updated_at then
    return jsonb_build_object('ok', false, 'conflict', true, 'message', 'มีการแก้ไขจากอีกหน้าต่าง กรุณาคัดลอกข้อความของคุณก่อนโหลดหน้าใหม่');
  end if;
  v_time := greatest(clock_timestamp(), coalesce(v_latest.date_time + interval '1 microsecond', clock_timestamp()));
  insert into public.problem_progress_entries(id, problem_id, date_time, author_id, note)
    values(p_request_id, p_problem_id, v_time, auth.uid(), p_note) returning * into v_saved;
  update public.problems set updated_by_id = auth.uid() where id = p_problem_id;
  update public.patients set updated_by_id = auth.uid() where id = p_patient_id;
  return jsonb_build_object('ok', true, 'snapshot', jsonb_build_object('id', v_saved.id, 'updatedAt', v_saved.updated_at, 'note', v_saved.note));
end;
$$;
revoke all on function public.autosave_problem_note(uuid, uuid, text, text, timestamptz, text) from public, anon;
grant execute on function public.autosave_problem_note(uuid, uuid, text, text, timestamptz, text) to authenticated;
