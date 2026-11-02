-- 추가용 SQL: 관리 화면의 부원 순서를 임원진이 직접 정하기
--   · profiles.sort_order : 부원 목록에서의 순서 (작을수록 위). 비어 있으면 가입한 순서로 맨 아래에 붙는다.
--   · set_member_order(ids) : 임원진만 호출 가능. 받은 순서대로 1, 2, 3... 을 매긴다. 빈 목록이면 모두 가입순으로 되돌린다.
-- 아래 [1] → [2] 순서로, 구간을 나눠서 하나씩 실행한다.

-- ============================================================
-- [1] 순서 칸 추가
-- ============================================================
alter table public.profiles
  add column sort_order integer;

-- 임원진이 목록을 정렬하려면 읽을 수 있어야 한다. (쓰기는 아래 함수로만)
grant select (sort_order) on public.profiles to authenticated;

-- ============================================================
-- [2] 순서 바꾸기 함수 (임원진만)
-- ============================================================
create or replace function public.set_member_order(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  i integer;
begin
  if not public.is_officer() then
    raise exception '임원진만 순서를 바꿀 수 있습니다.';
  end if;

  -- 빈 목록이면 모두 가입순으로 되돌린다
  if p_ids is null or cardinality(p_ids) = 0 then
    update public.profiles set sort_order = null where sort_order is not null;
    return;
  end if;

  if cardinality(p_ids) > 200 then
    raise exception '한 번에 바꿀 수 있는 부원 수를 넘었습니다.';
  end if;

  for i in 1 .. cardinality(p_ids) loop
    update public.profiles set sort_order = i where id = p_ids[i] and status = 'approved';
  end loop;
end;
$$;

revoke execute on function public.set_member_order(uuid[]) from public, anon;
grant  execute on function public.set_member_order(uuid[]) to authenticated;

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행)
-- ============================================================
-- drop function public.set_member_order(uuid[]);
-- alter table public.profiles drop column sort_order;
