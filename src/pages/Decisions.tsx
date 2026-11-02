import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { authorName, formatDateTime, useRealtimeRefresh } from '../lib/agendas'

interface Row {
  agenda_id: number
  content: string
  decided_at: string
  agendas: { title: string; status: string } | null
  profiles: { name: string; status: string } | null
}

export default function Decisions() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'new' | 'old'>('new')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('decisions')
      .select('agenda_id, content, decided_at, agendas!inner(title, status), profiles(name, status)')
      .eq('agendas.status', 'decided') // 다시 논의 중인 안건의 이전 결론은 보드에서 제외
    if (error) setLoadError('결론을 불러오지 못했습니다.')
    else {
      setLoadError(null)
      setRows(data as unknown as Row[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])
  useRealtimeRefresh('decisions-board', load)

  // 공백으로 나눈 검색어가 안건 제목·결론 내용에 모두 들어 있어야 한다
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const dir = sort === 'new' ? -1 : 1
  const shown = rows
    .filter((r) => {
      const text = `${r.agendas?.title ?? ''} ${r.content}`.toLowerCase()
      return terms.every((t) => text.includes(t))
    })
    // 문자열 비교는 소수점 초 유무에 따라 순서가 틀어지므로 시각으로 비교한다
    .sort((a, b) => dir * (Date.parse(a.decided_at) - Date.parse(b.decided_at)))

  return (
    <>
      <section className="card">
        <h2>결론 요약</h2>
        <div className="form" style={{ marginTop: 8 }}>
          <input placeholder="토론·결론 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value as 'new' | 'old')}>
            <option value="new">최근 확정순</option>
            <option value="old">오래된 확정순</option>
          </select>
        </div>
      </section>

      {loadError && <p className="msg error" role="alert">{loadError}</p>}
      {loading ? (
        <section className="card"><p>불러오는 중...</p></section>
      ) : shown.length === 0 ? (
        <section className="card">
          <p>{rows.length === 0 ? '아직 확정된 토론이 없습니다.' : '검색 결과가 없습니다.'}</p>
        </section>
      ) : (
        <div className="card-grid">
          {shown.map((r) => (
            <Link key={r.agenda_id} to={`/agendas/${r.agenda_id}`} className="card agenda-card">
              <h2>{r.agendas?.title ?? '(삭제된 토론)'}</h2>
              <p className="decision-text">{r.content}</p>
              <p className="hint">
                {authorName(r.profiles)} · {formatDateTime(r.decided_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
