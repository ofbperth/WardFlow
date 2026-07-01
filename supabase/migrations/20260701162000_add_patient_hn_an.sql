alter table public.patients
  add column if not exists hospital_number text,
  add column if not exists admission_number text;
