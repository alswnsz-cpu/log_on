import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import ScheduleGrid from '../components/ScheduleGrid'
import type { MyBlock } from '../components/ScheduleGrid'

interface MemberRow {
  id: string
  name: string
}

const COLUMNS = 'id, kind, subject, day, start_min, end_min'

/** 승인된 부원의 시간표를 읽기 전용으로 보는 화면 */
export default function Members() {
  const { session } = useAuth()
  const myId = session!.user.id
  const [members, setMembers] = useState<MemberRow[]>([])
  /** 졸업생으로 지정된 부원. 부원 목록과 함께 불러와서, 이름 칩이 줄을 옮겨 다니지 않게 한다 */
  const [alumniIds, setAlumniIds] = useState<Set<string>>(new Set())
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())
  /** 시간표를 비공개로 설정한 부원 */
  const [privateIds, setPrivateIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  /** 마지막으로 불러온 시간표와 그 주인 */
  const [loaded, setLoaded] = useState<{ id: string; blocks: MyBlock[] } | null>(null)
  const [blocksError, setBlocksError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      const [p, s, v, al] = await Promise.all([
        supabase.from('profiles').select('id, name').eq('status', 'approved').order('name'),
        supabase.from('schedule_status').select('user_id'),
        supabase.from('schedule_privacy').select('user_id').eq('is_private', true),
        supabase.from('member_alumni').select('user_id'),
      ])
      if (!alive) return
      // 졸업 목록을 못 읽으면 줄이 틀리게 나뉘므로 불러오기 오류로 처리한다
      if (p.error || s.error || v.error || al.error) setError('부원 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      else {
        setMembers(p.data as MemberRow[])
        setAlumniIds(new Set((al.data as { user_id: string }[]).map((r) => r.user_id)))
        setDoneIds(new Set((s.data as { user_id: string }[]).map((r) => r.user_id)))
        setPrivateIds(new Set((v.data as { user_id: string }[]).map((r) => r.user_id)))
      }
      setLoading(false)
    }
    load()
    return () => {
      alive = false
    }
  }, [])

  const selected = members.find((m) => m.id === selectedId) ?? null
  const selectedDone = selected ? doneIds.has(selected.id) : false
  /** 다른 부원이 비공개로 설정한 경우 (본인 시간표는 비공개여도 볼 수 있다) */
  const selectedHidden = selected ? selected.id !== myId && privateIds.has(selected.id) : false

  useEffect(() => {
    // 시간표를 입력하지 않았거나 비공개인 사람은 조회하지 않는다
    if (!selectedId || !doneIds.has(selectedId)) return
    if (selectedId !== myId && privateIds.has(selectedId)) return
    let alive = true
    supabase
      .from('schedule_blocks')
      .select(COLUMNS)
      .eq('user_id', selectedId)
      .order('day')
      .order('start_min')
      .then(({ data, error: err }) => {
        if (!alive) return
        if (err) setBlocksError('시간표를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
        else {
          setBlocksError(null)
          setLoaded({ id: selectedId, blocks: data as MyBlock[] })
        }
      })
    return () => {
      alive = false
    }
  }, [selectedId, doneIds, privateIds, myId])

  if (loading) return <p className="center">불러오는 중...</p>
  if (error) return <p className="msg error">{error}</p>

  const blocks = loaded && loaded.id === selectedId ? loaded.blocks : null

  // 이름순으로 불러온 목록을 부원과 졸업생으로 나눈다(각 줄 안의 이름순은 그대로)
  const currentList = members.filter((m) => !alumniIds.has(m.id))
  const alumniList = members.filter((m) => alumniIds.has(m.id))

  const chip = (m: MemberRow) => (
    <button
      type="button"
      key={m.id}
      className={m.id === selectedId ? 'chip on' : 'chip'}
      aria-pressed={m.id === selectedId}
      onClick={() => setSelectedId(m.id)}
    >
      {m.name}
      {m.id === myId ? ' (나)' : ''}
      {doneIds.has(m.id) ? '' : ' · 미입력'}
      {m.id !== myId && privateIds.has(m.id) ? ' · 비공개' : ''}
    </button>
  )

  return (
    <section className="card">
      <h2>멤버별 시간표</h2>
      <p className="hint" style={{ marginBottom: 10 }}>
        부원을 고르면 그 사람의 시간표를 볼 수 있어요. 읽기 전용이며, 시간표는 본인만 고칠 수 있습니다.
      </p>
      {members.length === 0 ? (
        <p className="hint">승인된 부원이 없습니다.</p>
      ) : alumniList.length === 0 ? (
        <div className="day-picker" style={{ marginBottom: 12 }}>
          {members.map(chip)}
        </div>
      ) : (
        <>
          {currentList.length > 0 && (
            <>
              <p className="hint" style={{ marginBottom: 6 }}>부원 ({currentList.length})</p>
              <div className="day-picker" style={{ marginBottom: 12 }}>
                {currentList.map(chip)}
              </div>
            </>
          )}
          <p className="hint" style={{ marginBottom: 6 }}>졸업생 ({alumniList.length})</p>
          <div className="day-picker" style={{ marginBottom: 12 }}>
            {alumniList.map(chip)}
          </div>
        </>
      )}

      {!selected && members.length > 0 && <p className="hint">위에서 부원을 선택해 주세요.</p>}
      {selected && !selectedDone && !selectedHidden && (
        <p className="hint">{selected.name}님은 시간표 미입력 상태입니다.</p>
      )}
      {selected && selectedHidden && (
        <p className="hint">{selected.name}님은 시간표를 비공개로 설정했습니다.</p>
      )}
      {selected && selectedDone && !selectedHidden && blocksError && <p className="msg error">{blocksError}</p>}
      {selected && selectedDone && !selectedHidden && !blocksError && !blocks && <p className="center">불러오는 중...</p>}
      {selected && selectedDone && !selectedHidden && blocks && (
        <>
          <h3 style={{ margin: '4px 0 8px' }}>{selected.name}님의 시간표</h3>
          {blocks.length === 0 && <p className="hint">등록된 수업이나 불가 시간이 없습니다.</p>}
          <div className="legend">
            <span><i className="swatch class" /> 수업</span>
            <span><i className="swatch manual" /> 수시 불가</span>
          </div>
          <ScheduleGrid blocks={blocks} readOnly />
        </>
      )}
    </section>
  )
}
