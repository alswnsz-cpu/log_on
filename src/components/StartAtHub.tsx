import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** 이 탭에서 "시작 화면 처리"를 이미 했다는 표시(같은 탭의 새로고침과 새로 열기를 구분한다) */
const FLAG = 'logon:start-handled'
/** 허브로 보내지 않는 경로(앞부분 일치). 로그인·가입·비밀번호 재설정은 경로가 아니라 로그인 상태로 나뉘어 여기까지 오지 않는다 */
const EXEMPT_PREFIXES = ['/api']

/**
 * 앱을 새로 열 때(새 탭·주소 직접 입력·즐겨찾기·브라우저 재시작) 어떤 주소로 들어와도 허브(/)로 보낸다.
 * 같은 탭의 새로고침(F5)은 현재 화면을 유지한다. 승인된 로그인 상태에서만 그려지므로 로그인 직후에도 한 번 동작한다.
 */
export default function StartAtHub({ open }: { open: boolean }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    let handled = true // 저장소를 못 쓰면 이동하지 않는다(새로고침 때마다 튕기는 것보다 안전)
    try {
      handled = sessionStorage.getItem(FLAG) === '1'
      if (!handled) sessionStorage.setItem(FLAG, '1')
    } catch {
      handled = true
    }
    if (handled) return
    // 시간표를 입력하기 전(open=false)에는 허브가 닫혀 있어 기존 규칙대로 /schedule로 간다
    if (!open) return
    if (pathname === '/' || EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return
    navigate('/', { replace: true })
    // 처음 한 번만 실행한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
