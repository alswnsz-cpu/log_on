import { Link } from 'react-router-dom'
import { AREAS, visibleItems, type Area } from '../lib/areas'

/** to 가 null 이면 아직 화면이 없는 영역("준비 중") */
interface Card {
  area: Area
  to: string | null
}

/** 로그인 후 첫 화면. 카드를 누르면 그 영역의 첫 메뉴로 가고, 영역 메뉴가 따라서 나타난다. */
export default function Hub({ alumni }: { alumni: boolean }) {
  // 메뉴가 아직 없는 영역은 "준비 중" 카드로, 졸업생에게 보일 메뉴가 하나도 없는 영역은 카드를 그리지 않는다
  const cards = AREAS.flatMap((area): Card[] => {
    if (area.items.length === 0) return [{ area, to: null }]
    const first = visibleItems(area, alumni)[0]
    return first ? [{ area, to: first.to }] : []
  })

  return (
    <section className="hub" aria-labelledby="hub-heading">
      <h2 id="hub-heading">무엇을 할까요?</h2>
      <div className="hub-grid">
        {cards.map(({ area, to }) =>
          to ? (
            <Link key={area.key} to={to} className="hub-card">
              <strong>{area.label}</strong>
              <span>{area.description}</span>
            </Link>
          ) : (
            <div key={area.key} className="hub-card hub-card-off" aria-disabled="true">
              <strong>{area.label}</strong>
              <span>{area.description}</span>
              <span className="badge muted">준비 중</span>
            </div>
          ),
        )}
      </div>
    </section>
  )
}
