# RLS(권한 규칙) 시험 계획

> **상태: 계획서 [검증 전].** 아래 "기대 권한"은 `supabase/*.sql`의 정책을 **읽고 정리한 것**이고, 실제 DB에서 시험해 보지 않았습니다. 이 문서의 목적은 사람이 Supabase SQL Editor에서 직접 시험해 기대와 실제가 같은지 확인하는 것입니다.
> 개인정보(실제 이름, 이메일, 전화번호, UUID)와 키 값은 이 문서에 적지 않습니다. 시험 결과 기록에도 적지 마세요(저장소가 공개입니다).

## 1. 먼저 알아 둘 것

- **권한은 화면이 아니라 DB(RLS)가 막습니다.** 화면에서 버튼이 숨겨져 있어도 DB가 허용하면 주소·요청으로 가능합니다. 이 시험은 "DB가 정말 막는가"를 보는 것입니다(`CLAUDE.md`의 규칙).
- **운영 DB에서 시험할 때는 읽기 위주로 하고, 쓰기 시험은 반드시 `begin; … rollback;` 안에서만 합니다.** 시험용 Supabase 프로젝트가 있으면 거기서 하는 것이 가장 안전합니다(`HANDOVER.md` 10번).
- SQL Editor의 기본 실행은 `postgres`(관리자) 권한이라 RLS를 건너뜁니다. 그래서 **아래 4번의 "역할 흉내"** 로 일반 사용자처럼 바꿔서 시험합니다.
- 이 문서의 시험은 데이터를 바꾸지 않도록 만들었지만, 실행 전에는 백업(CSV)을 하세요(`HANDOVER.md` 6-3).

## 2. 5종류 사용자의 정의

| 종류 | DB에서의 모습 | 판별 함수 |
|---|---|---|
| **임원진** | 로그인함, `profiles.status = 'approved'`, `role = 'officer'` | `is_officer()` = true, `is_approved()` = true (`schema.sql:84-95`) |
| **부원** | 로그인함, `status = 'approved'`, `role = 'member'`, `member_alumni`에 없음 | `is_approved()` = true |
| **졸업생** | 부원과 같고 `member_alumni`에 행이 있음(승인된 사용자) | `is_approved()` = true, `can_view_content()` = false (`add_content_permissions.sql:26-31`) |
| **미승인** | 로그인함, `status`가 `pending`(승인 대기)·`rejected`(거절)·`removed`(탈퇴) | `is_approved()` = false, `is_officer()` = false |
| **비로그인** | 로그인하지 않음(Supabase의 `anon` 역할) | 테이블 권한이 대부분 `anon`에서 회수돼 있음(`revoke all … from anon`) |

## 3. 기대 권한 표

**읽는 법:** 한 칸은 **읽기·추가·수정·삭제** 순서입니다(예: `O·X·X·X` = 읽기만 가능).
`O` 가능 / `X` 불가 / `본` 본인 행만 / `조` 조건부(표 아래 각주) / `-` 해당 없음(그 동작이 없음).
"승인자" = 임원진·부원·졸업생.

### 3-1. 사람과 계정

| 테이블·뷰 | 임원진 | 부원 | 졸업생 | 미승인 | 비로그인 | 근거 |
|---|---|---|---|---|---|---|
| `profiles` (이름·역할·상태·색, 일부 칸만) | `O·X·조1·X` | `조2·X·X·X` | `조2·X·X·X` | `본·X·X·X` | `X·X·X·X` | `schema.sql:351-352, 362-374`, `add_member_events.sql:29` |
| `profile_private` 뷰 (아이디·전화번호) | 전원 `O` | `본` | `본` | `본` | `X` | `schema.sql:354-360` |
| `signup_applications` (가입 신청서) | `O·X·X·X` | `본·X·X·X` | `본·X·X·X` | `본·X·X·X` | `X` | `add_signup_application.sql:26`, 정책 select만 |
| `withdrawal_requests` (탈퇴 신청) | `O·X·X·O` | `본·본·X·본` | `본·본·X·본` | `본·X·X·본` | `X` | `add_withdrawal_request.sql:18-34` |
| `password_reset_requests` | `O·X·X·O` | `X·X·X·X` | `X·X·X·X` | `X·X·X·X` | `X·X·X·X` | `add_password_reset.sql:17-24` (요청은 함수로만, 5번) |
| `member_alumni` (졸업 표시) | `O·조3·X·O` | `O·X·X·X` | `O·X·X·X` | `X·X·X·X` | `X` | `add_member_alumni.sql:34-49` |

