-- LOG:ON 1단계: 포트폴리오 (portfolios, certifications, activities)
-- ※ add_logon_tables.sql 을 단계별로 나눈 3개 파일 중 첫 번째. schema.sql 실행 후 이것을 실행. 실행 전 반드시 백업.
--
-- LOG:ON 의 권한 함수를 이 앱의 함수로 대응시켰다.
--   is_active_member() → is_approved()   (승인된 회원)
--   is_logon_admin()   → is_officer()    (임원진 = 회장·부회장)
-- 개인정보 규칙
--   · 포트폴리오·자격증·활동: 본인만 읽기·쓰기 (임원진도 다른 사람 것은 볼 수 없다)

-- ============================================================
-- 1. 테이블
-- ============================================================

create table public.portfolios (
  user_id    uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  content    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.certifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  issuer        text check (issuer is null or char_length(issuer) <= 200),
  acquired_date date,
  details       text check (details is null or char_length(details) <= 2000),
  created_at    timestamptz not null default now()
);

create table public.activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  category    text check (category is null or char_length(category) <= 100),
  description text check (description is null or char_length(description) <= 4000),
  started_on  date,
  ended_on    date,
  created_at  timestamptz not null default now(),
  check (ended_on is null or started_on is null or ended_on >= started_on)
);

create index certifications_user_idx on public.certifications (user_id);
create index activities_user_idx     on public.activities (user_id);

-- ============================================================
-- 2. 권한과 RLS
-- ============================================================

alter table public.portfolios     enable row level security;
alter table public.certifications enable row level security;
alter table public.activities     enable row level security;

revoke all on public.portfolios, public.certifications, public.activities
  from public, anon, authenticated;

-- portfolios 는 삭제 정책 없음 (원본과 동일)
grant select, insert, update         on public.portfolios     to authenticated;
grant select, insert, update, delete on public.certifications to authenticated;
grant select, insert, update, delete on public.activities     to authenticated;

-- 2-1. 개인 데이터: 본인만 (임원진 예외 없음)
create policy portfolios_select on public.portfolios
  for select to authenticated using (public.is_approved() and user_id = auth.uid());
create policy portfolios_insert on public.portfolios
  for insert to authenticated with check (public.is_approved() and user_id = auth.uid());
create policy portfolios_update on public.portfolios
  for update to authenticated
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());

create policy certifications_select on public.certifications
  for select to authenticated using (public.is_approved() and user_id = auth.uid());
create policy certifications_insert on public.certifications
  for insert to authenticated with check (public.is_approved() and user_id = auth.uid());
create policy certifications_update on public.certifications
  for update to authenticated
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());
create policy certifications_delete on public.certifications
  for delete to authenticated using (public.is_approved() and user_id = auth.uid());

create policy activities_select on public.activities
  for select to authenticated using (public.is_approved() and user_id = auth.uid());
create policy activities_insert on public.activities
  for insert to authenticated with check (public.is_approved() and user_id = auth.uid());
create policy activities_update on public.activities
  for update to authenticated
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());
create policy activities_delete on public.activities
  for delete to authenticated using (public.is_approved() and user_id = auth.uid());

-- ============================================================
-- [R] 되돌리기 (이 1단계에 문제가 있을 때만 실행)
-- ============================================================
-- 테이블을 지우면 그 테이블의 정책과 인덱스도 함께 지워진다.
-- 입력해 둔 포트폴리오·자격증·활동 데이터가 모두 사라지므로 먼저 백업한다.
-- drop table public.activities, public.certifications, public.portfolios;
