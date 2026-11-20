import { useState } from 'react'
import { Link } from 'react-router-dom'
import FeedItemRow from '../../components/FeedItemRow'
import { TOPICS, formatFeedTime } from '../../lib/activityFeed'
import { useFeed } from '../../lib/useFeed'

/** 활동 찾기 > 대외활동: 물류·무역·유통·해운·항만 관련 공모전·서포터즈·대학생 활동 공고(자동 수집). */
export default function External() {
  const { data, error, loading, refresh } = useFeed('external')
  const [topic, setTopic] = useState('')
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const shown = (data?.items ?? []).filter(
    (item) => item.title.toLowerCase().includes(q) && (!topic || item.topics?.includes(topic)),
  )

  let status = ''
  if (data) {
    status = [
      `확인 ${formatFeedTime(data.checkedAt)}`,
      data.stale ? '이전 수집 자료' : data.partial ? '일부 출처의 최신 자료를 확인하지 못했습니다.' : '',
      shown.length > 0 ? `${shown.length}건` : '조건에 맞는 공고가 없습니다.',
    ]
      .filter(Boolean)
      .join(' · ')
  } else if (loading) {
    status = '공고를 확인 중입니다.'
  }

  return (
    <>
      <section className="card">
        <h2>대외활동</h2>
        <p className="hint">
          물류·무역·유통·해운·항만 분야의 공모전, 서포터즈, 대학생 활동 공고와 모집 관련 보도를 자동으로 모아요. 마감일과 접수 여부는 원문에서 확인하세요.
        </p>
        <div className="form" style={{ marginTop: 12 }}>
          <label>
            분야
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              <option value="">전체 분야</option>
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            제목 검색
            <input type="search" value={query} placeholder="공모전, 서포터즈 등" onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="actions">
            <button type="button" className="btn btn-sm btn-ghost" disabled={loading} onClick={refresh}>
              {loading ? '확인 중...' : '다시 확인'}
            </button>
          </div>
        </div>
      </section>

      {data?.stale && (
        <p className="msg notice" role="status">
          최신 공고를 확인하지 못해 {formatFeedTime(data.checkedAt)}에 수집한 이전 자료를 보여 드려요. 마감일은 원문에서 꼭 확인해 주세요.
        </p>
      )}
      {error && data && (
        <p className="msg notice" role="status">다시 확인하지 못했습니다. 마지막으로 불러온 공고를 표시합니다.</p>
      )}
      {error && !data && (
        <p className="msg error" role="alert">
          {error} <Link to="/explore/sites">사이트 정리</Link>에서 직접 찾아볼 수 있어요.
        </p>
      )}

      <section className="card">
        {status && <p className="hint" role="status">{status}</p>}
        {shown.length > 0 && (
          <div className="post-list">
            {shown.map((item) => (
              <FeedItemRow key={item.url} item={item} />
            ))}
          </div>
        )}
      </section>
    </>
  )
}
