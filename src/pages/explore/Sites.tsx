import { RESOURCE_GROUPS } from '../../lib/resources'

/** 활동 찾기 > 사이트 정리: 대외활동·공모전과 직무·진로를 찾을 때 쓰는 사이트 링크 카드(고정 목록). */
export default function Sites() {
  return (
    <>
      <section className="card">
        <h2>사이트 정리</h2>
        <p className="hint">
          대외활동·공모전과 직무·진로를 찾을 때 자주 쓰는 사이트를 모았어요. 누르면 새 창으로 열려요.
        </p>
      </section>

      {RESOURCE_GROUPS.map((group) => (
        <section key={group.title} className="card">
          <h2>{group.title}</h2>
          <div className="resource-grid">
            {group.links.map((link) => (
              <a
                key={link.url}
                className="resource-card"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>{link.name}</strong>
                <span>{link.description}</span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
