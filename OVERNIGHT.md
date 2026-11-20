# 밤샘 작업 기록 (2026-11-21)

사용자가 자는 동안 질문 없이 진행한 작업의 기록이다. 단계마다 브랜치를 하나씩 남겼고, 앞 단계 브랜치 위에 쌓았다.
`main`은 건드리지 않았고 어떤 브랜치도 푸시하지 않았다. Supabase에 접속하지 않았고 SQL은 `supabase\` 폴더에 새 파일로만 만들었다(실행은 사용자가 한다).

## 지킨 규칙
- git push 금지, `main` 수정·병합 금지, 모든 작업은 브랜치에서만.
- 기존 SQL 파일과 기존 라우트 주소, 졸업생 접근 규칙(열람·토론 의견 가능, 내 시간표·공통 시간 숨김)을 바꾸지 않았다.
- 비밀 값 파일을 만들거나 쓰지 않았다. `steering_demo/`와 `reference/`는 커밋하지 않았다.
- 3번 시도해도 build/lint가 안 되면 그 단계를 멈추고 여기에 적는다.

## 브랜치와 커밋 해시
(커밋 해시는 다음 단계 커밋에서 채운다. 마지막 단계는 마지막 문서 커밋에서 채운다. `git log --oneline`으로도 볼 수 있다.)

| 단계 | 브랜치 | 커밋 |
|---|---|---|
| 0(2단계) | feat/overhaul-2-discussion-tabs | 3c3e5e3 |
| 3 | feat/overhaul-3-weekly-calendar | 49490b6 |
| 4 | feat/overhaul-4-sites | c82dc50 |
| 5 | feat/overhaul-5-meeting-notes | 7a6b07b |
| 6 | feat/overhaul-6-content-planner | 4fe775b |
| 7 | feat/overhaul-7-records | (다음 단계에서 기록) |

## 0단계: 2단계 작업 커밋
- 브랜치 `feat/overhaul-2-discussion-tabs`, 커밋 `3c3e5e3` "개편 2단계: 토론 탭(전체·토론 중·확정 및 결론)".
- 변경 파일: `src/App.tsx`, `src/lib/areas.ts`, `src/pages/AgendaDetail.tsx`, `src/pages/Agendas.tsx`, `src/pages/Decisions.tsx`, `src/styles/theme.css`.
- SQL 없음.
- 확인할 화면: 토론의 세 탭(임원진·부원·졸업생), `/decisions` 이동, 안건 상세에서 들어온 탭으로 돌아가기. 아직 사람이 화면으로 확인하지 못했다.

## 3단계: 주간 달력, 공통 시간 확인 버튼
- 브랜치 `feat/overhaul-3-weekly-calendar` (2단계 브랜치 위).
- 변경 파일: `src/pages/Calendar.tsx`, `src/components/Layout.tsx`, `src/lib/calendar.ts`, `src/styles/theme.css`.
- 새 파일: `src/components/WeekView.tsx`, `src/components/layout-context.ts`, `src/lib/useElementWidth.ts`, `HANDOVER.md`, `OVERNIGHT.md`.
- SQL 없음.
- 한 일:
  - 달력 위에 월간/주간 전환 칩을 넣었다. 주간은 그 주 일~토 7일의 일정을 모두 보여 주고, 날짜를 누르면 아래 상세 패널이 그 날로 바뀐다. 날짜 옆 "+"로 바로 일정을 추가할 수 있다.
  - "공통 시간 확인" 버튼(`/common` 링크)을 달력 도구줄에 넣었다. 졸업생에게는 보이지 않는다.
  - 사이드바 때문에 좁아진 달력의 일정 막대 개수 판단을 화면 폭(768px)에서 달력이 실제로 차지한 폭(540px 이상이면 3개, 아니면 2개)으로 바꿨다.
- 확인할 화면과 계정:
  - 일반 부원·임원진: `/calendar`에서 월간↔주간 전환, 주간의 이전·이번·다음 주 이동, 날짜 선택, "+"로 일정 추가, "공통 시간 확인" 버튼이 `/common`으로 가는지.
  - 졸업생: 같은 화면에서 "공통 시간 확인" 버튼이 없어야 한다.
  - 폭: 320/360/390px(주간이 날짜별 한 줄 목록으로 쌓이는지), 768px, 1000/1100/1200px(사이드바와 함께 막대 개수가 답답하지 않은지).
  - 새로고침 후 `?view=week`가 유지되는지.
- 결정 사항:
  - 주간은 일~토로 했다. 이유: 같은 화면의 월 달력이 일요일 시작이고, 불러온 월 달력 범위가 항상 일~토 한 주 단위라 주간 보기에서 추가 조회가 필요 없다. (콘텐츠 플래너의 월~일과는 다르다.)
  - 졸업생 여부는 Layout이 화면에 넘겨 주는 값(`layout-context.ts`)으로 받는다. 비동기 조회로 받으면 버튼이 잠깐 보였다 사라지기 때문이다.
  - 월간/주간 선택은 주소(`?view=week`)에 남긴다. 기록은 쌓지 않는다.
- 못 한 것: 화면을 직접 볼 수 없어서 모양(색, 간격, 줄바꿈)은 확인하지 못했다. 빌드와 린트만 통과했다.

## 4단계: 활동 찾기 > 사이트 정리
- 브랜치 `feat/overhaul-4-sites` (3단계 브랜치 위).
- 변경 파일: `src/App.tsx`, `src/lib/areas.ts`, `src/styles/theme.css`, `OVERNIGHT.md`, `HANDOVER.md`.
- 새 파일: `src/lib/resources.ts`(링크 카드 목록), `src/pages/explore/Sites.tsx`.
- SQL 없음.
- 한 일: `reference/site-summary/screen.html`의 고정 링크 카드(대외활동·공모전 3곳, 직무·진로 탐색 4곳)를 React로 옮겼다. 우리 보라색 테마의 카드로 보여 주고 새 창으로 연다. 허브의 "활동 찾기" 카드가 "준비 중"에서 실제 메뉴(`/explore/sites`)로 연결된다. `/explore`는 `/explore/sites`로 이동한다.
- 확인할 화면과 계정:
  - 모든 계정(임원진·부원·졸업생): 허브의 "활동 찾기" 카드가 눌리고, 사이트 정리 화면에 두 묶음의 카드가 보이며, 카드를 누르면 새 창으로 해당 사이트가 열리는지.
  - 폭: 320/360/390px(카드가 한 열로 쌓이는지), 768px 이상(여러 열).
- 결정 사항:
  - 링크 목록은 `src/lib/resources.ts` 한 파일에 모았다. 이유: 링크를 바꿀 때 화면 코드를 건드리지 않게 하려고.
  - 원본 화면의 "자동 수집 공고" 목록(물류·무역·유통·해운·항만 대외활동)은 가져오지 않았다. 요청 범위(고정 링크 카드)가 아니고 서버 함수와 환경변수가 필요한 9단계 몫이다.
  - 졸업생에게도 보인다(숨김 표시 없음). 이유: 열람 전용 링크이고 졸업생 제한 대상이 아니다.
- 못 한 것: 화면을 직접 볼 수 없어서 모양은 확인하지 못했다. 외부 사이트 주소는 원본에 적힌 그대로이며 지금 열리는지는 확인하지 못했다.

## 5단계: 회의 변경 이력
- 브랜치 `feat/overhaul-5-meeting-notes` (4단계 브랜치 위).
- 변경 파일: `src/App.tsx`, `src/lib/areas.ts`, `OVERNIGHT.md`, `HANDOVER.md`.
- 새 파일: `src/pages/MeetingNotes.tsx`, `supabase/add_meeting_notes.sql`.
- **새 SQL과 실행 순서**:
  1. 실행 전에 PLAN.md 8-6의 "처음 한 번" 백업(CSV)을 한다.
  2. `supabase/add_meeting_notes.sql`을 Supabase SQL Editor에 통째로 붙여 실행한다(새 테이블 `meeting_notes`만 만든다).
  3. 그다음 프론트를 배포한다. SQL을 먼저 실행해도 지금 배포된 화면에는 영향이 없다.
  - **되돌리기**: 프론트를 먼저 되돌린 뒤 파일 끝의 `drop table if exists public.meeting_notes;` 주석을 실행한다(적어 둔 회의록이 사라지므로 먼저 백업).
- 한 일: 활동 일정 영역에 "회의 변경 이력" 메뉴(`/meetings`)를 추가했다. 화면 문구는 "회의에서 합의한 사항과 콘텐츠 변경 내용을 확인하세요."이고, 임원진에게는 "+ 회의 내용 기록" 버튼이 보인다. 목록은 회의 날짜 내림차순(같은 날은 최근 기록이 위)이며, 임원진은 각 항목을 수정·삭제할 수 있다.
- 확인할 화면과 계정(SQL 실행 후):
  - 임원진: "+ 회의 내용 기록"으로 제목·날짜·내용을 저장하고, 목록에 날짜 내림차순으로 나타나는지. 수정, 삭제(확인창 후)가 되는지.
  - 일반 부원: 목록과 내용은 보이고 기록·수정·삭제 버튼은 없어야 한다.
  - 졸업생: 일반 부원과 같게 읽기만 되는지(메뉴에 "회의 변경 이력"이 보여야 한다).
  - 폭: 320/360/390px에서 제목과 날짜 배지가 겹치지 않고 긴 내용이 줄바꿈되는지.
- 결정 사항:
  - 작성자 이름은 `profiles` 조인으로 보여 주고, 계정이 없어졌으면 "탈퇴한 부원"으로 보인다(토론 의견과 같은 방식).
  - 수정은 "바뀐 행이 있는지"로 성공을 판단한다. 권한이 없으면 오류 없이 0행이 바뀌기 때문이다.
  - 수정 시각 갱신은 기존 `touch_updated_at()` 함수를 재사용했다(새 함수를 만들지 않았다).
  - 기존 "회의 변경 이력"의 사용자 설명이 두 번 달랐는데(주차 날짜 / 제목·회의 날짜) 나중 설명(제목, 회의 날짜, 내용, 작성자)을 따랐다.
- 못 한 것: SQL은 실행하지 못했다(규칙상 접속 금지). 화면 모양도 직접 확인하지 못했다.

## 6단계: 콘텐츠 플래너
- 브랜치 `feat/overhaul-6-content-planner` (5단계 브랜치 위).
- 변경 파일: `src/App.tsx`, `src/lib/areas.ts`, `src/styles/theme.css`, `OVERNIGHT.md`, `HANDOVER.md`.
- 새 파일: `src/pages/ContentPlanner.tsx`, `src/pages/ContentTasks.tsx`, `src/components/PostProgress.tsx`, `src/lib/contentPlanner.ts`, `src/lib/useContentData.ts`, `supabase/add_content_permissions.sql`, `supabase/add_content_posts.sql`.
- **새 SQL과 실행 순서**(순서를 반드시 지킨다):
  1. 실행 전에 PLAN.md 8-6의 "처음 한 번" 백업(CSV)을 한다. `add_member_alumni.sql`이 이미 실행돼 있어야 한다(졸업생 테이블을 쓴다).
  2. `supabase/add_content_permissions.sql` (권한 함수 3개: `can_manage_content`, `can_view_content`, `is_content_assignee`).
  3. `supabase/add_content_posts.sql` (테이블 `content_posts`, 정책 4개, 함수 `set_post_progress`, `swap_post_times`).
  4. 그다음 프론트를 배포한다. SQL을 먼저 실행해도 지금 배포된 화면에는 영향이 없다.
  - **되돌리기**: 프론트를 먼저 되돌린 뒤, `add_content_posts.sql` 끝 주석(함수 2개와 테이블 삭제) → `add_content_permissions.sql` 끝 주석(함수 3개 삭제) 순서로 실행한다. 적어 둔 게시물이 사라지므로 먼저 백업한다.
- 한 일:
  - 활동 일정에 "콘텐츠 플래너"(`/content`)와 "담당자별 업무"(`/tasks`) 메뉴를 추가했다. 둘 다 졸업생에게 메뉴가 숨겨지고, DB도 졸업생의 읽기를 막는다(`can_view_content`). 졸업생이 주소로 열면 "제공되지 않는 화면" 문구만 보인다.
  - 플래너: 월~일 주간 칸(칸마다 + 버튼, 임원진만), 그 주 게시물 수와 유형별(카드뉴스·릴스·실시간 콘텐츠) 개수, 콘텐츠 목록(게시 예정일시 순), "미완료만"(게시 완료가 아닌 것) 필터, 앞으로/뒤로(목록에서 인접한 두 게시물의 게시 예정일시 교환, 임원진만), 만들기·수정·삭제(임원진만), 자료 링크 열기.
  - 업로드 점검(한국 시간 기준): 한 주(월~일)에 주말(토·일) 2건 이상이거나 주 5건 이상이면 "과밀", 연속한 게시물 간격이 24시간 미만이면 "간격 조정"을 보여 준다.
  - 담당자는 자기 게시물의 게시 상태와 검토 대기/완료만 바꾼다(`set_post_progress` 함수가 다른 칸은 못 바꾸게 한다). 임원진은 모든 게시물에 쓸 수 있다.
  - 담당자별 업무: 담당자별 카드에 미완료 건수와 목록을 보여 준다(담당자 없음 카드 포함). 내 게시물은 카드 안에서 바로 상태·검토를 바꾼다.
  - 팀장 권한을 나중에 쉽게 넣도록 권한 판단을 `add_content_permissions.sql`의 함수 세 개에 모았다. 추가 방법은 HANDOVER.md와 그 파일 주석에 적었다.
- 확인할 화면과 계정(SQL 두 파일 실행 후):
  - 임원진: 콘텐츠를 추가(주간 칸의 +, 상단 버튼)·수정·삭제, 담당자 지정, 앞으로/뒤로, 주간 이동, "미완료만". 한 주에 5건 이상 또는 주말 2건 이상 넣어 "과밀", 24시간 안쪽 두 게시물로 "간격 조정"이 뜨는지. 게시 예정일시가 한국 시간으로 보이는지(밤 11시~새벽 1시 근처 시각으로 날짜가 맞는지).
  - 담당자로 지정된 일반 부원: 내 게시물의 상태·검토만 바뀌고, 다른 사람 게시물은 글자로만 보이며, 추가·수정·삭제 버튼이 없어야 한다. 담당자별 업무에서도 내 카드에서 바꿀 수 있다.
  - 담당자가 아닌 일반 부원: 모두 글자로만 보인다.
  - 졸업생: 메뉴가 없고, 주소(`/content`, `/tasks`)로 열어도 내용이 보이지 않는다.
  - 폭: 320/360/390px에서 주간 칸이 날짜별 한 줄로 쌓이고 폼과 버튼이 겹치지 않는지.
- 결정 사항:
  - 담당자별 업무의 주소는 `/tasks`로 했다(`/content/tasks`가 아님). 이유: 메뉴의 현재 위치 표시가 주소 앞부분이 같으면 두 항목을 모두 강조해서, 겹치지 않게 하려고.
  - 앞으로/뒤로는 화면에 보이는 목록(필터 적용)에서 인접한 게시물과 바꾼다. 교환은 한 번에 처리하는 DB 함수로 해서 한쪽만 바뀌는 일이 없다.
  - 둘 다 "게시 완료"인 연속 게시물 쌍은 간격 안내에서 뺐다(이미 지난 일이라 알려 봐야 소용없어서).
  - 담당자 칸에는 졸업생을 뺀 승인된 부원(임원진 포함)만 고를 수 있다. DB도 같은 검사를 한다. 담당자가 나중에 졸업생이 되면 그 게시물을 고칠 때 담당자를 다시 지정해야 한다.
  - 주간 칸은 월~일이다(계획대로). 3단계 달력의 일~토와는 다르다.
  - 자료 링크는 http(s)만 허용하고 화면에서도 같은 검사 후에만 링크로 연다.
- 못 한 것: SQL은 실행하지 못했다(규칙상 접속 금지). 화면 모양과 한국 시간 경계의 실제 동작은 직접 확인하지 못했다. 빌드와 린트만 통과했다.

## 7단계: 활동 기록, 공모전·프로젝트, 개별 노트
- 브랜치 `feat/overhaul-7-records` (6단계 브랜치 위).
- 변경 파일: `src/App.tsx`, `src/lib/areas.ts`, `src/pages/AgendaDetail.tsx`, `src/styles/theme.css`, `OVERNIGHT.md`, `HANDOVER.md`.
- 새 파일: `src/pages/ActivityRecords.tsx`, `src/pages/Projects.tsx`, `src/pages/Notes.tsx`, `src/components/NoteItem.tsx`, `src/components/AgendaNote.tsx`, `src/lib/activityRecords.ts`, `supabase/add_activity_records.sql`, `supabase/add_projects.sql`, `supabase/add_notes.sql`, `supabase/copy_activities_to_records.sql`.
- **새 SQL과 실행 순서**:
  1. 실행 전에 PLAN.md 8-6의 "처음 한 번" 백업(CSV)을 하고, 복사 전에 `activities`도 CSV로 받아 둔다.
  2. `supabase/add_activity_records.sql` (테이블 `activity_records`, 본인만).
  3. (선택, 내가 직접 실행) `supabase/copy_activities_to_records.sql` — 포트폴리오의 기존 `activities`를 `activity_records`로 복사만 한다. 원본은 그대로 두고, 여러 번 실행해도 이미 복사한 행은 건너뛴다. 이 SQL은 모든 부원의 활동을 각자의 user_id로 복사한다.
  4. `supabase/add_projects.sql` (테이블 `projects`, `project_members`).
  5. `supabase/add_notes.sql` (테이블 `notes`).
  6. 프론트를 배포한다. 2·4·5번은 서로 의존하지 않아 순서는 바꿔도 된다.
  - **되돌리기**: 프론트를 먼저 되돌린 뒤 각 파일 끝 주석의 `drop table`을 실행한다. 복사만 되돌리려면 `copy_activities_to_records.sql` 끝 주석(`source_activity_id`가 있는 행만 삭제)을 쓴다. 원본 `activities`는 어떤 경우에도 건드리지 않는다.
- 한 일:
  - 활동 기록 영역 메뉴를 "활동 기록 / 공모전·프로젝트 / 토론 / 개별 노트 / 아카이브"로 늘렸다. 허브의 활동 기록 카드는 이제 활동 기록(`/records`)으로 간다.
  - 활동 기록(`/records`): 활동 이름, 분류, 내 역할, 기간, 한 일, 결과를 적고 수정·삭제한다. 본인만 보인다(DB도 본인 것만 허용).
  - 공모전·프로젝트(`/projects`): 읽기는 모두. 임원진은 프로젝트 만들기·수정(진행률 0~100)·삭제와 참여 부원 추가·내보내기. 참여한 부원은 "내 역할"만 직접 고친다(DB가 `role_text` 칸만 허용).
  - 개별 노트(`/notes`): 나만 보는 노트 모음. 토론에 연결해서 쓰거나 연결 없이 쓰고, 토론별로 걸러 볼 수 있다.
  - 안건 상세에 "내 메모(나만 보임)" 카드를 의견 카드와 "내 의견 남기기" 카드 사이에 넣었다. 확정 여부와 상관없이 쓸 수 있도록 확정 잠금 분기 바깥에 두었다. 메모를 불러오지 못해도 토론 화면의 다른 부분은 그대로 동작한다.
- 확인할 화면과 계정(SQL 실행 후):
  - 모든 계정(임원진·부원·졸업생): 활동 기록 추가·수정·삭제가 되고 다른 사람 것은 안 보이는지(졸업생도 쓸 수 있다). 개별 노트도 같다. 안건 상세에서 "내 메모"를 적고, 확정된 안건에서도 적히는지.
  - 임원진: 프로젝트 만들기·수정·삭제, 진행률 막대, 참여 부원 추가·내보내기.
  - 참여 중인 일반 부원: 프로젝트 카드에서 "내 역할"만 저장되고 다른 칸 수정 버튼은 없어야 한다. 참여하지 않은 부원은 읽기만.
  - 폭: 320/360/390px에서 카드와 폼이 겹치지 않는지.
  - 복사 SQL 실행 후: 활동 기록에 예전 포트폴리오 활동이 나타나는지.
- 결정 사항:
  - 프로젝트 진행률은 임원진만 고친다(진행률을 누가 고칠지 정해진 말이 없어 가장 단순하고 안전한 쪽으로 했다).
  - 참여 부원은 임원진이 추가한다. 부원이 스스로 참여하는 기능은 만들지 않았다. 이유: 요청에 "프로젝트 쓰기=임원진, 내 역할은 본인 행만"이라고 되어 있어서.
  - `activity_records`의 열은 기존 `activities`와 같은 이름(`started_on`, `ended_on` 등)에 `role_text`, `outcome`, `source_activity_id`를 더했다. 이유: 복사 SQL이 단순해지고 되돌릴 때 복사본만 골라낼 수 있어서.
  - 토론이 지워지면 노트는 남도록 `agenda_id`를 `on delete set null`로 했다.
  - 활동 기록·노트·프로젝트는 졸업생에게도 보인다(숨김 표시 없음). 졸업생도 포트폴리오를 계속 쓸 수 있어야 해서.
- 못 한 것: SQL은 실행하지 못했다(규칙상 접속 금지). 화면 모양도 직접 확인하지 못했다.
