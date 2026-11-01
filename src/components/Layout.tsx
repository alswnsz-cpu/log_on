import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import Brand, { APP_TAGLINE } from './Brand'

const links = [
  { to: '/', label: '내 시간표', end: true },
  { to: '/common', label: '공통 시간' },
  { to: '/agendas', label: '토론' },
  { to: '/decisions', label: '결론' },
]

/** locked: 시간표 입력 완료 전이라 내 시간표 메뉴만 보여 준다. */
export default function Layout({ locked = false }: { locked?: boolean }) {
  const { profile, signOut } = useAuth()
  const isOfficer = profile?.role === 'officer'
  const shown = locked ? links.slice(0, 1) : links

  return (
    <>
      <header className="app-header">
        <div className="header-row">
          <div>
            <Brand />
            <p className="tagline">{APP_TAGLINE}</p>
            <p>
              {profile?.name}님 {isOfficer && '· 임원진'}
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
      {!isOfficer && (
        <footer className="app-footer">
          <Link to="/withdraw">탈퇴 신청</Link>
        </footer>
      )}
    </>
  )
}
