-- 직무별 포트폴리오 ① 테이블 추가 (Supabase SQL Editor에서 한 번 실행)
-- 한 사람이 직무별로 여러 개의 포트폴리오 문서를 만든다(예: 물류관리용, SCM용).
--   · 본인만 읽기·쓰기. 임원진도 다른 사람 것은 볼 수 없다.
-- 이 파일은 새 테이블만 추가한다. 기존 portfolios·certifications·activities 와 데이터는 건드리지 않는다.
-- 실행 전에는 PLAN.md 8-6의 "처음 한 번" 백업(CSV)을 하고, portfolios 도 CSV로 받아 둔다.
-- 실행 순서: ① 이 파일 → (선택) copy_portfolios_to_documents.sql → 프론트 배포.
--   복사 SQL을 실행하지 않아도, 예전 포트폴리오가 있는 부원에게는 화면에 "예전 포트폴리오 가져오기" 버튼이 나온다.
-- 사용하는 기존 함수: public.is_approved(), public.touch_updated_at() (schema.sql)

create table public.portfolio_documents (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- 직무 이름(기본 목록에서 고르거나 직접 입력)
  job_title      text not null check (char_length(job_title) between 1 and 100),
  -- 칸별 글(headline, bio, education, experience, projects, skills, career_goal, contact, cover_motive, cover_skill, cover_strength, cover_goal)
  content        jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 200000),
  -- 예전 portfolios 에서 가져온 문서면 그 주인의 id(한 사람당 한 번만 가져오게 하는 표시)
  legacy_user_id uuid unique check (legacy_user_id is null or legacy_user_id = user_id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index portfolio_documents_user_idx on public.portfolio_documents (user_id, updated_at desc);

alter table public.portfolio_documents enable row level security;

revoke all on public.portfolio_documents from public, anon, authenticated;
grant select, insert, update, delete on public.portfolio_documents to authenticated;

create policy portfolio_documents_select on public.portfolio_documents
  for select to authenticated
  using (public.is_approved() and user_id = auth.uid());

create policy portfolio_documents_insert on public.portfolio_documents
  for insert to authenticated
  with check (public.is_approved() and user_id = auth.uid());

create policy portfolio_documents_update on public.portfolio_documents
  for update to authenticated
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());

create policy portfolio_documents_delete on public.portfolio_documents
  for delete to authenticated
  using (public.is_approved() and user_id = auth.uid());

create trigger portfolio_documents_touch
  before update on public.portfolio_documents
  for each row execute function public.touch_updated_at();

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. 프론트를 먼저 되돌린다)
-- ============================================================
-- 테이블을 지우면 정책과 인덱스, 트리거도 함께 지워진다. 새로 만든 문서가 사라지므로 먼저 백업한다.
-- 예전 portfolios 는 어떤 경우에도 건드리지 않았으므로 그대로 남아 있다.
-- drop table if exists public.portfolio_documents;
