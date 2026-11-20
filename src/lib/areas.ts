/**
 * 영역(허브 카드)과 메뉴 설정표. 새 화면을 추가할 때는 여기에 항목을 넣는다.
 * 허브와 영역 메뉴가 모두 이 표와 visibleItems 를 쓰므로 서로 어긋나지 않는다.
 */
export type AreaKey = 'plan' | 'records' | 'portfolio' | 'explore'

export interface AreaItem {
  label: string
  to: string
  /** 졸업생에게는 이 메뉴를 보여 주지 않는다. 메뉴만 숨길 뿐 주소를 직접 입력하면 열리고, DB 권한은 바꾸지 않는다. */
  hideForAlumni?: boolean
}

export interface Area {
  key: AreaKey
  label: string
  /** 허브 카드에 보이는 한 줄 설명 */
  description: string
  /** 이 주소(와 그 아래 주소)로 시작하는 화면은 이 영역에 속한다 */
  paths: string[]
  /** 메뉴 항목. 비어 있으면 허브에서 "준비 중" 카드로 보인다. */
  items: AreaItem[]
}

export const AREAS: Area[] = [
  {
    key: 'plan',
    label: '활동 일정',
    description: '달력과 시간표, 공통 시간을 확인해요.',
    paths: ['/calendar', '/schedule', '/common', '/members'],
    items: [
      { label: '달력', to: '/calendar' },
      { label: '내 시간표', to: '/schedule', hideForAlumni: true },
      { label: '공통 시간', to: '/common', hideForAlumni: true },
      { label: '멤버별', to: '/members' },
    ],
  },
  {
    key: 'records',
    label: '활동 기록',
    description: '토론과 결론, 활동 사진을 모아 봐요.',
    paths: ['/agendas', '/decisions', '/archive'],
    items: [
      { label: '토론', to: '/agendas' },
      { label: '결론', to: '/decisions' },
      { label: '아카이브', to: '/archive' },
    ],
  },
  {
    key: 'portfolio',
    label: '포트폴리오',
    description: '나의 경력과 활동을 정리해요.',
    paths: ['/portfolio'],
    items: [{ label: '포트폴리오', to: '/portfolio' }],
  },
  {
    key: 'explore',
    label: '활동 찾기',
    description: '공모전과 교내 활동을 찾아봐요.',
    paths: [],
    items: [],
  },
]

/** 주소가 속한 영역. 허브(/)와 헤더 화면(관리·내 정보·탈퇴)은 영역이 없다. */
export function areaOfPath(pathname: string): Area | null {
  return AREAS.find((a) => a.paths.some((p) => pathname === p || pathname.startsWith(`${p}/`))) ?? null
}

/** 졸업생이면 숨김 표시가 된 항목을 뺀 메뉴 */
export function visibleItems(area: Area, alumni: boolean): AreaItem[] {
  return area.items.filter((item) => !(alumni && item.hideForAlumni))
}
