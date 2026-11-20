import { requireApprovedUser } from './auth.js'
import { campusFeed, campusItemDetails, externalFeed, type FeedData } from './feeds.js'
import { sendError, sendJson, type Req, type Res } from './http.js'
import { readSnapshot, writeSnapshot, type Route, type Snapshot } from './store.js'

/** 이 시간(3분)보다 새로운 저장본은 다시 수집하지 않고 그대로 보여 준다 */
const FRESH_MS = 3 * 60 * 1000

/** 같은 서버 인스턴스가 살아 있는 동안 쓰는 메모리 저장본(저장소 읽기를 줄인다) */
const memory = new Map<Route, Snapshot>()

const UNAVAILABLE: Record<Route, string> = {
  campus: '학교 공지를 다시 확인하지 못했습니다. 경성대학교 교내소식에서 원문을 확인해 주세요.',
  external: '대외활동을 불러오지 못했습니다. 사이트 정리의 대외활동 사이트에서 직접 확인해 주세요.',
}

function present(res: Res, route: Route, snapshot: Snapshot, stale: boolean): void {
  const data: FeedData = snapshot.data
  sendJson(res, 200, {
    ...data,
    items: route === 'campus' ? data.items.map(campusItemDetails) : data.items,
    checkedAt: new Date(snapshot.checkedAt).toISOString(),
    stale,
  })
}

/**
 * GET /api/activities/campus, /api/activities/external 의 공통 처리.
 * 승인된 사용자만 호출할 수 있고, 3분 안의 저장본은 그대로 돌려주고, 새로 수집하지 못하면 마지막 저장본을
 * stale(이전 수집 자료)로 표시해 돌려준다. 저장본도 없을 때만 오류(503)를 돌려준다.
 */
export async function serveFeed(req: Req, res: Res, route: Route): Promise<void> {
  if (req.method !== 'GET') return sendError(res, 405, '허용되지 않는 요청입니다.')

  const auth = await requireApprovedUser(req)
  if (!auth.ok) return sendError(res, auth.status, auth.message)

  const now = Date.now()
  const snapshot = memory.get(route) ?? (await readSnapshot(route))
  if (snapshot) memory.set(route, snapshot)
  if (snapshot && now - snapshot.checkedAt < FRESH_MS) return present(res, route, snapshot, false)

  try {
    const data = route === 'campus' ? await campusFeed() : await externalFeed()
    // 대외활동은 일부 출처만 실패했는데 결과가 비었으면 실패로 보고 이전 저장본을 쓴다
    if (route === 'external' && data.partial && data.items.length === 0) throw new Error('feed_empty')
    const latest: Snapshot = { checkedAt: Date.now(), data }
    memory.set(route, latest)
    await writeSnapshot(route, latest.checkedAt, data)
    return present(res, route, latest, false)
  } catch {
    // 새로 수집하지 못했다: 마지막 저장본이 있으면 "이전 수집 자료"로 보여 준다(오래돼도 수집 시각을 함께 보낸다)
    if (snapshot) return present(res, route, snapshot, true)
    return sendError(res, 503, UNAVAILABLE[route])
  }
}
