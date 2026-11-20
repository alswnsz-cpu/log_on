import { addDays, eventColor, formatDateKo, ownerName, timeRange, weekdayKo, type Occurrence } from '../lib/calendar'

interface Props {
  /** 그 주의 일요일 'YYYY-MM-DD' */
  weekStart: string
  today: string
  selected: string
  byDate: Map<string, Occurrence[]>
  /** 좁은 화면: 7칸 대신 날짜별로 한 줄씩 쌓아 보여 준다 */
  compact: boolean
  onSelect: (date: string) => void
  onAdd: (date: string) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
}

const shortDate = (date: string) => {
  const [, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일`
}

/** 주간 달력: 일~토 7일의 일정을 모두 보여 준다. 날짜를 누르면 아래 상세 패널이 그 날로 바뀐다. */
export default function WeekView({
  weekStart,
  today,
  selected,
  byDate,
  compact,
  onSelect,
  onAdd,
  onPrev,
  onNext,
  onToday,
}: Props) {
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  return (
    <div>
      <div className="section-head">
        <h2>
          {shortDate(dates[0])} ~ {shortDate(dates[6])}
        </h2>
        <div className="cal-nav">
          <button type="button" className="btn btn-sm btn-ghost" onClick={onPrev} aria-label="이전 주">
            ‹
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onToday}>
            이번 주
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onNext} aria-label="다음 주">
            ›
          </button>
        </div>
      </div>

      <div className={compact ? 'week-grid list' : 'week-grid'}>
        {dates.map((date, i) => {
          const evs = byDate.get(date) ?? []
          const cls = ['week-day', date === today ? 'today' : '', date === selected ? 'sel' : '']
            .filter(Boolean)
            .join(' ')
          return (
            <div key={date} className={cls}>
              <div className="week-day-head">
                <button
                  type="button"
                  className={i === 0 ? 'week-day-btn sun' : i === 6 ? 'week-day-btn sat' : 'week-day-btn'}
                  onClick={() => onSelect(date)}
                  aria-pressed={date === selected}
                  aria-label={`${formatDateKo(date)}${evs.length > 0 ? `, 일정 ${evs.length}개` : ''}`}
                >
                  {weekdayKo(date)} {Number(date.slice(8))}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost week-add"
                  onClick={() => onAdd(date)}
                  aria-label={`${formatDateKo(date)} 일정 추가`}
                >
                  +
                </button>
              </div>
              {evs.length === 0
                ? compact && <p className="week-empty">일정 없음</p>
                : evs.map((e) => (
                    <button
                      type="button"
                      key={`${e.id}-${e.occ_date}`}
                      className="week-ev"
                      style={{ background: eventColor(e) }}
                      onClick={() => onSelect(date)}
                      aria-label={`${e.title}, ${e.is_club ? '동아리' : ownerName(e)}, ${timeRange(e)}`}
                    >
                      <small>{timeRange(e)}</small>
                      <strong>{e.title}</strong>
                    </button>
                  ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
