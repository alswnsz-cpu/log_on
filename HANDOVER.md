# 인수인계 문서 (HANDOVER)

개편을 단계별로 만들면서 이어 쓰는 문서다. 계획은 `PLAN.md`의 "8. 개편 계획"을 본다.
밤샘 작업의 단계별 기록(브랜치, 커밋, SQL 실행 순서)은 `OVERNIGHT.md`에 있다.

## 1단계: 허브와 영역 메뉴
- 로그인 후 첫 화면(`/`)은 "무엇을 할까요?" 카드(허브)다. 달력은 `/calendar`로 옮겼다. 다른 주소는 그대로다.
- 영역과 메뉴는 `src/lib/areas.ts` 한곳에서 정한다. 새 화면을 추가하려면 해당 영역의 `items`에 `{ label, to }`를 넣고, 그 주소가 속한 영역을 알 수 있도록 `paths`에도 주소를 넣는다. 그다음 `src/App.tsx`의 `open &&` 안에 라우트를 등록한다.
- 졸업생에게 숨기려면 항목에 `hideForAlumni: true`를 쓴다. 메뉴만 숨길 뿐이고, 주소를 직접 입력하면 열린다. 접근을 막으려면 DB 정책으로 막아야 한다.
- 메뉴는 화면 폭 1000px 이상에서는 왼쪽 세로 사이드바, 그보다 좁으면 위쪽 칩 줄이다(`AreaNav.tsx`와 `theme.css`의 `.area-nav`).
- 시간표 입력 관문: 시간표 "입력 완료"를 누르기 전에는 허브와 메뉴 없이 `/schedule`만 열린다. 졸업생은 이 관문 없이 모든 화면이 열린다(`App.tsx`의 `open = done || alumni`).
- 헤더에는 부원 관리(임원진만), 내 정보, 로그아웃이 있다. 탈퇴 신청은 내 정보 맨 아래에 있다.

## 2단계: 토론 탭
- 토론 화면(`/agendas`)은 "전체 / 토론 중 / 확정 및 결론" 탭이다. 탭은 주소의 `?tab=discussing`, `?tab=decided`로 정해지고, 없거나 잘못된 값이면 전체다.
- "토론 중"과 "확정 및 결론"은 안건 상태(`discussing` / `decided`)로 나눈다. 결론을 확정하면 `decided`가 되고, "다시 논의하기"를 하면 `discussing`으로 돌아가며 이전 결론은 남는다. 그런 안건은 "토론 중" 탭에만 나온다.
- 예전 `/decisions` 주소는 `/agendas?tab=decided`로 이동한다. 메뉴의 "결론" 항목은 없앴다.
- 안건 상세의 "← 토론 목록"은 들어온 탭(목록이 넘긴 주소)으로 돌아간다. 주소로 바로 열면 `/agendas`로 간다.

## 3단계: 주간 달력과 공통 시간 확인
- 달력(`/calendar`) 위의 "월간 / 주간" 칩으로 보기를 바꾼다. 선택은 주소의 `?view=week`로 남는다.
- 주간은 일~토 7일이다(월 달력과 같은 기준). 화면이 좁으면 날짜별로 한 줄씩 쌓인다(달력이 차지한 폭 600px 미만).
- 달력 칸의 일정 막대 개수는 화면 전체가 아니라 달력이 실제로 차지한 폭(540px 이상이면 3개)으로 정한다(`src/lib/useElementWidth.ts`). 사이드바 때문에 본문이 좁아져도 맞게 동작한다.
- "공통 시간 확인" 버튼은 `/common`으로 가는 링크이고 졸업생에게는 보이지 않는다. 졸업생 여부는 Layout이 화면에 넘겨 주는 값이다(`src/components/layout-context.ts`의 `useLayoutContext()`).

## 4단계: 활동 찾기 > 사이트 정리
- 활동 찾기 영역의 첫 화면은 `/explore/sites`(사이트 정리)다. `/explore`로 들어가면 이 화면으로 이동한다.
- 보여 주는 링크 카드는 `src/lib/resources.ts`의 `RESOURCE_GROUPS`에 있다. 사이트를 바꾸거나 더하려면 이 목록만 고친다. 주소는 `https://`로 시작하게 쓴다.
- 이 화면은 서버나 DB를 쓰지 않는 고정 목록이다. 공고를 자동으로 모으는 기능(교내활동, 대외활동 목록)은 따로 만드는 단계다.

