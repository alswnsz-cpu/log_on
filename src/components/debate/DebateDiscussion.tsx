import { useState } from 'react'
import {
  DEBATE_STANCE_LABEL,
  percentage,
  type DebateStance,
} from '../../lib/debateWorkflow'
import type { PreOpinion } from './DebatePreOpinion'
import type { DebateMember } from './DebateParticipants'

interface Props {
  opinions: PreOpinion[]
  members: DebateMember[]
  participantCount: number
}

type Filter = 'all' | DebateStance

export default function DebateDiscussion({
  opinions,
  members,
  participantCount,
}: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const names = new Map(
    members.map(member => [member.id, member.name]),
  )

  const agree = opinions.filter(
    opinion => opinion.stance === 'agree',
  ).length

  const disagree = opinions.filter(
    opinion => opinion.stance === 'disagree',
  ).length

  const total = agree + disagree
  const agreeRate = percentage(agree, total)
  const disagreeRate = percentage(disagree, total)

  const shown = opinions.filter(
    opinion => filter === 'all' || opinion.stance === filter,
  )

  const filters: [Filter, string][] = [
    ['all', '전체'],
    ['agree', '찬성'],
    ['disagree', '반대'],
  ]

  return (
    <section className="card debate-discussion">
      <div className="section-head">
        <h2>토론 전 입장 및 주장</h2>
        <span className="badge">수정 불가</span>
      </div>

      <div className="debate-summary-grid">
        <div className="debate-summary-item">
          <span className="hint">참여 인원</span>
          <strong>{participantCount}명</strong>
        </div>

        <div className="debate-summary-item">
          <span className="hint">찬성</span>
          <strong className="debate-agree-text">
            {agree}명
          </strong>
        </div>

        <div className="debate-summary-item">
          <span className="hint">반대</span>
          <strong className="debate-disagree-text">
            {disagree}명
          </strong>
        </div>
      </div>

      <p className="hint">
        사전 의견 제출 {total} / {participantCount}명
      </p>

      {total > 0 ? (
        <>
          <div
            className="debate-ratio-bar"
            role="img"
            aria-label={`찬성 ${agreeRate}%, 반대 ${disagreeRate}%`}
          >
            <div
              className="debate-ratio-agree"
              style={{ flexGrow: agree }}
            />
            <div
              className="debate-ratio-disagree"
              style={{ flexGrow: disagree }}
            />
          </div>

          <div className="debate-ratio-labels">
            <span className="debate-agree-text">
              찬성 {agreeRate}%
            </span>
            <span className="debate-disagree-text">
              반대 {disagreeRate}%
            </span>
          </div>
        </>
      ) : (
        <p className="hint">
          제출된 사전 의견이 없습니다.
        </p>
      )}

      <div className="section-head">
        <h3>참여자별 사전 주장</h3>
      </div>

      <div className="day-picker">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={filter === value ? 'chip on' : 'chip'}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
            {' '}
            {value === 'all'
              ? total
              : value === 'agree'
                ? agree
                : disagree}
          </button>
        ))}
      </div>

      <div className="debate-opinion-list">
        {shown.map(opinion => (
          <article
            key={opinion.user_id}
            className="debate-opinion-card"
          >
            <div className="section-head">
              <strong>
                {names.get(opinion.user_id) ?? '탈퇴한 부원'}
              </strong>

              <span className={`badge stance-${opinion.stance}`}>
                {DEBATE_STANCE_LABEL[opinion.stance]}
              </span>
            </div>

            <p className="opinion-text">
              {opinion.content}
            </p>
          </article>
        ))}

        {shown.length === 0 && (
          <p className="hint">
            해당 입장으로 등록된 의견이 없습니다.
          </p>
        )}
      </div>

      <div className="debate-info-box">
        <strong>토론 진행 안내</strong>
        <p className="hint">
          참여자들의 사전 주장을 참고하여 토론을 진행해 주세요.
          상대방의 의견을 존중하고 객관적인 근거를 활용해 주세요.
          사전 입장과 주장은 수정할 수 없습니다.
        </p>
      </div>
    </section>
  )
}
