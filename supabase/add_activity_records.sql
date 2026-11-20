-- 활동 기록 ① 테이블 추가 (Supabase SQL Editor에서 한 번 실행)
-- 부원이 자기 활동을 적어 두는 기록이다. 포트폴리오 문장을 만들 때 이 기록을 쓴다.
--   · 본인만 읽기·쓰기. 임원진도 다른 사람 것은 볼 수 없다.
-- 이 파일은 새 테이블만 추가한다. 기존 테이블(portfolio 의 activities 포함)과 데이터는 건드리지 않는다.
-- 실행 전에는 PLAN.md 8-6의 "처음 한 번" 백업(CSV)을 해 둔다.
-- 실행 순서: ① 이 파일 → (원하면) copy_activities_to_records.sql → 프론트 배포.
-- 사용하는 기존 함수: public.is_approved(), public.touch_updated_at() (schema.sql)

create table public.activity_records (
  id                 bigint generated always as identity primary key,
  user_id            uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title              text not null check (char_length(title) between 1 and 200),
  category           text check (category is null or char_length(category) <= 100),
  -- 내가 맡은 역할 (예: 팀장, 디자인 담당)
  role_text          text check (role_text is null or char_length(role_text) <= 200),
  description        text check (description is null or char_length(description) <= 4000),
  -- 활동에서 낸 결과 (예: 참가자 120명 모집, 장려상)
  outcome            text check (outcome is null or char_length(outcome) <= 2000),
  started_on         date,
  ended_on           date,
  -- 포트폴리오의 기존 activities 에서 복사한 행이면 원본 id(중복 복사를 막고, 복사본만 골라 되돌릴 때 쓴다)
  source_activity_id uuid unique,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);

create index activity_records_user_idx on public.activity_records (user_id, started_on desc);

alter table public.activity_records enable row level security;

revoke all on public.activity_records from public, anon, authenticated;
grant select, insert, update, delete on public.activity_records to authenticated;

create policy activity_records_select on public.activity_records
  for select to authenticated
  using (public.is_approved() and user_id = auth.uid());

create policy activity_records_insert on public.activity_records
  for insert to authenticated
  with check (public.is_approved() and user_id = auth.uid());

create policy activity_records_update on public.activity_records
  for update to authenticated
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());

create policy activity_records_delete on public.activity_records
  for delete to authenticated
  using (public.is_approved() and user_id = auth.uid());

create trigger activity_records_touch
  before update on public.activity_records
  for each row execute function public.touch_updated_at();

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. 프론트를 먼저 되돌린다)
-- ============================================================
-- 테이블을 지우면 정책과 인덱스, 트리거도 함께 지워진다. 적어 둔 활동 기록이 모두 사라지므로 먼저 백업한다.
-- drop table if exists public.activity_records;
