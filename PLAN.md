# 동아리 시간·토론 공유 시스템 구현 계획

## 0. 목표
동아리 부원(약 11명, 임원진 2명)이 한 곳에서 (1) 공통 모임 시간을 찾고, (2) 안건별 의견을 남기고, (3) 임원진이 확정한 결론을 한눈에 보는 내부 전용 웹앱.

## 1. 확정된 조건
- 인원: 부원 약 11명(대학생), 그중 임원진 2명
- 가입: 아이디(영문·숫자 4~20자) + 이름 + 비밀번호 + 가입 코드(+ 선택 전화번호, 본인·임원진만 열람) → 임원진 승인 후 사용 가능. 아이디는 내부적으로 가짜 이메일로 변환(Supabase Auth). 비밀번호 재설정은 임원진이 대시보드에서 처리
- 역할 2개: `member`(부원) / `officer`(임원진). 임원진 1명의 승인·확정만으로 처리
- 동아리 내부 전용: 비로그인·미승인 상태에서는 어떤 데이터도 보이면 안 됨
- 시간표: 월~금, 09:00~18:00, 30분 단위. 과목명은 본인만 보고, 타인에게는 "불가 시간"만 노출
- 디자인: 보라색 계열 카드 스타일(기존 "우리, 언제 모일까요?" 화면 참고), 한국어 UI, 모바일에서도 사용 가능

## 2. 기술 스택
- 프론트엔드: Vite + React + TypeScript + React Router
- 스타일: 일반 CSS(CSS 변수로 보라색 테마). 불필요한 UI 라이브러리는 추가하지 않는다.
- 백엔드: Supabase (Auth, Postgres, RLS). 권한은 반드시 RLS로 강제한다.
- 배포: Vercel 또는 Netlify (환경변수로 Supabase URL / anon key 설정)
- 비밀값은 `.env`에만 둔다. `.env`는 `.gitignore`에 포함하고, 키를 채팅에 붙여넣지 않는다.

## 3. 폴더 구조
```
my-project/
  PLAN.md
  .env.example
  supabase/
    schema.sql          # 테이블, 함수, 트리거, RLS 전부
    seed_officer.sql    # 첫 임원진 지정용 (직접 실행)
  src/
    lib/supabase.ts
    lib/time.ts         # 슬롯 변환, 공통 시간 계산
    auth/               # AuthProvider, 가입/로그인/대기 화면
    pages/
      Schedule.tsx      # 내 시간표 입력
      Common.tsx        # 공통 시간 찾기
      Agendas.tsx       # 안건 목록
      AgendaDetail.tsx  # 의견·결론
      Admin.tsx         # 승인·역할 관리 (임원진 전용)
    components/
    styles/
```

## 4. 데이터베이스 (supabase/schema.sql 에 작성)

### 테이블
- `app_settings(key text pk, value text)`: `signup_code` 저장. 클라이언트에서 직접 읽을 수 없게 RLS로 전부 차단.
- `profiles(id uuid pk → auth.users, name text, role text default 'member', status text default 'pending', created_at)`
  - role: `member` | `officer`, status: `pending` | `approved` | `rejected`
- `schedule_blocks(id, user_id, kind text, subject text, day smallint 0~4, start_min smallint, end_min smallint, semester text, created_at)`
  - kind: `class`(수업) | `manual`(수시 불가 시간). 분 단위 값은 09:00=540 ~ 18:00=1080, 30의 배수만 허용(check 제약).
  - 수업 하나를 요일 여러 개로 입력하면 요일별로 행을 나눠 저장한다.
- 뷰 `busy_blocks`: `schedule_blocks`에서 `user_id, day, start_min, end_min`만 노출하고, 승인된 사용자에게만 보이게 한다. (subject 숨기기용)
- `agendas(id, title, description, status text default 'discussing', created_by, created_at)` — status: `discussing` | `decided`
- `opinions(id, agenda_id, user_id, stance text, content text, created_at, updated_at)` — stance: `agree` | `disagree` | `hold`, `unique(agenda_id, user_id)`
- `decisions(agenda_id pk, content text, decided_by, decided_at)`

### 함수·트리거
- `is_approved()`, `is_officer()`: `security definer`, 현재 로그인 사용자의 profiles를 조회.
- 가입 트리거(auth.users insert): `raw_user_meta_data`의 `invite_code`가 `app_settings.signup_code`와 다르면 예외를 던져 가입을 막고, 맞으면 `profiles`에 name을 넣고 status=`pending`으로 생성.
- 임원진 보호 트리거(profiles update): 변경 후 `officer`이면서 `approved`인 사람이 0명이 되면 거부.

### RLS 규칙 (모든 테이블 RLS 켜기)
| 테이블 | 읽기 | 쓰기 |
|---|---|---|
| profiles | 본인 행, 승인된 사용자는 승인된 사람의 이름·역할 | 임원진만 update (status, role). 본인은 role/status 변경 불가 |
| schedule_blocks | 본인만 | 본인만 insert/update/delete |
| busy_blocks(뷰) | 승인된 사용자 | - |
| agendas | 승인된 사용자 | 임원진만 insert/update/delete |
| opinions | 승인된 사용자 | 본인 것만 insert/update/delete, 안건이 `discussing`일 때만 |
| decisions | 승인된 사용자 | 임원진만. 저장 시 agendas.status를 `decided`로 변경 |
| app_settings | 아무도 불가 | 아무도 불가 (SQL 편집기에서만 수정) |

