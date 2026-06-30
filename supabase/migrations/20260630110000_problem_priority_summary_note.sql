do $$
begin
  if not exists (select 1 from pg_type where typname = 'problem_priority') then
    create type public.problem_priority as enum (
      'ACTIVE_UNSTABLE',
      'ACTIVE_STABLE',
      'MONITORING',
      'RESOLVED_CHRONIC'
    );
  end if;
end
$$;

alter table public.problems
  add column if not exists priority public.problem_priority not null default 'ACTIVE_STABLE',
  add column if not exists current_status text,
  add column if not exists evidence text,
  add column if not exists treatment text,
  add column if not exists reasoning text,
  add column if not exists today_plan text;

update public.problems
set
  priority = case
    when status = 'worsening' then 'ACTIVE_UNSTABLE'::public.problem_priority
    when status = 'active' then 'ACTIVE_STABLE'::public.problem_priority
    when status = 'improving' then 'MONITORING'::public.problem_priority
    else 'RESOLVED_CHRONIC'::public.problem_priority
  end,
  current_status = coalesce(current_status, key_data),
  evidence = coalesce(evidence, key_data),
  today_plan = coalesce(today_plan, plan)
where
  current_status is null
  or evidence is null
  or today_plan is null
  or priority is null;

do $$
declare
  problem_id_type text;
begin
  select format_type(attribute.atttypid, attribute.atttypmod)
  into problem_id_type
  from pg_attribute attribute
  join pg_class class on class.oid = attribute.attrelid
  join pg_namespace namespace on namespace.oid = class.relnamespace
  where namespace.nspname = 'public'
    and class.relname = 'problems'
    and attribute.attname = 'id'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if problem_id_type is null then
    raise exception 'public.problems.id type could not be resolved';
  end if;

  execute format(
    'alter table public.ward_tasks add column if not exists problem_id %s',
    problem_id_type
  );
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ward_tasks_problem_id_fkey'
  ) then
    alter table public.ward_tasks
      add constraint ward_tasks_problem_id_fkey
      foreign key (problem_id)
      references public.problems(id)
      on delete set null;
  end if;
end
$$;

create index if not exists problems_priority_patient_sort_idx
  on public.problems (priority, patient_id, sort_order);

create index if not exists ward_tasks_patient_problem_status_idx
  on public.ward_tasks (patient_id, problem_id, status);
