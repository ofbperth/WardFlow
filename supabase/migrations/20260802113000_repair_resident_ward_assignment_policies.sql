-- Applies the Resident-Ward policy/RPC repair to databases that recorded the first migration before this fix.
create or replace function public.resident_has_ward_access(target_ward text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.resident_ward_assignments
    where resident_id = auth.uid() and ward_id::text = target_ward
  )
$$;

alter table public.resident_ward_assignments enable row level security;
drop policy if exists "resident_ward_assignments_admin_all" on public.resident_ward_assignments;
create policy "resident_ward_assignments_admin_all" on public.resident_ward_assignments
for all to authenticated using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');
drop policy if exists "resident_ward_assignments_self_select" on public.resident_ward_assignments;
create policy "resident_ward_assignments_self_select" on public.resident_ward_assignments
for select to authenticated using (resident_id = auth.uid());
drop policy if exists "resident_ward_assignments_shared_ward_select" on public.resident_ward_assignments;
create policy "resident_ward_assignments_shared_ward_select" on public.resident_ward_assignments
for select to authenticated using (
  (public.current_profile_role() = 'resident' and public.resident_has_ward_access(resident_ward_assignments.ward_id::text))
  or (public.current_profile_role() = 'student' and resident_ward_assignments.ward_id::text = public.current_profile_ward_assignment()::text)
);

drop policy if exists "profiles_same_ward_or_admin_select" on public.profiles;
create policy "profiles_same_ward_or_admin_select" on public.profiles
for select to authenticated using (
  id = auth.uid()
  or public.current_profile_role() = 'admin'
  or profiles.role = 'admin'
  or (
    profiles.role = 'student'
    and exists (
      select 1 from public.resident_ward_assignments viewer_assignment
      where viewer_assignment.resident_id = auth.uid()
        and viewer_assignment.ward_id = profiles.ward_assignment
    )
  )
  or (
    profiles.role = 'resident'
    and exists (
      select 1 from public.resident_ward_assignments viewer_assignment
      join public.resident_ward_assignments profile_assignment on profile_assignment.ward_id = viewer_assignment.ward_id
      where viewer_assignment.resident_id = auth.uid() and profile_assignment.resident_id = profiles.id
    )
  )
  or (public.current_profile_role() = 'student' and profiles.role = 'admin')
  or (
    public.current_profile_role() = 'student' and profiles.role = 'resident'
    and exists (
      select 1 from public.resident_ward_assignments profile_assignment
      where profile_assignment.resident_id = profiles.id
        and profile_assignment.ward_id::text = public.current_profile_ward_assignment()::text
    )
  )
);

create or replace function public.can_read_ward_uuid(target_ward uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_profile_role() = 'admin'
    or (public.current_profile_role() = 'resident' and public.resident_has_ward_access(target_ward::text))
    or (public.current_profile_role() = 'student' and public.current_profile_ward_assignment() = target_ward)
$$;

create or replace function public.can_write_patient_core_ward_uuid(target_ward uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_profile_role() = 'admin'
    or (public.current_profile_role() = 'resident' and public.resident_has_ward_access(target_ward::text))
$$;

create or replace function public.can_write_task_workflow_ward_uuid(target_ward uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_profile_role() = 'admin'
    or (public.current_profile_role() = 'resident' and public.resident_has_ward_access(target_ward::text))
    or (public.current_profile_role() = 'student' and public.current_profile_ward_assignment() = target_ward)
$$;

drop function if exists public.admin_save_resident_ward_assignments(uuid, uuid[]);
create or replace function public.admin_save_resident_ward_assignments(target_ward_id text, target_resident_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  normalized_resident_ids uuid[] := coalesce(target_resident_ids, array[]::uuid[]);
  invalid_count integer;
begin
  if public.current_profile_role() <> 'admin' then raise exception 'Admin only'; end if;
  if cardinality(normalized_resident_ids) <> cardinality(array(select distinct unnest(normalized_resident_ids))) then
    raise exception 'Duplicate resident selection is not allowed';
  end if;
  if not exists (select 1 from public.wards where id::text = target_ward_id and coalesce(is_active, true)) then raise exception 'Ward not found'; end if;
  select count(*) into invalid_count from unnest(normalized_resident_ids) candidate(id)
  left join public.profiles profile on profile.id = candidate.id and profile.role = 'resident' and coalesce(profile.is_active, true)
  where profile.id is null;
  if invalid_count > 0 then raise exception 'One or more selected residents are unavailable'; end if;
  delete from public.resident_ward_assignments where ward_id::text = target_ward_id;
  insert into public.resident_ward_assignments (resident_id, ward_id, assigned_by_user_id)
  select selected.id, ward.id, auth.uid()
  from unnest(normalized_resident_ids) selected(id)
  join public.wards ward on ward.id::text = target_ward_id
  on conflict (resident_id, ward_id) do nothing;
  return jsonb_build_object('wardId', target_ward_id, 'residentIds', normalized_resident_ids);
end;
$$;