## 5단계: 회의 변경 이력
- 활동 일정의 "회의 변경 이력"(`/meetings`)은 매주 회의에서 합의한 내용을 적는 회의록이다. 일정(`events`)의 변경을 자동으로 기록하는 기능이 아니다.
- DB: `meeting_notes`(제목, 회의 날짜, 내용, 작성자). 읽기는 승인된 사용자(졸업생 포함), 추가·수정·삭제는 임원진이다. 정책은 DB에서 걸려 있다.
- 목록은 회의 날짜 내림차순이다. 임원진은 "+ 회의 내용 기록"으로 추가하고 각 항목을 수정·삭제한다.
- SQL: `supabase/add_meeting_notes.sql`. 실행 후 프론트가 동작한다. 되돌리기 문장은 파일 끝 주석에 있다.

## 6단계: 콘텐츠 플래너
- 활동 일정의 "콘텐츠 플래너"(`/content`)는 동아리 공용 인스타그램 게시 일정이다. "담당자별 업무"(`/tasks`)는 담당자별 미완료 목록이다. 둘 다 졸업생에게 숨기며 DB도 졸업생의 읽기를 막는다.
- 게시 상태는 기획 중 → 제작 중 → 검토 중 → 게시 예정 → 게시 완료, 검토는 대기/완료다. 미완료는 게시 상태가 "게시 완료"가 아닌 것이다.
- 권한: 만들기·수정·삭제는 `can_manage_content()`가 참인 사람(지금은 임원진). 담당자는 자기 게시물의 상태와 검토만 `set_post_progress` 함수로 바꾼다. 읽기는 `can_view_content()`(승인된 사용자 중 졸업생이 아닌 사람).
- 점검 규칙(한국 시간, 월~일 한 주): 주말(토·일) 2건 이상 또는 주 5건 이상이면 과밀, 연속한 게시물 간격이 24시간 미만이면 간격 조정. 기준 숫자는 `src/lib/contentPlanner.ts`의 상수(`CROWDED_WEEK_TOTAL`, `CROWDED_WEEKEND`, `MIN_GAP_HOURS`)다.
- 게시 예정일시는 DB에 UTC로 저장하고 화면에서는 항상 한국 시간으로 보여 주고 입력받는다(`contentPlanner.ts`의 `toKstLocal`, `fromKstLocal`).
- 앞으로/뒤로: 목록에서 인접한 두 게시물의 게시 예정일시를 `swap_post_times` 함수로 서로 바꾼다.
- SQL 실행 순서: `add_member_alumni.sql`(이미 실행) → `add_content_permissions.sql` → `add_content_posts.sql` → 프론트. 되돌리기는 각 파일 끝 주석에 있다(반대 순서로).
- **팀장 권한을 추가하는 방법**(다음 회장 때):
  1. 팀장 테이블을 새로 만든다(졸업생 지정과 같은 구조). 예: `create table public.team_leads (user_id uuid primary key references public.profiles (id) on delete cascade);` RLS를 켜고 읽기는 승인된 사용자, 쓰기는 임원진만 두는 정책을 `add_member_alumni.sql`처럼 붙인다.
  2. 팀장을 판단하는 함수를 만든다(security definer, `set search_path = ''`): `select exists (select 1 from public.team_leads where user_id = auth.uid());`
  3. `add_content_permissions.sql`의 `can_manage_content()` 본문을 `select public.is_officer() or public.is_team_lead();`로 바꿔 `create or replace`로 다시 실행한다. 이 함수 하나만 바꾸면 `content_posts`의 정책과 `swap_post_times`가 모두 따라간다.
  4. 화면의 `canManage`(`src/pages/ContentPlanner.tsx`, `ContentTasks.tsx`)가 임원진만 보도록 되어 있으니 팀장도 보이도록 고친다. 화면은 편의일 뿐이고 실제 권한은 DB 함수가 막는다.
  5. 부원 관리 화면에 팀장 지정 토글을 만든다(`Admin.tsx`의 졸업 지정과 같은 방식).
- 알려진 한계: 담당자가 졸업생이 되면 그 게시물을 고칠 때 담당자를 다시 지정해야 한다.

