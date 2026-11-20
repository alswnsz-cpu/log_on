-- 직무별 포트폴리오 ② 예전 포트폴리오(portfolios)를 새 문서(portfolio_documents)로 복사 (한 번 실행, 선택)
-- 복사만 한다. 기존 portfolios 의 행은 지우거나 바꾸지 않는다.
-- 한 사람당 한 번만 복사된다(legacy_user_id 가 같은 행은 건너뛴다). 화면의 "예전 포트폴리오 가져오기"로 이미 가져온 사람도 건너뛴다.
--
-- 실행 순서: add_portfolio_documents.sql 을 먼저 실행한 뒤에 이 파일을 실행한다.
-- 실행 전에는 portfolios 를 CSV로 백업해 둔다(PLAN.md 8-6의 8단계 백업).
-- SQL Editor 에서 실행하면 모든 부원의 포트폴리오가 각자의 user_id 로 복사된다.

insert into public.portfolio_documents (user_id, job_title, content, legacy_user_id, created_at, updated_at)
select p.user_id, '기본 포트폴리오', p.content, p.user_id, p.updated_at, p.updated_at
from public.portfolios p
where jsonb_typeof(p.content) = 'object'
on conflict (legacy_user_id) do nothing;

-- 결과 확인용(원하면 실행): 복사된 문서 수
-- select count(*) from public.portfolio_documents where legacy_user_id is not null;

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행)
-- ============================================================
-- 복사로 만든 문서만 지운다. 직접 만든 문서(legacy_user_id 가 비어 있는 행)와 원본 portfolios 는 그대로 남는다.
-- 복사한 뒤 그 문서를 고쳤다면 고친 내용도 함께 사라지니 먼저 백업한다.
-- delete from public.portfolio_documents where legacy_user_id is not null;
