create or replace function public.can_write_patient_core_ward_uuid(target_ward uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_profile_role() in ('admin', 'resident')
    or (
      target_ward is not null
      and public.current_profile_ward_assignment() is not null
      and public.current_profile_ward_assignment() = target_ward
    )
$$;
