import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import Brand from '../components/Brand'

interface Props {
  kind: 'pending' | 'rejected' | 'removed' | 'error'
}

const COPY = {
  pending: {
    title: '승인 대기 중입니다',
    body: '임원진이 가입을 승인하면 바로 이용할 수 있습니다. 승인 후 아래 "다시 확인"을 눌러 주세요.',
  },
  rejected: {
    title: '가입이 승인되지 않았습니다',
    body: '가입 요청이 거절되었습니다. 잘못 처리된 것이라면 임원진에게 문의해 주세요.',
  },
  removed: {
    title: '탈퇴 처리된 계정입니다',
    body: '임원진이 탈퇴 처리한 계정입니다. 다시 활동하고 싶다면 아래 "복귀 신청"을 눌러 주세요. 임원진이 승인하면 이용할 수 있고, 시간표는 다시 입력해야 합니다.',
  },
  error: {
    title: '정보를 불러오지 못했습니다',
    body: '네트워크를 확인한 뒤 다시 시도해 주세요.',
  },
} as const

export default function StatusScreen({ kind }: Props) {
  const { profile, profileError, refreshProfile, signOut } = useAuth()
  const [checking, setChecking] = useState(false)
  const copy = COPY[kind]

  const [rejoinError, setRejoinError] = useState<string | null>(null)

  async function recheck() {
    setChecking(true)
    await refreshProfile()
    setChecking(false)
  }

  /** 탈퇴 계정이 복귀를 신청한다. 승인 대기로 바뀌면 임원진이 승인한다. */
  async function rejoin() {
    setChecking(true)
    setRejoinError(null)
    const { error } = await supabase.rpc('request_rejoin')
    if (error) setRejoinError('복귀 신청을 하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    else await refreshProfile()
    setChecking(false)
  }

  return (
    <div className="auth-wrap">
      <header className="app-header">
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          <Brand />
          <p>{profile ? `${profile.name}님` : '로그인됨'}</p>
        </div>
      </header>
      <main className="container" style={{ maxWidth: 420 }}>
        <section className="card">
          <h2>{copy.title}</h2>
          <p>{kind === 'error' && profileError ? profileError : copy.body}</p>
          {rejoinError && <p className="msg error" role="alert">{rejoinError}</p>}
          <div className="actions">
            {kind === 'removed' ? (
              <button className="btn" onClick={rejoin} disabled={checking}>
                {checking ? '신청 중...' : '복귀 신청'}
              </button>
            ) : (
              <button className="btn" onClick={recheck} disabled={checking}>
                {checking ? '확인 중...' : '다시 확인'}
              </button>
            )}
            <button className="btn btn-ghost" onClick={signOut}>
              로그아웃
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
