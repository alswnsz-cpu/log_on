import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import type { Profile, Role, Status } from '../auth/context'
import { formatDateTime } from '../lib/agendas'
import { INTEREST_LABEL } from '../auth/application'
import type { Application, InterestKey } from '../auth/application'

const APPLICATION_COLUMNS =
  'user_id, student_no, age, source, certifications, interests, interest_other, motivation, introduction'

const ROLE_LABEL: Record<Role, string> = { member: '부원', officer: '임원진' }
const STATUS_LABEL: Record<Status, string> = {
  pending: '승인 대기',
  approved: '승인됨',
  rejected: '거절됨',
  removed: '탈퇴',
}

function PersonMeta({ info }: { info?: { username: string | null; phone: string | null } }) {
  if (!info || (!info.username && !info.phone)) return null
  return (
    <span className="hint" style={{ display: 'block' }}>
      {info.username && <>아이디 {info.username}</>}
      {info.username && info.phone && ' · '}
      {info.phone && <>전화 {info.phone}</>}
    </span>
  )
}

function ApplicationView({ app, open }: { app?: Application; open: boolean }) {
  if (!app) return <span className="hint" style={{ display: 'block' }}>가입 신청서 없음</span>
  const interests = app.interests.map((k) => {
    if (k === 'etc') return app.interest_other ? `기타(${app.interest_other})` : '기타'
    return INTEREST_LABEL[k as InterestKey] ?? k
  })
  return (
    <details className="application" open={open}>
      <summary>가입 신청서</summary>
      <dl>
        <dt>학번 · 나이</dt>
        <dd>{app.student_no} · {app.age}세</dd>
        <dt>알게 된 경로</dt>
        <dd>{app.source ?? '-'}</dd>
        <dt>보유 자격증</dt>
        <dd>{app.certifications ?? '-'}</dd>
        <dt>관심 분야</dt>
        <dd>{interests.length > 0 ? interests.join(', ') : '-'}</dd>
        <dt>가입 동기</dt>
        <dd className="pre">{app.motivation}</dd>
        <dt>자기소개</dt>
        <dd className="pre">{app.introduction}</dd>
      </dl>
    </details>
  )
}

function friendlyError(message: string): string {
  if (message.includes('임원진이 최소 1명')) return '승인된 임원진이 최소 1명은 있어야 합니다.'
  return '변경하지 못했습니다. 권한을 확인하고 다시 시도해 주세요.'
}

interface WithdrawalRequest {
  user_id: string
  reason: string | null
  requested_at: string
}

interface ResetRequest {
  user_id: string
  requested_at: string
}

const RESET_ERRORS = [
  '자기 자신의 비밀번호는 내 정보에서 바꿔 주세요.',
  '승인된 부원만 재설정할 수 있습니다.',
  '임시 비밀번호는 8~72자로 입력해 주세요.',
]

