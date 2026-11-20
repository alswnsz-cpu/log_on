import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { useLayoutContext } from '../components/layout-context'
import PostProgress from '../components/PostProgress'
import { TYPE_COLOR, TYPE_LABEL, formatKst, isOpen, type ContentPost } from '../lib/contentPlanner'
import { useContentData } from '../lib/useContentData'

interface Group {
  id: string | null
  name: string
  open: ContentPost[]
  doneCount: number
}

/** 활동 일정 > 담당자별 업무: 담당자별로 미완료(게시 완료가 아닌) 콘텐츠를 모아 본다. */
export default function ContentTasks() {
  const { alumni } = useLayoutContext()
  const { profile } = useAuth()
  const canManage = profile?.role === 'officer'
  const meId = profile?.id ?? ''
  const { posts, names, assignable, loading, error, reload } = useContentData(!alumni)
  const [actionError, setActionError] = useState<string | null>(null)

  if (alumni) {
    return (
      <section className="card">
        <h2>담당자별 업무</h2>
        <p>졸업생에게는 제공되지 않는 화면입니다.</p>
      </section>
    )
  }

  // 담당자로 지정할 수 있는 사람 전체 + 게시물에 담당자로 적힌 사람(졸업·탈퇴 포함) + 담당자 없음
  const ids = new Set<string>(assignable.map((x) => x.id))
  for (const p of posts) if (p.assignee_id) ids.add(p.assignee_id)

  const groups: Group[] = [...ids].map((id) => {
    const mine = posts.filter((p) => p.assignee_id === id)
    return {
      id,
      name: names.get(id) ?? '탈퇴한 부원',
      open: mine.filter(isOpen),
      doneCount: mine.filter((p) => !isOpen(p)).length,
    }
  })
  const unassigned = posts.filter((p) => p.assignee_id === null)
  if (unassigned.length > 0) {
    groups.push({ id: null, name: '담당자 없음', open: unassigned.filter(isOpen), doneCount: unassigned.filter((p) => !isOpen(p)).length })
  }
  groups.sort((a, b) => b.open.length - a.open.length || a.name.localeCompare(b.name, 'ko'))

  return (
    <>
      <section className="card">
        <h2>담당자별 업무</h2>
        <p className="hint">담당자별 미완료(게시 완료가 아닌) 콘텐츠예요. 내 게시물은 상태와 검토를 바로 바꿀 수 있어요.</p>
      </section>

      {actionError && <p className="msg error" role="alert">{actionError}</p>}
      {error && <p className="msg error" role="alert">{error}</p>}

      {loading ? (
        <section className="card"><p>불러오는 중...</p></section>
      ) : groups.length === 0 ? (
        <section className="card"><p>아직 등록된 콘텐츠가 없습니다.</p></section>
      ) : (
        <div className="card-grid">
          {groups.map((g) => (
            <section key={g.id ?? 'none'} className="card">
              <div className="section-head">
                <h2>{g.name}</h2>
                <span className={g.open.length > 0 ? 'badge warn' : 'badge ok'}>미완료 {g.open.length}건</span>
              </div>
              {g.open.length === 0 ? (
                <p className="hint">미완료 콘텐츠가 없어요.{g.doneCount > 0 && ` (게시 완료 ${g.doneCount}건)`}</p>
              ) : (
                <div className="post-list">
                  {g.open.map((p) => (
                    <div key={p.id} className="post-item">
                      <div className="section-head">
                        <h3 className="post-title">{p.title}</h3>
                        <span className="badge" style={{ background: TYPE_COLOR[p.post_type], color: '#fff' }}>
                          {TYPE_LABEL[p.post_type]}
                        </span>
                      </div>
                      <p className="hint">{formatKst(p.scheduled_at)}</p>
                      <PostProgress post={p} meId={meId} canManage={canManage} onChanged={reload} onError={setActionError} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  )
}
