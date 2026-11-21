import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useDialog } from '../components/dialog-context'

const categories = ['해운·항만', '항공', 'SCM', '유통', '무역', '물류기술', '기타']
type Comment = { id: string; author: string; content: string; own: boolean }
type Insight = { id: string; title: string; category: string; source: string; url: string; summary: string; implication: string; author: string; date: string; liked: boolean; likes: number; saved: boolean; comments: Comment[]; own: boolean }
const empty = { title: '', category: categories[0], source: '', url: '', summary: '', implication: '', date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }) }
export default function LogisticsInsight() {
  const { profile } = useAuth()
  const dialog = useDialog()
  const uid = profile?.id
  const officer = profile?.role === 'officer'
  const [items, setItems] = useState<Insight[]>([])
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [commentEdit, setCommentEdit] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const load = useCallback(async () => {
    if (!uid || profile?.status !== 'approved') return false
    const [p,c,l,b,n] = await Promise.all([
      supabase.from('insight_posts').select('*').order('created_at',{ascending:false}).limit(100),
      supabase.from('insight_comments').select('*').order('created_at').limit(1000),
      supabase.from('insight_likes').select('post_id,user_id').limit(1000),
      supabase.from('insight_bookmarks').select('post_id').eq('user_id',uid).limit(1000),
      supabase.from('profiles').select('id,name').limit(1000),
    ])
    if (p.error || c.error || l.error || b.error || n.error) {
      setReady(false); setNotice('데이터를 불러오지 못했습니다. SQL 적용 여부와 권한을 확인해 주세요.'); return false
    }
    const names = new Map((n.data ?? []).map(x => [x.id,x.name]))
    setItems((p.data ?? []).map(x => ({id:x.id,title:x.title,category:x.category,source:x.source,url:x.source_url,summary:x.summary,implication:x.takeaway,author:names.get(x.user_id) ?? '이름 미확인',date:x.article_date,own:x.user_id===uid,liked:(l.data ?? []).some(y=>y.post_id===x.id&&y.user_id===uid),likes:(l.data ?? []).filter(y=>y.post_id===x.id).length,saved:(b.data ?? []).some(y=>y.post_id===x.id),comments:(c.data ?? []).filter(y=>y.post_id===x.id).map(y=>({id:y.id,author:names.get(y.user_id) ?? '이름 미확인',content:y.content,own:y.user_id===uid}))})))
    setReady(true); setNotice(''); return true
  }, [uid, profile?.status])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])
  async function mutate(run: () => PromiseLike<{error: unknown; data: unknown}>) {
    if (!ready || busy || !uid) return false
    setBusy(true); setNotice('')
    try {
      const result = await run()
      if (result.error || !Array.isArray(result.data) || !result.data.length) {setNotice('저장하지 못했습니다. 권한 또는 입력값을 확인해 주세요.'); return false}
      await load(); return true
    } catch {setNotice('요청에 실패했습니다. 다시 확인해 주세요.');return false}
    finally {setBusy(false)}
  }
  async function toggle(item: Insight, table: 'insight_likes' | 'insight_bookmarks', active: boolean) {
    await mutate(() => active ? supabase.from(table).delete().eq('post_id',item.id).eq('user_id',uid!).select('post_id') : supabase.from(table).insert({post_id:item.id}).select('post_id'))
  }
  async function remove(table: 'insight_posts' | 'insight_comments', id: string) {
    if (await dialog.confirm({message:'정말 삭제할까요?',danger:true})) await mutate(() => supabase.from(table).delete().eq('id',id).select('id'))
  }
  const [sort, setSort] = useState('latest')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('전체')
  const [onlySaved, setOnlySaved] = useState(false)
  const [form, setForm] = useState(empty)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const shown = items.filter(item => (category === '전체' || item.category === category) && (!onlySaved || item.saved) && [item.title, item.author, item.summary, item.source, item.implication].join(' ').toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => sort === 'likes' ? b.likes - a.likes || b.date.localeCompare(a.date) : b.date.localeCompare(a.date))
  async function submit(e: FormEvent) {
    e.preventDefault()
    const values = { ...form, title: form.title.trim(), source: form.source.trim(), url: form.url.trim(), summary: form.summary.trim(), implication: form.implication.trim() }
    if (!values.title || !values.source || !values.summary || !values.url) return setError('제목, 출처, 원문 링크, 요약을 입력해 주세요.')
    try { if (!['http:', 'https:'].includes(new URL(values.url).protocol)) throw new Error() } catch { return setError('http 또는 https 원문 링크를 입력해 주세요.') }
    const payload = {title:values.title,category:values.category,source:values.source,source_url:values.url,summary:values.summary,takeaway:values.implication,article_date:values.date}
    if (!await mutate(() => editing ? supabase.from('insight_posts').update(payload).eq('id',editing).select('id') : supabase.from('insight_posts').insert(payload).select('id'))) return
    setForm(empty); setEditing(null); setOpen(false); setError('')
  }
  if (!uid || profile?.status !== 'approved') return <section className="card">승인된 회원만 이용할 수 있습니다.</section>
  return <>
    <section className="card">
      <div className="section-head"><h2>Logistics Insight</h2><button className="btn btn-sm" disabled={!ready || busy} onClick={() => { setOpen(!open); setEditing(null); setForm(empty); setError('') }}>{open ? '닫기' : '+ 뉴스 등록'}</button></div>
      <p>물류 산업의 흐름을 함께 읽다.</p><p className="hint">승인된 회원의 물류 지식 공유 공간입니다. 최근 게시물 최대 100건, 댓글·좋아요·북마크는 최대 1000건 조회 기준입니다.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8,margin:'12px 0'}}>{[['전체 인사이트', items.length], ['내 등록', items.filter(i => i.own).length], ['내 북마크', items.filter(i => i.saved).length]].map(([label, count]) => <div className="card" style={{padding:10,minWidth:0,overflowWrap:'anywhere'}} key={label}><p className="hint">{label}</p><h2>{count}</h2></div>)}</div>
      {notice && <p className="msg error" role="alert">{notice}</p>}
      {!ready && <button className="btn btn-sm" onClick={() => void load()}>다시 불러오기</button>}
      {open && <form className="form" onSubmit={submit}>
        <label>기사 제목<input required maxLength={200} value={form.title} onChange={e => setForm({...form,title:e.target.value})}/></label>
        <label>분야<select value={form.category} onChange={e => setForm({...form,category:e.target.value})}>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        <label>출처<input required maxLength={100} value={form.source} onChange={e => setForm({...form,source:e.target.value})}/></label>
        <label>원문 링크<input required type="url" maxLength={2000} value={form.url} onChange={e => setForm({...form,url:e.target.value})}/></label>
        <label>기사 발행일<input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
        <label>핵심 내용<textarea required rows={4} maxLength={3000} value={form.summary} onChange={e => setForm({...form,summary:e.target.value})}/></label>
        <label>시사점<textarea rows={3} maxLength={2000} value={form.implication} onChange={e => setForm({...form,implication:e.target.value})}/></label>
        {error && <p className="msg error" role="alert">{error}</p>}<button className="btn" disabled={!ready || busy}>{editing ? '수정 저장' : '등록'}</button>
      </form>}
      <div className="form"><label>검색<input placeholder="제목, 키워드, 작성자" value={query} onChange={e => setQuery(e.target.value)}/></label></div>
      <div className="day-picker" style={{flexWrap:'wrap',marginTop:12}}>{['전체', ...categories].map(c => <button key={c} className={category === c ? 'chip on' : 'chip'} onClick={() => setCategory(c)}>{c}</button>)}<button className={onlySaved ? 'chip on' : 'chip'} onClick={() => setOnlySaved(!onlySaved)}>내 북마크</button></div>
      <div className="form" style={{marginTop:10}}><label>정렬<select value={sort} onChange={e => setSort(e.target.value)}><option value="latest">최신순</option><option value="likes">좋아요순</option></select></label></div>
    </section>
    {shown.length === 0 && <section className="card">해당하는 인사이트가 없습니다.</section>}
    {shown.map(item => <section key={item.id} className="card" style={{overflowWrap:'anywhere',marginTop:12}}>
      <div className="section-head"><span className="badge">{item.category}</span><button className="btn btn-sm" aria-label={item.saved ? '북마크 해제' : '북마크 등록'} title={item.saved ? '북마크 해제' : '북마크 등록'} aria-pressed={item.saved} disabled={!ready || busy} onClick={() => void toggle(item,'insight_bookmarks',item.saved)}><svg width="18" height="20" viewBox="0 0 24 24" aria-hidden="true" style={{verticalAlign:'middle'}}><path d="M6 3h12v18l-6-4-6 4z" stroke="currentColor" strokeWidth="2" fill={item.saved?'currentColor':'none'}/></svg></button></div>
      <h2>{item.title}</h2><p className="hint">{item.date} · {item.author} · {item.source}</p><p style={{whiteSpace:'pre-wrap'}}>{item.summary}</p>
      {item.implication && <div className="card" style={{padding:12,margin:'10px 0',boxShadow:'none'}}><strong>핵심 시사점</strong><p style={{whiteSpace:'pre-wrap'}}>{item.implication}</p></div>}
      {/^https?:\/\//i.test(item.url) && <p><a href={item.url} target="_blank" rel="noopener noreferrer">원문 보기 ↗</a></p>}
      <div className="actions" style={{flexWrap:'wrap'}}><button className="btn btn-sm" aria-pressed={item.liked} disabled={!ready || busy} onClick={() => void toggle(item,'insight_likes',item.liked)}>{item.liked?'♥':'♡'} 좋아요 {item.likes}</button><button className="btn btn-sm" aria-expanded={!!expanded[item.id]} onClick={() => setExpanded(old => ({...old,[item.id]:!old[item.id]}))}>댓글 {item.comments.length} {expanded[item.id]?'▴':'▾'}</button>{item.own && <><button className="btn btn-sm" onClick={() => {setForm({title:item.title,category:item.category,source:item.source,url:item.url,summary:item.summary,implication:item.implication,date:item.date});setEditing(item.id);setOpen(true);setError('');window.scrollTo(0,0)}}>수정</button></>}{(item.own || officer) && <button className="btn btn-sm" disabled={!ready || busy} onClick={() => void remove('insight_posts',item.id)}>삭제</button>}</div>
      {expanded[item.id] && <>
      {item.comments.map(c => <div key={c.id} style={{marginTop:8}}><strong>{c.author}</strong><p style={{whiteSpace:'pre-wrap'}}>{c.content}</p>{c.own && <button className="btn btn-sm" onClick={()=>{setCommentEdit(c.id);setCommentText(c.content)}}>수정</button>} {(c.own || officer) && <button className="btn btn-sm" disabled={!ready || busy} onClick={()=>void remove('insight_comments',c.id)}>삭제</button>}{commentEdit===c.id && <form className="form" onSubmit={async e=>{e.preventDefault();if(await mutate(()=>supabase.from('insight_comments').update({content:commentText.trim()}).eq('id',c.id).select('id')))setCommentEdit(null)}}><textarea required maxLength={1000} value={commentText} onChange={e=>setCommentText(e.target.value)}/><button className="btn btn-sm" disabled={!ready || busy || !commentText.trim()}>저장</button><button type="button" className="btn btn-sm" onClick={()=>setCommentEdit(null)}>취소</button></form>}</div>)}
      <form className="form" onSubmit={async e => {e.preventDefault();const content=(drafts[item.id]??'').trim();if(!content)return;if(await mutate(()=>supabase.from('insight_comments').insert({post_id:item.id,content}).select('id')))setDrafts(old=>({...old,[item.id]:''}))}}><label>의견 남기기<textarea rows={2} maxLength={1000} value={drafts[item.id]??''} onChange={e=>setDrafts(old=>({...old,[item.id]:e.target.value}))}/></label><button className="btn btn-sm" disabled={!ready || busy || !(drafts[item.id]??'').trim()}>댓글 등록</button></form>
      </>}
    </section>)}
  </>
}
