-- LOG:ON 단계별 토론 시스템
-- 신규 토론의 참여자 지정, 사전 입장, 토론 진행,
-- 사후 입장 및 결론, MVP 투표, 최종 통계를 지원한다.
-- 신규 테이블 7개를 추가한다.
-- 기존 테이블 agendas, opinions, decisions에 제한 정책 8개를 추가한다.
-- 세션이 있는 안건에서는 기존 방식의 수정 및 의견·결론 등록을 차단한다.
-- 기존 테이블의 컬럼, 제약 조건, 기존 데이터는 변경하거나 이전하지 않는다.
-- 세션이 없는 기존 안건은 기존 토론 방식을 유지한다.
-- 신규 토론은 찬성·반대만 지원하며 보류 및 종료 후 다시 논의하기는 지원하지 않는다.
-- 임원진도 의견 공개 전에는 타인의 의견을 열람할 수 없으며 제출 인원수만 확인한다.
-- 토론 시작에는 최소 4명의 참여자가 필요하다.
-- 기존 개인 메모 및 회원 관리 정책을 유지한다.
-- 실행 전 반드시 백업 및 시험용 DB 검증을 진행한다.
-- 실행 순서: SQL 적용 후 프론트엔드 배포.
-- 현재 상태: 운영 미적용 / 실제 DB 검증 전.

begin;

