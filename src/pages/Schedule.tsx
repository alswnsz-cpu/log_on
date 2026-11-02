import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import ScheduleGrid from '../components/ScheduleGrid'
import type { MyBlock } from '../components/ScheduleGrid'
import {
  DAY_LABELS,
  END_OPTIONS,
  START_OPTIONS,
  minToHHMM,
  slotToMin,
  STEP,
} from '../lib/time'

interface ClassGroup {
  key: string
  subject: string
  start: number
  end: number
  days: number[]
  ids: number[]
}

function groupClasses(blocks: MyBlock[]): ClassGroup[] {
  const map = new Map<string, ClassGroup>()
  for (const b of blocks) {
    if (b.kind !== 'class') continue
    const key = `${b.subject}|${b.start_min}|${b.end_min}`
    const g = map.get(key) ?? {
      key,
      subject: b.subject ?? '',
      start: b.start_min,
      end: b.end_min,
      days: [],
      ids: [],
    }
    g.days.push(b.day)
    g.ids.push(b.id)
    map.set(key, g)
  }
  return [...map.values()]
    .map((g) => ({ ...g, days: g.days.sort() }))
    .sort((a, b) => a.days[0] - b.days[0] || a.start - b.start)
}

const COLUMNS = 'id, kind, subject, day, start_min, end_min'
const MANUAL_ERROR = '불가 시간을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.'

interface ScheduleProps {
  /** 시간표 "입력 완료"를 이미 눌렀는지 */
  done: boolean
  /** 입력 완료로 기록한다. 성공하면 true */
  onComplete: () => Promise<boolean>
}

