import { useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useDialog } from '../components/dialog-context'
import { useLayoutContext } from '../components/layout-context'
import PostProgress from '../components/PostProgress'
import { addDays } from '../lib/calendar'
import {
  POST_STATUSES,
  POST_TYPES,
  TYPE_COLOR,
  TYPE_LABEL,
  formatKst,
  fromKstLocal,
  isOpen,
  isSafeUrl,
  kstDateStr,
  kstTimeStr,
  mondayOf,
  summarizeWeek,
  tightGaps,
  toKstLocal,
  todayKst,
  weekDates,
  type ContentPost,
  type PostStatus,
  type PostType,
} from '../lib/contentPlanner'
import { useContentData } from '../lib/useContentData'
import { useElementWidth } from '../lib/useElementWidth'

interface PostForm {
  title: string
  type: PostType
  /** 게시 예정일시(한국 시간) 'YYYY-MM-DDTHH:mm' */
  when: string
  assignee: string
  status: PostStatus
  reviewDone: boolean
  caption: string
  url: string
}

const WEEKDAYS_MON = ['월', '화', '수', '목', '금', '토', '일']

const emptyForm = (date: string): PostForm => ({
  title: '',
  type: 'card_news',
  when: `${date}T18:00`,
  assignee: '',
  status: 'planning',
  reviewDone: false,
  caption: '',
  url: '',
})

