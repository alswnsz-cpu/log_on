import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useDialog } from './dialog-context'

interface CommentRow {
  id: string
  user_id: string
  content: string
  created_at: string
}

export default function AlbumInteractions({
  albumId,
}: {
  albumId: string
}) {
  const { profile } = useAuth()
  const dialog = useDialog()
  const userId = profile?.id
  const isOfficer = profile?.role === 'officer'

  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [comments, setComments] = useState<CommentRow[]>([])
  const [commentCount, setCommentCount] = useState(0)
  const [names, setNames] = useState<Record<string, string>>({})
  const [content, setContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!userId) return

    setReady(false)

    const [likes, mine, rows] = await Promise.all([
      supabase
        .from('album_likes')
        .select('*', { count: 'exact', head: true })
        .eq('album_id', albumId),

      supabase
        .from('album_likes')
        .select('user_id')
        .eq('album_id', albumId)
        .eq('user_id', userId),

      supabase
        .from('album_comments')
        .select('id, user_id, content, created_at', { count: 'exact' })
        .eq('album_id', albumId)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    if (likes.error || mine.error || rows.error) {
      setError('좋아요 및 댓글 기능을 아직 사용할 수 없습니다.')
      return
    }

    setLikeCount(likes.count ?? 0)
    setLiked((mine.data?.length ?? 0) > 0)

    const data = (rows.data ?? []) as CommentRow[]
    setComments(data)
    setCommentCount(rows.count ?? data.length)

    const ids = [...new Set(data.map((c) => c.user_id))]

    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', ids)

      setNames(
        Object.fromEntries(
          (profiles ?? []).map((p) => [p.id, p.name])
        )
      )
    } else {
      setNames({})
    }

    setError('')
    setReady(true)
  }, [albumId, userId])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleLike() {
    if (!userId || busy || !ready) return
    setBusy(true)
    setError('')

    try {
      const result = liked
        ? await supabase
            .from('album_likes')
            .delete()
            .eq('album_id', albumId)
            .eq('user_id', userId)
        : await supabase
            .from('album_likes')
            .insert({
              album_id: albumId,
              user_id: userId,
            })

      if (result.error) {
        setError('좋아요를 처리하지 못했습니다.')
        return
      }

      await load()
    } finally {
      setBusy(false)
    }
  }

  async function addComment(e: FormEvent) {
    e.preventDefault()

    const text = content.trim()
    if (!userId || !text || text.length > 1000 || busy || !ready) return

    setBusy(true)
    setError('')

    try {
      const { error } = await supabase
        .from('album_comments')
        .insert({
          album_id: albumId,
          user_id: userId,
          content: text,
        })

      if (error) {
        setError('댓글을 등록하지 못했습니다.')
        return
      }

      setContent('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function saveComment(commentId: string) {
    const text = editContent.trim()
    if (!userId || !text || text.length > 1000 || busy || !ready) return

    setBusy(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('album_comments')
        .update({ content: text })
        .eq('id', commentId)
        .eq('album_id', albumId)
        .eq('user_id', userId)
        .select('id')

      if (error || !data?.length) {
        setError('댓글을 수정하지 못했습니다.')
        return
      }

      setEditingId(null)
      setEditContent('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function removeComment(comment: CommentRow) {
    if (busy || !ready || !userId) return
    if (comment.user_id !== userId && !isOfficer) return

    setBusy(true)
    setError('')

    try {
      const ok = await dialog.confirm({
        title: '댓글 삭제',
        message: '이 댓글을 삭제할까요?',
        confirmLabel: '삭제',
        danger: true,
      })

      if (!ok) return

      const { data, error } = await supabase
        .from('album_comments')
        .delete()
        .eq('id', comment.id)
        .eq('album_id', albumId)
        .select('id')

      if (error || !data?.length) {
        setError('댓글을 삭제하지 못했습니다.')
        return
      }

      if (editingId === comment.id) {
        setEditingId(null)
        setEditContent('')
      }

      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <div className="section-head">
        <h2>좋아요 및 댓글</h2>

        <button
          type="button"
          className={`btn btn-sm ${liked ? '' : 'btn-light'}`}
          onClick={toggleLike}
          disabled={busy || !ready}
          aria-pressed={liked}
        >
          {liked ? '♥' : '♡'} 좋아요 {likeCount}
        </button>
      </div>

      {error && (
        <p className="msg error" role="alert">{error}</p>
      )}

      <h3>댓글 {commentCount}개</h3>

      <form className="form" onSubmit={addComment}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="활동에 대한 이야기를 남겨 보세요!"
          aria-label="댓글 내용"
          maxLength={1000}
          rows={3}
          disabled={!ready || busy}
        />

        <div className="actions">
          <button
            className="btn btn-sm"
            disabled={!content.trim() || busy || !ready}
          >
            댓글 등록
          </button>
        </div>
      </form>

      {ready && comments.length === 0 && (
        <p className="hint">
          아직 댓글이 없습니다. 첫 댓글을 남겨 보세요!
        </p>
      )}

      {comments.map((c) => (
        <div
          key={c.id}
          style={{
            borderBottom: '1px solid rgba(128,128,128,0.2)',
            padding: '16px 0',
          }}
        >
          <strong>
            {names[c.user_id] ?? '동아리 부원'}
          </strong>

          <p className="hint">
            {new Date(c.created_at).toLocaleString('ko-KR')}
          </p>

          {editingId === c.id ? (
            <div className="form">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                aria-label="댓글 수정"
                maxLength={1000}
                rows={3}
              />

              <div className="actions">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busy || !editContent.trim()}
                  onClick={() => saveComment(c.id)}
                >
                  저장
                </button>

                <button
                  type="button"
                  className="btn btn-light btn-sm"
                  onClick={() => setEditingId(null)}
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <p style={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}>
              {c.content}
            </p>
          )}

          <div className="actions">
            {c.user_id === userId && editingId !== c.id && (
              <button
                type="button"
                className="btn btn-light btn-sm"
                disabled={busy || !ready}
                onClick={() => {
                  setEditingId(c.id)
                  setEditContent(c.content)
                }}
              >
                수정
              </button>
            )}

            {(c.user_id === userId || isOfficer) && (
              <button
                type="button"
                className="btn btn-sm btn-ghost btn-danger"
                disabled={busy || !ready}
                onClick={() => removeComment(c)}
              >
                삭제
              </button>
            )}
          </div>
        </div>
      ))}

      {commentCount > comments.length && (
        <p className="hint">최근 댓글 100개를 표시합니다.</p>
      )}
    </section>
  )
}