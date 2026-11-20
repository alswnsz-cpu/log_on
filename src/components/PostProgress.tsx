import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { POST_STATUSES, STATUS_LABEL, type ContentPost, type PostStatus } from '../lib/contentPlanner'

interface Props {
  post: ContentPost
  /** 내 계정 id */
  meId: string
  /** 콘텐츠 관리자(지금은 임원진) 여부. 화면 편의용이고 실제 권한은 DB 함수가 정한다. */
  canManage: boolean
  onChanged: () => void
  onError: (message: string | null) => void
}

/**
 * 게시 상태와 검토. 담당자 본인(과 콘텐츠 관리자)만 바꿀 수 있고, 그 밖의 사람에게는 글자로만 보여 준다.
 * 바꾸는 일은 DB 함수(set_post_progress)가 하며, 다른 칸은 바꿀 수 없다.
 */
export default function PostProgress({ post, meId, canManage, onChanged, onError }: Props) {
  const [busy, setBusy] = useState(false)
  const editable = canManage || post.assignee_id === meId

  async function apply(status: PostStatus, review: boolean) {
    onError(null)
    setBusy(true)
    const { error } = await supabase.rpc('set_post_progress', {
      p_post: post.id,
      p_status: status,
      p_review_done: review,
    })
    setBusy(false)
    if (error) return onError('상태를 바꾸지 못했습니다. 내가 맡은 게시물인지 확인해 주세요.')
    onChanged()
  }

  if (!editable) {
    return (
      <span className="post-progress">
        <span className={post.status === 'published' ? 'badge ok' : 'badge'}>{STATUS_LABEL[post.status]}</span>
        <span className="badge muted">검토 {post.review_done ? '완료' : '대기'}</span>
      </span>
    )
  }

  return (
    <span className="post-progress">
      <select
        value={post.status}
        disabled={busy}
        aria-label="게시 상태"
        onChange={(e) => apply(e.target.value as PostStatus, post.review_done)}
      >
        {POST_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className={post.review_done ? 'chip on' : 'chip'}
        aria-pressed={post.review_done}
        disabled={busy}
        onClick={() => apply(post.status, !post.review_done)}
      >
        검토 {post.review_done ? '완료' : '대기'}
      </button>
    </span>
  )
}
