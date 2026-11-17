-- 시간표 공유: 승인된 사용자는 다른 부원의 시간표(과목명 포함)를 읽을 수 있다.
-- 추가·수정·삭제 정책(schedule_insert_own, schedule_update_own, schedule_delete_own)은 그대로 둔다.
-- busy_blocks 뷰는 바꾸지 않는다(공통 시간 계산용).
--
-- 실행 순서: 시간표를 본인 것만 조회하도록 고친 프론트(Schedule.tsx)를 먼저 배포한 뒤 실행한다.
--           먼저 실행하면 "내 시간표"에 다른 부원의 수업이 섞여 보인다.

drop policy if exists schedule_select_own on public.schedule_blocks;
drop policy if exists schedule_select_approved on public.schedule_blocks;

create policy schedule_select_approved on public.schedule_blocks
  for select to authenticated
  using (public.is_approved());

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 아래 두 문장을 실행)
-- ============================================================
-- drop policy if exists schedule_select_approved on public.schedule_blocks;
-- create policy schedule_select_own on public.schedule_blocks for select to authenticated using (user_id = auth.uid() and public.is_approved());
