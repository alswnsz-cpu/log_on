import { addDays } from './calendar'

/** 콘텐츠 플래너(인스타그램 게시 일정)의 종류·상태와, 한국 시간 계산, 과밀·간격 점검 규칙. */

export type PostType = 'card_news' | 'reels' | 'live'
export type PostStatus = 'planning' | 'producing' | 'reviewing' | 'scheduled' | 'published'

export const POST_TYPES: { value: PostType; label: string }[] = [
  { value: 'card_news', label: '카드뉴스' },
  { value: 'reels', label: '릴스' },
  { value: 'live', label: '실시간 콘텐츠' },
]

/** 게시 상태(진행 순서대로) */
export const POST_STATUSES: { value: PostStatus; label: string }[] = [
  { value: 'planning', label: '기획 중' },
  { value: 'producing', label: '제작 중' },
  { value: 'reviewing', label: '검토 중' },
  { value: 'scheduled', label: '게시 예정' },
  { value: 'published', label: '게시 완료' },
]

export const TYPE_LABEL: Record<PostType, string> = {
  card_news: '카드뉴스',
  reels: '릴스',
  live: '실시간 콘텐츠',
}

export const STATUS_LABEL: Record<PostStatus, string> = {
  planning: '기획 중',
  producing: '제작 중',
  reviewing: '검토 중',
  scheduled: '게시 예정',
  published: '게시 완료',
}

/** 유형별 표시 색(흰 글자가 읽히는 진한 색) */
export const TYPE_COLOR: Record<PostType, string> = {
  card_news: '#2454db', // 브랜드 파랑(theme.css 의 --brand-600 과 같은 값)
  reels: '#db2777',
  live: '#0f766e',
}

export interface ContentPost {
  id: number
  title: string
  post_type: PostType
  scheduled_at: string
  assignee_id: string | null
  status: PostStatus
  review_done: boolean
  caption: string | null
  material_url: string | null
}

export const POST_COLUMNS = 'id, title, post_type, scheduled_at, assignee_id, status, review_done, caption, material_url'

/** 미완료: 게시 상태가 "게시 완료"가 아닌 것 */
export const isOpen = (p: Pick<ContentPost, 'status'>) => p.status !== 'published'

/** 자료 링크는 http(s) 주소만 연다(DB 제약과 같은 규칙) */
export const isSafeUrl = (url: string | null): url is string => url !== null && /^https?:\/\//i.test(url)

// ---- 한국 시간(UTC+9) ----
// 게시 예정일시는 DB에 UTC 시각으로 저장하고, 화면에서는 항상 한국 시간으로 보여 주고 입력받는다.

const KST_OFFSET = 9 * 3600000
const pad = (n: number) => String(n).padStart(2, '0')

/** 한국 시간 기준의 날짜·시각 부품이 들어 있는 Date(getUTC* 로 읽는다) */
const kst = (iso: string) => new Date(Date.parse(iso) + KST_OFFSET)

/** 'YYYY-MM-DD' (한국 시간) */
export function kstDateStr(iso: string): string {
  const d = kst(iso)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** 'HH:mm' (한국 시간) */
export function kstTimeStr(iso: string): string {
  const d = kst(iso)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** 요일 번호(일 0 ~ 토 6, 한국 시간) */
export function kstWeekday(iso: string): number {
  return kst(iso).getUTCDay()
}

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

/** "11.20 (금) 18:00" (한국 시간) */
export function formatKst(iso: string): string {
  const d = kst(iso)
  return `${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} (${WEEKDAY_KO[d.getUTCDay()]}) ${kstTimeStr(iso)}`
}

/** datetime-local 입력칸에 넣을 값 'YYYY-MM-DDTHH:mm' (한국 시간) */
export function toKstLocal(iso: string): string {
  return `${kstDateStr(iso)}T${kstTimeStr(iso)}`
}

/** datetime-local 입력값(한국 시간)을 DB에 보낼 UTC 시각으로 바꾼다. 형식이 틀리면 null */
export function fromKstLocal(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null
  const ms = Date.parse(`${local}:00+09:00`)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/** 오늘 날짜(한국 시간) */
export function todayKst(): string {
  return kstDateStr(new Date().toISOString())
}

/** 그 날짜가 속한 주의 월요일 'YYYY-MM-DD' (한 주는 월~일) */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return addDays(date, -((day + 6) % 7))
}

/** 월요일부터 7일 */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

// ---- 과밀·간격 점검 ----

/** 한 주에 이 건수 이상이면 과밀 */
export const CROWDED_WEEK_TOTAL = 5
/** 한 주의 주말(토·일)에 이 건수 이상이면 과밀 */
export const CROWDED_WEEKEND = 2
/** 연속 게시물 간격이 이 시간보다 짧으면 간격 조정 */
export const MIN_GAP_HOURS = 24

export interface WeekSummary {
  total: number
  weekend: number
  byType: Record<PostType, number>
  /** 과밀 이유(없으면 빈 목록) */
  crowded: string[]
}

/** 월요일 monday 로 시작하는 한 주(한국 시간)의 게시물 수와 과밀 여부 */
export function summarizeWeek(posts: ContentPost[], monday: string): WeekSummary {
  const sunday = addDays(monday, 6)
  const byType: Record<PostType, number> = { card_news: 0, reels: 0, live: 0 }
  let total = 0
  let weekend = 0
  for (const p of posts) {
    const date = kstDateStr(p.scheduled_at)
    if (date < monday || date > sunday) continue
    total += 1
    byType[p.post_type] += 1
    const wd = kstWeekday(p.scheduled_at)
    if (wd === 0 || wd === 6) weekend += 1
  }
  const crowded: string[] = []
  if (weekend >= CROWDED_WEEKEND) crowded.push(`주말 게시물이 ${CROWDED_WEEKEND}건 이상이에요`)
  if (total >= CROWDED_WEEK_TOTAL) crowded.push(`한 주에 ${CROWDED_WEEK_TOTAL}건 이상이에요`)
  return { total, weekend, byType, crowded }
}

const hoursLabel = (h: number) => `${Math.round(h * 10) / 10}시간`

/**
 * 연속한 게시물의 간격이 24시간보다 짧은 쌍을 찾아 게시물 id 별 안내 문구로 돌려준다.
 * 둘 다 이미 "게시 완료"인 쌍은 지난 일이라 안내하지 않는다.
 */
export function tightGaps(posts: ContentPost[]): Map<number, string[]> {
  const sorted = [...posts].sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at))
  const notes = new Map<number, string[]>()
  const add = (id: number, text: string) => notes.set(id, [...(notes.get(id) ?? []), text])
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    if (!isOpen(prev) && !isOpen(cur)) continue
    const hours = (Date.parse(cur.scheduled_at) - Date.parse(prev.scheduled_at)) / 3600000
    if (hours >= MIN_GAP_HOURS) continue
    add(cur.id, `앞 게시물과 ${hoursLabel(hours)} 간격`)
    add(prev.id, `다음 게시물과 ${hoursLabel(hours)} 간격`)
  }
  return notes
}
