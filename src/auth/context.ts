import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { ApplicationInput } from './application'

export type Role = 'member' | 'officer'
export type Status = 'pending' | 'approved' | 'rejected' | 'removed'

export interface Profile {
  id: string
  name: string
  role: Role
  status: Status
}

export interface SignUpInput {
  username: string
  name: string
  password: string
  inviteCode: string
  phone?: string
  application: ApplicationInput
}

export interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileError: string | null
  /** loginId: 아이디 또는(@ 포함 시) 기존 이메일 */
  signIn: (loginId: string, password: string) => Promise<string | null>
  isUsernameAvailable: (username: string) => Promise<boolean | null>
  /** 성공 시 { error: null, needsEmailConfirm }, 실패 시 { error: 메시지 } */
  signUp: (input: SignUpInput) => Promise<{ error: string | null; needsEmailConfirm: boolean }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
