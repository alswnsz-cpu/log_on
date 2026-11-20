import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useDialog } from '../components/dialog-context'

const FIELDS = [
  { key: 'headline', label: '한 줄 소개', short: true },
  { key: 'bio', label: '자기소개서', rows: 6 },
  { key: 'education', label: '학력 및 전공', rows: 3 },
  { key: 'experience', label: '경력 및 인턴 경험', rows: 3 },
  { key: 'projects', label: '프로젝트 · 공모전', rows: 3 },
  { key: 'skills', label: '보유 역량', rows: 3 },
  { key: 'career_goal', label: '희망 직무 및 커리어 목표', rows: 3 },
  { key: 'contact', label: '공개할 연락처', short: true },
] as const

type Content = Record<string, string>

interface Cert {
  id: string
  title: string
  issuer: string | null
  acquired_date: string | null
  details: string | null
}
interface Activity {
  id: string
  title: string
  category: string | null
  description: string | null
  started_on: string | null
}

/** 내 포트폴리오: 본인만 보고 고친다. 임원진도 다른 사람 것은 볼 수 없다(DB 정책이 막는다). */
export default function Portfolio() {
  const { session } = useAuth()
  const dialog = useDialog()
  const myId = session!.user.id
  const [content, setContent] = useState<Content>({})
  const [certs, setCerts] = useState<Cert[]>([])
  const [acts, setActs] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [certForm, setCertForm] = useState({ title: '', issuer: '', date: '', details: '' })
  const [actForm, setActForm] = useState({ title: '', category: '', date: '', description: '' })
  const [recordError, setRecordError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [p, c, a] = await Promise.all([
      supabase.from('portfolios').select('content').eq('user_id', myId).maybeSingle(),
      supabase
        .from('certifications')
        .select('id, title, issuer, acquired_date, details')
        .eq('user_id', myId)
        .order('created_at', { ascending: false }),
      supabase
        .from('activities')
        .select('id, title, category, description, started_on')
        .eq('user_id', myId)
        .order('created_at', { ascending: false }),
    ])
    if (p.error || c.error || a.error) setLoadError('포트폴리오를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    else {
      setLoadError(null)
      setContent((p.data?.content ?? {}) as Content)
      setCerts(c.data as Cert[])
      setActs(a.data as Activity[])
    }
    setLoading(false)
  }, [myId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function save(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg(null)
    const clean: Content = {}
    for (const f of FIELDS) clean[f.key] = (content[f.key] ?? '').slice(0, 10000)
    const { error } = await supabase
      .from('portfolios')
      .upsert({ user_id: myId, content: clean, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setSaving(false)
    setSaveMsg(error ? { ok: false, text: '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' } : { ok: true, text: '포트폴리오를 저장했습니다.' })
  }

  async function addCert(e: FormEvent) {
    e.preventDefault()
    const title = certForm.title.trim()
    if (!title) return setRecordError('자격증명을 입력해 주세요.')
    setRecordError(null)
    const { error } = await supabase.from('certifications').insert({
      user_id: myId,
      title: title.slice(0, 200),
      issuer: certForm.issuer.trim().slice(0, 200) || null,
      acquired_date: certForm.date || null,
      details: certForm.details.trim().slice(0, 2000) || null,
    })
    if (error) return setRecordError('자격증을 추가하지 못했습니다.')
    setCertForm({ title: '', issuer: '', date: '', details: '' })
    await load()
  }

  async function addActivity(e: FormEvent) {
    e.preventDefault()
    const title = actForm.title.trim()
    if (!title) return setRecordError('활동 또는 수상명을 입력해 주세요.')
    setRecordError(null)
    const { error } = await supabase.from('activities').insert({
      user_id: myId,
      title: title.slice(0, 200),
      category: actForm.category.trim().slice(0, 100) || null,
      started_on: actForm.date || null,
      description: actForm.description.trim().slice(0, 4000) || null,
    })
    if (error) return setRecordError('활동을 추가하지 못했습니다.')
    setActForm({ title: '', category: '', date: '', description: '' })
    await load()
  }

  async function remove(table: 'certifications' | 'activities', id: string, name: string) {
    const ok = await dialog.confirm({ message: `"${name}"을(를) 삭제할까요?`, confirmLabel: '삭제', danger: true })
    if (!ok) return
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', myId)
    if (error) return setRecordError('삭제하지 못했습니다.')
    setRecordError(null)
    await load()
  }

  if (loading) return <section className="card"><p>불러오는 중...</p></section>

  return (
    <>
      <section className="card">
        <h2>내 포트폴리오</h2>
        <p className="hint">나만 볼 수 있습니다. 임원진도 다른 부원의 포트폴리오는 볼 수 없습니다.</p>
        {loadError && <p className="msg error" role="alert">{loadError}</p>}
        <form className="form" onSubmit={save}>
          {FIELDS.map((f) => (
            <label key={f.key}>
              {f.label}
              {'short' in f ? (
                <input
                  value={content[f.key] ?? ''}
                  maxLength={10000}
                  onChange={(e) => setContent({ ...content, [f.key]: e.target.value })}
                />
              ) : (
                <textarea
                  value={content[f.key] ?? ''}
                  rows={f.rows}
                  maxLength={10000}
                  onChange={(e) => setContent({ ...content, [f.key]: e.target.value })}
                />
              )}
            </label>
          ))}
          {saveMsg && <p className={saveMsg.ok ? 'msg ok' : 'msg error'} role="status">{saveMsg.text}</p>}
          <div className="actions">
            <button className="btn" disabled={saving}>{saving ? '저장 중...' : '변경사항 저장'}</button>
          </div>
        </form>
      </section>

      {recordError && <p className="msg error" role="alert">{recordError}</p>}

      <div className="card-grid">
        <section className="card">
          <h2>자격증</h2>
          <ul className="list">
            {certs.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{c.title}</strong>
                  <p className="hint">{[c.issuer, c.acquired_date].filter(Boolean).join(' · ')}</p>
                  {c.details && <p>{c.details}</p>}
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => remove('certifications', c.id, c.title)}>삭제</button>
              </li>
            ))}
          </ul>
          {certs.length === 0 && <p className="hint">아직 등록한 자격증이 없습니다.</p>}
          <form className="form" onSubmit={addCert}>
            <input placeholder="자격증명" value={certForm.title} maxLength={200} onChange={(e) => setCertForm({ ...certForm, title: e.target.value })} />
            <input placeholder="발급 기관" value={certForm.issuer} maxLength={200} onChange={(e) => setCertForm({ ...certForm, issuer: e.target.value })} />
            <input type="date" aria-label="취득일" value={certForm.date} onChange={(e) => setCertForm({ ...certForm, date: e.target.value })} />
            <textarea placeholder="비고" rows={2} value={certForm.details} maxLength={2000} onChange={(e) => setCertForm({ ...certForm, details: e.target.value })} />
            <div className="actions"><button className="btn btn-sm">자격증 추가</button></div>
          </form>
        </section>

        <section className="card">
          <h2>활동 · 수상</h2>
          <ul className="list">
            {acts.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.title}</strong>
                  <p className="hint">{[a.category, a.started_on].filter(Boolean).join(' · ')}</p>
                  {a.description && <p>{a.description}</p>}
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => remove('activities', a.id, a.title)}>삭제</button>
              </li>
            ))}
          </ul>
          {acts.length === 0 && <p className="hint">아직 등록한 활동이 없습니다.</p>}
          <form className="form" onSubmit={addActivity}>
            <input placeholder="활동 또는 수상명" value={actForm.title} maxLength={200} onChange={(e) => setActForm({ ...actForm, title: e.target.value })} />
            <input placeholder="분류 (대외활동, 공모전 등)" value={actForm.category} maxLength={100} onChange={(e) => setActForm({ ...actForm, category: e.target.value })} />
            <input type="date" aria-label="활동 시작일" value={actForm.date} onChange={(e) => setActForm({ ...actForm, date: e.target.value })} />
            <textarea placeholder="활동 설명" rows={2} value={actForm.description} maxLength={4000} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} />
            <div className="actions"><button className="btn btn-sm">활동 추가</button></div>
          </form>
        </section>
      </div>
    </>
  )
}
