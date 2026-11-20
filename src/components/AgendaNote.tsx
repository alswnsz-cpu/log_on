import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import NoteItem, { NOTE_COLUMNS, type NoteRow } from './NoteItem'

/**
 * 안건 상세의 "내 메모(나만 보임)" 카드. 토론 중에 내 의견이나 다른 사람의 의견을 메모해 둔다.
 * 토론이 확정돼도 쓸 수 있고, 다른 사람(임원진 포함)에게는 보이지 않는다.
 * 메모를 불러오지 못해도 토론 화면의 다른 부분에는 영향을 주지 않는다.
 */
export default function AgendaNote({ agendaId }: { agendaId: number }) {
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('notes')
      .select(NOTE_COLUMNS)
      .eq('agenda_id', agendaId)
      .order('created_at', { ascending: true })
    if (err) setLoadError('메모를 불러오지 못했습니다.')
    else {
      setLoadError(null)
      setNotes(data as NoteRow[])
    }
    setLoading(false)
  }, [agendaId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (body.length < 1 || body.length > 5000) return setError('메모는 1~5000자로 입력해 주세요.')
    setError(null)
    setSaving(true)
    const { data, error: err } = await supabase.from('notes').insert({ agenda_id: agendaId, body }).select('id')
    setSaving(false)
    if (err || (data?.length ?? 0) === 0) return setError('메모를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    setText('')
    await load()
  }

  return (
    <section className="card">
      <h2>내 메모 (나만 보임)</h2>
      <p className="hint">이 토론에 대한 내 생각이나 다른 사람의 의견을 적어 두세요. 다른 사람에게는 보이지 않아요.</p>
      {loadError && <p className="msg error" role="alert">{loadError}</p>}
      {loading ? (
        <p>불러오는 중...</p>
      ) : (
        notes.length > 0 && (
          <div className="post-list">
            {notes.map((n) => (
              <NoteItem key={n.id} note={n} onChanged={load} onError={setError} />
            ))}
          </div>
        )
      )}
      <form className="form" onSubmit={add} style={{ marginTop: 12 }}>
        <label>
          새 메모
          <textarea value={text} maxLength={5000} rows={3} onChange={(e) => setText(e.target.value)} />
        </label>
        {error && <p className="msg error" role="alert">{error}</p>}
        <div className="actions">
          <button className="btn" disabled={saving || !text.trim()}>{saving ? '저장 중...' : '메모 저장'}</button>
        </div>
      </form>
    </section>
  )
}
