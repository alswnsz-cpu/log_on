import { useState, type FormEvent } from 'react'
import {
  DEBATE_STANCE_LABEL,
  type DebateStance,
} from '../../lib/debateWorkflow'
import type { PreOpinion } from './DebatePreOpinion'

export interface PostOpinion {
  user_id: string
  stance: DebateStance
  reason: string
  conclusion: string
}

interface Props {
  preOpinion: PreOpinion | null
  opinion: PostOpinion | null
  locked: boolean
  busy: boolean
  onSubmit: (
    stance: DebateStance,
    reason: string,
    conclusion: string,
  ) => Promise<void>
}

export default function DebatePostOpinion({
  preOpinion,
  opinion,
  locked,
  busy,
  onSubmit,
}: Props) {
  const [stance, setStance] = useState<DebateStance | ''>(
    opinion?.stance ?? '',
  )

  const [reason, setReason] = useState(
    opinion?.reason ?? '',
  )

  const [conclusion, setConclusion] = useState(
    opinion?.conclusion ?? '',
  )

  const changed = Boolean(
    preOpinion && stance && preOpinion.stance !== stance,
  )

  const unchanged =
    opinion?.stance === stance &&
    opinion?.reason === reason.trim() &&
    opinion?.conclusion === conclusion.trim()

  const valid =
    Boolean(stance) &&
    reason.trim().length > 0 &&
    reason.trim().length <= 2000 &&
    conclusion.trim().length > 0 &&
    conclusion.trim().length <= 2000

  const reasonLabel = !preOpinion || !stance
    ? '최종 입장을 선택한 이유'
    : changed
      ? '입장이 변화한 이유'
      : '입장을 유지한 이유'

  async function submit(e: FormEvent) {
    e.preventDefault()

    if (locked || busy || !stance || !valid) return

    await onSubmit(
      stance,
      reason.trim(),
      conclusion.trim(),
    )
  }

  return (
    <section className="card debate-post-opinion">
      <div className="section-head">
        <h2>토론 후 나의 최종 의견</h2>

        <span className={opinion ? 'badge ok' : 'badge'}>
          {opinion ? '제출 완료' : '미제출'}
        </span>
      </div>

      <div className="debate-info-box">
        <strong>나의 토론 전 입장</strong>

        {preOpinion ? (
          <>
            <p>
              <span className={`badge stance-${preOpinion.stance}`}>
                {DEBATE_STANCE_LABEL[preOpinion.stance]}
              </span>
            </p>

            <p className="opinion-text">
              {preOpinion.content}
            </p>
          </>
        ) : (
          <p className="hint">
            제출된 사전 의견이 없습니다.
            최종 의견은 제출할 수 있지만 입장 변화율
            계산에서는 제외됩니다.
          </p>
        )}
      </div>

      {locked && (
        <p className="hint">
          최종 의견 제출이 종료되어 수정할 수 없습니다.
        </p>
      )}

      <form className="form" onSubmit={submit}>
        <fieldset
          className="debate-stance-field"
          disabled={locked || busy}
        >
          <legend>토론 후 최종 입장 선택</legend>

          <div className="debate-stance-grid">
            {(['agree', 'disagree'] as const).map(item => (
              <label
                key={item}
                className={[
                  'debate-stance-option',
                  item,
                  stance === item ? 'selected' : '',
                ].filter(Boolean).join(' ')}
              >
                <input
                  type="radio"
                  name="debate-post-stance"
                  value={item}
                  checked={stance === item}
                  onChange={() => setStance(item)}
                  required
                />

                <strong>
                  {DEBATE_STANCE_LABEL[item]}
                </strong>
              </label>
            ))}
          </div>
        </fieldset>

        {preOpinion && stance && (
          <div className="debate-change-box">
            <strong>나의 입장 변화</strong>

            <div className="debate-change-flow">
              <div>
                <span className="hint">토론 전</span>

                <strong className={`debate-${preOpinion.stance}-text`}>
                  {DEBATE_STANCE_LABEL[preOpinion.stance]}
                </strong>
              </div>

              <span className="debate-change-arrow">
                →
              </span>

              <div>
                <span className="hint">토론 후</span>

                <strong className={`debate-${stance}-text`}>
                  {DEBATE_STANCE_LABEL[stance]}
                </strong>
              </div>
            </div>

            <span className={changed ? 'badge' : 'badge ok'}>
              {changed ? '입장 변화' : '기존 입장 유지'}
            </span>
          </div>
        )}

        <label>
          {reasonLabel}

          <textarea
            rows={4}
            maxLength={2000}
            value={reason}
            disabled={locked || busy}
            onChange={e => setReason(e.target.value)}
            placeholder="토론 과정에서 어떤 주장이나 근거가 자신의 생각에 영향을 주었나요?"
            required
          />
        </label>

        <p className="hint debate-character-count">
          {reason.length.toLocaleString()} / 2,000자
        </p>

        <label>
          나의 최종 결론

          <textarea
            rows={6}
            maxLength={2000}
            value={conclusion}
            disabled={locked || busy}
            onChange={e => setConclusion(e.target.value)}
            placeholder="찬반 양측의 의견과 토론 내용을 종합하여 자신의 최종 결론을 작성해 주세요."
            required
          />
        </label>

        <p className="hint debate-character-count">
          {conclusion.length.toLocaleString()} / 2,000자
        </p>

        {!locked && (
          <>
            <div className="debate-info-box">
              <strong>최종 의견 제출 안내</strong>

              <p className="hint">
                MVP 투표 단계가 시작되기 전까지
                최종 의견을 수정할 수 있습니다.
                제출한 의견은 토론 전후 입장 변화와
                최종 결과 분석에 활용됩니다.
                임원진은 제출된 의견을 확인할 수 있으며,
                일반 부원에게는 토론 종료 후 공개됩니다.
              </p>
            </div>

            <div className="actions">
              <button
                className="btn"
                type="submit"
                disabled={busy || !valid || unchanged}
              >
                {busy
                  ? '저장 중...'
                  : unchanged
                    ? '제출 완료'
                    : opinion
                      ? '최종 의견 수정하기'
                      : '최종 의견 및 결론 제출하기'}
              </button>
            </div>
          </>
        )}
      </form>
    </section>
  )
}
