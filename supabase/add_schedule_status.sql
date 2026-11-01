-- 추가용 SQL: 시간표 "입력 완료" 상태 (schema.sql 실행 후 이것을 실행)
-- 승인된 부원은 시간표를 입력하고 "입력 완료"를 눌러야 다른 화면을 쓸 수 있다. (화면에서만 강제)
-- 한 번 완료하면 계속 완료 상태라서 수정·삭제 권한은 주지 않는다.
-- 아래 [1] → [2] 순서로, 구간을 나눠서 하나씩 실행한다.

-- ============================================================
-- [1] 입력 완료 테이블 + 권한 (RLS)
-- ============================================================
create table public.schedule_status (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now()
);

alter table public.schedule_status enable row level security;

revoke all on public.schedule_status from public, anon, authenticated;
grant select, insert on public.schedule_status to authenticated;

-- 읽기: 본인 것, 그리고 승인된 부원은 누가 완료했는지 볼 수 있다 (공통 시간 화면의 "미입력" 표시용)
create policy schedule_status_select on public.schedule_status
  for select to authenticated
  using (user_id = auth.uid() or public.is_approved());

-- 쓰기: 본인 것만, 승인된 사람만
create policy schedule_status_insert on public.schedule_status
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved());

-- ============================================================
-- [2] 기존 부원 정리: 이미 시간표를 입력한 사람은 자동으로 "입력 완료" 처리
-- ============================================================
insert into public.schedule_status (user_id)
select distinct sb.user_id
from public.schedule_blocks sb
join public.profiles p on p.id = sb.user_id
on conflict (user_id) do nothing;

-- 결과 확인 (읽기만 함): 누가 완료 처리됐는지
-- select p.name, p.status, s.completed_at
-- from public.profiles p left join public.schedule_status s on s.user_id = p.id
-- order by p.created_at;

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행)
-- ============================================================
-- drop table public.schedule_status;
