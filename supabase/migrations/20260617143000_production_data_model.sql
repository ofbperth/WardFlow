create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'patient_precaution') then
    create type public.patient_precaution as enum ('none', 'contact', 'droplet', 'airborne');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_priority_v2') then
    create type public.task_priority_v2 as enum ('normal', 'urgent', 'emergency');
  end if;
  if not exists (select 1 from pg_type where typname = 'task_status_v2') then
    create type public.task_status_v2 as enum ('not_started', 'in_progress', 'done', 'blocked');
  end if;
end $$;

create or replace function public.generate_prefixed_id(prefix text)
returns text
language sql
as $$
  select prefix || '-' || gen_random_uuid()::text
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
$$;

create or replace function public.current_user_ward()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ward_assignment
  from public.profiles
  where id = auth.uid()
$$;

create or replace function public.can_access_ward(target_ward text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or (
      target_ward is not null
      and exists (
        select 1
        from public.profiles
        where id = auth.uid()
          and ward_assignment = target_ward
      )
    )
$$;

create or replace function public.can_manage_patients()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'resident')
  )
$$;

create or replace function public.can_write_clinical_entries()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'resident', 'student')
  )
$$;

drop policy if exists "profiles_self" on public.profiles;
drop policy if exists "wards_select" on public.wards;
drop policy if exists "task_templates_select" on public.task_templates;
drop policy if exists "patients_same_ward" on public.patients;
drop policy if exists "problems_same_ward" on public.problems;
drop policy if exists "tasks_same_ward" on public.ward_tasks;
drop policy if exists "handover_same_ward" on public.handover_notes;
drop policy if exists "activity_same_ward" on public.activity_logs;

alter table public.wards
  alter column id drop default,
  alter column id type text using id::text;

alter table public.profiles
  drop constraint if exists profiles_ward_assignment_fkey,
  alter column ward_assignment type text using ward_assignment::text;

alter table public.patients
  drop constraint if exists patients_pkey,
  drop constraint if exists patients_ward_id_fkey,
  drop constraint if exists patients_responsible_doctor_id_fkey,
  drop constraint if exists patients_updated_by_id_fkey,
  alter column id drop default,
  alter column id type text using id::text,
  alter column ward_id type text using ward_id::text,
  alter column responsible_doctor_id type uuid using responsible_doctor_id,
  alter column updated_by_id type uuid using updated_by_id;

alter table public.problems
  drop constraint if exists problems_pkey,
  drop constraint if exists problems_patient_id_fkey,
  drop constraint if exists problems_updated_by_id_fkey,
  alter column id drop default,
  alter column id type text using id::text,
  alter column patient_id type text using patient_id::text,
  alter column updated_by_id type uuid using updated_by_id;

alter table public.ward_tasks
  drop constraint if exists ward_tasks_pkey,
  drop constraint if exists ward_tasks_patient_id_fkey,
  drop constraint if exists ward_tasks_owner_id_fkey,
  drop constraint if exists ward_tasks_updated_by_id_fkey,
  alter column id drop default,
  alter column id type text using id::text,
  alter column patient_id type text using patient_id::text,
  alter column owner_id type uuid using owner_id,
  alter column updated_by_id type uuid using updated_by_id;

alter table public.handover_notes
  drop constraint if exists handover_notes_pkey,
  drop constraint if exists handover_notes_patient_id_fkey,
  drop constraint if exists handover_notes_updated_by_id_fkey,
  alter column id drop default,
  alter column id type text using id::text,
  alter column patient_id type text using patient_id::text,
  alter column updated_by_id type uuid using updated_by_id;

alter table public.activity_logs
  drop constraint if exists activity_logs_pkey,
  drop constraint if exists activity_logs_patient_id_fkey,
  drop constraint if exists activity_logs_actor_id_fkey,
  alter column id drop default,
  alter column id type text using id::text,
  alter column patient_id type text using patient_id::text,
  alter column actor_id type uuid using actor_id,
  alter column entity_id type text using entity_id::text;

alter table public.task_templates
  drop constraint if exists task_templates_pkey,
  alter column id drop default,
  alter column id type text using id::text;

alter table public.wards
  add constraint wards_pkey primary key (id);

alter table public.patients
  add constraint patients_pkey primary key (id);

alter table public.problems
  add constraint problems_pkey primary key (id);

alter table public.ward_tasks
  add constraint ward_tasks_pkey primary key (id);

