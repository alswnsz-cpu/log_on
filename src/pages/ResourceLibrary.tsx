import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useDialog } from '../components/dialog-context'
import { ACCEPT, validateFiles, uploadLibraryFile, downloadLibraryFile, removeLibraryFile, type LibraryFile } from '../lib/resourceLibrary'

const categories = ['전공 학습','자격증','데이터 분석','토론·발표','공모전','취업·직무','기타']
const empty = {title:'',description:'',category:categories[0],source_url:'',rights_confirmed:false}
interface Resource { id:string; user_id:string|null; title:string; description:string; category:string; source_url:string|null; created_at:string; files:LibraryFile[]; author:string; saved:boolean }
export default function ResourceLibrary() {
  const {profile} = useAuth()
  const uid = profile?.id
  const approved = profile?.status === 'approved'
  const officer = profile?.role === 'officer'
  const dialog = useDialog()
  const [items,setItems] = useState<Resource[]>([])
  const [ready,setReady] = useState(false)
  const [busy,setBusy] = useState(false)
  const [notice,setNotice] = useState('')
  const [query,setQuery] = useState('')
  const [category,setCategory] = useState('전체')
  const [savedOnly,setSavedOnly] = useState(false)
  const [open,setOpen] = useState(false)
  const [editing,setEditing] = useState<string|null>(null)
  const [form,setForm] = useState(empty)
  const [files,setFiles] = useState<File[]>([])
  const [fileKey,setFileKey] = useState(0)
  const load = useCallback(async () => {
    if (!uid || !approved) return false
    try {
      const r = await supabase.from('library_resources').select('id,user_id,title,description,category,source_url,created_at,library_files(id,resource_id,slot,file_name,storage_path,size_bytes)').order('created_at',{ascending:false}).limit(100)
      const [b,n] = await Promise.all([supabase.from('library_bookmarks').select('resource_id').eq('user_id',uid).limit(1000),supabase.from('profiles').select('id,name').limit(1000)])
      if (r.error || b.error || n.error) throw new Error()
      const names = new Map((n.data ?? []).map(x=>[x.id,x.name]))
      const bookmarks = new Set((b.data ?? []).map(x=>x.resource_id))
      setItems((r.data ?? []).map(x=>({...x,files:(x.library_files ?? []) as LibraryFile[],author:names.get(x.user_id) ?? '이름 미확인',saved:bookmarks.has(x.id)})))
      setReady(true); return true
    } catch {setReady(false);setNotice('자료를 불러오지 못했습니다. SQL 적용 여부와 권한을 확인해 주세요.');return false}
  },[uid,approved])
  useEffect(()=>{
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  },[load])
  function reset(){setOpen(false);setEditing(null);setForm(empty);setFiles([]);setFileKey(k=>k+1)}
  async function run(action:()=>Promise<void>){
    if(busy || !ready || !approved) return
    setBusy(true);setNotice('')
    try {await action()} catch(e){setNotice(e instanceof Error ? e.message : '작업에 실패했습니다. 다시 시도해 주세요.')}
    finally {await load();setBusy(false)}
  }
  async function download(f:LibraryFile){
    if(busy) return
    if(!approved) return setNotice('승인된 회원만 내려받을 수 있습니다.')
    if(!ready) return setNotice('자료 목록을 아직 불러오지 못했습니다. 새로고침해 주세요.')
    setNotice('')
    try {await downloadLibraryFile(f);setNotice('')} catch(e){setNotice(e instanceof Error ? e.message : '파일을 내려받지 못했습니다. 잠시 후 다시 시도해 주세요.')}
  }
  async function submit(e:FormEvent){
    e.preventDefault()
    if(!uid) return
    const current=items.find(x=>x.id===editing)
    const invalid=validateFiles(files,current?.files.length ?? 0)
    if(invalid) return setNotice(invalid)
    const title=form.title.trim(), url=form.source_url.trim()
    if(!title || !form.rights_confirmed) return setNotice('제목과 공유 권한 확인이 필요합니다.')
    if(url){try{if(!/^https?:\/\//i.test(url)||!['http:','https:'].includes(new URL(url).protocol))throw new Error()}catch{return setNotice('올바른 http 또는 https 링크를 입력해 주세요.')}}
    if(!url && !files.length && !current?.files.length) return setNotice('파일 또는 참고 링크를 등록해 주세요.')
    await run(async()=>{
      const payload={...form,title,description:form.description.trim(),source_url:url||null}
      const result=editing?await supabase.from('library_resources').update(payload).eq('id',editing).select('id').single():await supabase.from('library_resources').insert(payload).select('id').single()
      if(result.error || !result.data) throw new Error('자료 정보를 저장하지 못했습니다.')
      const slots=[1,2,3].filter(s=>!current?.files.some(f=>f.slot===s))
      const selected=[...files]
      reset()
      for(let i=0;i<selected.length;i++) await uploadLibraryFile(uid,result.data.id,slots[i],selected[i])
      setNotice('자료를 저장했습니다.')
    })
  }
  async function remove(item:Resource){
    if(!await dialog.confirm({message:'자료와 첨부파일을 모두 삭제할까요?',danger:true}))return
    await run(async()=>{
      const rows=await supabase.from('library_files').select('*').eq('resource_id',item.id)
      if(rows.error)throw new Error('첨부파일 목록을 확인하지 못했습니다.')
      for(const f of rows.data ?? [])await removeLibraryFile(f as LibraryFile)
      const del=await supabase.from('library_resources').delete().eq('id',item.id).select('id')
      if(del.error||!del.data?.length)throw new Error('자료 삭제 실패. 다시 시도해 주세요.')
      if(editing===item.id)reset()
      setNotice('')
    })
  }
  const shown=items.filter(x=>(category==='전체'||x.category===category)&&(!savedOnly||x.saved)&&[x.title,x.description,x.author,...x.files.map(f=>f.file_name)].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  if(!uid||!approved)return <section className="card">승인된 회원만 이용할 수 있습니다.</section>
  return <>
    <section className="card">
      <div className="section-head"><h2>Resource Library</h2><button className="btn btn-sm" disabled={!ready||busy} onClick={()=>{reset();setOpen(!open)}}>{open?'닫기':'+ 자료 등록'}</button></div>
      <p>함께 쌓아가는 LOG:ON의 지식 자산</p><p className="hint">최근 등록 자료 최대 100건 · 공유 권한이 있는 자료만 등록해 주세요.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8,margin:'12px 0'}}>{[['전체 자료',items.length],['내 등록',items.filter(x=>x.user_id===uid).length],['내 북마크',items.filter(x=>x.saved).length]].map(([label,count])=><div key={label} className="card" style={{padding:10,minWidth:0,overflowWrap:'anywhere'}}><p className="hint">{label}</p><h2>{ready?count:'—'}</h2></div>)}</div>
      {notice&&<p role="status">{notice}</p>}{!ready&&<button className="btn btn-sm" onClick={()=>{setNotice('');void load()}}>다시 불러오기</button>}
      {open&&<form className="form" onSubmit={submit}>
        <label>자료 제목<input required maxLength={200} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
        <label>카테고리<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
        <label>자료 설명<textarea rows={3} maxLength={3000} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
        <label>외부 참고 링크<input type="url" maxLength={2048} value={form.source_url} onChange={e=>setForm({...form,source_url:e.target.value})}/></label>
        <label>첨부파일 (최대 3개, 개당 50MB · pdf, hwp, hwpx, pptx, docx, xlsx, csv, zip, 7z)<input key={fileKey} type="file" multiple accept={ACCEPT} onChange={e=>{const picked=Array.from(e.target.files??[]);const err=validateFiles(picked,items.find(x=>x.id===editing)?.files.length??0);setNotice(err??'');setFiles(err?[]:picked);if(err)setFileKey(k=>k+1)}}/></label>
        <p className="hint">압축파일(zip, 7z)은 출처가 확실한 자료만 올려 주세요.</p>
        {files.map((f,i)=><p className="hint" key={i}>{f.name}</p>)}
        <label className="check-row"><input type="checkbox" required checked={form.rights_confirmed} onChange={e=>setForm({...form,rights_confirmed:e.target.checked})}/> 공유 권한이 있는 자료임을 확인합니다.</label>
        <button className="btn" disabled={busy||!ready}>{busy?'처리 중…':editing?'수정 저장':'자료 등록'}</button>
      </form>}
      <div className="form"><label>검색<input placeholder="자료명, 키워드, 작성자" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
      <div className="day-picker" style={{flexWrap:'wrap',marginTop:12}}>{['전체',...categories].map(c=><button key={c} className={category===c?'chip on':'chip'} onClick={()=>setCategory(c)}>{c}</button>)}<button className={savedOnly?'chip on':'chip'} onClick={()=>setSavedOnly(!savedOnly)}>내 북마크</button></div>
    </section>
    {ready&&!shown.length&&<section className="card">해당하는 자료가 없습니다.</section>}
    {shown.map(item=><section className="card" key={item.id} style={{overflowWrap:'anywhere',marginTop:12}}>
      <div className="section-head"><span className="badge">{item.category}</span><button className="btn btn-sm" aria-pressed={item.saved} disabled={busy||!ready} onClick={()=>void run(async()=>{const r=item.saved?await supabase.from('library_bookmarks').delete().eq('resource_id',item.id).eq('user_id',uid).select('resource_id'):await supabase.from('library_bookmarks').insert({resource_id:item.id}).select('resource_id');if(r.error||!r.data?.length)throw new Error('북마크 처리 실패')})}>{item.saved?'★':'☆'} 북마크</button></div>
      <h2>{item.title}</h2><p className="hint">{item.author} · {item.created_at.slice(0,10)}</p><p style={{whiteSpace:'pre-wrap'}}>{item.description}</p>
      {item.source_url&&/^https?:\/\//i.test(item.source_url)&&<p><a href={item.source_url} target="_blank" rel="noopener noreferrer">참고 링크 ↗</a></p>}
      {item.files.map(f=><div key={f.id} className="card" style={{padding:10,margin:'8px 0'}}><strong>{f.file_name}</strong><p className="hint">{(f.size_bytes/1048576).toFixed(2)} MB</p><div className="actions" style={{flexWrap:'wrap'}}><button className="btn btn-sm" disabled={busy} onClick={()=>void download(f)}>다운로드</button>{(item.user_id===uid||officer)&&<button className="btn btn-sm" disabled={busy||!ready} onClick={async()=>{if(await dialog.confirm({message:'첨부파일을 삭제할까요?',danger:true}))await run(()=>removeLibraryFile(f))}}>첨부 삭제</button>}</div></div>)}
      <div className="actions">{item.user_id===uid&&<button className="btn btn-sm" disabled={busy||!ready} onClick={()=>{setEditing(item.id);setForm({title:item.title,description:item.description,category:item.category,source_url:item.source_url??'',rights_confirmed:false});setFiles([]);setFileKey(k=>k+1);setOpen(true);window.scrollTo(0,0)}}>수정</button>}{(item.user_id===uid||officer)&&<button className="btn btn-sm" disabled={busy||!ready} onClick={()=>void remove(item)}>삭제</button>}</div>
    </section>)}
  </>
}
