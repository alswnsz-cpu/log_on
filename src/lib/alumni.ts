import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * 졸업생 id 집합. member_alumni 에 행이 있으면 졸업생, 없으면 현재 부원이다.
 * 라벨을 붙이는 용도라서 못 불러와도 화면을 막지 않고 라벨만 빠진다.
 */
export function useAlumniIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let alive = true
    supabase
      .from('member_alumni')
      .select('user_id')
      .then(({ data, error }) => {
        if (!alive || error) return
        setIds(new Set((data as { user_id: string }[]).map((r) => r.user_id)))
      })
    return () => {
      alive = false
    }
  }, [])

  return ids
}
