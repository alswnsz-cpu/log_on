import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { areaOfPath } from '../lib/areas'
import AreaNav from './AreaNav'
import Brand, { APP_TAGLINE } from './Brand'

/**
 * 상단 헤더(부원 관리·내 정보·로그아웃)와, 영역이 있는 화면에서는 영역 메뉴를 보여 준다.
 * locked: 시간표 입력 완료 전이라 허브와 영역 메뉴 없이 내 시간표만 열린다.
 * alumni: 졸업생이라 src/lib/areas.ts 에서 숨김으로 표시한 메뉴를 보여 주지 않는다.
 */
export default function Layout({ locked = false, alumni = false }: { locked?: boolean; alumni?: boolean }) {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const isOfficer = profile?.role === 'officer'
  // 허브(/)와 관리·내 정보·탈퇴 화면은 영역이 없어서 메뉴 없이 본문만 보인다
  const area = locked ? null : areaOfPath(pathname)

  return (
    <>
      <header className={area ? 'app-header has-nav' : 'app-header'}>
        <div className="header-row">
          <div>
            <Link to="/" className="brand-link" aria-label="Log_on 처음으로">
              <Brand />
            </Link>
            <p className="tagline">{APP_TAGLINE}</p>
            <p>
              {profile?.name}님 {isOfficer && '· 임원진'}
              {alumni && '· 졸업생'}
            </p>
          </div>
          <div className="header-actions">
            {isOfficer && (
              <Link to="/admin" className="btn btn-light btn-sm">
                관리
              </Link>
            )}
            <Link to="/profile" className="btn btn-light btn-sm">
              내 정보
            </Link>
            <button className="btn btn-light btn-sm" onClick={signOut}>
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <div className={area ? 'app-shell has-nav' : 'app-shell'}>
        {area && <AreaNav area={area} alumni={alumni} />}
        <main className="container">
          <Outlet />
        </main>
      </div>
    </>
  )
}
