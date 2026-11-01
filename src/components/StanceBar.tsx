import { STANCE_LABEL, type StanceCounts } from '../lib/agendas'

export default function StanceBar({ counts }: { counts: StanceCounts }) {
  const total = counts.agree + counts.disagree + counts.hold
  if (total === 0) return <p className="hint">아직 의견이 없습니다.</p>
  return (
    <div>
      <div className="stance-bar" role="img" aria-label={`찬성 ${counts.agree}, 반대 ${counts.disagree}, 보류 ${counts.hold}`}>
        {(['agree', 'disagree', 'hold'] as const).map(
          (s) => counts[s] > 0 && <span key={s} className={`seg ${s}`} style={{ flexGrow: counts[s] }} />,
        )}
      </div>
      <p className="hint">
        {STANCE_LABEL.agree} {counts.agree} · {STANCE_LABEL.disagree} {counts.disagree} · {STANCE_LABEL.hold} {counts.hold}
      </p>
    </div>
  )
}
