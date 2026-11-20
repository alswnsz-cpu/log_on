import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import AuthProvider from './auth/AuthProvider'
import { useAuth } from './auth/useAuth'
import AuthScreen from './auth/AuthScreen'
import StatusScreen from './auth/StatusScreen'
import Layout from './components/Layout'
import Calendar from './pages/Calendar'
import Hub from './pages/Hub'
import Schedule from './pages/Schedule'
import Common from './pages/Common'
import Members from './pages/Members'
import Agendas from './pages/Agendas'
import AgendaDetail from './pages/AgendaDetail'
import Archive from './pages/Archive'
import AlbumDetail from './pages/AlbumDetail'
import Portfolio from './pages/Portfolio'
import Sites from './pages/explore/Sites'
import MeetingNotes from './pages/MeetingNotes'
import ContentPlanner from './pages/ContentPlanner'
import ContentTasks from './pages/ContentTasks'
import Admin from './pages/Admin'
import Withdraw from './pages/Withdraw'
import Profile from './pages/Profile'

/**
 * 승인된 사용자의 앱. 시간표 "입력 완료"를 누르기 전에는 내 시간표(와 임원진의 관리 화면)만 열린다.
 * 졸업생은 시간표를 입력하지 않으므로 이 관문 없이 모든 화면이 열린다.
 */
function ApprovedApp({ userId }: { userId: string }) {
  const [done, setDone] = useState<boolean | null>(null)
  const [alumni, setAlumni] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.all([
      supabase.from('schedule_status').select('user_id').eq('user_id', userId).maybeSingle(),
      supabase.from('member_alumni').select('user_id').eq('user_id', userId).maybeSingle(),
    ]).then(([s, a]) => {
      if (!alive) return
      if (s.error) return setFailed(true)
      // 졸업 표시를 못 읽어도 앱 전체를 막지 않고 현재 부원으로 본다
      setAlumni(!a.error && Boolean(a.data))
      setDone(Boolean(s.data))
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

  /** 화면 전체가 열리는 상태: 시간표 입력을 마쳤거나 졸업생이다 */
  const open = done || alumni

  return (
    <Routes>
      <Route element={<Layout locked={!open} alumni={alumni} />}>
        <Route path="schedule" element={<Schedule done={done} onComplete={complete} />} />
        {open && (
          <>
            <Route index element={<Hub alumni={alumni} />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="common" element={<Common />} />
            <Route path="members" element={<Members />} />
            <Route path="meetings" element={<MeetingNotes />} />
            <Route path="content" element={<ContentPlanner />} />
            <Route path="tasks" element={<ContentTasks />} />
            <Route path="agendas" element={<Agendas />} />
            <Route path="agendas/:id" element={<AgendaDetail />} />
            {/* 예전 결론 주소: 저장된 링크가 열리도록 토론의 "확정 및 결론" 탭으로 보낸다 */}
            <Route path="decisions" element={<Navigate to="/agendas?tab=decided" replace />} />
            <Route path="archive" element={<Archive />} />
            <Route path="archive/:id" element={<AlbumDetail />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="explore" element={<Navigate to="/explore/sites" replace />} />
            <Route path="explore/sites" element={<Sites />} />
          </>
        )}
        <Route path="admin" element={<Admin />} />
        <Route path="withdraw" element={<Withdraw />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to={open ? '/' : '/schedule'} replace />} />
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
