create or replace function public.transfer_patient(
  target_patient_id text,
  target_ward_id text,
  target_bed text,
  expected_updated_at timestamptz default null
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_patient public.patients%rowtype;
  transferred_patient public.patients%rowtype;
  actor_name text;
  ward_id_type text;
begin
  select *
  into current_patient
  from public.patients
  where id::text = target_patient_id
  for update;

  if not found then
    raise exception 'Patient not found';
  end if;

  if current_patient.lifecycle <> 'active' then
    raise exception 'Only active patients can be transferred';
  end if;

  if current_patient.ward_id::text = target_ward_id then
    raise exception 'Choose a different destination ward';
  end if;

  if expected_updated_at is not null and current_patient.updated_at <> expected_updated_at then
    raise exception 'Conflict error: patient was updated by another session. Refresh and retry.';
  end if;

  if not exists (select 1 from public.wards where id::text = target_ward_id) then
    raise exception 'Destination ward not found';
  end if;

  select name into actor_name from public.profiles where id = auth.uid();

  select format_type(attribute.atttypid, attribute.atttypmod)
  into ward_id_type
  from pg_attribute attribute
  join pg_class relation on relation.oid = attribute.attrelid
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relname = 'patients'
    and attribute.attname = 'ward_id'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if ward_id_type is null then
    raise exception 'Unable to resolve patients.ward_id type';
  end if;

  execute format(
    'update public.patients set ward_id = $1::%s, bed = $2, updated_by_id = auth.uid() where id::text = $3 returning *',
    ward_id_type
  )
  into transferred_patient
  using target_ward_id, target_bed, target_patient_id;

  insert into public.activity_logs (
    patient_id,
    actor_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    before_json,
    after_json
  ) values (
    transferred_patient.id,
    auth.uid(),
    coalesce(actor_name, ''),
    'patient.transferred',
    'patient',
    transferred_patient.id,
    to_jsonb(current_patient),
    to_jsonb(transferred_patient)
  );

  return transferred_patient.id;
end;
$$;

revoke all on function public.transfer_patient(text, text, text, timestamptz) from public;
revoke all on function public.transfer_patient(text, text, text, timestamptz) from anon;
grant execute on function public.transfer_patient(text, text, text, timestamptz) to authenticated;
