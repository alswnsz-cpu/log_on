import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import Brand, { APP_TAGLINE } from './Brand'

const links = [
  { to: '/', label: '달력', end: true },
  { to: '/schedule', label: '내 시간표' },
  { to: '/common', label: '공통 시간' },
  { to: '/members', label: '멤버별' },
  { to: '/agendas', label: '토론' },
  { to: '/decisions', label: '결론' },
  { to: '/archive', label: '아카이브' },
  { to: '/portfolio', label: '포트폴리오' },
]

/** 졸업생에게는 시간표를 입력하고 맞추는 메뉴를 보여 주지 않는다(본인 시간표 데이터는 그대로 둔다). */
const ALUMNI_HIDDEN = ['/schedule', '/common']

/** locked: 시간표 입력 완료 전이라 내 시간표 메뉴만 보여 준다. alumni: 졸업생이라 시간표 입력·공통 시간 메뉴를 숨긴다. */
export default function Layout({ locked = false, alumni = false }: { locked?: boolean; alumni?: boolean }) {
  const { profile, signOut } = useAuth()
  const isOfficer = profile?.role === 'officer'
  const shown = locked
    ? links.filter((l) => l.to === '/schedule')
    : alumni
      ? links.filter((l) => !ALUMNI_HIDDEN.includes(l.to))
      : links

  return (
    <>
      <header className="app-header">
        <div className="header-row">
          <div>
            <Brand />
            <p className="tagline">{APP_TAGLINE}</p>
            <p>
              {profile?.name}님 {isOfficer && '· 임원진'}
              {alumni && '· 졸업생'}
            </p>
          </div>
          <div className="header-actions">
            <Link to="/profile" className="btn btn-light btn-sm">
              내 정보
            </Link>
            <button className="btn btn-light btn-sm" onClick={signOut}>
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <nav className="nav">
        {shown.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            {l.label}
          </NavLink>
        ))}
        {isOfficer && <NavLink to="/admin">관리</NavLink>}
      </nav>
      <main className="container">
        <Outlet />
      </main>
    </>
  )
}
