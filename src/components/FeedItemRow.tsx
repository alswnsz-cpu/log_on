import { safeHref, type FeedItem } from '../lib/activityFeed'

interface Props {
  item: FeedItem
  /** 교내활동에서 즐겨찾기 버튼을 보여 줄 때 */
  favorite?: { saved: boolean; busy: boolean; disabled: boolean; onToggle: () => void }
}

/** 공고 한 줄: 제목(원문 링크), 분류·출처·날짜 정보, 즐겨찾기 버튼 */
export default function FeedItemRow({ item, favorite }: Props) {
  const href = safeHref(item.url)
  const meta = [
    item.scope,
    item.category,
    item.topics && item.topics.length > 0 ? item.topics.join(' · ') : '',
    item.source,
    item.date && `게시 ${item.date}`,
    item.deadline && `마감 ${item.deadline}`,
  ].filter(Boolean)

  return (
    <div className="post-item">
      <div className="section-head">
        {href ? (
          <a className="feed-title" href={href} target="_blank" rel="noopener noreferrer">
            {item.title}
          </a>
        ) : (
          <span className="feed-title">{item.title}</span>
        )}
        {favorite && (
          <button
            type="button"
            className={favorite.saved ? 'chip on' : 'chip'}
            aria-pressed={favorite.saved}
            aria-label={`${item.title} 즐겨찾기`}
            disabled={favorite.disabled || favorite.busy}
            onClick={favorite.onToggle}
          >
            {favorite.saved ? '★ 저장됨' : '☆ 즐겨찾기'}
          </button>
        )}
      </div>
      {meta.length > 0 && <p className="hint">{meta.join(' / ')}</p>}
    </div>
  )
}
