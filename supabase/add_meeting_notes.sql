-- 회의 변경 이력(회의록) ① 테이블 추가 (Supabase SQL Editor에서 한 번 실행)
-- 회의에서 합의한 사항과 콘텐츠 변경 내용을 적는 공간이다. 일정(events)의 변경을 자동으로 기록하는 것이 아니다.
--   · 읽기: 승인된 사용자(졸업생 포함)
--   · 추가·수정·삭제: 임원진만 (화면이 아니라 DB가 막는다)
-- 이 파일은 새 테이블만 추가한다. 기존 테이블과 데이터는 건드리지 않는다.
-- 실행 전에는 PLAN.md 8-6의 "처음 한 번" 백업(CSV)을 해 둔다.
-- 실행 순서: 이 파일 → 프론트 배포. 이 파일은 현재 배포된 화면과 충돌하지 않는다(아직 아무도 이 테이블을 읽지 않는다).
-- 사용하는 기존 함수: public.is_approved(), public.is_officer(), public.touch_updated_at() (schema.sql)

create table public.meeting_notes (
  id           bigint generated always as identity primary key,
  title        text not null check (char_length(title) between 1 and 100),
  meeting_date date not null,
  body         text not null check (char_length(body) between 1 and 5000),
  -- 작성자가 탈퇴해 계정이 지워져도 회의록은 남도록 set null
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 목록은 회의 날짜 내림차순
create index meeting_notes_date_idx on public.meeting_notes (meeting_date desc, created_at desc);

alter table public.meeting_notes enable row level security;

revoke all on public.meeting_notes from public, anon, authenticated;
grant select, insert, update, delete on public.meeting_notes to authenticated;

create policy meeting_notes_select on public.meeting_notes
  for select to authenticated
  using (public.is_approved());

create policy meeting_notes_insert on public.meeting_notes
  for insert to authenticated
  with check (public.is_officer() and created_by = auth.uid());

create policy meeting_notes_update on public.meeting_notes
  for update to authenticated
  using (public.is_officer())
  with check (public.is_officer());

create policy meeting_notes_delete on public.meeting_notes
  for delete to authenticated
  using (public.is_officer());

-- 수정하면 수정 시각을 서버에서 갱신한다 (schema.sql 의 기존 함수 사용)
create trigger meeting_notes_touch
  before update on public.meeting_notes
  for each row execute function public.touch_updated_at();

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. 프론트를 먼저 되돌린다)
-- ============================================================
-- 테이블을 지우면 정책과 인덱스, 트리거도 함께 지워진다. 적어 둔 회의록이 모두 사라지므로 먼저 백업한다.
-- drop table if exists public.meeting_notes;
