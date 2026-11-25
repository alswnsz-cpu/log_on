# SQL 파일 안내 (supabase 폴더)

이 폴더의 SQL 파일은 Supabase 대시보드의 **SQL Editor**에서 실행합니다. 파일 안의 내용을 통째로 복사해 붙여 넣고 Run을 누릅니다.
파일마다 맨 위에 "무엇을 하는 파일인지", 맨 아래에 `[R] 되돌리기` 문장(주석)이 있습니다.

> **[검증 전]** 아래 "새 DB를 처음부터 만들 때" 순서는 파일 설명과 내용을 읽고 정리한 것이며, 실제 새 DB에서 처음부터 실행해 본 적은 없습니다. 처음 해 볼 때는 반드시 시험용 프로젝트에서 먼저 해 보세요.

## 운영 DB 현재 상태
**SQL 1~37번이 모두 적용돼 있습니다.** 38번(`add_debate_workflow.sql`, 토론 워크플로)은 `feat/debate-workflow` 브랜치에만 있고 **미적용**입니다(검토 중, 동료가 개인 Supabase에서 시험 예정). 선택 파일 `copy_*.sql` 2개는 실행하지 않았습니다.

| 번호 | 운영 적용일 |
|---|---|
| 1~20 | 2026-11-22 이전(파일별 날짜는 확인 필요) |
| 21~28 | 2026-11-22 |
| 29~33 | 2026-11-22 |
| 34 | 위 날짜들보다 이전(파일 첫 줄에는 "2026-11-17 실행 완료"라고 적혀 있음) |
| 35~37 | 2026-11-24 |
| 38 | **미적용**(이 브랜치에는 파일이 없음) |

- 아래 표의 **[검증 전]** 은 "화면·동작을 직접 확인한 기록이 없음"이라는 뜻이고, **적용 여부와는 별개**입니다.
- 일부 SQL 파일(예: 35~37번)의 맨 위 설명에는 아직 "운영 미적용"이라고 적혀 있습니다. 파일을 만들 때의 설명이며, **현재 상태는 이 절이 기준**입니다(기존 SQL 파일은 고치지 않습니다). 35번 설명의 "압축파일은 application/octet-stream으로 올린다"도 실제와 달랐고, 그래서 37번을 추가했습니다.

## 지켜야 할 규칙
1. **기존 SQL 파일은 고치지 않습니다.** 바꿀 일이 생기면 새 SQL 파일을 만듭니다(새 테이블·함수·정책을 "추가"하는 방식).
2. **SQL을 먼저, 화면(프런트) 배포는 나중에** 합니다. 화면이 먼저 나가면 없는 테이블을 읽으려다 오류가 납니다.
3. 실행하기 전에 **백업(CSV 내보내기)** 을 합니다. 방법은 `HANDOVER.md` 6번에 있습니다.
4. 파일 맨 위 설명에 "구간을 나눠서 하나씩 실행"이라고 적힌 파일은 `[1]`, `[2]`, `[3]` 구간을 **따로따로** 실행합니다. 해당 파일: `add_schedule_status`, `add_signup_application`, `add_member_removal`, `add_withdrawal_request`, `add_password_reset`, `add_member_events`, `add_unique_colors`, `add_member_order`.
5. 한 번 실행한 파일을 다시 실행하지 않습니다(이미 있는 테이블을 또 만들려다 오류가 납니다). 단, 아래 "함수를 덮어쓰는 파일"은 다시 실행하면 최신 내용이 옛 내용으로 되돌아갈 수 있어 더 위험합니다.

## 새 DB를 처음부터 만들 때의 실행 순서

