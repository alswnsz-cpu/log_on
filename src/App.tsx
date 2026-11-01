import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import AuthProvider from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import AuthScreen from './auth/AuthScreen'
import StatusScreen from './auth/StatusScreen'
import Layout from './components/Layout'
import Schedule from './pages/Schedule'
import Common from './pages/Common'
import Agendas from './pages/Agendas'
import AgendaDetail from './pages/AgendaDetail'
import Decisions from './pages/Decisions'
import Admin from './pages/Admin'
import Withdraw from './pages/Withdraw'
import Profile from './pages/Profile'

/** 승인된 사용자의 앱. 시간표 "입력 완료"를 누르기 전에는 내 시간표(와 임원진의 관리 화면)만 열린다. */
function ApprovedApp({ userId }: { userId: string }) {
  const [done, setDone] = useState<boolean | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    supabase
      .from('schedule_status')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        if (error) setFailed(true)
        else setDone(Boolean(data))
      })
    return () => {
      alive = false
    }
  }, [userId])

  /** 입력 완료로 기록한다. 이미 기록돼 있어도 성공으로 본다. */
  const complete = useCallback(async () => {
    const { error } = await supabase
      .from('schedule_status')
      .upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true })
    if (error) return false
    setDone(true)
    return true
  }, [userId])

  if (failed) {
    return (
      <div className="container" style={{ maxWidth: 420 }}>
        <p className="msg error" role="alert">시간표 입력 상태를 불러오지 못했습니다. 새로고침해 주세요.</p>
      </div>
    )
  }
  if (done === null) {
    return (
      <div className="container" style={{ maxWidth: 420 }}>
        <p className="center">불러오는 중...</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<Layout locked={!done} />}>
        <Route index element={<Schedule done={done} onComplete={complete} />} />
        {done && (
          <>
            <Route path="common" element={<Common />} />
            <Route path="agendas" element={<Agendas />} />
            <Route path="agendas/:id" element={<AgendaDetail />} />
            <Route path="decisions" element={<Decisions />} />
          </>
        )}
        <Route path="admin" element={<Admin />} />
        <Route path="withdraw" element={<Withdraw />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function Gate() {
  const { session, profile, loading, profileError } = useAuth()

  if (loading) {
    return (
      <div className="container" style={{ maxWidth: 420 }}>
        <p className="center">불러오는 중...</p>
      </div>
    )
  }
  if (!session) return <AuthScreen />
  if (!profile) return <StatusScreen kind={profileError ? 'error' : 'pending'} />
  if (profile.status === 'pending') return <StatusScreen kind="pending" />
  if (profile.status === 'rejected') return <StatusScreen kind="rejected" />
  if (profile.status === 'removed') return <StatusScreen kind="removed" />

  return <ApprovedApp userId={profile.id} />
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
