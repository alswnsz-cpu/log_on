import {
  calculateDebateResults,
  DEBATE_STANCE_LABEL,
  percentage,
} from '../../lib/debateWorkflow'
import type { DebateMember } from './DebateParticipants'
import type { PreOpinion } from './DebatePreOpinion'
import type { PostOpinion } from './DebatePostOpinion'

export interface MvpResult {
  candidate_id: string | null
  vote_count: number
}

interface Props {
  participantIds: string[]
  members: DebateMember[]
  preOpinions: PreOpinion[]
  postOpinions: PostOpinion[]
  votes: MvpResult[]
  summary: string | null
  snapshot?: ReturnType<typeof calculateDebateResults>
}

function RatioBar({
  label,
  agree,
  disagree,
}: {
  label: string
  agree: number
  disagree: number
}) {
  const total = agree + disagree
  const agreeRate = percentage(agree, total)
  const disagreeRate = percentage(disagree, total)

  return (
    <div className="debate-result-ratio">
      <div className="section-head">
        <strong>{label}</strong>
        <span className="hint">{total}명 응답</span>
      </div>

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
              찬성 {agree}명 ({agreeRate}%)
            </span>

            <span className="debate-disagree-text">
              반대 {disagree}명 ({disagreeRate}%)
            </span>
          </div>
        </>
      ) : (
        <p className="hint">제출된 의견이 없습니다.</p>
      )}
    </div>
  )
}

