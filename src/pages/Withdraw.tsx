import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'
import { useDialog } from '../components/dialog-context'
import { formatDateTime } from '../lib/agendas'

interface WithdrawalRequest {
  reason: string | null
  requested_at: string
}

function fetchRequest(userId: string) {
  return supabase
    .from('withdrawal_requests')
    .select('reason, requested_at')
    .eq('user_id', userId)
    .maybeSingle()
}

export default function Withdraw() {
  const { session, profile } = useAuth()
  const dialog = useDialog()
  const userId = session!.user.id
  const [request, setRequest] = useState<WithdrawalRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetchRequest(userId).then(({ data, error: err }) => {
      if (!alive) return
      if (err) setLoadError('탈퇴 신청 상태를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
      else setRequest(data as WithdrawalRequest | null)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [userId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const text = reason.trim()
    if (text.length > 200) return setError('사유는 200자 이하로 입력해 주세요.')
    const ok = await dialog.confirm({
      title: '탈퇴 신청',
      message: '탈퇴를 신청할까요?\n임원진이 승인하면 시간표와 전화번호가 삭제되고, 남긴 의견은 "탈퇴한 부원"으로 표시됩니다.',
      confirmLabel: '탈퇴 신청',
      danger: true,
    })
    if (!ok) return
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.from('withdrawal_requests').insert({ user_id: userId, reason: text || null })
    if (err) {
      setBusy(false)
      return setError('탈퇴 신청을 하지 못했습니다. 이미 신청했거나 잠시 후 다시 시도해야 할 수 있습니다.')
    }
    const { data } = await fetchRequest(userId)
    setRequest(data as WithdrawalRequest | null)
    setReason('')
    setBusy(false)
  }

  async function cancel() {
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.from('withdrawal_requests').delete().eq('user_id', userId)
    setBusy(false)
    if (err) return setError('신청을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    setRequest(null)
  }

  if (loading) return <p className="center">불러오는 중...</p>

  if (profile?.role === 'officer') {
    return (
      <section className="card">
        <h2>탈퇴 신청</h2>
        <p>임원진은 바로 탈퇴를 신청할 수 없습니다. 다른 임원진에게 "부원으로 변경"을 요청한 뒤 신청해 주세요.</p>
      </section>
    )
  }

  return (
    <>
      {loadError && <p className="msg error" role="alert">{loadError}</p>}
      <section className="card">
        <h2>탈퇴 신청</h2>
        {request ? (
          <>
            <p className="msg notice" role="status">
              탈퇴를 신청했습니다. 임원진이 승인하면 탈퇴 처리됩니다. 그때까지는 계속 이용할 수 있어요.
            </p>
            <p className="hint" style={{ marginTop: 12 }}>
              신청 일시: {formatDateTime(request.requested_at)}
              {request.reason && <> · 사유: {request.reason}</>}
            </p>
            {error && <p className="msg error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
            <div className="actions">
              <button className="btn btn-ghost" disabled={busy} onClick={cancel}>
                {busy ? '처리 중...' : '신청 취소'}
              </button>
            </div>
          </>
        ) : (
          <form className="form" onSubmit={submit}>
            <p className="hint">
              임원진이 승인하면 탈퇴 처리됩니다. 탈퇴하면 내 시간표와 전화번호가 삭제되고, 내가 남긴 의견은 "탈퇴한 부원"으로
              표시됩니다. 승인되기 전에는 계속 이용할 수 있고, 언제든 신청을 취소할 수 있어요.
            </p>
            <label>
              사유 (선택)
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} rows={3} />
            </label>
            {error && <p className="msg error" role="alert">{error}</p>}
            <div className="actions" style={{ marginTop: 0 }}>
              <button className="btn" disabled={busy}>{busy ? '신청 중...' : '탈퇴 신청'}</button>
            </div>
          </form>
        )}
      </section>
    </>
  )
}
