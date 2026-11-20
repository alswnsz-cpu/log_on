-- 시간표 공개/비공개 설정 ① 테이블 추가 (Supabase SQL Editor에서 한 번 실행)
-- 행이 없으면 "공개"로 본다. 기본값은 공개이므로 기존 부원은 아무 조치 없이 공개 상태다.
-- 실행 순서: ① 이 파일 → 프론트 배포 → ② share_schedules.sql
-- 이 파일은 현재 프론트와 충돌하지 않는다(아직 아무도 이 테이블을 읽지 않는다).

create table public.schedule_privacy (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  is_private boolean not null default false
);

alter table public.schedule_privacy enable row level security;

revoke all on public.schedule_privacy from public, anon, authenticated;
grant select, insert, update on public.schedule_privacy to authenticated;

-- 읽기: 승인된 사용자 ("멤버별" 화면의 비공개 표시용)
create policy schedule_privacy_select on public.schedule_privacy
  for select to authenticated
  using (public.is_approved());

-- 쓰기: 본인 행만, 승인된 사람만
create policy schedule_privacy_insert on public.schedule_privacy
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved());

create policy schedule_privacy_update on public.schedule_privacy
  for update to authenticated
  using (user_id = auth.uid() and public.is_approved())
  with check (user_id = auth.uid() and public.is_approved());

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 아래 문장을 실행. ② share_schedules.sql 을 먼저 되돌려야 한다)
-- ============================================================
-- drop table if exists public.schedule_privacy;
