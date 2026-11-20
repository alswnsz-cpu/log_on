/**
 * 활동 공고 수집: 교내활동(모여봄의 경성대학교 공개 피드)과 대외활동(모여봄의 교외 항목 + 구글 뉴스 모집 보도).
 * 원본 LOG:ON 의 feed-server.mjs 로직을 TypeScript 로 옮겼다. 출처가 끊기면 호출한 쪽(serve.ts)이 마지막 저장본을 쓴다.
 * 모여봄 API 는 원본 운영자가 계속 써도 된다고 허락했다. 주소가 바뀌면 환경변수 MOYEOBOM_API_URL 로 바꾼다.
 */

export type Raw = Record<string, unknown>

export interface FeedItem {
  url: string
  title: string
  date: string | null
  deadline: string | null
  start: string | null
  category: string
  source: string
  /** 교내활동만: 교내 / 교내외 */
  scope?: string
  /** 대외활동만: 분류된 분야(저장할 때 이미 계산해 둔다) */
  topics?: string[]
}

export interface FeedSource {
  name: string
  url: string | null
  checkedAt: string | null
  state: string
}

/** 수집 결과(캐시에 저장하는 내용) */
export interface FeedData {
  items: FeedItem[]
  /** 일부 출처의 최신 자료를 못 가져왔으면 true */
  partial: boolean
  /** 교내활동만: 원본 게시판 목록 */
  sources?: FeedSource[]
}

/** 화면에 보내는 교내활동 공고: 즐겨찾기용 키와 분야가 붙는다 */
export type CampusItem = FeedItem & { key: string; topics: string[] }

const DEFAULT_MOYEOBOM_URL = 'https://moyeobom-campus.gayoungk1.chatgpt.site/api/activities?school=ks'
const DAY = 86400000

const SECTORS: Record<string, RegExp> = {
  물류: /물류|SCM|공급망/i,
  무역: /무역|수출입|통상/,
  유통: /유통|리테일/,
  해운: /해운|선박/,
  항만: /항만|항구/,
}

const RECRUITMENT = /공모전|아이디어 공모|서포터즈|대학생 기자단|해커톤|챌린지|교육생 모집|참가자 모집|인턴십/

const CAMPUS_TOPICS: Record<string, RegExp> = {
  물류: /물류|SCM|공급망|포워딩|물류관리/i,
  무역: /무역|수출입|통상|관세|FTA/i,
  유통: /유통|리테일|이커머스|전자상거래/,
  해운: /해운|선박|선사|해사/,
  항만: /항만|항구|항만공사/,
}

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function records(value: unknown): Raw[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function normalized(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFC').trim() : ''
}

/** https 주소만 허용하고, 아이디·비밀번호가 들어 있는 주소는 버린다 */
function officialLink(value: unknown): string | null {
  try {
    const url = new URL(typeof value === 'string' ? value : '')
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

function dateOnly(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function dateTime(value: unknown): string | null {
  const time = typeof value === 'string' ? Date.parse(value) : NaN
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

async function remoteFeed(url: string | URL, format: 'json' | 'text', timeout = 6500): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) })
  if (!response.ok) throw new Error('feed_unavailable')
  return format === 'json' ? response.json() : response.text()
}

/** 모여봄(경성대학교) 공개 피드 */
async function moyeobom(): Promise<{ items: Raw[]; sources: Raw[] }> {
  const configured = officialLink(process.env.MOYEOBOM_API_URL)
  const data = await remoteFeed(configured ?? DEFAULT_MOYEOBOM_URL, 'json')
  if (!isRecord(data) || !Array.isArray(data.items) || !Array.isArray(data.sources)) throw new Error('feed_invalid')
  return { items: records(data.items), sources: records(data.sources) }
}

function commonItem(item: Raw): FeedItem | null {
  const url = officialLink(item.url)
  const title = normalized(item.title).slice(0, 250)
  if (!url || !title) return null
  return {
    url,
    title,
    date: dateOnly(item.date),
    deadline: dateOnly(item.deadline_end),
    start: dateOnly(item.deadline_start),
    category: normalized(item.category).slice(0, 60),
    source: normalized(item.source).slice(0, 150),
  }
}

/** 교내활동: 모여봄 항목 중 교내·교내외 */
export async function campusFeed(): Promise<FeedData> {
  const data = await moyeobom()
  const sources = data.sources.filter((s) => s.scope !== '교외')
  const items: FeedItem[] = []
  for (const raw of data.items) {
    if (raw.scope !== '교내' && raw.scope !== '교내외') continue
    const entry = commonItem(raw)
    if (entry) items.push({ ...entry, scope: normalized(raw.scope) })
  }
  return {
    items,
    partial: sources.length === 0 || sources.some((s) => !['live', 'provided'].includes(normalized(s.state))),
    sources: sources.map((s) => ({
      name: normalized(s.name),
      url: officialLink(s.url),
      checkedAt: dateTime(s.checked_at),
      state: normalized(s.state),
    })),
  }
}

/** 경성대학교 교내소식 글 번호(board_seq). 다른 주소면 null */
function campusNoticeKey(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.hostname !== 'kscms.ks.ac.kr' || url.pathname !== '/kor/CMS/Board/Board.do') return null
    const id = url.searchParams.get('board_seq') ?? ''
    return /^\d+$/.test(id) ? id : null
  } catch {
    return null
  }
}

