import { periodLabel, type ActivityRecord } from './activityRecords'

/**
 * 활동 기록으로 포트폴리오 문장을 만드는 규칙·템플릿(AI 연동 없음).
 * 기록의 칸(활동 이름, 내 역할, 한 일, 결과, 기간)을 정해진 문장 틀에 끼워 넣는다.
 * 만들어진 문장은 그대로 쓰지 않고 다듬어 쓰도록 안내한다.
 */

export interface Suggestion {
  label: string
  text: string
}

/** 직무별로 "이 경험으로 키운 역량"을 설명하는 구절. 목록에 없는 직무(직접 입력)는 기본 구절을 쓴다. */
const JOB_SKILL: Record<string, string> = {
  물류관리: '물류 흐름과 비용을 꼼꼼히 관리하는 역량',
  SCM: '공급망 전체를 연결해서 보는 시각',
  '국제물류·포워딩': '국제 운송 절차와 서류를 정확하게 챙기는 역량',
  '항만·해운': '항만과 해운 현장을 이해하고 협력하는 역량',
  '무역·수출입': '수출입 절차와 거래 조건을 이해하고 조율하는 역량',
  '유통·리테일': '고객과 재고의 흐름을 함께 살피는 역량',
}

const DIGIT_WITH_BATCHIM = new Set(['0', '1', '3', '6', '7', '8'])

/** 글자의 받침 종류: 'none' 받침 없음, 'rieul' ㄹ 받침, 'other' 그 밖의 받침, 'unknown' 알 수 없음(영문 등) */
function batchim(word: string): 'none' | 'rieul' | 'other' | 'unknown' {
  const ch = word.trim().slice(-1)
  if (!ch) return 'unknown'
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const final = (code - 0xac00) % 28
    return final === 0 ? 'none' : final === 8 ? 'rieul' : 'other'
  }
  if (/[0-9]/.test(ch)) return DIGIT_WITH_BATCHIM.has(ch) ? (ch === '1' || ch === '7' || ch === '8' ? 'rieul' : 'other') : 'none'
  return 'unknown'
}

/** 조사 붙이기. 예: josa('팀', '이', '가') → '팀이', josa('조', '이', '가') → '조가'. 알 수 없으면 '이(가)'처럼 둘 다 쓴다. */
function josa(word: string, withBatchim: string, without: string): string {
  const b = batchim(word)
  if (b === 'unknown') return `${word}${withBatchim}(${without})`
  return `${word}${b === 'none' ? without : withBatchim}`
}

/** "~로서 / ~으로서" (ㄹ 받침은 '로서') */
function roleAs(role: string): string {
  const b = batchim(role)
  if (b === 'unknown') return `${role}(으)로서`
  return `${role}${b === 'other' ? '으로서' : '로서'}`
}

/** 글의 첫 문장(길면 자른다). 끝의 마침표는 뗀다. */
function firstSentence(text: string | null, max = 90): string {
  if (!text) return ''
  const first = text.trim().split(/[.\n]/)[0].trim()
  return first.length > max ? `${first.slice(0, max).trim()}…` : first
}

/** 활동 기록 한 개로 만든 문장 후보. 직무(job)는 마지막 "역량" 문장에 쓴다. */
export function suggestSentences(record: ActivityRecord, job: string): Suggestion[] {
  const title = record.title.trim()
  const period = periodLabel(record)
  const role = record.role_text?.trim() ?? ''
  const did = firstSentence(record.description)
  const outcome = firstSentence(record.outcome, 60)
  const result: Suggestion[] = []

  // 1) 경험 소개: 언제, 무엇에서, 어떤 역할로, 무엇을 했는지
  const when = period ? `${period} 동안 ` : ''
  const asRole = role ? `${roleAs(role)} ` : ''
  result.push({
    label: '경험 소개',
    text: `${when}${title}에서 ${asRole}활동했습니다.${did ? ` ${did}.` : ''}`,
  })

  // 2) 역할 강조: 역할이 있을 때
  if (role) {
    result.push({
      label: '역할 강조',
      text: `${title}에서 ${role} 역할을 맡아 ${did ? `${did}.` : '맡은 일을 책임감 있게 수행했습니다.'}`,
    })
  }

  // 3) 성과 중심: 결과가 있을 때
  if (outcome) {
    const quote = `“${outcome}”`
    const called = batchim(outcome) === 'none' ? '라는' : batchim(outcome) === 'unknown' ? '(이)라는' : '이라는'
    result.push({
      label: '성과 중심',
      text: `${title} 활동에서 ${quote}${called} 성과를 거두었습니다.`,
    })
  }

  // 4) 직무 연결: 이 경험으로 키운 역량과 직무
  const skill = JOB_SKILL[job] ?? `${job || '지원 직무'}에 필요한 실무 역량`
  result.push({
    label: '직무 연결',
    text: `이 경험을 통해 ${josa(skill, '을', '를')} 키웠고, ${job || '지원 직무'} 직무에서 이를 발휘하고 싶습니다.`,
  })

  return result
}
