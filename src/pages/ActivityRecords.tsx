import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useDialog } from '../components/dialog-context'
import { RECORD_COLUMNS, periodLabel, type ActivityRecord } from '../lib/activityRecords'

interface Form {
  title: string
  category: string
  role: string
  description: string
  outcome: string
  started: string
  ended: string
}

const emptyForm: Form = { title: '', category: '', role: '', description: '', outcome: '', started: '', ended: '' }

/** 활동 기록 > 활동 기록: 내가 한 활동을 적어 두는 곳(본인만 보임). 포트폴리오 문장을 만들 때 쓴다. */
export default function ActivityRecords() {
  const dialog = useDialog()
  const [records, setRecords] = useState<ActivityRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [form, setForm] = useState<Form | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('activity_records')
      .select(RECORD_COLUMNS)
      .order('started_on', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) setLoadError('활동 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    else {
      setLoadError(null)
      setRecords(data as ActivityRecord[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  function openEdit(r: ActivityRecord) {
    setEditingId(r.id)
    setFormError(null)
    setForm({
      title: r.title,
      category: r.category ?? '',
      role: r.role_text ?? '',
      description: r.description ?? '',
      outcome: r.outcome ?? '',
      started: r.started_on ?? '',
      ended: r.ended_on ?? '',
    })
  }

  function closeForm() {
    setForm(null)
    setEditingId(null)
    setFormError(null)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const title = form.title.trim()
    if (title.length < 1 || title.length > 200) return setFormError('활동 이름은 1~200자로 입력해 주세요.')
    if (form.category.length > 100) return setFormError('분류는 100자 이하로 입력해 주세요.')
    if (form.role.length > 200) return setFormError('내 역할은 200자 이하로 입력해 주세요.')
    if (form.description.length > 4000) return setFormError('활동 내용은 4000자 이하로 입력해 주세요.')
    if (form.outcome.length > 2000) return setFormError('결과는 2000자 이하로 입력해 주세요.')
    if (form.started && form.ended && form.ended < form.started) return setFormError('끝난 날이 시작한 날보다 빠를 수 없어요.')
    setFormError(null)
    setSaving(true)
    const values = {
      title,
      category: form.category.trim() || null,
      role_text: form.role.trim() || null,
      description: form.description.trim() || null,
      outcome: form.outcome.trim() || null,
      started_on: form.started || null,
      ended_on: form.ended || null,
    }
    const result =
      editingId === null
        ? await supabase.from('activity_records').insert(values).select('id')
        : await supabase.from('activity_records').update(values).eq('id', editingId).select('id')
    setSaving(false)
    if (result.error || (result.data?.length ?? 0) === 0) return setFormError('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    closeForm()
    await load()
  }

  async function remove(r: ActivityRecord) {
    const ok = await dialog.confirm({
      title: '활동 기록 삭제',
      message: `"${r.title}" 기록을 삭제할까요?\n되돌릴 수 없습니다.`,
      confirmLabel: '삭제',
      danger: true,
    })
    if (!ok) return
    setActionError(null)
    setBusyId(r.id)
    const { data, error } = await supabase.from('activity_records').delete().eq('id', r.id).select('id')
    setBusyId(null)
    if (error || (data?.length ?? 0) === 0) return setActionError('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    if (editingId === r.id) closeForm()
    await load()
  }

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h2>활동 기록 (나만 보임)</h2>
          {!form && (
            <button className="btn btn-sm" onClick={() => { setEditingId(null); setFormError(null); setForm(emptyForm) }}>
              + 활동 기록
            </button>
          )}
        </div>
        <p className="hint">내가 한 활동과 맡은 역할, 결과를 적어 두세요. 포트폴리오 문장을 만들 때 쓰여요. 다른 사람에게는 보이지 않아요.</p>

        {form && (
          <form className="form" onSubmit={save} style={{ marginTop: 12 }}>
            <label>
              활동 이름
              <input value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </label>
            <label>
              분류 (선택)
              <input value={form.category} maxLength={100} placeholder="예: 공모전, 동아리, 인턴" onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </label>
            <label>
              내 역할 (선택)
              <input value={form.role} maxLength={200} placeholder="예: 팀장, 디자인 담당" onChange={(e) => setForm({ ...form, role: e.target.value })} />
            </label>
            <label>
              시작한 날 (선택)
              <input type="date" value={form.started} onChange={(e) => setForm({ ...form, started: e.target.value })} />
            </label>
            <label>
              끝난 날 (선택)
              <input type="date" value={form.ended} onChange={(e) => setForm({ ...form, ended: e.target.value })} />
            </label>
            <label>
              한 일 (선택)
              <textarea value={form.description} maxLength={4000} rows={4} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label>
              결과 (선택)
              <textarea value={form.outcome} maxLength={2000} rows={3} placeholder="예: 참가자 120명 모집, 장려상" onChange={(e) => setForm({ ...form, outcome: e.target.value })} />
            </label>
            {formError && <p className="msg error" role="alert">{formError}</p>}
            <div className="actions">
              <button className="btn" disabled={saving}>{saving ? '저장 중...' : editingId === null ? '기록하기' : '수정 저장'}</button>
              <button type="button" className="btn btn-ghost" onClick={closeForm}>취소</button>
            </div>
          </form>
        )}
      </section>

      {actionError && <p className="msg error" role="alert">{actionError}</p>}
      {loadError && <p className="msg error" role="alert">{loadError}</p>}

      <section className="card">
        <h2>내 활동 {!loading && !loadError && `(${records.length})`}</h2>
        {loading ? (
          <p>불러오는 중...</p>
        ) : records.length === 0 ? (
          <p>아직 적은 활동 기록이 없습니다.</p>
        ) : (
          <div className="post-list">
            {records.map((r) => (
              <div key={r.id} className="post-item">
                <div className="section-head">
                  <h3 className="post-title">{r.title}</h3>
                  {r.category && <span className="badge muted">{r.category}</span>}
                </div>
                <p className="hint">
                  {[periodLabel(r), r.role_text && `역할: ${r.role_text}`].filter(Boolean).join(' · ')}
                </p>
                {r.description && <p className="decision-text">{r.description}</p>}
                {r.outcome && <p className="decision-text hint">결과: {r.outcome}</p>}
                <div className="actions">
                  <button className="btn btn-sm btn-ghost" disabled={busyId === r.id} onClick={() => openEdit(r)}>
                    수정
                  </button>
                  <button className="btn btn-sm btn-ghost btn-danger" disabled={busyId === r.id} onClick={() => remove(r)}>
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