const shortDate = (date: string) => {
  const [, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일`
}

/** 활동 일정 > 콘텐츠 플래너: 동아리 공용 인스타그램 게시 일정. 만들기·수정·삭제는 임원진, 담당자는 자기 게시물의 상태·검토만. */
export default function ContentPlanner() {
  const { alumni } = useLayoutContext()
  const { profile } = useAuth()
  const dialog = useDialog()
  // 화면 편의용 판단이다. 실제 권한은 DB(can_manage_content)가 막는다.
  const canManage = profile?.role === 'officer'
  const meId = profile?.id ?? ''
  const { posts, names, assignable, loading, error, reload } = useContentData(!alumni)

  const [weekStart, setWeekStart] = useState(() => mondayOf(todayKst()))
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [form, setForm] = useState<PostForm | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)
  const gridWidth = useElementWidth(gridRef)
  const compact = gridWidth < 600

  if (alumni) {
    return (
      <section className="card">
        <h2>콘텐츠 플래너</h2>
        <p>졸업생에게는 제공되지 않는 화면입니다.</p>
      </section>
    )
  }

  const today = todayKst()
  const summary = summarizeWeek(posts, weekStart)
  const gaps = tightGaps(posts)
  const dates = weekDates(weekStart)
  const byDate = new Map<string, ContentPost[]>()
  for (const p of posts) {
    const date = kstDateStr(p.scheduled_at)
    byDate.set(date, [...(byDate.get(date) ?? []), p])
  }
  const listed = onlyOpen ? posts.filter(isOpen) : posts
  const assigneeName = (p: ContentPost) =>
    p.assignee_id ? (names.get(p.assignee_id) ?? '탈퇴한 부원') : '담당자 없음'
  // 현재 담당자가 졸업생이라 고를 수 없는 경우를 알리기 위해
  const editingPost = editingId === null ? null : (posts.find((p) => p.id === editingId) ?? null)
  const assigneeGone =
    editingPost?.assignee_id != null && !assignable.some((x) => x.id === editingPost.assignee_id)

  function openAdd(date: string) {
    setEditingId(null)
    setFormError(null)
    setForm(emptyForm(date))
  }

  function openEdit(p: ContentPost) {
    setEditingId(p.id)
    setFormError(null)
    setForm({
      title: p.title,
      type: p.post_type,
      when: toKstLocal(p.scheduled_at),
      assignee: p.assignee_id && assignable.some((x) => x.id === p.assignee_id) ? p.assignee_id : '',
      status: p.status,
      reviewDone: p.review_done,
      caption: p.caption ?? '',
      url: p.material_url ?? '',
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
    const scheduledAt = fromKstLocal(form.when)
    const url = form.url.trim()
    if (title.length < 1 || title.length > 200) return setFormError('제목은 1~200자로 입력해 주세요.')
    if (!scheduledAt) return setFormError('게시 예정일시를 입력해 주세요.')
    if (form.caption.length > 2200) return setFormError('캡션은 2200자 이하로 입력해 주세요.')
    if (url && (!isSafeUrl(url) || url.length > 500)) {
      return setFormError('자료 링크는 http:// 또는 https://로 시작하는 500자 이하 주소로 입력해 주세요.')
    }
    setFormError(null)
    setSaving(true)
    const values = {
      title,
      post_type: form.type,
      scheduled_at: scheduledAt,
      assignee_id: form.assignee || null,
      status: form.status,
      review_done: form.reviewDone,
      caption: form.caption.trim() || null,
      material_url: url || null,
    }
    // 권한이 없으면 오류 없이 0행이 바뀌므로, 바뀐 행이 있는지로 성공을 판단한다
    const result =
      editingId === null
        ? await supabase.from('content_posts').insert(values).select('id')
        : await supabase.from('content_posts').update(values).eq('id', editingId).select('id')
    setSaving(false)
    if (result.error || (result.data?.length ?? 0) === 0) {
      return setFormError('저장하지 못했습니다. 권한을 확인하고, 담당자가 졸업생이면 다시 지정해 주세요.')
    }
    closeForm()
    await reload()
  }

  async function remove(p: ContentPost) {
    const ok = await dialog.confirm({
      title: '콘텐츠 삭제',
      message: `"${p.title}" 게시물을 삭제할까요?\n되돌릴 수 없습니다.`,
      confirmLabel: '삭제',
      danger: true,
    })
    if (!ok) return
    setActionError(null)
    setBusyId(p.id)
    const { data, error: err } = await supabase.from('content_posts').delete().eq('id', p.id).select('id')
    setBusyId(null)
    if (err || (data?.length ?? 0) === 0) return setActionError('삭제하지 못했습니다. 권한을 확인해 주세요.')
    if (editingId === p.id) closeForm()
    await reload()
  }

  /** 보이는 목록에서 인접한 두 게시물의 게시 예정일시를 서로 바꾼다 */
  async function swap(a: ContentPost, b: ContentPost) {
    setActionError(null)
    setBusyId(a.id)
    const { error: err } = await supabase.rpc('swap_post_times', { p_a: a.id, p_b: b.id })
    setBusyId(null)
    if (err) return setActionError('순서를 바꾸지 못했습니다. 권한을 확인해 주세요.')
    await reload()
  }

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h2>콘텐츠 플래너</h2>
          {canManage && !form && (
            <button className="btn btn-sm" onClick={() => openAdd(today)}>
              + 콘텐츠 추가
            </button>
          )}
        </div>
        <p className="hint">인스타그램 게시 일정을 함께 관리해요. 게시 예정일시는 한국 시간 기준이에요.</p>

        {form && (
          <form className="form" onSubmit={save} style={{ marginTop: 12 }}>
            <label>
              제목
              <input value={form.title} maxLength={200} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </label>
            <label>
              유형
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PostType })}>
                {POST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              게시 예정일시 (한국 시간)
              <input type="datetime-local" value={form.when} onChange={(e) => setForm({ ...form, when: e.target.value })} required />
            </label>
            <label>
              담당자
              <select value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
                <option value="">담당자 없음</option>
                {assignable.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>
            {assigneeGone && (
              <p className="hint">현재 담당자는 졸업생이라 고를 수 없어요. 새 담당자를 지정해 주세요.</p>
            )}
            <label>
              게시 상태
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PostStatus })}>
                {POST_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              검토
              <select value={form.reviewDone ? 'done' : 'pending'} onChange={(e) => setForm({ ...form, reviewDone: e.target.value === 'done' })}>
                <option value="pending">대기</option>
                <option value="done">완료</option>
              </select>
            </label>
            <label>
              캡션 (선택)
              <textarea value={form.caption} maxLength={2200} rows={4} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
            </label>
            <label>
              자료 링크 (선택)
              <input type="url" value={form.url} maxLength={500} placeholder="https://" onChange={(e) => setForm({ ...form, url: e.target.value })} />
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
      {error && <p className="msg error" role="alert">{error}</p>}

      <section className="card">
        <div className="section-head">
          <h2>
            {shortDate(weekStart)} ~ {shortDate(addDays(weekStart, 6))}
          </h2>
          <div className="cal-nav">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="이전 주">
              ‹
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setWeekStart(mondayOf(today))}>
              이번 주
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="다음 주">
              ›
            </button>
          </div>
        </div>
        <p className="hint">
          이 주 게시물 {summary.total}건 · {POST_TYPES.map((t) => `${t.label} ${summary.byType[t.value]}`).join(' · ')}
        </p>
        {summary.crowded.length > 0 && (
          <p className="hint warn-text" role="status">
            <span className="badge warn">과밀</span> {summary.crowded.join(', ')}. 게시 일정을 나눠 보세요.
          </p>
        )}

        <div ref={gridRef}>
          <div className={compact ? 'week-grid list' : 'week-grid'}>
            {dates.map((date, i) => {
              const day = byDate.get(date) ?? []
              return (
                <div key={date} className={date === today ? 'week-day today' : 'week-day'}>
                  <div className="week-day-head">
                    <span className={i === 5 ? 'week-day-btn sat' : i === 6 ? 'week-day-btn sun' : 'week-day-btn'}>
                      {WEEKDAYS_MON[i]} {Number(date.slice(8))}
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost week-add"
                        onClick={() => openAdd(date)}
                        aria-label={`${shortDate(date)} 콘텐츠 추가`}
                      >
                        +
                      </button>
                    )}
                  </div>
                  {day.length === 0
                    ? compact && <p className="week-empty">게시물 없음</p>
                    : day.map((p) => (
                        <div key={p.id} className="week-ev" style={{ background: TYPE_COLOR[p.post_type] }}>
                          <small>
                            {kstTimeStr(p.scheduled_at)} · {TYPE_LABEL[p.post_type]}
                          </small>
                          <strong>{p.title}</strong>
                          <small>{assigneeName(p)}</small>
                        </div>
                      ))}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>콘텐츠 목록</h2>
          <button
            type="button"
            className={onlyOpen ? 'chip on' : 'chip'}
            aria-pressed={onlyOpen}
            onClick={() => setOnlyOpen((v) => !v)}
          >
            미완료만
          </button>
        </div>
        {loading ? (
          <p>불러오는 중...</p>
        ) : listed.length === 0 ? (
          <p>{posts.length === 0 ? '아직 등록된 콘텐츠가 없습니다.' : '미완료 콘텐츠가 없습니다.'}</p>
        ) : (
          <div className="post-list">
            {listed.map((p, idx) => {
              const gap = gaps.get(p.id)
              const prev = listed[idx - 1]
              const next = listed[idx + 1]
              return (
                <div key={p.id} className="post-item">
                  <div className="section-head">
                    <h3 className="post-title">{p.title}</h3>
                    <span className="badge" style={{ background: TYPE_COLOR[p.post_type], color: '#fff' }}>
                      {TYPE_LABEL[p.post_type]}
                    </span>
                  </div>
                  <p className="hint">
                    {formatKst(p.scheduled_at)} · {assigneeName(p)}
                  </p>
                  {gap && (
                    <p className="hint warn-text" role="status">
                      <span className="badge warn">간격 조정</span> {gap.join(', ')} (24시간 미만)
                    </p>
                  )}
                  <PostProgress post={p} meId={meId} canManage={canManage} onChanged={reload} onError={setActionError} />
                  {p.caption && <p className="decision-text hint">{p.caption}</p>}
                  {isSafeUrl(p.material_url) && (
                    <a href={p.material_url} target="_blank" rel="noopener noreferrer" className="hint">
                      자료 링크 열기
                    </a>
                  )}
                  {canManage && (
                    <div className="actions">
                      <button className="btn btn-sm btn-ghost" disabled={busyId === p.id || !prev} onClick={() => prev && swap(p, prev)}>
                        앞으로
                      </button>
                      <button className="btn btn-sm btn-ghost" disabled={busyId === p.id || !next} onClick={() => next && swap(p, next)}>
                        뒤로
                      </button>
                      <button className="btn btn-sm btn-ghost" disabled={busyId === p.id} onClick={() => openEdit(p)}>
                        수정
                      </button>
                      <button className="btn btn-sm btn-ghost btn-danger" disabled={busyId === p.id} onClick={() => remove(p)}>
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
