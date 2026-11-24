import {
  DEBATE_STAGES,
  DEBATE_STAGE_LABEL,
  type DebateStage,
} from '../../lib/debateWorkflow'

interface Props {
  stage: DebateStage
}

const SHORT_LABEL: Record<DebateStage, string> = {
  pre: '입장 등록',
  discussing: '토론 진행',
  post: '의견 제출',
  voting: 'MVP 투표',
  closed: '결과 분석',
}

const DESCRIPTION: Record<DebateStage, string> = {
  pre: '토론 전 자신의 입장과 주장 및 근거를 작성해 주세요.',
  discussing: '등록된 사전 의견을 확인하고 토론을 진행해 주세요.',
  post: '토론 후 최종 입장과 개인 결론을 작성해 주세요.',
  voting: '가장 인상 깊었던 토론 참여자에게 투표해 주세요.',
  closed: '토론 전후 입장 변화와 최종 결과를 확인하세요.',
}

export default function DebateStepper({ stage }: Props) {
  const current = DEBATE_STAGES.indexOf(stage)

  return (
    <section className="card debate-stepper">
      <div className="section-head">
        <h2>토론 진행 현황</h2>
        <span className="hint">{current + 1} / 5 단계</span>
      </div>

      <ol className="debate-steps" aria-label="토론 진행 단계">
        {DEBATE_STAGES.map((item, index) => {
          const completed = index < current
          const active = index === current

          return (
            <li
              key={item}
              className={[
                'debate-step',
                completed ? 'completed' : '',
                active ? 'active' : '',
              ].filter(Boolean).join(' ')}
              aria-current={active ? 'step' : undefined}
            >
              <span className="debate-step-number">
                {completed ? '✓' : index + 1}
              </span>
              <span className="debate-step-label">
                {SHORT_LABEL[item]}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="debate-stage-description">
        <strong>{DEBATE_STAGE_LABEL[stage]}</strong>
        <p className="hint">{DESCRIPTION[stage]}</p>
      </div>
    </section>
  )
}