| 순서 | 파일 | 하는 일 | 되돌리기 |
|---|---|---|---|
| 1 | `schema.sql` | 기본 테이블(프로필, 시간표, 토론, 의견, 결론), 가입 트리거, 권한(RLS), 시간표·프로필 보기용 뷰 | 새 DB 전용. 되돌리려면 프로젝트를 새로 만듭니다 |
| 2 | `add_schedule_status.sql` | 시간표 "입력 완료" 기록 | 파일 끝 `[R]` |
| 3 | `add_signup_application.sql` | 가입 신청서(학번·나이·가입 동기·자기소개) 저장, 가입 트리거 교체 | 파일 끝 `[R]` |
| 4 | `add_member_removal.sql` | 임원진의 부원 탈퇴 처리, 탈퇴자의 복귀 신청 | 파일 끝 `[R]` |
| 5 | `add_withdrawal_request.sql` | 부원의 탈퇴 신청 | 파일 끝 `[R]` |
| 6 | `add_password_reset.sql` | 내 정보 수정, 비밀번호 재설정 요청·임시 비밀번호 | 파일 끝 `[R]` |
| 7 | `add_events.sql` | 달력 일정(동아리 공식 일정) | 파일 끝 `[R]` |
| 8 | `add_event_repeat.sql` | 일정 매주 반복 | 파일 끝 `[R]` |
| 9 | `add_member_events.sql` | 부원 개인 일정, 부원별 색상 | 파일 끝 `[R]` |
| 10 | `add_unique_colors.sql` | 색이 겹치지 않게 하기, 색 자동 배정 | 파일 끝 `[R]` |
| 11 | `add_member_order.sql` | 관리 화면의 부원 순서 정하기 | 파일 끝 `[R]` |
| 12 | `add_member_purge.sql` | 탈퇴·거절된 계정 완전 삭제 | 파일 끝 `[R]`(지운 계정은 복구 불가) |
| 13 | `add_event_overrides.sql` | 반복 일정을 날짜마다 따로 수정 | 파일 끝 `[R]` |
| 14 | `add_schedule_privacy.sql` | 시간표 공개/비공개 설정 | 파일 끝 `[R]`(15번을 먼저 되돌려야 함) |
| 15 | `share_schedules.sql` | 공개 시간표 읽기 정책으로 교체(14번 다음에 실행) | 파일 끝 `[R]` |
| 16 | `logon_1_portfolio.sql` | 포트폴리오(예전)·자격증·활동 테이블 | 파일 끝 `[R]` |
| 17 | `logon_2_albums.sql` | 앨범·사진 목록 테이블 | 파일 끝 `[R]` |
| 18 | `logon_3_photo_storage.sql` | 사진 저장소(비공개 버킷 `logon-photos`) | 파일 끝 `[R]`(파일을 먼저 비워야 함) |
| 19 | `add_member_alumni.sql` | 졸업생 구분(`member_alumni`) | 파일 끝 `[R]` |
| 20 | `add_member_alumni_remove.sql` | 탈퇴 처리 때 졸업 표시도 함께 지우기(`remove_member` 최신 버전) | 파일 끝 `[R]`(옛 함수 문장 포함) |
| 21 | `add_meeting_notes.sql` **[검증 전]** | 회의 변경 이력(회의록) | 파일 끝 `[R]` |
| 22 | `add_content_permissions.sql` **[검증 전]** | 콘텐츠 권한 함수 3개(팀장 추가는 여기만 고침) | 파일 끝 `[R]`(23번을 먼저 되돌림) |
| 23 | `add_content_posts.sql` **[검증 전]** | 콘텐츠 플래너 게시물, 상태 변경·순서 교환 함수 | 파일 끝 `[R]` |
| 24 | `add_activity_records.sql` **[검증 전]** | 활동 기록(본인만) | 파일 끝 `[R]` |
| 25 | `add_projects.sql` **[검증 전]** | 공모전·프로젝트, 참여 부원과 역할 | 파일 끝 `[R]` |
| 26 | `add_notes.sql` **[검증 전]** | 개별 노트·토론 메모(본인만) | 파일 끝 `[R]` |
| 27 | `add_portfolio_documents.sql` **[검증 전]** | 직무별 포트폴리오 문서(본인만) | 파일 끝 `[R]` |
| 28 | `add_activity_feed.sql` **[검증 전]** | 활동 찾기 수집 저장본(서버 전용), 교내활동 즐겨찾기 | 파일 끝 `[R]` |
| 29 | `logon_4_album_interactions.sql` **[검증 전]** | 앨범 좋아요·댓글 | 파일 끝 `[R]` |
| 30 | `add_logistics_insight.sql` **[검증 전]** | 물류 인사이트·댓글·좋아요·북마크 | 파일 끝 `[R]` |
| 31 | `add_resource_library.sql` **[검증 전]** | 자료실·첨부파일·북마크 | 파일 끝 `[R]` |
| 32 | `add_career_hub.sql` **[검증 전]** | 기업·직무·채용·취업 정보 공유 | 파일 끝 `[R]` |
| 33 | `add_notices.sql` **[검증 전]** | 공지사항·회원별 확인 기록 | 파일 끝 `[R]` |
| 34 | `remove_signup_code.sql` | 가입 코드 검사 제거(가입 함수 파일 중 **마지막**에 실행) | 이 파일을 되돌리는 문장은 없고, 가입 코드 검사가 필요하면 `add_signup_application.sql`의 가입 함수 부분을 다시 실행합니다 |
| 35 | `add_library_archive_ext.sql` | 자료실 첨부에 zip·7z 허용(확장자 CHECK 제약 교체). 2026-11-24 운영 적용 완료 | 파일 끝 `[R]` |
| 36 | `add_library_size_50mb.sql` | 자료실 첨부 파일 1개당 상한 20MB → 50MB(size_bytes CHECK 제약 교체 + 버킷 file_size_limit). 2026-11-24 운영 적용 완료 | 파일 끝 `[R]` |
| 37 | `add_library_zip_mime.sql` | 자료실 버킷 허용 MIME에 `application/zip`, `application/x-zip-compressed`, `application/x-7z-compressed` 추가(압축파일 업로드가 거절되던 문제). 2026-11-24 운영 적용 완료 | 파일 끝 `[R]` |

**34번이 가입 함수 파일 중 마지막인 이유:** 이 파일은 가입 확인 함수(`validate_signup`)에서 가입 코드 검사를 뺀 최신 버전입니다. 앞의 옛 파일(3번 등)을 나중에 다시 실행하면 가입 코드 검사가 되살아나서 새 가입이 막힙니다. 옛 파일을 다시 실행했다면 반드시 34번을 마지막에 다시 실행하세요. (35~37번은 자료실 설정만 바꾸고 가입 함수와 무관해서 순서에 영향을 주지 않습니다. 34번 다음에 실행합니다.)

