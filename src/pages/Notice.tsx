import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useDialog } from '../components/dialog-context'

const categories = ['일반', '활동', '일정', '모집', '긴급']
const empty = { title: '', body: '', category: '일반', pinned: false }
type Draft = typeof empty
type NoticeRow = Draft & { id: string; author_id: string | null; revision: number; created_at: string; updated_at: string }
type Receipt = { notice_id: string; revision: number; user_id: string; read_at: string }
type Member = { id: string; name: string }
const stamp = (value: string) => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
const wrap = { display: 'flex', flexWrap: 'wrap' as const, gap: 8, alignItems: 'center' }
export default function Notice() {
  const { profile } = useAuth()
  const uid = profile?.id, approved = profile?.status === 'approved', officer = profile?.role === 'officer'
  const dialog = useDialog()
  const [posts, setPosts] = useState<NoticeRow[]>([])
  const [reads, setReads] = useState<Receipt[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [query, setQuery] = useState(''), [category, setCategory] = useState('전체'), [unreadOnly, setUnreadOnly] = useState(false)
  const [form, setForm] = useState<Draft>(empty), [editing, setEditing] = useState<NoticeRow | null>(null), [open, setOpen] = useState(false), [detail, setDetail] = useState<string | null>(null)
  const load = useCallback(async () => {
    if (!uid || !approved) return
    try {
      const p = await supabase.from('club_notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(100)
      if (p.error) throw p.error
      const rows = (p.data ?? []) as NoticeRow[]
      const allReads: Receipt[] = []
      const allMembers: Member[] = []
      if (rows.length) {
        for (let offset = 0; ; offset += 500) {
          let q = supabase.from('club_notice_reads').select('*').in('notice_id', rows.map(x => x.id))
          if (!officer) q = q.eq('user_id', uid)
          const r = await q.order('notice_id').order('user_id').range(offset, offset + 499)
          if (r.error) throw r.error
          allReads.push(...((r.data ?? []) as Receipt[]))
          if ((r.data ?? []).length < 500) break
        }
      }
      if (officer) {
        for (let offset = 0; ; offset += 500) {
          const m = await supabase.from('profiles').select('id,name').eq('status', 'approved').order('id').range(offset, offset + 499)
          if (m.error) throw m.error
          allMembers.push(...((m.data ?? []) as Member[]))
          if ((m.data ?? []).length < 500) break
        }
      }
      setPosts(rows); setReads(allReads); setMembers(allMembers); setReady(true)
    } catch { setReady(false); setError('공지사항을 불러오지 못했습니다. SQL 적용 및 권한을 확인해 주세요.') }
  }, [uid, approved, officer])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])
  const receipt = (p: NoticeRow, id: string) => reads.find(r => r.notice_id === p.id && r.revision === p.revision && r.user_id === id)
  const reset = () => { setOpen(false); setEditing(null); setForm(empty) }
  async function run(action: () => Promise<void>) {
    if (!ready || busy || !approved) return
    setBusy(true); setError('')
    try { await action() } catch (e) { setError(e instanceof Error ? e.message : '작업에 실패했습니다.') }
    finally { await load(); setBusy(false) }
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!officer) return
    const payload = { ...form, title: form.title.trim(), body: form.body.trim() }
    if (!payload.title || !payload.body) { setError('제목과 내용을 입력해 주세요.'); return }
    if (editing && (editing.title !== payload.title || editing.body !== payload.body) && !await dialog.confirm({ message: '제목 또는 내용이 변경되면 기존 확인 기록이 초기화됩니다. 저장할까요?' })) return
    await run(async () => {
      const r = editing ? await supabase.from('club_notices').update(payload).eq('id', editing.id).eq('revision', editing.revision).eq('updated_at', editing.updated_at).select('id') : await supabase.from('club_notices').insert(payload).select('id')
      if (r.error || !r.data?.length) throw new Error('저장 실패: 권한 또는 다른 변경 사항을 확인해 주세요.')
      reset()
    })
  }
  async function remove(p: NoticeRow) {
    if (!officer || !await dialog.confirm({ message: '공지와 확인 기록을 삭제할까요?', danger: true })) return
    await run(async () => {
      const r = await supabase.from('club_notices').delete().eq('id', p.id).eq('updated_at', p.updated_at).select('id')
      if (r.error || !r.data?.length) throw new Error('삭제 실패: 최신 공지를 확인해 주세요.')
      if (editing?.id === p.id) reset()
      if (detail === p.id) setDetail(null)
    })
  }
  async function acknowledge(p: NoticeRow) {
    await run(async () => {
      const r = await supabase.from('club_notice_reads').insert({ notice_id: p.id, revision: p.revision }).select('notice_id')
      if (r.error || !r.data?.length) throw new Error('확인 처리 실패: 최신 공지 또는 기존 확인 여부를 확인해 주세요.')
    })
  }
  if (!uid || !approved) return <section className="card">승인된 회원만 이용할 수 있습니다.</section>
  const shown = posts.filter(p => (category === '전체' || p.category === category) && (!unreadOnly || !receipt(p, uid)) && `${p.title} ${p.body}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="notice-hub">
    <style>{`
      .notice-hub button { border: 0; border-radius: 10px; padding: 10px 14px; font: inherit; font-weight: 700; background: #7938ed; color: white; cursor: pointer; }
      .notice-hub button:disabled { opacity: .55; cursor: not-allowed; }
      .notice-hub input:not([type=checkbox]), .notice-hub select, .notice-hub textarea { box-sizing: border-box; border: 1px solid #cdb5ff; border-radius: 10px; padding: 12px; font: inherit; background: transparent; color: inherit; min-height: 44px; max-width: 100%; }
      .notice-hub select option { color: #24143e; background: white; }
      .notice-hub input[type=checkbox] { accent-color: #7938ed; }
      .notice-hub button:focus-visible, .notice-hub input:focus-visible, .notice-hub select:focus-visible, .notice-hub textarea:focus-visible { outline: 2px solid #7938ed; outline-offset: 2px; }
      .notice-hub .notice-filters { display: grid; grid-template-columns: minmax(0,2fr) minmax(120px,1fr) auto; gap: 12px; align-items: center; }
      .notice-hub .notice-filters label { display: flex; align-items: center; gap: 6px; }
      @media (max-width: 600px) { .notice-hub .notice-filters { grid-template-columns: minmax(0,1fr); } }
    `}</style>
    <section className="card" style={{ marginBottom: 16 }}>
      <div style={{ ...wrap, justifyContent: 'space-between' }}><div><h1 style={{ margin: 0, color: '#7938ed', fontSize: 20 }}>Notice</h1><p style={{ margin: '10px 0 16px' }}>LOG:ON 공식 공지사항</p></div>{officer && <button disabled={!ready || busy} onClick={() => { reset(); setOpen(true) }}>+ 공지 등록</button>}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10 }}>
        {[['전체 공지', posts.length], ['미확인 공지', posts.filter(p => !receipt(p, uid)).length], ['중요 공지', posts.filter(p => p.pinned).length]].map(([label, value]) => <div key={label} style={{ padding: 14, border: '1px solid #8b5cf655', background: '#8b5cf614', borderRadius: 12 }}><small>{label}</small><h2 style={{ margin: '6px 0 0', color: '#8b5cf6' }}>{ready ? value : '—'}</h2></div>)}
      </div><small style={{ display: 'block', marginTop: 10 }}>최근 표시 대상 최대 100건 기준 · 중요 공지 우선</small>
    </section>
    {error && <section className="card" role="alert" style={{ ...wrap, marginBottom: 16, color: '#e05b68' }}>{error} <button disabled={busy} onClick={() => { setError(''); void load() }}>다시 불러오기</button></section>}
    {open && officer && <form className="card" onSubmit={save} style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
      <h2>{editing ? '공지 수정' : '공지 등록'}</h2>
      <label>제목<input style={{ width: '100%' }} required maxLength={200} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
      <label>분류<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
      <label>내용<textarea style={{ width: '100%', minHeight: 160 }} required maxLength={10000} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></label>
      <label><input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} /> 중요 공지 상단 고정</label>
      <div style={wrap}><button disabled={busy || !ready} type="submit">저장</button><button type="button" disabled={busy} onClick={reset}>취소</button></div>
    </form>}
    <section className="card" style={{ marginBottom: 16 }}><div className="notice-filters"><input aria-label="공지 검색" placeholder="제목 및 내용 검색" style={{ width: '100%', minWidth: 0 }} value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="공지 분류" value={category} onChange={e => setCategory(e.target.value)}>{['전체', ...categories].map(c => <option key={c}>{c}</option>)}</select><label><input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} /> 미확인만 보기</label></div></section>
    {ready && !shown.length && <section className="card">표시할 공지가 없습니다.</section>}
    {ready && shown.map(p => { const mine = receipt(p, uid), count = members.filter(m => receipt(p, m.id)).length; return <article className="card" key={p.id} style={{ marginBottom: 12, borderLeft: p.category === '긴급' ? '4px solid #e05b68' : p.pinned ? '4px solid #8b5cf6' : undefined, overflowWrap: 'anywhere' }}>
      <div style={{ ...wrap, justifyContent: 'space-between' }}><strong style={{ color: p.category === '긴급' ? '#e05b68' : undefined }}>{p.pinned ? '📌 중요 · ' : ''}{p.category}</strong><small>{mine ? '확인 완료' : '미확인'}</small></div>
      <h2>{p.title}</h2><small>{stamp(p.created_at)}{p.revision > 1 ? ' · 내용 수정됨' : ''}</small>
      <p style={{ whiteSpace: 'pre-wrap' }}>{p.body}</p>
      <div style={wrap}>{mine ? <small>확인 시각: {stamp(mine.read_at)}</small> : <button disabled={busy} onClick={() => void acknowledge(p)}>공지 확인 완료</button>}{officer && <><button disabled={busy} onClick={() => setDetail(detail === p.id ? null : p.id)}>확인 명단 {count}/{members.length}명</button><button disabled={busy} onClick={() => { setEditing(p); setForm({ title: p.title, body: p.body, category: p.category, pinned: p.pinned }); setOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>수정</button><button disabled={busy} onClick={() => void remove(p)}>삭제</button></>}</div>
      {officer && detail === p.id && <div style={{ marginTop: 12 }}><progress style={{ width: '100%' }} value={count} max={Math.max(1, members.length)} /><h3>미확인 ({members.length - count}명)</h3>{members.filter(m => !receipt(p, m.id)).map(m => <div key={m.id}>{m.name}</div>)}<h3>확인 완료 ({count}명)</h3>{members.filter(m => receipt(p, m.id)).map(m => <div key={m.id}>{m.name} · {stamp(receipt(p, m.id)!.read_at)}</div>)}</div>}
    </article> })}
  </div>
}
