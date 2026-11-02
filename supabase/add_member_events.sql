-- 추가용 SQL: 부원도 달력에 일정 작성 + 부원별 색상 (add_events.sql, add_event_repeat.sql 실행 후 이것을 실행)
--   · 일정은 "동아리 공식 일정"(임원진만 작성)과 "개인 일정"(승인된 부원 누구나, 본인 것만 수정·삭제)으로 나눈다.
--   · 임원진은 모든 일정을 수정·삭제할 수 있다.
--   · 부원마다 색상 하나를 고른다 (profiles.color, 정해진 12색 중에서).
--   · 부원을 탈퇴 처리하면 그 사람의 개인 일정도 함께 삭제한다. (공식 일정은 남는다)
-- 아래 [1] → [2] → [3] 순서로, 구간을 나눠서 하나씩 실행한다.

-- ============================================================
-- [1] 칸 추가: 일정의 공식 여부, 부원의 색상
-- ============================================================
alter table public.events
  add column is_club boolean not null default false;

-- 지금까지 있던 일정은 모두 임원진이 만든 정기모임이므로 공식 일정으로 표시한다.
update public.events set is_club = true;

alter table public.profiles
  add column color text;

alter table public.profiles
  add constraint profiles_color_check check (
    color is null or color in (
      '#dc2626', '#c2410c', '#a16207', '#4d7c0f', '#15803d', '#0f766e',
      '#0e7490', '#2563eb', '#1e3a8a', '#db2777', '#831843', '#78716c'
    )
  );

-- 색상은 달력에서 모든 부원에게 보여야 하므로 읽기를 허용한다. (쓰기는 아래 함수로만)
grant select (color) on public.profiles to authenticated;

-- ============================================================
-- [2] 일정 권한 규칙 교체
-- ============================================================
drop policy events_insert on public.events;
drop policy events_update on public.events;
drop policy events_delete on public.events;

-- 추가: 승인된 부원이 본인 이름으로만. 공식 일정은 임원진만.
create policy events_insert on public.events
  for insert to authenticated
  with check (
    public.is_approved()
    and created_by = auth.uid()
    and (is_club = false or public.is_officer())
  );

-- 수정: 본인 일정, 또는 임원진은 모든 일정. 일반 부원은 공식 일정으로 바꿀 수 없다.
create policy events_update on public.events
  for update to authenticated
  using (public.is_approved() and (created_by = auth.uid() or public.is_officer()))
  with check (
    public.is_approved()
    and (created_by = auth.uid() or public.is_officer())
    and (is_club = false or public.is_officer())
  );

-- 삭제: 본인 일정, 또는 임원진은 모든 일정
create policy events_delete on public.events
  for delete to authenticated
  using (public.is_approved() and (created_by = auth.uid() or public.is_officer()));

-- ============================================================
-- [3] 함수: 내 색상 바꾸기 + 탈퇴 처리 때 개인 일정 삭제
-- ============================================================
create or replace function public.update_my_color(p_color text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c text := nullif(btrim(coalesce(p_color, '')), '');
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if c is not null and c not in (
    '#dc2626', '#c2410c', '#a16207', '#4d7c0f', '#15803d', '#0f766e',
    '#0e7490', '#2563eb', '#1e3a8a', '#db2777', '#831843', '#78716c'
  ) then
    raise exception '고를 수 없는 색입니다.';
  end if;

  update public.profiles set color = c where id = auth.uid() and status = 'approved';
  if not found then
    raise exception '승인된 부원만 바꿀 수 있습니다.';
  end if;
end;
$$;

revoke execute on function public.update_my_color(text) from public, anon;
grant  execute on function public.update_my_color(text) to authenticated;

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
  delete from public.events where created_by = p_user and is_club = false;
  update public.profiles set status = 'removed', phone = null where id = p_user;
end;
$$;

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행)
-- ============================================================
-- 1) add_events.sql 의 events_insert / events_update / events_delete 정책을 다시 만든다 (임원진만 쓰기)
-- 2) drop function public.update_my_color(text);
-- 3) alter table public.profiles drop constraint profiles_color_check, drop column color;
-- 4) alter table public.events drop column is_club;
-- 5) remove_member 는 add_withdrawal_request.sql 의 [2] 버전을 다시 실행한다.
