-- 추가용 SQL: 달력 일정 (schema.sql 실행 후 이것을 실행)
-- 정기모임 같은 일정을 임원진이 넣고, 승인된 부원은 볼 수 있다.
--   · 읽기: 승인된 사용자 / 쓰기(추가·수정·삭제): 임원진만 (화면이 아니라 DB가 막는다)

create table public.events (
  id         bigint generated always as identity primary key,
  title      text not null check (char_length(title) between 1 and 100),
  event_date date not null,
  start_time time,
  end_time   time,
  location   text check (location is null or char_length(location) <= 100),
  memo       text check (memo is null or char_length(memo) <= 1000),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  -- 종료 시간은 시작 시간이 있을 때만, 그리고 시작보다 늦어야 한다
  check (end_time is null or (start_time is not null and end_time > start_time))
);

create index events_date_idx on public.events (event_date);

alter table public.events enable row level security;

revoke all on public.events from public, anon, authenticated;
grant select, insert, update, delete on public.events to authenticated;

create policy events_select on public.events
  for select to authenticated using (public.is_approved());

create policy events_insert on public.events
  for insert to authenticated
  with check (public.is_officer() and created_by = auth.uid());

create policy events_update on public.events
  for update to authenticated
  using (public.is_officer()) with check (public.is_officer());

create policy events_delete on public.events
  for delete to authenticated using (public.is_officer());

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행)
-- ============================================================
-- drop table public.events;
