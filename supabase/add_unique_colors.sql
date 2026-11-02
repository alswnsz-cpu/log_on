-- 추가용 SQL: 부원 색상이 서로 겹치지 않게 하기 (add_member_events.sql 실행 후 이것을 실행)
--   · 한 색은 한 명만 쓸 수 있다 (유일 인덱스). 탈퇴하면 색이 비워져 다음 사람이 쓸 수 있다.
--   · 색이 없는 승인된 부원에게는 안 쓰는 색을 가입 순서대로 자동 배정한다. (지금 있는 부원 포함)
--   · 앞으로 승인될 때도 안 쓰는 색이 자동으로 붙는다. (색은 12가지라 12명을 넘으면 남는 색이 없다)
-- 아래 [1] → [2] 순서로, 구간을 나눠서 하나씩 실행한다.

-- ============================================================
-- [1] 지금 있는 부원 정리: 색 배정 + 한 색은 한 명만
-- ============================================================
begin;

do $$
declare
  palette text[] := array[
    '#dc2626', '#c2410c', '#a16207', '#4d7c0f', '#15803d', '#0f766e',
    '#0e7490', '#2563eb', '#1e3a8a', '#db2777', '#831843', '#78716c'
  ];
  r record;
  c text;
begin
  -- 승인되지 않은 계정(탈퇴·거절·대기)은 색을 비운다
  update public.profiles set color = null where status <> 'approved' and color is not null;

  -- 같은 색을 둘 이상이 쓰고 있다면 먼저 가입한 사람만 남기고 나머지는 비운다
  update public.profiles p set color = null
  where color is not null
    and exists (
      select 1 from public.profiles q
      where q.color = p.color and (q.created_at, q.id) < (p.created_at, p.id)
    );

  -- 색이 없는 승인된 부원에게 안 쓰는 색을 가입 순서대로 배정한다
  for r in select id from public.profiles where status = 'approved' and color is null order by created_at, id loop
    select t.c into c
    from unnest(palette) with ordinality as t(c, ord)
    where not exists (select 1 from public.profiles p where p.color = t.c)
    order by t.ord
    limit 1;
    exit when c is null;
    update public.profiles set color = c where id = r.id;
  end loop;
end
$$;

create unique index profiles_color_key on public.profiles (color) where color is not null;

commit;

-- ============================================================
-- [2] 앞으로의 규칙: 승인될 때 자동 배정, 색 고르기 중복 방지, 탈퇴하면 색 비우기
-- ============================================================
create or replace function public.assign_free_color()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c text;
begin
  if new.status = 'approved' and new.color is null then
    select t.c into c
    from unnest(array[
      '#dc2626', '#c2410c', '#a16207', '#4d7c0f', '#15803d', '#0f766e',
      '#0e7490', '#2563eb', '#1e3a8a', '#db2777', '#831843', '#78716c'
    ]) with ordinality as t(c, ord)
    where not exists (select 1 from public.profiles p where p.color = t.c)
    order by t.ord
    limit 1;
    new.color := c;   -- 남는 색이 없으면 비워 둔다
  end if;
  return new;
end;
$$;

revoke execute on function public.assign_free_color() from public, anon, authenticated;

create trigger profiles_assign_color
  before insert or update on public.profiles
  for each row execute function public.assign_free_color();

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
  if c is null or c not in (
    '#dc2626', '#c2410c', '#a16207', '#4d7c0f', '#15803d', '#0f766e',
    '#0e7490', '#2563eb', '#1e3a8a', '#db2777', '#831843', '#78716c'
  ) then
    raise exception '고를 수 없는 색입니다.';
  end if;
  if exists (select 1 from public.profiles where color = c and id <> auth.uid()) then
    raise exception '이미 다른 부원이 쓰는 색입니다.';
  end if;

  begin
    update public.profiles set color = c where id = auth.uid() and status = 'approved';
  exception when unique_violation then
    raise exception '이미 다른 부원이 쓰는 색입니다.';
  end;
  if not found then
    raise exception '승인된 부원만 바꿀 수 있습니다.';
  end if;
end;
$$;

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
  update public.profiles set status = 'removed', phone = null, color = null where id = p_user;
end;
$$;

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행)
-- ============================================================
-- drop trigger profiles_assign_color on public.profiles;
-- drop function public.assign_free_color();
-- drop index public.profiles_color_key;
-- update_my_color, remove_member 는 add_member_events.sql 의 [3] 버전을 다시 실행한다.
