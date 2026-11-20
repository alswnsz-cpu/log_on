import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import NoteItem, { NOTE_COLUMNS, type NoteRow } from '../components/NoteItem'

interface AgendaRef {
  id: number
  title: string
}

/** 활동 기록 > 개별 노트: 나만 보는 메모 모음. 토론에 연결한 메모와 연결하지 않은 메모를 함께 본다. */
export default function Notes() {
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [agendas, setAgendas] = useState<AgendaRef[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** '' 전체, 'none' 토론과 연결 안 됨, 그 밖에는 토론 id */
  const [filter, setFilter] = useState('')

  const [text, setText] = useState('')
  const [agendaId, setAgendaId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [n, a] = await Promise.all([
      supabase.from('notes').select(NOTE_COLUMNS).order('created_at', { ascending: false }),
      supabase.from('agendas').select('id, title').order('created_at', { ascending: false }),
    ])
    if (n.error || a.error) {
      setLoadError('노트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } else {
      setLoadError(null)
      setNotes(n.data as NoteRow[])
      setAgendas(a.data as AgendaRef[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (body.length < 1 || body.length > 5000) return setError('노트는 1~5000자로 입력해 주세요.')
    setError(null)
    setSaving(true)
    const { data, error: err } = await supabase
      .from('notes')
      .insert({ body, agenda_id: agendaId ? Number(agendaId) : null })
      .select('id')
    setSaving(false)
    if (err || (data?.length ?? 0) === 0) return setError('노트를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    setText('')
    await load()
  }

  const titleOf = (id: number | null) => (id === null ? null : (agendas.find((a) => a.id === id)?.title ?? '삭제된 토론'))
  const shown = notes.filter((n) => (filter === '' ? true : filter === 'none' ? n.agenda_id === null : n.agenda_id === Number(filter)))
  // 노트가 달린 토론만 필터 목록에 보여 준다
  const linked = agendas.filter((a) => notes.some((n) => n.agenda_id === a.id))

  return (
    <>
      <section className="card">
        <h2>개별 노트 (나만 보임)</h2>
        <p className="hint">토론 중에 적은 메모와 개인 메모를 모아 봐요. 다른 사람(임원진 포함)에게는 보이지 않아요.</p>
        <form className="form" onSubmit={add} style={{ marginTop: 12 }}>
          <label>
            새 노트
            <textarea value={text} maxLength={5000} rows={4} onChange={(e) => setText(e.target.value)} />
          </label>
          <label>
            연결할 토론 (선택)
            <select value={agendaId} onChange={(e) => setAgendaId(e.target.value)}>
              <option value="">연결 안 함</option>
              {agendas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="msg error" role="alert">{error}</p>}
          <div className="actions">
            <button className="btn" disabled={saving || !text.trim()}>{saving ? '저장 중...' : '노트 저장'}</button>
          </div>
        </form>
      </section>

      {loadError && <p className="msg error" role="alert">{loadError}</p>}

      <section className="card">
        <div className="section-head">
          <h2>내 노트 {!loading && !loadError && `(${shown.length})`}</h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="노트 보기">
            <option value="">전체</option>
            <option value="none">토론과 연결 안 됨</option>
            {linked.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
        {loading ? (
          <p>불러오는 중...</p>
        ) : shown.length === 0 ? (
          <p>{notes.length === 0 ? '아직 적은 노트가 없습니다.' : '조건에 맞는 노트가 없습니다.'}</p>
        ) : (
          <div className="post-list">
            {shown.map((n) => (
              <NoteItem key={n.id} note={n} onChanged={load} onError={setError}>
                {n.agenda_id !== null && (
                  <p className="hint">
                    토론: <Link to={`/agendas/${n.agenda_id}`}>{titleOf(n.agenda_id)}</Link>
                  </p>
                )}
              </NoteItem>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
