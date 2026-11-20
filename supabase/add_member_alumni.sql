-- 졸업생 구분 ① 테이블 추가 (Supabase SQL Editor에서 한 번 실행)
-- member_alumni 에 행이 있으면 졸업생, 행이 없으면 현재 부원이다. 기본값은 현재 부원이므로 기존 부원은 아무 조치 없이 부원 상태다.
-- 졸업생도 profiles.status 는 approved 그대로라서 토론 의견·결론·아카이브·포트폴리오 정책(is_approved)은 바꾸지 않는다.
-- 졸업 지정과 해제는 임원진만 할 수 있고, 임원진 계정은 졸업으로 지정할 수 없다.
--
-- 실행 순서: ① 이 파일 → ② add_member_alumni_remove.sql → 프론트 배포
-- 이 파일은 현재 프론트와 충돌하지 않는다(아직 아무도 이 테이블을 읽지 않는다).

create table public.member_alumni (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 승인된 일반 부원(임원진이 아닌 사람)인지 확인한다. 정책에서 profiles 를 직접 읽지 않으려고 security definer 로 만든다.
create or replace function public.is_plain_member(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user and p.status = 'approved' and p.role = 'member'
  );
$$;

revoke all on function public.is_plain_member(uuid) from public, anon;
grant execute on function public.is_plain_member(uuid) to authenticated;

alter table public.member_alumni enable row level security;

revoke all on public.member_alumni from public, anon, authenticated;
grant select, insert, delete on public.member_alumni to authenticated;

-- 읽기: 승인된 사용자 (졸업 라벨 표시와 공통 시간에서 졸업생을 빼는 계산용)
create policy member_alumni_select on public.member_alumni
  for select to authenticated
  using (public.is_approved());

-- 졸업 지정: 임원진만, 대상은 승인된 일반 부원만 (임원진 계정은 졸업으로 지정할 수 없다)
create policy member_alumni_insert on public.member_alumni
  for insert to authenticated
  with check (public.is_officer() and public.is_plain_member(user_id));

-- 졸업 해제: 임원진만
create policy member_alumni_delete on public.member_alumni
  for delete to authenticated
  using (public.is_officer());

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. 프론트를 먼저 되돌리고, add_member_alumni_remove.sql 을 먼저 되돌려야 한다)
-- ============================================================
-- drop table if exists public.member_alumni;
-- drop function if exists public.is_plain_member(uuid);
