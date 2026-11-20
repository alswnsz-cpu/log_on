-- 콘텐츠 플래너 ② 게시물 테이블 (Supabase SQL Editor에서 한 번 실행)
-- 동아리 공용 인스타그램 게시 일정이다.
--   · 읽기: 졸업생이 아닌 승인된 사용자(can_view_content). 졸업생은 DB에서도 읽지 못한다.
--   · 만들기·수정·삭제: can_manage_content() 가 참인 사람(지금은 임원진).
--   · 담당자는 자기 게시물의 "게시 상태"와 "검토"만 set_post_progress 함수로 바꾼다(테이블을 직접 고칠 수는 없다).
--   · 앞으로/뒤로(인접한 두 게시물의 게시 예정일시 교환)는 swap_post_times 함수로 한 번에 처리한다.
-- 이 파일은 새 테이블과 함수만 추가한다. 기존 테이블과 데이터는 건드리지 않는다.
-- 실행 전에는 PLAN.md 8-6의 "처음 한 번" 백업(CSV)을 해 둔다.
-- 실행 순서: add_content_permissions.sql 을 먼저 실행한 뒤 이 파일 → 프론트 배포.
-- 사용하는 기존 함수: public.touch_updated_at() (schema.sql)
-- 참고: 담당자가 나중에 졸업생이 되면 그 게시물을 고칠 때 담당자를 다시 지정해야 한다(담당자 검사 때문).

create table public.content_posts (
  id           bigint generated always as identity primary key,
  title        text not null check (char_length(title) between 1 and 200),
  -- card_news 카드뉴스, reels 릴스, live 실시간 콘텐츠
  post_type    text not null check (post_type in ('card_news', 'reels', 'live')),
  scheduled_at timestamptz not null,
  -- 담당자가 탈퇴해 계정이 지워져도 게시물은 남도록 set null
  assignee_id  uuid references public.profiles (id) on delete set null,
  -- planning 기획 중, producing 제작 중, reviewing 검토 중, scheduled 게시 예정, published 게시 완료
  status       text not null default 'planning'
               check (status in ('planning', 'producing', 'reviewing', 'scheduled', 'published')),
  -- 검토: false 대기, true 완료
  review_done  boolean not null default false,
  caption      text check (caption is null or char_length(caption) <= 2200),
  material_url text check (material_url is null or (char_length(material_url) <= 500 and material_url ~* '^https?://')),
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index content_posts_scheduled_idx on public.content_posts (scheduled_at);
create index content_posts_assignee_idx  on public.content_posts (assignee_id);

alter table public.content_posts enable row level security;

revoke all on public.content_posts from public, anon, authenticated;
grant select, insert, update, delete on public.content_posts to authenticated;

create policy content_posts_select on public.content_posts
  for select to authenticated
  using (public.can_view_content());

create policy content_posts_insert on public.content_posts
  for insert to authenticated
  with check (
    public.can_manage_content()
    and created_by = auth.uid()
    and (assignee_id is null or public.is_content_assignee(assignee_id))
  );

create policy content_posts_update on public.content_posts
  for update to authenticated
  using (public.can_manage_content())
  with check (
    public.can_manage_content()
    and (assignee_id is null or public.is_content_assignee(assignee_id))
  );

create policy content_posts_delete on public.content_posts
  for delete to authenticated
  using (public.can_manage_content());

-- 수정하면 수정 시각을 서버에서 갱신한다 (schema.sql 의 기존 함수 사용)
create trigger content_posts_touch
  before update on public.content_posts
  for each row execute function public.touch_updated_at();

-- 담당자(또는 콘텐츠 관리자)가 게시 상태와 검토만 바꾼다. 다른 칸은 바꿀 수 없다.
create or replace function public.set_post_progress(p_post bigint, p_status text, p_review_done boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_view_content() then
    raise exception '콘텐츠 플래너를 볼 수 있는 사람만 바꿀 수 있습니다.';
  end if;
  if p_status is null or p_status not in ('planning', 'producing', 'reviewing', 'scheduled', 'published') then
    raise exception '게시 상태가 올바르지 않습니다.';
  end if;
  if p_review_done is null then
    raise exception '검토 값이 올바르지 않습니다.';
  end if;

  update public.content_posts
     set status = p_status, review_done = p_review_done
   where id = p_post
     and (assignee_id = auth.uid() or public.can_manage_content());
  if not found then
    raise exception '내 게시물이 아니거나 게시물을 찾을 수 없습니다.';
  end if;
end;
$$;

-- 인접한 두 게시물의 게시 예정일시를 서로 바꾼다(콘텐츠 관리자만). 한 번에 처리해서 한쪽만 바뀌는 일이 없다.
create or replace function public.swap_post_times(p_a bigint, p_b bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  time_a timestamptz;
  time_b timestamptz;
begin
  if not public.can_manage_content() then
    raise exception '콘텐츠를 관리할 수 있는 사람만 순서를 바꿀 수 있습니다.';
  end if;
  if p_a is null or p_b is null or p_a = p_b then
    raise exception '서로 다른 두 게시물을 골라 주세요.';
  end if;

  -- 항상 작은 번호부터 잠가서 두 요청이 겹쳐도 서로 기다리다 멈추지 않게 한다
  perform 1 from public.content_posts where id in (p_a, p_b) order by id for update;

  select scheduled_at into time_a from public.content_posts where id = p_a;
  select scheduled_at into time_b from public.content_posts where id = p_b;
  if time_a is null or time_b is null then
    raise exception '게시물을 찾을 수 없습니다.';
  end if;

  update public.content_posts set scheduled_at = time_b where id = p_a;
  update public.content_posts set scheduled_at = time_a where id = p_b;
end;
$$;

revoke all on function public.set_post_progress(bigint, text, boolean) from public, anon;
revoke all on function public.swap_post_times(bigint, bigint)          from public, anon;
grant execute on function public.set_post_progress(bigint, text, boolean) to authenticated;
grant execute on function public.swap_post_times(bigint, bigint)          to authenticated;

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. 프론트를 먼저 되돌린다)
-- ============================================================
-- 테이블을 지우면 정책과 인덱스, 트리거도 함께 지워진다. 적어 둔 게시물이 모두 사라지므로 먼저 백업한다.
-- drop function if exists public.swap_post_times(bigint, bigint);
-- drop function if exists public.set_post_progress(bigint, text, boolean);
-- drop table if exists public.content_posts;
