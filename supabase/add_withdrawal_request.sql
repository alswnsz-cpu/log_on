-- 추가용 SQL: 부원의 탈퇴 신청 (add_member_removal.sql 실행 후 이것을 실행)
-- 부원이 탈퇴를 신청하면 임원진이 승인해서 탈퇴 처리한다. (승인 = 기존 remove_member 호출)
--   · 부원: 본인 신청만 만들고 취소할 수 있다. 임원진은 신청할 수 없다. (먼저 부원으로 변경)
--   · 임원진: 모든 신청을 보고, 거절(신청 삭제)하거나 승인(remove_member)한다.
-- 아래 [1] → [2] 순서로, 구간을 나눠서 하나씩 실행한다.

-- ============================================================
-- [1] 탈퇴 신청 테이블 + 권한 (RLS)
-- ============================================================
create table public.withdrawal_requests (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  reason       text check (reason is null or char_length(reason) <= 200),
  requested_at timestamptz not null default now()
);

alter table public.withdrawal_requests enable row level security;

revoke all on public.withdrawal_requests from public, anon, authenticated;
grant select, insert, delete on public.withdrawal_requests to authenticated;

-- 읽기: 본인 신청, 임원진은 전부
create policy withdrawal_requests_select on public.withdrawal_requests
  for select to authenticated
  using (user_id = auth.uid() or public.is_officer());

-- 신청: 본인 것만, 승인된 부원만, 임원진은 불가
create policy withdrawal_requests_insert on public.withdrawal_requests
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved() and not public.is_officer());

-- 취소·거절: 본인 신청은 본인이, 모든 신청은 임원진이 지울 수 있다
create policy withdrawal_requests_delete on public.withdrawal_requests
  for delete to authenticated
  using (user_id = auth.uid() or public.is_officer());

-- ============================================================
-- [2] 탈퇴 처리 함수 교체: 탈퇴 처리 때 그 사람의 탈퇴 신청도 함께 정리
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
  delete from public.withdrawal_requests where user_id = p_user;
  update public.profiles set status = 'removed', phone = null where id = p_user;
end;
$$;

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행)
-- ============================================================
-- drop table public.withdrawal_requests;
-- 그리고 add_member_removal.sql 의 [2] remove_member 함수를 다시 실행 (신청 정리 줄이 없는 버전)
