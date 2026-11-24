export type DebateStance = 'agree' | 'disagree'

export type DebateStage =
  | 'pre'
  | 'discussing'
  | 'post'
  | 'voting'
  | 'closed'

export const DEBATE_STAGES: DebateStage[] = [
  'pre',
  'discussing',
  'post',
  'voting',
  'closed',
]

export const DEBATE_STAGE_LABEL: Record<DebateStage, string> = {
  pre: '토론 전 입장 등록',
  discussing: '토론 진행',
  post: '토론 후 의견 제출',
  voting: 'MVP 투표',
  closed: '토론 종료',
}

export const DEBATE_STANCE_LABEL: Record<DebateStance, string> = {
  agree: '찬성',
  disagree: '반대',
}

export const MVP_CRITERIA = [
  { title: '논리성', description: '주장과 근거의 타당성' },
  { title: '자료 활용', description: '객관적인 통계 및 자료 활용' },
  { title: '반론 능력', description: '상대방 주장에 대한 대응' },
  { title: '참여도', description: '적극적인 토론 참여' },
  { title: '토론 태도', description: '경청과 존중' },
  { title: '설득력', description: '새로운 관점 및 사고 확장에 기여' },
]

export interface DebateOpinion {
  user_id: string
  stance: DebateStance
}

export function percentage(value: number, total: number): number {
  return total > 0
    ? Math.round((value / total) * 1000) / 10
    : 0
}

export function calculateDebateResults(
  participantIds: string[],
  pre: DebateOpinion[],
  post: DebateOpinion[],
) {
  const participants = new Set(participantIds)
  const preMap = new Map(
    pre.filter(o => participants.has(o.user_id))
      .map(o => [o.user_id, o.stance]),
  )
  const postMap = new Map(
    post.filter(o => participants.has(o.user_id))
      .map(o => [o.user_id, o.stance]),
  )

  let agreeToDisagree = 0
  let disagreeToAgree = 0
  let unchanged = 0

  for (const [id, before] of preMap) {
    const after = postMap.get(id)
    if (!after) continue

    if (before === after) unchanged++
    else if (before === 'agree') agreeToDisagree++
    else disagreeToAgree++
  }

  const changed = agreeToDisagree + disagreeToAgree
  const compared = changed + unchanged

  const preAgree = [...preMap.values()]
    .filter(s => s === 'agree').length
  const postAgree = [...postMap.values()]
    .filter(s => s === 'agree').length

  return {
    participantCount: participants.size,
    preSubmitted: preMap.size,
    postSubmitted: postMap.size,
    preAgree,
    preDisagree: preMap.size - preAgree,
    postAgree,
    postDisagree: postMap.size - postAgree,
    preAgreeRate: percentage(preAgree, preMap.size),
    postAgreeRate: percentage(postAgree, postMap.size),
    agreeToDisagree,
    disagreeToAgree,
    unchanged,
    changed,
    compared,
    changeRate: percentage(changed, compared),
    conclusionRate: percentage(postMap.size, participants.size),
  }
}
