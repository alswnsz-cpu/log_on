import { DAY_LABELS, daySlots, minToHHMM, minRangeToSlots } from '../lib/time'

export interface MyBlock {
  id: number
  kind: 'class' | 'manual'
  subject: string | null
  day: number
  start_min: number
  end_min: number
}

interface Props {
  blocks: MyBlock[]
  busy: boolean
  onToggleManual: (day: number, slot: number) => void
}

export default function ScheduleGrid({ blocks, busy, onToggleManual }: Props) {
  // cell[day][slot] = 해당 칸을 덮는 블록, label은 블록 첫 칸에만 표시
  const cells = DAY_LABELS.map(() => Array<{ block: MyBlock; first: boolean } | null>(18).fill(null))
  for (const b of blocks) {
    const [from, to] = minRangeToSlots(b.start_min, b.end_min)
    for (let s = from; s < to; s++) {
      // 수업이 수시 불가보다 우선해서 보인다
      const cur = cells[b.day][s]
      if (!cur || (cur.block.kind === 'manual' && b.kind === 'class')) {
        cells[b.day][s] = { block: b, first: s === from }
      }
    }
  }

  return (
    <div className="grid-wrap">
      <table className="time-grid">
        <thead>
          <tr>
            <th />
            {DAY_LABELS.map((d) => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {daySlots().map(({ slot, start }) => (
            <tr key={slot} className={start % 60 === 0 ? 'hour' : ''}>
              <th className="time-label">{start % 60 === 0 ? minToHHMM(start) : ''}</th>
              {DAY_LABELS.map((d, day) => {
                const c = cells[day][slot]
                if (c?.block.kind === 'class') {
                  return (
                    <td key={d} className="cell class" title={c.block.subject ?? ''}>
                      {c.first ? c.block.subject : ''}
                    </td>
                  )
                }
                return (
                  <td
                    key={d}
                    className={`cell ${c ? 'manual' : 'empty'}`}
                    onClick={() => !busy && onToggleManual(day, slot)}
                    title={c ? '수시 불가 (클릭하면 해제)' : '클릭하면 불가 시간으로 표시'}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
