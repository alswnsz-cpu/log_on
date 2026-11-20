/** 활동 기록(activity_records): 내가 한 활동. 본인만 읽고 쓴다. 포트폴리오 문장을 만들 때도 쓴다. */
export interface ActivityRecord {
  id: number
  title: string
  category: string | null
  role_text: string | null
  description: string | null
  outcome: string | null
  started_on: string | null
  ended_on: string | null
}

export const RECORD_COLUMNS = 'id, title, category, role_text, description, outcome, started_on, ended_on'

/** "2026.03 ~ 2026.06" 같은 기간 글자. 둘 다 없으면 빈 글자 */
export function periodLabel(r: Pick<ActivityRecord, 'started_on' | 'ended_on'>): string {
  const f = (d: string | null) => (d ? d.slice(0, 7).replace('-', '.') : '')
  if (r.started_on && r.ended_on) return `${f(r.started_on)} ~ ${f(r.ended_on)}`
  if (r.started_on) return `${f(r.started_on)} ~`
  if (r.ended_on) return `~ ${f(r.ended_on)}`
  return ''
}
