-- The live Ward primary key is UUID while this RPC accepts a text route parameter.
-- Resolve it once, then use the typed value for every write.
create or replace function public.admin_save_student_ward_assignments(
  target_ward_id text,
  target_student_ids uuid[],
  force_move boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_student_ids uuid[] := coalesce(target_student_ids, array[]::uuid[]);
  target_ward_uuid uuid;
  conflicts jsonb := '[]'::jsonb;
  invalid_count integer := 0;
  impacted_student_ids uuid[];
begin
  if public.current_profile_role() <> 'admin' then
    raise exception 'Admin only';
  end if;

  select id
  into target_ward_uuid
  from public.wards
  where id::text = target_ward_id
    and coalesce(is_active, true) = true;

  if target_ward_uuid is null then
    raise exception 'Ward not found';
  end if;

  select count(*)
  into invalid_count
  from (
    select candidate.student_id
    from unnest(normalized_student_ids) as candidate(student_id)
    left join public.profiles profile
      on profile.id = candidate.student_id
     and profile.role = 'student'
     and coalesce(profile.is_active, true) = true
    where profile.id is null
  ) invalid_students;

  if invalid_count > 0 then
    raise exception 'One or more selected students are unavailable';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'studentId', profile.id::text,
        'studentName', profile.name,
        'fromWardId', assignment.ward_id::text
      )
      order by profile.name
    ),
    '[]'::jsonb
  )
  into conflicts
  from public.student_ward_assignments assignment
  join public.profiles profile on profile.id = assignment.student_id
  where assignment.is_active = true
    and assignment.student_id = any(normalized_student_ids)
    and assignment.ward_id <> target_ward_uuid;

  if conflicts <> '[]'::jsonb and not force_move then
    raise exception 'MOVE_REQUIRED:%', conflicts::text;
  end if;

  impacted_student_ids := array(
    select distinct impacted.student_id
    from (
      select assignment.student_id
      from public.student_ward_assignments assignment
      where assignment.is_active = true
        and (assignment.ward_id = target_ward_uuid or assignment.student_id = any(normalized_student_ids))
      union
      select unnest(normalized_student_ids)
    ) impacted
  );

  update public.student_ward_assignments
  set is_active = false,
      updated_at = timezone('utc', now())
  where is_active = true
    and (ward_id = target_ward_uuid or student_id = any(normalized_student_ids));

  if array_length(impacted_student_ids, 1) is not null then
    update public.profiles
    set ward_assignment = null,
        updated_at = timezone('utc', now())
    where role = 'student'
      and id = any(impacted_student_ids);
  end if;

  insert into public.student_ward_assignments (
    id, student_id, ward_id, assigned_by_user_id, assigned_at, is_active, created_at, updated_at
  )
  select
    public.generate_prefixed_id('student-assignment'),
    student_id,
    target_ward_uuid,
    auth.uid(),
    timezone('utc', now()),
    true,
    timezone('utc', now()),
    timezone('utc', now())
  from unnest(normalized_student_ids) as selected(student_id);

  if array_length(normalized_student_ids, 1) is not null then
    update public.profiles
    set ward_assignment = target_ward_uuid,
        updated_at = timezone('utc', now())
    where role = 'student'
      and id = any(normalized_student_ids);
  end if;

  return jsonb_build_object(
    'wardId', target_ward_uuid::text,
    'movedStudents', conflicts
  );
end;
$$;

revoke all on function public.admin_save_student_ward_assignments(text, uuid[], boolean) from public;
revoke all on function public.admin_save_student_ward_assignments(text, uuid[], boolean) from anon;
grant execute on function public.admin_save_student_ward_assignments(text, uuid[], boolean) to authenticated;

revoke all on function public.admin_remove_student_ward_assignment(text) from public;
revoke all on function public.admin_remove_student_ward_assignment(text) from anon;
grant execute on function public.admin_remove_student_ward_assignment(text) to authenticated;
