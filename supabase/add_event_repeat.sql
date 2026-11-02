-- 추가용 SQL: 일정의 매주 반복 (add_events.sql 실행 후 이것을 실행)
-- 일정 하나에 "매주 반복"과 끝나는 날짜를 정하면, 시작 날짜의 요일마다 달력에 나온다.
--   · repeat_weekly : 매주 반복 여부 (기본 false = 기존 일정은 모두 반복 없음)
--   · repeat_until  : 반복이 끝나는 날짜 (반복일 때 필수, 시작일로부터 최대 2년)
--   · skip_dates    : 쉬는 주로 뺀 날짜 목록 ("이 날만 빼기")
-- 읽기·쓰기 권한은 기존 규칙 그대로다. (읽기: 승인된 사용자 / 쓰기: 임원진만)

alter table public.events
  add column repeat_weekly boolean not null default false,
  add column repeat_until  date,
  add column skip_dates    date[] not null default '{}';

alter table public.events
  add constraint events_repeat_check check (
    (repeat_weekly = false and repeat_until is null and cardinality(skip_dates) = 0)
    or
    (repeat_weekly = true
      and repeat_until is not null
      and repeat_until >= event_date
      and repeat_until <= event_date + 730
      and cardinality(skip_dates) <= 120)
  );

-- ============================================================
-- [R] 되돌리기 (문제가 있을 때만 실행. 반복 일정이 있다면 먼저 삭제하거나 반복을 끈 뒤)
-- ============================================================
-- alter table public.events drop constraint events_repeat_check;
-- alter table public.events drop column repeat_weekly, drop column repeat_until, drop column skip_dates;
