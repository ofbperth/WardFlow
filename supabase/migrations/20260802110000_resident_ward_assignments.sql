-- Resident access is many-to-many. profiles.ward_assignment remains the Student-only assignment.
create table if not exists public.resident_ward_assignments (
  id text primary key default public.generate_prefixed_id('resident-assignment'),
  resident_id uuid not null references public.profiles(id) on delete cascade,
  ward_id uuid not null references public.wards(id) on delete cascade,
  assigned_by_user_id uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint resident_ward_assignments_resident_ward_unique unique (resident_id, ward_id)
);

create index if not exists resident_ward_assignments_ward_idx on public.resident_ward_assignments (ward_id, resident_id);

drop trigger if exists set_resident_ward_assignments_updated_at on public.resident_ward_assignments;
create trigger set_resident_ward_assignments_updated_at before update on public.resident_ward_assignments
for each row execute function public.set_updated_at();

-- Preserve every existing Resident assignment before removing the legacy single-value field.
insert into public.resident_ward_assignments (resident_id, ward_id, assigned_at, created_at, updated_at)
select id, ward_assignment, coalesce(updated_at, timezone('utc', now())), coalesce(created_at, timezone('utc', now())), timezone('utc', now())
from public.profiles
where role = 'resident' and ward_assignment is not null
on conflict (resident_id, ward_id) do nothing;

update public.profiles set ward_assignment = null where role = 'resident' and ward_assignment is not null;

alter table public.resident_ward_assignments enable row level security;
drop policy if exists "resident_ward_assignments_admin_all" on public.resident_ward_assignments;
create policy "resident_ward_assignments_admin_all" on public.resident_ward_assignments
for all to authenticated using (public.current_profile_role() = 'admin') with check (public.current_profile_role() = 'admin');
drop policy if exists "resident_ward_assignments_self_select" on public.resident_ward_assignments;
create policy "resident_ward_assignments_self_select" on public.resident_ward_assignments
for select to authenticated using (resident_id = auth.uid());

-- Let clinical pickers resolve only colleagues that share the viewer's Ward scope.
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
    and profiles.role in ('admin', 'resident')
  )
);

create or replace function public.resident_has_ward_access(target_ward uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.resident_ward_assignments where resident_id = auth.uid() and ward_id = target_ward)
$$;

create or replace function public.can_read_ward_uuid(target_ward uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_profile_role() = 'admin'
    or (public.current_profile_role() = 'resident' and public.resident_has_ward_access(target_ward))
    or (public.current_profile_role() = 'student' and public.current_profile_ward_assignment() = target_ward)
$$;

create or replace function public.can_write_patient_core_ward_uuid(target_ward uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_profile_role() = 'admin'
    or (public.current_profile_role() = 'resident' and public.resident_has_ward_access(target_ward))
$$;

create or replace function public.can_write_task_workflow_ward_uuid(target_ward uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.current_profile_role() = 'admin'
    or (public.current_profile_role() = 'resident' and public.resident_has_ward_access(target_ward))
    or (public.current_profile_role() = 'student' and public.current_profile_ward_assignment() = target_ward)
$$;

create or replace function public.admin_save_resident_ward_assignments(target_ward_id uuid, target_resident_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  normalized_resident_ids uuid[] := coalesce(target_resident_ids, array[]::uuid[]);
  invalid_count integer;
begin
  if public.current_profile_role() <> 'admin' then raise exception 'Admin only'; end if;
  if cardinality(normalized_resident_ids) <> cardinality(array(select distinct unnest(normalized_resident_ids))) then
    raise exception 'Duplicate resident selection is not allowed';
  end if;
  if not exists (select 1 from public.wards where id = target_ward_id and coalesce(is_active, true)) then raise exception 'Ward not found'; end if;
  select count(*) into invalid_count from unnest(normalized_resident_ids) candidate(id)
  left join public.profiles profile on profile.id = candidate.id and profile.role = 'resident' and coalesce(profile.is_active, true)
  where profile.id is null;
  if invalid_count > 0 then raise exception 'One or more selected residents are unavailable'; end if;
  delete from public.resident_ward_assignments where ward_id = target_ward_id;
  insert into public.resident_ward_assignments (resident_id, ward_id, assigned_by_user_id)
  select id, target_ward_id, auth.uid() from unnest(normalized_resident_ids) selected(id)
  on conflict (resident_id, ward_id) do nothing;
  return jsonb_build_object('wardId', target_ward_id::text, 'residentIds', normalized_resident_ids);
end;
$$;
