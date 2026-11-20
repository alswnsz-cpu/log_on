-- 공모전·프로젝트 ① 테이블 추가 (Supabase SQL Editor에서 한 번 실행)
--   · 읽기: 승인된 사용자(졸업생 포함)
--   · 프로젝트 만들기·수정·삭제, 참여 부원 추가·삭제: 임원진만
--   · 내 역할(role_text): 참여한 본인 행만 직접 고친다. 다른 칸은 고칠 수 없게 컬럼 단위로 막았다.
-- 이 파일은 새 테이블만 추가한다. 기존 테이블과 데이터는 건드리지 않는다.
-- 실행 전에는 PLAN.md 8-6의 "처음 한 번" 백업(CSV)을 해 둔다.
-- 실행 순서: 이 파일 → 프론트 배포. 현재 배포된 화면과 충돌하지 않는다(아직 아무도 읽지 않는다).
-- 사용하는 기존 함수: public.is_approved(), public.is_officer(), public.touch_updated_at() (schema.sql)

create table public.projects (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(title) between 1 and 200),
  -- contest 공모전, project 프로젝트
  kind        text not null default 'project' check (kind in ('contest', 'project')),
  description text check (description is null or char_length(description) <= 2000),
  -- 진행률(0~100)
  progress    smallint not null default 0 check (progress between 0 and 100),
  start_date  date,
  due_date    date,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (due_date is null or start_date is null or due_date >= start_date)
);

create table public.project_members (
  project_id bigint not null references public.projects (id) on delete cascade,
  user_id    uuid   not null references public.profiles (id) on delete cascade,
  -- 이 프로젝트에서 맡은 역할(내 역할)
  role_text  text check (role_text is null or char_length(role_text) <= 100),
  primary key (project_id, user_id)
);

create index project_members_user_idx on public.project_members (user_id);

alter table public.projects        enable row level security;
alter table public.project_members enable row level security;

revoke all on public.projects, public.project_members from public, anon, authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, delete          on public.project_members to authenticated;
-- 참여 정보 중 role_text 만 고칠 수 있다(project_id, user_id 를 바꿔 다른 프로젝트에 끼어드는 것을 막는다)
grant update (role_text) on public.project_members to authenticated;

create policy projects_select on public.projects
  for select to authenticated
  using (public.is_approved());

create policy projects_insert on public.projects
  for insert to authenticated
  with check (public.is_officer() and created_by = auth.uid());

create policy projects_update on public.projects
  for update to authenticated
  using (public.is_officer())
  with check (public.is_officer());

create policy projects_delete on public.projects
  for delete to authenticated
  using (public.is_officer());

create policy project_members_select on public.project_members
  for select to authenticated
  using (public.is_approved());

create policy project_members_insert on public.project_members
  for insert to authenticated
  with check (public.is_officer());

create policy project_members_delete on public.project_members
  for delete to authenticated
  using (public.is_officer());

-- 내 역할은 본인 행만 고친다
create policy project_members_update_own on public.project_members
  for update to authenticated
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());

create trigger projects_touch
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. 프론트를 먼저 되돌린다)
-- ============================================================
-- 테이블을 지우면 정책과 인덱스, 트리거도 함께 지워진다. 적어 둔 프로젝트와 참여 정보가 사라지므로 먼저 백업한다.
-- drop table if exists public.project_members;
-- drop table if exists public.projects;
