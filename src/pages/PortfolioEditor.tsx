import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { RECORD_COLUMNS, periodLabel, type ActivityRecord } from '../lib/activityRecords'
import {
  DEFAULT_JOBS,
  MAX_FIELD,
  SECTIONS,
  SENTENCE_TARGETS,
  cleanContent,
  type Content,
} from '../lib/portfolioFields'
import { suggestSentences } from '../lib/portfolioTemplates'

interface Cert {
  id: string
  title: string
  issuer: string | null
  acquired_date: string | null
}

const CUSTOM = '__custom__'

/** 직무별 포트폴리오 편집: 칸 채우기, 활동 기록으로 문장 만들기, 미리보기와 PDF 인쇄. 본인만 보고 고친다. */
export default function PortfolioEditor() {
  const { docId } = useParams()
  const id = Number(docId)
  const { profile } = useAuth()

  const [content, setContent] = useState<Content>({})
  const [jobChoice, setJobChoice] = useState(DEFAULT_JOBS[0])
  const [customJob, setCustomJob] = useState('')
  const [records, setRecords] = useState<ActivityRecord[]>([])
  const [certs, setCerts] = useState<Cert[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [recordId, setRecordId] = useState('')
  const [target, setTarget] = useState(SENTENCE_TARGETS[0].key)
  const [addedMsg, setAddedMsg] = useState<string | null>(null)

  const jobTitle = (jobChoice === CUSTOM ? customJob : jobChoice).trim()

  const load = useCallback(async () => {
    if (!Number.isInteger(id)) {
      setNotFound(true)
      setLoading(false)
      return
    }
    const [d, r, c] = await Promise.all([
      supabase.from('portfolio_documents').select('job_title, content').eq('id', id).maybeSingle(),
      supabase
        .from('activity_records')
        .select(RECORD_COLUMNS)
        .order('started_on', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('certifications')
        .select('id, title, issuer, acquired_date')
        .order('acquired_date', { ascending: false, nullsFirst: false }),
    ])
    if (d.error || r.error || c.error) {
      setLoadError('포트폴리오를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } else if (!d.data) {
      setNotFound(true)
    } else {
      setLoadError(null)
      setContent((d.data.content ?? {}) as Content)
      const job = d.data.job_title as string
      if (DEFAULT_JOBS.includes(job)) setJobChoice(job)
      else {
        setJobChoice(CUSTOM)
        setCustomJob(job)
      }
      setRecords(r.data as ActivityRecord[])
      setCerts(c.data as Cert[])
    }
    setLoading(false)
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function save(e: FormEvent) {
    e.preventDefault()
    if (jobTitle.length < 1 || jobTitle.length > 100) return setSaveMsg({ ok: false, text: '직무 이름은 1~100자로 입력해 주세요.' })
    setSaving(true)
    setSaveMsg(null)
    const { data, error } = await supabase
      .from('portfolio_documents')
      .update({ job_title: jobTitle, content: cleanContent(content) })
      .eq('id', id)
      .select('id')
    setSaving(false)
    setSaveMsg(
      error || (data?.length ?? 0) === 0
        ? { ok: false, text: '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
        : { ok: true, text: '포트폴리오를 저장했습니다.' },
    )
  }

  /** 만든 문장을 고른 칸의 맨 아래에 덧붙인다(저장은 따로 눌러야 한다) */
  function appendSentence(text: string) {
    const before = content[target] ?? ''
    const next = before.trim() ? `${before.trimEnd()}\n${text}` : text
    if (next.length > MAX_FIELD) return setAddedMsg('칸이 가득 차서 더 붙일 수 없어요.')
    setContent({ ...content, [target]: next })
    const label = SENTENCE_TARGETS.find((t) => t.key === target)?.label ?? ''
    setAddedMsg(`"${label}" 칸에 붙였어요. 아래 "저장"을 눌러야 저장돼요.`)
  }

  if (loading) return <section className="card"><p>불러오는 중...</p></section>
  if (loadError) return <p className="msg error" role="alert">{loadError}</p>
  if (notFound) {
    return (
      <section className="card">
        <h2>포트폴리오를 찾을 수 없습니다</h2>
        <p><Link to="/portfolio">내 포트폴리오로</Link></p>
      </section>
    )
  }

  const picked = records.find((r) => String(r.id) === recordId) ?? null
  const suggestions = picked ? suggestSentences(picked, jobTitle) : []

  return (
    <>
      <p className="no-print"><Link to="/portfolio" className="hint">← 내 포트폴리오</Link></p>

      <section className="card no-print">
        <h2>직무별 포트폴리오</h2>
        <p className="hint">나만 볼 수 있습니다. 임원진도 볼 수 없습니다.</p>
        <div className="form">
          <label>
            직무
            <select value={jobChoice} onChange={(e) => setJobChoice(e.target.value)}>
              {DEFAULT_JOBS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
              <option value={CUSTOM}>직접 입력</option>
            </select>
          </label>
          {jobChoice === CUSTOM && (
            <label>
              직무 이름
              <input value={customJob} maxLength={100} onChange={(e) => setCustomJob(e.target.value)} />
            </label>
          )}
        </div>
      </section>

      <section className="card no-print">
        <h2>활동 기록으로 문장 만들기</h2>
        <p className="hint">
          활동 기록을 고르면 정해진 틀로 문장 후보를 만들어요(AI가 아니라 규칙으로 만들어요). 그대로 쓰지 말고 내 말로 다듬어 쓰세요.
        </p>
        {records.length === 0 ? (
          <p className="hint">
            아직 활동 기록이 없어요. <Link to="/records">활동 기록</Link>에서 먼저 적어 보세요.
          </p>
        ) : (
          <div className="form">
            <label>
              활동 기록
              <select value={recordId} onChange={(e) => { setRecordId(e.target.value); setAddedMsg(null) }}>
                <option value="">활동 고르기</option>
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                    {periodLabel(r) && ` (${periodLabel(r)})`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              붙일 칸
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                {SENTENCE_TARGETS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {suggestions.length > 0 && (
          <div className="post-list">
            {suggestions.map((s) => (
              <div key={s.label} className="post-item">
                <span className="badge muted">{s.label}</span>
                <p className="decision-text">{s.text}</p>
                <div className="actions">
                  <button type="button" className="btn btn-sm" onClick={() => appendSentence(s.text)}>
                    이 문장 붙이기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {addedMsg && <p className="msg ok" role="status">{addedMsg}</p>}
      </section>

      <form className="no-print" onSubmit={save}>
        {SECTIONS.map((section) => (
          <section key={section.title} className="card" style={{ marginBottom: 16 }}>
            <h2>{section.title}</h2>
            <div className="form">
              {section.fields.map((f) => (
                <label key={f.key}>
                  {f.label}
                  {f.short ? (
                    <input
                      value={content[f.key] ?? ''}
                      maxLength={MAX_FIELD}
                      onChange={(e) => setContent({ ...content, [f.key]: e.target.value })}
                    />
                  ) : (
                    <textarea
                      value={content[f.key] ?? ''}
                      rows={f.rows ?? 4}
                      maxLength={MAX_FIELD}
                      onChange={(e) => setContent({ ...content, [f.key]: e.target.value })}
                    />
                  )}
                </label>
              ))}
            </div>
          </section>
        ))}
        {saveMsg && <p className={saveMsg.ok ? 'msg ok' : 'msg error'} role="status">{saveMsg.text}</p>}
        <div className="actions">
          <button className="btn" disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => window.print()}>
            PDF로 저장 / 인쇄
          </button>
        </div>
      </form>

      <section className="card print-doc" aria-label="인쇄 미리보기">
        <h2>{profile?.name} · {jobTitle || '포트폴리오'}</h2>
        {content.headline && <p className="print-headline">{content.headline}</p>}
        {SECTIONS.map((section) => {
          const filled = section.fields.filter((f) => (content[f.key] ?? '').trim() !== '' && f.key !== 'headline')
          const showCerts = section.title === '경력 및 활동' && certs.length > 0
          if (filled.length === 0 && !showCerts) return null
          return (
            <div key={section.title} className="print-section">
              <h3>{section.title}</h3>
              {filled.map((f) => (
                <div key={f.key}>
                  <h4>{f.label}</h4>
                  <p className="decision-text">{content[f.key]}</p>
                </div>
              ))}
              {showCerts && (
                <div>
                  <h4>자격증</h4>
                  <ul className="print-certs">
                    {certs.map((c) => (
                      <li key={c.id}>
                        {c.title}
                        {[c.issuer, c.acquired_date].filter(Boolean).length > 0 && ` (${[c.issuer, c.acquired_date].filter(Boolean).join(' · ')})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </section>
    </>
  )
}
