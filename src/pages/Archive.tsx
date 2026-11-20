import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

const ALBUM_CATEGORIES = ['동아리 활동', '견학', '공모전', '스터디', '친목 활동', '기타']

interface AlbumRow {
  id: string
  title: string
  description: string | null
  category: string
  created_at: string
}

/** LOG:ON 아카이브: 활동 앨범 목록. 승인된 부원은 보기, 임원진은 앨범 만들기 */
export default function Archive() {
  const { profile } = useAuth()
  const isOfficer = profile?.role === 'officer'
  const [albums, setAlbums] = useState<AlbumRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(ALBUM_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('albums')
      .select('id, title, description, category, created_at')
      .order('created_at', { ascending: false })
    if (error) setLoadError('앨범을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    else {
      setLoadError(null)
      setAlbums(data as AlbumRow[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function create(e: FormEvent) {
    e.preventDefault()
    const t = title.trim()
    if (t.length < 1 || t.length > 100) return setFormError('앨범 제목은 1~100자로 입력해 주세요.')
    if (description.length > 1000) return setFormError('설명은 1000자 이하로 입력해 주세요.')
    setFormError(null)
    setSaving(true)
    const { error } = await supabase
      .from('albums')
      .insert({ title: t, category, description: description.trim() || null })
    setSaving(false)
    if (error) return setFormError('앨범을 만들지 못했습니다. 임원진 권한을 확인해 주세요.')
    setTitle('')
    setDescription('')
    setCategory(ALBUM_CATEGORIES[0])
    setShowForm(false)
    await load()
  }

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h2>아카이브</h2>
          {isOfficer && (
            <button className="btn btn-sm" onClick={() => setShowForm((v) => !v)}>
              {showForm ? '닫기' : '새 앨범'}
            </button>
          )}
        </div>
        <p className="hint">LOG:ON 활동 사진을 앨범으로 모아 둡니다. 사진 추가는 임원진만 할 수 있습니다.</p>
        {showForm && (
          <form className="form" onSubmit={create}>
            <label>
              앨범 제목
              <input
                value={title}
                maxLength={100}
                placeholder="예: 2026 부산항 신항 견학"
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label>
              카테고리
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {ALBUM_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              설명 (선택)
              <textarea value={description} maxLength={1000} rows={4} onChange={(e) => setDescription(e.target.value)} />
            </label>
            {formError && <p className="msg error" role="alert">{formError}</p>}
            <div className="actions">
              <button className="btn" disabled={saving}>{saving ? '저장 중...' : '앨범 만들기'}</button>
            </div>
          </form>
        )}
      </section>

      {loadError && <p className="msg error" role="alert">{loadError}</p>}
      {loading ? (
        <section className="card"><p>불러오는 중...</p></section>
      ) : albums.length === 0 ? (
        <section className="card"><p>아직 등록된 앨범이 없습니다.</p></section>
      ) : (
        <div className="card-grid">
          {albums.map((a) => (
            <Link key={a.id} to={`/archive/${a.id}`} className="card agenda-card">
              <div className="section-head">
                <h2>{a.title}</h2>
                <span className="badge">{a.category}</span>
              </div>
              {a.description && <p>{a.description}</p>}
              <p className="hint">{new Date(a.created_at).toLocaleDateString('ko-KR')}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