alter table public.handover_notes
  add constraint handover_notes_pkey primary key (id);

alter table public.activity_logs
  add constraint activity_logs_pkey primary key (id);

alter table public.task_templates
  add constraint task_templates_pkey primary key (id);

alter table public.profiles
  add constraint profiles_ward_assignment_fkey
    foreign key (ward_assignment) references public.wards(id) on delete set null;

alter table public.patients
  add constraint patients_responsible_doctor_id_fkey
    foreign key (responsible_doctor_id) references public.profiles(id) on delete set null,
  add constraint patients_updated_by_id_fkey
    foreign key (updated_by_id) references public.profiles(id) on delete set null;

alter table public.problems
  add constraint problems_patient_id_fkey
    foreign key (patient_id) references public.patients(id) on delete cascade,
  add constraint problems_updated_by_id_fkey
    foreign key (updated_by_id) references public.profiles(id) on delete set null;

alter table public.ward_tasks
  add constraint ward_tasks_patient_id_fkey
    foreign key (patient_id) references public.patients(id) on delete cascade,
  add constraint ward_tasks_owner_id_fkey
    foreign key (owner_id) references public.profiles(id) on delete set null,
  add constraint ward_tasks_updated_by_id_fkey
    foreign key (updated_by_id) references public.profiles(id) on delete set null;

alter table public.handover_notes
  add constraint handover_notes_patient_id_fkey
    foreign key (patient_id) references public.patients(id) on delete cascade,
  add constraint handover_notes_updated_by_id_fkey
    foreign key (updated_by_id) references public.profiles(id) on delete set null;

alter table public.activity_logs
  add constraint activity_logs_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete set null;

alter table public.task_templates
  alter column id set default public.generate_prefixed_id('template');

alter table public.wards
  alter column id set default public.generate_prefixed_id('ward');

alter table public.patients
  alter column id set default public.generate_prefixed_id('patient');

alter table public.problems
  alter column id set default public.generate_prefixed_id('problem');

alter table public.ward_tasks
  alter column id set default public.generate_prefixed_id('task');

alter table public.handover_notes
  alter column id set default public.generate_prefixed_id('handover');

alter table public.activity_logs
  alter column id set default public.generate_prefixed_id('activity');

alter table public.patients
  add column if not exists precaution public.patient_precaution,
  alter column ward_id drop not null;

update public.patients
set precaution = case
  when isolation_flag is true then 'contact'::public.patient_precaution
  else 'none'::public.patient_precaution
end
where precaution is null;

alter table public.patients
  alter column precaution set default 'none',
  alter column precaution set not null;

alter table public.patients
  drop column if exists isolation_flag;

alter table public.activity_logs
  add column if not exists actor_name text;

update public.activity_logs
set actor_name = coalesce(actor_name, '')
where actor_name is null;

alter table public.activity_logs
  alter column actor_name set default '',
  alter column actor_name set not null;