/** 화면에 보낼 때 즐겨찾기용 키와 분야(제목으로 분류)를 붙인다 */
export function campusItemDetails(item: FeedItem): CampusItem {
  return {
    ...item,
    key: campusNoticeKey(item.url) ?? item.url,
    topics: Object.entries(CAMPUS_TOPICS)
      .filter(([, pattern]) => pattern.test(item.title))
      .map(([name]) => name),
  }
}

function rssText(xml: string, tag: string): string {
  const value = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(xml)?.[1] ?? ''
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }
  return value
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, key: string) => entities[key])
    .trim()
}

/** 구글 뉴스 RSS: 물류·무역·유통·해운·항만 + 공모전·서포터즈·대학생·해커톤 모집 보도(최근 60일) */
async function industryNews(): Promise<FeedItem[]> {
  const url = new URL('https://news.google.com/rss/search')
  url.search = new URLSearchParams({
    q: '(물류 OR 무역 OR 유통 OR 해운 OR 항만) (공모전 OR 서포터즈 OR 대학생 OR 해커톤) when:60d',
    hl: 'ko',
    gl: 'KR',
    ceid: 'KR:ko',
  }).toString()
  const xml = await remoteFeed(url, 'text')
  if (typeof xml !== 'string' || !/<rss[\s>]/i.test(xml)) throw new Error('feed_invalid')
  const out: FeedItem[] = []
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const item = match[1]
    const source = rssText(item, 'source')
    const title = rssText(item, 'title')
    const suffix = ` - ${source}`
    const published = dateTime(rssText(item, 'pubDate'))
    if (!published || Date.now() - Date.parse(published) > 60 * DAY) continue
    const entry = commonItem({
      url: rssText(item, 'link'),
      title: source && title.endsWith(suffix) ? title.slice(0, -suffix.length) : title,
      date: published.slice(0, 10),
      category: '모집 관련 보도',
      source,
    })
    if (entry) out.push(entry)
  }
  return out
}

/** 대외활동: 모여봄의 교외 항목 + 구글 뉴스 모집 보도. 분야와 모집 키워드에 맞는 것만, 중복 없이, 최신순 60건 */
export async function externalFeed(): Promise<FeedData> {
  const results = await Promise.allSettled([
    moyeobom().then((data) =>
      data.items
        .filter((item) => item.scope === '교외')
        .map(commonItem)
        .filter((entry): entry is FeedItem => entry !== null),
    ),
    industryNews(),
  ])
  if (results.every((r) => r.status === 'rejected')) throw new Error('feed_unavailable')

  const seen = new Set<string>()
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
  const items: FeedItem[] = []
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const item of result.value) {
      const topics = Object.entries(SECTORS)
        .filter(([, pattern]) => pattern.test(item.title))
        .map(([name]) => name)
      if (topics.length === 0 || !RECRUITMENT.test(item.title)) continue
      if (item.deadline && item.deadline < today) continue
      if (/성료|시상식|수상작|최종 결과|모집 마감/.test(item.title)) continue
      const key = item.title.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      items.push({ ...item, topics })
    }
  }
  items.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  return { items: items.slice(0, 60), partial: results.some((r) => r.status === 'rejected') }
}