export default function DebateResults({
  participantIds,
  members,
  preOpinions,
  postOpinions,
  votes,
  summary,
  snapshot,
}: Props) {
  const stats = snapshot ?? calculateDebateResults(
    participantIds,
    preOpinions,
    postOpinions,
  )

  const names = new Map(
    members.map(member => [member.id, member.name]),
  )

  const preMap = new Map(
    preOpinions.map(opinion => [opinion.user_id, opinion]),
  )

  const ranked = votes
    .filter(vote => vote.vote_count > 0)
    .slice()
    .sort((a, b) => b.vote_count - a.vote_count)

  const totalVotes = ranked.reduce(
    (sum, vote) => sum + vote.vote_count,
    0,
  )

  const topVotes = ranked[0]?.vote_count ?? 0

  const winners = ranked.filter(
    vote => vote.vote_count === topVotes,
  )

  function candidateName(id: string | null) {
    return id
      ? names.get(id) ?? '탈퇴한 부원'
      : '탈퇴한 부원'
  }

  const changes = [
    {
      label: '찬성 → 반대',
      count: stats.agreeToDisagree,
      color: 'disagree',
    },
    {
      label: '반대 → 찬성',
      count: stats.disagreeToAgree,
      color: 'agree',
    },
    {
      label: '기존 입장 유지',
      count: stats.unchanged,
      color: 'unchanged',
    },
  ]

  return (
    <>
      <section className="card debate-results">
        <div className="section-head">
          <div>
            <p className="hint">LOG:ON DEBATE REPORT</p>
            <h2>토론 결과 보고서</h2>
          </div>

          <span className="badge ok">토론 종료</span>
        </div>

        <div className="debate-summary-grid">
          <div className="debate-summary-item">
            <span className="hint">참여 인원</span>
            <strong>{stats.participantCount}명</strong>
          </div>

          <div className="debate-summary-item">
            <span className="hint">입장 변화율</span>
            <strong>
              {stats.compared > 0
                ? `${stats.changeRate}%`
                : '-'}
            </strong>
            <span className="hint">
              {stats.changed} / {stats.compared}명
            </span>
          </div>

          <div className="debate-summary-item">
            <span className="hint">결론 제출률</span>
            <strong className="debate-agree-text">
              {stats.participantCount > 0
                ? `${stats.conclusionRate}%`
                : '-'}
            </strong>
            <span className="hint">
              {stats.postSubmitted} / {stats.participantCount}명
            </span>
          </div>
        </div>

        <div className="debate-result-section">
          <h3>01. 토론 전후 입장 비교</h3>

          <RatioBar
            label="토론 전"
            agree={stats.preAgree}
            disagree={stats.preDisagree}
          />

          <RatioBar
            label="토론 후"
            agree={stats.postAgree}
            disagree={stats.postDisagree}
          />

          <p className="hint">
            찬반 비율은 각 단계의 실제 의견 제출
            인원을 기준으로 계산합니다.
          </p>
        </div>

        <div className="debate-result-section">
          <h3>02. 입장 변화 분석</h3>

          {changes.map(item => (
            <div
              className="debate-result-change-row"
              key={item.label}
            >
              <span>{item.label}</span>

              <div
                className="debate-result-track"
                role="img"
                aria-label={`${item.label} ${item.count}명`}
              >
                <div
                  className={`debate-result-fill ${item.color}`}
                  style={{
                    width: `${percentage(
                      item.count,
                      stats.compared,
                    )}%`,
                  }}
                />
              </div>

              <strong>{item.count}명</strong>
            </div>
          ))}

          <div className="debate-info-box">
            <strong>
              비교 가능 인원 {stats.compared}명
            </strong>

            <p className="hint">
              사전 및 사후 의견을 모두 제출한
              참여자만 입장 변화율 계산에 포함됩니다.
              비교 제외 인원은
              {' '}
              {stats.participantCount - stats.compared}명입니다.
            </p>
          </div>
        </div>

        <div className="debate-result-section">
          <h3>03. 오늘의 토론 MVP</h3>

          {winners.length > 0 ? (
            <>
              <div className="debate-winner-box">
                <span
                  className="debate-mvp-trophy"
                  aria-hidden="true"
                >
                  🏆
                </span>

                <span className="hint">
                  {winners.length > 1
                    ? 'JOINT DEBATE MVP'
                    : 'DEBATE MVP'}
                </span>

                <h2>
                  {winners.map(winner =>
                    candidateName(winner.candidate_id),
                  ).join(' · ')}
                </h2>

                <strong>
                  {winners.length > 1 ? '각 ' : ''}
                  {topVotes}표 · 득표율
                  {' '}
                  {percentage(topVotes, totalVotes)}%
                </strong>
              </div>

              <p className="hint">
                총 투표 {totalVotes}표
                {' · '}
                투표 참여율
                {' '}
                {percentage(
                  totalVotes,
                  stats.participantCount,
                )}%
              </p>

              {ranked.map((vote, index) => (
                <div
                  className="debate-result-change-row"
                  key={`${vote.candidate_id}-${index}`}
                >
                  <span>
                    {candidateName(vote.candidate_id)}
                  </span>

                  <div
                    className="debate-result-track"
                    role="img"
                    aria-label={`${candidateName(vote.candidate_id)} ${vote.vote_count}표`}
                  >
                    <div
                      className="debate-result-fill vote"
                      style={{
                        width: `${percentage(
                          vote.vote_count,
                          totalVotes,
                        )}%`,
                      }}
                    />
                  </div>

                  <strong>{vote.vote_count}표</strong>
                </div>
              ))}
            </>
          ) : (
            <p className="hint">
              제출된 MVP 투표가 없습니다.
            </p>
          )}
        </div>

        <div className="debate-result-section">
          <h3>04. 오늘의 최종 결론</h3>

          <div className="debate-info-box">
            <p className="decision-text">
              {summary ?? '등록된 종합 결론이 없습니다.'}
            </p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>참여자별 최종 의견</h2>

          <span className="hint">
            {postOpinions.length}개
          </span>
        </div>

        <div className="debate-opinion-list">
          {postOpinions.map(opinion => {
            const before = preMap.get(opinion.user_id)

            return (
              <article
                className="debate-opinion-card"
                key={opinion.user_id}
              >
                <div className="section-head">
                  <strong>
                    {names.get(opinion.user_id) ?? '탈퇴한 부원'}
                  </strong>

                  <span className={`badge stance-${opinion.stance}`}>
                    {DEBATE_STANCE_LABEL[opinion.stance]}
                  </span>
                </div>

                <p className="hint">
                  {before
                    ? `${DEBATE_STANCE_LABEL[before.stance]} → ${DEBATE_STANCE_LABEL[opinion.stance]}`
                    : '사전 의견 미제출'}
                </p>

                <strong>
                  {!before
                    ? '최종 입장 선택 이유'
                    : before.stance === opinion.stance
                      ? '입장 유지 이유'
                      : '입장 변화 이유'}
                </strong>

                <p className="opinion-text">
                  {opinion.reason}
                </p>

                <h4>개인 최종 결론</h4>

                <p className="opinion-text">
                  {opinion.conclusion}
                </p>
              </article>
            )
          })}

          {postOpinions.length === 0 && (
            <p className="hint">
              열람할 수 있는 최종 의견이 없습니다.
            </p>
          )}
        </div>
      </section>
    </>
  )
}