create table if not exists public.discharge_summaries (
  id text primary key default public.generate_prefixed_id('discharge-summary'),
  patient_id text not null unique references public.patients(id) on delete cascade,
  ward_id text,
  created_by_id uuid references public.profiles(id) on delete set null,
  created_by_name text not null default '',
  admit_date timestamptz not null,
  discharge_date timestamptz not null,
  length_of_stay text not null default '',
  primary_diagnosis text not null,
  hospital_course text not null default '',
  plan text not null default '',
  home_medication text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.task_templates
  alter column default_priority type public.task_priority_v2
  using (
    case default_priority::text
      when 'low' then 'normal'
      when 'high' then 'urgent'
      when 'urgent' then 'emergency'
      else 'normal'
    end
  )::public.task_priority_v2;

alter table public.ward_tasks
  alter column priority type public.task_priority_v2
  using (
    case priority::text
      when 'low' then 'normal'
      when 'high' then 'urgent'
      when 'urgent' then 'emergency'
      else 'normal'
    end
  )::public.task_priority_v2,
  alter column status type public.task_status_v2
  using (
    case status::text
      when 'waiting' then 'in_progress'
      else status::text
    end
  )::public.task_status_v2;

drop type if exists public.task_priority;
alter type public.task_priority_v2 rename to task_priority;

drop type if exists public.task_status;
alter type public.task_status_v2 rename to task_status;

create index if not exists idx_patients_ward_id on public.patients (ward_id);
create index if not exists idx_patients_lifecycle on public.patients (lifecycle);
create index if not exists idx_patients_updated_at on public.patients (updated_at desc);
create index if not exists idx_problems_patient_id on public.problems (patient_id);
create index if not exists idx_problems_status on public.problems (status);
create index if not exists idx_ward_tasks_patient_id on public.ward_tasks (patient_id);
create index if not exists idx_ward_tasks_owner_id on public.ward_tasks (owner_id);
create index if not exists idx_ward_tasks_status on public.ward_tasks (status);
create index if not exists idx_ward_tasks_due_at on public.ward_tasks (due_at);
create index if not exists idx_activity_logs_patient_id on public.activity_logs (patient_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs (created_at desc);

drop trigger if exists set_wards_updated_at on public.wards;
create trigger set_wards_updated_at
before update on public.wards
for each row
execute function public.set_updated_at();

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_patients_updated_at on public.patients;
create trigger set_patients_updated_at
before update on public.patients
for each row
execute function public.set_updated_at();

drop trigger if exists set_problems_updated_at on public.problems;
create trigger set_problems_updated_at
before update on public.problems
for each row
execute function public.set_updated_at();

drop trigger if exists set_ward_tasks_updated_at on public.ward_tasks;
create trigger set_ward_tasks_updated_at
before update on public.ward_tasks
for each row
execute function public.set_updated_at();

drop trigger if exists set_handover_notes_updated_at on public.handover_notes;
create trigger set_handover_notes_updated_at
before update on public.handover_notes
for each row
execute function public.set_updated_at();

drop trigger if exists set_task_templates_updated_at on public.task_templates;
create trigger set_task_templates_updated_at
before update on public.task_templates
for each row
execute function public.set_updated_at();

drop trigger if exists set_discharge_summaries_updated_at on public.discharge_summaries;
create trigger set_discharge_summaries_updated_at
before update on public.discharge_summaries
for each row
execute function public.set_updated_at();

alter table public.discharge_summaries enable row level security;

create policy wards_select_authenticated
on public.wards
for select
to authenticated
using (true);

create policy wards_admin_insert
on public.wards
for insert
to authenticated
with check (public.is_admin());

create policy wards_admin_update
on public.wards
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy wards_admin_delete
on public.wards
for delete
to authenticated
using (public.is_admin());

create policy templates_select_authenticated
on public.task_templates
for select
to authenticated
using (true);

create policy templates_admin_insert
on public.task_templates
for insert
to authenticated
with check (public.is_admin());

create policy templates_admin_update
on public.task_templates
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy templates_admin_delete
on public.task_templates
for delete
to authenticated
using (public.is_admin());

create policy profiles_self_select
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_admin()
  or (
    ward_assignment is not null
    and ward_assignment = public.current_user_ward()
  )
);

create policy profiles_admin_insert
on public.profiles
for insert
to authenticated
with check (public.is_admin());

create policy profiles_admin_update
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin() or id = auth.uid());

create policy patients_select
on public.patients
for select
to authenticated
using (public.can_access_ward(ward_id));

create policy patients_insert
on public.patients
for insert
to authenticated
with check (
  public.can_manage_patients()
  and public.can_access_ward(ward_id)
);

create policy patients_update
on public.patients
for update
to authenticated
using (
  public.can_manage_patients()
  and public.can_access_ward(ward_id)
);

create policy patients_update_check
on public.patients
for update
to authenticated
with check (
  public.can_manage_patients()
  and public.can_access_ward(ward_id)
);

create policy patients_delete
on public.patients
for delete
to authenticated
using (
  public.can_manage_patients()
  and public.can_access_ward(ward_id)
);

create policy problems_select
on public.problems
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    where patient.id = problems.patient_id
      and public.can_access_ward(patient.ward_id)
  )
);

create policy problems_insert
on public.problems
for insert
to authenticated
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = problems.patient_id
      and public.can_access_ward(patient.ward_id)
  )
);

create policy problems_update
on public.problems
for update
to authenticated
using (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = problems.patient_id
      and public.can_access_ward(patient.ward_id)
  )
)
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = problems.patient_id
      and public.can_access_ward(patient.ward_id)
  )
);

create policy tasks_select
on public.ward_tasks
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    where patient.id = ward_tasks.patient_id
      and public.can_access_ward(patient.ward_id)
  )
);

