import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useDialog } from '../components/dialog-context'
import {
  CLUB_COLOR,
  EVENT_COLUMNS,
  MAX_REPEAT_DAYS,
  OVERRIDE_COLUMNS,
  WEEKDAYS,
  addDays,
  eventColor,
  expandEvents,
  formatDateKo,
  hhmm,
  monthGrid,
  ownerName,
  sortOccurrences,
  timeRange,
  todayStr,
  weekdayKo,
  ymd,
  type CalendarEvent,
  type EventOverride,
  type Occurrence,
} from '../lib/calendar'

interface EventForm {
  /** 반복 일정을 수정할 때: 이 날짜만('one') 또는 모든 날짜('all'). 그 밖에는 항상 'all' */
  scope: 'one' | 'all'
  /** scope 가 'one' 일 때 수정하는 날짜 */
  occDate: string
  title: string
  date: string
  start: string
  end: string
  location: string
  memo: string
  repeat: boolean
  until: string
  skip: string[]
  /** 동아리 공식 일정 (임원진만 선택할 수 있다) */
  club: boolean
}

const emptyForm = (date: string, club: boolean): EventForm => ({
  scope: 'all',
  occDate: '',
  title: '',
  date,
  start: '',
  end: '',
  location: '',
  memo: '',
  repeat: false,
  until: '',
  skip: [],
  club,
})

