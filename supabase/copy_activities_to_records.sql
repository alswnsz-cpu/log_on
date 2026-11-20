-- 활동 기록 ② 포트폴리오의 기존 활동(activities)을 활동 기록(activity_records)으로 복사 (한 번 실행)
-- 복사만 한다. 기존 activities 의 행은 지우거나 바꾸지 않는다.
-- 같은 파일을 여러 번 실행해도 이미 복사한 행(source_activity_id 가 같은 행)은 건너뛴다.
--
-- 실행 순서: add_activity_records.sql 을 먼저 실행한 뒤에 이 파일을 실행한다.
-- 실행 전에는 activities 를 CSV로 백업해 둔다(PLAN.md 8-6의 7단계 백업).
-- SQL Editor 에서 실행하면 모든 부원의 활동이 각자의 user_id 로 복사된다.

insert into public.activity_records
  (user_id, title, category, description, started_on, ended_on, source_activity_id, created_at)
select a.user_id, a.title, a.category, a.description, a.started_on, a.ended_on, a.id, a.created_at
from public.activities a
on conflict (source_activity_id) do nothing;

-- 결과 확인용(원하면 실행): 복사된 행 수
-- select count(*) from public.activity_records where source_activity_id is not null;

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행)
-- ============================================================
-- 복사로 만든 행만 지운다. 직접 적은 활동 기록(source_activity_id 가 비어 있는 행)과 원본 activities 는 그대로 남는다.
-- delete from public.activity_records where source_activity_id is not null;
