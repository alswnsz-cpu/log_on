import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthState, type Profile, type SignUpInput } from './context'
import { loginIdToEmail, normalizeUsername, usernameToEmail } from './username'

function toKoreanError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return '아이디 또는 비밀번호가 올바르지 않습니다.'
  if (m.includes('email not confirmed')) return '계정 확인이 필요합니다. 임원진에게 문의해 주세요.'
  if (m.includes('already registered') || m.includes('already been registered')) return '이미 사용 중인 아이디입니다.'
  if (m.includes('database error saving new user') || m.includes('가입 코드')) {
    return '가입 코드가 올바르지 않거나 가입 처리에 실패했습니다.'
  }
  if (m.includes('password')) return '비밀번호 조건을 확인해 주세요. (8자 이상)'
  if (m.includes('rate limit')) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  return '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const userId = session?.user.id ?? null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setSessionReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const loadProfile = useCallback(async (id: string) => {
    setProfileLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, role, status')
      .eq('id', id)
      .maybeSingle()
    if (error) {
      setProfile(null)
      setProfileError('내 정보를 불러오지 못했습니다.')
    } else {
      setProfile(data as Profile | null)
      setProfileError(data ? null : '프로필이 없습니다. 임원진에게 문의해 주세요.')
    }
    setProfileLoading(false)
  }, [])

  useEffect(() => {
    if (!userId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfile(null)
      setProfileError(null)
      return
    }
    loadProfile(userId)
  }, [userId, loadProfile])

  const signIn = useCallback(async (loginId: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: loginIdToEmail(loginId), password })
    return error ? toKoreanError(error.message) : null
  }, [])

  /** 사용 가능하면 true, 중복이면 false, 확인 실패면 null */
  const isUsernameAvailable = useCallback(async (username: string) => {
    const { data, error } = await supabase.rpc('username_available', { p_username: normalizeUsername(username) })
    return error ? null : (data as boolean)
  }, [])

  const signUp = useCallback(async ({ username, name, password, inviteCode, phone, application }: SignUpInput) => {
    const { data, error } = await supabase.auth.signUp({
      email: usernameToEmail(username),
      password,
      options: {
        data: {
          name,
          username: normalizeUsername(username),
          invite_code: inviteCode,
          ...(phone ? { phone } : {}),
          student_no: application.studentNo,
          age: application.age,
          interests: application.interests,
          motivation: application.motivation,
          introduction: application.introduction,
          ...(application.source ? { source: application.source } : {}),
          ...(application.certifications ? { certifications: application.certifications } : {}),
          ...(application.interestOther ? { interest_other: application.interestOther } : {}),
        },
      },
    })
    if (error) return { error: toKoreanError(error.message), needsEmailConfirm: false }
    // 이메일 확인이 켜져 있으면 중복 가입이 오류 없이 빈 identities 로 돌아온다.
    if (data.user && data.user.identities?.length === 0) {
      return { error: '이미 사용 중인 아이디입니다.', needsEmailConfirm: false }
    }
    return { error: null, needsEmailConfirm: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId)
  }, [userId, loadProfile])

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading: !sessionReady || (userId !== null && profileLoading && !profile),
      profileError,
      signIn,
      isUsernameAvailable,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, sessionReady, userId, profileLoading, profileError, signIn, isUsernameAvailable, signUp, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