/** 화면 폭이 px 이상인지(패드 이상인지)를 알려 준다. 화면 크기가 바뀌면 따라서 바뀐다. */
function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export default function Calendar() {
  const { profile } = useAuth()
  const dialog = useDialog()
  // 날짜 칸에 보여 줄 일정 막대 수: 폰 2개, 패드 이상 3개
  const maxChips = useMinWidth(768) ? 3 : 2
  const isOfficer = profile?.role === 'officer'
  /** 임원진은 모든 일정을, 부원은 본인이 만든 일정만 고치거나 지울 수 있다. */
  const canEdit = (e: CalendarEvent) => isOfficer || e.created_by === profile?.id

  const [today] = useState(todayStr)
  const [view, setView] = useState(() => {
    const [y, m] = todayStr().split('-').map(Number)
    return { year: y, month0: m - 1 }
  })
  const [selected, setSelected] = useState(today)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [futureEvents, setFutureEvents] = useState<CalendarEvent[]>([])
  // 반복 일정의 날짜별 수정 내용 (이 달 달력 / 오늘 이후)
  const [overrides, setOverrides] = useState<EventOverride[]>([])
  const [futureOverrides, setFutureOverrides] = useState<EventOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [form, setForm] = useState<EventForm | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  /** 수정 중인 날짜의 일정(반복 일정이면 "이 날만 / 모든 날짜" 전환에 쓴다) */
  const [editTarget, setEditTarget] = useState<Occurrence | null>(null)
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
      // 이 달 달력에 걸리는 일정: 반복 없는 일정은 범위 안의 것, 반복 일정은 기간이 범위와 겹치는 것
      supabase
        .from('events')
        .select(EVENT_COLUMNS)
        .or(
          `and(repeat_weekly.eq.false,event_date.gte.${rangeStart},event_date.lte.${rangeEnd}),` +
            `and(repeat_weekly.eq.true,event_date.lte.${rangeEnd},repeat_until.gte.${rangeStart})`,
        ),
      // 다가오는 일정: 오늘 이후에 한 번이라도 나오는 일정
      supabase.from('events').select(EVENT_COLUMNS).or(`event_date.gte.${today},repeat_until.gte.${today}`),
      // 반복 일정을 날짜마다 따로 수정한 내용
      supabase.from('event_overrides').select(OVERRIDE_COLUMNS).gte('occ_date', rangeStart).lte('occ_date', rangeEnd),
      supabase.from('event_overrides').select(OVERRIDE_COLUMNS).gte('occ_date', today),
    ]).then(([a, b, c, d]) => {
      if (!alive) return
      if (a.error || b.error) {
        setLoadError('일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      } else {
        setLoadError(null)
        setEvents(a.data as unknown as CalendarEvent[])
        setFutureEvents(b.data as unknown as CalendarEvent[])
        // 날짜별 수정 내용을 못 불러와도 달력은 원래 내용으로 보여 준다
        setOverrides(c.error ? [] : (c.data as EventOverride[]))
        setFutureOverrides(d.error ? [] : (d.data as EventOverride[]))
      }
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [rangeStart, rangeEnd, today, reloadKey])

  const byDate = useMemo(() => {
    const map = new Map<string, Occurrence[]>()
    for (const o of sortOccurrences(expandEvents(events, rangeStart, rangeEnd, overrides))) {
      const list = map.get(o.occ_date) ?? []
      list.push(o)
      map.set(o.occ_date, list)
    }
    return map
  }, [events, overrides, rangeStart, rangeEnd])

  const upcoming = useMemo(
    () => sortOccurrences(expandEvents(futureEvents, today, addDays(today, 365), futureOverrides)).slice(0, 5),
    [futureEvents, futureOverrides, today],
  )

  const dayEvents = byDate.get(selected) ?? []
  /** 반복 일정의 한 날짜만 수정하는 중이면 true (날짜·반복 설정은 숨긴다) */
  const oneDay = form !== null && editingId !== null && form.scope === 'one'

  // 범례: 이 달 달력에 일정이 있는 부원들의 색
  const legend = useMemo(() => {
    const owners = new Map<string, { name: string; color: string }>()
    let hasClub = false
    for (const list of byDate.values()) {
      for (const o of list) {
        if (o.is_club) hasClub = true
        else if (!owners.has(o.created_by)) owners.set(o.created_by, { name: ownerName(o), color: eventColor(o) })
      }
    }
    return { hasClub, owners: [...owners.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko')) }
  }, [byDate])

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
    setForm(emptyForm(date, isOfficer))
  }

  /** 수정 화면에 채울 값. 'one' 은 그 날짜에 보이는 내용, 'all' 은 원래(전체에 적용되는) 일정 내용 */
  function formFor(o: Occurrence, scope: 'one' | 'all'): EventForm {
    const src = scope === 'one' ? o : o.base
    return {
      scope,
      occDate: o.occ_date,
      title: src.title,
      date: o.base.event_date,
      start: hhmm(src.start_time),
      end: hhmm(src.end_time),
      location: src.location ?? '',
      memo: src.memo ?? '',
      repeat: o.base.repeat_weekly,
      until: o.base.repeat_until ?? '',
      skip: [...o.base.skip_dates].sort(),
      club: o.base.is_club,
    }
  }

  /** 반복 일정은 기본으로 "이 날만 수정", 일반 일정은 전체(그 일정 하나)를 수정한다 */
  function openEdit(o: Occurrence) {
    setEditingId(o.id)
    setEditTarget(o)
    setFormError(null)
    setForm(formFor(o, o.repeat_weekly ? 'one' : 'all'))
  }

  /** "이 날만 수정 / 모든 날짜 수정"을 바꾼다. 쓰던 내용은 해당 범위의 원래 내용으로 다시 채워진다. */
  function switchScope(scope: 'one' | 'all') {
    if (!editTarget || form?.scope === scope) return
    setFormError(null)
    setForm(formFor(editTarget, scope))
  }

  function closeForm() {
    setForm(null)
    setEditingId(null)
    setEditTarget(null)
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

    // 반복 일정의 한 날짜만 수정: 그 날짜의 내용만 따로 저장하고, 원래 일정과 다른 날짜는 건드리지 않는다
    if (editingId !== null && form.scope === 'one') {
      setFormError(null)
      setSaving(true)
      const { error: ovError } = await supabase.from('event_overrides').upsert(
        {
          event_id: editingId,
          occ_date: form.occDate,
          title,
          start_time: form.start || null,
          end_time: form.end || null,
          location: location || null,
          memo: memo || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,occ_date' },
      )
      setSaving(false)
      if (ovError) return setFormError('이 날짜의 내용을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      const day = form.occDate
      closeForm()
      goTo(day)
      setReloadKey((k) => k + 1)
      return
    }

    if (form.repeat) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.until)) return setFormError('반복이 끝나는 날짜를 선택해 주세요.')
      if (form.until < form.date) return setFormError('끝나는 날짜는 시작 날짜보다 빠를 수 없어요.')
      if (form.until > addDays(form.date, MAX_REPEAT_DAYS)) return setFormError('반복은 시작일로부터 최대 2년까지 설정할 수 있어요.')
    }

    setFormError(null)
    setSaving(true)
    const row = {
      title,
      event_date: form.date,
      start_time: form.start || null,
      end_time: form.end || null,
      location: location || null,
      memo: memo || null,
      repeat_weekly: form.repeat,
      repeat_until: form.repeat ? form.until : null,
      skip_dates: form.repeat ? form.skip : [],
      // 공식 일정 여부는 임원진만 정한다. 부원은 보내지 않아도 개인 일정으로 저장된다.
      ...(isOfficer ? { is_club: form.club } : {}),
    }
    const { error } =
      editingId === null
        ? await supabase.from('events').insert(row)
        : await supabase.from('events').update(row).eq('id', editingId)
    setSaving(false)
    if (error) return setFormError('일정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    closeForm()
    goTo(row.event_date)
    setReloadKey((k) => k + 1)
  }

  /** 그 날짜만 따로 수정한 내용을 지우고 원래(전체) 내용으로 되돌린다. */
  async function resetOverride(o: Occurrence) {
    const ok = await dialog.confirm({
      title: '원래대로 되돌리기',
      message: `${formatDateKo(o.occ_date)}에만 따로 수정한 내용을 지우고, 다른 날짜와 같은 원래 내용으로 되돌릴까요?`,
      confirmLabel: '되돌리기',
    })
    if (!ok) return
    setActionError(null)
    setBusyId(o.id)
    const { error } = await supabase.from('event_overrides').delete().eq('event_id', o.id).eq('occ_date', o.occ_date)
    setBusyId(null)
    if (error) return setActionError('원래대로 되돌리지 못했습니다. 잠시 후 다시 시도해 주세요.')
    setReloadKey((k) => k + 1)
  }

  async function remove(o: Occurrence) {
    // 날짜별로 제목을 바꿨어도 지우는 대상은 원래 일정 전체다
    const e = o.base
    const msg = e.repeat_weekly
      ? `"${e.title}" 반복 일정 전체를 삭제할까요?\n지난 모임을 포함해 모든 날짜에서 사라지고 되돌릴 수 없습니다.`
      : `"${e.title}" 일정을 삭제할까요? 되돌릴 수 없습니다.`
    const ok = await dialog.confirm({
      title: e.repeat_weekly ? '반복 일정 전체 삭제' : '일정 삭제',
      message: msg,
      confirmLabel: e.repeat_weekly ? '전체 삭제' : '삭제',
      danger: true,
    })
    if (!ok) return
    setActionError(null)
    setBusyId(e.id)
    const { error } = await supabase.from('events').delete().eq('id', e.id)
    setBusyId(null)
    if (error) return setActionError('일정을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    setReloadKey((k) => k + 1)
  }

  /** 반복 일정에서 이 날짜 하루만 뺀다. 나머지 날짜는 그대로다. */
  async function skipDay(o: Occurrence) {
    const ok = await dialog.confirm({
      title: '이 날만 빼기',
      message: `${formatDateKo(o.occ_date)} 하루만 "${o.title}"에서 뺄까요?\n나머지 날짜는 그대로 남고, 수정 화면에서 되돌릴 수 있어요.`,
      confirmLabel: '빼기',
    })
    if (!ok) return
    setActionError(null)
    setBusyId(o.id)
    const skip = [...new Set([...o.skip_dates, o.occ_date])].sort()
    const { error } = await supabase.from('events').update({ skip_dates: skip }).eq('id', o.id)
    setBusyId(null)
    if (error) return setActionError('이 날짜를 빼지 못했습니다. 잠시 후 다시 시도해 주세요.')
    setReloadKey((k) => k + 1)
  }

  return (
    <>
      {loadError && <p className="msg error" role="alert">{loadError}</p>}

      {/* 패드 가로 화면에서는 왼쪽 달력, 오른쪽 일정 목록으로 나뉜다 */}
      <div className="cal-layout">
      <div>
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
                {evs.slice(0, maxChips).map((e) => (
                  <span key={e.id} className="cal-ev" style={{ background: eventColor(e) }}>{e.title}</span>
                ))}
                {evs.length > maxChips && <span className="cal-more">+{evs.length - maxChips}</span>}
              </button>
            )
          })}
        </div>
        {(legend.hasClub || legend.owners.length > 0) && (
          <div className="cal-legend" aria-label="색 설명">
            {legend.hasClub && (
              <span className="cal-legend-item">
                <i className="cal-dot" style={{ background: CLUB_COLOR }} />
                동아리 공식
              </span>
            )}
            {legend.owners.map((o) => (
              <span key={o.name} className="cal-legend-item">
                <i className="cal-dot" style={{ background: o.color }} />
                {o.name}
              </span>
            ))}
          </div>
        )}
      </section>
      </div>

      <div>
      <section className="card">
        <div className="section-head">
          <h2>{formatDateKo(selected)}</h2>
          {!form && (
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
            {dayEvents.map((o) => (
              <li key={`${o.id}-${o.occ_date}`}>
                <span className="name cal-name">
                  <i className="cal-dot" style={{ background: eventColor(o) }} />
                  {o.title}
                  {o.is_club && <span className="badge cal-badge">공식</span>}
                  {o.repeat_weekly && <span className="badge cal-badge">매주</span>}
                  {o.overridden && <span className="badge cal-badge ok">수정됨</span>}
                  <span className="hint" style={{ display: 'block' }}>
                    {o.is_club ? '동아리' : ownerName(o)} · {timeRange(o)}
                    {o.location && <> · {o.location}</>}
                  </span>
                  {o.memo && <span className="hint cal-memo">{o.memo}</span>}
                </span>
                {canEdit(o) && (
                  <span className="row-actions">
                    <button className="btn btn-sm btn-ghost" disabled={busyId === o.id} onClick={() => openEdit(o)}>
                      수정
                    </button>
                    {o.overridden && (
                      <button className="btn btn-sm btn-ghost" disabled={busyId === o.id} onClick={() => resetOverride(o)}>
                        원래대로
                      </button>
                    )}
                    {o.repeat_weekly && (
                      <button className="btn btn-sm btn-ghost" disabled={busyId === o.id} onClick={() => skipDay(o)}>
                        이 날만 빼기
                      </button>
                    )}
                    <button className="btn btn-sm btn-ghost" disabled={busyId === o.id} onClick={() => remove(o)}>
                      {o.repeat_weekly ? '전체 삭제' : '삭제'}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {form && (
        <section className="card">
          <h2>{editingId === null ? '일정 추가' : '일정 수정'}</h2>
          {editingId !== null && editTarget?.repeat_weekly && (
            <div className="day-picker" role="group" aria-label="수정 범위" style={{ margin: '4px 0 12px' }}>
              <button
                type="button"
                className={form.scope === 'one' ? 'chip on' : 'chip'}
                aria-pressed={form.scope === 'one'}
                onClick={() => switchScope('one')}
              >
                이 날만 수정
              </button>
              <button
                type="button"
                className={form.scope === 'all' ? 'chip on' : 'chip'}
                aria-pressed={form.scope === 'all'}
                onClick={() => switchScope('all')}
              >
                모든 날짜 수정
              </button>
            </div>
          )}
          <form className="form" onSubmit={save}>
            <label>
              제목
              <input
                value={form.title}
                maxLength={100}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={isOfficer ? '예: 정기 모임' : '예: 스터디, 시험, 동아리 불참'}
              />
            </label>
            {!oneDay &&
              (isOfficer ? (
                <label className="check-row">
                  <input type="checkbox" checked={form.club} onChange={(e) => setForm({ ...form, club: e.target.checked })} />
                  <span>
                    동아리 공식 일정
                    <span className="hint" style={{ display: 'block', fontWeight: 400 }}>
                      체크하면 모든 부원에게 공식 일정(보라색)으로 보여요. 체크하지 않으면 내 개인 일정이에요.
                    </span>
                  </span>
                </label>
              ) : (
                <p className="hint">내 일정은 모든 부원에게 내 색으로 보여요.</p>
              ))}
            {!oneDay && (
              <label>
                날짜 (반복이면 시작 날짜)
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </label>
            )}
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
            {!oneDay && (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.repeat}
                  onChange={(e) => setForm({ ...form, repeat: e.target.checked })}
                />
                <span>
                  매주 반복
                  {form.repeat && /^\d{4}-\d{2}-\d{2}$/.test(form.date) && (
                    <span className="hint" style={{ display: 'block', fontWeight: 400 }}>
                      매주 {weekdayKo(form.date)}요일마다 달력에 나와요.
                    </span>
                  )}
                </span>
              </label>
            )}
            {!oneDay && form.repeat && (
              <label>
                반복이 끝나는 날짜 (최대 2년)
                <input type="date" value={form.until} onChange={(e) => setForm({ ...form, until: e.target.value })} />
              </label>
            )}
            {!oneDay && form.repeat && form.skip.length > 0 && (
              <div className="form-group">
                <span className="form-group-title">뺀 날짜 (눌러서 되돌리기)</span>
                <div className="day-picker">
                  {form.skip.map((d) => (
                    <button
                      type="button"
                      key={d}
                      className="chip"
                      onClick={() => setForm({ ...form, skip: form.skip.filter((x) => x !== d) })}
                    >
                      {formatDateKo(d)} ✕
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label>
              장소 (선택)
              <input value={form.location} maxLength={100} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </label>
            <label>
              메모 (선택)
              <textarea value={form.memo} maxLength={1000} rows={3} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
            </label>
            {oneDay && (
              <p className="hint">
                {formatDateKo(form.occDate)}만 바뀌고 다른 날짜는 그대로예요. 원래 내용으로 되돌리려면 일정 목록의 "원래대로"를
                눌러 주세요.
              </p>
            )}
            {editingId !== null && form.scope === 'all' && form.repeat && (
              <p className="hint">
                모든 날짜에 적용돼요. 이미 그 날짜만 따로 수정한 날은 수정한 내용이 그대로 유지돼요.
              </p>
            )}
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
            {upcoming.map((o) => (
              <li key={`${o.id}-${o.occ_date}`}>
                <button type="button" className="cal-upcoming" onClick={() => goTo(o.occ_date)}>
                  <span className="name cal-name">
                    <i className="cal-dot" style={{ background: eventColor(o) }} />
                    {o.title}
                    {o.is_club && <span className="badge cal-badge">공식</span>}
                    {o.repeat_weekly && <span className="badge cal-badge">매주</span>}
                    <span className="hint" style={{ display: 'block' }}>
                      {o.is_club ? '동아리' : ownerName(o)} · {formatDateKo(o.occ_date)} · {timeRange(o)}
                      {o.location && <> · {o.location}</>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
      </div>
    </>
  )
}
