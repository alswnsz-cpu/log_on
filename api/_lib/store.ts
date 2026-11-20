import { createClient } from '@supabase/supabase-js'
import type { FeedData } from './feeds.js'

/** 수집 결과의 마지막 저장본 */
export interface Snapshot {
  /** 수집한 시각(밀리초) */
  checkedAt: number
  data: FeedData
}

export type Route = 'campus' | 'external'

/**
 * 캐시 테이블(activity_snapshots)에 접근하는 서버 전용 클라이언트.
 * 서비스 롤 키는 환경변수 SUPABASE_SERVICE_ROLE_KEY 로만 받는다(코드·화면·VITE_ 환경변수에 두지 않는다).
 * 키가 없으면 null 을 돌려주고, 이때는 저장본 없이 매번 직접 수집한다.
 */
function serviceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function readSnapshot(route: Route): Promise<Snapshot | null> {
  try {
    const client = serviceClient()
    if (!client) return null
    const { data, error } = await client
      .from('activity_snapshots')
      .select('checked_at, content')
      .eq('route', route)
      .maybeSingle()
    if (error || !data) return null
    const content = data.content as FeedData | null
    const checkedAt = Date.parse(data.checked_at as string)
    if (!content || !Array.isArray(content.items) || !Number.isFinite(checkedAt)) return null
    return { checkedAt, data: content }
  } catch {
    // 저장소에 일시적인 문제가 있어도 새로 수집하는 데는 지장이 없다
    return null
  }
}

/** 저장본을 갱신한다. 실패해도 이번 요청의 응답에는 영향이 없다. */
export async function writeSnapshot(route: Route, checkedAt: number, data: FeedData): Promise<void> {
  try {
    const client = serviceClient()
    if (!client) return
    const { error } = await client
      .from('activity_snapshots')
      .upsert({ route, checked_at: new Date(checkedAt).toISOString(), content: data }, { onConflict: 'route' })
    if (error) console.error('활동 공고 저장본을 갱신하지 못했습니다.', route, error.code)
  } catch {
    console.error('활동 공고 저장본을 갱신하지 못했습니다.', route)
  }
}
