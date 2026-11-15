-- FuturePath offline-first learning support.
-- This script was applied to Supabase project syiqilbfkepucmfmbksj.
-- Run only once on another environment after reviewing the schema.

alter table public.attempts add column if not exists client_attempt_id uuid;
create unique index if not exists attempts_user_client_attempt_id_uidx
  on public.attempts(user_id, client_attempt_id)
  where client_attempt_id is not null;

create or replace function public.get_offline_content()
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to download FuturePath content'; end if;
  return jsonb_build_object(
    'subjects', coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order, s.name) from public.subjects s), '[]'::jsonb),
    'topics', coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order, t.title) from public.topics t), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.title) from public.study_notes n where n.published = true), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'subject_id', q.subject_id, 'topic_id', q.topic_id, 'topic_title', t.title,
      'question_text', q.question_text, 'options', q.options, 'correct_option', q.correct_option,
      'explanation', q.explanation, 'exam_type', q.exam_type, 'exam_year', q.exam_year,
      'source_label', q.source_label
    ) order by q.created_at) from public.questions q left join public.topics t on t.id = q.topic_id
      where q.published = true), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_offline_content() from public, anon;
grant execute on function public.get_offline_content() to authenticated;

create or replace function public.sync_offline_attempt(
  p_client_attempt_id uuid, p_subject_id uuid, p_mode text, p_answers jsonb,
  p_duration_seconds integer default 0
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid(); v_attempt uuid; v_total integer := 0; v_correct integer := 0;
  v_item jsonb; v_q public.questions%rowtype; v_selected integer; v_existing public.attempts%rowtype;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if p_client_attempt_id is null then raise exception 'Attempt reference is required'; end if;
  if p_mode not in ('quiz','practice','mock') then raise exception 'Invalid attempt mode'; end if;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'Submit at least one answer';
  end if;
  select * into v_existing from public.attempts where user_id=v_user and client_attempt_id=p_client_attempt_id;
  if found then return jsonb_build_object('attempt_id',v_existing.id,'total_questions',v_existing.total_questions,
    'correct_answers',v_existing.correct_answers,'score_percent',v_existing.score_percent,'already_synced',true); end if;
  insert into public.attempts(user_id,client_attempt_id,subject_id,mode,total_questions,duration_seconds)
    values(v_user,p_client_attempt_id,p_subject_id,p_mode,jsonb_array_length(p_answers),
      greatest(0,coalesce(p_duration_seconds,0))) returning id into v_attempt;
  for v_item in select value from jsonb_array_elements(p_answers) loop
    select * into v_q from public.questions where id=(v_item->>'question_id')::uuid
      and published=true and (p_subject_id is null or subject_id=p_subject_id);
    if not found then continue; end if;
    v_selected:=nullif(v_item->>'selected_option','')::integer;
    insert into public.attempt_answers(attempt_id,question_id,selected_option,is_correct)
      values(v_attempt,v_q.id,v_selected,coalesce(v_selected=v_q.correct_option,false));
    v_total:=v_total+1;
    if v_selected=v_q.correct_option then v_correct:=v_correct+1; end if;
  end loop;
  if v_total=0 then raise exception 'No valid questions were submitted'; end if;
  update public.attempts set total_questions=v_total,correct_answers=v_correct,
    score_percent=round((v_correct::numeric/v_total)*100,2),submitted_at=now() where id=v_attempt;
  return jsonb_build_object('attempt_id',v_attempt,'total_questions',v_total,'correct_answers',v_correct,
    'score_percent',round((v_correct::numeric/v_total)*100,2),'already_synced',false);
exception when unique_violation then
  select * into v_existing from public.attempts where user_id=v_user and client_attempt_id=p_client_attempt_id;
  if found then return jsonb_build_object('attempt_id',v_existing.id,'total_questions',v_existing.total_questions,
    'correct_answers',v_existing.correct_answers,'score_percent',v_existing.score_percent,'already_synced',true); end if;
  raise;
end;
$$;
revoke all on function public.sync_offline_attempt(uuid,uuid,text,jsonb,integer) from public, anon;
grant execute on function public.sync_offline_attempt(uuid,uuid,text,jsonb,integer) to authenticated;
