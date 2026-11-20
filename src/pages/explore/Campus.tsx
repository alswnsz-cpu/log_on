import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/useAuth'
import FeedItemRow from '../../components/FeedItemRow'
import {
  KSU_NOTICE_URL,
  TOPICS,
  formatFeedTime,
  safeHref,
  sinceKst,
  type FeedItem,
} from '../../lib/activityFeed'
import { useFeed } from '../../lib/useFeed'

/** 활동 찾기 > 교내활동: 경성대학교 프로그램·모집 공고(자동 수집)와 내 즐겨찾기. */
export default function Campus() {
  const { session } = useAuth()
  const myId = session!.user.id
  const { data, error, loading, refresh } = useFeed('campus')

  /** 즐겨찾기(공고 키 → 공고). null 이면 아직 불러오는 중이거나 불러오지 못한 것 */
  const [favorites, setFavorites] = useState<Map<string, FeedItem> | null>(null)
  const [favError, setFavError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  /** '' 전체, 'favorites' 나의 즐겨찾기, 'related' 관련 분야 전체, 'topic:물류', 'type:공고유형' */
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [days, setDays] = useState('')

  const loadFavorites = useCallback(async () => {
    const { data: rows, error: err } = await supabase
      .from('campus_favorites')
      .select('notice_key, data')
      .order('saved_at', { ascending: false })
    if (err) {
      setFavError('즐겨찾기를 불러오지 못했습니다. 다시 확인을 눌러 주세요.')
      return
    }
    setFavError(null)
    setFavorites(new Map(rows.map((r) => [r.notice_key as string, { ...(r.data as FeedItem), key: r.notice_key as string }])))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFavorites()
  }, [loadFavorites])

  async function toggleFavorite(item: FeedItem) {
    const key = item.key ?? item.url
    const saved = favorites?.has(key) ?? false
    setFavError(null)
    setBusyKey(key)
    const result = saved
      ? await supabase.from('campus_favorites').delete().eq('user_id', myId).eq('notice_key', key).select('notice_key')
      : await supabase
          .from('campus_favorites')
          .upsert({ user_id: myId, notice_key: key, data: item }, { onConflict: 'user_id,notice_key' })
          .select('notice_key')
    setBusyKey(null)
    if (result.error) return setFavError('즐겨찾기를 바꾸지 못했습니다. 다시 시도해 주세요.')
    setFavorites((prev) => {
      const next = new Map(prev ?? [])
      if (saved) next.delete(key)
      else next.set(key, { ...item, key })
      return next
    })
  }

  const types = [...new Set((data?.items ?? []).map((i) => i.category).filter(Boolean))].sort()
  const showingFavorites = category === 'favorites'
  const q = query.trim().toLowerCase()
  const range = days ? sinceKst(Number(days)) : null

  const source = showingFavorites ? [...(favorites?.values() ?? [])] : (data?.items ?? [])
  const shown = source.filter((item) => {
    if (!item.title.toLowerCase().includes(q)) return false
    if (category === 'related' && !(item.topics && item.topics.length > 0)) return false
    if (category.startsWith('topic:') && !item.topics?.includes(category.slice(6))) return false
    if (category.startsWith('type:') && item.category !== category.slice(5)) return false
    if (range && !(item.date && item.date >= range.from && item.date <= range.to)) return false
    return true
  })

  const ksuLink = safeHref(KSU_NOTICE_URL)

  let status: string
  if (showingFavorites) {
    status = shown.length > 0
      ? `${shown.length}건`
      : favorites === null
        ? '즐겨찾기를 확인 중입니다.'
        : favorites.size > 0
          ? '조건에 맞는 즐겨찾기가 없습니다.'
          : '저장한 즐겨찾기가 없습니다.'
  } else if (!data) {
    status = loading ? '공고를 확인 중입니다.' : ''
  } else {
    status = [
      `확인 ${formatFeedTime(data.checkedAt)}`,
      data.stale ? '이전 수집 자료' : data.partial ? '일부 출처의 최신 자료를 확인하지 못했습니다.' : '',
      shown.length > 0 ? `${shown.length}건` : '조건에 맞는 공고가 없습니다.',
    ]
      .filter(Boolean)
      .join(' · ')
  }

  return (
    <>
      <section className="card">
        <h2>교내활동</h2>
        <p className="hint">
          경성대학교 프로그램과 모집 공고를 모아 보여 드려요(모여봄이 모은 학교 공지). 분야는 공고 제목을 기준으로 나눠요. 접수 여부와 마감은 원문에서 확인하세요.
        </p>
        <div className="form" style={{ marginTop: 12 }}>
          <label>
            분류
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">전체 분류</option>
              <option value="favorites">나의 즐겨찾기</option>
              <option value="related">물류·무역·유통·해운·항만 전체</option>
              <optgroup label="관련 분야">
                {TOPICS.map((t) => (
                  <option key={t} value={`topic:${t}`}>
                    {t}
                  </option>
                ))}
              </optgroup>
              {types.length > 0 && (
                <optgroup label="공고 유형">
                  {types.map((t) => (
                    <option key={t} value={`type:${t}`}>
                      {t}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <label>
            제목 검색
            <input type="search" value={query} placeholder="비교과, 특강, 서포터즈 등" onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label>
            게시일
            <select value={days} onChange={(e) => setDays(e.target.value)}>
              <option value="">전체 기간</option>
              <option value="1">오늘</option>
              <option value="7">최근 7일</option>
              <option value="30">최근 30일</option>
              <option value="90">최근 90일</option>
            </select>
          </label>
          <div className="actions">
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={loading}
              onClick={() => {
                if (favorites === null) loadFavorites()
                refresh()
              }}
            >
              {loading ? '확인 중...' : '다시 확인'}
            </button>
          </div>
        </div>
      </section>

      {data?.stale && (
        <p className="msg notice" role="status">
          최신 공고를 확인하지 못해 {formatFeedTime(data.checkedAt)}에 수집한 이전 자료를 보여 드려요. 원문은 경성대학교 교내소식에서 확인해 주세요.
        </p>
      )}
      {error && data && (
        <p className="msg notice" role="status">다시 확인하지 못했습니다. 마지막으로 불러온 공고를 표시합니다.</p>
      )}
      {error && !data && !showingFavorites && (
        <p className="msg error" role="alert">
          {error}{' '}
          {ksuLink && (
            <a href={ksuLink} target="_blank" rel="noopener noreferrer">
              경성대학교 교내소식 바로가기
            </a>
          )}
        </p>
      )}
      {favError && <p className="msg error" role="alert">{favError}</p>}

      <section className="card">
        {status && <p className="hint" role="status">{status}</p>}
        {shown.length > 0 && (
          <div className="post-list">
            {shown.map((item) => {
              const key = item.key ?? item.url
              return (
                <FeedItemRow
                  key={key}
                  item={item}
                  favorite={{
                    saved: favorites?.has(key) ?? false,
                    busy: busyKey === key,
                    disabled: favorites === null,
                    onToggle: () => toggleFavorite(item),
                  }}
                />
              )
            })}
          </div>
        )}
      </section>

      {data?.sources && data.sources.length > 0 && (
        <section className="card">
          <details>
            <summary>원본 게시판</summary>
            <ul className="list">
              {data.sources.map((s) => {
                const href = s.url ? safeHref(s.url) : null
                const state = s.state === 'live' ? '원본 확인' : s.state === 'provided' ? '제공 자료' : '최신 확인 안 됨'
                return (
                  <li key={s.name}>
                    <span className="name">
                      {href ? (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {s.name}
                        </a>
                      ) : (
                        s.name
                      )}
                      <span className="hint" style={{ display: 'block' }}>
                        {state}
                        {s.checkedAt && ` · ${formatFeedTime(s.checkedAt)}`}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </details>
          {ksuLink && (
            <p className="hint" style={{ marginTop: 8 }}>
              <a href={ksuLink} target="_blank" rel="noopener noreferrer">
                경성대학교 교내소식 바로가기
              </a>
            </p>
          )}
        </section>
      )}
    </>
  )
}
