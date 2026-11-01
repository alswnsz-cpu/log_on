-- 추가용 SQL: 임원진의 부원 강제 탈퇴 + 탈퇴자의 복귀 신청
-- 탈퇴 = profiles.status 를 'removed' 로 바꾼다. 계정과 의견은 지우지 않는다.
--   · 시간표(schedule_blocks)와 입력 완료 기록(schedule_status), 전화번호는 삭제
--   · 가입 신청서(signup_applications)는 유지 (복귀 신청 시 임원진이 다시 본다)
-- 복귀 = 탈퇴한 본인이 "복귀 신청" → status 'pending' → 임원진이 승인 대기 목록에서 승인
-- 아래 [1] → [2] 순서로, 구간을 나눠서 하나씩 실행한다.

-- ============================================================
-- [1] 상태 값에 'removed' 추가
-- ============================================================
begin;

do $$
declare
  c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';
  if c is not null then
    execute format('alter table public.profiles drop constraint %I', c);
  end if;
end
$$;

alter table public.profiles
  add constraint profiles_status_check
  check (status in ('pending', 'approved', 'rejected', 'removed'));

commit;

-- ============================================================
-- [2] 탈퇴·복귀 신청 함수 (security definer: 함수 안에서 권한을 직접 검사한다)
-- ============================================================
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
  update public.profiles set status = 'removed', phone = null where id = p_user;
end;
$$;

create or replace function public.request_rejoin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set status = 'pending'
  where id = auth.uid() and status = 'removed';
  if not found then
    raise exception '탈퇴 처리된 계정만 복귀를 신청할 수 있습니다.';
  end if;
end;
$$;

revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.request_rejoin()    from public, anon;
grant  execute on function public.remove_member(uuid) to authenticated;
grant  execute on function public.request_rejoin()    to authenticated;

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. 탈퇴 상태인 사람이 없을 때만 [1] 되돌리기 가능)
-- ============================================================
-- drop function public.remove_member(uuid);
-- drop function public.request_rejoin();
-- (탈퇴 상태 계정이 있다면 먼저 update public.profiles set status = 'approved' where status = 'removed'; 후)
-- alter table public.profiles drop constraint profiles_status_check;
-- alter table public.profiles add constraint profiles_status_check check (status in ('pending', 'approved', 'rejected'));