export default function Schedule({ done, onComplete }: ScheduleProps) {
  const { session } = useAuth()
  const userId = session!.user.id
  const [completing, setCompleting] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)

  async function complete() {
    setCompleting(true)
    setCompleteError(null)
    const ok = await onComplete()
    if (!ok) setCompleteError('입력 완료를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    setCompleting(false)
  }

  const [blocks, setBlocks] = useState<MyBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState<ClassGroup | null>(null)
  const [subject, setSubject] = useState('')
  const [days, setDays] = useState<number[]>([])
  const [start, setStart] = useState(START_OPTIONS[2])
  const [end, setEnd] = useState(END_OPTIONS[3])

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .select(COLUMNS)
      .order('day')
      .order('start_min')
    if (error) setError('시간표를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    else setBlocks(data as MyBlock[])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  function resetForm() {
    setEditing(null)
    setSubject('')
    setDays([])
    setStart(START_OPTIONS[2])
    setEnd(END_OPTIONS[3])
  }

  function startEdit(g: ClassGroup) {
    setEditing(g)
    setSubject(g.subject)
    setDays(g.days)
    setStart(g.start)
    setEnd(g.end)
    setError(null)
  }

  async function saveClass(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const name = subject.trim()
    if (!name) return setError('과목명을 입력해 주세요.')
    if (name.length > 50) return setError('과목명은 50자 이하로 입력해 주세요.')
    if (days.length === 0) return setError('요일을 한 개 이상 선택해 주세요.')
    if (start >= end) return setError('종료 시간은 시작 시간보다 늦어야 합니다.')

    setBusy(true)
    const rows = days.map((day) => ({
      user_id: userId,
      kind: 'class',
      subject: name,
      day,
      start_min: start,
      end_min: end,
    }))
    // 수정 시에는 새 행을 먼저 넣고 성공하면 예전 행을 지운다 (실패해도 기존 수업 보존)
    const ins = await supabase.from('schedule_blocks').insert(rows)
    if (ins.error) {
      setBusy(false)
      return setError('수업을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
    if (editing) {
      const del = await supabase.from('schedule_blocks').delete().in('id', editing.ids)
      if (del.error) setError('수업은 저장했지만 이전 수업을 지우지 못했습니다. 중복된 수업이 있으면 직접 삭제해 주세요.')
    }
    resetForm()
    await load()
    setBusy(false)
  }

  async function deleteClass(g: ClassGroup) {
    if (!window.confirm(`"${g.subject}" 수업을 삭제할까요?`)) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('schedule_blocks').delete().in('id', g.ids)
    if (error) setError('수업을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    if (editing?.key === g.key) resetForm()
    await load()
    setBusy(false)
  }

  async function resetSemester() {
    if (!window.confirm('이번 학기 수업을 모두 삭제할까요? (수시 불가 시간은 유지됩니다)')) return
    setBusy(true)
    setError(null)
    const { error } = await supabase
      .from('schedule_blocks')
      .delete()
      .eq('user_id', userId)
      .eq('kind', 'class')
    if (error) setError('학기 초기화에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    resetForm()
    await load()
    setBusy(false)
  }

  async function toggleManual(day: number, slot: number) {
    const s = slotToMin(slot)
    const e = s + STEP
    const existing = blocks.find(
      (b) => b.kind === 'manual' && b.day === day && b.start_min <= s && b.end_min >= e,
    )
    setBusy(true)
    setError(null)
    if (existing) {
      if (existing.end_min - existing.start_min === STEP) {
        const { error } = await supabase.from('schedule_blocks').delete().eq('id', existing.id)
        if (error) setError(MANUAL_ERROR)
      } else {
        // 여러 칸짜리 블록의 일부를 해제하면 앞뒤 남은 구간으로 나눈다
        const rest = []
        if (existing.start_min < s)
          rest.push({ user_id: userId, kind: 'manual', day, start_min: existing.start_min, end_min: s })
        if (existing.end_min > e)
          rest.push({ user_id: userId, kind: 'manual', day, start_min: e, end_min: existing.end_min })
        const del = await supabase.from('schedule_blocks').delete().eq('id', existing.id)
        if (del.error) setError(MANUAL_ERROR)
        else if (rest.length) {
          const ins = await supabase.from('schedule_blocks').insert(rest)
          if (ins.error) setError(MANUAL_ERROR)
        }
      }
    } else {
      const { error } = await supabase
        .from('schedule_blocks')
        .insert({ user_id: userId, kind: 'manual', day, start_min: s, end_min: e })
      if (error) setError(MANUAL_ERROR)
    }
    await load()
    setBusy(false)
  }

  function toggleDay(d: number) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()))
  }

  const groups = groupClasses(blocks)

  if (loading) return <p className="center">불러오는 중...</p>

  return (
    <>
      {!done && (
        <p className="msg notice" role="status">
          먼저 내 시간표를 입력해 주세요. 다 입력했다면 화면 아래에 떠 있는 <b>입력 완료</b> 버튼을 눌러야 달력·토론·결론
          같은 다른 메뉴가 열려요. 수업이 없으면 비워 두고 눌러도 됩니다.
        </p>
      )}
      {/* 패드 가로 화면에서는 왼쪽 수업 입력·목록, 오른쪽 시간표 격자로 나뉜다 */}
      <div className="split-layout">
      <div>
      <section className="card">
        <h2>{editing ? '수업 수정' : '수업 추가'}</h2>
        <form className="form" onSubmit={saveClass}>
          <label>
            과목명
            <input
              value={subject}
              maxLength={50}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="예: 자료구조"
            />
          </label>
          <div className="day-picker" role="group" aria-label="요일 선택">
            {DAY_LABELS.map((d, i) => (
              <button
                type="button"
                key={d}
                className={`chip ${days.includes(i) ? 'on' : ''}`}
                onClick={() => toggleDay(i)}
                aria-pressed={days.includes(i)}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="time-row">
            <label>
              시작
              <select value={start} onChange={(e) => setStart(Number(e.target.value))}>
                {START_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {minToHHMM(m)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              종료
              <select value={end} onChange={(e) => setEnd(Number(e.target.value))}>
                {END_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {minToHHMM(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && <p className="msg error">{error}</p>}
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="btn" disabled={busy}>
              {editing ? '수정 저장' : '추가'}
            </button>
            {editing && (
              <button type="button" className="btn btn-ghost" onClick={resetForm}>
                취소
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h2>내 수업</h2>
        {groups.length === 0 ? (
          <p>아직 입력한 수업이 없습니다.</p>
        ) : (
          <ul className="list">
            {groups.map((g) => (
              <li key={g.key}>
                <span className="name">
                  {g.subject}
                  <span className="badge">
                    {g.days.map((d) => DAY_LABELS[d]).join('·')} {minToHHMM(g.start)}~{minToHHMM(g.end)}
                  </span>
                </span>
                <span className="row-actions">
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => startEdit(g)}>
                    수정
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => deleteClass(g)}>
                    삭제
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {groups.length > 0 && (
          <div className="actions">
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={resetSemester}>
              학기 초기화
            </button>
          </div>
        )}
      </section>

      </div>
      <div>
      <section className="card">
        <h2>내 시간표</h2>
        <p className="hint" style={{ marginBottom: 10 }}>
          빈 칸을 누르면 수시 불가 시간으로 표시되고, 다시 누르면 해제됩니다. 과목명은 나만 볼 수 있고,
          다른 부원에게는 "불가 시간"만 보입니다.
        </p>
        <div className="legend">
          <span><i className="swatch class" /> 수업</span>
          <span><i className="swatch manual" /> 수시 불가</span>
        </div>
        <ScheduleGrid blocks={blocks} busy={busy} onToggleManual={toggleManual} />
      </section>
      </div>
      </div>

      {!done && (
        <>
          {/* 고정 막대가 내용을 가리지 않도록 아래에 여백을 둔다 */}
          <div className="complete-spacer" aria-hidden="true" />
          <div className="complete-bar" role="region" aria-label="시간표 입력 완료">
            <div className="complete-bar-inner">
              <p className="complete-bar-text">
                <b>시간표를 다 입력했나요?</b>
                <span>누르면 달력·토론·결론이 열려요. 이후에도 시간표는 고칠 수 있어요.</span>
              </p>
              <button className="btn complete-bar-btn" disabled={completing || busy} onClick={complete}>
                {completing ? '저장 중...' : '입력 완료'}
              </button>
            </div>
            {completeError && <p className="msg error" role="alert">{completeError}</p>}
          </div>
        </>
      )}
    </>
  )
}