각주 1: 임원진의 `profiles` 수정은 **`role`, `status` 두 칸만** 가능합니다(`grant update (role, status)`).
각주 2: 부원·졸업생은 `status = 'approved'`인 사람의 행만 읽습니다(승인 대기·거절 목록은 임원진만). 읽을 수 있는 칸은 `id, name, role, status, created_at, color`뿐입니다.
각주 3: 졸업 지정은 임원진만, 대상은 **승인된 일반 부원**일 때만(`is_plain_member`) 가능합니다.

### 3-2. 시간표·일정

| 테이블·뷰 | 임원진 | 부원 | 졸업생 | 미승인 | 비로그인 | 근거 |
|---|---|---|---|---|---|---|
| `schedule_blocks` (시간표) | `조4·본·본·본` | `조4·본·본·본` | `조4·본·본·본` | `X·X·X·X` | `X` | `share_schedules.sql`(select), `schema.sql:377`(grant) |
| `busy_blocks` 뷰 (공통 시간 계산용, 과목명 제외) | `O` | `O` | `O` | `X`(행 없음) | `X` | `schema.sql:324-330` |
| `schedule_status` (입력 완료 기록) | `O·본·X·X` | `O·본·X·X` | `O·본·X·X` | `본·X·X·X` | `X` | `add_schedule_status.sql:16-17` |
| `schedule_privacy` (공개 설정) | `O·본·본·X` | `O·본·본·X` | `O·본·본·X` | `X·X·X·X` | `X` | `add_schedule_privacy.sql:14` |
| `events` (달력 일정) | `O·O·O·O` | `O·조5·본·본` | `O·조5·본·본` | `X·X·X·X` | `X` | `add_member_events.sql:40-60` |
| `event_overrides` (반복 일정 날짜별 수정) | `O·O·O·O` | `O·조6·조6·조6` | `O·조6·조6·조6` | `X·X·X·X` | `X` | `add_event_overrides.sql:25-62` |

각주 4: 승인자는 **본인 시간표와, 비공개로 설정하지 않은 사람의 시간표**를 읽습니다. **임원진도 비공개로 설정된 시간표는 읽지 못합니다**(`share_schedules.sql`). 졸업생이 공개 시간표를 읽는 것은 알려진 한계입니다(`HANDOVER.md` 10-1의 4번). 졸업생이 자기 시간표를 쓰는 것을 DB는 막지 않고 메뉴만 숨겨 둡니다.
각주 5: 부원·졸업생은 **개인 일정(`is_club = false`)** 만 추가할 수 있고, 공식 일정(`is_club = true`)은 임원진만 만듭니다. 수정·삭제는 본인이 만든 일정(임원진은 전부)입니다.
각주 6: 해당 일정을 만든 사람 또는 임원진.

### 3-3. 토론

| 테이블 | 임원진 | 부원 | 졸업생 | 미승인 | 비로그인 | 근거 |
|---|---|---|---|---|---|---|
| `agendas` (안건) | `O·O·O·O` | `O·X·X·X` | `O·X·X·X` | `X` | `X` | `schema.sql:393-402` |
| `opinions` (의견) | `O·조7·조7·조7` | `O·조7·조7·조7` | `O·조7·조7·조7` | `X` | `X` | `schema.sql:406-420` |
| `decisions` (결론) | `O·O·O·O` | `O·X·X·X` | `O·X·X·X` | `X` | `X` | `schema.sql:434-443` |

각주 7: **토론 중(`status = 'discussing'`)인 안건에, 본인 이름으로만** 쓰고 고치고 지웁니다. 확정된 안건에는 임원진도 의견을 쓸 수 없습니다. 졸업생도 쓸 수 있는 것은 의도된 규칙입니다(`CLAUDE.md`, 토론 의견 정책은 바꾸지 않음).

### 3-4. 앨범

| 테이블·저장소 | 임원진 | 부원 | 졸업생 | 미승인 | 비로그인 | 근거 |
|---|---|---|---|---|---|---|
| `albums`, `album_photos` | `O·O·O·O` | `O·X·X·X` | `O·X·X·X` | `X` | `X` | `logon_2_albums.sql:50-65` |
| 저장소 `logon-photos` (사진 파일) | `O·O·O·O` | `O·X·X·X` | `O·X·X·X` | `X` | `X` | `logon_3_photo_storage.sql` |

