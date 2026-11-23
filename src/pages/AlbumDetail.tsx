import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useDialog } from '../components/dialog-context'
import AlbumInteractions from '../components/AlbumInteractions'

const CATEGORIES = ['동아리 활동', '견학', '공모전', '스터디', '친목 활동', '기타']
const BUCKET = 'logon-photos'
const MAX_BYTES = 10 * 1024 * 1024
/** 한 번에 조회하는 사진 행 수. Supabase 기본 응답 상한(1000행)에 맞춘 값이라 사진이 많아도 잘리지 않게 나눠서 읽는다 */
const PAGE_SIZE = 1000
/** 저장소 파일을 한 번에 지우는 개수. 공식 상한을 확인한 값이 아니라 넉넉히 잡은 값이다 */
const REMOVE_CHUNK = 100
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

interface Album {
  id: string
  title: string
  description: string | null
  category: string
  cover_path: string | null
}
interface Photo {
  id: string
  storage_path: string
  caption: string | null
  url?: string
}

/** 앨범 상세: 사진은 비공개 버킷이라 1시간짜리 임시 주소로 보여 준다. 업로드는 임원진만. */
export default function AlbumDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const dialog = useDialog()
  const navigate = useNavigate()
  const isOfficer = profile?.role === 'officer'
  const [album, setAlbum] = useState<Album | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [files, setFiles] = useState<File[]>([])
  const [captions, setCaptions] = useState<string[]>([])
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState('')
  const [captionId, setCaptionId] = useState<string | null>(null)
  const [captionText, setCaptionText] = useState('')
  const [zoom, setZoom] = useState<Photo | null>(null)
  const [fileKey, setFileKey] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [deletingAlbum, setDeletingAlbum] = useState(false)
  const [albumDeleteError, setAlbumDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    const [a, p] = await Promise.all([
      supabase.from('albums').select('id, title, description, category, cover_path').eq('id', id).maybeSingle(),
      supabase
        .from('album_photos')
        .select('id, storage_path, caption')
        .eq('album_id', id)
        .order('created_at', { ascending: true }),
    ])
    if (a.error || p.error) {
      setLoadError('앨범을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      setLoading(false)
      return
    }
    setLoadError(null)
    setAlbum(a.data as Album | null)
    const rows = p.data as Photo[]
    if (rows.length > 0) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(rows.map((r) => r.storage_path), 3600)
      const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
      setPhotos(rows.map((r) => ({ ...r, url: urlByPath.get(r.storage_path) ?? undefined })))
    } else setPhotos([])
    setLoading(false)
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const locked = saving || uploading || deletingAlbum || deletingId !== null

  async function saveAlbum(e: FormEvent) {
    e.preventDefault()
    if (!id || !isOfficer || locked || !title.trim()) return
    setSaving(true)
    setEditError('')
    try {
      const { data, error } = await supabase.from('albums')
        .update({ title: title.trim(), description: description.trim() || null, category })
        .eq('id', id).select('id')
      if (error || !data?.length) { setEditError('앨범 수정에 실패했습니다.'); return }
      setEditing(false)
      await load()
    } finally { setSaving(false) }
  }

  async function saveCaption(p: Photo) {
    if (!id || !isOfficer || locked) return
    setSaving(true)
    setDeleteError(null)
    try {
      const { data, error } = await supabase.from('album_photos')
        .update({ caption: captionText.trim() || null }).eq('id', p.id).eq('album_id', id).select('id')
      if (error || !data?.length) { setDeleteError('사진 설명 수정에 실패했습니다.'); return }
      setCaptionId(null)
      await load()
    } finally { setSaving(false) }
  }

  async function saveCover(p: Photo) {
    if (!id || !isOfficer || locked) return
    setSaving(true)
    setDeleteError(null)
    try {
      const { data, error } = await supabase.from('albums')
        .update({ cover_path: p.storage_path }).eq('id', id).select('id')
      if (error || !data?.length) { setDeleteError('대표 사진 설정에 실패했습니다.'); return }
      await load()
    } finally { setSaving(false) }
  }

  async function downloadPhoto(p: Photo) {
    setDeleteError(null)
    const { data, error } = await supabase.storage.from(BUCKET).download(p.storage_path)
    if (error || !data) { setDeleteError('사진 다운로드에 실패했습니다.'); return }
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'LOGON-' + (p.storage_path.split('/').pop() || 'photo')
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function upload(e: FormEvent) {
    e.preventDefault()
    if (!id || !isOfficer || locked || !files.length) return
    if (files.some(f => !EXT[f.type] || f.size > MAX_BYTES)) {
      return setUploadError('모든 사진은 JPG, PNG, WEBP 형식이며 각각 10MB 이하여야 합니다.')
    }
    setUploadError(null)
    setUploading(true)
    const failed: File[] = []
    const failedCaptions: string[] = []
    try {
      for (const [i, file] of files.entries()) {
        const path = `${id}/${crypto.randomUUID()}.${EXT[file.type]}`
        const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
        if (!up.error) {
          const ins = await supabase.from('album_photos').insert({ album_id: id, storage_path: path, caption: captions[i]?.trim() || null })
          if (!ins.error) continue
          const rm = await supabase.storage.from(BUCKET).remove([path])
          if (rm.error) console.error('업로드 정리 실패', path, rm.error)
        }
        failed.push(file)
        failedCaptions.push(captions[i] || '')
      }
      setFiles(failed)
      setCaptions(failedCaptions)
      setFileKey(k => k + 1)
      if (failed.length) setUploadError(`${failed.length}장 업로드 실패. 다시 시도할 수 있습니다.`)
      await load()
    } finally { setUploading(false) }
  }

  /** 사진 삭제(임원진만): 행을 먼저 지우고, 성공했을 때만 저장소 파일을 지운다. */
  async function removePhoto(p: Photo) {
    if (!isOfficer || locked || !id) return
    const ok = await dialog.confirm({
      title: '사진 삭제',
      message: '이 사진을 삭제할까요? 되돌릴 수 없습니다',
      confirmLabel: '삭제',
      danger: true,
    })
    if (!ok) return
    setDeleteError(null)
    setDeletingId(p.id)
    try {
      // 권한이 없으면 오류 없이 0행이 지워지므로, 지운 행을 돌려받아 실제로 지워졌는지 확인한다
      if (album?.cover_path === p.storage_path) {
        const clear = await supabase.from('albums').update({ cover_path: null }).eq('id', id).eq('cover_path', p.storage_path).select('id')
        if (clear.error || !clear.data?.length) { setDeleteError('대표 사진 해제에 실패했습니다.'); return }
        setAlbum(prev => prev ? { ...prev, cover_path: null } : prev)
      }
      const del = await supabase.from('album_photos').delete().eq('id', p.id).eq('album_id', id).select('id')
      if (del.error || (del.data?.length ?? 0) === 0) {
        // 행 삭제가 실패하면 파일은 건드리지 않는다
        setDeleteError('사진을 삭제하지 못했습니다. 임원진 권한을 확인해 주세요.')
        return
      }
      // 행은 이미 지워졌으므로 사진은 화면에서 바로 뺀다. 파일 삭제 실패는 화면에 띄우지 않고 기록만 남긴다
      setPhotos((prev) => prev.filter((x) => x.id !== p.id))
      const rm = await supabase.storage.from(BUCKET).remove([p.storage_path])
      if (rm.error || (rm.data?.length ?? 0) === 0) {
        console.error('사진 행은 지웠지만 저장소 파일 삭제에 실패했습니다.', p.storage_path, rm.error)
      }
    } finally {
      setDeletingId(null)
    }
  }

  /** 앨범 삭제(임원진만): 사진 경로를 먼저 모아 두고 → 앨범 행을 지우고 → 성공했을 때만 저장소 파일을 지운다. */
  async function removeAlbum() {
    if (!id || !album || !isOfficer || locked) return
    const ok = await dialog.confirmTyping({
      title: '앨범 삭제',
      message: `"${album.title}" 앨범과 안의 사진이 모두 삭제되며 되돌릴 수 없습니다.\n삭제하려면 아래에 앨범 이름을 그대로 입력해 주세요.`,
      expected: album.title,
      confirmLabel: '앨범 삭제',
    })
    if (!ok) return
    setAlbumDeleteError(null)
    setDeletingAlbum(true)
    try {
      // 1) 앨범을 지우면 사진 행도 같이 사라져 경로를 알 수 없으니, 지우기 전에 경로를 전부 모아 둔다
      const paths: string[] = []
      for (let from = 0; ; from += PAGE_SIZE) {
        const page = await supabase
          .from('album_photos')
          .select('storage_path')
          .eq('album_id', id)
          .order('created_at')
          .order('id')
          .range(from, from + PAGE_SIZE - 1)
        if (page.error) {
          setAlbumDeleteError('사진 목록을 확인하지 못해 앨범을 삭제하지 않았습니다. 잠시 후 다시 시도해 주세요.')
          return
        }
        paths.push(...page.data.map((r) => r.storage_path as string))
        if (page.data.length < PAGE_SIZE) break
      }

      // 2) 앨범 행 삭제(사진 행은 cascade). 권한이 없으면 오류 없이 0행이라, 지운 행을 돌려받아 확인한다
      const del = await supabase.from('albums').delete().eq('id', id).select('id')
      if (del.error || (del.data?.length ?? 0) === 0) {
        // 앨범 행 삭제가 실패하면 파일은 건드리지 않는다
        setAlbumDeleteError('앨범을 삭제하지 못했습니다. 임원진 권한을 확인해 주세요.')
        return
      }

      // 3) 앨범 행이 지워진 뒤에만 저장소 파일을 나눠서 지운다. 실패는 화면에 띄우지 않고 기록만 남긴다
      for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
        const chunk = paths.slice(i, i + REMOVE_CHUNK)
        try {
          const rm = await supabase.storage.from(BUCKET).remove(chunk)
          if (rm.error || (rm.data?.length ?? 0) < chunk.length) {
            console.error('앨범은 지웠지만 저장소 파일 일부를 지우지 못했습니다.', chunk, rm.error)
          }
        } catch (err) {
          console.error('앨범은 지웠지만 저장소 파일 삭제 중 오류가 났습니다.', chunk, err)
        }
      }
      navigate('/archive')
    } finally {
      setDeletingAlbum(false)
    }
  }

  if (loading) return <section className="card"><p>불러오는 중...</p></section>
  if (loadError) return <p className="msg error" role="alert">{loadError}</p>
  if (!album) {
    return (
      <section className="card">
        <p>앨범을 찾을 수 없습니다.</p>
        <Link to="/archive" className="btn btn-sm">앨범 목록으로</Link>
      </section>
    )
  }

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h2>{album.title}</h2>
          <span className="badge">{album.category}</span>
        </div>
        {album.description && <p>{album.description}</p>}
        {editing && isOfficer && (
          <form className="form" onSubmit={saveAlbum}>
            <label>제목<input value={title} maxLength={100} required onChange={e => setTitle(e.target.value)} /></label>
            <label>카테고리<select value={category} onChange={e => setCategory(e.target.value)}>
              {[...new Set([...CATEGORIES, category])].map(c => <option key={c}>{c}</option>)}
            </select></label>
            <label>설명<textarea value={description} maxLength={1000} rows={4} onChange={e => setDescription(e.target.value)} /></label>
            {editError && <p className="msg error">{editError}</p>}
            <div className="actions"><button className="btn" disabled={locked}>저장</button><button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setEditing(false)}>취소</button></div>
          </form>
        )}
        <Link to="/archive" className="btn btn-ghost btn-sm">← 앨범 목록</Link>
        {isOfficer && (
          <>
            {albumDeleteError && <p className="msg error" role="alert">{albumDeleteError}</p>}
            <div className="actions">
              <button type="button" className="btn btn-ghost btn-sm" disabled={locked} onClick={() => { setTitle(album.title); setDescription(album.description || ''); setCategory(album.category); setEditError(''); setEditing(true) }}>앨범 수정</button>
              <button
                type="button"
                className="btn btn-sm btn-ghost btn-danger"
                disabled={locked}
                onClick={removeAlbum}
              >
                {deletingAlbum ? '앨범 삭제 중...' : '앨범 삭제'}
              </button>
            </div>
          </>
        )}
      </section>

      {isOfficer && (
        <section className="card">
          <h2>사진 추가</h2>
          <form className="form" onSubmit={upload}>
            <label>
              사진 (JPG·PNG·WEBP, 10MB 이하)
              <input
                key={fileKey}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={locked}
                onChange={(e) => { const selected = Array.from(e.target.files ?? []); setFiles(selected); setCaptions(selected.map(() => '')) }}
              />
            </label>
            {files.map((f, i) => <label key={i}>{f.name}<input maxLength={500} placeholder="사진 설명 (선택)" value={captions[i] || ''} disabled={locked} onChange={e => setCaptions(prev => prev.map((c, j) => i === j ? e.target.value : c))} /></label>)}
            {uploadError && <p className="msg error" role="alert">{uploadError}</p>}
            <div className="actions">
              <button className="btn" disabled={locked || !files.length}>{uploading ? '올리는 중...' : `사진 ${files.length}장 올리기`}</button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <h2>사진 {photos.length}장</h2>
        {deleteError && <p className="msg error" role="alert">{deleteError}</p>}
        {photos.length === 0 ? (
          <p>아직 사진이 없습니다.</p>
        ) : (
          <div className="card-grid">
            {photos.map((p) => (
              <figure key={p.id} style={{ margin: 0 }}>
                {p.url ? (
                  <button type="button" aria-label="사진 확대" onClick={() => setZoom(p)} style={{ padding: 0, border: 0, background: 'transparent', width: '100%', cursor: 'zoom-in' }}><img
                    src={p.url}
                    alt={p.caption || 'LOG:ON 활동 사진'}
                    loading="lazy"
                    style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12, display: 'block' }}
                  /></button>
                ) : (
                  <p className="hint">사진을 불러올 수 없습니다.</p>
                )}
                {album.cover_path === p.storage_path && <span className="badge">대표 사진</span>}
                {p.caption && <figcaption className="hint">{p.caption}</figcaption>}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void downloadPhoto(p)}>다운로드</button>
                {isOfficer && captionId === p.id && <div className="form"><textarea aria-label="사진 설명" maxLength={500} value={captionText} onChange={e => setCaptionText(e.target.value)} /><div className="actions"><button type="button" className="btn btn-sm" disabled={locked} onClick={() => void saveCaption(p)}>저장</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setCaptionId(null)}>취소</button></div></div>}
                {isOfficer && (
                  <div className="actions">
                    <button type="button" className="btn btn-ghost btn-sm" disabled={locked} onClick={() => { setCaptionId(p.id); setCaptionText(p.caption || '') }}>설명 수정</button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={locked || album.cover_path === p.storage_path} onClick={() => void saveCover(p)}>대표 사진 지정</button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost btn-danger"
                      disabled={locked}
                      onClick={() => removePhoto(p)}
                    >
                      {deletingId === p.id ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                )}
              </figure>
            ))}
                   </div>
        )}
      </section>


      {zoom && <div role="dialog" aria-modal="true" aria-label="사진 확대" onClick={() => setZoom(null)} onKeyDown={e => { if (e.key === 'Escape') setZoom(null) }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 12 }}>
        <button type="button" autoFocus className="btn" onClick={() => setZoom(null)}>닫기 ✕</button>
        <img src={zoom.url} alt={zoom.caption || 'LOG:ON 활동 사진'} onClick={e => e.stopPropagation()} style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain' }} />
      </div>}
      {id && <AlbumInteractions key={id} albumId={id} />}
    </>
  )
}