-- 1. Debate session and current stage
create table public.debate_sessions (
  agenda_id bigint primary key
    references public.agendas(id) on delete cascade,
  stage text not null default 'pre'
    check (stage in ('pre', 'discussing', 'post', 'voting', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  participants_confirmed_at timestamptz,
  closed_at timestamptz
);

-- 2. Participants
create table public.debate_participants (
  agenda_id bigint not null
    references public.debate_sessions(agenda_id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (agenda_id, user_id)
);

-- 3. Pre-debate opinions
create table public.debate_pre_opinions (
  agenda_id bigint not null,
  user_id uuid not null default auth.uid(),
  stance text not null
    check (stance in ('agree', 'disagree')),
  content text not null
    check (char_length(btrim(content)) between 1 and 2000),
  updated_at timestamptz not null default now(),
  primary key (agenda_id, user_id),
  foreign key (agenda_id, user_id)
    references public.debate_participants(agenda_id, user_id)
    on delete cascade
);

-- 4. Post-debate opinions
create table public.debate_post_opinions (
  agenda_id bigint not null,
  user_id uuid not null default auth.uid(),
  stance text not null
    check (stance in ('agree', 'disagree')),
  reason text not null
    check (char_length(btrim(reason)) between 1 and 2000),
  conclusion text not null
    check (char_length(btrim(conclusion)) between 1 and 2000),
  updated_at timestamptz not null default now(),
  primary key (agenda_id, user_id),
  foreign key (agenda_id, user_id)
    references public.debate_participants(agenda_id, user_id)
    on delete cascade
);

-- 5. MVP votes
create table public.debate_mvp_votes (
  agenda_id bigint not null,
  voter_id uuid not null default auth.uid(),
  candidate_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (agenda_id, voter_id),
  check (voter_id <> candidate_id),
  foreign key (agenda_id, voter_id)
    references public.debate_participants(agenda_id, user_id)
    on delete cascade,
  foreign key (agenda_id, candidate_id)
    references public.debate_participants(agenda_id, user_id)
    on delete cascade
);

-- 6. Enable row-level security
alter table public.debate_sessions enable row level security;
alter table public.debate_participants enable row level security;
alter table public.debate_pre_opinions enable row level security;
alter table public.debate_post_opinions enable row level security;
alter table public.debate_mvp_votes enable row level security;

-- Deny direct writes until guarded RPC functions are added.
revoke all on
  public.debate_sessions,
  public.debate_participants,
  public.debate_pre_opinions,
  public.debate_post_opinions,
  public.debate_mvp_votes
from public, anon, authenticated;

grant select on
  public.debate_sessions,
  public.debate_participants,
  public.debate_pre_opinions,
  public.debate_post_opinions
to authenticated;

-- Approved members can read debate sessions.
create policy debate_sessions_read
on public.debate_sessions
for select to authenticated
using (public.is_approved());

create policy debate_participants_read
on public.debate_participants
for select to authenticated
using (public.is_approved());

create policy debate_pre_read
on public.debate_pre_opinions
for select to authenticated
using (
  public.is_approved()
  and (
    user_id = auth.uid()
    or exists (
      select 1 from public.debate_sessions s
      where s.agenda_id = debate_pre_opinions.agenda_id
      and s.stage <> 'pre'
    )
  )
);

create policy debate_post_read
on public.debate_post_opinions
for select to authenticated
using (
  public.is_approved()
  and (
    user_id = auth.uid()
    or exists (
      select 1 from public.debate_sessions s
      where s.agenda_id = debate_post_opinions.agenda_id
      and s.stage = 'closed'
    )
  )
);

-- Individual MVP votes are not directly readable,
-- including by officers using the application.
-- Aggregate results will be exposed through a guarded RPC.

-- 7. Guarded opinion submission

create function public.debate_submit_pre(
  p_agenda_id bigint,
  p_stance text,
  p_content text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
  v_confirmed_at timestamptz;
begin
  if public.is_approved() is not true then
    raise exception 'Access denied';
  end if;

  select stage, participants_confirmed_at into v_stage, v_confirmed_at
  from public.debate_sessions
  where agenda_id = p_agenda_id
  for update;

  if v_stage is distinct from 'pre' then
    raise exception 'Pre-debate submission is closed';
  end if;

  if v_confirmed_at is null then
    raise exception 'Participant list has not been confirmed';
  end if;

  if not exists (
    select 1 from public.debate_participants
    where agenda_id = p_agenda_id
    and user_id = auth.uid()
  ) then
    raise exception 'Not a participant';
  end if;

  if (
    select count(*)
    from public.debate_participants dp
    join public.profiles p on p.id = dp.user_id
    where dp.agenda_id = p_agenda_id
      and p.status = 'approved'
  ) < 4 then
    raise exception 'At least 4 participants are required before pre-debate submission';
  end if;

  insert into public.debate_pre_opinions
    (agenda_id, user_id, stance, content)
  values
    (p_agenda_id, auth.uid(), p_stance, btrim(p_content))
  on conflict (agenda_id, user_id)
  do update set
    stance = excluded.stance,
    content = excluded.content,
    updated_at = now();
end;
$$;

create function public.debate_submit_post(
  p_agenda_id bigint,
  p_stance text,
  p_reason text,
  p_conclusion text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
begin
  if public.is_approved() is not true then
    raise exception 'Access denied';
  end if;

  select stage into v_stage
  from public.debate_sessions
  where agenda_id = p_agenda_id
  for update;

  if v_stage is distinct from 'post' then
    raise exception 'Post-debate submission is closed';
  end if;

  if not exists (
    select 1 from public.debate_participants
    where agenda_id = p_agenda_id
    and user_id = auth.uid()
  ) then
    raise exception 'Not a participant';
  end if;

  insert into public.debate_post_opinions
    (agenda_id, user_id, stance, reason, conclusion)
  values
    (p_agenda_id, auth.uid(), p_stance,
     btrim(p_reason), btrim(p_conclusion))
  on conflict (agenda_id, user_id)
  do update set
    stance = excluded.stance,
    reason = excluded.reason,
    conclusion = excluded.conclusion,
    updated_at = now();
end;
$$;

revoke all on function
  public.debate_submit_pre(bigint, text, text)
from public, anon, authenticated;

revoke all on function
  public.debate_submit_post(bigint, text, text, text)
from public, anon, authenticated;

grant execute on function
  public.debate_submit_pre(bigint, text, text)
to authenticated;

grant execute on function
  public.debate_submit_post(bigint, text, text, text)
to authenticated;


-- 8. Officer workflow management

create function public.debate_create_session(
  p_agenda_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_approved() is not true
     or public.is_officer() is not true then
    raise exception 'Access denied';
  end if;

  if not exists (
    select 1 from public.agendas
    where id = p_agenda_id
    and status = 'discussing'
    for update
  ) then
    raise exception 'Active agenda not found';
  end if;

  if exists (
    select 1 from public.opinions
    where agenda_id = p_agenda_id
  ) or exists (
    select 1 from public.decisions
    where agenda_id = p_agenda_id
  ) then
    raise exception 'Existing debate records must be preserved';
  end if;

  insert into public.debate_sessions (agenda_id)
  values (p_agenda_id);
end;
$$;

create function public.debate_add_participant(
  p_agenda_id bigint,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
  v_confirmed_at timestamptz;
begin
  if public.is_approved() is not true
     or public.is_officer() is not true then
    raise exception 'Access denied';
  end if;

  select stage, participants_confirmed_at into v_stage, v_confirmed_at
  from public.debate_sessions
  where agenda_id = p_agenda_id
  for update;

  if v_stage is distinct from 'pre' then
    raise exception 'Participant list is locked';
  end if;

  if v_confirmed_at is not null then
    raise exception 'Participant list is locked';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_user_id
    and status = 'approved'
  ) then
    raise exception 'Approved member not found';
  end if;

  insert into public.debate_participants
    (agenda_id, user_id)
  values
    (p_agenda_id, p_user_id)
  on conflict do nothing;

  if found then
    update public.debate_sessions
    set updated_at = clock_timestamp()
    where agenda_id = p_agenda_id;
  end if;
end;
$$;

create function public.debate_remove_participant(
  p_agenda_id bigint,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
  v_confirmed_at timestamptz;
begin
  if public.is_approved() is not true
     or public.is_officer() is not true then
    raise exception 'Access denied';
  end if;

  select stage, participants_confirmed_at into v_stage, v_confirmed_at
  from public.debate_sessions
  where agenda_id = p_agenda_id
  for update;

  if v_stage is distinct from 'pre' then
    raise exception 'Participant list is locked';
  end if;

  if v_confirmed_at is not null then
    raise exception 'Participant list is locked';
  end if;

  delete from public.debate_participants
  where agenda_id = p_agenda_id
  and user_id = p_user_id;

  if found then
    update public.debate_sessions
    set updated_at = clock_timestamp()
    where agenda_id = p_agenda_id;
  end if;
end;
$$;

create function public.debate_advance_stage(
  p_agenda_id bigint,
  p_expected_stage text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
  v_confirmed_at timestamptz;
  v_next text;
begin
  if public.is_approved() is not true
     or public.is_officer() is not true then
    raise exception 'Access denied';
  end if;

  select stage, participants_confirmed_at into v_stage, v_confirmed_at
  from public.debate_sessions
  where agenda_id = p_agenda_id
  for update;

  if not found then
    raise exception 'Debate session not found';
  end if;

  if v_stage is distinct from p_expected_stage then
    raise exception 'Stage has already changed';
  end if;

  v_next := case v_stage
    when 'pre' then 'discussing'
    when 'discussing' then 'post'
    when 'post' then 'voting'
    when 'voting' then null
    else null
  end;

  if v_next is null then
    raise exception 'Use finalize to close the debate';
  end if;

  if v_stage = 'pre' and v_confirmed_at is null then
    raise exception 'Participant list has not been confirmed';
  end if;

  if v_stage = 'pre' and (
    select count(*)
    from public.debate_participants dp
    join public.profiles p on p.id = dp.user_id
    where dp.agenda_id = p_agenda_id
      and p.status = 'approved'
  ) < 4 then
    raise exception 'At least four participants are required';
  end if;

  update public.debate_sessions
  set stage = v_next,
      updated_at = now(),
      closed_at = case
        when v_next = 'closed' then now()
        else null
      end
  where agenda_id = p_agenda_id;

  return v_next;
end;
$$;

revoke all on function
  public.debate_create_session(bigint),
  public.debate_add_participant(bigint, uuid),
  public.debate_remove_participant(bigint, uuid),
  public.debate_advance_stage(bigint, text)
from public, anon, authenticated;

grant execute on function
  public.debate_create_session(bigint),
  public.debate_add_participant(bigint, uuid),
  public.debate_remove_participant(bigint, uuid),
  public.debate_advance_stage(bigint, text)
to authenticated;


-- 9. Anonymous MVP voting

create function public.debate_submit_vote(
  p_agenda_id bigint,
  p_candidate_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
begin
  if public.is_approved() is not true then
    raise exception 'Access denied';
  end if;

  select stage into v_stage
  from public.debate_sessions
  where agenda_id = p_agenda_id
  for update;

  if v_stage is distinct from 'voting' then
    raise exception 'Voting is not open';
  end if;

  if not exists (
    select 1 from public.debate_participants
    where agenda_id = p_agenda_id
    and user_id = auth.uid()
  ) then
    raise exception 'Not a participant';
  end if;

  if p_candidate_id is null
     or p_candidate_id = auth.uid() then
    raise exception 'Invalid MVP candidate';
  end if;

  if not exists (
    select 1
    from public.debate_participants dp
    join public.profiles p on p.id = dp.user_id
    where dp.agenda_id = p_agenda_id
    and dp.user_id = p_candidate_id
    and p.status = 'approved'
  ) then
    raise exception 'Candidate is not eligible';
  end if;

  if exists (
    select 1 from public.debate_mvp_votes
    where agenda_id = p_agenda_id
    and voter_id = auth.uid()
  ) then
    raise exception 'Already voted';
  end if;

  insert into public.debate_mvp_votes
    (agenda_id, voter_id, candidate_id)
  values
    (p_agenda_id, auth.uid(), p_candidate_id);
end;
$$;

-- Check only the current user's voting status.

create function public.debate_has_voted(
  p_agenda_id bigint
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_approved() is not true then
    raise exception 'Access denied';
  end if;

  return exists (
    select 1 from public.debate_mvp_votes
    where agenda_id = p_agenda_id
    and voter_id = auth.uid()
  );
end;
$$;

-- Aggregate results only after the debate is closed.
-- Never return individual voter identities.

create function public.debate_mvp_results(
  p_agenda_id bigint
)
returns table (
  candidate_id uuid,
  vote_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_approved() is not true then
    raise exception 'Access denied';
  end if;

  if not exists (
    select 1 from public.debate_sessions
    where agenda_id = p_agenda_id
    and stage = 'closed'
  ) then
    raise exception 'Results are not available yet';
  end if;

  return query
    select v.candidate_id, count(*)
    from public.debate_mvp_votes v
    where v.agenda_id = p_agenda_id
    group by v.candidate_id
    order by count(*) desc, v.candidate_id;
end;
$$;

revoke all on function
  public.debate_submit_vote(bigint, uuid),
  public.debate_has_voted(bigint),
  public.debate_mvp_results(bigint)
from public, anon, authenticated;

grant execute on function
  public.debate_submit_vote(bigint, uuid),
  public.debate_has_voted(bigint),
  public.debate_mvp_results(bigint)
to authenticated;


-- 10. Finalize debate with an officer's summary

create function public.debate_finalize(
  p_agenda_id bigint,
  p_summary text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
begin
  if public.is_approved() is not true
     or public.is_officer() is not true then
    raise exception 'Access denied';
  end if;

  select stage into v_stage
  from public.debate_sessions
  where agenda_id = p_agenda_id
  for update;

  if v_stage is distinct from 'voting' then
    raise exception 'Debate cannot be finalized at this stage';
  end if;

  if p_summary is null
     or char_length(btrim(p_summary)) not between 1 and 2000 then
    raise exception 'Invalid final summary';
  end if;

  update public.debate_sessions
  set stage = 'closed',
      updated_at = now(),
      closed_at = now()
  where agenda_id = p_agenda_id;

  insert into public.decisions
    (agenda_id, content, decided_by)
  values
    (p_agenda_id, btrim(p_summary), auth.uid());
end;
$$;

revoke all on function
  public.debate_finalize(bigint, text)
from public, anon, authenticated;

grant execute on function
  public.debate_finalize(bigint, text)
to authenticated;


-- 11. Prevent legacy API writes to workflow debates

create policy debate_block_legacy_opinion_insert
on public.opinions
as restrictive
for insert to authenticated
with check (
  not exists (
    select 1 from public.debate_sessions s
    where s.agenda_id = opinions.agenda_id
  )
);

create policy debate_block_legacy_opinion_update
on public.opinions
as restrictive
for update to authenticated
using (
  not exists (
    select 1 from public.debate_sessions s
    where s.agenda_id = opinions.agenda_id
  )
)
with check (
  not exists (
    select 1 from public.debate_sessions s
    where s.agenda_id = opinions.agenda_id
  )
);

create policy debate_block_legacy_opinion_delete
on public.opinions
as restrictive
for delete to authenticated
using (
  not exists (
    select 1 from public.debate_sessions s
    where s.agenda_id = opinions.agenda_id
  )
);

create policy debate_block_legacy_decision_insert
on public.decisions
as restrictive
for insert to authenticated
with check (
  not exists (
    select 1 from public.debate_sessions s
    where s.agenda_id = decisions.agenda_id
  )
);

create policy debate_block_legacy_decision_update
on public.decisions
as restrictive
for update to authenticated
using (
  not exists (
    select 1 from public.debate_sessions s
    where s.agenda_id = decisions.agenda_id
  )
)
with check (
  not exists (
    select 1 from public.debate_sessions s
    where s.agenda_id = decisions.agenda_id
  )
);

create policy debate_block_legacy_decision_delete
on public.decisions
as restrictive
for delete to authenticated
using (
  not exists (
    select 1 from public.debate_sessions s
    where s.agenda_id = decisions.agenda_id
  )
);

-- Prevent direct agenda updates and deletion.
-- Workflow management must use guarded functions.

create policy debate_block_legacy_agenda_update
on public.agendas
as restrictive
for update to authenticated
using (
  not exists (
    select 1 from public.debate_sessions s
    where s.agenda_id = agendas.id
  )
)
with check (
  not exists (
    select 1 from public.debate_sessions s
    where s.agenda_id = agendas.id
  )
);

create policy debate_block_legacy_agenda_delete
on public.agendas
as restrictive
for delete to authenticated
using (
  not exists (
    select 1 from public.debate_sessions s
    where s.agenda_id = agendas.id
  )
);



-- Atomic creation of a new workflow agenda.

create function public.debate_create_agenda(
  p_title text,
  p_description text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agenda_id bigint;
begin
  if public.is_approved() is not true
     or public.is_officer() is not true then
    raise exception 'Officer permission required';
  end if;

  if p_title is null
     or char_length(btrim(p_title)) not between 1 and 100 then
    raise exception 'Invalid agenda title';
  end if;

  if char_length(coalesce(btrim(p_description), '')) > 2000 then
    raise exception 'Description is too long';
  end if;

  insert into public.agendas (
    title,
    description,
    status,
    created_by
  )
  values (
    btrim(p_title),
    nullif(btrim(p_description), ''),
    'discussing',
    auth.uid()
  )
  returning id into v_agenda_id;

  insert into public.debate_sessions (
    agenda_id,
    stage
  )
  values (
    v_agenda_id,
    'pre'
  );

  return v_agenda_id;
end;
$$;

revoke all on function public.debate_create_agenda(text, text)
from public, anon, authenticated;

grant execute on function public.debate_create_agenda(text, text)
to authenticated;

-- Disable conversion of existing legacy agendas.
drop function public.debate_create_session(bigint);



-- Preserve aggregate results at the moment a debate closes.

create table public.debate_result_snapshots (
  agenda_id bigint primary key
    references public.debate_sessions(agenda_id)
    on delete cascade,

  stats jsonb not null,

  created_at timestamptz not null default now()
);

create table public.debate_mvp_snapshots (
  id bigint generated always as identity primary key,

  agenda_id bigint not null
    references public.debate_result_snapshots(agenda_id)
    on delete cascade,

  candidate_id uuid
    references public.profiles(id)
    on delete set null,

  vote_count bigint not null
    check (vote_count > 0)
);

alter table public.debate_result_snapshots
enable row level security;

alter table public.debate_mvp_snapshots
enable row level security;

revoke all on public.debate_result_snapshots
from public, anon, authenticated;

revoke all on public.debate_mvp_snapshots
from public, anon, authenticated;

grant select on public.debate_result_snapshots
to authenticated;

grant select on public.debate_mvp_snapshots
to authenticated;

create policy debate_snapshot_read
on public.debate_result_snapshots
for select
to authenticated
using (
  public.is_approved()
  and exists (
    select 1
    from public.debate_sessions s
    where s.agenda_id = debate_result_snapshots.agenda_id
      and s.stage = 'closed'
  )
);

create policy debate_mvp_snapshot_read
on public.debate_mvp_snapshots
for select
to authenticated
using (
  public.is_approved()
  and exists (
    select 1
    from public.debate_sessions s
    where s.agenda_id = debate_mvp_snapshots.agenda_id
      and s.stage = 'closed'
  )
);

create function public.debate_capture_results()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stage = 'closed'
     and old.stage is distinct from 'closed' then

    -- Keep participant records stable during aggregation.
    perform 1
    from public.debate_participants
    where agenda_id = new.agenda_id
    order by user_id
    for update;

    with counts as (
      select
        count(*) as participant_count,

        count(pre.user_id) as pre_submitted,

        count(post.user_id) as post_submitted,

        count(*) filter (
          where pre.stance = 'agree'
        ) as pre_agree,

        count(*) filter (
          where pre.stance = 'disagree'
        ) as pre_disagree,

        count(*) filter (
          where post.stance = 'agree'
        ) as post_agree,

        count(*) filter (
          where post.stance = 'disagree'
        ) as post_disagree,

        count(*) filter (
          where pre.stance = 'agree'
            and post.stance = 'disagree'
        ) as agree_to_disagree,

        count(*) filter (
          where pre.stance = 'disagree'
            and post.stance = 'agree'
        ) as disagree_to_agree,

        count(*) filter (
          where pre.stance = post.stance
        ) as unchanged

      from public.debate_participants p

      join public.profiles member
        on member.id = p.user_id
       and member.status = 'approved'

      left join public.debate_pre_opinions pre
        on pre.agenda_id = p.agenda_id
       and pre.user_id = p.user_id

      left join public.debate_post_opinions post
        on post.agenda_id = p.agenda_id
       and post.user_id = p.user_id

      where p.agenda_id = new.agenda_id
    ),
    calculated as (
      select
        *,
        agree_to_disagree + disagree_to_agree
          as changed,

        agree_to_disagree + disagree_to_agree
          + unchanged as compared

      from counts
    )

    insert into public.debate_result_snapshots (
      agenda_id,
      stats
    )
    select
      new.agenda_id,

      jsonb_build_object(
        'participantCount', participant_count,
        'preSubmitted', pre_submitted,
        'postSubmitted', post_submitted,
        'preAgree', pre_agree,
        'preDisagree', pre_disagree,
        'postAgree', post_agree,
        'postDisagree', post_disagree,

        'preAgreeRate',
          coalesce(
            round(
              100.0 * pre_agree
              / nullif(pre_submitted, 0), 1
            ), 0
          ),

        'postAgreeRate',
          coalesce(
            round(
              100.0 * post_agree
              / nullif(post_submitted, 0), 1
            ), 0
          ),

        'agreeToDisagree', agree_to_disagree,
        'disagreeToAgree', disagree_to_agree,
        'unchanged', unchanged,
        'changed', changed,
        'compared', compared,

        'changeRate',
          coalesce(
            round(
              100.0 * changed
              / nullif(compared, 0), 1
            ), 0
          ),

        'conclusionRate',
          coalesce(
            round(
              100.0 * post_submitted
              / nullif(participant_count, 0), 1
            ), 0
          )
      )

    from calculated;

    insert into public.debate_mvp_snapshots (
      agenda_id,
      candidate_id,
      vote_count
    )
    select
      new.agenda_id,
      v.candidate_id,
      count(*)

    from public.debate_mvp_votes v
    join public.profiles voter
      on voter.id = v.voter_id
    join public.profiles candidate
      on candidate.id = v.candidate_id
    where v.agenda_id = new.agenda_id
      and voter.status = 'approved'
      and candidate.status = 'approved'
    group by v.candidate_id;

  end if;

  return new;
end;
$$;

revoke all on function public.debate_capture_results()
from public, anon, authenticated;

create trigger debate_capture_results_on_close
after update of stage
on public.debate_sessions
for each row
execute function public.debate_capture_results();



-- Read preserved MVP results instead of live vote records.

create or replace function public.debate_mvp_results(
  p_agenda_id bigint
)
returns table (
  candidate_id uuid,
  vote_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_approved() is not true then
    raise exception 'Approved member permission required';
  end if;

  if not exists (
    select 1
    from public.debate_sessions s
    where s.agenda_id = p_agenda_id
      and s.stage = 'closed'
  ) then
    raise exception 'Results are not available yet';
  end if;

  return query
  select
    m.candidate_id,
    m.vote_count

  from public.debate_mvp_snapshots m

  where m.agenda_id = p_agenda_id

  order by m.vote_count desc, m.id;
end;
$$;

revoke all on function public.debate_mvp_results(bigint)
from public, anon, authenticated;

grant execute on function public.debate_mvp_results(bigint)
to authenticated;



-- Officer-only editing before any opinions are submitted.

create function public.debate_edit_agenda(
  p_agenda_id bigint,
  p_title text,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
begin
  if public.is_approved() is not true
     or public.is_officer() is not true then
    raise exception 'Officer permission required';
  end if;

  select stage
  into v_stage
  from public.debate_sessions
  where agenda_id = p_agenda_id
  for update;

  if v_stage is distinct from 'pre' then
    raise exception 'Debate cannot be edited at this stage';
  end if;

  if exists (
    select 1
    from public.debate_pre_opinions
    where agenda_id = p_agenda_id
  ) then
    raise exception 'Submitted opinions must be preserved';
  end if;

  if p_title is null
     or char_length(btrim(p_title)) not between 1 and 100 then
    raise exception 'Invalid agenda title';
  end if;

  if char_length(coalesce(btrim(p_description), '')) > 2000 then
    raise exception 'Description is too long';
  end if;

  update public.agendas
  set
    title = btrim(p_title),
    description = nullif(btrim(p_description), '')
  where id = p_agenda_id;

  update public.debate_sessions
  set updated_at = now()
  where agenda_id = p_agenda_id;
end;
$$;

revoke all on function public.debate_edit_agenda(bigint, text, text)
from public, anon, authenticated;

grant execute on function public.debate_edit_agenda(bigint, text, text)
to authenticated;


-- Officer-only cancellation of an unused debate.

create function public.debate_cancel_agenda(
  p_agenda_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
begin
  if public.is_approved() is not true
     or public.is_officer() is not true then
    raise exception 'Officer permission required';
  end if;

  select stage
  into v_stage
  from public.debate_sessions
  where agenda_id = p_agenda_id
  for update;

  if v_stage is distinct from 'pre' then
    raise exception 'Debate cannot be cancelled at this stage';
  end if;

  if exists (
    select 1
    from public.debate_pre_opinions
    where agenda_id = p_agenda_id
  ) or exists (
    select 1
    from public.debate_post_opinions
    where agenda_id = p_agenda_id
  ) or exists (
    select 1
    from public.debate_mvp_votes
    where agenda_id = p_agenda_id
  ) or exists (
    select 1
    from public.opinions
    where agenda_id = p_agenda_id
  ) or exists (
    select 1
    from public.decisions
    where agenda_id = p_agenda_id
  ) then
    raise exception 'Existing debate records must be preserved';
  end if;

  delete from public.agendas
  where id = p_agenda_id;
end;
$$;

revoke all on function public.debate_cancel_agenda(bigint)
from public, anon, authenticated;

grant execute on function public.debate_cancel_agenda(bigint)
to authenticated;

-- Officer-only anonymous voting progress
create function public.debate_vote_count(
  p_agenda_id bigint
)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_approved() is not true
     or public.is_officer() is not true then
    raise exception 'Officer permission required';
  end if;

  if not exists (
    select 1
    from public.debate_sessions s
    where s.agenda_id = p_agenda_id
      and s.stage = 'voting'
  ) then
    raise exception 'Voting is not active';
  end if;

  return (
    select count(*)
    from public.debate_mvp_votes v
    join public.profiles voter
      on voter.id = v.voter_id
    join public.profiles candidate
      on candidate.id = v.candidate_id
    where v.agenda_id = p_agenda_id
      and voter.status = 'approved'
      and candidate.status = 'approved'
  );
end;
$$;

revoke all on function public.debate_vote_count(bigint)
from public, anon, authenticated;

grant execute on function public.debate_vote_count(bigint)
to authenticated;

-- Officer-only submission counts.
-- No opinion contents, stances or submitter identities.

create function public.debate_submission_counts(
  p_agenda_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.is_approved() is not true
     or public.is_officer() is not true then
    raise exception 'Officer permission required';
  end if;

  if not exists (
    select 1
    from public.debate_sessions
    where agenda_id = p_agenda_id
  ) then
    raise exception 'Debate session not found';
  end if;

  return jsonb_build_object(
    'preSubmitted', (
      select count(*)
      from public.debate_pre_opinions o
      join public.profiles p on p.id = o.user_id
      where o.agenda_id = p_agenda_id
        and p.status = 'approved'
    ),
    'postSubmitted', (
      select count(*)
      from public.debate_post_opinions o
      join public.profiles p on p.id = o.user_id
      where o.agenda_id = p_agenda_id
        and p.status = 'approved'
    )
  );
end;
$$;

revoke all on function
  public.debate_submission_counts(bigint)
from public, anon, authenticated;

grant execute on function
  public.debate_submission_counts(bigint)
to authenticated;

-- Officer-only participant confirmation.
create function public.debate_confirm_participants(
  p_agenda_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
  v_confirmed_at timestamptz;
  v_participant_count bigint;
begin
  if public.is_approved() is not true
     or public.is_officer() is not true then
    raise exception 'Officer permission required';
  end if;

  select stage, participants_confirmed_at
  into v_stage, v_confirmed_at
  from public.debate_sessions
  where agenda_id = p_agenda_id
  for update;

  if not found then
    raise exception 'Debate session not found';
  end if;

  if v_stage is distinct from 'pre' then
    raise exception 'Participant list cannot be confirmed at this stage';
  end if;

  if v_confirmed_at is not null then
    raise exception 'Participant list is already confirmed';
  end if;

  select count(*)
  into v_participant_count
  from public.debate_participants dp
  join public.profiles p on p.id = dp.user_id
  where dp.agenda_id = p_agenda_id
    and p.status = 'approved';

  if v_participant_count < 4 then
    raise exception 'At least four approved participants are required';
  end if;

  update public.debate_sessions
  set participants_confirmed_at = now(),
      updated_at = now()
  where agenda_id = p_agenda_id;
end;
$$;

revoke all on function
  public.debate_confirm_participants(bigint)
from public, anon, authenticated;

grant execute on function
  public.debate_confirm_participants(bigint)
to authenticated;

commit;

-- ============================================================
-- [R] 되돌리기
-- ============================================================
-- 아래 문장은 자동 실행되지 않는 롤백 참고용 주석이다.
-- 운영 적용 후 문제가 발생하면 먼저 신규 토론 사용을 중단한다.
-- 프론트엔드를 이전 버전으로 되돌리고 데이터를 백업한다.
-- 신규 토론 기록이 존재하면 아래 삭제 절차를 바로 실행하지 않는다.
-- 신규 토론을 기존 안건으로 전환하거나 별도 보존하는 계획이 필요하다.
-- 아래 절차는 신규 토론 데이터가 없는 경우에만 검토 후 실행한다.
--
-- begin;
--
-- drop policy if exists debate_block_legacy_opinion_insert on public.opinions;
-- drop policy if exists debate_block_legacy_opinion_update on public.opinions;
-- drop policy if exists debate_block_legacy_opinion_delete on public.opinions;
-- drop policy if exists debate_block_legacy_decision_insert on public.decisions;
-- drop policy if exists debate_block_legacy_decision_update on public.decisions;
-- drop policy if exists debate_block_legacy_decision_delete on public.decisions;
-- drop policy if exists debate_block_legacy_agenda_update on public.agendas;
-- drop policy if exists debate_block_legacy_agenda_delete on public.agendas;
--
-- drop trigger if exists debate_capture_results_on_close on public.debate_sessions;
--
-- drop function if exists public.debate_capture_results();
-- drop function if exists public.debate_submit_pre(bigint, text, text);
-- drop function if exists public.debate_submit_post(bigint, text, text, text);
-- drop function if exists public.debate_confirm_participants(bigint);
-- drop function if exists public.debate_add_participant(bigint, uuid);
-- drop function if exists public.debate_remove_participant(bigint, uuid);
-- drop function if exists public.debate_advance_stage(bigint, text);
-- drop function if exists public.debate_submit_vote(bigint, uuid);
-- drop function if exists public.debate_has_voted(bigint);
-- drop function if exists public.debate_vote_count(bigint);
-- drop function if exists public.debate_submission_counts(bigint);
-- drop function if exists public.debate_mvp_results(bigint);
-- drop function if exists public.debate_finalize(bigint, text);
-- drop function if exists public.debate_create_agenda(text, text);
-- drop function if exists public.debate_edit_agenda(bigint, text, text);
-- drop function if exists public.debate_cancel_agenda(bigint);
--
-- drop table if exists public.debate_mvp_snapshots;
-- drop table if exists public.debate_result_snapshots;
-- drop table if exists public.debate_mvp_votes;
-- drop table if exists public.debate_post_opinions;
-- drop table if exists public.debate_pre_opinions;
-- drop table if exists public.debate_participants;
-- drop table if exists public.debate_sessions;
--
-- commit;
--
-- 주의: 삭제된 신규 토론 데이터는 자동 복구되지 않는다.
-- ============================================================
