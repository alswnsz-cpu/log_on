-- ################################################################################
-- #                                                                              #
-- #   초안(DRAFT) — 이 파일은 실행하지 않습니다.                                    #
-- #                                                                              #
-- #   · 실행 전 백업(CSV) 필수. (HANDOVER.md 6-3)                                   #
-- #   · 지울 대상의 값(아이디, 제목)을 눈으로 확인하는 것이 필수입니다.            #
-- #   · 실행은 관리자(Supabase 소유자)만 합니다. 되돌릴 수 없습니다.               #
-- #   · Claude Code 등 AI 도구는 이 파일을 실행하지 않습니다(Supabase에 접속하지     #
-- #     않습니다).                                                                 #
-- #                                                                              #
-- ################################################################################
--
-- 하는 일(초안): 인수인계 전에 시험용으로 만든 계정과 제목이 "[시험]"으로 시작하는 데이터를 정리한다.
--
-- 이 파일의 구성
--   [1] 지워지는 행을 "먼저 보는" SELECT        → 읽기 전용이라 실행해도 데이터가 바뀌지 않는다.
--   [2] 연결된 테이블이 어떻게 되는지 정리       → 주석(설명). SQL 파일을 읽고 정리한 것이다.
--   [3] 삭제 SQL 초안                           → 전부 주석 처리 + begin/rollback. 지우려면 사람이 직접 주석을 풀어야 한다.
--
-- 규칙: supabase/INDEX.md의 실행 순서에 들어가지 않는 파일이다. 기존 SQL 파일은 고치지 않는다.
-- 이 파일은 "초안"이라서 실제로 쓸 때는 시험용 DB 또는 백업을 받은 뒤에, 아래 [1]의 결과를 보고 값을 고쳐서 쓴다.
--
-- 지울 계정의 아이디(profiles.username, 소문자)는 아래 [1]과 [3]에 같은 목록으로 적혀 있다.
-- 목록을 바꿀 때는 [1]과 [3] 두 곳을 똑같이 바꾼다.
--   test3, test2, testuser, testmember1, testalumni
--   동료 테스트 계정: 아이디를 채우는 칸(비워 둠, 비어 있으면 아무것도 걸리지 않는다)
--
-- ================================================================================
-- [1] 먼저 보기 (읽기 전용 SELECT)
-- ================================================================================

-- 1-1. 지울 계정 후보: 프로필과 상태
--      role 이 officer 인 행이 있으면 지우면 안 된다(임원진). 반드시 확인한다.
with targets(username) as (
  values
    ('test3'), ('test2'), ('testuser'), ('testmember1'), ('testalumni'),
    ('')            -- ← 동료 테스트 계정 아이디를 이 칸에 채운다(예: ('아이디')). 비어 있으면 무시된다.
)
select p.id, p.username, p.name, p.role, p.status, p.created_at,
       exists (select 1 from public.member_alumni a where a.user_id = p.id) as is_alumni
from public.profiles p
join targets t on lower(p.username) = lower(t.username)
where t.username <> ''
order by p.username;

