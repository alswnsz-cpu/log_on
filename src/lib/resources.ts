/**
 * 활동 찾기 > 사이트 정리에 보여 주는 고정 링크 카드.
 * 링크를 바꾸거나 추가하려면 이 목록만 고치면 된다. 주소는 반드시 https:// 로 시작해야 한다.
 * (원본 LOG:ON의 "사이트 정리" 화면에서 가져온 내용이다.)
 */
export interface ResourceLink {
  name: string
  url: string
  description: string
}

export interface ResourceGroup {
  title: string
  links: ResourceLink[]
}

export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    title: '대외활동 · 공모전',
    links: [
      {
        name: '링커리어',
        url: 'https://linkareer.com/',
        description: '대외활동·공모전에서 ‘물류’, ‘무역’, ‘SCM’으로 검색하고 지원 대상과 마감일을 확인하세요.',
      },
      {
        name: '올콘',
        url: 'https://www.all-con.co.kr/',
        description: '공모전이나 대외활동 분야를 선택한 뒤 참가 자격, 팀 구성, 제출 형식을 공고에서 확인하세요.',
      },
      {
        name: '위비티',
        url: 'https://www.wevity.com/',
        description: '공모전·대외활동 목록을 둘러보고 관심 공고의 접수 일정과 제출물을 비교해 보세요.',
      },
    ],
  },
  {
    title: '직무 · 진로 탐색',
    links: [
      {
        name: '고용24',
        url: 'https://www.work24.go.kr/',
        description: '채용정보에서 ‘물류관리’나 ‘포워딩’을 검색해 주요 업무와 자격 요건을 비교하세요. 직업심리검사도 활용할 수 있습니다.',
      },
      {
        name: '임금직업포털(워크피디아)',
        url: 'https://www.wagework.go.kr/pt/index.do',
        description: '임금정보에서 관심 직종의 경력이나 사업체 규모 조건을 바꿔 보며 임금 수준을 비교하세요.',
      },
      {
        name: '커리어넷',
        url: 'https://www.career.go.kr/',
        description: '직업백과에서 관심 직업을 검색해 하는 일, 필요한 역량, 관련 학과를 확인하세요.',
      },
      {
        name: 'NCS 국가직무능력표준',
        url: 'https://www.ncs.go.kr/',
        description: 'NCS 검색에서 ‘물류관리’나 ‘수출입관리’를 찾아 필요한 능력단위와 직무 역량을 확인하세요.',
      },
    ],
  },
]
