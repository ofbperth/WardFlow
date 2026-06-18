alter table public.wards
  add column if not exists location text,
  add column if not exists is_active boolean not null default true;

alter table public.profiles
  add column if not exists student_code text,
  add column if not exists academic_year text,
  add column if not exists is_active boolean not null default true;

do $$
declare
  ward_id_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
  into ward_id_type
  from pg_attribute attribute
  join pg_class class on class.oid = attribute.attrelid
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = 'wards'
    and attribute.attname = 'id'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if ward_id_type is null then
    raise exception 'Unable to resolve public.wards.id type';
  end if;

  execute format(
    $sql$
      create table if not exists public.student_ward_assignments (
        id text primary key default public.generate_prefixed_id('student-assignment'),
        student_id uuid not null references public.profiles(id) on delete cascade,
        ward_id %1$s not null references public.wards(id) on delete cascade,
        assigned_by_user_id uuid references public.profiles(id) on delete set null,
        assigned_at timestamptz not null default timezone('utc', now()),
        is_active boolean not null default true,
        created_at timestamptz not null default timezone('utc', now()),
        updated_at timestamptz not null default timezone('utc', now())
      )
    $sql$,
    ward_id_type
  );
end $$;

create index if not exists student_ward_assignments_active_ward_idx
  on public.student_ward_assignments (ward_id, assigned_at)
  where is_active = true;

create unique index if not exists student_ward_assignments_active_student_unique
  on public.student_ward_assignments (student_id)
  where is_active = true;

drop trigger if exists set_student_ward_assignments_updated_at on public.student_ward_assignments;
create trigger set_student_ward_assignments_updated_at
before update on public.student_ward_assignments
for each row execute function public.set_updated_at();

alter table public.student_ward_assignments enable row level security;

drop policy if exists "student_ward_assignments_admin_all" on public.student_ward_assignments;
create policy "student_ward_assignments_admin_all"
on public.student_ward_assignments
for all
to authenticated
using (public.current_profile_role() = 'admin')
with check (public.current_profile_role() = 'admin');

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
  conflicts jsonb := '[]'::jsonb;
  invalid_count integer := 0;
  impacted_student_ids uuid[];
begin
  if public.current_profile_role() <> 'admin' then
    raise exception 'Admin only';
  end if;

  if not exists (
    select 1
    from public.wards
    where id::text = target_ward_id
      and coalesce(is_active, true) = true
  ) then
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
    and assignment.ward_id::text <> target_ward_id;

  if conflicts <> '[]'::jsonb and not force_move then
    raise exception 'MOVE_REQUIRED:%', conflicts::text;
  end if;

  impacted_student_ids := array(
    select distinct impacted.student_id
    from (
      select assignment.student_id
      from public.student_ward_assignments assignment
      where assignment.is_active = true
        and (
          assignment.ward_id::text = target_ward_id
          or assignment.student_id = any(normalized_student_ids)
        )
      union
      select unnest(normalized_student_ids)
    ) impacted
  );

  update public.student_ward_assignments
  set is_active = false,
      updated_at = timezone('utc', now())
  where is_active = true
    and (
      ward_id::text = target_ward_id
      or student_id = any(normalized_student_ids)
    );

  if impacted_student_ids is not null and array_length(impacted_student_ids, 1) is not null then
    update public.profiles
    set ward_assignment = null,
        updated_at = timezone('utc', now())
    where role = 'student'
      and id = any(impacted_student_ids);
  end if;

  insert into public.student_ward_assignments (
    id,
    student_id,
    ward_id,
    assigned_by_user_id,
    assigned_at,
    is_active,
    created_at,
    updated_at
  )
  select
    public.generate_prefixed_id('student-assignment'),
    student_id,
    target_ward_id,
    auth.uid(),
    timezone('utc', now()),
    true,
    timezone('utc', now()),
    timezone('utc', now())
  from unnest(normalized_student_ids) as selected(student_id);

  if array_length(normalized_student_ids, 1) is not null then
    update public.profiles
    set ward_assignment = target_ward_id,
        updated_at = timezone('utc', now())
    where role = 'student'
      and id = any(normalized_student_ids);
  end if;

  return jsonb_build_object(
    'wardId', target_ward_id,
    'movedStudents', conflicts
  );
end;
$$;

create or replace function public.admin_remove_student_ward_assignment(
  target_assignment_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_assignment public.student_ward_assignments%rowtype;
begin
  if public.current_profile_role() <> 'admin' then
    raise exception 'Admin only';
  end if;

  select *
  into target_assignment
  from public.student_ward_assignments
  where id = target_assignment_id
    and is_active = true;

  if not found then
    raise exception 'Assignment not found';
  end if;

  update public.student_ward_assignments
  set is_active = false,
      updated_at = timezone('utc', now())
  where id = target_assignment_id;

  update public.profiles
  set ward_assignment = null,
      updated_at = timezone('utc', now())
  where id = target_assignment.student_id
    and ward_assignment::text = target_assignment.ward_id::text;

  return jsonb_build_object(
    'assignmentId', target_assignment_id,
    'studentId', target_assignment.student_id::text,
    'wardId', target_assignment.ward_id::text
  );
end;
$$;
