import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useDialog } from '../components/dialog-context'

type Kind = 'contest' | 'project'

interface Project {
  id: number
  title: string
  kind: Kind
  description: string | null
  progress: number
  start_date: string | null
  due_date: string | null
}

interface Member {
  project_id: number
  user_id: string
  role_text: string | null
}

interface Person {
  id: string
  name: string
}

interface Form {
  title: string
  kind: Kind
  description: string
  progress: string
  start: string
  due: string
}

const KIND_LABEL: Record<Kind, string> = { contest: '공모전', project: '프로젝트' }
const emptyForm: Form = { title: '', kind: 'project', description: '', progress: '0', start: '', due: '' }

const dateLabel = (d: string | null) => (d ? d.replaceAll('-', '.') : '')
const periodText = (p: Project) =>
  p.start_date || p.due_date ? `${dateLabel(p.start_date) || '?'} ~ ${dateLabel(p.due_date) || '?'}` : ''

interface CardProps {
  project: Project
  members: Member[]
  people: Person[]
  meId: string
  isOfficer: boolean
  onChanged: () => void
  onEdit: (p: Project) => void
  onDelete: (p: Project) => void
  onError: (message: string | null) => void
}

/** 프로젝트 한 개: 진행률, 참여 부원과 역할. 내 역할은 본인이, 참여 부원 추가·삭제는 임원진이 바꾼다. */
function ProjectCard({ project, members, people, meId, isOfficer, onChanged, onEdit, onDelete, onError }: CardProps) {
  const nameOf = (id: string) => people.find((x) => x.id === id)?.name ?? '탈퇴한 부원'
  const mine = members.find((m) => m.user_id === meId)
  const [role, setRole] = useState(mine?.role_text ?? '')
  const [newUser, setNewUser] = useState('')
  const [newRole, setNewRole] = useState('')
  const [busy, setBusy] = useState(false)
  const candidates = people.filter((x) => !members.some((m) => m.user_id === x.id))

  async function saveMyRole() {
    const value = role.trim()
    if (value.length > 100) return onError('내 역할은 100자 이하로 입력해 주세요.')
    onError(null)
    setBusy(true)
    const { data, error } = await supabase
      .from('project_members')
      .update({ role_text: value || null })
      .eq('project_id', project.id)
      .eq('user_id', meId)
      .select('user_id')
    setBusy(false)
    if (error || (data?.length ?? 0) === 0) return onError('내 역할을 저장하지 못했습니다. 이 프로젝트에 참여 중인지 확인해 주세요.')
    onChanged()
  }

  async function addMember() {
    if (!newUser) return onError('참여시킬 부원을 골라 주세요.')
    if (newRole.length > 100) return onError('역할은 100자 이하로 입력해 주세요.')
    onError(null)
    setBusy(true)
    const { data, error } = await supabase
      .from('project_members')
      .insert({ project_id: project.id, user_id: newUser, role_text: newRole.trim() || null })
      .select('user_id')
    setBusy(false)
    if (error || (data?.length ?? 0) === 0) return onError('참여 부원을 추가하지 못했습니다. 임원진 권한을 확인해 주세요.')
    setNewUser('')
    setNewRole('')
    onChanged()
  }

  async function removeMember(userId: string) {
    onError(null)
    setBusy(true)
    const { data, error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', project.id)
      .eq('user_id', userId)
      .select('user_id')
    setBusy(false)
    if (error || (data?.length ?? 0) === 0) return onError('참여 부원을 내보내지 못했습니다. 임원진 권한을 확인해 주세요.')
    onChanged()
  }

  return (
    <section className="card">
      <div className="section-head">
        <h2>{project.title}</h2>
        <span className="badge muted">{KIND_LABEL[project.kind]}</span>
      </div>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={project.progress} aria-label="진행률">
        <i style={{ width: `${project.progress}%` }} />
      </div>
      <p className="hint">
        진행률 {project.progress}%{periodText(project) && ` · ${periodText(project)}`}
      </p>
      {project.description && <p className="decision-text">{project.description}</p>}

      <h3 className="project-sub">참여 부원 ({members.length})</h3>
      {members.length === 0 ? (
        <p className="hint">아직 참여 부원이 없어요.</p>
      ) : (
        <ul className="list">
          {members.map((m) => (
            <li key={m.user_id}>
              <span className="name">
                {nameOf(m.user_id)}
                {m.user_id === meId && <span className="badge muted">나</span>}
                <span className="hint" style={{ display: 'block' }}>{m.role_text || '역할 미정'}</span>
              </span>
              {isOfficer && (
                <span className="row-actions">
                  <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => removeMember(m.user_id)}>
                    내보내기
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {mine && (
        <div className="form" style={{ marginTop: 8 }}>
          <label>
            내 역할
            <input value={role} maxLength={100} placeholder="예: 기획, 디자인" onChange={(e) => setRole(e.target.value)} />
          </label>
          <div className="actions">
            <button className="btn btn-sm" disabled={busy} onClick={saveMyRole}>
              내 역할 저장
            </button>
          </div>
        </div>
      )}

      {isOfficer && (
        <div className="form" style={{ marginTop: 8 }}>
          <label>
            참여 부원 추가
            <select value={newUser} onChange={(e) => setNewUser(e.target.value)}>
              <option value="">부원 선택</option>
              {candidates.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            역할 (선택)
            <input value={newRole} maxLength={100} onChange={(e) => setNewRole(e.target.value)} />
          </label>
          <div className="actions">
            <button className="btn btn-sm" disabled={busy || !newUser} onClick={addMember}>
              추가
            </button>
            <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => onEdit(project)}>
              프로젝트 수정
            </button>
            <button className="btn btn-sm btn-ghost btn-danger" disabled={busy} onClick={() => onDelete(project)}>
              삭제
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** 활동 기록 > 공모전·프로젝트: 진행 중인 공모전과 프로젝트의 진행률, 참여 부원과 역할. 읽기는 모두, 만들기·수정·참여 관리는 임원진. */
export default function Projects() {
  const { profile } = useAuth()
  const dialog = useDialog()
  const isOfficer = profile?.role === 'officer'
  const meId = profile?.id ?? ''

  const [projects, setProjects] = useState<Project[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [form, setForm] = useState<Form | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [p, m, ppl] = await Promise.all([
      supabase
        .from('projects')
        .select('id, title, kind, description, progress, start_date, due_date')
        .order('created_at', { ascending: false }),
      supabase.from('project_members').select('project_id, user_id, role_text'),
      supabase.from('profiles').select('id, name').eq('status', 'approved').order('name'),
    ])
    if (p.error || m.error || ppl.error) {
      setLoadError('공모전·프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } else {
      setLoadError(null)
      setProjects(p.data as Project[])
      setMembers(m.data as Member[])
      setPeople(ppl.data as Person[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  function openEdit(p: Project) {
    setEditingId(p.id)
    setFormError(null)
    setForm({
      title: p.title,
      kind: p.kind,
      description: p.description ?? '',
      progress: String(p.progress),
      start: p.start_date ?? '',
      due: p.due_date ?? '',
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
    const progress = Number(form.progress)
    if (title.length < 1 || title.length > 200) return setFormError('이름은 1~200자로 입력해 주세요.')
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) return setFormError('진행률은 0~100 사이의 정수로 입력해 주세요.')
    if (form.description.length > 2000) return setFormError('설명은 2000자 이하로 입력해 주세요.')
    if (form.start && form.due && form.due < form.start) return setFormError('마감일이 시작일보다 빠를 수 없어요.')
    setFormError(null)
    setSaving(true)
    const values = {
      title,
      kind: form.kind,
      description: form.description.trim() || null,
      progress,
      start_date: form.start || null,
      due_date: form.due || null,
    }
    const result =
      editingId === null
        ? await supabase.from('projects').insert(values).select('id')
        : await supabase.from('projects').update(values).eq('id', editingId).select('id')
    setSaving(false)
    if (result.error || (result.data?.length ?? 0) === 0) return setFormError('저장하지 못했습니다. 임원진 권한을 확인해 주세요.')
    closeForm()
    await load()
  }

  async function remove(p: Project) {
    const ok = await dialog.confirm({
      title: '삭제',
      message: `"${p.title}"을(를) 삭제할까요?\n참여 부원 정보도 함께 지워지고 되돌릴 수 없습니다.`,
      confirmLabel: '삭제',
      danger: true,
    })
    if (!ok) return
    setActionError(null)
    const { data, error } = await supabase.from('projects').delete().eq('id', p.id).select('id')
    if (error || (data?.length ?? 0) === 0) return setActionError('삭제하지 못했습니다. 임원진 권한을 확인해 주세요.')
    if (editingId === p.id) closeForm()
    await load()
  }

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h2>공모전 · 프로젝트</h2>
          {isOfficer && !form && (
            <button className="btn btn-sm" onClick={() => { setEditingId(null); setFormError(null); setForm(emptyForm) }}>
              + 추가
            </button>
          )}
        </div>
        <p className="hint">진행 중인 공모전과 프로젝트의 진행률, 참여 부원과 맡은 역할을 확인하세요.</p>

        {form && (
          <form className="form" onSubmit={save} style={{ marginTop: 12 }}>
            <label>
              이름
              <input value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </label>
            <label>
              종류
              <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
                <option value="project">프로젝트</option>
                <option value="contest">공모전</option>
              </select>
            </label>
            <label>
              진행률 (0~100)
              <input type="number" min={0} max={100} step={1} value={form.progress} onChange={(e) => setForm({ ...form, progress: e.target.value })} required />
            </label>
            <label>
              시작일 (선택)
              <input type="date" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
            </label>
            <label>
              마감일 (선택)
              <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
            </label>
            <label>
              설명 (선택)
              <textarea value={form.description} maxLength={2000} rows={4} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            {formError && <p className="msg error" role="alert">{formError}</p>}
            <div className="actions">
              <button className="btn" disabled={saving}>{saving ? '저장 중...' : editingId === null ? '추가하기' : '수정 저장'}</button>
              <button type="button" className="btn btn-ghost" onClick={closeForm}>취소</button>
            </div>
          </form>
        )}
      </section>

      {actionError && <p className="msg error" role="alert">{actionError}</p>}
      {loadError && <p className="msg error" role="alert">{loadError}</p>}
      {loading ? (
        <section className="card"><p>불러오는 중...</p></section>
      ) : projects.length === 0 ? (
        <section className="card"><p>아직 등록된 공모전·프로젝트가 없습니다.</p></section>
      ) : (
        <div className="card-grid">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              members={members.filter((m) => m.project_id === p.id)}
              people={people}
              meId={meId}
              isOfficer={isOfficer}
              onChanged={load}
              onEdit={openEdit}
              onDelete={remove}
              onError={setActionError}
            />
          ))}
        </div>
      )}
    </>
  )
}
