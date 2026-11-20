import { supabase } from './supabase'

/** 활동 찾기의 자동 수집 공고(교내활동·대외활동). 서버 함수(/api/activities/…)가 모아 준 결과를 받는다. */

export type FeedKind = 'campus' | 'external'

export interface FeedItem {
  url: string
  title: string
  date: string | null
  deadline: string | null
  start: string | null
  category: string
  source: string
  /** 교내활동: 교내 / 교내외 */
  scope?: string
  /** 분야(물류·무역·유통·해운·항만) */
  topics?: string[]
  /** 교내활동: 즐겨찾기용 키(학교 게시판 글 번호, 없으면 공고 주소) */
  key?: string
}

export interface FeedSource {
  name: string
  url: string | null
  checkedAt: string | null
  state: string
}

export interface FeedResponse {
  items: FeedItem[]
  /** 일부 출처의 최신 자료를 확인하지 못했다 */
  partial: boolean
  sources?: FeedSource[]
  /** 이 자료를 수집한 시각 */
  checkedAt: string
  /** 새로 수집하지 못해 마지막 저장본(이전 수집 자료)을 보여 주는 중 */
  stale: boolean
}

export class FeedError extends Error {}

export const KSU_NOTICE_URL = 'https://kscms.ks.ac.kr/kor/CMS/Board/Board.do?mCode=MN091'

/** 분야 목록(공고 제목으로 분류한다) */
export const TOPICS = ['물류', '무역', '유통', '해운', '항만']

const feedDateFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })

/** "2026. 11. 21. 오전 4:19" 같은 한국 시간 표시 */
export function formatFeedTime(iso: string): string {
  return feedDateFormat.format(new Date(iso))
}

/** https 주소만 링크로 연다(그 밖의 값은 null) */
export function safeHref(url: string): string | null {
  return /^https:\/\//i.test(url) ? url : null
}

/** 오늘(한국 시간)에서 days-1일 전까지의 시작 날짜. 예: days=1 이면 오늘 */
export function sinceKst(days: number): { from: string; to: string } {
  const to = new Date(Date.now() + 9 * 3600000)
  const from = new Date(to.getTime() - (days - 1) * 86400000)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

/** 서버 함수에서 공고를 받는다. 로그인한 사용자의 토큰을 함께 보낸다. */
export async function fetchFeed(kind: FeedKind, signal?: AbortSignal): Promise<FeedResponse> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new FeedError('로그인이 필요합니다.')

  let response: Response
  try {
    response = await fetch(`/api/activities/${kind}`, { headers: { Authorization: `Bearer ${token}` }, signal })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new FeedError('공고를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.')
  }

  const body = (await response.json().catch(() => null)) as (Partial<FeedResponse> & { error?: string }) | null
  if (!response.ok || !body || !Array.isArray(body.items)) {
    throw new FeedError(body?.error ?? '공고를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
  }
  return body as FeedResponse
}
