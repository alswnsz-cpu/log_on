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
  /** 동아리 공식 일정(임원진만 작성) 여부. 아니면 부원의 개인 일정 */
  is_club: boolean
  created_by: string
  profiles: { name: string; color: string | null; status: string } | null
}

/** 반복 일정의 특정 날짜에만 적용되는 내용. 한 행이 그 날짜의 제목·시간·장소·메모 전체다. */
export interface EventOverride {
  event_id: number
  occ_date: string
  title: string
  start_time: string | null
  end_time: string | null
  location: string | null
  memo: string | null
}

export const OVERRIDE_COLUMNS = 'event_id, occ_date, title, start_time, end_time, location, memo'

/**
 * 달력에 찍히는 하루치 일정. 반복 일정은 날짜마다 하나씩 펼쳐진다.
 * 그 날짜만 따로 수정했다면 overridden 이 true 이고 제목·시간·장소·메모는 수정한 내용이다.
 * base 는 원래(전체에 적용되는) 일정이다.
 */
export type Occurrence = CalendarEvent & { occ_date: string; overridden: boolean; base: CalendarEvent }

export const EVENT_COLUMNS =
  'id, title, event_date, start_time, end_time, location, memo, repeat_weekly, repeat_until, skip_dates, ' +
  'is_club, created_by, profiles(name, color, status)'

/** 부원이 고를 수 있는 색 12가지. DB의 profiles_color_check 와 같은 값이어야 한다. (흰 글자가 읽히는 진한 색) */
export const MEMBER_COLORS = [
  { hex: '#dc2626', name: '빨강' },
  { hex: '#c2410c', name: '주황' },
  { hex: '#a16207', name: '황토' },
  { hex: '#4d7c0f', name: '연두' },
  { hex: '#15803d', name: '초록' },
  { hex: '#0f766e', name: '청록' },
  { hex: '#0e7490', name: '하늘' },
  { hex: '#2563eb', name: '파랑' },
  { hex: '#1e3a8a', name: '남색' },
  { hex: '#db2777', name: '분홍' },
  { hex: '#831843', name: '자주' },
  { hex: '#78716c', name: '회색' },
] as const

/** 동아리 공식 일정의 색 (앱의 보라색 테마) */
export const CLUB_COLOR = '#8b5cf6'

/** 색을 아직 안 고른 부원에게 보여 줄 자동 색. 같은 사람은 항상 같은 색이 나온다. */
export function autoColor(userId: string): string {
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return MEMBER_COLORS[h % MEMBER_COLORS.length].hex
}

/** 일정에 쓸 색: 공식 일정은 보라색, 개인 일정은 작성자가 고른 색(없으면 자동 색) */
export function eventColor(e: Pick<CalendarEvent, 'is_club' | 'created_by' | 'profiles'>): string {
  if (e.is_club) return CLUB_COLOR
  return e.profiles?.color ?? autoColor(e.created_by)
}

/** 작성자 이름. 탈퇴했거나 읽을 수 없으면 "탈퇴한 부원" */
export function ownerName(e: Pick<CalendarEvent, 'profiles'>): string {
  return e.profiles && e.profiles.status !== 'removed' ? e.profiles.name : '탈퇴한 부원'
}

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
export function expandEvents(
  events: CalendarEvent[],
  rangeStart: string,
  rangeEnd: string,
  overrides: EventOverride[] = [],
): Occurrence[] {
  const rs = toUtc(rangeStart)
  const re = toUtc(rangeEnd)
  const byKey = new Map(overrides.map((o) => [`${o.event_id}|${o.occ_date}`, o]))
  const out: Occurrence[] = []
  for (const e of events) {
    const t0 = toUtc(e.event_date)
    if (!e.repeat_weekly || !e.repeat_until) {
      if (t0 >= rs && t0 <= re) out.push({ ...e, occ_date: e.event_date, overridden: false, base: e })
      continue
    }
    const last = Math.min(toUtc(e.repeat_until), re)
    let t = t0 < rs ? t0 + Math.ceil((rs - t0) / (7 * DAY)) * 7 * DAY : t0
    for (; t <= last; t += 7 * DAY) {
      const date = fromUtc(t)
      if (e.skip_dates.includes(date)) continue
      const ov = byKey.get(`${e.id}|${date}`)
      if (ov) {
        // 그 날짜만 따로 수정한 내용으로 바꿔서 보여 준다
        out.push({
          ...e,
          title: ov.title,
          start_time: ov.start_time,
          end_time: ov.end_time,
          location: ov.location,
          memo: ov.memo,
          occ_date: date,
          overridden: true,
          base: e,
        })
      } else {
        out.push({ ...e, occ_date: date, overridden: false, base: e })
      }
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
