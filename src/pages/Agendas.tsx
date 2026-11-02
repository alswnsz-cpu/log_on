import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import StanceBar from '../components/StanceBar'
import {
  countStances,
  STATUS_LABEL,
  useRealtimeRefresh,
  type Agenda,
  type AgendaStatus,
  type Stance,
  type StanceCounts,
} from '../lib/agendas'

type Filter = 'all' | AgendaStatus

const FILTERS: [Filter, string][] = [
  ['all', '전체'],
  ['discussing', '토론 중'],
  ['decided', '확정'],
]

export default function Agendas() {
  const { profile } = useAuth()
  const isOfficer = profile?.role === 'officer'
  const [agendas, setAgendas] = useState<Agenda[]>([])
  const [counts, setCounts] = useState<Record<number, StanceCounts>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [a, o] = await Promise.all([
      supabase.from('agendas').select('id, title, description, status, created_at').order('created_at', { ascending: false }),
      supabase.from('opinions').select('agenda_id, stance'),
    ])
    if (a.error || o.error) {
      setLoadError('토론을 불러오지 못했습니다.')
    } else {
      setLoadError(null)
      setAgendas(a.data as Agenda[])
      const grouped: Record<number, Stance[]> = {}
      for (const row of o.data as { agenda_id: number; stance: Stance }[]) {
        if (!grouped[row.agenda_id]) grouped[row.agenda_id] = []
        grouped[row.agenda_id].push(row.stance)
      }
      setCounts(Object.fromEntries(Object.entries(grouped).map(([id, s]) => [id, countStances(s)])))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])
  useRealtimeRefresh('agendas-list', load)

  async function create(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (t.length < 1 || t.length > 100) return setFormError('제목은 1~100자로 입력해 주세요.')
    if (description.length > 2000) return setFormError('설명은 2000자 이하로 입력해 주세요.')
    setFormError(null)
    setSaving(true)
    const { error } = await supabase.from('agendas').insert({ title: t, description: description.trim() || null })
    setSaving(false)
    if (error) return setFormError('토론을 만들지 못했습니다. 임원진 권한을 확인해 주세요.')
    setTitle('')
    setDescription('')
    setShowForm(false)
    await load()
  }

  const shown = agendas.filter((a) => filter === 'all' || a.status === filter)

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h2>토론</h2>
          {isOfficer && (
            <button className="btn btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? '닫기' : '새 토론'}
            </button>
          )}
        </div>
        {showForm && (
          <form className="form" onSubmit={create}>
            <label>
              제목
              <input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <label>
              설명 (선택)
              <textarea value={description} maxLength={2000} rows={4} onChange={(e) => setDescription(e.target.value)} />
            </label>
            {formError && <p className="msg error" role="alert">{formError}</p>}
            <div className="actions">
              <button className="btn" disabled={saving}>{saving ? '저장 중...' : '토론 만들기'}</button>
            </div>
          </form>
        )}
        <div className="day-picker" style={{ marginTop: 12 }}>
          {FILTERS.map(([k, label]) => (
            <button key={k} className={filter === k ? 'chip on' : 'chip'} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {loadError && <p className="msg error" role="alert">{loadError}</p>}
      {loading ? (
        <section className="card"><p>불러오는 중...</p></section>
      ) : shown.length === 0 ? (
        <section className="card">
          <p>{agendas.length === 0 ? '아직 등록된 토론이 없습니다.' : '해당 상태의 토론이 없습니다.'}</p>
        </section>
      ) : (
        <div className="card-grid">
          {shown.map((a) => {
            const c = counts[a.id] ?? { agree: 0, disagree: 0, hold: 0 }
            return (
              <Link key={a.id} to={`/agendas/${a.id}`} className="card agenda-card">
                <div className="section-head">
                  <h2>{a.title}</h2>
                  <span className={a.status === 'decided' ? 'badge ok' : 'badge'}>{STATUS_LABEL[a.status]}</span>
                </div>
                <p className="hint">의견 {c.agree + c.disagree + c.hold}개</p>
                <StanceBar counts={c} />
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
