-- 콘텐츠 플래너 권한 함수 ① (콘텐츠 권한 판단을 이 파일 한곳에 모았다)
-- 콘텐츠 플래너(content_posts)의 정책과 함수는 아래 세 함수로만 권한을 판단한다.
-- 다음 회장 때 "팀장" 직책이 생기면 can_manage_content() 한 곳만 고치면 된다(방법은 아래 [팀장 추가 방법]).
--
--   can_manage_content()  콘텐츠를 만들고 고치고 지울 수 있는 사람. 지금은 임원진.
--   can_view_content()    콘텐츠 플래너를 읽을 수 있는 사람. 승인된 사용자 중 졸업생이 아닌 사람.
--   is_content_assignee() 담당자로 지정할 수 있는 사람. 승인된 부원 중 졸업생이 아닌 사람(임원진 포함).
--
-- 이 파일은 새 함수만 추가한다. 기존 테이블과 데이터는 건드리지 않는다.
-- 실행 전에는 PLAN.md 8-6의 "처음 한 번" 백업(CSV)을 해 둔다.
-- 실행 순서: ① 이 파일 → ② add_content_posts.sql → 프론트 배포. (②가 이 파일의 함수를 쓰므로 순서를 지킨다.)
-- 사용하는 기존 함수와 테이블: public.is_approved(), public.is_officer(), public.member_alumni (add_member_alumni.sql 을 먼저 실행했어야 한다)

-- 콘텐츠를 만들고 고치고 지울 수 있는 사람
create or replace function public.can_manage_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_officer();
$$;

-- 콘텐츠 플래너를 읽을 수 있는 사람(졸업생은 DB에서도 읽지 못한다)
create or replace function public.can_view_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_approved()
     and not exists (select 1 from public.member_alumni a where a.user_id = auth.uid());
$$;

-- 담당자로 지정할 수 있는 사람(승인된 부원, 졸업생 제외)
create or replace function public.is_content_assignee(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.status = 'approved'
      and not exists (select 1 from public.member_alumni a where a.user_id = p.id)
  );
$$;

revoke all on function public.can_manage_content()        from public, anon;
revoke all on function public.can_view_content()          from public, anon;
revoke all on function public.is_content_assignee(uuid)   from public, anon;
grant execute on function public.can_manage_content()        to authenticated;
grant execute on function public.can_view_content()          to authenticated;
grant execute on function public.is_content_assignee(uuid)   to authenticated;

-- ============================================================
-- [팀장 추가 방법] (나중에 팀장 직책이 생겼을 때)
-- ============================================================
-- 1) 팀장을 나타내는 작은 테이블을 새로 만든다. 졸업생 지정(member_alumni)과 같은 구조다.
--      create table public.team_leads (user_id uuid primary key references public.profiles (id) on delete cascade);
--    (RLS를 켜고, 읽기는 승인된 사용자, 쓰기는 임원진만 두는 정책을 add_member_alumni.sql 처럼 붙인다.)
-- 2) 팀장을 판단하는 함수를 만든다(security definer, set search_path = '').
--      create function public.is_team_lead()
--      returns boolean
--      language sql
--      stable
--      security definer
--      set search_path = ''
--      as $$
--        select exists (select 1 from public.team_leads where user_id = auth.uid());
--      $$;
-- 3) 이 파일의 can_manage_content() 본문을 다음처럼 바꿔 다시 실행한다.
--      select public.is_officer() or public.is_team_lead();
--    (create or replace 로 이 함수만 바꾸면 content_posts 의 정책과 함수가 모두 따라간다.)
-- 4) 화면(src/pages/ContentPlanner.tsx 의 canManage)도 팀장이 보이도록 고친다. 화면은 편의일 뿐이고, 실제 권한은 DB 함수가 막는다.
-- 5) 부원 관리 화면에 팀장 지정 토글을 만든다(Admin.tsx 의 졸업 지정과 같은 방식).

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. add_content_posts.sql 을 먼저 되돌려야 한다)
-- ============================================================
-- drop function if exists public.is_content_assignee(uuid);
-- drop function if exists public.can_view_content();
-- drop function if exists public.can_manage_content();
