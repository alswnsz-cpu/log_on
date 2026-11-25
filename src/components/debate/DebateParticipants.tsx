import { useState } from 'react'

export interface DebateMember {
  id: string
  name: string
}

interface Props {
  members: DebateMember[]
  participantIds: string[]
  submittedCount: number
  locked: boolean
  busy: boolean
  onToggle: (userId: string, selected: boolean) => Promise<void>
}

export default function DebateParticipants({
  members,
  participantIds,
  submittedCount,
  locked,
  busy,
  onToggle,
}: Props) {
  const [search, setSearch] = useState('')

  const selected = new Set(participantIds)

  const shown = members.filter(member =>
    member.name.toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <section className="card debate-participants">
      <div className="section-head">
        <h2>토론 참여자 관리</h2>
        <span className="badge">임원진 전용</span>
      </div>

      <div className="debate-summary-grid">
        <div className="debate-summary-item">
          <span className="hint">전체 부원</span>
          <strong>{members.length}명</strong>
        </div>

        <div className="debate-summary-item">
          <span className="hint">토론 참여자</span>
          <strong>{selected.size}명</strong>
        </div>

        <div className="debate-summary-item">
          <span className="hint">사전 의견 제출</span>
          <strong>{submittedCount}명</strong>
        </div>
      </div>

      <div className="form">
        <label>
          부원 검색
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="부원 이름을 입력하세요"
          />
        </label>
      </div>

      {locked && (
        <p className="hint">
          사전 의견 제출이 시작되어 참여자 명단을 변경할 수 없습니다.
        </p>
      )}

      <div className="debate-member-list">
        {shown.map(member => {
          const checked = selected.has(member.id)

          return (
            <label
              className="debate-member-row"
              key={member.id}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={locked || busy}
                onChange={e => {
                  void onToggle(member.id, e.target.checked)
                }}
              />

              <span className="debate-member-name">
                {member.name}
              </span>

              {checked ? (
                <span className="badge ok">참여</span>
              ) : (
                <span className="hint">미참여</span>
              )}
            </label>
          )
        })}

        {shown.length === 0 && (
          <p className="hint">표시할 부원이 없습니다.</p>
        )}
      </div>

      <p className="hint">
        최소 4명의 참여자를 지정해야 토론을 시작할 수 있습니다.
        첫 사전 의견이 제출되면 참여자 명단이 잠깁니다. 제출자별 정보는 공개되지 않습니다.
      </p>
    </section>
  )
}