### 3-5. 개편에서 추가한 기능

| 테이블 | 임원진 | 부원 | 졸업생 | 미승인 | 비로그인 | 근거 |
|---|---|---|---|---|---|---|
| `meeting_notes` (회의 변경 이력) | `O·O·O·O` | `O·X·X·X` | `O·X·X·X` | `X` | `X` | `add_meeting_notes.sql:29-45` |
| `content_posts` (콘텐츠 플래너) | `O·O·O·O` | `O·X·X·X` | **`X·X·X·X`** | `X` | `X` | `add_content_posts.sql:41-64`, `can_view_content()` (졸업생은 DB에서도 못 읽음) |
| `projects` (공모전·프로젝트) | `O·O·O·O` | `O·X·X·X` | `O·X·X·X` | `X` | `X` | `add_projects.sql:45-58` |
| `project_members` (참여 부원) | `O·O·조8·O` | `O·X·조8·X` | `O·X·조8·X` | `X` | `X` | `add_projects.sql:41-43, 62-78` |
| `activity_records` (활동 기록) | `본·본·본·본` | `본·본·본·본` | `본·본·본·본` | `X` | `X` | `add_activity_records.sql:35-50` |
| `notes` (노트) | `본·본·본·본` | `본·본·본·본` | `본·본·본·본` | `X` | `X` | `add_notes.sql:27-42` |
| `portfolio_documents` (직무별 포트폴리오) | `본·본·본·본` | `본·본·본·본` | `본·본·본·본` | `X` | `X` | `add_portfolio_documents.sql:31-46` |
| `campus_favorites` (교내활동 즐겨찾기) | `본·본·본·본` | `본·본·본·본` | `본·본·본·본` | `X` | `X` | `add_activity_feed.sql:38-53` |
| `activity_snapshots` (수집 저장본) | `X·X·X·X` | `X·X·X·X` | `X·X·X·X` | `X` | `X` | `add_activity_feed.sql:12-18` (RLS만 켜고 정책 없음, 서버 함수만) |

각주 8: 참여한 본인은 **자기 행의 `role_text`(역할) 칸만** 고칠 수 있습니다(`grant update (role_text)`). 추가·삭제는 임원진만.
**개인 데이터(활동 기록·노트·직무별 포트폴리오·예전 포트폴리오)는 임원진도 남의 것을 읽을 수 없어야 합니다**(`CLAUDE.md`). 시험에서 가장 중요한 항목입니다.

### 3-6. 예전 포트폴리오와 기타

| 테이블 | 임원진 | 부원 | 졸업생 | 미승인 | 비로그인 | 근거 |
|---|---|---|---|---|---|---|
| `portfolios` (예전) | `본·본·본·X` | `본·본·본·X` | `본·본·본·X` | `X` | `X` | `logon_1_portfolio.sql:57` (삭제 권한 없음) |
| `certifications`, `activities` (예전) | `본·본·본·본` | `본·본·본·본` | `본·본·본·본` | `X` | `X` | `logon_1_portfolio.sql:58-59` |
| `app_settings` | `X·X·X·X` | `X` | `X` | `X` | `X` | `schema.sql:336, 344-347` (정책·권한 없음, SQL Editor에서만) |

## 4. 역할 흉내 내는 방법 (SQL Editor, 단계별)

### 4-1. 준비
1. 시험용 계정 5종을 정합니다: 임원진 1, 부원 1, 졸업생 1, 미승인 1(가입만 하고 승인 전), 그리고 비로그인.
2. SQL Editor에서(관리자 권한) 그 계정들의 UUID를 확인합니다. **UUID는 문서나 대화에 적지 말고 이 화면에서만 복사해서 씁니다.**

```sql
select p.id, p.username, p.role, p.status,
       exists (select 1 from public.member_alumni a where a.user_id = p.id) as is_alumni
from public.profiles p
where lower(p.username) in ('시험아이디1', '시험아이디2');   -- ← 시험 계정의 아이디로 바꾼다
```

### 4-2. 역할 흉내 틀 (매번 이 틀 안에서 시험)
**한 번에 실행하는 묶음마다 `begin;`으로 시작해서 `rollback;`으로 끝냅니다.** 그러면 쓰기 시험도 확정되지 않습니다. `<UUID>`는 4-1에서 복사한 값으로 바꿉니다.

