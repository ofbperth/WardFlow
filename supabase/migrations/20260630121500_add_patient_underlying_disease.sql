alter table public.patients
  add column if not exists underlying_disease text;
