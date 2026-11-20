-- 활동 찾기(교내활동·대외활동 자동 수집) ① 테이블 추가 (Supabase SQL Editor에서 한 번 실행)
--   · activity_snapshots: 수집한 공고의 마지막 저장본(캐시). 서버 함수(서비스 롤 키)만 읽고 쓴다.
--       화면(authenticated)과 로그인 전(anon)은 접근할 수 없다. RLS를 켜고 정책을 하나도 만들지 않아서 모두 거부된다.
--   · campus_favorites: 부원별 교내활동 즐겨찾기. 본인 행만 읽기·쓰기. 졸업생도 쓸 수 있다.
-- 이 파일은 새 테이블만 추가한다. 기존 테이블과 데이터는 건드리지 않는다.
-- 실행 전에는 PLAN.md 8-6의 "처음 한 번" 백업(CSV)을 해 둔다.
-- 실행 순서: ① 이 파일 → Vercel 환경변수 설정(HANDOVER.md 9단계 참고) → 프론트·서버 함수 배포.
--   SQL을 먼저 실행해도 지금 배포된 화면에는 영향이 없다(아직 아무도 읽지 않는다).
-- 사용하는 기존 함수: public.is_approved() (schema.sql)

-- 수집 결과의 마지막 저장본. route 는 'campus'(교내활동) 또는 'external'(대외활동).
create table public.activity_snapshots (
  route      text primary key check (route in ('campus', 'external')),
  checked_at timestamptz not null,
  content    jsonb not null
);

alter table public.activity_snapshots enable row level security;

-- 정책을 만들지 않는다. 서비스 롤 키는 RLS를 건너뛰므로 서버 함수만 접근할 수 있다.
revoke all on public.activity_snapshots from public, anon, authenticated;

-- 교내활동 즐겨찾기. notice_key 는 학교 게시판 글 번호(없으면 공고 주소).
create table public.campus_favorites (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  notice_key text not null check (char_length(notice_key) between 1 and 500),
  -- 저장 당시의 공고 내용(제목, 주소, 날짜, 분류 등)
  data       jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 8000),
  saved_at   timestamptz not null default now(),
  primary key (user_id, notice_key)
);

alter table public.campus_favorites enable row level security;

revoke all on public.campus_favorites from public, anon, authenticated;
grant select, insert, update, delete on public.campus_favorites to authenticated;

create policy campus_favorites_select on public.campus_favorites
  for select to authenticated
  using (public.is_approved() and user_id = auth.uid());

create policy campus_favorites_insert on public.campus_favorites
  for insert to authenticated
  with check (public.is_approved() and user_id = auth.uid());

create policy campus_favorites_update on public.campus_favorites
  for update to authenticated
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());

create policy campus_favorites_delete on public.campus_favorites
  for delete to authenticated
  using (public.is_approved() and user_id = auth.uid());

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. 프론트와 서버 함수를 먼저 되돌린다)
-- ============================================================
-- 테이블을 지우면 정책도 함께 지워진다. 즐겨찾기가 모두 사라지므로 먼저 백업한다(캐시는 다시 수집하면 채워진다).
-- drop table if exists public.campus_favorites;
-- drop table if exists public.activity_snapshots;
