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
