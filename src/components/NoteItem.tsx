import { useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/agendas'
import { useDialog } from './dialog-context'

export interface NoteRow {
  id: number
  agenda_id: number | null
  body: string
  created_at: string
  updated_at: string
}

export const NOTE_COLUMNS = 'id, agenda_id, body, created_at, updated_at'

interface Props {
  note: NoteRow
  /** 수정·삭제가 끝나면 목록을 다시 불러오라고 알린다 */
  onChanged: () => void
  onError: (message: string | null) => void
  /** 글 위에 보여 줄 부가 내용(예: 연결된 토론 제목) */
  children?: ReactNode
}

/** 내 노트 한 개: 본문, 시각, 수정(그 자리에서), 삭제. 노트는 본인만 읽고 쓰므로 DB 정책도 본인 것만 허용한다. */
export default function NoteItem({ note, onChanged, onError, children }: Props) {
  const dialog = useDialog()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.body)
  const [busy, setBusy] = useState(false)

  async function save() {
    const body = text.trim()
    if (body.length < 1 || body.length > 5000) return onError('노트는 1~5000자로 입력해 주세요.')
    onError(null)
    setBusy(true)
    const { data, error } = await supabase.from('notes').update({ body }).eq('id', note.id).select('id')
    setBusy(false)
    if (error || (data?.length ?? 0) === 0) return onError('노트를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    setEditing(false)
    onChanged()
  }

  async function remove() {
    const ok = await dialog.confirm({
      title: '노트 삭제',
      message: '이 노트를 삭제할까요?\n되돌릴 수 없습니다.',
      confirmLabel: '삭제',
      danger: true,
    })
    if (!ok) return
    onError(null)
    setBusy(true)
    const { data, error } = await supabase.from('notes').delete().eq('id', note.id).select('id')
    setBusy(false)
    if (error || (data?.length ?? 0) === 0) return onError('노트를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    onChanged()
  }

  const edited = Date.parse(note.updated_at) - Date.parse(note.created_at) > 1000

  return (
    <div className="post-item">
      {children}
      {editing ? (
        <div className="form">
          <textarea value={text} maxLength={5000} rows={4} onChange={(e) => setText(e.target.value)} aria-label="노트 내용" />
          <div className="actions">
            <button className="btn btn-sm" disabled={busy} onClick={save}>
              저장
            </button>
            <button
              className="btn btn-sm btn-ghost"
              disabled={busy}
              onClick={() => {
                setText(note.body)
                setEditing(false)
              }}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="decision-text">{note.body}</p>
          <p className="hint">
            {formatDateTime(note.created_at)}
            {edited && ' · 수정됨'}
          </p>
          <div className="actions">
            <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setEditing(true)}>
              수정
            </button>
            <button className="btn btn-sm btn-ghost btn-danger" disabled={busy} onClick={remove}>
              삭제
            </button>
          </div>
        </>
      )}
    </div>
  )
}
