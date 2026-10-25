-- Run after the migration. Uses synthetic fixtures and rolls everything back.
begin;
do $test$
declare w uuid := gen_random_uuid(); p uuid := gen_random_uuid(); pr uuid := gen_random_uuid();
  actor uuid; r jsonb; r2 jsonb; req text := gen_random_uuid()::text;
begin
  select id into actor from public.profiles where role='admin' limit 1;
  if actor is null then raise exception 'No admin fixture available'; end if;
  insert into public.wards(id,name) values(w,'AUTOSAVE ROLLBACK TEST');
  insert into public.patients(id,ward_id,bed,display_name,diagnosis) values(p,w,'TEST','AUTOSAVE ROLLBACK TEST','TEST');
  insert into public.problems(id,patient_id,title,problem_name) values(pr,p,'TEST','TEST');
  perform set_config('request.jwt.claim.sub',actor::text,true);
  execute 'set local role authenticated';
  r := public.autosave_problem_note(p,pr,req,null,null,E'line 1\nline 2');
  if not (r->>'ok')::boolean then raise exception 'Initial save failed: %',r; end if;
  r2 := public.autosave_problem_note(p,pr,req,null,null,E'line 1\nline 2');
  if r2 <> r then raise exception 'Retry was not idempotent'; end if;
  r2 := public.autosave_problem_note(p,pr,gen_random_uuid()::text,null,null,'stale');
  if r2->>'conflict' <> 'true' then raise exception 'Conflict not rejected'; end if;
  r2 := public.autosave_problem_note(p,pr,gen_random_uuid()::text,r#>>'{snapshot,id}',(r#>>'{snapshot,updatedAt}')::timestamptz,'');
  if not (r2->>'ok')::boolean or r2#>>'{snapshot,note}' <> '' then raise exception 'Clear failed'; end if;
  if (select count(*) from public.problem_progress_entries where problem_id=pr) <> 2 then raise exception 'History count incorrect'; end if;
  if has_function_privilege('anon','public.autosave_problem_note(uuid,uuid,text,text,timestamptz,text)','execute') then raise exception 'Anon permission exposed'; end if;
end $test$;
select 'PASS: save, retry, stale conflict, clear, history, anon denied; fixtures rolled back' as result;
rollback;