create policy tasks_insert
on public.ward_tasks
for insert
to authenticated
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = ward_tasks.patient_id
      and public.can_access_ward(patient.ward_id)
  )
);

create policy tasks_update
on public.ward_tasks
for update
to authenticated
using (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = ward_tasks.patient_id
      and public.can_access_ward(patient.ward_id)
  )
)
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = ward_tasks.patient_id
      and public.can_access_ward(patient.ward_id)
  )
);

create policy handover_select
on public.handover_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    where patient.id = handover_notes.patient_id
      and public.can_access_ward(patient.ward_id)
  )
);

create policy handover_insert
on public.handover_notes
for insert
to authenticated
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = handover_notes.patient_id
      and public.can_access_ward(patient.ward_id)
  )
);

create policy handover_update
on public.handover_notes
for update
to authenticated
using (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = handover_notes.patient_id
      and public.can_access_ward(patient.ward_id)
  )
)
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = handover_notes.patient_id
      and public.can_access_ward(patient.ward_id)
  )
);

create policy activity_select
on public.activity_logs
for select
to authenticated
using (
  exists (
    select 1
    from public.patients patient
    where patient.id = activity_logs.patient_id
      and public.can_access_ward(patient.ward_id)
  )
);

create policy activity_insert
on public.activity_logs
for insert
to authenticated
with check (
  public.can_write_clinical_entries()
  and exists (
    select 1
    from public.patients patient
    where patient.id = activity_logs.patient_id
      and public.can_access_ward(patient.ward_id)
  )
);

create policy discharge_summaries_select
on public.discharge_summaries
for select
to authenticated
using (
  public.is_admin()
  or public.can_access_ward(ward_id)
);

create policy discharge_summaries_insert
on public.discharge_summaries
for insert
to authenticated
with check (
  public.can_manage_patients()
  and public.can_access_ward(ward_id)
);

create policy discharge_summaries_update
on public.discharge_summaries
for update
to authenticated
using (
  public.can_manage_patients()
  and public.can_access_ward(ward_id)
)
with check (
  public.can_manage_patients()
  and public.can_access_ward(ward_id)
);

alter publication supabase_realtime add table public.discharge_summaries;

insert into public.task_templates (id, title, type, default_priority)
values
  ('template-follow-lab', 'Follow lab', 'lab', 'normal'),
  ('template-follow-culture', 'Follow culture', 'lab', 'urgent'),
  ('template-consult-specialist', 'Consult specialist', 'consult', 'urgent'),
  ('template-talk-to-family', 'Talk to family', 'family_talk', 'normal'),
  ('template-discharge-summary', 'Discharge summary', 'discharge', 'normal'),
  ('template-home-meds', 'Home meds', 'medication', 'normal'),
  ('template-appointment', 'Appointment', 'other', 'normal'),
  ('template-procedure-prep', 'Procedure prep', 'procedure', 'urgent')
on conflict (title) do update
set type = excluded.type,
    default_priority = excluded.default_priority;

do $$
declare
  store jsonb;
