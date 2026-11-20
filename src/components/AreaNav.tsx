import { useEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { visibleItems, type Area } from '../lib/areas'

/**
 * 영역 메뉴. 한 요소를 CSS가 폭에 따라 바꾼다:
 * 화면 폭 1000px 이상은 왼쪽 세로 사이드바, 그보다 좁으면 위쪽 가로 칩 줄.
 */
export default function AreaNav({ area, alumni }: { area: Area; alumni: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const items = visibleItems(area, alumni)

  useEffect(() => {
    // 칩 줄이 가로로 넘칠 때만, 지금 메뉴가 가운데 오도록 줄만 스크롤한다(화면 전체는 움직이지 않는다)
    const nav = ref.current
    const active = nav?.querySelector<HTMLElement>('a.active')
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return
    nav.scrollTo({ left: active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2 })
  }, [pathname])

  return (
    <nav ref={ref} className="area-nav" aria-label={`${area.label} 메뉴`}>
      <p className="area-nav-title">{area.label}</p>
      <Link to="/" className="area-nav-home">
        ← 처음으로
      </Link>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}
