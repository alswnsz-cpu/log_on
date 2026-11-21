import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

const ALBUM_CATEGORIES = ['동아리 활동', '견학', '공모전', '스터디', '친목 활동', '기타']
const BUCKET = 'logon-photos'
interface AlbumRow {
  id: string
  title: string
  description: string | null
  category: string
  created_at: string
  cover_path: string | null
}
interface GalleryAlbum extends AlbumRow {
  coverUrl?: string
  photos: number | null
  likes: number | null
  comments: number | null
}
export default function Archive() {
  const { profile } = useAuth()
  const isOfficer = profile?.role === 'officer'
  const [albums, setAlbums] = useState<GalleryAlbum[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState('전체')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(ALBUM_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('albums')
        .select('id, title, description, category, created_at, cover_path')
        .order('created_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as AlbumRow[]
      const result: GalleryAlbum[] = []
      // Limit concurrent requests to avoid flooding the API.
      for (let i = 0; i < rows.length; i += 6) {
        const batch = await Promise.all(rows.slice(i, i + 6).map(async (a): Promise<GalleryAlbum> => {
          const [first, likes, comments] = await Promise.all([
            supabase.from('album_photos').select('storage_path', { count: 'exact' }).eq('album_id', a.id).order('created_at').order('id').limit(1),
            supabase.from('album_likes').select('album_id', { count: 'exact', head: true }).eq('album_id', a.id),
            supabase.from('album_comments').select('id', { count: 'exact', head: true }).eq('album_id', a.id),
          ])
          let coverUrl: string | undefined
          const firstPath = first.data?.[0]?.storage_path as string | undefined
          for (const path of [...new Set([a.cover_path, firstPath])]) {
            if (!path || !path.startsWith(`${a.id}/`)) continue
            const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
            if (!signed.error && signed.data?.signedUrl) {
              coverUrl = signed.data.signedUrl
              break
            }
          }
          return { ...a, coverUrl, photos: first.error ? null : first.count, likes: likes.error ? null : likes.count, comments: comments.error ? null : comments.count }
        }))
        result.push(...batch)
      }
      setAlbums(result)
      setLoadError(null)
    } catch {
      setLoadError('앨범을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!isOfficer || saving) return
    const t = title.trim()
    if (t.length < 1 || t.length > 100) return setFormError('앨범 제목은 1~100자로 입력해 주세요.')
    if (description.length > 1000) return setFormError('설명은 1000자 이하로 입력해 주세요.')
    setFormError(null)
    setSaving(true)
    try {
      const { error } = await supabase.from('albums').insert({ title: t, category, description: description.trim() || null })
      if (error) return setFormError('앨범을 만들지 못했습니다. 임원진 권한을 확인해 주세요.')
      setTitle(''); setDescription(''); setCategory(ALBUM_CATEGORIES[0]); setShowForm(false)
      setFilter('전체'); setSearch('')
      await load()
    } finally { setSaving(false) }
  }
  const categories = [...new Set([...ALBUM_CATEGORIES, ...albums.map(a => a.category)])]
  const q = search.trim().toLowerCase()
  const visible = albums.filter(a => (filter === '전체' || a.category === filter) && `${a.title} ${a.description ?? ''}`.toLowerCase().includes(q))
  return (
    <>
      <section className="card">
        <div className="section-head">
          <h2>아카이브</h2>
          {isOfficer && <button className="btn btn-sm" onClick={() => setShowForm(v => !v)}>{showForm ? '닫기' : '+ 새 앨범'}</button>}
        </div>
        <p className="hint">LOG:ON의 활동과 추억을 한곳에 기록합니다. 사진 추가는 임원진만 할 수 있습니다.</p>
        {isOfficer && showForm && <form className="form" onSubmit={create}>
          <label>앨범 제목<input value={title} maxLength={100} placeholder="예: 2026 부산항 신항 견학" onChange={e => setTitle(e.target.value)} required /></label>
          <label>카테고리<select value={category} onChange={e => setCategory(e.target.value)}>{ALBUM_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></label>
          <label>설명 (선택)<textarea value={description} maxLength={1000} rows={4} onChange={e => setDescription(e.target.value)} /></label>
          {formError && <p className="msg error" role="alert">{formError}</p>}
          <div className="actions"><button className="btn" disabled={saving}>{saving ? '저장 중...' : '앨범 만들기'}</button></div>
        </form>}
        <div className="form" style={{ marginTop: 16 }}>
          <label>앨범 검색<input value={search} onChange={e => setSearch(e.target.value)} placeholder="제목 또는 활동 내용 검색" /></label>
          <label>카테고리<select value={filter} onChange={e => setFilter(e.target.value)}><option>전체</option>{categories.map(c => <option key={c}>{c}</option>)}</select></label>
        </div>
      </section>
      {loadError && <p className="msg error" role="alert">{loadError} <button className="btn btn-sm" onClick={() => void load()}>다시 시도</button></p>}
      {loading ? <section className="card"><p>불러오는 중...</p></section> : !loadError && (visible.length === 0 ?
        <section className="card"><p>{albums.length ? '검색 조건에 맞는 앨범이 없습니다.' : '아직 등록된 앨범이 없습니다.'}</p></section> : <>
        <p className="hint">앨범 {visible.length}개</p>
        <div className="card-grid">
          {visible.map(a => <Link key={a.id} to={`/archive/${a.id}`} className="card agenda-card" style={{ overflow: 'hidden', minWidth: 0 }}>
            <div style={{ aspectRatio: '4 / 3', borderRadius: 10, overflow: 'hidden', position: 'relative', background: 'rgba(128,128,128,.12)', display: 'grid', placeItems: 'center' }}>
              {a.coverUrl ? <img src={a.coverUrl} alt={`${a.title} 대표 사진`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} onError={e => { e.currentTarget.style.display = 'none' }} /> : null}
              <span className="hint" aria-hidden="true">LOG:ON · 활동 앨범</span>
            </div>
            <div className="section-head" style={{ marginTop: 12, flexWrap: 'wrap' }}><h2 style={{ overflowWrap: 'anywhere' }}>{a.title}</h2><span className="badge">{a.category}</span></div>
            {a.description && <p style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{a.description}</p>}
            <p className="hint">{new Date(a.created_at).toLocaleDateString('ko-KR')}</p>
            <div className="hint" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, borderTop: '1px solid rgba(128,128,128,.2)', paddingTop: 10 }}>
              <span>♡ 좋아요 {a.likes ?? '—'}</span><span>댓글 {a.comments ?? '—'}</span><span>사진 {a.photos ?? '—'}장</span>
            </div>
          </Link>)}
        </div>
        {visible.some(a => a.likes === null || a.comments === null) && <p className="hint">좋아요·댓글 집계는 DB 기능 적용 후 표시됩니다.</p>}
      </>)}
    </>
  )
}