-- 1-2. 그 계정들에 딸린 행 수(지울 때 함께 지워지거나 비워지는 것). 숫자가 예상과 다르면 멈춘다.
with t as (
  select p.id
  from public.profiles p
  where lower(p.username) in ('test3', 'test2', 'testuser', 'testmember1', 'testalumni'
                              -- , '동료테스트아이디'   ← 필요하면 주석을 풀고 값을 채운다
                             )
)
select '시간표(schedule_blocks)'        as 대상, count(*) as 행수 from public.schedule_blocks   where user_id     in (select id from t)
union all select '시간표 입력 완료(schedule_status)',  count(*) from public.schedule_status      where user_id     in (select id from t)
union all select '시간표 공개 설정(schedule_privacy)', count(*) from public.schedule_privacy     where user_id     in (select id from t)
union all select '가입 신청서(signup_applications)',   count(*) from public.signup_applications where user_id     in (select id from t)
union all select '탈퇴 신청(withdrawal_requests)',     count(*) from public.withdrawal_requests  where user_id     in (select id from t)
union all select '비밀번호 재설정 요청',               count(*) from public.password_reset_requests where user_id  in (select id from t)
union all select '졸업 표시(member_alumni)',           count(*) from public.member_alumni        where user_id     in (select id from t)
union all select '의견(opinions)',                      count(*) from public.opinions             where user_id     in (select id from t)
union all select '예전 포트폴리오(portfolios)',         count(*) from public.portfolios           where user_id     in (select id from t)
union all select '자격증(certifications)',             count(*) from public.certifications       where user_id     in (select id from t)
union all select '예전 활동(activities)',              count(*) from public.activities           where user_id     in (select id from t)
union all select '활동 기록(activity_records)',        count(*) from public.activity_records     where user_id     in (select id from t)
union all select '노트(notes)',                        count(*) from public.notes                where user_id     in (select id from t)
union all select '직무별 포트폴리오(portfolio_documents)', count(*) from public.portfolio_documents where user_id in (select id from t)
union all select '프로젝트 참여(project_members)',     count(*) from public.project_members      where user_id     in (select id from t)
union all select '교내활동 즐겨찾기(campus_favorites)', count(*) from public.campus_favorites     where user_id     in (select id from t)
-- 아래는 "지워지지 않고 만든 사람 표시만 비워지는" 것(set null)
union all select '[비워짐] 콘텐츠 게시물 담당자',      count(*) from public.content_posts        where assignee_id in (select id from t)
union all select '[비워짐] 콘텐츠 게시물 만든 사람',   count(*) from public.content_posts        where created_by  in (select id from t)
union all select '[비워짐] 회의록 만든 사람',          count(*) from public.meeting_notes        where created_by  in (select id from t)
union all select '[비워짐] 프로젝트 만든 사람',        count(*) from public.projects             where created_by  in (select id from t)
union all select '[비워짐] 앨범 만든 사람',            count(*) from public.albums               where created_by  in (select id from t)
union all select '[비워짐] 사진 올린 사람',            count(*) from public.album_photos         where uploaded_by in (select id from t)
-- 아래는 "삭제를 막는" 연결(no action). 0이 아니면 계정을 지우려 할 때 오류가 난다. [3]의 2~3단계를 본다.
union all select '[삭제 막음] 안건 만든 사람(agendas)', count(*) from public.agendas             where created_by  in (select id from t)
union all select '[삭제 막음] 결론 확정한 사람(decisions)', count(*) from public.decisions       where decided_by  in (select id from t)
union all select '[삭제 막음] 공식 일정 만든 사람(events, is_club)', count(*) from public.events where created_by in (select id from t) and is_club
union all select '(개인 일정은 [3]에서 먼저 지움) 개인 일정(events)', count(*) from public.events where created_by in (select id from t) and not is_club;

-- 1-3. 제목이 [시험]으로 시작하는 데이터 (테이블별 목록)
select '안건(agendas)'            as 테이블, id::text as id, title, created_at from public.agendas          where title like '[시험]%'
union all select '일정(events)',               id::text, title, created_at from public.events           where title like '[시험]%'
union all select '앨범(albums)',               id::text, title, created_at from public.albums           where title like '[시험]%'
union all select '콘텐츠(content_posts)',      id::text, title, created_at from public.content_posts    where title like '[시험]%'
union all select '프로젝트(projects)',         id::text, title, created_at from public.projects         where title like '[시험]%'
union all select '회의록(meeting_notes)',      id::text, title, created_at from public.meeting_notes    where title like '[시험]%'
union all select '활동 기록(activity_records)', id::text, title, created_at from public.activity_records where title like '[시험]%'
order by 1, 4;

-- 1-4. [시험] 앨범의 사진 파일 경로(= 저장소에 남는 파일). 앨범 행을 지워도 파일은 안 지워진다.
--      이 목록을 따로 적어 두고, 행을 지운 뒤 Supabase 대시보드 Storage(logon-photos 버킷)에서 지운다.
select a.title as 앨범, ph.storage_path
from public.album_photos ph
join public.albums a on a.id = ph.album_id
where a.title like '[시험]%'
order by a.title, ph.storage_path;

