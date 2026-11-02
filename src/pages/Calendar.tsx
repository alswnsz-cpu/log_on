import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import {
  EVENT_COLUMNS,
  WEEKDAYS,
  formatDateKo,
  hhmm,
  monthGrid,
  sortEvents,
  timeRange,
  todayStr,
  ymd,
  type CalendarEvent,
} from '../lib/calendar'

interface EventForm {
  title: string
  date: string
  start: string
  end: string
  location: string
  memo: string
}

const emptyForm = (date: string): EventForm => ({ title: '', date, start: '', end: '', location: '', memo: '' })

export default function Calendar() {
  const { profile } = useAuth()
  const isOfficer = profile?.role === 'officer'

  const [today] = useState(todayStr)
  const [view, setView] = useState(() => {
    const [y, m] = todayStr().split('-').map(Number)
    return { year: y, month0: m - 1 }
  })
  const [selected, setSelected] = useState(today)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [form, setForm] = useState<EventForm | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const cells = useMemo(() => monthGrid(view.year, view.month0), [view])
  const rangeStart = cells[0].date
  const rangeEnd = cells[cells.length - 1].date

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('events').select(EVENT_COLUMNS).gte('event_date', rangeStart).lte('event_date', rangeEnd),
      supabase
        .from('events')
        .select(EVENT_COLUMNS)
        .gte('event_date', today)
        .order('event_date')
        .order('start_time', { nullsFirst: true })
        .limit(5),
    ]).then(([a, b]) => {
      if (!alive) return
      if (a.error || b.error) {
        setLoadError('일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      } else {
        setLoadError(null)
        setEvents(a.data as CalendarEvent[])
        setUpcoming(b.data as CalendarEvent[])
      }
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [rangeStart, rangeEnd, today, reloadKey])

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of sortEvents(events)) {
      const list = map.get(e.event_date) ?? []
      list.push(e)
      map.set(e.event_date, list)
    }
    return map
  }, [events])

  const dayEvents = byDate.get(selected) ?? []

  function goTo(date: string) {
    const [y, m] = date.split('-').map(Number)
    setView({ year: y, month0: m - 1 })
    setSelected(date)
  }

  function shiftMonth(delta: number) {
    const d = new Date(view.year, view.month0 + delta, 1)
    const year = d.getFullYear()
    const month0 = d.getMonth()
    setView({ year, month0 })
    const [ty, tm] = today.split('-').map(Number)
    setSelected(ty === year && tm - 1 === month0 ? today : ymd(year, month0, 1))
  }

  function openAdd(date: string) {
    setEditingId(null)
    setFormError(null)
    setForm(emptyForm(date))
  }

  function openEdit(e: CalendarEvent) {
    setEditingId(e.id)
    setFormError(null)
    setForm({
      title: e.title,
      date: e.event_date,
      start: hhmm(e.start_time),
      end: hhmm(e.end_time),
      location: e.location ?? '',
      memo: e.memo ?? '',
    })
  }

  function closeForm() {
    setForm(null)
    setEditingId(null)
    setFormError(null)
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const title = form.title.trim()
    const location = form.location.trim()
    const memo = form.memo.trim()
    if (title.length < 1 || title.length > 100) return setFormError('제목은 1~100자로 입력해 주세요.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return setFormError('날짜를 선택해 주세요.')
    if (form.end && !form.start) return setFormError('종료 시간은 시작 시간을 입력했을 때만 쓸 수 있어요.')
    if (form.start && form.end && form.end <= form.start) return setFormError('종료 시간은 시작 시간보다 늦어야 합니다.')
    if (location.length > 100) return setFormError('장소는 100자 이하로 입력해 주세요.')
    if (memo.length > 1000) return setFormError('메모는 1000자 이하로 입력해 주세요.')

    setFormError(null)
    setSaving(true)
    const row = {
      title,
      event_date: form.date,
      start_time: form.start || null,
      end_time: form.end || null,
      location: location || null,
      memo: memo || null,
    }
    const { error } =
      editingId === null
        ? await supabase.from('events').insert(row)
        : await supabase.from('events').update(row).eq('id', editingId)
    setSaving(false)
    if (error) return setFormError('일정을 저장하지 못했습니다. 임원진 권한을 확인해 주세요.')
    closeForm()
    goTo(row.event_date)
    setReloadKey((k) => k + 1)
  }

  async function remove(e: CalendarEvent) {
    if (!window.confirm(`"${e.title}" 일정을 삭제할까요? 되돌릴 수 없습니다.`)) return
    setActionError(null)
    setBusyId(e.id)
    const { error } = await supabase.from('events').delete().eq('id', e.id)
    setBusyId(null)
    if (error) return setActionError('일정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    setReloadKey((k) => k + 1)
  }

  return (
    <>
      {loadError && <p className="msg error" role="alert">{loadError}</p>}

      <section className="card">
        <div className="section-head">
          <h2>
            {view.year}년 {view.month0 + 1}월
          </h2>
          <div className="cal-nav">
            <button className="btn btn-sm btn-ghost" onClick={() => shiftMonth(-1)} aria-label="이전 달">
              ‹
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => goTo(today)}>
              오늘
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => shiftMonth(1)} aria-label="다음 달">
              ›
            </button>
          </div>
        </div>

        <div className="cal-grid cal-weekdays" aria-hidden="true">
          {WEEKDAYS.map((w, i) => (
            <span key={w} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>
              {w}
            </span>
          ))}
        </div>
        <div className="cal-grid">
          {cells.map((c, i) => {
            const evs = byDate.get(c.date) ?? []
            const cls = [
              'cal-cell',
              c.inMonth ? '' : 'out',
              c.date === today ? 'today' : '',
              c.date === selected ? 'sel' : '',
              i % 7 === 0 ? 'sun' : i % 7 === 6 ? 'sat' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={c.date}
                type="button"
                className={cls}
                onClick={() => goTo(c.date)}
                aria-label={`${formatDateKo(c.date)}${evs.length > 0 ? `, 일정 ${evs.length}개` : ''}`}
                aria-pressed={c.date === selected}
              >
                <span className="cal-day">{c.day}</span>
                {evs.slice(0, 2).map((e) => (
                  <span key={e.id} className="cal-ev">{e.title}</span>
                ))}
                {evs.length > 2 && <span className="cal-more">+{evs.length - 2}</span>}
              </button>
            )
          })}
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>{formatDateKo(selected)}</h2>
          {isOfficer && !form && (
            <button className="btn btn-sm" onClick={() => openAdd(selected)}>
              일정 추가
            </button>
          )}
        </div>
        {actionError && <p className="msg error" role="alert" style={{ marginBottom: 8 }}>{actionError}</p>}
        {loading ? (
          <p>불러오는 중...</p>
        ) : dayEvents.length === 0 ? (
          <p>이 날은 일정이 없습니다.</p>
        ) : (
          <ul className="list">
            {dayEvents.map((e) => (
              <li key={e.id}>
                <span className="name cal-name">
                  {e.title}
                  <span className="hint" style={{ display: 'block' }}>
                    {timeRange(e)}
                    {e.location && <> · {e.location}</>}
                  </span>
                  {e.memo && <span className="hint cal-memo">{e.memo}</span>}
                </span>
                {isOfficer && (
                  <span className="row-actions">
                    <button className="btn btn-sm btn-ghost" disabled={busyId === e.id} onClick={() => openEdit(e)}>
                      수정
                    </button>
                    <button className="btn btn-sm btn-ghost" disabled={busyId === e.id} onClick={() => remove(e)}>
                      삭제
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOfficer && form && (
        <section className="card">
          <h2>{editingId === null ? '일정 추가' : '일정 수정'}</h2>
          <form className="form" onSubmit={save}>
            <label>
              제목
              <input
                value={form.title}
                maxLength={100}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="예: 정기 모임"
              />
            </label>
            <label>
              날짜
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <div className="time-row">
              <label>
                시작 시간 (선택)
                <input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </label>
              <label>
                종료 시간 (선택)
                <input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </label>
            </div>
            <label>
              장소 (선택)
              <input value={form.location} maxLength={100} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
            <label>
              메모 (선택)
              <textarea value={form.memo} maxLength={1000} rows={3} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </label>
            {formError && <p className="msg error" role="alert">{formError}</p>}
            <div className="actions" style={{ marginTop: 0 }}>
              <button className="btn" disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
              <button type="button" className="btn btn-ghost" onClick={closeForm}>
                취소
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="card">
        <h2>다가오는 일정</h2>
        {loading ? (
          <p>불러오는 중...</p>
        ) : upcoming.length === 0 ? (
          <p>다가오는 일정이 없습니다.</p>
        ) : (
          <ul className="list">
            {upcoming.map((e) => (
              <li key={e.id}>
                <button type="button" className="cal-upcoming" onClick={() => goTo(e.event_date)}>
                  <span className="name cal-name">
                    {e.title}
                    <span className="hint" style={{ display: 'block' }}>
                      {formatDateKo(e.event_date)} · {timeRange(e)}
                      {e.location && <> · {e.location}</>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
