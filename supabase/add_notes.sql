-- 개별 노트(토론 중 나만 보는 메모) ① 테이블 추가 (Supabase SQL Editor에서 한 번 실행)
-- 토론 중에 내 의견이나 다른 사람의 의견을 나만 보는 메모로 적어 둔다. 토론과 연결하지 않은 노트도 쓸 수 있다.
--   · 본인만 읽기·쓰기. 임원진도 다른 사람의 노트는 볼 수 없다.
--   · agenda_id 는 선택이다. 토론이 지워져도 노트는 남도록 set null 이다.
-- 이 파일은 새 테이블만 추가한다. 기존 테이블과 데이터는 건드리지 않는다.
-- 실행 전에는 PLAN.md 8-6의 "처음 한 번" 백업(CSV)을 해 둔다.
-- 실행 순서: 이 파일 → 프론트 배포. 현재 배포된 화면과 충돌하지 않는다(아직 아무도 읽지 않는다).
-- 사용하는 기존 함수: public.is_approved(), public.touch_updated_at() (schema.sql)

create table public.notes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  agenda_id  bigint references public.agendas (id) on delete set null,
  body       text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_idx   on public.notes (user_id, created_at desc);
create index notes_agenda_idx on public.notes (agenda_id);

alter table public.notes enable row level security;

revoke all on public.notes from public, anon, authenticated;
grant select, insert, update, delete on public.notes to authenticated;

create policy notes_select on public.notes
  for select to authenticated
  using (public.is_approved() and user_id = auth.uid());

create policy notes_insert on public.notes
  for insert to authenticated
  with check (public.is_approved() and user_id = auth.uid());

create policy notes_update on public.notes
  for update to authenticated
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());

create policy notes_delete on public.notes
  for delete to authenticated
  using (public.is_approved() and user_id = auth.uid());

create trigger notes_touch
  before update on public.notes
  for each row execute function public.touch_updated_at();

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. 프론트를 먼저 되돌린다)
-- ============================================================
-- 테이블을 지우면 정책과 인덱스, 트리거도 함께 지워진다. 적어 둔 노트가 모두 사라지므로 먼저 백업한다.
-- drop table if exists public.notes;
