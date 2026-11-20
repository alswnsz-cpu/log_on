import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useDialog } from '../components/dialog-context'
import { DEFAULT_JOBS, SECTIONS, cleanContent, type Content } from '../lib/portfolioFields'

interface DocRow {
  id: number
  job_title: string
  updated_at: string
  legacy_user_id: string | null
}

interface Cert {
  id: string
  title: string
  issuer: string | null
  acquired_date: string | null
  details: string | null
}

const CUSTOM = '__custom__'

/** 예전 포트폴리오(portfolios)에 내용이 한 칸이라도 있는지 */
function hasText(content: Content | null): content is Content {
  return content !== null && Object.values(content).some((v) => typeof v === 'string' && v.trim() !== '')
}

/** 내 포트폴리오: 직무별 문서 목록과 자격증. 본인만 보고 고친다(임원진도 다른 사람 것은 볼 수 없다). */
export default function Portfolio() {
  const { session } = useAuth()
  const dialog = useDialog()
  const navigate = useNavigate()
  const myId = session!.user.id

  const [docs, setDocs] = useState<DocRow[]>([])
  const [legacy, setLegacy] = useState<Content | null>(null)
  const [certs, setCerts] = useState<Cert[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [jobChoice, setJobChoice] = useState(DEFAULT_JOBS[0])
  const [customJob, setCustomJob] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [certForm, setCertForm] = useState({ title: '', issuer: '', date: '', details: '' })

  const load = useCallback(async () => {
    const [d, p, c] = await Promise.all([
      supabase
        .from('portfolio_documents')
        .select('id, job_title, updated_at, legacy_user_id')
        .eq('user_id', myId)
        .order('updated_at', { ascending: false }),
      supabase.from('portfolios').select('content').eq('user_id', myId).maybeSingle(),
      supabase
        .from('certifications')
        .select('id, title, issuer, acquired_date, details')
        .eq('user_id', myId)
        .order('created_at', { ascending: false }),
    ])
    if (d.error || p.error || c.error) {
      setLoadError('포트폴리오를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } else {
      setLoadError(null)
      setDocs(d.data as DocRow[])
      setLegacy((p.data?.content ?? null) as Content | null)
      setCerts(c.data as Cert[])
    }
    setLoading(false)
  }, [myId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  /** 새 문서를 만들고 편집 화면으로 간다 */
  async function create(e: FormEvent) {
    e.preventDefault()
    const job = (jobChoice === CUSTOM ? customJob : jobChoice).trim()
    if (job.length < 1 || job.length > 100) return setError('직무 이름은 1~100자로 입력해 주세요.')
    setError(null)
    setBusy(true)
    const { data, error: err } = await supabase.from('portfolio_documents').insert({ job_title: job, content: {} }).select('id')
    setBusy(false)
    if (err || !data || data.length === 0) return setError('포트폴리오를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.')
    navigate(`/portfolio/${data[0].id}`)
  }

  /** 예전 포트폴리오를 새 문서 하나로 가져온다(원본은 그대로 둔다) */
  async function importLegacy() {
    if (!hasText(legacy)) return
    setError(null)
    setBusy(true)
    const { data, error: err } = await supabase
      .from('portfolio_documents')
      .insert({ job_title: '기본 포트폴리오', content: cleanContent(legacy), legacy_user_id: myId })
      .select('id')
    setBusy(false)
    if (err || !data || data.length === 0) return setError('예전 포트폴리오를 가져오지 못했습니다. 이미 가져왔는지 확인해 주세요.')
    await load()
  }

  async function removeDoc(d: DocRow) {
    const ok = await dialog.confirm({
      title: '포트폴리오 삭제',
      message: `"${d.job_title}" 포트폴리오를 삭제할까요?\n되돌릴 수 없습니다.`,
      confirmLabel: '삭제',
      danger: true,
    })
    if (!ok) return
    setError(null)
    const { data, error: err } = await supabase.from('portfolio_documents').delete().eq('id', d.id).select('id')
    if (err || (data?.length ?? 0) === 0) return setError('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    await load()
  }

  async function addCert(e: FormEvent) {
    e.preventDefault()
    const title = certForm.title.trim()
    if (!title) return setError('자격증명을 입력해 주세요.')
    setError(null)
    const { error: err } = await supabase.from('certifications').insert({
      user_id: myId,
      title: title.slice(0, 200),
      issuer: certForm.issuer.trim().slice(0, 200) || null,
      acquired_date: certForm.date || null,
      details: certForm.details.trim().slice(0, 2000) || null,
    })
    if (err) return setError('자격증을 추가하지 못했습니다.')
    setCertForm({ title: '', issuer: '', date: '', details: '' })
    await load()
  }

  async function removeCert(c: Cert) {
    const ok = await dialog.confirm({ message: `"${c.title}"을(를) 삭제할까요?`, confirmLabel: '삭제', danger: true })
    if (!ok) return
    const { error: err } = await supabase.from('certifications').delete().eq('id', c.id).eq('user_id', myId)
    if (err) return setError('삭제하지 못했습니다.')
    setError(null)
    await load()
  }

  if (loading) return <section className="card"><p>불러오는 중...</p></section>

  const canImport = hasText(legacy) && !docs.some((d) => d.legacy_user_id !== null)
  // 칸 수 안내(문서 한 개에 들어가는 칸의 개수)
  const fieldCount = SECTIONS.reduce((n, s) => n + s.fields.length, 0)

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h2>내 포트폴리오</h2>
          {!creating && (
            <button className="btn btn-sm" onClick={() => { setError(null); setCreating(true) }}>
              + 직무별 포트폴리오
            </button>
          )}
        </div>
        <p className="hint">
          나만 볼 수 있습니다. 임원진도 다른 부원의 포트폴리오는 볼 수 없습니다. 직무마다 문서를 따로 만들어 {fieldCount}개 칸을 채우고, 활동 기록으로 문장을 만들 수 있어요.
        </p>
        {loadError && <p className="msg error" role="alert">{loadError}</p>}

        {creating && (
          <form className="form" onSubmit={create} style={{ marginTop: 12 }}>
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
                <input value={customJob} maxLength={100} onChange={(e) => setCustomJob(e.target.value)} required />
              </label>
            )}
            <div className="actions">
              <button className="btn" disabled={busy}>{busy ? '만드는 중...' : '만들기'}</button>
              <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>취소</button>
            </div>
          </form>
        )}
      </section>

      {error && <p className="msg error" role="alert">{error}</p>}

      {canImport && (
        <section className="card">
          <h2>예전 포트폴리오가 있어요</h2>
          <p className="hint">예전에 쓴 포트폴리오를 새 문서 하나로 가져올 수 있어요. 원래 내용은 그대로 남아요.</p>
          <div className="actions">
            <button className="btn btn-sm" disabled={busy} onClick={importLegacy}>
              예전 포트폴리오 가져오기
            </button>
          </div>
        </section>
      )}

      <section className="card">
        <h2>직무별 포트폴리오 {!loadError && `(${docs.length})`}</h2>
        {docs.length === 0 ? (
          <p className="hint">아직 만든 포트폴리오가 없어요. 위의 "+ 직무별 포트폴리오"로 시작해 보세요.</p>
        ) : (
          <div className="post-list">
            {docs.map((d) => (
              <div key={d.id} className="post-item">
                <div className="section-head">
                  <h3 className="post-title">{d.job_title}</h3>
                  {d.legacy_user_id && <span className="badge muted">예전 글</span>}
                </div>
                <p className="hint">마지막 수정 {d.updated_at.slice(0, 10).replaceAll('-', '.')}</p>
                <div className="actions">
                  <Link to={`/portfolio/${d.id}`} className="btn btn-sm">
                    열기
                  </Link>
                  <button className="btn btn-sm btn-ghost btn-danger" onClick={() => removeDoc(d)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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
                <button className="btn btn-danger btn-sm" onClick={() => removeCert(c)}>삭제</button>
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
          <p className="hint">활동은 이제 "활동 기록"에서 관리해요. 적어 둔 활동 기록으로 포트폴리오 문장을 만들 수 있어요.</p>
          <div className="actions">
            <Link to="/records" className="btn btn-sm btn-ghost">활동 기록으로 가기</Link>
          </div>
        </section>
      </div>
    </>
  )
}
