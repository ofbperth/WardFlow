create or replace function public.current_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.current_profile_ward_assignment()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ward_assignment
  from public.profiles
  where id = auth.uid()
$$;

drop policy if exists "profiles_visible_scope_select" on public.profiles;
drop policy if exists "profiles_same_ward_or_admin_select" on public.profiles;

create policy "profiles_visible_scope_select"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_profile_role() in ('admin', 'resident')
  or (
    public.current_profile_ward_assignment() is not null
    and public.current_profile_ward_assignment() = profiles.ward_assignment
  )
);
