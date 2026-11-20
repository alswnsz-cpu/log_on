-- 시간표 공유 ② 조회 정책 교체
-- 승인된 사용자는 다른 부원의 시간표(과목명 포함)를 읽을 수 있다. 단, 소유자가 비공개로 설정했으면 읽을 수 없다.
-- 임원진도 예외가 아니다. 본인 시간표는 비공개여도 본인이 읽을 수 있다.
-- 추가·수정·삭제 정책(schedule_insert_own, schedule_update_own, schedule_delete_own)은 그대로 둔다.
-- busy_blocks 뷰는 바꾸지 않는다(공통 시간 계산용, 비공개여도 불가 시간은 반영되고 과목명은 없다).
--
-- 실행 순서: ① add_schedule_privacy.sql 실행 → 프론트 배포(내 시간표 조회에 본인 조건 + 공개 설정 화면) → 이 파일 실행.
--           ①이 없으면 아래 함수가 만들어지지 않는다. 프론트보다 먼저 실행하면 "내 시간표"에 다른 부원의 수업이 섞여 보인다.

create or replace function public.schedule_owner_is_private(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sp.is_private from public.schedule_privacy sp where sp.user_id = p_owner), false);
$$;

revoke all on function public.schedule_owner_is_private(uuid) from public, anon;
grant execute on function public.schedule_owner_is_private(uuid) to authenticated;

drop policy if exists schedule_select_own on public.schedule_blocks;
drop policy if exists schedule_select_approved on public.schedule_blocks;
drop policy if exists schedule_select_visible on public.schedule_blocks;

create policy schedule_select_visible on public.schedule_blocks
  for select to authenticated
  using (public.is_approved() and (user_id = auth.uid() or not public.schedule_owner_is_private(user_id)));

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 아래 세 문장을 실행)
-- ============================================================
-- drop policy if exists schedule_select_visible on public.schedule_blocks;
-- create policy schedule_select_own on public.schedule_blocks for select to authenticated using (user_id = auth.uid() and public.is_approved());
-- drop function if exists public.schedule_owner_is_private(uuid);
