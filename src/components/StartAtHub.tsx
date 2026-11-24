import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/** 허브로 보내지 않는 경로(앞부분 일치). 로그인·가입·비밀번호 재설정은 경로가 아니라 로그인 상태로 나뉘어 여기까지 오지 않는다 */
const EXEMPT_PREFIXES = ['/api']

/** "페이지를 연 뒤 첫 판단"을 이미 했는지. 모듈 변수라 새로고침·탭 복원 때는 자연히 처음 상태로 돌아온다 */
let judged = false
/** 로그인 화면을 거쳤으면 F5 예외를 적용하지 않는다(로그인 화면에서 F5 한 뒤 로그인해도 허브로 간다) */
let ignoreReload = false

/** 이 페이지 로드가 새로고침(F5)인지. 읽지 못하면 새로고침이 아닌 것으로 본다 */
function isReload(): boolean {
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    return nav?.type === 'reload'
  } catch {
    return false
  }
}

/**
 * 앱을 새로 열 때(새 탭·주소 직접 입력·즐겨찾기·탭 복원·뒤로/앞으로로 돌아옴) 어떤 주소로 들어와도 허브(/)로 보낸다.
 * 새로고침(F5)은 현재 화면을 유지한다. 판단은 페이지 로드 후(또는 로그인 후) 처음 한 번뿐이라,
 * 앱 안에서 화면을 이동할 때는 절대 허브로 보내지 않는다. 승인된 로그인 상태에서만 그려진다.
 */
export default function StartAtHub({ open }: { open: boolean }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (judged) return
    judged = true
    if (!ignoreReload && isReload()) return
    // 시간표를 입력하기 전(open=false)에는 허브가 닫혀 있어 기존 규칙대로 /schedule로 간다
    if (!open) return
    if (pathname === '/' || EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return
    navigate('/', { replace: true })
    // 처음 한 번만 실행한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

/** 로그인 세션이 없는 화면(로그인·로그아웃 뒤)에 그려 둔다. 다시 로그인하면 허브로 가도록 판단 상태를 초기화한다. */
export function ResetStartAtHub() {
  useEffect(() => {
    judged = false
    ignoreReload = true
  }, [])
  return null
}
