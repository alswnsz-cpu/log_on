import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchFeed, type FeedKind, type FeedResponse } from './activityFeed'

/** 공고를 3분마다 다시 확인하는 주기. 서버도 3분 안의 저장본은 그대로 돌려준다. */
const REFRESH_MS = 3 * 60 * 1000

/**
 * 활동 공고 불러오기. 화면이 열려 있는 동안 3분마다 다시 확인하고(탭이 숨겨져 있으면 건너뛴다),
 * 다시 확인에 실패해도 마지막으로 불러온 공고(data)는 그대로 남긴다.
 */
export function useFeed(kind: FeedKind) {
  const [data, setData] = useState<FeedResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const controller = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setLoading(true)
    try {
      const result = await fetchFeed(kind, current.signal)
      if (current.signal.aborted) return
      setData(result)
      setError(null)
    } catch (err) {
      if (current.signal.aborted) return
      setError(err instanceof Error ? err.message : '공고를 불러오지 못했습니다.')
    } finally {
      if (!current.signal.aborted) setLoading(false)
    }
  }, [kind])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
    const timer = setInterval(() => {
      if (!document.hidden) refresh()
    }, REFRESH_MS)
    return () => {
      clearInterval(timer)
      controller.current?.abort()
    }
  }, [refresh])

  return { data, error, loading, refresh }
}
