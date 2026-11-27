import { useState, type FormEvent } from 'react'
import {
  DEBATE_STAGE_LABEL,
  type DebateStage,
} from '../../lib/debateWorkflow'

interface Props {
  stage: DebateStage
  confirmed: boolean
  participantCount: number
  preSubmitted: number
  postSubmitted: number
  voteCount: number | null
  busy: boolean
  onAdvance: () => Promise<void>
  onFinalize: (summary: string) => Promise<void>
}

const NEXT_ACTION: Record<
  Exclude<DebateStage, 'voting' | 'closed'>,
  string
> = {
  pre: '토론 시작하기',
  discussing: '사후 의견 제출 시작',
  post: 'MVP 투표 시작',
}

const GUIDE: Record<DebateStage, string> = {
  pre: '참여자 명단을 확정한 후 사전 의견을 수집합니다. 토론 시작 이후에는 사전 의견을 수정할 수 없습니다.',
  discussing: '토론을 마치고 참여자의 최종 입장과 결론을 수집합니다.',
  post: '사후 의견 제출을 마감하고 MVP 투표를 시작합니다.',
  voting: '토론을 종료하면 최종 통계와 MVP 결과가 공개됩니다.',
  closed: '종료된 토론의 기록과 결과는 수정할 수 없습니다.',
}

export default function DebateAdminControls({
  stage,
  confirmed,
  participantCount,
  preSubmitted,
  postSubmitted,
  voteCount,
  busy,
  onAdvance,
  onFinalize,
}: Props) {
  const [summary, setSummary] = useState('')

  const preMissing = Math.max(
    0,
    participantCount - preSubmitted,
  )

  const postMissing = Math.max(
    0,
    participantCount - postSubmitted,
  )

  const voteRate =
    participantCount > 0 && voteCount !== null
      ? Math.min(100, Math.round(voteCount / participantCount * 1000) / 10)
      : 0

  const cannotStart =
    stage === 'pre' && (!confirmed || participantCount < 4)

  async function finalize(e: FormEvent) {
    e.preventDefault()

    if (
      busy ||
      stage !== 'voting' ||
      !summary.trim() ||
      summary.trim().length > 2000
    ) return

    await onFinalize(summary.trim())
  }

  return (
    <section className="card debate-admin-controls">
      <div className="section-head">
        <h2>토론 진행 관리</h2>
        <span className="badge">임원진 전용</span>
      </div>

      <div className="debate-admin-current">
        <span className="hint">현재 토론 단계</span>
        <strong>{DEBATE_STAGE_LABEL[stage]}</strong>
      </div>

      <div className="debate-summary-grid">
        <div className="debate-summary-item">
          <span className="hint">참여 인원</span>
          <strong>{participantCount}명</strong>
        </div>

        <div className="debate-summary-item">
          <span className="hint">사전 의견</span>
          <strong>
            {preSubmitted}/{participantCount}
          </strong>
        </div>

        <div className="debate-summary-item">
          <span className="hint">사후 의견</span>
          <strong>
            {postSubmitted}/{participantCount}
          </strong>
        </div>
      </div>

      <div className="debate-info-box">
        <strong>단계 전환 안내</strong>
        <p className="hint">{GUIDE[stage]}</p>
      </div>

      {cannotStart && (
        <p className="msg error" role="alert">
          {participantCount < 4
            ? '승인된 토론 참여자가 최소 4명 이상이어야 합니다.'
            : '참여자 명단을 먼저 확정해 주세요.'}
        </p>
      )}

      {stage === 'pre' && confirmed && preMissing > 0 && (
        <div className="debate-admin-warning">
          사전 의견 미제출 인원: {preMissing}명
          <p>
            토론 시작 후에는 사전 의견을 제출할 수 없습니다.
          </p>
        </div>
      )}

      {stage === 'post' && postMissing > 0 && (
        <div className="debate-admin-warning">
          사후 의견 미제출 인원: {postMissing}명
          <p>
            MVP 투표 시작 후에는 최종 의견을 제출할 수 없습니다.
          </p>
        </div>
      )}

      {stage !== 'closed' && stage !== 'voting' && (
        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={busy || cannotStart}
            onClick={() => {
              void onAdvance()
            }}
          >
            {busy
              ? '처리 중...'
              : NEXT_ACTION[stage]}
          </button>
        </div>
      )}

      {stage === 'voting' && (
        <div className="debate-info-box">
          <div className="section-head">
            <strong>MVP 투표 진행 현황</strong>
            <span className="hint">
              {voteCount === null
                ? '확인 중'
                : `${voteCount}/${participantCount}명`}
            </span>
          </div>

          {voteCount !== null && (
            <>
              <div
                className="debate-result-track"
                role="progressbar"
                aria-label="MVP 투표 진행률"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={voteRate}
              >
                <div
                  className="debate-result-fill agree"
                  style={{ width: `${voteRate}%` }}
                />
              </div>

              <div className="section-head">
                <span>투표 완료 {voteCount}명</span>
                <strong>{voteRate}%</strong>
              </div>

              <p className="hint">
                미투표 인원: {Math.max(0, participantCount - voteCount)}명
              </p>
            </>
          )}

          <p className="hint">
            개별 투표 내역과 후보별 득표수는
            토론 종료 전까지 공개되지 않습니다.
          </p>
        </div>
      )}

      {stage === 'voting' && (
        <form className="form" onSubmit={finalize}>
          <label>
            임원진 최종 종합 결론
            <textarea
              rows={6}
              maxLength={2000}
              value={summary}
              disabled={busy}
              onChange={e => setSummary(e.target.value)}
              placeholder="오늘 진행한 토론의 주요 쟁점, 핵심 주장 및 종합 결론을 작성해 주세요."
              required
            />
          </label>

          <p className="hint debate-character-count">
            {summary.length.toLocaleString()} / 2,000자
          </p>

          <div className="debate-admin-warning">
            토론 종료 후에는 단계 변경 및 의견 수정이
            불가능합니다. 종료 전 투표 참여 여부를
            확인해 주세요.
          </div>

          <div className="actions">
            <button
              type="submit"
              className="btn"
              disabled={busy || !summary.trim()}
            >
              {busy
                ? '종료 처리 중...'
                : '토론 종료 및 결과 공개'}
            </button>
          </div>
        </form>
      )}

      {stage === 'closed' && (
        <p className="debate-admin-completed">
          토론이 정상적으로 종료되었습니다.
        </p>
      )}
    </section>
  )
}
