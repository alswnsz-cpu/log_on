import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import StanceBar from '../components/StanceBar'
import {
  authorName,
  countStances,
  formatDateTime,
  STANCE_LABEL,
  STATUS_LABEL,
  useRealtimeRefresh,
  type Agenda,
  type Stance,
} from '../lib/agendas'

interface Opinion {
  id: number
  user_id: string
  stance: Stance
  content: string | null
  updated_at: string
  profiles: { name: string; status: string } | null
}

interface Decision {
  content: string
  decided_at: string
  profiles: { name: string; status: string } | null
}

const STANCES: Stance[] = ['agree', 'disagree', 'hold']

export default function AgendaDetail() {
  const { id } = useParams()
  const agendaId = Number(id)
  const navigate = useNavigate()
  const { profile } = useAuth()
  const isOfficer = profile?.role === 'officer'

  const [agenda, setAgenda] = useState<Agenda | null>(null)
  const [opinions, setOpinions] = useState<Opinion[]>([])
  const [decision, setDecision] = useState<Decision | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // 내 의견 폼
  const [stance, setStance] = useState<Stance>('agree')
  const [content, setContent] = useState('')
  const [formSynced, setFormSynced] = useState(false)

  // 임원진 편집
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [decisionText, setDecisionText] = useState('')
  const [editingDecision, setEditingDecision] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isInteger(agendaId)) {
      setLoading(false)
      return
    }
    const [a, o, d] = await Promise.all([
      supabase.from('agendas').select('id, title, description, status, created_at').eq('id', agendaId).maybeSingle(),
      supabase
        .from('opinions')
        .select('id, user_id, stance, content, updated_at, profiles(name, status)')
        .eq('agenda_id', agendaId)
        .order('created_at', { ascending: true }),
      supabase
        .from('decisions')
        .select('content, decided_at, profiles(name, status)')
        .eq('agenda_id', agendaId)
        .maybeSingle(),
    ])
    if (a.error || o.error || d.error) {
      setLoadError('토론을 불러오지 못했습니다.')
    } else {
      setLoadError(null)
      setAgenda(a.data as Agenda | null)
      setOpinions(o.data as unknown as Opinion[])
      setDecision(d.data as unknown as Decision | null)
    }
    setLoading(false)
  }, [agendaId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])
  useRealtimeRefresh(`agenda-${agendaId}`, load)

  const mine = opinions.find((o) => o.user_id === profile?.id)

  // 내 기존 의견을 폼에 한 번만 채운다 (이후 실시간 갱신이 입력 중인 내용을 덮어쓰지 않게)
  useEffect(() => {
    if (formSynced || loading) return
    if (mine) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStance(mine.stance)
      setContent(mine.content ?? '')
    }
    setFormSynced(true)
  }, [mine, loading, formSynced])

  if (loading) {
    return <section className="card"><p>불러오는 중...</p></section>
  }
  if (loadError) {
    return <p className="msg error" role="alert">{loadError}</p>
  }
  if (!agenda) {
    return (
      <section className="card">
        <h2>토론을 찾을 수 없습니다</h2>
        <p><Link to="/agendas">토론 목록으로</Link></p>
      </section>
    )
  }

  const locked = agenda.status === 'decided'
  const counts = countStances(opinions.map((o) => o.stance))

  async function saveOpinion(e: FormEvent) {
    e.preventDefault()
    if (content.length > 500) return setError('의견은 500자 이하로 입력해 주세요.')
    setError(null)
    setBusy(true)
    const { error: err } = await supabase
      .from('opinions')
      .upsert({ agenda_id: agendaId, stance, content: content.trim() || null }, { onConflict: 'agenda_id,user_id' })
    setBusy(false)
    if (err) setError('의견을 저장하지 못했습니다. 이미 확정된 토론일 수 있습니다.')
    await load()
  }

  async function deleteOpinion() {
    if (!mine || !window.confirm('내 의견을 삭제할까요?')) return
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.from('opinions').delete().eq('id', mine.id)
    setBusy(false)
    if (err) setError('의견을 삭제하지 못했습니다.')
    else {
      setContent('')
      setStance('agree')
    }
    await load()
  }

  async function saveAgenda(e: FormEvent) {
    e.preventDefault()
    const t = editTitle.trim()
    if (t.length < 1 || t.length > 100) return setError('제목은 1~100자로 입력해 주세요.')
    if (editDesc.length > 2000) return setError('설명은 2000자 이하로 입력해 주세요.')
    setError(null)
    setBusy(true)
    const { error: err } = await supabase
      .from('agendas')
      .update({ title: t, description: editDesc.trim() || null })
      .eq('id', agendaId)
    setBusy(false)
    if (err) return setError('토론을 수정하지 못했습니다.')
    setEditing(false)
    await load()
  }

  async function deleteAgenda() {
    if (!window.confirm('이 토론과 모든 의견·결론을 삭제할까요? 되돌릴 수 없습니다.')) return
    setBusy(true)
    const { error: err } = await supabase.from('agendas').delete().eq('id', agendaId)
    setBusy(false)
    if (err) return setError('토론을 삭제하지 못했습니다.')
    navigate('/agendas')
  }

  async function reopenAgenda() {
    if (!window.confirm('이 토론을 다시 진행할까요? 부원이 의견을 다시 쓸 수 있게 되고, 기존 결론은 "이전 결론"으로 남습니다.')) return
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.from('agendas').update({ status: 'discussing' }).eq('id', agendaId)
    setBusy(false)
    if (err) setError('다시 논의로 바꾸지 못했습니다. 임원진 권한을 확인해 주세요.')
    await load()
  }

  async function saveDecision(e: FormEvent) {
    e.preventDefault()
    const text = decisionText.trim()
    if (text.length < 1 || text.length > 2000) return setError('결론은 1~2000자로 입력해 주세요.')
    if (!locked && !window.confirm('결론을 확정하면 더 이상 의견을 쓸 수 없습니다. 확정할까요?')) return
    setError(null)
    setBusy(true)
    const { error: err } = await supabase
      .from('decisions')
      .upsert({ agenda_id: agendaId, content: text }, { onConflict: 'agenda_id' }) // 확정자·일시는 DB 트리거가 기록
    setBusy(false)
    if (err) return setError('결론을 저장하지 못했습니다. 임원진 권한을 확인해 주세요.')
    setEditingDecision(false)
    await load()
  }

  return (
    <>
      <p><Link to="/agendas" className="hint">← 토론 목록</Link></p>

      <section className="card">
        {editing ? (
          <form className="form" onSubmit={saveAgenda}>
            <label>
              제목
              <input value={editTitle} maxLength={100} onChange={(e) => setEditTitle(e.target.value)} required />
            </label>
            <label>
              설명
              <textarea value={editDesc} maxLength={2000} rows={4} onChange={(e) => setEditDesc(e.target.value)} />
            </label>
            <div className="actions">
              <button className="btn" disabled={busy}>저장</button>
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>취소</button>
            </div>
          </form>
        ) : (
          <>
            <div className="section-head">
              <h2>{agenda.title}</h2>
              <span className={locked ? 'badge ok' : 'badge'}>{STATUS_LABEL[agenda.status]}</span>
            </div>
            {agenda.description && <p className="decision-text">{agenda.description}</p>}
            {isOfficer && (
              <div className="actions">
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setEditTitle(agenda.title)
                    setEditDesc(agenda.description ?? '')
                    setEditing(true)
                  }}
                >
                  수정
                </button>
                <button className="btn btn-sm btn-ghost" disabled={busy} onClick={deleteAgenda}>삭제</button>
              </div>
            )}
          </>
        )}
      </section>

      {error && <p className="msg error" role="alert">{error}</p>}

      {decision && (
        <section className="card decision-card">
          <h2>{locked ? '결론' : '이전 결론'}</h2>
          {editingDecision && locked ? (
            <form className="form" onSubmit={saveDecision}>
              <textarea value={decisionText} maxLength={2000} rows={4} onChange={(e) => setDecisionText(e.target.value)} />
              <div className="actions">
                <button className="btn" disabled={busy}>저장</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditingDecision(false)}>취소</button>
              </div>
            </form>
          ) : (
            <>
              <p className="decision-text">{decision.content}</p>
              <p className="hint">
                확정: {authorName(decision.profiles)} · {formatDateTime(decision.decided_at)}
              </p>
              {!locked && <p className="hint">다시 논의 중입니다. 새로 확정하면 이 결론이 교체됩니다.</p>}
              {isOfficer && locked && (
                <div className="actions">
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setDecisionText(decision.content)
                      setEditingDecision(true)
                    }}
                  >
                    결론 수정
                  </button>
                  <button className="btn btn-sm btn-ghost" disabled={busy} onClick={reopenAgenda}>
                    다시 논의하기
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2>의견 ({opinions.length})</h2>
        <StanceBar counts={counts} />
        {opinions.length > 0 && (
          <ul className="list">
            {opinions.map((o) => (
              <li key={o.id}>
                <span className="name">
                  {authorName(o.profiles)}
                  <span className={`badge stance-${o.stance}`}>{STANCE_LABEL[o.stance]}</span>
                </span>
                {o.content && <span className="opinion-text">{o.content}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {locked ? (
        <section className="card">
          <p>결론이 확정되어 의견을 더 이상 쓸 수 없습니다.</p>
        </section>
      ) : (
        <section className="card">
          <h2>{mine ? '내 의견 수정' : '내 의견 남기기'}</h2>
          <form className="form" onSubmit={saveOpinion}>
            <div className="day-picker">
              {STANCES.map((s) => (
                <button type="button" key={s} className={stance === s ? 'chip on' : 'chip'} onClick={() => setStance(s)}>
                  {STANCE_LABEL[s]}
                </button>
              ))}
            </div>
            <label>
              한 줄 의견 (선택)
              <textarea value={content} maxLength={500} rows={3} onChange={(e) => setContent(e.target.value)} />
            </label>
            <div className="actions">
              <button className="btn" disabled={busy}>{busy ? '저장 중...' : '저장'}</button>
              {mine && (
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={deleteOpinion}>
                  삭제
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      {isOfficer && !locked && (
        <section className="card">
          <h2>{decision ? '새 결론 확정 (임원진)' : '결론 확정 (임원진)'}</h2>
          <form className="form" onSubmit={saveDecision}>
            <label>
              결론 내용
              <textarea value={decisionText} maxLength={2000} rows={4} onChange={(e) => setDecisionText(e.target.value)} />
            </label>
            <p className="hint">확정하면 토론이 '확정'으로 바뀌고 의견이 잠깁니다.</p>
            <div className="actions">
              <button className="btn" disabled={busy}>결론 확정</button>
            </div>
          </form>
        </section>
      )}
    </>
  )
}
