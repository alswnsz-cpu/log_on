import { useState } from 'react'

export interface DebateMember {
  id: string
  name: string
}

interface Props {
  members: DebateMember[]
  participantIds: string[]
  submittedIds: string[]
  locked: boolean
  busy: boolean
  onToggle: (userId: string, selected: boolean) => Promise<void>
}

export default function DebateParticipants({
  members,
  participantIds,
  submittedIds,
  locked,
  busy,
  onToggle,
}: Props) {
  const [search, setSearch] = useState('')

  const selected = new Set(participantIds)
  const submitted = new Set(submittedIds)

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
          <strong>{submitted.size}명</strong>
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
          토론이 시작되어 참여자 명단을 변경할 수 없습니다.
        </p>
      )}

      <div className="debate-member-list">
        {shown.map(member => {
          const checked = selected.has(member.id)
          const hasSubmitted = submitted.has(member.id)

          return (
            <label
              className="debate-member-row"
              key={member.id}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={locked || busy || hasSubmitted}
                onChange={e => {
                  void onToggle(member.id, e.target.checked)
                }}
              />

              <span className="debate-member-name">
                {member.name}
              </span>

              {hasSubmitted ? (
                <span className="badge ok">의견 제출</span>
              ) : checked ? (
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
        최소 2명의 참여자를 지정해야 토론을 시작할 수 있습니다.
        사전 의견을 제출한 부원은 참여자 명단에서 제외할 수 없습니다.
      </p>
    </section>
  )
}