begin
  select data into store
  from public.app_state
  where id = 'primary';

  if store is null then
    return;
  end if;

  insert into public.wards (id, name)
  select coalesce(row.id, public.generate_prefixed_id('ward')), row.name
  from jsonb_to_recordset(coalesce(store->'wards', '[]'::jsonb)) as row (
    id text,
    name text
  )
  on conflict (id) do update
    set name = excluded.name;

  insert into public.profiles (id, name, email, avatar_url, role, ward_assignment)
  select row.id::uuid,
         coalesce(row.name, 'WardFlow User'),
         coalesce(row.email, ''),
         row."avatarUrl",
         coalesce(row.role::public.app_role, 'student'),
         row."wardAssignment"
  from jsonb_to_recordset(coalesce(store->'profiles', '[]'::jsonb)) as row (
    id text,
    name text,
    email text,
    "avatarUrl" text,
    role text,
    "wardAssignment" text
  )
  where row.id is not null
  on conflict (id) do update
    set name = excluded.name,
        email = excluded.email,
        avatar_url = excluded.avatar_url,
        role = excluded.role,
        ward_assignment = excluded.ward_assignment;

  insert into public.patients (
    id,
    ward_id,
    bed,
    display_name,
    age,
    sex,
    diagnosis,
    status,
    responsible_doctor_id,
    allergy,
    precaution,
    code_status,
    lifecycle,
    discharged_at,
    created_at,
    updated_at
  )
  select coalesce(row.id, public.generate_prefixed_id('patient')),
         row."wardId",
         row.bed,
         row."displayName",
         row.age,
         row.sex,
         row.diagnosis,
         coalesce(row.status::public.patient_status, 'stable'),
         nullif(row."responsibleDoctorId", '')::uuid,
         row.allergy,
         coalesce(row.precaution::public.patient_precaution, 'none'),
         row."codeStatus",
         coalesce(row.lifecycle::public.patient_lifecycle, 'active'),
         row."dischargedAt",
         coalesce(row.created_at, timezone('utc', now())),
         coalesce(row."lastUpdate", timezone('utc', now()))
  from jsonb_to_recordset(coalesce(store->'patients', '[]'::jsonb)) as row (
    id text,
    "wardId" text,
    bed text,
    "displayName" text,
    age integer,
    sex text,
    diagnosis text,
    status text,
    "responsibleDoctorId" text,
    allergy text,
    precaution text,
    "codeStatus" text,
    lifecycle text,
    "dischargedAt" timestamptz,
    created_at timestamptz,
    "lastUpdate" timestamptz
  )
  on conflict (id) do update
    set ward_id = excluded.ward_id,
        bed = excluded.bed,
        display_name = excluded.display_name,
        age = excluded.age,
        sex = excluded.sex,
        diagnosis = excluded.diagnosis,
        status = excluded.status,
        responsible_doctor_id = excluded.responsible_doctor_id,
        allergy = excluded.allergy,
        precaution = excluded.precaution,
        code_status = excluded.code_status,
        lifecycle = excluded.lifecycle,
        discharged_at = excluded.discharged_at,
        updated_at = excluded.updated_at;

  insert into public.problems (
    id,
    patient_id,
    title,
    status,
    key_data,
    plan,
    pending,
    watch_out,
    include_in_handover,
    sort_order,
    created_at,
    updated_at
  )
  select coalesce(row.id, public.generate_prefixed_id('problem')),
         row."patientId",
         row.title,
         coalesce(row.status::public.problem_status, 'active'),
         row."keyData",
         row.plan,
         row.pending,
         row."watchOut",
         coalesce(row."includeInHandover", true),
         coalesce(row."sortOrder", 1),
         coalesce(row.created_at, timezone('utc', now())),
         coalesce(row."updatedAt", timezone('utc', now()))
  from jsonb_to_recordset(coalesce(store->'problems', '[]'::jsonb)) as row (
    id text,
    "patientId" text,
    title text,
    status text,
    "keyData" text,
    plan text,
    pending text,
    "watchOut" text,
    "includeInHandover" boolean,
    "sortOrder" integer,
    created_at timestamptz,
    "updatedAt" timestamptz
  )
  on conflict (id) do update
    set title = excluded.title,
        status = excluded.status,
        key_data = excluded.key_data,
        plan = excluded.plan,
        pending = excluded.pending,
        watch_out = excluded.watch_out,
        include_in_handover = excluded.include_in_handover,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at;

  insert into public.ward_tasks (
    id,
    patient_id,
    title,
    note,
    owner_id,
    status,
    priority,
    type,
    due_at,
    blocked_reason,
    updated_by_id,
    created_at,
    updated_at
  )
  select coalesce(row.id, public.generate_prefixed_id('task')),
         row."patientId",
         row.title,
         row.note,
         nullif(row."ownerId", '')::uuid,
         coalesce(row.status::public.task_status, 'not_started'),
         case row.priority
            when 'low' then 'normal'::public.task_priority
            when 'high' then 'urgent'::public.task_priority
            when 'urgency' then 'urgent'::public.task_priority
           when 'urgent' then 'urgent'::public.task_priority
           when 'emergency' then 'emergency'::public.task_priority
           else 'normal'::public.task_priority
         end,
         coalesce(row.type::public.task_type, 'other'),
         row."dueAt",
         row."blockedReason",
         nullif(row."updatedById", '')::uuid,
         coalesce(row.created_at, timezone('utc', now())),
         coalesce(row."updatedAt", timezone('utc', now()))
  from jsonb_to_recordset(coalesce(store->'tasks', '[]'::jsonb)) as row (
    id text,
    "patientId" text,
    title text,
    note text,
    "ownerId" text,
    status text,
    priority text,
    type text,
    "dueAt" timestamptz,
    "blockedReason" text,
    "updatedById" text,
    created_at timestamptz,
    "updatedAt" timestamptz
  )
  on conflict (id) do update
    set title = excluded.title,
        note = excluded.note,
        owner_id = excluded.owner_id,
        status = excluded.status,
        priority = excluded.priority,
        type = excluded.type,
        due_at = excluded.due_at,
        blocked_reason = excluded.blocked_reason,
        updated_by_id = excluded.updated_by_id,
        updated_at = excluded.updated_at;

  insert into public.handover_notes (
    id,
    patient_id,
    note,
    escalation_instruction,
    created_at,
    updated_at
  )
  select coalesce(row.id, public.generate_prefixed_id('handover')),
         row."patientId",
         coalesce(row.note, ''),
         row."escalationInstruction",
         coalesce(row.created_at, timezone('utc', now())),
         coalesce(row."updatedAt", timezone('utc', now()))
  from jsonb_to_recordset(coalesce(store->'handovers', '[]'::jsonb)) as row (
    id text,
    "patientId" text,
    note text,
    "escalationInstruction" text,
    created_at timestamptz,
    "updatedAt" timestamptz
  )
  on conflict (patient_id) do update
    set note = excluded.note,
        escalation_instruction = excluded.escalation_instruction,
        updated_at = excluded.updated_at;

  insert into public.discharge_summaries (
    id,
    patient_id,
    ward_id,
    created_by_id,
    created_by_name,
    created_at,
    admit_date,
    discharge_date,
    length_of_stay,
    primary_diagnosis,
    hospital_course,
    plan,
    home_medication,
    updated_at
  )
  select coalesce(row.id, public.generate_prefixed_id('discharge-summary')),
         row."patientId",
         row."wardId",
         nullif(row."createdById", '')::uuid,
         coalesce(row."createdByName", 'Unknown User'),
         coalesce(row."createdAt", timezone('utc', now())),
         coalesce(row."admitDate", timezone('utc', now())),
         coalesce(row."dischargeDate", timezone('utc', now())),
         coalesce(row."lengthOfStay", ''),
         coalesce(row."primaryDiagnosis", ''),
         coalesce(row."hospitalCourse", ''),
         coalesce(row.plan, ''),
         coalesce(row."homeMedication", ''),
         coalesce(row."updatedAt", coalesce(row."createdAt", timezone('utc', now())))
  from jsonb_to_recordset(coalesce(store->'dischargeSummaries', '[]'::jsonb)) as row (
    id text,
    "patientId" text,
    "wardId" text,
    "createdById" text,
    "createdByName" text,
    "createdAt" timestamptz,
    "admitDate" timestamptz,
    "dischargeDate" timestamptz,
    "lengthOfStay" text,
    "primaryDiagnosis" text,
    "hospitalCourse" text,
    plan text,
    "homeMedication" text,
    "updatedAt" timestamptz
  )
  on conflict (patient_id) do update
    set ward_id = excluded.ward_id,
        created_by_id = excluded.created_by_id,
        created_by_name = excluded.created_by_name,
        created_at = excluded.created_at,
        admit_date = excluded.admit_date,
        discharge_date = excluded.discharge_date,
        length_of_stay = excluded.length_of_stay,
        primary_diagnosis = excluded.primary_diagnosis,
        hospital_course = excluded.hospital_course,
        plan = excluded.plan,
        home_medication = excluded.home_medication,
        updated_at = excluded.updated_at;

  insert into public.activity_logs (
    id,
    patient_id,
    actor_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    before_json,
    after_json,
    created_at
  )
  select coalesce(row.id, public.generate_prefixed_id('activity')),
         row."patientId",
         nullif(row."actorId", '')::uuid,
         coalesce(row."actorName", 'Unknown User'),
         row.action,
         row."entityType",
         row."entityId",
         row."beforeJson",
         row."afterJson",
         coalesce(row."createdAt", timezone('utc', now()))
  from jsonb_to_recordset(coalesce(store->'activity', '[]'::jsonb)) as row (
    id text,
    "patientId" text,
    "actorId" text,
    "actorName" text,
    action text,
    "entityType" text,
    "entityId" text,
    "beforeJson" jsonb,
    "afterJson" jsonb,
    "createdAt" timestamptz
  )
  on conflict (id) do nothing;
end $$;
