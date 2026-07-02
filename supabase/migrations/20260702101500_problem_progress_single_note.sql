alter table public.problem_progress_entries
  add column if not exists note text;

update public.problem_progress_entries
set note = concat_ws(
  E'\n',
  nullif(trim(status_update), ''),
  nullif(trim(new_evidence), ''),
  nullif(trim(treatment_change), ''),
  nullif(trim(reasoning_update), ''),
  case
    when nullif(trim(today_plan), '') is not null then 'Plan: ' || trim(today_plan)
    else null
  end
)
where coalesce(nullif(trim(note), ''), '') = '';