```sql
begin;
  set local role authenticated;   -- 로그인한 사용자 역할로 바꾼다
  select set_config('request.jwt.claim.sub', '<UUID>', true);
  select set_config('request.jwt.claims',
         json_build_object('sub', '<UUID>', 'role', 'authenticated')::text, true);

  -- (확인) 흉내가 제대로 됐는지 먼저 본다
  select auth.uid() as me, current_user as 현재역할,
         public.is_approved() as 승인, public.is_officer() as 임원;

  -- ↓ 여기에 시험 쿼리를 넣는다 (4-3, 4-4)

rollback;
```

- **비로그인(anon)** 은 `set local role anon;`만 쓰고 `set_config`는 하지 않습니다(그러면 `auth.uid()`가 비어 있습니다).
- **흉내 확인이 먼저**입니다. 확인 쿼리의 `me`가 UUID로 나오고 `현재역할`이 `authenticated`여야 합니다. 아니라면 이 방법이 대시보드 버전에서 안 되는 것이니 시험을 멈추고 시험용 프로젝트에서 앱으로 직접 시험합니다(확인 필요).
- 대시보드는 여러 문장을 한 번에 실행하면 **마지막 SELECT의 결과만** 보여 줄 수 있습니다(확인 필요). 시험 쿼리를 `union all`로 묶거나 한 묶음에 하나씩 실행하세요.
- 대시보드에 "역할을 골라 실행하는" 기능이 있으면 그것을 써도 됩니다(화면 이름은 확인 필요).

### 4-3. 읽기 시험
읽기는 오류가 나지 않고 **보이는 행 수가 달라집니다.** 기대와 비교합니다.

```sql
-- 예: 개인 데이터는 본인 것만(임원진으로 시험하면 본인 행 수와 같아야 한다)
select count(*) as 전체행수, count(*) filter (where user_id = auth.uid()) as 내행수
from public.activity_records;

-- 예: 졸업생은 콘텐츠 플래너를 못 읽는다 (0행이어야 한다)
select count(*) from public.content_posts;

-- 예: 승인 전 계정은 승인된 사람만 보이는 목록이 비어 있어야 한다
select count(*) from public.agendas;
```

### 4-4. 쓰기 시험
권한이 없으면 **추가는 오류**(`new row violates row-level security policy`), **수정·삭제는 오류 없이 0행**이 바뀝니다. 그래서 `returning`으로 바뀐 행 수를 봅니다(앱도 같은 방식으로 성공을 판단합니다).

```sql
-- 추가 시험(임원진만 성공해야 하는 예: 안건)
insert into public.agendas (title) values ('[RLS시험] 지워질 행') returning id;

-- 수정 시험: 0행이면 막힌 것
with r as (update public.meeting_notes set title = title where id = (select min(id) from public.meeting_notes) returning 1)
select count(*) as 바뀐행 from r;

-- 삭제 시험: 0행이면 막힌 것
with r as (delete from public.projects where id = (select min(id) from public.projects) returning 1)
select count(*) as 바뀐행 from r;
```
- 위 예시의 컬럼·행은 시험 환경에 맞게 바꿉니다. 필수 컬럼이 더 있는 테이블은 오류 문구가 알려 주는 대로 채웁니다.
- 반드시 `rollback;`으로 끝나는 묶음 안에서 실행합니다. 실수로 `commit`이 되면 시험 행이 남으니 제목에 `[RLS시험]`을 붙여 두고, 남았으면 `supabase/handover_cleanup_DRAFT.sql`의 방식으로 정리합니다.

### 4-5. 함수(RPC) 시험
함수는 `security definer`라서 함수 안에서 권한을 따로 확인합니다. 호출해서 **오류 문구**로 판단합니다.

