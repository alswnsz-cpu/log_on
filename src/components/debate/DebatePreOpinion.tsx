import { useState, type FormEvent } from 'react'
import {
  DEBATE_STANCE_LABEL,
  type DebateStance,
} from '../../lib/debateWorkflow'

export interface PreOpinion {
  user_id: string
  stance: DebateStance
  content: string
}

interface Props {
  opinion: PreOpinion | null
  locked: boolean
  busy: boolean
  onSubmit: (
    stance: DebateStance,
    content: string,
  ) => Promise<void>
}

export default function DebatePreOpinion({
  opinion,
  locked,
  busy,
  onSubmit,
}: Props) {
  const [stance, setStance] = useState<DebateStance | ''>(
    opinion?.stance ?? '',
  )
  const [content, setContent] = useState(
    opinion?.content ?? '',
  )

  const unchanged =
    opinion?.stance === stance &&
    opinion?.content === content.trim()

  async function submit(e: FormEvent) {
    e.preventDefault()

    if (
      locked ||
      busy ||
      !stance ||
      !content.trim() ||
      content.trim().length > 2000
    ) return

    await onSubmit(stance, content.trim())
  }

  return (
    <section className="card debate-pre-opinion">
      <div className="section-head">
        <h2>토론 전 나의 입장</h2>
        <span className={opinion ? 'badge ok' : 'badge'}>
          {opinion ? '제출 완료' : '미제출'}
        </span>
      </div>

      {locked && (
        <p className="hint">
          사전 의견 제출이 종료되어 수정할 수 없습니다.
        </p>
      )}

      <form className="form" onSubmit={submit}>
        <fieldset
          className="debate-stance-field"
          disabled={locked || busy}
        >
          <legend>나의 입장 선택</legend>

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
                  name="debate-pre-stance"
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

        <label>
          나의 주장 및 근거
          <textarea
            rows={6}
            maxLength={2000}
            value={content}
            disabled={locked || busy}
            onChange={e => setContent(e.target.value)}
            placeholder="해당 입장을 선택한 이유와 자신의 주장 및 근거를 작성해 주세요."
            required
          />
        </label>

        <p className="hint debate-character-count">
          {content.length.toLocaleString()} / 2,000자
        </p>

        {!locked && (
          <>
            <div className="debate-info-box">
              <strong>사전 의견 제출 안내</strong>
              <p className="hint">
                토론 시작 전까지 다른 부원의 사전 의견은
                공개되지 않습니다.
                임원진도 토론 시작 전에는 전체 제출 인원수만 확인할 수 있습니다.
                토론 시작 전까지 자신의 의견을 수정할 수 있습니다.
              </p>
            </div>

            <div className="actions">
              <button
                className="btn"
                type="submit"
                disabled={
                  busy ||
                  !stance ||
                  !content.trim() ||
                  unchanged
                }
              >
                {busy
                  ? '저장 중...'
                  : unchanged
                    ? '제출 완료'
                    : opinion
                      ? '사전 입장 수정하기'
                      : '사전 입장 제출하기'}
              </button>
            </div>
          </>
        )}
      </form>
    </section>
  )
}
