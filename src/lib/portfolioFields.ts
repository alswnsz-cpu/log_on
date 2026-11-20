/** 포트폴리오 문서(portfolio_documents)의 칸 구성과 직무 기본 목록. */

export interface FieldDef {
  key: string
  label: string
  /** 한 줄 입력이면 true, 아니면 여러 줄 입력 */
  short?: boolean
  rows?: number
}

export interface SectionDef {
  title: string
  fields: FieldDef[]
}

/** 직무 기본 목록. 이 밖의 직무는 직접 입력한다. */
export const DEFAULT_JOBS = ['물류관리', 'SCM', '국제물류·포워딩', '항만·해운', '무역·수출입', '유통·리테일']

/** 칸별 글(키 → 글) */
export type Content = Record<string, string>

/** 한 칸에 쓸 수 있는 최대 글자 수 */
export const MAX_FIELD = 10000

export const SECTIONS: SectionDef[] = [
  {
    title: '기본 정보',
    fields: [
      { key: 'headline', label: '한 줄 소개', short: true },
      { key: 'bio', label: '자기소개', rows: 5 },
      { key: 'education', label: '학력 및 전공', rows: 3 },
      { key: 'career_goal', label: '희망 직무 및 커리어 목표', rows: 3 },
      { key: 'contact', label: '공개할 연락처', short: true },
    ],
  },
  {
    title: '경력 및 활동',
    fields: [
      { key: 'experience', label: '경력 및 인턴 경험', rows: 4 },
      { key: 'projects', label: '프로젝트 · 공모전', rows: 4 },
      { key: 'skills', label: '보유 역량', rows: 3 },
    ],
  },
  {
    title: '자기소개서',
    fields: [
      { key: 'cover_motive', label: '지원 동기', rows: 5 },
      { key: 'cover_skill', label: '직무 역량과 경험', rows: 5 },
      { key: 'cover_strength', label: '성격의 장단점과 협업 경험', rows: 5 },
      { key: 'cover_goal', label: '입사 후 포부', rows: 5 },
    ],
  },
]

/** 문장 만들기 결과를 붙일 수 있는 칸 */
export const SENTENCE_TARGETS: { key: string; label: string }[] = [
  { key: 'projects', label: '프로젝트 · 공모전' },
  { key: 'experience', label: '경력 및 인턴 경험' },
  { key: 'cover_skill', label: '자기소개서: 직무 역량과 경험' },
  { key: 'cover_strength', label: '자기소개서: 성격의 장단점과 협업 경험' },
]

/** 저장할 때 알려진 칸만 남기고 글자 수를 자른다 */
export function cleanContent(content: Content): Content {
  const clean: Content = {}
  for (const section of SECTIONS) {
    for (const f of section.fields) clean[f.key] = (content[f.key] ?? '').slice(0, MAX_FIELD)
  }
  return clean
}
