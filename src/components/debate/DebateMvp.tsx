import { useState, type FormEvent } from 'react'
import { MVP_CRITERIA } from '../../lib/debateWorkflow'
import type { DebateMember } from './DebateParticipants'

interface Props {
  members: DebateMember[]
  participantIds: string[]
  currentUserId: string
  hasVoted: boolean
  busy: boolean
  onVote: (candidateId: string) => Promise<void>
}

export default function DebateMvp({
  members,
  participantIds,
  currentUserId,
  hasVoted,
  busy,
  onVote,
}: Props) {
  const [candidateId, setCandidateId] = useState('')
  const [confirming, setConfirming] = useState(false)

  const participants = new Set(participantIds)
  const eligible = participants.has(currentUserId)

  const candidates = members.filter(member =>
    participants.has(member.id) &&
    member.id !== currentUserId,
  )

  const selected = candidates.find(
    member => member.id === candidateId,
  )

  async function submit(e: FormEvent) {
    e.preventDefault()

    if (
      busy ||
      hasVoted ||
      !eligible ||
      !selected
    ) return

    if (!confirming) {
      setConfirming(true)
      return
    }

    await onVote(selected.id)
    setConfirming(false)
  }

  return (
    <section className="card debate-mvp">
      <div className="debate-mvp-heading">
        <span className="debate-mvp-trophy" aria-hidden="true">
          🏆
        </span>

        <h2>오늘의 토론 MVP</h2>

        <p className="hint">
          오늘 토론에서 가장 인상 깊었던 참여자에게
          소중한 한 표를 행사해 주세요.
        </p>
      </div>

      <h3>MVP 평가 기준</h3>

      <div className="debate-mvp-criteria">
        {MVP_CRITERIA.map((criterion, index) => (
          <div
            className="debate-mvp-criterion"
            key={criterion.title}
          >
            <span className="debate-criterion-number">
              {String(index + 1).padStart(2, '0')}
            </span>

            <strong>{criterion.title}</strong>

            <span className="hint">
              {criterion.description}
            </span>
          </div>
        ))}
      </div>

      {!eligible ? (
        <div className="debate-info-box">
          <strong>투표 대상이 아닙니다.</strong>

          <p className="hint">
            오늘 토론에 참여자로 지정된 부원만
            MVP 투표에 참여할 수 있습니다.
          </p>
        </div>
      ) : hasVoted ? (
        <div className="debate-vote-complete" role="status">
          <span className="debate-vote-check" aria-hidden="true">
            ✓
          </span>

          <h3>투표 완료!</h3>

          <p>
            소중한 한 표가 제출되었습니다.
          </p>

          <p className="hint">
            최종 결과 발표를 기다려 주세요.
            제출한 투표는 변경할 수 없습니다.
          </p>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <div className="section-head">
            <h3>MVP 후보 선택</h3>

            <span className="hint">
              후보 {candidates.length}명
            </span>
          </div>

          <fieldset
            className="debate-stance-field"
            disabled={busy || confirming}
          >
            <legend className="hint">
              본인을 제외한 참여자 중 한 명을 선택하세요.
            </legend>

            <div className="debate-candidate-list">
              {candidates.map(member => (
                <label
                  key={member.id}
                  className={[
                    'debate-candidate-row',
                    candidateId === member.id
                      ? 'selected'
                      : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span
                    className="debate-candidate-avatar"
                    aria-hidden="true"
                  >
                    {member.name.slice(0, 1)}
                  </span>

                  <strong className="debate-member-name">
                    {member.name}
                  </strong>

                  <input
                    type="radio"
                    name="debate-mvp-candidate"
                    value={member.id}
                    checked={candidateId === member.id}
                    onChange={() => {
                      setCandidateId(member.id)
                      setConfirming(false)
                    }}
                    required
                  />
                </label>
              ))}

              {candidates.length === 0 && (
                <p className="hint">
                  투표할 수 있는 후보가 없습니다.
                </p>
              )}
            </div>
          </fieldset>

          <div className="debate-info-box">
            <strong>익명 투표 안내</strong>

            <p className="hint">
              투표는 1인 1표이며 본인에게는
              투표할 수 없습니다.
              제출한 투표는 변경할 수 없으며,
              개별 투표 내역은 부원과 임원진에게
              공개되지 않습니다.
              최종 집계 결과는 토론 종료 후 공개됩니다.
            </p>
          </div>

          {confirming && selected ? (
            <div className="debate-vote-confirm">
              <strong>
                {selected.name} 부원에게 투표하시겠습니까?
              </strong>

              <p className="hint">
                최종 제출 이후에는 변경하거나
                취소할 수 없습니다.
              </p>

              <div className="actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                >
                  취소
                </button>

                <button
                  type="submit"
                  className="btn"
                  disabled={busy}
                >
                  {busy ? '제출 중...' : '최종 투표 제출'}
                </button>
              </div>
            </div>
          ) : (
            <div className="actions">
              <button
                type="submit"
                className="btn"
                disabled={busy || !selected}
              >
                MVP 투표하기
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  )
}
