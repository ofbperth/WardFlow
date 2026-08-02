create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.resident_has_ward_access(target_ward text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.resident_ward_assignments
    where resident_id = auth.uid()
      and ward_id::text = target_ward
  )
$$;

revoke all on function private.resident_has_ward_access(text) from public;
revoke all on function private.resident_has_ward_access(text) from anon;
grant execute on function private.resident_has_ward_access(text) to authenticated;

drop policy if exists "resident_ward_assignments_shared_ward_select" on public.resident_ward_assignments;
create policy "resident_ward_assignments_shared_ward_select"
on public.resident_ward_assignments
for select to authenticated
using (
  (public.current_profile_role() = 'resident' and private.resident_has_ward_access(ward_id::text))
  or (public.current_profile_role() = 'student' and ward_id::text = public.current_profile_ward_assignment()::text)
);

drop policy if exists "profiles_same_ward_or_admin_select" on public.profiles;
create policy "profiles_same_ward_or_admin_select"
on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.current_profile_role() = 'admin'
  or profiles.role = 'admin'
  or (
    profiles.role = 'student'
    and exists (
      select 1
      from public.resident_ward_assignments viewer_assignment
      where viewer_assignment.resident_id = auth.uid()
        and viewer_assignment.ward_id = profiles.ward_assignment
    )
  )
  or (
    profiles.role = 'resident'
    and exists (
      select 1
      from public.resident_ward_assignments viewer_assignment
      join public.resident_ward_assignments profile_assignment
        on profile_assignment.ward_id = viewer_assignment.ward_id
      where viewer_assignment.resident_id = auth.uid()
        and profile_assignment.resident_id = profiles.id
    )
  )
  or (
    public.current_profile_role() = 'student'
    and profiles.role = 'resident'
    and exists (
      select 1
      from public.resident_ward_assignments profile_assignment
      where profile_assignment.resident_id = profiles.id
        and profile_assignment.ward_id::text = public.current_profile_ward_assignment()::text
    )
  )
);

create or replace function public.can_read_ward_uuid(target_ward uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select public.current_profile_role() = 'admin'
    or (public.current_profile_role() = 'resident' and private.resident_has_ward_access(target_ward::text))
    or (public.current_profile_role() = 'student' and public.current_profile_ward_assignment() = target_ward)
$$;

create or replace function public.can_write_patient_core_ward_uuid(target_ward uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select public.current_profile_role() = 'admin'
    or (public.current_profile_role() = 'resident' and private.resident_has_ward_access(target_ward::text))
$$;

create or replace function public.can_write_task_workflow_ward_uuid(target_ward uuid)
returns boolean language sql stable security definer set search_path = public, private as $$
  select public.current_profile_role() = 'admin'
    or (public.current_profile_role() = 'resident' and private.resident_has_ward_access(target_ward::text))
    or (public.current_profile_role() = 'student' and public.current_profile_ward_assignment() = target_ward)
$$;

drop function if exists public.resident_has_ward_access(text);

revoke all on function public.admin_save_resident_ward_assignments(text, uuid[]) from public;
revoke all on function public.admin_save_resident_ward_assignments(text, uuid[]) from anon;
grant execute on function public.admin_save_resident_ward_assignments(text, uuid[]) to authenticated;
