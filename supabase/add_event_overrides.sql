-- 추가용 SQL: 반복 일정(정기 모임)을 날짜마다 따로 수정하기
--   · event_overrides : 반복 일정의 특정 날짜에만 적용되는 내용(제목·시간·장소·메모). 없으면 원래 일정 내용을 쓴다.
--   · 한 행 = 그 날짜의 내용 전체. 시간·장소·메모가 비어 있으면 그날은 비어 있는 것이다.
--   · 읽기: 승인된 사용자 / 쓰기: 일정을 만든 사람과 임원진 (events 와 같은 규칙, 화면이 아니라 DB가 막는다)
--   · 원래 일정을 지우면 날짜별 수정도 함께 지워진다.

create table public.event_overrides (
  event_id   bigint not null references public.events (id) on delete cascade,
  occ_date   date   not null,
  title      text   not null check (char_length(title) between 1 and 100),
  start_time time,
  end_time   time,
  location   text check (location is null or char_length(location) <= 100),
  memo       text check (memo is null or char_length(memo) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (event_id, occ_date),
  check (end_time is null or (start_time is not null and end_time > start_time))
);

alter table public.event_overrides enable row level security;

revoke all on public.event_overrides from public, anon, authenticated;
grant select, insert, update, delete on public.event_overrides to authenticated;

create policy event_overrides_select on public.event_overrides
  for select to authenticated using (public.is_approved());

-- 쓰기: 원래 일정을 만든 사람이거나 임원진
create policy event_overrides_insert on public.event_overrides
  for insert to authenticated
  with check (
    public.is_approved()
    and exists (
      select 1 from public.events e
      where e.id = event_id and (e.created_by = auth.uid() or public.is_officer())
    )
  );

create policy event_overrides_update on public.event_overrides
  for update to authenticated
  using (
    public.is_approved()
    and exists (
      select 1 from public.events e
      where e.id = event_id and (e.created_by = auth.uid() or public.is_officer())
    )
  )
  with check (
    public.is_approved()
    and exists (
      select 1 from public.events e
      where e.id = event_id and (e.created_by = auth.uid() or public.is_officer())
    )
  );

create policy event_overrides_delete on public.event_overrides
  for delete to authenticated
  using (
    public.is_approved()
    and exists (
      select 1 from public.events e
      where e.id = event_id and (e.created_by = auth.uid() or public.is_officer())
    )
  );

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. 날짜별 수정 내용은 모두 사라진다)
-- ============================================================
-- drop table public.event_overrides;