## 7단계: 활동 기록, 공모전·프로젝트, 개별 노트
- 활동 기록(`/records`, 테이블 `activity_records`)은 내가 한 활동을 적는 곳이다. 본인만 읽고 쓰며 임원진도 다른 사람 것은 볼 수 없다. 8단계의 포트폴리오 문장 생성이 이 기록을 쓴다.
- 기존 포트폴리오의 `activities`는 지우지 않는다. `supabase/copy_activities_to_records.sql`로 `activity_records`에 복사만 하고, 복사본에는 `source_activity_id`가 채워진다(여러 번 실행해도 중복되지 않는다). 복사를 되돌리려면 그 파일 끝 주석의 문장으로 복사본만 지운다.
- 공모전·프로젝트(`/projects`, 테이블 `projects`, `project_members`): 읽기는 승인된 사용자, 프로젝트 만들기·수정·삭제와 참여 부원 추가·내보내기는 임원진이다. 참여한 부원은 자기 행의 "내 역할"(`role_text`)만 직접 고친다. DB가 컬럼 단위 권한으로 다른 칸 수정을 막는다. 진행률(0~100)은 임원진만 고친다.
- 개별 노트(`/notes`, 테이블 `notes`)는 나만 보는 메모다. 토론(`agenda_id`)에 연결해도 되고 안 해도 된다. 안건 상세의 "내 메모(나만 보임)" 카드(`AgendaNote.tsx`)도 같은 테이블을 쓴다. 이 카드는 확정 여부와 상관없이 쓸 수 있고, 안건 의견 카드와 "내 의견 남기기" 카드 사이에 있다.
- SQL 실행 순서: `add_activity_records.sql` → (선택) `copy_activities_to_records.sql`, `add_projects.sql`, `add_notes.sql` → 프론트. 서로 의존하지 않아 앞의 세 파일은 순서를 바꿔도 된다(복사 파일만 `add_activity_records.sql` 뒤여야 한다). 되돌리기는 각 파일 끝 주석에 있다.
- 졸업생: 활동 기록, 공모전·프로젝트 읽기, 개별 노트, 안건 메모 모두 쓸 수 있다(숨김 표시 없음).

## 8단계: 포트폴리오
- `/portfolio`는 직무별 포트폴리오 목록이고 `/portfolio/:docId`가 편집 화면이다. 한 사람이 직무마다 문서를 따로 만든다. 문서는 본인만 읽고 쓰며 임원진도 다른 사람 것은 볼 수 없다(DB 정책).
- DB: `portfolio_documents`(직무 이름 `job_title`, 칸별 글 `content`). 칸 구성과 직무 기본 목록은 `src/lib/portfolioFields.ts`에 있다. 직무 기본 목록은 `DEFAULT_JOBS`를 고치면 되고, 목록 밖의 직무는 화면에서 직접 입력한다.
- 칸을 더하려면 `SECTIONS`에 항목을 넣는다. 저장할 때 `SECTIONS`에 없는 칸은 버려지므로 칸 키를 바꾸면 기존 글이 보이지 않게 된다.
- 예전 `portfolios`는 지우지 않았다. 부원이 화면의 "예전 포트폴리오 가져오기"로 새 문서 하나로 가져오거나, `supabase/copy_portfolios_to_documents.sql`로 한꺼번에 복사한다. 복사본은 `legacy_user_id`가 채워지고, 이 값이 사람당 한 번만 가져오게 막는다. 복사를 되돌리려면 그 파일 끝 주석을 쓴다. 활동·수상은 `activity_records`(활동 기록)로 일원화했고 예전 `activities`는 DB에 그대로 있다.
- 문장 만들기는 AI가 아니라 규칙·템플릿이다(`src/lib/portfolioTemplates.ts`). 활동 기록의 이름·역할·한 일·결과·기간을 정해진 문장 틀에 끼워 넣고, 받침에 맞춰 조사(을/를, 로서/으로서, 이라는/라는)를 고른다. 직무별 "키운 역량" 구절은 같은 파일의 `JOB_SKILL`에 있다. 새 직무를 기본 목록에 넣으면 이 구절도 함께 적어 준다(없으면 기본 구절을 쓴다).
- PDF: 편집 화면의 "PDF로 저장 / 인쇄"는 브라우저 인쇄를 쓴다. 인쇄할 때는 `no-print` 표시가 있는 부분과 헤더·메뉴를 숨기고 미리보기 카드(`print-doc`)만 남기는 CSS가 `theme.css` 끝에 있다.
- SQL 실행 순서: `add_portfolio_documents.sql` → (선택) `copy_portfolios_to_documents.sql` → 프론트. 프론트가 먼저 배포되면 포트폴리오 화면이 불러오기 오류를 낸다. 되돌리기는 각 파일 끝 주석에 있다.
- 졸업생: 졸업생도 계속 쓸 수 있다(숨김 표시 없음).