function resetError(message: string): string {
  return RESET_ERRORS.find((m) => message.includes(m)) ?? '비밀번호를 재설정하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

const REMOVE_ERRORS = [
  '임원진은 먼저 부원으로 변경해 주세요.',
  '자기 자신은 탈퇴시킬 수 없습니다.',
  '승인된 부원만 탈퇴시킬 수 있습니다.',
]

function removeError(message: string): string {
  return REMOVE_ERRORS.find((m) => message.includes(m)) ?? '탈퇴 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

export default function Admin() {
  const { profile: me } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const [privates, setPrivates] = useState<Record<string, { username: string | null; phone: string | null }>>({})
  const [applications, setApplications] = useState<Record<string, Application>>({})
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [resets, setResets] = useState<ResetRequest[]>([])
  const [tempPw, setTempPw] = useState<Record<string, string>>({})
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, status')
      .order('created_at', { ascending: true })
    if (error) setLoadError('목록을 불러오지 못했습니다.')
    else {
      setLoadError(null)
      setPeople(data as Profile[])
    }
    // 아이디·전화번호는 임원진(과 본인)에게만 보이는 뷰에서 읽는다.
    const priv = await supabase.from('profile_private').select('id, username, phone')
    if (!priv.error) {
      setPrivates(Object.fromEntries((priv.data ?? []).map((r) => [r.id as string, { username: r.username as string | null, phone: r.phone as string | null }])))
    }
    // 가입 신청서는 임원진(과 작성한 본인)에게만 보인다.
    const apps = await supabase.from('signup_applications').select(APPLICATION_COLUMNS)
    if (!apps.error) {
      setApplications(Object.fromEntries((apps.data as Application[]).map((a) => [a.user_id, a])))
    }
    const wd = await supabase
      .from('withdrawal_requests')
      .select('user_id, reason, requested_at')
      .order('requested_at', { ascending: true })
    if (!wd.error) setWithdrawals(wd.data as WithdrawalRequest[])
    const rs = await supabase
      .from('password_reset_requests')
      .select('user_id, requested_at')
      .order('requested_at', { ascending: true })
    if (!rs.error) setResets(rs.data as ResetRequest[])
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function update(id: string, patch: { status?: Status; role?: Role }) {
    setActionError(null)
    setBusyId(id)
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    setBusyId(null)
    if (error) setActionError(friendlyError(error.message))
    await load()
  }

  async function removeMember(p: Profile) {
    const ok = window.confirm(
      `${p.name}님을 탈퇴시킬까요?\n시간표와 전화번호가 삭제되고 되돌릴 수 없습니다.\n남긴 의견은 "탈퇴한 부원"으로 남고, 가입 신청서는 유지됩니다.`,
    )
    if (!ok) return
    setActionError(null)
    setBusyId(p.id)
    const { error } = await supabase.rpc('remove_member', { p_user: p.id })
    setBusyId(null)
    if (error) setActionError(removeError(error.message))
    await load()
  }

  /** 임원진이 정한 임시 비밀번호로 바꾼다. 그 계정의 기존 로그인은 모두 풀린다. */
  async function resetPassword(p: Profile) {
    const pw = tempPw[p.id] ?? ''
    setActionNotice(null)
    if (pw.length < 8) return setActionError('임시 비밀번호는 8자 이상으로 입력해 주세요.')
    if (pw.length > 72) return setActionError('임시 비밀번호는 72자 이하로 입력해 주세요.')
    if (!window.confirm(`${p.name}님의 비밀번호를 입력한 임시 비밀번호로 바꿀까요?\n이 계정의 기존 로그인은 모두 풀립니다.`)) return
    setActionError(null)
    setBusyId(p.id)
    const { error } = await supabase.rpc('reset_member_password', { p_user: p.id, p_password: pw })
    setBusyId(null)
    if (error) return setActionError(resetError(error.message))
    setTempPw((cur) => ({ ...cur, [p.id]: '' }))
    setActionNotice(`${p.name}님의 임시 비밀번호를 설정했습니다. 본인에게 직접 알려 주고, 로그인한 뒤 "내 정보"에서 바꾸라고 안내해 주세요.`)
    await load()
  }

  /** 재설정 요청을 지운다. 비밀번호는 바뀌지 않는다. */
  async function dismissReset(p: Profile) {
    if (!window.confirm(`${p.name}님의 재설정 요청을 지울까요? 비밀번호는 바뀌지 않습니다.`)) return
    setActionError(null)
    setActionNotice(null)
    setBusyId(p.id)
    const { error } = await supabase.from('password_reset_requests').delete().eq('user_id', p.id)
    setBusyId(null)
    if (error) setActionError('요청을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.')
    await load()
  }

  /** 탈퇴 신청을 거절한다. 신청을 지우기만 하고 부원은 그대로 남는다. */
  async function rejectWithdrawal(p: Profile) {
    if (!window.confirm(`${p.name}님의 탈퇴 신청을 거절할까요? 신청이 삭제되고 계속 부원으로 남습니다.`)) return
    setActionError(null)
    setBusyId(p.id)
    const { error } = await supabase.from('withdrawal_requests').delete().eq('user_id', p.id)
    setBusyId(null)
    if (error) setActionError('신청을 거절하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    await load()
  }

  if (me?.role !== 'officer') {
    return (
      <section className="card">
        <h2>관리</h2>
        <p>임원진만 볼 수 있는 화면입니다.</p>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="card">
        <p>불러오는 중...</p>
      </section>
    )
  }

  const pending = people.filter((p) => p.status === 'pending')
  const approved = people.filter((p) => p.status === 'approved')
  const rejected = people.filter((p) => p.status === 'rejected')
  const removed = people.filter((p) => p.status === 'removed')
  const withdrawing = withdrawals
    .map((w) => ({ w, p: people.find((x) => x.id === w.user_id && x.status === 'approved' && x.role === 'member') }))
    .filter((x): x is { w: WithdrawalRequest; p: Profile } => Boolean(x.p))
  const resetting = resets
    .map((r) => ({ r, p: people.find((x) => x.id === r.user_id && x.status === 'approved') }))
    .filter((x): x is { r: ResetRequest; p: Profile } => Boolean(x.p))

  return (
    <>
      {loadError && <p className="msg error" role="alert">{loadError}</p>}
      {actionError && <p className="msg error" role="alert">{actionError}</p>}

      {actionNotice && <p className="msg ok" role="status">{actionNotice}</p>}

      {resetting.length > 0 && (
        <section className="card">
          <h2>비밀번호 재설정 요청 ({resetting.length})</h2>
          <p className="hint" style={{ marginBottom: 8 }}>
            부원에게 직접 연락해 본인이 맞는지 확인한 뒤 임시 비밀번호(8자 이상)를 정해 주세요. 확인되지 않은 요청은 지워 주세요.
          </p>
          <ul className="list">
            {resetting.map(({ r, p }) => (
              <li key={p.id}>
                <span className="name">
                  {p.name}
                  <PersonMeta info={privates[p.id]} />
                  <span className="hint" style={{ display: 'block' }}>
                    요청 {formatDateTime(r.requested_at)}
                  </span>
                </span>
                <span className="row-actions">
                  <input
                    value={tempPw[p.id] ?? ''}
                    onChange={(e) => setTempPw((cur) => ({ ...cur, [p.id]: e.target.value }))}
                    placeholder="임시 비밀번호"
                    maxLength={72}
                    autoComplete="off"
                    style={{ width: 140 }}
                  />
                  <button className="btn btn-sm" disabled={busyId === p.id} onClick={() => resetPassword(p)}>
                    재설정
                  </button>
                  <button className="btn btn-sm btn-ghost" disabled={busyId === p.id} onClick={() => dismissReset(p)}>
                    지우기
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>승인 대기 ({pending.length})</h2>
        {pending.length === 0 ? (
          <p>대기 중인 가입 요청이 없습니다.</p>
        ) : (
          <ul className="list">
            {pending.map((p) => (
              <li key={p.id}>
                <span className="name">
                  {p.name}
                  <PersonMeta info={privates[p.id]} />
                  <ApplicationView app={applications[p.id]} open />
                </span>
                <span className="row-actions">
                  <button className="btn btn-sm" disabled={busyId === p.id} onClick={() => update(p.id, { status: 'approved' })}>
                    승인
                  </button>
                  <button className="btn btn-sm btn-ghost" disabled={busyId === p.id} onClick={() => update(p.id, { status: 'rejected' })}>
                    거절
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {withdrawing.length > 0 && (
        <section className="card">
          <h2>탈퇴 신청 ({withdrawing.length})</h2>
          <ul className="list">
            {withdrawing.map(({ w, p }) => (
              <li key={p.id}>
                <span className="name">
                  {p.name}
                  <span className="hint" style={{ display: 'block' }}>
                    신청 {formatDateTime(w.requested_at)}
                    {w.reason && <> · 사유: {w.reason}</>}
                  </span>
                </span>
                <span className="row-actions">
                  <button className="btn btn-sm" disabled={busyId === p.id} onClick={() => removeMember(p)}>
                    승인(탈퇴)
                  </button>
                  <button className="btn btn-sm btn-ghost" disabled={busyId === p.id} onClick={() => rejectWithdrawal(p)}>
                    거절
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>부원 ({approved.length})</h2>
        <ul className="list">
          {approved.map((p) => (
            <li key={p.id}>
              <span className="name">
                {p.name} <span className={p.role === 'officer' ? 'badge' : 'badge muted'}>{ROLE_LABEL[p.role]}</span>
                {p.id === me.id && <span className="badge muted">나</span>}
                <PersonMeta info={privates[p.id]} />
                <ApplicationView app={applications[p.id]} open={false} />
              </span>
              <span className="row-actions">
                <button
                  className="btn btn-sm btn-ghost"
                  disabled={busyId === p.id}
                  onClick={() => update(p.id, { role: p.role === 'officer' ? 'member' : 'officer' })}
                >
                  {p.role === 'officer' ? '부원으로 변경' : '임원진으로 변경'}
                </button>
                {p.role === 'member' && p.id !== me.id && (
                  <button className="btn btn-sm btn-ghost" disabled={busyId === p.id} onClick={() => removeMember(p)}>
                    탈퇴
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {removed.length > 0 && (
        <section className="card">
          <h2>탈퇴 ({removed.length})</h2>
          <p className="hint" style={{ marginBottom: 8 }}>
            다시 활동하려면 본인이 로그인해서 "복귀 신청"을 하면 승인 대기 목록에 나타납니다. 그때 승인해 주세요.
          </p>
          <ul className="list">
            {removed.map((p) => (
              <li key={p.id}>
                <span className="name">
                  {p.name} <span className="badge muted">{STATUS_LABEL.removed}</span>
                  <PersonMeta info={privates[p.id]} />
                  <ApplicationView app={applications[p.id]} open={false} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rejected.length > 0 && (
        <section className="card">
          <h2>거절됨 ({rejected.length})</h2>
          <ul className="list">
            {rejected.map((p) => (
              <li key={p.id}>
                <span className="name">
                  {p.name} <span className="badge error">{STATUS_LABEL.rejected}</span>
                  <PersonMeta info={privates[p.id]} />
                  <ApplicationView app={applications[p.id]} open={false} />
                </span>
                <span className="row-actions">
                  <button className="btn btn-sm btn-ghost" disabled={busyId === p.id} onClick={() => update(p.id, { status: 'approved' })}>
                    다시 승인
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
