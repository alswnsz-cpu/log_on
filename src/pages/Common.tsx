import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  DAY_LABELS,
  STEP,
  computeAvailability,
  daySlots,
  findCandidates,
  formatCandidate,
  minToHHMM,
} from '../lib/time'
import type { BusyBlock, Candidate, Member } from '../lib/time'

const DURATIONS = [
  { label: '1시간', min: 60 },
  { label: '1.5시간', min: 90 },
  { label: '2시간', min: 120 },
  { label: '3시간', min: 180 },
]

const PAGE = 1000

async function fetchBusy(): Promise<{ data: BusyBlock[]; error: string | null }> {
  const all: BusyBlock[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('busy_blocks')
      .select('user_id, day, start_min, end_min')
      .order('user_id')
      .order('day')
      .order('start_min')
      .range(from, from + PAGE - 1)
    if (error) return { data: [], error: error.message }
    all.push(...(data as BusyBlock[]))
    if (data.length < PAGE) break
  }
  return { data: all, error: null }
}

export default function Common() {
  const [members, setMembers] = useState<Member[]>([])
  const [blocks, setBlocks] = useState<BusyBlock[]>([])
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [duration, setDuration] = useState(60)
  const [copied, setCopied] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      const [p, b, s] = await Promise.all([
        supabase.from('profiles').select('id, name').eq('status', 'approved').order('name'),
        fetchBusy(),
        supabase.from('schedule_status').select('user_id'),
      ])
      if (!alive) return
      if (p.error || b.error || s.error) setError('공통 시간 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      else {
        setMembers(p.data as Member[])
        setBlocks(b.data)
        setDoneIds(new Set((s.data as { user_id: string }[]).map((r) => r.user_id)))
      }
      setLoading(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  const availability = useMemo(() => computeAvailability(members, blocks), [members, blocks])
  const candidates = useMemo(
    () => findCandidates(members, availability, duration / STEP),
    [members, availability, duration],
  )

  async function copyText(c: Candidate, i: number) {
    const text = `[동아리 모임] ${formatCandidate(c, members.length)}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(i)
      setTimeout(() => setCopied((cur) => (cur === i ? null : cur)), 1500)
    } catch {
      window.prompt('아래 문구를 복사해 주세요.', text)
    }
  }

  if (loading) return <p className="center">불러오는 중...</p>
  if (error) return <p className="msg error">{error}</p>
  if (members.length === 0) {
    return (
      <section className="card">
        <h2>공통 시간 찾기</h2>
        <p>승인된 부원이 없습니다.</p>
      </section>
    )
  }

  const total = members.length
  // 수업이 하나도 없어도 "입력 완료"를 눌렀다면 미입력이 아니다.
  const notDone = availability.noInput.filter((m) => !doneIds.has(m.id))

  return (
    <>
      <section className="card">
        <h2>공통 시간 찾기</h2>
        <p className="hint">필요한 회의 시간을 고르면, 그 시간 동안 계속 가능한 사람이 많은 순으로 추천합니다.</p>
        <div className="day-picker" role="group" aria-label="회의 시간" style={{ marginTop: 12 }}>
          {DURATIONS.map((d) => (
            <button
              key={d.min}
              type="button"
              className={`chip ${duration === d.min ? 'on' : ''}`}
              aria-pressed={duration === d.min}
              onClick={() => setDuration(d.min)}
            >
              {d.label}
            </button>
          ))}
        </div>
        {notDone.length > 0 && (
          <p className="msg notice" style={{ marginTop: 12 }}>
            시간표 미입력: {notDone.map((m) => m.name).join(', ')} — 이 분들은 모든 시간에 가능한
            것으로 계산되었습니다.
          </p>
        )}
      </section>

      <section className="card">
        <h2>추천 시간</h2>
        {candidates.length === 0 ? (
          <p>{DURATIONS.find((d) => d.min === duration)?.label} 동안 가능한 시간이 없습니다.</p>
        ) : (
          <ul className="list">
            {candidates.map((c, i) => {
              const all = c.available.length === total
              const absent = members.filter((m) => !c.available.includes(m))
              return (
                <li key={`${c.day}-${c.startMin}`}>
                  <span>
                    <span className="name">
                      {DAY_LABELS[c.day]}요일 {minToHHMM(c.startMin)}~{minToHHMM(c.endMin)}
                      <span className={`badge ${all ? 'ok' : ''}`}>
                        {all ? '전원 가능' : `${c.available.length}/${total}명`}
                      </span>
                    </span>
                    {!all && (
                      <span className="hint" style={{ display: 'block' }}>
                        불가: {absent.map((m) => m.name).join(', ')}
                      </span>
                    )}
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => copyText(c, i)}>
                    {copied === i ? '복사됨' : '일정 문구 복사'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>시간대별 가능 인원</h2>
        <div className="grid-wrap">
          <table className="time-grid heat">
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
                    const n = availability.free[day][slot]
                    return (
                      <td
                        key={d}
                        className="cell heat-cell"
                        style={{
                          background: `rgba(124, 58, 237, ${(n / total) * 0.85})`,
                          color: n / total > 0.5 ? '#fff' : 'var(--purple-900)',
                        }}
                        title={`${d} ${minToHHMM(start)} · ${n}/${total}명 가능`}
                      >
                        {n}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>숫자는 해당 30분에 가능한 인원(전체 {total}명)입니다.</p>
      </section>
    </>
  )
}
