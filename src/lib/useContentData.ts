import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { POST_COLUMNS, type ContentPost } from './contentPlanner'

export interface Person {
  id: string
  name: string
}

/**
 * 콘텐츠 플래너 화면이 쓰는 데이터: 게시물(게시 예정일시 순), 이름표, 담당자로 지정할 수 있는 사람.
 * enabled 가 false 면(졸업생 등) 아무것도 불러오지 않는다.
 */
export function useContentData(enabled: boolean) {
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [assignable, setAssignable] = useState<Person[]>([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [p, m, a] = await Promise.all([
      supabase.from('content_posts').select(POST_COLUMNS).order('scheduled_at', { ascending: true }),
      supabase.from('profiles').select('id, name').eq('status', 'approved').order('name'),
      supabase.from('member_alumni').select('user_id'),
    ])
    if (p.error || m.error || a.error) {
      setError('콘텐츠를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } else {
      setError(null)
      const people = m.data as Person[]
      const alumniIds = new Set((a.data as { user_id: string }[]).map((r) => r.user_id))
      setPosts(p.data as ContentPost[])
      setNames(new Map(people.map((x) => [x.id, x.name])))
      // 졸업생은 담당자로 지정할 수 없다
      setAssignable(people.filter((x) => !alumniIds.has(x.id)))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!enabled) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [enabled, load])

  return { posts, names, assignable, loading, error, reload: load }
}