-- ================================================================================
-- [2] 계정(또는 안건 등)을 지우면 연결된 테이블이 어떻게 되는가 — SQL 파일을 읽고 정리한 것
--     (직접 시험하지는 않았다. 근거 파일:줄은 오른쪽에 적었다)
-- ================================================================================
-- 계정 = auth.users 한 행. 이것을 지우면 아래가 연쇄로 움직인다.
--
-- (A) 함께 지워진다(on delete cascade)
--   auth.users  → profiles                        schema.sql:15      (프로필: 이름·아이디·전화번호·역할·상태·색)
--   profiles    → schedule_blocks                 schema.sql:28      (시간표)
--   profiles    → opinions                        schema.sql:52      (토론 의견)
--   profiles    → schedule_status                 add_schedule_status.sql:10   (시간표 입력 완료 기록)
--   profiles    → schedule_privacy                add_schedule_privacy.sql:7   (시간표 공개 설정)
--   profiles    → signup_applications             add_signup_application.sql:10 (가입 신청서)
--   profiles    → withdrawal_requests             add_withdrawal_request.sql:11 (탈퇴 신청)
--   profiles    → password_reset_requests         add_password_reset.sql:11    (비밀번호 재설정 요청)
--   profiles    → member_alumni                   add_member_alumni.sql:10     (졸업 표시)
--   profiles    → portfolios / certifications / activities
--                                                 logon_1_portfolio.sql:15, :22, :32 (예전 포트폴리오·자격증·활동)
--   profiles    → activity_records                add_activity_records.sql:11  (활동 기록)
--   profiles    → notes                           add_notes.sql:12             (노트·토론 메모)
--   profiles    → portfolio_documents             add_portfolio_documents.sql:12 (직무별 포트폴리오)
--   profiles    → project_members                 add_projects.sql:28          (프로젝트 참여, 역할)
--   profiles    → campus_favorites                add_activity_feed.sql:25     (교내활동 즐겨찾기)
--
--   부모 행이 지워지면 자식도 지워지는 것(계정과는 별개로, 안건·앨범·프로젝트·일정을 지울 때)
--   agendas  → opinions(모든 사람의 의견)        schema.sql:51
--   agendas  → decisions(결론)                   schema.sql:61
--   albums   → album_photos(사진 목록 행)         logon_2_albums.sql:28   ※ 저장소의 사진 "파일"은 안 지워진다
--   projects → project_members                   add_projects.sql:27
--   events   → event_overrides(날짜별 수정)       add_event_overrides.sql:8
--
-- (B) 지워지지 않고 "만든 사람" 칸만 비워진다(on delete set null) → 내용은 남고 작성자가 "없음"이 된다
--   content_posts.assignee_id, created_by         add_content_posts.sql:20, :28   (콘텐츠 담당자·만든 사람)
--   meeting_notes.created_by                      add_meeting_notes.sql:16        (회의록 작성자)
--   projects.created_by                           add_projects.sql:20             (프로젝트 만든 사람)
--   albums.created_by                             logon_2_albums.sql:22           (앨범 만든 사람)
--   album_photos.uploaded_by                      logon_2_albums.sql:31           (사진 올린 사람)
--   notes.agenda_id (안건을 지울 때)              add_notes.sql:13                (노트는 남고 토론 연결만 끊김)
--
-- (C) 삭제를 "막는" 연결(on delete 규칙 없음 = 막기). 연결된 행이 남아 있으면 계정 삭제가 오류로 실패한다.
--   agendas.created_by   → profiles               schema.sql:45        (안건을 만든 계정)
--   decisions.decided_by → profiles               schema.sql:63        (결론을 확정한 계정)
--   events.created_by    → profiles               add_events.sql:13    (일정을 만든 계정)
--   → 그래서 purge_member() 함수는 개인 일정(events, is_club = false)을 먼저 지우고,
--     그래도 안건·결론·공식 일정이 남아 있으면 "삭제할 수 없습니다" 오류를 낸다
--     (add_member_purge.sql:35-42). [3]의 초안도 같은 순서를 따른다.
--
-- (D) 데이터베이스 밖에 남는 것
--   · 저장소(Storage)의 사진 파일(logon-photos 버킷): 행을 지워도 파일은 남는다. 대시보드나 Storage API로 따로 지운다.
--   · Supabase 로그, 외부로 보낸 백업(CSV) 파일.
--
-- (E) 참고: purge_member(p_user) 함수는 "탈퇴·거절된 일반 부원"만, 그리고 호출한 사람이 임원진일 때만 쓸 수 있다
--     (add_member_purge.sql:17-33). SQL Editor에서는 로그인 사용자가 없어서(auth.uid()가 비어 있음) 이 함수를 그대로
--     쓸 수 없다. 그래서 [3]은 같은 순서를 직접 SQL로 쓴 초안이다. 앱의 관리 화면에서 "완전 삭제"로 하나씩 지우는 방법이
--     더 안전하다(이름을 입력해야 하고, 막히는 경우 오류가 난다). 계정이 몇 개 안 되면 그 방법을 권한다.
--
-- ================================================================================
-- [3] 삭제 SQL 초안 — 전부 주석 처리되어 있다. 실행하려면 사람이 직접 주석을 풀어야 한다.
--     풀어도 맨 끝이 rollback 이라 아무것도 확정되지 않는다. 정말 지우려면 [1]의 결과를 모두 확인한 뒤,
--     마지막 줄의 rollback 을 commit 으로 사람이 바꿔야 한다.
-- ================================================================================
--
-- begin;
--
-- -- 0) 임원진은 절대 지우지 않는다: 지울 계정에 officer 가 섞여 있으면 여기서 멈춘다.
-- do $$
-- begin
--   if exists (
--     select 1 from public.profiles
--     where lower(username) in ('test3', 'test2', 'testuser', 'testmember1', 'testalumni'
--                               -- , '동료테스트아이디'
--                              )
--       and role = 'officer'
--   ) then
--     raise exception '지울 계정 목록에 임원진(officer)이 있습니다. 목록을 다시 확인하세요.';
--   end if;
-- end $$;
--
-- -- 1) [시험]으로 시작하는 데이터부터 지운다(계정이 만든 안건·일정이 계정 삭제를 막지 않도록 먼저).
-- --    안건을 지우면 의견·결론이 함께 지워지고 노트의 토론 연결은 끊긴다.
-- -- delete from public.agendas          where title like '[시험]%';
-- -- delete from public.events           where title like '[시험]%';   -- 반복 일정의 날짜별 수정도 함께 지워진다
-- -- delete from public.albums           where title like '[시험]%';   -- 사진 목록 행도 지워진다. 파일은 Storage에서 따로(1-4)
-- -- delete from public.content_posts    where title like '[시험]%';
-- -- delete from public.projects         where title like '[시험]%';   -- 참여 정보도 함께 지워진다
-- -- delete from public.meeting_notes    where title like '[시험]%';
-- -- delete from public.activity_records where title like '[시험]%';   -- 개인 데이터: 정말 시험 글인지 [1-3]에서 확인
--
-- -- 2) 지울 계정이 만든 개인 일정을 먼저 지운다(events.created_by 는 삭제를 막는 연결이다. purge_member 와 같은 순서).
-- -- delete from public.events
-- --  where is_club = false
-- --    and created_by in (select id from public.profiles
-- --                       where lower(username) in ('test3', 'test2', 'testuser', 'testmember1', 'testalumni'));
--
-- -- 3) 아직 막는 연결이 남았는지 확인한다. 결과가 0행이어야 한다. 0행이 아니면 이 아래로 가지 말고 멈춘다.
-- --    (남은 안건·결론·공식 일정을 다른 임원진 계정으로 넘기거나 지우는 일은 사람이 결정한다.)
-- -- select 'agendas' as 막는연결, count(*) from public.agendas
-- --  where created_by in (select id from public.profiles where lower(username) in ('test3', 'test2', 'testuser', 'testmember1', 'testalumni'))
-- -- union all select 'decisions', count(*) from public.decisions
-- --  where decided_by in (select id from public.profiles where lower(username) in ('test3', 'test2', 'testuser', 'testmember1', 'testalumni'))
-- -- union all select 'events(공식)', count(*) from public.events
-- --  where created_by in (select id from public.profiles where lower(username) in ('test3', 'test2', 'testuser', 'testmember1', 'testalumni'));
--
-- -- 4) 계정 삭제: auth.users 를 지우면 프로필과 [2]의 (A)가 연쇄로 지워지고 (B)는 작성자 칸이 비워진다.
-- --    role = 'member' 인 행만 지우도록 한 번 더 막아 둔다.
-- -- delete from auth.users
-- --  where id in (select id from public.profiles
-- --               where lower(username) in ('test3', 'test2', 'testuser', 'testmember1', 'testalumni')
-- --                 and role = 'member');
--
-- -- 5) 결과 확인: 아래가 0행이어야 한다.
-- -- select id, username from public.profiles
-- --  where lower(username) in ('test3', 'test2', 'testuser', 'testmember1', 'testalumni');
--
-- rollback;   -- ← 안전장치. 정말 지우기로 결정했을 때만 사람이 commit; 으로 바꾼다.
--
-- ================================================================================
-- 이 파일을 실행한 뒤에 할 일(사람)
--   1) Storage(logon-photos)에서 [1-4]에서 적어 둔 사진 파일을 지운다.
--   2) 앱에서 임원진 계정으로 부원 목록·토론·달력에 시험 흔적이 없는지 본다.
--   3) 문제가 있으면 백업(CSV)에서 필요한 행만 복구한다(계정 자체는 CSV로 복구되지 않는다 — HANDOVER.md 6-3).
-- ================================================================================