| 함수 | 임원진 | 부원 | 졸업생 | 미승인 | 비로그인 | 근거 |
|---|---|---|---|---|---|---|
| `update_my_profile(이름, 전화)` | O | O | O | 오류 "승인된 부원만 수정" | 오류(로그인 필요/권한 없음) | `add_password_reset.sql:61-76, 82-85` |
| `request_password_reset(아이디)` | O | O | O | O | **O**(로그인 전에 쓰는 함수라 `anon`에 허용됨) | `add_password_reset.sql:81-84` |
| `reset_member_password(대상, 임시 비밀번호)` | O | 오류 "임원진만" | 오류 | 오류 | 권한 없음 | `add_password_reset.sql:97-98, 120` |
| `remove_member(대상)` | O | 오류 "임원진만" | 오류 | 오류 | 권한 없음 | `add_member_alumni_remove.sql:18-19` |
| `purge_member(대상)` | O(탈퇴·거절된 일반 부원만) | 오류 | 오류 | 오류 | 권한 없음 | `add_member_purge.sql:17-33` |
| `set_member_order(ids)` | O | 오류 "임원진만" | 오류 | 오류 | 권한 없음 | `add_member_order.sql:27-28` |
| `update_my_color(색)` | O | O | O | 오류 "승인된 부원만" | 권한 없음 | `add_member_events.sql:74-86` |
| `set_post_progress(게시물, 상태, 검토)` | O(전부) | 담당자 본인 게시물만 | **오류**(`can_view_content`) | 오류 | 권한 없음 | `add_content_posts.sql:71-96` |
| `swap_post_times(a, b)` | O | 오류 | 오류 | 오류 | 권한 없음 | `add_content_posts.sql:99-110` (`can_manage_content()` 확인) |

시험 예: `select public.reset_member_password('<다른 UUID>', 'x');` → 부원으로 흉내 내면 "임원진만 비밀번호를 재설정할 수 있습니다." 오류가 나야 합니다. **임원진으로 흉내 낼 때는 실제 계정의 비밀번호가 바뀌므로 반드시 `rollback;`으로 끝내고, 시험용 계정에만 합니다.**

## 5. 정책 자체를 눈으로 대조하는 방법 (쓰기 없음)
DB에 실제로 적용된 정책을 뽑아 이 문서의 표와 비교합니다.

```sql
-- RLS가 켜져 있는지, 정책이 몇 개인지
select c.relname as 테이블, c.relrowsecurity as rls켜짐,
       (select count(*) from pg_policies p where p.schemaname = n.nspname and p.tablename = c.relname) as 정책수
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

-- 정책 내용(조건식 포함)
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname in ('public', 'storage')
order by tablename, policyname;
```
- `rls켜짐`이 **false인 테이블이 있으면** 가장 먼저 고칩니다(모든 사용자에게 열립니다).
- 정책 수와 3번 표의 동작(읽기/추가/수정/삭제)이 다르면 SQL 파일과 실제 DB가 어긋난 것입니다.

## 6. 특히 확인할 위험 항목 (우선순위)
1. **개인 데이터를 임원진이 읽을 수 있는가?** 임원진으로 흉내 내서 다른 사람의 `activity_records`, `notes`, `portfolio_documents`, `portfolios`를 읽는 행 수가 0이어야 합니다.
2. **비로그인이 어떤 테이블도 못 읽는가?** `anon` 역할로 3번의 모든 테이블에서 "permission denied"가 나와야 합니다.
3. **미승인 계정이 승인자 전용 데이터를 못 읽는가?** 특히 `agendas`, `albums`, `events`, `profiles`(본인 행 외).
4. **졸업생이 콘텐츠 플래너를 못 읽는가?** `content_posts` 0행.
5. **부원이 임원진 전용 쓰기를 못 하는가?** `agendas`, `decisions`, `albums`, `projects`, `meeting_notes`, 공식 일정(`events.is_club = true`).
6. **확정된 안건에 의견을 못 쓰는가?** `opinions` 추가가 오류여야 합니다.
7. **본인이 아닌 `user_id`로 추가가 막히는가?** 부원으로 흉내 내서 남의 UUID로 `notes`를 추가하면 오류여야 합니다.

## 7. 알려진 예외 (이미 문서화된 것, 시험에서 "실패"가 아님)
- 졸업생이 부원의 **공개 시간표를 읽을 수 있습니다**(`HANDOVER.md` 10-1의 4번).
- 졸업생이 `schedule_blocks`, `schedule_privacy`, 개인 일정, 개인 데이터 테이블에 **쓰는 것을 DB가 막지 않습니다**(메뉴만 숨김).
- 임원진도 비공개로 설정된 시간표를 읽지 못합니다.
- `request_password_reset`은 비로그인도 호출할 수 있습니다(의도).

## 8. 결과 기록표 (복사해서 쓰세요)
| 날짜 | 시험한 사람 | 환경(시험용/운영) | 항목(표의 행) | 역할 | 기대 | 실제 | 일치(O/X) | 메모 |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

시험에서 기대와 다른 결과가 나오면 **고치기 전에** 멈추고 임원 회의에서 알립니다. 정책을 고칠 때는 기존 SQL 파일을 수정하지 않고 새 SQL 파일로 만듭니다(`CLAUDE.md`).