## 9단계: 활동 찾기 > 교내활동·대외활동 자동 수집
- 활동 찾기 영역에 "교내활동"(`/explore/campus`)과 "대외활동"(`/explore/external`)이 있다. 사이트 정리(`/explore/sites`)는 서버 없이 쓰는 고정 링크 카드이고, 이 두 화면은 서버 함수가 모은 공고를 보여 준다. 졸업생에게도 보인다.
- 구조: 화면 → `GET /api/activities/campus|external`(Vercel 서버 함수, `api/` 폴더) → 모여봄 API와 구글 뉴스 RSS. 서버 함수는 요청의 로그인 토큰을 검증해 승인된 사용자만 통과시키고, 결과를 `activity_snapshots` 테이블에 마지막 저장본으로 남긴다. 코드는 `api/_lib/`(`auth.ts` 인증, `feeds.ts` 수집·분류, `store.ts` 저장본, `serve.ts` 흐름)에 있다.
- 동작: 3분 안의 저장본은 그대로 보여 주고, 아니면 새로 수집해 저장한다. 새로 수집하지 못하면 마지막 저장본을 "이전 수집 자료"로 보여 주며 수집 시각을 안내한다. 저장본도 없을 때만 오류가 나고 대체 안내(교내소식·사이트 정리 링크)를 보여 준다. 화면은 3분마다 자동으로 다시 확인한다.
- DB: `activity_snapshots`(캐시, 서버 전용 — 화면은 못 읽는다), `campus_favorites`(부원별 즐겨찾기, 본인 행만).
- **환경변수(Vercel 대시보드에서 설정, 값은 문서·코드·채팅에 적지 않는다)**:
  - `SUPABASE_SERVICE_ROLE_KEY`: 서버 전용. 캐시 테이블 쓰기에 필요하다. `VITE_`를 붙이면 화면 코드에 노출되므로 **절대 붙이지 않는다**. 없으면 저장본 없이 매번 직접 수집한다.
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`: 선택. 없으면 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 읽는다.
  - `MOYEOBOM_API_URL`: 선택. 모여봄 주소가 바뀔 때만 넣는다.
  - 환경변수를 바꾼 뒤에는 다시 배포해야 반영된다.
- SQL 실행 순서: `add_activity_feed.sql` → 환경변수 설정 → 배포. 되돌리기는 파일 끝 주석(프론트·서버 함수를 먼저 되돌린다).
- **장애가 났을 때 확인하는 순서**:
  1. 화면에 "이전 수집 자료" 안내가 뜨면 외부(모여봄 또는 구글 뉴스)가 끊긴 것이고, 마지막 저장본이 대신 보이는 정상 동작이다. 안내의 수집 시각이 너무 오래됐다면 외부 상태를 본다.
  2. 오류만 보이면 저장본이 없고 외부도 끊긴 것이다. 모여봄 주소(`api/_lib/feeds.ts`의 기본 주소 또는 `MOYEOBOM_API_URL`)를 브라우저로 열어 응답이 오는지 본다.
  3. 항상 오류가 나면 Vercel 대시보드의 함수 로그에서 `/api/activities/…`를 본다. 401은 로그인 만료, 403은 승인되지 않은 계정, 500 "서버 설정이 완료되지 않았습니다"는 Supabase 주소·키 환경변수 누락이다.
  4. 화면 대신 index.html이 내려오거나 404가 나면 `vercel.json`의 재작성 규칙(`/((?!api/).*)`)과 `api/` 폴더가 배포에 포함됐는지 본다.
  5. 저장본이 쌓이지 않으면 `SUPABASE_SERVICE_ROLE_KEY`가 빠졌거나 `add_activity_feed.sql`이 실행되지 않은 것이다. Supabase 대시보드의 Table Editor에서 `activity_snapshots`의 `checked_at`을 본다. 저장본을 비우려면 그 행을 지우면 다음 요청이 새로 수집한다.
- **모여봄 의존 위험**: 교내활동과 대외활동의 핵심 자료는 모여봄이라는 외부 사이트(`moyeobom-campus.gayoungk1.chatgpt.site`)에서 온다. 원본 운영자가 계속 써도 된다고 허락했지만, 우리가 통제하는 서비스가 아니라서 주소나 응답 형식이 바뀌거나 중단될 수 있다. 대외활동의 구글 뉴스 RSS도 형식이 바뀔 수 있고 이용 약관은 확인하지 못했다. 대비: 마지막 저장본 표시, `MOYEOBOM_API_URL`로 주소 교체, 외부와 무관한 사이트 정리 링크 카드. 모여봄이 아예 없어지면 직접 입력 방식(임원진이 공고를 입력하는 테이블)으로 바꾸는 것을 검토한다.
- 한계: 서버 함수는 로컬 `npm run dev`로 실행되지 않는다(화면만 돈다). 로컬에서 돌려 보려면 Vercel CLI의 `vercel dev`를 쓰거나, 배포 미리보기(Preview)에서 확인한다. Vercel 요금제에 따라 함수 실행 시간 제한이 있으므로 수집은 출처마다 6.5초 제한을 둔다.
