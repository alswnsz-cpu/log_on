import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useDialog } from '../components/dialog-context'

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

  const [file, setFile] = useState<File | null>(null)
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
      supabase.from('albums').select('id, title, description, category').eq('id', id).maybeSingle(),
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

  async function upload(e: FormEvent) {
    e.preventDefault()
    if (!id || !file) return setUploadError('사진을 선택해 주세요.')
    const ext = EXT[file.type]
    if (!ext) return setUploadError('JPG, PNG, WEBP 사진만 올릴 수 있습니다.')
    if (file.size > MAX_BYTES) return setUploadError('사진은 10MB 이하만 올릴 수 있습니다.')
    setUploadError(null)
    setUploading(true)
    const path = `${id}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false })
    if (up.error) {
      setUploading(false)
      return setUploadError('사진을 올리지 못했습니다. 임원진 권한을 확인해 주세요.')
    }
    const ins = await supabase.from('album_photos').insert({ album_id: id, storage_path: path })
    if (ins.error) {
      // 기록이 실패하면 올린 파일도 지워 고아 파일이 남지 않게 한다
      await supabase.storage.from(BUCKET).remove([path])
      setUploading(false)
      return setUploadError('사진 정보를 저장하지 못했습니다.')
    }
    setUploading(false)
    setFile(null)
    setFileKey((k) => k + 1)
    await load()
  }

  /** 사진 삭제(임원진만): 행을 먼저 지우고, 성공했을 때만 저장소 파일을 지운다. */
  async function removePhoto(p: Photo) {
    if (deletingId) return
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
      const del = await supabase.from('album_photos').delete().eq('id', p.id).select('id')
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
    if (!id || !album || deletingAlbum) return
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
        <Link to="/archive" className="btn btn-light btn-sm">← 앨범 목록</Link>
        {isOfficer && (
          <>
            {albumDeleteError && <p className="msg error" role="alert">{albumDeleteError}</p>}
            <div className="actions">
              <button
                type="button"
                className="btn btn-sm btn-ghost btn-danger"
                disabled={deletingAlbum || deletingId !== null}
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
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {uploadError && <p className="msg error" role="alert">{uploadError}</p>}
            <div className="actions">
              <button className="btn" disabled={uploading || !file || deletingAlbum}>{uploading ? '올리는 중...' : '사진 올리기'}</button>
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
                  <img
                    src={p.url}
                    alt={p.caption || 'LOG:ON 활동 사진'}
                    loading="lazy"
                    style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12, display: 'block' }}
                  />
                ) : (
                  <p className="hint">사진을 불러올 수 없습니다.</p>
                )}
                {p.caption && <figcaption className="hint">{p.caption}</figcaption>}
                {isOfficer && (
                  <div className="actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost btn-danger"
                      disabled={deletingId !== null || deletingAlbum}
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
    </>
  )
}
