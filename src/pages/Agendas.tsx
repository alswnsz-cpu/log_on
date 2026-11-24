import { createDebateAgenda, getDebateSessions } from '../lib/debateApi'
import { DEBATE_STAGES, DEBATE_STAGE_LABEL, type DebateStage } from '../lib/debateWorkflow'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import StanceBar from '../components/StanceBar'
import {
  countStances,
  STATUS_LABEL,
  useRealtimeRefresh,
  type Agenda,
  type Stance,
  type StanceCounts,
} from '../lib/agendas'
import DecisionBoard from './Decisions'

type Tab = 'all' | 'discussing' | 'decided'

const TABS: [Tab, string][] = [
  ['all', '전체'],
  ['discussing', '토론 중'],
  ['decided', '확정 및 결론'],
]

/** 주소의 ?tab= 값. 없거나 잘못된 값이면 전체 */
function parseTab(value: string | null): Tab {
  return value === 'discussing' || value === 'decided' ? value : 'all'
}

export default function Agendas() {
  const { profile } = useAuth()
  const isOfficer = profile?.role === 'officer'
  const [stages, setStages] = useState<Record<number, DebateStage>>({})
  const requestId = useRef(0)
  const [agendas, setAgendas] = useState<Agenda[]>([])
  const [counts, setCounts] = useState<Record<number, StanceCounts>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = parseTab(searchParams.get('tab'))
  /** 탭을 바꾸면 주소(?tab=)가 바뀌어 새로고침하거나 링크를 공유해도 같은 탭이 열린다. 브라우저 기록은 쌓지 않는다. */
  function selectTab(next: Tab) {
    setSearchParams(next === 'all' ? {} : { tab: next }, { replace: true })
  }

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current

    try {
      const [a, o, sessions] = await Promise.all([
        supabase.from('agendas').select('id, title, description, status, created_at').order('created_at', { ascending: false }),
        supabase.from('opinions').select('agenda_id, stance'),
        getDebateSessions(),
      ])

      if (a.error) throw a.error
      if (o.error) throw o.error

      if (currentRequest !== requestId.current) return

      const grouped: Record<number, Stance[]> = {}

      for (const row of o.data as { agenda_id: number; stance: Stance }[]) {
        if (!grouped[row.agenda_id]) grouped[row.agenda_id] = []
        grouped[row.agenda_id].push(row.stance)
      }

      setAgendas(a.data as Agenda[])
      setCounts(Object.fromEntries(Object.entries(grouped).map(([id, s]) => [id, countStances(s)])))
      setStages(Object.fromEntries(sessions.map(s => [s.agenda_id, s.stage])))
      setLoadError(null)
    } catch (err) {
      console.error('Debate list loading failed:', err)

      if (currentRequest === requestId.current) {
        setLoadError('토론을 불러오지 못했습니다.')
      }
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])
  useRealtimeRefresh('agendas-list', load)

  useEffect(() => {
    const timer = window.setInterval(() => {
      void load()
    }, 5000)

    return () => {
      window.clearInterval(timer)
      // Invalidate pending requests during cleanup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestId.current++
    }
  }, [load])

  async function create(e: FormEvent) {
    e.preventDefault()
    if (saving || !isOfficer || loading || loadError) return
    const t = title.trim()
    if (t.length < 1 || t.length > 100) return setFormError('제목은 1~100자로 입력해 주세요.')
    if (description.length > 2000) return setFormError('설명은 2000자 이하로 입력해 주세요.')
    setFormError(null)
    setSaving(true)
    try {
      await createDebateAgenda(t, description)
    } catch (err) {
      console.error('Debate creation failed:', err)
      setFormError('토론을 만들지 못했습니다. 임원진 권한과 DB 연결을 확인해 주세요.')
      return
    } finally {
      setSaving(false)
    }
    setTitle('')
    setDescription('')
    setShowForm(false)
    await load()
  }

  const shown = agendas.filter((a) => tab === 'all' || a.status === tab)
  const countOf = (t: Tab) => (t === 'all' ? agendas.length : agendas.filter((a) => a.status === t).length)
  // 불러오는 중이거나 불러오지 못했을 때는 건수가 틀려 보이지 않게 숨긴다
  const showCounts = !loading && !loadError
  /** 안건 상세의 "← 토론 목록"이 지금 탭으로 돌아오게 넘기는 주소 */
  const backTo = location.pathname + location.search

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
              <button className="btn" disabled={saving || loading || Boolean(loadError)}>{saving ? '저장 중...' : '토론 만들기'}</button>
            </div>
          </form>
        )}
        <div className="day-picker" role="tablist" aria-label="토론 보기" style={{ marginTop: 12 }}>
          {TABS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              id={`agenda-tab-${k}`}
              aria-selected={tab === k}
              aria-controls="agenda-tab-panel"
              className={tab === k ? 'chip on' : 'chip'}
              onClick={() => selectTab(k)}
            >
              {label}
              {showCounts ? ` ${countOf(k)}` : ''}
            </button>
          ))}
        </div>
      </section>

      <div role="tabpanel" id="agenda-tab-panel" aria-labelledby={`agenda-tab-${tab}`} className="tab-panel">
        {tab === 'decided' ? (
          <DecisionBoard />
        ) : (
          <>
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
                  const stage = stages[a.id]
                  const c = counts[a.id] ?? { agree: 0, disagree: 0, hold: 0 }
                  return (
                    <Link key={a.id} to={`/agendas/${a.id}`} state={{ back: backTo }} className="card agenda-card">
                      <div className="section-head">
                        <h2>{a.title}</h2>
                        <span className={a.status === 'decided' ? 'badge ok' : 'badge'}>{stage ? DEBATE_STAGE_LABEL[stage] : STATUS_LABEL[a.status]}</span>
                      </div>
                      {stage ? (
                        <div className="debate-list-progress">
                          <p className="hint">단계별 토론</p>

                          <div
                            className="debate-list-track"
                            role="img"
                            aria-label={`${DEBATE_STAGES.indexOf(stage) + 1}/5단계`}
                          >
                            {DEBATE_STAGES.map((s, i) => (
                              <span
                                key={s}
                                className={
                                  i <= DEBATE_STAGES.indexOf(stage)
                                    ? 'debate-list-segment active'
                                    : 'debate-list-segment'
                                }
                              />
                            ))}
                          </div>

                          <p className="hint">
                            {DEBATE_STAGES.indexOf(stage) + 1}/5단계
                            {' · '}
                            {DEBATE_STAGE_LABEL[stage]}
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="hint">의견 {c.agree + c.disagree + c.hold}개</p>
                          <StanceBar counts={c} />
                        </>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