주의: 권한은 화면 버튼 숨김이 아니라 위 RLS에서 막는다. 구현 후 RLS가 실제로 막는지 반드시 시험한다(5단계 검증 참고).

## 5. 단계별 구현

각 단계는 끝나면 동작을 확인하고, 다음 단계 전에 `/clear` 한다.

### 1단계: 프로젝트 세팅 + DB
- [ ] Vite React TS 프로젝트 생성, 라우터, 기본 레이아웃(보라색 테마 변수)
- [ ] `supabase/schema.sql` 작성 (4번 전부)
- [ ] `.env.example`, `src/lib/supabase.ts`
- 사용자가 직접 할 일: supabase.com에서 프로젝트 생성 → SQL 편집기에 schema.sql 실행 → `signup_code` 값 설정 → `.env`에 URL/anon key 입력
- 완료 기준: 앱이 실행되고 Supabase에 연결된다. 모든 테이블에 RLS가 켜져 있다.

### 2단계: 가입·로그인·승인
- [ ] 가입 화면: 이름, 이메일, 비밀번호, 가입 코드. 수집 항목과 용도를 한 줄 안내
- [ ] 로그인/로그아웃, 세션 유지
- [ ] 상태별 화면: 미로그인 → 로그인 / `pending` → 승인 대기 안내 / `rejected` → 거절 안내 / `approved` → 앱
- [ ] 임원진 관리 화면(Admin): 승인 대기 목록 승인·거절, 부원 역할 변경(임원진 0명 방지 오류 메시지 표시)
- [ ] `seed_officer.sql`: 첫 임원진 2명을 이메일로 지정하는 SQL (사용자가 직접 실행)
- 완료 기준: 새 계정이 가입하면 대기 상태, 임원진이 승인하면 접속 가능.

### 3단계: 개인 시간표 + 공통 시간 찾기
- [ ] 시간 도구(`lib/time.ts`): 분 ↔ "HH:MM" 변환, 슬롯 18개/일 생성
- [ ] 수업 입력: 과목명 + 요일 복수 선택 + 시작·종료 시간(30분 단위) → 요일별 행으로 저장. 수업 수정·삭제
- [ ] 수시 불가 시간 입력(주간 격자 클릭 또는 구간 선택)
- [ ] 학기 초기화 버튼: 본인의 `kind='class'` 행만 삭제(확인창 필수)
- [ ] 내 시간표 격자: 수업은 과목명이 보이고, 수시 불가는 별도 색
- [ ] 공통 시간 찾기: `busy_blocks`를 읽어 슬롯별 참석 가능 인원 계산 → 필요한 회의 시간(1/1.5/2/3시간)만큼 이어지는 구간을 추천 카드로 표시(전원 가능 우선, 그다음 가능 인원 순). 인원 히트맵 표시, "일정 문구 복사" 버튼
- 입력이 없는 부원은 "시간표 미입력"으로 표시하고 계산 안내문에 포함
- 완료 기준: 두 계정으로 시간표를 입력하면 공통 시간이 맞게 계산되고, 다른 계정에서 과목명이 보이지 않는다.

### 4단계: 안건·의견·결론 보드
- [ ] 안건 목록: 상태 필터(토론 중/확정), 의견 수, 찬반 현황 막대
- [ ] 안건 생성·수정(임원진만)
- [ ] 안건 상세: 부원별 입장(찬성/반대/보류) + 한 줄 의견, 본인 의견 수정·삭제
- [ ] 결론 확정(임원진만): 결론 내용 입력, 확정자와 일시 표시, 확정 후 의견 잠금
- [ ] 결론 요약 보드: 확정된 안건을 한 화면에서 모아 보기(검색/정렬)
- 의견 변경은 새로고침 없이 반영되도록 Supabase Realtime 구독(opinions, decisions)
- 완료 기준: 부원은 의견만 쓸 수 있고 결론 확정은 임원진만 가능하다.

### 5단계: 점검 및 배포
- [ ] RLS 시험: 일반 부원 계정으로 다음이 모두 거부되는지 확인
  - 안건 생성, 결론 확정, 다른 사람 의견 수정, 역할 변경, 타인 schedule_blocks 조회, `app_settings` 조회
- [ ] 미승인 계정이 어떤 테이블도 읽지 못하는지 확인
- [ ] 모바일 화면(폭 390px)에서 시간표 격자와 카드가 깨지지 않는지 확인
- [ ] 빈 상태, 오류, 로딩 문구 점검
- [ ] Vercel/Netlify 배포, 환경변수 설정, Supabase Auth의 Site URL·Redirect URL 설정
- [ ] 이메일 확인 설정 결정(11명 규모면 끄는 편이 편하지만, 켜면 가입 흐름에 확인 메일 단계 추가)

## 6. 범위 밖 (1차 버전에서 하지 않음)
- 시간표 이미지 자동 인식, 푸시/이메일 알림, 의견 수정 이력, 파일 첨부, 소셜 로그인

## 7. 작업 규칙 (Claude Code용)
- 이 파일만 읽고 시작한다. 요구사항을 다시 묻지 않는다.
- 한 번에 한 단계만 구현한다. 단계가 끝나면 변경 사항과 확인 방법을 짧게 보고한다.
- 새 라이브러리를 추가하기 전에 이유를 말한다.
- 비밀 키를 코드·로그·채팅에 노출하지 않는다.
- 사용자 입력은 항상 검증하고, 권한 검사는 RLS에 맡긴다.
- 불확실한 결정(이메일 확인 여부, 배포처 등)은 한 번에 모아서 묻는다.