**첫 임원진 만들기:** 37번까지 끝낸 뒤 임원진이 될 사람 2명이 앱에서 먼저 가입하고, 아래 "첫 임원진 지정"을 실행합니다(`HANDOVER.md` 8번에 문장이 있습니다).

## 새 DB에서는 실행하지 않는 파일

| 파일 | 이유 |
|---|---|
| `fix_signup_trigger.sql`, `fix_username_login.sql`, `fix_reopen_agenda.sql` | 예전 `schema.sql`로 만든 DB를 고치던 파일입니다. 지금의 `schema.sql`에 이미 합쳐져 있어서 새 DB에서 또 실행하면 "이미 있다"는 오류가 납니다 |
| `add_logon_tables.sql` | `logon_1`~`logon_3`으로 쪼개기 전의 원본입니다. 새 DB에서는 쪼갠 3개를 씁니다 |
| `copy_activities_to_records.sql`, `copy_portfolios_to_documents.sql` | 예전 데이터를 새 테이블로 **복사**하는 파일입니다. 옛 데이터가 있는 DB에서만 필요하고 새 DB에는 옮길 데이터가 없습니다 |
| `migrate_existing_accounts_*.sql`, `seed_officer.sql` | 개인정보(이메일 등)가 들어 있어서 **저장소에 올리지 않는 파일**입니다(`.gitignore`로 막혀 있음). 새 DB에는 필요 없고, 첫 임원진 지정은 `HANDOVER.md` 8번의 문장을 씁니다 |

## 운영 DB에 적용한 개편 SQL(2026-11-22 적용 완료)
개편 작업으로 새로 만든 아래 파일(21~28번)은 2026-11-22에 운영 DB에 **적용을 마쳤습니다**. 선택 파일 `copy_*.sql` 2개는 **실행하지 않았습니다**(옛 데이터 복사용).
`add_meeting_notes.sql` → `add_content_permissions.sql` → `add_content_posts.sql` → `add_activity_records.sql` → (선택) `copy_activities_to_records.sql` → `add_projects.sql` → `add_notes.sql` → `add_portfolio_documents.sql` → (선택) `copy_portfolios_to_documents.sql` → `add_activity_feed.sql`

### 신규 통합 기능 SQL
29~33번(앨범 상호작용, 물류 인사이트, 자료실, 커리어 허브, 공지사항)은 2026-11-22에, 자료실 설정을 바꾸는 35~37번은 2026-11-24에 운영 DB에 적용을 마쳤습니다. **1~37번 전부 적용 상태**이며, 이미 적용한 파일은 다시 실행하지 않습니다.

### 적용 대기: 38번 토론 워크플로 (미적용, 검토 중)
`add_debate_workflow.sql`은 `feat/debate-workflow` 브랜치에만 있습니다. 새 테이블 7개와, 기존 `agendas`·`opinions`·`decisions`에 **제한 정책 8개**를 더합니다(토론 세션이 있는 안건에서 기존 방식의 쓰기를 막음). 결정 대기 사항 5가지는 `HANDOVER.md` 10-3에 있습니다. 그 브랜치도 이 `INDEX.md`를 고치므로, 병합할 때 내용이 충돌할 수 있습니다(위 "운영 DB 현재 상태"를 기준으로 맞춥니다).

## 함수를 덮어쓰는 파일(다시 실행하면 최신 내용이 옛 내용으로 바뀝니다)

| 함수 | 정의하는 파일(실행 순서) | 지금 쓰는 최신 버전 |
|---|---|---|
| `remove_member` (부원 탈퇴 처리) | `add_member_removal` → `add_withdrawal_request` → `add_member_events` → `add_unique_colors` → `add_member_alumni_remove` | **`add_member_alumni_remove.sql`** |
| `validate_signup` (가입 확인) | `schema` → `add_signup_application` → `remove_signup_code` | **`remove_signup_code.sql`** |
| `handle_new_user` (가입 시 프로필 만들기) | `schema` → `add_signup_application` | **`add_signup_application.sql`** |
| `update_my_color` (내 색상 바꾸기) | `add_member_events` → `add_unique_colors` | **`add_unique_colors.sql`** |

## 파일 이름의 규칙
- `add_*.sql`: 새 기능을 위한 추가용 SQL.
- `fix_*.sql`: 예전 DB의 문제를 고치던 수정용 SQL(새 DB에서는 쓰지 않음).
- `copy_*.sql`: 예전 데이터를 새 테이블로 복사하는 SQL(선택).
- `logon_*.sql`: LOG:ON에서 가져온 포트폴리오·앨범·사진 기능.
- 새 SQL 파일을 만들 때는 맨 위에 설명, 맨 아래에 `[R]` 되돌리기 주석을 넣고, 기존 패턴(`is_approved()`, `is_officer()`, `security definer` + `set search_path = ''`, RLS 켜기)을 따릅니다.
