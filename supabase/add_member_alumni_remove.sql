-- 졸업생 구분 ② 탈퇴 처리에서 졸업 표시도 함께 지우기 (Supabase SQL Editor에서 한 번 실행)
-- remove_member 는 add_unique_colors.sql 의 버전(가장 최근 정의)에 "member_alumni 행 삭제" 한 줄만 더한 것이다.
-- 나중에 탈퇴한 사람이 복귀 신청으로 돌아와도 졸업생 상태로 돌아오지 않는다.
--
-- 실행 순서: add_member_alumni.sql 을 먼저 실행한 뒤에 이 파일을 실행한다.
--           테이블이 없는 상태에서 이 함수를 만들면 탈퇴 처리를 할 때 오류가 난다.
-- 이 함수의 실행 권한은 create or replace 로 유지되지만, 확실하게 하려고 아래에서 다시 지정한다.

create or replace function public.remove_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles;
begin
  if not public.is_officer() then
    raise exception '임원진만 탈퇴시킬 수 있습니다.';
  end if;
  select * into target from public.profiles where id = p_user;
  if not found then
    raise exception '대상 부원을 찾을 수 없습니다.';
  end if;
  if p_user = auth.uid() then
    raise exception '자기 자신은 탈퇴시킬 수 없습니다.';
  end if;
  if target.role <> 'member' then
    raise exception '임원진은 먼저 부원으로 변경해 주세요.';
  end if;
  if target.status <> 'approved' then
    raise exception '승인된 부원만 탈퇴시킬 수 있습니다.';
  end if;

  delete from public.schedule_blocks where user_id = p_user;
  delete from public.schedule_status where user_id = p_user;
  delete from public.withdrawal_requests where user_id = p_user;
  delete from public.member_alumni where user_id = p_user;
  delete from public.events where created_by = p_user and is_club = false;
  update public.profiles set status = 'removed', phone = null, color = null where id = p_user;
end;
$$;

revoke execute on function public.remove_member(uuid) from public, anon;
grant  execute on function public.remove_member(uuid) to authenticated;

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. 아래 함수는 add_unique_colors.sql 의 원래 버전이다)
-- ============================================================
-- create or replace function public.remove_member(p_user uuid)
-- returns void
-- language plpgsql
-- security definer
-- set search_path = ''
-- as $$
-- declare
--   target public.profiles;
-- begin
--   if not public.is_officer() then
--     raise exception '임원진만 탈퇴시킬 수 있습니다.';
--   end if;
--   select * into target from public.profiles where id = p_user;
--   if not found then
--     raise exception '대상 부원을 찾을 수 없습니다.';
--   end if;
--   if p_user = auth.uid() then
--     raise exception '자기 자신은 탈퇴시킬 수 없습니다.';
--   end if;
--   if target.role <> 'member' then
--     raise exception '임원진은 먼저 부원으로 변경해 주세요.';
--   end if;
--   if target.status <> 'approved' then
--     raise exception '승인된 부원만 탈퇴시킬 수 있습니다.';
--   end if;
--
--   delete from public.schedule_blocks where user_id = p_user;
--   delete from public.schedule_status where user_id = p_user;
--   delete from public.withdrawal_requests where user_id = p_user;
--   delete from public.events where created_by = p_user and is_club = false;
--   update public.profiles set status = 'removed', phone = null, color = null where id = p_user;
-- end;
-- $$;
