/** 달력 일정(events)과 월 달력 계산 도우미. 날짜는 시간대 문제를 피하려고 항상 'YYYY-MM-DD' 문자열로 다룬다. */

export interface CalendarEvent {
  id: number
  title: string
  event_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  memo: string | null
  repeat_weekly: boolean
  repeat_until: string | null
  skip_dates: string[]
}

/** 달력에 찍히는 하루치 일정. 반복 일정은 날짜마다 하나씩 펼쳐진다. */
export type Occurrence = CalendarEvent & { occ_date: string }

export const EVENT_COLUMNS =
  'id, title, event_date, start_time, end_time, location, memo, repeat_weekly, repeat_until, skip_dates'

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 반복은 시작일로부터 최대 2년까지 (DB 제약과 같은 값) */
export const MAX_REPEAT_DAYS = 730

const DAY = 86400000
const pad = (n: number) => String(n).padStart(2, '0')

export function ymd(year: number, month0: number, day: number): string {
  return `${year}-${pad(month0 + 1)}-${pad(day)}`
}

export function todayStr(): string {
  const d = new Date()
  return ymd(d.getFullYear(), d.getMonth(), d.getDate())
}

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtc(ms: number): string {
  const d = new Date(ms)
  return ymd(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** 'YYYY-MM-DD' 에 days일을 더한 날짜 */
export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY)
}

export interface CalendarCell {
  date: string
  day: number
  inMonth: boolean
}

/** 일요일 시작 월 달력. 앞뒤 달의 날짜로 빈 칸을 채워 항상 7의 배수 칸을 돌려준다. */
export function monthGrid(year: number, month0: number): CalendarCell[] {
  const first = new Date(year, month0, 1)
  const start = new Date(year, month0, 1 - first.getDay())
  const daysInMonth = new Date(year, month0 + 1, 0).getDate()
  const total = Math.ceil((first.getDay() + daysInMonth) / 7) * 7
  const cells: CalendarCell[] = []
  for (let i = 0; i < total; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push({
      date: ymd(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      inMonth: d.getMonth() === month0,
    })
  }
  return cells
}

/** 'HH:MM:SS' 또는 'HH:MM' → 'HH:MM' */
export function hhmm(time: string | null): string {
  return time ? time.slice(0, 5) : ''
}

/** 일정 시간 표시. 예: "19:00~21:00", "19:00~", 시간이 없으면 "시간 미정" */
export function timeRange(e: Pick<CalendarEvent, 'start_time' | 'end_time'>): string {
  if (!e.start_time) return '시간 미정'
  return e.end_time ? `${hhmm(e.start_time)}~${hhmm(e.end_time)}` : `${hhmm(e.start_time)}~`
}

/** 'YYYY-MM-DD' → "11월 3일 (월)" */
export function formatDateKo(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${m}월 ${d}일 (${wd})`
}

/** 'YYYY-MM-DD' → 요일 글자 ("월") */
export function weekdayKo(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return WEEKDAYS[new Date(y, m - 1, d).getDay()]
}

/**
 * 일정들을 [rangeStart, rangeEnd] 날짜별 일정으로 펼친다.
 * 반복 일정은 시작일의 요일마다 한 개씩(끝나는 날짜까지, 뺀 날짜 제외) 만든다.
 */
export function expandEvents(events: CalendarEvent[], rangeStart: string, rangeEnd: string): Occurrence[] {
  const rs = toUtc(rangeStart)
  const re = toUtc(rangeEnd)
  const out: Occurrence[] = []
  for (const e of events) {
    const t0 = toUtc(e.event_date)
    if (!e.repeat_weekly || !e.repeat_until) {
      if (t0 >= rs && t0 <= re) out.push({ ...e, occ_date: e.event_date })
      continue
    }
    const last = Math.min(toUtc(e.repeat_until), re)
    let t = t0 < rs ? t0 + Math.ceil((rs - t0) / (7 * DAY)) * 7 * DAY : t0
    for (; t <= last; t += 7 * DAY) {
      const date = fromUtc(t)
      if (!e.skip_dates.includes(date)) out.push({ ...e, occ_date: date })
    }
  }
  return out
}

/** 날짜순 → 시작 시간순(시간 없는 일정은 그날 맨 위) */
export function sortOccurrences(list: Occurrence[]): Occurrence[] {
  return [...list].sort(
    (a, b) => a.occ_date.localeCompare(b.occ_date) || (a.start_time ?? '').localeCompare(b.start_time ?? ''),
  )
}
