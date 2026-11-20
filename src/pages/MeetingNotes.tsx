import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useDialog } from '../components/dialog-context'
import { weekdayKo } from '../lib/calendar'
import { authorName, formatDateTime } from '../lib/agendas'

interface MeetingNote {
  id: number
  title: string
  meeting_date: string
  body: string
  created_at: string
  updated_at: string
  profiles: { name: string; status: string } | null
}

interface Form {
  title: string
  date: string
  body: string
}

const COLUMNS = 'id, title, meeting_date, body, created_at, updated_at, profiles(name, status)'

const todayStr = () => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD' → "2026.11.20 (금)" */
const dateLabel = (date: string) => `${date.replaceAll('-', '.')} (${weekdayKo(date)})`

/** 활동 일정 > 회의 변경 이력: 회의에서 합의한 사항을 적어 두는 회의록. 읽기는 모두, 쓰기는 임원진만. */
export default function MeetingNotes() {
  const { profile } = useAuth()
  const dialog = useDialog()
  const isOfficer = profile?.role === 'officer'

  const [notes, setNotes] = useState<MeetingNote[]>([])
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
      .from('meeting_notes')
      .select(COLUMNS)
      .order('meeting_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) {
      setLoadError('회의 내용을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } else {
      setLoadError(null)
      setNotes(data as unknown as MeetingNote[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  function openAdd() {
    setEditingId(null)
    setFormError(null)
    setForm({ title: '', date: todayStr(), body: '' })
  }

  function openEdit(n: MeetingNote) {
    setEditingId(n.id)
    setFormError(null)
    setForm({ title: n.title, date: n.meeting_date, body: n.body })
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
    const body = form.body.trim()
    if (title.length < 1 || title.length > 100) return setFormError('제목은 1~100자로 입력해 주세요.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setFormError('회의 날짜를 선택해 주세요.')
    if (body.length < 1 || body.length > 5000) return setFormError('내용은 1~5000자로 입력해 주세요.')
    setFormError(null)
    setSaving(true)
    const values = { title, meeting_date: form.date, body }
    // 수정은 지워진 행이 아니라 바뀐 행이 있는지로 성공을 판단한다(권한이 없으면 오류 없이 0행이 바뀐다)
    const result =
      editingId === null
        ? await supabase.from('meeting_notes').insert(values).select('id')
        : await supabase.from('meeting_notes').update(values).eq('id', editingId).select('id')
    setSaving(false)
    if (result.error || (result.data?.length ?? 0) === 0) {
      return setFormError('저장하지 못했습니다. 임원진 권한을 확인해 주세요.')
    }
    closeForm()
    await load()
  }

  async function remove(n: MeetingNote) {
    const ok = await dialog.confirm({
      title: '회의 내용 삭제',
      message: `"${n.title}" 회의 내용을 삭제할까요?\n되돌릴 수 없습니다.`,
      confirmLabel: '삭제',
      danger: true,
    })
    if (!ok) return
    setActionError(null)
    setBusyId(n.id)
    const { data, error } = await supabase.from('meeting_notes').delete().eq('id', n.id).select('id')
    setBusyId(null)
    if (error || (data?.length ?? 0) === 0) return setActionError('삭제하지 못했습니다. 임원진 권한을 확인해 주세요.')
    if (editingId === n.id) closeForm()
    await load()
  }

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h2>회의 변경 이력</h2>
          {isOfficer && !form && (
            <button className="btn btn-sm" onClick={openAdd}>
              + 회의 내용 기록
            </button>
          )}
        </div>
        <p className="hint">회의에서 합의한 사항과 콘텐츠 변경 내용을 확인하세요.</p>

        {form && (
          <form className="form" onSubmit={save} style={{ marginTop: 12 }}>
            <label>
              제목
              <input value={form.title} maxLength={100} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </label>
            <label>
              회의 날짜
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </label>
            <label>
              내용
              <textarea value={form.body} maxLength={5000} rows={8} onChange={(e) => setForm({ ...form, body: e.target.value })} required />
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
      {loading ? (
        <section className="card"><p>불러오는 중...</p></section>
      ) : notes.length === 0 ? (
        <section className="card"><p>아직 기록된 회의 내용이 없습니다.</p></section>
      ) : (
        notes.map((n) => (
          <section key={n.id} className="card">
            <div className="section-head">
              <h2>{n.title}</h2>
              <span className="badge muted">{dateLabel(n.meeting_date)}</span>
            </div>
            <p className="decision-text">{n.body}</p>
            <p className="hint">
              {authorName(n.profiles)} · {formatDateTime(n.created_at)}
              {n.updated_at !== n.created_at && Date.parse(n.updated_at) - Date.parse(n.created_at) > 1000 && ' · 수정됨'}
            </p>
            {isOfficer && (
              <div className="actions">
                <button className="btn btn-sm btn-ghost" disabled={busyId === n.id} onClick={() => openEdit(n)}>
                  수정
                </button>
                <button className="btn btn-sm btn-ghost btn-danger" disabled={busyId === n.id} onClick={() => remove(n)}>
                  삭제
                </button>
              </div>
            )}
          </section>
        ))
      )}
    </>
  )
}
